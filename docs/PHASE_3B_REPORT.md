# Phase 3B - Victory reward integrity

Implemented October 22, 2026, on `fix/ember-victory-idempotence`. Scope: F02. No commit, push, merge or deployment was performed.

## Root cause and lifecycle trace

`Engine.settle()` detects eight completed sequences and sets `g.won` / `res.won`. Its separate `bestCompleted` high-water mark protects sequence payouts when a move is undone. `Engine.undo()` restores columns, stock, completion count and moves, clears `won`, and leaves the high-water mark intact. Before this change, `Store.applyResult()` treated every `res.won` as a new entitlement. Undo/replay therefore paid the victory again: the original regression reports two wins / 160 Ember instead of one win / 85 Ember. Reusing a winning result could also repeat its sequence reward and move statistics.

Victory progression affects Ember/total Ember/forge level, artifact Ember/heat/reserve and artifact victories, overall/suit-specific wins, streak/best streak, lowest moves/best time and the hand's run total. A daily hand also updates the date ledger/perfect flag and may grant the existing once-per-date daily bonus. Achievements in `screens.js` are derived from these counters and artifact tiers/completed records; there is no separate achievement payment store.

`Board.afterAction()` invokes progression synchronously, then renders and schedules `Board.onWin`; boot wires that callback to `Ceremony.victory()`. The ceremony displays progression already earned. It does not call applyResult or directly award the core victory, but does invoke existing analytics/ad pacing and offer the existing opt-in reward pathway. Those monetization paths are unchanged. Loading a won hand does not run settlement or automatically reopen the ceremony.

## Files changed

- `site/ember-solitaire/js/store.js`: hand identities/settlement receipts, compatibility normalization, receipt validation, idempotent winning-result handling, batched victory notifications, synchronous full-settlement persistence and calculation-error rollback.
- `tests/regressions.test.mjs`: F02 TODO removed; original assertions unchanged. Both F14 TODOs remain unchanged.
- `tests/victory.test.mjs`: full-deck deterministic final-hand fixtures and victory integrity tests, including actual ceremony invocation with minimal presentation stubs.
- `tests/engine.test.mjs`, `tests/persistence.test.mjs`: expected legacy fixture objects explicitly include the new additive receipt after migration. Original deep comparisons and all existing assertions remain; generated IDs have additional format checks. Fixture files were not edited.
- `docs/TESTING.md` and this report: current results, compatibility, limitations and release checks.

The only modified application file is the tracked store source. Engine rules, board/screen/ceremony code, advertising, art, service worker and Vercel configuration are unchanged. No new dependencies, backend, database or application framework were introduced. Generated dist is rebuilt from site.

## Identity and settlement after the fix

The optional `game.settlement` metadata is:

```json
{"v":1,"handId":"h-<time>-<serial>-<128-bit-random-hex>","victoryPaid":false}
```

The example describes the format, not a literal valid receipt. The root save version and key remain v2 / `ember.save.v2`.

A new engine-created hand receives an identity when registered by Store.startGame. It uses Web Crypto when available, with a timestamp/session serial plus random-word fallback for environments without Web Crypto. It never uses seed/difficulty as identity. Registration of the already-active object is a no-op. The same receipt survives ordinary moves, undo, export/import and save/load because it is outside engine undo snapshots. A genuinely new/restarted engine hand gets a new identity even with identical seed, cards, timestamp and suit count.

Only the current store-owned hand can apply a result. Winning processing requires an actual won/eight-set state and an unpaid receipt. The receipt is claimed before any progression notifications. A repeated winning result (including copied callback data) returns `{ember:0}` without changing balances, sequences, counters or artifacts. Undo remains allowed under existing rules; replaying the final winning result is a settlement no-op, including its aggregate move/counter accounting. Ordinary nonwinning actions retain existing progression behavior. This phase does not attempt general idempotence for arbitrary repeated nonwinning action results.

The receipt stays paid after undo. A stale/detached hand cannot settle against a different current hand. The receipt travels with the active hand; no unbounded all-hands reward ledger is needed. Different legitimate active hands can each pay once. Restart is a new hand, matching existing game/statistics semantics; same-day daily bonuses still remain once per ledger date.

Victory values, sequences and receipt are updated together in memory. Save requests and Ember/analytics notifications raised during that calculation are deferred until the whole calculation completes. A successful final calculation makes one immediate full-profile save attempt before releasing notifications. A reentrant listener cannot persist half a victory. Calculation exceptions roll back the affected in-memory profile/hand values before propagating the error; no partial payout is written. Normal storage failures keep the complete in-memory payout/receipt and retain Phase 3A's unsaved warning. Retrying save writes the same state; it never recomputes rewards.

## v2 and Phase 3A compatibility

Missing metadata is valid legacy v2 data. On activation/load or validated import, a cloned/validated hand gains a receipt. Existing fields, earned balances, statistics, artifacts, settings and ledgers remain unchanged. Reading/migrating a valid save does not itself overwrite the raw storage value. Subsequent normal saving retains Phase 3A's last-good backup before replacement. Profiles without active hands need no new metadata.

Legacy `won` / `bestCompleted === 8` hands are conservatively marked already paid, including hands undone after a prior win. Loading/replaying them never silently grants another victory. No historical overpayment is deducted and no historical total is recalculated. If a very old interrupted save reached the high-water mark but somehow omitted its payout, this conservative policy cannot infer that missing entitlement and does not grant speculative backpay.

A present receipt must have the supported receipt version, correctly shaped identity, boolean paid marker and no unknown receipt fields. The marker must agree with whether the hand's high-water mark reached eight. An explicit false marker paired with an eight-set high-water state is inconsistent, unlike an absent legacy receipt. Malformed/unsupported receipts go through Phase 3A's existing bad-hand recovery: valid profile data remains, the raw original is quarantined/protected, the hand is excluded, and normal saves stay blocked until explicit recovery. Invalid imports are rejected. Unsupported root profile versions remain protected as before.

Receipt metadata is not authentication or an anti-cheat boundary. Restoring an older explicit profile export restores that profile's progression as a whole; it is not a cross-profile merge or a cross-device reward ledger.

## Automated validation

Preflight: clean working tree on the named branch. `node --test` ran **78 tests: 75 pass, three expected TODO failures, zero unexpected failures**.

Final commands:

```powershell
node build.mjs
node tools/verify-source.mjs
node --test
git diff --check
git status --short
```

Final result: **107 tests: 105 pass, two expected failing F14 TODOs, zero unexpected failures, zero skipped/cancelled**. F02 now passes without a TODO. Phase 3A's recovery, storage-failure, fixture and UI-wiring tests pass.

The 29 added victory tests cover:

- First wins for all 1/2/4-suit modes, repeated/copy callbacks, undo/replay, paid reloads and complete side-effect comparisons.
- New hands with repeated seeds/time/cards, active-object registration and detached/incomplete callback rejection.
- Legacy active profiles, profiles without a hand, already-won legacy hands, undone legacy wins, import normalization and stable identities across persistence.
- Daily reward/perfect ledger behavior across duplicate wins and separate same-day games.
- Artifact counters/heat/reserve, win-based achievement threshold counters and later forging/artifact selection.
- Primary/backup write failures, visible unsaved state, safe retries, whole-profile pre-win crash recovery, reentrant notification writes and calculation-error rollback.
- Malformed/unsupported receipt shapes, inconsistent paid/high-water metadata and unsupported root saves.
- Opening/reopening the actual ceremony without core progression changes. Presentation/ad/analytics services are stubbed; this does not certify their browser/native behavior.

Build and verifier: **143 tracked source files / 143 matching generated files**, zero source/output errors, **23 syntax checks**, **2 JSON checks**, **421 local references**, **131 precache URLs**, **9 route URLs**. **138 files** still match the original archive; the archive/inventory are historical evidence and were not regenerated. Their Phase 3A baseline distinction is unchanged: five application files differ from the original archive, but only store.js changes in this phase.

Historical archive SHA-256 remains `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`. Test logs and verifier output are retained locally under ignored `.phase2-backup/`. Build rollback output remains in ignored `.dist-backup-*` directories.

## Remaining limitations

- A primary localStorage write is one complete serialized profile containing progression and receipt. Backup and primary writes are separate operations. A crash before the primary succeeds leaves the prior whole profile; after success, reload sees the paid receipt and rewards together. Failed writes can lose an in-memory win if the page closes before retry/export; they do not grant a partial persisted receipt or duplicate the durable payout. This is not a fully transactional disk/cross-device guarantee.
- The old last-good backup may represent a pre-win state. Restoring it intentionally restores that earlier entire profile. Never merge its hand into a newer rewarded profile or clear player storage as a workaround.
- Multi-tab conflict arbitration, native Preferences hydration/mirroring and broader storage durability remain outside this phase. Use one tab during recovery. Existing Phase 3A warnings and export controls remain necessary.
- F03 service-worker release mixing is unchanged; an old cached store can still run old behavior until the separately reviewed update policy is addressed. No caching change was bundled here.
- F04 delayed/stale ceremonies and other async lifecycle races, F05 timing issues, and both F14 rule predicates remain unfixed. Presentation callbacks can still repeat analytics/ad pacing or show stale UI; core victory settlement is now independent of those callbacks. This phase does not change ad pacing or opt-in rewards.
- Calculations assume valid supported application state/configuration, as before. A calculation exception is propagated after rollback; browser-level presentation/retry UX for such unexpected programming/configuration errors is not added here.

## Manual browser verification before release

Use a separate local/preview origin and disposable profiles, never real player saves:

1. Complete a hand in each suit mode. Record Ember, total Ember, overall/suit wins, streaks, artifact victory/heat/reserve and achievement thresholds. Confirm one payout and the normal victory presentation.
2. Undo and replay the final move during the existing 1.3-second ceremony delay, then reload before/after presentation. Inspect that handId stays stable, victoryPaid stays true and no core reward/counter repeats. Record any stale/duplicate ceremony as the outstanding F04 issue, not a payment success.
3. Reload a won hand, then test legacy v2 hand saves with metadata absent (won, active and undone-after-win). Verify conservative legacy handling and unchanged historical progress.
4. Play Again and Restart this deal with repeated seeds/modes. Verify new IDs and one independent victory reward per new hand, while the same-day daily bonus stays once per date.
5. On a daily hand, cross the sequence goal before victory and also test a final-move goal fixture. Confirm one daily bonus, correct perfect flag and no duplicate counters.
6. Inject denied/quota storage and force primary/backup failure at victory. Confirm the warning remains visible, memory export includes the receipt/rewards, retry does not pay again and reload sees either the entire old profile or the entire new profile.
7. Import valid legacy/current saves and malformed/future receipts. Confirm current hand preservation or explicit protected recovery as appropriate, exact raw recovery copies, and no changes to unrelated profile progress.
8. Check desktop Chrome/Edge and mobile Safari/Chrome, narrow screens, keyboard/undo behavior, artifact forging after a win and existing service-worker clients. Automated DOM stubs do not validate layout, animation timing, offline upgrades, native adapters or real downloads.

No browser automation, preview deployment or live player storage was used in this phase. Stop after Phase 3B.

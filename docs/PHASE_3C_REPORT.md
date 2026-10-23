# Phase 3C - Game rule correctness

Implemented October 22, 2026, on `fix/ember-f14-card-rules`. Scope: the two outstanding F14 visibility defects. No commit, push, merge or deployment was performed.

## Root causes and exact changes

F14-A: `Engine.movable()` checked only the first selected card's face-up status. Its adjacent-pair loop checked rank/suit, so a same-suit descending suffix could still be accepted with a face-down middle or final card. It now rejects an empty suffix or any selected card whose `up` flag is false. Existing adjacent rank/suit comparisons are unchanged. A face-down predecessor outside the selected suffix does not prevent a valid move.

F14-B: `Engine.checkSets()` checked face-up status inside a loop that stopped before the thirteenth card. The Ace was compared for rank/suit but never checked for visibility. The candidate now requires all thirteen cards to be face-up before the existing King/Ace endpoints and adjacent rank/suit checks can pass. Invalid candidates never reach the removal/reveal/completion-count branch.

These are **two changed condition lines** in the engine. There is no move-rule, reward, persistence or UI refactor.

## Files modified

- `site/ember-solitaire/js/engine.js`: the two visibility conditions above.
- `tests/regressions.test.mjs`: removed both F14 TODO markers, preserving their original assertions. All four original regressions now pass as ordinary tests.
- `tests/card-rules.test.mjs`: 45 targeted rule, search, invariant, differential and integration tests.
- `docs/TESTING.md` and this report: updated regression status, results and remaining checks.

No store, board, victory receipt, reward calculation, fixture, analytics/ad, graphic, service-worker, build or Vercel configuration changes were made. The historical archive/inventory are preserved. Generated dist was rebuilt from site, not edited.

## Before and after behavior

| Position | Before | After |
| --- | --- | --- |
| Descending same-suit suffix with face-up first card and face-down later card | Could be lifted | Rejected without mutation |
| Complete K-A with face-down Ace | Could be removed/counted | Retained without reveal, count or settlement result |
| Any face-down card in a completion candidate | Ace was missed | All thirteen positions reject |
| Legal single card or descending same-suit face-up run | Legal | Remains legal |
| Legal suffix over an unselected face-down predecessor | Legal; predecessor revealed after move | Same behavior |
| Multiple legitimate sequences / undo / high-water tracking | Existing settlement semantics | Same behavior |

`canMove`, hints, smartTarget and the private search move enumerator all use movable. Endgame application uses checkSets. They inherit the corrected checks without duplicating rules. Board selection, drag targets, keyboard selection and smart movement already delegate to these engine predicates, so board code is unchanged.

## Tests added and compatibility

The 45 new tests cover legal single/multi-card moves and empty destinations; face-down leading/middle/final cards; unselected face-down predecessors; mixed suits, rank gaps/ascending runs and empty suffixes; every face-down position in a K-A candidate; incomplete/mixed/wrong-rank candidates; exact unchanged state on rejection; legal completions of all four suits; multiple removals within/across columns; reveal/undo and high-water replay semantics.

Hint/smart-target tests check that proposed suffixes are individually face-up and correctly ranked/suited. Test-only VM instrumentation inspects the private legalMoves enumerator without changing the production API. A stuck-search fixture verifies an illegal face-down lift is not counted as progress. Auto-complete rejects face-down positions, and executable plans for valid canonical final hands are verified one move at a time.

For each 1/2/4-suit mode, up to 100 deterministic legal-play/deal/undo actions are compared against the historical archived engine. State/results and hints match, with independent unique-ID and 104-card accounting checks. This comparison is restricted to valid positions; the archived defects are deliberately not used as the expected behavior for malformed positions.

Save/reload integration uses complete canonical deck identities: seven completed sequences plus the remaining K-A split for a final move. All three suit modes validate through the unchanged Phase 3A validator, solve and settle through Phase 3B, retain the same hand identity/paid receipt through reload and undo/replay, and grant the existing daily/victory amounts once. Synthetic malformed positions are confined to engine-only tests; production save validation was not relaxed.

The root schema/key remain v2 / `ember.save.v2`; no migration or player-data rewrite is added. Existing earned balances, stats, artifacts, settings and daily records are untouched. Phase 3A protection/export/import/storage-failure tests and Phase 3B settlement tests continue to pass. Fixture files and original assertions were preserved.

## Validation results

Preflight: clean working tree on `fix/ember-f14-card-rules`; **107 tests, 105 pass, two expected failing F14 TODOs, zero unexpected failures**.

Final commands:

```powershell
node build.mjs
node tools/verify-source.mjs
node --test
git diff --check
git status --short
```

Final test result: **152 tests, 152 pass, zero failures, zero TODOs, zero skipped/cancelled**. The four original F01/F02/F14 regressions all pass without TODO markers.

Build/verifier: **143 source files match 143 generated files**, zero missing/stale/changed output, **23 syntax checks**, **2 JSON checks**, **421 local references**, **131 precache URLs**, **9 public route URLs**, zero verifier errors. **137 files** remain identical to the historical archive; engine.js is the one additional intentionally changed application file relative to Phase 3B. No historical baseline was regenerated.

Historical archive SHA-256 remains `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`. Full test/verifier logs are retained locally in ignored `.phase2-backup/`; existing build output rollback copies are retained in `.dist-backup-*`. Git diff whitespace checks pass; changes remain uncommitted.

## Remaining issues and risks

- F03 offline update/release mixing, F04 asynchronous/ceremony races and F05 timer lifecycle problems remain separate. An old service worker may continue serving old engine code; its policy/version was not modified.
- The broader audit's engine input/index hardening and heuristic stuck-search limitations are not claimed fixed. Engine APIs still assume their established data shapes/normal indexes; Phase 3A remains the persistence boundary. These two visibility fixes are not a general validator or a proof that a position is reachable/winnable.
- Multi-tab conflict handling, native persistence, physical storage durability and Phase 3B's documented failed-write/crash limitations are unchanged.
- Automated checks establish engine behavior and save/progression compatibility, not browser layout, interaction timing, device support, real storage durability or deployment behavior.

## Manual browser checklist before release

Use an isolated local/preview origin and disposable saves. Never clear or manipulate real player storage.

1. Play 1/2/4 suits using tap, drag and keyboard. Move a single card, a same-suit run and a valid suffix above a face-down predecessor. Check target highlighting, reveal and undo.
2. Use hints, smart movement and auto-complete. Verify each suggested/executed move is legal and completed runs disappear exactly once.
3. Deal stock repeatedly, test gap/empty-stock rejection, undo deals and resume after reload. Confirm all cards remain accounted for and the hand/receipt identity survives.
4. Complete a K-A sequence and a final winning move; check sequence rewards, victory/suit statistics, artifacts and daily ledger. Undo/replay and reload to confirm Phase 3B still prevents duplicate payment.
5. Resume existing valid v2 saves and exercise Phase 3A recovery/import/export with disposable fixtures. Malformed visibility should remain rejected by save validation rather than being admitted for UI testing.
6. If visualizing malformed positions, use a separate developer engine fixture only. Check face-down King/middle/Ace candidates remain unchanged; never persist those synthetic positions or bypass save validation in production.
7. Repeat ordinary interactions on desktop Chrome/Edge and mobile Safari/Chrome. Separately inspect fresh versus old offline clients before a reviewed release; no deployment or cache upgrade was performed here.

Phase 3C stops after implementation and automated validation.

# P4-01 remediation - multi-tab save integrity

Implemented October 26, 2026 on `remediate/ember-save-concurrency`. Scope: the Phase 4 stale-writer loss, all authoritative replacement paths, read-only UX and dependent regression gates. No commit, push, merge, deployment or advertising activation was performed. Other Phase 4 channel decisions are not automatically reopened.

## Before-change reproduction and preserved evidence

The requested Phase 4 reports and `tests/phase4-audit.test.mjs` existed on the branch as uncommitted audit work. They were preserved, not reconstructed from previous conversation claims. The original four audit probes were executed before changing production code: four executions pass, including three deliberately proving defects. A and B loaded the same profile; A saved 100 Ember; stale B replaced primary and backup with zero and reported saved. Another case erased A's hand; a third replaced a future-schema raw value from an already-running v2 tab. The saved pre-fix log is `.phase2-backup/phase4-1/pre-remediation.log`.

Original Phase 4 browser/native/performance evidence remains under `.phase2-backup/phase4/`, with a further preserved copy at `.phase2-backup/phase4-1/baseline-phase4/`. The Phase 4 browser runner accepts `HFS_PHASE4_EVIDENCE` so remediation runs do not overwrite that historical audit. The old observed-loss test expectations were converted into preservation/refusal assertions as requested; their original outcomes remain documented in the audit and pre-fix log.

Root cause: independent tabs kept context-local profiles and `lastGoodRaw`, then synchronously replaced both backup and primary without writer coordination or checking actual stored contents. A storage notification alone could not make that read/replace sequence atomic across cooperating documents.

## Coordination and support boundary

The Store requests the exclusive Web Lock **`ember.save.v2.writer.v1`**, independent of build/release identity. It uses `ifAvailable:true`, never `steal`, and holds the callback promise for the document's editing lifetime. Only a granted writer that subsequently loads current primary/backup may replace either. Writer ownership is established asynchronously at boot; ordinary save operations remain synchronous while that authority is held. No asynchronous save result is mislabeled as a completed write.

Acquisition does not queue behind another editor. A two-second bound handles broken/hung capability implementations; late callbacks are rejected by a generation check and cannot create a hidden owner. Missing/rejected Web Locks fail closed, with readable/exportable state and a visible read-only warning. There is no localStorage timeout lease, heartbeat, silent takeover or unsafe read/then/write fallback. Browser destruction/crash releases the native lock; pagehide first attempts the protected flush, then releases. Background visibility alone retains ownership. Returning a released/BFCache document requires explicit Resume editing; it does not silently regain a writer.

BroadcastChannel was evaluated as a notification option, not an authority primitive. It was unnecessary: storage events provide best-effort conflict/status notification, while Web Locks enforce exclusion and exact raw comparisons remain mandatory. Losing/delaying a storage event does not authorize a stale write. No remote server, database, cross-device or cloud synchronization is involved.

Supported editing means a secure browser context with a working Web Locks implementation and shared origin/storage partition. Feature detection is used instead of guessing from user-agent versions. Actual execution here is Windows Chrome 155.0.8059.86, not physical Safari/Android certification. See [Web Locks guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) and [nonqueued request semantics](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request).

**Legacy limitation:** Web Locks coordinate code that honors the same lock. Already-running pre-4.1 application code, extensions or scripts directly writing localStorage cannot be remotely made cooperative by a new script. New code detects differing primary/backup values and refuses to overwrite them, but cannot veto the old code's own setItem. Before rollout, export progress and drain pre-4.1 tabs. Never roll back to an uncoordinated old Store/worker and call it safe. This implementation is not a universal lock on the browser's Storage API.

## State transitions and recovery UX

| State / transition | Behavior |
| --- | --- |
| Uninitialized -> acquiring | No save authority; immediate/debounced saves refuse. |
| Lock granted -> current data not loaded | Owns lock but cannot edit/write; tests explicitly verify this boundary. |
| Granted + current primary/backup loaded -> writer | One editor; save returns true only after synchronous primary write completes. Debounced save retains its existing queued/pending meaning. |
| Another owner -> read-only | No queue/steal, board input/clock/search work stopped, authoritative writes refused; visible recovery/export access. |
| Missing/rejected/timed-out lock -> unsupported/read-only | No persistence fallback. Original raw remains available where storage itself permits reads. |
| Stored primary OR backup differs -> conflict | Timer canceled; stale write refused before backup/primary replacement; exact stored raw and local snapshot retained in unique recovery keys where possible. |
| Writer hides | Protected synchronous flush; lock retained so another active tab cannot silently become a writer. |
| Pagehide/close/crash | Flush when callback can run; release/native context destruction ends ownership. No guarantee that a crashing process can flush pending memory. |
| Explicit Resume editing / reload latest | Confirmation advises export first; acquire if available, retain this tab's snapshot, then load latest authoritative raw. No currency/statistic merge. If preservation fails, release and refuse. |

The persistent Save Recovery warning exposes Export current progress, Export original save, **Export latest stored save**, backup and retained-copy exports, validated import and **Resume editing / reload latest**. The latter is confirmed, not an automatic overwrite of another tab's state. It returns to Home after the Store intentionally disposes the old board and sheets. If the other writer remains open, the attempt returns promptly and remains read-only. Settings previews may change memory in a spectator; they do not save or merge and are discarded on confirmed latest-data reload.

The profile's existing recovery block is separate from ownership. A granted owner still cannot autosave/reset over corrupt or unsupported data. Explicit validated import/recovery continues to require the existing confirmation and preserved originals. Conflicting raw is also retained in memory for export if quarantine fails; no quota cleanup deletes player data. Recovery keys now include a random per-copy suffix to avoid two documents selecting the same timestamp/suffix key.

## Every persistence path reviewed

| Path | Protection |
| --- | --- |
| Immediate save | Held writer + loaded snapshot + exact current primary/backup comparison + existing profile validation, then backup and primary writes. |
| Debounced autosave | Ownership checked at scheduling and again at execution; pending callback cannot commit a stale profile. |
| Visibility/pagehide | Same protected save; pagehide then releases. Spectator flush refuses without changing primary/backup or claiming Saved. |
| New/abandon hand | Store mutation requires editable ownership; new-game/tutorial entry offers recovery instead of starting an unsaveable spectator hand. |
| Moves/deal/undo/hints/auto-complete/timer | Board eligibility/action checks ownership; ownership/conflict notifications cancel current work and settle the previous clock boundary. Engine rules/timer accounting formulas unchanged. |
| Victory/currency/artifact/statistic progression | Existing Store mutation APIs require ownership; victory receipt/economy logic unchanged; no durable acknowledgement during an incomplete settlement. Final profile/receipt still commits together. |
| Import/reset | Refuse without ownership/current raw; retain existing stored and memory snapshots first; recheck after snapshot observers immediately before replacement. |
| Recovery acceptance | Same ownership/raw check and recheck after snapshot observers; original recovery protection retained. |
| Load/reload | Reads current primary/backup; no authoritative replacement. Unsupported/bad profiles remain blocked and quarantined as before. Gaining a lock alone cannot write an old loaded profile. |
| Native restore | Removed platform's direct localStorage overwrite/fallback. Only a held Store writer can inspect a complete supported candidate, compare timestamp/current raw and perform the guarded preserving import. Unsupported local/future data never loses to timestamp alone. Native mirror durability remains a separate issue. |
| Offline update approval | Existing `Store.save(true)` contract remains synchronous, now refuses read-only/pending/conflict ownership. No activation/reload on a refused save. Existing second protected save and release identities retained. |

No root schema/version/key migration or durable coordination metadata was added. Existing `ember.save.v2` profiles, hand IDs/settlement receipts, daily ledger, rewards, statistics, original artwork/fonts and all binary assets remain compatible. The engine and monetization implementations were not changed.

## Files changed

- `site/ember-solitaire/js/store.js`: lifetime lock, loaded/raw/backup guards, read-only/conflict status, unique recovery keys, explicit acquisition/resolution/release, guarded native restore and mutation gates.
- `js/app.js`: acquire before load, guarded native hydration after protected loading, protected pagehide flush/release.
- `js/platform.js`: route native restoration through Store, remove direct authoritative write/fallback.
- `js/board.js`: ownership-aware input/clock/work eligibility and invalidation.
- `js/screens.js`, `js/tutorial.js`: refuse starting spectator hands and expose recovery.
- `js/ui.js`: latest-stored export and confirmed editing-resolution controls.
- `site/ember-solitaire/sw.js`: small ordering repair for a dependent cache-retirement race, described below. No activation protocol redesign remains in the final change; `js/offline.js` is unchanged.
- `tests/helpers.mjs`, new `tests/locks-helpers.mjs`: explicit granted-lock single-context fixtures and shared-origin lock simulation; no production bypass/test mode.
- `tests/phase4-audit.test.mjs`: three loss expectations become preservation assertions; independent invariant sweep retained.
- New `tests/writer-ownership.test.mjs`, additions to `tests/offline.test.mjs`, new `tools/multitab-browser.mjs`.
- `tools/offline-browser.mjs`: explicit successor ownership after legacy editor closes; readiness probe never sends unsupported RPC to a historical controller. All identity/progression/retirement assertions remain.
- `tools/phase4-browser.mjs`: stronger backup/status preservation assertion and separate evidence output path; original audit observations remain historical.
- This report, issue register, test matrix and testing guidance. Build/generator/verifier/Vercel configuration and historical archive/inventory were not changed.

## Dependent upgrade issues found during verification

The first full offline run exposed an old worker's retirement pass deleting a newly installed candidate using stale protection metadata. The worker now snapshots candidate names before reading its keep metadata and writes pending-install protection before exposing a new cache. Two deterministic interleaving/order tests reproduce the unsafe timing against the old order and verify preservation now. Cache ownership, limits, ready markers, hash checking and unrelated-cache exclusion remain unchanged. This narrow dependency fix was needed for the required upgrade gate; it is not a general PWA rewrite.

Historical migration then stalled in the test harness. An isolated trace confirmed accepted activation/native skipWaiting while the readiness helper repeatedly sent unsupported STATUS ports to the archived controller. The production client already checks protocol support. The helper now also waits for a protocol-capable controller before its unchanged expected-ID/core-ready assertions. Experimental bridge acknowledgements/request cancellation and ownership-release changes did not fix that probe and were removed from production. Failed traces remain ignored evidence; the final complete migration passes. The historical-worker fixture uses the actual archived worker with compatible current game modules; it does not prove that an already-running uncoordinated pre-4.1 Store honors Web Locks.

## Final validation

| Command / suite | Result |
| --- | --- |
| `node build.mjs` | PASS, fresh staged output with previous dist backup retained |
| `node tools/verify-source.mjs` | PASS, 277 generated / 144 source files; 44 syntax, 5 JSON, 500 references, 74 core entries, 9 routes, zero errors |
| `node --test` | **304 pass, zero failures/TODOs/skips/cancellations**; all prior regressions retained, requested observed-loss cases repaired |
| `node tools/mobile-browser.mjs after` | **13 checks pass**, seven viewports and actual Chrome touch/focus/ceremony/recovery flows |
| `node tools/offline-browser.mjs` | **42 checks pass**, includes all prior 41 plus explicit successor ownership in legacy migration |
| `node tools/phase4-browser.mjs` | **19 PASS / 3 known FAIL observations**; stale-tab case is now PASS. Remaining FAILs are P4-03 offline readiness, P4-04 dynamic motion and P4-05 Later focus, intentionally outside this remediation. Runner completed successfully. |
| `node tools/multitab-browser.mjs` | **19 checks pass**, actual Web Locks and two/three real tabs with synthetic saves |
| `git diff --check`, `git status --short` | PASS whitespace review; reviewed uncommitted audit/remediation changes only |

Final generated release: `6d3225e148556d280535ca5261d94e73d548925eb2d2247fa6848973f84be64d`. Core: **74 files / 2,632,958 bytes**. Source count and all original binary assets remain unchanged. Archive SHA-256 remains `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`; baseline inventory was not regenerated.

New deterministic coverage includes concurrent requests, stale primary/backup/hand/future raw, acquisition before load, close/reload succession model, absent/rejected/hung locks, delayed callbacks, pending debounce, storage reads/writes/quarantine failures, import/reset/recovery, reentrant snapshot observers, native candidate boundaries and read-only update approval. Existing victory tests run under a granted lock. The real browser gate additionally verifies visible read-only warnings, recovery controls, exact primary/backup values, future/local recovery copies, actual confirmed UI handoff, reload, real renderer crash releasing the browser lock, unsupported capability and one victory payout across undo/replay.

Evidence: `.phase2-backup/phase4-1/` contains build/verifier/full Node logs, pre-fix audit log, `multitab/summary.json` and screenshots (`readonly-recovery.png`, `future-conflict.png`, `unsupported.png`), final mobile/offline/independent outputs, and retained failed diagnostic experiments. `evidence-index.json` indexes the local outputs. Profiles are temporary isolated Chrome profiles; no real player data or publisher credentials were used. A final test gate pass is not a claim that no development attempt ever failed.

## Recovery, rollout and remaining blockers

1. Review the complete source/test diff and all green required gates. Assign release and persistence reviewers. No deployment is authorized by this report.
2. Before rollout, export important progress and close/drain uncoordinated pre-4.1 tabs. Keep the compatible lock name across future releases. Independent old code that ignores it remains outside enforceable coordination.
3. If read-only, leave the current writer open to finish/save, then close it. In the desired tab open Save Recovery, export anything needed, choose Resume editing / reload latest and confirm. This loads latest progress, never merges currency. If a conflict/future schema is shown, export current/original/latest stored copies and use supported validated recovery; never clear site data.
4. For rollback, retain a coordinated 4.1-or-later Store with matching application/build/worker tooling and supported v2 receipts. Do not deploy the archived/pre-3F worker or uncoordinated pre-4.1 persistence as a rollback. Local dist backups are preserved but require compatibility review, not blind promotion. Never restore a save backup merely to roll back application files.
5. A pending debounced update can still be lost if a process crashes before any successful flush; native Preferences writes remain asynchronous/unacknowledged and physical storage eviction is not made durable by Web Locks. Different supported native v2 candidates still follow the legacy savedAt preference, now through validated preserving import; ambiguous native replica ordering is not solved and remains an Android gate. Recovery/quarantine may be quota-blocked; primary/backup are then left intact and exports remain the advised route. There is no cross-device synchronization.

**Conclusion:** P4-01 is repaired for supported cooperating tabs, with deterministic preservation tests and a passing real multi-tab Chrome gate. Native restoration now uses the same guarded replacement boundary, without certifying a native package. The broader launch remains **NO-GO** pending remaining Phase 4 defects, actual deployment/physical-device/assistive-technology evidence and an explicit legacy-tab rollout plan. No production readiness, legal compliance or universal browser/OS durability is inferred from this focused repair.

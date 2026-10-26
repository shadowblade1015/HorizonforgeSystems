# Phase 4.3 — endgame solver performance remediation

October 26, 2026. Implemented on `fix/ember-p4-03-solver`, created from updated release candidate `977e5d3`. `origin` was fetched and `release/ember-v2-launch` fast-forwarded as requested. Both `ce379d7` (Phase 4.1) and `41b693f` (Phase 4.2) are ancestors; the integrated candidate's source matched Phase 4.2. The worktree was clean before implementation. Production `main` remains `65d902e5d542de38f7fedc4a51b3c1314201a23c`. No commit, push, merge, deployment or advertising activation was performed.

## Baseline and evidence preservation

The preserved pre-change baseline is `.phase2-backup/phase4-3/baseline/`: build/verifier, **329 passing Node tests**, and independent browser **32 PASS / 0 FAIL**. It was collected from Phase 4.2 before integration; the integrated release had identical source bytes. Its scheduled seed-42 Board planner took **286.9 ms normally / 2,316.6 ms at 4× CPU throttling**, with maximum RAF gaps **283.2 / 2,499.8 ms**. These are the requested rounded 287 / 2,317 ms baseline, not inferred from a solver-only microbenchmark. Historical Phase 4–4.2 evidence and this baseline were not overwritten during Phase 4.3.

The stress hand deals all stock from a four-suit seed-42 game, turns remaining cards face up and clears history; Store validates it. It is constructed and schema-valid, **not a recorded naturally reached hand**. Additional fixtures are a canonical two-move terminal position and a two-suit seed-42 hand advanced through 40 actual legal engine actions. The latter retains the normal hidden-card boundary and exercises stuck checking rather than pretending every hand qualifies for auto-completion.

## Root cause and changes

`board.js` previously ran `Engine.solveEndgame(g, 20000)` inside its scheduled main-thread callback. Worker failure in stuck checking also invoked `Engine.isStuck` on the main thread. A node-count limit did not bound frame blocking.

- **`site/ember-solitaire/js/board.js`:** both optional searches use the existing dedicated worker. One pending request and one worker are allowed at a time. Requests carry monotonically increasing request ID, game session, position revision and work epoch. The owner token also retains the exact game object. Replies must match every identity field, current Store game, editing authority and Board eligibility. Repeated checks reuse a current plan or pending request rather than queue duplicate searches.
- All existing invalidation paths terminate the worker and clear pending requests/deadlines: effective move/deal/undo, replacement/new game, abandonment, navigation, pause, holds, visibility/app/page lifecycle and loss of writer ownership. An invalid no-stock deal changes no position and therefore does not discard a still-current request. Returning to eligibility can request fresh work; old IDs/epochs cannot authorize it.
- Endgame planning uses the existing **20,000-node budget**. Every Board worker request also has a **4,000 ms deadline**, including startup. Expiry terminates the worker and drops the request. A null result is described as **no plan found within budget**, never proof of impossibility. Stuck checking retains its existing conservative heuristic/node budget.
- Missing Worker support, initialization/posting failure, crash, message decoding error, unknown result or timeout produces no solution and no stuck declaration. There is **no synchronous expensive fallback**. A shared nonblocking toast and the existing live region explain that manual play remains available. Failed same-position searches are not repeatedly restarted by renders; a real lifecycle/position change permits another attempt.
- A current solved reply only exposes Finish. It does not execute moves, save progress or award rewards. Plan shape and the first legal move are checked before offering it; existing `runAutoComplete` validates ownership/revision and `Engine.canMove` before **every** executed step. Invalid suggestions are refused. Victory settlement continues through the unchanged receipt/reward path only after explicit execution.
- **`js/stuck-worker.js`:** adds typed `endgame` and `stuck` messages using the same `importScripts('engine.js')`. It returns identity, bounded outcome and elapsed search time, and catches search errors conservatively. The original stuck-only message shape remains compatible. No second worker entry point or runtime dependency was introduced.
- **`js/engine.js`:** moving the original recursive DFS exposed a reproducible worker `RangeError: Maximum call stack size exceeded` on the hard fixture. Its traversal now uses explicit DFS frames and one current path. Move ordering/ties, visited states, node counting, move application and returned plan order remain the same. Nineteen original recursive outputs were captured **before** this change, including small budget boundaries and seeds 1/42/100; all match exactly. No card-rule or F15 heuristic change was made.

The four-second deadline is serviced by the browser event loop, not a real-time guarantee during OS suspension or unrelated main-thread blocking. Cancellation uses worker termination rather than a cancellation message queued behind a synchronous worker search.

## Files and regression coverage

- Production: `js/board.js`, `js/stuck-worker.js`, `js/engine.js` only.
- `tests/lifecycle-helpers.mjs`: fake asynchronous transport runs the actual worker module against the actual engine for existing auto-complete lifecycle fixtures; explicit manual transport is available for late/failure cases. No production test bypass.
- `tests/lifecycle.test.mjs`: typed replies retain the old assertions; the old required synchronous-fallback outcome now asserts conservative refusal and zero synchronous search, as this phase requires.
- New `tests/solver-worker.test.mjs` and `tests/fixtures/endgame-plans.json`: valid plan/replay, original-plan compatibility, null/budget outcome, input immutability, all identity fields, constructor/unavailable/posting/crash/message errors, timeout, no duplicate requests, stale replies after moves/undo alternate/restart/navigation/pause/abandonment/ownership loss, malformed suggestions and per-step legality. Existing payout/lifecycle assertions remain.
- New `tools/solver-browser.mjs`: actual generated Board/worker execution at 1×/4× main-target CPU settings; stress, near-win and legally advanced positions; native worker startup/crash/hang faults; deadline, current-plan execution, same-move-count undo/alternate revision collision, queued old callback probes, repeated checks and actual read-only secondary tab. Faults are isolated test-driver injections, not application flags.
- `tools/phase4-browser.mjs`: retains all prior behavior gates, benchmarks searches in real workers, and records actual Board worker identity/duration plus main-thread call counts. Two additional immutable-worker assertions supplement the previous 32 checks.
- `tools/offline-browser.mjs`: retains every previous check and adds endgame replies from matching A/B immutable engines, including offline-capable imports; four additional observations.
- Documentation: this report, ISSUE_REGISTER, TEST_MATRIX, PERFORMANCE_REPORT, GO_NO_GO and TESTING.

Store/save schema, Web Lock name/protocol, saved-game format, settlement/economy, advertising, accessibility implementation, service-worker protocol, artwork/fonts, build/release generator, verifier and Vercel configuration are unchanged. Original archive and baseline inventory are unchanged.

## Measured responsiveness

Final independent generated-bundle runner; Windows Chrome 155.0.8059.86. Its existing scheduled Board path remains the comparison point. CPU emulation applies to the page target; worker elapsed time is reported separately and must not be represented as uniform throttling of every browser thread or physical mobile performance.

| Measurement | Normal baseline | Normal after | 4× baseline | 4× after |
| --- | --- | --- | --- | --- |
| Main-thread endgame search | 286.9 ms | **0 calls** | 2,316.6 ms | **0 calls** |
| Largest RAF gap in scheduled-search sample | 283.2 ms | **33.4 ms** | 2,499.8 ms | **50.0 ms** |
| RAF p95 after | — | 16.8 ms | — | 16.8 ms |
| Worker endgame compute time | — | 265.3 ms | — | 279.9 ms |
| Worker request-to-reply time | — | 280.7 ms | — | 3,066.2 ms |

No main-thread long task was recorded between worker request and reply in either independent sample. The 4× sample still had a **187 ms pre-request render/setup long task**. Startup, import, scheduling and message delivery contribute to request-to-reply latency; compute duration is not time-to-Finish or input latency. No field INP or Core Web Vitals certification is claimed.

The separate dedicated browser suite warms the same position's assets before measuring. Normal/4× near-win worker planning took **1.0 / 1.0 ms**, and reachable-hand stuck checks **1.2 / 1.3 ms**; RAF maxima for these were **17.0 / 16.8 ms** and **16.8 / 16.9 ms**. Hard-worker compute took **274.6 / 292.7 ms**, returning no plan within budget. Its normal stress RAF sample nevertheless included a **499.9 ms gap with no corresponding JavaScript long task**; its 4× sample had a 16.9 ms maximum gap and a separate 163 ms setup/render task. This discrepancy remains recorded, not filtered or attributed to a proven cause. It prevents a universal smoothness claim and warrants physical-device/rendering follow-up. Earlier cold/concurrent diagnostic samples also remain in evidence; they are not silently substituted for the final measurements.

## Final validation

| Command / gate | Result |
| --- | --- |
| `node build.mjs` | PASS, fresh staging validated, prior dist retained |
| `node tools/verify-source.mjs` | PASS: 144 source / 277 generated, 44 syntax, 5 JSON, 500 references, 74 core, 9 routes, zero errors |
| `node --test` | **352 PASS**, zero failure/TODO/skip/cancellation; previous 329 passing cases retained |
| `node tools/solver-browser.mjs` | **24/24 PASS** |
| `node tools/mobile-browser.mjs after` | **13/13 PASS** |
| `node tools/offline-browser.mjs` | **46/46 PASS**, including all previous 42 |
| `node tools/multitab-browser.mjs` | **19/19 PASS** |
| `node tools/phase4-browser.mjs` | **34 PASS / 0 FAIL**; every finding inspected, no unexpected runtime or missing-asset entries |
| `git diff --check`, status and main reference | PASS; changes uncommitted on requested fix branch, main unchanged |

Final release: `e759216677bd42a3d9659c143c0a5b8be0e583844c3650fdb7970f40d8e59809`; **74 core entries / 2,638,682 bytes**. Archive SHA-256 remains `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`.

Final evidence is ignored under `.phase2-backup/phase4-3/validated/`: build/verifier/Node logs, `solver/summary.json`, `independent/summary.json`, mobile/offline/multi-tab summaries and screenshots. The parent directory retains baseline and failed development probes, including the worker stack-overflow diagnostic. The initial full test attempt correctly failed because dist had not yet been rebuilt; two new live-region assertions initially checked before the existing 30 ms announcement delay. These were resolved by building first and honoring that delay, not weakening production checks. A browser stale-reply probe initially compared two exports that also settle the clock; it now checks actual position/reward identity and exact stored primary/backup bytes.

## Remaining risks and integration

- Worker CPU/memory consumption remains finite search work, not free work. The node/deadline bounds may omit a real solution beyond the budget; manual play continues. The unchanged F15 heuristic is not a global solvability proof. No impossible-hand or optimal-plan claim is added.
- Main-thread rendering, initial artwork decode/layout, the recorded RAF discrepancy, low-memory behavior and long-session/thermal/battery costs remain performance risks. Real Safari/Android/PWA, physical reduced-motion changes and human assistive-technology checks remain uncollected. Existing emulated mobile/motion/focus protections pass.
- Phase 4.1 still coordinates only cooperating same-origin tabs. Drain/export pre-4.1 tabs before rollout. This change does not solve cross-device/native mirror durability or make old code obey Web Locks.
- Actual Vercel deployment identity/CDN/headers, physical-device/AT and privacy sign-offs remain release gates. Advertising consent/publisher integration and native Android packaging/consent/durability remain separate channel blockers. No deployment was attempted here.
- Review this branch and its engine compatibility fixture, then integrate through the release-candidate PR process. Re-run build, strict verifier and all browser gates on the integrated candidate before release. Retain a matching generated release/worker/engine set for rollback; never roll back to an uncoordinated Store or incompatible historical worker. Do not change stored player profiles to roll back application code.

**P4-02/F13 is repaired for the tested candidate:** expensive searches no longer execute on the main thread, bounded worker failure is conservative, and stale results do not authorize execution. Overall launch remains **NO-GO** pending the separate deployment/device/accessibility/privacy and channel-specific gates; these local results do not authorize promotion.

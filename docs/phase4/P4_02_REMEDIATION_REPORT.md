# Phase 4.2 remediation — offline capability, motion and focus

Implemented October 26, 2026 on `fix/ember-p4-02-offline-a11y`, starting from Phase 4.1 commit `ce379d7` and generated release `6d3225e148556d280535ca5261d94e73d548925eb2d2247fa6848973f84be64d`. The filename follows the requested report name; this repairs **P4-03, P4-04 and P4-05**, not the P4-02 solver issue. No commit, push, merge, deployment or promotion was performed.

## Reproduced baseline

Before production edits, independently executed build, verifier, all Node suites and all four browser runners. Results: **304 Node, 13 mobile, 42 offline and 19 multi-tab checks pass; independent runner 19 PASS / 3 FAIL**. Separate baseline evidence is under ignored `.phase2-backup/phase4-2/baseline/`.

The independent baseline summary records:

- **P4-03:** after deleting cached `js/engine.js`, STATUS was false both before and after successful optional download. The notice nevertheless said all suit modes, backs and tables were available offline. Optional assets did not restore the required core entry.
- **P4-04:** changing OS motion preference without navigation made `FX.motion()` false while canvas draws increased from **8,308 to 8,478** over the observation window.
- **P4-05:** activating Later hid the notice while the active element remained a button inside hidden content.

**Evidence-handling deviation:** the initial baseline invocation of the pre-existing multi-tab runner used its hard-coded Phase 4.1 output path. It replaced `phase4-1/multitab/summary.json` and the three screenshots `future-conflict.png`, `readonly-recovery.png`, and `unsupported.png`. Their original bytes cannot be recovered from the available local files; the old evidence index retains their original hashes. The replacement baseline artifacts are additionally retained in `phase4-2/baseline/multitab/`. All original Phase 4 indexed evidence and all other Phase 4.1 indexed files still match their historical hashes. This does not satisfy the requested preservation of those four historical artifacts. Output-path overrides were added to prevent repetition; the historical index was not rewritten to disguise the difference.

## Root causes and exact repairs

### P4-03: artwork completion was mistaken for complete offline capability

`offline.js` previously checked only release identity before DOWNLOAD and reported complete offline availability from its optional-only result. STATUS checked core entries but did not distinguish artwork readiness.

- `site/ember-solitaire/sw.js`: STATUS now reports independent `ok` (core) and `artworkOk` booleans from the current immutable release's cached entries. It retains the existing ready/catalog checks and release identity. Existing installation, hashing, activation, pinning, retirement and repair commands are unchanged; no new protocol command or cache deletion was introduced.
- `js/offline.js`: download checks the page's exact release before starting and rechecks STATUS afterward. A successful artwork download with incomplete core explicitly says artwork downloaded and **Repair offline files** is needed before reliable offline play. Core-only readiness promises only the existing one-suit/default-art capability. Complete modes/artwork wording requires confirmed core and artwork readiness. Missing/timed-out/wrong-release status makes no complete-play claim. Repair also requires a fresh same-release status after its acknowledgement.

The operation never clears saves, recovery keys or valid cached assets and never downloads through another release's worker. Older compatible workers without the additive artwork status field receive conservative wording.

### P4-04: the live RAF loop never reacted to changed preferences

`js/fx.js` now registers one MediaQueryList change listener, with `addListener` fallback. A shared stop routine cancels the outstanding RAF, increments a generation, clears/hides the canvas and resets parallax variables. Every queued callback checks that generation and current motion/visibility/lifecycle eligibility before drawing or rescheduling. OS changes, existing in-game settings application, visibility and pagehide/pageshow use the current field owner; `none` cannot resurrect an old screen's field. Returning to permitted motion restarts one eligible loop. Parallax initialization is idempotent. Card rules and nonanimated selection/focus feedback are unchanged.

### P4-05: hiding the notice did not transfer focus

`js/ui.js` extends the existing shared modal/router kernel with capture/restore helpers for nonmodal notices. `js/offline.js` remembers the invoking focus owner on reopening. Later hides the notice, then restores focus only if the notice owned it. A still-valid visible Settings invoker is preferred; otherwise a visible enabled control on the current screen is selected. Disconnected, disabled, hidden and inert elements are excluded. Navigation ownership rejects stale invokers; an active dialog keeps focus under the existing modal stack. Restoration is synchronous and creates no delayed focus callback. Deferral and protected approval/save-before-reload behavior are unchanged. The existing `role=status` announcement region remains; human screen-reader speech was not certified.

## Tests and tooling

- `tests/offline.test.mjs`: additional worker/client tests cover independent readiness, successful/failed optional downloads with ready/missing core, repair success/failure and false-positive acknowledgements, wrong-release and timed-out status, post-download verification failure, and actual Later/shared-focus integration with status semantics. Existing unsafe-save approval assertions remain.
- New `tests/phase4-2.test.mjs`: controllable modern/legacy MediaQueryList, actual canvas draw counts, cancellation/stale callbacks, normal/reduced transitions, authoritative in-game setting, repeated toggles, single listener/RAF, hidden/page lifecycle and inactive-field behavior; focus validity, automatic notice fallback, navigation and modal isolation.
- `tools/phase4-browser.mjs`: retains previous functional assertions and strengthens the three target probes; adds return-to-motion/in-game preference, native keyboard Tab/Enter, Settings and automatic focus, navigation/modal isolation, actual unavailable offline core response followed by repair, and read-only spectator updates/recovery checks. Media interaction runs in a separate fresh Chrome process from heap profiling. A requested RAF barrier flushes CDP media emulation through the rendering cycle; it does not call production refresh methods or fake draw counts. The driver uses Enter's text payload and server-side network disconnection because tab-only network emulation did not disconnect the worker's own fetches.
- `tools/offline-browser.mjs`: successful artwork recovery now requires the verified-capability wording rather than the old misleading string. All other upgrade/retention/save assertions remain.
- Mobile/offline/multi-tab browser runners accept evidence output overrides; this report's final outputs use only Phase 4.2 destinations.
- Documentation: this report, ISSUE_REGISTER, TEST_MATRIX, GO_NO_GO and `docs/TESTING.md`.

Store, board, engine, save schema/key/lock protocol, rewards/progression, artwork/fonts, advertising, build/generator/verifier and Vercel configuration were not changed. The historical archive and baseline inventory were not modified.

## Final validation

| Gate | Executed result |
| --- | --- |
| `node build.mjs` | PASS, staged output validated and previous output retained |
| `node tools/verify-source.mjs` | PASS: 144 source / 277 generated files, 44 syntax, 5 JSON, 500 references, 74 core, 9 routes, zero errors |
| `node --test` | **329 PASS**, zero failure, cancellation, skip or TODO; all previous 304 retained |
| `node tools/mobile-browser.mjs after` | **13/13 PASS** |
| `node tools/offline-browser.mjs` | **42/42 PASS** |
| `node tools/multitab-browser.mjs` | **19/19 PASS** |
| `node tools/phase4-browser.mjs` | **32 PASS / 0 FAIL**; every finding and runtime/missing-asset arrays inspected, not inferred from exit code |
| `git diff --check` / status | PASS whitespace review; changes intentionally uncommitted |

Generated release: `b0e1ef591e81e46a90ab7e6f92e8d9831abe1fb3d0ecc4f4d6510c304497df7d`; core **2,635,227 bytes**. Archive SHA-256 remains `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`. Source evolution is verified against the deterministic generator, not by falsely requiring current game code to equal the old archive.

Final local evidence: `node-final.log`, `verify.json`, `mobile/after/flows.json`, `offline-recheck/summary.json`, `multitab/summary.json`, and **`independent-validated/summary.json`**, under `.phase2-backup/phase4-2/`. Earlier `independent*` attempts and `offline/` retain failed probe development and the obsolete wording assertion; they are not final passing evidence. The final independent partial-eviction test records actual HTTP **503** while disconnected, then confirms same-release core/artwork readiness after repair. No real player data was used.

## Integration and remaining launch blockers

1. Review this candidate against Phase 4.1, including the evidence-preservation deviation. Integrate the source/tests/tooling together after review; do not cherry-pick generated dist or replace the coordinated Store with main's older implementation. Rerun the documented gates on the integrated release candidate. No source-control or deployment approval is implied here.
2. Preserve compatible Phase 4.1-or-later lock ownership and the v2 save/settlement contract. Export important progress and drain uncoordinated pre-4.1 tabs before rollout. Spectator updates, recovery and save-before-reload still pass; legacy scripts that ignore Web Locks remain outside enforceable coordination.
3. **P4-02/F13 synchronous solver remains open for Phase 4.3.** No solver optimization or performance waiver was implemented. Existing heuristic limitations and separate security/header findings retain their previous dispositions.
4. The supplied Vercel preview was previously protected and the user allowed skipping it; actual deployment SHA/release/CDN/headers remain NOT TESTED. No new deployment access or promotion was attempted here.
5. Physical Safari/Android install/resume/eviction, OS setting changes, real keyboard/AT speech/forced colors and native persistence still need assigned QA/accessibility owners. Windows headless Chrome and deterministic models are the evidence boundary.
6. Live advertising/CMP/publisher/privacy approval, native Firebase consent ordering, acknowledged native persistence and an Android package/signing/distribution pipeline remain separate uncompleted gates. This work does not authorize advertising or native distribution.

P4-03/P4-04/P4-05 are repaired with independent Chrome and deterministic regression evidence. The broader release remains **NO-GO** until the remaining channel-specific gates are satisfied or explicitly dispositioned by their owners.

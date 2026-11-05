# Phase 4 test matrix

## October 26 Phase 4.3 revalidation

| Current gate | Result |
| --- | --- |
| Integrated starting branch | Fetched/fast-forwarded release candidate `977e5d3`, verified Phases 4.1/4.2, new `fix/ember-p4-03-solver`; production main unchanged |
| Preserved pre-change baseline | 329 Node / 32 independent browser PASS; actual Board search 286.9 ms / 2,316.6 ms, normal / 4× |
| Build / strict source verification | PASS: 144 source / 277 generated, 74 core; zero errors; archive and baseline inventory unchanged |
| All Node suites | **352 PASS**, zero failure/TODO/skip/cancellation; 19 captured recursive planner outcomes match |
| New actual solver browser suite | **24/24 PASS**: real worker results, hard bounded no-plan, startup/crash/deadline, cancellation/queued old callbacks, alternate revision, spectator and exactly-once victory |
| Prior mobile / offline / multi-tab | **13 / 46 / 19 PASS**; offline includes all prior 42 plus four endgame immutable-engine checks |
| Independent generated-bundle browser suite | **34 PASS / 0 FAIL**, previous 32 plus two immutable Board-worker/main-thread assertions |
| Scheduled Board-path responsiveness | Zero synchronous search calls; maximum RAF gap **33.4 ms normal / 50.0 ms at 4×**, versus 283.2 / 2,499.8 baseline |
| Render/device limits | Separate dedicated normal stress sample has 499.9 ms RAF gap without JS long task; rendering/setup long tasks and physical-device follow-up remain open |
| Deployment / human AT / native-commercial gates | No new certification, deployment or waiver; previous uncollected gates remain |

Final evidence: `.phase2-backup/phase4-3/validated/`. The original baseline and failed development attempts are separately retained. [P4_03_REMEDIATION_REPORT.md](P4_03_REMEDIATION_REPORT.md) distinguishes worker compute, message latency and main-thread responsiveness; no field INP claim. Earlier tables below remain historical.

## October 26 Phase 4.2 revalidation

| Current gate | Result |
| --- | --- |
| Before-edit reproduction | 304 Node / 13 mobile / 42 offline / 19 multi-tab pass; independent 19 PASS / original 3 FAIL |
| Build / strict verification | PASS: 144 source / 277 generated, zero errors, unchanged historical archive/inventory |
| All Node suites | **329 PASS**, zero failure/TODO/skip/cancellation |
| Mobile / offline / multi-tab browser suites | **13 / 42 / 19 PASS**, all prior checks retained |
| Independent generated-bundle browser assessment | **32 PASS / 0 FAIL**; all findings inspected; runtime errors and unexpected missing assets empty |
| P4-03 partial eviction | PASS: core false + artwork true gives repair wording; disconnected engine fetch 503; explicit repair confirms both capabilities |
| P4-04 dynamic motion | PASS actual draw counts stop/resume; in-game preference remains authoritative; deterministic stale RAF, toggles, visibility and lifecycle coverage |
| P4-05 notice focus | PASS automatic/Settings, native keyboard Tab/Enter, navigation and modal isolation; polite status semantics retained |
| Read-only updates / recovery | PASS actual spectator panel/artwork and export access; existing protected approval and persistence suites retained |
| Deployment / physical devices / human AT / commercial-native gates | NOT TESTED or unresolved as previously recorded; no automatic GO |

Evidence: `.phase2-backup/phase4-2/`, final independent summary `independent-validated/summary.json`. [P4_02_REMEDIATION_REPORT.md](P4_02_REMEDIATION_REPORT.md) identifies final versus development runs and the four accidentally replaced Phase 4.1 multi-tab artifacts. Original Phase 4 indexed evidence and remaining Phase 4.1 indexed files are unchanged. Historical tables below retain the audit's original outcomes.

## October 26 P4-01 revalidation

The tables below preserve the original certification audit. The current focused follow-up is [P4_01_REMEDIATION_REPORT.md](P4_01_REMEDIATION_REPORT.md), with evidence under `.phase2-backup/phase4-1/` and a preserved original evidence copy at `baseline-phase4/`.

| Current gate | Result |
| --- | --- |
| Build and strict verification | PASS: 277 generated / 144 source, zero errors; v2 schema and archive/inventory unchanged |
| All Node suites | **304 PASS**, zero failures/TODO/skips; the three stale-loss probes now assert intended protection |
| `node tools/multitab-browser.mjs` | **19/19 PASS**: actual lock exclusion, stale hand/primary/backup/future protection, visible warnings, recovery UI handoff, writer reload/crash succession, unsupported API and victory replay |
| Existing mobile browser gate | **13/13 PASS** |
| Existing offline browser gate | **42/42 PASS**, all previous assertions plus explicit successor ownership; readiness RPC waits for protocol-capable control |
| Phase 4 independent browser audit | **19 PASS / 3 known FAIL observations**; P4-01 now PASS, P4-03/P4-04/P4-05 remain outside scope |
| Whitespace/status review | PASS; changes remain uncommitted |
| Actual deployment, physical devices, human AT, native package | NOT TESTED by this focused remediation; previous gates remain open |

Use `$env:HFS_PHASE4_EVIDENCE='.phase2-backup/phase4-1/independent'` before rerunning `node tools/phase4-browser.mjs` to retain the old Phase 4 evidence. The added lock adapter grants ownership explicitly for isolated Node fixtures, shares one manager for same-origin tests, and exercises unsupported/pending/rejected states separately; production has no test bypass. Existing import/victory/lifecycle assertions were retained. Final real tabs use the browser's Web Locks API, not that adapter. Legacy application versions that ignore locks require a drained rollout; the archived-worker migration test is not proof that old Store code became cooperative.

Target commit `65d902e5d542de38f7fedc4a51b3c1314201a23c`, Node v24.22.0, Windows headless Chrome 155.0.8059.86. PASS means the specified test ran successfully, not universal certification. NOT TESTED means evidence is missing. FAIL findings remain unresolved. No test was silently reclassified as a physical-device test.

## Reproduced command baseline

| Command | Result | Retained evidence under `.phase2-backup/phase4/` |
| --- | --- | --- |
| `node build.mjs` | PASS | `build.log`; fresh validated output with previous dist retained |
| `node tools/verify-source.mjs` | PASS | `verify.json`: 277 generated / 144 source, 44 syntax, 5 JSON, 500 references, 74 core, 9 routes, zero errors |
| `node --test` before added audit probes | PASS | `node-baseline.log`: 277 pass, zero failures/TODO/skips |
| `node --test` including audit probes | PASS execution, not safety approval | `node-final.log`: 281 tests, including 3 explicitly named observed-defect cases and 1 invariant sweep |
| `node tools/mobile-browser.mjs after` | PASS | `mobile.log`, `mobile/flows.json` 13 checks, seven viewport measurements/screenshots |
| `node tools/offline-browser.mjs` | PASS | `offline.log`, `offline/summary.json` 41 checks, browser identity and screenshots |
| `node tools/phase4-browser.mjs` | Audit observations, includes FAIL findings | `independent.log`, `independent/summary.json` and screenshots; exits nonzero on runner error, records known audit FAIL observations without treating them as fixes |
| `git diff --check` | PASS | Final status/check logs; production source unchanged |
| Lighthouse | NOT TESTED | CLI/module absent (`ERR_MODULE_NOT_FOUND`); no installation, score or report fabricated |

Build identity: `61d8345f99c93b5a67f55238de98c1438bd00a64a4986d495b1cc8b0205262ec`. The historical archive/inventory remain unchanged. Verification compares every generated path/byte with the approved generator, rather than assuming dist directly equals site or retaining the old 143-file count.

## Engineering and browser coverage

| Area | Result and exact scope | Limits / evidence |
| --- | --- | --- |
| Fresh first entry | PASS | Actual splash/intro/artifact choice/tutorial in generated bundle, desktop and throttled phone lab; programmatic clicks, not timed human comprehension |
| New/resumed 1/2/4 suits | PASS sampled | Node seeded invariants, browser legal move/deal/undo per mode; offline suite resumes an unfinished hand across B upgrade |
| Legal/illegal moves, card accounting | PASS sampled | Existing original rules regressions plus independent 12 seed-mode sweep through up to 60 actions each; no exhaustive solvability proof |
| Hints/undo/deal/search | PASS correctness samples; FAIL performance | Existing Node plan/invalid-state tests, actual browser actions and actual worker identity; main-thread hard solver blocks (P4-02) |
| Auto-complete cancellation/ownership | PASS deterministic coverage | Existing lifecycle suite; hard solver timed in real scheduled Board path; not a human-completed production endgame campaign |
| Victory, settlement, replay/undo | PASS samples | Original payout assertions, actual canonical final-set ceremony; sampled terminal fixture is not an entire naturally played victory |
| Daily | PASS local fixture behavior | Browser starts actual two-suit daily; ledger/idempotence in Node. Timezone/client-clock behavior is local, not an authoritative competitive date |
| Artifact selection/forge/profile/settings | PASS samples | Independent onboarding selects shield; mobile suite strike ceremony/focus, collection/profile/settings traversal; complete legendary campaign not human-tested |
| Long columns/touch/keyboard | PASS Chrome emulation | 25/45-card Node fixtures, actual CDP touch scrolling/drag, keyboard column ten, Tab/Escape/nested restoration; physical OS gestures/AT speech NOT TESTED |
| Corrupt/future save protection on load | PASS | Actual browser raw remains protected; original validation suites; already-running stale writer is a separate FAIL P4-01 |
| Export/import/recovery | PASS samples | Actual Chrome download completion, synthetic file input and confirmation, malformed/future protection; invalid imports/failed/quarantine storage in Node |
| Two tabs saving | FAIL | Actual Chrome 100 -> 0 primary+backup, status saved; three deterministic observed-loss probes including active hand/future schema |
| Offline core/routes | PASS | Core ready/install, root/index, privacy own document, unknown route 404; 74 core files/2,624,670 bytes |
| A-to-B and historical worker | PASS | Actual same-origin switching, fetched script/CSS hashes, dedicated-worker import identity, old A remains A under B, archived worker migration |
| Network/storage failures | PASS tested handling | HTTP404/500, bad hash/opaque in Node; real quota override, injected worker writes, controlled eviction and interrupted installs in Chrome; not OS-level disk fault certification |
| Retention/cleanup | PASS samples | Old client pins, last A closes/retire, unrelated cache retained; four-release cap/unknown clients in Node |
| Offline optional readiness | FAIL | Delete one core entry, complete optional download, STATUS still false, visible all-modes-ready promise (P4-03) |
| Dynamic reduced motion | FAIL | OS media change without navigation leaves canvas drawing (P4-04); initial reduced setting and CSS paths remain separately tested |
| Later focus | FAIL P3 | Focus remains in hidden panel after activation (P4-05); no permanent trap claimed |
| Native save/consent | FAIL adapter reproductions | Actual platform/analytics modules with VM plugin adapters; Android device behavior NOT TESTED |
| Real Vercel app | NOT TESTED | Supplied preview protected; exact SHA/release/headers/redirects/CDN/application screenshots unavailable |

## Accessibility target and devices

[WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) is a review target, not a certified result. Semantic buttons, accessible column/run alternatives, named dialogs, isolation, focus restoration and live regions were source-reviewed and exercised by existing deterministic/browser suites. These do not establish speech output, all contrast combinations or every input method.

| Check | Status |
| --- | --- |
| Viewports 320x568, 360x640, 390x844, 430x932, 768x1024, 1440x900, 667x375 | PASS measured Chrome geometry; tablet/desktop/short landscape represented |
| Native CDP touch drag and scroll, keyboard focus traversal, modal restoration | PASS within the recorded suite |
| 200% CSS zoom / large-card settings | PASS sampled geometry and screenshots; browser toolbar zoom/OS font scaling NOT TESTED |
| OS reduced motion changed while open | FAIL P4-04; source setting at navigation is not equivalent |
| High-contrast theme/forced colors / composited text and image contrast | NOT TESTED independently to WCAG AA; source settings/earlier calculations are insufficient |
| NVDA, VoiceOver, TalkBack, switch access | NOT TESTED by a human with assistive technology |
| Physical Safari/Chrome/PWA standalone, virtual keyboard/toolbars/OS suspend | NOT TESTED |

Screenshots visually sampled in this audit include `mobile/390x844.png`, `mobile/recovery-320.png`, and independent generated-bundle board/recovery/victory/offline-status captures. A screenshot cannot prove keyboard or speech behavior. Use [GO_NO_GO.md](GO_NO_GO.md) for gates, not a green test count alone.

The native standalone probe is retained as `native-boundary-probe.mjs/json`; it asserts the observed failures, not acceptable behavior. The independent runner initially treated void Board undo/deal returns as booleans and encountered random openings with no immediate hint; it was corrected to assert state transitions and use fixed seeds. No production rule/assertion was changed to make the baseline green. Initial missing LCP samples prompted waiting for a painted frame; raw local LCP candidates still are not production field data.

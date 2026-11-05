# Phase 4 independent production launch assessment

**Decision: NO-GO for public web, installable PWA, live-ad web and Android distribution.** The ad-free web game has substantial regression and upgrade coverage, but an independently reproduced P1 multi-tab save-loss defect prevents save-integrity sign-off. Live advertising and Android also lack implemented/approved distribution capabilities. The protected Vercel preview could not be inspected; its application deployment is NOT ASSESSED, not assumed equivalent to a successful local build.

Audit date: October 25, 2026 local; browser evidence timestamps cross October 26 UTC. Repository `shadowblade1015/HorizonforgeSystems`, clean branch `audit/ember-launch-certification`, HEAD `65d902e5d542de38f7fedc4a51b3c1314201a23c` (merged Phase 3F). No production source, archive, inventory, runtime configuration or Vercel headers changed. Only audit documentation, an independent browser runner and four audit tests were added. No commit/push/merge/deploy/promotion, advertising activation or native package/store operation was performed.

## Executive evidence

- Independently reproduced the historical **277 Node tests**, zero failures/TODOs, after a fresh staged build and strict verification. Output is **277 files from 144 source files**, release `61d8345f99c93b5a67f55238de98c1438bd00a64a4986d495b1cc8b0205262ec`, zero verifier errors. All original assertions remain intact.
- Re-ran the documented **13 mobile browser checks** at seven representative viewports and **41 same-origin offline/upgrade checks**. Both runners started, completed and returned success in Chrome 155.0.8059.86 on Windows. These are local emulation/synthetic-profile results, not physical-device or production-CDN certification.
- Added independent generated-bundle browser probes: **18 PASS, 4 FAIL observations**. The FAILs reproduce stale-tab loss, dynamic reduced-motion failure, hidden-panel focus and false offline readiness. The runner records audit observations; a successful runner exit does not change FAIL into PASS.
- Added four Node audit probes: final suite **281/281 pass**, including three explicitly named OBSERVED DEFECT cases that pass by demonstrating current data loss, plus an independent 12 seed-mode invariant/save/load sweep. This is not 281 tests certifying save safety.
- Timed the actual scheduled main-thread Board solver, observed long tasks and frame stalls under CPU throttling, measured delivery/first board/core-install timing and sampled twenty repeated games. See PERFORMANCE_REPORT for exact final-run data and measurement caveats. No real-user INP or Lighthouse score was fabricated.

## Scope and independence

The review read the original audit/cleanup/testing documents and all Phase 3A-3F reports, mobile/offline matrices and issue histories, then inspected current implementation across engineering/security, PWA/accessibility and commercial/native workstreams. Current code and fresh reproductions determined findings; earlier claims were not counted as unperformed manual tests.

Source coverage included engine movement/deal/checkSets/undo/history and search; Store profile/hand/schema/recovery/backup/import/reset/settlement/daily/artifact/statistics boundaries; Board input/drag/keyboard/touch/runtime ownership/timers/workers/auto-complete; UI screens/tutorial/ceremonies/modal focus; FX/audio/artifact/icon asset sinks; manifest/release/worker/build/verifier; platform/config/analytics/ads; game privacy and portfolio HTML/JS/CSS/contact and external resources. Static asset inventory and hashes cover binaries, but every artwork/font was not individually visually certified. Existing fixtures and simulated adapters are identified as such, not actual native SDKs.

No remote code injection/XSS, remote account compromise, exploitable archive traversal or P0 was reproduced. That is a bounded review conclusion, not a formal security proof. User-controlled import content is copied/validated before acceptance; displayed messages use escaped/text sinks. Source headers declare cache policy only; actual application security headers remain unverified. Trial defense-in-depth policy separately to avoid breaking inline SVG/style/data URLs and service workers.

## New findings and fixes proposed

| Finding | Severity / evidence | Affected gates |
| --- | --- | --- |
| P4-01/F08 stale save overwrites newer profile **and backup**, including hand/future raw | P1, real Chrome + deterministic Store contexts; 100 -> 0, status saved | Web/PWA save integrity |
| P4-06/AND-01 native hydration overwrites protected raw before validation | P1 native-only, actual module/plugin adapter reproduction | Android persistence |
| P4-07/COM-02 native Firebase transmission before consent application | P1 native/Firebase-enabled configuration, actual module adapter reproduction | Android/consent-enabled integrations |
| P4-02/F13 synchronous solver | P2, Node and actual scheduled Board long-task/RAF evidence | Performance; accepted mitigation needed for limited rollout |
| P4-03/PWA-01 optional success implies full offline play despite missing core | P2, controlled partial eviction + actual visible Chrome status | PWA readiness truthfulness |
| P4-04/A11Y-01 dynamic reduced motion leaves canvas running | P2, real Chrome media emulation/draw counters | Accessibility/motion |
| P4-05/A11Y-02 Later hides focused button | P3, actual browser active element remains hidden | Focus polish |

Exact **file/line ranges, reproduction conditions, probability, impact, smallest safe proposal, owner and effort** are in [ISSUE_REGISTER.md](ISSUE_REGISTER.md). P4-08 native durability, P4-09 heuristic false positives and P4-10 deployed header behavior distinguish source-confirmed risks from unexecuted outcomes. Native issues are not misrepresented as current browser transmission/storage behavior.

The first pass is audit-first. P1 findings were documented in engineering/commercial notes when reproduced and are proposed for separate remediation branches. No production bug is claimed fixed here. A single-tab warning reduces exposure but does not prevent stale writers; a passing observed-defect probe is not a workaround or a fix.

## Original audit disposition

| Original issue | Current independently assessed disposition |
| --- | --- |
| F01 save validation/recovery | PASS single-tab sampled checks; original raw protected at startup/import. P4-01 stale writer and P4-06 native hydration expose different boundaries. |
| F02 duplicate victory | PASS original undo/replay assertions and canonical settlement fixtures; receipt remains outside undo. No change to earned formulas. |
| F03 release mixing | PASS local actual A/B/archived-worker identities, CSS/scripts and dedicated worker import; production host still NOT TESTED. |
| F04/F05 lifecycle/timer ownership | PASS deterministic races, real sampled interactions and repeated sessions; native suspension/device timing still NOT TESTED. |
| F06 mobile reachability | PASS Chrome emulated scroll/drag/long columns; physical iOS/Android gestures not certified. |
| F07 modal accessibility | PASS named/isolation/wrapping/restoration samples; human speech/AT remains NOT TESTED. |
| F08 persistence | Single-tab failures covered; **FAIL P1 multi-tab progress/backup/future raw loss remains**. |
| F09/F25 build/source/archive | PASS staged clean build, strict path/byte generation, rollback/lock/archive checks. Host deployment mechanics not inferred. |
| F10 automated coverage | PASS tests/tooling present and independently run; test existence does not certify manual/commercial gates. |
| F11 precache | PASS selected 74-file/2,624,670-byte core and optional failure resilience; offline truthfulness P4-03 remains. |
| F12 unsafe cache/fallback | PASS tested scope/status/hash/waitUntil/route behavior, quota/eviction/interruption handling; no permanent storage guarantee. |
| F13 synchronous search | FAIL P2; measured actual scheduled blocking, no broad rewrite authorized. |
| F14 face-down rules | PASS original strict regressions/invariant checks; malformed saves remain rejected. |
| F15 search heuristic | Source limitation remains; no independent false-positive hand reproduced. Prompt dismissible; do not claim global impossibility. |
| F16 portfolio image delivery | Source inventory still includes 2,060,947-byte PNG; separate P2 marketing optimization, not measured game LCP. |
| F17 duplicated presentation | P3 maintenance issue remains; no proven dead-code deletion or framework migration warranted. |
| F18 native/diagnostic scaffolding | Remains inactive normally; public mock/debug switches are not production monetization. Local-only reward trust should be reconsidered before competitive/paid economies. |
| F19 accessibility/navigation/motion | Major controls/modal work passes sampled checks; dynamic canvas motion FAIL, human/physical gates remain. |
| F20 metadata/canonical policy | Source discoverability/canonical/social gaps remain P3; actual host redirects not verified. |
| F21 headers/trust boundaries | Defense-in-depth source gap; no exploit reproduced, actual app headers NOT TESTED. |
| F22 uniform revalidation | Source still uses global revalidation rather than long HTTP TTL for immutable paths; worker caches provide separate offline reuse. Proposed host-policy optimization remains separately gated on actual responses. |
| F23 external fonts | Portfolio CSS retains Google Fonts dependency; game fonts are local. No third-party game font request observed. External portfolio delivery/privacy remains a separate host/data-flow review concern. |
| F24 contact/date/active-hand UX | Contact uses user-approved mailto/clipboard, no automatic form submission; client-local daily semantics remain. Mail client delivery, date boundaries and replay-tutorial replacement UX need product/device review. |

## Real deployment gate

User supplied `https://horizon-forge-systems-git-main-djs-projects-3c714927.vercel.app/` and explicitly allowed skipping if inaccessible. The direct HTTPS inspection followed to **Vercel login HTML (final 200)**, not the application. Initial protected response status was not retained and is not invented. Login CSP/cache/security headers were deliberately excluded as application evidence.

Connected Vercel discovery exposed one team with only unrelated `church-companion`; authenticated deployment lookup/web-fetch for the supplied URL returned not-found/access-unavailable. Vercel CLI is absent; no linked .vercel project or correct-team local auth was available. No protection settings, account connections or deployment were changed. The public fetch tool also could not access the URL. Evidence: `.phase2-backup/phase4/deployment-access.json` (filtered; no cookies/tokens/login nonce retained).

**NOT TESTED:** exact remote SHA, build/release identity, remote HTML/assets/SRI, manifest/privacy, actual worker headers/scope, canonical/unknown redirects, CDN caching/compression, offline installation/refresh and application screenshots. In particular checkedFetch rejects redirects; actual host canonicalization of immutable index/privacy URLs must be checked rather than inferred from local no-redirect serving. The protected preview is not a failed application build and does not prove the production game is public or private. No application deployment certificate can be issued from this access result.

## Accessibility and privacy/commercial assessment

WCAG 2.2 AA is the review target. Keyboard alternatives, touch targets/scroll reachability, modal focus/isolation, live regions, reduced-motion setting and sampled enlarged layouts have automated/source evidence. Canvas preference transition and update-panel focus are recorded FAILs. NVDA/VoiceOver/TalkBack speech, switch access, real text scaling/browser zoom, forced-color/contrast combinations and physical standalone PWA behavior are NOT TESTED, not waived by Chrome emulation.

Current web flags disable Firebase/live ads. Game privacy copy matches that inspected source and discloses local saves/caching, temporary diagnostics, host connection logs and email support. This is **not** verification of deployed injections, host logging retention, mailbox ownership, deletion operations, legal basis, regional consent or publisher approval. No support email was sent, real export uploaded or live ad clicked. Advertising-supported web is a separate unimplemented/unapproved channel, not a mock-ad demonstration. Android has no production project/package/signing/target manifest and has reproduced native boundaries requiring repair. Details and current official policy sources are in MONETIZATION_REVIEW and ANDROID_READINESS.

## Artifacts, evidence and recommended next action

Required artifacts: [issue register](ISSUE_REGISTER.md), [test matrix](TEST_MATRIX.md), [performance](PERFORMANCE_REPORT.md), [monetization/privacy](MONETIZATION_REVIEW.md), [Android](ANDROID_READINESS.md), [launch/rollback runbook](LAUNCH_RUNBOOK.md), [channel decisions/effort](GO_NO_GO.md). Supporting source reviews: ENGINEERING_NOTES and PWA_A11Y_NOTES.

Reproducible tools: existing mobile/offline runners, new `tools/phase4-browser.mjs`, new `tests/phase4-audit.test.mjs`. Ignored evidence is `.phase2-backup/phase4/`: baseline/final Node logs, build/verifier, copied mobile/offline outputs/screenshots, independent browser summary/screenshots/synthetic export, native boundary probe and solver timings. `evidence-index.json` records local evidence file sizes/hashes. Temporary Chrome profiles remain under OS temp, not in tracked artifacts; no normal player profile was opened. Source-level policy links in commercial reports are not account approval evidence.

First approve a narrow P4-01 remediation branch, assign a persistence owner and QA, then re-certify every writer plus source/build/upgrade compatibility. Fix the small offline/motion findings, profile the solver with a cancellable-worker proposal, and collect the protected host/physical/AT evidence. Estimated web/PWA remediation and certification is **5-12 engineering plus 3-6 QA/release days**, with access/device assumptions and external review delays stated in GO_NO_GO. Ads/native require their separate scopes, not a flag flip. Current outcome remains NO-GO; no GO or CONDITIONAL GO is inferred from green baseline counts.

# Phase 4 issue register

## October 26 follow-up: Phase 4.2

**P4-03, P4-04 and P4-05: repaired in the Phase 4.1-based candidate.** [P4_02_REMEDIATION_REPORT.md](P4_02_REMEDIATION_REPORT.md) records the independently reproduced original failures, exact fixes, evidence-handling deviation and remaining gates. Final checks: **329 Node, 13 mobile, 42 offline, 19 multi-tab; independent browser 32 PASS / 0 FAIL**. Offline claims now require separate same-release core/artwork readiness; live motion changes cancel/restart only eligible effects; Later restores focus through shared screen/modal ownership. Earlier FAIL statements below are historical observations, not current candidate status. **P4-02/F13 solver work is deferred to Phase 4.3.** Overall launch remains NO-GO; no deployment or physical-device/AT certification was performed.

## October 26 follow-up: P4-01 remediation

**P4-01: repaired for supported cooperating releases; legacy-tab rollout gate remains.** See [P4_01_REMEDIATION_REPORT.md](P4_01_REMEDIATION_REPORT.md) for the current source, support boundary and every protected writer. An exclusive lifetime Web Lock plus loaded-primary/backup checks replaces the unsafe concurrent-writer behavior. The three retained observed-loss tests now require preservation. New evidence: **304 passing Node tests, 19/19 actual multi-tab Chrome checks, 42/42 offline upgrade checks and 13/13 mobile checks**. The independent Phase 4 browser stale-tab case is now PASS; P4-03/P4-04/P4-05 remain FAIL observations (19 PASS / 3 FAIL overall).

Current code cannot force already-running pre-4.1 Store code to obey a new lock. Drain/export legacy tabs before rollout and do not roll back to uncoordinated persistence. The focused repair does not change overall NO-GO decisions or certify physical devices/deployment. Platform hydration was also routed through the guarded Store boundary, addressing the source overwrite path in P4-06; native durability/consent/package gates remain unapproved. A dependent waiting-cache retirement ordering race was repaired with two interleaving tests. Historical Phase 4 findings, line ranges and original evidence below refer to the audited pre-remediation commit and are retained rather than rewritten as if those defects never existed.

Audit target: commit `65d902e5d542de38f7fedc4a51b3c1314201a23c`, clean `audit/ember-launch-certification` before audit artifacts. Production source/configuration unchanged. Findings are current observations, not confirmations that prior reports were sufficient. **No P0 was reproduced.** P1 blocks its affected channel; P2/P3 need a disposition but are not automatically P1. Probability below describes the reproduction condition, not an unmeasured population rate.

## P4-01 / F08 - FAIL - P1: stale tab destroys newer progress and its backup

**Locations:** `site/ember-solitaire/js/store.js:228-256,264-290`; lifecycle writers `site/ember-solitaire/js/app.js:36-37`.

**Reproduced:** A and B load the same empty profile. A earns and immediately saves 100 Ember. B changes music and immediately saves its stale profile. Primary **100 -> 0**, backup **0**, persistence status **saved**, no retained conflicting copy. A stale handless tab also replaces A's active hand with null. An already-running v2 tab overwrites a newly stored future-schema raw value even though startup future-version protection works. These losses are deterministic in actual Store contexts, and the 100 -> 0 case was independently reproduced with two actual Chrome tabs. Hiding/closing a stale tab can trigger the writer; no deliberate gameplay or hostile actor is required.

**Impact/probability:** permanent loss after newer in-memory tab closes; certain for the demonstrated stale-write schedule, real-user frequency unknown. Existing upgrade UI warns about tab conflicts but does not enforce save ownership. Single-tab usage is a workaround, not a fix.

**Smallest safe proposal:** separate `remediate/ember-save-concurrency` branch. Establish one active writer, compare exact stored revision/raw value before every replacement, preserve conflicting raw values and block stale writes with export/reload UI. Include autosave, visibility/pagehide, reset, recovery/import and update approval. A storage listener alone is not an atomic lock. Do not sum independently earned balances or split hand/reward writes. Replace observed-loss audit assertions with preservation/refusal regressions only after an approved fix.

**Gate/owner/effort:** web/PWA save integrity; persistence engineer and QA, named assignees pending. **2-4 engineering + 1-2 QA days**, assuming single-writer coordination rather than cloud saves/merging. Evidence: `tests/phase4-audit.test.mjs` first three cases, `independent/summary.json` stale-tab FAIL. Separate remediation approval required; not fixed in this audit.

## P4-02 / F13 - FAIL - P2: synchronous endgame solver blocks the main thread

**Locations:** `site/ember-solitaire/js/board.js:464-472,480-494`; `site/ember-solitaire/js/engine.js:266-293`.

**Reproduced:** construct `Engine.newGame(4,{seed:42})`, deal the entire stock, turn all cards up, clear history; current `Store.validateHand` accepts it. Search runs synchronously with a 20,000-node budget. The independent browser runner measures both direct calls and the real scheduled Board path, including an observer long task and a large requestAnimationFrame gap. Desktop Node samples also reproduce hundreds of milliseconds. Exact browser timings are in PERFORMANCE_REPORT. This is a constructed schema-valid stress state, not a recorded reachable player's trace.

**Impact/probability:** noticeable frozen interaction/animation at qualifying endgames, worse under CPU throttling. Certain on tested hard fixtures; prevalence in natural play unknown. No stack overflow was reproduced; recursion overflow remains a suspected risk, not a second proven defect. Node-count bounds do not imply a frame-time bound.

**Proposal/gate:** engine/performance engineer, **1-3 engineering + 1 QA days**: revision-tagged cancellable worker planning, wall-time/budget-exhausted result; when worker is unavailable, omit the optional suggestion instead of a long main-thread fallback. Gameplay input must remain available. P2 mobile-performance disposition before rollout; can be separately accepted for a limited trial by an assigned owner, never called fixed merely by disabling suggestions.

## P4-03 / PWA-01 - FAIL - P2: optional artwork success overstates offline readiness

**Locations:** `site/ember-solitaire/js/offline.js:82-93`; `site/ember-solitaire/sw.js:160-168,178-181`.

**Reproduced:** install the current release; delete only its cached immutable `js/engine.js` in an isolated profile to model partial eviction; keep the document open. STATUS is false. Reopen Offline & Updates and download all artwork online. DOWNLOAD succeeds for optional entries, STATUS remains false, yet the visible client says all suit modes are available offline. Missing core cannot launch offline. This is controlled eviction, not an observed OS storage-pressure event.

**Impact/probability:** misleading readiness and failed later offline launch; no save loss demonstrated. Certain after this sequence, real eviction frequency unknown. **Proposal:** check/recheck core readiness before the complete-play promise; distinguish artwork completion from incomplete core and offer existing repair. PWA maintainer, **0.5-1 engineering + 0.5 QA days**. PWA capability-truthfulness gate. Evidence: `independent/summary.json`, `false-offline-ready.png`; deterministic worker reproduction in PWA_A11Y_NOTES.

## P4-04 / A11Y-01 - FAIL - P2: dynamic OS reduced motion does not stop ambient canvas

**Locations:** `site/ember-solitaire/js/fx.js:6-7,42-70,86-96`.

**Reproduced:** open home with motion enabled, then CDP-emulate prefers-reduced-motion: reduce without navigating. `FX.motion()` becomes false but canvas draw calls continue during the next 250 ms. Source has no media-query change subscription and the running loop does not recheck motion. CSS preference responses alone do not stop this canvas. Node adapter and actual Chrome agree.

**Impact/probability:** preference change fails for decorative motion, potentially uncomfortable and wastes frames; certain in the tested transition. **Proposal:** subscribe to media-query changes, cancel/clear ambient RAF and reset parallax; restart only if policy permits. Preserve the user's in-game reduced setting. UI/accessibility maintainer, **0.5-1 engineering + 0.5 QA days**. Accessibility gate; do not claim a complete WCAG verdict from this single defect. Evidence: independent summary draw counters.

## P4-05 / A11Y-02 - FAIL - P3: Later leaves focus in hidden update UI

**Location:** `site/ember-solitaire/js/offline.js:81` (`defer`); generated panel buttons `:112-121`.

**Reproduced:** focus the Later button and activate it. Immediately afterward Chrome's active element remains that button inside `[hidden]`. The panel disappears without restoring a meaningful target. Keyboard traversal can resume, so this is not a reproduced permanent trap. Conditional certainty; real AT speech not tested. **Proposal:** restore the invoking Settings control or a stable visible gameplay control. UI maintainer, **0.25-0.5 engineering + 0.25 QA days**. Nonblocking focus polish; independent browser summary records active element and hidden ancestry.

## P4-06 / AND-01 - FAIL - P1 Android-only: native hydration overwrites protected raw save

**Locations:** `site/ember-solitaire/js/platform.js:29-43`; pre-validation call `site/ember-solitaire/js/app.js:10-11`.

**Reproduced native-plugin adapter:** local future raw profile with savedAt 10; Preferences returns a v2 raw profile with savedAt 20. `hydrate` overwrites localStorage before Store validation/quarantine and loses the original future value. Actual current platform module executed in a VM; not a real device/plugin durability test. Conditional certainty if native flags/plugin/candidate ordering apply; normal browser flags bypass the path.

**Proposal/gate:** preserve both raw candidates first, validate supported schema and select with explicit recovery rather than timestamp alone. Native persistence engineer, **2-4 days + device QA**. Blocks Android, not normal web execution. Evidence: `native-boundary-probe.{mjs,json}`; details in ANDROID_READINESS.

## P4-07 / COM-02 / AND-03 - FAIL - P1 Android/Firebase: transmission can precede consent

**Locations:** `site/ember-solitaire/js/analytics.js:23-25,38-53,69-88`; `site/ember-solitaire/js/app.js:28-31`; consent path `site/ember-solitaire/js/ads.js:38-70`.

**Reproduced native/Firebase adapter:** Firebase receives a gameplay event before applyConsent runs, because analytics defaults enabled when native Firebase flags are enabled. Startup also begins custom-key/remote-config paths before the consent flow. This is evidence of transmission ordering, not a legal finding; actual jurisdiction, SDK and publisher configuration are unverified. Browser flags disable these paths.

**Proposal/gate:** default deny native analytics/crash collection until consent/legal basis decision; sequence startup, withdrawal and SDK state explicitly. Native/SDK maintainer plus privacy/publisher reviewer, **2-5 engineering days plus external review/device QA**. Blocks the proposed native Firebase/ad-enabled distribution, not current ad-free web. See MONETIZATION_REVIEW and native probe.

## P4-08 / AND-02 - NOT TESTED - P2 native durability risk

**Locations:** `site/ember-solitaire/js/platform.js:25-29,43-50`; `store.js:264-290`.

Native Preferences writes are asynchronous, caught and not awaited before web save acknowledgement. Hydration trusts timestamps. No native project/device was available to reproduce process-kill loss, disk failures or write reordering. **Suspected risk, not a claimed physical data-loss reproduction.** Proposal: acknowledged ordered mirroring, visible failure/recovery, process-kill/relaunch fixtures. Native engineer; estimate included in Android workstream, verify plugin/runtime first. Android durability gate.

## P4-09 / F15 - NOT TESTED false positive - P2 heuristic limitation

**Locations:** `site/ember-solitaire/js/engine.js:297-320`; wording/actions `site/ember-solitaire/js/screens.js:178-199`.

Depth-limited local-progress search memoizes a position without remaining depth. Exhaustion is conservative but cannot prove global impossibility. No concrete false-positive hand was reproduced in this audit; do not advertise this as a proven unwinnable-game bug. Keep looking/Undo remain available. Smallest proposal: memoize greatest remaining depth and use "No progress found in this search" wording. Engine owner, **0.5-1 day + fixture QA**. Nonblocking with honest language and dismissible prompt; revisit before stronger solvability claims.

## P4-10 / F21 - NOT TESTED live behavior - P2 defense-in-depth gap

**Location:** `vercel.json:8-28` declares cache headers only. No declared CSP, frame-ancestor, nosniff, referrer or permissions policy. Source sinks reviewed use controlled catalogs/escaped or text content; no exploitable XSS was reproduced. Actual application headers remain inaccessible behind deployment authentication; login-page headers are not application evidence.

Trial a separately reviewed CSP report-only/header policy compatible with inline style/SVG/audio/data URLs, then browser-test before enforcement. Security/release engineer, **0.5-2 days + browser QA**. Not an automatic public-web P1; production security-header evidence still required. Do not weaken isolation/worker behavior to obtain a score.

## Evidence/capability gates, not invented source defects

| Gate | Result | Evidence / owner / next action |
| --- | --- | --- |
| G01 correct deployed commit/release/CDN | NOT TESTED | Supplied main preview redirects to Vercel login; connector cannot access its team/project. CLI absent. User explicitly allowed skipping. Release manager must supply scoped read access; no GO based on local results. |
| G02 physical mobile/PWA and AT | NOT TESTED | Windows Chrome emulation only; Safari/Android install/resume/OS eviction, NVDA/VoiceOver/TalkBack speech, real text scaling/forced colors need named QA/accessibility owners. |
| G03 live web advertising | FAIL capability; account NOT TESTED | `build-config.js:2-9`, `ads.js:33-36`, `config.js:24-28`; web ads disabled, no AdSense implementation/CMP/real placements. Publisher approval unknown. See MONETIZATION_REVIEW; separate integration and policy review. |
| G04 Android package/distribution | FAIL capability | No Android project, Gradle/package/signing/SDK manifest/release pipeline. API target cannot be inferred from JS. Native lead/store publisher must scope/build/test separately; see ANDROID_READINESS. |
| G05 privacy operations | NOT TESTED | Source notice matches current game flags; host logs/retention, mailbox ownership/deletion, injected services, legal/publisher obligations not verified. Publisher/privacy owner must sign off actual deployment. |

## Lower-priority carried findings

These remain outside the demonstrated P1 remediation. Each has source/inventory evidence; performance/client/publisher outcomes are not inferred from it.

| Finding / location | Evidence, impact and probability | Minimal proposal / owner / gate |
| --- | --- | --- |
| F16, P2 marketing delivery; `site/index.html:8`, `site/portfolio/index.html:3`, `site/refinery-concept.png` | Inventory confirms 2,060,947 raw bytes; source eagerly references PNG without responsive variants on home. This delivery cost is certain when fetched, but CDN transfer/LCP/user impact not measured. It does not alter measured game LCP. | Visually compare responsive WebP/AVIF with fallback; web/performance owner, 0.5-1.5 days. Marketing performance gate; nonblocking game rules/saves. |
| F17, P3 maintenance; portfolio `index.html`, `about/index.html`, `contact/index.html`, `portfolio/index.html`, `services/index.html`, `tools/index.html` (shared shells, principally minified line 3), `site/style.css:1-14` | Repeated navigation/footer shells and dense CSS remain source-visible; drift is a maintenance risk, not a reproduced runtime failure. Frequency unknown. | Separate formatting/include proposal only if drift warrants it; web maintainer, 0.5-2 days. Nonblocking; no framework migration or dead-asset deletion implied. |
| F18, P3 diagnostic exposure; `site/ember-solitaire/js/ads.js:26,173-183`, `js/app.js:53-58` | Public mock-ad/screen query switches remain. Mock reward trust is local and not a real advertising transaction; no server/payments/competitive prize exploit reproduced. Certain diagnostic access with matching query. | Gate diagnostic entry points in an explicit test configuration before commercial/competitive economies; app/publisher owner, 0.5-1 day. Not a reason to mistake mock inventory for production monetization. |
| F20, P3 discoverability; game `index.html:3-18`, portfolio `site/index.html:2`, other route heads | Titles/descriptions exist; canonical/social/sitemap/custom-404 policy absent in source inventory. Actual indexability, social previews and host canonicalization NOT TESTED. | Choose canonical public URLs, add metadata/sitemap and useful unknown-route presentation separately; web/release owner, 0.5-1 day. Marketing/host validation gate, not a gameplay P1. |
| F22, P3 HTTP delivery; `vercel.json:8-28` | Global revalidation remains despite immutable generated paths. Extra host revalidation cost is plausible, not measured; actual worker cache behavior passes locally. | Verify host identity/headers first, then propose immutable TTL selectively while keeping worker/HTML revalidation; release/performance owner, 0.5-1 day. Do not change headers during audit. |
| F23, P3 portfolio dependency; `site/style.css:1` | Google Fonts CSS import creates a third-party portfolio request when fetched. Game fonts are locally bundled. Font-service outage/privacy processor impact was not reproduced. | Verify deployed data flow and licensing, then consider self-hosting with visual parity; web/privacy owner, 0.5-1 day. Portfolio privacy/delivery review, not evidence of game Firebase/ad transmission. |
| F24, P3 product semantics; `site/pages.js:4-16`, game `store.js:29-32`, `screens.js:347,449` | Mailto/clipboard need user action; inbox delivery and long-URI limits NOT TESTED. Daily uses client-local date while copy says everyone gets today's deal; boundary mismatch depends on timezone. Replay Tutorial can replace a hand after starting the flow; no surprise-reset browser trace was reproduced here. | Clarify local-day/tutorial replacement copy and test mail clients/timezone transitions before changing keys/seeds; product/web owner, 0.5-1.5 days. Do not migrate old daily awards or silently replace saves as copy cleanup. |

No P0/P1 was repaired here. Audit evidence is not a waiver. Production changes require separately approved remediation and dependent retests; no branch, commit, deploy, ad activation or store submission was performed.

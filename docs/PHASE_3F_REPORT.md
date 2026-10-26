# Phase 3F - Offline, service worker and release reliability

Implemented October 25, 2026, on `fix/ember-offline-updates`. The branch was clean before implementation. Baseline: 245 passing tests, zero TODOs. No commit, push, merge or deployment was performed.

## Findings and release design

F03: the historical worker used a manually named cache, network-first HTML and cache-first unversioned dependencies. Fresh HTML could therefore execute old engine/store/board/CSS. Installation called skipWaiting automatically, activation claimed tabs and removed previous scoped caches. Refresh was not protected by a successful save. F11: installation depended on 131 URLs (5,033,646 bytes), including optional card art and themes. F12: arbitrary successful/failed network responses could enter runtime caching, writes were not consistently owned by the event, and navigation failures could substitute the game for privacy or unknown routes.

`tools/release.mjs` now hashes sorted game paths, lengths and exact source bytes plus the generator implementation (compiler line endings normalized). No timestamp participates. Unchanged inputs produce identical output; non-game changes do not change the game identity. Every game source change, including worker changes, changes the SHA-256 release ID.

The build emits an immutable `/ember-solitaire/_releases/<id>/` tree. Generated HTML binds a base URL and release/scope metadata; local script and stylesheet tags have SHA-256 integrity attributes. The dedicated search worker imports its engine from that same immutable tree. Generated manifests keep the install/start scope at `/ember-solitaire/`. Root files remain for historical compatibility, but new documents request immutable dependencies. The worker contains a generated approved-file catalog with exact sizes and hashes. Never edit generated HTML, worker data or release files in dist.

Only narrow build publication changes were needed: staging receives the generated map rather than a direct copy. Existing lock, source snapshot, fresh staging, strict validation, rollback-on-publication-error and retained output backups remain. The verifier regenerates the entire expected output and compares every path and byte, rejecting extra, missing or changed files. It resolves generated HTML bases and validates release asset references. It still enforces the original archive hash and reports historical source equality separately; the inventory/archive were not rewritten.

## Installation, ownership and activation

Protocol v1 caches use `ember-solitaire:<encoded registration scope>:release-v1:<64-hex id>`, plus a small `clients` metadata cache. Installation verifies HTTP 200, nonopaque/nonredirected responses, exact byte length and SHA-256. Requests have a four-second abort bound. The ready marker is written only after all core entries and the catalog succeed. Failed new installs remove only their own partial candidate; the recorded active release remains protected, including with no open tabs. Installation never calls skipWaiting.

Core installation is 74 files, **2,624,670 bytes**, versus the historical 131 files / 5,033,646 bytes (about 48% fewer bytes). This is the deliberately selected complete default experience, not a promise of full artwork availability. All original assets are retained. See the exact feature contract in [OFFLINE_RELEASE_MATRIX.md](OFFLINE_RELEASE_MATRIX.md).

The client registers `sw.js?emberProtocol=1` with the original scope and `updateViaCache: none`. The query identifies workers that support messaging; it avoids sending unsupported reply ports to the historical worker. Vercel routes, headers, build command and output directory are unchanged.

Settings > Offline & Updates reopens an accessible status panel with Update & reload, Later, Download all artwork, Repair offline files and Save Recovery. Ready notices explain the optional-content boundary. Updates hold board input/clock, immediately call the existing protected save, and refuse activation/reload on a failed, unsaved or blocked/future-schema profile. A second protected save precedes reload. Failed attempts release the hold and retain the current document. Save Recovery uses the existing Phase 3A recovery/export interface; no storage keys are cleared.

Modern activation requires approval from one identified tab. That tab waits for the expected ready controller and reloads once. Other identified tabs stay on their existing immutable assets, including their dedicated worker dependencies; they receive no forced reload. Unknown/legacy clients block explicit takeover until closed. Client release pins, the active release and the pending install preserve needed caches. Cleanup occurs on activation, hello/foreground messages, installation and explicit retirement. It removes only unreferenced protocol-v1 release caches and stale client records. Unknown clients conservatively prevent release deletion. Four retained release caches are allowed; a fifth is refused until older clients close. Optional assets have a finite catalog and canonical keys, preventing query-string cache expansion.

Historical scoped caches are read-only migration evidence and are deliberately retained. Unversioned legacy dependencies may read their exact cached successful response; no unrelated cache is deleted or searched. No service-worker path touches localStorage, saves, backups, rewards or statistics. Multi-tab last-writer save conflicts remain explicitly unresolved: release compatibility does not coordinate player progress between tabs.

## First migration from the historical worker

A historical controller can serve fresh network HTML before the new worker activates. The new HTML's immutable base and integrity attributes prevent its requests from matching cached unversioned old scripts. An already open historical tab remains unchanged and blocks takeover because it cannot identify its release.

After those tabs close, the bridge document already runs the new immutable bundle. Its special approval path verifies that the ready waiting release is exactly the document's release, checks for other legacy clients, performs protected saves, requests activation without an unsupported legacy-controller RPC, and reloads that same bundle. This releases outstanding historical-controller streams. This exception does not allow an A document to reload as an unverified B. The real Chrome test executes the actual archived worker, not an imitation, and checks engine/CSS bytes, dedicated-worker engine, active hand, balance, statistics and retained recovery data after migration.

## Fetching, optional content and recovery

Only GET requests in the owned game scope are intercepted. Immutable requests select the exact requested release. Missing old-release data fails explicitly; another release is never substituted. Root and index aliases use the active release's index; privacy uses privacy.html; unknown navigations return 404. The worker script itself is not intercepted. Cached valid content is preferred to waiting on network navigation. Runtime cache writes use event.waitUntil; write failures leave verified online responses usable without falsely acknowledging an offline download.

Optional artwork is fetched, verified and cached on demand. Download all artwork explicitly awaits storage and reports any incomplete response/write. A later 404/500 cannot replace a valid cached response. Repair restores missing current-release core entries without deleting good content or progress. Cache read/open/write denial, quota and interrupted network requests fail visibly or return an unavailable response. Successful installation describes a capability at that moment, not a permanent storage guarantee.

Browsers can evict CacheStorage, including a subset of entries. Current-release repair requires connectivity and the matching deployed bytes. If an old pinned release is evicted after its deployment is no longer available, it fails closed; it cannot reconstruct old assets from the new release. Keep recovery exports, close older tabs and reopen the ready current release. Clearing site data is not a recovery instruction. An OS killing the process and permanent browser storage loss cannot be made durable by a static service worker.

## Validation and evidence

Required commands: `node build.mjs`, `node tools/verify-source.mjs`, `node --test`, `git diff --check`, `git status --short`. The separate release-blocking command is `node tools/offline-browser.mjs`. It needs Node 24 and installed Chrome (default Windows path, override with CHROME_PATH), uses built-in modules, a fresh temporary profile and one loopback origin. It does not open the user's browser profile. The server switches actual generated releases on that same origin; a different Vercel preview origin is not treated as upgrade evidence.

Final Node result: **277 tests pass, zero failures/TODOs/skips/cancellations**. All prior 245 remain passing. The 32 new tests cover deterministic generation, install atomicity, response validation, quota/denial/interruption, routes/scope, event-owned bounded writes, retention/retirement, eviction/repair, protected approval, future saves, deferral, legacy refusal and the bridge. Existing build/verifier assertions now compare the complete approved generated format; no regression assertions were weakened.

Build/verifier: **277 generated files from 144 source files**, all generated paths/bytes match, 44 syntax checks, five JSON checks, 500 local references, 74 core entries and nine routes, zero errors. Of the historical 143 source files, 128 still match archive bytes; this includes intentional changes from preceding phases. Original archive SHA-256 remains `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`.

Real browser result: **41 checks pass in Windows headless Chrome 155.0.8059.86**. It verifies all loaded script/style URLs and fetched byte hashes, engine/CSS fixture markers and actual dedicated-worker engine import. A/B markers exist only in harness-generated fixtures. Tests exercise a legal move in an unfinished saved hand, failed localStorage writes, native Chromium quota override, injected Cache.put rejection in the real worker, partial/whole cache eviction, failed/interrupted core installs, offline root/index/privacy/unknown navigation, old A under B control, retirement after A closes, unrelated cache preservation and actual historical-worker migration. The release-base skip link is also exercised without leaving the document.

Reproducible ignored evidence is under `.phase2-backup/phase3f-browser/`: `summary.json` (check details, fixture identities, request hashes and temporary profile), `browser.json`, and screenshots `a-offline.png`, `update-save-blocked.png`, `legacy-upgraded-b.png`. A failed run writes `failure.json` and `failure.png`; these can remain from an earlier attempt and are not the final result. Full Node output and verifier output are retained alongside as `phase3f-node-tests.txt` and `phase3f-verification.json`.

During development the harness exposed hidden-tab input ownership, unconsumed response streams delaying native worker takeover, unsupported historical RPC and the release-base fragment link. Tests were corrected to foreground input and consume/cancel probes; production migration now avoids unsupported messaging and safely reloads the verified same-bundle bridge. The final complete run has no unexpected failures. The native quota test uses Chromium's actual quota override; the separate Cache.put injection is reported as injection, not physical storage exhaustion.

## Files and unchanged boundaries

- Runtime: `site/ember-solitaire/sw.js`, new `js/offline.js`, integration in `index.html`, `js/app.js`, `js/screens.js`, and scoped panel styles in `css/base.css`. app.js also preserves skip-link focus with generated bases.
- Build/verification: `build.mjs`, new `tools/release.mjs`, `tools/verify-source.mjs`.
- Tests/tooling: new `tests/offline.test.mjs`, `tools/chrome-audit.mjs`, `tools/offline-browser.mjs`; generated-format expectations in `tests/build.test.mjs` and `tests/verify-source.test.mjs`.
- Documentation: this report, `OFFLINE_RELEASE_MATRIX.md`, `TESTING.md`, `README.md`.

Engine, store schema/validation, board rules, settlement/rewards, artifacts, ads/analytics, daily logic, original binary assets, archive, baseline inventory and Vercel configuration were not changed. Prior Node tests continue to cover their behavior. This phase does not certify every earlier manual mobile/accessibility/native check.

## Release, rollback and readiness

1. Review and preserve the complete source/toolchain diff. Build and run both suites above. The eventual reviewed commit must include new tools, source, tests and documentation. Deployment requires separate authorization; none was performed.
2. Publish the complete validated dist atomically through the existing static Vercel deployment. Do not copy only HTML, only the worker or an incomplete release subtree. Check real routing/headers and installation on a disposable browser profile before rollout approval.
3. For a compatible rollback, preserve current work and restore the reviewed site **and matching build/generator/worker protocol tools**, then build/verify/test again. Use the same safe approval lifecycle. Retain previous immutable release URLs at the host when possible; existing browsers rely on their cached release when old paths are absent from a newer deployment.
4. Local output rollback retains the existing `.dist-backup-*` procedure, with no builder running and current output preserved. Archive extraction remains forensic/disposable recovery only. **Do not deploy the historical pre-3F worker as a production rollback**: its activation cleanup and unversioned caching would reintroduce release mixing and remove new scoped caches. Never roll back localStorage to roll back application code.

**Conclusion:** Phase 3F implementation and the required same-origin Chrome release gate pass. It is ready for review and controlled rollout validation, not an assertion of universal browser/OS durability. Before production approval, manually check physical iOS Safari/installed-PWA and Android Chrome suspend/resume/update UX, screen-reader announcements and panel layout, real Vercel routes/headers/CDN, and OS storage pressure/termination. Multi-tab save arbitration, native adapters and unrecoverable device storage loss remain outside this milestone. See the matrix for tested versus manual-only capabilities.

Design references: [Service Workers specification](https://www.w3.org/TR/service-workers/) and [Chrome worker lifecycle guidance](https://developer.chrome.com/docs/workbox/service-worker-lifecycle). Neither replaces the recorded same-origin upgrade tests.

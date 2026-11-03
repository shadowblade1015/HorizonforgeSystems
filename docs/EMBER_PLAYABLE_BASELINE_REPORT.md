# Ember Solitaire playable baseline

November 3, 2026. Local source review only. **READY FOR REVIEW for the playable web baseline; native distribution remains BLOCKED.** No release-candidate merge or public release is approved.

## Provenance and preservation

Separate worktree: `C:/Users/dumes/Downloads/HorizonforgeSystems-playable`, branch `refactor/ember-playable-baseline`, based on certified SHA `6f831f0b7a69c8f5977fbe069b4f52fee0675177`. The original worktree remains on `feature/ember-automatic-offline` with its uncommitted experiment and historical evidence intact. Origin metadata was fetched; no automatic-offline runtime changes were cherry-picked. Baseline build/verifier and all **352 Node tests** passed before editing. Baseline logs are retained under `.phase2-backup/playable/baseline/`. Browser suites were run after editing; no new untouched-baseline browser rerun is claimed.

Reviewed source is uncommitted: HEAD identifies its baseline, not its changed bytes. Final generated web release: `b8b979d1647a3d8834b7f5b74672cf896f999b6ad36d321b0eae1b7098d6079c`. Exact prior release reconstructed by the browser probe: `e759216677bd42a3d9659c143c0a5b8be0e583844c3650fdb7970f40d8e59809`.

## Result

The shared engine, artwork, legal moves/deals/undo/hints, artifact progression, Ember/statistics, keyboard/touch layouts, reduced motion, worker solver and exactly-once receipts are retained. Save schema stays v2. Browser Web Locks and raw conflict checks remain mandatory. No frontend framework was added.

The routine offline overlay and Download all artwork control are removed. Game Updates and Save Recovery remain in Settings. The status region is in normal Settings flow and makes no all-mode offline promise. There is no PREPARE implementation on this branch. The certified `sw.js` and `tools/release.mjs` are unchanged: registration remains legacy compatibility infrastructure, preserving immutable identity, prior clients, explicit activation and protected saves. No worker is unregistered, storage cleared or active hand automatically reloaded. Registration failure and ordinary no-worker online play are explicitly tested.

Native source is built independently into `www/`, containing the same game modules and full artwork/fonts. It omits the worker-registration module and Service Worker, and does not use hosted immutable-release URLs. Android and iOS projects are generated with Capacitor 8.6.0 and six official plugins. Bundled asset-path/browser tests are not Android/WKWebView device certification.

## Platform boundary

| Shared application | Platform services |
| --- | --- |
| engine, Store validation/progression/receipts, Board/session/solver, UI and assets | Platform Preferences queue, lifecycle/back, haptics/status/splash/orientation; Audio suspension remains behind existing Audio API |
| Store owns complete profile and exclusive save ownership | Native writes are serialized, read back and acknowledged; pending/failed mirroring stays visibly unsaved |
| Screens request explicit rewarded offers and natural-break interstitial opportunities | Existing Ads interface has separate web/native provider slots; web is unimplemented, native disabled by compiled flag and tuning; no advertising SDK installed |
| In-memory diagnostic ring | Analytics/crash/remote-config transmission disabled unconditionally until separately reviewed |

Native hydration validates candidates and preserves companions/conflicting raw. It does not choose a winner by timestamp when both stores differ. Native `save(true)` acknowledges the synchronous local copy; its persistence state remains pending/unsaved until mirror acknowledgement. `flushSave()` is the asynchronous protected boundary. Web behavior remains synchronous. Import/reset/recovery replacements also enter the queue. Requesting native release immediately refuses edits while retaining the actual Web Lock until accepted OS writes settle; the queue also rechecks ownership before primary commit. Future native primary values are never overwritten.

A native plugin Promise that never settles also keeps its queue/ownership pending; actual plugin timeout and lifecycle behavior remain native acceptance work. A native plugin Promise that never settles also keeps its queue/ownership pending; actual plugin timeout and lifecycle behavior remain native acceptance work. No JavaScript callback can guarantee completion after immediate OS termination. A synchronous local copy remains available, while mismatched local/native copies on next launch are preserved and require recovery. Process-kill and WebView durability are native release blockers, not claimed solved by mocked tests.

## Validation

Final evidence: `.phase2-backup/playable/review-lock/`; verifier and Node logs: `review-lock-verify.json`, `review-lock-node.log` in the parent directory. Windows Chrome 156.0.8078.80 / Node 24.22.0.

| Gate | Result |
| --- | --- |
| Build / strict source verifier | PASS, 277 exact generated files; historical archive/inventory remain unchanged |
| Full Node | 366 PASS, zero fail/skip/cancel/TODO |
| Mobile | 13 PASS |
| Multi-tab | 19 PASS |
| Solver | 24 PASS |
| Independent browser | 35 PASS / 0 FAIL; inspect raw error/request arrays |
| Playable acceptance | 16 PASS: no-worker 1/2/4 suits, exact historical forward migration/profile/receipt/recovery, Settings-only controls, native bundled modes/worker/fonts/privacy and no external requests |
| Legacy worker/offline compatibility | 46 PASS; retained as compatibility coverage, not a renewed offline product promise |
| Native bundle reproducibility | Two builds compared by path/SHA-256 in Node tests; PASS |
| Capacitor project generation and sync | Android/iOS PASS; npm audit reports zero known vulnerabilities with pinned maintained v8 packages |
| Android debug compile | BLOCKED: JAVA_HOME unset, java absent; SDK/adb absent. No APK produced |
| iOS compile/simulator/device/signing | NOT TESTED: Windows host has no macOS/Xcode/signing credentials |

The initial development Node run intentionally exposed obsolete downloadAll UI assertions; its failure log is preserved. Eleven old optional-artwork UI cases were replaced by ten Settings-only/repair/registration cases, reducing that obsolete group by one. All worker DOWNLOAD protocol tests remain. Fifteen new native packaging/persistence/provider cases bring 352 - 1 + 15 to 366. No engine, ownership, reward, recovery, solver, accessibility or integrity regression was removed. The legacy browser driver now exercises DOWNLOAD directly as protocol compatibility rather than a removed player control. Independent tests retain core eviction/hash and recovery assertions while replacing optional-download marketing assertions with truthful cached-file status.

## Files and decisions

Runtime edits: `css/base.css`, `css/screens.css`, `js/offline.js`, `screens.js`, `platform.js`, `store.js`, `app.js`, `ads.js`, `analytics.js`, `config.js`. The engine, solver worker, Audio source and certified Service Worker remain unchanged.

Build/config: package manifest/lockfile, Capacitor config, `tools/build-native.mjs`, generated Android project/Gradle wrapper and iOS Xcode/SPM project, privacy manifest, launcher artwork and ignore rules. Tests: three new native/provider suites, playable-browser harness, adjusted offline/independent drivers and obsolete UI tests. Documentation: README, TESTING and the three requested reports. Full changed-file list is available through `git status --short`; native generated source is intentionally untracked pending review, not omitted from delivery.

Review the local web baseline now. Before native distribution, resolve the explicit blockers in [native readiness](EMBER_NATIVE_RELEASE_READINESS.md). Production/main, other Horizon Forge sites, historical reports/archive and the experimental worktree remain unchanged. Nothing was committed, pushed, merged or deployed.

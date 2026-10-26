# Offline and release validation matrix

October 25, 2026. Phase 3F. Automated browser: Windows headless Chrome 155.0.8059.86, isolated profile, single loopback origin with deployment switching. All 41 assertions pass. Full implementation, evidence and release/rollback procedure: [PHASE_3F_REPORT.md](PHASE_3F_REPORT.md).

## Capability contract

Offline availability requires a completed installation and retained browser cache. Repair/download needs the matching deployed release and a working connection. CacheStorage is evictable. Never clear player storage to install/update/repair.

| Feature | After core installation | Additional requirement / boundary | Evidence |
| --- | --- | --- | --- |
| Root and index launch | Yes | Current ready worker and retained core | Both aliases launched offline in Chrome |
| Default one-suit game | Yes | Spades, default Obsidian Spade back and Forged Iron table | All 74 core responses available offline; active hand resumes and legal move remains playable |
| Hints, undo, search worker | Core code available | Existing game semantics and browser worker support | Actual worker imports matching engine; earlier Node rule/lifecycle suites pass |
| Fonts, branding, splash/home/forge/hall art | Yes | Both orientation environments, anvil/pedestal and SVG artifact code are core | Complete core fetched offline; not a physical-device visual certification |
| Settings, save recovery/export and local progress | Local code available | Browser storage/download permissions still apply | Existing persistence tests; failed-save update blocks in Chrome |
| Two/four suits | Not promised after core alone | Extra suit faces cached on demand or completed Download all artwork for this release | Optional failure/success/storage tests; all optional catalog downloads acknowledged only after writes |
| Other backs, tables, high-resolution faces | Not promised after core alone | On-demand cached assets or completed explicit artwork download | Missing art does not block core install; retries validated |
| Daily challenges, forge, statistics | Existing local logic/code retained | Local clock/save and required selected suit/theme assets; no remote synchronization promised | Prior deterministic suites pass; no new end-to-end daily/victory browser campaign |
| Privacy | Own offline document | Cached privacy entry, otherwise explicit unavailable | Real offline privacy navigation; never game fallback |
| Unknown route | No gameplay fallback | Returns 404 | Unit and real Chrome navigation |
| Ads/remote config/native services | No new offline promise | Existing graceful behavior/platform requirements | No monetization/platform code changes |
| App install prompt/OS standalone lifecycle | Browser dependent | Physical PWA testing required | Manifest paths checked; native install UI not certified |

Core: 74 files / 2,624,670 bytes. Release catalog: 131 files total, 57 optional. Historical precache: 131 files / 5,033,646 bytes. New output: 277 files from 144 tracked source files, including compatibility root files, immutable tree and generated release catalogs.

## Automated upgrade and failure matrix

| Scenario | Result / policy | Validation |
| --- | --- | --- |
| Same inputs / changed game / changed portfolio | Stable bytes/ID; game change changes ID; portfolio change does not | Node generation tests |
| Fresh A, then server unavailable | Ready A reloads; all core resources return 200 offline | Real Chrome; server disconnect plus CDP offline |
| Deploy B at A origin, unfinished game | B waits; A remains A and can defer/play | Real Chrome; fixture engine/CSS identity and saved legal move |
| Approval / reload | Board held, immediate protected saves, expected ready controller, single reload | Node + Chrome A-to-B |
| localStorage failed write | Activation/reload blocked; recovery remains offered | Injected actual browser Storage write exception + Node |
| Future schema | No replacement, activation/reload blocked | Node actual Store protection and original raw value assertion |
| Two identified tabs | Approving tab B; other remains A with A engine/CSS/worker assets under B controller | Real Chrome actual URLs/hashes and imported worker engine |
| Unknown historical tab | Explicit activation refused until tab closes | Node + real archived-worker Chrome migration |
| First pre-3F migration | New immutable B HTML avoids old unversioned assets; protected same-bundle bridge; progress/recovery intact | Actual archived worker, isolated storage partition at same origin |
| Missing optional art / HTTP 404/500 | Core installs; bad response rejected; cached success retained | Node + real server fault responses |
| Opaque/redirected/hash mismatch response | Rejected, candidate not ready | Node worker harness; not claimed as cross-origin browser fault reproduction |
| Cache write/open/read denial | Failure handled, no false stored-success claim; online verified response where possible | Node; actual worker Cache.put fault injection in Chrome |
| Native quota exhaustion | Download failure visible, core/player data retained | Actual Chromium quota override and QuotaExceededError |
| Partial/full current cache eviction | Explicit offline failure, matching online repair, progress unchanged | Real Chrome deletes test-profile cache entries only |
| Core 500 / interrupted request | B remains active; failed candidate never becomes ready | Node atomicity/cleanup + real C/D server failures |
| Offline update check | Current release stays open | Real Chrome |
| Last old client closes | Unpinned A retires; unrelated application cache survives | Node + real Chrome |
| Four retained releases | Fifth refused until safe cleanup; unknown clients prevent deletion | Node worker harness |
| Current/old assets unavailable after eviction | No substitution from incompatible release; explicit unavailable response | Node + Chrome current partial eviction; old deployment loss remains recovery limitation |
| Local player data | No update/cache path clears localStorage/backups/recovery | Source review, original persistence suite, actual migration recovery sentinel |
| Release-base skip link | Focuses tableau without navigating to a release directory | Real Chrome |

## Manual checks and launch decision

| Check | Status |
| --- | --- |
| Physical iOS Safari and standalone PWA install/update/close/reopen | Required before production approval; not executed |
| Physical Android Chrome storage pressure, OS termination, update resume | Required before production approval; not executed |
| Screen-reader announcement/focus and narrow panel layout with browser chrome | Manual; Node a11y regressions pass, not speech certification |
| Real Vercel routes, headers, cache/CDN behavior | Manual deployment validation; configuration unchanged, no deployment performed |
| Browser extension interference, permanent storage denial/eviction, device loss | Platform limitation; export/recovery guidance, no absolute durability promise |
| Multi-tab progression conflict resolution | Deferred; existing last-writer conflicts remain, UI warns |

The required same-origin Chrome gate passes. Ready for code review and controlled rollout validation, subject to the manual production/device checks above. No automatic deployment, source-control operation or player-data reset was authorized or performed.

# Horizon Forge Systems code audit

Audit date: October 18, 2026. Scope: all 143 extracted files, the source archive, and all four tracked root files. This is a source and dependency-free execution audit, not a certification of live browser behavior. No production files, archive, save data, or deployment configuration were changed.

## Executive assessment

The static architecture is appropriate for this site. Keep it: no application framework, backend, database, or package installation is needed to address the findings. The rules engine is isolated and readily testable. The highest risks are progress reliability, asynchronous game lifecycle handling, and incompatible offline updates. No critical vulnerability was confirmed.

Severity: **High** = progress loss, invalid rewards, or substantial interaction failure; **Medium** = correctness, accessibility, release reliability, or material performance risk; **Low** = maintainability or discoverability improvement. Evidence marked **executed** was reproduced with Node; **source-confirmed** follows directly from code; **browser verification needed** identifies an unmeasured user-visible effect.

## Architecture and ownership

| Area | Files and behavior |
| --- | --- |
| Build/source | `site-source.tar.gz` is the committed application source. `build.mjs` synchronously decompresses USTAR entries whose paths include `dist/`. `dist/` was already untracked at audit start. All 143 extracted file contents match the archive. |
| Deployment | `vercel.json`: no framework, no installation, `node build.mjs`, output `dist`, trailing slashes enabled. Global revalidation cache header, separate `no-cache` worker header. No API routes or server code. |
| Portfolio routes | `/` studio landing page; `/portfolio/` case studies and game; `/tools/` Data Foundry and Guid.me concepts; `/services/` services; `/about/` founder; `/contact/` validated mail draft and clipboard fallback. These are separate HTML documents, not SPA routes. |
| Portfolio assets | `/style.css` shared styles, Google Fonts CSS import; `/app.js` navigation, project dialog, year and reveal effects; `/pages.js` contact form only. Three root PNG illustrations/screenshots. Interior pages load both scripts, including pages without a form. |
| Game entry | `/ember-solitaire/index.html`: fixed app shell, splash, intro, home, modes, board, forge, hall, collection, daily, profile and settings sections. `UI.go()` switches sections without browser-history routing. |
| Game rules | `js/engine.js`: seeded RNG, 104-card Spider deck, 10 columns, 50-card stock, move/deal validation, run removal, 60-step history, hints, endgame DFS and bounded stuck search. `stuck-worker.js` loads the same engine off-thread. |
| Game state | `js/store.js`: `ember.save.v2` localStorage profile, active hand, settings, stats, artifact heat, reserve and daily ledger. Debounced 250ms writes; immediate lifecycle saves; only latest 20 undo snapshots persisted. No web cloud save. |
| Game presentation | `board.js`: keyed card DOM, computed layout, pointer/tap/keyboard input, animation, timer and search scheduling. `ui.js`: screen routing, sheets, settings and helpers. `screens.js`: flow/screens/settings. `tutorial.js` and `ceremony.js`: onboarding and reward/forge scenes. |
| Game services | `manifest.js`: asset resolution/preload; `artifacts.js`: artifact data and SVG artwork; `icons.js`: SVG icons; `audio.js`: synthesized audio; `fx.js`: canvas embers, sparks, parallax. |
| Platform compatibility | `build-config.js`, `config.js`, `platform.js`, `analytics.js`, `ads.js`: optional native bridge, remote tuning and monetization adapters. Web config disables Firebase/native production behavior; ads are normally off. `?ads=mock` is a public diagnostic switch. Native SDKs are not shipped here. |
| Game CSS/PWA | Four live CSS files under `css/`; `style.css` is a separate privacy-page stylesheet, not an obsolete game stylesheet. `privacy.html`, manifest and `sw.js` support policy/install/offline use. |

Inventory totals: **8,496,965 bytes** uncompressed: 8 HTML (49,837 B), 22 JS (215,299 B), 6 CSS (102,115 B), 6 PNG (3,854,430 B), 93 WebP (4,132,522 B), 7 WOFF2 (142,172 B), 1 manifest (590 B). Binary assets were inventoried, hashed and reference-checked, not visually reviewed individually. Full file inventory appears below.

## Prioritized findings

### F01 — High: invalid or unreadable saves can strand or replace progress

**Executed + source-confirmed.** `js/store.js:62–80` merges parsed data without validating `v`, game shape, card uniqueness/ranges, column count, history, numeric stats or artifact IDs. `{v:2,game:{cols:[]}}` was accepted unchanged. Later `Board.start`, preload or render expects complete data. Parse/merge exceptions instead replace the profile with `fresh()`; boot then saves splash state, potentially overwriting the only bad-but-recoverable copy. `ensureProgress(S.artifact)` is outside the catch.

**Solution:** validate and migrate a copied profile before activation; retain the original raw value as recovery data; isolate a bad hand from otherwise recoverable profile progress. Keep `ember.save.v2` compatible. Offer recovery/export before reset, and never silently overwrite an unsupported future schema.

### F02 — High: winning move can pay multiple victory rewards

**Executed.** `engine.js:121–126,158–164` resets `won` on undo but preserves only the set reward high-water mark. `store.js:207–220` grants victory rewards and increments wins for every `res.won`. A synthetic final-set fixture produced **wins 1 / Ember 85**, then **wins 2 / Ember 160** after undo/replay. Sets are paid once; victory is paid twice. `board.js:305–307,381` leaves Undo enabled during the 1.3-second victory delay, making the transition relevant to the UI, though the actual click sequence was not browser-tested.

**Solution:** persist an idempotent victory-awarded marker per hand, independent of undo; reject or explicitly define actions during the winning transition. Preserve earned rewards and existing profile totals; do not retroactively deduct progress.

### F03 — High: service worker can mix releases

**Source-confirmed; browser upgrade test needed.** `sw.js:5,142–148` fetches fresh HTML but uses cache-first unversioned scripts/CSS/assets. A tab controlled by the old worker can fetch new HTML while receiving old scripts. Manual VERSION bumps, immediate `skipWaiting()`, `clients.claim()` and removal of prior caches also let a new worker take over existing clients. Forgetting the manual bump can retain stale code indefinitely despite HTTP revalidation.

**Solution:** generate a release manifest/content versions, keep each shell and assets compatible, and activate an update through an explicit safe reload after flushing the save. Retain the previous cache until old clients finish. Test an A-to-B upgrade with an unfinished hand. Do not clear localStorage to fix cache issues.

### F04 — High: board actions and asynchronous work lack a common lifecycle guard

**Source-confirmed; browser stress test needed.** `board.js:344–390` permits deal/undo/manual moves during auto-complete; `B.autoRunning` only prevents a second auto-complete invocation. `B.busy` is initialized but unused. Plans are cached under `moves:completed`, which is not a unique position after undo and an alternate move. Win callbacks, flip timeouts and animation `onfinish` callbacks are not bound to a game/revision token. Old animations can apply stale positions after a newer render. Stuck responses are invalidated only when a later search begins, leaving a debounce window after a move (`321–341`).

**Solution:** centralize action eligibility and introduce a monotonically increasing game/position revision. Cancel obsolete timers/animations and search results; validate an auto-complete plan against its originating revision; disable or cancel auto-play on manual input. Delay victory UI only for the still-current won hand.

### F05 — Medium: hidden/reset games can keep accruing play time

**Source-confirmed.** `ui.js` pauses when leaving game; `screens.js:65,195` unconditionally unpauses on sheet close, including after an action navigates away. `board.js` timer checks `B.paused`, `won` and document visibility, but not `UI.current` or whether `Store.state.game === B.g`. Reset (`screens.js:446`) replaces the store without clearing the Board reference/timer. This can count time for an invisible or discarded hand and pollute fresh stats.

**Solution:** derive timer eligibility from the active screen, active stored hand and modal state. Stop/clear the board when abandoning or resetting. Closing a sheet should restore the applicable state, not force unpause.

### F06 — Medium: long mobile columns may be unreachable by touch

**Source-confirmed layout/input conflict; device verification needed.** `css/board.css` sets `.table` to vertical scrolling but `.board { touch-action:none }`; no board drag auto-scroll is implemented. `computeLayout()` enforces minimum face-up offsets even when the column exceeds visible height. Since the board occupies the scroll region, normal touch scrolling there is suppressed. Ten columns produce roughly 26–35px-wide cards on common narrow phones; large-card mode mostly increases indices and cannot expand ten physical columns.

**Solution:** first reproduce with long-column fixtures on 320/360/390px viewports and short landscape. Preserve the board design while adding reliable edge auto-scroll or a deliberate scrolling affordance, then verify legal destinations and card indices remain reachable. Do not claim WCAG failure from width alone without measuring actual targets/spacing and applicable exceptions.

### F07 — Medium: victory/forge ceremonies are incomplete modal dialogs

**Source-confirmed.** `ceremony.js:11–19` sets `role=dialog` and `aria-modal=true` but does not label the dialog, trap focus, make background inert or restore focus on close. Victory later focuses a button, but Tab can escape and board shortcuts can still run: `board.js` only excludes `.overlay`, not `.ceremony`. Ordinary `UI.sheet()` has focus wrapping and restoration, but its focusable selector omits `select` and `textarea` and does not isolate the background.

**Solution:** share one modal lifecycle with accessible names, inert background, correct focus containment/restore, and consistent game input blocking. Test keyboard, NVDA and VoiceOver/TalkBack, including nested reset confirmation.

### F08 — Medium: storage failures are silent; multiple tabs overwrite saves

**Source-confirmed.** `store.js:83–98` catches serialization/quota/storage failures without telling the player. There is no backup/export UI or `storage` event conflict handling. Two tabs load independent states and last writer wins; lifecycle flushes can overwrite newer progress. Full profile/history serialization is synchronous on the main thread.

**Solution:** show a nonblocking unsaved-progress indicator, provide explicit export/import with validation, keep a last-known-good backup, and warn or arbitrate when another tab advances the save revision. Measure write duration before optimizing; do not split transactions in a way that separates game and rewards.

### F09 — Medium: build can leave stale files and obscure edits

**Source-confirmed.** `build.mjs` writes archive entries over existing `dist/` without clearing or atomically replacing it. Files removed from the archive survive a local rebuild. README requires repackaging edits; running build over edited `dist/` overwrites them. Only four root files are tracked, so code review sees a binary archive rather than application diffs.

**Solution:** first add a dependency-free archive/content verification tool and documented source policy. Later choose one authoritative text source, or automate deterministic archive creation and verification. Build into a new staging directory, validate it, then publish the staged output. Do not delete the user's edited output as the first cleanup step; preserve a backup and review migration separately.

### F10 — Medium: no committed automated regression coverage

**Confirmed inventory.** No test directory, package manifest, CI workflow or validation script exists. Engine comments refer to a validated prototype and absent `docs/REFACTORS.md`; native comments refer to missing `tools/build_www.js` and release configuration. Neither substitutes for reproducible tests in this repository.

**Solution:** use built-in `node:test`, `node:assert/strict` and `node:vm` for rules/store first. Add static reference/archive checks and a short manual browser release checklist. Introduce browser automation only when recurring regressions justify its development-only dependency.

### F11 — Medium: offline installation eagerly fetches the entire game

**Executed inventory + source-confirmed.** `sw.js` CORE contains **131 URLs / 5,033,646 file bytes**, including both entry aliases, all suits, high-resolution variants, all environments/fonts and privacy assets. `cache.addAll()` is all-or-nothing: any failed request prevents installation. It competes with first-session preloads, especially on mobile. This is file size, not measured compressed transfer or cache storage usage.

**Solution:** precache the minimum complete shell/default play assets; lazily cache optional art/themes and other suit modes. Explicitly document what works offline and offer a background full-offline download if desired. Test cache eviction and failed install without touching saves.

### F12 — Medium: worker caches navigation failures and does not retain cache writes

**Source-confirmed.** `sw.js:147` caches HTML responses without checking status; a resolved HTTP error replaces a good cached document. Network-first navigation has no timeout, and fallback maps any uncached document to game index, potentially showing the game for an unavailable privacy page. Cache writes at `147–148` are detached from `event.waitUntil()` and failures are unhandled. Fetch handling does not restrict runtime cache entries to the game path/origin.

**Solution:** cache only successful intended responses, use `waitUntil` for writes, bound navigation waits, restrict runtime caching to owned assets, and provide a route-appropriate offline fallback. Verify that privacy content is never silently replaced with gameplay.

### F13 — Medium: auto-complete search runs synchronously on the UI thread

**Source-confirmed; latency unmeasured.** `board.js:327` invokes `engine.solveEndgame(g,20000)` directly. DFS clones states and accumulates paths; node budget limits total work but not one-frame blocking or recursion depth. Stuck detection already has a worker, though its failure fallback also performs a synchronous search after a timeout.

**Solution:** move both searches behind cancellable worker requests, revision-tag results, and return an unknown/budget-exhausted result rather than blocking interaction. Benchmark difficult 4-suit endgames on representative phones before selecting budgets.

### F14 — Medium: rules trust invalid card state

**Executed.** `engine.js:77–83` checks only the first lifted card's `up` flag. A descending same-suit pair whose second card is face down is reported movable. `checkSets()` checks the first 12 face-up flags but not the Ace's flag. `newGame()` also trusts suit count, and source indexes lack explicit integer/range validation. Normal generated play maintains face-up suffixes, so this is principally a save/import boundary defect, not evidence that ordinary dealing creates illegal runs.

**Solution:** validate inputs at the persistence boundary and make pure rule predicates reject every invalid card/run/index. Cover malformed fixtures without altering valid Spider semantics.

### F15 — Medium: stuck detection is heuristic, not proof of an unwinnable hand

**Source-confirmed.** `engine.js:298` searches only six moves for local metrics (reveals, pairs, empty columns, sets). The visited key does not include remaining depth; reaching a state first on a longer path can prune a later shorter route with more search budget. Exhaustion is conservatively treated as not stuck, which is good, but the bounded search cannot prove global impossibility.

**Solution:** use wording such as “No progress found; try Undo,” keep all player choices available, and memoize the greatest remaining depth explored per state. Test known positions requiring temporary loss of a same-suit pair or deeper rearrangement.

### F16 — Medium: primary portfolio image is unusually large

**Executed inventory.** `dist/refinery-concept.png` is **2,060,947 B**, eagerly loaded by home and portfolio. Other case images are 678,577 and 654,054 B. No responsive `srcset` exists. Case screenshots are lazy-loaded but lack intrinsic width/height in markup; their fixed-height containers reduce outer shift risk. PNG-only delivery spends bandwidth on smaller screens.

**Solution:** produce visually compared WebP/AVIF variants and responsive sources while retaining originals as fallback. Preserve art/branding. Measure real LCP and transfer savings before/after; do not lazy-load the image that is actually LCP.

### F17 — Low: shared HTML and CSS have maintenance duplication

**Source-confirmed.** Six portfolio documents repeat navigation, footer and project-dialog shells. Dialog markup is present on interior pages that do not open projects. `style.css` is largely compressed into long lines, with successive label-size patches and repeated mobile overrides. There are **no byte-identical duplicate files** across all 143 files. `pages.js` is not a duplicate of `app.js`; it owns the contact behavior. Privacy `style.css` is live and must remain.

**Solution:** format files in an isolated no-behavior-change commit, then use small build-time includes or a dependency-free template function only if drift warrants it. Preserve stable URLs and rendered markup. Use browser CSS coverage on every screen before declaring selectors dead.

### F18 — Low: browser ships native and diagnostic scaffolding

**Source-confirmed.** Platform/Firebase/AdMob paths are inactive in the normal web build but still downloaded and parsed. `Store.settings.language` has no implemented language picker/translation system, `Board.B.busy` has no consumer, and high-resolution face assets are not selected by `faceUrl()` (backs do use high resolution in the chooser). They are candidates, not blanket deletion targets. `?screen=` permits arbitrary existing screen entry before normal onboarding; invalid names leave splash unchanged. `?ads=mock` enables mock rewards, not real ads.

**Solution:** document intended browser/native ownership and gate diagnostic entry points by an explicit test build. Preserve compatibility adapters until native plans are decided. Audit references and behavior before removing assets or fields that may exist in stored profiles.

### F19 — Medium: accessibility needs targeted navigation and motion checks

**Source-confirmed + browser verification needed.** Portfolio pages have semantic main/nav and project dialog names, but no skip-to-main link; mobile navigation has no Escape/focus-close handling. Game provides live announcements, keyboard controls, settings switches and ten hidden accessibility column buttons, but these buttons are `tabIndex=-1` and all visual cards are aria-hidden (`board.js:107,596`). Verify mobile explore-by-touch rather than assuming the invisible pointer-disabled columns work on every screen reader. Ceremonies and some generated progress bars lack names. Inspect computed reduced-motion styles across splash, intro, forge and board; JS motion settings alone do not prove all CSS animations stop.

**Solution:** add skip navigation and consistent menu keyboard handling, name progress/dialog roles, then manually test selectable runs and legal destinations using keyboard and assistive technology. Preserve existing keyboard shortcuts and contrast/large-index settings.

### F20 — Low: SEO and social metadata are incomplete

**Executed static scan.** All eight HTML documents have titles, descriptions, language and viewport metadata. None has a canonical URL or Open Graph metadata. No sitemap, robots file, structured data or custom 404 file exists. Missing robots.txt does not itself prevent indexing. Directory and index.html entry aliases, including manifest `start_url`, deserve a deliberate canonical policy rather than assumptions about deployed redirects.

**Solution:** add canonical and social tags for public marketing/game pages, a sitemap and explicit crawl policy, and a useful 404. Keep gameplay screens as internal states; do not add SPA infrastructure for SEO. Verify actual preview/production redirect behavior separately.

### F21 — Medium: security headers and trust boundaries need deliberate hardening

**Source-confirmed configuration gap, not a proven live vulnerability.** `vercel.json` declares cache headers only; there is no repository policy for CSP, framing, MIME sniffing, referrers or permissions. Live platform defaults were not inspected. `innerHTML` is used extensively, mostly for controlled templates; portfolio project content is static and contact text uses `textContent` plus encoded mailto values. No server/API secret or credential was identified; sample AdMob IDs are public test IDs. Store-loaded numbers/strings are sometimes interpolated without validation, so localStorage is not a safe template trust boundary.

**Solution:** fix save validation, audit dynamic sinks, then trial a narrowly tailored CSP in report-only mode in a separate approved deployment change. Account for inline style attributes, SVG/data images, Google Fonts and the inline script error handler. Apply appropriate framing/MIME/referrer policies after preview validation. Do not claim exploitable remote XSS based solely on innerHTML or self-modified storage.

### F22 — Low: uniform HTTP revalidation forfeits long-lived asset caching

**Source-confirmed.** `vercel.json` requests `public,max-age=0,must-revalidate` for every path and `no-cache` for the worker. That is conservative for mutable filenames; it does not mean “never store,” and does not override worker cache-first behavior. Assets have no content hashes. Actual CDN headers, override precedence and compression were not measured.

**Solution:** keep mutable HTML/worker revalidation; only use long-lived immutable cache headers after content-addressing assets. Validate returned headers on preview before proposing configuration edits. No deployment configuration was changed during this audit.

### F23 — Low: font delivery adds a third-party dependency

**Source-confirmed.** `dist/style.css:1` uses Google Fonts `@import` with multiple weights, adding external stylesheet/font discovery. The game uses seven local WOFF2 files and `font-display:swap`, with two critical fonts preloaded. Its privacy stylesheet names Inter/Cinzel without local font-face declarations, so a direct privacy visit falls back to system/Georgia.

**Solution:** measure portfolio font use, then self-host only necessary weights or replace import with explicit resource links. Preserve typography visually. If privacy typography consistency matters, share a minimal local font declaration rather than loading the entire game CSS.

### F24 — Low: contact and daily behavior need explicit product semantics

**Source-confirmed.** `/contact/` prepares a mailto draft; it does not send or store inquiries on a server. Clipboard failure has a readable manual-copy fallback. Long messages may exceed a mail client's URI handling; this requires a browser/client check. `Store.today()` uses the visitor's local date while daily copy says everyone receives today's same deal (`screens.js:345`); different timezones can see different dates concurrently. Restart/replay tutorial replaces an active hand without a separate confirmation; consider warning when a meaningful saved game exists.

**Solution:** preserve honest “prepare/review/send” copy, test mail clients and long input, and define local-day versus global-day semantics before changing seeds or ledger keys. Never migrate daily rewards or overwrite active hands casually.

### F25 — Low: extractor hardening and reproducibility are limited

**Source-confirmed.** `build.mjs` checks safe integer sizes, archive bounds and resolved paths under dist, and rejects unsupported types: useful safeguards. It does not check USTAR magic/header checksums, reject duplicate entries, pin a Node runtime or enforce an archive size ceiling. It resolves both output and entries relative to cwd, so execution from another directory has surprising output semantics. Synchronous in-memory extraction is acceptable at the current size.

**Solution:** add read-only archive validation and deterministic round-trip verification first. Later anchor paths to the script directory, validate headers/duplicates and document a supported Node version. The committed archive is trusted input here; no archive traversal exploit was confirmed. Avoid overengineering a general tar implementation.

## Validation performed and limits

Executed with **Node v24.22.0**, with in-memory VM stubs and no application file writes:

- Inventoried and SHA-256 hashed all 143 files; no byte-identical duplicates.
- Compared every extracted file with its archive entry: 143 entries, zero mismatches. Did not rerun the production build over dist, since that would overwrite application files.
- `node --check` passed for build.mjs and all 22 JavaScript files (23 total).
- Scanned literal HTML src/href and CSS url references: no missing local files. This is not a complete runtime route or dynamic URL test; external links were not requested.
- Inspected eight HTML metadata sets and all service-worker core paths; all 131 precache URLs resolve locally.
- Passed 487 assertions across 1/2/4-suit seeded state creation, 104 unique IDs, stock/deal/undo round trips, legal hinted moves, card conservation through up to 80 steps per mode, and 60-entry history cap. An initial determinism assertion compared startedAt timestamps and failed; corrected it to compare only seeded tableau/stock, then all assertions passed. That failure was in the audit assertion, not the RNG.
- Executed targeted reproductions for repeated win rewards, acceptance of a face-down suffix, malformed saved game acceptance, and a valid in-memory store save/load round trip. Synthetic final-set fixtures isolate reward behavior and are not a full played-through browser victory.

**Not run:** real desktop/mobile gameplay; touch drag/scroll and screen readers; Lighthouse/axe/contrast measurements; screenshot comparisons; actual Vercel builds/headers/redirects/CDN behavior; service-worker install/offline/upgrade/eviction in browsers; storage quota/private mode/multiple-tab races; full victory/forge/undo animation sequences; performance traces; external URLs and mail clients; native Capacitor/Firebase/AdMob integrations. No browser automation dependency was installed or available as a repository test setup. Python was not available on PATH, so the README's Python repackaging recipe was not executed. Static findings do not establish measured Core Web Vitals or live security-header behavior.

## Lightweight testing strategy

1. Commit a small `node --test` suite outside dist, using VM contexts for the global ES modules and storage stubs. No runtime dependencies. Use deterministic seeds and explicit card fixtures; normalize clocks, not game state.
2. Cover valid/invalid moves (including face-down suffixes), every suit deck, deal gaps, multiple set removal, undo reveal/stock/set restoration, history cap, set/victory idempotency, deterministic daily seeds, save round trips, 20-history persistence, corrupt/future schema, quota failure, and migration compatibility. Preserve fixture copies of existing v2 saves with user data removed.
3. Add a read-only static check for archive parity, safe tar entries, all local references/precache paths, JSON parsing, JS syntax, duplicate IDs, page titles/descriptions and expected route files. Avoid fragile assertions that mirror implementation line-for-line.
4. Maintain a manual browser checklist: marketing navigation/menu/dialog/contact; fresh onboarding, resumed hand, restart/new hand, each suit, selection/drag/keyboard/hints/undo, stock gaps, win, forge tiers, daily bonus, settings, reset confirmation. Use dedicated test-origin storage; never clear production progress.
5. Test at 320/360/390px portrait, 844x390 landscape, tablet and desktop; include long columns, 200% zoom, reduced motion and slow network. Chrome/Edge, Firefox and Safari/iOS should be represented. Record environment and outcome, including untested devices.
6. Add optional Playwright development-only tests when justified by F03/F04/F06 regression risk: smoke/no-console-errors, win-race fixture, reload persistence, multi-tab conflict and service-worker release A/B offline upgrade. Add axe as development-only tooling only if accessibility regressions recur. No framework is necessary. Run basic checks in CI once a supported runtime/source policy is agreed.

## Full extracted file inventory

The following inventory records every inspected path and its on-disk byte size. Asset descriptions and live ownership are mapped above; presence in this table is not a recommendation to delete a file.

| Path | Bytes |
| --- | ---: |
| `dist/about/index.html` | 4630 |
| `dist/afarringtale-productions.png` | 654054 |
| `dist/app.js` | 4500 |
| `dist/contact/index.html` | 5442 |
| `dist/ember-solitaire/assets/branding/ember_spade_sm.webp` | 43242 |
| `dist/ember-solitaire/assets/branding/ember_spade.webp` | 126962 |
| `dist/ember-solitaire/assets/branding/icon-192.png` | 36999 |
| `dist/ember-solitaire/assets/branding/icon-512.png` | 228580 |
| `dist/ember-solitaire/assets/cards/backs/club.webp` | 51204 |
| `dist/ember-solitaire/assets/cards/backs/club@2x.webp` | 167070 |
| `dist/ember-solitaire/assets/cards/backs/diamond.webp` | 46518 |
| `dist/ember-solitaire/assets/cards/backs/diamond@2x.webp` | 130894 |
| `dist/ember-solitaire/assets/cards/backs/heart.webp` | 48194 |
| `dist/ember-solitaire/assets/cards/backs/heart@2x.webp` | 155592 |
| `dist/ember-solitaire/assets/cards/backs/spade.webp` | 40298 |
| `dist/ember-solitaire/assets/cards/backs/spade@2x.webp` | 133360 |
| `dist/ember-solitaire/assets/cards/clubs/02.webp` | 15776 |
| `dist/ember-solitaire/assets/cards/clubs/03.webp` | 15268 |
| `dist/ember-solitaire/assets/cards/clubs/04.webp` | 17494 |
| `dist/ember-solitaire/assets/cards/clubs/05.webp` | 17722 |
| `dist/ember-solitaire/assets/cards/clubs/06.webp` | 19958 |
| `dist/ember-solitaire/assets/cards/clubs/07.webp` | 20166 |
| `dist/ember-solitaire/assets/cards/clubs/08.webp` | 22310 |
| `dist/ember-solitaire/assets/cards/clubs/09.webp` | 22370 |
| `dist/ember-solitaire/assets/cards/clubs/10.webp` | 23116 |
| `dist/ember-solitaire/assets/cards/clubs/ace.webp` | 16712 |
| `dist/ember-solitaire/assets/cards/clubs/ace@2x.webp` | 51784 |
| `dist/ember-solitaire/assets/cards/clubs/jack.webp` | 41030 |
| `dist/ember-solitaire/assets/cards/clubs/jack@2x.webp` | 127286 |
| `dist/ember-solitaire/assets/cards/clubs/king.webp` | 39748 |
| `dist/ember-solitaire/assets/cards/clubs/king@2x.webp` | 123596 |
| `dist/ember-solitaire/assets/cards/clubs/queen.webp` | 38704 |
| `dist/ember-solitaire/assets/cards/clubs/queen@2x.webp` | 119932 |
| `dist/ember-solitaire/assets/cards/diamonds/02.webp` | 12066 |
| `dist/ember-solitaire/assets/cards/diamonds/03.webp` | 13832 |
| `dist/ember-solitaire/assets/cards/diamonds/04.webp` | 14480 |
| `dist/ember-solitaire/assets/cards/diamonds/05.webp` | 15936 |
| `dist/ember-solitaire/assets/cards/diamonds/06.webp` | 16146 |
| `dist/ember-solitaire/assets/cards/diamonds/07.webp` | 16228 |
| `dist/ember-solitaire/assets/cards/diamonds/08.webp` | 16596 |
| `dist/ember-solitaire/assets/cards/diamonds/09.webp` | 17960 |
| `dist/ember-solitaire/assets/cards/diamonds/10.webp` | 18756 |
| `dist/ember-solitaire/assets/cards/diamonds/ace.webp` | 15276 |
| `dist/ember-solitaire/assets/cards/diamonds/ace@2x.webp` | 46774 |
| `dist/ember-solitaire/assets/cards/diamonds/jack.webp` | 38900 |
| `dist/ember-solitaire/assets/cards/diamonds/jack@2x.webp` | 113672 |
| `dist/ember-solitaire/assets/cards/diamonds/king.webp` | 40800 |
| `dist/ember-solitaire/assets/cards/diamonds/king@2x.webp` | 125616 |
| `dist/ember-solitaire/assets/cards/diamonds/queen.webp` | 37904 |
| `dist/ember-solitaire/assets/cards/diamonds/queen@2x.webp` | 110056 |
| `dist/ember-solitaire/assets/cards/hearts/02.webp` | 14984 |
| `dist/ember-solitaire/assets/cards/hearts/03.webp` | 13356 |
| `dist/ember-solitaire/assets/cards/hearts/04.webp` | 19172 |
| `dist/ember-solitaire/assets/cards/hearts/05.webp` | 12026 |
| `dist/ember-solitaire/assets/cards/hearts/06.webp` | 16668 |
| `dist/ember-solitaire/assets/cards/hearts/07.webp` | 16370 |
| `dist/ember-solitaire/assets/cards/hearts/08.webp` | 16838 |
| `dist/ember-solitaire/assets/cards/hearts/09.webp` | 17504 |
| `dist/ember-solitaire/assets/cards/hearts/10.webp` | 15076 |
| `dist/ember-solitaire/assets/cards/hearts/ace.webp` | 14006 |
| `dist/ember-solitaire/assets/cards/hearts/ace@2x.webp` | 44274 |
| `dist/ember-solitaire/assets/cards/hearts/jack.webp` | 40324 |
| `dist/ember-solitaire/assets/cards/hearts/jack@2x.webp` | 122636 |
| `dist/ember-solitaire/assets/cards/hearts/king.webp` | 41640 |
| `dist/ember-solitaire/assets/cards/hearts/king@2x.webp` | 128946 |
| `dist/ember-solitaire/assets/cards/hearts/queen.webp` | 40956 |
| `dist/ember-solitaire/assets/cards/hearts/queen@2x.webp` | 120158 |
| `dist/ember-solitaire/assets/cards/spades/02.webp` | 9982 |
| `dist/ember-solitaire/assets/cards/spades/03.webp` | 10614 |
| `dist/ember-solitaire/assets/cards/spades/04.webp` | 11842 |
| `dist/ember-solitaire/assets/cards/spades/05.webp` | 13416 |
| `dist/ember-solitaire/assets/cards/spades/06.webp` | 11874 |
| `dist/ember-solitaire/assets/cards/spades/07.webp` | 13094 |
| `dist/ember-solitaire/assets/cards/spades/08.webp` | 14712 |
| `dist/ember-solitaire/assets/cards/spades/09.webp` | 13946 |
| `dist/ember-solitaire/assets/cards/spades/10.webp` | 16114 |
| `dist/ember-solitaire/assets/cards/spades/ace.webp` | 13748 |
| `dist/ember-solitaire/assets/cards/spades/ace@2x.webp` | 45066 |
| `dist/ember-solitaire/assets/cards/spades/jack.webp` | 38880 |
| `dist/ember-solitaire/assets/cards/spades/jack@2x.webp` | 116832 |
| `dist/ember-solitaire/assets/cards/spades/king.webp` | 39952 |
| `dist/ember-solitaire/assets/cards/spades/king@2x.webp` | 125590 |
| `dist/ember-solitaire/assets/cards/spades/queen.webp` | 38446 |
| `dist/ember-solitaire/assets/cards/spades/queen@2x.webp` | 117874 |
| `dist/ember-solitaire/assets/effects/smoke.webp` | 26618 |
| `dist/ember-solitaire/assets/environments/anvil.webp` | 21054 |
| `dist/ember-solitaire/assets/environments/forge_chamber_landscape.webp` | 48120 |
| `dist/ember-solitaire/assets/environments/forge_chamber_portrait.webp` | 38712 |
| `dist/ember-solitaire/assets/environments/forge_hall_landscape.webp` | 46830 |
| `dist/ember-solitaire/assets/environments/forge_hall_portrait.webp` | 37896 |
| `dist/ember-solitaire/assets/environments/hall_legends_landscape.webp` | 45774 |
| `dist/ember-solitaire/assets/environments/hall_legends_portrait.webp` | 41602 |
| `dist/ember-solitaire/assets/environments/pedestal.webp` | 19902 |
| `dist/ember-solitaire/assets/environments/splash_landscape.webp` | 36410 |
| `dist/ember-solitaire/assets/environments/splash_portrait.webp` | 22430 |
| `dist/ember-solitaire/assets/environments/table_ember.webp` | 18222 |
| `dist/ember-solitaire/assets/environments/table_iron.webp` | 20344 |
| `dist/ember-solitaire/assets/environments/table_obsidian.webp` | 13054 |
| `dist/ember-solitaire/assets/fonts/cinzel-latin-500-normal.woff2` | 15040 |
| `dist/ember-solitaire/assets/fonts/cinzel-latin-600-normal.woff2` | 15204 |
| `dist/ember-solitaire/assets/fonts/cinzel-latin-700-normal.woff2` | 15184 |
| `dist/ember-solitaire/assets/fonts/inter-latin-400-normal.woff2` | 23664 |
| `dist/ember-solitaire/assets/fonts/inter-latin-500-normal.woff2` | 24272 |
| `dist/ember-solitaire/assets/fonts/inter-latin-600-normal.woff2` | 24452 |
| `dist/ember-solitaire/assets/fonts/inter-latin-700-normal.woff2` | 24356 |
| `dist/ember-solitaire/assets/ui/borders/metal_tile.webp` | 1334 |
| `dist/ember-solitaire/css/base.css` | 18831 |
| `dist/ember-solitaire/css/board.css` | 12552 |
| `dist/ember-solitaire/css/screens.css` | 35330 |
| `dist/ember-solitaire/css/tokens.css` | 4234 |
| `dist/ember-solitaire/ember_spade.png` | 195273 |
| `dist/ember-solitaire/index.html` | 8796 |
| `dist/ember-solitaire/js/ads.js` | 10474 |
| `dist/ember-solitaire/js/analytics.js` | 5213 |
| `dist/ember-solitaire/js/app.js` | 3315 |
| `dist/ember-solitaire/js/artifacts.js` | 24808 |
| `dist/ember-solitaire/js/audio.js` | 6063 |
| `dist/ember-solitaire/js/board.js` | 34822 |
| `dist/ember-solitaire/js/build-config.js` | 257 |
| `dist/ember-solitaire/js/ceremony.js` | 10900 |
| `dist/ember-solitaire/js/config.js` | 2885 |
| `dist/ember-solitaire/js/engine.js` | 15059 |
| `dist/ember-solitaire/js/fx.js` | 5937 |
| `dist/ember-solitaire/js/icons.js` | 5807 |
| `dist/ember-solitaire/js/manifest.js` | 4091 |
| `dist/ember-solitaire/js/platform.js` | 4675 |
| `dist/ember-solitaire/js/screens.js` | 38402 |
| `dist/ember-solitaire/js/store.js` | 11412 |
| `dist/ember-solitaire/js/stuck-worker.js` | 388 |
| `dist/ember-solitaire/js/tutorial.js` | 8002 |
| `dist/ember-solitaire/js/ui.js` | 10609 |
| `dist/ember-solitaire/manifest.webmanifest` | 590 |
| `dist/ember-solitaire/privacy.html` | 3923 |
| `dist/ember-solitaire/style.css` | 1929 |
| `dist/ember-solitaire/sw.js` | 5928 |
| `dist/index.html` | 9948 |
| `dist/pages.js` | 1752 |
| `dist/portfolio/index.html` | 6631 |
| `dist/refinery-concept.png` | 2060947 |
| `dist/revive-renew-health.png` | 678577 |
| `dist/services/index.html` | 5951 |
| `dist/style.css` | 29239 |
| `dist/tools/index.html` | 4516 |

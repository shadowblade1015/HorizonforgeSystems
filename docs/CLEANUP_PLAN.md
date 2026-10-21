# Incremental cleanup plan

October 18, 2026. This is a proposed sequence, not authorization to change deployment settings. Audit changes are documentation only. Finding IDs refer to CODE_AUDIT.md.

## Guardrails

Preserve design, branding, routes, game rules, `ember.save.v2`, existing Ember/statistics/artifact progress and daily ledger. Keep runtime dependency-free. Each step should be one reviewable change with its verification record; do not mix formatting, logic, art and caching changes. Test saves on a separate local/preview origin. Retain the last deployable archive and known-good save fixtures before a migration. Never clear real player storage as a troubleshooting step.

## 1. Establish a read-only baseline — safest first task

Addresses F09/F10/F25. Add a dependency-free Node verification script outside dist that inventories archive entries, compares extracted contents, checks JS syntax/JSON/local references and lists stale or missing files without rewriting anything. Add `node:test` engine fixtures and document one authoritative source/repackaging procedure. Do not change build.mjs or vercel.json yet.

**Verification:** current archive reports 143 matching files, zero stale/missing entries, all 23 JS syntax checks pass, all precache paths resolve, and existing v2 save fixtures remain byte-unchanged. Repeat produces the same content inventory. Record source hashes. Baseline valid engine tests pass; known defect reproductions should be clearly tracked as expected failures/TODOs until their fixes, not silently asserted as correct behavior. A fresh checkout must reproduce the baseline with built-in Node tools only.

## 2. Protect save recovery and expose persistence status

Addresses F01/F08/F14. Add schema validation/migrations on a copied profile, raw-save quarantine/backup and explicit unsaved status. Validate game/card/history invariants and bounded numeric/settings fields. Recover profile independently from a broken hand. Define future-version behavior and validated export/import. Preserve the key and all valid existing values. Keep multi-tab conflict handling as a separate subchange after ordinary save/load recovery works.

**Verification:** valid historic v2 fixtures resume unchanged; malformed JSON, truncated hands, wrong artifact IDs, duplicate cards, missing history, future versions and denied/quota storage do not silently erase progress or crash boot. Recovery export remains available. Two-tab tests cannot silently overwrite a newer revision. All existing rewards and daily records survive round trips.

## 3. Make victory progression idempotent

Addresses F02. Add a per-hand victory payout marker independent of undo snapshots, with an explicit compatibility rule for existing saves. Block or define Undo during victory transitions. Do not deduct rewards already granted to existing profiles.

**Verification:** winning, undoing and replaying grants one victory reward and one win per hand; sets retain their existing high-water behavior. Reload before/after victory cannot double-pay. Normal 1/2/4-suit and daily rewards remain correct. Test the delay before the ceremony, not only the engine API.

## 4. Stabilize board lifecycle, asynchronous work and timing

Addresses F04/F05/F13/F15. Introduce a game/position revision, central action guards, cancellation and consistent timer ownership. Manual input cancels or is disabled during auto-complete. Invalidate plans/results on every state change. Clear old board references and timers after abandon/reset. Move endgame search to a worker in a follow-up small change; make heuristic stuck copy accurate.

**Verification:** rapid move/deal/undo, reset/new game during animations, worker completion after undo, and navigation during a win delay leave the displayed board equal to stored state. No old ceremony appears over a different hand. Time advances only for the active visible unpaused game. Auto-complete remains legal and cancelable. Test repeated move counts with distinct positions and hard 4-suit search fixtures. Record mobile responsiveness during search.

## 5. Repair mobile reachability and modal accessibility

Addresses F06/F07/F19. First capture long-column examples and keyboard/screen-reader failures. Add scrolling/drag affordances while keeping visual layout. Consolidate modal focus/inert handling, names and input isolation. Add skip navigation and mobile menu Escape behavior. Verify existing large indices, contrast and reduced-motion preferences.

**Verification:** every top card and legal destination is reachable by touch at 320/360/390px and short landscape; drag cancellation restores the board; long runs can be scrolled reliably. Complete a hand using keyboard selection/shortcuts; dialogs retain and restore focus; no board action fires behind a ceremony. Check NVDA plus iOS VoiceOver or Android TalkBack. Record untested devices explicitly. Compare screenshots to preserve branding and layout.

## 6. Implement an atomic offline update policy

Addresses F03/F11/F12. Generate a release manifest and asset versions, precache a minimal usable shell, lazily cache optional assets, check response status and retain writes with waitUntil. Stage worker activation through safe save/reload and retain caches needed by older tabs. This is separate from HTTP header changes.

**Verification:** install with interrupted/failed requests; launch offline; use default suit and document other modes' offline availability; load privacy offline; exercise cache eviction; upgrade release A to B with an active saved hand and an old tab. No mixed shell/scripts, cached HTTP errors or unrelated cache deletion. Save bytes/progress survive cache replacement. Validate both directory and index.html entry aliases.

## 7. Make source maintenance transparent and builds reproducible

Addresses F09/F17/F18/F25. Agree on tracked text source versus an automated archive workflow. Preserve/compare the old archive and edited dist before any migration. Format HTML/CSS/JS separately, then address repeated shells only if useful. Stage build output into a fresh location and validate before publishing; harden USTAR validation and script-relative paths. Remove only proven dead fields/selectors/assets; keep privacy CSS and optional native compatibility until ownership is decided.

**Verification:** clean staging output contains exactly expected files; removed archive entries cannot leak into output; app contents match the approved source. All public routes, DOM hooks, save behavior and screenshots match before/after. Existing tests pass. Never combine a source migration with deployment routing changes. Keep an easy rollback to the previous archive/build.

## 8. Optimize delivery with measured visual parity

Addresses F11/F13/F16/F22/F23. Resize/re-encode large portfolio art, add responsive sources, review font weights and unnecessary startup preloads. Profile before changing card compositor hints or effect complexity. Only after immutable asset names exist, prepare a separate proposal for cache headers; do not change deployment settings as part of the audit.

**Verification:** compare art/typography at mobile/desktop sizes, record transfer bytes and LCP under the same network/device conditions, and check offline behavior. No regression in first playable time, card readability, animation smoothness or privacy page loading. Preview response headers and update behavior must be verified before any later cache-policy deployment.

## 9. Improve metadata and harden browser policy separately

Addresses F20/F21/F24. Add canonical/social metadata, sitemap, deliberate robots policy and useful 404 content. Clarify local-date daily semantics and long-mailto handling without changing saved seeds. Trial CSP report-only and other browser policies in a separately reviewed preview deployment, accounting for existing fonts, SVG/data URLs and inline styles.

**Verification:** crawl every public route, check canonical/index aliases and social preview assets, validate unknown paths, test contact drafts/copy fallback in mail clients, and verify daily behavior around local midnight/timezone boundaries. No CSP breakage of SVG art, sound, fonts, service workers or storage. Record actual response headers; do not infer platform defaults from source configuration.

## Release checklist and rollback

Run dependency-free checks and targeted tests for the changed feature. Perform fresh and existing-save browser smoke tests; include the relevant mobile/accessibility/offline cases above. Confirm the archive/source and extracted output agree. Record tests not run and why. For every later application release, keep a prior compatible archive and worker release; rollback must not roll back or erase user saves. Schema changes should be additive/backward compatible wherever possible, with exported recovery data before any irreversible migration. No new framework is recommended; browser automation, if adopted, belongs in development tooling only.

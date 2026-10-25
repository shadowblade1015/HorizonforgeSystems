# Phase 3E - Mobile gameplay, responsive design and accessibility

## Scope and baseline

Implemented on `feat/ember-mobile-accessibility`. The working tree was clean before edits; `node --test` passed all 205 baseline tests with zero failures or TODOs. The audit, cleanup plan, testing guide and Phase 3A-3D reports informed this change.

This remains a static, dependency-free application. Engine rules, rewards, settlement/hand identity, save schema, ads, service worker, Vercel configuration, historical archive/inventory, fonts and artwork are unchanged. No commit, push, merge or deployment was performed.

## Initial findings and reproduction

The committed HEAD is served separately for baseline browser measurements, so baseline screenshots do not accidentally include working-tree fixes. Use `node tools/mobile-browser.mjs before` to reproduce. See [the viewport matrix](MOBILE_TEST_MATRIX.md).

- Cards measured 27.5px at 320px, 31.5px at 360px and 34.3px at 390px. Large-card mode could enlarge indices but could not expand ten physical columns. The short-landscape layout also limited card size by table height.
- `.table` could overflow vertically while `.board` suppressed native touch panning. Minimum face-up spacing could extend a deep column beyond the visible table. There was no drag edge scrolling.
- Drag deltas used client coordinates without incorporating changes to the table's scroll offsets. Resize could retain an active gesture with obsolete geometry.
- Column buttons were transparent, pointer-disabled and excluded from Tab navigation. Their accessibility attributes did not establish a usable focus path. Keyboard entry on the board also depended on a broad application role.
- Ceremonies lacked accessible names, background isolation and shared focus containment. Independent sheet key listeners could compete when nested. Closing a stale dialog could restore inappropriate focus.
- Browser zoom inspection exposed settings ranges extending outside narrow panels and headers wrapping into extremely narrow center tracks. Fixed column counts and minimum widths also needed narrow-container reflow. The first failing screenshots were used to refine these layouts.

## Layout and interaction decisions

The default tableau now reserves at least 48px per card (50px in measured phone layouts), or 64px with Large Cards. Larger viewports still show all ten columns without purposeful horizontal overflow. Narrow viewports use a horizontal table scroll region, visible numbered column controls and a persistent "Swipe across for columns 1-10" cue. Existing faces, backs, table textures and colors are retained.

Native touch panning is the default. Tapping still selects/places cards. A labeled, pressed-state **Touch: drag** toggle deliberately assigns subsequent touch gestures to dragging; switching back restores panning. This avoids depending on changing `touch-action` halfway through an already-owned gesture. Mouse dragging remains immediate after its threshold. Touch and mouse thresholds are 12px and 7px respectively.

Both scroll axes participate in drag deltas and destination selection. A held pointer near a table edge scrolls in owned animation frames, bounded by layout extent. Pointer cancellation, lost capture, resize, backgrounding and hand replacement reconcile lifted cards and cancel outstanding gesture work. Native scroll cancellation retains an existing tap selection. Gesture cancellation resumes eligible runtime checks. Rules and actual card positions remain the engine's responsibility.

Face-up spacing retains a readable minimum rather than compressing deep columns indefinitely. The board grows to contain the final card. Tests validate canonical 25- and 45-card positions against the existing save validator before testing geometry. Selection/focus scrolls the relevant column/card into view. Column buttons remain in a sticky header during vertical scrolling.

## Keyboard and assistive-technology controls

Ten visible, focusable native column buttons expose top cards, relevant movable run, hidden-card counts, current selection and legal destinations. Activating a column explicitly selects its maximal valid run, independent of the One-Tap preference; another column places it, and reactivating the source cancels. **More cards**, **Fewer cards** and **Cancel selection** provide native-button alternatives to arrow-key run adjustment. They change selection only, never engine positions.

Arrow navigation, Enter/Space, Up/Down, Escape, D, U and H remain available. Native activation of a focused column button is not processed twice by the board handler. A visible-on-focus skip link reaches the tableau. Instructions are available in Board controls and via the board description.

The board uses a named `group` instead of a broad `application` role. Browser testing verifies native focus/activation paths; native button alternatives avoid requiring screen readers to surrender their browse-mode arrows. Actual NVDA/VoiceOver/TalkBack verification remains pending, so this is not a claim of assistive-technology conformance.

Selection has an inset outline and pressed button state; destinations use dashed outlines in addition to color. Announcements distinguish rejected moves, selection/cancellation, deals, completed sets and victory. Superseded pending announcements are cancelled through the existing owned scheduler.

## Shared modal lifecycle

`UI.modal` is the single focus/isolation mechanism used by sheets and ceremony layers. Only the top modal handles Tab/Escape and focus containment. It supplies a name, initial focus, a container fallback when no controls are available, and includes links, inputs, selects and textareas in its focus path.

Background app children are inert and hidden from the accessibility tree while a modal is active. Original attributes are restored when the stack empties. A closing/fading child remains inert and hidden even if its parent closes immediately afterwards. Delegated navigation and board user-input handlers also respect modal ownership. Existing direct Board lifecycle APIs remain callable for teardown/undo compatibility; they are not a user-input escape hatch.

Focus restoration checks navigation, profile and hand ownership plus connectivity/inert state. Nested close restores a valid parent control. Stale close cannot focus another hand's UI. Dismissible sheets close with Escape; victory/forge/legendary ceremonies retain their existing explicit completion controls. Obsolete entrance/focus callbacks cannot steal focus from a newer modal. Forge/legendary actions are inert until their reveal stage.

Sheets use bounded scroll regions with safe-area padding. Transformation text/actions and legendary statistics have bounded scroll regions on short displays. Non-game screens can scroll vertically; settings and other dense panels reflow using actual container widths. Narrow header titles span the header rather than being squeezed between two fixed controls. The tab bar can scroll horizontally when zoom leaves insufficient space, and labels wrap within their buttons.

## Visual accessibility review

New numbered controls and touch/run controls are at least 44px high; card width is at least 48px. Overlapping card strips are intentionally smaller, with native column/run controls providing an alternative interaction path. This does not establish that every existing target meets WCAG 2.2 AA.

Calculated solid-color contrast ratios: card ink/ivory 15.73:1, card red/ivory 6.04:1, bronze control text/charcoal 7.75:1, warm ivory/charcoal 15.28:1, faint text/charcoal 5.09:1. These calculations do not certify composited artwork, all gradient backgrounds, disabled states or every screen. Existing High Contrast remains available. Enlarged ranks now accompany genuinely larger card geometry. Motion preferences suppress decorative board/ceremony loops while retaining static selection and state feedback.

## Files changed

| Files | Purpose |
| --- | --- |
| `site/ember-solitaire/js/board.js` | Adaptive geometry, touch ownership, scroll-aware dragging/edge scrolling, selection visibility, column/run controls, announcements and lifecycle cancellation |
| `site/ember-solitaire/js/ui.js` | Shared modal stack, focus containment/restoration and background isolation |
| `site/ember-solitaire/js/ceremony.js` | Shared modal registration, names, guarded focus and staged action availability |
| `site/ember-solitaire/index.html` | Discoverable instructions, touch/run controls, skip link and named tableau group |
| `site/ember-solitaire/css/{base,board,screens}.css` | Scroll regions, readable cards, sticky controls, focus/selection cues, safe areas, reduced motion and narrow/zoom reflow |
| `tests/mobile-accessibility.test.mjs` | 40 new deterministic regression cases |
| `tests/lifecycle-helpers.mjs` | More faithful DOM attributes, button/focus queries, scroll and document/resize event adapters |
| `tests/recovery-ui.test.mjs` | Standard DOM attribute methods in the existing adapter; original assertions unchanged |
| `tools/mobile-browser.mjs` | Optional dependency-free, installed-Chrome browser audit with CDP touch/keyboard input and screenshots |
| `docs/TESTING.md`, `docs/MOBILE_TEST_MATRIX.md`, this report | Commands, results, scope and release checks |

## Automated validation

Required commands: `node build.mjs`, `node tools/verify-source.mjs`, `node --test`, `git diff --check`, `git status --short`.

Final Node result: **245 tests passed; zero failures, TODOs, skips or cancellations**. All original 205 assertions continue to pass. New coverage spans seven viewports in both card sizes, valid deep-column geometry, native-pan versus drag ownership, thresholds, scroll-aware drops, both edge-scroll axes, pointer cancellation, resize/visibility/replacement/lost capture, reduced motion, keyboard and native run controls, labels, nested modal trapping/restoration/isolation, stale ownership and rapid fade cleanup. CSS-only assertions are supplemented by real browser checks rather than presented as visual evidence.

Build/verifier: **143 source/output files match; zero errors**, 23 syntax checks, two JSON checks, 421 local references, 131 precache references and nine routes. 129 current files retain historical archive bytes; intentional Phase 3A-3E edits account for the remainder. The historical archive SHA-256 remains `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`. The existing clean-build integration test still passes, including alternate cwd, missing/stale output, validation failure and rollback retention.

## Executed browser validation and evidence

Windows headless **Chrome 155.0.8059.86**, isolated temporary profile, local static server, CDP viewport/touch emulation. No player's stored progress is accessed. No Playwright/runtime package was added. The computer-use connector could not initialize; the installed-browser CLI audit supplied actual browser evidence instead.

All seven requested viewport layouts were captured. Browser flow assertions cover column-ten focus reachability, 320px recovery naming/focus/background isolation/scrolling, Escape, a real emulated touch drag producing one legal move, a real touch swipe scrolling a validated 45-card board without moving cards, native Tab wrapping, nested and original focus restoration, victory naming/focus/isolation, forge Continue focus, the settings range fitting at 200% CSS zoom, and uncaught JavaScript exceptions. The browser audit exits nonzero for a failed flow assertion.

Screenshots include splash, onboarding story/artifact choice, modes, board, pause, victory, forge ceremony, home/forge, hall, collection, daily, profile, settings and recovery. Eight non-game screens are also captured at 200% CSS zoom; enlarged cards are captured at 320px. CSS zoom is not OS text scaling or a physical browser toolbar zoom test. Screenshots and DOM measurements establish the exercised rendering, not complete traversal of every screen/action.

Local evidence directory: `.phase2-backup/phase3e-browser/`. `before/` and `after/` contain `measurements.json`, `browser.json` and viewport PNGs; `after/flows.json` records flow assertions. Useful screenshots: `after/390x844.png`, `column-ten.png`, `deep-column-bottom.png`, `recovery-320.png`, `pause-320.png`, `victory-320.png`, `forge-ceremony-320.png`, `onboarding-choose.png`, `settings-200-percent-zoom.png`, `large-cards-320.png`. Evidence is ignored local output; rerun the tracked tool to regenerate it. Profiles and output are retained, not automatically pruned.

## Manual release checklist and remaining risks

- [ ] Physical iOS Safari/VoiceOver and Android Chrome/TalkBack: pan in both axes, select/place, explicit drag, edge scrolling, cancellation and orientation on 25+/40+ card columns.
- [ ] NVDA desktop and keyboard-only full hand: inspect/adjust a run, legal/invalid placement, stock, hints, undo, set completion and victory announcements. Check group/browse-mode behavior and live-region verbosity.
- [ ] Real browser zoom, OS large text/display scaling, virtual keyboard, notched safe areas and high-contrast/forced-colors settings on every major screen.
- [ ] Traverse entire short/zoomed sheets and forge/legendary ceremonies, nested recovery/reset confirmations, imports and focus after external/native transitions. Legendary presentation retains deterministic lifecycle coverage but was not physically device-tested.
- [ ] Verify long-session touch-mode discoverability and fatigue on representative phones; confirm scroll/drag thresholds and edge speed feel appropriate. Emulation cannot establish real-device gesture latency or ergonomics.
- [ ] Review small preexisting decorative typography and all artwork/gradient contrast; no formal WCAG conformance claim is made.
- [ ] Perform the separate existing offline/release-upgrade checks before deployment. F03 service-worker release mixing, multi-tab save conflicts and search-performance work remain outside this phase.

Release review and these manual checks remain with the maintainer. No deployment or source-control publication is authorized by this implementation.

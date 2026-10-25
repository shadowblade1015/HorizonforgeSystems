# Phase 3E mobile verification matrix

Executed with Windows headless Chrome 155.0.8059.86, CDP viewport emulation. These are browser measurements, not physical device certifications. See [the report](PHASE_3E_REPORT.md) for interaction policy and release gaps.

| Viewport | Baseline card width | Current default width | Current horizontal geometry | Browser screenshot |
| --- | ---: | ---: | --- | --- |
| 320x568 | 27.5px | 50px | 546px board / 308px table | Captured |
| 360x640 | 31.5px | 50px | 546px / 348px | Captured |
| 390x844 | 34.3px | 50px | 546px / 378px | Captured |
| 430x932 | 38.3px | 50px | 546px / 418px | Captured |
| 768x1024 | 66.8px | 66.8px | 736px / 736px | Captured |
| 1440x900 | 107.5px | 107.5px | 1180px / 1180px | Captured |
| 667x375 | 51.1px | 51.1px | 559px / 559px | Captured |

All current layouts allow native panning by default (Chrome serializes `pan-x pan-y pinch-zoom` as `manipulation`); deliberate Touch: drag uses `none`. No body horizontal overflow was reported. Baseline scrollWidth at 320px/short landscape included overflowing presentation content even though card widths fit; use `cardWidth` and table geometry rather than treating that value as the designed layout width.

| Scenario | Executed evidence | Remaining check |
| --- | --- | --- |
| Seven viewports, normal/large geometry | Deterministic calculations in both sizes; browser default screenshots; 320px large screenshot | Real devices, system scaling |
| Deep columns | Canonical 25/45-card states pass existing validator; final-card geometry fits scroll extent | Real-device stacked-card readability |
| Scroll without moving | CDP touch swipe scrolls 45-card board; no move count change | iOS/Android touch ownership |
| Touch drag | CDP touch drag makes exactly one legal move | Physical drag feel and cross-column edge scroll |
| Cancellation and scroll offsets | Deterministic resize, hidden/replaced hand, lost capture, threshold, scroll-aware drop and edge-scroll checks | Browser interruption/native OS gestures |
| Recovery and nested sheets | Real Chrome name/focus/inert/scroll/Escape/Tab/restore; deterministic stale/rapid-close checks | Screen readers, file picker/virtual keyboard |
| Victory and forge | Real canonical win/forge screenshots and focus assertions | Physical devices, full legendary flow |
| Narrow major screens | Splash, onboarding, modes, board/pause, home/forge, hall, collection, daily, profile/settings/recovery screenshots | Complete human traversal and assistive technology |
| Enlarged content | Eight non-game screens at 200% CSS zoom; settings range fits; header/control reflow visually inspected | Browser toolbar zoom, OS text enlargement |
| Keyboard/AT | Native Tab wrapping/restoration, column focus; deterministic keyboard/run/button/announcement checks | NVDA, VoiceOver, TalkBack speech and browse-mode behavior |
| Motion/contrast | Reduced-motion deterministic paths and CSS; solid-color contrast calculations | OS preference changes, forced colors and composited artwork |

Run `node tools/mobile-browser.mjs after` on Windows with installed Chrome (or set `CHROME_PATH`). `before` serves committed HEAD, so it means the current commit's source, not a permanently pinned historical revision. Review changes before using it as a baseline after committing. The tool creates a fresh browser profile and serves only local site files; it never deploys or uses the normal browser profile. Evidence is under ignored `.phase2-backup/phase3e-browser/{before,after}/`.

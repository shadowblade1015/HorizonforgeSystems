# Phase 3D - Gameplay lifecycle reliability

## Pre-change lifecycle map (recorded before implementation)

Baseline: clean `fix/ember-game-lifecycle`, 152 passing tests, zero TODOs.

- Screens/tutorial register a hand in Store, navigate to game, then Board.start replaces DOM state and queues an unguarded initial frame. Resume also starts a new interval and frame.
- Board move/deal settle immediately, render animations, enqueue notifications and victory presentation; undo renders separately. Animation onfinish handlers and delayed flips can restore obsolete positions/visibility after another render.
- Auto-complete loops over a cached plan with independent awaited timeouts. Manual input can mutate the same hand during that wait; the plan cache uses moves/completed, which can repeat after undo and alternate moves.
- Stuck requests live in a pending map. Responses are invalidated only when a later request starts, leaving a debounce window after mutation. Worker errors call pending callbacks against whichever game is now active.
- The timer owns a 500ms interval and checks paused/won/hidden, but not store ownership or active screen. Pause/stuck sheets forcibly unpause on close; reset can leave the old Board game ticking into new statistics.
- Navigation, abandon/restart and delayed ad continuations lack a shared generation guard. Victory overlays can be duplicated; their old buttons can abandon a newer hand after awaiting an ad.
- UI sheets and heat animations have their own frames/timeouts; closed sheets can still focus, and obsolete heat callbacks can mutate detached DOM.

Implementation and validation results follow.

## Implemented lifecycle model

The attachment ended mid-sentence after its test list. This implementation covers all visible Tasks 1-8 and adds this report plus updated testing guidance. No deployment, commit, push or merge was performed.

The persistent v2 hand/settlement identity is unchanged. Board owns three runtime counters: a display session (replacement/navigation), a monotonically increasing position revision (moves/deals/undo/replacement), and a work epoch (including suspension/manual cancellation). These counters live in the board module, never in saves. Render generations additionally supersede older layout/animation callbacks even when the card position is unchanged.

Game work must match the originating store-owned hand, session, revision and epoch. Same-session ad continuations intentionally ignore short-lived pause epochs: a native ad can pause the app without cancelling a legitimate continuation, while navigation/replacement/undo still revoke ownership. Non-game presentation scopes additionally capture profile ownership.

Board centrally owns timeouts, frames, animations, interruptible auto-complete waits, removed-card ghosts and search requests. Invalidation cancels resources, resolves cancelled waits as false, terminates workers, clears pending entries and releases drag state/highlights. Animation completion callbacks check ownership and DOM connectivity. Repeated mount/dispose/cancel calls do not register extra listeners or leave additional intervals/pending operations.

## Manual and automated action policy

Manual move, deal, undo, selection and keyboard input cancel an active auto-complete run synchronously, then apply only if otherwise eligible. Input is blocked while another pointer drag owns the action, while paused/hidden/modal, or while the displayed hand differs from Store. A cancelled pointer gesture cannot turn into a tap/move. Ordinary visual animation does not lock the board: rapid valid actions are allowed, and obsolete animations are cancelled/reconciled.

Each auto-complete step checks ownership and current Engine.canMove before applying one move. It refreshes its expected position token only after its own successful move and waits through a cancellable delay. A cancelled/older run's finally block cannot reset a newer run. Finish-button visibility/planning is recomputed after cancellation. Search algorithms, limits and normal animation durations remain unchanged.

The board checks the originating token again after progression callbacks, so a synchronous observer replacing the hand cannot make the old action render completion data into the new board.

## Victory and presentation

Phase 3B still owns all victory calculations and persistence. Board only schedules presentation while the same active hand remains won. Mutation/navigation/teardown cancels obsolete presentation. A runtime weak set and an active-layer guard prevent repeated victory overlays and repeated presentation-triggered game_win/ad gameFinished calls for the same runtime hand object.

Victory buttons validate ownership before acting and after awaited ads. Obsolete buttons cannot abandon a newer game or navigate over another screen. Same-session native/background pause during a legitimate ad does not revoke that continuation. Closing a legitimate ceremony retains the normal fade; stale ceremonies are removed immediately. Delayed focus/heat/spark work is guarded or cancelled. Forge/legendary scene waits also have bounded, revocable ownership; cancellation never undoes an already-earned artifact advancement.

Tutorial coaching is tied to its originating hand. Delayed steps are cancelled on mutation/teardown, resumed appropriately after visibility suspension, and removed on session replacement without incorrectly marking another hand's tutorial complete. UI sheets own a scoped pause hold, have idempotent close/focus cleanup, and cannot force an unrelated game to resume. Delayed import-file reads cannot open a confirmation on a replacement screen.

## Clock ownership

Board is the sole game clock owner. It uses performance.now() and at most one 500ms refresh interval. At each eligibility transition it settles the prior active fractional interval, resets the baseline, and runs an interval only while the current store-owned hand is on the game screen, unpaused, unblocked by sheets, visible, page-active/native-app-active and not won.

Pause, visibility/page changes, native app suspension, navigation, completion and replacement are boundaries. Resuming never charges the intervening hidden/paused interval. No blanket delta cap discards legitimate foreground time; event-loop stalls while genuinely active count as elapsed foreground time. Undo of a won hand resumes only subsequent eligible time. Timer ticks never invalidate a position/search token.

Store emits narrow beforeSnapshot/beforeGameChange notifications. Board flushes fractional elapsed time before save/export and disposes the old hand before replacement/abandon/reset/import/load. A failed reset/import does not dispose the live board because replacement notification follows successful storage replacement. Native App foreground/background wiring uses a separate app-active condition, so a replacement cannot accidentally clear native suspension. The schema still permits fractional milliseconds and retains the existing Phase 3A safe-write/backup/unsaved-warning behavior.

## Worker/search ownership

Requests and responses carry request ID, session and revision. The callback also checks the originating work epoch, active hand and current eligibility. A board mutation invalidates immediately, not when a later debounced query finally starts. At most one pending stuck request exists. Matching current results are consumed once; obsolete replies and errors cannot reopen prompts. Worker failure clears/terminates the worker and falls back only for a still-current pending request. Already-delivered prompts are not repeated by a later worker error.

The auto-complete plan cache uses position revision instead of moves:completed. This prevents undo/alternate moves with identical counts from reusing an obsolete plan. Neither stuck-search heuristics nor endgame search were redesigned or broadly optimized (F13/F15 remain separate).

## Files changed

- site/ember-solitaire/js/board.js: runtime ownership, scheduler/animation cleanup, action/auto guards, clock, worker management, presentation scheduling and lifecycle APIs.
- site/ember-solitaire/js/ui.js: route/sheet ownership, modal holds, delayed focus/import guards and cancellable heat animations.
- site/ember-solitaire/js/screens.js: removes unconditional sheet-close unpause; guards delayed ad/navigation/presentation continuations and new-game measurement frames.
- site/ember-solitaire/js/ceremony.js: current/unique victory entry, guarded buttons/ads, cancellable layer work and forge/legendary scopes.
- site/ember-solitaire/js/store.js: six lifecycle notifications only; no reward calculations or save fields changed.
- site/ember-solitaire/js/stuck-worker.js: echoes session/revision without changing search logic.
- site/ember-solitaire/js/platform.js: existing native app-state callback delegates to the board's app-active condition; no SDK/advertising policy changes.
- site/ember-solitaire/js/tutorial.js: hand-owned coaching and resumable delayed steps.
- tests/lifecycle-helpers.mjs and tests/lifecycle.test.mjs: fake scheduler/DOM/animation/worker adapters and 53 deterministic tests executing the actual production modules. Private inspection is test-only VM instrumentation, not a new production debug API.
- tests/recovery-ui.test.mjs: adds the cancelAnimationFrame browser stub needed by real sheet cleanup; existing assertions remain unchanged.
- docs/TESTING.md and this report: updated results and manual verification guidance.

App boot, engine rules, Phase 3B payout logic, advertisements/analytics implementations, CSS/art/fonts, save fixtures, build/Vercel configuration, historical archive and baseline inventory remain unchanged. Application edits are in site; generated dist is rebuilt only.

## Validation

Commands:

```powershell
node build.mjs
node tools/verify-source.mjs
node --test
git diff --check
git status --short
```

Final suite: **205 tests, 205 pass, zero failures/TODOs/skipped/cancelled**. All 152 earlier tests continue passing. The 53 new lifecycle cases assert exact card/move/reward/elapsed-time/DOM effects, request and resource bounds, and guarded navigation, not just lack of exceptions.

Coverage includes all requested rapid move/deal/undo/win/frame/replacement scenarios, navigation, repeated pause/resume/start/stop/dispose, visibility and native suspension, manual cancellation of awaited auto-play, valid full auto-play, stale and matching worker replies/error fallback, real worker protocol, duplicate/stale/current victory callbacks and ad transitions, sheet/focus/import teardown, tutorial and forge scene cancellation, and v2 fractional-time/receipt round trips. Tests deliberately retain/reinvoke obsolete callbacks to model delivery races after cancellation.

Build/verifier: **143 source files match 143 generated files**, zero errors/missing/stale output; **23 syntax checks**, **2 JSON checks**, **421 local references**, **131 precache URLs**, **9 routes**. **132 files** remain identical to the historical archive; intentional application changes are reported against evolving site source, not by rewriting historical evidence. Archive SHA-256 remains e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291. Logs and structured verification are retained locally under ignored .phase2-backup; build rollback output remains in ignored .dist-backup-* directories.

## Remaining limitations and manual browser checks

This is a dependency-free deterministic regression pass, not a certification of real browser/Web Animations/native SDK timing or visual parity. Before a separately approved release, use an isolated origin and disposable profiles:

1. Exercise rapid tap/drag/keyboard moves, deals, hints and undo on desktop Chrome/Edge and mobile Safari/Chrome, including cancellation during flips and responsive resize. Confirm current cards/face flags/targets match the engine and no stale removed-card ghosts remain.
2. Auto-complete a multi-step endgame; interrupt it by move, selection, deal, undo, Escape, pause, visibility change and navigation. Confirm no extra step and correct finish-button recovery.
3. Win and undo during the existing victory delay; replay, navigate, restart and reset. Confirm one payout, no obsolete overlay/analytics/ad pacing, normal legitimate victory presentation, and no old button abandoning a new hand.
4. Test real/mock ad transitions, native App suspension/resumption and rejection/dismissal behavior. Underlying SDK operations cannot necessarily be cancelled; obsolete UI continuations are ignored. Earned opt-in ad reward amounts/award policy were not altered. Presentation guards are runtime guards, not a cross-session analytics delivery ledger.
5. Open/close nested sheets, navigate while paused, reset/import from Settings and resume a hand. Compare elapsed/playMs across foreground, pause, hidden-tab, pagehide/pageshow and native app transitions. Test reload/export with fractional elapsed values and failed storage writes; retain the Phase 3A unsaved warning/export workflow.
6. Test delayed worker results/errors during undo and replacement, plus real worker availability/failure. Confirm no obsolete stuck dialog. Synchronous fallback/search can still block on hard positions: no new search algorithm or F13 performance fix is claimed.
7. Test onboarding coaching across pause/background/new-hand transitions and forge/legendary scenes during navigation/reset. Cancellation preserves already-earned progress; return to the appropriate screen to review it.
8. Verify real animation fades, reduced motion, focus restoration, accessibility and memory/worker/timer behavior across many sessions. The fake DOM is intentionally not a layout engine or complete browser emulator.

F03 offline release mixing, multi-tab arbitration, broader accessibility work, search heuristics/performance and physical/native storage durability remain separate. Worker/board scripts must be from a compatible release; the existing service-worker cache/update policy was not changed. Phase 3A/3B crash/failed-write limitations and warnings still apply. No browser driver, server, preview deployment or real player storage was used in this phase.

Stop after Phase 3D implementation and validation.

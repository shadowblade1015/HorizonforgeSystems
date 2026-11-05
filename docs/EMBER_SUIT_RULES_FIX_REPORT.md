# Ember suit rules and hint readability

November 3, 2026. **READY FOR REVIEW.** All mandatory gameplay regression checks pass. No merge, deployment, push or ad activation occurred.

## Provenance and artifacts

Branch: `fix/ember-suit-hint-readability`, created from `refactor/ember-playable-baseline` at `b895c61a5abcf2b3f75df682e89f332a1445851d`.
Exact gameplay/build source commit: `95d9cfa4d4f7ac80f21d7eaa25d26207092a1715`. This report and evidence are a subsequent documentation commit; they do not alter build inputs.
Release ID: `4b649bc748dba5ebd138f457296519f1a29ed260423ba9ef890dea04a3b446a5`.

Isolated worktree: `C:/Users/dumes/Downloads/HorizonforgeSystems/.worktrees/ember-suit-hint`. The original dirty checkout, playable baseline worktree and production main are preserved.
Updated playable web output is `dist/`; native assets are `www/`. ZIPs are in `.phase2-backup/suit-hint/release/`. [Release manifest](evidence/ember-suit-hints/release-manifest.json) records exact SHA-256 hashes. Generated bundles remain local ignored artifacts.

## Rules and presentation

Reviewed engine.js, board.js, screens.js and engine/board/mobile tests. All 1/2/4-suit modes share the same classic rules: K, Q, J, 10 through A; placement requires exactly one higher destination rank, regardless of suit; movable groups must be face up, strictly descending and one suit; completion requires 13 face-up cards from King to Ace in one exact suit. Neither red/black color nor appearance substitutes for suit identity. Invalid moves return before snapshots, changes or rewards. Added explicit invalid-index rejection.

Mixed-suit descending joins now have a dashed right card edge. Tutorial and Settings > About explain temporary mixed stacks, movable same-suit runs and automatic same-suit K?A completion. Existing artwork and rank/suit corners remain visible. Completed runs retain the existing automatic clearing and set presentation.

Same-suit hint score rises from 30 to 100. Face-down reveal opportunities retain their scores and remain available when cycling hints. Historical candidate sets and gameplay behavior remain checked against the archived engine; only the old hint-score/order equality assertion was replaced by candidate-set equality.

Source hints use a solid outside outline; destinations use a stronger dashed outside outline. Source glow rises from 18 to 22px and outline from 2 to 2.4px; destination peak glow rises from 24 to 29px. Hint duration rises from 2200 to 2600ms. The visible and announced message identifies card count, source card/column and destination column. Mobile text wraps within the viewport, including when the target requires horizontal scrolling. OS and in-game reduced motion preserve static outlines; high-contrast outlines remain visible and keyboard focus styling is retained.

## Validation

| Gate | Result |
| --- | --- |
| Web build and strict verifier | PASS, 277 generated files |
| Native asset build | PASS |
| Full Node suite | 390 PASS; zero fail/skip/cancel/TODO |
| Mobile browser | 13 PASS; zero runtime errors |
| Multi-tab browser | 19 PASS |
| Solver browser | 24 PASS |
| Independent browser audit | 35 PASS, zero FAIL, errors and failedRequests empty |
| Playable/native bundled-browser acceptance | 16 PASS |
| Legacy offline compatibility | 46 PASS |
| New desktop/mobile hint browser probe | 8 PASS |
| git diff --check | PASS |

New deterministic tests cover all three modes: rank labels, equal/ascending/skipped rejection, immutable invalid selections, legal single-card cross-suit placement, same-suit groups, mixed-group rejection, completion identity including same-color different suits, full removal and undo reward high-water behavior, legal/prioritized hints and retained reveals, tap/drag/keyboard/one-tap consistency, and 2600ms lifecycle. Existing all-mode canonical save/reload/undo/daily/victory receipt tests continue to verify exactly-once rewards. Synthetic same-color completion rejection fixtures deliberately exercise suit identity even where a normal mode deck cannot contain that suit pair.

Full-suite logs and hint screenshots are under [evidence](evidence/ember-suit-hints/release-manifest.json). Additional structured browser evidence remains under `.phase2-backup/`. Chrome 156.0.8078.80, Node 24.22.0 on Windows. Initial sandbox/Chrome CDP transport timeouts were resolved by authorized reruns. Initial historical hint-score assertion failures were expected from the new scoring and corrected without removing candidate legality or state-conservation checks. A screenshot timing probe was corrected to measure in-page before screenshot overhead.

## Hint comparison

Before images reconstruct the exact b895c61 board stylesheet over the same current deterministic four-suit fixture; they compare visual treatment, not an execution of the entire historical application. Both use reduced motion, exposing the previous lack of a persistent source outline. After images show the final runtime. Ranks/artwork remain unobscured.

| View | Before | After |
| --- | --- | --- |
| Desktop 1280?900 | [Before](evidence/ember-suit-hints/before-1280.png) | [After](evidence/ember-suit-hints/after-1280.png) |
| Mobile 390?844 | [Before](evidence/ember-suit-hints/before-390.png) | [After](evidence/ember-suit-hints/after-390.png) |

Ads stay disabled by the existing compiled build flag and ads_enabled=false; no SDK/provider was enabled. Native bundle acceptance is browser-level shared-asset validation. Android/iOS device compilation, signing and distribution retain the baseline readiness limitations; no native binary release is claimed.

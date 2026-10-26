# Testing, source ownership and recovery

Updated October 25, 2026. Node 24 is the tested baseline. Built-in Node modules only; no install step. Earlier phase counts below are historical execution records; current Phase 3F results appear at the end.

## Structure and commands

Edit authoritative files under `site/`, keeping relative public paths intact. The Phase 2 migration preserved all 143 original files byte for byte, including binary assets; later approved source changes are tracked directly. `.gitattributes` disables text conversion for this tree to preserve bytes across checkouts. `dist/` is ignored generated output. Tests, fixtures, tools, audit documents, the original inventory and historical archive remain outside it.

From the repository root:

```powershell
node build.mjs
node tools/verify-source.mjs
node --test
```

The engine/persistence regression suites load `site/` directly and require no build output. The verifier integration tests inspect generated output; run the build before the full suite. All original defect assertions now run as ordinary tests. Any failing assertion makes the suite fail; no known-defect TODO markers remain.

## Build and verification

The build resolves paths relative to its script, snapshots regular source files, generates a content-derived game release with `tools/release.mjs`, writes a fresh unique staging directory and validates it before publishing. Validation checks every path and byte against the exact generated map from current `site/`, JavaScript syntax, JSON, routes, local references, generated card paths and service-worker core catalog paths. Missing, extra and edited output remain errors. Generated root wrappers, immutable release files and catalogs are intentional output rather than extra editable sources. Symlinks, special files and empty trees are rejected. The original archive must retain SHA-256 `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`; its USTAR integrity checks remain active. Historical source equality is reported as `baselineMatching`; approved source edits need not equal the historical application.

The verifier retains the original dist-relative inventory key format for direct comparison with `docs/BASELINE_INVENTORY.json`. That document is immutable historical evidence, including its original build/config hashes. Do not overwrite it with the new build hash.

Each successful rebuild renames existing output to a unique `.dist-backup-*` and then renames validated staging to `dist/`. Publication errors restore the previous output. Renames are on the same filesystem; there is a short interval between renames when dist is absent. A process/power interruption in that interval requires manual recovery from the retained backup. An exclusive `.build.lock` rejects concurrent builds. Failed staging is retained for inspection. Backups are intentionally not pruned automatically.

Static reference inspection has the same Phase 1 limits: tailored literal parsing is not a browser or complete parser. Arbitrary computed URLs, external requests, HTTP headers and live behavior are not certified. Application manifest evaluation uses an isolated VM. Archive validation is for trusted repository history, not an upload service.

## Vercel and rollback

`vercel.json` is unchanged: Other framework, no installation, `node build.mjs`, output `dist`, existing trailing slashes and headers. A checkout containing site, tools, archive and configuration builds with Node alone. Nothing was deployed.

Source rollback: preserve current edits, restore reviewed `site/` and matching build/generator/worker-protocol tooling, then build and verify. After Phase 3F, do not deploy a pre-3F worker as a production rollback: its cleanup and unversioned dependencies are incompatible with the new release policy. Follow [PHASE_3F_REPORT.md](PHASE_3F_REPORT.md) for safe compatible release rollback. Output rollback: with no build running, preserve current dist under a new name and rename the chosen `.dist-backup-*` to dist. Do not rebuild immediately unless source/tooling also match the desired release. For an interrupted build, inspect staging/backups, restore the desired output, and remove the lock only after confirming no builder is active.

Historical archive recovery: work in a disposable copy of the repository. Use the retained strict parser to write archive entries into a NEW recovery directory (never over edited site or dist):

```javascript
// Save as recover.mjs in the disposable repository root; run node recover.mjs.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { archiveFiles, hash } from './tools/verify-source.mjs';
const bytes = readFileSync('site-source.tar.gz');
if (hash(bytes) !== 'e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291') throw Error('Archive changed');
mkdirSync('archive-recovery'); // Fails if it already exists.
for (const [p, content] of archiveFiles(bytes)) {
  const target = resolve('archive-recovery', p.slice(5));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, { flag: 'wx' });
}
```

Compare the recovered 143 files to the historical inventory in the disposable copy. To execute that historical application/build, use its matching historical tooling there; the current compiler requires its new worker template. This is forensic recovery, not a production worker rollback. The migration's local `.phase2-backup/` additionally preserves original dist, archive, build script and preflight report. Original build extraction must only be run in a disposable directory because it overwrites existing output. Never erase player localStorage or roll back save data to roll back application files.

## Validation record

Preflight: branch `chore/repository-audit`; docs, tests, tools and dist were untracked. No tracked modifications. Archive/dist: 143 matching files; no changed, missing or stale files. Original suites: 24 tests, 20 pass, four expected failing TODOs, zero unexpected failures.

Phase 2: 143 source/output files match the historical baseline (8,496,965 bytes). All 23 syntax checks, two JSON checks, 421 local references, 131 precache references and nine public routes pass. Original passing tests and four defect TODOs are preserved. An additional build test covers a disposable checkout without dist, execution from another cwd, source/output byte equality, stale removal with retained backup, failed staging validation without publication, and lock rejection. No visual, gameplay, save-format or service-worker bytes changed.

## Engine and persistence fixtures

`tests/helpers.mjs` creates a fresh VM per scenario, loads the tracked production modules, fixes Date.now and supplies private in-memory localStorage. Debounced timers are inert; persistence tests explicitly call save(true). Storage exceptions are covered by Phase 3A tests. This does not test real timer scheduling or browser lifecycle flush delivery.

`tests/engine.test.mjs` covers 1/2/4-suit deck composition, unique IDs, initial visibility, deterministic seeds, legal and illegal moves, reveal/undo, gap and exhausted-stock rejection, deal order, stock restoration, history independence/cap, completed sequences and set high-water behavior. Seeded legal-play loops check live IDs plus completed-card accounting after each action and undo. Synthetic sequence fixtures isolate settlement; they do not represent a full browser victory.

`tests/fixtures/profile-v2.json` and `hand-v2.json` are synthetic sanitized v2 baselines, not real player exports or evidence of compatibility with every historic save. The hand fixture was frozen using this unchanged engine/store with seed 20261018 and one stock deal. Tests resume and round-trip progress/settings/daily records and the active hand/history, and verify input bytes remain unchanged. `corrupt-v2.json` isolates an invalid hand while retaining profile currency. Final-set and face-down fixtures are explicit reusable builders/card arrays in helpers and regression tests.

## Original regression status

`tests/regressions.test.mjs` now runs all four original F01/F02/F14 assertions as ordinary passing tests, with no TODO markers. See [Phase 3C report](PHASE_3C_REPORT.md). Assertions were preserved rather than inverted to accept defects.

| Finding | Intended result | Current reproduction |
| --- | --- | --- |
| F02 (fixed in Phase 3B) | One victory / 85 Ember after win, undo, replay | Passes; persistent per-hand settlement prevents duplicate rewards |
| F01 (fixed in Phase 3A) | Reject malformed active hand while preserving 321 Ember | Passes; raw original retained and replacement requires recovery confirmation |
| F14-A (fixed in Phase 3C) | Reject lift containing face-down second card | Passes; every selected card must be face-up |
| F14-B (fixed in Phase 3C) | Do not remove K-A sequence with face-down Ace | Passes; every completion candidate card must be face-up |

The original four regressions now pass. This does not close all audit findings. Earlier phase execution records remain historical.


## Browser functionality not tested

No browser tests were run in Phase 1. Before a later release, use a separate local/preview origin and disposable saves; never clear production player storage. Record actual browsers/devices and results for:

- Desktop navigation, mobile menu, portfolio dialogs, contact mail/clipboard and privacy.
- Fresh onboarding and existing-save resume; 1/2/4-suit play, selection, drag, keyboard, hints, undo, stock gaps, restart and abandon.
- Victory delay/undo/reload races, forge ceremonies, rewards, daily progression and local-midnight boundaries.
- 320/360/390px portrait, short landscape, long-column reachability, zoom, focus, screen readers and reduced motion.
- Offline install, interrupted requests, eviction, release A-to-B upgrades and existing tabs.
- Quota/denied storage, malformed/future saves, multi-tab conflicts and lifecycle save timing.
- Real Vercel routing, redirects, headers, CDN behavior, responsiveness/performance and native adapters.

These remain outstanding manual checks. Phase 2 changed source ownership/build tooling; Phase 3A adds save integrity/recovery. See the Phase 3A report for its specific browser checklist.
## Phase 3A persistence validation

Run the same build, verifier and full test commands above. Final Phase 3A suite: **78 tests, 75 pass, zero unexpected failures, three known failing TODOs**. Source/output parity remains 143 files; 138 retain historical archive bytes and five intentionally change. No historical inventory was rewritten.

New persistence tests inject read/write/quota failures and unavailable storage, validate save/hand/history boundaries, preserve valid v2 progress, exercise explicit recovery/import/reset backups and compare input fixture bytes before/after. Minimal DOM tests check event wiring/download data and confirmation boundaries; they do not certify browser layout or real downloads. The helper's inert timers still do not test actual debounce scheduling or lifecycle event delivery.

For recovery, use **Settings ? Save Recovery** or the persistent warning. Export the original before accepting a recovered profile; use the validated import preview to restore an exported v2 copy. Unsupported versions cannot overwrite themselves through autosave/reset. Local backups and quarantine keys are retained; no stored data is cleared automatically. Read-denied sessions stay protected until access is restored and the page can be safely reloaded after exporting memory. Full behavior, key names, results and remaining risks are in [PHASE_3A_REPORT.md](PHASE_3A_REPORT.md).

## Phase 3B victory validation

Run `node build.mjs`, `node tools/verify-source.mjs`, `node --test` and `git diff --check`. Final suite: **107 tests, 105 pass, zero unexpected failures, two known failing F14 TODOs**. The original F02 assertions pass without a TODO. Phase 3A coverage continues to pass.

`tests/victory.test.mjs` adds 29 deterministic victory tests covering every suit mode, duplicate/copy callbacks, undo/replay, reloads, new/restarted identities, daily/achievement/artifact side effects, legacy saves/imports, invalid receipts, failed storage/retries, reentrant writes and calculation-error rollback. Ceremony invocation is exercised with minimal DOM/service stubs; browser animation/timing remains unverified.

The additive `game.settlement` receipt remains in v2 and is outside undo history. Existing fixture bytes are unchanged; exact expected fixture objects now include the receipt and validate its generated ID. Legacy hands whose high-water mark reached eight are treated as already paid, including undone legacy wins. No existing balance or historical statistic is reduced. Victory state and receipt are saved in one full-profile write, with Phase 3A backups/protection/warnings retained.

See [PHASE_3B_REPORT.md](PHASE_3B_REPORT.md) for the lifecycle trace, compatibility policy, complete results, crash-consistency limits and manual browser checks. Multi-tab, F03/F04/F05 and F14 rule repairs remain separate.

## Phase 3C card-rule validation

Run `node build.mjs`, `node tools/verify-source.mjs`, `node --test`, `git diff --check` and `git status --short`. Final result: **152 tests, 152 pass, zero failures/TODOs/skipped/cancelled**. All Phase 3A/3B coverage and original regression assertions pass.

The only application edits are two engine conditions: movable rejects any face-down selected card, and checkSets requires all thirteen candidate cards to be face-up. Existing rank/suit comparisons, valid move semantics, rewards, save validation and settlement receipts are unchanged.

`tests/card-rules.test.mjs` adds 45 targeted checks for legal/invalid suffixes, all thirteen visibility positions, unchanged invalid state, multi-completions/reveal/undo, hints/search, 1/2/4-suit card conservation and historical valid-play equivalence. Canonical endgame fixtures verify solver moves, v2 reload and one daily/victory payout through Phase 3A/3B. Invalid synthetic positions are engine-only; no save checks were relaxed.

Verifier: **143 matching source/output files, zero errors**, 23 syntax checks, two JSON checks, 421 local references, 131 precache URLs and nine routes. Historical archive/inventory remain unchanged; 137 files still match archive bytes. Full details, remaining audit risks and the manual browser checklist are in [PHASE_3C_REPORT.md](PHASE_3C_REPORT.md). F03/F04/F05, broader input hardening and multi-tab/native/browser verification remain separate.

## Phase 3D gameplay lifecycle validation

Run `node build.mjs`, `node tools/verify-source.mjs`, `node --test`, `git diff --check` and `git status --short`. Final suite: **205 tests, 205 pass, zero failures/TODOs/skipped/cancelled**. All earlier rule, save/recovery and victory tests remain passing.

`tests/lifecycle.test.mjs` adds 53 deterministic cases using the fake clock/DOM/animation/worker adapters in `tests/lifecycle-helpers.mjs`. They execute actual board/UI/screen/ceremony/worker code and check exact mutations, side effects and resource bounds. Earlier helpers retain their inert scheduling for engine/store unit tests; the lifecycle suite explicitly advances callbacks/intervals/frames and microtasks, including obsolete callbacks retained after cancellation. This is not a real browser or native SDK timing test.

Board owns runtime display sessions, position revisions and cancellation epochs; those tokens are never saved. Manual input cancels auto-complete before applying an eligible action. Worker replies, animations, delayed notifications and victory presentation must retain ownership. Modal holds and foreground visibility govern a single performance.now-based clock; save/export flushes fractional elapsed time. Phase 3A safe writes and Phase 3B hand IDs/payout receipts are unchanged.

Build verification reports **143 matching source/output files, zero errors**, with 23 syntax checks, two JSON checks, 421 local references, 131 precache URLs and nine routes. The historical archive/inventory remain unchanged; 132 files still match archive bytes. See [PHASE_3D_REPORT.md](PHASE_3D_REPORT.md) for the pre-change map, implementation, clock/cancellation policy, complete test coverage and manual browser checklist. F03, multi-tab conflicts, broader accessibility and search-performance/heuristic work remain separate.

## Phase 3E mobile and accessibility validation

Run `node build.mjs`, `node tools/verify-source.mjs`, `node --test`, `git diff --check` and `git status --short`. Final suite: **245 tests, 245 pass, zero failures/TODOs/skips/cancellations**. All original 205 Phase 3D tests remain passing; 40 new deterministic cases cover mobile geometry, validated 25/45-card columns, touch ownership and thresholds, both scroll axes and edge scrolling, cancellation/lifecycle transitions, keyboard/native column and run controls, announcements and nested modal focus/isolation/restoration. Existing assertions were not weakened.

The optional `node tools/mobile-browser.mjs after` audit uses built-in Node modules, an installed Windows Chrome (or `CHROME_PATH`), a local static server and a fresh disposable profile. No package install or normal player browser profile is used. It captures seven viewport sizes, narrow screens/ceremonies/recovery, enlarged cards and 200% CSS zoom. CDP touch/keyboard checks exercise actual browser scrolling, dragging and modal focus; failed flow assertions exit nonzero. `before` serves committed HEAD rather than working-tree changes. Reinterpret that baseline after a future commit. Screenshots/JSON are ignored local evidence under `.phase2-backup/phase3e-browser/`; the script is tracked and evidence is reproducible.

Build/verifier: 143 matching source/output files, zero errors; 129 retain historical archive bytes. Archive/inventory, engine/save/settlement semantics, artwork and Vercel/service-worker configuration are unchanged. Touch scrolling is the default; deliberately enable Touch: drag for touch dragging. Visible numbered columns and More/Fewer/Cancel controls supplement keyboard shortcuts and preserve accessible alternatives without a broad application role.

Executed browser: headless Chrome 155.0.8059.86 on Windows with viewport/touch emulation. This does not certify physical Safari/Android behavior, screen-reader speech, OS large text, real browser toolbar zoom or WCAG conformance. The remaining release checks and exact evidence paths are in [PHASE_3E_REPORT.md](PHASE_3E_REPORT.md) and [MOBILE_TEST_MATRIX.md](MOBILE_TEST_MATRIX.md).

## Phase 3F offline and release validation

Run all five required commands: `node build.mjs`, `node tools/verify-source.mjs`, `node --test`, `git diff --check`, `git status --short`. Current suite: **277 tests, 277 pass, zero failures/TODOs/skips/cancellations**, including all prior 245. `tests/offline.test.mjs` adds 32 deterministic generator/worker/update tests. Engine/store regressions still read tracked source independently of dist; build/verifier integration tests regenerate and compare the approved output format. Build tests include a disposable checkout with no dist, a different working directory, stale removal/backup, validation refusal and lock protection.

Run the release-blocking browser suite separately:

```powershell
node tools/offline-browser.mjs
```

It needs installed Chrome (default Windows path, or CHROME_PATH), Node 24, a loopback port and permission to launch the browser. It installs no packages. Its fresh temporary profile never touches a normal player profile. The local server switches generated A/B/C/D releases on the same origin. A separate isolated partition runs the actual historical archived worker, then upgrades at that same origin. A different-origin preview is not equivalent evidence.

Final browser result: **41 passing checks**, Windows headless Chrome 155.0.8059.86. Loaded scripts/CSS are checked by immutable URL, byte hash and runtime marker; an actual dedicated worker reports its engine identity. Checks include offline core/root/index/privacy/unknown routes, deferred unfinished-hand upgrade, failed protected save, old A under B control, native Chromium quota exhaustion, injected actual-worker Cache.put failure, optional HTTP 404/500, partial/whole eviction repair, failed/interrupted installation, cache retirement, unrelated-cache retention, protected historical migration with saved progress/recovery, and same-document skip-link focus. Fault injection is distinguished from native quota behavior. No production game markers are added.

Ignored evidence: `.phase2-backup/phase3f-browser/summary.json`, `browser.json`, screenshots `a-offline.png`, `update-save-blocked.png`, `legacy-upgraded-b.png`; unsuccessful runs write `failure.json`/`failure.png` which may remain from earlier attempts. Node/verifier logs are `.phase2-backup/phase3f-node-tests.txt` and `phase3f-verification.json`. The tracked harness reproduces the evidence; it exits nonzero on a failed assertion and closes its isolated browser.

Final build/verifier: **277 exact generated files from 144 source files**, 44 syntax checks, five JSON checks, 500 references, 74 core entries / **2,624,670 bytes**, nine routes, zero errors. Historical archive/inventory remain immutable; 128 original source files still match archive bytes. The ID hashes relevant source and compiler content, so subsequent source edits intentionally change it. Repeat builds with unchanged inputs retain the same paths/bytes.

Default spades, default back/iron table, fonts and required forge environments form the core. Other suits/themes/high-resolution art require on-demand caching or explicit Download all artwork for that release. Settings > Offline & Updates exposes approval/deferral, repair and Save Recovery. Browser eviction can remove offline capability; matching online repair restores current files, while absent old deployed bytes fail closed. Neither caching nor update compatibility solves multi-tab progression conflicts. Never clear site/player data as an update step.

The same-origin Chrome gate passes. Physical Safari/installed-PWA/Android lifecycle, screen-reader announcements, OS storage pressure and real Vercel routing/headers still need manual production approval checks. Read [OFFLINE_RELEASE_MATRIX.md](OFFLINE_RELEASE_MATRIX.md) for exact promises and [PHASE_3F_REPORT.md](PHASE_3F_REPORT.md) for first-migration, retention, compatible rollback and release-readiness details. No commit, merge, push or deployment was performed.

## Phase 4 independent certification assessment

The merged Phase 3F baseline was independently reproduced: **277 Node tests**, **13 mobile browser checks**, **41 same-origin offline upgrade checks**, build and strict source verification pass. See [phase4/RELEASE_AUDIT.md](phase4/RELEASE_AUDIT.md) and [phase4/GO_NO_GO.md](phase4/GO_NO_GO.md). All four distribution channels currently receive **NO-GO**; a stale second tab can overwrite newer progress and its backup, and required production/device evidence remains missing.

The added `tests/phase4-audit.test.mjs` contributes four probes; final full suite is **281/281 executions passing**. Three explicitly labeled OBSERVED DEFECT probes pass by reproducing current data loss, not by certifying it safe; the fourth adds sampled legal-play/save invariants. Original regressions are unchanged. A remediation branch must replace the observed-loss expectations with preservation/refusal requirements after the approved fix.

Run the independent generated-output browser audit after building:

```powershell
node tools/phase4-browser.mjs
```

It uses the existing isolated Chrome/CDP helper, no packages, synthetic saves and generated dist. Final results: **18 PASS and four unresolved FAIL observations** (actual two-tab loss, dynamic reduced-motion canvas, Later focus, false optional-download readiness). A successful runner exit means observations were collected; it does not mean FAIL gates passed. Runner exceptions exit nonzero. Fixed seeds avoid assuming every random opening has an immediate move. Recorded solver timing includes the actual scheduled Board path and RAF/long-task evidence; lab measurements are not real-user INP.

Evidence lives in ignored `.phase2-backup/phase4/`, indexed by `evidence-index.json`, with baseline/final logs, browser summaries/screenshots, native adapter probes and performance data. The supplied Vercel main preview required authentication and was inaccessible to the connected project; deployment commit/bytes/headers/CDN remain NOT TESTED. No protection settings were changed. Physical Safari/Android/PWA and human assistive-technology checks remain separate. Production code/configuration, archive and baseline inventory were not modified during the audit; no deployment, advertising activation or source-control action was performed.

## Phase 4.1 multi-tab remediation

Current result: **304 Node tests pass**, zero failures/TODOs/skips. The three Phase 4 loss probes now require preservation/refusal; original pre-fix results remain in `.phase2-backup/phase4-1/pre-remediation.log` and the retained audit evidence. New deterministic cases exercise shared exclusive locks, read-only/unsupported/pending/rejected states, timing/conflicts, all replacement paths and guarded native restore. Single-context fixtures explicitly provide a granted lock; production has no bypass.

After build/verifier/full Node checks, run `node tools/mobile-browser.mjs after`, `node tools/offline-browser.mjs`, and the new release gate `node tools/multitab-browser.mjs`. Final Chrome results: **13 mobile, 42 offline and 19 multi-tab checks pass**. The real multi-tab gate verifies exact primary/backup values, future/local recovery copies, visible warning/export controls, the confirmed recovery-dialog handoff, reload, actual renderer crash releasing ownership, unsupported API and one victory payout across replay.

Run the independent assessment without overwriting its original evidence:

```powershell
$env:HFS_PHASE4_EVIDENCE='.phase2-backup/phase4-1/independent'
node tools/phase4-browser.mjs
git diff --check
git status --short
```

It now records **19 PASS / 3 known FAIL observations**: stale-tab preservation passes; existing offline-readiness/motion/Later-focus defects remain outside this remediation. The runner's exit code is not a waiver for those FAIL gates. New evidence is ignored under `.phase2-backup/phase4-1/`, indexed separately. Report and support/rollback boundaries: [phase4/P4_01_REMEDIATION_REPORT.md](phase4/P4_01_REMEDIATION_REPORT.md). Functional secure-context Web Locks are mandatory for editing; unsupported browsers fail closed. Drain pre-4.1 tabs before rollout, and never roll back to uncoordinated Store code or an incompatible historical worker. No cross-device sync, native durability or public launch certification is claimed.

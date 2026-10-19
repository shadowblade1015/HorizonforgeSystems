# Phase 2 testing, source ownership and recovery

October 18, 2026. Node 24 is the tested baseline. Built-in Node modules only; no install step.

## Structure and commands

Edit authoritative files under `site/`, keeping relative public paths intact. The 143 migrated files retain their original bytes, including binary assets. `.gitattributes` disables text conversion for this tree to preserve bytes across checkouts. `dist/` is ignored generated output. Tests, fixtures, tools, audit documents, the original inventory and historical archive remain outside it.

From the repository root:

```powershell
node build.mjs
node tools/verify-source.mjs
node --test tests/*.test.mjs
```

The engine/persistence regression suites load `site/` directly and require no build output. The verifier integration tests inspect generated output; run the build before the full suite. TODO assertions still express intended behavior and fail as documented below; they do not make Node exit nonzero. An unexpectedly passing TODO requires investigation.

## Build and verification

The build resolves paths relative to its script, snapshots regular source files, writes a fresh unique staging directory and validates it before publishing. Validation checks byte parity against current `site/`, JavaScript syntax, JSON, routes, local references, generated card paths and service-worker precache paths. Symlinks, special files and empty trees are rejected. The original archive must retain SHA-256 `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`; its USTAR integrity checks remain active. Historical archive equality is reported as `baselineMatching`, while current source/output equality is enforced. Future approved source edits need not equal the historical application.

The verifier retains the original dist-relative inventory key format for direct comparison with `docs/BASELINE_INVENTORY.json`. That document is immutable historical evidence, including its original build/config hashes. Do not overwrite it with the new build hash.

Each successful rebuild renames existing output to a unique `.dist-backup-*` and then renames validated staging to `dist/`. Publication errors restore the previous output. Renames are on the same filesystem; there is a short interval between renames when dist is absent. A process/power interruption in that interval requires manual recovery from the retained backup. An exclusive `.build.lock` rejects concurrent builds. Failed staging is retained for inspection. Backups are intentionally not pruned automatically.

Static reference inspection has the same Phase 1 limits: tailored literal parsing is not a browser or complete parser. Arbitrary computed URLs, external requests, HTTP headers and live behavior are not certified. Application manifest evaluation uses an isolated VM. Archive validation is for trusted repository history, not an upload service.

## Vercel and rollback

`vercel.json` is unchanged: Other framework, no installation, `node build.mjs`, output `dist`, existing trailing slashes and headers. A checkout containing site, tools, archive and configuration builds with Node alone. Nothing was deployed.

Source rollback: preserve current edits, restore a reviewed prior `site/` revision, then build and verify. Output rollback: with no build running, preserve current dist under a new name and rename the chosen `.dist-backup-*` to dist. Do not rebuild immediately unless source also matches the desired release. For an interrupted build, inspect staging/backups, restore the desired output, and remove the lock only after confirming no builder is active.

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

Compare the recovered 143 files to the historical inventory before selecting them as site in the disposable copy; build and run all checks there. The migration's local `.phase2-backup/` additionally preserves original dist, archive, build script and preflight report. Original build extraction must only be run in a disposable directory because it overwrites existing output. Never erase player localStorage or roll back save data to roll back application files.

## Validation record

Preflight: branch `chore/repository-audit`; docs, tests, tools and dist were untracked. No tracked modifications. Archive/dist: 143 matching files; no changed, missing or stale files. Original suites: 24 tests, 20 pass, four expected failing TODOs, zero unexpected failures.

Phase 2: 143 source/output files match the historical baseline (8,496,965 bytes). All 23 syntax checks, two JSON checks, 421 local references, 131 precache references and nine public routes pass. Original passing tests and four defect TODOs are preserved. An additional build test covers a disposable checkout without dist, execution from another cwd, source/output byte equality, stale removal with retained backup, failed staging validation without publication, and lock rejection. No visual, gameplay, save-format or service-worker bytes changed.

## Engine and persistence fixtures

`tests/helpers.mjs` creates a fresh VM per scenario, loads the unchanged production modules, fixes Date.now and supplies private in-memory localStorage. Debounced timers are inert; persistence tests explicitly call save(true). This does not test real timer scheduling, storage exceptions or lifecycle flushes.

`tests/engine.test.mjs` covers 1/2/4-suit deck composition, unique IDs, initial visibility, deterministic seeds, legal and illegal moves, reveal/undo, gap and exhausted-stock rejection, deal order, stock restoration, history independence/cap, completed sequences and set high-water behavior. Seeded legal-play loops check live IDs plus completed-card accounting after each action and undo. Synthetic sequence fixtures isolate settlement; they do not represent a full browser victory.

`tests/fixtures/profile-v2.json` and `hand-v2.json` are synthetic sanitized v2 baselines, not real player exports or evidence of compatibility with every historic save. The hand fixture was frozen using this unchanged engine/store with seed 20261018 and one stock deal. Tests resume and round-trip progress/settings/daily records and the active hand/history, and verify input bytes remain unchanged. `corrupt-v2.json` isolates an invalid hand while retaining profile currency. Final-set and face-down fixtures are explicit reusable builders/card arrays in helpers and regression tests.

## Known defects: intended behavior fails

`tests/regressions.test.mjs` executes four TODO tests, each asserting the desired behavior. Do not invert assertions to accept defects.

| Finding | Intended result | Current reproduction |
| --- | --- | --- |
| F02 | One victory / 85 Ember after win, undo, replay | Two victories / 160 Ember; set reward remains high-water protected |
| F01 | Reject malformed active hand while preserving 321 Ember | `{cols:[]}` accepted as game |
| F14 | Reject lift containing face-down second card | Run accepted |
| F14 | Do not remove K-A sequence with face-down Ace | Sequence removed |

Remove TODOs when fixes land in later phases, then require these assertions to pass. No production fix belongs to Phase 1.


## Browser functionality not tested

No browser tests were run in Phase 1. Before a later release, use a separate local/preview origin and disposable saves; never clear production player storage. Record actual browsers/devices and results for:

- Desktop navigation, mobile menu, portfolio dialogs, contact mail/clipboard and privacy.
- Fresh onboarding and existing-save resume; 1/2/4-suit play, selection, drag, keyboard, hints, undo, stock gaps, restart and abandon.
- Victory delay/undo/reload races, forge ceremonies, rewards, daily progression and local-midnight boundaries.
- 320/360/390px portrait, short landscape, long-column reachability, zoom, focus, screen readers and reduced motion.
- Offline install, interrupted requests, eviction, release A-to-B upgrades and existing tabs.
- Quota/denied storage, malformed/future saves, multi-tab conflicts and lifecycle save timing.
- Real Vercel routing, redirects, headers, CDN behavior, responsiveness/performance and native adapters.

These remain outstanding manual checks. Phase 2 changes only source ownership and build tooling.
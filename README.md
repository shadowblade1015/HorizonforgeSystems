# Horizon Forge Systems

Portfolio website and playable Ember Solitaire web beta. Node 24 is the tested baseline; no package installation or runtime dependencies are required.

## Source and local development

- `site/`: authoritative HTML, CSS, JavaScript, artwork, fonts and game assets. Edit files here, preserving public relative paths.
- `dist/`: generated deployment output, ignored by Git. Builds replace it; do not edit it.
- `build.mjs`: script-relative staging, validation and output replacement.
- `tools/release.mjs`: deterministic game release identity, immutable assets and generated worker catalog.
- `tests/`, `tools/`, `docs/`: regression fixtures, verification and audit/history.
- `site-source.tar.gz`: preserved historical 143-file baseline, no longer the editable source.

Run from the repository root:

```powershell
node build.mjs
node tools/verify-source.mjs
node --test
node tools/offline-browser.mjs
```

Build and verification resolve project paths relative to their scripts. Tests load application modules from `site/`. The separate offline browser harness needs installed Chrome (or `CHROME_PATH`), creates an isolated profile, and tests A-to-B upgrades on one local origin. No packages are needed. All original defect regressions now pass; no TODO tests remain. See [testing and rollback](docs/TESTING.md).

Edit game files in `site/ember-solitaire/`, then rebuild. Generated HTML binds scripts, CSS and worker imports to `/ember-solitaire/_releases/<content hash>/`; do not edit those generated paths. Settings > Offline & Updates offers deferred/protected updates, core repair, optional artwork download and Save Recovery. Core offline play covers the default one-suit mode; extra artwork needs cached downloads. Browser storage can be evicted. See the [offline capability matrix](docs/OFFLINE_RELEASE_MATRIX.md) and [Phase 3F report](docs/PHASE_3F_REPORT.md) for tested guarantees and remaining manual checks.

## Vercel

Import the repository using Framework Preset **Other**, Build Command **node build.mjs**, Output Directory **dist**, and an empty Install Command. Existing `vercel.json` remains unchanged, including routes and headers. Include `site/`, tools, tests, docs and configuration in the eventual reviewed commit. No deployment was performed during migration.

## Rollback

Each successful rebuild retains the preceding output in `.dist-backup-*`. The migration also preserves original output, archive and build script in `.phase2-backup/`. These are local ignored recovery copies, not part of a clean checkout. Preserve them until review is complete.

To roll back source, preserve current work, restore the reviewed `site/` revision and matching build/release tooling, then rebuild and verify. Follow the [Phase 3F release procedure](docs/PHASE_3F_REPORT.md) for compatible worker rollbacks. Do not deploy the historical pre-3F worker as a rollback; it can delete newer release caches and reintroduce mixed assets. Archive extraction is disposable forensic recovery as described in [docs/TESTING.md](docs/TESTING.md). Do not overwrite edited source or clear player storage. Ads remain disabled; saves use the unchanged browser-local `ember.save.v2` format.

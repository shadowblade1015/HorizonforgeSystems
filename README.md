# Horizon Forge Systems

Portfolio website and playable Ember Solitaire web beta. Node 24 is the tested baseline; no package installation or runtime dependencies are required.

## Source and local development

- `site/`: authoritative HTML, CSS, JavaScript, artwork, fonts and game assets. Edit files here, preserving public relative paths.
- `dist/`: generated deployment output, ignored by Git. Builds replace it; do not edit it.
- `build.mjs`: script-relative staging, validation and output replacement.
- `tests/`, `tools/`, `docs/`: regression fixtures, verification and audit/history.
- `site-source.tar.gz`: preserved historical 143-file baseline, no longer the editable source.

Run from the repository root:

```powershell
node build.mjs
node tools/verify-source.mjs
node --test tests/*.test.mjs
```

Build and verification resolve project paths relative to their scripts. Tests load application modules from `site/`. See [testing and rollback](docs/TESTING.md) for validation scope and four documented defect TODOs.

## Vercel

Import the repository using Framework Preset **Other**, Build Command **node build.mjs**, Output Directory **dist**, and an empty Install Command. Existing `vercel.json` remains unchanged, including routes and headers. Include `site/`, tools, tests, docs and configuration in the eventual reviewed commit. No deployment was performed during migration.

## Rollback

Each successful rebuild retains the preceding output in `.dist-backup-*`. The migration also preserves original output, archive and build script in `.phase2-backup/`. These are local ignored recovery copies, not part of a clean checkout. Preserve them until review is complete.

To roll back source, restore the desired reviewed `site/` revision and rebuild. To return to the historical archive, follow the archive recovery procedure in [docs/TESTING.md](docs/TESTING.md). Do not overwrite edited source or clear player storage. Ads remain disabled; saves use the unchanged browser-local `ember.save.v2` format.

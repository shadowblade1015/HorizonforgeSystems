# Phase 3A — Save Integrity and Recovery

Implemented October 20, 2026. Scope: F01, single-tab web persistence failures in F08, and the save/import validation boundary relevant to F14.

## Files modified

- `site/ember-solitaire/js/store.js`: v2 profile/hand validation, independent profile recovery, raw quarantine, protected writes, retained last-good backup, persistence events, validated export/import, and reset protection.
- `site/ember-solitaire/js/ui.js`: persistent warning, Save Recovery dialog, download controls, validated file preview and explicit import/recovery confirmation. Select controls join the existing sheet focus selector.
- `site/ember-solitaire/js/screens.js`: Settings recovery entry; reset reports failure and keeps progress when protection/storage prevents replacement.
- `site/ember-solitaire/js/app.js`: mounts the persistence indicator after loading.
- `site/ember-solitaire/css/base.css`: limited styling for the new storage warning, below modal overlays.
- `tests/helpers.mjs`: controllable storage failures and isolated UI globals.
- `tests/engine.test.mjs`: the history-cap persistence test now uses a complete 104-card hand instead of a deliberately incomplete one-card hand. Its assertions are unchanged.
- `tests/regressions.test.mjs`: F01 is an ordinary passing regression; F02 and both rule-level F14 TODOs remain unchanged.
- `tests/persistence.test.mjs` and `tests/recovery-ui.test.mjs`: save/recovery/storage regression coverage and minimal DOM event-wiring tests.
- `docs/TESTING.md` and this report: current validation and manual recovery instructions.

No engine/reward logic, monetization, service worker, Vercel configuration, historical archive, baseline inventory or fixture contents were changed. Generated dist is rebuilt, not edited.

## Validation and compatibility

The key and schema remain `ember.save.v2`, version 2. Missing optional fields use the existing defaults. Existing valid currency, statistics, artifact progress, completed records, settings and daily records are retained; values are not coerced, clamped or retroactively recalculated. Counters are finite, nonnegative safe integers; elapsed/play/forge durations permit finite fractional milliseconds. Aggregate counters are not forced to agree with each other: historic F02 overpayments and older partial profiles must not have earned progress reduced.

Only supported v2 data is activated. Other versions (including newer versions and unversioned data), malformed JSON, null and arrays stay protected. There is no inferred migration for an unknown schema.

Hands require 1/2/4 suits, ten columns, canonical deck identities matching rank/suit, unique cards, 104-card accounting including completed runs, balanced removed sequences, valid face-up suffixes, face-down stock in batches of ten, bounded completion/high-water values and valid bookkeeping. Undo snapshots are separately validated, ordered by move number, retain card identity/visibility continuity, and cannot increase stock or decrease completed runs going forward. Optional restart layouts must describe a complete initial deal. Histories remain capped at 60 in memory and 20 in saved/exported files. These checks establish structural consistency, not proof that every position is reachable through legal play or an anti-cheat system.

Known malformed fields and records are excluded from the recovery candidate. Valid siblings remain available, including currency/statistics independent of a damaged hand. Invalid maps/records cannot drive forge rendering. Their exact original representation is retained for inspection rather than silently rewritten.

## Recovery behavior

The raw string is retained in memory before parsing. Invalid/unsupported saves are copied verbatim into a unique `ember.save.v2.recovery.<timestamp>.<counter>` key when storage permits. The active save is never replaced automatically during recovery, including by splash, debounce or lifecycle saves. If quarantine fails, the active raw save stays protected and its in-memory original remains exportable while the page is open.

A supported profile with recoverable fields/bad hand is available in memory. Use **Settings → Save Recovery** (also available in the warning banner), export the original, then explicitly confirm **Use recovered progress**. Replacement requires a retained, verified raw recovery copy. Unsupported versions/malformed JSON cannot use this action. A separately validated v2 import can replace them only after explicit replacement confirmation.

The dialog exports current valid progress, this session's original raw save, the last-good backup, or a selected retained recovery copy. Current exports are ordinary v2 JSON and imports validate before replacement. Files are limited to 5 MB in the browser chooser. The preview shows currency/wins; confirmation replaces rather than merges. Both existing disk data and current memory are quarantined first. Failed import/backup/reset steps leave active progress intact. Imports pause the old board before returning home.

Before ordinary replacement, the prior valid raw save is written to `ember.save.v2.backup`. Failure to retain that backup aborts the write. Primary write/serialization/storage failures leave memory playable and show a persistent unsaved warning, including during pending retries. A successful local write clears it and advances savedAt. Missing/throwing/unreadable localStorage blocks unknown-data replacement. For a read-denied session, restore browser access and reload only after exporting in-memory progress; Retry does not blindly assume the inaccessible save is empty.

Explicit reset now archives both stored and in-memory progress before replacement; it does not delete recovery keys or other user storage. Reset is blocked while an original needs recovery. No automatic storage clearing or backup pruning occurs.

## Automated results

Final commands:

```powershell
node build.mjs
node tools/verify-source.mjs
node --test tests/*.test.mjs
```

Final suite: **78 tests; 75 pass, 0 unexpected failures, 3 expected failing TODOs; no skipped/cancelled tests**. F01 passes without a TODO. F02 victory duplication and both F14 pure-rule defects remain documented expected failures.

Coverage includes malformed JSON, empty/null/array saves, unsupported/missing versions, incomplete/duplicated/invalid cards, history corruption, invalid restart metadata, profile fields/maps, all supported suit modes, fractional timers, v2 round trips, quarantine failure/retry, denied reads/writes and unavailable storage, serialization failure, backup/primary write failure, explicit import/reset preservation, retained-copy export and persistence events. Minimal DOM tests exercise the warning, original download bytes, recovery confirmation, invalid import rejection and valid preview without premature replacement. They do not replace real-browser tests.

Build/verifier: **143 source files match 143 generated files**, zero changed/missing/stale output, **23 syntax checks**, **2 JSON checks**, **421 local references**, **131 precache URLs**, and **9 route URLs**. **138 files** remain byte-identical to the historical archive; the five application changes are the store/UI/boot/settings/CSS files listed above. Historical archive SHA-256 remains `e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291`.

Fixture tests compare working-copy input bytes before and after. The frozen SHA256 records contain mixed newline conventions: the profile/corrupt working copies match their recorded hashes, while the tracked hand-v2.json blob matches its recorded hash. In this existing Windows checkout, hand-v2.json has a CRLF final newline while its committed blob has LF (one byte difference); normalizing that pre-existing newline matches the recorded hash. All three fixture contents match HEAD after accounting for existing Git newline conversion. No fixture was rewritten to make a check pass. Historical inventory/archive are unchanged against HEAD.

## Remaining risks and manual browser checks

- Multi-tab conflict detection/last-writer arbitration remains deferred. Use one tab during recovery/import. These backups do not constitute transactional cross-tab coordination.
- F02 reward idempotence and both F14 engine predicates remain unfixed. Saved/imported malformed visibility is rejected, but pure rule functions still need their separate fixes.
- Existing F04/F05 asynchronous/lifecycle issues remain outside this change. Existing F03 offline update behavior can serve older cached scripts; no service-worker version/cache policy was changed.
- LocalStorage durability is only acknowledged for a synchronous successful web write. Native Preferences hydration/mirroring, OS eviction, browser termination before a debounce flush, downloads, quota limits and physical disk durability need device testing. Native bridge persistence behavior was not repaired or certified here.
- Full/quota-denied storage may prevent both backups and new saves; export memory before closing. Recovery keys intentionally accumulate; no automatic deletion policy was added. Export failure on a browser without download support leaves the page/data intact and reports failure.
- Recovery may exclude damaged fields/records, so export and review the original before confirming. It never invents missing historic earnings. Restoring an older imported profile can intentionally replace newer progress, but retained copies provide recovery; it does not merge balances.

Use a separate local/preview origin and disposable profiles, never production player storage:

1. Resume known v2 1/2/4-suit saves; compare currency, artifacts, statistics, daily ledger, settings and active hand after reload. Test tutorial/restart metadata, undo history and a won hand.
2. Load malformed JSON, duplicate/incomplete cards and unsupported versions. Check the warning on splash/home/game, raw quarantine equality, protected pagehide/visibility saves, original export, explicit recovery and reload.
3. Deny localStorage or exhaust quota. Check visible warning, repeated retry, downloadable memory, restored-access behavior and last-good backup. Verify failures do not show a reset/success toast.
4. Export/reimport valid saves on desktop Chrome/Edge and mobile Safari/Chrome; cancel dialogs/file selection, reject bad/future files, confirm replacement and recover previous disk/memory copies. Verify file downloads actually contain the expected raw bytes.
5. Check narrow screens/zoom, focus order, screen-reader announcements, keyboard file/select controls, nested confirmations, warning overlap and recovery dialog scrolling. Minimal DOM tests cannot establish visual/accessibility parity.
6. Test fresh/old service-worker clients and actual Vercel preview routing separately before a release. Existing offline-update risks are not fixed by the successful static build.

No deployment, commit, push or merge was performed. Phase 3A stops here.

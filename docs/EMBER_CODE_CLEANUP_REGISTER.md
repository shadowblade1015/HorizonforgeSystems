# Ember cleanup register

November 3, 2026. Scope is the playable branch derived from Phase 4.4. Historical engineering reports, archived source and other Horizon Forge projects are retained.

| Area | Evidence/classification | Action |
| --- | --- | --- |
| Download All Artwork page code | Removed control had one downloadAll handler/API and UI-only capability prose | Removed handler/control/export and obsolete all-mode offline messages; retained worker DOWNLOAD for existing clients |
| Routine offline banner | Appended fixed-position aside surfaced on routine checks | Moved region into Settings, hidden until opened, replaced fixed layout with normal flow |
| Automatic PREPARE | Not present in certified baseline; no cherry-pick | Absent on this branch; experimental worktree remains intact |
| Fake-ad query route | ads=mock bypassed disabled-provider state and created synthetic reward ads | Removed renderer/branches/query activation and two now-unreferenced mock-ad CSS rules in screens.css |
| Analytics/crash startup | Native flags could enable transmission before independent privacy decisions | Disabled transmission unconditionally; local diagnostic ring retained |
| Native Preferences | Fire-and-forget writes and timestamp-based hydration could hide unsaved/conflicting data | Repaired with ordered verified acknowledgements, raw preservation and whole-profile conflict refusal; actual device durability remains untested |
| Duplicate lifecycle registration | Platform.init previously added native listeners on each call | Added idempotence; optional plugin listener failures cannot block play |
| Native build tooling references | Source mentioned build_www.js/release.config.json; neither exists in certified checkout or packaged source listing | Added actual build-native.mjs and corrected active comments; preserved historical reports verbatim |
| Native bridge plugins | App/Preferences/Haptics/StatusBar/SplashScreen/ScreenOrientation previously lacked native project/dependency implementation | Added official plugins; AdMob/Firebase remain absent and disabled, explicitly reported rather than pretending implementation |
| Core modules | Engine/Store/Board/solver/Audio/FX/UI/Tutorial/Manifest/Artifacts have active script loading and call sites | Retained; no engine clone or framework introduced |
| Recovery, locks, receipts | Active integrity/ownership/exactly-once regression coverage | Retained and extended; no deletion or bypass |
| Web worker/cache protocol | Existing clients can remain controlled by certified worker | Retained byte-for-byte, including SHA-256, immutable paths and cache retirement. Removing registration is deferred; no storage-clearing migration |
| Assets | Catalog/Manifest reference normal/high-res suit art, themes, previews, fonts and branding | Retained. No asset labeled obsolete from filename alone. Template launcher icons replaced with existing Ember identity; launch-screen polish remains native work |
| Demo/diagnostic routes | Other Horizon Forge pages, screen/debug selectors and archived reports may serve support/testing | Retained unless independently proven dead. Removing unrelated projects is outside scope |
| Configuration | Existing gameplay tuning remains consumed; provider activation now requires disabled compiled flag too | ads_enabled defaults false. No production ad scripts/IDs or unnecessary framework dependencies added. Further version metadata consolidation is deferred until release automation is scoped |
| Dependencies | Web gameplay remains buildless and dependency-free at runtime; native uses Capacitor and six required official plugins | Versions pinned/locked, npm audit clean. CLI transitive tooling is development-only |

No broad dead-code or CSS purge was attempted. Removal is limited to independently identified UI/renderer call paths; strict archive/source verification and original unrelated tests remain. Native source/config generation is reviewable scaffolding, not deletion-based remediation.

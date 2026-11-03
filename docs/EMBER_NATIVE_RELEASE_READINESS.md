# Ember native release readiness

November 3, 2026. **BLOCKED for Google Play and App Store distribution.** Android/iOS source projects and repeatable asset builds exist; successful native compilation and device validation do not.

## Reproduce

From the playable worktree with Node >=22:

```powershell
npm ci
npm run build:web
npm run build:native
npx cap sync
android/gradlew.bat -p android assembleDebug
```

The Android command was attempted and failed before compilation: JAVA_HOME is not set and java is unavailable. Its log is `.phase2-backup/playable/android-debug.log`. Android SDK and adb are absent too. Once JDK/SDK are installed, expected output is `android/app/build/outputs/apk/debug/app-debug.apk`; that file has not been produced or tested here. Gradle wrapper 8.14.3 / Android Gradle Plugin 8.13.0, min SDK24 and compile/target SDK36 come from the pinned Capacitor 8.6.0 template. Confirm with a real build, not inference from these files.

On macOS, run npm ci, build:native and cap sync, then open `ios/App/App.xcodeproj` in Xcode, resolve its SPM packages and select an iPhone/iPad simulator. Capacitor 8 requires Xcode 26+; see [official environment setup](https://capacitorjs.com/docs/getting-started/environment-setup). Signed device/archive builds additionally need the publisher's Apple team, provisioning and bundle registration. None was requested, created or used here.

App ID/bundle ID: `com.horizonforgesystems.embersolitaire`, display name Ember Solitaire, version 2.1.0/build21. This is configured source metadata, not proof of identifier ownership or store approval. Android target36 matches the current new-app/update requirement effective August 31, 2026; recheck [Google Play's policy](https://support.google.com/googleplay/android-developer/answer/11926878) at submission.

## Completed locally

- Exact package versions and lockfile; Capacitor core/Android/iOS/CLI 8.6.0, App 8.1.2, Preferences 8.0.1, Haptics/SplashScreen/ScreenOrientation 8.0.2, StatusBar 8.0.4. npm audit has zero known findings after upgrading initial v8.0 dependencies. There are no Firebase, AdMob or AdSense runtime packages.
- Independent web dist and native www outputs. Native copies the shared source/assets, strips web registration, injects disabled native build configuration, and keeps relative worker/font/privacy paths. No Vercel gameplay dependency or remote server URL is configured. Build tests compare complete output paths/hashes across two builds.
- Android Back routes through overlay/ceremony/pause/navigation behavior. App-state callbacks suspend Board/audio and initiate protected native flushing; init is idempotent and optional-listener failures are caught. Pagehide retains ownership until its flush settles where execution continues.
- Native Preferences queue validates full profiles, preserves raw backup/recovery copies before primary commit, checks ownership and unexpected native changes, and verifies primary readback. Competing profiles are exported/preserved, not automatically merged or selected by timestamp. Missing plugins, future schema and disk failure leave unsaved/recovery state.
- Existing Ember launcher artwork replaces template launcher icons. iOS icon is sized 1024px. PrivacyInfo.xcprivacy declares no tracking/collected data and UserDefaults reason CA92.1, and is wired into Xcode Resources; see [Preferences privacy guidance](https://capacitorjs.com/docs/apis/preferences). This source declaration still needs archive inspection and privacy-owner approval.
- Separate ad provider slots and existing opt-in/natural-break orchestration are retained but disabled. The web provider is null; native AdMob is only an integration seam, with no plugin installed, SDK initialization or live publisher identifiers. Query-string fake ads were removed. UMP code cannot activate without a separately enabled provider. Analytics/crash/remote config transmission remains off irrespective of ad consent.

## Required before native release

| Gate | Required evidence |
| --- | --- |
| Android toolchain and debug build | Install compatible JDK/Android SDK36, accept licenses, run Gradle, inspect merged manifest/dependencies, install APK on emulator/device |
| iOS build | Xcode26+ on macOS, SPM resolution, simulator and signed device/archive success; inspect privacy-manifest inclusion |
| Ownership in WebViews | Verify Web Locks on actual Android WebView and capacitor:// WKWebView origins. Unsupported contexts intentionally remain read-only. No alternate native ownership mechanism is silently enabled; if needed, design/test a real native coordinator before release |
| Durable saves | Test actual Preferences plugin acknowledgements, hung/delayed/rejected calls, backgrounding, force-stop/process kill during primary and companion writes, restart conflict recovery, future schema and exactly-once receipts |
| Native recovery UX | Verify file export/import/download/share on WebViews and Files/document pickers; browser download tests do not prove native export works. Conflicts may require supervised export/whole-profile selection; no forced native replacement shortcut exists |
| Layout/lifecycle | iPhone/iPad safe areas, WKWebView local workers/fonts, rotations/large text, Android Back/resume, audio interruption and screen-reader testing |
| Launch/store assets | Review launch-screen imagery/layout, adaptive icon masks and store screenshots; generated native templates are scaffolding, not polished store assets |
| Privacy and backups | Review OS backup/restore policy, platform privacy labels/Data Safety, support operations, license notices and user-facing privacy text against the compiled app |
| Advertising later | Select and implement a real version-compatible native AdMob/UMP adapter; UMP before eligible requests, development test units only, no production activation without separate privacy/publisher review. iOS tracking/ATT decisions are separate from ad consent. Web AdSense requires a separate reviewed provider |

Preferences stores lightweight data in platform UserDefaults/SharedPreferences; its Promise acknowledgement is not a guarantee against immediate power loss. See [official API limits](https://capacitorjs.com/docs/apis/preferences). No cloud or cross-device synchronization was built. No store approval, signing, installation or device validation is claimed.

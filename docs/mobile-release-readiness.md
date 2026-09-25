# Mobile release readiness

**Status: Sprint 11, Track A.** The donor/courier app is on Expo SDK 56 and every
check that can be run without a store account passes. It is **not** releasable
yet, and the reasons are all external: four things are missing that only the
Product Owner can supply. They are listed in §11.

This document is the record of what was changed, what was proved, and what is
still in the way. It is written to be checked rather than believed — every
number in it comes from a file in the repository or from a command whose output
is quoted.

---

## 1. Starting state

Read from `apps/mobile/` at commit `4179693d`, before any change.

| | Declared | Resolved |
|---|---|---|
| Expo SDK | `~52.0.23` | 52.0.49 |
| React Native | `0.76.9` | 0.76.9 |
| React | `18.3.1` | 18.3.1 |
| expo-router | `~4.0.15` | 4.x |
| jest-expo | `~52.0.0` | 52.x |
| Node | no `engines` field anywhere in the monorepo | 22.x (CI pins `NODE_VERSION: '22'`) |
| pnpm | `packageManager: pnpm@9.15.5` | 9.15.5 |

`app.json` was 17 lines and contained no `android`, no `ios`, no `extra`, no
`updates`, and no icon or splash configuration. There was no `app.config.js`,
no `eas.json` anywhere in the repository, and no `android/` or `ios/` directory
— the project has always used Continuous Native Generation.

Baseline test suite: **34 suites, 263 tests, all passing.**

### A correction to the sprint premise

The SDK 56 decision was justified as "preserving the monorepo's Node 20 line
instead of expanding this sprint into a Node 22 migration". The monorepo has
been on Node 22 since before Sprint 9 — `.github/workflows/ci.yml` sets
`NODE_VERSION: '22'`. There was no Node 20 line to preserve. The decision is
unaffected; only its stated reason was wrong.

---

## 2. Final versions

| | Version |
|---|---|
| Expo SDK | **56.0.22** |
| React Native | **0.85.3** |
| React | **19.2.3** |
| expo-router | **56.2.21** |
| react-native-reanimated | 4.3.1 |
| react-native-worklets | 0.8.3 |
| react-native-maps | 1.27.2 |
| react-native-screens | 4.26.0 |
| react-native-safe-area-context | 5.7.0 |
| react-native-svg | 15.15.4 |
| jest-expo | 56.0.5 |
| TypeScript | 5.9.3 (see §12) |
| Node | 22.22.2 |
| pnpm | 9.15.5 |

### How versions were chosen

`npx expo install --fix` is the tool for this and **it cannot run in the
development environment used for this sprint**: it fetches the SDK's bundled
native-module list from `api.expo.dev`, which that environment's egress policy
refuses with a 403.

The data it would have fetched ships inside the packages themselves, from
`registry.npmjs.org`, which is permitted:

- `expo/bundledNativeModules.json` inside the `expo` package, for every native
  module, at the exact SDK being installed;
- `expo-template-blank-typescript` at the matching `sdk-NN` tag, for `react`,
  `react-native`, `expo-status-bar`, `@types/react` and `typescript`.

Both are published by Expo and are the same numbers the API serves. No version
in the table above was chosen by judgement.

Independent confirmation: expo-doctor's **"Check that packages match versions
required by installed Expo SDK"** runs offline and passes (§8).

---

## 3. Migration, hop by hop

Each hop is a separate commit, and each was left in a state where typecheck,
lint, the mobile suite, the whole monorepo's suites and a production Metro
bundle were all green before the next one started.

| Hop | Commit | SDK | React | React Native |
|---|---|---|---|---|
| A1 | `f99aab7a` | 52 → 53 | 18.3.1 → 19.0.0 | 0.76.9 → 0.79.6 |
| A2 | `3ba75a92` | 53 → 54 | 19.0.0 → 19.1.0 | 0.79.6 → 0.81.5 |
| A3 | `c954c7c4` | 54 → 55 | 19.1.0 → 19.2.0 | 0.81.5 → 0.83.10 |
| A4 | `1ee416c1` | 55 → **56** | 19.2.0 → 19.2.3 | 0.83.10 → **0.85.3** |

---

## 4. Breaking changes encountered

### A1 (SDK 53) — the legacy JSX mode stopped working

Every JSX tag in every file failed to typecheck with *"'View' cannot be used as
a JSX component … Property 'refs' is missing"*. Expo's `tsconfig.base` sets
`jsx: "react-native"`, the legacy mode, which resolves JSX against the **ambient
global `JSX` namespace**. `@types/react` 19 no longer declares one — it moved to
`React.JSX` and the per-runtime namespaces in `react/jsx-runtime`. The app was
therefore being checked against whatever stale global JSX happened to be in the
program, which in this monorepo is React 18's, because the three Next.js
consoles are still on React 18.

Fixed by setting `jsx: "react-jsx"` in the app's own tsconfig. **Expo make
exactly this change in their own `tsconfig.base` at SDK 56**, so the override
was removed again at A4 and the app inherits it.

### A1 (SDK 53) — two Reacts in one bundle

The most serious finding of the sprint, and not a test artifact.

`expo-modules-core` declares no `react` peer, so pnpm installs it with none in
scope and its `react` import falls through to the **hoisted** copy in
`node_modules/.pnpm/node_modules` — one version for the whole repository, and
that version is React 18. Every Expo native view (LinearGradient, BlurView, the
maps view) was therefore being created by React 18 while the app ran React 19,
which React 19 rejects at render time:

```
A React Element from an older version of React was rendered.
```

Fourteen packages were in this position. Metro resolves the same way Jest does,
so a device build would have carried two Reacts and two hook dispatchers.

It was invisible before the upgrade for the worst possible reason: while the app
was also on React 18, the hoisted copy and the app's copy were the same version,
so the wrong resolution produced the right answer.

Fixed in the dependency graph, not in the type layer: the missing peers are
declared in the root `package.json` under `pnpm.packageExtensions`, so pnpm
resolves `react` per importer — the mobile app's dependencies get 19, the
consoles keep 18.

> A `tsconfig` `paths` pin was tried first and **rejected**: jest-expo 53 turns
> tsconfig paths into `moduleNameMapper`, so it silently redirected the *runtime*
> `react` to the types directory and every suite failed to resolve a module. The
> lesson is in `scripts/verify-single-react.mjs`.

`pnpm verify:single-react` now walks the app's whole dependency graph and fails
if any package would resolve a different React. It runs in CI.

### A1 (SDK 53) — React 19 render semantics

`renderer.create` no longer renders synchronously; `toJSON()` on the next line
returns `null` unless the render is flushed with `act()`. Three specs needed it.

A fourth failed for a subtler reason worth recording: React 19's `act()` flushes
pending work for **every mounted root in scope**, so a Calendar tree mounted by
the first test in a file re-rendered during the fourth — after `beforeEach` had
reset its hook mock — and the failure was reported against a test that had never
mounted a Calendar. That file now unmounts what it mounts.

### A1 (SDK 53) — reanimated 3.17 typing

`Animated.createAnimatedComponent(LinearGradient)` matches none of reanimated
3.17's overloads, so the call fell through to the `FlatList` one and returned a
component with no props at all, `colors` included. `Skeleton` now animates a
wrapper `Animated.View` instead: the gradient does not move, only the band does,
so this is both typed and cheaper.

### A2 (SDK 54) — React Native 0.81 retyped TextInput events

`onFocus`/`onBlur` take RN's own `FocusEvent`/`BlurEvent`;
`TextInputFocusEventData` is deprecated and wider than what the handler now
receives. `AppTextInput` updated.

### A2 (SDK 54) — Pressable became a memo component

`GlassTabBar`'s spec counted tab buttons with `node.type === Pressable`. RN 0.81
wraps `Pressable` in `React.memo`, and React unwraps a memo into a
`SimpleMemoComponent` whose fiber `type` is the **inner** function — so the
comparison matched nothing and all five counting assertions silently read zero.
The query now matches what the component declares (an accessibility role of
`button` carrying an `onPress`), which is what the test was always about and
does not care how Pressable is wrapped next time.

### A2 (SDK 54) — reanimated 4 needs react-native-worklets

Reanimated 4 moved its worklet runtime into a separate package. It is listed in
SDK 54's bundled manifest and comes in at the version the SDK ships.

### A3 (SDK 55) — two native modules stopped tolerating Jest

- `react-native-reanimated/mock` at 4.2.1 imports the **real**
  `react-native-worklets` on the way in, which throws *"Native part of Worklets
  doesn't seem to be initialized"* as soon as a suite touches anything animated.
  That took down 14 of 34 suites, including ones with no animation in them,
  because the import chain runs through the shared component barrel. Worklets
  ships its own mock; registering it first makes reanimated's mock resolve to it.
- `react-native-maps` 1.27 calls
  `TurboModuleRegistry.getEnforcing('RNMapsAirModule')` at **import time**, which
  cannot succeed under Jest. Any screen importing `LocationMap` failed to load
  at all. It is mocked the same way `expo-blur` and `lucide-react-native`
  already are, with `fitToCoordinates` present on the ref because the component
  calls it in an effect.

### A4 (SDK 56) — expo-router vendors React Navigation

**The structural change of the upgrade.** expo-router 56 no longer peers on
React Navigation; it vendors it under `expo-router/js-tabs` and its own
dependency list contains no `@react-navigation/*` at all.

Keeping `@react-navigation/bottom-tabs` as a direct dependency would have meant
two React Navigation instances in one bundle — the same class of bug as the two
Reacts: two sets of contexts, and a tab bar reporting its height to a context
nothing reads. expo-doctor has a check for exactly this and it now passes.

The dependency was removed and four import sites moved to `expo-router/js-tabs`:
`BottomTabBarHeightContext` (Screen), `BottomTabBarHeightCallbackContext` and
`BottomTabBarProps` (GlassTabBar), and `Tabs` itself in both tab layouts — the
package-root `Tabs` is deprecated at this SDK in favour of that subpath.

### A4 (SDK 56) — `StyleSheet.absoluteFillObject` removed

RN 0.85 removed it; `absoluteFill` is now typed as the plain style object the
old name returned. Three call sites renamed.

### A4 (SDK 56) — jest module isolation changed

`config.spec.ts` re-mocks `react-native` and `expo-constants` per case inside
`jest.isolateModules`. Under jest-expo 56 the `react-native` instance a previous
`load()` put in the registry survives into the next sandbox, so the second call
in a file kept the first one's `Platform.OS` — and the Android
emulator-address cases were being checked against iOS. Only one assertion was
strict enough to notice. The helper now resets the registry immediately before
re-mocking; `afterEach` was too late, because the helper is called more than
once inside a single test.

---

## 5. Native dependency compatibility

Every native module is at the version SDK 56's own `bundledNativeModules.json`
pins. Two checks back this up:

- expo-doctor's **"Check that packages match versions required by installed
  Expo SDK"** — passes.
- expo-doctor's **"Check that native modules do not use incompatible support
  packages"** — passes.

`react-native-chart-kit@7.0.2` is the one dependency outside Expo's manifest.
Its peer range (`react >=19.1`, `react-native >=0.81`, `react-native-svg >=15.12.1`)
was **unsatisfied at the SDK 52 baseline** and is satisfied from SDK 54 onward.
The mobile app now installs with no peer warnings of its own.

---

## 6. Android API 36 proof

Google Play requires a recent target API. The claim is checkable, and
`pnpm verify:android-release` checks it on every CI run rather than asserting it
here.

`android/` is generated, not committed, and even once generated
`app/build.gradle` only says `targetSdkVersion rootProject.ext.targetSdkVersion`.
The value is resolved through four steps, each read from a file on disk:

1. `android/settings.gradle` calls `expoAutolinking.useExpoVersionCatalog()`.
2. `react-native/gradle/libs.versions.toml` declares:
   ```toml
   minSdk = "24"
   targetSdk = "36"
   compileSdk = "36"
   ```
3. `ExpoRootProjectPlugin.kt` reads that catalog entry into
   `rootProject.ext.targetSdkVersion`, defaulting to `35` **only** when the
   catalog has no entry. The verification asserts this line still exists, so a
   rewrite of the plugin cannot pass silently.
4. `android/app/build.gradle` uses `rootProject.ext.targetSdkVersion`.

Generated output at the time of writing:

```
namespace 'uz.bloodchain.donor'
applicationId 'uz.bloodchain.donor'
targetSdkVersion rootProject.ext.targetSdkVersion
versionCode 1
versionName "0.1.0"
```

**What this is not.** It is a static resolution, not a Gradle-reported value. A
real `./gradlew` run is not possible in the sprint environment: the Android SDK
is downloaded from `dl.google.com`, which the egress policy refuses (the CONNECT
fails outright). Gradle itself installs and starts — the failure is the SDK, not
the project. On a runner with an Android SDK, `./gradlew :app:assembleRelease`
is the next level of evidence and is listed in §13 as an outstanding item.

---

## 7. iOS / Xcode status

Generated from `app.json` by `expo prebuild --platform ios`:

| | Value |
|---|---|
| `PRODUCT_BUNDLE_IDENTIFIER` | `uz.bloodchain.donor` |
| `IPHONEOS_DEPLOYMENT_TARGET` | 16.4 |
| `CFBundleShortVersionString` | 0.1.0 |
| `CFBundleVersion` | 1 |
| `CFBundleURLSchemes` | `donor` |
| JS engine | Hermes |
| `UIBackgroundModes` | **absent** |

**Xcode-era validation was not performed and is not claimed.** This sprint ran
on Linux; building an iOS app requires macOS and Xcode. What was validated is
everything short of the compiler: the Xcode project generates, the Info.plist
contains exactly the keys intended (§8), the Podfile and its properties are
produced, and a production iOS JS bundle builds through Metro and Hermes
(7.4 MB).

`MARKETING_VERSION` in the pbxproj reads `1.0` while `CFBundleShortVersionString`
in Info.plist reads `0.1.0`. Expo writes the version into Info.plist and does not
use `MARKETING_VERSION`, so the shipped value is `0.1.0`; the pbxproj entry is
inert.

---

## 8. Permission inventory

The rule applied: **no permission was removed unless nothing in the app uses it,
and none was added that no implemented feature asks for.**

### Android — after

| Permission | Source | Why it is there |
|---|---|---|
| `INTERNET` | Expo template | Every API call. |
| `ACCESS_COARSE_LOCATION` | expo-location | Emergency journey tracking; nearest-centre search. |
| `ACCESS_FINE_LOCATION` | expo-location | Same; `Accuracy.Balanced`. |
| `VIBRATE` | expo-haptics | Haptic feedback; notification vibration. |
| `POST_NOTIFICATIONS` | expo-notifications manifest | Required on Android 13+ for the push permission prompt to be grantable. |
| `RECEIVE_BOOT_COMPLETED` | expo-notifications manifest | Contributed by the library. The app schedules no local notifications, so it is unused; see §13. |

### Android — removed

Expo's bare template ships these with the comment *"OPTIONAL PERMISSIONS, REMOVE
WHATEVER YOU DO NOT NEED"*. Nothing in the app uses any of them — there is no
file-system, media-library, image-picker or document-picker dependency, and
every "overlay" in the source is a visual one — so all three are now in
`android.blockedPermissions` and are emitted with `tools:node="remove"`:

- `SYSTEM_ALERT_WINDOW` — draw over other apps. Play Console treats this as a
  sensitive permission requiring a declaration.
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`

### iOS — before

```
NSFaceIDUsageDescription                       "Allow $(PRODUCT_NAME) to access your Face ID biometric data."
NSLocationAlwaysAndWhenInUseUsageDescription   "Allow $(PRODUCT_NAME) to access your location"
NSLocationAlwaysUsageDescription               "Allow $(PRODUCT_NAME) to access your location"
NSLocationWhenInUseUsageDescription            "Allow $(PRODUCT_NAME) to access your location"
NSMotionUsageDescription                       "Allow $(PRODUCT_NAME) to detect your current motion activity"
```

The carefully-written emergency sentence in `app.json` was attached to
`locationAlwaysAndWhenInUsePermission` — the **Always** key, which the app never
requests — while `NSLocationWhenInUseUsageDescription`, the only prompt a donor
ever sees, carried Expo's boilerplate.

### iOS — after

```
NSLocationWhenInUseUsageDescription
  "Bloodchain uses your location while you are responding to an emergency
   request, so the hospital can see you are on the way. It is also used, when
   you allow it, to show which donation centres are nearest to you."
```

That is the **only** usage description in the Info.plist, and `UIBackgroundModes`
is absent.

Every call site — `app/sos.tsx`, `app/(courier)/active.tsx`,
`app/(onboarding)/complete-profile.tsx`, `app/(booking)/organizations.tsx` —
calls `requestForegroundPermissionsAsync()`. Nothing calls
`startLocationUpdatesAsync`, and no background task is registered. The Always
keys were a background-location claim with no implementation behind it, which is
both an App Review risk and untrue. They are removed by passing `false` to the
expo-location plugin, which deletes the key rather than overwriting it.

`NSFaceIDUsageDescription` is removed for the same reason: `src/auth/storage.ts`
uses plain `setItemAsync`/`getItemAsync` with no `requireAuthentication`, so the
app never invokes biometrics. `NSMotionUsageDescription` is removed because
nothing reads motion activity.

`pnpm verify:android-release` fails the build if any of these regress.

---

## 9. EAS configuration

There was none. `apps/mobile/eas.json` now defines three profiles:

| Profile | Distribution | Android | iOS |
|---|---|---|---|
| `development` | internal | APK, `assembleDebug`, dev client | Debug, simulator |
| `preview` | internal | APK | simulator |
| `production` | store | app bundle (`.aab`) | — |

`cli.appVersionSource` is **`local`**, which is the setting that matters for
§10: versions come from `app.json` and are never auto-incremented by a remote
service. `cli.requireCommit` is `true`, so a build always corresponds to a
commit.

**Deliberately absent**, per the sprint's constraints:

- no `submit` section — nothing is configured to upload to Google Play or the
  App Store;
- no `extra.eas.projectId` — that requires a real Expo account (§11);
- no Apple ID, no App Store Connect app ID, no Google service-account key, no
  keystore, no provisioning profile, no secrets of any kind.

`eas.json` on its own creates nothing and contacts nothing. It has not been
validated against Expo's servers, because that requires `api.expo.dev`.

---

## 10. Versioning policy

Deterministic, and derived from one place.

**`app.json` is the source of truth.** `cli.appVersionSource: "local"` means
EAS reads versions from it rather than keeping its own counter.

| Field | Where | Rule |
|---|---|---|
| App version | `expo.version` | Semantic version of the product, e.g. `0.1.0`. Changes only when the Product Owner decides a release is a patch, minor or major. Shown to users; identical on both platforms. |
| Android `versionCode` | `expo.android.versionCode` | Integer, **monotonically increasing, +1 per build uploaded to Play**. Never reused, never decreased, never reset when `expo.version` changes. Currently `1` because nothing has ever been uploaded. |
| iOS `buildNumber` | `expo.ios.buildNumber` | String integer, **+1 per build uploaded to App Store Connect**, and may reset to `1` when `expo.version` increases (Apple scopes it to the marketing version). Kept in step with `versionCode` while both are `1`. |
| `runtimeVersion` | not set | **Not applicable.** `expo-updates` is not a dependency; the generated manifest confirms it with `expo.modules.updates.ENABLED = false`. If OTA updates are ever adopted, this becomes a required field and this row must be rewritten before the first update is published. |

Increments are a release action, performed once per upload, never speculatively
and never by a script that runs on every commit.

---

## 11. Credential and account blockers

These cannot be resolved from inside the repository. Each needs a decision or an
account that only the Product Owner can provide.

| # | Blocker | What it stops | Notes |
|---|---|---|---|
| B1 | **No production API URL.** `src/api/config.ts` derives the API host from the Metro host. A release build has no Metro, so it falls back to `http://localhost:3001` — wrong, and cleartext HTTP, which Android blocks by default from API 28. | The app cannot talk to anything in a release build. | Needs a hostname and a TLS certificate. Until then, set `EXPO_PUBLIC_API_URL` or `extra.apiUrl` per build profile. |
| B2 | **No EAS project ID.** `src/notifications/push.ts` needs `extra.eas.projectId`; `getExpoPushTokenAsync` throws without it, the `catch` swallows it, and push silently never registers — no crash, no token, no error. | Push notifications do not work in any real build. Also blocks every EAS build. | Requires an Expo account and `eas init`. |
| B3 | **No Google Maps Android API key.** `LocationMap` uses `PROVIDER_DEFAULT`, which on Android is Google Maps and needs a key. | The map renders blank on Android release builds. The emergency journey and courier screens lose their map. | Requires a Google Cloud project. Alternative: switch Android to a provider that needs no key, which is a product decision. |
| B4 | **No signing identity for either store.** | No uploadable artifact. | Android needs an upload keystore; iOS needs an Apple Developer Program membership, a distribution certificate and a provisioning profile. Explicitly out of scope for this sprint. |

---

## 12. Known regressions and accepted warnings

**No product behaviour changed in Track A.** The only source edits were the
typing and API migrations in §4, plus the permission and identity configuration
in §8. Every test that passed before passes now, and the mobile suite is the
same 263 tests it was at the baseline.

Accepted, with reasons:

| Item | Status |
|---|---|
| **Hermes V1 memory regression** | **Real, unresolved, and a Product Owner decision.** expo-doctor reports that SDK 56 ships Hermes V1 `250829098.0.10` and that the regression is fixed in `250829098.0.16`, which first appears in React Native 0.86.2 / Expo SDK 57. There is no fix inside SDK 56, and SDK 57 is out of scope by Product Owner decision. Raised in §13. |
| expo-doctor "Check Expo config schema" | Fails on the network only (`api.expo.dev`, 403 in the sprint environment). Expected to pass on a runner with open egress; CI runs the step with `continue-on-error` and prints the result. |
| expo-doctor "Validate packages against React Native Directory" | Same — `reactnative.directory`, 403. |
| `userInterfaceStyle: "dark"` is not enforced on Android | `expo prebuild` warns that this needs `expo-system-ui`, which is not installed, so the declaration is inert on Android. It also interacts badly with the app's own `'light' \| 'dark' \| 'system'` preference: on iOS, `UIUserInterfaceStyle: Dark` makes RN's `useColorScheme()` always return `dark`, so the "system" preference cannot follow the device. Left as found — changing it changes product behaviour — and carried into Track B, where the theme is rebuilt. |
| `RECEIVE_BOOT_COMPLETED` on Android | Contributed by expo-notifications' own manifest. The app schedules no local notifications, so it is unused. Removing it means blocking a library-contributed permission, which risks breaking scheduled notifications if they are ever added. Recorded rather than removed. |
| Mobile lint warnings | 36, unchanged across all four hops — the same set as at the baseline. 0 errors. |
| TypeScript 5.9.3, not 6.0 | SDK 56's template suggests `typescript ~6.0.3`. The monorepo shares one TypeScript across eleven packages, so moving to 6.0 is a monorepo-wide change with its own risk surface and does not belong in a mobile sprint. 5.9.3 typechecks the app cleanly. |

---

## 13. Remaining Play Store blockers

1. **B4** — no upload keystore, so nothing can be signed.
2. **B1** — the app cannot reach an API in a release build.
3. **B3** — maps render blank.
4. **B2** — push notifications never register.
5. **No app icon or splash screen.** `app.json` sets neither, so the build uses
   Expo's placeholder. Play requires a real icon and a feature graphic.
6. **No store listing** — title, short and full description, screenshots,
   privacy policy URL, data-safety form. A blood-service app will also need a
   Health apps declaration.
7. **Not yet built with Gradle.** §6 proves the configuration resolves to API 36;
   it does not prove the app compiles. `./gradlew :app:assembleRelease` on a
   runner with an Android SDK is the next level of evidence and has not been run.

## 14. Remaining App Store blockers

1. **B4** — no Apple Developer Program membership, certificate or profile.
2. **B1**, **B2** as above. (B3 does not apply: `PROVIDER_DEFAULT` on iOS is
   Apple Maps, which needs no key.)
3. **Never compiled.** No macOS or Xcode was available; §7 is generation and
   bundling only.
4. **No app icon.**
5. **App Privacy questionnaire** — precise location, health data and contact
   info are all collected, and each needs a declaration.
6. **Permission-string localisation.** The Info.plist usage description is
   English only. The app ships Uzbek, Russian and English; iOS localises these
   strings through per-language `InfoPlist.strings`, which CNG does not generate.
   A donor whose phone is in Uzbek will read the location prompt in English.
7. **Export compliance** — `ITSAppUsesNonExemptEncryption` is not declared, so
   every submission will stop and ask.

---

## 15. Product Owner decisions required

| # | Decision |
|---|---|
| **PO-1** | **Hermes V1 memory regression.** SDK 56 is affected and there is no fix within SDK 56. Options: accept the regression for the pilot and schedule SDK 57 for the next sprint; or authorise SDK 57 now, which also moves React Native to 0.86.x. Recommendation: accept for the pilot and schedule SDK 57 — the regression is a memory-pressure issue, not a correctness one, and the pilot's device fleet is small. |
| **PO-2** | **Production API hostname** (B1), and whether the pilot runs against a public TLS endpoint or a private network. |
| **PO-3** | **Expo account and EAS project** (B2). Needed for push notifications and for any EAS build. |
| **PO-4** | **Android maps** (B3): fund a Google Maps API key, or change the Android provider. |
| **PO-5** | **App icon and splash.** Neither exists. Needed before any store upload. |
| **PO-6** | **Permission-string localisation** (App Store blocker 6): ship English-only prompts for the pilot, or add `InfoPlist.strings` for uz/ru/en via a config plugin. |

---

## 16. Physical device status

**PHYSICAL_DEVICE_NOT_VERIFIED.**

No physical device, emulator or simulator was available in the sprint
environment. Nothing in this document is a claim about behaviour on real
hardware. What was exercised is: Metro resolution and Hermes compilation of a
production bundle for both platforms, native project generation for both
platforms, the Jest suite, and static analysis. A device QA matrix is in
`docs/mobile-v2-ui-qa.md` and is unfilled for the same reason.

---

## 17. Reproducing the checks

```bash
pnpm install --frozen-lockfile

pnpm verify:single-react                      # one React across 924 packages
pnpm verify:android-release                   # API 36, identifiers, permissions
pnpm --filter @bloodchain/mobile typecheck
pnpm --filter @bloodchain/mobile lint
pnpm --filter @bloodchain/mobile test
pnpm --filter @bloodchain/mobile exec expo-doctor
pnpm --filter @bloodchain/mobile exec expo export --platform android --output-dir .expo-export-check
pnpm --filter @bloodchain/mobile exec expo export --platform ios --output-dir .expo-export-check
pnpm --filter @bloodchain/mobile exec expo prebuild --platform all --no-install --clean
```

All of these run in CI as the **Mobile release readiness (SDK 56)** job, with no
secrets and no store credentials.

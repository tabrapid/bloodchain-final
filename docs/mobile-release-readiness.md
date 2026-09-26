# Mobile release readiness

**Status: Sprint 11.1.** The donor/courier app is on **Expo SDK 57**, its
interface has been rebuilt on the V2 design system, and every check that can be
run without a store account passes. It is **not** releasable yet, and the
reasons are listed one per row in `docs/mobile-release-blockers.md` — most of
them external, two of them (a native build, and a visual pass on real hardware)
waiting on a machine this work has never had.

Track A (the SDK upgrade and release configuration) is §§1–17. Track B (the
interface rebuild) is §18, and its record is `docs/mobile-v2-ui-qa.md`. Sprint
11.1 — SDK 57, the visual-QA harness, and what photographing the app found — is
§19, with the screenshots in `artifacts/mobile-v2-visual-qa/` and the per-screen
record in `docs/mobile-v2-visual-qa-report.md`.

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
| Expo SDK | **57.0.25** |
| React Native | **0.86.3** |
| React | **19.2.3** |
| expo-router | **57.0.23** |
| react-native-reanimated | 4.5.1 |
| react-native-worklets | 0.10.1 |
| react-native-gesture-handler | 2.32.0 |
| react-native-maps | 1.27.2 |
| react-native-screens | 4.26.0 |
| react-native-safe-area-context | 5.7.0 |
| react-native-svg | 15.15.4 |
| jest-expo | 57.0.5 |
| react-native-web (visual-QA harness only) | 0.21.x |
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
| A5 | `da476dc5` | 56 → **57** | 19.2.3 (unchanged) | 0.85.3 → **0.86.3** |

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

Every native module is at the version SDK 57's own `bundledNativeModules.json`
pins. Two checks back this up:

- expo-doctor's **"Check that packages match versions required by installed
  Expo SDK"** — passes. It reported one mismatch, `typescript ~6.0.3` against
  5.9.3, which is the deliberate monorepo-wide deviation in §12 and is now
  declared as one in `expo.install.exclude`. No native module is mismatched.
- expo-doctor's **"Check that native modules do not use incompatible support
  packages"** — passes.

`expo-doctor` is a devDependency of the mobile app, so a full run is
reproducible by anyone who clones the repository (§12 says why it has to be).
On SDK 56 it reported 21 of 22, the one failure being the Hermes V1 regression
([CI run 149](https://github.com/tabrapid/bloodchain-final/actions/runs/36152318614)).
On **SDK 57 that check passes**: doctor runs 21 checks and, in this environment,
19 pass — the two that cannot run here are the ones that need `api.expo.dev` and
`reactnative.directory`, both 403 through the egress policy. §12 lists them.

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
| B1 `EXTERNAL_BLOCKER_PRODUCTION_API` | **No production API URL.** There is still no hostname. What changed in S12 is what happens without one: a production build used to derive the address from the Metro host and fall back to `http://localhost:3001` on iOS — or `http://10.0.2.2:3001` on Android, an emulator-only alias — and ship pointing at the donor's own phone. It now fails closed, at config-evaluation time and again at runtime. | Nothing can be built for production until a hostname exists; that is the intended trade. | Needs an https hostname. Set `EXPO_PUBLIC_API_URL` for the build; `APP_ENV` selects the rules. |
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
| **Hermes V1 memory regression** | **Closed in S11.1.** It was real and had no fix inside SDK 56. The Product Owner authorised SDK 57, which carries React Native 0.86.3 and the fixed Hermes; expo-doctor's check for it passes now and still appears in its list (`--verbose`), so this is a pass rather than a check that stopped applying. |
| **CI's expo-doctor step was vacuous** | **Found and fixed at the end of S11.** `expo-doctor` was not a dependency of the mobile app, so `pnpm --filter @bloodchain/mobile exec expo-doctor` printed `Command "expo-doctor" not found` and exited 1 on every run — and `continue-on-error: true` rendered that as a green tick. The step reported on a tool it never ran, for every run of Track A. `expo-doctor@^1.20.4` is now a devDependency, and the step is split so that a missing binary fails the job while the checks themselves stay `continue-on-error`. |
| expo-doctor "Check Expo config schema" | **Was failing for a real reason as well.** In the sprint environment this check cannot run at all (`api.expo.dev`, 403), so its result was assumed. The first CI run that actually executed expo-doctor said `app.json` "should NOT have additional property `newArchEnabled`" — the key left the schema in SDK 56, where the new architecture is the only one. It is removed, and `expo prebuild` still writes `newArchEnabled=true` into `android/gradle.properties`, checked before and after. |
| expo-doctor "Validate packages against React Native Directory" | Cannot run in the sprint environment — `reactnative.directory`, 403. Passes on a runner with open egress. |
| `userInterfaceStyle: "dark"` is not enforced on Android | `expo prebuild` warns that this needs `expo-system-ui`, which is not installed, so the declaration is inert on Android. It also interacts badly with the app's own `'light' \| 'dark' \| 'system'` preference: on iOS, `UIUserInterfaceStyle: Dark` makes RN's `useColorScheme()` always return `dark`, so the "system" preference cannot follow the device. Left as found — changing it changes product behaviour — and carried into Track B, where the theme is rebuilt. |
| `RECEIVE_BOOT_COMPLETED` on Android | Contributed by expo-notifications' own manifest. The app schedules no local notifications, so it is unused. Removing it means blocking a library-contributed permission, which risks breaking scheduled notifications if they are ever added. Recorded rather than removed. |
| Mobile lint warnings | 36 through Track A, unchanged across all four hops — the same set as at the baseline. **15 after Track B**, because most of them lived in the V1 component layer that was deleted: 12 `no-explicit-any` and 3 `react-hooks/exhaustive-deps`. 0 errors throughout. |
| TypeScript 5.9.3, not 6.0 | SDK 57's template suggests `typescript ~6.0.3`. The monorepo shares one TypeScript across eleven packages, so moving to 6.0 is a monorepo-wide change with its own risk surface and does not belong in a mobile sprint. 5.9.3 typechecks the app cleanly. |

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
| ~~**PO-1**~~ | ~~Hermes V1 memory regression.~~ **Decided in S11.1: SDK 57 authorised and taken.** The app is on 57.0.25 / React Native 0.86.3 and expo-doctor's check passes. |
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

All of these run in CI as the **Mobile release readiness (SDK 57)** job, with no
secrets and no store credentials.

---

## 18. Track B — the V2 interface rebuild

The upgrade in §§1–17 was finished and stable before any of this began, which
is the order the sprint required.

### 18.1 What changed

Every screen in `apps/mobile/app/` is on the V2 design system in
`apps/mobile/src/design` (62 exports: 10 token groups, 51 components and the
`useDesign` hook). The
pre-V2 component layer — 42 files in `apps/mobile/src/components` — was deleted
rather than left beside it; three files remain (`AppBackground`, `BrandMark`,
`map/LocationMap`) and the barrel says why each one is not a design-system
component.

`docs/mobile-v2-ui-qa.md` lists every screen, the states each one supports, the
permission journeys, and what was and was not verified.

### 18.2 Defects found and fixed while rebuilding

These were shipped behaviour, not cosmetics:

| Defect | Where |
| --- | --- |
| OS notification permission requested seconds after sign-in, on whatever screen was open, with no explanation — on iOS the prompt never returns | `usePushNotifications` → `registerForPushNotificationsAsync` |
| OS location permission requested on a toggle tap, explained afterwards only on refusal | onboarding, booking's nearby filter, courier in-transit |
| A dashed line through pickup → courier → hospital, read as a route; nothing computes one | `LocationMap.showRoute`, now removed from the component |
| "Tap points for details" under a chart with no tap handler | health trends |
| Database enums rendered to donors: `CANCELLED`, `WHOLE BLOOD`, `DONOR CANCELLED`, `HEMATOLOGY`, `ARTICLE`, `BEGINNER`, `DONATION_MILESTONE`, `basic_identity`, `BLOOD_CENTER` | donation detail, calendar, health trends, education, challenges, profile |
| ~40 hardcoded English strings on screens that ship in three languages, including the SOS deadline (`${n}m left`, "Overdue") | across the app; now guarded by a template-literal check in the i18n coverage spec |
| `toLocaleDateString()` / `toLocaleTimeString()` / `toLocaleString()` with no locale — device locale, not app locale | campaigns, leaderboard, consoles (reported, not fixed) |
| Two lists fetched together, one error flag, failure shown only if both were empty — so a failed request read as "you have none" | laboratory hub, health trends |
| A slot taken while the donor decided, presented as a retryable error | booking review, laboratory review |
| Version stamp read 1.0.0 on one screen and 0.2.0 on another while `app.json` said 0.1.0 | privacy, profile |
| `+1 234 567 8900` offered as the phone placeholder on a product that only accepts +998 | profile edit |
| Sign-out on the first tap, with no confirmation | profile |
| Password change signed the donor out from under an alert that the navigation then dismissed | security |
| "Reason required" shown as a system dialog covering the field it was about | courier |
| `formatMonth` already carries the year; two screens appended it again ("September 2026 2026") | both booking date steps |

### 18.3 Product rules the interface holds to

Each of these is enforced by a test, by a type, or by the absence of the
capability — not by convention:

- **No fake route or ETA.** `LocationMap` has no `showRoute` prop to pass.
- **Donor progression ends at ARRIVED.** Asserted in `sos-state-machine.spec`.
- **No AI output without its disclaimer.** Asserted in `health-screen.spec`.
- **Nothing asked of the OS before an explanation.** Asserted in
  `onboarding-permissions.spec` and `push-registration.spec`.
- **No privacy action the backend cannot perform.** The rows are disabled and
  say what to do instead.
- **Status is never colour alone; icons always carry labels.** Asserted in
  `design-system.spec`; three label props became required at the type level.

### 18.4 Test counts after Track B

| Suite | Before S11 | After |
| --- | --- | --- |
| Mobile | 34 suites / 263 tests | 37 suites / 363 tests |
| i18n | 77 tests | 79 tests |

Six V1 component specs (34 tests) were deleted with the components they
covered; what they proved that still applies was ported to the V2 equivalents
(tab bar behaviour, scroll-content sizing, the Android shadow rule).

### 18.5 Still unverified

`PHYSICAL_DEVICE_NOT_VERIFIED` remains true for Track B as it does for Track A.
No screen in this rebuild has been seen on a physical device, in an emulator, or
in a simulator. Contrast is computed, layout is asserted against a rendered
tree, and accessibility is checked by role and label — none of that is the same
as looking at it.

---

## 19. Sprint 11.1 — SDK 57, and photographing the app

Sprint 11 was not product-accepted. The engineering was substantial and the
visual claim was not demonstrated: nothing in that environment could render a
screen, so "production quality" rested on tests, computation and reading. This
sprint closed the SDK question and took the pictures.

### 19.1 SDK 56 → 57

The one thing SDK 56 could not fix from inside itself was the Hermes V1 memory
regression (PO-1). SDK **57.0.25** carries React Native **0.86.3**, whose
Hermes is past the fixed build, and expo-doctor's own check for it passes while
still appearing in its list — a pass, not a check that stopped applying.

Every version is what SDK 57's `bundledNativeModules.json` pins (§2). Nothing
in the app needed changing for the hop: 363 mobile tests, 1 482 API tests, both
production bundles compiling, both native projects generating with the same
manifest and the same single iOS usage description, targetSdk 36 — now from
0.86.3's own Gradle catalogue.

### 19.2 The visual-QA harness

Two harnesses, in `apps/mobile/qa/visual`, and the difference between them is
the point:

- **`capture.mjs`** renders the real screens through react-native-web in
  Chromium, against the real API with the seeded development data, and
  photographs every screen in every state a catalogue names — populated, empty,
  failed, loading, offline, mid-flow, and each of uz/ru/en. It runs here. It
  produced **593 screenshots** and found **39 defects**, every one of them
  fixed. Two phone sizes across all 53 screens, and a third pass at 360×640
  over the eighteen screens where a short phone is most likely to cut
  something.
- **`run-native-capture.sh`** plus the Maestro flows drive the real app on a
  simulator or emulator, which is the capture that actually settles how the app
  looks. It needs macOS with Xcode or an Android SDK. **It has not been run**
  (`NATIVE_VISUAL_QA_NOT_PERFORMED`).

Three modules with no working web implementation are substituted behind
`BLOODCHAIN_VISUAL_QA=1` *and* a platform check, in `metro.config.js`, so no
native build can reach them. No production code is touched by the harness.

The full record, including every defect and every measurement, is
`docs/mobile-v2-visual-qa-report.md`; the screenshots are in
`artifacts/mobile-v2-visual-qa/`.

### 19.3 What photographing it found

Thirty-nine defects, in four groups, none of which came from reading the code:
things the app **said that were not true** (an XP bar always full, a completion
bar always zero, a verified donor shown unverified on every cold start, four
screens reporting a failed request as a fact about the donor); **controls that
did nothing** (an education module with articles and no reader, four donation
types with one handler, "Load more" that replaced rather than loaded); **ways
out that were not there** (a six-step wizard with no exit, Android's back
button leaving it, back from a receipt returning to the picker); and **layout
that cut the wrong thing** (a four-column grid that was never four columns, six
lists under the tab bar, titles clipped in English before Russian made it
worse). The report tables each one against its fix.

An audit by eleven agents raised 258 findings; 46 were high severity and all of
those are resolved or recorded. The rest are triaged and are not blockers.

### 19.4 Privacy controls, classified

| Control | Backing | Outcome |
| --- | --- | --- |
| Location consent | `DonorProfile.consentLocation`, written through `PATCH /donors/profile` | **Kept** |
| Leaderboard visibility | Column, setter endpoint, and a leaderboard query that honours it — only the read was missing | **Added** (the endpoint returns it now) |
| Notification preferences | `/notifications/preferences` | **Kept** |
| Session revocation | `/auth/sessions` | **Kept** |
| Public profile, donation-history visibility, anonymised analytics | Nothing, anywhere in this system | **Absent**, deliberately |
| Data export | No endpoint | **Marked** — `STORE_BLOCKER_DATA_EXPORT`. The row no longer points at a support channel that does not exist |
| Account deletion | No endpoint | **Marked** — `STORE_BLOCKER_ACCOUNT_DELETION`. The UX is designed and documented in `docs/mobile-account-deletion.md`; the retention behaviour behind it is a legal decision and has not been invented here |

### 19.5 Test counts after Sprint 11.1

| Suite | After S11 | After S11.1 |
| --- | --- | --- |
| Mobile | 37 suites / 363 tests | 38 suites / 381 tests |
| i18n | 79 tests | 79 tests |
| API | 84 suites / 1 482 tests | 84 suites / 1 484 tests |

### 19.6 Still unverified

`PHYSICAL_DEVICE_NOT_VERIFIED`, `NATIVE_VISUAL_QA_NOT_PERFORMED` and
`NATIVE_BUILD_NOT_COMPILED` are all still open, for the same reason: no macOS,
and no Android SDK — `dl.google.com` is refused by this environment's egress
policy (403 on CONNECT), while Gradle itself, `maven.google.com`,
`plugins.gradle.org` and Maven Central are all reachable. The blockers are one
per row in `docs/mobile-release-blockers.md`.

### 19.7 CI could not run on the last four commits

The last CI run that executed is **#153** on `fe2cb23b`
(https://github.com/tabrapid/bloodchain-final/actions/runs/36171148293) —
green: lint and typecheck, unit tests, API e2e, the verification scripts,
migration rehearsal, e2e isolation, both production bundles, prebuild and the
manifest check.

Every run after it — #156 through #159, seven attempts across four commits,
spread over half an hour — failed **without a runner ever being assigned**: each
job is created, sits at `runner_id: 0`, and is marked failed two to four seconds
later with no steps and no log to download. That is not this repository's code
failing. It began at 18:41 UTC on 2026‑09‑25, it hits every job including ones
that had just passed on the same tree, and the only change to `.github/` since
#153 is a job's display name and a comment. **Someone with access to the account's billing page
should check the Actions spending limit and included minutes**, which is what
produces exactly this signature.

So the commits after `fe2cb23b` — the artifacts, this documentation, the QA
harness changes, one screen's header and the SOS section header — were verified
locally instead, on the final tree, and this is what was run:

| | Result |
| --- | --- |
| `pnpm typecheck` | clean, 11 packages |
| `pnpm lint` | 0 errors (678 pre-existing warnings) |
| `pnpm test` | mobile 38 suites / 381, API 84 / 1 484, i18n 79, ui 100, validation 83, utils 18, admin 37, blood centre 62, hospital 70 |
| `pnpm --filter @bloodchain/api test:e2e` | 25 suites / 274 tests |
| `verify:safety`, `demo:verify`, `verify:geography`, `verify:booleans` | all pass against a freshly seeded database |
| `verify:e2e-isolation`, `verify:migrations`, `verify:single-react`, `verify:android-release` | all pass |
| `expo export --platform android` / `--platform ios` | both bundle: 7.3 MB and 7.0 MB of Hermes bytecode |

The one thing that cannot be reproduced here is expo-doctor's two network
checks (`api.expo.dev` is refused by this environment). Those ran green in #153,
on the same `package.json`.

---

## 20. Sprint 12 — configuration, and what a build is allowed to do

### 20.1 Three questions, not one

`docs/mobile-release-blockers.md` now opens with the distinction this document
had been blurring: **A** code/native buildability, **B** production runtime
readiness, **C** store submission readiness. A is provable here and is not
proven yet (`NATIVE_BUILD_NOT_COMPILED`). B and C are not claimable at all
while the external rows are open, and every blocker row says which of the three
it blocks.

### 20.2 The API address

The app derived its API host from whichever machine served the bundle, in every
build, with `http://localhost:3001` underneath it — `http://10.0.2.2:3001` on
Android, which is the emulator's alias for its own host and reaches nothing on
a phone. In a store build that is an app pointed at the donor's handset, and
the failure surfaced as "the server took too long to respond", which reads as a
bad connection.

There is now an environment, stated rather than inferred:

| | Address | Rule |
| --- | --- | --- |
| development | explicit if set, else derived from Metro | anything, localhost included |
| preview | explicit only | must exist on the network; cleartext permitted for a private staging host |
| production | explicit only | https, and never the device itself |

A production build without a valid address **fails at config-evaluation time**
— `eas build --profile production` stops before building — and, if one somehow
existed, the client throws `API_NOT_CONFIGURED` without sending a request.
`EXTERNAL_BLOCKER_PRODUCTION_API` stays open and now blocks building as well as
running, which is the intended trade. No hostname has been invented.

It is deliberately **not** keyed on `__DEV__`. `expo export` and the visual-QA
harness both produce release bundles that point at localhost on purpose, and a
rule keyed on `__DEV__` would have refused the only way this app has ever been
photographed.

### 20.3 The configuration layer

`app.json` remains the static base and every value in it is unchanged.
`app.config.ts` layers on the four per-build values that must never be
committed: the environment, the API address, the EAS project id and the Android
Maps key. The logic is in `src/config/app-config.ts` — in `src/`, because that
is the tree jest runs and eslint checks, and the file that decides production
configuration should not be the one file nothing tests. It has no relative
imports: Expo transpiles only the config entry, so a sibling `.ts` import would
go to Node's loader and fail to resolve.

### 20.4 Push and maps stop pretending

Push had a seam nobody could set and a `catch` that flattened "this build can
never receive a notification" into one `console.warn` — in a store build, into
nothing at all — while the notification settings screen showed six enabled
toggles above it. Registration now returns what happened (`registered`,
`permission-not-granted`, `not-configured`, `failed`), a missing project is
detected before the call rather than inferred from its exception, and the
screen says so. `EXTERNAL_BLOCKER_EAS_PROJECT_ID` is unchanged; the seam ships
unset and no id has been invented.

The Android Maps key has a seam that reaches the manifest and is stripped from
the public OTA manifest, which is where a key belongs. Without one the map says
it is unavailable rather than rendering a grey rectangle that, on the SOS screen
during a live emergency, is indistinguishable from a map still loading.

### 20.5 The location prompt

Foreground-only was already true and is unchanged. The prompt was not: it
described two of the four things the app uses location for and led with the
rarest. It now leads with the everyday one and names all four — nearest
centres, the home area saved at onboarding, an emergency journey, a courier
delivery — and says "authorised hospital staff" and "while you use the app".
`ACCESS_BACKGROUND_LOCATION` is now blocked outright so a future config plugin
cannot add it quietly. Collection behaviour is not broadened; the
Play data-safety and App Privacy answers must name all four purposes when they
are filled in (§13, §14).

### 20.6 The check that was not checking

`pnpm verify:android-release` asserted that the identifiers were *present*. The
blockers page said it "fails the build if either regresses". It did not — the
identifier could have become anything with CI green. It now reads the resolved
config rather than the static file, compares both identifiers and the scheme
against expected values, asserts the permission prompt still covers every use,
and proves the fail-closed rule by asking for a production config with no
address and requiring the refusal. Each guard was verified by breaking the
value and watching the check fail.

### 20.7 The Expo slug, and an identifier that did not change

The slug was `donor` — the deep-link scheme's word, not a project identity.
Nothing reads it: no `Constants.expoConfig.slug` anywhere, no `owner`, no
`extra.eas.projectId`, no `updates` block, no `expo.dev` URL, and `eas.json`
carries channels only. It is `bloodchain` now, which is free while no EAS
project exists and stops being free the moment one does.

`scheme: donor` is untouched and now asserted — the API mints password-reset
and verification links against it.

The application identifier stays `uz.bloodchain.donor`. A later brief specified
`com.bloodchainga.mobile`; put to the Product Owner against the S11.1
ratification, the answer was that the S11.1 decision stands. See "A decision
that was superseded" in `docs/mobile-release-blockers.md`.

### 20.8 Node

`react-native` 0.86.3 declares a floor of `^22.13.0`. Nothing in the repository
declared one, and CI's `NODE_VERSION: '22'` resolves to whatever the runner
image has cached, which may sit below it. `apps/mobile/package.json` now states
the range and CI pins `22.22.2`, the version `eas.json` already builds with.
Scoped to the mobile package on purpose: a root `engines` field is enforced by
pnpm across all eleven workspaces, which is the monorepo-wide change this sprint
is not (§12, and the same reason TypeScript stays at 5.9.3).

### 20.9 expo-doctor, and what "green" means

Two of its checks reach `api.expo.dev` and `reactnative.directory`. This
environment's egress policy refuses both (403), so from here they are
**`NETWORK_UNVERIFIED`** — a tracked row in the blockers register, not a pass.
The other 19 run offline and pass. expo-doctor is never to be described as
"fully green" from an environment that could not execute its online checks;
the last run that did was CI #153.

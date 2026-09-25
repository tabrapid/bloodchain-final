# Mobile release blockers

One page, one row per blocker, with the token the Product Owner tracks it by.
Nothing here can be closed by engineering alone except where the "Owner" column
says so.

Detail lives in `docs/mobile-release-readiness.md` (§13 Play, §14 App Store,
§15 decisions) and, for deletion, in `docs/mobile-account-deletion.md`.

| Token | State | What is blocked | Owner |
| --- | --- | --- | --- |
| `EXTERNAL_BLOCKER_PRODUCTION_API` | **Open** | A release build has no API to talk to. `src/api/config.ts` derives the address from whatever served the bundle, which is right for development and meaningless in a store build; `EXPO_PUBLIC_API_URL` has to be set to a real host at build time. | Product Owner — supply the hostname and say whether the pilot runs against a public TLS endpoint or a private network |
| `EXTERNAL_BLOCKER_EAS_PROJECT_ID` | **Open** | Push notifications cannot register, and no EAS build can be made. `getExpoPushTokenAsync` needs a project id; there is no Expo account for this product. | Product Owner — create the Expo account and EAS project |
| `EXTERNAL_BLOCKER_ANDROID_MAPS_KEY` | **Open** | Every map on Android renders blank in a release build. iOS is unaffected (`PROVIDER_DEFAULT` is Apple Maps, which needs no key). Affects the SOS journey and the courier delivery screen. | Product Owner — fund a Google Maps key, or authorise a provider change |
| `EXTERNAL_BLOCKER_STORE_SIGNING` | **Open** | Nothing can be signed or uploaded: no Android upload keystore, no Apple Developer Program membership, certificate or provisioning profile. | Product Owner |
| `EXTERNAL_BLOCKER_APP_ICON_SPLASH` | **Open** | `app.json` declares neither, so a build ships Expo's placeholder. Both stores reject that, and the Play listing also needs a feature graphic. | Product Owner — supply artwork |
| `STORE_BLOCKER_ACCOUNT_DELETION` | **Open** | Both stores require an app that creates accounts to offer in-app deletion. This app has no deletion endpoint and, until S11.1, told donors to "contact support" — a channel that does not exist anywhere in this product. The UX is designed and documented; the backend behaviour is gated on legal review. See `docs/mobile-account-deletion.md`. | Product Owner + legal/privacy, then engineering |
| `STORE_BLOCKER_DATA_EXPORT` | **Open** | The same row above it: no export endpoint exists. Whether this is legally required in Uzbekistan is not for engineering to decide, and no retention or export rule has been invented here. | Product Owner + legal/privacy |
| `PHYSICAL_DEVICE_NOT_VERIFIED` | **Open** | No physical device, emulator or simulator has ever run this app. Everything claimed about it is from tests, computation, and browser-rendered screenshots. | Engineering, once hardware exists |
| `NATIVE_BUILD_NOT_COMPILED` | **Open** | Neither platform has been compiled. iOS needs macOS and Xcode. Android needs the SDK platform 36 and build-tools, which come from `dl.google.com` — refused by this environment's egress policy (403 on CONNECT). Gradle itself, `maven.google.com`, `plugins.gradle.org` and Maven Central are all reachable; the SDK is the one missing piece. | Engineering, on a runner with an Android SDK / a macOS machine |
| `NATIVE_VISUAL_QA_NOT_PERFORMED` | **Open** | The simulator/emulator capture in `apps/mobile/qa/visual/run-native-capture.sh` has never been run, for the same reason. The browser capture *has* been run and is in `artifacts/mobile-v2-visual-qa/`. | Engineering, on a macOS machine |
| `IOS_PERMISSION_STRINGS_ENGLISH_ONLY` | **Open** | The Info.plist usage description is English only. The app ships Uzbek, Russian and English; iOS localises these through per-language `InfoPlist.strings`, which Expo's CNG does not generate. A donor whose phone is in Uzbek reads the location prompt in English. | Product Owner — ship English for the pilot, or fund a config plugin |
| `IOS_EXPORT_COMPLIANCE_UNDECLARED` | **Open** | `ITSAppUsesNonExemptEncryption` is not declared, so every submission stops and asks. | Product Owner — answer once, then it is a one-line config change |

## Closed in Sprint 11.1

| Token | How it closed |
| --- | --- |
| `PO-1 Hermes V1 memory regression` | SDK 57.0.25 / React Native 0.86.3 carries the fixed Hermes. expo-doctor's own check passes now and still runs (`--verbose` shows it in the list), so this is a pass rather than a check that stopped applying. |
| `APP_IDENTIFIERS_UNDECIDED` | `uz.bloodchain.donor` on both platforms, accepted by the Product Owner in S11.1. `scheme = donor` is unchanged. `pnpm verify:android-release` fails the build if either regresses. |

## What closes the three native rows

`NATIVE_BUILD_NOT_COMPILED`, `NATIVE_VISUAL_QA_NOT_PERFORMED` and
`PHYSICAL_DEVICE_NOT_VERIFIED` need no decision — only a machine this
environment does not have. These are the commands, so that closing them is an
afternoon rather than an investigation.

**Android**, on any machine with the SDK (platform 36, build-tools) and an AVD:

```bash
pnpm install
emulator -avd <your-avd> &                     # or attach a phone over USB
cd apps/mobile
./qa/visual/run-native-capture.sh android      # prebuild, compile, install, launch, capture
```

**iOS**, on macOS with Xcode:

```bash
pnpm install
xcrun simctl boot 'iPhone 16'
cd apps/mobile
./qa/visual/run-native-capture.sh ios          # prebuild, compile, install, launch, capture
```

Both need the seeded API answering on `:3001` first (§1 of the QA README, and
the script prints the commands if it is not). It also needs Maestro:
`curl -Ls https://get.maestro.mobile.dev | bash`.

The script checks its prerequisites first, then runs `expo prebuild` and
`expo run:android --variant release` / `expo run:ios --configuration Release` —
which is the compilation — installs the binary, drives the Maestro flows, and
files the screenshots into the same
`artifacts/mobile-v2-visual-qa/<device>/<screen>/<state>.png` layout the browser
capture used, so the two sit side by side in the report.

For the compile on its own, without a device: `expo prebuild --platform android`
and then `./gradlew :app:assembleRelease` in `apps/mobile/android`. That alone
closes `NATIVE_BUILD_NOT_COMPILED`; a binary that launches and is driven through
the flows closes the other two.

Prerequisites, flags and what each Maestro flow can and cannot reach are in
`apps/mobile/qa/visual/README.md`.

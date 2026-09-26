# Mobile release blockers

One page, one row per blocker, with the token the Product Owner tracks it by.
Nothing here can be closed by engineering alone except where the "Owner" column
says so.

Detail lives in `docs/mobile-release-readiness.md` (§13 Play, §14 App Store,
§15 decisions) and, for deletion, in `docs/mobile-account-deletion.md`.

## Three questions, not one

"Is the mobile app ready?" has three answers and they are not the same answer.
Collapsing them is how a project talks itself into believing that a green test
suite means a shippable product.

| | What it means | What would prove it |
| --- | --- | --- |
| **A — code/native buildability** | The code compiles into a binary for each platform. | A real `./gradlew :app:assembleRelease` and an Xcode build that succeed. Needs no credentials, no hostname, no accounts. |
| **B — production runtime readiness** | That binary, installed, can do the job: reach its API, receive an emergency notification, draw a map. | A production API hostname, an EAS project, an Android Maps key — none of which exist. |
| **C — store submission readiness** | Google and Apple will accept it. | Signing credentials, developer accounts, icon and splash artwork, account deletion, and the two privacy declarations. |

**A can be proven here. B and C cannot be claimed at all** while the rows below
are open, and no amount of engineering closes them — they are accounts,
hostnames and legal decisions. Every row carries the category it blocks.

| Token | Blocks | State | What is blocked | Owner |
| --- | --- | --- | --- | --- |
| `EXTERNAL_BLOCKER_PRODUCTION_API` | B | **Open** | A release build has no API to talk to, and as of S12 it refuses to be one: `app.config.ts` fails the build and the client refuses to send, rather than deriving an address from whatever served the bundle. `EXPO_PUBLIC_API_URL` has to be an https host that is not the device itself. No hostname has been invented here. | Product Owner — supply the hostname and say whether the pilot runs against a public TLS endpoint or a private network |
| `EXTERNAL_BLOCKER_EAS_PROJECT_ID` | B | **Open** | Push notifications cannot register, and no EAS build can be made. `getExpoPushTokenAsync` needs a project id; there is no Expo account for this product. The seam exists (`EXPO_PUBLIC_EAS_PROJECT_ID`) and ships unset — a build without it now says so on the notification settings screen instead of offering toggles that can never fire. | Product Owner — create the Expo account and EAS project |
| `EXTERNAL_BLOCKER_ANDROID_MAPS_KEY` | B | **Open** | Every map on Android renders blank in a release build. iOS is unaffected (`PROVIDER_DEFAULT` is Apple Maps, which needs no key). Affects the SOS journey and the courier delivery screen. The seam exists (`GOOGLE_MAPS_ANDROID_API_KEY` reaches the manifest, never the OTA manifest) and ships unset; without it the map says it is unavailable rather than drawing a grey rectangle. | Product Owner — fund a Google Maps key, or authorise a provider change |
| `EXTERNAL_BLOCKER_STORE_SIGNING` | C | **Open** | Nothing can be signed or uploaded: no Android upload keystore, no Apple Developer Program membership, certificate or provisioning profile. | Product Owner |
| `EXTERNAL_BLOCKER_APP_ICON_SPLASH` | C | **Open** | `app.json` declares neither, so a build ships Expo's placeholder. Both stores reject that, and the Play listing also needs a feature graphic. | Product Owner — supply artwork |
| `STORE_BLOCKER_ACCOUNT_DELETION` | C | **Open** | Both stores require an app that creates accounts to offer in-app deletion. This app has no deletion endpoint and, until S11.1, told donors to "contact support" — a channel that does not exist anywhere in this product. The UX is designed and documented; the backend behaviour is gated on legal review. See `docs/mobile-account-deletion.md`. | Product Owner + legal/privacy, then engineering |
| `STORE_BLOCKER_DATA_EXPORT` | C | **Open** | The same row above it: no export endpoint exists. Whether this is legally required in Uzbekistan is not for engineering to decide, and no retention or export rule has been invented here. | Product Owner + legal/privacy |
| `PHYSICAL_DEVICE_NOT_VERIFIED` | A, B | **Open** | No physical device, emulator or simulator has ever run this app. Everything claimed about it is from tests, computation, and browser-rendered screenshots. | Engineering, once hardware exists |
| `NATIVE_BUILD_NOT_COMPILED` | A | **Open** | Neither platform has been compiled. iOS needs macOS and Xcode. Android needs the SDK platform 36 and build-tools, which come from `dl.google.com` — refused by this environment's egress policy (403 on CONNECT). Gradle itself, `maven.google.com`, `plugins.gradle.org` and Maven Central are all reachable; the SDK is the one missing piece. | Engineering, on a runner with an Android SDK / a macOS machine |
| `NATIVE_VISUAL_QA_NOT_PERFORMED` | A | **Open** | The simulator/emulator capture in `apps/mobile/qa/visual/run-native-capture.sh` has never been run, for the same reason. The browser capture *has* been run and is in `artifacts/mobile-v2-visual-qa/`. | Engineering, on a macOS machine |
| `IOS_PERMISSION_STRINGS_ENGLISH_ONLY` | C | **Open** | The Info.plist usage description is English only. The app ships Uzbek, Russian and English; iOS localises these through per-language `InfoPlist.strings`, which Expo's CNG does not generate. A donor whose phone is in Uzbek reads the location prompt in English. | Product Owner — ship English for the pilot, or fund a config plugin |
| `NETWORK_UNVERIFIED` | A | **Open** | Two of expo-doctor's checks reach `api.expo.dev` and `reactnative.directory`, which this environment's egress policy refuses (403). They are *unverified*, not passing: the other 19 checks run offline and pass, and the two network ones last executed on a CI runner with open egress. expo-doctor must never be reported as "fully green" from here. | Engineering, on a runner or machine with open egress, before store release |
| `IOS_EXPORT_COMPLIANCE_UNDECLARED` | C | **Open** | `ITSAppUsesNonExemptEncryption` is not declared, so every submission stops and asks. | Product Owner — answer once, then it is a one-line config change |

## Closed in Sprint 11.1

| Token | How it closed |
| --- | --- |
| `PO-1 Hermes V1 memory regression` | SDK 57.0.25 / React Native 0.86.3 carries the fixed Hermes. expo-doctor's own check passes now and still runs (`--verbose` shows it in the list), so this is a pass rather than a check that stopped applying. |
| `APP_IDENTIFIERS_UNDECIDED` | `uz.bloodchain.donor` on both platforms, accepted by the Product Owner in S11.1 and reaffirmed in S12. `scheme = donor` is unchanged. `pnpm verify:android-release` compares both identifiers and the scheme against expected values and fails on any difference. **This row used to say that and it was not true**: until S12 the script only checked the fields were non-empty, so the identifier could have become anything with CI green. It is true now, and proven by changing each one and watching the check fail. |

## A decision that was superseded

A later Product Owner brief (the Phase 1 audit acceptance) specified
`com.bloodchainga.mobile` for both platforms and an Expo slug of `bloodchainga`.
Put to the Product Owner against the S11.1 ratification of `uz.bloodchain.donor`,
the answer was that **`uz.bloodchain.donor` stands** and that brief predates it.

So Decision 2 of that brief is not implemented, deliberately. What was taken
from it is the part that did not depend on the brand: the Expo slug really was
the deep-link scheme's word rather than a project identity, nothing reads it,
and it is `bloodchain` now — matching the accepted identifier rather than the
superseded one. `scheme: donor` is untouched, and now asserted.

This is written down because the collision will otherwise be rediscovered by
whoever reads the two briefs next.

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

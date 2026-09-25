# Maestro flows — what they are and how they match

These flows drive the **real app on a real simulator or emulator**, which is the
capture the web harness cannot do. They are written to be run by an operator on
a macOS machine (iOS + Android) or any machine with an Android SDK (Android
only). `qa/visual/README.md` has the commands.

**Selectors.** Maestro matches on the accessibility label first and the visible
text second, which is exactly what `qa/visual/capture.mjs` does in the browser —
so a flow that drifts here has drifted there too, and both break together rather
than one silently passing. Where a control's label is not unique on screen the
flow says `index:`.

**Screenshots.** Every `takeScreenshot` writes to `.maestro/screenshots/` by
default; the runner script moves them into
`artifacts/mobile-v2-visual-qa/<device>/<screen>/<state>.png` so the native
captures land beside the web ones and the report can show them together.

**Data.** The same seeded database and the same two accounts the web harness
uses (`apps/api/prisma/seed.ts`): `donor@donor.local` and `courier@donor.local`,
password `DevelopmentOnly!123`. Start the API first; a flow against an empty
database photographs empty states and claims they are populated ones.

**States.** Maestro cannot intercept the network the way Playwright can, so the
error and loading states in these flows are produced by stopping the API
(`launchApp` with the API down) rather than by faking a response. The runner
script does that between flow groups; each flow says which it needs at the top.

**What still cannot be captured, on any harness:**

- the operating system's own permission dialogs (the app's explainer *before*
  them is captured; the dialog itself belongs to the OS)
- push notification delivery
- anything behind a Google Maps API key on Android (`EXTERNAL_BLOCKER_ANDROID_MAPS_KEY`)

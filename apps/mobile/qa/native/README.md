# Native Android capture — one command

```bash
./apps/mobile/qa/native/capture-android.sh baseline   # before the redesign
./apps/mobile/qa/native/capture-android.sh final      # after it
```

That is the whole operation. No walking through screens by hand.

## What you need first

- The phone plugged in, unlocked, with USB debugging accepted. `adb devices`
  should list exactly one device.
- `maestro` — `curl -Ls https://get.maestro.mobile.dev | bash`
- The API running against the seeded database, on `localhost:3001`. The script
  refuses to start without it and prints the commands.

Nothing else. The script builds and installs the app itself.

## What it does

1. Checks `adb`, `maestro`, `node`, exactly one device, and the API.
2. `adb reverse tcp:3001` — a phone on USB has no route to your laptop's
   localhost; this gives it one, and removes it again on exit.
3. Builds and installs a release binary on the phone.
4. Grants location and notification permissions with `pm grant`, so no OS
   dialog needs a human. This is the same grant the dialog performs, on this
   one device.
5. Drives the app through the fifteen target screens, then the Russian and
   Uzbek passes, the loading and empty states, and — with the tunnel genuinely
   removed — the error state.
6. Re-runs three screens with the display overridden to 360dp, then restores
   your phone. The override changes what the framework reports, so the layout
   really reflows; it is not a scaled image of a bigger screen.
7. Writes `manifest.json`.

Output: `artifacts/mobile-v3-native-{baseline,final}/android/<screen>/<state>.png`

## What it will not do

**It does not photograph a screen it did not reach.** Every target a flow missed
is recorded as `NATIVE_QA_UNCAPTURED` with the reason, and the manifest counts
it. A capture set whose gaps are invisible is worse than no capture set, because
it gets believed — this repository has already been burned once by 151 captures
that silently photographed a login screen.

It adds no QA route, no debug backdoor and no auth bypass. It signs in through
the same screen a donor uses, with the seeded development account.

## If a flow breaks

Selectors drift when copy changes. The script keeps going, records the affected
targets as uncaptured, and prints the last twelve lines of the failing flow's
log. Fix the selector in `flows/`, re-run — it is idempotent.

Your phone's display is restored on every exit path, including a failure.

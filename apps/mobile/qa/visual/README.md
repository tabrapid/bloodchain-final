# Visual QA harness

Two harnesses, because neither one is sufficient on its own.

| | `capture.mjs` (browser) | `run-native-capture.sh` (simulator/emulator) |
| --- | --- | --- |
| Renders | the real screens, through react-native-web | the real app, through the platform's own renderer |
| Catches | layout, hierarchy, spacing, state handling, text length in three languages | all of that **and** native type, blur, maps, safe areas, keyboard, gestures |
| Needs | this repository and Chromium | macOS + Xcode, or an Android SDK |
| Ran in Sprint 11.1 | yes — every screenshot in `artifacts/` | **no** — no macOS and no Android SDK in that environment |

A browser screenshot is **not** a claim about how the app looks on a phone. It
is evidence about layout and copy, which is most of what a visual review is for,
and it is the reason the findings in the report have file-and-line fixes rather
than adjectives. The native capture is what turns "no clipping at 393pt" into
"no clipping on an iPhone", and it is still outstanding.

---

## 1. The browser capture (runs anywhere)

Three commands, in three terminals or one after the other.

```bash
# 1. A database and an API with the seeded development data.
service postgresql start                      # or your own Postgres on :5432
su postgres -c "createdb bloodchain_visual_qa_dev"
# apps/api/.env is local and gitignored; point it at that database:
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bloodchain_visual_qa_dev"
pnpm --filter @bloodchain/api exec prisma migrate deploy
pnpm --filter @bloodchain/api prisma:seed        # prints the accounts it creates
pnpm --filter @bloodchain/api build
node apps/api/dist/src/main.js                   # listens on 3001

# 2. A web build of the app. BLOODCHAIN_VISUAL_QA=1 is what swaps in the three
#    browser stubs (qa/visual/stubs); without it the app throws on boot.
cd apps/mobile
BLOODCHAIN_VISUAL_QA=1 EXPO_PUBLIC_API_URL=http://localhost:3001 \
  pnpm exec expo export --platform web --output-dir .qa-web-export

# 3. The capture itself.
node qa/visual/capture.mjs --export .qa-web-export --devices iphone,android
```

Output lands in `artifacts/mobile-v2-visual-qa/<device>/<screen>/<state>.png`,
with `screenshots.json` beside it recording, for every shot: the route, the
state, the device and its dimensions, the locale, whether the data came from the
seeded database or from an override, the first lines of text the page rendered,
any element drawn past the right edge, and any console error.

**Serve on port 3000 and open `localhost`.** The API's CORS allowlist
(`WEB_URL` in `apps/api/.env`) contains `http://localhost:3000`, and
`http://127.0.0.1:3000` is a different origin to a browser — every request fails
and every screen photographs its error state while looking like it worked.

Flags: `--devices iphone,android,small` · `--only tabs/home,sos` ·
`--api http://localhost:3001` · `--out <dir>` · `--port 3000`.

**Why a release export is allowed to point at localhost.** `expo export`
produces `__DEV__ === false`, so a policy keyed on that would call this a
production build and refuse the cleartext loopback address the harness needs.
The API rules are keyed on `APP_ENV` instead, which nothing here sets — so this
is a development build, which is what it is. Do not set `APP_ENV=production`
for a capture run; it will fail at config-evaluation time, correctly.

### How a state is produced

`screens.mjs` is the catalogue: every screen, every state, the route that opens
it and the overrides it needs. An override is keyed by part of the request path
(optionally with a method: `POST /appointments`) and is one of `{status}` for a
server error, `{body}` for a substituted response, `{abort:true}` for no
network, `{hang:true}` for a request that never answers — which is what a
loading state actually is.

Populated states use the seeded database and no override at all. The only
fixtures in `fixtures.mjs` are for states a seeded database cannot be asked to
produce on demand: the emergency journey, which needs a hospital to raise a
request and a matcher to match it.

### What the browser harness cannot show you

- native text rendering, and therefore the exact line breaks
- `expo-blur` (the tab bar is drawn opaque here)
- maps — `react-native-maps` is a labelled placeholder (`stubs/react-native-maps.web.js`)
- the operating system's permission dialogs (the app's own explainer *is* captured)
- accessibility font scaling: `PixelRatio.getFontScale()` is always 1 on the web,
  so large-text is a native-only capture
- gesture and scroll behaviour

---

## 2. The native capture (needs macOS or an Android SDK)

```bash
# iOS, on macOS, with a simulator already booted:
xcrun simctl boot 'iPhone 16'
./qa/visual/run-native-capture.sh ios

# Android, with an emulator running:
emulator -avd Pixel_8_API_36 &
./qa/visual/run-native-capture.sh android
```

The script checks its prerequisites before it builds anything, generates the
native project (`expo prebuild`), builds and installs a release binary, runs
every flow in `qa/visual/maestro/`, and files the screenshots into the same
`artifacts/mobile-v2-visual-qa/<device>/<screen>/<state>.png` layout so the
report can put the two side by side.

`maestro/00-shared.md` says how the flows select controls and which states they
can and cannot reach.

---

## 3. Where the three browser stubs come from

`BLOODCHAIN_VISUAL_QA=1` makes `metro.config.js` substitute three modules, for
the web platform only:

| Module | Why |
| --- | --- |
| `expo-secure-store` | no web implementation of `deleteValueWithKeyAsync`; the app throws on boot. The stub is localStorage, which also lets the capture seed a session before the page loads. |
| `expo-notifications` | `getLastNotificationResponseAsync` and the Android channel calls throw on the web. |
| `react-native-maps` | needs a native view; without the stub the map area is a hole in the screenshot, indistinguishable from a layout bug. The stub draws a labelled placeholder at the same size. |

None of this is reachable from a native build: the branch is behind an
environment variable *and* a platform check, and `android`/`ios` never take it.

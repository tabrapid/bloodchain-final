#!/usr/bin/env bash
#
# Native visual capture: the real app, on a simulator or an emulator.
#
# This is the capture the browser harness cannot do. It needs a machine with
# Xcode (iOS) or an Android SDK (Android); neither exists in the environment
# Sprint 11.1 ran in, which is why the report marks the native captures as not
# performed rather than claiming them.
#
#   ./qa/visual/run-native-capture.sh ios
#   ./qa/visual/run-native-capture.sh android
#
# Everything it needs, in order, is checked before anything is built.
set -euo pipefail

PLATFORM="${1:-}"
if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
  echo "usage: $0 ios|android" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # apps/mobile
REPO="$(cd "$ROOT/../.." && pwd)"
OUT="$REPO/artifacts/mobile-v2-visual-qa"
API="${API:-http://localhost:3001}"

say() { printf '\n== %s\n' "$*"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 ($2)" >&2; exit 1; }; }

need node "install Node 22"
need maestro "curl -Ls https://get.maestro.mobile.dev | bash"
if [[ "$PLATFORM" == "ios" ]]; then
  need xcrun "install Xcode and its command line tools"
  [[ "$(uname)" == "Darwin" ]] || { echo "iOS capture needs macOS." >&2; exit 1; }
else
  need adb "install the Android SDK platform-tools"
fi

say "API"
curl -fsS "$API/api/v1/health" >/dev/null || {
  cat >&2 <<EOF
The API is not answering at $API. In another terminal:

  cd $REPO
  service postgresql start                       # or your own Postgres
  createdb bloodchain_visual_qa_dev
  sed -i '' 's#^DATABASE_URL=.*#DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bloodchain_visual_qa_dev"#' apps/api/.env
  pnpm --filter @bloodchain/api exec prisma migrate deploy
  pnpm --filter @bloodchain/api prisma:seed
  pnpm --filter @bloodchain/api build && node apps/api/dist/src/main.js
EOF
  exit 1
}

say "Native project"
# CNG: android/ and ios/ are generated and not committed.
(cd "$ROOT" && pnpm exec expo prebuild --platform "$PLATFORM" --clean)

say "Build and install"
if [[ "$PLATFORM" == "ios" ]]; then
  # A simulator must already be booted; `expo run:ios` picks it up.
  xcrun simctl list devices booted | grep -q Booted || {
    echo "Boot a simulator first, e.g.: xcrun simctl boot 'iPhone 16'" >&2
    exit 1
  }
  (cd "$ROOT" && EXPO_PUBLIC_API_URL="$API" pnpm exec expo run:ios --configuration Release)
  DEVICE_LABEL="ios-simulator-$(xcrun simctl list devices booted | sed -n 's/^ *\(.*\) (.*/\1/p' | head -1 | tr ' ' '-')"
else
  adb devices | grep -q 'device$' || { echo "Start an emulator or attach a device first." >&2; exit 1; }
  # The app talks to the host machine from an emulator via 10.0.2.2, which
  # src/api/config.ts already knows; the reverse tunnel covers a real device.
  adb reverse tcp:3001 tcp:3001 || true
  (cd "$ROOT" && EXPO_PUBLIC_API_URL="$API" pnpm exec expo run:android --variant release)
  DEVICE_LABEL="android-emulator-$(adb shell getprop ro.product.model | tr -d '\r' | tr ' ' '-')"
fi

say "Flows"
rm -rf "$ROOT/.maestro/screenshots"
mkdir -p "$ROOT/.maestro/screenshots"
FAILED=0
for flow in "$ROOT"/qa/visual/maestro/*.yaml; do
  echo "--- $(basename "$flow")"
  maestro test "$flow" || FAILED=1
done

say "Collect"
DEST="$OUT/$DEVICE_LABEL"
mkdir -p "$DEST"
# Flows name their shots <screen-with-dashes>-<state>; fan them back out into
# the screen/state directories the web captures already use.
node - "$ROOT/.maestro/screenshots" "$DEST" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [src, dest] = process.argv.slice(2);
if (!fs.existsSync(src)) process.exit(0);
for (const file of fs.readdirSync(src)) {
  if (!file.endsWith('.png')) continue;
  const name = file.replace(/\.png$/, '');
  // "tabs-home-populated" -> tabs/home/populated
  const parts = name.split('-');
  const state = parts.pop();
  const group = parts.shift();
  const screen = parts.join('-') || group;
  const dir = path.join(dest, group, screen);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(src, file), path.join(dir, `${state}.png`));
}
console.log('collected into', dest);
NODE

say "Done"
echo "screenshots: $DEST"
[[ "$FAILED" == "0" ]] || { echo "one or more flows failed - see the output above" >&2; exit 1; }

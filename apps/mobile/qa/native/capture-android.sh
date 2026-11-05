#!/usr/bin/env bash
#
# ONE COMMAND. The real app, on the real phone plugged into this machine.
#
#   ./apps/mobile/qa/native/capture-android.sh baseline
#   ./apps/mobile/qa/native/capture-android.sh final
#
# It checks what it needs, starts nothing it cannot also stop, builds and
# installs the app, drives it through the fifteen screens Sprint 11.2 asks for
# plus the locale/error/loading/empty states, reconfigures the phone to 360dp
# for three of them, restores it, and writes a manifest.
#
# WHAT IT WILL NOT DO
#
# It will not photograph a screen it did not actually reach. Every target that a
# flow could not get to is recorded as NATIVE_QA_UNCAPTURED with the reason, and
# the manifest says so. A capture set whose gaps are invisible is worse than no
# capture set, because it gets believed.
#
# It also adds no QA route, no debug backdoor and no auth bypass. It signs in
# through the same screen a donor uses, with the seeded development account, and
# the permissions it grants are granted through `pm grant` on this one device --
# the same thing the OS dialog does, without a human tapping it.
set -uo pipefail

MODE="${1:-baseline}"
case "$MODE" in
  baseline|final) ;;
  *) echo "usage: $0 baseline|final" >&2; exit 2 ;;
esac

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE="$(cd "$HERE/../.." && pwd)"
REPO="$(cd "$MOBILE/../.." && pwd)"
OUT="$REPO/artifacts/mobile-v3-native-${MODE}/android"
SHOTS="$(mktemp -d)"
APP_ID="uz.bloodchain.donor"
API="${API:-http://localhost:3001}"

RESTORE_WM=0
FAILED_FLOWS=()

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
die()  { printf '\n\033[31mstopped: %s\033[0m\n' "$*" >&2; exit 1; }

# The phone goes back to its own resolution whatever happens -- a failed flow
# must not leave someone's daily driver at 720x1280.
cleanup() {
  if [[ "$RESTORE_WM" == "1" ]]; then
    adb shell wm size reset >/dev/null 2>&1 || true
    adb shell wm density reset >/dev/null 2>&1 || true
    info "phone display restored"
  fi
  adb reverse --remove tcp:3001 >/dev/null 2>&1 || true
  rm -rf "$SHOTS"
}
trap cleanup EXIT

# ----------------------------------------------------------------- 1. the tools

say "Checking what this needs"
for tool in adb maestro node; do
  command -v "$tool" >/dev/null 2>&1 || die "\`$tool\` is not installed.
  adb     — Android platform-tools
  maestro — curl -Ls https://get.maestro.mobile.dev | bash
  node    — Node 22"
done
info "adb, maestro, node"

# ----------------------------------------------------------------- 2. the phone

say "Checking the phone"
DEVICES="$(adb devices | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$DEVICES" | grep -c . || true)"
[[ "$COUNT" == "1" ]] || die "expected exactly one connected device, found ${COUNT:-0}.
Unplug the others, or set ANDROID_SERIAL and re-run.
If the phone is plugged in and still not listed, unlock it and accept the
'Allow USB debugging?' prompt."

MODEL="$(adb shell getprop ro.product.model | tr -d '\r')"
ANDROID="$(adb shell getprop ro.build.version.release | tr -d '\r')"
RESOLUTION="$(adb shell wm size | tail -1 | awk '{print $NF}' | tr -d '\r')"
DENSITY="$(adb shell wm density | tail -1 | awk '{print $NF}' | tr -d '\r')"
info "$MODEL · Android $ANDROID · $RESOLUTION @ ${DENSITY}dpi"

# ------------------------------------------------------------------- 3. the API

say "Checking the API"
curl -fsS "$API/api/v1/health" >/dev/null 2>&1 || die "the API is not answering at $API.
In another terminal, from $REPO:

  service postgresql start                       # or your own Postgres
  pnpm --filter @bloodchain/api exec prisma migrate deploy
  pnpm --filter @bloodchain/api prisma:seed
  pnpm --filter @bloodchain/api build && node apps/api/dist/src/main.js"

# A phone on USB has no route to this machine's localhost. This gives it one,
# and it is removed again on exit.
adb reverse tcp:3001 tcp:3001 >/dev/null || die "adb reverse failed; the phone cannot reach the API."
info "phone can reach the API on localhost:3001"

# --------------------------------------------------------- 4. build and install

say "Building and installing (this is the slow part)"
(
  cd "$MOBILE" &&
  APP_ENV=development EXPO_PUBLIC_API_URL="http://localhost:3001" \
    pnpm exec expo run:android --variant release --device "$(printf '%s' "$DEVICES")"
) || die "the build failed. The output above says why."

# Granted here rather than tapped by a human. This is the same grant the OS
# dialog performs, scoped to this device and this debug install.
for permission in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS; do
  adb shell pm grant "$APP_ID" "android.permission.$permission" >/dev/null 2>&1 || true
done
info "location and notification permissions granted without a prompt"

# ---------------------------------------------------------------- 5. the flows

run_flow() {
  local flow="$1"
  info "flow: $flow"
  if ! (cd "$SHOTS" && maestro test "$HERE/flows/$flow" >"$SHOTS/$flow.log" 2>&1); then
    FAILED_FLOWS+=("$flow")
    printf '   \033[33m%s did not complete — its targets will be recorded as NATIVE_QA_UNCAPTURED\033[0m\n' "$flow"
    tail -12 "$SHOTS/$flow.log" | sed 's/^/     /'
  fi
}

say "Driving the app"
for flow in 10-auth.yaml 20-tabs.yaml 30-flows.yaml 40-courier.yaml 50-locales.yaml 60-states.yaml; do
  run_flow "$flow"
done

# The error state, with the tunnel genuinely down. Restored immediately after.
say "Error state, with the API actually unreachable"
adb reverse --remove tcp:3001 >/dev/null 2>&1 || true
run_flow 61-error.yaml
adb reverse tcp:3001 tcp:3001 >/dev/null 2>&1 || true

# --------------------------------------------------------- 6. the 360dp variant

say "Re-running three screens at 360dp"
SMALL_W="$(node -e "console.log(require('$HERE/screens.json').smallScreen.width)")"
SMALL_H="$(node -e "console.log(require('$HERE/screens.json').smallScreen.height)")"
SMALL_D="$(node -e "console.log(require('$HERE/screens.json').smallScreen.density)")"
RESTORE_WM=1
adb shell wm size "${SMALL_W}x${SMALL_H}" >/dev/null
adb shell wm density "$SMALL_D" >/dev/null
info "phone reporting ${SMALL_W}x${SMALL_H} @ ${SMALL_D}dpi — the layout really reflows"

mkdir -p "$SHOTS/small"
(cd "$SHOTS/small" && maestro test "$HERE/flows/20-tabs.yaml" >"$SHOTS/small.log" 2>&1) \
  || { FAILED_FLOWS+=("20-tabs.yaml@360dp"); printf '   \033[33mthe 360dp pass did not complete\033[0m\n'; }

adb shell wm size reset >/dev/null 2>&1 || true
adb shell wm density reset >/dev/null 2>&1 || true
RESTORE_WM=0
info "phone display restored"

# ------------------------------------------------------------- 7. the manifest

say "Filing the screenshots"
node "$HERE/manifest.mjs" \
  --shots "$SHOTS" \
  --out "$OUT" \
  --mode "$MODE" \
  --model "$MODEL" \
  --android "$ANDROID" \
  --resolution "$RESOLUTION" \
  --density "$DENSITY" \
  --small "${SMALL_W}x${SMALL_H}@${SMALL_D}" \
  --failed "$(IFS=,; printf '%s' "${FAILED_FLOWS[*]:-}")"

say "Done"
info "screenshots: $OUT"
info "manifest:    $OUT/manifest.json"
if [[ "${#FAILED_FLOWS[@]}" -gt 0 ]]; then
  printf '\n\033[33m%s flow(s) did not complete. The manifest records every screen they\nwould have captured as NATIVE_QA_UNCAPTURED, with the reason. Nothing was\nsubstituted.\033[0m\n' "${#FAILED_FLOWS[@]}"
fi

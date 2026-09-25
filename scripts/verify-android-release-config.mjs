#!/usr/bin/env node
/**
 * What the Android build will actually be configured with.
 *
 * Google Play requires new apps and updates to target a recent API level, and
 * "we target API 36" is the kind of claim that is easy to make and hard to
 * check: nothing in this repository contains the number. The app uses
 * Continuous Native Generation, so `android/` does not exist until someone
 * runs prebuild, and even then `app/build.gradle` only says
 * `targetSdkVersion rootProject.ext.targetSdkVersion`.
 *
 * This resolves the value the way Gradle does, from the same files, and fails
 * if it is not what this sprint committed to:
 *
 *   1. `android/settings.gradle` calls `expoAutolinking.useExpoVersionCatalog()`,
 *      which loads React Native's Gradle version catalog.
 *   2. `react-native/gradle/libs.versions.toml` declares `targetSdk`.
 *   3. expo-modules-autolinking's ExpoRootProjectPlugin reads that catalog
 *      entry into `rootProject.ext.targetSdkVersion`, defaulting to 35 only
 *      when the catalog has no entry.
 *   4. `android/app/build.gradle` uses `rootProject.ext.targetSdkVersion`.
 *
 * A real Gradle build would be better evidence and is not available here:
 * the Android SDK is downloaded from dl.google.com, which this environment's
 * egress policy refuses. Everything above is read from files on disk, so this
 * check runs anywhere the dependencies are installed, CI included.
 *
 * It also asserts the permission and identity decisions that a release depends
 * on, since those live in app.json and are equally easy to lose in a merge.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const MOBILE = 'apps/mobile';
const EXPECTED_TARGET_SDK = 36;
const EXPECTED_MIN_SDK = 24;

/** Permissions the app is entitled to, each with the implemented feature that earns it. */
const PERMITTED = new Map([
  ['android.permission.INTERNET', 'every API call'],
  ['android.permission.ACCESS_COARSE_LOCATION', 'emergency journey tracking and nearest-centre search'],
  ['android.permission.ACCESS_FINE_LOCATION', 'emergency journey tracking and nearest-centre search'],
  ['android.permission.VIBRATE', 'expo-haptics feedback and notification vibration'],
]);

/** Permissions Expo's bare template ships and this app does not use. */
const MUST_BE_BLOCKED = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

// ---------------------------------------------------------------- target SDK

const catalogPath = path.join(MOBILE, 'node_modules/react-native/gradle/libs.versions.toml');
if (!existsSync(catalogPath)) {
  fail(`React Native's Gradle version catalog is missing at ${catalogPath}. Run pnpm install.`);
} else {
  const catalog = readFileSync(catalogPath, 'utf8');
  const read = (key) => catalog.match(new RegExp(`^${key}\\s*=\\s*"(\\d+)"`, 'm'))?.[1];
  const targetSdk = Number(read('targetSdk'));
  const compileSdk = Number(read('compileSdk'));
  const minSdk = Number(read('minSdk'));

  if (targetSdk !== EXPECTED_TARGET_SDK) {
    fail(`targetSdk is ${targetSdk}, expected ${EXPECTED_TARGET_SDK} (react-native/gradle/libs.versions.toml).`);
  } else {
    notes.push(`targetSdk ${targetSdk}  (react-native/gradle/libs.versions.toml)`);
  }
  if (compileSdk !== EXPECTED_TARGET_SDK) {
    fail(`compileSdk is ${compileSdk}, expected ${EXPECTED_TARGET_SDK}.`);
  } else {
    notes.push(`compileSdk ${compileSdk}`);
  }
  if (minSdk !== EXPECTED_MIN_SDK) {
    fail(`minSdk is ${minSdk}, expected ${EXPECTED_MIN_SDK}.`);
  } else {
    notes.push(`minSdk ${minSdk}`);
  }
}

// Confirm the plugin that carries the catalog value into Gradle is the one
// described above, so a future rewrite of that plugin does not pass silently.
// Resolved exactly as android/settings.gradle resolves it -- through `expo`,
// because expo-modules-autolinking is expo's dependency rather than the app's,
// and under pnpm it is not reachable from apps/mobile/node_modules at all.
const requireFromRepo = createRequire(path.resolve('package.json'));
let autolinking = '';
try {
  const expoManifest = requireFromRepo.resolve('expo/package.json', { paths: [path.resolve(MOBILE)] });
  const autolinkingManifest = createRequire(expoManifest).resolve('expo-modules-autolinking/package.json');
  autolinking = path.join(
    path.dirname(autolinkingManifest),
    'android/expo-gradle-plugin/expo-autolinking-plugin/src/main/kotlin/expo/modules/plugin/ExpoRootProjectPlugin.kt',
  );
} catch {
  autolinking = '';
}
if (!autolinking || !existsSync(autolinking)) {
  fail(`ExpoRootProjectPlugin is missing at ${autolinking}; the catalog-to-Gradle link cannot be verified.`);
} else {
  const source = readFileSync(autolinking, 'utf8');
  if (!/setIfNotExist\("targetSdkVersion"\)[\s\S]{0,120}getVersionOrDefault\("targetSdk"/.test(source)) {
    fail(
      'ExpoRootProjectPlugin no longer reads `targetSdk` from the version catalog into ' +
        '`rootProject.ext.targetSdkVersion`. The chain this check relies on has changed; re-derive it.',
    );
  } else {
    notes.push('ExpoRootProjectPlugin reads targetSdk from the catalog into rootProject.ext.targetSdkVersion');
  }
}

// ------------------------------------------------------- identity and permissions

const appJsonPath = path.join(MOBILE, 'app.json');
const { expo } = JSON.parse(readFileSync(appJsonPath, 'utf8'));

if (!expo.android?.package) fail('app.json has no android.package; no release build can be produced.');
else notes.push(`android.package ${expo.android.package}`);

if (!expo.ios?.bundleIdentifier) fail('app.json has no ios.bundleIdentifier; no release build can be produced.');
else notes.push(`ios.bundleIdentifier ${expo.ios.bundleIdentifier}`);

if (expo.android?.package && expo.ios?.bundleIdentifier && expo.android.package !== expo.ios.bundleIdentifier) {
  notes.push('NOTE: the Android package and the iOS bundle identifier differ, which is allowed but unusual here.');
}

if (typeof expo.android?.versionCode !== 'number') {
  fail('app.json has no numeric android.versionCode; Play rejects an upload without one.');
}
if (typeof expo.ios?.buildNumber !== 'string') {
  fail('app.json has no ios.buildNumber string.');
}

const blocked = new Set(expo.android?.blockedPermissions ?? []);
for (const permission of MUST_BE_BLOCKED) {
  if (!blocked.has(permission)) {
    fail(
      `${permission} is not in android.blockedPermissions. Expo's bare template adds it and this app ` +
        'does not use it; shipping it invites a Play Console declaration for a feature that does not exist.',
    );
  }
}

const declared = expo.android?.permissions;
if (Array.isArray(declared)) {
  for (const permission of declared) {
    if (!PERMITTED.has(permission)) {
      fail(`app.json declares ${permission}, which no implemented feature asks for.`);
    }
  }
}

// ------------------------------------------------------------- location claims

const locationPlugin = (expo.plugins ?? []).find(
  (entry) => Array.isArray(entry) && entry[0] === 'expo-location',
);
if (!locationPlugin) {
  fail('The expo-location plugin entry is gone; the iOS usage descriptions would fall back to Expo boilerplate.');
} else {
  const options = locationPlugin[1] ?? {};
  if (!options.locationWhenInUsePermission || typeof options.locationWhenInUsePermission !== 'string') {
    fail('locationWhenInUsePermission must carry the app\'s own wording; it is the only prompt donors see.');
  }
  for (const key of ['locationAlwaysAndWhenInUsePermission', 'locationAlwaysPermission']) {
    if (options[key] !== false) {
      fail(
        `${key} must be false. The app only ever calls requestForegroundPermissionsAsync, and leaving this ` +
          'key in Info.plist claims background location the app neither requests nor performs.',
      );
    }
  }
  if (options.motionUsagePermission !== false) {
    fail('motionUsagePermission must be false; nothing in the app reads motion activity.');
  }
  if (options.isIosBackgroundLocationEnabled || options.isAndroidBackgroundLocationEnabled) {
    fail('Background location is enabled in the config but no background location task is implemented.');
  }
  notes.push('location: foreground only, on both platforms');
}

// ----------------------------------------------------------------------- report

console.log('verify:android-release-config');
for (const note of notes) console.log(`  ${note}`);

if (failures.length === 0) {
  console.log('  OK');
  process.exit(0);
}

console.error(`\n  ${failures.length} problem(s):\n`);
for (const failure of failures) console.error(`  ✖ ${failure}`);
process.exit(1);

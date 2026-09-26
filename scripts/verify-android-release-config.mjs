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

/**
 * The identity, asserted rather than merely present.
 *
 * `docs/mobile-release-blockers.md` has claimed since S11.1 that this check
 * "fails the build if either regresses". It did not: it tested that the fields
 * were non-empty and printed whatever it found, so the identifier could have
 * become anything and CI would have stayed green. The Product Owner accepted
 * `uz.bloodchain.donor` for both platforms and said it must not change again
 * without their approval -- that is the kind of decision a machine should hold,
 * not a sentence in a document.
 */
const EXPECTED_APP_ID = 'uz.bloodchain.donor';

/**
 * Load-bearing in a way the identifier is not.
 *
 * The API mints password-reset and email-verification links as `donor://...`
 * (apps/api/src/config/env.validation.ts, auth.service.ts). Renaming the scheme
 * breaks every link already in someone's inbox, so it is asserted here even
 * though nothing in the mobile build would complain.
 */
const EXPECTED_SCHEME = 'donor';

/**
 * What the iOS location prompt has to tell a donor.
 *
 * The app uses foreground location for four things -- nearest-centre search,
 * the home area saved at onboarding for matching, the emergency journey, and a
 * courier delivery -- and the prompt used to describe two of them, leading with
 * the rarest. Presence of the key is not the requirement; coverage is.
 */
const REQUIRED_LOCATION_PHRASES = [
  'while you use the app',
  'donation centres',
  'emergency',
  'delivery',
  'hospital staff',
];

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
  // Nothing adds this today. A config plugin could, and then the app would be
  // asking Play for a permission it has no background task to justify -- the
  // same untrue claim the iOS Always-location strings used to make.
  'android.permission.ACCESS_BACKGROUND_LOCATION',
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

/**
 * The config the build actually gets, not the file it starts from.
 *
 * `app.json` used to be the whole config, and reading it was the same thing as
 * reading the build. It is now the static base under `app.config.ts`, which
 * layers the per-build values on top -- so a check that reads only the JSON
 * would keep printing a green tick while the thing being built drifted out from
 * under it. Both are read here: the resolved config for what ships, and the raw
 * file to confirm the static half still owns the values it is supposed to own.
 */
const appJsonPath = path.join(MOBILE, 'app.json');
const { expo: staticExpo } = JSON.parse(readFileSync(appJsonPath, 'utf8'));

function resolveConfig(env) {
  const previous = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    // `@expo/config` is expo's dependency, not the app's, so under pnpm it is
    // reachable through expo and from nowhere else -- the same hop the
    // autolinking check above makes.
    const expoManifest = requireFromRepo.resolve('expo/package.json', { paths: [path.resolve(MOBILE)] });
    const { getConfig } = createRequire(expoManifest)('@expo/config');
    // `isPublicConfig: false` keeps `android.config.googleMaps`, which Expo
    // strips from the public manifest -- that key is exactly what we are here
    // to look at.
    return getConfig(path.resolve(MOBILE), {
      skipSDKVersionRequirement: true,
      isPublicConfig: false,
    }).exp;
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

let expo;
try {
  expo = resolveConfig({
    APP_ENV: 'production',
    EXPO_PUBLIC_API_URL: 'https://verify.invalid',
    EXPO_PUBLIC_EAS_PROJECT_ID: undefined,
    GOOGLE_MAPS_ANDROID_API_KEY: undefined,
  });
  notes.push('resolved app.config.ts for a production build');
} catch (error) {
  fail(`app.config.ts could not be resolved for a production build: ${error.message.split('\n')[0]}`);
  expo = staticExpo;
}

for (const [label, value] of [
  ['android.package', expo.android?.package],
  ['ios.bundleIdentifier', expo.ios?.bundleIdentifier],
]) {
  if (!value) fail(`The resolved config has no ${label}; no release build can be produced.`);
  else if (value !== EXPECTED_APP_ID) {
    fail(
      `${label} is ${value}, expected ${EXPECTED_APP_ID}. The Product Owner accepted that ` +
        'identifier for both platforms; it cannot change without their approval, and once a ' +
        'build is published it cannot change at all.',
    );
  } else {
    notes.push(`${label} ${value}`);
  }
}

if (expo.scheme !== EXPECTED_SCHEME) {
  fail(
    `expo.scheme is ${JSON.stringify(expo.scheme)}, expected ${JSON.stringify(EXPECTED_SCHEME)}. ` +
      'The API mints password-reset and verification deep links against this scheme, so renaming ' +
      'it breaks every link already sent.',
  );
} else {
  notes.push(`scheme ${expo.scheme}:// (matches the links the API mints)`);
}

// The static file must still own the identity. If it moved into the dynamic
// layer, the check above would pass while app.json quietly said something else.
if (staticExpo.android?.package !== EXPECTED_APP_ID || staticExpo.ios?.bundleIdentifier !== EXPECTED_APP_ID) {
  fail('app.json no longer carries the identity. It is the static base and must remain the place it is written.');
}
if (staticExpo.scheme !== EXPECTED_SCHEME) {
  fail('app.json no longer carries the deep-link scheme.');
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
  const whenInUse = options.locationWhenInUsePermission;
  if (!whenInUse || typeof whenInUse !== 'string') {
    fail('locationWhenInUsePermission must carry the app\'s own wording; it is the only prompt donors see.');
  } else {
    // Presence was all this used to check, and a string that described two of
    // the four uses passed it. What a donor is agreeing to is the requirement.
    const missing = REQUIRED_LOCATION_PHRASES.filter(
      (phrase) => !whenInUse.toLowerCase().includes(phrase),
    );
    if (missing.length > 0) {
      fail(
        `The iOS location prompt no longer mentions: ${missing.join(', ')}. It has to describe every ` +
          'use the app makes of location -- nearest-centre search, the home area saved at onboarding, ' +
          'the emergency journey and a courier delivery -- not just the ones that come to mind.',
      );
    } else {
      notes.push('location prompt covers every use the app makes of location');
    }
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

// ------------------------------------------------- the config can be loaded at all

/**
 * `app.config.ts` is TypeScript that Node has to `require`.
 *
 * Expo transpiles the config entry file, but its own `require` of
 * `src/config/app-config.ts` goes to Node's loader and relies on type
 * stripping -- unflagged from Node 22.18. That makes the Node version a build
 * dependency rather than a preference: on an older runtime every build fails
 * at config evaluation with a module-not-found, which is a confusing way to
 * learn about a version floor.
 *
 * So it is asserted, in three places that have to agree: the feature is present
 * on this runtime, `apps/mobile/package.json` declares a range that excludes
 * the versions without it, and `eas.json` pins a version inside that range.
 */
if (process.features.typescript !== 'strip' && process.features.typescript !== true) {
  fail(
    `This Node (${process.version}) does not strip TypeScript types when requiring a module, so ` +
      'apps/mobile/app.config.ts cannot be loaded and no build can be configured. ' +
      'Node 22.18 or later is required.',
  );
} else {
  notes.push(`node ${process.version} can require app.config.ts (type stripping: ${process.features.typescript})`);
}

const mobilePackage = JSON.parse(readFileSync(path.join(MOBILE, 'package.json'), 'utf8'));
const declaredNode = mobilePackage.engines?.node;
if (!declaredNode) {
  fail('apps/mobile/package.json declares no engines.node, so nothing states the version floor the config layer needs.');
} else if (!/22\.18|24\.3|25/.test(declaredNode)) {
  fail(
    `apps/mobile/package.json declares engines.node "${declaredNode}", which permits versions ` +
      'without require-time type stripping. app.config.ts cannot load on those.',
  );
}

const easNode = JSON.parse(readFileSync(path.join(MOBILE, 'eas.json'), 'utf8')).build?.base?.node;
if (!easNode) {
  fail('eas.json pins no Node version for builds, so an EAS build could run on one that cannot load app.config.ts.');
} else {
  const [major, minor] = easNode.split('.').map(Number);
  const ok = (major === 22 && minor >= 18) || (major === 24 && minor >= 3) || major >= 25;
  if (!ok) {
    fail(`eas.json builds on Node ${easNode}, which cannot require app.config.ts. Pin 22.18 or later.`);
  } else {
    notes.push(`eas.json builds on node ${easNode}`);
  }
}

// Every EAS profile has to say which environment it is, or the config layer
// falls back to development and a store build quietly skips the strict rules.
const easProfiles = JSON.parse(readFileSync(path.join(MOBILE, 'eas.json'), 'utf8')).build ?? {};
const KNOWN_ENVIRONMENTS = new Set(['development', 'preview', 'production']);
for (const [name, profile] of Object.entries(easProfiles)) {
  if (name === 'base') continue;
  const declared = profile.env?.APP_ENV;
  if (!declared) {
    fail(
      `eas.json profile "${name}" sets no env.APP_ENV. The build would resolve to development ` +
        'and a store build would skip the rules that make it a production one.',
    );
  } else if (!KNOWN_ENVIRONMENTS.has(declared)) {
    // Checking that APP_ENV merely equalled the profile name would bless a
    // profile called "store": the name matches itself, and the config layer
    // has never heard of it.
    fail(
      `eas.json profile "${name}" declares APP_ENV "${declared}", which is not one of ` +
        `${[...KNOWN_ENVIRONMENTS].join(', ')}. app.config.ts would refuse to build it.`,
    );
  }
}
notes.push('every eas.json profile declares a known APP_ENV');

// -------------------------------------------------- the policy, not just the config

/**
 * Prove that a production build with no API address cannot be produced.
 *
 * Everything above reads configuration. This exercises behaviour: it asks
 * `app.config.ts` for a production config with nothing set and requires it to
 * refuse. Without this, the fail-closed rule is a paragraph in a document and
 * a branch nobody runs -- and the one thing this repository keeps learning is
 * that an unexercised claim drifts.
 */
try {
  resolveConfig({
    APP_ENV: 'production',
    EXPO_PUBLIC_API_URL: undefined,
    EXPO_PUBLIC_EAS_PROJECT_ID: undefined,
    GOOGLE_MAPS_ANDROID_API_KEY: undefined,
  });
  fail(
    'A production build with no EXPO_PUBLIC_API_URL was produced. It must fail closed: a store ' +
      'binary with no API address cannot work, and deriving one from the build machine is how it ' +
      'used to ship pointing at localhost.',
  );
} catch (error) {
  if (/not configured and was not produced/.test(error.message)) {
    notes.push('a production build with no API address is refused (fail closed)');
  } else {
    fail(`Production config failed for an unexpected reason: ${error.message.split('\n')[0]}`);
  }
}

// Cleartext and loopback are refused for the same reason.
for (const [label, url] of [
  ['cleartext http', 'http://api.example.org'],
  ['a loopback address', 'https://127.0.0.1:3001'],
]) {
  try {
    resolveConfig({ APP_ENV: 'production', EXPO_PUBLIC_API_URL: url });
    fail(`A production build was produced pointing at ${label} (${url}).`);
  } catch (error) {
    if (!/not configured and was not produced/.test(error.message)) {
      fail(`Production config with ${label} failed for an unexpected reason: ${error.message.split('\n')[0]}`);
    }
  }
}
notes.push('a production build pointing at cleartext or loopback is refused');

// ------------------------------------------------- what is still unconfigured

// Reported, never failed: no Expo project and no Maps key exist for this
// product yet, and inventing either is what the Product Owner ruled out.
if (!expo.extra?.eas?.projectId) {
  notes.push('NOTE: no EAS project id (EXTERNAL_BLOCKER_EAS_PROJECT_ID) -- push cannot register in a release build');
}
if (!expo.extra?.androidMapsConfigured) {
  notes.push('NOTE: no Android Maps key (EXTERNAL_BLOCKER_ANDROID_MAPS_KEY) -- maps are blank on Android');
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

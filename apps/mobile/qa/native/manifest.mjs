#!/usr/bin/env node
/**
 * Files what the phone actually produced, and says plainly what it did not.
 *
 * Maestro writes `<shot>.png` wherever it was invoked. This moves each one into
 * `artifacts/mobile-v3-native-<mode>/android/<screen>/<state>.png` and records
 * it. A target with no PNG is not quietly dropped and not substituted from
 * somewhere else: it gets a `NATIVE_QA_UNCAPTURED` row naming the flow that
 * should have produced it and, where the runner knows, why that flow failed.
 *
 * The count at the end is therefore a count of screens that were really
 * photographed on a real phone, which is the only number worth reporting.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const CATALOGUE = require(path.join(HERE, 'screens.json'));

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1] ?? '');
}

const shotsDir = args.get('shots');
const outDir = args.get('out');
const failedFlows = new Set((args.get('failed') ?? '').split(',').filter(Boolean));

const device = {
  model: args.get('model') || 'unknown',
  androidVersion: args.get('android') || 'unknown',
  resolution: args.get('resolution') || 'unknown',
  density: args.get('density') || 'unknown',
  smallScreenOverride: args.get('small') || null,
};

fs.mkdirSync(outDir, { recursive: true });

/** Maestro may write into the invocation directory or a `screenshots/` child. */
function findShot(root, name) {
  const candidates = [
    path.join(root, `${name}.png`),
    path.join(root, 'screenshots', `${name}.png`),
    path.join(root, '.maestro', 'screenshots', `${name}.png`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

const captured = [];
const uncaptured = [];

function file(target, { small = false } = {}) {
  const suffix = small ? '-360dp' : '';
  const source = findShot(small ? path.join(shotsDir, 'small') : shotsDir, target.shot);

  if (!source) {
    uncaptured.push({
      status: 'NATIVE_QA_UNCAPTURED',
      screen: target.screen,
      route: target.route,
      state: small ? `${target.state}-360dp` : target.state,
      flow: target.flow,
      reason: failedFlows.has(target.flow)
        ? `the flow ${target.flow} did not complete; see its log`
        : `the flow ${target.flow} completed but produced no ${target.shot}.png — the step that should have taken it did not run`,
    });
    return;
  }

  const relative = path.join(target.screen, `${target.state}${suffix}.png`);
  const destination = path.join(outDir, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);

  captured.push({
    status: 'captured',
    screen: target.screen,
    route: target.route,
    state: small ? `${target.state}-360dp` : target.state,
    screenshot: path.join(`mobile-v3-native-${args.get('mode')}`, 'android', relative),
    capturedAt: fs.statSync(source).mtime.toISOString(),
    device: small
      ? { ...device, resolution: device.smallScreenOverride, note: 'display overridden to 360dp via wm size/density' }
      : device,
    ...(target.why ? { why: target.why } : {}),
  });
}

for (const target of CATALOGUE.targets) file(target);
for (const target of CATALOGUE.extras) file(target);

const smallShots = new Set(CATALOGUE.smallScreen.shots);
for (const target of CATALOGUE.targets.filter((t) => smallShots.has(t.shot))) {
  file(target, { small: true });
}

const manifest = {
  mode: args.get('mode'),
  generatedAt: new Date().toISOString(),
  device,
  summary: {
    requested: captured.length + uncaptured.length,
    captured: captured.length,
    uncaptured: uncaptured.length,
  },
  captures: captured,
  uncaptured,
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`   ${captured.length} captured, ${uncaptured.length} NATIVE_QA_UNCAPTURED`);
for (const row of uncaptured) {
  console.log(`     - ${row.screen} (${row.state}): ${row.reason}`);
}

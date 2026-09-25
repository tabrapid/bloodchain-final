#!/usr/bin/env node
/**
 * One React in the mobile app, and one only.
 *
 * This monorepo runs two React major versions on purpose: the three Next.js
 * consoles are on React 18 and the Expo app is on React 19. That is fine
 * while each workspace resolves its own copy. It stops being fine the moment
 * a package the mobile app depends on resolves React from pnpm's *hoisted*
 * copy in `node_modules/.pnpm/node_modules` instead of from the app, because
 * that copy is a single version for the whole repo and it is React 18.
 *
 * The failure this catches is not subtle and not confined to tests. React 19
 * changed the element brand from `Symbol.for('react.element')` to
 * `Symbol.for('react.transitional.element')` and rejects the old one at
 * render time with "A React Element from an older version of React was
 * rendered". Two React copies in one bundle also means two dispatchers, so
 * hooks called through the second copy throw. It surfaced here when
 * `expo-modules-core` -- which declares no `react` peer, so pnpm installs it
 * with none in scope -- rendered every Expo native view (LinearGradient,
 * BlurView, the maps view) through React 18 while the app ran React 19.
 *
 * It was invisible before the upgrade for the worst possible reason: while
 * the app was also on React 18, the hoisted copy and the app's copy were the
 * same version, so the wrong resolution produced the right result. The check
 * exists so the next version split is found by CI rather than by a blank
 * screen on a device.
 *
 * Fix a finding by declaring the missing peer in the root package.json's
 * `pnpm.packageExtensions`, not by pinning a version somewhere.
 */
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const APP = 'apps/mobile';

function real(p) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

function manifest(dir) {
  try {
    return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve `name` as the package in `dir` would see it.
 *
 * pnpm lays a package's dependencies out as SIBLINGS of it inside the virtual
 * store (`.pnpm/<pkg>@<ver>_<peers>/node_modules/{<pkg>,<dep>,...}`) rather
 * than nested beneath it, so the npm-shaped `<dir>/node_modules/<name>` finds
 * nothing for a correctly linked dependency. Both layouts are checked because
 * a workspace package (apps/mobile itself) uses the nested one.
 */
function resolveFrom(dir, selfName, name) {
  // `dir` ends in `<node_modules>/<selfName>`, and selfName may be scoped
  // (`@scope/pkg`), which is two path segments -- so the node_modules root is
  // found by removing exactly the name, not by taking the parent directory.
  const nodeModules = selfName ? dir.slice(0, dir.length - selfName.length - 1) : null;
  return (
    (nodeModules ? real(path.join(nodeModules, name)) : null) ??
    real(path.join(dir, 'node_modules', name))
  );
}

/** Does this package's own shipped code import React at runtime? */
function importsReact(dir) {
  let found = false;
  (function walk(d, depth) {
    if (found || depth > 4) return;
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found) return;
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(path.join(d, entry.name), depth + 1);
      } else if (/\.(js|jsx|mjs|cjs|ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        let source = '';
        try {
          source = readFileSync(path.join(d, entry.name), 'utf8');
        } catch {
          continue;
        }
        // Comments are stripped first. @tanstack/query-core, which does not
        // depend on React at all, carries `import React from 'react'` inside a
        // JSDoc example -- matching raw text reports it as a React consumer.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\`])\/\/.*$/gm, '$1');
        if (
          /from\s+['"]react['"]|require\(\s*['"]react['"]\s*\)|from\s+['"]react\/jsx-(dev-)?runtime['"]/.test(
            code,
          )
        ) {
          found = true;
        }
      }
    }
  })(dir, 0);
  return found;
}

const appDir = real(APP);
if (!appDir) {
  console.error(`verify:single-react — ${APP} not found. Run from the repository root.`);
  process.exit(1);
}
const appReactDir = real(path.join(appDir, 'node_modules/react'));
if (!appReactDir) {
  console.error('verify:single-react — the mobile app has no react installed. Run pnpm install.');
  process.exit(1);
}
const appReact = manifest(appReactDir).version;

/**
 * Type-only packages are skipped: `@types/react` is not React, and resolving
 * it next to a package says nothing about which React renders.
 */
const isTypesPackage = (name) => name.startsWith('@types/');

/**
 * Packages whose React never reaches a device, with the reason. Each one was
 * checked by reading the importing files, not assumed.
 */
const NOT_IN_THE_APP = new Map([
  [
    'istanbul-reports',
    "React appears only in lib/html-spa/**, the coverage report's own page. It is written to disk by the test reporter and never bundled.",
  ],
]);

const seen = new Set();
const findings = [];

function visit(dir, name, chain, depth) {
  if (depth > 8 || seen.has(dir)) return;
  seen.add(dir);
  const pkg = manifest(dir);
  if (!pkg) return;

  if (name && !name.startsWith('@bloodchain/') && !isTypesPackage(name)) {
    const own = resolveFrom(dir, name, 'react');
    if (own) {
      const version = manifest(own)?.version;
      if (version && version !== appReact) {
        findings.push({ name, detail: `resolves react@${version}`, chain });
      }
    } else if (!NOT_IN_THE_APP.has(name) && importsReact(dir)) {
      findings.push({
        name,
        detail: 'imports react but has none in scope, so it falls back to the hoisted copy',
        chain,
      });
    }
  }

  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
    // Only the app's own devDependencies matter; a library's are not installed.
    ...(name === null ? (pkg.devDependencies ?? {}) : {}),
  };
  for (const dep of Object.keys(deps)) {
    if (isTypesPackage(dep)) continue;
    const resolved =
      name === null ? real(path.join(dir, 'node_modules', dep)) : resolveFrom(dir, name, dep);
    if (resolved) visit(resolved, dep, [...chain, dep], depth + 1);
  }
}

visit(appDir, null, ['@bloodchain/mobile'], 0);

console.log(`verify:single-react — mobile app runs react@${appReact}`);
console.log(`  packages inspected: ${seen.size}`);

if (findings.length === 0) {
  console.log('  OK — every package reachable from the mobile app resolves that same React.');
  process.exit(0);
}

console.error(`\n  ${findings.length} package(s) do not:\n`);
for (const finding of findings) {
  console.error(`  ✖ ${finding.name}`);
  console.error(`      ${finding.detail}`);
  console.error(`      via ${finding.chain.join(' > ')}`);
}
console.error(
  '\n  Declare the missing peer in the root package.json under pnpm.packageExtensions:\n' +
    '\n    "<package>": { "peerDependencies": { "react": "*" },' +
    '\n                   "peerDependenciesMeta": { "react": { "optional": true } } }\n',
);
process.exit(1);

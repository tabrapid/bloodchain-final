#!/usr/bin/env node
/**
 * Turns `screenshots.json` into the inventory tables in
 * `docs/mobile-v4-ui-report.md`.
 *
 * The prose in that document is written by hand. The tables are not, because a
 * hand-written inventory of 593 screenshots is a document that is wrong by the
 * second week: every row here is what the capture actually recorded, including
 * the captures that failed and the elements it measured past the right edge.
 *
 *   node qa/visual/report.mjs
 *
 * It rewrites only what is between the two markers and leaves the rest alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../..');
const MANIFEST = path.join(REPO, process.env.QA_MANIFEST ?? 'artifacts/mobile-v4-visual-qa/screenshots.json');
const REPORT = path.join(REPO, process.env.QA_REPORT ?? 'docs/mobile-v4-ui-report.md');

const START = '<!-- generated:inventory:start -->';
const END = '<!-- generated:inventory:end -->';

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

const byScreen = new Map();
for (const shot of manifest) {
  if (!byScreen.has(shot.screen)) byScreen.set(shot.screen, []);
  byScreen.get(shot.screen).push(shot);
}

const devices = [...new Set(manifest.map((s) => s.device))].sort();
const locales = [...new Set(manifest.map((s) => s.locale))].sort();
const failed = manifest.filter((s) => s.failure);
const overflowing = manifest.filter((s) => s.overflow?.length);
const withErrors = manifest.filter((s) => s.consoleErrors?.length);

const lines = [];
lines.push(START);
lines.push('');
lines.push(
  `**${manifest.length} screenshots**, ${byScreen.size} screens, ${devices.length} device sizes ` +
    `(${devices.join(', ')}), ${locales.length} locales (${locales.join(', ')}). ` +
    `${failed.length} captures failed. ${overflowing.length} captures measured content past the right edge. ` +
    `${withErrors.length} captures logged a console error.`,
);
lines.push('');
lines.push('Every link below is relative to `docs/`, so it opens from this file.');
lines.push('');

for (const [screen, shots] of [...byScreen.entries()].sort()) {
  const title = shots[0].title ?? screen;
  lines.push(`### \`${screen}\` — ${title}`);
  lines.push('');
  lines.push('| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const shot of shots.sort((a, b) => a.device.localeCompare(b.device) || a.state.localeCompare(b.state))) {
    const clipping = shot.overflow?.length
      ? `**${shot.overflow.length}** past ${shot.overflow[0].width}pt: “${shot.overflow[0].text.slice(0, 24)}”`
      : 'none measured';
    const console_ = shot.consoleErrors?.length ? `**${shot.consoleErrors.length}**` : '—';
    const result = shot.failure ? `**failed** — ${shot.failure.slice(0, 60)}` : 'captured';
    lines.push(
      `| \`${shot.state}\` | ${shot.intent || '—'} | [png](../artifacts/${shot.screenshot}) | ${shot.dimensions} | ${shot.locale} | ${shot.data} | ${clipping} | ${console_} | ${result} |`,
    );
  }
  lines.push('');
}

if (overflowing.length) {
  lines.push('### Every clipping measurement');
  lines.push('');
  lines.push('| Screen | State | Device | Element | Text | Drawn to | Viewport |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const shot of overflowing) {
    for (const overflow of shot.overflow) {
      lines.push(
        `| \`${shot.screen}\` | ${shot.state} | ${shot.device} | ${overflow.tag} | “${overflow.text}” | ${overflow.right}pt | ${overflow.width}pt |`,
      );
    }
  }
  lines.push('');
}

if (failed.length) {
  lines.push('### Captures that failed');
  lines.push('');
  lines.push('| Screen | State | Device | Why |');
  lines.push('| --- | --- | --- | --- |');
  for (const shot of failed) {
    lines.push(`| \`${shot.screen}\` | ${shot.state} | ${shot.device} | ${shot.failure} |`);
  }
  lines.push('');
}

lines.push(END);

const report = fs.readFileSync(REPORT, 'utf8');
const before = report.slice(0, report.indexOf(START));
const after = report.slice(report.indexOf(END) + END.length);
fs.writeFileSync(REPORT, before + lines.join('\n') + after);

console.log(`${manifest.length} shots across ${byScreen.size} screens -> ${path.relative(REPO, REPORT)}`);

#!/usr/bin/env node
/**
 * Renders the store artwork from the brand mark, so the icon, the adaptive
 * icon layers, the splash image and the Play feature graphic are one drawing
 * at four sizes rather than four files that drift.
 *
 *   node scripts/render-brand-assets.mjs
 *
 * Writes into assets/brand/. Chromium does the rasterising, through the same
 * Playwright the visual-QA harness uses, with the app's own Manrope face for
 * the wordmark. The colours are the design tokens' values, copied here because
 * this runs under Node with no React Native in scope -- change them in
 * src/design/tokens.ts first, then here.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'assets', 'brand');
fs.mkdirSync(OUT, { recursive: true });

// tokens.ts: ink.950 (page), heroGradient, rose.base / rose.fill, ink.100.
const INK_950 = '#0A0C16';
const HERO = ['#3B1530', '#141829'];
const ROSE = '#E44E6B';
const ROSE_FILL = '#D13A58';
const INK_100 = '#F3F4FA';

const manrope = fs
  .readFileSync(path.join(ROOT, 'node_modules/@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf'))
  .toString('base64');

/** The droplet from src/components/BrandMark.tsx, in a 48-unit box. */
const DROP_PATH = 'M24 4 C24 4 8 19.5 8 29 a16 16 0 0 0 32 0 C40 19.5 24 4 24 4 Z';

function drop({ x, y, size, stroke = 5, id }) {
  const scale = size / 48;
  return `
    <g transform="translate(${x} ${y}) scale(${scale})">
      <path d="${DROP_PATH}" stroke="url(#${id})" stroke-width="${stroke}" stroke-linejoin="round" fill="none"/>
    </g>`;
}

const defs = (id) => `
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ROSE}"/>
      <stop offset="1" stop-color="${ROSE_FILL}"/>
    </linearGradient>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${HERO[0]}"/>
      <stop offset="1" stop-color="${HERO[1]}"/>
    </linearGradient>
  </defs>`;

/**
 * The assets, each an SVG at its final pixel size.
 *
 * - icon:        1024×1024, the plum hero gradient with the mark. iOS and the
 *                legacy Android launcher use it whole; the corners are
 *                masked by the platform.
 * - adaptive-fg: 1024×1024, the mark alone on transparency, drawn inside the
 *                66% safe zone Android keeps when it masks the icon.
 * - adaptive-bg: 1024×1024, the hero gradient alone.
 * - splash:      1024×1024 mark on transparency; expo-splash-screen centres
 *                it at `imageWidth` over `backgroundColor`.
 * - feature:     1024×500, the Play listing's header: gradient, mark, wordmark.
 */
const ASSETS = {
  'icon.png': {
    w: 1024,
    h: 1024,
    svg: `
      ${defs('g')}
      <rect width="1024" height="1024" fill="url(#hero)"/>
      ${drop({ x: 192, y: 176, size: 640, stroke: 5.5, id: 'g' })}`,
  },
  'adaptive-icon-foreground.png': {
    w: 1024,
    h: 1024,
    svg: `
      ${defs('g')}
      ${drop({ x: 292, y: 276, size: 440, stroke: 5.5, id: 'g' })}`,
  },
  'adaptive-icon-background.png': {
    w: 1024,
    h: 1024,
    svg: `
      ${defs('g')}
      <rect width="1024" height="1024" fill="url(#hero)"/>`,
  },
  'splash-icon.png': {
    w: 1024,
    h: 1024,
    svg: `
      ${defs('g')}
      ${drop({ x: 192, y: 176, size: 640, stroke: 5, id: 'g' })}`,
  },
  'feature-graphic.png': {
    w: 1024,
    h: 500,
    svg: `
      ${defs('g')}
      <rect width="1024" height="500" fill="url(#hero)"/>
      ${drop({ x: 150, y: 130, size: 240, stroke: 5, id: 'g' })}
      <text x="430" y="262" font-family="Manrope" font-size="104" font-weight="800" letter-spacing="-3" fill="${INK_100}">Bloodchain</text>
      <text x="436" y="322" font-family="Manrope" font-size="30" font-weight="800" letter-spacing="4" fill="${ROSE}">PEOPLE SAVE LIVES</text>`,
  },
};

const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const [file, { w, h, svg }] of Object.entries(ASSETS)) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Manrope; src: url(data:font/ttf;base64,${manrope}); font-weight: 800; }
    html, body { margin: 0; background: transparent; }
    svg { display: block; }
  </style></head><body>
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${svg}</svg>
  </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(OUT, file),
    omitBackground: true,
    clip: { x: 0, y: 0, width: w, height: h },
  });
  console.log(`${file}  ${w}×${h}`);
}

await browser.close();
console.log(`\nWritten to ${path.relative(ROOT, OUT)}/. Page colour for the splash: ${INK_950}`);

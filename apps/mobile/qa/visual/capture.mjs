#!/usr/bin/env node
/**
 * The visual-QA capture harness.
 *
 * WHAT THIS IS. It renders the real screens -- the same files a release build
 * ships -- in Chromium through react-native-web, against a real API with a
 * seeded database, and photographs every screen in every state the catalogue
 * names.
 *
 * WHAT THIS IS NOT. It is not the iOS or Android renderer. Yoga, the native
 * text engine, the platform fonts, the blur, the maps and the operating
 * system's own dialogs are all absent or approximated. It catches layout,
 * hierarchy, spacing, state handling and text length -- which is most of what a
 * visual review is about, and demonstrably enough to find real defects -- and
 * it cannot stand in for a simulator. qa/visual/maestro carries the native
 * capture plan for a macOS machine, and the report says which findings came
 * from which.
 *
 *   node qa/visual/capture.mjs --export <dir> [--api http://localhost:3001]
 *                              [--out ../../artifacts/mobile-v2-visual-qa]
 *                              [--devices iphone,android] [--only home,sos]
 *
 * See qa/visual/README.md for the three commands that produce <dir>.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveExport } from './server.mjs';
import { ACCOUNTS, signIn, discoverIds, discoverSlot, discoverLabSlot } from './discover.mjs';
import { buildCatalogue } from './screens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1] ?? 'true']);
    return pairs;
  }, []),
);

const EXPORT_DIR = path.resolve(args.export ?? path.join(HERE, '../../.qa-web-export'));
const OUT_DIR = path.resolve(args.out ?? path.join(HERE, '../../../../artifacts/mobile-v2-visual-qa'));
const API = args.api ?? 'http://localhost:3001';
const PORT = Number(args.port ?? 3000);
const ORIGIN = `http://localhost:${PORT}`;

/**
 * Two phone sizes as the Product Owner asked, plus a small one for the screens
 * where 640 points of height is the thing most likely to break.
 *
 * deviceScaleFactor is 2 rather than 3 only to keep the artifact a reasonable
 * size; it changes nothing about layout.
 */
const DEVICES = {
  iphone: { label: 'iphone-393x852', width: 393, height: 852, scale: 2, note: 'iPhone 15/16 class' },
  android: { label: 'android-412x915', width: 412, height: 915, scale: 2, note: 'Pixel 8 class' },
  small: { label: 'small-360x640', width: 360, height: 640, scale: 2, note: 'small Android phone' },
};

const wanted = (args.devices ?? 'iphone,android').split(',').map((d) => d.trim());
const only = args.only ? args.only.split(',').map((s) => s.trim()) : undefined;

/* ------------------------------------------------------------------ */

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Serve a state's overrides in front of the API.
 *
 * A route entry is keyed by a substring of the request path, which is enough to
 * be unambiguous here and readable in the catalogue, and is one of:
 *   { status }            answer with that status and an error body
 *   { body }              answer 200 with that body, wrapped in { data } as the
 *                         API wraps everything
 *   { abort: true }       refuse the connection, which is what "no network"
 *                         looks like to the app
 *   { hang: true }        never answer, which is what "still loading" looks like
 */
async function installOverrides(context, overrides = {}) {
  const entries = Object.entries(overrides);
  if (!entries.length) return;

  await context.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname + url.search;
    // A key may name a method -- 'POST /appointments' overrides the booking
    // call without also overriding GET /appointments/availability, which the
    // same screen needs in order to have anything to confirm.
    const match = entries.find(([key]) => {
      const [verb, ...rest] = key.split(' ');
      return rest.length ? verb === method && path.includes(rest.join(' ')) : path.includes(key);
    });
    if (!match) return route.continue();

    const [, rule] = match;
    if (rule.abort) return route.abort('connectionrefused');
    if (rule.hang) return new Promise(() => {});
    if (rule.status) {
      return route.fulfill({
        status: rule.status,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: rule.status,
          code: rule.code ?? 'INTERNAL_ERROR',
          message: rule.message ?? 'Something went wrong.',
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: rule.body }),
    });
  });
}

/** Let the screen settle: fonts, the query cache, and any entrance animation. */
async function settle(page, ms = 1200) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
}

/** Everything a screenshot needs to be understood later, recorded as we go. */
const manifest = [];

/**
 * A session that is still valid when the shot is taken.
 *
 * Access tokens last fifteen minutes and a full run takes longer than that, so
 * signing in once meant every capture after the fifteenth minute photographed
 * the login screen -- 151 of them, on a run that reported no failures. The
 * refresh token cannot save it either: refresh rotates, and each capture gets a
 * fresh browser context carrying the same seeded token, so the first context to
 * refresh invalidates it for all the others.
 *
 * Re-signing in on a timer costs one request every ten minutes per account,
 * which is inside AUTH_THROTTLE_LIMIT with room to spare.
 */
const SESSION_TTL_MS = 10 * 60 * 1000;
const sessions = new Map();

async function sessionFor(role) {
  const held = sessions.get(role);
  if (held && Date.now() - held.at < SESSION_TTL_MS) return held.tokens;

  const tokens = await signIn(API, ACCOUNTS[role]);
  sessions.set(role, { tokens, at: Date.now() });
  return tokens;
}

async function capture(browser, device, screen, state) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.scale,
    isMobile: true,
    hasTouch: true,
    locale: state.locale ?? 'en-US',
    timezoneId: 'Asia/Tashkent',
    colorScheme: state.theme === 'light' ? 'light' : 'dark',
    reducedMotion: 'reduce',
  });

  const consoleErrors = [];
  const account = screen.auth === false ? null : await sessionFor(screen.auth ?? 'donor');
  await context.addInitScript(
    ([tokens, locale, theme]) => {
      if (tokens) {
        localStorage.setItem('donor_access_token', tokens.accessToken);
        localStorage.setItem('donor_refresh_token', tokens.refreshToken);
      } else {
        localStorage.removeItem('donor_access_token');
        localStorage.removeItem('donor_refresh_token');
      }
      localStorage.setItem('donor_locale', locale);
      if (theme) localStorage.setItem('donor_theme', theme);
    },
    [account, state.locale?.slice(0, 2) ?? 'en', state.theme ?? null],
  );

  await installOverrides(context, state.routes);

  const page = await context.newPage();
  // A phone never draws the browser's focus ring; the harness should not
  // photograph one around whichever element Chromium focused on load.
  page.on('domcontentloaded', () => {
    page.addStyleTag({ content: '*:focus, *:focus-visible { outline: none !important; }' }).catch(() => undefined);
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error).slice(0, 300)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300));
  });

  const url = ORIGIN + (state.url ?? screen.url);
  let failure;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await settle(page, state.settle ?? 1400);
    if (state.act) await state.act(page);
    await settle(page, state.actSettle ?? 700);
  } catch (error) {
    failure = String(error).split('\n')[0].slice(0, 200);
  }

  const dir = path.join(OUT_DIR, device.label, screen.id);
  ensureDir(dir);
  const file = path.join(dir, `${state.id}.png`);
  await page.screenshot({ path: file, fullPage: state.fullPage ?? false }).catch(() => {});

  // What the page actually said, so a screenshot can be checked against text
  // rather than only looked at -- and so an empty screen is distinguishable
  // from a screen that failed to render at all.
  const text = await page
    .evaluate(() => document.body.innerText.replace(/\s+\n/g, '\n').trim())
    .catch(() => '');

  // Anything drawn past the right edge is clipping, which is the single most
  // likely consequence of Russian and Uzbek being longer than English.
  const overflow = await page
    .evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll('*')]
        // `<input>` carries an intrinsic width on the web -- about twenty
        // characters -- which React Native's TextInput does not have at all: on
        // a device the field is exactly its container. Measuring it here
        // reported every two-column name row as 34pt of clipping that does not
        // exist on either platform, so the scan skips the element whose width
        // is the renderer's rather than the layout's.
        .filter((el) => el.tagName !== 'INPUT')
        .filter((el) => el.getBoundingClientRect().right > width + 1)
        .slice(0, 6)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? '').trim().slice(0, 60),
          right: Math.round(el.getBoundingClientRect().right),
          width,
        }));
    })
    .catch(() => []);

  // A screen that needs a session and photographed the login screen is not a
  // screenshot of that screen. Say so rather than filing it.
  const signedOut =
    screen.auth !== false && /Welcome back|Sign in to your Bloodchain/i.test(text) && !screen.id.startsWith('auth/');
  if (signedOut && !failure) {
    failure = 'rendered the login screen: the session was not valid when the shot was taken';
  }

  manifest.push({
    screenshot: path.relative(path.dirname(OUT_DIR), file),
    screen: screen.id,
    title: screen.title,
    route: state.url ?? screen.url,
    state: state.id,
    intent: state.intent ?? '',
    device: device.label,
    dimensions: `${device.width}x${device.height} @${device.scale}x`,
    locale: state.locale?.slice(0, 2) ?? 'en',
    theme: state.theme ?? 'dark',
    data: state.data ?? (state.routes ? 'overridden' : 'seeded database'),
    textLength: text.length,
    firstLines: text.split('\n').slice(0, 4).join(' | '),
    overflow,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 3),
    failure,
  });

  await context.close();
  return { file, failure, blank: text.length < 20 };
}

/* ------------------------------------------------------------------ */

async function main() {
  if (!fs.existsSync(path.join(EXPORT_DIR, 'index.html'))) {
    throw new Error(
      `No web export at ${EXPORT_DIR}. Build one first:\n\n  BLOODCHAIN_VISUAL_QA=1 EXPO_PUBLIC_API_URL=${API} \\\n    pnpm --filter @bloodchain/mobile exec expo export --platform web --output-dir .qa-web-export\n`,
    );
  }

  const health = await fetch(`${API}/api/v1/health`).catch(() => undefined);
  if (!health?.ok) {
    throw new Error(`The API is not answering at ${API}. See qa/visual/README.md for the three commands.`);
  }

  const server = await serveExport(EXPORT_DIR, PORT);
  const donor = await sessionFor('donor');
  try {
    await sessionFor('courier');
  } catch {
    console.warn('! courier@donor.local did not sign in - courier screens will fail rather than be filed signed out');
  }

  const ids = await discoverIds(API, donor.accessToken);
  const slot = await discoverSlot(API, donor.accessToken, ids.organizationId);
  const labSlot = await discoverLabSlot(API, donor.accessToken, ids.laboratoryId, ids.testTypeId);

  const catalogue = buildCatalogue({ ...ids, ...slot, lab: labSlot }).filter(
    (screen) => !only || only.some((prefix) => screen.id.startsWith(prefix)),
  );

  ensureDir(OUT_DIR);
  const browser = await chromium.launch({
    executablePath: process.env.QA_CHROMIUM ?? undefined,
    args: ['--force-color-profile=srgb', '--font-render-hinting=none'],
  });

  let count = 0;
  const problems = [];
  for (const deviceKey of wanted) {
    const device = DEVICES[deviceKey];
    if (!device) throw new Error(`Unknown device "${deviceKey}". Known: ${Object.keys(DEVICES).join(', ')}`);

    for (const screen of catalogue) {
      for (const state of screen.states) {
        if (state.devices && !state.devices.includes(deviceKey)) continue;
        const { failure, blank } = await capture(browser, device, screen, state);
        count += 1;
        const flag = failure ? ' FAILED' : blank ? ' BLANK' : '';
        process.stdout.write(`${String(count).padStart(3)} ${device.label} ${screen.id}/${state.id}${flag}\n`);
        if (failure || blank) problems.push(`${device.label} ${screen.id}/${state.id}${flag}`);
      }
    }
  }

  await browser.close();
  server.close();

  // Merge rather than replace.
  //
  // A `--only` run used to write a manifest containing just the screens it
  // captured, which silently threw away the record of the other 470 -- the
  // screenshots stayed on disk and the index no longer mentioned them.
  const manifestPath = path.join(OUT_DIR, 'screenshots.json');
  const held = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : [];
  const key = (shot) => `${shot.device}/${shot.screen}/${shot.state}`;
  const merged = new Map(held.map((shot) => [key(shot), shot]));
  for (const shot of manifest) merged.set(key(shot), shot);

  fs.writeFileSync(manifestPath, JSON.stringify([...merged.values()], null, 2));
  console.log(`\n${count} screenshots -> ${OUT_DIR}`);
  if (problems.length) {
    console.log(`\n${problems.length} captures need looking at:`);
    problems.forEach((p) => console.log('  ' + p));
  }
}

main().catch((error) => {
  console.error('\n' + error.message);
  process.exit(1);
});

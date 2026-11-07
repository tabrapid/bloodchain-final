# Bloodchain identity

The supplied reference has been redrawn as clean outlined vectors: navy **Blood**, red **chain**, and the combined B/drop symbol. The logo itself uses paths, not a font or embedded raster image. The white/noisy reference background is transparent in the SVG assets.

## Canonical files

- `packages/brand/geometry.json`: platform-independent source geometry and palette; no React or web/native dependencies.
- `packages/brand/assets/bloodchain-logo.svg`: full wordmark for light surfaces.
- `packages/brand/assets/bloodchain-logo-dark.svg`: light/red wordmark for dark surfaces.
- `packages/brand/assets/bloodchain-mark.svg`: standalone B/drop.
- `packages/brand/assets/bloodchain-mark-dark.svg`: standalone dark-surface variant.
- `packages/brand/assets/bloodchain-icon.svg`: white-backed square favicon.

Web interfaces use the shared `BrandLogo` component (`@bloodchain/ui/brand`, or the existing components export). Mobile's `BrandMark` renders the same geometry through `react-native-svg`; it depends only on the data package, preserving mobile's React version.

Applied to the shared portal sidebar, portal authentication branding, donor sign-in, landing header/footer, all five Next.js favicon routes and downloadable `/brand/` assets. README uses light/dark artwork. Clinical status icons, loading indicators and archived QA screenshots are retained because they are not the product logo.

## Regeneration

From the repository root:

```bash
node scripts/render-brand-svg.mjs
QA_CHROMIUM=/usr/bin/chromium node apps/mobile/scripts/render-brand-assets.mjs
```

Set `QA_CHROMIUM` to your installed Chromium executable, or omit it if Playwright's browser is installed. The second command writes Expo's required PNG formats: launcher icon, adaptive foreground/background, monochrome Android layer, transparent splash mark and 1024×500 store graphic. These are generated formats, not another logo source. Splash background is white to keep the navy mark visible.

Preserve the wordmark's proportions, the negative space around the droplet and the outlined counters. Use the small mark rather than squeezing the full wordmark into a square. Dark variants improve contrast without adding a background to the vector.

Native launcher/splash artwork appears after rebuilding the native app; an already installed binary does not change its launcher icon through a web deployment or JavaScript-only update.

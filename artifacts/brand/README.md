# Brand review

Canonical SVGs are in `packages/brand/assets/`. Native PNGs are generated from those SVGs in `apps/mobile/assets/brand/`.

The branding change affects presentation only. Existing web regression tests, mobile welcome navigation/config tests, React-version checks, native bundle export and web build/type/lint checks are used to validate integration. Screenshot evidence is captured against the built web interfaces without production user data.

Validation completed: all five production web builds; typecheck/lint across seven affected packages; 309 web regression tests; 103 mobile welcome/config tests; native single-React verification and Android production bundle export. Browser checks cover desktop/mobile layouts, transparent outlined SVG downloads and favicons on all five portals, with no page errors or horizontal overflow. Results are in `browser-results.json`.

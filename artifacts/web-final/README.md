# Compact web UI review

Implemented on `modes`; user approved committing and pushing to `claude/local-test-ready` after review. No pull request is required for this direct branch update.

## Scope

- Admin, hospital, and blood center share the compact clinical shell: light content, navy navigation, blue actions, red and amber accents, denser filters, tables, and feedback states. Density preference persists.
- Hospital and center requests use a shared sortable worklist with component quantities, priority, status, and Tashkent timestamps. Missing quantities remain unknown; failed loads offer retry.
- Admin record dialogs use the shared responsive modal. Long content scrolls while the footer stays accessible. Nested dialogs handle Escape independently and retain body scroll lock until the final dialog closes.
- Staff applications use bundled Inter fonts (license: `packages/ui/assets/fonts/OFL.txt`), eliminating Google font requests.
- Landing retains its public design with tighter spacing and responsive sections.

## Verification

- Production builds: admin, hospital, blood center, landing passed.
- Tests: UI 115, admin 38, hospital 72, center 67, i18n 81; total 373 passed.
- Lint passed with existing warnings; `git diff --check` passed.
- `check-browser.cjs`: 7 authenticated viewport/workflow cases and 58 signed-out route smoke checks passed. Checks include table overflow, modal scrolling, nested Escape, density persistence, request load failures/retry, local fonts, and runtime errors.
- `../landing-v3/check-browser.cjs`: six widths (360–1920), navigation, FAQ, form validation, corrected email draft recipient, legal routes, no-JavaScript content passed.
- `../clinical-v2/check-browser.cjs`: technician/reviewer controls, laboratory inspector, component barcode and parent donation, responsive hospital shell passed.

Browser workflow tests use synthetic API fixtures against the production frontend. Signed-out route checks establish route/render coverage, not full authenticated feature coverage. Live backend integration and email delivery were not tested. Existing role/sample-event backend limitations are documented in `../clinical-v2/README.md`.

## Review

Local servers: hospital `http://localhost:3000`, center `http://localhost:3002`, admin `http://localhost:3003`, landing `http://localhost:3004`.

Screenshots in this directory cover admin lists/dialogs and hospital/center request tables at desktop and mobile sizes. Latest landing screenshots are in `../landing-v3/preview-*.png`; laboratory screenshots are in `../clinical-v2/`.

Reproduce browser checks from the repository root with `node artifacts/web-final/check-browser.cjs` while the production servers are running. Results: `browser-results.json`.

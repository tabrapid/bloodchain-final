# Clinical workspace redesign

The web consoles use the supplied laboratory software references as a common visual direction: navy navigation, cyan actions, a white application header, pale work surfaces, compact bordered tables and explicit clinical status colors. The identity is BloodChain; no third-party product logos or government endorsements are reproduced.

## Integration

- The shared sidebar, workspace toolbar, semantic color tokens and table styles apply to hospital, blood-center and administration consoles. Existing routes, permissions, notifications, language switching and sign-out remain connected.
- The toolbar changes table and metric density in the current workspace. Its print action invokes the browser print flow; print styles remove navigation and let tables expand.
- The blood-center dashboard calculates laboratory completion from the existing analytics API and shows inventory and shipment summaries with links to the corresponding worklists. Missing/zero-test data is displayed as unknown rather than as a healthy completion score. Loading masks retained values.
- Uzbek, Russian and English labels are included. Mobile's primary light accent follows the same cyan identity; existing native layouts and emergency colors are retained.

## Validation

Using Node 24.22.1 and pnpm 9.15.5:

- Shared UI, i18n and all three console typechecks passed.
- Shared UI and all three console lint commands passed.
- Unit/regression suites: i18n 81, UI 105, hospital 71, blood center 63, admin 37 tests passed (357 total).
- Native theme tests: 46 contrast/semantic color checks passed.
- Production builds passed for hospital, blood center and admin.
- System Chromium: desktop 1440px and mobile 390px layouts, density toggle, menu opening and Escape dismissal, no horizontal document overflow and no browser runtime errors.
- Authenticated dashboard browser rendering was additionally checked with explicit intercepted API fixtures. The gauge rendered 93% from 296 completed / 320 total tests. This is a frontend integration check, not evidence of a running backend.

## Outstanding environment prerequisite

Prisma generation is blocked by HTTP 403 for engine/checksum downloads from `binaries.prisma.sh`. The required domain is already saved in the environment configuration draft. Apply it in environment settings, then run `pnpm db:generate`, deploy migrations to the disposable development database, seed only if that database is newly created, start the API, and run `pnpm verify`. Do not disable TLS or checksum verification. The full API/e2e gate has not passed in this instance, so the entire system must not yet be described as fully verified.

# Clinical workspace redesign

The reference is a clinical operations console: a dark slate navigation rail,
white top bar, pale gray workspace, compact white panels, blue actions, and dense
bordered tables. The shared UI now applies that visual direction to the admin,
hospital, and blood-center portals, including their signed-out, recovery,
registration, empty, loading, and detail views.

Native donor and courier screens inherit updated action colors, panel geometry,
metric groups, and borders through the mobile design system. Stored theme choices
and the system light/dark preference remain supported. Red remains reserved for
critical states rather than ordinary primary actions.

## Behavior fixes

- Fresh sign-in selects the hospital/blood-center organization immediately, so
  dashboard analytics load without refreshing the page. Each portal has a
  regression test for this flow.
- Sign-out discards authenticated client state with a full navigation, including
  when signing out from a dashboard already at `/`.
- The default sidebar link forwards `aria-current`, preserving both the visible
  active item and its accessible state.
- The small-screen navigation closes on Escape and on route changes.
- Search forms wrap their fields and submit button on narrow screens; wide
  tables retain horizontal scrolling.
- `pnpm dev:api` loads the repository-root `.env` when present. Previously the
  command ran inside `apps/api` and missed the root database/JWT configuration.

## Local setup

Use the repository's supported Node and pnpm versions and PostgreSQL. Keep `.env`
private; copy `.env.example` if configuring a new checkout.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
node --env-file=.env apps/api/node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
```

Back up an existing database before applying pending migrations. The local QA
machine had sixteen unapplied existing migrations; they were applied after a
private backup. No reset or demo seed was run against that database. The VPS was
not changed by this redesign.

For an empty, disposable local demo database only, initialize the demo data using
`pnpm db:seed`. The demo seed empties its tables: do not run it against an existing
installation to apply this UI update.

Run these in separate terminals:

```sh
pnpm dev:api
pnpm dev:hospital
pnpm dev:blood-center
pnpm dev:admin
pnpm dev:mobile
```

| App | Local URL |
| --- | --- |
| Hospital | http://localhost:3000 |
| API health | http://localhost:3001/api/v1/health |
| Blood center | http://localhost:3002 |
| Admin | http://localhost:3003 |

## Validation

The following checks were executed on 2026-11-06:

- TypeScript: all 11 workspace packages pass.
- Lint: all 11 workspace packages pass with existing warnings, no errors.
- Shared UI: 100 tests pass.
- Admin: 37 tests pass.
- Hospital: 71 tests pass, including fresh sign-in analytics.
- Blood center: 63 tests pass, including fresh sign-in analytics.
- Mobile: 645 tests pass, including both palettes' contrast checks.
- API: 1,535 unit/HTTP tests pass.
- All three Next.js production builds pass.
- Expo web production export succeeds.
- Browser QA: local API health, real admin/hospital/blood-center sign-in,
  organization type filtering, active navigation, live dashboard metrics,
  desktop tables, and the 390px navigation drawer were checked.

Node 26 exposes an experimental global `localStorage` incompatible with this
version of the jsdom/Vitest environment. To reproduce web tests on that runtime:

```sh
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter @bloodchain/ui --filter @bloodchain/admin-web --filter @bloodchain/hospital-web --filter @bloodchain/blood-center-web run test --maxWorkers=2 --minWorkers=1
```

The API HTTP tests need permission to bind loopback sockets. Its Jest run reports
all tests passing but may keep an existing open handle after completion. No API
end-to-end database suite or new native Android/iOS binary was run for this UI
change. Mobile web export and component tests do not substitute for native-device
release testing.

Preview screenshots: `artifacts/clinical-workspace-qa/`.

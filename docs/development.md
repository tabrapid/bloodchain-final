# Development

## Requirements

- Node.js 20+
- pnpm 9.x
- PostgreSQL 15+

## Install

```bash
pnpm install
```

## Environment

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

Update `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` at minimum.

## Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Development Test Users

After running the seed script, the following accounts are available:

| Email                            | Password              | Role               |
| -------------------------------- | --------------------- | ------------------ |
| `admin@donor.local`              | `DevelopmentOnly!123` | SUPER_ADMIN        |
| `donor@donor.local`              | `DevelopmentOnly!123` | DONOR              |
| `hospital.admin@donor.local`     | `DevelopmentOnly!123` | HOSPITAL_ADMIN     |
| `hospital.staff@donor.local`     | `DevelopmentOnly!123` | HOSPITAL_STAFF     |
| `blood.center.admin@donor.local` | `DevelopmentOnly!123` | BLOOD_CENTER_ADMIN |
| `blood.center.staff@donor.local` | `DevelopmentOnly!123` | BLOOD_CENTER_STAFF |
| `courier@donor.local`            | `DevelopmentOnly!123` | COURIER            |

**WARNING: These credentials are for local development only and must never be used in production.**

## Run

```bash
pnpm dev:api               # http://localhost:3001
pnpm dev:hospital          # http://localhost:3000
pnpm dev:blood-center      # http://localhost:3002
pnpm dev:mobile            # Expo dev server
```

## Background jobs

The API runs three scheduled jobs in-process (`@nestjs/schedule`, started by
`ScheduleModule.forRoot()` in `app.module.ts`):

| Job                                       | Cadence          | What it does                                                                  |
| ----------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `EmergencyCronService.runMaintenance`     | every 5 minutes  | Expires stale emergencies; purges location history of closed journeys          |
| `InventoryCronService`                    | hourly           | Inventory expiry and low-stock alerts                                          |
| `AppointmentReminderService.sendDueReminders` | every 5 minutes | Sends each donor one reminder before their appointment                     |
| `AppointmentExpiryService.runExpirySweep`  | hourly           | Closes out appointments nobody handled and returns their slot capacity         |

The reminder job's lead time is `APPOINTMENT_REMINDER_LEAD_MINUTES` (default
1440 — one day ahead), read in one place so that moving reminders closer to the
appointment is a configuration change rather than a code change.

The expiry sweep's grace period is `APPOINTMENT_EXPIRY_GRACE_HOURS` (default
24 — a full day after the scheduled end), so a desk writing up yesterday's
session is never racing the job. It only touches PENDING and CONFIRMED
appointments: CHECKED_IN and IN_PROGRESS mean someone is mid-session or the
write-up is unfinished, and expiring those would destroy a real record. Each
appointment moves to `EXPIRED` — the state the schema always had and nothing
ever set — under a conditional update, and its seat is returned to the slot,
flipping a FULL slot back to AVAILABLE.

It is idempotent by claim, not by hope: it stamps `Appointment.reminderSentAt`
in an update conditional on that column still being null, and only emits
`appointment.reminder` when the update actually changed a row. A cron that
fires twice in one window, a restart halfway through a batch, and two API
instances running side by side therefore all produce exactly one reminder per
appointment.

## Lint / format

```bash
pnpm lint
pnpm format
pnpm format:check
```

## Type checking

```bash
pnpm typecheck
```

## Tests

```bash
pnpm verify      # the gate: typecheck → lint → unit tests → end-to-end tests
```

`pnpm test` runs the unit suites through turbo; it does not touch a database
and does not run the end-to-end suites. `pnpm test:e2e` runs those, against a
migrated and seeded local database. They are separate commands because they
need different things — which is exactly how the end-to-end suites once stayed
red for a sprint while everything else reported green. `pnpm verify` chains
both, so that cannot happen again.

```bash
pnpm test
pnpm test:e2e    # needs a migrated + seeded database; repeatable without a reset
```

The API has unit tests for authentication (including user status checks, suspended/deactivated users), the roles guard, permissions service, and the health controller. Web and mobile tests are placeholder foundations.

## Package scripts

| Package                   | Dev                     | Lint                            | Typecheck                            | Test                            |
| ------------------------- | ----------------------- | ------------------------------- | ------------------------------------ | ------------------------------- |
| `@bloodchain/api`              | `pnpm dev:api`          | `pnpm --filter @bloodchain/api lint` | `pnpm --filter @bloodchain/api typecheck` | `pnpm --filter @bloodchain/api test` |
| `@bloodchain/hospital-web`     | `pnpm dev:hospital`     | `tsc --noEmit`                  | `tsc --noEmit`                       | echo placeholder                |
| `@bloodchain/blood-center-web` | `pnpm dev:blood-center` | `tsc --noEmit`                  | `tsc --noEmit`                       | echo placeholder                |
| `@bloodchain/mobile`           | `pnpm dev:mobile`       | `tsc --noEmit`                  | `tsc --noEmit`                       | echo placeholder                |
| `@bloodchain/ui`               | —                       | `tsc --noEmit`                  | `tsc --noEmit`                       | echo placeholder                |

## Mobile development

The mobile app uses Expo Router with route groups `(auth)` and `(app)`. In development it takes `EXPO_PUBLIC_API_URL` if set, and otherwise derives the API host from whichever machine served the bundle — so a phone on the same network needs nothing configured, and the Android emulator is rewritten to `10.0.2.2` because `localhost` there is the emulator. A preview or production build derives nothing: it must be given an explicit address (https, and not the device itself) or it fails to build. `APP_ENV` picks the rules and `apps/mobile/src/config/app-config.ts` is where they live.

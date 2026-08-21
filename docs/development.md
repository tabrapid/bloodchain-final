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
pnpm test
```

The API has unit tests for authentication (including user status checks, suspended/deactivated users), the roles guard, permissions service, and the health controller. Web and mobile tests are placeholder foundations.

## Package scripts

| Package                   | Dev                     | Lint                            | Typecheck                            | Test                            |
| ------------------------- | ----------------------- | ------------------------------- | ------------------------------------ | ------------------------------- |
| `@donor/api`              | `pnpm dev:api`          | `pnpm --filter @donor/api lint` | `pnpm --filter @donor/api typecheck` | `pnpm --filter @donor/api test` |
| `@donor/hospital-web`     | `pnpm dev:hospital`     | `tsc --noEmit`                  | `tsc --noEmit`                       | echo placeholder                |
| `@donor/blood-center-web` | `pnpm dev:blood-center` | `tsc --noEmit`                  | `tsc --noEmit`                       | echo placeholder                |
| `@donor/mobile`           | `pnpm dev:mobile`       | `tsc --noEmit`                  | `tsc --noEmit`                       | echo placeholder                |
| `@donor/ui`               | —                       | `tsc --noEmit`                  | `tsc --noEmit`                       | echo placeholder                |

## Mobile development

The mobile app uses Expo Router with route groups `(auth)` and `(app)`. It expects the API URL via `EXPO_PUBLIC_API_URL` or falls back to `http://localhost:3001`. For physical devices, use your machine's local IP address.

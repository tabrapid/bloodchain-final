# BloodChain

BloodChain is a production-oriented healthcare technology platform that connects donors, hospitals, blood centers, and couriers around a safer, more transparent blood supply.

This repository contains the **Phase 1 + Phase 2 foundation**: a scalable monorepo with the API, mobile application, hospital web console, blood-center web console, shared packages, database schema, authentication, RBAC, and development tooling.

## Monorepo structure

```
donor/
├── apps/
│   ├── api/                 # NestJS REST API
│   ├── hospital-web/        # Next.js hospital dashboard
│   ├── blood-center-web/    # Next.js blood-center dashboard
│   └── mobile/              # Expo React Native mobile app
├── packages/
│   ├── ui/                  # Shared web components and design tokens
│   ├── types/               # Shared TypeScript types
│   ├── validation/          # Shared Zod schemas
│   ├── utils/               # Shared utility functions
│   └── config/              # Shared configuration helpers
├── database/                # Reserved for future database utilities
├── docs/                    # Architecture, API, security, and development docs
├── scripts/                 # Reserved for automation scripts
├── .env.example             # Environment variable template
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

## Tech stack

- **Mobile:** React Native, Expo, Expo Router, TypeScript, TanStack Query, Zustand, React Hook Form, Zod, Expo SecureStore, lucide-react-native.
- **Web:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, lucide-react, shared `@bloodchain/ui` components.
- **Backend:** NestJS, TypeScript, Prisma, PostgreSQL, argon2, JWT access/refresh tokens, Passport, Swagger/OpenAPI, structured logging with pino, rate limiting, Helmet security headers.
- **Tooling:** pnpm workspaces, Turborepo, TypeScript, ESLint (API), Prettier.

## Quick start

### Prerequisites

- Node.js 20+ (tested on Node 26)
- pnpm 9.x (`npm install -g pnpm@9.15.5`)
- PostgreSQL (required to run migrations, seeds, and the full API)

### Install dependencies

```bash
pnpm install
```

### Environment variables

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

Edit `.env` and `apps/api/.env` with your local database URL and strong JWT
secrets (32+ characters each — the API refuses to start otherwise). Everything
else in the template works as shipped: empty values mean "not configured", and
the API validates the whole file against
`apps/api/src/config/env.validation.ts` at boot.

The three Next.js apps and the Expo app read `NEXT_PUBLIC_API_URL` /
`EXPO_PUBLIC_API_URL`, not the API's own variables; both fall back to
`http://localhost:3001`, so they only need setting once the API moves off
localhost.

### Database

```bash
# Generate Prisma Client
pnpm db:generate

# Create and apply migrations (requires a running PostgreSQL server)
pnpm db:migrate

# Seed development data
pnpm db:seed
```

### Run the project

```bash
# Start the API (http://localhost:3001)
pnpm dev:api

# Start the hospital web app (http://localhost:3000)
pnpm dev:hospital

# Start the blood-center web app (http://localhost:3002)
pnpm dev:blood-center

# Start the Expo mobile app
pnpm dev:mobile
```

### Verification

```bash
pnpm typecheck   # tsc --noEmit across all 10 workspace packages
pnpm lint
pnpm test        # 658 API + 48 web + 19 mobile + 100 package tests
pnpm build
```

The API also has an end-to-end suite that runs against a **real** PostgreSQL
database rather than mocks — 103 tests covering auth, the donation lifecycle,
the blood-request → shipment → delivery chain, emergency donor matching, the
inventory lifecycle, education progress and XP, request-body validation, the
response envelope every client depends on, and gamification concurrency. It needs a migrated **and
seeded** database (registration fails without the seeded roles):

```bash
pnpm --filter @bloodchain/api exec prisma migrate deploy
pnpm --filter @bloodchain/api prisma:seed
pnpm --filter @bloodchain/api test:e2e
```

All four of these run in CI on every push and pull request to `main` — see
`.github/workflows/ci.yml`.

### Docker (API + PostgreSQL)

`docker-compose.yml` at the repo root runs the API and its PostgreSQL
database as containers — no local Node/pnpm/Postgres install required.

```bash
cp .env.example .env   # edit JWT_ACCESS_SECRET / JWT_REFRESH_SECRET at minimum
docker compose up --build
```

This builds `apps/api/Dockerfile` (a multi-stage production build —
`pnpm install` → `prisma generate` → `nest build`, running as a
non-root user in the final image), starts PostgreSQL 16, waits for it
to report healthy, then runs `prisma migrate deploy` before starting
the API. The API is reachable at `http://localhost:3001` (override with
`API_PORT`); PostgreSQL is reachable at `localhost:5432` (override with
`POSTGRES_PORT`) if you want to connect to it directly. Data persists
in the `postgres_data` named volume across restarts; `docker compose
down -v` removes it.

The 3 Next.js web apps and the Expo mobile app are not containerized —
they're run locally via `pnpm dev:*` as shown above.

## Phase 2: Authentication, Authorization, RBAC

The platform now includes a complete authentication and authorization system:

### Authentication Endpoints

| Endpoint                       | Method | Description                     |
| ------------------------------ | ------ | ------------------------------- |
| `/api/v1/auth/register`        | POST   | Register a new donor account    |
| `/api/v1/auth/login`           | POST   | Authenticate and receive tokens |
| `/api/v1/auth/refresh`         | POST   | Rotate access token             |
| `/api/v1/auth/logout`          | POST   | Revoke current session          |
| `/api/v1/auth/change-password` | POST   | Change password                 |
| `/api/v1/auth/me`              | GET    | Get current user profile        |

### User Status

Users can have one of the following statuses:

- `ACTIVE` — fully authenticated user
- `PENDING_VERIFICATION` — registered but email not verified
- `SUSPENDED` — temporarily blocked
- `DEACTIVATED` — permanently deactivated

### Roles

| Role                 | Description                                     |
| -------------------- | ----------------------------------------------- |
| `DONOR`              | Blood donor with profile management             |
| `HOSPITAL_ADMIN`     | Hospital staff with management permissions      |
| `HOSPITAL_STAFF`     | Hospital staff with operational permissions     |
| `BLOOD_CENTER_ADMIN` | Blood center staff with management permissions  |
| `BLOOD_CENTER_STAFF` | Blood center staff with operational permissions |
| `COURIER`            | Delivery personnel                              |
| `SUPER_ADMIN`        | Platform administrator                          |

### Permissions

The system uses granular permissions (e.g., `hospital.read`, `donor.update.self`, `inventory.manage`). Roles are assigned collections of permissions.

### Organization Isolation

Hospital A staff cannot access Hospital B data. The system enforces organization-scoped authorization through the `OrganizationGuard`.

## Development Credentials

The seed script creates the following development-only accounts:

| Email                            | Password              | Role               |
| -------------------------------- | --------------------- | ------------------ |
| `admin@donor.local`              | `DevelopmentOnly!123` | SUPER_ADMIN        |
| `donor@donor.local`              | `DevelopmentOnly!123` | DONOR              |
| `hospital.admin@donor.local`     | `DevelopmentOnly!123` | HOSPITAL_ADMIN     |
| `hospital.staff@donor.local`     | `DevelopmentOnly!123` | HOSPITAL_STAFF     |
| `blood.center.admin@donor.local` | `DevelopmentOnly!123` | BLOOD_CENTER_ADMIN |
| `blood.center.staff@donor.local` | `DevelopmentOnly!123` | BLOOD_CENTER_STAFF |
| `courier@donor.local`            | `DevelopmentOnly!123` | COURIER            |

**Never use these credentials in production.**

## Documentation

- [Architecture](./docs/architecture.md)
- [Database](./docs/database.md)
- [API](./docs/api.md)
- [Development](./docs/development.md)
- [Security](./docs/security.md)
- [Roadmap](./docs/roadmap.md)

`TODO.md` is the live production-readiness audit: what has been fixed, how each
fix was verified, and what is still open. Read it before assuming any part of
this system is finished.

## License

Proprietary — BloodChain. All rights reserved.

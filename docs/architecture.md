# Architecture

This document describes the high-level architecture of the DONOR platform after Phase 19.

## Design principles

- **Modular domains:** Each business domain (auth, users, organizations, donors, appointments, inventory, etc.) lives in its own NestJS module with clear boundaries.
- **Separation of concerns:** Controllers handle HTTP; services contain business logic; repositories (Prisma) are abstracted behind a global `DatabaseModule`.
- **Dependency inversion:** Core modules depend on abstractions (interfaces, DTOs) rather than concrete implementations.
- **Type safety:** Strict TypeScript everywhere. Shared types live in `@donor/types` and are consumed by API, web, and mobile.
- **Security first:** Authentication, RBAC, audit logging, input validation, security headers, rate limiting, and safe token storage are built in from the start.
- **Real-time ready:** The backend is prepared for WebSocket gateways, Redis pub/sub, and domain events, but none are implemented yet.
- **No fake backend:** UI placeholders call the real API architecture; unfinished features are clearly marked as development placeholders.

## Monorepo layout

```
apps/
  api/                 # NestJS backend
  hospital-web/        # Next.js hospital dashboard
  blood-center-web/    # Next.js blood-center dashboard
  mobile/              # Expo React Native donor app
  admin-web/           # Next.js super admin dashboard
packages/
  ui/                  # Design tokens + reusable React components
  types/               # Shared domain/API types
  validation/           # Zod schemas shared across client boundaries
  utils/               # Pagination, async helpers, etc.
  config/              # App config and environment helpers
database/              # Reserved for future database tooling
```

## Backend modules

The API is organized under `apps/api/src/modules/`:

- `auth` — registration, login, logout, refresh, change password, session management.
- `users` — user listing, lookup, and self-profile management.
- `organizations` — organization listing and lookup.
- `donors` — donor profile, blood type verification, profile completion tracking.
- `notification-preferences` — donor notification preferences management.
- `audit-logs` — foundation for logging sensitive operations.
- `health` — health check endpoint.
- `permissions` — role and permission management.
- `laboratory` — blood testing, test types, parameters, reference ranges, appointment booking, result entry, review, and publication workflow.
- `health-trends` — personal health analytics, trend data aggregation, statistics, and chart data for donor health history.
- `ai-health` — AI-powered health insights, trend summaries, result explanations, and health-data-grounded chat assistance.
- `ai-history` — persistent storage and retrieval of AI-generated insights.
- `ai-cache` — intelligent caching for AI insights with data versioning.
- `ai-logging` — request tracking and metrics for AI operations.
- `appointments` — appointment and slot management for donations and blood tests.
- `donations` — donation session tracking, blood unit creation.
- `inventory` — blood unit inventory, storage locations, component management.
- `shipments` — courier shipments for blood units.
- `emergency` — emergency blood requests and donor matching.
- `gamification` — XP, levels, achievements, badges, leaderboard, reputation.
- `notifications` — centralized notification system with push, in-app, preferences, quiet hours.
- `admin` — super admin platform management, user/organization/courier management, system health monitoring.
- `community` — donor community feed, posts, and engagement features.
- `campaigns` — blood donation campaigns and awareness drives.
- `challenges` — donor engagement challenges and progress tracking.
- `education` — educational content and learning progress tracking.

## Authentication flow

1. Client calls `POST /api/v1/auth/login`.
2. Server validates credentials with argon2 and issues a short-lived JWT access token plus a refresh token.
3. Refresh tokens are hashed (SHA-256) and stored in PostgreSQL with expiry and revocation.
4. Mobile stores tokens in `expo-secure-store`.
5. On `401`, the mobile client attempts silent refresh, rotates the refresh token, and retries the original request.

## RBAC

Roles are stored in the database and attached to users via `OrganizationMembership`. Guards:

- `JwtAuthGuard` validates the access token.
- `RolesGuard` checks `@Roles(...)` metadata against the user's roles.
- `PermissionsGuard` checks `@Permissions(...)` for fine-grained access control.
- `OrganizationGuard` enforces organization-level data isolation.

## Donor profile architecture

The donor profile system consists of:

- **User model** — identity/account information (name, email, phone, avatar).
- **DonorProfile model** — donor-specific data (blood type, rh factor, verification status, city, district).
- **NotificationPreference model** — donor notification settings.

Blood type verification:
- Donors can self-declare their blood type (marked as UNVERIFIED).
- Only authorized staff (HOSPITAL_ADMIN, HOSPITAL_STAFF, BLOOD_CENTER_ADMIN, BLOOD_CENTER_STAFF) can verify blood types.
- Verification creates an audit log entry with source and timestamp.

Profile completion:
- Server-trusted completion calculation based on meaningful fields.
- Clients can display progress but cannot modify completion state.

## API response format

Success:

```json
{
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Error:

```json
{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "...",
  "details": {}
}
```

## Shared design tokens

`@donor/ui/tokens` exports `colors`, `spacing`, `radius`, and `typography` used by the web design system. Mobile keeps equivalent tokens locally to avoid React DOM peer dependency issues; a future `@donor/tokens` package can unify them.

# Roadmap

## Phase 1 — Foundation (current)

- Monorepo structure with pnpm + Turborepo.
- NestJS API with modular architecture.
- PostgreSQL + Prisma schema for users, roles, organizations, memberships, donor profiles, refresh tokens, audit logs.
- Authentication: register, login, logout, refresh, current user.
- RBAC foundation with roles guard.
- Shared packages: types, validation, utils, config, UI components.
- Expo mobile app with design system, navigation, and placeholder screens.
- Hospital and blood-center Next.js dashboards with shared design system.
- Health check, Swagger docs, structured logging, rate limiting, security headers.
- Initial migration, seed data, unit tests.

## Phase 2 — Core identities and appointments

- Email verification and password reset.
- Complete donor profile management.
- Blood type management with configurable reference data.
- Appointment booking (donation and blood test).
- Organization staff management.
- Basic notification abstraction.

## Phase 3 — Inventory and requests

- Blood inventory and blood unit tracking.
- Inter-hospital / blood-center blood requests.
- Inventory transactions and audit trails.
- Basic analytics dashboard.

## Phase 4 — Emergency and real-time

- SOS blood request creation and matching.
- Consent-based live donor location.
- WebSocket gateway for real-time events.
- Courier assignment and live tracking.

## Phase 5 — Intelligence and engagement

- AI-powered explanations and insights (with healthcare review boundaries).
- Gamification: XP, achievements, badges, leaderboards.
- Advanced analytics and reporting.
- Calendar integrations.

## Cross-cutting work

- End-to-end tests for critical paths.
- CI/CD pipeline.
- Redis caching and background job workers.
- S3-compatible object storage for medical documents.
- Push notification provider abstraction (Expo, FCM, APNs).

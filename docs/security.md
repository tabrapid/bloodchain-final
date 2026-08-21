# Security

Security is a first-class concern in DONOR. This document summarizes Phase 1 security controls.

## Authentication

- Passwords are hashed with **argon2id**.
- Access tokens are short-lived JWTs (default 15 minutes).
- Refresh tokens are long-lived opaque tokens stored as SHA-256 hashes in PostgreSQL; they support rotation and revocation.
- Mobile tokens are stored in `expo-secure-store`, never in plain AsyncStorage.

## Authorization

- JWT validation via `JwtAuthGuard`.
- Role checks via `RolesGuard` and `@Roles()` decorator.
- Backend is the source of truth for authorization; frontend role checks are UX only.

## Input validation

- NestJS `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- DTOs use `class-validator` decorators.
- Shared Zod schemas in `@donor/validation` are used on client boundaries.

## Transport security

- Helmet security headers.
- CORS configured from `WEB_URL` (never `*` in production).
- Rate limiting via `@nestjs/throttler`.
- Request IDs attached to every request.

## Logging and audit

- Structured logs via `nestjs-pino`.
- Passwords, tokens, cookies, and full sensitive payloads are redacted.
- `AuditLog` model and service are ready for logging sensitive operations.

## Environment and secrets

- Secrets live in `.env` files, which are gitignored.
- `.env.example` contains placeholders only.
- No API keys, passwords, or tokens are committed.

## Privacy

- Data access follows the principle of minimum necessary access.
- Donor medical history, exact location, and unrelated appointments are not automatically exposed to hospitals.
- Future consent flows will govern location sharing and data visibility.

## Known limitations

- Permission-based access control beyond roles is modeled but not enforced yet.
- Email verification and password reset are architectural placeholders.

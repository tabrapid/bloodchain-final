# BloodChain Security Documentation

## Overview

This document describes the security measures implemented in the DONOR healthcare platform.

## Authentication

### JWT-Based Authentication
- Access tokens expire in 15 minutes (configurable)
- Refresh tokens expire in 30 days (configurable)
- Refresh token rotation on each use
- Tokens are HMAC-signed with server secrets

### Password Security
- Argon2id hashing (memory-hard, resistant to GPU/ASIC attacks)
- Minimum 12 characters required
- Password complexity requirements enforced:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

### Password Reset (Account Recovery)
- `POST /auth/forgot-password` takes an email address and always answers
  identically, whether or not an account exists, so the endpoint cannot be used
  to learn which addresses are registered
- The link carries 32 bytes of CSPRNG output; only its SHA-256 hash is stored,
  so a database reader cannot use a stored row to reset anyone's password
  (SHA-256 rather than Argon2 here is deliberate: the input is full-entropy
  random, so there is nothing to brute-force, and lookup must be a single
  indexed equality read)
- One live token per account: requesting a reset replaces the previous one
- Single use, and expiring after `PASSWORD_RESET_TTL_MINUTES` (default 60)
- A completed reset revokes every refresh token for that user, so a session an
  attacker already holds does not survive the recovery
- Requests are limited per IP (3 per 15 minutes) and per account
  (`PASSWORD_RESET_COOLDOWN_SECONDS`, default 60), since each one sends mail to
  a third party
- Every request, failure and completion is audit-logged; the audit record keeps
  the real reason a reset failed (unknown, used, expired, inactive) even though
  the caller is told only that the link is invalid
- Reset delivery is email-only. No SMS path exists
- The mobile app surfaces this flow at `(auth)/forgot-password` and
  `(auth)/reset-password`; the client calls the two endpoints and holds no reset
  logic of its own. It renders one confirmation for every address and one
  "this link no longer works" state for every token failure, so neither screen
  can be used to learn something the API declines to disclose
- Completing a reset clears the device's stored tokens as well, since the server
  has just revoked them

### Brute-Force Protection
- Account lockout after 5 failed login attempts
- Lockout duration: 15 minutes
- Failed attempt counter resets on successful login
- All failed attempts are logged for security monitoring

### Session Management
- Multiple sessions supported per user
- Sessions track device name, type, and IP address
- Users can view and revoke individual sessions
- "Sign out all devices" functionality available
- Sessions automatically expire

## Authorization

### Role-Based Access Control (RBAC)

| Role | Description |
|------|-------------|
| DONOR | Platform donor with health data access |
| HOSPITAL_STAFF | Hospital staff member |
| HOSPITAL_ADMIN | Hospital administrator |
| BLOOD_CENTER_STAFF | Blood center staff member |
| BLOOD_CENTER_ADMIN | Blood center administrator |
| COURIER | Delivery courier |
| LAB_TECHNICIAN | Laboratory technician |
| LAB_REVIEWER | Laboratory result reviewer |
| LAB_ADMIN | Laboratory administrator |
| SUPER_ADMIN | Platform super administrator |

### Permission System
- Permissions are dynamically loaded from database
- SUPER_ADMIN automatically gets `admin.manage` permission
- Permission checks at endpoint level via guards

### Organization Isolation
- Hospital users can only access data from their organization
- Blood Center users can only access data from their organization
- Cross-organization data access is explicitly blocked

## API Security

### Rate Limiting
- Global throttle: 100 requests per 60 seconds
- Auth endpoints: 5 requests per 60 seconds (login)
- Password change: 5 requests per 60 seconds
- AI endpoints: 20 requests per 60 seconds
- Register: 10 requests per 60 seconds
- Refresh token: 20 requests per 60 seconds

### Input Validation
- Global ValidationPipe with `whitelist: true`
- Forbidden: `forbidNonWhitelisted: true`
- Automatic type transformation enabled

### Security Headers
- Helmet.js enabled with CSP directives
- Content-Security-Policy enforced
- X-Content-Type-Options: nosniff
- Referrer-Policy configured

### CORS
- Configured origins only
- Credentials supported
- Explicit allowed headers

## Data Protection

### Sensitive Data Redaction
The following are automatically redacted from logs:
- Passwords
- Refresh tokens
- Authorization headers
- Current passwords
- New passwords

### Health Data Protection
- Blood test results protected by ownership validation
- AI insights only accessible by the generating user
- Organization-based access control for institutional data
- Data minimization: only necessary data sent to AI
- A laboratory result is visible to the donor only in the `PUBLISHED` state.
  `LaboratoryResult.status` is a database enum
  (`PENDING → ENTERED → REVIEWED → PUBLISHED`), each transition is refused out
  of order, and the donor-facing list, single read and parameter trend all
  filter on `PUBLISHED` — an entered-but-unreviewed value is not readable
- Donor-owned reads are scoped to the caller in the query itself, so another
  donor's result id or emergency-response id answers 404 rather than 403 and
  cannot be used to confirm that a record exists
- Emergency location history is deleted once the journey that produced it is
  closed, after `EMERGENCY_LOCATION_RETENTION_HOURS`; an active journey is never
  pruned, and each prune run is audit-logged

### Database Security
- All connections use PostgreSQL
- Foreign keys enforce referential integrity
- Indexes on frequently queried fields
- AuditLog is append-only, enforced by database triggers (see below)

## WebSocket Security

### Authentication
- JWT token required for connection
- Token validated on handshake
- Invalid tokens result in immediate disconnect

### Channel Authorization
- Users can only join rooms they have access to
- Shipment rooms checked against user permissions
- SUPER_ADMIN can access all rooms

### Heartbeat Mechanism
- 30-second heartbeat interval
- 90-second connection timeout
- Automatic disconnect on timeout

## Audit Logging

### Events Logged
- Authentication events (login, logout, refresh, password change)
- Authorization failures
- Health data access
- Donation operations
- Inventory movements
- Shipment state changes
- SOS events
- Admin actions

### Audit Log Immutability

Enforced by two `BEFORE` row triggers on `AuditLog`, added in migration
`20260921100000_auditlog_append_only`. Both call `audit_log_append_only()`,
which raises a `check_violation`.

| Operation | Behaviour |
| --- | --- |
| `INSERT` | Allowed. The table is append-only, not read-only. |
| `UPDATE` | Refused, for every role including the application's and including a superuser. Row-level triggers are not bypassed by privilege. |
| `DELETE` | Refused, on the same terms. A blanket `DELETE ... WHERE` is refused row by row, which is the shape a careless cleanup actually takes. |
| `UPDATE` setting `actorId` or `organizationId` to `NULL` | **Allowed**, and only this. `AuditLog.actorId` and `AuditLog.organizationId` are `onDelete: SetNull`, and Postgres implements SET NULL as an UPDATE on this table — so a trigger refusing every update would make it impossible to delete any user who had ever appeared in an audit entry, which is every real user. Every column the entry asserts (`action`, `entityType`, `entityId`, `metadata`, `ipAddress`, `createdAt`) must be byte-identical for the update to pass, and setting those two columns to a *different* value rather than to `NULL` is still refused. Detaching a key that no longer resolves changes nothing about who did what to which record when. |
| `TRUNCATE` | **Not** blocked. Postgres fires statement-level TRUNCATE triggers rather than row-level DELETE triggers, so `prisma/seed.ts` still resets a local database — itself guarded by `checkLocalDatabase`, which refuses to run against anything that is not one. |

Proved rather than asserted: `apps/api/test/audit-log-immutability.e2e-spec.ts`
drives every case above through `$executeRawUnsafe` and through the ORM, including both sides of the referential-detach boundary. Raw SQL
is deliberate — testing this through the Prisma client would only prove the
application does not call `update`, which was already true and was exactly the
reassurance that let the gap survive.

**What this does not claim.** This is not cryptographic immutability. There is
no hash chain and no signature, and anyone holding sufficient SQL privileges
can drop the trigger. What it prevents is application code, an ORM call, a
migration or a hand at a prompt rewriting audit history — accidentally or
casually.

**History.** Until Sprint 9 this section described a control that did not
exist. There was no trigger in any migration, no ORM middleware and no revoked
privilege; the audit trail was an ordinary table anything with a connection
could rewrite. The wording above now matches the migration line for line, and
the e2e suite fails if it stops doing so.

**Retention.** No retention period is implied or enforced by these triggers,
and none is set anywhere in this repository (LP-06). A retention rule, when one
is validated, will need an explicit and audited mechanism of its own; it does
not get one by leaving this door open.

## Security Monitoring

### Tracked Events
- Failed login attempts
- Account lockouts
- Permission failures
- Rate limit exceeded
- Security-sensitive changes

## Incident Response

### Account Compromise
1. User can revoke all sessions via "Sign out all devices"
2. Admin can deactivate account
3. All refresh tokens are invalidated on password change

### Suspicious Activity
1. Failed login attempts are logged
2. Account lockout after 5 failed attempts
3. Security team reviews audit logs

### Data Breach Response
1. Incident documented
2. Affected users notified
3. Logs preserved for investigation
4. Remediation steps implemented

## Environment Security

### Required Environment Variables
- `JWT_ACCESS_SECRET` - Minimum 32 characters
- `JWT_REFRESH_SECRET` - Minimum 32 characters
- `DATABASE_URL` - PostgreSQL connection string
- `AI_API_KEY` - OpenAI API key (server-only)
- `MAP_API_KEY` - Map service API key (server-only)

### Never Commit
- API keys
- Database passwords
- JWT secrets
- Private keys
- Access tokens

## Dependencies

### Security Updates
- Dependencies audited regularly
- Critical vulnerabilities patched promptly
- Minimal dependency footprint

## Not Yet Configured: Deployment Requirements

Everything below is **built and tested, but deliberately not configured**. Each
is infrastructure a deployment supplies, not code the repository is missing, and
none of it should be filled in with a real value before there is an environment
to put it in. This section is the handover list.

### Email delivery (required before recovery works outside local dev)

Password reset and email verification both go through nodemailer. With
`SMTP_HOST` empty — the state of every environment today — `EmailService` falls
back to a stream transport and writes the message to the API log instead of
sending it. Nothing fails, and nothing arrives.

To make recovery real, a deployment must supply:

| Variable | What it needs | Notes |
| --- | --- | --- |
| `SMTP_HOST` | The provider's SMTP hostname | The single switch: set, mail is sent; empty, mail is logged |
| `SMTP_PORT` | Usually 587 (STARTTLS) or 465 | Defaults to 587 |
| `SMTP_SECURE` | `true` only for implicit TLS on 465 | Defaults to false |
| `SMTP_USER` / `SMTP_PASSWORD` | The provider credentials | Secrets — never committed, never in `.env.example` |
| `SMTP_FROM` | The sender, e.g. `BloodChain <no-reply@yourdomain>` | Must be an address the domain is authorised to send as |

Also needed, and not an environment variable: **SPF, DKIM and DMARC records on
the sending domain**. A reset link that lands in spam is indistinguishable from
one that was never sent, and a locked-out user cannot tell you which happened.

### SMS delivery (required before phone sign-up works outside local dev)

Phone-first donor sign-up, phone sign-in and phone recovery all send a one-time
code by SMS. `SMS_PROVIDER=console` — the state of every environment today —
**prints the message to the API log instead of sending it**. Phone sign-up
works locally and nothing reaches a handset.

**The API refuses to start with the console provider when `NODE_ENV=production`.**
That refusal is deliberate and should not be worked around: a one-time code in
a log file is an authentication bypass for anyone with log access, not a
degraded mode.

No Uzbekistan SMS provider has been chosen. Before deployment:

1. Choose an aggregator (Eskiz, Play Mobile, SMS.uz or similar) and obtain an
   account, a sender ID, and — for most Uzbek aggregators — **pre-registered
   message templates**, which are approved by the operator and can take days.
2. Implement `SmsProvider` in `apps/api/src/modules/sms/providers/`. The
   interface is three fields and one method; everything vendor-shaped
   (authentication, template ids, delivery receipts, pricing) stays inside the
   adapter.
3. Register it in `sms.module.ts` and set `SMS_PROVIDER` to its name. Nothing
   in the auth domain changes.

| Variable | What it needs | Notes |
| --- | --- | --- |
| `SMS_PROVIDER` | The adapter's name | `console` is dev-only and refused in production |
| *(vendor credentials)* | Whatever the chosen aggregator needs | Secrets — never committed, never in `.env.example`. Name them when the adapter exists |
| `SMS_DEV_LOG_FILE` | Leave **unset** outside a developer machine | It writes message bodies, including codes, to a file |
| `OTP_HASH_SECRET` | 32+ random bytes | Optional: falls back to `JWT_REFRESH_SECRET`. Set it separately so code hashes and refresh tokens do not share a key |
| `PHONE_TICKET_SECRET` | 32+ random bytes | Optional: falls back to `JWT_REFRESH_SECRET`. Never set it to `JWT_ACCESS_SECRET` |

Also needed, and not an environment variable: **a sender ID registered with the
Uzbek operators**, and a decision about who pays for the messages. Both are
commercial, both take longer than the code did, and neither can be started from
here.

The security parameters (`OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`,
`OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_PER_HOUR`) have safe defaults and are
documented in `.env.example`. They are what keeps a six-digit code — one million
possibilities — from being guessable; do not loosen them to make a demo
smoother.

### Public URLs (required for the links in that mail to resolve)

The reset email contains a link, and that link is built from configuration. In
development everything points at localhost, which is correct there and useless
anywhere else.

| Variable | What it needs |
| --- | --- |
| `WEB_URL` | Comma-separated public origins of the consoles. Also the CORS allow-list, so it must be right regardless |
| `WEB_URL_HOSPITAL` | Public origin of the hospital console |
| `WEB_URL_BLOOD_CENTER` | Public origin of the blood centre console |
| `WEB_URL_ADMIN` | Public origin of the admin console |
| `API_URL` | Public origin of the API, used in the verification link |
| `MOBILE_DEEP_LINK` | Must match `expo.scheme` in apps/mobile/app.json (`donor://`) |

The three per-portal URLs are optional: each falls back to the first `WEB_URL`
entry, which is all a single-origin deployment needs. Set them when the consoles
are served from different hosts, so that a blood centre user is not mailed a
link to the hospital console. Nothing in the code hardcodes a host — the
fallback is whatever `WEB_URL` says, and that is required configuration
everywhere.

### Shared rate-limit storage (required before a second API instance)

`ThrottlerModule` is configured with no storage adapter, so the counters live in
the API process's memory. Two consequences, both of which only matter in
production:

- **They reset on restart or deploy.** A limiter that forgets on every release is
  not much of a limiter.
- **They are per-instance.** Behind two replicas, the effective limit doubles;
  behind ten, the 3-per-15-minutes anti-enumeration limit on
  `/auth/forgot-password` is 30.

Since Sprint 1B this also covers `/auth/phone/request-code`, where the same
arithmetic costs money: every request that gets through is an SMS someone pays
for. Two things limit the damage in the meantime, and neither lives in the
throttler's memory — **the per-number hourly ceiling** (`OTP_MAX_PER_HOUR`) and
**the per-number resend cooldown** (`OTP_RESEND_COOLDOWN_SECONDS`) are both
enforced against the database, so they hold across instances and across
restarts. The per-IP throttle is the layer that degrades when the API is scaled
out; the per-number limits are the layer that protects a person's phone, and
those do not.

The fix is a shared store (Redis, via `@nest-lab/throttler-storage-redis` or
equivalent) and it is **deliberately not implemented yet**: with one instance the
current behaviour is correct, and adding a Redis dependency before there is a
second instance buys nothing and adds a component that can fail. Do it as part
of the work that introduces horizontal scaling, not before.

---

## Reporting Security Issues

To report security vulnerabilities, contact the security team with:
1. Description of the issue
2. Steps to reproduce
3. Potential impact
4. Suggested remediation (if any)

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
- AuditLog immutability via database triggers

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
- Database trigger prevents UPDATE on AuditLog
- Database trigger prevents DELETE on AuditLog
- Application-level protection in place

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

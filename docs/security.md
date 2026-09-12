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

## Reporting Security Issues

To report security vulnerabilities, contact the security team with:
1. Description of the issue
2. Steps to reproduce
3. Potential impact
4. Suggested remediation (if any)

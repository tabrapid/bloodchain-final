# HTTP session revocation

The HTTP JWT strategy validates the persisted session on each authenticated
request. Missing session IDs, owner mismatch, expiry, revocation, suspended or
deactivated users are rejected. Roles and permissions come from current ACTIVE
memberships; grants from inactive organizations are excluded, except platform
SUPER_ADMIN membership. No positive authorization cache delays revocation.

A JWT signature and expiry remain checked by Passport. Old access tokens without
`sid` must sign in again; ordinary session-bearing tokens need no migration.
No database migration or account deletion is part of this change. The database
must remain available to authorize requests. Pending verification behavior is
unchanged from the existing login policy.

Regression coverage includes account closure, device revocation, user suspension,
session expiry and membership removal against the real test database. The test
harness creates a real session instead of bypassing session validation.

This change covers HTTP only. Shipment/emergency WebSocket connections still
need a separate session-revalidation/disconnect review, including already joined
rooms. It does not close the complete offboarding/MFA or authorization workstream.
Before release, run all API E2E suites in an isolated database and retain a verified
backup and previous API image. After release, verify HTTPS readiness, current
image identity and a synthetic session-revocation journey in the test environment.

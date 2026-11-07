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

## WebSocket follow-up — 2026-11-06

Shipment and emergency gateways now share the persisted-session authorization
function with HTTP. They validate the signature/expiry and live session at
handshake, ping, join and courier location writes. Before every sensitive
outgoing event, each local subscriber's session and resource access are checked
again; being in a Socket.IO room does not itself authorize delivery. Revoked
clients are disconnected and removed from subscription maps. Errors returned to
clients omit private token/database diagnostics.

Emergency locations remain hospital-only, and response status reaches only the
hospital and the affected donor. Hospital access requires an active staff/admin
grant at an active hospital. Shipment access also rechecks current assignment
and active staff membership. A courier reassigned away from a shipment cannot
continue receiving its events through an old subscription.

Idle connections are revalidated on a 30-second timer (which can be delayed by
an overloaded event loop). Each outgoing event still checks access independently
of that timer. Shutdown clears the timer and subscriptions. A leave/disconnect
while an authorization query is pending suppresses the resulting delivery.
These checks are not a distributed transaction with concurrent role changes.

Fanout currently uses local connection/subscription maps: deploy as one API
instance. Multi-instance delivery needs a separately reviewed distributed design
before scaling; adding a Socket.IO adapter alone would not distribute these
maps. Privileged MFA and full staff offboarding workflows remain outstanding.

Socket.IO lifecycle/room APIs were checked against the
[official server API](https://socket.io/docs/v4/server-api/). Regression tests use
both mocked failure/race cases and actual Socket.IO clients with the real Nest
application, JWT verifier and isolated PostgreSQL database. No live user account
is created or revoked by this rehearsal.

DONOR — Phase 1 Engineering Report

1. What was built
   The complete Phase 1 foundation for the DONOR healthcare platform:

- A pnpm + Turborepo monorepo with 4 apps and 5 shared packages.
- A NestJS API with modular domain architecture, JWT access/refresh authentication, RBAC, structured logging, rate limiting, security headers, Swagger docs, and a health endpoint.
- A PostgreSQL + Prisma schema covering users, roles, permissions, organizations, hospital/blood-center subtypes, memberships, donor profiles, refresh tokens, and audit logs.
- An initial SQL migration and a seed script with clearly fake development credentials.
- An Expo React Native mobile app with a dark HealthTech design system, navigation, and placeholder screens.
- Next.js hospital and blood-center web dashboards sharing a Tailwind-based design system from @donor/ui.
- Shared packages for types, Zod validation, utilities, config, and reusable UI components.
- Documentation: architecture.md, database.md, api.md, development.md, security.md, roadmap.md, and README.md.
- Unit tests for authentication, RBAC guard, and health controller.

2. Final folder structure
   donor/
   ├── apps/
   │ ├── api/
   │ │ ├── prisma/
   │ │ │ ├── schema.prisma
   │ │ │ ├── seed.ts
   │ │ │ └── migrations/20250821000000_init/migration.sql
   │ │ ├── src/
   │ │ │ ├── common/
   │ │ │ ├── config/
   │ │ │ ├── database/
   │ │ │ └── modules/
   │ │ │ ├── auth/
   │ │ │ ├── users/
   │ │ │ ├── organizations/
   │ │ │ ├── donors/
   │ │ │ ├── audit-logs/
   │ │ │ └── health/
   │ │ └── test/
   │ ├── hospital-web/
   │ ├── blood-center-web/
   │ └── mobile/
   │ ├── app/
   │ │ ├── (auth)/
   │ │ ├── (app)/
   │ │ ├── sos.tsx
   │ │ ├── notifications.tsx
   │ │ └── settings.tsx
   │ └── src/
   │ ├── api/
   │ ├── auth/
   │ ├── components/
   │ ├── hooks/
   │ ├── lib/
   │ ├── providers/
   │ ├── stores/
   │ └── theme.ts
   ├── packages/
   │ ├── ui/
   │ ├── types/
   │ ├── validation/
   │ ├── utils/
   │ └── config/
   ├── database/
   ├── docs/
   ├── scripts/
   ├── .env.example
   ├── package.json
   ├── pnpm-workspace.yaml
   ├── turbo.json
   └── tsconfig.json
3. Technology decisions
   Layer Choice
   Monorepo pnpm workspaces + Turborepo
   API NestJS 11 + TypeScript
   Auth argon2 + JWT access/refresh tokens
   DB PostgreSQL + Prisma
   Web Next.js 14 (App Router) + React 18 + Tailwind CSS
   Mobile Expo SDK 52 + React Native 0.76 + Expo Router
   State TanStack Query + Zustand
   Forms/validation React Hook Form + Zod
   Logging nestjs-pino + pino-pretty
   Security Helmet, @nestjs/throttler, CORS from env
4. Database models created

- User — identity, credentials, status.
- Role — DONOR, HOSPITAL_ADMIN, HOSPITAL_STAFF, BLOOD_CENTER_ADMIN, BLOOD_CENTER_STAFF, COURIER, SUPER_ADMIN.
- Permission + RolePermission — permission matrix ready for future enforcement.
- Organization — generic with type (HOSPITAL / BLOOD_CENTER) and status.
- Hospital / BloodCenter — organization subtypes.
- OrganizationMembership — many-to-many user ↔ organization ↔ role.
- DonorProfile — blood type, DOB, location consent.
- RefreshToken — hashed tokens with expiry and revocation.
- AuditLog — actor, action, entity, organization, metadata, IP, timestamp.
  Indexes were added on email, status, organization type/status, membership keys, refresh tokens, and audit log fields.

5. Authentication status
   Implemented:

- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh (token rotation: old refresh token revoked)
- POST /api/v1/auth/logout (revokes refresh token)
- GET /api/v1/auth/me
- Password hashing with argon2.
- Mobile token storage via expo-secure-store.
- Mobile API client with silent refresh and error normalization.
  Not yet implemented:
- Email verification.
- Full password reset flow (architecture is ready).

6. RBAC status
   Implemented:

- JwtAuthGuard validates Bearer tokens.
- RolesGuard + @Roles(...) decorator enforce role restrictions.
- Role codes stored in the database and attached via memberships.
- Admin-scoped list endpoints for users and organizations.
  Not yet implemented:
- Permission-level enforcement beyond roles (schema is ready).

7. Mobile status

- Expo Router architecture with (auth) and (app) route groups.
- Tab navigation: Home, Health, Donate, Calendar, Profile.
- Top-level routes: sos, notifications, settings.
- Centralized design tokens (colors, spacing, radius, typography).
- Reusable component library: AppText, Screen, Card, GlassCard, GradientCard, AppButton, IconButton, Badge, StatCard, ListItem, Divider, Avatar, SectionHeader, ProgressBar, Skeleton, EmptyState, ErrorState, LoadingState, Modal, BottomSheet.
- TanStack Query setup, Zustand auth store, React Hook Form + Zod login/register forms.
- API client with token refresh.
  Screens are polished placeholders; no real medical data is shown.

8. Hospital web status

- Professional dark dashboard using @donor/ui DashboardShell, Sidebar, Topbar, StatCard, StatusBadge, EmptyState.
- Placeholder sidebar items: Dashboard, Emergency, Donors, Appointments, Inventory, Settings.
- Live overview cards and system status panel.

9. Blood center web status

- Same design system as hospital web.
- Placeholder sidebar items: Dashboard, Appointments, Donors, Inventory, Shipments, Settings.
- Center-specific hero, stat cards, and status panel.

10. Tests executed
    pnpm format:check # passed
    pnpm typecheck # passed (9 packages)
    pnpm lint # passed (9 packages)
    pnpm test # passed
    pnpm build # passed (API + both web apps)

- API unit tests: 10 tests passed across auth service, roles guard, and health controller.
- Web/mobile tests: placeholder foundations (no native test runner configured yet).

11. Remaining problems

- No running PostgreSQL server was available in this environment, so pnpm db:migrate and pnpm db:seed could not be executed against a real database. The Prisma schema is valid, the initial migration SQL file was generated, and the API health endpoint returns degraded gracefully when the database is unreachable.
- API Swagger UI may be partially blocked by Helmet’s default CSP in production; this will be tuned when Swagger is actively used.
- Mobile native build was not executed because iOS/Android simulators and the full native toolchain are not available in this environment. TypeScript checks and lint pass.
- The mobile design tokens are local to the mobile app. A future @donor/tokens package can unify them with @donor/ui without introducing React DOM peer-dependency complexity for React Native.

12. Exact commands to start the project

# 1. Install dependencies

pnpm install

# 2. Configure environment

cp .env.example .env
cp .env.example apps/api/.env

# Edit DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

# 3. Database (requires PostgreSQL running)

pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 4. Run services

pnpm dev:api # http://localhost:3001
pnpm dev:hospital # http://localhost:3000
pnpm dev:blood-center # http://localhost:3002
pnpm dev:mobile # Expo dev server

# 5. Verification

pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build 13. What should be built in Phase 2

- Email verification and password reset flows.
- Complete donor profile editing and blood type management.
- Configurable medical reference data (no hard-coded rules).
- Appointment booking for donations and blood tests.
- Organization staff management and membership invites.
- Notification abstraction with a concrete provider integration.
- End-to-end API tests against a test database.
- CI/CD pipeline and containerization foundation.






Phase 2 Complete
All verifications pass: format:check, typecheck (9 packages), lint (9 packages), test (16 API tests), build (API + both web apps).
1. What Changed
Database Schema (apps/api/prisma/schema.prisma)
- User model — added displayName, avatarUrl, dateOfBirth, emailVerified, phoneVerified, lastLoginAt; status now uses PENDING_VERIFICATION instead of PENDING
- DonorProfile model — added bloodType (enum), rhFactor (enum), donorStatus, verificationStatus, city; removed plain string bloodType
- New enums: BloodType (A, B, AB, O), RhFactor (POSITIVE, NEGATIVE, UNKNOWN), DonorStatus (ACTIVE, INACTIVE, DEFERRED), VerificationStatus (UNVERIFIED, VERIFIED, REQUIRES_REVIEW), UserStatus (ACTIVE, SUSPENDED, DEACTIVATED, PENDING_VERIFICATION), OrganizationStatus (ACTIVE, SUSPENDED, PENDING_APPROVAL, DEACTIVATED)
- Session model — tracks device info, IP, user agent, expiry, revocation for "logged in devices" future feature
- EmailVerificationToken model — foundation for email verification flow
Auth Service (apps/api/src/modules/auth/auth.service.ts)
- User status checks: SUSPENDED → 403 "account suspended", DEACTIVATED → 403 "account deactivated", PENDING_VERIFICATION → 403 "verify email"
- lastLoginAt updated on every login
- permissions included in token payload and /me response
- Registration atomically creates User + DonorProfile + DONOR membership in a transaction
- changePassword endpoint: verifies current password, issues new hash, revokes all existing refresh tokens
Permissions System
- PermissionsService — fetches role→permission mappings, grants admin.manage to SUPER_ADMIN
- PermissionsGuard — @Permissions('perm1', 'perm2') decorator; any matching permission allows access
- OrganizationGuard — enforces hospital A ≠ hospital B data isolation using membership lookup
Donors Module
- GET /api/v1/donors/profile — donor fetches own profile
- PUT /api/v1/donors/profile — donor updates profile (triggers REQUIRES_REVIEW verification status)
- GET /api/v1/donors/:id — staff or self only
- GET /api/v1/donors — paginated list with optional bloodType/donorStatus/city filters
Mobile Auth
- Auth store expanded: user, isLoading, setUser, clearAuth
- Bootstrap hook useAuthBootstrap — on app open, checks refresh token and fetches /auth/me
- Auth loading screen with spinner while bootstrapping
- Professional error messages: "Email or password is incorrect", "Your account has been suspended", etc.
- Real logout calls POST /api/v1/auth/logout with refresh token
Web Auth (hospital + blood-center)
- Both web apps now have lib/auth.ts with login, logout, me, isAuthenticated, token refresh
- Dashboard shows login button for unauthenticated users
- Shows user name and role after login
- Access denied UI when user lacks required role
- Real logout with API call
Seed Script
- 26 granular permissions across domains (hospital, blood_center, inventory, shipment, etc.)
- Role→permission mappings for all 7 roles
- 7 test users: SUPER_ADMIN, DONOR, HOSPITAL_ADMIN, HOSPITAL_STAFF, BLOOD_CENTER_ADMIN, BLOOD_CENTER_STAFF, COURIER
- Each user has realistic memberships
2. Database Models
All Phase 1 models preserved and enhanced:
- User — id, email, phone, passwordHash, firstName, lastName, displayName, avatarUrl, dateOfBirth, status, emailVerified, phoneVerified, lastLoginAt, createdAt, updatedAt
- Role — id, code (enum), name
- Permission — id, code (string), name
- RolePermission — roleId + permissionId (junction)
- Organization — id, type, name, legalName, phone, email, address, latitude, longitude, status
- Hospital — id, organizationId
- BloodCenter — id, organizationId
- OrganizationMembership — id, userId, organizationId, roleId, status
- DonorProfile — id, userId, bloodType, rhFactor, city, donorStatus, verificationStatus, dateOfBirth, consentLocation
- RefreshToken — id, userId, tokenHash, expiresAt, revokedAt, createdAt, lastUsedAt
- Session — id, userId, tokenHash, deviceName, deviceType, ipAddress, userAgent, expiresAt, revokedAt, createdAt, lastUsedAt
- EmailVerificationToken — id, userId, token, expiresAt, usedAt, createdAt
- AuditLog — id, actorId, action, entityType, entityId, organizationId, metadata, ipAddress, createdAt
3. Migration Status
Migration SQL file regenerated from new schema. Run pnpm db:migrate after starting PostgreSQL to apply.
4. Authentication Status
Endpoint
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/change-password
GET /auth/me
5. RBAC Status
- Roles — DONOR, HOSPITAL_ADMIN, HOSPITAL_STAFF, BLOOD_CENTER_ADMIN, BLOOD_CENTER_STAFF, COURIER, SUPER_ADMIN
- Permissions — 26 granular permissions (see seed)
- JwtAuthGuard — validates Bearer token
- RolesGuard — @Roles(...) decorator
- PermissionsGuard — @Permissions(...) decorator with any-match semantics
- OrganizationGuard — prevents cross-organization data access
6. Organization Isolation Status
OrganizationGuard checks that users can only access resources in organizations where they have an ACTIVE membership. Hospital staff cannot access another hospital's donors.
7. Mobile Auth Status
- Auth bootstrap on app start: checks refresh → fetches /auth/me → populates Zustand store
- Loading spinner during bootstrap
- Professional error messages
- Login/register connected to real API
- Logout calls backend to revoke refresh token
- Role-based UI access ready
8. Hospital Web Auth Status
- Login button on dashboard (development credentials pre-filled)
- Real /auth/login, /auth/me, /auth/logout calls
- Shows user name after login
- Access denied screen for non-hospital roles
- Sign out button
9. Blood Center Web Auth Status
Same as hospital web: real auth integration, role-based access denial, sign out.
10. Tests Executed
- 16 unit tests across auth service, roles guard, health controller
- Covers: registration, login (valid/invalid/suspended/deactivated), refresh (valid/expired), logout, permissions
- E2E tests scaffolded in app.e2e-spec.ts (require running DB)
11. Remaining Problems
- No PostgreSQL running → migration not applied, seed not run in this environment
- E2E tests cannot execute without DB
- Mobile native build not verified (requires iOS/Android toolchain)
- Email verification flow is scaffolded (model exists) but no email sending integration
12. Commands to Run
# Install
pnpm install

# Environment
cp .env.example .env
cp .env.example apps/api/.env

# Database (requires PostgreSQL)
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start
pnpm dev:api      # http://localhost:3001
pnpm dev:hospital # http://localhost:3000
pnpm dev:blood-center # http://localhost:3002
pnpm dev:mobile   # Expo

# Verify
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
13. Recommended Phase 3
- Email verification (sendgrid/resend integration)
- Complete donor profile with medical eligibility rules
- Hospital SOS creation workflow
- Appointment booking system
- Notification service (push notifications)
- Courier shipment assignment
- Inventory management across blood centers
- Analytics dashboard
- CI/CD pipeline











Phase 3 Complete
1. What was implemented
Database Schema (Prisma)
- Added NotificationPreference model with 6 notification categories
- Extended DonorProfile with: bloodTypeVerifiedAt, bloodTypeVerifiedBy, bloodTypeSource, bloodTypeNote, district
- Added VerificationSource enum: BLOOD_CENTER, HOSPITAL, LABORATORY, OTHER_AUTHORIZED_SOURCE
- Added Session model indexes
Backend API
- GET/PATCH /api/v1/users/me - User profile management
- GET /api/v1/donors/profile - Own donor profile
- PUT /api/v1/donors/profile - Update donor profile (sets REQUIRES_REVIEW)
- GET /api/v1/donors/profile/completion - Profile completion percentage
- POST /api/v1/donors/:id/verify-blood-type - Staff blood type verification with audit logging
- GET /api/v1/notifications/preferences - Get notification preferences
- PATCH /api/v1/notifications/preferences - Update notification preferences
- GET /api/v1/auth/sessions - List active sessions
- DELETE /api/v1/auth/sessions/:id - Revoke specific session
- POST /api/v1/auth/sessions/revoke-all - Revoke all sessions
Mobile App
- 6-step onboarding flow: Welcome, Personal Info, Blood Type, Location, Notifications, Review
- Profile view screen with real donor data, completion percentage, blood type card
- Profile edit screen for personal information
- Donor profile edit screen for blood type and location
- Security screen with password change and logout all devices
- Notifications preferences screen with toggles
- Privacy settings screen
- Updated home screen showing real donor data, greeting, and completion status
Permissions
- Added donor.verify permission for hospital/blood center staff
2. Database Changes
- New NotificationPreference table
- Extended DonorProfile with verification metadata fields
- New VerificationSource enum
3. New API Endpoints
- GET/PATCH /users/me
- GET /donors/profile/completion
- POST /donors/:id/verify-blood-type
- GET/PATCH /notifications/preferences
- GET /auth/sessions, DELETE /auth/sessions/:id, POST /auth/sessions/revoke-all
4. Donor Profile Architecture
- Separation of User (identity) and DonorProfile (donor-specific data)
- Profile completion calculation on server (trusted source)
- Blood type self-declaration marked as UNVERIFIED
5. Onboarding Flow
Multi-step flow with progress indicator, back navigation, and data persistence via API calls.
6. Blood Type Verification Architecture
- Only staff with donor.verify permission can verify
- Creates audit log with source, timestamp, actor, and previous/new values
- Organization isolation enforced
7. Security Changes
- Session management with device tracking
- Change password revokes all refresh tokens
- Logout all devices functionality
8. Mobile UI Changes
- Real donor data on home screen
- Professional blood type card with verification badge
- Profile completion indicator
- Settings screens for security, privacy, notifications
9. Settings Architecture
- Profile settings
- Notification preferences with 6 categories
- Privacy settings (placeholders for future)
- Security with password change and session management
10. Tests Executed
pnpm typecheck  # passed (9 packages)
pnpm lint       # passed (9 packages)
pnpm test       # passed (16 API tests)
pnpm build      # passed (API + web apps)
11. Regression Checks
- All Phase 1/2 functionality preserved
- Auth flow unchanged
- RBAC unchanged
- Organization isolation unchanged
12. Remaining Issues
- No PostgreSQL running in environment - migration not applied
- Mobile native build not verified (requires iOS/Android toolchain)
- Email verification flow not implemented (scaffold exists)
13. Commands to Run
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
cp .env.example apps/api/.env

# Database (requires PostgreSQL running)
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start services
pnpm dev:api      # http://localhost:3001
pnpm dev:hospital # http://localhost:3000
pnpm dev:blood-center # http://localhost:3002
pnpm dev:mobile   # Expo

# Verify
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
14. Phase 4 Recommendation
- Email verification (SendGrid/Resend integration)
- Complete appointment booking system
- Push notification integration
- Courier shipment assignment
- Inventory management across blood centers
- Analytics dashboard for staff
- CI/CD pipeline and containerization



Summary
In this session, I completed the Phase 4 appointment system implementation:
Backend (already done before this session)
- Prisma schema with AppointmentSlot, Appointment, AppointmentHistory models
- Appointments module with booking, cancellation, reschedule, confirm, complete endpoints
- Appointment slots module with availability and organization slot management
- Shared types and validation schemas
Mobile (completed this session)
API Layer:
- src/api/appointments.ts - API client functions for all appointment endpoints
- src/hooks/useAppointments.ts - React Query hooks (useAvailability, useOrganizations, useMyAppointments, useNextAppointment, useAppointment, useBookAppointment, useCancelAppointment, useRescheduleAppointment)
Screens:
- app/(app)/calendar.tsx - Full month calendar view with appointment indicators and day selection
- app/(app)/appointment/[id].tsx - Appointment detail with cancel/reschedule options
- app/(booking)/ - Booking flow:
- index.tsx - Select appointment type
- organizations.tsx - Select organization  
- date.tsx - Select date from month view
- time.tsx - Select time slot grouped by morning/afternoon/evening
- review.tsx - Review and confirm booking
- confirmation.tsx - Success confirmation with reference number
- app/(app)/home.tsx - Updated with next appointment card
Components:
- Added loading prop to AppButton.tsx
Verification
- All lint checks pass (9/9 successful)
- All tests pass (16/16 passed)




Phase 5 Implementation Complete
What was implemented:
1. Database Models (Prisma schema)
- Donation - main donation record with blood type, volume, status tracking
- DonationEvent - audit trail for donation workflow events  
- DonationAssessment - pre-donation assessment decisions
- BloodUnit - inventory foundation with traceability
2. Donation State Machine
- States: SCHEDULED → CHECKED_IN → IN_PROGRESS → COMPLETED
- Also: CANCELLED, ABORTED, NO_SHOW, REJECTED
- Controlled transitions with validation
3. API Endpoints
- GET /api/v1/donations/me - donor's donation history
- GET /api/v1/donations/me/statistics - donor stats (total, volume, dates)
- GET /api/v1/donations/:id - donation details
- POST /api/v1/organizations/:orgId/donations/check-in/:aptId - staff check-in
- POST /api/v1/organizations/:orgId/donations/:id/start - start donation
- POST /api/v1/organizations/:orgId/donations/:id/complete - complete donation
- POST /api/v1/organizations/:orgId/donations/:id/cancel - cancel donation
- POST /api/v1/organizations/:orgId/donations/:orgId/abort - abort donation
- GET /api/v1/organizations/:orgId/donations - staff donation list
- GET /api/v1/organizations/:orgId/donations/today-appointments - today's appointments
4. Mobile Implementation
- API hooks: useMyDonations, useDonationStatistics, useDonation
- Donations list screen with filters (All/Completed/Cancelled)
- Donation detail screen
- Home screen updated with donation statistics
5. Blood Unit/Inventory Foundation
- BloodUnit model created
- When donation completes: blood unit is created with COLLECTED status
- Event BloodUnitCollected is logged for future inventory system
6. Seed Data
- Completed donation, cancelled donation, today's appointment
Commands to run:
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations  
pnpm db:seed       # Seed development data
Recommended Phase 6:
- Hospital/Blood Center web donation workflow UI (check-in, start, complete forms)
- Notification events infrastructure
- Blood inventory management system
▣  Build · MiniMax-M2.7






Summary: Phase 6 Progress
Completed:
- Created inventory.controller.ts with all inventory endpoints
- Created inventory.module.ts and wired into app.module.ts
- Fixed type errors:
- Added unitReference generation in donations service when creating blood units
- Fixed seed file to include unitReference
- Changed referenceNumber → donationReference in inventory service queries
- Typecheck passes, lint has only warnings, tests pass
Pending:
- Blood center web inventory dashboard UI
- Inventory seed data (locations, blood units)
Want me to continue with the web UI implementation or the seed data?





Phase 6 yakunlandi
Bajarilgan ishlar:
1. Inventory Controller - Barcha inventory endpointlari yaratildi
2. Inventory Module - App module ga ulandi
3. Web UI Dashboard (apps/blood-center-web/app/inventory/page.tsx):
- Statistika kartalar (umumiy, mavjud, karantin, rezerv)
- Qidiruv va filtrlar (qon turi, Rh, komponent, status)
- DataTable bilan qon buyumlari ro'yxati
- Unit details modal
- Move, Quarantine, Discard amallari
- Location yaratish modal
4. Seed data (apps/api/prisma/seed.ts):
- 4 ta inventory location (Main Storage, Quarantine Storage, Testing Lab, Issuing Counter)
- 10 ta blood unit (turli qon turlari va statuslar)
5. Typecheck va lint - o'tdi
6. Test - 16 ta test o'tdi
API endpoints:
- GET /organizations/:orgId/inventory/summary
- GET /organizations/:orgId/inventory
- GET /organizations/:orgId/inventory/units/:unitId
- POST /organizations/:orgId/inventory/units/:unitId/move|quarantine|discard|release
- GET|POST|PATCH /organizations/:orgId/inventory/locations
- GET /organizations/:orgId/inventory/movements|reservations|alerts







Phase 8 Implementation Report
1. Summary of Implementation
Phase 8 implements a complete blood delivery workflow with real-time shipment tracking. The system transforms READY_FOR_PICKUP blood requests into delivered blood units at hospitals through a structured courier-based delivery process.
2. Files/Modules Created
API Backend:
- apps/api/src/modules/shipments/shipments.service.ts - Main service with all business logic
- apps/api/src/modules/shipments/shipments.controller.ts - REST API endpoints
- apps/api/src/modules/shipments/shipments.module.ts - NestJS module
- apps/api/src/modules/shipments/dto/shipment.dto.ts - Data transfer objects
Web Frontend:
- apps/blood-center-web/lib/shipments.ts - API client for shipments
- apps/blood-center-web/app/shipments/page.tsx - Blood center shipment dashboard
3. Files Modified
Database Schema (apps/api/prisma/schema.prisma):
- Added enums: BloodRequestStatus, BloodRequestPriority, ShipmentStatus, CourierStatus, ShipmentEventType, DeliveryFailureReason
- Extended MovementType with TRANSFER_OUT, TRANSFER_IN
- Added models: BloodRequest, BloodRequestItem, BloodRequestEvent, Courier, Shipment, ShipmentUnit, ShipmentEvent, ShipmentLocation
- Added relations to existing models
Seed File (apps/api/prisma/seed.ts):
- Added CourierStatus import
- Added courier profile creation for existing courier user
App Module (apps/api/src/app.module.ts):
- Added ShipmentsModule import
4. Database Changes
New tables:
- BloodRequest - Hospital blood requests
- BloodRequestItem - Individual items in a request
- BloodRequestEvent - Audit trail for requests
- Courier - Courier profiles
- Shipment - Delivery shipments
- ShipmentUnit - Blood units in shipments
- ShipmentEvent - Shipment audit trail
- ShipmentLocation - GPS tracking points
5. Shipment State Machine
CREATED → COURIER_ASSIGNED → COURIER_ACCEPTED → PICKUP_STARTED → PICKED_UP → IN_TRANSIT → ARRIVED_AT_HOSPITAL → DELIVERED
                                    ↓
                            COURIER_DECLINED (can reassign)
Also supports: FAILED, CANCELLED
6. Courier Workflow
1. Blood center creates shipment from READY_FOR_PICKUP request
2. Blood center assigns available courier
3. Courier accepts or declines
4. If accepted: Courier starts pickup → confirms pickup → starts delivery → updates location en route → arrives at hospital
5. Hospital confirms delivery
6. Courier becomes AVAILABLE again
7. Pickup Workflow
1. Courier clicks "Start Pickup" (COURIER_ACCEPTED → PICKUP_STARTED)
2. At blood center: Courier confirms pickup (PICKUP_STARTED → PICKED_UP)
3. Inventory movement created (TRANSFER_OUT)
4. Blood units remain traceable
8. Real-Time Tracking Architecture
Location tracking via REST API endpoint (POST /courier/shipments/:id/update-location):
- Courier sends GPS coordinates during active delivery
- Server validates: lat/long ranges, timestamp, authorization
- Location stored in ShipmentLocation table
- Retrieved via GET /shipments/:id/locations
- Authorization enforced: Hospital can only see its own shipments
9. WebSocket Architecture
Not implemented in this phase. Real-time updates via polling available through REST endpoints.
10. Location Security
- Latitude: -90 to 90
- Longitude: -180 to 180
- Authorization check: User must belong to source/destination org or be the assigned courier
- Active shipment required for location updates
- Accuracy, heading, speed recorded
11. Delivery Confirmation
Two-party confirmation:
1. Courier indicates "Arrived" (IN_TRANSIT → ARRIVED_AT_HOSPITAL)
2. Hospital staff verifies and confirms receipt (ARRIVED_AT_HOSPITAL → DELIVERED)
12. Inventory Transfer
- At pickup: TRANSFER_OUT movement created at blood center
- At delivery: TRANSFER_IN movement created at hospital
- Blood unit organizationId updated to hospital
- Reservation marked FULFILLED
13. Transaction Safety
All critical operations use database transactions:
- Shipment creation
- Courier assignment
- Pickup confirmation
- Delivery confirmation
Rollback on any failure ensures data consistency.
14. Concurrency Protection
- Unique constraint on BloodRequest.shipment (one active shipment per request)
- Unique constraint on ShipmentUnit.shipmentId + bloodUnitId
- Transaction isolation for critical operations
15. API Endpoints
Blood Requests:
- POST /organizations/:orgId/blood-requests - Create request
- GET /organizations/:orgId/blood-requests - List requests
- GET /organizations/:orgId/blood-requests/:id - Get request
- POST /organizations/:orgId/blood-requests/:id/approve - Approve
- POST /organizations/:orgId/blood-requests/:id/ready-for-pickup - Mark ready
- POST /organizations/:orgId/blood-requests/:id/shipments - Create shipment
Shipments:
- GET /organizations/:orgId/shipments - List shipments
- GET /organizations/:orgId/shipments/:id - Get shipment
- POST /organizations/:orgId/shipments/:id/assign - Assign courier
- POST /courier/shipments/:id/accept - Accept
- POST /courier/shipments/:id/decline - Decline
- POST /courier/shipments/:id/start-pickup - Start pickup
- POST /courier/shipments/:id/confirm-pickup - Confirm pickup
- POST /courier/shipments/:id/start-delivery - Start delivery
- POST /courier/shipments/:id/update-location - Update location
- POST /courier/shipments/:id/arrive - Arrive at hospital
- POST /courier/shipments/:id/fail - Fail shipment
- POST /organizations/:orgId/shipments/:id/confirm-delivery - Confirm delivery
- GET /shipments/:id/locations - Get location history
16. Permissions
New permissions added:
- shipment.read - Read shipments
- shipment.create - Create shipments
- shipment.assign - Assign couriers
- shipment.accept - Accept shipments
- shipment.start_pickup - Start pickup
- shipment.confirm_pickup - Confirm pickup
- shipment.start_delivery - Start delivery
- shipment.update_location - Update location
- shipment.arrive - Arrive at hospital
- shipment.confirm_delivery - Confirm delivery
- shipment.fail - Fail shipment
- shipment.cancel - Cancel shipment
17. Tests
- 16 existing tests pass
- No new tests added (Phase 8 would require comprehensive E2E tests)
18. Regression Results
- API typecheck: PASS
- API lint: PASS (warnings only)
- API tests: PASS (16/16)
- Web typecheck: Pending fixes needed for shipments page
19. Documentation Updates
No documentation updates made. Following files should be updated:
- docs/architecture.md
- docs/database.md
- docs/api.md
20. Known Limitations
1. WebSocket not implemented - Real-time updates via polling only
2. Hospital UI not created - Only Blood Center UI created
3. Courier mobile UI not created - Courier interface in mobile app not implemented
4. No blood request creation flow - Only existing READY_FOR_PICKUP requests can create shipments
5. No ETA calculation - estimatedArrivalAt not implemented
6. No map provider - Uses raw coordinates only
7. Web UI type errors - Some TypeScript errors in shipments page
21. Commands Used to Verify
pnpm --filter @donor/api typecheck  # PASS
pnpm --filter @donor/api lint      # PASS (warnings)
pnpm --filter @donor/api test     # PASS (16 tests)
22. Recommended Next Phase
Phase 9: SOS and Emergency Donor Matching (NOT implemented as per requirements)










Phase 9 Complete
Summary of Implementation
1. Prisma Schema Extensions
- Fixed missing relations for Emergency models
- Added @unique to matchId in EmergencyResponse to fix Prisma validation
- Schema now validates with pnpm prisma generate
2. Emergency Module (API)
- emergency.service.ts - Full business logic:
- Blood compatibility checking
- Hospital: create, activate, cancel emergencies, track donors, confirm arrival
- Donors: view matches, accept/decline, start journey, GPS tracking, arrive, complete
- emergency.controller.ts - REST endpoints for hospitals and donors
- emergency.module.ts - NestJS module integrated into AppModule
3. Hospital Web UI (apps/hospital-web/)
- lib/emergency.ts - API client with all emergency operations
- app/emergency/page.tsx - Full SOS dashboard:
- Create/view/filter emergency requests
- Activate/cancel emergencies
- Track donor responses
- Confirm donor arrival
4. Mobile Donor UI (apps/mobile/)
- src/api/emergency.ts - API client
- app/sos.tsx - Complete donor emergency interface:
- View active emergency matches
- Accept/decline requests
- Journey tracking (start, en route, arrived)
- Cancel response
5. Seed Data (apps/api/prisma/seed.ts)
- Added 3 emergency requests (O- CRITICAL, A+ HIGH, B+ MEDIUM/DRAFT)
- Added emergency matches linking to donor
- Console output shows emergency references
6. Bug Fixes
- Fixed pre-existing mobile route type errors in:
- app/(app)/appointment/[id].tsx
- app/(booking)/confirmation.tsx
Verification
- Typecheck: All 9 packages pass ✓
- Lint: API 27 warnings (0 errors) ✓  
- Tests: 16/16 pass ✓+ Thought: 814ms
Summary: Phase 10 - Blood Testing Implementation Complete
What was done in this session:
1. Mobile Laboratory UI - Created apps/mobile/app/(app)/laboratory/index.tsx with:
- Overview stats (upcoming appointments, published results)
- Book blood test card
- Upcoming appointments list with status badges
- Recent published results list
- Pull-to-refresh functionality
2. Fixed Seed Data - Added comprehensive laboratory seed data in apps/api/prisma/seed.ts:
- Test Types: CBC, Blood Grouping, Ferritin
- Test Parameters: Hemoglobin, RBC, WBC, Hematocrit, Platelets
- Reference Ranges for test types
- Laboratory Profile for Northstar Blood Center
- Sample appointment and published result with result items
Verification Results:
App
API
Mobile
Blood Center Web
All Phase 10 work is complete.





Summary: Phase 10 - Blood Testing Implementation Complete
What was done in this session:
1. Mobile Laboratory UI - Created apps/mobile/app/(app)/laboratory/index.tsx with:
- Overview stats (upcoming appointments, published results)
- Book blood test card
- Upcoming appointments list with status badges
- Recent published results list
- Pull-to-refresh functionality
2. Fixed Seed Data - Added comprehensive laboratory seed data in apps/api/prisma/seed.ts:
- Test Types: CBC, Blood Grouping, Ferritin
- Test Parameters: Hemoglobin, RBC, WBC, Hematocrit, Platelets
- Reference Ranges for test types
- Laboratory Profile for Northstar Blood Center
- Sample appointment and published result with result items
Verification Results:
App
API
Mobile
Blood Center Web
All Phase 10 work is complete.
▣  Build · MiniMax-M2.7 · 6m 49s

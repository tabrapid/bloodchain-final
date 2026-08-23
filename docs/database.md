# Database

DONOR uses PostgreSQL with Prisma ORM.

## Schema overview

The schema lives in `apps/api/prisma/schema.prisma`.

### Core models

- **User** — platform identity: email, phone, password hash, name, status, avatar, email/phone verification flags.
- **Role** — `DONOR`, `HOSPITAL_ADMIN`, `HOSPITAL_STAFF`, `BLOOD_CENTER_ADMIN`, `BLOOD_CENTER_STAFF`, `COURIER`, `SUPER_ADMIN`.
- **Permission** + **RolePermission** — granular permission matrix for RBAC.
- **Organization** — generic organization with `type` (`HOSPITAL`, `BLOOD_CENTER`) and status.
- **Hospital** / **BloodCenter** — subtype tables linked to `Organization`.
- **OrganizationMembership** — many-to-many between users, organizations, and roles.
- **DonorProfile** — donor-specific data: blood type, rh factor, verification status, city, district, date of birth.
- **NotificationPreference** — donor notification settings: emergency requests, appointments, reminders, etc.
- **RefreshToken** — hashed refresh tokens with expiry and revocation.
- **Session** — session tracking with device info, IP, user agent for multi-device support.
- **EmailVerificationToken** — email verification tokens.
- **AuditLog** — actor, action, entity type/id, organization, metadata, IP, timestamp.

### Enums

- **UserStatus**: `ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `PENDING_VERIFICATION`
- **OrganizationType**: `HOSPITAL`, `BLOOD_CENTER`
- **OrganizationStatus**: `ACTIVE`, `SUSPENDED`, `PENDING_APPROVAL`, `DEACTIVATED`
- **MembershipStatus**: `ACTIVE`, `INACTIVE`, `PENDING`
- **BloodType**: `A`, `B`, `AB`, `O`
- **RhFactor**: `POSITIVE`, `NEGATIVE`, `UNKNOWN`
- **DonorStatus**: `ACTIVE`, `INACTIVE`, `DEFERRED`
- **VerificationStatus**: `UNVERIFIED`, `VERIFIED`, `REQUIRES_REVIEW`
- **VerificationSource**: `BLOOD_CENTER`, `HOSPITAL`, `LABORATORY`, `OTHER_AUTHORIZED_SOURCE`
- **TestCategory**: `HEMATOLOGY`, `IRON`, `BLOOD_GROUP`, `LIVER_FUNCTION`, `KIDNEY_FUNCTION`, `DIABETES`, `THYROID`, `LIPID`, `GENERAL`, `OTHER`
- **ResultFlag**: `NORMAL`, `LOW`, `HIGH`, `CRITICAL`, `ABNORMAL`, `NOT_AVAILABLE`

### Indexes

Indexes are defined on commonly queried columns:

- `User.email`, `User.status`, `User.createdAt`
- `Organization.type`, `Organization.status`, `Organization.createdAt`
- `OrganizationMembership.userId`, `OrganizationMembership.organizationId`, `OrganizationMembership.roleId`, `OrganizationMembership.status`
- `RefreshToken.userId`, `RefreshToken.expiresAt`, `RefreshToken.tokenHash`
- `Session.userId`, `Session.tokenHash`, `Session.expiresAt`
- `AuditLog.actorId`, `AuditLog.organizationId`, `AuditLog.action`, `AuditLog.entityType`, `AuditLog.createdAt`
- `DonorProfile.bloodType`, `DonorProfile.donorStatus`
- `LaboratoryResult.donorId`, `LaboratoryResult.status`, `LaboratoryResult.publishedAt`
- `LaboratoryResultItem.resultId`, `LaboratoryResultItem.parameterId`
- `TestType.category`, `TestType.isActive`
- `TestReferenceRange.testTypeId`, `TestReferenceRange.isActive`

## Migrations

```bash
pnpm db:migrate        # prisma migrate dev
pnpm db:generate       # prisma generate
pnpm db:seed           # seed development data
pnpm db:reset          # reset database and re-run migrations
```

## Seeding

`apps/api/prisma/seed.ts` creates:

- All roles and 28 granular permissions including `donor.verify`.
- A SUPER_ADMIN user: `admin@donor.local` / `DevelopmentOnly!123`.
- A DONOR user with verified blood type: `donor@donor.local` / `DevelopmentOnly!123`.
- Hospital and blood center staff users.
- A development hospital and blood center with memberships.

These credentials are for local development only.

## Medical data principle

No medical rules, donation intervals, or reference ranges are hard-coded. Future rules will be configurable and subject to qualified healthcare review.

Blood type verification:
- Donor-entered blood type is marked as `UNVERIFIED` until verified by authorized staff.
- Only users with `donor.verify` permission can mark blood types as `VERIFIED`.
- Verification creates an audit log entry with source, timestamp, and actor.

## Laboratory models (Phase 10)

The laboratory system consists of:

- **TestType** — defines laboratory tests (CBC, Lipid Panel, Blood Grouping, etc.) with category and display order.
- **TestParameter** — individual parameters within a test (Hemoglobin, WBC, RBC, etc.) with unit and data type.
- **TestReferenceRange** — normal value ranges per test type, optionally per laboratory.
- **LaboratoryProfile** — laboratory organization metadata (linked to Organization).
- **LaboratoryResult** — a donor's completed test result with status workflow (ENTERED → REVIEWED → PUBLISHED).
- **LaboratoryResultItem** — individual parameter result with value, reference range, and flag.
- **LaboratoryResultVersion** — audit trail for result changes.

Results flow: Appointment → Check-in → Start Test → Enter Results → Review → Publish → Visible to Donor

## Health Trends (Phase 11)

Health Trends is a query/analytics layer over LaboratoryResult data:

- No duplicate storage — trends are derived from published LaboratoryResultItem records.
- TrendData includes: parameter code/name, latest/previous values, change calculations, trend direction (INCREASING/DECREASING/STABLE/INSUFFICIENT_DATA).
- Reference ranges are visualized from TestReferenceRange when available.
- Unit compatibility is enforced — different units are not blindly combined.
- Date filtering supports: 1M, 3M, 6M, 1Y, 2Y, ALL.
- Statistics include: count, min, max, average, first/latest values with dates.

Privacy: Donor can only access their own health trend data. User identity is derived from JWT, never from request parameters.

# Backlog — boolean request fields are coerced, not parsed

**Found:** Sprint 2, while verifying the organization directory over HTTP.
**Fixed in Sprint 2:** the nine boolean fields the directory introduced.
**Outstanding:** twenty boolean fields on existing request DTOs.

## What happens

`apps/api/src/bootstrap.ts` configures the global `ValidationPipe` with:

```ts
transform: true,
transformOptions: { enableImplicitConversion: true },
```

Implicit conversion coerces every property to its declared TypeScript type. For
a `boolean` property that coercion is `Boolean(value)`, under which **every
non-empty string is `true`**. So:

| Client sends | Declared type | Value the service receives |
| --- | --- | --- |
| `?verified=false` | `boolean` | `true` |
| `{"verified":"no"}` | `boolean` | `true` |
| `{"maintenanceMode":"off"}` | `boolean` | `true` |

`@IsBoolean()` does not catch it, because validation runs *after* the
transform and by then the value really is a boolean. The request succeeds, the
response looks plausible, and the filter or setting means the opposite of what
was asked for. This was observed live: `GET /organizations?verified=false`
returned the verified organizations, byte-for-byte identical to
`?verified=true`.

## The fix that is already in place

`apps/api/src/common/decorators/boolean-query.decorator.ts` exports
`BooleanQuery()` (optional) and `BooleanField()` (required). Both read
`obj[key]` — the value as the client sent it, before implicit conversion —
parse the recognised spellings (`true/1/yes/on`, `false/0/no/off`,
case-insensitive), and pass anything else through unchanged so `@IsBoolean()`
rejects it with a 400 instead of guessing.

Covered by `boolean-query.decorator.spec.ts` (20 tests, run with the same
`enableImplicitConversion` the server uses) and by the HTTP section of
`scripts/verify-geography.mjs`.

Applied so far to:

- `OrganizationDirectoryQueryDto.acceptsDonations / providesLaboratory / verified`
- `UpdateOrganizationDirectoryDto.acceptsDonations / providesLaboratory`
- `OrganizationHoursDto.isClosed`
- `SetOrganizationVerificationDto.verified`

## Still to convert

Every one of these is a `@Body()` field, so the exposure is limited to clients
that send a string where the schema says boolean — which the repo's own
TypeScript clients do not do today. That is why this is a backlog item rather
than a Sprint 2 change: the conversion is mechanical but it touches six modules
and each one needs its request tests re-run.

| File | Field |
| --- | --- |
| `src/modules/admin/dto/admin.dto.ts` | `aiHealthInsightsEnabled` |
| `src/modules/admin/dto/admin.dto.ts` | `sosEmergencyEnabled` |
| `src/modules/admin/dto/admin.dto.ts` | `gamificationEnabled` |
| `src/modules/admin/dto/admin.dto.ts` | `pushNotificationsEnabled` |
| `src/modules/admin/dto/admin.dto.ts` | `maintenanceMode` |
| `src/modules/donors/dto/update-donor-profile.dto.ts` | `consentLocation` |
| `src/modules/education/dto/education.dto.ts` | `isActive` |
| `src/modules/gamification/dto/gamification.dto.ts` | `visible` |
| `src/modules/inventory/dto/inventory.dto.ts` | `active` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `emergencyRequests` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `appointments` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `donationReminders` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `healthResults` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `gamification` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `bloodRequests` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `shipments` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `inventory` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `system` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `security` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `quietHoursEnabled` |
| `src/modules/notifications/dto/notification-preference.dto.ts` | `emergencyOverride` |
| `src/modules/notifications/dto/push-device.dto.ts` | `isActive` (×2) |

Two of these would be worth doing first on their consequences alone:
`maintenanceMode` (a string turns the platform off) and `consentLocation` (a
string grants location consent the donor may not have given).

## The alternative, and why it was not taken now

Turning `enableImplicitConversion` off would fix all of them at once, and is
probably the right end state. It is not a Sprint 2 change: every numeric and
enum query parameter in the API would then need an explicit `@Type()`, and the
ones that already have one would need checking rather than assuming. That is a
sprint of its own, with the full request-level suite as its evidence.

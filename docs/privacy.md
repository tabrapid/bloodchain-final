# BloodChain privacy implementation inventory

Status: internal engineering inventory, 2026-11-06. This is not a published
privacy notice, an approved retention schedule or a compliance certificate.
The operator legal entity has not yet been established. See
`legal/uzbekistan-research-2026-11-05.md` and the launch status register.

## Data classes and storage

| Data | Principal Prisma models | Purpose and access boundary to verify |
| --- | --- | --- |
| Account identity and contacts | User, DonorProfile, OrganizationMembership | Account operation and authorized institution workflows; a global directory is not available to tenant admins |
| Credentials and sessions | Session, RefreshToken, EmailVerificationToken, PasswordResetToken, PhoneVerification | Authentication/recovery; never return or log credential material |
| Organisation and directory | Organization, Hospital, BloodCenter, Region, District | Directory facts and organisational membership; directory type is not clinical authorization |
| Appointments and donations | Appointment, AppointmentHistory, Donation, DonationAssessment, DonationEvent | Institution/donor clinical workflow, with role, tenant and ownership controls |
| Screening and laboratory data | DonationSample, ScreeningOrder, ScreeningResult, LaboratoryResult, LaboratoryResultVersion | Highly sensitive clinical data; approved workflows and clinical responsibility required |
| Components and traceability | BloodUnit, BloodUnitDisposition, InventoryMovement, RecallCase, HemovigilanceEvent | Clinical/operational traceability; account closure must not silently erase the chain |
| Cold chain and logistics | ColdChainEvent, Shipment, ShipmentEvent, ShipmentLocation, Courier | Handling and delivery workflow; retention and visibility need approved rules |
| Emergency and precise location | EmergencyRequest, EmergencyResponse, EmergencyLocation | Restricted emergency workflow; no public donor location directory |
| Consent evidence and policy | ConsentDocument, ConsentAcceptance, ConsentRequirement, RetentionPolicy | Versioned evidence and policy configuration; models do not themselves prove approval or complete endpoint enforcement |
| Notifications and device tokens | Notification, NotificationDelivery, PushDevice, NotificationPreference | Authenticated inbox and optional interruption; push tokens remain personal-data inventory items |
| Recognition and community | GamificationProfile, AchievementUnlock, CommunityPost, CampaignParticipant | Separate public/private settings; actual published fields and moderation must be checked |
| AI features | AIInsight, AIRequestLog, AIConversation, AIMessage | Configuration-dependent and outside initial pilot scope; exact external payload and applicable basis require review |
| Audit and operational state | AuditLog, IdempotencyRecord, PlatformSettings | Restricted security/operation records; read/export coverage, protection and retention require verification |

## Actual external paths

- API/PostgreSQL and backups reside on the configured VPS. Physical datacenter
  location is not established by an IP address or `.uz` domain; provider evidence
  and a storage/transfer decision are still required.
- Email verification and password recovery use SMTP. Resend receives recipients
  and the actual transactional email, including a one-time link. Generic email
  text does not eliminate this processing.
- The optional Eskiz adapter sends the recipient number and message only when
  explicitly selected and configured. The current deployed provider must be
  checked independently; adapter existence does not prove delivery.
- Expo/APNs/FCM receive push tokens and generic notification text, an opaque
  notification id and the inbox link. Original clinical text, arbitrary metadata
  and original links are excluded by the delivery service and regression tests.
- Map requests may disclose device/network/location-related data to configured
  providers. Foreground location is used by donor emergency and courier flows;
  those purposes are not interchangeable. Confirm each platform's actual SDKs.
- Host monitoring uses the approved email/Telegram destinations for service
  status. Clinical records, recovery URLs and credentials must not be included.
- AI/analytics/vendor claims must be grounded in the configured deployment and
  payload, not in the absence of a personal name. Pseudonymized health data is
  not automatically anonymous.

## Retention: what is and is not implemented

There is no approved universal 90-day retention rule. A RetentionPolicy model
is not a working deletion scheduler. Do not promise that health results,
audit records, sessions, conversations or backups are deleted after a period
unless both the rule and the implementing job are verified.

Emergency-location pruning exists in `emergency-cron.service.ts`; its default
`EMERGENCY_LOCATION_RETENTION_HOURS=72` is a development setting, not a legal
period. It applies to closed responses; an active journey is treated differently.
A reviewed schedule must cover active/closed journeys, courier data and backups.

For each data class, obtain: purpose/basis, owner/operator, retention start,
period, exceptions/holds, deletion or anonymization method, backups, approver and
review date. Do not invent medical-record retention periods in configuration.

## Account closure and requests

`UsersService.deleteOwnAccount` deactivates the account, revokes sessions and
refresh tokens, removes selected optional profile/location fields and turns off
notification/leaderboard settings. It retains identifying and clinical history;
it is not full erasure. There is no general self-service export implementation
established by this inventory. Do not advertise it as present.

A production request process still needs a designated contact, identity checks,
request tracking, permitted access/correction/export, lawful retention exceptions
and a response procedure. Those decisions must match the implementation.

## Consent and access

Consent records bind to exact document version/hash, language and scope, with
withdrawal history. External documents require their content digest. Approval
is an attributed operator action; no legal wording is automatically approved or
seeded. Service-level tests are not evidence that every clinical endpoint and
mobile journey is integrated with the consent gate.

Tenant/role/ownership tests exist, but they do not establish that every access
is audited or that all privileged access has been independently reviewed. MFA,
branch capabilities and institution verification require their own acceptance
evidence before pilot. See the launch status register.

## Logs and incident handling

HTTP logs omit query strings, request/response bodies and headers through an
allowlist. Audit IPs use configured Express proxy trust. Configured SMTP logs
omit recipients and raw vendor error text. Development stream/console transports
may contain credentials in local test output and are unsuitable for a real-data
pilot. Transport/log retention and third-party collection need deployment checks.

Follow `runbooks/incident-response.md`; its cross-border notification timeline
has a specific statutory scope. Do not claim GDPR/HIPAA certification or a
complete immutable access log based on these engineering controls alone.

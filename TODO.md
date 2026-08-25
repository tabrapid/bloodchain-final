# DONOR Platform — Production Readiness TODO

Generated from a full codebase audit against the DONOR product specification
(2026-08-25). This is the **single source of truth** for what's broken,
missing, mocked, disconnected, or unsafe. Work items top-to-bottom within
each tier; check items off (`[x]`) as they land, and add a one-line note
with the commit/PR when closing one.

Legend: 🔴 P0 blocker · 🟠 P1 major gap · 🟡 P2 correctness/safety · 🔵 P3 hygiene

---

## 🔴 P0 — Platform-breaking blockers

These make the product unusable or unsafe for real users. Fix first, in order.

- [x] **P0-1. Registration → login deadlock (nobody can sign up).** — Fixed: added
  `EmailService` (nodemailer, SMTP-configurable, dev-mode log fallback),
  `POST/GET /auth/verify-email` + `POST /auth/resend-verification`, wired
  `register()` to send a verification email (deep link + browser link),
  auto-login on successful verification. Mobile: added `check-email.tsx`
  (post-register) and `verify-email.tsx` (deep-link handler) screens, and a
  "Resend verification email" link on the login error state.
  `auth.service.ts` creates every new user as `PENDING_VERIFICATION` /
  `emailVerified:false`, but `login()` refuses to authenticate anyone in
  that state, and **no email-verification endpoint exists anywhere** in the
  API (`EmailVerificationToken` model is defined in Prisma but never
  referenced by any service). Only manually-seeded accounts can ever log
  in. This blocks literally every other flow (emergency eligibility also
  depends on `emailVerified`).
  - Build `POST /auth/verify-email` (+ resend) using the existing
    `EmailVerificationToken` model, wire an email-send step into
    `register()`, add a mobile verify-email screen.
  - Files: `apps/api/src/modules/auth/auth.service.ts:53-176`,
    `apps/api/prisma/schema.prisma:584`.

- [x] **P0-2. Donor mobile "Donate" tab is a hardcoded placeholder shell.** — Fixed:
  `donate.tsx` now shows real donation stats/next-eligible-date, a working
  "Book now" action, a donation-history card linking to `/donations`, and a
  working "Respond to SOS" card linking to `/sos` — all backed by existing
  hooks/screens, no new backend needed.
  - File: `apps/mobile/app/(app)/donate.tsx`.

- [x] **P0-3. No reachable entry point to book an appointment.** — Fixed: Donate
  tab's "Book now" goes straight to org selection with `type=BLOOD_DONATION`
  preset; Calendar tab got a `+` header button to `/(booking)` (full type
  picker); Laboratory tab's booking card (see P0-4) covers blood tests.
  Confirmed the generic `(booking)/` flow and `laboratory` module's own
  booking endpoint both write to the same `Appointment` table (just
  filtered by `appointmentType`), so no new backend/booking-flow duplication
  was needed — this really was a pure navigation gap.
  - Files: `apps/mobile/app/(app)/donate.tsx`, `apps/mobile/app/(app)/calendar.tsx`.

- [x] **P0-4. Blood-test booking button is dead (no `onPress`).** — Fixed: wrapped
  the card in a `TouchableOpacity` pushing to `/(booking)/organizations`
  with `type=BLOOD_TEST` preset (reuses the existing, backend-correct
  booking flow — see P0-3 note); also wired the upcoming-appointment list
  items to the existing appointment detail screen.
  - File: `apps/mobile/app/(app)/laboratory/index.tsx:113-143`.

- [x] **P0-5. Push notifications are entirely fake, end-to-end.** — Fixed, both ends:
  - Backend: added `expo-server-sdk` + `PushProviderService` (real Expo push
    API calls, chunked, `EXPO_ACCESS_TOKEN`-aware), rewired
    `NotificationDeliveryService.deliver()` to send for real, filter/mark
    invalid tokens (`Expo.isExpoPushToken`, `DeviceNotRegistered` tickets),
    and record per-attempt ticket IDs — instead of just logging and
    self-reporting `DELIVERED`. Added class-validator to the push-device
    DTOs. Covered by `push-provider.service.spec.ts` and
    `notification-delivery.service.spec.ts` (10 + 5 tests; this module had
    zero coverage before).
  - Mobile: added `expo-notifications`, a `registerForPushNotificationsAsync()`
    helper (permission request → Expo token → `registerPushDevice`, never
    throws — degrades gracefully with no EAS project configured) and a
    `usePushNotifications()` hook wired into the root layout that registers
    on auth and navigates via a notification's `deepLink` on tap, including
    cold-start taps.
  - Files: `apps/api/src/modules/notifications/services/{notification-delivery,push-provider}.service.ts`,
    `apps/api/src/modules/notifications/dto/push-device.dto.ts`,
    `apps/mobile/src/notifications/push.ts`,
    `apps/mobile/src/hooks/usePushNotifications.ts`, `apps/mobile/app/_layout.tsx`.
  - Note: this repo has no EAS project configured (no `projectId` in
    `app.json`), so `getExpoPushTokenAsync()` will fail gracefully (logged,
    not fatal) until a real EAS project is linked — that's an account/infra
    step outside what code can fix.
  - Add `expo-server-sdk` (or FCM/APNs), implement real send, request
    permissions + register token on app start / login.

- [x] **P0-6. Courier system has a complete backend and zero UI.** — Fixed:
  built a full courier workspace inside the mobile app, `(courier)/`, gated
  by role. `active.tsx` — accept/decline an assignment, walk pickup → in
  transit → arrived, live location tracking during transit (same
  `expo-location watchPositionAsync` pattern as `sos.tsx`), report-a-problem
  (fail shipment). `history.tsx` — past deliveries + stats. `profile.tsx` —
  edit name/phone (added the missing `PATCH /courier/profile` client call),
  toggle AVAILABLE/OFFLINE, logout. Post-login/verify routing is now
  role-aware (`getPostAuthRoute`): a COURIER-role account lands in
  `(courier)/active` instead of the donor home. Also fixed a real bug found
  along the way: `AppButton` forced all children into one `AppText`, which
  silently drops any icon passed alongside text (RN `Text` can't host a
  `View`/SVG) — affected the pre-existing `sos.tsx` too, now fixed for both.
  Deleted an orphaned dead placeholder screen (`(auth)/verification.tsx`,
  superseded by the real P0-1 verification flow).
  - **Not done, and intentionally out of scope here**: there is still no
    way to *create* a `Courier` record (or any staff account) outside the
    seed script — that's the same gap tracked under P1-12/P1-13 (no org
    signup, no roles/permissions management), not a courier-specific issue,
    and shouldn't be solved twice.
  - Files: `apps/mobile/app/(courier)/*`, `apps/mobile/src/api/courier.ts`,
    `apps/mobile/src/utils/postAuthRoute.ts`,
    `apps/mobile/src/components/AppButton.tsx`,
    `apps/mobile/app/(auth)/{login,verify-email}.tsx`.

- [x] **P0-7. Hospital ↔ Blood Center blood-request workflow has no UI on either side.** — Fixed:
  hospital-web gets `/requests` (list + status), `/requests/new` (multi-line
  blood-type/component/units form), and `/requests/[id]` (detail + linked
  shipment). blood-center-web gets `/requests` (incoming, filterable) and
  `/requests/[id]` with a review modal (per-item units-approved, Approve or
  Reject), "Mark Ready for Pickup", and "Create Shipment" (hands off into
  the already-working assign-courier flow on the shipment detail page).
  Also fixed a real backend bug found while wiring Reject: approving a
  request with 0 units on every line left it labeled `APPROVED` (the
  `totalApproved > 0` guard was missing), which would have made "Reject"
  lie about what happened — it now correctly resolves to `REJECTED`.
  - Files: `apps/hospital-web/app/requests/**`, `apps/hospital-web/lib/shipments.ts`,
    `apps/blood-center-web/app/requests/**`, `apps/blood-center-web/lib/shipments.ts`,
    `apps/api/src/modules/shipments/shipments.service.ts` (approveRequest status fix).

- [x] **P0-8. Donor location broadcast to other donors, not just the hospital.** — Fixed:
  split the single shared room into `emergency:{id}:hospital` (staff +
  SUPER_ADMIN, receives every donor's location and status) and a private
  `emergency:{id}:donor:{donorId}` per responding donor (receives only
  their own status changes, never location or other donors' data).
  `emitDonorLocationUpdate` now targets the hospital room exclusively;
  `emitResponseStatusChanged` targets the hospital room plus the affected
  donor's own room. Covered by `emergency.gateway.spec.ts`.
  - File: `apps/api/src/gateways/emergency.gateway.ts`.

- [x] **P0-9. Shipment WebSocket `location_update` accepts unvalidated coordinates.** — Fixed:
  `LocationService` was missing `@Injectable()` (silently broken for DI —
  a latent bug beyond just "unused"), added it and injected the service
  into both `ShipmentGateway.handleLocationUpdate` and
  `ShipmentsService.updateLocation` (REST), replacing the two divergent
  half-implementations with one shared validator covering bounds,
  impossible-jump, stale/future-timestamp, and shipment-trackable-state
  checks. Covered by `location.service.spec.ts`.
  - Files: `apps/api/src/gateways/shipment.gateway.ts`,
    `apps/api/src/modules/shipments/services/location.service.ts`,
    `apps/api/src/modules/shipments/shipments.service.ts`.

---

## 🟠 P1 — Major gaps (feature exists but disconnected, or missing entirely)

- [x] **P1-1. Booking race conditions (double-booking) in appointments and lab slots.** — Fixed:
  both `bookAppointment` and `bookLaboratoryAppointment` now claim the slot
  via an atomic conditional `updateMany` (`WHERE status=AVAILABLE AND
  bookedCount < capacity`) *inside* the transaction, throwing a clean
  Conflict/BadRequest if a concurrent request already won the race — same
  pattern as `inventory.service.reserveUnit`. Also fixed the identical bug
  in `rescheduleAppointment`'s new-slot claim (same file, same bug class,
  wasn't called out separately but was just as broken), and reordered it to
  claim first so a lost race touches nothing else. Both booking paths now
  also correctly flip the slot to `FULL` once the claiming update fills the
  last seat (laboratory bookings never did this before at all). Covered by
  new `appointments.service.spec.ts` (7 tests) and `laboratory.service.spec.ts`
  (5 tests) — both files had zero coverage before.
  - Files: `apps/api/src/modules/appointments/appointments.service.ts`,
    `apps/api/src/modules/laboratory/laboratory.service.ts`.

- [ ] **P1-2. Inventory unit-status TOCTOU races (release/quarantine/discard/move).**
  Every inventory status-changing operation except `reserveUnit`/
  `releaseReservation` checks status outside the transaction then does a
  plain (non-conditional) update inside it — same race class as P1-1,
  risking double-processing of a blood unit under concurrent calls.
  - File: `apps/api/src/modules/inventory/inventory.service.ts:205-393`.

- [ ] **P1-3. Shipment status transitions have the same TOCTOU pattern, everywhere.**
  `confirmPickup`, `startDelivery`, `arriveAtHospital`, `confirmDeliveryFull`,
  `failShipment`, `cancelShipment` all fetch-then-check-then-update without
  a conditional guard — concurrent duplicate requests (e.g. a retried
  "confirm delivery" from a flaky connection) can double-credit inventory.
  - File: `apps/api/src/modules/shipments/shipments.service.ts` (multiple methods, 947-2087).

- [ ] **P1-4. A real `ShipmentStateMachine` exists but the service never uses it.**
  `shipment-state.service.ts` has a proper transition table; `shipments.service.ts`
  hand-rolls its own inline status checks instead, and they've already
  drifted (`ARRIVED_AT_HOSPITAL → FAILED` is allowed in the table but
  blocked in the actual `failShipment` code).
  - Files: `apps/api/src/modules/shipments/services/shipment-state.service.ts`,
    `apps/api/src/modules/shipments/shipments.service.ts:1422-1427`.
  - Fix: make every transition go through `ShipmentStateMachine.assertTransition`.

- [ ] **P1-5. Idempotency module fully built, wired into nothing that matters.**
  `IdempotencyService` (dedup keys, cleanup) is complete but only consumed
  inside the notifications module. Donation completion, appointment
  booking, shipment creation/delivery-confirmation, and inventory
  operations — the endpoints most exposed to client-retry duplication —
  have no idempotency-key handling at all.
  - File: `apps/api/src/modules/idempotency/idempotency.service.ts`.
  - Add an `IdempotencyKey` header + interceptor on the mutating endpoints above.

- [ ] **P1-6. Gamification XP triggers for appointments & emergency-response are dead code.**
  Handlers for `APPOINTMENT_COMPLETED_EVENT` and
  `EMERGENCY_RESPONSE_COMPLETED_EVENT` exist and are wired to award XP, but
  **nothing ever emits either event** — donation-completed and
  blood-test-completed do work (they use a different, real event), but a
  donor gets no XP for completing an appointment as such, or for an
  emergency response completion path that isn't also a donation.
  - File: `apps/api/src/modules/gamification/events/gamification-event.handler.ts:89-134`.

- [ ] **P1-7. Emergency donor eligibility never checks the donation cooldown.**
  `checkDonorEligibility` verifies active status + verified blood type +
  email verified, but never checks `nextDonationDate` / the 56-day
  recovery window — a donor who donated yesterday can still be matched to
  and accept a new SOS. (Also currently unreachable in practice because of
  P0-1, but must be fixed as part of that fix.)
  - File: `apps/api/src/modules/emergency/emergency.service.ts:147-167`.

- [ ] **P1-8. Next-eligible-donation-date has two disconnected sources of truth.**
  `Donation.nextDonationDate` is free-text staff input with no server-side
  derivation from a real eligibility rule; separately,
  `ai-context-builder-enhanced.service.ts` hardcodes its own "56 days"
  calculation. Centralize this into one configurable eligibility service
  both paths call.
  - Files: `apps/api/src/modules/donations/donations.service.ts:402`,
    `apps/api/src/modules/ai-health/ai-context-builder-enhanced.service.ts:94-100`.

- [ ] **P1-9. Blood Center dashboard is missing core pages.**
  No page to: review/approve incoming blood requests (see P0-7), create a
  shipment from an approved request, configure appointment slots
  (services/dates/times/capacity/holidays — full backend exists,
  `apps/api/src/modules/appointment-slots`), or manage couriers.
  - Dir: `apps/blood-center-web/app/`.

- [ ] **P1-10. No map UI anywhere despite location tracking being core.**
  Neither hospital-web nor blood-center-web nor mobile renders an actual
  map (no leaflet/mapbox/google-maps dependency anywhere) — shipment/SOS
  "tracking" is raw coordinates/timeline text only.
  - Add a map library and real map views to shipment tracking and SOS
    donor-location screens.

- [ ] **P1-11. Neither web dashboard opens a live WebSocket for shipment tracking.**
  The `/shipments` gateway is real and working, but hospital-web/
  blood-center-web never connect to it — "realtime" tracking is a one-shot
  REST fetch with a manual refresh button. (Emergency tracking *does* use
  the socket correctly, in `useEmergencyTracking.ts` — copy that pattern.)
  - File to model after: `apps/hospital-web/lib/useEmergencyTracking.ts`.

- [ ] **P1-12. Admin: no organization signup flow feeds the approval workflow.**
  Admin's verify/reject/suspend/restore organization endpoints are real,
  but nothing ever creates a `PENDING_APPROVAL` organization — the only
  `organization.create` call in the whole backend is auth's internal fake
  donor-org workaround (see P2-9), which is `ACTIVE` on creation. There is
  no hospital/blood-center self-registration endpoint at all.
  - File: `apps/api/src/modules/admin/admin.service.ts:423-514`.

- [ ] **P1-13. Admin: roles/permissions management doesn't exist.**
  No controller exposes CRUD for roles/permissions, and admin-web has no
  route for it — admin can suspend/restore users but can't change a
  user's role or manage the permission matrix.

- [ ] **P1-14. Admin: platform "Settings" page is 100% fake.**
  Entirely static JSX with hardcoded badges ("Session Timeout: 24 hours",
  etc.) — no state, no fetch, no mutation, no backing model on the server.
  - File: `apps/admin-web/app/settings/page.tsx`.

- [ ] **P1-15. Admin: content moderation is a write-only sink.**
  Users can report community content (`ContentReport` rows get created),
  but no admin endpoint or UI ever lists/reviews/resolves a report.
  - File: `apps/api/src/modules/community/community.service.ts:127-165`.

- [ ] **P1-16. Inventory is missing issue/expire/adjust operations entirely.**
  No code path ever transitions a unit to `USED` (dispense), no cron ever
  marks units `EXPIRED` past `expiresAt`, and there's no manual
  adjustment/correction endpoint. Inventory alerts are also never
  generated (the read/acknowledge endpoints exist over a permanently-empty
  table), and expired reservations are never auto-released.
  - File: `apps/api/src/modules/inventory/inventory.service.ts`.

- [ ] **P1-17. Challenge progress is donor self-reported — instantly exploitable.**
  `PUT /challenges/:id/progress` takes a raw number from the requesting
  donor and writes it directly, auto-completing the challenge (and its XP
  reward) once it crosses the goal — with zero server-side derivation from
  real activity. Any donor can max any challenge instantly.
  - File: `apps/api/src/modules/challenges/challenges.service.ts:233-271`.

- [ ] **P1-18. No SOS / emergency-match expiration job.**
  `EXPIRED` statuses and a full notification handler exist, but nothing
  (no cron) ever actually transitions a stale `EmergencyRequest`/
  `EmergencyMatch` past its `requiredBefore` — it just sits active forever.
  - File: `apps/api/src/modules/emergency/emergency.service.ts`.

---

## 🟡 P2 — Correctness, safety, and RBAC gaps

- [ ] **P2-1. `OrganizationGuard` is written but never applied anywhere** —
  org-scoped access control is entirely ad-hoc per-service instead of
  centrally enforced. `apps/api/src/common/guards/organization.guard.ts`.

- [ ] **P2-2. `LAB_TECHNICIAN`/`LAB_REVIEWER`/`LAB_ADMIN` roles have zero
  seeded permissions** and are excluded from the actual lab-workflow
  routes (confirm/start/complete/create-result) — only from the read-only
  list endpoint. `apps/api/prisma/seed.ts:64-152`,
  `apps/api/src/modules/laboratory/laboratory.controller.ts:157-273`.

- [ ] **P2-3. Appointment booking has no `@Roles(DONOR)` guard** — any
  authenticated staff/courier/admin account can book a donation
  appointment for themselves. `apps/api/src/modules/appointments/appointments.controller.ts:23-33`.

- [ ] **P2-4. Emergency module DTOs are plain interfaces with zero
  class-validator decorators**, so Nest's global `ValidationPipe` silently
  skips validation on create/cancel/complete/location-update bodies — bad
  input reaches Prisma and surfaces as an ugly 500 instead of a 400.
  Same gap in notification/push-device DTOs.
  `apps/api/src/modules/emergency/emergency.controller.ts`,
  `apps/api/src/modules/notifications/dto/*`.

- [ ] **P2-5. `EmergencyRequest` has no blood-component field** — only
  blood type, unlike the parallel `BloodRequestItem` model — so an
  emergency can't specify whole blood vs. plasma vs. platelets. Completion
  also hardcodes `donationType: 'WHOLE_BLOOD'` regardless of what was
  requested. `apps/api/prisma/schema.prisma:1111-1146`,
  `apps/api/src/modules/emergency/emergency.service.ts:871`.

- [ ] **P2-6. Emergency matching ignores real geo distance** —
  `distanceKm`/`matchScore` fields exist on `EmergencyMatch` but are never
  populated; matching just takes the first 50 compatible donors in query
  order. `DonorProfile` also has no lat/lng field, so proximity matching
  is architecturally impossible without a schema change.
  `apps/api/src/modules/emergency/emergency.service.ts:263-333`.

- [ ] **P2-7. Courier-assigned/accepted notifications show the wrong text**
  (silently fall back to the "shipment created" template because those two
  event keys aren't in the template map), and **courier decline never
  notifies the blood center at all** (no event emitted, unlike every other
  transition). `apps/api/src/modules/shipments/shipments.service.ts:757-891`.

- [ ] **P2-8. ETA is a hardcoded-speed straight-line estimate** (40km/h
  constant, no routing/traffic) and `getShipmentTracking` returns a
  **literal hardcoded string** `'Available after delivery confirmation'`
  as the blood group regardless of actual contents.
  `apps/api/src/modules/shipments/shipments.service.ts:1670-1692`.

- [ ] **P2-9. Donor registration fabricates a fake HOSPITAL-type org**
  ("DONOR Donors") purely to satisfy a required FK — a data-model smell
  that can confuse any org-scoped analytics/listing logic.
  `apps/api/src/modules/auth/auth.service.ts:69-92`. (Proper fix: make
  donor `OrganizationMembership` optional, or model donors without an org.)

- [ ] **P2-10. AI safety filtering is naive hardcoded regex** — trivially
  bypassed by rephrasing; the "no fabricated diagnosis" guarantee rests
  almost entirely on prompt engineering.
  `apps/api/src/modules/ai-health/ai-safety.service.ts:12-151`.

- [ ] **P2-11. Donation & lab reference numbers use unguarded `Math.random()`**
  with no uniqueness retry loop — low-probability but real collision →
  raw DB constraint 500 instead of a clean retry.
  `apps/api/src/modules/donations/donations.service.ts:44,50`,
  `apps/api/src/modules/laboratory/laboratory.service.ts:243`.

- [ ] **P2-12. Cancelled/no-show lab appointments never reset slot status**
  back to `AVAILABLE` (only `bookedCount` is decremented) — unlike the
  donation-appointment flow, which does this correctly. A `FULL` lab slot
  stays permanently unbookable after a cancellation.
  `apps/api/src/modules/laboratory/laboratory.service.ts:1037-1116`.

- [ ] **P2-13. Notification "archive" is unreachable** — the
  `NotificationStatus.ARCHIVED` enum value exists but no service method or
  endpoint ever sets it; only hard delete exists.

- [ ] **P2-14. Duplicate, unreachable `confirmDelivery` method** sitting
  alongside the real `confirmDeliveryFull` — dead code with an unchecked
  `verificationCode` parameter that looks like a half-finished feature.
  `apps/api/src/modules/shipments/shipments.service.ts:1244-1393`.

---

## 🔵 P3 — Hygiene, tests, docs, infra

- [ ] **P3-1. 26 of 30 backend modules have zero automated tests**,
  including the core money/medical/safety paths: donations, inventory,
  shipments, emergency, laboratory, admin. Only auth, health,
  health-trends, and part of ai-health have specs. Prioritize tests for
  the P0/P1 areas above as you fix them (write the regression test with
  the fix, not after).

- [ ] **P3-2. No frontend tests at all** (Next.js apps or mobile) — no
  Jest/RTL/Playwright/Detox setup found.

- [ ] **P3-3. No Docker / docker-compose, no CI pipeline**
  (`.github/workflows`), despite `IMPLEMENTATION_SUMMARY.md` and
  `docs/roadmap.md` describing the platform as "production-ready."

- [ ] **P3-4. `.env.example` gaps**: `AI_BASE_URL`/`AI_ENABLED`/
  `AI_MAX_TOKENS`/`AI_MODEL`/`AI_TIMEOUT_MS` are read by code but
  undocumented; conversely `FCM_SERVER_KEY`/`APNS_KEY_ID`/`MAP_API_KEY`/
  `EXPO_ACCESS_TOKEN` are documented but never read anywhere server-side
  (confirms P0-5/P1-10 are unfinished integrations, not just UI gaps).

- [ ] **P3-5. Stale/inconsistent docs.** `docs/architecture.md` says
  WebSocket is "prepared but not implemented" even though the gateways are
  real and working; `IMPLEMENTATION_SUMMARY.md` claims "45+ passing
  tests" vs. 8 actual spec files. Reconcile docs with reality once the
  P0/P1 items land, not before (docs will keep drifting otherwise).

- [ ] **P3-6. Repo/product name mismatch** — directory/remote is named
  "bloodchain-final" but the product is "DONOR" with zero blockchain code
  anywhere. Purely cosmetic; flag to the user, no code action needed
  unless they want a rename.

---

## Suggested execution order

1. ~~**P0-1** (registration/login) unblocks real users entirely — do this first.~~ ✅
2. ~~**P0-2 → P0-4** (mobile navigation dead ends) — cheap, high-impact UI wiring, no new backend needed.~~ ✅
3. ~~**P0-8, P0-9** (security) — before any load/beta testing touches real location data.~~ ✅
4. ~~**P0-5** (push) and **P0-6/P0-7** (courier + hospital↔blood-center UI) — these three close the loop on the emergency and supply-chain flows end-to-end.~~ ✅

**All P0 items are done.** Next up, P1 in listed order — start with **P1-1/P1-2/P1-3**
(the booking/inventory/shipment TOCTOU races, all the same fix pattern
already used for P0-9) and **P1-4** (route shipments through the real
`ShipmentStateMachine`), then the rest of P1, then P2, folding in P3-1
tests as each area is touched.

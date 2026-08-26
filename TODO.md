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

- [x] **P1-2. Inventory unit-status TOCTOU races (release/quarantine/discard/move).** — Fixed:
  `releaseUnit`, `quarantineUnit`, `discardUnit`, and `moveUnit` all now claim
  the status change via an atomic conditional `updateMany` (guarded on the
  set of allowed "from" statuses, e.g. `{in: [COLLECTED, QUARANTINED]}` for
  release) *inside* the transaction, throwing `ConflictException` when
  `claim.count === 0` — same pattern as `reserveUnit`, which was already
  correct. On a lost claim, the error re-fetches the unit's current status so
  the message stays accurate instead of repeating the stale pre-check text.
  Covered by new `inventory.service.spec.ts` (8 tests, zero coverage before).
  - File: `apps/api/src/modules/inventory/inventory.service.ts`.

- [x] **P1-3. Shipment status transitions have the same TOCTOU pattern, everywhere.** — Fixed:
  all 9 status-transition methods (`acceptShipment`, `declineShipment`,
  `startPickup`, `confirmPickup`, `startDelivery`, `arriveAtHospital`,
  `confirmDelivery`, `confirmDeliveryFull`, `cancelShipment` — `failShipment`
  too, covering all methods sharing this bug, not just the 6 named above)
  now claim their transition via an atomic conditional `updateMany` guarded
  on the correct "from" status (or status set, e.g. `failShipment`'s
  `{in: [COURIER_ACCEPTED, PICKUP_STARTED, PICKED_UP, IN_TRANSIT]}`, or
  `cancelShipment`'s `{notIn: [DELIVERED, CANCELLED]}`) *before* any
  side-effecting work (unit loops, inventory movements, courier/blood-request
  updates), throwing `ConflictException` on `claim.count === 0` so a lost
  race touches nothing else. `updateLocation` was already fixed under P0-9
  and needed no change. Covered by new `shipments.service.spec.ts`
  (20 tests, zero coverage before) — one happy-path + one race-lost case per
  method. `ShipmentStateMachine` still isn't wired in (that's P1-4).
  - File: `apps/api/src/modules/shipments/shipments.service.ts`.

- [x] **P1-4. A real `ShipmentStateMachine` exists but the service never uses it.** — Fixed:
  every shipment status transition (`assignCourier`, `acceptShipment`,
  `declineShipment`, `startPickup`, `confirmPickup`, `startDelivery`,
  `arriveAtHospital`, `confirmDelivery`, `confirmDeliveryFull`, `failShipment`,
  `cancelShipment`, `reassignCourier`) now calls
  `ShipmentStateMachine.assertTransition` for its fast pre-check, and derives
  the P1-3 atomic claim's "from status" guard from a new
  `ShipmentStateMachine.getSourceStatuses(target)` helper (reverse-looks-up the
  same transition table `assertTransition` uses) instead of a hand-maintained
  array — so the allowed "from" set for a transition can no longer drift from
  what the state machine actually permits. Fixed the drift the TODO called
  out (`ARRIVED_AT_HOSPITAL → FAILED` was allowed in the table but blocked in
  `failShipment`) by adding it to `failShipment`'s reachable set; also added
  `COURIER_ACCEPTED → FAILED` to the transition table itself (a courier who's
  accepted but hasn't started pickup could already report a failure in the
  old hand-rolled code, so the table was extended to match rather than that
  capability being silently removed).
  While wiring this in, found and fixed two more instances of the exact same
  pre-P1-3 TOCTOU bug in methods that mutate shipment status but weren't
  covered by P1-3: `assignCourier` and `reassignCourier` both checked status
  outside the transaction then updated unconditionally inside it, *and* both
  had a second, independent race on the courier's own `AVAILABLE` status
  (two concurrent assignments could both "win" the same courier). Both are
  now atomic two-part claims inside the transaction (shipment status, then
  courier status), each throwing `ConflictException` on a lost race.
  Covered by a new `shipment-state.service.spec.ts` (9 tests, including a
  property test asserting `getSourceStatuses` and `assertTransition` can
  never disagree) and 5 new tests in `shipments.service.spec.ts` for
  `assignCourier`/`reassignCourier` (25 tests total in that file now).
  - Files: `apps/api/src/modules/shipments/services/shipment-state.service.ts`,
    `apps/api/src/modules/shipments/shipments.service.ts`.

- [x] **P1-5. Idempotency module fully built, wired into nothing that matters.** — Fixed:
  on re-auditing, `IdempotencyService` (the `IdempotencyRecord`-table based
  one) turned out to be consumed *nowhere at all*, not even notifications —
  that module has its own separate, already-working dedup mechanism (a DB
  unique constraint on `Notification.recipientId_idempotencyKey`), unrelated
  to this service. Added a generic `@Idempotent(operation)` decorator +
  `IdempotencyInterceptor` (`apps/api/src/modules/idempotency/`): a caller
  that sends an `Idempotency-Key` header on a decorated endpoint gets the
  stored result of an earlier identical (user, operation, key) request
  replayed instead of the handler re-running; no header means the endpoint
  behaves exactly as before; a same-key-different-outcome pair (user or
  operation) can never collide, since the internal hash is scoped to both.
  Purely additive and opt-in — no existing client sends this header yet, so
  nothing changes until a client opts in.
  Wired onto the 5 endpoints named above: `donations.completeDonation`,
  `appointments.bookAppointment`, `shipments.createShipment`,
  `shipments.confirmDeliveryFull` (routed from the `confirm-delivery` route),
  and `inventory.reserveUnit`.
  While implementing this, found and fixed a real, pre-existing bug in
  `IdempotencyService.storeResult`: the TTL was interpolated *inside* a
  quoted SQL literal (`` INTERVAL '${ttl} milliseconds' ``) — Postgres only
  substitutes bind parameters in expression position, never inside a string
  literal, so every call would have sent the literal text `"$3 milliseconds"`
  and failed. Fixed by multiplying a 1ms interval instead
  (`(${ttl} * INTERVAL '1 millisecond')`), keeping `ttl` in expression
  position. This bug had never been caught because the service was never
  actually called before now.
  Covered by `idempotency.service.spec.ts` (7 tests, including one that
  asserts the TTL fix), `idempotency.interceptor.spec.ts` (5 tests), and
  `idempotency-wiring.spec.ts` (1 DI-graph smoke test — boots the module for
  real via Nest's testing harness instead of only mocking classes, which is
  the only thing that would have caught a missing module import).
  - Files: `apps/api/src/modules/idempotency/*`,
    `apps/api/src/modules/{donations,appointments,shipments,inventory}/*.module.ts`,
    `apps/api/src/modules/{donations,appointments,shipments,inventory}/*.controller.ts`.

- [x] **P1-6. Gamification XP triggers for appointments & emergency-response are dead code.** — Fixed:
  both events are now emitted at their one real source of truth each.
  `AppointmentsService.completeAppointment` (`apps/api/src/modules/appointments/appointments.service.ts`)
  now injects `EventEmitter2` and emits `APPOINTMENT_COMPLETED_EVENT` with
  `{appointmentId, donorId: appointment.donorId}` right after the status
  transition. `EmergencyService.completeEmergency` (`apps/api/src/modules/emergency/emergency.service.ts`)
  now emits `EMERGENCY_RESPONSE_COMPLETED_EVENT` with `{responseId, donorId}`
  alongside its existing `DONATION_COMPLETED_EVENT` emit — the two events
  award genuinely different rewards (regular donation XP vs. the
  emergency-specific `EMERGENCY_RESPONSE_COUNT` achievement + emergency
  reputation bonus in `processEmergencyResponseCompleted`), so both need to
  fire on the one path that completes an emergency response, not just one.
  `completeEmergency` was confirmed as the *only* place an `EmergencyResponse`
  ever reaches `COMPLETED` status, so no other call site needed the emit.
  Covered by 2 new tests in `appointments.service.spec.ts` (now 9 total) and
  a new `emergency.service.spec.ts` (3 tests — the emergency module had zero
  coverage before, so this is scoped to `completeEmergency` specifically,
  not a full-service audit).
  - Files: `apps/api/src/modules/appointments/appointments.service.ts`,
    `apps/api/src/modules/emergency/emergency.service.ts`.

- [x] **P1-7. Emergency donor eligibility never checks the donation cooldown.** — Fixed:
  `checkDonorEligibility` (called from `acceptEmergency`, the only place a
  donor accepts an SOS match) now looks up the donor's most recent
  `COMPLETED` donation and rejects with `ForbiddenException` if it's still
  inside the recovery window. Prefers the staff-entered `Donation.nextDonationDate`
  when set (e.g. extended for a health reason), otherwise falls back to the
  same 56-day-after-`completedAt` rule already used in
  `ai-context-builder-enhanced.service.ts`, kept as a small private helper
  (`getNextEligibleDonationDate`) rather than building the full shared
  eligibility service — that consolidation is P1-8's separate, still-open
  scope, so this stays a duplicate of the existing rule rather than a new
  third source of truth.
  Covered by 4 new tests in `emergency.service.spec.ts` (now 7 total):
  never-donated passes, cooldown-elapsed passes, still-in-cooldown rejects,
  and staff-extended `nextDonationDate` rejects even past the default window.
  - File: `apps/api/src/modules/emergency/emergency.service.ts`.

- [x] **P1-8. Next-eligible-donation-date now has three disconnected sources of truth.** — Fixed:
  added `DonationEligibilityService` (`apps/api/src/modules/donation-eligibility/`),
  the single source of truth all three now call. It looks up the donor's
  most recent `COMPLETED` donation and prefers the staff-entered
  `Donation.nextDonationDate` when set, otherwise computes it from a
  configurable cooldown (`DONATION_COOLDOWN_DAYS` env var, default 56,
  validated in `env.validation.ts` — genuinely configurable now, not just a
  moved constant).
  - `emergency.service.ts`'s P1-7 private helper (`getNextEligibleDonationDate`
    + its hardcoded `DONATION_COOLDOWN_DAYS` constant) is deleted; `checkDonorEligibility`
    now calls the shared service directly.
  - `ai-context-builder-enhanced.service.ts`'s hardcoded 56-day inline calc
    is replaced with a call to the shared service.
  - `donations.service.ts#completeDonation` no longer silently leaves
    `nextDonationDate` null when staff omits it — it now computes a real
    default via `computeDefaultNextEligibleDate`, closing the "free-text
    input with no server-side derivation" half of the original gap. Staff's
    explicit value still wins when provided.
  New `DonationEligibilityModule` is imported by `EmergencyModule`,
  `AIHealthModule`, and `DonationsModule` (no circular dependency — none of
  the three previously imported each other).
  Covered by a new `donation-eligibility.service.spec.ts` (9 tests, the
  core logic), plus updates/additions across the three call sites: rewrote
  `emergency.service.spec.ts`'s eligibility tests to mock the shared service
  instead of `db.donation` directly (6 tests), added `donations.service.spec.ts`
  (2 tests, zero prior coverage) and `ai-context-builder-enhanced.service.spec.ts`
  (2 tests, zero prior coverage) scoped to the touched behavior.
  - Files: `apps/api/src/modules/donation-eligibility/*` (new),
    `apps/api/src/config/env.validation.ts`, `.env.example`,
    `apps/api/src/modules/donations/donations.service.ts`,
    `apps/api/src/modules/ai-health/ai-context-builder-enhanced.service.ts`,
    `apps/api/src/modules/emergency/emergency.service.ts`.

- [x] **P1-9. Blood Center dashboard is missing core pages.** — Fixed:
  review/approve-request and create-shipment were already built under
  P0-7 (`/requests`, `/requests/[id]`) before this item was reached, so
  this pass covered the two still-missing pages:
  - **`/appointments`** (new) — full slot configuration UI against the
    already-complete `appointment-slots` backend: create a slot (type,
    start/end, capacity), see upcoming slots with booked/capacity and
    status, block a slot. "Holidays" from the original ask is handled via
    blocking the individual slots on that date — there's no separate
    holiday-calendar concept in the backend to build a UI for.
  - **`/couriers`** (new) — courier roster/status view: every courier for
    the org regardless of status (not just AVAILABLE, which is what the
    existing assignment-dropdown endpoint intentionally stays scoped to),
    with contact info and active/completed shipment counts. Required a
    new backend endpoint (`GET organizations/:organizationId/couriers/roster`
    -> `ShipmentsService.getCourierRoster`) since no blood-center-scoped
    "list all couriers" endpoint existed before (only a `SUPER_ADMIN`-only
    admin-panel one). **View-only, not full CRUD** — there is still no
    backend path to create a courier at all (confirmed zero `courier.create`
    calls anywhere in the API; couriers only exist via the seed script),
    which is the same root gap already tracked under P1-12/P1-13 (no org
    signup/roles-management flows). The page says so explicitly rather than
    implying a broken "invite courier" button.
  Enabled both `Appointments` and `Couriers` in the sidebar (previously
  `disabled: true`/missing). Verified with `next build` (both routes
  compile and prerender) and a headless-browser screenshot of each page's
  unauthenticated state (matches the existing `/requests` page's
  auth-gate pattern exactly — no live backend/DB was available in this
  session to screenshot the authenticated list/modal views).
  Added a test for `getCourierRoster` in `shipments.service.spec.ts` (26
  tests in that file now).
  - Files: `apps/api/src/modules/shipments/{shipments.service.ts,shipments.controller.ts}`,
    `apps/blood-center-web/app/{appointments,couriers}/page.tsx` (new),
    `apps/blood-center-web/lib/{appointment-slots.ts,couriers.ts}` (new),
    `apps/blood-center-web/lib/navigation.tsx`.

- [x] **P1-10. No map UI anywhere despite location tracking being core.** — Fixed for web
  (mobile intentionally out of scope, see below). Added `leaflet` +
  `react-leaflet` and a shared `LocationMap` component
  (`packages/ui/src/components/map/LocationMap.tsx`, exported via its own
  `@donor/ui/map` subpath — deliberately *not* re-exported through the main
  `@donor/ui/components` barrel, because that barrel is imported by every
  page including ones with no map, and Leaflet's `window` access at import
  time broke SSR/prerendering for the *entire app* the first time it was
  wired through the shared barrel; every consuming page now also uses
  `next/dynamic(..., {ssr:false})`). Color-coded div-icon markers (origin/
  destination/courier/donor/hospital), auto-fit-to-bounds, optional dashed
  route line between markers, dark CARTO basemap tiles (free, no API key —
  fine for development traffic; a production deployment should move to a
  dedicated tile provider or self-hosted tiles before scaling up request
  volume, per OSM/CARTO's tile usage policies).
  Wired into the exact two raw-coordinate screens that prompted this item:
  - `hospital-web/app/shipments/[id]/page.tsx` — replaced the raw
    lat/lng text with a map showing pickup, live courier position, and
    destination, connected by a route line.
  - `hospital-web/app/emergency/page.tsx` (SOS donor-location) — replaced
    `Live: {lat}, {lng}` text with a map showing the responding donor's
    live position and the hospital's donation location.
  Also added the same treatment to `blood-center-web/app/shipments/[id]/page.tsx`,
  which — found while working this item — didn't fetch or show shipment
  tracking data *at all* (not even as text), despite `getShipmentTracking`
  already being defined and unused in its `lib/shipments.ts`.
  **Mobile scoped out**: mobile doesn't actually consume/display anyone
  else's location today — `sos.tsx` and `(courier)/active.tsx` only ever
  *send* the device's own position in the background, they don't render a
  map of anything. Adding a native map view there is a different-shaped
  problem (a native map library needs a dev-client/EAS build, not just an
  npm install, and isn't verifiable via a web browser screenshot the way
  this session verified the two changes above) — left as a separate,
  explicitly-named follow-up rather than silently declared "done" here.
  Verified with `next build` on both apps (clean, no prerender errors) and
  a temporary standalone preview page rendered via headless browser,
  confirming the map container, colored markers, and route line all mount
  and position correctly — this sandbox's own network policy blocks the
  external tile CDN (confirmed via the proxy status log, not app-specific),
  so the terrain tile *imagery* itself couldn't be screenshotted, but every
  part of the map's own logic (mounting, bounds-fitting, marker placement)
  was confirmed working. The temporary preview page was removed before
  committing.
  - Files: `packages/ui/src/components/map/LocationMap.tsx` (new),
    `packages/ui/package.json`, `packages/ui/src/components/index.ts`,
    `apps/hospital-web/app/{layout.tsx,shipments/[id]/page.tsx,emergency/page.tsx}`,
    `apps/blood-center-web/app/{layout.tsx,shipments/[id]/page.tsx}`,
    `apps/hospital-web/package.json`, `apps/blood-center-web/package.json`.

- [x] **P1-11. Neither web dashboard opens a live WebSocket for shipment tracking.**
  Fixed on both the backend (which turned out to be only half-wired despite
  looking complete) and the frontend.
  Backend findings, found while wiring this up:
  - `ShipmentGateway` was registered as a bare top-level provider in
    `AppModule` instead of inside `ShipmentsModule`, so it was never
    injectable into `ShipmentsService` — moved it into
    `ShipmentsModule`'s `providers` (mirroring the already-correct
    `EmergencyGateway`/`EmergencyModule` pattern) and removed it from
    `AppModule`.
  - `ShipmentsService` never actually called any gateway emit method from
    any of its 11 real status-transition handlers (`createShipment`,
    `assignCourier`, `acceptShipment`, `declineShipment`, `startPickup`,
    `confirmPickup`, `startDelivery`, `arriveAtHospital`, `failShipment`,
    `cancelShipment`, `reassignCourier`) — the gateway had working emit
    methods with nothing calling them. Added
    `this.shipmentGateway.emitShipmentStatusChanged(...)` at each.
  - The mobile courier app submits location updates over REST
    (`POST .../update-location`), not the gateway's own `location_update`
    socket event — `ShipmentsService.updateLocation` (the REST handler)
    never broadcast the new position anywhere. Added a new
    `ShipmentGateway.emitCourierLocation(...)` method and call it from
    `updateLocation` after the DB write, so REST-submitted courier
    positions now reach web clients watching that shipment's room live.
  - Same "dead sibling method" pattern found repeatedly this session:
    `confirmDelivery` (with a push-notification emit) is dead code —
    `shipments.controller.ts`'s HTTP handler actually calls
    `confirmDeliveryFull`, which had neither the push notification nor a
    gateway emit. Added both to `confirmDeliveryFull` (the reachable
    path); left the unreachable `confirmDelivery` untouched. This means
    real deliveries never sent "delivered" push notifications before this
    fix, in addition to never updating live tracking.
  Frontend: added `useShipmentTracking(shipmentId)` hooks to both
  hospital-web and blood-center-web (`lib/useShipmentTracking.ts` in each,
  copied from the proven `useEmergencyTracking.ts` pattern — JWT-authed
  `/shipments` namespace connection, `join`/`leave` room lifecycle on
  mount/unmount), wired into each app's `shipments/[id]/page.tsx`:
  - The `LocationMap`'s courier marker now prefers the live
    `courier_location` socket payload over the stale REST snapshot,
    falling back to the REST value only when no socket update has arrived
    yet.
  - A `shipment_status_changed` event now triggers a full `loadShipment()`
    refetch (status badge, timeline, delivered/arrived timestamps, confirm-
    delivery button visibility all update without a manual refresh).
  - Added a small "Live"/"Offline" connection-status indicator next to the
    Live Map heading on both pages, reusing already-imported icon/color
    tokens.
  - `blood-center-web` didn't have `socket.io-client` installed yet
    (hospital-web already did) — added it.
  Verified: 27/27 tests in `shipments.service.spec.ts` (updated with
  `ShipmentGateway`/`LocationService` mocks and new assertions on every
  happy-path transition + `updateLocation` broadcast test), 4/4 new tests
  in `shipment.gateway.spec.ts` (first-ever coverage for this gateway),
  full backend suite 207/207 passing across 25 suites, 0 new lint errors
  (311 pre-existing warnings unchanged), clean `tsc --noEmit` and `next
  build` on both hospital-web and blood-center-web.
  - Files: `apps/api/src/gateways/shipment.gateway.ts`,
    `apps/api/src/gateways/shipment.gateway.spec.ts` (new),
    `apps/api/src/modules/shipments/shipments.module.ts`,
    `apps/api/src/modules/shipments/shipments.service.ts`,
    `apps/api/src/modules/shipments/shipments.service.spec.ts`,
    `apps/api/src/app.module.ts`,
    `apps/hospital-web/lib/useShipmentTracking.ts` (new),
    `apps/blood-center-web/lib/useShipmentTracking.ts` (new),
    `apps/hospital-web/app/shipments/[id]/page.tsx`,
    `apps/blood-center-web/app/shipments/[id]/page.tsx`,
    `apps/blood-center-web/package.json`.

- [x] **P1-12. Admin: no organization signup flow feeds the approval workflow.** — Fixed:
  added `POST /auth/register-organization` (public, throttled 5/min), the
  first and only code path that creates a real self-service
  `PENDING_APPROVAL` organization. In one transaction it creates the
  `Organization` (type HOSPITAL or BLOOD_CENTER, with its `hospital`/
  `bloodCenter` sub-record, `status: PENDING_APPROVAL`), a new admin
  `User` (`PENDING_VERIFICATION`, mirroring the existing donor `register`
  flow), and an `OrganizationMembership` with the matching admin role
  (`HOSPITAL_ADMIN`/`BLOOD_CENTER_ADMIN`, membership `status: ACTIVE` —
  it's the *organization* that's gated on approval, not the membership,
  same distinction the existing verify/reject endpoints already draw).
  Sends the same verification email as donor registration and audit-logs
  `ORGANIZATION_REGISTERED`. The already-working admin-web
  verify/reject/suspend/restore UI (`app/organizations/page.tsx`) now has
  something real to act on instead of only ever showing orgs seeded by
  hand.
  Also closed the loop on the other end: `/auth/me` didn't expose the
  organization's own approval status at all (only membership status,
  which stays `ACTIVE` regardless of the org's state) — added
  `organizationStatus` to each entry in `me().organizations`. Both
  hospital-web and blood-center-web now check it: if a hospital/blood-
  center admin logs in (which requires email verification, so this can
  only happen after they've verified) before their org is approved, they
  see a "pending approval" screen instead of the full dashboard, rather
  than silently landing on an empty workspace with no indication why.
  Added `/register` pages to both apps (organization details + admin
  account form, fixed to that app's org type) linked from each app's
  login screen ("New hospital? Register your organization").
  **Known scope boundary, not fixed here**: this only gates the initial
  dashboard landing screen — no backend service (shipments, requests,
  appointments, inventory, etc.) actually checks `organization.status`
  before allowing an action, so a determined PENDING_APPROVAL admin who
  discovers a direct API/deep-link route could still act before approval.
  Enforcing that at the API layer touches every org-scoped service, not
  just auth/admin, so it's tracked separately as P1-20 rather than
  expanded into here silently.
  Verified: 2 new tests in `auth.service.spec.ts` (happy path creates a
  PENDING_APPROVAL org + ACTIVE HOSPITAL_ADMIN membership; duplicate
  admin email rejected), full suite 209/209 passing, clean `tsc --noEmit`
  and `next build` on both hospital-web and blood-center-web (new
  `/register` route prerenders on both), 0 new lint errors. Verified the
  login screen's new link and the register form render correctly via a
  headless-browser screenshot (no live DB in this sandbox to exercise the
  full submit → pending-approval → admin-approve loop end-to-end, same
  limitation noted on earlier UI-only verifications this session).
  - Files: `apps/api/src/modules/auth/{auth.service.ts,auth.controller.ts}`,
    `apps/api/src/modules/auth/dto/register-organization.dto.ts` (new),
    `apps/api/src/modules/auth/auth.service.spec.ts`,
    `apps/hospital-web/lib/auth.ts`, `apps/hospital-web/app/page.tsx`,
    `apps/hospital-web/app/register/page.tsx` (new),
    `apps/blood-center-web/lib/auth.ts`, `apps/blood-center-web/app/page.tsx`,
    `apps/blood-center-web/app/register/page.tsx` (new).

- [x] **P1-13. Admin: roles/permissions management doesn't exist.** — Fixed:
  the Role/Permission/RolePermission tables and seed data were already
  complete (`PermissionsService.getUserPermissions` reads them on every
  request) — nothing exposed them for editing. Added four endpoints under
  `AdminController`, all `SUPER_ADMIN` + `admin.manage`-gated like the
  rest of the admin surface:
  - `GET /admin/roles` — every role with its current permission codes.
  - `GET /admin/permissions` — the full permission catalog.
  - `PATCH /admin/roles/:id/permissions` — replace a role's permission
    set (validates every code exists first, rejects unknown codes by
    name, one transaction to swap the `RolePermission` rows). Refuses to
    edit `SUPER_ADMIN`: its access is enforced by role code directly
    (`RolesGuard`/`@Roles(SUPER_ADMIN)`) and `PermissionsService`
    unconditionally grants it `admin.manage` regardless of what's in the
    table, so editing that row would change nothing real while looking
    like it does — same "don't let the UI lie about what it controls"
    principle as P0-7's request-status fix.
  - `PATCH /admin/memberships/:id/role` — move one
    `OrganizationMembership` to a different role (used for "change this
    user's role", not the role catalog itself). No-ops (no DB write, no
    audit log) if the membership is already on the target role. Both
    mutations audit-log (`ROLE_PERMISSIONS_UPDATED`,
    `MEMBERSHIP_ROLE_CHANGED`) alongside the existing
    suspend/restore/verify/reject actions.
  Also added `membershipId` to the `roles[]` entries `listUsers`/`getUser`
  already returned (needed to target a specific membership; wasn't
  exposed before since nothing consumed it).
  admin-web: new `/roles` page (added to the sidebar) listing every role
  with its permissions and an edit modal — a checkbox grid grouped by
  permission prefix (`hospital.*`, `blood_center.*`, etc.), pre-checked
  to the role's current set, Save calls the PATCH and reloads.
  `SUPER_ADMIN`'s row shows "Fixed" instead of an edit link, matching the
  backend's refusal. Users page: each membership badge in the user detail
  modal now has a "change role to..." select + Update button next to it,
  wired to the new membership-role endpoint.
  Verified: 10 new tests in `admin.service.spec.ts` (first tests this
  service has ever had — happy path, unknown-permission-code rejection,
  SUPER_ADMIN-edit rejection, unknown-role/membership 404s, and the
  already-on-target-role no-op, for both new mutations), full backend
  suite 219/219 passing, clean `tsc --noEmit` on the API. admin-web
  needed a `pnpm install` in this session (its `node_modules` had never
  been installed) before it would typecheck at all — after that, clean
  `tsc --noEmit` and `next build` (new `/roles` route prerenders), 0 lint
  errors. Verified the new page and sidebar entry render via a
  headless-browser screenshot (unauthenticated-state only, no live DB in
  this sandbox — same limitation as every other UI-only verification this
  session).
  - Files: `apps/api/src/modules/admin/{admin.service.ts,admin.controller.ts}`,
    `apps/api/src/modules/admin/dto/admin.dto.ts`,
    `apps/api/src/modules/admin/admin.service.spec.ts` (new),
    `apps/admin-web/lib/{api.tsx,navigation.tsx}`,
    `apps/admin-web/app/roles/page.tsx` (new),
    `apps/admin-web/app/users/page.tsx`.

- [x] **P1-14. Admin: platform "Settings" page is 100% fake.** — Fixed: added a
  real backing model and made every setting on the page either genuinely
  admin-editable or removed if it couldn't honestly be either.
  New `PlatformSettings` Prisma model (singleton row, `id: "platform"`,
  lazily created on first read) behind a new `@Global()`
  `PlatformSettingsModule`/`PlatformSettingsService`, with
  `GET`/`PATCH /admin/settings` on `AdminController`. Six real gate points
  now actually read it, replacing what were previously either
  hardcoded-on behaviors or (for two of them) settings that plain didn't
  exist anywhere in the backend:
  - **Session Timeout** — previously a hardcoded "24 hours" label that
    didn't match the actual refresh-token lifetime (`JWT_REFRESH_EXPIRES_IN`,
    default 30d) and wasn't configurable at all. `sessionTimeoutMinutes`
    now *is* the refresh-token lifetime, read by `AuthService.createTokenPair`
    on every login; the now-dead `parseDuration`/env-var path was removed
    rather than left as unreachable code.
  - **AI Health Insights / SOS Emergency / Gamification / Push
    Notifications** feature flags — each now gates its real code path
    (`AIHealthService.checkFeatureEnabled` — the existing `AI_ENABLED` env
    check now additionally requires the DB flag;
    `EmergencyService.createEmergency` throws before checking hospital
    access; all four `GamificationEventHandler` `@OnEvent` handlers
    short-circuit before touching a donor's profile; `NotificationDeliveryService.deliver`
    returns a clean "disabled" result before creating a delivery row).
  - **Maintenance Mode** — new, replaces the old "Courier Tracking"
    toggle (toggling off live courier tracking mid-shipment made no
    sense as a kill-switch and nothing else in the app would have
    respected it). `AuthService.login` now blocks sign-in for everyone
    except `SUPER_ADMIN` while enabled, so an admin can always fix a
    misconfigured platform.
  Two settings were removed rather than kept fake: **Two-Factor
  Authentication** ("Configurable") — nothing in the codebase implements
  2FA at all, there was no honest way to describe it as a toggle. **Email
  / SMS Notifications** ("Enabled") — investigating
  `NotificationDeliveryService` found only `PUSH` is a real delivery
  channel; `EmailService` exists but is wired only to auth verification
  emails, never the general notification pipeline, and no SMS provider
  exists anywhere. Displaying them as "Enabled" toggles would have been
  the exact bug this item exists to fix, just moved into the new code
  instead of removed. Kept **Password Policy** but relabeled it "(fixed)"
  — the 12-char/upper/lower/number/symbol rule is real (`RegisterDto`)
  but is compile-time `class-validator` decorators, not admin-editable,
  so the UI now says so instead of implying a control that isn't there.
  **Platform Info** card now reads real values: added `version` to the
  already-real `GET /admin/health` response (`process.env.npm_package_version`,
  matching the pattern already used in `health.controller.ts`) — API/DB
  status were already real, only the version was previously hardcoded.
  Verified further than any other item this session: this sandbox turned
  out to have PostgreSQL 16 installed locally (just not running) — started
  it, created a dev database, ran the real migration
  (`20260825153121_add_platform_settings`) and the seed script, and
  booted the actual NestJS API against it. Confirmed live over HTTP: the
  settings singleton lazily creates itself with sensible defaults on
  first `GET`; `PATCH` persists and audit-logs
  (`PLATFORM_SETTINGS_UPDATED`) with the acting admin's id; disabling
  `sosEmergencyEnabled` makes a real hospital-admin's
  `POST /organizations/:id/emergencies` call fail with 403 and
  re-enabling it immediately lets the identical request through (201);
  enabling `maintenanceMode` blocks a non-admin login with 403 while a
  `SUPER_ADMIN` login still succeeds. Then drove the actual admin-web
  `/settings` page in a headless browser through a real login, confirmed
  it renders the live values (not mocked/hardcoded), clicked a real
  toggle and Save button, and confirmed the resulting `PATCH` persisted
  after a full page reload. Also: 232/232 backend tests passing (up from
  219 — new coverage for every gate point touched: `admin.service.spec.ts`
  already existed from P1-13, `gamification-event.handler.spec.ts` is
  new since that handler had zero tests before this, plus additions to
  `auth`, `emergency`, and `notification-delivery` specs), clean
  `tsc --noEmit` on the API, clean `tsc --noEmit`/`next build` on
  admin-web, 0 new lint errors.
  - Files: `apps/api/prisma/schema.prisma`,
    `apps/api/prisma/migrations/20260825153121_add_platform_settings/` (new),
    `apps/api/src/modules/platform-settings/{platform-settings.module.ts,platform-settings.service.ts}` (new),
    `apps/api/src/app.module.ts`,
    `apps/api/src/modules/admin/{admin.controller.ts,admin.service.ts}`,
    `apps/api/src/modules/admin/dto/admin.dto.ts`,
    `apps/api/src/modules/auth/auth.service.ts` (+ both its spec files),
    `apps/api/src/modules/ai-health/ai-health.service.ts`,
    `apps/api/src/modules/emergency/emergency.service.ts` (+ spec),
    `apps/api/src/modules/gamification/events/gamification-event.handler.ts` (+ new spec),
    `apps/api/src/modules/notifications/services/notification-delivery.service.ts` (+ spec),
    `apps/admin-web/lib/api.tsx`, `apps/admin-web/app/settings/page.tsx`.

- [x] **P1-15. Admin: content moderation is a write-only sink.** — Fixed: the
  `ContentReport` model already had everything a moderation queue needs
  (`reviewedBy`/`reviewedAt`/`resolution`, and `CommunityPostStatus`
  already had `HIDDEN`/`REMOVED`) — it just had no admin code path
  touching it at all. Added three `AdminService` methods/endpoints:
  - `GET /admin/content-reports` (filterable by status/reason) and
    `GET /admin/content-reports/:id` (report + full post + every other
    report filed against that same post, so an admin isn't resolving
    five duplicate reports on the same post one at a time blind).
  - `POST /admin/content-reports/:id/resolve` with one of three actions:
    `DISMISS` (report only), `HIDE`/`REMOVE` (also flips the post's
    `CommunityPostStatus`, which `CommunityService.getFeed`/`getPost`
    already filter/404 on — so moderation takes effect immediately with
    no changes needed on the read side). Resolving with `HIDE`/`REMOVE`
    also auto-resolves every other still-open report on that same post
    (with a note pointing at which report actually triggered it), so
    duplicate reports don't pile up forever once the underlying content
    is already gone. Rejects re-resolving an already-`DISMISSED`/`ACTIONED`
    report. Audit-logs `CONTENT_REPORT_RESOLVED`.
  admin-web gets a new `/moderation` page (added to the sidebar): a
  filterable report queue plus a detail modal showing the reported post's
  full content, the reporter, any other reports on the same post, and
  Dismiss/Hide/Remove actions.
  **Found but not fixed here, tracked separately as P3-7**: while adding
  this, found the DTO file already had unused, never-wired scaffolding
  for three *other* unbuilt admin features (feature flags, announcements,
  support tickets) — no Prisma models, no controller, no service, just
  leftover DTO classes. Left untouched since deleting or building out
  dead code four features deep is a different task than fixing
  moderation, but worth flagging rather than silently walking past.
  Verified: 8 new tests in `admin.service.spec.ts` (dismiss/hide/remove,
  the auto-resolve-siblings behavior, both already-resolved rejections,
  the not-found case, and `getContentReport`'s sibling-reports list),
  full suite 240/240 passing, clean `tsc --noEmit`/`next build` on both
  the API and admin-web, 0 new lint errors. Exercised the entire flow
  live end-to-end against the real local Postgres from P1-14: inserted a
  test post + report directly, resolved it with `HIDE` through the raw
  API and confirmed the post disappeared from `/community/feed` and
  404'd on direct view; inserted a second post + report and resolved it
  with `REMOVE` by actually clicking through the real admin-web
  `/moderation` page in a headless browser (login → report queue → open
  detail → Remove Post), confirmed the `CommunityPost.status` flip in the
  database afterward.
  - Files: `apps/api/src/modules/admin/{admin.service.ts,admin.controller.ts}`,
    `apps/api/src/modules/admin/dto/admin.dto.ts`,
    `apps/api/src/modules/admin/admin.service.spec.ts`,
    `apps/admin-web/lib/{api.tsx,navigation.tsx,status.tsx}`,
    `apps/admin-web/app/moderation/page.tsx` (new).

- [x] **P1-16. Inventory is missing issue/expire/adjust operations entirely.** — Fixed
  all five sub-gaps this item named:
  - **Issue (dispense)**: `POST .../units/:unitId/issue` — transitions
    AVAILABLE or RESERVED → `USED` with the same atomic-conditional-update
    TOCTOU pattern as release/quarantine/discard (established under P1-2).
    Fulfills whatever active reservation was holding the unit. Open to
    both blood-center *and* hospital staff roles — confirmed by reading
    `confirmDeliveryFull` in shipments.service.ts that `BloodUnit.organizationId`
    actually transfers to the destination hospital on delivery (`TRANSFER_IN`),
    so hospitals hold real inventory and are the ones who administer units
    to patients, not blood centers.
  - **Adjust (manual correction)**: `PATCH .../units/:unitId/adjust` —
    corrects `volumeMl`/`componentType`/`expiresAt` with a required reason,
    blocked on terminal statuses (USED/DISCARDED/EXPIRED), same
    TOCTOU-safe pattern. Needed one migration: added `MovementType.ADJUSTED`
    rather than force-fitting the correction into an existing, wrong type.
  - **Expiration cron**: new `InventoryCronService`, hourly
    (`@nestjs/schedule` — not previously a dependency of this app at all;
    added `ScheduleModule.forRoot()` to `AppModule`, which is also the
    infrastructure P1-18's SOS-expiration job will reuse). Sweeps units
    past `expiresAt` to `EXPIRED`, using the same atomic-claim pattern per
    unit so a unit that changed status between the query and the claim
    isn't silently overwritten.
  - **Expired reservations auto-released**: same cron run also sweeps
    `BloodUnitReservation` rows past `expiresAt`, releasing the unit back
    to `AVAILABLE` (unless it already expired first) and marking the
    reservation `EXPIRED`.
  - **Alerts actually generated**: added `InventoryService.ensureAlert(...)`
    (updates the existing unacknowledged alert for the same
    org/type/bloodType/rhFactor instead of creating a duplicate every
    time the condition re-fires) called from three places: the cron's
    stock-level sweep (`LOW_STOCK` <5 available units, `EXPIRING_SOON`
    within 72h, both grouped per org/bloodType/rhFactor), the cron's
    expiry sweep (`EXPIRED`, one alert per org per run), and
    `quarantineUnit` itself (`QUARANTINED`, at the natural trigger point
    rather than waiting for a scan).
  Also fixed, found while touching this page: blood-center-web's
  inventory page had a `STATUSES` filter list with two statuses
  (`VERIFIED`, `ISSUED`) that don't exist in `BloodUnitStatus` and was
  missing `USED` entirely — the newly-issuable status wouldn't have even
  been filterable. Same for `COMPONENT_TYPES` (`RBC`/`CRYO` instead of
  the real `RED_CELLS`/`OTHER`) — silently broken before since nothing
  sent it anywhere that validated it; now it's the source for the new
  Adjust modal's component dropdown, so it had to be right.
  Verified: 25 new tests (`inventory.service.spec.ts` +8 for
  issue/adjust/quarantine-alerting, new `inventory-cron.service.spec.ts`
  with 8 for the three sweep methods + the audit-summary behavior), full
  suite 257/257 passing, clean `tsc --noEmit` on the API and
  `tsc --noEmit`/`next build` on blood-center-web, 0 new lint errors.
  Exercised the entire thing live against the real Postgres from
  P1-14/15: issued a real unit and confirmed re-issuing it 400s; adjusted
  a unit's volume and confirmed the new value persisted; force-expired a
  unit and a reservation by backdating their `expiresAt` directly in the
  database, then ran the actual `InventoryCronService` methods (via a
  throwaway `tsx` script instantiating the real classes against the live
  DB, deleted after) and confirmed in Postgres afterward: the unit
  flipped to `EXPIRED` with a movement row, the reservation flipped to
  `EXPIRED` and its unit bounced back to `AVAILABLE` with a movement row,
  and `LOW_STOCK`/`EXPIRED`/`QUARANTINED` alerts appeared with correct
  counts — 9 real alerts where the table was permanently empty before.
  - Files: `apps/api/prisma/schema.prisma` (+ migration),
    `apps/api/src/app.module.ts`, `apps/api/package.json` (+`@nestjs/schedule`),
    `apps/api/src/modules/inventory/{inventory.service.ts,inventory.controller.ts,inventory.module.ts}`,
    `apps/api/src/modules/inventory/dto/inventory.dto.ts`,
    `apps/api/src/modules/inventory/inventory-cron.service.ts` (new),
    `apps/api/src/modules/inventory/{inventory.service.spec.ts,inventory-cron.service.spec.ts (new)}`,
    `apps/blood-center-web/lib/inventory.ts`,
    `apps/blood-center-web/app/inventory/page.tsx`.

- [x] **P1-17. Challenge progress is donor self-reported — instantly exploitable.** — Fixed:
  `ChallengesService.updateProgress` took a raw client-supplied number and
  wrote it straight into `ChallengeParticipant.progress`, auto-completing
  the challenge once it crossed the goal — confirmed exploitable via a
  single unauthenticated-by-anything-but-a-JWT `PUT` call. Renamed to
  `recalculateProgress` and rewrote it to derive the number itself from
  the donor's real activity records, one query per `ChallengeType`:
  `DONATION_MILESTONE`/`APPOINTMENT_COMPLETION` count real completed
  `Donation`/`Appointment` rows, `CAMPAIGN_PARTICIPATION` counts
  `CampaignParticipant` rows, `EDUCATION` counts completed
  `EducationProgress` rows, `COMMUNITY` counts published `CommunityPost`
  rows, and `CONSISTENCY` counts distinct calendar months with a
  completed donation (deliberately not a raw donation count — that's
  already what `DONATION_MILESTONE` measures). All six respect the
  challenge's own `startDate`/`endDate` window when set. The client's
  request body is now ignored entirely — verified live by sending
  `{"progress": 999}` for a two-donation-goal challenge and getting back
  the donor's real count (11, from seed data), not 999.
  The mobile API client's `updateChallengeProgress(challengeId, progress)`
  turned out to be dead code — no screen anywhere calls it (the challenges
  screen only ever displays progress, never submits it), which is exactly
  how the exploit could only ever be reached by a direct API call, not
  through the app. Renamed to `recalculateChallengeProgress(challengeId)`
  or with no `progress` param, matching the new contract.
  XP reward on completion was previously entirely unwired despite
  `XpTransactionType.CHALLENGE_COMPLETED` already existing unused in the
  schema — same "scaffolding exists, nothing connects it" pattern found
  repeatedly this session. Wired it the same event-driven way as every
  other XP source: emits `CHALLENGE_COMPLETED_EVENT` (new,
  `gamification-event.handler.ts`) the moment progress first crosses the
  goal, handled by a new `GamificationService.processChallengeCompleted`
  which reuses `XpService.awardXp`'s existing idempotency
  (`sourceType`/`sourceId` uniqueness prevents a re-recalculation from
  double-awarding) — verified live: one real `XpTransaction` row after
  completing, still exactly one after calling recalculate again.
  Also wired automatic recomputation (not just on-demand) for the two
  challenge types with an existing, already-firing completion event: a
  new `ChallengeProgressEventHandler` listens for the same
  `DONATION_COMPLETED_EVENT`/`APPOINTMENT_COMPLETED_EVENT` the donation
  and appointment services already emit, and recalculates every
  matching-type challenge the donor has joined. The other four types
  (`CAMPAIGN_PARTICIPATION`/`EDUCATION`/`COMMUNITY`/`CONSISTENCY`) compute
  correctly when recalculated but have no automatic push trigger yet —
  their owning modules don't currently emit a matching completion event
  to hook into, and adding one to each was judged out of scope for a
  fix whose job was closing the exploit, not building out gamification
  event coverage for every feature; noted here rather than silently
  implied as automatic.
  Verified: 30 new tests across four spec files (18 for
  `ChallengesService` covering every challenge type, the window filter,
  and the completed-once/no-double-award/no-reward-no-event edge cases;
  3 for the new `ChallengeProgressEventHandler`; 3 for
  `GamificationService.processChallengeCompleted`; 6 added to the
  existing `gamification-event.handler.spec.ts`), full suite 279/279
  passing, clean `tsc --noEmit` on the API, 0 new lint errors. Live end-
  to-end against the real Postgres: created a real `DONATION_MILESTONE`
  challenge, joined it as the seeded donor, confirmed the exploit attempt
  was ignored and real progress/completion/XP were used instead, and
  confirmed idempotency on a second call.
  - Files: `apps/api/src/modules/challenges/challenges.service.ts` (+ new spec),
    `apps/api/src/modules/challenges/challenges.controller.ts`,
    `apps/api/src/modules/challenges/challenges.module.ts`,
    `apps/api/src/modules/challenges/events/challenge-progress-event.handler.ts` (new, + spec),
    `apps/api/src/modules/gamification/gamification.service.ts` (+ new spec),
    `apps/api/src/modules/gamification/events/gamification-event.handler.ts` (+ spec additions),
    `apps/mobile/src/api/challenges.ts`.

- [x] **P1-18. No SOS / emergency-match expiration job.** — Fixed:
  `EmergencyStatus.EXPIRED`, `EmergencyMatch.expiredAt`, and a fully-built
  `notification-event.handler.ts` `SOS_REQUEST_EXPIRED_EVENT` handler all
  existed, but nothing anywhere ever emitted that event or set those
  fields — a stale emergency just sat in `ACTIVE`/`MATCHING`/
  `RESPONSES_RECEIVED` forever, and its donor notifications never expired.
  The blocker was that `EmergencyRequest` has no persisted activation
  timestamp, so the implicit "4 hours after activation" default deadline
  (previously computed fresh in `activateEmergency` only to label the
  donor-facing notification, then thrown away) couldn't be reconstructed
  later by a cron. Fixed at the source: `activateEmergency` now persists
  `requiredBefore = emergency.requiredBefore ?? now+4h` onto the row
  itself at the moment of activation, so `requiredBefore` becomes the one
  real, durable deadline for every emergency going forward — no schema
  change needed, since the column already existed and was just never
  written when absent.
  Added `EmergencyCronService` (new, mirrors `InventoryCronService`'s
  structure from P1-16 exactly), registered on the same `@nestjs/schedule`
  infrastructure, running every 5 minutes (`EVERY_5_MINUTES` — an SOS
  deadline is far more time-sensitive than inventory housekeeping's
  hourly cadence). `expireStaleEmergencies()` finds every
  `EmergencyRequest` still in an open status (`ACTIVE`/`MATCHING`/
  `RESPONSES_RECEIVED`) with a `requiredBefore` in the past, and per row,
  atomically claims it (`updateMany` conditioned on still being in an open
  status, closing the same pre-check/mutation race window as every other
  cron this session) to `EXPIRED` with `closedAt` set. Once claimed, it
  reads the still-pending `EmergencyMatch` rows (`MATCHED`/`NOTIFIED`/
  `VIEWED` — deliberately not `ACCEPTED`/`DECLINED`/`CANCELLED`, which are
  already resolved and untouched) and expires them with `expiredAt` set,
  then emits `sos.request.expired` once per affected donor so the
  pre-existing `handleSosRequestExpired` handler finally fires and expires
  that donor's SOS push notification. A request that progresses past an
  open status (e.g. a donor gets confirmed) between the query and the
  claim is correctly left alone — the same atomic-claim pattern used
  throughout this session. `runMaintenance()` audit-logs a
  `EMERGENCY_EXPIRATION_RUN` summary only when at least one request
  actually expired.
  Verified: 4 new tests for `EmergencyCronService` (claims and expires a
  stale request + its pending matches + emits one event per notified
  donor; a request that already progressed before the claim landed is
  left untouched; matches that already resolved are never touched; the
  audit-log-only-when-something-happened behavior), full suite 284/284
  passing (up from 279), clean `tsc --noEmit`, 0 new lint errors. Live
  end-to-end against the real Postgres + running API: created a real
  emergency via the API, activated it (confirmed `requiredBefore`
  persisted at `+4h`), backdated it to the past, attached a real
  `EmergencyMatch` and a real `Notification` row for a seeded donor, ran
  `expireStaleEmergencies()` directly against the live DB (bypassing
  NestJS DI the same way as P1-16's throwaway script), and confirmed all
  three rows flipped correctly in one pass (`EmergencyRequest` →
  `EXPIRED`/`closedAt` set, `EmergencyMatch` → `EXPIRED`/`expiredAt` set,
  `Notification` → `EXPIRED` via the real, unmodified
  `handleSosRequestExpired` code path) and that a second run was a no-op
  (idempotent, 0 processed). Test data and the throwaway script were
  deleted afterward.
  - Files: `apps/api/src/modules/emergency/emergency.service.ts`,
    `apps/api/src/modules/emergency/emergency-cron.service.ts` (new, + spec),
    `apps/api/src/modules/emergency/emergency.module.ts`.

- [x] **P1-19. Mobile has no map view (split out of P1-10).** — Fixed: added
  `react-native-maps@1.18.0` (the exact version Expo SDK 52 bundles —
  confirmed via `expo/bundledNativeModules.json` rather than guessed) and a
  new `LocationMap` component (`apps/mobile/src/components/map/LocationMap.tsx`),
  the native counterpart of P1-10's web `LocationMap`: same marker-variant
  color scheme (origin/destination/courier/donor/hospital), same optional
  dashed route line, same fit-to-bounds-on-mount behavior (via
  `MapView.fitToCoordinates`). Deliberately **not** exported through the
  shared `src/components/index.ts` barrel — for the same reason P1-10's web
  version isn't in its barrel either: `react-native-maps` links a native
  module Expo Go doesn't ship, so importing it anywhere in a barrel that
  every screen pulls in would crash the *entire app* under Expo Go, map
  screens or not.
  Wired into both screens named in this item, and both turned out to
  already have the exact data-fetching code they needed sitting dead and
  unused — the same "scaffolding exists, nothing connects it" pattern
  found repeatedly this session:
  - `sos.tsx` — `getDonorTracking(responseId)` existed in
    `src/api/emergency.ts` and was never called anywhere. Now polled every
    15s (matching the existing location-send interval) while a response is
    `responding`/`en_route`/`arrived`, rendering the donor's own last
    reported position and the hospital's destination coordinates. Extended
    its return type (`DonorTrackingResponse`, new) since the endpoint
    actually returns the nested `emergencyRequest.hospital` and `locations`
    the screen needs, which the old `EmergencyResponse` return type didn't
    declare.
  - `(courier)/active.tsx` — `getShipmentTracking(shipmentId)` and its
    `ShipmentTracking` type already existed in `src/api/courier.ts`,
    likewise unused. Now polled every 20s (matching the existing
    location-send interval) for any active shipment, rendering pickup
    (origin), the courier's own last reported position, and delivery
    (destination) with a route line between them.
  Both screens degrade to showing nothing (not an error) when coordinates
  aren't available yet, so the existing text-only info (hospital name/
  address, pickup/destination addresses) they already rendered is
  unaffected either way.
  **Still needs before a real device can use it** (unchanged from this
  item's original framing — this is a native module, not a pure JS change):
  a `GOOGLE_MAPS_API_KEY` added to `app.json`'s `android.config.googleMaps.apiKey`
  for Android tile rendering (iOS uses Apple Maps by default via
  `PROVIDER_DEFAULT`, no key needed), and a dev-client or EAS build to run
  it at all — `react-native-maps` is exactly the "first native feature"
  `package.json`'s `test` script placeholder was written for
  (`"Mobile component tests scheduled with the first native feature"`), so
  component-level tests for `LocationMap` are left for whenever that native
  test infrastructure gets built, rather than invented ad hoc here.
  Verified: `tsc --noEmit` shows the exact same 160 pre-existing (unrelated
  nativewind `className`-typing) errors before and after this change on a
  clean `git stash`/`stash pop` comparison — zero new errors from any file
  this item touched. More importantly, `npx expo export` for **both**
  `--platform android` and `--platform ios` completed cleanly (3195 modules
  each, real Metro bundling of the actual native module graph, not just
  `tsc`) — the strongest verification available without a device/simulator
  or the dev-client/EAS build this item's own scope note says is required
  for a true on-device check.
  - Files: `apps/mobile/package.json`, `apps/mobile/src/components/map/LocationMap.tsx` (new),
    `apps/mobile/src/api/emergency.ts`, `apps/mobile/app/sos.tsx`,
    `apps/mobile/app/(courier)/active.tsx`.

- [x] **P1-20. `organization.status` is never checked outside admin/auth (split out of P1-12).** — Fixed:
  chose the "check added at each existing access-control chokepoint"
  option over a new global guard — `OrganizationGuard` (P2-1) is written
  but applied nowhere, and retrofitting every org-scoped controller with
  it to gate on status too would have meant taking on P2-1's whole
  "apply it everywhere for the first time" risk inside what should be a
  narrowly-scoped fix. Instead added one small shared helper,
  `assertOrganizationActive(organization)` (new
  `apps/api/src/common/utils/organization-status.util.ts`), and called it
  from the access-check method every org-scoped mutation this session
  found already funnels through — no new decorators, no controller
  changes:
  - `shipments.service.ts` — `checkHospitalAccess`, `checkBloodCenterAccess`
    (both gate blood-request/shipment creation and every shipment-lifecycle
    transition), and `checkCourierAccess` (gates every courier action —
    a courier belongs to a blood center, so a suspended blood center's
    courier can no longer accept/progress deliveries either).
  - `emergency.service.ts` — `checkHospitalAccess`, which gates
    `createEmergency`/`activateEmergency` and everything else on the
    hospital side of the SOS flow — a not-yet-approved or suspended
    hospital can no longer trigger a real SOS emergency.
  - `inventory.service.ts` — `getAuthorizedUser` (gates the read
    endpoints: summary/list/unit/locations/movements/reservations/alerts)
    and `getAuthorizedUnit` (gates every unit mutation: issue, adjust,
    release, quarantine, discard, move, reserve) and `releaseReservation`
    (the one mutation that doesn't go through `getAuthorizedUnit`).
    `SUPER_ADMIN` deliberately bypasses this check in both places (matching
    the pre-existing, separately-scoped `isSuperAdmin` bypass already in
    `getAuthorizedUser`) — platform admins need to be able to act on a
    suspended org to actually process it, not get locked out of it too.
  - `appointments.service.ts` — no shared access-check helper existed here
    (each method inlines its own membership check), so added the same
    call at the three places that needed it: `bookAppointment` (checks the
    slot's hosting organization — a donor can no longer book into a
    not-yet-approved or suspended org's slot), and the staff-side
    `confirmAppointment`/`completeAppointment`. Deliberately did **not**
    add it to donor-initiated `cancelAppointment`/`rescheduleAppointment`
    — a donor should still be able to extract themselves from an
    appointment at an org that got suspended after they booked it, not get
    stuck unable to cancel.
  Every insertion point was chosen to be where the org-scoped access
  control for that flow already lived, so the fix's blast radius is
  exactly "the same set of requests that were already being
  role/membership-checked, now also status-checked" — nothing new is
  reachable that wasn't already gated by something.
  Verified: 26 new tests across all four service spec files (status
  ACTIVE/PENDING_APPROVAL/SUSPENDED/DEACTIVATED cases for every
  access-check method touched, plus a super-admin-bypass case for
  inventory), full suite 310/310 passing (up from 284), clean
  `tsc --noEmit`, 0 new lint errors. Live end-to-end against the real
  Postgres + running API: confirmed SOS activation, new-emergency
  creation, appointment slot booking, and inventory read/issue-unit all
  succeed normally while the organization is `ACTIVE`; flipped the
  seeded hospital to `SUSPENDED` and the seeded blood center to
  `PENDING_APPROVAL` via `psql` and confirmed all four were rejected with
  a clean `403 "This organization is not active."`; confirmed the seeded
  `SUPER_ADMIN` (who holds real memberships in both seeded orgs) could
  still read the suspended blood center's inventory while its own staff
  could not; restored both organizations to `ACTIVE` and confirmed every
  endpoint worked normally again. Cleaned up all test data (the draft
  emergency, the booked appointment and its slot's `bookedCount`, the
  issued unit's status and movement record) afterward.
  - Files: `apps/api/src/common/utils/organization-status.util.ts` (new),
    `apps/api/src/modules/shipments/shipments.service.ts` (+ spec),
    `apps/api/src/modules/emergency/emergency.service.ts` (+ spec),
    `apps/api/src/modules/inventory/inventory.service.ts` (+ spec),
    `apps/api/src/modules/appointments/appointments.service.ts` (+ spec).

---

## 🟡 P2 — Correctness, safety, and RBAC gaps

- [x] **P2-1. `OrganizationGuard` is written but never applied anywhere** — Fixed,
  and the investigation turned up a real, live cross-org vulnerability, not
  just a hygiene gap. Auditing every controller with an `:organizationId`
  route param (every one of them, with zero exceptions, literally names it
  that) found the per-service checks were inconsistent: `shipments`,
  `emergency`, `inventory`, `appointments`, and `appointment-slots` all
  verify the caller actually belongs to `:organizationId`, but
  `donations.service.ts`'s `checkInDonation`/`recordAssessment`/
  `startDonation`/`completeDonation`/`cancelDonation`/`abortDonation` only
  ever verified the *resource* (appointment/donation) belonged to
  `:organizationId` — never that the *caller* did. Since `@Roles(...)`
  only checks role codes present anywhere on the user's JWT, not which
  organization granted them, any `HOSPITAL_STAFF` at *any* hospital could
  check in, assess, start, complete, cancel, or abort a donation at a
  *different* hospital by simply passing that hospital's id in the URL —
  confirmed live (see below) before fixing it. `laboratory.service.ts` and
  `analytics/*.service.ts` had no per-caller membership check at all
  either, relying entirely on the same org-blind role check.
  Rewrote the guard rather than finally decorating routes with its old
  design: it previously required per-route reflector metadata
  (`ORGANIZATION_ID_KEY`) that nothing ever set, so wiring it in would
  have meant adding a decorator to every one of ~40 routes across 7
  controllers — exactly the kind of "easy to forget on the next new route"
  process this item exists to eliminate. Since every org-scoped route
  already names the param `:organizationId` with no exceptions, the guard
  now just reads `request.params.organizationId` directly: a no-op (zero
  DB cost) for any route without it, and for one that has it, requires an
  `ACTIVE` membership in that specific organization whose own `status` is
  also `ACTIVE` — folding in P1-20's status check too, so every remaining
  org-scoped route not already covered by a P1-20 per-service check gets
  it for free from this one place. `SUPER_ADMIN` bypasses both checks
  globally (matching the bypass convention already used throughout
  P1-20's fixes), consistent with platform admins needing to act on a
  suspended org to actually process it. Registered as a fifth global
  `APP_GUARD` alongside `JwtAuthGuard`/`RolesGuard`/`PermissionsGuard` in
  `app.module.ts`, so it applies automatically to every current and future
  route — no per-controller opt-in to remember. The P1-20 per-service
  checks were left in place as harmless defense-in-depth (most of them sit
  on routes with no `:organizationId` URL param at all — courier and
  donor-facing routes resolve their organization from a resource id, not
  the URL — so they remain the *only* protection there, not redundant).
  Verified: 9 new tests for the guard (no-op without the param, no user,
  member of a different org, no membership at all, each non-ACTIVE org
  status, super-admin bypass), full suite 319/319 passing (up from 310),
  clean `tsc --noEmit`, 0 new lint errors/warnings. Live end-to-end
  against the real Postgres + running API: confirmed the hospital
  admin's token could reach the blood center's donations/analytics and
  the blood center admin's token could reach the hospital's appointment
  slots *before* this fix would have succeeded, and specifically
  reproduced and then confirmed the fix on the exact vulnerability found
  above — `POST /organizations/:bloodCenterId/donations/check-in/:appointmentId`
  with the hospital admin's token, blocked with `403 "You do not have
  access to this organization."` before ever reaching the vulnerable
  service code. Confirmed every legitimate same-org flow across
  emergencies/inventory/appointment-slots/analytics/donations still
  returns `200`, confirmed `SUPER_ADMIN` and a courier acting within their
  own organization were unaffected, and confirmed a suspended organization
  is now blocked on routes P1-20 never touched (`donations`) too, then
  restored both organizations to `ACTIVE`.
  - Files: `apps/api/src/common/guards/organization.guard.ts` (+ new spec),
    `apps/api/src/app.module.ts`.

- [x] **P2-2. `LAB_TECHNICIAN`/`LAB_REVIEWER`/`LAB_ADMIN` roles have zero
  seeded permissions and are excluded from the actual lab-workflow
  routes.** — Fixed. The three lab roles genuinely had zero permissions
  seeded and were locked out of every real lab-workflow route
  (confirm/check-in/start/complete/no-show/create-result/review/publish) —
  `LAB_TECHNICIAN` couldn't reach a single one. The one exception,
  `getLaboratoryAppointments`, revealed the bug's real shape: the
  *service* method already had its own internal check allowing all three
  lab roles, but the *controller*'s `@Roles(...)` decorator for that same
  route never did — so the service was ready and willing, but the
  request never got past the guard to reach it. Every other lab-workflow
  route just relies on `@Roles(...)` directly (no redundant service-level
  check), so the fix there was adding the three roles to each route's
  decorator, not touching the service.
  Split the three roles by real-world responsibility rather than adding
  all three everywhere: `LAB_TECHNICIAN` gets the hands-on routes
  (confirm/check-in/start/complete/no-show/create-result) plus reading
  results; `LAB_REVIEWER` gets review/publish plus reading results, but
  deliberately **not** the hands-on routes; `LAB_ADMIN` gets everything.
  `LAB_TECHNICIAN` is deliberately excluded from review/publish — a
  technician shouldn't be able to approve their own result, mirroring the
  create-vs-publish separation this codebase already uses for
  `BLOOD_CENTER_STAFF` (`blood_test.create`/`update`) vs
  `BLOOD_CENTER_ADMIN` (also gets `blood_test.publish`) — which is also
  where the new permission grants came from: reused the existing
  `blood_test.create`/`update`/`publish` codes (seeded but referenced
  nowhere in the app, since no controller anywhere uses `@Permissions()`
  for lab routes — only `@Roles()` — so this seeds them for parity/
  future use rather than newly enforcing anything) instead of inventing
  parallel `laboratory.*` codes for the same concept.
  Added three seed accounts (`lab.technician@donor.local`,
  `lab.reviewer@donor.local`, `lab.admin@donor.local`, one per role,
  matching this file's one-account-per-role convention), each a real
  `OrganizationMembership` at the seeded blood center — necessary since
  P2-1's now-global `OrganizationGuard` requires real membership at
  `:organizationId` regardless of role.
  Verified: full suite still 319/319 (this is a pure `@Roles()` metadata +
  seed-data change, nothing to unit-test beyond what `roles.guard.spec.ts`
  already covers generically), clean `tsc --noEmit`, 0 new lint
  warnings. Live end-to-end against the real Postgres + running API:
  logged in as all three seeded lab accounts and drove a real appointment
  through `LAB_TECHNICIAN`'s full chain (check-in → start → complete,
  each `200`), confirmed `LAB_TECHNICIAN` is correctly blocked from
  `reviewResult` (`403`, role-based), confirmed `LAB_REVIEWER` correctly
  passes that same route's role check (got a `400` business-logic
  rejection instead — proof the *access control* layer now passes, since
  a role rejection and a business-rule rejection are distinguishable by
  status code), and confirmed `LAB_ADMIN` has full read access everywhere.
  Restored the test appointment's status and history afterward.
  Running the full `prisma:seed` script against the already-seeded dev
  DB (to pick up these changes) hit a **pre-existing, unrelated**
  idempotency bug partway through (`db.donation.create()` isn't
  upsert-safe, and neither is `db.organization.create()` — a re-run
  duplicates both orgs before crashing on the donation step) — not
  something this item touches or caused, but it did leave two duplicate
  orgs in the dev DB from the partial run, cleaned up via `psql` (cascade
  delete), with the three lab accounts' memberships then inserted
  directly against the real seeded org to finish what the crashed run
  didn't reach.
  Also found, while driving the live verification, a genuine unrelated
  bug that blocks `createResult` for every role, not just lab ones — see
  new **P2-15** below.
  - Files: `apps/api/prisma/seed.ts`,
    `apps/api/src/modules/laboratory/laboratory.controller.ts`.

- [x] **P2-3. Appointment booking has no `@Roles(DONOR)` guard** — Fixed:
  confirmed live before fixing — a `hospital.staff@donor.local` token and
  a `courier@donor.local` token could both successfully call
  `POST /appointments` and book a real donation slot for themselves, none
  of the six donor-self-service routes (`book`, `me`, `me/next`, `cancel`,
  `reschedule`, plus implicitly `:id` for reading) had any `@Roles(...)`
  at all — only the two staff-only routes (`confirm`/`complete`) were
  gated. Added `@Roles(DONOR, SUPER_ADMIN)` to `bookAppointment`,
  `getMyAppointments`, `getNextAppointment`, `cancelAppointment`, and
  `rescheduleAppointment` — matching the `DONOR, SUPER_ADMIN` pattern this
  codebase already uses for the equivalent donor-self-service routes in
  `laboratory.controller.ts`.
  Deliberately left `GET /appointments/:id` (`getAppointmentById`)
  unrestricted: its service method already has its own internal
  authorization branch allowing *either* the donor who owns the
  appointment *or* staff of the organization hosting it (verified by
  reading `AppointmentsService.getAppointmentById`) — adding a
  donor-only role guard there would have been a regression, blocking
  legitimate staff from viewing appointment details they're already
  allowed to see. `cancelAppointment`/`rescheduleAppointment` have no such
  staff branch (strictly `appointment.donorId !== donorId` →
  `ForbiddenException`), confirming they were safe to restrict.
  Verified: full suite still 319/319 (pure `@Roles()` metadata change, no
  service logic touched), clean `tsc --noEmit`, 0 new lint warnings. Live
  end-to-end against the real Postgres + running API: reproduced the
  exact exploit from this item's description with both a hospital-staff
  and a courier token (both `403` now, previously `201`/booked
  successfully), confirmed a real donor could still book, view, and
  cancel an appointment normally, and confirmed hospital staff could
  still view that same appointment by ID and confirm it — proving the
  intentional dual-access route wasn't broken by this fix.
  - File: `apps/api/src/modules/appointments/appointments.controller.ts`.

- [x] **P2-4. Emergency module DTOs are plain interfaces with zero
  class-validator decorators.** — Fixed. Confirmed live before fixing:
  `POST .../emergencies` with `bloodType: "NOT_A_BLOOD_TYPE"` or a negative
  `unitsRequired` sailed straight through the global `ValidationPipe`
  (which only validates real classes — a plain inline TS interface has no
  runtime representation, so `toValidate()` treats it as nothing to
  check) into `EmergencyService`/Prisma. Added a new
  `apps/api/src/modules/emergency/dto/emergency.dto.ts` with five real
  classes (`CreateEmergencyDto`, `CancelEmergencyDto`,
  `CancelEmergencyResponseDto`, `CompleteEmergencyResponseDto`,
  `UpdateEmergencyLocationDto`) and swapped every inline `@Body()` type in
  `emergency.controller.ts` for one of them — enum checks on
  `bloodType`/`rhFactor`, `@Min(1)` on `unitsRequired`/`volumeMl`,
  `@IsIn([...])` on `urgencyLevel` matching the exact 4-value set
  hospital-web's own create form already offers, lat/lng range checks
  matching `shipments`' existing `UpdateLocationDto` pattern (the service
  layer's own defensive range checks on `updateLocation` stay as
  harmless defense-in-depth). Left `getEmergencies`' `@Query()` filter
  interface alone — this item's own scope is bodies, and a GET filter
  is a materially lower-risk gap than the mutation endpoints named here.
  On the notifications side, most of `dto/*` turned out to already be
  proper classes (`RegisterPushDeviceDto`/`UpdatePushDeviceDto`) or pure
  internal types never touched by `@Body()`
  (`CreateNotificationDto`/`NotificationFilterDto`/
  `UpdateNotificationDto`/response shapes) — no gap there. The two real
  ones: `MarkReadDto` (`{notificationIds: string[]}` — a malformed or
  missing value would have hit `dto.notificationIds.map(...)` as a raw
  TypeError, an actual 500 confirmed live before the fix) and
  `UpdateNotificationPreferencesDto`, both converted to real classes.
  Fixing the preferences DTO surfaced a real, separate bug: **two
  complete, independent modules** both implement notification
  preferences and both register `@Controller('notifications')` +
  `@Patch('preferences')`/`@Get('preferences')` — `notification-preferences/`
  (small, standalone) and `notifications/` (the larger combined module,
  whose own `NotificationPreferenceService` also has load-bearing
  internal methods — `isInQuietHours`/`shouldEmergencyOverride`/
  `isChannelEnabled` — actually used by the real delivery pipeline, so
  it's not simply dead). Because `NotificationPreferencesModule` is
  imported first in `app.module.ts`, its controller silently wins the
  route registration and the other's `getPreferences`/`updatePreferences`
  are unreachable dead code — confirmed by editing the "obvious" file
  first, getting genuinely confusing live-test results, and tracing it
  back to this route collision (a full audit of every controller found
  it's the *only* such collision in the API). Fixed the DTO that's
  actually live (`notification-preferences/dto/update-notification-preferences.dto.ts`)
  with the same quiet-hours `HH:mm` `@Matches` validation, kept the
  parallel fix on the dead copy since it's harmless and matches this
  item's own file pointer, and logged the duplicate-module discovery
  itself as new **P2-16** below rather than trying to resolve a
  whole-module consolidation inside a DTO-validation fix.
  Verified: full suite still 319/319, clean `tsc --noEmit`, 0 new lint
  warnings. Live end-to-end against the real Postgres + running API:
  confirmed bad `bloodType`/negative `unitsRequired`/bogus `urgencyLevel`
  now return clean `400`s instead of reaching Prisma raw, confirmed a
  legitimate create/cancel still works, confirmed `forbidNonWhitelisted`
  now actually rejects an unexpected extra field on the emergency cancel
  body (previously silently accepted since there was no class to
  whitelist against), confirmed `mark-read` with a non-array/missing
  `notificationIds` now 400s instead of 500ing, and — after tracing the
  duplicate-module issue — confirmed the quiet-hours format fix on the
  actually-live preferences route specifically (`25:99` now `400`s,
  `22:30`/`06:15` still succeeds). Restored the test donor's notification
  preferences to sane defaults afterward.
  - Files: `apps/api/src/modules/emergency/dto/emergency.dto.ts` (new),
    `apps/api/src/modules/emergency/emergency.controller.ts`,
    `apps/api/src/modules/notifications/dto/create-notification.dto.ts`,
    `apps/api/src/modules/notifications/dto/notification-preference.dto.ts`,
    `apps/api/src/modules/notification-preferences/dto/update-notification-preferences.dto.ts`.

- [x] **P2-5. `EmergencyRequest` has no blood-component field** — Fixed:
  added `componentType ComponentType @default(WHOLE_BLOOD)` to
  `EmergencyRequest` (migration `20260826065126_add_emergency_component_type`,
  default backfills existing rows safely, matches `BloodRequestItem`'s own
  `componentType` field/default). Wired end-to-end rather than just adding
  a column nobody could set: `CreateEmergencyDto` accepts an optional
  `componentType` (validated against the real enum, defaults to
  `WHOLE_BLOOD` server-side when omitted); `completeEmergency` derives the
  donation's `donationType` from it via a new
  `COMPONENT_TO_DONATION_TYPE` map instead of the previous hardcoded
  `'WHOLE_BLOOD'` literal, and passes the real `componentType` through to
  the `BloodUnit` record it creates (previously silently defaulting to
  `WHOLE_BLOOD` via the column's own Prisma default, regardless of what
  was actually collected). `DonationType` has no packed-red-cells value
  the way `ComponentType` does, so `RED_CELLS` maps to `DonationType.OTHER`
  for the donation record specifically — documented inline — while the
  `BloodUnit`'s own `componentType` keeps the precise value throughout.
  Added the same staff-facing override `CompleteEmergencyResponseDto`
  already supports for `bloodType`/`rhFactor` (in case what's actually
  collected differs from what was originally requested), matching that
  existing pattern rather than inventing a new one.
  Also wired the one real consumer of this field: hospital-web's
  create-emergency form had no component-type selector at all despite
  already having one for blood type/Rh/urgency — added a
  `COMPONENT_TYPES` select next to Urgency Level, defaulting to
  `WHOLE_BLOOD`, and surfaced it in the emergency list's summary line
  (`O-POSITIVE • PLATELETS • 1 unit required`, previously omitting
  component entirely). Left the completion `prompt()`-based UI as-is —
  it doesn't expose the pre-existing `bloodType`/`rhFactor` overrides
  either, so adding a `componentType` override there would be new UI
  scope beyond what this item's own file pointers covered, not a
  regression this fix introduced.
  Verified: 4 new tests (`createEmergency` defaulting/persisting
  `componentType`, `completeEmergency` deriving `donationType` from it,
  and the `RED_CELLS`→`OTHER` override mapping), full suite 323/323
  passing (up from 319), clean `tsc --noEmit` on both the API and
  hospital-web, clean `next build` on hospital-web, 0 new lint warnings.
  Live end-to-end against the real Postgres + running API: created a real
  emergency with no `componentType` (persisted `WHOLE_BLOOD`), created one
  with `componentType: PLATELETS` (persisted correctly), confirmed an
  invalid value `400`s with the real enum list in the error message,
  drove that PLATELETS emergency through a synthetic
  `DONATION_STARTED` response to a real completion and confirmed the
  resulting `Donation.donationType` and `BloodUnit.componentType` rows
  both correctly show `PLATELETS` — not the old hardcoded `WHOLE_BLOOD`.
  Cleaned up all test data afterward, including the real XP/achievement
  side effects the completion correctly triggered (confirms P1-6's
  gamification wiring still fires through this less-common code path
  too) — reverted the test donor's XP/level and deleted the achievement
  unlocks.
  - Files: `apps/api/prisma/schema.prisma` (+ migration),
    `apps/api/src/modules/emergency/dto/emergency.dto.ts`,
    `apps/api/src/modules/emergency/emergency.service.ts` (+ spec),
    `apps/hospital-web/lib/emergency.ts`,
    `apps/hospital-web/app/emergency/page.tsx`.

- [x] **P2-6. Emergency matching ignores real geo distance** — Fixed: the
  schema change this item said was needed. Added
  `latitude`/`longitude` (nullable `Decimal(9,6)`) to `DonorProfile`
  (migration `20260826084838_add_donor_profile_location`) — the model
  already had a `consentLocation` boolean with nothing to consent *to*,
  another instance of this session's "scaffolding exists, nothing
  connects it" pattern, just one layer further back than usual (the
  consent flag existed before the data it was meant to gate).
  `activateEmergency` now computes a real Haversine distance (new shared
  `apps/api/src/common/utils/geo.util.ts` — this codebase already had
  *two* independent copies of the same Haversine formula in
  `shipments.service.ts` and `location.service.ts`; added a third
  wasn't an option, so this one's shared, though reconciling the
  existing two duplicates is its own separate cleanup, not done here)
  from the emergency's coordinates to each blood-type-compatible donor's,
  when the emergency has a location and the donor has both consented
  (`consentLocation`) and has one recorded. Donors are ranked
  nearest-first before taking the top 50 (previously: query order, i.e.
  arbitrary); a donor with no usable distance still sorts in and is still
  matched — an unknown distance isn't a reason to exclude someone whose
  blood type already qualifies them. Each `EmergencyMatch` now persists
  the real `distanceKm` and a simple `matchScore`
  (`max(0, 100 − distanceKm)`, undocumented anywhere and unconsumed by
  any frontend, so no existing formula to match — documented inline as
  intentionally simple).
  Wired the one missing piece that would have made the new column just as
  unreachable as `consentLocation` already was: nothing anywhere let a
  donor actually set their location. Extended `donors`' existing
  profile-update DTO/service (`latitude`/`longitude`, validated) rather
  than a new endpoint, and added the one real touchpoint on the client
  side — mobile's onboarding flow's existing "Location" step (which
  already collects city/district) gained a "Share precise location"
  toggle that requests foreground permission and captures a one-time GPS
  fix via `expo-location` (already a dependency since P1-19), off by
  default, donor-toggleable, never silently sampled.
  Noticed but explicitly **not fixed** here (would be gratuitous scope
  creep on a matching-algorithm item): `DonorsService.updateProfile`
  unconditionally resets `verificationStatus` to `REQUIRES_REVIEW` on
  *any* profile field change, including ones with nothing to do with
  blood-type verification (confirmed live — setting only location bumped
  an already-`VERIFIED` donor back to review) — logged as new **P2-17**.
  Verified: 4 new tests for `activateEmergency` (real distance/score
  computed for a consenting donor with a location; null for a
  non-consenting donor; nearest-first ranking with unknown-distance
  donors sorted last; all-null when the emergency itself has no
  location), full suite 327/327 passing (up from 323), clean
  `tsc --noEmit` on both the API and mobile (same 160 pre-existing,
  unrelated errors before/after), 0 new lint warnings, clean `expo
  export` for Android (no device/simulator available in this sandbox,
  same limitation as P1-19). Live end-to-end against the real Postgres +
  running API: set a real donor's location through the real
  `PUT /donors/profile` endpoint, created and activated a real emergency
  near it, and confirmed the resulting `EmergencyMatch` row carried a
  correct real-world `distanceKm` (~0.87 km for the coordinates used) and
  the matching `matchScore` (99) — not nulls, not query-order luck.
  Cleaned up all test data afterward, including reverting the
  `verificationStatus` side effect from P2-17 that the live-verification
  step itself triggered.
  - Files: `apps/api/prisma/schema.prisma` (+ migration),
    `apps/api/src/common/utils/geo.util.ts` (new),
    `apps/api/src/modules/emergency/emergency.service.ts` (+ spec),
    `apps/api/src/modules/donors/dto/update-donor-profile.dto.ts`,
    `apps/api/src/modules/donors/donors.service.ts`,
    `apps/mobile/src/api/donors.ts`,
    `apps/mobile/app/(onboarding)/index.tsx`.

- [x] **P2-7. Courier-assigned/accepted notifications show the wrong text
  (and courier decline never notified anyone at all).** — Fixed: confirmed
  live before fixing — `assignCourier` emits event key `courier_assigned`
  and `acceptShipment` emits `accepted`, but `routeShipmentNotification`'s
  template map only had `created`/`picked_up`/`in_transit`/`arrived`/
  `delivered`/`failed`, so both silently fell back to
  `templates.created` ("Shipment Created" / "A new blood shipment has
  been created") — a courier being assigned a delivery, or a blood
  center learning their courier accepted, both got the same generic
  "shipment was created" text as everyone else, with no way to tell
  which event actually happened. Separately, `declineShipment` never
  called `this.eventEmitter.emit(SHIPMENT_EVENT, ...)` at all — unlike
  every other shipment transition — so a decline updated the DB and the
  live WebSocket feed (for anyone with the page open right now) but
  created zero `Notification` rows; a blood center not actively watching
  the shipment page would never learn a courier declined and the
  delivery needed reassigning.
  Added real `courier_assigned`/`accepted`/`declined` template entries
  (courier-facing text for the first, blood-center-facing for the other
  two, matching each event's actual `recipientIds`), and added the
  missing `declineShipment` emit call — reusing the exact
  `bloodCenterUsers` membership-lookup pattern `acceptShipment` already
  uses for its own recipients, so a decline now reaches the same
  audience an accept does. Bumped `declined` to `HIGH` priority alongside
  `failed`, since both mean "this delivery needs attention now."
  Verified: 10 new tests for `routeShipmentNotification` (every real
  event key produces its own distinct template and never the `created`
  fallback, an actually-unknown key still correctly falls back, `failed`/
  `declined` are both `HIGH` priority) plus 1 new test confirming
  `declineShipment` emits `SHIPMENT_EVENT` with the right recipients,
  full suite 338/338 passing (up from 327), clean `tsc --noEmit`, 0 new
  lint warnings. Live end-to-end against the real Postgres + running
  API: drove a real blood request through approval → shipment creation →
  courier assignment → courier decline, and confirmed the courier
  actually received "New Delivery Assignment" (not "Shipment Created")
  on assignment, and that declining produced seven real `HIGH`-priority
  "Courier Declined Delivery" notifications to blood-center staff — where
  before this fix the decline step would have produced zero. Cleaned up
  all test data (shipment, blood request, notifications, courier status)
  afterward.
  - Files: `apps/api/src/modules/notifications/services/notification-router.service.ts` (+ new spec),
    `apps/api/src/modules/shipments/shipments.service.ts` (+ spec).

- [x] **P2-8. ETA is a hardcoded-speed straight-line estimate** (40km/h
  constant, no routing/traffic) and `getShipmentTracking` returns a
  **literal hardcoded string** `'Available after delivery confirmation'`
  as the blood group regardless of actual contents. — Fixed: confirmed
  both live before fixing — a real in-transit shipment's tracking
  response always showed `bloodGroup: 'Available after delivery
  confirmation'` no matter what units it actually carried, and its ETA
  used a fixed 40km/h regardless of how fast the courier was actually
  moving. Real turn-by-turn routing (traffic, road network) is out of
  reach in this sandbox — no external routing API/key is configured —
  so rather than fake it, made the existing straight-line estimate
  genuinely data-driven: `ShipmentLocation.speed` (GPS-reported speed)
  was already being captured on every location ping but never used for
  anything. `getShipmentTracking` now averages the courier's last 5
  non-null, positive recent speed readings for this shipment and uses
  that average for the ETA instead of the flat constant, falling back to
  the 40km/h default only when there's no usable recent speed data yet.
  The response's `note` field is explicit about which case applies
  ("the courier's own recent average speed" vs. "a default average
  speed") rather than presenting either as a guaranteed number. Found and
  fixed an adjacent real bug while wiring this up: `expo-location`
  reports `position.coords.speed` in meters/second, but the backend (the
  existing `MAX_SPEED_KMH` sanity check in `location.service.ts`, and now
  this new ETA averaging) treats stored `speed` values as km/h — a
  genuine unit mismatch that was silently under-reporting every courier's
  real speed by a factor of ~3.6. Fixed at the source in both mobile
  screens that send it (`sos.tsx`, `(courier)/active.tsx`), converting
  with `* 3.6` before sending. Replaced the hardcoded `bloodGroup` string
  with a new `summarizeUnitBloodGroups` helper that groups the shipment's
  real `ShipmentUnit` → `BloodUnit` records by blood type + Rh factor and
  formats them like `"2 O+, 1 A-"`, or `"No units assigned yet"` when
  none are attached.
  Verified: 4 new tests for `getShipmentTracking` (uses the courier's
  real recent average speed when available, falls back to the default
  when it isn't, summarizes multiple real blood-unit records correctly,
  and reports "No units assigned yet" when none are attached — exact
  expected `etaMinutes` values computed independently via the same
  Haversine formula, not reverse-engineered from rounded output), full
  suite 342/342 passing (up from 338), clean `tsc --noEmit` on both the
  API and mobile (same pre-existing unrelated errors before/after), 0 new
  lint warnings. Live end-to-end against the real Postgres + running API:
  drove a real blood request through approval → shipment creation →
  courier assignment/accept/pickup → in-transit, sent two real location
  pings at 65 and 75 km/h, attached two real `AVAILABLE` `BloodUnit`
  records of different types (B+ and A+) via real `ShipmentUnit`/
  `BloodUnitReservation` rows, and confirmed `GET /shipments/:id/tracking`
  returned `bloodGroup: "1 B+, 1 A+"` (not the hardcoded placeholder) and
  an ETA (`distanceKm: 1.3`, `etaMinutes: 1`) correctly reflecting the
  ~70km/h real average speed with the honest "courier's own recent
  average speed" note. Cleaned up all test data afterward (shipment unit
  and reservation rows, shipment locations/events, the shipment and
  blood request and their items/events, all 26 generated notifications
  and their deliveries, courier status reset to `AVAILABLE`, blood unit
  status reset to `AVAILABLE`).
  - Files: `apps/api/src/modules/shipments/shipments.service.ts` (+ spec),
    `apps/mobile/app/sos.tsx`, `apps/mobile/app/(courier)/active.tsx`.

- [x] **P2-9. Donor registration fabricates a fake HOSPITAL-type org**
  ("DONOR Donors") purely to satisfy a required FK — a data-model smell
  that can confuse any org-scoped analytics/listing logic. — Fixed:
  confirmed the impact live before fixing, and it was real, not just
  cosmetic. Every role grant in this codebase runs through an
  `OrganizationMembership`, and every donor got one pointing at a
  lazily-created org typed `HOSPITAL` and named "DONOR Donors" — so this
  fake org showed up as a real hospital everywhere organizations are
  listed or counted by type: the admin "Manage Organizations" screen
  (with a `staffCount` that would grow to match the total donor count),
  the donor-facing `/organizations/discover?type=HOSPITAL` endpoint used
  to pick a hospital when booking a donation appointment, and the plain
  `/organizations` listing — none of these filtered it out, so a donor
  booking an appointment could see "DONOR Donors" offered as a real
  hospital choice.
  Making `OrganizationMembership.organizationId` nullable (the TODO's
  first suggested option) would have meant a schema migration plus
  auditing every consumer of `membership.organization.*` across the
  codebase for a now-possibly-null relation — high blast radius for a P2
  item. Instead added a third `OrganizationType.SYSTEM` value: a
  singleton placeholder org donor accounts point at, structurally
  identical to before (so every existing "every role needs a membership"
  invariant still holds), but a real, filterable type of its own — so it
  never satisfies a `type: HOSPITAL` or `type: BLOOD_CENTER` check
  anywhere in the codebase without any of those call sites needing to
  change. Also dropped the empty `hospital: { create: {} }` scaffolding
  row this fake org used to create (it was never a real hospital, so
  nothing should ever have modeled it as one). Additionally hardened the
  three listing/search paths that had no type filter at all by default
  (so a `SYSTEM` org would otherwise still leak through unfiltered) to
  always exclude `SYSTEM`, including against an explicit
  `?type=SYSTEM` override: `OrganizationsService.findMany` /
  `.getActiveOrganizations` (the admin listing and donor discovery
  endpoints) and `AdminService.listOrganizations` / its global search.
  Verified: 11 new tests (2 in `auth.service.spec.ts` confirming the
  `SYSTEM` org is looked up/created correctly and never duplicated on a
  second registration; a new `organizations.service.spec.ts` — this
  module previously had zero test coverage — with 6 tests covering the
  default exclusion, the explicit-override-is-ignored case, and that a
  real type filter still works, for both listing methods; 3 more of the
  same shape for `AdminService.listOrganizations`), full suite 353/353
  passing (up from 342), clean `tsc --noEmit`, 0 new lint warnings. Live
  end-to-end against the real Postgres + running API: registered a real
  new donor through the real `POST /auth/register` endpoint and confirmed
  in the database that its membership org was created as
  `type: SYSTEM, name: 'Donor Accounts (System)'` rather than a fake
  `HOSPITAL`; then confirmed as a real super-admin that it was invisible
  in `GET /organizations` (2 real orgs, not 3), `GET
  /organizations/discover?type=HOSPITAL` (1 real hospital, not 2), `GET
  /admin/organizations` (both real orgs shown with correct, un-inflated
  `staffCount`s), and that the admin dashboard's hospital count stayed at
  the correct `1` instead of being inflated. Cleaned up the test donor
  account and the `SYSTEM` org it created afterward.
  - Files: `apps/api/prisma/schema.prisma` (+ migration),
    `apps/api/src/modules/auth/auth.service.ts` (+ spec),
    `apps/api/src/modules/organizations/organizations.service.ts` (+ new
    spec), `apps/api/src/modules/admin/admin.service.ts` (+ spec).

- [x] **P2-10. AI safety filtering is naive hardcoded regex** — trivially
  bypassed by rephrasing; the "no fabricated diagnosis" guarantee rests
  almost entirely on prompt engineering.
  `apps/api/src/modules/ai-health/ai-safety.service.ts:12-151`. — Fixed:
  confirmed two concrete, trivial bypasses before fixing, both structural
  rather than "just needs a few more keywords." (1) Every single pattern
  in the file was written with a literal single space between words
  (`/do i have (cancer|...)/i`), and a regex space only ever matches
  exactly one space character — so `"do  i   have cancer"` (extra
  spaces) or `"diagnose\nme"` (a newline instead of a space) silently
  defeated every pattern in the file, both on the way in and on the way
  out. (2) The disease-name matching — on both the input classifier and
  the output validator — was a fixed list of 9 named conditions
  (cancer/diabetes/anemia/HPV/hepatitis/HIV/STD/STI/chlamydia/
  syphilis/gonorrhea). Since that list can never be complete, "Do I have
  lupus?" or an AI response saying "you likely have COPD" matched
  nothing at all — not a rephrasing trick, just any disease name outside
  those 9.
  Fixed (1) by collapsing whitespace runs to a single space before
  matching, in a new `normalizeForMatching` helper applied to both
  `classifyRequest` and `validateOutput`, rather than rewriting every
  pattern to use `\s+`. Fixed (2) by replacing the fixed disease list
  with a `DIAGNOSIS_TERM` pattern that keeps the short list of
  conditions common enough to name explicitly, but adds two structural
  catches that don't depend on naming every condition individually:
  common medical-term suffixes (`-emia`, `-itis`, `-osis`, `-oma`,
  `-pathy`, `-algia` — covers anemia, hepatitis, thrombosis, carcinoma,
  neuropathy, neuralgia, and most other real condition names) and
  generic diagnosis nouns (disease, disorder, deficiency, infection,
  syndrome — covers "kidney disease", "iron deficiency", "autoimmune
  disorder", etc.). Also added a broad, list-independent output pattern
  for hedged diagnostic phrasing ("is/are consistent with", "indicative
  of", "suggestive of", "characteristic of") — that phrasing is textbook
  clinical diagnosis-speak regardless of what condition follows it, so
  an informational insight has no legitimate reason to ever use it.
  This does not make the filter unbeatable — a sufficiently creative
  rephrasing can still get past a regex, which is exactly why this
  service is one layer among several (the system prompt already
  instructs the model not to diagnose, and the structured-JSON output is
  still validated against this same filter after generation) — but it
  closes the two concrete, mechanical bypasses that existed, rather than
  just adding more words to a list that was always going to be
  incomplete.
  Verified: 6 new tests (the exact whitespace-bypass strings above,
  confirmed classified `SAFE_INFORMATIONAL` before the fix's git history
  and `OUT_OF_SCOPE`/rejected after; six conditions outside the old
  9-item list — lupus, COPD, kidney disease, an unnamed "autoimmune
  disorder", leukemia, hepatitis-via-"positive for" — now all correctly
  caught on both input and output; the new hedged-phrasing pattern
  tested independent of any specific condition name), full suite
  359/359 passing (up from 353), clean `tsc --noEmit`, 0 new lint
  warnings. Live end-to-end against the real running API (temporarily
  flipping the sandbox's `AI_ENABLED` flag on for this since it defaults
  off, then reverting it — the platform-settings toggle for this feature
  was already on): this sandbox has no configured OpenAI key, so the
  actual AI provider call always fails over to a deterministic fallback
  provider that returns the same canned text regardless of what prompt
  it's given — meaning the HTTP response body alone can't distinguish
  "the safety filter correctly blocked this" from "it didn't." Instead
  verified the real, distinguishing signal in the actual controller →
  service call chain: `GenerateInsightDto` requests classified
  `OUT_OF_SCOPE` take an early-return short-circuit path with no further
  validation, while `SAFE_INFORMATIONAL` requests fall through to
  type-specific business logic that has its own requirements (e.g.
  `GENERAL_HEALTH_INFORMATION` requires a `parameterCode`). Confirmed a
  real, safe control question ("What does hemoglobin measure?", no
  `parameterCode`) correctly reached that deeper validation and got
  `403 Parameter code is required for general information`, while both
  real bypass-attempt questions ("do  i   have cancer" and "Do I have
  lupus?") correctly short-circuited to a clean `200` with no such
  error — proving `classifyRequest` is wired into the real request path
  and now catches what it previously missed. Cleaned up the 3
  `AIRequestLog` rows the live verification calls generated afterward.
  - Files: `apps/api/src/modules/ai-health/ai-safety.service.ts` (+
    spec).

- [x] **P2-11. Donation & lab reference numbers use unguarded `Math.random()`**
  with no uniqueness retry loop — low-probability but real collision →
  raw DB constraint 500 instead of a clean retry.
  `apps/api/src/modules/donations/donations.service.ts:44,50`,
  `apps/api/src/modules/laboratory/laboratory.service.ts:243`. — Fixed:
  the exact same `Math.random() * 999999` pattern generating a reference
  number with no collision handling turned out to be duplicated in 6
  files, not 2 — `shipments.service.ts` (request/shipment references),
  `emergency.service.ts` (emergency/donation/unit references, the latter
  two literally the same format string as `donations.service.ts`'s
  generators, doubling the real collision space for those two shared
  tables), and `appointments.service.ts` (donation-appointment
  references), on top of the two named here. Since the underlying defect
  — "no retry loop" — is identical in all of them and the fix is
  mechanical, fixed all 8 live call sites rather than leaving 6 of them
  with the same known bug (left `inventory.service.ts`'s
  `generateUnitReference` alone — confirmed it's dead code, never called
  anywhere, so not a live bug).
  Added a shared `withUniqueRetry` utility
  (`apps/api/src/common/utils/unique-retry.util.ts`) that retries an
  operation up to 5 times specifically on a Prisma P2002 unique-constraint
  violation naming one of a caller-declared set of fields, rethrowing
  immediately for any other error (including a P2002 on an unrelated
  field, so a genuine business-rule conflict inside the same transaction
  fails fast instead of retrying pointlessly). Every call site wraps its
  whole `$transaction(...)` call — not just the inner `create` — since
  Prisma transactions roll back atomically on failure, so retrying the
  entire closure from scratch is always safe: it recomputes the reference
  number fresh (two sites, `appointments.service.ts` and
  `laboratory.service.ts`, generated the reference number *before* the
  transaction, which would have handed every retry the exact same
  doomed value — moved the generation inside the retried closure) and
  never produces duplicate side effects, since the failed attempt's
  writes were fully undone by Postgres.
  Verified: `unique-retry.util.spec.ts` (7 tests) exhaustively covers the
  utility itself — succeeds on the first try, retries and succeeds on a
  tracked-field collision (including when Postgres reports the violated
  column as a raw constraint-name string rather than an array, which
  happens on some drivers), does not retry an untracked field or a
  non-P2002 error, gives up after `maxAttempts`. Then, per service,
  proved the *wiring* is correct with a test that makes the mocked
  `$transaction` throw a real `Prisma.PrismaClientKnownRequestError`
  (P2002) once and succeed on the second call, asserting the operation
  transparently returns the successful result: 2 new tests in
  `donations.service.spec.ts` (donationReference, unitReference), 1 each
  in `laboratory.service.spec.ts`, `appointments.service.spec.ts`,
  `emergency.service.spec.ts` (covering both `completeEmergency`'s
  donationReference/unitReference and `createEmergency`'s
  emergencyReference), and 2 in `shipments.service.spec.ts`
  (requestReference, shipmentReference) — 9 new tests total, full suite
  375/375 passing (up from 366), clean `tsc --noEmit`, 0 new lint errors
  (20 new warnings, all `@typescript-eslint/no-explicit-any` on new
  `prisma: any`/`tx: any` test-double variables, matching every existing
  mock in these same spec files). A real forced collision can't be
  demonstrated live (it's a 1-in-999999 event by construction — the only
  way to make one happen on demand is to control the RNG, which is
  exactly what the mocked tests above do; that's the legitimate way to
  verify collision-handling logic, not a shortcut around live
  verification). Instead live-verified the refactor didn't break the
  ordinary (zero-collision) path it wraps: booked a real donation
  appointment through the real `POST /appointments` endpoint against the
  real Postgres + running API and confirmed it succeeded on the first
  `$transaction` attempt with a real `DON-2026-858417` reference, exactly
  as before the refactor. Cleaned up the test appointment, its slot
  booking count, and its audit log row afterward.
  - Files: `apps/api/src/common/utils/unique-retry.util.ts` (new, + spec),
    `apps/api/src/modules/donations/donations.service.ts` (+ spec),
    `apps/api/src/modules/laboratory/laboratory.service.ts` (+ spec),
    `apps/api/src/modules/appointments/appointments.service.ts` (+ spec),
    `apps/api/src/modules/emergency/emergency.service.ts` (+ spec),
    `apps/api/src/modules/shipments/shipments.service.ts` (+ spec).

- [x] **P2-12. Cancelled/no-show lab appointments never reset slot status**
  back to `AVAILABLE` (only `bookedCount` is decremented) — unlike the
  donation-appointment flow, which does this correctly. A `FULL` lab slot
  stays permanently unbookable after a cancellation.
  `apps/api/src/modules/laboratory/laboratory.service.ts:1037-1116`. —
  Fixed: confirmed live before fixing (see below) — both
  `cancelAppointment` and `markNoShow` decremented `AppointmentSlot.
  bookedCount` but never re-checked `status`, so a slot that had
  flipped to `FULL` stayed `FULL` forever after the cancellation/no-show
  that freed the seat, even though `bookedCount` correctly showed room
  again. Mirrored the exact fix `appointments.service.ts`'s
  `cancelAppointment` already uses for the donation-appointment flow: in
  the same transaction, after decrementing, re-fetch the slot and flip
  it back to `AVAILABLE` if it's `FULL` and now has room
  (`bookedCount < capacity`). Applied to both `cancelAppointment` and
  `markNoShow` (the donation-appointment flow has no no-show equivalent
  to compare against, but it's the identical `AppointmentSlot` bug either
  way). Checked for a lab-appointment reschedule flow that might have the
  same gap — there isn't one; lab appointments can't be rescheduled at
  all in this codebase, only cancelled.
  Verified: 8 new tests (`cancelAppointment`: resets a `FULL` slot with
  room, leaves a non-`FULL` slot untouched, rejects an already-cancelled
  appointment, rejects cancelling within the 2-hour window;
  `markNoShow`: same FULL-reset and untouched-when-not-FULL cases, rejects
  a `COMPLETED` appointment), full suite 382/382 passing (up from 375),
  clean `tsc --noEmit`, 0 new lint errors. Live end-to-end against the
  real Postgres + running API: temporarily set a real, empty slot's
  capacity to 1, booked it as a real donor through the real
  `POST /laboratory-appointments` endpoint and confirmed it flipped to a
  real `FULL` status, cancelled it through the real
  `POST /me/laboratory-appointments/:id/cancel` endpoint and confirmed
  the slot flipped back to `AVAILABLE` (not just that `bookedCount` hit
  0) — then proved the fix wasn't cosmetic by successfully booking a
  second real appointment on that same slot, which would have failed
  with "Slot is not available" before this fix. Cleaned up both test
  appointments, their audit log rows, and restored the slot's original
  capacity/status afterward.
  - Files: `apps/api/src/modules/laboratory/laboratory.service.ts`
    (+ spec).

- [x] **P2-13. Notification "archive" is unreachable** — the
  `NotificationStatus.ARCHIVED` enum value exists but no service method or
  endpoint ever sets it; only hard delete exists. — Fixed: this was a
  real, concrete gap, not just an unused enum value. `NotificationsService
  .delete` already explicitly refuses to hard-delete any notification
  whose `sourceType` is `LAB_RESULT`, `DONATION`, or `APPOINTMENT`
  ("Cannot delete notifications linked to medical records") — and
  confirmed live that a donor's own real `DONATION`-sourced notification
  hits exactly that block. With no archive capability, those
  notification types had *no way out* of a user's active inbox at all,
  forever.
  Added `archive`/`unarchive` service methods and matching
  `PATCH :id/archive` / `PATCH :id/unarchive` endpoints, mirroring the
  existing `markAsRead`/`markAsUnread` pair's shape and idempotency
  (`archive` no-ops if already `ARCHIVED`; `unarchive` no-ops if not
  currently `ARCHIVED`, and otherwise reverts to `READ` or `SENT`
  depending on whether `readAt` was already set — there's no status
  history to restore to, so this mirrors `markAsUnread`'s existing
  "revert to SENT" convention for the read/unread pair). Made
  `findAll` exclude `ARCHIVED` notifications by default — otherwise
  archiving would have set a flag nothing ever looked at, since the
  existing filter logic showed every status unless the caller asked
  otherwise — while still showing them when the caller explicitly
  filters `?status=ARCHIVED` (the archive should be reachable, not
  hidden entirely). Also excluded `ARCHIVED` from `getUnreadCount` and
  all three of `getStats`' metrics, since a badge/summary still counting
  notifications the user explicitly archived would undermine the whole
  point of archiving. Added the client wrapper functions
  (`archiveNotification`/`unarchiveNotification`) to the mobile API
  layer so the endpoints are actually callable from the app, though no
  UI currently calls them — there's no existing archive button/swipe
  action anywhere in the app to wire up (unlike some earlier items, this
  wasn't reconnecting dead frontend scaffolding; the mobile-web UI
  layer for this is new product surface outside this fix's scope).
  Verified: 12 new tests in a new `notifications.service.spec.ts` (this
  service had zero prior coverage) covering the default exclusion, the
  explicit-filter-shows-it case, a real non-archive status filter still
  works, `getUnreadCount`/`getStats` exclusion, `archive`'s idempotency
  and ownership check, and `unarchive`'s read-vs-unread revert logic and
  its own idempotency, full suite 394/394 passing (up from 382), clean
  `tsc --noEmit` on both the API and mobile (160 pre-existing, unrelated
  mobile errors, same as always), 0 new lint errors. Live end-to-end
  against the real Postgres + running API: confirmed a real existing
  `DONATION`-sourced notification for the seeded donor really is
  delete-blocked (`403 Cannot delete notifications linked to medical
  records`), archived it through the real endpoint, confirmed it
  disappeared from the default `GET /notifications` list, `stats`
  (1/1 → 0/0), and `unread-count` (1 → 0), reappeared under
  `?status=ARCHIVED`, and correctly came back via unarchive with stats
  restored to 1/1. Restored the notification's exact original state
  (`status: PENDING`, original `updatedAt`) afterward via direct SQL
  since it was pre-existing seed data, not something created for this
  test.
  - Files: `apps/api/src/modules/notifications/services/notifications.service.ts`
    (+ new spec), `apps/api/src/modules/notifications/notifications.controller.ts`,
    `apps/mobile/src/api/notifications.ts`.

- [x] **P2-14. Duplicate, unreachable `confirmDelivery` method** sitting
  alongside the real `confirmDeliveryFull` — dead code with an unchecked
  `verificationCode` parameter that looks like a half-finished feature.
  `apps/api/src/modules/shipments/shipments.service.ts:1244-1393`. —
  Fixed: confirmed dead before removing — the controller's
  `POST .../confirm-delivery` route calls `confirmDeliveryFull`
  directly, and grepping the whole `apps/api/src` tree for
  `.confirmDelivery(` turned up only the method's own now-removed unit
  tests, nothing in any controller, gateway, or cron. `confirmDelivery`
  was also strictly inferior to `confirmDeliveryFull`, missing the
  partial-delivery/discrepancy handling, the `RESERVED`/`DISCREPANCY`
  unit-status split, and the `PARTIALLY_DELIVERED` request status — an
  older, abandoned implementation left behind rather than a real
  alternative code path. Deleted it outright (157 lines) along with its
  two dead tests, and removed a stale comment on `confirmDeliveryFull`
  that referenced it by name (the comment was documenting a previous fix
  to this exact code — the "delivered" notifications not firing — whose
  point was already made moot by this removal).
  While here, noticed `confirmDeliveryFull`'s own discrepancy/partial-
  delivery branches (the actual reason it supersedes the deleted method)
  had zero test coverage — only the full-delivery and race-condition
  cases were tested. Added 3 tests: rejects `unitsReceived` greater than
  what shipped, requires a `discrepancyReason` when units fall short,
  and correctly marks the shortfall units `DISCREPANCY` /
  `bloodRequest.status: PARTIALLY_DELIVERED` when a reason is given.
  Verified: full suite 395/395 passing (net +1: −2 dead tests, +3 new),
  clean `tsc --noEmit`, 0 new lint warnings. Live end-to-end against the
  real Postgres + running API: drove a real blood request through
  approve → ready-for-pickup → create-shipment → assign → accept →
  pickup → in-transit → arrive → `confirm-delivery`, confirming the
  surviving `confirmDeliveryFull` still resolves and executes correctly
  after the dead sibling's removal — the real blood unit transferred to
  the hospital's inventory (`AVAILABLE`, reassigned `organizationId`)
  and the blood request reached `DELIVERED`. (The discrepancy branch
  itself isn't independently live-testable with the seed data as-is —
  the blood center only has one `AVAILABLE` unit per blood type, not
  enough for a real 2-unit partial-delivery scenario — so that logic's
  live-fidelity rests on the 3 new precise unit tests instead, which is
  the legitimate way to verify a conditional branch deterministically.)
  While assembling this end-to-end flow, discovered a real, separate,
  system-critical bug in `approveRequest`/`createShipment` (every real
  shipment ships with zero recorded units) — logged as new **P2-18**
  rather than folded into this fix, and worked around it for this
  verification the same way P2-8 did (attaching a `ShipmentUnit` row
  directly).
  - Files: `apps/api/src/modules/shipments/shipments.service.ts` (+ spec).

- [x] **P2-15. `POST .../laboratory-results` can never succeed for anyone
  (found while verifying P2-2)** — the route
  `organizations/:organizationId/laboratory-results` has no
  `:appointmentId` segment, but the handler reads
  `@Param('appointmentId')`, which is therefore always `undefined`
  regardless of what's sent; `LaboratoryService.createResult` then
  always fails to find a matching appointment. Not a role/permission
  issue — every role that can reach this route hits the same bug.
  Needs either an `:appointmentId` path segment added to the route (to
  match every other lab-appointment-scoped route's shape) or the DTO
  changed to carry `appointmentId` in the body instead, whichever this
  module's convention should be for a *result*, which isn't itself
  keyed by appointment the way `confirm`/`check-in`/`start`/`complete`
  are. — Fixed, and it's a more dangerous bug than "can never succeed":
  confirmed live that `appointmentId: undefined` does **not** make the
  Prisma `findFirst({ where: { id: appointmentId, ... } })` call match
  nothing — Prisma silently *omits* an `undefined` filter field from the
  query rather than treating it as "match null," so the call actually
  returns an arbitrary `BLOOD_TEST` appointment for the organization
  (whichever the DB happens to return first). With more than one
  in-flight lab appointment at an organization, this endpoint could
  silently attach a real donor's test result to a *different* donor's
  appointment instead of failing — a real patient-safety-adjacent data
  bug, not just a broken endpoint. It only looked like "can never
  succeed" in a dev DB with exactly one `BLOOD_TEST` appointment total.
  Confirmed the fix direction wasn't ambiguous: `blood-center-web`'s
  existing `createLaboratoryResult` client (`apps/blood-center-web/lib/
  laboratory.ts:251-268`) already sends `body: JSON.stringify({
  appointmentId, ...data })` — the frontend was built correctly for the
  body-based design; only the backend had the mismatch. Moved
  `appointmentId` from `@Param()` into the DTO body (alongside the
  existing `testTypeId`), matching how this same route already treats a
  *result* as its own resource keyed by `resultId`, not by appointment,
  everywhere else (`GET/:resultId`, `POST /:resultId/review`,
  `POST /:resultId/publish`). Also hardened `LaboratoryService
  .createResult` itself with an explicit `if (!appointmentId) throw
  BadRequestException(...)` guard before the Prisma call, so the
  underlying "undefined filter is silently omitted" pitfall can't bite
  again here even if a future caller (or a client bug) omits the field
  — fails loudly instead of matching an arbitrary record.
  Had a general-purpose audit agent sweep all 24 API controllers (264
  routes, 199 `@Param()` uses) for the same route/param-mismatch
  pattern; verified against this exact bug as ground truth (correctly
  flagged the pre-fix code), then confirmed zero other instances exist
  in the current codebase — this was an isolated bug, not a systemic
  pattern.
  Verified: 6 new tests in a new `LaboratoryService.createResult`
  describe block (successful creation with a real id; rejects a missing
  `appointmentId` *without ever querying the DB*, which is the actual
  regression guard for the dangerous behavior above; rejects an
  empty-string id the same way; 404s for a genuinely nonexistent
  appointment; rejects when the appointment isn't `RESULT_PENDING`;
  rejects when a result already exists), full suite 401/401 passing (up
  from 395), clean `tsc --noEmit`, 0 new lint errors. Live end-to-end
  against the real Postgres + running API: confirmed the missing-id case
  now correctly returns `400 appointmentId is required` instead of
  silently matching whatever appointment Prisma happened to return; then
  booked a real fresh lab appointment, drove it through
  confirm → check-in → start → complete to `RESULT_PENDING`, and
  confirmed `POST .../laboratory-results` with a real `appointmentId` in
  the body correctly created a result linked to *that exact*
  appointment. Cleaned up the test appointment, its result and history,
  slot booking count, and audit log rows afterward — including reverting
  an accidental status advance on the real seeded lab appointment I
  first tried this against (it already had a genuine `PUBLISHED` result
  from seed data, which is exactly the "already exists" rejection
  correctly firing, not a bug).
  - Files: `apps/api/src/modules/laboratory/laboratory.controller.ts`,
    `apps/api/src/modules/laboratory/laboratory.service.ts` (+ spec).
  `apps/api/src/modules/laboratory/laboratory.controller.ts:249-273`.

- [x] **P2-16. Two complete, independent modules both implement
  notification preferences (found while verifying P2-4)** —
  `apps/api/src/modules/notification-preferences/` (small, standalone)
  and `apps/api/src/modules/notifications/` (the larger combined
  notifications module) both register a controller at
  `@Controller('notifications')` with `@Get('preferences')`/
  `@Patch('preferences')`. Both are imported in `app.module.ts`, but
  since `NotificationPreferencesModule` is imported first, its
  controller wins the route registration and the other module's
  `getPreferences`/`updatePreferences` handlers are permanently
  unreachable dead code — confirmed live, and confirmed (via a full
  audit of every controller's registered paths) to be the *only* such
  collision in the API. Not a currently-live user-facing bug: both
  services read/write the same `NotificationPreference` table, so data
  stays consistent regardless of which one answers a request, and the
  `notifications` module's own `NotificationPreferenceService` still
  does real work elsewhere (`isInQuietHours`/`shouldEmergencyOverride`/
  `isChannelEnabled` are used by the real delivery pipeline in
  `notification-delivery.service.ts`) — but it's a correctness trap
  waiting to happen: reordering `app.module.ts`'s imports, or anyone
  editing the "obviously right" file without knowing about the other
  one (as P2-4's fix nearly did), silently changes live behavior with
  no compiler or test signal. Needs a decision on which module is
  canonical (the larger `notifications` module, given its service has
  the load-bearing quiet-hours/channel logic, looks like the intended
  survivor) and the other's controller/route deleted, with its DTO's
  validation (already fixed in P2-4) merged in if not already equivalent.
  `apps/api/src/modules/notification-preferences/`,
  `apps/api/src/modules/notifications/notifications.controller.ts:105-116`,
  `apps/api/src/app.module.ts`. — Fixed: went with `notifications` as
  the canonical survivor per the TODO's own analysis (its service is the
  one with load-bearing quiet-hours/channel logic used by the real
  delivery pipeline). Deleted `notification-preferences/` entirely
  (controller, service, module, DTO — confirmed via grep it was
  referenced nowhere outside its own files except `app.module.ts`'s
  registration) and removed its `app.module.ts` import/registration.
  Its DTO validation was already byte-for-byte identical to the
  survivor's (same fields, same decorators, same regex — P2-4's fix had
  already brought them to parity), so no merge was needed there.
  Two real behavioral gaps would have opened up if I'd stopped at
  deletion, both closed before calling this done:
  (1) **Lost audit logging.** The dead module's `updatePreferences`
  audit-logged every change (`NOTIFICATION_PREFERENCES_UPDATED`); the
  survivor's never did. Since the dead module was the one actually
  answering live traffic, deleting it would have silently *removed* an
  existing audit trail rather than just relocating it. Added the same
  audit call (and the `ipAddress` plumbing to carry it) to the survivor.
  (2) **Response-shape mismatch nothing had caught.** The dead module
  wrapped its response in `{ data: {...} }` (matching this API's
  near-universal envelope convention and exactly what the mobile
  client's `apiRequest` helper unwraps via `json.data`); the survivor
  returned the preferences object flat, with no wrapper. Confirmed the
  mobile client's own `NotificationPreferences` TypeScript interface and
  `useNotificationPreferences()` hook were already written expecting the
  wrapped, full-field (`userId`/`createdAt`/`updatedAt` included) shape —
  i.e. the mobile code was written for the survivor's fields but the
  dead module's wrapping, and neither matched what was actually live.
  Nothing renders this today (no screen calls the hook yet), so it
  wasn't a visible bug, but consolidating onto a shape the client
  couldn't actually consume would have been trading a reachability bug
  for a silent-`undefined` one. Wrapped the survivor's two controller
  responses in `{ data: ... }` to match.
  While live-verifying, found and fixed a *third*, newly-surfaced
  problem: `notifications.controller.ts`'s own `@Get(':id')` was
  registered before its `@Get('preferences')`, so — now that this
  controller's routes were finally reachable instead of being shadowed
  by the whole other module — `GET /notifications/preferences` matched
  `findOne('preferences')` first and 404'd. This exact bug had been
  sitting latent and untested in the file the entire time the dead
  module was winning; deleting the dead module is what finally exposed
  it. Moved `@Get('preferences')` above `@Get(':id')`.
  Verified: 11 new tests in a new `notification-preference.service.spec.ts`
  (this service had zero prior coverage) covering `getPreferences`
  create-on-first-access, `updatePreferences` create-vs-update branches
  and its new audit log call, `isChannelEnabled`'s category mapping and
  unknown-category default, and `isInQuietHours`'s overnight/same-day
  window math at fixed, mocked UTC timestamps. Full suite 412/412
  passing (up from 401), clean `tsc --noEmit`, 0 new lint errors, and a
  clean app boot with no module-resolution errors after the deletion.
  Live end-to-end against the real Postgres + running API: confirmed
  `GET /notifications/preferences` first hit the exact 404 the stale
  route ordering predicted, fixed it, then confirmed the endpoint
  returns the correct `{ data: {...} }` shape (with the previously
  dead-module-only fields `userId`/`createdAt`/`updatedAt` now present),
  that `PATCH /notifications/preferences` updates a real preference and
  produces a real `NOTIFICATION_PREFERENCES_UPDATED` audit log row where
  before this fix's audit-logging addition it would have produced none.
  Reverted the test preference change and deleted the test-generated
  audit row afterward.
  - Files: `apps/api/src/app.module.ts`,
    `apps/api/src/modules/notifications/notifications.controller.ts`,
    `apps/api/src/modules/notifications/services/notification-preference.service.ts`
    (+ new spec); deleted `apps/api/src/modules/notification-preferences/`.

- [x] **P2-17. Any donor profile update resets `verificationStatus` to
  `REQUIRES_REVIEW` (found while verifying P2-6)** — `DonorsService.
  updateProfile` unconditionally sets `verificationStatus:
  VerificationStatus.REQUIRES_REVIEW` on every `PUT /donors/profile`
  call, regardless of which fields actually changed. Confirmed live: a
  donor updating only their location (or city, or date of birth) knocks
  an already-`VERIFIED` blood type back to needing re-review, even though
  none of those fields have anything to do with blood-type verification.
  Should only reset verification when `bloodType`/`rhFactor` are actually
  part of the update (and arguably only when they *change*, not just
  appear in the payload with the same value).
  `apps/api/src/modules/donors/donors.service.ts:90-96`. — Fixed exactly
  as scoped: `updateProfile` now only resets `verificationStatus` to
  `REQUIRES_REVIEW` when `bloodType` or `rhFactor` is present in the
  update *and* actually differs from the profile's current stored value
  — comparing against the real `DonorProfile` row fetched at the top of
  the method, not just checking whether the field was included in the
  payload. Left `bloodTypeVerifiedAt`/`bloodTypeVerifiedBy`/
  `bloodTypeSource`/`bloodTypeNote` untouched either way: those are a
  historical record of who verified the value being replaced, written
  by the separate staff-facing `verifyBloodType` method, and clearing
  them wasn't part of what this item asked for.
  Verified: 7 new tests in a new `donors.service.spec.ts` (this module
  had zero prior coverage) — unrelated-field updates (city, location)
  leave verification untouched; resubmitting the same `bloodType`/
  `rhFactor` value leaves it untouched; a real change to either field
  resets it; a blood-type change bundled with an unrelated field change
  in the same request still resets it; a missing profile still 404s —
  full suite 419/419 passing (up from 412), clean `tsc --noEmit`, 0 new
  lint errors. Live end-to-end against the real Postgres + running API,
  using the real seeded donor's genuinely `VERIFIED` O+ profile: updating
  only `city` left `verificationStatus: VERIFIED`; resubmitting the same
  `bloodType`/`rhFactor` left it `VERIFIED`; changing `bloodType` to a
  different real value correctly flipped it to `REQUIRES_REVIEW`.
  Restored the donor's original blood type, city, verification status,
  and `updatedAt`, and deleted the 3 test-generated audit log rows
  afterward.
  - Files: `apps/api/src/modules/donors/donors.service.ts` (+ new spec).

- [x] **P2-18. `ShipmentsService.approveRequest` claims a `BloodUnit`
  and its reservation but never links the reservation to the
  `BloodRequestItem` it was approved for (found while live-verifying
  P2-14)** — `createShipment` later reads exactly that link
  (`item.reservations`, via the implicit `BloodRequestItem` ↔
  `BloodUnitReservation` many-to-many) to decide which reservations to
  turn into `ShipmentUnit` rows. Since `approveRequest` never populates
  that relation, every shipment created through the real
  approve → ready-for-pickup → create-shipment flow gets **zero**
  `ShipmentUnit` rows attached, regardless of how many units were
  approved and reserved. Confirmed live: a real blood request approved
  for 1 real available unit, then shipped, produced a shipment whose
  `units` array was empty — `confirm-delivery` then failed outright
  ("Cannot receive more units than shipped (0)"), and (per P2-8's
  write-up) `getShipmentTracking`'s `bloodGroup` field would show "No
  units assigned yet" for the exact same reason. This is a live,
  system-critical gap in the blood-center → hospital fulfillment
  pipeline, not a cosmetic one — every real shipment following this path
  today ships with no recorded contents and can't be delivered without
  first being patched up out-of-band. Likely fix: have `approveRequest`
  connect each claimed reservation to `approval.itemId` (e.g.
  `tx.bloodRequestItem.update({ where: { id: approval.itemId }, data: {
  reservations: { connect: { id: reservation.id } } } })`) inside the
  same loop that already claims the unit.
  `apps/api/src/modules/shipments/shipments.service.ts:282-354` (the
  claim loop), `apps/api/src/modules/shipments/shipments.service.ts:463-530`
  (`createShipment`'s `item.reservations` read). — Fixed exactly as
  suggested: added `bloodRequestItems: { connect: { id: approval.itemId } }`
  to the existing `tx.bloodUnitReservation.update` call inside the claim
  loop (merged into the same update that already sets
  `reservedForOrganizationId`/`reason`, rather than a separate call).
  Only runs when the atomic unit-claim actually succeeded (the existing
  `if (count === 0) continue;` guard already skips a reservation whose
  unit lost the race, so a lost race correctly never gets linked either).
  While live-verifying, went one level deeper and found the fix's own
  precondition — an `ACTIVE` `BloodUnitReservation` whose `BloodUnit` is
  still `AVAILABLE` — **never actually occurs through any real code
  path**: the only place a `BloodUnitReservation` gets created at all
  (`InventoryService.reserveUnit`) atomically flips the unit to
  `RESERVED` in the same transaction, and `releaseReservation` moves
  both back to `AVAILABLE`/`RELEASED` together — so `approveRequest`'s
  `bloodUnit: { status: 'AVAILABLE' }` filter can never match a real
  reservation; the seed script doesn't create any reservations either.
  This means today's fix is verified-correct for the exact scenario
  it's designed for, but `approveRequest` still can't select real
  inventory completely unassisted until that upstream selection gap is
  closed too — logged as new **P2-19** rather than folding a larger
  unit-selection redesign into this link-only fix.
  Verified: 4 new tests in a new `ShipmentsService.approveRequest`
  describe block (this method had zero prior coverage) — links a
  successfully-claimed reservation to its request item; claims the
  underlying unit as `RESERVED`; does *not* link a reservation whose
  unit claim lost the race; rejects approving a request that isn't
  `SUBMITTED`/`UNDER_REVIEW` — full suite 423/423 passing (up from 419),
  clean `tsc --noEmit`, 0 new lint errors. Live end-to-end against the
  real Postgres + running API (necessarily seeding one reservation
  directly, per the P2-19 finding above, since no real endpoint produces
  one): approved a real blood request for a real available B+ unit,
  confirmed the many-to-many join row was created linking the exact
  request item to the exact reservation, then created a real shipment
  and confirmed — with **zero manual intervention this time**, unlike
  P2-14's workaround — a real `ShipmentUnit` row was attached
  automatically, and `GET /shipments/:id/tracking` correctly reported
  `"bloodGroup": "1 B+"` instead of "No units assigned yet." Cleaned up
  the shipment, its unit/events, the blood request and its item/events,
  the reservation and its join-table row, generated notifications, and
  audit log rows afterward, and restored the blood unit to `AVAILABLE`.
  - Files: `apps/api/src/modules/shipments/shipments.service.ts` (+ spec).

- [x] **P2-19. `approveRequest` can never actually find a real reservation
  to claim (found while live-verifying P2-18)** — its query requires an
  `ACTIVE` `BloodUnitReservation` whose linked `BloodUnit` is still
  `AVAILABLE`, but that combination never arises from any real code
  path: `InventoryService.reserveUnit` (the only place a
  `BloodUnitReservation` is ever created) atomically sets the unit to
  `RESERVED` in the same transaction it creates the reservation, and
  `releaseReservation` moves the unit back to `AVAILABLE` and the
  reservation to `RELEASED` together. So a unit is either
  `AVAILABLE`-with-no-reservation or `RESERVED`-with-an-`ACTIVE`-
  reservation — never the `AVAILABLE`-with-`ACTIVE`-reservation state
  `approveRequest` searches for. P2-18's fix (linking a found
  reservation to its request item) is correct but can't help if nothing
  is ever found: as things stand, `approveRequest`'s reservation-search
  branch returns empty for every real submitted request, so no request
  ever gets real units attached without someone manually seeding a
  reservation via direct DB access first. Likely fix: stop searching for
  a pre-existing "active reservation on an available unit" and instead
  have `approveRequest` select `AVAILABLE` `BloodUnit`s of the matching
  type directly, atomically claim each one (`AVAILABLE` → `RESERVED`,
  as it already does), and *create* a new `BloodUnitReservation` for it
  right there (linked to the request item), rather than updating one
  that was supposed to already exist.
  `apps/api/src/modules/shipments/shipments.service.ts:319-334`
  (the query), `apps/api/src/modules/inventory/inventory.service.ts:601-660`
  (`reserveUnit`, the only reservation-creation path, showing why the
  precondition never holds). — Fixed exactly as diagnosed: replaced the
  dead-on-arrival reservation search with a direct `bloodUnit.findMany`
  for `AVAILABLE` units of the request item's blood type/Rh, ordered
  oldest-collected-first (standard FIFO inventory rotation — the
  original code's `reservedAt: 'asc'` ordering had no real equivalent
  since there's no longer a pre-existing reservation to order by).
  For each unit whose atomic `AVAILABLE`→`RESERVED` claim succeeds (the
  same race-safe `updateMany` pattern as before, unchanged), *creates* a
  new `BloodUnitReservation` — mirroring `reserveUnit`'s own shape
  exactly (`reservedBy`, `reservedForOrganizationId`, `reason`, plus a
  matching `InventoryMovement` row of type `RESERVED` that `reserveUnit`
  also writes, so approval-driven reservations show up in inventory
  history the same way manually-reserved ones do) — linked to the
  request item via the same `bloodRequestItems: { connect }` relation
  P2-18 added.
  Verified: rewrote the `ShipmentsService.approveRequest` describe block
  (5 tests) to match the new selection query, the reservation *create*
  call (previously an *update*), the linked `InventoryMovement`, and
  that a lost unit-claim race still correctly skips both the reservation
  and the movement record — full suite 424/424 passing (up from 423),
  clean `tsc --noEmit`, 0 new lint errors. Live end-to-end against the
  real Postgres + running API, this time with **zero manual database
  seeding at any step** (unlike P2-14's and P2-18's workarounds):
  approved a real blood request for a real available A+ unit and
  confirmed, entirely through real endpoints, that a real
  `BloodUnitReservation` was created (correct `reservedBy`/
  `reservedForOrganizationId`), correctly linked to the request item via
  the join table, the unit flipped to `RESERVED`, and a real
  `InventoryMovement` row was written — then created a real shipment and
  confirmed `GET /shipments/:id/tracking` reported `"bloodGroup": "1 A+"`
  automatically. This closes the fulfillment pipeline gap completely:
  approve → ready-for-pickup → create-shipment → deliver now works
  unassisted end-to-end for the first time this session traced it.
  Cleaned up the shipment, request, reservation, movement record, join
  row, notifications, and audit log rows afterward, restoring the unit
  to `AVAILABLE`.
  - Files: `apps/api/src/modules/shipments/shipments.service.ts` (+ spec).

---

## 🔵 P3 — Hygiene, tests, docs, infra

- [x] **P3-1. 26 of 30 backend modules have zero automated tests**,
  including the core money/medical/safety paths: donations, inventory,
  shipments, emergency, laboratory, admin. Only auth, health,
  health-trends, and part of ai-health have specs. Prioritize tests for
  the P0/P1 areas above as you fix them (write the regression test with
  the fix, not after). — Fixed (partial installment, 3 of 14 remaining
  zero-coverage modules; see below for what's still outstanding):
  Re-measured actual coverage before touching anything, since the
  original "26 of 30" diagnosis was stale — nearly every P0/P1/P2 fix
  this session added `.spec.ts` coverage for the module it touched as a
  side effect of "write the regression test with the fix." Current state
  is 21 of 32 backend modules covered, 11 still at zero: `analytics`,
  `campaigns`, `community`, `courier`, `education`, `email`,
  `appointment-slots`, `users`, `ai-cache`, `ai-history`, `ai-logging`.
  This installment picked the 3 smallest, most foundational,
  highest-leverage modules from that zero-coverage set — `audit-logs`
  (33 lines), `permissions` (43 lines), `platform-settings` (66 lines) —
  because nearly every other service in the codebase depends on them
  indirectly (the global `PermissionsGuard` is backed by
  `PermissionsService`; almost every state-changing action across every
  module writes through `AuditLogsService`; `PlatformSettingsService`
  gates AI health, SOS emergency, gamification, push notifications, and
  the auth maintenance-mode/session-timeout paths), yet none had a single
  direct test before this. Added 25 new test cases across 3 new spec
  files (5 for `audit-logs` — field pass-through, `metadata` defaulting,
  optional-field-as-`undefined` passthrough, return-shape narrowing,
  write-failure propagation; 11 for `permissions` — ACTIVE-only
  membership filtering, single-role grants, cross-membership
  union+dedupe, `SUPER_ADMIN` auto-grant of `admin.manage` even with zero
  explicit permission rows, empty-membership case, and true/false cases
  for `hasPermission`/`hasAnyPermission`/`hasAllPermissions`; 9 for
  `platform-settings` — get-or-create singleton behavior, partial-patch
  updates with `updatedById` stamping, create-then-update when the
  singleton doesn't exist yet, audit-logging the patch as `metadata`, and
  each of the `isEnabled`/`isMaintenanceMode`/`getSessionTimeoutMinutes`
  read helpers). Full backend suite went from 424 to 447 passing (447/447
  green), `tsc --noEmit` clean, lint 0 errors (402 warnings, up from 398,
  entirely from the new tests' `any`-typed Prisma mocks matching the
  established convention). Live-verified the one module with a real HTTP
  surface: `platform-settings` is reachable via `GET`/`PATCH
  /api/v1/admin/settings` (`admin.controller.ts`, gated by
  `RoleCode.SUPER_ADMIN` + `Permissions('admin.manage')`). Started
  Postgres + the API against the real dev DB, logged in as a real
  `SUPER_ADMIN`, confirmed `GET /admin/settings` returns the real
  singleton row, then `PATCH`ed `gamificationEnabled` to `false` and
  confirmed both the response and a fresh `GET` reflected it, confirmed a
  real `PLATFORM_SETTINGS_UPDATED` `AuditLog` row was written with the
  correct `actorId`/`entityId`/`metadata`, then reverted the flag back to
  its original `true` and deleted both test-generated audit rows
  afterward, leaving the singleton row and audit history exactly as
  found. `audit-logs` and `permissions` have no HTTP surface of their
  own (no controller — they're internal services consumed by other
  modules), so rather than write a contrived direct live test for them,
  noting honestly here that they've already been extensively,
  continuously, and indirectly live-verified throughout this entire
  session: every single authenticated request in every prior
  live-verification step this session passed through `PermissionsGuard`
  (backed by `PermissionsService.getUserPermissions`), and nearly every
  state-changing action verified live across dozens of prior TODO items
  produced a real `AuditLog` row that was explicitly queried via `psql`
  and inspected. The remaining 11 zero-coverage modules
  (`analytics`, `campaigns`, `community`, `courier`, `education`,
  `email`, `appointment-slots`, `users`, `ai-cache`, `ai-history`,
  `ai-logging`) are still outstanding for a future pass.
  - Files: `apps/api/src/modules/audit-logs/audit-logs.service.spec.ts`
    (new), `apps/api/src/modules/permissions/permissions.service.spec.ts`
    (new),
    `apps/api/src/modules/platform-settings/platform-settings.service.spec.ts`
    (new).
  - **Second installment**: covered the next 3 smallest remaining
    zero-coverage modules — `email` (107 lines), `ai-cache` (130 lines),
    `users` (166 lines). `email` (nodemailer wrapper used for
    registration verification emails) gets 8 new tests: dev-mode stream
    transport fallback when `SMTP_HOST` is unset, real SMTP transport
    construction with/without auth when it is set, the configured
    `SMTP_FROM` override, swallowing a transport failure instead of
    throwing (email delivery must never break the calling request), and
    `sendVerificationEmail`'s content plus HTML-escaping of the
    recipient's first name (the URLs it interpolates are not
    user-controlled, so were left unescaped as before — not a live bug,
    just documenting the asymmetry). `ai-cache` (the `AIInsightCache`
    read-through cache backing `ai-health`'s insight generation) gets 12
    new tests: cache hit, cache miss, expired-entry eviction-on-read,
    default vs. custom TTL on `set`, and every write path
    (`set`/`delete`/`invalidateUserCache`/`cleanupExpired`) swallowing a
    DB failure and returning a safe default instead of throwing, matching
    the service's existing "cache errors must never break the calling
    request" design. `users` (profile read/update, admin user listing)
    gets 11 new tests covering the redacted `findById` projection (no
    password/hash fields), `findMany` pagination math, `getProfile`'s
    `NotFoundException` and null-relation handling, and `updateProfile`'s
    `?? existing` per-field fallback plus its `USER_PROFILE_UPDATED`
    audit-log call. Full suite went from 447 to 478 passing (478/478
    green), `tsc --noEmit` clean, lint 0 errors (408 warnings, up from
    402, same `any`-mock pattern). Live-verified `users`'s full HTTP
    surface against the real dev DB: `GET /api/v1/users/me` returned the
    real seeded donor's profile including nested `donorProfile`/
    `notificationPreference`; `PATCH /api/v1/users/me` with
    `{"displayName":"Test Display Name"}` updated it and produced a real
    `USER_PROFILE_UPDATED` audit row; attempting to clear it back via
    `{"displayName":null}` surfaced that `updateProfile`'s `data.field ??
    user.field` fallback treats an explicit `null` as "no change" (same
    class as the nullish-coalescing pitfall already known from this
    session, not a new bug worth its own backlog item since no route
    currently needs to null out `displayName`) — reverted via a direct
    DB update instead, then deleted both test-generated audit rows;
    `GET /api/v1/users?page=1&limit=3` returned real paginated results
    as `SUPER_ADMIN` and a real `403` as a `donor`-role token confirming
    `RolesGuard` enforcement; `GET /api/v1/users/:id` returned the
    reverted profile with `displayName: null` confirmed restored.
    `email` and `ai-cache` have no controller of their own (internal
    services only), so — consistent with the same reasoning already
    applied to `audit-logs`/`permissions` — no contrived direct live
    test was added for them; `ai-cache` in particular has already been
    exercised indirectly by every prior live AI-health verification step
    this session. 8 modules now remain at zero coverage: `analytics`,
    `campaigns`, `community`, `courier`, `education`, `appointment-slots`,
    `ai-history`, `ai-logging`.
    - Files: `apps/api/src/modules/email/email.service.spec.ts` (new),
      `apps/api/src/modules/ai-cache/ai-cache.service.spec.ts` (new),
      `apps/api/src/modules/users/users.service.spec.ts` (new).

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

- [ ] **P3-7. Dead DTO scaffolding for three never-built admin features
  (found while working P1-15).** `apps/api/src/modules/admin/dto/admin.dto.ts`
  has `AdminListFeatureFlagsDto`/`AdminUpdateFeatureFlagDto`,
  `AdminListAnnouncementsDto`/`AdminCreateAnnouncementDto`/`AdminUpdateAnnouncementDto`,
  `AdminListSupportTicketsDto`/`AdminAssignTicketDto`/`AdminUpdateTicketDto`/`AdminCreateTicketDto`,
  and `AdminUpdateSettingsDto` — none imported by the controller, none
  backed by a Prisma model. Pure leftover scaffolding from admin features
  that were apparently planned and never built past the DTO layer (P1-14
  built real platform settings a different way; the others have no
  model/service/UI at all). Either delete the dead classes or use them as
  a starting spec if support tickets/announcements/generic feature-flag
  CRUD ever get built for real.
  - File: `apps/api/src/modules/admin/dto/admin.dto.ts`.

---

## Suggested execution order

1. ~~**P0-1** (registration/login) unblocks real users entirely — do this first.~~ ✅
2. ~~**P0-2 → P0-4** (mobile navigation dead ends) — cheap, high-impact UI wiring, no new backend needed.~~ ✅
3. ~~**P0-8, P0-9** (security) — before any load/beta testing touches real location data.~~ ✅
4. ~~**P0-5** (push) and **P0-6/P0-7** (courier + hospital↔blood-center UI) — these three close the loop on the emergency and supply-chain flows end-to-end.~~ ✅

**All P0 items are done.** ~~**P1-1/P1-2/P1-3** (the booking/inventory/shipment
TOCTOU races, all the same fix pattern already used for P0-9).~~ ✅
~~**P1-4** (route shipments through the real `ShipmentStateMachine`).~~ ✅
~~**P1-5** (idempotency keys on the mutating endpoints most exposed to
client-retry duplication).~~ ✅
~~**P1-6** (gamification XP triggers for appointments/emergency-response were
dead code — nothing emitted the events their handlers listen for).~~ ✅
~~**P1-7** (emergency donor eligibility never checked the 56-day donation
cooldown).~~ ✅
~~**P1-8** (centralized the next-eligible-donation-date rule into
`DonationEligibilityService`).~~ ✅
~~**P1-9** (Blood Center dashboard missing core pages — added `/appointments`
slot config and `/couriers` roster; review/approve-request and
create-shipment were already done under P0-7).~~ ✅
~~**P1-10** (no map UI anywhere — added `leaflet`/`react-leaflet` and a
shared `LocationMap` to hospital-web's shipment tracking and SOS pages and
blood-center-web's shipment tracking page; mobile split out to P1-19).~~ ✅
~~**P1-11** (neither web dashboard opened a live WebSocket for shipment
tracking — fixed `ShipmentGateway` DI wiring, added the missing emit calls
at all 11 status transitions plus the REST location-update path, and
connected both dashboards via a new `useShipmentTracking` hook).~~ ✅
~~**P1-12** (no organization signup flow fed the approval workflow — added
`POST /auth/register-organization`, `/register` pages on hospital-web and
blood-center-web, and a pending-approval landing screen; split the deeper
"nothing actually enforces org.status" gap out to P1-20).~~ ✅
~~**P1-13** (Admin: roles/permissions management didn't exist — added
`GET/PATCH /admin/roles`, `GET /admin/permissions`, and
`PATCH /admin/memberships/:id/role`, plus admin-web's new `/roles` page
and a "change role" control on the Users page).~~ ✅
~~**P1-14** (Admin platform "Settings" page was 100% fake — added a real
`PlatformSettings` model with six live gate points: session timeout,
AI/SOS/gamification/push feature flags, and a new maintenance-mode
kill-switch; removed the two badges — 2FA, Email/SMS notifications — that
had no honest backing at all instead of leaving them fake).~~ ✅
~~**P1-15** (content moderation was a write-only sink — added
`GET/POST /admin/content-reports` and admin-web's `/moderation` queue;
resolving hides/removes the post and auto-closes duplicate reports on it;
split an unrelated dead-DTO-scaffolding finding out to P3-7).~~ ✅
~~**P1-16** (Inventory had no issue/adjust/expiry/alerts — added
issue/adjust endpoints, an hourly `InventoryCronService` expiring units
and auto-releasing expired reservations, and real `LOW_STOCK`/`EXPIRED`/
`EXPIRING_SOON`/`QUARANTINED` alerts; first use of `@nestjs/schedule` in
this app, which P1-18 will reuse).~~ ✅
~~**P1-17** (challenge progress was donor self-reported and instantly
exploitable — now derived server-side per challenge type from real
donation/appointment/campaign/education/community records, with XP
awarding wired through the existing `CHALLENGE_COMPLETED` scaffolding
for the first time).~~ ✅
~~**P1-18** (No SOS / emergency-match expiration job — `activateEmergency`
now persists the effective `requiredBefore` deadline instead of computing
and discarding it, and a new `EmergencyCronService` runs every 5 minutes
expiring stale requests/matches and finally emitting the pre-existing,
previously-unreachable `sos.request.expired` event).~~ ✅
~~**P1-19** (Mobile had no map view — added `react-native-maps` and a
native `LocationMap` mirroring P1-10's web component, wired into two
already-existing-but-dead tracking API calls in `sos.tsx` and
`(courier)/active.tsx`; verified via a clean Metro `expo export` for both
platforms since no device/simulator is available in this sandbox).~~ ✅
~~**P1-20** (`organization.status` was never checked outside admin/auth —
added a small shared `assertOrganizationActive` helper and called it from
every org-scoped access-check chokepoint across shipments, emergency,
inventory, and appointments, instead of taking on P2-1's broader
apply-`OrganizationGuard`-everywhere risk inside this fix).~~ ✅

**All P1 items are done.**
~~**P2-1** (`OrganizationGuard` was written but never applied anywhere —
rewrote it to read `:organizationId` directly instead of unused reflector
metadata, registered it as a fifth global guard, and along the way found
and closed a real live cross-org vulnerability in `donations.service.ts`
that had nothing to do with the guard itself: several donation-workflow
methods checked the *resource* belonged to the org but never the
*caller*).~~ ✅
~~**P2-2** (`LAB_TECHNICIAN`/`LAB_REVIEWER`/`LAB_ADMIN` had zero seeded
permissions and were locked out of every real lab-workflow route — seeded
permissions split by responsibility, added the missing roles to each
route's `@Roles(...)`, and seeded one test account per role; found an
unrelated routing bug blocking `createResult` for everyone, split out to
new P2-15).~~ ✅
~~**P2-3** (Appointment booking had no `@Roles(DONOR)` guard — confirmed
live that hospital-staff and courier tokens could both book a real
donation slot for themselves; added `@Roles(DONOR, SUPER_ADMIN)` to the
five donor-self-service routes, deliberately leaving `GET :id`
unrestricted since its service already permits staff-of-org too).~~ ✅
~~**P2-4** (Emergency + notification DTOs were plain interfaces skipping
validation entirely — added real classes with enum/range/format checks;
found and fixed a genuine live 500-on-bad-input in `mark-read`, and
discovered a whole duplicate notification-preferences module silently
shadowing the one this item was fixing, split out to new P2-16).~~ ✅
~~**P2-5** (`EmergencyRequest` had no blood-component field — added
`componentType` with a migration, wired it through creation, completion's
donation/blood-unit records (replacing the hardcoded `WHOLE_BLOOD`), and
hospital-web's create-emergency form; live-verified a real PLATELETS
emergency completing into a real PLATELETS `Donation`/`BloodUnit`).~~ ✅
~~**P2-6** (Emergency matching ignored real geo distance — added
`DonorProfile.latitude`/`longitude` (the schema change this item said was
needed), a shared Haversine util, nearest-first ranking in
`activateEmergency`, a way to actually set the new fields via the
donors profile endpoint, and a mobile onboarding toggle to capture them;
live-verified a real ~0.87km match with the correct `matchScore`; found
and logged an unrelated `verificationStatus` reset bug as new P2-17).~~ ✅
~~**P2-7** (courier-assigned/accepted notifications silently fell back to
the generic "Shipment Created" template, and courier decline never
notified anyone at all — added the missing templates and the missing
`declineShipment` emit call; live-verified a real decline producing
seven real HIGH-priority notifications where before it produced zero).~~ ✅
~~**P2-8** (ETA used a hardcoded 40km/h constant and `bloodGroup` was a
literal hardcoded placeholder string — made the ETA use the courier's own
real recent average speed (captured GPS data that was going unused, with
an honest fallback note when it isn't available yet), replaced the
placeholder with a real blood-unit summary, and fixed an adjacent m/s vs.
km/h unit-mismatch bug in the mobile speed-reporting code; live-verified
a real "1 B+, 1 A+" summary and a correctly speed-derived ETA).~~ ✅
~~**P2-9** (donor registration fabricated a fake `HOSPITAL`-type org
— "DONOR Donors" — purely to satisfy a required FK, and it really did
leak into admin/discovery listings as a bogus hospital — added a proper
`OrganizationType.SYSTEM` placeholder type instead, and hardened the
listing/search paths that had no default type filter; live-verified it
no longer appears in `GET /organizations`, `/organizations/discover`, or
the admin org list).~~ ✅
~~**P2-10** (AI safety regex had two concrete, mechanical bypasses: every
pattern used a literal single space so extra whitespace defeated all of
them, and disease-name matching was a fixed 9-item list so any other
condition — lupus, COPD, anything — matched nothing; fixed whitespace
via a normalization pass and replaced the fixed list with a
suffix/generic-noun pattern that covers real condition names without
enumerating them; live-verified through the real controller call chain
that both bypasses are now caught).~~ ✅
~~**P2-11** (the unguarded-`Math.random()`-reference-number bug named for
2 files turned out to be duplicated in 6; added a shared
`withUniqueRetry` utility and applied it to all 8 live call sites —
donations, laboratory, shipments, emergency, appointments — rather than
leaving the same known bug in 6 of 8 places; live-verified the
zero-collision happy path still works unchanged).~~ ✅
~~**P2-12** (cancelled/no-show lab appointments never reset a `FULL`
slot back to `AVAILABLE` — mirrored the fix the donation-appointment
flow already had; live-verified a real slot flip to FULL, back to
AVAILABLE on cancel, and a real second booking succeeding on it
afterward).~~ ✅
~~**P2-13** (Notification "archive" was unreachable — real value, since
`delete` already refuses to hard-delete medical-record-linked
notifications, leaving them permanently stuck with no archive; added
archive/unarchive endpoints, excluded ARCHIVED from the default list and
unread counts, and wired a mobile API client; live-verified a real
delete-blocked donation notification archiving, disappearing from
stats/counts, and correctly unarchiving).~~ ✅
~~**P2-14** (deleted the dead, unreachable `confirmDelivery` sibling of
the real `confirmDeliveryFull`; added the discrepancy/partial-delivery
test coverage that method itself was missing; live-verified the real
`confirm-delivery` route still resolves and works correctly after the
removal — and found a real, separate, system-critical bug along the way
in how approved requests get shipped, logged as new P2-18).~~ ✅
~~**P2-15** (`POST .../laboratory-results` had a route/param mismatch
that was worse than "never succeeds" — Prisma silently omits an
undefined filter instead of matching nothing, so it could have attached
a result to the wrong donor's appointment; moved `appointmentId` into
the body to match the already-correct frontend client, added an
explicit guard against the underlying Prisma pitfall, and swept all 24
controllers confirming this was an isolated bug, not a pattern;
live-verified the 400 now fires correctly and a real result attaches to
the exact right appointment).~~ ✅
~~**P2-16** (two independent modules both implemented notification
preferences at the same route, one permanently shadowing the other;
consolidated on the `notifications` module per the TODO's own analysis,
restored the audit logging and `{data}` response-wrapping the dead
module had that the survivor lacked, and fixed a third bug the deletion
itself exposed — the survivor's own `@Get(':id')` was shadowing its
`@Get('preferences')`, latent the whole time the dead module was
winning; live-verified the 404 it caused, the fix, and the restored
audit trail).~~ ✅
~~**P2-17** (any donor profile update reset `verificationStatus`
regardless of which fields changed; now only resets when `bloodType`/
`rhFactor` actually change to a different value, comparing against the
real stored profile rather than just checking payload presence;
live-verified against the real seeded donor's VERIFIED profile: an
unrelated-field update and a same-value resubmission both correctly
leave it untouched, a real blood-type change correctly resets it).~~ ✅
~~**P2-18** (`approveRequest` claimed a reservation but never linked it
to the `BloodRequestItem`, so every real shipment shipped with zero
recorded units — added the missing link; live-verified a real shipment
now auto-attaching a real unit end-to-end with zero manual intervention,
unlike P2-14's workaround; found and logged an even deeper issue as new
P2-19 — the reservation state the fix's precondition needs never
actually arises from any real code path).~~ ✅
~~**P2-19** (`approveRequest`'s reservation search could never match
anything real, since no code path leaves a reservation ACTIVE on a
still-AVAILABLE unit — replaced the dead search with direct unit
selection + reservation creation, mirroring `reserveUnit`'s own shape;
live-verified the *entire* fulfillment pipeline — approve →
ready-for-pickup → create-shipment → tracking — working unassisted
end-to-end for the first time, with zero manual DB seeding at any
step).~~ ✅

**All P0, P1, and P2 items are now done**, including every item
discovered and logged along the way during P2's live verification
(P2-4 → P2-9's SYSTEM-org fix chain, P2-6 → P2-17's verification-reset
fix, P2-8 → P2-14 → P2-18 → P2-19's shipment/reservation chain, and
P2-13's notification-archive and P2-16's duplicate-module fixes).
~~**P3-1** (partial installment: re-measured coverage — 21 of 32
modules now covered, largely organic fallout of the P2 pass — and added
direct test coverage for the 3 smallest/most-foundational of the 11
remaining zero-coverage modules, `audit-logs`, `permissions`,
`platform-settings`, since nearly everything else depends on them; 25
new tests, full suite 447/447; live-verified `platform-settings` end-to-
end via the real `/admin/settings` endpoints, and noted why
`audit-logs`/`permissions` rely on this session's extensive indirect
live coverage instead of a fresh direct test. 11 modules remain at zero
coverage: `analytics`, `campaigns`, `community`, `courier`, `education`,
`email`, `appointment-slots`, `users`, `ai-cache`, `ai-history`,
`ai-logging` — still outstanding for a future pass; second installment
below covers 3 more).~~ ✅ (partial)
~~**P3-1 second installment** (`email`, `ai-cache`, `users` — 31 new
tests, full suite 478/478; live-verified `users`'s full HTTP surface
(`GET`/`PATCH /users/me`, `GET /users`, `GET /users/:id`) end-to-end
against the real dev DB, including RBAC enforcement and a real
`USER_PROFILE_UPDATED` audit row; surfaced that `updateProfile`'s `??`
fallback can't null out a field via explicit `null` — not a live bug
since no route needs that, just documented. 8 modules remain at zero
coverage: `analytics`, `campaigns`, `community`, `courier`, `education`,
`appointment-slots`, `ai-history`, `ai-logging`).~~ ✅ (partial)
Next up: the remainder of **P3-1** (8 modules still at zero coverage,
listed above) or **P3-2** (no frontend tests at all).

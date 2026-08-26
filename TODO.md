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

- [ ] **P2-15. `POST .../laboratory-results` can never succeed for anyone
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
  are.
  `apps/api/src/modules/laboratory/laboratory.controller.ts:249-273`.

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
Next up: **P2-3** (Appointment booking has no `@Roles(DONOR)` guard),
then the rest of P2, folding in P3-1 tests as each area is touched.

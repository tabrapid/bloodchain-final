# BloodChain — Production Readiness TODO

Generated from a full codebase audit against the BloodChain product specification
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

- [x] **P0-10. 26 GET routes returned no `{ data }` envelope, so every client
  call against them evaluated to `undefined` (found while writing P3-10's
  tests).** — Fixed.

  Every HTTP client in this repository ends its request helper with
  `return json.data as T` — mobile, hospital-web, blood-center-web and
  admin-web alike — and `docs/api.md` and `README.md` both document the
  `{ data, meta }` envelope. But the envelope was never applied globally. Some
  services hand-wrote `return { data: ... }`, `AdminController` used
  `WrapResponseInterceptor`, and seven whole controllers did neither.

  Measured against the running API by walking its own OpenAPI document: of 64
  parameterless GET routes that answered, **38 were enveloped and 26 were bare**
  — notifications (3), laboratory (4), gamification (7), leaderboard (2),
  community (3), campaigns (2), challenges (3) and education (3). That is very
  nearly the whole donor-facing surface of the mobile app.

  The failure mode is silent rather than loud, which is why it survived: with
  `content` undefined, `content?.items.length === 0` is false, so the screen
  skips its empty state and then renders `content?.items.map(...)` as nothing,
  and `stats && <Card/>` renders nothing. The screens look like empty states
  instead of errors. It also explains why the P3-9 styling work looked healthy —
  those mobile tests mock the `src/api/*` modules, so they never exercise the
  client that drops the payload.

  Fixed by applying `WrapResponseInterceptor` to the eight controller classes
  that lacked it (the gamification file holds two), and removing the one
  hand-written `return { data: ... }` in `notifications.controller.ts` that
  would otherwise have double-wrapped. No service logic changed.

  The interceptor's own doc comment asserted that "most services already return
  `{ data: ... }` themselves" — the probe falsified that, so the comment is
  rewritten to describe what is actually true.

  **Guard.** `test/response-envelope.e2e-spec.ts` builds the application's
  OpenAPI document at runtime, walks every parameterless GET, and fails on any
  successful response without a `data` key. It is deliberately generated from
  the app rather than a hand-written list, so a controller added tomorrow
  without the interceptor fails the day it lands. It has already earned its
  keep: my first mechanical pass decorated only the first `@Controller` in each
  file and silently missed `LeaderboardController`, which shares a file with
  `GamificationController`. The guard caught both leaderboard routes.

  Left as-is deliberately: `/admin/*` returns `{ data: { data, meta } }` because
  `AdminService` returns a `PaginatedResult` and the interceptor wraps it again.
  That is inconsistent with `/users`, which returns `{ data: [...], meta }` —
  but admin-web's `PaginatedResponse<T>` type expects exactly the double wrap,
  so it is working, and unpicking it means changing admin-web too. Recorded
  here rather than fixed silently.
  - Files: `apps/api/src/modules/{campaigns,challenges,community,education,gamification,laboratory,notifications}/*.controller.ts`,
    `apps/api/src/common/interceptors/wrap-response.interceptor.ts`,
    `apps/api/test/response-envelope.e2e-spec.ts` (new).

- [x] **P0-11. `docker compose up --build` could not build the API image at
  all — three independent bugs, stacked, found live by the user the first
  time anyone actually ran it.** — Fixed. Every prior "verified" claim about
  Docker in this repo's history was necessarily about the Dockerfile's
  shape, never a real build: this sandbox has no egress to Docker Hub, so I
  have never once been able to run `docker build` or `docker compose up`
  myself. Each bug below hid the next one — fixing #1 only revealed #2, and
  fixing #2 only revealed #3 — which is exactly why nobody had found all
  three until a real build ran the whole pipeline end to end.

  **Bug 1 — stale package filter.** The user's first attempt failed at the
  final `COPY --from=build /repo/apps/api/dist /repo/apps/api/dist` step:
  `"/repo/apps/api/dist": not found`. `apps/api/Dockerfile` still filtered
  on `@donor/api` — three `pnpm --filter @donor/api ...` invocations left
  over from before this session's rename to `@bloodchain/api`. The rename
  updated every source file, config, and doc that `typecheck`/`lint`/
  `test`/`build` could reach, but the Dockerfile is invisible to all four.
  `pnpm --filter` with a selector matching nothing exits **0** rather than
  erroring, so install and build both "succeeded" doing nothing (3.6s and
  0.2s — too fast to be real) and the pipeline only broke three stages
  later at the `COPY`. Confirmed by running the same selector directly in
  the sandbox: the old name matches zero packages, the new name resolves to
  exactly the 5 the Dockerfile expects.

  **Bug 2 — `.npmrc` never copied.** Fixing #1 and having the user retry
  surfaced `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH: The current
  "settings.autoInstallPeers" configuration doesn't match the value found in
  the lockfile`. The repo's `.npmrc` pins `auto-install-peers=false` /
  `strict-peer-dependencies=false` to match how `pnpm-lock.yaml` was
  generated, but the Dockerfile's `deps` stage never `COPY`'d it in, so pnpm
  fell back to its own default and `--frozen-lockfile` refused to proceed.
  Reproduced by hand in the sandbox: copying only the files the `deps` stage
  copies (no `.npmrc`) into a scratch directory and running the same
  install reproduces the exact error; adding `.npmrc` back installs 833 real
  packages in 11s (versus the earlier 3.6s no-op).

  **Bug 3 — root `tsconfig.json` never copied, found before the user hit
  it.** With #1 and #2 fixed, continuing the same scratch-directory
  reproduction through `nest build` failed with 13 TypeScript errors —
  `replaceAll` not existing on a string, `matchAll` needing
  `--downlevelIteration`, regex flags needing ES2018 — the unmistakable
  signature of a project silently compiling under TypeScript's ES5
  defaults. `apps/api/tsconfig.json` and every `packages/*/tsconfig.json`
  `extend` the workspace root `tsconfig.json` (which sets `target: ES2022`,
  `esModuleInterop: true`, etc.), but the Dockerfile never copies that file
  into the image, and a missing `extends` target apparently fails silently
  here rather than erroring, quietly discarding every setting it would have
  supplied. Fixed, then re-ran the full scratch-directory reproduction from
  a clean install through `nest build`: zero errors, `dist/src/main.js`
  produced, and `node dist/src/main.js` boots the compiled Nest app and
  fails only on the expected `DATABASE_URL`/`JWT_ACCESS_SECRET`/
  `JWT_REFRESH_SECRET` being unset — exactly what real container env vars
  from `docker-compose.yml` supply at runtime, and proof the compiled
  artifact itself is sound.

  This is the third Docker-adjacent gap this session (after P3-4's
  `.env.example` rejecting its own template, and Bug 1 above) that no
  amount of `typecheck`/`lint`/`test`/`build` could have caught, because
  none of them touch the Docker path. The reproduction went further than a
  shape review ever could — a real `pnpm install` plus a real `nest build`
  plus a real boot of the resulting artifact — but it still was not
  `docker build` itself.

  **Confirmed by the user, on their own machine, immediately after this
  fix:** `docker compose build --no-cache api` completed clean end to end —
  832 packages installed, Prisma client generated, `nest build` with zero
  errors, all 8 runtime `COPY`/`RUN` steps, image exported as
  `bloodchain-api:latest`. (An earlier attempt on the same machine failed
  with a bare `exit code: 1` and no visible error text; likely a transient
  network drop mid-download given how slow that connection's `apt-get` and
  `pnpm install` both ran — `--no-cache` on retry succeeded outright, which
  is consistent with a flake rather than a repo bug.) This is the first
  confirmed real `docker build` in this repository's history — every
  earlier "verified" claim about Docker was necessarily about the
  Dockerfile's shape, since this sandbox has no Docker Hub egress.
  - Files: `apps/api/Dockerfile`.

- [x] **P0-12. Nine web-app API functions were typed to return
  `{ data: T }` and every caller read `.data` off the result — but the
  real resolved value was always `T` directly, so `.data` was `undefined`
  and crashed the first page a user actually opened in the browser.**
  — Fixed. Found live: the user's first click into `/requests` on the
  hospital dashboard threw `TypeError: Cannot read properties of
  undefined (reading 'filter')` on `requests.filter(...)`, because
  `setRequests(data.data)` had set the state to `undefined`.

  Root cause: `apiRequest<T>` (this session's own `api-client.ts` from
  P3-2) already unwraps the HTTP response's top-level `data` field —
  `return json.data as T`. For most endpoints that's correct, because
  `WrapResponseInterceptor` (P0-10) wraps a bare service payload as
  `{ data: payload }` exactly once. But `ShipmentsController` and
  `AppointmentSlotsController` carry no interceptor at all — their
  services hand-wrap their *own* return values as `{ data: payload }`
  directly, so the HTTP body is `{"data": payload}` either way, and
  `apiRequest` correctly resolves to `payload`. Nine functions across two
  apps were nonetheless declared `Promise<{ data: T }>` and their callers
  read `result.data` — a second, fictional unwrap that the type checker
  had no way to catch, because `apiRequest`'s generic `T` is supplied
  entirely from the caller's declared return type and never checked
  against what the endpoint actually returns.

  Confirmed each of the nine individually against its backing service
  method before touching anything, rather than assuming the same bug
  everywhere a similar type appeared: `ShipmentsService.getRequests` /
  `getShipments` / `getCourierRoster` and all four
  `AppointmentSlotsService` methods (`getSlotsByOrganization`,
  `createSlot`, `updateSlot`, `blockSlot`) each `return { data: ... }`
  with no interceptor on their controller — the fictional-wrapper pattern,
  confirmed nine for nine. (Two other multi-field `Promise<{ ... }>`
  return types in the same files — `getShipmentTimeline`,
  `getShipmentTracking` — are genuine domain shapes, not this bug; left
  alone.)

  Fixed the return type on all nine to the type `apiRequest` actually
  resolves to, and fixed every caller that read `.data` off the result (6
  of the 9 — the other 3, `createSlot`/`updateSlot`/`blockSlot`, discard
  their return value and re-fetch instead, so only their type annotation
  was wrong). The corrected types are self-enforcing from here: reverting
  a caller to `result.data` now fails `pnpm typecheck` outright —
  `Property 'data' does not exist on type 'BloodRequest[]'` — proven by
  temporarily reintroducing it and watching typecheck fail, then
  reverting. Added runtime specs (11 new tests: 2 + 2 + 1 + 4 across
  `hospital-web/lib/shipments`, `blood-center-web/lib/{shipments,couriers,
  appointment-slots}`) asserting each function resolves to the real
  unwrapped shape a hand-wrapping backend actually sends, not the
  double-unwrap the old types assumed — these are Node-level and would
  survive even if `pnpm typecheck` were somehow bypassed.

  This is the same failure mode as P0-10 (undefined payload → the screen
  looks like an empty state, or in this case a hard crash) but the
  opposite direction: P0-10 was controllers sending no envelope where
  clients expected one; this is clients expecting a second envelope no
  controller ever sent. Both come from the same root condition — response
  shape is asserted by hand at both ends of the wire with nothing
  checking the two agree — and this one was found the same way P0-10 was:
  by someone actually clicking through the running app, not by
  `typecheck`/`lint`/`test`/`build`, none of which model the network
  boundary between client and server.
  - Files: `apps/hospital-web/lib/shipments.ts`,
    `apps/hospital-web/lib/shipments.spec.ts` (new),
    `apps/hospital-web/app/{requests,shipments}/page.tsx`,
    `apps/blood-center-web/lib/{shipments,couriers,appointment-slots}.ts`,
    `apps/blood-center-web/lib/{shipments,couriers,appointment-slots}.spec.ts`
    (new), `apps/blood-center-web/app/{requests,shipments,couriers,appointments}/page.tsx`.

- [x] **P0-13. The blood-center inventory page crashed the same way P0-12's
  did (`units.length` on `undefined`) — a variant of the same bug class
  `apiRequest` cannot represent on its own.** — Fixed. Found live, same
  session as P0-12: `getInventory` was typed `Promise<PaginatedResponse<
  InventoryUnit>>` (a named `{ data: T[]; meta: {...} }` type, which is why
  P0-12's grep for the literal `Promise<{ data:` pattern missed it) and the
  page correctly read `response.data` / `response.meta.totalPages` /
  `response.meta.total` — but `InventoryController` carries no
  `WrapResponseInterceptor` and its service hand-wraps its own
  `{ data, meta }`, so `apiRequest`'s `return json.data as T` resolved to
  the bare array, discarding `meta` entirely. Confirmed against the
  backend rather than assumed: checked all 17 `InventoryController` routes'
  service methods, and all 17 hand-wrap `{ data: ... }` uniformly with no
  interceptor — 14 of them are consumed by the frontend as bare values
  (correctly, since that is genuinely what `apiRequest` resolves to for
  them) and would have broken had the fix instead added the interceptor to
  the whole controller. `getMovements` and `getReservations` have the
  identical shape and are not currently called from any page, so they had
  no live symptom yet but were fixed alongside `getInventory` rather than
  left for the next person to trip over.

  Unlike P0-12, this could not be fixed by correcting a type: `meta` is
  real data the page needs (pagination totals for "N of M units" and the
  next/prev controls) and `apiRequest` structurally discards anything
  outside `json.data`. Added `apiRequestEnvelope<T>` to
  `blood-center-web/lib/api-client.ts` — the same fetch/auth/refresh/error
  logic, factored out and returning the whole parsed body instead of just
  `.data`; `apiRequest` is now `apiRequestEnvelope(...).then(e => e.data)`,
  so none of that app's ~30 other call sites change behavior. The three
  inventory functions call `apiRequestEnvelope` directly and reassemble
  `{ data, meta }` themselves.
  - Files: `apps/blood-center-web/lib/api-client.ts`,
    `apps/blood-center-web/lib/inventory.ts`.

- [x] **P0-14. Live browser sweep of every hospital-web/blood-center-web
  page (per the user's explicit "check every page and menu, prove it with
  screenshots" instruction) found four more independent bugs: hospital-web's
  `/emergency` crashed on the same fictional-double-unwrap pattern as
  P0-12/P0-13 but via a generic-parameter call site neither of those greps
  matched; `AnalyticsController`'s 10 routes send no envelope at all
  (P0-10's bug, not P0-12/13's); both web apps' analytics pages had drifted
  from what the backend actually returns across five tabs each; and
  admin-web's `/ai-analytics` sent every request with `Authorization:
  Bearer null`.** — Fixed all four, each confirmed independently against
  its actual backend pairing before touching frontend code, then verified
  live with Playwright (Chromium, seeded users, full-page screenshots,
  checked for the Next.js dev error overlay and `pageerror` console
  events) rather than assumed from a sibling app's fix.

  **1. `hospital-web/lib/emergency.ts` `getEmergencies`.** Same root cause
  as P0-12 — `EmergencyController` has no interceptor, `EmergencyService
  .getEmergencies` hand-wraps `{ data: emergencies }`, so `apiRequest`
  already resolves to the bare array — but expressed as
  `apiRequest<{ data: EmergencyRequest[] }>(endpoint)` then
  `return response.data`, a generic-parameter variant P0-12's grep for the
  literal `Promise<{ data:` return-type pattern never matched. This is why
  the user hit a *new* crash (`/emergency`) immediately after P0-12 shipped
  instead of confirming it fixed: the bug class was broader than the
  original static sweep could find, which is what motivated moving to live
  browser automation for everything from here on. Fixed the function to
  return `EmergencyRequest[]` directly.

  **2. `AnalyticsController` sent no envelope on any of its 10 routes.**
  Verified mechanically rather than assumed: extracted every one of
  `AnalyticsService`'s 10 public methods' final `return` statement and
  confirmed all 10 (`getOverview`, `getInventoryAnalytics`,
  `getDonationAnalytics`, `getEmergencyAnalytics`, `getRequestAnalytics`,
  `getAppointmentAnalytics`, `getLaboratoryAnalytics`,
  `getShipmentAnalytics`, `getActivityFeed`, `getAlerts`) return bare
  domain objects with no `{ data: ... }` wrap, and the controller had no
  `@UseInterceptors` at all — unlike P0-13's `InventoryController`, where
  adding a controller-wide interceptor would have broken 14 of 17 routes,
  here it was safe for all 10. Added `@UseInterceptors(WrapResponseInterceptor)`
  at the controller level.

  While fixing the resulting frontend type drift (below), also closed real
  backend gaps rather than papering over them with optional chaining:
  `getInventorySummary` never counted `EXPIRED` units even though the enum
  value exists (`expiredUnits` added); `getInventoryByBloodGroup` returned
  a one-off `{ available, reserved: 0, inTransit: 0, status }` shape
  instead of the shared `BloodGroupCountDto` (`{ bloodGroup, rhFactor,
  fullName, count, percent }`) every sibling `*ByBloodGroup` helper uses —
  rewritten to match; added `getInventoryByComponent` (groupBy
  `componentType` for total/available/reserved) and
  `getEmergenciesByBloodGroup` (groupBy `bloodType`/`rhFactor` on
  `emergencyRequest`, same `BloodGroupCountDto` shape), neither of which
  existed before; `getDonationSummary` never counted `NO_SHOW` donations or
  computed a completion rate (`noShow`/`completionRate` added). Added 8 new
  Jest cases in `analytics.service.spec.ts` covering all of the above
  (`expiredUnits`, `getInventoryByBloodGroup`'s corrected shape,
  `getInventoryByComponent`, `getDonationSummary`'s `noShows`/
  `completionRate` including the empty-range → `null` case, and
  `getEmergenciesByBloodGroup`), and updated the two existing
  `getInventoryAnalytics`/`getInventoryByBloodGroup` tests that asserted
  the old, now-removed shape. 37/37 pass.

  Where the backend genuinely has no data to give — `LaboratoryResult
  .status` is a plain `String` with no `REJECTED` value ever written by any
  code path, and a `byBloodType` breakdown would need an unimplemented
  join from `laboratoryResult` through `donorId → User → donorProfile` —
  the frontend was aligned to reality (fields renamed/removed) instead of
  either faked with placeholder data or crash-suppressed with optional
  chaining; the join was scoped out as a genuine backend gap, not silently
  built as an unplanned feature.

  **3. Both web apps' `lib/analytics.ts` had drifted from the real backend
  shapes across every tab**, independently in each app (confirmed via
  `diff` that the two files are not identical — different domain tabs per
  app) — this is why fixing hospital-web's copy did not also fix
  blood-center-web's `alerts.filter is not a function` crash found on the
  next live re-check. In both: `getAlerts`/`AlertItem` used
  `severity`/`acknowledged` fields that don't exist (real shape is
  `priority: 'CRITICAL' | 'HIGH'` plus `sourceType`/`sourceId`/`status`)
  and the page called `.filter` directly on the response instead of
  `response.alerts`; `getActivityFeed` was typed as a bare array instead
  of `{ items, total }`; every `get*Trends`-shaped nested field was typed
  as a bare array instead of the real `{ data, period, total }`. Rewrote
  both `lib/analytics.ts` files' interfaces and the two `app/analytics
  /page.tsx` files' consuming code to match. Blood-center-web additionally
  had two tabs asserting fields the backend never computes: Laboratory's
  `rejected` count and `byBloodType` breakdown (same non-existent-status/
  unimplemented-join gap as above — removed, not faked) and Shipments'
  `inTransit`/`returned` field names (renamed to the real `active`/
  `failed`).

  Verified live end-to-end with real seeded data, not just typecheck:
  hospital-web's `/emergency`, `/requests`, and all 3 analytics tabs
  (Inventory/Emergencies/Appointments) — zero dev-overlay errors, zero
  `pageerror` events, screenshots confirm real numbers render. Blood-center
  -web's all 5 analytics tabs (Overview/Inventory/Donations/Laboratory
  /Shipments) — same zero-error result; screenshots confirm e.g. Laboratory
  showing "Total Tests: 1, Completed: 1, By Status: PUBLISHED 1 (100.0%)"
  and Donations showing "Total: 10, Completed: 10, No Shows: 0, Completion
  Rate: 100.0%" plus all 8 real blood-group counts.

  **4. `admin-web/lib/ai-api.tsx` read the wrong localStorage key.** Its
  own hand-rolled `authFetch` read `localStorage.getItem('accessToken')`,
  but every other admin-web module stores the token under
  `admin_access_token` (`lib/client.tsx`) — so every AI-analytics request
  sent `Authorization: Bearer null` and the API correctly answered 401.
  This was not a feature-flag or RBAC issue: checked `AI_ENABLED` in
  `.env` (it is `false`) and `checkFeatureEnabled()` (throws
  `ForbiddenException` → 403), neither of which matches an observed 401,
  which is what pointed at auth instead. Verified the backend routes
  first, before touching the frontend: `AIAdminController`
  (`@Controller('admin/ai')`, `@Roles(RoleCode.SUPER_ADMIN)`, matching the
  seeded `admin@donor.local` user) hand-wraps `{ data: result }` on both
  `GET analytics` and `GET insight-stats` with no interceptor — a correct
  single wrap that `apiRequest` was already built to consume correctly.
  Rewrote `ai-api.tsx` to use the shared `apiRequest` from `./client`
  instead of its own fetch wrapper (also gets this page the token-refresh
  -and-retry behavior every other admin-web page already has), and moved
  the `AIAnalytics`/`AIInsightStats` interfaces here as exports so
  `app/ai-analytics/page.tsx` consumes the same types the fetcher declares
  instead of a disconnected local copy. Verified live: logged in as
  `admin@donor.local`, navigated to `/ai-analytics` — zero dev-overlay
  errors, zero console/page errors, page renders its real (all-zero, since
  no AI requests have been seeded) metrics instead of falling back to the
  "data not available" empty state, confirming the 401 is gone.

  Verification for this entire batch: `pnpm -r typecheck` (all 10
  workspace projects clean), `pnpm --filter @bloodchain/api lint` (0
  errors), `pnpm --filter {admin,hospital,blood-center}-web lint` (0
  errors, each is a `tsc --noEmit` alias), `pnpm --filter @bloodchain/api
  test -- analytics` (37/37 passing), plus the live Playwright checks
  described above for every touched page.
  - Files: `apps/hospital-web/lib/emergency.ts`,
    `apps/api/src/modules/analytics/analytics.controller.ts`,
    `apps/api/src/modules/analytics/services/analytics.service.ts`,
    `apps/api/src/modules/analytics/services/analytics.service.spec.ts`,
    `apps/hospital-web/lib/analytics.ts`,
    `apps/hospital-web/app/analytics/page.tsx`,
    `apps/blood-center-web/lib/analytics.ts`,
    `apps/blood-center-web/app/analytics/page.tsx`,
    `apps/admin-web/lib/ai-api.tsx`,
    `apps/admin-web/app/ai-analytics/page.tsx`.

- [x] **P0-15. The same fictional-envelope bug class from P0-12/13/14 turned
  out to be systemic across nearly the entire mobile app's API layer — not
  isolated to one or two functions.** — Fixed. With the web apps' "every
  page and menu" sweep clean (P0-14), and no Android/iOS simulator
  available in this sandbox to browser-test the mobile app the same way,
  the next-best move was to apply the same discipline statically: check
  every mobile `api/*.ts` function against its actual backend pairing
  before touching anything. That produced a much bigger finding than
  expected — 12 of the mobile app's 18 API modules had at least one
  affected function, spanning donor-facing features across nearly the
  whole app: appointment booking (`getAvailability`, `getOrganizations`,
  `getMyAppointments`, `getNextAppointment`, `getAppointment`,
  `bookAppointment`, `cancelAppointment`, `rescheduleAppointment`),
  donations (`getMyDonations`, `getMyDonationStatistics`, `getDonation`),
  the donor profile (`getDonorProfile`, `updateDonorProfile`), the user
  profile (`getUserProfile`, `updateUserProfile`), sessions
  (`getSessions`, `revokeSession`, `revokeAllSessions`), gamification (9
  functions across profile/XP/achievements/badges/leaderboard),
  notification preferences, all 12 laboratory functions, courier shipment
  history (`getCourierShipments`), and two unused-but-still-wrong `auth.ts`
  functions (`register`, the dead-code `refreshTokens` — the real
  token-refresh path in `client.ts`'s own `refreshAccessToken` was already
  correct). Every one of these silently resolved to `undefined` at the
  point a screen read `.data` off it — not a crash, since every call site
  used `?.` and an empty-array/empty-state fallback, so the calendar,
  booking flow, donation history, gamification screens, and donor/user
  profile screens looked like ordinary empty states rather than failures,
  exactly as `test/response-envelope.e2e-spec.ts`'s own doc comment
  predicted for this bug class on mobile.

  Two of the eighteen modules (`ai-health.ts`, `health-trends.ts`) and five
  of `auth.ts`'s functions (`login`, `verifyEmail`, `me`, `logout`,
  `resendVerification`) were checked and found already correct — their
  backend controllers hand-wrap `{ data: ... }` at the controller level
  with no interceptor, which is exactly what those functions' existing
  `apiRequest<{ data: T }>()` calls expected. Confirming these were fine
  (not just assuming, per this session's established discipline) is what
  kept the fix scoped to the 12 modules that actually needed it.

  Three bug shapes, matching the taxonomy from P0-10/12/13:
  1. **Fictional double-unwrap** (P0-12's class, the overwhelming majority
     here): the backend single-wraps via either `WrapResponseInterceptor`
     alone (gamification, laboratory, notifications — bare service
     returns) or a service hand-wrap alone (appointments, donations minus
     `getMyDonations`, donors minus `getProfileCompletion`, users,
     sessions, auth) — either way `apiRequest`'s single `json.data as T`
     already resolves to the real payload, so the extra `{ data: T }` type
     + `.data` re-read some of these functions carried was one level too
     deep. Fixed by removing that extra level from the function's return
     type (and, where the call used `apiRequest<{ data: T }>()` then
     `response.data` instead of an inferred generic, from the call itself).
  2. **`meta` silently discarded** (P0-13's class): `getCourierShipments`
     and `getMyDonations` hand-wrap `{ data, meta }` with no interceptor —
     `meta` (real pagination totals) sat next to `data` at the top level of
     the HTTP body, so `apiRequest`'s single unwrap discarded it exactly
     like blood-center-web's inventory page did. Added
     `apiRequestEnvelope<T>` to `mobile/src/api/client.ts` — factored out
     of `apiRequest` the same way blood-center-web's version was in P0-13,
     returning the whole parsed body instead of just `.data` — and rebuilt
     `apiRequest` on top of it (`apiRequestEnvelope(...).then(e => e.data)`)
     so none of the other ~50 call sites in the app change behavior. Both
     functions now call `apiRequestEnvelope` directly and reassemble
     `{ data, meta }` themselves.
  3. **Missing envelope entirely** (P0-10's class — a genuine backend gap,
     not a client mistype): `DonorsService.getProfileCompletion` returned
     `{ percentage, completed, missing }` bare, with neither an interceptor
     nor a hand-wrap, while its sibling `getProfile` on the same controller
     hand-wraps `{ data: ... }` — so `GET /donors/profile/completion`'s
     real HTTP body had no `data` key at all, and `apiRequest`'s `json.data
     as T` was always `undefined`. Fixed by hand-wrapping this one
     service method's return to match its sibling, rather than adding a
     controller-wide interceptor (which would have double-wrapped
     `getProfile`). Five of `CourierController`'s six routes (`getProfile`,
     `updateProfile`, `updateStatus`, `getActiveShipment`, `getStats`) had
     the identical gap — bare returns, no interceptor, while the sixth
     (`getShipments`) was correctly hand-wrapped by its service method —
     fixed by hand-wrapping the other five at the controller level to
     match, which needed zero mobile-side changes since those functions'
     `apiRequest<T>()` calls (without a `{ data: T }` wrapper) already
     expected exactly this shape.

  This also explains why `test/response-envelope.e2e-spec.ts` (added in an
  earlier P0-10 fix specifically to catch missing envelopes) never caught
  the courier or donor-profile-completion gaps: it walks only
  parameterless GET routes reachable by a super-admin token, and both
  `/donors/profile/completion` (`@Roles(DONOR)`) and every affected
  `/courier/*` route 403/404 for that actor (no `Courier` row), so the
  probe's `res.status >= 400 → continue` skip silently passed over exactly
  the routes that needed checking. Not fixed as part of this item — a
  genuine gap in that test's actor coverage, worth a follow-up — but it is
  why unit tests target the specific service/controller methods here
  instead of relying on that e2e suite alone.

  Verified three ways: (1) `pnpm -r typecheck` across all 11 workspace
  projects, clean — this pattern is self-enforcing once the types are
  correct, the same way P0-12 demonstrated (an errant `.data` re-read now
  fails typecheck outright, and one such case, in
  `app/(app)/profile/edit.tsx`, was caught and fixed exactly this way
  during this fix); (2) new unit tests: 6 new cases in
  `apps/mobile/src/api/client.spec.ts` asserting `apiRequest` resolves
  directly to the payload (not a second wrapper), `apiRequestEnvelope`
  preserves `meta`, error responses throw `ApiRequestError`, and auth
  headers are attached/skipped correctly; 3 new + 2 updated cases in
  `apps/api/src/modules/donors/donors.service.spec.ts` for the
  `getProfileCompletion` envelope fix (`666/666` API unit tests passing
  overall, `25/25` mobile); (3) live verification against the running dev
  API with real seeded tokens (`donor@donor.local`, `courier@donor.local`)
  for every backend-side fix — `GET /donors/profile/completion`,
  `/courier/profile`, `/courier/stats`, `/courier/shipments/active`,
  `/appointments/me`, `/me/gamification`, `/donations/me/statistics`,
  `/notifications/preferences` — confirming each now returns a correctly
  enveloped `{ data: ... }` body. No Android/iOS simulator is available in
  this sandbox, so the mobile screens themselves could not be
  screenshot-verified the way the three web apps were in P0-14; that
  remains for the user's own device via `claude/local-test-ready`.
  - Files: `apps/mobile/src/api/client.ts`, `apps/mobile/src/api/client.spec.ts`
    (new), `apps/mobile/src/api/{appointments,auth,courier,donations,donors,
    gamification,laboratory,notifications,sessions,users}.ts`,
    `apps/mobile/src/hooks/{useAppointments,useDonations,useDonors,
    useGamification,useNotifications,useSessions,useUsers}.ts`,
    `apps/mobile/app/(app)/{appointment/[id],calendar,donate,donations/[id],
    home,profile,profile/donor,profile/edit}.tsx`,
    `apps/mobile/app/(booking)/{confirmation,date,organizations,review,time}.tsx`,
    `apps/api/src/modules/donors/donors.service.ts`,
    `apps/api/src/modules/donors/donors.service.spec.ts`,
    `apps/api/src/modules/courier/courier.controller.ts`.

- [x] **P0-16. The user asked for a menu-and-button pass over the mobile app
  specifically (the same audit already done for the three web apps in
  P0-14). Code-level review — no simulator is available in this sandbox to
  click through it live — found a crash on the app's highest-stakes
  screen, plus two more instances of patterns already seen this session.**
  — Fixed.

  **The crash**: `app/sos.tsx` (the Emergency SOS screen every donor
  lands on to accept/decline/track a live blood emergency) threw
  `TypeError: Cannot read properties of undefined (reading 'active')` on
  every single load. `getDonorEmergencies()`'s mobile type baked in an
  extra `{ data: ... }` layer that `apiRequest` already strips, the exact
  P0-12 pattern — but chasing why led to `EmergencyController` itself:
  of its 15 routes, only `getEmergencies` (the one P0-14 already checked,
  for hospital-web) hand-wraps its response. The other 14 — all 8
  donor-facing accept/decline/start-journey/update-location/arrive/
  cancel/view-match/tracking routes `sos.tsx` depends on, plus 6
  hospital-facing single-emergency routes — returned bare payloads with
  no envelope at all. `apiRequest` resolved every one of them to
  `undefined`. Hand-wrapped all 14 at the controller level (matching
  `getEmergencies`' existing convention; a controller-wide interceptor
  would have double-wrapped it). This turned out to also silently repair
  hospital-web's `getEmergency`/`createEmergency`/`activateEmergency`/
  `cancelEmergency`/`confirmArrival`/`completeEmergencyDonation`/
  `getEmergencyTracking` — all six were resolving to `undefined` too, just
  never visibly broken because their one caller (`app/emergency/page.tsx`)
  only ever `await`s them and refetches, never reads the result. Caught
  only by checking every route on the controller instead of assuming
  P0-14's fix to `getEmergencies` covered its neighbors — the same mistake
  P0-14 itself was catching P0-12 for making.

  **Two more instances of already-seen patterns**: `app/(app)/privacy.tsx`
  had 9 of 11 settings rows carrying a chevron and press-feedback
  (`ListItem`'s affordance was unconditional) while doing nothing on tap —
  3 were literal `onPress={() => {}}` no-ops, 6 had no handler at all. No
  backend supports any of them: no privacy-preference schema fields, no
  data-export/account-deletion endpoints, no policy content anywhere in
  the repo, so wiring them up would mean fabricating a feature rather than
  fixing one — the same call made for Laboratory's `rejected`/`byBloodType`
  in P0-14. Fixed `ListItem` to render the chevron and press affordance
  only when `onPress` is actually provided, so rows that lead nowhere stop
  implying they do. Separately, `app/(app)/security.tsx`'s Change Password
  called a raw `fetch('http://localhost:3001/...')` instead of the shared
  `apiRequest` client — hardcoded to `localhost` (unreachable from a real
  device) and missing the Authorization header entirely, so the backend's
  `JwtAuthGuard` rejected every attempt regardless of whether the password
  was right. Routed through `apiRequest` instead.

  Verified via `pnpm -r typecheck` (all 11 workspace projects clean),
  `pnpm --filter @bloodchain/api test -- emergency` (39/39 passing,
  untouched service tests), and live requests against the running dev API
  with real seeded donor/hospital-admin tokens confirming every affected
  route — `getDonorEmergencies`, `viewEmergencyMatch`, `getEmergency` — now
  returns a correctly enveloped body, plus a live Playwright re-check of
  hospital-web's `/emergency` page confirming the shared-controller change
  didn't regress it.
  - Files: `apps/api/src/modules/emergency/emergency.controller.ts`,
    `apps/mobile/app/(app)/privacy.tsx`, `apps/mobile/app/(app)/security.tsx`,
    `apps/mobile/app/sos.tsx`, `apps/mobile/src/api/emergency.ts`,
    `apps/mobile/src/components/ListItem.tsx`.

- [x] **P0-17. Continuing the mobile audit into `courier.ts` (P0-15's initial
  pass silently stopped 170 lines into a 280-line file and never checked
  the other 10 functions) found a genuine route collision plus the same
  missing-envelope gap across nearly the entirety of `ShipmentsController`
  — 21 of its 24 routes.** — Fixed.

  **The route collision**: `CourierController` (`@Get('shipments')` under
  prefix `courier`) and `ShipmentsController` (`@Get('courier/shipments')`)
  both register the literal same path, `GET /courier/shipments`, backed by
  two different service methods with two different shapes —
  `CourierService.getCourierShipments` returns `{ data, meta }` with
  limit/offset pagination; `ShipmentsService`'s version returns bare
  `{ data }`, no pagination support at all, and doesn't accept the `limit`
  mobile's `history.tsx` sends. `ShipmentsModule` is registered before
  `CourierModule` in `app.module.ts`, so Express's first-match routing
  always resolved to the less-capable, non-paginated duplicate — confirmed
  live (`{"data":[]}` , no `meta` key). This is exactly the shape P0-15's
  `apiRequestEnvelope` fix for mobile's `getCourierShipments` was built
  around, so verifying that fix earlier actually exercised the wrong
  service without anyone noticing, since both return `{ data: [...] }` for
  an empty result. Removed the shadowed duplicate — the route, its now-dead
  `ShipmentsService.getCourierShipments` method, and its single-use DTO —
  leaving `CourierController`'s pagination-aware version as the sole
  implementation. Confirmed live: `/courier/shipments` now returns `meta`.

  **The missing envelope**: with the duplicate gone, checked every
  remaining `ShipmentsController` route the same way P0-16 checked
  `EmergencyController` — 21 of 24 (everything except `getRequests`/
  `getShipments`/`getCourierRoster`, hand-wrapped since P0-12) returned
  bare payloads with no envelope, resolving to `undefined` for every
  client. None of these routes are parameterless GETs (every one nests
  under `:organizationId` or `:shipmentId`), so `test/response-envelope
  .e2e-spec.ts` — built specifically to catch exactly this gap — never had
  a chance to see them; its own filter (`!path.includes('{')`) excludes
  every route in this entire controller by construction. Hand-wrapped all
  21 at the controller level, matching the three siblings' existing
  convention. Checked every consumer across all three apps before assuming
  anything needed a client-side change: hospital-web's and blood-center-web's
  `shipments.ts`/`couriers.ts`, and mobile's `courier.ts`, already declared
  every one of these 21 functions' return types as the bare payload with no
  `{ data: ... }` wrapper — because nobody writes client code that expects
  `undefined`, every client had already converged on the *correct*
  eventual-state type while the backend silently failed to deliver it. Zero
  client-side changes were needed; the fix is backend-only.

  Verified via `pnpm -r typecheck` (clean), `pnpm --filter @bloodchain/api
  test -- shipments` and `-- courier` (70 and 20 passing, both suites
  untouched — they test the service layer directly, not the controller
  wrapping), and live requests against the running dev API: `POST
  /organizations/:id/blood-requests` (a mutation, not just a GET) now
  returns `{ data: {...new request} }` where it previously returned the
  bare object with no envelope at all; `GET /organizations/:id/couriers`
  likewise now enveloped; `GET /courier/shipments` now includes the `meta`
  the collision had been hiding.
  - Files: `apps/api/src/modules/shipments/shipments.controller.ts`,
    `apps/api/src/modules/shipments/shipments.service.ts`,
    `apps/api/src/modules/shipments/dto/shipment.dto.ts`.

- [x] **P0-18. The mobile app had no real entry point — every cold start
  skipped the welcome/login screen entirely, landing directly in the
  booking flow regardless of whether the user was authenticated.** —
  Fixed. Found live by the user, on a real device, the first time they
  actually opened the app: it opened straight into "Book an Appointment"
  instead of a login screen.

  Root cause: Expo Router strips group-folder names (`(x)`) from the URL,
  so a group's `index.tsx` maps to the *literal root* `/`, not a path
  under the group's name. Two unrelated groups each had one —
  `(booking)/index.tsx` (the appointment-type picker) and
  `(onboarding)/index.tsx` (a "complete your profile" screen, itself
  already unreachable — nothing ever navigated to it automatically either)
  — so both silently resolved to `/`. There was also no auth-aware
  redirect anywhere: `app/_layout.tsx`'s `AuthBootstrap` component tracks
  `isLoading`/`isAuthenticated` in the Zustand store and renders a loading
  spinner, but never calls `router.replace(...)` or renders a `<Redirect>`
  based on that state — it only gates the spinner's visibility, not
  navigation. With no route deliberately owning `/`, the app fell back to
  whichever group's `index.tsx` the router resolved first, which the
  Expo Router-generated `.expo/types/router.d.ts` proved directly: it
  listed *two* separate route entries both claiming `pathname: '/'` (one
  per group) — mechanical confirmation, not just live-app symptom.

  Fixed by giving the app a real, singular entry point: added
  `app/index.tsx` (ungrouped, alongside the existing top-level
  `notifications.tsx`/`settings.tsx`/`sos.tsx`), which reads
  `isLoading`/`isAuthenticated`/`user` from the auth store and renders a
  `<Redirect>` to `/(auth)/welcome` when unauthenticated, or to
  `getPostAuthRoute(user.roles)` (the same helper `login.tsx`/
  `verify-email.tsx` already use post-authentication) when authenticated
  — reusing the existing role-based landing logic instead of duplicating
  it. Renamed the two colliding files out of the way of `/` —
  `(booking)/index.tsx` → `(booking)/select-type.tsx`,
  `(onboarding)/index.tsx` → `(onboarding)/complete-profile.tsx` — and
  updated the three call sites that navigated to the old bare group paths
  (`calendar.tsx`'s "Book Appointment" button, `home.tsx`'s "Complete
  Your Profile" banner, `appointment/[id].tsx`'s reschedule handler).

  While fixing this, found `apps/mobile/.expo/` — including the
  `router.d.ts` typed-routes file this whole bug was diagnosed through —
  was accidentally committed to git; Expo's own generated README inside
  that folder says explicitly it should never be shared, and normally
  ships pre-gitignored. A committed, stale copy is actively worse than
  none: it's exactly what let this route collision go undetected by
  typecheck for as long as it did, since `tsc` trusted the checked-in
  file instead of a freshly regenerated one. Untracked the whole directory
  and added `.expo/` to `apps/mobile/.gitignore` so it can't happen again;
  regenerated a fresh copy locally (via `expo start --offline`, since this
  sandbox has no route to Expo's version-check API) to verify the rename
  actually resolved the collision before untracking it.

  Not fixed, noted for follow-up: `appointment/[id].tsx`'s "Reschedule"
  button passes a `reschedule` query param through to the booking flow,
  but nothing in `(booking)/*` ever reads it — tapping Reschedule silently
  starts an ordinary new booking instead of calling the `rescheduleAppointment`
  API function that already exists and works (`src/api/appointments.ts`).
  Out of scope for this fix; flagged rather than bundled in since it's an
  unrelated gap, not part of the routing collision.

  Verified via `pnpm --filter @bloodchain/mobile typecheck` (clean —
  confirms the regenerated route types actually agree with every
  navigation call site in the app) and 4 new unit tests in
  `src/__tests__/root-index.spec.tsx` (renders nothing while loading;
  redirects to welcome when unauthenticated; redirects a courier to
  `/(courier)/active` and a donor to `/(app)/home` when authenticated —
  29/29 mobile tests passing overall). No simulator is available in this
  sandbox to confirm the redirect renders correctly on-device; that
  remains for the user's own phone, which is how this bug was found in
  the first place.
  - Files: `apps/mobile/app/index.tsx` (new),
    `apps/mobile/app/(booking)/select-type.tsx` (renamed from `index.tsx`),
    `apps/mobile/app/(onboarding)/complete-profile.tsx` (renamed from
    `index.tsx`), `apps/mobile/app/(app)/{calendar,home,appointment/[id]}.tsx`,
    `apps/mobile/.gitignore`, `apps/mobile/src/__tests__/root-index.spec.tsx`
    (new).

- [x] **P0-19. `apiRequest` had no timeout — a request to an unreachable
  API hung forever with no error, leaving the UI stuck on its loading
  state permanently.** — Fixed. Found live, same device-testing session
  as P0-18: after fixing the routing collision, the login screen reached
  correctly but "Sign in" got stuck on "Signing in..." indefinitely with
  no error message. Root cause wasn't app logic — `login.tsx`'s
  `onSubmit` already has a correct `try/catch` that clears the pending
  state and shows `serverError` on failure — it's that `apiRequestEnvelope`
  called bare `fetch()` with no `AbortController`/timeout at all, so a
  request to an unreachable host (wrong LAN IP, a firewall silently
  dropping packets, a dead dev server) never resolves *or* rejects.
  `login.isPending` stays `true` forever because the promise it's watching
  never settles — there was no way for the UI to recover short of force-
  quitting the app, and no signal telling the user *why*.

  Added `fetchWithTimeout` to `mobile/src/api/client.ts`: races every
  request against a 15s `AbortController` timeout, and — since a genuinely
  unreachable host can also reject `fetch()` immediately with a
  `TypeError` rather than hanging — catches that case too. Both now throw
  a real, catchable `ApiRequestError` (`REQUEST_TIMEOUT` /
  `NETWORK_ERROR`) instead of leaving the caller's promise unsettled,
  which every existing call site already knows how to handle (they all
  already catch `ApiRequestError` for server-side failures; this just
  makes connectivity failures arrive the same way instead of never
  arriving at all).

  Verified via 2 new unit tests in `client.spec.ts`: one uses fake timers
  and a mock `fetch` that only rejects when its `AbortSignal` actually
  fires, advances 15s, and asserts the promise rejects with
  `REQUEST_TIMEOUT` instead of hanging; the other mocks an immediate
  `TypeError` (matching React Native's real "Network request failed") and
  asserts `NETWORK_ERROR`. 8/8 `client.spec.ts` tests and 31/31 mobile
  tests overall passing. `pnpm --filter @bloodchain/mobile typecheck`
  clean.

  Also added a show/hide toggle to the login screen's password field
  (`Eye`/`EyeOff` from `lucide-react-native`, already a dependency) per
  direct user request during the same testing session — unrelated to the
  timeout fix, bundled here since it touches the same file.
  - Files: `apps/mobile/src/api/client.ts`, `apps/mobile/src/api/client.spec.ts`,
    `apps/mobile/app/(auth)/login.tsx`.

- [x] **P0-20. First line-by-line audit pass: no path to Register, unwired
  onboarding notification preferences, silent-error/stale-form-state bugs
  on two profile screens, a duplicate `/notifications` route, and every
  push-notification deep link except one pointed at a mobile route that
  doesn't exist.** — Fixed, all found during the full-codebase audit
  requested after P0-18/P0-19 ("check everything line by line, integration
  included, until the app is 100% working").

  **No way to create an account.** `welcome.tsx` only had a "Continue"
  button to Login; nothing anywhere in the reachable navigation graph
  pointed at `/(auth)/register`. A new user could never sign up from the
  app. Added a "Create an account" button on the welcome screen and a
  "Don't have an account? Create one" link on the login screen.

  **Onboarding's notification step was pure UI theater.** The "Complete
  Your Profile" wizard's Notifications step collected 4 toggle values
  (`emergencyRequests`, `appointments`, `donationReminders`, `system`) that
  were never sent anywhere — `handleFinish` only called the profile/donor
  update mutations. Wired it to `useUpdateNotificationPreferences`, and
  invalidated the `notification-preferences` query alongside the existing
  profile/donor invalidations. Also removed a dead `promotional` field that
  was tracked in state but never rendered as a toggle or read by any API
  call.

  **Silent error swallowing + stale initial form state**, the same two-bug
  pattern found independently on `complete-profile.tsx`, `profile/edit.tsx`,
  and `profile/donor.tsx`: (1) save/finish handlers caught failures with
  only `console.error(...)`, so a failed save just silently stopped
  spinning with zero explanation; (2) each screen's `useState` form
  initializer read from a `useQuery` hook's data only once, at mount — a
  screen reached before that query resolved showed permanently blank
  fields even after the fetch completed, since nothing re-synced. Fixed by
  adding an `ApiRequestError`-aware error state (shown near the submit
  button) and a `useEffect` that re-syncs form state whenever the query
  data changes, in all three screens.

  **Duplicate route collision at `/notifications`, same bug class as
  P0-18.** `app/notifications.tsx` (a dead placeholder stub — hardcoded
  "No notifications" `EmptyState`, no data fetching) and
  `app/(app)/notifications.tsx` (the real notification center) both strip
  to the same `/notifications` URL, since Expo Router drops group-folder
  names. Nothing in-app pushes the bare path (the one caller,
  `profile.tsx`, already used the fully-qualified `/(app)/notifications`),
  so this wasn't yet user-visible, but it was a live collision waiting for
  the next caller — and dead code besides. Deleted the stub.

  **Push-notification deep links were broken for almost every notification
  type.** `notification.deepLink` is read by exactly two places in the
  whole codebase, both in the mobile app only: the push-notification tap
  handler (`usePushNotifications.ts`) and the in-app notification list
  (`(app)/notifications.tsx`) — both call `router.push(deepLink)` directly.
  Checked every `deepLink` the backend emits against the real mobile route
  tree; all but two (`/donations/:id`, the level-up `/profile`) pointed at
  routes that don't exist:
  - SOS (`routeSosNotification` and the donor-accepted handler in
    `notification-event.handler.ts`): `/sos/${id}` — `sos.tsx` has no
    per-request detail route or `useLocalSearchParams` at all. → `/sos`.
  - Appointments: `/calendar/appointment/${id}` — no such route exists
    anywhere; the real screen is `(app)/appointment/[id].tsx`. →
    `/(app)/appointment/${id}`.
  - Lab results: `/health/tests/${id}` — no per-result detail screen
    exists. → `/(app)/laboratory` (the results list).
  - Achievements: `/profile/achievements/${id}` — no per-achievement
    detail screen exists. → `/(app)/gamification/achievements`.
  - Shipments: `/shipments/${id}` — the mobile app (couriers) has no
    shipment detail screen, only `/active` and `/history`. →
    `/(courier)/active`.
  - Inventory alerts: `/inventory/${id}` — the mobile app has no inventory
    concept at all (web-only feature); recipients are blood-center staff,
    who don't have a mobile client. → `/(app)/home` as a harmless fallback
    in case it's ever reached.
  - Security: `/profile/security` — the real screen is the top-level
    `(app)/security.tsx`, not nested under profile. → `/(app)/security`.
  - Level-up and AI insights (`/profile`, `/insights`): technically valid
    but ambiguous/inconsistent — `(app)/profile.tsx` and
    `(courier)/profile.tsx` both strip to `/profile`, so an unqualified
    path could resolve to either. Fully qualified both to `/(app)/profile`
    and `/(app)/insights` to remove the ambiguity, matching the pattern
    every other fix here now follows: always emit a group-qualified path
    for anything inside a route group.
  - AI insight notifications (`ai-notification.service.ts`) never had a
    working deep link at all in either case: `deepLink` was nested inside
    the `data: {...}` blob instead of passed as `CreateNotificationDto`'s
    actual top-level `deepLink` field, so `notification.deepLink` was
    always `undefined` on the client no matter what string was in there.
    Moved both call sites to set the real top-level field.

  Verified with 19 new/expanded tests in
  `notification-router.service.spec.ts` (one per notification type,
  asserting the exact `deepLink` string emitted) and 4 new tests in a new
  `ai-notification.service.spec.ts` (asserting `deepLink` lands as a
  top-level field, not under `data`, for both the insight-ready and
  analysis-failed paths). `pnpm --filter @bloodchain/api test` (notifications
  + ai-health: 100/100) and `pnpm --filter @bloodchain/mobile test` (31/31)
  both green; `typecheck` clean on both `@bloodchain/api` and
  `@bloodchain/mobile`.
  - Files: `apps/mobile/app/(auth)/welcome.tsx`, `apps/mobile/app/(auth)/login.tsx`,
    `apps/mobile/app/(auth)/register.tsx` (password show/hide toggle, same
    pattern as P0-19's login fix), `apps/mobile/app/(onboarding)/complete-profile.tsx`,
    `apps/mobile/app/(app)/profile/edit.tsx`, `apps/mobile/app/(app)/profile/donor.tsx`,
    `apps/mobile/app/notifications.tsx` (deleted),
    `apps/api/src/modules/notifications/services/notification-router.service.ts`,
    `apps/api/src/modules/notifications/services/notification-router.service.spec.ts`,
    `apps/api/src/modules/notifications/handlers/notification-event.handler.ts`,
    `apps/api/src/modules/ai-health/ai-notification.service.ts`,
    `apps/api/src/modules/ai-health/ai-notification.service.spec.ts` (new).

- [x] **P0-21. Booking flow audit: "Reschedule" silently created a
  duplicate appointment instead of rescheduling, and three of the five
  booking screens went permanently blank/stuck with zero explanation on a
  network error or an expired slot.** — Fixed, continuing the same
  line-by-line audit as P0-20.

  **"Reschedule" didn't reschedule.** `appointment/[id].tsx`'s
  `handleReschedule` pushed into the full new-booking flow
  (`select-type` → `organizations` → `date` → `time` → `review`) carrying a
  `reschedule` param that nothing downstream ever read — every booking
  screen's `router.push` calls only forwarded `organizationId`/`type`/
  `date`/`slotId`, dropping it at the first hop. Meanwhile
  `useRescheduleAppointment()` (which calls the real, already-correct
  `POST /appointments/:id/reschedule` backend endpoint — ownership check,
  RESCHEDULED-status handling, past-slot rejection, all already in place)
  was instantiated in `appointment/[id].tsx` and never called. Net effect:
  tapping "Reschedule" created a brand-new appointment and left the
  original one untouched and still on the calendar — a silent duplicate
  booking, not a reschedule.

  Fixed by making `handleReschedule` skip straight to `/(booking)/date`
  with the existing appointment's `organizationId`/`appointmentType`
  pre-filled (no need to re-pick type or organization for a reschedule)
  plus a `rescheduleAppointmentId` param, threaded through `date.tsx` →
  `time.tsx` → `review.tsx`'s subsequent `router.push` calls. In
  `review.tsx`, `handleConfirm` now branches: when
  `rescheduleAppointmentId` is present it calls
  `rescheduleMutation.mutateAsync({ id, input: { newSlotId } })` instead of
  `bookMutation`, and the removed dead `rescheduleMutation` from
  `appointment/[id].tsx` is now the one actually doing the work. Screen
  titles/button labels ("Reschedule Appointment" / "Confirm Reschedule" /
  "Appointment Rescheduled!") switch based on the same flag so the flow
  doesn't claim to be creating a new booking when it isn't.

  **Three booking screens had no error or not-found state at all.**
  - `organizations.tsx` and `time.tsx`: destructured `isLoading` from their
    `useQuery` hooks but never checked `isError` — a failed fetch (network
    error, unreachable API) resolved `isLoading` to `false` with empty
    data, which both screens rendered identically to "genuinely zero
    results" (a misleading "No organizations found" / "No available
    times" with no way to tell the difference or retry). Added an
    `isError` branch with a real retry button calling `refetch()`.
  - `date.tsx`: worse — `isLoading` was destructured but never referenced
    anywhere in the component at all. While the availability query was in
    flight (or had failed), the calendar rendered immediately with every
    day looking permanently disabled/grayed-out, no loading indicator, no
    error, nothing — this is the exact "app looks broken on open" failure
    mode the user hit live on their device with this same screen before
    P0-18/P0-19. Added a loading line and an `isError` + retry card above
    the calendar.
  - `review.tsx`: if either of its two independent queries (`slots` by
    date, `organizations`) failed, or the specific `slotId`/`organizationId`
    from the URL just wasn't in the result (e.g. someone else booked the
    slot in the few seconds since it was selected), the screen's only
    fallback was `if (!slot || !organization) return <AppText>Loading...</AppText>`
    — permanently, with no back button, no retry, no way out short of a
    hard app restart. Split into three real states: still loading, a load
    error with retry, and "this slot is no longer available" with a way
    back — all with a working Back button, which the stuck-forever branch
    never had.

  Verified via `pnpm --filter @bloodchain/mobile typecheck` (clean) and
  the full mobile test suite (31/31, unchanged — no existing render-test
  coverage exists for the booking screens to extend; these are static
  analysis + logic-reading fixes verified by reading every call site,
  matching the API's actual reschedule DTO shape
  (`RescheduleAppointmentDto.newSlotId`) against the mobile client's
  `RescheduleAppointmentInput`, and confirming no other screen still reads
  the old dead `reschedule` param name).
  - Files: `apps/mobile/app/(app)/appointment/[id].tsx`,
    `apps/mobile/app/(booking)/date.tsx`, `apps/mobile/app/(booking)/time.tsx`,
    `apps/mobile/app/(booking)/review.tsx`, `apps/mobile/app/(booking)/organizations.tsx`,
    `apps/mobile/app/(booking)/confirmation.tsx`.

- [x] **P0-22. Appointment cancellation reason box was decorative text, not
  a real input — cancellations always sent `undefined` regardless of what
  the user typed; two more "not found" dead ends and two more
  error-swallowed-as-empty screens.** — Fixed, continuing the same audit
  (donations, appointment detail, laboratory, health-trends).

  **Cancellation reason field was fake.** `appointment/[id].tsx`'s
  "Cancellation Reason" card, shown after tapping "Cancel Appointment",
  rendered a `<View>` containing static `<AppText>` placeholder copy
  ("Please provide a reason for cancellation (optional)...") — not a
  `TextInput`. The `cancelReason` state it was meant to feed
  (`useState('')`, sent as `reason: cancelReason.trim() || undefined` to
  the cancel mutation) had no `setCancelReason` call anywhere in the file,
  so it was permanently `''` no matter what a user believed they'd typed
  — every cancellation silently discarded the reason. Replaced the fake
  `View` with a real multiline `TextInput` bound to `cancelReason`/
  `setCancelReason`.

  **Two more "not found" dead ends**, same class as review.tsx's fix in
  P0-21: `appointment/[id].tsx`'s `if (!appointment)` branch and
  `donations/[id].tsx`'s `if (!donation)` branch both rendered a bare
  "not found" message with no footer, no back button — a hard-restart-only
  dead end if a deep link or stale list item pointed at an id that 404'd.
  Both now render a working "Go Back" button.

  **Fetch failures rendering identically to "genuinely nothing here"**,
  same pattern as P0-20/P0-21's `isError`-less queries, but here on plain
  `try/catch` state instead of React Query: `laboratory/index.tsx` and
  `health-trends/index.tsx` both `console.error`'d a failed fetch and left
  their state arrays empty, which both screens then rendered exactly like
  "you have no lab tests / no health trends yet" — indistinguishable from
  a real empty state, with no way to tell it actually failed.
  `health-trends/index.tsx` was the worse of the two: its empty/error
  branch returns before the `ScrollView`+`RefreshControl` even mounts, so
  on a fetch failure there was no pull-to-refresh either — a fully static
  dead screen. Added a `loadError` flag to both, with distinct copy and
  (since health-trends has no `RefreshControl` in that branch) an explicit
  Retry button that re-runs `loadSummary()`.

  Verified via `pnpm --filter @bloodchain/mobile typecheck` (clean) and
  the full mobile test suite (31/31, unchanged — no existing render-test
  coverage for these screens).
  - Files: `apps/mobile/app/(app)/appointment/[id].tsx`,
    `apps/mobile/app/(app)/donations/[id].tsx`,
    `apps/mobile/app/(app)/laboratory/index.tsx`,
    `apps/mobile/app/(app)/health-trends/index.tsx`.

- [x] **P0-23. Community feed's challenge/campaign cards were dead taps
  (`TouchableOpacity` with no `onPress` at all), and join/start/complete
  actions across campaigns, challenges, and education silently swallowed
  failures with zero user feedback.** — Fixed, continuing the same audit
  (gamification, community, campaigns, challenges, education).

  **Dead taps in the community feed.** `community/index.tsx`'s
  `ChallengeCard` and `CampaignCard` (the compact cards shown in the
  "Active Challenges" / "Active Campaigns" sections of the feed) were both
  wrapped in a `TouchableOpacity` with `activeOpacity={0.8}` — visually
  signaling they're tappable — but neither passed an `onPress` prop.
  Tapping either did nothing. There's no per-item detail route for either
  (`challenges/index.tsx` and `campaigns/index.tsx` are flat lists with
  the full card, including the Join button, inline — no `[id].tsx`), so
  the correct fix is routing to those list screens rather than inventing
  a detail route that doesn't exist: both cards now navigate to
  `/challenges` and `/campaigns` respectively.

  **Join/start/complete actions had no error path.** `campaigns/index.tsx`,
  `challenges/index.tsx`, and `education/index.tsx` each drive a
  `useMutation` (`joinCampaign` / `joinChallenge` / `startContent` /
  `completeContent`) with an `onSuccess` that invalidates the relevant
  queries — but no `onError` at all. A failure (network error, a campaign
  that expired between page load and tap, the backend's "must start before
  completing" rule if progress state goes stale) just silently stopped the
  button's spinner with nothing shown — same silent-failure pattern as
  P0-20 through P0-22, just on `useMutation`'s `onError` instead of a bare
  `try/catch`. Added an error state to all three screens, surfaced in a
  card above the list, cleared on the next successful action.

  (Checked whether "Join Campaign" needed an already-joined guard, since
  `Campaign` has no `hasJoined`/participation field for the client to key
  off of: the backend's `joinCampaign` is idempotent — a second join just
  returns the existing `CampaignParticipant` row, no conflict thrown — so
  this is a UI polish gap, not a functional bug, and out of scope here.)

  Verified via `pnpm --filter @bloodchain/mobile typecheck` (clean) and
  the mobile test suite, now 33/33: added 2 tests to the existing
  `community-screens.spec.tsx` asserting the challenge/campaign card taps
  call `router.push('/challenges')` / `router.push('/campaigns')`
  (via `tree.root.findAll` over the component-instance tree, since
  `onPress` is a prop `TouchableOpacity` consumes internally and never
  reaches the host node in `tree.toJSON()` — the file's other assertions
  walk the JSON tree, which doesn't see it), plus a mock for `expo-router`
  that the suite didn't previously need (`community/index.tsx` didn't
  import it before this fix).
  - Files: `apps/mobile/app/(app)/community/index.tsx`,
    `apps/mobile/app/(app)/campaigns/index.tsx`,
    `apps/mobile/app/(app)/challenges/index.tsx`,
    `apps/mobile/app/(app)/education/index.tsx`,
    `apps/mobile/src/__tests__/community-screens.spec.tsx`.

- [x] **P0-24. A second dead, unreachable stub screen (`app/settings.tsx`,
  same class as P0-20's `notifications.tsx`); the SOS emergency-response
  header was the wrong color on 3 of its 5 screens from a digit
  transposition typo; security.tsx's password fields lacked the show/hide
  toggle every other password field in the app now has.** — Fixed,
  continuing the audit (notifications, security, privacy, sos.tsx,
  settings).

  **Dead stub screen, unreachable from anywhere.** `app/settings.tsx`
  (top-level, not `(app)/settings.tsx`) was a placeholder — two `Card`s of
  static text ("Theme, language, and notification preferences will be
  configurable here" / "Manage consent for location sharing and data
  visibility") with zero interactive elements. No route anywhere in the
  app pushes `/settings`; `profile.tsx`'s real "Account" section already
  covers everything it stubbed out with working links to Personal
  Information, Donor Profile, Notifications, Privacy, and Security.
  Unlike P0-20's `notifications.tsx` stub, this one didn't collide with
  another route (nothing else claims `/settings`), so it was inert rather
  than a routing hazard — but still confirmed-orphaned dead code
  superseded by a real screen. Deleted.

  (`notifications.tsx`, `security.tsx`, and `privacy.tsx` were all
  otherwise fine: `notifications.tsx`'s deep-link handling now benefits
  from P0-20's fixes, and `privacy.tsx`'s all-`onPress`-less rows were
  already a deliberate, previously-documented call in P0-16 — no backend
  support exists for any of those settings, so `ListItem` already renders
  them as inert instead of falsely implying they're tappable. Confirmed
  both still hold; no changes needed to either beyond `security.tsx`'s
  fixes below.)

  **Header color typo across most of the SOS flow.** `sos.tsx` sets a dark
  maroon header background (`#26191F`, matching the app's emergency-red
  theme used elsewhere, e.g. `home.tsx`'s SOS card) on its loading and
  error states — but a transposed-digit typo, `#26119F` (a jarring
  blue-purple, nothing else in the app uses it), on the other 3 of 5
  states: viewing an emergency's details, actively responding/en
  route/arrived, and the default emergency list. A donor tapping into an
  active emergency response — the single highest-stakes screen in the
  app — saw the header color change to something visually unrelated to
  the emergency theme partway through the flow. Fixed all 3 to match.

  **`security.tsx`'s 3 password fields had no show/hide toggle**, the one
  screen in the app that didn't get this after P0-19 added it to login and
  P0-20 added it to register. Added the same `Eye`/`EyeOff` pattern to
  Current/New/Confirm Password.

  Verified via `pnpm --filter @bloodchain/mobile typecheck` (clean) and
  the full mobile test suite (33/33, unchanged — no existing render-test
  coverage for these screens).
  - Files: `apps/mobile/app/settings.tsx` (deleted),
    `apps/mobile/app/sos.tsx`, `apps/mobile/app/(app)/security.tsx`.

- [x] **P0-25. Courier's own profile screen spun on "Loading..." forever
  on any fetch failure, with no error and no way out; active.tsx and
  history.tsx had the same error-swallowed-as-empty gap already fixed
  elsewhere this session.** — Fixed, closing out the audit's screen sweep
  (courier: active, history, profile).

  **`(courier)/profile.tsx` was a genuine, permanent dead end.** Its
  guard was `if (isLoading || !profile) return <LoadingState />`. Once the
  initial fetch settles, `isLoading` is always `false` — but if
  `getCourierProfile()` failed, the `catch` block only `console.error`'d,
  so `profile` stayed `null` forever, and `!profile` kept the condition
  true. The screen never leaves the loading spinner: no error message, no
  retry, no way for a working courier to reach their own availability
  toggle short of a hard app restart — and if the underlying failure is
  systemic (backend down, bad auth), a restart doesn't fix it either. This
  is the same "stuck forever" class as P0-21's `review.tsx` fix, just with
  a spinner standing in for the earlier bare "Loading..." text. Split the
  guard into a real loading branch and a separate not-found/error branch
  with a Retry button.

  **`active.tsx` and `history.tsx`**: both `console.error`'d a failed
  fetch and left their list/shipment state at its initial empty value,
  which both screens then rendered identically to "you have no active
  delivery" / "no delivery history yet" — the same error-indistinguishable-
  from-empty pattern fixed in `laboratory/index.tsx` and
  `health-trends/index.tsx` under P0-22. Added a `loadError` flag to both,
  with distinct copy and an explicit Retry button (both already had
  `RefreshControl`, but a courier mid-delivery reading "No active
  delivery" when the real answer is "the request failed" is exactly the
  wrong message to give someone who needs to know whether they're still
  on the hook for a shipment).

  Verified via `pnpm --filter @bloodchain/mobile typecheck` (clean) and
  the full mobile test suite (33/33, unchanged — no existing render-test
  coverage for the courier screens).
  - Files: `apps/mobile/app/(courier)/active.tsx`,
    `apps/mobile/app/(courier)/history.tsx`,
    `apps/mobile/app/(courier)/profile.tsx`.

- [x] **P0-26. A session that died mid-use (expired or revoked refresh
  token) left the user permanently stuck on whatever screen they were on,
  seeing generic "request failed" errors forever, with no path back to
  login.** — Fixed. Specifically checked for this while auditing whether
  the protected `(app)`/`(courier)` route groups have any auth guard
  beyond the cold-start redirect.

  Confirmed neither `(app)/_layout.tsx` nor `(courier)/_layout.tsx` (both
  plain `Tabs` navigators, no auth logic at all) nor anything else re-
  checks auth once mounted — the *only* place session validity is ever
  checked is `app/index.tsx`'s cold-start redirect (P0-18) and
  `useAuthBootstrap`'s one-time effect on app launch. Neither runs again
  once the user is inside the app.

  Then found the actual failure path: `apiRequestEnvelope` in
  `api/client.ts` already handled a 401 correctly up to a point — it
  tries `refreshAccessToken()`, and on failure calls
  `deleteAccessToken()`/`deleteRefreshToken()` to wipe the now-invalid
  tokens from storage. But nothing else in the app watches SecureStore.
  The Zustand `useAuthStore`'s `isAuthenticated`/`user` state — the only
  thing any screen actually reads to decide what to show — was never
  touched, so it stayed exactly as it was before the session died. Every
  subsequent request from any screen would 401, fail to refresh again
  (already-deleted tokens), and throw the same generic `ApiRequestError`
  the screen's existing `catch` block shows as an ordinary error message
  — with no indication the real problem is "you're not logged in anymore"
  and no way to get back to login short of a manual app restart followed
  by, if the restart made it far enough for `app/index.tsx` to actually
  run its redirect, landing back at login (a device left open on a
  protected screen wouldn't even get that, since nothing in that flow
  re-runs while the app stays foregrounded).

  Fixed by making the refresh-failure branch also call
  `useAuthStore.getState().clearAuth()` and `router.replace('/(auth)/login')`
  directly from `client.ts` — the one place that actually observes the
  failure as it happens, regardless of which screen triggered it. Confirmed
  safe against `client.ts`'s existing `skipAuth` convention: every
  unauthenticated call (login, register, refresh itself, etc.) already
  passes `skipAuth: true`, so this branch can only ever fire for a call
  that was genuinely relying on a stored session, never during an
  unauthenticated flow. Checked for a circular-import risk from `client.ts`
  now importing the Zustand store (`auth.store.ts` in turn imports a
  *type* from `api/auth.ts`, which imports `client.ts`) — that edge is
  `import type`, erased at compile time, so no runtime cycle.

  Verified via a new test in `client.spec.ts`: seeds the store as
  authenticated, mocks the original request and the refresh attempt both
  returning 401, and asserts `isAuthenticated`/`user` are cleared and
  `router.replace('/(auth)/login')` was called. Required mocking
  `expo-router` in that spec file (same issue as P0-23's fix to
  `community-screens.spec.tsx`: the real package isn't transformable by
  this project's jest config). `pnpm --filter @bloodchain/mobile typecheck`
  clean; mobile tests now 34/34.
  - Files: `apps/mobile/src/api/client.ts`, `apps/mobile/src/api/client.spec.ts`.

- [x] **P0-27. A `FAILED` shipment (a courier reported a problem
  mid-delivery) had zero recovery action anywhere in blood-center-web —
  no button, of any kind, except cancelling the whole shipment outright —
  even though the backend already fully supports retrying it with a new
  courier.** — Fixed, closing out the audit's final task: re-checking the
  web apps' shipment/courier workflows this session's mobile fixes and
  P0-17's backend fix both touch.

  **Environment note**: this remote session has no Docker daemon and no
  local Postgres, so the live Playwright verification this task's earlier
  entries describe (real browser, real dev API, real seeded data) wasn't
  possible here — `docker compose ps` fails immediately
  (`JWT_ACCESS_SECRET is missing a value`), there's no `.env`, and no
  `postgres`/`pg_ctl` binary on the machine. Substituted a full static
  audit instead: read every blood-center-web/admin-web page that calls a
  P0-17-touched shipment/courier route end to end against the actual
  current backend service code (transitions, guards, what each endpoint
  actually does), the same rigor as a live check, just without a running
  browser to click through. This finding is exactly the kind a live click-
  through would have caught immediately (an operator would hit a shipment
  stuck at FAILED status with nothing to press) — worth flagging clearly
  since the depth of verification here differs from earlier entries.

  **The actual finding**: `shipments/[id]/page.tsx`'s only courier-related
  action button is gated by `canAssignCourier = status === 'CREATED' ||
  status === 'COURIER_DECLINED'`. `FAILED` is a real, reachable status —
  the mobile courier app's `active.tsx` has a working "Report a Problem"
  flow that calls `failShipment`, which the backend accepts and correctly
  releases the old courier back to `AVAILABLE`. But nothing in
  `ShipmentStateMachine`'s transition map is checked against the page's
  own gate: the map lists `FAILED` right alongside `CREATED`/
  `COURIER_DECLINED` as a valid source for the `COURIER_ASSIGNED`
  transition (`assignCourier` and `reassignCourier` both call the exact
  same `assertTransition(status, COURIER_ASSIGNED)` internally), so the
  backend was always willing to let an operator retry a failed shipment
  — the frontend just never offered the button. A `reassignShipment`
  client function already existed in `lib/shipments.ts`, already correctly
  typed and already imported into this exact page — genuinely dead code,
  never called from anywhere.

  Extended `canAssignCourier` to include `FAILED`, and branched
  `handleAssignCourier` to call `reassignShipment` (not `assignCourier`)
  when the shipment's current status is `FAILED`: `reassignCourier`
  additionally records `previousCourierId` on the shipment event and logs
  a distinct `SHIPMENT_REASSIGNED` audit action instead of the generic
  `SHIPMENT_COURIER_ASSIGNED`, which matters for the operational history
  of a shipment that failed once already — `assignCourier` would work
  functionally (the old courier is already freed by the time `FAILED` is
  reached) but would silently lose that context. Relabeled the button and
  modal copy to "Reassign Courier" for this case so the UI doesn't claim
  to be doing a first assignment when it isn't.

  Also checked `admin-web`'s shipments page (list-only, no detail route,
  no action buttons at all — filtering `FAILED` correctly but nothing to
  fix there) and blood-center-web's `couriers/page.tsx` (read-only roster,
  already correctly consuming the hand-wrapped `getCourierRoster`, no
  issues) and confirmed hospital-web's `confirmDelivery` (destination-side,
  distinct from blood-center-web's unused `confirmDeliveryFull`) is
  correctly wired — left `confirmDeliveryFull` alone since it's unused
  dead code with no evidence of what UI flow it was meant for, not a
  regression from anything touched this session.

  Verified via `pnpm --filter @bloodchain/blood-center-web typecheck`
  (clean) and its full test suite (24/24, unchanged — no existing
  component-level test harness for Next.js pages in this app to extend,
  only for `lib/*.ts` API client functions, which weren't touched).
  - Files: `apps/blood-center-web/app/shipments/[id]/page.tsx`.

- [x] **P0-28. The entire AI Health Insights feature and the entire Health
  Trends feature were completely non-functional for every user, always —
  every single API call in `ai-health.ts` and `health-trends.ts`
  double-unwrapped an already-unwrapped response, silently resolving to
  `undefined` on every call.** — Fixed. Found continuing the sweep past
  the original 9 planned tasks, auditing the mobile screens that hadn't
  been read yet (`calendar.tsx`, `donate.tsx`, `insights/index.tsx`) —
  reading `insights/index.tsx` led straight into this.

  **The bug, mechanically**: `apiRequest<T>` (in `api/client.ts`) already
  strips exactly one `{ data: ... }` envelope and resolves to `T` — this
  is the single, consistent contract every other client file in the app
  follows (confirmed as far back as P0-12/13/14/15/17 this session, and
  it's literally what `client.spec.ts`'s very first test exists to pin
  down). But every function in `ai-health.ts` (9 of them) and
  `health-trends.ts` (5 of them) called `apiRequest<{ data: T }>(url)` and
  then returned `response.data` — asking `apiRequest` to strip a second
  layer that was never there. At runtime, `response` was already the real
  `T` (an insight, a trend summary, an array — none of which have a
  `.data` field), so `response.data` was `undefined` on literally every
  successful call, unconditionally, for every user, since whenever these
  files were written.

  **Why nothing caught it for so long**: the two files failed in
  different, equally silent ways.
  - `ai-health.ts`'s callers (`insights/index.tsx`'s
    `handleExplainLatest`/`handleGenerateTrendInsight`/
    `handleGenerateQuestions`/`handleChat`) each immediately read a field
    off the `undefined` result (`insight.title`, `response.message.insight`)
    inside a `try` block, which threw and landed in the existing `catch`,
    showing "Insights are temporarily unavailable." — a message that reads
    as a plausible, ordinary backend hiccup. Every single tap of "Analyze
    My Results," "Summarize Trends," "Questions to Discuss," or sending a
    chat message failed this way, always, with no way to tell it was a
    client bug rather than a real outage.
  - `health-trends.ts`'s callers (`health-trends/index.tsx`,
    `health.tsx`) never even threw: `setSummary(undefined)` and
    `setAvailableParams(undefined)` are perfectly legal `useState` calls
    (React doesn't validate against the declared generic at runtime), and
    the screens' own empty-state guard is `if (!summary || ...)` —
    `!undefined` short-circuits to `true` before `availableParams.length`
    is ever evaluated, so the screen quietly rendered "No health trends
    yet," identical to a real empty state, for every user regardless of
    whether they actually had lab results. P0-22 earlier this session
    added a `loadError` distinction to this exact screen for a different
    reason (a genuine fetch failure looking like empty data) — that fix
    is still correct and necessary, but it couldn't have caught this,
    since this failure mode never throws at all; the promise always
    resolves, just to the wrong value.

  Fixed by removing the fabricated intermediate envelope type and letting
  `apiRequest<T>` return `T` directly, matching every other client file's
  actual pattern in the codebase — the fix is mechanical and identical
  across all 14 functions. Checked every other file under
  `apps/mobile/src/api/` for the same shape
  (`apiRequest(Envelope)?<\{\s*data`) and confirmed these were the only
  two; the two legitimate remaining `.data` accesses in `courier.ts` and
  `donations.ts` are on `apiRequestEnvelope`'s actual `{ data, meta }`
  return value (the meta-preserving variant, correct by design, unrelated
  to this bug).

  Also fixed a second, independent bug found while reading
  `insights/index.tsx` for this: `handleChat`'s `chatResponse` state was
  set on every chat reply but never rendered anywhere in the JSX — a
  plain conversational answer with no attached structured insight (the
  common case) vanished into state with nothing shown to the user, even
  once the double-unwrap fix made the underlying call actually succeed.
  Added a response block under the chat input that renders
  `chatResponse.message.content`.

  Verified with 13 new tests (`ai-health.spec.ts`, new; `health-trends.spec.ts`,
  new) mocking a correctly single-enveloped `{ data: ... }` fetch response
  for every one of the 14 fixed functions and asserting the resolved
  value is the real payload, not `undefined` — these tests would have
  failed against the pre-fix code (every one of them would have asserted
  `undefined` equals the expected payload and failed). `pnpm --filter
  @bloodchain/mobile typecheck` clean; mobile tests now 47/47 (34 + 13
  new).
  - Files: `apps/mobile/src/api/ai-health.ts`,
    `apps/mobile/src/api/ai-health.spec.ts` (new),
    `apps/mobile/src/api/health-trends.ts`,
    `apps/mobile/src/api/health-trends.spec.ts` (new),
    `apps/mobile/app/(app)/insights/index.tsx`.

- [x] **P0-29. Confirming Arrival / Completing Donation on a hospital's
  Emergency page always acted on whichever donor response happened to be
  first in the array, not the one that actually reached that status —
  wrong donor's response could be confirmed when multiple people
  responded to the same SOS request.** — Fixed, continuing the sweep into
  the web apps' remaining pages (hospital-web fully audited: dashboard,
  emergency, requests list/detail/new, shipments list/detail, analytics,
  register).

  `emergency.responses` can hold multiple donor responses to one SOS
  request (each with its own `status`: `ACCEPTED`/`EN_ROUTE`/`ARRIVED`/
  `DONATION_STARTED`/etc.) — the emergency's own aggregate `status` field
  reflects whichever response is currently furthest along, but
  `emergency/page.tsx`'s "Confirm Arrival" and "Complete Donation" buttons
  both grabbed `emergency.responses[0]` unconditionally — whichever donor
  happened to respond first, regardless of whether *that* response was
  the one that actually reached `ARRIVED` or `DONATION_STARTED`. With more
  than one responder (a realistic scenario for a CRITICAL request that
  matches several compatible donors), confirming arrival could act on a
  response that never arrived at all, while the one that did remains
  unconfirmed. Fixed both to find the response whose own `status` field
  actually matches (`responses.find(r => r.status === 'ARRIVED')` /
  `'DONATION_STARTED'`), instead of trusting array order.

  Also fixed the dashboard's (`app/page.tsx`) "No emergency requests...
  will appear here when the emergency module is enabled" — stale copy
  claiming a feature doesn't exist when it does: the sidebar already has
  a working "Emergency" link to `/emergency`, confirmed live in P0-16/17
  this session. Replaced with an honest link to the real page.

  The rest of hospital-web checked clean: requests list/detail/new,
  shipments list/detail, analytics, and register all correctly wired,
  no dead buttons, no stale envelope handling.

  Verified via `pnpm --filter @bloodchain/hospital-web typecheck` (clean)
  and its full test suite (19/19, unchanged — no existing component-level
  test harness for these Next.js pages to extend).
  - Files: `apps/hospital-web/app/emergency/page.tsx`,
    `apps/hospital-web/app/page.tsx`.

- [x] **P0-30. `inventory/page.tsx` shipped a one-click "Sign in as Blood
  Center Admin" button with the seeded admin password hardcoded directly
  in client-side JavaScript — anyone who loaded the page, signed in or
  not, could become a Blood Center Admin with a single click, no
  credentials needed. Plus the same stale "module not enabled" dashboard
  copy as hospital-web's P0-29.** — Fixed, continuing the web app sweep
  into blood-center-web (dashboard, requests list/detail, shipments —
  already covered by P0-27 — inventory, laboratory, appointments,
  analytics, register all checked).

  **The credential bypass**: `inventory/page.tsx`'s `!user` branch, unlike
  every other page in the app (`page.tsx`'s real email/password form,
  every other page's plain "please sign in" message with no button at
  all), rendered a "Sign in as Blood Center Admin" button whose
  `onClick` called `login('blood.center.admin@donor.local',
  'DevelopmentOnly!123')` — the seeded dev account's actual email and
  password, typed directly into the page's source, shipping to every
  browser that loads the bundle. Reaching `/inventory` without a session
  didn't ask for credentials at all; it handed out admin access in one
  click. This is exactly the kind of thing that's easy to miss in a dev
  environment (it "just works" for testing) and catastrophic if it ever
  reaches a real deployment with the seed password unchanged. Removed the
  button, the `handleLogin`/`handleLogout` functions it was the only
  caller of (now genuinely dead), and the unused `login`/`logout` imports
  — replaced with the same credential-free "Sign In Required" message
  every other page already uses correctly. Grepped every `.ts`/`.tsx`
  file across all three web apps for the seeded credentials string and
  confirmed this was the only occurrence.

  **The stale dashboard copy**: same pattern as P0-29 — `app/page.tsx`'s
  "No hospital requests... will appear here when the transfer module is
  enabled" claimed a feature didn't exist when `/requests` is a fully
  built, working page already linked in the sidebar; the "WORKSPACE" panel
  similarly claimed "Inventory, donor, and shipment modules are
  intentionally staged for future implementation" when Inventory,
  Laboratory, Shipments, and Couriers are all real, working, already-
  linked pages. Both replaced with copy that reflects what's actually
  there.

  Verified via `pnpm --filter @bloodchain/blood-center-web typecheck`
  (clean) and its full test suite (24/24, unchanged — no existing
  component-level test harness for these Next.js pages to extend).
  - Files: `apps/blood-center-web/app/inventory/page.tsx`,
    `apps/blood-center-web/app/page.tsx`.

- [x] **P0-31. Two stale-closure bugs where a filter/period `<select>`'s
  `onChange` called its data-reload function in the same tick as the
  `setState` that was supposed to change what it loads — reading the
  *previous* selection instead of the one just picked.** — Fixed, closing
  out the full web-app sweep (admin-web: dashboard, organizations, users,
  roles, emergencies, alerts, inventory, moderation, ai-analytics, audit,
  health, settings, shipments, couriers all checked).

  Both bugs share one root cause: `setState` in React doesn't apply
  before the current event handler finishes, so a function defined in
  this render still closes over the *old* value even after `setState` is
  called earlier in the same handler.

  - `alerts/page.tsx`: the "Acknowledged" filter's `onChange` called
    `setAcknowledgedFilter(e.target.value)` immediately followed by
    `loadAlerts(1)` — but `loadAlerts` read `acknowledgedFilter` from the
    render's closure, which was still the *previous* selection. Picking
    "Active" fetched with whatever was selected before; the just-picked
    value only took effect on the *next* change. Every other filtered
    list page in the app avoids this by pairing filters with an explicit
    submit button, so the fetch happens in a fresh event after the state
    update has already committed — `alerts/page.tsx` was the one page
    that reloaded inline instead.
  - `ai-analytics/page.tsx`: the date-range `<select>` only called
    `setDays(...)` with no reload at all — worse than the alerts bug, not
    off-by-one but entirely stale until the separate "Refresh" button was
    clicked, with nothing indicating the currently-displayed metrics
    didn't match the selected period.

  Fixed both the same way: `loadAlerts`/`loadData` now accept the
  filter/period value as an explicit parameter (defaulting to the current
  state value for existing callers like the initial mount and
  pagination), and the `onChange` handlers pass `e.target.value` directly
  instead of relying on state to have already updated.

  The rest of admin-web checked clean: dashboard, organizations, users,
  roles, emergencies, inventory, moderation, audit, health, settings,
  shipments, and couriers all correctly wired, no dead buttons, no
  double-unwrap, no other stale-closure reloads.

  Verified via `pnpm --filter @bloodchain/admin-web typecheck` (clean)
  and its full test suite (14/14, unchanged — no existing component-level
  test harness for these Next.js pages to extend).
  - Files: `apps/admin-web/app/alerts/page.tsx`,
    `apps/admin-web/app/ai-analytics/page.tsx`.

- [x] P0-32: Mobile app launched to a screen that was roughly half-covered by
  a stuck loading spinner, with a broken tab bar showing ~19 tiny unlabeled
  squares instead of the 6 real tabs — live screenshot from the user.
  — Fixed: two independent bugs, both in the root/tab layout files, neither
  caught by typecheck or the existing test suite because layout-composition
  bugs like these don't surface as type errors.

  1. **Root layout rendered the loading spinner and the navigator as
     siblings instead of one replacing the other.**
     `app/_layout.tsx` had:
     ```tsx
     <AuthBootstrap />   {/* flex:1 spinner View while isLoading, else null */}
     <Stack ... />        {/* always rendered, unconditionally */}
     ```
     Both are direct children of `SafeAreaProvider`'s root View, which uses
     React Native's default column flex layout. When `isLoading` was true,
     the spinner View (`flex: 1`) and the Stack navigator (also `flex: 1`
     internally) each claimed a share of the screen height instead of the
     spinner replacing the navigator — the spinner ate roughly half the
     screen, permanently, on top of the real screen content, exactly
     matching the user's screenshot (a large blank/spinner area sitting
     above a cut-off "Good morning" header). Fixed by merging the two into
     one `AppContent` component that returns *either* the spinner *or* the
     `<Stack>`, never both, while still calling `useAuthBootstrap()` and
     `usePushNotifications()` unconditionally on every render so bootstrap
     keeps working.

  2. **The donor tab bar auto-registered every route file under `(app)/`
     as a tab, not just the 6 intended ones.** Expo Router's `<Tabs>`
     navigator shows a tab bar item for every route in its directory
     unless the route is explicitly excluded with `href: null`. Only 6 of
     the ~19 routes under `app/(app)/` were declared in
     `_layout.tsx` (home, health, donate, community, calendar, profile);
     the rest — `notifications.tsx`, `privacy.tsx`, `security.tsx`, and
     the `appointment/`, `campaigns/`, `challenges/`, `donations/`,
     `education/`, `gamification/`, `health-trends/`, `insights/`,
     `laboratory/`, `profile/donor.tsx`, `profile/edit.tsx` routes (all of
     which are correctly navigated to via `router.push(...)` from
     elsewhere in the app, never meant to be tabs) — got silently pulled
     into the tab bar with no icon or title, rendering as a long row of
     tiny empty squares that overflowed the screen width. Fixed by adding
     explicit `<Tabs.Screen name="..." options={{ href: null }} />` entries
     for all of them, so they stay navigable but don't show as tab items.

  Added a regression test (`src/__tests__/root-layout.spec.tsx`) asserting
  the spinner and the navigator are mutually exclusive — mounts
  `RootLayout` with mocked auth/push hooks, asserts zero `<Stack>` markers
  while `isLoading` is true and zero spinners once it's false, which fails
  under the old sibling-rendering code. No equivalent automated check
  exists for the tab-registration bug (would require rendering the real
  `expo-router` `<Tabs>` navigator, which isn't exercised anywhere in this
  suite); verified instead by enumerating every file/directory under
  `app/(app)/` and cross-checking each one has a corresponding
  `<Tabs.Screen>` entry (visible or `href: null`) in `_layout.tsx`.
  Verified via `pnpm --filter mobile typecheck` (clean) and
  `pnpm --filter mobile test` (6/6 suites, 49/49 tests, including the 2 new
  regression tests).
  - Files: `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(app)/_layout.tsx`,
    `apps/mobile/src/__tests__/root-layout.spec.tsx` (new).

- [x] P0-33: `GET /users/:id` had no role or ownership check at all — any
  authenticated user (a donor, a courier, anyone with a valid access
  token) could fetch any other user's full profile by ID, including
  email, phone, date of birth, and last-login timestamp.
  — Fixed: found during a systematic sweep of every controller in
  `apps/api/src/modules` for route handlers with no `@Roles`/
  `@RequirePermissions`/`@Public()` decorator (the app applies
  `JwtAuthGuard`, `RolesGuard`, and `PermissionsGuard` globally via
  `APP_GUARD`, and both `RolesGuard`/`PermissionsGuard` default to
  *allow* when a route carries no decorator — so a route missing one
  isn't rejected, it's silently open to every authenticated user
  regardless of role).

  `users.controller.ts`'s `findOne` (`GET /:id`) called
  `this.users.findById(id)`, which does a plain `findUnique` with no
  ownership filter and selects `email`, `phone`, `dateOfBirth`,
  `lastLoginAt`, `emailVerified`, `phoneVerified` alongside the public
  fields — a straight IDOR. Every sibling `:id` lookup in this codebase
  (`appointments.controller.ts`'s `getAppointment`,
  `donations.controller.ts`'s `getDonation`) passes the requesting
  user's ID into the service and throws `ForbiddenException` unless the
  caller owns the record or holds staff/admin membership on the relevant
  organization — `findOne` was the one place that pattern was missing.
  No client in the repo calls this route at all (admin-web's user detail
  page uses the separately-guarded `/admin/users/:id` instead), so
  nothing depended on the open access.

  Restricted it the same way as `list()` two lines above it in the same
  controller (also an admin-only user lookup): added
  `@UseGuards(RolesGuard)` and
  `@Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)`.

  Also audited every other unguarded route the same sweep surfaced —
  `ai-health`, `auth` (logout/me/sessions), `campaigns`, `challenges`,
  `community`, `donations` (`me`, `me/statistics`, `:id`), `education`,
  `gamification`, `health-trends`, `laboratory` (reference data),
  `notifications`, `organizations` (`discover`, `:id`),
  `appointments` (`:id`) — every one of these is either genuinely public
  reference/discovery content, a `@CurrentUser`-scoped self-service
  endpoint, or (for the `:id` lookups on `appointments`, `donations`,
  `notifications`) already enforces ownership inside the service layer
  the same way `appointments`/`donations` do above. `users.controller.ts`
  was the only real gap.

  Added `users.controller.spec.ts`: drives the real `RolesGuard` against
  the controller's real decorator metadata (the same mechanism Nest uses
  at request time) and asserts a `DONOR` and a `COURIER` are rejected
  while `SUPER_ADMIN`/`HOSPITAL_ADMIN`/`BLOOD_CENTER_ADMIN` are allowed —
  fails under the old undecorated handler, since `RolesGuard` returns
  `true` for every role when a route carries no `@Roles` metadata.
  Verified via `pnpm --filter @bloodchain/api typecheck` (clean) and its
  full unit suite (`pnpm --filter @bloodchain/api test`: 58/58 suites,
  684/684 tests, including the 5 new ones). Live e2e verification against
  a running Postgres instance was not possible in this environment (see
  P0-27's note on the missing Docker/Postgres in this sandbox); the fix
  and its test were verified statically against the real guard
  implementation instead.
  - Files: `apps/api/src/modules/users/users.controller.ts`,
    `apps/api/src/modules/users/users.controller.spec.ts` (new).

- [x] P0-34: Mobile app's entire visual design was hardcoded to a single
  flat dark palette with no light-mode support and no real glass/blur
  treatment anywhere — a full "Apple Liquid Glass" redesign with working
  light and dark themes, requested directly by the user with a reference
  mockup.
  — Fixed: this is a large, cross-cutting change touching the theme
  system, every shared UI component, both tab bars, and all ~40 screens.
  Summary of the work:

  **New theme system** (`src/theme.tsx`, replacing the old static
  `src/theme.ts`): defines a light and a dark color palette that share
  the same brand accent hues (primary/secondary/ai/success/warning/
  danger — unchanged, since they already read cleanly on both a
  near-black and a near-white background) but differ on every surface
  token — background, backgroundGradient (a soft two-stop wash instead
  of a flat color, matching the reference mockup's ambient gradient),
  surface/surfaceElevated/surfaceHighlight (translucent, for real glass
  cards), surfaceSolid/surfaceSolidElevated (opaque, for text inputs and
  non-blur fallbacks), text/textMuted, border/borderSubtle, and a full
  set of *Muted tint tokens per accent color for badges. A `ThemeProvider`
  wraps the app, resolving the active scheme from `useColorScheme()`
  (so both light and dark work automatically, following the system
  setting the way Apple's own apps do) with a manual override capability
  already wired in (`setPreference('light' | 'dark' | 'system')`,
  persisted via `expo-secure-store`) for a future in-app toggle. A
  `useTheme()` hook exposes `{ colors, scheme, isDark, setPreference }`
  to every component. `spacing`/`typography` are unchanged; `radius` was
  softened slightly (`md` 16→18, `lg` 24→26, `xl` 32→34) for a rounder,
  more "liquid" look that applies everywhere automatically.

  **Real glass components**: `GlassCard` now wraps its content in a real
  `expo-blur` `BlurView` on iOS (native `UIVisualEffectView` blur) with a
  theme-correct tint and a soft shadow; Android renders the same
  translucent tinted surface without the native blur layer, since
  `expo-blur`'s Android blur path is still marked experimental upstream
  (perf/rendering issues warned in its own type definitions) and
  unverifiable without a physical device in this environment — rather
  than ship an untested rendering path, Android gets the reliable
  translucent-tint fallback. `Screen` now paints its background with the
  ambient `backgroundGradient` via `expo-linear-gradient` instead of a
  flat color. `Modal` got the same iOS blur treatment. `Card` got a
  proper elevation shadow (subtle in light mode, stronger in dark).

  **New glass tab bar** (`src/components/GlassTabBar.tsx`): replaces
  React Navigation's default flat bar entirely via the `tabBar` render
  prop (added `@react-navigation/bottom-tabs` as a direct dependency —
  it already existed transitively through `expo-router` at the exact
  same version, `7.18.17`, confirmed in the lockfile, so this resolved
  from the local pnpm store with no network access needed). Icon-only
  (no labels, matching the reference image), with a colored pill
  backdrop behind the focused icon, a blurred/tinted rounded container,
  and a soft shadow. Deliberately docked (not `position: absolute`) so
  scroll content never needs manual bottom-inset padding to avoid being
  hidden behind a floating bar — it still reads as a rounded, inset
  "glass pill" without the overlap risk. Used by both `(app)/_layout.tsx`
  (6 tabs) and `(courier)/_layout.tsx` (3 tabs).

  **All ~40 screens migrated** from the old static `import { colors } from
  '../../src/theme'` to `useTheme()`. Where a screen had a module-scope
  `StyleSheet.create({...})` referencing colors (which can't be reactive,
  since it's evaluated once at import time), it was converted to a
  `createStyles(colors: ThemeColors)` function called inside the
  component via `useMemo(() => createStyles(colors), [colors])`; helper
  components declared outside the main component (e.g. `ChallengeCard`,
  `CampaignCard`, `FeedPostCard` in the community screens) each call
  `useTheme()` independently since they don't have access to the parent's
  closure. Also swept for and fixed hardcoded hex literals that bypassed
  the theme entirely and would have stayed dark-only in light mode —
  `#26191F`/`#111A24`/`#1a1f2e` gradient pairs (profile, home screens),
  `#5B3038` danger borders (home, donate screens), `#080D14` transition
  backdrops (booking/onboarding layout screenOptions). Text input
  backgrounds specifically use `colors.surfaceSolid` rather than the
  translucent `colors.surface`, since a glass-tinted input field would be
  illegible against the app's own background, especially on Android with
  no blur. Genuinely theme-invariant accent literals (urgency-level
  colors in the SOS screen, badge-rarity colors in gamification) were
  left as-is, matching the same reasoning as the brand accent colors.

  **Tests**: `src/components/GlassTabBar.spec.tsx` (new, 4 tests) drives
  the real component with fake React Navigation props and asserts it
  renders exactly one button per route handed to it (regression coverage
  for the exact class of bug P0-32 was — a navigator silently showing
  more tabs than intended), and that tapping an unfocused vs. focused tab
  fires navigation correctly. `src/__tests__/community-screens.spec.tsx`
  needed updates: added a `useColorScheme` mock pinning the resolved
  theme to dark so its existing assertions against the static dark
  `colors` export stay meaningful regardless of the test environment's
  own system scheme (which resolved to light by default, unrelated to
  the app) — jest-expo's `useColorScheme` default isn't something the
  app controls; and the `colors.background` hex-string assertion was
  replaced with `colors.text`/`colors.border`, since `Screen`'s
  background now paints via a `LinearGradient` `colors` prop, which
  React Native serializes to processed native color integers rather than
  the original hex string, so it can no longer be substring-matched.

  Live visual verification was not possible in this environment (no
  simulator, no device, no rendering capability of any kind for React
  Native) — every claim about how this looks is inference from the
  properties passed to real native APIs (`BlurView`, `LinearGradient`),
  not a screenshot. Verified via `pnpm --filter mobile typecheck`
  (clean) and `pnpm --filter mobile test` (7/7 suites, 53/53 tests) plus
  a full `pnpm -r typecheck` and `pnpm -r test` across all 10 workspace
  projects (all clean, including the unrelated apps unaffected by this
  change) to confirm nothing else regressed.
  - Files: `apps/mobile/src/theme.tsx` (new, replaces `src/theme.ts`),
    `apps/mobile/src/components/*.tsx` (all ~20, including 2 new:
    `GlassTabBar.tsx`, `GlassTabBar.spec.tsx`), `apps/mobile/app/_layout.tsx`,
    `apps/mobile/app/(app)/_layout.tsx`, `apps/mobile/app/(courier)/_layout.tsx`,
    `apps/mobile/app/(booking)/_layout.tsx`, `apps/mobile/app/(onboarding)/_layout.tsx`,
    all ~40 screen files under `apps/mobile/app/`,
    `apps/mobile/src/__tests__/community-screens.spec.tsx`,
    `apps/mobile/package.json`, `pnpm-lock.yaml`.

- [x] P0-35: The P0-34 "Liquid Glass" redesign shipped with no visible glass
  at all — on a real device every card rendered as a flat opaque box, exactly
  the look the redesign was supposed to replace. Reported with a screenshot
  of the Donate screen.
  — Fixed: two independent bugs, both of which P0-34's own verification was
  structurally incapable of catching (typecheck and unit tests confirm props
  and colors, and cannot see that a surface renders flat).

  1. **`Card` was never converted, and ~29 of the ~40 screens use `Card`,
     not `GlassCard`.** The redesign gave `GlassCard` a real `BlurView` but
     left `Card` as the old flat opaque surface, so the new look only ever
     reached the handful of screens that happened to name `GlassCard`
     explicitly. The Donate screen in the screenshot is built entirely from
     `Card` — hence solid boxes. Fixed at the root rather than by editing 29
     screens: since the app's design language *is* glass now, `Card` simply
     renders `GlassCard`, so every screen built on either name gets the same
     real surface.

  2. **Blur was gated behind `Platform.OS === 'ios'`.** P0-34 deliberately
     disabled the Android path because `expo-blur` marks it experimental —
     but Android is the platform the app is actually being tested on, so
     that "safe" fallback guaranteed zero blur for the only user looking at
     it. A design that doesn't exist on the platform in use isn't a safer
     tradeoff, it's a broken one. Now enabled everywhere via
     `experimentalBlurMethod="dimezisBlurView"` (in `GlassCard`, `Modal`,
     and `GlassTabBar`), accepting the documented overdraw cost.

  Also addressed why the glass would have read as weak even once mounted:
  blur smears whatever is *behind* a panel, so a flat single-color
  background blurs to that same flat color and looks like nothing happened.
  `Screen` now paints three soft, wide ambient color blooms (`ambientOrbs`,
  in the brand's primary/secondary/ai hues) behind the content under a
  3-stop background gradient, giving the blur real color variation to pick
  up. Glass panels also gained a top-lit specular gradient
  (`glassSheen`) and a brighter lit edge (`glassBorder`) — a flat
  translucent fill reads as "semi-transparent box", the highlight is what
  makes it read as glass. Blur intensities raised (cards 24→42/55,
  tab bar 30→50/65, modal 40→60).

  Added `src/components/Card.spec.tsx` (4 tests) asserting what actually
  broke and what no other test could see: that `Card` — the component the
  bulk of the app is built from — really does mount a `BlurView`, that
  `GlassCard` does too, and that `experimentalBlurMethod` is set so blur
  isn't silently iOS-only again. Updated `community-screens.spec.tsx`'s
  border assertion from `colors.border` to `colors.glassBorder` to match
  the new panel edge token.

  Still unverified visually: this environment has no simulator, device, or
  any React Native rendering capability, so as with P0-34 these are claims
  about props reaching real native APIs, not about pixels. That limitation
  is precisely how P0-34 shipped broken, and the new tests exist to convert
  as much of it as possible into something machine-checkable.
  Verified via `pnpm --filter mobile typecheck` (clean) and the full
  monorepo `pnpm -r typecheck` / `pnpm -r test` (all 10 projects clean;
  mobile 8/8 suites, 57/57 tests).
  - Files: `apps/mobile/src/components/Card.tsx`,
    `apps/mobile/src/components/GlassCard.tsx`,
    `apps/mobile/src/components/GlassTabBar.tsx`,
    `apps/mobile/src/components/Modal.tsx`,
    `apps/mobile/src/components/Screen.tsx`, `apps/mobile/src/theme.tsx`,
    `apps/mobile/src/components/Card.spec.tsx` (new),
    `apps/mobile/src/__tests__/community-screens.spec.tsx`.

- [x] P0-36: Two more bugs found by tracing code against a home-screen
  screenshot (stuck spinner, tab bar showing ~19 tiny broken squares
  clustered left with dead space) rather than pixels, since this environment
  cannot render React Native.
  1. **The custom `GlassTabBar` ignored Expo Router's `href: null`
     convention.** `href: null` compiles to `tabBarItemStyle: {display:
     'none'}` + `tabBarButton: () => null`, which only React Navigation's
     *default* tab bar honors natively — a custom `tabBar` render prop
     receives the raw, unfiltered `state.routes` and has to filter itself.
     `GlassTabBar` didn't, so every hidden route still rendered a button.
     Fixed by filtering to `visibleRoutes` before rendering and matching
     focus by route `key` instead of the now-mismatched array index.
  2. **Accent text on its own muted-tint background failed contrast.** Badge
     variant text read the raw brand accent color (e.g. `colors.success`) on
     that same color's low-alpha tint background — a mid-tone-on-near-black
     combination in dark mode, well under 4.5:1 for small text. Added
     `colors.onMuted.*`, a per-mode shade shifted lighter (dark) or darker
     (light) than the raw accent, and switched `Badge` and 6 screens'
     inline muted-tint text to read from it.
  - Verified: `GlassTabBar.spec.tsx` extended with 3 new tests, confirmed to
    genuinely fail against the old unfiltered/index-based code before the
    fix (temporary revert-and-rerun). Full monorepo typecheck/test clean.
  - Files: `apps/mobile/src/components/GlassTabBar.tsx` (+`.spec.tsx`),
    `apps/mobile/src/theme.tsx`, `apps/mobile/src/components/Badge.tsx`,
    6 screen files under `apps/mobile/app/`.

- [x] P0-37 to P0-40: Web ecosystem (hospital-web, blood-center-web,
  admin-web) had no Liquid Glass design language at all — flat, dark-only
  (admin-web light-only) hardcoded hex panels with no blur, no light mode,
  and no shared vocabulary with the mobile app or each other, directly
  contradicting the "one visual language across the whole ecosystem"
  requirement.
  - **P0-37 — shared token layer.** Added `packages/ui/src/styles/glass.css`
    (CSS-variable surface/text/border tokens in light + dark, an ambient
    page-wash gradient, a 3-level glass material hierarchy —
    `.bc-glass`/`.bc-glass-elevated`/`.bc-glass-chrome`/`.bc-solid` — plus
    `prefers-reduced-transparency`/`prefers-reduced-motion` fallbacks) and
    `packages/ui/src/tokens/tailwind-preset.ts` (a `bloodchaingaPreset` that
    re-points the ~630 already-in-use `donor-*` Tailwind class names at
    those variables via `rgb(var(--x) / <alpha-value>)`, so existing markup
    restyles without being rewritten). Verified end-to-end with real
    production builds, not just typecheck, grepping the compiled CSS output
    for the tokens.
  - **P0-38 — shared component library.** Restyled the 14 shared web
    dashboard components (Sidebar, Topbar, DashboardShell, StatCard,
    StatusBadge, DataTable, EmptyState, ErrorState, LoadingState, FilterBar,
    SearchInput, Modal, Drawer, LocationMap) from hardcoded hex onto the
    token system, applying the glass hierarchy by role (chrome vs. content
    vs. elevated vs. solid-for-inputs). Added matching `onXMuted` contrast
    tokens (same fix and same values as P0-36's mobile `onMuted`) so
    StatusBadge/StatCard's tinted variants keep 4.5:1 text contrast.
  - **P0-39 — hospital-web / blood-center-web pages.** The shell restyle
    alone wasn't enough: every page-level card was `bg-donor-surface`
    (correctly theme-aware color, but no `backdrop-filter`) rather than
    `bc-glass` — translucent color with nothing to blur reads as a flat
    panel, the same root cause as P0-35 on mobile. Converted 82 card
    instances across 20 page files, and unified the danger color (pages
    mixed Tailwind's stock `red-*` palette with the brand's `donor-danger`
    — two different reds in one app) across 41 occurrences.
  - **P0-40 — admin-web.** The one app using an entirely separate, raw
    Tailwind gray/white/red/green/amber/blue/purple/orange palette with no
    `donor-*` usage and no dark mode. Remapped all raw color classes across
    its 15 pages (782 substitutions) onto the shared tokens, converted its
    36 flat white cards and 5 inline modals to glass materials, and removed
    a dead, unused shadcn-shaped color/radius block from its Tailwind config
    (a second, unused design language sitting beside the real one).
  - Verified: full monorepo `pnpm -r typecheck` and `pnpm -r test` clean
    (all 10 projects; mobile 8/8 suites/60 tests, api 58/58 suites/684
    tests, ui 13/13 spec files/73 tests), and real production `next build`
    for all three web apps after every change, not just after the final one.
  - Files: `packages/ui/src/styles/glass.css` (new),
    `packages/ui/src/tokens/tailwind-preset.ts` (new),
    `packages/ui/src/components/**` (data/feedback/form/layout/overlay/map),
    `apps/{hospital,blood-center,admin}-web/tailwind.config.ts`,
    `apps/{hospital,blood-center,admin}-web/app/globals.css`,
    ~35 page files under `apps/{hospital,blood-center,admin}-web/app/`.

- [x] P0-41 to P0-49: Full design audit against the user-supplied Figma Make
  reference (`apps/mobile/Create Design/`) and a systematic fix pass across
  the entire ecosystem — mobile, hospital-web, blood-center-web, admin-web.
  - **P0-41 — the audit.** Ran 4 parallel deep-dive agents (one per app) and
    compiled every finding into `DESIGN_VULNERABILITIES.md` (repo root):
    181 grouped findings (56 high / 83 medium / 42 low), categorized as
    `color`/`contrast`/`glass-material`/`icon`/`navigation`/`spacing`/
    `placeholder`/`dead-code`, each with file:line and severity.
  - **P0-42 — mobile home/profile gradient + reference-design integration.**
    Merged the reference export into `apps/mobile/Create Design/`
    (tsconfig-excluded, reference-only). Fixed dull `GradientCard`s on
    Home/Profile's Blood Type hero (`[dangerMuted, surfaceSolid]` →
    `[primary, ai]`) and Profile Completion card, with hardcoded
    white/near-white text for the now-saturated backgrounds. Replaced
    Home's fake "Health: — / No data yet" stat with 3 real cards
    (donations, volume, XP via `useGamificationProfile`). Bumped ambient
    bloom opacity on web to match the reference's `ColorBlooms` values.
  - **P0-43 — input-background unification + admin-web icon/hover/link
    sweep.** Unified hospital-web/blood-center-web form controls onto
    `bc-solid`, fixed `donor-border`-as-opaque-fill contrast bugs found
    independently in both apps (~19 + several more instances), fixed a
    regex substring bug from P0-40's automated sweep (`bg-green-50`
    matching inside `bg-green-500` → garbled `Muted0` classes, 3 instances).
    Rewrote admin-web's `Toggle` component and Maintenance Mode card
    (flat → glass), fixed 21+ icon-on-Muted-tile contrast bugs, no-op
    hovers, and danger-red-misapplied-to-neutral-links across
    users/moderation/couriers/organizations/roles pages.
  - **P0-44 — mobile alpha-hack contrast sweep.** The `colors.X + '20'`/
    `` `${expr}20` `` hex-alpha-concat pattern (raw accent directly on its
    own low-alpha tint, failing 4.5:1 contrast) existed in two shapes: a
    string-concat form (13 screens) and a template-literal form on a
    function call, which the first sweep's regex missed and was only
    caught later in `sos.tsx`'s `getUrgencyColor`. Converted every instance
    to the `XMuted` background + `onMuted.X` text/icon pair across
    home/profile/appointment/donations/laboratory/health/insights/
    calendar/sos/the full booking flow/campaigns/challenges/education/
    gamification, plus the shared `GlassTabBar`/`StatCard`/`ErrorState`/
    `AchievementCard`/`LeaderboardItem`/`IconButton` components. Also fixed
    `sos.tsx`'s HIGH/MEDIUM urgency hardcoded hex (`#F97316`/`#EAB308`) and
    a leftover flat `surfaceSolid` button on the gamification hub.
  - **P0-45 — mobile navigation: back buttons + orphaned screens.** Root
    cause: the `(app)` Tabs navigator and root Stack both set
    `headerShown: false`, so `<Stack.Screen options={{headerLeft}}>` used
    by `laboratory`/`health-trends`/`insights`/`sos.tsx` never rendered —
    there was no native header for those options to attach to. Added a new
    shared `ScreenHeader` component (back `IconButton` + title/subtitle)
    and wired it into every pushed screen that had no back affordance at
    all: notifications/privacy/security/campaigns/challenges/donations/
    education/the gamification hub+achievements+badges+leaderboard/
    select-type/appointment-detail/donation-detail, in place of the dead
    `Stack.Screen` calls or bare title text. Also fixed 2 completely
    unreachable screens (`education`, `insights` — nothing in the app
    linked to either): made Community's "Education" impact stat tappable,
    added an "AI Insights" teaser card to the Health screen.
  - **P0-46 — real dashboard stats + functional booking notes field.**
    hospital-web's and blood-center-web's landing dashboards permanently
    hardcoded their `StatCard`s (`"—"`/"Connect your API to view",
    `"Ready"`/"Foundation workspace") and a fake "System healthy" status
    panel — the first screen either app's users see was fake, despite each
    app's own `analytics/page.tsx` proving the real KPI endpoints already
    existed. Wired both to `getOverviewAnalytics`/`getAlerts` (plus
    `getLaboratoryAnalytics`/`getShipmentAnalytics` for blood-center-web)
    and replaced the fake status panel with a real inventory summary +
    critical/high alert counts. Separately, the mobile booking review
    screen's "Notes (Optional)" field rendered a static placeholder
    `AppText` instead of a `TextInput` — anything typed there had nowhere
    to go and was silently dropped from the booking request.
  - **P0-47 — DataTable/Link/Modal migrations.** blood-center-web's
    `laboratory/page.tsx` hand-built its own `<table>` despite importing
    `DataTable`/`DataTableColumn`, which is how it ended up with the
    invalid `bg-donor-surfaceElevated` class (silently dropped by
    Tailwind — sticky header and row-hover got no background) and a
    "Refresh" button rendering the `Filter` icon instead of `RefreshCw`.
    Migrated to `DataTable` with a `columns` array, fixing both. hospital-web's
    `requests`/`requests/[id]`/`shipments` pages used raw `<a href>` for
    internal navigation instead of `next/link`'s `Link` — the exact
    full-page-reload defect `AppShell.tsx`'s own doc comment describes
    fixing for the sidebar. hospital-web's `shipments/[id]` Confirm
    Delivery dialog and blood-center-web's `requests/[id]` Review Request
    + `shipments/[id]` Assign/Reassign Courier + Cancel Shipment dialogs
    were all hand-built (`fixed inset-0` + flat `bg-black/50`) instead of
    the shared `Modal` used correctly elsewhere in both apps — migrated
    all four, restoring Escape-to-close, the header close button, the
    correct scrim/radius/elevation, and the entrance animation.
  - **P0-48 — real error states + dead-code cleanup.** Both apps'
    `donors/page.tsx` silently `console.error`'d on a failed fetch and
    rendered the identical "No donors found" `EmptyState` as a genuine
    zero-result search — actively misleading staff. Added a `loadError`
    flag and the shared `ErrorState` component (previously unused in
    either app) with a working Retry action; fixed the same raw-accent-
    on-tint contrast bug in `ErrorState` itself. Removed half a dozen
    unused icon imports from both apps' `shipments/[id]/page.tsx` and
    added the missing manual-refresh button the dead `RefreshCw` import
    implied was meant to exist. Fixed a handful of smaller polish items:
    `donor-secondary` vs `donor-primary` spinner-color mismatch, plain-text
    vs. pill-style priority badges, `radius.sm`/`rounded-card` consistency
    (mobile badges, admin-web mini-stat tiles), a magic-number focus-ring
    hex duplicating `donor-primary` across all three web apps' `globals.css`.
  - **P0-49 — deferred: admin-web architectural migration.** No page under
    `apps/admin-web/app` uses the shared `DataTable`/`FilterBar`/
    `SearchInput`/`Modal` components — every table, filter bar, search
    input, and all 5 inline modals across ~14 pages are hand-rolled, which
    is the root cause of most remaining inconsistencies in that app (see
    DESIGN_VULNERABILITIES.md §4.0). Deliberately left out of this pass —
    too large (14 pages) and risky to complete safely without dedicated
    per-page verification. Queued as a follow-up task.
  - Verified: full monorepo `pnpm -r typecheck` and `pnpm -r test` clean
    (mobile 60/60, `packages/ui` 73/73, `packages/utils` 18/18,
    `packages/validation` 37/37, hospital-web 23/23, blood-center-web
    24/24, admin-web 14/14, api 684/684), and real production `next build`
    for all three web apps after every change.
  - Files: `DESIGN_VULNERABILITIES.md` (new), `apps/mobile/Create Design/`
    (new, reference-only), ~45 mobile screen/component files under
    `apps/mobile/{app,src/components}/`, `apps/mobile/src/components/
    ScreenHeader.tsx` (new), ~25 files under
    `apps/{hospital,blood-center,admin}-web/app/`,
    `packages/ui/src/components/feedback/ErrorState.tsx`,
    `apps/{hospital,blood-center,admin}-web/app/globals.css`.

- [x] P0-50: Re-audited `DESIGN_VULNERABILITIES.md` against the live
  codebase and closed the remaining quick fixes (A-group) plus the mobile
  reference-design feature-parity gaps (B-group). Admin-web's
  DataTable/FilterBar/SearchInput/Modal migration (P0-49) intentionally
  left untouched — owned by a separate agent.
  - **A-group (quick fixes).** Swapped the `Settings` (gear) icon for
    `Pencil` on hospital-web/blood-center-web inventory "Adjust" actions
    (gear collided with the sidebar's real Settings nav). Replaced every
    hardcoded `organizationName="Northstar ... (Development)"` literal
    across 11 hospital-web + 4 blood-center-web pages with either a
    generic console fallback or the donor's real
    `user.organizations.find(...)?.name`; a scripted first pass
    mis-classified 3 "Not Found" branches and introduced a
    `user.organizations` non-null-narrowing bug, caught by
    `tsc` (TS18047) and fixed with optional chaining. Gave `SectionHeader`
    an optional `action: {label, onPress}` ("View all" link, matching the
    reference), `GlassCard` `elevated`/`danger` variant props, and
    `IconButton` a `badge?: number` prop (required restructuring its
    single `overflow:hidden` wrapper into an outer non-clipping view +
    inner clipped view so the badge isn't cut off). Fixed `sos.tsx`'s
    "`AppButton` wrapping a full card" anti-pattern (swapped for a bare
    `TouchableOpacity`) and `insights/index.tsx`'s chat Send button
    (`colors.text` on `colors.primary` — near-invisible in light mode —
    → `colors.white`).
  - **B-group (reference feature-parity).** Home: header row with a
    notification-bell `IconButton` (real unread-count badge) + tappable
    avatar, a hero stats row inside the Blood Type `GradientCard`
    (donations/volume/emergency responses) with a divider, and a live SOS
    card that shows the real active-emergency count with a pulse dot
    instead of generic copy. Profile: real stats row + XP progress bar
    toward the next level + an achievements/badges teaser, from
    `useGamificationProfile`/`useLevelProgress`/`useAchievements`.
    Donations: an aggregate stats row from the real donation-statistics
    endpoint. Health: a "Vitals" list from the donor's real tracked lab
    parameters, an "AI Insights" teaser showing the donor's actual most
    recent AI insight (not the reference's fabricated "iron levels low"
    text), and a "Lab Results" preview with a Normal/Review badge derived
    from each result's real flag. Donate: replaced the plain bordered CTA
    card with a vivid `GradientCard` hero (real eligibility + days since
    last donation), plus real Active Campaigns / Challenges / Community
    Impact preview sections — deliberately dropped the reference's
    "Donation Types" grid (Whole Blood/Plasma/Platelets/Double Red with
    fixed per-type intervals), since the backend has one flat
    donation-eligibility cooldown, not per-type frequencies, so those
    numbers would have been fabricated. Community: a leaderboard teaser
    card showing the donor's real this-month rank, and a working native
    Share button on feed posts (RN `Share` API) — Like/Comment were
    dropped, since the backend has no like/comment endpoints for
    community posts and a client-side-only counter would be fake
    functionality with nothing behind it.
  - New: `apps/mobile/src/hooks/useEmergency.ts` (wraps
    `getDonorEmergencies` in a React Query hook, previously called
    directly from `sos.tsx` via raw `useState`/`useEffect`).
  - Verified: `pnpm --filter mobile typecheck` and
    `pnpm --filter mobile test` clean (60/60) after every screen, plus
    `pnpm --filter hospital-web typecheck`/`next build` and
    `pnpm --filter blood-center-web typecheck`/`next build` clean for the
    A-group web changes.
  - Files: `apps/mobile/app/(app)/{home,profile,donate,health,
    donations/index,community/index}.tsx`,
    `apps/mobile/app/sos.tsx`, `apps/mobile/app/(app)/insights/index.tsx`,
    `apps/mobile/src/components/{SectionHeader,GlassCard,IconButton}.tsx`,
    `apps/mobile/src/hooks/useEmergency.ts` (new), 11 hospital-web +
    4 blood-center-web page files, `apps/{hospital,blood-center}-web/app/
    inventory/page.tsx`.

- [x] P0-51: Premium healthcare visual redesign of the mobile donor UI
  (Profile, Health, Home, Donate, Calendar) plus the shared design system
  and primitives underneath them. Presentation only -- no functionality,
  navigation, or business logic changed; every screen stayed on its real
  hooks/API calls.
  - **Design tokens** (`theme.tsx`): stronger text/surface contrast in
    both themes, screen titles bumped 27->32px, a new 58px `bloodType`
    typography variant for the app's single most important number, and a
    slightly larger radius scale (12/18/26 -> 14/20/28) for a more
    premium feel.
  - **Background composition** (`Screen.tsx`): the 3 ambient blobs behind
    every screen were flat, hard-edged circles reading as "concept art."
    Replaced with real `react-native-svg` radial gradients (full color at
    center, fading to fully transparent at the edge) -- genuinely soft
    atmospheric light, and cheaper than the full-screen `BlurView` layer
    tried first and discarded (would have stacked a second blur pass under
    every glass card's own blur).
  - **Primitives**: `AppButton`/`IconButton` get a press-scale interaction;
    `GlassTabBar`'s active capsule is bigger and scales on press;
    `ProgressBar` now animates its fill with `react-native-reanimated`
    (idiomatic `withTiming` inside `useAnimatedStyle`, not a manual
    shared-value + effect, which doesn't reactively update under the
    community-screens.spec.tsx snapshot test -- fixed by wiring reanimated's
    official Jest mock into `jest.setup.js`). Fixed a real pre-existing bug
    found in the process: Donate's challenge progress bar was feeding
    `ProgressBar` a 0-1 fraction where every other caller (and the
    component itself) expects 0-100, so it was rendering a sliver instead
    of the real percentage. New `Sparkline` component for lightweight trend
    lines; `react-native-svg` was a real, already-bundled runtime
    dependency (chart-kit needs it) but mis-declared as a devDependency --
    moved to `dependencies` now that app code imports it directly.
  - **Profile**: hero header's big colored pill became a small dot + label
    ("Verified Donor"/"Under Review"), a status-colored ring around the
    avatar, balanced stat numbers, the real XP progress bar now animates,
    and the achievements teaser shows up to 3 real badge-icon previews
    (reusing `AchievementCard`'s existing icon-abbreviation map, exported
    for reuse). Blood type card gets the new 58px value and a subtle
    low-opacity droplet watermark.
  - **Health**: the "Latest tracked" value was buried in a small nested box
    inside a plain "View Health Trends" card. Promoted to a proper
    `GradientCard` hero with a real trend sparkline and min/max (from the
    donor's actual lab-history points, not fabricated), replacing that now-
    redundant nested card entirely. The privacy footer shrank from a full
    card to a compact one-liner.
  - **Home / Donate**: same bigger blood-type/hero typography and droplet
    watermark treatment for visual consistency with Profile/Health.
  - **Calendar**: added a real Donation/Blood test/Consultation color
    legend below the grid -- day dots are now colored by each day's actual
    `appointmentType` instead of always the same primary red, closing two
    DESIGN_VULNERABILITIES.md low-severity findings at once. Replaced the
    icon-only "+" button with a labeled "Schedule" button.
  - Deliberately did not reproduce the reference mockup pixel-for-pixel
    where it implied data or distinctions this backend doesn't have (no
    per-donation-type UI, no fabricated AI insight copy, etc.) -- consistent
    with every other pass in this log.
  - Verified: `pnpm --filter mobile typecheck` and
    `pnpm --filter mobile test` clean (60/60) after every screen and after
    the final `pnpm install` lockfile sync.
  - Files: `apps/mobile/src/theme.tsx`,
    `apps/mobile/src/components/{Screen,AppButton,IconButton,GlassTabBar,
    ProgressBar,Sparkline(new),gamification/AchievementCard,index}.tsx`,
    `apps/mobile/app/(app)/{profile,health,home,donate,calendar}.tsx`,
    `apps/mobile/jest.setup.js`, `apps/mobile/package.json`,
    `pnpm-lock.yaml`.

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
  `@bloodchain/ui/map` subpath — deliberately *not* re-exported through the main
  `@bloodchain/ui/components` barrel, because that barrel is imported by every
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

- [x] **P2-20. Education XP was advertised and recorded but never granted — and
  the XP uniqueness key let only the first donor on the platform earn any
  shared-milestone XP (found while writing P3-10's tests).** — Fixed. Two
  defects, one in front of the other.

  **The reward was never granted.** `EducationalContent.xpReward` is advertised
  on every mobile card ("+50 XP") and `completeContent` writes it to
  `EducationProgress.xpAwarded` — but nothing ever credited it to the donor's
  gamification profile. The education module emitted no events and gamification
  contained no reference to education. `XpTransactionType` already had an
  unused `EDUCATION_COMPLETED` member sitting there, which says the wiring was
  intended and simply never done. Fixed by following the pattern challenges
  already use: emit `education.completed`, handle it in
  `GamificationEventHandler`, award through
  `GamificationService.processEducationCompleted`.

  Worth noting how this hid: the existing unit test was named *"marks progress
  COMPLETED and awards the content xpReward on first completion"* and asserted
  only that `xpAwarded: 75` was written to the progress row. The name claimed a
  grant; the assertion checked bookkeeping. It is renamed to say what it
  actually checks, and joined by one that asserts the event is emitted.

  **The uniqueness key was wrong.** `XpTransaction` had
  `@@unique([sourceType, sourceId])` — platform-wide, not per-donor. That is
  fine where `sourceId` is a per-user record id (`DONATION`, `BLOOD_TEST`,
  `APPOINTMENT`, `EMERGENCY_RESPONSE`, and `PROFILE`, which passes `userId`
  itself). It is wrong for the three whose sourceId names a *shared* milestone:
  `ACHIEVEMENT` (an achievement code), `CHALLENGE` (a challenge id), and the
  `EDUCATION` award being added here. Under the old key the first donor in the
  entire system to unlock an achievement or finish a challenge took the XP, and
  every donor after them hit the existing-transaction branch and was silently
  refused — `awardXp` returns `{ success: false }` and nobody logs it.

  Fixed with a migration widening the key to `(userId, sourceType, sourceId)`.
  Adding a column to a unique index strictly weakens it, so no existing row can
  conflict and the migration is safe on populated databases. Idempotency is
  preserved exactly where it was wanted — the same donor cannot be awarded
  twice for the same source.

  The evidence is nicer than a test assertion: after the fix, two donors each
  earned XP for the same content, and Postgres then **refused to recreate the
  old index** — `Key ("sourceType", "sourceId")=(EDUCATION, ...) is duplicated`.
  The old constraint cannot coexist with correct behaviour.

  Both are pinned by e2e tests that fail against the unfixed code. The XP
  assertions poll rather than read immediately: gamification runs in
  `@OnEvent` handlers the request does not await, so asserting straight after
  the response is a race that passes or fails on machine speed. Added a shared
  `waitFor` helper to the e2e utils for this.

  Noticed in passing, not fixed: `AntiAbuseService.isDuplicateXpTransaction`
  has no callers anywhere. Its signature was updated to keep it correct under
  the new key rather than leaving it wrong; it is a candidate for deletion
  alongside any future dead-code pass.
  - Files: `apps/api/prisma/schema.prisma`,
    `apps/api/prisma/migrations/20260827050000_scope_xp_transaction_unique_by_user/migration.sql`
    (new), `apps/api/src/modules/education/education.service.ts`,
    `apps/api/src/modules/education/education.service.spec.ts`,
    `apps/api/src/modules/gamification/events/gamification-event.handler.ts`,
    `apps/api/src/modules/gamification/gamification.service.ts`,
    `apps/api/src/modules/gamification/services/xp.service.ts`,
    `apps/api/src/modules/gamification/services/anti-abuse.service.ts`,
    `apps/api/test/education.e2e-spec.ts`, `apps/api/test/utils/e2e.ts`.

## 🔵 P3 — Hygiene, tests, docs, infra

- [x] **P3-1. 26 of 30 backend modules have zero automated tests**,
  including the core money/medical/safety paths: donations, inventory,
  shipments, emergency, laboratory, admin. Only auth, health,
  health-trends, and part of ai-health have specs. Prioritize tests for
  the P0/P1 areas above as you fix them (write the regression test with
  the fix, not after). — Fixed across six installments (see below for
  the full breakdown; the sixth and final installment closes out every
  previously zero-coverage backend module):
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
  - **Third installment**: covered the next 3 smallest remaining
    zero-coverage modules — `ai-logging` (168 lines), `education` (236
    lines), `ai-history` (245 lines). `ai-logging` (`AIRequestLogService`,
    which records every AI provider call for cost/latency observability)
    gets 9 new tests: `logRequest` writing through with a generated
    `requestId` and returning that id even when the write fails (logging
    failures must never break the calling AI request), and both
    `getUserRequestStats`/`getPlatformRequestStats`'s aggregation math
    (success/failure counts, token sums, average-latency-over-successful-
    requests-only, and the platform stat's per-type bucketing) plus
    `cleanupOldLogs`'s retention-window deletion. Discovered along the
    way that this file imports the `uuid` package, which ships ESM-only
    in the version installed here and crashes Jest's default (non-ESM)
    transform with a bare `import`/`export` syntax error — worked around
    by mocking `uuid` in the spec (`jest.mock('uuid', ...)`) rather than
    touching the shared `jest.config` transform, since no other module
    imports `uuid` today. `education` (content CRUD, progress tracking,
    XP awarding) gets 19 new tests: `createContent`'s difficulty/xpReward
    defaults, `updateContent`'s `NotFoundException`, `getContent`'s
    `isActive`-always-filtered query plus optional type/category filters
    and pagination math, `startContent`'s inactive-content rejection and
    idempotent re-start (returns the existing progress row instead of
    creating a duplicate — the DB's `userId_contentId` unique constraint
    backs this), `completeContent`'s "must start before completing"
    guard, its own idempotency (a second complete call doesn't re-award
    XP), and its XP-awarding write; `getUserStats`'s null-sum-to-zero
    coalescing. `ai-history` (`AIInsightHistoryService`, the read/write
    layer behind every AI health insight) gets 13 new tests: `createInsight`'s
    array-field defaults (`[] ` for observations/dataPoints/caveats/etc.
    when omitted) and status/safetyLevel defaults, `getInsight`'s
    id+userId-scoped lookup (a wrong-user `NotFoundException`, not
    silently returning someone else's insight — same ownership-check
    pattern as elsewhere in this session), `deleteInsight`'s equivalent
    ownership check, `getUserInsights`'s pagination defaults and optional
    filters, `deleteExpiredInsights`'s `expiresAt IS NOT NULL AND <
    now` window, and `insightToResponseDto`'s title/summary/caveats
    fallback + generatedAt-vs-createdAt precedence (initially wrote this
    test to go through `createInsight`'s own array-coercion, which turns
    `[]` back into `[]` rather than triggering the `||` fallback —
    corrected to construct the bare `StoredInsight` input directly so the
    fallback path is actually exercised). Full suite went from 478 to 519
    passing (519/519 green), `tsc --noEmit` clean, lint 0 errors (423
    warnings, up from 408, same `any`-mock pattern). Live-verified
    `education`'s full HTTP surface against the real dev DB: `POST
    /api/v1/education` as `SUPER_ADMIN` created real content (confirmed
    the `BEGINNER`/`isActive:true` defaults), a `donor` token got a real
    `403` on the same route (`RolesGuard` enforcement), then as the donor:
    `GET /education/:id`, `POST /education/:id/start` (called twice,
    confirmed idempotent — same progress row both times), `POST
    /education/:id/complete` (confirmed `xpAwarded` matched the content's
    `xpReward` and `status` flipped to `COMPLETED`), and `GET
    /education/my/stats` (confirmed `totalStarted`/`totalCompleted`/
    `totalXpEarned` all reflected the one real completion) — all working
    end-to-end with zero manual DB seeding. Deleted the test-generated
    `EducationProgress` and `EducationalContent` rows afterward and
    re-checked `/education/my/stats` returned to all-zero, confirming no
    residue. `ai-logging` and `ai-history` have no controller of their
    own (internal services consumed by the `ai-health` module), so —
    consistent with the reasoning already applied to
    `audit-logs`/`permissions`/`email`/`ai-cache` — no contrived direct
    live test was added; both have already been exercised indirectly by
    every prior live `ai-health` verification this session. 5 modules
    now remain at zero coverage: `analytics`, `campaigns`, `community`,
    `courier`, `appointment-slots`.
    - Files: `apps/api/src/modules/ai-logging/ai-logging.service.spec.ts`
      (new), `apps/api/src/modules/education/education.service.spec.ts`
      (new), `apps/api/src/modules/ai-history/ai-history.service.spec.ts`
      (new).
  - **Fourth installment**: covered the next 3 remaining zero-coverage
    modules — `community` (258 lines), `campaigns` (272 lines), `courier`
    (349 lines) — leaving only `appointment-slots` (358 lines) and
    `analytics` (896 lines, by far the largest single service file in
    the backend) outstanding. `community` (public feed, post detail,
    content reporting, impact/community stats) gets 15 new tests:
    `getFeed`'s always-PUBLISHED filter, `getPost`'s draft-post 404 (does
    not leak unpublished content through the direct-by-id route),
    `reportContent`'s dedup-on-existing-pending/reviewed-report
    behavior, and `getImpactStats`'s null-gamification-profile
    defaulting (xp/level/reputation default to 0/1/0 for a user who
    hasn't triggered gamification-profile creation yet). `campaigns`
    (campaign CRUD, join/leave, organization-scoped ownership) gets 18
    new tests: `createCampaign` always forcing `DRAFT` status regardless
    of input, `updateCampaign`'s cross-organization `ForbiddenException`
    (an org can't edit another org's campaign), `getCampaigns`/
    `getCampaign`'s participant-count flattening, `joinCampaign`'s
    ACTIVE-or-PUBLISHED-only gate and idempotent re-join, and
    `leaveCampaign`'s not-a-participant guard. `courier` (courier
    profile, status-machine, shipment queries, stats) gets 15 new tests:
    `updateCourierStatus`'s two status-machine guards (can't go OFFLINE
    or become AVAILABLE-from-BUSY while shipments are still active),
    `getCourierStats`'s average-delivery-time computation and
    active-count-by-subtraction math, and the ownership/ 404 checks
    across `getCourierByUserId`/`getCourierById`/`updateCourierProfile`/
    `getActiveShipment`. Two `tsc --noEmit` strict-null errors surfaced
    on landing (`result.items[0]` / `result[0]` typed as possibly
    `undefined` under the project's strict indexed-access setting) and
    were fixed with non-null assertions on the array access, consistent
    with how existing specs in this codebase handle the same pattern.
    Full suite went from 519 to 567 passing (567/567 green), `tsc
    --noEmit` clean, lint 0 errors (434 warnings, up from 423, same
    `any`-mock pattern). Live-verified two of the three modules' full
    HTTP surfaces against the real dev DB: `campaigns` — created a real
    campaign as `HOSPITAL_ADMIN` (confirmed the forced `DRAFT` default),
    activated it to `ACTIVE`, had a real donor join it twice (confirmed
    idempotent), confirmed `participantCount` reflected the join on
    `GET /campaigns/:id` — and in the process of checking `GET
    /campaigns/my/campaigns`, **found a real bug**: the endpoint returned
    `"status": "JOINED"` for the campaign instead of its real `"ACTIVE"`
    status, because `getUserCampaigns` spreads the campaign object and
    then overwrites its `status` field with the participant's own
    status. This is a different, unrelated defect from the test-coverage
    work at hand (not the same bug class being chased), so — consistent
    with this session's standing practice of not silently scope-creeping
    a coverage pass into an unrelated fix — logged it as new **P3-8**
    rather than fixing it here. `courier` — fetched the seeded courier's
    real profile, updated its `displayName` then reverted it, and drove
    the real status machine end-to-end (`AVAILABLE` → `BUSY` →
    `AVAILABLE`, confirming `previousStatus` tracked correctly and
    `GET /courier/shipments/active` correctly returned an empty 200 body
    for "no active shipment"). Deleted the test-generated
    `Campaign`/`CampaignParticipant` rows afterward. `community` has a
    real controller too, but time-budgeted this installment to two live
    verifications; it was not skipped for the "no controller of its own"
    reason that applied to the internal-only modules in prior
    installments — it remains a candidate for direct live verification
    in a future pass. 2 modules now remain at zero coverage:
    `appointment-slots`, `analytics` (`analytics` alone is nearly as
    large as all 8 modules covered across this item's four installments
    combined, and will likely warrant its own dedicated pass).
    - Files: `apps/api/src/modules/community/community.service.spec.ts`
      (new), `apps/api/src/modules/campaigns/campaigns.service.spec.ts`
      (new), `apps/api/src/modules/courier/courier.service.spec.ts`
      (new).
  - **Fifth installment**: covered `appointment-slots` (358 lines —
    availability search, staff-only slot CRUD, capacity/booking-count
    guards, org-membership + role permission checks). Gets 22 new
    tests: `getAvailability`'s AVAILABLE-and-not-full filtering plus its
    date/date-range query construction, `getSlotsByOrganization`'s
    staff-or-SUPER_ADMIN gate, and `createSlot`/`updateSlot`/
    `blockSlot`'s shared permission-check chain (not-a-member →
    wrong-role → org-not-found/inactive), `createSlot`'s
    start-before-end and no-past-slots validation and capacity default,
    and `updateSlot`'s "can't reduce capacity below current bookings"
    guard. Full suite went from 567 to 589 passing (589/589 green), `tsc
    --noEmit` clean, lint 0 errors (452 warnings, up from 434, same
    `any`-mock pattern). Live-verifying this module's real HTTP surface
    surfaced a serious, unrelated, already-in-production bug: **`GET
    /api/v1/appointments/availability` — the endpoint donors use to find
    open slots — returned `404 "Appointment not found"` on every real
    call.** Root cause: `AppointmentsController` and
    `AppointmentSlotsController` both declare `@Controller('appointments')`,
    and `AppointmentsModule` was registered in `app.module.ts` *before*
    `AppointmentSlotsModule`. NestJS/Express registers routes in
    module-import order and resolves overlapping patterns
    first-registered-wins, so `AppointmentsController`'s `@Get(':id')`
    (a single-path-segment wildcard) was matching `/appointments/availability`
    before `AppointmentSlotsController`'s literal `@Get('availability')`
    ever got a chance — every real request for available slots was being
    swallowed into "look up the appointment with id `availability`" and
    404ing. This is the same root bug class as P2-16's
    `notification-preferences` route-shadowing discovery (a more
    specific literal route losing to an earlier-registered wildcard), and
    it directly blocked completing this item's own live verification of
    the very method (`getAvailability`) just covered — so, consistent
    with the P2-16 precedent of fixing a verification-blocking discovery
    within the same item rather than only logging it, fixed it here
    rather than deferring: swapped the two modules' order in
    `app.module.ts` (`AppointmentSlotsModule` now registers first).
    `createSlot`/`updateSlot`/`blockSlot` were never affected — their
    routes (`organizations/:organizationId/slots...`) have more path
    segments than `:id` can match, so only the single-segment
    `availability` route collided. Full suite re-run after the fix:
    589/589 still green (no regressions from the reorder). Live-verified
    the complete real flow end-to-end against the real dev DB, in this
    order: created a real slot as `HOSPITAL_ADMIN` (confirmed initial
    404 on `GET /appointments/availability` before the fix, then a real
    match after), confirmed a `donor` token gets a real `403` on the
    staff-only `GET .../slots` listing route, updated the slot's
    capacity, blocked it and confirmed it disappeared from availability,
    and confirmed all three real `APPOINTMENT_SLOT_CREATED`/`_UPDATED`/
    `_BLOCKED` audit rows were written with the correct `entityId`.
    Deleted the test-generated slot and its audit rows afterward. Only
    **`analytics`** (896 lines) remains at zero coverage — its own
    dedicated future installment given its size, nearly as large as
    every other module covered across this item's five installments
    combined.
    - Files:
      `apps/api/src/modules/appointment-slots/appointment-slots.service.spec.ts`
      (new), `apps/api/src/app.module.ts` (swapped `AppointmentSlotsModule`
      ahead of `AppointmentsModule` to fix the route-shadowing bug above).
  - **Sixth and final installment**: covered `analytics` (896 lines —
    by far the largest single backend service file, and the last
    zero-coverage module). This service is one big fan-out: 9 public
    methods (`getOverview` plus 7 domain-specific `getXAnalytics`
    methods, `getActivityFeed`, `getAlerts`) that each call a shared
    `validateOrganizationAccess` gate and then `Promise.all` a handful
    of private per-domain helpers, and roughly 25 of those private
    helpers, most of which are structurally identical
    count/groupBy/percent-rounding Prisma wrappers with no distinct
    branching logic of their own (`getDonationsByStatus`,
    `getEmergenciesByStatus`, `getRequestsByStatus`,
    `getAppointmentsByStatus`, `getLaboratoryByStatus`,
    `getShipmentsByStatus` are all the same shape repeated per domain,
    likewise the six near-identical `get*Trends` day-bucketing helpers).
    Given that shape, this installment deliberately did not write one
    near-duplicate test per repeated helper; instead it wrote 32 tests
    concentrated on the genuinely distinct logic: the shared
    `validateOrganizationAccess` gate (2 tests); the private
    `getDateRange` helper — by far the most complex, branchiest pure
    logic in the file, covering all 9 `DateRangeType` values including
    `LAST_MONTH`'s "subtract days-in-month, then take that month's
    start/end" trick and the `CUSTOM`/unrecognized-range fallbacks,
    exercised through `getOverview` with `jest.useFakeTimers()` pinning
    a fixed "now" and `jest.spyOn` isolating the KPI helpers so only the
    date-math is under test (12 tests, including one genuine
    off-by-one self-correction — this diff span is inclusive of both
    endpoints via `startOfDay`..`endOfDay`, so `LAST_7_DAYS` truly spans
    7 calendar days, not 6, and the first draft of these assertions
    had that backwards before being caught by the tests actually
    failing against the real implementation); `getOverview` and
    `getInventoryAnalytics`'s orchestration shape via `jest.spyOn` on
    their private collaborators (2 tests); `getActivityFeed`'s
    donation+emergency merge/sort/cap-at-50/per-query-`limit` behavior
    and its two independent try/catch-swallow paths, each verified to
    still surface the other domain's activity when one query fails (5
    tests); `getAlerts`'s CRITICAL-vs-HIGH priority derivation including
    the null-currentValue edge case, and its unacknowledged-only filter
    (3 tests); the private `getInventorySummary`'s low/critical stock
    threshold logic per blood group (0 units → critical, 1-4 → low,
    5+ → neither) (4 tests); `getInventoryByBloodGroup`'s
    OUT_OF_STOCK/LOW/HEALTHY status derivation (1 test);
    `getAlertCounts`'s four-way bucketing by alert type and
    currentValue (1 test); and the shared percent-rounding pattern,
    tested once via `getDonationsByStatus` as a representative of the
    ~6 identical-shaped `get*ByStatus`/`get*ByPriority` helpers (2
    tests). Full suite went from 589 to 621 passing (621/621 green),
    `tsc --noEmit` clean, lint 0 errors (484 warnings, up from 452, same
    `any`-mock pattern, all in this one new file). Live-verified
    `analytics`'s real HTTP surface (`GET
    /organizations/:organizationId/analytics/{overview,inventory,alerts,activity}`)
    against the real dev DB as `HOSPITAL_ADMIN`: confirmed `overview`
    returned real inventory/donation/emergency/appointment/request/
    shipment/alert sections built from the org's actual seeded data
    (correctly flagging all 8 blood groups as `criticalGroups` since the
    dev org has zero available units of any group), confirmed `alerts`/
    `activity`/`inventory` all returned real, correctly-shaped data,
    confirmed a `donor` token gets a real `403` on the staff-only
    routes, and confirmed `HOSPITAL_ADMIN` gets a real `403` when
    requesting a *different* organization's analytics — this rejection
    came from the global `OrganizationGuard` (established in P2-1)
    firing before the service's own `validateOrganizationAccess` check
    ever runs, confirming the two layers are genuinely defense-in-depth
    rather than one being dead code. Every call in this verification was
    a read (`GET`), so no test data was created and no cleanup was
    required.

    **P3-1 is now fully closed: all 32 backend modules that had zero
    test coverage at the start of this item now have real spec files.**
    Total across all six installments: 8 modules given dedicated
    installments individually or in small batches
    (`audit-logs`/`permissions`/`platform-settings`,
    `email`/`ai-cache`/`users`, `ai-logging`/`education`/`ai-history`,
    `community`/`campaigns`/`courier`, `appointment-slots`, `analytics`)
    plus the ~13 modules that gained coverage organically as a side
    effect of P0/P1/P2 fixes earlier in the session. Along the way this
    item also surfaced and fixed one live-breaking bug outside its own
    scope (P3-1 fifth installment: the `/appointments/availability`
    route-shadowing 404) and logged one new, unrelated bug for a future
    fix (**P3-8**: the campaigns status-clobbering bug from the fourth
    installment). Full backend suite is now 621/621 passing, up from 424
    at the start of this item — a net addition of 197 tests across 8 new
    spec files this item, on top of the organic growth from P0-P2.
    - Files: `apps/api/src/modules/analytics/services/analytics.service.spec.ts`
      (new).

- [x] **P3-2. No frontend tests at all** (Next.js apps or mobile) — no
  Jest/RTL/Playwright/Detox setup found. — Fixed (first installment,
  test infrastructure stood up for the first time in this repo's
  frontend, plus real tests for the highest-leverage shared code; the 3
  Next.js apps' own pages and the mobile/Expo app remain untested and
  are scoped for future installments — see below):
  Confirmed the diagnosis first — all 4 frontend apps (`hospital-web`,
  `blood-center-web`, `admin-web`, `mobile`) had a stub `"test"` script
  that just echoes a placeholder string, and zero of Jest/RTL/Vitest/
  Playwright/Detox were installed anywhere outside `apps/api`. Rather
  than start with an app's own pages (which in this Next.js App Router
  codebase are large, fetch-heavy client components with no smaller
  presentational units to isolate), started with the two packages that
  are the actual highest-leverage target: `packages/utils` and
  `packages/validation` are declared as a dependency of *all five*
  workspace packages including `apps/api` itself (confirmed via
  `package.json` dependency grep) — `@bloodchain/validation`'s schemas in
  particular are the real client-side validation gating the mobile
  app's register/login forms before any request reaches the API, so a
  bug there is a bug users hit before the backend ever sees the
  request. Chose Vitest over Jest for the frontend/packages side (unlike
  the backend, which stays on Jest/ts-jest) since it needs no ts-jest
  transform config, has native ESM/TS support matching these packages'
  `"type": "module"` setup, and is the standard pairing for a
  Vite/Next-adjacent monorepo. Added real `vitest.config.ts` + a
  `test`/`vitest run` script to `packages/utils` (18 tests covering
  `totalPages`/`pagination`/`clamp`/`sleep`/`isDefined`, including
  `pagination`'s divide-by-zero-avoidance and clamping edge cases) and
  `packages/validation` (37 tests covering every exported zod schema —
  `passwordSchema`'s 12-128 char boundary including a check against the
  real dev-seed password used everywhere else in this session,
  `phoneSchema`'s international-format regex edge cases, `emailSchema`'s
  case/whitespace normalization, and all 7 composite request schemas).
  Also stood up `packages/ui` — the shared component library consumed
  by all 3 web apps — with Vitest + `jsdom` + `@testing-library/react`/
  `jest-dom`/`user-event` (a real jsdom+RTL harness, not just pure-
  function testing) and wrote 21 tests for 5 of its simplest
  presentational components: `cn` (the `clsx`+`tailwind-merge` class
  helper used by nearly every component in the library), `StatusBadge`,
  `EmptyState`, `StatCard`, and `ErrorState` — the last of which has
  real conditional logic (its Retry/Back buttons only render when a
  handler is passed) verified with actual `userEvent.click()`
  interactions confirming each callback fires independently. Hit one
  real setup snag: `@testing-library/jest-dom`'s matcher-type
  augmentation wasn't visible to `tsc` because `vitest.setup.ts` lived
  outside `tsconfig.json`'s `include: ["src"]` — fixed by adding it to
  `include` rather than moving the file. All 76 new tests pass (18 +
  37 + 21); ran `pnpm test` at the repo root (`turbo test`) and
  confirmed all 8 workspace test tasks succeed together, including the
  pre-existing 621-test `@bloodchain/api` suite untouched; ran `pnpm
  typecheck`/`pnpm lint` at the root and confirmed all 3 touched
  packages are clean (the only failures, in `@bloodchain/mobile`, are the
  pre-existing NativeWind `className` typing errors in
  `education/index.tsx` already documented earlier in this session —
  confirmed via `git stash` unaffected by this change). Since no
  production code changed (only test files, `vitest.config.ts`s, and
  `package.json`/`tsconfig.json` additions), live-verified by actually
  building a real consumer: `pnpm --filter @bloodchain/hospital-web build`
  completed successfully end-to-end, confirming the shared packages
  still resolve and compile correctly for a real Next.js app. Still
  outstanding: the 3 Next.js apps' own pages/routes have zero tests
  (they're large fetch-driven client components — testing them properly
  will likely want either component-level extraction first or a
  Playwright/E2E approach rather than RTL-in-isolation), the rest of
  `packages/ui`'s components (`DataTable`, `Modal`, `Drawer`, `Sidebar`,
  `Topbar`, `DashboardShell`, `SearchInput`, `FilterBar`, `Chart`,
  `LocationMap`) have no tests yet, and the mobile/Expo app has no
  Jest/React Native Testing Library or Detox setup at all.
  **Second installment (the 3 Next.js apps).** The first installment stopped at
  the shared packages, reasoning that the apps' own pages are large fetch-driven
  client components with nothing small to isolate. That is still true of the
  pages — but it skipped the layer underneath them, which is where the bugs
  actually were. Each app's `lib/` holds its HTTP client, and testing that first
  turned up two defects immediately:

  - **No token refresh in two of the four apps.** hospital-web and
    blood-center-web had **nine** copies of the same `apiRequest` helper — one
    per `lib/*.ts` module — and not one of them refreshed an expired token.
    `refreshAccessToken` existed in `auth.ts` and was called by exactly one
    function, `me()`. Access tokens live 15 minutes, so every dashboard action
    after that window failed with a raw 401 until the user reloaded the page —
    which called `me()`, silently refreshed, and made the whole thing look
    intermittent. admin-web and the mobile app both refresh-and-retry; these two
    simply never got it.
  - **`instanceof ApiRequestError` was false across modules.** Each of those
    nine files declared its own `ApiRequestError` class, so the check only
    matched errors thrown by the module the class happened to be imported from.
    A page catching errors from two modules fell through to its generic fallback
    message with no indication anything was wrong. Only one page uses the check
    today, and it happens to import from the module it catches from, so this was
    a landmine rather than a live bug — but it is exactly the kind that survives
    a code review.

  Both are fixed by the same change: one `lib/api-client.ts` per app holding a
  single helper (token storage, refresh-and-retry, error mapping, envelope
  unwrap) and a single error class, with all nine modules and `auth.ts` reduced
  to importing it. That deletes ~250 lines of duplicated code and makes the two
  dashboards behave like the other two apps.

  Stood up Vitest + jsdom in all three Next.js apps (`vitest.config.ts` and a
  real `test` script replacing the `echo 'Web tests scheduled with the first
  feature release'` placeholder) and wrote 30 tests against the client layer:
  11 each for hospital-web and blood-center-web, 8 for admin-web. They cover the
  bearer header, the envelope unwrap, refresh-and-retry with token rotation
  persisted, session clearing when the refresh token is also dead, the no-refresh-
  token path, error mapping from the API's own `statusCode`/`code`/`message`,
  the non-JSON body fallback, caller header overrides not clobbering
  Authorization, and a single shared error identity. admin-web's tests document
  where it deliberately differs (its own storage keys, `Content-Type` only for
  string bodies, and a bare 401 passed through when no refresh token is stored)
  rather than papering over the difference.

  Proved the tests catch the bug: removing the refresh-and-retry block fails 3
  of the 11.

  Still outstanding after this installment: the apps' own pages and routes have
  no tests (still the argument for Playwright over RTL-in-isolation), and
  `packages/ui`'s larger components (`DataTable`, `Modal`, `Drawer`, `Sidebar`,
  `Topbar`, `DashboardShell`, `SearchInput`, `FilterBar`, `Chart`,
  `LocationMap`) remain uncovered. The mobile app is no longer at zero — P3-9
  and P3-10 added 19 tests — but has no Detox/integration layer.
  - Files (second installment): `apps/{hospital-web,blood-center-web}/lib/api-client.ts`
    (new), `apps/{hospital-web,blood-center-web}/lib/auth.ts` and the nine
    domain modules (local helpers removed in favour of the shared one),
    `apps/{hospital-web,blood-center-web,admin-web}/vitest.config.ts` (new),
    `apps/{hospital-web,blood-center-web,admin-web}/package.json` (real `test`
    script + vitest/jsdom), `apps/{hospital-web,blood-center-web,admin-web}/lib/api-client.spec.ts`
    (new).
  - Files: `packages/utils/vitest.config.ts` (new),
    `packages/utils/src/index.spec.ts` (new),
    `packages/utils/package.json` (added `test` script),
    `packages/validation/vitest.config.ts` (new),
    `packages/validation/src/index.spec.ts` (new),
    `packages/validation/package.json` (added `test` script),
    `packages/ui/vitest.config.ts` (new), `packages/ui/vitest.setup.ts`
    (new), `packages/ui/tsconfig.json` (include the setup file),
    `packages/ui/package.json` (added `test` script + RTL/jsdom
    devDependencies), `packages/ui/src/components/cn.spec.ts` (new),
    `packages/ui/src/components/data/StatusBadge.spec.tsx` (new),
    `packages/ui/src/components/data/StatCard.spec.tsx` (new),
    `packages/ui/src/components/feedback/EmptyState.spec.tsx` (new),
    `packages/ui/src/components/feedback/ErrorState.spec.tsx` (new).

- [x] **P3-3. No Docker / docker-compose, no CI pipeline**
  (`.github/workflows`), despite `IMPLEMENTATION_SUMMARY.md` and
  `docs/roadmap.md` describing the platform as "production-ready." —
  Fixed (both halves — Docker infrastructure, then the CI pipeline;
  done as two separate installments, written up in that order below):
  **Docker half.** Added a real multi-stage production `Dockerfile` for `apps/api`
  (`node:22-slim` base — chosen over `alpine` specifically because the
  API's one native dependency, `argon2`, and Prisma's query engine both
  have better-tested glibc support than musl, and using the same base
  image for both the build and runtime stages avoids any ABI mismatch
  risk for that native module) with three stages: `deps` (installs only
  `@bloodchain/api` and its workspace-linked dependencies via `pnpm install
  --filter=@bloodchain/api...`, so the image doesn't need to resolve or
  build the 3 web apps or mobile), `build` (`prisma generate` then
  `nest build`), and `runtime` (copies only the compiled `dist/`,
  `node_modules`, the Prisma schema/migrations, and `package.json`;
  runs as a non-root `nestjs` user). Added
  `apps/api/docker-entrypoint.sh`, which runs `prisma migrate deploy`
  before starting the compiled server — the container always launches
  against a fully-migrated schema, the same as this session's own
  live-verification routine has done manually via `service postgresql
  start` + migrations every single time. Added a root `docker-compose.yml`
  with a `postgres:16-alpine` service (healthchecked via `pg_isready`,
  persisted to a named volume) and the `api` service (depends on
  postgres's healthcheck, healthchecked itself via a real `GET
  /api/v1/health` call, environment variables sourced from a root
  `.env` with the same shape as `.env.example` plus sane defaults via
  `${VAR:-default}`, and hard-failing with a clear message if
  `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are left unset via `:?`).
  Deliberately did not add a `redis` service despite `REDIS_URL` being
  present in `.env.example` and `env.validation.ts` — grepped
  `apps/api/src` and confirmed nothing in the codebase actually
  connects to Redis (it's `.optional()` in validation and otherwise
  unused), so containerizing an unused service would be pure ceremony;
  noting this here rather than silently adding infrastructure the app
  doesn't consume. Added a `.dockerignore` and a "Docker (API +
  PostgreSQL)" section to `README.md` documenting `cp .env.example .env`
  + `docker compose up --build`. Deliberately scoped this installment
  to the API + database only, not the 3 Next.js apps or the mobile app:
  those are typically deployed via a static/edge host or compiled to
  native binaries rather than run as long-lived containers, so the
  backend + its stateful database is the part of "production-ready"
  that Docker infrastructure actually serves — documented this scoping
  decision in the new README section rather than leaving it unstated.
  **Verification is honestly partial and the reason is worth stating
  plainly**: before touching Docker at all, first confirmed the exact
  command the container runs — `nest build` then `node dist/src/main.js`
  — actually works, since this session had only ever run the API via
  `nest start --watch` (a dev-mode ts-node-style transform), never via
  its real compiled production entrypoint; built it, ran the compiled
  output directly against the real dev Postgres, and confirmed it
  booted with production-format (JSON/pino) logging and `GET
  /api/v1/health` responded correctly — this is the same code path the
  container's `ENTRYPOINT` runs, so it substantially de-risks the
  Dockerfile even without a full container run. Also confirmed
  `apps/api/src` never actually imports any `@bloodchain/*` workspace
  package despite declaring several as dependencies, so the "these
  packages export raw `.ts` via `package.json`'s `exports` field"
  question that would otherwise threaten a `node dist/...` runtime
  never actually arises for this app. However, actually running `docker
  compose up --build` in this sandboxed session hit a hard environment
  limitation: every Docker Hub image pull (`node:22-slim`,
  `postgres:16-alpine`, even the `docker/dockerfile:1` BuildKit syntax
  frontend) failed with a `403 Forbidden` from
  `production.cloudfront.docker.com`. Checked the session's egress-proxy
  status endpoint before assuming this was fixable: it's a `connect_rejected`
  / policy-denial entry, not a TLS or config problem — a blanket block
  on this Docker Hub CDN host for this session, not specific to any one
  image. Per that proxy's own documented instructions ("do not retry or
  route around it — report the blocked host"), did not attempt a mirror,
  alternate registry, or any other workaround. Still validated what was
  checkable without a pull: `docker compose config` renders the compose
  file correctly (variable interpolation, the `:?`-required JWT secrets,
  healthchecks, port mappings, and the named volume all resolved as
  intended), and `docker build` with the legacy (non-BuildKit) builder
  parsed the full 35-step `Dockerfile` with zero syntax errors before
  failing at the same blocked base-image pull. **This installment should
  be treated as configuration-complete but not container-run-verified**
  — the next person with unrestricted registry access should run `cp
  .env.example .env` (setting real JWT secrets) then `docker compose up
  --build` and confirm the API becomes healthy and reachable before
  trusting this in a real deployment.
  **CI half.** Added `.github/workflows/ci.yml` with four parallel jobs
  on every push/PR to `main` (plus `workflow_dispatch`), all on Node 22
  with pnpm caching and a `prisma generate` step: `lint-and-typecheck`
  (`pnpm typecheck` + `pnpm lint` across every workspace package),
  `test` (the full 621-test backend unit suite — needs no database,
  since every existing spec mocks `PrismaService`), `test-e2e` (a real
  `postgres:16-alpine` **service container**, `prisma migrate deploy`,
  `prisma:seed`, then `apps/api/test/app.e2e-spec.ts` booting the real
  unmocked `AppModule` against that live database), and `build` (`pnpm
  build` across all apps). Added a `concurrency` group with
  `cancel-in-progress` so superseded runs don't pile up.
  **Unlike the Docker half, this was genuinely verified end-to-end on
  GitHub's own infrastructure** — across two real PRs (#4 and #5) and
  five real workflow runs — and that verification was the entire point,
  because it found **six real, previously-invisible bugs** that no
  amount of local checking had surfaced. The root reason so much was
  hiding: `apps/api/test/app.e2e-spec.ts` had existed in this repo since
  before this session but had **never once successfully run** — it boots
  the real, unmocked application graph, a path none of the 621 mocked
  unit specs ever touch. The six:
  (1) `import { v4 as uuidv4 } from 'uuid'` in three AI-module services
  crashed Jest's CJS transform the moment the real `AppModule` loaded
  them (uuid v14 is ESM-only) — fixed at the root by replacing all of
  them with Node's built-in `crypto.randomUUID()` and dropping the
  `uuid`/`@types/uuid` dependency entirely (which also made an existing
  `jest.mock('uuid', ...)` workaround in a unit spec unnecessary).
  (2) The same ESM-vs-CJS class of failure then surfaced for
  `expo-server-sdk`, which unlike `uuid` is a genuine dependency with no
  built-in replacement — fixed properly with a **pnpm-aware**
  `transformIgnorePatterns` in `test/jest-e2e.json`
  (`node_modules/\.pnpm/(?!(expo-server-sdk)@)`; the naive
  `node_modules/(?!(expo-server-sdk)/)` pattern silently does nothing
  under pnpm's nested `.pnpm/<pkg>@<version>/node_modules/<pkg>` layout).
  (3) The spec imported supertest as `import * as request` — a
  namespace import that isn't callable under this project's
  `esModuleInterop`/ts-jest combination; fixed to the standard default
  import.
  (4) Once requests actually reached the app, **every route 404'd**: the
  harness only did `createNestApplication()` + `app.init()`, so none of
  `main.ts`'s CORS/helmet/`setGlobalPrefix('api/v1')`/`ValidationPipe`/
  filter/interceptor setup ever ran and nothing existed under `/api/v1`.
  Rather than duplicate that config into the test (guaranteeing future
  drift), extracted it into a new `configureApp(app, config)` in
  `apps/api/src/bootstrap.ts` that both `main.ts` and the e2e test now
  call — so the tests exercise the same bootstrap production does.
  (5) With those fixed the tests passed in CI (14/14) but the job then
  **sat `in_progress` for 6+ minutes** instead of the ~4s the suite
  takes — Jest's familiar "did not exit one second after the test run
  has completed" condition (real `@nestjs/schedule` cron registrations
  and a live Prisma pool that don't tear down on `app.close()`), benign
  locally but an indefinite hang on a CI runner. Fixed with `--forceExit`
  on the `test:e2e` script, which is NestJS's own documented
  recommendation for exactly this case (real-app e2e, as opposed to
  fully-mocked unit tests) rather than a workaround masking a defect.
  (6) `POST /auth/register` then returned **404 in CI while passing
  locally**. Treated it as a possible flake exactly once per protocol —
  a `rerun_failed_jobs` reproduced it identically, so it was real. The
  response's `x-ratelimit-limit: 10` header exactly matched
  `@Post('register')`'s own `@Throttle` decorator, proving the route
  *was* matched and its guards *did* run, which ruled out the
  "route-not-registered" reading and pointed inside the handler:
  `AuthService.register()` looks up the `DONOR` role and throws
  `NotFoundException('DONOR role not found. Run seed script.')` when
  it's missing. The CI job ran migrations but **never seeded**, so every
  fresh CI database had zero `Role` rows; local runs had been passing
  only because this session's dev database had been seeded repeatedly
  for weeks of work. Rather than guess, reproduced CI's exact conditions
  locally: created a genuinely fresh database, ran `migrate deploy`
  only, and got the **identical** "7 failed, 7 passed, 14 total"
  signature; then ran `prisma:seed` against that same database and
  re-ran the suite for 14/14 passing — proving both the diagnosis and
  the fix before pushing it. Added the missing `prisma:seed` step to the
  workflow between migrations and the tests.
  **Final state, verified on run #5 (commit `e9dccef`, PR #5):** `Unit
  tests` ✓, `API e2e tests (real database)` ✓ (all 14 against a real
  Postgres service container, ~6s), `Build all apps` ✓ — and `Lint &
  typecheck` ✗, failing **only** on `@bloodchain/mobile#typecheck` (8 of 10
  turbo tasks pass; the backend's own `tsc --noEmit` is clean). That one
  failure is **P3-9**, the NativeWind `className` defect logged
  separately below — it is CI correctly surfacing a real, pre-existing
  bug on its first run, not a pipeline misconfiguration, and it stays
  red on purpose until P3-9 is actually fixed.
  - Files: `apps/api/Dockerfile` (new), `apps/api/docker-entrypoint.sh`
    (new), `docker-compose.yml` (new), `.dockerignore` (new),
    `README.md` (new "Docker" section), `.github/workflows/ci.yml`
    (new), `apps/api/src/bootstrap.ts` (new — `configureApp` shared by
    `main.ts` and the e2e test), `apps/api/src/main.ts` (now calls
    `configureApp`), `apps/api/test/app.e2e-spec.ts` (supertest import,
    real bootstrap config, account-activation step, login-once token
    reuse), `apps/api/test/jest-e2e.json`
    (pnpm-aware `transformIgnorePatterns`), `apps/api/package.json`
    (`uuid`/`@types/uuid` removed, `--forceExit` on `test:e2e`),
    `apps/api/src/modules/ai-health/ai-health.service.ts`,
    `apps/api/src/modules/ai-health/ai-response.service.ts`,
    `apps/api/src/modules/ai-logging/ai-logging.service.ts` (all three
    `uuid` → `crypto.randomUUID()`),
    `apps/api/src/modules/ai-logging/ai-logging.service.spec.ts`
    (obsolete `jest.mock('uuid')` removed).

- [x] **P3-4. `.env.example` gaps.** — Fixed, and the investigation turned up
  something considerably worse than gaps: **the API refused to boot with the
  `.env.example` the README tells you to copy.**

  `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` and `EXPO_ACCESS_TOKEN` were all
  declared `Joi.string().optional()`, and Joi rejects an empty string for a
  plain `Joi.string()`. The template ships all four as `""` — deliberately, with
  a comment telling you to leave `SMTP_HOST` empty in local dev. So following
  the documented setup (`cp .env.example .env && cp .env.example apps/api/.env`,
  then `pnpm dev:api`) died at startup with
  `Config validation error: "SMTP_HOST" is not allowed to be empty. "SMTP_USER"
  ... "SMTP_PASSWORD" ... "EXPO_ACCESS_TOKEN" ...`. `docker compose up` hit the
  same wall, since compose passes `SMTP_HOST: ${SMTP_HOST:-}` — an empty string.
  Reproduced live before fixing and confirmed fixed after: the compiled API now
  starts on the template unchanged apart from the database URL and the two
  secrets, logging the intended `SMTP_HOST is not set — outgoing emails will be
  logged only` warning. The consuming code was always fine (`if (host)`,
  `user ? … : undefined`, `accessToken ? … : undefined`); only the schema
  disagreed. Fix is `.allow('')` on the four.

  On the documented-but-inert side, the audit note was right about three and
  wrong about one. `MAP_API_KEY`, `FCM_SERVER_KEY` and `APNS_KEY_ID` have zero
  references anywhere in the repository — removed from both `.env.example` and
  `docker-compose.yml`, with a comment in their place saying plainly that push
  goes through Expo and there is no direct FCM/APNs integration. But
  `EXPO_ACCESS_TOKEN` **is** read (`push-provider.service.ts:16`) and is in the
  schema, so it stays.

  Two more inert variables the note didn't catch:
  - **`JWT_REFRESH_EXPIRES_IN`** was documented, validated, defaulted to `30d`
    and passed through docker-compose — and read by nothing but a test mock.
    Refresh tokens here are opaque random strings, not JWTs, and their lifetime
    comes from `PlatformSettings.sessionTimeoutMinutes` (P1-14), editable by a
    SUPER_ADMIN. An operator setting `JWT_REFRESH_EXPIRES_IN=1h` to satisfy a
    security requirement would have believed it took effect. Removed from all
    three places; `.env.example` now says where the lifetime actually comes
    from.
  - **`REDIS_URL`** — same story, already established in P3-5 that nothing
    connects to Redis. Removed from the schema and the template.

  The five AI variables (`AI_ENABLED`, `AI_BASE_URL`, `AI_MODEL`,
  `AI_MAX_TOKENS`, `AI_TIMEOUT_MS`) are now documented *and* validated, with
  every default set to the same fallback the reading code already passes to
  `ConfigService.get`, so nothing changes behaviourally — a typo in
  `AI_MAX_TOKENS` now fails at boot instead of silently reverting to 1000.
  One trap avoided by reading the consumer first: `AI_ENABLED` is declared
  `Joi.string().valid('true','false')`, not `Joi.boolean()`, because the feature
  gate compares it with `!== 'true'` — a boolean would have coerced and turned
  AI permanently off. Docker-compose passed only `AI_API_KEY`, so a
  containerised deployment could not enable AI at all; all six now pass through.

  Also added the two variables the *frontends* read and nothing documented —
  `NEXT_PUBLIC_API_URL` and `EXPO_PUBLIC_API_URL` — flagged as such, since they
  fall back to localhost and so only bite on a real deployment.

  **Guard.** `src/config/env-example.spec.ts` reads the real `.env.example` and
  the real Joi schema and asserts: the file validates under exactly the options
  ConfigModule uses; every variable the schema knows about is documented; and
  none of the five dead variables have crept back. Proved it catches the
  original bug — restoring `SMTP_HOST: Joi.string().optional()` fails it with
  the same message the API died on.

  **Product-name leftovers** found while touching these files and fixed in the
  same pass: `appConfig.name` was still `'DONOR'`, the Swagger title was
  `'DONOR API'`, the startup log said `DONOR API listening`, and the email
  `from` fallback was `DONOR <no-reply@donor.local>` (in the service, the Joi
  default, docker-compose, and the spec's expectations). Seed account emails and
  the `donor://` deep-link scheme are deliberately left alone — the scheme must
  match `expo.scheme` in `apps/mobile/app.json`, and the seed emails are
  referenced by the e2e harness and the README credentials table.

  Verified: `pnpm typecheck` 10/10, `pnpm lint` 0 errors, 654 API unit tests
  (650 + 4 new) + 16 mobile + package tests, `pnpm build` 4/4, 95 e2e across 8
  suites against a fresh migrated+seeded database, plus the live boot of the
  compiled API on the template itself.
  - Files: `.env.example`, `docker-compose.yml`,
    `apps/api/src/config/env.validation.ts`,
    `apps/api/src/config/env-example.spec.ts` (new),
    `apps/api/src/main.ts`, `apps/api/src/modules/email/email.service.ts`,
    `apps/api/src/modules/email/email.service.spec.ts`,
    `packages/config/src/index.ts`, `README.md`.

- [x] **P3-5. Stale/inconsistent docs.** `docs/architecture.md` says
  WebSocket is "prepared but not implemented" even though the gateways are
  real and working; `IMPLEMENTATION_SUMMARY.md` claims "45+ passing
  tests" vs. 8 actual spec files. Reconcile docs with reality once the
  P0/P1 items land, not before (docs will keep drifting otherwise).
  — Fixed: deleted the two files the user identified as obsolete
  (`IMPLEMENTATION_SUMMARY.md`, `PHASE_19_COMPLETION_REPORT.md`), which
  removes the "45+ passing tests" and "production-ready through 19
  phases" claims at the source rather than patching them.
  Checked each remaining claim against the code before rewriting it,
  rather than assuming the audit note was still accurate:
  `docs/architecture.md` and `docs/api.md` both said WebSocket gateways
  and domain events were unimplemented. Both are implemented —
  `/emergency` and `/shipments` Socket.IO gateways exist, are registered
  as providers in their modules, authenticate on connect and scope every
  broadcast to a room; and there are 21 `@OnEvent` handlers on
  `@nestjs/event-emitter`. But the same sentence also claimed Redis
  pub/sub, and a grep confirms **nothing connects to Redis** — `REDIS_URL`
  is in the env schema and otherwise unused. So the rewrite documents the
  real socket event names and domain event names, and states plainly that
  gateway state is per-instance and horizontal scaling needs an adapter
  first. That last part is a limitation the old text accidentally hid by
  being wrong in the other direction.
  `README.md`'s Verification section now lists the real numbers (626 API
  unit + 16 mobile + 76 package tests, and the 83-test e2e suite), spells
  out that e2e needs a **seeded** database (registration fails without
  the seeded roles — the exact trap that cost a CI cycle in P3-3), and
  points at the CI workflow. Added a line directing readers to `TODO.md`
  as the live account of what is and is not finished.
  - Files: `IMPLEMENTATION_SUMMARY.md` (deleted),
    `PHASE_19_COMPLETION_REPORT.md` (deleted), `docs/architecture.md`,
    `docs/api.md`, `README.md`.

- [x] **P3-6. Repo/product name mismatch** — directory/remote is named
  "bloodchain-final" but the product is "DONOR" with zero blockchain code
  anywhere. Purely cosmetic; flag to the user, no code action needed
  unless they want a rename. — Fixed: the user resolved it in favour of
  the repo name, so the product is now **BloodChain** throughout.
  Done in two layers. The **brand** layer is the user-visible one: the
  sidebar logo, all three web apps' browser titles, the org-approval
  copy in the hospital and blood-centre apps, `README.md`, and the
  affected `docs/` pages. The **identifier** layer is the npm scope:
  `@donor/*` → `@bloodchain/*` across 63 files (152 occurrences,
  including the lockfile and the CI workflow), plus the root package
  name `donor-platform` → `bloodchain`. Renaming only the brand would
  have left the exact mismatch this item is about, just moved.
  Deliberately left alone, because they are local development fixtures
  rather than product naming, and renaming them forces every developer
  to drop and re-seed their database for no benefit: the dev database
  name `donor_dev` and the seeded demo accounts' `@donor.local` email
  domain. Also left every `RoleCode.DONOR` / `DONOR_STATUSES`
  identifier untouched — "donor" is a real domain role in a blood
  donation system and has nothing to do with the product name; the
  rename was applied by hand-checked patterns rather than a blanket
  find-and-replace precisely so those survived.
  Verified the identifier rename broke nothing: `pnpm install
  --frozen-lockfile` succeeds (the CI path), typecheck 10/10, lint
  10/10, 626 API + 16 mobile unit tests, `pnpm build` 4/4, and 83 e2e
  against a pristine migrate+seed database.
  - Files: root `package.json` and all 10 workspace `package.json`s,
    `pnpm-lock.yaml`, `.github/workflows/ci.yml`, every source file
    importing a workspace package, the three web apps' `layout.tsx`,
    `packages/ui/.../Sidebar.tsx`, `README.md`, `docs/`.

- [x] **P3-7. Dead DTO scaffolding for never-built admin features
  (found while working P1-15).** — Fixed: 13 of the dead classes deleted, and
  the 14th turned out not to be dead scaffolding at all but the correct,
  unwired fix for a live route with **no request validation on it**.

  **The scan.** The audit note listed 10 suspects; an empirical scan found 14.
  The first scan I ran reported all 33 classes in the file as "used" — those
  extra hits were inside `.next` build artifacts, i.e. stale compiled copies of
  the same source, not real references. Re-running with
  `--exclude-dir=.next --exclude-dir=dist --exclude-dir=node_modules` gave the
  real answer: 19 referenced, 14 referenced by nothing anywhere in the repo
  outside their own definition. Beyond the note's 10 it caught three courier
  DTOs (`AdminVerifyCourierDto`, `AdminRejectCourierDto`,
  `AdminSuspendCourierDto`) and `AdminPlatformStatsDto`.

  **The 14th.** `AdminSuspendCourierDto` was unreferenced, but
  `POST /admin/couriers/:id/suspend` *is* a live, shipped route — it just
  declared its body as an inline anonymous type, `@Body() body: { reason?: string }`.
  NestJS's `ValidationPipe` skips validation outright when the resolved metatype
  is a native type (`Object` is on its skip list), so this route ran with **no**
  validation at all: the app's global `whitelist` / `forbidNonWhitelisted`
  policy did not apply to it, and Swagger documented no request body for it.
  The correctly-written DTO for exactly this route sat unused a few lines away
  in the same file. So the fix here is to wire it in, not delete it. Its sibling
  `POST /admin/users/:id/suspend` already used `AdminSuspendUserDto` properly,
  which is what made the courier route the odd one out.

  Pinned by a new e2e suite (`test/admin-couriers.e2e-spec.ts`, 3 tests, own
  courier fixture so it doesn't disturb the seeded courier the shipment suites
  borrow). Proved the test catches the bug: reverting the controller to the
  inline body fails it 2/3 — the unknown-property request is *accepted*, and it
  actually suspends the courier, which is exactly the pre-fix behaviour. One
  thing measured rather than assumed: `@IsString()` on `reason` is close to
  unenforceable here because the app sets `enableImplicitConversion: true`, so
  class-transformer stringifies an object body before the validator sees it — a
  test asserting otherwise passed against the *broken* code, so it was dropped.
  What this fix genuinely restores on the route is the whitelist policy, and
  that is what the suite asserts.

  `AdminVerifyCourierDto` / `AdminRejectCourierDto` are a different story: there
  are no courier verify/reject routes at all (only suspend/restore), so those
  two describe endpoints that do not exist. Deleted.

  **`AdminUpdateSettingsDto`** is the clearest argument for deleting rather than
  keeping the rest as a "spec". It is a near-duplicate of the real, wired
  `AdminUpdatePlatformSettingsDto` (P1-14) with different field names
  (`sosEnabled` vs `sosEmergencyEnabled`, `aiInsightsEnabled` vs
  `aiHealthInsightsEnabled`, `maintenanceMode` typed `string` instead of
  `boolean`) and none of its validation bounds. Two similarly-named settings
  DTOs one file apart, only one of them real, is exactly the sort of thing
  someone wires up by accident.

  The remaining 10 describe support tickets, feature flags and announcements.
  Confirmed entirely unbuilt rather than half-built: a case-insensitive grep for
  `supportticket|featureflag|announcement` across `apps/api/src` and
  `schema.prisma` returns exactly one hit, and it is the unrelated `ANNOUNCEMENT`
  value of the community post-type enum. No model, no service, no route, no UI.

  None of the deleted 13 ever reached the OpenAPI document — `@nestjs/swagger`
  only emits models reachable from a route, and no route referenced them — so
  the deletion cannot change the published API surface. There are no
  `@ApiExtraModels` / `getSchemaPath` usages anywhere in the codebase that could
  have pulled one in by name.

  Result: 685 → 421 lines, 33 → 20 exported classes, plus one now-orphaned
  `IsNumber` import pruned from `class-validator`. The 20 that remain are
  exactly the 20 the controller imports.

  Split out as **P3-14** (now fixed): four *other* routes had the same
  inline-body defect, including two that take required fields and one that
  accepts clinical lab results.

  Verified: `pnpm typecheck` 10/10, `pnpm lint` 10/10 (0 errors),
  `pnpm turbo run test --force` (626 API + 16 mobile + package tests) green,
  `pnpm build` 4/4, and 86 e2e tests across 7 suites against a database freshly
  created, migrated and seeded for the run — the e2e harness boots the real
  `AppModule`, so it also proves the admin module still resolves and Swagger
  still builds with the 13 classes gone. Checked the run left no residue
  (0 fixture users, 0 fixture couriers, 0 stray audit rows).
  - Files: `apps/api/src/modules/admin/dto/admin.dto.ts`,
    `apps/api/src/modules/admin/admin.controller.ts`,
    `apps/api/test/admin-couriers.e2e-spec.ts` (new).

- [x] **P3-8. `GET /campaigns/my/campaigns` silently overwrites the
  campaign's own `status` with the caller's participation status
  (found live-verifying P3-1's campaigns coverage).**
  `CampaignsService.getUserCampaigns` builds each response item as
  `{ ...p.campaign, joinedAt: p.joinedAt, status: p.status }` — since
  `p.campaign.status` (e.g. `ACTIVE`/`COMPLETED`/`CANCELLED`) is spread
  first and `p.status` (the `CampaignParticipant` row's own status, e.g.
  `JOINED`/`COMPLETED`) is assigned after, the campaign's real lifecycle
  status is always clobbered by the user's join status in this one
  endpoint. Confirmed live: activated a real campaign to `ACTIVE`, had a
  donor join it, and `GET /campaigns/my/campaigns` returned
  `"status": "JOINED"` for it instead of `"ACTIVE"` — a client rendering
  "my campaigns" has no way to tell from this endpoint whether a
  campaign the user joined is still running, has ended, or was
  cancelled. Every other endpoint in this service (`getCampaign`,
  `getCampaigns`) returns the real campaign status untouched, so this
  looks like an unintentional field-name collision rather than a
  deliberate design choice. Likely fix: rename the participant's own
  status onto a distinct key (e.g. `participantStatus: p.status`) and
  leave the spread `status` as the campaign's real status. — Fixed:
  applied the suggested fix exactly — `getUserCampaigns` now returns
  `participantStatus: p.status` instead of `status: p.status`, so the
  spread `...p.campaign` real lifecycle status is never overwritten.
  Checked for consumers before changing the shape: the mobile client's
  `getMyCampaigns()`/`Campaign` type (`apps/mobile/src/api/campaigns.ts`)
  already declares `status` as the campaign lifecycle enum (not the
  participant status), confirming the backend response shape was
  inconsistent with its own client's type contract — and no screen in
  the mobile app actually calls `getMyCampaigns` yet, so there was zero
  risk of breaking an existing consumer. Added `participantStatus?:
  string` and `joinedAt?: string` (the latter was already present in
  the real response but missing from the type) to the mobile `Campaign`
  interface. Updated the existing unit test
  (`CampaignsService.getUserCampaigns`) into an explicit P3-8 regression
  test: a campaign with a real `ACTIVE` status and a participant with
  `JOINED` status now asserts both fields land correctly and
  independently, so this exact bug (real status silently clobbered)
  would fail the test if reintroduced. Full backend suite: 621/621
  still passing, `tsc --noEmit` clean (backend), lint 0 errors. Mobile
  `tsc --noEmit` still shows its pre-existing, unrelated NativeWind
  `className` typing errors in `education/index.tsx` — confirmed via
  `git stash` that these predate this change and `campaigns.ts` itself
  has zero errors. Live-verified end-to-end against the real dev DB:
  created a real campaign, activated it to `ACTIVE`, had a real donor
  join it, and confirmed `GET /campaigns/my/campaigns` now returns
  `"status": "ACTIVE"` (the real campaign status) alongside
  `"participantStatus": "JOINED"` — reproducing the exact live steps
  that originally surfaced the bug in P3-1's fourth installment, now
  fixed. Deleted the test-generated campaign and participant rows
  afterward.
  - Files: `apps/api/src/modules/campaigns/campaigns.service.ts`
    (`getUserCampaigns`), `apps/api/src/modules/campaigns/campaigns.service.spec.ts`
    (updated regression test), `apps/mobile/src/api/campaigns.ts`
    (`Campaign` type gains `participantStatus`/`joinedAt`).

- [x] **P3-9. 4 mobile screens use `className` (Tailwind-style utility
  strings) on plain React Native components, but this app has no
  NativeWind — or any styling library — wired up to process it (found
  while diagnosing why setting up CI would make `lint-and-typecheck`
  fail on day one).** Referenced loosely several times earlier in this
  session as "pre-existing NativeWind `className` typing errors," but
  never actually root-caused or logged as its own item until now.
  Diagnosis: `apps/mobile/package.json` does not depend on `nativewind`
  at all, there is no `babel.config.js`, and no `tailwind.config.*`
  anywhere under `apps/mobile` — yet
  `app/(app)/{community,education,challenges,campaigns}/index.tsx` pass
  real Tailwind utility strings like `className="text-sm text-gray-600
  ml-1"` and `className="bg-red-600 py-2 px-6 rounded-xl"` directly to
  `View`/`Text`/`TouchableOpacity`. Since `className` isn't a prop those
  core React Native components understand without NativeWind's Babel
  transform actually running, this isn't just a `tsc` type-checking
  annoyance (160 `error TS2769`/`TS2322` errors, all in these 4 files:
  58 in `community/index.tsx`, 42 in `education/index.tsx`, 33 in
  `challenges/index.tsx`, 27 in `campaigns/index.tsx`) — these 4 screens
  are almost certainly rendering **completely unstyled** on a real
  device or simulator right now, since the prop is silently a no-op.
  The rest of the app doesn't have this problem: 27 of the app's 48
  screen files use the working, real pattern
  (`StyleSheet.create({...})` + a `style` prop), confirming these 4
  screens are the outlier, not the norm — most likely built by copying
  a web-style Tailwind pattern from one of the Next.js apps without
  translating it to the mobile app's actual styling approach. Likely
  fix: rewrite these 4 screens' `className` usages into
  `StyleSheet.create`-based styles matching the rest of the app, rather
  than introducing NativeWind app-wide just for 4 files. Directly
  relevant to **P3-3**: the new `.github/workflows/ci.yml`'s
  `lint-and-typecheck` job runs `pnpm typecheck`/`pnpm lint` across
  every workspace package including `@bloodchain/mobile`, so this is now the
  one red job on an otherwise fully green pipeline — **confirmed on the
  real CI run**, which failed on exactly one of its ten turbo tasks
  (`@bloodchain/mobile#typecheck`) with these same `className` errors while
  the backend's own `tsc --noEmit`, the 621 unit tests, the 14 API e2e
  tests, and the full build all passed. That is CI doing its job
  (surfacing a real, previously undiagnosed defect), not a CI
  misconfiguration, and is called out explicitly in P3-3's own write-up
  so it isn't mistaken for one. Fixing these 4 screens turns the
  pipeline fully green. — Fixed: rewrote all four screens onto the
  mobile app's real design system. Took the suggested approach
  (`StyleSheet.create` + the app's own components) rather than adding
  NativeWind for 4 files, and went one step further than a literal
  class-to-style translation, for a reason that only became obvious
  once the theme was read properly: **`src/theme.ts` defines a dark
  palette** (`background: '#080D14'`, `text: '#F2F5F7'`), while these 4
  screens' Tailwind strings were all light-mode web classes
  (`bg-gray-50`, `bg-white`, `text-gray-900`). Translating those
  literally would have produced 4 blindingly light screens inside a
  dark app — the copied-from-the-web origin diagnosed above is exactly
  why they can't be translated at face value. So each screen was
  rebuilt against the existing component library the other 27 screens
  already use (`Screen`, `AppText`, `Card`, `GlassCard`, `Badge`,
  `AppButton`, `EmptyState`, `LoadingState`, `ProgressBar`, `Avatar`,
  `Divider`) plus `StyleSheet.create` with `colors`/`spacing`/`radius`
  tokens — no hard-coded hex values left in any of the four. Hand-rolled
  markup was replaced with the real primitives wherever one existed: the
  ad-hoc `bg-gray-200`/`bg-red-600` progress bars became `<ProgressBar>`,
  the `bg-red-100` pills became `<Badge variant="primary">`, the
  spinner-in-a-centered-View loading states became `<LoadingState>`, the
  "No Active Campaigns" blocks became `<EmptyState>`, and the
  `TouchableOpacity` submit buttons became `<AppButton loading={...}>`
  (which already handles the pressed/disabled/loading states these
  screens were each reimplementing by hand). All 160 type errors are
  gone and `@bloodchain/mobile#typecheck` passes, which was the whole point:
  **the repo-wide `pnpm typecheck` now reports 10/10 tasks successful**,
  turning P3-3's CI pipeline fully green.
  **Verified by actually rendering the screens, not just type-checking
  them.** Type-checking only proves the props are legal now; the real
  claim in this item was that these screens *render unstyled*, which no
  compiler can confirm. The mobile app had **no test infrastructure at
  all** (its `test` script was a literal `echo 'Mobile component tests
  scheduled with the first native feature'` placeholder), so this
  installment stood one up: `jest-expo` + `react-test-renderer`, a
  `jest.setup.js` mocking the three things that need a native module in
  a test process (`lucide-react-native`'s SVG icons,
  `expo-blur`'s `BlurView`, and `react-native-safe-area-context` via its
  own shipped mock), and 16 tests in
  `src/__tests__/community-screens.spec.tsx` that mount all four screens
  for real against mocked API fixtures and walk the resulting render
  tree. Two of them are the direct P3-9 regression guards: one asserts
  **no node in the tree carries a `className` prop**, the other asserts
  the app's real theme colors are actually present in the resolved
  styles.
  **These tests were then proven to actually catch the bug**, by
  `git stash`-ing just the 4 rewritten screens and re-running the suite
  against the original code: **10 of the 16 failed**. The most
  informative part of that run is what *didn't* fail — all four
  "renders without crashing" tests passed on the old code too, which is
  precisely the shape of this defect: the screens never errored, they
  just silently rendered with nothing applied. The failure output makes
  it concrete — the old campaigns screen's entire 26-node render tree
  came back with `style: null` on every single node except one
  `{"opacity":1}` that `TouchableOpacity` sets internally for its press
  animation. Zero styles, exactly as this item predicted, now confirmed
  from a real render rather than inferred. Restoring the fix returns all
  16 to green.
  While wiring the harness up, hit the **same pnpm-layout problem that
  bit P3-3's API e2e job**: `jest-expo`'s stock
  `transformIgnorePatterns` assume npm/yarn's flat
  `node_modules/react-native/...` layout, so under pnpm's
  `node_modules/.pnpm/<name>@<version>/node_modules/<name>/...` the
  negative lookahead sees `.pnpm` and skips the whole tree, leaving
  React Native's own Flow-typed sources untransformed
  (`SyntaxError: Unexpected identifier 'ErrorHandler'`). Fixed the same
  way, with a pnpm-aware pattern matching pnpm's directory encoding
  (scoped packages as `@scope+name@version`). Worth noting as a pattern:
  this repo will hit this a third time the next time a package needs
  transforming.
  Full verification after the change: repo-wide `pnpm typecheck` 10/10,
  `pnpm lint` 10/10, `pnpm test` **637 passing** (621 API + the 16 new
  mobile tests, which now actually run in CI instead of echoing a
  placeholder), and `pnpm build` 4/4 — i.e. all four CI jobs' commands
  green locally before pushing.
  **One more real bug surfaced once the new suite met CI**, and it's
  worth recording because it's a class this repo will hit again: the
  suite passed locally but failed its first CI run on **exactly one**
  test — the first one, `community renders without crashing`, timing
  out at 8429ms against Jest's default 5s per-test budget, while the
  other 15 passed in ~10ms each. Rather than re-run it as a flake,
  reproduced the mechanism locally by clearing the jest cache to match
  a fresh runner: the first test to mount a screen pays a one-off cost
  for Babel-transforming the entire React Native module graph (~2.9s
  locally, ~8.4s on CI's slower shared runner), and everything after it
  runs in single digits. That is real one-time setup cost landing on
  whichever test happens to sort first — not a slow test, and *not* a
  flake, since it would fail again on every cold cache. Fixed with an
  explicit `testTimeout` covering a cold start, so run order no longer
  decides which test absorbs the transform. Also cleared the
  "overlapping act() calls" warnings the same run emitted (mounting
  inside an *async* `act()` nests an act scope inside the renderer's
  own; mount in a synchronous `act()` and keep the async one for the
  React Query flush). Re-verified from a cleared cache: 16/16, zero
  warnings. **CI run #8 is fully green across all four jobs** — the
  first time this pipeline has been green end to end.
  Left deliberately unfixed and logged separately as **P3-10**: the
  education screen's `onStart`/`isStarting` props are wired to a real
  `startContent` mutation but no control in the card ever triggers them.
  That's a missing feature, not a styling defect, so it wasn't smuggled
  into this fix.
  - Files: `apps/mobile/app/(app)/community/index.tsx`,
    `apps/mobile/app/(app)/education/index.tsx`,
    `apps/mobile/app/(app)/challenges/index.tsx`,
    `apps/mobile/app/(app)/campaigns/index.tsx` (all four rewritten onto
    the design system), `apps/mobile/src/__tests__/community-screens.spec.tsx`
    (new — 16 render tests incl. the two P3-9 regression guards),
    `apps/mobile/jest.config.js` (new — jest-expo preset + pnpm-aware
    `transformIgnorePatterns`), `apps/mobile/jest.setup.js` (new — native
    module mocks), `apps/mobile/package.json` (`test` script now really
    runs jest; adds `jest`, `jest-expo`, `react-test-renderer`,
    `@types/jest`, `@types/react-test-renderer`).

- [x] **P3-10. The education screen's "start content" flow is wired but
  unreachable (found while fixing P3-9).** — Fixed, and the investigation
  showed the note understated it. I had written that the effect was skewed
  stats. It was worse: `completeContent` throws
  `BadRequestException('You must start the content before completing it')` when
  no progress row exists, so **the only button on the screen failed every time
  it was tapped**. The feature was not missing a step; it was unreachable.

  The card now derives its control from the donor's real progress, fetched from
  `GET /education/my/progress` (an endpoint that already existed and that the
  mobile client already had a function for — the screen simply never called
  it): **Start** when not begun, **Complete** once started, a **Completed**
  badge when done. The `isStarting`/`isCompleting` flags are now scoped to the
  card being acted on, so one tap doesn't spin every button on the list.

  Deliberately *not* invented here: a reading/detail view. The note wondered
  whether "start" belongs on a detail screen. Maybe, but the backend contract
  says start must happen before complete, and that is answerable without
  designing a new screen. If a detail view is added later, Start moves into it.

  Verified with a new e2e suite (`education.e2e-spec.ts`, 6 tests) covering the
  real contract — complete-before-start is rejected, start is idempotent, the
  progress row shows up on `my/progress`, complete awards XP exactly once — and
  three new mobile tests pinning which control each state shows. Proved the
  mobile tests catch the old behaviour: reverting the card to Complete-only
  fails 2 of the 3.

  Two further defects fell out of writing those tests, both recorded below as
  their own entries because neither is about the education screen:
  **P0-10** (the missing response envelope) and **P2-20** (education XP was
  advertised and recorded but never granted, plus a unique constraint that let
  only the first donor on the platform earn any shared-milestone XP).
  - Files: `apps/mobile/app/(app)/education/index.tsx`,
    `apps/mobile/src/__tests__/community-screens.spec.tsx`,
    `apps/api/test/education.e2e-spec.ts` (new).

- [x] **E2E-1. The e2e suite only covered auth, so no business flow had
  ever been exercised over HTTP against a real database.** Before this
  work the only e2e spec was `app.e2e-spec.ts` (health + auth + two
  authorization checks, 14 tests). Every other guarantee in the backend
  rested on 621 unit specs that all mock `PrismaService` — which means
  they validate service logic in isolation but can never catch a bad
  Prisma query, a broken route wiring, a guard that doesn't fire, or a
  state machine that doesn't hold across a real multi-actor flow.
  — Fixed: added four domain suites (64 new tests, 78 total) covering
  the product's core flows end to end against a real Postgres, each
  driving several actors whose roles genuinely differ:
  **`donations.e2e-spec.ts` (17)** — staff opens a slot, donor books,
  staff confirms and checks in, records the screening assessment,
  starts and completes the collection, donor sees it in their history.
  **`shipments.e2e-spec.ts` (20)** — hospital raises a blood request,
  blood centre approves (reserving a real unit) and dispatches, courier
  runs accept → start-pickup → confirm-pickup → start-delivery →
  arrive, hospital confirms receipt.
  **`emergency.e2e-spec.ts` (15)** — hospital raises and activates an
  emergency, the real matching engine writes matches, the donor views,
  accepts, travels and arrives, the hospital completes the response.
  **`inventory.e2e-spec.ts` (12)** — a unit through quarantine →
  release → reserve → release-reservation → issue.
  Coverage is deliberately not just happy paths: it asserts the
  transitions that must be **refused** (a quarantined unit can't be
  issued, a discard is terminal, a unit can't be issued twice, a
  shipment step can't be replayed, an emergency can't be activated
  twice, delivery can't claim more units than were shipped or fewer
  without a discrepancy reason), and RBAC/tenant isolation at every
  boundary (a donor can't open slots or read inventory, a courier can't
  raise requests, a hospital can't self-approve or reach blood-centre
  inventory, blood-centre staff can't act as the courier).
  Added `test/utils/e2e.ts` as the shared harness. It mints tokens via
  the app's own `JwtService` rather than driving `POST /auth/login`,
  because login is rate limited to 5 requests/60s and these suites need
  six or more actors signed in at once — driving them through login
  would make the suites trip the app's own rate limiter on themselves.
  The tokens are genuine (same secret, same `{sub, roles, permissions}`
  payload, roles and permissions read from the database), so every
  guard validates them for real; login itself stays covered by
  `app.e2e-spec.ts`.
  **This immediately paid for itself: it found a completely broken core
  endpoint.** `donations.service.ts` passed both `include` and `select`
  for the same `donor` relation in three Prisma queries, which Prisma
  rejects outright ("Please either use `include` or `select`, but not
  both at the same time"). So `checkInDonation`, `getDonationForCheckIn`
  and `getTodayAppointments` — the entire staff-facing donation session
  surface, including the check-in that begins *every* donation —
  returned 500 on every single call. Confirmed by reproducing the query
  standalone against the real database, then fixed by merging
  `donorProfile` into the `donor` select (preserving the exact fields
  each caller reads); a repo-wide scan confirms no other
  include+select conflict remains. The 5 existing donations unit tests
  never caught it because they mock `PrismaService`, and a mock does not
  validate query shape — the clearest possible illustration of why this
  gap mattered.
  Test hygiene is part of the deliverable: each suite brings its own
  fixtures (its own donation, blood unit, donor) instead of consuming
  seeded demo data, restores anything it borrows (the courier's status),
  and cleans up after itself. Cleanup deliberately does **not**
  catch-and-ignore, because that pattern was actively hiding bugs while
  these suites were written: the emergency teardown referenced
  `db.emergencyEvent`, a model that does not exist, so cleanup silently
  aborted and left 10 stale emergencies and 5 stale users behind, which
  then made later runs fail for a completely unrelated-looking reason
  (zero donors matched). The shipments teardown had the same defect,
  deleting `BloodUnitReservation` by a `bloodRequestId` field it does
  not have. Both now delete only cascade roots and let genuine failures
  surface. Verified by running the full suite twice back to back —
  78/78 both times — and confirming afterwards that the database holds
  zero test rows and the seeded demo data is untouched.
  - Files: `apps/api/test/utils/e2e.ts` (new harness),
    `apps/api/test/donations.e2e-spec.ts` (new),
    `apps/api/test/shipments.e2e-spec.ts` (new),
    `apps/api/test/emergency.e2e-spec.ts` (new),
    `apps/api/test/inventory.e2e-spec.ts` (new),
    `apps/api/src/modules/donations/donations.service.ts`
    (the three include+select fixes).

- [x] **P3-11. Emergency donor matching silently ignores the blood
  compatibility map, notifying only exact-type donors (found while
  writing the emergency e2e suite).** `emergency.service.ts` defines a
  correct `BLOOD_COMPATIBILITY` map — `'O-NEGATIVE'` lists all eight
  recipient groups, i.e. the universal donor — and `isBloodCompatible`
  applies it. But the database query that loads candidate donors
  prefilters with `donorProfile: { bloodType: emergency.bloodType,
  rhFactor: emergency.rhFactor }`, an **exact** match. Since
  `isBloodCompatible` is then applied to that already-exact set, it can
  only ever return true, and the compatibility map is dead code in this
  path. The effect is that activating an emergency notifies only donors
  whose type matches exactly, silently excluding every universal and
  cross-compatible donor — precisely the donors an emergency most needs.
  The map's existence is strong evidence the intended behaviour is the
  broader one. Not fixed here on purpose: widening who gets alerted in a
  medical emergency is a product and clinical decision, not a test-
  coverage change, and it also affects notification volume. Likely fix:
  drop `bloodType`/`rhFactor` from the SQL prefilter (keeping
  `donorStatus`/`verificationStatus`/`emailVerified`) and let
  `isBloodCompatible` do the filtering it was written to do — but
  confirm the intended clinical policy first. — Fixed (on the user's
  explicit instruction to proceed, after the concern above was raised
  and they confirmed): dropped `bloodType`/`rhFactor` from the SQL
  prefilter, keeping every eligibility constraint
  (`donorStatus: ACTIVE`, `verificationStatus: VERIFIED`,
  `emailVerified`, active DONOR membership), so `isBloodCompatible` now
  decides compatibility and the map finally does its job. First
  confirmed the map is medically right before relying on it: it encodes
  donor→recipient direction correctly for red cells (O− to all eight
  groups; AB+ only to AB+; each Rh− group to its own and the matching
  Rh+ group).
  **A naive version of this fix would have introduced a worse bug**, so
  the change has a second half. Ranking was purely nearest-first, and
  the pool is capped at 50 donors. Widening the pool without touching
  the ranking would let a nearby O-negative universal donor outrank an
  exact-group donor for, say, an A-positive patient — spending the
  scarcest and most broadly usable supply on a case that type-specific
  blood already covers, and under the 50-donor cap potentially crowding
  exact-group donors out of the alert entirely. Standard transfusion
  practice is type-specific first with universal donors as the
  fallback, so ranking now sorts on an exact-group tier first and
  distance second. Distance ordering within a tier is unchanged.
  Tests: five new unit tests, of which the two that actually pin the
  fix are the one asserting the **query shape** (the `where` clause must
  not carry `bloodType`/`rhFactor` while keeping the eligibility
  constraints) and the one asserting a far exact-group donor outranks a
  near universal donor. Verified they catch the defect by reverting the
  service and re-running: exactly those two fail. Worth recording that
  the third unit test ("matches an O-negative donor to an A-positive
  emergency") passes against the buggy code too — the existing specs
  mock `tx.user.findMany`, so a mocked unit test structurally *cannot*
  exercise the SQL prefilter that was the bug. That is precisely why
  this item was invisible until the e2e work, and why the real proof is
  a new e2e test that creates a genuine O-negative donor and an
  A-positive emergency against a real database: reverting the service
  makes exactly that one test fail, while the incompatible-donor test
  keeps passing, confirming the pool widened to compatible donors
  rather than to everyone.
  Verified: 626 API unit tests (up from 621), 79 e2e (up from 78) green
  on a pristine migrate+seed database, plus typecheck 10/10, lint
  10/10 repo-wide.
  - Files: `apps/api/src/modules/emergency/emergency.service.ts`
    (donor prefilter and ranking in `activateEmergency`),
    `apps/api/src/modules/emergency/emergency.service.spec.ts`
    (5 regression tests), `apps/api/test/emergency.e2e-spec.ts`
    (cross-group matching against a real database).

- [x] **P3-12. 16 POST routes are documented as returning 200 but
  actually return 201 (found while writing the donation e2e suite).**
  These are state-transition endpoints (`/confirm`, `/cancel`,
  `/start`, `/complete`, `/join`, `/approve`, …) that carry
  `@ApiResponse({ status: 200 })` but have no `@HttpCode`, so Nest
  applies its POST default of 201. The published OpenAPI contract
  therefore disagrees with the real response on every one of them,
  which matters for any generated client that treats an unexpected
  status as an error. Semantically 200 is the better answer for these
  (no new resource is created at the request URI), so the likely fix is
  adding `@HttpCode(HttpStatus.OK)` rather than editing the docs — but
  that changes 16 response codes at once, which is a breaking API change
  for existing consumers and needs an explicit decision. The e2e suites
  assert the real behaviour (201) and cite this item where they do.
  — Fixed (on the user's explicit go-ahead, after the breaking-change
  concern above was put to them): **not** by blanket-applying
  `@HttpCode(HttpStatus.OK)` to all 16, which would have been wrong.
  Checked what each route actually does first, and the 16 split in two:
  **12 mutate an existing resource** (`blockSlot`, appointment
  `cancel`/`reschedule`/`confirm`/`complete`, donation
  `start`/`complete`/`cancel`/`abort`, `verifyBloodType`, education
  `complete`, `leaderboard-visibility`). Confirmed from the services
  that each one calls `.update()` and creates nothing addressable —
  `rescheduleAppointment`, for instance, updates the existing
  appointment rather than making a new one. For these 200 is the
  correct status, so they now carry `@HttpCode(HttpStatus.OK)` and
  match the annotation they already had.
  **4 genuinely create a resource** — education `POST /` (creates
  content), education `:id/start` and campaigns/challenges `:id/join`,
  each of which calls `.create()` for a new progress or participant
  row. For those 201 was right all along and the *annotation* was
  wrong, so the docs were corrected to 201 and the behaviour left
  untouched. That reduces the breaking surface from 16 routes to 12,
  and leaves each route semantically correct rather than merely
  consistent.
  The e2e suites earned their keep here: they asserted the old 201 on
  the three affected routes they exercise (`appointments/:id/confirm`,
  `donations/:id/start`, `donations/:id/complete`) and failed
  immediately on the change, which is exactly the signal a real
  consumer would have seen. Those assertions now expect 200. A repo-wide
  re-scan confirms **zero** remaining routes where the declared status
  and the real one disagree.
  Verified: 626 API unit tests, 83 e2e on a pristine migrate+seed
  database, typecheck 10/10, lint 10/10.
  - Files: `appointment-slots.controller.ts` (1),
    `appointments.controller.ts` (4), `campaigns.controller.ts` (1),
    `challenges.controller.ts` (1), `donations.controller.ts` (4),
    `donors.controller.ts` (1), `education.controller.ts` (3),
    `gamification.controller.ts` (1).

- [x] **P3-13. `ensureProfileExists` can lose a gamification profile
  under concurrency (observed during the e2e runs).**
  `xp.service.ts`'s `ensureProfileExists` does a
  `gamificationProfile.upsert({ where: { userId }, … })`, which raced
  during an e2e run and threw `Unique constraint failed on the fields:
  (userId)` — two near-simultaneous `handleDonationCompleted` events
  for the same user both found no row and both inserted. This was
  observed, not theorised. Because the caller is a fire-and-forget
  `@nestjs/event-emitter` handler the user's request still succeeds, so
  the failure is invisible in the API response and the profile work is
  simply lost. Likely fix: catch and ignore P2002 specifically (the row
  exists, which is the desired end state), or serialise profile
  creation. Worth checking whether other `upsert`-on-unique calls in
  event handlers have the same exposure. — Fixed: first proved the
  mechanism rather than assuming it. Prisma query logging shows the
  `upsert` on this model compiles to three statements —
  `SELECT ... WHERE userId = $1`, then a **plain** `INSERT` with no
  `ON CONFLICT`, then a read-back — i.e. a textbook non-atomic
  check-then-insert, matching the bare INSERT in the CI error exactly.
  Then reproduced it deterministically against the real database:
  concurrent callers for one fresh user raced on **6 of 6** trials
  with P2002.
  The fix is a single atomic statement instead of a retry:
  `createMany({ data: [...], skipDuplicates: true })`, which emits
  `INSERT ... ON CONFLICT DO NOTHING` (verified in the emitted SQL) and
  is resolved by the database itself, so no caller can lose. Extracted
  it as `ensureGamificationProfileRow` so the primitive lives in one
  place rather than being duplicated.
  **The check for sibling exposure found four more.** `xp.service`'s
  `awardXp` and `createAdminAdjustment`, and `reputation.service`'s
  `awardReputation` and `createAdminReputationAdjustment`, each upsert
  the same profile inside a transaction. Those must *increment*, so
  they cannot become ON CONFLICT DO NOTHING; instead each now calls the
  atomic helper before opening its transaction, which guarantees the
  row exists so the upsert inside always takes its update branch and
  can never reach the racy insert path. Five racy call sites in total,
  all closed.
  Regression guard is a new e2e suite, since a unit test cannot
  reproduce a database race — it needs real parallel connections.
  **Tuning it honestly mattered**: the first version fired a single
  burst of 32 and passed against the *unfixed* code, i.e. it was no
  guard at all. Measuring showed the first burst after pool warm-up is
  effectively serialised — 32×1 detected the bug in 0 of 3 runs, while
  32×3 and 64×1 detected it in 3 of 3. The suite therefore repeats
  64-way bursts over fresh users, and was confirmed to fail on the
  reverted code in 3 of 3 runs and pass on the fixed code in 3 of 3.
  (An earlier apparent "passes when reverted" result was a stale jest
  cache; re-running with `--no-cache` is what exposed it.)
  Verified: 626 API unit tests, 83 e2e (up from 79) on a pristine
  migrate+seed database, typecheck 10/10, lint 10/10, no leftover rows.

- [x] **P3-9 follow-up: the mobile render suite had a latent timing flake,
  surfaced by a slow CI runner.** After the BloodChain rename, CI's unit
  job failed on one mobile test — "community applies the app theme
  rather than rendering unstyled" — while typecheck, e2e and build all
  passed. Nothing to do with the rename: the render helper flushed React
  Query with a single `setTimeout(0)` tick, which was enough locally but
  not on a cold runner where the first screen mount pays ~9s of React
  Native module-transform cost and the community screen has four queries
  to resolve. The assertion therefore ran against `LoadingState` and saw
  only its muted colours. — Fixed by waiting until the loading state is
  actually gone (bounded loop) instead of assuming one tick suffices, so
  it no longer depends on how fast the machine is. Proved it addresses
  the real mechanism rather than hopefully papering over it: delaying the
  mocked query resolution reproduces the exact CI failure under the old
  single-tick behaviour and passes with the loop. The wait walks the node
  tree rather than `JSON.stringify`-ing the render output, which hits
  circular references on React context props.
  - File: `apps/mobile/src/__tests__/community-screens.spec.tsx`.
  - Files: `apps/api/src/modules/gamification/services/gamification-profile.util.ts`
    (new — the atomic primitive and the reasoning),
    `apps/api/src/modules/gamification/services/xp.service.ts`
    (`ensureProfileExists` plus two transaction guards),
    `apps/api/src/modules/gamification/services/reputation.service.ts`
    (two transaction guards),
    `apps/api/test/gamification-concurrency.e2e-spec.ts` (new).

- [x] **P3-14. Four routes declared inline anonymous request bodies, so they
  ran with no validation at all (found while working P3-7).** — Fixed.

  NestJS's `ValidationPipe` skips validation when the resolved metatype is a
  native type, and an inline object type such as `@Body() dto: { courierId: string }`
  compiles to `Object`. The app's global `whitelist` / `forbidNonWhitelisted` /
  `transform` policy therefore did not apply to these routes, and Swagger
  documented no request body for any of them — while they type-checked and
  linted perfectly cleanly.

  Two of the four already had a correct DTO sitting unused in the module's own
  `dto/` file (`AssignCourierDto`; P3-7's `AdminSuspendCourierDto` was the same
  story), which is what makes this defect class easy to reintroduce: writing the
  DTO is the part people remember.

  **What the routes actually did with bad input** — measured by reverting the
  fix and running the new suite against it, not inferred:

  - `POST /organizations/:organizationId/laboratory-results` — the worst of the
    four, since it accepts clinical data. A body with no `items` array **500**ed
    on a `TypeError` from `dto.items.map`. A body with `items: []` returned
    **201**: it created a real `LaboratoryResult` row, on the track that leads to
    review and publication, carrying no measurements at all. A `flag` outside
    the `ResultFlag` enum was cast straight through by the controller's
    `flag: item.flag as any` into a Prisma enum column. A non-numeric
    `numericValue` threw inside the `Prisma.Decimal` constructor — part-way
    through the transaction that writes the result.
  - `POST /laboratory-appointments` — three required ids (`laboratoryId`,
    `testTypeId`, `slotId`), none validated; an empty body **500**ed after
    reaching Prisma with `undefined` ids.
  - `POST /organizations/:orgId/shipments/:shipmentId/assign` — a body with no
    `courierId` **500**ed (I had guessed 404; the measurement said otherwise).
  - `POST /me/laboratory-appointments/:appointmentId/cancel` — unknown
    properties silently accepted.

  All four now bind real DTO classes with proper decorators, including
  `@ValidateNested({ each: true })` + `@Type()` on the lab-result items array so
  the nested objects are validated too (an unknown property *inside* an item is
  now rejected, which is asserted). Every one of the failure modes above is a
  400 now. The `as any` cast on `flag` is gone — `@IsEnum(ResultFlag)` types it
  properly.

  **Adjacent data-loss bug fixed in the same pass.** `createResult` stored
  `item.numericValue ? new Prisma.Decimal(...) : null`. On this path
  `numericValue` is a plain number off the request body, so a legitimate result
  of **0** — an undetectable marker, a zero cell count — was silently stored as
  `null`, losing the measurement. Checked the two other `numericValue ?` sites
  (`laboratory.service.ts:1224`, `ai-context-builder-enhanced.service.ts:225`)
  and both are fine: they read a `Prisma.Decimal` from the database, and
  `Decimal(0)` is a truthy object. Only the write path was wrong. Pinned by a
  test that posts `numericValue: 0` and asserts the stored value is `0`, not
  null.

  **Guard against reintroduction.** Nothing in TypeScript or ESLint can see this
  defect, which is how five routes accumulated it. Added
  `src/common/controller-body-validation.spec.ts`, which reads every
  `*.controller.ts` under `src/modules` as source and fails on any `@Body()`
  bound to an inline object type (23 controllers, plus a test asserting the scan
  isn't silently empty). Proved it works: reintroducing the inline body on the
  shipments route fails it.

  Verified: `pnpm typecheck` 10/10, `pnpm lint` 0 errors, 650 API unit tests
  (626 + 24 from the new guard) + 16 mobile + package tests, `pnpm build` 4/4,
  and 95 e2e across 8 suites against a freshly created, migrated and seeded
  database. Reverting all four routes fails the new e2e suite 9/9 with exactly
  the status codes documented above. Confirmed the run leaves no residue.
  - Files: `apps/api/src/modules/laboratory/dto/laboratory.dto.ts` (new),
    `apps/api/src/modules/laboratory/laboratory.controller.ts`,
    `apps/api/src/modules/laboratory/laboratory.service.ts`,
    `apps/api/src/modules/shipments/shipments.controller.ts`,
    `apps/api/src/common/controller-body-validation.spec.ts` (new),
    `apps/api/test/laboratory-validation.e2e-spec.ts` (new).

- [x] **P3-15. Four navigation defects that every page was reproducing by hand
  (found while adding the tests P3-2 asked for).** — Fixed.

  Checked the nav data first, since a stale nav is the usual suspect: all three
  apps' sidebar entries match the routes that actually exist, and the entries
  marked "Soon" correspond to routes that genuinely don't. The problems were
  entirely in how the pages wired the shell up.

  - **Logout did nothing on most pages.** `onLogout` was passed as `() => {}`
    at 16 of 27 call sites in hospital-web, 20 of 34 in blood-center-web, and
    **30 of 32 in admin-web**. The button rendered and silently failed. Worst on
    the loading and error branches of each page — exactly where a user waiting
    on a slow request is most likely to give up and try to sign out — and worst
    of all in the admin console, where a dead sign-out button on a shared
    machine is a security problem, not a cosmetic one.
  - **admin-web never highlighted the current page.** `activeItem` is an id the
    caller has to hand-copy onto every render branch of every page; admin-web
    passed it on none of its fifteen. A fifteen-entry sidebar with nothing
    highlighted gives the user no idea where they are.
  - **Every sidebar click was a full document load.** The shared `Sidebar`
    renders plain `<a href>` so `packages/ui` can stay framework-agnostic
    (it peer-depends on React alone), but nobody injected Next's `Link`, so each
    navigation discarded the React tree and re-downloaded the bundle.
  - **The notifications bell was a no-op at all 61 call sites** in the two
    dashboards, and neither app has a notifications route to send it to.

  Fixed by giving each app one `components/AppShell.tsx` that owns all of it:
  it calls `usePathname()`, injects `next/link`, and handles logout itself
  (clear tokens, then `router.push('/')`, which is where the sign-in form
  lives). Pages now write `<AppShell title="…" userName={…}>` and pass no
  navigation props at all — 35 pages migrated, 521 lines deleted against 399
  added. The bell is simply not passed, so `Topbar` does not render it: a
  control that does nothing is worse than no control, and it can come back the
  day there is a route behind it.

  `packages/ui`'s `Sidebar` gained two props to make that possible, both
  optional so nothing else breaks: `linkComponent` (typed as a plain call
  signature rather than `ComponentType`, because Next's `Link` is a
  `ForwardRefExoticComponent` whose legacy `propTypes` static declares
  `href: Url` and fails assignability on that alone), and `currentPath`, from
  which the active entry is derived by longest matching `href`. The longest-match
  rule matters: `/` is a prefix of every route, so a naive `startsWith` would
  light up Dashboard on every page, and `/requests/new` has to select Requests
  rather than Dashboard. Explicit `activeItem` still wins where a caller sets it.
  Also marked disabled entries `aria-disabled` and named the nav landmark, which
  is what makes them assertable.

  **Tests** — 60 new, and the three components at the centre of this had none
  before: `Sidebar` (14, including six on the matching rule alone), `Topbar` (7,
  pinning that each control renders only when given a handler — the property the
  bell fix depends on), `DashboardShell` (3, that it forwards the new props),
  and `AppShell` (12 per app, 36 total, driving the real navigation data each app
  ships). Proved each fix is caught: reverting logout to `() => {}` fails 1,
  removing `linkComponent` fails 1, removing `currentPath` fails 2.

  Verified: `pnpm typecheck` 10/10, `pnpm lint` 0 errors, `pnpm build` 4/4, and
  825 unit tests across 8 packages (up from 765). The API is untouched; its 103
  e2e still pass. One caveat worth recording: a first e2e run failed all 10
  suites, which turned out to be the local Postgres having stopped, not the
  change — restarted it and re-ran green rather than assuming.
  - Files: `packages/ui/src/components/layout/Sidebar.tsx`,
    `packages/ui/src/components/layout/DashboardShell.tsx`,
    `packages/ui/src/components/layout/{Sidebar,Topbar,DashboardShell}.spec.tsx`
    (new), `apps/{hospital-web,blood-center-web,admin-web}/components/AppShell.tsx`
    and `AppShell.spec.tsx` (new), 35 page files across the three apps,
    `apps/*/vitest.config.ts`, `apps/*/vitest.setup.ts` (new),
    `apps/*/package.json` (RTL devDependencies).

- [x] **P3-16. The rest of `packages/ui` was untested, and two overlay
  components could not be closed from the keyboard.** — Fixed.

  P3-2's first installment covered five of the library's simplest components
  and listed the rest as outstanding. This closes that list for everything with
  behaviour worth asserting: `DataTable` (7 tests), `Modal` (8), `Drawer` (6),
  `SearchInput` (5) and `FilterBar` (2). Together with P3-15's layout tests the
  package goes from 21 tests to 73.

  Writing them turned up two real defects, both in the overlays:

  - **Neither `Modal` nor `Drawer` closed on Escape.** The only ways out were
    clicking the overlay or the X, so anyone not using a mouse was stuck inside
    the dialog with no way to dismiss it. Both now listen for Escape while open,
    and detach the listener on close and unmount — the unmount case has its own
    test, since a leaked document-level handler firing into a closed dialog's
    `onClose` is the usual way this gets written wrong.
  - **Neither identified itself as a dialog.** No `role="dialog"`, no
    `aria-modal`, and no association between the heading and the dialog, so a
    screen reader announced them as anonymous divs. Both now carry the role, are
    labelled by their title through `useId` when they have one, and fall back to
    a generic accessible name when they do not. The backdrop is marked
    `aria-hidden` so it is not announced as content.

  Also gave `SearchInput`'s clear button an `aria-label` — it was an unlabelled
  button next to the field.

  `DataTable`'s cell fallback is `String(value ?? '-')`, which is correct but
  easy to "simplify" into a truthiness check; there is a test asserting a
  numeric `0` renders as `0` rather than a dash, next to one asserting `null`
  does render as a dash. This is the same defect class as P2-20's `numericValue`
  bug, where a truthiness check on a real zero silently discarded a lab
  measurement.

  Proved the fixes are caught: removing the Escape handler and the dialog role
  fails 3 of Modal's 8 tests.

  Verified: `pnpm typecheck` 10/10, `pnpm lint` 0 errors, `pnpm build` 4/4, 853
  unit tests across 8 packages.
  - Files: `packages/ui/src/components/overlay/{Modal,Drawer}.tsx`,
    `packages/ui/src/components/form/SearchInput.tsx`, and new specs for
    `data/DataTable`, `overlay/Modal`, `overlay/Drawer`, `form/SearchInput`,
    `form/FilterBar`.

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
~~**P3-1 third installment** (`ai-logging`, `education`, `ai-history` —
41 new tests, full suite 519/519; along the way found and worked around
a pre-existing Jest/ESM incompatibility with the `uuid` package (mocked
in-spec, not a shared-config change) and a test-authoring mistake where
array-field defaulting made an intended fallback-path test pass for the
wrong reason, corrected before landing. Live-verified `education`'s full
HTTP surface end-to-end against the real dev DB — admin-only content
creation with RBAC enforcement, idempotent start, XP-awarding complete,
and stats aggregation — then deleted the test-generated rows and
confirmed stats returned to zero. `ai-logging`/`ai-history` have no
controller of their own, so rely on the same indirect
session-wide-verification reasoning as `audit-logs`/`permissions`/
`email`/`ai-cache`. 5 modules remain at zero coverage: `analytics`,
`campaigns`, `community`, `courier`, `appointment-slots`).~~ ✅ (partial)
~~**P3-1 fourth installment** (`community`, `campaigns`, `courier` — 48
new tests, full suite 567/567; live-verified `campaigns` and `courier`
end-to-end against the real dev DB (org-scoped ownership, the courier
status machine, idempotent join/start flows), cleaned up all
test-generated rows afterward. Along the way found and logged a new,
unrelated bug as **P3-8**: `GET /campaigns/my/campaigns` silently
overwrites a campaign's real status with the caller's own participation
status. 2 modules remain at zero coverage: `appointment-slots`,
`analytics` — `analytics` (896 lines) will likely need its own
installment).~~ ✅ (partial)
~~**P3-1 fifth installment** (`appointment-slots` — 22 new tests, full
suite 589/589. Live verification surfaced and this installment fixed a
serious production bug it happened to be blocked by: `GET
/appointments/availability` (donor slot search) 404ing on every real
call because `AppointmentsController` and `AppointmentSlotsController`
share `@Controller('appointments')` and Nest's module-import-order route
resolution let `AppointmentsController`'s `@Get(':id')` swallow the
literal `availability` path — same root bug class as P2-16's
notification-preferences discovery. Fixed by reordering
`AppointmentSlotsModule` ahead of `AppointmentsModule` in
`app.module.ts`; re-ran the full suite after (589/589, no regressions)
and live-verified the complete real flow end-to-end, including all
three audit rows. Only `analytics` (896 lines) remains at zero
coverage).~~ ✅ (partial)
~~**P3-1 sixth and final installment** (`analytics` — the last
zero-coverage module, 896 lines, 32 new tests concentrated on the
genuinely distinct logic rather than one test per structurally-repeated
helper: the shared org-access gate, the branchy `getDateRange` date-math
(including catching and fixing a self-authored off-by-one before
landing), `getActivityFeed`'s merge/sort/cap/independent-failure-
swallowing, `getAlerts`'/`getInventorySummary`'s/`getAlertCounts`'
threshold and bucketing logic, and the shared percent-rounding pattern.
Full suite 621/621. Live-verified the real HTTP surface end-to-end as
`HOSPITAL_ADMIN` — overview/inventory/alerts/activity all returning real
data, a donor blocked with a real 403, and cross-organization access
blocked by the global `OrganizationGuard` before the service's own
check even runs, confirming genuine defense-in-depth. All GETs, so no
cleanup needed. **P3-1 is now fully closed — all 32 backend modules
that had zero coverage at the start of this item now have real spec
files**, 621/621 passing overall, up from 424 when P3-1 began).~~ ✅
~~**P3-8** (`getUserCampaigns` was clobbering a campaign's real status
with the caller's participation status — renamed the participant field
to `participantStatus`, updated the mobile `Campaign` type and the unit
test into an explicit regression test, live-verified the exact repro
from P3-1 now returns both fields correctly, cleaned up test
data).~~ ✅
~~**P3-2 first installment** (stood up Vitest test infrastructure for
the frontend side of this repo for the first time — `packages/utils`
(18 tests), `packages/validation` (37 tests, the real client-side
validation gating mobile register/login), and `packages/ui` with a real
jsdom+React-Testing-Library harness (21 tests across 5 presentational
components including real `userEvent` interaction tests). 76 new tests,
all passing; `pnpm test`/`typecheck`/`lint` at the repo root confirm no
regressions (mobile's pre-existing NativeWind typing errors are
unrelated and unaffected); live-verified by building a real consumer
app (`hospital-web`) end-to-end. Still outstanding: the 3 Next.js apps'
own pages, the rest of `packages/ui`'s components, and the mobile/Expo
app's own test setup).~~ ✅ (partial)
~~**P3-3 first installment** (Docker half only — a real multi-stage
`apps/api/Dockerfile` + root `docker-compose.yml` (API + PostgreSQL,
healthchecked, migrations run on boot) + `.dockerignore` + README docs.
De-risked by first confirming the exact production entrypoint (`nest
build` → `node dist/src/main.js`) actually works — this session had
only ever run the API in dev-watch mode before. Verification is
honestly partial: this sandboxed session's Docker Hub pulls are
blocked by a confirmed egress-policy 403 (not a config issue, and per
the proxy's own instructions not something to route around), so
`docker compose up --build` could not be run end-to-end here — `docker
compose config` and a Dockerfile syntax parse both validated cleanly,
but someone with real registry access should run the actual build
before trusting this in a deployment. CI pipeline
(`.github/workflows`) is a separate, still-outstanding half of this
item).~~ ✅ (partial)
~~**P3-3 second installment** (CI-pipeline half — `.github/workflows/ci.yml`
with 4 jobs: lint+typecheck, 621 unit tests, API e2e against a real
`postgres:16-alpine` service container, and a full build. Unlike the
Docker half this was **genuinely verified end-to-end on GitHub's own
infrastructure**, across 2 real PRs and 5 real workflow runs — and that
verification earned its keep, finding 6 real bugs that had been
invisible because `app.e2e-spec.ts` had never once successfully run in
this repo's history: two ESM-only packages breaking Jest's CJS
transform (`uuid` → replaced with `crypto.randomUUID()`;
`expo-server-sdk` → pnpm-aware `transformIgnorePatterns`), a
non-callable supertest namespace import, every route 404ing because the
e2e harness never ran `main.ts`'s bootstrap config (fixed by extracting
a shared `configureApp()` into `src/bootstrap.ts`), the e2e job hanging
6+ minutes on a runner (`--forceExit`), and finally `POST /auth/register`
404ing in CI only — root-caused via a rigorous fresh-database local
reproduction to the workflow running migrations but never seeding, so
the `DONOR` role `register()` requires didn't exist. Final run: unit
tests ✓, e2e 14/14 ✓, build ✓; lint+typecheck ✗ **on purpose**, failing
only on `@bloodchain/mobile` — that's P3-9, a real pre-existing defect CI
correctly surfaced, not a pipeline problem).~~ ✅
~~**P3-9** (rewrote the 4 `className` screens onto the app's real design
system — and found, reading the theme properly, that a literal
Tailwind-to-StyleSheet translation would have been wrong: the app's
theme is *dark* while every one of those classes was light-mode web CSS,
so they were rebuilt against the same component library the other 27
screens use. Stood up the mobile app's first-ever test infrastructure to
verify it — jest-expo + react-test-renderer, 16 tests that actually
mount all 4 screens — because type-checking can't prove "renders
unstyled." Proved the tests catch the bug by stashing the fix and
re-running: 10 of 16 failed on the old code, while all four "renders
without crashing" tests still passed, exactly matching the defect's
shape; the old campaigns screen's whole 26-node tree came back with
`style: null` on every node. Repo-wide: typecheck 10/10, lint 10/10,
637 tests passing, build 4/4 — the CI pipeline is now fully green).~~ ✅
~~**E2E-1** (expanded e2e coverage from auth-only to the four core
business flows — donations, the blood-request/shipment/delivery chain,
emergency matching, and the inventory lifecycle. 64 new tests, 78
total, each driving several actors with genuinely different roles
against a real Postgres, and asserting refused transitions and RBAC
boundaries as hard as the happy paths. It found a completely broken
core endpoint on its first run: three Prisma queries in
donations.service.ts passed both `include` and `select` for the same
relation, which Prisma rejects, so check-in — the entry point of every
donation — had always returned 500. The 5 donations unit tests missed
it because they mock PrismaService. Also tightened teardown after
catch-and-ignore cleanup was caught hiding two broken delete calls and
leaving stale rows that made later runs fail for unrelated-looking
reasons. Verified by running the whole suite twice, 78/78 both times,
with the database confirmed clean and seeded data untouched).~~ ✅
~~**P3-5 + P3-6** (docs reconciled with reality, and the product renamed to
BloodChain. Deleted the two obsolete summary reports the user identified,
which removed the "45+ passing tests" and "production-ready through 19
phases" claims at the source. Checked every remaining claim against the
code before rewriting: architecture.md and api.md said WebSocket gateways
and domain events were unimplemented — both are real — but the same
sentence claimed Redis pub/sub, which nothing connects to, so the rewrite
documents the real event names *and* states the per-instance scaling
limit the old wrong text had hidden. The rename went two layers deep —
brand text plus the @donor/* npm scope across 63 files — because renaming
only the brand would have left the same mismatch in a new place; the dev
database name, seeded @donor.local emails and every RoleCode.DONOR
identifier were deliberately left alone).~~ ✅
~~**P3-12** (the OpenAPI status mismatch is gone, and deliberately not by
blanket-setting every route to 200. Reading what each one actually does
split the 16: twelve mutate an existing resource and now return 200 via
@HttpCode, while four genuinely create a row — education create/start,
campaign and challenge join — so their *annotation* was the wrong half
and 201 stays. That keeps every route semantically right and cuts the
breaking surface from 16 routes to 12. The e2e suites caught the change
on the three routes they exercise, exactly as a real consumer would;
a repo-wide re-scan shows no declared/actual mismatches left).~~ ✅
~~**P3-13** (gamification profile creation is no longer racy. Proved the
mechanism from Prisma's emitted SQL — upsert compiles to SELECT then a
plain INSERT with no ON CONFLICT — and reproduced the P2002 on 6 of 6
trials against a real database. Replaced it with a single atomic
INSERT ... ON CONFLICT DO NOTHING, extracted as a shared primitive.
Checking the siblings found four more racy call sites: the four
transactional upserts that increment XP and reputation now call the
atomic helper first, so their upsert always takes the update branch.
The regression guard is an e2e suite, since a unit test cannot
reproduce a database race; its first version silently passed against
the unfixed code, so it was measured and retuned until it failed on
reverted code in 3 of 3 runs).~~ ✅
~~**P3-11** (emergency matching now reaches compatible donors of other
blood groups, so a universal O-negative donor is finally alerted for an
A-positive patient instead of being silently excluded. Confirmed the
compatibility map was medically correct before relying on it, then
added the half a naive fix would have missed: ranking sorts exact-group
donors ahead of merely-compatible ones, because with a 50-donor cap and
distance-only ranking a nearby universal donor would otherwise crowd out
exact-group donors and spend the scarcest supply on a case
type-specific blood already covers. Proved by reverting the service:
the two unit tests that pin the query shape and the ranking tier fail,
as does the new e2e test — while the incompatible-donor test keeps
passing, so the pool widened to compatible donors, not to everyone).~~ ✅
Next up: the remainder of **P3-2** (Next.js app pages, more
`packages/ui` components — the mobile/Expo test setup half is now done
as part of P3-9), or **P3-4** through **P3-7** (env docs, stale docs,
dead admin DTOs), or **P3-10**.

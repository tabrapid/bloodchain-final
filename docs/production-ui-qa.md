# Production UI QA matrix

Every screen this product ships, and the states each one has to survive before
a release. It is a checklist for a human with a device and three languages in
front of them — not a report of what has already been checked.

## How to use it

Work one app at a time, one row at a time. For each row, put the screen into
each state in the header and record `PASS`, `FAIL` or `N/A`:

| Column | What it means |
| --- | --- |
| **Normal** | Real data, the happy path. |
| **Loading** | First load, before any data arrives. A spinner that never resolves, a blank page, or fake content standing in for real content is a FAIL. |
| **Empty** | A real account with nothing in it. Has to read as "you have none", with a way forward. |
| **Error** | Server unreachable or refusing. Has to be visibly different from Empty and offer a retry. |
| **Small** | 360×640 on mobile; 1024px wide on the web consoles. No horizontal page scroll, no clipped controls. |
| **Long uz** | Uzbek copy, which runs the longest. Nothing truncated mid-word, no button wider than its row. |
| **Long ru** | Russian copy. Same check. |
| **Restricted** | Signed in as a role that may not perform the screen's actions. Buttons that would 403 must not be offered as if they work. |
| **Destructive** | Every irreversible action asks first, names the row, and says it cannot be undone. |

A row is only done when every column is filled in. `N/A` is a legitimate
answer (a screen with no destructive action, say) — a blank is not.

## What this environment could and could not check

The automated suites cover the states a test can assert: the failure-vs-empty
distinction on the donor screens listed below, the confirmation dialog's
behaviour, the dialog focus contract, status labels against the Prisma enums,
and that no source file asks for a translation key that does not exist in all
three languages.

**No screen in this document has been looked at on a real device or in a real
browser from here, and none of these checks has been performed.** This
environment is headless: there is no simulator, no Expo client, and no browser
to render the three consoles. Every row below and every step in *Scripted paths*
needs a human. The rows marked **⚑** are the ones where the automated checks are
weakest and a real look matters most.

Work the **Scripted paths** section first — it is ordered by risk and every step
says what makes it fail. The per-screen tables afterwards are coverage: they
catch what a scripted path walks past.

## Donor mobile (Expo)

| Screen | Route | Normal | Loading | Empty | Error | Small | Long uz | Long ru | Restricted | Destructive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Welcome | `(auth)/welcome` | | | | | | | | | |
| Sign in | `(auth)/login` | | | | | | | | | |
| Phone entry | `(auth)/phone` | | | | | | | | | |
| OTP ⚑ | `(auth)/otp` | | | | | | | | | |
| Register | `(auth)/register` | | | | | | | | | |
| Register details | `(auth)/register-details` | | | | | | | | | |
| Check email | `(auth)/check-email` | | | | | | | | | |
| Verify email | `(auth)/verify-email` | | | | | | | | | |
| Forgot password | `(auth)/forgot-password` | | | | | | | | | |
| Reset password | `(auth)/reset-password` | | | | | | | | | |
| Complete profile | `(onboarding)/complete-profile` | | | | | | | | | |
| Home | `(app)/home` | | | | | | | | | |
| Health | `(app)/health` | | | | | | | | | |
| Health trends | `(app)/health-trends` | | | | | | | | | |
| AI insights ⚑ | `(app)/insights` | | | | | | | | | |
| Donate | `(app)/donate` | | | | | | | | | |
| Calendar ⚑ | `(app)/calendar` | | | | | | | | | |
| Community | `(app)/community` | | | | | | | | | |
| Campaigns | `(app)/campaigns` | | | | | | | | | |
| Challenges | `(app)/challenges` | | | | | | | | | |
| Education | `(app)/education` | | | | | | | | | |
| Gamification hub | `(app)/gamification` | | | | | | | | | |
| Achievements | `(app)/gamification/achievements` | | | | | | | | | |
| Badges | `(app)/gamification/badges` | | | | | | | | | |
| Leaderboard | `(app)/gamification/leaderboard` | | | | | | | | | |
| Donation history | `(app)/donations` | | | | | | | | | |
| Donation detail | `(app)/donations/[id]` | | | | | | | | | |
| Appointment detail | `(app)/appointment/[id]` | | | | | | | | | |
| Laboratory | `(app)/laboratory` | | | | | | | | | |
| Notifications | `(app)/notifications` | | | | | | | | | |
| Notification settings | `(app)/notification-settings` | | | | | | | | | |
| Profile | `(app)/profile` | | | | | | | | | |
| Edit profile | `(app)/profile/edit` | | | | | | | | | |
| Donor profile | `(app)/profile/donor` | | | | | | | | | |
| Security ⚑ | `(app)/security` | | | | | | | | | |
| Privacy | `(app)/privacy` | | | | | | | | | |
| Emergency SOS ⚑ | `sos` | | | | | | | | | |

### Donation booking wizard

| Step | Route | Normal | Loading | Empty | Error | Small | Long uz | Long ru | Restricted | Destructive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Type | `(booking)/select-type` | | | | | | | | | |
| Location | `(booking)/organizations` | | | | | | | | | |
| Date ⚑ | `(booking)/date` | | | | | | | | | |
| Time | `(booking)/time` | | | | | | | | | |
| Review | `(booking)/review` | | | | | | | | | |
| Confirmation | `(booking)/confirmation` | | | | | | | | | |

### Laboratory booking wizard

| Step | Route | Normal | Loading | Empty | Error | Small | Long uz | Long ru | Restricted | Destructive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Test type | `(lab-booking)/test-type` | | | | | | | | | |
| Laboratory | `(lab-booking)/laboratory` | | | | | | | | | |
| Date ⚑ | `(lab-booking)/date` | | | | | | | | | |
| Slot | `(lab-booking)/slot` | | | | | | | | | |
| Review | `(lab-booking)/review` | | | | | | | | | |
| Confirmation | `(lab-booking)/confirmation` | | | | | | | | | |

## Courier mobile

| Screen | Route | Normal | Loading | Empty | Error | Small | Long uz | Long ru | Restricted | Destructive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Active delivery ⚑ | `(courier)/active` | | | | | | | | | |
| History | `(courier)/history` | | | | | | | | | |
| Courier profile | `(courier)/profile` | | | | | | | | | |

## Hospital console

| Screen | Route | Normal | Loading | Empty | Error | 1024px | Long uz | Long ru | Restricted | Destructive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sign in | `/` (signed out) | | | | | | | | | |
| Register | `/register` | | | | | | | | | |
| Forgot / reset password | `/forgot-password`, `/reset-password` | | | | | | | | | |
| Dashboard | `/` | | | | | | | | | |
| Blood requests | `/requests` | | | | | | | | | |
| Request detail | `/requests/[id]` | | | | | | | | | |
| New request | `/requests/new` | | | | | | | | | |
| Inventory ⚑ | `/inventory` | | | | | | | | | |
| Shipments | `/shipments` | | | | | | | | | |
| Shipment detail ⚑ | `/shipments/[id]` | | | | | | | | | |
| Emergency ⚑ | `/emergency` | | | | | | | | | |
| Appointments ⚑ | `/appointments` | | | | | | | | | |
| Donations ⚑ | `/donations` | | | | | | | | | |
| Donors | `/donors` | | | | | | | | | |
| Donor detail | `/donors/[id]` | | | | | | | | | |
| Analytics | `/analytics` | | | | | | | | | |
| Organization | `/organization` | | | | | | | | | |
| Notifications | `/notifications` | | | | | | | | | |
| My account | `/account` | | | | | | | | | |

## Blood centre console

| Screen | Route | Normal | Loading | Empty | Error | 1024px | Long uz | Long ru | Restricted | Destructive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sign in | `/` (signed out) | | | | | | | | | |
| Register | `/register` | | | | | | | | | |
| Forgot / reset password | `/forgot-password`, `/reset-password` | | | | | | | | | |
| Dashboard | `/` | | | | | | | | | |
| Inventory ⚑ | `/inventory` | | | | | | | | | |
| Reservations & movements ⚑ | `/inventory` (holds tab) | | | | | | | | | |
| Blood requests | `/requests` | | | | | | | | | |
| Request detail ⚑ | `/requests/[id]` | | | | | | | | | |
| Shipments | `/shipments` | | | | | | | | | |
| Shipment detail ⚑ | `/shipments/[id]` | | | | | | | | | |
| Laboratory ⚑ | `/laboratory` | | | | | | | | | |
| Appointments ⚑ | `/appointments` | | | | | | | | | |
| Donations ⚑ | `/donations` | | | | | | | | | |
| Donors | `/donors` | | | | | | | | | |
| Donor detail | `/donors/[id]` | | | | | | | | | |
| Couriers | `/couriers` | | | | | | | | | |
| Analytics | `/analytics` | | | | | | | | | |
| Organization | `/organization` | | | | | | | | | |
| Notifications | `/notifications` | | | | | | | | | |
| My account | `/account` | | | | | | | | | |

## Admin console

| Screen | Route | Normal | Loading | Empty | Error | 1024px | Long uz | Long ru | Restricted | Destructive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sign in | `/` (signed out) | | | | | | | | | |
| Forgot / reset password | `/forgot-password`, `/reset-password` | | | | | | | | | |
| Dashboard | `/` | | | | | | | | | |
| Organizations ⚑ | `/organizations` | | | | | | | | | |
| Users ⚑ | `/users` | | | | | | | | | |
| Roles & permissions | `/roles` | | | | | | | | | |
| Couriers ⚑ | `/couriers` | | | | | | | | | |
| Emergencies | `/emergencies` | | | | | | | | | |
| Blood requests | `/requests` | | | | | | | | | |
| Shipments | `/shipments` | | | | | | | | | |
| Inventory | `/inventory` | | | | | | | | | |
| Alerts | `/alerts` | | | | | | | | | |
| Moderation ⚑ | `/moderation` | | | | | | | | | |
| Audit log | `/audit` | | | | | | | | | |
| System health | `/health` | | | | | | | | | |
| AI analytics | `/ai-analytics` | | | | | | | | | |
| Platform settings | `/settings` | | | | | | | | | |
| Notifications | `/notifications` | | | | | | | | | |
| My account | `/account` | | | | | | | | | |

## Scripted paths — do these first

The tables above are coverage. This section is the **order to work in**, with
the exact steps and the exact thing that makes each step PASS or FAIL. A step
with no explicit FAIL condition is not a check, it is a demonstration.

Sign in details and reset instructions: `docs/PRESENTATION-DEMO.md`.
Run `pnpm demo:reset` before starting, and again between operators.

Record each path as PASS or FAIL with the step number where it failed.

---

### M1 — Donor auth and onboarding *(donor app)*

1. Open the app signed out. **FAIL if** the Welcome screen shows a raw key, an
   untranslated string, or a button that does nothing.
2. Tap Sign in → enter a wrong password. **FAIL if** the error is a raw API code
   (`INVALID_CREDENTIALS`), a stack trace, or nothing at all.
3. Enter the correct password. **FAIL if** the button can be double-tapped into
   two requests, or the field values are lost on the way back from an error.
4. Sign out. Choose phone sign-in, enter a number, request an OTP. **FAIL if**
   the resend timer is absent, or resend can be tapped repeatedly with no limit.
5. Enter a wrong OTP twice, then the right one. **FAIL if** the wrong-code error
   is not human-readable, or the attempt counter is invisible.
6. Register a new account. **FAIL if** password rules are stated only after
   failing, or first/last name are collapsed into one field.
7. Complete the onboarding profile. **FAIL if** a required step can be skipped,
   or the progress indicator disagrees with the steps shown.
8. Switch the language to Uzbek, then Russian, at every screen above.
   **FAIL if** any label stays English or wraps out of its control.

### M2 — Home and Health *(donor app)*

1. Open Home. **FAIL if** any statistic is a placeholder, or the next
   appointment card shows a date in a format other than the rest of the app.
2. Kill the network and pull to refresh. **FAIL if** the screen empties, or says
   "no data" rather than that it could not reach the server.
3. Restore the network and retry. **FAIL if** the retry does nothing.
4. Open Health. **FAIL if** a laboratory value is shown without its unit, or a
   normal/low/high flag appears against a value with no reference range.
5. With `AI_ENABLED=false`, check Health. **FAIL if** the AI card is present at
   all. **FAIL if** it is present and disabled — it must not be there.
6. Open Health trends, switch parameters and ranges. **FAIL if** a chart renders
   with one point as a line, or a date axis is in US format.

### M3 — Donate and the donation booking wizard *(donor app)*

1. Donate → Book. Step through type, location, date, time, review, confirm.
2. At the date step: **FAIL if** days with no slots are tappable, if today or a
   past day is selectable, or if the month label is in a language other than the
   one selected.
3. At the date step with the network off: **FAIL if** the grid shows every day
   as available, or shows nothing without saying why.
4. Pick a month with no open slots. **FAIL if** the screen is a grid of grey
   cells with no explanation.
5. At the time step: **FAIL if** the clock is 12-hour anywhere.
6. Confirm the booking. **FAIL if** the confirmation does not show the reference
   number, or the appointment is missing from Calendar afterwards.
7. Open the appointment and cancel it. **FAIL if** cancelling does not ask, or
   asks without naming the appointment.

### M4 — Laboratory booking *(donor app)* — **highest priority**

1. Laboratory → Book a test. Step through test type, laboratory, date, slot,
   review, confirm.
2. At the laboratory step: **FAIL if** a laboratory is offered that does not run
   the chosen panel.
3. At the date step, watch the network panel: **FAIL if** more than one
   availability request fires for one month view. This is the fix Sprint 5
   shipped and the one most likely to regress.
4. Move to the next month, then back. **FAIL if** the previous month re-fetches
   when nothing changed, or the grid flashes fully-available before settling.
5. Pick an open day, then a slot, then confirm. **FAIL if** the confirmation
   does not name the panel booked.
6. Open My tests. **FAIL if** the booking is absent, or shows no test type.

### M5 — Calendar, notifications, profile, security *(donor app)*

1. Calendar: move back a month, pick a past day. **FAIL if** past appointments
   are invisible, or the day heading is in the wrong language.
2. Notifications: **FAIL if** unread and read look identical, or tapping one
   does not open what it refers to.
3. Notification settings: toggle each category. **FAIL if** a toggle shows a
   category that cannot reach a donor, or reverts silently on failure.
4. Profile → Edit, change a field, save. **FAIL if** the change is not reflected
   on Profile immediately.
5. Security → Sessions. **FAIL if** the current device is not marked, or if the
   confirmation for signing out *this* device reads the same as revoking
   another one.
6. Revoke another session. **FAIL if** the list does not update.

### M6 — Emergency SOS *(donor app)*

1. Trigger SOS from the donor side with a seeded active emergency.
   **FAIL if** the state machine skips a state, or a state has no wording.
2. Accept, then cancel the response. **FAIL if** cancelling does not confirm.
3. **FAIL if** location permission is requested without saying why.

### M7 — Courier *(donor app, courier account)*

1. Sign in as the courier. Open Active. **FAIL if** an assigned delivery is
   missing, or the map renders with no markers and no explanation.
2. Accept, start pickup, mark picked up, mark in transit, deliver.
   **FAIL if** any transition offers a button the backend then refuses.
3. Report a problem. **FAIL if** the reason is not required.
4. History and Profile. **FAIL if** the status toggle does not persist.

---

### W1 — Hospital donation workflow *(hospital console)*

1. Appointments → today. **FAIL if** the roster does not show today's bookings.
2. Create a slot, then block it. **FAIL if** blocking does not confirm, or the
   confirmation does not say donors will no longer be able to book.
3. Donations → check a donor in. **FAIL if** the assessment can be recorded
   before check-in, or collection started before an approving assessment.
4. Defer a donor. **FAIL if** the reason is optional, or the dialog does not
   name the donor.
5. Complete a donation with a volume. **FAIL if** an out-of-range volume is
   accepted, or completion does not create an inventory unit.
6. Abort a collection. **FAIL if** the reason is optional.
7. Mark an appointment as a no-show. **FAIL if** it does not confirm, or the
   seat is not released.

### W2 — Emergency *(hospital console)*

1. Create an emergency request. **FAIL if** the component or blood group can be
   left unset, or the form accepts zero units.
2. Activate it. **FAIL if** matching produces no visible result and no message.
3. Confirm a donor's arrival, then complete the donation. **FAIL if** the
   collected volume is not asked for, or is asked for in a browser prompt.
4. Cancel an emergency. **FAIL if** it does not confirm, or the confirmation
   does not say that alerted donors will be told.
5. Force a failure (stop the API). **FAIL if** the failure appears in a browser
   alert box rather than on the page.

### W3 — Donor verification *(hospital and blood centre consoles)*

1. Donors → open a donor. **FAIL if** the verification status is shown as a raw
   enum (`REQUIRES_REVIEW`).
2. Verify a blood group, choosing a source. **FAIL if** the source is optional,
   or a free-text note is the only record.
3. Filter the donor list by verification status. **FAIL if** the filter options
   are raw enums.

### W4 — Blood request *(hospital → blood centre)*

1. Hospital: create a request with two line items. **FAIL if** the component
   list shows raw enums, or a line can have zero units.
2. Submit. **FAIL if** the submit button can be double-clicked.
3. Blood centre: open the request, approve it. **FAIL if** the units reserved
   are not the oldest matching stock.
4. Reject a second request. **FAIL if** the reason is optional.
5. Mark ready for pickup, create a shipment, assign a courier.
   **FAIL if** any of these uses a browser dialog.
6. Hospital: confirm delivery with **fewer** units than shipped. **FAIL if** the
   discrepancy reason is not required.

### W5 — Blood centre inventory and reservations — **highest priority**

1. Inventory → open a unit. **FAIL if** the component type or status is a raw
   enum.
2. Discard it. **FAIL if** the dialog does not name the unit, does not say the
   action cannot be undone, or accepts an empty reason.
3. Quarantine another unit, then release it. **FAIL if** either step uses a
   browser prompt.
4. Issue a unit. **FAIL if** the patient/recipient reference is optional.
5. Stop the API and try to discard. **FAIL if** the error appears anywhere but
   inside the dialog, or the typed reason is lost.
6. Reservations tab → release a hold. **FAIL if** it does not confirm, or the
   unit does not return to available stock.
7. Adjust a unit's volume/component/expiry. **FAIL if** the reason is optional.

### W6 — Laboratory *(blood centre console)*

1. Laboratory → confirm, check in, start and complete an appointment.
   **FAIL if** any step uses a browser confirm.
2. Enter results for every parameter, then review, then publish. **FAIL if**
   publishing is possible before review.
3. Check the donor app. **FAIL if** the published result is not visible, or a
   flag appears against a parameter with no reference range.
4. Mark an appointment as a no-show. **FAIL if** it does not confirm.

### W7 — Notifications and account *(all three consoles)*

1. Trigger a low-stock alert (discard units until below five).
   **FAIL if** the bell does not update, or the count is wrong.
2. Open the notification inbox. **FAIL if** entries are undated or unsorted.
3. My account → change password. **FAIL if** the policy is not stated, or other
   sessions are not signed out.

### W8 — Admin *(admin console)*

1. Organizations → verify one, reject one, suspend one. **FAIL if** any uses a
   browser dialog, or rejection accepts an empty reason.
2. Users → suspend and restore. **FAIL if** the dialog does not name the user.
3. Couriers → suspend. **FAIL if** the dialog does not name the courier.
4. Roles & permissions → open a role. **FAIL if** any group heading reads as a
   raw database prefix (`BLOOD CENTER`, `BLOOD TEST`) rather than a phrase.
5. Blood availability → filter across organisations. **FAIL if** results are not
   scoped correctly, or component types are raw enums.
6. Platform settings, health, audit, moderation, AI analytics: open each.
   **FAIL if** any shows a raw enum or an untranslated label.

### W9 — Destructive dialogs, as a set

Every dialog below must: name the thing, say when it cannot be undone, require
a reason where one is required, keep what was typed when the server refuses, and
return focus to the control that opened it when dismissed with Escape.

Work through them with the keyboard only — never touching the mouse:

| # | Dialog | Reason required? |
| --- | --- | --- |
| 1 | Discard a blood unit | Yes |
| 2 | Issue a blood unit | Yes (recipient reference) |
| 3 | Quarantine a blood unit | Yes |
| 4 | Release a reservation | No |
| 5 | Defer a donor | Yes |
| 6 | Abort a collection | Yes |
| 7 | Cancel an appointment | No |
| 8 | Mark a no-show | No |
| 9 | Block a slot | No |
| 10 | Cancel an emergency | No |
| 11 | Cancel a shipment | No |
| 12 | Verify an organization | No |
| 13 | Reject an organization | Yes |
| 14 | Suspend an organization | No |
| 15 | Suspend a user | No |
| 16 | Suspend a courier | No |

**FAIL if** Tab escapes any dialog onto the page behind it.
**FAIL if** Escape closes a dialog and focus lands at the top of the document.

---

## Cross-cutting passes

Run these once per app rather than per screen.

### Language

- [ ] Switch to Uzbek and walk every root tab / sidebar entry. No English left,
      no raw `some.key.path` on screen.
- [ ] Repeat in Russian.
- [ ] Check the longest labels — Russian status badges and Uzbek button text —
      do not wrap into two lines inside a one-line control.

### Keyboard (web consoles)

- [ ] Tab from the top of each console reaches every control, in reading order.
- [ ] The focus ring is visible on every stop, including inside tables and
      dialogs.
- [ ] Opening any dialog moves focus into it; Tab cycles inside it; Escape
      closes it; focus returns to the control that opened it.

### Screen reader

- [ ] Mobile: every icon-only button announces what it does.
- [ ] Web: table cells announce with their column header; status badges read as
      words, not enum values.

### Font scaling (mobile)

- [ ] Set the OS text size to its largest and open Home, Health, Donate and the
      two booking wizards. Nothing is clipped and no button loses its label.

### Destructive actions

Each of these must name what is being acted on, say when it cannot be undone,
require a reason where the domain requires one, and report a refusal in the
dialog rather than a separate box:

- [ ] Blood unit: discard, issue, quarantine
- [ ] Reservation: release
- [ ] Donor: defer at assessment
- [ ] Collection: abort
- [ ] Appointment: cancel, mark no-show
- [ ] Slot: block
- [ ] Emergency: cancel
- [ ] Shipment: cancel
- [ ] Organization: verify, reject, suspend
- [ ] User: suspend
- [ ] Courier: suspend
- [ ] Donor's own session: revoke another device, sign out this device

### AI switched off

With `AI_ENABLED=false` in the API's environment:

- [ ] The Health screen does not offer the AI card at all.
- [ ] The Insights screen says once, plainly, that the feature is off, and every
      generate/chat control is disabled rather than returning a 403 on tap.
- [ ] Nothing in the UI implies a medical capability that is not there.

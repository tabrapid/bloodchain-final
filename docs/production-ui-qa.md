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
browser from here.** This environment is headless: there is no simulator, no
Expo client, and no browser to render the three consoles. Every row below needs
a human. The rows marked **⚑** are the ones where the automated checks are
weakest and a real look matters most.

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

# Mobile V2 — visual QA report

Sprint 11.1. This is the record of what the app **looked like when it was
running**, screen by screen and state by state, and what that turned up.

---

## 1. What was captured, and what that is worth

Every screen in the app was rendered and photographed: **490 screenshots**,
53 screens, two phone sizes, three languages, and for every network screen the
states a donor can actually be in — populated, empty, failed, loading, offline,
mid-flow, mid-permission, and the destructive confirmations.

They were rendered by **react-native-web in Chromium**, against the real API
with the seeded development database, driven by
`apps/mobile/qa/visual/capture.mjs`. That is the same screen code a release
build ships, with the same data, the same three languages and the same states.

**It is not the iOS or Android renderer, and this report does not claim it
is.** Yoga, the platform text engines, the platform fonts, `expo-blur`,
`react-native-maps` and the operating systems' own dialogs are absent or
approximated. What a browser capture settles is layout, hierarchy, spacing,
state handling and text length in three languages — which is most of what a
visual review is for, and was enough to find twenty-nine defects the code
review had missed, each with a file, a line and a fix.

What it cannot settle is how the app looks on a phone.
`NATIVE_VISUAL_QA_NOT_PERFORMED` and `PHYSICAL_DEVICE_NOT_VERIFIED` both remain
open in `docs/mobile-release-blockers.md`. The harness for that capture is
written and checked in (`qa/visual/run-native-capture.sh` plus the Maestro
flows); it needs a macOS machine or an Android SDK, and this environment has
neither — `dl.google.com` is refused by the egress policy, so the SDK cannot
even be installed.

### How to reproduce it

Three commands, in `apps/mobile/qa/visual/README.md`. The whole run takes about
fifty minutes and writes `artifacts/mobile-v2-visual-qa/` plus
`screenshots.json`, which is the source of every table in §6.

---

## 2. What the pictures found

Twenty-nine defects, none of which came from reading the code. They are grouped
by what they had in common; the commit column is the fix.

### Things the app said that were not true

| What | Where | Fix |
| --- | --- | --- |
| The XP bar was **always full**: the API reports progress as a percentage and `Progress` draws a fraction, so a donor 36% through their level saw a complete bar, on three screens | home, profile, recognition | `0beeb4b3` |
| The profile-completion bar was **always zero**, and announced "0%", because both callers read an envelope `apiRequest` had already unwrapped — so a donor who was 80% done was told to complete their profile, and Profile's completion card never rendered at all | home, profile | `0beeb4b3` |
| A **verified donor was shown as unverified** for the first seconds of every launch, at 48pt, because the fallback for "not answered yet" is the same as the fallback for "not verified" | home, profile | `f9a9536d` |
| A **failed request was reported as a fact**: Level 1 and "no badges yet" for a donor with forty donations; "no leaderboard data"; "appointment not found" for a booked appointment | recognition, leaderboard, appointment detail | `52d4c416` |
| Both booking receipts showed a **green tick over an empty card** when the read-back failed: no reference number, no location, no retry | booking, lab booking | `54491bdc` |
| The emergency card printed the **database's own urgency words** — CRITICAL, HIGH — in English block capitals on an otherwise translated screen | sos | `f9a9536d` |
| The **Rh sign was computed two ways**, so a request with an unrecognised factor read "AB" in the list and "AB-" one tap later | sos | `f9a9536d` |
| Five of the eight **emergency match statuses** fell through to the raw enum: DECLINED, EXPIRED, CANCELLED, NO_RESPONSE | sos | `0beeb4b3` |
| The privacy screen said data export and account deletion were available by **contacting support**, and this product has no support contact anywhere in it | privacy | `0beeb4b3` |

### Controls that did nothing, or the wrong thing

| What | Where | Fix |
| --- | --- | --- |
| **"Start" opened nothing.** Every article's body has been in the payload since the module shipped, with no screen to read it in; the card then offered "Complete" for an article the donor had never seen | education | `f62eab12` |
| **Four donation types, one handler**: whole blood, plasma, platelets and other each had their own icon and interval, and all four booked the same appointment while announcing "Book a donation" | donate | `f9a9536d` |
| **Five markers, one destination**: every marker row opened Health trends on whatever parameter came back first | health | `f9a9536d` |
| **"Load more" replaced** the ten donors on screen with the next ten | leaderboard | `52d4c416` |
| **Joining one thing spun everything**: a single pending flag drove every card | campaigns, challenges | `f9a9536d` |
| A **joined campaign still offered to join it**, and a successful join changed nothing on screen | campaigns | `f9a9536d` |
| **Reporting another donor was one tap** on a chevron row, with no confirmation, and the outcome appeared at the top of a feed the donor had scrolled past | community | `f9a9536d` |
| A **privacy control that exists end to end was not offered**: leaderboard visibility has a column, a setter and a query that honours it; only the read was missing | privacy | `0beeb4b3` |

### Ways out that were not there

| What | Where | Fix |
| --- | --- | --- |
| The profile wizard had **no exit at all** on step one, and is reached from two cards on screens a donor was in the middle of | onboarding | `740cdd5b` |
| **Android's back button left the wizard** rather than stepping back in it — from step 6, with five steps of answers in it | onboarding | `740cdd5b` |
| Sign-up's third step had **no header**, so a donor who mistyped their name had nothing to press | register-details | `740cdd5b` |
| **Back from a booking receipt** returned to the time picker of the appointment just booked, with Continue still live | booking, lab booking | `740cdd5b` |
| **"Not now" on the SOS location explainer was final** for the rest of the journey | sos | `c5293298` |

### Layout that cut the wrong thing

| What | Where | Fix |
| --- | --- | --- |
| **A four-column grid was never four columns**: each cell gave back one gap's share where a row needs `columns - 1`, so the blood-type step rendered 3/3/2 and both time pickers rendered two per row with a third of the row empty | onboarding, booking, lab booking | `f9a9536d` |
| **Six lists sat under the floating tab bar**, each hard-coding the 96pt fallback while the measured bar is about 10pt taller on a phone with a home indicator | six list screens | `f9a9536d` |
| A **stat label was clipped in English** — "Emergency r…" — before Russian made it worse | home, donate | `0beeb4b3` |
| **Health's marker titles were clipped** by five elements competing for one line: "Red blood cells" rendered "Red Bloo…" | health | `54491bdc` |
| **Calendar cut the hospital's name** because a trailing status badge takes its width first | calendar | `873ed279` |
| **Profile's identity card was sized by an 11pt caption**, so the donor's own name and email paid for the words "BLOOD TYPE" | profile | `873ed279` |
| The **courier's delivery history never showed a date** — last in a four-fact subtitle clamped to two lines, on a screen whose purpose is what happened and when | courier | `873ed279` |
| A **sheet taller than the phone grew off the top of it**, taking its own title and close button with it | booking's region picker | `54491bdc` |
| **Auth screens' bottom-anchored alternate path never reached the bottom**: the spacer had nothing to grow into | four auth screens | `740cdd5b` |
| The **wizard's action landed at a different height on each of six steps**, and below the fold on the two that ask for typing | onboarding | `53248395` |
| An **unearned badge's name was unreadable** at roughly 2.1:1 — under the 3:1 floor for anything at all | badges | `52d4c416` |
| The **level name and the achievement name were each printed twice** in the same row or card | recognition, profile, achievements | `873ed279` |
| The **keyboard covered the field and the buttons** on two screens and in every sheet with a field in it | appointment detail, insights, courier sheets | `52d4c416`, `54491bdc` |
| The **emergency screen blanked itself** to a centred spinner on every action, including "I have arrived" | sos | `54491bdc` |
| The **emergency banner's button could not be focused** by a screen reader, because the banner announced itself as one element | home | `c5293298` |
| **Health offered AI and withdrew it** a moment later wherever AI is switched off | health | `c5293298` |

### Found and deliberately not changed

- **The "Terms of Service" and "Privacy Policy" phrases on the welcome screen
  are bold but inert.** They are not links: no underline, no link role, and the
  component says why — the app has no Terms screen and no URL yet. Bold in
  running text does suggest a tap, and the alternative is a consent line nobody
  notices. Kept, and it goes away when the URLs arrive.
- **"Resend email" on the check-email screen dims when it has no address.** It
  is properly disabled and announced as disabled; only the visual affordance is
  weak.
- **The medium and low findings from the audit** (258 raised, 46 high) were
  triaged; the high ones are all above. The remainder are recorded in the
  sprint's working notes and are not blockers.

---

## 3. What each screen looks like now

Read from the final capture, at 393×852 and 412×915, in all three languages.

| Area | Hierarchy | Spacing and rhythm | Typography | Notes |
| --- | --- | --- | --- | --- |
| Auth | Headline, form, primary action, alternate path — in that order on all ten screens | Consistent `xl` between blocks; the alternate path now sits at the foot | One display size, one body, one caption | Uzbek and Russian both wrap rather than clip |
| Onboarding | Step count, title, question, action | Same rhythm on all six steps, and the action is at the same height on each | — | The blood-type grid is four columns again |
| Home | Identity, then what is urgent, then what is next, then the record | Cards separated by `xl`, sections by a header | Blood type is the only hero-sized thing on the screen | Skeletons while the profile loads, rather than a wrong answer |
| Health | Latest tracked, markers, results, AI | — | Marker measurement moved to the subtitle line, which freed the title | Glyphs are one neutral colour; the badge carries status |
| Donate | Eligibility, action, record, campaigns | — | — | Type rows are a record, not a menu |
| Community | Rank, impact, feed | — | — | Report outcome floats over the list |
| Calendar | Month, selected day, appointments | — | — | Status is a dot on the subtitle line |
| Profile | Identity, completion, records, account | — | — | Name and email have the width back |
| SOS | Urgency, hospital, deadline, action | Critical requests carry a border as well as a fill | Blood type large, everything else quiet | No route, no ETA; the map says what it is showing |
| Booking / lab booking | Step counter, question, options, pinned action | Identical across all twelve steps | — | Grids are the column count they ask for |
| Recognition | Level, XP, badges, achievements | — | The level name is said once | Unearned badges are legible |
| Account | Grouped rows, destructive actions last | — | — | Two destructive actions confirm; deletion says it cannot |
| Courier | Delivery, units, addresses, actions | — | — | History shows dates |

---

## 4. What was measured rather than judged

- **Clipping.** Every capture measures any element drawn past the right edge of
  the viewport and records it in `screenshots.json`. §6 lists every occurrence
  in the final run.
- **Console errors.** Recorded per capture. A screen that throws is not a
  screen that passed.
- **Signed-out captures are failures.** A capture of a signed-in screen that
  renders the login screen is recorded as a failure rather than filed as a
  screenshot — which is how 151 silently signed-out captures were caught in the
  first full run.
- **Contrast** is computed in `src/design/tokens.spec.ts` (46 assertions) for
  every text token against every surface it can sit on, and is not re-judged by
  eye here.

## 5. What is still unverified

| | Why |
| --- | --- |
| Native rendering, on either platform | No macOS, no Android SDK (`dl.google.com` refused). `NATIVE_VISUAL_QA_NOT_PERFORMED` |
| Safe areas | The browser has none; the harness mocks insets. Native capture only |
| Keyboard behaviour | No soft keyboard in a browser. The fixes are structural (`FormScreen`, `KeyboardAvoidingView`); whether they are enough is a native observation |
| Accessibility font scaling | `PixelRatio.getFontScale()` is always 1 on the web, so large-text is native-only |
| VoiceOver and TalkBack order | Roles and labels are asserted in tests; the reading order is not |
| The operating systems' permission dialogs | Not capturable. The app's own explainers, which come first, are captured |
| Maps | `react-native-maps` is a labelled placeholder in the harness, and Android maps need a key (`EXTERNAL_BLOCKER_ANDROID_MAPS_KEY`) |
| Blur | The tab bar is drawn opaque in the browser |
| Gesture and scroll feel | Native only |

---

## 6. The inventory

Every screenshot, what it shows, and what was measured in it. Generated from
`artifacts/mobile-v2-visual-qa/screenshots.json` by
`node apps/mobile/qa/visual/report.mjs` — the numbers are the capture's, not a
transcription.

**On the 124 captures that logged a console error.** Between them they logged
130 messages, and every one is accounted for; none is an unexplained failure. 84
are the 500s this harness *injects* to photograph a screen's error state, 4 the
400 a wrong one-time code returns, 4 the 409 a taken slot returns, and 4 the
refused connection behind the offline states. 6 are the courier screen polling
`/shipments/qa-shipment-1/tracking` for a shipment that exists only in the
fixture's stubbed response — the screen swallows it and draws from local state,
which is what it is written to do. The remaining 28 are `BackHandler is not
supported on web`, a react-native-web warning about an API that is correct on
Android and absent on the web: it says nothing about the device build.

<!-- generated:inventory:start -->

**490 screenshots**, 53 screens, 2 device sizes (android-412x915, iphone-393x852), 3 locales (en, ru, uz). 0 captures failed. 0 captures measured content past the right edge. 124 captures logged a console error.

Every link below is relative to `docs/`, so it opens from this file.

### `account/notification-settings` — Notification settings

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notification-settings/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notification-settings/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notification-settings/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notification-settings/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `permission-explainer` | explained before the OS is asked | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notification-settings/permission-explainer.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `default` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notification-settings/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notification-settings/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notification-settings/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notification-settings/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `permission-explainer` | explained before the OS is asked | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notification-settings/permission-explainer.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |

### `account/notifications` — Notifications

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notifications/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notifications/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notifications/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notifications/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/notifications/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notifications/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notifications/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notifications/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notifications/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/notifications/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `account/privacy` — Privacy

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | what the backend can actually do, and what it cannot | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/privacy/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `delete-account` | the deletion route as it stands today | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/privacy/delete-account.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/privacy/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/privacy/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `default` | what the backend can actually do, and what it cannot | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/privacy/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `delete-account` | the deletion route as it stands today | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/privacy/delete-account.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/privacy/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/privacy/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `account/profile-donor` — Donor profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/profile-donor/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/profile-donor/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/profile-donor/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/profile-donor/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/profile-donor/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/profile-donor/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/profile-donor/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/profile-donor/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `account/profile-edit` — Edit profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/profile-edit/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/profile-edit/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/profile-edit/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/profile-edit/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/profile-edit/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/profile-edit/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/profile-edit/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/profile-edit/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `account/security` — Security

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `change-password` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/security/change-password.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/security/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/security/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `sessions-error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/security/sessions-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/account/security/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `change-password` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/security/change-password.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/security/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/security/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `sessions-error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/security/sessions-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/account/security/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `auth/check-email` — Check your email

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/check-email/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/check-email/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/check-email/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/check-email/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |

### `auth/forgot-password` — Forgot password

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/forgot-password/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/forgot-password/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/forgot-password/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/forgot-password/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/forgot-password/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/forgot-password/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `auth/login` — Sign in

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `email-mode` | switched from phone to email | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/login/email-mode.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | nothing entered yet | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/login/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | request in flight, button in its pending state | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/login/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | Russian labels and helper text | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/login/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek labels and helper text | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/login/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `server-error` | the API answered 500 | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/login/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | submitted empty, so every rule fires at once | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/login/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `email-mode` | switched from phone to email | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/login/email-mode.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | nothing entered yet | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/login/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | request in flight, button in its pending state | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/login/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | Russian labels and helper text | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/login/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek labels and helper text | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/login/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `server-error` | the API answered 500 | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/login/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | submitted empty, so every rule fires at once | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/login/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `auth/otp` — One-time code

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | code not entered | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/otp/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `entered` | six digits in | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/otp/entered.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `server-error` | wrong or expired code | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/otp/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `empty` | code not entered | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/otp/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `entered` | six digits in | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/otp/entered.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `server-error` | wrong or expired code | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/otp/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |

### `auth/phone` — Phone sign-in

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/phone/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/phone/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/phone/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/phone/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/phone/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/phone/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `auth/register` — Create account

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/register/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/register/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `validation-errors` | submitted empty | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/register/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/register/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/register/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `validation-errors` | submitted empty | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/register/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `auth/register-details` — Your details

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/register-details/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/register-details/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/register-details/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/register-details/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/register-details/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/register-details/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `auth/reset-password` — Reset password

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/reset-password/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/reset-password/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/reset-password/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/reset-password/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `auth/verify-email` — Verify email

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `loading` | while the token is being checked | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/verify-email/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `server-error` | expired link | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/verify-email/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | while the token is being checked | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/verify-email/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `server-error` | expired link | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/verify-email/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |

### `auth/welcome` — Welcome

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | first screen a new donor sees | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/welcome/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `light` | light appearance | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/welcome/light.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | Russian copy at the same widths | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/welcome/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek copy at the same widths | [png](../artifacts/mobile-v2-visual-qa/android-412x915/auth/welcome/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `default` | first screen a new donor sees | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/welcome/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `light` | light appearance | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/welcome/light.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | Russian copy at the same widths | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/welcome/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek copy at the same widths | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/auth/welcome/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |

### `booking/1-select-type` — Booking — type

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/1-select-type/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/1-select-type/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `selected` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/1-select-type/selected.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/1-select-type/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/1-select-type/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `selected` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/1-select-type/selected.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `booking/2-organizations` — Booking — centre

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/2-organizations/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/2-organizations/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `filters-open` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/2-organizations/filters-open.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/2-organizations/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/2-organizations/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `permission-location-explainer` | nearby asks before the OS does | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/2-organizations/permission-location-explainer.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/2-organizations/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/2-organizations/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/2-organizations/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `filters-open` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/2-organizations/filters-open.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/2-organizations/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/2-organizations/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `permission-location-explainer` | nearby asks before the OS does | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/2-organizations/permission-location-explainer.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/2-organizations/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `booking/3-date` — Booking — date

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/3-date/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/3-date/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/3-date/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/3-date/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | the month has nothing open | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/3-date/no-open-dates.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/3-date/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/3-date/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/3-date/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/3-date/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/3-date/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | the month has nothing open | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/3-date/no-open-dates.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/3-date/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `booking/4-time` — Booking — time

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/4-time/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/4-time/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `no-times` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/4-time/no-times.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/4-time/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/4-time/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/4-time/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `no-times` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/4-time/no-times.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/4-time/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `booking/5-review` — Booking — review

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/5-review/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/5-review/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | someone else took it while this donor decided | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/5-review/slot-taken.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `submitting` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/5-review/submitting.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/5-review/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/5-review/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | someone else took it while this donor decided | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/5-review/slot-taken.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `submitting` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/5-review/submitting.png) | 393x852 @2x | en | overridden | none measured | — | captured |

### `booking/6-confirmation` — Booking — confirmed

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/6-confirmation/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/6-confirmation/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/booking/6-confirmation/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/6-confirmation/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/6-confirmation/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/booking/6-confirmation/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `community/achievements` — Achievements

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/achievements/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/achievements/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/achievements/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/achievements/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/achievements/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/achievements/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/achievements/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/achievements/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `community/badges` — Badges

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/badges/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/badges/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/badges/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/badges/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/badges/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/badges/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/badges/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/badges/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `community/campaigns` — Campaigns

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/campaigns/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/campaigns/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/campaigns/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/campaigns/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/campaigns/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/campaigns/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/campaigns/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/campaigns/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `community/challenges` — Challenges

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/challenges/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/challenges/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/challenges/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/challenges/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/challenges/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/challenges/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/challenges/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/challenges/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `community/education` — Education

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `community/education-article` — Education — the article

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education-article/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education-article/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education-article/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education-article/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | the body the module has always carried and never showed | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/education-article/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education-article/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education-article/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education-article/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education-article/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | the body the module has always carried and never showed | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/education-article/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `community/gamification` — Recognition

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/gamification/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/gamification/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/gamification/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/gamification/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/gamification/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/gamification/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/gamification/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/gamification/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `community/leaderboard` — Leaderboard

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/leaderboard/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/leaderboard/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/leaderboard/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/community/leaderboard/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/leaderboard/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/leaderboard/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/leaderboard/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/community/leaderboard/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `courier/active` — Courier — active delivery

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/active/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/active/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/active/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/active/long-content.png) | 412x915 @2x | en | overridden | none measured | **2** | captured |
| `permission-location-explainer` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/active/permission-location-explainer.png) | 412x915 @2x | en | overridden | none measured | **2** | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/active/populated.png) | 412x915 @2x | en | overridden | none measured | **2** | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/active/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/active/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/active/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/active/long-content.png) | 393x852 @2x | en | overridden | none measured | **2** | captured |
| `permission-location-explainer` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/active/permission-location-explainer.png) | 393x852 @2x | en | overridden | none measured | **2** | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/active/populated.png) | 393x852 @2x | en | overridden | none measured | **2** | captured |

### `courier/history` — Courier — history

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/history/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/history/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/history/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/history/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/history/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/history/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/history/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/history/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `courier/profile` — Courier — profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/profile/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/profile/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/profile/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/courier/profile/sign-out-confirmation.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/profile/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/profile/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/profile/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/courier/profile/sign-out-confirmation.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |

### `health/insights` — AI insights

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ai-disabled` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/insights/ai-disabled.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/insights/error.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/insights/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/insights/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/insights/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `ai-disabled` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/insights/ai-disabled.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/insights/error.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/insights/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/insights/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/insights/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `health/laboratory` — Blood tests

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/laboratory/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/laboratory/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/laboratory/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/laboratory/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | one list failed; the other must not read as "you have none" | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/laboratory/partial-failure.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/laboratory/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/laboratory/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/laboratory/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/laboratory/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/laboratory/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | one list failed; the other must not read as "you have none" | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/laboratory/partial-failure.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/laboratory/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `health/trends` — Health trends

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/trends/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/trends/error.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/trends/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/trends/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/health/trends/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/trends/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/trends/error.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/trends/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/trends/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/health/trends/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `history/appointment-detail` — Appointment detail

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cancel-confirmation` | cancelling asks first | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/appointment-detail/cancel-confirmation.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/appointment-detail/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/appointment-detail/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/appointment-detail/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `cancel-confirmation` | cancelling asks first | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/appointment-detail/cancel-confirmation.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/appointment-detail/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/appointment-detail/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/appointment-detail/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `history/donation-detail` — Donation detail

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donation-detail/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donation-detail/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donation-detail/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donation-detail/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donation-detail/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donation-detail/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donation-detail/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donation-detail/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donation-detail/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donation-detail/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `history/donations` — Donation history

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donations/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donations/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `filtered-empty` | a filter with no matches is not the same as having none | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donations/filtered-empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donations/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donations/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/history/donations/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donations/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donations/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `filtered-empty` | a filter with no matches is not the same as having none | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donations/filtered-empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donations/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donations/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/history/donations/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/1-test-type` — Lab — test

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/1-test-type/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/1-test-type/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/1-test-type/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/1-test-type/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/1-test-type/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/1-test-type/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/1-test-type/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/1-test-type/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/2-laboratory` — Lab — laboratory

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/2-laboratory/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/2-laboratory/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/2-laboratory/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/2-laboratory/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/2-laboratory/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/2-laboratory/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/3-date` — Lab — date

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/3-date/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/3-date/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/3-date/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/3-date/no-open-dates.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/3-date/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/3-date/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/3-date/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/3-date/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/3-date/no-open-dates.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/3-date/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/4-slot` — Lab — slot

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/4-slot/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `no-times` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/4-slot/no-times.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/4-slot/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/4-slot/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `no-times` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/4-slot/no-times.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/4-slot/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/5-review` — Lab — review

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/5-review/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/5-review/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/5-review/slot-taken.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/5-review/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/5-review/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/5-review/slot-taken.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |

### `lab-booking/6-confirmation` — Lab — confirmed

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/6-confirmation/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/lab-booking/6-confirmation/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/6-confirmation/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/lab-booking/6-confirmation/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `onboarding/complete-profile` — Complete your profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/onboarding/complete-profile/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/onboarding/complete-profile/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | **1** | captured |
| `permission-location-explainer` | the explainer the app shows BEFORE the OS is asked | [png](../artifacts/mobile-v2-visual-qa/android-412x915/onboarding/complete-profile/permission-location-explainer.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `permission-notifications-explainer` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/onboarding/complete-profile/permission-notifications-explainer.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `step-1-blood-type` | first step as it opens | [png](../artifacts/mobile-v2-visual-qa/android-412x915/onboarding/complete-profile/step-1-blood-type.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `step-2-your-name` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/onboarding/complete-profile/step-2-your-name.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/onboarding/complete-profile/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/onboarding/complete-profile/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | **1** | captured |
| `permission-location-explainer` | the explainer the app shows BEFORE the OS is asked | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/onboarding/complete-profile/permission-location-explainer.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `permission-notifications-explainer` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/onboarding/complete-profile/permission-notifications-explainer.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `step-1-blood-type` | first step as it opens | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/onboarding/complete-profile/step-1-blood-type.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `step-2-your-name` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/onboarding/complete-profile/step-2-your-name.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |

### `sos/emergency` — Emergency SOS

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `accepted` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/accepted.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `arrived` | the last state a donor owns | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/arrived.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `en-route` | journey started; map shows positions and says so | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/en-route.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `light` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/light.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `list` | requests this donor can answer | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/list.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/locale-ru.png) | 412x915 @2x | ru | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/locale-uz.png) | 412x915 @2x | uz | overridden | none measured | — | captured |
| `network-failure` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/network-failure.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `viewing` | opened, not yet answered | [png](../artifacts/mobile-v2-visual-qa/android-412x915/sos/emergency/viewing.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `accepted` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/accepted.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `arrived` | the last state a donor owns | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/arrived.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `en-route` | journey started; map shows positions and says so | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/en-route.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `light` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/light.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `list` | requests this donor can answer | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/list.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/locale-ru.png) | 393x852 @2x | ru | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/locale-uz.png) | 393x852 @2x | uz | overridden | none measured | — | captured |
| `network-failure` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/network-failure.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `server-error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `viewing` | opened, not yet answered | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/sos/emergency/viewing.png) | 393x852 @2x | en | overridden | none measured | — | captured |

### `tabs/calendar` — Calendar

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/calendar/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/calendar/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/calendar/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek weekday and month names | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/calendar/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/calendar/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/calendar/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/calendar/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/calendar/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/calendar/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek weekday and month names | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/calendar/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/calendar/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/calendar/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `tabs/community` — Community

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/community/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/community/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/community/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/community/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/community/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/community/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/community/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/community/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/community/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/community/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/community/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/community/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `tabs/donate` — Donate

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/donate/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/donate/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/donate/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/donate/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/donate/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/donate/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/donate/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/donate/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/donate/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/donate/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/donate/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/donate/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/donate/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/donate/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `tabs/health` — Health

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ai-unavailable` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/health/ai-unavailable.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/health/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/health/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/health/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/health/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/health/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | results loaded, appointments did not | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/health/partial-failure.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/health/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `ai-unavailable` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/health/ai-unavailable.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `empty` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/health/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/health/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/health/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/health/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/health/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | results loaded, appointments did not | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/health/partial-failure.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/health/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `tabs/home` — Home

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `emergency-banner` | an active emergency matching this donor | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/emergency-banner.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `empty` | nothing scheduled, no emergencies, no campaigns | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | every section failed | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `light` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/light.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | whole page, to see it end to end | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `offline` | the data requests never reach the server | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/offline.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `populated` | seeded donor: verified blood type, history, next appointment | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/home/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `emergency-banner` | an active emergency matching this donor | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/emergency-banner.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `empty` | nothing scheduled, no emergencies, no campaigns | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | every section failed | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `light` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/light.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | whole page, to see it end to end | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `offline` | the data requests never reach the server | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/offline.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `populated` | seeded donor: verified blood type, history, next appointment | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/home/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |

### `tabs/profile` — Profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/profile/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/profile/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/profile/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/profile/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | the destructive action asks first | [png](../artifacts/mobile-v2-visual-qa/android-412x915/tabs/profile/sign-out-confirmation.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/profile/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/profile/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/profile/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/profile/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | the destructive action asks first | [png](../artifacts/mobile-v2-visual-qa/iphone-393x852/tabs/profile/sign-out-confirmation.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |

<!-- generated:inventory:end -->

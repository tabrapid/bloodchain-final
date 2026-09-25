# Mobile V2 — visual QA report

Sprint 11.1. This is the record of what the app **looked like when it was
running**, screen by screen and state by state, and what that turned up.

---

## 1. What was captured, and what that is worth

Every screen in the app was rendered and photographed: **480 screenshots**,
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

<!-- generated:inventory:start -->
<!-- generated:inventory:end -->

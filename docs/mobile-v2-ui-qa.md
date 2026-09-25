# Bloodchain Mobile V2 — UI/UX QA

Sprint 11, Track B. This is the visual and interaction record of the rebuild:
what was built, what each screen is expected to do in every state, what was
checked and how, and what could not be checked in this environment.

It is written to be read by someone holding the phone. Where a claim could not
be verified on hardware, it says so rather than implying it was.

---

## 1. What was rebuilt

Every screen in `apps/mobile/app/` is on the V2 design system. The pre-V2
component layer (`src/components/*`, 42 files) was deleted; three files remain
and the barrel says why (`AppBackground`, `BrandMark`, `map/LocationMap`).

| Area | Screens |
| --- | --- |
| Shell | `(app)/_layout`, `(courier)/_layout`, root `_layout` |
| Auth | welcome, login, register, register-details, phone, otp, forgot-password, reset-password, check-email, verify-email |
| Onboarding | complete-profile (6 steps) |
| Tab roots | home, health, donate, community, calendar, profile |
| Emergency | sos |
| Donation booking | select-type, organizations, date, time, review, confirmation |
| Laboratory booking | test-type, laboratory, date, slot, review, confirmation |
| Health & AI | laboratory hub, health-trends, insights |
| History & detail | donations list, donation detail, appointment detail |
| Community & recognition | community feed, campaigns, challenges, education, gamification hub, badges, achievements, leaderboard |
| Profile & account | profile, profile/edit, profile/donor, privacy, security, notifications, notification-settings |
| Courier | active, history, profile |

## 2. Design system

62 exports from `src/design`. Tokens: `space`, `radius`, `elevation`, `type`,
`icon`, `hitTarget`, `motion`, `layout`, `themes`, `palette`.

Components, by group:

- **Text** — `Text`, `ValueText`
- **Containers** — `Surface`, `Well`, `Screen`, `ScrollScreen`, `FormScreen`, `Stack`, `Row`
- **Actions** — `Button`, `IconButton`, `LinkButton`, `ButtonRow`
- **Status** — `Badge`, `StatusDot`, `Banner`, `EmergencyBanner`
- **States** — `Skeleton`, `SkeletonRow`, `EmptyState`, `ErrorState`, `SectionError`, `InlineError`, `LoadingOverlay`, `LoadingSection`
- **Input** — `Field`, `PasswordField`, `PhoneField`, `SearchField`, `OtpField`
- **Choice** — `Toggle`, `SegmentedControl`, `Choice`, `OptionGrid`, `FilterChip`
- **Lists** — `SectionHeader`, `ListRow`, `Divider`, `ListGroup`
- **Data** — `Sparkline`, `Stat`, `StatRow`, `Progress`, `Avatar`
- **Overlays** — `BottomSheet`, `ConfirmationSheet`, `PermissionExplainer`
- **Structure** — `MonthGrid`, `FlowStep`, `ScreenHeader`, `TabBar`

## 3. States every network screen supports

The rule: **loading, empty, failed and loaded are four different facts and the
screen says which one it is.** "No data" and "we could not reach the server"
are never the same card, and no screen shows a spinner with no way out.

| Screen | Loading | Empty | Failed | Partial failure |
| --- | --- | --- | --- | --- |
| Home | — (sections degrade individually) | quiet banner when no emergencies | per-section | yes |
| Health | skeleton | "no laboratory data yet" + book a test | full-screen with retry | per-section `SectionError` |
| Donate | skeleton | — | full-screen with retry | campaigns/donations sections separately |
| Community | skeleton rows | "nothing posted yet" | full-screen with retry | rank/impact hidden if absent |
| Calendar | skeleton | "nothing booked" + schedule | full-screen with retry | — |
| Profile | — | — | — | sections hidden when absent |
| Laboratory hub | skeleton | "no tests yet" + book | both lists failed | one list failed |
| Health trends | skeleton | "no trends yet" | with retry | series separate from parameter list |
| Insights | skeleton cards | "no insights yet" | banner | AI-off state distinct from failure |
| Donations list | skeleton rows | empty vs filtered-empty, different actions | with retry | — |
| Booking (5 steps) | skeleton / labelled loader | "no open dates", "no times" | with retry | slot-taken is distinct from failure |
| Notifications | skeleton rows | "all caught up" vs "nothing yet" | with retry | — |
| Courier active | skeleton | "no active delivery" | with retry | tracking poll fails silently, screen still works |

## 4. Permission journeys

No operating-system permission prompt is reached without an explanation first.
Each explainer states what is collected, who sees it, and what the app will not
do; "Not now" is the same size as "Allow".

| Where | Explains | Refusal state |
| --- | --- | --- |
| Onboarding — location | sorting centres and requests by distance; not tracking | banner, Settings link when blocked |
| Onboarding — notifications | emergency requests nobody sees in time are worth nothing | banner; categories still saved |
| Booking — nearby filter | sorting this list only | inline reason; filter stays off |
| SOS — en route | only while responding; hospital only; stops on cancel | banner + Settings; journey continues |
| Courier — in transit | only while a delivery is in transit; hospital and blood centre | banner; delivery still completes |
| Notification settings | same wording as onboarding | Settings link when blocked |

`registerForPushNotificationsAsync` never requests. It registers a device that
has already granted and returns silently otherwise.

## 5. What the interface refuses to claim

- **No route, ever.** `LocationMap` has no `showRoute` prop. Nothing in this
  system computes a route, and a straight line between two points is not one.
  Both map screens caption what the map is showing.
- **No ETA on the donor side.** The SOS map shows positions and says so.
- **No donor self-completion.** The donor's journey ends at ARRIVED; staff own
  what follows.
- **No AI result without its disclaimer.** Every surface that renders an
  AI-written sentence carries `medical.aiSafety.disclaimer` beside it, and the
  chat answer carries `medical.advice.notMedicalAdvice` as well.
- **No range claim without a range.** Health states "within healthy range" only
  when the laboratory gave a flag or a reference range.
- **No privacy action that does not exist.** Data export and account deletion
  are visibly disabled with what to do instead; four of the reference's five
  privacy toggles have no field behind them and remain absent.
- **No invented confidence.** Insights show the server's `safetyLevel`, never a
  percentage.

## 6. Accessibility

Checked by contract tests in `src/design/design-system.spec.tsx` (29),
`src/design/tokens.spec.ts` (46) and `src/design/tab-bar.spec.tsx` (9).

- **Contrast.** Every text token computed against every surface it can sit on:
  4.5:1 for body text, 3:1 for non-text indicators. Accent `.text` values are
  separate from `.base` so a label can never be drawn in the indicator colour.
  Rose and critical hues are held ≥15° apart so "brand" and "emergency" cannot
  be confused.
- **Targets.** Buttons, list rows, tabs, option cells and the reveal toggle are
  all ≥44pt; comfortable targets are 52pt.
- **Roles.** Tabs are `tab` in a bar, options are `radio` in a `radiogroup`,
  toggles are `switch`, progress is `progressbar` with a real value, banners
  are `alert`.
- **Status is never colour alone.** Every badge carries words.
- **Icons always carry labels.** `IconButton.accessibilityLabel` is required by
  the type; `ScreenHeader.backLabel`, `BottomSheet.closeLabel` and
  `ErrorState.retryLabel` lost their English defaults and became required.
- **Charts are described.** The trend chart and the sparkline announce the
  series in words; the drawing itself is not read out.
- **Text scaling.** `maxFontSizeMultiplier={3}` on every `Text`.

## 7. Localization

uz, ru, en. Enforced by `packages/i18n/src/coverage.spec.ts` (31 tests, in a
package suite of 79):

- every literal `t('...')` key in every app resolves;
- every templated `t(\`ns.${value}\`)` prefix exists;
- no hardcoded user-facing English in quoted strings or JSX text, in any app;
- **new in S11**: no hardcoded English inside a template literal in the donor
  app — the shape every string this sprint fixed actually had;
- every clinical term carries all three languages and a review status.

Screens are also mounted in all three languages and read back:
`tab-roots-i18n.spec.tsx` (six tab roots), `secondary-screens-i18n.spec.tsx`,
`onboarding-courier-i18n.spec.tsx`, `detail-screens-enums.spec.tsx` (which also
asserts no database enum survives to the glass).

## 8. Motion

`motion.instant` 120ms (press), `motion.quick` 200ms (progress), `motion.gentle`
280ms (sheets). Press feedback is a 3% scale and a colour change. Nothing
bounces, nothing springs, nothing loops except the loading skeleton, which
pulses opacity rather than sweeping a gradient.

## 9. Responsive

- Layout is flex and percentage throughout; there is no fixed pixel width in
  production code.
- Content stops growing at `layout.maxContentWidth` (560) and centres, so a
  tablet or an unfolded foldable gets a readable column rather than a stretched
  phone layout. Asserted in the design-system spec at 834pt wide.
- The floating tab bar reports its own height; every scrolling screen pads by
  that height, so the last row always clears it.
- Keyboard: `FormScreen` lifts content on both platforms, and
  `keyboardShouldPersistTaps="handled"` means the first tap after typing hits
  the button rather than only dismissing the keyboard.

## 10. Performance

- Long lists are `FlatList` (donations, notifications, campaigns, challenges,
  education, community feed). Bounded lists (≤50 rows) render directly.
- `useDesign()` is memoized on the scheme, so the token object is stable across
  renders.
- Animations use the native driver except the progress bar's width, which
  cannot and moves once per data change.
- Blur is spent in exactly one place, the tab bar: a single surface over
  scrolling content. Cards are opaque.
- Jest runs in band with no leaked handles and no `--forceExit`.

## 11. What was NOT verified

**PHYSICAL_DEVICE_NOT_VERIFIED.** No physical Android or iOS device was
available in this environment, and no emulator either. Nothing in this document
claims a hardware observation.

Specifically unverified:

- real rendering, spacing and contrast on a physical screen;
- VoiceOver and TalkBack announcement order;
- the operating-system permission dialogs themselves;
- map rendering (`react-native-maps` needs a dev client or an EAS build);
- push delivery;
- gesture and scroll performance.

Everything above is verified by automated test, by computation (contrast), or
by reading the rendered tree — never by looking at a screen.

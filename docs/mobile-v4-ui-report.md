# Mobile V4 — complete UI/UX ownership report

Branch `claude/local-test-ready`. Starting point `cb963889`. Final commit: see
`git log -1` on the branch (recorded in section 2 below).

This document is the report the brief asked for, in the brief's order. Where a
number comes from a tool, the tool and the command are named so it can be
re-run. Where something could not be done in this environment, it says so and
says what it would take.

---

## 1. Starting commit

`cb963889` — "S11.2 C: the chart that overshot, and the axis that lied". The
branch was taken from there and `main` was not touched.

## 2. Final commit and the commits in between

| Commit | Stage |
| --- | --- |
| `b391b19b` | Foundation: navy-plum material, two typefaces, re-measured palette (`tokens.ts`, `fonts.ts`) |
| `db9fe81b` | Design system: every component rebuilt on the new material |
| `db24019c` | Shell and the six root tabs (tab bar, headers, root layout, Home/Health/Donate/Community/Calendar/Profile) |
| `80e21b3c` | Auth and onboarding |
| `a099d553` | Booking, lab booking, appointments and the emergency (SOS) screen |
| `e50d3319` | Health (laboratory, trends, insights), community, recognition, account and courier screens |
| `b4f4ce49` | Visual corrections from the first full screenshot review |
| `34625ce9` | Second pass: Uzbek dates without ICU data, tab labels that fit, dead theme code removed |
| `5cc42406` | API test pinning the per-parameter reference-range lookup |
| `76c9d338`, `ca537e40`, `3b414081`, `12e5ae8f` | Tab labels sized from the measured bar so a long word fits at 360pt; short Uzbek month without comma |
| `6996dac4` | Statistic tiles draw a dash, never "undefined"; harness answers statistics routes with zeros |
| _final_ | Final capture artifacts and this report (the last commit on the branch) |

The stages are coherent on their own: each one typechecks, lints and passes
the suite at that commit.

## 3. Files changed

`git diff --stat cb963889..HEAD` before the artifact commit: 97 files
(86 of them under `apps/mobile`), plus this report. The final commit adds the
735 screenshot files and the manifest under `artifacts/mobile-v4-visual-qa`.
Outside the mobile app: the i18n formatter and its tests (`packages/i18n`),
and two service files and a test in the API where a reference-range lookup
returned the wrong parameter's range (section 11).

Of the 54 screen files under `apps/mobile/app`, 44 were rewritten or edited;
the remaining 10 are layouts and thin index redirects whose content is entirely
provided by the design system and therefore changed appearance without a diff.

## 4. The design system

`apps/mobile/src/design/` — `tokens.ts`, `fonts.ts`, `useDesign.ts`, and 18
component files exporting 63 components. Nothing outside this directory writes
a hex code, a font weight or a magic size; the guard tests in section 20
enforce it.

**Material.** The page is a deep navy-plum (`ink.950 #0A0C16`), not a black.
Surfaces are lighter tones of the same hue and are never outlined: a border is
reserved for controls that take input (fields, outline buttons). Depth comes
from tone and from a hairline of light (`highlight`, 5.5% white) along the top
edge of a raised surface. There are no drop shadows on the dark theme.

**Components** (all in `src/design/components`):

| File | Components |
| --- | --- |
| `Text` | `Text`, `ValueText` (tabular figures) |
| `Surface` | `Surface` (flat / raised / hero), `Well`, `IconTile` |
| `Button` | `Button` (primary, secondary, ghost, critical, outline; sm/md/lg), `LinkButton`, `IconButton`, `ButtonRow` |
| `List` | `SectionHeader`, `ListRow`, `Divider`, `ListGroup`, `KeyValueRow`, `DateBlock` |
| `Status` | `Badge`, `StatusDot`, `Banner`, `EmergencyBanner`, `Timeline` |
| `Stat` | `Stat`, `StatRow`, `Progress`, `Avatar` |
| `Feedback` | `Skeleton`, `SkeletonRow`, `SkeletonCard`, `EmptyState`, `ErrorState`, `SectionError`, `InlineError`, `LoadingOverlay`, `LoadingSection` |
| `Field` | `Field`, `PasswordField`, `PhoneField`, `SearchField` |
| `Controls` | `Toggle`, `SegmentedControl`, `Choice`, `OptionGrid`, `FilterChip` |
| `Sheet` | `BottomSheet`, `ConfirmationSheet`, `PermissionExplainer` |
| `MonthGrid` | `MonthGrid` |
| `Flow` | `StepIndicator`, `FlowStep` |
| `OtpField` | `OtpField` |
| `Chrome` | `ScreenHeader` (inline / large, eyebrow, subtitle), `ScreenTitle`, `TabBar` |
| `Screen` | `Screen`, `ScrollScreen`, `FormScreen`, `Stack`, `Row`, `useTabBarClearance` |
| `Record` | `RecordRow`, `ValueBlock` |
| `Chart` | `ChartFrame` |
| `Section` | `Section` |

## 5. Typography

Two families, six faces, loaded by name through `expo-font`; `fontWeight`
never appears in the scale (Android synthesises a weight on top of a face that
already has one, which is the smeared text that reads as amateur).

| Role | Face |
| --- | --- |
| Body, hints, captions | Inter 400 |
| Labels, row values, tab labels | Inter 500 |
| Emphasis, row titles, button labels | Inter 600 |
| Section titles (h3) | Manrope 600 |
| Screen titles, sheet titles, clinical values | Manrope 700 |
| Display and the blood-type hero | Manrope 800 |

Scale (`type` in `tokens.ts`): display 40/46 · h1 28/34 · h2 22/28 · h3 18/24 ·
title 16/22 · body 15/22 (regular, medium, strong) · label 13/18 · caption 12/16
· overline 11/14 (uppercase applied by the component) · value 30/36 · valueSm
20/26 · hero 56/60. Negative tracking on the display faces only.
`includeFontPadding: false` everywhere so Android and iOS agree on line boxes.

## 6. Colour

| Token | Dark | Used for |
| --- | --- | --- |
| `ink.950` | `#0A0C16` | page |
| `ink.900` | `#141829` | flat surface |
| `ink.850` | `#1C2137` | raised surface |
| `ink.800` | `#20253E` | pressed / inset |
| `rose` | base `#E44E6B` · text `#FF8DA4` · fill `#D13A58` | brand, primary action, the donor's own things |
| `clinical` | base `#4F9EFF` · text `#95C5FF` · fill `#2470D0` | factual information: appointments, laboratory, links |
| `insight` | base `#A393FF` · text `#C6BBFF` · fill `#7263D6` | AI only; never drawn on a screen without a model output |
| `success` / `warning` / `critical` | `#3DCB8F` / `#F2B443` / `#FF5644` (+ text and fill) | a status and nothing else |

One gradient in the system (`heroGradient`, plum to navy) and it is drawn on
the identity hero and the Welcome band only. Glass and blur do not appear.
A light palette exists with the same structure (`paper`), used when the donor
picks it; every pair is re-measured for WCAG AA by `tokens.spec.ts`.

The palette-discipline test fails the build if violet appears on a non-AI
screen or if a screen stacks more than four non-flat surfaces.

## 7. Spacing, radius, targets, motion

`space`: 4 · 8 · 12 · 16 · 24 · 32 · 48. Gutter 20. `radius`: 8 · 12 · 16 ·
20 · 28 · full. Touch targets: 44 minimum, 52 for primary buttons and rows.
Motion: 120 / 200 / 280 ms, press scale 0.975, no springs, no bounce.
Tab-bar clearance 84 under any scroller outside the tab navigator.

## 8. Navigation

Unchanged in structure, redesigned in chrome. Six donor tabs exactly (Home,
Health, Donate, Community, Calendar, Profile) and three courier tabs (Active,
History, Profile). The tab bar is now full width and opaque with a hairline
above and the safe area below, a tinted pill behind the active icon, and
labels that wrap to two lines before they ellipsise (Russian "Сообщество" and
Uzbek "Bosh sahifa" both needed it at 360pt). Pushed screens use an inline
18pt header or a large 28pt title with an eyebrow or a subtitle; the emergency
screen keeps its full-screen presentation.

## 9. Screens redesigned

All of them. Auth (welcome, login, register, register details, phone, OTP,
forgot/reset password, check email, verify email), onboarding (complete
profile, permission explainers), the six tabs, booking (5 steps + confirmation)
and lab booking (5 steps + confirmation), appointment detail, SOS (list,
viewing, accepted → en route → arrived, empty, offline, error), donation history
and detail, notifications, laboratory, health trends, AI insights, campaigns,
challenges, education hub and article, recognition, badges, achievements,
leaderboard, profile, donor profile, personal info, privacy, security,
notification settings, and the courier workspace (active, history, profile).

Preserved, deliberately: every product rule in the brief. The donor cannot
mark a donation complete, cannot create an emergency, progresses only through
ACCEPTED → EN_ROUTE → ARRIVED, gets no invented ETA or routing, shares location
only during an active journey, and manages no inventory. AI screens carry the
informational-only banner and render the deployment's "switched off" state
honestly. Data export and account deletion show honest unavailable states.
Clinical thresholds and intervals come from the API and are never computed
in the app.

## 10. Defects found by visual QA and fixed

From the first full browser capture (245 states, iPhone frame), reviewed shot
by shot:

- Welcome: hard horizontal edge on the hero gradient → vertical band.
- Every input on web drew the browser's yellow focus ring → suppressed in the
  field and in the harness.
- "Back to sign in" link in rose read as a destructive action → clinical.
- Permission explainer drew a stray icon tile between the text and the
  assurances → removed.
- Home showed zeros when the statistics request failed → `SectionError`.
- Health headline showed another parameter's reference range → headline uses
  its own parameter's range.
- Tab labels truncated ("Сообщес…", "Bosh sah…") → two lines.
- Organisation names truncated in rows, review steps and confirmations
  ("Arnasoy District Hos…", "Northstar Blood Cent…") → `ListRow` title and
  value wrap to two lines.
- Laboratory result rows fought over width with "5 parameters tested" → count
  moved into the subtitle.
- Sentence-style eyebrows set in caps on one clipped line ("JOIN CAMPAIGNS TO
  HELP SAVE LIVES IN YOUR COMM…") → large headers gain a `subtitle` slot and
  twelve screens use it.
- Trend direction arrow in amber, leaderboard trophy in amber, achievement
  notification tile in amber → neutral / rose; amber is for attention only.
- Chart axis labels in the platform serif → app typeface.
- SOS empty state rendered above the donor's own response → own responses
  first, compact empty state.
- Profile edit dropped a phone number that did not normalise and reported
  success → validated at the field before saving.
- Privacy "download your data" row carried a map-pin icon → download and
  remove-user icons.
- Security session row truncated the device name beside the "This device"
  badge → wraps.
- Hard-coded "Donor" fallback in two screens → `t('table.donor')`.
- Health trends printed "Reference range: 150 000 – 450 000 %" under a
  haematocrit of 42 → API fix, section 11.
- Uzbek calendar titles rendered as "2026 M09" with English weekday initials
  where the runtime has no Uzbek ICU data → CLDR fallback in the i18n package.
  The second capture showed the day heading and medium dates still doing it
  ("2026 M09 29, Tue"), so every Uzbek formatter now probes the runtime once
  and composes from the tables when it has no names.
- "Сообщество" split mid-word in the Russian tab bar at 393pt even with two
  lines allowed → the bar drops to 10pt (the iOS tab-label size) whenever one
  label is a single word of nine letters or more. The 360pt frame then
  showed "Сообщество" and even the English "Community" still breaking (a
  sixth of that bar is 58pt), and two rounds of flexbox margins did nothing:
  a centred text is shrink-to-fit, and react-native-web caps a multi-line
  text at 100% of its parent. The bar now measures itself and sizes each
  label as a number: a single word gets its item plus 5pt a side, a label
  with a space gets its item minus 4pt so it wraps at the space instead of
  running into a neighbour that also spills. Verified against the real Inter
  faces measured in Chromium (Сообщество at 10pt semibold is 62.7pt).
- The Uzbek short-month fallback carried CLDR's comma into the date block
  ("SEN,") → dropped for the short form.
- The empty states of donation history and the education hub printed
  "undefined" and "NaN" in their statistics tiles when a stub answered the
  statistics route with the wrong shape → every figure passes through a
  `count()` that draws a dash for anything that is not a number, and the
  harness answers those routes with zeros.
- The first full manifest flagged 270 captures for content past the right
  edge: every screen with a tab bar, because the outermost label's box ran
  one point past the screen. The spill now equals the bar's own padding and
  the box ends at the edge; those screens were recaptured and the measure
  reads zero.
- The trends screen kept showing the platelet range after the API fix
  because the API process serving the harness had been built before it; the
  final capture runs against the rebuilt API.

## 11. A defect outside the UI

`HealthTrendsService.getReferenceRangeForParameter` and the AI context builder
looked a reference range up by test type only, so a Complete Blood Count
handed haematocrit whichever of its five ranges was created last (the platelet
range). Both now match the parameter first and fall back to the test type's
own range, mirroring what `LaboratoryService` already did. The response
contract is unchanged; the API suite for the three modules passes (90 tests).
This is a clinical-data correctness bug that the UI made visible, and it is
worth a look from whoever owns the API.

## 12. Screenshots and the artifact path

`artifacts/mobile-v4-visual-qa/<device>/<screen>/<state>.png`, with
`screenshots.json` beside it. The capture runs the real screens through
react-native-web against the real seeded API (Postgres + `prisma migrate` +
`prisma:seed` + `apps/api` on :3001), with per-state route overrides for
error, loading, offline and fixture states. Three frames: iPhone 393×852,
Android 412×915, small 360×640. The inventory tables at the end of this
document are generated from the manifest by `node qa/visual/report.mjs`.

How to reproduce: `apps/mobile/qa/visual/README.md`.

**Final capture (this commit):** 735 screenshots, 53 screens, 3 frames, 3
locales. 0 captures failed. 0 captures measured content past the right edge.
189 captures logged a console error, all of them expected for the state
being photographed: 126 are the HTTP 500 the harness returns for the error
states, 45 are react-native-web's "BackHandler is not supported on web"
notice (the sheet's hardware-back handler, native-only), and the rest are
the 400/404/409 and connection-refused responses that the validation,
slot-taken and offline states are made of.

Read the `small-360x640` frame for Russian and Uzbek: every tab label sits
on one line, every header uses its subtitle slot, and no screen shrinks its
text below the scale.

## 13. Native Android build

**Not run in this environment.** The Android SDK is not installed and the
environment's network policy denies `dl.google.com`, which is where
`sdkmanager` fetches platform tools and build tools from (the request is cut
off by the proxy; `cdp.expo.dev` is denied too, so an EAS build cannot be
started either). Widening network access in the environment settings to
include those hosts, or a runner with an Android SDK, is what it takes.

What was run instead: a production Hermes bundle for Android
(`NODE_ENV=production expo export --platform android`), which compiles the
whole app through Metro with production transforms and Hermes bytecode:

```
› android bundles (1):
_expo/static/js/android/entry-….hbc (7.6MB)
Exported: .expo-export-check
```

It exits 0. That proves the JavaScript side of a release build; it does not
prove native rendering, and the native capture (`qa/native`, Maestro) remains
the outstanding evidence.

## 14. Accessibility QA

- 186 `accessibilityLabel` and 81 `accessibilityRole` props across the app;
  every icon-only control has a label, every heading is a `header`.
- Touch targets: 44pt minimum enforced by `hitTarget.min` in every control;
  primary buttons and rows 52pt.
- Status never by colour alone: `Badge` carries a dot and a word, the trend
  direction is a word next to its arrow, the calendar marks available days
  with a dot and a legend, tabs mark active with a pill *and* a heavier face.
- `maxFontSizeMultiplier` on fields and tab labels rather than a hard cap;
  body text scales freely.
- Contrast: every text/background pair in both palettes recomputed by
  `tokens.spec.ts` against WCAG AA (4.5:1 body, 3:1 large).
- Not verifiable here: screen-reader focus order and Dynamic Type on a device.

## 15. Localization QA

uz, ru and en catalogues in `packages/i18n`; every `t()` key used by the app
is checked to exist in all three by `coverage.spec.ts` (i18n package) and the
mobile i18n coverage test. 1 270 `t()` calls under `apps/mobile/app`; the
remaining literal strings are brand names, testIDs and comments. Russian is
the long-length case and was captured on the small frame for every screen
that has a locale state: tab labels wrap to two lines rather than shrinking,
headers use the subtitle slot, and no screen shrinks text below its scale.
Uzbek month and weekday names now have a data fallback for runtimes without
Uzbek ICU data.

## 16. Performance findings

- Fonts load once through `useFonts` at the root; the splash holds until
  they resolve.
- No blur views, no per-frame animation; the only animated values are the
  sheet slide and the press scale, both on the native driver.
- Lists under 20 items render in `ScrollView`; longer ones (notifications,
  donations, history) are `FlatList` with stable keys.
- `Skeleton` states pulse opacity on the native driver (one loop per
  placeholder, no shimmer gradient, no JS-thread animation).
- Release bundle: 7.6 MB Hermes bytecode for Android (section 13).

## 17. Tests

At the final commit, from the repository root:

| Suite | Command | Result |
| --- | --- | --- |
| Mobile typecheck | `pnpm --filter @bloodchain/mobile typecheck` | clean |
| Mobile lint | `pnpm --filter @bloodchain/mobile lint` | 0 errors (15 pre-existing `no-explicit-any` warnings) |
| Mobile tests | `pnpm --filter @bloodchain/mobile test` | 44 suites, 633 tests pass |
| i18n tests | `pnpm --filter @bloodchain/i18n test` | 81 tests pass |
| API (touched modules) | `npx jest src/modules/health-trends src/modules/ai-health src/modules/laboratory` in `apps/api` | 7 suites, 90 tests pass |
| API typecheck | `npx tsc --noEmit` in `apps/api` | clean |
| Web export | `BLOODCHAIN_VISUAL_QA=1 expo export --platform web` | exits 0 |
| Android production export | `NODE_ENV=production expo export --platform android` | exits 0 |

Guard tests that pin the design system: `tokens.spec.ts` (contrast),
`typography.spec.tsx` (no numeric weights, faces by name),
`palette-discipline.spec.ts` (violet on AI screens only, ≤4 stacked
surfaces), `tab-bar.spec.tsx`, `design-system.spec.tsx`, `tab-routes.spec.ts`.

## 18. CI

CI was not run from this session (no pull request was opened, per the brief).
The commands CI runs were run locally and are listed above.

## 19. Remaining weaknesses

- **No native screenshots.** Everything visual here is react-native-web in
  Chromium. Line breaks, font hinting, the blur-free tab bar and safe areas
  are approximations. `qa/native` is ready to run on a machine with an SDK.
- Charts still come from `react-native-chart-kit`; the axis and label
  typography are configured, but the library owns the drawing.
- The courier profile shows a seeded US number after the +998 prefix; the
  seed, not the screen, but it is what a reviewer will see.
- Seed data contains duplicate badge names ("First Drop" twice), visible on the
  recognition screen.
- The `long-content` captures equal the viewport on react-native-web (the
  scroller is the window), so they do not show the full page.
- Uzbek plural and date rules beyond months and weekdays still rely on the
  runtime's ICU.
- AI insights could only be captured in the "switched off" state; the
  deployment has no model configured.
- Some strings arrive from the API in English whatever the locale: donor
  level names ("Regular Donor → Community Donor"), parameter names
  ("Hematocrit"), organisation names, and campaign or notification copy.
  They show as English inside otherwise Russian and Uzbek screens. That is
  API-side content, listed in `docs/backlog-api-localization.md`.

## 20. Store blockers

Not introduced by this work, still true:

- Privacy policy and terms of service are "not yet published"; both stores
  require a live privacy policy URL.
- Account deletion is not available; Apple requires in-app deletion for apps
  with account creation. The screen says so honestly rather than pretending.
- A native build has not been produced from this branch (section 13).
- App icons, splash and store listing assets were out of scope.

## 21. Verdict

On the evidence available (three frames, three locales, every screen and
state in the catalogue), the interface now meets a production visual bar for a
calm, clinical product: one material, one type system, one colour discipline,
no template idioms, and every screen's error, empty, loading and long-text
states drawn on purpose. The claim stops at the browser: the native capture is
the last piece of evidence and it has to be produced on a machine that can
build the app.

---

## Inventory

<!-- generated:inventory:start -->

**735 screenshots**, 53 screens, 3 device sizes (android-412x915, iphone-393x852, small-360x640), 3 locales (en, ru, uz). 0 captures failed. 0 captures measured content past the right edge. 189 captures logged a console error.

Every link below is relative to `docs/`, so it opens from this file.

### `account/notification-settings` — Notification settings

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notification-settings/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notification-settings/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notification-settings/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notification-settings/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `permission-explainer` | explained before the OS is asked | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notification-settings/permission-explainer.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notification-settings/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notification-settings/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notification-settings/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notification-settings/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `permission-explainer` | explained before the OS is asked | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notification-settings/permission-explainer.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notification-settings/default.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notification-settings/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notification-settings/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notification-settings/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `permission-explainer` | explained before the OS is asked | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notification-settings/permission-explainer.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |

### `account/notifications` — Notifications

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notifications/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notifications/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notifications/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notifications/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/notifications/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notifications/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notifications/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notifications/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notifications/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/notifications/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notifications/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notifications/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notifications/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notifications/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/notifications/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `account/privacy` — Privacy

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | what the backend can actually do, and what it cannot | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/privacy/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `delete-account` | the deletion route as it stands today | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/privacy/delete-account.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/privacy/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/privacy/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `default` | what the backend can actually do, and what it cannot | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/privacy/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `delete-account` | the deletion route as it stands today | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/privacy/delete-account.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/privacy/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/privacy/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `default` | what the backend can actually do, and what it cannot | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/privacy/default.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `delete-account` | the deletion route as it stands today | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/privacy/delete-account.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/privacy/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/privacy/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `account/profile-donor` — Donor profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/profile-donor/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/profile-donor/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/profile-donor/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/profile-donor/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/profile-donor/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/profile-donor/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/profile-donor/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/profile-donor/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/profile-donor/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/profile-donor/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/profile-donor/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/profile-donor/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `account/profile-edit` — Edit profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/profile-edit/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/profile-edit/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/profile-edit/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/profile-edit/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/profile-edit/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/profile-edit/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/profile-edit/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/profile-edit/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/profile-edit/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/profile-edit/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/profile-edit/server-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/profile-edit/validation-errors.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `account/security` — Security

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `change-password` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/security/change-password.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/security/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/security/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `sessions-error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/security/sessions-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/account/security/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `change-password` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/security/change-password.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/security/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/security/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `sessions-error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/security/sessions-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/account/security/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `change-password` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/security/change-password.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/security/default.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/security/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `sessions-error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/security/sessions-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/account/security/validation-errors.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `auth/check-email` — Check your email

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/check-email/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/check-email/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/check-email/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/check-email/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/check-email/default.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/check-email/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |

### `auth/forgot-password` — Forgot password

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/forgot-password/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/forgot-password/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/forgot-password/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/forgot-password/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/forgot-password/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/forgot-password/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/forgot-password/empty.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/forgot-password/server-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/forgot-password/validation-errors.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `auth/login` — Sign in

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `email-mode` | switched from phone to email | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/login/email-mode.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | nothing entered yet | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/login/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | request in flight, button in its pending state | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/login/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | Russian labels and helper text | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/login/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek labels and helper text | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/login/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `server-error` | the API answered 500 | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/login/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | submitted empty, so every rule fires at once | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/login/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `email-mode` | switched from phone to email | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/login/email-mode.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | nothing entered yet | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/login/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | request in flight, button in its pending state | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/login/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | Russian labels and helper text | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/login/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek labels and helper text | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/login/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `server-error` | the API answered 500 | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/login/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | submitted empty, so every rule fires at once | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/login/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `email-mode` | switched from phone to email | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/login/email-mode.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `empty` | nothing entered yet | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/login/empty.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `loading` | request in flight, button in its pending state | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/login/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | Russian labels and helper text | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/login/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek labels and helper text | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/login/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | — | captured |
| `server-error` | the API answered 500 | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/login/server-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | submitted empty, so every rule fires at once | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/login/validation-errors.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `auth/otp` — One-time code

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | code not entered | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/otp/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `entered` | six digits in | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/otp/entered.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `server-error` | wrong or expired code | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/otp/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `empty` | code not entered | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/otp/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `entered` | six digits in | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/otp/entered.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `server-error` | wrong or expired code | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/otp/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `empty` | code not entered | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/otp/empty.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `entered` | six digits in | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/otp/entered.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |
| `server-error` | wrong or expired code | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/otp/server-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |

### `auth/phone` — Phone sign-in

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/phone/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/phone/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/phone/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/phone/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/phone/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/phone/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/phone/empty.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/phone/server-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/phone/validation-errors.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `auth/register` — Create account

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/register/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/register/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `validation-errors` | submitted empty | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/register/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/register/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/register/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `validation-errors` | submitted empty | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/register/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/register/empty.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/register/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `validation-errors` | submitted empty | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/register/validation-errors.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `auth/register-details` — Your details

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/register-details/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/register-details/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/register-details/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/register-details/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/register-details/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/register-details/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/register-details/empty.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/register-details/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/register-details/validation-errors.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `auth/reset-password` — Reset password

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/reset-password/empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/reset-password/validation-errors.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/reset-password/empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/reset-password/validation-errors.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/reset-password/empty.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `validation-errors` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/reset-password/validation-errors.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `auth/verify-email` — Verify email

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `loading` | while the token is being checked | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/verify-email/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `server-error` | expired link | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/verify-email/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | while the token is being checked | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/verify-email/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `server-error` | expired link | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/verify-email/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | while the token is being checked | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/verify-email/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `server-error` | expired link | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/verify-email/server-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |

### `auth/welcome` — Welcome

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | first screen a new donor sees | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/welcome/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `light` | light appearance | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/welcome/light.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | Russian copy at the same widths | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/welcome/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek copy at the same widths | [png](../artifacts/mobile-v4-visual-qa/android-412x915/auth/welcome/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `default` | first screen a new donor sees | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/welcome/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `light` | light appearance | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/welcome/light.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | Russian copy at the same widths | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/welcome/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek copy at the same widths | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/auth/welcome/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `default` | first screen a new donor sees | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/welcome/default.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `light` | light appearance | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/welcome/light.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | Russian copy at the same widths | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/welcome/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek copy at the same widths | [png](../artifacts/mobile-v4-visual-qa/small-360x640/auth/welcome/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | — | captured |

### `booking/1-select-type` — Booking — type

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/1-select-type/default.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/1-select-type/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `selected` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/1-select-type/selected.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/1-select-type/default.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/1-select-type/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `selected` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/1-select-type/selected.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `default` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/1-select-type/default.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/1-select-type/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `selected` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/1-select-type/selected.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `booking/2-organizations` — Booking — centre

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/2-organizations/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/2-organizations/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `filters-open` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/2-organizations/filters-open.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/2-organizations/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/2-organizations/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `permission-location-explainer` | nearby asks before the OS does | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/2-organizations/permission-location-explainer.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/2-organizations/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/2-organizations/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/2-organizations/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `filters-open` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/2-organizations/filters-open.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/2-organizations/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/2-organizations/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `permission-location-explainer` | nearby asks before the OS does | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/2-organizations/permission-location-explainer.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/2-organizations/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/2-organizations/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/2-organizations/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `filters-open` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/2-organizations/filters-open.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/2-organizations/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/2-organizations/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `permission-location-explainer` | nearby asks before the OS does | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/2-organizations/permission-location-explainer.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/2-organizations/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `booking/3-date` — Booking — date

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/3-date/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/3-date/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/3-date/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/3-date/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | the month has nothing open | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/3-date/no-open-dates.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/3-date/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/3-date/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/3-date/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/3-date/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/3-date/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | the month has nothing open | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/3-date/no-open-dates.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/3-date/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/3-date/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/3-date/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/3-date/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/3-date/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | the month has nothing open | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/3-date/no-open-dates.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/3-date/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `booking/4-time` — Booking — time

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/4-time/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/4-time/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `no-times` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/4-time/no-times.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/4-time/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/4-time/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/4-time/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `no-times` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/4-time/no-times.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/4-time/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/4-time/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/4-time/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `no-times` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/4-time/no-times.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/4-time/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `booking/5-review` — Booking — review

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/5-review/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/5-review/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | someone else took it while this donor decided | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/5-review/slot-taken.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `submitting` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/5-review/submitting.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/5-review/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/5-review/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | someone else took it while this donor decided | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/5-review/slot-taken.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `submitting` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/5-review/submitting.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/5-review/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/5-review/server-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | someone else took it while this donor decided | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/5-review/slot-taken.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `submitting` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/5-review/submitting.png) | 360x640 @2x | en | overridden | none measured | — | captured |

### `booking/6-confirmation` — Booking — confirmed

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/6-confirmation/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/6-confirmation/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/booking/6-confirmation/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/6-confirmation/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/6-confirmation/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/booking/6-confirmation/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/6-confirmation/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/6-confirmation/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/booking/6-confirmation/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `community/achievements` — Achievements

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/achievements/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/achievements/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/achievements/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/achievements/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/achievements/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/achievements/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/achievements/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/achievements/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/achievements/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/achievements/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/achievements/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/achievements/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `community/badges` — Badges

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/badges/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/badges/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/badges/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/badges/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/badges/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/badges/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/badges/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/badges/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/badges/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/badges/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/badges/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/badges/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `community/campaigns` — Campaigns

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/campaigns/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/campaigns/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/campaigns/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/campaigns/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/campaigns/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/campaigns/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/campaigns/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/campaigns/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/campaigns/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/campaigns/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/campaigns/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/campaigns/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `community/challenges` — Challenges

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/challenges/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/challenges/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/challenges/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/challenges/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/challenges/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/challenges/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/challenges/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/challenges/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/challenges/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/challenges/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/challenges/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/challenges/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `community/education` — Education

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `community/education-article` — Education — the article

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education-article/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education-article/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education-article/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education-article/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | the body the module has always carried and never showed | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/education-article/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education-article/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education-article/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education-article/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education-article/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | the body the module has always carried and never showed | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/education-article/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education-article/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education-article/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education-article/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education-article/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | the body the module has always carried and never showed | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/education-article/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `community/gamification` — Recognition

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/gamification/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/gamification/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/gamification/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/gamification/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/gamification/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/gamification/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/gamification/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/gamification/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/gamification/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/gamification/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/gamification/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/gamification/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `community/leaderboard` — Leaderboard

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/leaderboard/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/leaderboard/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/leaderboard/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/community/leaderboard/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/leaderboard/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/leaderboard/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/leaderboard/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/community/leaderboard/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/leaderboard/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/leaderboard/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/leaderboard/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/community/leaderboard/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `courier/active` — Courier — active delivery

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/active/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/active/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/active/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/active/long-content.png) | 412x915 @2x | en | overridden | none measured | **2** | captured |
| `permission-location-explainer` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/active/permission-location-explainer.png) | 412x915 @2x | en | overridden | none measured | **2** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/active/populated.png) | 412x915 @2x | en | overridden | none measured | **2** | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/active/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/active/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/active/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/active/long-content.png) | 393x852 @2x | en | overridden | none measured | **2** | captured |
| `permission-location-explainer` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/active/permission-location-explainer.png) | 393x852 @2x | en | overridden | none measured | **2** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/active/populated.png) | 393x852 @2x | en | overridden | none measured | **2** | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/active/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/active/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/active/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/active/long-content.png) | 360x640 @2x | en | overridden | none measured | **2** | captured |
| `permission-location-explainer` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/active/permission-location-explainer.png) | 360x640 @2x | en | overridden | none measured | **2** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/active/populated.png) | 360x640 @2x | en | overridden | none measured | **2** | captured |

### `courier/history` — Courier — history

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/history/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/history/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/history/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/history/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/history/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/history/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/history/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/history/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/history/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/history/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/history/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/history/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `courier/profile` — Courier — profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/profile/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/profile/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/profile/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/courier/profile/sign-out-confirmation.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/profile/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/profile/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/profile/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/courier/profile/sign-out-confirmation.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/profile/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/profile/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/profile/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/courier/profile/sign-out-confirmation.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |

### `health/insights` — AI insights

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ai-disabled` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/insights/ai-disabled.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/insights/error.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/insights/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/insights/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/insights/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `ai-disabled` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/insights/ai-disabled.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/insights/error.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/insights/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/insights/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/insights/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `ai-disabled` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/insights/ai-disabled.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/insights/error.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/insights/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/insights/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/insights/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `health/laboratory` — Blood tests

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/laboratory/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/laboratory/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/laboratory/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/laboratory/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | one list failed; the other must not read as "you have none" | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/laboratory/partial-failure.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/laboratory/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/laboratory/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/laboratory/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/laboratory/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/laboratory/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | one list failed; the other must not read as "you have none" | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/laboratory/partial-failure.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/laboratory/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/laboratory/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/laboratory/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/laboratory/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/laboratory/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | one list failed; the other must not read as "you have none" | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/laboratory/partial-failure.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/laboratory/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `health/trends` — Health trends

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/trends/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/trends/error.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/trends/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/trends/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/health/trends/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/trends/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/trends/error.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/trends/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/trends/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/health/trends/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/trends/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/trends/error.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/trends/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/trends/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/health/trends/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `history/appointment-detail` — Appointment detail

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cancel-confirmation` | cancelling asks first | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/appointment-detail/cancel-confirmation.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/appointment-detail/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/appointment-detail/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/appointment-detail/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `cancel-confirmation` | cancelling asks first | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/appointment-detail/cancel-confirmation.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/appointment-detail/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/appointment-detail/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/appointment-detail/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `cancel-confirmation` | cancelling asks first | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/appointment-detail/cancel-confirmation.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/appointment-detail/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/appointment-detail/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/appointment-detail/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `history/donation-detail` — Donation detail

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donation-detail/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donation-detail/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donation-detail/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donation-detail/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donation-detail/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donation-detail/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donation-detail/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donation-detail/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donation-detail/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donation-detail/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donation-detail/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donation-detail/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donation-detail/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donation-detail/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donation-detail/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `history/donations` — Donation history

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donations/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donations/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `filtered-empty` | a filter with no matches is not the same as having none | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donations/filtered-empty.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donations/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donations/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/history/donations/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donations/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donations/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `filtered-empty` | a filter with no matches is not the same as having none | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donations/filtered-empty.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donations/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donations/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/history/donations/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donations/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donations/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `filtered-empty` | a filter with no matches is not the same as having none | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donations/filtered-empty.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donations/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donations/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/history/donations/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/1-test-type` — Lab — test

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/1-test-type/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/1-test-type/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/1-test-type/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/1-test-type/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/1-test-type/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/1-test-type/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/1-test-type/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/1-test-type/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/1-test-type/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/1-test-type/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/1-test-type/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/1-test-type/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/2-laboratory` — Lab — laboratory

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/2-laboratory/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/2-laboratory/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/2-laboratory/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/2-laboratory/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/2-laboratory/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/2-laboratory/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/2-laboratory/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/2-laboratory/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/2-laboratory/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/3-date` — Lab — date

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/3-date/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/3-date/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/3-date/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/3-date/no-open-dates.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/3-date/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/3-date/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/3-date/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/3-date/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/3-date/no-open-dates.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/3-date/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/3-date/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/3-date/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/3-date/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | — | captured |
| `no-open-dates` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/3-date/no-open-dates.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/3-date/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/4-slot` — Lab — slot

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/4-slot/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `no-times` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/4-slot/no-times.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/4-slot/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/4-slot/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `no-times` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/4-slot/no-times.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/4-slot/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/4-slot/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `no-times` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/4-slot/no-times.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/4-slot/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `lab-booking/5-review` — Lab — review

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/5-review/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/5-review/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/5-review/slot-taken.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/5-review/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/5-review/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/5-review/slot-taken.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/5-review/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/5-review/server-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `slot-taken` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/5-review/slot-taken.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |

### `lab-booking/6-confirmation` — Lab — confirmed

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/6-confirmation/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/lab-booking/6-confirmation/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/6-confirmation/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/lab-booking/6-confirmation/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/6-confirmation/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/lab-booking/6-confirmation/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `onboarding/complete-profile` — Complete your profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/onboarding/complete-profile/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/onboarding/complete-profile/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | **1** | captured |
| `permission-location-explainer` | the explainer the app shows BEFORE the OS is asked | [png](../artifacts/mobile-v4-visual-qa/android-412x915/onboarding/complete-profile/permission-location-explainer.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `permission-notifications-explainer` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/onboarding/complete-profile/permission-notifications-explainer.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `step-1-blood-type` | first step as it opens | [png](../artifacts/mobile-v4-visual-qa/android-412x915/onboarding/complete-profile/step-1-blood-type.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `step-2-your-name` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/onboarding/complete-profile/step-2-your-name.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/onboarding/complete-profile/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/onboarding/complete-profile/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | **1** | captured |
| `permission-location-explainer` | the explainer the app shows BEFORE the OS is asked | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/onboarding/complete-profile/permission-location-explainer.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `permission-notifications-explainer` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/onboarding/complete-profile/permission-notifications-explainer.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `step-1-blood-type` | first step as it opens | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/onboarding/complete-profile/step-1-blood-type.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `step-2-your-name` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/onboarding/complete-profile/step-2-your-name.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/onboarding/complete-profile/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | **1** | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/onboarding/complete-profile/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | **1** | captured |
| `permission-location-explainer` | the explainer the app shows BEFORE the OS is asked | [png](../artifacts/mobile-v4-visual-qa/small-360x640/onboarding/complete-profile/permission-location-explainer.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |
| `permission-notifications-explainer` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/onboarding/complete-profile/permission-notifications-explainer.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |
| `step-1-blood-type` | first step as it opens | [png](../artifacts/mobile-v4-visual-qa/small-360x640/onboarding/complete-profile/step-1-blood-type.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |
| `step-2-your-name` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/onboarding/complete-profile/step-2-your-name.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |

### `sos/emergency` — Emergency SOS

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `accepted` | the accepted response, opened | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/accepted.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `arrived` | the last state a donor owns | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/arrived.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `en-route` | journey started; map shows positions and says so | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/en-route.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `light` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/light.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `list` | requests this donor can answer | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/list.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/locale-ru.png) | 412x915 @2x | ru | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/locale-uz.png) | 412x915 @2x | uz | overridden | none measured | — | captured |
| `network-failure` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/network-failure.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/server-error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `viewing` | opened, not yet answered | [png](../artifacts/mobile-v4-visual-qa/android-412x915/sos/emergency/viewing.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `accepted` | the accepted response, opened | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/accepted.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `arrived` | the last state a donor owns | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/arrived.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `en-route` | journey started; map shows positions and says so | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/en-route.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `light` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/light.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `list` | requests this donor can answer | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/list.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/locale-ru.png) | 393x852 @2x | ru | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/locale-uz.png) | 393x852 @2x | uz | overridden | none measured | — | captured |
| `network-failure` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/network-failure.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/server-error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `viewing` | opened, not yet answered | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/sos/emergency/viewing.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `accepted` | the accepted response, opened | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/accepted.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `arrived` | the last state a donor owns | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/arrived.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `en-route` | journey started; map shows positions and says so | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/en-route.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `light` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/light.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `list` | requests this donor can answer | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/list.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/locale-ru.png) | 360x640 @2x | ru | overridden | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/locale-uz.png) | 360x640 @2x | uz | overridden | none measured | — | captured |
| `network-failure` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/network-failure.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `server-error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/server-error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `viewing` | opened, not yet answered | [png](../artifacts/mobile-v4-visual-qa/small-360x640/sos/emergency/viewing.png) | 360x640 @2x | en | overridden | none measured | — | captured |

### `tabs/calendar` — Calendar

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/calendar/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/calendar/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/calendar/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek weekday and month names | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/calendar/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/calendar/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/calendar/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/calendar/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/calendar/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/calendar/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek weekday and month names | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/calendar/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/calendar/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/calendar/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/calendar/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/calendar/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/calendar/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | Uzbek weekday and month names | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/calendar/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/calendar/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/calendar/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `tabs/community` — Community

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/community/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/community/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/community/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/community/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/community/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/community/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/community/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/community/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/community/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/community/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/community/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/community/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/community/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/community/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/community/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/community/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/community/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/community/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `tabs/donate` — Donate

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/donate/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/donate/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/donate/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/donate/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/donate/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/donate/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/donate/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/donate/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/donate/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/donate/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/donate/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/donate/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/donate/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/donate/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/donate/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/donate/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/donate/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/donate/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/donate/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/donate/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/donate/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `tabs/health` — Health

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ai-unavailable` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/health/ai-unavailable.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/health/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/health/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/health/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/health/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/health/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | results loaded, appointments did not | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/health/partial-failure.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/health/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `ai-unavailable` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/health/ai-unavailable.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/health/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/health/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/health/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/health/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/health/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | results loaded, appointments did not | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/health/partial-failure.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/health/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `ai-unavailable` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/health/ai-unavailable.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `empty` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/health/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/health/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/health/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/health/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/health/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `partial-failure` | results loaded, appointments did not | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/health/partial-failure.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/health/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `tabs/home` — Home

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `emergency-banner` | an active emergency matching this donor | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/emergency-banner.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `empty` | nothing scheduled, no emergencies, no campaigns | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/empty.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `error` | every section failed | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `light` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/light.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/loading.png) | 412x915 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/locale-uz.png) | 412x915 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | whole page, to see it end to end | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `offline` | the data requests never reach the server | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/offline.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `populated` | seeded donor: verified blood type, history, next appointment | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `emergency-banner` | an active emergency matching this donor | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/emergency-banner.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `empty` | nothing scheduled, no emergencies, no campaigns | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/empty.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `error` | every section failed | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `light` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/light.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/loading.png) | 393x852 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/locale-uz.png) | 393x852 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | whole page, to see it end to end | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `offline` | the data requests never reach the server | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/offline.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `populated` | seeded donor: verified blood type, history, next appointment | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/home/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `emergency-banner` | an active emergency matching this donor | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/emergency-banner.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `empty` | nothing scheduled, no emergencies, no campaigns | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/empty.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `error` | every section failed | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `light` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/light.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `loading` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/loading.png) | 360x640 @2x | en | overridden | none measured | — | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `locale-uz` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/locale-uz.png) | 360x640 @2x | uz | seeded database | none measured | — | captured |
| `long-content` | whole page, to see it end to end | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `offline` | the data requests never reach the server | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/offline.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `populated` | seeded donor: verified blood type, history, next appointment | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/home/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |

### `tabs/profile` — Profile

| State | Intent | Screenshot | Device | Locale | Data | Clipping | Console | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/profile/error.png) | 412x915 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/profile/locale-ru.png) | 412x915 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/profile/long-content.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/profile/populated.png) | 412x915 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | the destructive action asks first | [png](../artifacts/mobile-v4-visual-qa/android-412x915/tabs/profile/sign-out-confirmation.png) | 412x915 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/profile/error.png) | 393x852 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/profile/locale-ru.png) | 393x852 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/profile/long-content.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/profile/populated.png) | 393x852 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | the destructive action asks first | [png](../artifacts/mobile-v4-visual-qa/iphone-393x852/tabs/profile/sign-out-confirmation.png) | 393x852 @2x | en | seeded database | none measured | **1** | captured |
| `error` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/profile/error.png) | 360x640 @2x | en | overridden | none measured | **1** | captured |
| `locale-ru` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/profile/locale-ru.png) | 360x640 @2x | ru | seeded database | none measured | — | captured |
| `long-content` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/profile/long-content.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `populated` | — | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/profile/populated.png) | 360x640 @2x | en | seeded database | none measured | — | captured |
| `sign-out-confirmation` | the destructive action asks first | [png](../artifacts/mobile-v4-visual-qa/small-360x640/tabs/profile/sign-out-confirmation.png) | 360x640 @2x | en | seeded database | none measured | **1** | captured |

<!-- generated:inventory:end -->

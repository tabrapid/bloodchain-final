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
| `76c9d338`, `ca537e40` | Tab labels may spill into their item padding (the 393pt and 360pt frames each showed one more break) |
| _final_ | Final capture artifacts and this report (the last commit on the branch) |

The stages are coherent on their own: each one typechecks, lints and passes
the suite at that commit.

## 3. Files changed

`git diff --stat cb963889..HEAD`: 89 files at the visual-corrections commit
(81 of them under `apps/mobile`), plus the QA and documentation commit. Outside
the mobile app: the i18n formatter and its tests (`packages/i18n`), and two
service files in the API where a reference-range lookup returned the wrong
parameter's range (section 11).

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
  label is a single word longer than nine letters. The 360pt frame then
  showed "Сообщество" and even the English "Community" still breaking (a
  sixth of that bar is 58pt), so a label may now use the 4pt of padding on
  either side of its item; the neighbours' labels are centred, so the space
  is there.
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

<!-- capture-summary -->

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
| Mobile tests | `pnpm --filter @bloodchain/mobile test` | 43 suites, 631 tests pass |
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
<!-- generated:inventory:end -->

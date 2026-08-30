# Design Vulnerabilities

A full design/UI audit of the BloodChain ecosystem: the donor mobile app (`apps/mobile`) and the three web dashboards (`apps/hospital-web`, `apps/blood-center-web`, `apps/admin-web`). Scope: every screen/page in all four apps, the shared component libraries (`apps/mobile/src/components/`, `packages/ui/src/components/`), and the shared token layers (`apps/mobile/src/theme.tsx`, `packages/ui/src/styles/glass.css`, `packages/ui/src/tokens/tailwind-preset.ts`), compared against the Figma Make reference the user provided (`apps/mobile/Create Design/`).

**Method.** No rendering environment is available in this session — every finding below is derived by reading the actual code: composited color values, opacity/alpha math, which components wrap `BlurView`/`backdrop-filter` and which don't, which routes exist vs. which are linked to, icon imports, radius/spacing tokens vs. ad-hoc literals. Nothing here is a guess about pixels; each item cites the exact file, line, and code that produces the described problem.

**Scoring.** Each finding has a `category` (`color`, `contrast`, `glass-material`, `icon`, `navigation`, `spacing`, `placeholder`, `dead-code`) and a `severity`:
- **high** — visibly broken, unreadable, misleading, or unreachable
- **medium** — inconsistent with the rest of the app but not broken
- **low** — minor polish

Findings are grouped by app, then by systemic (cross-cutting) issues first, then per-screen/page.

---

## Contents

1. [Priority fix order](#priority-fix-order)
2. [Mobile app (`apps/mobile`)](#1-mobile-app-appsmobile)
3. [Hospital web (`apps/hospital-web`)](#2-hospital-web-appshospital-web)
4. [Blood center web (`apps/blood-center-web`)](#3-blood-center-web-appsblood-center-web)
5. [Admin web (`apps/admin-web`)](#4-admin-web-appsadmin-web)
6. [Totals](#totals)

---

## Priority fix order

These are the handful of issues that either (a) recur across dozens of files, or (b) are outright broken rather than merely inconsistent. Fixing these first resolves the majority of individual findings below.

1. **Admin-web: garbled `Muted0` classes are genuinely broken UI**, not a style nit — introduced by an earlier automated sweep this session (a non-word-bounded regex matched `bg-green-50` as a substring of `bg-green-500`, leaving `bg-donor-successMuted0`). These render with **no background at all**. See [4.1](#41-garbled-classes-from-the-earlier-automated-sweep-real-regressions).
2. **Mobile: the `${color}+'20'`/`+'10'` alpha-hack contrast bug** — raw accent color drawn as text/icon on top of a same-color low-alpha background, bypassing the `colors.onMuted.*` system built specifically to prevent this. Present in 30+ files, including the tab bar itself (the single most-visible element in the app). See [1.1](#11-the-20-alpha-hack-contrast-bug-systemic).
3. **Blood-center-web: `bg-donor-border`/`hover:bg-donor-border` used without an opacity modifier** — `donor-border` is a fully-opaque near-black/near-white token meant only for low-alpha borders; used as a solid fill it makes button/tile text nearly invisible, always-on in some places, on-hover in ~12 others. See [3.1](#31-donor-border-used-as-an-opaque-fill-real-contrast-bug).
4. **Hospital-web & blood-center-web: four different, undocumented "input background" tokens in simultaneous use**, none of them the design system's actual answer (`bc-solid`) — `bg-donor-surface`, `bg-donor-bg`, `bg-donor-background` all used interchangeably for the same "form field" role across both apps. See [2.1](#21-no-consistent-input-background-token-systemic) / [3.2](#32-flat-non-glass-controls-systemic).
5. **Admin-web: architectural — no page uses the shared `DataTable`/`FilterBar`/`SearchInput`/`Modal` components**, so every table/filter/input is hand-rolled and independently missing background classes. See [4.0](#40-architectural-shared-components-are-never-used).
6. **Mobile: ~14 secondary screens have no back button and no visible header** (root cause: the whole `Tabs` navigator sets `headerShown: false`, and none of these screens add their own back control), plus 2 completely orphaned screens (`education`, `insights`) that nothing in the app links to. See [1.2](#12-no-back-button--no-header-systemic) and [1.3](#13-orphaned-unreachable-screens).

---

## 1. Mobile app (`apps/mobile`)

### Design system / shared components

**`apps/mobile/src/components/GlassTabBar.tsx:57,82,85`** — `contrast` — **high**
The focused tab icon color is `colors.primary` (raw accent), drawn inside a pill whose background is `colors.primaryMuted` (line 82). This is exactly the contrast failure `onMuted` exists to fix (~1.9:1 on dark / ~3.0:1 on light for small elements), on the single most-visible, always-on-screen element in the app. Should read `colors.onMuted.primary`.

**`apps/mobile/src/components/StatCard.tsx:16-24`** — `contrast` — **high**
`getIconTheme()` sets the icon color to the raw accent (`colors.secondary/success/warning/danger`) on top of the matching `*Muted` background for every non-default variant. `StatCard` was fixed this session to wrap in `GlassCard` (the "dull tile" bug) but the icon-chip contrast bug was missed. Should use `colors.onMuted.*`.

**`apps/mobile/src/components/ErrorState.tsx:28,34`** — `contrast` — **medium**
Error icon circle: `backgroundColor: colors.dangerMuted` with `<Icon color={colors.danger}>` — raw accent on its own tint. Should be `colors.onMuted.danger`.

**`apps/mobile/src/components/gamification/AchievementCard.tsx:53-57,131-136`** — `contrast` — **medium**
"UNLOCKED" pill (`backgroundColor: colors.successMuted`) renders text with `color: colors.success` instead of `colors.onMuted.success`. Reused on both the Gamification hub and the Achievements list.

**`apps/mobile/src/components/gamification/AchievementCard.tsx:97`, `LeaderboardItem.tsx:81`** — `color` — **medium**
Both use `backgroundColor: colors.surfaceSolid` (opaque hex) instead of `GlassCard`/`BlurView` — every achievement and leaderboard row renders as a flat opaque card, breaking the glass language on the same screens as a `GradientCard` hero above them.

**`apps/mobile/src/components/IconButton.tsx:24-33`** — `color` — **medium**
`backgroundColor: colors.surface` on a plain `Pressable`, no `BlurView` — the same "flat dull tile" anti-pattern `StatCard` had before its fix. Currently dormant (no screen renders an `IconButton` — see navigation findings), but latent: the header Bell/Search icons the reference calls for on Home/Community would render flat the moment they're added.

**`apps/mobile/src/components/GlassCard.tsx` vs. `Create Design/src/components/GlassCard.tsx`** — `color` — **medium**
The reference supports `elevated` (brighter fill) and `danger` (red-tinted `rgba(216,83,96,0.12)` bg + red border) variants. The mobile version has neither — screens wanting a "danger" card (Home's SOS card, Donate's booking/SOS cards) can only override `borderColor`, so they read as a plain card with a colored outline instead of the reference's visually distinct alert card.

**`apps/mobile/src/components/SectionHeader.tsx` vs. `Create Design/src/components/SectionHeader.tsx`** — `navigation` — **medium**
The reference's `SectionHeader` takes `label` + optional `action: {label, onClick}`, rendering a right-aligned "View all" link. The mobile version only accepts `children` (a plain caption) — no screen can offer a "View all" shortcut next to a section title. Root cause of several missing shortcuts below (Home's "Next Appointment", Health's "Vitals"/"AI Insights"/"Lab Results", Donate's "Active Campaigns"/"Challenges", Community's leaderboard teaser).

**`apps/mobile/src/components/Modal.tsx:18-25`** — `color` — **low**
Uses `colors.border` with no specular gradient, instead of `colors.glassBorder`/`colors.glassSheen` like `GlassCard` — modals look flatter/less "lit" than the rest of the glass system.

**`apps/mobile/src/components/BottomSheet.tsx:16-21`** — `placeholder` — **low**
Explicitly a "Phase 1 placeholder" rendering as a centered `Modal`, not an actual bottom sheet. Unused by any current screen.

### 1.1 The `+'20'` alpha-hack contrast bug (systemic)

Instead of `colors.*Muted`/`colors.onMuted.*`, dozens of screens build badge/icon-chip backgrounds by string-concatenating an accent hex with `'20'`/`'10'` (e.g. `bloodTypeColor + '20'`) and then draw the *same raw accent* as the text/icon color on top — the exact contrast failure `onMuted` exists to prevent, via a code path that bypasses the fix entirely.

Category: `contrast` — Severity: **high** (systemic; representative, non-exhaustive — 30+ occurrences):
`apps/mobile/app/(app)/home.tsx:102,137-138`, `profile.tsx:65,116`, `health.tsx:100,160`, `calendar.tsx:240`, `donations/index.tsx:110,114`, `donations/[id].tsx:75`, `appointment/[id].tsx:151`, `laboratory/index.tsx:131,165,192,225`, `insights/index.tsx:236,324,354,384,427`, `health-trends/index.tsx:270,368,449`, `sos.tsx:310,324,436,448,577,636,660`, `(booking)/select-type.tsx:78`, `(booking)/organizations.tsx:80-81`, `(booking)/confirmation.tsx:103-104`, `(auth)/welcome.tsx:17`, `campaigns/index.tsx:74-76`, `challenges/index.tsx:74-76`, `education/index.tsx:128-130`, `gamification/achievements/index.tsx:60-64,79-84`, `gamification/badges/index.tsx:59-64`.

Two files got the *real* fix in one place but not another, proving the bug is an oversight rather than intentional: `donations/[id].tsx:334,349` and `appointment/[id].tsx:382,398` correctly use `colors.onMuted.*` for some badges while the header status badge in the *same file* (`donations/[id].tsx:74-81`, `appointment/[id].tsx:151-158`) still uses the raw+alpha pattern. `challenges/index.tsx:252` correctly uses `colors.onMuted.success`, highlighting the inconsistency of that same file's `errorCard` a few lines away.

### 1.2 No back button / no header (systemic)

Root cause: `(app)/_layout.tsx` sets `headerShown: false` on the whole `Tabs` navigator, and none of the following screens implement their own in-JSX back control. Users can only leave via the OS-level swipe/hardware-back gesture — there is no on-screen affordance, unlike every equivalent secondary screen in the reference design, which has an explicit `ArrowLeft` "Back" link.

Category: `navigation` — Severity: **high**. Affected: `notifications.tsx`, `privacy.tsx`, `security.tsx`, `campaigns/index.tsx`, `challenges/index.tsx`, `donations/index.tsx`, `education/index.tsx`, `gamification/index.tsx`, `gamification/achievements/index.tsx`, `gamification/badges/index.tsx`, `gamification/leaderboard/index.tsx`, `health-trends/index.tsx`, `insights/index.tsx`, `laboratory/index.tsx`.

Special case — **`apps/mobile/app/sos.tsx`**: this one is worse than "no header," it's a *broken* header. `sos.tsx` is a top-level route under the root `<Stack screenOptions={{headerShown:false}}>` (`app/_layout.tsx:39-44`). Its own `Stack.Screen options={{title, headerStyle, headerTintColor, headerLeft}}` calls (lines 373-379, 388-394, 416-427, 541-567, 692-698) never set `headerShown: true`, so the carefully-built `headerLeft` back button — with confirmation dialogs for the en-route/arrived states — is dead code that never renders. Users mid-emergency-response have no visible way back.

Special case — **`apps/mobile/app/(booking)/select-type.tsx`**: the only booking-wizard step with no "Back" button (`organizations.tsx`, `date.tsx`, `time.tsx`, `review.tsx` all correctly have a footer Back button) — a user who opens booking and changes their mind at step 1 has no way to leave except the OS gesture.

Special case — **`insights/index.tsx:194,203,266`**: `<Stack.Screen options={{title:...}}>` has no effect for the same `headerShown:false` reason — Category: `navigation` — **medium**.

### 1.3 Orphaned, unreachable screens

Category: `navigation` — Severity: **high**. Confirmed via full-repo search: no `router.push`/link anywhere in `apps/mobile/app/` targets either route; both are only registered in the tab navigator with `href: null`.

- **`education/index.tsx`** — the reference's Community screen surfaces an "Education" impact *stat* (`community/index.tsx:97-101`), but that's a read-only number, not a link. There is no way for a user to ever open the Education Hub.
- **`insights/index.tsx`** — the reference's Health screen explicitly links to Insights (`SectionHeader action → navigate('insights')`); the real Health screen has no AI Insights section at all (see below), so the entire AI-insights feature (trend analysis, chat, feedback) is unreachable.

### Home (`apps/mobile/app/(app)/home.tsx`)

- **No header row** — `navigation`/`spacing` — **medium**. Reference has a Bell `IconButton` (badge count, → Notifications) and an `Avatar`. Real Home has neither: no direct path to Notifications from the Home tab, no avatar/profile shortcut.
- **`home.tsx:244-259` Profile Completion card has no `ProgressBar`** — `spacing` — **high**. Reference shows a percentage pill *and* a progress bar; real Home only shows static "X% complete" text, dropping the one visual progress element the reference uses here.
- **Missing inline hero stats row** — `spacing` — **low**. Reference's blood-type hero embeds a 3-stat row (Donations / Total volume / Lives helped) with a divider and a verification-shield icon chip; real hero card only shows blood type + status badge + city.
- **SOS card has no live urgent-request count or pulse animation** — `placeholder` — **low**. Reference shows "3 urgent O+ requests near you" with a pulsing dot; real card is generic copy with neither.

### Health (`apps/mobile/app/(app)/health.tsx`)

- **Missing entire "Vitals" section** — `spacing` — **high**. Reference shows a Heart Rate `GradientCard` hero with sparkline plus a Vitals card (BP/Oxygen/Temperature/Hemoglobin rows with `Badge`s). Replaced in the real screen by two generic `StatCard`s ("Blood tests"/"Trends") that convey much less.
- **Missing "AI Insights" teaser and "Lab Results" list** — `navigation` — **high**. This is the reference's only entry point into `insights` and primary preview into `laboratory` results — neither exists here (see 1.3).
- **`health.tsx:100,160`** — `contrast` — medium (see 1.1).

### Calendar (`apps/mobile/app/(app)/calendar.tsx`)

- **`calendar.tsx:240,244`** — `contrast` — medium (see 1.1).
- **No color legend** — `spacing` — **low**. Reference shows a Donation/Checkup/Available dot legend under the grid; real screen encodes the same info (an `appointmentDot`) with no legend explaining it.
- **Icon-only "+" schedule button vs. labeled "Schedule" button** — `icon` — **low**.

### Donate (`apps/mobile/app/(app)/donate.tsx`)

- **No `GradientCard` hero** — `color` — **high**. Reference's primary CTA is a vivid `#D85360→#7B3266` "Ready for your next donation?" hero with an eligibility badge. The real Donate tab's top card is a plain glass `Card` with only a red `borderColor` — the single most important screen for the app's core purpose has no vivid gradient at all.
- **Missing "Donation Types" grid, "Active Campaigns" preview, "Challenges" preview, "Community Impact" stats row** — `spacing` — **high**. Real Donate has 3 cards (Book, History, SOS); reference has 6 sections. Visibly sparser despite the campaigns/challenges data existing elsewhere in the app.

### Community (`apps/mobile/app/(app)/community/index.tsx`)

- **Missing leaderboard teaser card** — `navigation` — **medium**. Reference opens with a "This month's leaderboard #14" card linking to `leaderboard`; real screen has none (leaderboard only reachable via the Gamification hub).
- **Feed posts have no Like/Comment/Share row** — `icon` — **medium**. `FeedPostCard` renders author/title/body/image but none of the reference's engagement icons — the feed is entirely read-only.
- **No header search icon** — `icon` — **low**.

### Profile (`apps/mobile/app/(app)/profile.tsx`)

- **`profile.tsx:65,116`** — `contrast` — medium (see 1.1).
- **No link to Gamification/Achievements/Badges/Leaderboard** — `navigation` — **high**. Reference's Profile has a dedicated "Achievements & Badges" teaser linking to `gamification`. Real Profile's ACCOUNT list has no such entry — the only path into Gamification anywhere in the app is tapping the "XP points" `StatCard` on Home, not discoverable as a settings item.
- **ACCOUNT list items have no icons** — `icon` — **medium**. `profile.tsx:131-157`: "Personal Information", "Donor Profile", "Notifications" (`icon={undefined}` explicitly), "Privacy", "Security" all pass no icon. Reference's `SettingsRow` always shows a leading icon chip.
- **Missing stats row + XP progress bar under the avatar** — `spacing` — **high**. Reference's header card shows Donations/Lives saved/XP plus a "Level 8 → 9" progress bar; real header is just avatar + name + email + one badge.

### Notifications, Privacy, Security (`notifications.tsx`, `privacy.tsx`, `security.tsx`)

- No back button — `navigation` — **high** (see 1.2).
- **`notifications.tsx:242`** — `color` — **low**. `unreadCard` uses `colors.surfaceHighlight` nested inside an already-blurred `Card`; harmless but worth flagging.
- **`privacy.tsx:107`** — `spacing` — **low**. Disclaimer box uses `colors.surfaceSolid` + literal `borderRadius: 12` instead of `radius.sm`.
- Privacy Policy / Terms of Service literally say "Not yet published" — `placeholder` — **low** (acceptable pre-launch state, flagged for completeness).

### Campaigns / Challenges / Education (`campaigns/index.tsx`, `challenges/index.tsx`, `education/index.tsx`)

- No back button on all three — `navigation` — **high** (see 1.2).
- **`campaigns/index.tsx:74-76`, `challenges/index.tsx:74-76`, `education/index.tsx:128-130`** — `contrast` — medium (see 1.1).
- `education/index.tsx` is unreachable — `navigation` — **high** (see 1.3).

### Gamification hub (`apps/mobile/app/(app)/gamification/index.tsx`)

- **`gamification/index.tsx:74-75` `GradientCard colors={[colors.primary, colors.primaryMuted]}`** — `color` — **high**. The exact "dull gradient" anti-pattern: a vivid brand color fading into its own ~18%-alpha tint of itself, instead of two distinct vivid brand colors. Reference's equivalent hero uses a fully solid two-stop gradient (`#E5B86D → #D4A043`). Since `LinearGradient` isn't blurred, the translucent half visibly reveals whatever `Screen`'s ambient orbs paint behind it, bleeding through inconsistently next to the solid half.
- **No hardcoded white text inside that same gradient card** — `contrast` — **high**. Unlike `home.tsx`/`profile.tsx` (which correctly hardcode white/near-white text on their vivid gradients), every `AppText` here (`level`, `"New Donor"`, XP number, `Donations`/`Rank`/`Reputation`) uses default `colors.text`/`colors.textMuted` — near-black (`#12161C`) in light mode, poor contrast directly on a saturated red-pink card.
- No back button — `navigation` — **high** (see 1.2).
- **`gamification/index.tsx:311`** — `color` — **low**. `leaderboardButton` uses `colors.surfaceSolid` (flat, opaque) instead of glass, minor inconsistency vs. surrounding cards.

### Achievements / Badges / Leaderboard (`gamification/achievements/index.tsx`, `gamification/badges/index.tsx`, `gamification/leaderboard/index.tsx`)

- No back button on all three — `navigation` — **high** (see 1.2).
- **`achievements/index.tsx:60-64,79-84`**, **`badges/index.tsx:59-64`** — `contrast` — medium (see 1.1 pattern; `*Muted` bg + raw accent text).
- **`badges/index.tsx:133` `borderRadius: 10`** vs. **`achievements/index.tsx:145` `radius.sm` (=12)** for the visually identical `countBadge` element — `spacing` — **low**, inconsistent radius for the same pattern across sibling screens.

### Insights (`apps/mobile/app/(app)/insights/index.tsx`)

- Unreachable from anywhere in the app — `navigation` — **high** (see 1.3).
- **`insights/index.tsx:558-569` chat "Send" button text color is backwards** — `contrast` — **high**. Active state: `backgroundColor: colors.primary` (vivid red) but text color `colors.text` — near-black in light mode, not white. Every other primary-colored button (`AppButton` primary variant) correctly uses `colors.white`.
- **`insights/index.tsx:194,203,266`** `Stack.Screen options={{title}}` has no effect — `navigation` — **medium** (see 1.2).
- **`insights/index.tsx:236,324,354,384,427`** — `contrast` — medium (see 1.1).

### Laboratory / Health Trends (`laboratory/index.tsx`, `health-trends/index.tsx`)

- No back button on either — `navigation` — **high** (see 1.2).
- **`laboratory/index.tsx:131,165,192,225`**, **`health-trends/index.tsx:270,368,449`** — `contrast` — medium (see 1.1).

### SOS (`apps/mobile/app/sos.tsx`)

- Header/back button configured but never renders — `navigation` — **high** (see 1.2 special case).
- **`sos.tsx:253,255`** — `color` — **low**. Hardcoded hex `'#F97316'`/`'#EAB308'` for HIGH/MEDIUM urgency instead of theme tokens.
- **`sos.tsx:296-368,707-713,733-749`** — `spacing` — **medium**. A full `Card` nested inside an `AppButton` (`<AppButton variant="secondary">{renderEmergencyCard(emergency)}</AppButton>`) stacks a card's own padding/border/shadow inside a button's — a "box inside a box" look not seen anywhere else in the app.
- **Missing the reference's red gradient header band, pulsing alert icon, and "Your blood type matches" summary card** — `color`/`spacing` — **medium**. The real SOS list is comparatively flat/text-heavy vs. the reference's more urgent visual treatment.
- **`sos.tsx:310,324,436,448,577,636,660`** — `contrast` — medium (see 1.1).

### Appointment detail / Donations (`appointment/[id].tsx`, `donations/index.tsx`, `donations/[id].tsx`)

- **`appointment/[id].tsx:151-158`**, **`donations/[id].tsx:74-81`** — `contrast` — **medium**. Header status badge still uses the raw `+'20'` pattern even though the *same file* correctly uses `colors.onMuted.*` a few dozen lines later — internally inconsistent (see 1.1).
- **`donations/index.tsx`** — `navigation`/`spacing` — **high**/**medium**. No back button, and missing the reference `DonationHistory`'s summary stats row (Total donations / Volume donated / Lives helped) at the top.
- **`donations/index.tsx:110,114`** — `contrast` — medium (see 1.1).

### Booking wizard (`apps/mobile/app/(booking)/*`)

- **`select-type.tsx`** has no way to back out — `navigation` — **high** (see 1.2 special case).
- **`select-type.tsx:78`, `organizations.tsx:80-81`, `confirmation.tsx:103-104`** — `contrast` — medium (see 1.1).
- **`review.tsx:233-242` "Notes (Optional)" field is non-functional** — `placeholder` — **high**. `const [notes, setNotes] = useState('')` is declared and `notes: notes.trim() || undefined` is passed to the booking mutation, but the JSX only renders a static `View`/`AppText` with placeholder copy — there is no `TextInput` bound to `notes` anywhere. The field looks like a disabled input but is permanently empty; the backend plumbing exists but a user can never actually type a note.

### Auth screens (`(auth)/welcome.tsx`, `login.tsx`, `register.tsx`, `check-email.tsx`, `verify-email.tsx`)

- **`welcome.tsx:17`** `` `${colors.primary}18` `` — `color` — **low** (same alpha-hack family, single low-impact occurrence on an icon chip).
- Otherwise clean; navigation between all five screens is complete and correct.

### Courier screens (`(courier)/active.tsx`, `history.tsx`, `profile.tsx`)

No reference exists for this role. Consistent use of `Card`/`Badge`/`StatCard`, no contrast bugs found, reasonable icon usage. No significant findings.

### Onboarding / root (`(onboarding)/complete-profile.tsx`, `index.tsx`, `_layout.tsx` files)

No significant findings. Auth-redirect logic is well-commented and correct; `complete-profile.tsx` correctly uses the shared `ProgressBar`.

---

## 2. Hospital web (`apps/hospital-web`)

### 2.1 No consistent input background token (systemic)

Four different, undocumented "input background" values are in simultaneous use, and none of them is the design system's documented answer for form controls (`bc-solid`, per `SearchInput.tsx`'s own code comment: *"an input the user is about to type into needs a stable, opaque field"*):

1. `bg-donor-surface` — donors, inventory (search/filters), emergency, appointments, requests, shipments list filters
2. `bg-donor-bg` — inventory modals, requests/new, shipments/[id] modal
3. `bg-donor-background` — login form (`page.tsx`), register form
4. `bc-solid` (correct) — used **nowhere** in hospital-web

Category: `glass-material` — Severity: **medium** (pervasive; individual instances below).

The shared `SearchInput`, `LoadingState`, and `ErrorState` components are imported **zero times** anywhere in `apps/hospital-web`, despite every page hand-rolling near-identical loading spinners, search boxes, and (missing) error UI that these components already solve correctly.

### `app/page.tsx` (Dashboard / Login)

- **`page.tsx:117,131`** — `color`/`glass-material` — **medium**. Login inputs use `bg-donor-background` instead of `bc-solid`; inconsistent with `register/page.tsx`'s identical non-standard pattern.
- **`page.tsx:246-253`** — `placeholder` — **high**. Home dashboard `StatCard`s are permanently hardcoded: `value="—" note="Connect your API to view"`, `value="—" note="No data loaded"`, a fake `"Ready"/"Foundation workspace"` success card — while `analytics/page.tsx` proves real KPI data is already available. The first screen a hospital user sees is fake.
- **`page.tsx:256-291`** — `placeholder` — **high**. "Build on a trusted foundation" workspace card and "System healthy" / API-connection / Database / Notifications status list are static marketing copy and hardcoded status badges, not derived from any real health check.
- **`page.tsx:76,92,153,165,201,222,227,264,308,326,345`** (every page/branch) — `placeholder` — **low**. `organizationName="Northstar Hospital (Development)"` is hardcoded on every page/branch across the whole app, rather than sourced from `user.organizations` — even on the real-dashboard branch where `user.organizations` is already in scope and used elsewhere on the same page.

### `app/analytics/page.tsx`

- **`analytics/page.tsx:223,238,248`** — `glass-material` — **medium**. Filter `<select>`s use `bg-donor-surface` instead of `bc-solid`; will look washed-out in dark mode where `--bc-surface-alpha` is `0.07` (nearly invisible fill).
- **`analytics/page.tsx:264-268`** — `color` — **low**. Section-tab buttons: inactive tab reuses the same flat, non-glass `bg-donor-surface`.
- **`analytics/page.tsx:356,429,442,515`** — `color` — **low** (×4). Repeated `bg-donor-border p-3` tiles reuse the border color as a card fill instead of a `Muted`/`onMuted` tint pair.
- **`analytics/page.tsx:499-503`** — `color` — **low**. Urgency label: `CRITICAL → text-donor-danger`, `HIGH → text-donor-warning`, else → `text-donor-warning/70` — a three-tier system faked with an opacity hack on the same token instead of a distinct one; `LOW`/`MEDIUM` just reads as a duller warning color.

### `app/appointments/page.tsx`

- **`appointments/page.tsx:237`** — `glass-material` — **medium**. Type filter uses `bg-donor-surface`.
- **`appointments/page.tsx:320,334,343,354`** — `glass-material`/`color` — **medium**. "New Appointment Slot" modal uses `bg-donor-bg`, a *third* background token vs. this same page's own filter select (`bg-donor-surface`).
- **`appointments/page.tsx:271-273`** — `contrast` — **low**. Slot-type icon badge uses raw `bg-donor-primary/20` + `text-donor-primary` instead of `bg-donor-primaryMuted`/`text-donor-onPrimaryMuted`.

### `app/donors/page.tsx`

- **`donors/page.tsx:172`** — `glass-material` — **high**. Hand-rolled city search input duplicates the shared `SearchInput` but drops its `bc-solid` treatment — translucent with no blur, the opposite of what `SearchInput.tsx` documents a text-entry field needs.
- **`donors/page.tsx:178,188`** — `glass-material` — **medium**. Blood-type/status filter selects use `bg-donor-surface`, not `bc-solid`.
- **`donors/page.tsx:71-77`** — `placeholder` — **medium**. `loadDonors`'s catch block only `console.error`s; on API failure the page silently shows the same `EmptyState` ("No donors found — try adjusting filters") as a genuine zero-result search, actively misleading staff. The shared `ErrorState` component exists and is unused anywhere in this app.

### `app/emergency/page.tsx`

- **`emergency/page.tsx:308,323,413`** — `glass-material` — **medium**. Status filter, Refresh button, and "Waiting for donor location update…" box each use a different flat/opaque token (`bg-donor-surface`, `bg-donor-background`) for the same "small inline status chip" role used correctly two lines above.
- **`emergency/page.tsx:539-700`** — `glass-material` — **low**. "Create Emergency Request" modal fields use `bg-donor-surface` instead of `bc-solid` (internally consistent within the file, but still off-token).
- **Positive reference**: urgency/priority chips at lines 350-357, 368-378 correctly use `bg-donor-dangerMuted text-donor-onDangerMuted` / `bg-donor-warningMuted text-donor-onWarningMuted` — the best-behaved file in the app; cite as the pattern other pages should match.

### `app/inventory/page.tsx`

- **`inventory/page.tsx:392`** — `glass-material`/`spacing` — **high**. Filters panel: `rounded-lg border border-donor-border bg-donor-surface p-4` — flat (no `bc-glass`) *and* `rounded-lg` instead of the `rounded-card` every other panel on this same page uses (lines 425/438/511).
- **`inventory/page.tsx:350`** — `glass-material`/`spacing` — **medium**. Error banner: flat, `rounded-lg` not `rounded-card`, inconsistent with the glass "danger" treatment used on `emergency/page.tsx:570`.
- **`inventory/page.tsx:372,377,384,476,483`** — `glass-material` — **medium**. Search input (again duplicating `SearchInput` without its fix) and Filters/Add Location/pagination buttons all `bg-donor-surface`.
- **`inventory/page.tsx:399,412,425,438,663,677,727,737,752,761,809,819,827`** — `color`/`glass-material` — **high**. Every modal input/select (Move Unit, Adjust Unit, Add Location, Filters-panel selects) uses `bg-donor-bg` — a *third* background token vs. `bg-donor-surface` used two sections above in the same file. The clearest single instance of token inconsistency in the app.
- **`inventory/page.tsx:313,329`** — `color` — **low**. Loading spinner uses `text-donor-secondary` (teal) while every other page's identical spinner uses `text-donor-primary` (red).
- **`inventory/page.tsx:560,605,640`** — `icon` — **medium**. The `Settings` (gear) icon is used for the "Adjust" action (correcting a unit's volume/component/expiry — a data-edit action) three times. Semantically a gear reads as "configuration," not "edit this record" — doubly confusing since the sidebar uses the same `Settings` icon for the real Settings nav item. `Pencil`/`Edit3` would match the action.

### `app/register/page.tsx`

- **`register/page.tsx:113,125,137,159,172,187,199,214`** — `glass-material` — **medium** (×8). All form inputs use `bg-donor-background`, a fourth distinct "input background" value across the app.

### `app/requests/page.tsx`

- **`requests/page.tsx:161-167,232-269`** — `navigation` — **medium**. "New Request" and each request-card link use a raw `<a href="...">` instead of `next/link`'s `Link` — reintroducing the exact full-page-reload defect `AppShell.tsx`'s own doc comment describes fixing for the sidebar ("every sidebar click was a full page load... nobody was injecting Next's Link").
- **`requests/page.tsx:175`** — `glass-material` — **medium**. Status filter uses `bg-donor-surface`.
- **`requests/page.tsx:239-241`** — `contrast` — **low**. Request-type icon badge uses raw `bg-donor-primary/20`/`text-donor-primary`.
- **`requests/page.tsx:36-40,248`** — `color` — **low**. `PRIORITY_COLOR` renders `URGENT`/`CRITICAL` as plain inline text with no background — much weaker than the pill-style urgency badges used for the conceptually identical field on `emergency/page.tsx:368-378`. Same data, two different treatments across sibling pages.

### `app/requests/new/page.tsx`

- **`requests/new/page.tsx:157,169,181,195,219,232,242,251,261`** — `glass-material` — **medium** (×9). Every select/input uses `bg-donor-bg`.
- **`requests/new/page.tsx:151`** — `spacing` — **low**. Line-item row uses `rounded-lg border border-donor-border/60` nested inside a `rounded-card` parent — a third radius value one level in.

### `app/requests/[id]/page.tsx`

- **`requests/[id]/page.tsx:143-149`** — `navigation` — **medium**. "View Shipment" uses a raw `<a href={...}>` — same client-routing regression as `requests/page.tsx`.
- **`requests/[id]/page.tsx:161`** — `spacing` — **low**. Same ad-hoc nested radius as `requests/new`.

### `app/shipments/page.tsx`

- **`shipments/page.tsx:224-280`** — `navigation` — **medium**. Shipment card link uses a raw `<a href={...}>` — same routing regression.
- **`shipments/page.tsx:171`** — `glass-material` — **medium**. Status filter uses `bg-donor-surface`.
- **Positive reference**: `shipments/page.tsx:231-243` correctly uses tint-token icon badges by status.

### `app/shipments/[id]/page.tsx`

- **`shipments/[id]/page.tsx:419-492`** — `glass-material` — **high**. "Confirm Delivery" dialog is hand-built (`fixed inset-0 ... bg-black/50` → `bc-glass rounded-card`) instead of the shared `Modal` used elsewhere in this app. Missing: Escape-to-close, `role="dialog"`/`aria-modal`, the standard close button, `backdrop-blur-sm` on the scrim (shared `Modal` uses `bg-black/60 backdrop-blur-sm`; this is a flat `bg-black/50`), and uses `rounded-card` where `Modal.tsx` establishes `rounded-panel` as the modal-specific radius.
- **`shipments/[id]/page.tsx:242,246`** — `contrast` — **high**. "Courier Has Arrived" banner: `bg-donor-successMuted` background paired with raw `text-donor-success` on both the heading and the `CheckCircle` icon (should be `text-donor-onSuccessMuted`) — the exact text-on-tint contrast bug, the only instance found where this file otherwise gets the pattern right everywhere else.
- **`shipments/[id]/page.tsx:242`** — `spacing` — **low**. Banner uses `rounded-xl`, the only panel on this page not using `rounded-card`.
- **`shipments/[id]/page.tsx:432,443,456,468`** — `glass-material` — **medium**. Confirm Delivery dialog inputs use `bg-donor-bg`.
- **`shipments/[id]/page.tsx:1-17`** — `placeholder` — **low**. Imports `AlertCircle`, `MapPin`, `Package`, `RefreshCw`, `Settings`, `Activity` from `lucide-react`, none rendered anywhere in the file. The missing `RefreshCw` is notable: the sibling list page has a working Refresh button and this detail page has no equivalent way to manually re-poll despite importing the icon for one.

### `components/AppShell.tsx` / `lib/navigation.tsx`

- **`lib/navigation.tsx:23`** — `navigation` — **medium**. `{ id: 'settings', ..., disabled: true }` — permanent "Soon" placeholder, no `app/settings/page.tsx` exists (confirmed as a genuine gap — see [`Priority fix order`](#priority-fix-order) item 6 and the earlier session note that no organization-settings backend endpoint exists anywhere in `apps/api` either).
- All other sidebar items resolve to a real, non-stub page — no other broken/missing routes.
- `AppShell.tsx` itself: no findings — correctly wires `Link`, real `onLogout`, pathname-derived active state.

### `app/globals.css`

No findings — correctly imports the shared token layer, sets `body` from `--bc-bg`/`--bc-text`, adds a visible `:focus-visible` outline.

---

## 3. Blood center web (`apps/blood-center-web`)

### 3.1 `donor-border` used as an opaque fill (real contrast bug)

`donor-border` reads from `--bc-border`, which is a **fully opaque** near-black (light mode) / near-white (dark mode) value, meant to be used at low alpha as a border color (e.g. `border-donor-border/60`). Two distinct failure modes found:

**On hover** — Category: `contrast` — Severity: **high**. Every instance below uses `hover:bg-donor-border` with **no `/NN` suffix**, so Tailwind's alpha defaults to `1`. Combined with `text-donor-text` (near-black light / near-white dark) on top, hovering any of these buttons makes the label nearly invisible in *both* themes:
`app/page.tsx:181,209`, `app/register/page.tsx:234`, `app/requests/page.tsx:151`, `app/requests/[id]/page.tsx:236`, `app/shipments/page.tsx:171`, `app/couriers/page.tsx:133`, `app/appointments/page.tsx:220,377`, `app/laboratory/page.tsx:325,421`, `app/donors/page.tsx:218,225`, `app/analytics/page.tsx:209,266`, `app/inventory/page.tsx:383,390,482,489,554,564,599,609,644,700,793,851`.

**At rest (worse — always-on, not just on hover)** — Category: `contrast` — Severity: **high**. `bg-donor-border` with no modifier used as a static tile/pill fill in `app/analytics/page.tsx`: `:352` (blood-group pill), `:422` (inventory-by-type tile), `:435` (inventory-by-component row), `:484` (donations-by-blood-group tile), `:496` (donations-by-status row), `:536` (laboratory-by-status row), `:580` (shipments-by-status row) — text is essentially invisible at rest in these, not just on hover.

Confirmed as an oversight, not a deliberate choice: `app/requests/page.tsx:222` correctly uses `hover:bg-donor-border/50` (with the modifier) on the very same page, and `app/appointments/page.tsx:302`'s Block button correctly uses `hover:border-donor-danger/50 hover:text-donor-danger`.

### 3.2 Flat, non-glass controls (systemic)

`donor-surface` is translucent with no `backdrop-filter`, so alone it reads as a dull flat tile rather than glass (per `SearchInput.tsx`, controls should be `bc-solid`; content cards should be `bc-glass`). `donor-bg`/`donor-background` are literal aliases of the flat page-wash color, so form fields built from them nearly disappear against the page.

Category: `glass-material` — Severity: **high** (pervasive; defines the look of nearly every button/input/select/panel in the app):
- **Flat button/select instances**: `app/requests/page.tsx:151,162`, `app/analytics/page.tsx:209,222,237,247,266`, `app/appointments/page.tsx:220,239,377`, `app/laboratory/page.tsx:302,308,325,344,374`, `app/couriers/page.tsx:133`, `app/shipments/page.tsx:171,184`, `app/donors/page.tsx:172,178,188,218,225`, `app/inventory/page.tsx:378,383,390,398,482,489,554,564,599,609,644,700,793,851`.
- **Form-field "solid-page-color" instances (should be `bc-solid`)**: `app/page.tsx:117,131` (login), `app/register/page.tsx:113,125,137,159,172,187,199,214` (all 8 fields), `app/requests/[id]/page.tsx:410,422`, `app/inventory/page.tsx:405,418,431,444,669,683,733,743,758,767,815,825,833`, `app/appointments/page.tsx:322,336,345,356`, `app/shipments/[id]/page.tsx:492,532`.

### 3.3 Invalid Tailwind token: `bg-donor-surfaceElevated`

**`app/laboratory/page.tsx:344,374`** — `color` — **high**. The Tailwind preset only exposes `donor-elevated`, not `donor-surfaceElevated` — this class doesn't match anything the preset generates and is silently dropped by Tailwind's JIT. The table header and row-hover get **no background whatsoever**, defeating the intended "solid sticky header" treatment used correctly everywhere else (e.g. `DataTable`'s `bc-solid` thead).

### 3.4 Hand-rolled modals instead of the shared `Modal`

Category: `glass-material` — Severity: **medium**. `app/requests/[id]/page.tsx:382-383` (Review Request), `app/shipments/[id]/page.tsx:482-483` (Assign/Reassign Courier), `:524-525` (Cancel Shipment) all build their own dialog markup instead of importing `Modal` (which `inventory/page.tsx` and `appointments/page.tsx` do correctly). Each loses: `bc-glass-elevated` (level 2, correct for modals) in favor of `bc-glass`; `rounded-panel` in favor of `rounded-card`; `bg-black/60 backdrop-blur-sm` scrim in favor of a flat `bg-black/50`; the `bc-rise` entrance animation; Escape-to-close; and the header close button.

### Icon-badge raw-color contrast (recurring)

Category: `contrast` — Severity: **medium**. Icon badges use raw `bg-donor-primary/20` + `text-donor-primary` instead of `donor-primaryMuted`/`onPrimaryMuted`: `app/requests/page.tsx:226`, `app/shipments/page.tsx:256`, `app/couriers/page.tsx:170`, `app/appointments/page.tsx:273`.

### Page-specific findings

**`app/page.tsx`**: `:246-248` — `placeholder` — **high**. `StatCard`s permanently hardcoded (`"—"`, `"Ready"`, "Connect your API to view" / "No data loaded" / "Foundation workspace") — the primary landing dashboard never shows a real number. `:258-260` — `placeholder` — **medium**. Body copy literally states "This dashboard is a summary view and doesn't yet surface live totals here."

**`app/inventory/page.tsx`**: `:398` — filter panel is a plain `rounded-lg border border-donor-border bg-donor-surface p-4` card, not `bc-glass`, sitting under a page that otherwise uses `bc-glass` for every content surface (`glass-material`, **medium**). `:574,590,619,636` — Discard/Issue/Quarantine buttons hover to raw `hover:bg-donor-danger/20` etc. instead of the theme-shifted `*Muted` tokens their resting state uses (`color`, **low**). `:11-20,385` — hand-rolled Filters toggle instead of the shared `FilterBar` component, so the panel it expands is flat/non-glass instead of matching `FilterBar`'s appearance (`glass-material`, **medium**).

**`app/laboratory/page.tsx`**: `:22-28` — imports `DataTable`/`DataTableColumn` but never uses them, hand-building its own `<table>` (`:342-434`) instead — with visible regressions vs. the shared component (invalid `bg-donor-surfaceElevated`, full-opacity dividers instead of `/60`, no loading/empty-state reuse) (`glass-material`, **high**). `:322-329` — **icon/label mismatch**: the "Refresh" button renders the `Filter` icon instead of `RefreshCw` — every other page's identical Refresh button (`requests`, `shipments`, `couriers`, `appointments`, `analytics`) correctly uses `RefreshCw`, which isn't even imported in this file (`icon`, **high**). `:416-422` — hand-rolled action-button color logic instead of any shared button/variant convention (`spacing`, **low**).

**`app/shipments/page.tsx`**: `:47-51` — `PRIORITY_CONFIG` is defined with correct tokens but appears unused in the rendered card markup; shipment priority (routine/urgent/critical) is never displayed in the list, unlike `requests/page.tsx`, which does show its equivalent field (`placeholder`, **low**).

**`app/donors/page.tsx`**: correctly uses the shared `DataTable` — no hand-rolled table, unlike `laboratory/page.tsx`. No findings beyond the systemic input-background issue.

**`app/analytics/page.tsx`**: `:20-24` — the only page in the app that correctly uses the shared `FilterBar`, which makes the flat, non-glass selects nested inside it (`:222,237,247`) more visually jarring by contrast — a proper `bc-glass` wrapper containing flat children (`glass-material`, **low**, duplicate root cause of 3.2).

### `lib/navigation.tsx`

**`:24`** — `navigation` — **medium**. `{ id: 'settings', ..., disabled: true }` — permanent "Soon" placeholder; all 9 other sidebar items are enabled and each resolves to a real page.

### `components/AppShell.tsx` / `app/globals.css`

No findings in `AppShell.tsx`. `app/globals.css:24` — `color` — **low**. `:focus-visible { outline: 2px solid #d85360; }` uses a literal hex identical to `donor-primary` instead of referencing the token — a magic-number duplicate, not a light/dark gap (brand accents are intentionally the same in both themes).

---

## 4. Admin web (`apps/admin-web`)

### 4.0 Architectural: shared components are never used

Category: `glass-material` — Severity: **high**. None of the ~14 list/detail pages import or use the shared `DataTable`, `FilterBar`, `SearchInput`, `Modal`, or `Drawer` components (verified: zero matches anywhere under `apps/admin-web/app`). Every table, filter bar, search input, and all 5 inline modals are hand-rolled raw `<table>`/`<select>`/`<div>` JSX that an earlier automated sweep re-skinned with `donor-*` classes rather than replacing with the vetted shared components. **This is the root cause of most findings below** — a hand-built element the regex touched is exactly where a scripted pass is most likely to leave an edge case.

### 4.1 Garbled classes from the earlier automated sweep (real regressions)

Category: `color` — Severity: **high**. These are not style nits — they are **broken**. Root cause: a non-word-bounded regex substitution in this session's admin-web color-remap pass matched `bg-green-50`/`bg-red-50` etc. as a *substring* inside `bg-green-500`/`bg-red-500` (since `"50"` is a substring of `"500"`), leaving a stray trailing digit that isn't a real Tailwind class and is silently dropped — the element gets **no background at all**.

- **`app/page.tsx:376,381`** — `bg-donor-successMuted0` / `bg-donor-dangerMuted0` — API/Database health-status dots render invisible in both themes.
- **`app/ai-analytics/page.tsx:240`** — `bg-donor-secondaryMuted0` — every bar in the "7-Day Trend" chart has no fill and is invisible.

*(This needs a targeted fix pass across `apps/admin-web` for any other `MutedN` garbled class the same regex bug may have produced elsewhere — the two confirmed above were caught by direct code reading, not an exhaustive automated re-scan.)*

### Missing background on filter/search controls (systemic)

Category: `contrast` — Severity: **high**. Consequence of 4.0 — every hand-rolled `<select>`/`<input>`/`<textarea>` independently needs its own background class, and many simply don't have one, falling back to unreliable native `<input>` chrome (risk of dark text on a light native control or vice versa depending on OS/browser dark-mode handling):
`app/page.tsx:172-194` (login email/password), `app/alerts/page.tsx:86`, `app/audit/page.tsx:78,92`, `app/couriers/page.tsx:121,127`, `app/emergencies/page.tsx:76`, `app/moderation/page.tsx:119,132,310` (textarea), `app/organizations/page.tsx:152,158,167`, `app/requests/page.tsx:78,93`, `app/shipments/page.tsx:77`, `app/users/page.tsx:140,146,156,321`.

### Icon-on-Muted-tile contrast (recurring)

Category: `contrast` — Severity: **medium**. Icons use raw `text-donor-secondary/ai/warning/success/danger` on top of their own `*Muted` tile background instead of `text-donor-on*Muted` — the exact fix the shared `StatCard`/`StatusBadge` components already apply (`packages/ui/src/components/data/StatCard.tsx:31-37`). Occurrences: `app/ai-analytics/page.tsx:109-110,133-134,145-146,175-177,182-184,189-191`, `app/health/page.tsx:87-89,116,134,141,148,160`, `app/couriers/page.tsx:168-169,245-246,273,279`, `app/organizations/page.tsx:208-209,286-287`, `app/settings/page.tsx:139-140,186-187,218-219,260-261,298-299`, `app/page.tsx:218-223` (banner icons only — the paragraph text itself is correctly `onWarningMuted`).

### "No-op hover" buttons (recurring)

Category: `color` — Severity: **medium**. Several buttons' hover class resolves to the *same* class as their resting state, so they have zero visible hover feedback: `app/ai-analytics/page.tsx:98` (`bg-donor-elevated ... hover:bg-donor-elevated`), `app/health/page.tsx:73`, `app/couriers/page.tsx:290`, `app/moderation/page.tsx:325,332`, `app/organizations/page.tsx:349,356,375`, `app/users/page.tsx:349`. Contrast with `app/organizations/page.tsx:366`'s correct `hover:bg-donor-primary/85`, which does change on hover — proving this is inconsistency, not a deliberate no-hover design choice.

### "Danger red" misapplied to neutral view/read links (recurring)

Category: `color` — Severity: **medium**. Several plain "View"/"Update"/"Edit" links (not destructive actions) are styled `text-donor-danger hover:text-donor-onDangerMuted` — red implies a destructive action for a neutral read/navigate link, and `onDangerMuted` (defined for text *on top of* a dangerMuted background) is misapplied as a hover color on a transparent row background instead: `app/couriers/page.tsx:196`, `app/moderation/page.tsx:199`, `app/organizations/page.tsx:237`, `app/roles/page.tsx:149`, `app/users/page.tsx:227,335`.

### Page-specific findings

**`app/page.tsx`**: `:376,381` — see 4.1. `:172-194` — see missing-background list. `:218-223` — see icon-contrast list. `:18` — `dead-code`/`placeholder` — **low**. `EmptyState` imported but never rendered; all three "No pending organizations/emergencies/alerts" states (`:309-321,331-345,355-368`) are hand-rolled instead.

**`app/ai-analytics/page.tsx`**: `:240` — see 4.1. `:121-122` — `color` — **high**. Success-Rate tile background conditionally flips `successMuted`/`warningMuted`/`dangerMuted`, but the `CheckCircle` icon is hardcoded `text-donor-success` — when the success rate is low, a green checkmark renders inside a red "danger" tile, directly misrepresenting the stat. `:98` — see no-op-hover list. `:109-191` — see icon-contrast list.

**`app/alerts/page.tsx`**: `:86` — see missing-background list.

**`app/audit/page.tsx`**: `:78,92` — see missing-background list.

**`app/couriers/page.tsx`**: `:121,127` — see missing-background list. `:168-169,245-246,273,279` — see icon-contrast list. `:196` — see danger-link-misuse list. `:269-280` — `spacing` — **low**. Mini-stat tiles use bare `rounded`, not `rounded-card`/`rounded-panel`. `:290` — see no-op-hover list. Positive: `:235` modal correctly uses `bc-glass-elevated` + `bg-black/60 backdrop-blur-sm`.

**`app/emergencies/page.tsx`**: `:76` — see missing-background list.

**`app/health/page.tsx`**: `:73` — see no-op-hover list. `:101-104` — `color` — **high**. "Database" tile background conditionally flips `successMuted`/`dangerMuted` by DB status, but the `Database` icon is hardcoded `text-donor-success` — when the database is down the tile turns red while the icon stays green, directly contradicting the status it conveys. `:87-89,116,134,141,148,160` — see icon-contrast list.

**`app/inventory/page.tsx`**: `:74` — `spacing` — **low**. Blood-type tiles use `rounded-lg` rather than `rounded-card`. No other issues (page has no filters).

**`app/moderation/page.tsx`**: `:119,132,310` — see missing-background list. `:199` — see danger-link-misuse list. `:240` — `glass-material` — **medium**. Sticky modal header uses plain `bg-donor-surface` (translucent, alpha 0.62 light / **0.07 dark**) instead of `bc-solid`/`bg-donor-solid` — sticky elements are exactly the case that needs an opaque surface; in dark mode this header is 7% opaque, so scrolled content will visibly bleed through it. `:325,332` — see no-op-hover list; also `bg-donor-muted text-white` reuses the "muted" text-intensity token as a solid button fill, a semantic mismatch (that token isn't designed as a surface color).

**`app/organizations/page.tsx`**: `:152,158,167` — see missing-background list. `:134-138` — `contrast` — **medium**. Error-banner `X` icon uses raw `text-donor-danger` while the adjacent paragraph correctly uses `text-donor-onDangerMuted`. `:208-209,286-287` — see icon-contrast list. `:237` — see danger-link-misuse list. `:278` — `glass-material` — **medium**. Same translucent sticky-modal-header issue as moderation:240. `:323-337` — `spacing` — **low**. Mini-stat tiles use bare `rounded`. `:349,356,375` — see no-op-hover list; `:356` also reuses `bg-donor-muted text-white` as a button fill.

**`app/requests/page.tsx`**: `:78,93` — see missing-background list. Positive: `:139-143` priority badge correctly branches `dangerMuted`/`onDangerMuted` vs. `warningMuted`/`onWarningMuted` vs. neutral — proof the correct pattern exists elsewhere in the same sweep, making the violations above clearly inconsistent rather than a project-wide convention.

**`app/roles/page.tsx`**: `:149` — see danger-link-misuse list. `:167,203` — `glass-material` — **medium**. Sticky modal header/footer, same translucent-`bg-donor-surface`-instead-of-`bc-solid` issue. `:191` — `color` — **medium**. Permission checkbox's checked-fill color is `text-donor-danger` — granting a permission renders in the app's "destructive" red, a confusing semantic choice for an affirmative action.

**`app/settings/page.tsx`**: `:296` — `glass-material` — **high**. The "Maintenance Mode" card — arguably the most safety-critical control on this page — uses flat `bg-donor-surface rounded-xl` while every sibling card in the same grid (`:137,184,216,258`) correctly uses `bc-glass rounded-card`; it's also the only `rounded-xl` on the page. A clear miss by the automated sweep. `:36-44` (`Toggle` component) — `contrast` — **high**. Off-state track is `bg-donor-border` (a ~10-12%-alpha hairline token never meant as a solid fill) — nearly invisible; the thumb is `bg-donor-surface` at default alpha (**0.07 in dark mode**), so the knob is almost fully transparent against an almost-invisible track. Every toggle on this page (Push Notifications, AI Insights, SOS, Gamification, Maintenance Mode) is hard to read in dark mode. `:42` — `dead-code` — **low**. `translate-x-4.5` isn't a valid Tailwind class (not in the default spacing scale); a no-op immediately overridden by an inline `style={{transform}}` on the next line. `:139-140,186-187,218-219,260-261,298-299` — see icon-contrast list.

**`app/shipments/page.tsx`**: `:77` — see missing-background list.

**`app/users/page.tsx`**: `:140,146,156,321` — see missing-background list. `:5` — `dead-code`/`placeholder` — **low**. `StatCard` and `EmptyState` imported but never used — no summary stat row despite the import, and the empty state (`:190-193`) is hand-rolled instead of using the shared one. `:122-127` — `contrast` — **medium**. Error-banner `X` icon raw `text-donor-danger` vs. paragraph's `text-donor-onDangerMuted` (same pattern as organizations:134-138). `:227,335` — see danger-link-misuse list. `:349` — see no-op-hover list.

### What checked out clean in admin-web

- No literal Tailwind palette classes (`gray-*`, `red-*`, `blue-*`, etc.) remain anywhere — the earlier color-token sweep's primary substitution was thorough.
- No references anywhere to the removed dead shadcn classes (`bg-background`, `text-foreground`, `bg-card`, `border-border`, bare `bg-primary`/`bg-secondary`, etc.) — the `tailwind.config.ts` cleanup is safe.
- All 5 inline modals (couriers, moderation, organizations, roles, users) correctly use `bc-glass-elevated` + `bg-black/60 backdrop-blur-sm` scrims; no other undiscovered overlay/dialog/popover pattern was found.
- `lib/navigation.tsx` has no `disabled: true` items, and every nav item's route resolves to a real page. No dead links found.
- No hardcoded mock data arrays, permanent fake "—" placeholders (beyond 4.1's garbled-class side effect), or TODO/FIXME comments — every page fetches real data.

---

## Totals

Counts are per-finding-group as written above; several groups (the mobile `+'20'` pattern, the blood-center-web `donor-border` pattern, admin-web's missing-background/icon-contrast/no-op-hover/danger-link-misuse patterns) each represent many more individual file:line occurrences than the group count below reflects — see the citation lists in each section for the full instance counts.

| App | high | medium | low | groups |
|---|---|---|---|---|
| Mobile (`apps/mobile`) | 27 | 27 | 12 | 66 |
| Hospital web (`apps/hospital-web`) | 7 | 22 | 16 | 45 |
| Blood center web (`apps/blood-center-web`) | 7 | 6 | 6 | 19 (representing 40+ raw instances per 3.1/3.2) |
| Admin web (`apps/admin-web`) | 15 | 28 | 8 | 51 |
| **Total** | **56** | **83** | **42** | **181** |

By category (approximate, summed across all four apps): `contrast` is the single largest category (roughly 70+ groups, dominated by the mobile `+'20'` pattern and the three web apps' Muted/onMuted misuse), followed by `glass-material` (~35 groups, dominated by flat-surface/wrong-input-token issues), `color` (~30), `navigation` (~27, dominated by mobile's missing-back-button pattern), `spacing` (~20), `placeholder` (~15), `icon` (~7), `dead-code` (~3).

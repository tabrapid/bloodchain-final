# BLOODCHAINGA — PRODUCTION READINESS & PUBLIC RELEASE DESIGN PASS

You are working on an already-designed mobile application called **Bloodchainga**.

The current visual direction is APPROVED.

Do NOT redesign the application from scratch.

Do NOT replace the current visual identity with a generic healthcare template.

Your task is to take the existing Bloodchainga Figma Make application and evolve it into a polished, coherent, accessibility-aware, developer-ready, public-release-quality mobile product.

The existing aesthetic must remain recognizable:

* premium dark Liquid Glass
* deep navy / plum atmosphere
* Bloodchainga rose accents
* restrained cool-blue secondary lighting
* rounded glass surfaces
* strong typography
* large meaningful hero cards
* floating six-tab navigation

The goal is:

**REFINE, SYSTEMATIZE, COMPLETE, AND PRODUCTIONIZE.**

---

# 1. DO NOT CHANGE THE CORE IDENTITY

Preserve:

* existing dark premium atmosphere
* rose/plum hero treatment
* glass card language
* current overall layout rhythm
* current navigation concept
* six root tabs
* large readable hero cards
* current icon style where consistent

Do not transform Bloodchainga into:

* a generic iOS clone
* fintech dashboard
* gaming app
* social media app
* neon cyberpunk product
* hospital administration software

Bloodchainga should remain calm, warm, modern, premium, and human-centered.

---

# 2. PRODUCT SOURCE OF TRUTH

The donor app has SIX root tabs:

1. Home
2. Health
3. Donate
4. Community
5. Calendar
6. Profile

Booking is NOT a root tab.

Emergency SOS is NOT a root tab.

Keep the six-tab architecture.

---

# 3. REMOVE ALL DESIGN / DEBUG ARTIFACTS

The current preview contains labels such as:

“DARK · HOME”
“DARK · HEALTH”
“DARK · DONATE”
etc.

These are design/debug indicators.

REMOVE them from production UI.

Theme state must not appear as a developer/debug pill floating above the home indicator.

If a theme switcher is retained, use a normal product interaction through Settings/Profile or a clearly intentional icon control.

Do not expose internal design-state labels to users.

---

# 4. GLOBAL DESIGN SYSTEM CLEANUP

Audit every existing screen and normalize:

* spacing
* card radius
* glass opacity
* borders
* shadows
* blur
* typography
* icon sizes
* button heights
* badges
* section titles
* tab bar spacing

Create reusable variables/tokens.

## Spacing

Base scale:

4
8
12
16
20
24
32
40

Screen horizontal padding:
16–20px

## Radius

Small:
12px

Medium:
16–18px

Card:
22–24px

Hero:
28–32px

Pill:
fully rounded

## Touch Targets

Minimum:
44×44px

---

# 5. LIQUID GLASS REFINEMENT

The current direction is good, but reduce visual repetition.

Use three glass tiers.

## NAVIGATION GLASS

Strongest blur and floating depth.

Used for:

* bottom tab bar
* rare floating chrome

## ELEVATED GLASS

Used for:

* appointment cards
* identity cards
* important content

## STANDARD GLASS

Used for:

* settings
* rows
* secondary content

Do NOT give every card the same opacity, highlight band, and shadow.

Important content should be visually different from ordinary list containers.

Reduce excessive internal horizontal “shine” bands where they do not add hierarchy.

CONTENT FIRST.
GLASS SECOND.
COLOR THIRD.

---

# 6. BACKGROUND REFINEMENT

Preserve the dark navy/plum atmosphere.

However:

* keep the center readable
* reduce excessive glow behind text-heavy areas
* avoid random color blooms
* use ambient color mainly around hero/important regions
* do not compete with foreground cards

Background should feel dimensional, not decorative.

---

# 7. PRIMARY COLOR SYSTEM

Use Bloodchainga's established colors.

Primary Rose:
#D85360

Cool Blue:
#68B7D1

AI Violet:
#8E82DF

Success:
#63C29B

Warning:
#E5B86D

Dark Base:
approximately #070B12

Hero family:

#D85360
→ #8E3A59
→ #5B3080

Use red/rose intentionally.

Do NOT use red on every secondary action.

---

# 8. TYPOGRAPHY

Maintain the strong current hierarchy.

Use native-friendly typography suitable for React Native.

iOS:
SF Pro/system

Android:
Roboto/system

Normalize:

Screen title:
30–34px / bold

Hero number:
44–58px

Section heading:
12–14px / semibold / subtle tracking

Card title:
16–18px / semibold

Body:
14–16px

Supporting:
12–14px

Ensure text remains readable when Dynamic Type / larger accessibility text is enabled.

Never use fixed card heights that clip enlarged text.

---

# 9. HOME — PRODUCTION POLISH

Preserve the existing composition:

* greeting
* notifications
* avatar
* blood type hero
* appointment
* overview
* profile completion
* quick actions
* emergency

Refine it.

## Remove unsupported metrics

Currently the design includes values such as:

“Lives helped”

Do NOT use this unless it is a real backend field with an approved calculation.

Prefer actual measurable values such as:

* Donations
* Total donated volume
* Emergency responses
* XP

## Hero

Keep:

* blood type
* verification
* location
* donor stats

Make sure hero remains the dominant visual anchor.

## Profile Completion

Show only when profile < 100%.

At 100%, the card disappears entirely.

## Emergency

Keep it visible but calm.

Emergency must not make the whole Home screen feel alarming.

---

# 10. HEALTH — REAL DATA ONLY

The current Health screen visually looks strong.

Preserve its layout language.

However, do NOT assume the app always has:

* heart rate
* blood pressure
* oxygen saturation
* temperature

Render only health parameters actually supported by the Bloodchainga backend.

If the real application primarily provides laboratory data such as:

* Hemoglobin
* Hematocrit
* RBC
* WBC
* Platelets
* Ferritin

then adapt the visual system around those real parameters.

Do not fabricate vitals to fill the UI.

## Status

Do not display “ALL NORMAL” unless real data supports that conclusion.

Do not diagnose.

Do not independently calculate medical interpretations.

Backend-provided flags may be displayed.

## Trends

Charts must use real historical measurements.

No decorative fake trend lines.

---

# 11. DONATE — ELIGIBILITY FIRST

Keep the existing visual structure.

Main hierarchy:

Eligibility
→ Schedule
→ Donation types / supported options
→ Campaigns
→ Challenges / related content

## Critical Eligibility Rule

Do NOT hardcode medical eligibility such as:

“Every 56 days”
“Every 28 days”
“Every 7 days”
“Every 112 days”

unless these values are explicitly supplied by the real product/backend.

Eligibility must come from real backend logic.

Do not turn medical policy into static frontend design logic.

Use labels like:

“Eligibility details”

when exact timing is dynamic.

## No guilt language

Avoid:

“Save someone now”
“Lives are depending on you”

Keep communication calm and factual.

---

# 12. COMMUNITY — VERIFY PRODUCT CAPABILITIES

The current Community design includes:

* posts
* likes
* comments
* sharing
* user-generated updates

Do NOT assume these features exist in production.

Bloodchainga Community should only expose functionality supported by the actual product/backend.

If real backend supports a feed:
keep the feed.

If not, redesign Community around real entities:

* Campaigns
* Challenges
* Education
* Community impact
* Leaderboard
* donor recognition

Do NOT create fake social-network functionality.

No non-functional:

* Like
* Comment
* Share
* Post creation

buttons.

Every visible action must correspond to an implemented feature.

---

# 13. CALENDAR — PRODUCTION BEHAVIOR

Preserve the current visual language.

Support:

* appointment dates
* donation dates
* blood-test appointments/events where available
* selected day
* month navigation
* upcoming appointments

Do not use fake availability.

Calendar markers must have:

* icon/shape or label support
* not color alone

Schedule button:
→ real booking flow.

Appointment:
→ Appointment Detail.

---

# 14. PROFILE — CLEAN REAL INFORMATION

Preserve the current strong identity layout.

Remove unsupported fields such as:

“Lives saved”

unless backend explicitly provides them.

Prefer:

* Donations
* Emergency responses
* XP

Keep:

* avatar
* full name
* email
* blood type
* verification
* XP
* level
* Achievements & Badges
* Donor Profile
* Personal Info
* Notifications
* Privacy
* Security
* Logout

Profile should remain the main account/settings hub.

---

# 15. COMPLETE THE MISSING PRODUCTION SCREENS

Do NOT limit the project to the six root tabs.

Ensure the full donor application has designs for:

## AUTH

* Welcome
* Login
* Register
* Check Email

## ONBOARDING

* Welcome
* Personal Info
* Blood Type
* Location
* Notification Preferences
* Review

## BOOKING

* Appointment Type
* Organization
* Date
* Time
* Review
* Confirmation

## DETAIL SCREENS

* Notifications
* Appointment Detail
* Donation History
* Donation Detail
* Campaigns
* Challenges
* Education
* Laboratory
* Health Trends
* AI Insights
* Privacy
* Security
* Edit Personal Information
* Edit Donor Profile

## GAMIFICATION

* Gamification Hub
* Achievements
* Badges
* Leaderboard

## EMERGENCY

* Emergency List
* Emergency Detail
* Accepted
* Location pre-permission
* Location denied
* En Route
* Waiting for GPS
* Arrived
* Cancellation confirmation
* Request expired/cancelled
* Error
* Empty state

All screens must use the SAME Bloodchainga visual system.

---

# 16. EMERGENCY — PUBLIC RELEASE QUALITY

This is the highest-risk UX flow.

Prioritize clarity over visual effects.

## List

Show:

* request reference
* hospital
* blood type requirement
* units
* urgency text
* match status

## Detail

Actions:

“Yes, I Can Help”
“Decline Request”

## Accepted

Show:
“Response Accepted”

Primary:
“Start Journey”

## Location Permission

Explain:

* why location is requested
* who can see it
* when sharing starts
* when sharing stops

Then show the OS permission prompt.

## En Route

Map:

* donor marker
* hospital marker
* simple supported connection

Do NOT design unsupported:

* traffic routing
* turn-by-turn navigation
* fake ETA
* fake distance

## Arrived

Message:

“Please check in at reception.”

No donor-side:

* Complete Donation
* Finish Donation
* Mark Donated

Hospital staff completes the workflow.

---

# 17. LIGHT MODE

The current dark mode is strong.

Now create a matching LIGHT MODE.

Do not simply invert colors.

Light theme base:

#EFF1F9

Atmospheric family:

#FBF2FA
#F1F1FC
#E9F1FB

Glass surfaces in light mode need:

* more surface opacity
* subtle neutral border
* reduced glow
* clear dark text

Both themes must feel like the same product.

---

# 18. ACCESSIBILITY PASS

Audit every screen.

Requirements:

* WCAG-aware contrast
* no critical meaning through color alone
* 44×44 minimum targets
* Dynamic Type
* screen-reader-friendly structure
* readable units and numbers
* clear disabled states
* reduced motion support
* logical focus order
* large text must not clip
* icons need semantic labels in developer handoff

Do not use only:

green = good
red = bad

Always pair status with text/icon.

---

# 19. SMALL SCREEN RESPONSIVENESS

Test at least:

* 320–360px width
* ~390px width
* 430px+ width

Fix:

* text wrapping
* clipped cards
* button collisions
* hero overflow
* tab bar crowding
* bottom-nav overlap
* keyboard overlap
* safe-area issues

Use Auto Layout.

Avoid hardcoded screen-height layouts.

---

# 20. TAB BAR PRODUCTION PASS

Preserve all 6 tabs:

Home
Health
Donate
Community
Calendar
Profile

Improve the floating glass bar.

Requirements:

* sufficient spacing
* active state visible but restrained
* no overlapping home indicator
* safe-area aware
* no debug theme pill
* icon + label behavior defined

For narrow devices, create a production-safe variant that still preserves six destinations.

Do not silently remove tabs.

---

# 21. THEME SWITCHER

The currently visible top-right sun button must be evaluated.

If it remains:

* make it consistent across relevant screens
* provide Dark / Light state
* use accessible tooltip/label
* avoid making it more visually important than app content

Alternatively, place theme selection under Profile/Settings and remove persistent screen-level theme buttons.

Choose whichever creates the cleaner production UX.

---

# 22. SYSTEM STATES

Create reusable production states.

For every data-driven screen where relevant:

### Loading

Use skeletons.

### Empty

Explain what is missing and what the user can do.

### Error

Show concise message + Retry.

### Offline

Show cached content where supported + subtle Offline banner.

### Permission Denied

Explain consequence and recovery.

### Disabled

Explain why action is unavailable when needed.

Never substitute fake content after a failed API request.

---

# 23. FORMS

Audit:

* Login
* Register
* Onboarding
* Edit Profile
* Booking

Include:

* default
* focused
* filled
* error
* disabled
* loading

Keyboard-safe layout.

Correct input types.

Clear validation.

Password visibility toggle.

No disabled submit button without explaining missing requirements where appropriate.

---

# 24. MOTION SYSTEM

Create restrained motion specifications.

Examples:

* screen transition: ~200–300ms
* tab active transition
* button press scale
* card expansion
* modal/sheet entrance
* success feedback
* skeleton shimmer

No excessive spring/bounce.

No flashing emergency animation.

Support Reduce Motion.

---

# 25. HAPTICS SPECIFICATION

Document optional haptic behavior for implementation.

Examples:

Light:

* tab selection
* toggle

Medium:

* booking confirmation action
* important accepted action

Success:

* booking confirmed
* emergency response accepted

Warning:

* destructive confirmation

Do not overuse haptics.

---

# 26. EMPTY STATE COPY

Keep copy human and calm.

Examples:

No appointment:
“No upcoming appointments.”

No emergencies:
“No active emergency requests right now.”

No lab tests:
“No laboratory results yet.”

No achievements:
“Your achievements will appear here as you progress.”

Avoid guilt or pressure.

---

# 27. LOCALIZATION READINESS

The application must be ready for multiple languages, including Uzbek.

Do not design around English string length only.

Test UI using longer localized labels.

Do not embed important copy inside images.

Avoid widths that break with translation.

Use flexible text containers.

---

# 28. PRIVACY VISIBILITY

Healthcare and location data are sensitive.

Make privacy understandable.

Users should be able to understand:

* what data exists
* when location sharing is active
* notification permissions
* session/device security

Do not expose sensitive values unnecessarily on lock-screen-like surfaces.

---

# 29. COMPONENT LIBRARY

Create/normalize production components:

## Navigation

* FloatingTabBar
* TabItem
* AppHeader
* BackHeader

## Cards

* GlassCard
* ElevatedGlassCard
* HeroGradientCard
* AppointmentCard
* EmergencyCard
* CampaignCard

## Data

* StatTile
* MetricRow
* ProgressBar
* BloodTypeBadge
* StatusBadge

## Actions

* PrimaryButton
* SecondaryButton
* GhostButton
* DestructiveButton
* IconButton

## Form

* TextInput
* SelectField
* DateField
* TimeSlot
* Toggle
* Checkbox

## Feedback

* Skeleton
* EmptyState
* ErrorState
* OfflineBanner
* ConfirmationSheet
* SuccessState

## Specialized

* AIInsightCard
* AchievementBadge
* XPLevelCard
* LabResultRow
* HealthTrendChart

All production screens must use component instances and variants.

Avoid detached duplicate copies.

---

# 30. FIGMA VARIABLES

Build proper variable collections.

## Colors

Light / Dark modes.

## Spacing

Use the spacing scale.

## Radius

## Typography

## Glass

## Semantic State

Success / Warning / Danger / Info / AI

Use variables rather than manually styling every component.

---

# 31. PROTOTYPE KEY FLOWS

Create clickable prototypes for:

## Auth

Welcome
→ Register
→ Check Email
→ Login
→ Onboarding
→ Home

## Booking

Donate
→ Appointment Type
→ Organization
→ Date
→ Time
→ Review
→ Confirmation
→ Calendar

## Emergency

List
→ Detail
→ Accept
→ Location Permission
→ En Route
→ Arrived

## Health

Health
→ Laboratory
→ Health Trends
→ AI Insights

## Profile

Profile
→ Personal Information
→ Donor Profile
→ Privacy
→ Security

## Gamification

Profile
→ Gamification Hub
→ Achievements / Badges / Leaderboard

---

# 32. DESIGN CONTENT RULES

Remove any production-facing sample content that implies a specific country unless intentional.

Current examples such as:

* Istanbul
* Kadıköy
* Turkish Red Crescent
* Acıbadem
* Florence Nightingale

may be used as temporary sample content ONLY.

Do not make the application architecture dependent on Turkish location/content.

Create neutral data-ready layouts that support:

* Uzbekistan
* Turkey
* Europe
* other supported markets

Sample content must remain clearly replaceable by backend data.

---

# 33. NO FAKE FEATURES

Before finalizing every screen, ask:

“Can the real application support this?”

If not:

* remove it
* disable it transparently
* or redesign around a real capability

Especially verify:

* social likes/comments/share
* health vitals
* health interpretation
* lives saved/helped
* medical donation intervals
* emergency ETA
* distance
* campaign urgency
* reputation metrics
* streaks

Do not design functionality merely because it looks impressive.

---

# 34. DEVELOPER HANDOFF

Prepare the design for React Native + Expo implementation.

Target:

Expo SDK 52-compatible application.

Provide:

* component names
* variants
* spacing tokens
* color tokens
* typography
* glass material values
* interaction states
* motion specs
* empty/error states
* responsive rules
* safe-area rules
* light/dark themes

Avoid effects that cannot be reasonably recreated in React Native.

---

# 35. DESIGN QA CHECKLIST

Before considering a screen complete, verify:

* Uses correct component instances
* Correct spacing
* Correct theme variables
* No text clipping
* No overlapping tab bar
* Supports large text
* Supports light and dark
* Has relevant loading state
* Has relevant empty state
* Has relevant error state
* No unsupported feature
* No fake medical data
* No debug elements
* No hardcoded country assumptions
* Buttons have real navigation destinations
* Destructive actions have confirmation

---

# 36. WORK IN PHASES

Do NOT attempt all changes at once.

Work through the following phases.

At the end of EACH phase:

STOP.

Show me what changed.

Wait for approval.

Do not automatically start the next phase.

---

# PHASE 1 — FOUNDATION CLEANUP

Perform only:

* remove debug UI
* refine glass hierarchy
* normalize colors
* normalize typography
* normalize spacing/radius
* refine background
* normalize tab bar
* create/clean component library
* create Figma variables
* establish Light + Dark theme foundations

Do NOT redesign individual feature screens yet.

STOP after Phase 1.

---

# PHASE 2 — SIX ROOT SCREENS

Refine:

* Home
* Health
* Donate
* Community
* Calendar
* Profile

Preserve current layouts where good.

Fix unsupported/fake product elements.

Create:

* populated
* empty
* loading
* error
* offline

variations where relevant.

STOP after Phase 2.

---

# PHASE 3 — AUTH & ONBOARDING

Refine/create:

* Welcome
* Login
* Register
* Check Email
* 6 onboarding states

Include keyboard and validation states.

STOP after Phase 3.

---

# PHASE 4 — BOOKING & APPOINTMENTS

Complete:

* Appointment Type
* Organization
* Date
* Time
* Review
* Confirmation
* Appointment Detail
* Reschedule states
* Cancel confirmation

STOP after Phase 4.

---

# PHASE 5 — HEALTH / LAB / AI

Complete:

* Laboratory
* Lab Result
* Health Trends
* AI Insights

Use real-data-compatible components.

No diagnostic claims.

STOP after Phase 5.

---

# PHASE 6 — EMERGENCY SOS

Complete the entire emergency flow and every important edge state.

Prioritize clarity and privacy.

STOP after Phase 6.

---

# PHASE 7 — COMMUNITY & GAMIFICATION

Complete:

* Campaigns
* Challenges
* Education
* Gamification Hub
* Achievements
* Badges
* Leaderboard

Do not invent unsupported social functionality.

STOP after Phase 7.

---

# PHASE 8 — PROFILE / SETTINGS / HISTORY

Complete:

* Notifications
* Privacy
* Security
* Edit Personal Information
* Edit Donor Profile
* Donation History
* Donation Detail

STOP after Phase 8.

---

# PHASE 9 — ACCESSIBILITY & RESPONSIVENESS

Audit all screens for:

* small phones
* standard phones
* large phones
* Dynamic Type
* contrast
* light mode
* dark mode
* safe area
* keyboard
* reduced motion
* localization

STOP after Phase 9.

---

# PHASE 10 — FINAL PROTOTYPE & HANDOFF

Create final flow prototype.

Audit consistency.

Remove:

* debug components
* detached duplicates
* unused experimental frames
* unsupported fake features
* inconsistent styles

Prepare developer handoff for React Native + Expo SDK 52.

STOP when the design system, all required screens/states, prototypes, and handoff are ready.

Do not claim production readiness if major flows or system states are missing.

---

# START NOW

Perform ONLY PHASE 1.

Do not begin Phase 2 until I approve Phase 1.

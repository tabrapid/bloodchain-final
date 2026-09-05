Design a complete mobile app called "DONOR" — a blood donation & personal health companion app — using Apple's "Liquid Glass" visual language (iOS 18/26 style): frosted translucent glass panels, soft blur, specular light highlights along the top edge of every surface, floating pill-shaped navigation, and soft ambient color blooms glowing behind content. Design BOTH a dark theme and a light theme variant of every screen.

=== DESIGN SYSTEM ===

COLOR PALETTE (same accent colors in both themes):
- Primary / brand / danger: #D85360 (soft rose-red)
- Secondary: #68B7D1 (soft blue)
- AI accent: #8E82DF (soft purple, used only for AI-powered features/insights)
- Success: #63C29B (soft green)
- Warning: #E5B86D (soft amber)
- White: #FFFFFF

DARK THEME:
- Background: #070B12, with a subtle diagonal gradient from #141C2E to #0B1119 to #06090F
- 3 large, soft, blurred color blooms floating behind content (blurred circles ~300-340px, very low opacity ~20-30%) in rose, blue and purple, positioned off-canvas at the top-left, mid-right, and lower-left
- Glass surface fill: white at 6-15% opacity
- Glass border: white at 10-18% opacity (a thin lit edge)
- Glass top specular highlight: a gradient from white 14% opacity (top) fading to white 3% (bottom), painted inside every glass panel
- Text: #F2F5F7 primary, #8495A3 muted

LIGHT THEME:
- Background: #EFF1F9, with a subtle gradient from #FBF2FA to #F1F1FC to #E9F1FB
- Same 3 color blooms but softer (18-20% opacity)
- Glass surface fill: white at 55-72% opacity
- Glass border: white at 85% opacity
- Glass top specular highlight: white 75% fading to white 35%
- Text: #12161C primary, #5B6674 muted

GLASS PANEL STYLE (applies to every card, modal, tab bar, sheet):
- Real background blur (frosted glass, like iOS UIVisualEffectView), not a flat translucent color
- 1px lit border using the glass border color above
- Soft drop shadow below the panel (dark theme: black 40-45% opacity, 24px blur; light theme: black 10% opacity)
- Top specular highlight gradient as described above — this is the key "liquid glass" cue, real glass catches light along its upper edge
- Corner radius depends on component (see radius scale)

RADIUS SCALE: sm=12, md=18 (default card radius), lg=26 (modals), xl=34 (tab bar, hero cards), pill=999 (badges, buttons, pills)

SPACING SCALE: 4, 8, 16, 24, 32, 48, 64 (use 16 as base content padding, 24 between sections)

TYPOGRAPHY (system font, SF Pro style):
- Display: 38px/700 weight — big hero headlines (onboarding)
- Title: 27px/700 — screen titles
- Heading: 18px/600 — card/section titles
- Body: 15px/400 — normal text
- Body Small: 13px/400 — secondary text
- Caption: 11px/600, uppercase, letter-spacing 1.5 — section labels like "YOUR OVERVIEW"
- Button: 15px/700
- Numeric: 36px/700 — big stat numbers (e.g. blood type, XP)

ICONOGRAPHY: Simple outline icon set (Lucide-style), 18-24px, colored per context (muted gray by default, brand color when active/highlighted).

=== COMPONENTS (design as a reusable component library first) ===

1. Button — 4 variants:
   - Primary: solid fill in #D85360, white bold text, pill/rounded-12 corners
   - Secondary: glass surface fill + thin border, primary-color text
   - Danger: solid fill in #D85360 (used for SOS/emergency actions), white text
   - Ghost: transparent background, colored text only
   Also a "small" size variant (less vertical padding) and a disabled/loading state (50% opacity).

2. Icon Button — 44x44 rounded-square glass tile with a centered icon, used in headers/toolbars.

3. Glass Card (default card) — the primary content container across the whole app: frosted blur panel, top specular highlight, 1px lit border, 18px radius, 16px inner padding.

4. Gradient Card — a hero/stat card with a diagonal color gradient fill (no blur), used for the featured "Blood Type" card on Home with a large numeric value.

5. Stat Card — small tile: circular icon badge on top, big number, small caption label below, centered.

6. Badge / Status Pill — small pill-shaped label, 6 color variants (default/primary/secondary/success/warning/danger), uppercase caption text, used for statuses like "Verified", "Confirmed", "Under Review".

7. Section Header — small uppercase caption label used to divide page sections (e.g. "NEXT APPOINTMENT", "QUICK ACTIONS").

8. List Item — a row with leading icon/avatar, title + subtitle, trailing chevron.

9. Avatar — circular profile image, with an optional colored ring/border.

10. Progress Bar — thin rounded linear bar, filled portion in brand or success color, used for profile completion % and XP progress.

11. Floating Glass Tab Bar (bottom navigation) — a floating pill-shaped bar docked above the bottom edge with side margins (not full width), heavy blur, 6 icon-only tabs. The active tab's icon sits inside a small pill-shaped highlight (colored background). Icons only, no text labels.

12. Modal / Bottom Sheet — centered glass panel over a dimmed blurred backdrop, with a title row and an "X" close button top-right.

13. Skeleton / Empty State / Error State / Loading State — placeholder patterns for async content.

=== APP STRUCTURE & SCREENS ===

The app has 4 flows: AUTH, MAIN APP (bottom tab navigation), BOOKING (a modal wizard), and a separate COURIER role app. Design each screen as its own frame, grouped by flow, with both dark and light variants.

--- AUTH FLOW (no tab bar, full-screen) ---
1. Welcome — icon badge, big display headline "Care that moves with you.", subtext, primary "Sign in" button + ghost "Create an account" button, vertically centered.
2. Login — title "Welcome back.", email input field, password input field with an eye icon toggle to show/hide password, inline error state, primary submit button, link to register.
3. Register — sign-up form (name, email, password fields, primary submit button).
4. Check Email — confirmation screen shown after registering, telling the user to check their inbox.
5. Verify Email — email verification status/confirmation screen.

--- ONBOARDING (post-signup, full-screen) ---
6. Complete Profile — a wizard to fill in donor details (blood type, city, district, etc.) before accessing the main app.

--- MAIN APP (bottom tab bar with 6 tabs: Home, Health, Donate, Community, Calendar, Profile) ---
7. Home (Dashboard) — top: date label + personalized greeting. Conditional "Complete Your Profile" glass prompt card with a progress note and button. Featured gradient "Blood Type" hero card (large blood type value like "O+", a verification status pill, city/district). "Next Appointment" glass card (type + status pill, date, time, organization name, chevron to detail). "Your Overview" stat row: donations count/volume glass stat card + health stat card. "Profile" completion glass card with a percentage badge. "Quick Actions": two secondary buttons side by side ("Edit Donor Profile", "Edit Personal Info"). "Emergency" glass card with red-tinted heading and a danger button "View SOS Area".
8. Health — personal health/vitals overview screen.
9. Donate — entry screen into the booking flow, likely a call-to-action to start scheduling a donation.
10. Community — social/community feed screen.
11. Calendar — calendar view of upcoming appointments.
12. Profile (main) — user profile summary with avatar, name, settings list (links to Donor Profile, Edit Info, Notifications, Privacy, Security).
13. Profile → Edit Donor Profile — form to edit blood type, Rh factor, city, district, donor-specific info.
14. Profile → Edit Personal Info — form to edit name, contact info, personal details.
15. Notifications — list of notifications, each as a glass list item.
16. Privacy — privacy settings/toggles list.
17. Security — security settings (password change, sessions, etc.) list.
18. Appointment Detail — full detail view of a single appointment (org, date/time, type, status, actions like cancel/reschedule).
19. Campaigns — list of active blood donation campaigns/drives, each as a card.
20. Challenges — gamified challenges list, each with progress and reward.
21. Donations (history list) — list of past donations, each row with date, volume, location.
22. Donation Detail — full detail of a single past donation.
23. Education — list of educational articles/content cards.
24. Gamification Hub — overview linking to Achievements, Badges, Leaderboard, showing XP progress bar.
25. Achievements — grid/list of unlocked and locked achievements.
26. Badges — grid of earned badges with icons.
27. Leaderboard — ranked list of donors with avatar, name, rank, score.
28. Health Trends — charts/graphs showing health metrics over time.
29. Insights — AI-powered personalized insights feed (use the AI accent purple color here).
30. Laboratory — lab test results list/detail.
31. SOS (Emergency) — urgent, high-contrast screen showing active emergency blood requests matching the user's blood type, with a prominent danger-colored call-to-action.

--- BOOKING FLOW (modal/wizard style, presented over the main app, with a step progress indicator) ---
32. Select Donation Type — choose type of donation (whole blood, plasma, platelets, etc.) as selectable glass cards.
33. Select Organization — pick a hospital/blood center from a list, each with name, address, distance.
34. Select Date — calendar date picker.
35. Select Time — time slot picker (grid of selectable pill buttons).
36. Review Booking — summary of all selected choices before confirming, with an "Edit" affordance and a primary "Confirm" button.
37. Confirmation — success screen with a checkmark/celebration state, appointment summary, and a "Done" button.

--- COURIER ROLE (separate simplified app, own bottom tabs: Active, History, Profile) ---
38. Active Task — the courier's current active delivery/pickup, with status, map/location, and action buttons.
39. History — list of past completed tasks.
40. Courier Profile — courier's own profile/settings screen.

=== OUTPUT REQUEST ===
Generate high-fidelity, pixel-accurate Figma mockups for every screen listed above, using a real iOS device frame (status bar + home indicator), organized into Figma pages/sections by flow (Auth, Main App, Booking, Courier). Build the component library described above as reusable Figma components/variants first, then compose every screen from those components so the whole file stays visually and structurally consistent. Produce both a Dark theme page and a Light theme page for the Main App screens at minimum.
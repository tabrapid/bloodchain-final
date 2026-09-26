# Mobile V3 — native visual redesign

Sprint 11.2. Base `c2019faa`, branch `claude/local-test-ready`, main untouched.

This report covers what changed, what it was measured against, and — the part
that matters most — what has **not** been visually verified on a device.

---

## 1. The honest status line

| | |
|---|---|
| Code changes | complete for Phases 0–10 as scoped below |
| Automated verification | typecheck 11/11 packages, lint 0 errors, mobile 43 suites / 613 tests, i18n 79 tests, production Android export |
| **Native Android visual verification** | **NOT DONE — no device in this container** |
| **iOS visual verification** | **NOT DONE — and not claimable from Android evidence** |
| Main branch | untouched |

Everything in §3 onward is a description of a code change and the reasoning for
it. None of it is a claim about how the app looks on a phone. The harness in §2
is the thing that will produce that claim, and it needs a phone on a USB cable.

---

## 2. How to get the visual evidence

The Product Owner asked not to walk through screens by hand. One command:

```bash
./apps/mobile/qa/native/capture-android.sh final
```

Full operating notes in `apps/mobile/qa/native/README.md`. Prerequisites: one
Android device on USB with debugging accepted, `maestro` installed, and the API
running on `localhost:3001` against the seeded database. The script builds and
installs a release binary itself, grants the OS permissions with `pm grant` so
no dialog needs a human, drives 15 target screens plus the Russian and Uzbek
passes, the loading/empty/error states, and three screens re-run at 360dp.

Output lands in `artifacts/mobile-v3-native-final/android/<screen>/<state>.png`
with a generated `manifest.json`.

A screen the flows do not reach is recorded as `NATIVE_QA_UNCAPTURED` with its
reason and counted in the manifest. That is deliberate: this repository was
already burned once by 151 captures that silently photographed a login screen,
and a capture set whose gaps are invisible is worse than no capture set, because
it gets believed.

**`artifacts/mobile-v3-native-baseline/` is empty.** The baseline pass needs the
same device. Until both passes exist there is no before/after to compare, and
this document does not pretend otherwise.

---

## 3. The three root causes a browser could not show

The Sprint 11.1 visual QA produced 593 screenshots from Chromium and passed.
The app then looked weak on a real phone. Three reasons, none of them visible in
a browser capture:

**R1 — no font was ever loaded.** Every word on Android was stock Roboto at
whatever the platform decided `fontWeight: '600'` meant. Roboto ships Regular,
Medium and Bold; the framework picks among them, and V2's scale leaned on `600`
for `h2`, `h3`, `bodyStrong`, `overline` and the focused tab label. When it
resolved toward Regular the hierarchy went with it. Chromium had its own font and
its own weight synthesis, so the captures looked correct and the device did not.

Fixed in `src/design/fonts.ts`: four named Inter faces, loaded by family name.
`fontWeight` is now absent from the scale entirely — setting both asks Android to
synthesise a weight on top of a face that already has it, which is the most
reliable way to make a typeface look cheap. `src/design/typography.spec.tsx`
pins it.

**R2 — the shadows rendered as nothing.** A black shadow at low opacity on a
near-black page is invisible. Android also ignores `shadowOffset`/`shadowRadius`
outright and reads only `elevation`. So the depth existed in the CSS and not on
the screen. `Surface` now sets a real `elevation` on Android for floating
surfaces and uses a lighter fill (`surfaceRaised`) rather than a shadow to
separate a raised surface from the page — tonal elevation, which survives a
renderer that disagrees about shadows.

**R3 — uniform spacing reads as no spacing.** Everything sat 24pt apart, so
nothing was grouped with anything. The eye groups by *relative* distance and
there was nothing relative about it. `src/design/components/Section.tsx` adds
`Section` (internal rhythm: 8 or 16) and `Sections` (between-section rhythm:
24 / 32 / 48).

---

## 4. Typography

The Product Owner's scale, in the tokens:

| | size | face |
|---|---|---|
| Display | 40 | Bold |
| H1 | 30 | Bold |
| H2 | 22 | SemiBold |
| H3 | 18 | SemiBold |
| Body | 15 | Regular |
| Label | 13 | Medium |
| Caption | 11 | Regular |

`typography.spec.tsx` enforces three properties: every variant names a real Inter
face, no variant carries a numeric `fontWeight`, and adjacent levels differ by
size **and**, where the size step is under 4pt, by face as well. H3 (18) over
Body (15) is a 3pt step — which is where V2's whole scale lived and why it read
as flat — so it must change face, and it does.

Tab bar labels went 10sp → 11sp. At six tabs, 10sp reads as decoration rather
than navigation.

---

## 5. Colour

The rule: rose and clinical blue as the accents, violet for AI output only,
semantic colours for real status only.

I fixed the six violet uses a grep for `tone="insight"` found, wrote
`src/design/palette-discipline.spec.ts` to pin the rule, and it passed — while
seven more sat in taxonomy maps on four screens, because the regex only matched
the JSX prop I had been thinking about. Widened to every spelling, it found them.
This is the most useful thing in the sprint and it is worth naming why: a guard
that only catches the form you were already considering tells you what you
already believed.

What it found:

- **Lab markers.** `MARKER_ICON_BY_CODE` gave haemoglobin rose, white cells
  green, platelets amber, ferritin violet — this app's alarm, cleared-check,
  flagged and AI colours — keyed on *which test it is*, in a list whose rows
  also carry a badge saying whether the value is in range. An amber icon meaning
  "platelets" sat one column from an amber badge meaning "outside the reference
  range". V2 had already stopped reading the field at the render site and left it
  in the data. The field no longer exists.
- **Community post types.** Seven types, five accents, so the feed scrolled as
  confetti. One survives: a campaign is the only post type that asks the donor to
  act, so it stays rose. The other six take the neutral chip and are told apart
  by their icon and their translated label, which is what told them apart anyway.
- **Donation types.** Amber on platelets, violet on "other" → clinical blue.
- **Appointment types.** Violet on a consultation → clinical blue. Two colours
  for three types, deliberately: a month cell can only show a dot, so colour
  genuinely carries the category here, but there is no third colour that does not
  already mean something. Rose is the appointment where the donor gives; clinical
  blue is the appointment where a clinician does something to them. That grouping
  is true, and the legend and icons separate the two blues for anyone who needs
  it.
- **Education and gamification.** Finished lessons green, XP violet, badges
  earned amber, overall rank violet, achievements-in-progress green. None is a
  state anything can be in; all were borrowing urgency from the screens where the
  colour is load-bearing and spending it on a trophy count.

Also: a `Stat` whose value is `0` now drops its accent, so "0 donations" stops
being drawn in the same rose as a real count.

---

## 6. Cards

71 `Surface` uses → 62, and the worst single screen from six to one. A
per-screen cap of four is now a test.

Removed: a card around a twelve-tile badge grid; a card whose entire contents
were one progress bar (twice); a card around a segmented control that is already
a bordered track with a filled thumb; a card around the sentence "no other
sessions"; and the recognition screen's hero box, which sat at the top of the
screen with nothing above it for a border to separate it from.

Kept: every Surface that is a tappable destination, a distinct object, or a
loading skeleton.

**This is 13%, not the ~50% Phase 5 asked for, and I am not going to present it
as a win.** What I found on inspection is that the count was a proxy for the real
defect rather than the defect itself. Of the 62 that remain, the three screens
still at the cap break down as: `sos.tsx` — the emergency card, the details
block, the accepted-response confirmation, and the map, which needs the clipping;
`health.tsx` and `donate.tsx` — two loading skeletons each, which are never on
screen at the same time as the cards they stand in for, plus a headline card and
one tappable row. Cutting further would mean removing boxes that are doing
honest work to make a number look better. The screens that actually read as card
walls were gamification (6), profile (4) and security (4), and those are now 1, 2
and 3.

---

## 7. Charts

The Product Owner's rule: if a chart cannot communicate real data honestly,
remove it.

**Removed the Sparkline entirely** (`src/design/components/Chart.tsx`, deleted).
It scaled each series to its own min and max, so a haemoglobin reading that moved
0.1 g/dL across five months rendered as a line sweeping the full height of the
box — the same drawing a genuine collapse would produce. No axis to read it
against, no reference range on it, and it defaulted to rose. Its one call site
was the Health screen's headline card, where it sat beside a badge reading
"within healthy range" and contradicted it. The primitive is deleted rather than
left exported, because an unused primitive in the barrel is an invitation.

**Fixed the real chart** on the trends screen, three ways:

1. **`bezier` removed.** A cubic through real data overshoots: two haemoglobin
   readings of 13.6 and 13.8 can be joined by a curve that dips to 13.2, below
   the reference minimum. Nobody measured 13.2. Straight segments claim only what
   the laboratory reported.
2. **The x-axis stopped lying.** The code built a label per measurement and then
   `filter`ed the array down to five. chart-kit spreads whatever labels it is
   given evenly across the full width, so five labels over twenty points do not
   land on the points they name — the axis read "3/14" under a measurement taken
   in April. Labels are now 1:1 with points and blanked rather than dropped.
3. **The reference range is drawn, not just printed.** It was stated in words
   below the chart and left off the chart. Two flat dashed series put it where
   the eye already is. And the trend line is clinical blue rather than rose: a
   trend drawn in the alarm colour reports every value as a concern, including
   the ones the laboratory called normal.

---

## 8. Measurements

One function formats every clinical value (`src/utils/clinical.ts`, 8 tests).
The Health screen had printed five formats in a single card:

```
250000 cells/mcL        no separator, unreadable at a glance
5.1 million cells/mcL   a magnitude spelled out in words
7500 cells/mcL          no separator again
14.2 g/dL               fine
42 %                    a space before a percent sign
```

None is wrong alone. Together they say nobody was looking, and on a screen whose
job is to report clinical results that is the fastest way to lose a reader's
trust in the numbers themselves.

Thousands group with U+202F (narrow no-break space) rather than a comma or a
period: both are decimal separators to some reader of an app that ships in
English, Russian and Uzbek. Percent and degree close up against the number;
every clinical unit takes a no-break space. A missing result renders as an em
dash, never as zero — those are different clinical claims.

---

## 9. Rank and chrome

**Profile's button hierarchy was inverted.** "Edit Profile" was a full-width
outlined box directly above the chevron rows that are the actual navigation, so
the largest interactive target on the screen was the one control a donor opens
once and never again, while "Donor profile" and "Achievements" were thin rows
underneath it. It is a `LinkButton` now, at the right of the card it acts on. The
destination is unchanged and still has its own row under Donor records, where a
donor looks for it. The only full-width outlined box left on the screen is Sign
out, which is the screen's one irreversible action.

**`ScreenTitle`**, a new primitive for the root tabs. The five tabs with titles
were hand-rolling the same six lines and had drifted in the two ways hand-rolled
chrome always drifts:

- Not one of them carried `accessibilityRole="header"`. The auth screens all do,
  so the app announced "Verify your email" as a heading and "Health", "Donate",
  "Calendar", "Community" and "Profile" as ordinary text — heading navigation
  worked everywhere except the six screens a donor is actually in.
- Community paid a `paddingBottom: space.lg` on top of the `Stack`'s own 24, so
  one tab of six opened 40pt lower than its siblings. Nothing chose that.

`ScreenTitle` uses `h1` (30) where `ScreenHeader` uses `h2` (22): a root screen
is a place, a pushed screen is a step, and the 8pt is what says which.

**Home is the one root tab without a 30pt title, on purpose.** Its greeting was
`h1` and is now `h3`. The blood type in the identity card is 48pt and is the
screen's hero; a 30pt greeting above it made two heroes and neither won.

---

## 10. What was NOT changed

Per the brief's do-not-rewrite list: donor/staff authority boundaries, the SOS
state machine, clinical safety logic, blood release rules, eligibility rules,
RBAC, backend contracts, and the six donor tabs. The AI insights screen's
standing safety disclaimer and per-insight safety-level badges are untouched.

`sos.tsx` keeps all four of its Surfaces. Each is doing real work, and it is the
safety-critical screen.

---

## 11. Verification actually run

```
pnpm typecheck                              11/11 packages, clean
pnpm --filter mobile lint                   0 errors, 15 pre-existing warnings
pnpm --filter mobile test                   43 suites, 618 tests
packages/i18n vitest                        79 tests
expo export --platform android (NODE_ENV=production)   3721 modules, 15M dist
```

New tests this sprint: `typography.spec.tsx` (the font-family rules),
`palette-discipline.spec.ts` (violet-is-AI-only, per-screen Surface cap),
`clinical.spec.ts` (measurement formatting).

**The fix for R1 was verified in a production bundle, not just in source.** The
Android export's `metadata.json` lists 45 assets, 19 of them TTF. Matching the
installed `@expo-google-fonts/inter` files against those assets by MD5 content
hash:

```
Inter_400Regular.ttf  -> assets/51b6ad87261f18b6433ec52871ddfabc
Inter_500Medium.ttf   -> assets/137ab18bace28dd0bd83eb3b8ed2bc54
Inter_600SemiBold.ttf -> assets/a5f35888d2da465de352e0dcfaf33324
Inter_700Bold.ttf     -> assets/6e237de4f1f413afa2fcc45c77ac343a
4 of 4
```

So the faces the scale names are physically present in a production Android
bundle. That is not the same as seeing them rendered — see §12 — but it rules
out the specific failure that caused R1, which was a family name resolving to
nothing and falling back silently to Roboto.

**Both new guards were proven to fail before they were trusted.** Adding
`tone="insight"` to `calendar.tsx` made the palette spec red — and that
experiment is what exposed the seven object-literal violations in §5, which the
first version of the spec had passed straight over. Pointing the font spec at a
family name that does not exist made all four of its cases red.

---

## 12. Gaps, stated plainly

1. **No native Android screenshots.** No device in this container, no USB
   passthrough. §2 is the one command that fixes it.
2. **No baseline capture set**, so no before/after comparison exists.
3. **No iOS verification of any kind**, and Android evidence does not transfer.
   Blur behaviour, font rendering and elevation all differ.
4. **Phase 5's ~50% Surface reduction target was not met** — 13%. Reasoning in
   §6; the target was a proxy and I chose the defect over the metric.
5. Three screens sit at the Surface cap of four. The cap is enforced; whether
   four is the right number on those three screens is a judgement a device
   screenshot should settle, not an argument.

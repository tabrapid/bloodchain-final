# Landing V3 — uploaded brief implementation

Working tree: `modes`, based on `7fc6e1ec`. No commit, push or PR was created.
Prior dashboard/mobile changes are retained; this revision changes the landing.

The supplied brief is implemented with a public header instead of the former
sidebar, navy/white/blue palette and red donor accents, two hero CTAs, real
synthetic product captures, three audience cards, trust principles, problem and
solution, donor workflow, a module bento, portal links, institution onboarding
explanation, partnership form, FAQ and expanded contact/legal footer.

The last user-confirmed address is **jaloliddinabduganiyev5@gmail.com**. The earlier
misspelling is not used. Form submission only prepares a draft. Sending happens
in the user's own email application, after review; there is no backend submission,
automatic email, account creation or activation. Draft data is held in component
state and discarded when fields change or the page reloads.

The existing full legal policies have draft status and missing operator details.
The new `/privacy` and `/terms` pages explain actual landing behavior and clearly
state the outstanding status. They are not represented as approved policies.

## Verification

- Landing typecheck, lint and production build passed.
- Chromium acceptance suite passed at 1920, 1440, 1024, 768, 390 and 360px.
- Checks cover local Inter, both optimized product images, portal URLs, keyboard
  FAQ operation, mobile menu closing, required fields, invalid contacts,
  recipient/body encoding, zero form POSTs, draft invalidation, no persisted
  contact data, no horizontal overflow and no browser runtime errors.
- `/privacy` and `/terms` returned 200 with clear draft-status information.
- Static content and donor CTA remain available without JavaScript.
- No actual email was sent. No live-backend or native-device validation is claimed.

With the built landing running on port 3004, repeat in this cloud environment:

```bash
node artifacts/landing-v3/check-browser.cjs
```

The script uses the environment-provided Playwright and system Chromium. Other
machines need those tools installed separately. `browser-results.json` records
the results. `preview-*.png` shows the viewport; `landing-*.png` shows the complete
page. All are captures of the locally served production build.

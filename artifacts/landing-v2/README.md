# Landing V2 — local review

This revision replaces the sparse first landing with a dashboard-style public
workspace: sidebar, sticky header, contextual navigation, interactive role tour,
four participant summaries, portal cards, six feature cards, four workflow steps,
donor section, access explanation, six FAQ answers and a final portal CTA.

Palette: burgundy `#A3294B`, plum navigation `#352A35`, warm yellow `#E6B44D`,
white panels and a pale warm workspace. Spacing is generally 14–28px, with no
full-screen filler sections. Small screens stack content and use a native menu.

The app is served locally on port 3004. It has not been deployed. All files are
uncommitted on `modes`; existing changes elsewhere in the repository are retained.

Checks:

- Landing TypeScript and lint pass.
- Production build passes.
- Browser results are recorded in `browser-results.json` for 1920, 1440, 1024,
  768, 390 and 360px widths.
- Checks cover portal destinations, all three role views, keyboard selection,
  FAQ, in-page navigation, active section, mobile menu dismissal, overflow and
  browser runtime errors. Direct portal access is also checked without JavaScript.

`preview-*.png` shows the viewport; `landing-*.png` shows the complete page.
These are captures of the actual local production build, not design mockups.
The interactive tour explains existing product concepts and does not call the
live API or prove any clinical operation works.

To repeat the browser checks in this cloud environment, keep the landing running
on port 3004 and run `node artifacts/landing-v2/check-browser.cjs` from the repo
root. The script uses this environment's provided Playwright and system Chromium;
other machines need those tools installed separately. No package dependency was
added solely for browser capture.

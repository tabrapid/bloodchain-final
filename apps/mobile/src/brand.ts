/**
 * The product's name and tagline, in one place.
 *
 * They appear on the welcome screen, in both auth subtitles, in the header of
 * Donate and in three OS permission prompts. Spelling the name into each of
 * those is how a rename ends up half-done, with two screens saying one thing
 * and the location prompt saying another.
 *
 * The native app name in `app.json` cannot read this -- it is build config,
 * not code -- so that one stays in sync by hand.
 */
export const BRAND_NAME = 'Bloodchain';
export const BRAND_TAGLINE = 'PEOPLE SAVE LIVES';

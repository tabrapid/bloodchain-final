# Localization

BloodChain speaks Uzbek (Latin), Russian and English. Uzbek is the default;
English is the fallback that fills any gap.

## Where it lives

| Piece | Path |
| --- | --- |
| Shared foundation (catalogues, `t`, formatters, locale detection) | `packages/i18n` |
| Donor app provider (`expo-secure-store`, key `donor_locale`) | `apps/mobile/src/i18n.tsx` |
| Console provider (`localStorage`, key `bloodchain_locale`) | `packages/ui/src/i18n/LocaleProvider.tsx` |
| Language switchers | `apps/mobile/src/components/LanguageSwitcher.tsx`, `packages/ui/src/i18n/LanguageSwitcher.tsx` |

`packages/i18n` has no React, no platform imports and no dependencies. Each app
owns the part that differs: where the preference is stored, and how a re-render
reaches the screens.

## Catalogues

`packages/i18n/src/locales/{uz,ru,en}.ts`, one nested object per language, the
same shape in all three. English is the source of truth for what keys exist:
the package's own spec fails if a language is missing a key or has one English
does not.

```ts
t('auth.login.title')                       // a plain string
t('portal.signInSubtitle', { portal })      // {{portal}} interpolation
t('calendar.appointmentsCount', { count })  // plural forms
```

Fallback is per key, not per catalogue: a key missing from Uzbek renders in
English while the rest of the screen stays Uzbek. An unknown key returns
itself, which is what lets the tests assert that no raw key reaches a screen.

### Plurals

A message with plural forms is an object whose members are CRLDR plural
categories:

```ts
appointmentsCount: { one: '{{count}} appointment', other: '{{count}} appointments' }
```

Uzbek takes only `other` (nothing inflects after a numeral); Russian needs
`one`, `few` and `many`. `Intl.PluralRules` selects the form where it exists,
with a hand-written fallback for Hermes builds shipped without ICU data.

### Medical wording

Everything clinically meaningful lives under the `medical` namespace and
nowhere else. `CLINICAL_REVIEW_KEYS` (exported from
`packages/i18n/src/locales/index.ts`) is derived from that namespace, so a term
added later is on the review list automatically. Those translations are
deliberately plain and literal; they are for a clinician to confirm, not for a
translator to improve.

## Formatting

`createLocalization(locale)` returns the formatters alongside `t`, so a screen
that formats a date is already holding the right locale.

- Dates and times resolve through `uz-Latn-UZ`, `ru-RU` and `en-GB` — bare `uz`
  can resolve to Cyrillic, `ru-UZ` has no CLDR data, and `en-GB` keeps English
  dates day-first like the other two.
- Times use `hourCycle: 'h23'` everywhere: Uzbekistan runs on a 24-hour clock.
- `formatAddress` writes the largest unit first (region → district → city →
  mahalla → street → postal code → country), which is how an address is written
  and read locally.
- Every formatter falls back to an ISO-ish string if `Intl` throws, so a missing
  locale never blanks a screen.

## Adding a string

1. Add the key to `en.ts`, then to `uz.ts` and `ru.ts`. The spec fails on a gap.
2. Use it: `const { t } = useTranslation();` then `t('your.key')`.
3. A module-level constant cannot call `t` — there is no locale at module load.
   Store the key (`labelKey`, `VITAL_DESCRIPTION_KEY_BY_CODE`) and resolve it in
   the component. The sidebar and the donation-type lists work this way.

Validation messages follow the same rule: `packages/validation` holds catalogue
keys rather than sentences, and the screen resolves them
(`t(fieldState.error.message)`). `packages/validation`'s spec fails if one of
those keys stops resolving in any language.

## Adding a language

1. Add the code to `SUPPORTED_LOCALES` and give it a name in `LOCALE_NAMES` —
   written in that language, since a picker that says "Uzbek" only helps someone
   who already reads English.
2. Add its `Intl` tag to `INTL_LOCALES`.
3. Copy `en.ts` to `<code>.ts` and translate. The completeness spec lists what
   is missing.
4. Check the plural categories the language needs; add them to the fallback in
   `translate.ts` if it is not covered by `Intl.PluralRules`.

## Switching languages and sessions

The preference is stored under its own key and nothing else is written when it
changes, so switching language cannot disturb a signed-in session. Both
providers have a test that asserts exactly this, with auth tokens seeded in
storage beforehand.

On the web the first paint is always the default language, because
`localStorage` does not exist on the server and guessing differently on the two
sides is a hydration mismatch; the stored choice arrives immediately after.

## Not yet localized

- The API's own responses (error messages, emails) are English. A donor sees
  them when a request fails.
- Console dashboards beyond sign-in and navigation.
- The donor app's secondary screens (booking wizard, gamification, education,
  laboratory, notifications, SOS, courier).

# Backlog: English the API still sends

Sprints 1A–1D localized everything the clients render from their own catalogues.
What is left is text the **server** writes: exception messages, email bodies and
SMS bodies. A donor reading Uzbek meets these whenever a request fails, and they
arrive in English.

This file is the inventory and the proposed shape of the fix. It is a backlog,
not a plan of record — Sprint 1D deliberately did not start the refactor.

## What the numbers are

| Source | Count | Where |
| --- | --- | --- |
| `throw new *Exception('...')` sites | 414 | `apps/api/src` |
| distinct English messages behind them | 228 | as above |
| exceptions already carrying a machine-readable `code` | 17 | `apps/api/src/modules/auth/auth-error-codes.ts` |
| transactional email subjects and bodies | 2 templates | `apps/api/src/modules/email/email.service.ts` |
| SMS bodies | 1 template | `apps/api/src/modules/auth/phone-verification.service.ts` |

Roughly 4% of thrown messages are addressable by a client today. The rest reach
the screen as whatever English the handler happened to type.

## Why the auth flows are different

Sprint 1B gave the auth module a stable `AuthErrorCode` union
(`AUTH_OTP_EXPIRED`, `AUTH_CONTACT_NOT_VERIFIED`, and fifteen more) and
`ApiExceptionFilter` already forwards an explicit `code` to the client
untouched. The mobile client maps those codes to catalogue keys, so an expired
OTP reads in Uzbek without the server knowing any Uzbek. That is the pattern the
rest of the API needs, and it is proven in production code — nothing new has to
be designed.

## Proposed shape

1. **Codes before words.** Extend the `AuthErrorCode` approach module by module:
   a `<MODULE>ErrorCode` union, thrown alongside the existing English message.
   The message stays as the developer-facing fallback and the log line; the code
   is what a client keys off. This is additive and cannot break a caller.
2. **Clients map codes to keys.** `apiErrors.<CODE>` already exists as a
   namespace; each module's codes land under it. A code with no catalogue entry
   falls back to the server's English, which is exactly today's behaviour — so
   the migration can go module by module without a flag day.
3. **Emails and SMS need the recipient's language, which the server does not
   store.** This is the one piece that is not just a refactor: `User` has no
   locale column. The work is a migration plus writing the preference through
   from the client on sign-up and on language change, then per-locale templates.
   Until then, a verification email is English regardless of what the app is set
   to.
4. **Do not translate validation messages on the server.** `packages/validation`
   already holds catalogue keys rather than sentences and the clients resolve
   them; server-side DTO validation should emit the same keys.

## Order worth doing it in

Ranked by how often a donor actually meets the message:

1. `donations`, `appointments`, `appointment-slots` — booking and check-in
   failures are the most-hit error paths in the donor app.
2. `donation-eligibility` — these messages are clinical, so their catalogue
   entries belong under `medical` and go on the clinical review list.
3. `emergency`, `courier`, `shipments` — time-critical flows where an
   unreadable error costs minutes.
4. `inventory`, `laboratory`, `analytics` — staff consoles, where the reader is
   more likely to have English.
5. Email and SMS, after the `User.locale` migration lands.

## What it is not

Not a rewrite of `ApiExceptionFilter`, which already does the right thing. Not a
server-side i18n library — the server never needs to render a translated string
for a screen, only to name the condition precisely enough for a client to
translate it.

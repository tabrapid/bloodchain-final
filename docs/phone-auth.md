# Phone-first authentication

Donors in Uzbekistan sign up and sign in with a phone number. Staff keep email
and password. It is one account system either way — the same password, the same
lockout, the same sessions, the same audit trail — with two ways to say who you
are.

## Why phone first

Requiring an email address to donate blood excluded people who have a phone and
no inbox they read, which in this market is a large share of the people the
service exists for. Nothing about email was removed: every account made before
this change still works, and a new donor can still choose to give an address.

## The number

Canonical form is E.164: `+998` and the nine national digits, stored with no
spaces or punctuation. `User.phone` is unique, and uniqueness is only real if
one number has one spelling — otherwise `+998 90 123 45 67` and `901234567` are
two accounts for one person, and the second never receives the emergency matched
to the first.

Accepted on input:

| Typed | Stored |
| --- | --- |
| `+998 90 123 45 67` | `+998901234567` |
| `998901234567` | `+998901234567` |
| `00998901234567` | `+998901234567` |
| `90 123 45 67` | `+998901234567` |
| `8 90 123 45 67` (old trunk prefix) | `+998901234567` |
| `+1 415 555 0123` | `+14155550123` (kept as written) |

There is **no operator prefix list**. Uzbekistan's mobile codes change when a
licence is issued, and a list baked into a release rejects real customers of a
new operator months before anyone can ship a fix. The shape is checked; the
issuer is not.

The rule lives in two files — `apps/api/src/common/utils/phone.util.ts` and
`packages/validation/src/phone.ts` — because the API compiles with classic
module resolution and cannot import a workspace package.
`phone-normalization-parity.spec.ts` reads the client copy and fails if the two
ever disagree.

## The code

Six digits, which is a million possibilities — not many. Six things make that
enough, and removing any one makes the other five pointless:

| Rule | Setting | Default |
| --- | --- | --- |
| Short life | `OTP_TTL_SECONDS` | 300 (5 min) |
| Few guesses per code | `OTP_MAX_ATTEMPTS` | 5, then the code is burnt |
| Single use | — | spent in a conditional update, so two racing requests cannot both win |
| A resend kills the previous code | — | otherwise 20 resends would mean 20 live codes and 100 guesses |
| A floor between sends | `OTP_RESEND_COOLDOWN_SECONDS` | 60 |
| A ceiling per number | `OTP_MAX_PER_HOUR` | 5 |

The code is never stored. `PhoneVerification.codeHash` is an **HMAC keyed with a
server secret**, not a plain digest: every unkeyed hash of every six-digit code
fits in a file you could build in seconds, so a bare SHA-256 of a database dump
would be a list of live codes. The phone number and the purpose are part of the
hashed input, so a hash lifted from one row cannot be replayed against another
number or another flow. Comparison is constant-time.

## The flows

### Sign-up

```
POST /auth/phone/request-code   { phone, purpose: REGISTRATION, locale? }
      → 200 { sentTo: "+998*******67", expiresInSeconds, resendAvailableInSeconds }
POST /auth/phone/verify-code    { phone, code, purpose: REGISTRATION }
      → 200 { verificationToken, expiresInSeconds }
POST /auth/register-phone       { verificationToken, firstName, lastName, password, email? }
      → 201 { accessToken, refreshToken, user }
```

`verificationToken` is a short-lived signed ticket (15 minutes) **with the phone
number inside it**. The client never says which number was verified — that is
the whole point. Answering `{ verified: true }` and trusting the next request
would be proof of nothing, because anyone can send that.

The ticket is signed with `PHONE_TICKET_SECRET`, deliberately never
`JWT_ACCESS_SECRET`: a ticket must not be a string the bearer-token path would
even attempt to parse.

The account is created `ACTIVE` with `phoneVerified: true`, and signed in
immediately — the verification a `PENDING_VERIFICATION` account waits for has
already happened. A donor who gives no email gets a reserved, obviously
synthetic address (`998901234567@phone.bloodchain.local`) because the column is
unique and `NOT NULL`; `emailVerified` stays false, so nothing treats it as a
way to reach anyone.

### Sign-in

`POST /auth/login` takes **exactly one** of `email` or `phone`, plus the
password. One endpoint, one path, one account.

Phone **plus password**, not phone plus OTP. The reasons are in the final report
and worth repeating: OTP-as-login makes every sign-in cost an SMS and depend on
a vendor's uptime, and it reduces account takeover to whoever controls the SIM,
with no password as a second factor. Phone+password reuses the lockout, session
revocation and audit trail that already exist.

### Recovery

`purpose: PASSWORD_RESET` on the same two endpoints. Verifying the code returns
a **real `PasswordResetToken`** — the same row the emailed link carries — which
the existing `POST /auth/reset-password` spends. Recovery by phone is therefore
single-use, expires the same way, and revokes every session on success, because
it *is* the email flow with a different first step rather than a second, weaker
one.

Email recovery is unchanged.

## Not saying who has an account

`request-code` answers identically whether or not the number is registered:
same status, same body, same fields. A caller who could tell the two apart could
walk the number space and learn who donates blood here, which is medical
information about a person.

The *message* differs, because the person holding the phone is not the attacker:

- A **registered number asked to register** is told it already has an account
  and to sign in, rather than left waiting for a code that is not coming.
- An **unregistered number asked to reset** is sent nothing at all: an SMS about
  a service someone does not use is noise we would also be paying for.

Both still spend the rate-limit budget and start the cooldown, so the timing and
the response are the same either way. The honest residual: skipping a send is
marginally faster, so response time is a weak oracle — what makes that
impractical rather than merely unlikely is the five-per-hour ceiling on each
number.

## Contact verification vs medical verification

These are different things and the code says so.

`hasVerifiedContact(user)` — `emailVerified || phoneVerified` — means **a message
will arrive**. It gates sign-in for a pending account, emergency candidacy, and
the profile checklist. It was written as `emailVerified` everywhere, for the
good reason that email was once the only answer; leaving it that way would have
silently excluded every phone-verified donor from emergency matching, in the one
query where a missing donor is a missed transfusion.

`DonorProfile.verificationStatus`, the blood-type fields and the eligibility
service mean **this person is who they say and may donate**. None of them is
satisfied by receiving an SMS, and nothing in this change touched them.

## Errors

Every refusal in the auth, OTP and phone flows carries a machine-readable
`code` (`AuthErrorCode` in `apps/api/src/modules/auth/auth-error-codes.ts`).
Clients translate it through `@bloodchain/i18n` under `apiErrors.<CODE>`; the
English `message` remains as a fallback for clients that do not translate.

This is scoped to auth. Translating every response in the repository is a larger
job, and a half-done version of it is worse than an honest boundary.

## Local development

```bash
# apps/api/.env
SMS_PROVIDER=console
SMS_DEV_LOG_FILE=.sms-dev.log      # optional: also append each message here
OTP_THROTTLE_LIMIT=100             # one machine makes every request locally
OTP_VERIFY_THROTTLE_LIMIT=100
```

The console provider prints each message in a box in the API's own terminal:

```
┌──────────────────────── SMS (development) ────────────────────────
│ to:   +998901234567
│ kind: otp
│ text: 673386 — BloodChain tasdiqlash kodi. Uni hech kimga aytmang.
└───────────────────────────────────────────────────────────────────
```

`pnpm verify:phone` runs the whole thing end to end against the running API and
the local database — normalisation, the attempt cap, expiry, single use,
supersede-on-resend, the hourly ceiling, a forged ticket, registration,
sign-in by both identifiers, enumeration, and recovery including session
revocation. It creates accounts; run `pnpm demo:reset` afterwards.

See `docs/security.md` for what a deployment has to supply before any of this
sends a real message.

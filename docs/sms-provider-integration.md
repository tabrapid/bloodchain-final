# SMS provider integration

**Blocker:** MS-01 · **Owner:** PO + INFRA · **Gate:** PILOT

BloodChain sends SMS for exactly two things: the one-time codes donors sign in
with, and emergency alerts. Neither works without a real SMS vendor, and no
vendor has been contracted.

This document is the boundary. Everything on the software side is built and
tested; everything below the line marked **What the operator must supply** is
outside the repository and cannot be closed from here.

---

## What is already built

| | |
| --- | --- |
| The port | `apps/api/src/modules/sms/providers/sms-provider.interface.ts` — take a number and a message, try to deliver it, say whether it left. |
| The registry | `apps/api/src/modules/sms/providers/provider-registry.ts` — one entry per adapter. |
| Selection | `apps/api/src/modules/sms/sms.module.ts` — decided once at boot from `SMS_PROVIDER`. |
| Send + failure handling | `apps/api/src/modules/sms/sms.service.ts` — never throws; reports `accepted: false`. |
| The OTP domain | `apps/api/src/modules/auth/phone-verification.service.ts` — code generation, hashing, TTL, attempts, resend cooldown, per-number hourly ceiling. |

**Adding a vendor does not touch any of that.** It is one new file implementing
`SmsProvider`, one line in the registry, and configuration. Nothing in the
authentication domain moves — that is what the port is for.

## Why no adapter ships in this repository

Uzbekistan's SMS market is a handful of local aggregators — Eskiz, Play Mobile,
SMS.uz and others. They do not share an API: one issues a JWT that expires and
must be refreshed on a schedule, another takes a static key, a third requires
every message template to be pre-registered with the operator before it will
deliver.

Writing an adapter against a guessed API shape would produce a file that looks
finished, passes tests written against the same guess, and fails on first
contact with the real endpoint. It would also make MS-01 look closed in the
readiness register when nothing had been integrated.

So the repository ships the boundary and stops there. `sms.module.spec.ts`
asserts that no production adapter exists, which is both true today and the
thing that will fail — deliberately — on the day one is added.

---

## The four refusals

A one-time code printed into a log is not a degraded mode. It is an
authentication bypass available to anyone who can read the log, which by the
time a deployment has a log aggregator means rather more people than intended.
There are four independent barriers against shipping that way, and they are
separate on purpose: the cost of all four failing is every OTP in the system.

1. **`assertProductionConfig`** (`apps/api/src/config/production-config.ts`),
   called from `main.ts` before the application is constructed. Refuses when
   `SMS_PROVIDER` is unset or names a development adapter, and separately when
   `SMS_DEV_LOG_FILE` is set — that file is every message, including the code,
   as plain-text JSON.
2. **The provider factory** (`sms.module.ts`). Refuses a development adapter in
   production before it is even built, and distinguishes "unset" from
   "explicitly console", which are different mistakes with different fixes.
3. **`SmsService.onModuleInit`.** Refuses to start with a provider whose
   `isDevelopmentOnly` is true.
4. **An unknown `SMS_PROVIDER` is fatal in every environment.** A typo must
   never fall back to the console adapter.

Barriers 2–4 also apply to anything that builds the application without going
through `main.ts` — the e2e harness, a script, a future worker entry point.

## What reaches a user, and what does not

- The vendor's error text is logged, because that is how an operator discovers
  the account is out of credit or the sender ID is unregistered.
- It never reaches the user. A failed send answers `502` with the machine code
  `OTP_SEND_FAILED` and a fixed sentence, so a client can branch on the code
  without the user learning anything about our vendor.
- The recipient's number is masked in every log line
  (`+998 ** *** ** 21`). The audit trail records the masked form too.
- The code itself is never logged by the service, is stored only as an HMAC,
  and `req.body.code` is redacted from request logging.

## Rate limits that stay exactly as they are

Adding a vendor must not change any of these. They are what makes a six-digit
code — a million guesses — sufficient.

| Control | Variable | Default |
| --- | --- | --- |
| Code lifetime | `OTP_TTL_SECONDS` | 300 |
| Attempts per code | `OTP_MAX_ATTEMPTS` | 5 |
| Floor between sends | `OTP_RESEND_COOLDOWN_SECONDS` | 60 |
| Ceiling per number per hour | `OTP_MAX_PER_HOUR` | 5 |
| Requests per IP per 15 min | `OTP_THROTTLE_LIMIT` | 3 |
| Verifications per IP per 15 min | `OTP_VERIFY_THROTTLE_LIMIT` | 10 |

---

## How to add an adapter, once a vendor is chosen

1. Write `apps/api/src/modules/sms/providers/<vendor>-sms.provider.ts`
   implementing `SmsProvider`:
   - `name` — short, for logs.
   - `isDevelopmentOnly` — `false`.
   - `send(message)` — returns `{ accepted, providerMessageId?, error? }`.
     **Never throw**; `SmsService` treats a throw as a failed send, but the
     adapter is where a vendor's own error shape gets turned into that result.
2. Register it in `provider-registry.ts`, reading configuration with
   `config.getOrThrow` so a half-configured vendor fails at boot naming the
   variable it wants, rather than at 3am with a donor waiting for a code.
3. Add its name to the `productionSmsProviders` expectation in
   `sms.module.spec.ts` — that test currently asserts the list is empty, and it
   is meant to fail when this changes.
4. Set `SMS_PROVIDER=<vendor>` and the vendor's variables in the deployment.

Credentials are read from the environment. **Nothing vendor-specific belongs in
the repository**, in the registry, or in a committed `.env`.

---

## What the operator must supply

This is the external boundary. None of it can be produced from this repository.

| # | Item | Why it is needed | Blocks |
| --- | --- | --- | --- |
| 1 | **A contracted SMS aggregator** | Nothing delivers an SMS without one. | Everything below |
| 2 | **A registered sender ID / alphanumeric name** | Uzbek operators require the sender to be registered before messages route. Lead time is measured in weeks, not days. | Any real delivery |
| 3 | **API credentials** | Whatever the vendor's scheme is — key, or account plus secret. Supplied as environment variables, never committed. | Adapter configuration |
| 4 | **The vendor's API documentation** | The adapter is written against the real contract, not a guess. Authentication, endpoint, request shape, response shape, error codes, and whether tokens expire. | Writing the adapter |
| 5 | **Pre-registered message templates, if required** | Several Uzbek aggregators will not deliver text that does not match a template approved in advance. If this applies, the OTP and emergency message bodies must be submitted and approved — and the approved text must match what `phone-verification.service.ts` sends, in all three languages. | Any real delivery |
| 6 | **A delivery-receipt decision** | Whether the vendor offers callbacks, and whether we consume them. Relates to MS-04 (delivery monitoring), which is a separate blocker. | MS-04 only |
| 7 | **Expected message volume and cost ceiling** | An OTP endpoint is a way to spend someone else's money. The per-IP and per-number limits above are the software's side; a spend cap is the vendor's. | Pilot budgeting |

### What engineering does when those arrive

Items 3 and 4 are enough to write and test the adapter — roughly a day,
including tests, because the port, the registry, the refusals and the failure
handling are already built and tested. Items 1, 2 and 5 have external lead
times that no amount of engineering shortens.

---

## Related

- `docs/phone-auth.md` — the OTP design this sits under.
- `docs/production-readiness.md` — MS-01, MS-04.
- `docs/review-packs/` — none of this is a clinical, laboratory or legal
  decision; it is a commercial and infrastructure one.

# Account deletion — the design, and what it is waiting on

`STORE_BLOCKER_ACCOUNT_DELETION`

Both stores require an app that creates accounts to let a person delete theirs
from inside the app. This app cannot: there is no deletion endpoint, no
deactivation route a donor can reach, and — until Sprint 11.1 — the privacy
screen told donors to "contact support", which is a channel that exists nowhere
in this product.

This document is the design. It is deliberately not an implementation, because
the part that cannot be designed by engineering is the part that decides
everything: **what happens to the clinical record when the person goes.** That
is a legal and privacy question about donation records, screening results,
adverse-event history and audit trails, and inventing an answer here would be
exactly the kind of made-up retention rule the sprint brief forbids.

---

## 1. What exists today

| | |
| --- | --- |
| Donor-facing deletion endpoint | none |
| Donor-facing deactivation | none |
| `UserStatus` | `ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `PENDING_VERIFICATION` — and `DEACTIVATED` is only ever set on an *organization*, never on a user, by anything in the codebase |
| Auth behaviour if a user were `DEACTIVATED` | already correct: `auth.service.ts` refuses the login and refuses to refresh a session (`AUTH_ACCOUNT_DEACTIVATED`) |
| What the app says | "Not available yet. This app cannot delete your account." — true, and visibly disabled rather than a row that looks tappable |

The auth half of the door is already built. What is missing is a way for a
donor to ask, and a decision about what the request does to their records.

---

## 2. The flow, as designed

Four screens. Nothing in it is ambiguous, nothing is a dark pattern, and the
donor can stop at every step.

**1 — Privacy → Delete account.** An enabled row, not a disabled one, under
*Your data*. Destructive styling (the `critical` accent), not a plain row.

**2 — What deletion does.** A full screen, not a sheet: this is the one place
the consequences are stated, and a sheet invites dismissal. It says, in three
short blocks:

- **What goes.** The account and the ability to sign in. The donor profile,
  contact details, notification preferences, device registrations, leaderboard
  entry, XP and badges.
- **What stays, and for how long.** *To be written by legal/privacy.* The
  candidates are donation records, screening and TTI results, adverse-event
  records, consent acceptances and the audit log — every one of which exists
  because a blood service has to be able to answer questions about a unit
  years after it was issued. The screen must name them specifically and say the
  retention period. **No placeholder text ships here.**
- **What it does not do.** Deletion does not recall units already issued, and
  does not remove the donor from records a hospital holds.

A single primary action, `Delete my account`, in the critical accent. A
secondary `Keep my account`. The primary is not the default focus.

**3 — Confirm it is you.** Password re-entry (or the SMS code, for a
phone-only account). This is not friction for its own sake: it is the standard
protection against someone deleting an account from an unlocked phone, and the
endpoints for both already exist.

**4 — Done.** A plain confirmation that says what happened and when the
deletion completes (immediately, or after a grace period — **a decision, not an
assumption**), then signs the donor out to the welcome screen.

### States the flow needs

| State | What it shows |
| --- | --- |
| Loading | the confirm button in its pending state; the flow is not cancellable mid-request |
| Wrong password | inline on the field, with the attempt limit the auth throttle already enforces |
| Server error | the request failed and the account was **not** deleted, with retry |
| Blocked | if a donor cannot be deleted while an obligation is open (an accepted emergency response, a booked appointment, an in-flight donation), the screen says which and offers the screen that resolves it — **whether this rule exists at all is a decision** |
| Offline | no request was sent |

### Accessibility and localisation

Same contract as the rest of the app: the destructive action announces itself
as destructive, the confirmation is reachable by screen reader in the order it
reads visually, targets ≥44pt, and every string is a catalogue key in uz, ru
and en. The Russian and Uzbek copy for consequences will be longer than the
English — the layout has to wrap, not truncate.

---

## 3. What the backend needs

Endpoints, in the shape the rest of this API uses:

```
POST /api/v1/users/me/deletion-request     { password | smsCode }  -> 202
GET  /api/v1/users/me/deletion-request                             -> state, completesAt
DELETE /api/v1/users/me/deletion-request                           -> cancels, inside the grace period
```

Behind them, and **all of this is a legal/privacy decision, not an engineering
one**:

1. Which tables are erased, which are anonymised (the donor's identity removed
   while the clinical fact remains), and which are kept intact.
2. The retention period for anything kept, and the legal basis for it.
3. Whether deletion is immediate or has a grace period, and how long.
4. Whether an open clinical obligation blocks deletion.
5. What the consent record must show afterwards — the consent module already
   treats withdrawal as a new record rather than an edit, and deletion has to
   fit that model.
6. Whether a deleted donor's identifier may be reused, and what happens if the
   same person returns.

Until those are answered, the honest thing on the glass is what is there now:
a row that says the app cannot do it.

---

## 4. Why it is not built yet

Building the flow against a backend that cannot honour it would produce a
screen that asks for a password, shows a spinner, and then either lies or
errors. That is worse than the disabled row, and it is the specific failure
this project has been correcting since Sprint 11: controls that look like
capabilities the system does not have.

The store requirement is real and this is a release blocker. It is tracked as
`STORE_BLOCKER_ACCOUNT_DELETION` in `docs/mobile-release-blockers.md`, and it
needs a legal decision before it needs engineering time.

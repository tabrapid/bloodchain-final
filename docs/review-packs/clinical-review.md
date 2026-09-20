# Clinical review pack

**Reviewer:** transfusion medicine specialist
**Scope:** donor eligibility, deferral, recovery intervals, donor–recipient
compatibility, component shelf life.

Each entry states what the software does today, asks one question, and says
what changes depending on the answer. **No clinical value is proposed anywhere
in this document.** Where one is currently in the code as a development
default, the entry says so and says what refuses to run without a real one.

Write your answer into the **Answer** block under each entry and sign it.
An entry is closed only when it carries a name, a date, and an answer in the
stated format.

---

## CR-01 — The post-donation recovery interval

**What the system does now.** After a donation reaches COMPLETED, the donor
cannot book another donation, be checked in for one, or be matched to an
emergency until 56 days have passed. Staff can override the date for one
donor by setting a later date on that donation, which then wins.

**The 56 is a development default.** It was chosen to make the software run.
Nobody has signed it, and the decision register records it as
DEVELOPMENT_DEFAULT rather than as a rule.

**Question.** What is the minimum interval between whole-blood donations for
this programme, in days?

**Why the answer is needed.** This is the only thing standing between a donor
and a second donation. Too short harms donors; too long shrinks the donor pool
during a shortage. A number nobody has signed is doing both jobs right now.

**Allowed answer format.** A whole number of days, or the phrase `by donor sex`
followed by two numbers (see CR-02). Example: `Minimum interval: 60 days.`

**Dependent code.** `DONATION_COOLDOWN_DAYS` in the API environment;
`donation-eligibility.service.ts` reads it and every gate asks that service.
Changing it is a configuration change, not a code change.

**Risk if unanswered.** The pilot runs on an unsigned number that determines
how often real people give blood.

**Answer**

- Minimum interval: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## CR-02 — Whether the interval varies

**What the system does now.** One interval for every donor and every donation
type. A plasma donation and a platelet donation both open the same window as a
whole-blood donation, and sex, age and weight have no effect on it.

**Question.** Does the interval differ (a) by donor sex, (b) by donation type
(whole blood / plasma / platelets), or (c) by anything else the software
records?

**Why the answer is needed.** If it does, this is a schema and service change,
not a configuration change, and it has to be scheduled before a pilot that
collects anything but whole blood.

**Allowed answer format.** Either `No — one interval for all` or a table with
one row per case: the condition, and the interval in days.

**Dependent code.** `donation-eligibility.service.ts`. A per-type interval
needs `Donation.donationType` to reach the interval calculation, which it
currently does not.

**Risk if unanswered.** A plasma donor is held for a whole-blood interval, or
a whole-blood donor is released on a plasma one. The second is the dangerous
direction.

**Answer**

- Varies by: ______________________
- Intervals: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## CR-03 — Annual donation limit

**What the system does now.** None. A donor who satisfies the interval every
time faces no yearly ceiling.

**Question.** Is there a maximum number of donations per donor per twelve
months? If so, what is it, and does it differ by donation type or donor sex?

**Why the answer is needed.** An annual limit is a different rule from an
interval and cannot be derived from one. The software has neither.

**Allowed answer format.** Either `No annual limit` or a whole number, with the
conditions it varies by.

**Dependent code.** Nothing yet. This would be a new predicate in
`donation-eligibility.service.ts` beside the recovery window.

**Risk if unanswered.** A donor donating at the maximum rate reaches six or
seven donations a year with nothing in the system noticing.

**Answer**

- Annual limit: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## CR-04 — The deferral reason vocabulary

**What the system does now.** Sprint 7 built a real deferral model. A deferral
records its kind (temporary, with an end date, or indefinite), a reason code, a
free-text reason, who raised it, when it starts, and — if it is lifted — who
lifted it, when and why. Rows are never deleted. An active deferral blocks
booking, blocks check-in, and removes the donor from emergency matching.

**The reason code list is empty and ships empty.** Staff can type anything.
The repository proposes no deferral reasons, because proposing them would be
writing clinical rules.

**Question.** What is the list of deferral reasons this programme uses? For
each: a short code, a label, whether it is temporary or indefinite, and — if
temporary — the standard period.

**Why the answer is needed.** Without a list, every deferral is free text, so
"how many donors are deferred for this reason" cannot be answered, and a
deferral raised at one centre reads as prose at the next.

**Allowed answer format.** A table: `code | label | TEMPORARY or INDEFINITE |
standard period (days, blank if indefinite)`. As many rows as the programme
has. Codes in `A–Z0–9_`, at most 80 characters.

**Dependent code.** `DonorDeferral.reasonCode`; the staff deferral form in the
blood-centre console; `donor-deferrals.service.ts`.

**Risk if unanswered.** Deferrals are recorded but not comparable, and the
period on every temporary deferral is whatever the staff member guessed.

**Answer**

- Vocabulary: (attach table)
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## CR-05 — Whether an assessment deferral should be indefinite

**What the system does now.** When authorized staff record a donation
assessment as DEFERRED, the system raises an **indefinite** deferral against
the donor, in the same transaction as the assessment. Indefinite because
nothing in the software knows how long any deferral should last, and choosing
a period would be inventing the clinical rule this pack exists to ask about.
Staff can lift it, or replace it with a dated one, from the donor record.

**Question.** Is indefinite the right default for a deferral raised at the
chair, or should staff be required to state a period at that moment?

**Why the answer is needed.** Indefinite is the safe direction — it errs
towards keeping a donor out — but it also means a donor deferred for a
transient reason stays deferred until somebody remembers to lift it.

**Allowed answer format.** One of: `Indefinite is correct`; `Staff must state a
period`; or `Indefinite, except for these reason codes: …`.

**Dependent code.** `donations.service.ts` (`recordAssessment`), which is where
the deferral is raised.

**Risk if unanswered.** Donors accumulate indefinite deferrals from routine,
transient causes and quietly leave the pool.

**Answer**

- Default: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## CR-06 — Donor screening measurements

**What the system does now.** The pre-donation assessment records a decision
(approved, deferred, not completed), an optional reason and notes. It records
**no measurements**: no age check, no weight, no haemoglobin, no blood
pressure, no pulse. Nothing in the software prevents a donation on any of those
grounds, because nothing in the software knows them.

**Question.** For the pilot, does the paper screening process remain the
control for donor suitability, with the software recording only the outcome?

**Why the answer is needed.** If the answer is yes, this is documented in the
pilot agreement as an operator responsibility and the software is unchanged. If
no, donor screening is a new subsystem: fields, thresholds, refusals, and every
threshold is a clinical value this repository does not have.

**Allowed answer format.** Either `Paper screening remains the control` (with
the operator countersigning in the operations pack) or a specification of what
must be measured, recorded, and refused on.

**Dependent code.** `DonationAssessment`; the staff assessment form.

**Risk if unanswered.** The software looks like it screens donors and does not,
which is worse than obviously not screening them.

**Answer**

- Decision: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## CR-07 — The donor–recipient compatibility table

**What the system does now.** Emergency matching decides which donors are
compatible with a request using a hard-coded ABO/Rh table in
`emergency.service.ts`. It is whole-blood only: the same table is used
whatever component the emergency asks for. Nobody has signed it.

**Question.** Is the compatibility table in that file correct for this
programme, and does it hold for every component the pilot will collect?

You will be shown the table as it stands. Please confirm it row by row or
supply a replacement.

**Why the answer is needed.** This decides who gets asked to give blood for a
specific patient. An error here sends the wrong donor to a hospital in an
emergency.

**Allowed answer format.** Either `Confirmed as written` with your signature,
or a replacement table: for each donor group, the recipient groups it may
serve, per component.

**Dependent code.** `BLOOD_COMPATIBILITY` in `emergency.service.ts`.

**Risk if unanswered.** An unsigned compatibility table is used in emergencies
during the pilot.

**Answer**

- Confirmed / replaced: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## CR-08 — Component shelf life

**What the system does now.** **Nothing.** No shelf life is encoded anywhere in
this repository. A blood unit is created with no expiry date and a provenance
of `UNKNOWN`, and the clinical release gate **refuses to release a unit whose
shelf life is unknown** rather than guessing one. Development and demo units
get their expiry from a development-only policy carrying a deliberately absurd
ten-year figure, which is refused outright in production.

**Question.** What is the shelf life of each component this programme will
collect, measured from what moment, and under what storage conditions?

**Why the answer is needed.** Until this is answered, no unit can be released
in production. That is the intended behaviour, not a bug — but it also means
the pilot cannot issue a single unit until the answer exists.

**Allowed answer format.** A table: `component | shelf life | measured from
(collection / processing / other) | storage condition`.

**Dependent code.** `ClinicalReleasePolicy`; `clinical-release.service.ts`
(`resolveExpiry`); `BloodUnit.expiresAt` and `BloodUnit.expirySource`.

**Risk if unanswered.** No unit can be released, so the pilot cannot issue
blood. (The failure is safe, and total.)

**Answer**

- Shelf lives: (attach table)
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## CR-09 — Adverse event recording

**What the system does now.** Nothing. There is no register for a donor
reaction during or after donation, and none for a transfusion reaction in a
recipient.

**Question.** For the pilot, are adverse events recorded on paper outside this
system, and is that acceptable?

**Why the answer is needed.** If they must be in the software, this is a new
subsystem with its own vocabulary, and it is the kind of record a regulator
asks for first.

**Allowed answer format.** Either `Paper register, outside the system` or a
specification of what must be recorded and against what.

**Dependent code.** None yet.

**Risk if unanswered.** A donor reaction is recorded nowhere the software can
see, so the same donor can be called again the following week.

**Answer**

- Decision: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## CR-10 — Clinical terminology across three languages

**What the system does now.** 106 clinical terms are displayed to donors and
staff in Uzbek, Russian and English. `docs/clinical-review.md` lists all of
them; none has been reviewed.

**Question.** Are the translations of these terms clinically correct in Uzbek
and Russian, in the priority order that file sets out?

**Why the answer is needed.** A mistranslated result flag or deferral reason
misinforms a donor about their own health.

**Allowed answer format.** Mark each term in `docs/clinical-review.md` as
approved or supply a correction.

**Dependent code.** `packages/i18n/src/locales/{uz,ru,en}.ts`.

**Risk if unanswered.** Donors read clinical information in wording nobody
qualified has checked.

**Answer**

- Reviewed through: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

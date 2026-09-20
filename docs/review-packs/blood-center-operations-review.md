# Blood-centre operations review pack

**Reviewer:** blood-centre or hospital operator (the person responsible for how
the site actually runs)
**Scope:** stock thresholds, cold chain, recall, who is entitled to do what,
and what happens when the software is unavailable.

These questions are about your operation, not about medicine. Where a question
touches a clinical rule it is in the clinical or laboratory pack instead.

---

## OR-01 — What counts as low stock here

**What the system does now.** Until Sprint 7, low stock meant "fewer than five
units", for every organisation, every blood group and every component in the
country. That number was a constant in the code. Nobody chose it.

It is now configuration. Each organisation sets its own thresholds, at three
levels of specificity: a default for the whole organisation, an override per
blood group, and an override per blood group and component. The most specific
match wins.

**Nothing is configured for production.** An organisation with no thresholds
receives a `LOW_STOCK_THRESHOLD_NOT_CONFIGURED` alert rather than a comparison
against a number the software made up — because an organisation receiving no
low-stock alerts looks exactly like one that is well stocked.

**Question.** For each organisation in the pilot: at how many units of each
blood group (and component, where it matters) do you want to be told stock is
low?

**Why the answer is needed.** Without it, low-stock alerting does not run.
With a number chosen by us, it runs and means nothing.

**Allowed answer format.** Per organisation, either a single default, or a
table: `blood group | component (or "all") | alert below N units`.

**Dependent code.** `InventoryThreshold`; the Stock thresholds tab in the
blood-centre console; the hourly alert job in `inventory-cron.service.ts`.

**Risk if unanswered.** No shortage is detected at any pilot site.

**Answer**

- Thresholds: (attach table, per organisation)
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## OR-02 — Who may raise and lift a donor deferral

**What the system does now.** Blood-centre and hospital staff and
administrators, plus platform administrators, can raise a deferral against a
donor and lift one. Lifting requires a reason, which is recorded against the
deferral and in the audit log. Deferrals are never deleted. A donor can see
that they are deferred and until when, and has no route by which to lift it.

**Question.** Is that the right set of people at your site, or should lifting a
deferral be restricted further — to a named role, or to a clinician?

**Why the answer is needed.** Raising a deferral is the safe direction and
should be easy. Lifting one returns a donor to the pool and is the direction
that needs the control.

**Allowed answer format.** Either `Current roles are correct` or the roles that
may raise and the roles that may lift, stated separately.

**Dependent code.** `donor-deferrals.controller.ts` role lists;
`donor-deferrals.service.ts` (`assertStaffOf`).

**Risk if unanswered.** Anyone on shift can return a deferred donor to the pool.

**Answer**

- Raise: ______________________  Lift: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## OR-03 — Cold chain

**What the system does now.** Nothing. A unit records a storage location and
its movements between locations. No temperature is recorded, at rest or in
transit, and a shipment carries no cold-chain record.

**Question.** For the pilot, is the cold chain monitored and recorded entirely
outside this system, and is that acceptable to you and to your regulator?

**Why the answer is needed.** If it must be in the software, it is a subsystem:
temperature readings against units and shipments, excursion thresholds, and a
rule about what an excursion does to a unit's status — and that last part is a
clinical question that goes back to the laboratory pack.

**Allowed answer format.** Either `Cold chain is recorded outside the system`
with your signature, or a specification of what must be recorded.

**Dependent code.** None yet. `Shipment` and `InventoryMovement` are where it
would attach.

**Risk if unanswered.** Units are issued with no record that they were held at
temperature, and the software implies a completeness it does not have.

**Answer**

- Decision: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## OR-04 — Recall and look-back

**What the system does now.** Sprint 7 added a traceability endpoint that
returns the whole chain for one unit: donor, donation, unit, movements,
reservations, blood request, shipment, receiving organisation, and final
disposition. It answers "where did this unit go".

It does **not** answer the reverse: "this donor has been found reactive —
which units are affected, where are they now, and who received them". The
reverse query is mechanically possible from the same data, and no one has
specified what should happen when it returns something.

**Question.** What is the recall procedure at your site, and what should the
software do when a donor is found to be unsuitable after donating?

**Why the answer is needed.** The difference between "we can reconstruct it"
and "the system tells us and quarantines what is still in stock" is a sprint of
work and a policy decision about automatic status changes.

**Allowed answer format.** A description of the procedure, plus what the
software should do automatically (if anything) and what it should only report.

**Dependent code.** `getUnitTraceability` in `inventory.service.ts` is the
forward direction; the reverse does not exist.

**Risk if unanswered.** A recall is run by hand against the database.

**Answer**

- Procedure: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## OR-05 — What identifies the destination of an issued unit

**What the system does now.** Issuing a unit records a disposition: what
happened, when, and who recorded it, plus an **opaque** recipient reference —
a free-text string with no format imposed and no identity meaning attached.
The field is optional, and until Sprint 7 the same information was a suggestion
in the prose of a "reason" box.

The identity question itself is in the legal pack (LP-01); this one is
operational.

**Question.** In your operation, what is written on the form when a unit leaves
the fridge for a patient — a ward, a requisition number, a patient number,
something else? And is that the thing the software should record?

**Why the answer is needed.** It decides whether the opaque reference is enough
or whether a structured field is needed, and it constrains what LP-01 can
answer.

**Allowed answer format.** What the reference is, whether it is mandatory, and
an example with any identifying content removed.

**Dependent code.** `BloodUnitDisposition.recipientReference`; the issue dialog
in the blood-centre console.

**Risk if unanswered.** Issued units carry whatever staff type, so a look-back
cannot be run on it.

**Answer**

- Reference is: ______________________  Mandatory: ☐
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## OR-06 — What staff do when the system is unavailable

**What the system does now.** Nothing. There is no offline mode and no
documented fallback.

**Question.** What is the procedure when the software is unreachable mid-shift,
and how is the paper record reconciled afterwards?

**Why the answer is needed.** It will happen during the pilot. The answer will
be paper; what matters is that the paper and the reconciliation are written
down before rather than after.

**Allowed answer format.** A short written procedure, suitable for printing and
pinning up.

**Dependent code.** None. This is a runbook.

**Risk if unanswered.** An outage during a collection session is improvised.

**Answer**

- Procedure: (attach)
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## OR-07 — Session timeout on shared workstations

**What the system does now.** A signed-in console session refreshes silently
for as long as the platform's session timeout allows. There is no idle
timeout: a console left open on a shared workstation stays signed in.

**Question.** After how long idle should a console sign itself out on a shared
workstation?

**Why the answer is needed.** Donor health data is on these screens, and the
workstations are shared.

**Allowed answer format.** A number of minutes, or `No idle timeout required`
with your signature.

**Dependent code.** Platform settings; the three consoles' session handling.

**Risk if unanswered.** An unattended console shows donor records to whoever
walks past.

**Answer**

- Idle timeout: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

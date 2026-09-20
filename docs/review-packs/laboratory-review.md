# Laboratory review pack

**Reviewer:** blood-bank laboratory specialist
**Scope:** donation screening, what must be satisfied before a unit is
released, blood grouping of units, laboratory reference ranges.

This is the pack that unblocks the pilot. Until **LR-01** and **LR-02** are
answered, no blood unit in this system can be released into transfusable stock
in production — the software refuses, by design.

**No test, outcome or threshold is proposed anywhere in this document.**

---

## LR-01 — What must be satisfied before a unit is released

**What the system does now.** Since Sprint 7 there is an explicit clinical
release gate. A blood unit cannot become AVAILABLE — cannot be reserved,
issued or shipped — unless a release decision has been made for it under an
approved clinical release policy.

**There is no approved policy.** With none recorded, every release attempt is
refused with `CLINICAL_RELEASE_POLICY_NOT_CONFIGURED`, the refusal is written
to the unit's history, and the unit stays where it is. There is no override:
the gate does not read who is asking, a platform administrator gets the same
refusal as anyone else, and no force-release endpoint exists.

An approved policy that lists **no** requirements is also refused. An empty
requirement set is read as "nobody has said what must be tested", never as
"nothing must be tested".

**Question.** What must be true about a donation before a unit from it may be
released into transfusable stock?

For each requirement, please give:

1. a short code (`A–Z0–9_`, at most 80 characters) — this appears in refusal
   messages and in the release record;
2. a one-line description in operator language;
3. which component types it applies to, or "all";
4. what counts as satisfying it — the test, and which outcomes are acceptable.

**Why the answer is needed.** This is the whole content of the release gate.
The software holds the shape and refuses everything until the shape is filled.
Point 4 in particular determines whether a screening subsystem has to be built
before the pilot or whether an existing laboratory process can be recorded
against the unit some other way — see LR-02.

**Allowed answer format.** A table with those four columns, one row per
requirement. If the answer is "the laboratory's existing process, recorded as a
single sign-off", say so explicitly and LR-02 becomes the operative question.

**Dependent code.** `ClinicalReleasePolicy` and `ClinicalReleaseRequirement`
(both ship empty); `clinical-release.service.ts` (`unmetRequirements` is the
seam a screening subsystem plugs into); `inventory.service.ts` (`releaseUnit`,
`reserveUnit`, `issueUnit`); `shipments.service.ts` (request approval and
delivery).

**Risk if unanswered.** No unit can be released in production, so the pilot
cannot issue blood. The failure is safe and total — which is the correct
failure for a system that has not been told what it must test, and is also a
hard stop on the pilot.

**Answer**

- Requirements: (attach table)
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LR-02 — Where the evidence for a requirement comes from

**What the system does now.** Nothing satisfies a requirement. There is no
screening record against a donation anywhere in this repository. The laboratory
module that exists is **donor diagnostics** — a donor books a blood test, gets
results, sees them in the app — and its results key to appointments, not to
donations or to units. It is not blood-bank screening and must not be treated
as such.

So today, an approved policy with requirements refuses every unit with
`CLINICAL_RELEASE_REQUIREMENTS_NOT_MET` and a list of the codes that are
unsatisfied. That is honest rather than useful.

**Question.** For the pilot, how does the system learn that a requirement from
LR-01 has been satisfied? Which of these is right?

- **(a)** The system holds the screening results itself. A sample is recorded
  against a donation, tests are run and entered, outcomes are reviewed, and the
  gate reads them. This is a new subsystem — sample, test, outcome, review,
  confirmatory chain — and the vocabulary for outcomes is yours to name.
- **(b)** Screening stays entirely on the laboratory's existing process and
  paper. An authorized person records against the unit that a named requirement
  is met, with their identity and the time, and the gate reads that.
- **(c)** Something else, which you describe.

**Why the answer is needed.** (a) and (b) are different sprints. (a) is a
subsystem; (b) is a form and an audit record. Building (a) when the answer is
(b) delays the pilot for months; building (b) when the answer is (a) puts an
attestation where a result belongs.

**Allowed answer format.** `(a)`, `(b)` or `(c)` plus a paragraph. If (a), also
give the outcome vocabulary: the list of outcomes a screening test can have,
and which of them are acceptable for release. If (b), say who is entitled to
record the attestation.

**Dependent code.** `clinical-release.service.ts` (`unmetRequirements`);
whatever model holds the evidence, which does not exist yet.

**Risk if unanswered.** Engineering cannot start on the thing that gates the
pilot.

**Answer**

- Option: ______________________
- Detail: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LR-03 — Whether a unit's blood group must be typed from the unit

**What the system does now.** A blood unit's ABO/Rh is **copied**, at
collection, either from the donor's verified profile or from what the
collecting staff wrote down. It is not a result for the bag.

Since Sprint 7 the unit records which of those it was, in
`BloodUnit.bloodGroupSource`, and the console shows it per unit. The value
`UNIT_TYPED` exists in the model and **nothing sets it**, because per-unit
grouping does not exist as a workflow here.

**Question.** Must each unit be blood-grouped from the unit itself before
release, and must a group confirmation be recorded against the unit?

**Why the answer is needed.** If yes, this becomes a requirement under LR-01
and needs the workflow from LR-02(a). If no, the provenance column is the
honest record and nothing more is built.

**Allowed answer format.** Either `Donor-derived group is sufficient for the
pilot` or a specification of the grouping that must be performed and recorded.

**Dependent code.** `BloodUnit.bloodGroupSource`; `donations.service.ts` and
`emergency.service.ts` where units are created.

**Risk if unanswered.** A unit labelled with a donor's recorded group, where no
process has confirmed the bag matches the donor.

**Answer**

- Decision: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LR-04 — Re-entry from quarantine

**What the system does now.** Staff can quarantine a unit and can release it
again. Releasing from quarantine goes through the **same** clinical release
gate as a first release — same policy, same requirements, same refusal codes —
so a quarantined unit cannot be returned to stock by a route the gate does not
see.

**Question.** Is a single release gate correct for re-entry from quarantine, or
must a unit that has been quarantined satisfy something additional before it
returns to stock?

**Why the answer is needed.** Quarantine usually means something was wrong or
in doubt. If re-entry needs more than the original release did, the policy
model needs a second requirement set and the gate a second path.

**Allowed answer format.** Either `Same requirements` or a list of the
additional requirements, in the LR-01 format.

**Dependent code.** `inventory.service.ts` (`releaseUnit` accepts COLLECTED and
QUARANTINED alike).

**Risk if unanswered.** A unit quarantined for cause re-enters stock on the
same evidence that was already insufficient.

**Answer**

- Decision: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LR-05 — Laboratory reference ranges shown to donors

**What the system does now.** The donor diagnostics module stores reference
ranges per test parameter and flags each result against them — low, normal,
high. The seeded ranges are **development data**. They are shown to donors in
the mobile app as health information.

**Question.** Supply the correct reference ranges for each seeded test
parameter, with the population they apply to; or instruct that result flags be
hidden until ranges exist.

**Why the answer is needed.** A donor reading "high" or "low" against an
invented range is being given health information nobody checked.

**Allowed answer format.** A table: `parameter | unit | low | high | population
(sex / age band, or "all")`. Or the single instruction `Hide flags until
ranges are supplied`.

**Dependent code.** `TestReferenceRange`; the donor health screens.

**Risk if unanswered.** The app tells donors their results are abnormal on
development data.

**Answer**

- Ranges: (attach table) / Hide flags: ☐
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

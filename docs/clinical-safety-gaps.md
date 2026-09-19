# Clinical safety gap map

Three audits, run against the repository as it stands: the blood-unit release
path, the testing/TTI workflow, and the donor deferral model. Plus a survey of
where a real blood-bank team would still reach for paper.

**This document proposes no clinical rules and no test lists.** Where a
required value, threshold or test set would belong, it says so and stops. What
it does propose is *shape* — the smallest data model that could hold whatever
rule the clinical reviewers eventually specify.

---

## 1. Blood unit release safety audit

### 1.1 The actual path a unit takes

```
Donation COMPLETED                donations.service.ts:495-545
  │  (inside one transaction)
  ├─ BloodUnit created
  │     status      = COLLECTED           ← hard-coded
  │     bloodType   = donor profile        ← CD-010
  │     collectedAt = completion time
  │     expiresAt   = (not set)            ← CD-020
  │
  ├─ DonationEvent VERIFIED  { bloodTypeSource: 'VERIFIED_PROFILE' }
  └─ Donation.status = COMPLETED

COLLECTED ──release──► AVAILABLE           inventory.service.ts:214
            (no gate)

COLLECTED ──quarantine──► QUARANTINED ──release──► AVAILABLE
            (manual)                       (no gate)

AVAILABLE ──reserve──► RESERVED            inventory.service.ts:616
AVAILABLE ──issue────► USED                inventory.service.ts:399
RESERVED  ──issue────► USED
AVAILABLE ──discard──► DISCARDED
any       ──cron─────► EXPIRED             inventory-cron.service.ts
            (only if expiresAt is set)
```

### 1.2 What moves a unit to AVAILABLE

Exactly one thing: a person with BLOOD_CENTER_STAFF, BLOOD_CENTER_ADMIN or
SUPER_ADMIN in the owning organisation calling
`POST /organizations/:id/inventory/units/:unitId/release`.

The handler checks two conditions:

1. The unit's current status is COLLECTED or QUARANTINED.
2. `getAuthorizedUnit` confirms the unit belongs to the caller's organisation.

That is the complete gate.

### 1.3 Do laboratory or testing gates exist?

**No.** Searched for, and absent:

| Looked for | Found |
| --- | --- |
| A relation from `BloodUnit` to any result | none — `BloodUnit` has no `resultId`, `screeningId` or similar |
| A relation from `LaboratoryResult` to `Donation` or `BloodUnit` | none — it keys to `Appointment` only |
| A check on any test record inside `releaseUnit` | none |
| A screening/TTI model of any kind | none |
| A "required tests complete" predicate anywhere | none |

`BloodUnit.verifiedAt` / `verifiedBy` exist as columns and are **never written
by any code path** — they are unused scaffolding, not a gate.

### 1.4 Can staff bypass the gates?

There is nothing to bypass. The release is the gate, and it is a status check.

Worth stating precisely, because it is easy to over- or under-state:

- Tenant isolation **is** enforced — another organisation's staff cannot touch
  the unit (`getAuthorizedUnit`, covered by `inventory.e2e-spec.ts`).
- Race conditions **are** handled — the status transition is an atomic
  conditional `updateMany` inside a transaction, so two simultaneous releases
  cannot both succeed.
- Every transition **is** audited — `audit.log(...)` plus an `InventoryMovement`
  row carrying the actor, the organisation, the type and the reason.

So the release is authenticated, authorised, atomic and auditable. It is simply
not *clinically gated*.

### 1.5 Can a unit be issued before required checks?

Yes, trivially: collect → release → issue, three staff actions, no test data
involved at any point.

### 1.6 Audit trail

Good, and not the problem here:

- `InventoryMovement` per transition: unit, organisation, `MovementType`, actor,
  reason, from/to location, timestamp.
- `AuditLog` per action through `AuditLogsService`, with IP address.
- `DonationEvent` for the donation-side transitions.

The record of *who did what* is solid. What is missing is any record of *what
was tested*.

### 1.7 Roles per transition

| Transition | Roles permitted |
| --- | --- |
| COLLECTED → AVAILABLE (release) | SUPER_ADMIN, BLOOD_CENTER_ADMIN, BLOOD_CENTER_STAFF |
| → QUARANTINED | SUPER_ADMIN, BLOOD_CENTER_ADMIN, BLOOD_CENTER_STAFF |
| → DISCARDED | SUPER_ADMIN, BLOOD_CENTER_ADMIN, BLOOD_CENTER_STAFF |
| → USED (issue) | the above **plus** HOSPITAL_ADMIN, HOSPITAL_STAFF |
| → RESERVED | SUPER_ADMIN, BLOOD_CENTER_ADMIN, BLOOD_CENTER_STAFF |
| → EXPIRED | system cron only |

No role distinguishes a laboratory sign-off from routine stock handling. There
is a LAB_TECHNICIAN and a LAB_REVIEWER role in the system, and **neither has any
part in releasing a unit.**

### 1.8 Findings

| ID | Finding | Severity |
| --- | --- | --- |
| **BU-01** | A blood unit reaches transfusable stock with no testing gate of any kind. One staff member, one click. | **P0-PILOT** |
| **BU-02** | A unit is labelled with a blood group copied from the donor's profile, not from a test on the unit. | **P0-PILOT** |
| **BU-03** | Units are created with no expiry, so they never expire and the expiry job cannot see them. | **P0-PILOT** |
| **BU-04** | Issuing a unit records no recipient, so a unit cannot be traced to the patient who received it. | **P0-PILOT** |
| **BU-05** | `BloodUnit.verifiedAt` / `verifiedBy` are never written — dead columns that imply a verification step that does not exist. | P1 |
| **BU-06** | Quarantine can be entered and left by the same person with no second signature and no defined exit condition. | P1 |
| **BU-07** | LAB_TECHNICIAN and LAB_REVIEWER have no role in unit release despite existing. | P1 |

---

## 2. TTI / laboratory safety gap map

**No required test list is proposed here.** That is a national regulatory
matter for the clinical and legal reviewers.

### 2.1 What exists

| Capability | State | Where |
| --- | --- | --- |
| Test type catalogue | **Exists** — `TestType` with code, name, category, parameters, reference ranges | `TestType`, `TestParameter`, `TestReferenceRange` |
| Per-parameter results | **Exists** — value, numeric value, unit, range, flag, notes | `LaboratoryResultItem` |
| Result lifecycle | **Exists** — PENDING → ENTERED → REVIEWED → PUBLISHED | `LaboratoryResultStatus` |
| Performer, reviewer, publisher | **Exists** — each with a user and a timestamp | `LaboratoryResult` |
| Result versioning | **Exists** | `LaboratoryResultVersion` |
| Abnormal flagging | **Exists** — derived from the parameter's reference range | `deriveResultFlag` |
| Donor-visible results | **Exists** — published results appear on the donor's Health screen | mobile `(app)/health` |

That is a competent **donor diagnostics** service.

### 2.2 What does not exist

| Capability | State |
| --- | --- |
| Sample collection as an entity | **Missing.** No `Sample`. Nothing represents a tube drawn from a donation. |
| A result attached to a donation or unit | **Missing.** `LaboratoryResult.appointmentId` is `@unique`; there is no `donationId` or `bloodUnitId`. |
| Screening vs diagnostic distinction | **Missing.** `TestCategory` has no infectious-disease category and no "required for release" concept. |
| Reactive / non-reactive outcomes | **Missing.** `ResultFlag` is a numeric-range vocabulary (NORMAL/LOW/HIGH/CRITICAL/ABNORMAL). |
| Repeat-in-duplicate workflow | **Missing.** |
| Confirmatory testing linkage | **Missing.** No way to say "this confirmatory test resolves that initial reactive". |
| Automatic donor deferral on a result | **Missing.** Publishing a result changes nothing about the donor. |
| Automatic unit quarantine on a result | **Missing.** Publishing a result changes nothing about any unit. |
| A "required tests complete" gate before release | **Missing.** This is BU-01. |
| Look-back on a later positive | **Missing.** Requires BU-04 as well. |

### 2.3 The root architectural finding

**LAB-01 — the laboratory module is a donor-facing diagnostics service, not a
blood-bank screening laboratory.** It is keyed to appointments donors book for
themselves and publishes results to those donors. Donation screening is a
different workflow — the sample comes from a collection, not from a booking; the
subject of the result is the *unit*, not the donor's curiosity; the outcome
gates release rather than informing the donor.

Both are legitimate products. The system has one of them, and from the UI the
difference is invisible. **Severity: P0-PILOT** for any pilot that releases
units.

### 2.4 Proposed architecture — rule-configurable, no rules encoded

The shape, not the content. Every clinical value below stays external.

```
Donation ──1:N──► DonationSample
                    sampleReference
                    collectedAt, collectedBy
                    sampleType        (configurable vocabulary)
                    │
                    └──1:N──► ScreeningResult
                                testTypeId    → TestType
                                outcome       → ScreeningOutcome
                                performedAt / By
                                reviewedAt / By
                                runNumber     (1 = initial, 2+ = repeat)
                                supersededById (confirmatory chain)

BloodUnit ──N:1──► ReleaseDecision
                     decidedBy, decidedAt
                     outcome  (RELEASED | QUARANTINED | DISCARDED)
                     basis    → the ScreeningResult rows consulted
```

Two new vocabularies, both **empty until a clinician fills them**:

- `ScreeningOutcome` — the shape is an enum; its members (non-reactive,
  initially reactive, repeatedly reactive, confirmed positive, indeterminate,
  invalid) are for the laboratory specialist to name.
- `ReleaseRequirement` — a configuration table, not code: which `TestType` rows
  a given organisation and component type must have a satisfactory
  `ScreeningResult` for before release is permitted. **The rows are data. The
  repository ships it empty.**

The release gate then becomes one predicate:

> `releaseUnit` refuses unless, for every `ReleaseRequirement` matching this
> unit's organisation and component type, a `ScreeningResult` exists on a sample
> from this unit's donation whose outcome is in that requirement's accepted set.

With the requirement table empty, that predicate refuses everything — which is
the correct failure mode for a system that has not been told what it must test.
A deployment that genuinely wants no gate must say so explicitly by
configuration, and that is then an auditable decision rather than an absence.

**None of this is implemented.** It is a proposal for the sprint that follows
the clinical decision pack.

---

## 3. Donor deferral model audit

### 3.1 What exists

| Requirement | State | Detail |
| --- | --- | --- |
| Temporary deferral | **Partial** | `AssessmentDecision.DEFERRED` on one donation. Scoped to that donation; expresses no period. |
| Permanent deferral | **Partial** | `DonorStatus.DEFERRED` on the profile — a flag with no end date, so it is permanent until someone changes it. |
| Reason | **Partial** | `DonationAssessment.reasonCategory` (free-text `String?`) and `notes`. The profile flag carries no reason at all. |
| Start / end | **Missing** | Neither model has a period. |
| Who created it | **Partial** | `DonationAssessment.assessedBy`. The profile flag records no actor. |
| Audit trail | **Partial** | Profile changes reach `AuditLog`; there is no deferral history. |
| Effect on booking | **Missing** | `appointments.service.ts` never reads `donorStatus`. A deferred donor can book. |
| Effect on SOS matching | **Exists** | `emergency.service.ts:182` and `:337` both require `ACTIVE`. |

### 3.2 Findings

| ID | Finding | Severity |
| --- | --- | --- |
| **DEF-01** | Deferral is enforced for emergency matching and ignored for booking. Two subsystems, two answers, from one flag. | **P0-PILOT** |
| **DEF-02** | No deferral period. Every deferral is permanent until manually cleared, so staff cannot record "defer for 6 months". | P1 |
| **DEF-03** | The profile-level flag has no reason, no actor, no timestamp — nothing says why a donor was deferred or by whom. | P1 |
| **DEF-04** | Deferral history is not kept; the current flag overwrites whatever came before. | P1 |
| **DEF-05** | An assessment deferral does not propagate to the donor profile, so deferring a donor at the chair does not stop them booking tomorrow. | **P0-PILOT** |

### 3.3 Smallest safe model

```
DonorDeferral
  id
  donorId            → User
  kind               DeferralKind   (TEMPORARY | PERMANENT)
  reasonCode         String         ← configurable vocabulary, ships empty
  reasonNote         String?
  startsAt           DateTime
  endsAt             DateTime?      (null for permanent)
  createdBy          → User
  createdAt
  liftedBy           → User?
  liftedAt           DateTime?
  liftReason         String?
  sourceAssessmentId → DonationAssessment?   (when raised at the chair)
```

Plus one predicate, in the eligibility service beside the recovery window so
there is one place that answers "may this donor donate":

> `isDeferredAt(donorId, when)` — true when a `DonorDeferral` exists with
> `startsAt <= when` and (`endsAt` is null or `endsAt > when`) and `liftedAt` is
> null.

Called from the same three places the recovery window is called from: booking,
check-in, and emergency matching. `DonorProfile.donorStatus` then becomes
derived rather than authoritative.

**No clinical deferral reasons are proposed.** `reasonCode` points at a
configuration table the repository ships empty.

---

## 4. Operational blood bank gaps

Where a real blood-bank team would still need paper, Excel or a phone call.

### P0 — blocks a controlled pilot

| ID | Gap | Workaround today |
| --- | --- | --- |
| **OPS-01** | No screening record against a donation (LAB-01, BU-01). | Entire screening process on paper; release decided outside the system. |
| **OPS-02** | No recipient recorded on an issued unit (BU-04). | Transfusion register kept separately; look-back impossible from the software. |
| **OPS-03** | No unit expiry derived from component type (BU-03). | Expiry tracked by hand or by label; the expiry job is blind. |
| **OPS-04** | No cold-chain record for storage or transport (CD-071). | Temperature logs on paper; the software cannot evidence the chain. |
| **OPS-05** | Deferral not enforced at booking (DEF-01, DEF-05). | Staff must re-check every donor at the chair. |
| **OPS-06** | No donor identity document (CD-012). | Identity verified on paper at reception. |

### P1 — a pilot can proceed, but the team will feel it daily

| ID | Gap | Workaround today |
| --- | --- | --- |
| **OPS-10** | No component separation. One donation produces exactly one unit; you cannot split whole blood into red cells, plasma and platelets. `ComponentType` is a label on a unit that was never split. | Components tracked outside the system entirely. |
| **OPS-11** | No labelling or barcode support — no label format, no scanning anywhere. | Labels printed and read by a separate system. |
| **OPS-12** | Low-stock threshold is a hard-coded 5 for every organisation and group (CD-030). | Operators watch stock themselves; alerts are noise or silence. |
| **OPS-13** | No batch or lot concept for reagents and consumables. | Spreadsheet. |
| **OPS-14** | Inventory locations have no capacity, temperature range or equipment link. | Storage managed by knowing where things are. |
| **OPS-15** | No reconciliation when fewer units arrive than were shipped — the discrepancy is recorded, nothing follows it up (CD-072). | Phone call and a manual stock correction. |
| **OPS-16** | No stock transfer between organisations outside the request/shipment flow. | Request raised to model what was actually an internal move. |
| **OPS-17** | Nothing closes the loop from an approved request to the units actually transfused. | Two registers compared by hand. |

### P2 — real, but liveable

| ID | Gap |
| --- | --- |
| **OPS-20** | No donor-session scheduling for mobile collection drives (a campaign is content, not a collection event with slots and staff). |
| **OPS-21** | No staff rostering or chair capacity beyond the slot count. |
| **OPS-22** | No consumables stock. |
| **OPS-23** | No quality-control record for equipment or reagents. |
| **OPS-24** | No standard blood-bank reporting pack (issue rates, discard rates by reason, donor return rate). |
| **OPS-25** | No adverse-event register for donor reactions or transfusion reactions. |

---

## 5. What this means for the pilot

Nine P0-PILOT findings, in three clusters:

1. **The release gate does not exist** — BU-01, BU-02, BU-03, BU-04, LAB-01,
   OPS-01, OPS-02, OPS-03. A unit can go from a donor's arm into a patient with
   no test data anywhere in the record.
2. **Deferral is half-wired** — DEF-01, DEF-05, OPS-05. One flag, two
   subsystems, two different answers.
3. **Identity and traceability are incomplete** — CD-012, OPS-06, BU-04. A unit
   cannot be traced to an identified donor or to an identified recipient.

Cluster 1 needs the clinical decision pack before any engineering can begin —
the architecture in §2.4 is shaped to receive those decisions but must not be
built with guessed content.

Cluster 2 is engineering that can start now: the model in §3.3 encodes no
clinical rule, only the fact that deferrals have periods, reasons and actors.

Cluster 3 needs the legal review first (CD-012 is a regulatory question), then
schema work.

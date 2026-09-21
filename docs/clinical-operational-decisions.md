# Clinical and operational decision register

Every clinical, medical or operational assumption this repository currently
encodes, where it lives, and who has to sign it off before a real hospital or
blood centre uses it.

## How to read this

This is an **inventory of what the code does today**, not a proposal and not a
clinical guideline. Each row says what the software will actually do on a given
input, with a file reference you can check.

**Nothing here is marked VALIDATED.** That status is reserved for a decision
with evidence in this repository that a qualified reviewer approved it — a
signed review document, a cited standard, a regulator's requirement. No such
evidence exists yet for any row, so every row is PENDING or
DEVELOPMENT_DEFAULT. A value being sensible, conventional, or copied from a
textbook is not validation.

### Classification

| Code | Means |
| --- | --- |
| **TECHNICAL** | An engineering choice with no clinical content. |
| **PRODUCT** | A product decision the owner can make alone. |
| **CLINICAL** | Affects donor or recipient safety. Needs a clinician. |
| **LEGAL** | Governed by Uzbek law or regulation. Needs counsel. |
| **OPERATIONAL** | How a blood centre or hospital actually works day to day. |

### Validation status

| Code | Means |
| --- | --- |
| **VALIDATED** | Approved, with evidence in this repository. *(Currently: none.)* |
| **PENDING_CLINICAL** | Waiting on a transfusion or laboratory specialist. |
| **PENDING_LEGAL** | Waiting on legal/privacy counsel. |
| **PENDING_OPERATIONAL** | Waiting on a blood-centre or hospital operator. |
| **DEVELOPMENT_DEFAULT** | A value chosen to make the software run. No claim of correctness. |

---

## What has changed since this register was written

This register was written as a **Sprint 6 snapshot** and several of its rows
describe behaviour that no longer exists. A register that is three sprints out
of date is worse than an absent one, because people rely on it -- which is the
same mistake `docs/security.md` made about the audit trail, and which Sprint 9
spent itself correcting.

So every row that has changed now carries a **Changed since** bullet naming the
sprint and what it does today. The original wording is left in place rather than
rewritten: "this is what it used to do, and here is what it does now" is the
sentence a reviewer needs, and deleting the first half destroys it.

**Nothing has become VALIDATED.** Sprints 7, 9 and 10 changed what the software
does; none of them produced a signed clinical review, and no row below claims
one. Several rows moved from "the software does something unsafe" to "the
software refuses until somebody qualified answers a question", which is progress
of a different kind: the question is now visible and fatal rather than invisible
and permissive.

---

## A. Donor eligibility and recovery

### CD-001 — Post-donation recovery window is 56 days

- **Domain:** donation eligibility / cooldown
- **Behaviour:** After a donation reaches COMPLETED, the donor cannot book,
  be checked in for, or be matched to another donation until
  `completedAt + 56 days`. Staff may override per donation by setting
  `Donation.nextDonationDate`, which then wins over the default.
- **Encoded in:** `apps/api/src/modules/donation-eligibility/donation-eligibility.service.ts`
  (`defaultCooldownDays`); enforced at `appointments.service.ts:120` (booking),
  `:508` (reschedule), donation check-in, and `emergency.service.ts:208`.
- **Default / config:** `DONATION_COOLDOWN_DAYS`, default `56`.
- **Class:** CLINICAL
- **Status:** DEVELOPMENT_DEFAULT
- **Reviewer:** transfusion specialist
- **Risk if wrong:** Too short harms donors (iron depletion, anaemia). Too long
  needlessly shrinks the donor pool during shortages.
- **Engineering dependency:** None. One config value, already centralised.
- **Pilot without it?** **NO.** A number this consequential cannot ship as a
  development default.

### CD-002 — The recovery window is the same for everyone

- **Domain:** donation eligibility
- **Behaviour:** One interval regardless of donor sex, age, weight, donation
  type, or haemoglobin. Whole blood, plasma and platelet donations all open the
  same 56-day window.
- **Encoded in:** the absence of any other rule in
  `donation-eligibility.service.ts`.
- **Default / config:** n/a
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist
- **Risk if wrong:** Apheresis intervals are conventionally much shorter than
  whole-blood intervals; applying a whole-blood interval to plasma needlessly
  blocks donors, and the reverse would harm them.
- **Engineering dependency:** Needs an interval per donation type, and a donor
  attribute to vary on. Neither exists.
- **Pilot without it?** **NO** if the pilot collects anything but whole blood.
  Possibly YES for a whole-blood-only pilot under CD-001's answer.

### CD-003 — No annual donation limit

- **Domain:** donor suitability
- **Behaviour:** Nothing counts donations per year. A donor who clears the
  56-day window can donate indefinitely.
- **Encoded in:** absence.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist
- **Risk if wrong:** Cumulative donation load is a real donor-safety limit in
  most national programmes.
- **Engineering dependency:** Small — the donation history is already queryable.
- **Pilot without it?** Operator's call. The 56-day window caps the year at
  roughly six donations on its own.

### CD-004 — No age, weight or haemoglobin gate

- **Domain:** donor suitability / assessment
- **Behaviour:** `DonorProfile.dateOfBirth` is collected and used only for
  profile-completeness scoring (`donors.service.ts:166`). No minimum or maximum
  age is enforced anywhere. Weight and haemoglobin are not modelled at all.
  The pre-donation assessment records a free-text decision, not measurements.
- **Encoded in:** `DonationAssessment` (`decision`, `reasonCategory`, `notes`);
  no numeric fields exist.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist
- **Risk if wrong:** These are the standard pre-donation safety gates. The
  system currently relies entirely on staff judgement at the chairside, with no
  structured record of what was measured.
- **Engineering dependency:** Significant — needs measurement fields on the
  assessment and a rule engine to evaluate them.
- **Pilot without it?** **YES, with a stated caveat:** the software does not
  claim to perform donor screening, and the operator's existing paper process
  remains the control. This must be written into the pilot agreement.

### CD-005 — `DonorStatus.DEFERRED` is a flag that enforces nothing at booking

- **Domain:** deferral
- **Behaviour:** A donor profile can be set to DEFERRED. Emergency matching
  honours it (`emergency.service.ts:182`, `:337` filter on `ACTIVE`).
  **Appointment booking does not check it at all** — a deferred donor can book
  and attend a donation.
- **Encoded in:** `DonorStatus` enum; checked in `emergency.service.ts` only.
  `appointments.service.ts` calls only `assertEligibleToDonateAt`.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist + blood-centre operator
- **Risk if wrong:** A donor deferred for a medical reason can book a donation
  through the app. Staff would have to catch it at the chair.
- **Engineering dependency:** Small — one check in the booking path.
- **Pilot without it?** **NO.** This is an inconsistency, not a missing feature:
  one subsystem enforces the flag and another ignores it. See DEF-01 in
  `docs/clinical-safety-gaps.md`.
- **Changed since:** **Sprint 9** replaced the flag with `DonorDeferral` rows
  carrying a kind, a structured reason code, a period, an actor and a lift
  history, and made booking, reschedule and check-in consult them. **Sprint 10**
  folded that check, the recovery window and the new medical review into one
  canonical guard (`donor-availability.service.ts`) which booking, reschedule,
  check-in, donation start and emergency matching all call, so a fourth rule is
  one method to edit rather than five call sites to remember.
  `DonorProfile.donorStatus` survives as a cache that no gate reads.
  **Still open:** the deferral reason vocabulary ships empty, because no signed
  deferral schedule exists (see CD-081).

---

## B. Blood group and identity

### CD-010 — Blood group is taken from the donor's verified profile at completion

- **Domain:** blood type / Rh
- **Behaviour:** Completing a donation creates the BloodUnit with the blood
  group from `DonorProfile`, recording `bloodTypeSource: VERIFIED_PROFILE` in a
  `DonationEvent`. A donation cannot complete without a group on file.
- **Encoded in:** `donations.service.ts:518-545`.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist
- **Risk if wrong:** A unit is labelled from a profile field rather than from a
  grouping test performed on the collected unit. In a blood bank, the unit is
  typed from the unit.
- **Engineering dependency:** Needs a per-unit grouping result, which does not
  exist.
- **Pilot without it?** **NO** for any unit that will be transfused. See
  BU-02 in `docs/clinical-safety-gaps.md`.

### CD-011 — Blood group verification is a staff attestation, not a test result

- **Domain:** blood-type verification
- **Behaviour:** Staff set a donor's `verificationStatus` to VERIFIED and
  record a `VerificationSource` of BLOOD_CENTER, HOSPITAL, LABORATORY or
  OTHER_AUTHORIZED_SOURCE, plus a free-text note. No test result is attached.
- **Encoded in:** `donors.service.ts:189` (`verifyBloodType`), `VerificationSource` enum.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist + laboratory specialist
- **Risk if wrong:** The chain from "a laboratory typed this donor" to "this
  unit is labelled O+" is an unlinked human attestation.
- **Engineering dependency:** Medium.
- **Pilot without it?** Operator's call, given CD-010.

### CD-012 — No national identity requirement

- **Domain:** identity requirements
- **Behaviour:** Registration needs an email or a phone number. No passport,
  no national ID, no document number anywhere in the schema.
- **Encoded in:** `User`, `DonorProfile`.
- **Class:** LEGAL
- **Status:** PENDING_LEGAL
- **Reviewer:** legal/privacy specialist + blood-centre operator
- **Risk if wrong:** Uzbek blood-donation regulation may require identified
  donors. Donor traceability from a transfused unit back to a real person is
  also a look-back requirement in most jurisdictions.
- **Engineering dependency:** Medium — schema, UI, and a privacy assessment.
- **Pilot without it?** **NO** unless the operator identifies donors on paper
  and can map a unit reference back to a person by hand.

---

## C. Blood unit lifecycle

### CD-020 — A unit is created COLLECTED with no expiry date

- **Domain:** blood-unit lifecycle / expiry
- **Behaviour:** `bloodUnit.create` sets `status: COLLECTED`, `collectedAt`,
  and **leaves `expiresAt` null**. Nothing derives a shelf life from the
  component type. An expiry date exists only if staff type one in through the
  inventory adjust dialog.
- **Encoded in:** `donations.service.ts:518`; `expiresAt` is optional in
  `BloodUnit`.
- **Class:** CLINICAL
- **Status:** DEVELOPMENT_DEFAULT
- **Reviewer:** transfusion specialist + blood-centre operator
- **Risk if wrong:** A unit with no expiry never expires. The hourly expiry job
  (`inventory-cron.service.ts`) filters on `expiresAt`, so a null-expiry unit is
  invisible to it and can sit in AVAILABLE stock indefinitely.
- **Engineering dependency:** Small — a shelf life per component type, applied
  at creation. The value itself is clinical.
- **Pilot without it?** **NO.** See BU-03 in `docs/clinical-safety-gaps.md`.

### CD-021 — Any blood-centre staff member can move a unit from COLLECTED to AVAILABLE

- **Domain:** quarantine / release to AVAILABLE
- **Behaviour:** `POST .../units/:id/release` moves COLLECTED **or**
  QUARANTINED straight to AVAILABLE. The only conditions are the unit's current
  status and that the caller holds BLOOD_CENTER_STAFF, BLOOD_CENTER_ADMIN or
  SUPER_ADMIN in the owning organisation. **No test result, screening record or
  laboratory sign-off is consulted.**
- **Encoded in:** `inventory.service.ts:214` (`releaseUnit`);
  `inventory.controller.ts:67`.
- **Class:** CLINICAL
- **Status:** DEVELOPMENT_DEFAULT
- **Reviewer:** transfusion specialist + laboratory specialist
- **Risk if wrong:** **This is the single highest-risk finding in the
  repository.** Untested blood can be released into transfusable stock by one
  click from one staff member.
- **Engineering dependency:** Large — requires the screening subsystem that does
  not exist (see `docs/clinical-safety-gaps.md`, section TTI).
- **Pilot without it?** **NO.** See BU-01.
- **Changed since:** **Sprint 7** put a gate in front of this route: with no
  approved `ClinicalReleasePolicy`, every release is refused, and an approved
  policy listing nothing is refused too. **Sprint 10** filled the seam Sprint 7
  left open -- a requirement is satisfied only by a live screening result whose
  raw code the policy in force reads as CLEAR and which a second person has
  reviewed. There is still no role, flag or route that skips it.
  **Still open:** which requirements a policy must list. The repository ships
  none (see CD-080).

### CD-022 — Quarantine is a manual status with a free-text reason

- **Domain:** quarantine
- **Behaviour:** Staff move a unit to QUARANTINED with a typed reason. Nothing
  puts a unit into quarantine automatically, and nothing prevents the same
  person releasing it again a moment later.
- **Changed since:** **Sprint 9** added `BloodUnitHold`, which is deliberately
  NOT a status: a hold stands beside the lifecycle and every path that puts a
  unit into usable stock refuses while one is active. Resolving a hold writes
  `status = RESOLVED` on the hold row and nothing else -- it never releases the
  unit. **Sprint 10** closed the two remaining paths that took a held unit the
  other way, toward a patient: reserve and issue.
- **Encoded in:** `inventory.service.ts` (`quarantineUnit`), `releaseUnit`.
- **Class:** OPERATIONAL
- **Status:** PENDING_OPERATIONAL
- **Reviewer:** blood-centre operator
- **Risk if wrong:** Quarantine without a four-eyes rule or a defined exit
  condition is a label, not a control.
- **Engineering dependency:** Small to medium.
- **Pilot without it?** Operator's call.

### CD-023 — Issue accepts AVAILABLE or RESERVED, with a free-text reason

- **Domain:** issue / use
- **Behaviour:** `POST .../units/:id/issue` moves AVAILABLE or RESERVED to
  USED. Hospital staff as well as blood-centre staff may call it. The reason is
  free text; no patient identifier, crossmatch record or compatibility check is
  required or stored in a structured field.
- **Encoded in:** `inventory.service.ts:399`; `inventory.controller.ts:106`.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist + hospital operator
- **Risk if wrong:** No recipient is recorded against an issued unit, so a
  look-back from a recipient to a donor is impossible.
- **Engineering dependency:** Medium.
- **Pilot without it?** **NO** for transfusion. The traceability chain is broken
  at the last link.
- **Changed since:** **Sprint 9** closed the last link: `BloodUnitDisposition`
  records what finally happened to a unit, with an opaque, organisation-scoped
  recipient reference, so a look-back from a component to a donation and a
  traceback from a recipient's organisation both work. **Sprint 7** added
  `assertReleased`, so a unit with no release decision cannot be issued at all,
  and **Sprint 10** added the hold predicate to the issue claim — a component
  under an open recall or a declared temperature excursion no longer leaves the
  building. **Still open:** no crossmatch record and no compatibility check, and
  neither is proposed here (CD-060 owns the compatibility question).

### CD-024 — Discard is available to blood-centre staff with a typed reason

- **Domain:** discard
- **Behaviour:** One staff member can discard a unit permanently, giving a
  free-text reason. Confirmed in the UI (Sprint 5), recorded as an
  `InventoryMovement` with an actor.
- **Encoded in:** `inventory.service.ts` (`discardUnit`).
- **Class:** OPERATIONAL
- **Status:** PENDING_OPERATIONAL
- **Reviewer:** blood-centre operator
- **Risk if wrong:** Discard is auditable but not authorised by a second person.
- **Pilot without it?** **YES.** Auditable single-actor discard is common.

### CD-025 — Reservation has no expiry by default

- **Domain:** reservation
- **Behaviour:** A unit can be reserved with an optional `expiresAt`. The hourly
  job expires reservations that have one. A reservation created without one
  holds the unit until someone releases it.
- **Encoded in:** `inventory.service.ts:616`; `inventory-cron.service.ts:121`.
- **Class:** OPERATIONAL
- **Status:** PENDING_OPERATIONAL
- **Reviewer:** blood-centre operator
- **Risk if wrong:** Stock silently held out of circulation.
- **Pilot without it?** **YES**, with the reservations panel (Sprint 4) making
  holds visible.

---

## D. Inventory alerting

### CD-030 — Low stock is fewer than 5 units of a group

- **Domain:** inventory alerts
- **Behaviour:** An hourly job raises a LOW_STOCK alert per
  organisation/blood type/Rh when the AVAILABLE count is below 5.
- **Encoded in:** `inventory-cron.service.ts:8` (`LOW_STOCK_THRESHOLD = 5`).
- **Default / config:** Hard-coded constant; **not configurable**.
- **Class:** OPERATIONAL
- **Status:** DEVELOPMENT_DEFAULT
- **Reviewer:** blood-centre operator
- **Risk if wrong:** A threshold meaningful for a small centre is noise for a
  large one and silence for a critical group. Alert fatigue makes every other
  alert less likely to be read.
- **Engineering dependency:** Small — move to per-organisation configuration.
- **Pilot without it?** **YES** for a single-site pilot, if the operator agrees
  the number. **NO** for multi-site.

### CD-031 — "Expiring soon" is 72 hours

- **Domain:** inventory alerts
- **Behaviour:** An EXPIRING_SOON alert is raised for units expiring within 72
  hours. Units with no `expiresAt` are never included (see CD-020).
- **Encoded in:** `inventory-cron.service.ts:9` (`EXPIRING_SOON_WINDOW_HOURS = 72`).
- **Default / config:** Hard-coded; **not configurable**.
- **Class:** OPERATIONAL
- **Status:** DEVELOPMENT_DEFAULT
- **Reviewer:** blood-centre operator
- **Risk if wrong:** 72 hours is too late to move platelets and far too early
  for frozen plasma.
- **Pilot without it?** **YES**, with the operator's agreement.

### CD-032 — Alert severity: LOW_STOCK and EXPIRED are HIGH, EXPIRING_SOON is NORMAL

- **Domain:** inventory alerts
- **Behaviour:** As decided by the Product Owner in Sprint 5 §0.
- **Class:** PRODUCT
- **Status:** PENDING_OPERATIONAL *(the PO set it; the operator should confirm
  it matches how they triage)*
- **Pilot without it?** **YES.**

---

## E. Appointments

### CD-040 — An unattended appointment expires 24 hours after its slot

- **Domain:** appointment handling
- **Behaviour:** An hourly job moves PENDING or CONFIRMED appointments whose
  slot ended more than 24 hours ago to EXPIRED, releases the seat and reopens a
  FULL slot.
- **Encoded in:** `appointment-expiry.service.ts`.
- **Default / config:** `APPOINTMENT_EXPIRY_GRACE_HOURS`, default `24`.
- **Class:** OPERATIONAL
- **Status:** PENDING_OPERATIONAL *(PO confirmed the value in Sprint 5 §0;
  the operator has not.)*
- **Pilot without it?** **YES.**

### CD-041 — Reminders go out 24 hours ahead

- **Domain:** appointment handling
- **Default / config:** `APPOINTMENT_REMINDER_LEAD_MINUTES`, default `1440`.
- **Class:** PRODUCT
- **Status:** PENDING_OPERATIONAL
- **Pilot without it?** **YES.**

### CD-042 — A laboratory appointment opens no recovery window

- **Domain:** appointment handling / laboratory
- **Behaviour:** Only `BLOOD_DONATION` appointments consult the eligibility
  service. A `BLOOD_TEST` booking is explicitly exempt.
- **Encoded in:** `appointments.service.ts:118`.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist
- **Risk if wrong:** Low — a diagnostic blood draw is a few millilitres. Listed
  because it is a clinical judgement the code makes.
- **Pilot without it?** **YES.**

---

## F. Laboratory and testing

### CD-050 — The laboratory subsystem serves donor diagnostics, not donation screening

- **Domain:** laboratory testing / TTI
- **Behaviour:** `LaboratoryResult` is keyed one-to-one to an **Appointment**
  the donor booked for themselves. It has no relation to `Donation` or
  `BloodUnit`. A result is entered, reviewed and published to the donor. Nothing
  connects a result to the blood collected from that donor.
- **Encoded in:** `LaboratoryResult` (`appointmentId @unique`, `donorId`,
  `testTypeId`); no `donationId` or `bloodUnitId` field exists.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** laboratory specialist + transfusion specialist
- **Risk if wrong:** The product appears to have a laboratory. It does not have
  a *blood-bank screening* laboratory. These are different systems and the
  difference is invisible from the UI.
- **Engineering dependency:** Large. See `docs/clinical-safety-gaps.md`.
- **Pilot without it?** **NO** for releasing units. **YES** for the donor
  diagnostics feature on its own.

### CD-051 — Result flags are derived by numeric comparison to a per-parameter range

- **Domain:** reference ranges / abnormal flags
- **Behaviour:** When staff do not enter a flag, the API derives NORMAL, LOW or
  HIGH by comparing the numeric value to the parameter's own reference range.
  A range defined for the whole test type rather than the specific parameter is
  deliberately **not** used, and the item is flagged NOT_AVAILABLE instead.
- **Encoded in:** `laboratory.service.ts` (`deriveResultFlag`).
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** laboratory specialist
- **Risk if wrong:** Reference ranges vary by sex, age, method and analyser.
  The seeded ranges are development data.
- **Engineering dependency:** Small for the mechanism, large for the data.
- **Pilot without it?** **NO** if donors read the flags as clinical advice.

### CD-052 — There is no reactive, repeat or confirmatory concept

- **Domain:** TTI / infectious screening
- **Behaviour:** `ResultFlag` offers NORMAL, LOW, HIGH, CRITICAL, ABNORMAL,
  NOT_AVAILABLE. There is no REACTIVE/NON_REACTIVE, no repeat-in-duplicate
  workflow, no confirmatory-test linkage, and no automatic consequence for the
  donor or for any unit.
- **Encoded in:** `ResultFlag` enum; absence of everything else.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** laboratory specialist + transfusion specialist
- **Engineering dependency:** Large.
- **Pilot without it?** **NO** for unit release.
- **Changed since:** **Sprint 10** added a screening subsystem with a repeat
  concept (a newer result for a requirement supersedes an earlier attempt), a
  correction concept (`ScreeningResultRevision`, which never overwrites), and a
  normalised safety consequence (`SafetyDisposition`: CLEAR, BLOCK,
  REVIEW_REQUIRED). It deliberately added **no reactive/non-reactive vocabulary
  and no assay rules**: which markers exist and what any particular result means
  lives in `ScreeningDispositionRule` rows on an approved policy, and the
  repository ships without a single one. See CD-080 and CD-082.

### CD-053 — Seeded test types are haematology and chemistry, not screening

- **Domain:** laboratory testing
- **Behaviour:** The seed defines CBC, HEMOGLOBIN, HEMATOCRIT, RBC, WBC,
  PLATELETS, FERRITIN, BLOOD_GROUP, ABO, RH_FACTOR and similar.
  `TestCategory` has no infectious-disease category.
- **Encoded in:** `apps/api/prisma/seed.ts`; `TestCategory` enum.
- **Class:** CLINICAL
- **Status:** DEVELOPMENT_DEFAULT
- **Reviewer:** laboratory specialist
- **Note:** **This register deliberately does not propose a required test set.**
  That list is a national regulatory matter.
- **Pilot without it?** **NO** for unit release.

---

## G. Emergency matching

### CD-060 — The donor→recipient compatibility table

- **Domain:** compatibility
- **Behaviour:** A hard-coded map of which recipient groups each donor group may
  serve — O− to all eight, O+ to the four positives, AB+ to AB+ only, and so on.
  Used to pick candidate donors for an emergency.
- **Encoded in:** `emergency.service.ts:54` (`BLOOD_COMPATIBILITY`).
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist
- **Risk if wrong:** This is the classic ABO/Rh whole-blood compatibility table
  and it matches the textbook. It is nevertheless **unvalidated by a clinician
  in this repository**, it covers whole blood only (plasma compatibility is
  inverted), and it takes no account of antibody screening.
- **Engineering dependency:** None — one table.
- **Pilot without it?** **NO.** A clinician must sign this specific table.

### CD-061 — Emergency matching filters on active status and recovery window

- **Domain:** emergency donor matching
- **Behaviour:** Candidates must have `donorStatus: ACTIVE`, a compatible group,
  and be outside their recovery window. Exact-group matches are ranked ahead of
  merely compatible ones. Donors already engaged in another active emergency are
  skipped.
- **Encoded in:** `emergency.service.ts:331-420`.
- **Class:** CLINICAL + OPERATIONAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist + hospital operator
- **Pilot without it?** Depends on CD-060 and CD-001.

### CD-062 — An emergency donation opens the same recovery window

- **Domain:** emergency completion
- **Encoded in:** `emergency.service.ts:1000`.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist
- **Pilot without it?** Tied to CD-001.

### CD-063 — Donor location is retained for 72 hours

- **Domain:** location retention
- **Default / config:** `EMERGENCY_LOCATION_RETENTION_HOURS`, default `72`.
- **Class:** LEGAL
- **Status:** PENDING_LEGAL
- **Reviewer:** legal/privacy specialist
- **Risk if wrong:** Location data is sensitive personal data under most privacy
  regimes. The retention period must be defensible.
- **Pilot without it?** **NO** without a privacy review. See PR-01 in
  `docs/production-readiness.md`.

---

## H. Requests, shipment and storage

### CD-070 — Approval picks stock oldest-collected-first

- **Domain:** blood requests
- **Behaviour:** Approving a request reserves matching AVAILABLE units in
  ascending `collectedAt` order.
- **Encoded in:** `shipments.service.ts` approval path; asserted by
  `inventory-reservation.e2e-spec.ts`.
- **Class:** OPERATIONAL
- **Status:** PENDING_OPERATIONAL
- **Reviewer:** blood-centre operator
- **Risk if wrong:** FIFO is standard rotation, but expiry-first is what most
  blood banks actually run. With CD-020 leaving expiry null, expiry-first is not
  currently possible.
- **Pilot without it?** **YES.**

### CD-071 — No storage temperature, cold chain or transport condition is modelled

- **Domain:** storage / transport / cold chain
- **Behaviour:** `InventoryLocation` has a name, code and type. No temperature
  range, no monitoring, no excursion record. A shipment records a courier,
  timestamps and GPS points, but no temperature. Delivery confirmation records a
  free-text `condition`.
- **Encoded in:** `InventoryLocation`, `Shipment`, `ShipmentEvent`.
- **Class:** CLINICAL + OPERATIONAL
- **Status:** PENDING_OPERATIONAL
- **Reviewer:** blood-centre operator + transfusion specialist
- **Risk if wrong:** Cold-chain integrity is the main determinant of whether a
  transported unit is still transfusable. The system cannot evidence it.
- **Engineering dependency:** Large; device integration is explicitly out of
  scope this sprint.
- **Pilot without it?** **YES only** if the operator keeps the existing paper
  cold-chain record and the pilot agreement says the software does not replace
  it.

### CD-072 — Receiving confirmation accepts a short count with a typed reason

- **Domain:** receiving confirmation
- **Behaviour:** The hospital confirms delivery with `unitsReceived`, a
  condition, notes, and — when fewer units arrived than were shipped — a
  required discrepancy reason.
- **Encoded in:** `shipments.service.ts` (`confirmDelivery`);
  hospital shipment detail page.
- **Class:** OPERATIONAL
- **Status:** PENDING_OPERATIONAL
- **Reviewer:** hospital operator
- **Risk if wrong:** A short delivery is recorded but nothing reconciles the
  missing units back to the sending centre's stock.
- **Pilot without it?** **YES**, with manual reconciliation.

---

## J. Blood-bank screening, medical review, recall and hemovigilance

Added by Sprint 10. Every row here is a question the software now asks out loud
and refuses on, rather than one it used to answer by accident.

### CD-080 — No screening requirement, marker or assay rule is encoded

- **Domain:** donation screening
- **Behaviour:** A `ClinicalReleasePolicy` lists the requirements a component
  must satisfy before release, and `ScreeningDispositionRule` maps a
  laboratory's raw result code to CLEAR, BLOCK or REVIEW_REQUIRED for one
  requirement. **The repository ships zero of each.** With no rule, no result
  code means CLEAR, so no requirement can be satisfied and every release under
  an approved production policy is refused with an exact list of what is
  missing.
- **Encoded in:** `apps/api/src/modules/screening/screening-disposition.ts`
  (a pure function over rows, with no marker, assay, analyser or threshold named
  anywhere in it — asserted by its own spec);
  `ScreeningDispositionRule` in `apps/api/prisma/schema.prisma`.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist + laboratory specialist, against the
  Uzbek national requirement
- **Risk if wrong:** A rule set invented by this project would be a clinical
  claim nobody made, applied to every component it releases.
- **Engineering dependency:** None. The architecture accepts a signed rule set as
  data, with no migration and no code change.
- **Pilot without it?** **NO.** Without it the system refuses every release,
  which is safe and unusable.

### CD-081 — An unmapped result code requires a person and never satisfies anything

- **Domain:** donation screening
- **Behaviour:** A result code no rule in the approved policy describes resolves
  to REVIEW_REQUIRED with a **null** `dispositionPolicyVersion`, which is the
  marker that the system defaulted rather than being told. It never satisfies a
  release requirement, and it does **not** open a medical review on the donor.
- **Why not BLOCK:** BLOCK is an assertion that the result means the blood is
  unsafe. The software is not entitled to assert that about a code no approved
  policy describes, and doing so would be the donor-diagnosis-from-screening
  this sprint forbids. Safety does not turn on the choice, because neither
  satisfies a requirement.
- **Why no medical review:** with the rule table empty — how the repository
  ships — every donor who ever gave blood would be placed under medical review
  by their first result. A flag that fires on everything is a flag nobody reads.
  The component is refused either way; the donor is not accused of anything.
- **Encoded in:** `resolveDisposition`, `satisfiesRequirement` and
  `requiresDonorReview` in `screening-disposition.ts`.
- **Class:** PRODUCT (with a CLINICAL consequence)
- **Status:** PENDING_CLINICAL — the reasoning is engineering, the acceptance is
  not
- **Reviewer:** transfusion specialist
- **Pilot without it?** Acceptable as written, provided CD-080 is answered.

### CD-082 — The release gate re-derives meaning from the raw code, every time

- **Domain:** clinical release
- **Behaviour:** `ScreeningResult.disposition` records what the policy said when
  the result was entered and is never rewritten. The release gate does **not**
  read it: it takes the stored raw `resultCode` and asks the policy IN FORCE NOW
  what that code means. An unchanged rule gives the same answer, so an ordinary
  policy version bump breaks nothing; a changed rule is honoured immediately for
  anything not yet released.
- **Why:** if version 4 stops treating a code as clear, a component still in the
  fridge must not go out on version 3's answer — and the historical row must not
  be rewritten either, because it is evidence of what was known at the time.
  Components already released on the old answer are a recall question, which is
  what the recall path exists for.
- **Encoded in:** `ClinicalReleaseService.unmetRequirements`.
- **Class:** TECHNICAL (with a CLINICAL consequence)
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist
- **Pilot without it?** Acceptable as written.

### CD-083 — Entering a result is not reviewing it

- **Domain:** donation screening
- **Behaviour:** A result carries `performedBy`/`performedAt` and, separately,
  `reviewedBy`/`reviewedAt`. The performer cannot be the reviewer, whatever
  roles they hold. A policy with `requiresResultReview` (the default, including
  for every policy that existed before Sprint 10) does not treat an unreviewed
  result as satisfying anything. SUPER_ADMIN is refused: administering the
  platform is not clinical review.
- **Encoded in:** `screening-results.service.ts` (`reviewResult`),
  `ClinicalReleasePolicy.requiresResultReview`.
- **Class:** OPERATIONAL
- **Status:** PENDING_OPERATIONAL — whether a second person is required, and
  which role they hold, is a blood-centre's own SOP
- **Reviewer:** blood-centre operator
- **Pilot without it?** Acceptable as written; the requirement can be relaxed
  per policy if an operator signs that off.

### CD-084 — `MEDICAL_REVIEW_REQUIRED` is a safety hold, not a deferral or a diagnosis

- **Domain:** donor status
- **Behaviour:** A screening result the approved policy maps to BLOCK or
  REVIEW_REQUIRED opens a `DonorReviewTrigger` and moves the donor's cached
  status from ACTIVE to MEDICAL_REVIEW_REQUIRED. While it stands the donor
  cannot book, be checked in, start a donation, or be matched to an emergency.
  It creates **no** `DonorDeferral`, never becomes DEFERRED on its own, and is
  never permanent. Only an authorised clinician at the raising organisation can
  resolve it, and the only route to a deferral is that clinician choosing one
  and supplying a structured reason code. Resolving one review does not return
  the donor to ACTIVE while another review, or any deferral, still stands.
- **What the donor is told:** that a medical review is required before their next
  donation, and that staff can help. No disposition, no source, no count, no
  organisation, no diagnostic wording of any kind.
- **Encoded in:** `donor-review.service.ts`; `DonorStatus.MEDICAL_REVIEW_REQUIRED`.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist
- **Risk if wrong:** Too permissive and a donor with an unanswered question
  donates again. Too aggressive and donors are told, by implication, that
  something is wrong with them when nobody has decided that.
- **Pilot without it?** Acceptable as written. The semantics were set by the
  Product Owner and are enforced and tested, not described.

### CD-085 — A recall is a second axis, never a status rewrite

- **Domain:** recall
- **Behaviour:** Opening a recall records `statusAtRecall` as a snapshot, tracks
  what the recall did on its own `RecallComponentState` axis, and raises a
  `QUALITY_HOLD` on every component that is still retrievable. It never writes
  `BloodUnit.status`. A component that was transfused stays TRANSFUSED, and
  "transfused" is read from the disposition and never from
  `BloodUnitStatus.USED`, which a unit also reaches by being issued, shipped or
  discarded at a hospital. Closing a recall lifts nothing.
- **Why QUALITY_HOLD and not REACTIVE:** the hold kind reaches labels and
  consoles, and naming a clinical finding there would be a claim about the donor
  that nobody has made.
- **Encoded in:** `recall.service.ts`; `RecallComponentState`.
- **Class:** OPERATIONAL
- **Status:** PENDING_OPERATIONAL
- **Reviewer:** blood-centre operator + hospital operator
- **Still open:** what a receiving organisation is obliged to do on a recall, and
  in what time. The software records what they say they did; it does not require
  anything by a deadline, because no such obligation has been supplied.
- **Pilot without it?** Acceptable as written.

### CD-086 — No transfusion reaction is classified

- **Domain:** hemovigilance
- **Behaviour:** `HemovigilanceEvent.eventCode` is a reference into a vocabulary
  that ships **empty**. Nothing classifies, grades, or names a reaction, and
  nothing infers one from another. Reporting an event never un-transfuses a
  unit, returns it to stock, or changes its status.
- **Encoded in:** `hemovigilance.service.ts`; `HemovigilanceEvent`.
- **Class:** CLINICAL
- **Status:** PENDING_CLINICAL
- **Reviewer:** transfusion specialist, against the national hemovigilance
  scheme
- **Engineering dependency:** None. A validated vocabulary loads as data.
- **Pilot without it?** Acceptable for recording; **NO** for any claim that this
  constitutes hemovigilance reporting.

### CD-087 — Screening is not the laboratory module, deliberately

- **Domain:** donation screening vs donor diagnostics
- **Behaviour:** `ClinicalReleaseRequirement.screeningTestCode` is a plain
  string and is **deliberately not a foreign key to `TestType`**. The laboratory
  module is donor-facing diagnostics keyed to appointments (CD-050); blood-bank
  screening is keyed to a donation and decides whether a component may be
  released. The two vocabularies are kept apart so a donor's health check can
  never satisfy a blood-safety requirement.
- **Encoded in:** `schema.prisma` (the field, with the reasoning in its doc
  comment); separate `/screening` route and console tab.
- **Class:** TECHNICAL (with a CLINICAL consequence)
- **Status:** PENDING_CLINICAL
- **Reviewer:** laboratory specialist
- **Pilot without it?** Acceptable as written.

### CD-088 — A completed donation with no policy still completes, and says so

- **Domain:** donation completion
- **Behaviour:** Completing a donation raises a screening order against the
  policy in force. With no approved policy, or one that lists nothing, **no order
  is raised and the donation still completes** — and the skip is written to the
  audit log with its reason code and returned in the response.
- **Why:** the blood is already in the bag by the time this runs, and refusing
  to record a donation that physically happened would lose the only record of
  it. The opposite failure — an unscreened component reaching a patient — is
  prevented at the release gate, which refuses a component with no approved
  policy regardless of whether an order exists.
- **Encoded in:** `screening-orders.service.ts`
  (`raiseForDonationInTransaction`), `donations.service.ts` (`completeDonation`).
- **Class:** OPERATIONAL
- **Status:** PENDING_OPERATIONAL
- **Reviewer:** blood-centre operator
- **Pilot without it?** Acceptable as written.

---

## I. Summary

| Status | Count |
| --- | --- |
| VALIDATED | **0** |
| DEVELOPMENT_DEFAULT | 6 |
| PENDING_CLINICAL | 20 |
| PENDING_OPERATIONAL | 13 |
| PENDING_LEGAL | 2 |

**Decisions that block a controlled pilot outright (answer NO):**
CD-001, CD-002 *(if non-whole-blood)*, CD-010, CD-012, CD-020,
CD-051 *(if donor-visible)*, CD-053, CD-060, CD-063, CD-080,
CD-086 *(for any hemovigilance claim)*.

Three rows have left that list since Sprint 6, and it is worth being precise
about why, because none of them left because somebody validated it:

- **CD-005** (a deferral that stopped nobody booking) and **CD-021** (a unit
  reaching transfusable stock with no testing gate) were behaviour defects.
  Sprints 7, 9 and 10 replaced the behaviour. What remains of each is a
  question — the deferral vocabulary and the requirement list — and both are
  now fatal rather than permissive: with nothing recorded, the software refuses.
- **CD-023** and **CD-052** were partially superseded for the same reason, and
  their rows say what still stands.

**The one that now needs a decision before anything else can be scheduled is
CD-080**: the screening requirements and the rules mapping a laboratory's result
codes to a safety consequence. Every other release-path question is answered by
the architecture and refuses safely in the meantime; this is the one that makes
the system usable rather than merely safe. **CD-060** (the compatibility table
nobody has signed) is unchanged and remains the other blocker.

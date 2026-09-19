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

### CD-022 — Quarantine is a manual status with a free-text reason

- **Domain:** quarantine
- **Behaviour:** Staff move a unit to QUARANTINED with a typed reason. Nothing
  puts a unit into quarantine automatically, and nothing prevents the same
  person releasing it again a moment later.
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

## I. Summary

| Status | Count |
| --- | --- |
| VALIDATED | **0** |
| DEVELOPMENT_DEFAULT | 6 |
| PENDING_CLINICAL | 14 |
| PENDING_OPERATIONAL | 9 |
| PENDING_LEGAL | 2 |

**Decisions that block a controlled pilot outright (answer NO):**
CD-001, CD-002 *(if non-whole-blood)*, CD-005, CD-010, CD-012, CD-020, CD-021,
CD-023, CD-050, CD-051 *(if donor-visible)*, CD-052, CD-053, CD-060, CD-063.

The two that need a decision before anything else can be scheduled are
**CD-021** (a unit reaches transfusable stock with no testing gate) and
**CD-060** (the compatibility table nobody has signed).

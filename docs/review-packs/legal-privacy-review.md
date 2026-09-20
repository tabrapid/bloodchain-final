# Legal and privacy review pack

**Reviewer:** legal and privacy counsel, for Uzbekistan
**Scope:** identity, consent, retention, location data, regulatory status.

Each entry states what the software does today and asks one question. **No
legal position is proposed anywhere in this document**, and where a value is
currently a development default the entry says so.

---

## LP-01 — What identifies a transfusion recipient

**What the system does now.** When a unit is issued, the system records a
disposition with an **opaque** recipient reference: a free-text string, at most
120 characters, with no format imposed, no validation, and no identity meaning
attached. It is optional.

That is deliberate. Recording a national identity number, a passport number or
a patient name would be writing an identity policy into the schema, and nobody
has decided what that policy is. The field exists so the eventual answer is a
configuration and UI change rather than a migration; until then the traceability
chain reports `identityPolicy: UNDEFINED` rather than implying the question is
settled.

**Question.** What identifier may — or must — be recorded against a unit issued
for transfusion, under Uzbek law and under the data-protection rules that apply
to a blood service?

**Why the answer is needed.** Traceability from donor to recipient is what a
look-back needs, and it is usually a regulatory requirement. It is also the
single most sensitive field this system would hold.

**Allowed answer format.** The identifier, whether it is mandatory, the lawful
basis for holding it, how long it may be held, and who may read it.

**Dependent code.** `BloodUnitDisposition.recipientReference`;
`getUnitTraceability` in `inventory.service.ts`; the issue dialog in the
blood-centre console.

**Risk if unanswered.** Either a unit cannot be traced to the patient who
received it, or staff type identifying data into a field with no legal basis and
no retention rule. Both are live risks today.

**Answer**

- Identifier: ______________________  Mandatory: ☐
- Lawful basis: ______________________
- Retention: ______________________  Readable by: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LP-02 — National identity on a donor record

**What the system does now.** A donor record holds a name, a phone number, an
email address, a date of birth and a home region and district. It holds **no**
national identity number, and nothing in the software links a donor to a
government identity document.

**Question.** Does Uzbek regulation require a blood service to record a
national identity number (JSHSHIR or equivalent) against a donor, and if so,
with what basis and what retention?

**Why the answer is needed.** If it is required, it is a schema change, a
verification workflow and a new class of sensitive data. If it is not, the
absence is a deliberate privacy position and should be written down as one.

**Allowed answer format.** `Required` or `Not required`, with the citation, and
if required, the retention period and who may read it.

**Dependent code.** `DonorProfile`.

**Risk if unanswered.** The pilot runs without an identifier the regulator
expects, or adds one with no legal analysis.

**Answer**

- Position: ______________________
- Citation: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LP-03 — Donor location during an emergency journey

**What the system does now.** When a donor accepts an emergency and starts a
journey, the app can send their location, and authorized hospital staff can see
it for the duration of that journey. It is consent-based: a donor who has not
consented is not tracked, and their position contributes nothing to matching.

History is pruned after the response closes, on a retention period set by
`EMERGENCY_LOCATION_RETENTION_HOURS`. **That value is 72 and is a development
default.** It was chosen so the data outlives a debugging session. It is not a
legal retention period and has never been reviewed. Location for an active
journey is never pruned regardless of the value.

**Question.** What is the lawful basis for processing a donor's real-time
location, and for how long may the history be kept after the journey ends?

**Why the answer is needed.** This is precise location data about identified
citizens, and the number governing it was chosen for developer convenience.

**Allowed answer format.** The lawful basis, the retention period in hours or
days, and whether the current consent wording is sufficient (see LP-04).

**Dependent code.** `EMERGENCY_LOCATION_RETENTION_HOURS` in the API
environment; `EmergencyLocation`; the pruning job.

**Risk if unanswered.** Location data on identified people is retained on a
period nobody with standing has approved.

**Answer**

- Lawful basis: ______________________
- Retention: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LP-04 — Consent for processing donor health data

**What the system does now.** A donor consents to location sharing through a
single boolean on their profile. There is **no** consent record for processing
their health data — blood group, laboratory results, donation history — and
none for the AI health feature, which is informational and disabled by default.

**Question.** What must a donor be told, and what must they agree to, before
this system processes their health data? And separately, before the AI feature
uses it?

**Why the answer is needed.** Consent has to be captured, versioned and
evidenced. The software captures one boolean and no version.

**Allowed answer format.** The consent text for each purpose, whether consent
is the correct basis or another basis applies, and what must be recorded to
evidence it (text version, timestamp, method).

**Dependent code.** `DonorProfile.consentLocation` is the only consent field
that exists; a consent record model does not.

**Risk if unanswered.** Health data on thousands of people is processed with no
evidenced consent.

**Answer**

- Consent text: (attach)
- Basis: ______________________  Evidence required: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LP-05 — Retention, per class of data

**What the system does now.** Nothing is ever deleted except emergency location
history. Donation records, laboratory results, audit logs, notifications and
deferrals are kept indefinitely because no rule says otherwise.

Deferrals are a deliberate exception in the other direction: Sprint 7 made them
permanent history on purpose — lifting one sets a lift reason and actor rather
than deleting the row — so a retention rule for them is a decision, not an
oversight.

**Question.** What is the retention period for each class of data this system
holds: donor identity, donor health data, laboratory results, donation records,
deferral history, audit logs, notifications, emergency location?

**Why the answer is needed.** Retention is a per-class rule, and "we keep
everything" is a position that has to be taken deliberately rather than by
default.

**Allowed answer format.** A table: `data class | retention period | basis |
what happens at the end (delete / anonymise)`.

**Dependent code.** No retention machinery exists beyond the emergency location
pruning job.

**Risk if unanswered.** Indefinite retention of health data with no basis.

**Answer**

- Schedule: (attach table)
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LP-06 — Data-subject rights

**What the system does now.** Nothing. There is no export, no correction
workflow beyond a donor editing their own profile, and no erasure.

**Question.** What rights apply to a donor here — access, portability,
correction, erasure, objection — and what must the software provide to satisfy
them?

**Why the answer is needed.** Erasure in particular conflicts with traceability
and with the deferral history the clinical model deliberately keeps. That
conflict needs a legal answer, not an engineering one.

**Allowed answer format.** For each right: whether it applies, and what the
software must do. For erasure specifically: what may be erased and what must be
retained despite a request, with the basis.

**Dependent code.** None yet.

**Risk if unanswered.** A donor exercises a right the system cannot honour, or
the system honours one it should not.

**Answer**

- Rights: (attach)
- Erasure carve-outs: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LP-07 — Regulatory status of the software itself

**What the system does now.** It is unassessed. Nobody has established whether
software that holds blood-bank inventory and gates the release of blood
components requires registration, certification or approval in Uzbekistan.

**Question.** Does this software require registration, certification or
regulatory approval before it is used with real blood and real patients? If so,
what is the process and how long does it take?

**Why the answer is needed.** A certification requirement discovered after a
pilot has started stops the pilot.

**Allowed answer format.** `Required` or `Not required`, with the citation. If
required: the regime, the process, the expected duration.

**Dependent code.** None. This gates the pilot, not a file.

**Risk if unanswered.** The pilot begins without knowing whether it is lawful.

**Answer**

- Position: ______________________
- Citation: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LP-08 — Privacy policy and terms of service

**What the system does now.** Neither exists, in any language. Both app stores
require a privacy policy before submission, and the health-data declarations
depend on it.

**Question.** Please provide a privacy policy and terms of service in Uzbek,
Russian and English, covering the processing this system performs.

**Why the answer is needed.** No store submission is possible without them, and
no donor can meaningfully consent without them.

**Allowed answer format.** The documents, in three languages, with a version
and an effective date.

**Dependent code.** The mobile app and the three consoles need a link to each.

**Risk if unanswered.** No beta, no store listing, and no informed consent.

**Answer**

- Documents: (attach)  Version: __________  Effective: ____________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

---

## LP-09 — Who owns the data, and what happens when the pilot ends

**What the system does now.** Nothing is written down. There is no
data-processing agreement template for participating organisations and no
stated position on ownership or on what happens to the data afterwards.

**Question.** Who is the controller of the data in this system — each
participating organisation, the platform operator, or both jointly? What
agreement must be in place with each organisation before it joins? And what
happens to the data when the pilot ends?

**Why the answer is needed.** It has to be settled before the pilot rather than
after, and it determines what the platform operator may do with the data at all.

**Allowed answer format.** The controller position, a data-processing agreement
template, and an end-of-pilot disposition.

**Dependent code.** None. This gates onboarding.

**Risk if unanswered.** Real donor data is collected with no agreement about
who owns it or what becomes of it.

**Answer**

- Controller: ______________________
- Agreement: (attach)  End-of-pilot: ______________________
- Reviewer: ______________________  Date: ____________
- Signature: ______________________

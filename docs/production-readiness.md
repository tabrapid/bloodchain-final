# Production readiness register

Everything between this repository and a real deployment, with severity, owner,
current state, and what each item blocks.

## Gates

Four, in order. An item blocks the earliest gate it is marked against, and
everything after it.

| Gate | Means |
| --- | --- |
| **QA** | Internal QA on real devices and browsers, against demo data, by our own team. |
| **PILOT** | A controlled pilot: one hospital, one blood centre, real staff, real donors, real blood. |
| **BETA** | A public store beta: the donor app on TestFlight / Play internal testing. |
| **PROD** | General production rollout. |

## Severity

- **P0** — blocks its gate outright. No workaround.
- **P1** — blocks its gate unless the operator accepts a documented manual
  workaround in writing.
- **P2** — does not block; should be scheduled.

## Owners

`PO` product owner · `ENG` engineering · `CLIN` transfusion/laboratory
specialist · `OPS` blood-centre or hospital operator · `LEGAL` legal and privacy
counsel · `INFRA` whoever will run the servers

## Class

Added after Sprint 7, because "confirmed in code" was being read as "engineering
has not done it yet" for items where engineering had done everything it is
entitled to do. Each blocker is now classed by *what kind of work remains*.

| Class | Means |
| --- | --- |
| **ENG-CLOSED** | Engineering is finished. Nothing further is owed by this repository. |
| **REVIEWER** | Waiting on a named person's decision. A reviewer pack entry asks the question. |
| **INFRA** | Ordinary infrastructure work that has not been started. |
| **STORE** | Apple or Google submission work. |

A **REVIEWER** item is not blocked on engineering and cannot be unblocked by
it. Where the engineering half of a previously-mixed item is done, the row says
so and names the pack entry that carries what is left.

The four packs live in [`review-packs/`](review-packs/).

---

## A. Clinical

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **CL-01** | A blood unit reaches transfusable stock with no testing gate. *(BU-01, CD-021)* | P0 | REVIEWER | CLIN | **Gate built (S7).** With no approved policy, every release is refused `CLINICAL_RELEASE_POLICY_NOT_CONFIGURED`; an approved policy listing nothing is refused too. No override, no force-release route | Laboratory specialist answers `laboratory-review.md` LR-01: what must be satisfied before release | PILOT |
| **CL-02** | The laboratory module is donor diagnostics, not donation screening. Nothing can satisfy a release requirement. *(LAB-01, CD-050)* | P0 | REVIEWER | CLIN → ENG | Unchanged. `clinical-release.service.ts` has the seam a screening subsystem plugs into and returns every requirement as unmet | LR-02 decides whether screening lives in the system or stays on paper with an attestation. The two are different sprints | PILOT |
| **CL-03** | A unit cannot be traced to the patient who received it. *(BU-04, CD-023)* | P0 | REVIEWER | LEGAL + OPS | **Half closed (S7).** Issuing writes a `BloodUnitDisposition` with an opaque recipient reference; traceability endpoint returns donor → … → disposition and reports `identityPolicy: UNDEFINED` | `legal-privacy-review.md` LP-01 decides what may identify a recipient; `blood-center-operations-review.md` OR-05 says what staff actually write | PILOT |
| **CL-04** | Units are created with no expiry. *(BU-03, CD-020)* | P0 | REVIEWER | CLIN | **Model closed (S7).** Known vs unknown expiry with provenance; the release gate **refuses** a unit whose shelf life is unknown rather than guessing | `clinical-review.md` CR-08: shelf life per component. Until then no unit can be released in production | PILOT |
| **CL-05** | A unit's blood group is copied from the donor rather than typed from the unit. *(BU-02, CD-010)* | P0 | REVIEWER | CLIN | **Made visible (S7).** `BloodUnit.bloodGroupSource` records which it was; the console shows it per unit; `UNIT_TYPED` exists and nothing sets it | `laboratory-review.md` LR-03: is a donor-derived group sufficient for the pilot | PILOT |
| **CL-06** | Deferral is enforced for emergency matching and ignored at booking. *(DEF-01, DEF-05, CD-005)* | — | **ENG-CLOSED** | ENG | **Closed (S7).** `DonorDeferral` keeps kind, reason, period, actor and lift as permanent history; one predicate gates booking, check-in and SOS matching; an assessment recorded as DEFERRED raises a deferral in the same transaction | None. Proved by `clinical-safety.e2e-spec.ts` tests 7–10 | — |
| **CL-07** | The 56-day recovery window is a development default nobody has signed. *(CD-001)* | P0 | REVIEWER | CLIN | `DONATION_COOLDOWN_DAYS=56` | `clinical-review.md` CR-01. One config value; no code change | PILOT |
| **CL-08** | The donor→recipient compatibility table is unsigned, whole-blood only. *(CD-060)* | P0 | REVIEWER | CLIN | Hard-coded in `emergency.service.ts` | `clinical-review.md` CR-07: confirm the table row by row, or replace it | PILOT |
| **CL-09** | No age, weight or haemoglobin gate; assessment records a decision, not measurements. *(CD-004)* | P1 | REVIEWER | CLIN + OPS | Unchanged | `clinical-review.md` CR-06: does paper screening remain the control | PILOT |
| **CL-10** | Reference ranges and result flags are development data shown to donors as health information. *(CD-051)* | P1 | REVIEWER | CLIN | Seeded ranges | `laboratory-review.md` LR-05: supply ranges, or hide the flags | BETA |
| **CL-11** | 106 clinical terms in three languages, none signed off. | P1 | REVIEWER | CLIN | `docs/clinical-review.md`, 106 PENDING | `clinical-review.md` CR-10 | BETA |
| **CL-12** | One recovery interval for every donation type. *(CD-002)* | P1 | REVIEWER | CLIN | Unchanged | `clinical-review.md` CR-02. Only blocks a pilot collecting anything but whole blood | PILOT |
| **CL-13** | No annual donation limit. *(CD-003)* | P2 | REVIEWER | CLIN | Unchanged | `clinical-review.md` CR-03 | PROD |
| **CL-14** | No adverse-event register for donor or transfusion reactions. *(OPS-25)* | P1 | REVIEWER | OPS + CLIN | Absent | `clinical-review.md` CR-09 | PILOT |
| **CL-15** | The deferral reason vocabulary ships empty, so every deferral reason is free text. | P1 | REVIEWER | CLIN | **New (S7).** By design: proposing deferral reasons would be writing clinical rules | `clinical-review.md` CR-04: the programme's reason list | PILOT |
| **CL-16** | Whether a deferral raised at the chair should be indefinite is undecided. | P1 | REVIEWER | CLIN | **New (S7).** Indefinite, because nothing knows how long any deferral should last. Errs towards keeping a donor out | `clinical-review.md` CR-05 | PILOT |
| **CL-17** | Re-entry from quarantine uses the same release requirements as a first release. | P1 | REVIEWER | CLIN | **New (S7).** One gate, both paths — so a quarantined unit cannot return to stock by a route the gate does not see | `laboratory-review.md` LR-04: does re-entry need more | PILOT |
| **CL-18** | No cold-chain record, at rest or in transit. | P1 | REVIEWER | OPS | Absent | `blood-center-operations-review.md` OR-03 | PILOT |
| **CL-19** | No reverse look-back: "this donor is unsuitable — which units are affected". | P1 | REVIEWER | OPS + CLIN | **Forward direction built (S7).** The traceability endpoint answers where a unit went; the reverse query is mechanically possible and unspecified | `blood-center-operations-review.md` OR-04 | PILOT |

## B. Legal and privacy

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **PR-01** | Donor location retained 72 hours with no privacy assessment. *(CD-063)* | P0 | REVIEWER | LEGAL | `EMERGENCY_LOCATION_RETENTION_HOURS=72`, a development default | `legal-privacy-review.md` LP-03 | PILOT |
| **PR-02** | No national identity on a donor record. *(CD-012, OPS-06)* | P0 | REVIEWER | LEGAL + OPS | Unchanged | `legal-privacy-review.md` LP-02 | PILOT |
| **PR-03** | No data-retention policy for donor health data, laboratory results or audit logs. | P0 | REVIEWER | LEGAL | Nothing is deleted except emergency locations. Deferral history is permanent *by design* since S7, which is itself a retention decision to take | `legal-privacy-review.md` LP-05 | PILOT |
| **PR-04** | No donor consent record for processing health data, or for the AI feature. | P0 | REVIEWER | LEGAL + PO | Absent | `legal-privacy-review.md` LP-04 | PILOT |
| **PR-05** | No data-subject rights implementation — export, correction, erasure. | P1 | REVIEWER | LEGAL + ENG | Absent. Erasure conflicts with traceability and with permanent deferral history | `legal-privacy-review.md` LP-06, which has to state the carve-outs | BETA |
| **PR-06** | No data-processing agreement template for participating organisations. | P1 | REVIEWER | LEGAL | Absent | `legal-privacy-review.md` LP-09 | PILOT |
| **PR-07** | Uzbek regulatory approval for operating blood-bank software is unassessed. | P0 | REVIEWER | LEGAL | Unknown | `legal-privacy-review.md` LP-07 | PILOT |
| **PR-08** | Privacy policy and terms of service do not exist in any language. | P0 | REVIEWER | LEGAL + PO | Absent | `legal-privacy-review.md` LP-08 | BETA |

## C. Infrastructure

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **IN-01** | No production environment. Everything runs locally against a local Postgres. | P0 | INFRA | INFRA | Absent | Choose hosting; provision API, database, three web apps | PILOT |
| **IN-02** | No TLS, no domain, no certificate management. | P0 | INFRA | INFRA | Absent | Domains and certificates | PILOT |
| **IN-03** | Secrets are in `.env` files with development values, including JWT secrets. | P0 | INFRA | INFRA | `apps/api/.env` | A secret manager; rotate everything before the first real deployment | PILOT |
| **IN-04** | No CI pipeline. Every gate is run by hand. | P1 | INFRA | ENG | Every gate passes locally, and since S7 `verify:safety` and `demo:verify` are repeatable with no reset between them — so they can run unattended | Wire typecheck, lint, test, e2e, `verify:*` and `verify:e2e-isolation` into CI | QA |
| **IN-05** | No migration strategy for a live database — migrations are applied by hand. | P0 | INFRA | ENG + INFRA | `prisma migrate deploy` run manually | A deployment runbook with a rollback path | PILOT |
| **IN-06** | Rate limiting is in-process, so it resets on restart and does not span instances. | P1 | INFRA | ENG | `ThrottlerModule`, in memory | Shared store, or accept single-instance for the pilot | PILOT |
| **IN-07** | No load or capacity testing at any scale. | P1 | INFRA | ENG | Never run | Establish the pilot's expected volume, then test to it | PILOT |
| **IN-08** | No staging environment that mirrors production. | P1 | INFRA | INFRA | Absent | Provision alongside IN-01 | PILOT |

## D. Messaging

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **MS-01** | No SMS vendor. OTP and emergency alerts have a provider abstraction and no provider behind it. | P0 | INFRA | PO + INFRA | Abstraction exists; development logs the code | Select an Uzbek SMS provider, contract, integrate | PILOT |
| **MS-02** | Email is a local catcher (MailHog). No production SMTP, no sender domain, no SPF/DKIM/DMARC. | P0 | INFRA | INFRA | Local only | Transactional email provider and domain authentication | PILOT |
| **MS-03** | Push notifications use Expo's service with no production credentials. | P1 | INFRA | ENG + INFRA | Expo push, development | FCM and APNs credentials | BETA |
| **MS-04** | No delivery monitoring — a failed OTP or emergency alert is invisible. | P1 | INFRA | ENG | Failures log only | Delivery status tracking and alerting | PILOT |
| **MS-05** | No production job queue; scheduled work runs on `@nestjs/schedule` in-process. | P1 | INFRA | ENG | In-process cron | Only blocks multi-instance deployment | PROD |

## E. Data and geography

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **DG-01** | Geography is demo data, not authoritative SOATO. | P1 | REVIEWER | PO + OPS | 14 regions seeded as demo; `verify:geography` treats real data separately | Obtain SOATO; import as reference data | PILOT |
| **DG-02** | All 22 seeded organisations are `isDemo: true`. No real organisation exists. | P0 | REVIEWER | PO + OPS | By design since the demo freeze | Onboard the pilot organisations as real records | PILOT |
| **DG-03** | No production backup or restore procedure. | P0 | INFRA | INFRA | Absent | Backup schedule, retention, and a *tested* restore | PILOT |
| **DG-04** | No seed path for a production deployment — `prisma/seed.ts` is demo data and guarded to local databases. | P1 | INFRA | ENG | Local only by guard | A reference-data-only seed: roles, permissions, test types, geography | PILOT |
| **DG-05** | No low-stock threshold is configured for any organisation, so no shortage can be detected. | P1 | REVIEWER | OPS | **New (S7).** `LOW_STOCK_THRESHOLD = 5` is gone; thresholds are per organisation, blood group and component. Production with nothing configured raises `LOW_STOCK_THRESHOLD_NOT_CONFIGURED` rather than inventing a number | `blood-center-operations-review.md` OR-01: each pilot site's own numbers | PILOT |
| **DG-06** | No clinical release policy exists for any organisation, so no unit can be released in production. | P0 | REVIEWER | CLIN | **New (S7).** The policy tables ship empty and the repository seeds only a development stand-in, which is refused in production and is created only by a seed guarded to local databases | `laboratory-review.md` LR-01 and LR-02 | PILOT |

## F. Mobile release

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **MB-01** | No app has been run on a physical device in this workstream. | P0 | INFRA | ENG | Headless environment throughout | Work `docs/production-ui-qa.md` on real hardware | QA |
| **MB-02** | No build configuration for release — no EAS profile, no signing, no bundle identifiers. | P0 | STORE | ENG | Development only | Configure release builds | BETA |
| **MB-03** | No crash or error reporting in the mobile app. | P1 | INFRA | ENG | Absent | Sentry or equivalent | BETA |
| **MB-04** | No app icon, splash screen or store assets at release quality. | P1 | STORE | PO + design | Development placeholders | Produce assets | BETA |
| **MB-05** | Deep links are unverified on a device — universal links and app links are unconfigured. | P1 | STORE | ENG | Routes exist | Configure and test on hardware | BETA |
| **MB-06** | Expo SDK 52 with React Native 0.76; upgrade cadence unplanned. | P2 | INFRA | ENG | Current | Out of scope by instruction | PROD |

## G. Web deployment

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **WB-01** | The three consoles have never been opened in a browser in this workstream. | P0 | INFRA | ENG | Production builds pass; nothing rendered | Work `docs/production-ui-qa.md` in a real browser | QA |
| **WB-02** | No hosting, domain or deployment pipeline for the three apps. | P0 | INFRA | INFRA | Absent | Provision with IN-01 | PILOT |
| **WB-03** | No browser support matrix, and no testing outside the one assumed engine. | P1 | REVIEWER | PO + ENG | Unstated | Declare supported browsers; test them | PILOT |
| **WB-04** | No security headers configured — CSP, HSTS, frame options. | P1 | INFRA | INFRA | Absent | Configure at the edge | PILOT |
| **WB-05** | No session timeout in the consoles beyond token expiry. | P1 | REVIEWER | ENG + OPS | 15-minute access token, refreshed silently | Operator states an idle timeout for shared workstations | PILOT |

## H. Monitoring and backup

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **MO-01** | No uptime monitoring or alerting on any service. | P0 | INFRA | INFRA | Absent | Health checks and on-call alerting | PILOT |
| **MO-02** | No centralised logging; logs go to stdout and are lost. | P0 | INFRA | INFRA | Absent | Log aggregation with retention | PILOT |
| **MO-03** | No error tracking on the API or the consoles. | P1 | INFRA | ENG | Absent | Sentry or equivalent | PILOT |
| **MO-04** | Database backups do not exist (DG-03), and no restore has ever been rehearsed. | P0 | INFRA | INFRA | Absent | Automate, then *restore from a backup* to prove it | PILOT |
| **MO-05** | No metrics or dashboards — no visibility of request rates, latency or job failures. | P1 | INFRA | INFRA | `/health` exists | Metrics and dashboards | PILOT |
| **MO-06** | No incident process: no on-call, no escalation, no runbook. | P0 | INFRA | PO + INFRA | Absent | Define before real blood depends on it | PILOT |

## I. Store compliance

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **ST-01** | No developer accounts for Apple or Google. | P0 | STORE | PO | Absent | Register; Apple's review of health apps is slow | BETA |
| **ST-02** | Health-data declarations and privacy nutrition labels not prepared. | P0 | STORE | PO + LEGAL | Absent | Requires PR-04 and PR-08 first | BETA |
| **ST-03** | Store listings do not exist in any language. | P1 | STORE | PO | Absent | Write for uz/ru/en | BETA |
| **ST-04** | An app handling health data may need extra review or an entity verification. | P1 | STORE | PO + LEGAL | Unassessed | Check both stores' current rules | BETA |
| **ST-05** | Location permission usage strings are not written for review. | P1 | STORE | ENG + PO | Default strings | Write a justification both stores will accept | BETA |

## J. Institutional onboarding

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **IO-01** | No pilot agreement, and nothing written down about what the software does and does not do clinically. | P0 | REVIEWER | PO + LEGAL | Absent | Draft, naming CL-01 to CL-09 explicitly as operator responsibilities | PILOT |
| **IO-02** | No training material for blood-centre or hospital staff. | P0 | REVIEWER | PO + OPS | Absent | Write against the real workflows | PILOT |
| **IO-03** | No onboarding process for a real organisation — creating it, its locations, its staff and their roles. | P1 | INFRA | ENG + PO | Admin console can do it; no procedure exists | Write the runbook | PILOT |
| **IO-04** | No support channel for staff who hit a problem mid-shift. | P0 | REVIEWER | PO | Absent | Define, staff it, publish it | PILOT |
| **IO-05** | No procedure for what staff do when the system is unavailable. | P0 | REVIEWER | OPS + PO | Absent | Write the fallback; it will be paper | PILOT |
| **IO-06** | No agreement on who owns the data, or what happens to it when the pilot ends. | P0 | REVIEWER | LEGAL + PO | Absent | Settle before the pilot, not after | PILOT |

---

## Summary by gate

Counted from the tables above. CL-06 is excluded: it is closed and carries no
severity.

| Gate | P0 | P1 | P2 |
| --- | --- | --- | --- |
| **QA** | 2 | 1 | 0 |
| **PILOT** | 31 | 22 | 0 |
| **BETA** | 4 | 10 | 0 |
| **PROD** | 0 | 1 | 2 |

## Summary by class

| Class | Count |
| --- | --- |
| **ENG-CLOSED** | 1 |
| **REVIEWER** | 37 |
| **INFRA** | 28 |
| **STORE** | 8 |

## What Sprint 7 changed

The pilot P0 count went from 30 to 31, and that is the honest number. One item
closed and one appeared, and three more were added at P1.

**Closed.** CL-06 — donor deferral. There is now a real deferral domain: kind,
reason, period, actor and lift kept as permanent history, one predicate gating
booking, check-in and emergency matching, and an assessment recorded as
DEFERRED raising a deferral in the same transaction. Nothing clinical was
invented to do it, and nothing further is owed by engineering. The reason
vocabulary it reads is a reviewer question (CL-15).

**Appeared.** DG-06 — no clinical release policy exists, so no unit can be
released in production. This is not a regression. Before Sprint 7 a unit
reached transfusable stock on one click with no gate at all, and the register
recorded that as CL-01. The gate now exists and fails closed, which turns a
silent hazard into a visible, blocking, *correct* refusal. A pilot cannot issue
blood until a clinician fills the policy in — which was always true and is now
enforced rather than hoped for.

**Reclassified, not fixed.** CL-01, CL-03, CL-04 and CL-05 keep their severity
and lose their engineering half:

- **CL-01** — the gate is built, has no override and no force-release route,
  and refuses an empty requirement set as firmly as a missing policy. What
  remains is LR-01: what must be satisfied.
- **CL-03** — issuing a unit now writes a structured disposition, and one
  endpoint returns the chain from donor to final disposition. What remains is
  LP-01: what may identify a recipient. The chain reports
  `identityPolicy: UNDEFINED` rather than implying the question is settled.
- **CL-04** — expiry is known-or-unknown with recorded provenance, and an
  unknown shelf life is refused rather than guessed. What remains is CR-08.
- **CL-05** — a unit records whether its group came from the donor's profile,
  from staff at collection, or from typing the unit itself, and the console
  shows it. What remains is LR-03.

**Added at P1.** CL-15, CL-16 and CL-17 are questions Sprint 7's own model
raises and is not entitled to answer; DG-05 is the low-stock threshold, which
stopped being a constant and became configuration nobody has filled in yet.

The engineering work that can start today without a reviewer is now visibly
small: the INFRA column. That is the point of the reclassification.

## Where the critical path actually is

Of 31 pilot P0s:

1. **Reviewer decisions — 17.** CL-01 … CL-05, CL-07, CL-08, PR-01 … PR-04,
   PR-07, DG-02, DG-06, IO-01, IO-02, IO-04 … IO-06. Every one has an entry in
   `review-packs/` stating the question, the allowed answer format, and what
   the software does with each answer. No amount of engineering substitutes,
   and none of them is waiting on engineering.
2. **Infrastructure — 14.** IN-01 … IN-03, IN-05, MS-01, MS-02, DG-03, WB-02,
   MO-01, MO-02, MO-04, MO-06, and the two QA P0s (MB-01, WB-01). Ordinary
   work, none of it started.
3. **Engineering that can start today — 0.** Sprint 7 took the last two
   (CL-04's model and CL-06) off this list. Everything remaining is (1) or (2).

The single most valuable hour anyone can spend on this project is a laboratory
specialist answering LR-01 and LR-02. Until then no unit can be released, and
the subsystem that would satisfy a release requirement cannot be designed,
because whether it is a subsystem at all is what LR-02 asks.

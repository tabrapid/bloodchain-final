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

---

## A. Clinical

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **CL-01** | A blood unit reaches transfusable stock with no testing gate. One staff member, one click, no test data consulted. *(BU-01, CD-021)* | P0 | CLIN → ENG | Confirmed in code | Clinical reviewers specify the required screening set; then build the release gate proposed in `clinical-safety-gaps.md` §2.4 | PILOT |
| **CL-02** | The laboratory module is donor diagnostics, not donation screening. Results key to appointments, not to donations or units. *(LAB-01, CD-050)* | P0 | CLIN → ENG | Confirmed in code | Decide whether donation screening is in scope for the pilot; if yes, this is a new subsystem | PILOT |
| **CL-03** | No recipient recorded against an issued unit — a unit cannot be traced to the patient who received it. *(BU-04, CD-023)* | P0 | CLIN + OPS → ENG | Confirmed in code | Decide what identifies a recipient in this jurisdiction; then schema and UI | PILOT |
| **CL-04** | Units are created with no expiry, so they never expire and the expiry job cannot see them. *(BU-03, CD-020)* | P0 | CLIN → ENG | Confirmed in code | Shelf life per component type from the clinical reviewers; apply at creation | PILOT |
| **CL-05** | A unit's blood group is copied from the donor's profile rather than typed from the unit. *(BU-02, CD-010)* | P0 | CLIN | Confirmed in code | Decide whether per-unit grouping is required for the pilot | PILOT |
| **CL-06** | Deferral is enforced for emergency matching and ignored at booking. *(DEF-01, DEF-05, CD-005)* | P0 | ENG | Confirmed in code | Build the deferral model in `clinical-safety-gaps.md` §3.3 — no clinical input needed for the model itself | PILOT |
| **CL-07** | The 56-day recovery window is a development default nobody has signed. *(CD-001)* | P0 | CLIN | `DONATION_COOLDOWN_DAYS=56` | One clinician signs the number, or gives another | PILOT |
| **CL-08** | The donor→recipient compatibility table is unsigned, whole-blood only. *(CD-060)* | P0 | CLIN | Hard-coded in `emergency.service.ts:54` | One clinician signs this specific table | PILOT |
| **CL-09** | No age, weight or haemoglobin gate; assessment records a decision, not measurements. *(CD-004)* | P1 | CLIN + OPS | Confirmed in code | Operator confirms in writing that their paper screening remains the control | PILOT |
| **CL-10** | Reference ranges and result flags are development data shown to donors as health information. *(CD-051)* | P1 | CLIN | Seeded ranges | Laboratory specialist supplies real ranges, or the flags are hidden | BETA |
| **CL-11** | 106 clinical terms in three languages, none signed off. | P1 | CLIN | `docs/clinical-review.md`, 106 PENDING | Review in the priority order that file sets out | BETA |
| **CL-12** | One recovery interval for every donation type — plasma and platelets get the whole-blood window. *(CD-002)* | P1 | CLIN | Confirmed in code | Only blocks a pilot that collects anything but whole blood | PILOT |
| **CL-13** | No annual donation limit. *(CD-003)* | P2 | CLIN | Confirmed in code | Decide whether one is required | PROD |
| **CL-14** | No adverse-event register for donor or transfusion reactions. *(OPS-25)* | P1 | OPS + CLIN | Absent | Decide whether the pilot records these on paper | PILOT |

## B. Legal and privacy

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **PR-01** | Donor location retained 72 hours with no privacy assessment. *(CD-063)* | P0 | LEGAL | `EMERGENCY_LOCATION_RETENTION_HOURS=72` | Privacy review; confirm or change the period and the lawful basis | PILOT |
| **PR-02** | No national identity on a donor record; a unit cannot be traced to an identified person. *(CD-012, OPS-06)* | P0 | LEGAL + OPS | Confirmed in code | Determine what Uzbek regulation requires | PILOT |
| **PR-03** | No data-retention policy for donor health data, laboratory results or audit logs. | P0 | LEGAL | Nothing is ever deleted except emergency locations | Retention schedule per data class | PILOT |
| **PR-04** | No donor consent record for processing health data, or for the AI feature. | P0 | LEGAL + PO | Absent | Consent text and a record of it | PILOT |
| **PR-05** | No data-subject rights implementation — export, correction, erasure. | P1 | LEGAL + ENG | Absent | Confirm what is required, then build | BETA |
| **PR-06** | No data-processing agreement template for participating organisations. | P1 | LEGAL | Absent | Draft | PILOT |
| **PR-07** | Uzbek regulatory approval for operating blood-bank software is unassessed. | P0 | LEGAL | Unknown | Establish whether registration or certification applies | PILOT |
| **PR-08** | Privacy policy and terms of service do not exist in any language. | P0 | LEGAL + PO | Absent | Required before any store submission | BETA |

## C. Infrastructure

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **IN-01** | No production environment. Everything runs locally against a local Postgres. | P0 | INFRA | Absent | Choose hosting; provision API, database, three web apps | PILOT |
| **IN-02** | No TLS, no domain, no certificate management. | P0 | INFRA | Absent | Domains and certificates | PILOT |
| **IN-03** | Secrets are in `.env` files with development values, including JWT secrets. | P0 | INFRA | `apps/api/.env` | A secret manager; rotate everything before the first real deployment | PILOT |
| **IN-04** | No CI pipeline. Every gate is run by hand. | P1 | ENG | Scripts exist and pass locally | Wire typecheck, lint, test, e2e, `verify:*` and `verify:e2e-isolation` into CI | QA |
| **IN-05** | No migration strategy for a live database — migrations are applied by hand. | P0 | ENG + INFRA | `prisma migrate deploy` run manually | A deployment runbook with a rollback path | PILOT |
| **IN-06** | Rate limiting is in-process, so it resets on restart and does not span instances. | P1 | ENG | `ThrottlerModule`, in memory | Shared store, or accept single-instance for the pilot | PILOT |
| **IN-07** | No load or capacity testing at any scale. | P1 | ENG | Never run | Establish the pilot's expected volume, then test to it | PILOT |
| **IN-08** | No staging environment that mirrors production. | P1 | INFRA | Absent | Provision alongside IN-01 | PILOT |

## D. Messaging

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **MS-01** | No SMS vendor. OTP and emergency alerts have a provider abstraction and no provider behind it. | P0 | PO + INFRA | Abstraction exists; development logs the code | Select an Uzbek SMS provider, contract, integrate | PILOT |
| **MS-02** | Email is a local catcher (MailHog). No production SMTP, no sender domain, no SPF/DKIM/DMARC. | P0 | INFRA | Local only | Transactional email provider and domain authentication | PILOT |
| **MS-03** | Push notifications use Expo's service with no production credentials. | P1 | ENG + INFRA | Expo push, development | FCM and APNs credentials | BETA |
| **MS-04** | No delivery monitoring — a failed OTP or emergency alert is invisible. | P1 | ENG | Failures log only | Delivery status tracking and alerting | PILOT |
| **MS-05** | No production job queue; scheduled work runs on `@nestjs/schedule` in-process. | P1 | ENG | In-process cron | Only blocks multi-instance deployment | PROD |

## E. Data and geography

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **DG-01** | Geography is demo data, not authoritative SOATO. | P1 | PO + OPS | 14 regions seeded as demo; `verify:geography` treats real data separately | Obtain SOATO; import as reference data | PILOT |
| **DG-02** | All 22 seeded organisations are `isDemo: true`. No real organisation exists. | P0 | PO + OPS | By design since the demo freeze | Onboard the pilot organisations as real records | PILOT |
| **DG-03** | No production backup or restore procedure. | P0 | INFRA | Absent | Backup schedule, retention, and a *tested* restore | PILOT |
| **DG-04** | No seed path for a production deployment — `prisma/seed.ts` is demo data and guarded to local databases. | P1 | ENG | Local only by guard | A reference-data-only seed: roles, permissions, test types, geography | PILOT |

## F. Mobile release

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **MB-01** | No app has been run on a physical device in this workstream. | P0 | ENG | Headless environment throughout | Work `docs/production-ui-qa.md` on real hardware | QA |
| **MB-02** | No build configuration for release — no EAS profile, no signing, no bundle identifiers. | P0 | ENG | Development only | Configure release builds | BETA |
| **MB-03** | No crash or error reporting in the mobile app. | P1 | ENG | Absent | Sentry or equivalent | BETA |
| **MB-04** | No app icon, splash screen or store assets at release quality. | P1 | PO + design | Development placeholders | Produce assets | BETA |
| **MB-05** | Deep links are unverified on a device — universal links and app links are unconfigured. | P1 | ENG | Routes exist | Configure and test on hardware | BETA |
| **MB-06** | Expo SDK 52 with React Native 0.76; upgrade cadence unplanned. | P2 | ENG | Current | Out of scope by instruction | PROD |

## G. Web deployment

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **WB-01** | The three consoles have never been opened in a browser in this workstream. | P0 | ENG | Production builds pass; nothing rendered | Work `docs/production-ui-qa.md` in a real browser | QA |
| **WB-02** | No hosting, domain or deployment pipeline for the three apps. | P0 | INFRA | Absent | Provision with IN-01 | PILOT |
| **WB-03** | No browser support matrix, and no testing outside the one assumed engine. | P1 | PO + ENG | Unstated | Declare supported browsers; test them | PILOT |
| **WB-04** | No security headers configured — CSP, HSTS, frame options. | P1 | INFRA | Absent | Configure at the edge | PILOT |
| **WB-05** | No session timeout in the consoles beyond token expiry. | P1 | ENG + OPS | 15-minute access token, refreshed silently | Operator states an idle timeout for shared workstations | PILOT |

## H. Monitoring and backup

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **MO-01** | No uptime monitoring or alerting on any service. | P0 | INFRA | Absent | Health checks and on-call alerting | PILOT |
| **MO-02** | No centralised logging; logs go to stdout and are lost. | P0 | INFRA | Absent | Log aggregation with retention | PILOT |
| **MO-03** | No error tracking on the API or the consoles. | P1 | ENG | Absent | Sentry or equivalent | PILOT |
| **MO-04** | Database backups do not exist (DG-03), and no restore has ever been rehearsed. | P0 | INFRA | Absent | Automate, then *restore from a backup* to prove it | PILOT |
| **MO-05** | No metrics or dashboards — no visibility of request rates, latency or job failures. | P1 | INFRA | `/health` exists | Metrics and dashboards | PILOT |
| **MO-06** | No incident process: no on-call, no escalation, no runbook. | P0 | PO + INFRA | Absent | Define before real blood depends on it | PILOT |

## I. Store compliance

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **ST-01** | No developer accounts for Apple or Google. | P0 | PO | Absent | Register; Apple's review of health apps is slow | BETA |
| **ST-02** | Health-data declarations and privacy nutrition labels not prepared. | P0 | PO + LEGAL | Absent | Requires PR-04 and PR-08 first | BETA |
| **ST-03** | Store listings do not exist in any language. | P1 | PO | Absent | Write for uz/ru/en | BETA |
| **ST-04** | An app handling health data may need extra review or an entity verification. | P1 | PO + LEGAL | Unassessed | Check both stores' current rules | BETA |
| **ST-05** | Location permission usage strings are not written for review. | P1 | ENG + PO | Default strings | Write a justification both stores will accept | BETA |

## J. Institutional onboarding

| ID | Blocker | Sev | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **IO-01** | No pilot agreement, and nothing written down about what the software does and does not do clinically. | P0 | PO + LEGAL | Absent | Draft, naming CL-01 to CL-09 explicitly as operator responsibilities | PILOT |
| **IO-02** | No training material for blood-centre or hospital staff. | P0 | PO + OPS | Absent | Write against the real workflows | PILOT |
| **IO-03** | No onboarding process for a real organisation — creating it, its locations, its staff and their roles. | P1 | ENG + PO | Admin console can do it; no procedure exists | Write the runbook | PILOT |
| **IO-04** | No support channel for staff who hit a problem mid-shift. | P0 | PO | Absent | Define, staff it, publish it | PILOT |
| **IO-05** | No procedure for what staff do when the system is unavailable. | P0 | OPS + PO | Absent | Write the fallback; it will be paper | PILOT |
| **IO-06** | No agreement on who owns the data, or what happens to it when the pilot ends. | P0 | LEGAL + PO | Absent | Settle before the pilot, not after | PILOT |

---

## Summary by gate

| Gate | P0 | P1 | P2 |
| --- | --- | --- | --- |
| **QA** | 3 | 1 | 0 |
| **PILOT** | 30 | 16 | 0 |
| **BETA** | 5 | 9 | 0 |
| **PROD** | 0 | 1 | 2 |

**To reach internal QA** (3 P0s): put the apps in front of a human — MB-01,
WB-01 — and wire the gates into CI (IN-04).

**To reach a controlled pilot** (30 P0s) the work splits three ways, and only
one of them is engineering:

1. **Decisions nobody has made yet** — CL-01, CL-02, CL-03, CL-05, CL-07,
   CL-08, PR-01 … PR-04, PR-07, IO-01, IO-06. These are a clinician, a lawyer
   and an operator in a room. No amount of engineering substitutes.
2. **Infrastructure that does not exist** — IN-01, IN-02, IN-03, IN-05, MS-01,
   MS-02, DG-03, MO-01, MO-02, MO-04, MO-06, WB-02. Ordinary work, none of it
   started.
3. **Engineering that can start today** — CL-04 and CL-06 need no clinical
   input to *model*; DG-02 and DG-04 are data work.

The critical path is (1). CL-01 in particular gates a whole subsystem: until the
clinical reviewers say what must be tested before a unit is released, the gate
cannot be built, and until it is built no unit this system releases should reach
a patient.

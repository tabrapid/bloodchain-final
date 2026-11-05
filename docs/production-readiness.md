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
| **IN-03** | Secrets are in `.env` files with development values, including JWT secrets. | P0 | INFRA | INFRA | **Refused at boot (S8).** `assertProductionConfig` refuses a production start on the `.env.example` placeholder secrets, which are 52 characters long and published in this repository, so a minimum-length check cannot see them. Also refuses `SMS_DEV_LOG_FILE` and `DEMO_ALLOW_DATABASE` | A secret manager and a rotation procedure. The refusal makes a bad deployment impossible; it does not store anything | PILOT |
| **IN-04** | CI existed and had never seen the work. 110 green runs, every one against `main`; all of Sprints 0–7 lives on `claude/local-test-ready`. Its e2e job could not have passed on that branch — the seed refuses the database name it uses. | — | **ENG-CLOSED** | ENG | **Closed (S8).** Triggers on the canonical branch, database renamed so the seed guard recognises it, and two new jobs: the Sprint 7 four-step sequence against a live API, and `verify:e2e-isolation`. The whole verification job was reproduced locally end to end | None | — |
| **IN-05** | No migration strategy for a live database — migrations are applied by hand. | P1 | INFRA | INFRA | **Runbook written (S8).** `runbooks/deployment-and-rollback.md`, grounded in a checked fact: no migration in this repository drops a column or table, so the fast rollback is redeploying the previous build. Prisma has no `migrate down`, so restore is the rollback path | Downgraded from P0: the procedure exists and is verifiable. What remains needs the hosting decision (IN-01) to say what "deploy" concretely means | PILOT |
| **IN-06** | Rate limiting is in-process, so it resets on restart and does not span instances. | P1 | INFRA | ENG + OPS | Unchanged. Nothing in this repository uses Redis, and Sprint 8 did not add it: a shared store is only needed once the pilot runs more than one instance | Accept single-instance for the pilot, or decide to scale out and add a shared store then. An operator decision, not an engineering one | PILOT |
| **IN-07** | No load or capacity testing at any scale. | P1 | INFRA | ENG | Never run | Establish the pilot's expected volume, then test to it | PILOT |
| **IN-08** | No staging environment that mirrors production. | P1 | INFRA | INFRA | Absent | Provision alongside IN-01 | PILOT |

## D. Messaging

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **MS-01** | No SMS vendor. OTP and emergency alerts have a provider abstraction and no provider behind it. | P0 | INFRA | PO | **Boundary complete (S8).** Registry, config surface, four independent production refusals, masked recipients in logs, and tests. No adapter ships: the market is several aggregators with incompatible APIs and one written against a guess would pass its own tests and fail on contact. A test asserts the production-adapter list is empty | `docs/sms-provider-integration.md` lists the seven things the operator must supply. Items 1, 2 and 5 have external lead times no engineering shortens | PILOT |
| **MS-02** | Email is a local catcher (MailHog). No production SMTP, no sender domain, no SPF/DKIM/DMARC. | P0 | INFRA | INFRA | **Silent degradation closed (S8).** `EmailService` fell back to logging the *whole message* when `SMTP_HOST` was unset — in production that broke account recovery and published every password-reset link to the log at the same time. Now refused at boot, twice, and the body is never logged in production | A transactional email provider and a sender domain with SPF/DKIM/DMARC. Both external | PILOT |
| **MS-03** | Push notifications use Expo's service with no production credentials. | P1 | INFRA | ENG + INFRA | Expo push, development | FCM and APNs credentials | BETA |
| **MS-04** | No delivery monitoring — a failed OTP or emergency alert is invisible. | P1 | INFRA | ENG | Failures log only | Delivery status tracking and alerting | PILOT |
| **MS-05** | No production job queue; scheduled work runs on `@nestjs/schedule` in-process. | P1 | INFRA | ENG | In-process cron | Only blocks multi-instance deployment | PROD |

## E. Data and geography

| ID | Blocker | Sev | Class | Owner | State | Next action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **DG-01** | Geography is demo data, not authoritative SOATO. | P1 | REVIEWER | PO + OPS | 14 regions seeded as demo; `verify:geography` treats real data separately | Obtain SOATO; import as reference data | PILOT |
| **DG-02** | All 22 seeded organisations are `isDemo: true`. No real organisation exists. | P0 | REVIEWER | PO + OPS | By design since the demo freeze | Onboard the pilot organisations as real records | PILOT |
| **DG-03** | No production backup or restore procedure. | P0 | INFRA | INFRA | **Procedure built and rehearsed (S8).** `pnpm verify:backup` dumps, restores into a scratch database, compares every table and row count, checks the rows a blood service cannot lose by name, and confirms the restored schema has no unfinished migration. Run locally: 85 tables, 2178 rows, green | Schedule, retention, off-host storage and encryption — all operator decisions, listed in `runbooks/backup-and-restore.md` | PILOT |
| **DG-04** | No seed path for a production deployment. Worse than recorded: the demo seed refuses to run outside a local database, so a production deployment reached an empty database with **no roles and no permissions** — registration fails, every guard fails, there is no way in. | — | **ENG-CLOSED** | ENG | **Closed (S8).** `pnpm db:seed:reference` — upsert-only, idempotent, roles + permissions + the fourteen ISO 3166-2:UZ regions. No users, no organisations, no districts, no test types, no clinical release policy; sixteen tests assert it stays that way | None. Test types and reference ranges are deliberately excluded and belong to LR-05 | — |
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
| **MB-06** | ~~Expo SDK 52 with React Native 0.76; upgrade cadence unplanned.~~ **Superseded.** The app is on Expo SDK 57 / React Native 0.86.3 as of `da476dc5`; the migration ran 52 → 53 → 54 → 55 → 56 → 57, a commit per hop. See `docs/mobile-release-readiness.md` §3. | P2 | INFRA | ENG | Superseded | Tracked in the mobile readiness doc | PROD |

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
| **MO-01** | No uptime monitoring or alerting on any service. | P0 | INFRA | INFRA | **Probes built (S8).** `/health` returned 200 with a body saying `degraded` while the database was down, so every probe that decides by status code kept a broken API in rotation. Liveness and readiness are now separate endpoints with correct codes; readiness also refuses on an unfinished migration | The monitoring service that calls them, and the on-call rotation that answers. Both external | PILOT |
| **MO-02** | No centralised logging; logs go to stdout and are lost. | P0 | INFRA | INFRA | Absent | Log aggregation with retention | PILOT |
| **MO-03** | No error tracking on the API or the consoles. | P1 | INFRA | ENG | Absent | Sentry or equivalent | PILOT |
| **MO-04** | Database backups do not exist (DG-03), and no restore has ever been rehearsed. | P1 | INFRA | INFRA | **Rehearsal automated (S8).** The restore is performed, not described — `pnpm verify:backup`. Downgraded from P0 because "no restore has ever been rehearsed" is no longer true | Run it against the production database once it exists | PILOT |
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

Counted from the tables above. Rows with no severity are closed and excluded.

| Gate | P0 | P1 | P2 |
| --- | --- | --- | --- |
| **QA** | 2 | 0 | 0 |
| **PILOT** | 29 | 23 | 0 |
| **BETA** | 4 | 10 | 0 |
| **PROD** | 0 | 1 | 2 |

## Summary by class

| Class | Count |
| --- | --- |
| **ENG-CLOSED** | 3 |
| **REVIEWER** | 37 |
| **INFRA** | 26 |
| **STORE** | 8 |

---

## The 29 pilot P0 blockers, by who can answer them

Sprint 8 was asked to classify every remaining P0 into seven buckets. Here they
are, by *who* can move them — which is the only classification that changes what
anyone does on Monday.

| Bucket | Count | Blockers |
| --- | --- | --- |
| **A. Clinical review** | 3 | CL-04, CL-07, CL-08 |
| **B. Laboratory review** | 3 | CL-01, CL-05, DG-06 |
| **C. Operations review** | 4 | DG-02, IO-02, IO-04, IO-05 |
| **D. Legal / privacy review** | 8 | CL-03, PR-01, PR-02, PR-03, PR-04, PR-07, IO-01, IO-06 |
| **E. Infrastructure / DevOps** | 10 | IN-01, IN-02, IN-03, MS-01, MS-02, DG-03, WB-02, MO-01, MO-02, MO-06 |
| **F. Store / deployment** | 0 | *(ST-01, ST-02, MB-02 and PR-08 are all BETA-gate, not PILOT)* |
| **G. Engineering blocked by A–D** | 1 | CL-02 |

Each A–D blocker has an entry in [`review-packs/`](review-packs/) stating the
question, the allowed answer format, and what the software does with each
answer. **G** is one row and it is the expensive one: CL-02 is the donation
screening subsystem, and whether it is a subsystem at all is what LR-02 asks —
so it cannot be designed, let alone built, until that is answered.

Two QA-gate P0s remain outside this table: **MB-01** and **WB-01**, which need a
physical device and a real browser. Neither exists in the environment this was
built in.

### Reconciling this against the Sprint 7 report

Sprint 7 claimed "17 reviewer decisions + 14 infrastructure blockers". Both
numbers were wrong, and the register rows never changed — only the prose about
them did.

- **17 was a miscount.** The list printed directly beneath it in that report
  contained 19 IDs. The list was right.
- **14 mixed two gates.** It reached 14 by including MB-01 and WB-01, which are
  QA-gate P0s rather than PILOT ones. Within PILOT, infrastructure was 12.

So Sprint 7's 31 was **19 reviewer + 12 infrastructure**, not 17 + 14. Sprint 8
closed two infrastructure blockers outright and downgraded two more, giving
**19 reviewer + 10 infrastructure = 29**.

---

## What Sprint 8 changed

The brief was to use reviewer waiting time on every P0 that does not need a
clinical, laboratory, legal or operational decision. Pilot P0s went 31 → 29, and
the two that closed were closed outright rather than reclassified.

### Closed

- **IN-04 — CI.** The register said "no CI pipeline". There was one, it had run
  110 times, and every run was green because every run was against `main`. All
  of Sprints 0–7 lives on `claude/local-test-ready`, which CI had never seen.
  It also could not have passed if it had looked: the e2e job's database is
  named such that the seed guard refuses it, which was reproduced locally before
  it was fixed. CI now watches the canonical branch and runs the Sprint 7
  four-step sequence against a live API.
- **DG-04 — production seed.** Recorded as P1 "no seed path"; actually fatal.
  The demo seed refuses to run outside a local database, so a production
  deployment reached an empty database with no roles and no permissions —
  registration fails, every guard fails, nobody can sign in. `pnpm
  db:seed:reference` closes it.

### Downgraded from P0, because the procedure now exists and is verifiable

- **IN-05 → P1** — deployment and rollback runbook, grounded in a checked fact
  about this repository's migrations rather than a habit.
- **MO-04 → P1** — "no restore has ever been rehearsed" stopped being true.
  `pnpm verify:backup` performs one.

### Still P0, but materially safer than they were

- **IN-03, MS-01, MS-02** — a deployment that would have shipped placeholder
  secrets, printed one-time codes into a log, or logged every password-reset
  link instead of sending it now refuses to boot and says why. The blockers stay
  open because a secret manager, an SMS contract and a sender domain are all
  external; what changed is that getting them wrong is no longer silent.
- **MO-01** — the probes exist and mean what they say. What is missing is the
  service that calls them.

### The worst thing found

`EmailService` fell back to a stream transport whenever `SMTP_HOST` was unset,
logging the entire message. In production that is two failures wearing one
missing variable: account recovery silently broken, and every password-reset
link — single-use access to an account — written to the application log. It had
no production guard at all. It has two now.

---

## Where the critical path is

Unchanged in shape, shorter by two:

1. **Reviewer decisions — 19.** Every one has a pack entry. None is waiting on
   engineering.
2. **Infrastructure — 10.** Every one now needs an external thing: a hosting
   platform, a domain, a secret manager, an SMS contract, a sender domain, a
   monitoring service, an on-call rota. Sprint 8 took the in-repo half of each
   as far as it goes.
3. **Engineering that can start today without a reviewer or an account — 0.**

The single most valuable hour remains a laboratory specialist answering LR-01
and LR-02. Until then no unit can be released, and the subsystem that would
satisfy a release requirement cannot be designed.

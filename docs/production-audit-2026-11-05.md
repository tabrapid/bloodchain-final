# Production audit — 2026-11-05

## Verified baseline

- Repository: `git@github.com:tabrapid/bloodchain-final.git`.
- Working branch: `claude/local-test-ready`, commit `8632ff0e`.
- Live `git ls-remote --heads origin` matches all five locally recorded remote branch heads. Current branch is 96 commits ahead of remote `main`, with no commits behind. No merge or push performed. PR discussions and remote Actions results have not been reviewed.
- Existing user changes preserved: mobile `android`/`ios` scripts and a deleted visual QA screenshot.
- Stack: pnpm/Turbo workspace, NestJS/Prisma/PostgreSQL API, three Next.js consoles, Expo donor/courier mobile app.
- Lint passes across 11 packages; API reports 587 warnings.
- After generating Prisma client, API typecheck passes and 84 API unit suites / 1,489 tests pass. Jest reports an open-handle warning before eventual exit; investigate before declaring CI stable.
- Shared UI: 15 suites / 100 tests pass with `NODE_OPTIONS=--no-experimental-webstorage`. Without this flag, Node 26 causes 16 localStorage-related failures. CI and API Dockerfile use Node 22; verify on that runtime.
- Workspace typecheck remains failing in mobile: three declared font dependencies cannot be resolved locally and generated Expo route types omit `/delete-account`. Reinstall locked dependencies and regenerate Expo routes before attributing these to source defects.
- Docker CLI exists, but Docker daemon is unavailable. No container build, integration suite, migration rehearsal, restore rehearsal, native build or VPS smoke test verified in this audit.

## Confirmed deployment blockers

1. SMS registry ships only a development provider. Production boot deliberately refuses it. Integrate the selected vendor against its official API, including authentication, failure handling and redacted logging; verify actual delivery.
2. Existing Compose is explicitly for development. It exposes PostgreSQL, has no web consoles or TLS proxy, and uses development defaults. Build a separate production deployment after hostnames and VPS details are supplied.
3. VPS, DNS, TLS and production SMTP are not verified. No server has been accessed or changed.
4. API container startup applies migrations automatically. The deployment runbook also requires reference seeding, which the entrypoint does not perform. Implement and rehearse explicit migration/reference-seed steps and rollback before deployment.
5. Backups, off-host retention, restore, alert delivery, capacity and staging have not been exercised against the target environment.
6. Mobile production API URL, Expo project/push delivery, Android Maps configuration, signing and native/device QA require verification. Existing blocker documents contain historical environment claims; recheck them on this machine.
7. Clinical and privacy decisions remain release gates. The production-readiness register contains older statements that later code may supersede; reconcile each with source and evidence. Do not treat every historical row as current or close it solely because unit tests pass.

## Execution order and acceptance evidence

1. **Reproducible baseline:** supported Node runtime, frozen-lockfile install, Prisma generation, complete typecheck/lint/unit checks, production builds of API and all three consoles, mobile bundle/native checks. Capture exact commit and results.
2. **Engineering gaps:** reconcile `TODO.md` and readiness registers against current source; address confirmed authentication, authorization, tenant isolation, donor/booking, screening, stock, request and courier defects. Run database-backed integration tests and full role journeys.
3. **Production packaging:** API and three web images, TLS proxy with WebSockets, private database networking, least-privilege runtime, production configuration, explicit migrations/reference seed and health probes. Review trusted-proxy/IP rate limiting before placing API behind a proxy.
4. **Staging on VPS:** provision using supplied SSH access and domains, exercise SMS/email/push, restore a backup into an isolated database, rehearse upgrades and rollback, test expected load and alerts.
5. **Release gates:** obtain named clinical/legal/operator decisions, configure approved policies, complete real browser/device QA and mobile distribution requirements.
6. **Production cutover:** verify CI on the exact release commit, take and verify backup, migrate/seed, deploy, verify readiness and end-to-end journeys, observe metrics and retain a tested rollback build.

Completion means these checks have evidence on the target environment. A running server or green unit tests alone do not establish production readiness.

## Inputs requested

- VPS IP or SSH alias, SSH user and existing key-based access; production domains.
- SMS vendor/account, SMTP service, Expo project and Maps configuration as applicable. Keep credentials outside chat and source control.
- People responsible for clinical policy, privacy/retention and pilot operational approval.
- Expected user/concurrency volume and acceptable recovery/downtime targets before capacity and recovery acceptance.

## VPS deployment follow-up

- User supplied SSH access and confirmed that the other Codex process on the VPS is performing a separate repository audit. Keep its `/var/tmp/bloodchain-audit` working directory untouched.
- Active deployment: `/opt/bloodchain`, based on `8632ff0e` with the source changes below. All application/database ports bind only to loopback. API remains in development mode. API was rebuilt and recreated; PostgreSQL was not restarted or reset, and no seed was run. Readiness reports the same latest migration and no unfinished migration.
- `api.bloodchain.uz` resolves to the VPS. Before changes, HTTP readiness returned 200 and port 443 was closed.
- Enabled Let's Encrypt TLS using the existing certbot/nginx installation. HTTPS readiness now succeeds; certificate expiry is 2027-02-03 and `certbot.timer` is enabled. Original API nginx configuration backed up under `/root/bloodchain-deploy-backups/`.
- Added nginx WebSocket upgrade forwarding. Configuration passed `nginx -t` before reload.
- Reviewed existing `/root/bloodchain/Dockerfile.web`, `compose.web.yml` and deployment handover; copied those two packaging files into the active checkout, preserving existing files. All portal images built with `PUBLIC_API_URL=https://api.bloodchain.uz` and started successfully.
- User deferred SMS integration and clinical/privacy decisions. These remain release blockers; do not bypass production startup guards.
- User accepted `hospital.bloodchain.uz`, `center.bloodchain.uz` and `admin.bloodchain.uz`. DNS initially contained duplicated suffixes; user corrected the records and all three now resolve to the VPS. TLS certificates installed for all three.
- Hospital image built successfully on Node 22: typecheck, lint (two warnings), 10 suites / 70 tests and Next.js production build passed. Container started non-root on loopback port 3000, reports healthy, and public HTTPS root returned 200. All 11 root JS/CSS assets returned 200 and contain the HTTPS API origin. Sign-in lives at `/`, not `/login`.
- API certificate renewal dry-run succeeded. WebSocket handshake over API TLS returned 101.
- Created a PostgreSQL custom-format backup at `/root/bloodchain-deploy-backups/pre-web-deploy-20261105.dump`; `pg_restore --list` reads its table of contents. This is not a restore rehearsal or off-host backup.
- Backed up server `.env`, then configured HTTPS API and portal origins; these are now loaded by the recreated API. Preserved old API image as `bloodchain-api:before-web-20261105`.
- Fixed shipment gateway's comma-separated origin handling in local source and server source, matching the emergency gateway's parsing. Two gateway suites / 11 tests passed locally. The deployed API now includes this fix.
- Packaging files are also present in the local workspace so the reviewed VPS changes can be retained in version control. No commit or push performed.

## Deployment verification completed

- Blood centre: 10 suites / 62 tests, typecheck, lint (10 warnings), Next.js build and image build passed.
- Admin: 5 suites / 37 tests, typecheck, lint (64 warnings), Next.js build and image build passed.
- All three public HTTPS portal roots returned 200. Every referenced root JS/CSS asset returned 200 (11 hospital, 11 centre, 12 admin); each portal's assets contain the HTTPS API origin. Hospital sign-in form was also verified in a real browser. Authenticated staff/organisation journeys have not been verified.
- All certificate renewal simulations succeeded (API, centre, hospital/admin SAN certificate).
- Added `TRUST_PROXY_HOPS`, default 0, validated as 0 or 1. With explicit user approval after automatic review requested it, VPS uses 1 behind nginx; API port remains loopback-only. New HTTP tests prove forwarded addresses are ignored with 0 and client-supplied prefix spoofing does not select the client IP with 1.
- After API changes: typecheck passed; 85 suites / 1,491 tests passed. New HTTP tests were rerun with an explicit loopback listener and passed. Changed API files lint with no errors (seven existing shipment gateway warnings). `git diff --check` passes.
- New API image compiled and deployed; API readiness is healthy, restart count 0. All five containers report healthy. Existing PostgreSQL container remained running.
- Live HTTPS CORS matrix passed: all three portal origins receive their own allowed origin and credentials headers for REST preflight and Socket.IO polling; an unknown origin receives no allowed-origin header on either path. Invalid login payload is rejected with 400.
- Production configuration dry-run against the deployed environment still reports `SMS_PROVIDER_DEVELOPMENT`, `SMTP_NOT_CONFIGURED` and `SMTP_FROM_NOT_DELIVERABLE`. SMS and clinical/privacy decisions were deferred by the user; SMTP availability has been requested. No production-ready claim is made.
- Restore rehearsal, off-host backups, load testing, alerting, authenticated end-to-end QA, native/mobile release gates and remaining repository audit findings are still open.

## SMTP follow-up

- User verified `notify.bloodchain.uz` in Resend. Authoritative DNS returned the DKIM TXT and both requested CNAME records.
- User saved SMTP credentials in `/root/bloodchain/.env`; copied only the six SMTP settings into the active `/opt/bloodchain/.env`, retaining mode 0600 and a private backup of the previous active environment. No credentials printed or added to source control.
- Recreated only the API to load SMTP configuration. HTTPS readiness remains healthy with the same applied migration.
- SMTP authentication succeeded against Resend. One user-authorized test email was accepted for the supplied Gmail recipient, with no rejected recipients and SMTP response 250. The user subsequently confirmed inbox receipt.
- Registration-verification and password-reset end-to-end delivery remain to be exercised. SMS and other production gates remain open.

## Authentication hardening — 992cad7c

- Fixed verification-link replay: a consumed token, even an expired one, cannot create another session. Token consumption uses a conditional update inside a transaction; competing requests cannot both claim it.
- Confirmation also conditionally checks account status when updating the user, so concurrent deactivation cannot be overwritten by activation.
- Browser GET displays a no-store confirmation form and consumes nothing. Browser POST confirms without creating an unused session; the mobile JSON endpoint still returns a session after a successful first confirmation.
- Auth controller uses the trusted Express client IP instead of trusting a spoofable forwarded-header prefix.
- Local validation: API typecheck, 86 suites / 1,500 tests, changed-file lint with no errors (two existing test warnings), and diff whitespace check passed. The suite still emits its pre-existing open-handle warning before exiting.
- Changes pushed to `origin/claude/local-test-ready`. No force push or merge into main. Existing unrelated mobile script/screenshot changes remain outside these commits.
- VPS synced by fast-forward after preserving its previous deployment edits in a named stash. Environment credentials were not stashed or committed. New pre-deploy database archive is readable; previous API image retained as `bloodchain-api:before-auth-992cad7c`.
- API rebuilt and recreated; all five containers healthy. HTTPS smoke checks passed for readiness, repeated confirmation-page GETs, and rejection of an unknown browser confirmation token.
- Real-account verification/reset journeys and database-backed concurrency rehearsal remain unverified; unit/controller tests and live invalid-token smoke checks do not replace those checks. GitHub status API returned no statuses, so GitHub CI success is not asserted.

## Release QA and operations follow-up

- Built an isolated release QA runner using separate PostgreSQL/API containers, no published ports or egress, and read-only source mounts. No live environment or database was used. All 26 database-backed API suites / 278 tests passed, including existing cross-organisation access checks.
- Extended the real local SMTP recovery script: resend rotates verification tokens, GET scanner fetches leave the account unverified, browser confirmation allows normal login, replay is refused, and two concurrent mobile verification requests create exactly one session. Password reset, expiry, old-session revocation and old/new password checks passed without skipped checks.
- Fixed the recovery script's second request being suppressed by cooldown; expiry setup now affects only its own fixture account. Skipped required checks now fail. Added the recovery journey to CI after existing verification scripts.
- New VPS backup exports a read-only repeatable-read snapshot shared by counts and pg_dump, writes private archives/manifests, and restores into a network-isolated PostgreSQL container. Actual live-source rehearsal passed: all 102 public tables and snapshot row counts matched, with no unfinished migrations. Live data was only read.
- Added daily local backup/restore systemd units and host-local monitoring units. Monitoring covers the API, three portals, verified backup freshness and free disk space, with debounced outage/recovery notifications and channel-specific retries. Seven Python monitor tests and 23 existing script tests passed.
- User authorized alerts to their supplied email and Telegram. SMTP monitoring test was sent successfully. Telegram bot identity and the explicitly named private recipient were verified; the bot API accepted a test message. Tokens and chat configuration remain outside Git in a private file.
- Backup and monitoring timers are installed and enabled on the VPS. First service runs succeeded; the backup schedule is 02:30 Asia/Tashkent plus up to five minutes of jitter, and monitoring runs every minute. New backup job failure markers were verified with a disposable nonexistent source; live backup status remains successful.
- Off-host storage is not available, so off-host encrypted backup and external host-down monitoring remain open. SMS and clinical/privacy approvals are still deferred. The API remains in development mode.
- GitHub CI exposed reset-rate-limit exhaustion from earlier verification scripts. The recovery check now starts after a test-API restart, preserving the preceding isolation sequence, unchanged database and production rate limits. Seven other jobs on the preceding run passed, including mobile release checks, builds, unit tests, real-database e2e, isolation and migration rehearsal; the corrected run must be checked separately.
- Corrected recovery verification subsequently passed in GitHub CI. Investigating the mobile job also exposed a five-minute post-test delay: mutations evicted by account deletion's cache clear were no longer reachable through the cache at teardown. The test harness now tracks built mutations independently and destroys their timers even after eviction. A timer-count regression and all 645 mobile tests passed; the in-band process exited without the previous five-minute wait. Mobile typecheck passed after restoring missing locked dependencies and regenerating the stale local Expo route cache. Generated caches and unrelated user mobile changes are not committed. The mobile CI test step now has a four-minute ceiling to detect a recurrence without using forceExit.

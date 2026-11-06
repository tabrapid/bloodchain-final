# Donor web workspace

`apps/donor-web` provides the donor workflows of the mobile application as a responsive web console. It uses the same NestJS API, database, donor identity, permissions and service contracts as the other clients. A reservation created on the web is an ordinary appointment in the existing hospital/blood-center worklists, not a second booking system.

## Local development

Use Node 22.22.2+ (Node 24.22.1 was used here) and pnpm 9.15.5. From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
# Start a migrated, seeded disposable local API database and pnpm dev:api.
pnpm dev:donor
```

The donor app listens on port 3005 and proxies API requests to `http://127.0.0.1:3001`. Optional server-only variables are documented in `apps/donor-web/.env.example`. Existing mobile donor accounts work without creating another account. No database schema change is required by this feature. Never seed or reset a production database.

## Routes and integration

| Web route | Existing API contracts / actions |
| --- | --- |
| `/auth` | Email/phone login, email registration and verification resend, SMS registration, email/SMS password recovery |
| `/reset-password`, `/verify-email` | Existing email link paths; verification requires an explicit confirmation |
| `/` | Donor profile, donation statistics, next appointment, gamification level |
| `/appointments` | Availability, booking, rescheduling, cancellation, donor worklist |
| `/organizations` | Organization discovery, search, optional consent-based distance filter, external map links |
| `/laboratory` | Laboratory/test directory, slot booking/cancellation, published result details, parameter history, printing |
| `/donations` | Paginated/filterable donor history and donation details |
| `/health` | Available parameters, time ranges, trend chart and exact measurement table |
| `/insights` | Deployment availability, result/trend explanations, chat, history, conversation continuation/deletion, feedback |
| `/emergency` | Matched emergencies, accept/decline, journey start/arrival/cancellation, opt-in location sharing |
| `/education` | Content catalog/details, starting/completing content, education progress/XP |
| `/campaigns`, `/challenges` | Participation, withdrawal, server-calculated challenge progress |
| `/community` | Paginated feed and moderation reports |
| `/achievements` | Level, achievements, badges, XP history, paginated/time-filtered leaderboard and visibility |
| `/notifications` | Read/unread, archive/unarchive, delete, pagination, preferences and quiet hours; shell unread count refreshes every minute |
| `/profile` | User/donor profile, blood group self-report, completion and location consent |
| `/security` | Password changes, current/other session revocation, account deletion |

The public landing page links directly to the donor domain. Landing remains on port 3004; donor uses port 3005, so the services do not conflict. Existing root-domain Nginx routing should follow `docs/runbooks/vps-next-landing.md`.

The web donor contract modules mirror the pure mobile API modules, with a browser-specific transport. Mobile code is unchanged. The backend remains authoritative for eligibility, ownership, role checks, slot capacity, clinical release and achievable rewards.

The browser cannot provide Expo background push delivery or native background location behavior. Notifications are available in the web inbox. Location is shared only after an explicit donor action, while the emergency page remains open; navigation or stopping sharing clears the browser watch. SMS delivery and AI generation use the existing deployment/provider settings; disabled AI is shown as disabled, not as a working model. Education exposes the existing content/progress API; it does not invent a separate quiz-scoring service.

## Session and recovery integration

The `/api/v1/[...path]` gateway keeps access/refresh tokens in host-only HttpOnly, SameSite=Lax cookies (Secure in production). Login/refresh JSON is stripped of both tokens. Requests use the cookie session, not a browser-supplied bearer header. Mutation requests require the configured exact `DONOR_ORIGIN`; request/response caching is disabled. Both server and browser fetches have bounded timeouts. Expired access sessions refresh once before retrying; revoked sessions return to sign-in.

The API image now uses the CI-pinned Node 22.22.2 base and retains the pinned Corepack runtime so startup does not need to download pnpm. Optional CA secret mounts support managed builds without disabling TLS verification. Runtime images keep the Corepack cache, not the dependency download store.

Docker build contexts exclude environment files recursively, including nested API/app `.env` files; only non-secret `.env.example` templates are retained.

The gateway reaches the API through the Docker network, so adding a permissive API CORS origin is unnecessary. When proxied by the supplied Nginx configuration, client IP is carried to the API via the overwritten `X-Real-IP` header; configure the API's existing trusted-proxy setting for the actual deployment (`TRUST_PROXY_HOPS=1` for this single gateway hop). The donor container must remain bound to loopback externally. Its `DONOR_ORIGIN` must match the public HTTPS origin.

The optional API variable `WEB_URL_DONOR` routes donor recovery emails to the donor console. Existing admin/hospital/laboratory role precedence is preserved. Unset values keep the prior fallback behavior. Mobile deep links are preserved. General verification emails continue to use the existing API confirmation page, after which donors can sign in on the web.

## Production domain and deployment

Target: `https://donor.bloodchain.uz` on VPS `45.130.148.59`.

1. Add DNS **A**, name **donor**, value **45.130.148.59**. Initially use DNS-only if a CDN proxy is offered. Ensure no conflicting AAAA record points elsewhere, ports 80/443 are open and existing Nginx is healthy.
2. On the VPS, fetch and fast-forward the reviewed release in `/opt/bloodchain`; preserve the existing `.env`, local changes and database. The script does not pull or merge code automatically.
3. Ensure Docker Compose, Nginx, Certbot with its Nginx plugin, Python 3, curl and flock are installed. Supply a real certificate administrator email via `CERTBOT_EMAIL` (not an API credential).
4. Run the deployment in a persistent session or with nohup:

```bash
cd /opt/bloodchain
# Replace the email with the certificate administrator's real address.
nohup env CERTBOT_EMAIL=admin@example.com bash scripts/deploy-donor-web.sh > /root/bloodchain-donor-deploy.log 2>&1 < /dev/null &
tail -n 40 -f /root/bloodchain-donor-deploy.log
```

The script checks DNS/prerequisites, locks concurrent donor deploys, backs up the database and validates its archive, preserves `.env` and previous API/donor images, builds donor/API/landing sequentially, changes only the two donor origin values in `.env`, starts API/donor/landing without restarting PostgreSQL or the existing clinical web consoles, checks local readiness, installs the donor Nginx site and obtains HTTPS. The API entrypoint retains its normal migrate-deploy behavior; this feature adds no migration. It never seeds or resets the production database. API replacement causes a short interruption for API clients.

Completion marker: `DONOR_DEPLOY_OK https://donor.bloodchain.uz`. Failures stop the script; that marker must not be inferred from a running PID. `--check` only verifies repository deployment files and changes no server settings.

The script does not delete old images or backups. Rollback references are saved under `/root/bloodchain-backups/donor-<timestamp>/previous-images.txt`; `.env` is saved as `environment`, database as `database.dump`. To roll back an application failure, restore the saved `.env`, create a Compose override mapping the affected service(s) to their saved image tags, and run `docker compose -f docker-compose.yml -f compose.web.yml -f <rollback-override> up -d --no-deps <affected-services>`. Restore the backed-up donor Nginx file if needed and run `nginx -t` before reload. A code rollback does not require restoring the production database for this feature.

Do not overwrite an existing unmanaged donor Nginx site or remove other virtual hosts. Privacy access logs omit queries, cookies and authorization headers so recovery tokens do not enter those logs.

## Validation

Commands from the repository root:

```bash
pnpm --filter @bloodchain/donor-web typecheck
pnpm --filter @bloodchain/donor-web lint
pnpm --filter @bloodchain/donor-web test
pnpm --filter @bloodchain/donor-web build
pnpm --filter @bloodchain/api exec jest --runInBand src/modules/auth/password-reset.service.spec.ts src/config/env-example.spec.ts
bash scripts/deploy-donor-web.sh --check
```

Live API/database integration evidence and synthetic screenshots are recorded in `artifacts/donor-web/`. The full repository verification gate passed, including 291 API end-to-end tests; donor regression coverage has 17 tests. Both API and donor Docker images were built and exercised together, including cookie renewal, cross-role reservation visibility and profile persistence. A local build or a generated Nginx file alone does not establish DNS, certificate issuance or a running VPS service.

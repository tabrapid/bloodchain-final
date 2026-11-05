# BloodChain VPS deployment

Live checkout: `/opt/bloodchain`. Compose project: `bloodchain`.
Keep the separate audit checkout and `/var/tmp/bloodchain-audit` untouched.

| Service | Public origin | Host binding |
| --- | --- | --- |
| API | https://api.bloodchain.uz | 127.0.0.1:3001 |
| Hospital | https://hospital.bloodchain.uz | 127.0.0.1:3000 |
| Blood centre | https://center.bloodchain.uz | 127.0.0.1:3002 |
| Admin | https://admin.bloodchain.uz | 127.0.0.1:3003 |
| PostgreSQL | None | 127.0.0.1:5432 |

Nginx terminates TLS; certbot manages certificates and `certbot.timer` renewals.
API nginx configuration also forwards WebSocket upgrades, using a connection
map in `/etc/nginx/conf.d/bloodchain-websocket.conf`.

## Configuration

Server `.env` must remain private (mode 0600), outside version control.
Set `PUBLIC_API_URL` and `API_URL` to the HTTPS API origin without `/api/v1`.
`WEB_URL` is the comma-separated list of the three HTTPS portal origins.
Set `WEB_URL_HOSPITAL`, `WEB_URL_BLOOD_CENTER` and `WEB_URL_ADMIN` individually
so password-reset links return to the correct console.

`TRUST_PROXY_HOPS=1` is authorized for this topology: one nginx hop, with the
API port bound exclusively to loopback. The default is 0 elsewhere. Never
publish the API port directly while trusting a proxy hop; nginx must append
the actual source address to `X-Forwarded-For`.

**API production readiness remains open.** SMS integration and clinical/privacy
decisions were explicitly deferred. The existing API uses development mode;
do not bypass its production startup guards to relabel it as production.

## Build and start portals

On this 4 GB VPS, build sequentially. Each image runs its portal's typecheck,
lint, unit tests and Next.js production build on Node 22. Images use a non-root
runtime, a healthcheck and a 512 MB runtime memory limit. This limit is not
load-test evidence. Images retain workspace sources and development dependencies;
image-size optimization remains future work.

```sh
cd /opt/bloodchain
docker compose -f docker-compose.yml -f compose.web.yml build hospital-web
docker compose -f docker-compose.yml -f compose.web.yml build blood-center-web
docker compose -f docker-compose.yml -f compose.web.yml build admin-web
docker compose -f docker-compose.yml -f compose.web.yml up -d --no-deps hospital-web blood-center-web admin-web
```

These commands preserve the existing API and database. Do not use `down -v`,
demo resets or demo seeds on this deployment.

## API changes

Follow `deployment-and-rollback.md`: review migrations, verify a database backup,
retain the previous image and private environment file, build and test the API,
then recreate only the API service. Its existing entrypoint runs `migrate deploy`;
confirm that behavior before recreation. Apply reference seeding only when the
release requires it, using the documented reference seed rather than demo data.

## Verify

```sh
nginx -t
docker compose -f docker-compose.yml -f compose.web.yml ps
curl -fsS https://api.bloodchain.uz/api/v1/health/ready
curl -fsS -o /dev/null https://hospital.bloodchain.uz/
curl -fsS -o /dev/null https://center.bloodchain.uz/
curl -fsS -o /dev/null https://admin.bloodchain.uz/
certbot renew --dry-run
```

Also verify API CORS for all three origins, denial of unknown origins,
WebSocket upgrade forwarding and authenticated role/organisation journeys.
Portal sign-in is at `/`; there is no separate `/login` route.

Deployment backups are under `/root/bloodchain-deploy-backups/`. A readable
`pg_restore --list` proves archive readability, not a successful restore.
Off-host backup, isolated restore rehearsal, load testing and monitoring are
separate release gates.

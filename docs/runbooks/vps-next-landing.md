# Next.js landing deployment

The committed public landing is the Next.js app `@bloodchain/landing-web`.
`compose.web.yml` includes a fourth web service on **127.0.0.1:3004**. It uses the
same Node 22 container, non-root runtime, memory limit, and healthcheck as the
three institutional portals. Its image runs typecheck, lint, and a production
build. The landing has no unit-test script; portal images continue running theirs.

Build sequentially on the 4GB VPS, then start the landing service:

```sh
docker compose -f docker-compose.yml -f compose.web.yml build landing-web
docker compose -f docker-compose.yml -f compose.web.yml up -d --no-deps landing-web
```

Use `deploy/nginx/bloodchain-landing-next.conf` for the committed Next.js app.
A static HTML bootstrap configuration is not suitable for its `/_next/` assets,
client-side form, and `/privacy` and `/terms` routes. Do not install duplicate
nginx server blocks for the same domains. Preserve existing TLS configuration
and private logging settings when updating an existing virtual host.

For a first deployment, confirm apex and www DNS, install the nginx privacy log
format, back up nginx, install/enable the bootstrap block, validate `nginx -t`,
reload, and use certbot for both names once their DNS points at the VPS. Never
replace an existing TLS-enabled block with the HTTP-only bootstrap template.

Validate HTTPS for `/`, `/privacy`, `/terms`, and the referenced Next.js assets;
verify both portal links and HTTP-to-HTTPS redirects. The partnership form
prepares an email draft locally: deployment does not add an email-sending API.

Rollback: use the previous retained landing image if one exists. On first
installation remove only the new enabled virtual host and service, restore the
backed-up nginx configuration, validate and reload. Do not reset the database,
remove volumes, or alter the other portals to roll back the landing.

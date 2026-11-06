#!/usr/bin/env bash
# Run on the VPS after fetching/reviewing this release. No database reset or seed.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
domain=donor.bloodchain.uz
origin="https://$domain"
compose=(docker compose -f docker-compose.yml -f compose.web.yml)
if [[ "${1:-}" == --check ]]; then
  python3 - <<'PY'
from pathlib import Path
required = ['apps/donor-web/package.json', 'deploy/nginx/donor.bloodchain.uz.conf', 'compose.web.yml', 'Dockerfile.web']
for name in required:
    if not Path(name).is_file():
        raise SystemExit('Missing: ' + name)
if 'WEB_APP: donor-web' not in Path('compose.web.yml').read_text():
    raise SystemExit('Missing donor service')
print('Donor deployment files OK; no server changes made.')
PY
  exit
fi
[[ $(id -u) == 0 ]] || { echo 'Run this deployment as root on the VPS.' >&2; exit 1; }
: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL to the certificate administrator email}"
for command in docker nginx certbot python3 curl flock; do command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }; done
[[ -f .env ]] || { echo 'Existing production .env is required.' >&2; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo 'Tracked local changes exist; preserve/review them first.' >&2; exit 1; }
exec 9>/run/lock/bloodchain-donor-deploy.lock
flock -n 9 || { echo 'Another donor deployment is active.' >&2; exit 1; }
python3 - <<'PY'
import socket
addresses = {item[4][0] for item in socket.getaddrinfo('donor.bloodchain.uz', 443, socket.AF_INET)}
if '45.130.148.59' not in addresses:
    raise SystemExit('Point donor.bloodchain.uz DNS A to 45.130.148.59 before deployment.')
print('DNS destination verified.')
PY
nginx -t
"${compose[@]}" config --services | grep -qx donor-web
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/root/bloodchain-backups/donor-$stamp"
mkdir -p "$backup"
cp -p .env "$backup/environment"
git rev-parse HEAD > "$backup/release-commit"
"${compose[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup/database.dump"
test -s "$backup/database.dump"
"${compose[@]}" exec -T postgres pg_restore --list < "$backup/database.dump" > /dev/null
for service in api donor-web landing-web; do
  container=$("${compose[@]}" ps -q "$service")
  if [[ -n "$container" ]]; then
    image=$(docker inspect "$container" --format '{{.Image}}')
    tag="bloodchain-donor-rollback-$service:$stamp"
    docker image tag "$image" "$tag"
    echo "$service $tag" >> "$backup/previous-images.txt"
  fi
done
printf 'Backup verified: %s\n' "$backup"
# Build sequentially on the 4 GB VPS. Existing containers keep serving during builds.
"${compose[@]}" build donor-web
"${compose[@]}" build api
"${compose[@]}" build landing-web
# Preserve existing environment values, replacing only the two donor origin keys.
python3 - <<'PY'
from pathlib import Path
import os, re
path = Path('.env')
text = path.read_text()
for key in ('DONOR_ORIGIN', 'WEB_URL_DONOR'):
    line = key + '=https://donor.bloodchain.uz'
    pattern = r'^' + re.escape(key) + r'=.*$'
    text = re.sub(pattern, line, text, flags=re.M) if re.search(pattern, text, re.M) else text.rstrip() + '\n' + line + '\n'
replacement = path.with_name('.env.donor-next')
replacement.write_text(text)
replacement.chmod(0o600)
os.replace(replacement, path)
PY
"${compose[@]}" up -d --no-deps api donor-web landing-web
curl --fail --silent --show-error --retry 15 --retry-all-errors --retry-delay 3 --max-time 10 http://127.0.0.1:3001/api/v1/health > /dev/null
curl --fail --silent --show-error --retry 15 --retry-all-errors --retry-delay 3 --max-time 10 http://127.0.0.1:3005/auth > /dev/null
site=/etc/nginx/sites-available/bloodchain-donor
if [[ -f "$site" ]]; then
  grep -q '^# Managed by BloodChain donor deployment.' "$site" || { echo "Existing unmanaged $site; review it before replacing." >&2; exit 1; }
  cp -p "$site" "$backup/nginx-donor.conf"
else
  install -m 0644 deploy/nginx/donor.bloodchain.uz.conf "$site"
fi
if [[ ! -f /etc/nginx/conf.d/bloodchain-privacy-log.conf ]]; then
  install -m 0644 deploy/nginx/bloodchain-privacy-log.conf /etc/nginx/conf.d/bloodchain-privacy-log.conf
fi
ln -sfn "$site" /etc/nginx/sites-enabled/bloodchain-donor
nginx -t
systemctl reload nginx
certbot --nginx --non-interactive --agree-tos --redirect --email "$CERTBOT_EMAIL" -d "$domain"
nginx -t
curl --fail --silent --show-error --retry 5 --max-time 15 "$origin/auth" > /dev/null
status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$origin/api/v1/auth/me")
[[ "$status" == 401 ]] || { echo "Expected unauthenticated gateway HTTP 401, received $status" >&2; exit 1; }
"${compose[@]}" ps api donor-web landing-web
printf 'DONOR_DEPLOY_OK %s\nRollback references: %s\n' "$origin" "$backup"

#!/usr/bin/env bash
# Disposable release QA. Never mounts the live .env or uses the live database.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
qa_tmp=$(mktemp -d)
qa_pg="bloodchain-release-qa-pg-$$"
qa_runner="bloodchain-release-qa-runner-$$"
cleanup() {
  docker rm -fv "$qa_runner" "$qa_pg" >/dev/null 2>&1 || true
  rm -rf "$qa_tmp"
}
trap cleanup EXIT
umask 077
qa_password=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
printf 'POSTGRES_USER=qa\nPOSTGRES_DB=bloodchain_release_test\nPOSTGRES_PASSWORD=%s\n' "$qa_password" > "$qa_tmp/postgres.env"
cat > "$qa_tmp/api.env" <<EOF
DATABASE_URL=postgresql://qa:${qa_password}@127.0.0.1:5432/bloodchain_release_test
JWT_ACCESS_SECRET=ci-only-release-qa-access-secret-for-disposable-tests
JWT_REFRESH_SECRET=ci-only-release-qa-refresh-secret-for-disposable-tests
NODE_ENV=development
PORT=3001
API_URL=http://127.0.0.1:3001
WEB_URL=http://localhost:3000,http://localhost:3002,http://localhost:3003
SMS_PROVIDER=console
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=BloodChain QA <qa@donor.local>
AUTH_THROTTLE_LIMIT=100
AI_ENABLED=false
EOF
qa_image=${BLOODCHAIN_QA_IMAGE:-bloodchain-release-qa:local}
if [[ -z ${BLOODCHAIN_QA_IMAGE:-} ]]; then
  docker build -f "$repo/apps/api/Dockerfile" -t "$qa_image" "$repo"
fi
docker run -d --name "$qa_pg" --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,size=512m \
  --env-file "$qa_tmp/postgres.env" postgres:16-alpine >/dev/null
for attempt in {1..60}; do
  if docker exec "$qa_pg" pg_isready -U qa -d bloodchain_release_test >/dev/null 2>&1; then break; fi
  if [[ $attempt == 60 ]]; then echo 'QA database did not become ready' >&2; exit 1; fi
  sleep 1
done
# Sharing only this disposable PostgreSQL container's network gives the seed
# guard its required loopback URL. No ports are published and no egress exists.
# Root can read private source checkouts; mounts are read-only and the runner
# has no Docker socket. Production images continue to run as their non-root user.
docker run -d --name "$qa_runner" --network "container:$qa_pg" \
  --user 0 \
  --env-file "$qa_tmp/api.env" --workdir /repo \
  -v "$repo/apps/api/src:/repo/apps/api/src:ro" \
  -v "$repo/apps/api/test:/repo/apps/api/test:ro" \
  -v "$repo/apps/api/prisma:/repo/apps/api/prisma:ro" \
  -v "$repo/apps/api/prisma.config.ts:/repo/apps/api/prisma.config.ts:ro" \
  -v "$repo/apps/api/tsconfig.json:/repo/apps/api/tsconfig.json:ro" \
  -v "$repo/apps/api/docker-entrypoint.sh:/repo/apps/api/docker-entrypoint.sh:ro" \
  -v "$repo/tsconfig.json:/repo/tsconfig.json:ro" \
  -v "$repo/packages:/repo/packages:ro" \
  -v "$repo/scripts:/repo/scripts:ro" \
  --entrypoint sh "$qa_image" -c 'sleep infinity' >/dev/null
wait_ready() {
  for attempt in {1..60}; do
    if docker exec "$qa_runner" node -e 'fetch("http://127.0.0.1:3001/api/v1/health/ready").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then return; fi
    sleep 1
  done
  docker exec "$qa_runner" cat /tmp/qa-api.log
  return 1
}
# A bad production configuration must fail before even creating migration tables.
if docker exec -e NODE_ENV=production -w /repo/apps/api "$qa_runner" sh ./docker-entrypoint.sh > "$qa_tmp/guard.log" 2>&1; then
  echo 'Unsafe production configuration unexpectedly booted' >&2; exit 1
fi
if ! grep -q SMS_PROVIDER_DEVELOPMENT "$qa_tmp/guard.log"; then
  cat "$qa_tmp/guard.log" >&2
  echo 'Startup failed without exercising the production guard' >&2; exit 1
fi
untouched=$(docker exec "$qa_pg" psql -U qa -d bloodchain_release_test -tAc "SELECT to_regclass('public._prisma_migrations') IS NULL")
[[ $untouched == t ]] || { echo 'Invalid configuration changed the database' >&2; exit 1; }
reference_counts() {
  docker exec -w /repo/apps/api "$qa_runner" node -e '
    const {PrismaClient}=require("@prisma/client"); const db=new PrismaClient();
    (async()=>{ const [roles,permissions,grants,regions,users,organizations]=await Promise.all([
      db.role.count(),db.permission.count(),db.rolePermission.count(),db.region.count(),db.user.count(),db.organization.count()]);
      if(!roles||!permissions||!grants||!regions||users||organizations) throw Error("Invalid reference-only bootstrap");
      console.log(JSON.stringify({roles,permissions,grants,regions,users,organizations}));
    })().catch(()=>{process.exitCode=1}).finally(()=>db.$disconnect());'
}
for boot in 1 2; do
  docker exec -d -w /repo/apps/api "$qa_runner" sh -c 'echo $$ > /tmp/qa-entrypoint.pid; exec sh ./docker-entrypoint.sh > /tmp/qa-api.log 2>&1'
  wait_ready
  counts=$(reference_counts)
  if [[ $boot == 1 ]]; then first_counts=$counts; else [[ $counts == "$first_counts" ]]; fi
  docker exec "$qa_runner" sh -c 'kill "$(cat /tmp/qa-entrypoint.pid)"'
  for attempt in {1..30}; do
    if docker exec "$qa_runner" node -e 'fetch("http://127.0.0.1:3001/api/v1/health/live").then(()=>process.exit(1)).catch(()=>process.exit(0))'; then break; fi
    if [[ $attempt == 30 ]]; then echo 'QA entrypoint API did not stop' >&2; exit 1; fi
    sleep 1
  done
done
echo "Reference-only bootstrap passed twice: $first_counts"
if [[ ${BLOODCHAIN_QA_BOOTSTRAP_ONLY:-0} == 1 ]]; then
  echo 'Container bootstrap QA passed.'; exit 0
fi
docker exec -w /repo/apps/api "$qa_runner" ./node_modules/.bin/tsx prisma/seed.ts
docker exec -w /repo/apps/api "$qa_runner" ./node_modules/.bin/jest --config ./test/jest-e2e.json --runInBand --forceExit
docker exec -d "$qa_runner" sh -c 'exec node /repo/apps/api/dist/src/main.js > /tmp/qa-api.log 2>&1'
wait_ready
docker exec "$qa_runner" node scripts/recovery-verify.mjs
echo 'Release QA passed: isolated API/database suite and real local SMTP journeys.'

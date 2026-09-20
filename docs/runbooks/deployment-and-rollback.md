# Deployment and rollback

**Blockers:** IN-05 (migration strategy), and the deployment half of IN-01 ·
**Owner:** ENG + INFRA · **Gate:** PILOT

What to run, in what order, and what to do when it goes wrong. This is the
engineering half of IN-05. The half it cannot close is that there is no
production environment yet to deploy *to* — that is IN-01, and it needs a
hosting decision nobody has made.

---

## Before anything: the API refuses unsafe production configuration

Since Sprint 8, an API told `NODE_ENV=production` checks its configuration
before it constructs anything, and refuses to start with a list of what is
wrong. You will meet this on the first deployment. It is not an obstacle to
work around — each item is a way donor data, a one-time code or a
password-reset link reaches somewhere it should not.

Dry-run it before you deploy:

```bash
NODE_ENV=production \
JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... \
SMS_PROVIDER=... SMTP_HOST=... \
WEB_URL=https://... API_URL=https://... \
node apps/api/dist/src/main.js
```

It either starts, or prints every problem with a remedy. The full rule set is
`apps/api/src/config/production-config.ts`, and every rule has a test.

---

## Deploying

### 1. Verify the build you are about to ship

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

CI runs these on every push to `claude/local-test-ready`, plus the verification
scripts against a live API. A deployment should be of a commit CI has passed.

### 2. Back up first, and prove the backup

Not "take a backup" — **prove** it. A backup nobody has restored is a file.

```bash
BACKUP_SOURCE_URL="postgresql://…/bloodchain" pnpm verify:backup
```

See [`backup-and-restore.md`](backup-and-restore.md). Do not proceed past a
failing backup check.

### 3. Apply migrations

```bash
pnpm --filter @bloodchain/api exec prisma migrate deploy
```

`migrate deploy` applies pending migrations and never generates, resets or
prompts — it is the production command. `prisma migrate dev` must never be run
against a production database: it can reset.

### 4. Write the reference data

```bash
pnpm db:seed:reference
```

Idempotent and upsert-only, so it runs on **every** deploy, not only the first
— that is how a newly added permission reaches an existing deployment.

On a first deployment it is not optional: migrations create empty tables, and
without roles and permissions registration fails and every guard refuses. The
demo seed cannot do this job — it TRUNCATEs, and refuses to run outside a local
database.

It writes no users. Create the first administrator yourself; a script that
invents a password has to either print it or keep it.

### 5. Deploy the application, then confirm readiness

```bash
curl -fsS https://api.example/api/v1/health/ready
```

`ready` answers 200 only when the database is reachable **and** the schema
carries no unfinished or rolled-back migration. It names the latest applied
migration, so you can confirm the schema is the one this build expects.

### 6. Watch

- `/api/v1/health/live` — liveness. Never touches the database.
- `/api/v1/health/ready` — readiness. Take an instance out of the load balancer
  on 503; do **not** restart it.

---

## Rolling back

### What rollback means here

**No migration in this repository drops a column or a table.** That was checked
across all 18 migrations: the only `DROP COLUMN` in the tree is inside a comment
explaining that it was deliberately avoided, and the only `DROP CONSTRAINT` is a
foreign-key correction. Every migration so far is additive.

That has one useful consequence and one trap.

- **Useful:** an older build of the API generally runs against a newer schema,
  because the columns it knows about are all still there. So the fast rollback
  is to redeploy the previous application build and leave the database alone.
- **The trap:** this is a property of the migrations written so far, not a
  guarantee about the next one. Check the migration before assuming it.

### Rollback decision

```
Is the problem in the application, with the schema unchanged?
  → Redeploy the previous build. Do not touch the database.

Did a migration apply and is the new schema the problem?
  → Was it additive (new columns/tables only)?
      YES → Redeploy the previous build. The new columns are unused and harmless.
      NO  → Restore from the backup taken in step 2. See backup-and-restore.md.
            Prisma has no `migrate down`. Restore is the rollback.

Did a migration fail part-way?
  → /health/ready reports `migrations: incomplete` and names it.
    Do NOT deploy over it and do NOT re-run migrate deploy blindly.
    Restore from backup, fix the migration, redeploy.
```

### Why there is no `migrate down`

Prisma does not generate down-migrations, and hand-writing one for a migration
that has already run against real data is how data is lost twice. The backup is
the rollback path, which is why step 2 is not optional and why the backup is
verified rather than assumed.

---

## Pre-deployment checklist

- [ ] CI green on the exact commit
- [ ] `pnpm verify:backup` passed against production, within the hour
- [ ] `pnpm db:seed:reference` in the deploy steps
- [ ] Migrations reviewed: additive, or a restore plan written down
- [ ] Production configuration dry-run starts without refusal
- [ ] `/health/ready` checked immediately after deployment
- [ ] Someone is watching for the next 30 minutes

---

## What this runbook cannot tell you

These need the operator, not engineering:

- Which hosting platform (IN-01), and therefore what "deploy the application"
  concretely means.
- The maintenance window, and whether the pilot tolerates downtime at all.
- Who is on call (MO-06), and who decides to roll back.

# Backup and restore

**Blockers:** DG-03 (no backup procedure), MO-04 (no rehearsed restore) ·
**Owner:** INFRA · **Gate:** PILOT

DG-03 and MO-04 are one problem written twice. The second half is the one that
bites: a backup nobody has restored is not a backup, it is a file, and the first
time anyone finds out whether it is a *good* file is the morning they need it.

So this repository ships a script that performs the restore rather than a
document describing one.

---

## Proving a backup

```bash
# Against the database DATABASE_URL points at
pnpm verify:backup

# Against a specific database
BACKUP_SOURCE_URL="postgresql://user:pass@host:5432/bloodchain" pnpm verify:backup
```

What it does:

1. `pg_dump -Fc` the source — read-only; the source is never written to.
2. Create a scratch database named `<source>_restore_test` and restore into it.
3. Compare the restored copy against the source: every table present, every row
   count equal, and the rows a blood service cannot lose checked by name —
   `User`, `Donation`, `BloodUnit`, `ReleaseDecision`, `DonorDeferral`,
   `BloodUnitDisposition`, `AuditLog`.
4. Confirm the restored schema carries no unfinished or rolled-back migration,
   because a database that cannot be migrated forward is not a recovery target.
5. Drop the scratch database.

Output on success:

```
  ✓ pg_dump produced a non-empty backup — 393 KiB
  ✓ every table came back — 85 tables
  ✓ every table came back with the same number of rows — 2178 rows total
  ✓ donation, blood-unit, release-decision, deferral and audit rows all match
  ✓ the restored schema has no unfinished or rolled-back migrations
```

A failure means the backup would not restore. Fix it before it is the only copy.

### Two safety properties

- **The source is only ever read.** `pg_dump` and `SELECT`. Nothing in the
  script can write to, truncate or drop the database being backed up.
- **The scratch database is guarded like every other destructive operation
  here.** It is created and dropped, so it goes through the same
  `checkLocalDatabase` rules as the demo seed: loopback host, development
  environment, disposable name.

---

## Taking a backup

```bash
pg_dump -Fc -f "bloodchain-$(date -u +%Y%m%dT%H%M%SZ).dump" -d "$DATABASE_URL"
```

Custom format (`-Fc`) because it compresses and `pg_restore` can work
selectively — which is what a real recovery wants. Plain SQL is easier to read
and worse to restore from.

## Restoring for real

```bash
# 1. Prove the file first. Never restore an unverified dump over live data.
BACKUP_SOURCE_URL="postgresql://…/bloodchain" pnpm verify:backup

# 2. Stop the API. A restore under a live writer produces a database that
#    matches neither the backup nor what the application thinks is there.

# 3. Restore into a NEW database, never over the damaged one — the damaged one
#    is evidence, and you may need it.
createdb bloodchain_restored
pg_restore --no-owner --no-acl -d bloodchain_restored backup.dump

# 4. Check what came back before cutting over.
psql -d bloodchain_restored -c 'SELECT count(*) FROM "Donation"'
psql -d bloodchain_restored -c 'SELECT count(*) FROM "BloodUnit"'
psql -d bloodchain_restored -c 'SELECT count(*) FROM "ReleaseDecision"'

# 5. Point DATABASE_URL at it and start the API.
curl -fsS https://api.example/api/v1/health/ready
```

### What a restore loses

Everything written between the backup and the failure. For this system that is
not an abstraction:

- **Donations and blood units** collected in the gap exist physically and not in
  the database. They must be re-entered, and until they are, stock is wrong.
- **Release decisions** in the gap are lost, so units released in that window
  revert to *not released* — which fails closed, correctly, and means staff must
  release them again under the policy in force.
- **Deferrals** raised in the gap are lost, and a donor deferred in that window
  becomes bookable again. This is the most dangerous single loss in a restore
  and the reason the backup interval matters.

Write down, at recovery time, the exact window lost. Staff need to know what to
re-enter.

---

## What the operator must decide

Engineering cannot answer these, and the blocker is not closed until they are:

| Decision | Why it is not ours |
| --- | --- |
| **Backup frequency** | How much donation and deferral history the operator can tolerate re-entering by hand. |
| **Retention period** | Interacts with the data-retention schedule, which is an open legal question (`review-packs/legal-privacy-review.md` LP-05). |
| **Where backups are stored** | Off-host at minimum. A backup on the database server is not a backup. |
| **Encryption at rest** | These dumps contain donor health data. |
| **Who may restore** | A restore is the single most destructive operation available. |
| **Rehearsal cadence** | `pnpm verify:backup` makes this cheap; how often it runs against production is an operational choice. |

---

## Related

- [`deployment-and-rollback.md`](deployment-and-rollback.md) — restore is the
  rollback path; Prisma has no `migrate down`.
- `docs/production-readiness.md` — DG-03, MO-04.

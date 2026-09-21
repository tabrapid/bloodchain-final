import { INestApplication } from '@nestjs/common';

import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './utils/e2e';

/**
 * The audit trail is append-only, proved against the database rather than the
 * application.
 *
 * docs/security.md claimed for a long time that database triggers enforced
 * this. They did not exist -- no trigger in any migration, no ORM middleware,
 * no revoked privilege -- so the audit trail was an ordinary table that
 * anything holding a connection could rewrite. A control that lives only in a
 * document is worse than a missing one, because people rely on it.
 *
 * These assertions go through `$executeRawUnsafe`, deliberately. Testing this
 * through the Prisma client would only prove that the application does not
 * call `update` -- which was already true, and was exactly the reassurance that
 * let the gap survive. The threat is code that DOES call it, so the test has to
 * be the thing that calls it.
 *
 * What is NOT claimed: cryptographic immutability. There is no hash chain and
 * no signature, and somebody with SQL privileges can drop the trigger. What is
 * claimed is that no application code, migration, ORM call or careless hand at
 * a prompt rewrites audit history by accident.
 */
describe('AuditLog is append-only at the database boundary', () => {
  let app: INestApplication;
  let db: PrismaService;
  const id = `audit_immutability_${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
  });

  afterAll(async () => {
    // Nothing to clean up, and that is the point: this row cannot be deleted.
    // It is a handful of bytes in a table that is supposed to accumulate.
    await app.close();
  });

  it('allows an insert', async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO "AuditLog" (id, action, "entityType", "createdAt") VALUES ($1, $2, $3, now())`,
      id,
      'AUDIT_IMMUTABILITY_PROOF',
      'Proof',
    );

    const rows = await db.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "AuditLog" WHERE id = $1`,
      id,
    );
    expect(rows).toHaveLength(1);
  });

  it('refuses an update, in the database', async () => {
    await expect(
      db.$executeRawUnsafe(`UPDATE "AuditLog" SET action = 'TAMPERED' WHERE id = $1`, id),
    ).rejects.toThrow(/append-only/i);
  });

  it('refuses a delete, in the database', async () => {
    await expect(
      db.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE id = $1`, id),
    ).rejects.toThrow(/append-only/i);
  });

  it('leaves the record exactly as it was written', async () => {
    const rows = await db.$queryRawUnsafe<{ id: string; action: string }[]>(
      `SELECT id, action FROM "AuditLog" WHERE id = $1`,
      id,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('AUDIT_IMMUTABILITY_PROOF');
  });

  it('refuses a blanket delete as well as a targeted one', async () => {
    // The shape a careless cleanup actually takes.
    await expect(
      db.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE "entityType" = 'Proof'`),
    ).rejects.toThrow(/append-only/i);
  });

  it('refuses the ORM route too, not just raw SQL', async () => {
    await expect(
      db.auditLog.updateMany({
        where: { id },
        data: { action: 'TAMPERED_VIA_ORM' },
      }),
    ).rejects.toThrow(/append-only/i);
  });

  /**
   * The one permitted update, and the line around it.
   *
   * `actorId` and `organizationId` are `onDelete: SetNull`, and Postgres
   * implements SET NULL as an UPDATE on this table. A trigger that refused all
   * updates therefore made it impossible to delete a user who had ever appeared
   * in an audit entry -- which is every real user, and would have made the
   * account-deletion path impossible.
   *
   * Detaching a dangling key changes nothing the entry asserts: who did what to
   * which record when is all still there, and every one of those columns has to
   * be byte-identical for the update to be allowed at all.
   */
  it('allows a foreign key to be detached to NULL by a referential action', async () => {
    await expect(
      db.$executeRawUnsafe(`UPDATE "AuditLog" SET "actorId" = NULL WHERE id = $1`, id),
    ).resolves.toBeGreaterThanOrEqual(0);
  });

  it('refuses pointing the entry at a different actor', async () => {
    // Not a detach. This would rewrite who did it, which is the whole content
    // of an audit entry.
    await expect(
      db.$executeRawUnsafe(`UPDATE "AuditLog" SET "actorId" = 'someone-else' WHERE id = $1`, id),
    ).rejects.toThrow(/append-only/i);
  });

  it('refuses a content change even when a key is being detached in the same statement', async () => {
    await expect(
      db.$executeRawUnsafe(
        `UPDATE "AuditLog" SET "organizationId" = NULL, action = 'TAMPERED' WHERE id = $1`,
        id,
      ),
    ).rejects.toThrow(/append-only/i);
  });
});

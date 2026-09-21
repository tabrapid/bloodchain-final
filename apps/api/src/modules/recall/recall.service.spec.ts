import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BloodUnitHoldKind,
  BloodUnitStatus,
  DispositionType,
  RecallCaseStatus,
  RecallComponentState,
  RoleCode,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { HoldsService } from '../custody/holds.service';
import { RecallService, RecallTrigger } from './recall.service';

/**
 * Recall as a second axis, never a status rewrite.
 *
 * Two mistakes are available here and both are tempting. The first is writing
 * `status = RECALLED` onto every affected component, which destroys the chain a
 * recall exists to follow. The second is reading `BloodUnitStatus.USED` as
 * "transfused" -- a unit reaches USED by being issued, shipped or discarded at
 * a hospital, and only a disposition says which. A recall that confuses the two
 * either chases blood that is already in a patient or, far worse, reports a
 * transfused unit as retrievable.
 */
describe('RecallService', () => {
  let service: RecallService;
  let prisma: any;
  let tx: any;
  let holds: { raiseInTransaction: jest.Mock };
  let audit: { log: jest.Mock };

  const ORG = 'org-1';
  const OTHER_ORG = 'org-2';

  function unit(overrides: Record<string, any> = {}) {
    return {
      id: 'unit-1',
      unitReference: 'BU-2026-000001',
      organizationId: ORG,
      status: BloodUnitStatus.AVAILABLE,
      disposition: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    tx = {
      recallCase: {
        create: jest.fn().mockResolvedValue({ id: 'case-1', recallReference: 'RCL-2026-000001' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bloodUnit: { findMany: jest.fn().mockResolvedValue([unit()]) },
      recallAffectedComponent: { create: jest.fn().mockResolvedValue({}) },
      recallAcknowledgement: { create: jest.fn().mockResolvedValue({ id: 'ack-1' }) },
    };

    prisma = {
      organizationMembership: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { organizationId: ORG, status: 'ACTIVE', role: { code: RoleCode.BLOOD_CENTER_STAFF } },
          ]),
      },
      donation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'donation-1',
          organizationId: ORG,
          donationReference: 'DONATION-2026-000001',
        }),
      },
      recallCase: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          organizationId: ORG,
          status: RecallCaseStatus.OPEN,
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'case-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'case-1',
          recallReference: 'RCL-2026-000001',
          organizationId: ORG,
          status: RecallCaseStatus.OPEN,
          triggerKind: RecallTrigger.MANUAL,
          reasonCode: null,
          operationalReason: 'Quarantine and await instructions.',
          confidentialDetail: 'CONFIDENTIAL-MARKER clinical detail',
          donation: { id: 'donation-1', donationReference: 'DONATION-2026-000001' },
          openedAt: new Date(),
          closedAt: null,
          closureNote: null,
          components: [
            {
              id: 'component-1',
              bloodUnitId: 'unit-1',
              state: RecallComponentState.QUARANTINED,
              statusAtRecall: BloodUnitStatus.AVAILABLE,
              holdingOrganizationId: ORG,
              holdId: 'hold-1',
              note: null,
              bloodUnit: {
                id: 'unit-1',
                unitReference: 'BU-2026-000001',
                componentType: 'RED_CELLS',
                status: BloodUnitStatus.AVAILABLE,
              },
            },
          ],
          acknowledgements: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      recallAffectedComponent: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'component-1',
          state: RecallComponentState.QUARANTINED,
          holdingOrganizationId: ORG,
          bloodUnitId: 'unit-1',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      recallAcknowledgement: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    holds = { raiseInTransaction: jest.fn().mockResolvedValue({ id: 'hold-1' }) };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecallService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
        { provide: HoldsService, useValue: holds },
      ],
    }).compile();

    service = module.get(RecallService);
  });

  const open = () =>
    service.openForDonationInTransaction(tx, {
      donationId: 'donation-1',
      organizationId: ORG,
      triggerKind: RecallTrigger.SCREENING_RESULT_CORRECTED,
      openedBy: 'staff-1',
    });

  describe('what a recall does to a component', () => {
    it('never writes the component\'s own status', async () => {
      await open();

      // The single most important assertion in this file. There is no
      // `bloodUnit.update` and no `bloodUnit.updateMany` in the transaction at
      // all: a recall records what it found and stops the component moving with
      // a hold, which every path into usable stock already refuses.
      expect(tx.bloodUnit).not.toHaveProperty('update');
      expect(Object.keys(tx.bloodUnit)).toEqual(['findMany']);
    });

    it('snapshots the status it found rather than replacing it', async () => {
      tx.bloodUnit.findMany.mockResolvedValue([unit({ status: BloodUnitStatus.RESERVED })]);

      await open();

      expect(tx.recallAffectedComponent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ statusAtRecall: BloodUnitStatus.RESERVED }),
        }),
      );
    });

    it('quarantines a component that is still retrievable, with a neutral hold kind', async () => {
      await open();

      expect(holds.raiseInTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          bloodUnitId: 'unit-1',
          // QUALITY_HOLD, not REACTIVE. The kind reaches labels and consoles,
          // and naming a clinical finding there would be a claim about the
          // donor that nobody has made.
          kind: BloodUnitHoldKind.QUALITY_HOLD,
          reasonCode: 'RECALL',
        }),
      );
      expect(tx.recallAffectedComponent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: RecallComponentState.QUARANTINED }),
        }),
      );
    });

    it('raises the hold at the organization physically holding the component', async () => {
      // After a shipment that is not the organisation opening the recall.
      tx.bloodUnit.findMany.mockResolvedValue([unit({ organizationId: OTHER_ORG })]);

      await open();

      expect(holds.raiseInTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ organizationId: OTHER_ORG }),
      );
    });

    it('carries no clinical detail into the hold reason a console will display', async () => {
      await open();

      const raised = holds.raiseInTransaction.mock.calls[0][1];
      expect(raised.reasonText).toContain('RCL-2026-000001');
      expect(raised.reasonText).not.toMatch(/reactive|positive|infect|disposition|donor/i);
    });
  });

  describe('transfused is read from the disposition, never from the status', () => {
    it('marks a transfused component as transfused before the recall, and does not hold it', async () => {
      tx.bloodUnit.findMany.mockResolvedValue([
        unit({
          status: BloodUnitStatus.USED,
          disposition: { type: DispositionType.TRANSFUSED, shipmentId: null },
        }),
      ]);

      const opened = await open();

      expect(tx.recallAffectedComponent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            state: RecallComponentState.TRANSFUSED_BEFORE_RECALL,
          }),
        }),
      );
      // You cannot quarantine what is already in a patient.
      expect(holds.raiseInTransaction).not.toHaveBeenCalled();
      expect(opened.alreadyTransfusedCount).toBe(1);
    });

    it('does NOT treat USED as transfused when the disposition says otherwise', async () => {
      // A unit reaches USED by being issued or shipped. Reporting one of those
      // as unretrievable would abandon blood that is sitting in a fridge.
      tx.bloodUnit.findMany.mockResolvedValue([
        unit({
          status: BloodUnitStatus.USED,
          disposition: { type: DispositionType.ISSUED, shipmentId: 'shipment-1' },
        }),
      ]);

      const opened = await open();

      expect(opened.alreadyTransfusedCount).toBe(0);
      expect(opened.quarantinedCount).toBe(1);
      expect(holds.raiseInTransaction).toHaveBeenCalled();
    });

    it('does not treat USED with no disposition at all as transfused', async () => {
      tx.bloodUnit.findMany.mockResolvedValue([
        unit({ status: BloodUnitStatus.USED, disposition: null }),
      ]);

      const opened = await open();

      expect(opened.alreadyTransfusedCount).toBe(0);
    });

    it('does not hold a component that is already discarded or expired', async () => {
      tx.bloodUnit.findMany.mockResolvedValue([
        unit({ id: 'unit-a', status: BloodUnitStatus.DISCARDED }),
        unit({ id: 'unit-b', status: BloodUnitStatus.EXPIRED }),
      ]);

      const opened = await open();

      expect(holds.raiseInTransaction).not.toHaveBeenCalled();
      expect(opened.affectedCount).toBe(2);
      expect(opened.quarantinedCount).toBe(0);
    });
  });

  describe('recording what became of a component', () => {
    it('refuses to rewrite a component that was already in a patient', async () => {
      prisma.recallAffectedComponent.findFirst.mockResolvedValue({
        id: 'component-1',
        state: RecallComponentState.TRANSFUSED_BEFORE_RECALL,
        holdingOrganizationId: ORG,
        bloodUnitId: 'unit-1',
      });

      await expect(
        service.updateComponentState(ORG, 'case-1', 'component-1', 'staff-1', {
          state: RecallComponentState.DESTROYED,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses an organization that is not holding the component', async () => {
      prisma.recallAffectedComponent.findFirst.mockResolvedValue({
        id: 'component-1',
        state: RecallComponentState.QUARANTINED,
        holdingOrganizationId: OTHER_ORG,
        bloodUnitId: 'unit-1',
      });

      await expect(
        service.updateComponentState(ORG, 'case-1', 'component-1', 'staff-1', {
          state: RecallComponentState.RETURNED,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('closing a recall', () => {
    it('does not lift the holds it raised', async () => {
      // A hold is lifted by the quality workflow that owns it, with its own
      // reason and actor. Lifting one as a side effect of an administrative
      // status change is the implicit release Sprint 9 spent itself removing.
      await service.close(ORG, 'case-1', 'staff-1', { closureNote: 'Done.' });

      expect(holds).not.toHaveProperty('resolve');
      expect(JSON.stringify(prisma.recallCase.updateMany.mock.calls)).not.toMatch(/hold/i);
    });

    it('refuses an organization that did not open it', async () => {
      prisma.recallCase.findUnique.mockResolvedValue({
        id: 'case-1',
        organizationId: OTHER_ORG,
        status: RecallCaseStatus.OPEN,
      });

      await expect(service.close(ORG, 'case-1', 'staff-1', {})).rejects.toThrow(ForbiddenException);
    });

    it('refuses to close one that is already closed', async () => {
      prisma.recallCase.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.close(ORG, 'case-1', 'staff-1', {})).rejects.toThrow(ConflictException);
    });
  });

  describe('what each organization may read', () => {
    it('gives the opening organization the clinical detail', async () => {
      const view = await service.getCase(ORG, 'case-1', 'staff-1');

      expect((view.data as any).confidentialDetail).toContain('CONFIDENTIAL-MARKER');
      expect(view.data.isOpener).toBe(true);
    });

    it('gives another organization the operational instruction and not the clinical detail', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        { organizationId: OTHER_ORG, status: 'ACTIVE', role: { code: RoleCode.HOSPITAL_STAFF } },
      ]);
      prisma.recallCase.findUniqueOrThrow.mockResolvedValue({
        ...(await prisma.recallCase.findUniqueOrThrow()),
        components: [
          {
            id: 'component-1',
            bloodUnitId: 'unit-1',
            state: RecallComponentState.QUARANTINED,
            statusAtRecall: BloodUnitStatus.AVAILABLE,
            holdingOrganizationId: OTHER_ORG,
            holdId: 'hold-1',
            note: null,
            bloodUnit: {
              id: 'unit-1',
              unitReference: 'BU-2026-000001',
              componentType: 'RED_CELLS',
              status: BloodUnitStatus.AVAILABLE,
            },
          },
        ],
      });

      const view = await service.getCase(OTHER_ORG, 'case-1', 'staff-2');
      const serialised = JSON.stringify(view);

      expect(view.data.operationalReason).toContain('Quarantine');
      // Absent as a key at all, not present and null: an explicit null would
      // tell a hospital that clinical detail exists and is being withheld.
      expect(Object.keys(view.data)).not.toContain('confidentialDetail');
      expect(serialised).not.toContain('CONFIDENTIAL-MARKER');
    });
  });

  describe('who may open one', () => {
    it('refuses a hospital recalling another organization\'s donation', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        { organizationId: OTHER_ORG, status: 'ACTIVE', role: { code: RoleCode.HOSPITAL_STAFF } },
      ]);

      await expect(
        service.openForDonation(OTHER_ORG, 'donation-1', 'staff-2', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('records counts and codes in the audit trail, never the clinical detail', async () => {
      await service.openForDonation(ORG, 'donation-1', 'staff-1', {
        confidentialDetail: 'CONFIDENTIAL-MARKER clinical detail',
        operationalReason: 'Quarantine and await instructions.',
      });

      const logged = JSON.stringify(
        audit.log.mock.calls.find((call) => call[0].action === 'RECALL_CASE_OPENED'),
      );
      expect(logged).not.toContain('CONFIDENTIAL-MARKER');
      expect(logged).toContain('affectedCount');
    });
  });
});

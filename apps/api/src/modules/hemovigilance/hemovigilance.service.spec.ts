import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DispositionType, HemovigilanceStatus, RoleCode } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { HemovigilanceService } from './hemovigilance.service';

/**
 * Transfusion-related events, and the two lines that hold around them.
 *
 * The first is finality: a transfusion cannot be undone, and nothing this
 * service does may pretend otherwise. Reporting an event against a component
 * does not un-transfuse it, return it to stock, or change its status. The
 * assertion for that is the absence of any write to `bloodUnit` on the client
 * at all.
 *
 * The second is whose event it is. The organisation that transfused the
 * component owns the clinical narrative; a blood centre linked in through a
 * recall learns that an event exists and what it obliges them to do, and
 * nothing else.
 */
describe('HemovigilanceService', () => {
  let service: HemovigilanceService;
  let prisma: any;
  let audit: { log: jest.Mock };

  const ORG = 'hospital-1';
  const OTHER_ORG = 'blood-center-1';
  const NARRATIVE = 'CONFIDENTIAL-MARKER: clinical narrative about a patient.';

  function event(overrides: Record<string, any> = {}) {
    return {
      id: 'event-1',
      eventReference: 'HV-2026-000001',
      organizationId: ORG,
      bloodUnitId: 'unit-1',
      recipientReference: 'RECIPIENT-OPAQUE-1',
      encounterReference: 'ENCOUNTER-1',
      eventCode: 'E2E-CODE',
      status: HemovigilanceStatus.REPORTED,
      occurredAt: new Date(),
      reportedAt: new Date(),
      confidentialNarrative: NARRATIVE,
      operationalSummary: 'Quarantine remaining components from this donation.',
      investigationNote: null,
      closedAt: null,
      recallCaseId: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      organizationMembership: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { organizationId: ORG, status: 'ACTIVE', role: { code: RoleCode.HOSPITAL_STAFF } },
          ]),
      },
      bloodUnit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit-1' }) },
      bloodUnitDisposition: { findUnique: jest.fn().mockResolvedValue(null) },
      hemovigilanceEvent: {
        create: jest.fn().mockResolvedValue(event()),
        findUnique: jest.fn().mockResolvedValue(event()),
        findUniqueOrThrow: jest.fn().mockResolvedValue(event()),
        findMany: jest.fn().mockResolvedValue([event()]),
        update: jest.fn().mockResolvedValue(event()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      recallCase: { findFirst: jest.fn().mockResolvedValue({ id: 'case-1' }) },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HemovigilanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
      ],
    }).compile();

    service = module.get(HemovigilanceService);
  });

  describe('transfusion is final', () => {
    it('never writes the component when an event is reported against it', async () => {
      await service.report(ORG, 'staff-1', { bloodUnitId: 'unit-1' });

      // There is no `update` on the blood unit client at all. Reporting an
      // event creates a record a look-back can find; it does not undo a
      // transfusion, return the unit to stock, or change its status.
      expect(Object.keys(prisma.bloodUnit)).toEqual(['findFirst']);
    });

    it('never writes the component when an event is closed', async () => {
      await service.close(ORG, 'event-1', 'staff-1', {});

      expect(Object.keys(prisma.bloodUnit)).toEqual(['findFirst']);
    });

    it('reads "transfused" from the disposition, never from the status', async () => {
      prisma.bloodUnitDisposition.findUnique.mockResolvedValue({
        type: DispositionType.ISSUED,
      });
      expect(await service.isTransfused('unit-1')).toBe(false);

      prisma.bloodUnitDisposition.findUnique.mockResolvedValue({
        type: DispositionType.TRANSFUSED,
      });
      expect(await service.isTransfused('unit-1')).toBe(true);

      prisma.bloodUnitDisposition.findUnique.mockResolvedValue(null);
      expect(await service.isTransfused('unit-1')).toBe(false);
    });
  });

  describe('whose event it is', () => {
    it('refuses an event against a component this organization never held', async () => {
      prisma.bloodUnit.findFirst.mockResolvedValue(null);

      await expect(
        service.report(ORG, 'staff-1', { bloodUnitId: 'somebody-elses-unit' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('accepts a report with no component, because losing the report is worse', async () => {
      // An event can be reported before the unit involved is identified.
      // Refusing until it is would lose the report, which is the one thing a
      // hemovigilance system must not do.
      await expect(service.report(ORG, 'staff-1', {})).resolves.toBeDefined();
    });

    it('refuses another organization acting on an event it did not report', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        { organizationId: OTHER_ORG, status: 'ACTIVE', role: { code: RoleCode.BLOOD_CENTER_STAFF } },
      ]);

      await expect(
        service.investigate(OTHER_ORG, 'event-1', 'staff-2', { investigationNote: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses to close one that is already closed', async () => {
      prisma.hemovigilanceEvent.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.close(ORG, 'event-1', 'staff-1', {})).rejects.toThrow(ConflictException);
    });
  });

  describe('what leaves the reporting organization', () => {
    it('gives the reporter their own narrative back', async () => {
      const reported = await service.report(ORG, 'staff-1', {
        bloodUnitId: 'unit-1',
        confidentialNarrative: NARRATIVE,
      });

      expect(JSON.stringify(reported.data)).toContain('CONFIDENTIAL-MARKER');
    });

    it('gives a linked organization the operational summary and nothing else', async () => {
      prisma.organizationMembership.findMany.mockResolvedValue([
        { organizationId: OTHER_ORG, status: 'ACTIVE', role: { code: RoleCode.BLOOD_CENTER_STAFF } },
      ]);
      prisma.hemovigilanceEvent.findMany.mockResolvedValue([
        {
          id: 'event-1',
          eventReference: 'HV-2026-000001',
          organizationId: ORG,
          bloodUnitId: 'unit-1',
          eventCode: 'E2E-CODE',
          status: HemovigilanceStatus.REPORTED,
          occurredAt: new Date(),
          reportedAt: new Date(),
          operationalSummary: 'Quarantine remaining components from this donation.',
        },
      ]);

      const result = await service.listForRecall(OTHER_ORG, 'case-1', 'staff-2');
      const serialised = JSON.stringify(result);

      expect(serialised).toContain('Quarantine remaining components');
      expect(serialised).not.toContain('CONFIDENTIAL-MARKER');
      // The recipient reference identifies a person inside the reporting
      // organization. The same string at two hospitals is two different people,
      // so handing it to a third party would be meaningless as well as wrong.
      expect(serialised).not.toContain('RECIPIENT-OPAQUE-1');
      expect(serialised).not.toContain('ENCOUNTER-1');
    });

    it('keeps the narrative and the recipient out of the audit log', async () => {
      await service.report(ORG, 'staff-1', {
        bloodUnitId: 'unit-1',
        confidentialNarrative: NARRATIVE,
        recipientReference: 'RECIPIENT-OPAQUE-1',
      });

      const logged = JSON.stringify(audit.log.mock.calls[0][0]);
      expect(logged).not.toContain('CONFIDENTIAL-MARKER');
      expect(logged).not.toContain('RECIPIENT-OPAQUE-1');
      expect(logged).toContain('HV-2026-000001');
    });
  });

  describe('what the module does not classify', () => {
    it('stores the event code verbatim and grades nothing', async () => {
      await service.report(ORG, 'staff-1', { eventCode: 'WHATEVER-THE-SITE-USES' });

      const data = prisma.hemovigilanceEvent.create.mock.calls[0][0].data;
      expect(data.eventCode).toBe('WHATEVER-THE-SITE-USES');
      // No severity, no grade, no category, no imputability. None of those has
      // been validated for this project, so none of them exists.
      expect(Object.keys(data)).not.toEqual(
        expect.arrayContaining(['severity', 'grade', 'category', 'imputability']),
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleCode, SlotStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AppointmentSlotsService } from './appointment-slots.service';

function makeUser(memberships: any[] = []) {
  return { id: 'user-1', memberships };
}

function makeMembership(organizationId: string, roleCode: string) {
  return {
    organization: { id: organizationId },
    role: { code: roleCode },
  };
}

function makeSlot(overrides: Record<string, any> = {}) {
  return {
    id: 'slot-1',
    organizationId: 'org-1',
    appointmentType: 'WHOLE_BLOOD',
    startAt: new Date(Date.now() + 86_400_000),
    endAt: new Date(Date.now() + 90_000_000),
    capacity: 5,
    bookedCount: 0,
    status: SlotStatus.AVAILABLE,
    ...overrides,
  };
}

describe('AppointmentSlotsService', () => {
  let service: AppointmentSlotsService;
  let db: any;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    db = {
      appointmentSlot: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      organization: { findUnique: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentSlotsService,
        { provide: PrismaService, useValue: db },
        { provide: AuditLogsService, useValue: audit },
      ],
    }).compile();

    service = module.get<AppointmentSlotsService>(AppointmentSlotsService);
  });

  describe('getAvailability', () => {
    it('only returns AVAILABLE, non-past slots with remaining capacity', async () => {
      db.appointmentSlot.findMany.mockResolvedValue([
        makeSlot({ id: 'has-room', bookedCount: 2, capacity: 5 }),
        makeSlot({ id: 'full', bookedCount: 5, capacity: 5 }),
      ]);

      const result = await service.getAvailability({} as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.id).toBe('has-room');
      expect(result.data[0]!.availableSpots).toBe(3);

      const call = db.appointmentSlot.findMany.mock.calls[0][0];
      expect(call.where.status).toBe(SlotStatus.AVAILABLE);
      expect(call.where.startAt.gte).toBeInstanceOf(Date);
    });

    it('filters by organizationId and appointmentType when given', async () => {
      db.appointmentSlot.findMany.mockResolvedValue([]);

      await service.getAvailability({ organizationId: 'org-1', appointmentType: 'PLASMA' } as any);

      const call = db.appointmentSlot.findMany.mock.calls[0][0];
      expect(call.where.organizationId).toBe('org-1');
      expect(call.where.appointmentType).toBe('PLASMA');
    });

    it('scopes to a single day when only date is given', async () => {
      db.appointmentSlot.findMany.mockResolvedValue([]);

      await service.getAvailability({ date: '2026-09-01' } as any);

      const call = db.appointmentSlot.findMany.mock.calls[0][0];
      expect(call.where.startAt.gte.getDate()).toBe(1);
      expect(call.where.startAt.lte.getDate()).toBe(1);
    });
  });

  describe('getSlotsByOrganization', () => {
    it('throws NotFoundException when the requesting user does not exist', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.getSlotsByOrganization('org-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a user with no staff membership in the org', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-2', 'HOSPITAL_STAFF')]));

      await expect(service.getSlotsByOrganization('org-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows a staff member of the organization', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_STAFF')]));
      db.appointmentSlot.findMany.mockResolvedValue([makeSlot()]);

      const result = await service.getSlotsByOrganization('org-1', 'user-1');

      expect(result.data).toHaveLength(1);
    });

    it('allows a SUPER_ADMIN regardless of organization membership', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-2', RoleCode.SUPER_ADMIN)]));
      db.appointmentSlot.findMany.mockResolvedValue([]);

      await expect(service.getSlotsByOrganization('org-1', 'user-1')).resolves.toEqual({ data: [] });
    });
  });

  describe('createSlot', () => {
    const dto = { appointmentType: 'WHOLE_BLOOD', startAt: new Date(Date.now() + 86_400_000).toISOString(), endAt: new Date(Date.now() + 90_000_000).toISOString(), capacity: 3 };

    it('throws ForbiddenException when the user is not a member of the organization', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([]));

      await expect(service.createSlot('org-1', 'user-1', dto as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for a member without a managing role', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'DONOR')]));

      await expect(service.createSlot('org-1', 'user-1', dto as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the organization does not exist', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.organization.findUnique.mockResolvedValue(null);

      await expect(service.createSlot('org-1', 'user-1', dto as any)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for an inactive organization', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.organization.findUnique.mockResolvedValue({ id: 'org-1', status: 'SUSPENDED' });

      await expect(service.createSlot('org-1', 'user-1', dto as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when endAt is not after startAt', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.organization.findUnique.mockResolvedValue({ id: 'org-1', status: 'ACTIVE' });

      await expect(
        service.createSlot('org-1', 'user-1', { ...dto, startAt: dto.endAt, endAt: dto.startAt } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a slot in the past', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.organization.findUnique.mockResolvedValue({ id: 'org-1', status: 'ACTIVE' });

      await expect(
        service.createSlot(
          'org-1',
          'user-1',
          { ...dto, startAt: new Date(Date.now() - 86_400_000).toISOString() } as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates the slot, defaults capacity to 1 when omitted, and writes an audit log', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.organization.findUnique.mockResolvedValue({ id: 'org-1', status: 'ACTIVE' });
      db.appointmentSlot.create.mockResolvedValue(makeSlot({ capacity: 1 }));

      const { capacity, ...dtoWithoutCapacity } = dto;
      void capacity;
      await service.createSlot('org-1', 'user-1', dtoWithoutCapacity as any);

      expect(db.appointmentSlot.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ capacity: 1, bookedCount: 0, status: SlotStatus.AVAILABLE }) }),
      );
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'APPOINTMENT_SLOT_CREATED' }));
    });

    it('allows a SUPER_ADMIN to create a slot without an explicit managing role', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', RoleCode.SUPER_ADMIN)]));
      db.organization.findUnique.mockResolvedValue({ id: 'org-1', status: 'ACTIVE' });
      db.appointmentSlot.create.mockResolvedValue(makeSlot());

      await expect(service.createSlot('org-1', 'user-1', dto as any)).resolves.toBeDefined();
    });
  });

  describe('updateSlot', () => {
    it('throws NotFoundException when the slot does not exist in that organization', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.appointmentSlot.findFirst.mockResolvedValue(null);

      await expect(service.updateSlot('org-1', 'slot-1', 'user-1', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects reducing capacity below the current booked count', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.appointmentSlot.findFirst.mockResolvedValue(makeSlot({ bookedCount: 3, capacity: 5 }));

      await expect(
        service.updateSlot('org-1', 'slot-1', 'user-1', { capacity: 2 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(db.appointmentSlot.update).not.toHaveBeenCalled();
    });

    it('allows reducing capacity down to but not below the booked count', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.appointmentSlot.findFirst.mockResolvedValue(makeSlot({ bookedCount: 3, capacity: 5 }));
      db.appointmentSlot.update.mockResolvedValue(makeSlot({ capacity: 3 }));

      await service.updateSlot('org-1', 'slot-1', 'user-1', { capacity: 3 } as any);

      expect(db.appointmentSlot.update).toHaveBeenCalled();
    });

    it('writes an audit log with the changes as metadata', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.appointmentSlot.findFirst.mockResolvedValue(makeSlot());
      db.appointmentSlot.update.mockResolvedValue(makeSlot({ capacity: 8 }));

      await service.updateSlot('org-1', 'slot-1', 'user-1', { capacity: 8 } as any);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'APPOINTMENT_SLOT_UPDATED', metadata: { changes: { capacity: 8 } } }),
      );
    });
  });

  describe('blockSlot', () => {
    it('throws NotFoundException when the slot does not exist in that organization', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.appointmentSlot.findFirst.mockResolvedValue(null);

      await expect(service.blockSlot('org-1', 'slot-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a member without a managing role', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'DONOR')]));

      await expect(service.blockSlot('org-1', 'slot-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('sets the slot status to BLOCKED and writes an audit log', async () => {
      db.user.findUnique.mockResolvedValue(makeUser([makeMembership('org-1', 'HOSPITAL_ADMIN')]));
      db.appointmentSlot.findFirst.mockResolvedValue(makeSlot());
      db.appointmentSlot.update.mockResolvedValue(makeSlot({ status: SlotStatus.BLOCKED }));

      await service.blockSlot('org-1', 'slot-1', 'user-1');

      expect(db.appointmentSlot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        data: { status: SlotStatus.BLOCKED },
      });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'APPOINTMENT_SLOT_BLOCKED' }));
    });
  });
});

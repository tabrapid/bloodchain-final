import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentStatus, AppointmentType, OrganizationStatus, Prisma, SlotStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { APPOINTMENT_COMPLETED_EVENT } from '../gamification/events/gamification-event.handler';
import { AppointmentsService } from './appointments.service';

function makeSlot(overrides: Record<string, any> = {}) {
  return {
    id: 'slot-1',
    organizationId: 'org-1',
    appointmentType: 'BLOOD_DONATION',
    status: SlotStatus.AVAILABLE,
    bookedCount: 0,
    capacity: 1,
    startAt: new Date(Date.now() + 60 * 60 * 1000),
    endAt: new Date(Date.now() + 90 * 60 * 1000),
    organization: { id: 'org-1', name: 'Test Hospital', type: 'HOSPITAL', address: '123 Main St', status: OrganizationStatus.ACTIVE },
    ...overrides,
  };
}

function makeDonor(overrides: Record<string, any> = {}) {
  return {
    id: 'donor-1',
    status: 'ACTIVE',
    donorProfile: {},
    memberships: [],
    ...overrides,
  };
}

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: any;
  let tx: any;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    tx = {
      appointmentSlot: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ bookedCount: 1, capacity: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      appointment: {
        create: jest.fn().mockResolvedValue({
          id: 'apt-1',
          referenceNumber: 'DON-2026-000001',
          appointmentType: 'BLOOD_DONATION',
          status: AppointmentStatus.PENDING,
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          notes: undefined,
          organization: { id: 'org-1', name: 'Test Hospital', type: 'HOSPITAL', address: '123 Main St' },
        }),
      },
      appointmentHistory: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      user: { findUnique: jest.fn() },
      appointmentSlot: { findUnique: jest.fn() },
      appointment: { findFirst: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  describe('bookAppointment', () => {
    it('books successfully when the slot has room', async () => {
      prisma.user.findUnique.mockResolvedValue(makeDonor());
      prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot());
      prisma.appointment.findFirst.mockResolvedValue(null);

      const result = await service.bookAppointment('donor-1', {
        slotId: 'slot-1',
        appointmentType: 'BLOOD_DONATION' as any,
      });

      expect(tx.appointmentSlot.updateMany).toHaveBeenCalledWith({
        where: { id: 'slot-1', status: SlotStatus.AVAILABLE, bookedCount: { lt: 1 } },
        data: { bookedCount: { increment: 1 } },
      });
      expect(tx.appointment.create).toHaveBeenCalled();
      expect(result.data.id).toBe('apt-1');
    });

    it('rejects with a clean conflict when a concurrent booking already claimed the last seat', async () => {
      prisma.user.findUnique.mockResolvedValue(makeDonor());
      prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot());
      prisma.appointment.findFirst.mockResolvedValue(null);
      // Simulate the race: the pre-check saw room, but by the time the
      // transaction's conditional update runs, another request already
      // filled the slot.
      tx.appointmentSlot.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.bookAppointment('donor-1', { slotId: 'slot-1', appointmentType: 'BLOOD_DONATION' as any }),
      ).rejects.toThrow(ConflictException);

      expect(tx.appointment.create).not.toHaveBeenCalled();
    });

    it('flips the slot to FULL once the claim fills the last seat', async () => {
      prisma.user.findUnique.mockResolvedValue(makeDonor());
      prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ capacity: 1, bookedCount: 0 }));
      prisma.appointment.findFirst.mockResolvedValue(null);
      tx.appointmentSlot.findUniqueOrThrow.mockResolvedValue({ bookedCount: 1, capacity: 1 });

      await service.bookAppointment('donor-1', { slotId: 'slot-1', appointmentType: 'BLOOD_DONATION' as any });

      expect(tx.appointmentSlot.update).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        data: { status: SlotStatus.FULL },
      });
    });

    it('does not flip the slot to FULL when seats remain', async () => {
      prisma.user.findUnique.mockResolvedValue(makeDonor());
      prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ capacity: 3, bookedCount: 0 }));
      prisma.appointment.findFirst.mockResolvedValue(null);
      tx.appointmentSlot.findUniqueOrThrow.mockResolvedValue({ bookedCount: 1, capacity: 3 });

      await service.bookAppointment('donor-1', { slotId: 'slot-1', appointmentType: 'BLOOD_DONATION' as any });

      expect(tx.appointmentSlot.update).not.toHaveBeenCalled();
    });

    it('rejects a pre-full slot before ever opening a transaction', async () => {
      prisma.user.findUnique.mockResolvedValue(makeDonor());
      prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ capacity: 1, bookedCount: 1 }));

      await expect(
        service.bookAppointment('donor-1', { slotId: 'slot-1', appointmentType: 'BLOOD_DONATION' as any }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each([OrganizationStatus.PENDING_APPROVAL, OrganizationStatus.SUSPENDED, OrganizationStatus.DEACTIVATED])(
      'rejects booking a slot hosted by a %s organization',
      async (status) => {
        prisma.user.findUnique.mockResolvedValue(makeDonor());
        prisma.appointmentSlot.findUnique.mockResolvedValue(
          makeSlot({ organization: { id: 'org-1', name: 'Test Hospital', type: 'HOSPITAL', status } }),
        );

        await expect(
          service.bookAppointment('donor-1', { slotId: 'slot-1', appointmentType: 'BLOOD_DONATION' as any }),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it('retries the whole transaction on a referenceNumber collision and succeeds with a fresh reference', async () => {
      prisma.user.findUnique.mockResolvedValue(makeDonor());
      prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot());
      prisma.appointment.findFirst.mockResolvedValue(null);
      const collision = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['referenceNumber'] },
      });
      prisma.$transaction
        .mockImplementationOnce(async () => {
          throw collision;
        })
        .mockImplementationOnce(async (cb: any) => cb(tx));

      const result = await service.bookAppointment('donor-1', {
        slotId: 'slot-1',
        appointmentType: 'BLOOD_DONATION' as any,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(result.data.id).toBe('apt-1');
    });
  });

  describe('rescheduleAppointment', () => {
    function makeAppointment(overrides: Record<string, any> = {}) {
      return {
        id: 'apt-1',
        donorId: 'donor-1',
        slotId: 'old-slot',
        status: AppointmentStatus.PENDING,
        referenceNumber: 'DON-2026-000001',
        appointmentType: 'BLOOD_DONATION',
        organizationId: 'org-1',
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        ...overrides,
      };
    }

    beforeEach(() => {
      tx.appointment = {
        ...tx.appointment,
        update: jest.fn().mockResolvedValue({
          id: 'apt-1',
          referenceNumber: 'DON-2026-000001',
          appointmentType: 'BLOOD_DONATION',
          status: AppointmentStatus.RESCHEDULED,
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          organization: { id: 'org-1', name: 'Test Hospital', type: 'HOSPITAL', address: '123 Main St' },
        }),
      };
      tx.appointmentSlot.findUnique = jest.fn().mockResolvedValue({
        id: 'old-slot',
        status: SlotStatus.AVAILABLE,
        bookedCount: 0,
        capacity: 1,
      });
      tx.appointmentSlot.findUniqueOrThrow.mockResolvedValue({ bookedCount: 1, capacity: 1 });
    });

    it('rejects with a clean conflict when the new slot fills up mid-request', async () => {
      prisma.appointment.findUnique = jest.fn().mockResolvedValue(makeAppointment());
      prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ id: 'new-slot' }));
      prisma.appointment.findFirst.mockResolvedValue(null);
      tx.appointmentSlot.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.rescheduleAppointment('apt-1', 'donor-1', { newSlotId: 'new-slot' }),
      ).rejects.toThrow(ConflictException);

      expect(tx.appointment.update).not.toHaveBeenCalled();
    });

    it('reschedules successfully when the new slot has room', async () => {
      prisma.appointment.findUnique = jest.fn().mockResolvedValue(makeAppointment());
      prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ id: 'new-slot' }));
      prisma.appointment.findFirst.mockResolvedValue(null);

      const result = await service.rescheduleAppointment('apt-1', 'donor-1', { newSlotId: 'new-slot' });

      expect(tx.appointmentSlot.updateMany).toHaveBeenCalledWith({
        where: { id: 'new-slot', status: SlotStatus.AVAILABLE, bookedCount: { lt: 1 } },
        data: { bookedCount: { increment: 1 } },
      });
      expect(result.data.id).toBe('apt-1');
    });
  });

  describe('completeAppointment', () => {
    function makeStaffUser(overrides: Record<string, any> = {}) {
      return {
        id: 'staff-1',
        memberships: [
          {
            organizationId: 'org-1',
            status: 'ACTIVE',
            organization: { id: 'org-1', status: OrganizationStatus.ACTIVE },
            role: { code: 'HOSPITAL_STAFF' },
          },
        ],
        ...overrides,
      };
    }

    function makeConfirmedAppointment(overrides: Record<string, any> = {}) {
      return {
        id: 'apt-1',
        donorId: 'donor-1',
        organizationId: 'org-1',
        status: AppointmentStatus.CONFIRMED,
        ...overrides,
      };
    }

    beforeEach(() => {
      tx.appointment = {
        ...tx.appointment,
        update: jest.fn().mockResolvedValue({ id: 'apt-1', status: AppointmentStatus.COMPLETED }),
      };
      tx.appointmentHistory = { create: jest.fn().mockResolvedValue({}) };
    });

    it('emits APPOINTMENT_COMPLETED_EVENT with the donor id once completed', async () => {
      prisma.appointment.findUnique = jest.fn().mockResolvedValue(makeConfirmedAppointment());
      prisma.user.findUnique.mockResolvedValue(makeStaffUser());

      await service.completeAppointment('apt-1', 'staff-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(APPOINTMENT_COMPLETED_EVENT, {
        appointmentId: 'apt-1',
        donorId: 'donor-1',
      });
    });

    it('does not emit when the appointment is not CONFIRMED', async () => {
      prisma.appointment.findUnique = jest.fn().mockResolvedValue(
        makeConfirmedAppointment({ status: AppointmentStatus.PENDING }),
      );
      prisma.user.findUnique.mockResolvedValue(makeStaffUser());

      await expect(service.completeAppointment('apt-1', 'staff-1')).rejects.toThrow();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('rejects staff of a no-longer-active organization from completing an appointment', async () => {
      prisma.appointment.findUnique = jest.fn().mockResolvedValue(makeConfirmedAppointment());
      prisma.user.findUnique.mockResolvedValue(
        makeStaffUser({
          memberships: [
            {
              organizationId: 'org-1',
              status: 'ACTIVE',
              organization: { id: 'org-1', status: OrganizationStatus.SUSPENDED },
              role: { code: 'HOSPITAL_STAFF' },
            },
          ],
        }),
      );

      await expect(service.completeAppointment('apt-1', 'staff-1')).rejects.toThrow(ForbiddenException);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('confirmAppointment', () => {
    function makeStaffUser(overrides: Record<string, any> = {}) {
      return {
        id: 'staff-1',
        memberships: [
          {
            organizationId: 'org-1',
            status: 'ACTIVE',
            organization: { id: 'org-1', status: OrganizationStatus.ACTIVE },
            role: { code: 'HOSPITAL_STAFF' },
          },
        ],
        ...overrides,
      };
    }

    function makePendingAppointment(overrides: Record<string, any> = {}) {
      return {
        id: 'apt-1',
        donorId: 'donor-1',
        organizationId: 'org-1',
        status: AppointmentStatus.PENDING,
        ...overrides,
      };
    }

    it('confirms a pending appointment for active staff', async () => {
      prisma.appointment.findUnique = jest.fn().mockResolvedValue(makePendingAppointment());
      prisma.appointment.update = jest.fn().mockResolvedValue({ id: 'apt-1', status: AppointmentStatus.CONFIRMED });
      prisma.user.findUnique.mockResolvedValue(makeStaffUser());

      const result = await service.confirmAppointment('apt-1', 'staff-1');

      expect(result.data.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('rejects staff of a no-longer-active organization from confirming an appointment', async () => {
      prisma.appointment.findUnique = jest.fn().mockResolvedValue(makePendingAppointment());
      prisma.user.findUnique.mockResolvedValue(
        makeStaffUser({
          memberships: [
            {
              organizationId: 'org-1',
              status: 'ACTIVE',
              organization: { id: 'org-1', status: OrganizationStatus.PENDING_APPROVAL },
              role: { code: 'HOSPITAL_STAFF' },
            },
          ],
        }),
      );

      await expect(service.confirmAppointment('apt-1', 'staff-1')).rejects.toThrow(ForbiddenException);
    });
  });
});

describe('AppointmentsService reference numbers', () => {
  /**
   * Every booking was labelled DON- regardless of type, so a blood test booked
   * from the app arrived in the laboratory console as DON-2026-… next to the
   * LAB-2026-… ones the laboratory books itself.
   */
  function reference(service: any, type: AppointmentType): string {
    return service.generateReferenceNumber(type);
  }

  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: {} },
        { provide: AuditLogsService, useValue: { log: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(AppointmentsService);
  });

  it('prefixes a donation with DON', () => {
    expect(reference(service, AppointmentType.BLOOD_DONATION)).toMatch(/^DON-\d{4}-\d{6}$/);
  });

  it('prefixes a blood test with LAB, matching what the laboratory issues', () => {
    expect(reference(service, AppointmentType.BLOOD_TEST)).toMatch(/^LAB-\d{4}-\d{6}$/);
  });

  it('prefixes a consultation with CON', () => {
    expect(reference(service, AppointmentType.CONSULTATION)).toMatch(/^CON-\d{4}-\d{6}$/);
  });
});

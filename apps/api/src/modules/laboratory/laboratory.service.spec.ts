import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { LaboratoryService } from './laboratory.service';

function makeSlot(overrides: Record<string, any> = {}) {
  return {
    id: 'slot-1',
    organizationId: 'lab-1',
    appointmentType: 'BLOOD_TEST',
    status: 'AVAILABLE',
    bookedCount: 0,
    capacity: 1,
    startAt: new Date(Date.now() + 60 * 60 * 1000),
    endAt: new Date(Date.now() + 90 * 60 * 1000),
    ...overrides,
  };
}

describe('LaboratoryService.bookLaboratoryAppointment', () => {
  let service: LaboratoryService;
  let prisma: any;
  let tx: any;

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
          referenceNumber: 'LAB-2026-000001',
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<LaboratoryService>(LaboratoryService);

    jest.spyOn(service, 'getLaboratory').mockResolvedValue({ id: 'lab-1', name: 'Test Lab' } as any);
    jest.spyOn(service, 'getTestType').mockResolvedValue({ id: 'test-1', code: 'CBC' } as any);

    prisma.user.findUnique.mockResolvedValue({
      id: 'donor-1',
      donorProfile: {},
      memberships: [],
    });
    prisma.appointment.findFirst.mockResolvedValue(null);
  });

  it('books successfully when the slot has room', async () => {
    prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot());

    const result = await service.bookLaboratoryAppointment('donor-1', 'lab-1', 'test-1', 'slot-1');

    expect(tx.appointmentSlot.updateMany).toHaveBeenCalledWith({
      where: { id: 'slot-1', status: 'AVAILABLE', bookedCount: { lt: 1 } },
      data: { bookedCount: { increment: 1 } },
    });
    expect(tx.appointment.create).toHaveBeenCalled();
    expect(result.id).toBe('apt-1');
  });

  it('rejects with a clean error when a concurrent booking already claimed the last seat', async () => {
    prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot());
    // Simulate the race: the pre-check saw room, but the transaction's
    // conditional update lost to a concurrent booking.
    tx.appointmentSlot.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.bookLaboratoryAppointment('donor-1', 'lab-1', 'test-1', 'slot-1'),
    ).rejects.toThrow(BadRequestException);

    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it('flips the slot to FULL once the claim fills the last seat', async () => {
    prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ capacity: 1, bookedCount: 0 }));
    tx.appointmentSlot.findUniqueOrThrow.mockResolvedValue({ bookedCount: 1, capacity: 1 });

    await service.bookLaboratoryAppointment('donor-1', 'lab-1', 'test-1', 'slot-1');

    expect(tx.appointmentSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { status: 'FULL' },
    });
  });

  it('does not flip the slot to FULL when seats remain', async () => {
    prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ capacity: 3, bookedCount: 0 }));
    tx.appointmentSlot.findUniqueOrThrow.mockResolvedValue({ bookedCount: 1, capacity: 3 });

    await service.bookLaboratoryAppointment('donor-1', 'lab-1', 'test-1', 'slot-1');

    expect(tx.appointmentSlot.update).not.toHaveBeenCalled();
  });

  it('rejects a pre-full slot before ever opening a transaction', async () => {
    prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ capacity: 1, bookedCount: 1 }));

    await expect(
      service.bookLaboratoryAppointment('donor-1', 'lab-1', 'test-1', 'slot-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('retries the whole transaction on a referenceNumber collision and succeeds with a fresh reference', async () => {
    prisma.appointmentSlot.findUnique.mockResolvedValue(makeSlot());
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

    const result = await service.bookLaboratoryAppointment('donor-1', 'lab-1', 'test-1', 'slot-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result.id).toBe('apt-1');
  });
});

function makeLabAppointment(overrides: Record<string, any> = {}) {
  return {
    id: 'apt-1',
    donorId: 'donor-1',
    organizationId: 'lab-1',
    slotId: 'slot-1',
    appointmentType: 'BLOOD_TEST',
    status: 'PENDING',
    scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

describe('LaboratoryService.cancelAppointment', () => {
  let service: LaboratoryService;
  let prisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      appointment: { update: jest.fn().mockResolvedValue({ id: 'apt-1', status: 'CANCELLED' }) },
      appointmentSlot: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(makeSlot({ status: 'AVAILABLE', bookedCount: 2, capacity: 3 })),
      },
      appointmentHistory: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      appointment: { findFirst: jest.fn().mockResolvedValue(makeLabAppointment()) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<LaboratoryService>(LaboratoryService);
  });

  it('resets a FULL slot back to AVAILABLE once cancelling frees a seat', async () => {
    tx.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ status: 'FULL', bookedCount: 2, capacity: 3 }));

    await service.cancelAppointment('donor-1', 'apt-1');

    expect(tx.appointmentSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { bookedCount: { decrement: 1 } },
    });
    expect(tx.appointmentSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { status: 'AVAILABLE' },
    });
  });

  it('does not touch slot status when the slot was not FULL', async () => {
    tx.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ status: 'AVAILABLE', bookedCount: 1, capacity: 3 }));

    await service.cancelAppointment('donor-1', 'apt-1');

    expect(tx.appointmentSlot.update).toHaveBeenCalledTimes(1);
    expect(tx.appointmentSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { bookedCount: { decrement: 1 } },
    });
  });

  it('rejects cancelling an already-cancelled appointment', async () => {
    prisma.appointment.findFirst.mockResolvedValue(makeLabAppointment({ status: 'CANCELLED' }));

    await expect(service.cancelAppointment('donor-1', 'apt-1')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects cancelling within 2 hours of the appointment', async () => {
    prisma.appointment.findFirst.mockResolvedValue(
      makeLabAppointment({ scheduledStart: new Date(Date.now() + 30 * 60 * 1000) }),
    );

    await expect(service.cancelAppointment('donor-1', 'apt-1')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('LaboratoryService.markNoShow', () => {
  let service: LaboratoryService;
  let prisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      appointment: { update: jest.fn().mockResolvedValue({ id: 'apt-1', status: 'NO_SHOW' }) },
      appointmentSlot: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(makeSlot({ status: 'AVAILABLE', bookedCount: 2, capacity: 3 })),
      },
      appointmentHistory: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      appointment: { findFirst: jest.fn().mockResolvedValue(makeLabAppointment({ status: 'CONFIRMED' })) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<LaboratoryService>(LaboratoryService);
  });

  it('resets a FULL slot back to AVAILABLE once a no-show frees a seat', async () => {
    tx.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ status: 'FULL', bookedCount: 2, capacity: 3 }));

    await service.markNoShow('lab-1', 'staff-1', 'apt-1');

    expect(tx.appointmentSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-1' },
      data: { status: 'AVAILABLE' },
    });
  });

  it('does not touch slot status when the slot was not FULL', async () => {
    tx.appointmentSlot.findUnique.mockResolvedValue(makeSlot({ status: 'AVAILABLE', bookedCount: 1, capacity: 3 }));

    await service.markNoShow('lab-1', 'staff-1', 'apt-1');

    expect(tx.appointmentSlot.update).toHaveBeenCalledTimes(1);
  });

  it('rejects marking a COMPLETED appointment as no-show', async () => {
    prisma.appointment.findFirst.mockResolvedValue(makeLabAppointment({ status: 'COMPLETED' }));

    await expect(service.markNoShow('lab-1', 'staff-1', 'apt-1')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('LaboratoryService.createResult', () => {
  let service: LaboratoryService;
  let prisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      laboratoryResult: {
        create: jest.fn().mockResolvedValue({ id: 'result-1', appointmentId: 'apt-1' }),
      },
      testParameter: { findUnique: jest.fn().mockResolvedValue(null) },
      testReferenceRange: { findFirst: jest.fn().mockResolvedValue(null) },
      laboratoryResultItem: { create: jest.fn().mockResolvedValue({}) },
      laboratoryResultVersion: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue(
          makeLabAppointment({ status: 'RESULT_PENDING', laboratoryResult: null }),
        ),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { log: jest.fn().mockResolvedValue({}) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<LaboratoryService>(LaboratoryService);
  });

  it('creates a result for a real appointment id', async () => {
    const result = await service.createResult(
      'lab-1',
      'staff-1',
      'apt-1',
      { items: [] },
      'test-type-1',
    );

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'apt-1', organizationId: 'lab-1' }) }),
    );
    expect(result.id).toBe('result-1');
  });

  it('rejects with BadRequestException when appointmentId is missing, without ever querying the DB', async () => {
    // This is the exact live bug this test guards: an undefined
    // appointmentId must never reach a Prisma `where: { id: undefined }`
    // filter, since Prisma silently omits an undefined filter field
    // instead of matching nothing -- it would return an arbitrary
    // BLOOD_TEST appointment for the organization instead of failing.
    await expect(
      service.createResult('lab-1', 'staff-1', undefined as any, { items: [] }, 'test-type-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });

  it('rejects with BadRequestException for an empty-string appointmentId', async () => {
    await expect(
      service.createResult('lab-1', 'staff-1', '', { items: [] }, 'test-type-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when no matching appointment exists', async () => {
    prisma.appointment.findFirst.mockResolvedValue(null);

    await expect(
      service.createResult('lab-1', 'staff-1', 'apt-missing', { items: [] }, 'test-type-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects when the appointment is not awaiting results', async () => {
    prisma.appointment.findFirst.mockResolvedValue(makeLabAppointment({ status: 'CONFIRMED' }));

    await expect(
      service.createResult('lab-1', 'staff-1', 'apt-1', { items: [] }, 'test-type-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when a result already exists for the appointment', async () => {
    prisma.appointment.findFirst.mockResolvedValue(
      makeLabAppointment({ status: 'RESULT_PENDING', laboratoryResult: { id: 'existing-result' } }),
    );

    await expect(
      service.createResult('lab-1', 'staff-1', 'apt-1', { items: [] }, 'test-type-1'),
    ).rejects.toThrow(BadRequestException);
  });
});

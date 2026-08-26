import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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

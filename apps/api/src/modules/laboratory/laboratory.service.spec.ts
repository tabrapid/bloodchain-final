import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LaboratoryResultStatus, Prisma } from '@prisma/client';
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

    // The laboratory profile carries the panels this site runs; booking now
    // refuses a test the site does not offer, so the fixture has to say it does.
    jest.spyOn(service, 'getLaboratory').mockResolvedValue({
      id: 'lab-1',
      name: 'Test Lab',
      laboratoryProfile: { isActive: true, testTypes: [{ id: 'test-1', code: 'CBC' }] },
    } as any);
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
      // createResult validates the test type it is about to record, exactly as
      // the booking path does, so the mock has to answer for it.
      testType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'test-type-1', code: 'CBC', isActive: true }),
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

describe('LaboratoryService.getLaboratories', () => {
  let service: LaboratoryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { organization: { findMany: jest.fn().mockResolvedValue([]) } };
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

  /**
   * The filter used to be `laboratoryProfile?.isActive !== false`, applied in
   * JavaScript after the query -- which is true for an organisation that has no
   * laboratory profile at all. Every hospital appeared in the donor's "choose a
   * laboratory" list and then answered "Laboratory is not active" when tapped.
   */
  it('only returns organizations that have an active laboratory profile', async () => {
    await service.getLaboratories();

    const where = prisma.organization.findMany.mock.calls[0][0].where;
    expect(where.laboratoryProfile).toEqual({ isActive: true });
    expect(where.status).toBe('ACTIVE');
  });

  it('narrows to a single organization when one is named', async () => {
    await service.getLaboratories('lab-1');

    const where = prisma.organization.findMany.mock.calls[0][0].where;
    expect(where.id).toBe('lab-1');
    expect(where.laboratoryProfile).toEqual({ isActive: true });
  });
});

describe('LaboratoryService.createResult reference flags', () => {
  let service: LaboratoryService;
  let prisma: any;
  let tx: any;
  const created: any[] = [];

  const range = (overrides: Record<string, any> = {}) => ({
    parameterId: 'param-hgb',
    minValue: new Prisma.Decimal(12),
    maxValue: new Prisma.Decimal(17.5),
    ...overrides,
  });

  beforeEach(async () => {
    created.length = 0;
    tx = {
      laboratoryResult: { create: jest.fn().mockResolvedValue({ id: 'result-1' }) },
      testParameter: {
        findUnique: jest.fn().mockResolvedValue({ id: 'param-hgb', testTypeId: 'tt-cbc', unit: 'g/dL' }),
      },
      testReferenceRange: { findFirst: jest.fn() },
      laboratoryResultItem: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          created.push(data);
          return data;
        }),
      },
      laboratoryResultVersion: { create: jest.fn().mockResolvedValue({}) },
      appointment: { update: jest.fn().mockResolvedValue({}) },
      appointmentHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      appointment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'apt-1',
          donorId: 'donor-1',
          status: 'RESULT_PENDING',
          laboratoryResult: null,
        }),
      },
      testType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tt-cbc', code: 'CBC', isActive: true }),
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

  const enter = (value: string, numericValue?: number) =>
    service.createResult('lab-1', 'staff-1', 'apt-1', {
      items: [{ parameterId: 'param-hgb', value, ...(numericValue === undefined ? {} : { numericValue }) }],
    }, 'tt-cbc');

  it('flags a value inside a parameter-scoped range as NORMAL', async () => {
    tx.testReferenceRange.findFirst.mockResolvedValue(range());
    await enter('14.2', 14.2);
    expect(created[0].flag).toBe('NORMAL');
  });

  it('flags a value below the range as LOW and above it as HIGH', async () => {
    tx.testReferenceRange.findFirst.mockResolvedValue(range());
    await enter('9.1', 9.1);
    expect(created[0].flag).toBe('LOW');

    created.length = 0;
    await enter('19.4', 19.4);
    expect(created[0].flag).toBe('HIGH');
  });

  /**
   * Ranges were keyed by test type alone, so a Complete Blood Count carried one
   * min/max that would be compared against haemoglobin, platelets and white
   * cells alike -- three orders of magnitude apart. A flag derived from that is
   * confidently wrong, which is worse than no flag.
   */
  it('refuses to flag against a range that does not name this parameter', async () => {
    tx.testReferenceRange.findFirst.mockResolvedValue(range({ parameterId: null }));
    await enter('250000', 250000);
    expect(created[0].flag).toBe('NOT_AVAILABLE');
  });

  it('leaves a non-numeric value unflagged', async () => {
    tx.testReferenceRange.findFirst.mockResolvedValue(range());
    await enter('O');
    expect(created[0].flag).toBe('NOT_AVAILABLE');
  });

  it("prefers a range naming the parameter over the test type's own", async () => {
    tx.testReferenceRange.findFirst.mockResolvedValue(range());
    await enter('14.2', 14.2);
    const orderBy = tx.testReferenceRange.findFirst.mock.calls[0][0].orderBy;
    expect(orderBy[0]).toEqual({ parameterId: 'desc' });
  });
});

/**
 * S0-7 regression tests.
 *
 * `LaboratoryResult.status` used to be a free-text column written with string
 * literals, and one of those literals ('PROCESSING') was never produced by any
 * code path -- the analytics "pending" count read it and was therefore always
 * zero. A typed enum makes the state machine checkable at compile time; these
 * tests cover the part the compiler cannot see: that the donor-facing reads are
 * scoped to PUBLISHED, so an entered-but-unreviewed result is not readable.
 */
describe('LaboratoryService donor result visibility', () => {
  let service: LaboratoryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      laboratoryResult: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      laboratoryResultItem: { findMany: jest.fn().mockResolvedValue([]) },
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

  it('lists only published results, scoped to the caller', async () => {
    await service.getDonorResults('donor-1');

    const [{ where }] = prisma.laboratoryResult.findMany.mock.calls[0];
    expect(where.donorId).toBe('donor-1');
    expect(where.status).toBe(LaboratoryResultStatus.PUBLISHED);
  });

  it('reads a single result through a caller-scoped query, not an ownership check after the fact', async () => {
    await expect(service.getDonorResult('donor-1', 'result-9')).rejects.toThrow(NotFoundException);

    const [{ where }] = prisma.laboratoryResult.findFirst.mock.calls[0];
    expect(where).toEqual({ id: 'result-9', donorId: 'donor-1' });
  });

  it("refuses the donor's own result while it is still unpublished", async () => {
    prisma.laboratoryResult.findFirst.mockResolvedValue({
      id: 'result-1',
      donorId: 'donor-1',
      status: LaboratoryResultStatus.ENTERED,
    });

    await expect(service.getDonorResult('donor-1', 'result-1')).rejects.toThrow(ForbiddenException);
  });

  it('returns the result once it is published', async () => {
    prisma.laboratoryResult.findFirst.mockResolvedValue({
      id: 'result-1',
      donorId: 'donor-1',
      status: LaboratoryResultStatus.PUBLISHED,
    });

    const result = await service.getDonorResult('donor-1', 'result-1');
    expect(result.id).toBe('result-1');
  });

  it('scopes the parameter trend to published results as well', async () => {
    await service.getParameterTrend('donor-1', 'param-hgb');

    const [{ where }] = prisma.laboratoryResultItem.findMany.mock.calls[0];
    expect(where.parameterId).toBe('param-hgb');
    expect(where.result).toEqual({
      donorId: 'donor-1',
      status: LaboratoryResultStatus.PUBLISHED,
    });
  });
});

/**
 * S0-8 regression tests.
 *
 * The test type the donor picked at booking was validated, then thrown away:
 * the appointment row carried no reference to it, so staff had to re-pick it
 * when entering the result and could silently record a different panel than the
 * one that was booked. It is now persisted on the appointment and used as the
 * default.
 */
describe('LaboratoryService.createResult test type resolution', () => {
  let service: LaboratoryService;
  let prisma: any;
  let tx: any;

  const buildService = async (appointment: Record<string, any>) => {
    tx = {
      laboratoryResult: { create: jest.fn().mockResolvedValue({ id: 'result-1' }) },
      testParameter: { findUnique: jest.fn().mockResolvedValue(null) },
      testReferenceRange: { findFirst: jest.fn().mockResolvedValue(null) },
      laboratoryResultItem: { create: jest.fn().mockResolvedValue({}) },
      laboratoryResultVersion: { create: jest.fn().mockResolvedValue({}) },
      appointment: { update: jest.fn().mockResolvedValue({}) },
      appointmentHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      appointment: { findFirst: jest.fn().mockResolvedValue(appointment) },
      testType: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.id,
          code: 'CBC',
          isActive: true,
        })),
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
  };

  const pending = (overrides: Record<string, any> = {}) =>
    makeLabAppointment({ status: 'RESULT_PENDING', laboratoryResult: null, ...overrides });

  it('falls back to the test type recorded on the appointment', async () => {
    await buildService(pending({ testTypeId: 'tt-booked' }));

    await service.createResult('lab-1', 'staff-1', 'apt-1', { items: [] });

    expect(tx.laboratoryResult.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ testTypeId: 'tt-booked' }) }),
    );
  });

  it('lets staff override it when they genuinely ran a different panel', async () => {
    await buildService(pending({ testTypeId: 'tt-booked' }));

    await service.createResult('lab-1', 'staff-1', 'apt-1', { items: [] }, 'tt-actually-run');

    expect(tx.laboratoryResult.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ testTypeId: 'tt-actually-run' }) }),
    );
  });

  it('refuses when neither the appointment nor the caller names a test type', async () => {
    await buildService(pending({ testTypeId: null }));

    await expect(
      service.createResult('lab-1', 'staff-1', 'apt-1', { items: [] }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records the result as ENTERED, the one state review can move on from', async () => {
    await buildService(pending({ testTypeId: 'tt-booked' }));

    await service.createResult('lab-1', 'staff-1', 'apt-1', { items: [] });

    expect(tx.laboratoryResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: LaboratoryResultStatus.ENTERED }),
      }),
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1', createdAt: new Date() }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('writes all provided fields through to the DB', async () => {
    await service.log({
      actorId: 'user-1',
      action: 'DONATION_CHECKED_IN',
      entityType: 'Donation',
      entityId: 'donation-1',
      organizationId: 'org-1',
      metadata: { donationReference: 'DONATION-2026-000001' },
      ipAddress: '1.2.3.4',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'DONATION_CHECKED_IN',
        entityType: 'Donation',
        entityId: 'donation-1',
        organizationId: 'org-1',
        metadata: { donationReference: 'DONATION-2026-000001' },
        ipAddress: '1.2.3.4',
      },
      select: { id: true, createdAt: true },
    });
  });

  it('defaults metadata to an empty object when omitted', async () => {
    await service.log({ action: 'LOGIN_SUCCESS', entityType: 'User' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ metadata: {} }) }),
    );
  });

  it('passes through optional fields as undefined rather than substituting defaults', async () => {
    await service.log({ action: 'LOGIN_FAILED', entityType: 'User' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: undefined,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: undefined,
        organizationId: undefined,
        metadata: {},
        ipAddress: undefined,
      },
      select: { id: true, createdAt: true },
    });
  });

  it('returns only the id and createdAt of the created row', async () => {
    const result = await service.log({ action: 'LOGIN_SUCCESS', entityType: 'User' });

    expect(result).toEqual({ id: 'log-1', createdAt: expect.any(Date) });
  });

  it('propagates a write failure rather than swallowing it', async () => {
    const error = new Error('connection lost');
    prisma.auditLog.create.mockRejectedValue(error);

    await expect(service.log({ action: 'LOGIN_SUCCESS', entityType: 'User' })).rejects.toBe(error);
  });
});

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface AuditLogInput {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly db: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        organizationId: input.organizationId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
      },
      select: { id: true, createdAt: true },
    });
  }
}

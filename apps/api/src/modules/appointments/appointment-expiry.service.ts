import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentStatus, SlotStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

/**
 * How long after an appointment's scheduled end staff still have to record
 * what happened, before the system closes it out.
 *
 * Default 24 hours: long enough that a desk writing up yesterday's session
 * this morning is never fighting the job, short enough that a seat is not held
 * for a week by a booking nobody attended.
 */
const DEFAULT_GRACE_HOURS = 24;

/**
 * Closes out appointments nobody ever handled.
 *
 * `AppointmentStatus.EXPIRED` existed in the schema from the beginning and
 * nothing ever set it, so every appointment a donor did not attend and staff
 * did not mark stayed PENDING or CONFIRMED forever -- it kept its seat in the
 * slot (`bookedCount` never came back down, and a slot that had filled stayed
 * FULL), it went on counting as "upcoming" in the donor's app, and it appeared
 * in every staff list as though someone were still expected.
 *
 * No new state is introduced here and no clinical rule is applied: this only
 * moves a booking that is long past into the terminal state the model already
 * had, and returns the seat the same way a cancellation does.
 */
@Injectable()
export class AppointmentExpiryService {
  private readonly logger = new Logger(AppointmentExpiryService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  /** The grace period, from configuration, falling back to the default. */
  private get graceHours(): number {
    const configured = Number(this.config.get<string>('APPOINTMENT_EXPIRY_GRACE_HOURS'));
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_GRACE_HOURS;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runExpirySweep(): Promise<void> {
    const expired = await this.expireStaleAppointments();
    if (expired > 0) {
      this.logger.log(`Appointment expiry: ${expired} unhandled appointment(s) closed out.`);
    }
  }

  /**
   * Returns the number actually expired.
   *
   * Public so the e2e suite can drive one sweep deterministically rather than
   * waiting for the hour to turn.
   */
  async expireStaleAppointments(): Promise<number> {
    const cutoff = new Date(Date.now() - this.graceHours * 60 * 60 * 1000);

    // Only the states that mean "still expected". CHECKED_IN and IN_PROGRESS
    // are deliberately left alone: someone is mid-session or the desk simply
    // has not finished writing it up, and silently expiring a donation in
    // progress would destroy a real record.
    const openStatuses: AppointmentStatus[] = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
    ];

    const candidates = await this.db.appointment.findMany({
      where: { status: { in: openStatuses }, scheduledEnd: { lt: cutoff } },
      select: { id: true, slotId: true, status: true, organizationId: true },
    });

    if (candidates.length === 0) return 0;

    let expiredCount = 0;

    for (const appointment of candidates) {
      const didExpire = await this.db.$transaction(async (tx) => {
        // Conditional update: an appointment that staff confirmed, completed
        // or cancelled between the query above and this transaction must not
        // be overwritten by a sweep that read a stale row.
        const claim = await tx.appointment.updateMany({
          where: { id: appointment.id, status: { in: openStatuses } },
          data: { status: AppointmentStatus.EXPIRED },
        });

        if (claim.count === 0) return false;

        const slot = await tx.appointmentSlot.update({
          where: { id: appointment.slotId },
          data: { bookedCount: { decrement: 1 } },
          select: { id: true, status: true, bookedCount: true, capacity: true },
        });

        if (slot.status === SlotStatus.FULL && slot.bookedCount < slot.capacity) {
          await tx.appointmentSlot.update({
            where: { id: slot.id },
            data: { status: SlotStatus.AVAILABLE },
          });
        }

        await tx.appointmentHistory.create({
          data: {
            appointmentId: appointment.id,
            action: 'EXPIRED',
            previousStatus: appointment.status,
            newStatus: AppointmentStatus.EXPIRED,
            // No actor: nobody did this, which is the point of the record.
            reason: `Not handled within ${this.graceHours}h of the scheduled end.`,
          },
        });

        return true;
      });

      if (didExpire) {
        expiredCount++;
        await this.audit.log({
          action: 'APPOINTMENT_EXPIRED',
          entityType: 'Appointment',
          entityId: appointment.id,
          organizationId: appointment.organizationId,
          metadata: { previousStatus: appointment.status, graceHours: this.graceHours },
        });
      }
    }

    return expiredCount;
  }
}

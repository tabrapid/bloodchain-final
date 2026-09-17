import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { APPOINTMENT_REMINDER_EVENT } from '../notifications/appointment-notification.events';

/** An appointment that has not happened yet and has not been called off. */
const REMINDABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

/**
 * Sends each donor one reminder before their appointment.
 *
 * How far ahead is `APPOINTMENT_REMINDER_LEAD_MINUTES`, read here and nowhere
 * else, so an operator moving reminders from a day out to two hours out
 * changes one environment value rather than hunting a number through the code.
 *
 * **Idempotence.** The reminder is claimed, not merely sent: the job updates
 * `reminderSentAt` conditionally on it still being null, and only emits when
 * that update actually changed a row. A cron that fires twice in the same
 * window, a process restart halfway through a batch, or two instances of the
 * API running side by side therefore all produce exactly one reminder per
 * appointment -- the second claim updates zero rows and returns. The
 * notification layer's own `idempotencyKey` is a second line of the same
 * defence, but it would not stop the job re-delivering a notification it had
 * already created, which is why the claim lives here.
 */
@Injectable()
export class AppointmentReminderService {
  private readonly logger = new Logger(AppointmentReminderService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  /** How far ahead of an appointment its reminder goes out, in minutes. */
  get leadMinutes(): number {
    return this.config.get<number>('APPOINTMENT_REMINDER_LEAD_MINUTES', 1440);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendDueReminders(): Promise<number> {
    const now = new Date();
    const dueBy = new Date(now.getTime() + this.leadMinutes * 60 * 1000);

    const due = await this.db.appointment.findMany({
      where: {
        status: { in: REMINDABLE_STATUSES },
        reminderSentAt: null,
        // Inside the lead window, and not already past: reminding someone
        // about an appointment that started an hour ago is worse than silence.
        scheduledStart: { gt: now, lte: dueBy },
      },
      select: { id: true, donorId: true, scheduledStart: true },
      orderBy: { scheduledStart: 'asc' },
      // A bound, so one long outage cannot turn the first run back into a
      // single enormous transaction; the next tick picks up the remainder.
      take: 500,
    });

    let sent = 0;

    for (const appointment of due) {
      // The claim. `updateMany` with the null condition is atomic in Postgres,
      // so whichever caller gets there first is the only one with count === 1.
      const claimed = await this.db.appointment.updateMany({
        where: { id: appointment.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });

      if (claimed.count === 0) continue;

      this.eventEmitter.emit(APPOINTMENT_REMINDER_EVENT, {
        appointmentId: appointment.id,
        scheduledAt: appointment.scheduledStart,
        reminderMinutes: Math.max(
          1,
          Math.round((appointment.scheduledStart.getTime() - now.getTime()) / 60000),
        ),
        recipientIds: [appointment.donorId],
      });
      sent += 1;
    }

    if (sent > 0) {
      this.logger.log(`Appointment reminders: ${sent} reminder(s) sent ${this.leadMinutes} minutes ahead.`);
    }

    return sent;
  }
}

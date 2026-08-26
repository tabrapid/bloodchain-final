import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChallengeType } from '@prisma/client';
import {
  DONATION_COMPLETED_EVENT,
  APPOINTMENT_COMPLETED_EVENT,
  DonationCompletedPayload,
  AppointmentCompletedPayload,
} from '../../gamification/events/gamification-event.handler';
import { ChallengesService } from '../challenges.service';

/**
 * Keeps challenge progress in sync with the real activity it's supposed to
 * measure, by recomputing it from the database whenever that activity
 * completes - rather than trusting a client-supplied number.
 */
@Injectable()
export class ChallengeProgressEventHandler {
  private readonly logger = new Logger(ChallengeProgressEventHandler.name);

  constructor(private readonly challenges: ChallengesService) {}

  @OnEvent(DONATION_COMPLETED_EVENT)
  async handleDonationCompleted(payload: DonationCompletedPayload): Promise<void> {
    try {
      await this.challenges.recalculateProgressForTypes(payload.donorId, [
        ChallengeType.DONATION_MILESTONE,
        ChallengeType.CONSISTENCY,
      ]);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to recalculate challenge progress for donation ${payload.donationId}: ${err.message}`, err.stack);
    }
  }

  @OnEvent(APPOINTMENT_COMPLETED_EVENT)
  async handleAppointmentCompleted(payload: AppointmentCompletedPayload): Promise<void> {
    try {
      await this.challenges.recalculateProgressForTypes(payload.donorId, [
        ChallengeType.APPOINTMENT_COMPLETION,
      ]);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to recalculate challenge progress for appointment ${payload.appointmentId}: ${err.message}`, err.stack);
    }
  }
}

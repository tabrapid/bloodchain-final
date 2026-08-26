import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GamificationService } from '../gamification.service';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';

export const DONATION_COMPLETED_EVENT = 'donation.completed';
export const BLOOD_TEST_COMPLETED_EVENT = 'blood-test.completed';
export const APPOINTMENT_COMPLETED_EVENT = 'appointment.completed';
export const EMERGENCY_RESPONSE_COMPLETED_EVENT = 'emergency-response.completed';
export const CHALLENGE_COMPLETED_EVENT = 'challenge.completed';

export interface DonationCompletedPayload {
  donationId: string;
  donorId: string;
  organizationId: string;
  isEmergency: boolean;
}

export interface BloodTestCompletedPayload {
  resultId: string;
  donorId: string;
}

export interface AppointmentCompletedPayload {
  appointmentId: string;
  donorId: string;
}

export interface EmergencyResponseCompletedPayload {
  responseId: string;
  donorId: string;
}

export interface ChallengeCompletedPayload {
  challengeId: string;
  userId: string;
  xpAmount: number;
  challengeTitle: string;
}

@Injectable()
export class GamificationEventHandler {
  private readonly logger = new Logger(GamificationEventHandler.name);

  constructor(
    private readonly gamificationService: GamificationService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private async isGamificationEnabled(): Promise<boolean> {
    return this.platformSettings.isEnabled('gamificationEnabled');
  }

  @OnEvent(DONATION_COMPLETED_EVENT)
  async handleDonationCompleted(payload: DonationCompletedPayload): Promise<void> {
    if (!(await this.isGamificationEnabled())) return;
    try {
      this.logger.log(`Processing gamification for donation ${payload.donationId}`);

      await this.gamificationService.ensureGamificationProfile(payload.donorId);

      const result = await this.gamificationService.processDonationCompleted(
        payload.donorId,
        payload.donationId,
        payload.isEmergency,
      );

      if (result.xpAwarded) {
        this.logger.log(
          `Donation ${payload.donationId}: +${result.xpAmount} XP, Level: ${result.newLevel}, ` +
          `Achievements: ${result.achievementsUnlocked.join(', ') || 'none'}`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to process donation completed event: ${err.message}`, err.stack);
    }
  }

  @OnEvent(BLOOD_TEST_COMPLETED_EVENT)
  async handleBloodTestCompleted(payload: BloodTestCompletedPayload): Promise<void> {
    if (!(await this.isGamificationEnabled())) return;
    try {
      this.logger.log(`Processing gamification for blood test ${payload.resultId}`);

      await this.gamificationService.ensureGamificationProfile(payload.donorId);

      const result = await this.gamificationService.processBloodTestCompleted(
        payload.donorId,
        payload.resultId,
      );

      if (result.xpAwarded) {
        this.logger.log(
          `Blood test ${payload.resultId}: +${result.xpAmount} XP, ` +
          `Achievements: ${result.achievementsUnlocked.join(', ') || 'none'}`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to process blood test completed event: ${err.message}`, err.stack);
    }
  }

  @OnEvent(APPOINTMENT_COMPLETED_EVENT)
  async handleAppointmentCompleted(payload: AppointmentCompletedPayload): Promise<void> {
    if (!(await this.isGamificationEnabled())) return;
    try {
      this.logger.log(`Processing gamification for appointment ${payload.appointmentId}`);

      await this.gamificationService.ensureGamificationProfile(payload.donorId);

      const result = await this.gamificationService.processAppointmentCompleted(
        payload.donorId,
        payload.appointmentId,
      );

      if (result.xpAwarded) {
        this.logger.log(
          `Appointment ${payload.appointmentId}: +${result.xpAmount} XP`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to process appointment completed event: ${err.message}`, err.stack);
    }
  }

  @OnEvent(EMERGENCY_RESPONSE_COMPLETED_EVENT)
  async handleEmergencyResponseCompleted(payload: EmergencyResponseCompletedPayload): Promise<void> {
    if (!(await this.isGamificationEnabled())) return;
    try {
      this.logger.log(`Processing gamification for emergency response ${payload.responseId}`);

      await this.gamificationService.ensureGamificationProfile(payload.donorId);

      const result = await this.gamificationService.processEmergencyResponseCompleted(
        payload.donorId,
        payload.responseId,
      );

      if (result.xpAwarded) {
        this.logger.log(
          `Emergency response ${payload.responseId}: +${result.xpAmount} XP, ` +
          `Achievements: ${result.achievementsUnlocked.join(', ') || 'none'}`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to process emergency response completed event: ${err.message}`, err.stack);
    }
  }

  @OnEvent(CHALLENGE_COMPLETED_EVENT)
  async handleChallengeCompleted(payload: ChallengeCompletedPayload): Promise<void> {
    if (!(await this.isGamificationEnabled())) return;
    try {
      this.logger.log(`Processing gamification for challenge ${payload.challengeId}`);

      await this.gamificationService.ensureGamificationProfile(payload.userId);

      const result = await this.gamificationService.processChallengeCompleted(
        payload.userId,
        payload.challengeId,
        payload.xpAmount,
        payload.challengeTitle,
      );

      if (result.xpAwarded) {
        this.logger.log(`Challenge ${payload.challengeId}: +${result.xpAmount} XP`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to process challenge completed event: ${err.message}`, err.stack);
    }
  }
}

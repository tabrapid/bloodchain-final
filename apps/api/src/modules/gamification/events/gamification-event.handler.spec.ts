import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from '../gamification.service';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { GamificationEventHandler } from './gamification-event.handler';

describe('GamificationEventHandler', () => {
  let handler: GamificationEventHandler;
  let gamificationService: {
    ensureGamificationProfile: jest.Mock;
    processDonationCompleted: jest.Mock;
    processBloodTestCompleted: jest.Mock;
    processAppointmentCompleted: jest.Mock;
    processEmergencyResponseCompleted: jest.Mock;
    processChallengeCompleted: jest.Mock;
  };
  let platformSettings: { isEnabled: jest.Mock };

  beforeEach(async () => {
    gamificationService = {
      ensureGamificationProfile: jest.fn().mockResolvedValue({}),
      processDonationCompleted: jest.fn().mockResolvedValue({ xpAwarded: true, xpAmount: 10, newLevel: 2, achievementsUnlocked: [] }),
      processBloodTestCompleted: jest.fn().mockResolvedValue({ xpAwarded: true, xpAmount: 5, achievementsUnlocked: [] }),
      processAppointmentCompleted: jest.fn().mockResolvedValue({ xpAwarded: true, xpAmount: 5 }),
      processEmergencyResponseCompleted: jest.fn().mockResolvedValue({ xpAwarded: true, xpAmount: 20, achievementsUnlocked: [] }),
      processChallengeCompleted: jest.fn().mockResolvedValue({ xpAwarded: true, xpAmount: 50, newTotalXp: 150 }),
    };
    platformSettings = { isEnabled: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationEventHandler,
        { provide: GamificationService, useValue: gamificationService },
        { provide: PlatformSettingsService, useValue: platformSettings },
      ],
    }).compile();

    handler = module.get<GamificationEventHandler>(GamificationEventHandler);
  });

  describe('when gamification is enabled', () => {
    it('processes a completed donation', async () => {
      await handler.handleDonationCompleted({
        donationId: 'don-1',
        donorId: 'donor-1',
        organizationId: 'org-1',
        isEmergency: false,
      });

      expect(platformSettings.isEnabled).toHaveBeenCalledWith('gamificationEnabled');
      expect(gamificationService.processDonationCompleted).toHaveBeenCalledWith('donor-1', 'don-1', false);
    });

    it('processes a completed blood test', async () => {
      await handler.handleBloodTestCompleted({ resultId: 'res-1', donorId: 'donor-1' });
      expect(gamificationService.processBloodTestCompleted).toHaveBeenCalledWith('donor-1', 'res-1');
    });

    it('processes a completed appointment', async () => {
      await handler.handleAppointmentCompleted({ appointmentId: 'appt-1', donorId: 'donor-1' });
      expect(gamificationService.processAppointmentCompleted).toHaveBeenCalledWith('donor-1', 'appt-1');
    });

    it('processes a completed emergency response', async () => {
      await handler.handleEmergencyResponseCompleted({ responseId: 'resp-1', donorId: 'donor-1' });
      expect(gamificationService.processEmergencyResponseCompleted).toHaveBeenCalledWith('donor-1', 'resp-1');
    });

    it('processes a completed challenge', async () => {
      await handler.handleChallengeCompleted({
        challengeId: 'chal-1',
        userId: 'donor-1',
        xpAmount: 50,
        challengeTitle: 'Donate 5 times',
      });
      expect(gamificationService.processChallengeCompleted).toHaveBeenCalledWith('donor-1', 'chal-1', 50, 'Donate 5 times');
    });
  });

  describe('when gamification is disabled platform-wide', () => {
    beforeEach(() => {
      platformSettings.isEnabled.mockResolvedValue(false);
    });

    it('skips a completed donation without awarding XP', async () => {
      await handler.handleDonationCompleted({
        donationId: 'don-1',
        donorId: 'donor-1',
        organizationId: 'org-1',
        isEmergency: false,
      });
      expect(gamificationService.ensureGamificationProfile).not.toHaveBeenCalled();
      expect(gamificationService.processDonationCompleted).not.toHaveBeenCalled();
    });

    it('skips a completed blood test without awarding XP', async () => {
      await handler.handleBloodTestCompleted({ resultId: 'res-1', donorId: 'donor-1' });
      expect(gamificationService.processBloodTestCompleted).not.toHaveBeenCalled();
    });

    it('skips a completed appointment without awarding XP', async () => {
      await handler.handleAppointmentCompleted({ appointmentId: 'appt-1', donorId: 'donor-1' });
      expect(gamificationService.processAppointmentCompleted).not.toHaveBeenCalled();
    });

    it('skips a completed emergency response without awarding XP', async () => {
      await handler.handleEmergencyResponseCompleted({ responseId: 'resp-1', donorId: 'donor-1' });
      expect(gamificationService.processEmergencyResponseCompleted).not.toHaveBeenCalled();
    });

    it('skips a completed challenge without awarding XP', async () => {
      await handler.handleChallengeCompleted({
        challengeId: 'chal-1',
        userId: 'donor-1',
        xpAmount: 50,
        challengeTitle: 'Donate 5 times',
      });
      expect(gamificationService.processChallengeCompleted).not.toHaveBeenCalled();
    });
  });
});

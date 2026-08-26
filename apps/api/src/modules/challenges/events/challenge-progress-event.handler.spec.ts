import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeType } from '@prisma/client';
import { ChallengesService } from '../challenges.service';
import { ChallengeProgressEventHandler } from './challenge-progress-event.handler';

describe('ChallengeProgressEventHandler', () => {
  let handler: ChallengeProgressEventHandler;
  let challenges: { recalculateProgressForTypes: jest.Mock };

  beforeEach(async () => {
    challenges = { recalculateProgressForTypes: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeProgressEventHandler,
        { provide: ChallengesService, useValue: challenges },
      ],
    }).compile();

    handler = module.get<ChallengeProgressEventHandler>(ChallengeProgressEventHandler);
  });

  it('recalculates DONATION_MILESTONE and CONSISTENCY progress when a donation completes', async () => {
    await handler.handleDonationCompleted({
      donationId: 'don-1',
      donorId: 'donor-1',
      organizationId: 'org-1',
      isEmergency: false,
    });

    expect(challenges.recalculateProgressForTypes).toHaveBeenCalledWith('donor-1', [
      ChallengeType.DONATION_MILESTONE,
      ChallengeType.CONSISTENCY,
    ]);
  });

  it('recalculates APPOINTMENT_COMPLETION progress when an appointment completes', async () => {
    await handler.handleAppointmentCompleted({ appointmentId: 'appt-1', donorId: 'donor-1' });

    expect(challenges.recalculateProgressForTypes).toHaveBeenCalledWith('donor-1', [
      ChallengeType.APPOINTMENT_COMPLETION,
    ]);
  });

  it('swallows errors instead of letting a bad challenge recompute break the emitting flow', async () => {
    challenges.recalculateProgressForTypes.mockRejectedValue(new Error('boom'));

    await expect(
      handler.handleDonationCompleted({ donationId: 'don-1', donorId: 'donor-1', organizationId: 'org-1', isEmergency: false }),
    ).resolves.toBeUndefined();
  });
});

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DonationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * The single source of truth for "when can this donor donate again" -
 * previously duplicated as a hardcoded 56-day calculation in
 * ai-context-builder-enhanced.service.ts, a private copy of the same rule
 * in emergency.service.ts, and free-text staff input on Donation.nextDonationDate
 * with no server-side derivation at all. Every caller that needs this answer
 * goes through here now.
 */
@Injectable()
export class DonationEligibilityService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get defaultCooldownDays(): number {
    return this.config.get<number>('DONATION_COOLDOWN_DAYS', 56);
  }

  /**
   * Adds the default recovery window to a completion date. Exposed
   * separately from getNextEligibleDonationDate so callers that already
   * have a completion date in hand (e.g. completing a donation right now)
   * can compute a suggested default without an extra DB round trip.
   */
  computeDefaultNextEligibleDate(fromDate: Date): Date {
    const next = new Date(fromDate);
    next.setDate(next.getDate() + this.defaultCooldownDays);
    return next;
  }

  /**
   * Prefers the explicit staff-entered `Donation.nextDonationDate` on the
   * donor's most recent completed donation (e.g. extended for a health
   * reason), falling back to the default cooldown window computed from
   * that donation's completion date. Returns null when the donor has no
   * completed donation on record (i.e. always eligible).
   */
  async getNextEligibleDonationDate(donorId: string): Promise<Date | null> {
    const lastDonation = await this.db.donation.findFirst({
      where: { donorId, status: DonationStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, nextDonationDate: true },
    });

    if (!lastDonation?.completedAt) {
      return null;
    }

    return lastDonation.nextDonationDate ?? this.computeDefaultNextEligibleDate(lastDonation.completedAt);
  }

  async isEligibleToDonate(donorId: string): Promise<boolean> {
    const nextEligibleDate = await this.getNextEligibleDonationDate(donorId);
    return !nextEligibleDate || nextEligibleDate.getTime() <= Date.now();
  }
}

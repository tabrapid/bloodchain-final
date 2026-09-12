import { ConflictException, Injectable } from '@nestjs/common';
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
      // `completedAt: not null` guards the ordering, not the filter. Postgres
      // sorts NULLs first on DESC, so a COMPLETED row that somehow carries no
      // completion date would be picked as "most recent" and, having no date,
      // read back as "no donation on record" -- i.e. always eligible. Excluding
      // those rows makes the query find the newest donation that can actually
      // date a recovery window.
      where: { donorId, status: DonationStatus.COMPLETED, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, nextDonationDate: true },
    });

    if (!lastDonation?.completedAt) {
      return null;
    }

    return lastDonation.nextDonationDate ?? this.computeDefaultNextEligibleDate(lastDonation.completedAt);
  }

  /**
   * The same answer for many donors in one query.
   *
   * Emergency matching needs this for every candidate it is about to alert, and
   * asking per donor would put a query per donor inside the matching
   * transaction. `distinct` on donorId with completedAt descending gives the
   * latest completed donation per donor in a single round trip.
   *
   * Donors with no completed donation are absent from the returned map, which
   * callers read as "no recovery window" -- the same meaning as the null
   * returned by the single-donor method.
   */
  async getNextEligibleDonationDates(donorIds: string[]): Promise<Map<string, Date>> {
    const dates = new Map<string, Date>();
    if (donorIds.length === 0) return dates;

    const lastDonations = await this.db.donation.findMany({
      where: { donorId: { in: donorIds }, status: DonationStatus.COMPLETED, completedAt: { not: null } },
      orderBy: [{ donorId: 'asc' }, { completedAt: 'desc' }],
      distinct: ['donorId'],
      select: { donorId: true, completedAt: true, nextDonationDate: true },
    });

    for (const donation of lastDonations) {
      if (!donation.completedAt) continue;
      dates.set(
        donation.donorId,
        donation.nextDonationDate ?? this.computeDefaultNextEligibleDate(donation.completedAt),
      );
    }

    return dates;
  }

  /**
   * Whether a donation may take place at a given moment.
   *
   * The moment is a parameter because the question is asked about different
   * ones: booking asks about the slot's start time (a donor three days from the
   * end of their window may legitimately book a slot next week), while check-in
   * and emergency matching ask about now. Answering all three against `now`
   * would refuse valid future bookings.
   */
  isEligibleAt(nextEligibleDate: Date | null | undefined, when: Date): boolean {
    return !nextEligibleDate || nextEligibleDate.getTime() <= when.getTime();
  }

  async isEligibleToDonateAt(donorId: string, when: Date): Promise<boolean> {
    return this.isEligibleAt(await this.getNextEligibleDonationDate(donorId), when);
  }

  async isEligibleToDonate(donorId: string): Promise<boolean> {
    return this.isEligibleToDonateAt(donorId, new Date());
  }

  /**
   * Refuses a donation that would fall inside the donor's recovery window.
   *
   * Lives here rather than at each call site so the rule has one
   * implementation and one error shape. The error carries an explicit
   * `DONOR_IN_RECOVERY_WINDOW` code and the date in `details`, so a client can
   * tell this apart from the other reasons a booking is refused (a taken slot,
   * an inactive organisation) without parsing prose.
   */
  async assertEligibleToDonateAt(donorId: string, when: Date): Promise<void> {
    const nextEligibleDate = await this.getNextEligibleDonationDate(donorId);
    if (this.isEligibleAt(nextEligibleDate, when)) return;

    const isoDate = nextEligibleDate!.toISOString().split('T')[0];
    throw new ConflictException({
      code: 'DONOR_IN_RECOVERY_WINDOW',
      message: `This donor is in the post-donation recovery window until ${isoDate}.`,
      details: { nextEligibleDonationDate: nextEligibleDate!.toISOString() },
    });
  }
}

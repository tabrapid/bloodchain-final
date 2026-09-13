/**
 * "Have we confirmed a way to reach this person?"
 *
 * That question was being asked as `emailVerified` in three places, for the
 * good reason that email was once the only answer. It is not the right question
 * now: a donor who received a code on their phone and typed it back has proved
 * exactly what the email link proved, and in Uzbekistan they are far more
 * likely to have done that than to hold an inbox they read.
 *
 * Written down once, and used by everything that asks -- sign-in, emergency
 * matching, the profile checklist -- because three copies of a predicate this
 * load-bearing is three chances for one of them to be forgotten when a fourth
 * contact channel arrives.
 *
 * **This is contact verification and nothing else.** It says a message will
 * arrive. It says nothing about whether the donor is who they claim, whether
 * their blood type has been confirmed by a laboratory, or whether they may
 * donate. Those live in `DonorProfile.verificationStatus`, in the blood-type
 * fields, and in the eligibility service, and none of them may be satisfied by
 * receiving an SMS.
 */
export interface ContactVerifiable {
  emailVerified: boolean;
  phoneVerified: boolean;
}

export function hasVerifiedContact(user: ContactVerifiable): boolean {
  return user.emailVerified || user.phoneVerified;
}

/**
 * The same rule as a Prisma filter.
 *
 * Spread into a `where` clause so a query selects exactly the people the
 * predicate would accept -- `{ ...verifiedContactFilter() }`. Keeping the two
 * next to each other is what stops the in-memory check and the database check
 * from drifting, which is the failure that quietly shrinks an emergency's
 * candidate pool without anything looking broken.
 *
 * A function rather than a shared constant: Prisma's `where` types are mutable,
 * and a single object spread into many queries is one `.push` away from being a
 * bug in all of them.
 */
export function verifiedContactFilter(): {
  OR: Array<{ emailVerified?: boolean; phoneVerified?: boolean }>;
} {
  return { OR: [{ emailVerified: true }, { phoneVerified: true }] };
}

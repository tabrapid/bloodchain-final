import type { Catalog } from '../translate';
import type { Locale } from '../locale';
import { collectKeys } from '../translate';
import { en } from './en';
import { uz } from './uz';
import { ru } from './ru';

export { en, uz, ru };

export const CATALOGS: Record<Locale, Catalog> = { uz, ru, en };

/**
 * Every key that needs a clinician's sign-off before release.
 *
 * Derived from the catalogue rather than typed out, so a term added to the
 * medical namespace is on the review list the moment it exists -- the failure
 * mode this protects against is someone adding one string and nobody knowing it
 * needs reviewing.
 *
 * The rule for what belongs in `medical`: anything a donor could act on
 * medically. What they are donating, whether they may donate, what a laboratory
 * value means. Interface furniture that merely sits near medical content --
 * "View trends", "Lab results" -- does not.
 */
export const CLINICAL_REVIEW_KEYS: string[] = collectKeys(en.medical as Catalog, 'medical').sort();

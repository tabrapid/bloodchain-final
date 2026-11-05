/**
 * Level names in the donor's language.
 *
 * The gamification API names levels in English ("Regular Donor", "Community
 * Donor") and the app used to print those names as they came, so the one
 * English line on a Russian or Uzbek profile was the level. The names are a
 * fixed set of ten in the API's configuration, so each has a translation here
 * keyed by its English form; a name the app does not know is shown as sent,
 * which is still better than a blank.
 */
const LEVEL_KEYS: Record<string, string> = {
  'New Donor': 'newDonor',
  'Active Donor': 'activeDonor',
  'Regular Donor': 'regularDonor',
  'Community Donor': 'communityDonor',
  'Dedicated Donor': 'dedicatedDonor',
  Champion: 'champion',
  'Elite Donor': 'eliteDonor',
  Hero: 'hero',
  Legend: 'legend',
  Platinum: 'platinum',
};

export function levelName(
  name: string | null | undefined,
  t: (key: string, options?: Record<string, string | number>) => string,
): string {
  if (!name) return '';
  const key = LEVEL_KEYS[name.trim()];
  return key ? t(`gamification.levelNames.${key}`) : name;
}

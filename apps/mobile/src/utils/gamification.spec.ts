import { levelName } from './gamification';

const t = (key: string) => `[${key}]`;

describe('levelName', () => {
  it('translates every level the API can send', () => {
    expect(levelName('Regular Donor', t)).toBe('[gamification.levelNames.regularDonor]');
    expect(levelName('Community Donor', t)).toBe('[gamification.levelNames.communityDonor]');
    expect(levelName('Platinum', t)).toBe('[gamification.levelNames.platinum]');
  });

  it('shows an unknown name as sent rather than a key or nothing', () => {
    expect(levelName('Grand Master', t)).toBe('Grand Master');
  });

  it('is empty for nothing', () => {
    expect(levelName(undefined, t)).toBe('');
    expect(levelName(null, t)).toBe('');
  });
});

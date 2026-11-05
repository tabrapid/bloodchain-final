import { Shield } from 'lucide-react-native';
import { View } from 'react-native';
import { Text, iconSize, radius, space, useDesign, type AccentName } from '../../design';
import { gamificationIcons } from './icons';
import type { Badge } from '../../api/gamification';
import { useTranslation } from '../../i18n';

/**
 * How rare a badge is, as an accent rather than four loose hex values.
 *
 * V1 had `RARE: '#3B82F6'`, `EPIC: '#8B5CF6'`, `LEGENDARY: '#F59E0B'` written
 * into the component -- three colours that exist nowhere else in the app and
 * were never checked for contrast on either surface.
 */
const RARITY_TONE: Record<Badge['rarity'], AccentName | null> = {
  COMMON: null,
  RARE: 'clinical',
  EPIC: 'insight',
  LEGENDARY: 'warning',
};

/**
 * One badge in a grid.
 *
 * An unearned badge is drawn, not hidden: a collection you can see the shape
 * of is the point. It is dimmed and its state is announced, so "locked" is not
 * conveyed by opacity alone.
 */
export function BadgeTile({ badge, width }: { badge: Badge; width?: number | `${number}%` }) {
  const { t } = useTranslation();
  const { colors } = useDesign();

  const earned = Boolean(badge.earnedAt);
  const tone = RARITY_TONE[badge.rarity];
  const accent = tone ? colors[tone] : null;
  const Icon = gamificationIcons[badge.icon] ?? Shield;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${badge.name}. ${
        earned ? t('gamification.earned') : t('gamification.locked')
      }`}
      style={{ width, alignItems: 'center', gap: space.sm }}
    >
      {/*
        The dimming is on the disc, not on the tile.

        Dimming the whole tile to 45% took the name down with it -- and the name
        of an unearned badge was already `tertiary`, so it landed at roughly
        2.1:1 on this surface: below the 4.5:1 this app holds itself to, and
        below the 3:1 floor for anything at all. The state is announced and the
        disc is visibly empty; the words stay readable.
      */}
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: earned ? (accent?.soft ?? colors.rose.soft) : colors.surfaceRaised,
          borderWidth: earned && accent ? 1.5 : 0,
          borderColor: accent?.base ?? 'transparent',
          opacity: earned ? 1 : 0.45,
        }}
      >
        <Icon
          size={iconSize.lg}
          color={earned ? (accent?.base ?? colors.rose.base) : colors.textTertiary}
          strokeWidth={1.75}
        />
      </View>
      <Text variant="caption" tone={earned ? 'primary' : 'secondary'} align="center" numberOfLines={2}>
        {badge.name}
      </Text>
    </View>
  );
}

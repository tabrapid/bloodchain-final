import { View } from 'react-native';
import {
  Badge as Chip,
  Progress,
  Row,
  Stack,
  Surface,
  Text,
} from '../../design';
import type { Achievement } from '../../api/gamification';
import { useTranslation } from '../../i18n';

/**
 * One achievement: what it is, how far along, and what it is worth.
 *
 * The same shape serves every list -- an unlocked achievement is one whose
 * progress reached its target, not a different kind of object, and V1 drew it
 * three different ways across two screens.
 */
export function AchievementRow({ achievement }: { achievement: Achievement }) {
  const { t } = useTranslation();
  const ratio =
    achievement.target > 0
      ? Math.min(1, achievement.progress / achievement.target)
      : achievement.status === 'UNLOCKED'
        ? 1
        : 0;
  const complete = achievement.status === 'UNLOCKED' || ratio >= 1;

  return (
    <Surface>
      <Stack gap="md">
        <Row gap="md" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text variant="bodyStrong">{achievement.name}</Text>
            <Text variant="caption" tone="secondary">
              {achievement.description}
            </Text>
          </Stack>
          <Chip
            label={`${achievement.xpReward} ${t('profile.xp')}`}
            tone={complete ? 'success' : 'neutral'}
          />
        </Row>
        {/*
          The bar carries no label of its own.

          It used to repeat `achievement.name` 40pt under the card's own title,
          so every card on the screen printed its name twice and the repeated
          line -- the one the eye reads as the bar's meaning -- said nothing the
          card had not already said. `bare` drops the label row; the progress is
          announced through the progressbar's own accessibility value.
        */}
        <Row gap="md" align="center">
          <View style={{ flex: 1 }}>
            <Progress
              label={achievement.name}
              value={ratio}
              tone={complete ? 'success' : 'rose'}
              bare
            />
          </View>
          <Text variant="label" tone="tertiary">
            {`${achievement.progress} / ${achievement.target}`}
          </Text>
        </Row>
      </Stack>
    </Surface>
  );
}

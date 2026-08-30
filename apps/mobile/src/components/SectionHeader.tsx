import { AppText } from './AppText';
import { spacing, typography, useTheme } from '../theme';

export function SectionHeader({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <AppText
      style={{
        ...typography.caption,
        color: colors.textMuted,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
      }}
    >
      {children.toUpperCase()}
    </AppText>
  );
}

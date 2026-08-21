import { AppText } from './AppText';
import { colors, spacing, typography } from '../theme';

export function SectionHeader({ children }: { children: string }) {
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

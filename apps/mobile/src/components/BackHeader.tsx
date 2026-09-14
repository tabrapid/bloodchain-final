import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../theme';
import { AppText } from './AppText';
import { useTranslation } from '../i18n';

export interface BackHeaderProps {
  title?: string;
  trailing?: ReactNode;
  onBack?: () => void;
}

/**
 * The header for every pushed (non-tab-root) screen: a labelled "‹ Back"
 * affordance on the left, the title centred, and an optional trailing slot.
 *
 * The back control is a chevron *plus the word* rather than a bare icon —
 * it reads unambiguously, and the label gives the 44pt touch target real
 * width instead of relying on invisible hit-slop.
 */
export function BackHeader({ title, trailing, onBack }: BackHeaderProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingTop: 8,
        paddingBottom: 16,
        minHeight: 52,
      }}
    >
      <Pressable
        onPress={onBack ?? (() => router.back())}
        accessibilityRole="button"
        accessibilityLabel={t('common.a11yGoBack')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          minWidth: 44,
          minHeight: 44,
          paddingRight: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ChevronLeft size={22} strokeWidth={2.5} color={colors.primary} />
        <AppText style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>{t('common.back')}</AppText>
      </Pressable>

      {title ? (
        <AppText
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: '700',
            color: colors.text,
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
        >
          {title}
        </AppText>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {/* Balances the back control so the title stays optically centred. */}
      {trailing ? (
        <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{trailing}</View>
      ) : (
        <View style={{ minWidth: 52 }} />
      )}
    </View>
  );
}

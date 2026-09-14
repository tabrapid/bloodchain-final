import { View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useTheme } from '../theme';
import { AppText } from './AppText';
import { useTranslation } from '../i18n';

export interface OfflineBannerProps {
  visible: boolean;
}

/** Amber strip pinned under the header while the device has no connection. */
export function OfflineBanner({ visible }: OfflineBannerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!visible) return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(229,184,109,0.18)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(229,184,109,0.30)',
      }}
    >
      <WifiOff size={13} color={colors.warning} />
      <AppText style={{ fontSize: 12, fontWeight: '600', color: colors.warning }}>
        {t('common.offlineBanner')}
      </AppText>
    </View>
  );
}

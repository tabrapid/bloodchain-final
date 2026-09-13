import { View } from 'react-native';
import { Languages } from 'lucide-react-native';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@bloodchain/i18n';
import { AppText } from './AppText';
import { SegmentedControl } from './SegmentedControl';
import { spacing, useTheme } from '../theme';
import { useTranslation } from '../i18n';

/**
 * The language picker.
 *
 * Each option is labelled in its own language -- "O'zbekcha", "Русский",
 * "English" -- because a picker that says "Uzbek / Russian / English" only
 * helps someone who already reads English, which is exactly the person who does
 * not need it.
 *
 * Changing the language rewrites the interface and nothing else: the preference
 * is stored under its own key and the auth tokens are never touched, so a
 * signed-in donor stays signed in.
 */
export function LanguageSwitcher() {
  const { colors } = useTheme();
  const { t, locale, setLocale } = useTranslation();

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
        <Languages size={16} color={colors.textMuted} />
        <AppText muted style={{ fontSize: 13, fontWeight: '500' }}>
          {t('language.title')}
        </AppText>
      </View>
      <SegmentedControl<Locale>
        options={SUPPORTED_LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
        value={locale}
        onChange={setLocale}
      />
    </View>
  );
}

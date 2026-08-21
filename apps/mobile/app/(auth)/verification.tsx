import { router } from 'expo-router';
import { View } from 'react-native';
import { AppButton, AppText, Screen } from '../../src/components';
import { spacing, typography } from '../../src/theme';

export default function Verification() {
  return (
    <Screen>
      <View style={{ marginTop: spacing['2xl'] }}>
        <AppText style={typography.title}>Verify your account.</AppText>
        <AppText muted style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Identity verification will be implemented in a future phase. Press continue to proceed.
        </AppText>
        <AppButton onPress={() => router.replace('/(app)/home')}>Continue</AppButton>
      </View>
    </Screen>
  );
}

import { View } from 'react-native';
import { useTheme } from '../theme';

export function Divider({ style }: { style?: object }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

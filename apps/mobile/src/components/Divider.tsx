import { View } from 'react-native';
import { colors } from '../theme';

export function Divider({ style }: { style?: object }) {
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

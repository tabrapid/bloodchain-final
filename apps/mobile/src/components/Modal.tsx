import { PropsWithChildren } from 'react';
import { Modal as RNModal, Platform, Pressable, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { X } from 'lucide-react-native';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
}

export function Modal({ visible, onClose, title, children }: PropsWithChildren<ModalProps>) {
  const { colors } = useTheme();
  const sheet = (
    <View
      style={{
        backgroundColor: Platform.OS === 'ios' ? colors.surface : colors.surfaceSolid,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
        }}
      >
        {title && <AppText variant="heading">{title}</AppText>}
        <Pressable onPress={onClose} style={{ padding: spacing.xs }}>
          <X size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      {children}
    </View>
  );

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint={colors.blurTint} style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            {sheet}
          </BlurView>
        ) : (
          sheet
        )}
      </Pressable>
    </RNModal>
  );
}

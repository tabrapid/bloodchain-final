import { PropsWithChildren } from 'react';
import { Modal as RNModal, Pressable, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { X } from 'lucide-react-native';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
}

export function Modal({ visible, onClose, title, children }: PropsWithChildren<ModalProps>) {
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
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
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
      </Pressable>
    </RNModal>
  );
}

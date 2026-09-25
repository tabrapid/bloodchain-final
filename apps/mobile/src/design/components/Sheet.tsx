import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesign } from '../useDesign';
import { icon as iconScale, motion, radius, space } from '../tokens';
import { Text } from './Text';
import { Button, ButtonRow, IconButton } from './Button';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Read under the title. */
  description?: string;
  children?: ReactNode;
  /** Buttons pinned to the bottom, above the safe area. */
  footer?: ReactNode;
  /** Label for the close control. Required: the control is an icon. */
  closeLabel: string;
  style?: ViewStyle;
}

/**
 * A panel that rises from the bottom edge.
 *
 * Bottom rather than centre, because a phone is held at the bottom and a
 * centred dialog puts its buttons where the thumb is not. It slides in over
 * `motion.gentle` and the scrim fades with it; both stop, rather than settling,
 * because a sheet that bounces reads as playful and this app is not.
 *
 * Android's hardware back closes it. That sounds obvious and is the single most
 * common omission in a hand-rolled sheet: the person presses back expecting the
 * sheet to go and leaves the screen instead.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel,
  style,
}: SheetProps) {
  const { colors } = useDesign();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: motion.gentle,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  const { height: windowHeight } = useWindowDimensions();

  return (
    <RNModal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/*
        Two things a bottom-anchored sheet has to survive: a body taller than
        the phone, and a keyboard.
       
        The region picker in booking is twelve rows plus a header; anchored to
        the bottom with nothing to scroll, it grew off the TOP of the screen and
        took its own title and close button with it. And every sheet with a text
        field in it -- decline a delivery, report a problem -- had the keyboard
        cover the field and the submit button, because nothing lifted it.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={{ ...fill, backgroundColor: colors.scrim, opacity: slide }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onClose}
            style={fill}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingTop: space.md,
              paddingHorizontal: space.lg,
              paddingBottom: insets.bottom + space.lg,
              gap: space.lg,
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
            },
            style,
          ]}
        >
          {/* The grab handle. Decorative — the close button is the affordance
              assistive technology gets. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: radius.full,
              backgroundColor: colors.border,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="h2" accessibilityRole="header">
                {title}
              </Text>
              {description ? (
                <Text variant="body" tone="secondary">
                  {description}
                </Text>
              ) : null}
            </View>
            <IconButton
              accessibilityLabel={closeLabel}
              onPress={onClose}
              icon={({ size, color }) => (
                <Text style={{ fontSize: size, color, lineHeight: size + 2 }}>✕</Text>
              )}
            />
          </View>

          {children ? (
            <ScrollView
              style={{ maxHeight: windowHeight * 0.6 }}
              contentContainerStyle={{ paddingBottom: space.xs }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
          ) : null}
          {footer}
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const fill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

export interface ConfirmationSheetProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Draws the confirm button in the emergency red. For anything irreversible. */
  destructive?: boolean;
  busy?: boolean;
}

/**
 * "Are you sure" — with the consequence written out.
 *
 * `description` is required rather than optional. A confirmation that says
 * "Are you sure?" and nothing else asks the donor to remember what they just
 * pressed; in this app the thing being confirmed can be withdrawing from an
 * emergency response, and it needs to say so.
 *
 * Cancel is first in the reading order and confirm is second, so the
 * destructive option is never what a thumb lands on by momentum.
 */
export function ConfirmationSheet({
  visible,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
}: ConfirmationSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={busy ? () => undefined : onCancel}
      title={title}
      description={description}
      closeLabel={cancelLabel}
      footer={
        <ButtonRow>
          <View style={{ flex: 1 }}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'critical' : 'primary'}
              onPress={onConfirm}
              loading={busy}
            />
          </View>
        </ButtonRow>
      }
    />
  );
}

export interface PermissionExplainerProps {
  visible: boolean;
  title: string;
  /** What is collected, when, and what it is used for. In the donor's words. */
  description: string;
  /** Concrete promises: what the app will NOT do. */
  assurances?: string[];
  allowLabel: string;
  denyLabel: string;
  onAllow: () => void;
  onDeny: () => void;
  icon?: (props: { size: number; color: string }) => ReactNode;
}

/**
 * The screen shown BEFORE the operating system's permission prompt.
 *
 * The OS prompt is one line and it is the only chance the app gets: deny it and
 * on iOS it never appears again. So the reason is explained first, in the app,
 * where there is room to say what is collected and what is not -- and where
 * "Not now" is a real choice that costs the donor nothing.
 *
 * This is the opposite of a dark pattern, and the shape enforces it: the deny
 * button is the same size as the allow button, it is not styled as an
 * afterthought, and `assurances` exists so that the limits are stated rather
 * than implied.
 */
export function PermissionExplainer({
  visible,
  title,
  description,
  assurances,
  allowLabel,
  denyLabel,
  onAllow,
  onDeny,
  icon,
}: PermissionExplainerProps) {
  const { colors } = useDesign();

  return (
    <BottomSheet
      visible={visible}
      onClose={onDeny}
      title={title}
      description={description}
      closeLabel={denyLabel}
      footer={
        <View style={{ gap: space.md }}>
          <Button label={allowLabel} onPress={onAllow} />
          <Button label={denyLabel} variant="ghost" onPress={onDeny} />
        </View>
      }
    >
      {icon ? (
        <View
          style={{
            alignSelf: 'center',
            width: 56,
            height: 56,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.clinical.soft,
          }}
        >
          {icon({ size: iconScale.xl, color: colors.clinical.base })}
        </View>
      ) : null}

      {assurances?.length ? (
        <View style={{ gap: space.sm }}>
          {assurances.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
              <Text variant="body" style={{ color: colors.success.text }}>
                ✓
              </Text>
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </BottomSheet>
  );
}

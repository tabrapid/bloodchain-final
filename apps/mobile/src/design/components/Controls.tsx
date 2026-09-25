import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, Switch, View, type ViewStyle } from 'react-native';
import { useDesign } from '../useDesign';
import { hitTarget, icon as iconScale, motion, radius, space } from '../tokens';
import { Text } from './Text';

export interface ToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Shown while the change is being saved; the control is inert meanwhile. */
  busy?: boolean;
}

/**
 * A labelled switch row.
 *
 * The whole row is the target, not just the switch -- a 51pt-wide control at the
 * far edge of a phone is a reach, and a settings screen is mostly reaching. The
 * platform Switch is used rather than a custom one because it is the control
 * people already know, it animates correctly, and it is already wired to
 * assistive technology.
 */
export function Toggle({ label, description, value, onValueChange, disabled = false, busy = false }: ToggleProps) {
  const { colors } = useDesign();
  const inert = disabled || busy;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: inert, busy }}
      disabled={inert}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.lg,
        minHeight: hitTarget.comfortable,
        paddingVertical: space.md,
        opacity: inert ? 0.5 : 1,
        backgroundColor: pressed ? colors.surfacePressed : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {description ? (
          <Text variant="caption" tone="tertiary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={inert}
        // Hidden from assistive tech: the row above already announces the
        // switch role and its state, and both being focusable means hearing
        // the same setting twice.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        trackColor={{ false: colors.track, true: colors.success.fill }}
        thumbColor={colors.textOnAccent}
      />
    </Pressable>
  );
}

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Announced as the thing being chosen, e.g. "Time range". */
  accessibilityLabel: string;
  style?: ViewStyle;
}

/**
 * A small set of mutually exclusive options, all visible at once.
 *
 * Up to about four; beyond that the labels stop fitting on a narrow phone and
 * the right control is a Select. Each segment is a radio, not a button, because
 * that is what it is -- and a screen reader that says "button" for one of five
 * options gives no way to know which is chosen.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: SegmentedControlProps<T>) {
  const { colors } = useDesign();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: 'row',
          padding: 3,
          borderRadius: radius.sm,
          backgroundColor: colors.sunken,
          borderWidth: 1,
          borderColor: colors.divider,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: hitTarget.min - 6,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: space.sm,
              borderRadius: radius.xs,
              backgroundColor: selected ? colors.surfaceRaised : 'transparent',
            }}
          >
            <Text
              variant="label"
              tone={selected ? 'primary' : 'secondary'}
              style={{ fontWeight: selected ? '600' : '500' }}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface ChoiceProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Why it is disabled. Shown in place of the description, and announced. */
  unavailableReason?: string;
  icon?: (props: { size: number; color: string }) => ReactNode;
}

/**
 * A large selectable card: a donation type, an organisation, a time slot.
 *
 * The selected state is a border and a filled check, never a background tint
 * alone -- a tint at the opacity that looks good is a tint nobody can see in
 * daylight, and it is the only signal a colour-blind donor would have.
 *
 * `unavailableReason` exists because a disabled option with no explanation is
 * the most frustrating thing in a booking flow. If a slot is full, it says so.
 */
export function Choice({
  label,
  description,
  selected,
  onPress,
  disabled = false,
  unavailableReason,
  icon,
}: ChoiceProps) {
  const { colors } = useDesign();
  const scale = useRef(new Animated.Value(1)).current;
  const inert = disabled || Boolean(unavailableReason);
  const detail = unavailableReason ?? description;

  const animate = (to: number) =>
    Animated.timing(scale, { toValue: to, duration: motion.instant, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityHint={detail}
        accessibilityState={{ selected, checked: selected, disabled: inert }}
        disabled={inert}
        onPress={onPress}
        onPressIn={() => animate(motion.pressScale)}
        onPressOut={() => animate(1)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.lg,
          minHeight: hitTarget.comfortable,
          padding: space.lg,
          borderRadius: radius.md,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.rose.base : colors.border,
          backgroundColor: selected ? colors.rose.soft : colors.surface,
          opacity: inert ? 0.5 : 1,
        }}
      >
        {icon?.({ size: iconScale.lg, color: selected ? colors.rose.text : colors.textSecondary })}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{label}</Text>
          {detail ? (
            <Text variant="caption" tone={unavailableReason ? 'warning' : 'secondary'}>
              {detail}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.full,
            borderWidth: selected ? 0 : 1.5,
            borderColor: colors.border,
            backgroundColor: selected ? colors.rose.fill : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <Text variant="caption" tone="onAccent" style={{ fontWeight: '700' }}>
              ✓
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

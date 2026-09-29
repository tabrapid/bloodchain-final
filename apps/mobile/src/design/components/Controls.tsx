import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, Switch, View, type ViewStyle } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { fonts } from '../fonts';
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
  /** An icon drawn before the label. */
  icon?: (props: { size: number; color: string }) => ReactNode;
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
export function Toggle({ label, description, value, onValueChange, disabled = false, busy = false, icon }: ToggleProps) {
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
        gap: space.md,
        minHeight: hitTarget.comfortable,
        paddingVertical: space.md,
        opacity: inert ? 0.5 : 1,
        backgroundColor: pressed ? colors.surfacePressed : 'transparent',
      })}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceRaised,
          }}
        >
          {icon({ size: iconScale.md, color: colors.textSecondary })}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyMedium">{label}</Text>
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
        trackColor={{ false: colors.track, true: colors.rose.fill }}
        thumbColor={colors.textOnAccent}
        ios_backgroundColor={colors.track}
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
          backgroundColor: colors.surface,
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
              paddingHorizontal: space.xs,
              borderRadius: radius.xs + 1,
              backgroundColor: selected ? colors.surfacePressed : 'transparent',
            }}
          >
            <Text
              variant="label"
              tone={selected ? 'primary' : 'secondary'}
              style={{ fontFamily: selected ? fonts.semibold : fonts.medium }}
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
  /** A short value on the right: a distance, a price, a count. */
  meta?: string;
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
  meta,
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
          gap: space.md,
          minHeight: hitTarget.comfortable,
          padding: space.lg,
          borderRadius: radius.lg,
          borderWidth: 1.5,
          borderColor: selected ? colors.rose.base : 'transparent',
          backgroundColor: selected ? colors.rose.soft : colors.surface,
          opacity: inert ? 0.5 : 1,
        }}
      >
        {icon ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.rose.soft : colors.surfaceRaised,
            }}
          >
            {icon({ size: iconScale.md + 2, color: selected ? colors.rose.base : colors.textSecondary })}
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyMedium">{label}</Text>
          {detail ? (
            <Text variant="caption" tone={unavailableReason ? 'warning' : 'secondary'}>
              {detail}
            </Text>
          ) : null}
        </View>
        {meta ? (
          <Text variant="label" tone="tertiary">
            {meta}
          </Text>
        ) : null}
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
          {selected ? <Check size={14} color={colors.textOnAccent} strokeWidth={3} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export interface OptionGridOption<T extends string> {
  value: T;
  label: string;
  /** Announced instead of the label, for a label that reads badly alone ("A+"). */
  accessibilityLabel?: string;
  disabled?: boolean;
}

export interface OptionGridProps<T extends string> {
  options: OptionGridOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** What is being chosen, e.g. "Blood type". Announced on the group. */
  accessibilityLabel: string;
  /** Items per row. Four fits a two-character label; three fits a time. */
  columns?: number;
  /** Draws the label in the display face at a larger size: for a blood type. */
  large?: boolean;
}

/**
 * A grid of short, mutually exclusive options: a blood type, a time slot.
 *
 * Between SegmentedControl (up to four words in a row) and Choice (a card per
 * option). Every cell is a `radio`, so a screen reader says "A plus, radio
 * button, 3 of 8, selected" instead of reading eight buttons with no
 * relationship.
 */
export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  columns = 4,
  large = false,
}: OptionGridProps<T>) {
  const { colors } = useDesign();
  const gap = space.sm;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={option.disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: Boolean(option.disabled) }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            style={({ pressed }) => ({
              // A row of `columns` cells has `columns - 1` gaps in it, and each
              // cell has to give up its share of all of them.
              width: `${100 / columns}%`,
              flexBasis: `${100 / columns}%`,
              flexGrow: 0,
              flexShrink: 1,
              maxWidth: `${100 / columns}%`,
              marginRight: (-gap * (columns - 1)) / columns,
              minHeight: large ? 60 : hitTarget.comfortable,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.sm,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: selected ? colors.rose.base : 'transparent',
              backgroundColor: selected
                ? colors.rose.soft
                : pressed
                  ? colors.surfacePressed
                  : colors.surface,
              opacity: option.disabled ? 0.4 : 1,
              transform: [{ scale: pressed && !option.disabled ? motion.pressScale : 1 }],
            })}
          >
            <Text
              variant={large ? 'valueSm' : 'bodyMedium'}
              tone={selected ? 'rose' : 'primary'}
              numberOfLines={1}
              style={large ? { fontVariant: ['tabular-nums'] } : undefined}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface FilterChipProps {
  /**
   * Which filter this is -- "Region", "Service". It is what makes the chip
   * readable out of context: the visible label is the chosen value.
   */
  field: string;
  /** The current value, shown on the chip. */
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  icon?: (props: { size: number; color: string }) => ReactNode;
  /** Draws the disclosure caret. Off for a chip that toggles rather than opens. */
  opens?: boolean;
}

/** A compact, tappable filter value. */
export function FilterChip({
  field,
  label,
  active = false,
  disabled = false,
  onPress,
  icon,
  opens = true,
}: FilterChipProps) {
  const { colors } = useDesign();
  const foreground = active ? colors.rose.text : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${field}: ${label}`}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        minHeight: 36,
        paddingHorizontal: space.md,
        borderRadius: radius.full,
        borderWidth: 1,
        backgroundColor: active ? colors.rose.soft : pressed ? colors.surfacePressed : colors.surface,
        borderColor: active ? colors.rose.base : 'transparent',
        opacity: disabled ? 0.4 : 1,
      })}
    >
      {icon?.({ size: iconScale.sm, color: foreground })}
      <Text variant="label" numberOfLines={1} style={{ color: foreground }}>
        {label}
      </Text>
      {opens ? <ChevronDown size={14} color={foreground} /> : null}
    </Pressable>
  );
}

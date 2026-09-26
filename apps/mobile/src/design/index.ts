/**
 * Bloodchain Mobile V2 — the design system.
 *
 * A screen imports from here and from nowhere else in this folder. One entry
 * point is what makes it possible to tell, by grepping the imports, whether a
 * screen has been rebuilt or is still on V1.
 *
 * NOT re-exported: `src/components/map/LocationMap`. react-native-maps links a
 * native module that Expo Go does not ship, so importing it anywhere in a
 * shared barrel would crash every screen -- map or not -- the moment the app
 * boots without a dev client. Import that file directly.
 */
export { useDesign } from './useDesign';
export {
  space,
  radius,
  elevation,
  type as typeScale,
  icon as iconSize,
  hitTarget,
  motion,
  layout,
  themes,
  palette,
} from './tokens';
export type { DesignColors, Accent, AccentName, TypeVariant, ElevationName } from './tokens';

export { Text, ValueText } from './components/Text';
export type { TextProps, TextTone } from './components/Text';

export { Surface, Well } from './components/Surface';
export type { SurfaceProps } from './components/Surface';

export { Button, IconButton, LinkButton, ButtonRow } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps, LinkButtonProps } from './components/Button';

export { Screen, ScrollScreen, FormScreen, Stack, Row, useTabBarClearance } from './components/Screen';
export type { ScreenProps, ScrollScreenProps } from './components/Screen';

export { Badge, StatusDot, Banner, EmergencyBanner } from './components/Status';
export type { BadgeProps, BannerProps, StatusTone } from './components/Status';

export {
  Skeleton,
  SkeletonRow,
  EmptyState,
  ErrorState,
  SectionError,
  InlineError,
  LoadingOverlay,
  LoadingSection,
} from './components/Feedback';
export type { SkeletonProps, EmptyStateProps, ErrorStateProps } from './components/Feedback';

export { Field, PasswordField, PhoneField, SearchField } from './components/Field';
export type { FieldProps, PasswordFieldProps, PhoneFieldProps, SearchFieldProps } from './components/Field';

export { OtpField } from './components/OtpField';
export type { OtpFieldProps } from './components/OtpField';

export { Toggle, SegmentedControl, Choice, OptionGrid, FilterChip } from './components/Controls';
export type {
  ToggleProps,
  SegmentedControlProps,
  ChoiceProps,
  OptionGridProps,
  OptionGridOption,
  FilterChipProps,
} from './components/Controls';

export { SectionHeader, ListRow, Divider, ListGroup } from './components/List';
export { Section, Sections } from './components/Section';
export type { SectionProps, SectionsProps, SectionGap, SectionRhythm } from './components/Section';
export type { SectionHeaderProps, ListRowProps } from './components/List';

/*
  The Sparkline is gone, and the Product Owner's rule is why: if a chart cannot
  communicate real data honestly, remove it.

  It scaled each series to its own min and max, so a haemoglobin reading that
  moved 0.1 g/dL across five months rendered as a line sweeping the full height
  of the box -- the same drawing a genuine collapse would produce. There was no
  axis to read it against and no reference range on it, and it defaulted to
  rose, which in this app is the alarm colour. Its one call site was the Health
  screen's headline card, where it sat beside a badge reading "within healthy
  range" and contradicted it.

  The trends screen draws the real chart: straight segments between measured
  points, a y-axis, and the laboratory's reference range as two dashed lines.
  Deleting this rather than leaving it exported is deliberate -- an unused
  primitive in the barrel is an invitation, and the next screen that wanted "a
  little line showing the trend" would have taken it.
*/

export { Stat, StatRow, Progress, Avatar } from './components/Stat';
export type { StatProps, ProgressProps, AvatarProps } from './components/Stat';

export { BottomSheet, ConfirmationSheet, PermissionExplainer } from './components/Sheet';
export type { SheetProps, ConfirmationSheetProps, PermissionExplainerProps } from './components/Sheet';

export { MonthGrid } from './components/MonthGrid';
export type { MonthGridProps } from './components/MonthGrid';

export { FlowStep } from './components/Flow';
export type { FlowStepProps } from './components/Flow';

export { ScreenHeader, ScreenTitle, TabBar } from './components/Chrome';
export type { ScreenHeaderProps, ScreenTitleProps } from './components/Chrome';

/** The typeface. Screens needing a face for a one-off use `fonts.semibold`, never a numeric weight. */
export { fonts, useAppFonts, type FontFamily } from './fonts';

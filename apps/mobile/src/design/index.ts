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
export type { SectionHeaderProps, ListRowProps } from './components/List';

export { Sparkline } from './components/Chart';
export type { SparklineProps } from './components/Chart';

export { Stat, StatRow, Progress, Avatar } from './components/Stat';
export type { StatProps, ProgressProps, AvatarProps } from './components/Stat';

export { BottomSheet, ConfirmationSheet, PermissionExplainer } from './components/Sheet';
export type { SheetProps, ConfirmationSheetProps, PermissionExplainerProps } from './components/Sheet';

export { MonthGrid } from './components/MonthGrid';
export type { MonthGridProps } from './components/MonthGrid';

export { FlowStep } from './components/Flow';
export type { FlowStepProps } from './components/Flow';

export { ScreenHeader, TabBar } from './components/Chrome';
export type { ScreenHeaderProps } from './components/Chrome';

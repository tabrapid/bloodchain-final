import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { space } from '../tokens';
import { SectionHeader } from './List';

/**
 * A group of content that is NOT a card.
 *
 * V2 had one way to say "these things belong together": wrap them in a
 * `Surface`. Seventy-five times. The result was the thing the Product Owner
 * described as a card wall — six or seven rounded rectangles of identical
 * width, radius and fill stacked down every screen, at a uniform 24pt apart, so
 * that nothing was grouped with anything and nothing outranked anything. A card
 * that appears everywhere carries no information; it is just a border.
 *
 * Grouping is a rhythm problem, not a container problem. What actually tells a
 * reader that four rows belong together is that they sit 8 apart while the next
 * group starts 32 below, under its own header. That costs no box, no border and
 * no shadow, and it survives a renderer that disagrees about all three.
 *
 * So: use `Section` by default, and `Surface` only when the content is a
 * distinct object, a single tappable entity, or genuinely floating above the
 * page. The rule of thumb that keeps this honest — if you cannot say what the
 * box means, it does not mean anything.
 */

export type SectionGap = 'tight' | 'related' | 'none';

export interface SectionProps {
  /** The overline above the group. Omit for a group that needs no label. */
  title?: string;
  /** One line under the title. */
  subtitle?: string;
  /** A small control on the header's right — "See all", "Edit". */
  action?: ReactNode;
  /**
   * The rhythm INSIDE the group.
   *
   * `tight` (8) is for things that are one thing read together: a stat and its
   * label, a value and its unit. `related` (16) is for separate items that
   * belong to the same idea. There is deliberately no larger option: anything
   * needing more air is a different section.
   */
  gap?: SectionGap;
  children: ReactNode;
  style?: ViewStyle;
}

const GAPS: Record<SectionGap, number> = {
  tight: space.sm, // 8
  related: space.lg, // 16
  none: 0,
};

export function Section({ title, subtitle, action, gap = 'related', children, style }: SectionProps) {
  return (
    <View style={[{ gap: GAPS[gap] }, style]}>
      {title ? <SectionHeader title={title} subtitle={subtitle} action={action} /> : null}
      {children}
    </View>
  );
}

/**
 * The vertical rhythm BETWEEN sections.
 *
 * V2 spaced everything 24 apart, which is why its screens read as a list rather
 * than a composition: a uniform gap is the same as no gap, because the eye
 * groups by relative distance and there was nothing relative about it.
 *
 *   standard (24)  one section to the next
 *   major    (32)  a change of subject — clinical content to gamification
 *   break    (48)  rare, and only where a screen genuinely has two halves
 */
export type SectionRhythm = 'standard' | 'major' | 'break';

const RHYTHM: Record<SectionRhythm, number> = {
  standard: space.xl, // 24
  major: space.xxl, // 32
  break: space.xxxl, // 48
};

export interface SectionsProps {
  rhythm?: SectionRhythm;
  children: ReactNode;
  style?: ViewStyle;
}

/** Stacks sections at a deliberate distance. The screen's outermost container. */
export function Sections({ rhythm = 'standard', children, style }: SectionsProps) {
  return <View style={[{ gap: RHYTHM[rhythm] }, style]}>{children}</View>;
}

import {
  Activity,
  AlertCircle,
  Award,
  CalendarCheck,
  Droplet,
  Droplets,
  Heart,
  Shield,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react-native';
import type { LucideIcon } from '../../types/icons';

/**
 * The backend's real icon keys, which are lucide names in kebab-case.
 *
 * See apps/api/src/modules/gamification/config/gamification.config.ts. An
 * unknown key falls back to a shield at the call site rather than rendering
 * nothing, because a badge with no mark reads as a broken image.
 */
export const gamificationIcons: Record<string, LucideIcon> = {
  droplet: Droplet,
  'droplet-plus': Droplets,
  award: Award,
  heart: Heart,
  'alert-circle': AlertCircle,
  users: Users,
  activity: Activity,
  'trending-up': TrendingUp,
  'user-check': UserCheck,
  star: Star,
  zap: Zap,
  'calendar-check': CalendarCheck,
  shield: Shield,
};

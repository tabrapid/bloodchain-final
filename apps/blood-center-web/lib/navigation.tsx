import {
  Bell,
  BarChart3,
  Building2,
  Beaker,
  CalendarDays,
  Droplet,
  HeartPulse,
  LayoutDashboard,
  Package,
  UserRound,
  Truck,
  Users,
} from 'lucide-react';
import type { SidebarItem } from '@bloodchain/ui/components';

export const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', labelKey: 'portal.nav.dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'donations', label: 'Donations', labelKey: 'portal.nav.donations', icon: HeartPulse, href: '/donations' },
  { id: 'requests', label: 'Blood Requests', labelKey: 'portal.nav.requests', icon: Droplet, href: '/requests' },
  { id: 'inventory', label: 'Inventory', labelKey: 'portal.nav.inventory', icon: Package, href: '/inventory' },
  { id: 'laboratory', label: 'Laboratory', labelKey: 'portal.nav.laboratory', icon: Beaker, href: '/laboratory' },
  { id: 'shipments', label: 'Shipments', labelKey: 'portal.nav.shipments', icon: Truck, href: '/shipments' },
  { id: 'couriers', label: 'Couriers', labelKey: 'portal.nav.couriers', icon: Users, href: '/couriers' },
  { id: 'appointments', label: 'Appointments', labelKey: 'portal.nav.appointments', icon: CalendarDays, href: '/appointments' },
  { id: 'analytics', label: 'Analytics', labelKey: 'portal.nav.analytics', icon: BarChart3, href: '/analytics' },
  { id: 'donors', label: 'Donors', labelKey: 'portal.nav.donors', icon: Users, href: '/donors' },
  { id: 'organization', label: 'Organization', labelKey: 'portal.nav.organization', icon: Building2, href: '/organization' },
  { id: 'notifications', label: 'Notifications', labelKey: 'portal.nav.notifications', icon: Bell, href: '/notifications' },
  // Was a permanently disabled 'Settings' entry with nothing behind it. It is
  // now the account page, which is the only setting this console actually has.
  { id: 'account', label: 'My account', labelKey: 'portal.nav.account', icon: UserRound, href: '/account' },
];

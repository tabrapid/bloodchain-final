import {
  Bell,
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  Droplet,
  HeartPulse,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import type { SidebarItem } from '@bloodchain/ui/components';

export const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', labelKey: 'portal.nav.dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'emergency', label: 'Emergency', labelKey: 'portal.nav.emergency', icon: Activity, href: '/emergency' },
  { id: 'donations', label: 'Donations', labelKey: 'portal.nav.donations', icon: HeartPulse, href: '/donations' },
  { id: 'requests', label: 'Blood Requests', labelKey: 'portal.nav.requests', icon: Droplet, href: '/requests' },
  { id: 'shipments', label: 'Shipments', labelKey: 'portal.nav.shipments', icon: Truck, href: '/shipments' },
  { id: 'analytics', label: 'Analytics', labelKey: 'portal.nav.analytics', icon: BarChart3, href: '/analytics' },
  { id: 'donors', label: 'Donors', labelKey: 'portal.nav.donors', icon: Users, href: '/donors' },
  { id: 'appointments', label: 'Appointments', labelKey: 'portal.nav.appointments', icon: CalendarDays, href: '/appointments' },
  { id: 'inventory', label: 'Inventory', labelKey: 'portal.nav.inventory', icon: Package, href: '/inventory' },
  { id: 'organization', label: 'Organization', labelKey: 'portal.nav.organization', icon: Building2, href: '/organization' },
  { id: 'notifications', label: 'Notifications', labelKey: 'portal.nav.notifications', icon: Bell, href: '/notifications' },
  { id: 'settings', label: 'Settings', labelKey: 'portal.nav.settings', icon: Settings, disabled: true },
];

import {
  BarChart3,
  Beaker,
  CalendarDays,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import type { SidebarItem } from '@donor/ui/components';

export const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'inventory', label: 'Inventory', icon: Package, href: '/inventory' },
  { id: 'laboratory', label: 'Laboratory', icon: Beaker, href: '/laboratory' },
  { id: 'shipments', label: 'Shipments', icon: Truck, href: '/shipments' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, disabled: true },
  { id: 'donors', label: 'Donors', icon: Users, disabled: true },
  { id: 'settings', label: 'Settings', icon: Settings, disabled: true },
];

import {
  Activity,
  BarChart3,
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
  { id: 'emergency', label: 'Emergency', icon: Activity, href: '/emergency' },
  { id: 'shipments', label: 'Shipments', icon: Truck, href: '/shipments' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { id: 'donors', label: 'Donors', icon: Users, disabled: true },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, disabled: true },
  { id: 'inventory', label: 'Inventory', icon: Package, disabled: true },
  { id: 'settings', label: 'Settings', icon: Settings, disabled: true },
];

import {
  BarChart3,
  Beaker,
  CalendarDays,
  Droplet,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import type { SidebarItem } from '@donor/ui/components';

export const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'requests', label: 'Blood Requests', icon: Droplet, href: '/requests' },
  { id: 'inventory', label: 'Inventory', icon: Package, href: '/inventory' },
  { id: 'laboratory', label: 'Laboratory', icon: Beaker, href: '/laboratory' },
  { id: 'shipments', label: 'Shipments', icon: Truck, href: '/shipments' },
  { id: 'couriers', label: 'Couriers', icon: Users, href: '/couriers' },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, href: '/appointments' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { id: 'donors', label: 'Donors', icon: Users, disabled: true },
  { id: 'settings', label: 'Settings', icon: Settings, disabled: true },
];

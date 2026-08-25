import {
  Activity,
  AlertTriangle,
  Bell,
  Brain,
  Building2,
  Droplet,
  FileText,
  KeyRound,
  LayoutDashboard,
  Package,
  Settings,
  Ship,
  TestTube,
  Users,
} from 'lucide-react';
import type { SidebarItem } from '@donor/ui/components';

export const navItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'users', label: 'Users', icon: Users, href: '/users' },
  { id: 'roles', label: 'Roles & Permissions', icon: KeyRound, href: '/roles' },
  { id: 'organizations', label: 'Organizations', icon: Building2, href: '/organizations' },
  { id: 'couriers', label: 'Couriers', icon: Ship, href: '/couriers' },
  { id: 'shipments', label: 'Shipments', icon: Package, href: '/shipments' },
  { id: 'requests', label: 'Blood Requests', icon: Droplet, href: '/requests' },
  { id: 'emergencies', label: 'Emergencies', icon: AlertTriangle, href: '/emergencies' },
  { id: 'inventory', label: 'Inventory', icon: TestTube, href: '/inventory' },
  { id: 'alerts', label: 'Alerts', icon: Bell, href: '/alerts' },
  { id: 'ai-analytics', label: 'AI Analytics', icon: Brain, href: '/ai-analytics' },
  { id: 'audit', label: 'Audit Logs', icon: FileText, href: '/audit' },
  { id: 'health', label: 'System Health', icon: Activity, href: '/health' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

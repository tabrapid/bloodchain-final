'use client';

import { useEffect, useState } from 'react';
import { TestTube, AlertTriangle, Droplet } from 'lucide-react';
import { DashboardShell, LoadingState } from '@donor/ui/components';
import { getInventoryOverview, listAlerts } from '../lib/api';
import { me, isAuthenticated } from '../lib/auth';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'couriers', label: 'Couriers', icon: Ship },
  { id: 'shipments', label: 'Shipments', icon: Package },
  { id: 'requests', label: 'Blood Requests', icon: Droplet },
  { id: 'emergencies', label: 'Emergencies', icon: AlertTriangle },
  { id: 'inventory', label: 'Inventory', icon: TestTube },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
  { id: 'health', label: 'System Health', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

import {
  LayoutDashboard,
  Users,
  Building2,
  Ship,
  Package,
  Droplet,
  AlertTriangle,
  TestTube,
  Bell,
  FileText,
  Activity,
  Settings,
} from 'lucide-react';

export default function InventoryPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadData();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadData() {
    try {
      const [invData, alertsData] = await Promise.all([
        getInventoryOverview(),
        listAlerts({ limit: 20 }),
      ]);
      setInventory(invData);
      setAlerts(alertsData.data);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell sidebarItems={navItems} user={currentUser} onLogout={() => {}}>
        <LoadingState />
      </DashboardShell>
    );
  }

  const bloodTypes = ['A', 'B', 'AB', 'O'];
  const rhFactors = ['POSITIVE', 'NEGATIVE'];

  return (
    <DashboardShell sidebarItems={navItems} user={currentUser} onLogout={() => {}}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Blood Inventory Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide blood inventory summary</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-medium text-gray-900 mb-4">Inventory by Blood Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {bloodTypes.map((bt) =>
              rhFactors.map((rh) => {
                const key = `${bt}${rh}`;
                const data = inventory?.byBloodGroup?.[key] || { total: 0, available: 0, reserved: 0 };
                return (
                  <div key={key} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplet className="w-4 h-4 text-red-500" />
                      <span className="font-semibold text-gray-900">{key}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total</span>
                        <span className="font-medium">{data.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Available</span>
                        <span className="font-medium text-green-600">{data.available}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Reserved</span>
                        <span className="font-medium text-amber-600">{data.reserved}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Low Stock Alerts</h3>
            <span className="text-sm text-red-600 font-medium">{alerts.length} active</span>
          </div>
          <div className="divide-y divide-gray-100">
            {alerts.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">No low stock alerts</div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                      <p className="text-xs text-gray-500">
                        {alert.organization?.name} - {alert.bloodType}{alert.rhFactor}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

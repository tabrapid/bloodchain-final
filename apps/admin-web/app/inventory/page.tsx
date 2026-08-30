'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
import { getInventoryOverview, listAlerts } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import { LayoutDashboard, Users, Building2, Ship, Package, Droplet, AlertTriangle, TestTube, Bell, FileText, Activity, Settings } from 'lucide-react';
import { AppShell } from '../../components/AppShell';

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
      <AppShell title="Blood Inventory" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  const bloodTypes = ['A', 'B', 'AB', 'O'];
  const rhFactors = ['POSITIVE', 'NEGATIVE'];

  return (
    <AppShell title="Blood Inventory" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-donor-text">Blood Inventory Overview</h1>
          <p className="text-sm text-donor-muted mt-1">Platform-wide blood inventory summary</p>
        </div>

        <div className="bc-glass rounded-card p-6 mb-6">
          <h3 className="font-medium text-donor-text mb-4">Inventory by Blood Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {bloodTypes.map((bt) =>
              rhFactors.map((rh) => {
                const key = `${bt}${rh}`;
                const data = inventory?.byBloodGroup?.[key] || { total: 0, available: 0, reserved: 0 };
                return (
                  <div key={key} className="bg-donor-elevated rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplet className="w-4 h-4 text-donor-danger" />
                      <span className="font-semibold text-donor-text">{key}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-donor-muted">Total</span>
                        <span className="font-medium">{data.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-donor-muted">Available</span>
                        <span className="font-medium text-donor-success">{data.available}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-donor-muted">Reserved</span>
                        <span className="font-medium text-donor-warning">{data.reserved}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bc-glass rounded-card">
          <div className="px-4 py-3 border-b border-donor-border/40 flex items-center justify-between">
            <h3 className="font-medium text-donor-text">Low Stock Alerts</h3>
            <span className="text-sm text-donor-danger font-medium">{alerts.length} active</span>
          </div>
          <div className="divide-y divide-donor-border/40">
            {alerts.length === 0 ? (
              <div className="p-4 text-sm text-donor-muted text-center">No low stock alerts</div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-donor-warning" />
                    <div>
                      <p className="text-sm font-medium text-donor-text">{alert.message}</p>
                      <p className="text-xs text-donor-muted">
                        {alert.organization?.name} - {alert.bloodType}{alert.rhFactor}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-donor-muted">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

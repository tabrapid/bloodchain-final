'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, LoadingState } from '@donor/ui/components';
import { me, isAuthenticated } from '@lib/auth';
import { LayoutDashboard, Users, Building2, Ship, Package, Droplet, AlertTriangle, TestTube, Bell, FileText, Activity, Settings, Shield, Database, Settings as SettingsIcon } from 'lucide-react';

import { navItems } from '@lib/navigation';

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <DashboardShell title="Platform Settings" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Platform Settings" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Platform Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure platform-wide settings and feature flags</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Security Settings</h3>
                <p className="text-sm text-gray-500">Authentication and access control</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Two-Factor Authentication</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Configurable</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Session Timeout</span>
                <span className="text-sm font-medium text-gray-900">24 hours</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Password Policy</span>
                <span className="text-sm font-medium text-gray-900">Strong</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Notification Settings</h3>
                <p className="text-sm text-gray-500">Platform notification configuration</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Email Notifications</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Enabled</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Push Notifications</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Enabled</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">SMS Notifications</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Enabled</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <SettingsIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Feature Flags</h3>
                <p className="text-sm text-gray-500">Enable or disable platform features</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">AI Health Insights</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Enabled</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">SOS Emergency</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Enabled</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Gamification</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Enabled</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Courier Tracking</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Enabled</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Platform Info</h3>
                <p className="text-sm text-gray-500">System version and status</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Platform Version</span>
                <span className="text-sm font-medium text-gray-900">1.0.0</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">API Status</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Operational</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Database Status</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

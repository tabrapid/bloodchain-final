'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, LoadingState } from '@donor/ui/components';
import { me, isAuthenticated } from '@lib/auth';
import {
  getPlatformSettings,
  updatePlatformSettings,
  getSystemHealth,
  type PlatformSettings,
  type SystemHealth,
} from '@lib/api';
import { AlertTriangle, Bell, Database, Settings as SettingsIcon, Shield, X } from 'lucide-react';

import { navItems } from '@lib/navigation';

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-green-600' : 'bg-gray-300'
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-1'
          }`}
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        const [settingsData, healthData] = await Promise.all([getPlatformSettings(), getSystemHealth()]);
        setSettings(settingsData);
        setHealth(healthData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function save(section: string, patch: Partial<PlatformSettings>) {
    setSavingSection(section);
    setError(null);
    setSavedMessage(null);
    try {
      const updated = await updatePlatformSettings(patch);
      setSettings(updated);
      setSavedMessage(`${section} saved`);
      setTimeout(() => setSavedMessage(null), 2500);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save settings');
    } finally {
      setSavingSection(null);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell title="Platform Settings" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
        <LoadingState />
      </DashboardShell>
    );
  }

  if (!settings) {
    return (
      <DashboardShell title="Platform Settings" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
        <div className="p-6 text-sm text-gray-500">Failed to load platform settings.</div>
      </DashboardShell>
    );
  }

  const sessionTimeoutHours = Math.round((settings.sessionTimeoutMinutes / 60) * 10) / 10;

  return (
    <DashboardShell title="Platform Settings" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Platform Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure platform-wide settings and feature flags</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-800">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}

        {savedMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            {savedMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Security Settings</h3>
                <p className="text-sm text-gray-500">Authentication and session policy</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">Session Timeout</span>
                  <span className="text-xs text-gray-500">{sessionTimeoutHours}h</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={720}
                  step={1}
                  value={sessionTimeoutHours}
                  onChange={(e) =>
                    setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) * 60 })
                  }
                  className="w-full"
                />
                <p className="mt-1 text-xs text-gray-400">
                  How long a signed-in session stays valid before requiring re-login (1h–30d).
                </p>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Password Policy</span>
                <span className="text-xs text-gray-500 text-right max-w-[60%]">
                  Min. 12 chars, upper/lower/number/symbol (fixed)
                </span>
              </div>
            </div>
            <button
              onClick={() => save('Security settings', { sessionTimeoutMinutes: settings.sessionTimeoutMinutes })}
              disabled={savingSection === 'Security settings'}
              className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {savingSection === 'Security settings' ? 'Saving...' : 'Save'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Notification Settings</h3>
                <p className="text-sm text-gray-500">Platform notification channels</p>
              </div>
            </div>
            <div className="space-y-3">
              <Toggle
                label="Push Notifications"
                checked={settings.pushNotificationsEnabled}
                onChange={(v) => setSettings({ ...settings, pushNotificationsEnabled: v })}
              />
              <p className="text-xs text-gray-400 px-1">
                Email is used only for account verification, not general notifications. SMS delivery
                isn&apos;t implemented — there is nothing to toggle for either channel yet.
              </p>
            </div>
            <button
              onClick={() =>
                save('Notification settings', { pushNotificationsEnabled: settings.pushNotificationsEnabled })
              }
              disabled={savingSection === 'Notification settings'}
              className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {savingSection === 'Notification settings' ? 'Saving...' : 'Save'}
            </button>
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
              <Toggle
                label="AI Health Insights"
                checked={settings.aiHealthInsightsEnabled}
                onChange={(v) => setSettings({ ...settings, aiHealthInsightsEnabled: v })}
              />
              <Toggle
                label="SOS Emergency"
                checked={settings.sosEmergencyEnabled}
                onChange={(v) => setSettings({ ...settings, sosEmergencyEnabled: v })}
              />
              <Toggle
                label="Gamification"
                checked={settings.gamificationEnabled}
                onChange={(v) => setSettings({ ...settings, gamificationEnabled: v })}
              />
            </div>
            <button
              onClick={() =>
                save('Feature flags', {
                  aiHealthInsightsEnabled: settings.aiHealthInsightsEnabled,
                  sosEmergencyEnabled: settings.sosEmergencyEnabled,
                  gamificationEnabled: settings.gamificationEnabled,
                })
              }
              disabled={savingSection === 'Feature flags'}
              className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {savingSection === 'Feature flags' ? 'Saving...' : 'Save'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Platform Info</h3>
                <p className="text-sm text-gray-500">Live system version and status</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Platform Version</span>
                <span className="text-sm font-medium text-gray-900">{health?.version ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">API Status</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    health?.status === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {health?.status === 'healthy' ? 'Operational' : health?.status ?? 'Unknown'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Database Status</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    health?.database === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {health?.database === 'up' ? 'Connected' : health?.database ?? 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-red-200 p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Maintenance Mode</h3>
                <p className="text-sm text-gray-500">
                  Blocks sign-in for everyone except SUPER_ADMIN accounts platform-wide
                </p>
              </div>
            </div>
            <Toggle
              label="Maintenance Mode"
              checked={settings.maintenanceMode}
              onChange={(v) => setSettings({ ...settings, maintenanceMode: v })}
            />
            <button
              onClick={() => save('Maintenance mode', { maintenanceMode: settings.maintenanceMode })}
              disabled={savingSection === 'Maintenance mode'}
              className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {savingSection === 'Maintenance mode' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

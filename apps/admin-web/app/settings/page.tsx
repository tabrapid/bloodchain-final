'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
import { me, isAuthenticated } from '@lib/auth';
import {
  getPlatformSettings,
  updatePlatformSettings,
  getSystemHealth,
  type PlatformSettings,
  type SystemHealth,
} from '@lib/api';
import { AlertTriangle, Bell, Database, Settings as SettingsIcon, Shield, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

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
    <div className="flex items-center justify-between p-3 bg-donor-elevated rounded-lg">
      <span className="text-sm text-donor-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-donor-success' : 'bg-donor-muted/40'
        } disabled:opacity-50`}
      >
        <span
          className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
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
      <AppShell title={t('ops.settings.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  if (!settings) {
    return (
      <AppShell title={t('ops.settings.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <div className="p-6 text-sm text-donor-muted">{t('ops.settings.loadFailed')}</div>
      </AppShell>
    );
  }

  const sessionTimeoutHours = Math.round((settings.sessionTimeoutMinutes / 60) * 10) / 10;

  return (
    <AppShell title={t('ops.settings.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-donor-muted">{t('ops.settings.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-donor-dangerMuted border border-donor-danger/30 rounded-lg flex items-center justify-between">
            <p className="text-sm text-donor-onDangerMuted">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 text-donor-onDangerMuted" />
            </button>
          </div>
        )}

        {savedMessage && (
          <div className="mb-4 p-3 bg-donor-successMuted border border-donor-success/30 rounded-lg text-sm text-donor-onSuccessMuted">
            {savedMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-donor-secondaryMuted rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-donor-onSecondaryMuted" />
              </div>
              <div>
                <h3 className="font-medium text-donor-text">{t('ops.settings.security')}</h3>
                <p className="text-sm text-donor-muted">{t('ops.settings.securityHint')}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-donor-elevated rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-donor-text">{t('ops.settings.sessionTimeout')}</span>
                  <span className="text-xs text-donor-muted">{sessionTimeoutHours}h</span>
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
                <p className="mt-1 text-xs text-donor-muted">{t('ops.settings.sessionTimeoutHint')}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-donor-elevated rounded-lg">
                <span className="text-sm text-donor-text">{t('ops.settings.passwordPolicy')}</span>
                <span className="text-xs text-donor-muted text-right max-w-[60%]">
                  {t('ops.settings.passwordPolicyFixed')}
                </span>
              </div>
            </div>
            <button
              onClick={() => save('Security settings', { sessionTimeoutMinutes: settings.sessionTimeoutMinutes })}
              disabled={savingSection === 'Security settings'}
              className="mt-4 w-full bg-donor-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-primary/85 disabled:opacity-50"
            >
              {savingSection === 'Security settings' ? t('common.saving') : t('actions.save')}
            </button>
          </div>

          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-donor-successMuted rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-donor-onSuccessMuted" />
              </div>
              <div>
                <h3 className="font-medium text-donor-text">{t('ops.settings.notifications')}</h3>
                <p className="text-sm text-donor-muted">{t('ops.settings.notificationsHint')}</p>
              </div>
            </div>
            <div className="space-y-3">
              <Toggle
                label={t('ops.settings.pushNotifications')}
                checked={settings.pushNotificationsEnabled}
                onChange={(v) => setSettings({ ...settings, pushNotificationsEnabled: v })}
              />
              <p className="text-xs text-donor-muted px-1">{t('ops.settings.channelsHint')}</p>
            </div>
            <button
              onClick={() =>
                save('Notification settings', { pushNotificationsEnabled: settings.pushNotificationsEnabled })
              }
              disabled={savingSection === 'Notification settings'}
              className="mt-4 w-full bg-donor-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-primary/85 disabled:opacity-50"
            >
              {savingSection === 'Notification settings' ? t('common.saving') : t('actions.save')}
            </button>
          </div>

          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-donor-aiMuted rounded-lg flex items-center justify-center">
                <SettingsIcon className="w-5 h-5 text-donor-onAiMuted" />
              </div>
              <div>
                <h3 className="font-medium text-donor-text">{t('ops.settings.featureFlags')}</h3>
                <p className="text-sm text-donor-muted">{t('ops.settings.featureFlagsHint')}</p>
              </div>
            </div>
            <div className="space-y-3">
              <Toggle
                label={t('ops.settings.aiHealthInsights')}
                checked={settings.aiHealthInsightsEnabled}
                onChange={(v) => setSettings({ ...settings, aiHealthInsightsEnabled: v })}
              />
              <Toggle
                label={t('ops.settings.sosEmergency')}
                checked={settings.sosEmergencyEnabled}
                onChange={(v) => setSettings({ ...settings, sosEmergencyEnabled: v })}
              />
              <Toggle
                label={t('ops.settings.gamification')}
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
              className="mt-4 w-full bg-donor-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-primary/85 disabled:opacity-50"
            >
              {savingSection === 'Feature flags' ? t('common.saving') : t('actions.save')}
            </button>
          </div>

          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-donor-warningMuted rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-donor-onWarningMuted" />
              </div>
              <div>
                <h3 className="font-medium text-donor-text">{t('ops.settings.platformInfo')}</h3>
                <p className="text-sm text-donor-muted">{t('ops.settings.platformInfoHint')}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-donor-elevated rounded-lg">
                <span className="text-sm text-donor-text">{t('ops.settings.platformVersion')}</span>
                <span className="text-sm font-medium text-donor-text">{health?.version ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-donor-elevated rounded-lg">
                <span className="text-sm text-donor-text">{t('ops.dashboard.apiStatus')}</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    health?.status === 'healthy' ? 'bg-donor-successMuted text-donor-onSuccessMuted' : 'bg-donor-dangerMuted text-donor-onDangerMuted'
                  }`}
                >
                  {health?.status === 'healthy' ? 'Operational' : health?.status ?? 'Unknown'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-donor-elevated rounded-lg">
                <span className="text-sm text-donor-text">{t('ops.settings.databaseStatus')}</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    health?.database === 'up' ? 'bg-donor-successMuted text-donor-onSuccessMuted' : 'bg-donor-dangerMuted text-donor-onDangerMuted'
                  }`}
                >
                  {health?.database === 'up' ? 'Connected' : health?.database ?? 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          <div className="bc-glass rounded-card border-donor-danger/30 p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-donor-dangerMuted rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-donor-onDangerMuted" />
              </div>
              <div>
                <h3 className="font-medium text-donor-text">{t('ops.settings.maintenanceMode')}</h3>
                <p className="text-sm text-donor-muted">
                  {t('ops.settings.maintenanceHint')}
                </p>
              </div>
            </div>
            <Toggle
              label={t('ops.settings.maintenanceMode')}
              checked={settings.maintenanceMode}
              onChange={(v) => setSettings({ ...settings, maintenanceMode: v })}
            />
            <button
              onClick={() => save('Maintenance mode', { maintenanceMode: settings.maintenanceMode })}
              disabled={savingSection === 'Maintenance mode'}
              className="mt-4 w-full bg-donor-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-primary/85 disabled:opacity-50"
            >
              {savingSection === 'Maintenance mode' ? t('common.saving') : t('actions.save')}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

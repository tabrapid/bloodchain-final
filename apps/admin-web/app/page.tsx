'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Shield,
  TestTube,
  UserCheck,
  X,
  Users,
  Building2,
  Droplet,
  Package,
  Ship,
  Clock,
  Activity,
} from 'lucide-react';
import { DashboardShell, StatCard, EmptyState, LoadingState } from '@bloodchain/ui/components';
import { StatusBadgeWrapper } from '@lib/status';
import { login, logout as logoutApi, me, isAuthenticated } from '@lib/auth';
import {
  getDashboard,
  listOrganizations,
  listUsers,
  listEmergencies,
  listAlerts,
  listShipments,
  getSystemHealth,
} from '@lib/api';
import { navItems } from '@lib/navigation';

interface PlatformStats {
  users: { total: number; active: number; verifiedDonors: number };
  organizations: { hospitals: number; bloodCenters: number; pending: number; suspended: number };
  couriers: number;
  bloodRequests: { active: number; critical: number };
  emergencies: { active: number };
  shipments: { active: number };
  todayActivity: { donations: number; appointments: number; bloodTests: number };
  alerts: { lowStock: number; criticalStock: number };
}

interface User {
  firstName: string;
  lastName: string;
  roles: string[];
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [pendingOrgs, setPendingOrgs] = useState<any[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          if (!userData.roles.includes('SUPER_ADMIN')) {
            setError('Access denied. Super Admin role required.');
            setIsLoading(false);
            return;
          }
          setUser({
            firstName: userData.firstName,
            lastName: userData.lastName,
            roles: userData.roles,
          });
          await loadDashboardData();
        }
      } catch (err) {
        setError('Authentication failed');
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  async function loadDashboardData() {
    try {
      const [statsData, healthData] = await Promise.all([
        getDashboard(),
        getSystemHealth(),
      ]);
      setStats(statsData);
      setHealth(healthData);

      const [orgsData, emergenciesData, alertsData] = await Promise.all([
        listOrganizations({ status: 'PENDING_APPROVAL', limit: 5 }),
        listEmergencies({ status: 'ACTIVE', limit: 5 }),
        listAlerts({ acknowledged: 'false', limit: 10 }),
      ]);
      setPendingOrgs(orgsData.data);
      setActiveEmergencies(emergenciesData.data);
      setActiveAlerts(alertsData.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      const userData = await me();
      setUser({
        firstName: userData.firstName,
        lastName: userData.lastName,
        roles: userData.roles,
      });
      await loadDashboardData();
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutApi();
    setUser(null);
    setStats(null);
  };

  if (isLoading) {
    return (
      <DashboardShell title="Admin Dashboard" sidebarItems={[]} userName={user ? `${user.firstName} ${user.lastName}` : undefined} onLogout={handleLogout}>
        <LoadingState />
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Admin Portal</h1>
              <p className="text-sm text-gray-500">BloodChain Management</p>
            </div>
          </div>

          <h2 className="text-lg font-medium text-gray-900 mb-4">Sign in to continue</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell title="Admin Dashboard" sidebarItems={navItems} userName={user ? `${user.firstName} ${user.lastName}` : undefined} onLogout={handleLogout}>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Platform Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time overview of the BloodChain</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-800">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-amber-600" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Users"
            value={String(stats?.users.total ?? '-')}
            icon={Users}
            note={`${stats?.users.active ?? 0} active`}
          />
          <StatCard
            label="Verified Donors"
            value={String(stats?.users.verifiedDonors ?? '-')}
            icon={UserCheck}
            note="Active donors"
          />
          <StatCard
            label="Hospitals"
            value={String(stats?.organizations.hospitals ?? '-')}
            icon={Building2}
            note={`${stats?.organizations.pending ?? 0} pending`}
          />
          <StatCard
            label="Blood Centers"
            value={String(stats?.organizations.bloodCenters ?? '-')}
            icon={Droplet}
            note={`${stats?.organizations.suspended ?? 0} suspended`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Shipments"
            value={String(stats?.shipments.active ?? '-')}
            icon={Package}
            note="In transit"
          />
          <StatCard
            label="Active Emergencies"
            value={String(stats?.emergencies.active ?? '-')}
            icon={AlertTriangle}
            note="SOS requests"
          />
          <StatCard
            label="Blood Requests"
            value={String(stats?.bloodRequests.active ?? '-')}
            icon={Droplet}
            note={`${stats?.bloodRequests.critical ?? 0} critical`}
          />
          <StatCard
            label="Couriers"
            value={String(stats?.couriers ?? '-')}
            icon={Ship}
            note="Registered"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Donations Today"
            value={String(stats?.todayActivity.donations ?? '-')}
            icon={TestTube}
            note="Completed"
          />
          <StatCard
            label="Appointments Today"
            value={String(stats?.todayActivity.appointments ?? '-')}
            icon={Clock}
            note="Scheduled"
          />
          <StatCard
            label="Blood Tests Today"
            value={String(stats?.todayActivity.bloodTests ?? '-')}
            icon={Activity}
            note="Processed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Pending Organizations</h3>
              <span className="text-sm text-amber-600 font-medium">{pendingOrgs.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingOrgs.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">No pending organizations</div>
              ) : (
                pendingOrgs.map((org) => (
                  <div key={org.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{org.name}</p>
                      <p className="text-sm text-gray-500">{org.type}</p>
                    </div>
                    <StatusBadgeWrapper status="PENDING_APPROVAL" />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Active Emergencies</h3>
              <span className="text-sm text-red-600 font-medium">{activeEmergencies.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {activeEmergencies.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">No active emergencies</div>
              ) : (
                activeEmergencies.map((emergency) => (
                  <div key={emergency.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {emergency.bloodType}{emergency.rhFactor} - {emergency.unitsRequired} units
                      </p>
                      <p className="text-sm text-gray-500">{emergency.hospital?.name}</p>
                    </div>
                    <StatusBadgeWrapper status={emergency.status} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Active Alerts</h3>
              <span className="text-sm text-red-600 font-medium">{activeAlerts.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {activeAlerts.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">No active alerts</div>
              ) : (
                activeAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{alert.message}</p>
                      <p className="text-sm text-gray-500">{alert.type}</p>
                    </div>
                    <StatusBadgeWrapper status={alert.type === 'LOW_STOCK' ? 'WARNING' : 'INFO'} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-4">System Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">API Status</span>
              <span className="text-sm font-medium text-gray-900 ml-auto">{health?.status ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${health?.database === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">Database</span>
              <span className="text-sm font-medium text-gray-900 ml-auto">{health?.database ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Pending Orgs</span>
              <span className="text-sm font-medium text-gray-900 ml-auto">{health?.pending?.organizations ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Active Alerts</span>
              <span className="text-sm font-medium text-gray-900 ml-auto">{health?.alerts ?? '-'}</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

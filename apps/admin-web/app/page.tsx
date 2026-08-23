'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowUpRight,
  Building2,
  Droplet,
  LogOut,
  Package,
  Settings,
  Shield,
  Ship,
  TestTube,
  Users,
  UserCheck,
  Clock,
  TrendingUp,
  XCircle,
  CheckCircle,
  X,
  Search,
  ChevronRight,
  LayoutDashboard,
  FileText,
  Bell,
  Plus,
  Minus,
} from 'lucide-react';
import { DashboardShell, StatCard, StatusBadge, EmptyState, LoadingState } from '@donor/ui/components';
import { login, logout as logoutApi, me, isAuthenticated } from '../lib/auth';
import {
  getDashboard,
  listOrganizations,
  listUsers,
  listEmergencies,
  listAlerts,
  listShipments,
  getSystemHealth,
} from '../lib/api';

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

  const handleLogin = async () => {
    setError(null);
    try {
      await login('superadmin@donor.local', 'DevelopmentOnly!123');
      const userData = await me();
      setUser({
        firstName: userData.firstName,
        lastName: userData.lastName,
        roles: userData.roles,
      });
      await loadDashboardData();
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    }
  };

  const handleLogout = async () => {
    await logoutApi();
    setUser(null);
    setStats(null);
  };

  if (isLoading) {
    return (
      <DashboardShell sidebarItems={[]} user={null} onLogout={handleLogout}>
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
              <p className="text-sm text-gray-500">DONOR Platform Management</p>
            </div>
          </div>

          <h2 className="text-lg font-medium text-gray-900 mb-4">Sign in to continue</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Sign in as Super Admin
          </button>

          <p className="mt-4 text-xs text-gray-500 text-center">
            Development mode only. Uses seeded credentials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell sidebarItems={navItems} user={user} onLogout={handleLogout}>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Platform Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time overview of the DONOR platform</p>
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
            title="Total Users"
            value={stats?.users.total ?? '-'}
            icon={Users}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle={`${stats?.users.active ?? 0} active`}
          />
          <StatCard
            title="Verified Donors"
            value={stats?.users.verifiedDonors ?? '-'}
            icon={UserCheck}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle="Active donors"
          />
          <StatCard
            title="Hospitals"
            value={stats?.organizations.hospitals ?? '-'}
            icon={Building2}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle={`${stats?.organizations.pending ?? 0} pending`}
          />
          <StatCard
            title="Blood Centers"
            value={stats?.organizations.bloodCenters ?? '-'}
            icon={Droplet}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle={`${stats?.organizations.suspended ?? 0} suspended`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Active Shipments"
            value={stats?.shipments.active ?? '-'}
            icon={Package}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle="In transit"
          />
          <StatCard
            title="Active Emergencies"
            value={stats?.emergencies.active ?? '-'}
            icon={AlertTriangle}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle="SOS requests"
          />
          <StatCard
            title="Blood Requests"
            value={stats?.bloodRequests.active ?? '-'}
            icon={Droplet}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle={`${stats?.bloodRequests.critical ?? 0} critical`}
          />
          <StatCard
            title="Couriers"
            value={stats?.couriers ?? '-'}
            icon={Ship}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle="Registered"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="Donations Today"
            value={stats?.todayActivity.donations ?? '-'}
            icon={TestTube}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle="Completed"
          />
          <StatCard
            title="Appointments Today"
            value={stats?.todayActivity.appointments ?? '-'}
            icon={Clock}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle="Scheduled"
          />
          <StatCard
            title="Blood Tests Today"
            value={stats?.todayActivity.bloodTests ?? '-'}
            icon={Activity}
            trend={{ value: 0, direction: 'stable' as const }}
            subtitle="Processed"
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
                    <StatusBadge status="PENDING_APPROVAL" />
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
                    <StatusBadge status={emergency.status} />
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
                    <StatusBadge status={alert.type === 'LOW_STOCK' ? 'WARNING' : 'INFO'} />
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

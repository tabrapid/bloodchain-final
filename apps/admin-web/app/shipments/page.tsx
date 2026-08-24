'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, LoadingState } from '@donor/ui/components';
import { listShipments, getShipment, type Shipment } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import { LayoutDashboard, Users, Building2, Ship, Package, Droplet, AlertTriangle, TestTube, Bell, FileText, Activity, Settings } from 'lucide-react';

import { navItems } from '@lib/navigation';

export default function ShipmentsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadShipments();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadShipments(page = 1) {
    try {
      const data = await listShipments({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      setShipments(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load shipments:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadShipments(1);
  }

  if (isLoading) {
    return (
      <DashboardShell title="Shipment Monitoring" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Shipment Monitoring" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Shipment Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">Track and monitor all blood shipments across the platform</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-100">
            <form onSubmit={handleSearch} className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">All Status</option>
                <option value="CREATED">Created</option>
                <option value="COURIER_ASSIGNED">Courier Assigned</option>
                <option value="COURIER_ACCEPTED">Accepted</option>
                <option value="PICKUP_STARTED">Pickup Started</option>
                <option value="PICKED_UP">Picked Up</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="ARRIVED_AT_HOSPITAL">Arrived</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button
                type="submit"
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Filter
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reference</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Source</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Destination</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Courier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Units</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                      No shipments found
                    </td>
                  </tr>
                ) : (
                  shipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{shipment.shipmentReference}</p>
                        {shipment.bloodRequest && (
                          <p className="text-xs text-gray-500">{shipment.bloodRequest.priority}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={shipment.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {shipment.source?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {shipment.destination?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {shipment.courier?.displayName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {shipment.unitsCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(shipment.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadShipments(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => loadShipments(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

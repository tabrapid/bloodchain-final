'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, LoadingState } from '@bloodchain/ui/components';
import {
  listContentReports,
  getContentReport,
  resolveContentReport,
  type ContentReport,
  type ContentReportDetail,
} from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import { Flag, X } from 'lucide-react';

import { navItems } from '@lib/navigation';

export default function ModerationPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [reasonFilter, setReasonFilter] = useState('');
  const [selectedReport, setSelectedReport] = useState<ContentReportDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadReports();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReports(page = 1) {
    try {
      const data = await listContentReports({
        page,
        limit: 20,
        status: statusFilter || undefined,
        reason: reasonFilter || undefined,
      });
      setReports(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load content reports:', err);
    }
  }

  async function openReport(id: string) {
    try {
      const detail = await getContentReport(id);
      setSelectedReport(detail);
      setResolution('');
    } catch (err) {
      console.error('Failed to load report:', err);
    }
  }

  async function handleResolve(action: 'DISMISS' | 'HIDE' | 'REMOVE') {
    if (!selectedReport) return;
    setActionLoading(true);
    setError(null);
    try {
      await resolveContentReport(selectedReport.id, action, resolution || undefined);
      await loadReports(meta.page);
      setSelectedReport(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to resolve report');
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell title="Content Moderation" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Content Moderation" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Content Moderation</h1>
          <p className="text-sm text-gray-500 mt-1">Review reports filed against community posts</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-800">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-100 flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="DISMISSED">Dismissed</option>
              <option value="ACTIONED">Actioned</option>
            </select>
            <select
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Reasons</option>
              <option value="SPAM">Spam</option>
              <option value="HARASSMENT">Harassment</option>
              <option value="MISINFORMATION">Misinformation</option>
              <option value="INAPPROPRIATE">Inappropriate</option>
              <option value="OTHER">Other</option>
            </select>
            <button
              onClick={() => loadReports(1)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Filter
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Post</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reason</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reporter</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reported</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      No content reports found
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                            <Flag className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 max-w-xs truncate">{report.post.title}</p>
                            <p className="text-xs text-gray-500">Post status: {report.post.status}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {report.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {report.reporter.firstName} {report.reporter.lastName}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={report.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openReport(report.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Review
                        </button>
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
                  onClick={() => loadReports(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => loadReports(meta.page + 1)}
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

      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">Report Details</h3>
              <button onClick={() => setSelectedReport(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Post</p>
                <p className="font-semibold text-gray-900">{selectedReport.post.title}</p>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{selectedReport.post.body}</p>
                <p className="mt-1 text-xs text-gray-500">
                  By {selectedReport.post.author?.firstName} {selectedReport.post.author?.lastName} ·
                  Post status: {selectedReport.post.status}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Reason</p>
                  <p className="text-sm font-medium text-gray-900">{selectedReport.reason}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <StatusBadgeWrapper status={selectedReport.status} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reporter</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedReport.reporter.firstName} {selectedReport.reporter.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reported</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(selectedReport.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedReport.description && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Reporter&apos;s notes</p>
                  <p className="text-sm text-gray-700">{selectedReport.description}</p>
                </div>
              )}

              {selectedReport.otherReportsOnPost.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {selectedReport.otherReportsOnPost.length} other report(s) on this post
                  </p>
                  <div className="space-y-1">
                    {selectedReport.otherReportsOnPost.map((r) => (
                      <div key={r.id} className="text-xs text-gray-500 flex justify-between">
                        <span>{r.reason}</span>
                        <span>{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedReport.status === 'PENDING' || selectedReport.status === 'REVIEWED' ? (
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">Resolution note (optional)</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              ) : (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">Resolution</p>
                  <p className="text-sm text-gray-900">{selectedReport.resolution || '-'}</p>
                </div>
              )}
            </div>
            {(selectedReport.status === 'PENDING' || selectedReport.status === 'REVIEWED') && (
              <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => handleResolve('DISMISS')}
                  disabled={actionLoading}
                  className="flex-1 bg-gray-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleResolve('HIDE')}
                  disabled={actionLoading}
                  className="flex-1 bg-amber-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  Hide Post
                </button>
                <button
                  onClick={() => handleResolve('REMOVE')}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Remove Post
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
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
import { AppShell } from '../../components/AppShell';

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
      <AppShell title="Content Moderation" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title="Content Moderation" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-donor-muted">Review reports filed against community posts</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-donor-dangerMuted border border-donor-danger/30 rounded-lg flex items-center justify-between">
            <p className="text-sm text-donor-onDangerMuted">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 text-donor-onDangerMuted" />
            </button>
          </div>
        )}

        <div className="bc-glass rounded-card mb-6">
          <div className="p-4 border-b border-donor-border/40 flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
              className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
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
              className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
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
              className="bg-donor-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-donor-primary/85"
            >
              Filter
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-donor-elevated border-b border-donor-border/40">
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Post</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Reason</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Reporter</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Reported</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-donor-border/40">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-donor-muted">
                      No content reports found
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="hover:bg-donor-elevated">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-donor-elevated rounded flex items-center justify-center">
                            <Flag className="w-4 h-4 text-donor-muted" />
                          </div>
                          <div>
                            <p className="font-medium text-donor-text max-w-xs truncate">{report.post.title}</p>
                            <p className="text-xs text-donor-muted">Post status: {report.post.status}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-donor-secondaryMuted text-donor-onSecondaryMuted">
                          {report.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {report.reporter.firstName} {report.reporter.lastName}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={report.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openReport(report.id)}
                          className="text-donor-primary hover:text-donor-primary/70 text-sm font-medium"
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
            <div className="px-4 py-3 border-t border-donor-border/40 flex items-center justify-between">
              <p className="text-sm text-donor-muted">
                Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadReports(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => loadReports(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bc-glass-elevated bc-rise rounded-panel w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-donor-border/40 flex items-center justify-between sticky top-0 bc-solid">
              <h3 className="text-lg font-semibold text-donor-text">Report Details</h3>
              <button onClick={() => setSelectedReport(null)}>
                <X className="w-5 h-5 text-donor-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-donor-muted">Post</p>
                <p className="font-semibold text-donor-text">{selectedReport.post.title}</p>
                <p className="mt-1 text-sm text-donor-text whitespace-pre-wrap">{selectedReport.post.body}</p>
                <p className="mt-1 text-xs text-donor-muted">
                  By {selectedReport.post.author?.firstName} {selectedReport.post.author?.lastName} ·
                  Post status: {selectedReport.post.status}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-donor-muted">Reason</p>
                  <p className="text-sm font-medium text-donor-text">{selectedReport.reason}</p>
                </div>
                <div>
                  <p className="text-sm text-donor-muted">Status</p>
                  <StatusBadgeWrapper status={selectedReport.status} />
                </div>
                <div>
                  <p className="text-sm text-donor-muted">Reporter</p>
                  <p className="text-sm font-medium text-donor-text">
                    {selectedReport.reporter.firstName} {selectedReport.reporter.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-donor-muted">Reported</p>
                  <p className="text-sm font-medium text-donor-text">
                    {new Date(selectedReport.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedReport.description && (
                <div>
                  <p className="text-sm text-donor-muted mb-1">Reporter&apos;s notes</p>
                  <p className="text-sm text-donor-text">{selectedReport.description}</p>
                </div>
              )}

              {selectedReport.otherReportsOnPost.length > 0 && (
                <div className="border-t border-donor-border/40 pt-4">
                  <p className="text-sm font-medium text-donor-text mb-2">
                    {selectedReport.otherReportsOnPost.length} other report(s) on this post
                  </p>
                  <div className="space-y-1">
                    {selectedReport.otherReportsOnPost.map((r) => (
                      <div key={r.id} className="text-xs text-donor-muted flex justify-between">
                        <span>{r.reason}</span>
                        <span>{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedReport.status === 'PENDING' || selectedReport.status === 'REVIEWED' ? (
                <div>
                  <label className="text-sm text-donor-muted mb-1 block">Resolution note (optional)</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={2}
                    className="w-full bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
                  />
                </div>
              ) : (
                <div className="border-t border-donor-border/40 pt-4">
                  <p className="text-sm text-donor-muted">Resolution</p>
                  <p className="text-sm text-donor-text">{selectedReport.resolution || '-'}</p>
                </div>
              )}
            </div>
            {(selectedReport.status === 'PENDING' || selectedReport.status === 'REVIEWED') && (
              <div className="px-6 py-4 border-t border-donor-border/40 flex gap-2">
                <button
                  onClick={() => handleResolve('DISMISS')}
                  disabled={actionLoading}
                  className="flex-1 bg-donor-muted text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-donor-muted/85 disabled:opacity-50"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleResolve('HIDE')}
                  disabled={actionLoading}
                  className="flex-1 bg-donor-warning text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-donor-warning/85 disabled:opacity-50"
                >
                  Hide Post
                </button>
                <button
                  onClick={() => handleResolve('REMOVE')}
                  disabled={actionLoading}
                  className="flex-1 bg-donor-primary text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-donor-primary/85 disabled:opacity-50"
                >
                  Remove Post
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

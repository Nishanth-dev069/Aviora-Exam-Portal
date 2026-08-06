'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, Search, RefreshCw, Filter, Calendar, 
  ChevronLeft, ChevronRight, Info, X, Clock, User, Globe
} from 'lucide-react';

interface AuditLog {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [actionCategory, setActionCategory] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Selected Log for Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '30');

      if (search.trim()) params.set('search', search.trim());
      if (dateRange !== 'all') params.set('date_range', dateRange);

      if (actionCategory === 'student_logins') {
        params.set('action', 'student.login*');
      } else if (actionCategory === 'security_events') {
        params.set('action', '*blocked*');
      } else if (actionCategory === 'admin_actions') {
        params.set('action', 'admin.*');
      } else if (actionCategory === 'super_admin_actions') {
        params.set('action', 'super_admin.*');
      }

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to fetch audit logs');
      }

      setLogs(data.logs || []);
      setTotalPages(data.pagination?.total_pages || 1);
      setTotalLogs(data.pagination?.total || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionCategory, dateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatActionName = (action: string) => {
    return action
      .replace(/^(admin|student|super_admin)\./, '')
      .replace(/_/g, ' ')
      .toUpperCase();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('blocked') || action.includes('deleted') || action.includes('terminated')) {
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    if (action.includes('created') || action.includes('registered')) {
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
    if (action.includes('reset') || action.includes('updated') || action.includes('changed')) {
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
    return 'bg-primary/10 text-primary border-primary/20';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            System Audit Logs
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Complete security and administrative activity log across the platform ({totalLogs} total entries)
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50 text-sm font-medium shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-surface border border-border space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by action, resource type..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>

        {/* Action Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted shrink-0" />
          <select
            value={actionCategory}
            onChange={(e) => { setActionCategory(e.target.value); setPage(1); }}
            className="bg-background border border-border rounded-lg text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-primary"
          >
            <option value="all">All Categories</option>
            <option value="student_logins">Student Logins</option>
            <option value="security_events">Security Events / Blocks</option>
            <option value="admin_actions">Admin Actions</option>
            <option value="super_admin_actions">Super Admin Actions</option>
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-text-muted shrink-0" />
          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
            className="bg-background border border-border rounded-lg text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-primary"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-text-secondary text-xs uppercase tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor / Email</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Loading audit trail logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No audit log records match your filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-text-muted text-xs font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-text-primary text-xs truncate max-w-[200px]">
                        {log.actor_email}
                      </div>
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">
                        {log.actor_role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getActionBadgeColor(log.action)}`}>
                        {formatActionName(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary">
                      <span className="font-mono bg-surface-2 px-1.5 py-0.5 rounded text-text-primary">
                        {log.resource_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-muted font-mono">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-2 hover:bg-border text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
                      >
                        <Info className="w-3.5 h-3.5" />
                        Payload
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <div>
            Page {page} of {totalPages} ({totalLogs} entries)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded bg-surface-2 hover:bg-border disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded bg-surface-2 hover:bg-border disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-border pb-3">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg text-text-primary">Audit Event Payload</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-text-muted flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Event Time</span>
                <p className="font-mono text-text-primary">{new Date(selectedLog.created_at).toISOString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-text-muted flex items-center gap-1"><User className="w-3.5 h-3.5" /> Actor</span>
                <p className="font-medium text-text-primary">{selectedLog.actor_email} ({selectedLog.actor_role})</p>
              </div>
              <div className="space-y-1">
                <span className="text-text-muted flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> IP Address</span>
                <p className="font-mono text-text-primary">{selectedLog.ip_address || '127.0.0.1'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-text-muted">Action String</span>
                <p className="font-mono text-primary font-bold">{selectedLog.action}</p>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">JSON Metadata Payload</span>
              <pre className="p-3 rounded-lg bg-surface-2 text-text-primary text-xs font-mono overflow-x-auto max-h-60 border border-border">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-border text-text-primary text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

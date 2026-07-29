/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Search, MoreHorizontal, ShieldAlert, CheckCircle2, XCircle, Loader2, ChevronUp, ChevronDown, ChevronsUpDown, Shield, BarChart2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseISO } from 'date-fns';
import { SessionActionsMenu } from './monitoring/SessionActionsMenu';

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

interface StudentSession {
  full_name: string;
  roll_number: string;
  student_id?: string;
  session_id: string | null;
  status: string | null;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  last_synced_at: string | null;
  security_violations: number | null;
  enrolled_id: string;
}

type SortField = 'full_name' | 'roll_number' | 'status' | 'security_violations' | 'started_at' | 'submitted_at' | 'last_synced_at';

function ViolationsCell({ count, maxAllowed = 3 }: { count: number; maxAllowed?: number }) {
  const isWarning = count > 0 && count < maxAllowed;
  const isDanger = count >= maxAllowed;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border",
      isDanger ? "bg-red-100 text-red-700 border-red-300"
        : isWarning ? "bg-amber-100 text-amber-700 border-amber-300"
        : "bg-surface-2 text-text-secondary border-border"
    )}>
      {isDanger && <span>⚠</span>}
      {count}
    </span>
  );
}

export default function ExamStatusBoard({ activeExams }: { activeExams: { id: string, title: string }[] }) {
  const [examList, setExamList] = useState(activeExams);
  const [selectedExamId, setSelectedExamId] = useState<string>(activeExams[0]?.id || '');
  const [data, setData] = useState<StudentSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Always fetch fresh exams on mount to prevent Next.js App Router stale caching
  useEffect(() => {
    let cancelled = false;
    const fetchExams = async () => {
      try {
        const res = await fetch('/api/admin/exams', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const freshExams = json.data || json.exams || [];
        if (!cancelled && freshExams.length > 0) {
          setExamList(freshExams);
          if (!selectedExamId) {
            setSelectedExamId(freshExams[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to fetch fresh exams for live monitoring', e);
      }
    };
    fetchExams();
    return () => { cancelled = true; };
  }, []);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  // Refresh & Countdown state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Action / Confirmation Modal State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [terminateModalSession, setTerminateModalSession] = useState<{ sessionId: string, studentName: string, lastSyncedText: string } | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);
  const [forceSubmitTarget, setForceSubmitTarget] = useState<{ id: string, name: string } | null>(null);
  const [isSubmittingForce, setIsSubmittingForce] = useState(false);
  
  // Security Events Modal State
  const [securityEventsModal, setSecurityEventsModal] = useState<{ sessionId: string, studentName: string } | null>(null);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const fetchMonitoringData = useCallback(async (isAutoRefresh = false) => {
    if (!selectedExamId) return;
    if (isAutoRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch(`/api/admin/monitoring?examId=${selectedExamId}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setData(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setCountdown(30);
    }
  }, [selectedExamId]);

  useEffect(() => {
    if (!selectedExamId && examList.length > 0) {
      setSelectedExamId(examList[0].id);
    }
  }, [examList, selectedExamId]);

  // Initial fetch and on exam change
  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  // 1-second countdown ticker
  useInterval(() => {
    setCountdown((prev) => {
      if (prev <= 1) {
        fetchMonitoringData(true);
        return 30;
      }
      return prev - 1;
    });
  }, 1000);

  // Close open dropdown when clicking outside
  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const confirmTerminate = async () => {
    if (!terminateModalSession || !selectedExamId) return;
    setIsTerminating(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/exam/${selectedExamId}/terminate/${terminateModalSession.sessionId}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({ type: 'success', text: `Successfully terminated ${terminateModalSession.studentName}'s exam.` });
        fetchMonitoringData();
      } else {
        setActionMessage({ type: 'error', text: json.error?.message || json.error || 'Failed to terminate exam session.' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error. Could not terminate session.' });
    } finally {
      setIsTerminating(false);
      setTerminateModalSession(null);
    }
  };

  const handleForceSubmitConfirm = async () => {
    if (!forceSubmitTarget) return;
    setIsSubmittingForce(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/sessions/${forceSubmitTarget.id}/force-submit`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({ type: 'success', text: `Successfully force-submitted session for ${forceSubmitTarget.name}.` });
        fetchMonitoringData();
      } else {
        setActionMessage({ type: 'error', text: json.error?.message || json.error || 'Failed to force submit session.' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error. Could not force submit session.' });
    } finally {
      setIsSubmittingForce(false);
      setForceSubmitTarget(null);
    }
  };

  const handleSendWarning = async (sessionId: string) => {
    setActionMessage({ type: 'success', text: 'Warning logged for session.' });
  };

  const openSecurityEvents = async (sessionId: string, studentName: string) => {
    setSecurityEventsModal({ sessionId, studentName });
    setIsLoadingEvents(true);
    setSecurityEvents([]);
    try {
      const res = await fetch(`/api/admin/exam/sessions/${sessionId}/security-events`);
      const json = await res.json();
      if (json.success && json.events) {
        setSecurityEvents(json.events);
      }
    } catch (err) {
      console.error('Failed to load security events', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const getStudentStatus = (row: StudentSession) => {
    if (!row.session_id && !row.status) {
      return { type: 'not_started', label: 'Not Started', color: 'text-text-muted', bg: 'bg-surface-2 border-border', icon: Clock };
    }
    if (row.status === 'submitted') {
      return { type: 'submitted', label: 'Submitted', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 };
    }
    if (row.status === 'terminated') {
      return { type: 'terminated', label: 'Terminated', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle };
    }
    if (row.status === 'expired') {
      return { type: 'expired', label: 'Expired', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Clock };
    }

    if (row.last_synced_at) {
      const lastSynced = parseISO(row.last_synced_at).getTime();
      const now = Date.now();
      const minutesSinceSync = (now - lastSynced) / 60000;
      if (minutesSinceSync > 5) {
        return { type: 'disconnected', label: 'Disconnected', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: ShieldAlert };
      }
    }
    return { type: 'in_progress', label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: RefreshCw };
  };

  const getSyncText = (lastSynced: string | null, status: string | null) => {
    if (status === 'submitted') return 'Submitted';
    if (status === 'terminated') return 'Terminated';
    if (!lastSynced) return '—';
    const mins = Math.floor((Date.now() - parseISO(lastSynced).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    return `${mins}m ago`;
  };

  const filteredData = data.filter(d => 
    d.full_name.toLowerCase().includes(search.toLowerCase()) || 
    d.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  const sortedStudents = [...filteredData].sort((a, b) => {
    let aVal: any = a[sortField] ?? '';
    let bVal: any = b[sortField] ?? '';

    if (sortField === 'status') {
      aVal = getStudentStatus(a).label;
      bVal = getStudentStatus(b).label;
    }

    if (aVal === '' || aVal === null) return 1;
    if (bVal === '' || bVal === null) return -1;

    if (sortField === 'security_violations') {
      return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    }

    if (['started_at', 'submitted_at', 'last_synced_at'].includes(sortField)) {
      return sortDir === 'asc' 
        ? new Date(aVal).getTime() - new Date(bVal).getTime()
        : new Date(bVal).getTime() - new Date(aVal).getTime();
    }

    const cmp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const stats = {
    total: data.length,
    inProgress: data.filter(d => getStudentStatus(d).type === 'in_progress').length,
    submitted: data.filter(d => getStudentStatus(d).type === 'submitted').length,
    notStarted: data.filter(d => getStudentStatus(d).type === 'not_started').length,
    disconnected: data.filter(d => getStudentStatus(d).type === 'disconnected').length,
  };

  if (examList.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-muted font-medium">
        No active exams currently available for monitoring.
      </div>
    );
  }

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-6 py-4 font-bold cursor-pointer select-none hover:bg-surface-3 transition-colors"
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field ? (
          sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-text-muted" />
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      
      {actionMessage && (
        <div className={cn("p-4 rounded-xl border text-sm font-bold flex items-center gap-2", actionMessage.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700")}>
          {actionMessage.text}
        </div>
      )}

      {/* Top Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <label className="font-bold text-text-secondary text-sm whitespace-nowrap">Active Exam:</label>
          <select 
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full md:w-72 px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-semibold"
          >
            {examList.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.title} {(ex as any).status ? `(${(ex as any).status})` : ''}</option>
            ))}
          </select>
        </div>

        {/* Live Refresh Status Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted bg-background px-3 py-1.5 rounded-lg border border-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Auto-refresh in <span className="font-bold text-text-primary w-4">{countdown}s</span>
          </div>

          <button 
            onClick={() => fetchMonitoringData(false)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 hover:bg-border rounded-lg border border-border text-text-primary font-bold text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", (isLoading || isRefreshing) && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-xs font-bold text-text-muted uppercase">Total Enrolled</div>
          <div className="text-2xl font-black text-text-primary mt-1">{stats.total}</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-xs font-bold text-blue-600 uppercase">In Progress</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{stats.inProgress}</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-xs font-bold text-emerald-600 uppercase">Submitted</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.submitted}</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-xs font-bold text-amber-600 uppercase font-bold">Disconnected</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.disconnected}</div>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="text-xs font-bold text-text-muted uppercase">Not Started</div>
          <div className="text-2xl font-black text-text-muted mt-1">{stats.notStarted}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex justify-between items-center bg-surface p-4 rounded-t-xl border border-border">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search student or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs font-semibold"
          />
        </div>
      </div>

      {/* Main Monitoring Table */}
      <div className="bg-surface border-x border-b border-border rounded-b-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-secondary">
                <SortableHeader field="full_name" label="Student" />
                <SortableHeader field="roll_number" label="Roll No" />
                <SortableHeader field="status" label="Status" />
                <SortableHeader field="security_violations" label="Violations" />
                <SortableHeader field="started_at" label="Started" />
                <SortableHeader field="submitted_at" label="Submitted" />
                <SortableHeader field="last_synced_at" label="Last Sync" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading live session monitoring...
                  </td>
                </tr>
              ) : sortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted font-medium">
                    No student sessions match your query.
                  </td>
                </tr>
              ) : (
                sortedStudents.map(row => {
                  const s = getStudentStatus(row);
                  const Icon = s.icon;
                  const rowKey = row.session_id || row.enrolled_id || row.student_id || row.full_name;

                  return (
                    <tr key={rowKey} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-text-primary">{row.full_name}</td>
                      <td className="px-6 py-4 text-text-secondary font-medium">{row.roll_number}</td>
                      <td className="px-6 py-4">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border", s.bg, s.color)}>
                          <Icon className={cn("w-3.5 h-3.5", s.type === 'in_progress' ? "animate-spin" : "")} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {row.security_violations !== null ? (
                          <ViolationsCell count={row.security_violations || 0} maxAllowed={3} />
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-text-secondary font-medium">
                        {row.started_at ? new Date(row.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-text-secondary font-medium">
                        {row.submitted_at ? new Date(row.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-text-secondary font-medium">
                        {getSyncText(row.last_synced_at, row.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminate Exam Confirmation Modal */}
      {terminateModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-surface border border-border shadow-2xl rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <XCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-text-primary">Terminate Exam</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Are you sure you want to terminate <span className="font-bold text-text-primary">{terminateModalSession.studentName}</span>&apos;s exam?
            </p>
            <p className="text-xs text-text-muted bg-surface-2 p-3 rounded-lg border border-border mb-6">
              Their answers up to their last sync ({terminateModalSession.lastSyncedText}) will be evaluated automatically. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setTerminateModalSession(null)}
                disabled={isTerminating}
                className="px-4 py-2 text-text-secondary hover:text-text-primary font-medium text-sm"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={confirmTerminate}
                disabled={isTerminating}
                className="px-5 py-2 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isTerminating && <Loader2 className="w-4 h-4 animate-spin" />}
                Terminate Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Events Timeline Modal */}
      {securityEventsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-surface border border-border shadow-2xl rounded-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-text-primary">
                  Security Events — {securityEventsModal.studentName}
                </h3>
              </div>
              <button 
                onClick={() => setSecurityEventsModal(null)}
                className="text-text-muted hover:text-text-primary text-xs font-bold px-2 py-1 bg-surface-2 rounded-md"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoadingEvents ? (
                <div className="py-12 text-center text-text-muted text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading security events timeline...
                </div>
              ) : securityEvents.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs italic">
                  No security violation events logged for this session.
                </div>
              ) : (
                securityEvents.map((ev, i) => (
                  <div key={ev.id || i} className="p-3 bg-surface-2/60 border border-border rounded-xl flex items-start justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md uppercase text-[10px]">
                        {ev.event_type}
                      </span>
                      {ev.event_data?.reason && (
                        <p className="text-text-secondary mt-1 font-medium">{String(ev.event_data.reason)}</p>
                      )}
                      {ev.duration_seconds && (
                        <p className="text-text-muted mt-0.5 font-medium">Duration: {ev.duration_seconds}s</p>
                      )}
                    </div>
                    <span className="text-text-muted whitespace-nowrap text-[11px] font-mono">
                      {new Date(ev.occurred_at || ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Force Submit Confirmation Modal */}
      {forceSubmitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-surface border border-border shadow-2xl rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-text-primary">Force Submit Exam</h3>
            </div>
            
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to force submit the exam session for <strong className="text-text-primary">{forceSubmitTarget.name}</strong>? This action will immediately compute their final score and lock the session.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setForceSubmitTarget(null)}
                disabled={isSubmittingForce}
                className="px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-2 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleForceSubmitConfirm}
                disabled={isSubmittingForce}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                {isSubmittingForce ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Confirm Force Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

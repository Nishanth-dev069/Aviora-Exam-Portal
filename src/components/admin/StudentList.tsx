'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, MoreHorizontal, UserPlus, ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CreateStudentModal from './CreateStudentModal';
import EditStudentModal from './EditStudentModal';
import ResetPasswordModal from './ResetPasswordModal';
import { StudentActionsMenu } from './students/StudentActionsMenu';

export type StudentType = { user_id: string, full_name: string, roll_number: string, batch_id?: string, phone?: string, batches?: { name: string }, users?: { status: string, last_login?: string, last_active_at?: string }, last_active_at?: string };

function ActiveDot({ lastActiveAt }: { lastActiveAt: string | null }) {
  if (!lastActiveAt) return <span className="inline-block h-2 w-2 rounded-full bg-gray-300 shrink-0" />;
  const diffMins = (Date.now() - new Date(lastActiveAt).getTime()) / 60000;
  if (diffMins < 30) return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />;
  if (diffMins < 1440) return <span className="inline-block h-2 w-2 rounded-full bg-amber-400 shrink-0" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-gray-300 shrink-0" />;
}

function formatLastActive(lastActiveAt: string | null): string {
  if (!lastActiveAt) return 'Never';
  
  const now = new Date();
  const then = new Date(lastActiveAt);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function StudentList() {
  const [students, setStudents] = useState<StudentType[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [batches, setBatches] = useState<{id: string, name: string}[]>([]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentType | null>(null);
  const [resettingStudent, setResettingStudent] = useState<StudentType | null>(null);
  
  // Action Menu Dropdown state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search,
        batch: batchFilter,
        status: statusFilter
      });
      const res = await fetch(`/api/admin/students?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to load students.');
        return;
      }
      const list = data.students ?? data.data ?? [];
      setStudents(list);
      setTotalCount(data.count ?? list.length);
    } catch (err) {
      console.error('Failed to fetch students', err);
      setError('Network error. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, batchFilter, statusFilter]);

  const handleCreateSuccess = useCallback(() => {
    setPage(1);
    setSearch('');
    setBatchFilter('all');
    setStatusFilter('all');
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetch('/api/admin/batches?pageSize=100')
      .then(res => res.json())
      .then(data => { if (data.data) setBatches(data.data); })
      .catch(console.error);
  }, []);

  const handleToggleStatus = async (student: StudentType) => {
    const newStatus = student.users?.status === 'active' ? 'suspended' : 'active';
    try {
      await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', student_id: student.user_id, status: newStatus })
      });
      fetchStudents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStudent = async (student: StudentType) => {
    if (!window.confirm(`Are you sure you want to delete ${student.full_name}?`)) return;
    try {
      const res = await fetch('/api/admin/students', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.user_id })
      });
      if (res.ok) {
        fetchStudents();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete student.');
      }
    } catch (err) {
      console.error('Failed to delete student', err);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Students</h1>
          <p className="text-text-secondary mt-1">Manage student accounts and access.</p>
        </div>
        <button 
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primary-hover transition-colors shadow-sm"
        >
          <UserPlus className="w-5 h-5" /> Add Student
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="font-medium text-red-700">Failed to load students</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button onClick={fetchStudents} className="mt-3 rounded bg-red-600 px-4 py-1.5 text-white text-xs font-semibold hover:bg-red-700">
            Try Again
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-surface border border-border p-4 rounded-t-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        
        <div className="relative w-full md:w-96 flex-shrink-0">
          <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search by name or roll number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 flex-shrink-0">
            <Filter className="w-4 h-4 text-text-muted" />
            <select 
              value={batchFilter} 
              onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-sm font-medium text-text-secondary focus:outline-none"
            >
              <option value="all">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 flex-shrink-0">
            <Filter className="w-4 h-4 text-text-muted" />
            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-sm font-medium text-text-secondary focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border-x border-b border-border rounded-b-xl overflow-hidden shadow-sm flex-1 flex flex-col relative">
        {isLoading && (
          <div className="absolute inset-0 bg-surface/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-secondary">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Roll No</th>
                <th className="px-6 py-4 font-semibold">Batch</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Last Active</th>
                <th className="px-6 py-4 font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((student) => {
                const isActive = student.users?.status === 'active';
                const lastActiveTime = (student as any).last_active_at || (student.users as any)?.last_active_at || student.users?.last_login || null;
                
                return (
                  <tr key={student.user_id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-text-primary">
                      {student.full_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary font-medium">
                      {student.roll_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {student.batches?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold',
                        isActive ? 'bg-success/10 text-success' : 'bg-text-muted/10 text-text-muted'
                      )}>
                        {isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ActiveDot lastActiveAt={lastActiveTime} />
                        <span>{formatLastActive(lastActiveTime)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <StudentActionsMenu
                        student={{
                          id: student.user_id,
                          status: student.users?.status || 'active',
                          full_name: student.full_name,
                        }}
                        onEdit={() => setEditingStudent(student)}
                        onResetPassword={() => setResettingStudent(student)}
                        onToggleStatus={() => handleToggleStatus(student)}
                        onDelete={() => handleDeleteStudent(student)}
                      />
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                    No students found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="mt-auto border-t border-border px-6 py-4 flex items-center justify-between bg-surface">
          <div className="text-sm font-medium text-text-secondary">
            Showing <span className="text-text-primary font-bold">{Math.min((page - 1) * pageSize + 1, totalCount)}</span> to <span className="text-text-primary font-bold">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-text-primary font-bold">{totalCount}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              className="p-2 border border-border rounded-lg bg-background text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-text-primary px-2">{page} / {totalPages || 1}</div>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(prev => prev + 1)}
              className="p-2 border border-border rounded-lg bg-background text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      <CreateStudentModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        onSuccess={handleCreateSuccess} 
      />
      <EditStudentModal 
        isOpen={!!editingStudent} 
        student={editingStudent} 
        onClose={() => setEditingStudent(null)} 
        onSuccess={fetchStudents} 
      />
      <ResetPasswordModal 
        isOpen={!!resettingStudent} 
        student={resettingStudent} 
        onClose={() => setResettingStudent(null)} 
        onSuccess={fetchStudents} 
      />

    </div>
  );
}

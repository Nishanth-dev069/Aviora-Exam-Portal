'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Archive, ChevronLeft, ChevronRight, Loader2, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export type ExamType = { 
  id: string; 
  title: string; 
  type: string;
  subject: string; 
  duration_minutes: number;
  total_questions: number;
  status: string;
  scheduled_at?: string;
  question_banks?: { name: string };
  created_at: string;
};

export default function ExamList() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamType[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState('');

  const fetchExams = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString(), search });
      const res = await fetch(`/api/admin/exams?${params}`);
      const data = await res.json();
      if (data.data) {
        setExams(data.data);
        setTotalCount(data.count);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active': return <Badge variant="success">Active</Badge>;
      case 'scheduled': return <Badge variant="primary">Scheduled</Badge>;
      case 'completed': return <Badge variant="default">Completed</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Exams Management
          </h1>
          <p className="text-text-secondary mt-1">Manage and create new practice or scheduled exams.</p>
        </div>
        <button 
          onClick={() => router.push('/admin/exams/new')}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primary-hover transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" /> Create Exam
        </button>
      </div>

      <div className="bg-surface border border-border p-4 rounded-t-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search exams by title..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="bg-surface border-x border-b border-border rounded-b-xl overflow-hidden shadow-sm flex-1 flex flex-col relative">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-secondary">
                <th className="px-6 py-4 font-semibold">Title</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Subject</th>
                <th className="px-6 py-4 font-semibold">Details</th>
                <th className="px-6 py-4 font-semibold">Scheduled</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-48 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-28 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-32 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-36 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-6 rounded" /></td>
                  </tr>
                ))
              ) : (
                exams.map((exam) => (
                  <tr 
                    key={exam.id} 
                    onClick={() => router.push(`/admin/exams/${exam.id}`)}
                    className="hover:bg-surface-2/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                        {exam.title}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium capitalize text-text-secondary">
                      {exam.type}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary font-medium">
                      {exam.subject}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {exam.total_questions} Qs | {exam.duration_minutes}m
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {exam.scheduled_at ? new Date(exam.scheduled_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getStatusBadge(exam.status)}
                    </td>
                    <td className="px-6 py-4 relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Are you sure you want to archive "${exam.title}"?`)) return;
                          await fetch(`/api/admin/exams/${exam.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'archive' })
                          });
                          fetchExams();
                        }}
                        title="Archive Exam"
                        className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {exams.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                    No exams found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="mt-auto border-t border-border px-6 py-4 flex items-center justify-between bg-surface">
          <div className="text-sm font-medium text-text-secondary">
            Showing <span className="text-text-primary font-bold">{Math.min((page - 1) * pageSize + (totalCount > 0 ? 1 : 0), totalCount)}</span> to <span className="text-text-primary font-bold">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-text-primary font-bold">{totalCount}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              className="p-2 border border-border rounded-lg bg-background text-text-secondary hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(prev => Math.max(1, Math.min(totalPages, prev + 1)))}
              className="p-2 border border-border rounded-lg bg-background text-text-secondary hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

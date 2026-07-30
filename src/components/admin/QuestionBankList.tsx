'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Archive, ChevronLeft, ChevronRight, X, Loader2, Folder, Edit } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';

const createBankSchema = z.object({
  name: z.string().min(1, 'Bank name is required'),
  subject: z.string().min(1, 'Subject is required'),
});
type BankFormData = z.infer<typeof createBankSchema>;

function CreateBankModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<BankFormData>({
    resolver: zodResolver(createBankSchema)
  });

  useEffect(() => { if (isOpen) { reset(); setServerError(null); } }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: BankFormData) => {
    setServerError(null);
    try {
      const res = await fetch('/api/admin/question-banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const result = await res.json();
        setServerError(result.error || 'Failed to create question bank');
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setServerError('An unexpected error occurred');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="bg-surface border border-border shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">New Question Bank</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {serverError && <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm font-medium">{serverError}</div>}
          
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Bank Name *</label>
            <input 
              {...register('name')}
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.name ? "border-danger" : "border-border")}
              placeholder="e.g. Air Law Bank"
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Subject *</label>
            <input 
              {...register('subject')}
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.subject ? "border-danger" : "border-border")}
              placeholder="e.g. Air Law"
            />
            {errors.subject && <p className="text-xs text-danger mt-1">{errors.subject.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-text-secondary hover:text-text-primary font-medium">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Create Bank
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export type QuestionBankType = { id: string, name: string, subject: string, question_count: number, created_at: string };

function EditBankModal({ bank, isOpen, onClose, onSuccess }: { bank: QuestionBankType | null, isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<BankFormData>({
    resolver: zodResolver(createBankSchema)
  });

  useEffect(() => { 
    if (isOpen && bank) { 
      reset({ name: bank.name, subject: bank.subject }); 
      setServerError(null); 
    } 
  }, [isOpen, bank, reset]);

  if (!isOpen || !bank) return null;

  const onSubmit = async (data: BankFormData) => {
    setServerError(null);
    try {
      const res = await fetch('/api/admin/question-banks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bank.id, ...data })
      });
      if (!res.ok) {
        const result = await res.json();
        setServerError(result.error || 'Failed to update question bank');
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setServerError('An unexpected error occurred');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="bg-surface border border-border shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">Edit Question Bank</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {serverError && <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm font-medium">{serverError}</div>}
          
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Bank Name *</label>
            <input 
              {...register('name')}
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.name ? "border-danger" : "border-border")}
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Subject *</label>
            <input 
              {...register('subject')}
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.subject ? "border-danger" : "border-border")}
            />
            {errors.subject && <p className="text-xs text-danger mt-1">{errors.subject.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-text-secondary hover:text-text-primary font-medium">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QuestionBankList() {
  const router = useRouter();
  const [banks, setBanks] = useState<QuestionBankType[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [bankToEdit, setBankToEdit] = useState<QuestionBankType | null>(null);

  const fetchBanks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString(), search });
      const res = await fetch(`/api/admin/question-banks?${params}`);
      const data = await res.json();
      if (data.data) {
        setBanks(data.data);
        setTotalCount(data.count);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchBanks(); }, [fetchBanks]);

  const handleArchive = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to archive "${name}"? This will hide it from future exam creation.`)) return;
    try {
      await fetch(`/api/admin/question-banks?id=${id}`, { method: 'DELETE' });
      fetchBanks();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Folder className="w-6 h-6 text-primary" />
            Question Banks
          </h1>
          <p className="text-text-secondary mt-1">Manage content repositories for exams.</p>
        </div>
        <button 
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primary-hover transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" /> New Question Bank
        </button>
      </div>

      <div className="bg-surface border border-border p-4 rounded-t-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search banks or subjects..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="bg-surface border-x border-b border-border rounded-b-xl overflow-hidden shadow-sm flex-1 flex flex-col relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-secondary">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Subject</th>
                <th className="px-6 py-4 font-semibold">Questions</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-44 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-28 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-6 rounded" /></td>
                  </tr>
                ))
              ) : (
                banks.map((bank) => (
                <tr 
                  key={bank.id} 
                  onClick={() => router.push(`/admin/question-banks/${bank.id}/questions`)}
                  className="hover:bg-surface-2/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                      {bank.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary font-medium">
                    {bank.subject}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {bank.question_count}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-success/10 text-success">
                      ● Active
                    </span>
                  </td>
                  <td className="px-6 py-4 relative flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setBankToEdit(bank); }}
                      title="Edit Bank"
                      className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleArchive(e, bank.id, bank.name)}
                      title="Archive Bank"
                      className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
              {banks.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    No question banks found.
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
              className="p-2 border border-border rounded-lg bg-background text-text-secondary hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(prev => prev + 1)}
              className="p-2 border border-border rounded-lg bg-background text-text-secondary hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <CreateBankModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={fetchBanks} />
      <EditBankModal isOpen={!!bankToEdit} bank={bankToEdit} onClose={() => setBankToEdit(null)} onSuccess={() => { setBankToEdit(null); fetchBanks(); }} />
    </div>
  );
}

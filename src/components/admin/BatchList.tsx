'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Archive, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';

// --- CREATE BATCH MODAL ---
const createBatchSchema = z.object({
  name: z.string().min(1, 'Batch name is required'),
  description: z.string().optional(),
});
type BatchFormData = z.infer<typeof createBatchSchema>;

function CreateBatchModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<BatchFormData>({
    resolver: zodResolver(createBatchSchema)
  });

  useEffect(() => { if (isOpen) { reset(); setServerError(null); } }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: BatchFormData) => {
    setServerError(null);
    try {
      const res = await fetch('/api/admin/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const result = await res.json();
        setServerError(result.error || 'Failed to create batch');
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
          <h2 className="text-xl font-bold text-text-primary">Create Batch</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {serverError && <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm font-medium">{serverError}</div>}
          
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Batch Name *</label>
            <input 
              {...register('name')}
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.name ? "border-danger" : "border-border")}
              placeholder="e.g. Batch 2024"
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Description</label>
            <textarea 
              {...register('description')}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px]"
              placeholder="Optional description..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-text-secondary hover:text-text-primary font-medium">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Create Batch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MAIN LIST COMPONENT ---
export default function BatchList() {
  const router = useRouter();
  const [batches, setBatches] = useState<{id: string, name: string, description: string, student_count: number}[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [search, setSearch] = useState('');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString(), search });
      const res = await fetch(`/api/admin/batches?${params}`);
      const data = await res.json();
      if (data.data) {
        setBatches(data.data);
        setTotalCount(data.count);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to archive "${name}"? Students in this batch will lose their batch assignment.`)) return;
    try {
      await fetch(`/api/admin/batches?id=${id}`, { method: 'DELETE' });
      fetchBatches();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Batches</h1>
          <p className="text-text-secondary mt-1">Manage student cohorts and groups.</p>
        </div>
        <button 
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primary-hover transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" /> Create Batch
        </button>
      </div>

      <div className="bg-surface border border-border p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search batches..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {isLoading && batches.length > 0 && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        
        {isLoading && batches.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-surface p-6 space-y-4 animate-pulse shadow-sm">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-6 w-36 rounded-md" />
                  <Skeleton className="h-6 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
                <div className="pt-4 flex justify-between items-center border-t border-border">
                  <Skeleton className="h-4 w-20 rounded-md" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
            {batches.map(batch => (
              <div 
                key={batch.id} 
                onClick={() => router.push(`/admin/batches/${batch.id}`)}
                className="bg-surface border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all group flex flex-col cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors">{batch.name}</h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleArchive(batch.id, batch.name); }}
                    title="Archive Batch"
                    className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-text-secondary line-clamp-2 mb-6 flex-1">
                  {batch.description || 'No description provided.'}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">Students</span>
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">{batch.student_count}</span>
                </div>
              </div>
            ))}
            {batches.length === 0 && !isLoading && (
              <div className="col-span-full py-12 text-center text-text-muted">
                No batches found.
              </div>
            )}
          </div>
        )}
      </div>

      {totalCount > 0 && (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-medium text-text-secondary">
            Page <span className="text-text-primary font-bold">{page}</span> of <span className="text-text-primary font-bold">{totalPages || 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-2 disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-2 disabled:opacity-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <CreateBatchModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={fetchBatches} />
    </div>
  );
}

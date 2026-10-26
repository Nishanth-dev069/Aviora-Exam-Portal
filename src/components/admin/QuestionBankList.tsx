'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Archive, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Loader2, 
  Edit, 
  Globe, 
  Lock, 
  ArrowLeft, 
  BookOpen 
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';

const STANDARD_SUBJECT_METADATA: Record<string, { icon: string; description: string }> = {
  'Air Law': { icon: '✈️', description: 'Rules of the air, ATC regulations, and aviation conventions.' },
  'Meteorology': { icon: '🌤️', description: 'Weather systems, forecasts, meteorological reports, and altimetry.' },
  'Navigation': { icon: '🧭', description: 'Dead reckoning, charts, flight navigation, and calculations.' },
  'General Navigation': { icon: '🗺️', description: 'Grid navigation, coordinate systems, and maps.' },
  'Radio Navigation': { icon: '📡', description: 'VOR, DME, ILS, radar, and GNSS systems.' },
  'Principles of Flight': { icon: '🛫', description: 'Aerodynamics, lift, drag, flight stability, and control.' },
  'Flight Planning': { icon: '📋', description: 'Fuel calculations, route planning, and flight monitoring.' },
  'Aircraft General Knowledge': { icon: '🛠️', description: 'Airframe, systems, powerplants, and instrumentation.' },
  'Human Performance': { icon: '🧬', description: 'Aviation physiology, psychology, and crew resource management.' },
  'Mass and Balance': { icon: '⚖️', description: 'CG limits, loading calculations, and weight distributions.' },
  'Operational Procedures': { icon: '📑', description: 'Special procedures, emergency ops, and safety protocols.' },
  'Communications': { icon: '📻', description: 'VFR and IFR radio communications, phraseology, and signals.' },
};

const bankFormSchema = z.object({
  name: z.string().min(1, 'Bank name is required'),
  subject: z.string().min(1, 'Subject is required'),
  is_public: z.boolean(),
  chapter: z.string().max(200).optional(),
  chapter_order: z.number().int().min(1, 'Chapter number must be 1 or greater').max(999).optional(),
}).superRefine((val, ctx) => {
  if (val.is_public) {
    if (!val.chapter || !val.chapter.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Chapter name is required for public question banks',
        path: ['chapter'],
      });
    }
    if (!val.chapter_order || val.chapter_order < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Chapter number must be 1 or greater',
        path: ['chapter_order'],
      });
    }
  }
});

type BankFormData = {
  name: string;
  subject: string;
  is_public: boolean;
  chapter?: string;
  chapter_order?: number;
};

export type QuestionBankType = { 
  id: string; 
  name: string; 
  subject: string; 
  chapter?: string | null; 
  chapter_order?: number; 
  question_count: number; 
  created_at: string; 
};

function CreateBankModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  defaultSubject,
  availableSubjects = [],
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: (createdSubject: string) => void; 
  defaultSubject?: string;
  availableSubjects?: string[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting }, reset } = useForm<BankFormData>({
    resolver: zodResolver(bankFormSchema),
    defaultValues: {
      name: '',
      subject: defaultSubject || '',
      is_public: false,
      chapter: '',
      chapter_order: 1,
    }
  });

  const isPublic = watch('is_public');

  useEffect(() => { 
    if (isOpen) { 
      reset({ 
        name: '', 
        subject: defaultSubject || '', 
        is_public: false, 
        chapter: '', 
        chapter_order: 1 
      }); 
      setServerError(null); 
    } 
  }, [isOpen, defaultSubject, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: BankFormData) => {
    setServerError(null);
    try {
      const payload = {
        name: data.name.trim(),
        subject: data.subject.trim(),
        chapter: data.is_public && data.chapter?.trim() ? data.chapter.trim() : null,
        chapter_order: data.is_public ? (Number(data.chapter_order) || 1) : 0,
      };
      const res = await fetch('/api/admin/question-banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const result = await res.json();
        setServerError(result.error || 'Failed to create question bank');
        return;
      }
      onSuccess(data.subject.trim());
      onClose();
    } catch {
      setServerError('An unexpected error occurred');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="bg-surface border border-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">New Question Bank</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {serverError && <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm font-medium">{serverError}</div>}
          
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Bank Name <span className="text-danger">*</span></label>
            <input 
              {...register('name')}
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.name ? "border-danger" : "border-border")}
              placeholder="e.g. Navigation Basics Bank"
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-bold text-text-secondary">
                Subject <span className="text-danger">*</span>
              </label>
              {defaultSubject && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                  Defaulted to active subject
                </span>
              )}
            </div>
            <input 
              {...register('subject')}
              readOnly={Boolean(defaultSubject)}
              list="subjects-datalist"
              className={cn(
                "w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50",
                defaultSubject ? "bg-surface-2 cursor-not-allowed opacity-90 border-border" : (errors.subject ? "border-danger" : "border-border")
              )}
              placeholder="e.g. Navigation"
            />
            {!defaultSubject && availableSubjects.length > 0 && (
              <datalist id="subjects-datalist">
                {availableSubjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
            {errors.subject && <p className="text-xs text-danger mt-1">{errors.subject.message}</p>}
          </div>

          {/* Public / Private Toggle */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-2 border border-border">
              <div className="space-y-0.5 pr-3">
                <div className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  {isPublic ? <Globe className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-text-muted" />}
                  <span>Public Question Bank</span>
                  <span className={cn(
                    "text-[10px] uppercase font-black px-1.5 py-0.5 rounded",
                    isPublic ? "bg-success/15 text-success border border-success/30" : "bg-text-muted/15 text-text-muted border border-border"
                  )}>
                    {isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isPublic
                    ? 'Publish to students in the Learn section.'
                    : 'Private (exam-only). Hidden from student practice.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setValue('is_public', !isPublic, { shouldValidate: true })}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isPublic ? "bg-primary" : "bg-surface-3 border-border"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                    isPublic ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Conditional Chapter Fields */}
          {isPublic && (
            <div className="space-y-4 p-4 rounded-xl bg-primary/[0.03] border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1">
                  Chapter Name <span className="text-danger">*</span>
                </label>
                <input 
                  {...register('chapter')}
                  className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.chapter ? "border-danger" : "border-border")}
                  placeholder="e.g. ICAO Standards & Annexes"
                />
                {errors.chapter && <p className="text-xs text-danger mt-1 font-medium">{errors.chapter.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1">
                  Chapter Number / Order <span className="text-danger">*</span>
                </label>
                <input 
                  type="number"
                  min={1}
                  step={1}
                  {...register('chapter_order', { valueAsNumber: true })}
                  className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.chapter_order ? "border-danger" : "border-border")}
                  placeholder="1"
                />
                <p className="text-xs text-text-muted mt-1">Controls the sequence order in student Learn list (1 = first chapter).</p>
                {errors.chapter_order && <p className="text-xs text-danger mt-1 font-medium">{errors.chapter_order.message}</p>}
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-border">
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

function EditBankModal({ 
  bank, 
  isOpen, 
  onClose, 
  onSuccess,
  availableSubjects = [],
}: { 
  bank: QuestionBankType | null; 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  availableSubjects?: string[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting }, reset } = useForm<BankFormData>({
    resolver: zodResolver(bankFormSchema)
  });

  const isPublic = watch('is_public');

  useEffect(() => { 
    if (isOpen && bank) { 
      const isBankPublic = Boolean(bank.chapter && bank.chapter.trim());
      reset({ 
        name: bank.name, 
        subject: bank.subject,
        is_public: isBankPublic,
        chapter: bank.chapter ?? '',
        chapter_order: bank.chapter_order && bank.chapter_order > 0 ? bank.chapter_order : 1,
      }); 
      setServerError(null); 
    } 
  }, [isOpen, bank, reset]);

  if (!isOpen || !bank) return null;

  const onSubmit = async (data: BankFormData) => {
    setServerError(null);
    try {
      const payload = {
        id: bank.id,
        name: data.name.trim(),
        subject: data.subject.trim(),
        chapter: data.is_public && data.chapter?.trim() ? data.chapter.trim() : null,
        chapter_order: data.is_public ? (Number(data.chapter_order) || 1) : 0,
      };
      const res = await fetch('/api/admin/question-banks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
      <div className="bg-surface border border-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">Edit Question Bank</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {serverError && <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm font-medium">{serverError}</div>}
          
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Bank Name <span className="text-danger">*</span></label>
            <input 
              {...register('name')}
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.name ? "border-danger" : "border-border")}
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Subject <span className="text-danger">*</span></label>
            <input 
              {...register('subject')}
              list="edit-subjects-datalist"
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.subject ? "border-danger" : "border-border")}
            />
            {availableSubjects.length > 0 && (
              <datalist id="edit-subjects-datalist">
                {availableSubjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
            {errors.subject && <p className="text-xs text-danger mt-1">{errors.subject.message}</p>}
          </div>

          {/* Public / Private Toggle */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-2 border border-border">
              <div className="space-y-0.5 pr-3">
                <div className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  {isPublic ? <Globe className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-text-muted" />}
                  <span>Public Question Bank</span>
                  <span className={cn(
                    "text-[10px] uppercase font-black px-1.5 py-0.5 rounded",
                    isPublic ? "bg-success/15 text-success border border-success/30" : "bg-text-muted/15 text-text-muted border border-border"
                  )}>
                    {isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isPublic
                    ? 'Publish to students in the Learn section.'
                    : 'Private (exam-only). Hidden from student practice.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setValue('is_public', !isPublic, { shouldValidate: true })}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isPublic ? "bg-primary" : "bg-surface-3 border-border"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                    isPublic ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Conditional Chapter Fields */}
          {isPublic && (
            <div className="space-y-4 p-4 rounded-xl bg-primary/[0.03] border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1">
                  Chapter Name <span className="text-danger">*</span>
                </label>
                <input 
                  {...register('chapter')}
                  className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.chapter ? "border-danger" : "border-border")}
                  placeholder="e.g. ICAO Standards & Annexes"
                />
                {errors.chapter && <p className="text-xs text-danger mt-1 font-medium">{errors.chapter.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1">
                  Chapter Number / Order <span className="text-danger">*</span>
                </label>
                <input 
                  type="number"
                  min={1}
                  step={1}
                  {...register('chapter_order', { valueAsNumber: true })}
                  className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.chapter_order ? "border-danger" : "border-border")}
                  placeholder="1"
                />
                <p className="text-xs text-text-muted mt-1">Controls the sequence order in student Learn list (1 = first chapter).</p>
                {errors.chapter_order && <p className="text-xs text-danger mt-1 font-medium">{errors.chapter_order.message}</p>}
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-border">
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
  const searchParams = useSearchParams();
  const subjectQuery = searchParams.get('subject');

  const [allBanks, setAllBanks] = useState<QuestionBankType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active subject drilldown
  const [selectedSubject, setSelectedSubject] = useState<string | null>(subjectQuery || null);

  // Search & Pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12; // Same as batches

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [bankToEdit, setBankToEdit] = useState<QuestionBankType | null>(null);

  // Keep selectedSubject in sync with URL
  useEffect(() => {
    setSelectedSubject(subjectQuery || null);
    setSearch('');
    setPage(1);
  }, [subjectQuery]);

  const fetchBanks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/question-banks?pageSize=1000');
      const data = await res.json();
      if (data.data) {
        setAllBanks(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

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

  // Compile Subjects Data
  const subjectsData = useMemo(() => {
    const map = new Map<string, {
      name: string;
      icon: string;
      description: string;
      bankCount: number;
      questionCount: number;
      publicCount: number;
      privateCount: number;
    }>();

    // Aggregate only from active question banks (no empty subject cards)
    for (const bank of allBanks) {
      const sName = (bank.subject || 'General').trim();
      const key = sName.toLowerCase();
      const isPublic = Boolean(bank.chapter && bank.chapter.trim());
      const existing = map.get(key);

      if (existing) {
        existing.bankCount += 1;
        existing.questionCount += (bank.question_count || 0);
        if (isPublic) existing.publicCount += 1;
        else existing.privateCount += 1;
      } else {
        const meta = STANDARD_SUBJECT_METADATA[sName] || {
          icon: '📚',
          description: `Question banks and content repository for ${sName}.`,
        };
        map.set(key, {
          name: sName,
          icon: meta.icon,
          description: meta.description,
          bankCount: 1,
          questionCount: bank.question_count || 0,
          publicCount: isPublic ? 1 : 0,
          privateCount: isPublic ? 0 : 1,
        });
      }
    }

    // Sort alphabetically by subject name
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allBanks]);

  const availableSubjectsList = useMemo(() => {
    const list = Array.from(new Set([
      ...subjectsData.map(s => s.name),
      ...Object.keys(STANDARD_SUBJECT_METADATA)
    ]));
    return list.sort((a, b) => a.localeCompare(b));
  }, [subjectsData]);

  // Tier 1: Filtered subjects
  const filteredSubjects = useMemo(() => {
    if (!search.trim()) return subjectsData;
    const q = search.toLowerCase();
    return subjectsData.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.description.toLowerCase().includes(q)
    );
  }, [subjectsData, search]);

  const totalSubjectPages = Math.ceil(filteredSubjects.length / pageSize);
  const pagedSubjects = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSubjects.slice(start, start + pageSize);
  }, [filteredSubjects, page, pageSize]);

  // Tier 2: Filtered banks in selected subject
  const banksInSelectedSubject = useMemo(() => {
    if (!selectedSubject) return [];
    return allBanks.filter(b => b.subject.toLowerCase() === selectedSubject.toLowerCase());
  }, [allBanks, selectedSubject]);

  const filteredBanks = useMemo(() => {
    if (!search.trim()) return banksInSelectedSubject;
    const q = search.toLowerCase();
    return banksInSelectedSubject.filter(b => 
      b.name.toLowerCase().includes(q) || 
      (b.chapter && b.chapter.toLowerCase().includes(q))
    );
  }, [banksInSelectedSubject, search]);

  const totalBankPages = Math.ceil(filteredBanks.length / pageSize);
  const pagedBanks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBanks.slice(start, start + pageSize);
  }, [filteredBanks, page, pageSize]);

  const activeSubjectInfo = useMemo(() => {
    if (!selectedSubject) return null;
    return subjectsData.find(s => s.name.toLowerCase() === selectedSubject.toLowerCase()) || {
      name: selectedSubject,
      icon: '📚',
      description: `Question banks for ${selectedSubject}`,
      bankCount: banksInSelectedSubject.length,
      questionCount: banksInSelectedSubject.reduce((acc, b) => acc + (b.question_count || 0), 0),
      publicCount: banksInSelectedSubject.filter(b => Boolean(b.chapter && b.chapter.trim())).length,
      privateCount: banksInSelectedSubject.filter(b => !b.chapter || !b.chapter.trim()).length,
    };
  }, [selectedSubject, subjectsData, banksInSelectedSubject]);

  const handleSelectSubject = (subjectName: string) => {
    setSelectedSubject(subjectName);
    setSearch('');
    setPage(1);
    router.push(`/admin/question-banks?subject=${encodeURIComponent(subjectName)}`);
  };

  const handleBackToSubjects = () => {
    setSelectedSubject(null);
    setSearch('');
    setPage(1);
    router.push('/admin/question-banks');
  };

  const handleCreateSuccess = (createdSubject: string) => {
    fetchBanks();
    if (!selectedSubject && createdSubject) {
      handleSelectSubject(createdSubject);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in">
      
      {/* LEVEL 1: ALL SUBJECTS VIEW */}
      {!selectedSubject ? (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-primary" />
                Question Banks
              </h1>
              <p className="text-text-secondary mt-1">
                Select a subject card to view its question banks, or create a new bank.
              </p>
            </div>
            <button 
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primary-hover transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" /> New Question Bank
            </button>
          </div>

          <div className="bg-surface border border-border p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
            <div className="relative w-full md:w-96">
              <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search subjects..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="text-xs text-text-secondary font-medium">
              <span>{subjectsData.length} {subjectsData.length === 1 ? 'subject' : 'subjects'} with question banks</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 relative">
            {isLoading && allBanks.length > 0 && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {isLoading && allBanks.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-surface p-6 space-y-4 animate-pulse shadow-sm">
                    <div className="flex justify-between items-start">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <div className="pt-4 flex justify-between items-center border-t border-border">
                      <Skeleton className="h-4 w-24 rounded-md" />
                      <Skeleton className="h-6 w-12 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
                {pagedSubjects.map(subj => (
                  <div 
                    key={subj.name} 
                    onClick={() => handleSelectSubject(subj.name)}
                    className="bg-surface border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all group flex flex-col cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shrink-0">
                          {subj.icon}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors">
                            {subj.name}
                          </h3>
                          <span className="text-xs text-text-muted">
                            {subj.bankCount} {subj.bankCount === 1 ? 'question bank' : 'question banks'}
                          </span>
                        </div>
                      </div>
                      <div className="p-2 text-text-muted group-hover:text-primary transition-colors">
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    <p className="text-sm text-text-secondary line-clamp-2 mb-6 flex-1">
                      {subj.description}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Total Questions</span>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-sm font-bold",
                        subj.questionCount > 0 ? "bg-primary/10 text-primary" : "bg-surface-2 text-text-muted border border-border"
                      )}>
                        {subj.questionCount}
                      </span>
                    </div>
                  </div>
                ))}

                {filteredSubjects.length === 0 && !isLoading && (
                  <div className="col-span-full py-16 text-center bg-surface border border-border border-dashed rounded-2xl p-8 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto text-2xl">
                      📚
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-text-primary">
                        {search ? "No subjects found" : "No Question Banks Yet"}
                      </h3>
                      <p className="text-sm text-text-muted max-w-sm mx-auto">
                        {search 
                          ? `No subjects matched "${search}". Try adjusting your search term.`
                          : "Get started by creating your first question bank."}
                      </p>
                    </div>
                    {!search && (
                      <button 
                        onClick={() => setIsCreateOpen(true)}
                        className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Create Question Bank
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {filteredSubjects.length > 0 && totalSubjectPages > 1 && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-shrink-0">
              <div className="text-sm font-medium text-text-secondary">
                Page <span className="text-text-primary font-bold">{page}</span> of <span className="text-text-primary font-bold">{totalSubjectPages || 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  className="p-2 border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  disabled={page >= totalSubjectPages} 
                  onClick={() => setPage(p => p + 1)} 
                  className="p-2 border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-2 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* LEVEL 2: QUESTION BANKS WITHIN SELECTED SUBJECT VIEW */
        <>
          <div className="flex flex-col gap-4 mb-8">
            <button 
              onClick={handleBackToSubjects}
              className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text-primary transition-colors w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> Back to All Subjects
            </button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl shrink-0">
                  {activeSubjectInfo?.icon || '📚'}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    {activeSubjectInfo?.name || selectedSubject}
                  </h1>
                  <p className="text-text-secondary text-sm mt-0.5">
                    {activeSubjectInfo?.bankCount || 0} {(activeSubjectInfo?.bankCount === 1 ? 'Question Bank' : 'Question Banks')} • {activeSubjectInfo?.questionCount || 0} Total Questions
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primary-hover transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" /> New Question Bank
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
            <div className="relative w-full md:w-96">
              <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder={`Search ${selectedSubject} banks...`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="text-xs text-text-muted flex items-center gap-3">
              <span>Public: <strong className="text-text-primary">{activeSubjectInfo?.publicCount || 0}</strong></span>
              <span>•</span>
              <span>Private: <strong className="text-text-primary">{activeSubjectInfo?.privateCount || 0}</strong></span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 relative">
            {isLoading && allBanks.length > 0 && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {isLoading && allBanks.length === 0 ? (
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
                {pagedBanks.map(bank => {
                  const isPublic = Boolean(bank.chapter && bank.chapter.trim());
                  return (
                    <div 
                      key={bank.id} 
                      onClick={() => router.push(`/admin/question-banks/${bank.id}/questions`)}
                      className="bg-surface border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all group flex flex-col cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="space-y-1.5 pr-2 flex-1">
                          <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors line-clamp-1">
                            {bank.name}
                          </h3>
                          <div>
                            {isPublic ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                                <Globe className="w-3.5 h-3.5" /> Ch {bank.chapter_order || 1}: {bank.chapter}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-text-muted/10 text-text-muted border border-border">
                                <Lock className="w-3.5 h-3.5" /> Private (Exam Only)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setBankToEdit(bank); }}
                            title="Edit Bank"
                            className="p-2 text-text-muted hover:text-primary hover:bg-surface-2 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => handleArchive(e, bank.id, bank.name)}
                            title="Archive Bank"
                            className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-text-muted mb-6 flex-1">
                        Created on {new Date(bank.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>

                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Questions</span>
                        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">
                          {bank.question_count}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {filteredBanks.length === 0 && !isLoading && (
                  <div className="col-span-full py-16 text-center bg-surface border border-border border-dashed rounded-2xl p-8 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto text-2xl">
                      📂
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-text-primary">No question banks found</h3>
                      <p className="text-sm text-text-muted max-w-sm mx-auto">
                        {search 
                          ? `No question banks matched "${search}".` 
                          : `There are currently no question banks created for ${selectedSubject}.`}
                      </p>
                    </div>
                    <button 
                      onClick={() => setIsCreateOpen(true)}
                      className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Create Bank for {selectedSubject}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {filteredBanks.length > 0 && totalBankPages > 1 && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-shrink-0">
              <div className="text-sm font-medium text-text-secondary">
                Page <span className="text-text-primary font-bold">{page}</span> of <span className="text-text-primary font-bold">{totalBankPages || 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  className="p-2 border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  disabled={page >= totalBankPages} 
                  onClick={() => setPage(p => p + 1)} 
                  className="p-2 border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-2 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* CREATE BANK MODAL */}
      <CreateBankModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        onSuccess={handleCreateSuccess}
        defaultSubject={selectedSubject || undefined}
        availableSubjects={availableSubjectsList}
      />

      {/* EDIT BANK MODAL */}
      <EditBankModal 
        bank={bankToEdit} 
        isOpen={Boolean(bankToEdit)} 
        onClose={() => setBankToEdit(null)} 
        onSuccess={fetchBanks}
        availableSubjects={availableSubjectsList}
      />

    </div>
  );
}

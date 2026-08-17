'use client';

import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { WizardFormData } from '@/app/admin/exams/new/page';
import { Database, AlertCircle, BarChart3, Shuffle, SlidersHorizontal, Loader2, Layers, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Step2_Questions() {
  const { register, watch, setValue, setError, clearErrors, formState: { errors } } = useFormContext<WizardFormData>();
  
  const [banks, setBanks] = useState<{ id: string, name: string, subject: string, question_count: number }[]>([]);
  const [bankStats, setBankStats] = useState<{ total: number, easy: number, medium: number, hard: number } | null>(null);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const subject = watch('basic_info.subject');
  const bankMode = watch('questions.bank_mode') || 'single';
  const bankId = watch('questions.bank_id');
  const sourceBankIds = watch('questions.source_bank_ids') || [];
  const count = watch('questions.count');
  const selectionType = watch('questions.selection_type');
  const manualCounts = watch('questions.manual_counts');

  useEffect(() => {
    fetch('/api/admin/question-banks?pageSize=1000')
      .then(res => res.json())
      .then(data => {
        if (data.data) setBanks(data.data);
      })
      .finally(() => setIsLoadingBanks(false));
  }, []);

  // Filter banks by subject if matched, or list all
  const filteredBanks = React.useMemo(() => {
    if (!subject) return banks;
    const matching = banks.filter(b => b.subject.toLowerCase() === subject.toLowerCase());
    return matching.length > 0 ? matching : banks;
  }, [banks, subject]);

  useEffect(() => {
    const targetBankIds = bankMode === 'single' ? (bankId ? [bankId] : []) : sourceBankIds;

    if (targetBankIds.length === 0) {
      setBankStats(null);
      return;
    }

    setIsLoadingStats(true);
    // Fetch questions for all target bank IDs
    Promise.all(
      targetBankIds.map(id =>
        fetch(`/api/admin/questions?bankId=${id}&pageSize=10000`)
          .then(res => res.json())
          .then(data => (data.data as { id: string, difficulty: string }[]) || [])
          .catch(() => [] as { id: string, difficulty: string }[])
      )
    )
      .then(results => {
        const allQuestions = results.flat();
        setBankStats({
          total: allQuestions.length,
          easy: allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'easy').length,
          medium: allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'medium').length,
          hard: allQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'hard').length,
        });

        // Auto-adjust count if current count is higher than total
        if (count > allQuestions.length) {
          setValue('questions.count', allQuestions.length, { shouldValidate: true });
        }
      })
      .finally(() => setIsLoadingStats(false));
  }, [bankMode, bankId, sourceBankIds, count, setValue]);

  // Validation Flags
  let blockProgression = false;
  let validationMessage = '';

  if (bankStats) {
    if (selectionType === 'Auto') {
      if (count > bankStats.total) {
        blockProgression = true;
        validationMessage = `You requested ${count} questions, but the selected bank(s) only contain ${bankStats.total}. Please lower the requested count.`;
      }
    } else {
      const sum = (manualCounts?.easy || 0) + (manualCounts?.medium || 0) + (manualCounts?.hard || 0);
      if (sum !== count) {
        blockProgression = true;
        validationMessage = `The sum of manual difficulties (${sum}) must exactly equal the total requested count (${count}).`;
      } else {
        if ((manualCounts?.easy || 0) > bankStats.easy) {
          blockProgression = true;
          validationMessage = `The selected bank(s) contain ${bankStats.easy} Easy questions, but ${manualCounts.easy} were requested. Please adjust the distribution.`;
        } else if ((manualCounts?.medium || 0) > bankStats.medium) {
          blockProgression = true;
          validationMessage = `The selected bank(s) contain ${bankStats.medium} Medium questions, but ${manualCounts.medium} were requested. Please adjust the distribution.`;
        } else if ((manualCounts?.hard || 0) > bankStats.hard) {
          blockProgression = true;
          validationMessage = `The selected bank(s) contain ${bankStats.hard} Hard questions, but ${manualCounts.hard} were requested. Please adjust the distribution.`;
        }
      }
    }
  }

  useEffect(() => {
    if (blockProgression) {
      setError('questions.count', { type: 'manual', message: validationMessage });
    } else {
      clearErrors('questions.count');
    }
  }, [blockProgression, validationMessage, setError, clearErrors]);

  const toggleBankSelection = (id: string) => {
    const current = sourceBankIds || [];
    const next = current.includes(id) ? current.filter(bId => bId !== id) : [...current, id];
    setValue('questions.source_bank_ids', next, { shouldValidate: true });
    if (next.length > 0) {
      setValue('questions.bank_id', next[0], { shouldValidate: true });
    } else {
      setValue('questions.bank_id', '', { shouldValidate: true });
    }
  };

  const selectAllBanks = () => {
    const allIds = filteredBanks.map(b => b.id);
    setValue('questions.source_bank_ids', allIds, { shouldValidate: true });
    if (allIds.length > 0) {
      setValue('questions.bank_id', allIds[0], { shouldValidate: true });
    }
  };

  const clearAllBanks = () => {
    setValue('questions.source_bank_ids', [], { shouldValidate: true });
    setValue('questions.bank_id', '', { shouldValidate: true });
  };

  return (
    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text-primary">Question Configuration</h2>
        <p className="text-text-secondary mt-1">Select the source and distribution of questions for this exam.</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        
        {/* Step 2.1: Bank Selection */}
        <div className="bg-surface-2 p-6 rounded-2xl border border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-text-primary">
              <Database className="w-5 h-5 text-primary" /> 1. Question Bank Source <span className="text-danger">*</span>
            </label>
            
            {/* Mode Switch */}
            <div className="inline-flex bg-background border border-border p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setValue('questions.bank_mode', 'single');
                  if (sourceBankIds.length > 0 && !bankId) {
                    setValue('questions.bank_id', sourceBankIds[0]);
                  }
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all",
                  bankMode === 'single'
                    ? "bg-primary text-white shadow-xs"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                Single Bank
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('questions.bank_mode', 'multi');
                  if (bankId && !sourceBankIds.includes(bankId)) {
                    setValue('questions.source_bank_ids', [bankId]);
                  }
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                  bankMode === 'multi'
                    ? "bg-primary text-white shadow-xs"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multiple Banks</span>
              </button>
            </div>
          </div>

          {/* Single Bank Selection */}
          {bankMode === 'single' && (
            <div className="relative">
              {isLoadingBanks ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-lg text-text-muted">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading banks...
                </div>
              ) : (
                <select 
                  {...register('questions.bank_id')}
                  className={cn("w-full px-4 py-3 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.questions?.bank_id ? "border-danger" : "border-border")}
                >
                  <option value="">-- Choose a Question Bank --</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.subject}) — {b.question_count} Qs</option>
                  ))}
                </select>
              )}
              {errors.questions?.bank_id && <p className="text-xs text-danger mt-2">{errors.questions.bank_id.message}</p>}
            </div>
          )}

          {/* Multi-Bank Selection */}
          {bankMode === 'multi' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
                <span>Select all question banks to draw from ({sourceBankIds.length} selected):</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllBanks}
                    className="text-primary hover:underline font-bold"
                  >
                    Select All
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={clearAllBanks}
                    className="text-text-muted hover:text-text-primary"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {isLoadingBanks ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-lg text-text-muted">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading banks...
                </div>
              ) : filteredBanks.length === 0 ? (
                <div className="p-4 bg-background border border-border rounded-lg text-sm text-text-muted text-center">
                  No question banks available.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {filteredBanks.map(b => {
                    const isSelected = sourceBankIds.includes(b.id);
                    return (
                      <div
                        key={b.id}
                        onClick={() => toggleBankSelection(b.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none",
                          isSelected
                            ? "bg-primary/5 border-primary/40 text-text-primary"
                            : "bg-background border-border hover:border-border/80 text-text-secondary"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-primary shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-text-muted shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-sm block truncate text-text-primary">{b.name}</span>
                            <span className="text-xs text-text-muted">{b.subject}</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-surface-2 px-2.5 py-1 rounded-md text-text-secondary shrink-0">
                          {b.question_count} Qs
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {errors.questions?.source_bank_ids && (
                <p className="text-xs text-danger mt-2">{errors.questions.source_bank_ids.message}</p>
              )}
            </div>
          )}

          {isLoadingStats && (
            <div className="mt-4 flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing question inventory...
            </div>
          )}

          {bankStats && !isLoadingStats && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-background border border-border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-text-primary">{bankStats.total}</div>
                <div className="text-xs font-medium text-text-secondary uppercase mt-1">Total Available</div>
              </div>
              <div className="bg-success/5 border border-success/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-success">{bankStats.easy}</div>
                <div className="text-xs font-medium text-success uppercase mt-1">Easy</div>
              </div>
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-warning-dark">{bankStats.medium}</div>
                <div className="text-xs font-medium text-warning-dark uppercase mt-1">Medium</div>
              </div>
              <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-danger">{bankStats.hard}</div>
                <div className="text-xs font-medium text-danger uppercase mt-1">Hard</div>
              </div>
            </div>
          )}
        </div>

        {/* Step 2.2: Extraction configuration */}
        {bankStats && !isLoadingStats && (
          <div className="bg-surface-2 p-6 rounded-2xl border border-border animate-in fade-in slide-in-from-bottom-4">
            <label className="flex items-center gap-2 text-sm font-bold text-text-primary mb-3">
              <BarChart3 className="w-5 h-5 text-primary" /> 2. Define Draw
            </label>
            
            <div className="mb-6">
              <label className="block text-sm font-bold text-text-secondary mb-1">Total Questions to Draw <span className="text-danger">*</span></label>
              <input 
                type="number"
                {...register('questions.count', { valueAsNumber: true })}
                className={cn("w-full md:w-1/3 px-4 py-2.5 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.questions?.count ? "border-danger" : "border-border")}
                min={1}
              />
              {errors.questions?.count && <p className="text-xs text-danger mt-1">{errors.questions.count.message}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-text-secondary mb-2">Distribution Logic</label>
              <div className="flex gap-4">
                <label className={cn("flex-1 cursor-pointer border rounded-lg p-4 transition-all flex items-center gap-3", selectionType === 'Auto' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background hover:border-primary/50")}>
                  <input type="radio" value="Auto" {...register('questions.selection_type')} className="sr-only" />
                  <Shuffle className={cn("w-5 h-5", selectionType === 'Auto' ? "text-primary" : "text-text-muted")} />
                  <div>
                    <div className={cn("font-bold", selectionType === 'Auto' ? "text-primary" : "text-text-primary")}>
                      {bankMode === 'multi' ? 'Auto (Proportional Draw)' : 'Auto (Random)'}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {bankMode === 'multi' ? 'Pulls proportionally across selected banks.' : 'Randomly pulls across all difficulties.'}
                    </div>
                  </div>
                </label>
                <label className={cn("flex-1 cursor-pointer border rounded-lg p-4 transition-all flex items-center gap-3", selectionType === 'Manual' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background hover:border-primary/50")}>
                  <input type="radio" value="Manual" {...register('questions.selection_type')} className="sr-only" />
                  <SlidersHorizontal className={cn("w-5 h-5", selectionType === 'Manual' ? "text-primary" : "text-text-muted")} />
                  <div>
                    <div className={cn("font-bold", selectionType === 'Manual' ? "text-primary" : "text-text-primary")}>Manual</div>
                    <div className="text-xs text-text-secondary mt-0.5">Strictly define exact difficulty quotas.</div>
                  </div>
                </label>
              </div>
            </div>

            {selectionType === 'Manual' && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border animate-in fade-in">
                <div>
                  <label className="block text-xs font-bold text-success uppercase mb-1">Easy Count</label>
                  <input type="number" {...register('questions.manual_counts.easy', { valueAsNumber: true })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none" min={0} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-warning-dark uppercase mb-1">Medium Count</label>
                  <input type="number" {...register('questions.manual_counts.medium', { valueAsNumber: true })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none" min={0} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-danger uppercase mb-1">Hard Count</label>
                  <input type="number" {...register('questions.manual_counts.hard', { valueAsNumber: true })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none" min={0} />
                </div>
              </div>
            )}

            {/* Strict Validation Blocking Error UI */}
            {blockProgression && (
              <div className="mt-6 p-4 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-danger mb-1">Strict Validation Failed</div>
                  <div className="text-sm text-danger/90">{validationMessage}</div>
                </div>
              </div>
            )}
            
          </div>
        )}

      </div>
    </div>
  );
}

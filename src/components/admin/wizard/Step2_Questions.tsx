'use client';

import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { WizardFormData } from '@/app/admin/exams/new/page';
import { Database, AlertCircle, BarChart3, Shuffle, SlidersHorizontal, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Step2_Questions() {
  const { register, watch, setValue, setError, clearErrors, formState: { errors } } = useFormContext<WizardFormData>();
  
  const [banks, setBanks] = useState<{ id: string, name: string, subject: string, question_count: number }[]>([]);
  const [bankStats, setBankStats] = useState<{ total: number, easy: number, medium: number, hard: number } | null>(null);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const bankId = watch('questions.bank_id');
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

  useEffect(() => {
    if (!bankId) {
      setBankStats(null);
      return;
    }
    setIsLoadingStats(true);
    // Fetch all questions for this bank to compute exact stats
    fetch(`/api/admin/questions?bankId=${bankId}&pageSize=10000`)
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          const questions = data.data as { id: string, difficulty: string }[];
          setBankStats({
            total: questions.length,
            easy: questions.filter(q => (q.difficulty || '').toLowerCase() === 'easy').length,
            medium: questions.filter(q => (q.difficulty || '').toLowerCase() === 'medium').length,
            hard: questions.filter(q => (q.difficulty || '').toLowerCase() === 'hard').length,
          });
          // Auto-adjust count if current count is higher than total
          if (count > questions.length) {
            setValue('questions.count', questions.length, { shouldValidate: true });
          }
        }
      })
      .finally(() => setIsLoadingStats(false));
  }, [bankId, count, setValue]);

  // Validation Flags
  let blockProgression = false;
  let validationMessage = '';

  if (bankStats) {
    if (selectionType === 'Auto') {
      if (count > bankStats.total) {
        blockProgression = true;
        validationMessage = `You requested ${count} questions, but the bank only contains ${bankStats.total}. Please lower the requested count.`;
      }
    } else {
      const sum = (manualCounts?.easy || 0) + (manualCounts?.medium || 0) + (manualCounts?.hard || 0);
      if (sum !== count) {
        blockProgression = true;
        validationMessage = `The sum of manual difficulties (${sum}) must exactly equal the total requested count (${count}).`;
      } else {
        if ((manualCounts?.easy || 0) > bankStats.easy) {
          blockProgression = true;
          validationMessage = `This question bank contains ${bankStats.easy} Easy questions, but ${manualCounts.easy} were requested. Please adjust the distribution or choose a different question bank.`;
        } else if ((manualCounts?.medium || 0) > bankStats.medium) {
          blockProgression = true;
          validationMessage = `This question bank contains ${bankStats.medium} Medium questions, but ${manualCounts.medium} were requested. Please adjust the distribution or choose a different question bank.`;
        } else if ((manualCounts?.hard || 0) > bankStats.hard) {
          blockProgression = true;
          validationMessage = `This question bank contains ${bankStats.hard} Hard questions, but ${manualCounts.hard} were requested. Please adjust the distribution or choose a different question bank.`;
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

  return (
    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text-primary">Question Configuration</h2>
        <p className="text-text-secondary mt-1">Select the source and distribution of questions for this exam.</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        
        {/* Step 2.1: Bank Selection */}
        <div className="bg-surface-2 p-6 rounded-2xl border border-border">
          <label className="flex items-center gap-2 text-sm font-bold text-text-primary mb-3">
            <Database className="w-5 h-5 text-primary" /> 1. Select Question Bank <span className="text-danger">*</span>
          </label>
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

          {isLoadingStats && (
            <div className="mt-4 flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing bank inventory...
            </div>
          )}

          {bankStats && !isLoadingStats && (
            <div className="mt-4 grid grid-cols-4 gap-4">
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
                    <div className={cn("font-bold", selectionType === 'Auto' ? "text-primary" : "text-text-primary")}>Auto (Random)</div>
                    <div className="text-xs text-text-secondary mt-0.5">Randomly pulls across all difficulties.</div>
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
                  {/* Validation message is shown above, react-hook-form handles blocking via setError */}
                </div>
              </div>
            )}
            
          </div>
        )}

      </div>
    </div>
  );
}

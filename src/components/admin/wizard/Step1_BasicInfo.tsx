'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { WizardFormData } from '@/app/admin/exams/new/page';
import { cn } from '@/lib/utils';
import { FileText, Clock, AlertTriangle, Target } from 'lucide-react';

export default function Step1_BasicInfo() {
  const { register, watch, formState: { errors } } = useFormContext<WizardFormData>();
  const negativeMarking = watch('basic_info.negative_marking');
  const type = watch('basic_info.type');

  return (
    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text-primary">Basic Information</h2>
        <p className="text-text-secondary mt-1">Configure the core identity and rules of the exam.</p>
      </div>

      <div className="space-y-8 max-w-3xl">
        
        {/* Core Identity */}
        <div className="space-y-5 p-6 bg-surface-2 rounded-2xl border border-border">
          <div className="flex items-center gap-3 mb-2 text-text-primary font-bold border-b border-border pb-3">
            <FileText className="w-5 h-5 text-primary" /> Exam Identity
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-text-secondary mb-1">Exam Title <span className="text-red-500">*</span></label>
              <input 
                {...register('basic_info.title')}
                className={cn("w-full px-4 py-2.5 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.basic_info?.title ? "border-red-500" : "border-border")}
                placeholder="e.g. Navigation Final Assessment 2026"
              />
              {errors.basic_info?.title && <p className="text-xs text-red-600 mt-1 font-medium">{errors.basic_info.title.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Subject <span className="text-red-500">*</span></label>
              <input 
                {...register('basic_info.subject')}
                className={cn("w-full px-4 py-2.5 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.basic_info?.subject ? "border-red-500" : "border-border")}
                placeholder="e.g. Navigation"
              />
              {errors.basic_info?.subject && <p className="text-xs text-red-600 mt-1 font-medium">{errors.basic_info.subject.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Exam Type <span className="text-red-500">*</span></label>
              <div className="flex gap-4">
                <label className={cn("flex-1 cursor-pointer border rounded-lg p-3 text-center transition-all", type === 'practice' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-surface-2")}>
                  <input type="radio" value="practice" {...register('basic_info.type')} className="sr-only" />
                  <span className={cn("font-bold", type === 'practice' ? "text-primary" : "text-text-secondary")}>Practice</span>
                </label>
                <label className={cn("flex-1 cursor-pointer border rounded-lg p-3 text-center transition-all", type === 'scheduled' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-surface-2")}>
                  <input type="radio" value="scheduled" {...register('basic_info.type')} className="sr-only" />
                  <span className={cn("font-bold", type === 'scheduled' ? "text-primary" : "text-text-secondary")}>Scheduled</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Description <span className="text-gray-400 font-normal text-xs">(Optional)</span></label>
            <textarea 
              {...register('basic_info.description')}
              rows={2}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Internal description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Instructions to Students <span className="text-gray-400 font-normal text-xs">(Optional)</span></label>
            <textarea 
              {...register('basic_info.instructions')}
              rows={3}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="These instructions will be displayed to students before they start the exam."
            />
          </div>
        </div>

        {/* Scoring & Duration */}
        <div className="space-y-5 p-6 bg-surface-2 rounded-2xl border border-border">
          <div className="flex items-center gap-3 mb-2 text-text-primary font-bold border-b border-border pb-3">
            <Target className="w-5 h-5 text-primary" /> Parameters & Scoring
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-1">
                <Clock className="w-4 h-4" /> Duration (minutes) <span className="text-red-500">*</span>
              </label>
              <input 
                type="number"
                {...register('basic_info.duration', { valueAsNumber: true })}
                className={cn("w-full px-4 py-2.5 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.basic_info?.duration ? "border-red-500" : "border-border")}
                min={5} max={360}
              />
              {errors.basic_info?.duration && <p className="text-xs text-red-600 mt-1 font-medium">{errors.basic_info.duration.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Marks per Question <span className="text-red-500">*</span></label>
              <input 
                type="number"
                step="0.25"
                {...register('basic_info.marks_per_question', { valueAsNumber: true })}
                className={cn("w-full px-4 py-2.5 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.basic_info?.marks_per_question ? "border-red-500" : "border-border")}
              />
              {errors.basic_info?.marks_per_question && <p className="text-xs text-red-600 mt-1 font-medium">{errors.basic_info.marks_per_question.message}</p>}
            </div>

            <div className="col-span-1 md:col-span-2 bg-background border border-border p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="font-bold text-text-primary flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" /> Negative Marking
                </div>
                <div className="text-sm text-text-secondary">Deduct marks for incorrect answers.</div>
              </div>
              <div className="flex items-center gap-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" {...register('basic_info.negative_marking')} className="sr-only peer" />
                  <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-danger"></div>
                </label>
                {negativeMarking && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text-secondary">Deduction:</span>
                    <input 
                      type="number"
                      step="0.25"
                      {...register('basic_info.negative_marks_value', { valueAsNumber: true })}
                      className="w-20 px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-text-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Passing Marks <span className="text-gray-400 font-normal text-xs">(Optional — leave blank if no pass/fail threshold)</span>
              </label>
              <input 
                type="number"
                {...register('basic_info.passing_marks', { valueAsNumber: true })}
                className="w-full md:w-1/2 px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 70 — leave blank if not applicable"
              />
              {errors.basic_info?.passing_marks && <p className="text-xs text-red-600 mt-1 font-medium">{errors.basic_info.passing_marks.message}</p>}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

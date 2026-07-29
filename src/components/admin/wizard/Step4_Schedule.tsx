'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { WizardFormData } from '@/app/admin/exams/new/page';
import { CalendarClock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Step4_Schedule() {
  const { register, watch, formState: { errors } } = useFormContext<WizardFormData>();
  const type = watch('basic_info.type');
  const duration = watch('basic_info.duration');

  const startDate = watch('schedule.start_date');
  const endDate = watch('schedule.end_date');

  if (type === 'practice') {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[400px] text-center animate-in fade-in zoom-in-95 duration-300">
        <CalendarClock className="w-16 h-16 text-text-muted mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-text-primary mb-2">Schedule Not Required</h2>
        <p className="text-text-secondary max-w-md">
          You selected a <strong>Practice Exam</strong>. Practice exams are immediately active upon publishing and do not require strict scheduling windows.
        </p>
        <p className="text-sm font-bold text-primary mt-6">Click Next to proceed to Enrollment.</p>
      </div>
    );
  }

  return (
    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text-primary">Exam Schedule</h2>
        <p className="text-text-secondary mt-1">Define the strict time window when students can start this exam.</p>
      </div>

      <div className="max-w-3xl bg-surface-2 p-6 rounded-2xl border border-border">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Start Date & Time *</label>
            <input 
              type="datetime-local"
              {...register('schedule.start_date')}
              className={cn("w-full px-4 py-2.5 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.schedule?.start_date ? "border-danger" : "border-border")}
            />
            {errors.schedule?.start_date && <p className="text-xs text-danger mt-1">{errors.schedule.start_date.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">End Date & Time *</label>
            <input 
              type="datetime-local"
              {...register('schedule.end_date')}
              className={cn("w-full px-4 py-2.5 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.schedule?.end_date ? "border-danger" : "border-border")}
            />
            {errors.schedule?.end_date && <p className="text-xs text-danger mt-1">{errors.schedule.end_date.message}</p>}
          </div>
        </div>

        {startDate && endDate && (
          <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-xl flex gap-4">
            <Info className="w-6 h-6 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-text-primary mb-1">Schedule Summary</p>
              <ul className="text-sm text-text-secondary space-y-1 list-disc list-inside">
                <li>Students can start any time between <strong>{new Date(startDate).toLocaleString()}</strong> and <strong>{new Date(endDate).toLocaleString()}</strong>.</li>
                <li>Regardless of when they start within the window, each student gets exactly <strong>{duration} minutes</strong> to complete the exam.</li>
                <li>Ensure the window is long enough! If a student starts 5 minutes before the End Time, they will still only have 5 minutes before the exam aggressively force-submits when the window strictly closes.</li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

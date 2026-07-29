'use client';

import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// --- Sub-components ---
import Step1_BasicInfo from '@/components/admin/wizard/Step1_BasicInfo';
import Step2_Questions from '@/components/admin/wizard/Step2_Questions';
import Step3_Settings from '@/components/admin/wizard/Step3_Settings';
import Step4_Schedule from '@/components/admin/wizard/Step4_Schedule';
import Step5_Enrollment from '@/components/admin/wizard/Step5_Enrollment';
import Step6_Review from '@/components/admin/wizard/Step6_Review';

// --- Schemas ---
const basicInfoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['practice', 'scheduled']),
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  duration: z.number().min(5).max(360),
  marks_per_question: z.number().min(0.25),
  negative_marking: z.boolean(),
  negative_marks_value: z.number().min(0),
  passing_marks: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || (typeof val === 'number' && Number.isNaN(val)) ? null : Number(val)),
    z.number().min(0).nullable().optional()
  )
});

const questionsSchema = z.object({
  bank_id: z.string().min(1, 'Please select a question bank'),
  count: z.number().min(1, 'Must select at least 1 question'),
  selection_type: z.enum(['Auto', 'Manual']),
  manual_counts: z.object({
    easy: z.number().min(0),
    medium: z.number().min(0),
    hard: z.number().min(0)
  })
}).superRefine((val, ctx) => {
  if (val.selection_type === 'Manual') {
    const total = (val.manual_counts?.easy || 0) + (val.manual_counts?.medium || 0) + (val.manual_counts?.hard || 0);
    if (total !== val.count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sum of manual difficulties (${total}) must equal total requested count (${val.count})`,
        path: ['manual_counts', 'easy']
      });
    }
  }
});

const settingsSchema = z.object({
  randomize_questions: z.boolean(),
  randomize_options: z.boolean(),
  fullscreen_required: z.boolean(),
  max_tab_switches: z.number().min(0),
  auto_submit: z.boolean(),
  show_result: z.boolean(),
  allow_review: z.boolean(),
  leaderboard_timing: z.enum(['submission', 'exam_end']),
  watermark: z.boolean()
});

const scheduleSchema = z.object({
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable()
}).superRefine((val, ctx) => {
  if (!val?.start_date || !val?.end_date) return;
  const startStr = val.start_date.trim();
  const endStr = val.end_date.trim();
  if (startStr === '' || endStr === '') return;

  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  if (!isNaN(start) && !isNaN(end) && end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date must be strictly after start date',
      path: ['end_date']
    });
  }
});

const enrollmentSchema = z.object({
  batches: z.array(z.string()).default([]),
  individual_students: z.array(z.string()).default([])
});

const wizardSchema = z.object({
  basic_info: basicInfoSchema,
  questions: questionsSchema,
  settings: settingsSchema,
  schedule: scheduleSchema,
  enrollment: enrollmentSchema
});

export type WizardFormData = z.infer<typeof wizardSchema>;

const STEPS = [
  { id: 1, title: 'Basic Info', fields: ['basic_info'] },
  { id: 2, title: 'Questions', fields: ['questions'] },
  { id: 3, title: 'Settings', fields: ['settings'] },
  { id: 4, title: 'Schedule', fields: ['schedule'] },
  { id: 5, title: 'Enroll', fields: ['enrollment'] },
  { id: 6, title: 'Review', fields: [] },
];

export default function ExamWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingBank, setIsCheckingBank] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<WizardFormData>({
    // @ts-expect-error: Complex generic mismatch between Zod and RHF
    resolver: zodResolver(wizardSchema),
    mode: 'onTouched',
    defaultValues: {
      basic_info: {
        type: 'practice',
        duration: 60,
        marks_per_question: 1.0,
        negative_marking: false,
        negative_marks_value: 0.25,
      },
      questions: {
        selection_type: 'Auto',
        count: 0,
        manual_counts: { easy: 0, medium: 0, hard: 0 }
      },
      settings: {
        randomize_questions: true,
        randomize_options: true,
        fullscreen_required: true,
        max_tab_switches: 5,
        auto_submit: false,
        show_result: true,
        allow_review: true,
        leaderboard_timing: 'exam_end',
        watermark: true
      },
      enrollment: { batches: [], individual_students: [] }
    }
  });

  const { trigger, watch, setError, clearErrors } = methods;
  const examType = watch('basic_info.type');

  // Skip schedule step if practice exam
  const handleNext = async () => {
    setServerError(null);

    // Step 2 specific async DB inventory check
    if (currentStep === 2) {
      const bankId = watch('questions.bank_id');
      const count = watch('questions.count');

      if (!bankId) {
        setError('questions.bank_id', { type: 'manual', message: 'Please select a question bank' });
        return;
      }
      if (!count || count <= 0) {
        setError('questions.count', { type: 'manual', message: 'Please specify how many questions to include' });
        return;
      }

      setIsCheckingBank(true);
      try {
        const res = await fetch(`/api/admin/questions?bankId=${bankId}&pageSize=1`);
        const data = await res.json();
        const availableCount = data.count ?? 0;

        if (count > availableCount) {
          setError('questions.count', {
            type: 'manual',
            message: `This bank only has ${availableCount} questions. You requested ${count}.`
          });
          setIsCheckingBank(false);
          return;
        } else {
          clearErrors('questions.count');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsCheckingBank(false);
      }
    }

    const fieldsToValidate = STEPS[currentStep - 1].fields as ("basic_info" | "questions" | "settings" | "schedule" | "enrollment")[];
    const isStepValid = await trigger(fieldsToValidate);

    if (isStepValid) {
      if (currentStep === 3 && examType === 'practice') {
        setCurrentStep(5); // Skip schedule
      } else {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 5 && examType === 'practice') {
      setCurrentStep(3);
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  const onSubmit = async (data: WizardFormData) => {
    // Extra validation for scheduled exams
    if (data.basic_info.type === 'scheduled') {
      if (!data.schedule?.start_date || !data.schedule?.end_date) {
        setServerError('Start and End dates are required for Scheduled exams. Please go back to Schedule step.');
        return;
      }
    }

    setIsSubmitting(true);
    setServerError(null);

    // Convert local datetime-local strings to proper ISO strings with browser timezone offset
    const payload = JSON.parse(JSON.stringify(data));
    if (payload.basic_info?.type === 'scheduled' && payload.schedule) {
      if (payload.schedule.start_date) {
        const d = new Date(payload.schedule.start_date);
        if (!isNaN(d.getTime())) {
          payload.schedule.start_date = d.toISOString();
        }
      }
      if (payload.schedule.end_date) {
        const d = new Date(payload.schedule.end_date);
        if (!isNaN(d.getTime())) {
          payload.schedule.end_date = d.toISOString();
        }
      }
    }

    try {
      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      
      if (!res.ok) {
        console.error('[Publish Exam Server Error Response]', result);
        setServerError(result.error?.message || (typeof result.error === 'string' ? result.error : 'Failed to publish exam'));
        setIsSubmitting(false);
        return;
      }

      const createdExamId = result.exam?.id || result.exam_id;
      if (createdExamId) {
        router.push(`/admin/exams/${createdExamId}`);
      } else {
        router.push('/admin/exams');
      }
      router.refresh();
    } catch (e: any) {
      console.error('[Publish Exam Network Exception]', e);
      setServerError('Network error during publishing. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col min-h-screen bg-background">
        
        {/* Wizard Top Bar */}
        <div className="bg-surface border-b border-border shadow-sm">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/exams" className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-2 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-text-primary">Create New Exam</h1>
            </div>
            <div className="text-sm font-bold text-text-muted">
              Step {currentStep} of {STEPS.length}
            </div>
          </div>
        </div>

        {/* Wizard Content */}
        <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
          
          {serverError && (
            <div className="mb-8 p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-800 text-sm font-semibold flex items-center gap-3 shadow-md animate-in fade-in">
              <div className="w-3 h-3 rounded-full bg-red-600 shrink-0" />
              <div>
                <div className="font-bold text-red-900">Could Not Publish Exam</div>
                <div>{serverError}</div>
              </div>
            </div>
          )}

          <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden min-h-[500px]">
            {/* Step indicator INSIDE the card container */}
            <div className="border-b border-border px-6 md:px-10 py-6 bg-surface-2/30">
              <div className="flex items-center justify-between relative max-w-3xl mx-auto">
                <div className="absolute left-4 right-4 top-4 h-0.5 bg-border -z-10" />
                {STEPS.map((step) => {
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  const isSkipped = step.id === 4 && examType === 'practice';
                  
                  return (
                    <div key={step.id} className={cn("flex flex-col items-center gap-1.5 bg-surface px-2 rounded-lg z-10", isSkipped ? "opacity-30 grayscale" : "")}>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                        isActive ? "border-primary bg-background text-primary shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]" : 
                        isCompleted ? "border-primary bg-primary text-white" : 
                        "border-border bg-surface text-text-muted"
                      )}>
                        {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                      </div>
                      <span className={cn(
                        "text-xs font-bold text-center whitespace-nowrap",
                        isActive ? "text-primary" : "text-text-muted"
                      )}>
                        {step.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Content Body */}
            <div>
              {currentStep === 1 && <Step1_BasicInfo />}
              {currentStep === 2 && <Step2_Questions />}
              {currentStep === 3 && <Step3_Settings />}
              {currentStep === 4 && <Step4_Schedule />}
              {currentStep === 5 && <Step5_Enrollment />}
              {currentStep === 6 && <Step6_Review />}
            </div>
          </div>

          {/* Wizard Footer Controls */}
          <div className="mt-8 flex items-center justify-between">
            <button 
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting || isCheckingBank}
              className="px-6 py-3 border border-border bg-surface text-text-primary font-bold rounded-xl hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              ← Back
            </button>

            {currentStep < 6 ? (
              <button 
                type="button"
                onClick={handleNext}
                disabled={isCheckingBank}
                className="px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all flex items-center gap-2 disabled:opacity-75"
              >
                {isCheckingBank ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Checking bank...
                  </>
                ) : (
                  'Next Step →'
                )}
              </button>
            ) : (
              <button 
                type="button"
                onClick={async () => {
                  setServerError(null);
                  
                  const fieldsToValidate: ("basic_info" | "questions" | "settings" | "schedule" | "enrollment")[] =
                    examType === 'practice'
                      ? ['basic_info', 'questions', 'settings', 'enrollment']
                      : ['basic_info', 'questions', 'settings', 'schedule', 'enrollment'];

                  const isFormValid = await trigger(fieldsToValidate);
                  
                  if (!isFormValid) {
                    const formStateErrors = methods.formState.errors;
                    console.error('[Publish Exam - Form Validation Errors]', formStateErrors);
                    
                    const errorMsgs: string[] = [];
                    if (formStateErrors.basic_info) {
                      const bi = formStateErrors.basic_info as any;
                      const msg = bi.title?.message || bi.subject?.message || bi.duration?.message || 'Basic Info has missing or invalid fields.';
                      errorMsgs.push(msg);
                    }
                    if (formStateErrors.questions) {
                      const qErr = formStateErrors.questions as any;
                      const msg = qErr.bank_id?.message || qErr.count?.message || qErr.manual_counts?.easy?.message || 'Questions step: Please select a question bank and valid count.';
                      errorMsgs.push(msg);
                    }
                    if (formStateErrors.settings) errorMsgs.push('Settings step has invalid fields.');
                    if (formStateErrors.schedule && examType === 'scheduled') {
                      const sErr = formStateErrors.schedule as any;
                      errorMsgs.push(sErr.end_date?.message || 'Schedule step has invalid dates.');
                    }
                    if (formStateErrors.enrollment) errorMsgs.push('Enrollment step has invalid fields.');

                    setServerError(errorMsgs.join(' ') || 'Please fix the highlighted fields in previous steps before publishing.');
                    return;
                  }

                  // Retrieve values and execute submission
                  const formData = methods.getValues();
                  await onSubmit(formData);
                }}
                disabled={isSubmitting}
                className="px-8 py-3 bg-success text-white font-bold rounded-xl hover:bg-success/90 shadow-lg shadow-success/25 transition-all flex items-center gap-2 disabled:opacity-75"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Publish Exam
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </FormProvider>
  );
}

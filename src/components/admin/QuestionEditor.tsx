'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

import { QuestionImageUpload } from './QuestionImageUpload';

const optionSchema = z.object({
  id: z.string().optional().nullable(),
  text: z.string().min(1, 'Option text cannot be empty'),
  content: z.string().optional(),
  is_correct: z.boolean()
});

const questionSchema = z.object({
  id: z.string().optional().nullable(),
  bank_id: z.string(),
  subject: z.string().min(1, 'Subject is required'),
  topic: z.string().optional().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  text: z.string().min(10, 'Question text must be at least 10 characters'),
  explanation: z.string().min(20, 'Explanation must be at least 20 characters — students depend on this'),
  options: z.array(optionSchema)
    .min(2, 'A question must have at least 2 options')
    .max(6, 'A question can have at most 6 options')
}).refine(data => data.options.filter(o => o.is_correct).length === 1, {
  message: "Exactly one option must be marked as the correct answer",
  path: ["options"]
});

type QuestionFormData = z.infer<typeof questionSchema>;

interface Props {
  isOpen: boolean;
  question: { id: string, subject: string, topic?: string | null, difficulty: string, text?: string, content?: string, explanation: string, content_image_url?: string | null, explanation_image_url?: string | null, question_options: { id: string, text?: string, content?: string, is_correct: boolean }[] } | null;
  bankId: string;
  bankSubject: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuestionEditor({ isOpen, question, bankId, bankSubject, onClose, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [contentImageFile, setContentImageFile] = useState<File | null>(null);
  const [contentImageRemoved, setContentImageRemoved] = useState<boolean>(false);
  const [explanationImageFile, setExplanationImageFile] = useState<File | null>(null);
  const [explanationImageRemoved, setExplanationImageRemoved] = useState<boolean>(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const { register, control, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch, setError } = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      bank_id: bankId,
      subject: bankSubject,
      difficulty: 'medium',
      options: [
        { id: uuidv4(), text: '', is_correct: true },
        { id: uuidv4(), text: '', is_correct: false },
        { id: uuidv4(), text: '', is_correct: false },
        { id: uuidv4(), text: '', is_correct: false }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'options'
  });

  const watchOptions = watch('options');

  useEffect(() => {
    if (isOpen) {
      setContentImageFile(null);
      setContentImageRemoved(false);
      setExplanationImageFile(null);
      setExplanationImageRemoved(false);
      setIsUploadingImages(false);
      if (question) {
        reset({
          id: question.id,
          bank_id: bankId,
          subject: question.subject,
          topic: question.topic || '',
          difficulty: (question.difficulty?.toLowerCase() as "easy" | "medium" | "hard") || 'medium',
          text: question.text || question.content || '',
          explanation: question.explanation || '',
          options: question.question_options?.length > 0 
            ? question.question_options.map(opt => ({
                id: opt.id,
                text: opt.text || opt.content || '',
                content: opt.content || opt.text || '',
                is_correct: opt.is_correct
              }))
            : [
                { id: uuidv4(), text: '', is_correct: true },
                { id: uuidv4(), text: '', is_correct: false },
              ]
        });
      } else {
        reset({
          bank_id: bankId,
          subject: bankSubject,
          topic: '',
          difficulty: 'medium',
          text: '',
          explanation: '',
          options: [
            { id: uuidv4(), text: '', is_correct: true },
            { id: uuidv4(), text: '', is_correct: false },
            { id: uuidv4(), text: '', is_correct: false },
            { id: uuidv4(), text: '', is_correct: false }
          ]
        });
      }
      setServerError(null);
    }
  }, [isOpen, question, bankId, bankSubject, reset]);

  if (!isOpen) return null;

  const handleSetCorrect = (index: number) => {
    const currentOptions = [...watchOptions];
    currentOptions.forEach((opt, i) => {
      opt.is_correct = i === index;
    });
    setValue('options', currentOptions);
  };

  const uploadNewImage = async (qId: string, file: File, type: 'content' | 'explanation') => {
    const form = new FormData();
    form.append('image', file);
    form.append('image_type', type);
    const res = await fetch(`/api/admin/questions/${qId}/images`, {
      method: 'POST',
      body: form,
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = `Failed to upload ${type} image`;
      try {
        const err = text ? JSON.parse(text) : {};
        msg = err.error?.message || msg;
      } catch {}
      throw new Error(msg);
    }
  };

  const deleteQuestionImage = async (qId: string, type: 'content' | 'explanation') => {
    await fetch(`/api/admin/questions/${qId}/images`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_type: type }),
    });
  };

  const onSubmit = async (data: QuestionFormData) => {
    setServerError(null);
    try {
      const payload = {
        ...data,
        content: data.text,
        options: data.options.map(opt => ({
          ...opt,
          content: opt.text
        }))
      };

      const res = await fetch('/api/admin/questions', {
        method: data.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let result: any = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Server returned status ${res.status}. Please try again.`);
      }

      if (!res.ok) {
        if (result.error?.code === 'VALIDATION_ERROR' && Array.isArray(result.error.details)) {
          result.error.details.forEach((issue: { field: string; message: string }) => {
            if (issue.field) {
              setError(issue.field as keyof QuestionFormData, { type: 'server', message: issue.message });
            }
          });
          setServerError(result.error.message || 'Please fix the highlighted fields.');
        } else {
          const errMsg = typeof result.error === 'string' 
            ? result.error 
            : result.error?.message || result.message || `Failed to save question (HTTP ${res.status})`;
          setServerError(errMsg);
        }
        return;
      }

      const savedQuestionId = data.id || result.id || result.data?.id || (Array.isArray(result.data) ? result.data[0]?.id : null);

      if (savedQuestionId) {
        setIsUploadingImages(true);
        if (contentImageFile) {
          await uploadNewImage(savedQuestionId, contentImageFile, 'content');
        } else if (contentImageRemoved) {
          await deleteQuestionImage(savedQuestionId, 'content');
        }

        if (explanationImageFile) {
          await uploadNewImage(savedQuestionId, explanationImageFile, 'explanation');
        } else if (explanationImageRemoved) {
          await deleteQuestionImage(savedQuestionId, 'explanation');
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setServerError(err.message || 'An unexpected error occurred while saving the question.');
    } finally {
      setIsUploadingImages(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-bold text-text-primary">
            {question ? 'Edit Question' : 'Add Question'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <form id="question-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {serverError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                {serverError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Subject</label>
                <input 
                  {...register('subject')}
                  readOnly
                  className="w-full px-4 py-2 bg-surface-2 border border-border rounded-lg text-text-muted cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Topic <span className="text-gray-400 font-normal text-xs">(Optional)</span>
                </label>
                <input 
                  {...register('topic')}
                  placeholder="e.g. Navigation & Flight Rules"
                  className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.topic ? "border-red-500 focus:ring-red-500" : "border-border")}
                />
                {errors.topic && <p className="text-xs text-red-600 mt-1 font-medium">{errors.topic.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Difficulty <span className="text-red-500">*</span>
              </label>
              <select 
                {...register('difficulty')}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              {errors.difficulty && <p className="text-xs text-red-600 mt-1 font-medium">{errors.difficulty.message}</p>}
            </div>

            <div className="pt-2 border-t border-border space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Question Text <span className="text-red-500">*</span>
                </label>
                <textarea 
                  {...register('text')}
                  rows={4}
                  className={cn("w-full px-4 py-3 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.text ? "border-red-500 focus:ring-red-500" : "border-border")}
                  placeholder="Type the question content here (minimum 10 characters)..."
                />
                {errors.text && <p className="text-xs text-red-600 mt-1 font-medium">{errors.text.message}</p>}
              </div>

              <QuestionImageUpload
                label="Question Content Image / Diagram"
                imageType="content"
                currentImageUrl={question?.content_image_url}
                onImageChange={(file, isRemoved) => {
                  setContentImageFile(file);
                  if (isRemoved) setContentImageRemoved(true);
                }}
              />
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-text-secondary">
                  Answer Options <span className="text-red-500">*</span> <span className="text-xs font-normal text-text-muted">(Mark exactly 1 correct answer)</span>
                </label>
              </div>

              {errors.options?.root && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 text-sm font-medium rounded-lg mb-3">
                  {errors.options.root.message}
                </div>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-3">
                    <div className="pt-3">
                      <input 
                        type="radio" 
                        name="correct_option"
                        checked={watchOptions[index]?.is_correct || false}
                        onChange={() => handleSetCorrect(index)}
                        className="w-5 h-5 text-primary focus:ring-primary accent-primary cursor-pointer"
                      />
                    </div>
                    <div className="flex-1">
                      <input 
                        {...register(`options.${index}.text`)}
                        className={cn(
                          "w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", 
                          errors.options?.[index]?.text ? "border-red-500 focus:ring-red-500" : (watchOptions[index]?.is_correct ? "border-emerald-500 bg-emerald-500/5" : "border-border")
                        )}
                        placeholder={`Option ${index + 1}`}
                      />
                      {errors.options?.[index]?.text && <p className="text-xs text-red-600 mt-1 font-medium">{errors.options[index]?.text?.message}</p>}
                    </div>
                    <button 
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 2}
                      className="p-2.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-0.5"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              {fields.length < 6 && (
                <button 
                  type="button"
                  onClick={() => append({ id: uuidv4(), text: '', is_correct: false })}
                  className="mt-3 flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-hover transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4" /> Add Another Option
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-border space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Explanation <span className="text-red-500">*</span> <span className="text-xs font-normal text-text-muted">(Min 20 characters — shown after submission)</span>
                </label>
                <textarea 
                  {...register('explanation')}
                  rows={4}
                  className={cn("w-full px-4 py-3 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.explanation ? "border-red-500 focus:ring-red-500" : "border-border")}
                  placeholder="Explain why the correct answer is right and why others are wrong..."
                />
                {errors.explanation && <p className="text-xs text-red-600 mt-1 font-medium">{errors.explanation.message}</p>}
              </div>

              <QuestionImageUpload
                label="Explanation Image / Diagram"
                imageType="explanation"
                currentImageUrl={question?.explanation_image_url}
                onImageChange={(file, isRemoved) => {
                  setExplanationImageFile(file);
                  if (isRemoved) setExplanationImageRemoved(true);
                }}
              />
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-border bg-surface-2 flex items-center justify-between flex-shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-text-secondary hover:text-text-primary font-medium"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="question-form"
            disabled={isSubmitting || isUploadingImages}
            className="px-8 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {(isSubmitting || isUploadingImages) && <Loader2 className="w-4 h-4 animate-spin" />}
            {isUploadingImages ? 'Uploading Images...' : 'Save Question'}
          </button>
        </div>

      </div>
    </div>
  );
}

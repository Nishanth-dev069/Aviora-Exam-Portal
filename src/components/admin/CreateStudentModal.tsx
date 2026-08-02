'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const createSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address (e.g. student@gmail.com)'),
  roll_number: z.string().min(1, 'Roll number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  batch_id: z.string().optional(),
  phone: z.string()
    .optional()
    .refine(
      (val) => !val || /^\+?[0-9]{7,15}$/.test(val),
      'Phone number must be 7–15 digits, optionally starting with +'
    ),
});

type FormData = z.infer<typeof createSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

import { StudentPhotoUpload } from './StudentPhotoUpload';

export default function CreateStudentModal({ isOpen, onClose, onSuccess }: Props) {
  const [batches, setBatches] = useState<{id: string, name: string}[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setError } = useForm<FormData>({
    resolver: zodResolver(createSchema)
  });

  useEffect(() => {
    if (isOpen) {
      reset();
      setServerError(null);
      setPhotoFile(null);
      // Fetch batches for dropdown
      fetch('/api/admin/batches?pageSize=100')
        .then(res => res.json())
        .then(data => {
          if (data.data) setBatches(data.data);
        })
        .catch(console.error);
    }
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          batch_id: data.batch_id || null,
          phone: data.phone || null
        })
      });

      const result = await res.json();
      
      if (!res.ok) {
        if (result.error?.code === 'VALIDATION_ERROR' && Array.isArray(result.error.details)) {
          result.error.details.forEach((issue: { field: string; message: string }) => {
            if (issue.field) {
              setError(issue.field as keyof FormData, { type: 'server', message: issue.message });
            }
          });
          setServerError(result.error.message || 'Please fix the highlighted fields.');
        } else {
          setServerError(result.error?.message || result.error || 'Failed to create student');
        }
        return;
      }

      const newStudentId = result.data?.id || result.data?.user_id || result.student?.id;
      if (photoFile && newStudentId) {
        try {
          const form = new FormData();
          form.append('photo', photoFile);
          await fetch(`/api/admin/students/${newStudentId}/photo`, {
            method: 'POST',
            body: form,
          });
        } catch (photoErr) {
          console.error('Failed to upload student photo during creation', photoErr);
        }
      }

      onSuccess();
      onClose();
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="bg-surface border border-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">Add New Student</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          
          <StudentPhotoUpload
            onPhotoChange={(file) => setPhotoFile(file)}
          />

          {serverError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              {serverError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input 
              {...register('full_name')}
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors", errors.full_name ? "border-red-500 focus:ring-red-500" : "border-border")}
              placeholder="e.g. John Doe"
            />
            {errors.full_name && <p className="text-xs text-red-600 mt-1 font-medium">{errors.full_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input 
                {...register('email')}
                className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors", errors.email ? "border-red-500 focus:ring-red-500" : "border-border")}
                placeholder="john@example.com"
              />
              {errors.email && <p className="text-xs text-red-600 mt-1 font-medium">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Roll Number <span className="text-red-500">*</span>
              </label>
              <input 
                {...register('roll_number')}
                className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors", errors.roll_number ? "border-red-500 focus:ring-red-500" : "border-border")}
                placeholder="e.g. RN-001"
              />
              {errors.roll_number && <p className="text-xs text-red-600 mt-1 font-medium">{errors.roll_number.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Temporary Password <span className="text-red-500">*</span>
            </label>
            <input 
              {...register('password')}
              type="password"
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors", errors.password ? "border-red-500 focus:ring-red-500" : "border-border")}
              placeholder="Minimum 8 characters"
            />
            {errors.password && <p className="text-xs text-red-600 mt-1 font-medium">{errors.password.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Batch <span className="text-gray-400 font-normal text-xs">(Optional)</span>
              </label>
              <select 
                {...register('batch_id')}
                className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors", errors.batch_id ? "border-red-500 focus:ring-red-500" : "border-border")}
              >
                <option value="">Select Batch...</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {errors.batch_id && <p className="text-xs text-red-600 mt-1 font-medium">{errors.batch_id.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Phone <span className="text-gray-400 font-normal text-xs">(Optional)</span>
              </label>
              <input 
                {...register('phone')}
                className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors", errors.phone ? "border-red-500 focus:ring-red-500" : "border-border")}
                placeholder="+91 9876543210"
              />
              {errors.phone && <p className="text-xs text-red-600 mt-1 font-medium">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-text-secondary hover:text-text-primary font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Student
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

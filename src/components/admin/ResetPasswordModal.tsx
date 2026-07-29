'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, ShieldAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof resetSchema>;

interface Props {
  isOpen: boolean;
  student: { user_id: string, full_name: string } | null; 
  onClose: () => void;
  onSuccess: () => void;
}

export default function ResetPasswordModal({ isOpen, student, onClose, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(resetSchema)
  });

  useEffect(() => {
    if (isOpen) {
      reset();
      setServerError(null);
    }
  }, [isOpen, reset]);

  if (!isOpen || !student) return null;

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          student_id: student.user_id,
          password: data.password
        })
      });

      const result = await res.json();
      
      if (!res.ok) {
        setServerError(result.error || 'Failed to reset password');
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
          <h2 className="text-xl font-bold text-text-primary">Reset Password</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          
          <div className="flex gap-3 bg-warning/10 text-warning-dark p-4 rounded-xl items-start">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              You are resetting the password for <strong>{student.full_name}</strong>. They will be forced to change this temporary password upon their next login.
            </p>
          </div>

          {serverError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm font-medium">
              {serverError}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">New Temporary Password *</label>
            <input 
              {...register('password')}
              type="text" // Shown as text so admin knows what they are typing
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.password ? "border-danger" : "border-border")}
              placeholder="Minimum 8 characters"
            />
            {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
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
              className="px-6 py-2 bg-warning text-white font-medium rounded-lg hover:bg-warning/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Reset Password
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

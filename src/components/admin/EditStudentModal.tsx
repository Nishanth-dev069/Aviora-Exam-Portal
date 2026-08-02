'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const editSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  batch_id: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

type FormData = z.infer<typeof editSchema>;

import { StudentPhotoUpload } from './StudentPhotoUpload';
import { DeviceRegistrationSection } from './DeviceRegistrationSection';

interface Props {
  isOpen: boolean;
  student: { 
    user_id: string; 
    full_name: string; 
    roll_number?: string; 
    batch_id?: string; 
    phone?: string; 
    photo_url?: string | null;
    registered_device_id?: string | null;
    registered_device_info?: Record<string, unknown> | null;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditStudentModal({ isOpen, student, onClose, onSuccess }: Props) {
  const [batches, setBatches] = useState<{id: string, name: string}[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, unknown> | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(editSchema)
  });

  useEffect(() => {
    if (isOpen && student) {
      reset({
        full_name: student.full_name || '',
        batch_id: student.batch_id || '',
        phone: student.phone || '',
      });
      setServerError(null);
      // Load device info from student prop (passed from list)
      setDeviceId(student.registered_device_id ?? null);
      setDeviceInfo((student.registered_device_info as Record<string, unknown>) ?? null);
      
      fetch('/api/admin/batches?pageSize=100')
        .then(res => res.json())
        .then(data => {
          if (data.data) setBatches(data.data);
        })
        .catch(console.error);
    }
  }, [isOpen, student, reset]);

  if (!isOpen || !student) return null;

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          student_id: student.user_id,
          full_name: data.full_name,
          batch_id: data.batch_id || null,
          phone: data.phone || null
        })
      });

      const result = await res.json();
      
      if (!res.ok) {
        setServerError(result.error || 'Failed to update student');
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
          <h2 className="text-xl font-bold text-text-primary">Edit Student</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          
          <StudentPhotoUpload
            studentId={student.user_id}
            currentPhotoUrl={student.photo_url}
            onPhotoUploaded={() => onSuccess()}
          />

          <DeviceRegistrationSection
            studentId={student.user_id}
            registeredDeviceId={deviceId}
            registeredDeviceInfo={deviceInfo as any}
            onDeviceCleared={() => {
              setDeviceId(null);
              setDeviceInfo(null);
              onSuccess();
            }}
          />
          
          {serverError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm font-medium">
              {serverError}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Roll Number</label>
            <input 
              value={student.roll_number || ''}
              disabled
              className="w-full px-4 py-2 bg-surface-2 border border-border rounded-lg text-text-muted cursor-not-allowed"
            />
            <p className="text-xs text-text-muted mt-1">Roll numbers cannot be modified after creation.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Full Name *</label>
            <input 
              {...register('full_name')}
              className={cn("w-full px-4 py-2 bg-background border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50", errors.full_name ? "border-danger" : "border-border")}
            />
            {errors.full_name && <p className="text-xs text-danger mt-1">{errors.full_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-text-secondary mb-1">Batch</label>
              <select 
                {...register('batch_id')}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">No Batch</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-text-secondary mb-1">Phone</label>
              <input 
                {...register('phone')}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
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
              Save Changes
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

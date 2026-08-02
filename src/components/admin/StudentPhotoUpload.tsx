'use client';

import { useState, useRef, useEffect } from 'react';

interface StudentPhotoUploadProps {
  studentId?: string;           // undefined when creating new student
  currentPhotoUrl?: string | null;  // signed URL if photo exists
  onPhotoChange?: (file: File | null) => void; // for new student (file not uploaded yet)
  onPhotoUploaded?: (path: string) => void;    // for existing student (immediate upload)
}

export function StudentPhotoUpload({
  studentId,
  currentPhotoUrl,
  onPhotoChange,
  onPhotoUploaded,
}: StudentPhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(currentPhotoUrl ?? null);
  }, [currentPhotoUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side validation
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.');
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    if (studentId) {
      // Existing student — upload immediately
      setUploading(true);
      try {
        const form = new FormData();
        form.append('photo', file);
        const res = await fetch(`/api/admin/students/${studentId}/photo`, {
          method: 'POST',
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message ?? 'Upload failed');
        onPhotoUploaded?.(data.storage_path);
      } catch (err: any) {
        setError(err.message ?? 'Upload failed. Please try again.');
        setPreview(currentPhotoUrl ?? null);
      } finally {
        setUploading(false);
      }
    } else {
      // New student — just pass the file to the parent form
      onPhotoChange?.(file);
    }
  };

  const handleRemove = async () => {
    if (studentId && currentPhotoUrl) {
      setUploading(true);
      try {
        await fetch(`/api/admin/students/${studentId}/photo`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to remove photo', err);
      } finally {
        setUploading(false);
      }
    }
    setPreview(null);
    onPhotoChange?.(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Photo display */}
      <div className="relative w-24 h-24 rounded-full overflow-hidden bg-surface-2 border-2 border-border shadow-xs">
        {preview ? (
          <img src={preview} alt="Student photo" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
        >
          {preview ? 'Change Photo' : 'Add Photo'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="text-xs px-3 py-1.5 rounded-lg border border-danger text-danger hover:bg-danger/10 transition-colors font-medium disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-xs text-danger font-medium">{error}</p>}
      <p className="text-[11px] text-text-muted">JPEG, PNG or WebP · Max 2MB</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

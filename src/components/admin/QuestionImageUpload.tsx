/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, RefreshCw, Trash2, Upload, Loader2 } from 'lucide-react';

interface QuestionImageUploadProps {
  label: string;                  // "Question Image" or "Explanation Image"
  imageType: 'content' | 'explanation';
  currentImageUrl?: string | null; // signed URL if image exists
  onImageChange?: (file: File | null, isRemoved?: boolean) => void;
}

export function QuestionImageUpload({
  label,
  imageType,
  currentImageUrl,
  onImageChange,
}: QuestionImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(currentImageUrl ?? null);
  }, [currentImageUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    onImageChange?.(file, false);
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange?.(null, true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-text-secondary">
          {label} <span className="text-text-muted font-normal text-xs">(Optional)</span>
        </label>
        <span className="text-xs text-text-muted">JPEG, PNG, WebP · Max 5MB</span>
      </div>

      {preview ? (
        <div className="relative rounded-xl border border-border bg-surface-2 p-3 overflow-hidden group">
          <div className="relative max-h-48 flex justify-center items-center bg-background/50 rounded-lg p-2 border border-border/60">
            <img
              src={preview}
              alt={label}
              className="max-h-44 w-auto object-contain rounded"
            />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface border border-border text-text-primary hover:bg-surface-2 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Replace Image
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1.5 text-text-muted hover:border-primary hover:text-primary transition-colors bg-background/50"
        >
          <Upload className="w-5 h-5" />
          <span className="text-xs font-medium">Click to attach image</span>
        </button>
      )}

      {error && <p className="text-xs text-danger font-medium mt-1">{error}</p>}

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

'use client';

import React, { useState } from 'react';
import { Loader2, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { changePasswordSchema } from '@/lib/validators';
import { z } from 'zod';

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      // 1. Client-side validation
      changePasswordSchema.parse({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      });

      // 2. Submit to API
      setIsLoading(true);
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'INVALID_PASSWORD') {
          throw new Error('The current password you entered is incorrect.');
        }
        throw new Error(data.error || 'Failed to update password.');
      }

      // 3. Success state
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (err) {
      if (err instanceof z.ZodError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setError((err as any).errors[0].message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-sm text-danger font-medium animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-3 text-sm text-success font-medium animate-in fade-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p>Password updated successfully!</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-text-secondary mb-1">Current Password</label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary transition-colors"
            placeholder="Enter current password"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-text-secondary mb-1">New Password</label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary transition-colors"
            placeholder="Min 8 chars, 1 uppercase"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-text-secondary mb-1">Confirm New Password</label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary transition-colors"
            placeholder="Confirm new password"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="pt-2">
        <button 
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Update Password
        </button>
      </div>
    </form>
  );
}

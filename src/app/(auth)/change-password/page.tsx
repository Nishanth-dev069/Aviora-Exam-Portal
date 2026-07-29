'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CheckCircle, XCircle } from 'lucide-react';
import { z } from 'zod';
import { changePasswordSchema } from '@/lib/validators';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const minLength = password.length >= 8;
  const hasNumber = /[0-9]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      changePasswordSchema.parse({ new_password: password, confirm_password: confirmPassword });

      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: password, confirm_password: confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || data.error || 'Failed to change password');
        setIsLoading(false);
        return;
      }

      // Success, route to dashboard
      // Note: If this is an admin, the middleware on /dashboard will bounce them to /admin/students automatically
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="max-w-md w-full bg-surface shadow-lg rounded-xl p-8 mb-6">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-2">Change Password</h1>
          <p className="text-text-secondary text-sm text-center">
            For security reasons, you must update your password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            required
          />

          <div className="bg-surface-2 p-4 rounded-md space-y-2 text-sm">
            <div className={`flex items-center gap-2 ${minLength ? 'text-success' : 'text-text-muted'}`}>
              {minLength ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-2 ${hasNumber || hasUppercase ? 'text-success' : 'text-text-muted'}`}>
              {hasNumber || hasUppercase ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>Contains a number or uppercase letter</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-success' : 'text-text-muted'}`}>
              {passwordsMatch ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>Passwords match</span>
            </div>
          </div>

          {error && <p className="text-danger text-sm font-medium">{error}</p>}

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading || !minLength || !(hasNumber || hasUppercase) || !passwordsMatch}
            >
              Update Password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

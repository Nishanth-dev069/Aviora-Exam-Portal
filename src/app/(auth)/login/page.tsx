'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Eye, EyeOff, Plane, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import { loginSchema } from '@/lib/validators';

const errorMessages: Record<string, string> = {
  session_terminated: 'Your session was ended because you signed in on another device.',
  session_expired: 'Your session has expired. Please sign in again.',
  session_invalid: 'Your session is invalid. Please sign in again.',
  account_suspended: 'Your account has been suspended. Please contact your administrator.',
};

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlErrorCode = searchParams.get('error') || searchParams.get('reason');
  const urlErrorMessage = urlErrorCode ? errorMessages[urlErrorCode] : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      loginSchema.parse({ email, password });

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || data.error || 'Invalid email or password');
        setIsLoading(false);
        return;
      }

      // Success routing with intended redirect support (use window.location to purge stale RSC layout cache)
      const redirectTarget = searchParams.get('redirect');
      if (redirectTarget && redirectTarget.startsWith('/')) {
        window.location.href = redirectTarget;
      } else if (data.user.role === 'admin' || data.user.role === 'super_admin') {
        window.location.href = '/admin/students';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError('Invalid email or password');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="max-w-md w-full bg-surface shadow-lg rounded-xl p-8 mb-6">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight mb-1">
            <Plane className="h-6 w-6" />
            <span>AVIORA</span>
          </div>
          <p className="text-text-secondary text-sm">Examination Portal</p>
        </div>

        {urlErrorMessage && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 font-bold flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>{urlErrorMessage}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@aviora.com"
            disabled={isLoading}
            required
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            disabled={isLoading}
            required
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-text-muted hover:text-text-primary focus:outline-none transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          {error && <p className="text-danger text-sm font-medium">{error}</p>}

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Sign In
            </Button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm text-text-muted">
          Having trouble? <a href="#" className="hover:text-text-primary transition-colors">Contact your administrator</a>
        </div>
      </div>
      <div className="text-sm text-surface-2/60">
        &copy; AVIORA 2024 &middot; Aviation Training Portal
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full flex justify-center py-12">
        <div className="text-text-muted text-sm font-medium">Loading login portal...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

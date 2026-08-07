'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Eye, EyeOff, Plane, AlertTriangle, MonitorSmartphone, BookOpen, BarChart3, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { loginSchema } from '@/lib/validators';
import { getOrCreateDeviceId, getDeviceInfo } from '@/lib/device/device-id';

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
  const [deviceBlocked, setDeviceBlocked] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const urlErrorCode = searchParams.get('error') || searchParams.get('reason');
  const urlErrorMessage = urlErrorCode ? errorMessages[urlErrorCode] : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDeviceBlocked(false);
    setIsLoading(true);

    try {
      loginSchema.parse({ email, password });

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          device_id: getOrCreateDeviceId(),
          device_info: getDeviceInfo(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.code === 'DEVICE_NOT_REGISTERED') {
          setDeviceBlocked(true);
          setError(data.error.message);
        } else {
          setError(data.error?.message || data.error || 'Invalid email or password');
        }
        setIsLoading(false);
        return;
      }

      // Success routing with intended redirect support
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
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {/* Left Part - System Feature Overview & Blue Background (#0F4383) */}
      <div className="w-full lg:w-1/2 bg-[#0F4383] text-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden shrink-0 h-full">

        {/* Subtle background ambient overlay */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 -left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header Badge */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-white uppercase tracking-wider backdrop-blur-xs">
            <Plane className="w-3.5 h-3.5 text-amber-400" />
            <span>DGCA Examination & Assessment Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mt-4 leading-tight">
            Aviora Aviation Portal
          </h1>
          <p className="text-blue-100/90 text-xs sm:text-sm lg:text-base font-normal mt-2.5 max-w-xl leading-relaxed">
            Enterprise aviation testing infrastructure engineered for civil aviation standards, timed exam simulations, and comprehensive student progress tracking.
          </p>
        </div>

        {/* System Feature Highlights */}
        <div className="my-auto py-4 space-y-5 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 shrink-0 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">DGCA-Style Examinations</h3>
              <p className="text-xs sm:text-sm text-blue-100/80 mt-0.5 leading-relaxed">
                Realistic computer-based testing interface matching official regulatory layout, question format, time bounds, and security standards.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 shrink-0 text-sky-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Subject Preparations & Practice Tests</h3>
              <p className="text-xs sm:text-sm text-blue-100/80 mt-0.5 leading-relaxed">
                Extensive subject-wise question banks for Air Navigation, Meteorology, Air Regulations, and Technical General & Specific modules.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 shrink-0 text-emerald-300">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Performance Tracking & Analytics</h3>
              <p className="text-xs sm:text-sm text-blue-100/80 mt-0.5 leading-relaxed">
                Instant post-exam evaluation, topic-wise accuracy breakdowns, score progression metrics, and batch leaderboard rankings.
              </p>
            </div>
          </div>
        </div>

        {/* Left Side Footer */}
        <div className="pt-3 border-t border-white/15 text-xs text-blue-200/70 flex items-center justify-between relative z-10 shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>High-Security Proctored Environment</span>
          </div>
          <span className="font-semibold text-white/90">Aviators Exam System</span>
        </div>
      </div>

      {/* Right Part - Login Form Container (Moved downward with top padding) */}
      <div className="w-full lg:w-1/2 bg-background p-4 sm:p-6 flex flex-col items-center justify-start pt-8 sm:pt-12 lg:pt-14 h-full overflow-y-auto">
        <div className="w-full max-w-sm sm:max-w-md flex flex-col items-center">

          {/* Logo & Subtitle */}
          <div className="flex flex-col items-center text-center mb-3">
            <img
              src="/aviora-logo.png"
              alt="AVIORA Logo"
              className="h-24 sm:h-28 md:h-32 w-auto object-contain shrink-0 drop-shadow-md transition-transform hover:scale-105 block"
            />
            <p className="text-text-secondary text-sm sm:text-base font-semibold mt-2 sm:mt-2.5">
              Examination Portal Sign In
            </p>
          </div>

          <div className="w-full bg-surface shadow-xl border border-border rounded-2xl p-5 sm:p-6">
            {urlErrorMessage && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 font-bold flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>{urlErrorMessage}</div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5">
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

              {deviceBlocked && error ? (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
                  <MonitorSmartphone className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Device Not Registered</p>
                    <p className="text-sm text-amber-700 mt-1">{error}</p>
                  </div>
                </div>
              ) : error ? (
                <p className="text-danger text-sm font-medium">{error}</p>
              ) : null}

              <div className="pt-1">
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-bold shadow-md"
                  isLoading={isLoading}
                  disabled={isLoading}
                >
                  Sign In
                </Button>
              </div>
            </form>

            <div className="mt-4 text-center text-xs text-text-muted">
              Having trouble? <a href="#" className="font-semibold hover:text-text-primary transition-colors">Contact your administrator</a>
            </div>
          </div>

          {/* Zyxen Maintenance Footer (Bigger text, sharp & clearly visible) */}
          <div className="text-sm text-text-secondary flex flex-col items-center gap-1.5 mt-5 text-center">
            <div className="font-bold text-text-primary text-xs sm:text-sm">&copy; AVIORA &middot; Aviation Training Portal</div>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
              <span>Developed & maintained by</span>
              <a
                href="https://zyxen.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-black text-primary hover:underline"
              >
                <img src="/zyxen-logo.jpeg" alt="ZYXEN Logo" className="h-5 sm:h-5.5 w-auto rounded-xs object-contain shadow-xs" />
                <span className="text-sm sm:text-base font-extrabold tracking-wide">ZYXEN</span>
              </a>
            </div>
          </div>
        </div>
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

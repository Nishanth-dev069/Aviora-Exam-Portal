'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  BarChart3,
  AlertTriangle,
  Eye,
  EyeOff,
  Plane,
  ShieldCheck,
  Lock,
  BookOpen,
  MonitorSmartphone,
} from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
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
    setLoading(true);

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
        setLoading(false);
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
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-slate-50 font-sans">
      {/* LEFT PANEL: AEROVERSE-Style Aviation & Finance Brand Showcase */}
      <div className="hidden lg:flex lg:col-span-7 xl:col-span-7 flex-col justify-between p-10 xl:p-14 bg-cover bg-center bg-[url('/login-bg.jpg')] text-white relative overflow-hidden font-sans">
        {/* Soft Light Overlay for Optimal Text Readability & Image Vibrancy */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/25 to-slate-950/35 z-0" />

        {/* Top Right Dot Grid Matrix */}
        <div className="absolute top-8 right-8 z-10 grid grid-cols-6 gap-2 opacity-25">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white" />
          ))}
        </div>

        {/* Top Header Badge */}
        <div className="relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-2xs font-semibold uppercase tracking-wider bg-slate-950/40 text-slate-200 border border-slate-700/50 backdrop-blur-sm">
            <Plane className="w-3.5 h-3.5 text-amber-400" />
            DGCA EXAMINATION &amp; ASSESSMENT PLATFORM
          </div>

          <div className="space-y-1.5">
            {/* Sleek Medium/Semibold Italic Title */}
            <div className="flex items-center tracking-tight font-semibold italic text-4xl sm:text-5xl text-white drop-shadow-sm">
              <span>AERO</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">
                VERSE
              </span>
            </div>

            {/* Refined Thin Tagline matching reference image */}
            <p className="text-2xs sm:text-xs font-medium italic text-amber-300/85 tracking-[0.35em] uppercase pt-0.5">
              ELEVATE. EXAMINE. EXCEL.
            </p>

            <p className="text-2xs sm:text-xs text-slate-300/85 leading-relaxed font-normal max-w-sm pt-2">
              A next-generation DGCA examination portal built for aspiring aviators. Experience real-world test simulations, intelligent analytics, and seamless performance tracking.
            </p>
          </div>
        </div>

        {/* 3 Refined Feature Highlight Blocks matching reference design */}
        <div className="relative z-10 my-4 space-y-3.5 max-w-md">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950/40 border border-slate-700/50 flex items-center justify-center shrink-0 text-amber-400 backdrop-blur-sm">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-white">DGCA-Aligned Examinations</h3>
              <p className="text-2xs sm:text-xs text-slate-300/75 mt-0.5 leading-normal max-w-xs">
                Precision-engineered tests matching DGCA standards across all subjects and modules.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950/40 border border-slate-700/50 flex items-center justify-center shrink-0 text-amber-400 backdrop-blur-sm">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-white">Smart Practice &amp; Prep</h3>
              <p className="text-2xs sm:text-xs text-slate-300/75 mt-0.5 leading-normal max-w-xs">
                Extensive subject banks, timed mocks, and topic-wise practice to master every concept.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950/40 border border-slate-700/50 flex items-center justify-center shrink-0 text-amber-400 backdrop-blur-sm">
              <BarChart3 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-white">Performance Intelligence</h3>
              <p className="text-2xs sm:text-xs text-slate-300/75 mt-0.5 leading-normal max-w-xs">
                Detailed analytics, accuracy insights, and leaderboards to track and elevate your performance.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Lock Pill Badge matching reference design */}
        <div className="relative z-10 pt-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-2xs font-medium text-slate-300 bg-slate-950/40 border border-slate-700/50 backdrop-blur-sm">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>High-Security &bull; Encrypted &bull; Reliable</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Sign In Card Container */}
      <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-slate-50 overflow-y-auto lg:overflow-hidden h-full">
        <div className="w-full max-w-md mx-auto my-auto space-y-6">
          {/* Logo Header */}
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/aviora-logo.png"
              alt="AVIORA AVIATION ACADEMY"
              className="h-32 mx-auto object-contain shrink-0"
            />
            <p className="text-xs font-bold tracking-wider text-gray-500 uppercase text-center mt-2">
              EXAM PORTAL SIGN IN
            </p>
          </div>

          {/* Floating White Card Container */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8 space-y-5">
            {/* Error Warning Banner */}
            {urlErrorMessage && (
              <div className="bg-amber-50/90 border border-amber-200 text-amber-900 text-xs rounded-xl p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{urlErrorMessage}</span>
              </div>
            )}

            {deviceBlocked && error ? (
              <div className="bg-amber-50/90 border border-amber-200 text-amber-900 text-xs rounded-xl p-3.5 flex items-start gap-2.5">
                <MonitorSmartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Device Not Registered</p>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-amber-50/90 border border-amber-200 text-amber-900 text-xs rounded-xl p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}

            {/* Login Form */}
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email-address" className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={loading}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm font-sans placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f4383] focus:border-[#0f4383] shadow-2xs transition-colors"
                    placeholder="student@aviora.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      disabled={loading}
                      className="w-full rounded-lg border border-gray-200 pl-3.5 pr-10 py-2.5 text-sm font-sans placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f4383] focus:border-[#0f4383] shadow-2xs transition-colors"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0a1e3f] via-[#0f2c59] to-[#0a1e3f] hover:from-[#071733] hover:via-[#0c234a] hover:to-[#071733] shadow-md hover:shadow-lg shadow-navy-950/25 transition-all duration-300 ease-out cursor-pointer disabled:opacity-50 overflow-hidden flex items-center justify-center hover:scale-[1.01]"
              >
                {/* Light Sweep Shimmer Flare Effect */}
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

                {loading ? (
                  <div className="flex items-center justify-center gap-2 relative z-10">
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-amber-400" />
                    <span>Taking Off...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2.5 relative z-10">
                    {/* Gold Horizontal Flight Plane Icon with Hover Slide & Click Takeoff to Right End */}
                    <Plane className="w-4.5 h-4.5 text-amber-400 shrink-0 transform rotate-45 group-hover:translate-x-2 group-active:translate-x-36 sm:group-active:translate-x-44 transition-transform duration-300 ease-out drop-shadow-2xs" />
                    <span className="font-semibold text-white tracking-wide">Take Off</span>
                  </div>
                )}
              </button>
            </form>

            <p className="text-2xs font-semibold text-gray-400 text-center pt-1">
              Having trouble? <a href="#" className="text-gray-500 hover:underline cursor-pointer">Contact your administrator</a>
            </p>
          </div>

          {/* Right Panel Attribution Footer (Properly Sized ZYXEN Logo) */}
          <div className="text-center space-y-1.5 pt-2">
            <p className="text-2xs font-bold text-gray-700">&copy; AVIORA &middot; Aviators Exam System</p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <span>Developed &amp; maintained by</span>
              <a
                href="https://zyxen.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bold text-gray-900 hover:text-[#0f4383] transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/zyxen-logo.jpeg"
                  alt="ZYXEN"
                  className="w-4 h-4 aspect-square object-contain bg-black p-0.5 rounded shrink-0"
                />
                <span className="font-extrabold text-xs">ZYXEN</span>
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
    <Suspense
      fallback={
        <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-amber-400 text-sm font-medium animate-pulse">Loading login portal...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

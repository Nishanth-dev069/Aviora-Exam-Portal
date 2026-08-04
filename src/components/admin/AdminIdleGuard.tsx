'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const IDLE_TIMEOUT_MS   = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS =  2 * 60 * 1000; // show warning 2 minutes before logout
const WARNING_AT_MS     = IDLE_TIMEOUT_MS - WARNING_BEFORE_MS; // 13 minutes

// Events that count as "user is active"
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

export function AdminIdleGuard() {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft]  = useState(120); // countdown during warning
  const lastActivityRef  = useRef<number>(Date.now());
  const warningTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggingOut     = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current)  clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current)   clearTimeout(logoutTimerRef.current);
    if (countdownRef.current)     clearInterval(countdownRef.current);
    warningTimerRef.current  = null;
    logoutTimerRef.current   = null;
    countdownRef.current     = null;
  }, []);

  const performLogout = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    clearAllTimers();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* best-effort */ }
    router.replace('/login?reason=inactivity_timeout');
  }, [router, clearAllTimers]);

  const scheduleTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    // At 13 minutes — show warning modal + start countdown
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(120);

      // Countdown tick every second
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // At 15 minutes — logout
      logoutTimerRef.current = setTimeout(() => {
        performLogout();
      }, WARNING_BEFORE_MS);
    }, WARNING_AT_MS);
  }, [clearAllTimers, performLogout]);

  const resetActivity = useCallback(() => {
    if (isLoggingOut.current) return;
    lastActivityRef.current = Date.now();
    if (showWarning) setShowWarning(false);
    scheduleTimers();
  }, [showWarning, scheduleTimers]);

  // Attach activity listeners
  useEffect(() => {
    scheduleTimers();

    const handleActivity = () => resetActivity();
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleActivity, { passive: true })
    );

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, handleActivity)
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!showWarning) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdown = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-border">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">Session Expiring Soon</h2>
            <p className="text-sm text-text-secondary mt-1">
              You&apos;ve been inactive. You&apos;ll be logged out automatically.
            </p>
          </div>
        </div>

        {/* Countdown */}
        <div className="px-6 py-8 flex flex-col items-center gap-4">
          <div className="text-5xl font-bold tabular-nums text-warning tracking-tight">
            {countdown}
          </div>
          <p className="text-sm text-text-muted text-center">
            Move your mouse or press any key to stay logged in.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={resetActivity}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
          >
            Stay Logged In
          </button>
          <button
            onClick={performLogout}
            className="flex-1 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            Log Out Now
          </button>
        </div>

      </div>
    </div>
  );
}

export default AdminIdleGuard;


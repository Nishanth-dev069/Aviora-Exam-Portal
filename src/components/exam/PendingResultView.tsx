'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Clock, ShieldCheck, ArrowLeft, RefreshCw, Calendar, FileText, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface PendingResultViewProps {
  examTitle: string;
  examSubject: string;
  submittedAt: string | null;
  endsAt: string;
  totalQuestions: number;
  serverTime?: string;
}

export default function PendingResultView({
  examTitle,
  examSubject,
  submittedAt,
  endsAt,
  totalQuestions,
  serverTime,
}: PendingResultViewProps) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const reloadTriggeredRef = useRef(false);

  // Compute clock offset between server and client
  const clockOffsetRef = useRef(0);
  useEffect(() => {
    if (serverTime) {
      const serverMs = new Date(serverTime).getTime();
      if (!isNaN(serverMs)) {
        clockOffsetRef.current = serverMs - Date.now();
      }
    }
  }, [serverTime]);

  useEffect(() => {
    const targetTime = new Date(endsAt).getTime();

    const calculateTimeLeft = () => {
      const currentServerTime = Date.now() + clockOffsetRef.current;
      const diff = targetTime - currentServerTime;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });

        // Trigger hard page reload to fetch released results from server
        if (!reloadTriggeredRef.current) {
          reloadTriggeredRef.current = true;
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        }
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  // Fallback: If timer already expired when loading, auto-retry reload every 3.5 seconds until server delivers results
  useEffect(() => {
    if (timeLeft.isExpired) {
      const retryTimer = setInterval(() => {
        window.location.reload();
      }, 3500);
      return () => clearInterval(retryTimer);
    }
  }, [timeLeft.isExpired]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    // Hard refresh to bypass client-side cache and force fresh server render
    window.location.reload();
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return (
      d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' at ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4 md:p-8 animate-in fade-in duration-500">
      {/* Top Bar */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-text-primary truncate max-w-xs sm:max-w-md">{examTitle}</h1>
            <p className="text-xs text-text-secondary">{examSubject}</p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto w-full my-auto py-8">
        <div className="bg-surface border border-border rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 text-center relative overflow-hidden">
          {/* Subtle decorative background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-primary/5 blur-3xl pointer-events-none rounded-full" />

          {/* Success Checkmark Icon */}
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-success/15 border-2 border-success/30 flex items-center justify-center text-success animate-in zoom-in-75 duration-500 shadow-lg shadow-success/10">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success/10 text-success border border-success/20">
                ● Exam Submitted Successfully
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
                Your Answers are Saved
              </h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Your submission has been securely recorded and evaluated in our database.
              </p>
            </div>
          </div>

          {/* Release Countdown Box */}
          <div className="bg-surface-2/80 border border-primary/20 rounded-2xl p-6 relative overflow-hidden shadow-inner">
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-3">
              <Clock className="w-4 h-4 animate-pulse" />
              {timeLeft.isExpired ? 'Publishing Results...' : 'Results & Answer Review Release In'}
            </div>

            {timeLeft.isExpired ? (
              <div className="py-4 space-y-2">
                <div className="flex items-center justify-center gap-2.5 text-base sm:text-lg font-bold text-primary animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  Exam window has concluded. Unlocking results...
                </div>
                <p className="text-xs text-text-muted">
                  Refreshing screen to load your score summary and answer review.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto text-center">
                <div className="bg-surface border border-border rounded-xl p-3 shadow-xs">
                  <div className="text-2xl sm:text-3xl font-black text-text-primary font-mono">
                    {String(timeLeft.hours).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-text-muted mt-0.5">Hours</div>
                </div>
                <div className="bg-surface border border-border rounded-xl p-3 shadow-xs">
                  <div className="text-2xl sm:text-3xl font-black text-text-primary font-mono">
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-text-muted mt-0.5">Mins</div>
                </div>
                <div className="bg-surface border border-border rounded-xl p-3 shadow-xs">
                  <div className="text-2xl sm:text-3xl font-black text-text-primary font-mono">
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-text-muted mt-0.5">Secs</div>
                </div>
              </div>
            )}

            <p className="text-xs text-text-secondary mt-4 font-medium">
              Official release scheduled for:{' '}
              <strong className="text-text-primary font-bold">{formatDateTime(endsAt)}</strong>
            </p>
          </div>

          {/* Submission Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div className="bg-surface-2 p-4 rounded-xl border border-border flex items-center gap-3">
              <Calendar className="w-5 h-5 text-text-muted shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-text-muted uppercase">Submitted At</div>
                <div className="text-xs font-bold text-text-primary truncate">
                  {formatDateTime(submittedAt)}
                </div>
              </div>
            </div>

            <div className="bg-surface-2 p-4 rounded-xl border border-border flex items-center gap-3">
              <FileText className="w-5 h-5 text-text-muted shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-text-muted uppercase">Questions Completed</div>
                <div className="text-xs font-bold text-text-primary">
                  {totalQuestions} Questions Evaluated
                </div>
              </div>
            </div>
          </div>

          {/* Security & Integrity Note */}
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-left flex items-start gap-3.5">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed text-text-secondary">
              <span className="font-bold text-text-primary block">Exam Integrity Protection</span>
              To ensure fairness for all candidates, question explanations, correct answers, total scores, and batch rankings are released simultaneously once the exam window strictly closes.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto px-6 py-3 bg-surface-2 hover:bg-border text-text-primary font-bold text-xs rounded-xl border border-border transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Checking Server...' : 'Check If Released'}
            </button>

            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2"
            >
              Back to Student Dashboard →
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 text-xs text-text-muted">
        Aviora Exam Portal · Secure Examination Delivery Engine
      </footer>
    </div>
  );
}

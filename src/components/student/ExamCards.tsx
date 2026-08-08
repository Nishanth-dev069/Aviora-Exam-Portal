'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, Timer, Clock, Calendar, FileText, AlertCircle, PlayCircle, RotateCcw, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ExamCountdown({ scheduledAt }: { scheduledAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(scheduledAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Starting soon...');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [scheduledAt]);

  return <span className="font-mono">Starts in {timeLeft}</span>;
}

export function formatCountdown(scheduledAt: Date): string {
  const diff = scheduledAt.getTime() - Date.now();
  if (diff <= 0) return 'Starting now';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${mins}m`;
  return `Starts in ${mins} min`;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) + 
         ' at ' + 
         d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function getScheduledExamStatus(exam: any, studentEntry: any): 'completed' | 'submitted_pending' | 'in_progress' | 'missed' | 'open' | 'closed' | 'upcoming' {
  const now = new Date();
  const scheduledAt = exam.scheduled_at ? new Date(exam.scheduled_at) : null;
  const endsAt = exam.ends_at ? new Date(exam.ends_at) : null;

  if (studentEntry?.sessionStatus === 'submitted') {
    if (endsAt && now < endsAt && exam.status !== 'completed') {
      return 'submitted_pending';
    }
    return 'completed';
  }

  if (studentEntry?.sessionStatus === 'active') {
    return 'in_progress';
  }

  if (exam.status === 'completed') {
    return 'missed';
  }

  if (endsAt && now > endsAt) {
    return 'closed';
  }

  if (exam.is_available === true) {
    return 'open';
  }

  if (scheduledAt && now >= scheduledAt && (!endsAt || now <= endsAt)) {
    return 'open';
  }

  if (scheduledAt && now < scheduledAt) {
    return 'upcoming';
  }

  if (exam.status === 'active') {
    return 'open';
  }

  return 'upcoming';
}

export function ScheduledExamCard({ exam, studentEntry }: { exam: any; studentEntry: any }) {
  const status = getScheduledExamStatus(exam, studentEntry);
  const result = studentEntry?.result;

  if (status === 'submitted_pending') {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-primary/30 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
              <Clock className="w-3.5 h-3.5" /> Submitted · Results Pending
            </span>
            <h3 className="text-lg font-bold text-text-primary">{exam.title}</h3>
          </div>
          <p className="text-sm text-text-secondary">{exam.subject} · {exam.duration_minutes} min · {exam.total_questions} Qs</p>
          <p className="text-xs text-text-muted">
            Exam submitted. Detailed score summary, answer review, and leaderboard will be released at {formatDate(exam.ends_at)}.
          </p>
        </div>

        <div>
          {studentEntry?.sessionId && (
            <Link
              href={`/exam/result/${studentEntry.sessionId}`}
              className="px-5 py-2.5 bg-surface border border-border hover:border-primary text-text-primary hover:text-primary font-bold rounded-xl hover:bg-surface-2 transition-colors inline-flex items-center gap-2 text-sm shadow-sm"
            >
              <Eye className="w-4 h-4" /> View Submission →
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-success/30 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/10 text-success">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </span>
            <h3 className="text-lg font-bold text-text-primary">{exam.title}</h3>
          </div>
          <p className="text-sm text-text-secondary">{exam.subject} · {exam.duration_minutes} min · {exam.total_questions} Qs</p>
          
          {result && (
            <div className="mt-3 inline-flex items-center gap-4 bg-surface-2 px-4 py-2 rounded-lg border border-border text-sm">
              <div>
                <span className="text-xs text-text-muted uppercase font-bold block">Score</span>
                <span className="font-bold text-primary text-base">{Math.round(result.percentage)}%</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="text-success font-bold">✓ {result.correct_count || 0} correct</span>
                <span className="text-danger font-bold">✗ {result.incorrect_count || 0} wrong</span>
              </div>
            </div>
          )}
        </div>

        <div>
          {studentEntry?.sessionId ? (
            <Link
              href={`/exam/result/${studentEntry.sessionId}`}
              className="px-5 py-2.5 bg-surface border border-primary text-primary font-bold rounded-xl hover:bg-primary/5 transition-colors inline-flex items-center gap-2 text-sm shadow-sm"
            >
              <Eye className="w-4 h-4" /> View Result →
            </Link>
          ) : (
            <span className="text-xs text-text-muted italic">Result pending</span>
          )}
        </div>
      </div>
    );
  }

  if (status === 'in_progress') {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-primary/40 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary animate-pulse">
              <Timer className="w-3.5 h-3.5" /> In Progress
            </span>
            <h3 className="text-lg font-bold text-text-primary">{exam.title}</h3>
          </div>
          <p className="text-sm text-text-secondary">{exam.subject} · {exam.duration_minutes} min · {exam.total_questions} Qs</p>
          <p className="text-xs font-medium text-warning">
            ⏱ You have an active exam session. Resume to continue your exam.
          </p>
        </div>

        <div>
          <a
            href={`/exam/${exam.id}/start`}
            className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-2 text-sm shadow-md shadow-primary/25"
          >
            Resume Exam →
          </a>
        </div>
      </div>
    );
  }

  if (status === 'open') {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-success/40 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-md">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success text-white">
              🟢 LIVE NOW
            </span>
            <h3 className="text-lg font-bold text-text-primary">{exam.title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
            <span className="flex items-center gap-1.5 font-medium text-text-primary">
              <Calendar className="h-4 w-4 text-primary" />
              Ends: {formatDate(exam.ends_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-text-muted" />
              {exam.duration_minutes} mins
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-text-muted" />
              {exam.total_questions} Qs
            </span>
          </div>
        </div>

        <div>
          <a
            href={`/exam/${exam.id}/start`}
            className="px-6 py-2.5 bg-success text-white font-bold rounded-xl hover:bg-success/90 transition-colors inline-flex items-center gap-2 text-sm shadow-md shadow-success/25"
          >
            <PlayCircle className="w-4 h-4" /> Start Exam →
          </a>
        </div>
      </div>
    );
  }

  if (status === 'missed' || status === 'closed') {
    return (
      <div className="bg-surface/60 rounded-xl border border-border p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-75">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-text-muted/10 text-text-muted">
              ⭕ MISSED
            </span>
            <h3 className="text-lg font-bold text-text-primary">{exam.title}</h3>
          </div>
          <p className="text-sm text-text-secondary">{exam.subject} · {exam.duration_minutes} min · {exam.total_questions} Qs</p>
          <p className="text-xs text-text-muted">Exam window has closed.</p>
        </div>

        <div>
          <button
            disabled
            className="px-5 py-2.5 bg-surface-2 text-text-muted font-bold rounded-xl text-sm border border-border cursor-not-allowed"
          >
            Contact Admin
          </button>
        </div>
      </div>
    );
  }

  // Default: Upcoming
  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning/10 text-warning">
            <Clock className="w-3.5 h-3.5" /> {exam.scheduled_at ? <ExamCountdown scheduledAt={exam.scheduled_at} /> : 'Upcoming'}
          </span>
          <h3 className="text-lg font-bold text-text-primary">{exam.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-text-muted" />
            Scheduled: {formatDate(exam.scheduled_at)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-text-muted" />
            {exam.duration_minutes} mins
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-text-muted" />
            {exam.total_questions} Qs
          </span>
        </div>
      </div>

      <div>
        <button
          disabled
          className="px-6 py-2.5 bg-surface-2 text-text-muted font-bold rounded-xl text-sm border border-border cursor-not-allowed"
        >
          {exam.scheduled_at ? <ExamCountdown scheduledAt={exam.scheduled_at} /> : 'Upcoming'}
        </button>
      </div>
    </div>
  );
}

export function PracticeExamCard({ exam, statusEntry }: { exam: any; statusEntry: any }) {
  const isCompleted = statusEntry?.sessionStatus === 'submitted';
  const isInProgress = statusEntry?.sessionStatus === 'active';
  const result = statusEntry?.result;

  if (isCompleted && result) {
    return (
      <div className="relative rounded-xl border border-success/30 bg-success/5 p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between">
        <div>
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </div>

          <h3 className="pr-20 text-base font-bold text-text-primary line-clamp-1" title={exam.title}>{exam.title}</h3>
          <p className="mt-0.5 text-xs font-medium text-text-secondary">{exam.subject}</p>
          <p className="mt-1 text-xs text-text-muted">
            {exam.total_questions} Qs · {exam.duration_minutes} min
          </p>

          <div className="mt-3 flex items-center gap-3 rounded-lg bg-surface px-3 py-2 border border-success/20 shadow-inner">
            <div className="text-center">
              <p className="text-lg font-black text-success">{Math.round(result.percentage)}%</p>
              <p className="text-[10px] uppercase font-bold text-text-muted">{exam.type === 'practice' ? 'Max Score' : 'Score'}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col gap-0.5 text-xs font-semibold">
              <span className="text-success">✓ {result.correct_count || 0} correct</span>
              <span className="text-danger">✗ {result.incorrect_count || 0} wrong</span>
            </div>
          </div>

          {/* Progress bar visual */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-success transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, result.percentage))}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {statusEntry?.sessionId && (
            <Link
              href={`/exam/result/${statusEntry.sessionId}`}
              className="flex-1 rounded-lg border border-success/40 bg-surface px-2.5 py-2 text-center text-xs font-bold text-success hover:bg-success/10 transition-colors inline-flex items-center justify-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" /> View Result
            </Link>
          )}
          {exam.type === 'practice' && (
            <a
              href={`/exam/${exam.id}/start`}
              className="flex-1 rounded-lg bg-surface-2 border border-border px-2.5 py-2 text-center text-xs font-bold text-text-primary hover:bg-border transition-colors inline-flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retake
            </a>
          )}
        </div>
      </div>
    );
  }

  if (isInProgress) {
    return (
      <div className="relative rounded-xl border border-primary/40 bg-primary/5 p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between">
        <div>
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary animate-pulse">
            <Timer className="h-3.5 w-3.5" /> In Progress
          </div>

          <h3 className="pr-20 text-base font-bold text-text-primary line-clamp-1" title={exam.title}>{exam.title}</h3>
          <p className="mt-0.5 text-xs font-medium text-text-secondary">{exam.subject}</p>
          <p className="mt-2 text-xs font-medium text-warning flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Active session found. Resume to continue.
          </p>
        </div>

        <a
          href={`/exam/${exam.id}/start`}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-primary-hover transition-colors shadow-md shadow-primary/20"
        >
          Resume Exam →
        </a>
      </div>
    );
  }

  // Default: Not started
  return (
    <div className="relative rounded-xl border border-border bg-surface p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-text-primary line-clamp-1" title={exam.title}>{exam.title}</h3>
        <p className="mt-0.5 text-xs font-medium text-text-secondary">{exam.subject}</p>
        <p className="mt-1 text-xs text-text-muted">
          {exam.total_questions} Qs · {exam.duration_minutes} min
          {Number(exam.negative_marks) > 0 && ` · -${exam.negative_marks} negative`}
        </p>
      </div>

      <a
        href={`/exam/${exam.id}/start`}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-primary-hover transition-colors shadow-md shadow-primary/20 flex items-center justify-center gap-1"
      >
        <PlayCircle className="w-4 h-4" /> Start Exam →
      </a>
    </div>
  );
}

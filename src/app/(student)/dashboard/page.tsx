/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, FileText, ChevronRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScheduledExamCard, PracticeExamCard, formatDate } from '@/components/student/ExamCards';
import { Skeleton, CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

interface DashboardData {
  serverTime?: string;
  profile: {
    id?: string;
    full_name: string;
    roll_number: string;
    photo_url: string | null;
    batch_name: string | null;
  };
  practiceExams: any[];
  scheduledExams: any[];
  recentResults: Array<{
    id: string;
    session_id: string;
    exam_id: string;
    percentage: number;
    total_score: number;
    max_score: number;
    correct_count?: number;
    incorrect_count?: number;
    is_passed: boolean | null;
    computed_at: string;
    exams?: {
      id: string;
      title: string;
      subject: string;
      type: string;
    };
  }>;
  examStatusMap: Record<string, any>;
}

export default function StudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const prevExamAvailability = useRef<Map<string, boolean>>(new Map());

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const res = await fetch('/api/student/dashboard', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const freshData: DashboardData = await res.json();

      // Check if any exam became available
      let newlyAvailableExam: any = null;
      freshData.scheduledExams?.forEach((exam) => {
        const isNowAvailable = exam.is_available === true;
        const wasAvailable = prevExamAvailability.current.get(exam.id) ?? false;

        if (isNowAvailable && !wasAvailable) {
          newlyAvailableExam = exam;
        }

        prevExamAvailability.current.set(exam.id, isNowAvailable);
      });

      setData(freshData);
      setError(null);

      if (newlyAvailableExam) {
        setToastMessage(`📝 Exam "${newlyAvailableExam.title}" is now available to start!`);
        setTimeout(() => setToastMessage(null), 10000);
      }
    } catch {
      if (!silent) setError('Could not load dashboard data.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // Standard polling (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Urgent polling (every 10 seconds) if an exam is scheduled to start within 5 minutes
  useEffect(() => {
    if (!data?.scheduledExams) return;

    const hasImminentExam = data.scheduledExams.some((exam) => {
      if (exam.is_available || !exam.scheduled_at) return false;
      const minutesUntilStart = (new Date(exam.scheduled_at).getTime() - Date.now()) / 60000;
      return minutesUntilStart <= 5 && minutesUntilStart > 0;
    });

    if (!hasImminentExam) return;

    const urgentInterval = setInterval(() => {
      fetchDashboardData(true);
    }, 10000);

    return () => clearInterval(urgentInterval);
  }, [data?.scheduledExams, fetchDashboardData]);

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 pb-12 animate-pulse">
        {/* Banner Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-6 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
          <Skeleton className="h-8 w-32 rounded-full self-start sm:self-center" />
        </div>

        {/* Scheduled Exams Section Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>

        {/* Practice Exams Section Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-44 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>

        {/* Recent Results Section Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <TableSkeleton rows={3} cols={4} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="p-6 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center gap-3 font-bold">
          <AlertCircle className="h-5 w-5" />
          <p>{error || 'Failed to load dashboard'}</p>
        </div>
      </div>
    );
  }

  const { profile, practiceExams, scheduledExams, recentResults, examStatusMap } = data;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 pb-12 animate-in fade-in duration-300 relative">
      {/* Toast notification for newly active exam */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-6 py-3 rounded-xl shadow-xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 border border-white/20">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-4 hover:opacity-80 text-sm">✕</button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">
            Welcome back, {profile?.full_name || 'Student'}
          </h1>
          {profile?.batch_name && (
            <p className="text-sm font-medium text-text-secondary mt-1">
              Batch: <span className="text-primary font-bold">{profile.batch_name}</span>
            </p>
          )}
        </div>
        {profile?.roll_number && profile.roll_number !== 'Unassigned' && (
          <div className="text-xs font-bold text-text-secondary bg-surface-2 border border-border px-3.5 py-2 rounded-full self-start sm:self-center">
            Roll No: <span className="text-text-primary">{profile.roll_number}</span>
          </div>
        )}
      </div>

      {/* Scheduled Exams Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Scheduled Exams
          </h2>
          <Link href="/exams/scheduled" className="text-xs font-bold text-primary hover:underline">
            View All →
          </Link>
        </div>

        {scheduledExams.length === 0 ? (
          <div className="bg-surface rounded-xl p-6 text-center text-text-muted border border-border border-dashed">
            <p className="text-sm font-medium">No upcoming exams scheduled</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scheduledExams.slice(0, 3).map((exam) => (
              <ScheduledExamCard
                key={exam.id}
                exam={exam}
                studentEntry={examStatusMap[exam.id]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Practice Exams Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase flex items-center gap-1.5">
            <span>Practice Exams</span>
            <span className="text-[11px] font-semibold text-text-muted normal-case">
              ({practiceExams.length} available)
            </span>
          </h2>
          <Link href="/exams/practice" className="text-xs font-bold text-primary hover:underline">
            View All →
          </Link>
        </div>

        {practiceExams.length === 0 ? (
          <div className="bg-surface rounded-xl p-6 text-center text-text-muted border border-border border-dashed">
            No practice exams available yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {practiceExams.slice(0, 4).map((exam) => (
              <PracticeExamCard
                key={exam.id}
                exam={exam}
                statusEntry={examStatusMap[exam.id]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Results Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Recent Results
          </h2>
          <Link href="/results" className="text-xs font-bold text-primary hover:underline">
            View All →
          </Link>
        </div>

        {recentResults.length === 0 ? (
          <div className="bg-surface rounded-xl p-8 text-center text-text-muted border border-border border-dashed flex flex-col items-center">
            <FileText className="w-8 h-8 opacity-30 mb-2" />
            <p className="text-sm font-medium">
              No exam results yet. Take your first exam to see results here.
            </p>
          </div>
        ) : (
          <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden divide-y divide-border">
            {recentResults.map((result) => {
              const exam = Array.isArray(result.exams) ? result.exams[0] : result.exams;
              const isPassed = result.is_passed;
              const pct = Math.round(result.percentage || 0);

              return (
                <div
                  key={result.id || result.session_id}
                  className="p-4 sm:px-6 hover:bg-surface-2/50 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text-primary truncate">
                      {exam?.title || 'Exam'}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {exam?.type === 'practice' ? 'Practice' : 'Scheduled Exam'} · {formatDate(result.computed_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-text-muted font-medium">Score</div>
                      <div className="text-sm font-bold text-text-primary">
                        {result.total_score} / {result.max_score}
                      </div>
                    </div>

                    <div className="w-16 text-right">
                      <span
                        className={cn(
                          'text-lg font-black',
                          pct >= 70 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger'
                        )}
                      >
                        {pct}%
                      </span>
                    </div>

                    <div className="hidden sm:block">
                      {isPassed === true && <Badge variant="success">Passed</Badge>}
                      {isPassed === false && <Badge variant="danger">Failed</Badge>}
                      {isPassed === null && <Badge variant="default">N/A</Badge>}
                    </div>

                    {result.session_id ? (
                      <Link
                        href={`/exam/result/${result.session_id}`}
                        className="rounded-lg bg-surface-2 hover:bg-border px-3 py-1.5 text-xs font-bold text-text-primary transition-colors inline-flex items-center gap-1 border border-border"
                      >
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <span className="text-xs text-text-muted italic">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Calendar, BookOpen } from 'lucide-react';
import { ScheduledExamCard, PracticeExamCard } from '@/components/student/ExamCards';

interface ExamsData {
  practiceExams: any[];
  scheduledExams: any[];
  examStatusMap: Record<string, any>;
}

export default function StudentExamsPage() {
  const [data, setData] = useState<ExamsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await fetch('/api/student/exams');
        if (!res.ok) throw new Error('Failed to load exams');
        const json = await res.json();
        setData(json);
      } catch {
        setError('Failed to load exams. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-8 max-w-7xl mx-auto p-4 md:p-8">
        <div className="h-10 bg-surface rounded-lg w-64"></div>
        <div className="space-y-4">
          <div className="h-28 bg-surface rounded-xl"></div>
          <div className="h-28 bg-surface rounded-xl"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-36 bg-surface rounded-xl"></div>
          <div className="h-36 bg-surface rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="p-6 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center gap-3 font-bold">
          <AlertCircle className="h-6 w-6" />
          {error || 'Failed to load exams'}
        </div>
      </div>
    );
  }

  const { practiceExams, scheduledExams, examStatusMap } = data;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 animate-in fade-in duration-300 pb-12">
      
      <div>
        <h1 className="text-3xl font-black text-text-primary tracking-tight">My Exams</h1>
        <p className="text-text-secondary mt-1">Overview of your upcoming scheduled exams and practice papers.</p>
      </div>

      {/* Scheduled Exams Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Scheduled Exams
            <span className="text-[11px] font-semibold text-text-muted normal-case">
              ({scheduledExams.length} enrolled)
            </span>
          </h2>
          {scheduledExams.length > 0 && (
            <Link href="/exams/scheduled" className="text-xs font-bold text-primary hover:underline">
              View All Scheduled Exams ({scheduledExams.length}) →
            </Link>
          )}
        </div>

        {scheduledExams.length === 0 ? (
          <div className="bg-surface rounded-xl p-8 text-center text-text-muted border border-border border-dashed">
            You are not enrolled in any upcoming scheduled exams.
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
          <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Practice Exams
            <span className="text-[11px] font-semibold text-text-muted normal-case">
              ({practiceExams.length} available)
            </span>
          </h2>
          {practiceExams.length > 0 && (
            <Link href="/exams/practice" className="text-xs font-bold text-primary hover:underline">
              View All Practice Exams ({practiceExams.length}) →
            </Link>
          )}
        </div>

        {practiceExams.length === 0 ? (
          <div className="bg-surface rounded-xl p-8 text-center text-text-muted border border-border border-dashed">
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

    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AlertCircle, Calendar, BookOpen, Layers, Compass, Cloud, FileText, Cpu, CheckCircle } from 'lucide-react';
import { ScheduledExamCard, PracticeExamCard } from '@/components/student/ExamCards';
import { CardSkeleton } from '@/components/ui/Skeleton';

interface ExamsData {
  practiceExams: any[];
  scheduledExams: any[];
  examStatusMap: Record<string, any>;
}

const getSubjectIcon = (subjectName: string) => {
  const lower = subjectName.toLowerCase();
  if (lower.includes('nav')) return <Compass className="w-4 h-4 text-primary shrink-0" />;
  if (lower.includes('met') || lower.includes('weather')) return <Cloud className="w-4 h-4 text-sky-500 shrink-0" />;
  if (lower.includes('reg') || lower.includes('law')) return <FileText className="w-4 h-4 text-amber-500 shrink-0" />;
  if (lower.includes('tech') || lower.includes('sys')) return <Cpu className="w-4 h-4 text-indigo-500 shrink-0" />;
  return <Layers className="w-4 h-4 text-primary shrink-0" />;
};

export default function StudentExamsPage() {
  const [data, setData] = useState<ExamsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');

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

  const subjects = useMemo(() => {
    if (!data?.practiceExams) return [];
    const set = new Set<string>();
    data.practiceExams.forEach((e) => {
      if (e.subject?.trim()) set.add(e.subject.trim());
    });
    return Array.from(set).sort();
  }, [data?.practiceExams]);

  const practiceExamsBySubject = useMemo(() => {
    if (!data?.practiceExams) return {};
    const grouped: Record<string, any[]> = {};
    data.practiceExams.forEach((e) => {
      const subj = e.subject?.trim() || 'General';
      if (!grouped[subj]) grouped[subj] = [];
      grouped[subj].push(e);
    });
    return grouped;
  }, [data?.practiceExams]);

  if (error && !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="p-6 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center gap-3 font-bold">
          <AlertCircle className="h-6 w-6" />
          {error || 'Failed to load exams'}
        </div>
      </div>
    );
  }

  const { practiceExams = [], scheduledExams = [], examStatusMap = {} } = data || {};

  const displaySubjects = selectedSubject === 'ALL'
    ? Object.keys(practiceExamsBySubject)
    : [selectedSubject];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 animate-in fade-in duration-300 pb-12">
      
      <div>
        <h1 className="text-3xl font-black text-text-primary tracking-tight">My Exams</h1>
        <p className="text-text-secondary mt-1">Overview of your upcoming scheduled exams and subject-wise practice tests.</p>
      </div>

      {/* Scheduled Exams Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Scheduled Exams
            {scheduledExams.length > 0 && (
              <span className="text-[11px] font-semibold text-text-muted normal-case">
                ({scheduledExams.length} enrolled)
              </span>
            )}
          </h2>
          {scheduledExams.length > 0 && (
            <Link href="/exams/scheduled" className="text-xs font-bold text-primary hover:underline">
              View All Scheduled Exams ({scheduledExams.length}) →
            </Link>
          )}
        </div>

        {loading && !data ? (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : scheduledExams.length === 0 ? (
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

      {/* Practice Exams Categorized by Subject Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Practice Exams by Subject
            <span className="text-[11px] font-semibold text-text-muted normal-case">
              ({practiceExams.length} tests available)
            </span>
          </h2>
          {practiceExams.length > 0 && (
            <Link href="/exams/practice" className="text-xs font-bold text-primary hover:underline">
              View All Practice Exams ({practiceExams.length}) →
            </Link>
          )}
        </div>

        {/* Subject Category Pills / Tabs */}
        {subjects.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <button
              onClick={() => setSelectedSubject('ALL')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                selectedSubject === 'ALL'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              All Subjects ({practiceExams.length})
            </button>
            {subjects.map((subj) => {
              const count = practiceExamsBySubject[subj]?.length || 0;
              const isSelected = selectedSubject === subj;
              return (
                <button
                  key={subj}
                  onClick={() => setSelectedSubject(subj)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2'
                  }`}
                >
                  {getSubjectIcon(subj)}
                  {subj} ({count})
                </button>
              );
            })}
          </div>
        )}

        {loading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : practiceExams.length === 0 ? (
          <div className="bg-surface rounded-xl p-8 text-center text-text-muted border border-border border-dashed">
            No practice exams available yet. Check back soon.
          </div>
        ) : (
          <div className="space-y-8">
            {displaySubjects.map((subj) => {
              const tests = practiceExamsBySubject[subj] || [];
              if (tests.length === 0) return null;
              return (
                <div key={subj} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border/80 pb-2.5">
                    {getSubjectIcon(subj)}
                    <h3 className="text-sm font-black text-text-primary tracking-tight">{subj}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                      {tests.length} {tests.length === 1 ? 'Test' : 'Tests'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {tests.map((exam) => (
                      <PracticeExamCard
                        key={exam.id}
                        exam={exam}
                        statusEntry={examStatusMap[exam.id]}
                      />
                    ))}
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

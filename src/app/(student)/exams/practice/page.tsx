/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronLeft, BookOpen, Layers, Compass, Cloud, FileText, Cpu } from 'lucide-react';
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';
import { PracticeExamCard } from '@/components/student/ExamCards';
import { Input } from '@/components/ui/Input';

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

export default function PracticeExamsPage() {
  const [data, setData] = useState<ExamsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await fetch('/api/student/exams');
        if (!res.ok) throw new Error('Failed to load exams');
        const json = await res.json();
        setData(json);
      } catch {
        setError('Failed to load practice exams. Please try refreshing.');
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

  const filteredExams = useMemo(() => {
    if (!data?.practiceExams) return [];
    return data.practiceExams.filter((exam) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        exam.title?.toLowerCase().includes(q) ||
        exam.subject?.toLowerCase().includes(q)
      );
      const matchesSubject = selectedSubject === 'ALL' || (exam.subject?.trim() || 'General') === selectedSubject;
      return matchesSearch && matchesSubject;
    });
  }, [data?.practiceExams, searchQuery, selectedSubject]);

  const examsBySubject = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filteredExams.forEach((e) => {
      const subj = e.subject?.trim() || 'General';
      if (!grouped[subj]) grouped[subj] = [];
      grouped[subj].push(e);
    });
    return grouped;
  }, [filteredExams]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-pulse">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-9 w-64 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="p-6 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center gap-3 font-bold">
          <AlertCircle className="h-6 w-6" />
          {error || 'Failed to load practice exams'}
        </div>
      </div>
    );
  }

  const { practiceExams, examStatusMap } = data;
  const displaySubjects = Object.keys(examsBySubject);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-300 pb-12">
      <div>
        <Link
          href="/exams"
          className="inline-flex items-center text-xs font-bold text-text-muted hover:text-primary transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4 mr-0.5" /> Back to My Exams Overview
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-text-primary tracking-tight flex items-center gap-2.5">
              <BookOpen className="w-7 h-7 text-primary shrink-0" />
              Practice Exams by Subject
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Select a subject to take practice papers and test your knowledge.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Subject Filter Pills */}
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
            const count = practiceExams.filter(e => (e.subject?.trim() || 'General') === subj).length;
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

      {/* Subject Grouped Sections */}
      <section className="space-y-8">
        {filteredExams.length === 0 ? (
          <div className="bg-surface rounded-xl p-12 text-center text-text-muted border border-border border-dashed">
            <p className="font-medium">
              {searchQuery || selectedSubject !== 'ALL'
                ? 'No practice exams match your selected filter or search.'
                : 'No practice exams available yet.'}
            </p>
          </div>
        ) : (
          displaySubjects.map((subj) => {
            const tests = examsBySubject[subj] || [];
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
          })
        )}
      </section>
    </div>
  );
}

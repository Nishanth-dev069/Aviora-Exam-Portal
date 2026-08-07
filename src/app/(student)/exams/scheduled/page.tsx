'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronLeft, Calendar, Search } from 'lucide-react';
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';
import { ScheduledExamCard } from '@/components/student/ExamCards';
import { Input } from '@/components/ui/Input';

interface ExamsData {
  practiceExams: any[];
  scheduledExams: any[];
  examStatusMap: Record<string, any>;
}

export default function ScheduledExamsPage() {
  const [data, setData] = useState<ExamsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await fetch('/api/student/exams');
        if (!res.ok) throw new Error('Failed to load exams');
        const json = await res.json();
        setData(json);
      } catch {
        setError('Failed to load scheduled exams. Please try refreshing.');
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  if (error && !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="p-6 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center gap-3 font-bold">
          <AlertCircle className="h-6 w-6" />
          {error || 'Failed to load scheduled exams'}
        </div>
      </div>
    );
  }

  const { scheduledExams = [], examStatusMap = {} } = data || {};

  const filteredExams = scheduledExams.filter((exam) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      exam.title?.toLowerCase().includes(q) ||
      exam.subject?.toLowerCase().includes(q)
    );
  });

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
              <Calendar className="w-7 h-7 text-primary shrink-0" />
              Scheduled Exams
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              All official scheduled examinations assigned to your batch.
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

      <section className="space-y-4">
        {loading && !data ? (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="bg-surface rounded-xl p-12 text-center text-text-muted border border-border border-dashed">
            <p className="font-medium">
              {searchQuery ? 'No scheduled exams match your search.' : 'You have no scheduled exams at this time.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExams.map((exam) => (
              <ScheduledExamCard
                key={exam.id}
                exam={exam}
                studentEntry={examStatusMap[exam.id]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

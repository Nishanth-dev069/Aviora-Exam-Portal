'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight, Layers, CheckCircle2 } from 'lucide-react';
import type { LearningSubject } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';


const SUBJECT_ICONS: Record<string, string> = {
  'Air Law': '✈️',
  'Meteorology': '🌤️',
  'Navigation': '🧭',
  'Principles of Flight': '🛫',
  'Human Performance': '🧬',
  'General Navigation': '🗺️',
  'Radio Navigation': '📡',
  'Flight Planning': '📋',
  'Mass and Balance': '⚖️',
  'Aircraft General Knowledge': '🛠️',
  'Operational Procedures': '📑',
  'Communications': '📻',
};

interface SubjectGridProps {
  subjects: LearningSubject[];
  loading?: boolean;
}

export default function SubjectGrid({ subjects, loading = false }: SubjectGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-6 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="bg-surface border border-border border-dashed rounded-2xl p-12 text-center text-text-muted space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto text-2xl">
          📚
        </div>
        <h3 className="text-base font-bold text-text-primary">No Study Subjects Available</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          There are currently no question banks published for study. Please check back later or contact your instructor.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {subjects.map((item) => {
        const icon = SUBJECT_ICONS[item.subject] ?? '📚';
        const completedCount = item.completed_chapters_count || 0;
        const totalChapters = item.chapter_count;
        const percent = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;
        const isAllCompleted = totalChapters > 0 && completedCount === totalChapters;

        return (
          <Link
            key={item.subject}
            href={`/learn/${encodeURIComponent(item.subject)}`}
            className="group bg-surface border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  {icon}
                </div>
                {isAllCompleted ? (
                  <span className="text-xs font-bold text-success bg-success/10 border border-success/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed
                  </span>
                ) : (
                  <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {item.chapter_count} {item.chapter_count === 1 ? 'chapter' : 'chapters'}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors">
                {item.subject}
              </h3>
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{item.total_questions} total practice questions</span>
              </p>

              {/* Progress bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary">
                  <span>Progress</span>
                  <span className={completedCount > 0 ? "text-primary" : "text-text-muted"}>
                    {completedCount}/{totalChapters} Chapters ({percent}%)
                  </span>
                </div>
                <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden border border-border/50">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isAllCompleted ? "bg-success" : "bg-primary"
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">
              <span>{isAllCompleted ? 'Review Chapters' : 'Study Chapters'}</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight, HelpCircle, CheckCircle2, RotateCcw, Trophy } from 'lucide-react';
import type { LearningChapter } from '@/types';
import { cn } from '@/lib/utils';

interface ChapterListProps {
  chapters: LearningChapter[];
  subject: string;
}

export default function ChapterList({ chapters, subject }: ChapterListProps) {
  if (chapters.length === 0) {
    return (
      <div className="bg-surface border border-border border-dashed rounded-2xl p-12 text-center text-text-muted space-y-3">
        <HelpCircle className="w-10 h-10 mx-auto text-text-muted opacity-40" />
        <h3 className="text-base font-bold text-text-primary">No Chapters Found</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          No learning chapters with questions are available for {subject} right now.
        </p>
      </div>
    );
  }

  const completedChaptersCount = chapters.filter((c) => c.is_completed).length;
  const totalChaptersCount = chapters.length;
  const totalQuestions = chapters.reduce((sum, c) => sum + c.question_count, 0);
  const percent = totalChaptersCount > 0 ? Math.round((completedChaptersCount / totalChaptersCount) * 100) : 0;
  const isAllCompleted = totalChaptersCount > 0 && completedChaptersCount === totalChaptersCount;

  return (
    <div className="space-y-6">
      {/* Subject Progress Banner */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAllCompleted ? (
              <Trophy className="w-5 h-5 text-warning" />
            ) : (
              <BookOpen className="w-5 h-5 text-primary" />
            )}
            <span className="text-sm font-bold text-text-primary">
              {isAllCompleted ? 'All Chapters Completed!' : 'Subject Study Progress'}
            </span>
          </div>
          <span className={cn(
            "text-xs font-black px-2.5 py-1 rounded-full",
            isAllCompleted
              ? "bg-success/10 text-success border border-success/20"
              : "bg-primary/10 text-primary border border-primary/20"
          )}>
            {completedChaptersCount} of {totalChaptersCount} Completed ({percent}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden border border-border/50">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isAllCompleted ? "bg-success" : "bg-primary"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{totalQuestions} total questions across {totalChaptersCount} chapters</span>
          <span>{totalChaptersCount - completedChaptersCount} chapters remaining</span>
        </div>
      </div>

      {/* Chapters List */}
      <div className="space-y-3">
        {chapters.map((chapter, index) => {
          const orderNumber = chapter.chapter_order > 0 ? chapter.chapter_order : index + 1;
          const isCompleted = !!chapter.is_completed;

          return (
            <div
              key={chapter.id}
              className={cn(
                "group bg-surface border transition-all rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs",
                isCompleted
                  ? "border-success/30 hover:border-success/60 bg-success/[0.02]"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center shrink-0 border",
                    isCompleted
                      ? "bg-success text-white border-success"
                      : "bg-primary/10 border-primary/20 text-primary"
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : orderNumber}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                      {chapter.chapter}
                    </h4>
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" />
                    <span>{chapter.question_count} practice {chapter.question_count === 1 ? 'question' : 'questions'}</span>
                  </p>
                </div>
              </div>

              <Link
                href={`/learn/${encodeURIComponent(subject)}/${chapter.id}`}
                className={cn(
                  "w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0",
                  isCompleted
                    ? "bg-surface-2 hover:bg-surface border border-border text-text-primary hover:border-success/50"
                    : "bg-primary hover:bg-primary-hover text-white"
                )}
              >
                {isCompleted ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-text-secondary" />
                    <span>Practice Again</span>
                  </>
                ) : (
                  <>
                    <span>Study</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

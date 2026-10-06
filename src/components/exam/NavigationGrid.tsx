'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { IDBAnswer } from '@/lib/db';

interface Props {
  questionIds: string[];
  currentIndex: number;
  answers: IDBAnswer[];
  onNavigate: (index: number) => void;
  onSubmitClick: () => void;
  navigationLocked?: boolean;
  timerSlot?: React.ReactNode;
}

export const NavigationGrid = React.memo(function NavigationGrid({ questionIds, currentIndex, answers, onNavigate, onSubmitClick, navigationLocked = false, timerSlot }: Props) {
  const answered = answers.filter(a => a.selected_option_id !== null).length;
  const markedUnanswered = answers.filter(a => a.is_marked_for_review && a.selected_option_id === null).length;
  const markedAnswered = answers.filter(a => a.is_marked_for_review && a.selected_option_id !== null).length;
  const unanswered = questionIds.length - answered;

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-surface-2 border-l border-border p-4">
      
      {timerSlot && <div className="shrink-0">{timerSlot}</div>}

      <div className="shrink-0 mb-4 space-y-2 text-sm font-medium">
        <h3 className="text-text-secondary uppercase tracking-wider text-xs mb-3">Question Status</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-success">
            <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
            Answered
          </div>
          <span>({answered})</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-secondary">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            Unanswered
          </div>
          <span>({unanswered})</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-warning">
            <span className="w-2.5 h-2.5 rounded-xs bg-warning"></span>
            Review (Unanswered)
          </div>
          <span>({markedUnanswered})</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-600">
            <span className="w-2.5 h-2.5 rounded-xs bg-purple-600"></span>
            Ans &amp; Review
          </div>
          <span>({markedAnswered})</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
        <div className="grid grid-cols-5 gap-1.5 place-content-start">
          {questionIds.map((qid, idx) => {
            const answer = answers.find(a => a.question_id === qid);
            const isCurrent = idx === currentIndex;
            const isAnswered = !!answer?.selected_option_id;
            const isReview = !!answer?.is_marked_for_review;
            const isVisited = !!answer?.is_visited;

            return (
              <button
                key={qid}
                onClick={() => !navigationLocked && onNavigate(idx)}
                disabled={navigationLocked}
                className={cn(
                  'w-9 h-9 rounded-md text-sm font-medium transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isCurrent 
                    ? 'bg-primary text-white font-bold ring-2 ring-primary ring-offset-1' 
                    : (isAnswered && isReview)
                      ? 'bg-purple-600 text-white font-semibold'
                      : isReview 
                        ? 'bg-warning text-white font-semibold'
                        : isAnswered 
                          ? 'bg-success text-white font-semibold'
                          : isVisited
                            ? 'bg-surface border border-border text-text-muted'
                            : 'bg-white border border-border text-text-muted hover:bg-surface-2',
                  navigationLocked ? 'pointer-events-none opacity-40' : 'cursor-pointer'
                )}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 pt-4 mt-auto border-t border-border">
        <button 
          onClick={onSubmitClick}
          className="w-full py-2.5 bg-danger hover:bg-danger-hover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-danger"
        >
          Submit Exam
        </button>
      </div>

    </div>
  );
});

export default NavigationGrid;

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
  const marked = answers.filter(a => a.is_marked_for_review).length;
  const unanswered = questionIds.length - answered;

  return (
    <div className="flex flex-col h-full w-full bg-surface-2 border-l border-border p-4">
      
      {timerSlot && <div>{timerSlot}</div>}

      <div className="mb-6 space-y-2 text-sm font-medium">
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
            <span className="w-2.5 h-2.5 bg-warning"></span>
            Review
          </div>
          <span>({marked})</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
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
                    ? 'bg-primary text-white' 
                    : isReview 
                      ? 'bg-warning text-white'
                      : isAnswered 
                        ? 'bg-success text-white'
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

      <div className="pt-4 mt-auto border-t border-border">
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

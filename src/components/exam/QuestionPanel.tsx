'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { IDBQuestion, IDBAnswer } from '@/lib/db';
import { Flag } from 'lucide-react';

interface Props {
  questionNumber: number;
  question: IDBQuestion;
  answer?: IDBAnswer;
  onSelectOption: (optionId: string) => void;
  onToggleReview: () => void;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const QuestionPanel = React.memo(function QuestionPanel({ 
  questionNumber, 
  question, 
  answer, 
  onSelectOption, 
  onToggleReview, 
  onPrev, 
  onNext, 
  isFirst, 
  isLast 
}: Props) {

  const selectedOptionId = answer?.selected_option_id || null;
  const isMarked = answer?.is_marked_for_review || false;

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-8 overflow-y-auto custom-scrollbar">
      
      {/* Question Content */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-text-primary leading-relaxed flex items-start gap-4">
          <span className="font-bold text-primary mt-0.5">{questionNumber}.</span>
          <span dangerouslySetInnerHTML={{ __html: question.content }} />
        </h2>
      </div>

      {/* Options */}
      <div className="space-y-4 mb-12">
        {question.options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelectOption(opt.id)}
              className={cn(
                'w-full text-left p-4 rounded-xl border text-base font-medium transition-all duration-100 ease-in-out flex items-center gap-4 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                isSelected
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white border-border text-text-secondary hover:bg-primary-light hover:border-primary hover:text-primary'
              )}
            >
              <div 
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                  isSelected ? 'border-white bg-white' : 'border-text-muted bg-transparent'
                )}
              >
                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
              <span dangerouslySetInnerHTML={{ __html: opt.content }} />
            </button>
          );
        })}
        {selectedOptionId && (
          <p className="text-xs text-text-muted mt-2 text-center">
            Click the selected option again to deselect it
          </p>
        )}
      </div>

      {/* Action Bar */}
      <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
        
        <button
          onClick={onToggleReview}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border',
            isMarked
              ? 'bg-warning/10 border-warning text-warning hover:bg-warning/20'
              : 'bg-surface border-border text-text-secondary hover:bg-surface-2'
          )}
        >
          <Flag className={cn('w-4 h-4', isMarked ? 'fill-warning' : '')} />
          {isMarked ? 'Marked for Review' : 'Mark for Review'}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onPrev}
            disabled={isFirst}
            className="px-6 py-2.5 rounded-lg border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-2 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            ← Previous
          </button>
          <button
            onClick={onNext}
            disabled={isLast}
            className="px-6 py-2.5 rounded-lg border border-transparent bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            Next Question →
          </button>
        </div>

      </div>

    </div>
  );
});

export default QuestionPanel;

'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, HelpCircle, ArrowLeft, ArrowRight } from 'lucide-react';

interface ResultQuestion {
  question_id: string;
  question_content: string;
  selected_option_id: string | null;
  selected_option_content: string | null;
  correct_option_id: string;
  correct_option_content: string;
  is_correct: boolean;
  is_unanswered: boolean;
  marks_awarded: number;
  explanation: string;
  time_spent_seconds: number;
}

interface Props {
  questions: ResultQuestion[];
  examTitle: string;
  onBack: () => void;
}

export default function AnswerReview({ questions, examTitle, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const q = questions[currentIndex];

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1);
  };
  
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  return (
    <div className="flex flex-col h-full w-full bg-background animate-in fade-in duration-300">
      
      {/* Header & Mini Grid */}
      <div className="bg-surface border-b border-border shadow-sm p-4 sticky top-0 z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
          <div className="font-semibold text-text-primary flex items-center gap-2">
            Answer Review <span className="text-text-muted font-normal">— {examTitle}</span>
          </div>
          <button 
            onClick={onBack}
            className="text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-surface-2"
          >
            ← Back to Result
          </button>
        </div>
        
        <div className="flex flex-wrap gap-1.5 max-w-5xl mx-auto w-full justify-start max-h-[120px] overflow-y-auto custom-scrollbar pr-2 pb-2">
          {questions.map((question, idx) => {
            const isCurrent = idx === currentIndex;
            const colorClass = question.is_correct 
              ? 'bg-success text-white border-success'
              : question.is_unanswered 
                ? 'bg-surface-2 text-text-muted border-border' 
                : 'bg-danger text-white border-danger';

            return (
              <button
                key={question.question_id}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded text-xs font-semibold border transition-all',
                  colorClass,
                  isCurrent ? 'ring-2 ring-primary ring-offset-1 scale-110 shadow-sm z-10' : 'hover:opacity-80'
                )}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Review Panel */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="flex justify-between items-end border-b border-border pb-4">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
              Question {currentIndex + 1} of {questions.length}
            </h3>
            <span className={cn('text-sm font-bold px-3 py-1 rounded-full', 
              q.marks_awarded > 0 ? 'bg-success/10 text-success' : q.marks_awarded < 0 ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-text-secondary'
            )}>
              {q.marks_awarded > 0 ? '+' : ''}{q.marks_awarded} Marks
            </span>
          </div>

          <div 
            className="text-xl font-medium text-text-primary leading-relaxed"
            dangerouslySetInnerHTML={{ __html: q.question_content }} 
          />

          <div className="space-y-4 mt-8">
            
            {q.is_unanswered && (
              <div className="mb-4 bg-surface-2 border-l-4 border-text-muted p-4 rounded-r-lg flex items-center gap-3 text-text-secondary">
                <HelpCircle className="w-5 h-5 text-text-muted" />
                <span className="font-medium">You did not answer this question.</span>
              </div>
            )}

            {!q.is_unanswered && !q.is_correct && q.selected_option_content && (
              <div className="bg-[#fef2f2] border border-danger/20 border-l-4 border-l-danger p-4 rounded-r-xl flex items-start gap-4">
                <div className="mt-0.5 bg-danger rounded-full p-0.5 text-white flex-shrink-0">
                  <X className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div dangerouslySetInnerHTML={{ __html: q.selected_option_content }} className="text-danger-dark font-medium" />
                  <div className="text-xs font-bold text-danger mt-2 uppercase tracking-wide opacity-80">Your Answer (Incorrect)</div>
                </div>
              </div>
            )}

            <div className="bg-[#f0fdf4] border border-success/20 border-l-4 border-l-success p-4 rounded-r-xl flex items-start gap-4">
              <div className="mt-0.5 bg-success rounded-full p-0.5 text-white flex-shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div dangerouslySetInnerHTML={{ __html: q.correct_option_content }} className="text-success-dark font-medium" />
                <div className="text-xs font-bold text-success mt-2 uppercase tracking-wide opacity-80">Correct Answer</div>
              </div>
            </div>

          </div>

          {q.explanation && (
            <div className="mt-12 bg-surface-2 rounded-xl p-6 border border-border">
              <div className="flex items-center gap-2 text-sm font-bold text-text-secondary uppercase mb-3">
                <span className="text-lg">💡</span> Explanation
              </div>
              <div className="text-text-primary leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: q.explanation }} />
            </div>
          )}

          {/* Bottom Nav */}
          <div className="flex items-center justify-between pt-10 border-t border-border mt-10">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

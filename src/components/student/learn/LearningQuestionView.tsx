'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, BookOpen, Maximize2, Minimize2, Trophy, RotateCcw, CheckCircle2, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LearningQuestion, LearningBankDetail } from '@/types';

interface LearningQuestionViewProps {
  questions: LearningQuestion[];
  bank: LearningBankDetail;
  subject: string;
}

export default function LearningQuestionView({
  questions,
  bank,
  subject,
}: LearningQuestionViewProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen toggle errors
    }
  }, []);

  if (!questions || questions.length === 0) {
    return (
      <div className="bg-surface border border-border border-dashed rounded-2xl p-12 text-center text-text-muted space-y-4">
        <p className="text-base font-bold text-text-primary">No questions available in this chapter yet.</p>
        <button
          onClick={() => router.push(`/learn/${encodeURIComponent(subject)}`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Chapters
        </button>
      </div>
    );
  }

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  const handleOptionClick = (optionId: string) => {
    if (revealed) return; // Locked once selected
    setSelectedOptionId(optionId);
    setRevealed(true);

    const chosenOption = currentQuestion.options.find((o) => o.id === optionId);
    if (chosenOption?.is_correct) {
      setCorrectCount((prev) => prev + 1);
    }
  };

  const handleFinishChapter = async () => {
    setIsSubmittingProgress(true);
    try {
      await fetch('/api/student/learn/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId: bank.id,
          questionsCompleted: totalQuestions,
          totalQuestions,
        }),
      });
    } catch (err) {
      console.error('[Chapter Completion Sync Error]', err);
    } finally {
      setIsSubmittingProgress(false);
      setIsFinished(true);
    }
  };

  const handleNext = () => {
    if (!revealed) return;
    if (isLastQuestion) {
      handleFinishChapter();
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setRevealed(false);
    }
  };

  const restartChapter = () => {
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setRevealed(false);
    setCorrectCount(0);
    setIsFinished(false);
  };

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Completion Screen
  if (isFinished) {
    const accuracyPercent = Math.round((correctCount / totalQuestions) * 100);

    return (
      <div className={cn(
        "w-full max-w-2xl mx-auto flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in-95 duration-300 py-8",
        isFullscreen && "min-h-screen"
      )}>
        <div className="w-full bg-surface border border-border rounded-3xl p-8 sm:p-10 shadow-lg text-center space-y-6 relative overflow-hidden">
          {/* Top glow accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-success via-primary to-success" />

          {/* Trophy Avatar */}
          <div className="w-20 h-20 bg-success/10 border-2 border-success/20 rounded-3xl flex items-center justify-center mx-auto text-success shadow-inner animate-bounce">
            <Trophy className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-success bg-success/10 border border-success/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Chapter Completed & Saved!</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-text-primary">
              {bank.chapter}
            </h2>
            <p className="text-sm text-text-secondary">
              Great work! You have finished practicing all {totalQuestions} questions in this chapter.
            </p>
          </div>

          {/* Score breakdown card */}
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            <div className="bg-surface-2 border border-border rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-text-primary">
                {correctCount}/{totalQuestions}
              </div>
              <div className="text-xs font-bold text-text-secondary uppercase tracking-wider mt-1">
                Correct Answers
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-primary">
                {accuracyPercent}%
              </div>
              <div className="text-xs font-bold text-primary uppercase tracking-wider mt-1">
                Accuracy
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => router.push(`/learn/${encodeURIComponent(subject)}`)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Award className="w-4 h-4" />
              <span>Return to Chapters</span>
            </button>
            <button
              onClick={restartChapter}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-surface-2 hover:bg-surface border border-border text-text-primary text-sm font-bold transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-text-secondary" />
              <span>Practice Again</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full max-w-4xl mx-auto flex flex-col space-y-6 animate-in fade-in duration-200",
      isFullscreen && "min-h-screen justify-center py-6 px-4"
    )}>
      {/* Top Controls & Navigation Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push(`/learn/${encodeURIComponent(subject)}`)}
          className="inline-flex items-center gap-2 text-xs font-bold text-text-secondary hover:text-primary transition-colors py-1.5 px-3 rounded-lg hover:bg-surface-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="truncate max-w-[200px] sm:max-w-[320px]">{bank.chapter}</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-text-muted bg-surface-2 border border-border px-3 py-1.5 rounded-lg">
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen (Distraction-Free)'}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors border border-border"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface-2 border border-border h-2 rounded-full overflow-hidden shadow-inner">
        <div
          className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Question Content */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Question {currentIndex + 1}
          </div>
          <div className="text-base sm:text-lg font-bold text-text-primary leading-relaxed whitespace-pre-wrap">
            {currentQuestion.content}
          </div>
          {currentQuestion.content_image_url && (
            <div className="pt-2 pb-1">
              <img
                src={currentQuestion.content_image_url}
                alt="Question diagram"
                className="max-h-72 sm:max-h-96 rounded-xl border border-border object-contain bg-surface-2"
              />
            </div>
          )}
        </div>

        {/* Options List */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => {
            const letter = optionLetters[idx] || `${idx + 1}`;
            const isSelected = selectedOptionId === option.id;
            const isCorrect = option.is_correct;

            // Visual State computation
            let optionStyles = 'border-border bg-surface hover:border-primary/50 hover:bg-primary/5 cursor-pointer text-text-primary';
            let badgeStyles = 'bg-surface-2 text-text-secondary border-border';
            let statusIcon: React.ReactNode = null;

            if (revealed) {
              if (isCorrect) {
                // Correct option (green)
                optionStyles = 'border-success bg-success/10 text-success font-medium opacity-100 cursor-default';
                badgeStyles = 'bg-success text-white border-success';
                statusIcon = <Check className="w-5 h-5 text-success shrink-0" />;
              } else if (isSelected && !isCorrect) {
                // Selected wrong option (red)
                optionStyles = 'border-danger bg-danger/10 text-danger font-medium opacity-100 cursor-default';
                badgeStyles = 'bg-danger text-white border-danger';
                statusIcon = <X className="w-5 h-5 text-danger shrink-0" />;
              } else {
                // Other options (dimmed)
                optionStyles = 'border-border/60 bg-surface/50 text-text-muted opacity-40 cursor-not-allowed';
                badgeStyles = 'bg-surface-2/50 text-text-muted border-border/40';
              }
            }

            return (
              <button
                key={option.id}
                type="button"
                disabled={revealed}
                onClick={() => handleOptionClick(option.id)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start justify-between gap-3.5',
                  optionStyles
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg border text-xs font-black flex items-center justify-center shrink-0 transition-colors',
                      badgeStyles
                    )}
                  >
                    {letter}
                  </div>
                  <span className="text-sm font-medium pt-0.5 leading-snug break-words">
                    {option.content}
                  </span>
                </div>
                {statusIcon}
              </button>
            );
          })}
        </div>

        {/* Explanation Block (Shown only after selection if explanation or explanation image exists) */}
        {revealed && (currentQuestion.explanation || currentQuestion.explanation_image_url) && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Explanation</span>
            </div>
            {currentQuestion.explanation && (
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {currentQuestion.explanation}
              </p>
            )}
            {currentQuestion.explanation_image_url && (
              <div className="pt-1">
                <img
                  src={currentQuestion.explanation_image_url}
                  alt="Explanation diagram"
                  className="max-h-72 sm:max-h-96 rounded-xl border border-border object-contain bg-surface-2"
                />
              </div>
            )}
          </div>
        )}

        {/* Action Button (Shown ONLY after selection) */}
        {revealed && (
          <div className="pt-2 flex justify-end animate-in fade-in duration-150">
            <button
              type="button"
              disabled={isSubmittingProgress}
              onClick={handleNext}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isLastQuestion ? (isSubmittingProgress ? 'Finishing...' : 'Finish & Complete ✓') : 'Next Question →'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

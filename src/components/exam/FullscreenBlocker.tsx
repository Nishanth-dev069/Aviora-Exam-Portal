'use client';

import React from 'react';
import { Maximize2 } from 'lucide-react';

interface Props {
  onReturnToFullscreen: () => void;
  violationCount: number;
  maxViolations: number;
}

export const FullscreenBlocker = React.memo(function FullscreenBlocker({ onReturnToFullscreen, violationCount, maxViolations }: Props) {
  return (
    <div
      className="fixed inset-0 z-[99998]"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="absolute inset-0 bg-background/80" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-surface shadow-2xl p-8 text-center space-y-6 animate-in zoom-in-95">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-danger/10 flex items-center justify-center">
              <Maximize2 className="h-8 w-8 text-danger" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-text-primary">
              Fullscreen Required
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              You have exited fullscreen mode. The examination cannot continue until
              you return to fullscreen. This incident has been recorded.
            </p>
          </div>

          {violationCount > 0 && (
            <div className="px-4 py-2 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                Violation {violationCount} of {maxViolations} recorded
              </p>
            </div>
          )}

          <button
            onClick={onReturnToFullscreen}
            className="w-full py-3 px-6 rounded-lg bg-primary text-white font-semibold text-sm 
                       hover:bg-primary-hover active:scale-[0.98] transition-all focus:outline-none 
                       focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-md cursor-pointer"
          >
            Return to Fullscreen
          </button>

          <p className="text-xs text-text-muted">
            Your answers are saved. No progress will be lost.
          </p>
        </div>
      </div>
    </div>
  );
});

export default FullscreenBlocker;

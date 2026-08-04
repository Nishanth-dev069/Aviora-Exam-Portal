'use client';

import { useState, useEffect, useRef } from 'react';

const LOCK_DURATION_SECONDS = 10;

interface QuestionNavigationTimerProps {
  // questionId is used as the `key` externally — no internal logic depends on it
  questionId: string;
  onLockStateChange: (isLocked: boolean) => void;
}

export function QuestionNavigationTimer({
  questionId: _questionId, // only used as `key` externally — suppresses unused-var lint
  onLockStateChange,
}: QuestionNavigationTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(LOCK_DURATION_SECONDS);
  // Stabilize callback reference to prevent stale closures in setTimeout chain
  const onLockStateChangeRef = useRef(onLockStateChange);
  onLockStateChangeRef.current = onLockStateChange;

  useEffect(() => {
    // Component mounted → navigation is locked
    onLockStateChangeRef.current(true);

    if (secondsLeft <= 0) {
      onLockStateChangeRef.current(false);
      return;
    }

    const timeout = setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [secondsLeft]);

  const isLocked = secondsLeft > 0;
  const progressPercent =
    ((LOCK_DURATION_SECONDS - secondsLeft) / LOCK_DURATION_SECONDS) * 100;

  return (
    <div className="rounded-lg border border-border bg-surface p-3 mb-3">
      {isLocked ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium uppercase tracking-wide">
              Read Timer
            </span>
            <span className="text-warning text-xl font-bold tabular-nums">
              {secondsLeft}s
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-warning transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-text-muted">
            Navigate in {secondsLeft}s
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-success shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
          <span className="text-xs text-success font-medium">
            You may navigate
          </span>
        </div>
      )}
    </div>
  );
}

export default QuestionNavigationTimer;


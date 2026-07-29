'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getTimeRemainingMs, formatTimeRemaining, restoreCalibration } from '@/lib/exam/timer';

interface Props {
  expiresAt: string;
  clockOffset?: number;
}

export const ExamTimer = React.memo(function ExamTimer({ expiresAt }: Props) {
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(0);
  const [displayTime, setDisplayTime] = useState<string>('--:--');

  useEffect(() => {
    restoreCalibration();

    const tick = () => {
      const remaining = getTimeRemainingMs(expiresAt);
      setTimeRemainingMs(remaining);
      setDisplayTime(formatTimeRemaining(remaining));

      if (remaining <= 0) {
        window.dispatchEvent(new CustomEvent('exam:timer_expired'));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isWarning = timeRemainingMs <= 5 * 60 * 1000;  // 5 min
  const isDanger = timeRemainingMs <= 60 * 1000;        // 1 min

  return (
    <div 
      aria-live="off"
      aria-label={`Time remaining: ${displayTime}`}
      className={cn(
        'font-mono text-lg font-bold flex items-center justify-center transition-colors px-3 py-1 rounded-md border tabular-nums',
        isWarning && !isDanger ? 'text-warning border-warning bg-warning/10' : '',
        isDanger ? 'text-danger border-danger bg-danger/10 animate-pulse' : 'text-text-primary border-border bg-surface',
      )}
    >
      ⏱ {displayTime}
    </div>
  );
});

export default ExamTimer;

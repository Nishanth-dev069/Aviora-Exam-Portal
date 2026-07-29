'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthState } from '@/lib/auth/cleanup';

interface HeartbeatOptions {
  sessionId?: string;
  intervalMs?: number; // default 10 seconds
  onTerminated?: () => void; // called when session is terminated
}

export function useSessionHeartbeat({ sessionId = 'dashboard', intervalMs = 10_000, onTerminated }: HeartbeatOptions) {
  const router = useRouter();
  const isTerminated = useRef(false);

  const beat = useCallback(async () => {
    if (isTerminated.current) return;

    try {
      const res = await fetch('/api/exam/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        isTerminated.current = true;

        await clearAuthState();

        if (data?.error?.code === 'SESSION_TERMINATED') {
          if (onTerminated) {
            onTerminated();
          }
          setTimeout(() => {
            router.replace('/login?reason=session_terminated');
          }, 3000);
        } else {
          router.replace('/login?reason=session_expired');
        }
      }
    } catch {
      // Network error — don't terminate, let sync engine handle
    }
  }, [sessionId, onTerminated, router]);

  useEffect(() => {
    beat();
    const interval = setInterval(beat, intervalMs);
    return () => clearInterval(interval);
  }, [beat, intervalMs]);
}

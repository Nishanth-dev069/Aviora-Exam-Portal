'use client';

import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat';

export function HeartbeatProvider() {
  useSessionHeartbeat({
    sessionId: 'dashboard',
    intervalMs: 10_000,
  });

  return null;
}

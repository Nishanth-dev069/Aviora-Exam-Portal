/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';

export type SyncState = 'saved' | 'saving' | 'offline' | 'error';

export const SyncIndicator = React.memo(function SyncIndicator() {
  const [status, setStatus] = useState<SyncState>('saved');

  useEffect(() => {
    const handleStatus = (e: CustomEvent<SyncState>) => setStatus(e.detail);
    window.addEventListener('exam:sync_status' as any, handleStatus);
    return () => window.removeEventListener('exam:sync_status' as any, handleStatus);
  }, []);

  const config = {
    saved: { text: 'Saved', dot: 'bg-success', pulse: false },
    saving: { text: 'Saving...', dot: 'bg-warning', pulse: true },
    offline: { text: 'Offline — saved locally', dot: 'bg-warning', pulse: false },
    error: { text: 'Sync error — retrying', dot: 'bg-danger', pulse: true },
  };

  const curr = config[status];

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
      <div className="relative flex h-2 w-2">
        {curr.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${curr.dot}`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${curr.dot}`}></span>
      </div>
      <span>{curr.text}</span>
    </div>
  );
});

export default SyncIndicator;

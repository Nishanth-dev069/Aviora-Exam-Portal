'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 4000);
      }
    };

    setIsOffline(!navigator.onLine);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [wasOffline]);

  if (isOffline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[99999] flex items-center justify-center gap-3 bg-danger px-4 py-2.5 text-white shadow-lg animate-in slide-in-from-top">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold">
          No internet connection. Your answers are saved locally and will sync when reconnected.
        </span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[99999] flex items-center justify-center gap-3 bg-success px-4 py-2.5 text-white shadow-lg animate-in slide-in-from-top">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold">
          Connection restored — syncing your exam data...
        </span>
      </div>
    );
  }

  return null;
}

export default OfflineBanner;

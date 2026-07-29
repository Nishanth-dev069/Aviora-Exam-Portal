'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-surface border border-border shadow-xl rounded-2xl p-8 text-center space-y-6">
        <div className="text-6xl leading-none">⚠️</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Something went wrong</h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            An unexpected error occurred. If you were in the middle of an examination,
            your answers have been saved automatically to local storage.
          </p>
          {error.digest && (
            <p className="text-xs text-text-muted font-mono pt-1">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover transition-colors shadow-md shadow-primary/20"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border border-border bg-surface-2 px-5 py-2.5 text-sm font-bold text-text-primary hover:bg-border transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

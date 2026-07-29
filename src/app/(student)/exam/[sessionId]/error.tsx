'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Log error securely to console (or telemetry), not to UI
    console.error('Exam Error Caught By Boundary:', error);
    // Note: IndexedDB state is completely preserved as we do not run any cleanup/clear logic here.
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in zoom-in duration-300">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-danger/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-danger" />
        </div>
        
        <h2 className="text-2xl font-black text-text-primary">System Notice</h2>
        
        <p className="text-text-secondary">
          An error occurred. Your answers have been saved locally. Please refresh the page to safely resume your session.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          Refresh Page
        </button>
      </div>
    </div>
  );
}

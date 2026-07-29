import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-1">
          <p className="text-[96px] font-black text-primary leading-none tracking-tight">404</p>
          <div className="h-1.5 w-16 bg-primary mx-auto rounded-full" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-text-primary">Page Not Found</h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            The page you're looking for doesn't exist, has been moved, or you don't have
            permission to access it.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-hover transition-colors shadow-md shadow-primary/20"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

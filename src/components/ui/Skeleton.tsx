import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-surface-2 border border-border/60 shadow-xs',
        className
      )}
      {...props}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-surface border border-border rounded-xl p-5 space-y-4 animate-pulse shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/3 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-2/3 rounded-md" />
      <div className="pt-2 flex items-center justify-between border-t border-border/50">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm animate-pulse w-full">
      <div className="bg-surface-2 border-b border-border p-4 flex items-center gap-4">
        {[...Array(cols)].map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 rounded-md" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {[...Array(rows)].map((_, r) => (
          <div key={r} className="p-4 flex items-center gap-4">
            {[...Array(cols)].map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1 rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-surface border border-border rounded-xl p-5 space-y-3 animate-pulse shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <Skeleton className="h-7 w-16 rounded-md" />
      <Skeleton className="h-3 w-32 rounded-md" />
    </div>
  );
}

export default Skeleton;

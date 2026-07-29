import { Skeleton } from '@/components/ui/Skeleton';

export default function ExamsLoading() {
  return (
    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="grid grid-cols-6 gap-4 border-b border-border bg-surface-2 px-6 py-4">
          {['Title', 'Subject', 'Type', 'Status', 'Questions', 'Actions'].map((h) => (
            <Skeleton key={h} className="h-4 w-16" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 border-b border-border/50 px-6 py-4 items-center">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

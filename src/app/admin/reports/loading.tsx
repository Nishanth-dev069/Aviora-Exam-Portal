import { Skeleton } from '@/components/ui/Skeleton';

export default function ReportsLoading() {
  return (
    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="flex gap-4 border-b border-border pb-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-10 w-48 rounded-xl" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-6">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

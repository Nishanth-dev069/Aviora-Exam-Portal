import { Skeleton } from '@/components/ui/Skeleton';

export default function ExamResultLoading() {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      <div className="space-y-3 text-center border-b border-border pb-6">
        <Skeleton className="h-9 w-64 mx-auto" />
        <Skeleton className="h-4 w-44 mx-auto" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3 text-center">
          <Skeleton className="h-4 w-24 mx-auto" />
          <Skeleton className="h-12 w-20 mx-auto" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3 text-center">
          <Skeleton className="h-4 w-24 mx-auto" />
          <Skeleton className="h-12 w-20 mx-auto" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3 text-center">
          <Skeleton className="h-4 w-24 mx-auto" />
          <Skeleton className="h-12 w-20 mx-auto" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

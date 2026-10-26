import { Skeleton } from '@/components/ui/Skeleton';

export default function QuestionBanksLoading() {
  return (
    <div className="space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-6 space-y-4 animate-pulse shadow-sm">
            <div className="flex justify-between items-start">
              <Skeleton className="h-6 w-36 rounded-md" />
              <Skeleton className="h-6 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <div className="pt-4 flex justify-between items-center border-t border-border">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

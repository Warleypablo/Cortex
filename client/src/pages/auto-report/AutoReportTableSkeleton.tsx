import { Skeleton } from '@/components/ui/skeleton';

interface AutoReportTableSkeletonProps {
  rows?: number;
}

export default function AutoReportTableSkeleton({ rows = 6 }: AutoReportTableSkeletonProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/30">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-muted/30">
        <Skeleton className="w-4 h-4" />
        <Skeleton className="w-32 h-4" />
        <Skeleton className="hidden md:block w-20 h-4 ml-auto" />
        <Skeleton className="hidden md:block w-32 h-4" />
        <Skeleton className="hidden md:block w-28 h-4" />
        <Skeleton className="w-20 h-4" />
      </div>
      {/* Rows skeleton */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-4 border-l-[3px] border-l-gray-200 dark:border-l-zinc-800 border-b border-b-gray-100 dark:border-b-zinc-900 last:border-b-0"
        >
          <Skeleton className="w-4 h-4" />
          <div className="space-y-2">
            <Skeleton className="w-40 h-4" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-10 h-4" />
            </div>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-4">
            <Skeleton className="w-20 h-3" />
            <div className="flex items-center gap-1">
              <Skeleton className="w-10 h-5 rounded-md" />
              <Skeleton className="w-10 h-5 rounded-md" />
              <Skeleton className="w-10 h-5 rounded-md" />
            </div>
            <Skeleton className="w-24 h-5 rounded-md" />
          </div>
          <Skeleton className="w-16 h-5 rounded-md" />
          <Skeleton className="w-16 h-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

import { SkeletonTable } from '@/components/ui/skeleton';

interface AutoReportTableSkeletonProps {
  rows?: number;
}

export default function AutoReportTableSkeleton({ rows = 6 }: AutoReportTableSkeletonProps) {
  return <SkeletonTable rows={rows} />;
}

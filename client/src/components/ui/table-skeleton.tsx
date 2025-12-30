import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  const columnWidths = [
    "w-32",
    "w-40",
    "w-24",
    "w-28",
    "w-20",
    "w-36",
    "w-24",
    "w-32",
  ];

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        className
      )}
      data-testid="table-skeleton"
    >
      <Table>
        {showHeader && (
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {Array.from({ length: columns }).map((_, index) => (
                <TableHead key={index}>
                  <div
                    className={cn(
                      "h-4 rounded-md bg-muted/60 animate-pulse",
                      columnWidths[index % columnWidths.length]
                    )}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow
              key={rowIndex}
              className="hover:bg-transparent"
            >
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <div
                    className={cn(
                      "h-4 rounded-md bg-muted/50 animate-pulse",
                      columnWidths[colIndex % columnWidths.length],
                      rowIndex % 2 === 0 ? "opacity-80" : "opacity-60"
                    )}
                    style={{
                      animationDelay: `${(rowIndex * columns + colIndex) * 50}ms`,
                    }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ClientsTableSkeleton() {
  return (
    <TableSkeleton
      columns={6}
      rows={8}
    />
  );
}

export function ContractsTableSkeleton() {
  return (
    <TableSkeleton
      columns={7}
      rows={8}
    />
  );
}

export default TableSkeleton;

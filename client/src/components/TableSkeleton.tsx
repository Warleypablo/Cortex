import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TableSkeletonProps {
  columns: { width?: string; align?: "left" | "right" | "center" }[];
  rows?: number;
}

export default function TableSkeleton({ columns, rows = 8 }: TableSkeletonProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-background border-b">
            {columns.map((col, index) => (
              <TableHead 
                key={index} 
                className={`bg-background ${col.align === "right" ? "text-right" : ""}`}
              >
                <Skeleton className={`h-4 ${col.width || "w-20"}`} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((col, colIndex) => (
                <TableCell 
                  key={colIndex}
                  className={col.align === "right" ? "text-right" : ""}
                >
                  <Skeleton className={`h-4 ${col.width || "w-full"}`} />
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
      columns={[
        { width: "w-48" },
        { width: "w-36" },
        { width: "w-20" },
        { width: "w-24", align: "right" },
        { width: "w-16", align: "right" },
        { width: "w-24" },
      ]}
      rows={8}
    />
  );
}

export function ContractsTableSkeleton() {
  return (
    <TableSkeleton
      columns={[
        { width: "w-32" },
        { width: "w-40" },
        { width: "w-24" },
        { width: "w-24" },
        { width: "w-28" },
        { width: "w-24", align: "right" },
        { width: "w-24", align: "right" },
      ]}
      rows={8}
    />
  );
}

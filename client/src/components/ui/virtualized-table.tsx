import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render: (item: T, index: number) => React.ReactNode;
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  maxHeight?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  getRowClassName?: (item: T, index: number) => string;
  emptyMessage?: string;
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 52,
  maxHeight = 600,
  className,
  onRowClick,
  getRowClassName,
  emptyMessage = "Nenhum registro encontrado",
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (data.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border bg-card", className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.width,
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        <div className="p-8 text-center text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  col.width,
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center"
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      </Table>
      
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight }}
        data-testid="virtualized-table-body"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          <Table>
            <TableBody>
              {virtualItems.map((virtualRow) => {
                const item = data[virtualRow.index];
                const rowClassName = getRowClassName?.(item, virtualRow.index) || "";
                
                return (
                  <TableRow
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    className={cn(
                      onRowClick && "cursor-pointer hover:bg-muted/50",
                      rowClassName
                    )}
                    onClick={() => onRowClick?.(item, virtualRow.index)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    data-testid={`virtualized-row-${virtualRow.index}`}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          col.width,
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center"
                        )}
                      >
                        {col.render(item, virtualRow.index)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {data.length > 50 && (
        <div className="px-4 py-2 border-t text-xs text-muted-foreground bg-muted/30">
          Mostrando {Math.min(virtualItems.length, data.length)} de {data.length} registros
        </div>
      )}
    </div>
  );
}

export function useVirtualList<T>(items: T[], options?: { estimateSize?: number; overscan?: number }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => options?.estimateSize || 40,
    overscan: options?.overscan || 5,
  });

  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}

export default VirtualizedTable;

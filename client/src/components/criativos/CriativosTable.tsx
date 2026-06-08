import React, { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ArrowUpDown, ExternalLink, ChevronRight, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency as formatCurrencyUtil, formatPercent as formatPercentUtil } from "@/lib/utils";
import type { CriativoData, Level, SortConfig } from "@/lib/criativosMetrics";
import { type ColumnDef, type ColumnFormat, NAME_COL_KEY, NAME_DEFAULT_WIDTH } from "@/lib/criativosColumns";

function formatNumber(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR").format(value);
}
function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return formatPercentUtil(value);
}
function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return formatCurrencyUtil(value);
}
function fmt(format: ColumnFormat, value: number | null): string {
  switch (format) {
    case "currency": return formatCurrency(value);
    case "percent": return formatPercent(value);
    case "days": return value !== null ? `${value}d` : "-";
    case "roas": return value !== null ? `${value}x` : "-";
    default: return formatNumber(value);
  }
}

const NAME_HEADER: Record<Level, string> = {
  anuncio: "Ad name",
  conjunto: "Conjunto",
  campanha: "Campanha",
  conta: "Conta",
};

// Larguras fixas das colunas congeladas não-redimensionáveis
const W_SELECT = 44;
const W_TOGGLE = 64;
const W_LINK = 48;
const W_ID = 150;
const W_STATUS = 110;
const W_VAR = 84;
const MIN_COL = 60;

type RKind = "select" | "toggle" | "link" | "id" | "name" | "status" | "metric" | "var";
interface RCol {
  uid: string;
  kind: RKind;
  width: number;
  sticky: boolean;
  left?: number;
  def?: ColumnDef;
  resizeKey?: string; // chave usada na persistência de largura
  lastFrozen?: boolean;
}

export interface CriativosTableProps {
  level: Level;
  rows: CriativoData[];
  compareMap: Map<string, CriativoData>;
  averages: CriativoData | null;
  isCompareActive: boolean;
  isLoading: boolean;
  sortConfig: SortConfig;
  onSort: (key: keyof CriativoData) => void;
  expandedColumns: Set<string>;
  toggleColumn: (c: string) => void;
  getCellColor: (value: number | null, metricKey: string) => string;
  pendingByEntity: Map<string, { entity_id: string }>;
  isAdmin: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, ids: string[]) => void;
  onToggleStatus: (row: CriativoData) => void;
  togglingIds: Set<string>;
  columns: ColumnDef[];
  columnWidths: Record<string, number>;
  onResize: (key: string, width: number) => void;
}

export function CriativosTable({
  level,
  rows,
  compareMap,
  averages,
  isCompareActive,
  isLoading,
  sortConfig,
  onSort,
  expandedColumns,
  toggleColumn,
  getCellColor,
  pendingByEntity,
  isAdmin,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleStatus,
  togglingIds,
  columns,
  columnWidths,
  onResize,
}: CriativosTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const resizingRef = useRef<{ resizeKey: string; uid: string; startX: number; startW: number; statusBaseLeft?: number; live: number } | null>(null);

  const widthOf = (key: string, fb: number) =>
    columnWidths[key] && columnWidths[key] > 0 ? columnWidths[key] : fb;

  const interactive = isAdmin && level !== "conta";

  // ── Monta a lista unificada de colunas renderizadas ──
  const frozen: RCol[] = [];
  if (interactive) {
    frozen.push({ uid: "select", kind: "select", width: W_SELECT, sticky: true });
    frozen.push({ uid: "toggle", kind: "toggle", width: W_TOGGLE, sticky: true });
  }
  if (level === "anuncio") {
    frozen.push({ uid: "link", kind: "link", width: W_LINK, sticky: true });
    frozen.push({ uid: "id", kind: "id", width: W_ID, sticky: true });
  }
  const nameWidth = widthOf(NAME_COL_KEY, NAME_DEFAULT_WIDTH);
  frozen.push({ uid: "name", kind: "name", width: nameWidth, sticky: true, resizeKey: NAME_COL_KEY });
  frozen.push({ uid: "status", kind: "status", width: W_STATUS, sticky: true });

  let acc = 0;
  for (const f of frozen) { f.left = acc; acc += f.width; }
  frozen[frozen.length - 1].lastFrozen = true;
  const nameCol = frozen.find((f) => f.kind === "name")!;
  const statusBaseLeft = nameCol.left! + nameCol.width; // = status.left

  const metricCols: RCol[] = [];
  for (const def of columns) {
    metricCols.push({
      uid: def.key as string,
      kind: "metric",
      def,
      width: widthOf(def.key as string, def.defaultWidth),
      sticky: false,
      resizeKey: def.key as string,
    });
    if (isCompareActive && expandedColumns.has(def.key as string)) {
      metricCols.push({ uid: `${def.key}:var`, kind: "var", def, width: W_VAR, sticky: false });
    }
  }

  const allCols = [...frozen, ...metricCols];
  const totalWidth = allCols.reduce((s, c) => s + c.width, 0);

  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));

  // ── Resize ──
  const onResizeMove = (e: PointerEvent) => {
    const r = resizingRef.current;
    if (!r) return;
    const w = Math.max(MIN_COL, r.startW + (e.clientX - r.startX));
    r.live = w;
    const col = colRefs.current[r.uid];
    if (col) col.style.width = `${w}px`;
    // se for a coluna de nome, empurra o "left" sticky da coluna Status ao vivo
    if (r.statusBaseLeft !== undefined && tableRef.current) {
      tableRef.current.style.setProperty("--cz-status-left", `${r.statusBaseLeft - r.startW + w}px`);
    }
  };
  const onResizeEnd = () => {
    const r = resizingRef.current;
    if (!r) return;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeEnd);
    resizingRef.current = null;
    onResize(r.resizeKey, r.live);
  };
  const startResize = (e: React.PointerEvent, c: RCol) => {
    if (!c.resizeKey) return;
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      resizeKey: c.resizeKey,
      uid: c.uid,
      startX: e.clientX,
      startW: c.width,
      statusBaseLeft: c.kind === "name" ? statusBaseLeft : undefined,
      live: c.width,
    };
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeEnd);
  };

  const ResizeHandle = ({ c }: { c: RCol }) => (
    <span
      onPointerDown={(e) => startResize(e, c)}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary z-20"
      title="Arraste para redimensionar"
    />
  );

  const stickyLeft = (c: RCol): React.CSSProperties =>
    c.kind === "status" ? { left: "var(--cz-status-left)" } : { left: c.left };

  const SortIcon = () => <ArrowUpDown className="w-3 h-3 shrink-0" />;

  // ── Header ──
  const renderHeader = (c: RCol) => {
    const stickyCls = c.sticky ? "sticky z-10 overflow-hidden" : "";
    const lastCls = c.lastFrozen ? "border-r border-zinc-700" : "";
    const baseTh = cn("px-2 py-2 text-xs font-medium text-zinc-100 bg-zinc-900 align-middle", stickyCls, lastCls);
    const style = c.sticky ? stickyLeft(c) : undefined;

    switch (c.kind) {
      case "select":
        return (
          <th key={c.uid} className={baseTh} style={style}>
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(v) => onToggleSelectAll(v === true, allIds)}
              aria-label="Selecionar todos"
            />
          </th>
        );
      case "toggle":
        return <th key={c.uid} className={baseTh} style={style} />;
      case "link":
        return <th key={c.uid} className={baseTh} style={style}>Link</th>;
      case "id":
        return (
          <th key={c.uid} className={cn(baseTh, "cursor-pointer hover:bg-zinc-800 whitespace-nowrap")} style={style} onClick={() => onSort("id")}>
            <div className="flex items-center gap-1">Ad Id <SortIcon /></div>
          </th>
        );
      case "name":
        return (
          <th key={c.uid} className={cn(baseTh, "relative cursor-pointer hover:bg-zinc-800 whitespace-nowrap")} style={style} onClick={() => onSort("adName")}>
            <div className="flex items-center gap-1">{NAME_HEADER[level]} <SortIcon /></div>
            <ResizeHandle c={c} />
          </th>
        );
      case "status":
        return (
          <th key={c.uid} className={cn(baseTh, "cursor-pointer hover:bg-zinc-800 whitespace-nowrap")} style={style} onClick={() => onSort("status")}>
            <div className="flex items-center gap-1">Status <SortIcon /></div>
          </th>
        );
      case "metric": {
        const def = c.def!;
        const isExpanded = expandedColumns.has(def.key as string);
        return (
          <th key={c.uid} className={cn(baseTh, "relative cursor-pointer hover:bg-zinc-800 whitespace-nowrap")} onClick={() => onSort(def.key)}>
            <div className="flex items-center gap-1">
              {isCompareActive && (
                <button onClick={(e) => { e.stopPropagation(); toggleColumn(def.key as string); }} className="hover:text-white text-zinc-400">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
              {def.label}
              <SortIcon />
            </div>
            <ResizeHandle c={c} />
          </th>
        );
      }
      case "var":
        return <th key={c.uid} className="px-2 py-2 text-xs italic text-zinc-400 bg-zinc-800 text-center align-middle">Var.</th>;
    }
  };

  // ── Linha de Total ──
  const renderTotal = (c: RCol) => {
    const stickyCls = c.sticky ? "sticky z-10 overflow-hidden" : "";
    const lastCls = c.lastFrozen ? "border-r border-zinc-700" : "";
    const baseTh = cn("px-2 py-1.5 text-xs font-semibold bg-zinc-800 align-middle", stickyCls, lastCls);
    const style = c.sticky ? stickyLeft(c) : undefined;
    if (c.kind === "name") return <th key={c.uid} className={cn(baseTh, "text-muted-foreground")} style={style}>Total</th>;
    if (c.sticky) return <th key={c.uid} className={baseTh} style={style} />;
    if (c.kind === "var") return <th key={c.uid} className="px-2 py-1.5 bg-zinc-800/40" />;
    const def = c.def!;
    return <th key={c.uid} className={cn(baseTh, "text-right")}>{averages ? fmt(def.format, averages[def.key] as number | null) : ""}</th>;
  };

  // ── Corpo ──
  const renderBody = (c: RCol, row: CriativoData) => {
    const stickyCls = c.sticky ? "sticky z-10 bg-card overflow-hidden" : "";
    const lastCls = c.lastFrozen ? "border-r border-zinc-700/50" : "";
    const baseTd = cn("px-2 py-2 text-xs align-middle", stickyCls, lastCls);
    const style = c.sticky ? stickyLeft(c) : undefined;
    const isToggling = togglingIds.has(row.id);

    switch (c.kind) {
      case "select":
        return (
          <td key={c.uid} className={baseTd} style={style}>
            <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={(v) => onToggleSelect(row.id, v === true)} aria-label={`Selecionar ${row.adName}`} />
          </td>
        );
      case "toggle":
        return (
          <td key={c.uid} className={baseTd} style={style}>
            {isToggling ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={row.status === "Ativo"}
                onCheckedChange={() => onToggleStatus(row)}
                disabled={row.status === "Inativo" || row.status === "Desconhecido"}
                aria-label={`Ligar/desligar ${row.adName}`}
              />
            )}
          </td>
        );
      case "link":
        return (
          <td key={c.uid} className={baseTd} style={style}>
            {row.link && (
              <a href={row.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </td>
        );
      case "id":
        return <td key={c.uid} className={cn(baseTd, "font-mono text-muted-foreground")} style={style} title={row.id}>{row.id || "-"}</td>;
      case "name":
        return (
          <td key={c.uid} className={cn(baseTd, "font-medium")} style={style} title={row.adName}>
            <div className="flex items-center gap-1.5">
              <span className="truncate">{row.adName}</span>
              {pendingByEntity.has(row.id) && (
                <Badge variant="secondary" className="shrink-0 text-[10px] h-4 px-1 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" title="Proposta pendente do agente">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />IA
                </Badge>
              )}
            </div>
          </td>
        );
      case "status":
        return (
          <td key={c.uid} className={baseTd} style={style}>
            <Badge variant={row.status === "Ativo" ? "default" : "secondary"} className={row.status === "Ativo" ? "bg-green-500" : ""}>{row.status}</Badge>
          </td>
        );
      case "metric": {
        const def = c.def!;
        const value = row[def.key] as number | null;
        const colorClass = def.color ? getCellColor(value, def.colorKey || (def.key as string)) : "";
        return <td key={c.uid} className={cn(baseTd, "text-right", colorClass)}>{fmt(def.format, value)}</td>;
      }
      case "var": {
        const def = c.def!;
        const value = row[def.key] as number | null;
        const cmp = compareMap.get(row.id);
        const compareValue = (cmp?.[def.key] as number | null) ?? null;
        return (
          <td key={c.uid} className="px-2 py-2 text-xs text-right bg-zinc-800/20 align-middle">
            {value !== null && compareValue !== null && compareValue !== 0 ? (
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground">{fmt(def.format, value - compareValue)}</span>
                <span className={cn("text-[10px]", (() => {
                  const pct = ((value - compareValue) / compareValue) * 100;
                  const positive = def.invert ? pct < 0 : pct > 0;
                  return positive ? "text-emerald-400" : "text-red-400";
                })())}>
                  {((value - compareValue) / compareValue * 100) > 0 ? "+" : ""}
                  {((value - compareValue) / compareValue * 100).toFixed(1)}%
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </td>
        );
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative max-h-[calc(100vh-320px)] overflow-auto scrollbar-minimal">
      <table
        ref={tableRef}
        className="border-collapse text-xs"
        style={{ tableLayout: "fixed", width: totalWidth, ["--cz-status-left" as any]: `${statusBaseLeft}px` }}
      >
        <colgroup>
          {allCols.map((c) => (
            <col key={c.uid} ref={(el) => { colRefs.current[c.uid] = el; }} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-50">
          <tr className="bg-zinc-900 shadow-md">{allCols.map(renderHeader)}</tr>
          {averages && level !== "conta" && (
            <tr className="bg-zinc-800 border-b-2 border-zinc-700">{allCols.map(renderTotal)}</tr>
          )}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border hover:bg-muted/40" data-testid={`row-criativo-${row.id}`}>
              {allCols.map((c) => renderBody(c, row))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={allCols.length} className="text-center py-8 text-muted-foreground">
                Nenhum dado encontrado para o período selecionado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

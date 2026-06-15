import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { rotuloDim, type Cancelamento } from "./utils";

const CORES = ["#6366f1", "#f59e0b", "#f97316", "#ef4444", "#a855f7", "#14b8a6"];

function agrupa(canc: Cancelamento[], key: (c: Cancelamento) => string) {
  const map = new Map<string, { label: string; qtd: number; valor: number }>();
  for (const c of canc) {
    const label = key(c);
    const cur = map.get(label) ?? { label, qtd: 0, valor: 0 };
    cur.qtd += 1; cur.valor += c.valorp; map.set(label, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
}

function Breakdown({ titulo, rows, total }: { titulo: string; rows: { label: string; qtd: number; valor: number }[]; total: number }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{titulo}</h4>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.qtd / total) * 100) : 0;
          return (
            <div key={r.label} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-gray-700 dark:text-zinc-300">{r.label}</span>
                <span className="shrink-0 tabular-nums text-xs text-gray-500 dark:text-zinc-400">
                  {r.qtd} · {pct}% · {formatCurrencyNoDecimals(r.valor)}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full rounded bg-gray-100 dark:bg-zinc-800">
                <div className="h-1.5 rounded bg-red-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChurnMesDrawer({
  mes, cancelamentos, open, onOpenChange,
}: {
  mes: string | null;
  cancelamentos: Cancelamento[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const total = cancelamentos.length;
  const totalValor = cancelamentos.reduce((a, c) => a + c.valorp, 0);

  const porEntrega = agrupa(cancelamentos, (c) => `${c.nivel}ª entrega`);
  const porMotivo = agrupa(cancelamentos, (c) => rotuloDim(c.motivo));
  const porOperador = agrupa(cancelamentos, (c) => rotuloDim(c.responsavel));

  const tooltipStyle = {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
    borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Churn em {mes}</SheetTitle>
          <SheetDescription>{total} cancelamento(s) · {formatCurrencyNoDecimals(totalValor)} perdidos</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Churn por entrega</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={porEntrega} dataKey="qtd" nameKey="label" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {porEntrega.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, _n, item: any) => [`${v} cancelamento(s) · ${formatCurrencyNoDecimals(item.payload.valor)}`, item.payload.label]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <Breakdown titulo="% por motivo" rows={porMotivo} total={total} />
          <Breakdown titulo="% por operador (responsável)" rows={porOperador} total={total} />

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Contratos churnados ({total})
            </h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Entrega</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cancelamentos.slice().sort((a, b) => b.valorp - a.valorp).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell>{c.nomeCliente ?? "—"}</TableCell>
                      <TableCell>{c.produto}</TableCell>
                      <TableCell className="text-center tabular-nums">{c.nivel}ª</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrencyNoDecimals(c.valorp)}</TableCell>
                      <TableCell>{c.responsavel ?? "—"}</TableCell>
                      <TableCell>{c.motivo ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

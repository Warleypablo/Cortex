import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { cancelamentosDe, rotuloDim, type Cancelamento } from "./utils";
import type { Jornada } from "./types";

type DimKey = "motivo" | "squad" | "responsavel" | "cs";
const LABELS: Record<DimKey, string> = {
  motivo: "Motivo do churn", squad: "Squad", responsavel: "Responsável", cs: "CS",
};
const pick = (c: Cancelamento, dim: DimKey) =>
  rotuloDim(dim === "motivo" ? c.motivo : dim === "squad" ? c.squad : dim === "responsavel" ? c.responsavel : c.cs);

export function ChurnPorDimensao({ jornadas }: { jornadas: Jornada[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const [dim, setDim] = useState<DimKey>("motivo");
  const [drillLabel, setDrillLabel] = useState<string | null>(null);

  const cancelamentos = cancelamentosDe(jornadas);

  const map = new Map<string, { label: string; qtd: number; valorp: number }>();
  for (const c of cancelamentos) {
    const label = pick(c, dim);
    const cur = map.get(label) ?? { label, qtd: 0, valorp: 0 };
    cur.qtd += 1;
    cur.valorp += c.valorp;
    map.set(label, cur);
  }
  const rows = Array.from(map.values()).sort((a, b) => b.qtd - a.qtd || b.valorp - a.valorp).slice(0, 12);

  const drillList = drillLabel
    ? cancelamentos.filter((c) => pick(c, dim) === drillLabel).sort((a, b) => b.valorp - a.valorp)
    : [];

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Churn por dimensão</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Cancelamentos agrupados — clique numa barra para ver os contratos
          </p>
        </div>
        <Select value={dim} onValueChange={(v) => { setDim(v as DimKey); setDrillLabel(null); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(LABELS) as DimKey[]).map((k) => (
              <SelectItem key={k} value={k}>{LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fill: axis, fontSize: 11 }} width={160} />
            <Tooltip
              cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number, _n, item: any) =>
                [`${v} cancelamento(s) — ${formatCurrencyNoDecimals(item.payload.valorp)}`, "Churn"]}
            />
            <Bar
              dataKey="qtd" name="Churn" fill="#ef4444" radius={[0, 4, 4, 0]} cursor="pointer"
              onClick={(d: any) => { const l = d?.payload?.label ?? d?.label; if (l) setDrillLabel(l); }}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>

      <Dialog open={!!drillLabel} onOpenChange={(o) => !o && setDrillLabel(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{LABELS[dim]}: {drillLabel}</DialogTitle>
            <DialogDescription>{drillList.length} cancelamento(s) — ordenado por valor pontual</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Entrega</TableHead>
                  <TableHead className="text-right">Valor pontual</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>CS</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillList.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{c.nomeCliente ?? "—"}</TableCell>
                    <TableCell>{c.produto}</TableCell>
                    <TableCell className="text-center tabular-nums">{c.nivel}ª</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyNoDecimals(c.valorp)}</TableCell>
                    <TableCell>{c.responsavel ?? "—"}</TableCell>
                    <TableCell>{c.cs ?? "—"}</TableCell>
                    <TableCell>{c.squad ?? "—"}</TableCell>
                    <TableCell>{c.motivo ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

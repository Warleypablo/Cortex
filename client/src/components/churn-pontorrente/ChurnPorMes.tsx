import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { cancelamentosDe } from "./utils";
import type { Jornada } from "./types";

const mesKey = (d: string | null) => (d ? d.slice(0, 7) : "(sem data)");

export function ChurnPorMes({ jornadas }: { jornadas: Jornada[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const [drillMes, setDrillMes] = useState<string | null>(null);

  const canc = cancelamentosDe(jornadas);
  const map = new Map<string, { mes: string; qtd: number; valor: number }>();
  for (const c of canc) {
    const mes = mesKey(c.dataEncerramento);
    const cur = map.get(mes) ?? { mes, qtd: 0, valor: 0 };
    cur.qtd += 1; cur.valor += c.valorp; map.set(mes, cur);
  }
  const rows = Array.from(map.values()).sort((a, b) =>
    a.mes === "(sem data)" ? 1 : b.mes === "(sem data)" ? -1 : a.mes.localeCompare(b.mes),
  );

  const drillList = drillMes
    ? canc.filter((c) => mesKey(c.dataEncerramento) === drillMes).sort((a, b) => b.valorp - a.valorp)
    : [];

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Churn por mês</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Valor perdido por mês de cancelamento — clique numa barra para ver os contratos
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">Sem cancelamentos no filtro atual</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rows} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 12 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} />
              <Tooltip
                cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  backgroundColor: isDark ? "#18181b" : "#ffffff",
                  border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                  borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827",
                }}
                formatter={(v: number, _n, item: any) =>
                  [`${formatCurrencyNoDecimals(v)} · ${item.payload.qtd} cancelamento(s)`, "Churn"]}
              />
              <Bar
                dataKey="valor" name="Valor perdido" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={70} cursor="pointer"
                onClick={(d: any) => { const m = d?.payload?.mes ?? d?.mes; if (m) setDrillMes(m); }}
              >
                <LabelList dataKey="valor" position="top" style={{ fill: axis, fontSize: 10 }} formatter={(v: number) => (v > 0 ? formatCurrencyNoDecimals(v) : "")} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>

      <Dialog open={!!drillMes} onOpenChange={(o) => !o && setDrillMes(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cancelamentos em {drillMes}</DialogTitle>
            <DialogDescription>{drillList.length} contrato(s) — ordenado por valor pontual</DialogDescription>
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

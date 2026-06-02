import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { ProdutoBenchmark } from "./types";

export function BenchmarkProduto({ produtos }: { produtos: ProdutoBenchmark[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const chartData = produtos.slice(0, 10).map((p) => ({
    produto: p.produto,
    ltvMedio: p.ltvMedio,
    revChurnPct: p.revChurnPct,
  }));

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Benchmark por produto</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">Comparação entre todos os produtos (não afetada pelo filtro de produto acima)</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis
              dataKey="produto"
              tick={{ fill: axis, fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v: number) => formatCurrencyNoDecimals(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) => formatCurrencyNoDecimals(v)}
            />
            <Bar dataKey="ltvMedio" fill="#6366f1" radius={[4, 4, 0, 0]} name="LTV médio" />
          </BarChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Cancelados</TableHead>
                <TableHead className="text-right">LT cancel. (m)</TableHead>
                <TableHead className="text-right">LTV médio</TableHead>
                <TableHead className="text-right">MRR ativo</TableHead>
                <TableHead className="text-right">Rev. churn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((p) => (
                <TableRow key={p.produto}>
                  <TableCell className="font-medium">{p.produto}</TableCell>
                  <TableCell className="text-right">{p.nAtivos}</TableCell>
                  <TableCell className="text-right">{p.nCancelados}</TableCell>
                  <TableCell className="text-right">{p.ltMedioCancelado}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(p.ltvMedio)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(p.mrrAtivo)}</TableCell>
                  <TableCell className="text-right">{p.revChurnPct}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

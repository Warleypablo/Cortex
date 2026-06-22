import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { FluxoPonto } from "./types";

type Metrica = "qtd" | "valor";

export function FluxoMensal() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const [metrica, setMetrica] = useState<Metrica>("valor");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/estoque-pontual/fluxo"],
    queryFn: () => fetchJson<{ serie: FluxoPonto[] }>("/api/estoque-pontual/fluxo?meses=8"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  const isValor = metrica === "valor";
  const fmt = (v: number) => (isValor ? formatCurrencyNoDecimals(v) : String(v));

  // Saldo (Δ) = entradas − entregas: o quanto o estoque cresceu (ou encolheu) no mês.
  const chartData = data.serie.map((p) => ({
    mes: p.mes,
    entradas: isValor ? p.valEntrada : p.entradas,
    entregas: isValor ? p.valEntregue : p.entregas,
    saldo: isValor ? p.valEntrada - p.valEntregue : p.entradas - p.entregas,
  }));

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Fluxo mensal: vendas × entregas</CardTitle>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Entradas (pontuais criados) e entregas (data de entrega) por mês · linha = saldo (Δ estoque)
            </p>
          </div>
          <Select value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
            <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qtd">Quantidade</SelectItem>
              <SelectItem value="valor">Valor (R$)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmt} width={isValor ? 72 : 40} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) => fmt(v)}
            />
            <Legend />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            <Bar dataKey="entradas" fill="#6366f1" name="Vendas (entradas)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="entregas" fill="#10b981" name="Entregas" radius={[4, 4, 0, 0]} />
            <Line
              dataKey="saldo"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
              type="monotone"
              name="Saldo (Δ estoque)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

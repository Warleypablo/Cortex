import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { ProdutoBenchmark } from "./types";

type Situacao = "ambos" | "ativo" | "cancelado";

export function LtLtvPorProduto({ produtos }: { produtos: ProdutoBenchmark[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const [situacao, setSituacao] = useState<Situacao>("ambos");
  const [agregador, setAgregador] = useState<"media" | "mediana">("media");

  const pick = (p: ProdutoBenchmark) => {
    if (agregador === "mediana") {
      if (situacao === "ativo") return { lt: p.ltMedianaAtivo, ltv: p.ltvMedianaAtivo };
      if (situacao === "cancelado") return { lt: p.ltMedianaCancelado, ltv: p.ltvMediana };
      return { lt: p.ltMedianaGeral, ltv: p.ltvMedianaGeral };
    }
    if (situacao === "ativo") return { lt: p.ltMedioAtivo, ltv: p.ltvMedioAtivo };
    if (situacao === "cancelado") return { lt: p.ltMedioCancelado, ltv: p.ltvMedio };
    return { lt: p.ltMedioGeral, ltv: p.ltvMedioGeral };
  };

  const data = produtos
    .filter((p) => p.produto)
    .map((p) => ({ produto: p.produto, ...pick(p) }))
    .filter((d) => d.lt > 0 || d.ltv > 0)
    .slice(0, 10);

  const labelAgregador = agregador === "media" ? "médio" : "mediano";
  const subtitulo =
    situacao === "ativo"
      ? "Contratos ativos (LT em curso)"
      : situacao === "cancelado"
        ? "Contratos cancelados (LT fechado)"
        : "Ativos + cancelados";

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">LT e LTV por produto</CardTitle>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              LT {labelAgregador} (meses, esq.) e LTV {labelAgregador} (R$, dir.) · {subtitulo}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={agregador} onValueChange={(v) => setAgregador(v as "media" | "mediana")}>
              <SelectTrigger className="w-[120px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="mediana">Mediana</SelectItem>
              </SelectContent>
            </Select>
            <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
              <SelectTrigger className="w-[170px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Ativos e cancelados</SelectItem>
                <SelectItem value="ativo">Apenas ativos</SelectItem>
                <SelectItem value="cancelado">Apenas cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis
              dataKey="produto"
              tick={{ fill: axis, fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="lt"
              tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v) => `${v}m`}
            />
            <YAxis
              yAxisId="ltv"
              orientation="right"
              tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v) => formatCurrencyNoDecimals(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number, name: string) =>
                name.includes("LTV") ? formatCurrencyNoDecimals(v) : `${v} m`
              }
            />
            <Legend />
            <Bar yAxisId="lt" dataKey="lt" fill="#0ea5e9" radius={[4, 4, 0, 0]} name={`LT ${labelAgregador} (m)`} />
            <Bar yAxisId="ltv" dataKey="ltv" fill="#6366f1" radius={[4, 4, 0, 0]} name={`LTV ${labelAgregador}`} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

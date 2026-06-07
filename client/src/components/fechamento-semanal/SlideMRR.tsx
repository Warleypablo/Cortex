import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface MrrPonto {
  mes: string;
  mesLabel: string;
  mrr: number;
}

export default function SlideMRR({ semanaInicio }: SlideProps) {
  const mesAno = semanaInicio.substring(0, 7);

  const { data, isLoading } = useQuery<MrrPonto[]>({
    queryKey: ["/api/visao-geral/mrr-evolucao", mesAno],
    queryFn: async () => {
      const res = await fetch(`/api/visao-geral/mrr-evolucao?mesAno=${mesAno}&qtdMeses=9`);
      return res.json();
    },
  });

  const chartData = data?.slice(-8) ?? [];
  const atual = chartData[chartData.length - 1]?.mrr ?? 0;
  const anterior = chartData[chartData.length - 2]?.mrr ?? 0;
  const delta = atual - anterior;
  const pct = anterior > 0 ? (delta / anterior) * 100 : 0;

  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-zinc-400";

  return (
    <div className="h-full flex flex-col items-center justify-center bg-zinc-950 text-white px-16 py-12">
      <h2 className="text-3xl font-bold text-zinc-300 mb-10">MRR Atual</h2>

      {isLoading ? (
        <Skeleton className="h-24 w-64 bg-zinc-800" />
      ) : (
        <>
          <div className="flex items-end gap-6 mb-4">
            <span className="text-7xl font-bold tabular-nums">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(atual)}
            </span>
            <div className={`flex items-center gap-1 mb-3 ${trendColor}`}>
              <TrendIcon className="h-6 w-6" />
              <span className="text-xl font-semibold">{Math.abs(pct).toFixed(1)}%</span>
            </div>
          </div>
          <p className="text-zinc-500 text-sm mb-12">
            {delta > 0 ? "+" : ""}{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(delta)} vs mês anterior
          </p>
        </>
      )}

      {chartData.length > 0 && (
        <div className="w-full max-w-2xl h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mesLabel" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => [formatCurrencyCompact(v), "MRR"]}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Area type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={2} fill="url(#mrrGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

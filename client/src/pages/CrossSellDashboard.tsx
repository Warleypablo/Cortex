import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Phone, DollarSign, TrendingUp, BarChart3, Sparkles } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ETAPA_LABELS: Record<string, string> = {
  fazer_contato: "Fazer contato",
  tentativa_contato: "Tentativa de contato",
  reuniao_agendada: "Reuniao agendada",
  em_contato: "Em contato",
  proposta_enviada: "Proposta enviada",
  forte_interesse: "Forte interesse",
  descartado: "Descartado",
  sugerido_sistema: "Sugerido",
};

const ETAPA_COLORS: Record<string, string> = {
  fazer_contato: "#94a3b8",
  tentativa_contato: "#fb923c",
  reuniao_agendada: "#facc15",
  em_contato: "#38bdf8",
  proposta_enviada: "#3b82f6",
  forte_interesse: "#a855f7",
  descartado: "#ef4444",
  sugerido_sistema: "#818cf8",
};

const MONTHS = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Marco" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const YEARS = ["2024", "2025", "2026"];

const CX_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899", "#6366f1"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  kpis: {
    reunioesAgendadas: number;
    reunioesRealizadas: number;
    totalRNegociacao: number;
    totalPNegociacao: number;
    taxaConversao: number;
    sugestoesAtivas: number;
    taxaAceitacao: number;
    clientesEmNegociacao: number;
    coberturaBase: number;
  };
  funilEtapas: Array<{ etapa: string; total: number }>;
  reunioesPorCx: Array<{ cxResponsavel: string; total: number }>;
  rankingValor: Array<{ cxResponsavel: string; totalR: number; totalP: number; totalDeals: number }>;
  rankingReunioes: Array<{ cxResponsavel: string; totalReunioes: number }>;
}

// ---------------------------------------------------------------------------
// Medal helper
// ---------------------------------------------------------------------------

function medal(index: number): string {
  if (index === 0) return "\u{1F947} ";
  if (index === 1) return "\u{1F948} ";
  if (index === 2) return "\u{1F949} ";
  return "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CrossSellDashboard() {
  useSetPageInfo("CrossSell Dashboard", "Análise de oportunidades de cross-sell");

  const now = new Date();
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [ano, setAno] = useState(String(now.getFullYear()));

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["crosssell-dashboard", mes, ano],
    queryFn: async () => {
      const res = await fetch(`/api/comercial/crosssell/dashboard?mes=${mes}&ano=${ano}`);
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });

  // Prepare chart data
  const funilData = (data?.funilEtapas ?? []).map((e) => ({
    name: ETAPA_LABELS[e.etapa] ?? e.etapa,
    value: Number(e.total),
    etapa: e.etapa,
  }));

  const reunioesCxData = (data?.reunioesPorCx ?? []).map((r) => ({
    name: r.cxResponsavel ?? "N/A",
    value: Number(r.total),
  }));

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Period filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-[120px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-4">
          <KpiCard
            title="Reunioes Agendadas"
            value={String(data?.kpis.reunioesAgendadas ?? 0)}
            icon={<Calendar className="h-5 w-5 text-amber-500" />}
          />
          <KpiCard
            title="Reunioes Realizadas"
            value={String(data?.kpis.reunioesRealizadas ?? 0)}
            icon={<Phone className="h-5 w-5 text-green-500" />}
          />
          <KpiCard
            title="Total Negociacao R"
            value={formatCurrency(data?.kpis.totalRNegociacao ?? 0)}
            icon={<DollarSign className="h-5 w-5 text-blue-500" />}
            accent="text-blue-600 dark:text-blue-400"
          />
          <KpiCard
            title="Total Negociacao P"
            value={formatCurrency(data?.kpis.totalPNegociacao ?? 0)}
            icon={<DollarSign className="h-5 w-5 text-purple-500" />}
            accent="text-purple-600 dark:text-purple-400"
          />
          <KpiCard
            title="Taxa de Conversao"
            value={`${data?.kpis.taxaConversao ?? 0}%`}
            icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <KpiCard
            title="Sugestoes Ativas"
            value={String(data?.kpis.sugestoesAtivas ?? 0)}
            icon={<Sparkles className="h-5 w-5 text-indigo-500" />}
            accent="text-indigo-600 dark:text-indigo-400"
          />
          <KpiCard
            title="Taxa Aceitacao"
            value={`${data?.kpis.taxaAceitacao ?? 0}%`}
            icon={<TrendingUp className="h-5 w-5 text-cyan-500" />}
            accent="text-cyan-600 dark:text-cyan-400"
          />
          <KpiCard
            title="Clientes em Negociacao"
            value={String(data?.kpis.clientesEmNegociacao ?? 0)}
            icon={<BarChart3 className="h-5 w-5 text-pink-500" />}
            accent="text-pink-600 dark:text-pink-400"
          />
          <KpiCard
            title="Cobertura da Base"
            value={`${data?.kpis.coberturaBase ?? 0}%`}
            icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
            accent="text-orange-600 dark:text-orange-400"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil por Etapa */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Funil por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : funilData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(250, funilData.length * 42)}>
                <BarChart data={funilData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--tooltip-bg, #fff)",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="value" name="Total" radius={[0, 4, 4, 0]} barSize={22}>
                    {funilData.map((entry) => (
                      <Cell key={entry.etapa} fill={ETAPA_COLORS[entry.etapa] ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Reunioes por CX */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Reunioes por CX
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : reunioesCxData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(250, reunioesCxData.length * 42)}>
                <BarChart data={reunioesCxData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--tooltip-bg, #fff)",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="value" name="Reunioes" radius={[0, 4, 4, 0]} barSize={22}>
                    {reunioesCxData.map((_, i) => (
                      <Cell key={i} fill={CX_COLORS[i % CX_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking Valor */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Ranking Valor Gerado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full rounded-lg" />
            ) : !data?.rankingValor?.length ? (
              <EmptyState />
            ) : (
              <div className="space-y-3">
                {data.rankingValor.map((r, i) => (
                  <div
                    key={r.cxResponsavel}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-zinc-800"
                  >
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {medal(i)}{r.cxResponsavel ?? "N/A"}
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        R {formatCurrency(Number(r.totalR))}
                      </span>
                      <span className="text-purple-600 dark:text-purple-400 font-semibold">
                        P {formatCurrency(Number(r.totalP))}
                      </span>
                      <span className="text-gray-500 dark:text-zinc-400 text-xs">
                        {r.totalDeals} deal{Number(r.totalDeals) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking Reunioes */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Ranking Reunioes Agendadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full rounded-lg" />
            ) : !data?.rankingReunioes?.length ? (
              <EmptyState />
            ) : (
              <div className="space-y-3">
                {data.rankingReunioes.map((r, i) => (
                  <div
                    key={r.cxResponsavel}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-zinc-800"
                  >
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {medal(i)}{r.cxResponsavel ?? "N/A"}
                    </span>
                    <span className="text-gray-700 dark:text-zinc-300 font-semibold text-sm">
                      {Number(r.totalReunioes)} reunioes
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  icon,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium uppercase tracking-wide">
            {title}
          </span>
          {icon}
        </div>
        <p className={`text-2xl font-bold ${accent ?? "text-gray-900 dark:text-white"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-48 text-gray-400 dark:text-zinc-500 text-sm">
      Sem dados no periodo
    </div>
  );
}

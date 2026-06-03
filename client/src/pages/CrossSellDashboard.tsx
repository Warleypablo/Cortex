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
import { TrendingUp, DollarSign, Trophy, Calendar } from "lucide-react";

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
  ganho: "Ganho",
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
  ganho: "#22c55e",
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
  kpisAnterior: {
    totalRNegociacao: number;
    totalPNegociacao: number;
    reunioesAgendadas: number;
    taxaConversao: number;
    coberturaBase: number;
  };
  topClientes: Array<{
    cnpj: string;
    clienteNome: string | null;
    etapa: string;
    valorR: number;
    oportunidadeId: number;
  }>;
  funilEtapas: Array<{ etapa: string; total: number }>;
  reunioesPorCx: Array<{ cxResponsavel: string; total: number }>;
  rankingValor: Array<{ cxResponsavel: string; totalR: number; totalP: number; totalDeals: number }>;
  rankingReunioes: Array<{ cxResponsavel: string; totalReunioes: number }>;
}

// ---------------------------------------------------------------------------
// Delta helper
// ---------------------------------------------------------------------------

type DeltaDirection = "up" | "down" | "flat";

interface Delta {
  text: string;
  direction: DeltaDirection;
}

/**
 * Computes a delta string between current and previous values.
 * - "currency" / "count": shows percentage change.
 * - "percent": shows percentage-point difference (pp).
 *
 * Special cases:
 * - prev === 0 && curr > 0 → "novo" (up)
 * - prev === 0 && curr === 0 → "—" (flat)
 */
function formatDelta(
  curr: number,
  prev: number,
  type: "currency" | "count" | "percent",
): Delta {
  if (prev === 0) {
    return curr > 0
      ? { text: "novo", direction: "up" }
      : { text: "—", direction: "flat" };
  }
  const diff = curr - prev;
  const direction: DeltaDirection = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "";
  if (type === "percent") {
    const pp = Math.abs(diff).toFixed(1);
    return { text: `${arrow} ${pp}pp vs mês ant.`, direction };
  }
  const pct = Math.abs((diff / prev) * 100).toFixed(0);
  return { text: `${arrow} ${pct}% vs mês ant.`, direction };
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

  // KPI deltas
  const deltaR = data
    ? formatDelta(data.kpis.totalRNegociacao, data.kpisAnterior.totalRNegociacao, "currency")
    : { text: "", direction: "flat" as const };
  const deltaP = data
    ? formatDelta(data.kpis.totalPNegociacao, data.kpisAnterior.totalPNegociacao, "currency")
    : { text: "", direction: "flat" as const };
  const deltaReunioes = data
    ? formatDelta(data.kpis.reunioesAgendadas, data.kpisAnterior.reunioesAgendadas, "count")
    : { text: "", direction: "flat" as const };
  const deltaConv = data
    ? formatDelta(data.kpis.taxaConversao, data.kpisAnterior.taxaConversao, "percent")
    : { text: "", direction: "flat" as const };
  // Cobertura: prev é sempre 0 (sem snapshot histórico). Forçamos delta neutro.
  const deltaCobertura: Delta = { text: "—", direction: "flat" };

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

      {/* Hero + Secondary KPIs */}
      {isLoading ? (
        <>
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </>
      ) : (
        <>
          <HeroKpi
            label="PIPELINE EM NEGOCIAÇÃO · RECORRENTE"
            value={formatCurrency(data?.kpis.totalRNegociacao ?? 0)}
            delta={deltaR}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SecondaryKpiCard
              label="Negociação P"
              value={formatCurrency(data?.kpis.totalPNegociacao ?? 0)}
              delta={deltaP}
            />
            <SecondaryKpiCard
              label="Reuniões Agendadas"
              value={String(data?.kpis.reunioesAgendadas ?? 0)}
              delta={deltaReunioes}
            />
            <SecondaryKpiCard
              label="Taxa Conversão"
              value={`${data?.kpis.taxaConversao ?? 0}%`}
              delta={deltaConv}
            />
            <SecondaryKpiCard
              label="Cobertura da Base"
              value={`${data?.kpis.coberturaBase ?? 0}%`}
              delta={deltaCobertura}
            />
          </div>
        </>
      )}

      {/* Section: Pipeline */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400 mb-3 px-1">
          Pipeline
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Funil de Conversão
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : (
                <ConversionFunnel data={data?.funilEtapas ?? []} />
              )}
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Top Clientes em Negociação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <TopClientesList data={data?.topClientes ?? []} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section: Performance da Equipe */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400 mb-3 px-1">
          Performance da Equipe
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Valor Gerado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <PodiumRanking
                  data={(data?.rankingValor ?? []).map((r) => ({
                    name: r.cxResponsavel,
                    primaryValue: Number(r.totalR),
                    secondaryDeals: Number(r.totalDeals),
                    secondaryP: Number(r.totalP),
                  }))}
                  metric="valor"
                />
              )}
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Reuniões Agendadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <PodiumRanking
                  data={(data?.rankingReunioes ?? []).map((r) => ({
                    name: r.cxResponsavel,
                    primaryValue: Number(r.totalReunioes),
                  }))}
                  metric="reunioes"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-48 text-gray-400 dark:text-zinc-500 text-sm">
      Sem dados no periodo
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeroKpi — KPI gigante com gradiente. O número que importa.
// ---------------------------------------------------------------------------

function HeroKpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: Delta;
}) {
  return (
    <div className="rounded-2xl p-6 text-white relative overflow-hidden
                    bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-500
                    dark:from-indigo-700 dark:via-purple-700 dark:to-purple-600">
      <div
        className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/15 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <p className="text-xs font-semibold tracking-widest text-white/85 relative">
        {label}
      </p>
      <p className="text-4xl font-extrabold mt-1.5 leading-tight relative">
        {value}
      </p>
      <span
        className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full
                   bg-white/20 text-white text-xs font-semibold relative"
      >
        {delta.text}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SecondaryKpiCard — card branco/zinc com label, valor e delta colorido.
// ---------------------------------------------------------------------------

function SecondaryKpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: Delta;
}) {
  const deltaColor =
    delta.direction === "up"
      ? "text-green-600 dark:text-green-400"
      : delta.direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-400 dark:text-zinc-500";

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {value}
      </p>
      <p className={`text-xs font-semibold mt-1 ${deltaColor}`}>
        {delta.text}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConversionFunnel — funil custom em divs. Mostra cada etapa em ordem,
// barra proporcional ao topo, e taxa de conversão entre etapas consecutivas.
// 'descartado' é omitido (ramo lateral, não conversão).
// ---------------------------------------------------------------------------

const FUNNEL_ORDER = [
  "sugerido_sistema",
  "fazer_contato",
  "tentativa_contato",
  "em_contato",
  "reuniao_agendada",
  "proposta_enviada",
  "forte_interesse",
  "ganho",
] as const;

function ConversionFunnel({
  data,
}: {
  data: Array<{ etapa: string; total: number }>;
}) {
  // Build a lookup and project onto FUNNEL_ORDER (zero for missing)
  const counts: Record<string, number> = {};
  for (const d of data) counts[d.etapa] = Number(d.total);

  const stages = FUNNEL_ORDER.map((etapa) => ({
    etapa,
    label: ETAPA_LABELS[etapa] ?? etapa,
    color: ETAPA_COLORS[etapa] ?? "#6b7280",
    count: counts[etapa] ?? 0,
  }));

  const max = Math.max(...stages.map((s) => s.count), 1);

  if (stages.every((s) => s.count === 0)) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const widthPct = max > 0 ? (s.count / max) * 100 : 0;
        const prev = i > 0 ? stages[i - 1].count : null;
        const conv = prev != null && prev > 0 ? (s.count / prev) * 100 : null;
        return (
          <div
            key={s.etapa}
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: "110px 1fr 50px" }}
          >
            <span className="text-xs text-gray-700 dark:text-zinc-300 font-medium truncate">
              {s.label}
            </span>
            <div className="relative h-7">
              {conv !== null && (
                <span
                  className="absolute -top-3 right-0 text-[9px] text-gray-400 dark:text-zinc-500 px-1
                             bg-white dark:bg-zinc-900"
                >
                  ↓ {conv.toFixed(0)}%
                </span>
              )}
              <div
                className="h-full rounded flex items-center px-2 text-white text-xs font-semibold
                           transition-[width] duration-300"
                style={{ width: `${Math.max(widthPct, 2)}%`, backgroundColor: s.color }}
              >
                {s.count > 0 ? s.count : ""}
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-900 dark:text-white text-right">
              {s.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopClientesList — top 5 clientes em negociação por valor R.
// Cada linha: badge da etapa, nome, valor R. Background com gradient.
// ---------------------------------------------------------------------------

function TopClientesList({
  data,
}: {
  data: Array<{
    cnpj: string;
    clienteNome: string | null;
    etapa: string;
    valorR: number;
    oportunidadeId: number;
  }>;
}) {
  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  const max = Math.max(...data.map((d) => d.valorR), 1);

  return (
    <div className="space-y-1.5">
      {data.map((c) => {
        const widthPct = (c.valorR / max) * 100;
        const etapaLabel = ETAPA_LABELS[c.etapa] ?? c.etapa;
        const etapaColor = ETAPA_COLORS[c.etapa] ?? "#6b7280";
        return (
          <div
            key={c.oportunidadeId}
            className="grid items-center gap-2 px-2.5 py-2 rounded-lg
                       text-sm"
            style={{
              gridTemplateColumns: "auto 1fr auto",
              backgroundImage: `linear-gradient(90deg, rgba(99,102,241,0.08) ${widthPct}%, transparent ${widthPct}%)`,
            }}
          >
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold whitespace-nowrap"
              style={{ backgroundColor: etapaColor }}
            >
              {etapaLabel}
            </span>
            <span className="text-gray-900 dark:text-white font-medium truncate">
              {c.clienteNome ?? c.cnpj}
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap">
              {formatCurrency(c.valorR)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PodiumRanking — top 3 em formato pódio + linhas 4º a 7º em lista compacta.
// Suporta 2 métricas: "valor" (R$) ou "reunioes" (número).
// ---------------------------------------------------------------------------

interface PodiumPerson {
  name: string;
  primaryValue: number;     // valor R em "valor", número de reuniões em "reunioes"
  secondaryDeals?: number;  // só para "valor": número de deals
  secondaryP?: number;      // só para "valor": valor P
}

function PodiumRanking({
  data,
  metric,
}: {
  data: PodiumPerson[];
  metric: "valor" | "reunioes";
}) {
  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  const formatVal = (v: number) =>
    metric === "valor" ? formatCurrency(v) : `${v}`;

  const top3 = data.slice(0, 3);
  const rest = data.slice(3, 7); // 4º a 7º

  // Pódio order: 2nd left, 1st center (bigger), 3rd right
  const podiumDisplayOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as PodiumPerson[];

  return (
    <div>
      <div className="grid gap-2 items-end" style={{ gridTemplateColumns: "1fr 1.2fr 1fr" }}>
        {podiumDisplayOrder.map((p) => {
          // Determine actual rank (top3 index) by lookup
          const rank = top3.indexOf(p) + 1;
          const isFirst = rank === 1;
          const medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
          return (
            <div
              key={p.name}
              className={`text-center rounded-xl border bg-white dark:bg-zinc-900 ${
                isFirst
                  ? "border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.25)] dark:border-amber-500 py-4"
                  : "border-gray-200 dark:border-zinc-700 py-3"
              } px-2`}
            >
              <div className={isFirst ? "text-3xl leading-none" : "text-xl leading-none"}>
                {medalEmoji}
              </div>
              <div className="text-xs font-semibold text-gray-900 dark:text-white mt-1.5 truncate">
                {p.name || "—"}
              </div>
              <div
                className={`font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 ${
                  isFirst ? "text-base" : "text-sm"
                }`}
              >
                {formatVal(p.primaryValue)}
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div className="mt-3 space-y-0.5">
          {rest.map((p, i) => (
            <div
              key={p.name}
              className="grid items-center gap-2 px-2 py-1 text-xs"
              style={{ gridTemplateColumns: "20px 1fr 80px" }}
            >
              <span className="text-gray-400 dark:text-zinc-500">{i + 4}º</span>
              <span className="text-gray-700 dark:text-zinc-300 truncate">{p.name || "—"}</span>
              <span className="text-right font-semibold text-gray-900 dark:text-white">
                {formatVal(p.primaryValue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

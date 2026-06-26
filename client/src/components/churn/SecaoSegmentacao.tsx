import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart as RechartsPie,
  Pie,
} from "recharts";
import { DollarSign, Users, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type ChurnContract } from "@/components/churn/types";
import { TechChartCard } from "@/components/churn/ui/TechChartCard";
import { SectionBlock } from "@/components/churn/ui/SectionBlock";
import { StatPill } from "@/components/churn/ui/StatPill";
import { CustomTooltip } from "@/components/churn/ui/CustomTooltip";
import { formatCurrencyNoDecimals } from "@/lib/utils";

export interface SecaoSegmentacaoProps {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}

const REFINED_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

export function SecaoSegmentacao({ contratos, onDrill }: SecaoSegmentacaoProps): JSX.Element {
  // MRR Perdido por Squad (churn only, excluding irrelevant squads)
  const distribuicaoPorSquad = useMemo(() => {
    const churnOnly = contratos.filter(c => c.tipo === "churn" && !c.is_abonado);
    if (churnOnly.length === 0) return [];

    const squadCounts: Record<string, { count: number; mrr: number }> = {};
    churnOnly.forEach(c => {
      const squad = c.squad || "Não especificado";
      if (!squadCounts[squad]) squadCounts[squad] = { count: 0, mrr: 0 };
      squadCounts[squad].count++;
      squadCounts[squad].mrr += c.valorr || 0;
    });

    const total = churnOnly.length;
    return Object.entries(squadCounts)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        fullName: name,
        count: data.count,
        mrr: data.mrr,
        percentual: (data.count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [contratos]);

  // Distribuição por Serviço/Produto
  const distribuicaoPorProduto = useMemo(() => {
    if (contratos.length === 0) return [];

    const prodCounts: Record<string, { count: number; mrr: number }> = {};
    contratos.forEach(c => {
      const servico = c.servico || "Não especificado";
      if (!prodCounts[servico]) prodCounts[servico] = { count: 0, mrr: 0 };
      prodCounts[servico].count++;
      prodCounts[servico].mrr += c.valorr || 0;
    });

    const total = contratos.length;
    return Object.entries(prodCounts)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        fullName: name,
        count: data.count,
        mrr: data.mrr,
        percentual: (data.count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [contratos]);

  // Distribuição por Responsável
  const distribuicaoPorResponsavel = useMemo(() => {
    if (contratos.length === 0) return [];

    const respCounts: Record<string, { count: number; mrr: number }> = {};
    contratos.forEach(c => {
      const resp = c.responsavel || "Não especificado";
      if (!respCounts[resp]) respCounts[resp] = { count: 0, mrr: 0 };
      respCounts[resp].count++;
      respCounts[resp].mrr += c.valorr || 0;
    });

    const total = contratos.length;
    return Object.entries(respCounts)
      .map(([name, data]) => ({
        name: name.length > 12 ? name.substring(0, 12) + "..." : name,
        fullName: name,
        count: data.count,
        mrr: data.mrr,
        percentual: (data.count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [contratos]);

  // Distribuição por Faixa de Ticket (MRR)
  const distribuicaoPorTicket = useMemo(() => {
    if (contratos.length === 0) return [];

    const ranges = [
      { name: "< R$1k", min: 0, max: 1000, count: 0, mrr: 0 },
      { name: "R$1k-3k", min: 1000, max: 3000, count: 0, mrr: 0 },
      { name: "R$3k-5k", min: 3000, max: 5000, count: 0, mrr: 0 },
      { name: "R$5k-10k", min: 5000, max: 10000, count: 0, mrr: 0 },
      { name: "> R$10k", min: 10000, max: Infinity, count: 0, mrr: 0 },
    ];

    contratos.forEach(c => {
      const valor = c.valorr || 0;
      for (const range of ranges) {
        if (valor >= range.min && valor < range.max) {
          range.count++;
          range.mrr += valor;
          break;
        }
      }
    });

    const total = contratos.length;
    return ranges
      .map(r => ({
        ...r,
        percentual: total > 0 ? (r.count / total) * 100 : 0,
      }))
      .filter(r => r.count > 0);
  }, [contratos]);

  const mrrSquadTotal = distribuicaoPorSquad.reduce((sum, item) => sum + item.mrr, 0);
  const mrrResponsavelTotal = distribuicaoPorResponsavel.reduce((sum, item) => sum + item.mrr, 0);
  const topServico = distribuicaoPorProduto[0];
  const topTicket =
    distribuicaoPorTicket.length > 0
      ? distribuicaoPorTicket.reduce((best, item) => (item.count > best.count ? item : best))
      : undefined;

  return (
    <SectionBlock
      title="Segmentacao"
      subtitle="Onde o churn se concentra"
      icon={Users}
      accent="bg-gradient-to-r from-cyan-500 to-blue-500"
    >
      {/* Row 1: Serviço + Squad + Responsável */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribuição por Serviço */}
        <TechChartCard
          title="Distribuição por Serviço"
          subtitle="Percentual de churn por serviço"
          icon={BarChart3}
          iconBg="bg-gradient-to-r from-blue-500 to-indigo-500"
          meta={
            <StatPill
              label="Top servico"
              value={topServico ? `${topServico.name} (${topServico.percentual.toFixed(0)}%)` : "-"}
              tone="info"
            />
          }
        >
          {distribuicaoPorProduto.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {distribuicaoPorProduto.map((item, i) => {
                const color = REFINED_COLORS[i % REFINED_COLORS.length];
                const barWidth = Math.max(item.percentual, 3);
                return (
                  <div
                    key={item.name}
                    className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 space-y-1 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                    onClick={() =>
                      onDrill(
                        `Serviço: ${item.fullName}`,
                        contratos.filter(c => (c.servico || "Não especificado") === item.fullName)
                      )
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate text-xs text-muted-foreground">{item.fullName}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
                        {item.count} contratos
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {item.percentual.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-red-500 dark:text-red-400">
                      {formatCurrencyNoDecimals(item.mrr)} MRR
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TechChartCard>

        {/* MRR Perdido por Squad */}
        <TechChartCard
          title="MRR Perdido por Squad"
          subtitle="Valor mensal perdido (R$)"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-emerald-500 to-teal-500"
          meta={
            <StatPill
              label="Top 8 MRR"
              value={formatCurrencyNoDecimals(mrrSquadTotal)}
              tone="success"
            />
          }
        >
          {distribuicaoPorSquad.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={[...distribuicaoPorSquad].sort((a, b) => b.mrr - a.mrr)}
                layout="vertical"
                margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  width={80}
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatCurrencyNoDecimals(v)} />} />
                <Bar
                  dataKey="mrr"
                  radius={[0, 4, 4, 0]}
                  name="MRR Perdido"
                  onClick={(data: any) =>
                    onDrill(
                      `Squad: ${data.fullName}`,
                      contratos.filter(
                        c =>
                          c.tipo === "churn" &&
                          !c.is_abonado &&
                          (c.squad || "Não especificado") === data.fullName
                      )
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  {distribuicaoPorSquad.map((entry, index) => (
                    <Cell key={entry.name} fill={REFINED_COLORS[index % REFINED_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>

        {/* MRR Perdido por Responsável */}
        <TechChartCard
          title="MRR Perdido por Responsável"
          subtitle="Top 6 responsáveis (R$)"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-cyan-500 to-blue-500"
          meta={
            <StatPill
              label="Top 6 MRR"
              value={formatCurrencyNoDecimals(mrrResponsavelTotal)}
              tone="info"
            />
          }
        >
          {distribuicaoPorResponsavel.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={[...distribuicaoPorResponsavel].sort((a, b) => b.mrr - a.mrr)}
                layout="vertical"
                margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="blueBarGradientSeg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  width={70}
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatCurrencyNoDecimals(v)} />} />
                <Bar
                  dataKey="mrr"
                  fill="url(#blueBarGradientSeg)"
                  radius={[0, 4, 4, 0]}
                  name="MRR Perdido"
                  onClick={(data: any) =>
                    onDrill(
                      `Responsável: ${data.fullName}`,
                      contratos.filter(
                        c => (c.responsavel || "Não especificado") === data.fullName
                      )
                    )
                  }
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>
      </div>

      {/* Row 2: Distribuição por Faixa de Ticket */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TechChartCard
          title="Churn por Faixa de Ticket"
          subtitle="Distribuição por valor do contrato"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-indigo-500 to-purple-500"
          meta={
            <StatPill
              label="Faixa lider"
              value={topTicket ? `${topTicket.name} (${topTicket.count})` : "-"}
              tone="info"
            />
          }
        >
          {distribuicaoPorTicket.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <RechartsPie>
                  <Pie
                    data={distribuicaoPorTicket}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                    onClick={(data: any) =>
                      onDrill(
                        `Ticket: ${data.name}`,
                        contratos.filter(c => {
                          const valor = c.valorr || 0;
                          const range = distribuicaoPorTicket.find(r => r.name === data.name);
                          if (!range) return false;
                          return valor >= range.min && valor < range.max;
                        })
                      )
                    }
                    style={{ cursor: "pointer" }}
                  >
                    {distribuicaoPorTicket.map((entry, index) => (
                      <Cell key={entry.name} fill={REFINED_COLORS[index % REFINED_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 text-xs">
                {distribuicaoPorTicket.map((item, i) => (
                  <div
                    key={item.name}
                    className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1 space-y-0.5 cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
                    onClick={() =>
                      onDrill(
                        `Ticket: ${item.name}`,
                        contratos.filter(c => {
                          const valor = c.valorr || 0;
                          return valor >= item.min && valor < item.max;
                        })
                      )
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
                        />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold text-foreground tabular-nums">{item.count}</span>
                    </div>
                    <div className="pl-4 text-[10px] text-red-500 dark:text-red-400">
                      {formatCurrencyNoDecimals(item.mrr)} MRR
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TechChartCard>
      </div>
    </SectionBlock>
  );
}

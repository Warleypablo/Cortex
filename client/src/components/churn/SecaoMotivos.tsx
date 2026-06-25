import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Brain,
  GitBranch,
  Target,
  Users,
  BarChart3,
  PieChart,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
  Legend,
} from "recharts";
import { type ChurnContract } from "@/components/churn/types";
import { TechChartCard } from "@/components/churn/ui/TechChartCard";
import { SectionBlock } from "@/components/churn/ui/SectionBlock";
import { CustomTooltip } from "@/components/churn/ui/CustomTooltip";
import { StatPill } from "@/components/churn/ui/StatPill";

// ── helpers duplicated/moved from orchestrator ──────────────────────────────

const formatCurrencyNoDecimals = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const REFINED_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];


// ── types ────────────────────────────────────────────────────────────────────

type ChurnTipoErro = {
  tipo: string;
  count: number;
  mrr: number;
  porSquad: Record<string, { count: number; mrr: number }>;
  porResponsavel: Record<string, { count: number; mrr: number }>;
  porVendedor: Record<string, { count: number; mrr: number }>;
  porCsResponsavel: Record<string, { count: number; mrr: number }>;
};

// ── component ─────────────────────────────────────────────────────────────────

export interface SecaoMotivosProps {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}

export function SecaoMotivos({ contratos, onDrill }: SecaoMotivosProps): JSX.Element {
  // ── local UI states (previously in orchestrator) ──────────────────────────
  const [crossAnalysisView, setCrossAnalysisView] = useState<"motivo" | "cluster" | "plano">("motivo");
  const [expandedMotivo, setExpandedMotivo] = useState<string | null>(null);
  const [tipoErroTab, setTipoErroTab] = useState<"squad" | "responsavel" | "vendedor" | "cs_responsavel">("squad");
  const [tipoErroSelecionado, setTipoErroSelecionado] = useState<string>("");
  // ── memos moved from orchestrator ────────────────────────────────────────

  // Evitabilidade breakdown (computed from contracts, replacing data.metricas.churn_por_evitabilidade)
  const evitabilidadeData = useMemo(() => {
    if (contratos.length === 0) return [];
    const groups: Record<string, { count: number; mrr: number }> = {};
    contratos.forEach((c) => {
      const label = c.evitabilidade_churn || "Não especificado";
      if (!groups[label]) groups[label] = { count: 0, mrr: 0 };
      groups[label].count++;
      groups[label].mrr += c.valorr || 0;
    });
    return Object.entries(groups)
      .map(([label, d]) => ({ label, count: d.count, mrr: d.mrr }))
      .sort((a, b) => b.count - a.count);
  }, [contratos]);

  // Cluster breakdown (replacing data.metricas.churn_por_cluster)
  const clusterData = useMemo(() => {
    if (contratos.length === 0) return [];
    const groups: Record<string, { count: number; mrr: number }> = {};
    contratos.forEach((c) => {
      const label = c.cluster || "Não especificado";
      if (!groups[label]) groups[label] = { count: 0, mrr: 0 };
      groups[label].count++;
      groups[label].mrr += c.valorr || 0;
    });
    return Object.entries(groups)
      .map(([label, d]) => ({ label, count: d.count, mrr: d.mrr }))
      .sort((a, b) => b.count - a.count);
  }, [contratos]);

  // Plano breakdown (replacing data.metricas.churn_por_plano)
  const planoData = useMemo(() => {
    if (contratos.length === 0) return [];
    const groups: Record<string, { count: number; mrr: number }> = {};
    contratos.forEach((c) => {
      const label = c.plano || "Não especificado";
      if (!groups[label]) groups[label] = { count: 0, mrr: 0 };
      groups[label].count++;
      groups[label].mrr += c.valorr || 0;
    });
    return Object.entries(groups)
      .map(([label, d]) => ({ label, count: d.count, mrr: d.mrr }))
      .sort((a, b) => b.count - a.count);
  }, [contratos]);

  // Feature 3: Drill-down Motivo → Submotivo
  const motivoSubmotivoTree = useMemo(() => {
    if (contratos.length === 0) return [];

    const tree: Record<string, { count: number; mrr: number; submotivos: Record<string, { count: number; mrr: number }> }> = {};

    contratos.forEach((c) => {
      const motivo = c.motivo_cancelamento || "Não especificado";
      if (!tree[motivo]) tree[motivo] = { count: 0, mrr: 0, submotivos: {} };
      tree[motivo].count++;
      tree[motivo].mrr += c.valorr || 0;

      const sub = c.submotivo || "Sem submotivo";
      if (!tree[motivo].submotivos[sub]) tree[motivo].submotivos[sub] = { count: 0, mrr: 0 };
      tree[motivo].submotivos[sub].count++;
      tree[motivo].submotivos[sub].mrr += c.valorr || 0;
    });

    return Object.entries(tree)
      .map(([motivo, data]) => ({
        motivo,
        count: data.count,
        mrr: data.mrr,
        submotivos: Object.entries(data.submotivos)
          .map(([sub, info]) => ({ submotivo: sub, count: info.count, mrr: info.mrr }))
          .sort((a, b) => b.mrr - a.mrr),
      }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [contratos]);

  // Feature 4: Matriz Cruzada (Evitabilidade × Motivo/Cluster/Plano)
  const crossAnalysisData = useMemo(() => {
    if (contratos.length === 0) return [];

    const getDimension = (c: ChurnContract) => {
      switch (crossAnalysisView) {
        case "motivo": return c.motivo_cancelamento || "Não especificado";
        case "cluster": return c.cluster || "Não especificado";
        case "plano": return c.plano || "Não especificado";
      }
    };

    const groups: Record<string, { evitavel: number; inevitavel: number; mrrEvitavel: number; mrrInevitavel: number }> = {};

    contratos.forEach((c) => {
      const dim = getDimension(c);
      if (!groups[dim]) groups[dim] = { evitavel: 0, inevitavel: 0, mrrEvitavel: 0, mrrInevitavel: 0 };
      if (c.evitabilidade_churn === "Evitável") {
        groups[dim].evitavel++;
        groups[dim].mrrEvitavel += c.valorr || 0;
      } else {
        groups[dim].inevitavel++;
        groups[dim].mrrInevitavel += c.valorr || 0;
      }
    });

    return Object.entries(groups)
      .map(([name, data]) => ({
        name: name.length > 20 ? name.substring(0, 20) + "..." : name,
        fullName: name,
        evitavel: data.evitavel,
        inevitavel: data.inevitavel,
        mrrEvitavel: data.mrrEvitavel,
        mrrInevitavel: data.mrrInevitavel,
        total: data.evitavel + data.inevitavel,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [contratos, crossAnalysisView]);

  // Churn por Tipo de Erro
  const churnPorTipoErro = useMemo((): ChurnTipoErro[] => {
    if (contratos.length === 0) return [];

    const churnContratos = contratos.filter((c) => c.tipo === "churn" && !c.is_abonado);
    if (churnContratos.length === 0) return [];

    const tiposErro: Record<string, ChurnTipoErro> = {};

    const erroOperacionalMotivos = ["erro operacional", "erro interno", "falha operacional", "problema interno", "erro de operação"];
    const erroOperacionalIndiretoMotivos = ["erro operacional indireto", "erro indireto", "falha indireta"];
    const faltaResultadoMotivos = ["falta de resultado", "sem resultado", "resultado insatisfatório", "não atingiu meta", "baixa performance", "performance"];

    churnContratos.forEach((c) => {
      const motivo = (c.motivo_cancelamento || "").toLowerCase().trim();

      let categoria = "Outros";
      if (erroOperacionalMotivos.some((m) => motivo.includes(m))) {
        categoria = "Erro Operacional";
      } else if (erroOperacionalIndiretoMotivos.some((m) => motivo.includes(m))) {
        categoria = "Erro Operacional Indireto";
      } else if (faltaResultadoMotivos.some((m) => motivo.includes(m))) {
        categoria = "Falta de Resultado";
      }

      if (!tiposErro[categoria]) {
        tiposErro[categoria] = { tipo: categoria, count: 0, mrr: 0, porSquad: {}, porResponsavel: {}, porVendedor: {}, porCsResponsavel: {} };
      }

      tiposErro[categoria].count++;
      tiposErro[categoria].mrr += c.valorr || 0;

      const squad = c.squad || "Não especificado";
      if (!tiposErro[categoria].porSquad[squad]) tiposErro[categoria].porSquad[squad] = { count: 0, mrr: 0 };
      tiposErro[categoria].porSquad[squad].count++;
      tiposErro[categoria].porSquad[squad].mrr += c.valorr || 0;

      const resp = c.responsavel || "Não especificado";
      if (!tiposErro[categoria].porResponsavel[resp]) tiposErro[categoria].porResponsavel[resp] = { count: 0, mrr: 0 };
      tiposErro[categoria].porResponsavel[resp].count++;
      tiposErro[categoria].porResponsavel[resp].mrr += c.valorr || 0;

      const vendedor = c.vendedor || "Não especificado";
      if (!tiposErro[categoria].porVendedor[vendedor]) tiposErro[categoria].porVendedor[vendedor] = { count: 0, mrr: 0 };
      tiposErro[categoria].porVendedor[vendedor].count++;
      tiposErro[categoria].porVendedor[vendedor].mrr += c.valorr || 0;

      const csResp = c.cs_responsavel || "Não especificado";
      if (!tiposErro[categoria].porCsResponsavel[csResp]) tiposErro[categoria].porCsResponsavel[csResp] = { count: 0, mrr: 0 };
      tiposErro[categoria].porCsResponsavel[csResp].count++;
      tiposErro[categoria].porCsResponsavel[csResp].mrr += c.valorr || 0;
    });

    return Object.values(tiposErro)
      .filter((t) => t.tipo !== "Outros")
      .sort((a, b) => b.mrr - a.mrr);
  }, [contratos]);

  const dadosTipoErroAtual = useMemo(() => {
    if (churnPorTipoErro.length === 0) return [];

    const tipoSelecionado = tipoErroSelecionado || churnPorTipoErro[0]?.tipo || "";
    const tipoData = churnPorTipoErro.find((t) => t.tipo === tipoSelecionado);
    if (!tipoData) return [];

    let dados: Record<string, { count: number; mrr: number }> = {};

    switch (tipoErroTab) {
      case "squad":        dados = tipoData.porSquad; break;
      case "responsavel":  dados = tipoData.porResponsavel; break;
      case "vendedor":     dados = tipoData.porVendedor; break;
      case "cs_responsavel": dados = tipoData.porCsResponsavel; break;
    }

    return Object.entries(dados)
      .map(([name, info]) => ({
        name: name.length > 20 ? name.substring(0, 20) + "..." : name,
        fullName: name,
        count: info.count,
        mrr: info.mrr,
      }))
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 10);
  }, [churnPorTipoErro, tipoErroTab, tipoErroSelecionado]);

  // Feature 6: Score de Oportunidade de Retenção
  const retentionOpportunities = useMemo(() => {
    if (contratos.length === 0) return { scored: [] as any[], totalMissed: 0, mrrMissed: 0, avgScore: 0 };

    const scored = contratos.map((c) => {
      let score = 0;

      if (c.possibilidade_retencao === "Alta") score += 30;
      else if (c.possibilidade_retencao === "Média") score += 20;
      else if (c.possibilidade_retencao === "Baixa") score += 5;

      if (c.evitabilidade_churn === "Evitável") score += 25;

      if (c.lifetime_meses >= 12) score += 15;
      else if (c.lifetime_meses >= 6) score += 10;

      const maxMrr = Math.max(...contratos.map((x) => x.valorr || 0), 1);
      score += Math.round(((c.valorr || 0) / maxMrr) * 20);

      if (c.mensagem_cliente && c.mensagem_cliente.trim().length > 0) score += 10;

      const isMissedOpportunity =
        c.evitabilidade_churn === "Evitável" &&
        (c.possibilidade_retencao === "Alta" || c.possibilidade_retencao === "Média");

      return { ...c, score: Math.min(score, 100), isMissedOpportunity };
    }).sort((a, b) => b.score - a.score);

    const missed = scored.filter((c) => c.isMissedOpportunity);
    const avgScore = scored.length > 0 ? scored.reduce((sum, c) => sum + c.score, 0) / scored.length : 0;

    return {
      scored,
      totalMissed: missed.length,
      mrrMissed: missed.reduce((sum, c) => sum + (c.valorr || 0), 0),
      avgScore,
    };
  }, [contratos]);

  // ── render ───────────────────────────────────────────────────────────────

  if (contratos.length === 0) return <></>;

  return (
    <>
      {/* ── Inteligência de Churn: Evitabilidade, Cluster, Plano ───────────── */}
      <SectionBlock
        title="Inteligência de Churn"
        subtitle="Evitabilidade, cluster e plano"
        icon={PieChart}
        accent="bg-gradient-to-r from-purple-500 to-indigo-500"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Evitabilidade - Donut */}
          <TechChartCard
            title="Evitabilidade"
            subtitle="Churn evitável vs inevitável"
            icon={AlertTriangle}
            iconBg="bg-gradient-to-r from-purple-500 to-indigo-500"
          >
            {evitabilidadeData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="55%" height={200}>
                  <RechartsPie>
                    <Pie
                      data={evitabilidadeData}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                      onClick={(entry) => {
                        const label = entry.label as string;
                        const subset = contratos.filter(
                          (c) => (c.evitabilidade_churn || "Não especificado") === label
                        );
                        onDrill(`Evitabilidade: ${label}`, subset);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {evitabilidadeData.map((_, index) => (
                        <Cell key={index} fill={index === 0 ? "#ef4444" : "#10b981"} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2 text-xs">
                  {evitabilidadeData.map((item, i) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        const subset = contratos.filter(
                          (c) => (c.evitabilidade_churn || "Não especificado") === item.label
                        );
                        onDrill(`Evitabilidade: ${item.label}`, subset);
                      }}
                      className="w-full text-left rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 space-y-0.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: i === 0 ? "#ef4444" : "#10b981" }}
                          />
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="font-semibold text-foreground tabular-nums">{item.count}</span>
                      </div>
                      <div className="pl-4 text-[10px] text-red-500 dark:text-red-400">
                        {formatCurrencyNoDecimals(item.mrr)} MRR
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TechChartCard>

          {/* Cluster - Bar */}
          <TechChartCard
            title="Churn por Cluster"
            subtitle="Distribuição por cluster de cliente"
            icon={Users}
            iconBg="bg-gradient-to-r from-cyan-500 to-blue-500"
          >
            {clusterData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {clusterData.map((item, i) => {
                  const maxCount = Math.max(...clusterData.map((d) => d.count), 1);
                  const barWidth = Math.max((item.count / maxCount) * 100, 3);
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        const subset = contratos.filter(
                          (c) => (c.cluster || "Não especificado") === item.label
                        );
                        onDrill(`Cluster: ${item.label}`, subset);
                      }}
                      className="w-full text-left rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 space-y-1 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
                          />
                          <span className="truncate text-xs text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
                          {item.count}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-red-500 dark:text-red-400">
                        {formatCurrencyNoDecimals(item.mrr)} MRR
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TechChartCard>

          {/* Plano - Bar */}
          <TechChartCard
            title="Churn por Plano"
            subtitle="Distribuição por plano contratado"
            icon={BarChart3}
            iconBg="bg-gradient-to-r from-amber-500 to-orange-500"
          >
            {planoData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {planoData.map((item, i) => {
                  const maxCount = Math.max(...planoData.map((d) => d.count), 1);
                  const barWidth = Math.max((item.count / maxCount) * 100, 3);
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        const subset = contratos.filter(
                          (c) => (c.plano || "Não especificado") === item.label
                        );
                        onDrill(`Plano: ${item.label}`, subset);
                      }}
                      className="w-full text-left rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 space-y-1 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
                          />
                          <span className="truncate text-xs text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
                          {item.count}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-red-500 dark:text-red-400">
                        {formatCurrencyNoDecimals(item.mrr)} MRR
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TechChartCard>
        </div>
      </SectionBlock>

      {/* ── Churn por Tipo de Erro ──────────────────────────────────────────── */}
      <Card className="border-orange-200 dark:border-orange-900/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 shadow-lg">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Churn por Tipo de Erro</CardTitle>
                <CardDescription>Erro Operacional, Indireto e Falta de Resultado</CardDescription>
              </div>
            </div>
            {churnPorTipoErro.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {churnPorTipoErro.map((tipo) => (
                  <Button
                    key={tipo.tipo}
                    variant={
                      tipoErroSelecionado === tipo.tipo ||
                      (!tipoErroSelecionado && tipo.tipo === churnPorTipoErro[0]?.tipo)
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => setTipoErroSelecionado(tipo.tipo)}
                    className="text-xs"
                  >
                    {tipo.tipo}
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      {tipo.count}
                    </Badge>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {churnPorTipoErro.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado de erro operacional encontrado no período
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo do tipo selecionado */}
              {(() => {
                const tipoAtual =
                  churnPorTipoErro.find((t) => t.tipo === tipoErroSelecionado) || churnPorTipoErro[0];
                if (!tipoAtual) return null;
                return (
                  <div
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                    onClick={() => {
                      const subset = contratos.filter(
                        (c) =>
                          c.tipo === "churn" &&
                          !c.is_abonado &&
                          (() => {
                            const motivo = (c.motivo_cancelamento || "").toLowerCase().trim();
                            if (tipoAtual.tipo === "Erro Operacional")
                              return ["erro operacional", "erro interno", "falha operacional", "problema interno", "erro de operação"].some(
                                (m) => motivo.includes(m)
                              );
                            if (tipoAtual.tipo === "Erro Operacional Indireto")
                              return ["erro operacional indireto", "erro indireto", "falha indireta"].some(
                                (m) => motivo.includes(m)
                              );
                            if (tipoAtual.tipo === "Falta de Resultado")
                              return ["falta de resultado", "sem resultado", "resultado insatisfatório", "não atingiu meta", "baixa performance", "performance"].some(
                                (m) => motivo.includes(m)
                              );
                            return false;
                          })()
                      );
                      onDrill(`Tipo de Erro: ${tipoAtual.tipo}`, subset);
                    }}
                  >
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{tipoAtual.count}</p>
                      <p className="text-xs text-muted-foreground">Contratos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {formatCurrencyNoDecimals(tipoAtual.mrr)}
                      </p>
                      <p className="text-xs text-muted-foreground">MRR Perdido</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {Object.keys(tipoAtual.porSquad).length}
                      </p>
                      <p className="text-xs text-muted-foreground">Squads Afetados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {Object.keys(tipoAtual.porResponsavel).length}
                      </p>
                      <p className="text-xs text-muted-foreground">Responsáveis</p>
                    </div>
                  </div>
                );
              })()}

              {/* Tabs de visualização */}
              <div className="flex items-center gap-2 border-b border-gray-200 dark:border-zinc-700 pb-2">
                {[
                  { key: "squad", label: "Por Squad" },
                  { key: "responsavel", label: "Por Responsável" },
                  { key: "vendedor", label: "Por Vendedor" },
                  { key: "cs_responsavel", label: "Por CS" },
                ].map((tab) => (
                  <Button
                    key={tab.key}
                    variant={tipoErroTab === tab.key ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setTipoErroTab(tab.key as typeof tipoErroTab)}
                    className="text-xs"
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              {/* Lista de ranking */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {dadosTipoErroAtual.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Nenhum dado disponível para esta visualização
                  </div>
                ) : (
                  dadosTipoErroAtual.map((item, index) => {
                    const maxMrr = Math.max(...dadosTipoErroAtual.map((d) => d.mrr));
                    const percentage = maxMrr > 0 ? (item.mrr / maxMrr) * 100 : 0;
                    const isTop3 = index < 3;
                    const medalColors = ["bg-amber-500", "bg-gray-400", "bg-amber-700"];

                    return (
                      <div
                        key={item.fullName}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                          isTop3
                            ? "bg-orange-50/80 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/50"
                            : "bg-gray-50/50 dark:bg-zinc-900/30 border border-gray-100/50 dark:border-zinc-800/50"
                        }`}
                      >
                        <div className="w-6 text-center flex-shrink-0">
                          {isTop3 ? (
                            <div
                              className={`w-5 h-5 rounded-full ${medalColors[index]} flex items-center justify-center`}
                            >
                              <span className="text-[10px] font-bold text-white">{index + 1}</span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">{index + 1}º</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium truncate" title={item.fullName}>
                              {item.fullName}
                            </span>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-muted-foreground">{item.count} contratos</span>
                              <span className="font-bold text-red-600 dark:text-red-400 tabular-nums">
                                {formatCurrencyNoDecimals(item.mrr)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Análise Profunda: Motivo → Submotivo + Matriz Cruzada + Contexto ── */}
      <SectionBlock
        title="Análise Profunda"
        subtitle="Padrões de texto, motivos e cruzamentos"
        icon={Brain}
        accent="bg-gradient-to-r from-indigo-500 to-purple-600"
      >
        {/* Feature 3: Motivo → Submotivo */}
        <div className="grid grid-cols-1 gap-4">
          {/* Feature 3: Drill-down Motivo → Submotivo */}
          <TechChartCard
            title="Motivo → Submotivo"
            subtitle="Hierarquia de motivos de cancelamento"
            icon={GitBranch}
            iconBg="bg-gradient-to-r from-orange-500 to-red-500"
          >
            {motivoSubmotivoTree.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {motivoSubmotivoTree.map((item) => {
                  const maxCount = Math.max(...motivoSubmotivoTree.map((d) => d.count), 1);
                  const barWidth = Math.max((item.count / maxCount) * 100, 5);
                  const isOpen = expandedMotivo === item.motivo;
                  return (
                    <div key={item.motivo}>
                      <div
                        className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => {
                          setExpandedMotivo(isOpen ? null : item.motivo);
                          const subset = contratos.filter(
                            (c) => (c.motivo_cancelamento || "Não especificado") === item.motivo
                          );
                          onDrill(`Motivo: ${item.motivo}`, subset);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {isOpen ? (
                              <ChevronUp className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate text-xs text-foreground font-medium">
                              {item.motivo}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-semibold text-foreground tabular-nums">
                              {item.count}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 pl-5">
                          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">
                            {formatCurrencyNoDecimals(item.mrr)}
                          </span>
                        </div>
                      </div>
                      {isOpen && item.submotivos.length > 0 && (
                        <div className="ml-5 mt-1 space-y-1 border-l-2 border-orange-200 dark:border-orange-800 pl-2">
                          {item.submotivos.map((sub) => {
                            const subMaxCount = Math.max(
                              ...item.submotivos.map((s) => s.count),
                              1
                            );
                            const subBarWidth = Math.max((sub.count / subMaxCount) * 100, 5);
                            return (
                              <button
                                key={sub.submotivo}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const subset = contratos.filter(
                                    (c) =>
                                      (c.motivo_cancelamento || "Não especificado") === item.motivo &&
                                      (c.submotivo || "Sem submotivo") === sub.submotivo
                                  );
                                  onDrill(`Submotivo: ${sub.submotivo}`, subset);
                                }}
                                className="w-full text-left rounded-md border border-border/30 bg-white/50 dark:bg-zinc-900/30 px-2 py-1 hover:bg-muted/20 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-[11px] text-muted-foreground">
                                    {sub.submotivo}
                                  </span>
                                  <span className="text-[11px] font-semibold text-foreground tabular-nums">
                                    {sub.count}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="flex-1 h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-orange-300 dark:bg-orange-600 transition-all"
                                      style={{ width: `${subBarWidth}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">
                                    {formatCurrencyNoDecimals(sub.mrr)}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TechChartCard>
        </div>

        {/* Feature 4: Matriz Cruzada */}
        <TechChartCard
          title="Matriz de Evitabilidade"
          subtitle="Cruzamento evitável × dimensão"
          icon={Target}
          iconBg="bg-gradient-to-r from-rose-500 to-red-600"
          meta={
            <div className="flex gap-1">
              {(["motivo", "cluster", "plano"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCrossAnalysisView(v)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    crossAnalysisView === v
                      ? "bg-rose-500 text-white shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {v === "motivo" ? "Por Motivo" : v === "cluster" ? "Por Cluster" : "Por Plano"}
                </button>
              ))}
            </div>
          }
        >
          {crossAnalysisData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Sem dados
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(200, crossAnalysisData.length * 36)}
            >
              <BarChart
                data={crossAnalysisData}
                layout="vertical"
                margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="secMotivosEvitGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#f87171" />
                  </linearGradient>
                  <linearGradient id="secMotivosInevGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = crossAnalysisData.find((x) => x.name === label);
                    return (
                      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[180px]">
                        <p className="text-xs font-semibold text-foreground mb-2">
                          {d?.fullName || label}
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between gap-4">
                            <span className="text-red-500">Evitável</span>
                            <span className="font-bold">
                              {d?.evitavel} ({formatCurrencyNoDecimals(d?.mrrEvitavel || 0)})
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-emerald-500">Inevitável</span>
                            <span className="font-bold">
                              {d?.inevitavel} ({formatCurrencyNoDecimals(d?.mrrInevitavel || 0)})
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-[10px] text-muted-foreground">{value}</span>
                  )}
                  iconSize={8}
                />
                <Bar
                  dataKey="evitavel"
                  name="Evitável"
                  fill="url(#secMotivosEvitGradient)"
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                  cursor="pointer"
                  onClick={(entry: any) => {
                    const dim = entry.fullName as string;
                    const subset = contratos.filter(
                      (c) => {
                        const val = crossAnalysisView === "motivo"
                          ? (c.motivo_cancelamento || "Não especificado")
                          : crossAnalysisView === "cluster"
                          ? (c.cluster || "Não especificado")
                          : (c.plano || "Não especificado");
                        return val === dim && c.evitabilidade_churn === "Evitável";
                      }
                    );
                    onDrill(`Evitável — ${dim}`, subset);
                  }}
                />
                <Bar
                  dataKey="inevitavel"
                  name="Inevitável"
                  fill="url(#secMotivosInevGradient)"
                  stackId="a"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(entry: any) => {
                    const dim = entry.fullName as string;
                    const subset = contratos.filter(
                      (c) => {
                        const val = crossAnalysisView === "motivo"
                          ? (c.motivo_cancelamento || "Não especificado")
                          : crossAnalysisView === "cluster"
                          ? (c.cluster || "Não especificado")
                          : (c.plano || "Não especificado");
                        return val === dim && c.evitabilidade_churn !== "Evitável";
                      }
                    );
                    onDrill(`Inevitável — ${dim}`, subset);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>

        {/* Feature 6: Score de Oportunidade de Retenção */}
        {retentionOpportunities.scored.length > 0 && (
          <TechChartCard
            title="Score de Oportunidade de Retenção"
            subtitle="Contratos com maior potencial de recuperação"
            icon={Target}
            iconBg="bg-gradient-to-r from-emerald-500 to-teal-500"
            meta={
              <div className="flex items-center gap-3 text-xs">
                <StatPill
                  label="Oportunidades perdidas"
                  value={`${retentionOpportunities.totalMissed}`}
                  tone="danger"
                />
                <StatPill
                  label="MRR recuperável"
                  value={formatCurrencyNoDecimals(retentionOpportunities.mrrMissed)}
                  tone="warning"
                />
              </div>
            }
          >
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {retentionOpportunities.scored.slice(0, 15).map((c, i) => {
                const scoreColor =
                  c.score >= 70
                    ? "text-red-600 dark:text-red-400"
                    : c.score >= 40
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground";
                const barColor =
                  c.score >= 70
                    ? "bg-gradient-to-r from-red-500 to-rose-500"
                    : c.score >= 40
                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                    : "bg-gradient-to-r from-slate-400 to-gray-400";

                return (
                  <button
                    key={`ret-${c.id}-${i}`}
                    onClick={() => onDrill(`Retenção: ${c.cliente_nome}`, [c])}
                    className="w-full text-left rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2.5 py-2 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {c.isMissedOpportunity && (
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        )}
                        <span className="text-xs font-medium text-foreground truncate">
                          {c.cliente_nome}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] text-red-500 tabular-nums">
                          {formatCurrencyNoDecimals(c.valorr)}
                        </span>
                        <span className={`text-xs font-bold tabular-nums ${scoreColor}`}>
                          {c.score}pts
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${c.score}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      {c.evitabilidade_churn && (
                        <span
                          className={
                            c.evitabilidade_churn === "Evitável"
                              ? "text-red-500"
                              : "text-emerald-500"
                          }
                        >
                          {c.evitabilidade_churn}
                        </span>
                      )}
                      {c.possibilidade_retencao && (
                        <span>· Retenção {c.possibilidade_retencao}</span>
                      )}
                      {c.motivo_cancelamento && (
                        <span className="truncate">· {c.motivo_cancelamento}</span>
                      )}
                    </div>
                  </button>
                );
              })}
              {retentionOpportunities.scored.length > 15 && (
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  Mostrando 15 de {retentionOpportunities.scored.length} contratos
                </p>
              )}
            </div>
          </TechChartCard>
        )}
      </SectionBlock>
    </>
  );
}

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  MessageSquare,
  PieChart,
  Hash,
  Shield,
  Users,
  Megaphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { type ChurnContract } from "@/components/churn/types";
import { TechChartCard } from "@/components/churn/ui/TechChartCard";
import { SectionBlock } from "@/components/churn/ui/SectionBlock";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ===== Helpers & constants (moved from orchestrator) =====

const PALETTE = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

const EXPANDED_KEYWORDS: Record<string, string[]> = {
  'Resultado': ['resultado', 'performance', 'meta', 'retorno', 'roi', 'entrega'],
  'Preço': ['preco', 'valor', 'custo', 'caro', 'investimento', 'orcamento', 'budget'],
  'Atendimento': ['atendimento', 'suporte', 'resposta', 'demora', 'comunicacao', 'contato'],
  'Operação': ['operacao', 'operacional', 'execucao', 'qualidade', 'erro', 'falha'],
  'Estratégia': ['estrategia', 'estrategico', 'planejamento', 'direcionamento', 'alinhamento'],
  'Interno': ['interno', 'reestruturacao', 'mudanca interna', 'corte', 'reducao'],
  'Concorrência': ['concorrencia', 'concorrente', 'agencia', 'inhouse', 'in-house'],
  'Prazo': ['prazo', 'tempo', 'urgencia', 'deadline', 'atraso', 'lento'],
  'Produto': ['produto', 'ferramenta', 'plataforma', 'funcionalidade', 'feature', 'sistema'],
  'Confiança': ['confianca', 'credibilidade', 'transparencia', 'honestidade', 'seguranca'],
  'Onboarding': ['onboarding', 'implantacao', 'inicio', 'setup', 'treinamento', 'integracao'],
  'Relacionamento': ['relacionamento', 'parceria', 'proximidade', 'dedicacao', 'empatia', 'cuidado'],
};

const normalizeText = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Highlights matched keywords inside a string with yellow mark tags */
const highlightKeywords = (text: string, keywords: string[]): React.ReactNode => {
  if (!text || keywords.length === 0) return text;
  const normalizedText = normalizeText(text);
  const segments: { start: number; end: number }[] = [];

  keywords.forEach(kw => {
    const normalizedKw = normalizeText(kw);
    let idx = normalizedText.indexOf(normalizedKw);
    while (idx !== -1) {
      segments.push({ start: idx, end: idx + normalizedKw.length });
      idx = normalizedText.indexOf(normalizedKw, idx + 1);
    }
  });

  if (segments.length === 0) return text;

  // Merge overlapping segments
  segments.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    if (segments[i].start <= last.end) {
      last.end = Math.max(last.end, segments[i].end);
    } else {
      merged.push(segments[i]);
    }
  }

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  merged.forEach((seg, i) => {
    if (seg.start > lastEnd) parts.push(text.slice(lastEnd, seg.start));
    parts.push(
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 rounded px-0.5">
        {text.slice(seg.start, seg.end)}
      </mark>
    );
    lastEnd = seg.end;
  });
  if (lastEnd < text.length) parts.push(text.slice(lastEnd));
  return <>{parts}</>;
};

const formatCurrencyNoDecimals = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

// ===== Component props =====

export interface SecaoVozClienteProps {
  contratos: ChurnContract[];
  onDrill: (titulo: string, contratos: ChurnContract[]) => void;
}

export function SecaoVozCliente({ contratos, onDrill }: SecaoVozClienteProps): JSX.Element {
  // ---- Mural UI states ----
  const [muralSortBy, setMuralSortBy] = useState<"mrr" | "date">("mrr");
  const [muralFilterSentiment, setMuralFilterSentiment] = useState<string | null>(null);
  const [muralFilterTheme, setMuralFilterTheme] = useState<string | null>(null);
  const [muralExpandedId, setMuralExpandedId] = useState<string | null>(null);
  const [selectedThemeKeyword, setSelectedThemeKeyword] = useState<string | null>(null);
  const [expandedOpTheme, setExpandedOpTheme] = useState<string | null>(null);
  const [expandedCxTheme, setExpandedCxTheme] = useState<string | null>(null);

  // ---- Memos (moved from orchestrator) ----

  const contratosComMensagem = useMemo(
    () => contratos.filter(c => c.mensagem_cliente && c.mensagem_cliente.trim().length > 0),
    [contratos],
  );

  const aiPayload = useMemo(() => {
    if (contratosComMensagem.length === 0) return null;
    return contratosComMensagem.map(c => ({
      id: c.id,
      cliente: c.cliente_nome,
      mensagem: c.mensagem_cliente!,
      motivo: c.motivo_cancelamento || undefined,
      mrr: c.valorr || 0,
    }));
  }, [contratosComMensagem]);

  // AI query (moved from orchestrator — same queryKey / enabled semantics)
  const { data: aiAnalysis, isLoading: aiLoading, error: aiError, refetch: refetchAI } = useQuery<{
    analises: { id: string; sentimento: string; temas: string[]; resumo: string }[];
    sintese: { principal_motivo: string; padrao_critico: string; recomendacao: string };
  }>({
    queryKey: ["/api/analytics/churn-mensagens-ai", aiPayload?.map(m => m.id).sort().join(',')],
    queryFn: async () => {
      const res = await fetch("/api/analytics/churn-mensagens-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: aiPayload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    enabled: !!aiPayload && aiPayload.length > 0,
    staleTime: 1000 * 60 * 30, // 30 min cache
    retry: 1,
  });

  const aiByContract = useMemo(() => {
    const map = new Map<string, { sentimento: string; temas: string[]; resumo: string }>();
    if (!aiAnalysis?.analises) return map;
    aiAnalysis.analises.forEach(a => map.set(a.id, a));
    return map;
  }, [aiAnalysis]);

  const sentimentDistribution = useMemo(() => {
    if (!aiAnalysis?.analises) return [];
    let neg = 0, neu = 0, pos = 0;
    let mrrNeg = 0, mrrNeu = 0, mrrPos = 0;
    let contratosNeg: ChurnContract[] = [], contratosNeu: ChurnContract[] = [], contratosPos: ChurnContract[] = [];

    aiAnalysis.analises.forEach(a => {
      const c = contratosComMensagem.find(x => x.id === a.id);
      const mrr = c?.valorr || 0;
      if (a.sentimento === 'negativo') { neg++; mrrNeg += mrr; if (c) contratosNeg.push(c); }
      else if (a.sentimento === 'positivo') { pos++; mrrPos += mrr; if (c) contratosPos.push(c); }
      else { neu++; mrrNeu += mrr; if (c) contratosNeu.push(c); }
    });

    const result: { sentiment: string; count: number; mrr: number; color: string; matchedContratos: ChurnContract[] }[] = [];
    if (neg > 0) result.push({ sentiment: 'Negativo', count: neg, mrr: mrrNeg, color: '#ef4444', matchedContratos: contratosNeg });
    if (neu > 0) result.push({ sentiment: 'Neutro', count: neu, mrr: mrrNeu, color: '#94a3b8', matchedContratos: contratosNeu });
    if (pos > 0) result.push({ sentiment: 'Positivo', count: pos, mrr: mrrPos, color: '#22c55e', matchedContratos: contratosPos });
    return result;
  }, [aiAnalysis, contratosComMensagem]);

  const themeDistribution = useMemo(() => {
    if (!aiAnalysis?.analises) return [];
    const themes: Record<string, { count: number; mrr: number; matchedContratos: ChurnContract[] }> = {};

    aiAnalysis.analises.forEach(a => {
      const c = contratosComMensagem.find(x => x.id === a.id);
      const mrr = c?.valorr || 0;
      (a.temas || []).forEach(t => {
        if (!themes[t]) themes[t] = { count: 0, mrr: 0, matchedContratos: [] };
        themes[t].count++;
        themes[t].mrr += mrr;
        if (c) themes[t].matchedContratos.push(c);
      });
    });

    return Object.entries(themes)
      .map(([theme, data]) => ({ theme, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [aiAnalysis, contratosComMensagem]);

  // textPatternAnalysis (moved from orchestrator)
  const textPatternAnalysis = useMemo(() => {
    if (contratos.length === 0) return [];

    const results: { keyword: string; count: number; mrr: number; evitavelPct: number; contratos: string[]; matchedContratos: ChurnContract[] }[] = [];

    Object.entries(EXPANDED_KEYWORDS).forEach(([keyword, terms]) => {
      const matched = contratos.filter(c => {
        const msg = normalizeText(c.mensagem_cliente || '');
        return terms.some(t => msg.includes(t));
      });
      if (matched.length > 0) {
        const evitavel = matched.filter(c => c.evitabilidade_churn === 'Evitável').length;
        results.push({
          keyword,
          count: matched.length,
          mrr: matched.reduce((sum, c) => sum + (c.valorr || 0), 0),
          evitavelPct: matched.length > 0 ? (evitavel / matched.length) * 100 : 0,
          contratos: matched.map(c => c.cliente_nome).slice(0, 5),
          matchedContratos: matched,
        });
      }
    });

    return results.sort((a, b) => b.count - a.count);
  }, [contratos]);

  // contextThemes (recovered from git 5ef82ec6 — was deleted in Task 6)
  const contextThemes = useMemo(() => {
    if (contratos.length === 0) return { operacao: [], cx: [] };

    const opThemes: Record<string, string[]> = {
      'Falha de Comunicação': ['comunicação', 'contato', 'resposta', 'alinhamento', 'informação'],
      'Erro Operacional': ['erro', 'falha', 'bug', 'problema técnico', 'incorreto'],
      'Atraso': ['atraso', 'demora', 'prazo', 'lento', 'demorou'],
      'Falta de Acompanhamento': ['acompanhamento', 'follow', 'proativo', 'abandonado', 'negligência'],
      'Turnover': ['turnover', 'troca', 'saiu', 'mudança de equipe', 'rotatividade'],
      'Qualidade': ['qualidade', 'entrega', 'padrão', 'expectativa', 'insatisf'],
    };

    const cxThemes: Record<string, string[]> = {
      'Insatisfação Geral': ['insatisf', 'frustrad', 'descontente', 'chateado', 'decepcion'],
      'Falta de Resultado': ['resultado', 'retorno', 'meta', 'roi', 'performance'],
      'Problema de Comunicação': ['comunicação', 'contato', 'resposta', 'demora', 'suporte'],
      'Questão Financeira': ['preço', 'custo', 'valor', 'caro', 'investimento', 'orçamento'],
      'Mudança de Estratégia': ['estratégia', 'mudança', 'reestrutur', 'direcionamento', 'interno'],
      'Concorrência': ['concorrência', 'concorrente', 'agência', 'inhouse', 'proposta'],
    };

    const analyzeContext = (
      field: 'contexto_operacao' | 'contexto_cx',
      themes: Record<string, string[]>,
    ) => {
      const results: { theme: string; count: number; mrr: number; examples: string[]; matchedContratos: ChurnContract[] }[] = [];

      Object.entries(themes).forEach(([theme, terms]) => {
        const matched = contratos.filter(c => {
          const text = (c[field] || '').toLowerCase();
          return text.length > 0 && terms.some(t => text.includes(t));
        });
        if (matched.length > 0) {
          results.push({
            theme,
            count: matched.length,
            mrr: matched.reduce((sum, c) => sum + (c.valorr || 0), 0),
            examples: matched.map(c => (c[field] || '').substring(0, 80)).slice(0, 3),
            matchedContratos: matched,
          });
        }
      });

      return results.sort((a, b) => b.count - a.count);
    };

    return {
      operacao: analyzeContext('contexto_operacao', opThemes),
      cx: analyzeContext('contexto_cx', cxThemes),
    };
  }, [contratos]);

  // Mural filtrado (moved from orchestrator)
  const muralMessages = useMemo(() => {
    let msgs = contratosComMensagem.map(c => {
      const ai = aiByContract.get(c.id);
      return {
        ...c,
        sentiment: ai?.sentimento || 'neutro',
        temas: ai?.temas || [],
        resumo: ai?.resumo || '',
      };
    });

    if (muralFilterSentiment) {
      msgs = msgs.filter(m => m.sentiment === muralFilterSentiment);
    }

    if (muralFilterTheme) {
      msgs = msgs.filter(m => m.temas.includes(muralFilterTheme));
    }

    if (muralSortBy === 'mrr') {
      msgs.sort((a, b) => (b.valorr || 0) - (a.valorr || 0));
    } else {
      msgs.sort((a, b) => {
        const da = a.data_encerramento || a.data_pausa || '';
        const db = b.data_encerramento || b.data_pausa || '';
        return db.localeCompare(da);
      });
    }

    return msgs;
  }, [contratosComMensagem, aiByContract, muralFilterSentiment, muralFilterTheme, muralSortBy]);

  // Nothing to show if no messages
  if (contratosComMensagem.length === 0) return <></>;

  return (
    <SectionBlock
      title="Voz do Cliente"
      subtitle="Análise por inteligência artificial das mensagens reais de churn"
      icon={Megaphone}
      accent="bg-gradient-to-r from-teal-500 to-cyan-600"
    >
      {/* Loading / Error states */}
      {aiLoading && (
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="h-5 w-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">
            Analisando {contratosComMensagem.length} mensagens com IA...
          </span>
        </div>
      )}

      {aiError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-4">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">Erro na análise IA</p>
          <p className="text-xs text-red-500/80 dark:text-red-400/60 mt-1">
            {(aiError as Error).message}
          </p>
          <button
            onClick={() => refetchAI()}
            className="mt-3 text-xs text-teal-600 dark:text-teal-400 underline hover:text-teal-800 dark:hover:text-teal-300"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {aiAnalysis && !aiLoading && (
        <>
          {/* Síntese da IA */}
          {aiAnalysis.sintese && (
            <Card className="border-teal-200/60 dark:border-teal-800/40 bg-teal-50/30 dark:bg-teal-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 flex-shrink-0">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Principal Causa
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {aiAnalysis.sintese.principal_motivo}
                      </p>
                    </div>
                    {aiAnalysis.sintese.padrao_critico && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Padrão Crítico
                        </p>
                        <p className="text-sm text-foreground/80">
                          {aiAnalysis.sintese.padrao_critico}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Recomendação
                      </p>
                      <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
                        {aiAnalysis.sintese.recomendacao}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts: Sentimento + Temas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut Sentimento IA */}
            <TechChartCard
              title="Sentimento"
              subtitle="Classificação por IA (análise contextual completa)"
              icon={PieChart}
              iconBg="bg-gradient-to-r from-rose-500 to-orange-500"
            >
              {sentimentDistribution.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <RechartsPie>
                    <Pie
                      data={sentimentDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="sentiment"
                      cursor="pointer"
                      onClick={(entry: any) => {
                        if (entry?.sentiment) {
                          const sentiment = entry.sentiment === 'Negativo'
                            ? 'negativo'
                            : entry.sentiment === 'Positivo'
                            ? 'positivo'
                            : 'neutro';
                          const matched = entry.matchedContratos ?? [];
                          if (matched.length > 0) {
                            onDrill(`Sentimento: ${entry.sentiment}`, matched);
                          }
                        }
                      }}
                    >
                      {sentimentDistribution.map((entry, index) => (
                        <Cell key={`sent-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[160px]">
                            <p className="text-xs font-semibold text-foreground mb-1">{d.sentiment}</p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Contratos</span>
                                <span className="font-bold">{d.count}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">MRR</span>
                                <span className="font-bold text-red-500">
                                  {formatCurrencyNoDecimals(d.mrr)}
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
                  </RechartsPie>
                </ResponsiveContainer>
              )}
            </TechChartCard>

            {/* Temas identificados pela IA */}
            <TechChartCard
              title="Temas Identificados"
              subtitle="Classificação por IA — o que os clientes estão dizendo"
              icon={Hash}
              iconBg="bg-gradient-to-r from-violet-500 to-purple-600"
            >
              {themeDistribution.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {themeDistribution.map((item, i) => {
                    const maxCount = themeDistribution[0]?.count || 1;
                    const barWidth = Math.max((item.count / maxCount) * 100, 8);
                    const isActive = muralFilterTheme === item.theme;
                    return (
                      <button
                        key={`theme-${i}`}
                        onClick={() => {
                          if (isActive) {
                            setMuralFilterTheme(null);
                          } else {
                            setMuralFilterTheme(item.theme);
                            onDrill(`Tema: ${item.theme}`, item.matchedContratos);
                          }
                        }}
                        className={`w-full text-left rounded-md border p-2 transition-all ${
                          isActive
                            ? 'border-violet-400 dark:border-violet-600 bg-violet-50/50 dark:bg-violet-950/30'
                            : 'border-border/30 bg-white/50 dark:bg-zinc-900/30 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-medium text-foreground">{item.theme}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {item.count}x
                            </span>
                            <span className="text-[10px] text-red-500 font-semibold tabular-nums">
                              {formatCurrencyNoDecimals(item.mrr)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </TechChartCard>
          </div>
        </>
      )}

      {/* Padrões nas Mensagens (textPatternAnalysis) — shown regardless of AI */}
      <TechChartCard
        title="Padrões nas Mensagens"
        subtitle="Keywords identificadas na mensagem do cliente"
        icon={MessageSquare}
        iconBg="bg-gradient-to-r from-indigo-500 to-purple-500"
        meta={
          <span className="text-[10px] text-muted-foreground">
            {contratos.filter(c => c.mensagem_cliente).length} com mensagem
          </span>
        }
      >
        {textPatternAnalysis.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
            Sem mensagens para analisar
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={Math.max(220, textPatternAnalysis.length * 40)}
          >
            <BarChart
              data={textPatternAnalysis}
              layout="vertical"
              margin={{ left: 0, right: 10, top: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id="svczBarGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                type="category"
                dataKey="keyword"
                width={80}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = textPatternAnalysis.find((t: any) => t.keyword === label);
                  return (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[200px]">
                      <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Contratos</span>
                          <span className="font-bold text-foreground">{d?.count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">MRR Impactado</span>
                          <span className="font-bold text-red-500">
                            {formatCurrencyNoDecimals(d?.mrr || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">% Evitável</span>
                          <span className="font-bold text-foreground">
                            {(d?.evitavelPct || 0).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      {d?.contratos && d.contratos.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-[10px] text-muted-foreground mb-1">Clientes:</p>
                          {d.contratos.map((n: string, i: number) => (
                            <p key={i} className="text-[10px] text-foreground truncate">{n}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="count"
                fill="url(#svczBarGradient)"
                radius={[0, 4, 4, 0]}
                name="Contratos"
                cursor="pointer"
                onClick={(data: any) => {
                  if (data?.keyword) {
                    const isActive = selectedThemeKeyword === data.keyword;
                    setSelectedThemeKeyword(isActive ? null : data.keyword);
                    if (!isActive && data.matchedContratos?.length > 0) {
                      onDrill(`Padrão: ${data.keyword}`, data.matchedContratos);
                    }
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Drill-down: mensagens matchadas */}
        {selectedThemeKeyword && (() => {
          const themeData = textPatternAnalysis.find(t => t.keyword === selectedThemeKeyword);
          const terms = EXPANDED_KEYWORDS[selectedThemeKeyword] || [];
          if (!themeData || themeData.matchedContratos.length === 0) return null;
          return (
            <div className="mt-3 border-t border-border/50 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">
                  Mensagens com "{selectedThemeKeyword}" ({themeData.matchedContratos.length})
                </p>
                <button
                  onClick={() => setSelectedThemeKeyword(null)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Fechar
                </button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {themeData.matchedContratos.slice(0, 15).map((c, i) => (
                  <div
                    key={`drill-${c.id}-${i}`}
                    className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 p-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">
                        {c.cliente_nome}
                      </span>
                      <span className="text-[10px] text-red-500 font-semibold">
                        {formatCurrencyNoDecimals(c.valorr)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {highlightKeywords(c.mensagem_cliente || '', terms)}
                    </p>
                  </div>
                ))}
                {themeData.matchedContratos.length > 15 && (
                  <p className="text-[10px] text-muted-foreground text-center pt-1">
                    Mostrando 15 de {themeData.matchedContratos.length}
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </TechChartCard>

      {/* Temas Operacionais + Temas CX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Temas Operacionais */}
        <TechChartCard
          title="Temas Operacionais"
          subtitle="Padrões no contexto de operação"
          icon={Shield}
          iconBg="bg-gradient-to-r from-slate-500 to-zinc-600"
        >
          {contextThemes.operacao.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Sem dados de operação
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {contextThemes.operacao.map((item, i) => {
                const maxMrr = Math.max(...contextThemes.operacao.map(d => d.mrr), 1);
                const barWidth = Math.max((item.mrr / maxMrr) * 100, 5);
                const isExpanded = expandedOpTheme === item.theme;
                return (
                  <div
                    key={item.theme}
                    className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setExpandedOpTheme(isExpanded ? null : item.theme);
                        if (!isExpanded && item.matchedContratos.length > 0) {
                          onDrill(`Tema Operacional: ${item.theme}`, item.matchedContratos);
                        }
                      }}
                      className="w-full px-2.5 py-2 space-y-1 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                          />
                          <span className="text-xs font-medium text-foreground">{item.theme}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] h-5">
                            {item.count}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: PALETTE[i % PALETTE.length],
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">
                          {formatCurrencyNoDecimals(item.mrr)}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border/30 bg-gray-50/50 dark:bg-zinc-950/30 px-2.5 py-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                        {item.matchedContratos.slice(0, 20).map(c => (
                          <div key={c.id} className="flex items-start gap-2 text-[11px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500 flex-shrink-0 mt-1.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-foreground truncate max-w-[140px]">
                                  {c.cliente_nome}
                                </span>
                                <span className="text-red-500 dark:text-red-400 tabular-nums">
                                  {formatCurrencyNoDecimals(c.valorr)}
                                </span>
                              </div>
                              <p className="text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                                {c.contexto_operacao}
                              </p>
                            </div>
                          </div>
                        ))}
                        {item.matchedContratos.length > 20 && (
                          <p className="text-[10px] text-muted-foreground text-center pt-1">
                            +{item.matchedContratos.length - 20} contratos
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TechChartCard>

        {/* Temas CX */}
        <TechChartCard
          title="Temas CX"
          subtitle="Padrões no contexto de experiência do cliente"
          icon={Users}
          iconBg="bg-gradient-to-r from-teal-500 to-cyan-500"
        >
          {contextThemes.cx.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Sem dados de CX
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {contextThemes.cx.map((item, i) => {
                const maxMrr = Math.max(...contextThemes.cx.map(d => d.mrr), 1);
                const barWidth = Math.max((item.mrr / maxMrr) * 100, 5);
                const isExpanded = expandedCxTheme === item.theme;
                return (
                  <div
                    key={item.theme}
                    className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setExpandedCxTheme(isExpanded ? null : item.theme);
                        if (!isExpanded && item.matchedContratos.length > 0) {
                          onDrill(`Tema CX: ${item.theme}`, item.matchedContratos);
                        }
                      }}
                      className="w-full px-2.5 py-2 space-y-1 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PALETTE[(i + 5) % PALETTE.length] }}
                          />
                          <span className="text-xs font-medium text-foreground">{item.theme}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] h-5">
                            {item.count}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: PALETTE[(i + 5) % PALETTE.length],
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">
                          {formatCurrencyNoDecimals(item.mrr)}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border/30 bg-gray-50/50 dark:bg-zinc-950/30 px-2.5 py-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                        {item.matchedContratos.slice(0, 20).map(c => (
                          <div key={c.id} className="flex items-start gap-2 text-[11px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 dark:bg-teal-600 flex-shrink-0 mt-1.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-foreground truncate max-w-[140px]">
                                  {c.cliente_nome}
                                </span>
                                <span className="text-red-500 dark:text-red-400 tabular-nums">
                                  {formatCurrencyNoDecimals(c.valorr)}
                                </span>
                              </div>
                              <p className="text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                                {c.contexto_cx}
                              </p>
                            </div>
                          </div>
                        ))}
                        {item.matchedContratos.length > 20 && (
                          <p className="text-[10px] text-muted-foreground text-center pt-1">
                            +{item.matchedContratos.length - 20} contratos
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TechChartCard>
      </div>

      {/* Mural de Mensagens (only when AI data available) */}
      {aiAnalysis && !aiLoading && (
        <Card className="border-border/50">
          <CardHeader className="py-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold">Mensagens dos Clientes</CardTitle>
                <CardDescription className="text-xs">
                  {contratosComMensagem.length} mensagens analisadas por IA
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Sentiment filter pills */}
                {(['negativo', 'neutro', 'positivo'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setMuralFilterSentiment(muralFilterSentiment === s ? null : s)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border ${
                      muralFilterSentiment === s
                        ? s === 'negativo'
                          ? 'bg-red-500 text-white border-red-500'
                          : s === 'positivo'
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-gray-500 text-white border-gray-500'
                        : 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {s === 'negativo' ? 'Negativo' : s === 'positivo' ? 'Positivo' : 'Neutro'}
                  </button>
                ))}
                <span className="text-border/60">|</span>
                {/* Sort buttons */}
                <div className="flex gap-1">
                  {(['mrr', 'date'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setMuralSortBy(s)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                        muralSortBy === s
                          ? 'bg-teal-500 text-white shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {s === 'mrr' ? 'Por MRR' : 'Por Data'}
                    </button>
                  ))}
                </div>
                {(muralFilterSentiment || muralFilterTheme) && (
                  <button
                    onClick={() => {
                      setMuralFilterSentiment(null);
                      setMuralFilterTheme(null);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {muralMessages.length === 0 ? (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhuma mensagem com os filtros selecionados
              </div>
            ) : (
              <>
                {muralMessages.length > 50 && (
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Mostrando 50 de {muralMessages.length}
                  </p>
                )}
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {muralMessages.slice(0, 50).map((msg, i) => {
                    const sentColor =
                      msg.sentiment === 'negativo'
                        ? 'border-l-red-500'
                        : msg.sentiment === 'positivo'
                        ? 'border-l-green-500'
                        : 'border-l-gray-400 dark:border-l-zinc-500';
                    const isExpanded = muralExpandedId === msg.id;
                    const msgDate = msg.data_encerramento || msg.data_pausa;
                    return (
                      <div
                        key={`mural-${msg.id}-${i}`}
                        className={`rounded-lg border border-border/40 bg-white/70 dark:bg-zinc-900/50 p-3 border-l-4 ${sentColor} transition-all`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {msg.cliente_nome}
                              </p>
                              <span className="text-[10px] text-red-500 font-semibold">
                                {formatCurrencyNoDecimals(msg.valorr)}
                              </span>
                            </div>
                            {msg.resumo && (
                              <p className="text-xs text-muted-foreground italic mt-0.5">
                                {msg.resumo}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 flex-shrink-0">
                            {msg.temas.map((t, ti) => (
                              <Badge
                                key={ti}
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800"
                              >
                                {t}
                              </Badge>
                            ))}
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 ${
                                msg.sentiment === 'negativo'
                                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                  : msg.sentiment === 'positivo'
                                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                              }`}
                            >
                              {msg.sentiment === 'negativo'
                                ? 'Negativo'
                                : msg.sentiment === 'positivo'
                                ? 'Positivo'
                                : 'Neutro'}
                            </Badge>
                          </div>
                        </div>
                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {msg.squad}
                          </Badge>
                          {msg.motivo_cancelamento && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
                            >
                              {msg.motivo_cancelamento}
                            </Badge>
                          )}
                          {msg.evitabilidade_churn && (
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 ${
                                msg.evitabilidade_churn === 'Evitável'
                                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                              }`}
                            >
                              {msg.evitabilidade_churn}
                            </Badge>
                          )}
                          {msgDate && (
                            <span className="text-[10px] text-muted-foreground">
                              {format(parseISO(msgDate), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        {/* Message body */}
                        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">
                          {msg.mensagem_cliente}
                        </p>
                        {/* Expandable context */}
                        {(msg.contexto_operacao || msg.contexto_cx) && (
                          <div className="mt-2">
                            <button
                              onClick={() =>
                                setMuralExpandedId(isExpanded ? null : msg.id)
                              }
                              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              Contexto adicional
                            </button>
                            {isExpanded && (
                              <div className="mt-2 space-y-2 pl-3 border-l-2 border-border/40">
                                {msg.contexto_operacao && (
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                                      Contexto Operação
                                    </p>
                                    <p className="text-[11px] text-foreground/70 whitespace-pre-line">
                                      {msg.contexto_operacao}
                                    </p>
                                  </div>
                                )}
                                {msg.contexto_cx && (
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                                      Contexto CX
                                    </p>
                                    <p className="text-[11px] text-foreground/70 whitespace-pre-line">
                                      {msg.contexto_cx}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </SectionBlock>
  );
}

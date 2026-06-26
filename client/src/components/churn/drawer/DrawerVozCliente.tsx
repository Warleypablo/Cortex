import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageSquare } from "lucide-react";
import { type ChurnContract } from "@/components/churn/types";
import { formatCurrencyNoDecimals } from "@/lib/utils";

// ===== Types =====

interface AiAnalysis {
  analises: { id: string; sentimento: string; temas: string[]; resumo: string }[];
  sintese: { principal_motivo: string; padrao_critico: string; recomendacao: string };
}

// ===== Helpers =====

const SENTIMENT_CONFIG = {
  negativo: {
    label: "Negativo",
    dot: "bg-red-500",
    badge:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    border: "border-l-red-500",
  },
  neutro: {
    label: "Neutro",
    dot: "bg-gray-400 dark:bg-zinc-500",
    badge:
      "bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    border: "border-l-gray-400 dark:border-l-zinc-500",
  },
  positivo: {
    label: "Positivo",
    dot: "bg-green-500",
    badge:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    border: "border-l-green-500",
  },
} as const;

type SentimentKey = keyof typeof SENTIMENT_CONFIG;

// ===== Component =====

export function DrawerVozCliente({
  contratos,
  enabled,
}: {
  contratos: ChurnContract[];
  enabled: boolean;
}): JSX.Element {
  const [muralFilterSentiment, setMuralFilterSentiment] = useState<SentimentKey | null>(null);

  // ---- Derived data ----

  const contratosComMensagem = useMemo(
    () => contratos.filter((c) => c.mensagem_cliente && c.mensagem_cliente.trim().length > 0),
    [contratos],
  );

  const aiPayload = useMemo(() => {
    if (contratosComMensagem.length === 0) return null;
    return contratosComMensagem.map((c) => ({
      id: c.id,
      cliente: c.cliente_nome,
      mensagem: c.mensagem_cliente!,
      motivo: c.motivo_cancelamento || undefined,
      mrr: c.valorr || 0,
    }));
  }, [contratosComMensagem]);

  // ---- AI query — gated: only fires when tab is active AND messages exist ----

  const {
    data: aiAnalysis,
    isLoading: aiLoading,
    error: aiError,
    refetch: refetchAI,
  } = useQuery<AiAnalysis>({
    queryKey: [
      "/api/analytics/churn-mensagens-ai",
      aiPayload?.map((m) => m.id).sort().join(","),
    ],
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
    enabled: enabled && !!aiPayload && aiPayload.length > 0,
    staleTime: 1000 * 60 * 30, // 30 min cache
    retry: 1,
  });

  // ---- Derived distributions ----

  const aiByContract = useMemo(() => {
    const map = new Map<string, { sentimento: string; temas: string[]; resumo: string }>();
    if (!aiAnalysis?.analises) return map;
    aiAnalysis.analises.forEach((a) => map.set(a.id, a));
    return map;
  }, [aiAnalysis]);

  const sentimentDistribution = useMemo(() => {
    if (!aiAnalysis?.analises) return [];
    const acc: Record<string, { count: number; mrr: number }> = {
      negativo: { count: 0, mrr: 0 },
      neutro: { count: 0, mrr: 0 },
      positivo: { count: 0, mrr: 0 },
    };
    aiAnalysis.analises.forEach((a) => {
      const key = a.sentimento in acc ? a.sentimento : "neutro";
      const c = contratosComMensagem.find((x) => x.id === a.id);
      acc[key].count++;
      acc[key].mrr += c?.valorr || 0;
    });
    return (Object.entries(acc) as [SentimentKey, { count: number; mrr: number }][]).filter(
      ([, v]) => v.count > 0,
    );
  }, [aiAnalysis, contratosComMensagem]);

  const themeDistribution = useMemo(() => {
    if (!aiAnalysis?.analises) return [];
    const themes: Record<string, { count: number; mrr: number }> = {};
    aiAnalysis.analises.forEach((a) => {
      const c = contratosComMensagem.find((x) => x.id === a.id);
      const mrr = c?.valorr || 0;
      (a.temas || []).forEach((t) => {
        if (!themes[t]) themes[t] = { count: 0, mrr: 0 };
        themes[t].count++;
        themes[t].mrr += mrr;
      });
    });
    return Object.entries(themes)
      .map(([theme, data]) => ({ theme, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [aiAnalysis, contratosComMensagem]);

  const muralMessages = useMemo(() => {
    let msgs = contratosComMensagem.map((c) => {
      const ai = aiByContract.get(c.id);
      return {
        ...c,
        sentiment: (ai?.sentimento || "neutro") as SentimentKey,
        temas: ai?.temas || [],
        resumo: ai?.resumo || "",
      };
    });

    if (muralFilterSentiment) {
      msgs = msgs.filter((m) => m.sentiment === muralFilterSentiment);
    }

    msgs.sort((a, b) => (b.valorr || 0) - (a.valorr || 0));
    return msgs;
  }, [contratosComMensagem, aiByContract, muralFilterSentiment]);

  // ---- Guard: don't render when tab is not active ----

  if (!enabled) return <div />;

  // ---- Empty state ----

  if (contratosComMensagem.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-zinc-400">
        <MessageSquare className="h-4 w-4 mr-2 opacity-50" />
        Nenhuma mensagem de cliente disponível neste recorte.
      </div>
    );
  }

  // ---- Loading ----

  if (aiLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-10">
        <div className="h-5 w-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-zinc-400">
          Analisando {contratosComMensagem.length} mensagens com IA...
        </span>
      </div>
    );
  }

  // ---- Error ----

  if (aiError) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-4">
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">Erro na análise IA</p>
        <p className="text-xs text-red-500/80 dark:text-red-400/60 mt-1">
          {(aiError as Error).message}
        </p>
        <button
          onClick={() => refetchAI()}
          className="mt-3 text-xs text-teal-600 dark:text-teal-400 underline hover:text-teal-800 dark:hover:text-teal-300 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // ---- Full render when AI data available ----

  if (!aiAnalysis) return <div />;

  const maxThemeCount = themeDistribution[0]?.count || 1;

  return (
    <div className="space-y-4">
      {/* ── Síntese card ── */}
      {aiAnalysis.sintese && (
        <div className="rounded-lg border border-teal-200/60 dark:border-teal-800/40 bg-teal-50/30 dark:bg-teal-950/20 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 flex-shrink-0">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="space-y-2 min-w-0">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-0.5">
                  Principal Causa
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {aiAnalysis.sintese.principal_motivo}
                </p>
              </div>
              {aiAnalysis.sintese.padrao_critico && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-0.5">
                    Padrão Crítico
                  </p>
                  <p className="text-sm text-gray-700 dark:text-zinc-300">
                    {aiAnalysis.sintese.padrao_critico}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-0.5">
                  Recomendação
                </p>
                <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
                  {aiAnalysis.sintese.recomendacao}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sentimento pills + Temas side-by-side ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sentimento */}
        <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
          <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">
            Sentimento
          </p>
          {sentimentDistribution.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-zinc-500">Sem dados</p>
          ) : (
            <div className="space-y-1.5">
              {sentimentDistribution.map(([key, val]) => {
                const cfg = SENTIMENT_CONFIG[key] ?? SENTIMENT_CONFIG.neutro;
                const isActive = muralFilterSentiment === key;
                return (
                  <button
                    key={key}
                    onClick={() =>
                      setMuralFilterSentiment(isActive ? null : key)
                    }
                    className={`w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 transition-colors text-left border ${
                      isActive
                        ? "border-teal-400 dark:border-teal-600 bg-teal-50 dark:bg-teal-950/30"
                        : "border-transparent bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className="text-xs font-medium text-gray-800 dark:text-zinc-200">
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] tabular-nums">
                      <span className="text-gray-500 dark:text-zinc-400">{val.count}x</span>
                      <span className="text-red-500 font-semibold">
                        {formatCurrencyNoDecimals(val.mrr)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Temas */}
        <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
          <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">
            Temas Identificados
          </p>
          {themeDistribution.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-zinc-500">Sem dados</p>
          ) : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
              {themeDistribution.map((item) => {
                const barWidth = Math.max((item.count / maxThemeCount) * 100, 6);
                return (
                  <div key={item.theme} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-gray-700 dark:text-zinc-300 truncate">
                        {item.theme}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] tabular-nums flex-shrink-0">
                        <span className="text-gray-500 dark:text-zinc-400">{item.count}x</span>
                        <span className="text-red-500 font-semibold">
                          {formatCurrencyNoDecimals(item.mrr)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Mural de mensagens ── */}
      <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
              Mensagens dos Clientes
            </span>
            <span className="text-[11px] text-gray-400 dark:text-zinc-500">
              ({contratosComMensagem.length} analisadas)
            </span>
          </div>
          {/* Sentiment filter pills */}
          <div className="flex items-center gap-1">
            {(Object.keys(SENTIMENT_CONFIG) as SentimentKey[]).map((key) => {
              const cfg = SENTIMENT_CONFIG[key];
              const isActive = muralFilterSentiment === key;
              return (
                <button
                  key={key}
                  onClick={() =>
                    setMuralFilterSentiment(isActive ? null : key)
                  }
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                    isActive
                      ? cfg.badge + " font-semibold"
                      : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </button>
              );
            })}
            {muralFilterSentiment && (
              <button
                onClick={() => setMuralFilterSentiment(null)}
                className="ml-1 text-[10px] text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 underline transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Messages list */}
        <div className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-[520px] overflow-y-auto">
          {muralMessages.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400 dark:text-zinc-500">
              Nenhuma mensagem com os filtros selecionados
            </div>
          ) : (
            <>
              {muralMessages.slice(0, 20).map((msg, i) => {
                const cfg = SENTIMENT_CONFIG[msg.sentiment] ?? SENTIMENT_CONFIG.neutro;
                return (
                  <div
                    key={`mural-${msg.id}-${i}`}
                    className={`px-4 py-3 border-l-4 ${cfg.border} transition-colors`}
                  >
                    {/* Row: name + mrr + sentiment badge */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {msg.cliente_nome}
                          </span>
                          <span className="text-xs text-red-500 font-semibold tabular-nums">
                            {formatCurrencyNoDecimals(msg.valorr)}
                          </span>
                        </div>
                        {msg.resumo && (
                          <p className="text-xs text-gray-500 dark:text-zinc-400 italic mt-0.5">
                            {msg.resumo}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 flex-shrink-0 items-start">
                        {msg.temas.slice(0, 3).map((t, ti) => (
                          <Badge
                            key={ti}
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800"
                          >
                            {t}
                          </Badge>
                        ))}
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 h-4 ${cfg.badge}`}
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                    </div>
                    {/* Message text */}
                    <p className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line line-clamp-4">
                      {msg.mensagem_cliente}
                    </p>
                  </div>
                );
              })}
              {muralMessages.length > 20 && (
                <div className="px-4 py-2 text-center text-[11px] text-gray-400 dark:text-zinc-500">
                  Mostrando 20 de {muralMessages.length} mensagens
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

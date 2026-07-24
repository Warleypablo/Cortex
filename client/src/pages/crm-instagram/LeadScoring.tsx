import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, Minus, Lock } from "lucide-react";
import {
  leadScore, DEFAULT_SCORING_CONFIG, type ScoringConfig, type InteractionType,
} from "@shared/crmInstagramScoring";

type ConfigResponse = {
  config: ScoringConfig;
  isDefault: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  canEdit: boolean;
};

type Lead = {
  id: number;
  igUsername: string | null;
  displayName: string | null;
  dmCount: number;
  commentCount: number;
  likeCount?: number;
  likeAdCount?: number;
  followCount?: number;
  distinctPosts?: number;
  score: number;
};

function leadLabel(l: Lead): string {
  return l.displayName || (l.igUsername ? `@${l.igUsername}` : "lead sem nome");
}

// Ordem do mockup: do sinal mais leve ao mais forte.
const POINT_FIELDS: { key: InteractionType; emoji: string; label: string; captured: boolean }[] = [
  { key: "follow", emoji: "👥", label: "Seguiu a conta", captured: false },
  { key: "like", emoji: "❤️", label: "Curtida em post", captured: false },
  { key: "comment", emoji: "💬", label: "Comentário em post", captured: true },
  { key: "spontaneous_dm", emoji: "💌", label: "DM espontânea", captured: true },
];

// Bônus (não são interações; somam por cima).
// Só a curtida grava ig_media_id — DM e follow entram sem post, então na prática
// a recorrência mede "curtiu N posts diferentes". O hint diz isso explicitamente.
const BONUS_FIELDS: { key: "recurrenceBonus"; emoji: string; label: string; hint: string }[] = [
  { key: "recurrenceBonus", emoji: "🔁", label: "Bônus por recorrência", hint: "por post distinto curtido além do 1º (só curtida conta — DM e follow não têm post)" },
];

export default function LeadScoring() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: cfgData, isLoading } = useQuery<ConfigResponse>({
    queryKey: ["/api/crm-instagram/scoring-config"],
  });
  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["/api/crm-instagram/profiles", { scope: "all" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm-instagram/profiles?scope=all");
      return res.json();
    },
  });

  const [cfg, setCfg] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG);
  useEffect(() => { if (cfgData?.config) setCfg(cfgData.config); }, [cfgData]);

  const saveM = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/crm-instagram/scoring-config", { config: cfg });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração salva", description: "A fila já reflete os novos pesos." });
      qc.invalidateQueries({ queryKey: ["/api/crm-instagram/scoring-config"] });
      qc.invalidateQueries({ queryKey: ["/api/crm-instagram/profiles"] });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const canEdit = !!cfgData?.canEdit;
  const dirty = useMemo(
    () => !!cfgData && JSON.stringify(cfg) !== JSON.stringify(cfgData.config),
    [cfg, cfgData],
  );

  // Preview: recalcula com a MESMA função pura do server, usando o config local.
  const preview = useMemo(() => {
    return (leads || [])
      .map((l) => ({
        l,
        novo: leadScore({
          counts: {
            spontaneous_dm: l.dmCount,
            comment: l.commentCount,
            like: l.likeCount || 0,
            like_ad: l.likeAdCount || 0,
            follow: l.followCount || 0,
          },
          distinctPosts: l.distinctPosts || 0,
        }, cfg),
      }))
      .sort((a, b) => b.novo - a.novo)
      .slice(0, 15);
  }, [leads, cfg]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const setPoint = (k: InteractionType, v: number) =>
    setCfg((c) => ({ ...c, points: { ...c.points, [k]: v } }));
  const setBonus = (k: "recurrenceBonus", v: number) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const setDecay = (k: "hotDays" | "warmDays", v: number) =>
    setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
      {/* Config (estilo mockup) */}
      <div className="space-y-4">
        {!canEdit && (
          <div className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
            <Lock className="h-3 w-3" /> Você pode visualizar e simular, mas só editores salvam.
          </div>
        )}

        {/* Pontuação por interação */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Pontuação por interação
          </div>
          <div className="space-y-4">
            {POINT_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {f.emoji} {f.label}
                  </div>
                  {!f.captured && (
                    <div className="text-[10px] text-amber-500">precisa de captura (scraper)</div>
                  )}
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={cfg.points[f.key]}
                  disabled={!canEdit}
                  onChange={(e) => setPoint(f.key, Number(e.target.value))}
                  className="w-32 accent-emerald-500"
                />
                <span className="w-12 text-right text-sm font-semibold text-emerald-500 tabular-nums">
                  +{cfg.points[f.key]} pt{cfg.points[f.key] === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bônus */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Bônus
          </div>
          <div className="space-y-4">
            {BONUS_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900 dark:text-white">{f.emoji} {f.label}</div>
                  <div className="text-[10px] text-gray-400">{f.hint}</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={cfg[f.key]}
                  disabled={!canEdit}
                  onChange={(e) => setBonus(f.key, Number(e.target.value))}
                  className="w-32 accent-purple-500"
                />
                <span className="w-12 text-right text-sm font-semibold text-purple-500 tabular-nums">
                  +{cfg[f.key]} pt{cfg[f.key] === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Decay de temperatura */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Esfriamento por tempo
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 mb-3">
            Sem nova interação, o lead vai esfriando. Define em quantos dias ele muda de temperatura.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 text-sm text-gray-900 dark:text-white">
                Fica <span className="font-semibold text-red-500">🔥 Quente</span> por até
              </div>
              <input
                type="range" min={1} max={60} step={1}
                value={cfg.hotDays}
                disabled={!canEdit}
                onChange={(e) => setDecay("hotDays", Number(e.target.value))}
                className="w-32 accent-red-500"
              />
              <span className="w-14 text-right text-sm font-semibold text-red-500 tabular-nums">{cfg.hotDays} dias</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 text-sm text-gray-900 dark:text-white">
                Vira <span className="font-semibold text-sky-500">❄️ Frio</span> após
              </div>
              <input
                type="range" min={Math.max(2, cfg.hotDays + 1)} max={120} step={1}
                value={cfg.warmDays}
                disabled={!canEdit}
                onChange={(e) => setDecay("warmDays", Number(e.target.value))}
                className="w-32 accent-sky-500"
              />
              <span className="w-14 text-right text-sm font-semibold text-sky-500 tabular-nums">{cfg.warmDays} dias</span>
            </div>
          </div>
          {/* Faixas resultantes — deixa o efeito explícito */}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 dark:border-zinc-800 pt-3 text-[11px]">
            <span className="rounded bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 text-red-600 dark:text-red-300">🔥 Quente: 0–{cfg.hotDays} dias</span>
            <span className="rounded bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 text-amber-600 dark:text-amber-300">🌡 Morno: {cfg.hotDays + 1}–{cfg.warmDays} dias</span>
            <span className="rounded bg-sky-100 dark:bg-sky-950/40 px-1.5 py-0.5 text-sky-600 dark:text-sky-300">❄️ Frio: {cfg.warmDays}+ dias</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button className="flex-1" onClick={() => saveM.mutate()} disabled={!canEdit || !dirty || saveM.isPending}>
            {saveM.isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
          <Button
            variant="outline"
            disabled={!canEdit || JSON.stringify(cfg) === JSON.stringify(DEFAULT_SCORING_CONFIG)}
            onClick={() => setCfg(DEFAULT_SCORING_CONFIG)}
          >
            Padrão
          </Button>
        </div>
        {cfgData?.updatedAt && (
          <p className="text-[11px] text-gray-400">
            Última alteração: {new Date(cfgData.updatedAt).toLocaleString("pt-BR")}
            {cfgData.updatedBy ? ` · ${cfgData.updatedBy}` : ""}
          </p>
        )}
      </div>

      {/* Preview ao vivo */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Preview ao vivo</h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3">
          Top 15 leads reordenados pelos pesos atuais vs. o que está salvo.
        </p>
        <div className="rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
              <tr>
                <th className="text-left p-2 font-medium w-8">#</th>
                <th className="text-left p-2 font-medium">Lead</th>
                <th className="text-right p-2 font-medium">Atual</th>
                <th className="text-right p-2 font-medium">Novo</th>
                <th className="text-center p-2 font-medium w-10">Δ</th>
              </tr>
            </thead>
            <tbody>
              {preview.map(({ l, novo }, i) => {
                const delta = novo - l.score;
                return (
                  <tr key={l.id} className="border-t border-gray-100 dark:border-zinc-800">
                    <td className="p-2 text-gray-400">{i + 1}</td>
                    <td className="p-2 text-gray-900 dark:text-white truncate max-w-[160px]">{leadLabel(l)}</td>
                    <td className="p-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">{l.score}</td>
                    <td className="p-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{novo}</td>
                    <td className="p-2 text-center">
                      {delta > 0 ? (
                        <span className="inline-flex items-center text-emerald-500"><ArrowUp className="h-3 w-3" />{delta}</span>
                      ) : delta < 0 ? (
                        <span className="inline-flex items-center text-red-500"><ArrowDown className="h-3 w-3" />{Math.abs(delta)}</span>
                      ) : (
                        <Minus className="h-3 w-3 inline text-gray-300 dark:text-zinc-600" />
                      )}
                    </td>
                  </tr>
                );
              })}
              {preview.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Sem leads pra simular.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

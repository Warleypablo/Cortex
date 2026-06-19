import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mail, Search, ExternalLink, Check, Ban } from "lucide-react";
import { QUALIFICATION_TAGS, TAG_LABELS, BLOCKING_TAGS, type QualificationTag } from "@shared/crmInstagramTags";
import { HistoryPanel } from "./LeadHistory";

type Row = {
  id: number;
  igUsername: string | null;
  displayName: string | null;
  bio: string | null;
  followersCount: number | null;
  stage: string;
  qualification: QualificationTag | null;
  commentCount: number;
  dmCount: number;
  lastInteractionAt: string | null;
  temperature: "hot" | "warm" | "cold";
  score: number;
};

function label(r: Row): string {
  return r.displayName || (r.igUsername ? `@${r.igUsername}` : "lead sem nome");
}

function initials(name: string): string {
  const parts = name.replace(/^@/, "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const STAGE_LABEL: Record<string, string> = {
  engajador: "Engajador",
  oportunidade: "Oportunidade",
  negocio: "Negócio",
};

const TEMP: Record<string, { emoji: string; label: string; cls: string }> = {
  hot: { emoji: "🔥", label: "Quente", cls: "text-red-500" },
  warm: { emoji: "🌡️", label: "Morno", cls: "text-amber-500" },
  cold: { emoji: "❄️", label: "Frio", cls: "text-sky-400" },
};

function scoreColor(score: number): string {
  if (score >= 10) return "text-emerald-500";
  if (score >= 5) return "text-amber-500";
  return "text-gray-400";
}

// "Hoje, 09:14" / "Ontem, 18:02" / "12/06/2026"
function formatEngagement(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const days = (Date.now() - d.getTime()) / 86_400_000;
  if (days < 1 && d.getDate() === new Date().getDate()) return `Hoje, ${time}`;
  if (days < 2) return `Ontem, ${time}`;
  return d.toLocaleDateString("pt-BR");
}

export default function Qualificacao() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // scope=all: traz todos, inclusive os bloqueados (colaborador/desqualificado).
  const { data: rows, isLoading } = useQuery<Row[]>({
    queryKey: ["/api/crm-instagram/profiles", { scope: "all" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm-instagram/profiles?scope=all");
      return res.json();
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/crm-instagram/profiles"] });

  const tagM = useMutation({
    mutationFn: async ({ id, qualification }: { id: number; qualification: string | null }) => {
      const res = await apiRequest("POST", `/api/crm-instagram/profiles/${id}/qualification`, { qualification });
      return res.json();
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao qualificar", description: e.message, variant: "destructive" }),
  });

  const stageM = useMutation({
    mutationFn: async ({ id, toStage }: { id: number; toStage: string }) => {
      const res = await apiRequest("POST", `/api/crm-instagram/profiles/${id}/stage`, { toStage });
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Movido pra Oportunidade" }); },
    onError: (e: any) => toast({ title: "Erro ao mover", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => (rows || []).filter((r) => {
    const matchQ = !q || label(r).toLowerCase().includes(q.toLowerCase()) || (r.igUsername || "").toLowerCase().includes(q.toLowerCase());
    const matchTag = !tagFilter || (tagFilter === "__none__" ? !r.qualification : r.qualification === tagFilter);
    const matchStage = !stageFilter || r.stage === stageFilter;
    return matchQ && matchTag && matchStage;
  }), [rows, q, tagFilter, stageFilter]);

  // Card sempre visível: mantém o 1º da lista selecionado quando nada válido está.
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (selectedId == null || !filtered.some((r) => r.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const selected = filtered.find((r) => r.id === selectedId) || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nome ou @handle"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-8 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm text-gray-900 dark:text-white"
        >
          <option value="">Todos os estágios</option>
          {Object.entries(STAGE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="h-8 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm text-gray-900 dark:text-white"
        >
          <option value="">Todas as tags</option>
          <option value="__none__">Sem tag</option>
          {QUALIFICATION_TAGS.map((t) => (
            <option key={t} value={t}>{TAG_LABELS[t]}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500 dark:text-zinc-400 ml-auto">{filtered.length} contatos</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="w-full lg:flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
              <tr>
                <th className="text-left p-3 font-medium">Contato</th>
                <th className="text-left p-3 font-medium">@handle</th>
                <th className="text-right p-3 font-medium">Interações</th>
                <th className="text-right p-3 font-medium">DMs</th>
                <th className="text-left p-3 font-medium">Estágio</th>
                <th className="text-left p-3 font-medium">Tag</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const blocked = r.qualification && (BLOCKING_TAGS as string[]).includes(r.qualification);
                const isSel = r.id === selectedId;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`border-t border-gray-100 dark:border-zinc-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${blocked ? "opacity-60" : ""} ${isSel ? "bg-indigo-50 dark:bg-indigo-950/30" : ""}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300">{r.score}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{label(r)}</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-500 dark:text-zinc-400">{r.igUsername ? `@${r.igUsername}` : "—"}</td>
                    <td className="p-3 text-right text-gray-700 dark:text-zinc-300">{r.commentCount + r.dmCount}</td>
                    <td className="p-3 text-right">
                      {r.dmCount > 0 ? (
                        <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />{r.dmCount}</Badge>
                      ) : (
                        <span className="text-gray-400 inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />0</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-500 dark:text-zinc-400">{STAGE_LABEL[r.stage] || r.stage}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={r.qualification || ""}
                        disabled={tagM.isPending}
                        onChange={(e) => tagM.mutate({ id: r.id, qualification: e.target.value || null })}
                        className="h-8 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs text-gray-900 dark:text-white"
                      >
                        <option value="">— qualificar —</option>
                        {QUALIFICATION_TAGS.map((t) => (
                          <option key={t} value={t}>{TAG_LABELS[t]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">Nenhum contato.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && (
          <LeadDetailCard
            lead={selected}
            onOportunidade={() => stageM.mutate({ id: selected.id, toStage: "oportunidade" })}
            onNaoeh={() => tagM.mutate({ id: selected.id, qualification: "desqualificado" })}
            busy={stageM.isPending || tagM.isPending}
          />
        )}
      </div>
    </div>
  );
}

function LeadDetailCard({
  lead, onOportunidade, onNaoeh, busy,
}: {
  lead: Row;
  onOportunidade: () => void;
  onNaoeh: () => void;
  busy: boolean;
}) {
  const t = TEMP[lead.temperature] || TEMP.cold;
  const name = label(lead);

  return (
    <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-sky-500 text-lg font-bold text-white">
        {initials(name)}
      </div>

      <div className="mt-3">
        {lead.igUsername ? (
          <a
            href={`https://instagram.com/${lead.igUsername}`}
            target="_blank"
            rel="noreferrer"
            className="text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            title={`Abrir @${lead.igUsername} no Instagram`}
          >
            {name}
          </a>
        ) : (
          <div className="text-lg font-bold text-gray-900 dark:text-white">{name}</div>
        )}
        <div className="text-xs text-gray-500 dark:text-zinc-400">
          {lead.igUsername ? `@${lead.igUsername}` : "sem @handle"}
          {lead.followersCount != null ? ` · ${lead.followersCount.toLocaleString("pt-BR")} seguidores` : ""}
        </div>
        {lead.bio && (
          <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400 line-clamp-3">{lead.bio}</p>
        )}
      </div>

      <div className="mt-4 space-y-2 border-t border-gray-100 dark:border-zinc-800 pt-3 text-sm">
        <Stat label="Score">
          <span className={`font-bold ${scoreColor(lead.score)}`}>{lead.score} pts</span>
        </Stat>
        <Stat label="Temperatura">
          <span className={`font-semibold ${t.cls}`}>{t.emoji} {t.label}</span>
        </Stat>
        <Stat label="Seguidores">
          <span className="font-semibold text-gray-900 dark:text-white">
            {lead.followersCount != null ? lead.followersCount.toLocaleString("pt-BR") : "—"}
          </span>
        </Stat>
        <Stat label="Último engajamento">
          <span className="font-semibold text-gray-900 dark:text-white">{formatEngagement(lead.lastInteractionAt)}</span>
        </Stat>
        <Stat label="Total de interações">
          <span className="font-semibold text-gray-900 dark:text-white">{lead.commentCount + lead.dmCount}</span>
        </Stat>
      </div>

      {lead.igUsername && (
        <a
          href={`https://instagram.com/${lead.igUsername}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />Ver no Instagram
        </a>
      )}

      <HistoryPanel id={lead.id} />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button size="sm" className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={busy} onClick={onOportunidade}>
          <Check className="h-3.5 w-3.5" />Oportunidade
        </Button>
        <Button size="sm" variant="outline" className="gap-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" disabled={busy} onClick={onNaoeh}>
          <Ban className="h-3.5 w-3.5" />Não é
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

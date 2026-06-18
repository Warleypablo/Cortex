import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, Heart, UserPlus } from "lucide-react";

export type Interaction = {
  id: number;
  type: string;
  igMediaId: string | null;
  text: string | null;
  source: string | null;
  occurredAt: string;
  postCaption: string | null;
  intent?: boolean;
  points: number;
};

// Tempo relativo curto pro histórico: "Hoje", "Ontem", "N dias".
export function relTime(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return "Hoje";
  if (days < 2) return "Ontem";
  return `${Math.floor(days)} dias`;
}

// Histórico de interações do lead (lazy: só busca quando montado).
// Hoje cobre comentário + DM (o que a API oficial entrega); curtida/save/seguir
// entram quando a captura por scraper existir.
export function HistoryPanel({ id }: { id: number }) {
  const { data, isLoading } = useQuery<{ interactions: Interaction[] }>({
    queryKey: [`/api/crm-instagram/profiles/${id}`],
  });

  if (isLoading) {
    return <div className="mt-2 text-xs text-gray-400">Carregando histórico...</div>;
  }
  const items = data?.interactions || [];

  return (
    <div className="mt-2 space-y-1.5 border-t border-gray-100 dark:border-zinc-800 pt-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Histórico de interações
      </div>
      {items.length === 0 && (
        <div className="text-xs text-gray-400">Sem interações registradas.</div>
      )}
      {items.map((it) => {
        const isDm = it.type === "spontaneous_dm";
        const Icon = isDm ? Mail : it.type === "like" || it.type === "like_ad" ? Heart : it.type === "follow" ? UserPlus : MessageCircle;
        const label =
          it.type === "spontaneous_dm" ? "Mandou DM"
          : it.type === "like" ? "Curtiu um post"
          : it.type === "like_ad" ? "Curtiu um anúncio"
          : it.type === "follow" ? "Seguiu a conta"
          : it.postCaption
            ? `Comentou em "${it.postCaption.slice(0, 30)}${it.postCaption.length > 30 ? "…" : ""}"`
            : "Comentou";
        return (
          <div key={it.id} className="flex items-center gap-2 text-xs">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${isDm ? "text-blue-500" : "text-gray-400"}`} />
            <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-zinc-300">{label}</span>
            {it.intent && (
              <span className="shrink-0 rounded bg-purple-100 dark:bg-purple-950/40 px-1 text-[10px] font-semibold text-purple-600 dark:text-purple-300" title="Comentário com intenção de compra">
                intenção
              </span>
            )}
            {it.source && (
              <span className="shrink-0 rounded bg-gray-100 dark:bg-zinc-800 px-1 text-[10px] text-gray-500 dark:text-zinc-400">
                {it.source === "dm" ? "DM" : "orgânico"}
              </span>
            )}
            {it.points > 0 && (
              <span className="shrink-0 rounded bg-emerald-100 dark:bg-emerald-900/40 px-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                +{it.points} pts
              </span>
            )}
            <span className="shrink-0 text-[10px] text-gray-400">{relTime(it.occurredAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

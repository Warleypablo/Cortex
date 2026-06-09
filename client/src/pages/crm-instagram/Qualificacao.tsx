import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mail, Search } from "lucide-react";
import { QUALIFICATION_TAGS, TAG_LABELS, BLOCKING_TAGS, type QualificationTag } from "@shared/crmInstagramTags";

type Row = {
  id: number;
  igUsername: string | null;
  displayName: string | null;
  stage: string;
  qualification: QualificationTag | null;
  commentCount: number;
  dmCount: number;
  lastInteractionAt: string | null;
  score: number;
};

function label(r: Row): string {
  return r.displayName || (r.igUsername ? `@${r.igUsername}` : "lead sem nome");
}

const STAGE_LABEL: Record<string, string> = {
  engajador: "Engajador",
  oportunidade: "Oportunidade",
  negocio: "Negócio",
};

export default function Qualificacao() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("");

  // scope=all: traz todos, inclusive os bloqueados (colaborador/desqualificado).
  const { data: rows, isLoading } = useQuery<Row[]>({
    queryKey: ["/api/crm-instagram/profiles", { scope: "all" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm-instagram/profiles?scope=all");
      return res.json();
    },
  });

  const tagM = useMutation({
    mutationFn: async ({ id, qualification }: { id: number; qualification: string | null }) => {
      const res = await apiRequest("POST", `/api/crm-instagram/profiles/${id}/qualification`, { qualification });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm-instagram/profiles"] });
    },
    onError: (e: any) => toast({ title: "Erro ao qualificar", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const filtered = (rows || []).filter((r) => {
    const matchQ = !q || label(r).toLowerCase().includes(q.toLowerCase()) || (r.igUsername || "").toLowerCase().includes(q.toLowerCase());
    const matchTag = !tagFilter || (tagFilter === "__none__" ? !r.qualification : r.qualification === tagFilter);
    return matchQ && matchTag;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou @handle" className="pl-8" />
        </div>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="h-9 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm text-gray-900 dark:text-white"
        >
          <option value="">Todas as tags</option>
          <option value="__none__">Sem tag</option>
          {QUALIFICATION_TAGS.map((t) => (
            <option key={t} value={t}>{TAG_LABELS[t]}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500 dark:text-zinc-400">{filtered.length} contatos</span>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
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
              return (
                <tr key={r.id} className={`border-t border-gray-100 dark:border-zinc-800 ${blocked ? "opacity-60" : ""}`}>
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
                  <td className="p-3">
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
    </div>
  );
}

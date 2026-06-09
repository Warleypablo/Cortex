import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MessageCircle, Mail, Lock, ExternalLink, CheckCircle2, Tag,
} from "lucide-react";
import { QUALIFICATION_TAGS, TAG_LABELS, type QualificationTag } from "@shared/crmInstagramTags";

type Profile = {
  id: number;
  igUsername: string | null;
  displayName: string | null;
  bio: string | null;
  followersCount: number | null;
  profilePictureUrl: string | null;
  lastMediaPermalink: string | null;
  stage: string;
  subcategory: string | null;
  qualification: QualificationTag | null;
  ownerUserId: string | null;
  ownerName: string | null;
  lockedBy: string | null;
  isLocked: boolean;
  bitrixDealId: number | null;
  ghlContactId: string | null;
  ghlLocationId: string | null;
  isExistingContact: boolean;
  lastInteractionAt: string | null;
  commentCount: number;
  dmCount: number;
  lastText: string | null;
  temperature: "hot" | "warm" | "cold";
  score: number;
};

// Rótulo humano: nome de exibição ou @handle. Identidade visual sem assumir handle.
function profileLabel(p: Profile): string {
  if (p.displayName) return p.displayName;
  if (p.igUsername) return `@${p.igUsername}`;
  return "lead sem nome";
}

// Iniciais do nome do SDR pro balãozinho do dono.
function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

// Cor do score (qualificação): verde quente → cinza frio.
function scoreColor(score: number): string {
  if (score >= 70) return "bg-emerald-600 text-white";
  if (score >= 40) return "bg-amber-500 text-white";
  return "bg-gray-300 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300";
}

const STAGES = [
  { key: "engajador", label: "Engajador" },
  { key: "oportunidade", label: "Oportunidade" },
  { key: "negocio", label: "Negócio" },
];

const TEMP_EMOJI: Record<string, string> = { hot: "🔥", warm: "🌡️", cold: "❄️" };

export default function Pipeline() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [bitrixTarget, setBitrixTarget] = useState<Profile | null>(null);

  const { data: profiles, isLoading } = useQuery<Profile[]>({
    queryKey: ["/api/crm-instagram/profiles"],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/crm-instagram/profiles"] });

  const act = (verb: string) =>
    useMutation({
      mutationFn: async ({ id, body }: { id: number; body?: any }) => {
        const res = await apiRequest("POST", `/api/crm-instagram/profiles/${id}/${verb}`, body || {});
        return res.json();
      },
      onSuccess: () => invalidate(),
      onError: (e: any) => toast({ title: "Ops", description: e.message, variant: "destructive" }),
    });

  const moveM = act("stage");
  const claimM = act("claim");
  const releaseM = act("release");
  const qualM = act("qualification");

  const move = (p: Profile, toStage: string) => {
    if (toStage === "negocio" && !p.bitrixDealId) { setBitrixTarget(p); return; }
    moveM.mutate({ id: p.id, body: { toStage } });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {STAGES.map((s) => <Skeleton key={s.key} className="h-96 w-full" />)}
      </div>
    );
  }

  const byStage = (stage: string) => (profiles || []).filter((p) => p.stage === stage);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STAGES.map((col) => {
          const items = byStage(col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = Number(e.dataTransfer.getData("text/plain"));
                const p = (profiles || []).find((x) => x.id === id);
                if (p && p.stage !== col.key) move(p, col.key);
              }}
              className="rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 p-3 min-h-[60vh]"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">{col.label}</h3>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="space-y-3">
                {items.map((p) => (
                  <ProfileCard
                    key={p.id}
                    p={p}
                    meId={user?.id}
                    onClaim={() => claimM.mutate({ id: p.id })}
                    onRelease={() => releaseM.mutate({ id: p.id })}
                    onMove={(to) => move(p, to)}
                    onQualify={(tag) => qualM.mutate({ id: p.id, body: { qualification: tag } })}
                    onBitrix={() => setBitrixTarget(p)}
                  />
                ))}
                {items.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-8">Vazio</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BitrixModal
        target={bitrixTarget}
        onClose={() => setBitrixTarget(null)}
        onCreated={() => { setBitrixTarget(null); invalidate(); }}
      />
    </>
  );
}

function ProfileCard({
  p, meId, onClaim, onRelease, onMove, onQualify, onBitrix,
}: {
  p: Profile;
  meId?: string;
  onClaim: () => void;
  onRelease: () => void;
  onMove: (toStage: string) => void;
  onQualify: (tag: string | null) => void;
  onBitrix: () => void;
}) {
  const lockedByOther = p.isLocked && p.lockedBy && p.lockedBy !== meId;
  const idx = STAGES.findIndex((s) => s.key === p.stage);

  return (
    <div
      draggable={!lockedByOther}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(p.id))}
      className="rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-3 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2">
        <Avatar className="h-9 w-9">
          {p.profilePictureUrl && <AvatarImage src={p.profilePictureUrl} alt={profileLabel(p)} />}
          <AvatarFallback>{profileLabel(p).replace(/^@/, "").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${scoreColor(p.score)}`}
              title="Lead score (qualificação)"
            >
              {p.score}
            </span>
            <span className="font-medium text-gray-900 dark:text-white truncate">{profileLabel(p)}</span>
            <span title={p.temperature}>{TEMP_EMOJI[p.temperature]}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-zinc-400">
            {p.followersCount != null ? `${p.followersCount.toLocaleString("pt-BR")} seg · ` : ""}
            {p.lastInteractionAt ? new Date(p.lastInteractionAt).toLocaleDateString("pt-BR") : ""}
          </div>
        </div>
      </div>

      {p.lastText && (
        <p className="mt-2 text-xs text-gray-600 dark:text-zinc-300 line-clamp-2">"{p.lastText}"</p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {p.dmCount > 0 && (
          <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />DM {p.dmCount}</Badge>
        )}
        {p.commentCount > 0 && (
          <Badge variant="secondary" className="gap-1"><MessageCircle className="h-3 w-3" />{p.commentCount}</Badge>
        )}
        {p.isExistingContact && (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
            <CheckCircle2 className="h-3 w-3" />Já é contato
          </Badge>
        )}
        {p.bitrixDealId && (
          <Badge className="bg-blue-600 hover:bg-blue-600 text-white">No Bitrix</Badge>
        )}
        {lockedByOther && (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-400">
            <Lock className="h-3 w-3" />em uso
          </Badge>
        )}
        {p.ownerUserId && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-indigo-700 dark:text-indigo-300"
            title={`Pego por ${p.ownerName || "SDR"}`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
              {initials(p.ownerName)}
            </span>
            {p.ownerUserId === meId ? "você" : (p.ownerName?.split(" ")[0] || "SDR")}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {p.ghlContactId && p.ghlLocationId ? (
          // Lead com conversa no GHL: SDR responde dentro do GHL (sem logar no IG).
          <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white" asChild>
            <a
              href={`https://app.gohighlevel.com/v2/location/${p.ghlLocationId}/conversations/conversations/${p.ghlContactId}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-3 w-3" />Responder no GHL
            </a>
          </Button>
        ) : p.igUsername ? (
          // Lead só de comentário: sem thread no GHL → abre o perfil no Instagram.
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
            <a href={`https://instagram.com/${p.igUsername}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3" />Abrir no Instagram
            </a>
          </Button>
        ) : null}
        {!p.ownerUserId ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs" title="Pegar e travar pra mim por 15min" onClick={onClaim}>Pegar</Button>
        ) : p.ownerUserId === meId ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600" title="Devolver pra fila" onClick={onRelease}>Soltar</Button>
        ) : null}
        {idx < STAGES.length - 1 && (
          <Button
            size="sm" variant="default" className="h-7 text-xs"
            disabled={!!lockedByOther}
            onClick={() => onMove(STAGES[idx + 1].key)}
          >
            {STAGES[idx + 1].key === "negocio" ? "Criar no Bitrix →" : `→ ${STAGES[idx + 1].label}`}
          </Button>
        )}
        {p.stage === "negocio" && !p.bitrixDealId && (
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={onBitrix}>Criar no Bitrix</Button>
        )}
        <QualifyMenu current={p.qualification} onQualify={onQualify} />
      </div>

      {p.qualification && (
        <div className="mt-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Tag className="h-3 w-3" />{TAG_LABELS[p.qualification]}
          </Badge>
        </div>
      )}
    </div>
  );
}

function QualifyMenu({ current, onQualify }: { current: QualificationTag | null; onQualify: (tag: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400" title="Qualificar / bloquear" onClick={() => setOpen((o) => !o)}>
        <Tag className="h-3 w-3" />
      </Button>
      {open && (
        <div className="absolute z-10 mt-1 right-0 w-48 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
          {QUALIFICATION_TAGS.map((t) => (
            <button
              key={t}
              className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 ${current === t ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-zinc-300"}`}
              onClick={() => { onQualify(t); setOpen(false); }}
            >
              {TAG_LABELS[t]}
              {(t === "colaborador" || t === "desqualificado") && <span className="text-gray-400"> · some do pipeline</span>}
            </button>
          ))}
          {current && (
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-gray-500 border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800"
              onClick={() => { onQualify(null); setOpen(false); }}
            >
              Remover tag
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BitrixModal({
  target, onClose, onCreated,
}: {
  target: Profile | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ nome: "", telefone: "", email: "" });

  const createM = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm-instagram/profiles/${target!.id}/bitrix`, form);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.alreadyExists ? "Já estava no Bitrix" : "Criado no Bitrix",
        description: data.alreadyExists
          ? `Deal #${data.dealId}`
          : data.assigned
            ? `Deal #${data.dealId} — atribuído a você`
            : `Deal #${data.dealId} — ⚠️ defina o responsável no Bitrix (seu e-mail não casou)`,
      });
      setForm({ nome: "", telefone: "", email: "" });
      onCreated();
    },
    onError: (e: any) => toast({ title: "Erro ao criar no Bitrix", description: e.message, variant: "destructive" }),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle>Criar no Bitrix — {target ? profileLabel(target) : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Origem e link do Instagram já vão preenchidos, e o deal é atribuído a você
            (Responsável + SDR). Complete o que souber — tudo opcional:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-600 dark:text-zinc-400">Nome</label>
              <Input value={form.nome} onChange={set("nome")} placeholder="Nome real do lead" />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-zinc-400">Telefone</label>
              <Input value={form.telefone} onChange={set("telefone")} placeholder="(11) 9..." />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-zinc-400">Email</label>
              <Input value={form.email} onChange={set("email")} placeholder="email@..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
            {createM.isPending ? "Criando..." : "Criar deal no Bitrix"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

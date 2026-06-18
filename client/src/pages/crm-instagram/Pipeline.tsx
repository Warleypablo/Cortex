import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MessageCircle, Mail, Lock, ExternalLink, CheckCircle2, Tag, StickyNote, History,
} from "lucide-react";
import { QUALIFICATION_TAGS, TAG_LABELS, BLOCKING_TAGS, type QualificationTag } from "@shared/crmInstagramTags";

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
  observacao: string | null;
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
  const obsM = act("observacao");

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
                    onObservacao={(txt) => obsM.mutate({ id: p.id, body: { observacao: txt } })}
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
  p, meId, onClaim, onRelease, onMove, onQualify, onObservacao, onBitrix,
}: {
  p: Profile;
  meId?: string;
  onClaim: () => void;
  onRelease: () => void;
  onMove: (toStage: string) => void;
  onQualify: (tag: string | null) => void;
  onObservacao: (txt: string) => void;
  onBitrix: () => void;
}) {
  const lockedByOther = p.isLocked && p.lockedBy && p.lockedBy !== meId;
  const idx = STAGES.findIndex((s) => s.key === p.stage);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div
      draggable={!lockedByOther}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(p.id))}
      className="rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-3 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2">
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
        <Button
          size="sm" variant="ghost"
          className={`h-7 text-xs gap-1 ${showHistory ? "text-gray-700 dark:text-zinc-300" : "text-gray-400"}`}
          title="Ver histórico de interações"
          onClick={() => setShowHistory((s) => !s)}
        >
          <History className="h-3 w-3" />Histórico
        </Button>
      </div>

      {showHistory && <HistoryPanel id={p.id} />}

      {p.observacao && (
        <p className="mt-2 flex gap-1 text-xs text-gray-500 dark:text-zinc-400 italic">
          <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{p.observacao}</span>
        </p>
      )}

      {/* Linha inferior fixa: tag + observação (texto + ícone) */}
      <div className="mt-2 flex items-center gap-1 border-t border-gray-100 dark:border-zinc-800 pt-2">
        <QualifyMenu current={p.qualification} onQualify={onQualify} />
        <NoteButton current={p.observacao} onSave={onObservacao} />
      </div>
    </div>
  );
}

type Interaction = {
  id: number;
  type: string;
  igMediaId: string | null;
  text: string | null;
  source: string | null;
  occurredAt: string;
  postCaption: string | null;
  points: number;
};

// Tempo relativo curto pro histórico: "Hoje", "Ontem", "N dias".
function relTime(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return "Hoje";
  if (days < 2) return "Ontem";
  return `${Math.floor(days)} dias`;
}

// Histórico de interações do lead (lazy: só busca quando expandido).
// Hoje cobre comentário + DM (o que a API oficial entrega); curtida/save/seguir
// entram quando a captura por scraper existir.
function HistoryPanel({ id }: { id: number }) {
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
        const Icon = isDm ? Mail : MessageCircle;
        const label = isDm
          ? "Mandou DM"
          : it.postCaption
            ? `Comentou em "${it.postCaption.slice(0, 30)}${it.postCaption.length > 30 ? "…" : ""}"`
            : "Comentou";
        return (
          <div key={it.id} className="flex items-center gap-2 text-xs">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${isDm ? "text-blue-500" : "text-gray-400"}`} />
            <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-zinc-300">{label}</span>
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

function NoteButton({ current, onSave }: { current: string | null; onSave: (txt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(current || "");
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setText(current || ""); }}>
      <PopoverTrigger asChild>
        <Button
          size="sm" variant="ghost"
          className={`h-7 text-xs gap-1 ${current ? "text-amber-500" : "text-gray-400"}`}
          title={current ? "Editar observação" : "Adicionar observação"}
        >
          <StickyNote className="h-3 w-3" />{current ? "Observação" : "Adicionar observação"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-white dark:bg-zinc-900" align="end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Observação livre do SDR..."
          className="text-xs min-h-[80px]"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => { onSave(text); setOpen(false); }}>Salvar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function QualifyMenu({ current, onQualify }: { current: QualificationTag | null; onQualify: (tag: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        size="sm" variant="ghost"
        className={`h-7 text-xs gap-1 ${current ? "text-gray-700 dark:text-zinc-300" : "text-gray-400"}`}
        title="Adicionar tag"
        onClick={() => setOpen((o) => !o)}
      >
        <Tag className="h-3 w-3" />{current ? TAG_LABELS[current] : "Adicionar tag"}
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
              {BLOCKING_TAGS.includes(t) && <span className="text-gray-400"> · some do pipeline</span>}
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
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", observacao: "" });

  // Pré-preenche a observação já salva no lead ao abrir o modal.
  useEffect(() => {
    if (target) setForm((f) => ({ ...f, observacao: target.observacao || "" }));
  }, [target]);

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
      setForm({ nome: "", telefone: "", email: "", observacao: "" });
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
              <label className="text-xs text-gray-600 dark:text-zinc-400">Nome <span className="text-gray-400">(opcional)</span></label>
              <Input value={form.nome} onChange={set("nome")} placeholder="Nome real do lead" />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-zinc-400">Telefone <span className="text-gray-400">(opcional)</span></label>
              <Input value={form.telefone} onChange={set("telefone")} placeholder="(11) 9..." />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-zinc-400">Email <span className="text-gray-400">(opcional)</span></label>
              <Input value={form.email} onChange={set("email")} placeholder="email@..." />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 dark:text-zinc-400">Observação <span className="text-gray-400">(opcional · vai pros comentários do Bitrix)</span></label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                placeholder="Qualquer contexto do lead que valha registrar..."
                className="min-h-[70px]"
              />
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

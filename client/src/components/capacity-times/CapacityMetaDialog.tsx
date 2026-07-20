import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CapacityMeta, ResponsavelOption } from "./CapacityMetasConfig";

// Labels amigáveis para as categorias comerciais; operacionais usam o próprio nome.
export const CATEGORIA_LABELS: Record<string, string> = {
  vendedor: "Selva (vendedor)",
  account: "Accounts (account)",
  gestor: "Squadra (gestor)",
  Black: "Black (Accounts)",
  CXCS: "CXCS (Customer Success)",
};

const CATEGORIAS_BASE = ["Black", "Squadra", "CXCS", "Pulse", "Olimpo"];
const NOVA = "__nova__";

interface FormState {
  nome: string;
  categoria: string;
  match_responsavel: string;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  cap_clientes: number | null;
  ordem: number;
  ativo: boolean;
}

const EMPTY: FormState = {
  nome: "", categoria: "", match_responsavel: "",
  cap_recorrente: null, cap_mrr: null, cap_pontual: null, cap_contas: null, cap_clientes: null,
  ordem: 0, ativo: true,
};

function numField(v: number | null, set: (n: number | null) => void, label: string, testId: string) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        value={v === null ? "" : v}
        onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="—"
        data-testid={testId}
      />
    </div>
  );
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meta: CapacityMeta | null;
  existingCategorias: string[];
  onSaved: () => void;
}

export function CapacityMetaDialog({ open, onOpenChange, meta, existingCategorias, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [novaCategoria, setNovaCategoria] = useState("");
  const isNovaCategoria = form.categoria === NOVA;

  const { data: responsaveis } = useQuery<ResponsavelOption[]>({
    queryKey: ["/api/capacity-metas/responsaveis"],
    enabled: open,
  });

  // Sincroniza o form quando abre (modo edição preenche, modo novo zera).
  useEffect(() => {
    if (!open) return;
    if (meta) {
      setForm({
        nome: meta.nome, categoria: meta.categoria, match_responsavel: meta.match_responsavel,
        cap_recorrente: meta.cap_recorrente, cap_mrr: meta.cap_mrr,
        cap_pontual: meta.cap_pontual, cap_contas: meta.cap_contas,
        cap_clientes: meta.cap_clientes,
        ordem: meta.ordem, ativo: meta.ativo,
      });
    } else {
      setForm(EMPTY);
    }
    setNovaCategoria("");
  }, [open, meta]);

  const categoriaOptions = Array.from(new Set([...CATEGORIAS_BASE, ...existingCategorias]));
  const respOptions: ResponsavelOption[] = responsaveis ?? [];
  // Garante que o vínculo atual (em edição) apareça mesmo se não estiver na lista de ativos.
  const hasCurrent = form.match_responsavel && !respOptions.some((r) => r.responsavel === form.match_responsavel);
  const selectedResp = respOptions.find((r) => r.responsavel === form.match_responsavel);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const categoria = isNovaCategoria ? novaCategoria.trim() : form.categoria;
      const payload = { ...form, categoria };
      if (meta) {
        await apiRequest("PUT", `/api/capacity-metas/${meta.id}`, payload);
      } else {
        await apiRequest("POST", "/api/capacity-metas", payload);
      }
    },
    onSuccess: () => {
      toast({ title: meta ? "Operador atualizado" : "Operador criado" });
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const categoriaValida = isNovaCategoria ? novaCategoria.trim().length > 0 : form.categoria.length > 0;
  const canSave = form.nome.trim() && form.match_responsavel.trim() && categoriaValida && !saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meta ? "Editar operador" : "Adicionar operador"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome de exibição" data-testid="meta-nome" />
          </div>

          <div className="space-y-1">
            <Label>Categoria / Time</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
              <SelectTrigger data-testid="meta-categoria"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categoriaOptions.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c] ?? c}</SelectItem>
                ))}
                <SelectItem value={NOVA}>➕ Nova squad…</SelectItem>
              </SelectContent>
            </Select>
            {isNovaCategoria && (
              <Input className="mt-2" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)}
                placeholder="Nome da nova squad" data-testid="meta-nova-categoria" autoFocus />
            )}
          </div>

          <div className="space-y-1">
            <Label>Vínculo (responsável em contratos)</Label>
            <Select value={form.match_responsavel}
              onValueChange={(v) => setForm({ ...form, match_responsavel: v })}>
              <SelectTrigger data-testid="meta-vinculo"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
              <SelectContent>
                {hasCurrent && (
                  <SelectItem value={form.match_responsavel}>{form.match_responsavel} (atual)</SelectItem>
                )}
                {respOptions.map((r) => (
                  <SelectItem key={r.responsavel} value={r.responsavel}>
                    {r.responsavel} — {r.contratos} contratos · {brl.format(r.mrr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedResp && (
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {selectedResp.contratos} contratos · {brl.format(selectedResp.mrr)} de MRR
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Cap. Faturamento (R$) grava em cap_mrr; Cap. Contas em cap_contas.
                cap_recorrente/cap_pontual/ordem existentes são preservados no payload. */}
            {numField(form.cap_mrr, (n) => setForm({ ...form, cap_mrr: n }), "Cap. Faturamento ($)", "meta-cap-fat")}
            {numField(form.cap_contas, (n) => setForm({ ...form, cap_contas: n }), "Cap. Contratos", "meta-cap-contas")}
            {numField(form.cap_clientes, (n) => setForm({ ...form, cap_clientes: n }), "Cap. Clientes", "meta-cap-clientes")}
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(c) => setForm({ ...form, ativo: c })}
              data-testid="meta-ativo" />
            <Label>Ativo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave} data-testid="meta-salvar">
            {saveMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

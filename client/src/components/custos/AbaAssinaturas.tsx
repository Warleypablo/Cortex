import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { Pencil, Trash2, Plus } from "lucide-react";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";

interface Usuario { id: number; nome: string; }
interface Assinatura {
  id: number; fornecedor: string; plano: string; valor: number; moeda: string; ciclo: string;
  dataAssinatura: string; dataCancelamento: string | null; status: string;
  responsavelPessoaId: number | null; projeto: string; observacoes: string | null; usuarios: Usuario[];
}

const VAZIA = {
  fornecedor: "Anthropic", plano: "", valor: 0, moeda: "USD", ciclo: "mensal",
  dataAssinatura: new Date().toISOString().slice(0, 10), dataCancelamento: "", status: "ativo",
  responsavelPessoaId: "", projeto: "Geral", observacoes: "", usuarios: [] as number[],
};

export function AbaAssinaturas({ moeda }: { moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assinatura | null>(null);
  const [form, setForm] = useState({ ...VAZIA });

  const { data: assinaturas = [], isLoading } = useQuery<Assinatura[]>({ queryKey: ["/api/custos/assinaturas"] });
  const { data: pessoas = [] } = useQuery<Usuario[]>({ queryKey: ["/api/custos/pessoas"] });
  const pessoaOptions = pessoas.map((p) => ({ value: String(p.id), label: p.nome }));

  useEffect(() => {
    if (editing) {
      setForm({
        fornecedor: editing.fornecedor, plano: editing.plano, valor: editing.valor, moeda: editing.moeda,
        ciclo: editing.ciclo, dataAssinatura: editing.dataAssinatura?.slice(0, 10),
        dataCancelamento: editing.dataCancelamento?.slice(0, 10) || "", status: editing.status,
        responsavelPessoaId: editing.responsavelPessoaId ? String(editing.responsavelPessoaId) : "",
        projeto: editing.projeto, observacoes: editing.observacoes || "",
        usuarios: (editing.usuarios || []).map((u) => u.id),
      });
    } else {
      setForm({ ...VAZIA });
    }
  }, [editing, open]);

  function payload() {
    return {
      fornecedor: form.fornecedor, plano: form.plano, valor: Number(form.valor), moeda: form.moeda,
      ciclo: form.ciclo, dataAssinatura: form.dataAssinatura, dataCancelamento: form.status === "ativo" ? null : (form.dataCancelamento || null),
      status: form.status, responsavelPessoaId: form.responsavelPessoaId ? Number(form.responsavelPessoaId) : null,
      projeto: form.projeto, observacoes: form.observacoes || null, usuarios: form.usuarios,
    };
  }

  const createMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/assinaturas", payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custos/assinaturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Assinatura criada" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/custos/assinaturas/${editing!.id}`, payload());
      await apiRequest("PUT", `/api/custos/assinaturas/${editing!.id}/usuarios`, { usuarios: form.usuarios });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custos/assinaturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Assinatura atualizada" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/custos/assinaturas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custos/assinaturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Assinatura removida" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const fmt = (v: number, m: string) => (m === "BRL" ? formatCurrencyNoDecimals(v) : formatCurrencyUSD(v));
  const saving = createMut.isPending || updateMut.isPending;

  function handleSave() {
    if (!form.fornecedor.trim() || !form.plano.trim()) {
      toast({ title: "Preencha fornecedor e plano", variant: "destructive" });
      return;
    }
    editing ? updateMut.mutate() : createMut.mutate();
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-assinatura">
          <Plus className="h-4 w-4 mr-1" /> Nova assinatura
        </Button>
      </div>

      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead><TableHead>Plano</TableHead><TableHead>Valor</TableHead>
                <TableHead>Ciclo</TableHead><TableHead>Projeto</TableHead><TableHead>Usuários</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assinaturas.map((a) => (
                <TableRow key={a.id} data-testid={`row-assinatura-${a.id}`}>
                  <TableCell className="font-medium">{a.fornecedor}</TableCell>
                  <TableCell>{a.plano}</TableCell>
                  <TableCell>{fmt(a.valor, a.moeda)}<span className="text-xs text-gray-400"> {a.moeda}</span></TableCell>
                  <TableCell>{a.ciclo}</TableCell>
                  <TableCell><Badge variant="secondary">{a.projeto}</Badge></TableCell>
                  <TableCell className="text-xs text-gray-500 dark:text-zinc-400">{(a.usuarios || []).map((u) => u.nome).join(", ") || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "ativo" ? "default" : "outline"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }} data-testid={`button-edit-assinatura-${a.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${a.plano}"?`)) deleteMut.mutate(a.id); }} data-testid={`button-delete-assinatura-${a.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {assinaturas.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhuma assinatura cadastrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar assinatura" : "Nova assinatura"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} data-testid="input-fornecedor" /></div>
            <div><Label>Plano</Label><Input value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value })} data-testid="input-plano" /></div>
            <div><Label>Valor</Label><Input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} data-testid="input-valor" /></div>
            <div>
              <Label>Moeda</Label>
              <Select value={form.moeda} onValueChange={(v) => setForm({ ...form, moeda: v })}>
                <SelectTrigger data-testid="select-moeda"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BRL">BRL</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ciclo</Label>
              <Select value={form.ciclo} onValueChange={(v) => setForm({ ...form, ciclo: v })}>
                <SelectTrigger data-testid="select-ciclo"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="anual">Anual</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.projeto} onValueChange={(v) => setForm({ ...form, projeto: v })}>
                <SelectTrigger data-testid="select-projeto"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Geral">Geral</SelectItem><SelectItem value="Synapse">Synapse</SelectItem><SelectItem value="Cortex">Cortex</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Data de assinatura</Label><Input type="date" value={form.dataAssinatura} onChange={(e) => setForm({ ...form, dataAssinatura: e.target.value })} data-testid="input-data-assinatura" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
              </Select>
            </div>
            {form.status === "inativo" && (
              <div><Label>Data de cancelamento</Label><Input type="date" value={form.dataCancelamento} onChange={(e) => setForm({ ...form, dataCancelamento: e.target.value })} data-testid="input-data-cancelamento" /></div>
            )}
            <div>
              <Label>Responsável</Label>
              <Select value={form.responsavelPessoaId} onValueChange={(v) => setForm({ ...form, responsavelPessoaId: v })}>
                <SelectTrigger data-testid="select-responsavel"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{pessoas.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Quem está usando</Label>
              <MultiSelect
                options={pessoaOptions}
                selected={form.usuarios.map(String)}
                onChange={(vals) => setForm({ ...form, usuarios: vals.map(Number) })}
                placeholder="Selecione as pessoas"
              />
            </div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} data-testid="input-observacoes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-assinatura">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { Pencil, Trash2, Plus } from "lucide-react";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";

interface Item {
  id: number; descricao: string; fornecedor: string | null; categoria: string | null; valor: number;
  moeda: string; ciclo: string; dataInicio: string; dataFim: string | null; status: string;
  projeto: string; observacoes: string | null;
}

const VAZIO = {
  descricao: "", fornecedor: "", categoria: "SaaS", valor: 0, moeda: "USD", ciclo: "mensal",
  dataInicio: new Date().toISOString().slice(0, 10), dataFim: "", status: "ativo", projeto: "Synapse", observacoes: "",
};

export function AbaItens({ moeda }: { moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ ...VAZIO });

  const { data: itens = [], isLoading } = useQuery<Item[]>({ queryKey: ["/api/custos/itens"] });

  useEffect(() => {
    if (editing) {
      setForm({
        descricao: editing.descricao, fornecedor: editing.fornecedor || "", categoria: editing.categoria || "SaaS",
        valor: editing.valor, moeda: editing.moeda, ciclo: editing.ciclo, dataInicio: editing.dataInicio?.slice(0, 10),
        dataFim: editing.dataFim?.slice(0, 10) || "", status: editing.status, projeto: editing.projeto, observacoes: editing.observacoes || "",
      });
    } else setForm({ ...VAZIO });
  }, [editing, open]);

  function payload() {
    return {
      descricao: form.descricao, fornecedor: form.fornecedor || null, categoria: form.categoria || null,
      valor: Number(form.valor), moeda: form.moeda, ciclo: form.ciclo, dataInicio: form.dataInicio,
      dataFim: form.dataFim || null, status: form.status, projeto: form.projeto, observacoes: form.observacoes || null,
    };
  }

  const inval = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/custos/itens"] });
    queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
  };
  const createMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/itens", payload()),
    onSuccess: () => { inval(); toast({ title: "Item criado" }); setOpen(false); },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: async () => apiRequest("PUT", `/api/custos/itens/${editing!.id}`, payload()),
    onSuccess: () => { inval(); toast({ title: "Item atualizado" }); setOpen(false); },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/custos/itens/${id}`),
    onSuccess: () => { inval(); toast({ title: "Item removido" }); },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const fmt = (v: number, m: string) => (m === "BRL" ? formatCurrencyNoDecimals(v) : formatCurrencyUSD(v));
  const saving = createMut.isPending || updateMut.isPending;

  function handleSave() {
    if (!form.descricao.trim()) { toast({ title: "Preencha a descrição", variant: "destructive" }); return; }
    editing ? updateMut.mutate() : createMut.mutate();
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-item">
          <Plus className="h-4 w-4 mr-1" /> Novo item
        </Button>
      </div>
      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Valor</TableHead>
                <TableHead>Ciclo</TableHead><TableHead>Projeto</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((it) => (
                <TableRow key={it.id} data-testid={`row-item-${it.id}`}>
                  <TableCell className="font-medium">{it.descricao}</TableCell>
                  <TableCell>{it.categoria || "—"}</TableCell>
                  <TableCell>{fmt(it.valor, it.moeda)}<span className="text-xs text-gray-400"> {it.moeda}</span></TableCell>
                  <TableCell>{it.ciclo}</TableCell>
                  <TableCell><Badge variant="secondary">{it.projeto}</Badge></TableCell>
                  <TableCell><Badge variant={it.status === "ativo" ? "default" : "outline"}>{it.status}</Badge></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }} data-testid={`button-edit-item-${it.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${it.descricao}"?`)) deleteMut.mutate(it.id); }} data-testid={`button-delete-item-${it.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {itens.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhum item cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} data-testid="input-item-descricao" /></div>
            <div><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} data-testid="input-item-fornecedor" /></div>
            <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} data-testid="input-item-categoria" /></div>
            <div><Label>Valor</Label><Input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} data-testid="input-item-valor" /></div>
            <div>
              <Label>Moeda</Label>
              <Select value={form.moeda} onValueChange={(v) => setForm({ ...form, moeda: v })}>
                <SelectTrigger data-testid="select-item-moeda"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BRL">BRL</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ciclo</Label>
              <Select value={form.ciclo} onValueChange={(v) => setForm({ ...form, ciclo: v })}>
                <SelectTrigger data-testid="select-item-ciclo"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="anual">Anual</SelectItem><SelectItem value="pontual">Pontual</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.projeto} onValueChange={(v) => setForm({ ...form, projeto: v })}>
                <SelectTrigger data-testid="select-item-projeto"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Geral">Geral</SelectItem><SelectItem value="Synapse">Synapse</SelectItem><SelectItem value="Cortex">Cortex</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Início</Label><Input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} data-testid="input-item-inicio" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-item-status"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
              </Select>
            </div>
            {form.status === "inativo" && (
              <div><Label>Fim</Label><Input type="date" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} data-testid="input-item-fim" /></div>
            )}
            <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} data-testid="input-item-observacoes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-item">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

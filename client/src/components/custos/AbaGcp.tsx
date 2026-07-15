import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";

interface LinhaGcp { id: number; data: string; gcpProjectId: string; projetoInterno: string; servico: string; custo: number; moeda: string; }

export function AbaGcp({ mes }: { mes: string; moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ servico: "", gcpProjectId: "", custo: 0, moeda: "USD", projetoInterno: "Geral" });

  const { data: linhas = [], isLoading } = useQuery<LinhaGcp[]>({ queryKey: ["/api/custos/gcp", { mes }] });

  const inval = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/custos/gcp"] });
    queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
    queryClient.invalidateQueries({ queryKey: ["/api/custos/consolidado"] });
  };
  const createMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/gcp", { ...form, custo: Number(form.custo), mes }),
    onSuccess: () => { inval(); toast({ title: "Lançamento GCP adicionado" }); setOpen(false); setForm({ servico: "", gcpProjectId: "", custo: 0, moeda: "USD", projetoInterno: "Geral" }); },
    onError: (e: any) => toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/custos/gcp/${id}`),
    onSuccess: () => { inval(); toast({ title: "Lançamento removido" }); },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const fmt = (v: number, m: string) => (m === "USD" ? formatCurrencyUSD(v) : formatCurrencyNoDecimals(v));

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} data-testid="button-add-gcp"><Plus className="h-4 w-4 mr-1" /> Adicionar custo GCP</Button>
      </div>
      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Projeto GCP</TableHead><TableHead>Interno</TableHead><TableHead>Serviço</TableHead><TableHead className="text-right">Custo</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.id} data-testid={`row-gcp-${l.id}`}>
                  <TableCell className="font-mono text-xs">{l.gcpProjectId}</TableCell>
                  <TableCell><Badge variant={l.projetoInterno === "Synapse" ? "default" : "secondary"}>{l.projetoInterno}</Badge></TableCell>
                  <TableCell>{l.servico}</TableCell>
                  <TableCell className="text-right">{fmt(l.custo, l.moeda)}<span className="text-xs text-gray-400"> {l.moeda}</span></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${l.servico}"?`)) deleteMut.mutate(l.id); }} data-testid={`button-delete-gcp-${l.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500 dark:text-zinc-400 py-8">Sem custos de GCP no mês. Clique em "Adicionar custo GCP" para lançar manualmente.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Adicionar custo GCP — {mes}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Serviço / descrição</Label><Input value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })} placeholder="Ex: Cloud Run, Cloud SQL, Total GCP" data-testid="input-gcp-servico" /></div>
            <div><Label>Projeto GCP (opcional)</Label><Input value={form.gcpProjectId} onChange={(e) => setForm({ ...form, gcpProjectId: e.target.value })} placeholder="(manual)" data-testid="input-gcp-projeto" /></div>
            <div><Label>Valor</Label><Input type="number" value={form.custo} onChange={(e) => setForm({ ...form, custo: Number(e.target.value) })} data-testid="input-gcp-custo" /></div>
            <div>
              <Label>Moeda</Label>
              <Select value={form.moeda} onValueChange={(v) => setForm({ ...form, moeda: v })}>
                <SelectTrigger data-testid="select-gcp-moeda"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BRL">BRL</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto interno</Label>
              <Select value={form.projetoInterno} onValueChange={(v) => setForm({ ...form, projetoInterno: v })}>
                <SelectTrigger data-testid="select-gcp-interno"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Geral">Geral</SelectItem><SelectItem value="Synapse">Synapse</SelectItem><SelectItem value="Cortex">Cortex</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!form.servico.trim()) { toast({ title: "Preencha o serviço", variant: "destructive" }); return; } createMut.mutate(); }} disabled={createMut.isPending} data-testid="button-save-gcp">
              {createMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

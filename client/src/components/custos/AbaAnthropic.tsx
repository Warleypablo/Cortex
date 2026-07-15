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
import { formatCurrencyUSD } from "@/lib/utils";

interface LinhaAnthropic { id: number; data: string; workspace: string; projetoInterno: string; custoUsd: number; }

export function AbaAnthropic({ mes }: { mes: string; moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ workspace: "", custoUsd: 0, projetoInterno: "Geral" });

  const { data: linhas = [], isLoading } = useQuery<LinhaAnthropic[]>({ queryKey: ["/api/custos/anthropic", { mes }] });

  const inval = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/custos/anthropic"] });
    queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
    queryClient.invalidateQueries({ queryKey: ["/api/custos/consolidado"] });
  };
  const createMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/anthropic", { ...form, custoUsd: Number(form.custoUsd), mes }),
    onSuccess: () => { inval(); toast({ title: "Lançamento da API adicionado" }); setOpen(false); setForm({ workspace: "", custoUsd: 0, projetoInterno: "Geral" }); },
    onError: (e: any) => toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/custos/anthropic/${id}`),
    onSuccess: () => { inval(); toast({ title: "Lançamento removido" }); },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} data-testid="button-add-anthropic"><Plus className="h-4 w-4 mr-1" /> Adicionar custo da API</Button>
      </div>
      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Workspace</TableHead><TableHead>Interno</TableHead><TableHead className="text-right">Custo (USD)</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.id} data-testid={`row-anthropic-${l.id}`}>
                  <TableCell className="font-mono text-xs">{l.workspace || "—"}</TableCell>
                  <TableCell><Badge variant={l.projetoInterno === "Synapse" ? "default" : "secondary"}>{l.projetoInterno}</Badge></TableCell>
                  <TableCell className="text-right">{formatCurrencyUSD(l.custoUsd)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover lançamento de ${l.workspace || "API"}?`)) deleteMut.mutate(l.id); }} data-testid={`button-delete-anthropic-${l.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-500 dark:text-zinc-400 py-8">Sem custos da API no mês. Clique em "Adicionar custo da API" para lançar manualmente.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Adicionar custo da API Anthropic — {mes}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Workspace / descrição (opcional)</Label><Input value={form.workspace} onChange={(e) => setForm({ ...form, workspace: e.target.value })} placeholder="Ex: produção, dev, (manual)" data-testid="input-anthropic-workspace" /></div>
            <div><Label>Valor (USD)</Label><Input type="number" value={form.custoUsd} onChange={(e) => setForm({ ...form, custoUsd: Number(e.target.value) })} data-testid="input-anthropic-custo" /></div>
            <div>
              <Label>Projeto interno</Label>
              <Select value={form.projetoInterno} onValueChange={(v) => setForm({ ...form, projetoInterno: v })}>
                <SelectTrigger data-testid="select-anthropic-interno"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Geral">Geral</SelectItem><SelectItem value="Synapse">Synapse</SelectItem><SelectItem value="Cortex">Cortex</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} data-testid="button-save-anthropic">
              {createMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

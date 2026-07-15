import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";

interface LinhaGcp { gcpProjectId: string; projetoInterno: string; servico: string; custo: number; moeda: string; }

export function AbaGcp({ mes }: { mes: string; moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const { data: linhas = [], isLoading } = useQuery<LinhaGcp[]>({ queryKey: ["/api/custos/gcp", { mes }] });

  const syncMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/gcp/sync", {}),
    onSuccess: async (res) => {
      const j = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/custos/gcp"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Sync GCP concluído", description: `${j.linhas ?? 0} linhas desde ${j.desde ?? ""}` });
    },
    onError: (e: any) => toast({ title: "Erro no sync GCP", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending} data-testid="button-sync-gcp">
          <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sincronizar agora
        </Button>
      </div>
      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Projeto GCP</TableHead><TableHead>Interno</TableHead><TableHead>Serviço</TableHead><TableHead className="text-right">Custo</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, i) => (
                <TableRow key={i} data-testid={`row-gcp-${i}`}>
                  <TableCell className="font-mono text-xs">{l.gcpProjectId}</TableCell>
                  <TableCell><Badge variant={l.projetoInterno === "Synapse" ? "default" : "secondary"}>{l.projetoInterno}</Badge></TableCell>
                  <TableCell>{l.servico}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(l.custo)}<span className="text-xs text-gray-400"> {l.moeda}</span></TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-500 dark:text-zinc-400 py-8">Sem dados de GCP no mês. Configure o BigQuery export e clique em sincronizar.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

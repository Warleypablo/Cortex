import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { formatCurrencyUSD } from "@/lib/utils";

interface LinhaAnthropic { workspace: string; projetoInterno: string; custoUsd: number; tokensInput: number; tokensOutput: number; }

export function AbaAnthropic({ mes }: { mes: string; moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const { data: linhas = [], isLoading } = useQuery<LinhaAnthropic[]>({ queryKey: ["/api/custos/anthropic", { mes }] });

  const syncMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/anthropic/sync", {}),
    onSuccess: async (res) => {
      const j = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/custos/anthropic"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Sync Anthropic concluído", description: `${j.dias ?? 0} dias desde ${j.desde ?? ""}` });
    },
    onError: (e: any) => toast({ title: "Erro no sync Anthropic", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending} data-testid="button-sync-anthropic">
          <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sincronizar agora
        </Button>
      </div>
      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Workspace</TableHead><TableHead>Interno</TableHead><TableHead className="text-right">Custo (USD)</TableHead><TableHead className="text-right">Tokens in/out</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, i) => (
                <TableRow key={i} data-testid={`row-anthropic-${i}`}>
                  <TableCell className="font-mono text-xs">{l.workspace || "—"}</TableCell>
                  <TableCell><Badge variant={l.projetoInterno === "Synapse" ? "default" : "secondary"}>{l.projetoInterno}</Badge></TableCell>
                  <TableCell className="text-right">{formatCurrencyUSD(l.custoUsd)}</TableCell>
                  <TableCell className="text-right text-xs text-gray-500 dark:text-zinc-400">{l.tokensInput.toLocaleString()} / {l.tokensOutput.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-500 dark:text-zinc-400 py-8">Sem dados da API no mês. Configure a ANTHROPIC_ADMIN_KEY e clique em sincronizar.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

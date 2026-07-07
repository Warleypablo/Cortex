import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrencyNoDecimals, formatPercent } from "@/lib/utils";
import { KpiCard } from "./KpiCard";
import {
  useChurnDetalhamento,
  useChurnProdutoMotivo,
  useChurnTaxaMensal,
  useChurnPorResponsavel,
  useChurnPontorrente,
} from "./hooks";

function ErroCard({ mensagem }: { mensagem: string }) {
  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
      <CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300">
        <AlertTriangle className="h-4 w-4" /> {mensagem}
      </CardContent>
    </Card>
  );
}

/** Card com título fixo que troca o conteúdo por skeleton/erro sem desmontar as seções vizinhas. */
function BlocoTabela({ titulo, isLoading, isError, children }: { titulo: string; isLoading: boolean; isError: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{titulo}</h3>
        {isError ? (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" /> Falha ao carregar.</div>
        ) : isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : children}
      </CardContent>
    </Card>
  );
}

function formatMesCurto(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${m}/${ano.slice(2)}`;
}

function ChurnRecorrente({ mes }: { mes: string }) {
  const detalhamento = useChurnDetalhamento(mes);
  const produtoMotivo = useChurnProdutoMotivo(mes);
  const taxaMensal = useChurnTaxaMensal(mes);
  const porResponsavel = useChurnPorResponsavel(mes);

  if (detalhamento.isError) {
    return <ErroCard mensagem="Falha ao carregar churn recorrente. Tente recarregar." />;
  }
  if (detalhamento.isLoading || !detalhamento.data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const m = detalhamento.data.metricas;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard mes={mes} temporalidade="mes" titulo="Churn R$" valor={formatCurrencyNoDecimals(m.mrr_perdido)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Churn %" valor={formatPercent(m.churn_percentual)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Contratos churned" valor={String(m.total_churned)} />
      </div>

      <BlocoTabela titulo="Taxa de churn — 12 meses" isLoading={taxaMensal.isLoading} isError={taxaMensal.isError}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={taxaMensal.data?.rows ?? []}>
            <XAxis dataKey="mes" tickFormatter={formatMesCurto} tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <Tooltip
              formatter={(v: number) => formatPercent(Number(v))}
              labelFormatter={(l: string) => formatMesCurto(l)}
              contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }}
            />
            <Line dataKey="taxa" name="Churn %" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </BlocoTabela>

      {/* Fonte própria (vw_churn_produto_motivo_mensal, bucket por ultimo_dia_operacao) — NÃO
         reconcilia 1:1 com o Churn R$ acima (vw_cup_churn_ajustado, por data_solicitacao_encerramento).
         Conferido em jun/26: 60 cancelamentos/R$200k aqui vs 79/R$186,7k no card. Por isso, sem
         drill nesta tabela (lição Task 4: só dar drill quando os registros batem com o número clicado). */}
      <BlocoTabela titulo="Por produto + motivo" isLoading={produtoMotivo.isLoading} isError={produtoMotivo.isError}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Cancelamentos</TableHead>
                <TableHead className="text-right">MRR perdido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(produtoMotivo.data?.celulas ?? []).map((c, i) => (
                <TableRow key={i}>
                  <TableCell>{c.produto}</TableCell>
                  <TableCell>{c.motivo_cancelamento}</TableCell>
                  <TableCell className="text-right">{c.cancelamentos}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(c.mrr_perdido)}</TableCell>
                </TableRow>
              ))}
              {(produtoMotivo.data?.celulas?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-gray-400 dark:text-zinc-500">Sem cancelamentos no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </BlocoTabela>

      <BlocoTabela titulo="Por operador" isLoading={porResponsavel.isLoading} isError={porResponsavel.isError}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Contratos</TableHead>
                <TableHead className="text-right">Valor churn</TableHead>
                <TableHead className="text-right">Churn %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(porResponsavel.data ?? []).map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.responsavel}</TableCell>
                  <TableCell className="text-right">{r.quantidadeContratos}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(r.valorTotal)}</TableCell>
                  <TableCell className="text-right">{formatPercent(r.percentualChurn)}</TableCell>
                </TableRow>
              ))}
              {(porResponsavel.data?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-gray-400 dark:text-zinc-500">Sem churn no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </BlocoTabela>

      <BlocoTabela titulo="Por squad" isLoading={false} isError={false}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Squad</TableHead>
                <TableHead className="text-right">MRR ativo</TableHead>
                <TableHead className="text-right">MRR perdido</TableHead>
                <TableHead className="text-right">Churn %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.churn_por_squad.map((s, i) => (
                <TableRow key={i}>
                  <TableCell>{s.squad}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(s.mrr_ativo)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(s.mrr_perdido)}</TableCell>
                  <TableCell className="text-right">{formatPercent(s.percentual)}</TableCell>
                </TableRow>
              ))}
              {m.churn_por_squad.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-gray-400 dark:text-zinc-500">Sem churn no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </BlocoTabela>
    </div>
  );
}

function ChurnPontual({ mes }: { mes: string }) {
  const pontorrente = useChurnPontorrente(mes);

  if (pontorrente.isError) {
    return <ErroCard mensagem="Falha ao carregar churn pontual. Tente recarregar." />;
  }
  if (pontorrente.isLoading || !pontorrente.data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const { overview, detalhamento } = pontorrente.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {/* Filtro é por dataInicioPrimeira (mês em que a jornada começou), não pelo mês do
           cancelamento — por isso o "sub" deixa isso explícito (fidelidade ao dado, não bug). */}
        <KpiCard mes={mes} temporalidade="mes" titulo="Contratos cancelados" valor={String(overview.churnConfirmado)} sub={`de ${overview.jornadas} jornadas iniciadas no mês`} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Valor pontual perdido" valor={formatCurrencyNoDecimals(overview.valorpPerdido)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Drop-off médio / degrau" valor={formatPercent(overview.dropMedio)} />
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Cancelamentos (drop-off por entrega)</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Caiu na entrega</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Valor pontual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalhamento.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.nomeCliente ?? "—"}</TableCell>
                    <TableCell>{r.produto}</TableCell>
                    <TableCell>{r.nivelCaiu}ª</TableCell>
                    <TableCell>{r.motivo ?? "—"}</TableCell>
                    <TableCell>{r.squad ?? "—"}</TableCell>
                    <TableCell>{r.responsavel ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(r.valorp)}</TableCell>
                  </TableRow>
                ))}
                {detalhamento.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-gray-400 dark:text-zinc-500">Sem cancelamentos pontorrentes no mês.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SecaoChurn({ mes }: { mes: string }) {
  return (
    <Tabs defaultValue="recorrente">
      <TabsList>
        <TabsTrigger value="recorrente">Recorrente</TabsTrigger>
        <TabsTrigger value="pontual">Pontual</TabsTrigger>
      </TabsList>
      <TabsContent value="recorrente" className="mt-4">
        <ChurnRecorrente mes={mes} />
      </TabsContent>
      <TabsContent value="pontual" className="mt-4">
        <ChurnPontual mes={mes} />
      </TabsContent>
    </Tabs>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { KpiCard } from "./KpiCard";
import { TemporalidadeBadge } from "./TemporalidadeBadge";
import { useReportsMensal, useEstoqueOverview } from "./hooks";
import type { OperadorRank } from "./tipos";

// Shape espelha o handler de GET /api/estoque-pontual/overview (server/routes/estoquePontual.ts),
// confirmado lendo o SELECT — não há tipo compartilhado client/server para este endpoint.
interface EstoqueOverview {
  valorEstoque: number;
  qtdItens: number;
  idadeMedia: number;
  qtdEnvelhecidos: number;
  valorEnvelhecidos: number;
}

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
function BlocoCard({ titulo, sub, isLoading, isError, children }: { titulo: string; sub?: string; isLoading: boolean; isError: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{titulo}</h3>
          {sub && <span className="text-xs text-gray-400 dark:text-zinc-500">{sub}</span>}
        </div>
        {isError ? (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" /> Falha ao carregar.</div>
        ) : isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : children}
      </CardContent>
    </Card>
  );
}

function getInitials(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function AvatarPequeno({ fotoUrl, nome }: { fotoUrl: string | null; nome: string }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-100 text-[10px] font-semibold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
      {fotoUrl ? (
        <img src={fotoUrl} alt={nome} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        getInitials(nome)
      )}
    </div>
  );
}

function TabelaPorProduto({ produtos }: { produtos: [string, number][] }) {
  if (produtos.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-zinc-500">Sem entregas registradas no mês.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead className="text-right">Valor entregue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produtos.map(([produto, valor]) => (
            <TableRow key={produto}>
              <TableCell className="font-medium">{produto}</TableCell>
              <TableCell className="text-right">{formatCurrencyNoDecimals(valor)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TabelaPorOperador({ operadores }: { operadores: OperadorRank[] }) {
  if (operadores.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-zinc-500">Sem entregas registradas no mês.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Operador</TableHead>
            <TableHead className="text-right">Entregas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operadores.map((o) => (
            <TableRow key={o.nome}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <AvatarPequeno fotoUrl={o.fotoUrl} nome={o.nome} />
                  <div>
                    <div>{o.nome}</div>
                    {o.cargo && <div className="text-xs text-gray-400 dark:text-zinc-500">{o.cargo}</div>}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">{o.valor.toLocaleString("pt-BR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SecaoEntregas({ mes }: { mes: string }) {
  const rm = useReportsMensal(mes);
  const estoqueQ = useEstoqueOverview();
  const estoque = estoqueQ.data as EstoqueOverview | undefined;

  if (rm.isError) {
    return <ErroCard mensagem="Falha ao carregar entregas pontuais. Tente recarregar." />;
  }
  if (rm.isLoading || !rm.data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const p = rm.data.pontualData;
  const techKpis = rm.data.techData.kpis;
  const topEntregas = rm.data.topOperadores.topEntregas ?? [];

  // Série do ano — pegamos só o mês selecionado. Ausente = mês sem snapshot de entregas
  // registrado ainda (ex: mês corrente antes do fechamento).
  const serieMes = p.entregasPorProdutoMes.find((s) => s.month === mes);
  const produtosMes: [string, number][] = serieMes
    ? Object.entries(serieMes.produtos).sort((a, b) => b[1] - a[1])
    : [];

  const contratosEntregues = p.entregasMes.porSquad.reduce((acc, s) => acc + s.contratos, 0);

  const leadTime = [...p.tempoMedioEntrega].sort((a, b) => b.diasMedio - a.diasMedio);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Total entregue (mês)</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard mes={mes} temporalidade="mes" titulo="Entregue (R$)" valor={formatCurrencyNoDecimals(p.entregasMes.total)} sub={`${contratosEntregues} contratos`} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Entregas técnicas" valor={techKpis.entregues.toLocaleString("pt-BR")} />
        </div>
      </section>

      <BlocoCard titulo="Por produto (mês)" isLoading={false} isError={false}>
        <div className="mb-2 flex items-center gap-2">
          <TemporalidadeBadge tipo="mes" mes={mes} />
        </div>
        <TabelaPorProduto produtos={produtosMes} />
      </BlocoCard>

      <BlocoCard titulo="Por operador (mês)" isLoading={false} isError={false}>
        <div className="mb-2 flex items-center gap-2">
          <TemporalidadeBadge tipo="mes" mes={mes} />
        </div>
        <TabelaPorOperador operadores={topEntregas} />
      </BlocoCard>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Aberto × Entregue</h3>
        <div className="grid grid-cols-2 gap-3">
          {estoqueQ.isError ? (
            <ErroCard mensagem="Falha ao carregar estoque em aberto." />
          ) : estoqueQ.isLoading || !estoque ? (
            <Skeleton className="h-28" />
          ) : (
            <KpiCard mes={mes} temporalidade="snapshot" titulo="Aberto (estoque)" valor={formatCurrencyNoDecimals(estoque.valorEstoque)} sub={`${estoque.qtdItens} itens`} />
          )}
          <KpiCard mes={mes} temporalidade="mes" titulo="Entregue" valor={formatCurrencyNoDecimals(p.entregasMes.total)} sub={`${contratosEntregues} contratos`} />
        </div>
      </section>

      <BlocoCard titulo="Lead time por produto" sub="janela 6m" isLoading={false} isError={false}>
        <div className="mb-2 flex items-center gap-2">
          <TemporalidadeBadge tipo="mes" mes={mes} />
        </div>
        {leadTime.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500">Sem entregas nos últimos 6 meses.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Dias médio</TableHead>
                  <TableHead className="text-right">Contratos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadTime.map((t) => (
                  <TableRow key={t.produto}>
                    <TableCell className="font-medium">{t.produto}</TableCell>
                    <TableCell className="text-right">{t.diasMedio.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{t.contratos.toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </BlocoCard>
    </div>
  );
}

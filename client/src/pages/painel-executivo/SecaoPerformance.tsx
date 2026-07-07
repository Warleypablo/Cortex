import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { TemporalidadeBadge } from "./TemporalidadeBadge";
import { EmBreveCard } from "./EmBreveCard";
import { useLtLtvClientes, useReportsMensal } from "./hooks";
import type { ClienteRow } from "@/components/lt-ltv-churn/types";

/** Card com título fixo que troca o conteúdo por skeleton/erro sem desmontar as seções vizinhas. */
function BlocoCard({ titulo, isLoading, isError, children }: { titulo: string; isLoading: boolean; isError: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{titulo}</h3>
        {isError ? (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" /> Falha ao carregar.</div>
        ) : isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : children}
      </CardContent>
    </Card>
  );
}

function formatLt(v: number | null | undefined): string {
  return v != null ? `${v}m` : "—";
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

export function SecaoPerformance({ mes }: { mes: string }) {
  const clientesQ = useLtLtvClientes();
  const rm = useReportsMensal(mes);

  const clientes = (clientesQ.data as { clientes: ClienteRow[] } | undefined)?.clientes ?? [];
  const topClientes = [...clientes].sort((a, b) => b.ltvTotal - a.ltvTotal).slice(0, 10);

  const topOperadores = rm.data?.topOperadores.topMrrPontual ?? [];
  const rankingSquads = [...(rm.data?.rankingSquads ?? [])].sort((a, b) => a.posicao - b.posicao);

  return (
    <div className="space-y-6">
      <BlocoCard titulo="Top 10 maiores clientes (R$)" isLoading={clientesQ.isLoading} isError={clientesQ.isError}>
        <div className="mb-2 flex items-center gap-2">
          <TemporalidadeBadge tipo="snapshot" mes={mes} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">LTV total</TableHead>
                <TableHead className="text-right">LT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topClientes.map((c) => (
                <TableRow key={c.idTask}>
                  <TableCell className="font-medium">{c.nomeCliente ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(c.ltvTotal)}</TableCell>
                  <TableCell className="text-right">{formatLt(c.ltMeses)}</TableCell>
                </TableRow>
              ))}
              {topClientes.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-gray-400 dark:text-zinc-500">Sem dados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </BlocoCard>

      <BlocoCard titulo="Top operadores (mês)" isLoading={rm.isLoading} isError={rm.isError}>
        <div className="mb-2 flex items-center gap-2">
          <TemporalidadeBadge tipo="mes" mes={mes} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead className="text-right">MRR + Pontual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topOperadores.map((o, i) => (
                <TableRow key={o.nome}>
                  <TableCell className="text-gray-400 dark:text-zinc-500">{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <AvatarPequeno fotoUrl={o.fotoUrl} nome={o.nome} />
                      <div>
                        <div>{o.nome}</div>
                        {o.cargo && <div className="text-xs text-gray-400 dark:text-zinc-500">{o.cargo}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(o.valor)}</TableCell>
                </TableRow>
              ))}
              {topOperadores.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-gray-400 dark:text-zinc-500">Sem dados no mês.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </BlocoCard>

      <BlocoCard titulo="Ranking de squads (mês)" isLoading={rm.isLoading} isError={rm.isError}>
        <div className="mb-2 flex items-center gap-2">
          <TemporalidadeBadge tipo="mes" mes={mes} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Squad</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">Pontual</TableHead>
                <TableHead className="text-right">Contratos</TableHead>
                <TableHead className="text-right">Clientes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingSquads.map((s) => (
                <TableRow key={s.squad}>
                  <TableCell className="text-gray-400 dark:text-zinc-500">{s.posicao}</TableCell>
                  <TableCell className="font-medium">{s.squad}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(s.mrr)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(s.pontual)}</TableCell>
                  <TableCell className="text-right">{s.contratos.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{s.clientes.toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))}
              {rankingSquads.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-gray-400 dark:text-zinc-500">Sem dados no mês.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </BlocoCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EmBreveCard titulo="Maiores crescimentos do mês" motivo="Fase 2 — requer delta MoM por cliente" />
        <EmBreveCard titulo="Maiores investimentos" motivo="Fase 2 — requer fonte de ads/Growth" />
      </div>
    </div>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Info } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { KpiCard } from "./KpiCard";
import { useLtLtvOverview, useLtLtvDist, useLtLtvClientes } from "./hooks";
import type { OverviewData, BucketDist, ClienteRow } from "@/components/lt-ltv-churn/types";

function ErroCard({ mensagem }: { mensagem: string }) {
  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
      <CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300">
        <AlertTriangle className="h-4 w-4" /> {mensagem}
      </CardContent>
    </Card>
  );
}

/** Aviso fixo: TODOS os dados desta aba são temporalidade="snapshot" — os endpoints
   /api/lt-ltv-churn/* ignoram o mês selecionado no topo da página e refletem a base
   ativa ATUAL (vw_lt_contratos, sem filtro de data). */
function AvisoSnapshot() {
  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <CardContent className="flex items-center gap-2 py-3 text-sm text-amber-800 dark:text-amber-300">
        <Info className="h-4 w-4 shrink-0" />
        LT/LTV refletem a base ativa atual, não o mês selecionado.
      </CardContent>
    </Card>
  );
}

/** Card com título fixo que troca o conteúdo por skeleton/erro sem desmontar as seções vizinhas. */
function BlocoCard({ titulo, isLoading, isError, children }: { titulo: string; isLoading: boolean; isError: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{titulo}</h3>
        {isError ? (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" /> Falha ao carregar.</div>
        ) : isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : children}
      </CardContent>
    </Card>
  );
}

function formatLt(v: number | null | undefined): string {
  return v != null ? `${v}m` : "—";
}

const tooltipStyleDark = { backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" };

export function SecaoLtLtv({ mes }: { mes: string }) {
  const overviewQ = useLtLtvOverview();
  const distQ = useLtLtvDist();
  const clientesQ = useLtLtvClientes();

  const overview = overviewQ.data as OverviewData | undefined;
  const dist = distQ.data as { ltv: BucketDist[]; lt: BucketDist[] } | undefined;
  const clientes = clientesQ.data as { clientes: ClienteRow[]; total: number } | undefined;

  if (overviewQ.isError) {
    return (
      <div className="space-y-6">
        <AvisoSnapshot />
        <ErroCard mensagem="Falha ao carregar LT/LTV. Tente recarregar." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AvisoSnapshot />

      {overviewQ.isLoading || !overview ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard mes={mes} temporalidade="snapshot" titulo="LT médio ativo" valor={formatLt(overview.ltMedioAtivo)} />
          <KpiCard mes={mes} temporalidade="snapshot" titulo="LT médio cancelado" valor={formatLt(overview.ltMedioCancelado)} />
          <KpiCard mes={mes} temporalidade="snapshot" titulo="LTV médio/cliente" valor={formatCurrencyNoDecimals(overview.ltvMedioCliente)} />
          <KpiCard mes={mes} temporalidade="snapshot" titulo="Total recorrentes" valor={String(overview.totalRecorrentes)} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <BlocoCard titulo="Distribuição de LTV por cliente" isLoading={distQ.isLoading} isError={distQ.isError}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dist?.ltv ?? []}>
              <XAxis dataKey="faixa" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [String(v), "Clientes"]} contentStyle={tooltipStyleDark} />
              <Bar dataKey="qtd" name="Clientes" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </BlocoCard>

        <BlocoCard titulo="Distribuição de LT por cliente" isLoading={distQ.isLoading} isError={distQ.isError}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dist?.lt ?? []}>
              <XAxis dataKey="faixa" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [String(v), "Clientes"]} contentStyle={tooltipStyleDark} />
              <Bar dataKey="qtd" name="Clientes" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </BlocoCard>
      </div>

      <BlocoCard titulo="Maiores por LTV" isLoading={clientesQ.isLoading} isError={clientesQ.isError}>
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
              {(clientes?.clientes ?? []).slice(0, 10).map((c) => (
                <TableRow key={c.idTask}>
                  <TableCell>{c.nomeCliente ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(c.ltvTotal)}</TableCell>
                  <TableCell className="text-right">{formatLt(c.ltMeses)}</TableCell>
                </TableRow>
              ))}
              {(clientes?.clientes?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-gray-400 dark:text-zinc-500">Sem dados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </BlocoCard>
    </div>
  );
}

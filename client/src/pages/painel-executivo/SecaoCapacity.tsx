import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Info } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrencyNoDecimals, formatPercent } from "@/lib/utils";
import { KpiCard } from "./KpiCard";
import { TemporalidadeBadge } from "./TemporalidadeBadge";
import { useCeoDashboard, useCapacityTimes } from "./hooks";
import { SELVA_BLOQUEADA } from "@shared/capacityGrupos";

const META_RECEITA_CABECA = 20000;

// Shapes espelham server/routes/capacityTimes.helpers.ts (CapacityTimesResponse), confirmadas
// lendo capacity.ts (GET /api/capacity-times) e o consumidor client/src/pages/CapacityTimes.tsx —
// não há tipo compartilhado client/server para este endpoint (por isso a duplicação local).
interface ComercialRow {
  nome: string;
  mrr_atual: number;
  contas_ativas: number;
  util_mrr_pct: number | null;
  util_contas_pct: number | null;
}
interface SelvaRow {
  nome: string;
  contas: number;
  faturamento: number;
  cap_fat: number | null;
  util_pct: number | null;
}
interface CsRow {
  nome: string;
  op_recorrente: number;
  mrr_operando: number;
  cap_fat: number | null;
  util_fat_pct: number | null;
}
interface SquadGroup { squad: string; rows: CsRow[]; }
interface CapacityTimesResponse {
  selva: SelvaRow[];
  black: ComercialRow[];
  squadra: ComercialRow[];
  cxcs: ComercialRow[];
  squads: SquadGroup[];
  metaContasDesigner: number;
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

function InfoCard({ mensagem }: { mensagem: string }) {
  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <CardContent className="flex items-center gap-2 py-4 text-sm text-amber-800 dark:text-amber-300">
        <Info className="h-4 w-4 shrink-0" /> {mensagem}
      </CardContent>
    </Card>
  );
}

function pctTone(pct: number | null): string {
  if (pct === null) return "text-gray-400 dark:text-zinc-500";
  if (pct >= 90) return "text-red-600 dark:text-red-400";
  if (pct >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}
function pctText(pct: number | null): string {
  return pct === null ? "—" : formatPercent(pct, 1);
}

/** Receita por cabeça (mês, via /api/ceo-dashboard) + barra vs meta fixa de R$20k. */
function ReceitaCabecaBloco({ mes }: { mes: string }) {
  const ceo = useCeoDashboard(mes);

  if (ceo.isError) {
    return <InfoCard mensagem="Receita por cabeça requer permissão de CEO." />;
  }
  if (ceo.isLoading || !ceo.data) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  // kpis é um ARRAY (CeoKpi[]), não um mapa por chave — confirmado na Task 3/6.
  const valor = (ceo.data as any)?.kpis?.find((k: any) => k.key === "receita_cabeca")?.valor as number | null | undefined;
  const pct = valor != null ? Math.min(valor / META_RECEITA_CABECA, 1) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <KpiCard
        mes={mes}
        temporalidade="mes"
        titulo="Receita / Cabeça"
        valor={valor != null ? formatCurrencyNoDecimals(valor) : "—"}
      />
      <Card>
        <CardContent className="flex h-full flex-col justify-center gap-2 p-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span>Meta R$ 20 mil / cabeça</span>
            <span className="font-medium text-gray-700 dark:text-zinc-300">{valor != null ? `${Math.round(pct)}%` : "—"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
            <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComercialTable({ titulo, rows }: { titulo: string; rows: ComercialRow[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{titulo}</h4>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">MRR atual</TableHead>
              <TableHead className="text-right">Util. MRR</TableHead>
              <TableHead className="text-right">Contas ativas</TableHead>
              <TableHead className="text-right">Util. contas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.nome}-${i}`}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="text-right">{formatCurrencyNoDecimals(r.mrr_atual)}</TableCell>
                <TableCell className={cn("text-right", pctTone(r.util_mrr_pct))}>{pctText(r.util_mrr_pct)}</TableCell>
                <TableCell className="text-right">{r.contas_ativas}</TableCell>
                <TableCell className={cn("text-right", pctTone(r.util_contas_pct))}>{pctText(r.util_contas_pct)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-gray-400">Sem dados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SelvaTable({ rows }: { rows: SelvaRow[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Selva — Designers</h4>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Designer</TableHead>
              <TableHead className="text-right">Contas</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Cap. (R$)</TableHead>
              <TableHead className="text-right">Util.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.nome}-${i}`}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="text-right">{r.contas}</TableCell>
                <TableCell className="text-right">{formatCurrencyNoDecimals(r.faturamento)}</TableCell>
                <TableCell className="text-right text-gray-500 dark:text-zinc-400">{r.cap_fat != null ? formatCurrencyNoDecimals(r.cap_fat) : "—"}</TableCell>
                <TableCell className={cn("text-right", pctTone(r.util_pct))}>{pctText(r.util_pct)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-gray-400">Sem dados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SquadTable({ group }: { group: SquadGroup }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Squad {group.squad}</h4>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Contratos (rec.)</TableHead>
              <TableHead className="text-right">MRR operando</TableHead>
              <TableHead className="text-right">Cap. FAT ($)</TableHead>
              <TableHead className="text-right">Util. FAT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.rows.map((r, i) => (
              <TableRow key={`${r.nome}-${i}`}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="text-right">{r.op_recorrente}</TableCell>
                <TableCell className="text-right">{formatCurrencyNoDecimals(r.mrr_operando)}</TableCell>
                <TableCell className="text-right text-gray-500 dark:text-zinc-400">{r.cap_fat != null ? formatCurrencyNoDecimals(r.cap_fat) : "—"}</TableCell>
                <TableCell className={cn("text-right", pctTone(r.util_fat_pct))}>{pctText(r.util_fat_pct)}</TableCell>
              </TableRow>
            ))}
            {group.rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-gray-400">Sem dados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Carteira por squad/operador (snapshot atual — /api/capacity-times ignora o mês selecionado). */
function CapacitySnapshot() {
  const q = useCapacityTimes();
  const data = q.data as CapacityTimesResponse | undefined;

  if (q.isError) {
    return <ErroCard mensagem="Falha ao carregar capacity por squad/operador." />;
  }
  if (q.isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-4">
          <ComercialTable titulo="Black — Accounts" rows={data.black} />
          <ComercialTable titulo="Squadra — GPs" rows={data.squadra} />
          <ComercialTable titulo="CXCS — Customer Success" rows={data.cxcs} />
          {SELVA_BLOQUEADA ? (
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
              <Info className="h-3.5 w-3.5 shrink-0" /> Selva (Designers) desativada temporariamente — carteira em preenchimento no ClickUp.
            </div>
          ) : (
            <SelvaTable rows={data.selva} />
          )}
        </CardContent>
      </Card>

      {data.squads.map((g) => (
        <Card key={g.squad}>
          <CardContent className="p-4">
            <SquadTable group={g} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SecaoCapacity({ mes }: { mes: string }) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Receita por cabeça</h3>
        <ReceitaCabecaBloco mes={mes} />
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Carteira por squad / operador</h3>
          <TemporalidadeBadge tipo="snapshot" mes={mes} />
        </div>
        <CapacitySnapshot />
      </section>
    </div>
  );
}

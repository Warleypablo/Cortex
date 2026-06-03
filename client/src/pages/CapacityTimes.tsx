import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge } from "lucide-react";

interface CsRow {
  nome: string;
  op_recorrente: number; cap_recorrente: number | null;
  op_pontual: number; cap_pontual: number | null;
  op_total: number;
  mrr_operando: number; mrr_ativo: number; mrr_onboarding: number; mrr_cancelamento: number;
  cap_mrr: number | null;
  util_pct: number | null;
}
interface ComercialRow {
  nome: string;
  mrr_atual: number; cap_mrr: number | null; dif_mrr: number | null;
  contas_ativas: number; cap_contas: number | null; dif_contas: number | null;
  util_pct: number | null;
}
interface SquadGroup {
  squad: string;
  rows: CsRow[];
}
interface CapacityTimesResponse {
  squads: SquadGroup[]; vendedor: ComercialRow[]; account: ComercialRow[]; gestor: ComercialRow[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}
function utilColor(pct: number | null): string {
  if (pct === null) return "text-gray-400 dark:text-zinc-500";
  if (pct >= 90) return "text-red-600 dark:text-red-400";
  if (pct >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}
function utilBarColor(pct: number | null): string {
  if (pct === null) return "bg-gray-300 dark:bg-zinc-600";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-yellow-500";
  return "bg-green-500";
}
function pctText(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}
function numOrDash(v: number | null): string {
  return v === null ? "—" : String(v);
}
function moneyOrDash(v: number | null): string {
  return v === null ? "—" : formatCurrency(v);
}

function UtilBar({ pct }: { pct: number | null }) {
  const width = pct === null ? 0 : Math.min(pct, 100);
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-20 h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
        <div className={cn("h-full rounded-full", utilBarColor(pct))} style={{ width: `${width}%` }} />
      </div>
      <span className={cn("text-xs font-semibold w-12 text-right", utilColor(pct))}>{pctText(pct)}</span>
    </div>
  );
}

function MrrStatusBar({ ativo, onboarding, cancelamento }: { ativo: number; onboarding: number; cancelamento: number }) {
  const total = ativo + onboarding + cancelamento;
  if (total === 0) return null;
  const w = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden mt-1" title={`Ativo ${formatCurrency(ativo)} · Onboarding ${formatCurrency(onboarding)} · Cancelamento ${formatCurrency(cancelamento)}`}>
      <div className="bg-green-500" style={{ width: w(ativo) }} />
      <div className="bg-blue-500" style={{ width: w(onboarding) }} />
      <div className="bg-red-500" style={{ width: w(cancelamento) }} />
    </div>
  );
}

function th(extra = "") { return cn("text-gray-600 dark:text-zinc-400", extra); }
function td(extra = "") { return cn("text-gray-900 dark:text-white", extra); }

function CsTable({ rows }: { rows: CsRow[] }) {
  if (!rows.length) return <p className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhuma pessoa neste time.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 dark:border-zinc-700">
            <TableHead className={th()}>Nome</TableHead>
            <TableHead className={th("text-right")}>Recorrente</TableHead>
            <TableHead className={th("text-right")}>Cap. Rec.</TableHead>
            <TableHead className={th("text-right")}>Pontual</TableHead>
            <TableHead className={th("text-right")}>Cap. Pont.</TableHead>
            <TableHead className={th("text-right")}>MRR Operando</TableHead>
            <TableHead className={th("text-right")}>Cap. MRR</TableHead>
            <TableHead className={th("text-right")}>Utilização</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.nome}-${i}`} className="border-gray-200 dark:border-zinc-700">
              <TableCell className={td("font-medium")}>{r.nome}</TableCell>
              <TableCell className={td("text-right")}>{r.op_recorrente}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_recorrente)}</TableCell>
              <TableCell className={td("text-right")}>{r.op_pontual}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_pontual)}</TableCell>
              <TableCell className={td("text-right")}>
                {formatCurrency(r.mrr_operando)}
                <MrrStatusBar ativo={r.mrr_ativo} onboarding={r.mrr_onboarding} cancelamento={r.mrr_cancelamento} />
              </TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{moneyOrDash(r.cap_mrr)}</TableCell>
              <TableCell className="text-right"><UtilBar pct={r.util_pct} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ComercialTable({ rows }: { rows: ComercialRow[] }) {
  if (!rows.length) return <p className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhuma pessoa neste time.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 dark:border-zinc-700">
            <TableHead className={th()}>Nome</TableHead>
            <TableHead className={th("text-right")}>MRR Atual</TableHead>
            <TableHead className={th("text-right")}>Cap. MRR</TableHead>
            <TableHead className={th("text-right")}>Δ MRR</TableHead>
            <TableHead className={th("text-right")}>Contas</TableHead>
            <TableHead className={th("text-right")}>Cap. Contas</TableHead>
            <TableHead className={th("text-right")}>Δ Contas</TableHead>
            <TableHead className={th("text-right")}>Utilização</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.nome}-${i}`} className="border-gray-200 dark:border-zinc-700">
              <TableCell className={td("font-medium")}>{r.nome}</TableCell>
              <TableCell className={td("text-right")}>{formatCurrency(r.mrr_atual)}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{moneyOrDash(r.cap_mrr)}</TableCell>
              <TableCell className={cn("text-right", r.dif_mrr === null ? "text-gray-400 dark:text-zinc-500" : r.dif_mrr < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{r.dif_mrr === null ? "—" : formatCurrency(r.dif_mrr)}</TableCell>
              <TableCell className={td("text-right")}>{r.contas_ativas}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_contas)}</TableCell>
              <TableCell className={cn("text-right", r.dif_contas === null ? "text-gray-400 dark:text-zinc-500" : r.dif_contas < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{numOrDash(r.dif_contas)}</TableCell>
              <TableCell className="text-right"><UtilBar pct={r.util_pct} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function CapacityTimes() {
  useSetPageInfo("Capacity Times", "Ocupação atual vs. capacidade por pessoa e time");
  usePageTitle("Capacity Times");

  const { data, isLoading } = useQuery<CapacityTimesResponse>({
    queryKey: ["/api/capacity-times"],
  });

  const squads = data?.squads ?? [];
  const defaultTab = squads[0]?.squad ?? "vendedor";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Capacity Times</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Ocupação atual vs. capacidade por pessoa e time</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {squads.map((s) => (
              <TabsTrigger key={s.squad} value={s.squad}>{s.squad} ({s.rows.length})</TabsTrigger>
            ))}
            <TabsTrigger value="vendedor">Selca ({data?.vendedor.length ?? 0})</TabsTrigger>
            <TabsTrigger value="account">Accounts ({data?.account.length ?? 0})</TabsTrigger>
            <TabsTrigger value="gestor">Squadra ({data?.gestor.length ?? 0})</TabsTrigger>
          </TabsList>

          {squads.map((s) => (
            <TabsContent key={s.squad} value={s.squad}>
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardHeader><CardTitle className="text-gray-900 dark:text-white">Squad {s.squad}</CardTitle></CardHeader>
                <CardContent><CsTable rows={s.rows} /></CardContent>
              </Card>
            </TabsContent>
          ))}
          <TabsContent value="vendedor">
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader><CardTitle className="text-gray-900 dark:text-white">Selca</CardTitle></CardHeader>
              <CardContent><ComercialTable rows={data?.vendedor ?? []} /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="account">
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader><CardTitle className="text-gray-900 dark:text-white">Accounts</CardTitle></CardHeader>
              <CardContent><ComercialTable rows={data?.account ?? []} /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="gestor">
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader><CardTitle className="text-gray-900 dark:text-white">Squadra</CardTitle></CardHeader>
              <CardContent><ComercialTable rows={data?.gestor ?? []} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

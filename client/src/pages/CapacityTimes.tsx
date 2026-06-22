import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { OperadorDrawer } from "@/components/capacity-times/OperadorDrawer";
import { CapacityMetasConfig } from "@/components/capacity-times/CapacityMetasConfig";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, AlertTriangle, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface CsRow {
  nome: string;
  op_recorrente: number; cap_recorrente: number | null;
  op_pontual: number; cap_pontual: number | null;
  op_total: number;
  mrr_operando: number; mrr_ativo: number; mrr_onboarding: number; mrr_cancelamento: number;
  cap_mrr: number | null;
  util_mrr_pct: number | null;
  util_contas_pct: number | null;
  util_pct: number | null;
}
interface ComercialRow {
  nome: string;
  mrr_atual: number; mrr_ativo: number; mrr_onboarding: number; mrr_cancelamento: number;
  cap_mrr: number | null; dif_mrr: number | null;
  contas_ativas: number; cap_contas: number | null; dif_contas: number | null;
  util_mrr_pct: number | null;
  util_contas_pct: number | null;
  util_pct: number | null;
}
interface SquadGroup {
  squad: string;
  rows: CsRow[];
}
interface CapacityTimesResponse {
  squads: SquadGroup[]; vendedor: ComercialRow[]; account: ComercialRow[]; gestor: ComercialRow[];
}

interface TeamSummary {
  time: string;
  pessoas: number;
  contas: number;
  mrr_operando: number;
  cap_mrr: number;
  util_mrr_pct: number | null;    // média das utilizações por MRR
  util_contas_pct: number | null; // média das utilizações por contas
  gap_mrr: number;
  mrr_cancelamento: number;
  // Quantas pessoas do time têm cap de MRR definida — cap/espaço só consideram essas
  pessoas_com_cap: number;
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
// Cores fixas dos dois percentuais nos gráficos agrupados (MRR × Contas)
const COLOR_MRR = "#3b82f6";
const COLOR_CONTAS = "#a855f7";
function pctText(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}
function numOrDash(v: number | null): string {
  return v === null ? "—" : String(v);
}
function moneyOrDash(v: number | null): string {
  return v === null ? "—" : formatCurrency(v);
}

function sum(nums: (number | null)[]): number {
  return nums.reduce<number>((a, b) => a + (b ?? 0), 0);
}
function avgOf(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x !== null);
  if (!v.length) return null;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}
function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}
function ticket(mrr: number, contas: number): number | null {
  if (!contas) return null;
  return mrr / contas;
}
function riscoTone(p: number | null): string {
  if (p === null) return "text-gray-400 dark:text-zinc-500";
  if (p >= 20) return "text-red-600 dark:text-red-400";
  if (p >= 10) return "text-yellow-600 dark:text-yellow-400";
  return "text-gray-700 dark:text-zinc-300";
}

// ── Componentes reutilizáveis ──

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

function StatCards({ cards }: { cards: { label: string; value: string; tone?: string }[] }) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 gap-3", cards.length >= 7 ? "lg:grid-cols-7" : "lg:grid-cols-6")}>
      {cards.map((c) => (
        <Card key={c.label} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500 dark:text-zinc-400">{c.label}</p>
            <p className={cn("text-lg font-bold", c.tone ?? "text-gray-900 dark:text-white")}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AlertCard({ title, icon, tone, people, empty }: {
  title: string; icon: ReactNode; tone: "red" | "green"; people: { nome: string; util_pct: number | null }[]; empty: string;
}) {
  const chip = tone === "red"
    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-gray-700 dark:text-zinc-300">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500">{empty}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <span key={p.nome} className={cn("px-2 py-1 rounded-full text-xs font-medium", chip)}>
                {p.nome} · {pctText(p.util_pct)}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Alerts({ people }: { people: { nome: string; util_pct: number | null }[] }) {
  const over = people.filter((p) => p.util_pct !== null && p.util_pct >= 90).sort((a, b) => (b.util_pct as number) - (a.util_pct as number));
  const idle = people.filter((p) => p.util_pct !== null && p.util_pct < 60).sort((a, b) => (a.util_pct as number) - (b.util_pct as number));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <AlertCard title="Sobrecarregados (≥90%)" icon={<AlertTriangle className="h-4 w-4 text-red-500" />} tone="red" people={over} empty="Ninguém acima de 90%." />
      <AlertCard title="Com folga (<60%)" icon={<TrendingDown className="h-4 w-4 text-green-500" />} tone="green" people={idle} empty="Ninguém abaixo de 60%." />
    </div>
  );
}

function UtilChart({ people }: { people: { nome: string; util_mrr_pct: number | null; util_contas_pct: number | null }[] }) {
  const data = people
    .filter((p) => p.util_mrr_pct !== null || p.util_contas_pct !== null)
    .map((p) => ({ nome: p.nome, mrr: p.util_mrr_pct, contas: p.util_contas_pct }))
    .sort((a, b) => (b.mrr ?? b.contas ?? 0) - (a.mrr ?? a.contas ?? 0));
  if (!data.length) return null;
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-700 dark:text-zinc-300">Utilização por pessoa — MRR × Contas</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
          <BarChart data={data} layout="vertical" margin={{ left: 90, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis type="number" domain={[0, "auto"]} tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="nome" width={110} tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <Tooltip formatter={(v: number, name: string) => [`${v}%`, name]} contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="mrr" name="Capacity MRR" fill={COLOR_MRR} radius={[0, 4, 4, 0]} maxBarSize={14} />
            <Bar dataKey="contas" name="Capacity Contas" fill={COLOR_CONTAS} radius={[0, 4, 4, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Tabelas ──

function CsTable({ rows, onOperadorClick }: { rows: CsRow[]; onOperadorClick: (nome: string) => void }) {
  if (!rows.length) return <p className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhuma pessoa neste time.</p>;
  const teamMrr = sum(rows.map((r) => r.mrr_operando));
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
            <TableHead className={th("text-right")} title="MRR recorrente / contas recorrentes">Ticket Médio</TableHead>
            <TableHead className={th("text-right")} title="Participação no MRR do time">% Time</TableHead>
            <TableHead className={th("text-right")}>Cap. MRR</TableHead>
            <TableHead className={th("text-right")} title="MRR Operando / Cap. MRR">% MRR</TableHead>
            <TableHead className={th("text-right")} title="Contas (rec + pont) / Caps de contas (rec + pont)">% Contas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.nome}-${i}`} className="border-gray-200 dark:border-zinc-700">
              <TableCell
                className={cn(td("font-medium"), "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline")}
                onClick={() => onOperadorClick(r.nome)}
              >
                {r.nome}
              </TableCell>
              <TableCell className={td("text-right")}>{r.op_recorrente}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_recorrente)}</TableCell>
              <TableCell className={td("text-right")}>{r.op_pontual}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_pontual)}</TableCell>
              <TableCell className={td("text-right")}>
                {formatCurrency(r.mrr_operando)}
                <MrrStatusBar ativo={r.mrr_ativo} onboarding={r.mrr_onboarding} cancelamento={r.mrr_cancelamento} />
              </TableCell>
              <TableCell className={td("text-right")}>{moneyOrDash(ticket(r.mrr_operando, r.op_recorrente))}</TableCell>
              <TableCell className="text-right text-gray-700 dark:text-zinc-300">{pctText(pct(r.mrr_operando, teamMrr))}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{moneyOrDash(r.cap_mrr)}</TableCell>
              <TableCell className="text-right"><UtilBar pct={r.util_mrr_pct} /></TableCell>
              <TableCell className="text-right"><UtilBar pct={r.util_contas_pct} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ComercialTable({ rows, onOperadorClick }: { rows: ComercialRow[]; onOperadorClick: (nome: string) => void }) {
  if (!rows.length) return <p className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhuma pessoa neste time.</p>;
  const teamMrr = sum(rows.map((r) => r.mrr_atual));
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 dark:border-zinc-700">
            <TableHead className={th()}>Nome</TableHead>
            <TableHead className={th("text-right")}>MRR Atual</TableHead>
            <TableHead className={th("text-right")}>Cap. MRR</TableHead>
            <TableHead className={th("text-right")}>Δ MRR</TableHead>
            <TableHead className={th("text-right")} title="MRR / contas ativas">Ticket Médio</TableHead>
            <TableHead className={th("text-right")} title="Participação no MRR do time">% Time</TableHead>
            <TableHead className={th("text-right")}>Contas</TableHead>
            <TableHead className={th("text-right")}>Cap. Contas</TableHead>
            <TableHead className={th("text-right")}>Δ Contas</TableHead>
            <TableHead className={th("text-right")} title="MRR Atual / Cap. MRR">% MRR</TableHead>
            <TableHead className={th("text-right")} title="Contas ativas / Cap. Contas">% Contas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.nome}-${i}`} className="border-gray-200 dark:border-zinc-700">
              <TableCell
                className={cn(td("font-medium"), "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline")}
                onClick={() => onOperadorClick(r.nome)}
              >
                {r.nome}
              </TableCell>
              <TableCell className={td("text-right")}>{formatCurrency(r.mrr_atual)}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{moneyOrDash(r.cap_mrr)}</TableCell>
              <TableCell className={cn("text-right", r.dif_mrr === null ? "text-gray-400 dark:text-zinc-500" : r.dif_mrr < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{r.dif_mrr === null ? "—" : formatCurrency(r.dif_mrr)}</TableCell>
              <TableCell className={td("text-right")}>{moneyOrDash(ticket(r.mrr_atual, r.contas_ativas))}</TableCell>
              <TableCell className="text-right text-gray-700 dark:text-zinc-300">{pctText(pct(r.mrr_atual, teamMrr))}</TableCell>
              <TableCell className={td("text-right")}>{r.contas_ativas}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_contas)}</TableCell>
              <TableCell className={cn("text-right", r.dif_contas === null ? "text-gray-400 dark:text-zinc-500" : r.dif_contas < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{numOrDash(r.dif_contas)}</TableCell>
              <TableCell className="text-right"><UtilBar pct={r.util_mrr_pct} /></TableCell>
              <TableCell className="text-right"><UtilBar pct={r.util_contas_pct} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Conteúdo das abas ──

function SquadTab({ group, onOperadorClick }: { group: SquadGroup; onOperadorClick: (nome: string) => void }) {
  const rows = group.rows;
  const totMrr = sum(rows.map((r) => r.mrr_operando));
  const totRec = sum(rows.map((r) => r.op_recorrente));
  const totCancel = sum(rows.map((r) => r.mrr_cancelamento));
  const riscoPct = pct(totCancel, totMrr);
  const mediaMrr = avgOf(rows.map((r) => r.util_mrr_pct));
  const mediaContas = avgOf(rows.map((r) => r.util_contas_pct));
  const cards = [
    { label: "Pessoas", value: String(rows.length) },
    { label: "Recorrente (op / cap)", value: `${totRec} / ${sum(rows.map((r) => r.cap_recorrente))}` },
    { label: "MRR Operando", value: formatCurrency(totMrr) },
    { label: "Ticket médio", value: moneyOrDash(ticket(totMrr, totRec)) },
    { label: "% em risco", value: pctText(riscoPct), tone: riscoTone(riscoPct) },
    { label: "Capacity MRR (média)", value: pctText(mediaMrr), tone: utilColor(mediaMrr) },
    { label: "Capacity Contas (média)", value: pctText(mediaContas), tone: utilColor(mediaContas) },
  ];
  return (
    <div className="space-y-4">
      <StatCards cards={cards} />
      <Alerts people={rows} />
      <UtilChart people={rows} />
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader><CardTitle className="text-gray-900 dark:text-white">Squad {group.squad}</CardTitle></CardHeader>
        <CardContent><CsTable rows={rows} onOperadorClick={onOperadorClick} /></CardContent>
      </Card>
    </div>
  );
}

function ComercialTab({ title, rows, onOperadorClick }: { title: string; rows: ComercialRow[]; onOperadorClick: (nome: string) => void }) {
  const totMrr = sum(rows.map((r) => r.mrr_atual));
  const totContas = sum(rows.map((r) => r.contas_ativas));
  const riscoPct = pct(sum(rows.map((r) => r.mrr_cancelamento)), totMrr);
  const mediaMrr = avgOf(rows.map((r) => r.util_mrr_pct));
  const mediaContas = avgOf(rows.map((r) => r.util_contas_pct));
  const cards = [
    { label: "Pessoas", value: String(rows.length) },
    { label: "Contas (op / cap)", value: `${totContas} / ${sum(rows.map((r) => r.cap_contas))}` },
    { label: "MRR Atual", value: formatCurrency(totMrr) },
    { label: "Ticket médio", value: moneyOrDash(ticket(totMrr, totContas)) },
    { label: "% em risco", value: pctText(riscoPct), tone: riscoTone(riscoPct) },
    { label: "Capacity MRR (média)", value: pctText(mediaMrr), tone: utilColor(mediaMrr) },
    { label: "Capacity Contas (média)", value: pctText(mediaContas), tone: utilColor(mediaContas) },
  ];
  return (
    <div className="space-y-4">
      <StatCards cards={cards} />
      <Alerts people={rows} />
      <UtilChart people={rows} />
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader><CardTitle className="text-gray-900 dark:text-white">{title}</CardTitle></CardHeader>
        <CardContent><ComercialTable rows={rows} onOperadorClick={onOperadorClick} /></CardContent>
      </Card>
    </div>
  );
}

function summarizeSquad(g: SquadGroup): TeamSummary {
  const rows = g.rows;
  return {
    time: g.squad,
    pessoas: rows.length,
    contas: sum(rows.map((r) => r.op_recorrente)),
    mrr_operando: sum(rows.map((r) => r.mrr_operando)),
    cap_mrr: sum(rows.map((r) => r.cap_mrr)),
    util_mrr_pct: avgOf(rows.map((r) => r.util_mrr_pct)),
    util_contas_pct: avgOf(rows.map((r) => r.util_contas_pct)),
    gap_mrr: sum(rows.map((r) => (r.cap_mrr !== null ? r.cap_mrr - r.mrr_operando : 0))),
    mrr_cancelamento: sum(rows.map((r) => r.mrr_cancelamento)),
    pessoas_com_cap: rows.filter((r) => r.cap_mrr !== null && r.cap_mrr !== 0).length,
  };
}
function summarizeComercial(time: string, rows: ComercialRow[]): TeamSummary {
  return {
    time,
    pessoas: rows.length,
    contas: sum(rows.map((r) => r.contas_ativas)),
    mrr_operando: sum(rows.map((r) => r.mrr_atual)),
    cap_mrr: sum(rows.map((r) => r.cap_mrr)),
    util_mrr_pct: avgOf(rows.map((r) => r.util_mrr_pct)),
    util_contas_pct: avgOf(rows.map((r) => r.util_contas_pct)),
    gap_mrr: sum(rows.map((r) => r.dif_mrr)),
    mrr_cancelamento: sum(rows.map((r) => r.mrr_cancelamento)),
    pessoas_com_cap: rows.filter((r) => r.cap_mrr !== null && r.cap_mrr !== 0).length,
  };
}

function Overview({ teams }: { teams: TeamSummary[] }) {
  const totalOperando = sum(teams.map((t) => t.mrr_operando));
  const totalCap = sum(teams.map((t) => t.cap_mrr));
  const totalGap = sum(teams.map((t) => t.gap_mrr));
  const totalCancel = sum(teams.map((t) => t.mrr_cancelamento));
  const totalPessoas = sum(teams.map((t) => t.pessoas));
  const totalComCap = sum(teams.map((t) => t.pessoas_com_cap));
  const capParcial = totalComCap > 0 && totalComCap < totalPessoas;
  const chartData = teams
    .filter((t) => t.util_mrr_pct !== null || t.util_contas_pct !== null)
    .map((t) => ({ time: t.time, mrr: t.util_mrr_pct, contas: t.util_contas_pct }));

  const cards: { label: string; value: string; tone?: string; sub?: string }[] = [
    { label: "MRR Operando (total)", value: formatCurrency(totalOperando) },
    { label: "Capacity MRR (total)", value: formatCurrency(totalCap), sub: capParcial ? `cobre ${totalComCap} de ${totalPessoas} pessoas` : undefined },
    { label: "Espaço de crescimento", value: formatCurrency(totalGap), tone: totalGap < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400", sub: capParcial ? "só de quem tem cap de MRR" : undefined },
    { label: "MRR em cancelamento (risco)", value: formatCurrency(totalCancel), tone: totalCancel > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500 dark:text-zinc-400">{c.label}</p>
              <p className={cn("text-xl font-bold", c.tone ?? "text-gray-900 dark:text-white")}>{c.value}</p>
              {c.sub && <p className="text-[10px] text-amber-600 dark:text-amber-400">{c.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-700 dark:text-zinc-300">Utilização média por time — MRR × Contas</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 52)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 70, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis type="number" domain={[0, "auto"]} tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="time" width={90} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <Tooltip formatter={(v: number, name: string) => [`${v}%`, name]} contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="mrr" name="Capacity MRR" fill={COLOR_MRR} radius={[0, 4, 4, 0]} maxBarSize={18} />
                <Bar dataKey="contas" name="Capacity Contas" fill={COLOR_CONTAS} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader><CardTitle className="text-gray-900 dark:text-white">Comparativo por time</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-zinc-700">
                  <TableHead className={th()}>Time</TableHead>
                  <TableHead className={th("text-right")}>Pessoas</TableHead>
                  <TableHead className={th("text-right")}>MRR Operando</TableHead>
                  <TableHead className={th("text-right")} title="MRR operando / contas">Ticket Médio</TableHead>
                  <TableHead className={th("text-right")}>Cap. MRR</TableHead>
                  <TableHead className={th("text-right")}>Espaço MRR</TableHead>
                  <TableHead className={th("text-right")}>Em Cancelamento</TableHead>
                  <TableHead className={th("text-right")} title="Média das utilizações por MRR do time">% MRR</TableHead>
                  <TableHead className={th("text-right")} title="Média das utilizações por contas do time">% Contas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.time} className="border-gray-200 dark:border-zinc-700">
                    <TableCell className={td("font-medium")}>{t.time}</TableCell>
                    <TableCell className={td("text-right")}>{t.pessoas}</TableCell>
                    <TableCell className={td("text-right")}>{formatCurrency(t.mrr_operando)}</TableCell>
                    <TableCell className={td("text-right")}>{moneyOrDash(ticket(t.mrr_operando, t.contas))}</TableCell>
                    <TableCell className="text-right text-gray-500 dark:text-zinc-400">
                      {t.cap_mrr > 0 ? formatCurrency(t.cap_mrr) : "—"}
                      {t.pessoas_com_cap > 0 && t.pessoas_com_cap < t.pessoas && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400" title="Cap. MRR e Espaço consideram só as pessoas com cap definida">{t.pessoas_com_cap}/{t.pessoas} com cap</div>
                      )}
                    </TableCell>
                    <TableCell className={cn("text-right", t.pessoas_com_cap === 0 ? "text-gray-500 dark:text-zinc-400" : t.gap_mrr < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{t.pessoas_com_cap === 0 ? "—" : formatCurrency(t.gap_mrr)}</TableCell>
                    <TableCell className={cn("text-right", t.mrr_cancelamento > 0 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-zinc-400")}>{t.mrr_cancelamento > 0 ? formatCurrency(t.mrr_cancelamento) : "—"}</TableCell>
                    <TableCell className="text-right"><UtilBar pct={t.util_mrr_pct} /></TableCell>
                    <TableCell className="text-right"><UtilBar pct={t.util_contas_pct} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CapacityTimes() {
  useSetPageInfo("Capacity Times", "Ocupação atual vs. capacidade por pessoa e time");
  usePageTitle("Capacity Times");

  const { data, isLoading } = useQuery<CapacityTimesResponse>({
    queryKey: ["/api/capacity-times"],
  });

  const [selectedOperador, setSelectedOperador] = useState<string | null>(null);

  const squads = data?.squads ?? [];
  const teams: TeamSummary[] = [
    ...squads.map(summarizeSquad),
    summarizeComercial("Selva", data?.vendedor ?? []),
    summarizeComercial("Accounts", data?.account ?? []),
    summarizeComercial("Squadra", data?.gestor ?? []),
  ];

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
        <Tabs defaultValue="__overview__">
          <TabsList>
            <TabsTrigger value="__overview__">Visão Geral</TabsTrigger>
            {squads.map((s) => (
              <TabsTrigger key={s.squad} value={s.squad}>{s.squad} ({s.rows.length})</TabsTrigger>
            ))}
            <TabsTrigger value="vendedor">Selva ({data?.vendedor.length ?? 0})</TabsTrigger>
            <TabsTrigger value="account">Accounts ({data?.account.length ?? 0})</TabsTrigger>
            <TabsTrigger value="gestor">Squadra ({data?.gestor.length ?? 0})</TabsTrigger>
            <TabsTrigger value="__config__">⚙️ Configurar</TabsTrigger>
          </TabsList>

          <TabsContent value="__overview__">
            <Overview teams={teams} />
          </TabsContent>

          {squads.map((s) => (
            <TabsContent key={s.squad} value={s.squad}>
              <SquadTab group={s} onOperadorClick={setSelectedOperador} />
            </TabsContent>
          ))}
          <TabsContent value="vendedor"><ComercialTab title="Selva" rows={data?.vendedor ?? []} onOperadorClick={setSelectedOperador} /></TabsContent>
          <TabsContent value="account"><ComercialTab title="Accounts" rows={data?.account ?? []} onOperadorClick={setSelectedOperador} /></TabsContent>
          <TabsContent value="gestor"><ComercialTab title="Squadra" rows={data?.gestor ?? []} onOperadorClick={setSelectedOperador} /></TabsContent>
          <TabsContent value="__config__"><CapacityMetasConfig /></TabsContent>
        </Tabs>
      )}

      <OperadorDrawer
        operador={selectedOperador}
        onClose={() => setSelectedOperador(null)}
      />
    </div>
  );
}

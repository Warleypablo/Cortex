import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { OperadorDrawer, type DrawerSelecao } from "@/components/capacity-times/OperadorDrawer";
import { CapacityMetasConfig } from "@/components/capacity-times/CapacityMetasConfig";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, AlertTriangle, TrendingDown, Lock } from "lucide-react";
import { SELVA_BLOQUEADA } from "@shared/capacityGrupos";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// Black / Squadra: carteira via responsavel (régua MRR + contas).
interface ComercialRow {
  nome: string;
  mrr_atual: number; mrr_ativo: number; mrr_onboarding: number; mrr_cancelamento: number;
  cap_mrr: number | null; dif_mrr: number | null;
  contas_ativas: number; cap_contas: number | null; dif_contas: number | null;
  util_mrr_pct: number | null;
  util_contas_pct: number | null;
  util_pct: number | null;
}
// Selva: designers, carteira via responsável da subtask (régua por faturamento rec + pontual).
interface SelvaRow {
  nome: string;
  contas: number;
  fat_recorrente: number; fat_pontual: number; faturamento: number;
  ticket_medio: number | null;
  cap_fat: number | null;
  util_pct: number | null;
}
interface CapacityTimesResponse {
  selva: SelvaRow[];
  black: ComercialRow[];
  squadra: ComercialRow[];
  metaContasDesigner: number;
}

interface TeamSummary {
  time: string;
  pessoas: number;
  operando: number; // MRR (black/squadra) ou faturamento (selva)
  util_pct: number | null; // média das utilizações do grupo
  cancelamento: number;
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

// ── Tabelas ──

function ComercialTable({ rows, onSelect }: { rows: ComercialRow[]; onSelect: (s: DrawerSelecao) => void }) {
  if (!rows.length) return <p className="text-center text-gray-500 dark:text-zinc-400 py-8">Ninguém neste grupo ainda (popula automaticamente pelo cargo no RH).</p>;
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
                onClick={() => onSelect({ label: r.nome, nome: r.nome })}
              >
                {r.nome}
              </TableCell>
              <TableCell className={td("text-right")}>
                {formatCurrency(r.mrr_atual)}
                <MrrStatusBar ativo={r.mrr_ativo} onboarding={r.mrr_onboarding} cancelamento={r.mrr_cancelamento} />
              </TableCell>
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

function SelvaTable({ rows, onSelect }: { rows: SelvaRow[]; onSelect: (s: DrawerSelecao) => void }) {
  if (!rows.length) return <p className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhum designer ativo encontrado no RH.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 dark:border-zinc-700">
            <TableHead className={th()}>Designer</TableHead>
            <TableHead className={th("text-right")} title="Contas onde o designer é responsável na subtask">Contas</TableHead>
            <TableHead className={th("text-right")} title="Faturamento recorrente + pontual da carteira">Faturamento (Rec+Pont)</TableHead>
            <TableHead className={th("text-right")} title="Faturamento recorrente (MRR)">Recorrente</TableHead>
            <TableHead className={th("text-right")} title="Faturamento pontual">Pontual</TableHead>
            <TableHead className={th("text-right")} title="Faturamento / contas">Ticket Médio</TableHead>
            <TableHead className={th("text-right")} title="Ticket Médio × meta de contas por designer">Cap. (R$)</TableHead>
            <TableHead className={th("text-right")} title="Faturamento / Cap.">% Ocupação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.nome}-${i}`} className="border-gray-200 dark:border-zinc-700">
              <TableCell
                className={cn(td("font-medium"), "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline")}
                onClick={() => onSelect({ label: r.nome, nome: r.nome })}
              >
                {r.nome}
              </TableCell>
              <TableCell className={td("text-right")}>{r.contas}</TableCell>
              <TableCell className={td("text-right")}>{formatCurrency(r.faturamento)}</TableCell>
              <TableCell className="text-right text-gray-700 dark:text-zinc-300">{formatCurrency(r.fat_recorrente)}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{formatCurrency(r.fat_pontual)}</TableCell>
              <TableCell className={td("text-right")}>{moneyOrDash(r.ticket_medio)}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{moneyOrDash(r.cap_fat)}</TableCell>
              <TableCell className="text-right"><UtilBar pct={r.util_pct} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Conteúdo das abas ──

function ComercialTab({ title, rows, onSelect }: { title: string; rows: ComercialRow[]; onSelect: (s: DrawerSelecao) => void }) {
  const totMrr = sum(rows.map((r) => r.mrr_atual));
  const totContas = sum(rows.map((r) => r.contas_ativas));
  const riscoPct = pct(sum(rows.map((r) => r.mrr_cancelamento)), totMrr);
  const mediaMrr = avgOf(rows.map((r) => r.util_mrr_pct));
  const mediaContas = avgOf(rows.map((r) => r.util_contas_pct));
  const cards = [
    { label: "Pessoas", value: String(rows.length) },
    { label: "Contas (total)", value: String(totContas) },
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
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader><CardTitle className="text-gray-900 dark:text-white">{title}</CardTitle></CardHeader>
        <CardContent><ComercialTable rows={rows} onSelect={onSelect} /></CardContent>
      </Card>
    </div>
  );
}

function SelvaTab({ rows, metaContas, onSelect }: { rows: SelvaRow[]; metaContas: number; onSelect: (s: DrawerSelecao) => void }) {
  const totFaturamento = sum(rows.map((r) => r.faturamento));
  const totRec = sum(rows.map((r) => r.fat_recorrente));
  const totPont = sum(rows.map((r) => r.fat_pontual));
  const totContas = sum(rows.map((r) => r.contas));
  const comCarteira = rows.filter((r) => r.contas > 0).length;
  const mediaOcup = avgOf(rows.map((r) => r.util_pct));
  const cards = [
    { label: "Designers", value: String(rows.length) },
    { label: "Com carteira", value: `${comCarteira} / ${rows.length}` },
    { label: "Faturamento (Rec+Pont)", value: formatCurrency(totFaturamento) },
    { label: "Recorrente / Pontual", value: `${formatCurrency(totRec)} · ${formatCurrency(totPont)}` },
    { label: "Ticket médio", value: moneyOrDash(ticket(totFaturamento, totContas)) },
    { label: "Ocupação média", value: pctText(mediaOcup), tone: utilColor(mediaOcup) },
  ];
  return (
    <div className="space-y-4">
      <StatCards cards={cards} />
      <Alerts people={rows} />
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Selva — Designers</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Carteira pelo responsável da subtask (ClickUp) · Capacity por faturamento (recorrente + pontual) ·
            Cap. (R$) = Ticket Médio da carteira × {metaContas} contas/designer
          </p>
        </CardHeader>
        <CardContent><SelvaTable rows={rows} onSelect={onSelect} /></CardContent>
      </Card>
    </div>
  );
}

function summarizeComercial(time: string, rows: ComercialRow[]): TeamSummary {
  return {
    time,
    pessoas: rows.length,
    operando: sum(rows.map((r) => r.mrr_atual)),
    util_pct: avgOf(rows.map((r) => r.util_mrr_pct)),
    cancelamento: sum(rows.map((r) => r.mrr_cancelamento)),
  };
}
function summarizeSelva(rows: SelvaRow[]): TeamSummary {
  return {
    time: "Selva",
    pessoas: rows.length,
    operando: sum(rows.map((r) => r.faturamento)),
    util_pct: avgOf(rows.map((r) => r.util_pct)),
    cancelamento: 0,
  };
}

function Overview({ teams }: { teams: TeamSummary[] }) {
  const chartData = teams
    .filter((t) => t.util_pct !== null)
    .map((t) => ({ time: t.time, util: t.util_pct }));

  // Faturamento por cabeça — mesmo número exibido no Investors Report.
  const { data: investors } = useQuery<{ equipe: { faturamentoPorCabeca: number } }>({
    queryKey: ["/api/investors-report"],
  });
  const fatPorCabeca = investors?.equipe.faturamentoPorCabeca ?? 0;

  const totalPessoas = sum(teams.map((t) => t.pessoas));
  const cards: { label: string; value: string; tone?: string; note?: string }[] = [
    { label: "Pessoas (total)", value: String(totalPessoas) },
    ...teams.map((t) => ({ label: `${t.time} — operando`, value: formatCurrency(t.operando) })),
    { label: "Fat. / Cabeça", value: formatCurrency(fatPorCabeca), note: "realizado / mês (média)" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500 dark:text-zinc-400">{c.label}</p>
              <p className={cn("text-xl font-bold", c.tone ?? "text-gray-900 dark:text-white")}>{c.value}</p>
              {c.note && <p className="text-[10px] text-gray-400 dark:text-zinc-500">{c.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-700 dark:text-zinc-300">Ocupação média por grupo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 56)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 70, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis type="number" domain={[0, "auto"]} tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="time" width={90} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Ocupação média"]} contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }} />
                <Bar dataKey="util" name="Ocupação média" fill={COLOR_MRR} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader><CardTitle className="text-gray-900 dark:text-white">Comparativo por grupo</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-zinc-700">
                  <TableHead className={th()}>Grupo</TableHead>
                  <TableHead className={th("text-right")}>Pessoas</TableHead>
                  <TableHead className={th("text-right")} title="MRR (Black/Squadra) ou Faturamento da carteira (Selva)">Operando</TableHead>
                  <TableHead className={th("text-right")}>Em Cancelamento</TableHead>
                  <TableHead className={th("text-right")} title="Média das utilizações do grupo">% Ocupação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.time} className="border-gray-200 dark:border-zinc-700">
                    <TableCell className={td("font-medium")}>{t.time}</TableCell>
                    <TableCell className={td("text-right")}>{t.pessoas}</TableCell>
                    <TableCell className={td("text-right")}>{formatCurrency(t.operando)}</TableCell>
                    <TableCell className={cn("text-right", t.cancelamento > 0 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-zinc-400")}>{t.cancelamento > 0 ? formatCurrency(t.cancelamento) : "—"}</TableCell>
                    <TableCell className="text-right"><UtilBar pct={t.util_pct} /></TableCell>
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
  useSetPageInfo("Capacity Times", "Ocupação atual vs. capacidade por função (Selva · Black · Squadra)");
  usePageTitle("Capacity Times");

  const { data, isLoading } = useQuery<CapacityTimesResponse>({
    queryKey: ["/api/capacity-times"],
  });

  const [selecao, setSelecao] = useState<DrawerSelecao | null>(null);

  const selva = data?.selva ?? [];
  const black = data?.black ?? [];
  const squadra = data?.squadra ?? [];
  const metaContas = data?.metaContasDesigner ?? 0;

  const teams: TeamSummary[] = [
    ...(SELVA_BLOQUEADA ? [] : [summarizeSelva(selva)]),
    summarizeComercial("Black", black),
    summarizeComercial("Squadra", squadra),
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Capacity Times</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Ocupação por função — Selva (Designers) · Black (Accounts) · Squadra (GPs)</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Tabs defaultValue="__overview__">
          <TabsList>
            <TabsTrigger value="__overview__">Visão Geral</TabsTrigger>
            <TabsTrigger
              value="selva"
              disabled={SELVA_BLOQUEADA}
              title={SELVA_BLOQUEADA ? "Em breve — carteira dos designers em preenchimento" : undefined}
            >
              {SELVA_BLOQUEADA && <Lock className="h-3 w-3 mr-1 inline" />}
              Selva ({selva.length})
            </TabsTrigger>
            <TabsTrigger value="black">Black ({black.length})</TabsTrigger>
            <TabsTrigger value="squadra">Squadra ({squadra.length})</TabsTrigger>
            <TabsTrigger value="__config__">⚙️ Configurar</TabsTrigger>
          </TabsList>

          <TabsContent value="__overview__">
            <Overview teams={teams} />
          </TabsContent>
          <TabsContent value="selva"><SelvaTab rows={selva} metaContas={metaContas} onSelect={setSelecao} /></TabsContent>
          <TabsContent value="black"><ComercialTab title="Black — Accounts" rows={black} onSelect={setSelecao} /></TabsContent>
          <TabsContent value="squadra"><ComercialTab title="Squadra — GPs" rows={squadra} onSelect={setSelecao} /></TabsContent>
          <TabsContent value="__config__"><CapacityMetasConfig /></TabsContent>
        </Tabs>
      )}

      <OperadorDrawer selecao={selecao} onClose={() => setSelecao(null)} />
    </div>
  );
}

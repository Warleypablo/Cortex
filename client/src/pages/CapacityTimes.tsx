import { useState } from "react";
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
import { Gauge, Lock } from "lucide-react";
import { SELVA_BLOQUEADA } from "@shared/capacityGrupos";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// Black / Squadra: carteira via responsavel (régua MRR + contas).
interface ComercialRow {
  nome: string;
  match?: string;
  mrr_atual: number; mrr_ativo: number; mrr_onboarding: number; mrr_cancelamento: number;
  cap_mrr: number | null; dif_mrr: number | null;
  contas_ativas: number; cap_contas: number | null; dif_contas: number | null;
  contratos: number; contratos_rec: number; contratos_pont: number;
  clientes: number;
  clientes_rec: number;
  clientes_pont: number;
  cap_clientes: number | null;
  dif_clientes: number | null;
  util_mrr_pct: number | null;
  util_contas_pct: number | null;
  util_clientes_pct: number | null;
}
// Selva: designers, carteira via responsável da subtask (régua por faturamento rec + pontual).
interface SelvaRow {
  nome: string;
  contas: number;
  contratos: number; contratos_rec: number; contratos_pont: number;
  fat_recorrente: number; fat_pontual: number; faturamento: number;
  ticket_medio: number | null;
  cap_fat: number | null;
  clientes: number;
  clientes_rec: number;
  clientes_pont: number;
  cap_clientes: number | null;
  dif_clientes: number | null;
  util_clientes_pct: number | null;
  util_pct: number | null;
}
// Squads de comunicação (Pulse, Olimpo): CS via capacity_metas.
// Cap. FAT ($) = ticket médio da equipe × capacity de contratos (cap_contas).
interface CsRow {
  nome: string;
  op_recorrente: number; cap_contratos: number | null;
  contratos: number; contratos_rec: number; contratos_pont: number;
  op_pontual: number;
  op_total: number;
  mrr_operando: number; mrr_ativo: number; mrr_onboarding: number; mrr_cancelamento: number;
  cap_fat: number | null;
  clientes: number;
  clientes_rec: number;
  clientes_pont: number;
  cap_clientes: number | null;
  dif_clientes: number | null;
  util_fat_pct: number | null;
  util_contas_pct: number | null;
  util_clientes_pct: number | null;
}
interface SquadGroup {
  squad: string;
  rows: CsRow[];
}
interface CapacityTimesResponse {
  selva: SelvaRow[];
  black: ComercialRow[];
  squadra: ComercialRow[];
  cxcs: ComercialRow[];
  squads: SquadGroup[];
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
    <div className={cn(
      "grid grid-cols-2 sm:grid-cols-3 gap-3",
      cards.length >= 8 ? "lg:grid-cols-8" : cards.length >= 7 ? "lg:grid-cols-7" : "lg:grid-cols-6",
    )}>
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

// ── Tabela única: todas as abas seguem o mesmo padrão (o da Squadra) ──

// Forma normalizada que as três origens (Comercial, Selva, CS) mapeiam.
interface Linha {
  nome: string;
  match?: string;
  fat: number;
  fatAtivo: number; fatOnboarding: number; fatCancelamento: number;
  capFat: number | null; difFat: number | null;
  contratos: number; contratosRec: number; contratosPont: number;
  clientes: number; clientesRec: number; clientesPont: number;
  capClientes: number | null; difClientes: number | null;
  utilFat: number | null; utilClientes: number | null;
}

function deltaTone(v: number | null): string {
  if (v === null) return "text-gray-400 dark:text-zinc-500";
  return v < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
}

function CapacityTable({ linhas, onSelect, campo, vazio }: {
  linhas: Linha[]; onSelect: (s: DrawerSelecao) => void; campo?: "cs" | "geral"; vazio: string;
}) {
  if (!linhas.length) return <p className="text-center text-gray-500 dark:text-zinc-400 py-8">{vazio}</p>;
  const fatTime = sum(linhas.map((l) => l.fat));
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 dark:border-zinc-700">
            <TableHead className={th()}>Nome</TableHead>
            <TableHead className={th("text-right")} title="Faturamento recorrente + pontual da carteira">Faturamento (R+P)</TableHead>
            <TableHead className={th("text-right")} title="Cap. Faturamento ($)">Cap. FAT ($)</TableHead>
            <TableHead className={th("text-right")}>Δ FAT</TableHead>
            <TableHead className={th("text-right")} title="Faturamento / contratos">Ticket Médio</TableHead>
            <TableHead className={th("text-right")} title="Participação no faturamento do time">% Time</TableHead>
            <TableHead className={th("text-right")} title="Contratos distintos (recorrente ou pontual)">Contratos</TableHead>
            <TableHead className={th("text-right")} title="Contratos recorrentes">Contratos Rec.</TableHead>
            <TableHead className={th("text-right")} title="Contratos pontuais">Contratos Pont.</TableHead>
            <TableHead className={th("text-right")} title="Clientes distintos (recorrente ou pontual)">Clientes</TableHead>
            <TableHead className={th("text-right")} title="Clientes com contrato recorrente">Clientes Rec.</TableHead>
            <TableHead className={th("text-right")} title="Clientes com contrato pontual">Clientes Pont.</TableHead>
            <TableHead className={th("text-right")} title="Meta de clientes configurada na aba Configurar">Cap. Clientes</TableHead>
            <TableHead className={th("text-right")}>Δ Clientes</TableHead>
            <TableHead className={th("text-right")} title="Faturamento / Cap. FAT">% FAT</TableHead>
            <TableHead className={th("text-right")} title="Clientes / Cap. Clientes">% Clientes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l, i) => (
            <TableRow key={`${l.nome}-${i}`} className="border-gray-200 dark:border-zinc-700">
              <TableCell
                className={cn(td("font-medium"), "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline")}
                onClick={() => onSelect({ label: l.nome, nome: l.match ?? l.nome, campo })}
              >
                {l.nome}
              </TableCell>
              <TableCell className={td("text-right")}>
                {formatCurrency(l.fat)}
                <MrrStatusBar ativo={l.fatAtivo} onboarding={l.fatOnboarding} cancelamento={l.fatCancelamento} />
              </TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{moneyOrDash(l.capFat)}</TableCell>
              <TableCell className={cn("text-right", deltaTone(l.difFat))}>{l.difFat === null ? "—" : formatCurrency(l.difFat)}</TableCell>
              <TableCell className={td("text-right")}>{moneyOrDash(ticket(l.fat, l.contratos))}</TableCell>
              <TableCell className="text-right text-gray-700 dark:text-zinc-300">{pctText(pct(l.fat, fatTime))}</TableCell>
              <TableCell className={td("text-right")}>{l.contratos}</TableCell>
              <TableCell className="text-right text-gray-700 dark:text-zinc-300">{l.contratosRec}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{l.contratosPont}</TableCell>
              <TableCell className={td("text-right")}>{l.clientes}</TableCell>
              <TableCell className="text-right text-gray-700 dark:text-zinc-300">{l.clientesRec}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{l.clientesPont}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(l.capClientes)}</TableCell>
              <TableCell className={cn("text-right", deltaTone(l.difClientes))}>{numOrDash(l.difClientes)}</TableCell>
              <TableCell className="text-right"><UtilBar pct={l.utilFat} /></TableCell>
              <TableCell className="text-right"><UtilBar pct={l.utilClientes} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Mapeadores para a forma normalizada.
function deComercial(r: ComercialRow): Linha {
  return {
    nome: r.nome, match: r.match, fat: r.mrr_atual,
    fatAtivo: r.mrr_ativo, fatOnboarding: r.mrr_onboarding, fatCancelamento: r.mrr_cancelamento,
    capFat: r.cap_mrr, difFat: r.dif_mrr,
    contratos: r.contratos, contratosRec: r.contratos_rec, contratosPont: r.contratos_pont,
    clientes: r.clientes, clientesRec: r.clientes_rec, clientesPont: r.clientes_pont,
    capClientes: r.cap_clientes, difClientes: r.dif_clientes,
    utilFat: r.util_mrr_pct, utilClientes: r.util_clientes_pct,
  };
}
function deSelva(r: SelvaRow): Linha {
  return {
    nome: r.nome, fat: r.faturamento,
    fatAtivo: 0, fatOnboarding: 0, fatCancelamento: 0, // Selva não quebra faturamento por status
    capFat: r.cap_fat, difFat: r.cap_fat === null ? null : r.cap_fat - r.faturamento,
    contratos: r.contratos, contratosRec: r.contratos_rec, contratosPont: r.contratos_pont,
    clientes: r.clientes, clientesRec: r.clientes_rec, clientesPont: r.clientes_pont,
    capClientes: r.cap_clientes, difClientes: r.dif_clientes,
    utilFat: r.util_pct, utilClientes: r.util_clientes_pct,
  };
}
function deCs(r: CsRow): Linha {
  return {
    nome: r.nome, fat: r.mrr_operando,
    fatAtivo: r.mrr_ativo, fatOnboarding: r.mrr_onboarding, fatCancelamento: r.mrr_cancelamento,
    capFat: r.cap_fat, difFat: r.cap_fat === null ? null : r.cap_fat - r.mrr_operando,
    contratos: r.contratos, contratosRec: r.contratos_rec, contratosPont: r.contratos_pont,
    clientes: r.clientes, clientesRec: r.clientes_rec, clientesPont: r.clientes_pont,
    capClientes: r.cap_clientes, difClientes: r.dif_clientes,
    utilFat: r.util_fat_pct, utilClientes: r.util_clientes_pct,
  };
}

// ── Conteúdo das abas ──

function ComercialTab({ title, rows, onSelect, campo }: { title: string; rows: ComercialRow[]; onSelect: (s: DrawerSelecao) => void; campo?: "cs" | "geral" }) {
  const totMrr = sum(rows.map((r) => r.mrr_atual));
  const totContas = sum(rows.map((r) => r.contas_ativas));
  const riscoPct = pct(sum(rows.map((r) => r.mrr_cancelamento)), totMrr);
  const mediaMrr = avgOf(rows.map((r) => r.util_mrr_pct));
  const mediaClientes = avgOf(rows.map((r) => r.util_clientes_pct));
  const cards = [
    { label: "Pessoas", value: String(rows.length) },
    { label: "Contas (total)", value: String(totContas) },
    { label: "Faturamento (R+P)", value: formatCurrency(totMrr) },
    { label: "Ticket médio", value: moneyOrDash(ticket(totMrr, totContas)) },
    { label: "% em risco", value: pctText(riscoPct), tone: riscoTone(riscoPct) },
    { label: "Capacity FAT (média)", value: pctText(mediaMrr), tone: utilColor(mediaMrr) },
    { label: "Capacity Clientes (média)", value: pctText(mediaClientes), tone: utilColor(mediaClientes) },
  ];
  return (
    <div className="space-y-4">
      <StatCards cards={cards} />
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader><CardTitle className="text-gray-900 dark:text-white">{title}</CardTitle></CardHeader>
        <CardContent><CapacityTable linhas={rows.map(deComercial)} onSelect={onSelect} campo={campo} vazio="Ninguém neste grupo ainda (popula automaticamente pelo cargo no RH)." /></CardContent>
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
  const mediaClientes = avgOf(rows.map((r) => r.util_clientes_pct));
  const cards = [
    { label: "Designers", value: String(rows.length) },
    { label: "Com carteira", value: `${comCarteira} / ${rows.length}` },
    { label: "Faturamento (Rec+Pont)", value: formatCurrency(totFaturamento) },
    { label: "Recorrente / Pontual", value: `${formatCurrency(totRec)} · ${formatCurrency(totPont)}` },
    { label: "Ticket médio", value: moneyOrDash(ticket(totFaturamento, totContas)) },
    { label: "Ocupação média", value: pctText(mediaOcup), tone: utilColor(mediaOcup) },
    { label: "Capacity Clientes (média)", value: pctText(mediaClientes), tone: utilColor(mediaClientes) },
  ];
  return (
    <div className="space-y-4">
      <StatCards cards={cards} />
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Selva — Designers</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Carteira pelo responsável da subtask (ClickUp) · Capacity por faturamento (recorrente + pontual) ·
            Cap. (R$) = Ticket Médio da carteira × {metaContas} contas/designer
          </p>
        </CardHeader>
        <CardContent><CapacityTable linhas={rows.map(deSelva)} onSelect={onSelect} vazio="Nenhum designer ativo encontrado no RH." /></CardContent>
      </Card>
    </div>
  );
}

function SquadTab({ group, onSelect }: { group: SquadGroup; onSelect: (s: DrawerSelecao) => void }) {
  const rows = group.rows;
  const totMrr = sum(rows.map((r) => r.mrr_operando));
  const totRec = sum(rows.map((r) => r.op_recorrente));
  const totCancel = sum(rows.map((r) => r.mrr_cancelamento));
  const riscoPct = pct(totCancel, totMrr);
  const mediaFat = avgOf(rows.map((r) => r.util_fat_pct));
  const mediaClientes = avgOf(rows.map((r) => r.util_clientes_pct));
  const cards = [
    { label: "Pessoas", value: String(rows.length) },
    { label: "Recorrente (op / cap)", value: `${totRec} / ${sum(rows.map((r) => r.cap_contratos))}` },
    { label: "MRR Operando", value: formatCurrency(totMrr) },
    { label: "Ticket médio", value: moneyOrDash(ticket(totMrr, totRec)) },
    { label: "% em risco", value: pctText(riscoPct), tone: riscoTone(riscoPct) },
    { label: "Capacity FAT (média)", value: pctText(mediaFat), tone: utilColor(mediaFat) },
    { label: "Capacity Clientes (média)", value: pctText(mediaClientes), tone: utilColor(mediaClientes) },
  ];
  return (
    <div className="space-y-4">
      <StatCards cards={cards} />
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader><CardTitle className="text-gray-900 dark:text-white">Squad {group.squad}</CardTitle></CardHeader>
        <CardContent><CapacityTable linhas={rows.map(deCs)} onSelect={onSelect} vazio="Nenhuma pessoa neste time." /></CardContent>
      </Card>
    </div>
  );
}

function summarizeSquad(g: SquadGroup): TeamSummary {
  const rows = g.rows;
  return {
    time: g.squad,
    pessoas: rows.length,
    operando: sum(rows.map((r) => r.mrr_operando)),
    util_pct: avgOf(rows.map((r) => r.util_fat_pct ?? r.util_contas_pct)),
    cancelamento: sum(rows.map((r) => r.mrr_cancelamento)),
  };
}

function summarizeComercial(time: string, rows: ComercialRow[]): TeamSummary {
  return {
    time,
    pessoas: rows.length,
    operando: sum(rows.map((r) => r.mrr_atual)),
    // usa utilização por FAT; cai p/ contas quando o grupo não tem Cap. FAT configurada (Black)
    util_pct: avgOf(rows.map((r) => r.util_mrr_pct ?? r.util_contas_pct)),
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
  const cxcs = data?.cxcs ?? [];
  const squads = data?.squads ?? [];
  const metaContas = data?.metaContasDesigner ?? 0;

  const teams: TeamSummary[] = [
    ...(SELVA_BLOQUEADA ? [] : [summarizeSelva(selva)]),
    summarizeComercial("Black", black),
    summarizeComercial("Squadra", squadra),
    summarizeComercial("CXCS", cxcs),
    ...squads.map(summarizeSquad),
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
            <TabsTrigger value="cxcs">CXCS ({cxcs.length})</TabsTrigger>
            {squads.map((s) => (
              <TabsTrigger key={s.squad} value={s.squad}>{s.squad} ({s.rows.length})</TabsTrigger>
            ))}
            <TabsTrigger value="__config__">⚙️ Configurar</TabsTrigger>
          </TabsList>

          <TabsContent value="__overview__">
            <Overview teams={teams} />
          </TabsContent>
          <TabsContent value="selva"><SelvaTab rows={selva} metaContas={metaContas} onSelect={setSelecao} /></TabsContent>
          <TabsContent value="black"><ComercialTab title="Black — Accounts" rows={black} onSelect={setSelecao} campo="geral" /></TabsContent>
          <TabsContent value="squadra"><ComercialTab title="Squadra — GPs" rows={squadra} onSelect={setSelecao} /></TabsContent>
          <TabsContent value="cxcs"><ComercialTab title="CXCS — Customer Success" rows={cxcs} onSelect={setSelecao} campo="cs" /></TabsContent>
          {squads.map((s) => (
            <TabsContent key={s.squad} value={s.squad}><SquadTab group={s} onSelect={setSelecao} /></TabsContent>
          ))}
          <TabsContent value="__config__"><CapacityMetasConfig /></TabsContent>
        </Tabs>
      )}

      <OperadorDrawer selecao={selecao} onClose={() => setSelecao(null)} />
    </div>
  );
}

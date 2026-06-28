import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, PartyPopper, Info, DollarSign, Ticket, Target, Banknote, Download, FileText, FileSpreadsheet } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { formatCurrency, formatCurrencyNoDecimals, formatDecimal, formatPercent, cn } from "@/lib/utils";
import { SUMMIT_CAPACITY, SUMMIT_ROAS_ALVO } from "@shared/produtos";

interface PorTipo {
  key: string; label: string; preco: number; precoLiquido: number;
  leads: number; ingressos: number; receitaBruta: number; receitaLiquida: number;
}
interface MetaBlock {
  investimento: number; cpm: number; ctr: number; ctrUnico: number;
  connectRate: number; sessoes: number;
  txConversaoVdP: number | null; txConversaoSessoes: number | null;
  leads: number | null; cpl: number | null;
  carrinhoAbandonado: number | null; vendas: number | null;
  receita: number | null; roas: number | null;
  pctLeadCarrinho: number | null; pctCarrinhoVenda: number | null; taxaConversao: number | null;
}
interface ConsolidadoOrcado {
  investimento: number; leads: number; cpl: number; ingressos: number; cacIngresso: number;
  receitaBruta: number; receitaLiquida: number; ticketMedioLiquido: number;
  roasBruto: number; roasLiquido: number;
}
interface Consolidado {
  investimento: number; leads: number; carrinhoAbandonado: number | null; ingressos: number;
  receitaBruta: number; receitaLiquida: number; cpl: number; cacIngresso: number;
  ticketMedioBruto: number; ticketMedioLiquido: number; roasBruto: number; roasLiquido: number;
  taxaConversao: number;
  orcado?: ConsolidadoOrcado;
}
interface SummitData {
  year: number;
  meta: MetaBlock;
  consolidado: Consolidado;
  porTipo: PorTipo[];
  premissaPreco: { label: string; preco: number; precoLiquido: number }[];
}

const fmtInt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));

// ===== Tabela "Orçado x Realizado" (replica a aba geral) =====
type MetricKind = "flow" | "ratio" | "percent";
type MetricFormat = "currency" | "number" | "percent" | "ratio";
interface OrcRealMetric {
  name: string;
  realizado: number | null;
  orcado: number | null;
  format: MetricFormat;
  kind: MetricKind; // flow = acumula no tempo (pacing); ratio/percent = valor por unidade
  inverted?: boolean; // menor é melhor (CPL, CPA)
  hint?: string;
}
interface OrcRealSection { title: string; metrics: OrcRealMetric[] }
interface Pacing { propDias: number; diasRestantes: number; totalDias: number }

function orcRealFmt(v: number | null, f: MetricFormat): string {
  if (v === null || !isFinite(v)) return "-";
  switch (f) {
    case "currency": return formatCurrency(v);
    case "percent": return `${(v * 100).toFixed(2)}%`;
    case "ratio": return `${formatDecimal(v)}x`;
    case "number": return new Intl.NumberFormat("pt-BR").format(Math.round(v));
    default: return "-";
  }
}

// Fórmulas idênticas à aba Orçado x Realizado.
function calcPercentual(orcado: number | null, realizado: number | null): number | null {
  if (orcado === null || realizado === null || orcado === 0) return null;
  return (realizado / orcado) * 100;
}
function calcDesvioMeta(orcado: number | null, realizado: number | null, propDias: number): number | null {
  if (orcado === null || realizado === null || orcado === 0 || propDias === 0) return null;
  const esperado = orcado * propDias;
  return ((realizado - esperado) / esperado) * 100;
}
function calcPrevisaoAsIs(realizado: number | null, propDias: number): number | null {
  if (realizado === null || propDias === 0) return null;
  return realizado / propDias;
}
function calcRecalculoMeta(orcado: number | null, realizado: number | null, diasRestantes: number, totalDias: number): number | null {
  if (orcado === null || realizado === null || orcado === 0 || totalDias === 0 || diasRestantes <= 0) return null;
  const falta = orcado - realizado;
  if (falta <= 0) return 0;
  const esperadoNoRestante = orcado * (diasRestantes / totalDias);
  if (esperadoNoRestante === 0) return null;
  return (falta / esperadoNoRestante - 1) * 100;
}

// Calcula as 4 colunas derivadas de uma métrica. flow usa pacing no tempo;
// ratio/percent usam comparação simples (não faz sentido projetar run-rate).
function deriveCols(mt: OrcRealMetric, p: Pacing) {
  const isFlow = mt.kind === "flow";
  const perc = calcPercentual(mt.orcado, mt.realizado);
  const desvio = isFlow
    ? calcDesvioMeta(mt.orcado, mt.realizado, p.propDias)
    : (mt.orcado !== null && mt.realizado !== null && mt.orcado !== 0
        ? ((mt.realizado - mt.orcado) / mt.orcado) * 100
        : null);
  const previsao = isFlow ? calcPrevisaoAsIs(mt.realizado, p.propDias) : null;
  const recalculo = isFlow ? calcRecalculoMeta(mt.orcado, mt.realizado, p.diasRestantes, p.totalDias) : null;
  return { perc, desvio, previsao, recalculo };
}

function OrcRealTable({ sections, pacing, plan = true }: { sections: OrcRealSection[]; pacing: Pacing; plan?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Métrica</TableHead>
          <TableHead className="text-right">Orçado</TableHead>
          <TableHead className="text-right">Realizado</TableHead>
          <TableHead className="text-right">% Atingido</TableHead>
          <TableHead className="text-right">Desvio Meta</TableHead>
          <TableHead className="text-right">Previsão As Is</TableHead>
          <TableHead className="text-right">Recálculo Meta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sections.map((section) => (
          <Fragment key={section.title}>
            <TableRow className="bg-muted/50 border-l-4 border-l-primary/40">
              <TableCell colSpan={7} className="text-xs font-semibold uppercase tracking-wide py-2.5 text-muted-foreground">
                {section.title}
              </TableCell>
            </TableRow>
            {section.metrics.map((mt) => {
              const inv = !!mt.inverted;
              // plan=false (ex.: Consolidado sem planejamento): zera toda a parte
              // de orçado/projeção, deixando só o Realizado.
              const { perc, desvio, previsao, recalculo } = plan
                ? deriveCols(mt, pacing)
                : { perc: null, desvio: null, previsao: null, recalculo: null };
              const percColor = perc === null ? "" : inv
                ? (perc <= 100 ? "text-emerald-600 dark:text-emerald-400" : perc <= 120 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")
                : (perc >= 100 ? "text-emerald-600 dark:text-emerald-400" : perc >= 80 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400");
              const barColor = perc === null ? "bg-muted" : inv
                ? (perc <= 100 ? "bg-emerald-500" : perc <= 120 ? "bg-amber-500" : "bg-red-500")
                : (perc >= 100 ? "bg-emerald-500" : perc >= 80 ? "bg-amber-500" : "bg-red-500");
              const desvioColor = desvio === null ? "" : inv
                ? (desvio <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")
                : (desvio >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");
              const recalcColor = recalculo === null ? "" : recalculo <= 0
                ? "text-emerald-600 dark:text-emerald-400" : recalculo <= 30 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
              return (
                <TableRow key={mt.name}>
                  <TableCell className="text-gray-900 dark:text-white">
                    {mt.name}
                    {mt.hint && <span className="ml-2 text-xs text-gray-400 dark:text-zinc-500">({mt.hint})</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-gray-600 dark:text-zinc-400">{plan ? orcRealFmt(mt.orcado, mt.format) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-gray-900 dark:text-white">{orcRealFmt(mt.realizado, mt.format)}</TableCell>
                  <TableCell className={cn("text-right text-sm font-semibold", percColor)}>
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{perc !== null ? `${perc.toFixed(1)}%` : "-"}</span>
                      {perc !== null && (
                        <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(inv ? 200 - perc : perc, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-right text-sm font-semibold", desvioColor)}>
                    {desvio !== null ? `${desvio >= 0 ? "+" : ""}${desvio.toFixed(1)}%` : "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {previsao !== null ? orcRealFmt(previsao, mt.format) : "-"}
                  </TableCell>
                  <TableCell className={cn("text-right text-sm font-semibold", recalcColor)}>
                    {recalculo !== null ? `${recalculo >= 0 ? "+" : ""}${recalculo.toFixed(1)}%` : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

// Export CSV/XLSX com as 7 colunas (mesmo layout da aba geral).
function buildExportRows(sections: OrcRealSection[], pacing: Pacing, mode: "csv" | "xlsx", plan: boolean) {
  const header = ["Métrica", "Orçado", "Realizado", "% Atingido", "Desvio Meta", "Previsão As Is", "Recálculo Meta"];
  const rows: (string | number | null)[][] = [];
  const dash = mode === "csv" ? "-" : null;
  const num = (v: number | null, f: MetricFormat) =>
    v === null || !isFinite(v) ? dash : mode === "xlsx" ? v : orcRealFmt(v, f);
  const sig = (v: number | null) =>
    v === null ? dash : mode === "xlsx" ? v / 100 : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  const plain = (v: number | null) =>
    v === null ? dash : mode === "xlsx" ? v / 100 : `${v.toFixed(1)}%`;
  for (const s of sections) {
    rows.push([s.title, "", "", "", "", "", ""]);
    for (const mt of s.metrics) {
      const { perc, desvio, previsao, recalculo } = plan
        ? deriveCols(mt, pacing)
        : { perc: null, desvio: null, previsao: null, recalculo: null };
      rows.push([mt.name, plan ? num(mt.orcado, mt.format) : dash, num(mt.realizado, mt.format), plain(perc), sig(desvio), num(previsao, mt.format), sig(recalculo)]);
    }
    rows.push([]);
  }
  return { header, rows };
}
function exportCSV(sections: OrcRealSection[], pacing: Pacing, label: string, plan = true) {
  const { header, rows } = buildExportRows(sections, pacing, "csv", plan);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c ?? ""}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CreatorSummit_OrcadoRealizado_${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
async function exportXLSX(sections: OrcRealSection[], pacing: Pacing, label: string, plan = true) {
  const XLSX = await import("xlsx");
  const { header, rows } = buildExportRows(sections, pacing, "xlsx", plan);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [{ wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Consolidado");
  XLSX.writeFile(wb, `CreatorSummit_OrcadoRealizado_${label}.xlsx`);
}

export default function GrowthCreatorSummit() {
  usePageTitle("Creator Summit");
  useSetPageInfo("Creator Summit", "Funil do evento (pipeline de Eventos) — Meta Ads e consolidado");

  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading, error } = useQuery<SummitData>({
    queryKey: ["/api/growth/creator-summit", year],
    queryFn: async () => {
      const r = await fetch(`/api/growth/creator-summit?year=${year}`);
      if (!r.ok) throw new Error("Falha ao carregar dados do Creator Summit");
      return r.json();
    },
  });

  const years = [year - 1, year, year + 1].filter((y, i, a) => a.indexOf(y) === i);

  const m = data?.meta;
  const cons = data?.consolidado;

  const custoVenda = m && m.vendas ? m.investimento / m.vendas : null;
  const custoCarrinho = m && m.carrinhoAbandonado ? m.investimento / m.carrinhoAbandonado : null;

  // Projeção "esgotar o evento (330 ingressos) a ROAS 1": de trás pra frente,
  // o funil e o investimento necessários, usando as taxas de conversão atuais.
  const proj =
    m && m.taxaConversao && m.pctCarrinhoVenda
      ? (() => {
          const ingressos = SUMMIT_CAPACITY.reduce((s, c) => s + c.total, 0);
          const receita = SUMMIT_CAPACITY.reduce((s, c) => s + c.total * c.precoLiquido, 0);
          const invest = receita / SUMMIT_ROAS_ALVO; // ROAS 1 → investimento = receita
          const leads = ingressos / (m.taxaConversao! / 100);
          const carrinho = ingressos / (m.pctCarrinhoVenda! / 100);
          return {
            ingressos, receita, invest, leads, carrinho,
            cac: invest / ingressos,
            cpl: invest / leads,
            custoCarrinho: invest / carrinho,
            roas: SUMMIT_ROAS_ALVO,
          };
        })()
      : null;

  // percent-fração: o bloco Meta guarda % já multiplicado (1,08 = 1,08%);
  // a OrcRealTable espera fração (0,0108). Converte (preserva null = pendente).
  const pf = (v: number | null) => (v == null ? null : v / 100);
  const metaOrcRealSections: OrcRealSection[] = m
    ? [
        {
          title: "Mídia",
          metrics: [
            { name: "Investimento", realizado: m.investimento, orcado: proj?.invest ?? null, format: "currency", kind: "flow" },
            { name: "CPM", realizado: m.cpm, orcado: null, format: "currency", kind: "ratio" },
            { name: "CTR de saída", realizado: pf(m.ctr), orcado: null, format: "percent", kind: "percent" },
            { name: "CTR de saída único", realizado: pf(m.ctrUnico), orcado: null, format: "percent", kind: "percent" },
            { name: "Connect Rate", realizado: pf(m.connectRate), orcado: null, format: "percent", kind: "percent", hint: "VdP ÷ cliques de saída" },
            { name: "Sessões", realizado: m.sessoes, orcado: null, format: "number", kind: "flow", hint: "GA4" },
            { name: "Tx conversão de página (por VdP)", realizado: pf(m.txConversaoVdP), orcado: null, format: "percent", kind: "percent", hint: "leads ÷ VdP" },
            { name: "Tx conversão de página (por sessões)", realizado: pf(m.txConversaoSessoes), orcado: null, format: "percent", kind: "percent", hint: "leads ÷ sessões" },
          ],
        },
        {
          title: "Funil (atribuição do pixel)",
          metrics: [
            { name: "Leads", realizado: m.leads, orcado: proj?.leads ?? null, format: "number", kind: "flow", hint: "evento Lead - Summit ES" },
            { name: "Custo por lead", realizado: m.cpl, orcado: proj?.cpl ?? null, format: "currency", kind: "ratio", inverted: true },
            { name: "% Lead → Carrinho", realizado: pf(m.pctLeadCarrinho), orcado: null, format: "percent", kind: "percent" },
            { name: "Carrinho abandonado", realizado: m.carrinhoAbandonado, orcado: proj?.carrinho ?? null, format: "number", kind: "flow", hint: "InitiateCheckout" },
            { name: "Custo por carrinho abandonado", realizado: custoCarrinho, orcado: proj?.custoCarrinho ?? null, format: "currency", kind: "ratio", inverted: true },
            { name: "% Carrinho → Venda", realizado: pf(m.pctCarrinhoVenda), orcado: null, format: "percent", kind: "percent" },
            { name: "Vendas", realizado: m.vendas, orcado: proj?.ingressos ?? null, format: "number", kind: "flow", hint: "Compra - Creators Summit ES" },
            { name: "Custo por venda", realizado: custoVenda, orcado: proj?.cac ?? null, format: "currency", kind: "ratio", inverted: true },
            { name: "Taxa de conversão (Lead → Venda)", realizado: pf(m.taxaConversao), orcado: null, format: "percent", kind: "percent" },
            { name: "Receita", realizado: m.receita, orcado: proj?.receita ?? null, format: "currency", kind: "flow" },
            { name: "ROAS", realizado: m.roas, orcado: proj?.roas ?? null, format: "ratio", kind: "ratio" },
          ],
        },
      ]
    : [];

  const co = cons?.orcado;

  // Pacing no tempo (fração do ANO decorrida) — base das colunas Desvio/Previsão/Recálculo.
  const pacing: Pacing = (() => {
    const today = new Date();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const totalDias = differenceInCalendarDays(end, start) + 1;
    const elapsed = Math.min(Math.max(differenceInCalendarDays(today, start) + 1, 0), totalDias);
    return { propDias: totalDias > 0 ? elapsed / totalDias : 0, diasRestantes: Math.max(totalDias - elapsed, 0), totalDias };
  })();

  // KPIs do topo (sempre o consolidado) — só o valor realizado.
  const kpiCards = cons
    ? [
        { label: "Investimento", icon: DollarSign, value: formatCurrencyNoDecimals(cons.investimento) },
        { label: "Ingressos", icon: Ticket, value: fmtInt(cons.ingressos) },
        { label: "CPA", icon: Target, value: formatCurrency(cons.cacIngresso) },
        { label: "Faturamento", icon: Banknote, value: formatCurrencyNoDecimals(cons.receitaBruta) },
      ]
    : [];
  // Tabela Orçado x Realizado do consolidado (7 colunas, igual à aba geral).
  // kind: flow = acumula no tempo (pacing aplicável); ratio/percent = valor por
  // unidade (Previsão/Recálculo não se aplicam → "-").
  const orcRealSections: OrcRealSection[] = cons
    ? [
        {
          title: "Marketing",
          metrics: [
            { name: "Investimento", realizado: cons.investimento, orcado: co?.investimento ?? null, format: "currency", kind: "flow" },
            { name: "Leads", realizado: cons.leads, orcado: co?.leads ?? null, format: "number", kind: "flow" },
            { name: "CPL", realizado: cons.cpl, orcado: co?.cpl ?? null, format: "currency", kind: "ratio", inverted: true },
          ],
        },
        {
          title: "Conversão",
          metrics: [
            { name: "Ingressos vendidos", realizado: cons.ingressos, orcado: co?.ingressos ?? null, format: "number", kind: "flow" },
            { name: "Taxa de conversão (Lead → Ingresso)", realizado: cons.taxaConversao, orcado: null, format: "percent", kind: "percent" },
            { name: "CPA", realizado: cons.cacIngresso, orcado: co?.cacIngresso ?? null, format: "currency", kind: "ratio", inverted: true, hint: "custo por ingresso" },
          ],
        },
        {
          title: "Receita",
          metrics: [
            { name: "Receita bruta", realizado: cons.receitaBruta, orcado: co?.receitaBruta ?? null, format: "currency", kind: "flow", hint: "valor do comprador" },
            { name: "Receita líquida", realizado: cons.receitaLiquida, orcado: co?.receitaLiquida ?? null, format: "currency", kind: "flow", hint: "após taxa Sympla" },
            { name: "Ticket médio líquido", realizado: cons.ticketMedioLiquido, orcado: co?.ticketMedioLiquido ?? null, format: "currency", kind: "ratio" },
            { name: "ROAS bruto", realizado: cons.roasBruto, orcado: co?.roasBruto ?? null, format: "ratio", kind: "ratio" },
            { name: "ROAS líquido", realizado: cons.roasLiquido, orcado: co?.roasLiquido ?? null, format: "ratio", kind: "ratio" },
          ],
        },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-fuchsia-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Creator Summit</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300">
            Pipeline de Eventos
          </span>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-gray-500 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
        </div>
      )}

      {error && (
        <Card className="border-red-300 dark:border-red-800">
          <CardContent className="p-4 text-red-600 dark:text-red-400">
            Erro ao carregar dados. Tente novamente.
          </CardContent>
        </Card>
      )}

      {data && m && cons && (
        <>
          {/* KPIs do topo (consolidado) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpiCards.map((k) => {
              const Icon = k.icon;
              return (
                <Card key={k.label} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">{k.label}</span>
                      <Icon className="h-4 w-4 text-fuchsia-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{k.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Tabs defaultValue="consolidado">
            <TabsList>
              <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
              <TabsTrigger value="meta">Meta Ads</TabsTrigger>
            </TabsList>

            {/* ---- Consolidado ---- */}
            <TabsContent value="consolidado" className="space-y-6 mt-4">
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Métricas — {data.year} (todos os canais)</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-4 h-4" /> Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => exportCSV(orcRealSections, pacing, String(data.year), false)} className="gap-2 cursor-pointer">
                        <FileText className="w-4 h-4" /> Exportar CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportXLSX(orcRealSections, pacing, String(data.year), false)} className="gap-2 cursor-pointer">
                        <FileSpreadsheet className="w-4 h-4" /> Exportar Excel (.xlsx)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="overflow-x-auto"><OrcRealTable sections={orcRealSections} pacing={pacing} plan={false} /></CardContent>
              </Card>

              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Por tipo de ingresso</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Preço líq.</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Ingressos</TableHead>
                        <TableHead className="text-right">Conversão</TableHead>
                        <TableHead className="text-right">Receita líq.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.porTipo.map((t) => (
                        <TableRow key={t.key}>
                          <TableCell className="font-medium text-gray-900 dark:text-white">{t.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(t.precoLiquido)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(t.leads)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtInt(t.ingressos)}</TableCell>
                          <TableCell className="text-right tabular-nums">{t.leads > 0 ? formatPercent((t.ingressos / t.leads) * 100) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrencyNoDecimals(t.receitaLiquida)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 border-gray-300 dark:border-zinc-600 font-semibold">
                        <TableCell className="text-gray-900 dark:text-white">Total</TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums">{fmtInt(cons.leads)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(cons.ingressos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPercent(cons.taxaConversao * 100)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrencyNoDecimals(cons.receitaLiquida)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- Meta Ads ---- */}
            <TabsContent value="meta" className="space-y-6 mt-4">
              <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Métricas Meta Ads — {data.year}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-4 h-4" /> Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => exportCSV(metaOrcRealSections, pacing, `${data.year}_MetaAds`)} className="gap-2 cursor-pointer">
                        <FileText className="w-4 h-4" /> Exportar CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportXLSX(metaOrcRealSections, pacing, `${data.year}_MetaAds`)} className="gap-2 cursor-pointer">
                        <FileSpreadsheet className="w-4 h-4" /> Exportar Excel (.xlsx)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="overflow-x-auto"><OrcRealTable sections={metaOrcRealSections} pacing={pacing} /></CardContent>
              </Card>

              <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-zinc-400 px-1 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                <span>
                  <strong>Orçado = esgotar o evento a ROAS 1.</strong> Projeta o funil pra vender os 330 ingressos
                  (300 PASS + 30 VIP = R$ 161.109 líquidos), com investimento = receita (ROAS 1) e as taxas de conversão
                  atuais. Como cada VIP rende R$ 2.697 líquido, o custo por venda que ainda dá break-even é alto
                  (~R$ 488) — acima do seu CAC atual. Ou seja: <strong>no ritmo de eficiência de hoje, o gargalo pra
                  estourar o ROAS é volume de vendas, não custo.</strong>
                </span>
              </div>

              <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-zinc-500 px-1">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Tudo aqui é atribuição do Meta: mídia/sessões das campanhas com "summit" no nome (sessões via GA4),
                  carrinho = evento InitiateCheckout e vendas = conversão personalizada do pixel ("Compra - Creators
                  Summit ES"). Por isso difere da aba Consolidado, que conta todas as {data.consolidado.ingressos} vendas
                  (incl. as sem rastro de canal, via Bitrix).
                </span>
              </div>
            </TabsContent>
          </Tabs>

          {/* Premissa de receita */}
          <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-zinc-500 px-1">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Receita por preço tabelado do ingresso —{" "}
              {data.premissaPreco.map((p, i) => (
                <span key={p.label}>
                  {i > 0 && " · "}{p.label} {formatCurrency(p.preco)} bruto / {formatCurrency(p.precoLiquido)} líq.
                </span>
              ))}
              . Ingressos sem tipo identificado usam o preço PASS.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useMemo, Fragment } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, Megaphone, Users, UserCheck, Wallet, ChevronDown, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const EXPORT_ALLOWED_EMAILS = new Set([
  "vinicius.ichino@turbopartners.com.br",
  "ferramentas@turbopartners.com.br",
]);
import { PLATFORM_MULTISELECT_OPTIONS, PLATFORM_TO_UTM } from "@/lib/metasBudgetConfig";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";

type MetricFormat = "currency" | "number" | "percent";
type SectionKey = "marketing" | "mql" | "nao-mql" | "total";

const SECTION_META: Record<SectionKey, { title: string; icon: React.ReactNode }> = {
  marketing: { title: "Métricas de Marketing", icon: <Megaphone className="h-4 w-4" /> },
  mql: { title: "Vendas — MQL", icon: <UserCheck className="h-4 w-4" /> },
  "nao-mql": { title: "Vendas — Não-MQL", icon: <Users className="h-4 w-4" /> },
  total: { title: "Total", icon: <Wallet className="h-4 w-4" /> },
};

const SECTION_ORDER: SectionKey[] = ["marketing", "mql", "nao-mql", "total"];

interface MqlData {
  totalMqls: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  novosClientes: number;
  contratosAceleracao: number;
  contratosImplantacao: number;
  faturamentoAceleracao: number;
  faturamentoImplantacao: number;
  percReuniaoAgendada: number;
  percNoShow: number;
  taxaVendas: number;
  txContratosRecorrentes: number;
  txContratosImplantacao: number;
  ticketMedioAceleracao: number;
  ticketMedioImplantacao: number;
  dealsGanhos: number;
  contratosGanhos: number;
}
interface NaoMqlData extends Omit<MqlData, "totalMqls"> { totalNaoMqls: number }
interface AdsData {
  investimento: number;
  impressoes: number;
  cliques: number;
  cliquesSaida: number;
  cpm: number;
  ctr: number;
  ctrUnico: number | null;
  ctrUnicoAvailable?: boolean;
  connectRate: number;
  visualizacoesPagina: number;
  sessoes: number;
  leads: number;
  mqls: number;
  cpl: number;
  cpmql: number;
  percMqls: number;
}

interface MonthBucket {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  monthIdx: number;
}

interface WeekBucket {
  key: string;           // "2026-W23"
  label: string;         // "S23"
  tooltip: string;       // "01/06 - 07/06"
  startDate: string;
  endDate: string;
  parentMonthKey: string; // "2026-06"
}

function buildMonthBuckets(year: number): MonthBucket[] {
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const out: MonthBucket[] = [];
  for (let m = 0; m < 12; m++) {
    const mm = String(m + 1).padStart(2, "0");
    const lastDay = new Date(year, m + 1, 0).getDate();
    out.push({
      key: `${year}-${mm}`,
      label: `${names[m]}/${String(year).slice(2)}`,
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
      monthIdx: m,
    });
  }
  return out;
}

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNum };
}

function isoWeekStart(isoYear: number, isoWeek: number): Date {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7);
  return target;
}

function formatDayMonth(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildWeekBucketsForMonth(year: number, monthIdx: number): WeekBucket[] {
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const weeksMap = new Map<string, WeekBucket>();
  const parentMonthKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(Date.UTC(year, monthIdx, day));
    const { year: iy, week: iw } = getISOWeek(d);
    const key = `${iy}-W${String(iw).padStart(2, "0")}`;
    if (!weeksMap.has(key)) {
      const monday = isoWeekStart(iy, iw);
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      weeksMap.set(key, {
        key,
        label: `S${iw}`,
        tooltip: `${formatDayMonth(monday)} - ${formatDayMonth(sunday)}`,
        startDate: monday.toISOString().slice(0, 10),
        endDate: sunday.toISOString().slice(0, 10),
        parentMonthKey,
      });
    }
  }
  return Array.from(weeksMap.values());
}

function businessDaysInMonth(year: number, monthIdx: number): number {
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day++) {
    const dow = new Date(Date.UTC(year, monthIdx, day)).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function prorateBudgetToWeek(
  budgetsYear: Record<string, BudgetMonth> | undefined,
  week: WeekBucket,
  extract: (b: BudgetMonth) => number | null,
): number | null {
  if (!budgetsYear) return null;
  const start = new Date(week.startDate + "T00:00:00Z");
  const end = new Date(week.endDate + "T00:00:00Z");
  const monthContribution = new Map<string, number>();
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const mkey = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      monthContribution.set(mkey, (monthContribution.get(mkey) || 0) + 1);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  let sum = 0;
  let anyContribution = false;
  for (const [mkey, weekDays] of monthContribution) {
    const b = budgetsYear[mkey];
    if (!b) continue;
    const monthBudget = extract(b);
    if (monthBudget === null || monthBudget === undefined) continue;
    const [y, m] = mkey.split("-").map(Number);
    const totalBizDays = businessDaysInMonth(y, m - 1);
    if (totalBizDays === 0) continue;
    sum += monthBudget * (weekDays / totalBizDays);
    anyContribution = true;
  }
  return anyContribution ? sum : null;
}

function formatValue(value: number | null, format: MetricFormat): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "number":
      return new Intl.NumberFormat("pt-BR").format(Math.round(value));
  }
}

function percColor(pct: number | null, inverted = false): string {
  if (pct === null) return "";
  if (inverted) {
    if (pct <= 100) return "text-emerald-600 dark:text-emerald-400";
    if (pct <= 120) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }
  if (pct >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

interface MetricDef {
  id: string;
  name: string;
  format: MetricFormat;
  section: SectionKey;
  inverted?: boolean;
  sub?: boolean;
  realizado: (d: { mql?: MqlData; naoMql?: NaoMqlData; ads?: AdsData }) => number | null;
  orcado: (b: BudgetMonth) => number | null;
}

type BudgetMonth = Record<string, any>;

function safeDiv(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

const METRIC_DEFS: MetricDef[] = [
  // ===== Marketing / Ads =====
  { id: "ads_investimento", name: "Investimento", format: "currency", section: "marketing",
    realizado: ({ ads }) => ads?.investimento ?? null,
    orcado: (b) => b.marketing?.investimento ?? null },
  { id: "ads_cpm", name: "CPM", format: "currency", section: "marketing", inverted: true,
    realizado: ({ ads }) => ads?.cpm ?? null,
    orcado: (b) => b.marketing?.cpm ?? null },
  { id: "ads_ctr", name: "CTR de saída", format: "percent", section: "marketing",
    realizado: ({ ads }) => ads?.ctr ?? null,
    orcado: (b) => b.marketing?.ctr ?? null },
  // CTR de saída único (cliques de saída únicos / alcance) — só o Meta expõe; no
  // consolidado só é definível quando Meta é a única fonte paga (senão "—"). Sem orçado.
  { id: "ads_ctr_unico", name: "CTR de saída único", format: "percent", section: "marketing",
    realizado: ({ ads }) => ads?.ctrUnico ?? null,
    orcado: () => null },
  { id: "ads_impressoes", name: "Impressões", format: "number", section: "marketing",
    realizado: ({ ads }) => ads?.impressoes ?? null,
    orcado: (b) => b.marketing?.impressoes ?? null },
  { id: "ads_visualizacoes_pagina", name: "Visualizações de Página", format: "number", section: "marketing",
    realizado: ({ ads }) => ads?.visualizacoesPagina ?? null,
    orcado: (b) => b.marketing?.visualizacoesPagina ?? null },
  { id: "ads_sessoes", name: "Sessões", format: "number", section: "marketing",
    realizado: ({ ads }) => ads?.sessoes ?? null,
    orcado: (b) => b.marketing?.sessoes ?? null },
  { id: "ads_taxa_conversao_pagina", name: "Tx Conversão da Página", format: "percent", section: "marketing",
    realizado: ({ ads }) => {
      if (!ads) return null;
      return ads.visualizacoesPagina > 0 ? ads.leads / ads.visualizacoesPagina : 0;
    },
    orcado: (b) => b.marketing?.taxaConversaoPagina ?? null },
  { id: "ads_taxa_conversao_pagina_mql", name: "MQL", format: "percent", section: "marketing", sub: true,
    realizado: ({ ads }) => (ads && ads.visualizacoesPagina > 0 ? ads.mqls / ads.visualizacoesPagina : null),
    orcado: () => null },
  { id: "ads_taxa_conversao_pagina_nmql", name: "Não-MQL", format: "percent", section: "marketing", sub: true,
    realizado: ({ ads }) => (ads && ads.visualizacoesPagina > 0 ? (ads.leads - ads.mqls) / ads.visualizacoesPagina : null),
    orcado: () => null },
  // Conversão por Sessões (GA4): denominador = sessões em vez de visualizações de
  // página. Sem alvo orçado (não há taxaConversaoSessoes no budget). null quando não
  // há sessões (GA4 indisponível) — evita exibir 0% falso.
  { id: "ads_taxa_conversao_sessoes", name: "Tx Conversão de Sessões", format: "percent", section: "marketing",
    realizado: ({ ads }) => (ads && ads.sessoes > 0 ? ads.leads / ads.sessoes : null),
    orcado: () => null },
  { id: "ads_taxa_conversao_sessoes_mql", name: "MQL", format: "percent", section: "marketing", sub: true,
    realizado: ({ ads }) => (ads && ads.sessoes > 0 ? ads.mqls / ads.sessoes : null),
    orcado: () => null },
  { id: "ads_taxa_conversao_sessoes_nmql", name: "Não-MQL", format: "percent", section: "marketing", sub: true,
    realizado: ({ ads }) => (ads && ads.sessoes > 0 ? (ads.leads - ads.mqls) / ads.sessoes : null),
    orcado: () => null },
  { id: "ads_connect_rate", name: "Connect Rate", format: "percent", section: "marketing",
    realizado: ({ ads }) => ads?.connectRate ?? null,
    orcado: (b) => b.marketing?.connectRate ?? null },
  { id: "ads_leads", name: "Leads", format: "number", section: "marketing",
    realizado: ({ ads }) => ads?.leads ?? null,
    orcado: (b) => b.marketing?.leads ?? null },
  { id: "ads_mqls", name: "MQLs", format: "number", section: "marketing",
    realizado: ({ ads }) => ads?.mqls ?? null,
    orcado: (b) => b.marketing?.mqls ?? null },
  { id: "ads_cpl", name: "CPL", format: "currency", section: "marketing", inverted: true,
    realizado: ({ ads }) => ads?.cpl ?? null,
    orcado: (b) => b.marketing?.cpl ?? null },
  { id: "ads_cpmql", name: "CPMQL", format: "currency", section: "marketing", inverted: true,
    realizado: ({ ads }) => ads?.cpmql ?? null,
    orcado: (b) => b.marketing?.cpmql ?? null },
  { id: "ads_perc_mqls", name: "% MQLs", format: "percent", section: "marketing",
    realizado: ({ ads }) => ads?.percMqls ?? null,
    orcado: (b) => b.marketing?.percMqls ?? null },

  // ===== MQL =====
  { id: "mql_total", name: "Total MQLs", format: "number", section: "mql",
    realizado: ({ mql }) => mql?.totalMqls ?? null,
    orcado: (b) => b.mql?.totalMqls ?? null },
  { id: "mql_ra_perc", name: "% RA MQL", format: "percent", section: "mql",
    realizado: ({ mql }) => mql?.percReuniaoAgendada ?? null,
    orcado: (b) => b.mql?.percReuniaoAgendada ?? null },
  { id: "mql_ra_num", name: "Nº RA MQL", format: "number", section: "mql",
    realizado: ({ mql }) => mql?.reunioesAgendadas ?? null,
    orcado: (b) => b.mql?.reunioesAgendadas ?? null },
  { id: "mql_rr_num", name: "Nº RR MQL", format: "number", section: "mql",
    realizado: ({ mql }) => mql?.reunioesRealizadas ?? null,
    orcado: (b) => b.mql?.reunioesRealizadas ?? null },
  { id: "mql_noshow", name: "% No-Show MQL", format: "percent", section: "mql", inverted: true,
    realizado: ({ mql }) => mql?.percNoShow ?? null,
    orcado: (b) => b.mql?.percNoShow ?? null },
  { id: "mql_rr_perc", name: "% RR MQL", format: "percent", section: "mql",
    realizado: ({ mql }) => mql ? safeDiv(mql.reunioesRealizadas, mql.totalMqls) : null,
    orcado: (b) => b.mql?.percRr ?? null },
  { id: "mql_taxa_vendas", name: "Taxa Vendas MQL", format: "percent", section: "mql",
    realizado: ({ mql }) => mql?.taxaVendas ?? null,
    orcado: (b) => b.mql?.taxaVendas ?? null },
  { id: "mql_novos_clientes", name: "Novos Clientes MQL", format: "number", section: "mql",
    realizado: ({ mql }) => mql?.novosClientes ?? null,
    orcado: (b) => b.mql?.novosClientes ?? null },
  { id: "mql_tx_recorrente", name: "Tx Recorrente MQL", format: "percent", section: "mql",
    realizado: ({ mql }) => mql?.txContratosRecorrentes ?? null,
    orcado: (b) => b.mql?.txContratosRecorrentes ?? null },
  { id: "mql_tx_implantacao", name: "Tx Implantação MQL", format: "percent", section: "mql",
    realizado: ({ mql }) => mql?.txContratosImplantacao ?? null,
    orcado: (b) => b.mql?.txContratosImplantacao ?? null },
  { id: "mql_contratos_acel", name: "Contratos Aceleração MQL", format: "number", section: "mql",
    realizado: ({ mql }) => mql?.contratosAceleracao ?? null,
    orcado: (b) => b.mql?.contratosAceleracao ?? null },
  { id: "mql_ticket_acel", name: "Ticket Médio Aceleração MQL", format: "currency", section: "mql",
    realizado: ({ mql }) => mql?.ticketMedioAceleracao ?? null,
    orcado: (b) => b.mql?.ticketMedioAceleracao ?? null },
  { id: "mql_fat_acel", name: "Faturamento Aceleração MQL", format: "currency", section: "mql",
    realizado: ({ mql }) => mql?.faturamentoAceleracao ?? null,
    orcado: (b) => b.mql?.faturamentoAceleracao ?? null },
  { id: "mql_contratos_impl", name: "Contratos Implantação MQL", format: "number", section: "mql",
    realizado: ({ mql }) => mql?.contratosImplantacao ?? null,
    orcado: (b) => b.mql?.contratosImplantacao ?? null },
  { id: "mql_ticket_impl", name: "Ticket Médio Implantação MQL", format: "currency", section: "mql",
    realizado: ({ mql }) => mql?.ticketMedioImplantacao ?? null,
    orcado: (b) => b.mql?.ticketMedioImplantacao ?? null },
  { id: "mql_fat_impl", name: "Faturamento Implantação MQL", format: "currency", section: "mql",
    realizado: ({ mql }) => mql?.faturamentoImplantacao ?? null,
    orcado: (b) => b.mql?.faturamentoImplantacao ?? null },

  // ===== Não-MQL =====
  { id: "nmql_total", name: "Total Não-MQLs", format: "number", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.totalNaoMqls ?? null,
    orcado: (b) => b["nao-mql"]?.totalNaoMqls ?? null },
  { id: "nmql_ra_perc", name: "% RA Não-MQL", format: "percent", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.percReuniaoAgendada ?? null,
    orcado: (b) => b["nao-mql"]?.percReuniaoAgendada ?? null },
  { id: "nmql_ra_num", name: "Nº RA Não-MQL", format: "number", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.reunioesAgendadas ?? null,
    orcado: (b) => b["nao-mql"]?.reunioesAgendadas ?? null },
  { id: "nmql_rr_num", name: "Nº RR Não-MQL", format: "number", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.reunioesRealizadas ?? null,
    orcado: (b) => b["nao-mql"]?.reunioesRealizadas ?? null },
  { id: "nmql_noshow", name: "% No-Show Não-MQL", format: "percent", section: "nao-mql", inverted: true,
    realizado: ({ naoMql }) => naoMql?.percNoShow ?? null,
    orcado: (b) => b["nao-mql"]?.percNoShow ?? null },
  { id: "nmql_rr_perc", name: "% RR Não-MQL", format: "percent", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql ? safeDiv(naoMql.reunioesRealizadas, naoMql.totalNaoMqls) : null,
    orcado: (b) => b["nao-mql"]?.percRr ?? null },
  { id: "nmql_taxa_vendas", name: "Taxa Vendas Não-MQL", format: "percent", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.taxaVendas ?? null,
    orcado: (b) => b["nao-mql"]?.taxaVendas ?? null },
  { id: "nmql_novos_clientes", name: "Novos Clientes Não-MQL", format: "number", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.novosClientes ?? null,
    orcado: (b) => b["nao-mql"]?.novosClientes ?? null },
  { id: "nmql_tx_recorrente", name: "Tx Recorrente Não-MQL", format: "percent", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.txContratosRecorrentes ?? null,
    orcado: (b) => b["nao-mql"]?.txContratosRecorrentes ?? null },
  { id: "nmql_tx_implantacao", name: "Tx Implantação Não-MQL", format: "percent", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.txContratosImplantacao ?? null,
    orcado: (b) => b["nao-mql"]?.txContratosImplantacao ?? null },
  { id: "nmql_contratos_acel", name: "Contratos Aceleração Não-MQL", format: "number", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.contratosAceleracao ?? null,
    orcado: (b) => b["nao-mql"]?.contratosAceleracao ?? null },
  { id: "nmql_ticket_acel", name: "Ticket Médio Aceleração Não-MQL", format: "currency", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.ticketMedioAceleracao ?? null,
    orcado: (b) => b["nao-mql"]?.ticketMedioAceleracao ?? null },
  { id: "nmql_fat_acel", name: "Faturamento Aceleração Não-MQL", format: "currency", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.faturamentoAceleracao ?? null,
    orcado: (b) => b["nao-mql"]?.faturamentoAceleracao ?? null },
  { id: "nmql_contratos_impl", name: "Contratos Implantação Não-MQL", format: "number", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.contratosImplantacao ?? null,
    orcado: (b) => b["nao-mql"]?.contratosImplantacao ?? null },
  { id: "nmql_ticket_impl", name: "Ticket Médio Implantação Não-MQL", format: "currency", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.ticketMedioImplantacao ?? null,
    orcado: (b) => b["nao-mql"]?.ticketMedioImplantacao ?? null },
  { id: "nmql_fat_impl", name: "Faturamento Implantação Não-MQL", format: "currency", section: "nao-mql",
    realizado: ({ naoMql }) => naoMql?.faturamentoImplantacao ?? null,
    orcado: (b) => b["nao-mql"]?.faturamentoImplantacao ?? null },

  // ===== Total =====
  { id: "total_perc_ra", name: "% RA", format: "percent", section: "total",
    realizado: ({ mql, naoMql }) => {
      const leads = (mql?.totalMqls ?? 0) + (naoMql?.totalNaoMqls ?? 0);
      const ra = (mql?.reunioesAgendadas ?? 0) + (naoMql?.reunioesAgendadas ?? 0);
      return leads > 0 ? ra / leads : null;
    },
    orcado: (b) => b.total?.percRA ?? null },
  { id: "total_ra", name: "RA", format: "number", section: "total",
    realizado: ({ mql, naoMql }) => (mql?.reunioesAgendadas ?? 0) + (naoMql?.reunioesAgendadas ?? 0),
    orcado: (b) => b.total?.reunioesAgendadas ?? null },
  { id: "total_rr", name: "RR", format: "number", section: "total",
    realizado: ({ mql, naoMql }) => (mql?.reunioesRealizadas ?? 0) + (naoMql?.reunioesRealizadas ?? 0),
    orcado: (b) => b.total?.reunioesRealizadas ?? null },
  { id: "total_noshow", name: "No show", format: "percent", section: "total", inverted: true,
    realizado: ({ mql, naoMql }) => {
      const ra = (mql?.reunioesAgendadas ?? 0) + (naoMql?.reunioesAgendadas ?? 0);
      const rr = (mql?.reunioesRealizadas ?? 0) + (naoMql?.reunioesRealizadas ?? 0);
      return ra > 0 ? (ra - rr) / ra : null;
    },
    orcado: (b) => b.total?.percNoShow ?? null },
  { id: "total_perc_rr", name: "% RR", format: "percent", section: "total",
    realizado: ({ mql, naoMql }) => {
      const leads = (mql?.totalMqls ?? 0) + (naoMql?.totalNaoMqls ?? 0);
      const rr = (mql?.reunioesRealizadas ?? 0) + (naoMql?.reunioesRealizadas ?? 0);
      return leads > 0 ? rr / leads : null;
    },
    orcado: (b) => b.total?.percRr ?? null },
  { id: "total_conv_rrv", name: "RR→V%", format: "percent", section: "total",
    realizado: ({ mql, naoMql }) => {
      const rr = (mql?.reunioesRealizadas ?? 0) + (naoMql?.reunioesRealizadas ?? 0);
      const deals = (mql?.dealsGanhos ?? 0) + (naoMql?.dealsGanhos ?? 0);
      return rr > 0 ? deals / rr : null;
    },
    orcado: (b) => b.total?.percConversaoRRV ?? null },
  { id: "total_novos_clientes", name: "Negócios Ganhos", format: "number", section: "total",
    realizado: ({ mql, naoMql }) => (mql?.dealsGanhos ?? 0) + (naoMql?.dealsGanhos ?? 0),
    orcado: (b) => b.total?.novosClientes ?? null },
  { id: "total_contratos_ganhos", name: "Contratos Ganhos", format: "number", section: "total",
    realizado: ({ mql, naoMql }) => (mql?.contratosGanhos ?? 0) + (naoMql?.contratosGanhos ?? 0),
    orcado: () => null },
  { id: "total_ganhos_acel", name: "Negócios Ganhos Aceleração", format: "number", section: "total",
    realizado: ({ mql, naoMql }) => (mql?.contratosAceleracao ?? 0) + (naoMql?.contratosAceleracao ?? 0),
    orcado: (b) => b.total?.contratosAceleracao ?? null },
  { id: "total_ganhos_impl", name: "Negócios Ganhos Implantação", format: "number", section: "total",
    realizado: ({ mql, naoMql }) => (mql?.contratosImplantacao ?? 0) + (naoMql?.contratosImplantacao ?? 0),
    orcado: (b) => b.total?.contratosImplantacao ?? null },
  { id: "total_faturamento", name: "Faturamento Total", format: "currency", section: "total",
    realizado: ({ mql, naoMql }) =>
      (mql?.faturamentoAceleracao ?? 0) + (mql?.faturamentoImplantacao ?? 0)
      + (naoMql?.faturamentoAceleracao ?? 0) + (naoMql?.faturamentoImplantacao ?? 0),
    orcado: (b) => b.total?.faturamentoTotal ?? null },
  { id: "total_fat_acel", name: "Faturamento Aceleração", format: "currency", section: "total",
    realizado: ({ mql, naoMql }) => (mql?.faturamentoAceleracao ?? 0) + (naoMql?.faturamentoAceleracao ?? 0),
    orcado: (b) => b.total?.faturamentoAceleracao ?? null },
  { id: "total_fat_impl", name: "Faturamento Implantação", format: "currency", section: "total",
    realizado: ({ mql, naoMql }) => (mql?.faturamentoImplantacao ?? 0) + (naoMql?.faturamentoImplantacao ?? 0),
    orcado: (b) => b.total?.faturamentoImplantacao ?? null },
  { id: "total_conv_funil", name: "Taxa de Conversão do Funil", format: "percent", section: "total",
    realizado: ({ mql, naoMql }) => {
      const leads = (mql?.totalMqls ?? 0) + (naoMql?.totalNaoMqls ?? 0);
      const deals = (mql?.dealsGanhos ?? 0) + (naoMql?.dealsGanhos ?? 0);
      return leads > 0 ? deals / leads : null;
    },
    orcado: (b) => b.total?.taxaConversaoFunil ?? null },
  { id: "total_conv_mql", name: "Tx de Conversão MQL", format: "percent", section: "total",
    realizado: ({ mql }) => {
      if (!mql) return null;
      return mql.totalMqls > 0 ? mql.dealsGanhos / mql.totalMqls : null;
    },
    orcado: (b) => b.total?.taxaConversaoMQL ?? null },
  { id: "total_cac_ads", name: "CAC - Negócios", format: "currency", section: "total", inverted: true,
    realizado: ({ ads, mql, naoMql }) => {
      const invest = ads?.investimento ?? 0;
      const deals = (mql?.dealsGanhos ?? 0) + (naoMql?.dealsGanhos ?? 0);
      return deals > 0 ? invest / deals : null;
    },
    orcado: () => null },
  { id: "total_cac_contrato", name: "CAC - Contrato", format: "currency", section: "total", inverted: true,
    realizado: ({ ads, mql, naoMql }) => {
      const invest = ads?.investimento ?? 0;
      const contr = (mql?.contratosGanhos ?? 0) + (naoMql?.contratosGanhos ?? 0);
      return contr > 0 ? invest / contr : null;
    },
    orcado: () => null },
  { id: "total_ticket_geral", name: "Ticket Médio Geral", format: "currency", section: "total",
    realizado: ({ mql, naoMql }) => {
      const fat = (mql?.faturamentoAceleracao ?? 0) + (mql?.faturamentoImplantacao ?? 0)
        + (naoMql?.faturamentoAceleracao ?? 0) + (naoMql?.faturamentoImplantacao ?? 0);
      const deals = (mql?.dealsGanhos ?? 0) + (naoMql?.dealsGanhos ?? 0);
      return deals > 0 ? fat / deals : null;
    },
    orcado: (b) => b.total?.ticketMedioGeral ?? null },
  { id: "total_ticket_acel", name: "Ticket Médio Aceleração", format: "currency", section: "total",
    realizado: ({ mql, naoMql }) => {
      const fat = (mql?.faturamentoAceleracao ?? 0) + (naoMql?.faturamentoAceleracao ?? 0);
      const c = (mql?.contratosAceleracao ?? 0) + (naoMql?.contratosAceleracao ?? 0);
      return c > 0 ? fat / c : null;
    },
    orcado: (b) => b.total?.ticketMedioAceleracao ?? null },
  { id: "total_ticket_impl", name: "Ticket Médio Implantação", format: "currency", section: "total",
    realizado: ({ mql, naoMql }) => {
      const fat = (mql?.faturamentoImplantacao ?? 0) + (naoMql?.faturamentoImplantacao ?? 0);
      const c = (mql?.contratosImplantacao ?? 0) + (naoMql?.contratosImplantacao ?? 0);
      return c > 0 ? fat / c : null;
    },
    orcado: (b) => b.total?.ticketMedioImplantacao ?? null },
];

export default function GrowthEvolucaoTemporal() {
  usePageTitle("Evolução Temporal");
  useSetPageInfo("Evolução Temporal", "Matriz de métricas por mês ao longo do ano");

  const { user } = useAuth();
  const canExport =
    user?.role === "admin" ||
    (!!user?.email && EXPORT_ALLOWED_EMAILS.has(user.email));

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [selectedProdutos, setSelectedProdutos] = useState<string[]>([]);
  const [selectedPlataformas, setSelectedPlataformas] = useState<string[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 3; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const buckets = useMemo(() => buildMonthBuckets(year), [year]);

  const funilParam = selectedProdutos.length > 0
    ? `&funilNgc=${selectedProdutos.map((p) => encodeURIComponent(p)).join(",")}`
    : "";
  const derivedUtm = selectedPlataformas.map((p) => PLATFORM_TO_UTM[p]).filter(Boolean);
  const utmSourceParam = derivedUtm.length > 0 ? `&utmSource=${derivedUtm.join(",")}` : "";

  const { data: funis } = useQuery<string[]>({
    queryKey: ["/api/growth/orcado-realizado/funis"],
    queryFn: async () => {
      const r = await fetch("/api/growth/orcado-realizado/funis");
      if (!r.ok) throw new Error("funis");
      return r.json();
    },
  });

  const produtoOptions = useMemo(
    () => (funis || []).map((f) => ({ value: f, label: f })),
    [funis],
  );

  // Budgets do ano inteiro (1 fetch só)
  const funilForBudget = selectedProdutos.length === 1 ? selectedProdutos[0] : "todos";
  const { data: budgetsYear } = useQuery<Record<string, BudgetMonth>>({
    queryKey: ["/api/growth/orcado-realizado/budgets/year", year, funilForBudget],
    queryFn: async () => {
      const r = await fetch(
        `/api/growth/orcado-realizado/budgets/year?year=${year}&funil=${encodeURIComponent(funilForBudget)}`,
      );
      if (!r.ok) throw new Error("budgets");
      return r.json();
    },
  });

  // Fan-out: 12 × 3 = 36 fetches
  const monthlyQueries = useQueries({
    queries: buckets.flatMap((b) => ([
      {
        queryKey: ["ev-mql", b.key, selectedProdutos, selectedPlataformas],
        queryFn: async (): Promise<MqlData> => {
          const r = await fetch(
            `/api/growth/orcado-realizado/mql?startDate=${b.startDate}&endDate=${b.endDate}${funilParam}${utmSourceParam}`,
          );
          if (!r.ok) throw new Error("mql");
          return r.json();
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["ev-nmql", b.key, selectedProdutos, selectedPlataformas],
        queryFn: async (): Promise<NaoMqlData> => {
          const r = await fetch(
            `/api/growth/orcado-realizado/nao-mql?startDate=${b.startDate}&endDate=${b.endDate}${funilParam}${utmSourceParam}`,
          );
          if (!r.ok) throw new Error("nao-mql");
          return r.json();
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["ev-ads", b.key, selectedProdutos, selectedPlataformas],
        queryFn: async (): Promise<AdsData> => {
          const r = await fetch(
            `/api/growth/orcado-realizado/ads?startDate=${b.startDate}&endDate=${b.endDate}${funilParam}${utmSourceParam}`,
          );
          if (!r.ok) throw new Error("ads");
          return r.json();
        },
        staleTime: 5 * 60 * 1000,
      },
    ])),
  });

  // Weekly drill-down fan-out
  const expandedWeeks = useMemo(() => {
    const out: WeekBucket[] = [];
    for (const mk of Array.from(expandedMonths)) {
      const [y, m] = mk.split("-").map(Number);
      out.push(...buildWeekBucketsForMonth(y, m - 1));
    }
    const uniq = new Map<string, WeekBucket>();
    for (const w of out) if (!uniq.has(w.key)) uniq.set(w.key, w);
    return Array.from(uniq.values());
  }, [expandedMonths]);

  const weeklyQueries = useQueries({
    queries: expandedWeeks.flatMap((w) => ([
      {
        queryKey: ["ev-mql-wk", w.key, selectedProdutos, selectedPlataformas],
        queryFn: async (): Promise<MqlData> => {
          const r = await fetch(
            `/api/growth/orcado-realizado/mql?startDate=${w.startDate}&endDate=${w.endDate}${funilParam}${utmSourceParam}`,
          );
          if (!r.ok) throw new Error("mql-week");
          return r.json();
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["ev-nmql-wk", w.key, selectedProdutos, selectedPlataformas],
        queryFn: async (): Promise<NaoMqlData> => {
          const r = await fetch(
            `/api/growth/orcado-realizado/nao-mql?startDate=${w.startDate}&endDate=${w.endDate}${funilParam}${utmSourceParam}`,
          );
          if (!r.ok) throw new Error("nao-mql-week");
          return r.json();
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["ev-ads-wk", w.key, selectedProdutos, selectedPlataformas],
        queryFn: async (): Promise<AdsData> => {
          const r = await fetch(
            `/api/growth/orcado-realizado/ads?startDate=${w.startDate}&endDate=${w.endDate}${funilParam}${utmSourceParam}`,
          );
          if (!r.ok) throw new Error("ads-week");
          return r.json();
        },
        staleTime: 5 * 60 * 1000,
      },
    ])),
  });

  const isLoading = monthlyQueries.some((q) => q.isLoading) || weeklyQueries.some((q) => q.isLoading);
  const totalQueries = monthlyQueries.length + weeklyQueries.length;
  const loadedQueries =
    monthlyQueries.filter((q) => !q.isLoading).length +
    weeklyQueries.filter((q) => !q.isLoading).length;

  // Index results by bucket key (months and weeks)
  const byBucket = useMemo(() => {
    const map: Record<string, { mql?: MqlData; naoMql?: NaoMqlData; ads?: AdsData }> = {};
    buckets.forEach((b, i) => {
      map[b.key] = {
        mql: monthlyQueries[i * 3].data as MqlData | undefined,
        naoMql: monthlyQueries[i * 3 + 1].data as NaoMqlData | undefined,
        ads: monthlyQueries[i * 3 + 2].data as AdsData | undefined,
      };
    });
    expandedWeeks.forEach((w, i) => {
      map[w.key] = {
        mql: weeklyQueries[i * 3]?.data as MqlData | undefined,
        naoMql: weeklyQueries[i * 3 + 1]?.data as NaoMqlData | undefined,
        ads: weeklyQueries[i * 3 + 2]?.data as AdsData | undefined,
      };
    });
    return map;
  }, [buckets, monthlyQueries, expandedWeeks, weeklyQueries]);

  // Dynamic columns: months + inline weeks for expanded months
  type Column =
    | { kind: "month"; bucket: MonthBucket }
    | { kind: "week"; week: WeekBucket };
  const columns = useMemo<Column[]>(() => {
    const weeksByParent = new Map<string, WeekBucket[]>();
    for (const w of expandedWeeks) {
      const arr = weeksByParent.get(w.parentMonthKey) ?? [];
      arr.push(w);
      weeksByParent.set(w.parentMonthKey, arr);
    }
    const cols: Column[] = [];
    for (const b of buckets) {
      cols.push({ kind: "month", bucket: b });
      if (expandedMonths.has(b.key)) {
        const ws = weeksByParent.get(b.key) ?? [];
        for (const w of ws) cols.push({ kind: "week", week: w });
      }
    }
    return cols;
  }, [buckets, expandedMonths, expandedWeeks]);

  const metricsBySection = useMemo(() => {
    const grouped: Record<SectionKey, MetricDef[]> = {
      marketing: [], mql: [], "nao-mql": [], total: [],
    };
    for (const m of METRIC_DEFS) grouped[m.section].push(m);
    return grouped;
  }, []);

  const renderCell = (m: MetricDef, col: Column) => {
    const bKey = col.kind === "month" ? col.bucket.key : col.week.key;
    const data = byBucket[bKey] || {};
    const realizado = m.realizado(data);
    let orcado: number | null = null;
    if (col.kind === "month") {
      orcado = m.orcado((budgetsYear?.[bKey] || {}) as BudgetMonth);
    } else {
      orcado = prorateBudgetToWeek(budgetsYear, col.week, m.orcado);
    }
    const pct =
      orcado !== null && orcado !== 0 && realizado !== null
        ? (realizado / orcado) * 100
        : null;
    const isWeek = col.kind === "week";
    return (
      <TableCell
        key={bKey}
        className={cn(
          "text-right text-sm tabular-nums",
          isWeek && "bg-muted/30 text-xs",
        )}
      >
        <div className="flex flex-col items-end leading-tight">
          <span className={cn("font-medium", isWeek && "text-xs")}>
            {formatValue(realizado, m.format)}
          </span>
          {orcado !== null && (
            <span
              className={cn("text-[10px]", percColor(pct, m.inverted))}
              title={`Orçado: ${formatValue(orcado, m.format)}`}
            >
              {pct !== null ? `${pct.toFixed(0)}%` : "-"}
            </span>
          )}
        </div>
      </TableCell>
    );
  };

  const expandAll = () => setExpandedMonths(new Set(buckets.map((b) => b.key)));
  const collapseAll = () => setExpandedMonths(new Set());

  const buildExportRows = () => {
    const header = ["Seção", "Métrica", ...columns.map((c) => c.kind === "month" ? c.bucket.label : c.week.label)];
    const rows: (string | number | null)[][] = [];
    for (const sKey of SECTION_ORDER) {
      const defs = metricsBySection[sKey];
      if (!defs || defs.length === 0) continue;
      const sectionTitle = SECTION_META[sKey].title;
      for (const m of defs) {
        const row: (string | number | null)[] = [sectionTitle, m.name];
        for (const col of columns) {
          const bKey = col.kind === "month" ? col.bucket.key : col.week.key;
          const data = byBucket[bKey] || {};
          const realizado = m.realizado(data);
          row.push(realizado === null || !Number.isFinite(realizado) ? null : Number(realizado));
        }
        rows.push(row);
      }
    }
    return { header, rows };
  };

  const fileBase = () => {
    const exp = expandedMonths.size > 0 ? `_semanas${expandedMonths.size}` : "";
    return `EvolucaoTemporal_${year}${exp}`;
  };

  const exportXLSX = async () => {
    const XLSX = await import("xlsx");
    const { header, rows } = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 20 }, { wch: 34 }, ...columns.map(() => ({ wch: 12 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Evolução Temporal");
    XLSX.writeFile(wb, `${fileBase()}.xlsx`);
  };

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução Temporal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Ano</label>
              <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-[220px]">
              <label className="text-xs text-muted-foreground">Produto</label>
              <MultiSelect options={produtoOptions} selected={selectedProdutos} onChange={setSelectedProdutos} placeholder="Todos" />
            </div>
            <div className="flex flex-col gap-1 min-w-[220px]">
              <label className="text-xs text-muted-foreground">Plataforma</label>
              <MultiSelect options={PLATFORM_MULTISELECT_OPTIONS} selected={selectedPlataformas} onChange={setSelectedPlataformas} placeholder="Todas" />
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expandir todos
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} disabled={expandedMonths.size === 0}>
                Colapsar todos
              </Button>
              {canExport && (
                <Button variant="outline" size="sm" onClick={exportXLSX} title="Exportar matriz visível em XLSX">
                  <Download className="h-3.5 w-3.5 mr-1" /> Exportar XLSX
                </Button>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando ({loadedQueries}/{totalQueries})…
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[240px]">Métrica</TableHead>
                  {columns.map((col) => {
                    if (col.kind === "month") {
                      const b = col.bucket;
                      const isExpanded = expandedMonths.has(b.key);
                      return (
                        <TableHead key={b.key} className="text-right min-w-[110px]">
                          <button
                            type="button"
                            onClick={() => toggleMonth(b.key)}
                            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                            title={isExpanded ? "Colapsar semanas" : "Expandir por semanas ISO"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            {b.label}
                          </button>
                        </TableHead>
                      );
                    }
                    const w = col.week;
                    return (
                      <TableHead
                        key={w.key}
                        className="text-right min-w-[95px] bg-muted/30 text-xs"
                        title={w.tooltip}
                      >
                        {w.label}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {SECTION_ORDER.map((sKey) => {
                  const rows = metricsBySection[sKey];
                  if (!rows || rows.length === 0) return null;
                  const meta = SECTION_META[sKey];
                  return (
                    <Fragment key={sKey}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={columns.length + 1} className="py-2 font-semibold text-sm">
                          <div className="flex items-center gap-2">
                            {meta.icon}{meta.title}
                          </div>
                        </TableCell>
                      </TableRow>
                      {rows.map((m) => (
                        <TableRow key={m.id} className="hover:bg-muted/30">
                          <TableCell
                            className={cn(
                              "sticky left-0 bg-background text-sm",
                              m.sub ? "font-normal text-muted-foreground" : "font-medium",
                            )}
                            style={m.sub ? { paddingLeft: "2rem" } : undefined}
                          >
                            {m.sub && <span className="text-muted-foreground/60 mr-1">└</span>}
                            {m.name}
                          </TableCell>
                          {columns.map((col) => renderCell(m, col))}
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderAprofundadoImage, uploadFcaImage, type FcaSection, type FcaMetric } from "../fca/aprofundadoImage";
import {
  buildMetaAdsMetrics, buildGoogleAdsMetrics, buildTiktokAdsMetrics,
  fcaKindInv,
  DEFAULT_ORCADO_META_ADS, DEFAULT_ORCADO_GOOGLE_ADS, DEFAULT_ORCADO_TIKTOK_ADS,
  type Metric, type PlatformFunnelData,
} from "@shared/orcadoRealizado/aprofundado";

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY!;
const CLICKUP_FCA_LIST_ID = "901322140780";
const CLICKUP_ICHINO_USER_ID = "55120346";
const FCA_API_TOKEN = process.env.FCA_API_TOKEN;

const CLICKUP_FIELDS = {
  canal: "f1269c53-1ee0-40bf-8796-2961f0ca767b",
  funil: "b036cff5-6866-45d5-b1a4-19366e32a532",
  tipo: "c58c4fd0-8a03-400f-ac81-5316643bd6ed",
  date: "8cfba79a-d243-4911-8563-fd39c2523357",
};
const CLICKUP_OPTS: Record<string, Record<string, string>> = {
  tipo: { relatorioMidia: "3ca91709-20ed-4c67-9e60-1a5525f522d9" },
};

// Canal: opção do ClickUp + predicado de plataforma no Bitrix (utm_source).
// platformUtm = null mantém o comportamento legado (filtra só por funil, sem split de plataforma).
const CANAL_CFG: Record<string, { clickup: string; segmento: string; platformUtm: string | null }> = {
  metaAds: { clickup: "2b7e74d1-78ec-4d5b-a0c8-553b64d2d1c0", segmento: "meta_ads", platformUtm: null },
  googleAds: { clickup: "ef42936f-2e34-41b8-b019-6b176a6cb1ce", segmento: "google_ads", platformUtm: "google" },
  tiktokAds: { clickup: "81541b88-5e03-4193-b1c7-716173c98901", segmento: "tiktok_ads", platformUtm: "tiktok" },
};

// Funil: opção do ClickUp + padrão fnl_ngc (Bitrix, ILIKE) + tag no nome da campanha (LIKE, lower).
const FUNIL_CFG: Record<string, { clickup: string; fnlNgc: string; campaignLike: string }> = {
  Creators: { clickup: "d96d739e-a3f0-4c2e-9edb-5e22a0d84d05", fnlNgc: "Creators%", campaignLike: "%[creators]%" },
  Ecommerce: { clickup: "62a087fc-73a5-4bbd-bddc-aaa9caeb1c5d", fnlNgc: "Ecommerce%", campaignLike: "%[ecommerce]%" },
  CRM: { clickup: "883bd637-4a0c-467c-a58c-398ee68125f4", fnlNgc: "CRM%", campaignLike: "%[crm]%" },
  Summit: { clickup: "7f02079a-aa74-4e9b-a7a3-4af5a2f1aac0", fnlNgc: "Creator Summit%", campaignLike: "%[summit]%" },
};

// Predicado SQL de plataforma sobre utm_source (alinhado a server/routes/growth.ts).
const PLATFORM_UTM_SQL: Record<string, string> = {
  google: "(utm_source ILIKE 'google%' OR utm_source ILIKE 'adwords%' OR utm_source = 'gads')",
  tiktok: "(utm_source ILIKE 'tiktok%')",
  facebook: "(utm_source ILIKE 'facebook%' OR utm_source ILIKE 'fb%' OR utm_source ILIKE 'meta%')",
};

type Periodo = { de: string; ate: string };

function bearerAuth(req: Request, res: Response, next: NextFunction) {
  if (!FCA_API_TOKEN) {
    return res.status(500).json({ error: "FCA_API_TOKEN not configured" });
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  const token = header.slice(7).trim();
  if (token !== FCA_API_TOKEN) {
    return res.status(403).json({ error: "Invalid token" });
  }
  next();
}

function isoWeekRange(date: Date): { week: number; start: Date; end: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - 3);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { week, start, end };
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtBR(d: string): string {
  const [, m, day] = d.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${parseInt(day, 10)}/${meses[parseInt(m, 10) - 1]}`;
}

function periodos(now: Date) {
  const lastClosedSunday = new Date(now);
  while (lastClosedSunday.getUTCDay() !== 0) {
    lastClosedSunday.setUTCDate(lastClosedSunday.getUTCDate() - 1);
  }
  const w = isoWeekRange(lastClosedSunday);
  const prevSunday = new Date(w.start);
  prevSunday.setUTCDate(w.start.getUTCDate() - 1);
  const wPrev = isoWeekRange(prevSunday);

  const mtdEnd = new Date(now);
  mtdEnd.setUTCDate(mtdEnd.getUTCDate() - 1);
  const mtdStart = new Date(Date.UTC(mtdEnd.getUTCFullYear(), mtdEnd.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(mtdEnd.getUTCFullYear(), mtdEnd.getUTCMonth() + 1, 0));

  return {
    semana: { de: fmtDate(w.start), ate: fmtDate(w.end), num: w.week },
    semanaPrev: { de: fmtDate(wPrev.start), ate: fmtDate(wPrev.end), num: wPrev.week },
    mtd: { de: fmtDate(mtdStart), ate: fmtDate(mtdEnd) },
    diasMTD: mtdEnd.getUTCDate(),
    diasMes: monthEnd.getUTCDate(),
    mesRef: fmtDate(mtdEnd).slice(0, 7),
  };
}

function periodosMensal(now: Date, mesParam?: string) {
  const explicito = !!(mesParam && /^\d{4}-\d{2}$/.test(mesParam));
  let y: number, m: number; // m = 1-12
  if (explicito) {
    const [yy, mm] = mesParam!.split("-").map(Number);
    y = yy; m = mm;
  } else {
    const ref = new Date(now);
    ref.setUTCDate(ref.getUTCDate() - 1); // ontem → evita contar o dia corrente incompleto
    y = ref.getUTCFullYear();
    m = ref.getUTCMonth() + 1;
  }
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0));
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  // Mês explícito → mês inteiro (fechado). Mês omitido (corrente) → MTD até ontem,
  // mas se ontem já passou do fim do mês, usa o mês inteiro.
  const ate = explicito
    ? lastDay
    : (yesterday.getTime() >= first.getTime() && yesterday.getTime() < lastDay.getTime() ? yesterday : lastDay);
  const prevFirst = new Date(Date.UTC(y, m - 2, 1));
  const prevLast = new Date(Date.UTC(y, m - 1, 0));
  return {
    mes: `${y}-${String(m).padStart(2, "0")}`,
    principal: { de: fmtDate(first), ate: fmtDate(ate) },
    prev: { de: fmtDate(prevFirst), ate: fmtDate(prevLast) },
    diasNoMes: lastDay.getUTCDate(),
    diasDecorridos: ate.getUTCDate(),
  };
}

async function getMetas(funil: string, mes: string, segmento: string): Promise<{ metricas: any; fonte: string }> {
  const mesAnterior = (() => {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();
  for (const mesTry of [mes, mesAnterior]) {
    const r = await db.execute(sql`
      SELECT metricas FROM meta_ads.growth_budgets
      WHERE mes = ${mesTry} AND segmento = ${segmento} AND funil = ${funil}
    `);
    if (r.rows.length) return { metricas: r.rows[0].metricas, fonte: `${funil}/${mesTry}/${segmento}` };
  }
  for (const mesTry of [mes, mesAnterior]) {
    const r = await db.execute(sql`
      SELECT metricas FROM meta_ads.growth_budgets
      WHERE mes = ${mesTry} AND segmento = ${segmento} AND funil = 'todos'
    `);
    if (r.rows.length) return { metricas: r.rows[0].metricas, fonte: `todos/${mesTry}/${segmento}` };
  }
  return { metricas: {}, fonte: "NENHUMA" };
}

type MidiaRealizado = {
  investimento: number;
  impressoes: number;
  outboundClicks: number;
  lpv: number;
  cpm: number;
  ctr: number;
};

function midiaResumo(invest: number, imps: number, oc: number, lpv: number): MidiaRealizado {
  return {
    investimento: invest,
    impressoes: imps,
    outboundClicks: oc,
    lpv,
    cpm: imps ? (invest / imps) * 1000 : 0,
    ctr: imps ? oc / imps : 0,
  };
}

async function metaAdsRealizado(campaignLike: string, p: Periodo): Promise<MidiaRealizado> {
  const r = await db.execute(sql`
    SELECT
      COALESCE(SUM(i.spend), 0)::float AS investimento,
      COALESCE(SUM(i.impressions), 0)::bigint AS impressoes,
      COALESCE(SUM(i.outbound_clicks), 0)::bigint AS oc,
      COALESCE(SUM(i.landing_page_views), 0)::bigint AS lpv
    FROM meta_ads.meta_insights_daily i
    JOIN meta_ads.meta_campaigns c ON c.campaign_id = i.campaign_id
    WHERE i.date_start BETWEEN ${p.de} AND ${p.ate}
      AND LOWER(c.campaign_name) LIKE ${campaignLike}
  `);
  const row = r.rows[0] as any;
  return midiaResumo(Number(row.investimento) || 0, Number(row.impressoes) || 0, Number(row.oc) || 0, Number(row.lpv) || 0);
}

async function googleAdsRealizado(campaignLike: string, p: Periodo): Promise<MidiaRealizado> {
  const r = await db.execute(sql`
    SELECT
      COALESCE(SUM(m.cost_micros), 0)::float / 1e6 AS investimento,
      COALESCE(SUM(m.impressions), 0)::bigint AS impressoes,
      COALESCE(SUM(m.clicks), 0)::bigint AS clicks
    FROM google.campaign_daily_metrics m
    JOIN google.campaigns c ON c.campaign_id = m.campaign_id
    WHERE m.report_date BETWEEN ${p.de} AND ${p.ate}
      AND LOWER(c.name) LIKE ${campaignLike}
  `);
  const row = r.rows[0] as any;
  // Google não tem outbound_clicks/landing_page_views nativos — usa clicks; lpv=0 (Connect Rate/Tx Página ficam 🔘).
  return midiaResumo(Number(row.investimento) || 0, Number(row.impressoes) || 0, Number(row.clicks) || 0, 0);
}

async function tiktokAdsRealizado(_campaignLike: string, p: Periodo): Promise<MidiaRealizado> {
  // TikTok não tem split confiável de funil pelo nome — soma o gasto do anunciante no período.
  // O recorte de funil acontece no Bitrix via utm_source=tiktok.
  const r = await db.execute(sql`
    SELECT
      COALESCE(SUM(spend), 0)::float AS investimento,
      COALESCE(SUM(impressions), 0)::bigint AS impressoes,
      COALESCE(SUM(clicks), 0)::bigint AS clicks
    FROM tiktok.ad_insights_daily
    WHERE stat_date BETWEEN ${p.de} AND ${p.ate}
  `);
  const row = r.rows[0] as any;
  return midiaResumo(Number(row.investimento) || 0, Number(row.impressoes) || 0, Number(row.clicks) || 0, 0);
}

async function midiaRealizado(canal: string, campaignLike: string, p: Periodo): Promise<MidiaRealizado> {
  if (canal === "googleAds") return googleAdsRealizado(campaignLike, p);
  if (canal === "tiktokAds") return tiktokAdsRealizado(campaignLike, p);
  return metaAdsRealizado(campaignLike, p);
}

async function bitrixRealizado(fnlNgcPattern: string, platformUtm: string | null, p: Periodo) {
  const funilLike = fnlNgcPattern;
  // Filtro opcional de plataforma (canal) via utm_source — channel-pure para Google/TikTok.
  const platSql = platformUtm && PLATFORM_UTM_SQL[platformUtm]
    ? sql` AND ${sql.raw(PLATFORM_UTM_SQL[platformUtm])}`
    : sql``;
  const vol = await db.execute(sql`
    SELECT
      COUNT(*)::int AS leads,
      SUM(CASE WHEN mql::text='1' OR LOWER(mql::text)='true' THEN 1 ELSE 0 END)::int AS mqls
    FROM "Bitrix".crm_deal
    WHERE created_at >= ${p.de}::date AND created_at < (${p.ate}::date + INTERVAL '1 day')
      AND fnl_ngc ILIKE ${funilLike}${platSql}
  `);
  const ra = await db.execute(sql`
    SELECT
      SUM(CASE WHEN mql::text='1' OR LOWER(mql::text)='true' THEN 1 ELSE 0 END)::int AS rm_mql,
      SUM(CASE WHEN NOT (mql::text='1' OR LOWER(mql::text)='true') THEN 1 ELSE 0 END)::int AS rm_nmql
    FROM "Bitrix".crm_deal
    WHERE data_reuniao_agendada BETWEEN ${p.de} AND ${p.ate}
      AND fnl_ngc ILIKE ${funilLike}${platSql}
  `);
  const rr = await db.execute(sql`
    SELECT
      SUM(CASE WHEN mql::text='1' OR LOWER(mql::text)='true' THEN 1 ELSE 0 END)::int AS rr_mql,
      SUM(CASE WHEN NOT (mql::text='1' OR LOWER(mql::text)='true') THEN 1 ELSE 0 END)::int AS rr_nmql
    FROM "Bitrix".crm_deal
    WHERE data_reuniao_realizada BETWEEN ${p.de} AND ${p.ate}
      AND fnl_ngc ILIKE ${funilLike}${platSql}
  `);
  const vendas = await db.execute(sql`
    SELECT
      SUM(CASE WHEN stage_name='Negócio Ganho' THEN 1 ELSE 0 END)::int AS negocios,
      SUM(CASE WHEN stage_name='Negócio Ganho' AND (mql::text='1' OR LOWER(mql::text)='true') THEN 1 ELSE 0 END)::int AS neg_mql,
      SUM(CASE WHEN stage_name='Negócio Ganho' AND NOT (mql::text='1' OR LOWER(mql::text)='true') THEN 1 ELSE 0 END)::int AS neg_nmql,
      SUM(CASE WHEN stage_name='Negócio Ganho' AND COALESCE(valor_pontual,0)>0 THEN 1 ELSE 0 END)::int AS c_impl,
      SUM(CASE WHEN stage_name='Negócio Ganho' AND COALESCE(valor_recorrente,0)>0 THEN 1 ELSE 0 END)::int AS c_acel,
      COALESCE(SUM(CASE WHEN stage_name='Negócio Ganho' THEN COALESCE(valor_pontual,0) ELSE 0 END), 0)::float AS fat_impl,
      COALESCE(SUM(CASE WHEN stage_name='Negócio Ganho' THEN COALESCE(valor_recorrente,0) ELSE 0 END), 0)::float AS fat_acel
    FROM "Bitrix".crm_deal
    WHERE data_fechamento BETWEEN ${p.de} AND ${p.ate}
      AND fnl_ngc ILIKE ${funilLike}${platSql}
  `);
  const v = vol.rows[0] as any;
  const a = ra.rows[0] as any;
  const r = rr.rows[0] as any;
  const x = vendas.rows[0] as any;
  const leads = Number(v.leads) || 0;
  const mqls = Number(v.mqls) || 0;
  const nmqls = leads - mqls;
  const rmMql = Number(a.rm_mql) || 0;
  const rmNmql = Number(a.rm_nmql) || 0;
  const rrMql = Number(r.rr_mql) || 0;
  const rrNmql = Number(r.rr_nmql) || 0;
  const neg = Number(x.negocios) || 0;
  const negMql = Number(x.neg_mql) || 0;
  const negNmql = Number(x.neg_nmql) || 0;
  const cImpl = Number(x.c_impl) || 0;
  const cAcel = Number(x.c_acel) || 0;
  const fatImpl = Number(x.fat_impl) || 0;
  const fatAcel = Number(x.fat_acel) || 0;
  return {
    leads, mqls, nmqls,
    percMql: leads ? mqls / leads : 0,
    rmMql, rmNmql, rrMql, rrNmql,
    percRaMql: mqls ? rmMql / mqls : 0,
    percRaNmql: nmqls ? rmNmql / nmqls : 0,
    percNoShowMql: rmMql ? (rmMql - rrMql) / rmMql : 0,
    percNoShowNmql: rmNmql ? (rmNmql - rrNmql) / rmNmql : 0,
    percRrVendaMql: rrMql ? negMql / rrMql : 0,
    percRrVendaNmql: rrNmql ? negNmql / rrNmql : 0,
    negocios: neg, negMql, negNmql,
    contratosImpl: cImpl, contratosAcel: cAcel,
    contratosTotal: cImpl + cAcel,
    fatImpl, fatAcel,
    fatTotal: fatImpl + fatAcel,
  };
}

function fmtCurr(v: number, decimals = 2): string {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtCurrInt(v: number): string {
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}
function fmtPct(v: number, decimals = 1): string {
  return (v * 100).toFixed(decimals).replace(".", ",") + "%";
}
function fmtDelta(real: number, meta: number, invertido = false): { delta: string; status: string } {
  if (!meta || meta === 0) return { delta: "—", status: "🔘" };
  const ratio = (real - meta) / meta;
  const pct = (ratio * 100).toFixed(1).replace(".", ",");
  const sign = ratio >= 0 ? "+" : "";
  let status: string;
  if (invertido) {
    if (ratio <= 0.05) status = "🟢";
    else if (ratio <= 0.15) status = "🟡";
    else status = "🔴";
  } else {
    if (ratio >= -0.05) status = "🟢";
    else if (ratio >= -0.15) status = "🟡";
    else status = "🔴";
  }
  return { delta: `${sign}${pct}%`, status };
}

type Realizado = {
  ma: Awaited<ReturnType<typeof metaAdsRealizado>>;
  bx: Awaited<ReturnType<typeof bitrixRealizado>>;
  invest: number;
};

function rowStatus(real: number, meta: number, invertido = false): { delta: string; status: string } {
  if (!meta) return { delta: "—", status: "🔘" };
  return fmtDelta(real, meta, invertido);
}

function montarMarkdown(args: {
  funil: string;
  p: ReturnType<typeof periodos>;
  metas: { metaAds: any; mql: any; nmql: any };
  mtd: Realizado;
  w: Realizado;
  wPrev: Realizado;
}): string {
  const { funil, p, metas, mtd, w, wPrev } = args;
  const mAds = metas.metaAds;
  const mMql = metas.mql;
  const mNmql = metas.nmql;
  const diasFator = p.diasMTD / p.diasMes;
  const investMeta = (mAds.investimento || 0) * diasFator;
  const leadsMeta = (mAds.leads || 0) * diasFator;
  const mqlsMeta = (mAds.mqls || 0) * diasFator;

  const cpmql = mtd.bx.mqls ? mtd.invest / mtd.bx.mqls : 0;
  const cpl = mtd.bx.leads ? mtd.invest / mtd.bx.leads : 0;
  const cacNeg = mtd.bx.negocios ? mtd.invest / mtd.bx.negocios : 0;
  const cacCont = mtd.bx.contratosTotal ? mtd.invest / mtd.bx.contratosTotal : 0;
  const ticketMedio = mtd.bx.negocios ? mtd.bx.fatTotal / mtd.bx.negocios : 0;
  const ticketImpl = mtd.bx.contratosImpl ? mtd.bx.fatImpl / mtd.bx.contratosImpl : 0;
  const ticketAcel = mtd.bx.contratosAcel ? mtd.bx.fatAcel / mtd.bx.contratosAcel : 0;
  const txConvLP = mtd.ma.lpv ? mtd.bx.leads / mtd.ma.lpv : 0;

  const investProj = (mtd.invest / p.diasMTD) * p.diasMes;
  const leadsProj = (mtd.bx.leads / p.diasMTD) * p.diasMes;
  const mqlsProj = (mtd.bx.mqls / p.diasMTD) * p.diasMes;
  const negProj = (mtd.bx.negocios / p.diasMTD) * p.diasMes;
  const fatProj = (mtd.bx.fatTotal / p.diasMTD) * p.diasMes;

  const stCpmql = rowStatus(cpmql, mAds.cpmql || 0, true);
  const stMql = rowStatus(mqlsProj, mAds.mqls || 0, false);
  const stLeads = rowStatus(leadsProj, mAds.leads || 0, false);
  const stInvest = rowStatus(investProj, mAds.investimento || 0, true);

  const pctTemporal = ((p.diasMTD / p.diasMes) * 100).toFixed(1).replace(".", ",");

  const cpmW = w.ma.impressoes ? (w.invest / w.ma.impressoes) * 1000 : 0;
  const cpmWp = wPrev.ma.impressoes ? (wPrev.invest / wPrev.ma.impressoes) * 1000 : 0;
  const cplW = w.bx.leads ? w.invest / w.bx.leads : 0;
  const cplWp = wPrev.bx.leads ? wPrev.invest / wPrev.bx.leads : 0;
  const cpmqlW = w.bx.mqls ? w.invest / w.bx.mqls : 0;
  const cpmqlWp = wPrev.bx.mqls ? wPrev.invest / wPrev.bx.mqls : 0;
  const cacW = w.bx.negocios ? w.invest / w.bx.negocios : 0;
  const cacWp = wPrev.bx.negocios ? wPrev.invest / wPrev.bx.negocios : 0;
  const ticketW = w.bx.negocios ? w.bx.fatTotal / w.bx.negocios : 0;
  const ticketWp = wPrev.bx.negocios ? wPrev.bx.fatTotal / wPrev.bx.negocios : 0;

  const dW = (a: number, b: number, melhorEhMenor = false) => {
    if (!b) return "—";
    const d = ((a - b) / b) * 100;
    const sign = d >= 0 ? "+" : "";
    const dStr = `${sign}${d.toFixed(1).replace(".", ",")}%`;
    let tag = "";
    if (Math.abs(d) >= 5) tag = melhorEhMenor ? (d > 0 ? " (pior)" : " (melhor)") : (d > 0 ? " (melhor)" : " (pior)");
    return dStr + tag;
  };

  const stCpm = rowStatus(mtd.ma.cpm, mAds.cpm || 0, true);
  const stCtr = rowStatus(mtd.ma.ctr, mAds.ctr || 0, false);
  const stTxConv = rowStatus(txConvLP, mAds.taxaConversaoPagina || 0, false);
  const stCpl = rowStatus(cpl, mAds.cpl || 0, true);
  const stPercMql = rowStatus(mtd.bx.percMql, mAds.percMqls || 0, false);
  const stRaMql = rowStatus(mtd.bx.percRaMql, mMql.percReuniaoAgendada || 0, false);
  const stNoShowMql = rowStatus(mtd.bx.percNoShowMql, mMql.percNoShow || 0, true);
  const stRrVMql = rowStatus(mtd.bx.percRrVendaMql, mMql.taxaVendas || 0, false);
  const stRaNmql = rowStatus(mtd.bx.percRaNmql, mNmql.percReuniaoAgendada || 0, false);
  const stNoShowNmql = rowStatus(mtd.bx.percNoShowNmql, mNmql.percNoShow || 0, true);
  const stRrVNmql = rowStatus(mtd.bx.percRrVendaNmql, mNmql.taxaVendas || 0, false);

  return `## Contexto

- **Funil:** ${funil}
- **Acumulado do mês:** ${fmtBR(p.mtd.de)}-${fmtBR(p.mtd.ate)}
- **Semana fechada:** ${fmtBR(p.semana.de)}-${fmtBR(p.semana.ate)} (W-${p.semana.num})
- **Comparação vs:** ${fmtBR(p.semanaPrev.de)}-${fmtBR(p.semanaPrev.ate)} (W-${p.semanaPrev.num})

---

## Resumo executivo

- **Growth:** CPMQL ${fmtCurr(cpmql)} MTD (${stCpmql.delta} vs meta ${fmtCurr(mAds.cpmql || 0)}).
- **Pré-vendas:** No-show MQL ${fmtPct(mtd.bx.percNoShowMql)} MTD (vs meta ${fmtPct(mMql.percNoShow || 0)}).
- **CAC - Negócios:** ${fmtCurr(cacNeg)} MTD com ${mtd.bx.negocios} Negócios Ganhos.
- **Sinal positivo:** Faturamento Total MTD ${fmtCurrInt(mtd.bx.fatTotal)} projetando ${fmtCurrInt(fatProj)} no fim do mês.

---

## Pacing da meta

**${p.diasMTD}/${p.diasMes} dias do mês (${pctTemporal}%).**

| Métrica | MTD | Meta mensal | Projeção fim de mês | Δ |   |
|---|---:|---:|---:|---:|:---:|
| **CAC - Negócios** ⭐ | ${fmtCurrInt(cacNeg)} | (sem meta) | ${fmtCurrInt(cacNeg)} | — | 🔘 |
| **CAC - Contrato** | ${fmtCurrInt(cacCont)} | (sem meta) | ${fmtCurrInt(cacCont)} | — | 🔘 |
| **CPMQL** ⭐ | ${fmtCurrInt(cpmql)} | ${fmtCurrInt(mAds.cpmql || 0)} | ${fmtCurrInt(cpmql)} | ${stCpmql.delta} | ${stCpmql.status} |
| Negócios Ganhos | ${mtd.bx.negocios} | (sem meta) | ${Math.round(negProj)} | — | 🔘 |
| MQLs | ${mtd.bx.mqls} | ${Math.round(mAds.mqls || 0)} | ${Math.round(mqlsProj)} | ${stMql.delta} | ${stMql.status} |
| Leads | ${mtd.bx.leads} | ${Math.round(mAds.leads || 0)} | ${Math.round(leadsProj)} | ${stLeads.delta} | ${stLeads.status} |
| Investimento | ${fmtCurrInt(mtd.invest)} | ${fmtCurrInt(mAds.investimento || 0)} | ${fmtCurrInt(investProj)} | ${stInvest.delta} | ${stInvest.status} |
| Faturamento Total | ${fmtCurrInt(mtd.bx.fatTotal)} | (sem meta) | ${fmtCurrInt(fatProj)} | — | 🔘 |

---

## Métricas Inbound — Consolidado

**Período:** ${p.mtd.de} → ${p.mtd.ate} (acumulado do mês).

| #  | Métrica                    | Real          | Meta        | Δ        |     |
|---:|----------------------------|--------------:|------------:|---------:|:---:|
|    | **Growth**                 |               |             |          |     |
|  1 | Investimento               | ${fmtCurrInt(mtd.invest)}   | ${fmtCurrInt(investMeta)}   | ${stInvest.delta}    | ${stInvest.status} |
|  2 | CPM                        | ${fmtCurr(mtd.ma.cpm)}      | ${fmtCurr(mAds.cpm || 0)}    | ${stCpm.delta}    | ${stCpm.status} |
|  3 | CTR                        | ${fmtPct(mtd.ma.ctr, 2)}         | ${fmtPct(mAds.ctr || 0, 2)}       | ${stCtr.delta}    | ${stCtr.status} |
|  4 | Tx Conversão da Página     | ${fmtPct(txConvLP)}         | ${fmtPct(mAds.taxaConversaoPagina || 0)}       | ${stTxConv.delta}   | ${stTxConv.status} |
|  5 | Leads                      | ${mtd.bx.leads}           | ${Math.round(leadsMeta)}         | ${stLeads.delta}   | ${stLeads.status} |
|  6 | CPL                        | ${fmtCurr(cpl)}     | ${fmtCurr(mAds.cpl || 0)}    | ${stCpl.delta}   | ${stCpl.status} |
|  7 | MQLs                       | ${mtd.bx.mqls}           | ${Math.round(mqlsMeta)}         | ${stMql.delta}    | ${stMql.status} |
|  8 | % MQLs                     | ${fmtPct(mtd.bx.percMql)}         | ${fmtPct(mAds.percMqls || 0)}       | ${stPercMql.delta}   | ${stPercMql.status} |
|  9 | **CPMQL** ⭐               | **${fmtCurr(cpmql)}** | **${fmtCurr(mAds.cpmql || 0)}** | **${stCpmql.delta}** | ${stCpmql.status} |
|    | **Pré-vendas MQL**         |               |             |          |     |
| 10 | %RA MQL                    | ${fmtPct(mtd.bx.percRaMql)}         | ${fmtPct(mMql.percReuniaoAgendada || 0)}       | ${stRaMql.delta}    | ${stRaMql.status} |
| 11 | % No-show MQL              | ${fmtPct(mtd.bx.percNoShowMql)}         | ${fmtPct(mMql.percNoShow || 0)}        | ${stNoShowMql.delta}    | ${stNoShowMql.status} |
| 12 | RR→V% MQL                  | ${fmtPct(mtd.bx.percRrVendaMql)}         | ${fmtPct(mMql.taxaVendas || 0)}       | ${stRrVMql.delta}    | ${stRrVMql.status} |
|    | **Pré-vendas Não-MQL**     |               |             |          |     |
| 13 | %RA Não-MQL                | ${fmtPct(mtd.bx.percRaNmql)}         | ${fmtPct(mNmql.percReuniaoAgendada || 0)}       | ${stRaNmql.delta}    | ${stRaNmql.status} |
| 14 | % No-show Não-MQL          | ${fmtPct(mtd.bx.percNoShowNmql)}         | ${fmtPct(mNmql.percNoShow || 0)}        | ${stNoShowNmql.delta}    | ${stNoShowNmql.status} |
| 15 | RR→V% Não-MQL              | ${fmtPct(mtd.bx.percRrVendaNmql)}         | ${fmtPct(mNmql.taxaVendas || 0)}       | ${stRrVNmql.delta}    | ${stRrVNmql.status} |
|    | **Resultado**              |               |             |          |     |
| 16 | Negócios Ganhos            | ${mtd.bx.negocios}            | (sem meta)  | —        | 🔘 |
| 17 | Faturamento Implantação    | ${fmtCurrInt(mtd.bx.fatImpl)}     | (sem meta)  | —        | 🔘 |
| 18 | Faturamento Aceleração     | ${fmtCurrInt(mtd.bx.fatAcel)}     | (sem meta)  | —        | 🔘 |
| 19 | **Faturamento Total**      | ${fmtCurrInt(mtd.bx.fatTotal)}    | (sem meta)  | —        | 🔘 |
| 20 | Ticket Médio Implantação   | ${fmtCurrInt(ticketImpl)}      | (sem meta)  | —        | 🔘 |
| 21 | Ticket Médio Aceleração    | ${fmtCurrInt(ticketAcel)}      | (sem meta)  | —        | 🔘 |
| 22 | **Ticket Médio Geral**     | ${fmtCurrInt(ticketMedio)}      | (sem meta)  | —        | 🔘 |
| 23 | **CAC - Negócios** ⭐      | ${fmtCurrInt(cacNeg)}      | (sem meta)  | —        | 🔘 |
| 24 | **CAC - Contrato**         | ${fmtCurrInt(cacCont)}      | (sem meta)  | —        | 🔘 |

---

## Comparação semanal

| Métrica            | W-${p.semana.num} (${fmtBR(p.semana.de)}-${fmtBR(p.semana.ate)}) | W-${p.semanaPrev.num} (${fmtBR(p.semanaPrev.de)}-${fmtBR(p.semanaPrev.ate)}) | Δ              |
|--------------------|-----------------:|----------------:|---------------:|
| CPM                | ${fmtCurr(cpmW)}         | ${fmtCurr(cpmWp)}        | ${dW(cpmW, cpmWp, true)}  |
| CTR                | ${fmtPct(w.ma.ctr, 2)}            | ${fmtPct(wPrev.ma.ctr, 2)}           | ${dW(w.ma.ctr, wPrev.ma.ctr)} |
| CPL                | ${fmtCurr(cplW)}        | ${fmtCurr(cplWp)}         | ${dW(cplW, cplWp, true)}  |
| **CPMQL** ⭐       | **${fmtCurr(cpmqlW)}**    | **${fmtCurr(cpmqlWp)}**   | **${dW(cpmqlW, cpmqlWp, true)}** |
| Leads              | ${w.bx.leads}              | ${wPrev.bx.leads}             | ${dW(w.bx.leads, wPrev.bx.leads)} |
| MQLs               | ${w.bx.mqls}               | ${wPrev.bx.mqls}              | ${dW(w.bx.mqls, wPrev.bx.mqls)} |
| Negócios Ganhos    | ${w.bx.negocios}               | ${wPrev.bx.negocios}              | ${dW(w.bx.negocios, wPrev.bx.negocios)} |
| Faturamento Total  | ${fmtCurrInt(w.bx.fatTotal)}        | ${fmtCurrInt(wPrev.bx.fatTotal)}        | ${dW(w.bx.fatTotal, wPrev.bx.fatTotal)} |
| Ticket Médio Geral | ${fmtCurrInt(ticketW)}         | ${fmtCurrInt(ticketWp)}         | ${dW(ticketW, ticketWp)} |
| **CAC - Negócios** | **${fmtCurrInt(cacW)}**     | **${fmtCurrInt(cacWp)}**     | **${dW(cacW, cacWp, true)}** |

---

## Impedimentos

1. Metas Maio Creators inexistentes em geral — skill caiu pra Abril como fallback.
2. Meta de CAC, Faturamento Total, Negócios Ganhos não cadastrada — Pacing fica cego.
3. Bug LPs \`pages.turbopartners.com.br\` perde \`utm_content\`.
4. \`stage_semantic\` sempre NULL em Creators — usar \`stage='Negócio Ganho'\`.
5. CPL/Leads do Bitrix incluem leads orgânicos.
6. Flag MQL no Bitrix usa threshold R\$100k vs regra Turbo R\$50k.

---

🤖 Gerado por endpoint \`POST /api/fca/run\` — skill \`turbo-fca-report\` v3.14.`;
}

function montarMarkdownMensal(args: {
  funil: string;
  canal: string;
  pm: ReturnType<typeof periodosMensal>;
  metas: { metaAds: any; mql: any; nmql: any };
  atual: Realizado;
  prev: Realizado;
}): string {
  const { funil, canal, pm, metas, atual, prev } = args;
  const mAds = metas.metaAds;
  const mMql = metas.mql;
  const mNmql = metas.nmql;
  const fator = pm.diasNoMes ? pm.diasDecorridos / pm.diasNoMes : 1;
  const parcial = pm.diasDecorridos < pm.diasNoMes;
  const canalLabel = CANAL_LABEL[canal] || canal;

  const invest = atual.invest;
  const cpmql = atual.bx.mqls ? invest / atual.bx.mqls : 0;
  const cpl = atual.bx.leads ? invest / atual.bx.leads : 0;
  const txConvLP = atual.ma.lpv ? atual.bx.leads / atual.ma.lpv : 0;
  const connectRate = atual.ma.outboundClicks ? atual.ma.lpv / atual.ma.outboundClicks : 0;
  const cacNeg = atual.bx.negocios ? invest / atual.bx.negocios : 0;
  const ticketMedio = atual.bx.negocios ? atual.bx.fatTotal / atual.bx.negocios : 0;

  // Metas de volume pro-ratadas pelos dias decorridos (mês fechado → fator 1).
  const investMeta = (mAds.investimento || 0) * fator;
  const leadsMeta = (mAds.leads || 0) * fator;
  const mqlsMeta = (mAds.mqls || 0) * fator;

  const stInvest = rowStatus(invest, investMeta, true);
  const stCpm = rowStatus(atual.ma.cpm, mAds.cpm || 0, true);
  const stCtr = rowStatus(atual.ma.ctr, mAds.ctr || 0, false);
  const stConnect = rowStatus(connectRate, mAds.connectRate || 0, false);
  const stTxConv = rowStatus(txConvLP, mAds.taxaConversaoPagina || 0, false);
  const stLeads = rowStatus(atual.bx.leads, leadsMeta, false);
  const stCpl = rowStatus(cpl, mAds.cpl || 0, true);
  const stMqls = rowStatus(atual.bx.mqls, mqlsMeta, false);
  const stPercMql = rowStatus(atual.bx.percMql, mAds.percMqls || 0, false);
  const stCpmql = rowStatus(cpmql, mAds.cpmql || 0, true);
  const stRaMql = rowStatus(atual.bx.percRaMql, mMql.percReuniaoAgendada || 0, false);
  const stNoShowMql = rowStatus(atual.bx.percNoShowMql, mMql.percNoShow || 0, true);
  const stRrvMql = rowStatus(atual.bx.percRrVendaMql, mMql.taxaVendas || 0, false);

  // Comparação M-1.
  const cpmqlPrev = prev.bx.mqls ? prev.invest / prev.bx.mqls : 0;
  const cplPrev = prev.bx.leads ? prev.invest / prev.bx.leads : 0;
  const cpmPrev = prev.ma.impressoes ? (prev.invest / prev.ma.impressoes) * 1000 : 0;
  const dM = (a: number, b: number, menor = false) => {
    if (!b) return "—";
    const d = ((a - b) / b) * 100;
    const sign = d >= 0 ? "+" : "";
    let tag = "";
    if (Math.abs(d) >= 5) tag = menor ? (d > 0 ? " 🔴" : " 🟢") : (d > 0 ? " 🟢" : " 🔴");
    return `${sign}${d.toFixed(1).replace(".", ",")}%${tag}`;
  };

  const notaParcial = parcial
    ? `\n> ⚠️ **Mês parcial** — ${pm.diasDecorridos}/${pm.diasNoMes} dias. Metas de volume (Leads/MQLs/Investimento) pro-ratadas por ${(fator * 100).toFixed(0)}%.`
    : "";
  const semOrcado = !(mAds.cpmql || mAds.investimento || mAds.cpm);

  return `## Contexto

- **Funil × Canal:** ${funil} · ${canalLabel}
- **Mês:** ${pm.mes} (${fmtBR(pm.principal.de)}–${fmtBR(pm.principal.ate)})
- **Comparação:** mês anterior (${fmtBR(pm.prev.de)}–${fmtBR(pm.prev.ate)})${notaParcial}
${semOrcado ? "\n> ℹ️ Sem orçado cadastrado para este funil/canal em `growth_budgets` — colunas de meta saem 🔘. Compare com o planejamento de mídia do mês.\n" : ""}
---

## Resumo executivo

- **Growth:** CPMQL ${fmtCurr(cpmql)} no mês (${stCpmql.delta} vs meta ${fmtCurr(mAds.cpmql || 0)}).
- **Pré-vendas:** No-show MQL ${fmtPct(atual.bx.percNoShowMql)} (vs meta ${fmtPct(mMql.percNoShow || 0)}).
- **Resultado:** ${atual.bx.negocios} Negócios Ganhos · Faturamento ${fmtCurrInt(atual.bx.fatTotal)} · CAC ${fmtCurrInt(cacNeg)}.

---

## Cascata Realizado × Orçado (mês)

| #  | Métrica | Realizado | Orçado | Δ | |
|---:|---|---:|---:|---:|:--:|
|    | **— Growth —** | | | | |
| 1 | Investimento | ${fmtCurrInt(invest)} | ${fmtCurrInt(investMeta)} | ${stInvest.delta} | ${stInvest.status} |
| 2 | CPM | ${fmtCurr(atual.ma.cpm)} | ${fmtCurr(mAds.cpm || 0)} | ${stCpm.delta} | ${stCpm.status} |
| 3 | CTR de saída | ${fmtPct(atual.ma.ctr, 2)} | ${fmtPct(mAds.ctr || 0, 2)} | ${stCtr.delta} | ${stCtr.status} |
| 4 | Connect Rate | ${fmtPct(connectRate)} | ${fmtPct(mAds.connectRate || 0)} | ${stConnect.delta} | ${stConnect.status} |
| 5 | Tx Conversão da Página | ${fmtPct(txConvLP)} | ${fmtPct(mAds.taxaConversaoPagina || 0)} | ${stTxConv.delta} | ${stTxConv.status} |
| 6 | Leads | ${atual.bx.leads} | ${Math.round(leadsMeta)} | ${stLeads.delta} | ${stLeads.status} |
| 7 | CPL | ${fmtCurr(cpl)} | ${fmtCurr(mAds.cpl || 0)} | ${stCpl.delta} | ${stCpl.status} |
| 8 | MQLs | ${atual.bx.mqls} | ${Math.round(mqlsMeta)} | ${stMqls.delta} | ${stMqls.status} |
| 9 | % MQL | ${fmtPct(atual.bx.percMql)} | ${fmtPct(mAds.percMqls || 0)} | ${stPercMql.delta} | ${stPercMql.status} |
| 10 | **CPMQL ⭐** | **${fmtCurr(cpmql)}** | **${fmtCurr(mAds.cpmql || 0)}** | **${stCpmql.delta}** | ${stCpmql.status} |
|    | **— Pré-vendas (MQL) —** | | | | |
| 11 | %RA MQL | ${fmtPct(atual.bx.percRaMql)} | ${fmtPct(mMql.percReuniaoAgendada || 0)} | ${stRaMql.delta} | ${stRaMql.status} |
| 12 | No-show MQL | ${fmtPct(atual.bx.percNoShowMql)} | ${fmtPct(mMql.percNoShow || 0)} | ${stNoShowMql.delta} | ${stNoShowMql.status} |
| 13 | Taxa Vendas MQL | ${fmtPct(atual.bx.percRrVendaMql)} | ${fmtPct(mMql.taxaVendas || 0)} | ${stRrvMql.delta} | ${stRrvMql.status} |
|    | **— Resultado —** | | | | |
| 14 | Negócios Ganhos | ${atual.bx.negocios} | (sem meta) | — | 🔘 |
| 15 | Faturamento Total | ${fmtCurrInt(atual.bx.fatTotal)} | (sem meta) | — | 🔘 |
| 16 | Ticket Médio Geral | ${fmtCurrInt(ticketMedio)} | (sem meta) | — | 🔘 |
| 17 | CAC - Negócios | ${fmtCurrInt(cacNeg)} | (sem meta) | — | 🔘 |

---

## Comparação vs mês anterior (M-1)

| Métrica | ${pm.mes} | Mês anterior | Δ |
|---|---:|---:|---:|
| CPM | ${fmtCurr(atual.ma.cpm)} | ${fmtCurr(cpmPrev)} | ${dM(atual.ma.cpm, cpmPrev, true)} |
| CPL | ${fmtCurr(cpl)} | ${fmtCurr(cplPrev)} | ${dM(cpl, cplPrev, true)} |
| **CPMQL** ⭐ | ${fmtCurr(cpmql)} | ${fmtCurr(cpmqlPrev)} | ${dM(cpmql, cpmqlPrev, true)} |
| Leads | ${atual.bx.leads} | ${prev.bx.leads} | ${dM(atual.bx.leads, prev.bx.leads)} |
| MQLs | ${atual.bx.mqls} | ${prev.bx.mqls} | ${dM(atual.bx.mqls, prev.bx.mqls)} |
| Negócios Ganhos | ${atual.bx.negocios} | ${prev.bx.negocios} | ${dM(atual.bx.negocios, prev.bx.negocios)} |
| Faturamento Total | ${fmtCurrInt(atual.bx.fatTotal)} | ${fmtCurrInt(prev.bx.fatTotal)} | ${dM(atual.bx.fatTotal, prev.bx.fatTotal)} |

---

## Impedimentos

1. Atribuição de funil/plataforma por \`fnl_ngc\` + \`utm_source\` — leads sem utm não entram no recorte de canal.
2. Negócios/Faturamento por \`stage_name='Negócio Ganho'\` em \`data_fechamento\`; atribuição de funil pode atrasar (subconta o mês corrente).
3. Funis/canais sem orçado em \`growth_budgets\` exibem metas 🔘.
${canal !== "metaAds" ? "4. Connect Rate / Tx Conversão da Página dependem do pixel Meta (landing_page_views) — em Google/TikTok saem 🔘.\n" : ""}
---

🤖 Gerado por endpoint \`POST /api/fca/run\` (modo mensal) — skill \`turbo-fca-report\`.`;
}

const CANAL_LABEL: Record<string, string> = { metaAds: "Meta", googleAds: "Google", tiktokAds: "TikTok" };

async function criarTaskClickUp(args: { funil: string; canal: string; nome: string; markdown: string }) {
  const { funil, canal, nome, markdown } = args;
  const funilOpt = FUNIL_CFG[funil]?.clickup;
  if (!funilOpt) throw new Error(`Funil sem mapping ClickUp: ${funil}`);
  const canalOpt = CANAL_CFG[canal]?.clickup;
  if (!canalOpt) throw new Error(`Canal sem mapping ClickUp: ${canal}`);

  const body = {
    name: nome,
    markdown_description: markdown,
    assignees: [Number(CLICKUP_ICHINO_USER_ID)],
    status: "complete",
    custom_fields: [
      { id: CLICKUP_FIELDS.canal, value: [canalOpt] },
      { id: CLICKUP_FIELDS.funil, value: [funilOpt] },
      { id: CLICKUP_FIELDS.tipo, value: [CLICKUP_OPTS.tipo.relatorioMidia] },
      { id: CLICKUP_FIELDS.date, value: Date.now() },
    ],
  };

  const r = await fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_FCA_LIST_ID}/task`, {
    method: "POST",
    headers: { Authorization: CLICKUP_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`ClickUp error ${r.status}: ${err}`);
  }
  return await r.json() as { id: string; url: string };
}

async function updateTaskDescription(taskId: string, markdown: string) {
  const r = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
    method: "PUT",
    headers: { Authorization: CLICKUP_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ markdown_description: markdown }),
  });
  if (!r.ok) throw new Error(`ClickUp update error ${r.status}: ${await r.text()}`);
}

// ===================== FCA v5 (imagem do Aprofundado + FATO/CAUSA/AÇÃO) =====================

// Canal → endpoint de mídia do Aprofundado + utm_source (atribuição das pré-vendas/funil)
// + chave do funnel-by-platform (fonte de Leads/MQLs, IGUAL à tela) + orçado default.
// Todos os 3 canais têm endpoint de mídia próprio (meta/google/tiktok-ads), então a
// imagem é a MESMA que a aba Aprofundado mostra — sem query paralela divergente.
const CANAL_APROFUNDADO: Record<string, { media: string; utm: string; funnelKey: string }> = {
  metaAds: { media: "meta-ads", utm: "facebook", funnelKey: "meta_ads" },
  googleAds: { media: "google-ads", utm: "google", funnelKey: "google_ads" },
  tiktokAds: { media: "tiktok-ads", utm: "tiktok_ads", funnelKey: "tiktok_ads" },
};

// Default de orçado por canal (mesmos da UI). O real vem de getMetas().metricas, que é
// o MESMO JSON que a tela mescla como budgetsData[segmento] → orçado idêntico por construção.
const DEFAULT_ORCADO_BY_CANAL: Record<string, Record<string, number | null | undefined>> = {
  metaAds: DEFAULT_ORCADO_META_ADS,
  googleAds: DEFAULT_ORCADO_GOOGLE_ADS,
  tiktokAds: DEFAULT_ORCADO_TIKTOK_ADS,
};

// Janela 7D rolling (últimos 7 dias fechados = ontem − 6 → ontem).
function periodo7D(now: Date) {
  const ate = new Date(now); ate.setUTCDate(ate.getUTCDate() - 1);
  const de = new Date(ate); de.setUTCDate(de.getUTCDate() - 6);
  const mesRef = fmtDate(ate).slice(0, 7);
  const diasMes = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth() + 1, 0)).getUTCDate();
  return { de: fmtDate(de), ate: fmtDate(ate), mesRef, diasMes, dias: 7 };
}

// Puxa os MESMOS payloads que a aba Aprofundado consome (self-call interno, FCA_API_TOKEN
// autoriza GET). Mídia (detail), funnel-by-platform (Leads/MQLs — FONTE da tela), mql e
// nao-mql — todos com os MESMOS params (funilNgc + utmSource) que a UI passa.
async function fetchAprofundado(canal: string, funil: string, de: string, ate: string) {
  const port = process.env.PORT || "3000";
  const base = `http://127.0.0.1:${port}/api/growth/orcado-realizado`;
  const cfg = CANAL_APROFUNDADO[canal] || CANAL_APROFUNDADO.metaAds;
  const q = `startDate=${de}&endDate=${ate}&funilNgc=${encodeURIComponent(funil)}&utmSource=${cfg.utm}`;
  const headers = { Authorization: `Bearer ${FCA_API_TOKEN}` };
  const j = async (u: string) => {
    const r = await fetch(u, { headers });
    if (!r.ok) throw new Error(`${u} → ${r.status}`);
    return r.json() as any;
  };
  const [media, funnelAll, mql, nmql] = await Promise.all([
    j(`${base}/${cfg.media}?${q}`),
    j(`${base}/funnel-by-platform?${q}`),
    j(`${base}/mql?${q}`),
    j(`${base}/nao-mql?${q}`),
  ]);
  const funnel = (funnelAll?.[cfg.funnelKey] || undefined) as PlatformFunnelData | undefined;
  return { media, funnel, mql, nmql };
}

const numOr = (v: any, d: number | null = null): number | null =>
  (typeof v === "number" && isFinite(v)) ? v : d;
const div = (a: number | null, b: number | null): number | null =>
  (a == null || b == null || b === 0) ? null : a / b;

// Metric (shape da tela) → FcaMetric (shape da imagem). r/o vêm 100% dos builders shared;
// kind/inv são derivados por fcaKindInv (single-source, não diverge linha a linha).
function metricToFca(m: Metric): FcaMetric {
  const { kind, inv } = fcaKindInv(m);
  return {
    name: m.name,
    fmt: m.format,
    kind,
    r: typeof m.realizado === "number" ? m.realizado : null,
    o: typeof m.orcado === "number" ? m.orcado : null,
    inv: inv || undefined,
    indent: m.indent ? true : undefined,
  };
}

// Monta as seções da imagem. A seção "Growth — Mídia" sai DIRETO dos builders shared
// (buildMetaAdsMetrics/Google/TikTokAds) → IDÊNTICA à aba Aprofundado por construção.
// Orçado é MENSAL (a meta do mês, como na tela) — sem escala pra 7D. Pré-vendas e
// Resultado seguem curados (resumo de 3 linhas cada + agregação de vendas).
function montarSecoesV5(args: {
  canal: string;
  media: any;
  funnel: PlatformFunnelData | undefined;
  mql: any; nmql: any;
  orcadoAds: Record<string, number | null | undefined>;
  metasMql: any; metasNmql: any;
}): FcaSection[] {
  const { canal, media, funnel, mql, nmql, orcadoAds, metasMql, metasNmql } = args;
  const mm = metasMql || {}, mn = metasNmql || {};

  const builder = canal === "googleAds" ? buildGoogleAdsMetrics
    : canal === "tiktokAds" ? buildTiktokAdsMetrics
    : buildMetaAdsMetrics;
  const midia: FcaMetric[] = builder(media as any, funnel, orcadoAds).map(metricToFca);

  const invest = numOr(media.investimento, 0)!;
  const somaFat = (d: any) => (numOr(d.faturamentoAceleracao, 0)! + numOr(d.faturamentoImplantacao, 0)!);
  const negocios = numOr(mql.dealsGanhos, 0)! + numOr(nmql.dealsGanhos, 0)!;
  const contratos = numOr(mql.contratosGanhos, 0)! + numOr(nmql.contratosGanhos, 0)!;
  const fatTotal = somaFat(mql) + somaFat(nmql);

  return [
    { title: "Growth — Mídia", metrics: midia },
    { title: "Pré-vendas — MQL", metrics: [
      { name: "%RA MQL", fmt: "percent", kind: "pct", r: numOr(mql.percReuniaoAgendada), o: numOr(mm.percReuniaoAgendada) },
      { name: "% No-show MQL", fmt: "percent", kind: "pct", r: numOr(mql.percNoShow), o: numOr(mm.percNoShow), inv: true },
      { name: "RR→Venda MQL", fmt: "percent", kind: "pct", r: numOr(mql.taxaVendas), o: numOr(mm.taxaVendas) },
    ]},
    { title: "Pré-vendas — Não-MQL", metrics: [
      { name: "%RA Não-MQL", fmt: "percent", kind: "pct", r: numOr(nmql.percReuniaoAgendada), o: numOr(mn.percReuniaoAgendada) },
      { name: "% No-show Não-MQL", fmt: "percent", kind: "pct", r: numOr(nmql.percNoShow), o: numOr(mn.percNoShow), inv: true },
      { name: "RR→Venda Não-MQL", fmt: "percent", kind: "pct", r: numOr(nmql.taxaVendas), o: numOr(mn.taxaVendas) },
    ]},
    { title: "Resultado", metrics: [
      { name: "Negócios Ganhos", fmt: "number", kind: "abs", r: negocios, o: null },
      { name: "Contratos Ganhos", fmt: "number", kind: "abs", r: contratos, o: null },
      { name: "CAC - Negócio", fmt: "currency", kind: "rate", r: div(invest, negocios), o: null, inv: true },
      { name: "CAC - Contrato", fmt: "currency", kind: "rate", r: div(invest, contratos), o: null, inv: true },
      { name: "Ticket Médio", fmt: "currency", kind: "rate", r: div(fatTotal, negocios), o: null },
      { name: "Faturamento Total", fmt: "currency", kind: "abs", r: fatTotal, o: null },
    ]},
  ];
}

const FCA_V5_SYSTEM = `Você é analista de Growth da Turbo Partners escrevendo a análise de um FCA (Fato, Causa, Ação) sobre a tabela Orçado × Realizado (Aprofundado) de um funil × canal, janela de 7 dias. A tabela (imagem) já está no relatório; você escreve SÓ a análise abaixo dela, em markdown PT-BR, direto, sem floreio.

⚠️ PACING — leia antes de acusar qualquer 🔴: o REALIZADO é de 7 dias, mas o ORÇADO é a meta do MÊS INTEIRO. Então para métricas de VOLUME (absolutos: Investimento, Visualizações de Página, Sessões, Leads, MQLs, Negócios/Contratos, Faturamento), o esperado ao 7º dia é ~7/30 ≈ 23% do orçado. % Atingido de ~23% num absoluto é ESTAR NO RITMO, não é vermelho — NÃO trate volume abaixo de 100% como problema; só sinalize se estiver MUITO abaixo do pacing (ex.: <60% do esperado pró-rata, i.e. <~14% do mês). Já as métricas de TAXA e CUSTO (CPM, CPL, CPMQL, % MQLs, Connect Rate, Tx Conversão da Página, %RA, % No-show, RR→Venda) NÃO escalam com o tempo — compare direto com a meta.

Regra de status (o que é 🔴): para TAXA/CUSTO, métrica normal fica 🔴 quando % Atingido < 80%; métrica de custo/no-show (invertida) fica 🔴 quando > 120% da meta. Para VOLUME, avalie contra o pacing (~23% aos 7 dias), não contra 100%.

Estrutura EXATA (use estes headings):

### Fato
- 1 a 2 bullets com as métricas 🔴 mais graves (valor realizado, meta, desvio %).

### Causa
**O que está BOM (descarta as suspeitas óbvias):** liste 2-3 métricas 🟢 que eliminam causas (ex: se CTR e %MQL estão bons, não é criativo/qualificação).
**Onde está o gargalo:** 1-2 vilões (as métricas 🔴 que puxam o resto), numerados.
**Leitura:** 1 frase amarrando — onde o funil realmente quebra.

### Ação
- 3-4 checkboxes \`- [ ]\` específicos e acionáveis. Se o gargalo é pré-vendas/vendas (RA, No-show, RR→Venda), a ação é ESCALAR (1:1 com o responsável, levar a evidência, acordar SLA) — não tente resolver mídia. Termine com 1 item de hipótese em itálico para a próxima FCA cobrar.

Não invente números — use só os fornecidos. Não repita a tabela inteira. Seja conciso.`;

const FALLBACK_NARRATIVA = `### Fato\n\n_(Análise automática indisponível — preencher manualmente sobre a tabela acima.)_\n\n### Causa\n\n_(pendente)_\n\n### Ação\n\n- [ ] Revisar a tabela e registrar o gargalo principal.`;

// Gera a narrativa via IA com fallback multi-provider: Anthropic (paridade com prod) →
// OpenAI → Gemini → texto fallback. Prefere sempre Anthropic; se a key não for real
// (ex.: placeholder no .env local), cai pro próximo provider com key válida.
// Assim o endpoint funciona idêntico em prod e local sem depender de uma única key.
async function callNarrativaLlm(system: string, user: string): Promise<{ text: string; provider: string } | null> {
  const anthKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  const oaKey = (process.env.OPENAI_API_KEY || "").trim();
  const gemKey = (process.env.GOOGLE_GEMINI_API_KEY || "").trim();

  if (anthKey.startsWith("sk-ant")) {
    try {
      const anthropic = new Anthropic({ apiKey: anthKey });
      const msg = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1600,
        system,
        messages: [{ role: "user", content: user }],
      });
      const txt = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      if (txt) return { text: txt, provider: "anthropic/claude-opus-4-8" };
    } catch (e: any) { console.error("[fca v5] Anthropic falhou:", e?.message); }
  }

  if (oaKey.startsWith("sk-") && oaKey.length > 20) {
    try {
      const openai = new OpenAI({ apiKey: oaKey });
      const resp = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1600,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      });
      const txt = (resp.choices?.[0]?.message?.content || "").trim();
      if (txt) return { text: txt, provider: "openai/gpt-4o" };
    } catch (e: any) { console.error("[fca v5] OpenAI falhou:", e?.message); }
  }

  if (gemKey.startsWith("AIza")) {
    try {
      const genAI = new GoogleGenerativeAI(gemKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: system });
      const r = await model.generateContent(user);
      const txt = (r.response.text() || "").trim();
      if (txt) return { text: txt, provider: "google/gemini-2.0-flash" };
    } catch (e: any) { console.error("[fca v5] Gemini falhou:", e?.message); }
  }

  return null;
}

async function gerarNarrativaV5(sections: FcaSection[], ctx: { funil: string; canal: string; de: string; ate: string; diasMes: number }): Promise<string> {
  // Resumo textual das linhas (nome · orçado · realizado · % atingido) pro modelo raciocinar.
  // Absolutos ganham o pacing esperado (7/diasMes) pra o modelo não confundir volume com 🔴.
  const pacingPct = Math.round((7 / ctx.diasMes) * 100);
  const resumo = sections.map(s => {
    const linhas = s.metrics.map(x => {
      const pct = (x.o && x.o !== 0 && x.r != null) ? Math.round((x.r / x.o) * 100) + "%" : "s/meta";
      const fr = x.r == null ? "—" : (x.fmt === "percent" ? (x.r * 100).toFixed(1) + "%" : x.fmt === "currency" ? "R$" + x.r.toFixed(2) : String(x.r));
      const fo = x.o == null ? "—" : (x.fmt === "percent" ? (x.o * 100).toFixed(1) + "%" : x.fmt === "currency" ? "R$" + x.o.toFixed(2) : String(x.o));
      // Volume = orçado mensal → anota o esperado pró-rata pra 7 dias.
      const pacing = (x.kind === "abs" && x.o && x.o !== 0)
        ? ` [volume: esperado ~${pacingPct}% aos 7d]` : "";
      return `${x.indent ? "  " : ""}${x.name}: real=${fr} orçado=${fo} atingido=${pct}${x.inv ? " (menor é melhor)" : ""}${pacing}`;
    }).join("\n");
    return `## ${s.title}\n${linhas}`;
  }).join("\n\n");
  const user = `Funil ${ctx.funil} × ${ctx.canal}, 7 dias (${ctx.de} a ${ctx.ate}). Orçado = meta do mês (~${ctx.diasMes} dias); pacing esperado de VOLUME aos 7 dias ≈ ${pacingPct}%.\n\n${resumo}`;
  const r = await callNarrativaLlm(FCA_V5_SYSTEM, user);
  if (r) {
    console.log(`[fca v5] narrativa gerada via ${r.provider}`);
    return r.text;
  }
  console.warn("[fca v5] nenhum provider de IA com key válida — usando fallback");
  return FALLBACK_NARRATIVA;
}

export function registerFcaRoutes(app: Express) {
  app.get("/api/fca/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      version: "v5.0",
      endpoint: "POST /api/fca/run",
      formatoDefault: "v5 (imagem do Aprofundado + FATO/CAUSA/AÇÃO, janela 7D)",
      params: {
        funil: "Creators|Ecommerce|CRM|Summit",
        canal: "metaAds|googleAds|tiktokAds",
        createTask: "bool",
        legacy: "modo:'mensal' → tabela mensal antiga; formato:'legacy' → markdown semanal antigo",
      },
      auth: "Authorization: Bearer <FCA_API_TOKEN>",
      funilSuportado: Object.keys(FUNIL_CFG),
      canalSuportado: Object.keys(CANAL_CFG),
      tokenConfigured: Boolean(FCA_API_TOKEN),
      time: new Date().toISOString(),
    });
  });

  app.post("/api/fca/run", bearerAuth, async (req: Request, res: Response) => {
    try {
      const funil = (req.body?.funil || "Creators") as string;
      const canal = (req.body?.canal || "metaAds") as string;
      const modo = req.body?.modo === "mensal" ? "mensal" : "weekly";
      const createTask = req.body?.createTask !== false;
      // v5 (imagem do Aprofundado + FATO/CAUSA/AÇÃO, 7D) é o DEFAULT desde 08/07.
      // Legacy (markdown antigo) só sob pedido explícito:
      //   { modo: "mensal" }                → tabela mensal antiga
      //   { formato: "legacy" | "weekly" }  → markdown semanal antigo
      const legacy = modo === "mensal"
        || req.body?.formato === "legacy"
        || req.body?.formato === "weekly";

      const funilCfg = FUNIL_CFG[funil];
      if (!funilCfg) {
        return res.status(400).json({ error: `Funil inválido: ${funil}. Suportados: ${Object.keys(FUNIL_CFG).join(", ")}` });
      }
      const canalCfg = CANAL_CFG[canal];
      if (!canalCfg) {
        return res.status(400).json({ error: `Canal inválido: ${canal}. Suportados: ${Object.keys(CANAL_CFG).join(", ")}` });
      }
      const platUtm = canalCfg.platformUtm;
      const campaignLike = funilCfg.campaignLike;
      const fnlNgc = funilCfg.fnlNgc;
      const now = new Date();

      // ===== FORMATO V5 (imagem do Aprofundado + FATO/CAUSA/AÇÃO, janela 7D) — DEFAULT =====
      if (!legacy) {
        const p7 = periodo7D(now);
        const [mAds, mMql, mNmql] = await Promise.all([
          getMetas(funil, p7.mesRef, canalCfg.segmento),
          getMetas(funil, p7.mesRef, "mql"),
          getMetas(funil, p7.mesRef, "nao_mql"),
        ]);
        const dados = await fetchAprofundado(canal, funil, p7.de, p7.ate);
        // Orçado = meta MENSAL, mesclada como na tela ({...DEFAULT, ...budgets[segmento]}).
        const orcadoAds = { ...(DEFAULT_ORCADO_BY_CANAL[canal] || DEFAULT_ORCADO_META_ADS), ...(mAds.metricas || {}) };
        const sections = montarSecoesV5({
          canal, media: dados.media, funnel: dados.funnel, mql: dados.mql, nmql: dados.nmql,
          orcadoAds, metasMql: mMql.metricas, metasNmql: mNmql.metricas,
        });
        const canalLabel = CANAL_LABEL[canal] || canal;
        const png = await renderAprofundadoImage({
          titulo: `Orçado × Realizado — Aprofundado · ${funil} × ${canalLabel}`,
          subtitulo: `Realizado últimos 7 dias · ${fmtBR(p7.de)}–${fmtBR(p7.ate)} · Orçado = meta do mês`,
          // Orçado é mensal: propDias=1 → % Atingido = realizado/meta-do-mês (pacing);
          // Previsão As Is = realizado; Recálculo desligado (diasRestantes=0).
          sections, propDias: 1, diasMes: p7.diasMes, diasRestantes: 0,
        });
        const narrativa = await gerarNarrativaV5(sections, { funil, canal, de: p7.de, ate: p7.ate, diasMes: p7.diasMes });

        if (!createTask) {
          return res.json({ ok: true, formato: "v5", funil, canal, periodo: p7, sections, narrativa, note: "createTask=false — imagem não anexada" });
        }
        const task = await criarTaskClickUp({
          funil, canal,
          nome: `[FCA] ${funil} · ${canalLabel} — 7D (${fmtBR(p7.de)}–${fmtBR(p7.ate)})`,
          markdown: "_gerando relatório…_",
        });
        const imgUrl = await uploadFcaImage(task.id, png, CLICKUP_API_KEY, `fca-${funil}-${canal}-7d.png`);
        const md = `# [FCA] ${funil} × ${canalLabel} — 7D (${fmtBR(p7.de)}–${fmtBR(p7.ate)})

**Período:** ${fmtBR(p7.de)} a ${fmtBR(p7.ate)} — Últimos 7 dias

![Orçado × Realizado — Aprofundado · ${funil} × ${canalLabel} · 7D](${imgUrl})

${narrativa}

🤖 FCA v5 — imagem do Aprofundado renderizada + FATO/CAUSA/AÇÃO`;
        await updateTaskDescription(task.id, md);
        return res.json({ ok: true, formato: "v5", funil, canal, periodo: p7, task, imgUrl });
      }

      // ===== MODO MENSAL =====
      if (modo === "mensal") {
        const pm = periodosMensal(now, req.body?.mes);
        const [mAds, mMql, mNmql] = await Promise.all([
          getMetas(funil, pm.mes, canalCfg.segmento),
          getMetas(funil, pm.mes, "mql"),
          getMetas(funil, pm.mes, "nao_mql"),
        ]);
        const [maAtual, bxAtual, maPrev, bxPrev] = await Promise.all([
          midiaRealizado(canal, campaignLike, pm.principal),
          bitrixRealizado(fnlNgc, platUtm, pm.principal),
          midiaRealizado(canal, campaignLike, pm.prev),
          bitrixRealizado(fnlNgc, platUtm, pm.prev),
        ]);
        const markdown = montarMarkdownMensal({
          funil,
          canal,
          pm,
          metas: { metaAds: mAds.metricas, mql: mMql.metricas, nmql: mNmql.metricas },
          atual: { ma: maAtual, bx: bxAtual, invest: maAtual.investimento },
          prev: { ma: maPrev, bx: bxPrev, invest: maPrev.investimento },
        });
        let taskResult: { id: string; url: string } | null = null;
        if (createTask) {
          taskResult = await criarTaskClickUp({
            funil,
            canal,
            nome: `[FCA] ${funil} · ${CANAL_LABEL[canal] || canal} - Mensal ${pm.mes}`,
            markdown,
          });
        }
        return res.json({ ok: true, modo, funil, canal, periodos: pm, task: taskResult, markdown });
      }

      // ===== MODO SEMANAL (default) =====
      const p = periodos(now);

      const [metaAdsMTD, mqlMTD, nmqlMTD] = await Promise.all([
        getMetas(funil, p.mesRef, canalCfg.segmento),
        getMetas(funil, p.mesRef, "mql"),
        getMetas(funil, p.mesRef, "nao_mql"),
      ]);

      const [maMTD, bxMTD, maW, bxW, maWp, bxWp] = await Promise.all([
        midiaRealizado(canal, campaignLike, p.mtd),
        bitrixRealizado(fnlNgc, platUtm, p.mtd),
        midiaRealizado(canal, campaignLike, p.semana),
        bitrixRealizado(fnlNgc, platUtm, p.semana),
        midiaRealizado(canal, campaignLike, p.semanaPrev),
        bitrixRealizado(fnlNgc, platUtm, p.semanaPrev),
      ]);

      const markdown = montarMarkdown({
        funil,
        p,
        metas: { metaAds: metaAdsMTD.metricas, mql: mqlMTD.metricas, nmql: nmqlMTD.metricas },
        mtd: { ma: maMTD, bx: bxMTD, invest: maMTD.investimento },
        w: { ma: maW, bx: bxW, invest: maW.investimento },
        wPrev: { ma: maWp, bx: bxWp, invest: maWp.investimento },
      });

      let taskResult: { id: string; url: string } | null = null;
      if (createTask) {
        taskResult = await criarTaskClickUp({
          funil,
          canal,
          nome: `[FCA] ${funil} · ${CANAL_LABEL[canal] || canal} - Semana 2026-W${p.semana.num} (${fmtBR(p.semana.de)}-${fmtBR(p.semana.ate)})`,
          markdown,
        });
      }

      return res.json({
        ok: true,
        modo,
        funil,
        canal,
        periodos: p,
        task: taskResult,
        markdown,
      });
    } catch (error: any) {
      console.error("[fca] Error:", error);
      return res.status(500).json({ error: error.message || "Internal error", stack: error.stack });
    }
  });

  console.log("[fca] Routes registered: GET /api/fca/health, POST /api/fca/run");
}

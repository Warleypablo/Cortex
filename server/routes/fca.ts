import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

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
  canal: { metaAds: "2b7e74d1-78ec-4d5b-a0c8-553b64d2d1c0" },
  funil: {
    Creators: "d96d739e-a3f0-4c2e-9edb-5e22a0d84d05",
    Ecommerce: "62a087fc-73a5-4bbd-bddc-aaa9caeb1c5d",
  },
  tipo: { relatorioMidia: "3ca91709-20ed-4c67-9e60-1a5525f522d9" },
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

async function metaAdsRealizado(funil: string, p: Periodo) {
  const funilLower = funil.toLowerCase();
  const r = await db.execute(sql`
    SELECT
      COALESCE(SUM(i.spend), 0)::float AS investimento,
      COALESCE(SUM(i.impressions), 0)::bigint AS impressoes,
      COALESCE(SUM(i.outbound_clicks), 0)::bigint AS oc,
      COALESCE(SUM(i.landing_page_views), 0)::bigint AS lpv
    FROM meta_ads.meta_insights_daily i
    JOIN meta_ads.meta_campaigns c ON c.campaign_id = i.campaign_id
    WHERE i.date_start BETWEEN ${p.de} AND ${p.ate}
      AND LOWER(c.campaign_name) LIKE ${"%" + funilLower + "%"}
  `);
  const row = r.rows[0] as any;
  const imps = Number(row.impressoes) || 0;
  const oc = Number(row.oc) || 0;
  const invest = Number(row.investimento) || 0;
  return {
    investimento: invest,
    impressoes: imps,
    outboundClicks: oc,
    lpv: Number(row.lpv) || 0,
    cpm: imps ? (invest / imps) * 1000 : 0,
    ctr: imps ? oc / imps : 0,
  };
}

async function bitrixRealizado(funil: string, p: Periodo) {
  const funilLike = funil;
  const vol = await db.execute(sql`
    SELECT
      COUNT(*)::int AS leads,
      SUM(CASE WHEN mql::text='1' OR LOWER(mql::text)='true' THEN 1 ELSE 0 END)::int AS mqls
    FROM "Bitrix".crm_deal
    WHERE created_at BETWEEN ${p.de} AND ${p.ate}
      AND fnl_ngc ILIKE ${funilLike}
  `);
  const ra = await db.execute(sql`
    SELECT
      SUM(CASE WHEN mql::text='1' OR LOWER(mql::text)='true' THEN 1 ELSE 0 END)::int AS rm_mql,
      SUM(CASE WHEN NOT (mql::text='1' OR LOWER(mql::text)='true') THEN 1 ELSE 0 END)::int AS rm_nmql
    FROM "Bitrix".crm_deal
    WHERE data_reuniao_agendada BETWEEN ${p.de} AND ${p.ate}
      AND fnl_ngc ILIKE ${funilLike}
  `);
  const rr = await db.execute(sql`
    SELECT
      SUM(CASE WHEN mql::text='1' OR LOWER(mql::text)='true' THEN 1 ELSE 0 END)::int AS rr_mql,
      SUM(CASE WHEN NOT (mql::text='1' OR LOWER(mql::text)='true') THEN 1 ELSE 0 END)::int AS rr_nmql
    FROM "Bitrix".crm_deal
    WHERE data_reuniao_realizada BETWEEN ${p.de} AND ${p.ate}
      AND fnl_ngc ILIKE ${funilLike}
  `);
  const vendas = await db.execute(sql`
    SELECT
      SUM(CASE WHEN stage='Negócio Ganho' THEN 1 ELSE 0 END)::int AS negocios,
      SUM(CASE WHEN stage='Negócio Ganho' AND (mql::text='1' OR LOWER(mql::text)='true') THEN 1 ELSE 0 END)::int AS neg_mql,
      SUM(CASE WHEN stage='Negócio Ganho' AND NOT (mql::text='1' OR LOWER(mql::text)='true') THEN 1 ELSE 0 END)::int AS neg_nmql,
      SUM(CASE WHEN stage='Negócio Ganho' AND COALESCE(valor_pontual,0)>0 THEN 1 ELSE 0 END)::int AS c_impl,
      SUM(CASE WHEN stage='Negócio Ganho' AND COALESCE(valor_recorrente,0)>0 THEN 1 ELSE 0 END)::int AS c_acel,
      COALESCE(SUM(CASE WHEN stage='Negócio Ganho' THEN COALESCE(valor_pontual,0) ELSE 0 END), 0)::float AS fat_impl,
      COALESCE(SUM(CASE WHEN stage='Negócio Ganho' THEN COALESCE(valor_recorrente,0) ELSE 0 END), 0)::float AS fat_acel
    FROM "Bitrix".crm_deal
    WHERE data_fechamento BETWEEN ${p.de} AND ${p.ate}
      AND fnl_ngc ILIKE ${funilLike}
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

async function criarTaskClickUp(args: { funil: string; semanaNum: number; semana: Periodo; markdown: string }) {
  const { funil, semanaNum, semana, markdown } = args;
  const nome = `[FCA] ${funil} - Semana 2026-W${semanaNum} (${fmtBR(semana.de)}-${fmtBR(semana.ate)})`;
  const funilOpt = CLICKUP_OPTS.funil[funil];
  if (!funilOpt) throw new Error(`Funil sem mapping ClickUp: ${funil}`);

  const body = {
    name: nome,
    markdown_description: markdown,
    assignees: [Number(CLICKUP_ICHINO_USER_ID)],
    status: "complete",
    custom_fields: [
      { id: CLICKUP_FIELDS.canal, value: [CLICKUP_OPTS.canal.metaAds] },
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

export function registerFcaRoutes(app: Express) {
  app.get("/api/fca/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      version: "v3.14",
      endpoint: "POST /api/fca/run",
      auth: "Authorization: Bearer <FCA_API_TOKEN>",
      funilSuportado: ["Creators"],
      tokenConfigured: Boolean(FCA_API_TOKEN),
      time: new Date().toISOString(),
    });
  });

  app.post("/api/fca/run", bearerAuth, async (req: Request, res: Response) => {
    try {
      const funil = (req.body?.funil || "Creators") as string;
      const createTask = req.body?.createTask !== false;
      const now = new Date();
      const p = periodos(now);

      const [metaAdsMTD, mqlMTD, nmqlMTD] = await Promise.all([
        getMetas(funil, p.mesRef, "meta_ads"),
        getMetas(funil, p.mesRef, "mql"),
        getMetas(funil, p.mesRef, "nao_mql"),
      ]);

      const [maMTD, bxMTD, maW, bxW, maWp, bxWp] = await Promise.all([
        metaAdsRealizado(funil, p.mtd),
        bitrixRealizado(funil, p.mtd),
        metaAdsRealizado(funil, p.semana),
        bitrixRealizado(funil, p.semana),
        metaAdsRealizado(funil, p.semanaPrev),
        bitrixRealizado(funil, p.semanaPrev),
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
          semanaNum: p.semana.num,
          semana: p.semana,
          markdown,
        });
      }

      return res.json({
        ok: true,
        funil,
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

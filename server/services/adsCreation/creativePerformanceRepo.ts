/**
 * Read-back de performance da Biblioteca de Criativos.
 *
 * Junta creative_ad_links → meta_insights_daily (métricas pagas, batem com a aba Criativos)
 * e → Bitrix.crm_deal via utm_content = ad_id (leads/vendas/receita — versão core do funil;
 * o detalhamento MQL/RA/RR pode ser somado depois).
 *
 * Dois modos:
 *   - getCreativePerformance: 1 linha por criativo (TP)
 *   - getCreativeRanking:     agregado por atributo (angulo/persona/tipo/produto/body/cta)
 */

import { pool } from "../../db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(d: string, label: string): string {
  if (!DATE_RE.test(d)) throw new Error(`${label} inválida (use YYYY-MM-DD)`);
  return d;
}

// Atributos válidos para agrupar o ranking → mapeados pra coluna real (evita SQL injection).
const DIMENSION_COLUMN: Record<string, string> = {
  angulo: "angulo",
  personagem: "personagem",
  tipo: "tipo_ad",
  tipoAd: "tipo_ad",
  formato: "formato_ad",
  proporcao: "proporcao",
  produto: "produto",
  bodyTipo: "body_tipo",
  ctaTipo: "cta_tipo",
};

export interface CreativeRawRow {
  creativeId: number;
  tpId: string;
  nomeDrive: string;
  adId: string | null; // ad_id representativo (pra link de preview no Gerenciador)
  angulo: string | null;
  personagem: string | null;
  tipoAd: string | null;
  formatoAd: string | null;
  proporcao: string | null;
  produto: string | null;
  bodyTipo: string | null;
  ctaTipo: string | null;
  adCount: number;
  spend: number;
  impressions: number;
  clicks: number;
  v3s: number;
  thruplay: number;
  leads: number;
  mqls: number;
  vendas: number;
  clientesUnicos: number;
  receita: number;
  noAr: boolean;              // algum ad vinculado ACTIVE no Meta
  firstDelivery: string | null; // 1ª data com impressão (YYYY-MM-DD)
}

/** Agregação bruta por criativo (1 linha por TP que tenha pelo menos 1 ad vinculado). */
async function fetchCreativeRawRows(since: string, until: string): Promise<CreativeRawRow[]> {
  const sql = `
    WITH links AS (
      SELECT DISTINCT creative_id, ad_id FROM cortex_core.creative_ad_links
    ),
    ids AS (
      SELECT creative_id, MIN(ad_id) AS ad_id FROM links GROUP BY creative_id
    ),
    ins AS (
      SELECT l.creative_id,
        COUNT(DISTINCT l.ad_id)                              AS ad_count,
        SUM(COALESCE(i.spend,0))                             AS spend,
        SUM(COALESCE(i.impressions,0))                       AS impressions,
        -- CTR de saída (outbound) — igual à aba Criativos
        SUM(COALESCE(i.outbound_clicks,0))                   AS clicks,
        SUM(COALESCE(i.video_3_sec_watched_actions,0))       AS v3s,
        SUM(COALESCE(i.video_thruplay_watched_actions,0))    AS thruplay,
        MIN(i.date_start) FILTER (WHERE COALESCE(i.impressions,0) > 0) AS first_delivery
      FROM links l
      JOIN meta_ads.meta_insights_daily i
        ON i.ad_id = l.ad_id
       AND i.date_start >= $1::date AND i.date_start <= $2::date
      GROUP BY l.creative_id
    ),
    -- "No ar" = algum ad vinculado está ACTIVE no Meta
    ad_status AS (
      SELECT l.creative_id, bool_or(a.effective_status = 'ACTIVE') AS no_ar
      FROM links l
      JOIN meta_ads.meta_ads a ON a.ad_id = l.ad_id
      GROUP BY l.creative_id
    ),
    crm AS (
      SELECT l.creative_id,
        COUNT(*) FILTER (
          WHERE d.date_create >= $1::date AND d.date_create < ($2::date + INTERVAL '1 day')
        ) AS leads,
        COUNT(*) FILTER (
          WHERE d.date_create >= $1::date AND d.date_create < ($2::date + INTERVAL '1 day')
            AND (d.mql::text = '1' OR LOWER(d.mql::text) = 'true')
        ) AS mqls,
        COUNT(*) FILTER (
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= $1::date AND d.data_fechamento <= $2::date
        ) AS vendas,
        COUNT(DISTINCT COALESCE(d.company_name, d.contact_name, d.title)) FILTER (
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= $1::date AND d.data_fechamento <= $2::date
        ) AS clientes_unicos,
        SUM(CASE WHEN d.stage_name = 'Negócio Ganho'
                  AND d.data_fechamento >= $1::date AND d.data_fechamento <= $2::date
                 THEN COALESCE(d.valor_pontual,0) + COALESCE(d.valor_recorrente,0) ELSE 0 END) AS receita
      FROM links l
      JOIN "Bitrix".crm_deal d ON d.utm_content = l.ad_id
      GROUP BY l.creative_id
    )
    SELECT c.id AS creative_id, c.tp_id, c.nome_drive, ids.ad_id,
           c.angulo, c.personagem, c.tipo_ad, c.formato_ad, c.proporcao, c.produto, c.body_tipo, c.cta_tipo,
           COALESCE(ins.ad_count,0)    AS ad_count,
           COALESCE(ins.spend,0)       AS spend,
           COALESCE(ins.impressions,0) AS impressions,
           COALESCE(ins.clicks,0)      AS clicks,
           COALESCE(ins.v3s,0)         AS v3s,
           COALESCE(ins.thruplay,0)    AS thruplay,
           COALESCE(crm.leads,0)            AS leads,
           COALESCE(crm.mqls,0)             AS mqls,
           COALESCE(crm.vendas,0)           AS vendas,
           COALESCE(crm.clientes_unicos,0)  AS clientes_unicos,
           COALESCE(crm.receita,0)          AS receita,
           ins.first_delivery::text AS first_delivery,
           COALESCE(ad_status.no_ar, false) AS no_ar
    FROM cortex_core.creatives_library c
    JOIN ids ON ids.creative_id = c.id
    LEFT JOIN ins ON ins.creative_id = c.id
    LEFT JOIN ad_status ON ad_status.creative_id = c.id
    LEFT JOIN crm ON crm.creative_id = c.id
    WHERE c.deleted_at IS NULL
  `;
  const r = await pool.query(sql, [since, until]);
  return r.rows.map((x: any) => ({
    creativeId: x.creative_id,
    tpId: x.tp_id,
    nomeDrive: x.nome_drive,
    adId: x.ad_id ?? null,
    angulo: x.angulo,
    personagem: x.personagem,
    tipoAd: x.tipo_ad,
    formatoAd: x.formato_ad,
    proporcao: x.proporcao,
    produto: x.produto,
    bodyTipo: x.body_tipo,
    ctaTipo: x.cta_tipo,
    adCount: Number(x.ad_count) || 0,
    spend: Number(x.spend) || 0,
    impressions: Number(x.impressions) || 0,
    clicks: Number(x.clicks) || 0,
    v3s: Number(x.v3s) || 0,
    thruplay: Number(x.thruplay) || 0,
    leads: Number(x.leads) || 0,
    mqls: Number(x.mqls) || 0,
    vendas: Number(x.vendas) || 0,
    clientesUnicos: Number(x.clientes_unicos) || 0,
    receita: Number(x.receita) || 0,
    noAr: x.no_ar === true,
    firstDelivery: x.first_delivery ? String(x.first_delivery).slice(0, 10) : null,
  }));
}

interface RawAgg {
  adCount: number; spend: number; impressions: number; clicks: number;
  v3s: number; thruplay: number; leads: number; mqls: number; vendas: number; clientesUnicos: number; receita: number;
}

function emptyAgg(): RawAgg {
  return { adCount: 0, spend: 0, impressions: 0, clicks: 0, v3s: 0, thruplay: 0, leads: 0, mqls: 0, vendas: 0, clientesUnicos: 0, receita: 0 };
}
function addAgg(a: RawAgg, x: RawAgg) {
  a.adCount += x.adCount; a.spend += x.spend; a.impressions += x.impressions; a.clicks += x.clicks;
  a.v3s += x.v3s; a.thruplay += x.thruplay; a.leads += x.leads; a.mqls += x.mqls; a.vendas += x.vendas;
  a.clientesUnicos += x.clientesUnicos; a.receita += x.receita;
}

/** Métricas derivadas dos contadores brutos. Pagas batem com a aba Criativos (mesma fonte). */
function derive(r: RawAgg) {
  const round = (n: number) => Math.round(n);
  const pct = (n: number, d: number) => (d > 0 ? parseFloat(((n / d) * 100).toFixed(2)) : null);
  return {
    spend: round(r.spend),
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: pct(r.clicks, r.impressions),
    cpm: r.impressions > 0 ? parseFloat(((r.spend / r.impressions) * 1000).toFixed(2)) : null,
    hookRate: pct(r.v3s, r.impressions),       // 3s / impressões
    holdRate: pct(r.thruplay, r.impressions),  // thruplay / impressões
    leads: r.leads,
    mqls: r.mqls,
    percMql: pct(r.mqls, r.leads),             // % dos leads que viraram MQL
    vendas: r.vendas,
    receita: round(r.receita),
    cpl: r.leads > 0 ? round(r.spend / r.leads) : null,
    // CAC por cliente único (igual à aba Criativos), não por nº de vendas
    cac: r.clientesUnicos > 0 ? round(r.spend / r.clientesUnicos) : null,
    roas: r.spend > 0 ? parseFloat((r.receita / r.spend).toFixed(2)) : null,
  };
}

export async function getCreativePerformance(opts: { since: string; until: string }) {
  const since = assertDate(opts.since, "since");
  const until = assertDate(opts.until, "until");
  const rows = await fetchCreativeRawRows(since, until);
  return rows
    .map((r) => ({
      creativeId: r.creativeId,
      tpId: r.tpId,
      nomeDrive: r.nomeDrive,
      adId: r.adId,
      angulo: r.angulo,
      personagem: r.personagem,
      tipoAd: r.tipoAd,
      formatoAd: r.formatoAd,
      proporcao: r.proporcao,
      produto: r.produto,
      bodyTipo: r.bodyTipo,
      ctaTipo: r.ctaTipo,
      adCount: r.adCount,
      noAr: r.noAr,
      dataVeiculacao: r.firstDelivery,
      ...derive(r),
    }))
    .sort((a, b) => b.spend - a.spend);
}

export async function getCreativeRanking(opts: { since: string; until: string; dimension: string }) {
  const since = assertDate(opts.since, "since");
  const until = assertDate(opts.until, "until");
  const col = DIMENSION_COLUMN[opts.dimension];
  if (!col) throw new Error(`dimension inválida: ${opts.dimension}`);

  const rows = await fetchCreativeRawRows(since, until);
  const fieldByCol: Record<string, keyof CreativeRawRow> = {
    angulo: "angulo", personagem: "personagem", tipo_ad: "tipoAd",
    formato_ad: "formatoAd", proporcao: "proporcao",
    produto: "produto", body_tipo: "bodyTipo", cta_tipo: "ctaTipo",
  };
  const field = fieldByCol[col];

  const groups = new Map<string, { value: string; tpIds: Set<string>; agg: RawAgg }>();
  for (const r of rows) {
    const value = (r[field] as string | null) ?? "(sem)";
    let g = groups.get(value);
    if (!g) { g = { value, tpIds: new Set(), agg: emptyAgg() }; groups.set(value, g); }
    g.tpIds.add(r.tpId);
    addAgg(g.agg, r);
  }

  return Array.from(groups.values())
    .map((g) => ({
      dimension: opts.dimension,
      value: g.value,
      criativos: g.tpIds.size,
      ...derive(g.agg),
    }))
    .sort((a, b) => b.spend - a.spend);
}

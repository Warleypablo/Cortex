// FCA — Run mensal Creators, Junho/2026 MTD vs Plano de Mídia (junho)
// Período principal: 2026-06-01 a 2026-06-15 (15 dias fechados; hoje=16/jun)
// Comparação: metas = plano de junho (growth_budgets 2026-06 = seed do plano v7)
import { Client } from 'pg';
import { readFileSync } from 'fs';

const env = readFileSync('/Users/ichino/Projects/Cortex/Cortex/.env', 'utf8');
const url = env.match(/DATABASE_URL=([^\n]+)/)[1].trim();

const FUNIL = 'Creators';
const MTD = { de: '2026-06-01', ate: '2026-06-15' };
const MES = '2026-06';
const MES_FALLBACK = '2026-05';
const DIAS_MTD = 15;
const DIAS_MES = 30;

const c = new Client({ connectionString: url, ssl: false });
await c.connect();

// ============= sanity: cobertura de dados =============
const cov = await c.query(`
  SELECT MAX(date_start) AS max_date, MIN(date_start) AS min_jun
  FROM meta_ads.meta_insights_daily WHERE date_start >= '2026-06-01'
`);
console.log('=== COBERTURA META INSIGHTS (jun) ===', cov.rows[0]);

// ============= PASSO 1: METAS (plano de junho) =============
async function getMetas(segmento) {
  for (const mesTry of [MES, MES_FALLBACK]) {
    const fSpec = await c.query(`
      SELECT metricas FROM meta_ads.growth_budgets
      WHERE mes = $1 AND segmento = $2 AND funil = $3
    `, [mesTry, segmento, FUNIL]);
    if (fSpec.rows.length) return { metricas: fSpec.rows[0].metricas, fonte: `${FUNIL}/${mesTry}/${segmento}` };
  }
  for (const mesTry of [MES, MES_FALLBACK]) {
    const fAll = await c.query(`
      SELECT metricas FROM meta_ads.growth_budgets
      WHERE mes = $1 AND segmento = $2 AND funil = 'todos'
    `, [mesTry, segmento]);
    if (fAll.rows.length) return { metricas: fAll.rows[0].metricas, fonte: `todos/${mesTry}/${segmento}` };
  }
  return { metricas: {}, fonte: 'NENHUMA' };
}

const metasMeta = await getMetas('meta_ads');
const metasMql = await getMetas('mql');
const metasNmql = await getMetas('nao_mql');
console.log('\n=== METAS (plano junho) ===');
console.log(`meta_ads (${metasMeta.fonte}):`, JSON.stringify(metasMeta.metricas));
console.log(`mql      (${metasMql.fonte}):`, JSON.stringify(metasMql.metricas));
console.log(`nao_mql  (${metasNmql.fonte}):`, JSON.stringify(metasNmql.metricas));

// ============= PASSO 2: REALIZADO META ADS =============
async function metaAdsRealizado({ de, ate }) {
  const r = await c.query(`
    SELECT
      COALESCE(SUM(i.spend), 0) AS investimento,
      COALESCE(SUM(i.impressions), 0) AS impressoes,
      COALESCE(SUM(i.clicks), 0) AS clicks,
      COALESCE(SUM(i.outbound_clicks), 0) AS outbound_clicks,
      COALESCE(SUM(i.landing_page_views), 0) AS lpv,
      COALESCE(SUM(i.video_3_sec_watched_actions), 0) AS v3sec,
      COALESCE(SUM(i.video_thruplay_watched_actions), 0) AS vtp
    FROM meta_ads.meta_insights_daily i
    JOIN meta_ads.meta_campaigns c ON c.campaign_id = i.campaign_id
    WHERE i.date_start BETWEEN $1 AND $2
      AND LOWER(c.campaign_name) LIKE '%creators%'
  `, [de, ate]);
  const row = r.rows[0];
  const impressoes = Number(row.impressoes) || 0;
  const outboundClicks = Number(row.outbound_clicks) || 0;
  const investimento = Number(row.investimento) || 0;
  const lpv = Number(row.lpv) || 0;
  return {
    investimento, impressoes,
    clicks: Number(row.clicks) || 0,
    outboundClicks, lpv,
    cpm: impressoes ? (investimento / impressoes) * 1000 : 0,
    ctr: impressoes ? outboundClicks / impressoes : 0,
    connectRate: outboundClicks ? lpv / outboundClicks : 0,
    hook: impressoes ? Number(row.v3sec) / impressoes : 0,
    hold: impressoes ? Number(row.vtp) / impressoes : 0,
  };
}

const metaMtd = await metaAdsRealizado(MTD);
console.log('\n=== META ADS REALIZADO (1-15/jun) ===');
console.log(metaMtd);

// ============= drill por campanha =============
const drill = await c.query(`
  SELECT c.campaign_name AS nome,
    SUM(i.spend) AS spend,
    SUM(i.impressions) AS impressoes,
    SUM(i.outbound_clicks) AS oc,
    SUM(i.landing_page_views) AS lpv,
    SUM(i.spend)/NULLIF(SUM(i.impressions),0)*1000 AS cpm,
    SUM(i.outbound_clicks)::float/NULLIF(SUM(i.impressions),0) AS ctr
  FROM meta_ads.meta_insights_daily i
  JOIN meta_ads.meta_campaigns c ON c.campaign_id = i.campaign_id
  WHERE i.date_start BETWEEN $1 AND $2
    AND LOWER(c.campaign_name) LIKE '%creators%'
  GROUP BY c.campaign_name
  ORDER BY spend DESC
`, [MTD.de, MTD.ate]);
console.log('\n=== DRILL CAMPANHAS ===');
for (const r of drill.rows) {
  console.log(`${r.nome} | spend=${Number(r.spend).toFixed(0)} | cpm=${Number(r.cpm).toFixed(2)} | ctr=${(Number(r.ctr)*100).toFixed(2)}% | imp=${r.impressoes} | lpv=${r.lpv}`);
}

// ============= PASSO 3: REALIZADO BITRIX =============
async function bitrixRealizado({ de, ate }) {
  const r = await c.query(`
    SELECT
      COUNT(*) FILTER (WHERE d.created_at BETWEEN $1 AND $2) AS leads,
      SUM(CASE WHEN d.created_at BETWEEN $1 AND $2 AND (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS mqls,
      SUM(CASE WHEN d.data_reuniao_agendada BETWEEN $1 AND $2 AND (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS rm_mql,
      SUM(CASE WHEN d.data_reuniao_realizada BETWEEN $1 AND $2 AND (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS rr_mql,
      SUM(CASE WHEN d.data_reuniao_agendada BETWEEN $1 AND $2 AND NOT (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS rm_nmql,
      SUM(CASE WHEN d.data_reuniao_realizada BETWEEN $1 AND $2 AND NOT (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS rr_nmql,
      SUM(CASE WHEN d.data_fechamento BETWEEN $1 AND $2 AND d.stage_name='Negócio Ganho' AND (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS vendas_mql,
      SUM(CASE WHEN d.data_fechamento BETWEEN $1 AND $2 AND d.stage_name='Negócio Ganho' AND NOT (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS vendas_nmql,
      SUM(CASE WHEN d.data_fechamento BETWEEN $1 AND $2 AND d.stage_name='Negócio Ganho' THEN COALESCE(d.valor_pontual,0)+COALESCE(d.valor_recorrente,0) ELSE 0 END) AS faturamento
    FROM "Bitrix".crm_deal d
    WHERE d.fnl_ngc ILIKE 'creators'
      AND (d.created_at BETWEEN $1 AND $2
        OR d.data_reuniao_agendada BETWEEN $1 AND $2
        OR d.data_reuniao_realizada BETWEEN $1 AND $2
        OR d.data_fechamento BETWEEN $1 AND $2)
  `, [de, ate]);
  const row = r.rows[0];
  const n = (x) => Number(x) || 0;
  const leads = n(row.leads), mqls = n(row.mqls);
  const rm_mql = n(row.rm_mql), rr_mql = n(row.rr_mql);
  const rm_nmql = n(row.rm_nmql), rr_nmql = n(row.rr_nmql);
  const vendas_mql = n(row.vendas_mql), vendas_nmql = n(row.vendas_nmql);
  return {
    leads, mqls, naoMqls: leads - mqls,
    percMql: leads ? mqls / leads : 0,
    rm_mql, rr_mql, rm_nmql, rr_nmql,
    percRaMql: mqls ? rr_mql / mqls : 0,
    percRaNmql: (leads - mqls) ? rr_nmql / (leads - mqls) : 0,
    percNoShowMqlBruto: rm_mql ? (rm_mql - rr_mql) / rm_mql : 0,
    percNoShowNmqlBruto: rm_nmql ? (rm_nmql - rr_nmql) / rm_nmql : 0,
    percRrVendaMql: rr_mql ? vendas_mql / rr_mql : 0,
    percRrVendaNmql: rr_nmql ? vendas_nmql / rr_nmql : 0,
    vendas_mql, vendas_nmql,
    novosClientes: vendas_mql + vendas_nmql,
    faturamento: n(row.faturamento),
  };
}

const bitrixMtd = await bitrixRealizado(MTD);
console.log('\n=== BITRIX REALIZADO (1-15/jun) ===');
console.log(bitrixMtd);

// ============= derivados de funil (realizado) =============
const m = metaMtd, b = bitrixMtd;
const txConvLP = m.lpv ? b.leads / m.lpv : 0;
const cpl = b.leads ? m.investimento / b.leads : 0;
const cpmql = b.mqls ? m.investimento / b.mqls : 0;
const cac = b.novosClientes ? m.investimento / b.novosClientes : 0;
console.log('\n=== DERIVADOS REALIZADO ===');
console.log({ txConvLP, cpl, cpmql, cac, lpv: m.lpv, leads: b.leads });

// ============= projeção linear fim de mês =============
const proj = {
  investimento: m.investimento / DIAS_MTD * DIAS_MES,
  leads: b.leads / DIAS_MTD * DIAS_MES,
  mqls: b.mqls / DIAS_MTD * DIAS_MES,
  novosClientes: b.novosClientes / DIAS_MTD * DIAS_MES,
  faturamento: b.faturamento / DIAS_MTD * DIAS_MES,
};
console.log('\n=== PROJEÇÃO LINEAR FIM DE MÊS ===');
console.log(proj);
console.log(`CPMQL proj=${cpmql.toFixed(0)} | CAC proj=${cac.toFixed(0)}`);

await c.end();

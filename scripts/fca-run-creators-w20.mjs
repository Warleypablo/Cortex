// FCA — Primeira run manual modo weekly, funil Creators
// Período: 2026-05-11 a 2026-05-17 (W20)
// Comparação: 2026-05-04 a 2026-05-10 (W19)
import { Client } from 'pg';
import { readFileSync } from 'fs';

const env = readFileSync('/Users/ichino/Documents/Turbo/Cortex/.env', 'utf8');
const url = env.match(/DATABASE_URL=([^\n]+)/)[1].trim();

const FUNIL = 'Creators';
const W = { de: '2026-05-11', ate: '2026-05-17' };
const W_PREV = { de: '2026-05-04', ate: '2026-05-10' };
const MES = '2026-05';
const MES_FALLBACK = '2026-04';

const c = new Client({ connectionString: url, ssl: false });
await c.connect();

// ============= PASSO 1: METAS via lookup hierárquico =============
async function getMetas(segmento) {
  // Tenta funil-específico no mês corrente
  for (const mesTry of [MES, MES_FALLBACK]) {
    const fSpec = await c.query(`
      SELECT metricas FROM meta_ads.growth_budgets
      WHERE mes = $1 AND segmento = $2 AND funil = $3
    `, [mesTry, segmento, FUNIL]);
    if (fSpec.rows.length) return { metricas: fSpec.rows[0].metricas, fonte: `${FUNIL}/${mesTry}/${segmento}` };
  }
  // Fallback funil=todos
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

console.log('=== METAS CARREGADAS ===');
console.log(`meta_ads (fonte: ${metasMeta.fonte}):`, JSON.stringify(metasMeta.metricas));
console.log(`mql      (fonte: ${metasMql.fonte}):`, JSON.stringify(metasMql.metricas));
console.log(`nao_mql  (fonte: ${metasNmql.fonte}):`, JSON.stringify(metasNmql.metricas));

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
  const clicks = Number(row.clicks) || 0;
  const outboundClicks = Number(row.outbound_clicks) || 0;
  const investimento = Number(row.investimento) || 0;
  return {
    investimento,
    impressoes,
    clicks,
    outboundClicks,
    lpv: Number(row.lpv) || 0,
    cpm: impressoes ? (investimento / impressoes) * 1000 : 0,
    ctr: impressoes ? outboundClicks / impressoes : 0,   // CTR de saída (consistente com app)
    hook: impressoes ? Number(row.v3sec) / impressoes : 0,
    hold: impressoes ? Number(row.vtp) / impressoes : 0,
  };
}

let metaAtual, metaPrev;
try {
  metaAtual = await metaAdsRealizado(W);
  metaPrev = await metaAdsRealizado(W_PREV);
} catch (e) {
  console.log('[META ADS] Erro na query:', e.message);
  console.log('Tentando schema alternativo...');
  // Fallback: tentar com nomes diferentes de coluna
  try {
    const r = await c.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'meta_ads' AND table_name = 'meta_insights_daily'
      ORDER BY ordinal_position
    `);
    console.log('Colunas reais de meta_insights_daily:', r.rows.map(x => x.column_name).join(', '));
    const rc = await c.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'meta_ads' AND table_name = 'meta_campaigns'
      ORDER BY ordinal_position
    `);
    console.log('Colunas reais de meta_campaigns:', rc.rows.map(x => x.column_name).join(', '));
    const ra = await c.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'meta_ads' AND table_name = 'meta_ads'
      ORDER BY ordinal_position
    `);
    console.log('Colunas reais de meta_ads:', ra.rows.map(x => x.column_name).join(', '));
  } catch (e2) {
    console.log('[META ADS schema introspect] Erro:', e2.message);
  }
}

console.log('\n=== META ADS REALIZADO ===');
console.log('W (atual):', metaAtual);
console.log('W-1:', metaPrev);

// ============= PASSO 3: REALIZADO BITRIX =============
async function bitrixRealizado({ de, ate }) {
  const r = await c.query(`
    SELECT
      COUNT(*) AS leads,
      SUM(CASE WHEN d.mql::text='1' OR LOWER(d.mql::text)='true' THEN 1 ELSE 0 END) AS mqls,
      SUM(CASE WHEN d.data_reuniao_agendada IS NOT NULL THEN 1 ELSE 0 END) AS rm,
      SUM(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 ELSE 0 END) AS rr,
      SUM(CASE WHEN d.data_reuniao_agendada IS NOT NULL AND (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS rm_mql,
      SUM(CASE WHEN d.data_reuniao_realizada IS NOT NULL AND (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS rr_mql,
      SUM(CASE WHEN d.data_reuniao_agendada IS NOT NULL AND NOT (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS rm_nmql,
      SUM(CASE WHEN d.data_reuniao_realizada IS NOT NULL AND NOT (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS rr_nmql,
      SUM(CASE WHEN d.data_fechamento BETWEEN $1 AND $2 AND d.stage_semantic='S' AND (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS vendas_mql,
      SUM(CASE WHEN d.data_fechamento BETWEEN $1 AND $2 AND d.stage_semantic='S' AND NOT (d.mql::text='1' OR LOWER(d.mql::text)='true') THEN 1 ELSE 0 END) AS vendas_nmql,
      SUM(CASE WHEN d.data_fechamento BETWEEN $1 AND $2 AND d.stage_semantic='S' THEN COALESCE(d.valor_pontual,0)+COALESCE(d.valor_recorrente,0) ELSE 0 END) AS faturamento
    FROM "Bitrix".crm_deal d
    WHERE d.created_at BETWEEN $1 AND $2
      AND d.fnl_ngc ILIKE 'creators'
  `, [de, ate]);
  const row = r.rows[0];
  const leads = Number(row.leads) || 0;
  const mqls = Number(row.mqls) || 0;
  const rm = Number(row.rm) || 0;
  const rr = Number(row.rr) || 0;
  const rm_mql = Number(row.rm_mql) || 0;
  const rr_mql = Number(row.rr_mql) || 0;
  const rm_nmql = Number(row.rm_nmql) || 0;
  const rr_nmql = Number(row.rr_nmql) || 0;
  const vendas_mql = Number(row.vendas_mql) || 0;
  const vendas_nmql = Number(row.vendas_nmql) || 0;
  const faturamento = Number(row.faturamento) || 0;
  return {
    leads, mqls,
    percMql: leads ? mqls / leads : 0,
    percRa: leads ? rm / leads : 0,
    percRaMql: mqls ? rm_mql / mqls : 0,
    percRaNmql: (leads - mqls) ? rm_nmql / (leads - mqls) : 0,
    percNoShowMqlBruto: rm_mql ? (rm_mql - rr_mql) / rm_mql : 0,
    percNoShowNmqlBruto: rm_nmql ? (rm_nmql - rr_nmql) / rm_nmql : 0,
    percRrVendaMql: rr_mql ? vendas_mql / rr_mql : 0,
    percRrVendaNmql: rr_nmql ? vendas_nmql / rr_nmql : 0,
    novosClientes: vendas_mql + vendas_nmql,
    faturamento,
    rm, rr, rm_mql, rr_mql, rm_nmql, rr_nmql, vendas_mql, vendas_nmql,
  };
}

let bitrixAtual, bitrixPrev;
try {
  bitrixAtual = await bitrixRealizado(W);
  bitrixPrev = await bitrixRealizado(W_PREV);
  console.log('\n=== BITRIX REALIZADO ===');
  console.log('W (atual):', bitrixAtual);
  console.log('W-1:', bitrixPrev);
} catch (e) {
  console.log('[BITRIX] Erro:', e.message);
}

await c.end();

/**
 * PROBE READ-ONLY — descobre quais métricas o TikTok Reporting API aceita para a
 * conta da Turbo. NÃO escreve nada no banco: só lê a credencial e chama
 * /report/integrated/get/ testando base-conhecida + 1 candidata por vez.
 *
 * Uso: npx tsx scripts/probe-tiktok-metrics.ts
 */
import { config } from 'dotenv';
config({ path: '.env' });
import { Pool } from 'pg';
import { decryptToken } from '../server/utils/encryption';

const TT_BIZ_API = 'https://business-api.tiktok.com/open_api/v1.3';
const ADVERTISER = '7065303755092131842';
const BASE = ['spend', 'impressions', 'clicks'];

const CANDIDATES = [
  'conversion', 'cost_per_conversion', 'conversion_rate_v2', 'ctr', 'cpc', 'cpm',
  'reach', 'frequency',
  'video_play_actions', 'video_watched_2s', 'video_watched_6s', 'average_video_play',
  'video_views_p25', 'video_views_p50', 'video_views_p75', 'video_views_p100',
  'likes', 'comments', 'shares', 'follows', 'profile_visits', 'engagements',
  // candidatos de Landing Page View (o objetivo)
  'total_landing_page_view', 'landing_page_view', 'onsite_shopping', 'total_onsite_shopping_value',
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ttReport(token: string, metrics: string[], startDate: string, endDate: string) {
  const params: Record<string, any> = {
    advertiser_id: ADVERTISER,
    report_type: 'BASIC',
    data_level: 'AUCTION_CAMPAIGN',
    dimensions: ['campaign_id', 'stat_time_day'],
    metrics,
    start_date: startDate,
    end_date: endDate,
    page: 1,
    page_size: 10,
  };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  const res = await fetch(`${TT_BIZ_API}/report/integrated/get/?${qs.toString()}`, {
    headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
  });
  return res.json();
}

async function main() {
  const key = process.env.INSTAGRAM_ENCRYPTION_KEY || '';
  console.log('chave hex64?', /^[0-9a-fA-F]{64}$/.test(key), '| dbUrl set?', !!process.env.dbUrl, '| DB_HOST set?', !!process.env.DB_HOST);
  // Usa DB_* (como o app) se presente; senão cai no dbUrl (postgres).
  let pool: Pool;
  if (process.env.DB_HOST) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
  } else {
    const u = new URL(process.env.dbUrl!);
    pool = new Pool({
      host: u.hostname,
      port: parseInt(u.port || '5432', 10),
      database: u.pathname.replace(/^\//, ''),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      ssl: { rejectUnauthorized: false },
    });
  }

  // 1. Ler credencial (testa permissão do growth_dev em tiktok.credentials)
  let token: string;
  try {
    const cr = await pool.query(
      `SELECT access_token_enc FROM tiktok.credentials WHERE kind='advertiser' AND active=TRUE ORDER BY id DESC LIMIT 1`,
    );
    if (!cr.rows.length) { console.log('❌ Nenhuma credencial advertiser ativa'); await pool.end(); return; }
    token = decryptToken(cr.rows[0].access_token_enc);
    console.log('✅ credencial lida e descriptografada (len token:', token.length, ')');
  } catch (e: any) {
    console.log('❌ Falha ao ler credencial:', e.message);
    await pool.end();
    return;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  // 2. Sanidade: base conhecida
  const baseRes = await ttReport(token, BASE, startDate, endDate);
  console.log('\nBASE', BASE, '=> code', baseRes.code, baseRes.code === 0 ? 'OK' : JSON.stringify(baseRes).slice(0, 200));
  if (baseRes.code !== 0) { await pool.end(); return; }

  // 3. Testar cada candidata: base + candidata
  const valid: string[] = [];
  const invalid: Array<{ m: string; msg: string }> = [];
  for (const m of CANDIDATES) {
    const r = await ttReport(token, [...BASE, m], startDate, endDate);
    if (r.code === 0) valid.push(m);
    else invalid.push({ m, msg: (r.message || '').slice(0, 120) });
    await delay(250);
  }

  console.log('\n✅ MÉTRICAS VÁLIDAS (' + valid.length + '):');
  console.log('  ' + valid.join(', '));
  console.log('\n❌ INVÁLIDAS (' + invalid.length + '):');
  for (const iv of invalid) console.log('  ' + iv.m + '  →  ' + iv.msg);

  // 4. Chamada final com tudo que é válido, pra ver valores reais (inclui LPV se houver)
  const full = [...BASE, ...valid];
  const fr = await ttReport(token, full, startDate, endDate);
  const sample = (fr.data?.list || []).find((row: any) => Object.values(row.metrics || {}).some((v: any) => Number(v) > 0)) || fr.data?.list?.[0];
  console.log('\n📊 AMOSTRA de metrics (1 linha com dados):');
  console.log(JSON.stringify(sample?.metrics || {}, null, 2));

  await pool.end();
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

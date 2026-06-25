/**
 * Backfill de `unique_outbound_clicks` em meta_ads.meta_insights_daily.
 *
 * Contexto: a coluna foi adicionada ao sync em jun/2026 (DEFAULT 0), então todo
 * o histórico anterior a 17/06/2026 está zerado. Este script re-puxa o campo
 * `unique_outbound_clicks` da Meta Graph API por janelas pequenas e dá UPDATE
 * APENAS nessa coluna, casando por (campaign_id, adset_id, ad_id, date_start).
 * Não toca em nenhuma outra métrica.
 *
 * Uso:
 *   tsx scripts/backfill-unique-outbound-clicks.ts --since=2024-04-01 --until=2026-06-16 [--dry] [--chunk=7]
 */
import 'dotenv/config';
import { Pool } from 'pg';

const META_API_VERSION = 'v18.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const TURBO_ACCOUNT_ID = 'act_1331413260627780';

function arg(name: string, def?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split('=')[1];
  if (process.argv.includes(`--${name}`)) return 'true';
  return def;
}

const SINCE = arg('since', '2024-04-01')!;
const UNTIL = arg('until', '2026-06-16')!;
const DRY = arg('dry') === 'true';
const CHUNK_DAYS = parseInt(arg('chunk', '7')!, 10);

const token = process.env.ACCESS_TOKEN_META_SYSTEM;
if (!token) throw new Error('ACCESS_TOKEN_META_SYSTEM ausente');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 4,
});

function parseUOC(row: any): number {
  return Array.isArray(row.unique_outbound_clicks)
    ? row.unique_outbound_clicks.reduce((s: number, v: any) => s + parseInt(v.value || '0'), 0)
    : parseInt(row.unique_outbound_clicks || '0');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWindow(since: string, until: string): Promise<any[]> {
  const out: any[] = [];
  const url = new URL(`${META_API_BASE}/${TURBO_ACCOUNT_ID}/insights`);
  url.searchParams.set('access_token', token!);
  url.searchParams.set('fields', 'campaign_id,adset_id,ad_id,unique_outbound_clicks');
  url.searchParams.set('time_range', JSON.stringify({ since, until }));
  url.searchParams.set('level', 'ad');
  url.searchParams.set('time_increment', '1');
  url.searchParams.set('limit', '200');

  let next: string | null = url.toString();
  let page = 0;
  while (next) {
    const resp = await fetch(next);
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      const err: any = new Error(`Meta API HTTP ${resp.status} (page ${page + 1}): ${body.slice(0, 200)}`);
      err.transient = body.includes('1504018') || body.includes('is_transient":true') || resp.status >= 500;
      throw err;
    }
    const data = await resp.json();
    out.push(...(data.data || []));
    next = data.paging?.next || null;
    page++;
  }
  return out;
}

// Busca uma janela; em timeout transitório, retenta e por fim quebra dia-a-dia.
async function fetchAllPages(since: string, until: string): Promise<any[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetchWindow(since, until);
    } catch (e: any) {
      if (e.transient && attempt < 3) {
        await sleep(1500 * attempt);
        continue;
      }
      if (e.transient && since !== until) {
        // Fallback: quebra a janela em dias individuais
        const out: any[] = [];
        let d = since;
        while (d <= until) {
          out.push(...(await fetchAllPages(d, d)));
          d = addDays(d, 1);
          await sleep(300);
        }
        return out;
      }
      throw e;
    }
  }
  return [];
}

function addDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().split('T')[0];
}

(async () => {
  console.log(`Backfill unique_outbound_clicks | ${SINCE} → ${UNTIL} | chunk=${CHUNK_DAYS}d | ${DRY ? 'DRY-RUN' : 'GRAVANDO'}`);
  let totalRows = 0;
  let totalUpdated = 0;
  let totalUOC = 0;
  let chunkStart = SINCE;

  while (chunkStart <= UNTIL) {
    let chunkEnd = addDays(chunkStart, CHUNK_DAYS - 1);
    if (chunkEnd > UNTIL) chunkEnd = UNTIL;

    let rows: any[];
    try {
      rows = await fetchAllPages(chunkStart, chunkEnd);
    } catch (e: any) {
      console.error(`  [${chunkStart}..${chunkEnd}] ERRO API: ${e.message}`);
      chunkStart = addDays(chunkEnd, 1);
      continue;
    }

    let chunkUpdated = 0;
    let chunkUOC = 0;
    for (const r of rows) {
      const uoc = parseUOC(r);
      totalRows++;
      if (uoc <= 0) continue; // nada a corrigir (já era 0)
      chunkUOC += uoc;
      if (!DRY) {
        const res = await pool.query(
          `UPDATE meta_ads.meta_insights_daily
             SET unique_outbound_clicks = $1
           WHERE account_id = $2 AND ad_id = $3 AND date_start = $4
             AND COALESCE(unique_outbound_clicks,0) <> $1`,
          [uoc, TURBO_ACCOUNT_ID, r.ad_id, r.date_start],
        );
        chunkUpdated += res.rowCount || 0;
      } else {
        chunkUpdated++;
      }
    }
    totalUpdated += chunkUpdated;
    totalUOC += chunkUOC;
    console.log(`  [${chunkStart}..${chunkEnd}] ${rows.length} linhas API | ${chunkUpdated} ${DRY ? 'a atualizar' : 'atualizadas'} | soma UOC=${chunkUOC}`);

    chunkStart = addDays(chunkEnd, 1);
  }

  console.log(`\nTOTAL: ${totalRows} linhas vistas | ${totalUpdated} ${DRY ? 'a atualizar' : 'atualizadas'} | soma UOC=${totalUOC}`);
  await pool.end();
})().catch((e) => {
  console.error('FALHA:', e);
  process.exit(1);
});

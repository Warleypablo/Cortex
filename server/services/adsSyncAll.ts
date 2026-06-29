/**
 * Orquestrador único dos syncs de plataformas: Meta + Google Turbo + TikTok Ads +
 * LinkedIn Ads + LinkedIn Orgânico + YouTube. Roda todas EM PARALELO, cada uma
 * isolada (Promise.allSettled) — uma falhar não derruba as outras.
 *
 * Usado pelo job agendado (server/index.ts, 12h) e pode ser reusado por um
 * endpoint admin de "sync all".
 */
import { Pool } from 'pg';
import { syncMetaAds, backfillMetaInsightsGaps } from './metaAdsSync';
import { syncGoogleTurbo } from './googleSync';
import { syncTiktokAds } from './tiktokAdsSync';
import { syncLinkedinAds } from './linkedinAdsSync';
import { syncLinkedin } from './linkedinSync';

export interface AdsSyncPlatformResult {
  label: string;
  status: 'success' | 'partial' | 'error';
  result?: any;
  error?: string;
  durationMs: number;
}

function mkPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST || process.env.DATABASE_HOST || '',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'dados_turbo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
}

async function runOne(label: string, fn: (p: Pool) => Promise<any>): Promise<AdsSyncPlatformResult> {
  const pool = mkPool();
  const t0 = Date.now();
  try {
    const result = await fn(pool);
    const status: AdsSyncPlatformResult['status'] = result?.errors?.length ? 'partial' : 'success';
    return { label, status, result, durationMs: Date.now() - t0 };
  } catch (e: any) {
    return { label, status: 'error', error: e?.message || String(e), durationMs: Date.now() - t0 };
  } finally {
    await pool.end();
  }
}

export async function syncAllAdsPlatforms(): Promise<AdsSyncPlatformResult[]> {
  const settled = await Promise.allSettled([
    runOne('meta', async (p) => {
      const r = await syncMetaAds(p);
      try { await backfillMetaInsightsGaps(p); } catch { /* backfill best-effort */ }
      return r;
    }),
    runOne('google', (p) => syncGoogleTurbo(p)),
    runOne('tiktok', (p) => syncTiktokAds(p, 30)),
    runOne('linkedin', (p) => syncLinkedinAds(p, 30)),
    runOne('linkedin-organic', (p) => syncLinkedin(p)),
    // YouTube usa Drizzle (db), não Pool cru — o pool do runOne é ignorado aqui.
    runOne('youtube', async () => {
      const { db } = await import('../db');
      const { syncAllChannels } = await import('./youtubeSync');
      return syncAllChannels(db);
    }),
  ]);
  return settled.map((s) =>
    s.status === 'fulfilled'
      ? s.value
      : { label: 'unknown', status: 'error' as const, error: String((s as any).reason), durationMs: 0 },
  );
}

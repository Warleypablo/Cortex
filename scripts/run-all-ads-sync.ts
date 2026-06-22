/**
 * Roda TODOS os syncs de mídia paga JUNTOS, em paralelo: Meta + Google Turbo +
 * TikTok Ads + LinkedIn Ads. Cada plataforma tem seu próprio pool e é isolada
 * (Promise.allSettled) — uma falhar não derruba as outras. Imprime resumo.
 *
 * Uso (chave inline p/ TikTok/LinkedIn, sem gravar no .env):
 *   INSTAGRAM_ENCRYPTION_KEY=<hex64> npx tsx scripts/run-all-ads-sync.ts
 *
 * Obs: TikTok/LinkedIn gravam em tabelas owned por postgres → localmente (growth_dev)
 * dão "permission denied"; rodam 100% em produção (postgres).
 */
import { config } from 'dotenv';
config({ path: '.env' });
import { Pool } from 'pg';
import { syncMetaAds } from '../server/services/metaAdsSync';
import { syncGoogleTurbo } from '../server/services/googleSync';
import { syncTiktokAds } from '../server/services/tiktokAdsSync';
import { syncLinkedinAds } from '../server/services/linkedinAdsSync';

function mkPool() {
  return new Pool({
    host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
}

async function run(label: string, fn: (p: Pool) => Promise<any>) {
  const pool = mkPool();
  const t0 = Date.now();
  try {
    const result = await fn(pool);
    const errs = (result?.errors?.length) || 0;
    console.log(`[${label}] ${errs === 0 ? '✅' : '⚠️'} ${((Date.now() - t0) / 1000).toFixed(1)}s — ${JSON.stringify(result)}`);
    return { label, ok: errs === 0, result };
  } catch (e: any) {
    console.log(`[${label}] ❌ ${((Date.now() - t0) / 1000).toFixed(1)}s — ${e.message}`);
    return { label, ok: false, error: e.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('=== Sync de TODAS as plataformas (paralelo) ===\n');
  const t0 = Date.now();
  const results = await Promise.allSettled([
    run('meta', (p) => syncMetaAds(p)),
    run('google', (p) => syncGoogleTurbo(p)),
    run('tiktok', (p) => syncTiktokAds(p, 30)),
    run('linkedin', (p) => syncLinkedinAds(p, 30)),
  ]);
  console.log(`\n=== Fim — total ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
  for (const r of results) {
    if (r.status === 'fulfilled') console.log(`  ${r.value.ok ? '✅' : '⚠️/❌'} ${r.value.label}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error('ERRO geral:', e.message); process.exit(1); });

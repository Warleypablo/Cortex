import 'dotenv/config';
import { pool } from '../server/db';
import { syncMetaAds } from '../server/services/metaAdsSync';

async function main() {
  console.log('[run-meta-sync] iniciando...');
  const result = await syncMetaAds(pool as any);
  console.log('[run-meta-sync] resultado:', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error('[run-meta-sync] erro:', e); process.exit(1); });

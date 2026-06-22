/**
 * Runner manual do sync de TikTok Ads (Marketing API / fluxo advertiser).
 * Lê a credencial 'advertiser' ativa em tiktok.credentials, descriptografa com
 * INSTAGRAM_ENCRYPTION_KEY e popula campanhas + métricas (campanha e anúncio).
 *
 * Uso (passando a chave só pro processo, sem gravar no .env):
 *   INSTAGRAM_ENCRYPTION_KEY=<hex64> npx tsx scripts/run-tiktok-ads-sync.ts [dias]
 */
import { config } from 'dotenv';
config({ path: '.env' }); // não sobrescreve env já setada inline
import { Pool } from 'pg';
import { syncTiktokAds } from '../server/services/tiktokAdsSync';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function main() {
  const dias = parseInt(process.argv[2] || '30', 10);
  const k = process.env.INSTAGRAM_ENCRYPTION_KEY || '';
  console.log('chave: len', k.length, '| hex64?', /^[0-9a-fA-F]{64}$/.test(k));
  console.log(`=== TikTok Ads Sync (últimos ${dias} dias) ===`);
  const t0 = Date.now();
  const r = await syncTiktokAds(pool, dias);
  console.log('Resultado:', JSON.stringify(r, null, 2));
  console.log(`Duração: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await pool.end();
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

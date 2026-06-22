/**
 * Disparo manual do sync orgânico do TikTok (perfil + vídeos + snapshot de métricas).
 *
 * Popula tiktok.accounts / account_metrics / videos / video_metrics, que alimentam
 * o Orçado x Realizado (endpoint /api/growth/orcado-realizado/tiktok).
 *
 * Requer no ambiente: DB_* (conexão), TIKTOK_APP_ID, TIKTOK_APP_SECRET e uma
 * credencial ativa kind='account' em tiktok.credentials (via OAuth /account).
 *
 * Uso:
 *   npx tsx scripts/sync-tiktok-organic.ts
 */
import 'dotenv/config';
import { pool } from '../server/db';
import { syncTiktokOrganic } from '../server/services/tiktokOrganicSync';

async function main() {
  if (!process.env.TIKTOK_APP_ID || !process.env.TIKTOK_APP_SECRET) {
    console.error('[sync-tiktok-organic] TIKTOK_APP_ID/SECRET ausentes — configure antes de rodar.');
    process.exit(1);
  }
  console.log('[sync-tiktok-organic] iniciando...');
  const result = await syncTiktokOrganic(pool as any);
  console.log('[sync-tiktok-organic] resultado:', JSON.stringify(result, null, 2));
  await pool.end();
  process.exit(result.errors.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('[sync-tiktok-organic] erro:', e); process.exit(1); });

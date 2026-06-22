/**
 * Roda TODOS os syncs de mídia paga JUNTOS (Meta + Google + TikTok + LinkedIn),
 * em paralelo e isolados. Reusa o mesmo orquestrador do job agendado
 * (server/services/adsSyncAll.ts) — uma fonte só da verdade.
 *
 * Uso (chave inline p/ TikTok/LinkedIn, sem gravar no .env):
 *   INSTAGRAM_ENCRYPTION_KEY=<hex64> npx tsx scripts/run-all-ads-sync.ts
 *
 * Obs: TikTok/LinkedIn gravam em tabelas owned por postgres → localmente (growth_dev)
 * dão "permission denied"; rodam 100% em produção (postgres).
 */
import { config } from 'dotenv';
config({ path: '.env' });
import { syncAllAdsPlatforms } from '../server/services/adsSyncAll';

async function main() {
  console.log('=== Sync de TODAS as plataformas (paralelo) ===\n');
  const t0 = Date.now();
  const summary = await syncAllAdsPlatforms();
  console.log(`\n=== Fim — total ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
  for (const s of summary) {
    const icon = s.status === 'success' ? '✅' : s.status === 'partial' ? '⚠️' : '❌';
    const detail = s.error ? s.error : JSON.stringify(s.result);
    console.log(`  ${icon} ${s.label} (${(s.durationMs / 1000).toFixed(1)}s) — ${detail}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error('ERRO geral:', e.message); process.exit(1); });

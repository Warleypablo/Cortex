/**
 * Smoke test da camada de otimização de ads (Google + TikTok).
 *
 * NÃO ALTERA NADA. Roda só o caminho de dry-run:
 *   - Google: validateOnly=true — o próprio Google valida a mutação inteira
 *     (permissão, developer token, estado da entidade) e devolve erro sem aplicar.
 *   - TikTok: resolve estado + travas locais, sem POST.
 *
 * Serve pra responder três perguntas antes de confiar na feature:
 *   1. As credenciais funcionam pra ESCRITA (não só leitura)?
 *   2. O developer token do Google tem nível suficiente (Test barra conta real)?
 *   3. O payload de mutação está no formato certo?
 *
 * Uso: npx tsx scripts/smoke-ads-optimization.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { applyGoogleActions, listGoogleCampaigns, TURBO_CUSTOMER_ID } from '../server/services/googleAdsWrite';
import { applyTiktokActions, listTiktokCampaigns } from '../server/services/tiktokWrite';

async function smokeGoogle() {
  console.log('\n=== GOOGLE ADS ===');
  let campaigns;
  try {
    campaigns = await listGoogleCampaigns(TURBO_CUSTOMER_ID);
  } catch (e: any) {
    console.error(`✗ Falha ao listar campanhas: ${e.message}`);
    return;
  }
  console.log(`✓ ${campaigns.length} campanha(s) na conta ${TURBO_CUSTOMER_ID}`);
  const porTipo = new Map<string, number>();
  for (const c of campaigns) porTipo.set(c.channelType, (porTipo.get(c.channelType) ?? 0) + 1);
  console.log(
    `   tipos: ${[...porTipo.entries()].map(([t, n]) => `${t}=${n}`).join(', ')}`,
  );
  const imutaveis = campaigns.filter((c) => !c.mutable);
  if (imutaveis.length) {
    console.log(`   ⚠️  ${imutaveis.length} campanha(s) de tipo não-mutável via API (ajuste pela interface)`);
  }
  if (!campaigns.length) return;

  // Alvo: inverter o status de uma campanha MUTÁVEL. validateOnly não aplica nada —
  // é só pra provar que a mutação passaria.
  const target = campaigns.find((c) => c.mutable);
  if (!target) {
    console.error('✗ nenhuma campanha de tipo mutável na conta — nada a validar');
    return;
  }
  const flip = target.status === 'ENABLED' ? 'PAUSED' : 'ENABLED';
  console.log(`\n→ dry-run: set_status ${target.status} → ${flip} em "${target.name}" (${target.channelType})`);
  const [res] = await applyGoogleActions(
    TURBO_CUSTOMER_ID,
    [{ type: 'set_status', level: 'campaign', id: target.id, status: flip }],
    { validateOnly: true },
  );
  if (res.ok) {
    console.log(`✓ ESCRITA VALIDADA — developer token tem nível suficiente e o payload está correto.`);
  } else {
    console.error(`✗ ${res.error}`);
    if (/DEVELOPER_TOKEN|developer token|not approved|TEST_ACCOUNT/i.test(res.error ?? '')) {
      console.error('  → developer token provavelmente em nível Test. Solicitar Basic/Standard no API Center.');
    }
  }

  // Também valida a trava de orçamento (deve BARRAR localmente, sem chegar na API).
  const absurd = Math.max(target.budgetAmount * 50, 99999);
  const [guard] = await applyGoogleActions(
    TURBO_CUSTOMER_ID,
    [{ type: 'set_budget', level: 'campaign', id: target.id, amount: absurd }],
    { validateOnly: true },
  );
  console.log(
    guard.ok
      ? `✗ trava de orçamento NÃO barrou ${absurd} — revisar guardBudget`
      : `✓ trava de orçamento barrou ${absurd}: ${guard.error?.slice(0, 90)}...`,
  );
}

async function smokeTiktok(pool: Pool) {
  console.log('\n=== TIKTOK ADS ===');
  let campaigns;
  try {
    campaigns = await listTiktokCampaigns(pool);
  } catch (e: any) {
    console.error(`✗ Falha ao listar campanhas: ${e.message}`);
    return;
  }
  console.log(`✓ ${campaigns.length} campanha(s)`);
  for (const c of campaigns.slice(0, 5)) {
    console.log(`   [${c.status}] ${c.name} — orçamento ${c.budget ?? '-'} (${c.budgetMode ?? '-'})`);
  }
  if (!campaigns.length) return;

  const target = campaigns[0];
  const flip = target.status === 'ENABLE' ? 'PAUSED' : 'ENABLED';
  console.log(`\n→ dry-run: set_status → ${flip} em "${target.name}"`);
  const [res] = await applyTiktokActions(
    pool,
    [{ type: 'set_status', level: 'campaign', id: target.id, status: flip }],
    { dryRun: true },
  );
  console.log(
    res.ok
      ? `✓ dry-run ok (payload montado; POST real depende do app estar em Produção)`
      : `✗ ${res.error}`,
  );
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || process.env.DATABASE_HOST || '',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'dados_turbo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
    ssl: { rejectUnauthorized: false },
  });
  try {
    await smokeGoogle();
    await smokeTiktok(pool);
  } finally {
    await pool.end();
  }
  console.log('\nNada foi alterado — todas as chamadas rodaram em modo dry-run.');
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});

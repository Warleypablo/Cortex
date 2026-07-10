import { db } from '../server/db';
import { sql } from 'drizzle-orm';

// Todas as abas da seção "Growth" da sidebar EXCETO "DFC de CAC" (/growth/dfc-cac)
// Fonte de verdade: shared/nav-config.ts -> categoria 'Growth'
const GROWTH_ROUTES = [
  '/growth/performance-plataformas', // Por Plataforma
  '/growth/criativos',               // Criativos
  '/growth/criativos/biblioteca',    // Biblioteca de Criativos
  '/growth/orcado-realizado',        // Orçado x Realizado
  '/growth/evolucao-temporal',       // Evolução Temporal
  '/growth/orcamento-campanhas',     // Orçamento por Campanha
  '/growth/creator-summit',          // Creator Summit
  '/growth/planejamento-metas',      // Planejamento de Metas
  '/growth/ai',                      // Growth AI
  '/growth/instagram',               // Instagram
  '/growth/organico',                // Orgânico
  '/crm-instagram',                  // CRM Instagram
  '/utm-builder',                    // Gerador de UTMs
  '/ghl-marketing',                  // CRM Marketing
  // EXCLUÍDO de propósito: '/growth/dfc-cac' (DFC de CAC)
];

const EMAILS = [
  'thiago.martins@turbopartners.com.br',
  'thiago.andrey@turbopartners.com.br',
];

async function main() {
  for (const email of EMAILS) {
    const before = await db.execute(sql`
      SELECT email, name, allowed_routes
      FROM cortex_core.auth_users
      WHERE email = ${email}
    `);
    if (before.rows.length === 0) {
      console.error(`❌ Usuário ${email} não encontrado — pulando`);
      continue;
    }
    const user = before.rows[0] as { email: string; name: string; allowed_routes: string[] | null };
    const current = user.allowed_routes || [];
    const toAdd = GROWTH_ROUTES.filter(r => !current.includes(r));

    if (toAdd.length === 0) {
      console.log(`ℹ️  ${user.name} (${email}) já tinha todas as rotas de Growth (menos DFC de CAC).`);
      continue;
    }

    for (const route of toAdd) {
      await db.execute(sql`
        UPDATE cortex_core.auth_users
        SET allowed_routes = array_append(allowed_routes, ${route})
        WHERE email = ${email}
      `);
    }
    console.log(`✅ ${user.name} (${email}): ${toAdd.length} rota(s) liberada(s):`);
    toAdd.forEach(r => console.log(`   + ${r}`));
  }

  // Verificação final
  console.log('\n=== VERIFICAÇÃO FINAL ===');
  for (const email of EMAILS) {
    const res = await db.execute(sql`
      SELECT allowed_routes FROM cortex_core.auth_users WHERE email = ${email}
    `);
    const routes = (res.rows[0] as any)?.allowed_routes as string[] | undefined;
    const growthNow = (routes || []).filter(r => GROWTH_ROUTES.includes(r));
    const hasDfc = (routes || []).includes('/growth/dfc-cac');
    console.log(`\n${email}`);
    console.log(`  Growth liberadas: ${growthNow.length}/${GROWTH_ROUTES.length}`);
    console.log(`  DFC de CAC presente? ${hasDfc ? '⚠️ SIM' : 'não (correto)'}`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

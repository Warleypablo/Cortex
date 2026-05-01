import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const TARGET_EMAIL = process.argv[2];

const GROWTH_ROUTES = [
  '/growth/visao-geral',
  '/growth/criativos',
  '/growth/performance-plataformas',
  '/growth/turbodash',
  '/growth/orcado-realizado',
  '/growth/evolucao-temporal',
  '/growth/orcamento-campanhas',
  '/growth/planejamento-metas',
  '/growth/keyword-performance',
  '/growth/funil-conversao',
  '/growth/instagram',
  '/dashboard/meta-ads',
];

async function main() {
  if (!TARGET_EMAIL) {
    console.error('❌ Uso: tsx scripts/grant-all-growth.ts <email>');
    process.exit(1);
  }

  const before = await db.execute(sql`
    SELECT email, name, allowed_routes
    FROM cortex_core.auth_users
    WHERE email = ${TARGET_EMAIL}
  `);

  if (before.rows.length === 0) {
    console.error(`❌ Usuário ${TARGET_EMAIL} não encontrado`);
    process.exit(1);
  }

  const user = before.rows[0] as { email: string; name: string; allowed_routes: string[] | null };
  const currentRoutes = user.allowed_routes || [];

  const toAdd = GROWTH_ROUTES.filter(r => !currentRoutes.includes(r));

  if (toAdd.length === 0) {
    console.log(`ℹ️  ${user.name} já tem todas as rotas de Growth.`);
    process.exit(0);
  }

  for (const route of toAdd) {
    await db.execute(sql`
      UPDATE cortex_core.auth_users
      SET allowed_routes = array_append(allowed_routes, ${route})
      WHERE email = ${TARGET_EMAIL}
    `);
  }

  console.log(`✅ ${toAdd.length} rota(s) de Growth liberadas para ${user.name}:`);
  toAdd.forEach(r => console.log(`   + ${r}`));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

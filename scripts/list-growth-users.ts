import { db } from '../server/db';
import { sql } from 'drizzle-orm';

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
  const result = await db.execute(sql`
    SELECT email, name, role, allowed_routes
    FROM cortex_core.auth_users
    ORDER BY role DESC, email ASC
  `);

  const users = result.rows as Array<{
    email: string;
    name: string;
    role: string;
    allowed_routes: string[] | null;
  }>;

  const rowsByRoute: Record<string, string[]> = {};
  GROWTH_ROUTES.forEach(r => (rowsByRoute[r] = []));

  const adminUsers: string[] = [];
  const userAccessMap: Record<string, string[]> = {};

  for (const u of users) {
    const routes = u.allowed_routes || [];
    if (u.role === 'admin') {
      adminUsers.push(`${u.email} (${u.name})`);
      continue;
    }
    const hasGrowth = routes.filter(r => GROWTH_ROUTES.includes(r));
    if (hasGrowth.length > 0) {
      userAccessMap[`${u.email} | ${u.name}`] = hasGrowth;
      hasGrowth.forEach(r => rowsByRoute[r].push(u.email));
    }
  }

  console.log('\n=== ADMINS (acesso total) ===');
  adminUsers.forEach(a => console.log('  - ' + a));

  console.log('\n=== USUÁRIOS COM ACESSO A ROTAS DE GROWTH ===');
  for (const [user, routes] of Object.entries(userAccessMap)) {
    console.log(`\n${user}`);
    routes.forEach(r => console.log(`   • ${r}`));
  }

  console.log('\n=== RESUMO POR ROTA ===');
  for (const route of GROWTH_ROUTES) {
    const list = rowsByRoute[route];
    console.log(`\n${route} — ${list.length} usuário(s) (não-admin):`);
    list.forEach(e => console.log(`   - ${e}`));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const TARGET_EMAIL = 'rodrigo.padrao@turbopartners.com.br';
const ROUTE = '/growth/orcado-realizado';

async function main() {
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

  if (currentRoutes.includes(ROUTE)) {
    console.log(`ℹ️  ${user.name} já tem acesso a ${ROUTE}. Nada a fazer.`);
    process.exit(0);
  }

  const newRoutes = [...currentRoutes, ROUTE];

  await db.execute(sql`
    UPDATE cortex_core.auth_users
    SET allowed_routes = array_append(allowed_routes, ${ROUTE})
    WHERE email = ${TARGET_EMAIL}
  `);

  console.log(`✅ Acesso a ${ROUTE} liberado para ${user.name} (${user.email})`);
  console.log(`   Rotas antes: ${currentRoutes.length}`);
  console.log(`   Rotas depois: ${newRoutes.length}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

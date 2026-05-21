import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const GROWTH_ROUTES = [
  '/growth/visao-geral',
  '/growth/criativos',
  '/growth/performance-plataformas',
  '/growth/orcado-realizado',
  '/growth/evolucao-temporal',
  '/growth/orcamento-campanhas',
  '/growth/planejamento-metas',
  '/growth/keyword-performance',
  '/growth/funil-conversao',
  '/growth/instagram',
  '/growth/ai',
  '/growth/auto-report',
  '/dashboard/meta-ads',
  '/utm-builder',
];

async function main() {
  const pessoal = await db.execute(sql`
    SELECT id, nome, email_turbo, email_pessoal, setor, status, demissao
    FROM "Inhire".rh_pessoal
    WHERE setor = 'Growth Interno'
    ORDER BY (demissao IS NULL) DESC, nome
  `);

  console.log(`\n📋 Pessoas no setor "Growth Interno": ${pessoal.rows.length}\n`);

  const ativos = pessoal.rows.filter((p: any) => !p.demissao);
  console.log(`Ativos (sem demissão): ${ativos.length}\n`);

  type Row = { id: number; nome: string; email_turbo: string | null; email_pessoal: string | null; demissao: string | null };

  const report: Array<{ nome: string; email: string | null; hasAuth: boolean; missing: string[]; extras: number }> = [];

  for (const p of ativos as unknown as Row[]) {
    const email = (p.email_turbo || p.email_pessoal || '').toLowerCase().trim() || null;
    if (!email) {
      report.push({ nome: p.nome, email: null, hasAuth: false, missing: GROWTH_ROUTES, extras: 0 });
      continue;
    }

    const auth = await db.execute(sql`
      SELECT email, allowed_routes, role
      FROM cortex_core.auth_users
      WHERE LOWER(email) = ${email}
    `);

    if (auth.rows.length === 0) {
      report.push({ nome: p.nome, email, hasAuth: false, missing: GROWTH_ROUTES, extras: 0 });
      continue;
    }

    const u = auth.rows[0] as { email: string; allowed_routes: string[] | null; role: string };
    if (u.role === 'admin') {
      report.push({ nome: p.nome, email, hasAuth: true, missing: [], extras: 0 });
      continue;
    }

    const routes = u.allowed_routes || [];
    const missing = GROWTH_ROUTES.filter(r => !routes.includes(r));
    report.push({ nome: p.nome, email, hasAuth: true, missing, extras: 0 });
  }

  console.log('Quem TEM acesso completo a Growth (todas as ', GROWTH_ROUTES.length, 'rotas):\n');
  report.filter(r => r.hasAuth && r.missing.length === 0).forEach(r => {
    console.log(`  ✅ ${r.nome.padEnd(35)} ${r.email}`);
  });

  console.log('\nQuem está FALTANDO alguma rota de Growth:\n');
  report.filter(r => r.hasAuth && r.missing.length > 0).forEach(r => {
    console.log(`  ⚠️  ${r.nome.padEnd(35)} ${r.email}`);
    console.log(`      faltam (${r.missing.length}): ${r.missing.join(', ')}`);
  });

  console.log('\nSem conta no Cortex (nunca logaram ou email não bate):\n');
  report.filter(r => !r.hasAuth).forEach(r => {
    console.log(`  ❌ ${r.nome.padEnd(35)} ${r.email || '(sem email cadastrado)'}`);
  });

  console.log('\n──────────────────────────────────────');
  console.log(`Total Growth Interno ativos: ${ativos.length}`);
  console.log(`  ✅ Acesso completo: ${report.filter(r => r.hasAuth && r.missing.length === 0).length}`);
  console.log(`  ⚠️  Faltam rotas: ${report.filter(r => r.hasAuth && r.missing.length > 0).length}`);
  console.log(`  ❌ Sem conta auth: ${report.filter(r => !r.hasAuth).length}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

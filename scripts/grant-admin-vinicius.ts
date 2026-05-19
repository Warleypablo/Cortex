import { config } from 'dotenv';
config({ path: '.env' });
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const ALL_ROUTES = [
  '/clientes',
  '/contratos',
  '/colaboradores',
  '/colaboradores/analise',
  '/patrimonio',
  '/ferramentas',
  '/turbozap',
  '/acessos',
  '/conhecimentos',
  '/beneficios',
  '/cases/chat',
  '/sugestoes',
  '/visao-geral',
  '/okr-2026',
  '/dashboard/geg',
  '/dashboard/inhire',
  '/dashboard/recrutamento',
  '/dashboard/meta-ads',
  '/dashboard/retencao',
  '/dashboard/dfc',
  '/dashboard/fluxo-caixa',
  '/dashboard/revenue-goals',
  '/dashboard/inadimplencia',
  '/dashboard/auditoria-sistemas',
  '/dashboard/tech',
  '/tech/projetos',
  '/dashboard/comercial/closers',
  '/dashboard/comercial/sdrs',
  '/dashboard/comercial/detalhamento-closers',
  '/dashboard/comercial/detalhamento-sdrs',
  '/dashboard/comercial/detalhamento-vendas',
  '/dashboard/comercial/analise-vendas',
  '/dashboard/comercial/apresentacao',
  '/dashboard/comercial/sdr-assistant',
  '/dashboard/comercial/crosssell',
  '/dashboard/comercial/crosssell-dashboard',
  '/presentation',
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
  '/juridico/clientes',
  '/investors-report',
  '/admin/usuarios',
  '/admin/regras-notificacoes',
  '/admin/logs',
  '/rh/nps/responder',
  '/utm-builder',
  '/gg/organograma',
  '/gg/calendario-ferias',
  '/solicitacao-ferramentas',
  '/atendimento',
  '/calendario',
  '/colaborador',
  'social.contratos_creators',
];

async function main() {
  const email = 'vinicius.ichino@turbopartners.com.br';

  const before = await db.execute(sql`
    SELECT id, email, role, array_length(allowed_routes, 1) AS n_routes
    FROM cortex_core.auth_users
    WHERE email = ${email}
  `);
  console.log('ANTES:', JSON.stringify(before.rows, null, 2));

  const result = await db.execute(sql`
    UPDATE cortex_core.auth_users
    SET role = 'admin',
        allowed_routes = ${sql.raw(`ARRAY[${ALL_ROUTES.map(r => `'${r.replace(/'/g, "''")}'`).join(',')}]::text[]`)}
    WHERE email = ${email}
    RETURNING id, email, role, array_length(allowed_routes, 1) AS n_routes
  `);
  console.log('DEPOIS:', JSON.stringify(result.rows, null, 2));

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

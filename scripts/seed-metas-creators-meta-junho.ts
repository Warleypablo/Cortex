/**
 * Seed do Planejamento de Metas — Creators × Meta Ads × Junho/2026.
 *
 * Fonte: planejamento-midia-junho-2026.html (Plano de Mídia Junho 2026, v7).
 * Preenche meta_ads.growth_budgets (mes='2026-06', segmento='meta_ads', funil='Creators').
 *
 * Grava as métricas tier-1 (que o usuário preenche na aba) + as tier-2 derivadas,
 * espelhando exatamente o que o saveCell de PlanejamentoMetas.tsx faz ao salvar:
 * tier-1 inputs → deriveAdsFunnel → tier-2, tudo no mesmo objeto JSONB.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';

const MES = '2026-06';
const SEGMENTO = 'meta_ads';
const FUNIL = 'Creators';

// ── Tier-1 (inputs do plano) ──────────────────────────────────────────────
// Marketing: batem 1:1 com a cascata do HTML.
// Vendas: taxas MESCLADAS — o plano separa MQL/N-MQL, mas a aba só modela uma
// cadeia única (%RA → RR→V%). Ver nota de inconsistência no fim do arquivo.
const tier1 = {
  investimento: 113500,
  cpm: 70,
  ctr: 0.008,            // 0,80%
  connectRate: 0.80,     // 80%
  taxaConversaoPagina: 0.15, // 15%
  percMqls: 0.40,        // 40%
  percRa: 213 / 1557,    // 13,68% — reuniões realizadas (154 MQL + 59 N-MQL) ÷ leads
  percRrVendas: 40 / 213, // 18,78% — vendas (32 + 8) ÷ reuniões realizadas
  leadTime: 0,           // não informado no plano
  aov: 9480,             // (32×8.700 + 8×12.600) ÷ 40 ≈ ticket médio mesclado
};

// ── deriveAdsFunnel (espelho de client/src/lib/metasBudgetConfig.ts) ───────
function deriveAdsFunnel(i: typeof tier1) {
  const impressoes = i.cpm > 0 ? (i.investimento / i.cpm) * 1000 : 0;
  const cliques = Math.round(impressoes * i.ctr);
  const visualizacoesPagina = Math.round(cliques * i.connectRate);
  const leads = Math.round(visualizacoesPagina * i.taxaConversaoPagina);
  const mqls = Math.round(leads * i.percMqls);
  const cpl = leads > 0 ? i.investimento / leads : 0;
  const cpmql = mqls > 0 ? i.investimento / mqls : 0;
  const ra = Math.round(leads * i.percRa);
  const negocioGanho = Math.round(ra * i.percRrVendas);
  const receita = negocioGanho * i.aov;
  const cacUnico = negocioGanho > 0 ? i.investimento / negocioGanho : 0;
  return {
    visualizacoesPagina, leads, mqls, cpl, cpmql,
    percRr: i.percRa, negocioGanho, receita,
    receitaPontual: 0, receitaRecorrente: receita,
    cacUnico, cacContrato: cacUnico, cac: cacUnico,
  };
}

async function main() {
  const metricas = { ...tier1, ...deriveAdsFunnel(tier1) };

  console.log('=== Creators × Meta Ads × 2026-06 — métricas a gravar ===');
  console.log(JSON.stringify(metricas, null, 2));

  await db.execute(sql`
    INSERT INTO meta_ads.growth_budgets (mes, segmento, funil, metricas)
    VALUES (${MES}, ${SEGMENTO}, ${FUNIL}, ${JSON.stringify(metricas)}::jsonb)
    ON CONFLICT (mes, segmento, funil) DO UPDATE SET
      metricas = ${JSON.stringify(metricas)}::jsonb,
      updated_at = NOW()
  `);

  const check = await db.execute(sql`
    SELECT metricas FROM meta_ads.growth_budgets
    WHERE mes=${MES} AND segmento=${SEGMENTO} AND funil=${FUNIL}
  `);
  console.log('\n=== Gravado no banco ===');
  console.log(JSON.stringify((check.rows[0] as any).metricas, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

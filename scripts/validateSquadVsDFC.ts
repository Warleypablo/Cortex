/**
 * Validação automatizada: compara Receita Total mensal entre o pipeline
 * de itens (server/contribuicaoSquad/receitaPorItens.ts) e o cálculo do DFC
 * (caz_parcelas direto).
 *
 * Uso: npx tsx scripts/validateSquadVsDFC.ts [ano]
 * Padrão: ano corrente.
 *
 * Threshold:
 * - Pré-backfill (Fase 1): ~5% de divergência esperada (vendas históricas sem itens).
 * - Pós-backfill (Fase 2): 2% (apenas clientes só no Conta Azul + LANCAMENTO/RENEGOCIACAO).
 * - Após Fase 2 + backfill, deve cair para <0.5%.
 *
 * Exit code 1 se divergência > TOLERANCIA_PCT em algum mês.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { getReceitaPorItens } from '../server/contribuicaoSquad/receitaPorItens';

const TOLERANCIA_PCT = parseFloat(process.env.TOLERANCIA_PCT || '0.05');
const ANO = parseInt(process.argv[2]) || new Date().getFullYear();

async function totalDFC(ano: number): Promise<Map<string, number>> {
  const r = await db.execute(sql`
    SELECT TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes,
           SUM(COALESCE(p.valor_pago::numeric, 0) - COALESCE(p.desconto::numeric, 0)) AS total
    FROM "Conta Azul".caz_parcelas p
    WHERE p.tipo_evento = 'RECEITA'
      AND p.status IN ('QUITADO', 'RECEBIDO_PARCIAL')
      AND EXTRACT(YEAR FROM p.data_quitacao) = ${ano}
    GROUP BY 1 ORDER BY 1
  `);
  return new Map((r.rows as any[]).map(x => [x.mes, Number(x.total)]));
}

async function totalSquad(ano: number): Promise<Map<string, number>> {
  const linhas = await getReceitaPorItens(ano);
  const out = new Map<string, number>();
  for (const l of linhas) {
    out.set(l.mes, (out.get(l.mes) || 0) + l.itemTotal);
  }
  return out;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main() {
  console.log(`\nValidação Squad (pipeline de itens) vs DFC — ano ${ANO}`);
  console.log(`Tolerância: ${(TOLERANCIA_PCT * 100).toFixed(2)}%\n`);

  const [dfc, squad] = await Promise.all([totalDFC(ANO), totalSquad(ANO)]);
  const meses = Array.from(new Set([...dfc.keys(), ...squad.keys()])).sort();

  console.log('Mês       | DFC              | Squad            | Δ                | %      | OK?');
  console.log('----------+------------------+------------------+------------------+--------+----');

  let falhou = false;
  for (const mes of meses) {
    const d = dfc.get(mes) || 0;
    const s = squad.get(mes) || 0;
    const delta = s - d;
    const pct = d > 0 ? Math.abs(delta) / d : 0;
    const ok = pct <= TOLERANCIA_PCT;
    if (!ok) falhou = true;
    console.log(
      `${mes}   | ${fmtMoney(d).padStart(16)} | ${fmtMoney(s).padStart(16)} | ${fmtMoney(delta).padStart(16)} | ${(pct * 100).toFixed(2).padStart(5)}% | ${ok ? '✓' : '✗'}`
    );
  }

  if (falhou) {
    console.error(`\nFALHA: divergência > ${TOLERANCIA_PCT * 100}% em algum mês`);
    process.exit(1);
  }
  console.log(`\nOK: todos os meses dentro de ${TOLERANCIA_PCT * 100}%`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });

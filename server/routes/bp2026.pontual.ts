// server/routes/bp2026.pontual.ts
// Sub-aba Pontual: movimento do estoque de contratos pontuais (ponte) via
// snapshot-diff de cup_data_hist. Total consolidado, só realizado.
import { sql } from "drizzle-orm";
import { montarLinhasPontual, type RegPontual, type LinhaPontual } from "./bp2026.pontual.helpers";

interface Deps {
  db: any;
  mesCorrente: number;
  mesFechado: number;
}

export async function montarPontual({ db, mesCorrente, mesFechado }: Deps): Promise<LinhaPontual[]> {
  // Último snapshot de cada mês; mês 0 = dez/2025 (base da ponte de janeiro).
  const result = await db.execute(sql`
    WITH alvo AS (
      SELECT gs.mes, MAX(h.data_snapshot::date) AS d
      FROM generate_series(0, 12) AS gs(mes)
      JOIN "Clickup".cup_data_hist h
        ON h.data_snapshot::date >= (make_date(2025, 12, 1) + (gs.mes || ' months')::interval)::date
       AND h.data_snapshot::date <  (make_date(2025, 12, 1) + ((gs.mes + 1) || ' months')::interval)::date
      GROUP BY gs.mes
    )
    SELECT a.mes, h.id_subtask, h.valorp::numeric AS valorp, h.status,
           to_char(c.data_criado, 'YYYY-MM') AS criado_ym
    FROM alvo a
    JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.d
    LEFT JOIN "Clickup".cup_contratos c ON c.id_subtask = h.id_subtask
    WHERE h.valorp::numeric > 0
    ORDER BY a.mes
  `);

  const porMes: Record<number, RegPontual[]> = {};
  for (const row of result.rows as any[]) {
    const mes = Number(row.mes);
    (porMes[mes] ??= []).push({
      idSubtask: String(row.id_subtask),
      valorp: parseFloat(row.valorp),
      status: row.status,
      criadoYm: row.criado_ym ?? null,
    });
  }

  // Venda Pontual (comercial): mesma fonte/régua da Receita Pontual de Vendas por Produto
  // (cup_contratos por data_criado) — garante que "venda bate com venda".
  const vendaRes = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_criado)::int AS mes,
           COALESCE(SUM(valorp::numeric), 0)::float AS valor
    FROM "Clickup".cup_contratos
    WHERE data_criado >= '2026-01-01' AND data_criado < '2027-01-01'
      AND LOWER(TRIM(status)) <> 'não usar' AND valorp::numeric > 0
    GROUP BY 1
  `);
  const vendaComercialPorMes: Record<number, number> = {};
  for (const row of vendaRes.rows as any[]) {
    vendaComercialPorMes[Number(row.mes)] = Number(row.valor);
  }

  return montarLinhasPontual(porMes, mesCorrente, mesFechado, vendaComercialPorMes);
}

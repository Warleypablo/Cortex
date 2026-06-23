// server/routes/bp2026.pontual.ts
// Sub-aba Pontual: movimento do estoque de contratos pontuais (ponte) via
// snapshot-diff de cup_data_hist. Total consolidado, só realizado.
import { sql } from "drizzle-orm";
import { montarLinhasPontual, ehEstoquePontual, type RegPontual, type LinhaPontual } from "./bp2026.pontual.helpers";

interface Deps {
  db: any;
  mesCorrente: number;
  mesFechado: number;
  produtoLike?: string;
}

export async function montarPontual({ db, mesCorrente, mesFechado, produtoLike }: Deps): Promise<LinhaPontual[]> {
  const filtroSnap = produtoLike
    ? sql`AND LOWER(COALESCE(h.produto, '')) LIKE ${produtoLike}`
    : sql``;
  const filtroVenda = produtoLike
    ? sql`AND LOWER(COALESCE(produto, '')) LIKE ${produtoLike}`
    : sql``;
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
           to_char(c.data_criado, 'YYYY-MM') AS criado_ym,
           COALESCE(NULLIF(TRIM(h.squad), ''), '(sem squad)') AS squad,
           COALESCE(NULLIF(TRIM(h.produto), ''), '(sem produto)') AS produto
    FROM alvo a
    JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.d
    LEFT JOIN "Clickup".cup_contratos c ON c.id_subtask = h.id_subtask
    WHERE h.valorp::numeric > 0 ${filtroSnap}
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
      squad: row.squad,
      produto: row.produto,
    });
  }

  // Venda Pontual (comercial): contratos por data_criado (= Receita Pontual de Vendas por Produto).
  // Traz id_subtask (cruzar com estoque) e produto (sub-linhas por produto da Venda).
  const vendaRes = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_criado)::int AS mes,
           id_subtask, valorp::numeric AS valor,
           COALESCE(NULLIF(TRIM(produto), ''), '(sem produto)') AS produto
    FROM "Clickup".cup_contratos
    WHERE data_criado >= '2026-01-01' AND data_criado < '2027-01-01'
      AND LOWER(TRIM(status)) <> 'não usar' AND valorp::numeric > 0
      ${filtroVenda}
  `);
  // Estoque de cada mês = contratos da foto que contam como estoque pontual (por id_subtask).
  const estoqueIds: Record<number, Set<string>> = {};
  for (let m = 1; m <= 12; m++) {
    estoqueIds[m] = new Set((porMes[m] ?? []).filter(ehEstoquePontual).map((r) => r.idSubtask));
  }
  const vendaComercialPorMes: Record<number, number> = {};
  const vendaNoEstoquePorMes: Record<number, number> = {};
  const vendaPorProdutoPorMes: Record<number, Record<string, number>> = {};
  for (const row of vendaRes.rows as any[]) {
    const mes = Number(row.mes);
    const valor = Number(row.valor);
    vendaComercialPorMes[mes] = (vendaComercialPorMes[mes] ?? 0) + valor;
    (vendaPorProdutoPorMes[mes] ??= {});
    vendaPorProdutoPorMes[mes][row.produto] = (vendaPorProdutoPorMes[mes][row.produto] ?? 0) + valor;
    if (estoqueIds[mes]?.has(String(row.id_subtask))) {
      vendaNoEstoquePorMes[mes] = (vendaNoEstoquePorMes[mes] ?? 0) + valor;
    }
  }

  return montarLinhasPontual(
    porMes, mesCorrente, mesFechado,
    vendaComercialPorMes, vendaNoEstoquePorMes, vendaPorProdutoPorMes,
    "squad",
  );
}

import { db } from "../db";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClienteContrato {
  cnpj: string;
  clienteId: string;
  nome: string;
  cluster: string | null;
  faturamentoMensal: number;
  investimentoAds: number;
  responsavel: string | null;
  produtos: string[];
  mrrTotal: number;
  contratoMaisAntigo: Date | null;
  produtosCancelados: string[];
}

interface OportunidadeSugerida {
  clienteId: string;
  cnpj: string;
  produtoMapeado: string;
  cxResponsavel: string;
  origem: "sistema";
  prioridade: "alta" | "media" | "baixa";
  scoreDetalhes: {
    afinidade: number;
    gap: number;
    financeiro: number;
    tenure: number;
    churn: number;
    total: number;
  };
  motivo: string;
}

interface MapearResult {
  criadas: number;
  distribuicao: { alta: number; media: number; baixa: number };
  ignoradas: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PESOS = {
  afinidade: 0.30,
  gap: 0.20,
  financeiro: 0.20,
  tenure: 0.15,
  churn: 0.15,
};

const SCORE_MINIMO = 0.30;
const AFINIDADE_MINIMA = 0.15;
const MAX_SUGESTOES_POR_CLIENTE = 3;

// ---------------------------------------------------------------------------
// Co-occurrence Matrix
// ---------------------------------------------------------------------------

async function buildCoOccurrenceMatrix(): Promise<Record<string, Record<string, number>>> {
  const result = await db.execute(sql.raw(`
    SELECT ct.cnpj, ct.produto
    FROM "Clickup".cup_contratos ct
    WHERE ct.status IN ('ativo', 'Ativo', 'ATIVO')
      AND ct.produto IS NOT NULL
      AND ct.produto != ''
    GROUP BY ct.cnpj, ct.produto
  `));

  const clientProducts: Record<string, Set<string>> = {};
  for (const row of result.rows as any[]) {
    if (!clientProducts[row.cnpj]) clientProducts[row.cnpj] = new Set();
    clientProducts[row.cnpj].add(row.produto);
  }

  const productCount: Record<string, number> = {};
  const coCount: Record<string, Record<string, number>> = {};

  for (const products of Object.values(clientProducts)) {
    const arr = Array.from(products);
    for (const p of arr) {
      productCount[p] = (productCount[p] || 0) + 1;
      if (!coCount[p]) coCount[p] = {};
      for (const q of arr) {
        if (p !== q) {
          coCount[p][q] = (coCount[p][q] || 0) + 1;
        }
      }
    }
  }

  const matrix: Record<string, Record<string, number>> = {};
  for (const [p, others] of Object.entries(coCount)) {
    matrix[p] = {};
    for (const [q, count] of Object.entries(others)) {
      matrix[p][q] = count / (productCount[p] || 1);
    }
  }

  return matrix;
}

// ---------------------------------------------------------------------------
// Factor Calculations
// ---------------------------------------------------------------------------

function calcAfinidade(
  matrix: Record<string, Record<string, number>>,
  clientProducts: string[],
  targetProduct: string
): number {
  if (clientProducts.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const p of clientProducts) {
    const aff = matrix[p]?.[targetProduct];
    if (aff !== undefined) {
      sum += aff;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function calcGap(
  clientProductCount: number,
  clusterAvg: Record<string, number>,
  cluster: string | null
): number {
  const avg = clusterAvg[cluster ?? ""] ?? clusterAvg["_global"] ?? 1;
  if (avg <= 0) return 0;
  const score = 1 - clientProductCount / avg;
  return Math.max(0, Math.min(1, score));
}

function calcFinanceiro(
  faturamento: number,
  investAds: number,
  mrr: number,
  percentis: { faturamento: number[]; investAds: number[]; mrr: number[] }
): number {
  const pFat = percentilRank(faturamento, percentis.faturamento);
  const pAds = percentilRank(investAds, percentis.investAds);
  const pMrr = percentilRank(mrr, percentis.mrr);
  return (pFat + pAds + pMrr) / 3;
}

function calcTenure(contratoMaisAntigo: Date | null): number {
  if (!contratoMaisAntigo) return 0;
  const now = new Date();
  const months =
    (now.getFullYear() - contratoMaisAntigo.getFullYear()) * 12 +
    now.getMonth() -
    contratoMaisAntigo.getMonth();
  if (months < 6) return 0.2;
  if (months < 12) return 0.5;
  if (months < 24) return 0.8;
  return 1.0;
}

function calcChurn(
  targetProduct: string,
  produtosCancelados: string[]
): number {
  if (produtosCancelados.length === 0) return 0.5;
  if (produtosCancelados.includes(targetProduct)) return 0.8;
  if (produtosCancelados.length >= 3) return 0.2;
  return 0.5;
}

function percentilRank(value: number, sorted: number[]): number {
  if (sorted.length === 0 || value <= 0) return 0;
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count++;
    else break;
  }
  return count / sorted.length;
}

function classificarPrioridade(score: number): "alta" | "media" | "baixa" {
  if (score > 0.70) return "alta";
  if (score >= 0.40) return "media";
  return "baixa";
}

// ---------------------------------------------------------------------------
// Main: mapearOportunidades
// ---------------------------------------------------------------------------

export async function mapearOportunidades(): Promise<MapearResult> {
  // 1. Get all active clients
  const clientesResult = await db.execute(sql.raw(`
    SELECT
      c.cnpj,
      c.task_id AS cliente_id,
      c.nome,
      c.cluster,
      COALESCE(NULLIF(regexp_replace(c.faturamento_mensal, '[^0-9.]', '', 'g'), ''), '0')::float AS faturamento_mensal,
      COALESCE(NULLIF(regexp_replace(c.investimento_ads, '[^0-9.]', '', 'g'), ''), '0')::float AS investimento_ads,
      c.responsavel
    FROM "Clickup".cup_clientes c
    WHERE c.status IN ('ativo', 'Ativo', 'ATIVO', 'Ativo ')
      AND c.cnpj IS NOT NULL
      AND c.cnpj != ''
  `));

  const contratosResult = await db.execute(sql.raw(`
    SELECT
      ct.cnpj,
      ct.produto,
      ct.status,
      COALESCE(ct.valorr, 0)::float AS valorr,
      ct.data_inicio
    FROM "Clickup".cup_contratos ct
    WHERE ct.cnpj IS NOT NULL AND ct.cnpj != ''
  `));

  // 2. Existing opportunities for deduplication
  const existingResult = await db.execute(sql.raw(`
    SELECT cnpj, produto_mapeado, etapa
    FROM cortex_core.crosssell_oportunidades
  `));

  const existingPairs = new Set(
    (existingResult.rows as any[]).map((r) => `${r.cnpj}|${r.produto_mapeado}`)
  );
  const discardedPairs = new Set(
    (existingResult.rows as any[])
      .filter((r) => r.etapa === "descartado")
      .map((r) => `${r.cnpj}|${r.produto_mapeado}`)
  );

  // 3. Build client data structures
  const clienteMap: Record<string, ClienteContrato> = {};

  for (const row of clientesResult.rows as any[]) {
    clienteMap[row.cnpj] = {
      cnpj: row.cnpj,
      clienteId: row.cliente_id,
      nome: row.nome,
      cluster: row.cluster,
      faturamentoMensal: row.faturamento_mensal,
      investimentoAds: row.investimento_ads,
      responsavel: row.responsavel,
      produtos: [],
      mrrTotal: 0,
      contratoMaisAntigo: null,
      produtosCancelados: [],
    };
  }

  for (const row of contratosResult.rows as any[]) {
    const cliente = clienteMap[row.cnpj];
    if (!cliente) continue;

    const isActive = ["ativo", "Ativo", "ATIVO"].includes(row.status);
    const isCancelled = ["cancelado", "Cancelado", "CANCELADO", "pausado", "Pausado"].includes(row.status);

    if (isActive && row.produto) {
      if (!cliente.produtos.includes(row.produto)) {
        cliente.produtos.push(row.produto);
      }
      cliente.mrrTotal += row.valorr;
      if (row.data_inicio) {
        const d = new Date(row.data_inicio);
        if (!cliente.contratoMaisAntigo || d < cliente.contratoMaisAntigo) {
          cliente.contratoMaisAntigo = d;
        }
      }
    }

    if (isCancelled && row.produto && !cliente.produtosCancelados.includes(row.produto)) {
      cliente.produtosCancelados.push(row.produto);
    }
  }

  // 4. Co-occurrence matrix
  const matrix = await buildCoOccurrenceMatrix();

  // 5. Cluster averages
  const clusterProducts: Record<string, number[]> = {};
  const allCounts: number[] = [];
  for (const c of Object.values(clienteMap)) {
    if (c.produtos.length === 0) continue;
    const key = c.cluster ?? "_global";
    if (!clusterProducts[key]) clusterProducts[key] = [];
    clusterProducts[key].push(c.produtos.length);
    allCounts.push(c.produtos.length);
  }
  const clusterAvg: Record<string, number> = {};
  for (const [key, counts] of Object.entries(clusterProducts)) {
    clusterAvg[key] = counts.reduce((a, b) => a + b, 0) / counts.length;
  }
  clusterAvg["_global"] = allCounts.length > 0
    ? allCounts.reduce((a, b) => a + b, 0) / allCounts.length
    : 1;

  // 6. Percentile arrays
  const faturamentos = Object.values(clienteMap)
    .map((c) => c.faturamentoMensal)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const investimentos = Object.values(clienteMap)
    .map((c) => c.investimentoAds)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const mrrs = Object.values(clienteMap)
    .map((c) => c.mrrTotal)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const percentis = { faturamento: faturamentos, investAds: investimentos, mrr: mrrs };

  // 7. All known products
  const allProducts = new Set<string>(Object.keys(matrix));

  // 8. Score and generate suggestions
  const sugestoes: OportunidadeSugerida[] = [];
  let ignoradas = 0;

  for (const cliente of Object.values(clienteMap)) {
    if (cliente.produtos.length === 0) continue;

    const candidatos: OportunidadeSugerida[] = [];

    for (const targetProduct of Array.from(allProducts)) {
      if (cliente.produtos.includes(targetProduct)) continue;

      const key = `${cliente.cnpj}|${targetProduct}`;
      if (existingPairs.has(key) || discardedPairs.has(key)) {
        ignoradas++;
        continue;
      }

      const afinidade = calcAfinidade(matrix, cliente.produtos, targetProduct);
      if (afinidade < AFINIDADE_MINIMA) continue;

      const gap = calcGap(cliente.produtos.length, clusterAvg, cliente.cluster);
      const financeiro = calcFinanceiro(
        cliente.faturamentoMensal,
        cliente.investimentoAds,
        cliente.mrrTotal,
        percentis
      );
      const tenure = calcTenure(cliente.contratoMaisAntigo);
      const churn = calcChurn(targetProduct, cliente.produtosCancelados);

      const total =
        afinidade * PESOS.afinidade +
        gap * PESOS.gap +
        financeiro * PESOS.financeiro +
        tenure * PESOS.tenure +
        churn * PESOS.churn;

      if (total < SCORE_MINIMO) continue;

      const afinidadePct = Math.round(afinidade * 100);
      const motivo = `${afinidadePct}% dos clientes com ${cliente.produtos[0]}${
        cliente.produtos.length > 1 ? ` (e outros ${cliente.produtos.length - 1} produtos)` : ""
      } também contratam ${targetProduct}`;

      candidatos.push({
        clienteId: cliente.clienteId,
        cnpj: cliente.cnpj,
        produtoMapeado: targetProduct,
        cxResponsavel: cliente.responsavel ?? "N/A",
        origem: "sistema",
        prioridade: classificarPrioridade(total),
        scoreDetalhes: {
          afinidade: Math.round(afinidade * 100) / 100,
          gap: Math.round(gap * 100) / 100,
          financeiro: Math.round(financeiro * 100) / 100,
          tenure: Math.round(tenure * 100) / 100,
          churn: Math.round(churn * 100) / 100,
          total: Math.round(total * 100) / 100,
        },
        motivo,
      });
    }

    candidatos.sort((a, b) => b.scoreDetalhes.total - a.scoreDetalhes.total);
    sugestoes.push(...candidatos.slice(0, MAX_SUGESTOES_POR_CLIENTE));
  }

  // 9. Bulk insert
  const distribuicao = { alta: 0, media: 0, baixa: 0 };

  for (const s of sugestoes) {
    await db.execute(sql`
      INSERT INTO cortex_core.crosssell_oportunidades
        (cliente_id, cnpj, produto_mapeado, etapa, cx_responsavel, origem, prioridade, score_detalhes, motivo)
      VALUES
        (${s.clienteId}, ${s.cnpj}, ${s.produtoMapeado}, 'sugerido_sistema', ${s.cxResponsavel},
         ${s.origem}, ${s.prioridade}, ${JSON.stringify(s.scoreDetalhes)}::jsonb, ${s.motivo})
    `);
    distribuicao[s.prioridade]++;
  }

  return {
    criadas: sugestoes.length,
    distribuicao,
    ignoradas,
  };
}

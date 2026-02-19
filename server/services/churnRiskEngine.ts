import { db } from "../db";
import { sql } from "drizzle-orm";

export interface ChurnRiskFactor {
  sinal: string;
  peso: number;
  valor: number;
  descricao: string;
}

export interface ChurnRiskResult {
  contratoId: string;
  clienteNome: string | null;
  cnpj: string | null;
  score: number;
  tier: 'baixo' | 'moderado' | 'alto' | 'critico';
  fatores: ChurnRiskFactor[];
  mrr: number;
  squad: string | null;
  produto: string | null;
  csResponsavel: string | null;
}

export interface RiskSummary {
  totalContratos: number;
  critico: number;
  alto: number;
  moderado: number;
  baixo: number;
  mrrEmRisco: number;
  mrrCritico: number;
  mrrAlto: number;
}

function classifyTier(score: number): ChurnRiskResult['tier'] {
  if (score >= 76) return 'critico';
  if (score >= 51) return 'alto';
  if (score >= 31) return 'moderado';
  return 'baixo';
}

/**
 * Calcula score de inadimplência (peso máximo: 25)
 * Baseado em dias de atraso máximo das parcelas não pagas
 */
function scoreInadimplencia(maxDiasAtraso: number | null): { valor: number; descricao: string } {
  if (!maxDiasAtraso || maxDiasAtraso <= 0) {
    return { valor: 0, descricao: 'Sem parcelas em atraso' };
  }
  if (maxDiasAtraso <= 15) {
    return { valor: 5, descricao: `${maxDiasAtraso} dias de atraso (leve)` };
  }
  if (maxDiasAtraso <= 30) {
    return { valor: 10, descricao: `${maxDiasAtraso} dias de atraso` };
  }
  if (maxDiasAtraso <= 60) {
    return { valor: 17, descricao: `${maxDiasAtraso} dias de atraso (preocupante)` };
  }
  if (maxDiasAtraso <= 90) {
    return { valor: 22, descricao: `${maxDiasAtraso} dias de atraso (grave)` };
  }
  return { valor: 25, descricao: `${maxDiasAtraso} dias de atraso (crítico)` };
}

/**
 * Calcula score de tempo de contrato (peso máximo: 15)
 * Contratos novos têm mais risco
 */
function scoreTempoContrato(mesesContrato: number | null): { valor: number; descricao: string } {
  if (!mesesContrato || mesesContrato < 0) mesesContrato = 0;
  if (mesesContrato < 2) {
    return { valor: 15, descricao: `Contrato muito recente (${mesesContrato.toFixed(1)} meses)` };
  }
  if (mesesContrato < 3) {
    return { valor: 12, descricao: `Contrato recente (${mesesContrato.toFixed(1)} meses)` };
  }
  if (mesesContrato < 6) {
    return { valor: 8, descricao: `${mesesContrato.toFixed(1)} meses de contrato` };
  }
  if (mesesContrato < 12) {
    return { valor: 4, descricao: `${mesesContrato.toFixed(1)} meses de contrato` };
  }
  return { valor: 0, descricao: `Contrato maduro (${mesesContrato.toFixed(1)} meses)` };
}

/**
 * Calcula score de histórico de pausas (peso máximo: 15)
 */
function scorePausa(jaPausou: boolean): { valor: number; descricao: string } {
  if (jaPausou) {
    return { valor: 15, descricao: 'Contrato já foi pausado anteriormente' };
  }
  return { valor: 0, descricao: 'Nunca foi pausado' };
}

/**
 * Calcula score de churn rate do squad (peso máximo: 10)
 */
function scoreChurnSquad(churnRate: number | null): { valor: number; descricao: string } {
  if (!churnRate || churnRate <= 0) return { valor: 0, descricao: 'Squad sem churn recente' };
  if (churnRate < 2) return { valor: 2, descricao: `Churn do squad: ${churnRate.toFixed(1)}% (baixo)` };
  if (churnRate < 5) return { valor: 5, descricao: `Churn do squad: ${churnRate.toFixed(1)}%` };
  if (churnRate < 8) return { valor: 8, descricao: `Churn do squad: ${churnRate.toFixed(1)}% (elevado)` };
  return { valor: 10, descricao: `Churn do squad: ${churnRate.toFixed(1)}% (alto)` };
}

/**
 * Calcula score de churn rate do produto (peso máximo: 10)
 */
function scoreChurnProduto(churnRate: number | null): { valor: number; descricao: string } {
  if (!churnRate || churnRate <= 0) return { valor: 0, descricao: 'Produto sem churn recente' };
  if (churnRate < 2) return { valor: 2, descricao: `Churn do produto: ${churnRate.toFixed(1)}% (baixo)` };
  if (churnRate < 5) return { valor: 5, descricao: `Churn do produto: ${churnRate.toFixed(1)}%` };
  if (churnRate < 8) return { valor: 8, descricao: `Churn do produto: ${churnRate.toFixed(1)}% (elevado)` };
  return { valor: 10, descricao: `Churn do produto: ${churnRate.toFixed(1)}% (alto)` };
}

/**
 * Calcula score de tendência de MRR (peso máximo: 15)
 * Baseado na variação de MRR nos últimos 3 meses via snapshots
 */
function scoreTendenciaMRR(variacao: number | null): { valor: number; descricao: string } {
  if (variacao === null) return { valor: 5, descricao: 'Sem dados históricos suficientes' };
  if (variacao < -20) return { valor: 15, descricao: `MRR caiu ${Math.abs(variacao).toFixed(0)}% nos últimos 3 meses` };
  if (variacao < -10) return { valor: 12, descricao: `MRR caiu ${Math.abs(variacao).toFixed(0)}% nos últimos 3 meses` };
  if (variacao < -5) return { valor: 8, descricao: `MRR caiu ${Math.abs(variacao).toFixed(0)}%` };
  if (variacao < 0) return { valor: 4, descricao: `MRR caiu levemente (${Math.abs(variacao).toFixed(0)}%)` };
  return { valor: 0, descricao: variacao > 0 ? `MRR cresceu ${variacao.toFixed(0)}%` : 'MRR estável' };
}

/**
 * Calcula score de primeira parcela não paga (peso máximo: 10)
 */
function scorePrimeiraParcela(primeiraNaoPaga: boolean): { valor: number; descricao: string } {
  if (primeiraNaoPaga) {
    return { valor: 10, descricao: 'Primeira parcela não foi paga' };
  }
  return { valor: 0, descricao: 'Primeira parcela paga normalmente' };
}

/**
 * Calcula os risk scores para todos os contratos ativos.
 * Usa uma query principal que busca todos os dados necessários,
 * depois aplica as regras de scoring em memória.
 */
export async function calculateAllRiskScores(): Promise<ChurnRiskResult[]> {
  try {
    // 1. Buscar contratos ativos com dados do cliente
    const contratosResult = await db.execute(sql`
      SELECT
        c.id_subtask as contrato_id,
        cl.nome as cliente_nome,
        cl.cnpj,
        COALESCE(c.valorr::numeric, 0) as mrr,
        c.squad,
        c.produto,
        c.cs_responsavel,
        c.data_inicio,
        c.data_pausa,
        EXTRACT(EPOCH FROM (NOW() - c.data_inicio::timestamp)) / (86400 * 30.44) as meses_contrato
      FROM "Clickup".cup_contratos c
      LEFT JOIN "Clickup".cup_clientes cl ON c.id_task = cl.task_id
      WHERE LOWER(c.status) IN ('ativo', 'onboarding', 'triagem')
        AND LOWER(COALESCE(c.squad, '')) NOT IN ('turbo interno', 'squad x', 'interno', 'x')
        AND c.id_subtask IS NOT NULL
    `);

    const contratos = contratosResult.rows as any[];
    if (contratos.length === 0) {
      console.log('[churn-risk] Nenhum contrato ativo encontrado');
      return [];
    }

    // 2. Buscar inadimplência por CNPJ (max dias de atraso)
    const inadimplenciaResult = await db.execute(sql`
      SELECT
        TRIM(caz_cli.cnpj::text) as cnpj,
        MAX(GREATEST(CURRENT_DATE - cp.data_vencimento::date, 0)) as max_dias_atraso,
        COUNT(*) as parcelas_atrasadas
      FROM "Conta Azul".caz_parcelas cp
      INNER JOIN "Conta Azul".caz_clientes caz_cli ON cp.id_cliente::text = caz_cli.ids::text
      WHERE cp.tipo_evento = 'RECEITA'
        AND cp.data_vencimento::date < CURRENT_DATE
        AND COALESCE(cp.nao_pago::numeric, 0) > 0
        AND caz_cli.cnpj IS NOT NULL
        AND TRIM(caz_cli.cnpj::text) != ''
      GROUP BY TRIM(caz_cli.cnpj::text)
    `);
    const inadimplenciaMap = new Map<string, { maxDiasAtraso: number; parcelas: number }>();
    for (const row of inadimplenciaResult.rows as any[]) {
      inadimplenciaMap.set(row.cnpj, {
        maxDiasAtraso: parseInt(row.max_dias_atraso) || 0,
        parcelas: parseInt(row.parcelas_atrasadas) || 0,
      });
    }

    // 3. Buscar churn rate por squad (últimos 3 meses)
    const squadChurnResult = await db.execute(sql`
      WITH ativos AS (
        SELECT squad, COUNT(*) as total
        FROM "Clickup".cup_contratos
        WHERE LOWER(status) IN ('ativo', 'onboarding', 'triagem')
          AND squad IS NOT NULL
        GROUP BY squad
      ),
      churned AS (
        SELECT squad, COUNT(*) as total
        FROM "Clickup".cup_contratos
        WHERE LOWER(status) IN ('encerrado', 'cancelado/inativo')
          AND data_solicitacao_encerramento >= (CURRENT_DATE - INTERVAL '90 days')
          AND squad IS NOT NULL
        GROUP BY squad
      )
      SELECT
        a.squad,
        CASE WHEN a.total > 0
          THEN (COALESCE(ch.total, 0)::numeric / a.total::numeric) * 100
          ELSE 0
        END as churn_rate
      FROM ativos a
      LEFT JOIN churned ch ON a.squad = ch.squad
    `);
    const squadChurnMap = new Map<string, number>();
    for (const row of squadChurnResult.rows as any[]) {
      squadChurnMap.set(row.squad, parseFloat(row.churn_rate) || 0);
    }

    // 4. Buscar churn rate por produto (últimos 3 meses)
    const produtoChurnResult = await db.execute(sql`
      WITH ativos AS (
        SELECT produto, COUNT(*) as total
        FROM "Clickup".cup_contratos
        WHERE LOWER(status) IN ('ativo', 'onboarding', 'triagem')
          AND produto IS NOT NULL
        GROUP BY produto
      ),
      churned AS (
        SELECT produto, COUNT(*) as total
        FROM "Clickup".cup_contratos
        WHERE LOWER(status) IN ('encerrado', 'cancelado/inativo')
          AND data_solicitacao_encerramento >= (CURRENT_DATE - INTERVAL '90 days')
          AND produto IS NOT NULL
        GROUP BY produto
      )
      SELECT
        a.produto,
        CASE WHEN a.total > 0
          THEN (COALESCE(ch.total, 0)::numeric / a.total::numeric) * 100
          ELSE 0
        END as churn_rate
      FROM ativos a
      LEFT JOIN churned ch ON a.produto = ch.produto
    `);
    const produtoChurnMap = new Map<string, number>();
    for (const row of produtoChurnResult.rows as any[]) {
      produtoChurnMap.set(row.produto, parseFloat(row.churn_rate) || 0);
    }

    // 5. Buscar tendência de MRR por contrato (comparando snapshot 3 meses atrás vs agora)
    const mrrTrendResult = await db.execute(sql`
      WITH recente AS (
        SELECT id_subtask, COALESCE(valorr::numeric, 0) as mrr_recente
        FROM "Clickup".cup_data_hist
        WHERE data_snapshot >= (CURRENT_DATE - INTERVAL '7 days')
          AND LOWER(status) IN ('ativo', 'onboarding', 'triagem')
          AND id_subtask IS NOT NULL
      ),
      antigo AS (
        SELECT DISTINCT ON (id_subtask)
          id_subtask, COALESCE(valorr::numeric, 0) as mrr_antigo
        FROM "Clickup".cup_data_hist
        WHERE data_snapshot >= (CURRENT_DATE - INTERVAL '97 days')
          AND data_snapshot <= (CURRENT_DATE - INTERVAL '83 days')
          AND LOWER(status) IN ('ativo', 'onboarding', 'triagem')
          AND id_subtask IS NOT NULL
        ORDER BY id_subtask, data_snapshot DESC
      )
      SELECT
        r.id_subtask,
        CASE WHEN a.mrr_antigo > 0
          THEN ((r.mrr_recente - a.mrr_antigo) / a.mrr_antigo) * 100
          ELSE NULL
        END as variacao_pct
      FROM recente r
      LEFT JOIN antigo a ON r.id_subtask = a.id_subtask
    `);
    const mrrTrendMap = new Map<string, number | null>();
    for (const row of mrrTrendResult.rows as any[]) {
      mrrTrendMap.set(row.id_subtask, row.variacao_pct !== null ? parseFloat(row.variacao_pct) : null);
    }

    // 6. Buscar clientes que não pagaram a primeira parcela
    const primeiraNaoPagaResult = await db.execute(sql`
      WITH primeira_parcela AS (
        SELECT
          TRIM(caz_cli.cnpj::text) as cnpj,
          cp.data_vencimento,
          cp.nao_pago
        FROM "Conta Azul".caz_parcelas cp
        INNER JOIN "Conta Azul".caz_clientes caz_cli ON cp.id_cliente::text = caz_cli.ids::text
        WHERE cp.tipo_evento = 'RECEITA'
          AND caz_cli.cnpj IS NOT NULL
          AND TRIM(caz_cli.cnpj::text) != ''
        ORDER BY TRIM(caz_cli.cnpj::text), cp.data_vencimento
      ),
      primeira AS (
        SELECT DISTINCT ON (cnpj) cnpj, nao_pago
        FROM primeira_parcela
        ORDER BY cnpj, data_vencimento
      )
      SELECT cnpj
      FROM primeira
      WHERE COALESCE(nao_pago::numeric, 0) > 0
    `);
    const primeiraNaoPagaSet = new Set<string>();
    for (const row of primeiraNaoPagaResult.rows as any[]) {
      primeiraNaoPagaSet.add(row.cnpj);
    }

    // 7. Calcular scores para cada contrato
    const results: ChurnRiskResult[] = [];

    for (const contrato of contratos) {
      const cnpj = contrato.cnpj ? contrato.cnpj.trim() : null;
      const fatores: ChurnRiskFactor[] = [];

      // Sinal 1: Inadimplência (peso: 25)
      const inadData = cnpj ? inadimplenciaMap.get(cnpj) : null;
      const s1 = scoreInadimplencia(inadData?.maxDiasAtraso ?? null);
      fatores.push({ sinal: 'Inadimplência', peso: 25, valor: s1.valor, descricao: s1.descricao });

      // Sinal 2: Tempo de contrato (peso: 15)
      const s2 = scoreTempoContrato(parseFloat(contrato.meses_contrato) || null);
      fatores.push({ sinal: 'Tempo de Contrato', peso: 15, valor: s2.valor, descricao: s2.descricao });

      // Sinal 3: Histórico de pausas (peso: 15)
      const jaPausou = !!contrato.data_pausa;
      const s3 = scorePausa(jaPausou);
      fatores.push({ sinal: 'Histórico de Pausas', peso: 15, valor: s3.valor, descricao: s3.descricao });

      // Sinal 4: Churn rate do squad (peso: 10)
      const squadChurn = contrato.squad ? squadChurnMap.get(contrato.squad) ?? null : null;
      const s4 = scoreChurnSquad(squadChurn);
      fatores.push({ sinal: 'Churn do Squad', peso: 10, valor: s4.valor, descricao: s4.descricao });

      // Sinal 5: Churn rate do produto (peso: 10)
      const produtoChurn = contrato.produto ? produtoChurnMap.get(contrato.produto) ?? null : null;
      const s5 = scoreChurnProduto(produtoChurn);
      fatores.push({ sinal: 'Churn do Produto', peso: 10, valor: s5.valor, descricao: s5.descricao });

      // Sinal 6: Tendência de MRR (peso: 15)
      const mrrVar = mrrTrendMap.get(contrato.contrato_id) ?? null;
      const s6 = scoreTendenciaMRR(mrrVar);
      fatores.push({ sinal: 'Tendência de MRR', peso: 15, valor: s6.valor, descricao: s6.descricao });

      // Sinal 7: Primeira parcela não paga (peso: 10)
      const primeiraNaoPaga = cnpj ? primeiraNaoPagaSet.has(cnpj) : false;
      const s7 = scorePrimeiraParcela(primeiraNaoPaga);
      fatores.push({ sinal: 'Primeira Parcela', peso: 10, valor: s7.valor, descricao: s7.descricao });

      // Total
      const score = Math.min(100, s1.valor + s2.valor + s3.valor + s4.valor + s5.valor + s6.valor + s7.valor);

      results.push({
        contratoId: contrato.contrato_id,
        clienteNome: contrato.cliente_nome,
        cnpj,
        score,
        tier: classifyTier(score),
        fatores,
        mrr: parseFloat(contrato.mrr) || 0,
        squad: contrato.squad,
        produto: contrato.produto,
        csResponsavel: contrato.cs_responsavel,
      });
    }

    // Ordenar por score descrescente
    results.sort((a, b) => b.score - a.score);

    return results;
  } catch (error) {
    console.error('[churn-risk] Erro ao calcular risk scores:', error);
    throw error;
  }
}

/**
 * Recalcula e salva todos os risk scores no banco
 */
export async function recalculateAndSave(): Promise<{ total: number; summary: RiskSummary }> {
  const scores = await calculateAllRiskScores();

  // Limpar scores antigos
  await db.execute(sql`DELETE FROM cortex_core.churn_risk_scores`);

  // Inserir novos scores em lotes
  const batchSize = 50;
  for (let i = 0; i < scores.length; i += batchSize) {
    const batch = scores.slice(i, i + batchSize);
    for (const s of batch) {
      await db.execute(sql`
        INSERT INTO cortex_core.churn_risk_scores
          (contrato_id, cliente_nome, cnpj, score, tier, fatores, mrr, squad, produto, cs_responsavel, calculated_at)
        VALUES (
          ${s.contratoId}, ${s.clienteNome}, ${s.cnpj}, ${s.score}, ${s.tier},
          ${JSON.stringify(s.fatores)}::jsonb,
          ${s.mrr}, ${s.squad}, ${s.produto}, ${s.csResponsavel}, NOW()
        )
      `);
    }
  }

  const summary = buildSummary(scores);
  console.log(`[churn-risk] ${scores.length} scores recalculados. Críticos: ${summary.critico}, Altos: ${summary.alto}`);
  return { total: scores.length, summary };
}

/**
 * Busca risk scores do banco com filtros opcionais
 */
export async function getRiskScores(filters?: {
  squad?: string;
  tier?: string;
  produto?: string;
  limit?: number;
}): Promise<ChurnRiskResult[]> {
  let query = `
    SELECT contrato_id, cliente_nome, cnpj, score, tier, fatores, mrr::numeric, squad, produto, cs_responsavel, calculated_at
    FROM cortex_core.churn_risk_scores
    WHERE 1=1
  `;

  if (filters?.squad) query += ` AND squad = '${filters.squad.replace(/'/g, "''")}'`;
  if (filters?.tier) query += ` AND tier = '${filters.tier.replace(/'/g, "''")}'`;
  if (filters?.produto) query += ` AND produto = '${filters.produto.replace(/'/g, "''")}'`;

  query += ' ORDER BY score DESC';

  if (filters?.limit) query += ` LIMIT ${parseInt(String(filters.limit))}`;

  const result = await db.execute(sql.raw(query));

  return (result.rows as any[]).map(row => ({
    contratoId: row.contrato_id,
    clienteNome: row.cliente_nome,
    cnpj: row.cnpj,
    score: parseInt(row.score),
    tier: row.tier as ChurnRiskResult['tier'],
    fatores: typeof row.fatores === 'string' ? JSON.parse(row.fatores) : (row.fatores || []),
    mrr: parseFloat(row.mrr) || 0,
    squad: row.squad,
    produto: row.produto,
    csResponsavel: row.cs_responsavel,
  }));
}

/**
 * Busca score de um contrato específico
 */
export async function getRiskScoreByContract(contratoId: string): Promise<ChurnRiskResult | null> {
  const result = await db.execute(sql`
    SELECT contrato_id, cliente_nome, cnpj, score, tier, fatores, mrr::numeric, squad, produto, cs_responsavel
    FROM cortex_core.churn_risk_scores
    WHERE contrato_id = ${contratoId}
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as any;
  return {
    contratoId: row.contrato_id,
    clienteNome: row.cliente_nome,
    cnpj: row.cnpj,
    score: parseInt(row.score),
    tier: row.tier,
    fatores: typeof row.fatores === 'string' ? JSON.parse(row.fatores) : (row.fatores || []),
    mrr: parseFloat(row.mrr) || 0,
    squad: row.squad,
    produto: row.produto,
    csResponsavel: row.cs_responsavel,
  };
}

/**
 * Retorna resumo agregado dos risk scores
 */
export async function getRiskSummary(): Promise<RiskSummary> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN tier = 'critico' THEN 1 END) as critico,
      COUNT(CASE WHEN tier = 'alto' THEN 1 END) as alto,
      COUNT(CASE WHEN tier = 'moderado' THEN 1 END) as moderado,
      COUNT(CASE WHEN tier = 'baixo' THEN 1 END) as baixo,
      COALESCE(SUM(CASE WHEN tier IN ('critico', 'alto') THEN mrr::numeric ELSE 0 END), 0) as mrr_em_risco,
      COALESCE(SUM(CASE WHEN tier = 'critico' THEN mrr::numeric ELSE 0 END), 0) as mrr_critico,
      COALESCE(SUM(CASE WHEN tier = 'alto' THEN mrr::numeric ELSE 0 END), 0) as mrr_alto
    FROM cortex_core.churn_risk_scores
  `);

  const row = result.rows[0] as any;
  return {
    totalContratos: parseInt(row.total) || 0,
    critico: parseInt(row.critico) || 0,
    alto: parseInt(row.alto) || 0,
    moderado: parseInt(row.moderado) || 0,
    baixo: parseInt(row.baixo) || 0,
    mrrEmRisco: parseFloat(row.mrr_em_risco) || 0,
    mrrCritico: parseFloat(row.mrr_critico) || 0,
    mrrAlto: parseFloat(row.mrr_alto) || 0,
  };
}

function buildSummary(scores: ChurnRiskResult[]): RiskSummary {
  return {
    totalContratos: scores.length,
    critico: scores.filter(s => s.tier === 'critico').length,
    alto: scores.filter(s => s.tier === 'alto').length,
    moderado: scores.filter(s => s.tier === 'moderado').length,
    baixo: scores.filter(s => s.tier === 'baixo').length,
    mrrEmRisco: scores.filter(s => s.tier === 'critico' || s.tier === 'alto').reduce((sum, s) => sum + s.mrr, 0),
    mrrCritico: scores.filter(s => s.tier === 'critico').reduce((sum, s) => sum + s.mrr, 0),
    mrrAlto: scores.filter(s => s.tier === 'alto').reduce((sum, s) => sum + s.mrr, 0),
  };
}

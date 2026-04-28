import { db } from "../db";
import { sql } from "drizzle-orm";

// ============== TYPES ==============

export interface ForecastPoint {
  dataAlvo: string; // YYYY-MM
  valorOtimista: number;
  valorRealista: number;
  valorPessimista: number;
}

export interface MrrForecastResult {
  historico: { mes: string; mrr: number }[];
  projecao: ForecastPoint[];
  breakdownSquad: { squad: string; mrr: number; projetado: number }[];
  churnRateBase: number;
  ticketMedioBase: number;
  novosContratosBase: number;
}

export interface ChurnForecastResult {
  mensal: { mes: string; contratos: number; mrrPerdido: number; porTier: Record<string, number> }[];
  topContratos: { contratoId: string; clienteNome: string; mrr: number; score: number; squad: string; probabilidade: number }[];
  porTier: Record<string, { contratos: number; mrr: number; probabilidade: number }>;
  taxasPorTier: Record<string, number>;
}

export interface NrrProjectionResult {
  historico: { mes: string; nrr: number; expansao: number; contracao: number }[];
  projecao: ForecastPoint[];
  breakdownSquad: { squad: string; nrr: number }[];
  taxaExpansaoBase: number;
  taxaChurnBase: number;
}

export interface InadimplenciaForecastResult {
  mensal: { mes: string; faixa_1_30: number; faixa_31_60: number; faixa_61_90: number; faixa_90_plus: number; total: number }[];
  porFaixa: Record<string, { valor: number; tendencia: 'up' | 'down' | 'stable' }>;
  taxaRecuperacaoBase: Record<string, number>;
  novosInadimplentesBase: number;
}

export interface RevenueAtRiskResult {
  porTier: Record<string, { contratos: number; mrr: number }>;
  evolucao: { mes: string; critico: number; alto: number; moderado: number; baixo: number; total: number }[];
  efetividadeBase: number;
}

export interface PredictionSummary {
  mrrProjetado: ForecastPoint;
  churnProjetado: { contratos: number; mrr: number };
  nrrProjetado: number;
  horizonte: number;
  dataCalculo: string;
  acuracia: Record<string, number>;
}

// ============== HOLT-WINTERS ==============

interface HoltWintersParams {
  alpha: number; // nível
  beta: number;  // tendência
  gamma: number; // sazonalidade
  seasonLength: number;
}

function holtWinters(
  series: number[],
  params: HoltWintersParams,
  forecastHorizon: number
): { forecast: number[]; stdError: number } {
  const { alpha, beta, gamma, seasonLength } = params;
  const n = series.length;

  if (n < seasonLength * 2) {
    // Fallback: regressão linear simples se dados insuficientes para sazonalidade
    return linearForecast(series, forecastHorizon);
  }

  // Inicialização
  let level = series.slice(0, seasonLength).reduce((a, b) => a + b, 0) / seasonLength;
  let trend = 0;
  for (let i = 0; i < seasonLength; i++) {
    trend += (series[seasonLength + i] - series[i]);
  }
  trend /= (seasonLength * seasonLength);

  const seasonal = new Array(n + forecastHorizon).fill(0);
  for (let i = 0; i < seasonLength; i++) {
    seasonal[i] = series[i] - level;
  }

  // Fitting
  const fitted: number[] = [];
  const errors: number[] = [];

  for (let t = 0; t < n; t++) {
    const prevLevel = level;
    const prevTrend = trend;
    const seasonIndex = t % seasonLength;

    if (t >= seasonLength) {
      level = alpha * (series[t] - seasonal[t - seasonLength]) + (1 - alpha) * (prevLevel + prevTrend);
      trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
      seasonal[t] = gamma * (series[t] - level) + (1 - gamma) * seasonal[t - seasonLength];
    }

    const fittedValue = (prevLevel + prevTrend) + (t >= seasonLength ? seasonal[t - seasonLength] : seasonal[seasonIndex]);
    fitted.push(fittedValue);

    if (t >= seasonLength) {
      errors.push(Math.abs(series[t] - fittedValue));
    }
  }

  // Forecast
  const forecast: number[] = [];
  for (let h = 1; h <= forecastHorizon; h++) {
    const seasonIndex = ((n - seasonLength) + ((h - 1) % seasonLength)) % seasonLength;
    const value = level + (trend * h) + seasonal[n - seasonLength + (h - 1) % seasonLength];
    forecast.push(Math.max(0, value)); // MRR não pode ser negativo
  }

  const stdError = errors.length > 0
    ? Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length)
    : forecast[0] * 0.1; // fallback 10%

  return { forecast, stdError };
}

function linearForecast(
  series: number[],
  forecastHorizon: number
): { forecast: number[]; stdError: number } {
  const n = series.length;
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((a, b) => a + b, 0) / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (series[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }

  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;

  const forecast: number[] = [];
  const residuals: number[] = [];

  for (let i = 0; i < n; i++) {
    residuals.push(Math.abs(series[i] - (intercept + slope * i)));
  }

  for (let h = 1; h <= forecastHorizon; h++) {
    forecast.push(Math.max(0, intercept + slope * (n - 1 + h)));
  }

  const stdError = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length);

  return { forecast, stdError };
}

// ============== MRR FORECAST ==============

export async function calculateMrrForecast(horizonteMeses: number): Promise<MrrForecastResult> {
  // Buscar MRR mensal dos últimos 24 meses de cup_data_hist
  const historicoResult = await db.execute(sql`
    WITH monthly_mrr AS (
      SELECT
        DATE_TRUNC('month', data_snapshot) AS mes,
        MAX(data_snapshot) AS last_snapshot
      FROM "Clickup".cup_data_hist
      WHERE data_snapshot >= NOW() - INTERVAL '24 months'
        AND LOWER(status) IN ('ativo', 'em cancelamento')
      GROUP BY DATE_TRUNC('month', data_snapshot)
    )
    SELECT
      TO_CHAR(m.mes, 'YYYY-MM') AS mes,
      COALESCE(SUM(h.valorr::numeric), 0) AS mrr
    FROM monthly_mrr m
    JOIN "Clickup".cup_data_hist h
      ON h.data_snapshot = m.last_snapshot
      AND LOWER(h.status) IN ('ativo', 'em cancelamento')
    GROUP BY m.mes
    ORDER BY m.mes
  `);

  const historico = (historicoResult.rows as any[]).map(r => ({
    mes: r.mes,
    mrr: parseFloat(r.mrr) || 0,
  }));

  const series = historico.map(h => h.mrr);

  // Holt-Winters com sazonalidade de 12 meses
  const { forecast, stdError } = holtWinters(
    series,
    { alpha: 0.3, beta: 0.1, gamma: 0.2, seasonLength: 12 },
    horizonteMeses
  );

  // Gerar datas futuras
  const lastDate = new Date(historico[historico.length - 1]?.mes + '-01' || new Date());
  const projecao: ForecastPoint[] = forecast.map((val, i) => {
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + i + 1);
    const mes = d.toISOString().slice(0, 7);
    return {
      dataAlvo: mes,
      valorRealista: Math.round(val),
      valorOtimista: Math.round(val + 1.28 * stdError),
      valorPessimista: Math.round(Math.max(0, val - 1.28 * stdError)),
    };
  });

  // Breakdown por squad (proporção atual projetada)
  const squadResult = await db.execute(sql`
    SELECT squad, COALESCE(SUM(valorr::numeric), 0) AS mrr
    FROM "Clickup".cup_contratos
    WHERE LOWER(status) IN ('ativo', 'em cancelamento')
      AND squad IS NOT NULL
    GROUP BY squad
    ORDER BY mrr DESC
  `);

  const totalMrr = (squadResult.rows as any[]).reduce((sum: number, r: any) => sum + (parseFloat(r.mrr) || 0), 0);
  const lastForecast = projecao[projecao.length - 1]?.valorRealista || totalMrr;

  const breakdownSquad = (squadResult.rows as any[]).map(r => ({
    squad: r.squad,
    mrr: parseFloat(r.mrr) || 0,
    projetado: totalMrr > 0 ? Math.round((parseFloat(r.mrr) / totalMrr) * lastForecast) : 0,
  }));

  // Métricas base para simulação
  const baseMetrics = await db.execute(sql`
    SELECT
      COUNT(DISTINCT CASE
        WHEN data_inicio >= NOW() - INTERVAL '3 months' THEN id_subtask
      END)::numeric / 3 AS novos_contratos_mes,
      AVG(CASE
        WHEN data_inicio >= NOW() - INTERVAL '3 months' THEN valorr::numeric
      END) AS ticket_medio_novos,
      COUNT(DISTINCT CASE
        WHEN data_encerramento >= NOW() - INTERVAL '3 months' THEN id_subtask
      END)::numeric /
      NULLIF(COUNT(DISTINCT CASE WHEN LOWER(status) IN ('ativo', 'em cancelamento') THEN id_subtask END)::numeric, 0) / 3 AS churn_rate_mensal
    FROM "Clickup".cup_contratos
  `);

  const bm = baseMetrics.rows[0] as any;

  return {
    historico,
    projecao,
    breakdownSquad,
    churnRateBase: parseFloat(bm.churn_rate_mensal) || 0.03,
    ticketMedioBase: parseFloat(bm.ticket_medio_novos) || 2000,
    novosContratosBase: parseFloat(bm.novos_contratos_mes) || 5,
  };
}

// ============== CHURN FORECAST ==============

export async function calculateChurnForecast(horizonteMeses: number): Promise<ChurnForecastResult> {
  // Buscar taxas históricas de churn por tier
  const taxasResult = await db.execute(sql`
    WITH scored AS (
      SELECT
        s.contrato_id,
        s.tier,
        s.mrr::numeric AS mrr,
        s.calculated_at,
        CASE WHEN c.data_encerramento IS NOT NULL
             AND c.data_encerramento >= s.calculated_at - INTERVAL '90 days'
             THEN true ELSE false
        END AS churned
      FROM cortex_core.churn_risk_scores s
      JOIN "Clickup".cup_contratos c ON c.id_subtask = s.contrato_id
    )
    SELECT
      tier,
      COUNT(*) AS total,
      COUNT(CASE WHEN churned THEN 1 END) AS churned,
      COUNT(CASE WHEN churned THEN 1 END)::numeric / NULLIF(COUNT(*), 0) AS taxa
    FROM scored
    GROUP BY tier
  `);

  const taxasPorTier: Record<string, number> = {
    critico: 0.18, alto: 0.08, moderado: 0.03, baixo: 0.01 // defaults
  };
  for (const row of taxasResult.rows as any[]) {
    if (row.taxa) taxasPorTier[row.tier] = parseFloat(row.taxa);
  }

  // Buscar contratos ativos com scores
  const contratosResult = await db.execute(sql`
    SELECT
      s.contrato_id,
      s.cliente_nome,
      s.score,
      s.tier,
      s.mrr::numeric AS mrr,
      s.squad,
      s.produto
    FROM cortex_core.churn_risk_scores s
    JOIN "Clickup".cup_contratos c ON c.id_subtask = s.contrato_id
    WHERE LOWER(c.status) IN ('ativo', 'em cancelamento')
    ORDER BY s.score DESC
  `);

  const contratos = (contratosResult.rows as any[]).map(r => ({
    contratoId: r.contrato_id,
    clienteNome: r.cliente_nome || 'N/A',
    score: parseInt(r.score),
    tier: r.tier as string,
    mrr: parseFloat(r.mrr) || 0,
    squad: r.squad || 'N/A',
    produto: r.produto || 'N/A',
    probabilidadeMensal: taxasPorTier[r.tier] || 0.03,
  }));

  // Projetar churn por mês
  const mensal: ChurnForecastResult['mensal'] = [];
  const now = new Date();

  for (let m = 1; m <= horizonteMeses; m++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + m);
    const mes = d.toISOString().slice(0, 7);

    let totalContratos = 0;
    let totalMrrPerdido = 0;
    const porTier: Record<string, number> = {};

    for (const c of contratos) {
      // P(churn no mês m) = P_mensal * (1 - P_mensal)^(m-1) — prob de churnar exatamente no mês m
      const pChurnNoMes = c.probabilidadeMensal * Math.pow(1 - c.probabilidadeMensal, m - 1);
      const mrrEsperado = c.mrr * pChurnNoMes;

      totalContratos += pChurnNoMes;
      totalMrrPerdido += mrrEsperado;
      porTier[c.tier] = (porTier[c.tier] || 0) + mrrEsperado;
    }

    mensal.push({
      mes,
      contratos: Math.round(totalContratos),
      mrrPerdido: Math.round(totalMrrPerdido),
      porTier,
    });
  }

  // Top 10 contratos em risco
  const topContratos = contratos.slice(0, 10).map(c => ({
    contratoId: c.contratoId,
    clienteNome: c.clienteNome,
    mrr: c.mrr,
    score: c.score,
    squad: c.squad,
    probabilidade: c.probabilidadeMensal,
  }));

  // Agregação por tier
  const porTier: Record<string, { contratos: number; mrr: number; probabilidade: number }> = {};
  for (const tier of ['critico', 'alto', 'moderado', 'baixo']) {
    const tierContratos = contratos.filter(c => c.tier === tier);
    porTier[tier] = {
      contratos: tierContratos.length,
      mrr: tierContratos.reduce((sum, c) => sum + c.mrr, 0),
      probabilidade: taxasPorTier[tier],
    };
  }

  return { mensal, topContratos, porTier, taxasPorTier };
}

// ============== NRR PROJECTION ==============

export async function calculateNrrProjection(horizonteMeses: number): Promise<NrrProjectionResult> {
  // Calcular NRR histórico (últimos 12 meses)
  const nrrResult = await db.execute(sql`
    WITH monthly AS (
      SELECT
        DATE_TRUNC('month', data_snapshot) AS mes,
        MAX(data_snapshot) AS last_snap
      FROM "Clickup".cup_data_hist
      WHERE data_snapshot >= NOW() - INTERVAL '13 months'
        AND LOWER(status) IN ('ativo', 'em cancelamento')
      GROUP BY 1
      ORDER BY 1
    ),
    mrr_by_month AS (
      SELECT
        TO_CHAR(m.mes, 'YYYY-MM') AS mes,
        COALESCE(SUM(h.valorr::numeric), 0) AS mrr
      FROM monthly m
      JOIN "Clickup".cup_data_hist h ON h.data_snapshot = m.last_snap
        AND LOWER(h.status) IN ('ativo', 'em cancelamento')
      GROUP BY m.mes
      ORDER BY m.mes
    )
    SELECT
      mes,
      mrr,
      LAG(mrr) OVER (ORDER BY mes) AS mrr_anterior
    FROM mrr_by_month
  `);

  const rows = nrrResult.rows as any[];
  const historico: NrrProjectionResult['historico'] = [];
  const nrrValues: number[] = [];

  for (const r of rows) {
    if (!r.mrr_anterior) continue;
    const mrr = parseFloat(r.mrr);
    const mrrAnterior = parseFloat(r.mrr_anterior);
    const nrr = mrrAnterior > 0 ? (mrr / mrrAnterior) * 100 : 100;
    const expansao = Math.max(0, mrr - mrrAnterior);
    const contracao = Math.max(0, mrrAnterior - mrr);

    historico.push({
      mes: r.mes,
      nrr: Math.round(nrr * 10) / 10,
      expansao: Math.round(expansao),
      contracao: Math.round(contracao),
    });
    nrrValues.push(nrr);
  }

  // Projeção NRR usando média móvel dos últimos 6 meses
  const recentNrr = nrrValues.slice(-6);
  const avgNrr = recentNrr.reduce((a, b) => a + b, 0) / recentNrr.length;
  const stdNrr = Math.sqrt(recentNrr.reduce((sum, v) => sum + (v - avgNrr) ** 2, 0) / recentNrr.length);

  const now = new Date();
  const projecao: ForecastPoint[] = [];
  for (let m = 1; m <= horizonteMeses; m++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + m);
    projecao.push({
      dataAlvo: d.toISOString().slice(0, 7),
      valorRealista: Math.round(avgNrr * 10) / 10,
      valorOtimista: Math.round((avgNrr + 1.28 * stdNrr) * 10) / 10,
      valorPessimista: Math.round((avgNrr - 1.28 * stdNrr) * 10) / 10,
    });
  }

  // Breakdown por squad
  const squadNrrResult = await db.execute(sql`
    WITH current_mrr AS (
      SELECT squad, COALESCE(SUM(valorr::numeric), 0) AS mrr
      FROM "Clickup".cup_contratos
      WHERE LOWER(status) IN ('ativo', 'em cancelamento') AND squad IS NOT NULL
      GROUP BY squad
    ),
    prev_mrr AS (
      SELECT h.squad, COALESCE(SUM(h.valorr::numeric), 0) AS mrr
      FROM "Clickup".cup_data_hist h
      WHERE h.data_snapshot = (
        SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist
        WHERE data_snapshot < DATE_TRUNC('month', NOW())
      )
      AND LOWER(h.status) IN ('ativo', 'em cancelamento') AND h.squad IS NOT NULL
      GROUP BY h.squad
    )
    SELECT
      c.squad,
      CASE WHEN p.mrr > 0 THEN ROUND((c.mrr / p.mrr) * 100, 1) ELSE 100 END AS nrr
    FROM current_mrr c
    LEFT JOIN prev_mrr p ON c.squad = p.squad
    ORDER BY nrr DESC
  `);

  const breakdownSquad = (squadNrrResult.rows as any[]).map(r => ({
    squad: r.squad,
    nrr: parseFloat(r.nrr) || 100,
  }));

  // Taxas base para simulação
  const avgExpansao = historico.length > 0
    ? historico.slice(-6).reduce((sum, h) => sum + h.expansao, 0) / Math.min(historico.length, 6)
    : 0;
  const avgContracao = historico.length > 0
    ? historico.slice(-6).reduce((sum, h) => sum + h.contracao, 0) / Math.min(historico.length, 6)
    : 0;
  const lastMrr = historico[historico.length - 1]?.nrr ? parseFloat(rows[rows.length - 1]?.mrr) || 1 : 1;

  return {
    historico,
    projecao,
    breakdownSquad,
    taxaExpansaoBase: lastMrr > 0 ? Math.round((avgExpansao / lastMrr) * 1000) / 10 : 0,
    taxaChurnBase: lastMrr > 0 ? Math.round((avgContracao / lastMrr) * 1000) / 10 : 0,
  };
}

// ============== INADIMPLÊNCIA FORECAST ==============

export async function calculateInadimplenciaForecast(horizonteMeses: number): Promise<InadimplenciaForecastResult> {
  // Buscar aging histórico dos últimos 12 meses
  const agingResult = await db.execute(sql`
    WITH monthly_aging AS (
      SELECT
        TO_CHAR(DATE_TRUNC('month', data_vencimento), 'YYYY-MM') AS mes_vencimento,
        SUM(CASE WHEN CURRENT_DATE - data_vencimento::date BETWEEN 1 AND 30 THEN valor_bruto::numeric ELSE 0 END) AS faixa_1_30,
        SUM(CASE WHEN CURRENT_DATE - data_vencimento::date BETWEEN 31 AND 60 THEN valor_bruto::numeric ELSE 0 END) AS faixa_31_60,
        SUM(CASE WHEN CURRENT_DATE - data_vencimento::date BETWEEN 61 AND 90 THEN valor_bruto::numeric ELSE 0 END) AS faixa_61_90,
        SUM(CASE WHEN CURRENT_DATE - data_vencimento::date > 90 THEN valor_bruto::numeric ELSE 0 END) AS faixa_90_plus
      FROM "Conta Azul".caz_parcelas
      WHERE LOWER(tipo_evento) = 'receita'
        AND data_quitacao IS NULL
        AND data_vencimento < CURRENT_DATE
        AND data_vencimento >= NOW() - INTERVAL '12 months'
      GROUP BY 1
      ORDER BY 1
    )
    SELECT * FROM monthly_aging
  `);

  const agingHistory = (agingResult.rows as any[]).map(r => ({
    mes: r.mes_vencimento,
    faixa_1_30: parseFloat(r.faixa_1_30) || 0,
    faixa_31_60: parseFloat(r.faixa_31_60) || 0,
    faixa_61_90: parseFloat(r.faixa_61_90) || 0,
    faixa_90_plus: parseFloat(r.faixa_90_plus) || 0,
    total: (parseFloat(r.faixa_1_30) || 0) + (parseFloat(r.faixa_31_60) || 0) +
           (parseFloat(r.faixa_61_90) || 0) + (parseFloat(r.faixa_90_plus) || 0),
  }));

  // Calcular taxas de transição (média dos últimos 6 meses)
  const transResult = await db.execute(sql`
    SELECT
      COUNT(CASE WHEN data_quitacao IS NOT NULL AND CURRENT_DATE - data_vencimento::date BETWEEN 1 AND 30 THEN 1 END)::numeric /
        NULLIF(COUNT(CASE WHEN CURRENT_DATE - data_vencimento::date BETWEEN 1 AND 30 THEN 1 END), 0) AS recup_1_30,
      COUNT(CASE WHEN data_quitacao IS NOT NULL AND CURRENT_DATE - data_vencimento::date BETWEEN 31 AND 60 THEN 1 END)::numeric /
        NULLIF(COUNT(CASE WHEN CURRENT_DATE - data_vencimento::date BETWEEN 31 AND 60 THEN 1 END), 0) AS recup_31_60,
      COUNT(CASE WHEN data_quitacao IS NOT NULL AND CURRENT_DATE - data_vencimento::date BETWEEN 61 AND 90 THEN 1 END)::numeric /
        NULLIF(COUNT(CASE WHEN CURRENT_DATE - data_vencimento::date BETWEEN 61 AND 90 THEN 1 END), 0) AS recup_61_90,
      COUNT(CASE WHEN data_quitacao IS NOT NULL AND CURRENT_DATE - data_vencimento::date > 90 THEN 1 END)::numeric /
        NULLIF(COUNT(CASE WHEN CURRENT_DATE - data_vencimento::date > 90 THEN 1 END), 0) AS recup_90_plus
    FROM "Conta Azul".caz_parcelas
    WHERE LOWER(tipo_evento) = 'receita'
      AND data_vencimento >= NOW() - INTERVAL '6 months'
      AND data_vencimento < CURRENT_DATE
  `);

  const tr = transResult.rows[0] as any;
  const taxaRecuperacao: Record<string, number> = {
    '1-30': parseFloat(tr.recup_1_30) || 0.6,
    '31-60': parseFloat(tr.recup_31_60) || 0.35,
    '61-90': parseFloat(tr.recup_61_90) || 0.15,
    '90+': parseFloat(tr.recup_90_plus) || 0.05,
  };

  // Estoque atual de inadimplência
  const currentAging = agingHistory[agingHistory.length - 1] || {
    faixa_1_30: 0, faixa_31_60: 0, faixa_61_90: 0, faixa_90_plus: 0, total: 0
  };

  // Novos inadimplentes/mês (média últimos 6 meses)
  const recent = agingHistory.slice(-6);
  const avgNovos = recent.length > 0
    ? recent.reduce((sum, h) => sum + h.faixa_1_30, 0) / recent.length
    : currentAging.faixa_1_30;

  // Projetar usando matriz de transição
  const mensal: InadimplenciaForecastResult['mensal'] = [];
  let estado = { ...currentAging };
  const now = new Date();

  for (let m = 1; m <= horizonteMeses; m++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + m);

    const novo = {
      mes: d.toISOString().slice(0, 7),
      faixa_1_30: avgNovos,
      faixa_31_60: estado.faixa_1_30 * (1 - taxaRecuperacao['1-30']),
      faixa_61_90: estado.faixa_31_60 * (1 - taxaRecuperacao['31-60']),
      faixa_90_plus: estado.faixa_61_90 * (1 - taxaRecuperacao['61-90']) + estado.faixa_90_plus * (1 - taxaRecuperacao['90+']),
      total: 0,
    };
    novo.total = novo.faixa_1_30 + novo.faixa_31_60 + novo.faixa_61_90 + novo.faixa_90_plus;

    mensal.push({
      mes: novo.mes,
      faixa_1_30: Math.round(novo.faixa_1_30),
      faixa_31_60: Math.round(novo.faixa_31_60),
      faixa_61_90: Math.round(novo.faixa_61_90),
      faixa_90_plus: Math.round(novo.faixa_90_plus),
      total: Math.round(novo.total),
    });

    estado = novo;
  }

  // Tendências
  const calcTendencia = (valores: number[]): 'up' | 'down' | 'stable' => {
    if (valores.length < 2) return 'stable';
    const first = valores.slice(0, Math.floor(valores.length / 2));
    const second = valores.slice(Math.floor(valores.length / 2));
    const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
    const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
    const diff = (avgSecond - avgFirst) / avgFirst;
    if (diff > 0.05) return 'up';
    if (diff < -0.05) return 'down';
    return 'stable';
  };

  const porFaixa: Record<string, { valor: number; tendencia: 'up' | 'down' | 'stable' }> = {
    '1-30': { valor: Math.round(currentAging.faixa_1_30), tendencia: calcTendencia(agingHistory.map(h => h.faixa_1_30)) },
    '31-60': { valor: Math.round(currentAging.faixa_31_60), tendencia: calcTendencia(agingHistory.map(h => h.faixa_31_60)) },
    '61-90': { valor: Math.round(currentAging.faixa_61_90), tendencia: calcTendencia(agingHistory.map(h => h.faixa_61_90)) },
    '90+': { valor: Math.round(currentAging.faixa_90_plus), tendencia: calcTendencia(agingHistory.map(h => h.faixa_90_plus)) },
  };

  return {
    mensal,
    porFaixa,
    taxaRecuperacaoBase: taxaRecuperacao,
    novosInadimplentesBase: Math.round(avgNovos),
  };
}

// ============== REVENUE AT RISK ==============

export async function calculateRevenueAtRisk(horizonteMeses: number): Promise<RevenueAtRiskResult> {
  // Agregação atual por tier
  const tierResult = await db.execute(sql`
    SELECT
      s.tier,
      COUNT(*) AS contratos,
      COALESCE(SUM(s.mrr::numeric), 0) AS mrr
    FROM cortex_core.churn_risk_scores s
    JOIN "Clickup".cup_contratos c ON c.id_subtask = s.contrato_id
    WHERE LOWER(c.status) IN ('ativo', 'em cancelamento')
    GROUP BY s.tier
  `);

  const porTier: Record<string, { contratos: number; mrr: number }> = {};
  for (const row of tierResult.rows as any[]) {
    porTier[row.tier] = {
      contratos: parseInt(row.contratos),
      mrr: Math.round(parseFloat(row.mrr) || 0),
    };
  }

  // Evolução histórica (últimos 6 meses, se existir cache anterior)
  const evolucaoResult = await db.execute(sql`
    SELECT
      TO_CHAR(data_referencia, 'YYYY-MM') AS mes,
      metadata
    FROM cortex_core.predictions_cache
    WHERE tipo = 'revenue_at_risk'
      AND horizonte_meses = ${horizonteMeses}
      AND data_referencia >= NOW() - INTERVAL '6 months'
    ORDER BY data_referencia
  `);

  const evolucao = (evolucaoResult.rows as any[]).map(r => {
    const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {});
    return {
      mes: r.mes,
      critico: meta.critico || 0,
      alto: meta.alto || 0,
      moderado: meta.moderado || 0,
      baixo: meta.baixo || 0,
      total: (meta.critico || 0) + (meta.alto || 0) + (meta.moderado || 0) + (meta.baixo || 0),
    };
  });

  return {
    porTier,
    evolucao,
    efetividadeBase: 0.3, // 30% dos contratos críticos retidos com intervenção
  };
}

// ============== CACHE & ORCHESTRATION ==============

async function clearPredictionsCache(tipo: string, horizonte: number): Promise<void> {
  await db.execute(sql`
    DELETE FROM cortex_core.predictions_cache
    WHERE tipo = ${tipo} AND horizonte_meses = ${horizonte}
  `);
}

async function savePrediction(
  tipo: string,
  horizonte: number,
  dataAlvo: string,
  valores: ForecastPoint,
  metadata: any = {}
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.predictions_cache
      (tipo, horizonte_meses, data_referencia, data_alvo, valor_otimista, valor_realista, valor_pessimista, metadata)
    VALUES
      (${tipo}, ${horizonte}, NOW(), ${dataAlvo + '-01'}::timestamp, ${valores.valorOtimista}, ${valores.valorRealista}, ${valores.valorPessimista}, ${JSON.stringify(metadata)}::jsonb)
  `);
}

export async function runAllForecasts(): Promise<{ success: boolean; duration: number; errors: string[] }> {
  const start = Date.now();
  const errors: string[] = [];
  const horizontes = [3, 6, 12];

  for (const h of horizontes) {
    // MRR Forecast
    try {
      await clearPredictionsCache('mrr_forecast', h);
      const mrr = await calculateMrrForecast(h);
      for (const p of mrr.projecao) {
        await savePrediction('mrr_forecast', h, p.dataAlvo, p, {
          breakdownSquad: mrr.breakdownSquad,
          churnRateBase: mrr.churnRateBase,
          ticketMedioBase: mrr.ticketMedioBase,
          novosContratosBase: mrr.novosContratosBase,
        });
      }
      console.log(`[predictions] MRR forecast (${h}m) OK`);
    } catch (e: any) {
      errors.push(`mrr_forecast_${h}m: ${e.message}`);
      console.error(`[predictions] MRR forecast (${h}m) FAILED:`, e);
    }

    // Churn Forecast
    try {
      await clearPredictionsCache('churn_forecast', h);
      const churn = await calculateChurnForecast(h);
      for (const m of churn.mensal) {
        await savePrediction('churn_forecast', h, m.mes, {
          dataAlvo: m.mes,
          valorRealista: m.mrrPerdido,
          valorOtimista: Math.round(m.mrrPerdido * 0.7),
          valorPessimista: Math.round(m.mrrPerdido * 1.3),
        }, { contratos: m.contratos, porTier: m.porTier, topContratos: churn.topContratos, taxasPorTier: churn.taxasPorTier });
      }
      console.log(`[predictions] Churn forecast (${h}m) OK`);
    } catch (e: any) {
      errors.push(`churn_forecast_${h}m: ${e.message}`);
      console.error(`[predictions] Churn forecast (${h}m) FAILED:`, e);
    }

    // NRR Projection
    try {
      await clearPredictionsCache('nrr_projection', h);
      const nrr = await calculateNrrProjection(h);
      for (const p of nrr.projecao) {
        await savePrediction('nrr_projection', h, p.dataAlvo, p, {
          breakdownSquad: nrr.breakdownSquad,
          taxaExpansaoBase: nrr.taxaExpansaoBase,
          taxaChurnBase: nrr.taxaChurnBase,
        });
      }
      console.log(`[predictions] NRR projection (${h}m) OK`);
    } catch (e: any) {
      errors.push(`nrr_projection_${h}m: ${e.message}`);
      console.error(`[predictions] NRR projection (${h}m) FAILED:`, e);
    }

    // Inadimplência Forecast
    try {
      await clearPredictionsCache('inadimplencia_forecast', h);
      const inad = await calculateInadimplenciaForecast(h);
      for (const m of inad.mensal) {
        await savePrediction('inadimplencia_forecast', h, m.mes, {
          dataAlvo: m.mes,
          valorRealista: m.total,
          valorOtimista: Math.round(m.total * 0.7),
          valorPessimista: Math.round(m.total * 1.3),
        }, { faixas: { faixa_1_30: m.faixa_1_30, faixa_31_60: m.faixa_31_60, faixa_61_90: m.faixa_61_90, faixa_90_plus: m.faixa_90_plus },
             taxaRecuperacaoBase: inad.taxaRecuperacaoBase, novosInadimplentesBase: inad.novosInadimplentesBase });
      }
      console.log(`[predictions] Inadimplencia forecast (${h}m) OK`);
    } catch (e: any) {
      errors.push(`inadimplencia_forecast_${h}m: ${e.message}`);
      console.error(`[predictions] Inadimplencia forecast (${h}m) FAILED:`, e);
    }

    // Revenue at Risk
    try {
      await clearPredictionsCache('revenue_at_risk', h);
      const risk = await calculateRevenueAtRisk(h);
      const totalRisk = Object.values(risk.porTier).reduce((sum, t) => sum + t.mrr, 0);
      await savePrediction('revenue_at_risk', h, new Date().toISOString().slice(0, 7), {
        dataAlvo: new Date().toISOString().slice(0, 7),
        valorRealista: totalRisk,
        valorOtimista: Math.round(totalRisk * 0.7),
        valorPessimista: Math.round(totalRisk * 1.3),
      }, { porTier: risk.porTier, evolucao: risk.evolucao, efetividadeBase: risk.efetividadeBase });
      console.log(`[predictions] Revenue at risk (${h}m) OK`);
    } catch (e: any) {
      errors.push(`revenue_at_risk_${h}m: ${e.message}`);
      console.error(`[predictions] Revenue at risk (${h}m) FAILED:`, e);
    }
  }

  const duration = Date.now() - start;
  console.log(`[predictions] All forecasts completed in ${duration}ms. Errors: ${errors.length}`);
  return { success: errors.length === 0, duration, errors };
}

// ============== SUMMARY (for Hero KPIs) ==============

export async function getPredictionSummary(horizonte: number): Promise<PredictionSummary> {
  const mrrResult = await db.execute(sql`
    SELECT data_alvo, valor_otimista, valor_realista, valor_pessimista
    FROM cortex_core.predictions_cache
    WHERE tipo = 'mrr_forecast' AND horizonte_meses = ${horizonte}
    ORDER BY data_alvo DESC LIMIT 1
  `);

  const churnResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(valor_realista::numeric), 0) AS mrr_total,
      COALESCE(SUM((metadata->>'contratos')::numeric), 0) AS contratos_total
    FROM cortex_core.predictions_cache
    WHERE tipo = 'churn_forecast' AND horizonte_meses = ${horizonte}
  `);

  const nrrResult = await db.execute(sql`
    SELECT valor_realista
    FROM cortex_core.predictions_cache
    WHERE tipo = 'nrr_projection' AND horizonte_meses = ${horizonte}
    ORDER BY data_alvo DESC LIMIT 1
  `);

  const accuracyResult = await db.execute(sql`
    SELECT tipo, AVG(ABS(erro_percentual::numeric)) AS erro_medio
    FROM cortex_core.predictions_accuracy
    WHERE criado_em >= NOW() - INTERVAL '6 months'
    GROUP BY tipo
  `);

  const mrr = mrrResult.rows[0] as any;
  const churn = churnResult.rows[0] as any;
  const nrr = nrrResult.rows[0] as any;
  const acuracia: Record<string, number> = {};
  for (const r of accuracyResult.rows as any[]) {
    acuracia[r.tipo] = Math.round(100 - (parseFloat(r.erro_medio) || 0));
  }

  return {
    mrrProjetado: {
      dataAlvo: mrr?.data_alvo?.toISOString?.()?.slice(0, 7) || '',
      valorOtimista: parseFloat(mrr?.valor_otimista) || 0,
      valorRealista: parseFloat(mrr?.valor_realista) || 0,
      valorPessimista: parseFloat(mrr?.valor_pessimista) || 0,
    },
    churnProjetado: {
      contratos: parseInt(churn?.contratos_total) || 0,
      mrr: parseFloat(churn?.mrr_total) || 0,
    },
    nrrProjetado: parseFloat(nrr?.valor_realista) || 100,
    horizonte,
    dataCalculo: new Date().toISOString().slice(0, 10),
    acuracia,
  };
}

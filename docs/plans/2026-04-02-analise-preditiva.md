# Análise Preditiva — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dashboard executivo de análise preditiva com 5 módulos de forecast (MRR, Churn, NRR, Inadimplência, Revenue at Risk), cálculo diário automatizado, simulação client-side, e validação de acurácia.

**Architecture:** Motor de predição TypeScript no backend (`predictiveEngine.ts`) que roda diariamente via `setInterval`, calcula forecasts usando Holt-Winters / sobrevivência / matriz de transição, e salva em `cortex_core.predictions_cache`. Frontend consome dados pré-calculados via React Query, com simulação "what-if" 100% client-side usando sliders que aplicam multiplicadores sobre a baseline.

**Tech Stack:** TypeScript, PostgreSQL (Drizzle ORM raw SQL), Recharts, React Query, Tailwind CSS (dark mode).

**Design doc:** `docs/plans/2026-04-02-analise-preditiva-design.md`

---

## Task 1: Schema — Tabelas de Cache e Acurácia

**Files:**
- Modify: `shared/schema.ts` (adicionar tabelas)
- Modify: `server/db.ts` (adicionar inicialização)

**Step 1: Adicionar tabelas ao schema Drizzle**

Em `shared/schema.ts`, após as definições de `churnRiskScores`, adicionar:

```typescript
// ============== PREDICTIONS ==============

export const predictionsCache = cortexCoreSchema.table("predictions_cache", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // 'mrr_forecast', 'churn_forecast', 'nrr_projection', 'inadimplencia_forecast', 'revenue_at_risk'
  horizonteMeses: integer("horizonte_meses").notNull(),
  dataReferencia: timestamp("data_referencia").notNull(),
  dataAlvo: timestamp("data_alvo").notNull(),
  valorOtimista: decimal("valor_otimista"),
  valorRealista: decimal("valor_realista"),
  valorPessimista: decimal("valor_pessimista"),
  metadata: jsonb("metadata").default({}),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type PredictionCache = typeof predictionsCache.$inferSelect;
export type InsertPredictionCache = typeof predictionsCache.$inferInsert;

export const predictionsAccuracy = cortexCoreSchema.table("predictions_accuracy", {
  id: serial("id").primaryKey(),
  predictionId: integer("prediction_id"),
  tipo: text("tipo").notNull(),
  dataAlvo: timestamp("data_alvo").notNull(),
  valorPrevisto: decimal("valor_previsto"),
  valorReal: decimal("valor_real"),
  erroPercentual: decimal("erro_percentual"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type PredictionAccuracy = typeof predictionsAccuracy.$inferSelect;
```

**Step 2: Adicionar função de inicialização em `server/db.ts`**

```typescript
export async function initializePredictionsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.predictions_cache (
        id SERIAL PRIMARY KEY,
        tipo TEXT NOT NULL,
        horizonte_meses INTEGER NOT NULL,
        data_referencia TIMESTAMP NOT NULL,
        data_alvo TIMESTAMP NOT NULL,
        valor_otimista DECIMAL,
        valor_realista DECIMAL,
        valor_pessimista DECIMAL,
        metadata JSONB DEFAULT '{}',
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.predictions_accuracy (
        id SERIAL PRIMARY KEY,
        prediction_id INTEGER,
        tipo TEXT NOT NULL,
        data_alvo TIMESTAMP NOT NULL,
        valor_previsto DECIMAL,
        valor_real DECIMAL,
        erro_percentual DECIMAL,
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_predictions_cache_tipo_horizonte
      ON cortex_core.predictions_cache(tipo, horizonte_meses, data_alvo)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_predictions_accuracy_tipo
      ON cortex_core.predictions_accuracy(tipo, data_alvo)
    `);

    console.log('[database] Predictions tables initialized');
  } catch (error) {
    console.error('[database] Error initializing predictions tables:', error);
  }
}
```

Chamar `initializePredictionsTable()` no bloco de inicialização de `server/db.ts` junto com as outras tabelas.

**Step 3: Commit**

```bash
git add shared/schema.ts server/db.ts
git commit -m "feat(predictions): add predictions_cache and predictions_accuracy tables"
```

---

## Task 2: Motor de Predição — MRR Forecast (Holt-Winters)

**Files:**
- Create: `server/services/predictiveEngine.ts`

**Step 1: Criar o serviço com tipos e MRR forecast**

```typescript
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
        AND status IN ('ATIVO', 'EM CANCELAMENTO')
      GROUP BY DATE_TRUNC('month', data_snapshot)
    )
    SELECT
      TO_CHAR(m.mes, 'YYYY-MM') AS mes,
      COALESCE(SUM(h.valorr::numeric), 0) AS mrr
    FROM monthly_mrr m
    JOIN "Clickup".cup_data_hist h
      ON h.data_snapshot = m.last_snapshot
      AND h.status IN ('ATIVO', 'EM CANCELAMENTO')
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
    WHERE status IN ('ATIVO', 'EM CANCELAMENTO')
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
      NULLIF(COUNT(DISTINCT CASE WHEN status IN ('ATIVO', 'EM CANCELAMENTO') THEN id_subtask END)::numeric, 0) / 3 AS churn_rate_mensal
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
```

**Step 2: Commit**

```bash
git add server/services/predictiveEngine.ts
git commit -m "feat(predictions): add predictive engine with Holt-Winters MRR forecast"
```

---

## Task 3: Motor de Predição — Churn Forecast

**Files:**
- Modify: `server/services/predictiveEngine.ts`

**Step 1: Adicionar churn forecast ao engine**

Adicionar após `calculateMrrForecast`:

```typescript
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
    WHERE c.status IN ('ATIVO', 'EM CANCELAMENTO')
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
```

**Step 2: Commit**

```bash
git add server/services/predictiveEngine.ts
git commit -m "feat(predictions): add churn forecast with survival model"
```

---

## Task 4: Motor de Predição — NRR, Inadimplência e Revenue at Risk

**Files:**
- Modify: `server/services/predictiveEngine.ts`

**Step 1: Adicionar NRR Projection**

```typescript
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
        AND status IN ('ATIVO', 'EM CANCELAMENTO')
      GROUP BY 1
      ORDER BY 1
    ),
    mrr_by_month AS (
      SELECT
        TO_CHAR(m.mes, 'YYYY-MM') AS mes,
        COALESCE(SUM(h.valorr::numeric), 0) AS mrr
      FROM monthly m
      JOIN "Clickup".cup_data_hist h ON h.data_snapshot = m.last_snap
        AND h.status IN ('ATIVO', 'EM CANCELAMENTO')
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
      WHERE status IN ('ATIVO', 'EM CANCELAMENTO') AND squad IS NOT NULL
      GROUP BY squad
    ),
    prev_mrr AS (
      SELECT h.squad, COALESCE(SUM(h.valorr::numeric), 0) AS mrr
      FROM "Clickup".cup_data_hist h
      WHERE h.data_snapshot = (
        SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist
        WHERE data_snapshot < DATE_TRUNC('month', NOW())
      )
      AND h.status IN ('ATIVO', 'EM CANCELAMENTO') AND h.squad IS NOT NULL
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
```

**Step 2: Adicionar Inadimplência Forecast**

```typescript
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
      WHERE tipo_evento = 'receita'
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
    WHERE tipo_evento = 'receita'
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
```

**Step 3: Adicionar Revenue at Risk**

```typescript
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
    WHERE c.status IN ('ATIVO', 'EM CANCELAMENTO')
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
```

**Step 4: Commit**

```bash
git add server/services/predictiveEngine.ts
git commit -m "feat(predictions): add NRR, inadimplencia and revenue-at-risk forecasts"
```

---

## Task 5: Motor de Predição — Orquestrador, Cache e Cron

**Files:**
- Modify: `server/services/predictiveEngine.ts` (adicionar orquestrador)
- Modify: `server/index.ts` (adicionar cron)

**Step 1: Adicionar funções de cache e orquestração**

No final de `predictiveEngine.ts`:

```typescript
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
```

**Step 2: Registrar cron em `server/index.ts`**

Encontrar onde os outros `setInterval` estão registrados e adicionar:

```typescript
import { runAllForecasts } from "./services/predictiveEngine";

// Predictive Analytics - run daily at startup + every 24h
const PREDICTIONS_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// Run on startup after a delay (tables need to be initialized)
setTimeout(async () => {
  console.log('[predictions] Running initial forecast calculation...');
  try {
    await runAllForecasts();
  } catch (e) {
    console.error('[predictions] Initial calculation failed:', e);
  }
}, 30000); // 30s delay for startup

setInterval(async () => {
  console.log('[predictions] Running scheduled forecast calculation...');
  try {
    await runAllForecasts();
  } catch (e) {
    console.error('[predictions] Scheduled calculation failed:', e);
  }
}, PREDICTIONS_INTERVAL);
```

**Step 3: Commit**

```bash
git add server/services/predictiveEngine.ts server/index.ts
git commit -m "feat(predictions): add orchestrator, cache management and daily cron"
```

---

## Task 6: API Routes — Endpoints de Predição

**Files:**
- Create: `server/routes/predictions.ts`
- Modify: `server/routes.ts` (registrar)

**Step 1: Criar arquivo de rotas**

```typescript
// server/routes/predictions.ts
import type { Express } from "express";

export function registerPredictionRoutes(app: Express) {
  // Summary (Hero KPIs)
  app.get("/api/predictions/summary", async (req, res) => {
    try {
      const { getPredictionSummary } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const summary = await getPredictionSummary(horizonte);
      res.json(summary);
    } catch (error) {
      console.error("[api] Error fetching prediction summary:", error);
      res.status(500).json({ error: "Falha ao buscar resumo de predições" });
    }
  });

  // MRR Forecast
  app.get("/api/predictions/mrr-forecast", async (req, res) => {
    try {
      const { calculateMrrForecast } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateMrrForecast(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching MRR forecast:", error);
      res.status(500).json({ error: "Falha ao buscar forecast de MRR" });
    }
  });

  // Churn Forecast
  app.get("/api/predictions/churn-forecast", async (req, res) => {
    try {
      const { calculateChurnForecast } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateChurnForecast(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching churn forecast:", error);
      res.status(500).json({ error: "Falha ao buscar forecast de churn" });
    }
  });

  // NRR Projection
  app.get("/api/predictions/nrr-projection", async (req, res) => {
    try {
      const { calculateNrrProjection } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateNrrProjection(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching NRR projection:", error);
      res.status(500).json({ error: "Falha ao buscar projeção de NRR" });
    }
  });

  // Inadimplência Forecast
  app.get("/api/predictions/inadimplencia-forecast", async (req, res) => {
    try {
      const { calculateInadimplenciaForecast } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateInadimplenciaForecast(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia forecast:", error);
      res.status(500).json({ error: "Falha ao buscar forecast de inadimplência" });
    }
  });

  // Revenue at Risk
  app.get("/api/predictions/revenue-at-risk", async (req, res) => {
    try {
      const { calculateRevenueAtRisk } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateRevenueAtRisk(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching revenue at risk:", error);
      res.status(500).json({ error: "Falha ao buscar revenue at risk" });
    }
  });

  // Accuracy history
  app.get("/api/predictions/accuracy", async (req, res) => {
    try {
      const { db } = await import("../db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`
        SELECT tipo, data_alvo, valor_previsto::numeric, valor_real::numeric, erro_percentual::numeric, criado_em
        FROM cortex_core.predictions_accuracy
        ORDER BY criado_em DESC
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching prediction accuracy:", error);
      res.status(500).json({ error: "Falha ao buscar acurácia" });
    }
  });
}
```

**Step 2: Registrar em `server/routes.ts`**

Adicionar import e chamada junto com os outros registros de rotas:

```typescript
import { registerPredictionRoutes } from "./routes/predictions";

// No registerRoutes():
registerPredictionRoutes(app);
```

**Step 3: Commit**

```bash
git add server/routes/predictions.ts server/routes.ts
git commit -m "feat(predictions): add API endpoints for all forecast modules"
```

---

## Task 7: Navegação — Permissão, Rota e Menu

**Files:**
- Modify: `shared/nav-config.ts`
- Modify: `client/src/App.tsx`

**Step 1: Adicionar permissão e nav item em `shared/nav-config.ts`**

Em `PERMISSION_KEYS.GESTAO`, adicionar:

```typescript
ANALISE_PREDITIVA: 'gestao.analise_preditiva',
```

Em `ROUTE_TO_PERMISSION`, adicionar:

```typescript
'/dashboard/analise-preditiva': PERMISSION_KEYS.GESTAO.ANALISE_PREDITIVA,
```

Em `NAV_CONFIG.setores` → Gestão → items, adicionar após "Predição de Churn" (ou no final):

```typescript
{ title: 'Análise Preditiva', url: '/dashboard/analise-preditiva', icon: 'TrendingUp', permissionKey: PERMISSION_KEYS.GESTAO.ANALISE_PREDITIVA },
```

**Step 2: Registrar rota em `client/src/App.tsx`**

Adicionar lazy import:

```typescript
const AnalisePreditiva = lazyWithRetry(() => import("@/pages/gestao/AnalisePreditiva"));
```

Adicionar rota:

```typescript
<Route path="/dashboard/analise-preditiva">{() => <ProtectedRoute path="/dashboard/analise-preditiva" component={AnalisePreditiva} />}</Route>
```

**Step 3: Commit**

```bash
git add shared/nav-config.ts client/src/App.tsx
git commit -m "feat(predictions): add navigation, permissions and route for analise preditiva"
```

---

## Task 8: Frontend — Componentes Compartilhados (SimulationPanel, ForecastChart, AccuracyBadge)

**Files:**
- Create: `client/src/components/predictions/SimulationPanel.tsx`
- Create: `client/src/components/predictions/ForecastChart.tsx`
- Create: `client/src/components/predictions/AccuracyBadge.tsx`

**Step 1: SimulationPanel**

```typescript
// client/src/components/predictions/SimulationPanel.tsx
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  format: (value: number) => string; // ex: (v) => `${v}%` or (v) => `R$ ${v}`
}

interface SimulationPanelProps {
  sliders: SliderConfig[];
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  deltaLabel?: string;
  deltaValue?: string;
}

export function SimulationPanel({ sliders, values, onChange, deltaLabel, deltaValue }: SimulationPanelProps) {
  const handleChange = useCallback((key: string, val: number[]) => {
    onChange({ ...values, [key]: val[0] });
  }, [values, onChange]);

  const handleReset = useCallback(() => {
    const defaults: Record<string, number> = {};
    for (const s of sliders) {
      defaults[s.key] = s.defaultValue;
    }
    onChange(defaults);
  }, [sliders, onChange]);

  const hasChanges = sliders.some(s => values[s.key] !== s.defaultValue);

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          Simulador What-If
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {sliders.map((s) => (
          <div key={s.key} className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-zinc-400">{s.label}</span>
              <span className={`font-mono font-medium ${
                values[s.key] !== s.defaultValue
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {s.format(values[s.key])}
              </span>
            </div>
            <Slider
              value={[values[s.key]]}
              min={s.min}
              max={s.max}
              step={s.step}
              onValueChange={(val) => handleChange(s.key, val)}
            />
          </div>
        ))}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
            className="text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Resetar
          </Button>
          {deltaLabel && deltaValue && hasChanges && (
            <div className="text-right">
              <div className="text-[10px] text-gray-500 dark:text-zinc-500">{deltaLabel}</div>
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{deltaValue}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: ForecastChart**

```typescript
// client/src/components/predictions/ForecastChart.tsx
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface ForecastDataPoint {
  mes: string;
  real?: number;
  realista?: number;
  otimista?: number;
  pessimista?: number;
  simulado?: number;
}

interface ForecastChartProps {
  data: ForecastDataPoint[];
  todayIndex: number; // index where projection starts
  formatValue?: (value: number) => string;
  height?: number;
  yDomain?: [number | string, number | string];
  referenceLine?: { y: number; label: string };
}

export function ForecastChart({
  data,
  todayIndex,
  formatValue = (v) => `R$ ${(v / 1000).toFixed(0)}k`,
  height = 350,
  yDomain,
  referenceLine,
}: ForecastChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const gridColor = isDark ? "#3f3f46" : "#e5e7eb";
  const axisColor = isDark ? "#a1a1aa" : "#6b7280";
  const todayMonth = data[todayIndex]?.mes || '';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11, fill: axisColor }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: axisColor }}
          tickFormatter={formatValue}
          tickLine={false}
          domain={yDomain}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#18181b" : "#fff",
            border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [formatValue(value), name]}
        />

        {/* Cone de incerteza */}
        <Area
          dataKey="otimista"
          stroke="none"
          fill={isDark ? "#22d3ee20" : "#06b6d420"}
          name="Otimista"
        />
        <Area
          dataKey="pessimista"
          stroke="none"
          fill={isDark ? "#18181b" : "#ffffff"}
          name="Pessimista"
        />

        {/* Linha real (histórico) */}
        <Line
          dataKey="real"
          stroke={isDark ? "#a78bfa" : "#7c3aed"}
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Real"
          connectNulls={false}
        />

        {/* Linha realista (projeção) */}
        <Line
          dataKey="realista"
          stroke={isDark ? "#22d3ee" : "#0891b2"}
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 2 }}
          name="Projeção"
          connectNulls={false}
        />

        {/* Linha simulada */}
        {data.some(d => d.simulado !== undefined) && (
          <Line
            dataKey="simulado"
            stroke={isDark ? "#fbbf24" : "#d97706"}
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={false}
            name="Simulação"
            connectNulls={false}
          />
        )}

        {/* Linha vertical "Hoje" */}
        <ReferenceLine
          x={todayMonth}
          stroke={isDark ? "#71717a" : "#9ca3af"}
          strokeDasharray="4 4"
          label={{ value: "Hoje", position: "top", fontSize: 10, fill: axisColor }}
        />

        {/* Linha de referência opcional */}
        {referenceLine && (
          <ReferenceLine
            y={referenceLine.y}
            stroke={isDark ? "#ef4444" : "#dc2626"}
            strokeDasharray="8 4"
            label={{ value: referenceLine.label, position: "right", fontSize: 10, fill: isDark ? "#ef4444" : "#dc2626" }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

**Step 3: AccuracyBadge**

```typescript
// client/src/components/predictions/AccuracyBadge.tsx
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

interface AccuracyBadgeProps {
  accuracy?: number; // 0-100 (100 = sem erro)
  label?: string;
}

export function AccuracyBadge({ accuracy, label }: AccuracyBadgeProps) {
  if (accuracy === undefined || accuracy === null) {
    return (
      <Badge variant="outline" className="text-xs text-gray-400 dark:text-zinc-500 border-gray-300 dark:border-zinc-600">
        <ShieldQuestion className="w-3 h-3 mr-1" />
        Calibrando
      </Badge>
    );
  }

  const isHigh = accuracy >= 90;
  const isMedium = accuracy >= 80 && accuracy < 90;

  if (isHigh) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Alta confiança
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Acurácia: {accuracy.toFixed(0)}% {label && `(${label})`}</p>
          <p className="text-xs text-gray-400">Erro médio &lt; 10% nos últimos 6 meses</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isMedium) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
            <ShieldAlert className="w-3 h-3 mr-1" />
            Média confiança
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Acurácia: {accuracy.toFixed(0)}% {label && `(${label})`}</p>
          <p className="text-xs text-gray-400">Erro médio 10-20% nos últimos 6 meses</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
          <ShieldAlert className="w-3 h-3 mr-1" />
          Baixa confiança
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Acurácia: {accuracy.toFixed(0)}% {label && `(${label})`}</p>
        <p className="text-xs text-gray-400">Erro médio &gt; 20% — modelo em calibração</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

**Step 4: Commit**

```bash
git add client/src/components/predictions/
git commit -m "feat(predictions): add shared components - SimulationPanel, ForecastChart, AccuracyBadge"
```

---

## Task 9: Frontend — Página Principal (AnalisePreditiva.tsx)

**Files:**
- Create: `client/src/pages/gestao/AnalisePreditiva.tsx`

**Step 1: Criar página principal com Hero KPIs e estrutura de abas**

```typescript
// client/src/pages/gestao/AnalisePreditiva.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, ShieldAlert } from "lucide-react";
import { AccuracyBadge } from "@/components/predictions/AccuracyBadge";
import { MrrForecastTab } from "@/components/predictions/MrrForecastTab";
import { ChurnForecastTab } from "@/components/predictions/ChurnForecastTab";
import { NrrProjectionTab } from "@/components/predictions/NrrProjectionTab";
import { InadimplenciaForecastTab } from "@/components/predictions/InadimplenciaForecastTab";
import { RevenueAtRiskTab } from "@/components/predictions/RevenueAtRiskTab";

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

export default function AnalisePreditiva() {
  usePageTitle("Análise Preditiva");
  useSetPageInfo("Análise Preditiva", "Projeções e simulações de cenários");

  const [horizonte, setHorizonte] = useState<string>("6");
  const [abaAtiva, setAbaAtiva] = useState("mrr");

  const { data: summary, isLoading } = useQuery<{
    mrrProjetado: { valorOtimista: number; valorRealista: number; valorPessimista: number };
    churnProjetado: { contratos: number; mrr: number };
    nrrProjetado: number;
    acuracia: Record<string, number>;
  }>({
    queryKey: ["/api/predictions/summary", { horizonte }],
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Análise Preditiva
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Projeções baseadas em dados históricos com simulação de cenários
            </p>
          </div>
        </div>
        <Select value={horizonte} onValueChange={setHorizonte}>
          <SelectTrigger className="w-40 bg-white dark:bg-zinc-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 meses</SelectItem>
            <SelectItem value="6">6 meses</SelectItem>
            <SelectItem value="12">12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-5 pb-4">
            {isLoading ? <Skeleton className="h-12 w-32" /> : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    MRR Projetado ({horizonte}m)
                  </span>
                  <AccuracyBadge accuracy={summary?.acuracia?.mrr_forecast} label="MRR" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrencyCompact(summary?.mrrProjetado?.valorRealista || 0)}
                </div>
                <div className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  {formatCurrencyCompact(summary?.mrrProjetado?.valorPessimista || 0)} — {formatCurrencyCompact(summary?.mrrProjetado?.valorOtimista || 0)}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-5 pb-4">
            {isLoading ? <Skeleton className="h-12 w-32" /> : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    Churn Projetado ({horizonte}m)
                  </span>
                  <AccuracyBadge accuracy={summary?.acuracia?.churn_forecast} label="Churn" />
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrencyCompact(summary?.churnProjetado?.mrr || 0)}
                </div>
                <div className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  ~{summary?.churnProjetado?.contratos || 0} contratos
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-5 pb-4">
            {isLoading ? <Skeleton className="h-12 w-32" /> : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    NRR Projetado
                  </span>
                  <AccuracyBadge accuracy={summary?.acuracia?.nrr_projection} label="NRR" />
                </div>
                <div className={`text-2xl font-bold ${
                  (summary?.nrrProjetado || 100) >= 100
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {(summary?.nrrProjetado || 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  {(summary?.nrrProjetado || 100) >= 100 ? 'Base crescendo' : 'Base encolhendo'}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="bg-gray-100 dark:bg-zinc-800">
          <TabsTrigger value="mrr" className="gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> MRR
          </TabsTrigger>
          <TabsTrigger value="churn" className="gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> Churn
          </TabsTrigger>
          <TabsTrigger value="nrr" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" /> NRR
          </TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Inadimplência
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Risk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mrr">
          <MrrForecastTab horizonte={parseInt(horizonte)} />
        </TabsContent>
        <TabsContent value="churn">
          <ChurnForecastTab horizonte={parseInt(horizonte)} />
        </TabsContent>
        <TabsContent value="nrr">
          <NrrProjectionTab horizonte={parseInt(horizonte)} />
        </TabsContent>
        <TabsContent value="inadimplencia">
          <InadimplenciaForecastTab horizonte={parseInt(horizonte)} />
        </TabsContent>
        <TabsContent value="risk">
          <RevenueAtRiskTab horizonte={parseInt(horizonte)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add client/src/pages/gestao/AnalisePreditiva.tsx
git commit -m "feat(predictions): add main AnalisePreditiva page with Hero KPIs and tab structure"
```

---

## Task 10: Frontend — MrrForecastTab

**Files:**
- Create: `client/src/components/predictions/MrrForecastTab.tsx`

**Step 1: Criar aba de MRR Forecast com simulação**

```typescript
// client/src/components/predictions/MrrForecastTab.tsx
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { ForecastChart } from "./ForecastChart";
import { SimulationPanel, type SliderConfig } from "./SimulationPanel";

interface MrrForecastData {
  historico: { mes: string; mrr: number }[];
  projecao: { dataAlvo: string; valorOtimista: number; valorRealista: number; valorPessimista: number }[];
  breakdownSquad: { squad: string; mrr: number; projetado: number }[];
  churnRateBase: number;
  ticketMedioBase: number;
  novosContratosBase: number;
}

const SQUAD_COLORS: Record<string, string> = {
  Supreme: "#3b82f6", Forja: "#a855f7", Nitro: "#f59e0b",
  Starter: "#10b981", Hub: "#ef4444", Venture: "#6366f1",
};

export function MrrForecastTab({ horizonte }: { horizonte: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<MrrForecastData>({
    queryKey: ["/api/predictions/mrr-forecast", { horizonte }],
  });

  const sliderConfigs: SliderConfig[] = useMemo(() => [
    {
      key: "novosContratos",
      label: "Novos contratos/mês",
      min: 0, max: 30, step: 1,
      defaultValue: Math.round(data?.novosContratosBase || 5),
      format: (v) => `${v}`,
    },
    {
      key: "ticketMedio",
      label: "Ticket médio (R$)",
      min: 500, max: 10000, step: 250,
      defaultValue: Math.round(data?.ticketMedioBase || 2000),
      format: (v) => `R$ ${v.toLocaleString("pt-BR")}`,
    },
    {
      key: "churnRate",
      label: "Taxa de churn mensal",
      min: 0, max: 10, step: 0.5,
      defaultValue: Math.round((data?.churnRateBase || 0.03) * 1000) / 10,
      format: (v) => `${v.toFixed(1)}%`,
    },
  ], [data]);

  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    novosContratos: Math.round(data?.novosContratosBase || 5),
    ticketMedio: Math.round(data?.ticketMedioBase || 2000),
    churnRate: Math.round((data?.churnRateBase || 0.03) * 1000) / 10,
  });

  // Atualizar defaults quando dados carregam
  useMemo(() => {
    if (data) {
      setSliderValues({
        novosContratos: Math.round(data.novosContratosBase),
        ticketMedio: Math.round(data.ticketMedioBase),
        churnRate: Math.round(data.churnRateBase * 1000) / 10,
      });
    }
  }, [data]);

  // Simulação client-side
  const chartData = useMemo(() => {
    if (!data) return [];

    const historico = data.historico.map(h => ({
      mes: h.mes,
      real: h.mrr,
    }));

    const hasSimChanges = sliderConfigs.some(s => sliderValues[s.key] !== s.defaultValue);

    const projecao = data.projecao.map((p, i) => {
      const mesesAcumulados = i + 1;
      const ganhoNovos = sliderValues.novosContratos * sliderValues.ticketMedio * mesesAcumulados;
      const churnDiff = (sliderValues.churnRate / 100) - data.churnRateBase;
      const perdaExtra = p.valorRealista * churnDiff * mesesAcumulados;
      const simulado = p.valorRealista + ganhoNovos - perdaExtra;

      return {
        mes: p.dataAlvo,
        realista: p.valorRealista,
        otimista: p.valorOtimista,
        pessimista: p.valorPessimista,
        ...(hasSimChanges ? { simulado: Math.round(simulado) } : {}),
      };
    });

    return [...historico, ...projecao];
  }, [data, sliderValues, sliderConfigs]);

  const deltaValue = useMemo(() => {
    if (!data || !chartData.length) return "";
    const lastProj = chartData[chartData.length - 1];
    if (!lastProj?.simulado || !lastProj?.realista) return "";
    const delta = lastProj.simulado - lastProj.realista;
    const sign = delta >= 0 ? "+" : "";
    return `${sign}R$ ${(delta / 1000).toFixed(0)}k`;
  }, [chartData, data]);

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Gráfico */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              Forecast de MRR — {horizonte} meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastChart
              data={chartData}
              todayIndex={data?.historico?.length ? data.historico.length - 1 : 0}
            />
          </CardContent>
        </Card>

        {/* Simulador */}
        <SimulationPanel
          sliders={sliderConfigs}
          values={sliderValues}
          onChange={setSliderValues}
          deltaLabel="vs baseline"
          deltaValue={deltaValue}
        />
      </div>

      {/* Breakdown por Squad */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            MRR Projetado por Squad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.breakdownSquad || []} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} />
              <XAxis
                type="number"
                tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              />
              <YAxis
                type="category"
                dataKey="squad"
                tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#18181b" : "#fff",
                  border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, ""]}
              />
              <Bar dataKey="projetado" radius={[0, 4, 4, 0]}>
                {(data?.breakdownSquad || []).map((entry) => (
                  <Cell key={entry.squad} fill={SQUAD_COLORS[entry.squad] || "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add client/src/components/predictions/MrrForecastTab.tsx
git commit -m "feat(predictions): add MRR forecast tab with cone chart and simulation"
```

---

## Task 11: Frontend — ChurnForecastTab

**Files:**
- Create: `client/src/components/predictions/ChurnForecastTab.tsx`

Aba com `ComposedChart` (barras por tier + linha de MRR acumulado), painel de simulação com sliders de retenção por tier, e tabela dos top 10 contratos em risco. Segue o mesmo padrão de `MrrForecastTab`: `useQuery` para buscar dados, `useMemo` para simulação, `SimulationPanel` para sliders.

Dados do endpoint: `mensal` (barras), `topContratos` (tabela), `porTier` (cards), `taxasPorTier` (defaults do simulador).

**Commit:** `feat(predictions): add churn forecast tab with tier breakdown and simulation`

---

## Task 12: Frontend — NrrProjectionTab

**Files:**
- Create: `client/src/components/predictions/NrrProjectionTab.tsx`

Aba com `ForecastChart` usando `referenceLine={{ y: 100, label: "100%" }}` para indicar expansão vs contração. Simulador com sliders de taxa de expansão e taxa de churn. Breakdown por squad mostrando quais squads estão acima ou abaixo de 100%.

Dados do endpoint: `historico` (NRR% mensal), `projecao` (forecast), `breakdownSquad`, `taxaExpansaoBase`, `taxaChurnBase`.

**Commit:** `feat(predictions): add NRR projection tab with expansion/contraction decomposition`

---

## Task 13: Frontend — InadimplenciaForecastTab

**Files:**
- Create: `client/src/components/predictions/InadimplenciaForecastTab.tsx`

Aba com `BarChart` empilhado (4 faixas de aging coloridas: verde 1-30d, amarelo 31-60d, laranja 61-90d, vermelho 90d+). Simulador com sliders de taxa de recuperação por faixa e novos inadimplentes/mês. Breakdown mostrando valor e tendência (seta ↑↓) por faixa.

Dados do endpoint: `mensal` (barras empilhadas), `porFaixa` (cards com tendência), `taxaRecuperacaoBase`, `novosInadimplentesBase`.

**Commit:** `feat(predictions): add inadimplencia forecast tab with aging projection`

---

## Task 14: Frontend — RevenueAtRiskTab

**Files:**
- Create: `client/src/components/predictions/RevenueAtRiskTab.tsx`

Aba com `BarChart` horizontal (MRR por tier, cores consistentes com ChurnPredicao). Simulador com slider de efetividade de intervenção CS. Breakdown com série temporal da evolução de Revenue at Risk nos últimos 6 meses.

Dados do endpoint: `porTier` (barras), `evolucao` (área chart), `efetividadeBase`.

**Commit:** `feat(predictions): add revenue at risk tab with intervention simulation`

---

## Task 15: Teste E2E e Ajustes

**Files:**
- Todos os criados anteriormente

**Step 1: Reiniciar dev server**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev
```

**Step 2: Verificar criação das tabelas**

Acessar o app, verificar logs no console para `[database] Predictions tables initialized`.

**Step 3: Testar endpoints**

```bash
curl http://localhost:3000/api/predictions/summary?horizonte=6
curl http://localhost:3000/api/predictions/mrr-forecast?horizonte=6
curl http://localhost:3000/api/predictions/churn-forecast?horizonte=6
curl http://localhost:3000/api/predictions/nrr-projection?horizonte=6
curl http://localhost:3000/api/predictions/inadimplencia-forecast?horizonte=6
curl http://localhost:3000/api/predictions/revenue-at-risk?horizonte=6
```

**Step 4: Testar UI**

- Navegar para `/dashboard/analise-preditiva`
- Verificar Hero KPIs carregam
- Testar cada aba
- Testar sliders de simulação
- Verificar dark mode E light mode
- Testar seletor de horizonte (3/6/12)

**Step 5: Ajustar issues encontrados e commit final**

```bash
git add -A
git commit -m "fix(predictions): adjustments from E2E testing"
```

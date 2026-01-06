// OKR 2026 Registry - Unified Schema
// Bigger & Better — Consolidação, Escala e Padronização

export type KRDirection = "gte" | "lte";
export type KRAggregation = "quarter_end" | "quarter_sum" | "quarter_avg" | "quarter_max" | "quarter_min";

export interface KRDef {
  id: string;
  objectiveId: string;
  title: string;
  metricKey: string;
  unit: "BRL" | "PCT" | "COUNT";
  direction: KRDirection;
  aggregation: KRAggregation;
  targets: { Q1: number; Q2: number; Q3: number; Q4: number; FY?: number };
  notes?: string;
}

export interface ObjectiveDef {
  id: string;
  title: string;
  subtitle?: string;
}

// ============================================================================
// OBJECTIVES - Legado consolidado
// ============================================================================

export const objectives: ObjectiveDef[] = [
  {
    id: "Ox",
    title: "Legado",
    subtitle: "KRs do sistema OKR legado consolidados"
  }
];

// ============================================================================
// KEY RESULTS - Todas as KRs legado consolidadas em Ox
// ============================================================================

export const krs: KRDef[] = [
  // Ecossistema (5 KRs)
  {
    id: "O1_KR1",
    objectiveId: "Ox",
    title: "MRR Ativo",
    metricKey: "mrr_active",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_end",
    targets: { Q1: 1338870, Q2: 1611315, Q3: 1871384, Q4: 2122127 }
  },
  {
    id: "O1_KR2",
    objectiveId: "Ox",
    title: "Receita Total Faturável",
    metricKey: "revenue_total_billable",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 4566375, Q2: 5502104, Q3: 6460412, Q4: 7374380 }
  },
  {
    id: "O1_KR3",
    objectiveId: "Ox",
    title: "Clientes ativos",
    metricKey: "active_customers",
    unit: "COUNT",
    direction: "gte",
    aggregation: "quarter_end",
    targets: { Q1: 346, Q2: 401, Q3: 456, Q4: 511 }
  },
  {
    id: "O1_KR4",
    objectiveId: "Ox",
    title: "Vendas Novas MRR",
    metricKey: "new_mrr_sales",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 600000, Q2: 660000, Q3: 720000, Q4: 780000 }
  },
  {
    id: "O1_KR5",
    objectiveId: "Ox",
    title: "Expansão/Monetização Base",
    metricKey: "expansion_mrr",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 150000, Q2: 180000, Q3: 200000, Q4: 220000 }
  },

  // Eficiência & Sistemas (5 KRs)
  {
    id: "O2_KR1",
    objectiveId: "Ox",
    title: "EBITDA",
    metricKey: "ebitda",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 746055, Q2: 1152814, Q3: 1398628, Q4: 1972271 }
  },
  {
    id: "O2_KR2",
    objectiveId: "Ox",
    title: "Geração Caixa",
    metricKey: "cash_generation",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 394897, Q2: 663357, Q3: 825594, Q4: 1204199 }
  },
  {
    id: "O2_KR3",
    objectiveId: "Ox",
    title: "Caixa fim quarter",
    metricKey: "cash_balance",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_end",
    targets: { Q1: 1044897, Q2: 1708254, Q3: 2533848, Q4: 3738047 }
  },
  {
    id: "O2_KR4",
    objectiveId: "Ox",
    title: "SG&A %",
    metricKey: "sga_pct",
    unit: "PCT",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 21, Q2: 21, Q3: 21, Q4: 21 }
  },
  {
    id: "O2_KR5",
    objectiveId: "Ox",
    title: "CAC %",
    metricKey: "cac_pct",
    unit: "PCT",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 23, Q2: 23, Q3: 23, Q4: 23 }
  },

  // Hugz Ventures / DNVB Pet (4 KRs)
  {
    id: "O3_KR1",
    objectiveId: "Ox",
    title: "Inadimplência %",
    metricKey: "delinquency_pct",
    unit: "PCT",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 6.0, Q2: 6.0, Q3: 6.0, Q4: 6.0 }
  },
  {
    id: "O3_KR2",
    objectiveId: "Ox",
    title: "Net MRR Churn %",
    metricKey: "net_mrr_churn_pct",
    unit: "PCT",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 9.0, Q2: 9.0, Q3: 9.0, Q4: 9.0 }
  },
  {
    id: "O3_KR3",
    objectiveId: "Ox",
    title: "Logo Churn %",
    metricKey: "logo_churn_pct",
    unit: "PCT",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 10.0, Q2: 10.0, Q3: 10.0, Q4: 10.0 }
  },
  {
    id: "O3_KR4",
    objectiveId: "Ox",
    title: "Gross MRR Churn",
    metricKey: "gross_mrr_churn_brl",
    unit: "BRL",
    direction: "lte",
    aggregation: "quarter_sum",
    targets: { Q1: 337129, Q2: 412074, Q3: 483337, Q4: 551824 }
  },

  // TurboOH (3 KRs)
  {
    id: "O4_KR1",
    objectiveId: "Ox",
    title: "Receita Líquida OH",
    metricKey: "turbooh_revenue_net",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 86400, Q2: 259200, Q3: 432000, Q4: 648000 }
  },
  {
    id: "O4_KR2",
    objectiveId: "Ox",
    title: "Resultado OH",
    metricKey: "turbooh_result",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 43650, Q2: 168950, Q3: 304900, Q4: 472200 }
  },
  {
    id: "O4_KR3",
    objectiveId: "Ox",
    title: "Vacância OH %",
    metricKey: "turbooh_vacancy_pct",
    unit: "PCT",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 20, Q2: 15, Q3: 10, Q4: 5 }
  },

  // Padronização & Produto (1 KR)
  {
    id: "O5_KR1",
    objectiveId: "Ox",
    title: "% Iniciativas Padronização",
    metricKey: "standardization_completion_pct",
    unit: "PCT",
    direction: "gte",
    aggregation: "quarter_end",
    targets: { Q1: 25, Q2: 50, Q3: 75, Q4: 100 }
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getObjectiveById(id: string): ObjectiveDef | undefined {
  return objectives.find(o => o.id === id);
}

export function getKRsByObjective(objectiveId: string): KRDef[] {
  return krs.filter(kr => kr.objectiveId === objectiveId);
}

export function getKRById(id: string): KRDef | undefined {
  return krs.find(kr => kr.id === id);
}

export function getCurrentQuarter(): "Q1" | "Q2" | "Q3" | "Q4" {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const OKR_YEAR = 2026;
export const OKR_TITLE = "Bigger & Better — Consolidação, Escala e Padronização";

// ============================================================================
// BACKWARDS COMPATIBILITY ALIASES
// ============================================================================

export const objectiveRegistry = objectives;
export const krRegistry = krs;
export type KR = KRDef;
export type Objective = ObjectiveDef;

// Minimal MetricSpec for backwards compatibility
export interface MetricSpec {
  id: string;
  title: string;
  unit: "BRL" | "PCT" | "COUNT";
  direction: KRDirection;
  required: boolean;
  format: (value: number) => string;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
  return `R$ ${value.toFixed(2)}`;
};
const formatPercentage = (value: number): string => `${value.toFixed(1)}%`;
const formatNumber = (value: number): string => value.toLocaleString("pt-BR");

// Generate metricRegistry from KRs for backwards compatibility
export const metricRegistry: Record<string, MetricSpec> = krs.reduce((acc, kr) => {
  acc[kr.metricKey] = {
    id: kr.metricKey,
    title: kr.title,
    unit: kr.unit,
    direction: kr.direction,
    required: true,
    format: kr.unit === "BRL" ? formatCurrency : kr.unit === "PCT" ? formatPercentage : formatNumber
  };
  return acc;
}, {} as Record<string, MetricSpec>);

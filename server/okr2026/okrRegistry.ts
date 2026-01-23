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
// OBJECTIVES
// ============================================================================

export const objectives: ObjectiveDef[] = [
  {
    id: "O1",
    title: "Bigger",
    subtitle: "Crescimento e escala de receita"
  },
  {
    id: "O2",
    title: "Better",
    subtitle: "Eficiência operacional e qualidade"
  },
  {
    id: "O3",
    title: "Board",
    subtitle: "Métricas estratégicas de acompanhamento"
  },
  {
    id: "Ox",
    title: "Legado",
    subtitle: "KRs do sistema OKR legado consolidados"
  }
];

// ============================================================================
// KEY RESULTS
// ============================================================================

export const krs: KRDef[] = [
  // O1 - Bigger (5 KRs)
  {
    id: "O1_KR1",
    objectiveId: "O1",
    title: "Faturar 25M Legado",
    metricKey: "faturamento_legado",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 4659023, Q2: 5833695, Q3: 7094030, Q4: 8381442, FY: 25968190 }
  },
  {
    id: "O1_KR2",
    objectiveId: "O1",
    title: "Vender 3M MRR",
    metricKey: "vendas_mrr",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 645000, Q2: 720000, Q3: 810000, Q4: 900000, FY: 3075000 }
  },
  {
    id: "O1_KR3",
    objectiveId: "O1",
    title: "Vender 4.5M Pontual",
    metricKey: "vendas_pontual",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 810000, Q2: 975000, Q3: 1140000, Q4: 1305000, FY: 4230000 }
  },
  {
    id: "O1_KR4",
    objectiveId: "O1",
    title: "Faturar 1M em outras receitas VENTURES",
    metricKey: "faturamento_ventures",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 90720, Q2: 291600, Q3: 546000, Q4: 874800, FY: 1803120 }
  },
  {
    id: "O1_KR5",
    objectiveId: "O1",
    title: "Entregar 2.4M em Projetos Tech",
    metricKey: "projetos_tech",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 450000, Q2: 600000, Q3: 660000, Q4: 660000, FY: 2370000 }
  },

  // O2 - Better (5 KRs)
  {
    id: "O2_KR1",
    objectiveId: "O2",
    title: "Churn < 8%",
    metricKey: "churn_brl",
    unit: "BRL",
    direction: "lte",
    aggregation: "quarter_sum",
    targets: { Q1: 341390, Q2: 428916, Q3: 515898, Q4: 603623, FY: 1889827 },
    notes: "Meta máxima de churn em R$ (8% do MRR projetado)"
  },
  {
    id: "O2_KR2",
    objectiveId: "O2",
    title: "Inadimplência < 6%",
    metricKey: "inadimplencia_brl",
    unit: "BRL",
    direction: "lte",
    aggregation: "quarter_sum",
    targets: { Q1: 279541, Q2: 350022, Q3: 425642, Q4: 502887, FY: 1558092 },
    notes: "Meta máxima de inadimplência em R$ (6% do MRR projetado)"
  },
  {
    id: "O2_KR3",
    objectiveId: "O2",
    title: "NPS > 70",
    metricKey: "nps",
    unit: "COUNT",
    direction: "gte",
    aggregation: "quarter_avg",
    targets: { Q1: 70, Q2: 70, Q3: 70, Q4: 70 }
  },
  {
    id: "O2_KR4",
    objectiveId: "O2",
    title: "Faturamento por Pessoa > R$ 16.000",
    metricKey: "faturamento_por_pessoa",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_avg",
    targets: { Q1: 16000, Q2: 16000, Q3: 16000, Q4: 16000 },
    notes: "Calculado: Faturamento 25M Legado / Colaboradores ativos no dia 01 do mês"
  },
  {
    id: "O2_KR5",
    objectiveId: "O2",
    title: "Entregas Pontuais no Prazo > 90%",
    metricKey: "entregas_no_prazo_pct",
    unit: "PCT",
    direction: "gte",
    aggregation: "quarter_avg",
    targets: { Q1: 90, Q2: 90, Q3: 90, Q4: 90 }
  },

  // O3 - Board (11 KRs)
  {
    id: "O3_KR1",
    objectiveId: "O3",
    title: "CAC",
    metricKey: "cac",
    unit: "BRL",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR2",
    objectiveId: "O3",
    title: "Vendas Novas",
    metricKey: "vendas_novas",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR3",
    objectiveId: "O3",
    title: "Venda Base",
    metricKey: "venda_base",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR4",
    objectiveId: "O3",
    title: "E-NPS",
    metricKey: "enps",
    unit: "COUNT",
    direction: "gte",
    aggregation: "quarter_avg",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR5",
    objectiveId: "O3",
    title: "Turnover",
    metricKey: "turnover",
    unit: "PCT",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR6",
    objectiveId: "O3",
    title: "AOV - Ticket Médio",
    metricKey: "aov_ticket_medio",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_avg",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR7",
    objectiveId: "O3",
    title: "Imposto",
    metricKey: "imposto",
    unit: "BRL",
    direction: "lte",
    aggregation: "quarter_sum",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR8",
    objectiveId: "O3",
    title: "Logo Churn",
    metricKey: "logo_churn",
    unit: "PCT",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR9",
    objectiveId: "O3",
    title: "NRR",
    metricKey: "nrr",
    unit: "PCT",
    direction: "gte",
    aggregation: "quarter_avg",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR10",
    objectiveId: "O3",
    title: "% CSV",
    metricKey: "csv_pct",
    unit: "PCT",
    direction: "lte",
    aggregation: "quarter_avg",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },
  {
    id: "O3_KR11",
    objectiveId: "O3",
    title: "Inscritos e Follows",
    metricKey: "inscritos_follows",
    unit: "COUNT",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
  },

  // Ox - Legado (KRs antigas consolidadas)
  {
    id: "Ox_KR1",
    objectiveId: "Ox",
    title: "MRR Ativo",
    metricKey: "mrr_active",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_end",
    targets: { Q1: 1338870, Q2: 1611315, Q3: 1871384, Q4: 2122127 }
  },
  {
    id: "Ox_KR2",
    objectiveId: "Ox",
    title: "Receita Total Faturável",
    metricKey: "revenue_total_billable",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 4566375, Q2: 5502104, Q3: 6460412, Q4: 7374380 }
  },
  {
    id: "Ox_KR3",
    objectiveId: "Ox",
    title: "Clientes ativos",
    metricKey: "active_customers",
    unit: "COUNT",
    direction: "gte",
    aggregation: "quarter_end",
    targets: { Q1: 346, Q2: 401, Q3: 456, Q4: 511 }
  },
  {
    id: "Ox_KR4",
    objectiveId: "Ox",
    title: "Vendas Novas MRR",
    metricKey: "new_mrr_sales",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 600000, Q2: 660000, Q3: 720000, Q4: 780000 }
  },
  {
    id: "Ox_KR5",
    objectiveId: "Ox",
    title: "Expansão/Monetização Base",
    metricKey: "expansion_mrr",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 150000, Q2: 180000, Q3: 200000, Q4: 220000 }
  },
  {
    id: "Ox_KR6",
    objectiveId: "Ox",
    title: "EBITDA",
    metricKey: "ebitda",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 746055, Q2: 1152814, Q3: 1398628, Q4: 1972271 }
  },
  {
    id: "Ox_KR7",
    objectiveId: "Ox",
    title: "Geração Caixa",
    metricKey: "cash_generation",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 394897, Q2: 663357, Q3: 825594, Q4: 1204199 }
  },
  {
    id: "Ox_KR11",
    objectiveId: "Ox",
    title: "Margem Geração Caixa %",
    metricKey: "geracao_caixa_margem",
    unit: "PCT",
    direction: "gte",
    aggregation: "quarter_avg",
    targets: { Q1: 30, Q2: 30, Q3: 30, Q4: 30 }
  },
  {
    id: "Ox_KR8",
    objectiveId: "Ox",
    title: "Caixa fim quarter",
    metricKey: "cash_balance",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_end",
    targets: { Q1: 1044897, Q2: 1708254, Q3: 2533848, Q4: 3738047 }
  },
  {
    id: "Ox_KR9",
    objectiveId: "Ox",
    title: "Receita Líquida OH",
    metricKey: "turbooh_revenue_net",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 86400, Q2: 259200, Q3: 432000, Q4: 648000 }
  },
  {
    id: "Ox_KR10",
    objectiveId: "Ox",
    title: "Resultado OH",
    metricKey: "turbooh_result",
    unit: "BRL",
    direction: "gte",
    aggregation: "quarter_sum",
    targets: { Q1: 43650, Q2: 168950, Q3: 304900, Q4: 472200 }
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

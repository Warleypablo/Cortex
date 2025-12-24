export const OKR_CONFIG = {
  year: 2026,
  title: "Bigger & Better — Consolidação, Escala e Padronização",

  objectives: {
    O1_ECOSYSTEM_SCALE: {
      id: "O1",
      code: "O1_ECOSYSTEM_SCALE",
      title: "Consolidar e escalar o ecossistema com previsibilidade",
      description: "Core business - escalar receita recorrente mantendo coesão do ecossistema"
    },
    O2_EFFICIENCY_CASH: {
      id: "O2",
      code: "O2_EFFICIENCY_CASH",
      title: "Aumentar eficiência e geração de caixa",
      description: "Crescer sem quebrar - eficiência operacional e disciplina financeira"
    },
    O3_HUGZ_RETENTION: {
      id: "O3",
      code: "O3_HUGZ_RETENTION",
      title: "Higiene de receita: inadimplência e churn sob controle (Programa Hugz)",
      description: "Retenção e qualidade - reduzir inadimplência e churn do ecossistema"
    },
    O4_TURBOOH_SCALE: {
      id: "O4",
      code: "O4_TURBOOH_SCALE",
      title: "Escalar TurboOH com resultado positivo e disciplina de execução",
      description: "Novo motor de crescimento - escalar TurboOH com rentabilidade"
    },
    O5_SYSTEMS_TECH: {
      id: "O5",
      code: "O5_SYSTEMS_TECH",
      title: "Sistemas internos e Tech entregando com padrão e margem",
      description: "Padronização de processos e instrumentação de métricas"
    }
  },

  krs: {
    // O1 - Ecosystem Scale
    KR1_MRR_EOQ: {
      id: "O1-KR1",
      objectiveId: "O1_ECOSYSTEM_SCALE",
      title: "MRR Ativo (EOQ)",
      metric_key: "mrr_active",
      target_type: "quarterly",
      targets: { Q1: 1338870, Q2: 1611315, Q3: 1871384, Q4: 2122127 },
      unit: "currency",
      direction: "higher",
      owner: "Comercial"
    },
    KR2_NET_REVENUE_YTD: {
      id: "O1-KR2",
      objectiveId: "O1_ECOSYSTEM_SCALE",
      title: "Receita Líquida Anual",
      metric_key: "revenue_net",
      target_type: "annual",
      target: 20055091,
      unit: "currency",
      direction: "higher",
      owner: "Financeiro"
    },
    KR3_CLIENTS_EOY: {
      id: "O1-KR3",
      objectiveId: "O1_ECOSYSTEM_SCALE",
      title: "Clientes Ativos EOY",
      metric_key: "clients_active",
      target_type: "annual",
      target: 511,
      unit: "number",
      direction: "higher",
      owner: "Comercial"
    },
    KR4_PRODUCTIVITY_EOY: {
      id: "O1-KR4",
      objectiveId: "O1_ECOSYSTEM_SCALE",
      title: "Receita por Cabeça (Dez/26)",
      metric_key: "revenue_per_head",
      target_type: "annual",
      target: 14184,
      unit: "currency",
      direction: "higher",
      owner: "Gestão"
    },

    // O2 - Efficiency & Cash
    KR1_EBITDA_YTD: {
      id: "O2-KR1",
      objectiveId: "O2_EFFICIENCY_CASH",
      title: "EBITDA Anual",
      metric_key: "ebitda",
      target_type: "annual",
      target: 5269768,
      unit: "currency",
      direction: "higher",
      owner: "Financeiro"
    },
    KR2_CASH_GEN_YTD: {
      id: "O2-KR2",
      objectiveId: "O2_EFFICIENCY_CASH",
      title: "Geração de Caixa Anual",
      metric_key: "cash_generation",
      target_type: "annual",
      target: 3088047,
      unit: "currency",
      direction: "higher",
      owner: "Financeiro"
    },
    KR3_CASH_END: {
      id: "O2-KR3",
      objectiveId: "O2_EFFICIENCY_CASH",
      title: "Caixa Final Dezembro",
      metric_key: "cash_balance_end",
      target_type: "annual",
      target: 3738000,
      unit: "currency",
      direction: "higher",
      owner: "Financeiro"
    },
    KR4_SGA_GUARDRAIL: {
      id: "O2-KR4a",
      objectiveId: "O2_EFFICIENCY_CASH",
      title: "SG&A % Receita Líquida",
      metric_key: "sga_pct",
      target_type: "annual",
      target: 20.0,
      unit: "percentage",
      direction: "lower",
      owner: "Financeiro"
    },
    KR5_CAC_GUARDRAIL: {
      id: "O2-KR4b",
      objectiveId: "O2_EFFICIENCY_CASH",
      title: "CAC % Receita Líquida",
      metric_key: "cac_pct",
      target_type: "annual",
      target: 22.5,
      unit: "percentage",
      direction: "lower",
      owner: "Comercial"
    },
    KR6_CSV_GUARDRAIL: {
      id: "O2-KR4c",
      objectiveId: "O2_EFFICIENCY_CASH",
      title: "CSV % Receita Líquida",
      metric_key: "csv_pct",
      target_type: "annual",
      target: 33.0,
      unit: "percentage",
      direction: "lower",
      owner: "Operações"
    },

    // O3 - Hugz Retention
    KR1_INADIMPLENCIA_MAX: {
      id: "O3-KR1",
      objectiveId: "O3_HUGZ_RETENTION",
      title: "Inadimplência % (mensal)",
      metric_key: "inadimplencia_pct",
      target_type: "monthly",
      target: 6.0,
      unit: "percentage",
      direction: "lower",
      owner: "Financeiro"
    },
    KR2_GROSS_CHURN_MAX: {
      id: "O3-KR2",
      objectiveId: "O3_HUGZ_RETENTION",
      title: "Gross MRR Churn % (mensal)",
      metric_key: "gross_mrr_churn_pct",
      target_type: "monthly",
      target: 9.0,
      unit: "percentage",
      direction: "lower",
      owner: "CS"
    },
    KR3_NET_CHURN_READY: {
      id: "O3-KR3",
      objectiveId: "O3_HUGZ_RETENTION",
      title: "Net Churn disponível no Cortex",
      metric_key: "net_mrr_churn_pct",
      target_type: "milestone",
      target_quarter: "Q1",
      unit: "percentage",
      direction: "lower",
      owner: "Tech",
      status: "instrumentation"
    },
    KR4_LOGO_CHURN_READY: {
      id: "O3-KR4",
      objectiveId: "O3_HUGZ_RETENTION",
      title: "Logo Churn % disponível no Cortex",
      metric_key: "logo_churn_pct",
      target_type: "milestone",
      target_quarter: "Q1",
      unit: "percentage",
      direction: "lower",
      owner: "Tech",
      status: "instrumentation"
    },

    // O4 - TurboOH Scale
    KR1_OH_SCREENS_EOY: {
      id: "O4-KR1",
      objectiveId: "O4_TURBOOH_SCALE",
      title: "Telas TurboOH (Dez/26)",
      metric_key: "oh_screens",
      target_type: "annual",
      target: 600,
      unit: "number",
      direction: "higher",
      owner: "TurboOH"
    },
    KR2_OH_NETREV_YTD: {
      id: "O4-KR2",
      objectiveId: "O4_TURBOOH_SCALE",
      title: "Receita Líquida TurboOH Anual",
      metric_key: "oh_net_revenue",
      target_type: "annual",
      target: 2764800,
      unit: "currency",
      direction: "higher",
      owner: "TurboOH"
    },
    KR3_OH_RESULT_YTD: {
      id: "O4-KR3",
      objectiveId: "O4_TURBOOH_SCALE",
      title: "Resultado TurboOH Anual",
      metric_key: "oh_result",
      target_type: "annual",
      target: 2015000,
      unit: "currency",
      direction: "higher",
      owner: "TurboOH"
    },
    KR4_OH_VACANCY_MAX: {
      id: "O4-KR4",
      objectiveId: "O4_TURBOOH_SCALE",
      title: "Vacância Média TurboOH",
      metric_key: "oh_vacancy",
      target_type: "annual",
      target: 0.50,
      unit: "percentage",
      direction: "lower",
      owner: "TurboOH"
    },

    // O5 - Systems & Tech
    KR1_TECH_DELIVERED_YTD: {
      id: "O5-KR1",
      objectiveId: "O5_SYSTEMS_TECH",
      title: "Valor Projetos Tech Entregues",
      metric_key: "tech_projects_delivered_value",
      target_type: "annual",
      target: 2370000,
      unit: "currency",
      direction: "higher",
      owner: "Tech"
    },
    KR2_TECH_FREELA_GUARDRAIL: {
      id: "O5-KR2",
      objectiveId: "O5_SYSTEMS_TECH",
      title: "Freelancers Tech % do Entregue",
      metric_key: "tech_freelancers_pct",
      target_type: "annual",
      target: 6.5,
      unit: "percentage",
      direction: "lower",
      owner: "Tech"
    },
    KR3_CORTEX_COVERAGE: {
      id: "O5-KR3",
      objectiveId: "O5_SYSTEMS_TECH",
      title: "Cobertura de Métricas OKR",
      metric_key: "cortex_coverage",
      target_type: "milestone",
      target_quarter: "Q2",
      target: 95,
      unit: "percentage",
      direction: "higher",
      owner: "Tech"
    }
  },

  periods: ["YTD", "Q1", "Q2", "Q3", "Q4", "Last12m"],
  
  businessUnits: [
    { id: "all", label: "Todas" },
    { id: "turbooh", label: "TurboOH" },
    { id: "tech", label: "Tech" },
    { id: "commerce", label: "Commerce" }
  ]
};

export type ObjectiveId = keyof typeof OKR_CONFIG.objectives;
export type KRId = keyof typeof OKR_CONFIG.krs;
export type Period = typeof OKR_CONFIG.periods[number];
export type BusinessUnitId = typeof OKR_CONFIG.businessUnits[number]["id"];

export function getObjectiveById(id: string) {
  return Object.values(OKR_CONFIG.objectives).find(o => o.id === id || o.code === id);
}

export function getKRsByObjective(objectiveCode: string) {
  return Object.values(OKR_CONFIG.krs).filter(kr => kr.objectiveId === objectiveCode);
}

export function getAllKRs() {
  return Object.values(OKR_CONFIG.krs);
}

export function getAllObjectives() {
  return Object.values(OKR_CONFIG.objectives);
}

export const OKR_CONFIG = {
  year: 2026,
  title: "Bigger & Better — Consolidação, Escala e Padronização",

  objectives: {
    OX_LEGADO: {
      id: "Ox",
      code: "OX_LEGADO",
      title: "Legado",
      description: "KRs do sistema OKR legado consolidados"
    }
  },

  krs: {
    // O1 - Ecossistema (Consolidação + Escala)
    KR1_MRR_EOQ: {
      id: "O1_KR1",
      objectiveId: "OX_LEGADO",
      title: "MRR Ativo",
      metric_key: "mrr_active",
      target_type: "quarterly",
      targets: { Q1: 1338870, Q2: 1611315, Q3: 1871384, Q4: 2122127 },
      unit: "currency",
      direction: "higher",
      owner: "Comercial"
    },
    KR2_RECEITA_TOTAL: {
      id: "O1_KR2",
      objectiveId: "OX_LEGADO",
      title: "Receita Total Faturável",
      metric_key: "revenue_total",
      target_type: "quarterly",
      targets: { Q1: 4573000, Q2: 5502000, Q3: 6461000, Q4: 7370000 },
      unit: "currency",
      direction: "higher",
      owner: "Financeiro"
    },
    KR3_CLIENTES_ATIVOS: {
      id: "O1_KR3",
      objectiveId: "OX_LEGADO",
      title: "Clientes ativos",
      metric_key: "clients_active",
      target_type: "quarterly",
      targets: { Q1: 346, Q2: 401, Q3: 456, Q4: 511 },
      unit: "number",
      direction: "higher",
      owner: "Comercial"
    },
    KR4_VENDAS_NOVAS_MRR: {
      id: "O1_KR4",
      objectiveId: "OX_LEGADO",
      title: "Vendas Novas MRR",
      metric_key: "new_mrr",
      target_type: "quarterly",
      targets: { Q1: 600000, Q2: 660000, Q3: 720000, Q4: 780000 },
      unit: "currency",
      direction: "higher",
      owner: "Comercial"
    },
    KR5_EXPANSAO_MONETIZACAO: {
      id: "O1_KR5",
      objectiveId: "OX_LEGADO",
      title: "Expansão/Monetização (média 20%)",
      metric_key: "expansion_mrr",
      target_type: "quarterly",
      targets: { Q1: 150000, Q2: 180000, Q3: 200000, Q4: 220000 },
      unit: "currency",
      direction: "higher",
      owner: "CS"
    },

    // O2 - Eficiência & Sistemas
    KR1_EBITDA: {
      id: "O2_KR1",
      objectiveId: "OX_LEGADO",
      title: "EBITDA",
      metric_key: "ebitda",
      target_type: "quarterly",
      targets: { Q1: 746100, Q2: 1150000, Q3: 1400000, Q4: 1970000 },
      unit: "currency",
      direction: "higher",
      owner: "Financeiro"
    },
    KR2_GERACAO_CAIXA: {
      id: "O2_KR2",
      objectiveId: "OX_LEGADO",
      title: "Geração Caixa",
      metric_key: "cash_generation",
      target_type: "quarterly",
      targets: { Q1: 394900, Q2: 663400, Q3: 825600, Q4: 1200000 },
      unit: "currency",
      direction: "higher",
      owner: "Financeiro"
    },
    KR3_CAIXA_FINAL: {
      id: "O2_KR3",
      objectiveId: "OX_LEGADO",
      title: "Caixa Final",
      metric_key: "cash_balance_end",
      target_type: "quarterly",
      targets: { Q1: 1044900, Q2: 1708300, Q3: 2533900, Q4: 3733900 },
      unit: "currency",
      direction: "higher",
      owner: "Financeiro"
    },
    KR4_INADIMPLENCIA: {
      id: "O2_KR4",
      objectiveId: "OX_LEGADO",
      title: "Inadimplência % (até 6%)",
      metric_key: "inadimplencia_pct",
      target_type: "monthly",
      target: 6.0,
      unit: "percentage",
      direction: "lower",
      owner: "Financeiro"
    },
    KR5_GROSS_CHURN: {
      id: "O2_KR5",
      objectiveId: "OX_LEGADO",
      title: "Gross MRR Churn % (até 9%)",
      metric_key: "gross_mrr_churn_pct",
      target_type: "monthly",
      target: 9.0,
      unit: "percentage",
      direction: "lower",
      owner: "CS"
    },

    // O3 - TurboOH
    KR1_OH_RECEITA_LIQUIDA: {
      id: "O3_KR1",
      objectiveId: "OX_LEGADO",
      title: "Receita Líquida TurboOH",
      metric_key: "oh_net_revenue",
      target_type: "quarterly",
      targets: { Q1: 500000, Q2: 700000, Q3: 900000, Q4: 1100000 },
      unit: "currency",
      direction: "higher",
      owner: "TurboOH"
    },
    KR2_OH_RESULTADO: {
      id: "O3_KR2",
      objectiveId: "OX_LEGADO",
      title: "Resultado TurboOH",
      metric_key: "oh_result",
      target_type: "quarterly",
      targets: { Q1: 300000, Q2: 450000, Q3: 600000, Q4: 750000 },
      unit: "currency",
      direction: "higher",
      owner: "TurboOH"
    },
    KR3_OH_MARGEM: {
      id: "O3_KR3",
      objectiveId: "OX_LEGADO",
      title: "Margem TurboOH %",
      metric_key: "oh_margin_pct",
      target_type: "quarterly",
      targets: { Q1: 60, Q2: 64, Q3: 67, Q4: 68 },
      unit: "percentage",
      direction: "higher",
      owner: "TurboOH"
    },
    KR4_OH_VACANCIA: {
      id: "O3_KR4",
      objectiveId: "OX_LEGADO",
      title: "Vacância TurboOH % (até 0.5%)",
      metric_key: "oh_vacancy",
      target_type: "monthly",
      target: 0.5,
      unit: "percentage",
      direction: "lower",
      owner: "TurboOH"
    },

    // O4 - Tech
    KR1_TECH_ENTREGUES: {
      id: "O4_KR1",
      objectiveId: "OX_LEGADO",
      title: "Projetos Tech Entregues",
      metric_key: "tech_projects_delivered_value",
      target_type: "quarterly",
      targets: { Q1: 500000, Q2: 600000, Q3: 650000, Q4: 620000 },
      unit: "currency",
      direction: "higher",
      owner: "Tech"
    },
    KR2_TECH_FREELANCERS: {
      id: "O4_KR2",
      objectiveId: "OX_LEGADO",
      title: "Freelancers Tech % (até 6.5%)",
      metric_key: "tech_freelancers_pct",
      target_type: "monthly",
      target: 6.5,
      unit: "percentage",
      direction: "lower",
      owner: "Tech"
    }
  },

  periods: ["YTD", "Q1", "Q2", "Q3", "Q4", "Last12m"],
  
  businessUnits: [
    { id: "all", label: "Todas" }
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

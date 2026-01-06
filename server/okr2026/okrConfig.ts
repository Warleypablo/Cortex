export const OKR_CONFIG = {
  year: 2026,
  title: "Bigger & Better — Consolidação, Escala e Padronização",

  objectives: {
    O1_BIGGER: {
      id: "O1",
      code: "O1_BIGGER",
      title: "Bigger",
      description: "Crescimento e escala de receita"
    },
    O2_BETTER: {
      id: "O2",
      code: "O2_BETTER",
      title: "Better",
      description: "Eficiência operacional e qualidade"
    },
    O3_BOARD: {
      id: "O3",
      code: "O3_BOARD",
      title: "Board",
      description: "Métricas estratégicas de acompanhamento"
    },
    OX_LEGADO: {
      id: "Ox",
      code: "OX_LEGADO",
      title: "Legado",
      description: "KRs do sistema OKR legado consolidados"
    }
  },

  krs: {
    // O1 - Bigger
    KR1_FATURAR_25M: {
      id: "O1_KR1",
      objectiveId: "O1_BIGGER",
      title: "Faturar 25M Legado",
      metric_key: "faturamento_legado",
      target_type: "annual",
      targets: { Q1: 6250000, Q2: 6250000, Q3: 6250000, Q4: 6250000 },
      unit: "currency",
      direction: "higher",
      owner: "Financeiro"
    },
    KR2_VENDER_3M_MRR: {
      id: "O1_KR2",
      objectiveId: "O1_BIGGER",
      title: "Vender 3M MRR",
      metric_key: "vendas_mrr",
      target_type: "annual",
      targets: { Q1: 750000, Q2: 750000, Q3: 750000, Q4: 750000 },
      unit: "currency",
      direction: "higher",
      owner: "Comercial"
    },
    KR3_VENDER_4_5M_PONTUAL: {
      id: "O1_KR3",
      objectiveId: "O1_BIGGER",
      title: "Vender 4.5M Pontual",
      metric_key: "vendas_pontual",
      target_type: "annual",
      targets: { Q1: 1125000, Q2: 1125000, Q3: 1125000, Q4: 1125000 },
      unit: "currency",
      direction: "higher",
      owner: "Comercial"
    },
    KR4_FATURAR_1M_VENTURES: {
      id: "O1_KR4",
      objectiveId: "O1_BIGGER",
      title: "Faturar 1M em outras receitas VENTURES",
      metric_key: "faturamento_ventures",
      target_type: "annual",
      targets: { Q1: 250000, Q2: 250000, Q3: 250000, Q4: 250000 },
      unit: "currency",
      direction: "higher",
      owner: "Ventures"
    },
    KR5_ENTREGAR_2_4M_TECH: {
      id: "O1_KR5",
      objectiveId: "O1_BIGGER",
      title: "Entregar 2.4M em Projetos Tech",
      metric_key: "projetos_tech",
      target_type: "annual",
      targets: { Q1: 600000, Q2: 600000, Q3: 600000, Q4: 600000 },
      unit: "currency",
      direction: "higher",
      owner: "Tech"
    },

    // O2 - Better
    KR1_CHURN: {
      id: "O2_KR1",
      objectiveId: "O2_BETTER",
      title: "Churn < 8%",
      metric_key: "churn_pct",
      target_type: "monthly",
      target: 8.0,
      unit: "percentage",
      direction: "lower",
      owner: "CS"
    },
    KR2_INADIMPLENCIA: {
      id: "O2_KR2",
      objectiveId: "O2_BETTER",
      title: "Inadimplência < 6%",
      metric_key: "inadimplencia_pct",
      target_type: "monthly",
      target: 6.0,
      unit: "percentage",
      direction: "lower",
      owner: "Financeiro"
    },
    KR3_NPS: {
      id: "O2_KR3",
      objectiveId: "O2_BETTER",
      title: "NPS > 70",
      metric_key: "nps",
      target_type: "quarterly",
      targets: { Q1: 70, Q2: 70, Q3: 70, Q4: 70 },
      unit: "number",
      direction: "higher",
      owner: "CS"
    },
    KR4_FATURAMENTO_POR_PESSOA: {
      id: "O2_KR4",
      objectiveId: "O2_BETTER",
      title: "Faturamento por Pessoa > R$ 16.000",
      metric_key: "faturamento_por_pessoa",
      target_type: "monthly",
      target: 16000,
      unit: "currency",
      direction: "higher",
      owner: "Gestão"
    },
    KR5_ENTREGAS_NO_PRAZO: {
      id: "O2_KR5",
      objectiveId: "O2_BETTER",
      title: "Entregas Pontuais no Prazo > 90%",
      metric_key: "entregas_no_prazo_pct",
      target_type: "monthly",
      target: 90,
      unit: "percentage",
      direction: "higher",
      owner: "Operações"
    },

    // O3 - Board
    KR_CAC: {
      id: "O3_KR1",
      objectiveId: "O3_BOARD",
      title: "CAC",
      metric_key: "cac",
      target_type: "monthly",
      target: 0,
      unit: "currency",
      direction: "lower",
      owner: "Comercial"
    },
    KR_VENDAS_NOVAS: {
      id: "O3_KR2",
      objectiveId: "O3_BOARD",
      title: "Vendas Novas",
      metric_key: "vendas_novas",
      target_type: "monthly",
      target: 0,
      unit: "currency",
      direction: "higher",
      owner: "Comercial"
    },
    KR_VENDA_BASE: {
      id: "O3_KR3",
      objectiveId: "O3_BOARD",
      title: "Venda Base",
      metric_key: "venda_base",
      target_type: "monthly",
      target: 0,
      unit: "currency",
      direction: "higher",
      owner: "CS"
    },
    KR_ENPS: {
      id: "O3_KR4",
      objectiveId: "O3_BOARD",
      title: "E-NPS",
      metric_key: "enps",
      target_type: "quarterly",
      targets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
      unit: "number",
      direction: "higher",
      owner: "RH"
    },
    KR_TURNOVER: {
      id: "O3_KR5",
      objectiveId: "O3_BOARD",
      title: "Turnover",
      metric_key: "turnover",
      target_type: "monthly",
      target: 0,
      unit: "percentage",
      direction: "lower",
      owner: "RH"
    },
    KR_AOV: {
      id: "O3_KR6",
      objectiveId: "O3_BOARD",
      title: "AOV - Ticket Médio",
      metric_key: "aov_ticket_medio",
      target_type: "monthly",
      target: 0,
      unit: "currency",
      direction: "higher",
      owner: "Comercial"
    },
    KR_IMPOSTO: {
      id: "O3_KR7",
      objectiveId: "O3_BOARD",
      title: "Imposto",
      metric_key: "imposto",
      target_type: "monthly",
      target: 0,
      unit: "currency",
      direction: "lower",
      owner: "Financeiro"
    },
    KR_LOGO_CHURN: {
      id: "O3_KR8",
      objectiveId: "O3_BOARD",
      title: "Logo Churn",
      metric_key: "logo_churn",
      target_type: "monthly",
      target: 0,
      unit: "percentage",
      direction: "lower",
      owner: "CS"
    },
    KR_NRR: {
      id: "O3_KR9",
      objectiveId: "O3_BOARD",
      title: "NRR",
      metric_key: "nrr",
      target_type: "monthly",
      target: 0,
      unit: "percentage",
      direction: "higher",
      owner: "CS"
    },
    KR_CSV_PCT: {
      id: "O3_KR10",
      objectiveId: "O3_BOARD",
      title: "% CSV",
      metric_key: "csv_pct",
      target_type: "monthly",
      target: 0,
      unit: "percentage",
      direction: "lower",
      owner: "Operações"
    },
    KR_INSCRITOS_FOLLOWS: {
      id: "O3_KR11",
      objectiveId: "O3_BOARD",
      title: "Inscritos e Follows",
      metric_key: "inscritos_follows",
      target_type: "monthly",
      target: 0,
      unit: "number",
      direction: "higher",
      owner: "Marketing"
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

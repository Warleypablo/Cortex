export interface MetricSpec {
  id: string;
  title: string;
  unit: "currency" | "number" | "percentage";
  direction: "higher" | "lower";
  required: boolean;
  category: "company" | "turbooh" | "hugz" | "sales" | "tech" | "people";
  description?: string;
}

export const METRICS_REGISTRY: Record<string, MetricSpec> = {
  // Company KPIs
  mrr_active: {
    id: "mrr_active",
    title: "MRR Ativo",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "company",
    description: "Monthly Recurring Revenue de contratos ativos"
  },
  revenue_total_billable: {
    id: "revenue_total_billable",
    title: "Receita Total Faturada",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "company"
  },
  revenue_net: {
    id: "revenue_net",
    title: "Receita Líquida",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "company",
    description: "Receita após impostos"
  },
  ebitda: {
    id: "ebitda",
    title: "EBITDA",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "company"
  },
  cash_generation: {
    id: "cash_generation",
    title: "Geração de Caixa",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "company"
  },
  cash_balance_end: {
    id: "cash_balance_end",
    title: "Saldo de Caixa",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "company"
  },
  csv_cost: {
    id: "csv_cost",
    title: "Custo de Serviços Vendidos",
    unit: "currency",
    direction: "lower",
    required: true,
    category: "company"
  },
  sga_cost: {
    id: "sga_cost",
    title: "SG&A (Despesas Administrativas)",
    unit: "currency",
    direction: "lower",
    required: true,
    category: "company"
  },
  cac_cost: {
    id: "cac_cost",
    title: "CAC (Custo de Aquisição)",
    unit: "currency",
    direction: "lower",
    required: true,
    category: "company"
  },
  sga_pct: {
    id: "sga_pct",
    title: "SG&A %",
    unit: "percentage",
    direction: "lower",
    required: true,
    category: "company",
    description: "SG&A / Receita Líquida"
  },
  cac_pct: {
    id: "cac_pct",
    title: "CAC %",
    unit: "percentage",
    direction: "lower",
    required: true,
    category: "company",
    description: "CAC / Receita Líquida"
  },
  csv_pct: {
    id: "csv_pct",
    title: "CSV %",
    unit: "percentage",
    direction: "lower",
    required: true,
    category: "company",
    description: "CSV / Receita Líquida"
  },
  clients_active: {
    id: "clients_active",
    title: "Clientes Ativos",
    unit: "number",
    direction: "higher",
    required: true,
    category: "company"
  },
  contracts_active: {
    id: "contracts_active",
    title: "Contratos Ativos",
    unit: "number",
    direction: "higher",
    required: true,
    category: "company"
  },

  // Hugz (Retention) KPIs
  inadimplencia_pct: {
    id: "inadimplencia_pct",
    title: "Inadimplência %",
    unit: "percentage",
    direction: "lower",
    required: true,
    category: "hugz"
  },
  gross_mrr_churn_pct: {
    id: "gross_mrr_churn_pct",
    title: "Gross MRR Churn %",
    unit: "percentage",
    direction: "lower",
    required: true,
    category: "hugz"
  },
  net_mrr_churn: {
    id: "net_mrr_churn",
    title: "Net MRR Churn",
    unit: "currency",
    direction: "lower",
    required: false,
    category: "hugz",
    description: "Gross Churn - Expansion"
  },
  net_mrr_churn_pct: {
    id: "net_mrr_churn_pct",
    title: "Net MRR Churn %",
    unit: "percentage",
    direction: "lower",
    required: false,
    category: "hugz"
  },
  logo_churn_pct: {
    id: "logo_churn_pct",
    title: "Logo Churn %",
    unit: "percentage",
    direction: "lower",
    required: false,
    category: "hugz",
    description: "Clientes cancelados / Clientes início"
  },

  // Sales KPIs
  sales_new_mrr: {
    id: "sales_new_mrr",
    title: "Vendas Novas MRR",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "sales"
  },
  sales_expansion_mrr: {
    id: "sales_expansion_mrr",
    title: "Expansão MRR",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "sales",
    description: "Upsell e cross-sell na base"
  },
  sales_oneoff: {
    id: "sales_oneoff",
    title: "Vendas Pontuais",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "sales",
    description: "Projetos e serviços pontuais"
  },

  // TurboOH KPIs
  oh_screens: {
    id: "oh_screens",
    title: "Telas TurboOH",
    unit: "number",
    direction: "higher",
    required: true,
    category: "turbooh"
  },
  oh_vacancy: {
    id: "oh_vacancy",
    title: "Vacância TurboOH",
    unit: "percentage",
    direction: "lower",
    required: true,
    category: "turbooh"
  },
  oh_gross_revenue: {
    id: "oh_gross_revenue",
    title: "Receita Bruta TurboOH",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "turbooh"
  },
  oh_net_revenue: {
    id: "oh_net_revenue",
    title: "Receita Líquida TurboOH",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "turbooh"
  },
  oh_result: {
    id: "oh_result",
    title: "Resultado TurboOH",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "turbooh"
  },

  // People KPIs
  headcount_total: {
    id: "headcount_total",
    title: "Headcount Total",
    unit: "number",
    direction: "higher",
    required: true,
    category: "people"
  },
  revenue_per_head: {
    id: "revenue_per_head",
    title: "Receita por Cabeça",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "people"
  },

  // Tech KPIs
  tech_projects_delivered_value: {
    id: "tech_projects_delivered_value",
    title: "Valor Projetos Tech Entregues",
    unit: "currency",
    direction: "higher",
    required: true,
    category: "tech"
  },
  tech_freelancers_cost: {
    id: "tech_freelancers_cost",
    title: "Custo Freelancers Tech",
    unit: "currency",
    direction: "lower",
    required: true,
    category: "tech"
  },
  tech_freelancers_pct: {
    id: "tech_freelancers_pct",
    title: "Freelancers Tech %",
    unit: "percentage",
    direction: "lower",
    required: true,
    category: "tech",
    description: "Custo freelancers / Valor entregue"
  },
  cortex_coverage: {
    id: "cortex_coverage",
    title: "Cobertura Métricas OKR",
    unit: "percentage",
    direction: "higher",
    required: true,
    category: "tech",
    description: "% de métricas com dados válidos"
  }
};

export function getRequiredMetrics(): MetricSpec[] {
  return Object.values(METRICS_REGISTRY).filter(m => m.required);
}

export function getMetricsByCategory(category: MetricSpec["category"]): MetricSpec[] {
  return Object.values(METRICS_REGISTRY).filter(m => m.category === category);
}

export function getMetricSpec(id: string): MetricSpec | undefined {
  return METRICS_REGISTRY[id];
}

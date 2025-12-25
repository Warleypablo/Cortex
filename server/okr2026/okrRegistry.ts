export type MetricUnit = "currency" | "number" | "percentage";
export type MetricDirection = "higher" | "lower";
export type MetricCadence = "monthly" | "quarterly" | "annual" | "snapshot";
export type TargetType = "monthly" | "quarterly" | "annual" | "milestone";
export type Operator = ">=" | "<=" | "=";
export type OwnerRole = "CEO" | "CFO" | "COO" | "CTO" | "Comercial" | "CS" | "TurboOH" | "Tech" | "Financeiro" | "Operações" | "Gestão";
export type MetricCategory = "company" | "sales" | "hugz" | "turbooh" | "tech" | "people";

export interface Objective {
  id: string;
  title: string;
  ownerRole: OwnerRole;
  narrative: string;
  order: number;
}

export interface KR {
  id: string;
  objectiveId: string;
  title: string;
  metricKey: string;
  operator: Operator;
  cadence: MetricCadence;
  targetType: TargetType;
  targets: {
    annual?: number;
    Q1?: number;
    Q2?: number;
    Q3?: number;
    Q4?: number;
    monthly?: number;
  };
  description?: string;
  owner: OwnerRole;
  status?: "active" | "instrumentation" | "planned";
  unit: MetricUnit;
  direction: MetricDirection;
}

export interface MetricSpec {
  id: string;
  title: string;
  unit: MetricUnit;
  direction: MetricDirection;
  cadence: MetricCadence;
  category: MetricCategory;
  required: boolean;
  description?: string;
  notes?: string;
  format: (value: number) => string;
  source?: string;
}

export const objectiveRegistry: Objective[] = [
  {
    id: "O1",
    title: "Consolidar e escalar o ecossistema com previsibilidade",
    ownerRole: "CEO",
    narrative: "Core business - escalar receita recorrente mantendo coesão do ecossistema. Foco em MRR, receita líquida, base de clientes e produtividade por cabeça.",
    order: 1
  },
  {
    id: "O2",
    title: "Aumentar eficiência e geração de caixa",
    ownerRole: "CFO",
    narrative: "Crescer sem quebrar - eficiência operacional e disciplina financeira. Metas de EBITDA, geração de caixa e guardrails de custos (SG&A, CAC, CSV).",
    order: 2
  },
  {
    id: "O3",
    title: "Higiene de receita: inadimplência e churn sob controle (Programa Hugz)",
    ownerRole: "COO",
    narrative: "Retenção e qualidade - reduzir inadimplência e churn do ecossistema. Programa Hugz para abraçar a base e manter saúde da receita.",
    order: 3
  },
  {
    id: "O4",
    title: "Escalar TurboOH com resultado positivo e disciplina de execução",
    ownerRole: "TurboOH",
    narrative: "Novo motor de crescimento - escalar TurboOH com rentabilidade. Foco em telas, receita, resultado e controle de vacância.",
    order: 4
  },
  {
    id: "O5",
    title: "Sistemas internos e Tech entregando com padrão e margem",
    ownerRole: "CTO",
    narrative: "Padronização de processos e instrumentação de métricas. Tech entregando valor com baixo uso de freelancers e cobertura total do Cortex.",
    order: 5
  }
];

export const krRegistry: KR[] = [
  {
    id: "O1-KR1",
    objectiveId: "O1",
    title: "MRR Ativo (EOQ)",
    metricKey: "mrr_active",
    operator: ">=",
    cadence: "quarterly",
    targetType: "quarterly",
    targets: {
      Q1: 1338870,
      Q2: 1611315,
      Q3: 1871384,
      Q4: 2122127
    },
    description: "Monthly Recurring Revenue ao final de cada trimestre",
    owner: "Comercial",
    status: "active",
    unit: "currency",
    direction: "higher"
  },
  {
    id: "O1-KR2",
    objectiveId: "O1",
    title: "Receita Líquida Anual",
    metricKey: "revenue_net",
    operator: ">=",
    cadence: "annual",
    targetType: "annual",
    targets: { annual: 20055091 },
    description: "Receita Líquida acumulada no ano (R$ 20M)",
    owner: "Financeiro",
    status: "active",
    unit: "currency",
    direction: "higher"
  },
  {
    id: "O1-KR3",
    objectiveId: "O1",
    title: "Clientes Ativos EOY",
    metricKey: "clients_active",
    operator: ">=",
    cadence: "snapshot",
    targetType: "annual",
    targets: { annual: 511 },
    description: "Quantidade de clientes ativos ao final do ano",
    owner: "Comercial",
    status: "active",
    unit: "number",
    direction: "higher"
  },
  {
    id: "O1-KR4",
    objectiveId: "O1",
    title: "Receita por Cabeça (Dez/26)",
    metricKey: "revenue_per_head",
    operator: ">=",
    cadence: "snapshot",
    targetType: "annual",
    targets: { annual: 14184 },
    description: "Receita líquida mensal dividida pelo headcount em Dezembro",
    owner: "Gestão",
    status: "active",
    unit: "currency",
    direction: "higher"
  },
  {
    id: "O2-KR1",
    objectiveId: "O2",
    title: "EBITDA Anual",
    metricKey: "ebitda",
    operator: ">=",
    cadence: "annual",
    targetType: "annual",
    targets: { annual: 5269768 },
    description: "EBITDA acumulado no ano (R$ 5.27M)",
    owner: "Financeiro",
    status: "active",
    unit: "currency",
    direction: "higher"
  },
  {
    id: "O2-KR2",
    objectiveId: "O2",
    title: "Geração de Caixa Anual",
    metricKey: "cash_generation",
    operator: ">=",
    cadence: "annual",
    targetType: "annual",
    targets: { annual: 3088047 },
    description: "Geração de caixa acumulada no ano (R$ 3.09M)",
    owner: "Financeiro",
    status: "active",
    unit: "currency",
    direction: "higher"
  },
  {
    id: "O2-KR3",
    objectiveId: "O2",
    title: "Caixa Final Dezembro",
    metricKey: "cash_balance",
    operator: ">=",
    cadence: "snapshot",
    targetType: "annual",
    targets: { annual: 3738000 },
    description: "Saldo de caixa ao final de Dezembro (R$ 3.74M)",
    owner: "Financeiro",
    status: "active",
    unit: "currency",
    direction: "higher"
  },
  {
    id: "O2-KR4a",
    objectiveId: "O2",
    title: "SG&A % Receita Líquida",
    metricKey: "sga_pct",
    operator: "<=",
    cadence: "monthly",
    targetType: "annual",
    targets: { annual: 21.0 },
    description: "SG&A como percentual da Receita Líquida (guardrail <=21%)",
    owner: "Financeiro",
    status: "active",
    unit: "percentage",
    direction: "lower"
  },
  {
    id: "O2-KR4b",
    objectiveId: "O2",
    title: "CAC % Receita Líquida",
    metricKey: "cac_pct",
    operator: "<=",
    cadence: "monthly",
    targetType: "annual",
    targets: { annual: 23.0 },
    description: "CAC como percentual da Receita Líquida (guardrail <=23%)",
    owner: "Comercial",
    status: "active",
    unit: "percentage",
    direction: "lower"
  },
  {
    id: "O2-KR4c",
    objectiveId: "O2",
    title: "CSV % Receita Líquida",
    metricKey: "csv_pct",
    operator: "<=",
    cadence: "monthly",
    targetType: "annual",
    targets: { annual: 33.0 },
    description: "CSV como percentual da Receita Líquida (guardrail <=33%)",
    owner: "Operações",
    status: "active",
    unit: "percentage",
    direction: "lower"
  },
  {
    id: "O3-KR1",
    objectiveId: "O3",
    title: "Inadimplência % (mensal)",
    metricKey: "inadimplencia_pct",
    operator: "<=",
    cadence: "monthly",
    targetType: "monthly",
    targets: { monthly: 6.0 },
    description: "Percentual de inadimplência mensal (guardrail <=6%)",
    owner: "Financeiro",
    status: "active",
    unit: "percentage",
    direction: "lower"
  },
  {
    id: "O3-KR2",
    objectiveId: "O3",
    title: "Net Churn % (mensal)",
    metricKey: "net_churn_pct",
    operator: "<=",
    cadence: "monthly",
    targetType: "monthly",
    targets: { monthly: 9.0 },
    description: "Net MRR Churn mensal (guardrail <=9%)",
    owner: "CS",
    status: "active",
    unit: "percentage",
    direction: "lower"
  },
  {
    id: "O3-KR3",
    objectiveId: "O3",
    title: "Logo Churn % (mensal)",
    metricKey: "logo_churn_pct",
    operator: "<=",
    cadence: "monthly",
    targetType: "monthly",
    targets: { monthly: 10.0 },
    description: "Percentual de clientes cancelados no mês (guardrail <=10%)",
    owner: "CS",
    status: "instrumentation",
    unit: "percentage",
    direction: "lower"
  },
  {
    id: "O3-KR4",
    objectiveId: "O3",
    title: "Gross MRR Churn %",
    metricKey: "gross_churn_pct",
    operator: "<=",
    cadence: "monthly",
    targetType: "monthly",
    targets: { monthly: 9.0 },
    description: "Gross MRR Churn mensal antes de expansão",
    owner: "CS",
    status: "active",
    unit: "percentage",
    direction: "lower"
  },
  {
    id: "O4-KR1",
    objectiveId: "O4",
    title: "Receita TurboOH Anual",
    metricKey: "turbooh_receita",
    operator: ">=",
    cadence: "annual",
    targetType: "annual",
    targets: { annual: 1430000 },
    description: "Receita líquida TurboOH acumulada no ano (R$ 1.43M)",
    owner: "TurboOH",
    status: "active",
    unit: "currency",
    direction: "higher"
  },
  {
    id: "O4-KR2",
    objectiveId: "O4",
    title: "Resultado TurboOH Anual",
    metricKey: "turbooh_resultado",
    operator: ">=",
    cadence: "annual",
    targetType: "annual",
    targets: { annual: 990000 },
    description: "Resultado operacional TurboOH acumulado no ano (R$ 990K)",
    owner: "TurboOH",
    status: "active",
    unit: "currency",
    direction: "higher"
  },
  {
    id: "O4-KR3",
    objectiveId: "O4",
    title: "Margem TurboOH %",
    metricKey: "turbooh_margem_pct",
    operator: ">=",
    cadence: "monthly",
    targetType: "annual",
    targets: { annual: 25.0 },
    description: "Margem de resultado TurboOH (guardrail >=25%)",
    owner: "TurboOH",
    status: "active",
    unit: "percentage",
    direction: "higher"
  },
  {
    id: "O4-KR4",
    objectiveId: "O4",
    title: "Telas TurboOH (Dez/26)",
    metricKey: "oh_screens",
    operator: ">=",
    cadence: "snapshot",
    targetType: "annual",
    targets: { annual: 600 },
    description: "Quantidade de telas ativas ao final do ano",
    owner: "TurboOH",
    status: "active",
    unit: "number",
    direction: "higher"
  },
  {
    id: "O5-KR1",
    objectiveId: "O5",
    title: "Freelancers Tech %",
    metricKey: "tech_freelancers_pct",
    operator: "<=",
    cadence: "monthly",
    targetType: "annual",
    targets: { annual: 8.0 },
    description: "Custo de freelancers como % do valor entregue (guardrail <=8%)",
    owner: "Tech",
    status: "active",
    unit: "percentage",
    direction: "lower"
  },
  {
    id: "O5-KR2",
    objectiveId: "O5",
    title: "MRR por Headcount",
    metricKey: "mrr_por_head",
    operator: ">=",
    cadence: "snapshot",
    targetType: "annual",
    targets: { annual: 11790 },
    description: "MRR dividido pelo headcount total (>=R$ 11.790)",
    owner: "Gestão",
    status: "active",
    unit: "currency",
    direction: "higher"
  },
  {
    id: "O5-KR3",
    objectiveId: "O5",
    title: "Telas Entregues",
    metricKey: "tech_projetos_entregues",
    operator: ">=",
    cadence: "annual",
    targetType: "annual",
    targets: { annual: 600 },
    description: "Quantidade de screens/projetos entregues no ano",
    owner: "Tech",
    status: "active",
    unit: "number",
    direction: "higher"
  },
  {
    id: "O5-KR4",
    objectiveId: "O5",
    title: "Cobertura Métricas OKR",
    metricKey: "cortex_coverage",
    operator: ">=",
    cadence: "snapshot",
    targetType: "milestone",
    targets: { Q2: 95 },
    description: "Percentual de métricas OKR com dados no Cortex até Q2",
    owner: "Tech",
    status: "instrumentation",
    unit: "percentage",
    direction: "higher"
  }
];

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return `R$ ${value.toFixed(2)}`;
};

const formatPercentage = (value: number): string => `${value.toFixed(1)}%`;
const formatNumber = (value: number): string => value.toLocaleString("pt-BR");

export const metricRegistry: Record<string, MetricSpec> = {
  mrr_active: {
    id: "mrr_active",
    title: "MRR Ativo",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "company",
    required: true,
    description: "Monthly Recurring Revenue de contratos ativos",
    notes: "Soma de todos os contratos recorrentes ativos no mês",
    format: formatCurrency,
    source: "contracts"
  },
  revenue_total: {
    id: "revenue_total",
    title: "Receita Total Faturada",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "company",
    required: true,
    description: "Receita bruta total faturada",
    format: formatCurrency,
    source: "financial"
  },
  revenue_net: {
    id: "revenue_net",
    title: "Receita Líquida",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "company",
    required: true,
    description: "Receita após impostos e deduções",
    notes: "Base para cálculo de percentuais (SG&A, CAC, CSV)",
    format: formatCurrency,
    source: "financial"
  },
  ebitda: {
    id: "ebitda",
    title: "EBITDA",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "company",
    required: true,
    description: "Lucro antes de juros, impostos, depreciação e amortização",
    format: formatCurrency,
    source: "financial"
  },
  cash_generation: {
    id: "cash_generation",
    title: "Geração de Caixa",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "company",
    required: true,
    description: "Fluxo de caixa operacional líquido",
    format: formatCurrency,
    source: "financial"
  },
  cash_balance: {
    id: "cash_balance",
    title: "Saldo de Caixa",
    unit: "currency",
    direction: "higher",
    cadence: "snapshot",
    category: "company",
    required: true,
    description: "Saldo disponível em caixa",
    format: formatCurrency,
    source: "financial"
  },
  sga_pct: {
    id: "sga_pct",
    title: "SG&A %",
    unit: "percentage",
    direction: "lower",
    cadence: "monthly",
    category: "company",
    required: true,
    description: "Despesas SG&A como % da Receita Líquida",
    notes: "Guardrail: <=21%",
    format: formatPercentage,
    source: "financial"
  },
  cac_pct: {
    id: "cac_pct",
    title: "CAC %",
    unit: "percentage",
    direction: "lower",
    cadence: "monthly",
    category: "company",
    required: true,
    description: "Custo de Aquisição como % da Receita Líquida",
    notes: "Guardrail: <=23%",
    format: formatPercentage,
    source: "financial"
  },
  csv_pct: {
    id: "csv_pct",
    title: "CSV %",
    unit: "percentage",
    direction: "lower",
    cadence: "monthly",
    category: "company",
    required: true,
    description: "Custo de Serviços Vendidos como % da Receita Líquida",
    notes: "Guardrail: <=33%",
    format: formatPercentage,
    source: "financial"
  },
  clients_active: {
    id: "clients_active",
    title: "Clientes Ativos",
    unit: "number",
    direction: "higher",
    cadence: "snapshot",
    category: "company",
    required: true,
    description: "Quantidade de clientes com contrato ativo",
    format: formatNumber,
    source: "contracts"
  },
  new_mrr: {
    id: "new_mrr",
    title: "Vendas Novas MRR",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "sales",
    required: true,
    description: "MRR de novos clientes adquiridos no mês",
    format: formatCurrency,
    source: "sales"
  },
  expansion_mrr: {
    id: "expansion_mrr",
    title: "Expansão MRR",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "sales",
    required: true,
    description: "MRR adicional de upsell e cross-sell na base",
    format: formatCurrency,
    source: "sales"
  },
  vendas_pontual: {
    id: "vendas_pontual",
    title: "Vendas Pontuais",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "sales",
    required: true,
    description: "Receita de projetos e serviços pontuais",
    format: formatCurrency,
    source: "sales"
  },
  inadimplencia_valor: {
    id: "inadimplencia_valor",
    title: "Inadimplência (Valor)",
    unit: "currency",
    direction: "lower",
    cadence: "monthly",
    category: "hugz",
    required: true,
    description: "Valor total em atraso",
    format: formatCurrency,
    source: "financial"
  },
  inadimplencia_pct: {
    id: "inadimplencia_pct",
    title: "Inadimplência %",
    unit: "percentage",
    direction: "lower",
    cadence: "monthly",
    category: "hugz",
    required: true,
    description: "Percentual de inadimplência sobre MRR",
    notes: "Guardrail: <=6%",
    format: formatPercentage,
    source: "financial"
  },
  gross_churn_mrr: {
    id: "gross_churn_mrr",
    title: "Gross Churn MRR",
    unit: "currency",
    direction: "lower",
    cadence: "monthly",
    category: "hugz",
    required: true,
    description: "MRR perdido por cancelamentos no mês",
    format: formatCurrency,
    source: "contracts"
  },
  gross_churn_pct: {
    id: "gross_churn_pct",
    title: "Gross Churn %",
    unit: "percentage",
    direction: "lower",
    cadence: "monthly",
    category: "hugz",
    required: true,
    description: "Percentual de MRR perdido antes de expansão",
    format: formatPercentage,
    source: "contracts"
  },
  net_churn_mrr: {
    id: "net_churn_mrr",
    title: "Net Churn MRR",
    unit: "currency",
    direction: "lower",
    cadence: "monthly",
    category: "hugz",
    required: true,
    description: "Gross Churn menos Expansion MRR",
    format: formatCurrency,
    source: "contracts"
  },
  net_churn_pct: {
    id: "net_churn_pct",
    title: "Net Churn %",
    unit: "percentage",
    direction: "lower",
    cadence: "monthly",
    category: "hugz",
    required: true,
    description: "Percentual de Net Churn sobre MRR",
    notes: "Guardrail: <=9%",
    format: formatPercentage,
    source: "contracts"
  },
  logo_churn: {
    id: "logo_churn",
    title: "Logo Churn",
    unit: "number",
    direction: "lower",
    cadence: "monthly",
    category: "hugz",
    required: true,
    description: "Quantidade de clientes cancelados no mês",
    format: formatNumber,
    source: "contracts"
  },
  logo_churn_pct: {
    id: "logo_churn_pct",
    title: "Logo Churn %",
    unit: "percentage",
    direction: "lower",
    cadence: "monthly",
    category: "hugz",
    required: true,
    description: "Percentual de clientes cancelados",
    notes: "Guardrail: <=10%",
    format: formatPercentage,
    source: "contracts"
  },
  turbooh_receita: {
    id: "turbooh_receita",
    title: "Receita TurboOH",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "turbooh",
    required: true,
    description: "Receita líquida do TurboOH",
    format: formatCurrency,
    source: "turbooh"
  },
  turbooh_resultado: {
    id: "turbooh_resultado",
    title: "Resultado TurboOH",
    unit: "currency",
    direction: "higher",
    cadence: "monthly",
    category: "turbooh",
    required: true,
    description: "Resultado operacional do TurboOH",
    format: formatCurrency,
    source: "turbooh"
  },
  turbooh_margem_pct: {
    id: "turbooh_margem_pct",
    title: "Margem TurboOH %",
    unit: "percentage",
    direction: "higher",
    cadence: "monthly",
    category: "turbooh",
    required: true,
    description: "Margem de resultado do TurboOH",
    notes: "Guardrail: >=25%",
    format: formatPercentage,
    source: "turbooh"
  },
  oh_screens: {
    id: "oh_screens",
    title: "Telas TurboOH",
    unit: "number",
    direction: "higher",
    cadence: "snapshot",
    category: "turbooh",
    required: true,
    description: "Quantidade de telas ativas no TurboOH",
    format: formatNumber,
    source: "turbooh"
  },
  oh_vacancy: {
    id: "oh_vacancy",
    title: "Vacância TurboOH",
    unit: "percentage",
    direction: "lower",
    cadence: "monthly",
    category: "turbooh",
    required: true,
    description: "Percentual de telas sem ocupação",
    format: formatPercentage,
    source: "turbooh"
  },
  tech_projetos_entregues: {
    id: "tech_projetos_entregues",
    title: "Projetos/Telas Entregues",
    unit: "number",
    direction: "higher",
    cadence: "monthly",
    category: "tech",
    required: true,
    description: "Quantidade de screens/projetos entregues",
    format: formatNumber,
    source: "tech"
  },
  tech_freelancers_custo: {
    id: "tech_freelancers_custo",
    title: "Custo Freelancers Tech",
    unit: "currency",
    direction: "lower",
    cadence: "monthly",
    category: "tech",
    required: true,
    description: "Custo total com freelancers de Tech",
    format: formatCurrency,
    source: "tech"
  },
  tech_freelancers_pct: {
    id: "tech_freelancers_pct",
    title: "Freelancers Tech %",
    unit: "percentage",
    direction: "lower",
    cadence: "monthly",
    category: "tech",
    required: true,
    description: "Custo freelancers como % do valor entregue",
    notes: "Guardrail: <=8%",
    format: formatPercentage,
    source: "tech"
  },
  cortex_coverage: {
    id: "cortex_coverage",
    title: "Cobertura Métricas OKR",
    unit: "percentage",
    direction: "higher",
    cadence: "snapshot",
    category: "tech",
    required: true,
    description: "Percentual de métricas OKR com dados no Cortex",
    notes: "Meta: 95% até Q2",
    format: formatPercentage,
    source: "cortex"
  },
  headcount: {
    id: "headcount",
    title: "Headcount Total",
    unit: "number",
    direction: "higher",
    cadence: "snapshot",
    category: "people",
    required: true,
    description: "Quantidade total de colaboradores",
    format: formatNumber,
    source: "hr"
  },
  receita_por_head: {
    id: "receita_por_head",
    title: "Receita por Cabeça",
    unit: "currency",
    direction: "higher",
    cadence: "snapshot",
    category: "people",
    required: true,
    description: "Receita líquida mensal dividida pelo headcount",
    format: formatCurrency,
    source: "calculated"
  },
  mrr_por_head: {
    id: "mrr_por_head",
    title: "MRR por Headcount",
    unit: "currency",
    direction: "higher",
    cadence: "snapshot",
    category: "people",
    required: true,
    description: "MRR dividido pelo headcount total",
    format: formatCurrency,
    source: "calculated"
  }
};

export function getObjectiveById(id: string): Objective | undefined {
  return objectiveRegistry.find(o => o.id === id);
}

export function getKRsByObjective(objectiveId: string): KR[] {
  return krRegistry.filter(kr => kr.objectiveId === objectiveId);
}

export function getKRById(id: string): KR | undefined {
  return krRegistry.find(kr => kr.id === id);
}

export function getMetricSpec(key: string): MetricSpec | undefined {
  return metricRegistry[key];
}

export function getAllObjectives(): Objective[] {
  return objectiveRegistry.sort((a, b) => a.order - b.order);
}

export function getAllKRs(): KR[] {
  return krRegistry;
}

export function getMetricsByCategory(category: MetricCategory): MetricSpec[] {
  return Object.values(metricRegistry).filter(m => m.category === category);
}

export function getRequiredMetrics(): MetricSpec[] {
  return Object.values(metricRegistry).filter(m => m.required);
}

export function formatMetricValue(key: string, value: number): string {
  const spec = getMetricSpec(key);
  if (!spec) {
    return value.toString();
  }
  return spec.format(value);
}

export const OKR_YEAR = 2026;
export const OKR_TITLE = "Bigger & Better — Consolidação, Escala e Padronização";

export const PERIODS = ["YTD", "Q1", "Q2", "Q3", "Q4", "Last12m"] as const;
export type Period = typeof PERIODS[number];

export const BUSINESS_UNITS = [
  { id: "all", label: "Todas" },
  { id: "turbooh", label: "TurboOH" },
  { id: "tech", label: "Tech" },
  { id: "commerce", label: "Commerce" }
] as const;
export type BusinessUnitId = typeof BUSINESS_UNITS[number]["id"];

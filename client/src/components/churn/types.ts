export interface ChurnContract {
  id: string;
  cliente_nome: string;
  contrato_nome?: string;
  cnpj: string;
  produto: string;
  squad: string;
  responsavel: string;
  cs_responsavel: string;
  vendedor: string;
  valorr: number;
  /** Receita pontual do contrato (cup_contratos.valorp). 0 quando ausente. */
  valorp: number;
  data_inicio: string;
  data_encerramento: string | null;
  data_pausa: string | null;
  status: string;
  servico: string;
  motivo_cancelamento?: string;
  tipo: 'churn' | 'pausado' | 'em_cancelamento';
  lifetime_meses: number;
  ltv: number;
  // Novos campos de cup_churn
  plano?: string | null;
  cluster?: string | null;
  submotivo?: string | null;
  mensagem_cliente?: string | null;
  contexto_operacao?: string | null;
  contexto_cx?: string | null;
  possibilidade_retencao?: string | null;
  evitabilidade_churn?: string | null;
  status_cancelamento?: string | null;
  status_conta?: string | null;
  ultimo_dia_operacao?: string | null;
  is_abonado?: boolean;
}

export interface ChurnPorSquad {
  squad: string;
  mrr_ativo: number;
  mrr_perdido: number;
  percentual: number;
}

export interface ChurnPorPessoa {
  pessoa: string;
  mrr_ativo: number;
  mrr_perdido: number;
  /** null quando a pessoa não tem carteira no snapshot — exibir "—", nunca 0%. */
  percentual: number | null;
}

export interface RetentionPoint {
  monthIndex: number;
  retainedPct: number;
  mrrRetainedPct: number;
  retainedCount: number;
  totalStarted: number;
  retainedMrr: number;
  churnedCount: number;
}

export interface ChurnPorMotivo {
  motivo: string;
  mrr_perdido: number;
  quantidade: number;
  percentual: number;
}

export interface ChurnBreakdownItem {
  label: string;
  mrr: number;
  count: number;
}

export interface ChurnDetalhamentoData {
  contratos: ChurnContract[];
  metricas: {
    total_churned: number;
    total_pausados: number;
    mrr_perdido: number;
    mrr_pausado: number;
    ltv_total: number;
    lt_medio: number;
    mrr_ativo_ref?: number;
    churn_percentual?: number;
    churn_por_squad?: ChurnPorSquad[];
    churn_por_pessoa?: ChurnPorPessoa[];
    churn_por_motivo?: ChurnPorMotivo[];
    churn_por_evitabilidade?: ChurnBreakdownItem[];
    churn_por_cluster?: ChurnBreakdownItem[];
    churn_por_plano?: ChurnBreakdownItem[];
    periodo_referencia?: string;
    mrr_base_por_mes?: Record<string, number>;
    soma_mrr_bases?: number;
    /** Carteira somada por operador nos meses do range. Denominador do churn% nos drawers. */
    soma_mrr_bases_por_pessoa?: Record<string, number>;
    total_abonado?: number;
    mrr_abonado?: number;
  };
  filtros: {
    squads: string[];
    produtos: string[];
    responsaveis: string[];
    servicos: string[];
    planos?: string[];
    clusters?: string[];
    evitabilidades?: string[];
    possibilidades_retencao?: string[];
  };
  retentionCurve?: RetentionPoint[];
}

export const CHART_COLORS = {
  primary: "hsl(var(--chart-1))",
  secondary: "hsl(var(--chart-2))",
  tertiary: "hsl(var(--chart-3))",
  quaternary: "hsl(var(--chart-4))",
  quinary: "hsl(var(--chart-5))",
};

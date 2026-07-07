export interface OperadorRank { nome: string; valor: number; fotoUrl: string | null; cargo: string | null; }
export interface SquadRank { squad: string; mrr: number; pontual: number; contratos: number; clientes: number; posicao: number; }
export interface ReceitaChurnPonto { month: string; label: string; mrr: number; pontual: number; churnBrl: number; churnPct: number; }
export interface EntregaSquad { squad: string; valor: number; contratos: number; }
export interface EntregaProdutoMes { month: string; label: string; produtos: Record<string, number>; total: number; }
export interface TempoEntrega { produto: string; diasMedio: number; contratos: number; }

export interface ReportsMensal {
  mesReferencia: string; mesLabel: string;
  turboMetrics: {
    mrrAtivo: number; mrrAdicionado: number; churnMrr: number; churnCount: number;
    pausadosMrr: number; pausadosCount: number; crosssellMrr: number; crosssellPontual: number;
    receitaChurnSeries: ReceitaChurnPonto[];
  };
  pontualData: {
    aquisicao: { valor: number; contratos: number };
    entregasMes: { porSquad: EntregaSquad[]; total: number };
    entregasPorProdutoMes: EntregaProdutoMes[];
    tempoMedioEntrega: TempoEntrega[];
    emAberto: { valor: number; contratos: number; porServico: { servico: string; valor: number; contratos: number }[] };
  };
  techData: { kpis: { entregues: number; valorEntregues: number; tempoMedio: number; adicionados: number }; entregasPorTipo: Record<string, unknown>[] };
  topOperadores: { topMrr: OperadorRank[]; topMrrPontual: OperadorRank[]; topEntregas: OperadorRank[] };
  rankingSquads: SquadRank[];
  squadDetails: { squad: string; mrr: number; pontual: number; churnPct: number; churnBrl: number; nrrBrl: number; nrrPct: number }[];
  okrObjectives: { id: string; title: string; krs: { id: string; title: string; unit: string; actual: number | null; achievement: number }[] }[];
}

export interface ChurnDetalhamento {
  contratos: { id: number; cliente_nome: string; produto: string; squad: string; responsavel: string; valorr: number; motivo_cancelamento: string; lifetime_meses: number; ltv: number }[];
  metricas: {
    total_churned: number; mrr_perdido: number; churn_percentual: number; lt_medio: number; ltv_total: number;
    churn_por_squad: Record<string, unknown>; churn_por_pessoa: Record<string, unknown>; churn_por_motivo: Record<string, unknown>;
  };
}

export interface DrillColuna { chave: string; label: string; tipo?: "brl" | "int" | "pct" | "text"; }
export type DrillState = { titulo: string; subtitulo?: string; colunas: DrillColuna[]; linhas: Record<string, unknown>[] } | null;

export interface OperadorRank { nome: string; valor: number; fotoUrl: string | null; cargo: string | null; }
export interface SquadRank { squad: string; mrr: number; pontual: number; contratos: number; clientes: number; posicao: number; }
/** `churnPct` = churn ÷ MRR do fim do PRÓPRIO mês (leitura do Reporte Mensal); `churnPctBase` =
   churn ÷ MRR do fechamento do mês ANTERIOR — a régua canônica do painel (mesma base da meta de
   8%), null no 1º mês da janela. `churnCount` = mesma população do card (com abonados). */
export interface ReceitaChurnPonto { month: string; label: string; mrr: number; pontual: number; churnBrl: number; churnPct: number; churnPctBase: number | null; churnCount: number; }
export interface VendasSeriePonto { month: string; label: string; vendasMrr: number; vendasPontual: number; numContratos: number; }
export interface CrosssellHistoricoPonto { mes: string; mrr: number; pontual: number; }
export interface EntregaSquad { squad: string; valor: number; contratos: number; }
export interface EntregaProdutoMes { month: string; label: string; produtos: Record<string, number>; total: number; }
export interface TempoEntrega { produto: string; diasMedio: number; contratos: number; }

export interface ReportsMensal {
  mesReferencia: string; mesLabel: string;
  turboMetrics: {
    mrrAtivo: number; mrrAdicionado: number; churnMrr: number; churnCount: number;
    pausadosMrr: number; pausadosCount: number; crosssellMrr: number; crosssellPontual: number;
    receitaChurnSeries: ReceitaChurnPonto[];
    crosssellHistorico: CrosssellHistoricoPonto[];
  };
  contratosMes: {
    vendasSeries: VendasSeriePonto[];
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

// churn_por_squad/pessoa/motivo: server (routes.ts, /api/analytics/churn-detalhamento) já devolve
// ARRAYS de objetos (não Record<string,...> — confirmado lendo o handler). Nada de Object.entries aqui.
export interface ChurnPorSquadRow { squad: string; mrr_ativo: number; mrr_perdido: number; percentual: number | null; }
export interface ChurnPorPessoaRow { pessoa: string; mrr_ativo: number; mrr_perdido: number; percentual: number | null; }
export interface ChurnPorMotivoRow { motivo: string; mrr_perdido: number; quantidade: number; percentual: number; }

export interface ChurnDetalhamento {
  contratos: { id: number; cliente_nome: string; produto: string; squad: string; responsavel: string; valorr: number; motivo_cancelamento: string; lifetime_meses: number; ltv: number }[];
  metricas: {
    total_churned: number; mrr_perdido: number; churn_percentual: number; lt_medio: number; ltv_total: number;
    churn_por_squad: ChurnPorSquadRow[]; churn_por_pessoa: ChurnPorPessoaRow[]; churn_por_motivo: ChurnPorMotivoRow[];
  };
}

export interface ChurnProdutoMotivoCelula { produto: string; motivo_cancelamento: string; cancelamentos: number; mrr_perdido: number; ticket_medio: number; }
export interface ChurnProdutoMotivo {
  produtos: string[]; motivos: string[]; celulas: ChurnProdutoMotivoCelula[];
  totais: { cancelamentos: number; mrr_perdido: number; ticket_medio: number };
}

export interface ChurnTaxaMensalRow { mes: string; mrr_base: number; mrr_churn: number; cancelamentos: number; taxa: number; }
export interface ChurnTaxaMensal { rows: ChurnTaxaMensalRow[]; }

export interface DrillColuna { chave: string; label: string; tipo?: "brl" | "int" | "pct" | "text"; }
export type DrillState = { titulo: string; subtitulo?: string; colunas: DrillColuna[]; linhas: Record<string, unknown>[] } | null;

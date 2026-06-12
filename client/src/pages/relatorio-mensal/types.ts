export interface ColaboradorSlide {
  id: number;
  nome: string;
  cargo: string;
  squad: string;
  fotoUrl: string | null;
}

export interface NovoColaborador extends ColaboradorSlide {
  admissao: string;
}

export interface Aniversariante extends ColaboradorSlide {
  aniversario: string;
  dia: number;
}

export interface AniversarioEmpresa extends ColaboradorSlide {
  admissao: string;
  anosDeEmpresa: number;
}

export interface KRItem {
  id: string;
  title: string;
  unit: "BRL" | "PCT" | "COUNT";
  direction: "gte" | "lte";
  targetQ: number;
  actual: number | null;
  achievement: number; // percentage 0-100
}

export interface ObjectiveSlide {
  id: string;
  title: string;
  subtitle?: string;
  krs: KRItem[];
}

export interface CloserRanking {
  name: string;
  fotoUrl: string | null;
  mrrObtido: number;
  pontualObtido: number;
  totalObtido: number;
  negociosGanhos: number;
}

export interface SdrRanking {
  name: string;
  fotoUrl: string | null;
  mrrGerado: number;
  pontualGerado: number;
  totalGerado: number;
  negociosGanhos: number;
}

export interface TopReunioes {
  name: string;
  fotoUrl: string | null;
  reunioes: number;
}

export interface PipelineBreakdown {
  pipeline: string;
  contratos: number;
  receitaRecorrente: number;
  receitaPontual: number;
}

export interface Indicacoes {
  indicacoesRecebidas: number;
  contratosFechados: number;
  valorRecorrente: number;
  valorPontual: number;
}

export interface VendasMes {
  month: string;
  label: string;
  vendasMrr: number;
  vendasPontual: number;
  numContratos: number;
}

export interface ContratosMes {
  numContratos: number;
  contratosRecorrente: number;
  contratosPontual: number;
  receitaRecorrente: number;
  receitaPontual: number;
  tmRecorrente: number;
  tmPontual: number;
  pipelineBreakdown: PipelineBreakdown[];
  vendasSeries: VendasMes[];
}

export interface CrosssellCloser {
  nome: string;
  mrr: number;
  pontual: number;
  contratos: number;
}

export interface TurboMetrics {
  mrrAtivo: number;
  ticketMedioContrato: number;
  ticketMedioCliente: number;
  clientesAtivos: number;
  contratosAtivos: number;
  clientesTotais: number;
  contratosTotais: number;
  mrrAdicionado: number;
  churnMrr: number;
  churnCount: number;
  pausadosMrr: number;
  pausadosCount: number;
  crosssellMrr: number;
  crosssellPontual: number;
  crosssellContratos: number;
  crosssellPorCloser: CrosssellCloser[];
  cxcsSolicitacoes: number;
  faturamentoPontual: number;
  pontualCommerceQtr: number;
  churnMetaMensal: number;
  receitaChurnSeries: ReceitaChurnMes[];
  retencoesSolicitacoesCount: number;
  retencoesSolicitacoesValor: number;
  retencoesCount: number;
  retencoesValor: number;
}

export interface ReceitaChurnMes {
  month: string;
  label: string;
  mrr: number;
  pontual: number;
  churnBrl: number;
  churnPct: number;
}

export interface ChurnCliente {
  nome: string;
  valor: number;
  abonado: boolean;
}

export interface SquadDetail {
  squad: string;
  mrr: number;
  pontual: number;
  ticketMedio: number;
  clientes: number;
  churnPct: number;       // churn descontando abonados (abonar_churn != 'Sim')
  churnBrl: number;
  churnTotalPct: number;  // churn total, sem descontar abonados
  churnTotalBrl: number;
  churnClientes: ChurnCliente[];
  expansaoNrr: number;    // expansão (upsell) do mês abatida do churn p/ formar o NRR
  nrrBrl: number;         // churn s/ abonados − expansão (negativo = retenção líquida positiva)
  nrrPct: number;
  mrrBase: number;
  evolucaoMrr: number;
}

export interface SquadRanking {
  squad: string;
  mrr: number;
  pontual: number;
  contratos: number;
  clientes: number;
  posicao: number;
}

export interface TechKpis {
  entregues: number;
  valorEntregues: number;
  tempoMedio: number;
  adicionados: number;
  valorAdicionados: number;
}

export interface TechTipoMes {
  month: string;
  label: string;
  [tipo: string]: string | number;
}

export interface TechEmAberto {
  tipo: string;
  quantidade: number;
  valor: number;
}

export interface TechPipelineItem {
  status: string;
  quantidade: number;
}

export interface TechSlideData {
  kpis: TechKpis;
  mesLabel: string;
  entregasPorTipo: TechTipoMes[];
  receitaPorTipo: TechTipoMes[];
  emAbertoPorTipo: TechEmAberto[];
  pipeline: TechPipelineItem[];
}

export interface PontualServicoAberto {
  servico: string;
  valor: number;
  contratos: number;
}

export interface PontualSquadEntrega {
  squad: string;
  valor: number;
  contratos: number;
}

export interface PontualEntregaProdutoMes {
  month: string;
  label: string;
  produtos: Record<string, number>;
  total: number;
}

export interface PontualTempoMedio {
  produto: string;
  diasMedio: number;
  contratos: number;
}

export interface PontualData {
  emAberto: {
    valor: number;
    contratos: number;
    porServico: PontualServicoAberto[];
  };
  aquisicao: {
    valor: number;
    contratos: number;
  };
  entregasMes: {
    porSquad: PontualSquadEntrega[];
    total: number;
  };
  variacaoEstoque: {
    entrou: number;
    saiu: number;
    delta: number;
  };
  entregasPorProdutoMes: PontualEntregaProdutoMes[];
  tempoMedioEntrega: PontualTempoMedio[];
}

export interface DfcRecebimentoMes {
  month: string;   // "YYYY-MM"
  label: string;   // "Jan", "Fev", ...
  recebido: number;
}

export interface FaturamentoYtdData {
  faturamentoBrutoYtd: number;
  inadimplenciaYtd: number;
  impostoYtd: number;
  dfcRecebimentoMensal: DfcRecebimentoMes[];
}

export interface OperadorRanking {
  nome: string;
  valor: number;
  fotoUrl?: string | null;
  cargo?: string | null;
}

export interface TopOperadores {
  topMrr: OperadorRanking[];
  topMrrPontual: OperadorRanking[];
  topEntregas: OperadorRanking[];
}

export interface RelatorioMensalData {
  mesReferencia: string;
  mesLabel: string;
  mesDadosLabel: string;
  novosColaboradores: NovoColaborador[];
  aniversariantes: Aniversariante[];
  aniversariosEmpresa: AniversarioEmpresa[];
  okrObjectives: ObjectiveSlide[];
  rankingClosers: CloserRanking[];
  topPontual: CloserRanking | null;
  rankingSDRs: SdrRanking[];
  topReunioes: TopReunioes | null;
  contratosMes: ContratosMes;
  turboMetrics: TurboMetrics;
  rankingSquads: SquadRanking[];
  squadDetails: SquadDetail[];
  techData: TechSlideData;
  indicacoes: Indicacoes;
  pontualData: PontualData;
  faturamentoYtd: FaturamentoYtdData;
  topOperadores: TopOperadores;
}

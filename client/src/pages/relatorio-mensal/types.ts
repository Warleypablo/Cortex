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

export interface ContratosMes {
  numContratos: number;
  contratosRecorrente: number;
  contratosPontual: number;
  receitaRecorrente: number;
  receitaPontual: number;
  tmRecorrente: number;
  tmPontual: number;
  pipelineBreakdown: PipelineBreakdown[];
}

export interface TurboMetrics {
  mrrAtivo: number;
  ticketMedio: number;
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
  cxcsSolicitacoes: number;
  faturamentoTotal: number;
  faturamentoPago: number;
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
  churnBrl: number;
  churnPct: number;
}

export interface SquadDetail {
  squad: string;
  mrr: number;
  pontual: number;
  ticketMedio: number;
  clientes: number;
  churnPct: number;
  churnBrl: number;
  evolucaoMrr: number;
}

export interface SquadRanking {
  squad: string;
  mrr: number;
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
}

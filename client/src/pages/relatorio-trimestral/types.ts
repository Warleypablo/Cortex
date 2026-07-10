import type {
  TurboMetrics, ReceitaChurnMes, ContratosMes, CloserRanking, SdrRanking, TopReunioes,
  SquadRanking, SquadDetail, PontualData,
} from "../relatorio-mensal/types";

// No deck trimestral as entregas por produto são agrupadas por TRIMESTRE do ano
// (Q1..Qn), não mês a mês — o mensal segue com `entregasPorProdutoMes` intacto.
export interface EntregaProdutoTri {
  quarter: number;
  label: string;                      // "Q1"
  produtos: Record<string, number>;
  total: number;
  parcial: boolean;                   // trimestre em andamento
}

export type PontualDataTrimestral =
  Omit<PontualData, "entregasPorProdutoMes"> & { entregasPorProdutoTri: EntregaProdutoTri[] };

// metaMrr = meta de MRR ativo do BP 2026 no mês da foto do trimestre; null quando o
// trimestre está fora do BP (ex.: Q4 2025) — a linha de meta não é desenhada ali.
//
// Trilha do PONTUAL: pontual = receita entregue no tri (fluxo) · pontualContratos =
// nº de entregas · vendasPontual = aquisição no tri (fluxo) · estoquePontual = fila
// em aberto na foto do fim do tri (null sem snapshot).
export interface TrendPoint {
  q: string; label: string;
  mrr: number; vendas: number; churn: number; metaMrr: number | null;
  pontual: number; pontualContratos: number; vendasPontual: number; estoquePontual: number | null;
}
export interface Qoq { atual: number; anterior: number; betterDirection: "up" | "down" }

export interface TrendData {
  series: TrendPoint[];
  qoq: {
    mrr: Qoq; vendas: Qoq; churn: Qoq;
    pontualReceita: Qoq; pontualVendas: Qoq; pontualEstoque: Qoq;
  };
}

// Apoio do slide "Visão do Trimestre — Pontual".
export interface VisaoPontual {
  tempoMedioEntregaDias: number;
  amostraEntregas: number;
}

// Série do gráfico "MRR + Pontual × Churn por trimestre" (slide Turbo), com a meta
// de churn do tri. metaChurn = Σ (8% × MRR do fim do mês anterior) dos meses do tri;
// null quando algum mês-base não tem snapshot — a linha não é desenhada ali.
export interface ReceitaChurnTri extends ReceitaChurnMes {
  metaChurn: number | null;
}

export interface TurboMetricsTri extends Omit<TurboMetrics, "receitaChurnSeries"> {
  receitaChurnSeries: ReceitaChurnTri[];
}

// Tickets médios por CLIENTE, mesma régua nos dois lados:
// recorrente = MRR (foto fim do tri) ÷ clientes recorrentes ativos;
// pontual = receita pontual do tri ÷ clientes distintos atendidos no tri.
export interface TicketCliente {
  ticketMedio: number;
  clientes: number;
}

export interface TicketsCliente {
  recorrente: TicketCliente;
  pontual: TicketCliente;
}

// Leitura contábil do Conta Azul (caz_parcelas, grupo inteiro):
//   faturável (bruto) − inadimplência (atrasado/perdido) = faturado (caixa recebido)
export interface FaturadoTri {
  quarter: number;
  label: string;         // "Q1"
  faturavel: number;
  inadimplencia: number;
  faturado: number;
  parcial: boolean;      // trimestre em andamento
}

export interface Faturado {
  ano: number;
  trimestres: FaturadoTri[];
  atual: FaturadoTri | null;
  ytdFaturado: number;
  meta: number | null;            // null fora de 2026
  pctMeta: number | null;
  pctAnoDecorrido: number | null; // ritmo esperado do ano
  coberturaParcial: boolean;      // caz_parcelas só começa em out/2025
}

// Top 3 operadores (responsável) de cada squad no trimestre, por FATURAMENTO =
// MRR ativo (foto do fim do tri) + pontual entregue no tri. numOperadores =
// total de operadores da squad com faturamento > 0.
export interface OperadorSquad {
  nome: string;
  faturamento: number;
  mrr: number;
  pontual: number;
  fotoUrl: string | null;
  cargo: string | null;
}

export interface SquadOperadores {
  squad: string;
  totalFaturamento: number;
  // Quebra do total: recorrente (MRR ativo) × pontual entregue no tri.
  // totalMrr + totalPontual === totalFaturamento.
  totalMrr: number;
  totalPontual: number;
  numOperadores: number;
  operadores: OperadorSquad[];
}

// Evolução do faturamento QoQ por squad (chart do slide "Squad em Destaque").
// faturamento = MRR (foto do fim do tri) + pontual entregue (fluxo do tri).
export interface SquadEvolucaoPonto {
  q: string;      // "2026-Q1"
  label: string;  // "Q1 2026"
  mrr: number;
  pontual: number;
  total: number;
}

// SquadDetail do mensal + a evolução QoQ, exclusiva do trimestral.
export interface SquadDetailTri extends SquadDetail {
  evolucao: SquadEvolucaoPonto[];
}

// Área Tech: dados vêm do dashboard tech-dash.pages.dev (fonte correta, gerada
// direto do ClickUp). Espelha server/lib/techDash.ts → TechTrimestralData.
export interface TechAccount { nome: string; projetos: number; valor: number }
export interface TechMesEntrega { month: string; label: string; valor: number; projetos: number }
export interface TechMesMrr { month: string; label: string; mrr: number; contratos: number }
export interface TechTrimestralData {
  fonte: string;
  geradoEm: string | null;
  disponivel: boolean;
  meta: number;
  entregue: number;
  atingimento: number;
  projetos: number;
  ticketMedio: number;
  mrrUltimoMes: number;
  mrrUltimoMesLabel: string;
  contratosAtivos: number;
  entregasTri: number | null;
  entregasPorMes: TechMesEntrega[];
  mrrPorMes: TechMesMrr[];
  topAccounts: TechAccount[];
}

// Painel "Tempo por Status" dos Projetos Tech. Espelha server/lib/techPipeline.ts.
// dias de um status = média sobre TODOS os projetos do tri (status pulado conta 0).
export interface TechPipelineStatus { status: string; label: string; color: string; dias: number }
export interface TechPipelineTipo {
  tipo: string;
  projetos: number;
  dias: number;
  prazoDiasUteis: number | null;
  dentroDoPrazo: boolean | null;
}
export interface TechPipelineData {
  disponivel: boolean;
  fonte: string;
  projetos: number;
  tipos: number;
  tempoMedioDias: number;
  tempoMedianoDias: number;
  statusMaisLento: string;
  porStatus: TechPipelineStatus[];
  porTipo: TechPipelineTipo[];
  noPrazo: { projetos: number; total: number; pct: number; meta: number };
}

export interface RelatorioTrimestralData {
  trimestre: string;
  label: string;
  parcial: boolean;
  mesesComputados: string[];
  trend: TrendData;
  ticketsCliente: TicketsCliente;
  turboMetrics: TurboMetricsTri;
  contratosMes: ContratosMes;
  rankingClosers: CloserRanking[];
  topPontual: CloserRanking | null;
  rankingSDRs: SdrRanking[];
  topReunioes: TopReunioes | null;
  rankingSquads: SquadRanking[];
  squadDetails: SquadDetailTri[];
  operadoresPorSquad: SquadOperadores[];
  pontualData: PontualDataTrimestral;
  visaoPontual: VisaoPontual;
  techData: TechTrimestralData;
  techPipeline: TechPipelineData;
  faturado: Faturado;
}

import type {
  TurboMetrics, ContratosMes, CloserRanking, SdrRanking, TopReunioes,
  SquadRanking, SquadDetail, PontualData,
} from "../relatorio-mensal/types";

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

// Faturável do trimestre (sem Conta Azul): Σ MRR ativo (foto do fim de cada mês
// do tri) + pontual entregue no tri.
export interface FaturavelMes {
  month: string;
  label: string;
  mrr: number;
  pontual: number;
  total: number;
}

export interface Faturavel {
  mrrSoma: number;
  pontualEntregue: number;
  total: number;
  porMes: FaturavelMes[];
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

export interface RelatorioTrimestralData {
  trimestre: string;
  label: string;
  parcial: boolean;
  mesesComputados: string[];
  trend: TrendData;
  ticketsCliente: TicketsCliente;
  turboMetrics: TurboMetrics;
  contratosMes: ContratosMes;
  rankingClosers: CloserRanking[];
  topPontual: CloserRanking | null;
  rankingSDRs: SdrRanking[];
  topReunioes: TopReunioes | null;
  rankingSquads: SquadRanking[];
  squadDetails: SquadDetailTri[];
  operadoresPorSquad: SquadOperadores[];
  pontualData: PontualData;
  visaoPontual: VisaoPontual;
  techData: TechTrimestralData;
  faturavel: Faturavel;
}

import type {
  TurboMetrics, ContratosMes, CloserRanking, SdrRanking, TopReunioes,
  SquadRanking, SquadDetail, PontualData, TechSlideData,
} from "../relatorio-mensal/types";

export interface TrendPoint { q: string; label: string; mrr: number; vendas: number; churn: number }
export interface Qoq { atual: number; anterior: number; betterDirection: "up" | "down" }

export interface TrendData {
  series: TrendPoint[];
  qoq: { mrr: Qoq; vendas: Qoq; churn: Qoq };
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
  numOperadores: number;
  operadores: OperadorSquad[];
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
  squadDetails: SquadDetail[];
  operadoresPorSquad: SquadOperadores[];
  pontualData: PontualData;
  techData: TechSlideData;
  faturavel: Faturavel;
}

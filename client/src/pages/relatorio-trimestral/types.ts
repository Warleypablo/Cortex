import type {
  TurboMetrics, ContratosMes, CloserRanking, SquadRanking, SquadDetail,
  PontualData, TechSlideData, FaturamentoYtdData,
} from "../relatorio-mensal/types";

export interface TrendPoint { q: string; label: string; mrr: number; vendas: number; churn: number }
export interface Qoq { atual: number; anterior: number; betterDirection: "up" | "down" }

export interface TrendData {
  series: TrendPoint[];
  qoq: { mrr: Qoq; vendas: Qoq; churn: Qoq };
}

export interface RelatorioTrimestralData {
  trimestre: string;
  label: string;
  parcial: boolean;
  mesesComputados: string[];
  trend: TrendData;
  turboMetrics: TurboMetrics;
  contratosMes: ContratosMes;
  rankingClosers: CloserRanking[];
  topPontual: CloserRanking | null;
  rankingSquads: SquadRanking[];
  squadDetails: SquadDetail[];
  pontualData: PontualData;
  techData: TechSlideData;
  faturamentoYtd: FaturamentoYtdData;
}

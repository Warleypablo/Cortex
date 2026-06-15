export interface Overview {
  jornadas: number;
  retencaoUltima: number;
  dropMedio: number;
  churnConfirmado: number;
  valorpPerdido: number;
}
export interface FunilNivel {
  nivel: number;
  atingiram: number;
  pararamAqui: number;
  churn: number;
  emAndamento: number;
  concluido: number;
  valorpChurn: number;
  dropPct: number;
}
export interface DimRow { label: string; qtd: number; valorp: number; }
export interface DetalheRow {
  nomeCliente: string | null;
  produto: string;
  nivelCaiu: number;
  motivo: string | null;
  responsavel: string | null;
  cs: string | null;
  squad: string | null;
  vendedor: string | null;
  valorp: number;
  dataEncerramento: string | null;
}
export interface EntregaStage {
  nivel: number;
  situacao: "entregue" | "em_andamento" | "churn";
  valorp: number;
  motivoCancelamento: string | null;
  dataEncerramento: string | null;
}
export interface Jornada {
  idTask: string;
  produto: string;
  nomeCliente: string | null;
  nivelMax: number;
  situacaoFinal: "entregue" | "em_andamento" | "churn";
  valorp: number;
  squad: string | null;
  responsavel: string | null;
  csResponsavel: string | null;
  vendedor: string | null;
  motivoCancelamento: string | null;
  dataInicioPrimeira: string | null;
  dataEncerramento: string | null;
  entregas: EntregaStage[];
}
export interface ChurnPontorrentePayload {
  overview: Overview;
  funil: FunilNivel[];
  churnPorDimensao: { motivo: DimRow[]; squad: DimRow[]; responsavel: DimRow[]; cs: DimRow[] };
  detalhamento: DetalheRow[];
  jornadas: Jornada[];
  filtrosDisponiveis: { produtos: string[]; squads: string[]; responsaveis: string[] };
}
export interface FiltrosState {
  produto?: string;
  squad?: string;
  responsavel?: string;
  de?: string;
  ate?: string;
}

// Espelho de SemanaMetricas em server/reportsSemanal/derivar.ts.
// Mudou lá? Mude aqui.
export interface SemanaMetricas {
  inicio: string;
  fim: string;
  label: string;
  parcial: boolean;

  mrrAdicionado: number;
  pontualVendido: number;

  carteiraTriagemOnboarding: number;
  carteiraAtivo: number;
  carteiraEmCancelamento: number;
  mrrAtivo: number;
  mrrOperando: number;
  entregaPontual: number;

  baseMrr: number;
  basePontual: number;

  churnMrrTotal: number;
  churnMrrTotalPct: number;
  churnMrrAjustado: number;
  churnMrrAjustadoPct: number;
  churnPontualTotal: number;
  churnPontualTotalPct: number;
  churnPontualAjustado: number;
  churnPontualAjustadoPct: number;

  crossMrr: number;
  crossPontual: number;
  crossTotal: number;

  netChurnAjustado: number;
  netChurnAjustadoPct: number;
  netChurnBruto: number;
  netChurnBrutoPct: number;

  vendasIndisponivel: boolean;
}

export type MetricaChave = keyof Omit<SemanaMetricas, "inicio" | "fim" | "label" | "parcial" | "vendasIndisponivel">;

export interface LinhaDrillDeal {
  cliente: string;
  closer: string;
  canal: string;
  data: string | null;
  recorrente: number;
  pontual: number;
}

export interface LinhaDrillChurn {
  cliente: string;
  valor: number;
  motivo: string | null;
  abonado: boolean;
}

export interface DetalheResp {
  tipo: "deals" | "churn";
  linhas: LinhaDrillDeal[] | LinhaDrillChurn[];
}

export interface CelulaSelecionada {
  metrica: MetricaChave;
  rotulo: string;
  inicio: string;
  fim: string;
  labelSemana: string;
}

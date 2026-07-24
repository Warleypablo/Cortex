// Espelho de SemanaOperacao/Comparativo em server/reportsSemanal/derivarOperacao.ts.
// Mudou lá? Mude aqui.
export interface SemanaOperacao {
  inicio: string;
  fim: string;
  label: string;

  mrrAtivo: number;
  mrrOperando: number;

  baseMrr: number;
  basePontual: number;

  churnMrrTotal: number;
  churnMrrAbonado: number;
  churnMrrLiquido: number;
  churnMrrLiquidoPct: number;
  churnPontualTotal: number;
  churnPontualAbonado: number;
  churnPontualLiquido: number;
  churnPontualLiquidoPct: number;

  entregaPontual: number;
  estoquePontual: number;

  headcountOperacao: number;
  mrrPorCabeca: number | null;
  faturamentoPorCabeca: number | null;
  faturamentoPorCabecaParcial: boolean;

  estoquePorProduto: { produto: string; valor: number; qtd: number }[];
  churnPorMotivo: { motivo: string; mrr: number; pontual: number }[];
}

export interface ProdutoComparado {
  chave: string;
  atual: number;
  anterior: number;
  qtdAtual: number;
  qtdAnterior: number;
}

export interface MotivoComparado {
  chave: string;
  atual: number;
  anterior: number;
  pontualAtual: number;
  pontualAnterior: number;
}

export interface Comparativo {
  atual: SemanaOperacao;
  anterior: SemanaOperacao;
  produtos: ProdutoComparado[];
  motivos: MotivoComparado[];
}

/** Chaves numéricas de SemanaOperacao — as que a tabela sabe renderizar. */
export type MetricaChave = Extract<
  keyof SemanaOperacao,
  | "mrrAtivo" | "mrrOperando"
  | "churnMrrTotal" | "churnMrrAbonado" | "churnMrrLiquido" | "churnMrrLiquidoPct"
  | "churnPontualTotal" | "churnPontualAbonado" | "churnPontualLiquido" | "churnPontualLiquidoPct"
  | "entregaPontual" | "estoquePontual"
  | "headcountOperacao" | "mrrPorCabeca" | "faturamentoPorCabeca"
>;

/** Métricas que o endpoint de drill aceita. */
export type MetricaDrill =
  | "churnMrrTotal"
  | "churnMrrAbonado"
  | "churnMrrLiquido"
  | "churnPontualTotal"
  | "churnPontualAbonado"
  | "churnPontualLiquido"
  | "entregaPontual"
  | "estoquePontual"
  | "churnMotivo";

export interface CelulaSelecionada {
  metrica: MetricaDrill;
  rotulo: string;
  inicio: string;
  fim: string;
  /** produto ou motivo, quando a célula vem de uma tabela quebrada */
  chave?: string;
  /** campo detalhado no drill de churn por motivo — mrr ou pontual, default mrr */
  campo?: "mrr" | "pontual";
}

export interface LinhaDrill {
  cliente: string;
  valor: number;
  motivo: string | null;
  abonado: boolean;
}

export interface DetalheResp {
  tipo: "churn";
  linhas: LinhaDrill[];
}

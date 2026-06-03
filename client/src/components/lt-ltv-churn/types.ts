export interface OverviewData {
  mrrAtivo: number;
  ltMedioAtivo: number;
  ltMedioCancelado: number;
  totalRecorrentes: number;
  totalInconsistentes: number;
  ltvMedioCliente: number;
}

export interface ProdutoBenchmark {
  produto: string;
  nAtivos: number;
  nCancelados: number;
  ltMedioCancelado: number;
  ltMedioAtivo: number;
  ltMedioGeral: number;
  ltvMedio: number;
  ltvMedioAtivo: number;
  ltvMedioGeral: number;
  mrrAtivo: number;
  mrrPerdido: number;
  revChurnPct: number;
}

export interface ChurnMensalPonto {
  mes: string;
  mrrAtivoInicio: number;
  mrrPerdido: number;
  revChurnPct: number;
}

export interface ContratoRow {
  idSubtask: string;
  nomeCliente: string | null;
  produto: string | null;
  squad: string | null;
  status: string;
  valorr: number;
  ltMeses: number | null;
  ltvRecorrente: number | null;
  isAtivo: boolean;
  dataInconsistente: boolean;
}

export interface OverviewClientesData {
  totalClientes: number;
  ltvMedioCliente: number;
  ltMedioCliente: number;
  ltvTotalClientes: number;
}

export interface ClienteRow {
  idTask: string;
  nomeCliente: string | null;
  nContratosRec: number;
  ltvRecorrente: number;
  ltvPontual: number;
  ltvTotal: number;
  ltMeses: number | null;
  ativo: boolean;
  mrrAtivo: number;
  cluster: string | null;
  clusterManual: boolean;
  clusterSugerido: string;
}

export interface BucketLtContrato { faixa: string; ativos: number; cancelados: number; }
export interface BucketDist { faixa: string; qtd: number; }

export interface EvolucaoProdutoData {
  produtos: string[];
  lt: Array<Record<string, number | string>>;
  ltv: Array<Record<string, number | string>>;
}

export interface EvolucaoClientePonto {
  mes: string;
  lt: number;
  ltv: number;
  ltMediana: number;
  ltvMediana: number;
}

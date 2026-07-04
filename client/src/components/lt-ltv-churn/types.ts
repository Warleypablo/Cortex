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
  ltMedianaCancelado: number;
  ltMedianaAtivo: number;
  ltMedianaGeral: number;
  ltvMediana: number;
  ltvMedianaAtivo: number;
  ltvMedianaGeral: number;
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
}

export interface BucketLtContrato { faixa: string; ativos: number; cancelados: number; }
export interface BucketDist { faixa: string; qtd: number; }

export interface EvolucaoProdutoData {
  produtos: string[];
  lt: Array<Record<string, number | string>>;
  ltv: Array<Record<string, number | string>>;
  lt_mediana: Array<Record<string, number | string>>;
  ltv_mediana: Array<Record<string, number | string>>;
}

export interface EvolucaoClientePonto {
  mes: string;
  lt: number;
  ltv: number;
  ltMediana: number;
  ltvMediana: number;
}

export interface EvolucaoProdutoTabelaCelula {
  lt: number;
  ltv: number;
  lt_mediana: number;
  ltv_mediana: number;
  n: number;
}

export interface EvolucaoProdutoTabelaData {
  meses: string[];
  produtos: string[];
  celulas: Record<string, Record<string, EvolucaoProdutoTabelaCelula>>;
}

export interface CohortMatrizSafra {
  safra: string; // "YYYY-MM"
  cells: number[]; // índice = meses desde a safra; valor = vivos naquele mês
}

export interface CohortMatrizData {
  unidade: "cliente" | "contrato";
  safras: CohortMatrizSafra[];
  maxOffset: number;
}

export interface CohortDetalheItem {
  id: string; // id_subtask (contrato) ou id_task (cliente) — link do ClickUp
  nome: string | null;
  vivo: boolean;
  // unidade=contrato
  servico?: string | null;
  valorr?: number;
  status?: string;
  dataInicio?: string | null;
  dataFim?: string | null;
  // unidade=cliente
  nContratos?: number;
  nVivos?: number;
  mrrVivo?: number;
  ultimoMesVivo?: string | null;
  temContratoPosterior?: boolean;
  ativoHoje?: boolean;
}

export interface CohortDetalheData {
  unidade: "cliente" | "contrato";
  safra: string;
  offset: number;
  itens: CohortDetalheItem[];
}

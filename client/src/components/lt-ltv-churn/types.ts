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
  ltvMedio: number;
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
  clientesAtivos: number;
  clientesCancelados: number;
  ltvMedioCliente: number;
  ltMedioClienteAtivo: number;
  ltMedioClienteCancelado: number;
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

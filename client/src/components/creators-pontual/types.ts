export interface CreatorsOverview {
  valorEstoque: number;
  qtdItens: number;
  ticketMedio: number;
  idadeMedia: number;
  valorTriagem: number;
  pctTriagem: number;
}

export interface StatusRow {
  status: string;
  qtd: number;
  valor: number;
}

export interface FluxoPonto {
  mes: string;
  entradas: number;
  valEntrada: number;
  entregas: number;
  valEntregue: number;
}

export interface EvolucaoPonto {
  mes: string;
  valorEstoque: number;
  qtdEstoque: number;
}

export interface OperadorRow {
  operador: string;
  aberto: number;
  valAberto: number;
  entregue: number;
  cicloMedioDias: number | null;
  idadeBacklogDias: number | null;
}

export interface VendedorRow {
  vendedor: string;
  qtd: number;
  valor: number;
}

export interface VendasPonto {
  mes: string;
  qtd: number;
  valor: number;
}

export interface CreatorItem {
  idSubtask: string;
  nomeCliente: string | null;
  produto: string | null;
  squad: string | null;
  operador: string | null;
  vendedor: string | null;
  valor: number;
  idadeDias: number;
  status: string;
}

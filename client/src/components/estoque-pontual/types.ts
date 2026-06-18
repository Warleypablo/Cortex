export interface EstoqueOverview {
  valorEstoque: number;
  qtdItens: number;
  idadeMedia: number;
  qtdEnvelhecidos: number;
  valorEnvelhecidos: number;
}

export interface EvolucaoPonto {
  mes: string;
  valorEstoque: number;
  qtdEstoque: number;
}

export interface FluxoPonto {
  mes: string;
  entradas: number;
  valEntrada: number;
  entregas: number;
  valEntregue: number;
}

export interface DistRow {
  chave: string;
  qtd: number;
  valor: number;
  idadeMedia: number;
}

export interface AgingBucket {
  faixa: string;
  qtd: number;
  valor: number;
}

export interface EstoqueItem {
  idSubtask: string;
  nomeCliente: string | null;
  produto: string | null;
  squad: string | null;
  responsavel: string | null;
  valor: number;
  idadeDias: number;
  status: string;
}

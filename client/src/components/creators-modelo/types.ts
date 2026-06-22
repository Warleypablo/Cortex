export interface Placar {
  porCliente: { recorrente: number; pontual: number; recorrenteAtivo: number; razao: number };
  volume: { pontualReceita: number; pontualClientes: number; recorrenteRealizado: number; recorrenteMrrCorrente: number; recorrenteClientes: number; recorrenteClientesAtivos: number };
  breakEven: { ticketPontual: number; minRecompras: number; maxRecompras: number; recompraRealPct: number };
}
export interface LtvMaduro { realizadoBlended: number; realizadoAtivo: number; projetadoChurn: number; premissaChurnMeses: number; }
export interface MixMes { mes: string; pontualN: number; pontualValor: number; recorrenteN: number; recorrenteMrrNovo: number; }
export interface FunilNivel { nivel: number; atingiram: number; pararamAqui: number; churn: number; emAndamento: number; concluido: number; valorpChurn: number; dropPct: number; }
export interface SafraPonto { safra: string; n: number; pctAtivo: number; }
export interface Recompra { totalAvulsos: number; comRecompra: number; pctRecompra: number; }
export interface Metricas {
  n: number;
  ltMesesMedia: number; ltMesesMediana: number;
  nEntregasMedia: number; nEntregasMediana: number;
  ltvMedia: number; ltvMediana: number;
  ltvTotal: number;
  idadeMediaMeses: number;
}
export interface Grupo { modelo: "recorrente" | "pontual"; estado: string; metricas: Metricas; }
export type Unidade = "cliente" | "contrato";
export type Agregador = "media" | "mediana";
export type Situacao = "ambos" | "ativo" | "cancelado";
export interface EntregaDetalhe { servico: string; status: string | null; dataInicio: string | null; dataFim: string | null; valor: number; }
export interface ClienteDetalhe {
  idTask: string; nome: string | null; estado: string;
  nEntregas: number; ltMeses: number | null; ltv: number;
  entregas: EntregaDetalhe[];
}
export interface RedesignPayload {
  meta: { de: string | null; ate: string | null; hoje: string; nSequenciados: number; nAvulsos: number; pctSequenciados: number };
  placar: Placar;
  ltvMaduro: LtvMaduro;
  mixMensal: MixMes[];
  retencao: { funilVendido: FunilNivel[]; funilEntregue: FunilNivel[]; safra: SafraPonto[]; recompra: Recompra };
  maturidade: { recorrenteIdade: number; pontualIdade: number; aviso: boolean };
  tabela: { cliente: Grupo[]; contrato: Grupo[] };
}

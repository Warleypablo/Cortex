// client/src/components/creators-modelo/types.ts
export interface Metricas {
  n: number;
  ltMesesMedia: number; ltMesesMediana: number;
  nEntregasMedia: number; nEntregasMediana: number;
  ltvMedia: number; ltvMediana: number;
  ltvTotal: number;
  idadeMediaMeses: number;
}
export interface Grupo { modelo: "recorrente" | "pontual"; estado: string; metricas: Metricas; }
export interface FunilNivel {
  nivel: number; atingiram: number; pararamAqui: number; churn: number;
  emAndamento: number; concluido: number; valorpChurn: number; dropPct: number;
}
export interface CurvaPonto { meses: number; pctSobrevivencia: number; n: number; }
export interface Recompra { totalAvulsos: number; comRecompra: number; pctRecompra: number; }

export interface CreatorsModeloPayload {
  meta: { de: string | null; ate: string | null; hoje: string; nSequenciados: number; nAvulsos: number; pctSequenciados: number; };
  tabela: { cliente: Grupo[]; contrato: Grupo[]; };
  funilVendido: FunilNivel[];
  funilEntregue: FunilNivel[];
  curvaRecorrente: CurvaPonto[];
  recompra: Recompra;
  coorte: { recorrenteIdadeMedia: number; pontualIdadeMedia: number; avisoMaturidade: boolean; };
}

export type Unidade = "cliente" | "contrato";
export type Agregador = "media" | "mediana";
export type Situacao = "ambos" | "ativo" | "cancelado";

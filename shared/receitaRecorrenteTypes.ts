export type Empresa = "TURBO PARTNERS" | "PEIXOTO DEBBANE";
export type TipoReceita = "RECORRENTE" | "PONTUAL" | "NAO_CLASSIFICADO";

export interface MesReceita {
  mes: string;                         // ISO date "2026-03-01"
  empresa: Empresa;
  recorrente_previsto: number;
  recorrente_realizado: number;
  pontual_previsto: number;
  pontual_realizado: number;
  nao_classif_previsto: number;
  nao_classif_realizado: number;
  total_previsto: number;
  total_realizado: number;
  cobertura_cc_pct: number;            // 0-100
  mrr_contratado: number;
  is_futuro: boolean;
}

export interface CardsReceita {
  mrr_recorrente_atual: number;
  mrr_recorrente_delta_pct: number;    // -100..+inf
  pontual_atual: number;
  pontual_delta_pct: number;
  mix_recorrente_pct: number;          // 0-100
  realizado_pct: number;               // 0-100
  gap_contratado: { valor: number; pct: number } | null;
  ticket_medio_recorrente: number;
  novos_recorrente: number;
  churned_recorrente: number;
}

export interface ResumoReceitaResponse {
  meses: MesReceita[];
  cards: CardsReceita;
  range: { data_ini: string; data_fim: string };
  empresa_filtro: Empresa | null;
}

export interface DrilldownParcela {
  id_parcela: string;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  descricao: string;
  categoria_nome: string;
  valor_bruto: number;
  status: string;
  data_competencia: string;
  data_vencimento: string;
  venda_id: string | null;
  empresa: Empresa;
}

export type DrilldownResponse = DrilldownParcela[];

// Tipos do scorecard executivo. Espelham o contrato de `server/routes/scorecard.ts`
// (Task 1/2) — sem importar do server, seguindo o padrão já usado no restante de
// `painel-executivo/tipos.ts` (tipos duplicados manualmente no client).

export type ScorecardFormato = "brl" | "pct" | "int" | "meses";
export type ScorecardTemporalidade = "mes" | "snapshot";

export interface ScorecardSeriePonto {
  label: string;
  valor: number | null;
  /** "YYYY-MM" do ponto, quando a fonte trouxer — usado pelo modo "evolução" para truncar a
     série no mês SELECIONADO (em vez do último ponto absoluto) e realçar a coluna certa.
     Opcional: pontos sem `month` mantêm o comportamento anterior (sem corte). */
  month?: string;
}

export interface ScorecardRow {
  key: string;
  metrica: string;
  sub?: string;
  atual: number | null;
  formato: ScorecardFormato;
  serie?: ScorecardSeriePonto[];
  metaKey?: string;
  temporalidade: ScorecardTemporalidade;
  drill?: () => void;
  responsavelAuto?: string;
}

export interface ScorecardSection {
  id: string;
  titulo: string;
  subtitulo?: string;
  linhas: ScorecardRow[];
}

// GET /api/scorecard/metas?mes=YYYY-MM
export type ScorecardUnit = "BRL" | "PCT" | "COUNT";
export type ScorecardDirection = "up" | "down";
export type ScorecardOrigem = "bp" | "okr" | "override";

export interface ScorecardMeta {
  valor: number;
  unit: ScorecardUnit;
  direction: ScorecardDirection;
  origem: ScorecardOrigem;
  label: string;
}

export interface ScorecardMetasResponse {
  metas: Record<string, ScorecardMeta>;
}

// GET/PUT /api/scorecard/responsaveis
export interface ScorecardResponsavelItem {
  metrica_key: string;
  responsavel: string | null;
}

export interface ScorecardResponsaveisResponse {
  itens: ScorecardResponsavelItem[];
}

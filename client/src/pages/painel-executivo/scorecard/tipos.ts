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

// GET /api/scorecard/series?mes=YYYY-MM — espelha `SeriesScorecard`/`ScorecardSeriesResult` de
// server/routes/scorecard.ts (dup local no client, mesmo padrão do resto deste arquivo). Cada
// série já vem com os 12 meses da janela preenchidos (0 onde não há dado — ver `rowsParaSeries`
// em server/routes/scorecard.helpers.ts). Sem `label` (só `month`) — quem consome deriva o label.
export interface ScorecardSerieDimPonto {
  month: string;
  valor: number;
}

// Lead time (dias) por produto × mês — meses sem entrega ficam `null` (não 0, ver
// `rowsParaSeriesNullFill` em server/routes/scorecard.helpers.ts): "0 dias" mentiria,
// sugerindo entrega instantânea, quando na verdade não houve nenhuma entrega no mês.
export interface ScorecardSerieDimPontoNullable {
  month: string;
  valor: number | null;
}

export interface ScorecardSeriesPorDimensao {
  churnPorProduto: Record<string, ScorecardSerieDimPonto[]>;
  churnPorOperador: Record<string, ScorecardSerieDimPonto[]>;
  churnPorSquad: Record<string, ScorecardSerieDimPonto[]>;
  /** Churn Recorrente por motivo de cancelamento × mês — Onda D (mesma fonte/exclusões das
     outras dimensões de churn, ver `fetchChurnPorDimensao` no backend). Alimenta a seção "Churn
     Recorrente — Motivos". */
  churnPorMotivo: Record<string, ScorecardSerieDimPonto[]>;
  entregasPorOperador: Record<string, ScorecardSerieDimPonto[]>;
  /** Entregas pontuais (deploy) por squad × mês — Onda C2 (mesmo padrão de entregasPorOperador,
     dimensão squad). */
  entregasPorSquad: Record<string, ScorecardSerieDimPonto[]>;
  mrrPorSquad: Record<string, ScorecardSerieDimPonto[]>;
  mrrPorOperador: Record<string, ScorecardSerieDimPonto[]>;
  leadTimePorProduto: Record<string, ScorecardSerieDimPontoNullable[]>;
  /** Headcount ATIVO por squad ("Inhire".rh_pessoal) — Onda C2. NÃO é série mensal (headcount
     ATUAL, denominador constante de "Receita por Cabeça por squad"). Chaveado pela MESMA forma
     (com emoji) usada em `mrrPorSquad` — ver `fetchPessoasPorSquad` no backend. */
  pessoasPorSquad: Record<string, number>;
  /** Estoque pontual EM ABERTO por mês (ESTOQUE — snapshot de fim de mês) — Onda D. Série ÚNICA
     (sem dimensão), zero-fill (ver `rowsParaSerieUnica` no backend). Alimenta "Receita —
     Pontual: Em aberto (estoque)". */
  estoquePontualEmAbertoPorMes: ScorecardSerieDimPonto[];
  /** Como `estoquePontualEmAbertoPorMes`, status `pausado` — alimenta "Pausado (estoque)". */
  estoquePausadoPorMes: ScorecardSerieDimPonto[];
  /** Churn Pontual (Onda D2) — série ÚNICA `SUM(valorp)` por mês, bucketizada pela data do
     evento (`data_solicitacao_encerramento`), base = `cup_contratos` com `servico ILIKE
     '%entrega%'` e status de churn (ver `fetchChurnPontualPorMes` no backend). Zero-fill.
     Alimenta a linha "Churn confirmado (R$)" de "Churn Pontual — Geral" — `atual` também vem
     desta série (via `atualDaSerie`, ver logica.ts), reconciliando com o modo Evolução; cai de
     volta no overview cohort-based de `/api/churn-pontorrente` só quando esta série não carregar
     (loading/erro). */
  churnPontualPorMes: ScorecardSerieDimPonto[];
  /** Como `churnPontualPorMes`, quebrado por dimensão (ver `fetchChurnPontualPorDimensao`).
     Alimenta "Churn Pontual — Por produto". */
  churnPontualPorProduto: Record<string, ScorecardSerieDimPonto[]>;
  /** Como `churnPontualPorProduto`, dimensão `responsavel` (operacional). Alimenta "Churn
     Pontual — Por operador". */
  churnPontualPorOperador: Record<string, ScorecardSerieDimPonto[]>;
  /** Como `churnPontualPorProduto`, dimensão `squad`. Alimenta "Churn Pontual — Por squad". */
  churnPontualPorSquad: Record<string, ScorecardSerieDimPonto[]>;
  /** Como `churnPontualPorProduto`, dimensão `motivo_cancelamento`. Alimenta "Churn Pontual —
     Motivos". */
  churnPontualPorMotivo: Record<string, ScorecardSerieDimPonto[]>;
  /** Receita/Cabeça GERAL por mês (regime de CAIXA) — Onda F. Mesmo cálculo do card "Receita /
     Cabeça" do CEO Dashboard (receita recebida em caixa ÷ headcount ativo), reusado no backend
     via `receitaCabecaCaixaFromBp` em vez de uma nova query (ver server/routes/scorecard.ts:
     `fetchReceitaCabecaGeralPorMes`). Série ÚNICA (sem dimensão). `null` (não 0) fora do ano do
     BP2026 ou quando a razão não é calculável (headcount ausente/0) — mesmo padrão de
     `leadTimePorProduto`. Alimenta "Receita / Cabeça" na Visão Geral e "Receita por Cabeça (mês)"
     geral em Capacity. */
  receitaCabecaGeralPorMes: ScorecardSerieDimPontoNullable[];
}

export interface ScorecardSeriesResponse {
  series: ScorecardSeriesPorDimensao;
}

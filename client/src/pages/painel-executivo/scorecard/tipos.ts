// Tipos do scorecard executivo. Espelham o contrato de `server/routes/scorecard.ts`
// (Task 1/2) — sem importar do server, seguindo o padrão já usado no restante de
// `painel-executivo/tipos.ts` (tipos duplicados manualmente no client).

import type { DrillColuna } from "../tipos";

export type ScorecardFormato = "brl" | "pct" | "int" | "meses";
export type ScorecardTemporalidade = "mes" | "snapshot";

// Infra de drill genérico (Fase 1) — a linha só DECLARA o que auditar (dados puros); quem abre
// o DrillSheet é o Scorecard (estado centralizado, ver Scorecard.tsx). `dim`/`valor` filtram um
// breakdown (ex: churn por produto); ausentes = drill do TOTAL da métrica (ex: Churn R$ geral).
// `titulo` é um fallback opcional exibido ANTES da resposta do backend chegar (loading) — o
// título definitivo vem de `DrillDetalhe.titulo` (o backend conhece o dim/valor resolvidos).
export interface DrillParams {
  tipo: string;
  dim?: string;
  valor?: string;
  titulo?: string;
}

// GET /api/scorecard/detalhe?tipo=&mes=&dim=&valor= — espelha `DrillDetalhe` de
// server/routes/scorecard.detalhe.ts. `total` omitido para composições (ex: `churn_pct`, uma
// razão — somar os componentes não faz sentido). `formula` (quando presente) é exibida pelo
// DrillSheet acima da tabela.
export interface DrillDetalhe {
  titulo: string;
  subtitulo?: string;
  colunas: DrillColuna[];
  /** Uma linha pode incluir `${chave}Tipo` (ex: `valorTipo: "int"`) para sobrescrever, só naquela
     linha, o `tipo` da coluna — usado pelas composições da Fase 2C-i (`receita_cabeca`,
     `conversao_caixa`), cuja coluna "valor" mistura brl/int/pct entre os componentes. Ver
     `tipoCelula()` em DrillSheet.tsx. */
  linhas: Record<string, unknown>[];
  total?: number;
  formula?: string;
}

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
  /** Declara que esta linha é auditável e QUAL detalhe buscar — não abre nada sozinha (dados
     puros). O Scorecard (foco: linha inteira; evolução: célula do mês) lê isto e dispara
     `useScorecardDetalhe({ ...drillParams, mes })` no clique. Omitido = linha não clicável. */
  drillParams?: DrillParams;
  responsavelAuto?: string;
  /** Modo de acumulação da coluna YTD (modo Evolução, ver `calcYtd` em logica.ts). Omitido =
     default por `formato` ("pct" → "media", senão "soma"). Use "ultimo" para linhas de
     ESTOQUE/saldo (ex: MRR ativo, LTV médio, estoque pontual) — somar os meses não faz sentido
     para um saldo medido a cada mês. */
  ytdAgg?: "soma" | "ultimo" | "media";
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
}

export interface ScorecardSeriesResponse {
  series: ScorecardSeriesPorDimensao;
}

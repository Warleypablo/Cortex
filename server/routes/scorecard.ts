import type { Express } from "express";
import { isAuthenticated } from "../auth/middleware";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { BP_2026_TARGETS } from "../okr2026/bp2026Targets";
import { krs, type KRDef } from "../okr2026/okrRegistry";
import {
  addMeses,
  listaMeses12,
  rowsParaSeries,
  rowsParaSeriesNullFill,
  rowsParaSerieUnica,
  normalizarNomeSquad,
  encontrarSquadCorrespondente,
  type SeriePonto,
  type SeriePontoNullable,
  type SerieRow,
  type SerieValorRow,
} from "./scorecard.helpers";

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

export interface ScorecardMetasResult {
  metas: Record<string, ScorecardMeta>;
}

const MES_REGEX = /^\d{4}-\d{2}$/;

/**
 * Overrides fixos que não vêm do BP2026 nem do OKR (ex: metas manuais/negociadas
 * fora dos dois sistemas de planejamento).
 */
const OVERRIDES: Record<string, ScorecardMeta> = {
  receita_cabeca: {
    valor: 20000,
    unit: "BRL",
    direction: "up",
    origem: "override",
    label: "Receita por Cabeça",
  },
};

function quarterFromMes(mes: string): "Q1" | "Q2" | "Q3" | "Q4" | null {
  const mm = parseInt(mes.slice(5, 7), 10);
  if (!mm || mm < 1 || mm > 12) return null;
  if (mm <= 3) return "Q1";
  if (mm <= 6) return "Q2";
  if (mm <= 9) return "Q3";
  return "Q4";
}

function krDirectionToScorecard(direction: KRDef["direction"]): ScorecardDirection {
  return direction === "gte" ? "up" : "down";
}

/**
 * Mensaliza o target trimestral do KR de acordo com sua agregação:
 * - quarter_sum: o target é a soma do trimestre → divide por 3 para virar meta mensal.
 * - quarter_avg / quarter_end / quarter_max / quarter_min: o target já representa
 *   o valor esperado em qualquer ponto do trimestre → mantém como está.
 */
function mensalizarTargetOkr(kr: KRDef, valorTrimestre: number): number {
  if (kr.aggregation === "quarter_sum") {
    return valorTrimestre / 3;
  }
  return valorTrimestre;
}

/**
 * Monta o mapa de metas consolidadas (BP2026 + OKR) para um mês (YYYY-MM).
 * Função pura: não acessa banco nem I/O — lê apenas os registries estáticos.
 *
 * Regra de precedência quando a mesma metric_key existe nos dois sistemas
 * (ex: mrr_active, ebitda, cash_generation, cash_balance): o BP2026 vence,
 * por ser mensal (mais granular) — o OKR é só trimestral.
 */
export function montarMetasScorecard(mes: string): ScorecardMetasResult {
  const metas: Record<string, ScorecardMeta> = {};

  // BP2026 (months) e OKR 2026 (targets por trimestre) só cobrem o ano de planejamento
  // 2026 — as chaves de `months` são literalmente "2026-XX" (ver bp2026Targets.ts). O
  // seletor de mês do painel lista 12 meses para trás, o que pode incluir meses de 2025;
  // aplicar a meta de 2026 a um mês de 2025 (mesmo trimestre/mês numérico) produz um
  // status falso. Para qualquer ano != 2026 não há meta real — melhor não mostrar
  // nenhuma do que mostrar a errada.
  const anoCobertoPeloPlanejamento = mes.slice(0, 4) === "2026";

  if (anoCobertoPeloPlanejamento) {
    const quarter = quarterFromMes(mes);

    // 1) OKR primeiro (trimestral, mensalizado) — processado antes do BP para que
    //    o BP possa sobrescrever em caso de colisão de metric_key.
    if (quarter) {
      for (const kr of krs) {
        const valorTrimestre = kr.targets[quarter];
        if (valorTrimestre === undefined || valorTrimestre === null) continue;

        metas[kr.metricKey] = {
          valor: mensalizarTargetOkr(kr, valorTrimestre),
          unit: kr.unit,
          direction: krDirectionToScorecard(kr.direction),
          origem: "okr",
          label: kr.title,
        };
      }
    }

    // 2) BP2026 (mensal) — sobrescreve o OKR quando a metric_key colide.
    for (const metric of BP_2026_TARGETS) {
      const valor = metric.months[mes];
      if (valor === undefined || valor === null) continue;

      metas[metric.metric_key] = {
        valor,
        unit: metric.unit,
        // "flat" não tem um equivalente direto em "up"|"down"; tratamos como "up"
        // (neutro) já que o contrato do endpoint só suporta as duas direções.
        direction: metric.direction === "down" ? "down" : "up",
        origem: "bp",
        label: metric.title,
      };
    }
  }

  // 3) Overrides fixos por último — sempre vencem, independente do ano (ex:
  //    receita_cabeca é uma meta fixa negociada fora do BP/OKR).
  for (const [key, meta] of Object.entries(OVERRIDES)) {
    metas[key] = meta;
  }

  return { metas };
}

// ---------------------------------------------------------------------------
// Séries mensais por dimensão (modo Evolução)
// ---------------------------------------------------------------------------

export interface SeriesScorecard {
  churnPorProduto: Record<string, SeriePonto[]>;
  churnPorOperador: Record<string, SeriePonto[]>;
  churnPorSquad: Record<string, SeriePonto[]>;
  /** Churn Recorrente por motivo de cancelamento × mês — Onda D (mesma fonte/exclusões de
     `churnPorProduto`/`churnPorOperador`/`churnPorSquad`: `fetchChurnPorDimensao`, só trocando
     a dimensão para `motivo_cancelamento`). Alimenta a seção "Churn Recorrente — Motivos", que
     antes só tinha o snapshot do mês (sem série) via `/api/churn/produto-motivo`. */
  churnPorMotivo: Record<string, SeriePonto[]>;
  entregasPorOperador: Record<string, SeriePonto[]>;
  /** Entregas pontuais (deploy) por squad × mês — Onda C2, mesmo padrão de
     `entregasPorOperador` trocando a dimensão (ver `fetchEntregasPorSquad`). */
  entregasPorSquad: Record<string, SeriePonto[]>;
  mrrPorSquad: Record<string, SeriePonto[]>;
  mrrPorOperador: Record<string, SeriePonto[]>;
  /** Lead time médio de entrega (dias) por produto × mês — Onda5. Meses sem entrega ficam
     `null` (não 0, ver `rowsParaSeriesNullFill`). */
  leadTimePorProduto: Record<string, SeriePontoNullable[]>;
  /** Headcount ATIVO por squad ("Inhire".rh_pessoal) — Onda C2. NÃO é uma série mensal (é o
     headcount ATUAL, usado como denominador constante de "Receita por Cabeça por squad") — por
     isso é `Record<squad, number>` em vez de `Record<squad, SeriePonto[]>`. Chaveado pela MESMA
     forma (com emoji) usada em `mrrPorSquad`, para o frontend casar direto sem re-normalizar
     (ver `fetchPessoasPorSquad`). */
  pessoasPorSquad: Record<string, number>;
  /** Estoque pontual (ClickUp, ver `reference_estoque_pontual`) EM ABERTO — `SUM(valorp)` do
     snapshot de FIM DE MÊS de `cup_data_hist` (ESTOQUE, mesmo padrão de `fetchMrrPorDimensao`),
     status fora de {entregue, cancelado/inativo, não usar}. Série ÚNICA (sem dimensão) — Onda D,
     alimenta "Receita — Pontual: Em aberto (estoque)", que antes só tinha o valor atual
     (snapshot em tempo real de `/api/reports/mensal`, sem série mensal). Zero-fill (0 é um saldo
     válido, ver `rowsParaSerieUnica`). */
  estoquePontualEmAbertoPorMes: SeriePonto[];
  /** Como `estoquePontualEmAbertoPorMes`, para o status `pausado` — alimenta "Pausado
     (estoque)". */
  estoquePausadoPorMes: SeriePonto[];
  /** Churn Pontual (Onda D2) — série ÚNICA `SUM(valorp)` por mês, base = `cup_contratos` com
     `servico ILIKE '%entrega%'` e status de churn (mesma definição de `churnPontorrente.ts`/
     `churnPontorrente.helpers.ts:classifySituacao`, mas em SQL direto — sem a granularidade de
     jornada por id_task×produto daquele endpoint, que é o motivo dele não ter série mensal).
     Bucketizada pela data do EVENTO (`data_solicitacao_encerramento`, ver
     `fetchChurnPontualPorDimensao`). Zero-fill (ver `rowsParaSerieUnica`). Alimenta a linha
     "Churn confirmado (R$)" de "Churn Pontual — Geral" — o `atual` continua vindo do overview
     cohort-based de `/api/churn-pontorrente` (só a `serie` é nova; não precisam reconciliar
     mês a mês, mesma tolerância já aceita em "Churn R$" do Recorrente-Geral). */
  churnPontualPorMes: SeriePonto[];
  /** Como `churnPontualPorMes`, quebrado por dimensão — mesma base/exclusões, GROUP BY dim×mês
     (ver `fetchChurnPontualPorDimensao`). Alimenta "Churn Pontual — Por produto". */
  churnPontualPorProduto: Record<string, SeriePonto[]>;
  /** Como `churnPontualPorProduto`, dimensão `responsavel` (operacional). Alimenta "Churn
     Pontual — Por operador". */
  churnPontualPorOperador: Record<string, SeriePonto[]>;
  /** Como `churnPontualPorProduto`, dimensão `squad`. Alimenta "Churn Pontual — Por squad". Squad
     cru (sem normalização de emoji) — não precisa casar com outra fonte aqui. */
  churnPontualPorSquad: Record<string, SeriePonto[]>;
  /** Como `churnPontualPorProduto`, dimensão `motivo_cancelamento`. Alimenta "Churn Pontual —
     Motivos". */
  churnPontualPorMotivo: Record<string, SeriePonto[]>;
}

export interface ScorecardSeriesResult {
  series: SeriesScorecard;
}

/** `motivo_cancelamento` (Onda D) reaproveita `fetchChurnPorDimensao` — mesma fonte/exclusões
   das outras dimensões de churn recorrente, só troca a coluna de agrupamento. */
type ChurnDim = "produto" | "responsavel_geral" | "squad" | "motivo_cancelamento";
type MrrDim = "squad" | "responsavel";

/**
 * Churn por dimensão (EVENTO — data de solicitação de encerramento), a partir da view
 * curada `vw_cup_churn_ajustado`. `dim` vem sempre de um literal fixo do nosso código
 * (nunca de input do usuário), então é seguro usar `sql.raw` só para o identificador de
 * coluna — os valores de data seguem parametrizados.
 */
async function fetchChurnPorDimensao(dim: ChurnDim, inicio: string, fim: string): Promise<SerieRow[]> {
  const result = await db.execute(sql`
    SELECT TO_CHAR(DATE_TRUNC('month', data_solicitacao_encerramento),'YYYY-MM') AS mes,
           COALESCE(NULLIF(TRIM(${sql.raw(dim)}),''),'Não Informado') AS dim,
           SUM(valor_r)::numeric AS valor
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE valor_r > 0 AND data_solicitacao_encerramento IS NOT NULL
      AND data_solicitacao_encerramento >= ${inicio}::date AND data_solicitacao_encerramento < ${fim}::date
      AND COALESCE(abonar_churn,'') <> 'Sim'
      AND COALESCE(motivo_cancelamento,'') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
    GROUP BY 1,2
  `);
  return result.rows as unknown as SerieRow[];
}

/** Entregas por operador (FLUXO — data de entrega), a partir de `cup_contratos`. */
async function fetchEntregasPorOperador(inicio: string, fim: string): Promise<SerieRow[]> {
  const result = await db.execute(sql`
    SELECT TO_CHAR(data_entrega,'YYYY-MM') AS mes, TRIM(responsavel) AS dim, SUM(valorp::numeric)::numeric AS valor
    FROM "Clickup".cup_contratos
    WHERE LOWER(TRIM(status))='entregue' AND data_entrega IS NOT NULL
      AND data_entrega >= ${inicio}::date AND data_entrega < ${fim}::date
      AND valorp::numeric > 0 AND responsavel IS NOT NULL AND TRIM(responsavel) <> ''
    GROUP BY 1,2
  `);
  return result.rows as unknown as SerieRow[];
}

/** Entregas por squad (FLUXO — data de entrega), a partir de `cup_contratos` — mesmo padrão de
   `fetchEntregasPorOperador` trocando a dimensão `responsavel` → `squad` (ver
   `relatorioMensalSlides.ts`: "16b. Pontual entregue no mês por squad"). */
async function fetchEntregasPorSquad(inicio: string, fim: string): Promise<SerieRow[]> {
  const result = await db.execute(sql`
    SELECT TO_CHAR(data_entrega,'YYYY-MM') AS mes, TRIM(squad) AS dim, SUM(valorp::numeric)::numeric AS valor
    FROM "Clickup".cup_contratos
    WHERE LOWER(TRIM(status))='entregue' AND data_entrega IS NOT NULL
      AND data_entrega >= ${inicio}::date AND data_entrega < ${fim}::date
      AND valorp::numeric > 0 AND squad IS NOT NULL AND TRIM(squad) <> ''
    GROUP BY 1,2
  `);
  return result.rows as unknown as SerieRow[];
}

/**
 * Headcount ATIVO por squad, a partir de `"Inhire".rh_pessoal` — não é FLUXO nem ESTOQUE
 * histórico, é o headcount de HOJE (usado como denominador de "Receita por Cabeça por squad").
 * `squadsMrr` são as chaves cruas (com emoji) já usadas em `mrrPorSquad` — o resultado sai
 * casado com ELAS (normalização só do lado RH, via `normalizarNomeSquad`/
 * `encontrarSquadCorrespondente`), para o frontend não precisar re-normalizar nada.
 * Squads RH sem squad de receita correspondente (ex: "Vendas", time comercial sem MRR/entregas)
 * ficam de fora do resultado — headcount deles não é atribuível a nenhuma linha do scorecard.
 */
async function fetchPessoasPorSquad(squadsMrr: string[]): Promise<Record<string, number>> {
  const result = await db.execute(sql`
    SELECT TRIM(squad) AS squad, COUNT(*)::int AS pessoas
    FROM "Inhire".rh_pessoal
    WHERE LOWER(TRIM(COALESCE(status, ''))) = 'ativo' AND squad IS NOT NULL AND TRIM(squad) <> ''
    GROUP BY 1
  `);

  const squadsPorNorm = new Map<string, string>();
  for (const squad of squadsMrr) squadsPorNorm.set(normalizarNomeSquad(squad), squad);

  const pessoasPorSquad: Record<string, number> = {};
  for (const row of result.rows as unknown as { squad: string; pessoas: number }[]) {
    const squadRevenue = encontrarSquadCorrespondente(normalizarNomeSquad(row.squad), squadsPorNorm);
    if (!squadRevenue) continue;
    pessoasPorSquad[squadRevenue] = (pessoasPorSquad[squadRevenue] || 0) + Number(row.pessoas);
  }
  return pessoasPorSquad;
}

/**
 * Lead time médio de entrega (dias) por produto × mês, a partir de `cup_contratos`
 * (FLUXO — data de entrega). Mesma definição de lead time do relatório mensal
 * (`relatorioMensalSlides.ts`: `AVG(data_entrega - data_criado)::int`), mas granularizada
 * por mês (a fonte original agrega uma janela fixa de 6 meses, sem série).
 */
async function fetchLeadTimePorProduto(inicio: string, fim: string): Promise<SerieRow[]> {
  const result = await db.execute(sql`
    SELECT TO_CHAR(data_entrega,'YYYY-MM') AS mes,
           COALESCE(NULLIF(TRIM(produto),''),'Sem produto') AS dim,
           AVG(data_entrega - data_criado)::int AS valor
    FROM "Clickup".cup_contratos
    WHERE LOWER(TRIM(status))='entregue' AND data_entrega IS NOT NULL AND data_criado IS NOT NULL
      AND data_entrega >= ${inicio}::date AND data_entrega < ${fim}::date
    GROUP BY 1,2
  `);
  return result.rows as unknown as SerieRow[];
}

/**
 * MRR por dimensão (ESTOQUE — snapshot de fim de mês), a partir de `cup_data_hist`.
 * GOTCHA (ver investigação): `produto` em `cup_data_hist` é instável — por isso este
 * endpoint só expõe `squad` e `responsavel` aqui (MRR por produto usa
 * `/api/lt-ltv-churn/evolucao-produto-tabela`, que reclassifica via `servico`).
 */
async function fetchMrrPorDimensao(dim: MrrDim, inicio: string, fimUltimoMes: string): Promise<SerieRow[]> {
  const result = await db.execute(sql`
    WITH meses AS (
      SELECT to_char(d,'YYYY-MM') AS mes, d::date AS m
      FROM generate_series(${inicio}::date, ${fimUltimoMes}::date, interval '1 month') d
    ),
    snap_ref AS (
      SELECT meses.mes,
        (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE date_trunc('month',data_snapshot)=meses.m) AS snap
      FROM meses
    )
    SELECT sr.mes, COALESCE(NULLIF(TRIM(h.${sql.raw(dim)}),''),'Não Informado') AS dim, SUM(h.valorr)::numeric AS valor
    FROM snap_ref sr JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
    WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0
    GROUP BY 1,2
  `);
  return result.rows as unknown as SerieRow[];
}

/** Linha crua de `fetchEstoquePontualSaldos`: mês + os 2 saldos (sem dimensão). */
interface EstoquePontualSaldoRow {
  mes: string;
  em_aberto: number | string | null;
  pausado: number | string | null;
}

/**
 * Saldos do estoque pontual (ClickUp) EM ABERTO e PAUSADO, por mês (ESTOQUE — snapshot de fim
 * de mês, mesmo padrão de `fetchMrrPorDimensao` trocando `valorr`→`valorp` e a condição de
 * status). Onda D. Definição canônica de estoque pontual (`reference_estoque_pontual`, mesma de
 * `server/routes/estoquePontual.ts`): `valorp > 0 AND status NOT IN ('entregue',
 * 'cancelado/inativo','não usar')`. "Pausado" é o subconjunto com `status = 'pausado'` (já
 * incluso no "em aberto" — não são mutuamente exclusivos, o pausado é uma quebra editorial do
 * em aberto, não um segundo estoque somado a ele).
 *
 * IMPORTANTE (perf): `sr.snap` (a subquery correlacionada de `snap_ref`) é referenciada
 * APENAS na condição do JOIN — nunca no SELECT/GROUP BY. Como a CTE não é `MATERIALIZED`, o
 * planner inlina a expressão e a reavalia em cada lugar onde `sr.snap` aparece; incluí-la no
 * SELECT/GROUP BY (ex.: para debug) faz o Postgres reavaliar a subquery uma vez por linha do
 * produto cartesiano intermediário (~11 meses × milhares de linhas de `cup_data_hist`) em vez de
 * uma vez por mês — de ~400ms para minutos em teste local. Os dois saldos (em_aberto/pausado)
 * saem de UMA passada só pelo JOIN (via `FILTER`), não de duas queries separadas.
 */
async function fetchEstoquePontualSaldos(inicio: string, fimUltimoMes: string): Promise<EstoquePontualSaldoRow[]> {
  const result = await db.execute(sql`
    WITH meses AS (
      SELECT to_char(d,'YYYY-MM') AS mes, d::date AS m
      FROM generate_series(${inicio}::date, ${fimUltimoMes}::date, interval '1 month') d
    ),
    snap_ref AS (
      SELECT meses.mes,
        (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE date_trunc('month',data_snapshot)=meses.m) AS snap
      FROM meses
    )
    SELECT sr.mes,
      SUM(h.valorp) FILTER (WHERE LOWER(TRIM(h.status)) NOT IN ('entregue','cancelado/inativo','não usar'))::numeric AS em_aberto,
      SUM(h.valorp) FILTER (WHERE LOWER(TRIM(h.status)) = 'pausado')::numeric AS pausado
    FROM snap_ref sr JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
    WHERE h.valorp > 0
    GROUP BY sr.mes
  `);
  return result.rows as unknown as EstoquePontualSaldoRow[];
}

/** `dim` do Churn Pontual (Onda D2) — sempre um literal fixo do nosso código (nunca input do
   usuário), mesmo cuidado de `ChurnDim`/`fetchChurnPorDimensao` acima. */
type ChurnPontualDim = "produto" | "responsavel" | "squad" | "motivo_cancelamento";

/**
 * Churn Pontual por dimensão (EVENTO — data de solicitação de encerramento), a partir de
 * `"Clickup".cup_contratos` diretamente. Base = `servico ILIKE '%entrega%'` (mesma condição de
 * `churnPontorrente.ts:34`); churn = `LOWER(TRIM(status)) IN ('cancelado/inativo','não usar')`
 * (mesma regra de `churnPontorrente.helpers.ts:classifySituacao`); valor = `valorp`. Usa
 * `data_solicitacao_encerramento` (não `data_encerramento`) como data do evento — mesma coluna
 * que `churnPontorrente.ts` expõe como "dataEncerramento" no detalhamento e mesma coluna que
 * `fetchChurnPorDimensao` (Churn Recorrente) usa para bucketizar por mês, mantendo as duas
 * famílias de série (recorrente e pontual) na mesma convenção de data de evento.
 *
 * Não reaproveita `toJornadas`/`aggregateChurnPorDimensao` de `churnPontorrente.helpers.ts` de
 * propósito: aquela lógica agrupa por jornada (id_task×produto) e restringe a
 * `PRODUTOS_PONTORRENTE`/linhas com nível de entrega reconhecível no `servico` — útil para o
 * funil de retenção, mas SQL direto aqui é suficiente para uma série mensal de valor.
 */
async function fetchChurnPontualPorDimensao(dim: ChurnPontualDim, inicio: string, fim: string): Promise<SerieRow[]> {
  const result = await db.execute(sql`
    SELECT TO_CHAR(DATE_TRUNC('month', data_solicitacao_encerramento),'YYYY-MM') AS mes,
           COALESCE(NULLIF(TRIM(${sql.raw(dim)}),''),'Não Informado') AS dim,
           SUM(valorp)::numeric AS valor
    FROM "Clickup".cup_contratos
    WHERE servico ILIKE '%entrega%'
      AND LOWER(TRIM(status)) IN ('cancelado/inativo','não usar')
      AND valorp > 0
      AND data_solicitacao_encerramento IS NOT NULL
      AND data_solicitacao_encerramento >= ${inicio}::date AND data_solicitacao_encerramento < ${fim}::date
    GROUP BY 1,2
  `);
  return result.rows as unknown as SerieRow[];
}

/** Série ÚNICA (sem dimensão) do Churn Pontual — mesma base/exclusões de
   `fetchChurnPontualPorDimensao`, sem o `GROUP BY dim`. */
async function fetchChurnPontualPorMes(inicio: string, fim: string): Promise<SerieValorRow[]> {
  const result = await db.execute(sql`
    SELECT TO_CHAR(DATE_TRUNC('month', data_solicitacao_encerramento),'YYYY-MM') AS mes,
           SUM(valorp)::numeric AS valor
    FROM "Clickup".cup_contratos
    WHERE servico ILIKE '%entrega%'
      AND LOWER(TRIM(status)) IN ('cancelado/inativo','não usar')
      AND valorp > 0
      AND data_solicitacao_encerramento IS NOT NULL
      AND data_solicitacao_encerramento >= ${inicio}::date AND data_solicitacao_encerramento < ${fim}::date
    GROUP BY 1
  `);
  return result.rows as unknown as SerieValorRow[];
}

/**
 * Monta as séries mensais por dimensão do modo Evolução, para a janela de 12 meses
 * terminando em `mes` (inclusive). Cada série vem com os 12 meses preenchidos (0 onde
 * não há dado) — ver `rowsParaSeries`. Exceção: `pessoasPorSquad` não é série (é headcount
 * ATUAL, ver `fetchPessoasPorSquad`).
 */
export async function montarSeriesScorecard(mes: string): Promise<ScorecardSeriesResult> {
  const meses = listaMeses12(mes);
  const inicio = `${meses[0]}-01`;
  const fim = `${addMeses(mes, 1)}-01`;
  const fimUltimoMes = `${mes}-01`;

  const [
    churnProdutoRows,
    churnOperadorRows,
    churnSquadRows,
    churnMotivoRows,
    entregasRows,
    entregasSquadRows,
    mrrSquadRows,
    mrrOperadorRows,
    leadTimeRows,
    estoquePontualRows,
    churnPontualMesRows,
    churnPontualProdutoRows,
    churnPontualOperadorRows,
    churnPontualSquadRows,
    churnPontualMotivoRows,
  ] = await Promise.all([
    fetchChurnPorDimensao("produto", inicio, fim),
    fetchChurnPorDimensao("responsavel_geral", inicio, fim),
    fetchChurnPorDimensao("squad", inicio, fim),
    fetchChurnPorDimensao("motivo_cancelamento", inicio, fim),
    fetchEntregasPorOperador(inicio, fim),
    fetchEntregasPorSquad(inicio, fim),
    fetchMrrPorDimensao("squad", inicio, fimUltimoMes),
    fetchMrrPorDimensao("responsavel", inicio, fimUltimoMes),
    fetchLeadTimePorProduto(inicio, fim),
    fetchEstoquePontualSaldos(inicio, fimUltimoMes),
    fetchChurnPontualPorMes(inicio, fim),
    fetchChurnPontualPorDimensao("produto", inicio, fim),
    fetchChurnPontualPorDimensao("responsavel", inicio, fim),
    fetchChurnPontualPorDimensao("squad", inicio, fim),
    fetchChurnPontualPorDimensao("motivo_cancelamento", inicio, fim),
  ]);

  const mrrPorSquad = rowsParaSeries(mrrSquadRows, meses);
  // Depende das chaves de `mrrPorSquad` (squad cru, com emoji) para casar o headcount RH —
  // por isso roda depois do Promise.all acima, não dentro dele.
  const pessoasPorSquad = await fetchPessoasPorSquad(Object.keys(mrrPorSquad));

  return {
    series: {
      churnPorProduto: rowsParaSeries(churnProdutoRows, meses),
      churnPorOperador: rowsParaSeries(churnOperadorRows, meses),
      churnPorSquad: rowsParaSeries(churnSquadRows, meses),
      churnPorMotivo: rowsParaSeries(churnMotivoRows, meses),
      entregasPorOperador: rowsParaSeries(entregasRows, meses),
      entregasPorSquad: rowsParaSeries(entregasSquadRows, meses),
      mrrPorSquad,
      mrrPorOperador: rowsParaSeries(mrrOperadorRows, meses),
      estoquePontualEmAbertoPorMes: rowsParaSerieUnica(
        estoquePontualRows.map((r) => ({ mes: r.mes, valor: r.em_aberto })),
        meses,
      ),
      estoquePausadoPorMes: rowsParaSerieUnica(
        estoquePontualRows.map((r) => ({ mes: r.mes, valor: r.pausado })),
        meses,
      ),
      leadTimePorProduto: rowsParaSeriesNullFill(leadTimeRows, meses),
      pessoasPorSquad,
      churnPontualPorMes: rowsParaSerieUnica(churnPontualMesRows, meses),
      churnPontualPorProduto: rowsParaSeries(churnPontualProdutoRows, meses),
      churnPontualPorOperador: rowsParaSeries(churnPontualOperadorRows, meses),
      churnPontualPorSquad: rowsParaSeries(churnPontualSquadRows, meses),
      churnPontualPorMotivo: rowsParaSeries(churnPontualMotivoRows, meses),
    },
  };
}

export function registerScorecardRoutes(app: Express) {
  app.get("/api/scorecard/metas", isAuthenticated, (req, res) => {
    const mes = req.query.mes as string | undefined;

    if (!mes || !MES_REGEX.test(mes)) {
      return res.status(400).json({ error: "Parâmetro 'mes' inválido. Use o formato YYYY-MM." });
    }

    try {
      const result = montarMetasScorecard(mes);
      res.json(result);
    } catch (error) {
      console.error("[api] Error building scorecard metas:", error);
      res.status(500).json({ error: "Failed to build scorecard metas" });
    }
  });

  // Séries mensais por dimensão (modo Evolução) — janela de 12 meses até `mes`, inclusive.
  app.get("/api/scorecard/series", isAuthenticated, async (req, res) => {
    const mes = req.query.mes as string | undefined;

    if (!mes || !MES_REGEX.test(mes)) {
      return res.status(400).json({ error: "Parâmetro 'mes' inválido. Use o formato YYYY-MM." });
    }

    try {
      const result = await montarSeriesScorecard(mes);
      res.json(result);
    } catch (error) {
      console.error("[api] Error building scorecard series:", error);
      res.status(500).json({ error: "Failed to build scorecard series" });
    }
  });

  // Responsáveis editáveis por métrica (quem é o dono de cada metric_key no scorecard).
  app.get("/api/scorecard/responsaveis", isAuthenticated, async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT metrica_key, responsavel
        FROM cortex_core.scorecard_responsaveis
      `);
      const itens = result.rows.map((row: any) => ({
        metrica_key: row.metrica_key as string,
        responsavel: row.responsavel as string | null,
      }));
      res.json({ itens });
    } catch (error) {
      console.error("[api] Error em GET /api/scorecard/responsaveis:", error);
      res.status(500).json({ error: "Falha ao buscar responsáveis do scorecard" });
    }
  });

  app.put("/api/scorecard/responsaveis", isAuthenticated, async (req, res) => {
    try {
      const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
      const validos = itens.filter(
        (item: any) => typeof item?.metrica_key === "string" && item.metrica_key.trim().length > 0
      );

      for (const item of validos) {
        const responsavel = typeof item.responsavel === "string" ? item.responsavel : null;
        await db.execute(sql`
          INSERT INTO cortex_core.scorecard_responsaveis (metrica_key, responsavel, atualizado_em)
          VALUES (${item.metrica_key}, ${responsavel}, NOW())
          ON CONFLICT (metrica_key) DO UPDATE SET responsavel = EXCLUDED.responsavel, atualizado_em = NOW()
        `);
      }

      res.json({ ok: true, salvos: validos.length });
    } catch (error) {
      console.error("[api] Error em PUT /api/scorecard/responsaveis:", error);
      res.status(500).json({ error: "Falha ao salvar responsáveis do scorecard" });
    }
  });
}

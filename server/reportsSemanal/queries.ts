// Queries de série da tela /reports/semanal, todas parametrizadas por
// (inicio, fim) da semana. Vendas e cross-sell NÃO estão aqui: vêm de
// server/crm/expansao.ts, compartilhado com a mensagem diária dos líderes.
//
// Snapshots: sempre `MAX(data_snapshot) <= data`, nunca igualdade com o dia
// exato — cup_data_hist tem semanas com 6 de 7 dias, e exigir o domingo
// preciso zeraria a carteira dessas semanas em silêncio.
//
// Decisão deliberada: nenhuma query aqui tem try/catch. Uma falha transitória
// numa semana derruba a série inteira (HTTP 500), em vez de devolver aquela
// semana zerada em silêncio. Para uma tela cujo único valor é números que a
// liderança confia de cabeça, um erro visível é preferível a uma linha zerada
// plausível — o contrário do que decidimos para `vendasPorChannel`
// (server/crm/expansao.ts), que TOLERA a própria falha e devolve zeros com
// `erro: true` porque a mensagem diária do WhatsApp precisa sair mesmo assim,
// com um aviso visível em vez de travar o envio inteiro. Mesma preocupação
// (não mentir com um zero), resposta oposta, porque o produto é diferente:
// tabela auditável vs. mensagem que precisa sair. Não "consertar" isto
// adicionando catch silencioso.
import { sql } from "drizzle-orm";
import { MOTIVOS_EXCLUIDOS_CHURN_AJUSTADO } from "../../shared/churn-motivos";

export interface Carteira {
  triagemOnboarding: number;
  ativo: number;
  emCancelamento: number;
}

export interface Base {
  mrr: number;
  pontual: number;
}

export interface ChurnValores {
  total: number;
  ajustado: number;
}

export interface LinhaDetalhe {
  cliente: string;
  valor: number;
  motivo: string | null;
  abonado: boolean;
}

// Motivos que o "ajustado" exclui: são erro de venda/começo, não churn real.
// Lista em shared/churn-motivos.ts — compartilhada com server/services/resumoLideres.ts,
// que precisa da MESMA régua. Mesmo predicado SQL de antes, só a origem da lista mudou.
const MOTIVOS_EXCLUIDOS = sql`(${sql.join(
  MOTIVOS_EXCLUIDOS_CHURN_AJUSTADO.map((m) => sql`${m}`),
  sql`, `,
)})`;

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Foto da carteira no último snapshot <= fim da semana. */
export async function carteiraNoFim(db: any, fim: string): Promise<Carteira> {
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    )
    SELECT
      COALESCE(SUM(h.valorr::numeric) FILTER (WHERE h.status IN ('triagem','onboarding')), 0) AS triagem_onboarding,
      COALESCE(SUM(h.valorr::numeric) FILTER (WHERE h.status = 'ativo'), 0) AS ativo,
      COALESCE(SUM(h.valorr::numeric) FILTER (WHERE h.status = 'em cancelamento'), 0) AS em_cancelamento
    FROM "Clickup".cup_data_hist h, snap
    WHERE h.data_snapshot = snap.d
  `);
  const row = (r.rows ?? [])[0] as any;
  return {
    triagemOnboarding: num(row?.triagem_onboarding),
    ativo: num(row?.ativo),
    emCancelamento: num(row?.em_cancelamento),
  };
}

/**
 * Bases dos percentuais: último snapshot ANTES da segunda-feira da semana —
 * o fechamento da semana anterior. Uma query só devolve as duas bases.
 */
export async function baseNaAbertura(db: any, inicio: string): Promise<Base> {
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot < ${inicio}::date
    )
    SELECT
      COALESCE(SUM(h.valorr::numeric) FILTER (WHERE h.status IN ('triagem','onboarding','ativo')), 0) AS mrr,
      COALESCE(SUM(h.valorp::numeric) FILTER (
        WHERE h.valorp > 0 AND h.status NOT IN ('entregue','cancelado/inativo','não usar')
      ), 0) AS pontual
    FROM "Clickup".cup_data_hist h, snap
    WHERE h.data_snapshot = snap.d
  `);
  const row = (r.rows ?? [])[0] as any;
  return { mrr: num(row?.mrr), pontual: num(row?.pontual) };
}

/**
 * Pontual que PASSOU a 'entregue' durante a semana: está 'entregue' no
 * snapshot de fechamento e não estava (ou nem existia) no de abertura.
 */
export async function entregaPontualNaSemana(db: any, inicio: string, fim: string): Promise<number> {
  const r: any = await db.execute(sql`
    WITH snap_fim AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    ),
    snap_ini AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot < ${inicio}::date
    ),
    entregue_fim AS (
      SELECT h.id_subtask, h.valorp
      FROM "Clickup".cup_data_hist h, snap_fim
      WHERE h.data_snapshot = snap_fim.d AND h.status = 'entregue' AND h.valorp > 0
    )
    SELECT COALESCE(SUM(e.valorp::numeric), 0) AS total
    FROM entregue_fim e
    LEFT JOIN "Clickup".cup_data_hist i
      ON i.id_subtask = e.id_subtask AND i.data_snapshot = (SELECT d FROM snap_ini)
    WHERE i.status IS DISTINCT FROM 'entregue'
  `);
  return num((r.rows ?? [])[0]?.total);
}

/** Churn de MRR por data do pedido de encerramento, bruto e ajustado. */
export async function churnMrrNaSemana(db: any, inicio: string, fim: string): Promise<ChurnValores> {
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(SUM(valor_r), 0) AS total,
      COALESCE(SUM(valor_r) FILTER (
        WHERE COALESCE(motivo_cancelamento, '') NOT IN ${MOTIVOS_EXCLUIDOS}
      ), 0) AS ajustado
    FROM "Clickup".cup_churn
    WHERE data_solicitacao_encerramento >= ${inicio}::date
      AND data_solicitacao_encerramento <= ${fim}::date
  `);
  const row = (r.rows ?? [])[0] as any;
  return { total: num(row?.total), ajustado: num(row?.ajustado) };
}

/** Churn pontual: cup_churn não tem valor_p, ele vem do contrato via id_subtask. */
export async function churnPontualNaSemana(db: any, inicio: string, fim: string): Promise<ChurnValores> {
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(SUM(ct.valorp), 0) AS total,
      COALESCE(SUM(ct.valorp) FILTER (
        WHERE COALESCE(ch.motivo_cancelamento, '') NOT IN ${MOTIVOS_EXCLUIDOS}
      ), 0) AS ajustado
    FROM "Clickup".cup_churn ch
    JOIN "Clickup".cup_contratos ct ON ct.id_subtask = ch.task_id AND ct.valorp > 0
    WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
      AND ch.data_solicitacao_encerramento <= ${fim}::date
  `);
  const row = (r.rows ?? [])[0] as any;
  return { total: num(row?.total), ajustado: num(row?.ajustado) };
}

// ============================================
// Queries GÊMEAS do drill.
// Cada uma repete o filtro da query de série correspondente. ⚠️ Se um filtro
// mudar, o par TEM que mudar junto, senão o drawer deixa de somar a célula.
// ============================================

/**
 * Gêmea de churnMrrNaSemana — `apenasAjustado=false` é a gêmea de `.total`,
 * `apenasAjustado=true` é a gêmea de `.ajustado` (mesmo filtro de motivo que
 * a query de série aplica no campo `ajustado`). Sem default: quem chama
 * declara qual célula está detalhando.
 */
export async function detalheChurnMrr(
  db: any,
  inicio: string,
  fim: string,
  apenasAjustado: boolean,
): Promise<LinhaDetalhe[]> {
  const filtroAjustado = apenasAjustado
    ? sql`COALESCE(motivo_cancelamento, '') NOT IN ${MOTIVOS_EXCLUIDOS}`
    : sql`TRUE`;
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(nome), ''), 'Sem nome') AS cliente,
      COALESCE(valor_r, 0) AS valor,
      NULLIF(TRIM(COALESCE(motivo_cancelamento, '')), '') AS motivo,
      (COALESCE(abonar_churn, '') = 'Sim') AS abonado
    FROM "Clickup".cup_churn
    WHERE data_solicitacao_encerramento >= ${inicio}::date
      AND data_solicitacao_encerramento <= ${fim}::date
      AND ${filtroAjustado}
    ORDER BY valor_r DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: x.abonado === true,
  }));
}

/**
 * Gêmea de churnPontualNaSemana — `apenasAjustado=false` é a gêmea de
 * `.total`, `apenasAjustado=true` é a gêmea de `.ajustado` (mesmo filtro de
 * motivo que a query de série aplica no campo `ajustado`). Sem default: quem
 * chama declara qual célula está detalhando.
 */
export async function detalheChurnPontual(
  db: any,
  inicio: string,
  fim: string,
  apenasAjustado: boolean,
): Promise<LinhaDetalhe[]> {
  const filtroAjustado = apenasAjustado
    ? sql`COALESCE(ch.motivo_cancelamento, '') NOT IN ${MOTIVOS_EXCLUIDOS}`
    : sql`TRUE`;
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(ch.nome), ''), 'Sem nome') AS cliente,
      COALESCE(ct.valorp, 0) AS valor,
      NULLIF(TRIM(COALESCE(ch.motivo_cancelamento, '')), '') AS motivo,
      (COALESCE(ch.abonar_churn, '') = 'Sim') AS abonado
    FROM "Clickup".cup_churn ch
    JOIN "Clickup".cup_contratos ct ON ct.id_subtask = ch.task_id AND ct.valorp > 0
    WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
      AND ch.data_solicitacao_encerramento <= ${fim}::date
      AND ${filtroAjustado}
    ORDER BY ct.valorp DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: x.abonado === true,
  }));
}

/** Gêmea de entregaPontualNaSemana. */
export async function detalheEntregaPontual(db: any, inicio: string, fim: string): Promise<LinhaDetalhe[]> {
  const r: any = await db.execute(sql`
    WITH snap_fim AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    ),
    snap_ini AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot < ${inicio}::date
    ),
    entregue_fim AS (
      SELECT h.id_subtask, h.id_task, h.valorp
      FROM "Clickup".cup_data_hist h, snap_fim
      WHERE h.data_snapshot = snap_fim.d AND h.status = 'entregue' AND h.valorp > 0
    )
    SELECT
      COALESCE(NULLIF(TRIM(cl.nome), ''), 'Sem nome') AS cliente,
      COALESCE(e.valorp, 0) AS valor
    FROM entregue_fim e
    LEFT JOIN "Clickup".cup_data_hist i
      ON i.id_subtask = e.id_subtask AND i.data_snapshot = (SELECT d FROM snap_ini)
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = e.id_task
    WHERE i.status IS DISTINCT FROM 'entregue'
    ORDER BY e.valorp DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: null,
    abonado: false,
  }));
}

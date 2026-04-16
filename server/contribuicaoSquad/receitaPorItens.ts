import { sql } from 'drizzle-orm';
import { db } from '../db';

/** Parcela é considerada coberta pelo pipeline novo quando >= 99% do valor_pago foi atribuído aos itens. */
const COVERAGE_THRESHOLD = 0.99;

/** Label usado para itens que não casaram com nenhum contrato do ClickUp.
 *  If you change SEM_SQUAD_LABEL, update the literal in the orfaos CTE below. */
export const SEM_SQUAD_LABEL = '⚠️ Sem Squad';

// Stopwords list — MUST stay in sync with STOPWORDS in matchPipeline.ts.
// Interpolated as raw SQL because Drizzle can't parameterize an IN list well.
const STOPWORDS_SQL = sql.raw(
  `('para','com','por','sem','dos','das','mes','fee','uma',` +
  `'starter','scale','enterprise','standard','premium',` +
  `'pontual','recorrente','mensal','entrega','implantacao')`
);

type ReceitaItemRow = {
  parcela_id: string;
  item_id: string;
  cnpj_limpo: string;
  cliente_nome: string;
  mes: string;
  item_raw: string;
  item_total: string | number;
  id_subtask: string | null;
  squad: string;
  contrato_raw: string | null;
  prioridade: number | null;
};

export interface ReceitaItemLinha {
  parcelaId: string;
  itemId: string;
  cnpjLimpo: string;
  clienteNome: string;
  mes: string;              // 'YYYY-MM'
  itemRaw: string;          // nome do item
  itemTotal: number;        // valor atribuído
  idSubtask: string | null; // contrato do ClickUp que casou (null para órfão)
  squad: string;            // nome do squad (ou '⚠️ Sem Squad')
  contratoRaw: string | null;
  prioridade: number | null; // 1=exato, 2=substring, 3=alias, 4=token, 5=fuzzy, null=órfão
}

/**
 * Retorna uma linha por (parcela_id, item_id) com o squad atribuído.
 * Cobre apenas parcelas com venda_id populado (VENDA / VENDA_AGENDADA).
 * Parcelas sem venda_id ficam para o fallback do simulador A3.
 */
export async function getReceitaPorItens(ano: number): Promise<ReceitaItemLinha[]> {
  const result = await db.execute(sql`
    WITH
    parcelas_ano AS (
      SELECT
        p.id AS parcela_id,
        p.venda_id,
        p.empresa,
        p.valor_pago::numeric AS valor_pago,
        TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes,
        cc.nome AS cliente_nome,
        REPLACE(REPLACE(REPLACE(COALESCE(cc.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo
      FROM "Conta Azul".caz_parcelas p
      JOIN "Conta Azul".caz_clientes cc
        ON TRIM(p.id_cliente::text) = TRIM(cc.ids::text)
      WHERE p.tipo_evento = 'RECEITA'
        AND p.status = 'QUITADO'
        AND p.venda_origem IN ('VENDA','VENDA_AGENDADA')
        AND p.venda_id IS NOT NULL
        AND EXTRACT(YEAR FROM p.data_quitacao) = ${ano}
        AND cc.cnpj IS NOT NULL AND TRIM(cc.cnpj) != ''
    ),
    itens AS (
      SELECT
        pa.parcela_id, pa.cnpj_limpo, pa.cliente_nome, pa.mes, pa.valor_pago,
        i.id AS item_id,
        i.nome AS item_raw,
        -- Rateio proporcional: a parcela leva sua fração dos itens da venda.
        -- Ex: venda R$ 12k em 12 parcelas de R$ 1k → cada parcela leva 1/12 dos itens.
        -- Fallback: se v.total é NULL/0, mantém item_total cru (degrada graciosamente).
        CASE
          WHEN COALESCE(v.total, 0) > 0
            THEN ((i.valor * i.quantidade) * (pa.valor_pago / v.total))::numeric
          ELSE (i.valor * i.quantidade)::numeric
        END AS item_total,
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(unaccent(i.nome)), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g')) AS item_norm,
        REGEXP_REPLACE(LOWER(unaccent(i.nome)), '[^a-z0-9]', '', 'g') AS item_compact
      FROM parcelas_ano pa
      JOIN "Conta Azul".caz_vendas_itens i
        ON CAST(i.venda_id AS text) = CAST(pa.venda_id AS text)
       AND i.empresa = pa.empresa
      LEFT JOIN "Conta Azul".caz_vendas v
        ON CAST(v.id AS text) = CAST(pa.venda_id AS text)
    ),
    itens_tok AS (
      SELECT i.*,
        COALESCE((
          SELECT array_agg(t)
          FROM unnest(string_to_array(i.item_norm, ' ')) AS t
          WHERE LENGTH(t) >= 3
            AND t NOT IN ${STOPWORDS_SQL}
        ), ARRAY[]::text[]) AS item_tokens
      FROM itens i
    ),
    contratos AS (
      SELECT
        REPLACE(REPLACE(REPLACE(COALESCE(cl.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo,
        ct.id_subtask,
        ct.servico AS contrato_raw,
        COALESCE(NULLIF(TRIM(ct.squad), ''), '⚠️ Sem Squad') AS squad,
        GREATEST(COALESCE(ct.valorr::numeric, 0), COALESCE(ct.valorp::numeric, 0)) AS contrato_valor,
        CASE
          WHEN COALESCE(ct.valorr::numeric, 0) > 0 OR COALESCE(ct.valorp::numeric, 0) > 0 THEN 1
          ELSE 0
        END AS is_ativo,
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(unaccent(ct.servico)), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g')) AS contrato_norm,
        REGEXP_REPLACE(LOWER(unaccent(ct.servico)), '[^a-z0-9]', '', 'g') AS contrato_compact
      FROM "Clickup".cup_clientes cl
      JOIN "Clickup".cup_contratos ct ON cl.task_id = ct.id_task
      WHERE ct.servico IS NOT NULL AND TRIM(ct.servico) != ''
        AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) != ''
    ),
    contratos_tok AS (
      SELECT c.*,
        COALESCE((
          SELECT array_agg(t)
          FROM unnest(string_to_array(c.contrato_norm, ' ')) AS t
          WHERE LENGTH(t) >= 3
            AND t NOT IN ${STOPWORDS_SQL}
        ), ARRAY[]::text[]) AS contrato_tokens
      FROM contratos c
    ),
    aliases AS (
      SELECT item_pattern, target_token
      FROM cortex_core.item_alias_map
      WHERE active = true
    ),
    candidatos AS (
      SELECT
        i.parcela_id, i.item_id, i.cnpj_limpo, i.cliente_nome, i.mes, i.item_raw, i.item_total,
        c.id_subtask, c.squad, c.contrato_raw, c.contrato_valor,
        CASE
          WHEN c.contrato_norm = i.item_norm THEN 1
          WHEN c.contrato_compact LIKE '%' || i.item_compact || '%'
            OR i.item_compact LIKE '%' || c.contrato_compact || '%' THEN 2
          WHEN EXISTS (
                 SELECT 1 FROM aliases a
                 WHERE i.item_norm LIKE '%' || a.item_pattern || '%'
                   AND a.target_token = ANY(c.contrato_tokens)
               ) THEN 3
          WHEN c.contrato_tokens && i.item_tokens THEN 4
          WHEN similarity(c.contrato_norm, i.item_norm) >= 0.4 THEN 5
          ELSE NULL
        END AS prioridade
      FROM itens_tok i
      LEFT JOIN contratos_tok c ON c.cnpj_limpo = i.cnpj_limpo
    ),
    melhor AS (
      SELECT DISTINCT ON (parcela_id, item_id)
        parcela_id::text, item_id::text, cnpj_limpo, cliente_nome, mes, item_raw, item_total::float8,
        id_subtask::text, squad, contrato_raw, prioridade
      FROM candidatos
      WHERE prioridade IS NOT NULL
      ORDER BY parcela_id, item_id, prioridade ASC, is_ativo DESC, contrato_valor DESC NULLS LAST
    ),
    orfaos AS (
      SELECT DISTINCT
        i.parcela_id::text, i.item_id::text, i.cnpj_limpo, i.cliente_nome, i.mes, i.item_raw, i.item_total::float8,
        NULL::text AS id_subtask,
        '⚠️ Sem Squad'::text AS squad,
        NULL::text AS contrato_raw,
        NULL::int AS prioridade
      FROM itens_tok i
      WHERE NOT EXISTS (
        SELECT 1 FROM candidatos c
        WHERE c.parcela_id = i.parcela_id
          AND c.item_id = i.item_id
          AND c.prioridade IS NOT NULL
      )
    )
    SELECT parcela_id, item_id, cnpj_limpo, cliente_nome, mes, item_raw, item_total,
           id_subtask, squad, contrato_raw, prioridade
    FROM melhor
    UNION ALL
    SELECT parcela_id, item_id, cnpj_limpo, cliente_nome, mes, item_raw, item_total,
           id_subtask, squad, contrato_raw, prioridade
    FROM orfaos
  `);

  return (result.rows as ReceitaItemRow[]).map((row): ReceitaItemLinha => ({
    parcelaId: row.parcela_id,
    itemId: row.item_id,
    cnpjLimpo: row.cnpj_limpo ?? '',
    clienteNome: row.cliente_nome,
    mes: row.mes,
    itemRaw: row.item_raw,
    itemTotal: Number(row.item_total) || 0,
    idSubtask: row.id_subtask ?? null,
    squad: row.squad,
    contratoRaw: row.contrato_raw ?? null,
    prioridade: row.prioridade != null ? Number(row.prioridade) : null,
  }));
}

/**
 * Retorna o conjunto de parcela_ids que foram cobertos pelo pipeline novo.
 * Uma parcela é considerada coberta se a soma dos itens atribuídos é ≥ 99% do valor_pago.
 */
export function parcelasCobertas(
  linhas: ReceitaItemLinha[],
  parcelaValor: Map<string, number>
): Set<string> {
  const somaPorParcela = new Map<string, number>();
  for (const l of linhas) {
    somaPorParcela.set(l.parcelaId, (somaPorParcela.get(l.parcelaId) || 0) + l.itemTotal);
  }
  const cobertas = new Set<string>();
  for (const [parcelaId, soma] of Array.from(somaPorParcela.entries())) {
    const valor = parcelaValor.get(parcelaId) || 0;
    if (valor > 0 && soma >= valor * COVERAGE_THRESHOLD) cobertas.add(parcelaId);
  }
  return cobertas;
}

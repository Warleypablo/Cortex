import { sql } from 'drizzle-orm';
import { db } from '../db';

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
  causa: 'match' | 'fallback_maior_valor' | 'cnpj_sem_contrato_clickup' | 'item_nao_casou' | 'parcela_sem_itens' | 'lancamento_avulso';
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
  causa: 'match' | 'fallback_maior_valor' | 'cnpj_sem_contrato_clickup' | 'item_nao_casou' | 'parcela_sem_itens' | 'lancamento_avulso';
}

/**
 * Retorna uma linha por (parcela_id, item_id) com o squad atribuído.
 * Cobre apenas parcelas com venda_id populado (VENDA / VENDA_AGENDADA).
 * Parcelas sem venda_id ficam para o fallback do simulador A3.
 */
export async function getReceitaPorItens(ano: number): Promise<ReceitaItemLinha[]> {
  const result = await db.execute(sql`
    WITH
    parcelas_todas_ano AS (
      -- TODAS as parcelas RECEITA do ano com cliente identificado.
      -- Inclui LANCAMENTO_FINANCEIRO, RENEGOCIACAO, e VENDA/VENDA_AGENDADA com ou sem itens.
      -- Fonte de verdade para garantir cobertura 100% do que entra no caixa do ano.
      SELECT
        p.id AS parcela_id,
        p.venda_id,
        p.empresa,
        p.venda_origem,
        -- valor_pago descontado (alinha com o cálculo do DFC)
        (COALESCE(p.valor_pago::numeric, 0) - COALESCE(p.desconto::numeric, 0)) AS valor_pago_liquido,
        TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes,
        cc.nome AS cliente_nome,
        REPLACE(REPLACE(REPLACE(COALESCE(cc.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo
      FROM "Conta Azul".caz_parcelas p
      JOIN "Conta Azul".caz_clientes cc
        ON TRIM(p.id_cliente::text) = TRIM(cc.ids::text)
      WHERE p.tipo_evento = 'RECEITA'
        AND p.status IN ('QUITADO', 'RECEBIDO_PARCIAL')
        AND EXTRACT(YEAR FROM p.data_quitacao) = ${ano}
        AND cc.cnpj IS NOT NULL AND TRIM(cc.cnpj) != ''
        AND (COALESCE(p.valor_pago::numeric, 0) - COALESCE(p.desconto::numeric, 0)) > 0
    ),
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
        c.id_subtask, c.squad, c.contrato_raw, c.contrato_valor, c.is_ativo,
        -- Diferença absoluta entre valor pago do item e valor do contrato (usado no desempate)
        ABS(i.item_total - COALESCE(c.contrato_valor, 0)) AS valor_diff_abs,
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
          -- Prioridade 6: match por valor (±5%). Resgata casos onde o nome do item difere
          -- do nome do contrato mas o valor pago bate com o valor de algum contrato do CNPJ.
          WHEN c.contrato_valor > 0
            AND ABS(i.item_total - c.contrato_valor) / NULLIF(i.item_total, 0) <= 0.05 THEN 6
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
      -- Desempate: prioridade ASC > ativo > valor mais próximo do item > maior valor
      ORDER BY parcela_id, item_id, prioridade ASC, is_ativo DESC, valor_diff_abs ASC, contrato_valor DESC NULLS LAST
    ),
    fallback_por_cnpj AS (
      -- Para cada CNPJ, escolhe o contrato ATIVO de maior valor como fallback.
      -- Se o CNPJ não tem contrato ativo, fb.id_subtask será NULL e o item vai para "⚠️ Sem Squad".
      SELECT DISTINCT ON (cnpj_limpo)
        cnpj_limpo, id_subtask, squad, contrato_raw
      FROM contratos_tok
      WHERE is_ativo = 1
      ORDER BY cnpj_limpo, contrato_valor DESC NULLS LAST
    ),
    orfaos AS (
      SELECT DISTINCT
        i.parcela_id::text,
        i.item_id::text,
        i.cnpj_limpo,
        i.cliente_nome,
        i.mes,
        i.item_raw,
        i.item_total::float8,
        fb.id_subtask::text AS id_subtask,
        COALESCE(fb.squad, '⚠️ Sem Squad')::text AS squad,
        fb.contrato_raw::text AS contrato_raw,
        -- prioridade = 99 quando atribuído via fallback (acima de 5 que é o pior match real,
        -- abaixo de NULL que indica órfão verdadeiro). Permite distinguir nas análises.
        CASE WHEN fb.id_subtask IS NOT NULL THEN 99 ELSE NULL END::int AS prioridade
      FROM itens_tok i
      LEFT JOIN fallback_por_cnpj fb ON fb.cnpj_limpo = i.cnpj_limpo
      WHERE NOT EXISTS (
        SELECT 1 FROM candidatos c
        WHERE c.parcela_id = i.parcela_id
          AND c.item_id = i.item_id
          AND c.prioridade IS NOT NULL
      )
    ),
    parcelas_cobertas_por_itens AS (
      -- Parcelas que tiveram pelo menos uma linha em melhor OU orfaos.
      -- Tudo que está aqui já foi atribuído via item (match ou fallback item-level).
      SELECT DISTINCT parcela_id::text AS parcela_id FROM melhor
      UNION
      SELECT DISTINCT parcela_id::text AS parcela_id FROM orfaos
    ),
    parcelas_sem_cobertura AS (
      -- Parcelas RECEITA do ano que NÃO foram cobertas por nenhum item.
      -- Cada uma vira 1 linha sintética atribuída via fallback de maior valor (ou Sem Squad).
      SELECT
        pt.parcela_id::text,
        -- item_id sintético: prefixo "_pwhole_" + parcela_id, para distinguir de itens reais
        ('_pwhole_' || pt.parcela_id)::text AS item_id,
        pt.cnpj_limpo,
        pt.cliente_nome,
        pt.mes,
        -- item_raw descreve a origem
        CASE
          WHEN pt.venda_origem IN ('LANCAMENTO_FINANCEIRO','RENEGOCIACAO')
            THEN '[' || pt.venda_origem || '] (parcela sem itens)'
          ELSE '[Parcela sem itens] venda histórica'
        END AS item_raw,
        pt.valor_pago_liquido AS item_total,
        fb.id_subtask::text AS id_subtask,
        COALESCE(fb.squad, '⚠️ Sem Squad')::text AS squad,
        fb.contrato_raw::text AS contrato_raw,
        -- prioridade 100 = fallback no nível de parcela (acima do 99 que é fallback de item)
        CASE WHEN fb.id_subtask IS NOT NULL THEN 100 ELSE NULL END::int AS prioridade,
        CASE
          WHEN fb.id_subtask IS NULL
            THEN 'cnpj_sem_contrato_clickup'
          WHEN pt.venda_origem IN ('LANCAMENTO_FINANCEIRO','RENEGOCIACAO')
            THEN 'lancamento_avulso'
          ELSE 'parcela_sem_itens'
        END::text AS causa
      FROM parcelas_todas_ano pt
      LEFT JOIN fallback_por_cnpj fb ON fb.cnpj_limpo = pt.cnpj_limpo
      WHERE NOT EXISTS (
        SELECT 1 FROM parcelas_cobertas_por_itens pc
        WHERE pc.parcela_id = pt.parcela_id::text
      )
    )
    SELECT parcela_id, item_id, cnpj_limpo, cliente_nome, mes, item_raw, item_total,
           id_subtask, squad, contrato_raw, prioridade,
           'match'::text AS causa
    FROM melhor
    UNION ALL
    SELECT parcela_id, item_id, cnpj_limpo, cliente_nome, mes, item_raw, item_total,
           id_subtask, squad, contrato_raw, prioridade,
           CASE
             WHEN prioridade = 99 THEN 'fallback_maior_valor'
             WHEN NOT EXISTS (SELECT 1 FROM contratos cc WHERE cc.cnpj_limpo = orfaos.cnpj_limpo)
               THEN 'cnpj_sem_contrato_clickup'
             ELSE 'item_nao_casou'
           END::text AS causa
    FROM orfaos
    UNION ALL
    SELECT parcela_id, item_id, cnpj_limpo, cliente_nome, mes, item_raw, item_total,
           id_subtask, squad, contrato_raw, prioridade, causa
    FROM parcelas_sem_cobertura
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
    causa: row.causa,
  }));
}


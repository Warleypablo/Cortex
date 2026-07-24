// Queries exclusivas da tela /reports/operacao. O que já existia para
// /reports/semanal (carteira, base de abertura, churn, entrega pontual) é
// importado de ./queries — não reimplementar aqui, sob pena de as duas telas
// divergirem em silêncio.
//
// Mesma decisão de ./queries.ts: nenhum try/catch. Falha derruba o endpoint
// com 500 em vez de devolver zero plausível numa tela cujo valor é número
// auditável.
import { sql } from "drizzle-orm";

export interface LinhaProduto {
  produto: string;
  valor: number;
  qtd: number;
}

export interface LinhaMotivo {
  motivo: string;
  mrr: number;
  pontual: number;
}

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Régua canônica de estoque pontual (a mesma de /estoque-pontual), aplicada ao
 * snapshot de fechamento da semana. 'cancelado/inativo' é UM valor de status.
 */
const FILTRO_ESTOQUE = sql`h.valorp > 0 AND h.status NOT IN ('entregue', 'cancelado/inativo', 'não usar')`;

/** Estoque pontual em aberto na foto do fim da semana. */
export async function estoquePontualNoFim(db: any, fim: string): Promise<number> {
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    )
    SELECT COALESCE(SUM(h.valorp::numeric), 0) AS total
    FROM "Clickup".cup_data_hist h, snap
    WHERE h.data_snapshot = snap.d AND ${FILTRO_ESTOQUE}
  `);
  return num((r.rows ?? [])[0]?.total);
}

/**
 * Mesmo estoque, quebrado por produto. `produto` está preenchido em 93–98% das
 * linhas do snapshot; o resto vai para 'Sem produto' em vez de sumir da soma —
 * a soma das linhas TEM que reproduzir estoquePontualNoFim.
 */
export async function estoquePontualPorProduto(db: any, fim: string): Promise<LinhaProduto[]> {
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    )
    SELECT
      COALESCE(NULLIF(TRIM(h.produto), ''), 'Sem produto') AS produto,
      COALESCE(SUM(h.valorp::numeric), 0) AS valor,
      COUNT(*) AS qtd
    FROM "Clickup".cup_data_hist h, snap
    WHERE h.data_snapshot = snap.d AND ${FILTRO_ESTOQUE}
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    produto: String(x.produto),
    valor: num(x.valor),
    qtd: num(x.qtd),
  }));
}

/**
 * Churn da semana quebrado por motivo, BRUTO (abonados incluídos): os motivos
 * operacionais são justamente o que a reunião quer enxergar, e assim o total da
 * tabela fecha com a linha Churn Total.
 *
 * LEFT JOIN, não INNER: um churn sem contrato pontual precisa aparecer com
 * pontual = 0, senão o MRR daquele motivo some da tabela. Depende de
 * `id_subtask` ser único em cup_contratos — validado no Step 1.
 */
export async function churnPorMotivoNaSemana(
  db: any,
  inicio: string,
  fim: string,
): Promise<LinhaMotivo[]> {
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(ch.motivo_cancelamento), ''), '(sem motivo)') AS motivo,
      COALESCE(SUM(ch.valor_r), 0) AS mrr,
      COALESCE(SUM(ct.valorp), 0) AS pontual
    FROM "Clickup".cup_churn ch
    LEFT JOIN "Clickup".cup_contratos ct
      ON ct.id_subtask = ch.task_id AND ct.valorp > 0
    WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
      AND ch.data_solicitacao_encerramento <= ${fim}::date
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    motivo: String(x.motivo),
    mrr: num(x.mrr),
    pontual: num(x.pontual),
  }));
}

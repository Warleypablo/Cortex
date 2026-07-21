// Régua única de classificação de venda do Cortex.
//
// Cross-sell = deal ganho marcado como expansão de conta no CRM.
// Venda nova  = *todo* o resto dos deals ganhos — o complemento exato da
// condição acima, nunca uma lista de canais. É isso que garante que as duas
// linhas sejam mutuamente exclusivas e somem o total ganho no período.
//
// Substituiu duas réguas incompatíveis que conviviam na mensagem dos líderes:
// venda nova por "CNPJ sem contrato anterior" e cross-sell por override manual
// mensal. Medido em 2026: 40 dos 106 deals de expansão (R$ 121k de R$ 235k de
// MRR) não têm CNPJ e eram contados NAS DUAS linhas.
//
// Sem guard de CNPJ: a régua confia na marcação. Exigir CNPJ descartaria 32 dos
// 106 deals e 51% do MRR de expansão. `channel='Reativação'` cai em venda nova
// — win-back de cliente perdido não é expansão de conta ativa.
import { sql } from "drizzle-orm";
import { CHANNEL_EXPANSAO } from "../../shared/crm-channel";

export interface VendasPorChannel {
  novoMrr: number;
  novoPontual: number;
  crossMrr: number;
  crossPontual: number;
  /** true quando a query falhou e os zeros NÃO significam "não houve venda". */
  erro?: boolean;
}

export interface DealExpansao {
  cliente: string;
  closer: string;
  canal: string;
  data: string | null;
  recorrente: number;
  pontual: number;
}

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Venda nova e cross-sell de um intervalo de datas [inicio, fim] inclusive,
 * por `data_fechamento` do deal ganho. Serve o mês (mensagem diária dos
 * líderes) e a semana (tela /reports/semanal) — é a MESMA query, e é por isso
 * que as duas superfícies não podem divergir.
 *
 * Tolerante a falha: devolve zeros com `erro: true` em vez de lançar, porque a
 * mensagem diária não deve deixar de sair por causa do Bitrix. Quem consome
 * precisa exibir o aviso quando `erro` for true, senão uma falha de query vira
 * "mês sem vendas" em silêncio.
 */
export async function vendasPorChannel(
  db: any,
  inicio: string,
  fim: string,
): Promise<VendasPorChannel> {
  try {
    const r: any = await db.execute(sql`
      SELECT
        COALESCE(SUM(d.valor_recorrente::numeric) FILTER (WHERE TRIM(COALESCE(d.channel, '')) <> ${CHANNEL_EXPANSAO}), 0) AS novo_mrr,
        COALESCE(SUM(d.valor_pontual::numeric)    FILTER (WHERE TRIM(COALESCE(d.channel, '')) <> ${CHANNEL_EXPANSAO}), 0) AS novo_pontual,
        COALESCE(SUM(d.valor_recorrente::numeric) FILTER (WHERE TRIM(COALESCE(d.channel, '')) = ${CHANNEL_EXPANSAO}), 0) AS cross_mrr,
        COALESCE(SUM(d.valor_pontual::numeric)    FILTER (WHERE TRIM(COALESCE(d.channel, '')) = ${CHANNEL_EXPANSAO}), 0) AS cross_pontual
      FROM "Bitrix".crm_deal d
      WHERE d.stage_name = 'Negócio Ganho'
        AND d.data_fechamento IS NOT NULL
        AND d.data_fechamento >= ${inicio}::date
        AND d.data_fechamento <= ${fim}::date
    `);
    const row = (r.rows ?? [])[0] as any;
    return {
      novoMrr: num(row?.novo_mrr),
      novoPontual: num(row?.novo_pontual),
      crossMrr: num(row?.cross_mrr),
      crossPontual: num(row?.cross_pontual),
    };
  } catch (error: any) {
    console.error("[crm/expansao] vendasPorChannel falhou:", error?.message);
    return { novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0, erro: true };
  }
}

/**
 * Deals por trás de uma célula de venda nova ou cross-sell — a query GÊMEA de
 * `vendasPorChannel`. Mesmo filtro de stage, mesmo intervalo, mesma condição de
 * channel (só invertida por `tipo`).
 *
 * ⚠️ Se o filtro de uma mudar, a outra TEM que mudar junto, senão o drawer
 * deixa de somar a célula que ele detalha.
 */
export async function dealsPorChannel(
  db: any,
  inicio: string,
  fim: string,
  tipo: "novo" | "cross",
): Promise<DealExpansao[]> {
  const filtroChannel =
    tipo === "cross"
      ? sql`TRIM(COALESCE(d.channel, '')) = ${CHANNEL_EXPANSAO}`
      : sql`TRIM(COALESCE(d.channel, '')) <> ${CHANNEL_EXPANSAO}`;

  try {
    const r: any = await db.execute(sql`
      SELECT
        COALESCE(NULLIF(TRIM(cl.nome), ''), NULLIF(d.company_name, ''), d.title, 'Sem nome') AS cliente,
        COALESCE(NULLIF(TRIM(c.nome), ''), '') AS closer,
        COALESCE(NULLIF(TRIM(d.channel), ''), '—') AS canal,
        d.data_fechamento::date::text AS data,
        COALESCE(d.valor_recorrente::numeric, 0) AS rec,
        COALESCE(d.valor_pontual::numeric, 0) AS pont
      FROM "Bitrix".crm_deal d
      LEFT JOIN "Bitrix".crm_closers c
        ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
      LEFT JOIN "Clickup".cup_clientes cl
        ON REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(d.cnpj, ''), '[^0-9]', '', 'g')
       AND COALESCE(d.cnpj, '') <> ''
      WHERE d.stage_name = 'Negócio Ganho'
        AND d.data_fechamento IS NOT NULL
        AND d.data_fechamento >= ${inicio}::date
        AND d.data_fechamento <= ${fim}::date
        AND ${filtroChannel}
      ORDER BY d.valor_recorrente::numeric DESC NULLS LAST, d.valor_pontual::numeric DESC NULLS LAST
    `);
    return ((r.rows ?? []) as any[]).map((x) => ({
      cliente: String(x.cliente),
      closer: String(x.closer || ""),
      canal: String(x.canal),
      data: x.data ? String(x.data) : null,
      recorrente: num(x.rec),
      pontual: num(x.pont),
    }));
  } catch (error: any) {
    console.error("[crm/expansao] dealsPorChannel falhou:", error?.message);
    return [];
  }
}

// Queries exclusivas da tela /reports/operacao. O que já existia para
// /reports/semanal (carteira, base de abertura, churn, entrega pontual) é
// importado de ./queries — não reimplementar aqui, sob pena de as duas telas
// divergirem em silêncio.
//
// Mesma decisão de ./queries.ts: nenhum try/catch. Falha derruba o endpoint
// com 500 em vez de devolver zero plausível numa tela cujo valor é número
// auditável.
import { sql } from "drizzle-orm";
import { ehOperacao } from "../../shared/headcount-operacao";
import { computarBpReceitas } from "../routes/bp2026";
import type { LinhaDetalhe } from "./queries";

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

/**
 * Pessoas de operação ativas na data. A query traz todo mundo que estava na
 * casa (~110 linhas) e o recorte de setor/squad acontece em TypeScript, com
 * `ehOperacao` — a régua tem teste, e teste de normalização de string em SQL
 * seria caro. Volume não justifica filtrar no banco.
 *
 * A janela histórica é governada por `admissao`/`demissao`. A exclusão de
 * `status = 'Dispensado'` é condicionada a `demissao IS NULL` e trata um erro
 * de cadastro real: 3 pessoas em Commerce foram dispensadas sem receber data de
 * saída e, sem isto, contariam como operação em TODA data (~4% de inflação no
 * denominador da receita por cabeça). Quem tem data de saída continua governado
 * por ela, então a série histórica fica intacta.
 *
 * Não filtrar por `status = 'Ativo'` puro: `status` é foto do agora, e quem saiu
 * em junho sumiria também das semanas de abril — a série chega a inverter.
 *
 * Validado em produção: 72 em 2026-07-19, 73 em 2026-07-12, 71 em 2026-07-24.
 */
export async function headcountOperacao(db: any, data: string): Promise<number> {
  const r: any = await db.execute(sql`
    SELECT setor, squad
    FROM "Inhire".rh_pessoal
    WHERE admissao IS NOT NULL
      AND admissao <= ${data}::date
      AND (demissao IS NULL OR demissao > ${data}::date)
      AND NOT (demissao IS NULL AND TRIM(COALESCE(status, '')) = 'Dispensado')
  `);
  return ((r.rows ?? []) as any[]).filter((p) => ehOperacao(p.setor, p.squad)).length;
}

/**
 * Receita Total Faturável do mês em que a semana FECHA (o domingo manda: uma
 * semana que cruza a virada de mês conta no mês do domingo).
 *
 * Reusa `computarBpReceitas` em vez de uma query nova para não criar a terceira
 * régua de faturamento do repositório — ela já tem cache de 10 minutos
 * compartilhado com /bp-2026. `receita_total_faturavel` = MRR Ativo + Venda
 * Pontual + Outras Receitas.
 *
 * `computarBpReceitas` preenche `realizado` para todo mês `<= mesCorrente`,
 * incluindo o mês corrente ainda em curso — só `payload.mesFechado` diz qual
 * mês já fechou de verdade. Por isso devolvemos `parcial` junto do valor: sem
 * ele, a primeira semana de cada mês compara (poucos dias do mês novo) com
 * (o mês anterior inteiro) e o Δ sai enorme sem que nada tenha mudado.
 *
 * `valor` vem `null` quando o mês não é de 2026 (o BP é um modelo anual de
 * 2026) ou quando o mês ainda não tem realizado nenhum. A tela mostra '—';
 * nunca zero, que se leria como 'faturou nada'.
 */
export async function faturavelDoMes(
  db: any,
  fimDaSemana: string,
): Promise<{ valor: number | null; parcial: boolean }> {
  const [ano, mes] = fimDaSemana.split("-").map(Number);
  const payload: any = await computarBpReceitas(db);
  const parcial = mes > (payload?.mesFechado ?? 0);
  if (ano !== payload?.ano) return { valor: null, parcial };
  const linha = (payload?.linhas ?? []).find((l: any) => l.metrica === "receita_total_faturavel");
  const doMes = (linha?.meses ?? []).find((m: any) => m.mes === mes);
  const realizado = doMes?.realizado;
  return { valor: typeof realizado === "number" ? realizado : null, parcial };
}

// ============================================
// Queries GÊMEAS do drill.
// Cada uma repete o filtro da query de série correspondente. ⚠️ Se um filtro
// mudar, o par TEM que mudar junto, senão o drawer deixa de somar a célula.
// ============================================

/**
 * Gêmea das células de Churn Abonado (`abonados: true`) e Churn Líquido
 * (`abonados: false`), em MRR (`pontual: false`) ou pontual (`pontual: true`).
 *
 * O par de filtros é uma PARTIÇÃO EXAUSTIVA do churn da semana: o que sai de
 * `abonados: true` mais o que sai de `abonados: false` reproduz Churn Total,
 * sem sobra e sem repetição. O `COALESCE` é o que garante isso — escrever
 * `abonar_churn <> 'Sim'` sem ele avaliaria NULL para as linhas não marcadas
 * (que são a maioria) e elas desapareceriam das DUAS pernas em silêncio.
 */
export async function detalheChurnPorAbono(
  db: any,
  inicio: string,
  fim: string,
  opcoes: { pontual: boolean; abonados: boolean },
): Promise<LinhaDetalhe[]> {
  const { pontual, abonados } = opcoes;
  const filtroAbono = abonados
    ? sql`COALESCE(ch.abonar_churn, '') = 'Sim'`
    : sql`COALESCE(ch.abonar_churn, '') <> 'Sim'`;
  const r: any = pontual
    ? await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(ch.nome), ''), 'Sem nome') AS cliente,
          COALESCE(ct.valorp, 0) AS valor,
          NULLIF(TRIM(COALESCE(ch.motivo_cancelamento, '')), '') AS motivo
        FROM "Clickup".cup_churn ch
        JOIN "Clickup".cup_contratos ct ON ct.id_subtask = ch.task_id AND ct.valorp > 0
        WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
          AND ch.data_solicitacao_encerramento <= ${fim}::date
          AND ${filtroAbono}
        ORDER BY ct.valorp DESC NULLS LAST
      `)
    : await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(ch.nome), ''), 'Sem nome') AS cliente,
          COALESCE(ch.valor_r, 0) AS valor,
          NULLIF(TRIM(COALESCE(ch.motivo_cancelamento, '')), '') AS motivo
        FROM "Clickup".cup_churn ch
        WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
          AND ch.data_solicitacao_encerramento <= ${fim}::date
          AND ${filtroAbono}
        ORDER BY ch.valor_r DESC NULLS LAST
      `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: abonados,
  }));
}

/**
 * Gêmea de uma LINHA de churnPorMotivoNaSemana. Traz MRR e pontual do mesmo
 * cliente na mesma linha — o drawer soma o campo que a célula clicada mostra.
 * '(sem motivo)' casa com motivo nulo ou vazio, espelhando o COALESCE da série.
 */
export async function detalheChurnDoMotivo(
  db: any,
  inicio: string,
  fim: string,
  motivo: string,
): Promise<LinhaDetalhe[]> {
  const filtroMotivo =
    motivo === "(sem motivo)"
      ? sql`COALESCE(NULLIF(TRIM(ch.motivo_cancelamento), ''), '') = ''`
      : sql`TRIM(ch.motivo_cancelamento) = ${motivo}`;
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(ch.nome), ''), 'Sem nome') AS cliente,
      COALESCE(ch.valor_r, 0) + COALESCE(ct.valorp, 0) AS valor,
      NULLIF(TRIM(COALESCE(ch.motivo_cancelamento, '')), '') AS motivo,
      (COALESCE(ch.abonar_churn, '') = 'Sim') AS abonado
    FROM "Clickup".cup_churn ch
    LEFT JOIN "Clickup".cup_contratos ct
      ON ct.id_subtask = ch.task_id AND ct.valorp > 0
    WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
      AND ch.data_solicitacao_encerramento <= ${fim}::date
      AND ${filtroMotivo}
    ORDER BY 2 DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: x.abonado === true,
  }));
}

/**
 * Gêmea de estoquePontualNoFim (produto = null) e de uma linha de
 * estoquePontualPorProduto (produto preenchido). 'Sem produto' casa com produto
 * nulo ou vazio, espelhando o COALESCE da série.
 */
export async function detalheEstoquePontual(
  db: any,
  fim: string,
  produto: string | null,
): Promise<LinhaDetalhe[]> {
  const filtroProduto =
    produto === null
      ? sql`TRUE`
      : produto === "Sem produto"
      ? sql`COALESCE(NULLIF(TRIM(h.produto), ''), '') = ''`
      : sql`TRIM(h.produto) = ${produto}`;
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    )
    SELECT
      COALESCE(NULLIF(TRIM(cl.nome), ''), 'Sem nome') AS cliente,
      COALESCE(h.valorp, 0) AS valor,
      COALESCE(NULLIF(TRIM(h.produto), ''), 'Sem produto') AS motivo
    -- CROSS JOIN explícito, não vírgula: 'FROM a, b LEFT JOIN c ON c.x = a.y'
    -- é erro no Postgres ("invalid reference to FROM-clause entry"), porque o
    -- LEFT JOIN se liga ao item imediatamente anterior e 'a' fica fora do
    -- escopo do ON. As queries de série acima podem usar vírgula porque não
    -- têm JOIN nenhum.
    FROM "Clickup".cup_data_hist h
    CROSS JOIN snap
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
    WHERE h.data_snapshot = snap.d AND ${FILTRO_ESTOQUE} AND ${filtroProduto}
    ORDER BY h.valorp DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: false,
  }));
}

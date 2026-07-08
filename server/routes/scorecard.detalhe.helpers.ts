// server/routes/scorecard.detalhe.helpers.ts
// Builders de query da Fase 2A do dispatcher de detalhe do Scorecard (server/routes/
// scorecard.detalhe.ts) — extraídos para cá para o arquivo principal não passar de 500 linhas.
// As composições do Capacity (Fase 2C-i: `receita_cabeca`, `geracao_liquida`, `conversao_caixa`)
// ficam em scorecard.detalhe.composicoes.ts (arquivo à parte, pelo mesmo motivo de tamanho) —
// aqueles builders REUSAM os SOMÁVEIS deste arquivo (montarMrrAtivoDetalhe, montarEntregueDetalhe,
// montarGeracaoCaixaDetalhe) em vez de duplicar query.
// Cada `montar*Detalhe` REUSA a mesma fonte/exclusões da série/card que o originou (mesma regra
// da Fase 1) — ver docstring de cada função para a fonte espelhada e eventuais divergências
// documentadas (quando o `total` não reconcilia byte-a-byte com o card, por desenho).
import { sql } from "drizzle-orm";
import { db } from "../db";
import { addMeses, limitesMes, ultimoDiaMes } from "./scorecard.helpers";
import { storage } from "../storage";
import { fetchSnapRows } from "./bp2026.reconciliacao";
import { computeReconciliacao, contratoEhEntregaPontual, type SnapRow } from "./bp2026.reconciliacao.helpers";
import type { DrillColuna, DrillDetalhe } from "./scorecard.detalhe";

/** Filtro `AND COALESCE(NULLIF(TRIM(<alias>.<coluna>),''),'Não Informado') = <valor>` — cópia
   local da mesma regra de `scorecard.detalhe.ts` (não importada de lá de propósito: importar um
   valor de `scorecard.detalhe.ts` aqui criaria um import circular, já que aquele arquivo importa
   os builders deste em `montarDetalheScorecard`). `alias`/`coluna` são sempre literais do nosso
   código (nunca do request); só `valor` é parametrizado normalmente pelo `sql` tag. */
function filtroDimSql(alias: string, coluna: string | undefined, valor: string | undefined) {
  if (!coluna || !valor) return sql``;
  return sql` AND COALESCE(NULLIF(TRIM(${sql.raw(`${alias}.${coluna}`)}),''),'Não Informado') = ${valor}`;
}

// ---------------------------------------------------------------------------
// mrr_ativo — MRR do portfólio ativo (ESTOQUE, snapshot de fim de mês), mesma fonte/exclusões de
// `fetchMrrPorDimensao` (scorecard.ts): "Clickup".cup_data_hist, status ativo/onboarding/triagem,
// valorr > 0. `dim` ∈ {squad, operador} — `operador` mapeia p/ `responsavel` (mesmo padrão do
// Churn Pontual em scorecard.detalhe.ts).
// ---------------------------------------------------------------------------

export const DIM_COLUNA_MRR_ATIVO: Record<string, string> = {
  squad: "squad",
  operador: "responsavel",
};

interface MrrAtivoRow {
  cliente: string | null;
  produto: string | null;
  squad: string | null;
  responsavel: string | null;
  valorr: number | string;
}

const DIM_LABEL_MRR: Record<string, string> = { squad: "Squad", operador: "Operador" };

export async function montarMrrAtivoDetalhe(mes: string, dim?: string, valor?: string): Promise<DrillDetalhe> {
  const coluna = dim ? DIM_COLUNA_MRR_ATIVO[dim] : undefined;
  const filtroDim = filtroDimSql("h", coluna, valor);
  const fimMes = `${mes}-01`;

  const result = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS snap FROM "Clickup".cup_data_hist
      WHERE DATE_TRUNC('month', data_snapshot) = DATE_TRUNC('month', ${fimMes}::date)
    )
    SELECT cl.nome AS cliente, h.produto AS produto, h.squad AS squad, h.responsavel AS responsavel,
           h.valorr::numeric AS valorr
    FROM "Clickup".cup_data_hist h
    JOIN snap ON h.data_snapshot = snap.snap
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
    WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0
      ${filtroDim}
    ORDER BY h.valorr DESC
  `);

  const linhas = (result.rows as unknown as MrrAtivoRow[]).map((r) => ({ ...r, valorr: Number(r.valorr) || 0 }));
  const total = linhas.reduce((acc, r) => acc + (r.valorr as number), 0);

  return {
    titulo: dim && valor ? `MRR Ativo — ${DIM_LABEL_MRR[dim] ?? dim}: ${valor}` : "MRR Ativo",
    subtitulo: `${linhas.length} contrato${linhas.length === 1 ? "" : "s"} · ${mes}`,
    colunas: [
      { chave: "cliente", label: "Cliente", tipo: "text" },
      { chave: "produto", label: "Produto", tipo: "text" },
      { chave: "squad", label: "Squad", tipo: "text" },
      { chave: "responsavel", label: "Responsável", tipo: "text" },
      { chave: "valorr", label: "MRR", tipo: "brl" },
    ],
    linhas,
    total,
  };
}

// ---------------------------------------------------------------------------
// entregue — entregas pontuais concluídas no mês (FLUXO, data_entrega), mesma fonte/exclusões de
// `fetchEntregasPorOperador`/`fetchEntregasPorSquad` (scorecard.ts): status='entregue', valorp>0.
// `dim` ∈ {produto, operador, squad} — `produto` é uma dimensão nova aqui (as séries hoje só
// quebram por operador/squad; filtra direto na coluna `produto` de `cup_contratos`, mesmo padrão
// das demais).
// ---------------------------------------------------------------------------

export const DIM_COLUNA_ENTREGUE: Record<string, string> = {
  produto: "produto",
  operador: "responsavel",
  squad: "squad",
};

interface EntregueRow {
  cliente: string | null;
  produto: string | null;
  responsavel: string | null;
  squad: string | null;
  valorp: number | string;
}

const DIM_LABEL_ENTREGUE: Record<string, string> = { produto: "Produto", operador: "Operador", squad: "Squad" };

export async function montarEntregueDetalhe(mes: string, dim?: string, valor?: string): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);
  const coluna = dim ? DIM_COLUNA_ENTREGUE[dim] : undefined;
  const filtroDim = filtroDimSql("ct", coluna, valor);

  const result = await db.execute(sql`
    SELECT cl.nome AS cliente, ct.produto AS produto, ct.responsavel AS responsavel, ct.squad AS squad,
           ct.valorp::numeric AS valorp
    FROM "Clickup".cup_contratos ct
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
    WHERE LOWER(TRIM(ct.status)) = 'entregue' AND ct.data_entrega IS NOT NULL
      AND ct.data_entrega >= ${inicio}::date AND ct.data_entrega < ${fim}::date
      AND ct.valorp::numeric > 0
      ${filtroDim}
    ORDER BY ct.valorp DESC
  `);

  const linhas = (result.rows as unknown as EntregueRow[]).map((r) => ({ ...r, valorp: Number(r.valorp) || 0 }));
  const total = linhas.reduce((acc, r) => acc + (r.valorp as number), 0);

  return {
    titulo: dim && valor ? `Entregue — ${DIM_LABEL_ENTREGUE[dim] ?? dim}: ${valor}` : "Entregue (pontual)",
    subtitulo: `${linhas.length} entrega${linhas.length === 1 ? "" : "s"} · ${mes}`,
    colunas: [
      { chave: "cliente", label: "Cliente", tipo: "text" },
      { chave: "produto", label: "Produto", tipo: "text" },
      { chave: "responsavel", label: "Responsável", tipo: "text" },
      { chave: "squad", label: "Squad", tipo: "text" },
      { chave: "valorp", label: "Valor", tipo: "brl" },
    ],
    linhas,
    total,
  };
}

// ---------------------------------------------------------------------------
// geracao_caixa_receita / geracao_caixa_despesa — quebra por categoria da mesma base caixa de
// `/api/investors-report/geracao-caixa` (routes.ts ~L3667): "Conta Azul".caz_parcelas,
// tipo_evento RECEITA|DESPESA, status QUITADO, por `data_quitacao` no mês. Aquele endpoint só
// soma por MÊS (sem quebra); aqui agrupamos por `categoria_nome` — o total da soma não muda
// (GROUP BY é só um corte de exibição), então reconcilia por construção com o card de Receita
// vs Despesa do mês. NOTA: `categoria_nome` pode conter múltiplos valores separados por ";"
// (ver db-specialist.md) — não splitamos aqui (mesma simplificação de
// `getContribuicaoSquadDfc`), a categoria composta aparece como 1 linha só.
// ---------------------------------------------------------------------------

interface GeracaoCaixaRow {
  categoria: string | null;
  valor: number | string;
}

export async function montarGeracaoCaixaDetalhe(mes: string, tipoEvento: "RECEITA" | "DESPESA"): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);

  const result = await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(categoria_nome),''),'Sem Categoria') AS categoria,
           SUM(valor_pago::numeric) AS valor
    FROM "Conta Azul".caz_parcelas
    WHERE tipo_evento = ${tipoEvento} AND status = 'QUITADO'
      AND data_quitacao >= ${inicio}::date AND data_quitacao < ${fim}::date
    GROUP BY 1
    ORDER BY valor DESC
  `);

  const linhas = (result.rows as unknown as GeracaoCaixaRow[]).map((r) => ({ ...r, valor: Number(r.valor) || 0 }));
  const total = linhas.reduce((acc, r) => acc + (r.valor as number), 0);

  return {
    titulo: tipoEvento === "RECEITA" ? "Geração de Caixa — Receita" : "Geração de Caixa — Despesa",
    subtitulo: `${linhas.length} categoria${linhas.length === 1 ? "" : "s"} · ${mes}`,
    colunas: [
      { chave: "categoria", label: "Categoria", tipo: "text" },
      { chave: "valor", label: "Valor", tipo: "brl" },
    ],
    linhas,
    total,
  };
}

// ---------------------------------------------------------------------------
// estoque_aberto / estoque_pausado — mesma fonte/exclusões de `fetchEstoquePontualSaldos`
// (scorecard.ts): "Clickup".cup_data_hist, snapshot de FIM DE MÊS, valorp > 0. "pausado" é
// subconjunto de "aberto" (mesma nota da série — não são estoques mutuamente exclusivos).
// ---------------------------------------------------------------------------

interface EstoqueRow {
  cliente: string | null;
  produto: string | null;
  status: string | null;
  valorp: number | string;
}

export async function montarEstoqueDetalhe(mes: string, variante: "aberto" | "pausado"): Promise<DrillDetalhe> {
  const fimMes = `${mes}-01`;
  const statusFiltro =
    variante === "pausado"
      ? sql`LOWER(TRIM(h.status)) = 'pausado'`
      : sql`LOWER(TRIM(h.status)) NOT IN ('entregue','cancelado/inativo','não usar')`;

  const result = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS snap FROM "Clickup".cup_data_hist
      WHERE DATE_TRUNC('month', data_snapshot) = DATE_TRUNC('month', ${fimMes}::date)
    )
    SELECT cl.nome AS cliente, h.produto AS produto, h.status AS status, h.valorp::numeric AS valorp
    FROM "Clickup".cup_data_hist h
    JOIN snap ON h.data_snapshot = snap.snap
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
    WHERE h.valorp > 0 AND ${statusFiltro}
    ORDER BY h.valorp DESC
  `);

  const linhas = (result.rows as unknown as EstoqueRow[]).map((r) => ({ ...r, valorp: Number(r.valorp) || 0 }));
  const total = linhas.reduce((acc, r) => acc + (r.valorp as number), 0);

  return {
    titulo: variante === "pausado" ? "Estoque Pontual — Pausado" : "Estoque Pontual — Em aberto",
    subtitulo: `${linhas.length} contrato${linhas.length === 1 ? "" : "s"} · ${mes}`,
    colunas: [
      { chave: "cliente", label: "Cliente", tipo: "text" },
      { chave: "produto", label: "Produto", tipo: "text" },
      { chave: "status", label: "Status", tipo: "text" },
      { chave: "valorp", label: "Valor", tipo: "brl" },
    ],
    linhas,
    total,
  };
}

// ---------------------------------------------------------------------------
// cross_sell — TODOS os deals de cross-sell ganhos no mês, mesma fonte/filtro EXATO do card
// (turboMetrics.crosssellMrr/crosssellPontual — relatorioMensalSlides.ts ~L450-459):
// "Bitrix".crm_deal, stage_name='Negócio Ganho', source='PARTNER', por data_fechamento no mês.
// Fix (auditoria 2026-07): antes delegava para `getCrosssellDealsDetail` (okr2026/metricsAdapter.ts,
// função mantida — ainda usada por routes.ts), que filtra ADICIONALMENTE por cliente
// PRÉ-EXISTENTE — subconjunto legítimo ali, mas SUB-CONTAVA este drill vs. o card (ex.:
// R$132.396/17 deals do subconjunto vs. R$140.396/19 deals — TODOS os PARTNER — em 2026-06).
// `total` = MRR + Pontual combinados (2 colunas "brl" — o DrillSheet soma cada uma
// individualmente a partir de `linhas`, ver sua docstring de `total`).
// ---------------------------------------------------------------------------

const COLUNAS_CROSS_SELL: DrillColuna[] = [
  { chave: "cliente", label: "Cliente", tipo: "text" },
  { chave: "deal", label: "Deal", tipo: "text" },
  { chave: "closer", label: "Closer", tipo: "text" },
  { chave: "valor_recorrente", label: "MRR", tipo: "brl" },
  { chave: "valor_pontual", label: "Pontual", tipo: "brl" },
];

interface CrossSellRow {
  cliente: string | null;
  deal: string;
  closer: string | null;
  valor_recorrente: number | string;
  valor_pontual: number | string;
}

export async function montarCrossSellDetalhe(mes: string): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);

  const result = await db.execute(sql`
    WITH cliente_nome AS (
      SELECT REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g') AS cnpj_norm, MAX(nome) AS nome
      FROM "Clickup".cup_clientes WHERE COALESCE(cnpj, '') <> '' GROUP BY 1
    )
    SELECT
      -- nome do ClickUp é mais limpo que o title (sem prefixos "[cross-sell]")
      COALESCE(NULLIF(cn.nome, ''), NULLIF(d.company_name, ''), d.title, 'Sem nome') AS cliente,
      d.id AS deal,
      COALESCE(d.assigned_by_name, '—') AS closer,
      COALESCE(d.valor_recorrente::numeric, 0) AS valor_recorrente,
      COALESCE(d.valor_pontual::numeric, 0) AS valor_pontual
    FROM "Bitrix".crm_deal d
    LEFT JOIN cliente_nome cn ON REGEXP_REPLACE(COALESCE(d.cnpj, ''), '[^0-9]', '', 'g') = cn.cnpj_norm
    WHERE d.stage_name = 'Negócio Ganho' AND d.source = 'PARTNER'
      AND d.data_fechamento >= ${inicio}::date AND d.data_fechamento < ${fim}::date
    ORDER BY d.valor_recorrente::numeric DESC, d.valor_pontual::numeric DESC
  `);

  const linhas = (result.rows as unknown as CrossSellRow[]).map((r) => ({
    ...r,
    valor_recorrente: Number(r.valor_recorrente) || 0,
    valor_pontual: Number(r.valor_pontual) || 0,
  }));
  const total = linhas.reduce((acc, r) => acc + (r.valor_recorrente as number) + (r.valor_pontual as number), 0);

  return {
    titulo: "Cross-sell (NRR)",
    subtitulo: `${linhas.length} deal${linhas.length === 1 ? "" : "s"} · ${mes}`,
    colunas: COLUNAS_CROSS_SELL,
    linhas,
    total,
  };
}

// ---------------------------------------------------------------------------
// upsell / downsell — agregado dos 5 produtos da reconciliação de MRR (waterfall snapshot M-1 ->
// M), mesma fonte/lógica de `/api/bp2026/reconciliacao-total` (server/routes/
// bp2026.reconciliacao.ts): bucket "expansao" = upsell, "churn_downsell" = downsell.
// `bp2026.reconciliacao.ts` fixa `ANO = 2026`; aqui os snapshots são resolvidos a partir do
// próprio `mes` (YYYY-MM) — não hardcoded — então o resultado só bate com aquele endpoint quando
// `mes` cai em 2026 (única safra coberta hoje pelos snapshots de cup_data_hist).
// ---------------------------------------------------------------------------

const PRODUTOS_RECONCILIACAO = ["performance", "creators", "social", "gc", "others"] as const;

const COLUNAS_UPSELL_DOWNSELL: DrillColuna[] = [
  { chave: "cliente", label: "Cliente", tipo: "text" },
  { chave: "contrato", label: "Contrato", tipo: "text" },
  { chave: "produto", label: "Produto", tipo: "text" },
  { chave: "delta", label: "Δ MRR", tipo: "brl" },
];

/** Monta o `DrillDetalhe` a partir dos snapshots M-1/M já buscados — pura/testável sem banco
   (`computeReconciliacao`, que já é pura, roda uma vez por produto sobre o MESMO par de linhas,
   mesmo padrão de `/api/bp2026/reconciliacao-total`). `bucket` seleciona "expansao" (upsell) ou
   "churn_downsell" (downsell) — mesmos buckets de `bp2026.reconciliacao.helpers.ts`. */
export function montarUpsellDownsellFromSnaps(
  prevRows: SnapRow[],
  curRows: SnapRow[],
  bucket: "expansao" | "churn_downsell",
  mes: string,
): DrillDetalhe {
  const titulo = bucket === "expansao" ? "Upsell (expansão de MRR)" : "Downsell (redução de MRR)";
  // `flatMap` (em vez de `let linhas = []; ...push(...)`) de propósito — mantém `linhas` como um
  // tipo "fresh" inferido puramente do literal, atribuível a `DrillDetalhe.linhas: Record<string,
  // unknown>[]` (ver nota em `converterCrossSellDetalhe` acima).
  const linhas = PRODUTOS_RECONCILIACAO.flatMap((produto) => {
    const rec = computeReconciliacao(produto, prevRows, curRows);
    const componente = rec.componentes.find((c) => c.chave === bucket);
    if (!componente) return [];
    // Exclui entregas pontuais ("Entrega X") que vazam pro pool de MRR — ver contratoEhEntregaPontual.
    return componente.contratos
      .filter((mov) => !contratoEhEntregaPontual(mov.servico))
      .map((mov) => ({ cliente: mov.cliente, contrato: mov.servico, produto, delta: mov.delta }));
  });

  linhas.sort((a, b) => (bucket === "expansao" ? b.delta - a.delta : a.delta - b.delta));
  const total = linhas.reduce((acc, r) => acc + r.delta, 0);

  return {
    titulo,
    subtitulo: `${linhas.length} contrato${linhas.length === 1 ? "" : "s"} · ${mes}`,
    colunas: COLUNAS_UPSELL_DOWNSELL,
    linhas,
    total,
  };
}

export async function montarUpsellDownsellDetalhe(mes: string, bucket: "expansao" | "churn_downsell"): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);
  const inicioAnterior = `${addMeses(mes, -1)}-01`;

  const datas = await db.execute(sql`
    SELECT
      (SELECT MAX(data_snapshot::date) FROM "Clickup".cup_data_hist
       WHERE data_snapshot::date >= ${inicio}::date AND data_snapshot::date < ${fim}::date) AS cur,
      (SELECT MAX(data_snapshot::date) FROM "Clickup".cup_data_hist
       WHERE data_snapshot::date >= ${inicioAnterior}::date AND data_snapshot::date < ${inicio}::date) AS prev
  `);
  const curD = (datas.rows[0] as { cur?: string; prev?: string })?.cur;
  const prevD = (datas.rows[0] as { cur?: string; prev?: string })?.prev;

  if (!curD || !prevD) {
    return montarUpsellDownsellFromSnaps([], [], bucket, mes);
  }

  const [prevRows, curRows] = await Promise.all([fetchSnapRows(db, prevD), fetchSnapRows(db, curD)]);
  return montarUpsellDownsellFromSnaps(prevRows, curRows, bucket, mes);
}

// ---------------------------------------------------------------------------
// contribuicao_squad — quebra por CATEGORIA da contribuição (receita − despesa) do squad no mês,
// mesma fonte de `getContribuicaoSquadDfc` (server/storage.ts, rota /api/contribuicao-squad/dfc).
// `valor` (nome do squad) é OBRIGATÓRIO aqui — a função de storage exige um squad (ou 'todos').
// ---------------------------------------------------------------------------

type ContribuicaoSquadResult = Awaited<ReturnType<typeof storage.getContribuicaoSquadDfc>>;

/** Converte o resultado de `getContribuicaoSquadDfc` no `DrillDetalhe` genérico — pura/testável
   sem banco. Lista as categorias de RECEITA (nível 1, valor positivo) e DESPESA (nível 1, valor
   NEGATIVO) lado a lado — assim `total` (=Σ linhas) reconcilia por construção com
   `totais.resultado` (receita − despesa, a própria contribuição do squad), em vez de só bater no
   nível de categoria de receita (que sozinho somaria a receita bruta, não a contribuição). */
export function converterContribuicaoSquadDetalhe(data: ContribuicaoSquadResult, squad: string, mes: string): DrillDetalhe {
  // Sem anotação de tipo explícita (ver nota em `converterCrossSellDetalhe`) — `linhas` precisa
  // ficar "fresh" para ser atribuível a `DrillDetalhe.linhas`.
  const linhas = [
    ...data.receitas.filter((r) => r.nivel === 1).map((r) => ({ categoria: `Receita: ${r.categoriaNome}`, valor: r.valor })),
    ...data.despesas.filter((r) => r.nivel === 1).map((r) => ({ categoria: `Despesa: ${r.categoriaNome}`, valor: -r.valor })),
  ];

  return {
    titulo: `Contribuição — Squad: ${squad}`,
    subtitulo: `${mes} · Receita − Despesa (por categoria)`,
    colunas: [
      { chave: "categoria", label: "Categoria", tipo: "text" },
      { chave: "valor", label: "Valor", tipo: "brl" },
    ],
    linhas,
    total: data.totais.resultado,
  };
}

export async function montarContribuicaoSquadDetalhe(mes: string, squad?: string): Promise<DrillDetalhe> {
  if (!squad) {
    return {
      titulo: "Contribuição por Squad",
      subtitulo: "Parâmetro 'valor' (nome do squad) é obrigatório para este tipo.",
      colunas: [
        { chave: "categoria", label: "Categoria", tipo: "text" },
        { chave: "valor", label: "Valor", tipo: "brl" },
      ],
      linhas: [],
    };
  }

  const dataInicio = `${mes}-01`;
  const dataFim = ultimoDiaMes(mes); // getContribuicaoSquadDfc usa dataFim INCLUSIVE (+ 1 day)
  const data = await storage.getContribuicaoSquadDfc(dataInicio, dataFim, squad);
  return converterContribuicaoSquadDetalhe(data, squad, mes);
}

// ---------------------------------------------------------------------------
// contratos_ativos — lista de contratos recorrentes ATIVOS agora (fonte de "Total recorrentes",
// `lt_ltv_total_recorrentes`), mesma view/filtro de `/api/lt-ltv-churn/clientes?status=ativo`
// (cortex_core.vw_lt_contratos, `is_ativo`). É uma FOTO DO AGORA (não filtra por `mes` — mesmo
// comportamento documentado em `reference_endpoints_temporalidade_mes.md` p/ os endpoints
// lt-ltv/estoque/capacity, que ignoram o mês selecionado no painel).
//
// DIVERGE de propósito do `total_recorrentes` bruto do card "Total recorrentes" hoje (overview:
// `COUNT(*) FILTER (WHERE tipo_receita='recorrente')` SEM filtrar `is_ativo` — conta todo
// histórico de contratos recorrentes, incluindo os já churnados; ~1560 vs ~337 ativos em
// 2026-06). Esta Fase pediu explicitamente "clientes recorrentes ATIVOS" via o padrão do
// endpoint `/clientes?status=ativo` — por isso aqui é sempre o portfólio vivo, não o bruto
// histórico. Ao conectar o front, considerar se o card deve migrar para esta definição (mais
// correta como "portfólio atual") ou manter a bruta (documentar a escolha na Fase de wiring).
// ---------------------------------------------------------------------------

interface ContratoAtivoRow {
  cliente: string | null;
  produto: string | null;
  mrr: number | string;
  ltv: number | string;
}

export async function montarContratosAtivosDetalhe(): Promise<DrillDetalhe> {
  const result = await db.execute(sql`
    SELECT nome_cliente AS cliente, produto,
           COALESCE(valorr, 0)::numeric AS mrr,
           COALESCE(ltv_recorrente, 0)::numeric AS ltv
    FROM cortex_core.vw_lt_contratos
    WHERE tipo_receita = 'recorrente' AND is_ativo
    ORDER BY valorr DESC NULLS LAST
  `);

  const linhas = (result.rows as unknown as ContratoAtivoRow[]).map((r) => ({
    cliente: r.cliente,
    produto: r.produto,
    mrr: Number(r.mrr) || 0,
    ltv: Number(r.ltv) || 0,
  }));

  return {
    titulo: "Contratos Recorrentes Ativos",
    subtitulo: `${linhas.length.toLocaleString("pt-BR")} contratos · foto do agora`,
    colunas: [
      { chave: "cliente", label: "Cliente", tipo: "text" },
      { chave: "produto", label: "Produto", tipo: "text" },
      { chave: "mrr", label: "MRR", tipo: "brl" },
      { chave: "ltv", label: "LTV", tipo: "brl" },
    ],
    linhas,
    // `total` = CONTAGEM de contratos (int), não soma de MRR/LTV — mrr/ltv (2 colunas "brl") já
    // são somadas individualmente pelo DrillSheet (ver sua docstring de `total`). `totalTipo:
    // "int"` evita formatar esta contagem como moeda. Ainda LATENTE (não wired — ver nota acima).
    total: linhas.length,
    totalTipo: "int",
  };
}

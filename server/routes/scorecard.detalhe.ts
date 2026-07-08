// server/routes/scorecard.detalhe.ts
// Drill genérico do Scorecard executivo (Fase 1 — infra + piloto Churn; Fase 2A — demais tipos
// SOMÁVEIS: mrr_ativo, entregue, geração de caixa, estoque, cross-sell, upsell/downsell, venda
// pontual, contribuição por squad, contratos ativos (server/routes/scorecard.detalhe.helpers.ts);
// Fase 2C-i — composições do Capacity: receita_cabeca, geracao_liquida, conversao_caixa
// (server/routes/scorecard.detalhe.composicoes.ts)) — GET
// /api/scorecard/detalhe?tipo=&mes=&dim=&valor=. Dado um {tipo, mes, dim?, valor?}, monta o
// detalhe auditável (colunas + linhas + total) que alimenta o DrillSheet do painel
// (client/src/pages/painel-executivo/scorecard/tipos.ts: DrillDetalhe).
//
// Cada tipo REUSA a mesma fonte/exclusões da série/card que o originou — o `total` do drill
// precisa reconciliar com o número da linha (mesma regra já seguida por
// server/routes/gestaoReceita.detalhe.ts). Ver docstring de cada `montar*Detalhe` abaixo para a
// fonte espelhada.
import type { Express } from "express";
import { isAuthenticated } from "../auth/middleware";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { limitesMes } from "./scorecard.helpers";
import { montarDetalhe as montarDetalheGestaoReceita } from "./gestaoReceita.detalhe";
import * as fase2a from "./scorecard.detalhe.helpers";
import * as fase2ci from "./scorecard.detalhe.composicoes";
import * as fase2cii from "./scorecard.detalhe.ltltv";

// Reexport p/ compatibilidade — `limitesMes` foi movida p/ scorecard.helpers.ts (Fase 2A) pra
// permitir que `scorecard.detalhe.helpers.ts` a importe sem criar circular import com este
// arquivo. `scorecard.detalhe.test.ts` continua importando daqui.
export { limitesMes };

const MES_REGEX = /^\d{4}-\d{2}$/;

export interface DrillColuna {
  chave: string;
  label: string;
  tipo?: "brl" | "int" | "pct" | "text";
}

export interface DrillDetalhe {
  titulo: string;
  subtitulo?: string;
  colunas: DrillColuna[];
  /** Cada linha pode incluir `${chave}Tipo` (ex: `valorTipo: "int"`) para sobrescrever, SÓ NAQUELA
     linha, o `tipo` declarado em `colunas` para aquela coluna — usado pelas composições da Fase
     2C-i (`receita_cabeca`, `conversao_caixa`), onde a mesma coluna "valor" mistura brl/int/pct
     entre os componentes (ex: "Nº de pessoas" é int, "= Conversão" é pct, o resto é brl). Ver
     `fmt()` em client/src/pages/painel-executivo/DrillSheet.tsx. Colunas sem essa necessidade
     (a maioria) não usam a convenção — o `tipo` da coluna já basta. */
  linhas: Record<string, unknown>[];
  /** Omitido para composições (ex: `churn_pct`) — soma dos componentes não é uma leitura útil
     (é uma razão, não um total). */
  total?: number;
  /** Presente quando `total` NÃO é a soma de uma coluna "brl" (ex: `contratos_ativos`: `total` é
     uma CONTAGEM de linhas) — diz ao DrillSheet o tipo certo para formatar `total` no rodapé.
     Ver DrillColuna["tipo"]/DrillSheet.tsx (client). */
  totalTipo?: DrillColuna["tipo"];
  /** Só presente em drills de COMPOSIÇÃO (ex: `churn_pct`) — texto exibido acima da tabela. */
  formula?: string;
}

// ---------------------------------------------------------------------------
// Churn Recorrente (cortex_core.vw_cup_churn_ajustado) — mesma fonte/exclusões de
// `fetchChurnPorDimensao` (server/routes/scorecard.ts), que alimenta os cards/séries
// `churn_geral_brl`/"Churn Recorrente — Por produto/operador/squad/Motivos".
// ---------------------------------------------------------------------------

/** dim (do client, ver ScorecardRow.drillParams) → coluna real da view. Whitelist fixa — nunca
   aceita um nome de coluna arbitrário do request; `dim` só entra em `sql.raw` DEPOIS de validado
   contra este mapa (mesmo cuidado do `ChurnDim`/`sql.raw(dim)` em scorecard.ts). */
export const DIM_COLUNA_CHURN_RECORRENTE: Record<string, string> = {
  produto: "produto",
  operador: "responsavel_geral",
  squad: "squad",
  motivo: "motivo_cancelamento",
};

/** Como `DIM_COLUNA_CHURN_RECORRENTE`, para o Churn Pontual (`cup_contratos`) — `operador` mapeia
   para `responsavel` aqui (não `responsavel_geral`, que só existe na view/cup_clientes). */
export const DIM_COLUNA_CHURN_PONTUAL: Record<string, string> = {
  produto: "produto",
  operador: "responsavel",
  squad: "squad",
  motivo: "motivo_cancelamento",
};

const DIM_LABEL: Record<string, string> = {
  produto: "Produto",
  operador: "Operador",
  squad: "Squad",
  motivo: "Motivo",
};

/** Filtro `AND COALESCE(NULLIF(TRIM(<alias>.<coluna>),''),'Não Informado') = <valor>` — mesma
   regra de bucketização de `fetchChurnPorDimensao`/`fetchChurnPontualPorDimensao` (garante que
   clicar no bucket "Não Informado" da série filtre as linhas com a coluna nula/vazia). `alias` e
   `coluna` são sempre literais do nosso código (nunca do request) — só `valor` é parametrizado
   normalmente pelo `sql` tag. */
function filtroDimSql(alias: string, coluna: string | undefined, valor: string | undefined) {
  if (!coluna || !valor) return sql``;
  return sql` AND COALESCE(NULLIF(TRIM(${sql.raw(`${alias}.${coluna}`)}),''),'Não Informado') = ${valor}`;
}

function tituloComDim(base: string, dim?: string, valor?: string): string {
  if (!dim || !valor) return base;
  return `${base} — ${DIM_LABEL[dim] ?? dim}: ${valor}`;
}

const COLUNAS_CHURN: DrillColuna[] = [
  { chave: "cliente", label: "Cliente", tipo: "text" },
  { chave: "produto", label: "Produto", tipo: "text" },
  { chave: "motivo", label: "Motivo", tipo: "text" },
  { chave: "operador", label: "Responsável", tipo: "text" },
  { chave: "squad", label: "Squad", tipo: "text" },
  { chave: "valor", label: "Valor", tipo: "brl" },
];

/** Como `COLUNAS_CHURN`, + coluna "Abonado" (Sim/Não) — só usada pelo Churn Recorrente GERAL
   (sem `dim`), que agora inclui abonados na soma (ver `montarChurnRecorrenteDetalhe`). A coluna
   dá transparência: mostra QUAIS linhas são abonadas em vez de escondê-las silenciosamente. */
const COLUNAS_CHURN_RECORRENTE: DrillColuna[] = [...COLUNAS_CHURN, { chave: "abonado", label: "Abonado", tipo: "text" }];

interface ChurnDetalheRow {
  cliente: string | null;
  produto: string | null;
  motivo: string | null;
  operador: string | null;
  squad: string | null;
  valor: number | string;
  /** Só preenchido pelo Churn Recorrente (`abonado`: "Sim"/"Não") — Churn Pontual não tem esse
     conceito (cup_contratos não tem `abonar_churn`), reusa a mesma interface sem essa chave. */
  abonado?: string;
}

/** Churn Recorrente — lista de contratos churnados no mês.
   SEM `dim` (GERAL): mesma fonte/exclusões do CARD "Churn R$" (`turboMetrics.churnMrr`,
   `relatorioMensalSlides.ts` ~L428-434) — `valor_r > 0`, motivo fora dos 3 que não contam como
   churn legítimo, mas SEM excluir abonados (o card soma TODOS, decisão de 2026-06-18 documentada
   naquele arquivo). Antes este drill excluía abonados incondicionalmente e o total ficava ABAIXO
   do card (ex.: R$146.177 vs R$150.174 em 2026-06) — fix: geral agora bate byte-a-byte com o
   card; a coluna "Abonado" (Sim/Não) mantém a transparência de quais linhas são abonadas.
   COM `dim` (breakdown por produto/operador/squad/motivo): CONTINUA excluindo abonados
   (`abonar_churn <> 'Sim'`) — mesma fonte/exclusões de `fetchChurnPorDimensao` (scorecard.ts),
   que também exclui; não mudar isso quebraria a reconciliação com aquelas séries. */
export async function montarChurnRecorrenteDetalhe(mes: string, dim?: string, valor?: string): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);
  const coluna = dim ? DIM_COLUNA_CHURN_RECORRENTE[dim] : undefined;
  const filtroDim = filtroDimSql("c", coluna, valor);
  const filtroAbonado = dim ? sql`AND COALESCE(c.abonar_churn,'') <> 'Sim'` : sql``;

  const result = await db.execute(sql`
    SELECT cl.nome AS cliente, c.produto AS produto, c.motivo_cancelamento AS motivo,
           c.responsavel_geral AS operador, c.squad AS squad, c.valor_r::numeric AS valor,
           CASE WHEN COALESCE(c.abonar_churn,'') = 'Sim' THEN 'Sim' ELSE 'Não' END AS abonado
    FROM cortex_core.vw_cup_churn_ajustado c
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.parent_id
    WHERE c.valor_r > 0
      AND c.data_solicitacao_encerramento >= ${inicio}::date AND c.data_solicitacao_encerramento < ${fim}::date
      ${filtroAbonado}
      AND COALESCE(c.motivo_cancelamento,'') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
      ${filtroDim}
    ORDER BY valor DESC
  `);

  const linhas = (result.rows as unknown as ChurnDetalheRow[]).map((r) => ({ ...r, valor: Number(r.valor) || 0 }));
  const total = linhas.reduce((acc, r) => acc + (r.valor as number), 0);

  return {
    titulo: tituloComDim("Churn Recorrente", dim, valor),
    subtitulo: `${linhas.length} contrato${linhas.length === 1 ? "" : "s"} · ${mes}`,
    colunas: dim ? COLUNAS_CHURN : COLUNAS_CHURN_RECORRENTE,
    linhas,
    total,
  };
}

/** Churn Pontual — lista de contratos (entregas) churnados no mês, mesma fonte/exclusões de
   `fetchChurnPontualPorDimensao`: `servico ILIKE '%entrega%'`, status de churn, `valorp > 0`,
   bucketizado por `data_solicitacao_encerramento`. */
export async function montarChurnPontualDetalhe(mes: string, dim?: string, valor?: string): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);
  const coluna = dim ? DIM_COLUNA_CHURN_PONTUAL[dim] : undefined;
  const filtroDim = filtroDimSql("ct", coluna, valor);

  const result = await db.execute(sql`
    SELECT cl.nome AS cliente, ct.produto AS produto, ct.motivo_cancelamento AS motivo,
           ct.responsavel AS operador, ct.squad AS squad, ct.valorp::numeric AS valor
    FROM "Clickup".cup_contratos ct
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
    WHERE ct.servico ILIKE '%entrega%'
      AND LOWER(TRIM(ct.status)) IN ('cancelado/inativo','não usar')
      AND ct.valorp > 0
      AND ct.data_solicitacao_encerramento >= ${inicio}::date AND ct.data_solicitacao_encerramento < ${fim}::date
      ${filtroDim}
    ORDER BY valor DESC
  `);

  const linhas = (result.rows as unknown as ChurnDetalheRow[]).map((r) => ({ ...r, valor: Number(r.valor) || 0 }));
  const total = linhas.reduce((acc, r) => acc + (r.valor as number), 0);

  return {
    titulo: tituloComDim("Churn Pontual", dim, valor),
    subtitulo: `${linhas.length} contrato${linhas.length === 1 ? "" : "s"} · ${mes}`,
    colunas: COLUNAS_CHURN,
    linhas,
    total,
  };
}

// ---------------------------------------------------------------------------
// Churn % (composição) — Churn R$ ÷ MRR base (início do mês).
// ---------------------------------------------------------------------------

/** Monta o payload de composição a partir dos 2 componentes já calculados — pura/testável sem
   banco (ver scorecard.detalhe.test.ts). `total` omitido de propósito: é uma RAZÃO, não uma
   soma auditável dos 2 componentes. */
export function montarChurnPctDrillDetalhe(churnTotal: number, mrrBase: number): DrillDetalhe {
  return {
    titulo: "Churn % — Composição",
    subtitulo: mrrBase > 0 ? `${((churnTotal / mrrBase) * 100).toFixed(1)}%` : undefined,
    formula:
      "Churn % = Churn R$ ÷ MRR base (início do mês). MRR base = snapshot do 1º dia do mês " +
      "(\"Clickup\".cup_data_hist), status ativo/onboarding/triagem, excluindo contratos hoje " +
      "marcados 'excluído' (mesma definição de getMrrInicioMes em server/okr2026/metricsAdapter.ts, " +
      "aqui parametrizada por mês em vez de sempre o mês corrente). Pode divergir levemente do " +
      "'Churn %' exibido no card quando o card cobrir um período de mais de 1 mês (naquele caso " +
      "é uma média ponderada multi-mês; aqui é sempre o mês único selecionado).",
    colunas: [
      { chave: "componente", label: "Componente", tipo: "text" },
      { chave: "valor", label: "Valor", tipo: "brl" },
    ],
    linhas: [
      { componente: "Churn R$", valor: churnTotal },
      { componente: "MRR base (início do mês)", valor: mrrBase },
    ],
  };
}

/** MRR base no início do mês — mesma definição de `getMrrInicioMes` (server/okr2026/
   metricsAdapter.ts), mas parametrizada por `mes` em vez de sempre `NOW()`. */
async function fetchMrrInicioMes(mes: string): Promise<number> {
  const result = await db.execute(sql`
    WITH primeiro_snapshot_mes AS (
      SELECT MIN(data_snapshot) AS data_primeiro
      FROM "Clickup".cup_data_hist
      WHERE TO_CHAR(data_snapshot,'YYYY-MM') = ${mes}
    )
    SELECT COALESCE(SUM(h.valorr::numeric),0) AS total
    FROM "Clickup".cup_data_hist h
    JOIN primeiro_snapshot_mes ps ON h.data_snapshot = ps.data_primeiro
    WHERE h.status IN ('ativo','onboarding','triagem')
      AND h.valorr IS NOT NULL AND h.valorr > 0
      AND NOT EXISTS (
        SELECT 1 FROM "Clickup".cup_contratos c WHERE c.id_task = h.id_task AND c.status = 'excluído'
      )
  `);
  return Number((result.rows[0] as { total?: number | string })?.total) || 0;
}

/** Churn R$ do mês — mesma fonte/exclusões de `montarChurnRecorrenteDetalhe` (sem dim/valor,
   sempre o total). Consulta agregada em vez de reusar `montarChurnRecorrenteDetalhe` para não
   listar/transformar as linhas individuais só para somá-las de novo. */
async function fetchChurnTotalMes(mes: string): Promise<number> {
  const { inicio, fim } = limitesMes(mes);
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(valor_r),0)::numeric AS total
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE valor_r > 0
      AND data_solicitacao_encerramento >= ${inicio}::date AND data_solicitacao_encerramento < ${fim}::date
      AND COALESCE(abonar_churn,'') <> 'Sim'
      AND COALESCE(motivo_cancelamento,'') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
  `);
  return Number((result.rows[0] as { total?: number | string })?.total) || 0;
}

export async function montarChurnPctDetalhe(mes: string): Promise<DrillDetalhe> {
  const [churnTotal, mrrBase] = await Promise.all([fetchChurnTotalMes(mes), fetchMrrInicioMes(mes)]);
  return montarChurnPctDrillDetalhe(churnTotal, mrrBase);
}

// ---------------------------------------------------------------------------
// venda_mrr — delega para o dispatcher de Gestão de Receita (mesma query/definição do drill de
// "Nova receita" que já existia antes desta Fase, migrado para drillParams centralizado).
// ---------------------------------------------------------------------------

interface DetalheResultGestaoReceita {
  titulo: string;
  subtitulo: string;
  total: number;
  grupos: { titulo: string; total: number }[];
}

/** Converte o `DetalheResult` de `gestaoReceita.detalhe.ts` (grupos agregados) no `DrillDetalhe`
   genérico deste endpoint — pura/testável. Cada grupo já tem `titulo`/`total`, o mesmo shape que
   o DrillSheet espera nas colunas "Grupo"/"Valor" (mesmo padrão que SecaoReceita.tsx usava antes
   desta Fase, agora centralizado aqui). */
export function converterDetalheGestaoReceita(detalhe: DetalheResultGestaoReceita): DrillDetalhe {
  return {
    titulo: detalhe.titulo,
    subtitulo: detalhe.subtitulo,
    colunas: [
      { chave: "titulo", label: "Grupo", tipo: "text" },
      { chave: "total", label: "Valor", tipo: "brl" },
    ],
    linhas: detalhe.grupos,
    total: detalhe.total,
  };
}

async function montarVendaMrrDetalhe(mes: string): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);
  const detalhe = await montarDetalheGestaoReceita(db, { tipo: "venda_mrr", chave: "mrr", dIni: inicio, dFim: fim, label: mes });
  return converterDetalheGestaoReceita(detalhe);
}

/** venda_pontual — Fase 2A, mesmo padrão de `montarVendaMrrDetalhe` trocando o tipo delegado
   (`gestaoReceita.detalhe.ts` já implementa "venda_pontual": deals ganhos com valor_pontual > 0
   no mês). */
async function montarVendaPontualDetalhe(mes: string): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);
  const detalhe = await montarDetalheGestaoReceita(db, { tipo: "venda_pontual", chave: "pontual", dIni: inicio, dFim: fim, label: mes });
  return converterDetalheGestaoReceita(detalhe);
}

// ---------------------------------------------------------------------------
// Dispatcher + rota
// ---------------------------------------------------------------------------

export interface DetalheScorecardQuery {
  tipo: string;
  mes: string;
  dim?: string;
  valor?: string;
}

/** Dispatcher por `tipo` — `null` quando o tipo não é suportado (rota devolve 400). Fase 1
   implementou o piloto Churn + `venda_mrr` (migrado de SecaoReceita). Fase 2A acrescenta os
   demais tipos SOMÁVEIS (builders pesados vivem em `scorecard.detalhe.helpers.ts` — extraídos de
   propósito p/ este arquivo não passar de 500 linhas, ver constraint da Fase 2A). Fase 2C-i
   acrescenta as composições do Capacity (`receita_cabeca`, `geracao_liquida`, `conversao_caixa`
   — razões/derivados, sem `total`, mesmo padrão de `churn_pct`). Fase 2C-ii (última) acrescenta a
   auditoria de LT/LTV, lead time e maiores clientes (`ltv_medio`, `lt_medio`, `mediana_ltv`,
   `mediana_lt`, `lead_time`, `cliente_contratos` — builders em `scorecard.detalhe.ltltv.ts`,
   padrão "lista de contexto": média/mediana no `formula`, sem `total`, exceto
   `cliente_contratos`, que é somável). */
export async function montarDetalheScorecard(q: DetalheScorecardQuery): Promise<DrillDetalhe | null> {
  switch (q.tipo) {
    case "churn_recorrente":
      return montarChurnRecorrenteDetalhe(q.mes, q.dim, q.valor);
    case "churn_pontual":
      return montarChurnPontualDetalhe(q.mes, q.dim, q.valor);
    case "churn_pct":
      return montarChurnPctDetalhe(q.mes);
    case "receita_cabeca":
      return fase2ci.montarReceitaCabecaDetalhe(q.mes, q.dim, q.valor);
    case "geracao_liquida":
      return fase2ci.montarGeracaoLiquidaDetalhe(q.mes);
    case "conversao_caixa":
      return fase2ci.montarConversaoCaixaDetalhe(q.mes);
    case "venda_mrr":
      return montarVendaMrrDetalhe(q.mes);
    case "venda_pontual":
      return montarVendaPontualDetalhe(q.mes);
    case "mrr_ativo":
      return fase2a.montarMrrAtivoDetalhe(q.mes, q.dim, q.valor);
    case "entregue":
      return fase2a.montarEntregueDetalhe(q.mes, q.dim, q.valor);
    case "geracao_caixa_receita":
      return fase2a.montarGeracaoCaixaDetalhe(q.mes, "RECEITA");
    case "geracao_caixa_despesa":
      return fase2a.montarGeracaoCaixaDetalhe(q.mes, "DESPESA");
    case "estoque_aberto":
      return fase2a.montarEstoqueDetalhe(q.mes, "aberto");
    case "estoque_pausado":
      return fase2a.montarEstoqueDetalhe(q.mes, "pausado");
    case "cross_sell":
      return fase2a.montarCrossSellDetalhe(q.mes);
    case "upsell":
      return fase2a.montarUpsellDownsellDetalhe(q.mes, "expansao");
    case "downsell":
      return fase2a.montarUpsellDownsellDetalhe(q.mes, "churn_downsell");
    case "contribuicao_squad":
      return fase2a.montarContribuicaoSquadDetalhe(q.mes, q.valor);
    case "contratos_ativos":
      return fase2a.montarContratosAtivosDetalhe();
    case "ltv_medio":
      return fase2cii.montarLtvMedioDetalhe(q.valor);
    case "lt_medio":
      return fase2cii.montarLtMedioDetalhe(q.valor);
    case "mediana_ltv":
      return fase2cii.montarMedianaLtvDetalhe(q.valor);
    case "mediana_lt":
      return fase2cii.montarMedianaLtDetalhe(q.valor);
    case "lead_time":
      return fase2cii.montarLeadTimeDetalhe(q.mes, q.valor);
    case "cliente_contratos":
      return fase2cii.montarClienteContratosDetalhe(q.valor);
    default:
      return null;
  }
}

export function registerScorecardDetalheRoutes(app: Express) {
  app.get("/api/scorecard/detalhe", isAuthenticated, async (req, res) => {
    const tipo = typeof req.query.tipo === "string" ? req.query.tipo : undefined;
    const mes = typeof req.query.mes === "string" ? req.query.mes : undefined;
    const dim = typeof req.query.dim === "string" ? req.query.dim : undefined;
    const valor = typeof req.query.valor === "string" ? req.query.valor : undefined;

    if (!tipo) return res.status(400).json({ error: "Parâmetro 'tipo' é obrigatório." });
    if (!mes || !MES_REGEX.test(mes)) {
      return res.status(400).json({ error: "Parâmetro 'mes' inválido. Use o formato YYYY-MM." });
    }

    try {
      const detalhe = await montarDetalheScorecard({ tipo, mes, dim, valor });
      if (!detalhe) return res.status(400).json({ error: `tipo '${tipo}' não suportado.` });
      res.json(detalhe);
    } catch (error) {
      console.error("[api] Error em /api/scorecard/detalhe:", error);
      res.status(500).json({ error: "Falha ao montar detalhe do scorecard" });
    }
  });
}

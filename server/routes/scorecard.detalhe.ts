// server/routes/scorecard.detalhe.ts
// Drill genérico do Scorecard executivo (Fase 1 — infra + piloto Churn) — GET
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
import { addMeses } from "./scorecard.helpers";
import { montarDetalhe as montarDetalheGestaoReceita } from "./gestaoReceita.detalhe";

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
  linhas: Record<string, unknown>[];
  /** Omitido para composições (ex: `churn_pct`) — soma dos componentes não é uma leitura útil
     (é uma razão, não um total). */
  total?: number;
  /** Só presente em drills de COMPOSIÇÃO (ex: `churn_pct`) — texto exibido acima da tabela. */
  formula?: string;
}

/** Limites [inicio, fim) do mês (YYYY-MM-DD) — mesmo padrão de `montarSeriesScorecard` em
   scorecard.ts. */
export function limitesMes(mes: string): { inicio: string; fim: string } {
  return { inicio: `${mes}-01`, fim: `${addMeses(mes, 1)}-01` };
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

interface ChurnDetalheRow {
  cliente: string | null;
  produto: string | null;
  motivo: string | null;
  operador: string | null;
  squad: string | null;
  valor: number | string;
}

/** Churn Recorrente — lista de contratos churnados no mês, mesma fonte/exclusões de
   `fetchChurnPorDimensao`: `valor_r > 0`, `abonar_churn <> 'Sim'`, motivo fora dos 3 que não
   contam como churn legítimo. `dim`/`valor` (opcionais) filtram um breakdown específico
   (ex: clique em "Performance" na seção "Por produto"). */
export async function montarChurnRecorrenteDetalhe(mes: string, dim?: string, valor?: string): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);
  const coluna = dim ? DIM_COLUNA_CHURN_RECORRENTE[dim] : undefined;
  const filtroDim = filtroDimSql("c", coluna, valor);

  const result = await db.execute(sql`
    SELECT cl.nome AS cliente, c.produto AS produto, c.motivo_cancelamento AS motivo,
           c.responsavel_geral AS operador, c.squad AS squad, c.valor_r::numeric AS valor
    FROM cortex_core.vw_cup_churn_ajustado c
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.parent_id
    WHERE c.valor_r > 0
      AND c.data_solicitacao_encerramento >= ${inicio}::date AND c.data_solicitacao_encerramento < ${fim}::date
      AND COALESCE(c.abonar_churn,'') <> 'Sim'
      AND COALESCE(c.motivo_cancelamento,'') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
      ${filtroDim}
    ORDER BY valor DESC
  `);

  const linhas = (result.rows as unknown as ChurnDetalheRow[]).map((r) => ({ ...r, valor: Number(r.valor) || 0 }));
  const total = linhas.reduce((acc, r) => acc + (r.valor as number), 0);

  return {
    titulo: tituloComDim("Churn Recorrente", dim, valor),
    subtitulo: `${linhas.length} contrato${linhas.length === 1 ? "" : "s"} · ${mes}`,
    colunas: COLUNAS_CHURN,
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

// ---------------------------------------------------------------------------
// Dispatcher + rota
// ---------------------------------------------------------------------------

export interface DetalheScorecardQuery {
  tipo: string;
  mes: string;
  dim?: string;
  valor?: string;
}

/** Dispatcher por `tipo` — `null` quando o tipo não é suportado (rota devolve 400). Fase 1 só
   implementa os tipos do piloto Churn + `venda_mrr` (migrado de SecaoReceita). Próximas fases:
   demais seções do Scorecard (Entregas, Capacity, LT/LTV, Performance). */
export async function montarDetalheScorecard(q: DetalheScorecardQuery): Promise<DrillDetalhe | null> {
  switch (q.tipo) {
    case "churn_recorrente":
      return montarChurnRecorrenteDetalhe(q.mes, q.dim, q.valor);
    case "churn_pontual":
      return montarChurnPontualDetalhe(q.mes, q.dim, q.valor);
    case "churn_pct":
      return montarChurnPctDetalhe(q.mes);
    case "venda_mrr":
      return montarVendaMrrDetalhe(q.mes);
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

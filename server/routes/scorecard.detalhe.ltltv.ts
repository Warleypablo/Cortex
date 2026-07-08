// server/routes/scorecard.detalhe.ltltv.ts
// Fase 2C-ii — auditoria de LT/LTV, lead time e maiores clientes do dispatcher de detalhe do
// Scorecard (server/routes/scorecard.detalhe.ts). Extraído para cá (em vez de
// scorecard.detalhe.helpers.ts, já em 469 linhas) para nenhum arquivo passar de 500 linhas.
//
// Padrão "lista de contexto" (diferente das Fases 2A/2C-i): médias/medianas NÃO somam a um
// total — o `DrillDetalhe` aqui vem SEM `total`, com a estatística (média/mediana) exibida no
// `formula` acima da tabela, e a tabela lista os itens que compõem essa estatística (mesmo
// padrão de `montarChurnPctDrillDetalhe`/composições, mas para estatísticas de posição em vez de
// razões). Só `cliente_contratos` foge disso: é uma lista SOMÁVEL (contratos de 1 cliente), então
// tem `total` normal.
import { sql } from "drizzle-orm";
import { db } from "../db";
import { limitesMes } from "./scorecard.helpers";
import type { DrillDetalhe } from "./scorecard.detalhe";

/** "R$ 1.234" — mesmo padrão duplicado em scorecard.detalhe.composicoes.ts (não há util de
   formatação compartilhado entre os arquivos de detalhe). */
function brl(n: number): string {
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

function calcularMedia(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((acc, v) => acc + v, 0) / valores.length;
}

/** Mediana + os índices (no array de entrada) do(s) elemento(s) na posição mediana — n ímpar
   marca 1 índice, n par marca os 2 do meio (mediana = média deles). Pura/testável sem banco. */
export function calcularMedianaComIndices(valores: number[]): { mediana: number; indices: number[] } {
  if (valores.length === 0) return { mediana: 0, indices: [] };
  const ordenados = valores.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const n = ordenados.length;
  if (n % 2 === 1) {
    const meio = ordenados[(n - 1) / 2];
    return { mediana: meio.v, indices: [meio.i] };
  }
  const a = ordenados[n / 2 - 1];
  const b = ordenados[n / 2];
  return { mediana: (a.v + b.v) / 2, indices: [a.i, b.i].sort((x, y) => x - y) };
}

// ---------------------------------------------------------------------------
// ltv_medio / lt_medio / mediana_ltv / mediana_lt — base compartilhada: clientes agregados por
// id_task, mesmo agregado de `/api/lt-ltv-churn/clientes` (server/routes/ltLtvChurn.ts:421-483),
// SEM paginação (a rota pagina em 50; aqui precisamos da base INTEIRA p/ média/mediana baterem) e
// com `produtos` a mais (STRING_AGG dos produtos distintos do cliente — aquele endpoint não
// expõe). `ltMeses` usa a MESMA fórmula por CLIENTE daquele endpoint (da 1ª contratação
// recorrente até hoje/data_fim) — diverge POR DESENHO do LT por CONTRATO usado em
// `overview.ltMedioAtivo`/`ltMedioCancelado` (AVG(lt_meses) direto em vw_lt_contratos, grão
// contrato): ~6.9 meses (cliente, ativo) vs ~6.2 (contrato, ativo) em 2026-06 — mesma classe de
// divergência já documentada para "Total recorrentes" (montarContratosAtivosDetalhe,
// scorecard.detalhe.helpers.ts). Também diverge de `overview.ltvMedioCliente` (aquele soma TODOS
// os clientes sem filtrar status; aqui filtramos ativo/cancelado explicitamente, por pedido desta
// Fase) — ~R$29,7k (ativo) vs ~R$16k (geral) em 2026-06.
// ---------------------------------------------------------------------------

export interface ClienteLtLtvRow {
  idTask: string;
  nomeCliente: string | null;
  produtos: string | null;
  ltvTotal: number;
  ltMeses: number | null;
}

interface RawClienteLtLtvRow {
  id_task: string;
  nome_cliente: string | null;
  produtos: string | null;
  ltv_total: number | string;
  lt_meses: number | string | null;
}

const STATUS_LABEL: Record<"ativo" | "cancelado", string> = { ativo: "ativos", cancelado: "cancelados" };

/** `valor` do request (ativo|cancelado) → status resolvido, default "ativo" (mesma regra para os
   4 tipos desta seção, conforme pedido da Fase). */
function resolverStatusCliente(valor?: string): "ativo" | "cancelado" {
  return valor === "cancelado" ? "cancelado" : "ativo";
}

async function fetchClientesLtLtv(status: "ativo" | "cancelado"): Promise<ClienteLtLtvRow[]> {
  const having = status === "ativo" ? sql`HAVING BOOL_OR(is_ativo)` : sql`HAVING NOT BOOL_OR(is_ativo)`;

  const result = await db.execute(sql`
    SELECT id_task,
      MAX(nome_cliente) AS nome_cliente,
      STRING_AGG(DISTINCT NULLIF(TRIM(produto),''), ', ' ORDER BY NULLIF(TRIM(produto),'')) AS produtos,
      ROUND((SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)))::numeric, 0) AS ltv_total,
      CASE
        WHEN BOOL_OR(is_ativo) FILTER (WHERE tipo_receita='recorrente')
          THEN ROUND((CURRENT_DATE - MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente'))::numeric / 30.44, 1)
        WHEN MAX(data_fim) FILTER (WHERE tipo_receita='recorrente' AND NOT data_inconsistente) >= MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente')
          THEN ROUND((MAX(data_fim) FILTER (WHERE tipo_receita='recorrente' AND NOT data_inconsistente) - MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente'))::numeric / 30.44, 1)
        ELSE NULL
      END AS lt_meses
    FROM cortex_core.vw_lt_contratos
    WHERE data_inicio IS NOT NULL
    GROUP BY id_task
    ${having}
    ORDER BY ltv_total DESC
    LIMIT 2000
  `);

  return (result.rows as unknown as RawClienteLtLtvRow[]).map((r) => ({
    idTask: r.id_task,
    nomeCliente: r.nome_cliente,
    produtos: r.produtos,
    ltvTotal: Number(r.ltv_total) || 0,
    ltMeses: r.lt_meses != null ? Number(r.lt_meses) : null,
  }));
}

const COLUNAS_CLIENTE_LTV = [
  { chave: "cliente", label: "Cliente", tipo: "text" as const },
  { chave: "produtos", label: "Produto(s)", tipo: "text" as const },
  { chave: "ltvTotal", label: "LTV total", tipo: "brl" as const },
];

const COLUNAS_CLIENTE_LT = [
  { chave: "cliente", label: "Cliente", tipo: "text" as const },
  { chave: "produtos", label: "Produto(s)", tipo: "text" as const },
  { chave: "ltMeses", label: "LT (meses)", tipo: "text" as const },
];

/** Pura/testável sem banco (mesmo padrão de `montarChurnPctDrillDetalhe`). Sem `total` — é uma
   MÉDIA, não uma soma auditável (a "reconciliação" é a própria estatística no `formula`). */
export function montarLtvMedioDrillDetalhe(clientes: ClienteLtLtvRow[], status: "ativo" | "cancelado"): DrillDetalhe {
  const media = calcularMedia(clientes.map((c) => c.ltvTotal));
  const linhas = clientes.map((c) => ({ cliente: c.nomeCliente ?? "—", produtos: c.produtos ?? "—", ltvTotal: c.ltvTotal }));

  return {
    titulo: `LTV Médio por Cliente — ${STATUS_LABEL[status]}`,
    subtitulo: `${clientes.length} cliente${clientes.length === 1 ? "" : "s"} ${STATUS_LABEL[status]}`,
    formula: `Média de ${clientes.length} clientes = ${brl(media)}`,
    colunas: COLUNAS_CLIENTE_LTV,
    linhas,
  };
}

export async function montarLtvMedioDetalhe(valor?: string): Promise<DrillDetalhe> {
  const status = resolverStatusCliente(valor);
  const clientes = await fetchClientesLtLtv(status);
  return montarLtvMedioDrillDetalhe(clientes, status);
}

/** Só entram clientes com `ltMeses` definido (têm ao menos 1 contrato recorrente com LT
   calculável — ver CASE em `fetchClientesLtLtv`); clientes só-pontual ficam de fora (não têm LT
   recorrente). Pura/testável sem banco. */
export function montarLtMedioDrillDetalhe(clientes: ClienteLtLtvRow[], status: "ativo" | "cancelado"): DrillDetalhe {
  const comLt = clientes.filter((c): c is ClienteLtLtvRow & { ltMeses: number } => c.ltMeses != null);
  const ordenado = [...comLt].sort((a, b) => b.ltMeses - a.ltMeses);
  const media = calcularMedia(ordenado.map((c) => c.ltMeses));
  const linhas = ordenado.map((c) => ({ cliente: c.nomeCliente ?? "—", produtos: c.produtos ?? "—", ltMeses: c.ltMeses }));

  return {
    titulo: `LT Médio por Cliente — ${STATUS_LABEL[status]}`,
    subtitulo: `${ordenado.length} cliente${ordenado.length === 1 ? "" : "s"} ${STATUS_LABEL[status]} (com LT definido)`,
    formula: `Média de ${ordenado.length} clientes = ${media.toFixed(1)} meses`,
    colunas: COLUNAS_CLIENTE_LT,
    linhas,
  };
}

export async function montarLtMedioDetalhe(valor?: string): Promise<DrillDetalhe> {
  const status = resolverStatusCliente(valor);
  const clientes = await fetchClientesLtLtv(status);
  return montarLtMedioDrillDetalhe(clientes, status);
}

/** Mesma lista/ordem de `montarLtvMedioDrillDetalhe` (desc por LTV) — marca a linha na posição
   mediana com "◄ mediana" na coluna extra `posicao` (n par marca as 2 linhas do meio). Pura/
   testável sem banco. */
export function montarMedianaLtvDrillDetalhe(clientes: ClienteLtLtvRow[], status: "ativo" | "cancelado"): DrillDetalhe {
  const ordenado = [...clientes].sort((a, b) => b.ltvTotal - a.ltvTotal);
  const { mediana, indices } = calcularMedianaComIndices(ordenado.map((c) => c.ltvTotal));
  const linhas = ordenado.map((c, i) => ({
    cliente: c.nomeCliente ?? "—",
    produtos: c.produtos ?? "—",
    ltvTotal: c.ltvTotal,
    posicao: indices.includes(i) ? "◄ mediana" : "",
  }));

  return {
    titulo: `LTV Mediano por Cliente — ${STATUS_LABEL[status]}`,
    subtitulo: `${clientes.length} cliente${clientes.length === 1 ? "" : "s"} ${STATUS_LABEL[status]}`,
    formula: `Mediana de ${clientes.length} clientes = ${brl(mediana)}`,
    colunas: [...COLUNAS_CLIENTE_LTV, { chave: "posicao", label: "", tipo: "text" as const }],
    linhas,
  };
}

export async function montarMedianaLtvDetalhe(valor?: string): Promise<DrillDetalhe> {
  const status = resolverStatusCliente(valor);
  const clientes = await fetchClientesLtLtv(status);
  return montarMedianaLtvDrillDetalhe(clientes, status);
}

/** Como `montarMedianaLtvDrillDetalhe`, trocando LTV por LT (só clientes com `ltMeses`
   definido, mesmo filtro de `montarLtMedioDrillDetalhe`). Pura/testável sem banco. */
export function montarMedianaLtDrillDetalhe(clientes: ClienteLtLtvRow[], status: "ativo" | "cancelado"): DrillDetalhe {
  const comLt = clientes.filter((c): c is ClienteLtLtvRow & { ltMeses: number } => c.ltMeses != null);
  const ordenado = [...comLt].sort((a, b) => b.ltMeses - a.ltMeses);
  const { mediana, indices } = calcularMedianaComIndices(ordenado.map((c) => c.ltMeses));
  const linhas = ordenado.map((c, i) => ({
    cliente: c.nomeCliente ?? "—",
    produtos: c.produtos ?? "—",
    ltMeses: c.ltMeses,
    posicao: indices.includes(i) ? "◄ mediana" : "",
  }));

  return {
    titulo: `LT Mediano por Cliente — ${STATUS_LABEL[status]}`,
    subtitulo: `${ordenado.length} cliente${ordenado.length === 1 ? "" : "s"} ${STATUS_LABEL[status]} (com LT definido)`,
    formula: `Mediana de ${ordenado.length} clientes = ${mediana.toFixed(1)} meses`,
    colunas: [...COLUNAS_CLIENTE_LT, { chave: "posicao", label: "", tipo: "text" as const }],
    linhas,
  };
}

export async function montarMedianaLtDetalhe(valor?: string): Promise<DrillDetalhe> {
  const status = resolverStatusCliente(valor);
  const clientes = await fetchClientesLtLtv(status);
  return montarMedianaLtDrillDetalhe(clientes, status);
}

// ---------------------------------------------------------------------------
// lead_time — entregas individuais do mês (cup_contratos), mesma fonte/exclusões de
// `fetchLeadTimePorProduto` (server/routes/scorecard.ts:305): status='entregue', datas não nulas,
// bucketizado por `data_entrega` no mês; aqui SEM agregar (1 linha por contrato entregue) para a
// média do `formula` reconciliar com a série "Lead time por produto" (mesma AVG, grão fino).
// ---------------------------------------------------------------------------

export interface LeadTimeEntregaRow {
  cliente: string | null;
  produto: string;
  dataCriado: string;
  dataEntrega: string;
  dias: number;
}

interface RawLeadTimeEntregaRow {
  cliente: string | null;
  produto: string;
  data_criado: string;
  data_entrega: string;
  dias: number | string;
}

/** Pura/testável sem banco. Sem `total` — é uma MÉDIA (dias), não uma soma auditável. */
export function montarLeadTimeDrillDetalhe(entregas: LeadTimeEntregaRow[], mes: string, produtoFiltro?: string): DrillDetalhe {
  const media = calcularMedia(entregas.map((e) => e.dias));

  return {
    titulo: produtoFiltro ? `Lead Time de Entrega — Produto: ${produtoFiltro}` : "Lead Time de Entrega — Todos os produtos",
    subtitulo: `${entregas.length} entrega${entregas.length === 1 ? "" : "s"} · ${mes}`,
    formula: `Lead time médio = ${media.toFixed(1)} dias (${entregas.length} entregas)`,
    colunas: [
      { chave: "cliente", label: "Cliente", tipo: "text" },
      { chave: "produto", label: "Produto", tipo: "text" },
      { chave: "dataCriado", label: "Criado em", tipo: "text" },
      { chave: "dataEntrega", label: "Entregue em", tipo: "text" },
      { chave: "dias", label: "Dias", tipo: "int" },
    ],
    // `.map` (em vez de reusar `entregas` direto) — mantém `linhas` "fresh" (tipo objeto inferido
    // do literal), atribuível a `DrillDetalhe.linhas: Record<string, unknown>[]`; a interface
    // nomeada `LeadTimeEntregaRow[]` quebra essa atribuição (TS2322: falta index signature),
    // mesma nota de `converterCrossSellDetalhe` em scorecard.detalhe.helpers.ts.
    linhas: entregas.map((e) => ({ ...e })),
  };
}

export async function montarLeadTimeDetalhe(mes: string, produtoFiltro?: string): Promise<DrillDetalhe> {
  const { inicio, fim } = limitesMes(mes);
  const filtroProduto = produtoFiltro
    ? sql` AND COALESCE(NULLIF(TRIM(ct.produto),''),'Sem produto') = ${produtoFiltro}`
    : sql``;

  const result = await db.execute(sql`
    SELECT cl.nome AS cliente,
           COALESCE(NULLIF(TRIM(ct.produto),''),'Sem produto') AS produto,
           TO_CHAR(ct.data_criado,'YYYY-MM-DD') AS data_criado,
           TO_CHAR(ct.data_entrega,'YYYY-MM-DD') AS data_entrega,
           (ct.data_entrega - ct.data_criado)::int AS dias
    FROM "Clickup".cup_contratos ct
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
    WHERE LOWER(TRIM(ct.status))='entregue' AND ct.data_entrega IS NOT NULL AND ct.data_criado IS NOT NULL
      AND ct.data_entrega >= ${inicio}::date AND ct.data_entrega < ${fim}::date
      ${filtroProduto}
    ORDER BY dias DESC
  `);

  const linhas = (result.rows as unknown as RawLeadTimeEntregaRow[]).map((r) => ({
    cliente: r.cliente,
    produto: r.produto,
    dataCriado: r.data_criado,
    dataEntrega: r.data_entrega,
    dias: Number(r.dias) || 0,
  }));

  return montarLeadTimeDrillDetalhe(linhas, mes, produtoFiltro);
}

// ---------------------------------------------------------------------------
// cliente_contratos — contratos (recorrentes + pontuais) de UM cliente, base de "Maiores
// clientes" (lt-ltv-maiores-clientes/performance-maiores-clientes). Único tipo desta Fase que É
// somável (lista de contratos de 1 cliente) — tem `total`, ao contrário dos demais tipos deste
// arquivo. `valor` aceita id_task (idTask do ClienteRow, preferencial) OU nome exato do cliente
// (fallback) — ambos os cards hoje só têm `idTask` disponível, mas o match por nome fica pronto
// para outras origens.
// ---------------------------------------------------------------------------

export interface ContratoClienteRow {
  produto: string | null;
  servico: string | null;
  status: string | null;
  valorr: number;
  valorp: number;
}

interface RawContratoClienteRow {
  nome_cliente: string | null;
  produto: string | null;
  servico: string | null;
  status: string | null;
  valorr: number | string;
  valorp: number | string;
}

const COLUNAS_CLIENTE_CONTRATOS = [
  { chave: "produto", label: "Produto", tipo: "text" as const },
  { chave: "servico", label: "Serviço", tipo: "text" as const },
  { chave: "status", label: "Status", tipo: "text" as const },
  { chave: "valorr", label: "MRR", tipo: "brl" as const },
  { chave: "valorp", label: "Pontual", tipo: "brl" as const },
];

/** Pura/testável sem banco. `total` = Σ MRR + Σ Pontual combinados — mesmo padrão de
   `converterCrossSellDetalhe` (scorecard.detalhe.helpers.ts): não reconcilia coluna a coluna (2
   colunas "brl", o DrillSheet soma cada uma individualmente a partir de `linhas` — ver sua
   docstring de `total`), é o valor total do cliente somando as duas naturezas de receita.
   IMPORTANTE: isso é "contratos ATUAIS do cliente" (soma de `valorr`/`valorp` vigentes), NÃO uma
   auditoria do `ltvTotal`/LTV PROJETADO exibido no card que abre este drill (`atual: c.ltvTotal`
   em SecaoLtLtv.tsx/SecaoPerformance.tsx) — `ltvTotal` vem de uma fórmula de projeção (LT ×
   MRR, ver `fetchClientesLtLtv` acima) diferente da soma simples aqui. Os 2 números
   DIVERGEM por desenho; este drill é só a lista de contratos do cliente para contexto, não uma
   reconciliação do LTV projetado. */
export function montarClienteContratosDrillDetalhe(
  contratos: ContratoClienteRow[],
  identificador: string,
  nomeCliente: string | null,
): DrillDetalhe {
  const total = contratos.reduce((acc, c) => acc + c.valorr + c.valorp, 0);

  return {
    titulo: `Contratos — ${nomeCliente ?? identificador}`,
    subtitulo: `${contratos.length} contrato${contratos.length === 1 ? "" : "s"}`,
    colunas: COLUNAS_CLIENTE_CONTRATOS,
    // `.map` (não `contratos` direto) — mesma nota de "fresh type" de `montarLeadTimeDrillDetalhe`
    // acima.
    linhas: contratos.map((c) => ({ ...c })),
    total,
  };
}

export async function montarClienteContratosDetalhe(valor?: string): Promise<DrillDetalhe> {
  if (!valor) {
    return {
      titulo: "Contratos do Cliente",
      subtitulo: "Parâmetro 'valor' (idTask ou nome do cliente) é obrigatório para este tipo.",
      colunas: COLUNAS_CLIENTE_CONTRATOS,
      linhas: [],
    };
  }

  const result = await db.execute(sql`
    SELECT cl.nome AS nome_cliente, ct.produto AS produto, ct.servico AS servico, ct.status AS status,
           COALESCE(ct.valorr,0)::numeric AS valorr, COALESCE(ct.valorp,0)::numeric AS valorp
    FROM "Clickup".cup_contratos ct
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
    WHERE ct.id_task = ${valor} OR cl.nome = ${valor}
    ORDER BY (COALESCE(ct.valorr,0) + COALESCE(ct.valorp,0)) DESC
  `);

  const rows = result.rows as unknown as RawContratoClienteRow[];
  const nomeCliente = rows[0]?.nome_cliente ?? null;
  const linhas = rows.map((r) => ({
    produto: r.produto,
    servico: r.servico,
    status: r.status,
    valorr: Number(r.valorr) || 0,
    valorp: Number(r.valorp) || 0,
  }));

  return montarClienteContratosDrillDetalhe(linhas, valor, nomeCliente);
}

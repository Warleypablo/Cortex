// server/routes/bp2026.detalhe.ts
// Detalhamento por célula (métrica × mês) da matriz /bp-2026.
// Usa os MESMOS predicados da agregação — célula e detalhe não podem divergir.
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { agruparItens, ratear, type ItemDetalhe, type GrupoDetalhe } from "./bp2026.helpers";
import {
  PREDICADOS_DESPESA, PREDICADO_OUTRAS_RECEITAS, PREDICADOS_SGA_SUB, PREDICADOS_OUTRAS_SUB,
} from "./bp2026.predicados";
import { CASE_PRODUTO, CASE_PRODUTO_CHURN } from "./bp2026.revenue";
import {
  LINHAS, LINHAS_DEDUCOES, LINHAS_CSV, LINHAS_OPEX, LINHAS_POS_EBITDA,
  type DefLinha,
} from "./bp2026";

const ANO = 2026;
const LIMITE_ITENS = 50;
const LIMITE_ITENS_DFC = 10;

const DERIVADAS = [
  "receita_total_faturavel", "receita_liquida", "margem_bruta", "ebitda", "geracao_caixa",
  // sub-abas (composição client-side)
  "receita_total", "despesa_total", "receita_cabeca", "mrr_cabeca", "ticket_cliente", "ticket_contrato",
  "aliquota_efetiva", "margem_geracao",
  "aov_performance", "aov_creators", "aov_social", "aov_gc", "aov_others",
  "aov_venda_mrr", "aov_venda_pontual",
  "gestores_necessarios", "designers_necessarios", "necessidade_gestores",
  "contratos_por_gestor", "contas_por_designer",
  "sga_total_detalhe", "or_total_detalhe",
];

// métricas de despesa cujo detalhe é o bucket puro (parcelas por quitação, grupos por categoria)
const METRICAS_BUCKET: Record<string, string> = {
  impostos_receita: "impostos_receita",
  csv_salarios: "csv_salarios",
  csv_stack: "csv_stack",
  cac: "cac",
  bonus: "bonus",
  impostos_diretos: "impostos_diretos",
  capex: "capex",
};

const TODAS_DEFS: DefLinha[] = [
  ...LINHAS, ...LINHAS_DEDUCOES, ...LINHAS_CSV, ...LINHAS_OPEX, ...LINHAS_POS_EBITDA,
  { metrica: "dfc_real", titulo: "(=) Fluxo de Caixa (DFC)", tipoAgregacao: "fluxo", direcao: "maior_melhor" },
];

function normalizaCategoria(c: string | null): string {
  return (c ?? "(sem categoria)").trim().replace(/\s+/g, " ");
}

async function itensDespesaBucket(
  db: any, predicado: ReturnType<typeof sql>, mes: number
): Promise<ItemDetalhe[]> {
  const result = await db.execute(sql`
    SELECT p.categoria_nome,
           COALESCE(NULLIF(TRIM(c.nome), ''), p.descricao, '(sem identificação)') AS nome,
           COALESCE(p.descricao, '') AS descricao,
           p.data_quitacao::text AS data,
           COALESCE(p.valor_pago::numeric, 0) AS valor
    FROM "Conta Azul".caz_parcelas p
    LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
    WHERE p.tipo_evento = 'DESPESA' AND p.status = 'QUITADO'
      AND EXTRACT(YEAR FROM p.data_quitacao) = ${ANO}
      AND EXTRACT(MONTH FROM p.data_quitacao) = ${mes}
      AND (${predicado})
    ORDER BY valor DESC
  `);
  return (result.rows as any[]).map((r) => ({
    grupo: normalizaCategoria(r.categoria_nome),
    nome: r.nome,
    detalhe: r.descricao,
    data: r.data,
    valor: parseFloat(r.valor),
  }));
}

type ResultadoDet = { grupos: GrupoDetalhe[]; realizado: number; notaDinamica?: string };

// deals Bitrix do mês: vendas (mrr|pontual|ambos) ou reuniões; modo soma|contagem
async function detDealsBitrix(
  db: any, mes: number,
  tipo: "mrr" | "pontual" | "ambos" | "reunioes",
  modo: "soma" | "contagem",
  tituloGrupo: string
): Promise<ResultadoDet> {
  const filtro =
    tipo === "mrr" ? sql`stage_name = 'Negócio Ganho' AND COALESCE(valor_recorrente::numeric, 0) > 0`
    : tipo === "pontual" ? sql`stage_name = 'Negócio Ganho' AND COALESCE(valor_pontual::numeric, 0) > 0`
    : tipo === "ambos" ? sql`stage_name = 'Negócio Ganho' AND (COALESCE(valor_recorrente::numeric, 0) > 0 OR COALESCE(valor_pontual::numeric, 0) > 0)`
    : sql`data_reuniao_realizada IS NOT NULL`;
  const campoData = tipo === "reunioes" ? sql`data_reuniao_realizada` : sql`data_fechamento`;
  const campoValor =
    tipo === "mrr" ? sql`COALESCE(valor_recorrente::numeric, 0)`
    : tipo === "pontual" ? sql`COALESCE(valor_pontual::numeric, 0)`
    : sql`COALESCE(valor_recorrente::numeric, 0) + COALESCE(valor_pontual::numeric, 0)`;
  const result = await db.execute(sql`
    SELECT COALESCE(title, '(sem título)') AS nome,
           COALESCE(closer::text, '') AS closer,
           (${campoData})::date::text AS data,
           ${campoValor} AS valor
    FROM "Bitrix".crm_deal
    WHERE (${filtro})
      AND EXTRACT(YEAR FROM ${campoData}) = ${ANO}
      AND EXTRACT(MONTH FROM ${campoData}) = ${mes}
    ORDER BY valor DESC
  `);
  const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
    grupo: tituloGrupo, nome: r.nome,
    detalhe: r.closer ? `closer ${r.closer}` : "", data: r.data,
    valor: modo === "contagem" ? 0 : parseFloat(r.valor),
  }));
  if (modo === "contagem") {
    // valor monetário vai para o texto; célula é contagem
    const rows = result.rows as any[];
    itens.forEach((it, i) => {
      const v = parseFloat(rows[i].valor);
      if (v > 0) it.detalhe = [it.detalhe, `R$ ${Math.round(v).toLocaleString("pt-BR")}`].filter(Boolean).join(" · ");
    });
  }
  return {
    grupos: agruparItens(itens, LIMITE_ITENS),
    realizado: modo === "contagem" ? itens.length : itens.reduce((s, i) => s + i.valor, 0),
  };
}

// pessoas Inhire ativas no fim do mês, filtro opcional por SQL (cargo/setor); grupos por campo
async function detPessoas(
  db: any, mes: number, filtro: ReturnType<typeof sql> | null, grupoCampo: "setor" | "squad"
): Promise<ResultadoDet> {
  const result = await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(nome), ''), '(sem nome)') AS nome,
           COALESCE(NULLIF(TRIM(cargo), ''), '(sem cargo)') AS cargo,
           COALESCE(NULLIF(TRIM(setor), ''), '(sem setor)') AS setor,
           COALESCE(NULLIF(TRIM(squad), ''), '(sem squad)') AS squad
    FROM "Inhire".rh_pessoal
    WHERE admissao IS NOT NULL
      AND admissao::date <= (make_date(${ANO}, ${mes}, 1) + INTERVAL '1 month - 1 day')::date
      AND (demissao IS NULL OR demissao::date > (make_date(${ANO}, ${mes}, 1) + INTERVAL '1 month - 1 day')::date)
      ${filtro ? sql`AND (${filtro})` : sql``}
    ORDER BY setor, nome
  `);
  const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
    grupo: grupoCampo === "setor" ? r.setor : r.squad,
    nome: r.nome, detalhe: `${r.cargo} · ${grupoCampo === "setor" ? r.squad : r.setor}`,
    data: null, valor: 0,
  }));
  return { grupos: agruparItens(itens, Number.MAX_SAFE_INTEGER), realizado: itens.length };
}

// snapshot fim do mês: contratos (ou clientes agregados), filtro opcional por linha de produto.
// CASE_PRODUTO roda em subquery isolada sobre cup_data_hist (cup_clientes também tem servico/squad).
async function detSnapshot(
  db: any, mes: number,
  linhaProduto: string | null,         // 'performance' | ... | null = todas
  nivel: "contrato" | "cliente",
  modo: "soma" | "contagem"
): Promise<ResultadoDet> {
  const result = await db.execute(sql`
    WITH alvo AS (
      SELECT MAX(data_snapshot::date) AS d FROM "Clickup".cup_data_hist
      WHERE data_snapshot::date >= make_date(${ANO}, ${mes}, 1)
        AND data_snapshot::date < (make_date(${ANO}, ${mes}, 1) + INTERVAL '1 month')
    ),
    base AS (
      SELECT h.id_task, h.id_subtask, h.servico, h.squad, h.valorr,
             ${CASE_PRODUTO} AS linha
      FROM "Clickup".cup_data_hist h
      JOIN alvo a ON h.data_snapshot::date = a.d
      WHERE h.status IN ('ativo', 'onboarding', 'triagem')
    )
    SELECT COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
           ${nivel === "cliente" ? sql`'' AS servico` : sql`COALESCE(b.servico, '') AS servico`},
           COALESCE(NULLIF(TRIM(${nivel === "cliente" ? sql`MIN(b.squad)` : sql`b.squad`}), ''), '(sem squad)') AS squad,
           ${nivel === "cliente" ? sql`SUM(COALESCE(b.valorr::numeric, 0))` : sql`COALESCE(b.valorr::numeric, 0)`} AS valor
    FROM base b
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = b.id_task
    WHERE ${linhaProduto ? sql`b.linha = ${linhaProduto}` : sql`TRUE`}
    ${nivel === "cliente" ? sql`GROUP BY b.id_task, cl.nome` : sql``}
    ORDER BY valor DESC
  `);
  const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
    grupo: r.squad, nome: r.cliente,
    detalhe: modo === "contagem"
      ? [r.servico, `R$ ${Math.round(parseFloat(r.valor)).toLocaleString("pt-BR")} MRR`].filter(Boolean).join(" · ")
      : r.servico,
    data: null,
    valor: modo === "contagem" ? 0 : parseFloat(r.valor),
  }));
  const realizado = modo === "contagem"
    ? itens.length
    : (result.rows as any[]).reduce((s, r) => s + parseFloat(r.valor), 0);
  return { grupos: agruparItens(itens, Number.MAX_SAFE_INTEGER), realizado };
}

// churn do mês (filtros do BP), filtro opcional por linha de produto; grupos por motivo
async function detChurn(
  db: any, mes: number, linhaProduto: string | null
): Promise<{ resultado: ResultadoDet; somaRs: number }> {
  const result = await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(nome), ''), '(sem cliente)') AS nome,
           COALESCE(NULLIF(TRIM(motivo_cancelamento), ''), '(sem motivo)') AS motivo,
           COALESCE(NULLIF(TRIM(produto), ''), '(sem produto)') AS produto,
           data_solicitacao_encerramento::date::text AS data,
           valor_r::numeric AS valor,
           ${CASE_PRODUTO_CHURN} AS linha
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE EXTRACT(YEAR FROM data_solicitacao_encerramento) = ${ANO}
      AND EXTRACT(MONTH FROM data_solicitacao_encerramento) = ${mes}
      AND COALESCE(abonar_churn, '') != 'Sim'
      AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
      AND valor_r > 0
    ORDER BY valor DESC
  `);
  const rows = (result.rows as any[]).filter((r) => (linhaProduto ? r.linha === linhaProduto : true));
  const itens: ItemDetalhe[] = rows.map((r) => ({
    grupo: r.motivo, nome: r.nome, detalhe: r.produto, data: r.data, valor: parseFloat(r.valor),
  }));
  const somaRs = itens.reduce((s, i) => s + i.valor, 0);
  return { resultado: { grupos: agruparItens(itens, LIMITE_ITENS), realizado: somaRs }, somaRs };
}

const TITULOS_SUBABAS: Record<string, string> = {
  vendas_mrr: "Vendas MRR", funil_vendas_mrr: "Vendas MRR",
  vendas_pontual: "Vendas Pontual", funil_vendas_pontual: "Vendas Pontual",
  contratos_vendidos_mrr: "Contratos vendidos — MRR",
  contratos_vendidos_pontual: "Contratos vendidos — Pontual",
  reunioes: "Reuniões realizadas", taxa_conversao: "Taxa de conversão",
  colaboradores: "Número de Colaboradores",
  pessoas_csv: "Pessoas em CSV", pessoas_cac: "Pessoas em CAC", pessoas_sgea: "Pessoas em SGEA",
  gestores_atuais: "Gestores atuais", designers_atuais: "Designers atuais",
  clientes: "Número de Clientes", contratos: "Número de Contratos",
  churn_mes: "Churn do Mês",
  mrr_performance: "MRR — Performance", mrr_creators: "MRR — Creators", mrr_social: "MRR — Social",
  mrr_gc: "MRR — Gestão de Comunidade", mrr_others: "MRR — Others",
  contratos_performance: "Contratos — Performance", contratos_creators: "Contratos — Creators",
  contratos_social: "Contratos — Social", contratos_gc: "Contratos — Gestão de Comunidade",
  contratos_others: "Contratos — Others", cap_contratos_performance: "Contratos Performance",
  churn_pct_performance: "Churn — Performance", churn_pct_creators: "Churn — Creators",
  churn_pct_social: "Churn — Social", churn_pct_gc: "Churn — Gestão de Comunidade",
  churn_pct_others: "Churn — Others",
  saldo_caixa: "Saldo de Caixa",
  sga_uzk: "UZK", sga_backoffice: "Backoffice", sga_software: "Software", sga_ocupacao: "Ocupação",
  beneficio_total_empresa: "Benefício Caju", sga_premiacoes: "Premiações",
  sga_eventos: "Eventos e Brindes Internos", sga_outras: "Outras despesas",
  or_receita_variavel: "Receita Variável", or_stack_digital: "Stack Digital",
  or_demais: "Demais (Mentoria, Infoproduto, Turbooh…)",
};
const HANDLERS_SUBABAS = TITULOS_SUBABAS; // mesmo conjunto de chaves (roteadas no switch abaixo)

const LINHAS_REVENUE = ["performance", "creators", "social", "gc", "others"] as const;
const SETOR_FILTROS: Record<string, ReturnType<typeof sql>> = {
  pessoas_csv: sql`TRIM(setor) IN ('Commerce', 'Tech Sites')`,
  pessoas_cac: sql`TRIM(setor) = 'Growth Interno'`,
  pessoas_sgea: sql`TRIM(setor) IN ('Backoffice', 'Sócios')`,
  gestores_atuais: sql`TRIM(cargo) = 'Gestor de Performance'`,
  designers_atuais: sql`TRIM(cargo) = 'Designer'`,
};

export function registerBp2026DetalheRoutes(app: Express, db: any) {
  app.get("/api/bp2026/detalhe", async (req, res) => {
    try {
      const metrica = String(req.query.metrica ?? "");
      const mes = Number(req.query.mes);
      const def = TODAS_DEFS.find((d) => d.metrica === metrica);
      const conhecida = def || Object.hasOwn(HANDLERS_SUBABAS, metrica);
      if (!conhecida || DERIVADAS.includes(metrica) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ error: "metrica/mes inválidos" });
      }
      const titulo = def?.titulo ?? TITULOS_SUBABAS[metrica] ?? metrica;

      let orcado: number | null = null;
      const orcRes = await db.execute(sql`
        SELECT valor::numeric AS valor FROM cortex_core.bp2026_orcado
        WHERE metrica = ${metrica} AND mes = ${mes}
      `);
      if (orcRes.rows.length) orcado = parseFloat((orcRes.rows[0] as any).valor);
      // dfc_real não tem orçado persistido (usa o da Geração de Caixa, derivada);
      // o frontend lê o orçado da célula no payload da matriz — aqui permanece null.

      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const mesCorrente = anoAtual > ANO ? 12 : anoAtual < ANO ? 0 : agora.getMonth() + 1;
      if (mes > mesCorrente) {
        return res.json({ metrica, mes, titulo, orcado, realizado: null, grupos: [], nota: def?.nota });
      }

      let grupos: GrupoDetalhe[] = [];
      let realizado = 0;
      let rateio: { fracao: number; totalBruto: number; totalRateado: number } | undefined;
      let notaDinamica: string | undefined;

      if (Object.hasOwn(METRICAS_BUCKET, metrica)) {
        const itens = await itensDespesaBucket(db, PREDICADOS_DESPESA[METRICAS_BUCKET[metrica]], mes);
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "mrr_ativo") {
        const result = await db.execute(sql`
          WITH alvo AS (
            SELECT MAX(data_snapshot::date) AS d FROM "Clickup".cup_data_hist
            WHERE data_snapshot::date >= make_date(${ANO}, ${mes}, 1)
              AND data_snapshot::date < (make_date(${ANO}, ${mes}, 1) + INTERVAL '1 month')
          )
          SELECT COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
                 COALESCE(h.servico, '') AS servico,
                 COALESCE(NULLIF(TRIM(h.squad), ''), '(sem squad)') AS squad,
                 COALESCE(h.valorr::numeric, 0) AS valor
          FROM "Clickup".cup_data_hist h
          JOIN alvo a ON h.data_snapshot::date = a.d
          LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
          ORDER BY valor DESC
        `);
        const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
          grupo: r.squad, nome: r.cliente, detalhe: r.servico, data: null, valor: parseFloat(r.valor),
        }));
        // MRR lista todos os contratos (spec: sem corte) — squads têm até ~100 clientes
        grupos = agruparItens(itens, Number.MAX_SAFE_INTEGER);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "receita_pontual") {
        const result = await db.execute(sql`
          SELECT COALESCE(title, '(sem título)') AS nome, COALESCE(closer::text, '') AS closer,
                 data_fechamento::date::text AS data, valor_pontual::numeric AS valor
          FROM "Bitrix".crm_deal
          WHERE stage_name = 'Negócio Ganho' AND valor_pontual > 0
            AND EXTRACT(YEAR FROM data_fechamento) = ${ANO}
            AND EXTRACT(MONTH FROM data_fechamento) = ${mes}
          ORDER BY valor DESC
        `);
        const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
          grupo: "Vendas pontuais (Bitrix)", nome: r.nome,
          detalhe: r.closer ? `closer ${r.closer}` : "", data: r.data, valor: parseFloat(r.valor),
        }));
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "outras_receitas") {
        const result = await db.execute(sql`
          SELECT p.categoria_nome,
                 COALESCE(NULLIF(TRIM(c.nome), ''), p.descricao, '(sem identificação)') AS nome,
                 COALESCE(p.descricao, '') AS descricao, p.data_competencia::text AS data,
                 COALESCE(p.valor_liquido::numeric, 0) AS valor
          FROM "Conta Azul".caz_parcelas p
          LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
          WHERE p.tipo_evento = 'RECEITA'
            AND EXTRACT(YEAR FROM p.data_competencia) = ${ANO}
            AND EXTRACT(MONTH FROM p.data_competencia) = ${mes}
            AND (${PREDICADO_OUTRAS_RECEITAS})
          ORDER BY valor DESC
        `);
        const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
          grupo: normalizaCategoria(r.categoria_nome), nome: r.nome, detalhe: r.descricao,
          data: r.data, valor: parseFloat(r.valor),
        }));
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "inadimplencia") {
        const vencidas = await db.execute(sql`
          SELECT COALESCE(NULLIF(TRIM(c.nome), ''), p.descricao, '(sem identificação)') AS nome,
                 COALESCE(p.descricao, '') AS descricao, p.data_vencimento::text AS data,
                 COALESCE(p.nao_pago::numeric, 0) AS valor
          FROM "Conta Azul".caz_parcelas p
          LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
          WHERE p.tipo_evento = 'RECEITA' AND p.nao_pago::numeric > 0
            AND p.data_vencimento <= CURRENT_DATE
            AND EXTRACT(YEAR FROM p.data_vencimento) = ${ANO}
            AND EXTRACT(MONTH FROM p.data_vencimento) = ${mes}
          ORDER BY valor DESC
        `);
        const itensVencidas: ItemDetalhe[] = (vencidas.rows as any[]).map((r) => ({
          grupo: "Vencidas não pagas (foto atual)", nome: r.nome, detalhe: r.descricao,
          data: r.data, valor: parseFloat(r.valor),
        }));
        const itensEstornos = (await itensDespesaBucket(db, PREDICADOS_DESPESA.estornos, mes))
          .map((i) => ({ ...i, grupo: "Estornos e devoluções" }));
        const todos = [...itensVencidas, ...itensEstornos];
        grupos = agruparItens(todos, LIMITE_ITENS);
        realizado = todos.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "csv_beneficio" || metrica === "sga") {
        const orcRateio = await db.execute(sql`
          SELECT metrica, valor::numeric AS valor FROM cortex_core.bp2026_orcado
          WHERE mes = ${mes} AND metrica IN ('csv_beneficio', 'beneficio_total_empresa')
        `);
        const orcMap: Record<string, number> = {};
        for (const r of orcRateio.rows as any[]) orcMap[r.metrica] = parseFloat(r.valor);
        const itensCaju = await itensDespesaBucket(db, PREDICADOS_DESPESA.beneficio_total, mes);
        const totalBruto = itensCaju.reduce((s, i) => s + i.valor, 0);
        if (metrica === "csv_beneficio") {
          const fracao = orcMap["beneficio_total_empresa"]
            ? (orcMap["csv_beneficio"] ?? 0) / orcMap["beneficio_total_empresa"] : 0;
          grupos = agruparItens(itensCaju, LIMITE_ITENS);
          realizado = ratear(totalBruto, orcMap["csv_beneficio"] ?? 0, orcMap["beneficio_total_empresa"] ?? 0) ?? 0;
          rateio = { fracao, totalBruto, totalRateado: realizado };
        } else {
          const itensBucket = await itensDespesaBucket(db, PREDICADOS_DESPESA.sga_bucket, mes);
          const complemento = ratear(
            totalBruto,
            (orcMap["beneficio_total_empresa"] ?? 0) - (orcMap["csv_beneficio"] ?? 0),
            orcMap["beneficio_total_empresa"] ?? 0
          ) ?? 0;
          const todos: ItemDetalhe[] = [
            ...itensBucket,
            { grupo: "Complemento do benefício (rateio)", nome: "Caju — parcela não atribuída ao CSV",
              detalhe: "benefício total × fração orçada do SG&A", data: null, valor: complemento },
          ];
          grupos = agruparItens(todos, LIMITE_ITENS);
          realizado = todos.reduce((s, i) => s + i.valor, 0);
        }
      } else if (metrica === "dfc_real") {
        const result = await db.execute(sql`
          SELECT p.tipo_evento, p.categoria_nome,
                 COALESCE(NULLIF(TRIM(c.nome), ''), p.descricao, '(sem identificação)') AS nome,
                 COALESCE(p.descricao, '') AS descricao, p.data_quitacao::text AS data,
                 COALESCE(p.valor_pago::numeric, 0) AS valor
          FROM "Conta Azul".caz_parcelas p
          LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
          WHERE p.status = 'QUITADO'
            AND EXTRACT(YEAR FROM p.data_quitacao) = ${ANO}
            AND EXTRACT(MONTH FROM p.data_quitacao) = ${mes}
          ORDER BY valor DESC
        `);
        const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
          grupo: `${r.tipo_evento === "RECEITA" ? "(+)" : "(−)"} ${normalizaCategoria(r.categoria_nome)}`,
          nome: r.nome, detalhe: r.descricao, data: r.data, valor: parseFloat(r.valor),
        }));
        grupos = agruparItens(itens, LIMITE_ITENS_DFC);
        grupos.sort((a, b) =>
          a.titulo.startsWith("(+)") === b.titulo.startsWith("(+)")
            ? b.total - a.total
            : a.titulo.startsWith("(+)") ? -1 : 1
        );
        const entradas = itens.filter((i) => i.grupo.startsWith("(+)")).reduce((s, i) => s + i.valor, 0);
        const saidas = itens.filter((i) => i.grupo.startsWith("(−)")).reduce((s, i) => s + i.valor, 0);
        realizado = entradas - saidas;
      } else if (metrica === "vendas_mrr" || metrica === "funil_vendas_mrr") {
        ({ grupos, realizado } = await detDealsBitrix(db, mes, "mrr", "soma", "Vendas MRR (Bitrix)"));
      } else if (metrica === "vendas_pontual" || metrica === "funil_vendas_pontual") {
        ({ grupos, realizado } = await detDealsBitrix(db, mes, "pontual", "soma", "Vendas pontuais (Bitrix)"));
      } else if (metrica === "contratos_vendidos_mrr") {
        ({ grupos, realizado } = await detDealsBitrix(db, mes, "mrr", "contagem", "Vendas MRR (Bitrix)"));
      } else if (metrica === "contratos_vendidos_pontual") {
        ({ grupos, realizado } = await detDealsBitrix(db, mes, "pontual", "contagem", "Vendas pontuais (Bitrix)"));
      } else if (metrica === "reunioes") {
        ({ grupos, realizado } = await detDealsBitrix(db, mes, "reunioes", "contagem", "Reuniões realizadas"));
      } else if (metrica === "taxa_conversao") {
        const ganhos = await detDealsBitrix(db, mes, "ambos", "contagem", "Deals ganhos (numerador)");
        const reun = await detDealsBitrix(db, mes, "reunioes", "contagem", "Reuniões realizadas");
        grupos = ganhos.grupos;
        realizado = reun.realizado ? ganhos.realizado / reun.realizado : 0;
        notaDinamica = `${ganhos.realizado} deals ganhos ÷ ${reun.realizado} reuniões no mês`;
      } else if (metrica === "colaboradores") {
        ({ grupos, realizado } = await detPessoas(db, mes, null, "setor"));
      } else if (Object.hasOwn(SETOR_FILTROS, metrica)) {
        ({ grupos, realizado } = await detPessoas(db, mes, SETOR_FILTROS[metrica], metrica.startsWith("pessoas") ? "setor" : "squad"));
      } else if (metrica === "clientes") {
        ({ grupos, realizado } = await detSnapshot(db, mes, null, "cliente", "contagem"));
      } else if (metrica === "contratos") {
        ({ grupos, realizado } = await detSnapshot(db, mes, null, "contrato", "contagem"));
      } else if (metrica === "churn_mes") {
        ({ resultado: { grupos, realizado } } = await detChurn(db, mes, null));
      } else if (metrica.startsWith("mrr_") && LINHAS_REVENUE.includes(metrica.slice(4) as any)) {
        ({ grupos, realizado } = await detSnapshot(db, mes, metrica.slice(4), "contrato", "soma"));
      } else if (metrica === "cap_contratos_performance") {
        ({ grupos, realizado } = await detSnapshot(db, mes, "performance", "contrato", "contagem"));
      } else if (metrica.startsWith("contratos_") && LINHAS_REVENUE.includes(metrica.slice(10) as any)) {
        ({ grupos, realizado } = await detSnapshot(db, mes, metrica.slice(10), "contrato", "contagem"));
      } else if (metrica.startsWith("churn_pct_")) {
        const linhaP = metrica.slice(10);
        const { resultado, somaRs } = await detChurn(db, mes, linhaP);
        grupos = resultado.grupos;
        // denominador: MRR da linha no fim do mês anterior (mesma resolução da Revenue)
        const denRes = await db.execute(sql`
          WITH alvo AS (
            SELECT MAX(data_snapshot::date) AS d FROM "Clickup".cup_data_hist
            WHERE data_snapshot::date >= (make_date(${ANO}, ${mes}, 1) - INTERVAL '1 month')
              AND data_snapshot::date < make_date(${ANO}, ${mes}, 1)
          ),
          base AS (
            SELECT h.valorr, ${CASE_PRODUTO} AS linha
            FROM "Clickup".cup_data_hist h JOIN alvo a ON h.data_snapshot::date = a.d
            WHERE h.status IN ('ativo', 'onboarding', 'triagem')
          )
          SELECT COALESCE(SUM(valorr::numeric), 0) AS mrr FROM base WHERE linha = ${linhaP}
        `);
        const den = parseFloat((denRes.rows[0] as any).mrr);
        realizado = den ? somaRs / den : 0;
        notaDinamica = `churn R$ ${Math.round(somaRs).toLocaleString("pt-BR")} ÷ MRR R$ ${Math.round(den).toLocaleString("pt-BR")} (fim do mês anterior)`;
      } else if (metrica === "saldo_caixa") {
        const contasRes = await db.execute(sql`
          SELECT COALESCE(NULLIF(TRIM(nmbanco), ''), '(sem nome)') AS nome, balance::numeric AS valor
          FROM "Conta Azul".caz_bancos ORDER BY valor DESC
        `);
        const itensContas: ItemDetalhe[] = (contasRes.rows as any[]).map((r) => ({
          grupo: "Contas bancárias (saldo atual)", nome: r.nome, detalhe: "", data: null, valor: parseFloat(r.valor),
        }));
        // fluxos posteriores (DFC líquido por mês m+1..mesCorrente)
        const fluxosRes = await db.execute(sql`
          SELECT EXTRACT(MONTH FROM data_quitacao)::int AS m,
                 SUM(CASE WHEN tipo_evento = 'RECEITA' THEN COALESCE(valor_pago::numeric, 0)
                          ELSE -COALESCE(valor_pago::numeric, 0) END) AS liquido
          FROM "Conta Azul".caz_parcelas
          WHERE status = 'QUITADO'
            AND EXTRACT(YEAR FROM data_quitacao) = ${ANO}
            AND EXTRACT(MONTH FROM data_quitacao) > ${mes}
            AND EXTRACT(MONTH FROM data_quitacao) <= ${mesCorrente}
          GROUP BY 1 ORDER BY 1
        `);
        const MESES_NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
        const itensFluxos: ItemDetalhe[] = (fluxosRes.rows as any[]).map((r) => ({
          grupo: "(−) Fluxos posteriores ao mês (reconstrução)",
          nome: `DFC líquido de ${MESES_NOMES[Number(r.m) - 1]}`, detalhe: "", data: null,
          valor: -parseFloat(r.liquido),
        }));
        const todos = [...itensContas, ...itensFluxos];
        grupos = agruparItens(todos, LIMITE_ITENS);
        realizado = todos.reduce((s, i) => s + i.valor, 0);
        notaDinamica = "Saldo do fim do mês = saldo bancário atual − fluxos quitados posteriores.";
      } else if (Object.hasOwn(PREDICADOS_SGA_SUB, metrica) || metrica === "sga_outras") {
        const chave = metrica === "sga_outras" ? "sga_outras_sub" : metrica;
        const itens = await itensDespesaBucket(db, PREDICADOS_SGA_SUB[chave], mes);
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "beneficio_total_empresa") {
        const itens = await itensDespesaBucket(db, PREDICADOS_DESPESA.beneficio_total, mes);
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else if (metrica === "or_receita_variavel" || metrica === "or_stack_digital" || metrica === "or_demais") {
        const pred = metrica === "or_receita_variavel" ? PREDICADOS_OUTRAS_SUB.or_variavel
          : metrica === "or_stack_digital" ? PREDICADOS_OUTRAS_SUB.or_stack : PREDICADOS_OUTRAS_SUB.or_demais;
        const result = await db.execute(sql`
          SELECT p.categoria_nome,
                 COALESCE(NULLIF(TRIM(c.nome), ''), p.descricao, '(sem identificação)') AS nome,
                 COALESCE(p.descricao, '') AS descricao, p.data_competencia::text AS data,
                 COALESCE(p.valor_liquido::numeric, 0) AS valor
          FROM "Conta Azul".caz_parcelas p
          LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
          WHERE p.tipo_evento = 'RECEITA'
            AND EXTRACT(YEAR FROM p.data_competencia) = ${ANO}
            AND EXTRACT(MONTH FROM p.data_competencia) = ${mes}
            AND (${pred})
          ORDER BY valor DESC
        `);
        const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
          grupo: normalizaCategoria(r.categoria_nome), nome: r.nome, detalhe: r.descricao,
          data: r.data, valor: parseFloat(r.valor),
        }));
        grupos = agruparItens(itens, LIMITE_ITENS);
        realizado = itens.reduce((s, i) => s + i.valor, 0);
      } else {
        return res.status(400).json({ error: "metrica/mes inválidos" });
      }

      res.json({ metrica, mes, titulo, orcado, realizado, grupos, rateio, nota: def?.nota, notaDinamica });
    } catch (error) {
      console.error("[bp2026] Erro em /api/bp2026/detalhe:", error);
      res.status(500).json({ error: "Erro ao montar detalhamento" });
    }
  });
}

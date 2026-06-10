// server/routes/bp2026.detalhe.ts
// Detalhamento por célula (métrica × mês) da matriz /bp-2026.
// Usa os MESMOS predicados da agregação — célula e detalhe não podem divergir.
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { agruparItens, ratear, type ItemDetalhe, type GrupoDetalhe } from "./bp2026.helpers";
import { PREDICADOS_DESPESA, PREDICADO_OUTRAS_RECEITAS } from "./bp2026.predicados";
import {
  LINHAS, LINHAS_DEDUCOES, LINHAS_CSV, LINHAS_OPEX, LINHAS_POS_EBITDA,
  type DefLinha,
} from "./bp2026";

const ANO = 2026;
const LIMITE_ITENS = 50;
const LIMITE_ITENS_DFC = 10;

const DERIVADAS = ["receita_total_faturavel", "receita_liquida", "margem_bruta", "ebitda", "geracao_caixa"];

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

export function registerBp2026DetalheRoutes(app: Express, db: any) {
  app.get("/api/bp2026/detalhe", async (req, res) => {
    try {
      const metrica = String(req.query.metrica ?? "");
      const mes = Number(req.query.mes);
      const def = TODAS_DEFS.find((d) => d.metrica === metrica);
      if (!def || DERIVADAS.includes(metrica) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ error: "metrica/mes inválidos" });
      }

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
        return res.json({ metrica, mes, titulo: def.titulo, orcado, realizado: null, grupos: [], nota: def.nota });
      }

      let grupos: GrupoDetalhe[] = [];
      let realizado = 0;
      let rateio: { fracao: number; totalBruto: number; totalRateado: number } | undefined;

      if (metrica in METRICAS_BUCKET) {
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
      } else {
        return res.status(400).json({ error: "metrica/mes inválidos" });
      }

      res.json({ metrica, mes, titulo: def.titulo, orcado, realizado, grupos, rateio, nota: def.nota });
    } catch (error) {
      console.error("[bp2026] Erro em /api/bp2026/detalhe:", error);
      res.status(500).json({ error: "Erro ao montar detalhamento" });
    }
  });
}

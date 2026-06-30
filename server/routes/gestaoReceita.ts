// server/routes/gestaoReceita.ts
// Endpoint agregador da página "Gestão de Receita" (/gestao/receita).
// Orçado: cortex_core.bp2026_orcado (BP 2026). Venda nova: Bitrix crm_deal (stage Negócio Ganho).
// Custos realizados: regime caixa do Conta Azul, reusando somaDespesaCaixaPorMes + predicados do BP.
import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { somaDespesaCaixaPorMes } from "./bp2026";
import { PREDICADOS_DESPESA, PREDICADOS_CAC_SUB } from "./bp2026.predicados";

const STAGE_GANHO = "Negócio Ganho";

// Mapeia produto do ClickUp -> segmento do BP (para orçado por produto, onde casável).
const PRODUTO_TO_SEG_MRR: Record<string, string> = {
  Performance: "performance",
  "Social Media": "social",
  Creators: "creators",
  "Gestão de Comunidade": "gc",
};

function parseMes(mesParam: unknown): { mesNum: number; ano: number; dIni: string; dFim: string; label: string } {
  // Aceita "YYYY-MM"; default = junho/2026 (último mês com dados fechados no ambiente).
  let ano = 2026;
  let mesNum = 6;
  if (typeof mesParam === "string" && /^\d{4}-\d{2}$/.test(mesParam)) {
    const [a, m] = mesParam.split("-").map(Number);
    ano = a;
    mesNum = m;
  }
  const mm = String(mesNum).padStart(2, "0");
  const dIni = `${ano}-${mm}-01`;
  const proxAno = mesNum === 12 ? ano + 1 : ano;
  const proxMes = mesNum === 12 ? 1 : mesNum + 1;
  const dFim = `${proxAno}-${String(proxMes).padStart(2, "0")}-01`;
  return { mesNum, ano, dIni, dFim, label: `${ano}-${mm}` };
}

const num = (v: any) => (v == null ? 0 : parseFloat(v) || 0);

export function registerGestaoReceitaRoutes(app: Express) {
  app.get("/api/gestao/receita", async (req, res) => {
    try {
      const { mesNum, ano, dIni, dFim, label } = parseMes(req.query.mes);

      // ---------- 1. ORÇADO (BP 2026) ----------
      const orcRows = await db.execute(sql`
        SELECT metrica, valor FROM cortex_core.bp2026_orcado WHERE mes = ${mesNum}
      `);
      const orc: Record<string, number> = {};
      for (const r of orcRows.rows as any[]) orc[r.metrica] = num(r.valor);

      // ---------- 2. CUSTOS REALIZADOS (regime caixa, Conta Azul) ----------
      const [cacTotalPM, cacVendasPM, cacPreVendasPM, cacComissoesPM] = await Promise.all([
        somaDespesaCaixaPorMes(db, PREDICADOS_DESPESA.cac),
        somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB.cac_vendas),
        somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB.cac_pre_vendas),
        somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB.cac_comissoes),
      ]);
      const cacTotalReal = cacTotalPM[mesNum] || 0;
      const custoComercialReal = (cacVendasPM[mesNum] || 0) + (cacPreVendasPM[mesNum] || 0);
      const comissoesReal = cacComissoesPM[mesNum] || 0;

      // ---------- 3. VENDA NOVA (Bitrix) + nº clientes/contratos do mês ----------
      const vendaRow = await db.execute(sql`
        SELECT
          COALESCE(SUM(valor_recorrente::numeric), 0) AS mrr,
          COALESCE(SUM(valor_pontual::numeric), 0)   AS pont,
          COUNT(*) AS deals
        FROM "Bitrix".crm_deal
        WHERE stage_name = ${STAGE_GANHO}
          AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}
      `);
      const vMrrReal = num((vendaRow.rows as any[])[0]?.mrr);
      const vPontReal = num((vendaRow.rows as any[])[0]?.pont);
      const nClientes = Number((vendaRow.rows as any[])[0]?.deals) || 0;

      // ---------- 4. CLOSERS (venda + reuniões no mês) ----------
      const closersRows = await db.execute(sql`
        SELECT c.nome AS nome,
          COALESCE(SUM(d.valor_recorrente::numeric) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}), 0) AS mrr,
          COALESCE(SUM(d.valor_pontual::numeric) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}), 0) AS pont,
          COUNT(*) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}) AS deals,
          COUNT(*) FILTER (WHERE d.data_reuniao_realizada >= ${dIni} AND d.data_reuniao_realizada < ${dFim}) AS reunioes
        FROM "Bitrix".crm_deal d
        JOIN "Bitrix".crm_closers c ON c.id::text = d.closer::text
        WHERE (d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim})
           OR (d.data_reuniao_realizada >= ${dIni} AND d.data_reuniao_realizada < ${dFim})
        GROUP BY c.nome
      `);
      const closers = (closersRows.rows as any[])
        .map((r) => {
          const mrr = num(r.mrr), pont = num(r.pont);
          return {
            nome: r.nome,
            mrr, pont,
            deals: Number(r.deals) || 0,
            reunioes: Number(r.reunioes) || 0,
            score: mrr + pont / 5, // score do mockup
            conv: Number(r.reunioes) > 0 ? (Number(r.deals) / Number(r.reunioes)) * 100 : 0,
          };
        })
        .filter((c) => c.mrr > 0 || c.pont > 0 || c.reunioes > 0)
        .sort((a, b) => b.score - a.score);

      // ---------- 5. SDR (leads + reuniões + valor gerado) ----------
      const sdrRows = await db.execute(sql`
        SELECT u.nome AS nome,
          COUNT(*) FILTER (WHERE d.date_create >= ${dIni} AND d.date_create < ${dFim}) AS leads,
          COUNT(*) FILTER (WHERE d.data_reuniao_realizada >= ${dIni} AND d.data_reuniao_realizada < ${dFim}) AS reunioes,
          COALESCE(SUM(d.valor_recorrente::numeric) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}), 0) AS mrr,
          COALESCE(SUM(d.valor_pontual::numeric) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}), 0) AS pont
        FROM "Bitrix".crm_deal d
        JOIN "Bitrix".crm_users u ON u.id::text = d.sdr::text
        WHERE (d.date_create >= ${dIni} AND d.date_create < ${dFim})
           OR (d.data_reuniao_realizada >= ${dIni} AND d.data_reuniao_realizada < ${dFim})
           OR (d.stage_name = ${STAGE_GANHO} AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim})
        GROUP BY u.nome
      `);
      const sdrs = (sdrRows.rows as any[])
        .map((r) => {
          const reunioes = Number(r.reunioes) || 0, leads = Number(r.leads) || 0;
          return {
            nome: r.nome, leads, reunioes,
            mrr: num(r.mrr), pont: num(r.pont),
            valor: num(r.mrr) + num(r.pont),
            conv: leads > 0 ? (reunioes / leads) * 100 : 0,
          };
        })
        .filter((s) => s.leads > 0 || s.reunioes > 0)
        .sort((a, b) => b.valor - a.valor);

      // ---------- 6. CANAIS DE AQUISIÇÃO (deals ganhos por source) ----------
      const canaisRows = await db.execute(sql`
        SELECT COALESCE(NULLIF(source, ''), '(não informado)') AS canal,
          COUNT(*) AS deals,
          COALESCE(SUM(valor_recorrente::numeric), 0) AS mrr,
          COALESCE(SUM(valor_pontual::numeric), 0) AS pont
        FROM "Bitrix".crm_deal
        WHERE stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}
        GROUP BY 1 ORDER BY 2 DESC
      `);
      const canais = (canaisRows.rows as any[]).map((r) => {
        const mrr = num(r.mrr), pont = num(r.pont), deals = Number(r.deals) || 0;
        return { canal: r.canal, deals, mrr, pont, total: mrr + pont, ticket: deals > 0 ? (mrr + pont) / deals : 0 };
      });

      // ---------- 7. FUNIL (Lead -> RA -> RR -> Venda) ----------
      const funilRow = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE date_create >= ${dIni} AND date_create < ${dFim}) AS leads,
          COUNT(*) FILTER (WHERE data_reuniao_agendada >= ${dIni} AND data_reuniao_agendada < ${dFim}) AS ra,
          COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim}) AS rr,
          COUNT(*) FILTER (WHERE stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}) AS venda
        FROM "Bitrix".crm_deal
      `);
      const f = (funilRow.rows as any[])[0] || {};
      const funilEtapas = [
        { etapa: "Lead", valor: Number(f.leads) || 0 },
        { etapa: "Reunião agendada", valor: Number(f.ra) || 0 },
        { etapa: "Reunião realizada", valor: Number(f.rr) || 0 },
        { etapa: "Venda", valor: Number(f.venda) || 0 },
      ];

      // ---------- 8. MQL / NMQL por etapa ----------
      const mqlRows = await db.execute(sql`
        SELECT
          CASE WHEN mql::text = '1' OR lower(mql::text) = 'true' THEN 'MQL'
               WHEN mql IS NULL OR mql::text = '' THEN '(sem classificação)'
               ELSE 'NMQL' END AS classe,
          COUNT(*) FILTER (WHERE date_create >= ${dIni} AND date_create < ${dFim}) AS leads,
          COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim}) AS rr,
          COUNT(*) FILTER (WHERE stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}) AS ganhos
        FROM "Bitrix".crm_deal
        WHERE (date_create >= ${dIni} AND date_create < ${dFim})
           OR (data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim})
           OR (stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim})
        GROUP BY 1
      `);
      const mql = (mqlRows.rows as any[]).map((r) => ({
        classe: r.classe,
        leads: Number(r.leads) || 0,
        rr: Number(r.rr) || 0,
        ganhos: Number(r.ganhos) || 0,
      }));

      // ---------- 9. VENDA / TICKET POR PRODUTO (ClickUp, alinhado ao BP) ----------
      // Mesma régua da sub-aba "Vendas por produto" do BP: cup_contratos por data_criado,
      // exclui status 'não usar'. MRR = SUM(valorr) por contrato (mesmo do BP).
      // Pontual = dedup por JORNADA: entregas (1ª/2ª/3ª...) do mesmo cliente repetem o valor
      // do pacote, então conta 1 valor por jornada (id_task p/ Creators, id_subtask p/ demais)
      // — evita a dupla contagem que inflava o pontual.
      const prodRows = await db.execute(sql`
        WITH base AS (
          SELECT COALESCE(NULLIF(TRIM(produto), ''), '(sem produto)') AS produto,
                 id_task, id_subtask, valorr::numeric AS vr, valorp::numeric AS vp
          FROM "Clickup".cup_contratos
          WHERE data_criado >= ${dIni} AND data_criado < ${dFim}
            AND LOWER(TRIM(status)) <> 'não usar'
        ),
        mrr AS (
          SELECT produto,
                 COALESCE(SUM(vr) FILTER (WHERE vr > 0), 0) AS mrr,
                 COUNT(*) FILTER (WHERE vr > 0) AS c_mrr,
                 ROUND(AVG(NULLIF(vr, 0))) AS tm_mrr
          FROM base GROUP BY produto
        ),
        pj AS (
          SELECT produto,
                 CASE WHEN produto = 'Creators' THEN 'task:' || id_task ELSE 'sub:' || id_subtask END AS jornada,
                 MAX(vp) AS vp
          FROM base WHERE vp > 0
          GROUP BY produto, CASE WHEN produto = 'Creators' THEN 'task:' || id_task ELSE 'sub:' || id_subtask END
        ),
        pont AS (
          SELECT produto, SUM(vp) AS pont, COUNT(*) AS c_pont, ROUND(AVG(vp)) AS tm_pont
          FROM pj GROUP BY produto
        )
        SELECT COALESCE(m.produto, p.produto) AS produto,
               COALESCE(m.c_mrr, 0) AS c_mrr, COALESCE(m.mrr, 0) AS mrr, m.tm_mrr,
               COALESCE(p.c_pont, 0) AS c_pont, COALESCE(p.pont, 0) AS pont, p.tm_pont
        FROM mrr m FULL OUTER JOIN pont p ON m.produto = p.produto
        ORDER BY COALESCE(m.mrr, 0) + COALESCE(p.pont, 0) DESC
      `);
      const produtos = (prodRows.rows as any[]).map((r) => {
        const seg = PRODUTO_TO_SEG_MRR[r.produto];
        return {
          produto: r.produto,
          cMrr: Number(r.c_mrr) || 0, mrr: num(r.mrr), tmMrr: num(r.tm_mrr),
          cPont: Number(r.c_pont) || 0, pont: num(r.pont), tmPont: num(r.tm_pont),
          orcadoMrr: seg ? orc[`vendas_mrr_${seg}`] ?? null : null,
        };
      });

      // ---------- 10. CHURN por motivo e por vendedor ----------
      const churnMotivoRows = await db.execute(sql`
        SELECT COALESCE(NULLIF(motivo_cancelamento, ''), '(sem motivo)') AS motivo,
          COUNT(*) AS qtd, COALESCE(SUM(valor_r::numeric), 0) AS valor
        FROM "Clickup".cup_churn
        WHERE data_solicitacao_encerramento >= ${dIni} AND data_solicitacao_encerramento < ${dFim}
        GROUP BY 1 ORDER BY 3 DESC
      `);
      const churnVendedorRows = await db.execute(sql`
        SELECT COALESCE(NULLIF(vendedor, ''), '(sem vendedor)') AS vendedor,
          COUNT(*) AS qtd, COALESCE(SUM(valor_r::numeric), 0) AS valor
        FROM "Clickup".cup_churn
        WHERE data_solicitacao_encerramento >= ${dIni} AND data_solicitacao_encerramento < ${dFim}
        GROUP BY 1 ORDER BY 3 DESC
      `);
      const churnPorMotivo = (churnMotivoRows.rows as any[]).map((r) => ({ motivo: r.motivo, qtd: Number(r.qtd) || 0, valor: num(r.valor) }));
      const churnPorVendedor = (churnVendedorRows.rows as any[]).map((r) => ({ vendedor: r.vendedor, qtd: Number(r.qtd) || 0, valor: num(r.valor) }));
      const churnTotal = {
        qtd: churnPorMotivo.reduce((a, c) => a + c.qtd, 0),
        valor: churnPorMotivo.reduce((a, c) => a + c.valor, 0),
      };

      // ---------- 11. CAC produto/cliente ----------
      // CAC = custo de aquisição ÷ NOVOS contratos/clientes adquiridos no mês.
      // Realizado: contratos novos (cup_contratos do mês) e clientes novos (deals ganhos Bitrix).
      // Orçado: contratos/clientes VENDIDOS orçados no BP (contratos_vendidos_*), não o estoque.
      const nContratos = produtos.reduce((a, p) => a + p.cMrr + p.cPont, 0);
      const cacProdutoReal = nContratos > 0 ? Math.round(cacTotalReal / nContratos) : 0;
      const cacClienteReal = nClientes > 0 ? Math.round(cacTotalReal / nClientes) : 0;
      const somaOrc = (prefixo: string) =>
        Object.entries(orc).reduce((a, [k, v]) => (k.startsWith(prefixo) ? a + v : a), 0);
      const orcContratosVendidos = somaOrc("contratos_vendidos_mrr_") + somaOrc("contratos_vendidos_pontual_");
      const orcClientesVendidos = somaOrc("contratos_vendidos_mrr_"); // proxy: 1 cliente novo recorrente ≈ 1 deal MRR
      const cacProdutoOrc = orcContratosVendidos > 0 ? Math.round((orc["cac"] || 0) / orcContratosVendidos) : 0;
      const cacClienteOrc = orcClientesVendidos > 0 ? Math.round((orc["cac"] || 0) / orcClientesVendidos) : 0;

      // Mês em andamento: custos em regime caixa ficam parciais até o fechamento.
      const hoje = new Date();
      const mesParcial = ano === hoje.getFullYear() && mesNum >= hoje.getMonth() + 1;

      res.json({
        mes: label,
        mesNum,
        ano,
        mesParcial,
        macro: {
          vendaMrr: { orcado: orc["vendas_mrr"] || 0, realizado: vMrrReal },
          vendaPontual: { orcado: orc["vendas_pontual"] || 0, realizado: vPontReal },
          canais,
          cac: {
            custoTotal: { orcado: orc["cac"] || 0, realizado: cacTotalReal },
            produto: { orcado: cacProdutoOrc, realizado: cacProdutoReal, n: nContratos },
            cliente: { orcado: cacClienteOrc, realizado: cacClienteReal, n: nClientes },
          },
        },
        pessoas: {
          custoComercial: { orcado: (orc["cac_vendas"] || 0) + (orc["cac_pre_vendas"] || 0), realizado: custoComercialReal },
          comissoes: { orcado: orc["cac_comissoes"] || 0, realizado: comissoesReal },
          closers,
          sdrs,
        },
        micro: { produtos, vendedores: closers, sdrs },
        funil: { etapas: funilEtapas, mql },
        qualidade: { churnPorMotivo, churnPorVendedor, total: churnTotal },
      });
    } catch (error) {
      console.error("[api] Error em /api/gestao/receita:", error);
      res.status(500).json({ error: "Falha ao montar Gestão de Receita" });
    }
  });
}

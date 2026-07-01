// server/routes/gestaoReceita.ts
// Endpoint agregador da página "Gestão de Receita" (/gestao/receita).
// Orçado: cortex_core.bp2026_orcado (BP 2026). Venda nova: Bitrix crm_deal (stage Negócio Ganho).
// Custos realizados: regime caixa do Conta Azul, reusando somaDespesaCaixaPorMes + predicados do BP.
import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { somaDespesaCaixaPorMes } from "./bp2026";
import { PREDICADOS_DESPESA, PREDICADOS_CAC_SUB } from "./bp2026.predicados";
import { montarDetalhe, tipoValido } from "./gestaoReceita.detalhe";
import { sourceLabel } from "./bitrixSources";

const STAGE_GANHO = "Negócio Ganho";

// Mapeia produto do ClickUp -> segmento do BP (para orçado por produto, onde casável).
const PRODUTO_TO_SEG_MRR: Record<string, string> = {
  Performance: "performance",
  "Social Media": "social",
  Creators: "creators",
  "Gestão de Comunidade": "gc",
};

// Tabela "Custo da operação" (seção CAC da aba Macro). sub = predicado do realizado
// automático (regime caixa); sem sub = realizado manual via cac_op_real:* (o Conta Azul
// não separa comissões PV × Vendas; ferramentas e eventos entram à mão por decisão do time).
// orcBp = chave do orçado default no bp2026_orcado (editável via cac_op_orc:*).
const CAC_OPERACAO_ITENS: { item: string; label: string; sub?: string; orcBp?: string }[] = [
  { item: "growth", label: "Growth", sub: "cac_growth", orcBp: "cac_growth" },
  { item: "ads", label: "ADs", sub: "cac_ads", orcBp: "cac_ads" },
  { item: "ferramentas", label: "Ferramentas" },
  { item: "pre_vendas", label: "Pré-vendas", sub: "cac_pre_vendas", orcBp: "cac_pre_vendas" },
  { item: "comissoes_pv", label: "Comissões PV" },
  { item: "vendas", label: "Vendas", sub: "cac_vendas", orcBp: "cac_vendas" },
  { item: "comissoes_vendas", label: "Comissões Vendas" },
  { item: "gerencia", label: "Gerência", sub: "cac_gerencia", orcBp: "cac_gerencia" },
  { item: "eventos", label: "Eventos", orcBp: "cac_eventos" },
];

// Aceita período via de/ate ("YYYY-MM") ou mes ("YYYY-MM", atalho). Período dentro de um ano.
// Retorna o range [dIni, dFim) e a lista de meses (1-12) p/ somar orçado/custos mensais.
function parsePeriodo(q: { de?: unknown; ate?: unknown; mes?: unknown }): {
  dIni: string; dFim: string; mesesNums: number[]; ano: number; mesNum: number; label: string;
} {
  const isYM = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
  const de = isYM(q.de) ? q.de : isYM(q.mes) ? (q.mes as string) : "2026-06";
  const ate = isYM(q.ate) ? q.ate : de;
  const [ano, mDe] = de.split("-").map(Number);
  const [, mAteRaw] = ate.split("-").map(Number);
  let mIni = mDe, mFim = mAteRaw;
  if (mFim < mIni) [mIni, mFim] = [mFim, mIni];
  const mm = (m: number) => String(m).padStart(2, "0");
  const dIni = `${ano}-${mm(mIni)}-01`;
  const proxAno = mFim === 12 ? ano + 1 : ano;
  const proxMes = mFim === 12 ? 1 : mFim + 1;
  const dFim = `${proxAno}-${mm(proxMes)}-01`;
  const mesesNums: number[] = [];
  for (let m = mIni; m <= mFim; m++) mesesNums.push(m);
  const label = mIni === mFim ? `${ano}-${mm(mIni)}` : `${ano}-${mm(mIni)} a ${ano}-${mm(mFim)}`;
  return { dIni, dFim, mesesNums, ano, mesNum: mIni, label };
}

const num = (v: any) => (v == null ? 0 : parseFloat(v) || 0);

export function registerGestaoReceitaRoutes(app: Express) {
  app.get("/api/gestao/receita", async (req, res) => {
    try {
      const { mesNum, ano, dIni, dFim, label, mesesNums } = parsePeriodo(req.query);
      const somaMeses = (pm: Record<number, number>) => mesesNums.reduce((a, m) => a + (pm[m] || 0), 0);
      const mesesInSql = sql.join(mesesNums.map((m) => sql`${m}`), sql`, `);

      // ---------- 1. ORÇADO (BP 2026) ----------
      const orcRows = await db.execute(sql`
        SELECT metrica, SUM(valor::numeric) AS valor FROM cortex_core.bp2026_orcado
        WHERE mes IN (${mesesInSql}) GROUP BY metrica
      `);
      const orc: Record<string, number> = {};
      for (const r of orcRows.rows as any[]) orc[r.metrica] = num(r.valor);

      // ---------- 1b. OVERRIDES de meta (editados na tela) ----------
      const ovRows = await db.execute(sql`
        SELECT chave, SUM(valor::numeric) AS valor FROM cortex_core.gestao_receita_metas
        WHERE ano = ${ano} AND mes IN (${mesesInSql}) GROUP BY chave
      `);
      // metas editáveis são mensais → só aplicam quando o período é um mês único.
      const ehMesUnico = mesesNums.length === 1;
      const override: Record<string, number> = {};
      if (ehMesUnico) for (const r of ovRows.rows as any[]) override[r.chave] = num(r.valor);
      // realizado manual (cac_op_real:*) é fato, não meta: soma as entradas mensais
      // do período mesmo em multi-mês (diferente dos overrides de meta acima).
      const manualReal: Record<string, number> = {};
      for (const r of ovRows.rows as any[]) if (String(r.chave).startsWith("cac_op_real:")) manualReal[r.chave] = num(r.valor);
      // meta final = override editado ?? orçado do BP
      const metaMrr = override["venda_mrr"] ?? orc["vendas_mrr"] ?? 0;
      const metaPontual = override["venda_pontual"] ?? orc["vendas_pontual"] ?? 0;

      // ---------- 2. CUSTOS REALIZADOS (regime caixa, Conta Azul) ----------
      const [cacTotalPM, cacVendasPM, cacPreVendasPM, cacComissoesPM, cacGerenciaPM, cacGrowthPM, cacAdsPM] = await Promise.all([
        somaDespesaCaixaPorMes(db, PREDICADOS_DESPESA.cac),
        somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB.cac_vendas),
        somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB.cac_pre_vendas),
        somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB.cac_comissoes),
        somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB.cac_gerencia),
        somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB.cac_growth),
        somaDespesaCaixaPorMes(db, PREDICADOS_CAC_SUB.cac_ads),
      ]);
      const cacTotalReal = somaMeses(cacTotalPM);
      const custoComercialReal = somaMeses(cacVendasPM) + somaMeses(cacPreVendasPM);
      const comissoesReal = somaMeses(cacComissoesPM);
      // realizado caixa por predicado, p/ as linhas automáticas da tabela "Custo da operação"
      const cacSubPM: Record<string, Record<number, number>> = {
        cac_vendas: cacVendasPM, cac_pre_vendas: cacPreVendasPM, cac_gerencia: cacGerenciaPM,
        cac_growth: cacGrowthPM, cac_ads: cacAdsPM,
      };

      // ---------- 3. VENDA NOVA (Bitrix) + ticket médio R×P + nº clientes ----------
      const vendaRow = await db.execute(sql`
        SELECT
          COALESCE(SUM(valor_recorrente::numeric), 0) AS mrr,
          COALESCE(SUM(valor_pontual::numeric), 0)   AS pont,
          COUNT(*) AS deals,
          COUNT(*) FILTER (WHERE valor_recorrente::numeric > 0) AS deals_mrr,
          COUNT(*) FILTER (WHERE valor_pontual::numeric > 0) AS deals_pont
        FROM "Bitrix".crm_deal
        WHERE stage_name = ${STAGE_GANHO}
          AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}
      `);
      const vr0 = (vendaRow.rows as any[])[0] || {};
      const vMrrReal = num(vr0.mrr);
      const vPontReal = num(vr0.pont);
      const nClientes = Number(vr0.deals) || 0;
      const nDealsMrr = Number(vr0.deals_mrr) || 0;
      const nDealsPont = Number(vr0.deals_pont) || 0;
      const ticketMrr = nDealsMrr > 0 ? Math.round(vMrrReal / nDealsMrr) : 0;
      const ticketPontual = nDealsPont > 0 ? Math.round(vPontReal / nDealsPont) : 0;

      // Nº de reuniões realizadas no mês + conversão por coorte (reunião → venda)
      const reunRow = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim}) AS reunioes,
          COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim} AND stage_name = ${STAGE_GANHO}) AS reun_ganhas
        FROM "Bitrix".crm_deal
      `);
      const rr0 = (reunRow.rows as any[])[0] || {};
      const numReunioes = Number(rr0.reunioes) || 0;
      const taxaConversao = numReunioes > 0 ? (Number(rr0.reun_ganhas) / numReunioes) * 100 : 0;

      // ---------- 4. CLOSERS (venda + reuniões no mês) ----------
      const closersRows = await db.execute(sql`
        SELECT c.nome AS nome,
          COALESCE(SUM(d.valor_recorrente::numeric) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}), 0) AS mrr,
          COALESCE(SUM(d.valor_pontual::numeric) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}), 0) AS pont,
          COUNT(*) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}) AS deals,
          COUNT(*) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}
            AND d.valor_recorrente::numeric > 0) AS deals_mrr,
          COUNT(*) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}
            AND d.valor_pontual::numeric > 0) AS deals_pont,
          COUNT(*) FILTER (WHERE d.data_reuniao_realizada >= ${dIni} AND d.data_reuniao_realizada < ${dFim}) AS reunioes
        FROM "Bitrix".crm_deal d
        JOIN "Bitrix".crm_closers c ON c.id::text = d.closer::text
        WHERE c.active = true
          AND ((d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim})
            OR (d.data_reuniao_realizada >= ${dIni} AND d.data_reuniao_realizada < ${dFim}))
        GROUP BY c.nome
      `);
      const closers = (closersRows.rows as any[])
        .map((r) => {
          const mrr = num(r.mrr), pont = num(r.pont);
          const deals = Number(r.deals) || 0, reunioes = Number(r.reunioes) || 0;
          const dealsMrr = Number(r.deals_mrr) || 0, dealsPont = Number(r.deals_pont) || 0;
          return {
            nome: r.nome,
            mrr, pont, deals, reunioes,
            score: mrr + pont / 5, // score do mockup
            // ticket por tipo: só sobre deals que têm valor daquele tipo (mesma régua da tabela de canais)
            ticketMrr: dealsMrr > 0 ? Math.round(mrr / dealsMrr) : 0,
            ticketPont: dealsPont > 0 ? Math.round(pont / dealsPont) : 0,
            // conversão direta: deals ganhos no mês ÷ reuniões do mês (coortes distintas; pode passar de 100%)
            conv: reunioes > 0 ? (deals / reunioes) * 100 : 0,
          };
        })
        .filter((c) => c.mrr > 0 || c.pont > 0 || c.reunioes > 0)
        .sort((a, b) => b.score - a.score);

      // ---------- 5. SDR (leads + reuniões + valor gerado) ----------
      const sdrRows = await db.execute(sql`
        SELECT u.nome AS nome,
          COUNT(*) FILTER (WHERE d.date_create >= ${dIni} AND d.date_create < ${dFim}) AS leads,
          COUNT(*) FILTER (WHERE d.date_create >= ${dIni} AND d.date_create < ${dFim}
            AND d.data_reuniao_realizada IS NOT NULL) AS leads_com_reuniao,
          COUNT(*) FILTER (WHERE d.data_reuniao_realizada >= ${dIni} AND d.data_reuniao_realizada < ${dFim}) AS reunioes,
          COUNT(*) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}) AS deals,
          COALESCE(SUM(d.valor_recorrente::numeric) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}), 0) AS mrr,
          COALESCE(SUM(d.valor_pontual::numeric) FILTER (WHERE d.stage_name = ${STAGE_GANHO}
            AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}), 0) AS pont
        FROM "Bitrix".crm_deal d
        JOIN "Bitrix".crm_users u ON u.id::text = d.sdr::text
        WHERE u.active = true
          AND ((d.date_create >= ${dIni} AND d.date_create < ${dFim})
            OR (d.data_reuniao_realizada >= ${dIni} AND d.data_reuniao_realizada < ${dFim})
            OR (d.stage_name = ${STAGE_GANHO} AND d.data_fechamento >= ${dIni} AND d.data_fechamento < ${dFim}))
        GROUP BY u.nome
      `);
      const sdrs = (sdrRows.rows as any[])
        .map((r) => {
          const reunioes = Number(r.reunioes) || 0, leads = Number(r.leads) || 0;
          const deals = Number(r.deals) || 0;
          return {
            nome: r.nome, leads, reunioes, deals,
            mrr: num(r.mrr), pont: num(r.pont),
            valor: num(r.mrr) + num(r.pont),
            // conversão por coorte: dos leads do mês, % que teve reunião (nunca > 100%)
            conv: leads > 0 ? (Number(r.leads_com_reuniao) / leads) * 100 : 0,
            // conversão direta reunião→venda: deals ganhos no mês ÷ reuniões do mês (mesma régua dos closers)
            convVenda: reunioes > 0 ? (deals / reunioes) * 100 : 0,
          };
        })
        .filter((s) => s.leads > 0 || s.reunioes > 0)
        .sort((a, b) => b.valor - a.valor);

      // ---------- 6. CANAIS DE AQUISIÇÃO (deals ganhos + reuniões por source) ----------
      // Inclui canais com reunião no período mas sem venda (deals=0), p/ conversão por canal.
      const canaisRows = await db.execute(sql`
        SELECT COALESCE(NULLIF(source, ''), '(não informado)') AS canal,
          COUNT(*) FILTER (WHERE stage_name = ${STAGE_GANHO}
            AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}) AS deals,
          COUNT(*) FILTER (WHERE stage_name = ${STAGE_GANHO}
            AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim} AND valor_recorrente::numeric > 0) AS deals_mrr,
          COUNT(*) FILTER (WHERE stage_name = ${STAGE_GANHO}
            AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim} AND valor_pontual::numeric > 0) AS deals_pont,
          COALESCE(SUM(valor_recorrente::numeric) FILTER (WHERE stage_name = ${STAGE_GANHO}
            AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}), 0) AS mrr,
          COALESCE(SUM(valor_pontual::numeric) FILTER (WHERE stage_name = ${STAGE_GANHO}
            AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}), 0) AS pont,
          COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim}) AS reunioes,
          COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim}
            AND stage_name = ${STAGE_GANHO}) AS reun_ganhas
        FROM "Bitrix".crm_deal
        WHERE (stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim})
          OR (data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim})
        GROUP BY 1 ORDER BY 2 DESC, 7 DESC
      `);
      const canais = (canaisRows.rows as any[]).map((r) => {
        const mrr = num(r.mrr), pont = num(r.pont), deals = Number(r.deals) || 0;
        const dealsMrr = Number(r.deals_mrr) || 0, dealsPont = Number(r.deals_pont) || 0;
        const reunioes = Number(r.reunioes) || 0;
        // canal = código cru (chave do drill); canalLabel = nome legível do Bitrix (exibição)
        return {
          canal: r.canal, canalLabel: sourceLabel(r.canal), deals, mrr, pont, total: mrr + pont,
          reunioes,
          // conversão por coorte: das reuniões realizadas no período, % que virou venda (nunca > 100%)
          conv: reunioes > 0 ? (Number(r.reun_ganhas) / reunioes) * 100 : 0,
          // ticket médio por tipo: só sobre deals que têm valor daquele tipo (não dilui por deals só-pontuais/só-MRR)
          ticketMrr: dealsMrr > 0 ? mrr / dealsMrr : 0,
          ticketPont: dealsPont > 0 ? pont / dealsPont : 0,
        };
      });

      // ---------- 7. FUNIL por segmento (inbound / outbound) ----------
      // Inbound = source na régua do growth.ts; outbound = o resto (inclui deals sem origem).
      const segExpr = sql`CASE WHEN source IN ('CALL','EMAIL','WEB','ADVERTISING','TRADE_SHOW','WEBFORM','OTHER','UC_4VCKGM') THEN 'inbound' ELSE 'outbound' END`;
      const isMql = sql`(mql::text = '1' OR lower(mql::text) = 'true')`;
      const funilRows = await db.execute(sql`
        SELECT ${segExpr} AS seg,
          COUNT(*) FILTER (WHERE date_create >= ${dIni} AND date_create < ${dFim}) AS leads,
          COUNT(*) FILTER (WHERE date_create >= ${dIni} AND date_create < ${dFim} AND ${isMql}) AS leads_mql,
          COUNT(*) FILTER (WHERE data_reuniao_agendada >= ${dIni} AND data_reuniao_agendada < ${dFim}) AS ra,
          COUNT(*) FILTER (WHERE data_reuniao_agendada >= ${dIni} AND data_reuniao_agendada < ${dFim} AND ${isMql}) AS ra_mql,
          COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim}) AS rr,
          COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim} AND ${isMql}) AS rr_mql,
          COUNT(*) FILTER (WHERE stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}) AS venda,
          COUNT(*) FILTER (WHERE stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim} AND ${isMql}) AS venda_mql
        FROM "Bitrix".crm_deal GROUP BY 1
      `);
      const funilPorSeg: Record<string, any> = {};
      for (const r of funilRows.rows as any[]) funilPorSeg[r.seg] = r;
      // cada etapa traz volume total + quantos são MQL (o resto = NMQL), p/ as barras empilhadas
      const etapasDe = (r: any) => [
        { etapa: "Lead", valor: Number(r?.leads) || 0, mql: Number(r?.leads_mql) || 0 },
        { etapa: "Reunião agendada", valor: Number(r?.ra) || 0, mql: Number(r?.ra_mql) || 0 },
        { etapa: "Reunião realizada", valor: Number(r?.rr) || 0, mql: Number(r?.rr_mql) || 0 },
        { etapa: "Venda", valor: Number(r?.venda) || 0, mql: Number(r?.venda_mql) || 0 },
      ];
      const funilInbound = etapasDe(funilPorSeg["inbound"]);
      const funilOutbound = etapasDe(funilPorSeg["outbound"]);

      // ---------- 7b. INVESTIMENTO & CPL (Meta Ads + Conta Azul) ----------
      const invSpendRow = await db.execute(sql`
        SELECT COALESCE(SUM(spend::numeric), 0) AS spend
        FROM meta_ads.meta_insights_daily
        WHERE date_start >= ${dIni} AND date_start < ${dFim}
      `);
      const metaAdsSpend = num((invSpendRow.rows as any[])[0]?.spend);
      const adsContaAzul = somaMeses(cacAdsPM); // já buscado na seção 2
      const invLeadsRow = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE date_create >= ${dIni} AND date_create < ${dFim}) AS leads,
          COUNT(*) FILTER (WHERE date_create >= ${dIni} AND date_create < ${dFim}
            AND (mql::text = '1' OR lower(mql::text) = 'true')) AS mqls
        FROM "Bitrix".crm_deal
        WHERE ${segExpr} = 'inbound'
      `);
      const invL = (invLeadsRow.rows as any[])[0] || {};
      const leadsInbound = Number(invL.leads) || 0;
      const mqlsInbound = Number(invL.mqls) || 0;
      const investimento = {
        metaAdsSpend,
        adsContaAzul,
        leadsInbound,
        mqlsInbound,
        cpl: leadsInbound > 0 ? Math.round(metaAdsSpend / leadsInbound) : 0,
        cplMq: mqlsInbound > 0 ? Math.round(metaAdsSpend / mqlsInbound) : 0,
      };

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
        const p = r.produto as string;
        // metas editáveis por produto (override) → orçado = nº contratos × ticket médio meta.
        // fallback do MRR: segmento do BP (onde mapeável); pontual: só via override.
        const metaTmMrr = override[`prod_tm_mrr:${p}`] ?? null;
        const metaCtrMrr = override[`prod_ctr_mrr:${p}`] ?? null;
        const metaTmPont = override[`prod_tm_pont:${p}`] ?? null;
        const metaCtrPont = override[`prod_ctr_pont:${p}`] ?? null;
        const orcadoMrr = metaTmMrr != null && metaCtrMrr != null
          ? Math.round(metaTmMrr * metaCtrMrr)
          : (seg ? orc[`vendas_mrr_${seg}`] ?? null : null);
        const orcadoPont = metaTmPont != null && metaCtrPont != null ? Math.round(metaTmPont * metaCtrPont) : null;
        return {
          produto: p,
          cMrr: Number(r.c_mrr) || 0, mrr: num(r.mrr), tmMrr: num(r.tm_mrr),
          cPont: Number(r.c_pont) || 0, pont: num(r.pont), tmPont: num(r.tm_pont),
          metaTmMrr, metaCtrMrr, metaTmPont, metaCtrPont,
          orcadoMrr, orcadoPont,
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

      // ---------- 11b. Tabela "Custo da operação" (composição do CAC) ----------
      // Orçado: override editado ?? BP 2026. Realizado: caixa (predicado) ou manual (cac_op_real:*).
      const cacOperacao = CAC_OPERACAO_ITENS.map((it) => ({
        item: it.item,
        label: it.label,
        orcado: override[`cac_op_orc:${it.item}`] ?? (it.orcBp ? orc[it.orcBp] || 0 : 0),
        realizado: it.sub ? somaMeses(cacSubPM[it.sub]) : manualReal[`cac_op_real:${it.item}`] || 0,
        fonteReal: (it.sub ? "cortex" : "manual") as "cortex" | "manual",
        sub: it.sub ?? null,
      }));

      // Mês em andamento: custos em regime caixa ficam parciais até o fechamento.
      const hoje = new Date();
      const mesParcial = ano === hoje.getFullYear() && mesesNums.includes(hoje.getMonth() + 1);

      res.json({
        mes: label,
        mesNum,
        ano,
        mesParcial,
        mesUnico: ehMesUnico,
        macro: {
          vendaMrr: { orcado: metaMrr, realizado: vMrrReal, editavel: true, chave: "venda_mrr" },
          vendaPontual: { orcado: metaPontual, realizado: vPontReal, editavel: true, chave: "venda_pontual" },
          ticketMrr, ticketPontual, taxaConversao, numReunioes,
          canais,
          cac: {
            custoTotal: { orcado: orc["cac"] || 0, realizado: cacTotalReal },
            produto: { orcado: cacProdutoOrc, realizado: cacProdutoReal, n: nContratos },
            cliente: { orcado: cacClienteOrc, realizado: cacClienteReal, n: nClientes },
            operacao: cacOperacao,
          },
        },
        pessoas: {
          custoComercial: { orcado: (orc["cac_vendas"] || 0) + (orc["cac_pre_vendas"] || 0), realizado: custoComercialReal },
          comissoes: { orcado: orc["cac_comissoes"] || 0, realizado: comissoesReal },
          closers,
          sdrs,
        },
        micro: { produtos, vendedores: closers, sdrs },
        funil: { inbound: funilInbound, outbound: funilOutbound, mql, investimento },
        qualidade: { churnPorMotivo, churnPorVendedor, total: churnTotal },
      });
    } catch (error) {
      console.error("[api] Error em /api/gestao/receita:", error);
      res.status(500).json({ error: "Falha ao montar Gestão de Receita" });
    }
  });

  // Drill-down: lista os itens que compõem uma célula (tipo + chave + mês).
  app.get("/api/gestao/receita/detalhe", async (req, res) => {
    try {
      const tipo = req.query.tipo;
      if (!tipoValido(tipo)) return res.status(400).json({ error: "tipo inválido" });
      const { dIni, dFim, label } = parsePeriodo(req.query);
      const chave = typeof req.query.chave === "string" ? req.query.chave : "";
      const detalhe = await montarDetalhe(db, { tipo, chave, dIni, dFim, label });
      res.json(detalhe);
    } catch (error) {
      console.error("[api] Error em /api/gestao/receita/detalhe:", error);
      res.status(500).json({ error: "Falha ao montar detalhamento" });
    }
  });

  // Salva metas editadas na tela (override do orçado do BP). Body: { mes:"YYYY-MM", metas:[{chave, valor}] }.
  const CHAVE_META_OK = /^(venda_mrr|venda_pontual|prod_(tm|ctr)_(mrr|pont):.+|cac_op_(orc|real):[a-z_]+)$/;
  app.put("/api/gestao/receita/metas", async (req, res) => {
    try {
      const { ano, mesNum } = parsePeriodo(req.body || {});
      const metas = Array.isArray(req.body?.metas) ? req.body.metas : [];
      const user = (req.user as any)?.email || (req.user as any)?.username || "desconhecido";
      const validas = metas.filter((m: any) => typeof m?.chave === "string" && CHAVE_META_OK.test(m.chave) && Number.isFinite(Number(m?.valor)));
      for (const m of validas) {
        await db.execute(sql`
          INSERT INTO cortex_core.gestao_receita_metas (chave, ano, mes, valor, updated_by, updated_at)
          VALUES (${m.chave}, ${ano}, ${mesNum}, ${Number(m.valor)}, ${user}, NOW())
          ON CONFLICT (chave, ano, mes) DO UPDATE SET valor = EXCLUDED.valor, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        `);
      }
      res.json({ ok: true, salvas: validas.length });
    } catch (error) {
      console.error("[api] Error em PUT /api/gestao/receita/metas:", error);
      res.status(500).json({ error: "Falha ao salvar metas" });
    }
  });
}

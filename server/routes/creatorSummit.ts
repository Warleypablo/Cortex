import type { Express } from "express";
import { sql } from "drizzle-orm";
import {
  SUMMIT_CATEGORY_ID,
  SUMMIT_CAMPAIGN_KEYWORD,
  SUMMIT_TICKET_TYPES,
  SUMMIT_DEFAULT_PRECO,
  SUMMIT_DEFAULT_PRECO_LIQUIDO,
} from "@shared/produtos";
import { getSessionsByPlatform } from "../services/ga4Sessions";

// Stage de "ingresso vendido" no pipeline de Eventos (cat 10).
// stage_semantic vem nulo nesse pipeline, então casamos pelo nome.
const SUMMIT_WON_STAGE = "Negócios Ganhos";

// Atribuição de um deal ao Meta Ads: veio de um anúncio do Summit (utm_content =
// ad_id) ou tem utm de tráfego pago do Meta. (Maioria das COMPRAS perde o UTM na
// Sympla — por isso compras/receita do Meta dependem de sincronizar a conversão
// de compra do pixel; ver bloco `meta` abaixo.)
const metaAttribCond = (adIdsSubquery: any) => sql`(
  d.utm_content IN ${adIdsSubquery}
  OR (lower(d.utm_source) IN ('facebook','instagram','fb','ig')
      AND lower(coalesce(d.utm_medium,'')) IN ('paid','cpc','ads','paid_social'))
)`;

function tipoCaseSql(col = sql`d.fnl_ngc`) {
  const whens = SUMMIT_TICKET_TYPES.map((t) => {
    const conds = t.match.map((m) => sql`lower(coalesce(${col}, '')) LIKE ${"%" + m + "%"}`);
    return sql`WHEN (${sql.join(conds, sql` OR `)}) THEN ${t.key}`;
  });
  return sql`CASE ${sql.join(whens, sql` `)} ELSE ${"sem_tipo"} END`;
}

function precoCaseSql(field: "preco" | "precoLiquido", col = sql`d.fnl_ngc`) {
  const def = field === "preco" ? SUMMIT_DEFAULT_PRECO : SUMMIT_DEFAULT_PRECO_LIQUIDO;
  const whens = SUMMIT_TICKET_TYPES.map((t) => {
    const conds = t.match.map((m) => sql`lower(coalesce(${col}, '')) LIKE ${"%" + m + "%"}`);
    return sql`WHEN (${sql.join(conds, sql` OR `)}) THEN ${sql.raw(String(t[field]))}`;
  });
  return sql`CASE ${sql.join(whens, sql` `)} ELSE ${sql.raw(String(def))} END`;
}

export function registerCreatorSummitRoutes(app: Express, db: any) {
  app.get("/api/growth/creator-summit", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const wonCond = sql`d.stage_name = ${SUMMIT_WON_STAGE}`;
      const catCond = sql`d.category_id = ${SUMMIT_CATEGORY_ID}`;
      const campKeyword = `%${SUMMIT_CAMPAIGN_KEYWORD}%`;

      const summitCampaignIds = sql`(
        SELECT DISTINCT c.campaign_id::text
        FROM meta_ads.meta_campaigns c
        WHERE c.campaign_name ILIKE ${campKeyword}
      )`;
      const summitAdIds = sql`(
        SELECT a.ad_id::text
        FROM meta_ads.meta_ads a
        JOIN meta_ads.meta_campaigns c ON c.campaign_id = a.campaign_id
        WHERE c.campaign_name ILIKE ${campKeyword}
      )`;

      const [metaMedia, metaLeadsRow, funilByType] = await Promise.all([
        // 1. Mídia Meta (campanhas com "summit" no nome)
        db.execute(sql`
          SELECT
            COALESCE(SUM(i.spend), 0) AS investimento,
            COALESCE(SUM(i.impressions), 0) AS impressoes,
            COALESCE(SUM(i.reach), 0) AS alcance,
            COALESCE(SUM(i.clicks), 0) AS cliques_totais,
            COALESCE(SUM(i.outbound_clicks), 0) AS cliques,
            COALESCE(SUM(i.unique_outbound_clicks), 0) AS cliques_unicos,
            COALESCE(SUM(i.landing_page_views), 0) AS visualizacoes_pagina
          FROM meta_ads.meta_insights_daily i
          WHERE i.date_start >= ${yearStart}::date
            AND i.date_start <= ${yearEnd}::date
            AND i.campaign_id IN ${summitCampaignIds}
        `),

        // 2. Leads atribuídos ao Meta (cat 10)
        db.execute(sql`
          SELECT COUNT(*) AS leads
          FROM "Bitrix".crm_deal d
          WHERE ${catCond}
            AND d.date_create >= ${yearStart}::date
            AND d.date_create < (${yearEnd}::date + INTERVAL '1 day')
            AND ${metaAttribCond(summitAdIds)}
        `),

        // 3. Funil consolidado por tipo de ingresso (todos os canais)
        db.execute(sql`
          SELECT
            ${tipoCaseSql()} AS tipo,
            COUNT(*) AS leads,
            COUNT(*) FILTER (WHERE ${wonCond}) AS ingressos,
            COALESCE(SUM(CASE WHEN ${wonCond} THEN ${precoCaseSql("preco")} ELSE 0 END), 0) AS receita_bruta,
            COALESCE(SUM(CASE WHEN ${wonCond} THEN ${precoCaseSql("precoLiquido")} ELSE 0 END), 0) AS receita_liquida
          FROM "Bitrix".crm_deal d
          WHERE ${catCond}
            AND d.date_create >= ${yearStart}::date
            AND d.date_create < (${yearEnd}::date + INTERVAL '1 day')
          GROUP BY 1
        `),
      ]);

      // GA4 — sessões/page views do tráfego Meta do Summit (resiliente a falha)
      let ga4Sessoes = 0;
      let ga4PageViews = 0;
      try {
        const ids = (
          await db.execute(sql`
            SELECT DISTINCT campaign_id::text AS id
            FROM meta_ads.meta_campaigns
            WHERE campaign_name ILIKE ${campKeyword}
          `)
        ).rows.map((r: any) => r.id);
        const ga4 = await getSessionsByPlatform(new Date(yearStart), new Date(yearEnd), {
          utmCampaignContains: [SUMMIT_CAMPAIGN_KEYWORD],
          campaignIdIn: ids,
        });
        ga4Sessoes = ga4.byPlatform?.meta_ads || 0;
        ga4PageViews = ga4.byPlatformPageViews?.meta_ads || 0;
      } catch (err) {
        console.log("[creator-summit] GA4 sessions skipped:", (err as any)?.message || err);
      }

      const num = (v: any) => parseFloat(v) || 0;

      // ---- Bloco META (mídia) ----
      const mm = metaMedia.rows[0] || {};
      const mInvest = num(mm.investimento);
      const mImpr = num(mm.impressoes);
      const mAlcance = num(mm.alcance);
      const mCliques = num(mm.cliques); // outbound
      const mCliquesUnicos = num(mm.cliques_unicos);
      const mVdP = num(mm.visualizacoes_pagina);
      const mLeads = num((metaLeadsRow.rows[0] || {}).leads);

      // Espelha o conjunto do Orçado×Realizado (Meta), enxuto: sem alcance,
      // frequência e cliques de saída (números brutos pedidos pra remover).
      const meta = {
        investimento: mInvest,
        cpm: mImpr > 0 ? (mInvest / mImpr) * 1000 : 0,
        ctr: mImpr > 0 ? (mCliques / mImpr) * 100 : 0,
        ctrUnico: mAlcance > 0 ? (mCliquesUnicos / mAlcance) * 100 : 0,
        connectRate: mCliques > 0 ? (mVdP / mCliques) * 100 : 0,
        sessoes: ga4Sessoes,
        // Conversão de página: por visualização de página (pixel) e por sessões (GA4)
        txConversaoVdP: mVdP > 0 ? (mLeads / mVdP) * 100 : 0,
        txConversaoSessoes: ga4Sessoes > 0 ? (mLeads / ga4Sessoes) * 100 : 0,
        leads: mLeads,
        cpl: mLeads > 0 ? mInvest / mLeads : 0,
        // Carrinho abandonado e vendas dependem de capturar os eventos do pixel
        // (InitiateCheckout / Purchase) no sync do Meta — não disponível hoje.
        carrinhoAbandonado: null as number | null,
        vendas: null as number | null,
        receita: null as number | null,
        roas: null as number | null,
      };

      // ---- Bloco CONSOLIDADO (todos os canais) ----
      const tipoMap = new Map(SUMMIT_TICKET_TYPES.map((t) => [t.key, t]));
      const porTipo = (funilByType.rows as any[]).map((r) => {
        const t = tipoMap.get(r.tipo);
        return {
          key: r.tipo,
          label: t?.label ?? "Sem tipo",
          preco: t?.preco ?? SUMMIT_DEFAULT_PRECO,
          precoLiquido: t?.precoLiquido ?? SUMMIT_DEFAULT_PRECO_LIQUIDO,
          leads: num(r.leads),
          ingressos: num(r.ingressos),
          receitaBruta: num(r.receita_bruta),
          receitaLiquida: num(r.receita_liquida),
        };
      });
      const ordem = [...SUMMIT_TICKET_TYPES.map((t) => t.key), "sem_tipo"];
      porTipo.sort((a, b) => ordem.indexOf(a.key) - ordem.indexOf(b.key));

      const leads = porTipo.reduce((s, t) => s + t.leads, 0);
      const ingressos = porTipo.reduce((s, t) => s + t.ingressos, 0);
      const receitaBruta = porTipo.reduce((s, t) => s + t.receitaBruta, 0);
      const receitaLiquida = porTipo.reduce((s, t) => s + t.receitaLiquida, 0);

      const consolidado = {
        // Investimento total = mídia paga do Summit (hoje só Meta rodou)
        investimento: mInvest,
        leads,
        carrinhoAbandonado: null as number | null,
        ingressos,
        receitaBruta,
        receitaLiquida,
        cpl: leads > 0 ? mInvest / leads : 0,
        cacIngresso: ingressos > 0 ? mInvest / ingressos : 0,
        ticketMedioBruto: ingressos > 0 ? receitaBruta / ingressos : 0,
        ticketMedioLiquido: ingressos > 0 ? receitaLiquida / ingressos : 0,
        roasBruto: mInvest > 0 ? receitaBruta / mInvest : 0,
        roasLiquido: mInvest > 0 ? receitaLiquida / mInvest : 0,
        taxaConversao: leads > 0 ? ingressos / leads : 0,
      };

      res.json({
        year,
        meta,
        consolidado,
        porTipo,
        premissaPreco: SUMMIT_TICKET_TYPES.map((t) => ({
          label: t.label,
          preco: t.preco,
          precoLiquido: t.precoLiquido,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creator-summit:", error);
      res.status(500).json({ error: "Failed to fetch creator summit metrics" });
    }
  });
}

import type { Express } from "express";
import { sql } from "drizzle-orm";
import {
  SUMMIT_CATEGORY_ID,
  SUMMIT_CAMPAIGN_KEYWORD,
  SUMMIT_TICKET_TYPES,
  SUMMIT_DEFAULT_PRECO,
  SUMMIT_DEFAULT_PRECO_LIQUIDO,
} from "@shared/produtos";

// Stage de "ingresso vendido" no pipeline de Eventos (cat 10).
// stage_semantic vem nulo nesse pipeline, então casamos pelo nome.
const SUMMIT_WON_STAGE = "Negócios Ganhos";

/**
 * Expressão SQL do label do tipo de ingresso (ou 'sem_tipo'), derivada de
 * SUMMIT_TICKET_TYPES (fonte única de verdade).
 */
function tipoCaseSql(col = sql`d.fnl_ngc`) {
  const whens = SUMMIT_TICKET_TYPES.map((t) => {
    const conds = t.match.map((m) => sql`lower(coalesce(${col}, '')) LIKE ${"%" + m + "%"}`);
    return sql`WHEN (${sql.join(conds, sql` OR `)}) THEN ${t.key}`;
  });
  return sql`CASE ${sql.join(whens, sql` `)} ELSE ${"sem_tipo"} END`;
}

/**
 * Expressão SQL do preço do ingresso. `field` escolhe bruto (preco) ou líquido
 * (precoLiquido). Emitido como literal numérico (sql.raw) — são constantes
 * confiáveis; como parâmetro ($n) o Postgres não casa o tipo com o ELSE 0.
 */
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

      const [spendTotal, funilByType] = await Promise.all([
        // Gasto/impressões/cliques total do ano (campanhas Meta com "summit" no nome)
        db.execute(sql`
          SELECT
            COALESCE(SUM(i.spend), 0) AS investimento,
            COALESCE(SUM(i.impressions), 0) AS impressoes,
            COALESCE(SUM(i.outbound_clicks), 0) AS cliques
          FROM meta_ads.meta_insights_daily i
          WHERE i.date_start >= ${yearStart}::date
            AND i.date_start <= ${yearEnd}::date
            AND i.campaign_id IN ${summitCampaignIds}
        `),

        // Funil por tipo de ingresso (leads, ingressos, receita bruta + líquida)
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

      const num = (v: any) => parseFloat(v) || 0;

      const sRow = spendTotal.rows[0] || {};
      const investimento = num(sRow.investimento);
      const impressoes = num(sRow.impressoes);
      const cliques = num(sRow.cliques);

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

      const totais = {
        investimento,
        impressoes,
        cliques,
        leads,
        // Carrinho abandonado vive na Sympla (externo) — sem fonte no banco hoje.
        carrinhoAbandonado: null as number | null,
        ingressos,
        receitaBruta,
        receitaLiquida,
        cpl: leads > 0 ? investimento / leads : 0,
        cacIngresso: ingressos > 0 ? investimento / ingressos : 0,
        ticketMedioBruto: ingressos > 0 ? receitaBruta / ingressos : 0,
        ticketMedioLiquido: ingressos > 0 ? receitaLiquida / ingressos : 0,
        roasBruto: investimento > 0 ? receitaBruta / investimento : 0,
        roasLiquido: investimento > 0 ? receitaLiquida / investimento : 0,
        taxaConversao: leads > 0 ? ingressos / leads : 0,
      };

      res.json({
        year,
        totais,
        porTipo,
        // Premissa exposta na UI: receita = nº ingressos × preço tabelado por tipo.
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

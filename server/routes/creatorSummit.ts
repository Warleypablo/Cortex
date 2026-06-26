import type { Express } from "express";
import { sql } from "drizzle-orm";
import {
  SUMMIT_CATEGORY_ID,
  SUMMIT_CAMPAIGN_KEYWORD,
  SUMMIT_TICKET_TYPES,
  SUMMIT_DEFAULT_PRECO,
} from "@shared/produtos";

// Stage de "ingresso vendido" no pipeline de Eventos (cat 10).
// stage_semantic vem nulo nesse pipeline, então casamos pelo nome.
const SUMMIT_WON_STAGE = "Negócios Ganhos";

const monthNames = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/**
 * Expressão SQL do preço do ingresso de um deal, derivada de SUMMIT_TICKET_TYPES
 * (fonte única de verdade). Default PASS quando o fnl_ngc não casa nenhum tipo.
 */
function precoCaseSql(col = sql`d.fnl_ngc`) {
  // Preços emitidos como literais numéricos (sql.raw) — são constantes confiáveis.
  // Se forem parâmetros ($n), o Postgres não casa o tipo com o ELSE 0 do SUM.
  const whens = SUMMIT_TICKET_TYPES.map((t) => {
    const conds = t.match.map((m) => sql`lower(coalesce(${col}, '')) LIKE ${"%" + m + "%"}`);
    return sql`WHEN (${sql.join(conds, sql` OR `)}) THEN ${sql.raw(String(t.preco))}`;
  });
  return sql`CASE ${sql.join(whens, sql` `)} ELSE ${sql.raw(String(SUMMIT_DEFAULT_PRECO))} END`;
}

/** Expressão SQL do label do tipo de ingresso (ou 'Sem tipo'). */
function tipoCaseSql(col = sql`d.fnl_ngc`) {
  const whens = SUMMIT_TICKET_TYPES.map((t) => {
    const conds = t.match.map((m) => sql`lower(coalesce(${col}, '')) LIKE ${"%" + m + "%"}`);
    return sql`WHEN (${sql.join(conds, sql` OR `)}) THEN ${t.key}`;
  });
  return sql`CASE ${sql.join(whens, sql` `)} ELSE ${"sem_tipo"} END`;
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

      // Subquery de campanhas Summit (por nome) → ids para casar com insights.
      const summitCampaignIds = sql`(
        SELECT DISTINCT c.campaign_id::text
        FROM meta_ads.meta_campaigns c
        WHERE c.campaign_name ILIKE ${campKeyword}
      )`;

      const [spendTotal, spendMonthly, funilByType, funilMonthly, campanhas] =
        await Promise.all([
          // 1. Gasto/impressões/cliques total do ano
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

          // 2. Gasto por mês
          db.execute(sql`
            SELECT to_char(i.date_start, 'YYYY-MM') AS mes,
              COALESCE(SUM(i.spend), 0) AS investimento
            FROM meta_ads.meta_insights_daily i
            WHERE i.date_start >= ${yearStart}::date
              AND i.date_start <= ${yearEnd}::date
              AND i.campaign_id IN ${summitCampaignIds}
            GROUP BY to_char(i.date_start, 'YYYY-MM')
          `),

          // 3. Funil por tipo de ingresso (cadastros, ingressos, receita)
          db.execute(sql`
            SELECT
              ${tipoCaseSql()} AS tipo,
              COUNT(*) AS cadastros,
              COUNT(*) FILTER (WHERE ${wonCond}) AS ingressos,
              COALESCE(SUM(CASE WHEN ${wonCond} THEN ${precoCaseSql()} ELSE 0 END), 0) AS receita
            FROM "Bitrix".crm_deal d
            WHERE ${catCond}
              AND d.date_create >= ${yearStart}::date
              AND d.date_create < (${yearEnd}::date + INTERVAL '1 day')
            GROUP BY 1
          `),

          // 4. Funil por mês (data de criação do deal)
          db.execute(sql`
            SELECT
              to_char(d.date_create, 'YYYY-MM') AS mes,
              COUNT(*) AS cadastros,
              COUNT(*) FILTER (WHERE ${wonCond}) AS ingressos,
              COALESCE(SUM(CASE WHEN ${wonCond} THEN ${precoCaseSql()} ELSE 0 END), 0) AS receita
            FROM "Bitrix".crm_deal d
            WHERE ${catCond}
              AND d.date_create >= ${yearStart}::date
              AND d.date_create < (${yearEnd}::date + INTERVAL '1 day')
            GROUP BY to_char(d.date_create, 'YYYY-MM')
          `),

          // 5. Campanhas Summit individualizadas (transparência do gasto)
          db.execute(sql`
            SELECT c.campaign_name AS nome,
              COALESCE(SUM(i.spend), 0) AS investimento,
              COALESCE(SUM(i.impressions), 0) AS impressoes,
              COALESCE(SUM(i.outbound_clicks), 0) AS cliques
            FROM meta_ads.meta_insights_daily i
            JOIN meta_ads.meta_campaigns c ON c.campaign_id::text = i.campaign_id
            WHERE i.date_start >= ${yearStart}::date
              AND i.date_start <= ${yearEnd}::date
              AND c.campaign_name ILIKE ${campKeyword}
            GROUP BY c.campaign_name
            ORDER BY 2 DESC
          `),
        ]);

      const num = (v: any) => parseFloat(v) || 0;

      // ---- Totais ----
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
          cadastros: num(r.cadastros),
          ingressos: num(r.ingressos),
          receita: num(r.receita),
        };
      });
      // Ordena pelos tipos canônicos, "Sem tipo" por último.
      const ordem = [...SUMMIT_TICKET_TYPES.map((t) => t.key), "sem_tipo"];
      porTipo.sort((a, b) => ordem.indexOf(a.key) - ordem.indexOf(b.key));

      const cadastros = porTipo.reduce((s, t) => s + t.cadastros, 0);
      const ingressos = porTipo.reduce((s, t) => s + t.ingressos, 0);
      const receita = porTipo.reduce((s, t) => s + t.receita, 0);

      const totais = {
        investimento,
        impressoes,
        cliques,
        cadastros,
        ingressos,
        receita,
        cpl: cadastros > 0 ? investimento / cadastros : 0,
        cacIngresso: ingressos > 0 ? investimento / ingressos : 0,
        ticketMedio: ingressos > 0 ? receita / ingressos : 0,
        roas: investimento > 0 ? receita / investimento : 0,
        taxaConversao: cadastros > 0 ? ingressos / cadastros : 0,
      };

      // ---- Série mensal (só meses com algum dado) ----
      const spendByMes: Record<string, number> = {};
      for (const r of spendMonthly.rows as any[]) spendByMes[r.mes] = num(r.investimento);
      const funilByMes: Record<string, any> = {};
      for (const r of funilMonthly.rows as any[]) funilByMes[r.mes] = r;

      const mesesComDado = new Set([
        ...Object.keys(spendByMes),
        ...Object.keys(funilByMes),
      ]);
      const series = Array.from(mesesComDado)
        .sort()
        .map((mes) => {
          const f = funilByMes[mes] || {};
          const inv = spendByMes[mes] || 0;
          const cad = num(f.cadastros);
          const ing = num(f.ingressos);
          const rec = num(f.receita);
          const [, mm] = mes.split("-");
          return {
            mes,
            label: `${monthNames[parseInt(mm) - 1]}/${mes.slice(2, 4)}`,
            investimento: inv,
            cadastros: cad,
            ingressos: ing,
            receita: rec,
            roas: inv > 0 ? rec / inv : 0,
          };
        });

      res.json({
        year,
        totais,
        porTipo,
        series,
        campanhas: (campanhas.rows as any[]).map((r) => ({
          nome: r.nome,
          investimento: num(r.investimento),
          impressoes: num(r.impressoes),
          cliques: num(r.cliques),
        })),
        // Premissa exposta na UI: receita = nº ingressos × preço tabelado por tipo.
        premissaPreco: SUMMIT_TICKET_TYPES.map((t) => ({ label: t.label, preco: t.preco })),
      });
    } catch (error) {
      console.error("[api] Error fetching creator-summit:", error);
      res.status(500).json({ error: "Failed to fetch creator summit metrics" });
    }
  });
}

import type { Express } from "express";
import { sql } from "drizzle-orm";
import { expandFunilValues } from "@shared/produtos";

const TURBO_PARTNERS_ACCOUNT_ID = "act_1331413260627780";

type Bucket = {
  key: string;
  type: "month" | "week";
  label: string;
  monthKey?: string;
  start: string;
  end: string;
};

type MetricRow = {
  id: string;
  name: string;
  format: "currency" | "number" | "percent";
  section: "marketing" | "site" | "mql" | "nao-mql" | "total";
  values: Record<string, { realizado: number; orcado: number | null }>;
};

function buildMonthBuckets(year: number): Bucket[] {
  const monthNames = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  const buckets: Bucket[] = [];
  for (let m = 0; m < 12; m++) {
    const mm = String(m + 1).padStart(2, "0");
    const lastDay = new Date(year, m + 1, 0).getDate();
    buckets.push({
      key: `${year}-${mm}`,
      type: "month",
      label: `${monthNames[m]}/${String(year).slice(2)}`,
      start: `${year}-${mm}-01`,
      end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    });
  }
  return buckets;
}

export function registerGrowthTimeseriesRoutes(app: Express, db: any) {
  app.get("/api/growth/orcado-realizado/timeseries", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const grouping = ((req.query.grouping as string) || "month") as "month" | "week";
      const section = ((req.query.section as string) || "consolidado") as "consolidado" | "aprofundado";

      if (grouping !== "month") {
        return res.status(400).json({ error: "Only grouping=month is supported in v1" });
      }
      if (section !== "consolidado") {
        return res.status(400).json({ error: "Only section=consolidado is supported in v1" });
      }

      // Funil filter
      const funilNgcRaw = req.query.funilNgc as string | undefined;
      const funilValues = funilNgcRaw
        ? funilNgcRaw.split(",").map((v) => decodeURIComponent(v).trim()).filter(Boolean)
        : [];
      const hasVazio = funilValues.includes("(Vazio)");
      const realFunilValues = expandFunilValues(funilValues.filter((v) => v !== "(Vazio)"));

      let funilFilter = sql``;
      if (funilValues.length > 0) {
        if (hasVazio && realFunilValues.length > 0) {
          funilFilter = sql`AND (${sql.join(realFunilValues.map((v) => sql`d.fnl_ngc ILIKE ${v}`), sql` OR `)} OR d.fnl_ngc IS NULL OR d.fnl_ngc = '')`;
        } else if (hasVazio) {
          funilFilter = sql`AND (d.fnl_ngc IS NULL OR d.fnl_ngc = '')`;
        } else {
          funilFilter = sql`AND (${sql.join(realFunilValues.map((v) => sql`d.fnl_ngc ILIKE ${v}`), sql` OR `)})`;
        }
      }

      // UTM Source filter
      const utmSourceParam = req.query.utmSource as string | undefined;
      let utmSourceFilter = sql``;
      if (utmSourceParam && utmSourceParam !== "todos") {
        const utmValues = utmSourceParam.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
        if (utmValues.length === 1) {
          utmSourceFilter = sql`AND LOWER(d.utm_source) LIKE ${utmValues[0] + "%"}`;
        } else if (utmValues.length > 1) {
          utmSourceFilter = sql`AND (${sql.join(utmValues.map((v) => sql`LOWER(d.utm_source) LIKE ${v + "%"}`), sql` OR `)})`;
        }
      }

      // Campaign filter (for Meta Ads spend) when funil selected
      let campaignFilter = sql``;
      if (realFunilValues.length > 0) {
        const nameConditions = realFunilValues.map(
          (v) => sql`(c.campaign_name ILIKE ${"%[" + v + "]%"} OR c.campaign_name ILIKE ${"%" + v + "%"})`,
        );
        let nameFilter = sql.join(nameConditions, sql` OR `);
        if (hasVazio) {
          nameFilter = sql`(${nameFilter} OR c.campaign_name NOT LIKE '%[%]%')`;
        }
        campaignFilter = sql`AND mid.campaign_id IN (
          SELECT DISTINCT c.campaign_id::text
          FROM meta_ads.meta_campaigns c
          WHERE (${nameFilter})
        )`;
      } else if (hasVazio) {
        campaignFilter = sql`AND mid.campaign_id IN (
          SELECT DISTINCT c.campaign_id::text
          FROM meta_ads.meta_campaigns c
          WHERE c.campaign_name NOT LIKE '%[%]%'
        )`;
      }

      const buckets = buildMonthBuckets(year);
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      // Inbound filter
      const inboundFilter = sql`AND d.source IN ('CALL','EMAIL','WEB','ADVERTISING','TRADE_SHOW','WEBFORM','OTHER','UC_4VCKGM')`;
      const mqlCond = sql`(d.mql::text = '1' OR LOWER(d.mql::text) = 'true')`;
      const naoMqlCond = sql`(d.mql IS NULL OR (d.mql::text <> '1' AND LOWER(d.mql::text) <> 'true'))`;

      // ---- Queries executadas em paralelo ----
      const [metaAdsMonthly, bitrixCreatedMonthly, bitrixRrMqlMonthly, bitrixRrNaoMqlMonthly, bitrixGanhosMqlMonthly, bitrixGanhosNaoMqlMonthly, budgetsRows] = await Promise.all([
        // 1. Meta Ads: spend, impressions, outbound clicks, landing page views por mês
        db.execute(sql`
          SELECT
            to_char(mid.date_start, 'YYYY-MM') AS bucket,
            COALESCE(SUM(mid.spend), 0) AS investimento,
            COALESCE(SUM(mid.impressions), 0) AS impressoes,
            COALESCE(SUM(mid.outbound_clicks), 0) AS cliques_saida,
            COALESCE(SUM(mid.landing_page_views), 0) AS visualizacoes_pagina
          FROM meta_ads.meta_insights_daily mid
          WHERE mid.date_start >= ${yearStart}::date
            AND mid.date_start <= ${yearEnd}::date
            AND mid.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
            ${campaignFilter}
          GROUP BY to_char(mid.date_start, 'YYYY-MM')
        `),

        // 2. Leads criados (qualquer MQL/não-MQL, inbound) por mês
        db.execute(sql`
          SELECT
            to_char(d.created_at, 'YYYY-MM') AS bucket,
            COUNT(*) AS leads,
            COUNT(*) FILTER (WHERE ${mqlCond}) AS mqls
          FROM "Bitrix".crm_deal d
          WHERE d.created_at >= ${yearStart}::date
            AND d.created_at < (${yearEnd}::date + INTERVAL '1 day')
            ${inboundFilter}
            ${funilFilter}
            ${utmSourceFilter}
          GROUP BY to_char(d.created_at, 'YYYY-MM')
        `),

        // 3. Reuniões Realizadas MQL por mês (data_reuniao_realizada)
        db.execute(sql`
          SELECT
            to_char(d.data_reuniao_realizada, 'YYYY-MM') AS bucket,
            COUNT(*) AS rr
          FROM "Bitrix".crm_deal d
          WHERE d.data_reuniao_realizada IS NOT NULL
            AND d.data_reuniao_realizada::date >= ${yearStart}::date
            AND d.data_reuniao_realizada::date <= ${yearEnd}::date
            AND ${mqlCond}
            ${inboundFilter}
            ${funilFilter}
            ${utmSourceFilter}
          GROUP BY to_char(d.data_reuniao_realizada, 'YYYY-MM')
        `),

        // 4. Reuniões Realizadas Não-MQL por mês
        db.execute(sql`
          SELECT
            to_char(d.data_reuniao_realizada, 'YYYY-MM') AS bucket,
            COUNT(*) AS rr
          FROM "Bitrix".crm_deal d
          WHERE d.data_reuniao_realizada IS NOT NULL
            AND d.data_reuniao_realizada::date >= ${yearStart}::date
            AND d.data_reuniao_realizada::date <= ${yearEnd}::date
            AND ${naoMqlCond}
            ${inboundFilter}
            ${funilFilter}
            ${utmSourceFilter}
          GROUP BY to_char(d.data_reuniao_realizada, 'YYYY-MM')
        `),

        // 5. Deals ganhos + faturamento MQL por mês (data_fechamento)
        db.execute(sql`
          SELECT
            to_char(d.data_fechamento, 'YYYY-MM') AS bucket,
            COUNT(*) FILTER (WHERE d.stage_name = 'Negócio Ganho') AS ganhos,
            COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN COALESCE(d.valor_recorrente,0) + COALESCE(d.valor_pontual,0) ELSE 0 END), 0) AS faturamento
          FROM "Bitrix".crm_deal d
          WHERE d.data_fechamento >= ${yearStart}::date
            AND d.data_fechamento <= ${yearEnd}::date
            AND ${mqlCond}
            ${inboundFilter}
            ${funilFilter}
            ${utmSourceFilter}
          GROUP BY to_char(d.data_fechamento, 'YYYY-MM')
        `),

        // 6. Deals ganhos + faturamento Não-MQL por mês
        db.execute(sql`
          SELECT
            to_char(d.data_fechamento, 'YYYY-MM') AS bucket,
            COUNT(*) FILTER (WHERE d.stage_name = 'Negócio Ganho') AS ganhos,
            COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN COALESCE(d.valor_recorrente,0) + COALESCE(d.valor_pontual,0) ELSE 0 END), 0) AS faturamento
          FROM "Bitrix".crm_deal d
          WHERE d.data_fechamento >= ${yearStart}::date
            AND d.data_fechamento <= ${yearEnd}::date
            AND ${naoMqlCond}
            ${inboundFilter}
            ${funilFilter}
            ${utmSourceFilter}
          GROUP BY to_char(d.data_fechamento, 'YYYY-MM')
        `),

        // 7. Orçados do ano (growth_budgets) filtrado por funil (se único) ou 'todos'
        (async () => {
          const budgetFunil = realFunilValues.length === 1 ? realFunilValues[0] : "todos";
          const mesesAno = buckets.map((b) => b.key);
          return db.execute(sql`
            SELECT mes, segmento, metricas FROM meta_ads.growth_budgets
            WHERE mes IN (${sql.join(mesesAno.map((m) => sql`${m}`), sql`, `)})
              AND funil = ${budgetFunil}
          `);
        })(),
      ]);

      // ---- Google Ads (query separada por resiliência — tabela pode não existir) ----
      const googleAdsMonthly: Record<string, number> = {};
      if (funilValues.length === 0) {
        try {
          const colsResult = await db.execute(sql`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'google' AND table_name = 'campaign_daily_metrics'
          `);
          const columns = colsResult.rows.map((r: any) => r.column_name);
          const dateCol = columns.includes("report_date") ? "report_date"
            : columns.includes("metric_date") ? "metric_date"
            : columns.includes("date") ? "date"
            : columns.includes("segments_date") ? "segments_date" : null;

          if (dateCol && columns.includes("cost_micros")) {
            const gRes = await db.execute(sql.raw(`
              SELECT to_char(${dateCol}, 'YYYY-MM') AS bucket,
                COALESCE(SUM(cost_micros) / 1000000.0, 0) AS investimento
              FROM google.campaign_daily_metrics
              WHERE ${dateCol} >= '${yearStart}'::date AND ${dateCol} <= '${yearEnd}'::date
              GROUP BY to_char(${dateCol}, 'YYYY-MM')
            `));
            for (const row of gRes.rows as any[]) {
              googleAdsMonthly[row.bucket] = parseFloat(row.investimento) || 0;
            }
          }
        } catch (err) {
          console.log("[timeseries] Google Ads query skipped:", (err as any)?.message || err);
        }
      }

      // ---- Transformar rows em mapas por bucket ----
      const mapBy = (rows: any[], field: string) => {
        const out: Record<string, number> = {};
        for (const r of rows) out[r.bucket] = parseFloat(r[field]) || parseInt(r[field]) || 0;
        return out;
      };

      const metaInvest = mapBy(metaAdsMonthly.rows as any[], "investimento");
      const metaImpr = mapBy(metaAdsMonthly.rows as any[], "impressoes");
      const metaCliquesSaida = mapBy(metaAdsMonthly.rows as any[], "cliques_saida");
      const metaViews = mapBy(metaAdsMonthly.rows as any[], "visualizacoes_pagina");

      const leadsByMonth = mapBy(bitrixCreatedMonthly.rows as any[], "leads");
      const mqlsByMonth = mapBy(bitrixCreatedMonthly.rows as any[], "mqls");
      const rrMqlByMonth = mapBy(bitrixRrMqlMonthly.rows as any[], "rr");
      const rrNaoMqlByMonth = mapBy(bitrixRrNaoMqlMonthly.rows as any[], "rr");
      const ganhosMqlByMonth = mapBy(bitrixGanhosMqlMonthly.rows as any[], "ganhos");
      const ganhosNaoMqlByMonth = mapBy(bitrixGanhosNaoMqlMonthly.rows as any[], "ganhos");
      const fatMqlByMonth = mapBy(bitrixGanhosMqlMonthly.rows as any[], "faturamento");
      const fatNaoMqlByMonth = mapBy(bitrixGanhosNaoMqlMonthly.rows as any[], "faturamento");

      // Agregar orçados por mês (somar segmentos — marketing + mql + nao-mql + total)
      const orcInvestByMonth: Record<string, number> = {};
      const orcLeadsByMonth: Record<string, number> = {};
      const orcMqlByMonth: Record<string, number> = {};
      const orcRrMqlByMonth: Record<string, number> = {};
      const orcRrNaoMqlByMonth: Record<string, number> = {};
      const orcGanhosMqlByMonth: Record<string, number> = {};
      const orcGanhosNaoMqlByMonth: Record<string, number> = {};
      const orcFatMqlByMonth: Record<string, number> = {};
      const orcFatNaoMqlByMonth: Record<string, number> = {};

      for (const row of (budgetsRows.rows as any[])) {
        const m = row.metricas || {};
        const mes = row.mes;
        const seg = row.segmento; // 'marketing', 'mql', 'nao-mql', 'total'
        if (seg === "marketing") {
          orcInvestByMonth[mes] = (orcInvestByMonth[mes] || 0) + (Number(m.investimento) || 0);
          orcLeadsByMonth[mes] = (orcLeadsByMonth[mes] || 0) + (Number(m.leads) || 0);
          orcMqlByMonth[mes] = (orcMqlByMonth[mes] || 0) + (Number(m.mqls) || 0);
        }
        if (seg === "mql") {
          orcRrMqlByMonth[mes] = (orcRrMqlByMonth[mes] || 0) + (Number(m.reunioesRealizadas) || 0);
          orcGanhosMqlByMonth[mes] = (orcGanhosMqlByMonth[mes] || 0) + (Number(m.novosClientes) || 0);
          orcFatMqlByMonth[mes] = (orcFatMqlByMonth[mes] || 0)
            + (Number(m.faturamentoAceleracao) || 0)
            + (Number(m.faturamentoImplantacao) || 0);
        }
        if (seg === "nao-mql") {
          orcRrNaoMqlByMonth[mes] = (orcRrNaoMqlByMonth[mes] || 0) + (Number(m.reunioesRealizadas) || 0);
          orcGanhosNaoMqlByMonth[mes] = (orcGanhosNaoMqlByMonth[mes] || 0) + (Number(m.novosClientes) || 0);
          orcFatNaoMqlByMonth[mes] = (orcFatNaoMqlByMonth[mes] || 0)
            + (Number(m.faturamentoAceleracao) || 0)
            + (Number(m.faturamentoImplantacao) || 0);
        }
      }

      // ---- Montar matriz de métricas ----
      const buildMetric = (
        id: string,
        name: string,
        format: MetricRow["format"],
        section: MetricRow["section"],
        realizadoByBucket: Record<string, number>,
        orcadoByBucket: Record<string, number> | null,
      ): MetricRow => {
        const values: MetricRow["values"] = {};
        for (const b of buckets) {
          values[b.key] = {
            realizado: realizadoByBucket[b.key] || 0,
            orcado: orcadoByBucket ? (orcadoByBucket[b.key] ?? null) : null,
          };
        }
        return { id, name, format, section, values };
      };

      // Investimento consolidado (Meta + Google)
      const investimentoRealizado: Record<string, number> = {};
      for (const b of buckets) {
        investimentoRealizado[b.key] = (metaInvest[b.key] || 0) + (googleAdsMonthly[b.key] || 0);
      }

      const metrics: MetricRow[] = [
        buildMetric("investimento", "Investimento", "currency", "marketing", investimentoRealizado, orcInvestByMonth),
        buildMetric("impressoes", "Impressões", "number", "marketing", metaImpr, null),
        buildMetric("cliques_saida", "Cliques de Saída", "number", "marketing", metaCliquesSaida, null),
        buildMetric("visualizacoes_pagina", "Visualizações de Página", "number", "marketing", metaViews, null),
        buildMetric("leads", "Leads", "number", "site", leadsByMonth, orcLeadsByMonth),
        buildMetric("mqls", "MQL", "number", "site", mqlsByMonth, orcMqlByMonth),
        buildMetric("rr_mql", "Reuniões Realizadas MQL", "number", "mql", rrMqlByMonth, orcRrMqlByMonth),
        buildMetric("ganhos_mql", "Nº Clientes Únicos MQL", "number", "mql", ganhosMqlByMonth, orcGanhosMqlByMonth),
        buildMetric("faturamento_mql", "Faturamento MQL", "currency", "mql", fatMqlByMonth, orcFatMqlByMonth),
        buildMetric("rr_nao_mql", "Reuniões Realizadas Não-MQL", "number", "nao-mql", rrNaoMqlByMonth, orcRrNaoMqlByMonth),
        buildMetric("ganhos_nao_mql", "Nº Clientes Únicos Não-MQL", "number", "nao-mql", ganhosNaoMqlByMonth, orcGanhosNaoMqlByMonth),
        buildMetric("faturamento_nao_mql", "Faturamento Não-MQL", "currency", "nao-mql", fatNaoMqlByMonth, orcFatNaoMqlByMonth),
      ];

      // Faturamento total (MQL + Não-MQL)
      const fatTotal: Record<string, number> = {};
      const orcFatTotal: Record<string, number> = {};
      for (const b of buckets) {
        fatTotal[b.key] = (fatMqlByMonth[b.key] || 0) + (fatNaoMqlByMonth[b.key] || 0);
        orcFatTotal[b.key] = (orcFatMqlByMonth[b.key] || 0) + (orcFatNaoMqlByMonth[b.key] || 0);
      }
      metrics.push(buildMetric("faturamento_total", "Faturamento Total", "currency", "total", fatTotal, orcFatTotal));

      res.json({ buckets, metrics });
    } catch (error) {
      console.error("[api] Error fetching timeseries:", error);
      res.status(500).json({ error: "Failed to fetch timeseries" });
    }
  });
}

import type { Express } from "express";
import { sql } from "drizzle-orm";
import { expandFunilValues, expandServicoValues } from "@shared/produtos";

const TURBO_PARTNERS_ACCOUNT_ID = "act_1331413260627780";
const TURBO_TIKTOK_ADVERTISER_IDS = ["7065303755092131842"];
// Mesmo motivo do array literal em growth.ts: Drizzle espalha array JS em params
// soltos dentro de sql`` → ANY($1) escalar → "malformed array literal". Montamos o
// ARRAY[...] explícito. Valores são constantes internas, sql.raw é seguro.
const TIKTOK_ADVERTISER_IDS_SQL = sql.raw(
  `ARRAY[${TURBO_TIKTOK_ADVERTISER_IDS.map((id) => `'${id}'`).join(",")}]`,
);

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

      // Produto por servicos_necessidade (Synapse, multivalor → ILIKE %v%); fnl_ngc
      // foi esvaziado na migração 2026-07. realFunilValues acima segue p/ o gasto (campanha).
      const realServicoValues = expandServicoValues(funilValues.filter((v) => v !== "(Vazio)"));
      let funilFilter = sql``;
      if (funilValues.length > 0) {
        const match = sql.join(realServicoValues.map((v) => sql`d.servicos_necessidade ILIKE ${"%" + v + "%"}`), sql` OR `);
        const vazio = sql`d.servicos_necessidade IS NULL OR d.servicos_necessidade = ''`;
        if (hasVazio && realServicoValues.length > 0) {
          funilFilter = sql`AND (${match} OR ${vazio})`;
        } else if (hasVazio) {
          funilFilter = sql`AND (${vazio})`;
        } else {
          funilFilter = sql`AND (${match})`;
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
      // Régua de MQL pós-migração Synapse: Creators usa a regra NATIVA do Synapse
      // (campo `mql`) a partir de 2026-07; os demais produtos e todo o histórico
      // seguem no legado `bx_lead_prequalificado`. O nativo só qualifica Creators.
      // Ver [[project_synapse_bitrix_growth_gap]].
      const mqlCond = sql`(CASE WHEN d.servicos_necessidade ILIKE '%Creators%' AND d.created_at >= '2026-07-01' THEN d.mql::text = '1' ELSE d.bx_lead_prequalificado::text = '1' END)`;
      const naoMqlCond = sql`NOT (CASE WHEN d.servicos_necessidade ILIKE '%Creators%' AND d.created_at >= '2026-07-01' THEN d.mql::text = '1' ELSE d.bx_lead_prequalificado::text = '1' END)`;

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

      // ---- TikTok + LinkedIn Ads (spend/impressões/cliques por mês) ----
      // Espelha o Orçado x Realizado /ads: atribui gasto por funil via nome da campanha
      // ([Funil]). Query resiliente (schema/permissão) — se falhar, mapa vazio.
      const buildCampaignNameFunnelFilter = (campaignsTable: ReturnType<typeof sql.raw>) => {
        if (realFunilValues.length > 0) {
          const conds = realFunilValues.map(
            (v) => sql`(c.campaign_name ILIKE ${"%[" + v + "]%"} OR c.campaign_name ILIKE ${"%" + v + "%"})`,
          );
          let nameFilter = sql.join(conds, sql` OR `);
          if (hasVazio) {
            nameFilter = sql`(${nameFilter} OR c.campaign_name NOT LIKE '%[%]%')`;
          }
          return sql`AND m.campaign_id IN (SELECT c.campaign_id FROM ${campaignsTable} c WHERE (${nameFilter}))`;
        }
        if (hasVazio) {
          return sql`AND m.campaign_id IN (SELECT c.campaign_id FROM ${campaignsTable} c WHERE c.campaign_name NOT LIKE '%[%]%')`;
        }
        return sql``;
      };

      const tiktokAdsMonthly: Record<string, { investimento: number; impressoes: number; cliques: number }> = {};
      try {
        const ttFilter = buildCampaignNameFunnelFilter(sql.raw("tiktok.ad_campaigns"));
        const ttRes = await db.execute(sql`
          SELECT to_char(m.stat_date, 'YYYY-MM') AS bucket,
            COALESCE(SUM(m.spend), 0)::numeric AS investimento,
            COALESCE(SUM(m.impressions), 0)::bigint AS impressoes,
            COALESCE(SUM(m.clicks), 0)::bigint AS cliques
          FROM tiktok.ad_metrics_daily m
          WHERE m.stat_date >= ${yearStart}::date AND m.stat_date <= ${yearEnd}::date
            AND m.advertiser_id = ANY(${TIKTOK_ADVERTISER_IDS_SQL})
            ${ttFilter}
          GROUP BY to_char(m.stat_date, 'YYYY-MM')
        `);
        for (const row of ttRes.rows as any[]) {
          tiktokAdsMonthly[row.bucket] = {
            investimento: parseFloat(row.investimento) || 0,
            impressoes: parseInt(row.impressoes) || 0,
            cliques: parseInt(row.cliques) || 0,
          };
        }
      } catch (err) {
        console.log("[timeseries] TikTok Ads query skipped:", (err as any)?.message || err);
      }

      const linkedinAdsMonthly: Record<string, { investimento: number; impressoes: number; cliques: number }> = {};
      try {
        const liFilter = buildCampaignNameFunnelFilter(sql.raw("linkedin.ad_campaigns"));
        const liRes = await db.execute(sql`
          SELECT to_char(m.stat_date, 'YYYY-MM') AS bucket,
            COALESCE(SUM(m.spend), 0)::numeric AS investimento,
            COALESCE(SUM(m.impressions), 0)::bigint AS impressoes,
            COALESCE(SUM(m.clicks), 0)::bigint AS cliques
          FROM linkedin.ad_metrics_daily m
          WHERE m.stat_date >= ${yearStart}::date AND m.stat_date <= ${yearEnd}::date
            ${liFilter}
          GROUP BY to_char(m.stat_date, 'YYYY-MM')
        `);
        for (const row of liRes.rows as any[]) {
          linkedinAdsMonthly[row.bucket] = {
            investimento: parseFloat(row.investimento) || 0,
            impressoes: parseInt(row.impressoes) || 0,
            cliques: parseInt(row.cliques) || 0,
          };
        }
      } catch (err) {
        console.log("[timeseries] LinkedIn Ads query skipped:", (err as any)?.message || err);
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

      // Investimento consolidado (Meta + Google + TikTok + LinkedIn) — alinhado com o
      // Orçado x Realizado /ads. Impressões e Cliques de Saída idem (soma dos canais pagos);
      // TikTok/LinkedIn não têm "outbound" separado, então o clique de anúncio (que leva à
      // LP) entra como equivalente, mesmo critério do consolidado do /ads.
      const investimentoRealizado: Record<string, number> = {};
      const impressoesRealizado: Record<string, number> = {};
      const cliquesSaidaRealizado: Record<string, number> = {};
      for (const b of buckets) {
        const tt = tiktokAdsMonthly[b.key];
        const li = linkedinAdsMonthly[b.key];
        investimentoRealizado[b.key] =
          (metaInvest[b.key] || 0) + (googleAdsMonthly[b.key] || 0) + (tt?.investimento || 0) + (li?.investimento || 0);
        impressoesRealizado[b.key] = (metaImpr[b.key] || 0) + (tt?.impressoes || 0) + (li?.impressoes || 0);
        cliquesSaidaRealizado[b.key] = (metaCliquesSaida[b.key] || 0) + (tt?.cliques || 0) + (li?.cliques || 0);
      }

      const metrics: MetricRow[] = [
        buildMetric("investimento", "Investimento", "currency", "marketing", investimentoRealizado, orcInvestByMonth),
        buildMetric("impressoes", "Impressões", "number", "marketing", impressoesRealizado, null),
        buildMetric("cliques_saida", "Cliques de Saída", "number", "marketing", cliquesSaidaRealizado, null),
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

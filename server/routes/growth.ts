import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import { format } from "date-fns";

// Account ID interno da Turbo Partners - usado para filtrar apenas dados internos
const TURBO_PARTNERS_ACCOUNT_ID = 'act_1331413260627780';

// Funnel name aliases: normalized name → all DB variations
const FUNNEL_ALIASES: Record<string, string[]> = {
  'ecommerce': ['Ecommerce', 'E-commerce', 'ecommerce'],
};

// Expand funnel values: if a normalized name has aliases, expand to all variants
function expandFunilValues(values: string[]): string[] {
  const expanded: string[] = [];
  for (const v of values) {
    const aliases = FUNNEL_ALIASES[v.toLowerCase()];
    if (aliases) {
      expanded.push(...aliases);
    } else {
      expanded.push(v);
    }
  }
  return expanded;
}

export function registerGrowthRoutes(app: Express, db: any, storage: IStorage) {
  // Ensure landing_page_views column exists
  db.execute(sql`ALTER TABLE meta_ads.meta_insights_daily ADD COLUMN IF NOT EXISTS landing_page_views INTEGER DEFAULT 0`)
    .catch(() => { /* column may already exist */ });

  // Ensure growth_budgets table exists with funil column
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS meta_ads.growth_budgets (
      id SERIAL PRIMARY KEY,
      mes VARCHAR(7) NOT NULL,
      segmento VARCHAR(20) NOT NULL,
      funil VARCHAR(100) NOT NULL DEFAULT 'todos',
      metricas JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(mes, segmento, funil)
    )
  `).then(() => {
    // Migration: add funil column if table already existed without it
    return db.execute(sql`ALTER TABLE meta_ads.growth_budgets ADD COLUMN IF NOT EXISTS funil VARCHAR(100) NOT NULL DEFAULT 'todos'`);
  }).then(() => {
    // Drop old constraint (may not exist) and ensure new one exists
    return db.execute(sql`ALTER TABLE meta_ads.growth_budgets DROP CONSTRAINT IF EXISTS growth_budgets_mes_segmento_key`);
  }).then(() => {
    return db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE meta_ads.growth_budgets ADD CONSTRAINT growth_budgets_mes_segmento_funil_key UNIQUE(mes, segmento, funil);
      EXCEPTION WHEN duplicate_table THEN
        -- constraint already exists, ignore
      END $$
    `);
  }).catch((err: any) => {
    console.log("[growth] growth_budgets migration note:", err?.message || err);
  });

  // Growth - Investment Data (Google Ads + Meta Ads)
  app.get("/api/growth/investimento", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-10-01';
      const endDate = req.query.endDate as string || '2025-11-30';
      const source = req.query.source as string || 'todos'; // todos, google, meta
      
      let googleTotal = { investimento: 0, impressions: 0, clicks: 0 };
      let metaTotal = { investimento: 0, impressions: 0, clicks: 0 };
      let googleDaily: any[] = [];
      let metaDaily: any[] = [];
      
      // Fetch Google Ads data if source is 'todos' or 'google'
      if (source === 'todos' || source === 'google') {
        try {
          // Check if google_ads schema exists
          const schemaCheck = await db.execute(sql`
            SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'google_ads'
          `);
          
          if (schemaCheck.rows.length > 0) {
            const columnsResult = await db.execute(sql`
              SELECT column_name FROM information_schema.columns 
              WHERE table_schema = 'google_ads' AND table_name = 'campaign_daily_metrics'
              ORDER BY ordinal_position
            `);
            
            const columns = columnsResult.rows.map((r: any) => r.column_name);
            console.log("[api] Google Ads columns:", columns);
            
            const dateColumn = columns.includes('report_date') ? 'report_date' :
                               columns.includes('metric_date') ? 'metric_date' : 
                               columns.includes('date') ? 'date' : 
                               columns.includes('segments_date') ? 'segments_date' : null;
            
            if (dateColumn && columns.includes('cost_micros')) {
              const googleResult = await db.execute(sql.raw(`
                SELECT 
                  COALESCE(SUM(cost_micros) / 1000000.0, 0) as total_investimento,
                  COALESCE(SUM(impressions), 0) as total_impressions,
                  COALESCE(SUM(clicks), 0) as total_clicks
                FROM google_ads.campaign_daily_metrics
                WHERE ${dateColumn} >= '${startDate}'::date AND ${dateColumn} <= '${endDate}'::date
              `));
              
              const googleDailyResult = await db.execute(sql.raw(`
                SELECT 
                  ${dateColumn} as date,
                  COALESCE(SUM(cost_micros) / 1000000.0, 0) as investimento,
                  COALESCE(SUM(impressions), 0) as impressions,
                  COALESCE(SUM(clicks), 0) as clicks
                FROM google_ads.campaign_daily_metrics
                WHERE ${dateColumn} >= '${startDate}'::date AND ${dateColumn} <= '${endDate}'::date
                GROUP BY ${dateColumn}
                ORDER BY ${dateColumn}
              `));
              
              const gTotals = googleResult.rows[0] || {};
              googleTotal = {
                investimento: parseFloat(gTotals.total_investimento as string) || 0,
                impressions: parseInt(gTotals.total_impressions as string) || 0,
                clicks: parseInt(gTotals.total_clicks as string) || 0
              };
              
              googleDaily = googleDailyResult.rows.map((row: any) => ({
                date: row.date,
                investimento: parseFloat(row.investimento) || 0,
                impressions: parseInt(row.impressions) || 0,
                clicks: parseInt(row.clicks) || 0,
                source: 'google'
              }));
            }
          }
        } catch (googleError) {
          console.log("[api] Google Ads query error (may not have data):", googleError);
        }
      }
      
      // Fetch Meta Ads data if source is 'todos' or 'meta'
      if (source === 'todos' || source === 'meta') {
        try {
          const metaResult = await db.execute(sql`
            SELECT 
              COALESCE(SUM(spend), 0) as total_investimento,
              COALESCE(SUM(impressions), 0) as total_impressions,
              COALESCE(SUM(clicks), 0) as total_clicks
            FROM meta_ads.meta_insights_daily
            WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
              AND account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
          `);
          
          const metaDailyResult = await db.execute(sql`
            SELECT 
              date_start as date,
              COALESCE(SUM(spend), 0) as investimento,
              COALESCE(SUM(impressions), 0) as impressions,
              COALESCE(SUM(clicks), 0) as clicks
            FROM meta_ads.meta_insights_daily
            WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
              AND account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
            GROUP BY date_start
            ORDER BY date_start
          `);
          
          const mTotals = metaResult.rows[0] || {};
          metaTotal = {
            investimento: parseFloat(mTotals.total_investimento as string) || 0,
            impressions: parseInt(mTotals.total_impressions as string) || 0,
            clicks: parseInt(mTotals.total_clicks as string) || 0
          };
          
          metaDaily = metaDailyResult.rows.map((row: any) => ({
            date: row.date,
            investimento: parseFloat(row.investimento) || 0,
            impressions: parseInt(row.impressions) || 0,
            clicks: parseInt(row.clicks) || 0,
            source: 'meta'
          }));
        } catch (metaError) {
          console.log("[api] Meta Ads query error:", metaError);
        }
      }
      
      // Combine totals
      const combinedTotal = {
        investimento: googleTotal.investimento + metaTotal.investimento,
        impressions: googleTotal.impressions + metaTotal.impressions,
        clicks: googleTotal.clicks + metaTotal.clicks
      };
      
      // Combine daily data by date
      const dailyMap = new Map<string, any>();
      
      [...googleDaily, ...metaDaily].forEach(item => {
        const dateKey = typeof item.date === 'string' ? item.date : format(new Date(item.date), 'yyyy-MM-dd');
        if (dailyMap.has(dateKey)) {
          const existing = dailyMap.get(dateKey);
          dailyMap.set(dateKey, {
            date: dateKey,
            investimento: existing.investimento + item.investimento,
            impressions: existing.impressions + item.impressions,
            clicks: existing.clicks + item.clicks,
            google: item.source === 'google' ? item.investimento : existing.google || 0,
            meta: item.source === 'meta' ? item.investimento : existing.meta || 0
          });
        } else {
          dailyMap.set(dateKey, {
            date: dateKey,
            investimento: item.investimento,
            impressions: item.impressions,
            clicks: item.clicks,
            google: item.source === 'google' ? item.investimento : 0,
            meta: item.source === 'meta' ? item.investimento : 0
          });
        }
      });
      
      const combinedDaily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      
      console.log("[api] Investment data - Google:", googleTotal.investimento, "Meta:", metaTotal.investimento, "Total:", combinedTotal.investimento);
      
      res.json({
        total: combinedTotal,
        bySource: {
          google: googleTotal,
          meta: metaTotal
        },
        daily: combinedDaily
      });
    } catch (error) {
      console.error("[api] Error fetching growth investimento:", error);
      res.status(500).json({ error: "Failed to fetch growth investimento" });
    }
  });

  // Growth Visão Geral - Cruza Meta/Google Ads com Bitrix (negócios ganhos via utm_content)
  app.get("/api/growth/visao-geral", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const canal = req.query.canal as string || 'Todos'; // Todos, Facebook, Google
      const tipoContrato = req.query.tipoContrato as string || 'Todos'; // Todos, Recorrente, Pontual
      
      // Validar formato de data para evitar SQL injection
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      let metaData: any[] = [];
      let googleData: any[] = [];
      
      // Buscar dados do Meta Ads se canal é Todos ou Facebook (apenas conta interna Turbo Partners)
      if (canal === 'Todos' || canal === 'Facebook') {
        const metaByAdResult = await db.execute(sql`
          SELECT 
            ad_id,
            SUM(spend::numeric) as investimento,
            SUM(impressions::numeric) as impressions,
            SUM(clicks::numeric) as clicks
          FROM meta_ads.meta_insights_daily
          WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
            AND account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
          GROUP BY ad_id
        `);
        metaData = metaByAdResult.rows as any[];
      }
      
      // Buscar dados do Google Ads se canal é Todos ou Google
      // Google Ads usa utm_campaign para relacionar com Bitrix (não utm_content)
      if (canal === 'Todos' || canal === 'Google') {
        try {
          const schemaCheck = await db.execute(sql`
            SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'google_ads'
          `);
          
          if (schemaCheck.rows.length > 0) {
            const tableCheck = await db.execute(sql`
              SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'google_ads' AND table_name = 'campaign_daily_metrics'
            `);
            
            if (tableCheck.rows.length > 0) {
              const columnsResult = await db.execute(sql`
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = 'google_ads' AND table_name = 'campaign_daily_metrics'
                ORDER BY ordinal_position
              `);
              
              const columns = columnsResult.rows.map((r: any) => r.column_name);
              const dateColumn = columns.includes('report_date') ? 'report_date' :
                                 columns.includes('metric_date') ? 'metric_date' : 
                                 columns.includes('date') ? 'date' : 
                                 columns.includes('segments_date') ? 'segments_date' : null;
              
              if (dateColumn && columns.includes('cost_micros')) {
                // JOIN with campaigns table to get campaign_id and name
                const googleResult = await db.execute(sql`
                  SELECT
                    c.campaign_id,
                    c.name as campaign_name,
                    COALESCE(SUM(m.cost_micros::numeric) / 1000000.0, 0) as investimento,
                    COALESCE(SUM(m.impressions::numeric), 0) as impressions,
                    COALESCE(SUM(m.clicks::numeric), 0) as clicks
                  FROM google_ads.campaign_daily_metrics m
                  JOIN google_ads.campaigns c ON m.campaign_key = c.campaign_key
                  WHERE m.${sql.raw(dateColumn)} >= ${startDate}::date AND m.${sql.raw(dateColumn)} <= ${endDate}::date
                  GROUP BY c.campaign_id, c.name
                `);
                googleData = googleResult.rows as any[];
              }
            }
          }
        } catch (googleError) {
          console.log("[api] Google Ads query error (may not have data):", googleError);
        }
      }
      
      // Buscar negócios ganhos do Bitrix com utm_content e utm_campaign
      // utm_content é usado para Meta Ads, utm_campaign pode ser usado para Google Ads
      // Filtro por tipo de contrato: Recorrente (valor_recorrente > 0), Pontual (valor_pontual > 0)
      const tipoContratoFilter = tipoContrato === 'Recorrente' 
        ? sql`AND COALESCE(valor_recorrente, 0) > 0`
        : tipoContrato === 'Pontual'
        ? sql`AND COALESCE(valor_pontual, 0) > 0`
        : sql``;
      
      const dealsResult = await db.execute(sql`
        SELECT 
          utm_content,
          utm_campaign,
          utm_source,
          COUNT(DISTINCT id) as negocios_ganhos,
          SUM(COALESCE(valor_pontual, 0)) as valor_pontual_total,
          SUM(COALESCE(valor_recorrente, 0)) as valor_recorrente_total,
          SUM(COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)) as valor_total
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
          AND (utm_content IS NOT NULL AND utm_content != '' OR utm_campaign IS NOT NULL AND utm_campaign != '')
          ${tipoContratoFilter}
        GROUP BY utm_content, utm_campaign, utm_source
      `);
      
      // Criar mapas de deals: um por utm_content (Meta) e outro por utm_campaign (Google)
      const dealsMapByContent = new Map<string, any>();
      const dealsMapByCampaign = new Map<string, any>();
      
      for (const row of dealsResult.rows as any[]) {
        const dealData = {
          negociosGanhos: parseInt(row.negocios_ganhos) || 0,
          valorPontual: parseFloat(row.valor_pontual_total) || 0,
          valorRecorrente: parseFloat(row.valor_recorrente_total) || 0,
          valorTotal: parseFloat(row.valor_total) || 0,
          source: row.utm_source
        };
        
        // Map por utm_content (para Meta Ads)
        if (row.utm_content) {
          const key = row.utm_content;
          if (dealsMapByContent.has(key)) {
            const existing = dealsMapByContent.get(key);
            existing.negociosGanhos += dealData.negociosGanhos;
            existing.valorPontual += dealData.valorPontual;
            existing.valorRecorrente += dealData.valorRecorrente;
            existing.valorTotal += dealData.valorTotal;
          } else {
            dealsMapByContent.set(key, { ...dealData });
          }
        }
        
        // Map por utm_campaign (para Google Ads)
        if (row.utm_campaign) {
          const key = row.utm_campaign;
          if (dealsMapByCampaign.has(key)) {
            const existing = dealsMapByCampaign.get(key);
            existing.negociosGanhos += dealData.negociosGanhos;
            existing.valorPontual += dealData.valorPontual;
            existing.valorRecorrente += dealData.valorRecorrente;
            existing.valorTotal += dealData.valorTotal;
          } else {
            dealsMapByCampaign.set(key, { ...dealData });
          }
        }
      }
      
      // Agregar dados combinando Ads com Deals
      let totalInvestimento = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalNegociosGanhos = 0;
      let totalValorPontual = 0;
      let totalValorRecorrente = 0;
      let totalValorVendas = 0;
      
      const adPerformance: any[] = [];
      
      // Processar Meta Ads (usa dealsMapByContent com utm_content = ad_id)
      for (const row of metaData) {
        const adId = row.ad_id;
        const investimento = parseFloat(row.investimento) || 0;
        const impressions = parseInt(row.impressions) || 0;
        const clicks = parseInt(row.clicks) || 0;
        
        const deal = dealsMapByContent.get(adId) || { negociosGanhos: 0, valorPontual: 0, valorRecorrente: 0, valorTotal: 0 };
        
        totalInvestimento += investimento;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalNegociosGanhos += deal.negociosGanhos;
        totalValorPontual += deal.valorPontual;
        totalValorRecorrente += deal.valorRecorrente;
        totalValorVendas += deal.valorTotal;
        
        adPerformance.push({
          adId,
          source: 'Meta',
          investimento,
          impressions,
          clicks,
          negociosGanhos: deal.negociosGanhos,
          valorVendas: deal.valorTotal,
          cac: deal.negociosGanhos > 0 ? investimento / deal.negociosGanhos : null,
          roi: investimento > 0 ? ((deal.valorTotal - investimento) / investimento) * 100 : null
        });
      }
      
      // Processar Google Ads (usa dealsMapByCampaign com utm_campaign = campaign_name)
      for (const row of googleData) {
        const campaignId = row.campaign_id;
        const campaignName = row.campaign_name;
        const investimento = parseFloat(row.investimento) || 0;
        const impressions = parseInt(row.impressions) || 0;
        const clicks = parseInt(row.clicks) || 0;
        
        // Tentar fazer match via campaign_name ou campaign_id com utm_campaign
        const deal = dealsMapByCampaign.get(campaignName) || 
                     dealsMapByCampaign.get(campaignId) || 
                     { negociosGanhos: 0, valorPontual: 0, valorRecorrente: 0, valorTotal: 0 };
        
        totalInvestimento += investimento;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalNegociosGanhos += deal.negociosGanhos;
        totalValorPontual += deal.valorPontual;
        totalValorRecorrente += deal.valorRecorrente;
        totalValorVendas += deal.valorTotal;
        
        adPerformance.push({
          adId: `google_${campaignId}`,
          name: campaignName,
          source: 'Google',
          investimento,
          impressions,
          clicks,
          negociosGanhos: deal.negociosGanhos,
          valorVendas: deal.valorTotal,
          cac: deal.negociosGanhos > 0 ? investimento / deal.negociosGanhos : null,
          roi: investimento > 0 ? ((deal.valorTotal - investimento) / investimento) * 100 : null
        });
      }
      
      // Construir filtro de canal para utm_source (para queries de totais)
      const canalFilterForDeals = canal === 'Facebook' 
        ? sql`AND (LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%' OR LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%')`
        : canal === 'Google'
        ? sql`AND (LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads' OR LOWER(utm_source) LIKE '%ads%')`
        : sql``;
      
      // Buscar totais gerais de deals (filtrado por canal se necessário)
      const totalDealsResult = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT id) as total_negocios,
          SUM(COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)) as valor_total
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
          ${canalFilterForDeals}
      `);
      
      const totalDeals = totalDealsResult.rows[0] as any || {};
      const negociosTotaisReal = parseInt(totalDeals.total_negocios) || 0;
      const valorTotalReal = parseFloat(totalDeals.valor_total) || 0;
      
      // Calcular métricas gerais usando vendas atribuídas a ads (não todas as vendas)
      // ROI deve usar apenas vendas atribuídas via utm_content/utm_campaign aos anúncios
      const cac = totalNegociosGanhos > 0 ? totalInvestimento / totalNegociosGanhos : null;
      const roi = totalInvestimento > 0 ? ((totalValorVendas - totalInvestimento) / totalInvestimento) * 100 : null;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? totalInvestimento / totalClicks : null;
      
      // Buscar evolução diária de negócios ganhos (filtrado por canal se necessário)
      const dailyDealsResult = await db.execute(sql`
        SELECT 
          DATE(data_fechamento) as data,
          COUNT(DISTINCT id) as negocios,
          SUM(COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)) as valor
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
          ${canalFilterForDeals}
        GROUP BY DATE(data_fechamento)
        ORDER BY DATE(data_fechamento)
      `);
      
      const dailyDeals = (dailyDealsResult.rows as any[]).map(row => ({
        data: row.data,
        negocios: parseInt(row.negocios) || 0,
        valor: parseFloat(row.valor) || 0
      }));
      
      console.log("[api] Growth Visão Geral - Canal:", canal, "Investimento:", totalInvestimento, "Negócios:", totalNegociosGanhos, "Valor:", totalValorVendas);
      
      // Buscar MQLs por canal por dia usando utm_source e coluna mql (coluna é text, comparar com '1')
      const mqlPorCanalDiaResult = await db.execute(sql`
        SELECT 
          DATE(created_at) as data,
          COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros') as canal,
          COUNT(*) as leads,
          SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls
        FROM "Bitrix".crm_deal
        WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
        GROUP BY DATE(created_at), COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros')
        ORDER BY DATE(created_at), canal
      `);
      
      // Organizar dados por dia com breakdown por canal
      const mqlPorDia: Record<string, { data: string; canais: Record<string, { leads: number; mqls: number }> }> = {};
      
      for (const row of mqlPorCanalDiaResult.rows as any[]) {
        const dataStr = row.data?.toISOString?.().split('T')[0] || String(row.data);
        if (!mqlPorDia[dataStr]) {
          mqlPorDia[dataStr] = { data: dataStr, canais: {} };
        }
        const canalNome = String(row.canal || 'Outros');
        mqlPorDia[dataStr].canais[canalNome] = {
          leads: parseInt(row.leads) || 0,
          mqls: parseInt(row.mqls) || 0
        };
      }
      
      const mqlDiario = Object.values(mqlPorDia).sort((a, b) => a.data.localeCompare(b.data));
      
      // Construir filtro de canal para utm_source
      // Facebook: inclui variações como 'facebook', 'fb', 'meta', 'Facebook Ads', etc.
      // Google: inclui variações como 'google', 'Google', 'adwords', etc.
      const canalFilterSQL = canal === 'Facebook' 
        ? sql`AND (LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%' OR LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%')`
        : canal === 'Google'
        ? sql`AND (LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads' OR LOWER(utm_source) LIKE '%ads%')`
        : sql``;
      
      // Buscar investimento por canal (via utm_content = ad_id)
      const investimentoPorCanalResult = await db.execute(sql`
        SELECT 
          COALESCE(NULLIF(TRIM(d.utm_source), ''), 'Outros') as canal,
          SUM(i.spend::numeric) as investimento
        FROM meta_ads.meta_insights_daily i
        INNER JOIN "Bitrix".crm_deal d ON i.ad_id = d.utm_content
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
          AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
          ${canalFilterSQL}
        GROUP BY COALESCE(NULLIF(TRIM(d.utm_source), ''), 'Outros')
      `);
      
      const investimentoPorCanal: Record<string, number> = {};
      for (const row of investimentoPorCanalResult.rows as any[]) {
        investimentoPorCanal[String(row.canal)] = parseFloat(row.investimento) || 0;
      }
      
      console.log("[api] Investimento por canal encontrado:", JSON.stringify(investimentoPorCanal));
      console.log("[api] Total investimento disponível:", totalInvestimento);
      
      // Buscar totais de MQL/Leads por canal para o funil (coluna mql é text) com RM/RR stages
      // Vendas MQL são filtradas por data_fechamento E mql = '1'
      // RM e RR contam deals que PASSARAM por esses estágios (incluindo os que já fecharam)
      const mqlTotaisPorCanalResult = await db.execute(sql`
        WITH leads_mqls AS (
          SELECT 
            COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros') as canal,
            COUNT(*) as leads,
            SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls
          FROM "Bitrix".crm_deal
          WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
            ${canalFilterSQL}
          GROUP BY COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros')
        ),
        rm_rr_counts AS (
          SELECT 
            COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros') as canal,
            SUM(CASE WHEN stage_name IN ('Reunião Marcada', 'RM', 'Agendado', 'Reunião Realizada', 'RR', 'Realizado', 'Negócio Ganho') 
                     AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rm,
            SUM(CASE WHEN stage_name IN ('Reunião Realizada', 'RR', 'Realizado', 'Negócio Ganho') 
                     AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rr
          FROM "Bitrix".crm_deal
          WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
            ${canalFilterSQL}
          GROUP BY COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros')
        ),
        vendas_mql AS (
          SELECT 
            COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros') as canal,
            COUNT(DISTINCT id) as vendas,
            SUM(COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)) as valor_vendas
          FROM "Bitrix".crm_deal
          WHERE stage_name = 'Negócio Ganho'
            AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
            AND (mql::text = '1' OR LOWER(mql::text) = 'true')
            ${canalFilterSQL}
          GROUP BY COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros')
        )
        SELECT 
          COALESCE(lm.canal, COALESCE(rr.canal, v.canal)) as canal,
          COALESCE(lm.leads, 0) as leads,
          COALESCE(lm.mqls, 0) as mqls,
          COALESCE(rr.rm, 0) as rm,
          COALESCE(rr.rr, 0) as rr,
          COALESCE(v.vendas, 0) as vendas,
          COALESCE(v.valor_vendas, 0) as valor_vendas
        FROM leads_mqls lm
        FULL OUTER JOIN rm_rr_counts rr ON lm.canal = rr.canal
        FULL OUTER JOIN vendas_mql v ON COALESCE(lm.canal, rr.canal) = v.canal
        ORDER BY COALESCE(lm.mqls, 0) DESC
      `);
      
      // Primeiro, calcular totais para distribuir proporcionalmente se necessário
      const tempMqlData = (mqlTotaisPorCanalResult.rows as any[]).map(row => ({
        canal: String(row.canal || 'Outros'),
        leads: parseInt(row.leads) || 0,
        mqls: parseInt(row.mqls) || 0,
        rm: parseInt(row.rm) || 0,
        rr: parseInt(row.rr) || 0,
        vendas: parseInt(row.vendas) || 0,
        valorVendas: parseFloat(row.valor_vendas) || 0
      }));
      
      const totalMqlsForProportion = tempMqlData.reduce((sum, c) => sum + c.mqls, 0);
      const totalLeadsForProportion = tempMqlData.reduce((sum, c) => sum + c.leads, 0);
      
      // Verificar se temos investimento por canal via join, senão usar proporção do total
      const hasInvestimentoPorCanal = Object.keys(investimentoPorCanal).length > 0;
      console.log("[api] Usando investimento por canal via join:", hasInvestimentoPorCanal);
      
      const mqlPorCanal = tempMqlData.map(row => {
        const canalNome = row.canal;
        const leads = row.leads;
        const mqls = row.mqls;
        const rm = row.rm;
        const rr = row.rr;
        const vendas = row.vendas;
        const valorVendas = row.valorVendas;
        
        // Se temos investimento por canal específico, usar. Senão, distribuir proporcionalmente.
        let investimentoCanal = investimentoPorCanal[canalNome] || 0;
        if (!hasInvestimentoPorCanal && totalMqlsForProportion > 0 && mqls > 0) {
          // Distribuir investimento total proporcionalmente aos MQLs do canal
          investimentoCanal = (mqls / totalMqlsForProportion) * totalInvestimento;
        }
        
        return {
          canal: canalNome,
          leads,
          mqls,
          rm,
          rr,
          vendas,
          valorVendas,
          investimento: investimentoCanal,
          cpl: leads > 0 && investimentoCanal > 0 ? Math.round(investimentoCanal / leads) : null,
          cpmql: mqls > 0 && investimentoCanal > 0 ? Math.round(investimentoCanal / mqls) : null,
          leadMql: leads > 0 ? Math.round((mqls / leads) * 100) : 0,
          mqlRm: mqls > 0 ? Math.round((rm / mqls) * 100) : 0,
          mqlRr: mqls > 0 ? Math.round((rr / mqls) * 100) : 0,
          txRrVenda: rr > 0 ? Math.round((vendas / rr) * 100) : 0,
          mqlVenda: mqls > 0 ? Math.round((vendas / mqls) * 100) : 0,
          tm: vendas > 0 ? Math.round(valorVendas / vendas) : 0
        };
      });
      
      // Calcular totais gerais de MQL
      const totalLeads = mqlPorCanal.reduce((sum, c) => sum + c.leads, 0);
      const totalMQLs = mqlPorCanal.reduce((sum, c) => sum + c.mqls, 0);
      const totalVendasMQL = mqlPorCanal.reduce((sum, c) => sum + c.vendas, 0);
      
      res.json({
        resumo: {
          investimento: totalInvestimento,
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr,
          cpc,
          negociosGanhos: totalNegociosGanhos,
          negociosTotais: parseInt(totalDeals.total_negocios) || 0,
          valorPontual: totalValorPontual,
          valorRecorrente: totalValorRecorrente,
          valorVendas: totalValorVendas,
          valorTotalGeral: parseFloat(totalDeals.valor_total) || 0,
          cac,
          roi,
          totalLeads,
          totalMQLs,
          totalVendasMQL,
          taxaConversaoMQL: totalLeads > 0 ? (totalMQLs / totalLeads) * 100 : 0,
          taxaVendaMQL: totalMQLs > 0 ? (totalVendasMQL / totalMQLs) * 100 : 0
        },
        porAd: adPerformance.sort((a, b) => b.investimento - a.investimento).slice(0, 20),
        evolucaoDiaria: dailyDeals,
        mqlDiario,
        mqlPorCanal
      });
    } catch (error) {
      console.error("[api] Error fetching growth visao geral:", error);
      res.status(500).json({ error: "Failed to fetch growth visao geral" });
    }
  });

  // Endpoint para buscar leads por canal (para o toggle de expansão)
  app.get("/api/growth/leads-por-canal", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const canal = req.query.canal as string;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Validar formato de data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      if (!canal) {
        return res.status(400).json({ error: "Canal parameter is required" });
      }
      
      // Construir filtro de canal para utm_source
      const canalFilterSQL = canal.toLowerCase() === 'facebook' 
        ? sql`AND (LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%')`
        : canal.toLowerCase() === 'instagram'
        ? sql`AND (LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%')`
        : canal.toLowerCase() === 'google'
        ? sql`AND (LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads')`
        : canal.toLowerCase() === 'outros'
        ? sql`AND (utm_source IS NULL OR TRIM(utm_source) = '' OR (
            LOWER(utm_source) NOT LIKE '%facebook%' AND 
            LOWER(utm_source) NOT LIKE '%fb%' AND 
            LOWER(utm_source) NOT LIKE '%meta%' AND
            LOWER(utm_source) NOT LIKE '%instagram%' AND
            LOWER(utm_source) != 'ig' AND
            LOWER(utm_source) NOT LIKE '%google%' AND 
            LOWER(utm_source) NOT LIKE '%adwords%' AND
            LOWER(utm_source) NOT LIKE '%linkedin%' AND
            LOWER(utm_source) NOT LIKE '%organico%' AND
            LOWER(utm_source) NOT LIKE '%orgânico%'
          ))`
        : sql`AND LOWER(utm_source) LIKE ${`%${canal.toLowerCase()}%`}`;
      
      const result = await db.execute(sql`
        SELECT 
          id,
          title,
          company_name,
          utm_source,
          utm_campaign,
          utm_content,
          stage_name,
          mql::text as mql,
          created_at,
          data_fechamento,
          COALESCE(valor_pontual, 0) as valor_pontual,
          COALESCE(valor_recorrente, 0) as valor_recorrente,
          COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) as valor_total
        FROM "Bitrix".crm_deal
        WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
          ${canalFilterSQL}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      
      const leads = (result.rows as any[]).map(row => ({
        id: row.id,
        title: row.title,
        company: row.company_name,
        utmSource: row.utm_source,
        utmMedium: null,
        utmCampaign: row.utm_campaign,
        utmContent: row.utm_content,
        stage: row.stage_name,
        isMql: row.mql === '1' || row.mql?.toLowerCase() === 'true',
        createdAt: row.created_at,
        closedAt: row.data_fechamento,
        valorPontual: parseFloat(row.valor_pontual) || 0,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        valorTotal: parseFloat(row.valor_total) || 0
      }));
      
      res.json(leads);
    } catch (error) {
      console.error("[api] Error fetching leads por canal:", error);
      res.status(500).json({ error: "Failed to fetch leads por canal" });
    }
  });

  // Growth - Criativos - Listar campanhas disponíveis
  app.get("/api/growth/criativos/campanhas", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '';
      const endDate = req.query.endDate as string || '';

      // Se datas fornecidas, filtrar por campanhas com gasto no período
      if (startDate && endDate) {
        const result = await db.execute(sql`
          SELECT c.campaign_id, c.campaign_name
          FROM meta_ads.meta_campaigns c
          INNER JOIN meta_ads.meta_insights_daily i ON c.campaign_id = i.campaign_id
          WHERE c.campaign_name IS NOT NULL AND c.campaign_name != ''
            AND c.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
            AND i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
          GROUP BY c.campaign_id, c.campaign_name
          HAVING SUM(i.spend::numeric) > 0
          ORDER BY c.campaign_name
        `);
        const campanhas = (result.rows as any[]).map(row => ({
          id: row.campaign_id,
          name: row.campaign_name
        }));
        return res.json(campanhas);
      }

      // Fallback: todas as campanhas
      const result = await db.execute(sql`
        SELECT DISTINCT c.campaign_id, c.campaign_name
        FROM meta_ads.meta_campaigns c
        WHERE c.campaign_name IS NOT NULL AND c.campaign_name != ''
          AND c.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        ORDER BY c.campaign_name
      `);
      const campanhas = (result.rows as any[]).map(row => ({
        id: row.campaign_id,
        name: row.campaign_name
      }));
      res.json(campanhas);
    } catch (error) {
      console.error("[api] Error fetching campanhas:", error);
      res.status(500).json({ error: "Failed to fetch campanhas" });
    }
  });
  
  // Growth - Criativos (dados agregados por anúncio do Meta Ads)
  app.get("/api/growth/criativos", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const status = req.query.status as string || 'Todos'; // Todos, Ativo, Pausado
      const plataforma = req.query.plataforma as string || 'Todos'; // Todos, Meta Ads, Google Ads, LinkedIn Ads
      const campanhaId = req.query.campanhaId as string || ''; // campaign_id filter
      const campanhaIds = req.query.campanhaIds as string || ''; // comma-separated campaign_ids (produto filter)
      const campanhaIdSet = campanhaIds ? new Set(campanhaIds.split(',')) : null;
      
      // Validar formato de data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Por enquanto só temos dados do Meta Ads
      // Se plataforma for Google Ads ou LinkedIn Ads, retornar array vazio
      if (plataforma === 'Google Ads' || plataforma === 'LinkedIn Ads') {
        console.log("[api] Growth Criativos - Plataforma:", plataforma, "- sem dados disponíveis");
        return res.json([]);
      }
      
      // Buscar dados agregados por anúncio do Meta Ads com info do anúncio e campanha (apenas conta interna Turbo Partners)
      const adsDataResult = await db.execute(sql`
        SELECT
          i.ad_id,
          a.ad_name,
          a.status as ad_status,
          a.created_time,
          a.preview_shareable_link as link,
          a.campaign_id,
          c.campaign_name,
          SUM(i.spend::numeric) as investimento,
          SUM(i.impressions) as impressions,
          SUM(i.clicks) as clicks,
          SUM(i.reach) as reach,
          COALESCE(SUM(i.outbound_clicks), 0) as outbound_clicks,
          AVG(i.cpm::numeric) as cpm,
          SUM(i.video_play_actions) as video_plays,
          SUM(i.video_p25_watched_actions) as video_p25,
          SUM(i.video_p50_watched_actions) as video_p50,
          SUM(i.video_p75_watched_actions) as video_p75,
          SUM(i.video_p100_watched_actions) as video_p100,
          COALESCE(SUM(i.landing_page_views), 0) as landing_page_views
        FROM meta_ads.meta_insights_daily i
        LEFT JOIN meta_ads.meta_ads a ON i.ad_id = a.ad_id
        LEFT JOIN meta_ads.meta_campaigns c ON a.campaign_id = c.campaign_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
          AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        GROUP BY i.ad_id, a.ad_name, a.status, a.created_time, a.preview_shareable_link, a.campaign_id, c.campaign_name
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados de conversão do CRM (leads, MQL, NMQL, RM, RR, Vendas com splits) usando utm_content = ad_id
      const dealsDataResult = await db.execute(sql`
        SELECT
          utm_content as ad_id,
          COUNT(*) as leads,
          SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN NOT (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as nmqls,
          SUM(CASE WHEN LOWER(stage_name) IN (
              'reunião marcada', 'rm', 'rm - reunião marcada', 'agendado', 'reunião agendada', 'agendamento direto',
              'reunião realizada', 'rr - reunião realizada', 'rr', 'realizado',
              'confecção de proposta', 'em negociação', 'aguardado os dados',
              'aguardando assinatura', 'subir/ajustar cobrança',
              'proposta enviada', 'negócio ganho', 'negócio perdido'
              ) THEN 1 ELSE 0 END) as rm,
          SUM(CASE WHEN LOWER(stage_name) IN (
              'reunião marcada', 'rm', 'rm - reunião marcada', 'agendado', 'reunião agendada', 'agendamento direto',
              'reunião realizada', 'rr - reunião realizada', 'rr', 'realizado',
              'confecção de proposta', 'em negociação', 'aguardado os dados',
              'aguardando assinatura', 'subir/ajustar cobrança',
              'proposta enviada', 'negócio ganho', 'negócio perdido'
              ) AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rm_mql,
          SUM(CASE WHEN LOWER(stage_name) IN (
              'reunião marcada', 'rm', 'rm - reunião marcada', 'agendado', 'reunião agendada', 'agendamento direto',
              'reunião realizada', 'rr - reunião realizada', 'rr', 'realizado',
              'confecção de proposta', 'em negociação', 'aguardado os dados',
              'aguardando assinatura', 'subir/ajustar cobrança',
              'proposta enviada', 'negócio ganho', 'negócio perdido'
              ) AND NOT (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rm_nmql,
          SUM(CASE WHEN LOWER(stage_name) IN (
              'reunião realizada', 'rr - reunião realizada', 'rr', 'realizado',
              'confecção de proposta', 'em negociação', 'aguardado os dados',
              'aguardando assinatura', 'subir/ajustar cobrança',
              'proposta enviada', 'negócio ganho', 'negócio perdido'
              ) THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN LOWER(stage_name) IN (
              'reunião realizada', 'rr - reunião realizada', 'rr', 'realizado',
              'confecção de proposta', 'em negociação', 'aguardado os dados',
              'aguardando assinatura', 'subir/ajustar cobrança',
              'proposta enviada', 'negócio ganho', 'negócio perdido'
              ) AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rr_mql,
          SUM(CASE WHEN LOWER(stage_name) IN (
              'reunião realizada', 'rr - reunião realizada', 'rr', 'realizado',
              'confecção de proposta', 'em negociação', 'aguardado os dados',
              'aguardando assinatura', 'subir/ajustar cobrança',
              'proposta enviada', 'negócio ganho', 'negócio perdido'
              ) AND NOT (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rr_nmql,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as vendas,
          SUM(CASE WHEN stage_name = 'Negócio Ganho'
              AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as vendas_mql,
          SUM(CASE WHEN stage_name = 'Negócio Ganho'
              AND NOT (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as vendas_nmql,
          COUNT(DISTINCT CASE WHEN stage_name = 'Negócio Ganho'
              THEN COALESCE(company_name, contact_name, title) END) as clientes_unicos,
          NULL::numeric as min_lead_time,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) ELSE 0 END) as valor_pontual,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_recorrente, 0) ELSE 0 END) as valor_recorrente,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN
            CASE WHEN produtos IS NULL OR produtos = '' OR produtos = '[]' THEN 1
            ELSE COALESCE(array_length(string_to_array(REPLACE(REPLACE(produtos, '[', ''), ']', ''), ','), 1), 1) END
          ELSE 0 END) as contratos
        FROM "Bitrix".crm_deal
        WHERE utm_content IS NOT NULL
          AND utm_content != ''
          AND created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
        GROUP BY utm_content
      `);
      
      // Criar mapa de deals por ad_id
      const dealsMap = new Map<string, any>();
      for (const row of dealsDataResult.rows as any[]) {
        dealsMap.set(row.ad_id, {
          leads: parseInt(row.leads) || 0,
          mqls: parseInt(row.mqls) || 0,
          nmqls: parseInt(row.nmqls) || 0,
          rm: parseInt(row.rm) || 0,
          rmMql: parseInt(row.rm_mql) || 0,
          rmNmql: parseInt(row.rm_nmql) || 0,
          rr: parseInt(row.rr) || 0,
          rrMql: parseInt(row.rr_mql) || 0,
          rrNmql: parseInt(row.rr_nmql) || 0,
          vendas: parseInt(row.vendas) || 0,
          vendasMql: parseInt(row.vendas_mql) || 0,
          vendasNmql: parseInt(row.vendas_nmql) || 0,
          clientesUnicos: parseInt(row.clientes_unicos) || 0,
          minLeadTime: parseFloat(row.min_lead_time) || null,
          valorPontual: parseFloat(row.valor_pontual) || 0,
          valorRecorrente: parseFloat(row.valor_recorrente) || 0,
          contratos: parseInt(row.contratos) || 0,
        });
      }
      
      // Lead time por cliente único: primeiro deal fechado de cada empresa, por ad_id
      // Filtra por data_fechamento (não created_at) para capturar deals criados antes do período mas fechados dentro dele
      const leadTimeResult = await db.execute(sql`
        SELECT utm_content as ad_id,
          AVG(lead_time_days) as avg_lead_time
        FROM (
          SELECT utm_content,
            COALESCE(company_name, contact_name, title) as cliente,
            MIN(EXTRACT(EPOCH FROM (data_fechamento::timestamp - date_create)) / 86400) as lead_time_days
          FROM "Bitrix".crm_deal
          WHERE utm_content IS NOT NULL AND utm_content != ''
            AND stage_name = 'Negócio Ganho'
            AND data_fechamento IS NOT NULL
            AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
          GROUP BY utm_content, COALESCE(company_name, contact_name, title)
        ) sub
        GROUP BY utm_content
      `);
      const leadTimeMap = new Map<string, number>();
      for (const row of leadTimeResult.rows as any[]) {
        if (row.avg_lead_time) leadTimeMap.set(row.ad_id, parseFloat(row.avg_lead_time));
      }

      // Combinar dados de ads com deals
      const criativos = (adsDataResult.rows as any[])
        .map(row => {
          const adId = row.ad_id;
          const investimento = parseFloat(row.investimento) || 0;
          const impressions = parseInt(row.impressions) || 0;
          const clicks = parseInt(row.clicks) || 0;
          const reach = parseInt(row.reach) || 0;
          const videoP25 = parseInt(row.video_p25) || 0;
          const videoP75 = parseInt(row.video_p75) || 0;
          const landingPageViews = parseInt(row.landing_page_views) || 0;

          const outboundClicks = parseInt(row.outbound_clicks) || 0;
          // CTR de saída = outbound_clicks / impressions
          const ctr = impressions > 0 && outboundClicks > 0 ? (outboundClicks / impressions) * 100 : null;
          const cpm = parseFloat(row.cpm) || (impressions > 0 ? (investimento / impressions) * 1000 : null);

          // Vídeo Hook = % de visualizações que passaram 3s (p25 / impressions)
          const videoHook = impressions > 0 && videoP25 > 0 ? (videoP25 / impressions) * 100 : null;
          // Vídeo HOLD = % de quem passou 3s que viu 75% (p75 / p25)
          const videoHold = videoP25 > 0 && videoP75 > 0 ? (videoP75 / videoP25) * 100 : null;
          // Connect rate = landing_page_views / outbound_clicks
          const connectRate = outboundClicks > 0 && landingPageViews > 0 ? (landingPageViews / outboundClicks) * 100 : null;

          const deal = dealsMap.get(adId) || { leads: 0, mqls: 0, nmqls: 0, rm: 0, rmMql: 0, rmNmql: 0, rr: 0, rrMql: 0, rrNmql: 0, vendas: 0, vendasMql: 0, vendasNmql: 0, clientesUnicos: 0, minLeadTime: null, valorPontual: 0, valorRecorrente: 0 };

          const leads = deal.leads;
          const mqls = deal.mqls;
          const nmqls = deal.nmqls;
          const rm = deal.rm;
          const rmMql = deal.rmMql;
          const rmNmql = deal.rmNmql;
          const rr = deal.rr;
          const rrMql = deal.rrMql;
          const rrNmql = deal.rrNmql;
          const vendas = deal.vendas;
          const vendasMql = deal.vendasMql;
          const vendasNmql = deal.vendasNmql;
          const clientesUnicos = deal.clientesUnicos;

          // Taxa de conversão = leads / landing_page_views
          const taxaConversao = landingPageViews > 0 && leads > 0 ? (leads / landingPageViews) * 100 : null;

          // Métricas derivadas
          const cpl = leads > 0 ? investimento / leads : null;
          const percMql = leads > 0 ? parseFloat(((mqls / leads) * 100).toFixed(1)) : null;
          const cpmql = mqls > 0 ? investimento / mqls : null;
          const percRa = leads > 0 ? parseFloat(((rm / leads) * 100).toFixed(1)) : null;
          const percRaMql = mqls > 0 ? parseFloat(((rmMql / mqls) * 100).toFixed(1)) : null;
          const percRaNmql = nmqls > 0 ? parseFloat(((rmNmql / nmqls) * 100).toFixed(1)) : null;
          const percRr = rm > 0 ? parseFloat(((rr / rm) * 100).toFixed(1)) : null;
          const percRrMql = mqls > 0 ? parseFloat(((rrMql / mqls) * 100).toFixed(1)) : null;
          const percRrNmql = nmqls > 0 ? parseFloat(((rrNmql / nmqls) * 100).toFixed(1)) : null;
          const percRrVendas = rr > 0 ? parseFloat(((vendas / rr) * 100).toFixed(1)) : null;
          const percRrMqlVendas = rrMql > 0 ? parseFloat(((vendasMql / rrMql) * 100).toFixed(1)) : null;
          const percRrNmqlVendas = rrNmql > 0 ? parseFloat(((vendasNmql / rrNmql) * 100).toFixed(1)) : null;
          const cacUnico = clientesUnicos > 0 ? investimento / clientesUnicos : null;
          const contratos = deal.contratos;
          const cacContrato = contratos > 0 ? investimento / contratos : null;

          // Determinar status
          let adStatus = row.ad_status || 'Desconhecido';
          if (adStatus.toUpperCase() === 'ACTIVE') adStatus = 'Ativo';
          else if (adStatus.toUpperCase() === 'PAUSED') adStatus = 'Pausado';

          return {
            id: adId,
            adName: row.ad_name || `Ad ${adId}`,
            link: row.link || `https://facebook.com/ads/library/?id=${adId}`,
            dataCriacao: row.created_time ? new Date(row.created_time).toLocaleDateString('pt-BR') : null,
            status: adStatus,
            plataforma: 'Meta Ads',
            campaignId: row.campaign_id || null,
            campaignName: row.campaign_name || null,
            investimento: Math.round(investimento),
            videoHook: videoHook ? parseFloat(videoHook.toFixed(2)) : null,
            videoHold: videoHold ? parseFloat(videoHold.toFixed(2)) : null,
            ctr: ctr ? parseFloat(ctr.toFixed(2)) : null,
            cpm: cpm ? Math.round(cpm) : null,
            connectRate: connectRate ? parseFloat(connectRate.toFixed(2)) : null,
            taxaConversao: taxaConversao ? parseFloat(taxaConversao.toFixed(2)) : null,
            leads,
            cpl: cpl ? Math.round(cpl) : null,
            mql: mqls,
            cpmql: cpmql ? parseFloat(cpmql.toFixed(2)) : null,
            percMql,
            descartadoPerc: null,
            descartadoMqlPerc: null,
            descartadoNmqlPerc: null,
            percRa,
            percRaMql,
            percRaNmql,
            percRr,
            percRrMql,
            percRrNmql,
            percRrVendas,
            percRrMqlVendas,
            percRrNmqlVendas,
            clientesUnicos,
            leadTime: leadTimeMap.has(adId) ? parseFloat(leadTimeMap.get(adId)!.toFixed(1)) : null,
            aov: clientesUnicos > 0 ? Math.round((deal.valorPontual + deal.valorRecorrente) / clientesUnicos) : null,
            receitaPontual: deal.valorPontual,
            receitaRecorrente: deal.valorRecorrente,
            cacUnico: cacUnico ? Math.round(cacUnico) : null,
            cacContrato: cacContrato ? Math.round(cacContrato) : null,
            roas: investimento > 0 ? parseFloat(((deal.valorPontual + deal.valorRecorrente) / investimento).toFixed(2)) : null,
          };
        })
        .filter(c => {
          // Filtro por status
          if (status !== 'Todos') {
            if (status === 'Ativo' && c.status !== 'Ativo') return false;
            if (status === 'Pausado' && c.status !== 'Pausado') return false;
          }
          // Filtro por campanha
          if (campanhaId && String(c.campaignId) !== String(campanhaId)) return false;
          if (campanhaIdSet && !campanhaIdSet.has(String(c.campaignId))) return false;
          return true;
        });
      
      console.log("[api] Growth Criativos - Total:", criativos.length, "Status:", status);
      
      res.json(criativos);
    } catch (error) {
      console.error("[api] Error fetching growth criativos:", error);
      res.status(500).json({ error: "Failed to fetch growth criativos" });
    }
  });

  // Growth - Criativos KPIs (agregados com comparação de período)
  app.get("/api/growth/criativos/kpis", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const compareStartDate = req.query.compareStartDate as string || '';
      const compareEndDate = req.query.compareEndDate as string || '';
      const status = req.query.status as string || 'Todos';
      const campanhaId = req.query.campanhaId as string || '';
      const campanhaIds = req.query.campanhaIds as string || '';
      const campanhaIdSet = campanhaIds ? new Set(campanhaIds.split(',')) : null;

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const fetchKpis = async (sd: string, ed: string) => {
        // Query Meta Ads agregada por ad_id com campanha e status
        const adsResult = await db.execute(sql`
          SELECT
            i.ad_id,
            a.campaign_id,
            a.status as ad_status,
            SUM(i.spend::numeric) as investimento
          FROM meta_ads.meta_insights_daily i
          LEFT JOIN meta_ads.meta_ads a ON i.ad_id = a.ad_id
          WHERE i.date_start >= ${sd}::date AND i.date_start <= ${ed}::date
            AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
          GROUP BY i.ad_id, a.campaign_id, a.status
        `);

        // Filtrar por status e campanha em JS
        let adRows = (adsResult.rows as any[]);
        if (status === 'Ativo') adRows = adRows.filter((r: any) => r.ad_status?.toUpperCase() === 'ACTIVE');
        if (status === 'Pausado') adRows = adRows.filter((r: any) => r.ad_status?.toUpperCase() === 'PAUSED');
        if (campanhaId) adRows = adRows.filter((r: any) => String(r.campaign_id) === String(campanhaId));
        if (campanhaIdSet) adRows = adRows.filter((r: any) => campanhaIdSet.has(String(r.campaign_id)));

        const totalInvestimento = adRows.reduce((s: number, r: any) => s + (parseFloat(r.investimento) || 0), 0);
        const adIdList = adRows.map((r: any) => String(r.ad_id));

        // Query CRM para leads, MQLs, vendas — filtrando por ad_ids dos anúncios
        const dealsResult = await db.execute(sql`
          SELECT
            COUNT(*) as leads,
            SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
            COUNT(DISTINCT CASE WHEN stage_name = 'Negócio Ganho'
                THEN COALESCE(company_name, contact_name, title) END) as clientes_unicos,
            SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) ELSE 0 END) as receita_total
          FROM "Bitrix".crm_deal
          WHERE utm_content IS NOT NULL AND utm_content != ''
            AND created_at >= ${sd}::date AND created_at <= ${ed}::date + INTERVAL '1 day'
        `);

        const d = (dealsResult.rows as any[])[0] || {};
        let totalLeads = parseInt(d.leads) || 0;
        let totalMqls = parseInt(d.mqls) || 0;
        let totalVendas = parseInt(d.clientes_unicos) || 0;
        let totalReceita = parseFloat(d.receita_total) || 0;

        // Se tem filtro ativo (status ou campanha), filtrar deals pelos ad_ids correspondentes
        if ((status !== 'Todos' || campanhaId || campanhaIdSet) && adIdList.length > 0) {
          // Filtrar deals em JS usando o set de ad_ids
          const adIdSet = new Set(adIdList);
          const allDealsResult = await db.execute(sql`
            SELECT
              utm_content as ad_id,
              COUNT(*) as leads,
              SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
              COUNT(DISTINCT CASE WHEN stage_name = 'Negócio Ganho'
                  THEN COALESCE(company_name, contact_name, title) END) as clientes_unicos,
              SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) ELSE 0 END) as receita_total
            FROM "Bitrix".crm_deal
            WHERE utm_content IS NOT NULL AND utm_content != ''
              AND created_at >= ${sd}::date AND created_at <= ${ed}::date + INTERVAL '1 day'
            GROUP BY utm_content
          `);
          const filteredDeals = (allDealsResult.rows as any[]).filter((r: any) => adIdSet.has(String(r.ad_id)));
          totalLeads = filteredDeals.reduce((s: number, r: any) => s + (parseInt(r.leads) || 0), 0);
          totalMqls = filteredDeals.reduce((s: number, r: any) => s + (parseInt(r.mqls) || 0), 0);
          totalVendas = filteredDeals.reduce((s: number, r: any) => s + (parseInt(r.clientes_unicos) || 0), 0);
          totalReceita = filteredDeals.reduce((s: number, r: any) => s + (parseFloat(r.receita_total) || 0), 0);
        }

        const percMql = totalLeads > 0 ? parseFloat(((totalMqls / totalLeads) * 100).toFixed(1)) : 0;
        const cpmql = totalMqls > 0 ? Math.round(totalInvestimento / totalMqls) : 0;
        const cac = totalVendas > 0 ? Math.round(totalInvestimento / totalVendas) : 0;
        const aov = totalVendas > 0 ? Math.round(totalReceita / totalVendas) : 0;

        return {
          investimento: Math.round(totalInvestimento),
          percMql,
          cpmql,
          vendas: totalVendas,
          cac,
          aov,
        };
      };

      const current = await fetchKpis(startDate, endDate);
      let compare = null;
      if (compareStartDate && compareEndDate && dateRegex.test(compareStartDate) && dateRegex.test(compareEndDate)) {
        compare = await fetchKpis(compareStartDate, compareEndDate);
      }

      res.json({ current, compare });
    } catch (error) {
      console.error("[api] Error fetching criativos KPIs:", error);
      res.status(500).json({ error: "Failed to fetch criativos KPIs" });
    }
  });

  // Growth - Performance por Plataformas (dados hierárquicos: Plataforma > Campanha > Conjunto > Anúncio)
  app.get("/api/growth/performance-plataformas", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const status = req.query.status as string || 'Todos';
      
      // Validar formato de data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Buscar dados agregados por campanha do Meta Ads (apenas conta interna Turbo Partners)
      const campaignsDataResult = await db.execute(sql`
        SELECT 
          c.campaign_id,
          c.campaign_name,
          c.status as campaign_status,
          SUM(i.spend::numeric) as investimento,
          SUM(i.impressions) as impressions,
          SUM(i.clicks) as clicks,
          SUM(i.reach) as reach,
          AVG(i.ctr::numeric) as ctr,
          AVG(i.cpm::numeric) as cpm
        FROM meta_ads.meta_campaigns c
        LEFT JOIN meta_ads.meta_insights_daily i ON c.campaign_id = i.campaign_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
          AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        GROUP BY c.campaign_id, c.campaign_name, c.status
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados agregados por adset do Meta Ads (apenas conta interna Turbo Partners)
      const adsetsDataResult = await db.execute(sql`
        SELECT 
          aset.adset_id,
          aset.adset_name,
          aset.campaign_id,
          aset.status as adset_status,
          SUM(i.spend::numeric) as investimento,
          SUM(i.impressions) as impressions,
          SUM(i.clicks) as clicks,
          SUM(i.reach) as reach,
          AVG(i.ctr::numeric) as ctr,
          AVG(i.cpm::numeric) as cpm
        FROM meta_ads.meta_adsets aset
        LEFT JOIN meta_ads.meta_insights_daily i ON aset.adset_id = i.adset_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
          AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        GROUP BY aset.adset_id, aset.adset_name, aset.campaign_id, aset.status
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados agregados por anúncio do Meta Ads (apenas conta interna Turbo Partners)
      const adsDataResult = await db.execute(sql`
        SELECT 
          a.ad_id,
          a.ad_name,
          a.adset_id,
          a.campaign_id,
          a.status as ad_status,
          a.created_time,
          a.preview_shareable_link as link,
          SUM(i.spend::numeric) as investimento,
          SUM(i.impressions) as impressions,
          SUM(i.clicks) as clicks,
          SUM(i.reach) as reach,
          AVG(i.ctr::numeric) as ctr,
          AVG(i.cpm::numeric) as cpm
        FROM meta_ads.meta_ads a
        LEFT JOIN meta_ads.meta_insights_daily i ON a.ad_id = i.ad_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
          AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        GROUP BY a.ad_id, a.ad_name, a.adset_id, a.campaign_id, a.status, a.created_time, a.preview_shareable_link
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados de conversão do CRM por ad_id
      const dealsDataResult = await db.execute(sql`
        SELECT 
          utm_content as ad_id,
          COUNT(*) as leads,
          SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN stage_name IN ('Reunião Marcada', 'RM', 'Agendado', 'Reunião Agendada') THEN 1 ELSE 0 END) as rm,
          SUM(CASE WHEN stage_name IN ('Reunião Realizada', 'RR', 'Realizado') THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as vendas,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) ELSE 0 END) as valor_total
        FROM "Bitrix".crm_deal
        WHERE utm_content IS NOT NULL 
          AND utm_content != ''
          AND created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
        GROUP BY utm_content
      `);
      
      // Criar mapa de deals por ad_id
      const dealsMap = new Map<string, any>();
      for (const row of dealsDataResult.rows as any[]) {
        dealsMap.set(row.ad_id, {
          leads: parseInt(row.leads) || 0,
          mqls: parseInt(row.mqls) || 0,
          rm: parseInt(row.rm) || 0,
          rr: parseInt(row.rr) || 0,
          vendas: parseInt(row.vendas) || 0,
          valorTotal: parseFloat(row.valor_total) || 0
        });
      }
      
      // Helper para calcular métricas derivadas
      const calcMetrics = (investimento: number, impressions: number, clicks: number, reach: number, ctr: number | null, cpm: number | null, deal: any) => {
        const leads = deal.leads;
        const mqls = deal.mqls;
        const rm = deal.rm;
        const rr = deal.rr;
        const vendas = deal.vendas;
        
        const frequency = reach > 0 ? impressions / reach : null;
        const cpl = leads > 0 ? investimento / leads : null;
        const percMql = leads > 0 ? Math.round((mqls / leads) * 100) : null;
        const cpmql = mqls > 0 ? investimento / mqls : null;
        const percRa = leads > 0 ? Math.round((rm / leads) * 100) : null;
        const cpra = rm > 0 ? investimento / rm : null;
        const percRaMql = mqls > 0 ? Math.round((rm / mqls) * 100) : null;
        const percRrMql = mqls > 0 ? Math.round((rr / mqls) * 100) : null;
        const percRr = rm > 0 ? Math.round((rr / rm) * 100) : null;
        const cprr = rr > 0 ? investimento / rr : null;
        const percRrCliente = rr > 0 ? Math.round((vendas / rr) * 100) : null;
        const cacUnico = vendas > 0 ? investimento / vendas : null;
        const valorTotal = deal.valorTotal || 0;
        const roas = investimento > 0 ? valorTotal / investimento : null;
        const conversionRate = leads > 0 ? parseFloat(((vendas / leads) * 100).toFixed(1)) : null;

        return {
          investimento: Math.round(investimento),
          impressions,
          frequency: frequency ? parseFloat(frequency.toFixed(2)) : null,
          ctr: ctr ? parseFloat((typeof ctr === 'number' ? ctr : 0).toFixed(2)) : null,
          cpm: cpm ? Math.round(typeof cpm === 'number' ? cpm : 0) : null,
          leads,
          cpl: cpl ? Math.round(cpl) : null,
          mql: mqls,
          percMql,
          cpmql: cpmql ? parseFloat(cpmql.toFixed(2)) : null,
          ra: rm,
          percRa,
          cpra: cpra ? Math.round(cpra) : null,
          percRaMql,
          percRrMql,
          rr,
          percRr,
          cprr: cprr ? parseFloat(cprr.toFixed(2)) : null,
          clientesUnicos: vendas,
          percRrCliente,
          cacUnico: cacUnico ? Math.round(cacUnico) : null,
          roas: roas ? parseFloat(roas.toFixed(2)) : null,
          conversionRate
        };
      };
      
      // Processar anúncios
      const adsMap = new Map<string, any>();
      const adsByAdset = new Map<string, any[]>();
      
      for (const row of adsDataResult.rows as any[]) {
        const adId = row.ad_id;
        const adsetId = row.adset_id;
        const investimento = parseFloat(row.investimento) || 0;
        const impressions = parseInt(row.impressions) || 0;
        const clicks = parseInt(row.clicks) || 0;
        const reach = parseInt(row.reach) || 0;
        const ctr = parseFloat(row.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : null);
        const cpm = parseFloat(row.cpm) || (impressions > 0 ? (investimento / impressions) * 1000 : null);
        
        let adStatus = row.ad_status || 'Desconhecido';
        if (adStatus.toUpperCase() === 'ACTIVE') adStatus = 'Ativo';
        else if (adStatus.toUpperCase() === 'PAUSED') adStatus = 'Pausado';
        
        if (status !== 'Todos' && ((status === 'Ativo' && adStatus !== 'Ativo') || (status === 'Pausado' && adStatus !== 'Pausado'))) {
          continue;
        }
        
        const deal = dealsMap.get(adId) || { leads: 0, mqls: 0, rm: 0, rr: 0, vendas: 0, valorTotal: 0 };
        const metrics = calcMetrics(investimento, impressions, clicks, reach, ctr, cpm, deal);
        
        const adNode = {
          id: `ad_${adId}`,
          type: 'ad' as const,
          name: row.ad_name || `Ad ${adId}`,
          parentId: `adset_${adsetId}`,
          status: adStatus,
          link: row.link || `https://facebook.com/ads/library/?id=${adId}`,
          ...metrics
        };
        
        adsMap.set(adId, adNode);
        
        if (!adsByAdset.has(adsetId)) {
          adsByAdset.set(adsetId, []);
        }
        adsByAdset.get(adsetId)!.push(adNode);
      }
      
      // Processar adsets e agregar métricas dos anúncios
      const adsetsMap = new Map<string, any>();
      const adsetsByCampaign = new Map<string, any[]>();
      
      for (const row of adsetsDataResult.rows as any[]) {
        const adsetId = row.adset_id;
        const campaignId = row.campaign_id;
        const ads = adsByAdset.get(adsetId) || [];
        
        if (ads.length === 0 && status !== 'Todos') continue;
        
        // Agregar métricas dos anúncios
        let aggInvest = 0, aggImpr = 0, aggLeads = 0, aggMqls = 0, aggRm = 0, aggRr = 0, aggVendas = 0, aggValor = 0;
        for (const ad of ads) {
          aggInvest += ad.investimento || 0;
          aggImpr += ad.impressions || 0;
          aggLeads += ad.leads || 0;
          aggMqls += ad.mql || 0;
          aggRm += ad.ra || 0;
          aggRr += ad.rr || 0;
          aggVendas += ad.clientesUnicos || 0;
          // Buscar valorTotal do deal original para ROAS
          const adId = ad.id.replace('ad_', '');
          const adDeal = dealsMap.get(adId);
          if (adDeal) aggValor += adDeal.valorTotal || 0;
        }

        const deal = { leads: aggLeads, mqls: aggMqls, rm: aggRm, rr: aggRr, vendas: aggVendas, valorTotal: aggValor };
        const metrics = calcMetrics(aggInvest, aggImpr, 0, 0, aggImpr > 0 ? null : null, null, deal);
        
        // Recalcular CTR e CPM com valores agregados
        metrics.ctr = aggImpr > 0 && ads.length > 0 ? parseFloat((ads.reduce((sum, a) => sum + (a.ctr || 0), 0) / ads.length).toFixed(2)) : null;
        metrics.cpm = aggInvest > 0 && aggImpr > 0 ? Math.round((aggInvest / aggImpr) * 1000) : null;
        
        let adsetStatus = row.adset_status || 'Desconhecido';
        if (adsetStatus.toUpperCase() === 'ACTIVE') adsetStatus = 'Ativo';
        else if (adsetStatus.toUpperCase() === 'PAUSED') adsetStatus = 'Pausado';
        
        const adsetNode = {
          id: `adset_${adsetId}`,
          type: 'adset' as const,
          name: row.adset_name || `Conjunto ${adsetId}`,
          parentId: `campaign_${campaignId}`,
          status: adsetStatus,
          childrenCount: ads.length,
          ...metrics
        };
        
        adsetsMap.set(adsetId, adsetNode);
        
        if (!adsetsByCampaign.has(campaignId)) {
          adsetsByCampaign.set(campaignId, []);
        }
        adsetsByCampaign.get(campaignId)!.push(adsetNode);
      }
      
      // Processar campanhas e agregar métricas dos adsets
      const campaignsMap = new Map<string, any>();
      const campaignsByPlatform = new Map<string, any[]>();
      
      for (const row of campaignsDataResult.rows as any[]) {
        const campaignId = row.campaign_id;
        const adsets = adsetsByCampaign.get(campaignId) || [];
        
        if (adsets.length === 0 && status !== 'Todos') continue;
        
        // Agregar métricas dos adsets
        let aggInvest = 0, aggImpr = 0, aggLeads = 0, aggMqls = 0, aggRm = 0, aggRr = 0, aggVendas = 0, aggValor = 0;
        for (const adset of adsets) {
          aggInvest += adset.investimento || 0;
          aggImpr += adset.impressions || 0;
          aggLeads += adset.leads || 0;
          aggMqls += adset.mql || 0;
          aggRm += adset.ra || 0;
          aggRr += adset.rr || 0;
          aggVendas += adset.clientesUnicos || 0;
          // ROAS propagado: investimento * roas = valorTotal do adset
          if (adset.roas) aggValor += adset.investimento * adset.roas;
        }

        const deal = { leads: aggLeads, mqls: aggMqls, rm: aggRm, rr: aggRr, vendas: aggVendas, valorTotal: aggValor };
        const metrics = calcMetrics(aggInvest, aggImpr, 0, 0, null, null, deal);
        
        // Recalcular CTR e CPM com valores agregados
        metrics.ctr = aggImpr > 0 && adsets.length > 0 ? parseFloat((adsets.reduce((sum, a) => sum + (a.ctr || 0), 0) / adsets.length).toFixed(2)) : null;
        metrics.cpm = aggInvest > 0 && aggImpr > 0 ? Math.round((aggInvest / aggImpr) * 1000) : null;
        
        let campaignStatus = row.campaign_status || 'Desconhecido';
        if (campaignStatus.toUpperCase() === 'ACTIVE') campaignStatus = 'Ativo';
        else if (campaignStatus.toUpperCase() === 'PAUSED') campaignStatus = 'Pausado';
        
        const campaignNode = {
          id: `campaign_${campaignId}`,
          type: 'campaign' as const,
          name: row.campaign_name || `Campanha ${campaignId}`,
          parentId: 'platform_meta',
          status: campaignStatus,
          childrenCount: adsets.length,
          ...metrics
        };
        
        campaignsMap.set(campaignId, campaignNode);
        
        const platform = 'meta';
        if (!campaignsByPlatform.has(platform)) {
          campaignsByPlatform.set(platform, []);
        }
        campaignsByPlatform.get(platform)!.push(campaignNode);
      }
      
      // Criar nodes de plataformas
      const platforms = [];
      
      // Meta Ads
      const metaCampaigns = campaignsByPlatform.get('meta') || [];
      if (metaCampaigns.length > 0) {
        let aggInvest = 0, aggImpr = 0, aggLeads = 0, aggMqls = 0, aggRm = 0, aggRr = 0, aggVendas = 0, aggValor = 0;
        for (const camp of metaCampaigns) {
          aggInvest += camp.investimento || 0;
          aggImpr += camp.impressions || 0;
          aggLeads += camp.leads || 0;
          aggMqls += camp.mql || 0;
          aggRm += camp.ra || 0;
          aggRr += camp.rr || 0;
          aggVendas += camp.clientesUnicos || 0;
          if (camp.roas) aggValor += camp.investimento * camp.roas;
        }

        const deal = { leads: aggLeads, mqls: aggMqls, rm: aggRm, rr: aggRr, vendas: aggVendas, valorTotal: aggValor };
        const metrics = calcMetrics(aggInvest, aggImpr, 0, 0, null, null, deal);
        metrics.ctr = aggImpr > 0 && metaCampaigns.length > 0 ? parseFloat((metaCampaigns.reduce((sum, c) => sum + (c.ctr || 0), 0) / metaCampaigns.length).toFixed(2)) : null;
        metrics.cpm = aggInvest > 0 && aggImpr > 0 ? Math.round((aggInvest / aggImpr) * 1000) : null;
        
        platforms.push({
          id: 'platform_meta',
          type: 'platform' as const,
          name: 'Meta Ads',
          parentId: null,
          status: 'Ativo',
          childrenCount: metaCampaigns.length,
          ...metrics
        });
      }
      
      // Google Ads - placeholder (sem dados reais por enquanto)
      platforms.push({
        id: 'platform_google',
        type: 'platform' as const,
        name: 'Google Ads',
        parentId: null,
        status: 'Ativo',
        childrenCount: 0,
        investimento: 0, impressions: 0, frequency: null, ctr: null, cpm: null,
        leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null,
        ra: 0, percRa: null, cpra: null, percRaMql: null, percRrMql: null,
        rr: 0, percRr: null, cprr: null,
        clientesUnicos: 0, percRrCliente: null, cacUnico: null, roas: null, conversionRate: null
      });
      
      // LinkedIn Ads - placeholder
      platforms.push({
        id: 'platform_linkedin',
        type: 'platform' as const,
        name: 'LinkedIn Ads',
        parentId: null,
        status: 'Ativo',
        childrenCount: 0,
        investimento: 0, impressions: 0, frequency: null, ctr: null, cpm: null,
        leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null,
        ra: 0, percRa: null, cpra: null, percRaMql: null, percRrMql: null,
        rr: 0, percRr: null, cprr: null,
        clientesUnicos: 0, percRrCliente: null, cacUnico: null, roas: null, conversionRate: null
      });
      
      // TikTok Ads - placeholder
      platforms.push({
        id: 'platform_tiktok',
        type: 'platform' as const,
        name: 'TikTok Ads',
        parentId: null,
        status: 'Ativo',
        childrenCount: 0,
        investimento: 0, impressions: 0, frequency: null, ctr: null, cpm: null,
        leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null,
        ra: 0, percRa: null, cpra: null, percRaMql: null, percRrMql: null,
        rr: 0, percRr: null, cprr: null,
        clientesUnicos: 0, percRrCliente: null, cacUnico: null, roas: null, conversionRate: null
      });
      
      // Montar lista flat de todos os nodes
      const nodes = [
        ...platforms,
        ...Array.from(campaignsMap.values()),
        ...Array.from(adsetsMap.values()),
        ...Array.from(adsMap.values())
      ];
      
      console.log("[api] Growth Performance Plataformas - Platforms:", platforms.length, "Campaigns:", campaignsMap.size, "Adsets:", adsetsMap.size, "Ads:", adsMap.size);
      
      res.json(nodes);
    } catch (error) {
      console.error("[api] Error fetching growth performance plataformas:", error);
      res.status(500).json({ error: "Failed to fetch growth performance plataformas" });
    }
  });

  // Growth - Orçado x Realizado - Budgets CRUD
  app.get("/api/growth/orcado-realizado/budgets", async (req, res) => {
    try {
      const mes = req.query.mes as string;
      const funil = (req.query.funil as string) || 'todos';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      // Build list of months to query
      let meses: string[] = [];
      if (startDate && endDate) {
        // Generate all YYYY-MM in range
        const start = new Date(startDate + '-01');
        const end = new Date(endDate + '-01');
        const cursor = new Date(start);
        while (cursor <= end) {
          meses.push(format(cursor, 'yyyy-MM'));
          cursor.setMonth(cursor.getMonth() + 1);
        }
      } else if (mes) {
        meses = [mes];
      } else {
        return res.status(400).json({ error: "mes or startDate+endDate is required (YYYY-MM)" });
      }

      const result = await db.execute(sql`
        SELECT mes, segmento, metricas FROM meta_ads.growth_budgets
        WHERE mes IN (${sql.join(meses.map(m => sql`${m}`), sql`, `)}) AND funil = ${funil}
      `);

      // Track which months actually had data
      const mesesComMeta = new Set<string>();

      // Absolute metrics (sum across months)
      const absoluteKeys = [
        'reunioesAgendadas', 'reunioesRealizadas', 'novosClientes',
        'contratosAceleracao', 'contratosImplantacao',
        'faturamentoAceleracao', 'faturamentoImplantacao',
        'investimento', 'impressoes', 'cliques', 'cliquesSaida',
        'visualizacoesPagina', 'leads', 'mqls'
      ];
      // Percentage metrics (average across months)
      const percentKeys = [
        'percReuniaoAgendada', 'percNoShow', 'taxaVendas',
        'txContratosRecorrentes', 'txContratosImplantacao',
        'ctr', 'percMqls', 'connectRate', 'taxaConversaoPagina',
        'cpm', 'cps', 'cpl', 'cpmql',
        'ticketMedioAceleracao', 'ticketMedioImplantacao'
      ];

      // Group rows by segmento, then aggregate
      const bySegmento: Record<string, any[]> = {};
      for (const row of result.rows as any[]) {
        mesesComMeta.add(row.mes);
        if (!bySegmento[row.segmento]) bySegmento[row.segmento] = [];
        bySegmento[row.segmento].push(row.metricas);
      }

      const budgets: Record<string, any> = {};
      for (const [segmento, metricasList] of Object.entries(bySegmento)) {
        if (metricasList.length === 1) {
          budgets[segmento] = metricasList[0];
        } else {
          const aggregated: Record<string, number> = {};
          // Sum absolute metrics
          for (const key of absoluteKeys) {
            aggregated[key] = metricasList.reduce((sum, m) => sum + (Number(m[key]) || 0), 0);
          }
          // Average percentage metrics
          for (const key of percentKeys) {
            const values = metricasList.filter(m => m[key] !== undefined && m[key] !== null);
            aggregated[key] = values.length > 0
              ? values.reduce((sum, m) => sum + (Number(m[key]) || 0), 0) / values.length
              : 0;
          }
          budgets[segmento] = aggregated;
        }
      }

      res.json({
        ...budgets,
        meses_com_meta: Array.from(mesesComMeta).sort()
      });
    } catch (error) {
      console.error("[api] Error fetching budgets:", error);
      res.status(500).json({ error: "Failed to fetch budgets" });
    }
  });

  app.put("/api/growth/orcado-realizado/budgets", async (req, res) => {
    try {
      const { mes, segmento, metricas, funil } = req.body;
      const funilValue = funil || 'todos';
      if (!mes || !segmento || !metricas) {
        return res.status(400).json({ error: "mes, segmento, and metricas are required" });
      }
      await db.execute(sql`
        INSERT INTO meta_ads.growth_budgets (mes, segmento, funil, metricas)
        VALUES (${mes}, ${segmento}, ${funilValue}, ${JSON.stringify(metricas)}::jsonb)
        ON CONFLICT (mes, segmento, funil) DO UPDATE SET
          metricas = ${JSON.stringify(metricas)}::jsonb,
          updated_at = NOW()
      `);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error updating budget:", error);
      res.status(500).json({ error: "Failed to update budget" });
    }
  });

  app.get("/api/growth/orcado-realizado/budgets/months", async (req, res) => {
    try {
      // Generate last 12 months
      const now = new Date();
      const generatedMonths = new Set<string>();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        generatedMonths.add(format(d, 'yyyy-MM'));
      }

      // Also include any months that have saved budgets
      const result = await db.execute(sql`
        SELECT DISTINCT mes FROM meta_ads.growth_budgets ORDER BY mes DESC
      `);
      for (const r of result.rows as any[]) {
        generatedMonths.add(r.mes);
      }

      const sorted = Array.from(generatedMonths).sort((a, b) => b.localeCompare(a));
      res.json(sorted);
    } catch (error) {
      console.error("[api] Error fetching budget months:", error);
      res.status(500).json({ error: "Failed to fetch budget months" });
    }
  });

  app.post("/api/growth/orcado-realizado/budgets/copy", async (req, res) => {
    try {
      const { mesOrigem, mesDestino, funil } = req.body;
      const funilValue = funil || 'todos';
      if (!mesOrigem || !mesDestino) {
        return res.status(400).json({ error: "mesOrigem and mesDestino are required (YYYY-MM)" });
      }
      if (mesOrigem === mesDestino) {
        return res.status(400).json({ error: "mesOrigem and mesDestino must be different" });
      }
      const source = await db.execute(sql`
        SELECT segmento, metricas FROM meta_ads.growth_budgets
        WHERE mes = ${mesOrigem} AND funil = ${funilValue}
      `);
      if ((source.rows as any[]).length === 0) {
        return res.status(404).json({ error: `No budgets found for ${mesOrigem} with funil ${funilValue}` });
      }
      for (const row of source.rows as any[]) {
        await db.execute(sql`
          INSERT INTO meta_ads.growth_budgets (mes, segmento, funil, metricas)
          VALUES (${mesDestino}, ${row.segmento}, ${funilValue}, ${JSON.stringify(row.metricas)}::jsonb)
          ON CONFLICT (mes, segmento, funil) DO UPDATE SET
            metricas = ${JSON.stringify(row.metricas)}::jsonb,
            updated_at = NOW()
        `);
      }
      res.json({ copied: (source.rows as any[]).length, from: mesOrigem, to: mesDestino, funil: funilValue });
    } catch (error) {
      console.error("[api] Error copying budgets:", error);
      res.status(500).json({ error: "Failed to copy budgets" });
    }
  });

  // Growth - Orçado x Realizado - Categorias distintas de crm_deal
  app.get("/api/growth/orcado-realizado/categories", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT category_name
        FROM "Bitrix".crm_deal
        WHERE category_name IS NOT NULL AND category_name != ''
        ORDER BY category_name
      `);
      const categories = (result.rows as any[]).map((r: any) => r.category_name);
      res.json(categories);
    } catch (error) {
      console.error("[api] Error fetching deal categories:", error);
      res.status(500).json({ error: "Failed to fetch deal categories" });
    }
  });

  // Growth - Orçado x Realizado - Valores distintos de fnl_ngc (funil) com atividade
  app.get("/api/growth/orcado-realizado/funis", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT fnl_ngc
        FROM "Bitrix".crm_deal
        WHERE fnl_ngc IS NOT NULL AND fnl_ngc != ''
          AND LOWER(fnl_ngc) NOT IN ('cross sell', 'commerce', 'indicação', 'lead')
        ORDER BY fnl_ngc
      `);
      // Normalize: merge ecommerce/E-commerce/Ecommerce into single "Ecommerce"
      const ECOMMERCE_VARIANTS = ['ecommerce', 'e-commerce'];
      const rawFunis = (result.rows as any[]).map((r: any) => r.fnl_ngc);
      const normalizedSet = new Set<string>();
      for (const f of rawFunis) {
        if (ECOMMERCE_VARIANTS.includes(f.toLowerCase())) {
          normalizedSet.add('Ecommerce');
        } else {
          normalizedSet.add(f);
        }
      }
      const funis = Array.from(normalizedSet).sort();
      funis.unshift("(Vazio)");
      res.json(funis);
    } catch (error) {
      console.error("[api] Error fetching funis:", error);
      res.status(500).json({ error: "Failed to fetch funis" });
    }
  });

  // Growth - Orçado x Realizado - Métricas de Vendas MQL
  app.get("/api/growth/orcado-realizado/mql", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const contagem = (req.query.contagem as string) || 'contrato';

      // Funil NGC filter (supports multiple comma-separated values + "(Vazio)" for NULL/empty)
      const funilNgcRaw = req.query.funilNgc as string | undefined;
      const funilValues = funilNgcRaw ? funilNgcRaw.split(',').map(v => decodeURIComponent(v).trim()).filter(Boolean) : [];
      const hasVazio = funilValues.includes('(Vazio)');
      const realFunilValues = expandFunilValues(funilValues.filter(v => v !== '(Vazio)'));
      let funilFilter = sql``;
      if (funilValues.length > 0) {
        if (hasVazio && realFunilValues.length > 0) {
          funilFilter = sql`AND (${sql.join(realFunilValues.map(v => sql`d.fnl_ngc ILIKE ${v}`), sql` OR `)} OR d.fnl_ngc IS NULL OR d.fnl_ngc = '')`;
        } else if (hasVazio) {
          funilFilter = sql`AND (d.fnl_ngc IS NULL OR d.fnl_ngc = '')`;
        } else {
          funilFilter = sql`AND (${sql.join(realFunilValues.map(v => sql`d.fnl_ngc ILIKE ${v}`), sql` OR `)})`;
        }
      }

      // UTM Source filter
      const utmSourceParam = req.query.utmSource as string | undefined;
      let utmSourceFilter = sql``;
      if (utmSourceParam && utmSourceParam !== 'todos') {
        utmSourceFilter = sql`AND LOWER(d.utm_source) LIKE ${utmSourceParam.toLowerCase() + '%'}`;
      }

      // SQL fragments: cliente = conta cada deal; contrato = conta produtos da coluna produtos
      const prodCountExpr = "CASE WHEN d.produtos IS NULL OR d.produtos = '' OR d.produtos = '[]' THEN 1 ELSE COALESCE(array_length(string_to_array(REPLACE(REPLACE(d.produtos, '[', ''), ']', ''), ','), 1), 1) END";
      const countNovos = contagem === 'contrato'
        ? sql.raw(`SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN ${prodCountExpr} ELSE 0 END)`)
        : sql.raw("COUNT(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 END)");
      const countAcel = contagem === 'contrato'
        ? sql.raw(`SUM(CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_recorrente, 0) > 0 THEN ${prodCountExpr} ELSE 0 END)`)
        : sql.raw("COUNT(CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_recorrente, 0) > 0 THEN 1 END)");
      const countImpl = contagem === 'contrato'
        ? sql.raw(`SUM(CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_pontual, 0) > 0 THEN ${prodCountExpr} ELSE 0 END)`)
        : sql.raw("COUNT(CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_pontual, 0) > 0 THEN 1 END)");

      const mqlCondition = sql`(d.mql::text = '1' OR LOWER(d.mql::text) = 'true')`;
      const countExpr = contagem === 'contrato'
        ? sql.raw(`SUM(${prodCountExpr})`)
        : sql`COUNT(*)`;

      // Filtro inbound: apenas deals de fontes inbound
      const inboundFilter = sql`AND d.source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')`;

      // Stages que indicam que o deal chegou em Reunião Agendada ou além
      const STAGES_RM_PLUS = [
        'Reunião agendada', 'Reunião marcada', 'RM - Reunião Marcada', 'Agendamento direto',
        'Reunião realizada', 'RR - Reunião Realizada',
        'Confecção de proposta', 'Em negociação', 'Aguardado os dados',
        'Aguardando assinatura', 'Subir/Ajustar Cobrança',
        'Proposta Enviada', 'Negócio Ganho', 'Negócio perdido',
        'Fortemente interessado', 'Descartado'
      ];
      const stagesRmPlus = sql`LOWER(d.stage_name) IN (${sql.join(STAGES_RM_PLUS.map(s => sql`${s.toLowerCase()}`), sql`, `)})`;

      // Stages que indicam que a reunião foi realizada ou o deal avançou além dela
      const STAGES_RR_PLUS = [
        'Reunião realizada', 'RR - Reunião Realizada',
        'Confecção de proposta', 'Em negociação', 'Aguardado os dados',
        'Aguardando assinatura', 'Subir/Ajustar Cobrança',
        'Proposta Enviada', 'Negócio Ganho', 'Negócio perdido'
      ];
      const stagesRrPlus = sql`LOWER(d.stage_name) IN (${sql.join(STAGES_RR_PLUS.map(s => sql`${s.toLowerCase()}`), sql`, `)})`;

      // 1. Total MQLs = leads criados no período
      const totalResult = await db.execute(sql`
        SELECT ${countExpr} as total_mqls
        FROM "Bitrix".crm_deal d
        WHERE d.created_at >= ${startDate}::date
          AND d.created_at < (${endDate}::date + INTERVAL '1 day')
          AND ${mqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 2. Reuniões Agendadas = data_reuniao_agendada no período
      const raResult = await db.execute(sql`
        SELECT ${countExpr} as reunioes_agendadas_mql
        FROM "Bitrix".crm_deal d
        WHERE d.data_reuniao_agendada IS NOT NULL
          AND d.data_reuniao_agendada::date >= ${startDate}::date
          AND d.data_reuniao_agendada::date <= ${endDate}::date
          AND ${mqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 3. Reuniões Realizadas = data_fechamento no período + stage >= RR
      const rrResult = await db.execute(sql`
        SELECT ${countExpr} as reunioes_realizadas_mql
        FROM "Bitrix".crm_deal d
        WHERE d.data_fechamento >= ${startDate}::date
          AND d.data_fechamento <= ${endDate}::date
          AND ${mqlCondition}
          AND ${stagesRrPlus}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 4. Novos Clientes + Faturamento = data_fechamento no período + Negócio Ganho
      const vendasResult = await db.execute(sql`
        SELECT
          ${countNovos} as novos_clientes_mql,
          ${countAcel} as contratos_aceleracao_mql,
          ${countImpl} as contratos_implantacao_mql,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN valor_recorrente ELSE 0 END), 0) as faturamento_aceleracao_mql,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN valor_pontual ELSE 0 END), 0) as faturamento_implantacao_mql,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' AND (
            LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%'
            OR LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%'
            OR LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads'
          ) THEN valor_recorrente ELSE 0 END), 0) as faturamento_aceleracao_trafego,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' AND (
            LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%'
            OR LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%'
            OR LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads'
          ) THEN valor_pontual ELSE 0 END), 0) as faturamento_implantacao_trafego
        FROM "Bitrix".crm_deal d
        WHERE d.data_fechamento >= ${startDate}::date
          AND d.data_fechamento <= ${endDate}::date
          AND ${mqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      const totalMqls = parseInt((totalResult.rows[0] as any).total_mqls) || 0;
      const reunioesAgendadas = parseInt((raResult.rows[0] as any).reunioes_agendadas_mql) || 0;
      const reunioesRealizadas = parseInt((rrResult.rows[0] as any).reunioes_realizadas_mql) || 0;
      const vRow = vendasResult.rows[0] as any;
      const novosClientes = parseInt(vRow.novos_clientes_mql) || 0;
      const contratosAceleracao = parseInt(vRow.contratos_aceleracao_mql) || 0;
      const contratosImplantacao = parseInt(vRow.contratos_implantacao_mql) || 0;
      const faturamentoAceleracao = parseFloat(vRow.faturamento_aceleracao_mql) || 0;
      const faturamentoImplantacao = parseFloat(vRow.faturamento_implantacao_mql) || 0;
      const faturamentoAceleracaoTrafego = parseFloat(vRow.faturamento_aceleracao_trafego) || 0;
      const faturamentoImplantacaoTrafego = parseFloat(vRow.faturamento_implantacao_trafego) || 0;

      // Calcular taxas
      const percReuniaoAgendada = totalMqls > 0 ? reunioesAgendadas / totalMqls : 0;
      const percNoShow = reunioesAgendadas > 0 ? (reunioesAgendadas - reunioesRealizadas) / reunioesAgendadas : 0;
      const taxaVendas = reunioesRealizadas > 0 ? novosClientes / reunioesRealizadas : 0;
      const txContratosRecorrentes = novosClientes > 0 ? contratosAceleracao / novosClientes : 0;
      const txContratosImplantacao = novosClientes > 0 ? contratosImplantacao / novosClientes : 0;
      const ticketMedioAceleracao = contratosAceleracao > 0 ? faturamentoAceleracao / contratosAceleracao : 0;
      const ticketMedioImplantacao = contratosImplantacao > 0 ? faturamentoImplantacao / contratosImplantacao : 0;

      res.json({
        // Métricas brutas
        totalMqls,
        reunioesAgendadas,
        reunioesRealizadas,
        novosClientes,
        contratosAceleracao,
        contratosImplantacao,
        faturamentoAceleracao,
        faturamentoImplantacao,
        faturamentoAceleracaoTrafego,
        faturamentoImplantacaoTrafego,

        // Taxas calculadas
        percReuniaoAgendada,
        percNoShow,
        taxaVendas,
        txContratosRecorrentes,
        txContratosImplantacao,
        ticketMedioAceleracao,
        ticketMedioImplantacao
      });
    } catch (error) {
      console.error("[api] Error fetching MQL metrics:", error);
      res.status(500).json({ error: "Failed to fetch MQL metrics" });
    }
  });

  // Growth - Orçado x Realizado - Métricas de Vendas Não-MQL
  app.get("/api/growth/orcado-realizado/nao-mql", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const contagem = (req.query.contagem as string) || 'contrato';

      // Funil NGC filter (supports multiple comma-separated values + "(Vazio)" for NULL/empty)
      const funilNgcRaw = req.query.funilNgc as string | undefined;
      const funilValues = funilNgcRaw ? funilNgcRaw.split(',').map(v => decodeURIComponent(v).trim()).filter(Boolean) : [];
      const hasVazio = funilValues.includes('(Vazio)');
      const realFunilValues = expandFunilValues(funilValues.filter(v => v !== '(Vazio)'));
      let funilFilter = sql``;
      if (funilValues.length > 0) {
        if (hasVazio && realFunilValues.length > 0) {
          funilFilter = sql`AND (${sql.join(realFunilValues.map(v => sql`d.fnl_ngc ILIKE ${v}`), sql` OR `)} OR d.fnl_ngc IS NULL OR d.fnl_ngc = '')`;
        } else if (hasVazio) {
          funilFilter = sql`AND (d.fnl_ngc IS NULL OR d.fnl_ngc = '')`;
        } else {
          funilFilter = sql`AND (${sql.join(realFunilValues.map(v => sql`d.fnl_ngc ILIKE ${v}`), sql` OR `)})`;
        }
      }

      // UTM Source filter
      const utmSourceParam = req.query.utmSource as string | undefined;
      let utmSourceFilter = sql``;
      if (utmSourceParam && utmSourceParam !== 'todos') {
        utmSourceFilter = sql`AND LOWER(d.utm_source) LIKE ${utmSourceParam.toLowerCase() + '%'}`;
      }

      // SQL fragments: cliente = conta cada deal; contrato = conta produtos da coluna produtos
      const prodCountExpr = "CASE WHEN d.produtos IS NULL OR d.produtos = '' OR d.produtos = '[]' THEN 1 ELSE COALESCE(array_length(string_to_array(REPLACE(REPLACE(d.produtos, '[', ''), ']', ''), ','), 1), 1) END";
      const countNovos = contagem === 'contrato'
        ? sql.raw(`SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN ${prodCountExpr} ELSE 0 END)`)
        : sql.raw("COUNT(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 END)");
      const countAcel = contagem === 'contrato'
        ? sql.raw(`SUM(CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_recorrente, 0) > 0 THEN ${prodCountExpr} ELSE 0 END)`)
        : sql.raw("COUNT(CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_recorrente, 0) > 0 THEN 1 END)");
      const countImpl = contagem === 'contrato'
        ? sql.raw(`SUM(CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_pontual, 0) > 0 THEN ${prodCountExpr} ELSE 0 END)`)
        : sql.raw("COUNT(CASE WHEN stage_name = 'Negócio Ganho' AND COALESCE(valor_pontual, 0) > 0 THEN 1 END)");

      const naoMqlCondition = sql`(d.mql::text IS NULL OR d.mql::text = '' OR d.mql::text = '0' OR LOWER(d.mql::text) = 'false')`;
      const countExpr = contagem === 'contrato'
        ? sql.raw(`SUM(${prodCountExpr})`)
        : sql`COUNT(*)`;

      // Filtro inbound: apenas deals de fontes inbound
      const inboundFilter = sql`AND d.source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')`;

      // Stages que indicam que o deal chegou em Reunião Agendada ou além
      const STAGES_RM_PLUS = [
        'Reunião agendada', 'Reunião marcada', 'RM - Reunião Marcada', 'Agendamento direto',
        'Reunião realizada', 'RR - Reunião Realizada',
        'Confecção de proposta', 'Em negociação', 'Aguardado os dados',
        'Aguardando assinatura', 'Subir/Ajustar Cobrança',
        'Proposta Enviada', 'Negócio Ganho', 'Negócio perdido',
        'Fortemente interessado', 'Descartado'
      ];
      const stagesRmPlus = sql`LOWER(d.stage_name) IN (${sql.join(STAGES_RM_PLUS.map(s => sql`${s.toLowerCase()}`), sql`, `)})`;

      // Stages que indicam que a reunião foi realizada ou o deal avançou além dela
      const STAGES_RR_PLUS = [
        'Reunião realizada', 'RR - Reunião Realizada',
        'Confecção de proposta', 'Em negociação', 'Aguardado os dados',
        'Aguardando assinatura', 'Subir/Ajustar Cobrança',
        'Proposta Enviada', 'Negócio Ganho', 'Negócio perdido'
      ];
      const stagesRrPlus = sql`LOWER(d.stage_name) IN (${sql.join(STAGES_RR_PLUS.map(s => sql`${s.toLowerCase()}`), sql`, `)})`;

      // 1. Total Não-MQLs = leads criados no período
      const totalResult = await db.execute(sql`
        SELECT ${countExpr} as total_nao_mqls
        FROM "Bitrix".crm_deal d
        WHERE d.created_at >= ${startDate}::date
          AND d.created_at < (${endDate}::date + INTERVAL '1 day')
          AND ${naoMqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 2. Reuniões Agendadas = data_reuniao_agendada no período
      const raResult = await db.execute(sql`
        SELECT ${countExpr} as reunioes_agendadas
        FROM "Bitrix".crm_deal d
        WHERE d.data_reuniao_agendada IS NOT NULL
          AND d.data_reuniao_agendada::date >= ${startDate}::date
          AND d.data_reuniao_agendada::date <= ${endDate}::date
          AND ${naoMqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 3. Reuniões Realizadas = data_fechamento no período + stage >= RR
      const rrResult = await db.execute(sql`
        SELECT ${countExpr} as reunioes_realizadas
        FROM "Bitrix".crm_deal d
        WHERE d.data_fechamento >= ${startDate}::date
          AND d.data_fechamento <= ${endDate}::date
          AND ${naoMqlCondition}
          AND ${stagesRrPlus}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 4. Novos Clientes + Faturamento = data_fechamento no período + Negócio Ganho
      const vendasResult = await db.execute(sql`
        SELECT
          ${countNovos} as novos_clientes,
          ${countAcel} as contratos_aceleracao,
          ${countImpl} as contratos_implantacao,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN valor_recorrente ELSE 0 END), 0) as faturamento_aceleracao,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN valor_pontual ELSE 0 END), 0) as faturamento_implantacao,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' AND (
            LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%'
            OR LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%'
            OR LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads'
          ) THEN valor_recorrente ELSE 0 END), 0) as faturamento_aceleracao_trafego,
          COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' AND (
            LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%'
            OR LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%'
            OR LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads'
          ) THEN valor_pontual ELSE 0 END), 0) as faturamento_implantacao_trafego
        FROM "Bitrix".crm_deal d
        WHERE d.data_fechamento >= ${startDate}::date
          AND d.data_fechamento <= ${endDate}::date
          AND ${naoMqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      const totalNaoMqls = parseInt((totalResult.rows[0] as any).total_nao_mqls) || 0;
      const reunioesAgendadas = parseInt((raResult.rows[0] as any).reunioes_agendadas) || 0;
      const reunioesRealizadas = parseInt((rrResult.rows[0] as any).reunioes_realizadas) || 0;
      const vRow = vendasResult.rows[0] as any;
      const novosClientes = parseInt(vRow.novos_clientes) || 0;
      const contratosAceleracao = parseInt(vRow.contratos_aceleracao) || 0;
      const contratosImplantacao = parseInt(vRow.contratos_implantacao) || 0;
      const faturamentoAceleracao = parseFloat(vRow.faturamento_aceleracao) || 0;
      const faturamentoImplantacao = parseFloat(vRow.faturamento_implantacao) || 0;
      const faturamentoAceleracaoTrafego = parseFloat(vRow.faturamento_aceleracao_trafego) || 0;
      const faturamentoImplantacaoTrafego = parseFloat(vRow.faturamento_implantacao_trafego) || 0;

      // Calcular taxas
      const percReuniaoAgendada = totalNaoMqls > 0 ? reunioesAgendadas / totalNaoMqls : 0;
      const percNoShow = reunioesAgendadas > 0 ? (reunioesAgendadas - reunioesRealizadas) / reunioesAgendadas : 0;
      const taxaVendas = reunioesRealizadas > 0 ? novosClientes / reunioesRealizadas : 0;
      const txContratosRecorrentes = novosClientes > 0 ? contratosAceleracao / novosClientes : 0;
      const txContratosImplantacao = novosClientes > 0 ? contratosImplantacao / novosClientes : 0;
      const ticketMedioAceleracao = contratosAceleracao > 0 ? faturamentoAceleracao / contratosAceleracao : 0;
      const ticketMedioImplantacao = contratosImplantacao > 0 ? faturamentoImplantacao / contratosImplantacao : 0;

      res.json({
        // Métricas brutas
        totalNaoMqls,
        reunioesAgendadas,
        reunioesRealizadas,
        novosClientes,
        contratosAceleracao,
        contratosImplantacao,
        faturamentoAceleracao,
        faturamentoImplantacao,
        faturamentoAceleracaoTrafego,
        faturamentoImplantacaoTrafego,

        // Taxas calculadas
        percReuniaoAgendada,
        percNoShow,
        taxaVendas,
        txContratosRecorrentes,
        txContratosImplantacao,
        ticketMedioAceleracao,
        ticketMedioImplantacao
      });
    } catch (error) {
      console.error("[api] Error fetching Não-MQL metrics:", error);
      res.status(500).json({ error: "Failed to fetch Não-MQL metrics" });
    }
  });

  // Growth - Orçado x Realizado - RR (Reunião Realizada) por Semana
  app.get("/api/growth/orcado-realizado/rr-semanal", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const result = await db.execute(sql`
        SELECT
          EXTRACT(ISOYEAR FROM d.data_fechamento::date)::int as ano,
          EXTRACT(WEEK FROM d.data_fechamento::date)::int as semana_num,
          TO_CHAR(MIN(d.data_fechamento::date), 'Mon') as mes_label,
          COUNT(CASE WHEN (d.mql::text = '1' OR LOWER(d.mql::text) = 'true')
            AND LOWER(stage_name) IN ('reunião realizada', 'rr - reunião realizada',
              'confecção de proposta', 'em negociação', 'aguardado os dados',
              'aguardando assinatura', 'subir/ajustar cobrança',
              'proposta enviada', 'negócio ganho', 'negócio perdido') THEN 1 END) as rr_mql,
          COUNT(CASE WHEN (d.mql::text IS NULL OR d.mql::text = '' OR d.mql::text = '0' OR LOWER(d.mql::text) = 'false')
            AND LOWER(stage_name) IN ('reunião realizada', 'rr - reunião realizada',
              'confecção de proposta', 'em negociação', 'aguardado os dados',
              'aguardando assinatura', 'subir/ajustar cobrança',
              'proposta enviada', 'negócio ganho', 'negócio perdido') THEN 1 END) as rr_nao_mql,
          COUNT(CASE WHEN LOWER(stage_name) IN ('reunião realizada', 'rr - reunião realizada',
              'confecção de proposta', 'em negociação', 'aguardado os dados',
              'aguardando assinatura', 'subir/ajustar cobrança',
              'proposta enviada', 'negócio ganho', 'negócio perdido') THEN 1 END) as rr_total
        FROM "Bitrix".crm_deal d
        WHERE d.data_fechamento >= ${startDate}::date
          AND d.data_fechamento <= ${endDate}::date
        GROUP BY 1, 2
        ORDER BY 1, 2
      `);

      const data = result.rows.map((row: any) => ({
        semana: `S${row.semana_num} ${row.mes_label?.toLowerCase() || ''}`.trim(),
        rrMql: parseInt(row.rr_mql) || 0,
        rrNaoMql: parseInt(row.rr_nao_mql) || 0,
        rrTotal: parseInt(row.rr_total) || 0,
      }));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching RR semanal:", error);
      res.status(500).json({ error: "Failed to fetch RR semanal" });
    }
  });

  // Growth - Orçado x Realizado - Métricas de Marketing Ads (Meta)
  app.get("/api/growth/orcado-realizado/ads", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      // Parse funilNgc filter (supports "(Vazio)" for NULL/empty)
      const funilNgcRaw = req.query.funilNgc as string | undefined;
      const funilValues = funilNgcRaw
        ? funilNgcRaw.split(',').map(v => decodeURIComponent(v).trim()).filter(Boolean)
        : [];
      const hasVazio = funilValues.includes('(Vazio)');
      const realFunilValues = expandFunilValues(funilValues.filter(v => v !== '(Vazio)'));

      // Build campaign filter: match campaign names containing [funil] pattern
      // Campaign naming convention: [TP] [Leads] [ABO] [Odonto] - ...
      let campaignFilter = sql``;
      if (realFunilValues.length > 0) {
        // Filter by campaign name containing [FunilName] or the funnel name anywhere
        const nameConditions = realFunilValues.map(v => sql`(c.campaign_name ILIKE ${'%[' + v + ']%'} OR c.campaign_name ILIKE ${'%' + v + '%'})`);
        let nameFilter = sql.join(nameConditions, sql` OR `);
        if (hasVazio) {
          // Also include campaigns without any [Tag] in their name
          nameFilter = sql`(${nameFilter} OR c.campaign_name NOT LIKE '%[%]%')`;
        }
        campaignFilter = sql`AND mid.campaign_id IN (
          SELECT DISTINCT c.campaign_id::text
          FROM meta_ads.meta_campaigns c
          WHERE (${nameFilter})
        )`;
      } else if (hasVazio) {
        // Only campaigns without any [Tag] in their name
        campaignFilter = sql`AND mid.campaign_id IN (
          SELECT DISTINCT c.campaign_id::text
          FROM meta_ads.meta_campaigns c
          WHERE c.campaign_name NOT LIKE '%[%]%'
        )`;
      }

      // Query Meta Ads
      const metaResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(mid.spend), 0) as investimento,
          COALESCE(SUM(mid.impressions), 0) as impressoes,
          COALESCE(SUM(mid.clicks), 0) as cliques,
          COALESCE(SUM(mid.inline_link_clicks), 0) as cliques_saida,
          COALESCE(SUM(mid.landing_page_views), 0) as visualizacoes_pagina
        FROM meta_ads.meta_insights_daily mid
        WHERE mid.date_start >= ${startDate}::date
          AND mid.date_start <= ${endDate}::date
          AND mid.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
          ${campaignFilter}
      `);

      const metaRow = metaResult.rows[0] as any;
      const metaInvestimento = parseFloat(metaRow.investimento) || 0;
      const metaImpressoes = parseInt(metaRow.impressoes) || 0;
      const metaCliques = parseInt(metaRow.cliques) || 0;
      const cliquesSaida = parseInt(metaRow.cliques_saida) || 0;
      const visualizacoesPagina = parseInt(metaRow.visualizacoes_pagina) || 0;

      // Query Google Ads (skip when funnel is selected — no campaign-to-funnel mapping available)
      let googleInvestimento = 0;
      let googleImpressoes = 0;
      let googleCliques = 0;
      if (funilValues.length > 0) {
        // Skip Google Ads when filtering by funnel — UTM mapping not available for Google campaigns
      } else try {
        const columnsResult = await db.execute(sql`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'google_ads' AND table_name = 'campaign_daily_metrics'
          ORDER BY ordinal_position
        `);
        const columns = columnsResult.rows.map((r: any) => r.column_name);
        const dateColumn = columns.includes('report_date') ? 'report_date' :
                           columns.includes('metric_date') ? 'metric_date' :
                           columns.includes('date') ? 'date' :
                           columns.includes('segments_date') ? 'segments_date' : null;

        if (dateColumn && columns.includes('cost_micros')) {
          const googleResult = await db.execute(sql.raw(`
            SELECT
              COALESCE(SUM(cost_micros) / 1000000.0, 0) as investimento,
              COALESCE(SUM(impressions), 0) as impressoes,
              COALESCE(SUM(clicks), 0) as cliques
            FROM google_ads.campaign_daily_metrics
            WHERE ${dateColumn} >= '${startDate}'::date AND ${dateColumn} <= '${endDate}'::date
          `));
          const gRow = googleResult.rows[0] as any;
          googleInvestimento = parseFloat(gRow.investimento) || 0;
          googleImpressoes = parseInt(gRow.impressoes) || 0;
          googleCliques = parseInt(gRow.cliques) || 0;
        }
      } catch (googleError) {
        console.log("[api] Google Ads query error in orcado-realizado/ads (may not have data):", googleError);
      }

      // Combine Meta + Google
      const investimento = metaInvestimento + googleInvestimento;
      const impressoes = metaImpressoes + googleImpressoes;
      const cliques = metaCliques + googleCliques;
      const cpm = impressoes > 0 ? (investimento / impressoes * 1000) : 0;
      const ctr = impressoes > 0 ? (cliquesSaida / impressoes) : 0;

      // CPS = Custo por Sessão (Investimento / Visualizações de Página)
      const cps = visualizacoesPagina > 0 ? investimento / visualizacoesPagina : 0;
      // Connect Rate = Visualizações de Página / Cliques de Saída
      const connectRate = cliquesSaida > 0 ? visualizacoesPagina / cliquesSaida : 0;

      // Query Leads e MQLs do Bitrix (tráfego pago)
      const contagem = (req.query.contagem as string) || 'contrato';
      let funilFilter = sql``;
      if (funilValues.length > 0) {
        if (hasVazio && realFunilValues.length > 0) {
          funilFilter = sql`AND (${sql.join(realFunilValues.map(v => sql`d.fnl_ngc ILIKE ${v}`), sql` OR `)} OR d.fnl_ngc IS NULL OR d.fnl_ngc = '')`;
        } else if (hasVazio) {
          funilFilter = sql`AND (d.fnl_ngc IS NULL OR d.fnl_ngc = '')`;
        } else {
          funilFilter = sql`AND (${sql.join(realFunilValues.map(v => sql`d.fnl_ngc ILIKE ${v}`), sql` OR `)})`;
        }
      }

      // SQL fragments: cliente = conta cada deal; contrato = conta produtos da coluna produtos
      const prodCountExpr = "CASE WHEN d.produtos IS NULL OR d.produtos = '' OR d.produtos = '[]' THEN 1 ELSE COALESCE(array_length(string_to_array(REPLACE(REPLACE(d.produtos, '[', ''), ']', ''), ','), 1), 1) END";
      const countExpr = contagem === 'contrato'
        ? sql.raw(`SUM(${prodCountExpr})`)
        : sql`COUNT(*)`;
      const countMqlExpr = contagem === 'contrato'
        ? sql.raw(`SUM(CASE WHEN d.mql::text = '1' OR LOWER(d.mql::text) = 'true' THEN ${prodCountExpr} ELSE 0 END)`)
        : sql`COUNT(CASE WHEN d.mql::text = '1' OR LOWER(d.mql::text) = 'true' THEN 1 END)`;

      // Se um funil específico está selecionado, não filtrar por UTM (o funil já delimita o escopo)
      const utmFilter = funilValues.length > 0 && !hasVazio
        ? sql``
        : sql`AND (
            LOWER(d.utm_source) LIKE '%facebook%' OR LOWER(d.utm_source) LIKE '%fb%'
            OR LOWER(d.utm_source) LIKE '%meta%' OR LOWER(d.utm_source) = 'ig'
            OR LOWER(d.utm_source) LIKE '%instagram%'
            OR LOWER(d.utm_source) LIKE '%google%' OR LOWER(d.utm_source) LIKE '%adwords%'
            OR LOWER(d.utm_source) = 'gads'
          )`;

      // UTM Source filter for Ads leads
      const utmSourceParam = req.query.utmSource as string | undefined;
      let utmSourceFilter = sql``;
      if (utmSourceParam && utmSourceParam !== 'todos') {
        utmSourceFilter = sql`AND LOWER(d.utm_source) LIKE ${utmSourceParam.toLowerCase() + '%'}`;
      }

      const leadsResult = await db.execute(sql`
        SELECT
          ${countExpr} as total_leads,
          ${countMqlExpr} as total_mqls
        FROM "Bitrix".crm_deal d
        WHERE d.created_at >= ${startDate}::date
          AND d.created_at <= ${endDate}::date + INTERVAL '1 day'
          ${utmFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      const leadsRow = leadsResult.rows[0] as any;
      const leads = parseInt(leadsRow.total_leads) || 0;
      const mqls = parseInt(leadsRow.total_mqls) || 0;
      const cpl = leads > 0 ? investimento / leads : 0;
      const cpmql = mqls > 0 ? investimento / mqls : 0;
      const percMqls = leads > 0 ? (mqls / leads) : 0;

      res.json({
        investimento,
        impressoes,
        cliques,
        cliquesSaida,
        cpm,
        ctr,
        cps,
        connectRate,
        visualizacoesPagina,
        leads,
        mqls,
        cpl,
        cpmql,
        percMqls,
      });
    } catch (error) {
      console.error("[api] Error fetching Ads metrics:", error);
      res.status(500).json({ error: "Failed to fetch Ads metrics" });
    }
  });

  // Comercial - RR (Reunião Realizada) por semana por SDR
  app.get("/api/growth/comercial/rr-semanal-por-sdr", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const result = await db.execute(sql`
        SELECT
          EXTRACT(ISOYEAR FROM d.data_reuniao_realizada::date)::int AS ano,
          EXTRACT(WEEK FROM d.data_reuniao_realizada::date)::int AS semana_num,
          TO_CHAR(MIN(d.data_reuniao_realizada::date), 'Mon') AS mes_label,
          u.nome AS sdr_name,
          u.id AS sdr_id,
          COUNT(CASE WHEN (d.mql::text = '1' OR LOWER(d.mql::text) = 'true')
            AND d.stage_name IN ('Reunião Realizada', 'RR - Reunião Realizada',
              'Proposta Enviada', 'Negócio Ganho', 'Negócio Perdido') THEN 1 END) AS rr_mql,
          COUNT(CASE WHEN (d.mql::text IS NULL OR d.mql::text = '' OR d.mql::text = '0' OR LOWER(d.mql::text) = 'false')
            AND d.stage_name IN ('Reunião Realizada', 'RR - Reunião Realizada',
              'Proposta Enviada', 'Negócio Ganho', 'Negócio Perdido') THEN 1 END) AS rr_nao_mql,
          COUNT(CASE WHEN d.stage_name IN ('Reunião Realizada', 'RR - Reunião Realizada',
              'Proposta Enviada', 'Negócio Ganho', 'Negócio Perdido') THEN 1 END) AS rr_total
        FROM "Bitrix".crm_deal d
        INNER JOIN "Bitrix".crm_users u
          ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
        WHERE d.data_reuniao_realizada IS NOT NULL
          AND d.data_reuniao_realizada::date >= ${startDate}::date
          AND d.data_reuniao_realizada::date <= ${endDate}::date
        GROUP BY 1, 2, u.nome, u.id
        ORDER BY 1, 2, u.nome
      `);

      const data = (result.rows as any[]).map((row: any) => ({
        semana: `S${row.semana_num} ${row.mes_label}`,
        sdrName: row.sdr_name,
        sdrId: parseInt(row.sdr_id),
        rrMql: parseInt(row.rr_mql) || 0,
        rrNaoMql: parseInt(row.rr_nao_mql) || 0,
        rrTotal: parseInt(row.rr_total) || 0,
      }));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching RR semanal por SDR:", error);
      res.status(500).json({ error: "Failed to fetch RR semanal por SDR" });
    }
  });

  // Growth - Funil de Conversão (Meta + Google Ads → Bitrix CRM)
  app.get("/api/growth/funil-conversao", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || new Date().toISOString().split('T')[0];
      const plataforma = req.query.plataforma as string || 'Todos'; // Todos, Meta, Google
      const campaign = req.query.campaign as string || '';

      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      // 1. Ads data: impressions + clicks
      let metaImpressions = 0, metaClicks = 0, metaSpend = 0;
      let googleImpressions = 0, googleClicks = 0, googleSpend = 0;

      if (plataforma === 'Todos' || plataforma === 'Meta') {
        const metaResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(impressions), 0)::bigint as impressions,
            COALESCE(SUM(clicks), 0)::bigint as clicks,
            COALESCE(SUM(spend), 0)::numeric as spend
          FROM meta_ads.meta_insights_daily
          WHERE date_start >= ${startDate}::date AND date_stop <= ${endDate}::date
            AND account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        `);
        const mr = metaResult.rows[0] as any;
        metaImpressions = parseInt(mr.impressions) || 0;
        metaClicks = parseInt(mr.clicks) || 0;
        metaSpend = parseFloat(mr.spend) || 0;
      }

      if (plataforma === 'Todos' || plataforma === 'Google') {
        try {
          const googleResult = await db.execute(sql`
            SELECT
              COALESCE(SUM(impressions), 0)::bigint as impressions,
              COALESCE(SUM(clicks), 0)::bigint as clicks,
              COALESCE(SUM(cost_micros), 0)::bigint as cost_micros
            FROM google_ads.campaign_daily_metrics
            WHERE report_date >= ${startDate}::date AND report_date <= ${endDate}::date
          `);
          const gr = googleResult.rows[0] as any;
          googleImpressions = parseInt(gr.impressions) || 0;
          googleClicks = parseInt(gr.clicks) || 0;
          googleSpend = (parseInt(gr.cost_micros) || 0) / 1000000;
        } catch (e) {
          // Google Ads schema may not exist
        }
      }

      const totalImpressions = metaImpressions + googleImpressions;
      const totalClicks = metaClicks + googleClicks;
      const totalSpend = metaSpend + googleSpend;

      // 2. CRM funnel data from Bitrix
      const utmFilter = plataforma === 'Meta'
        ? sql`AND (LOWER(utm_source) IN ('facebook', 'fb', 'meta', 'instagram', 'ig'))`
        : plataforma === 'Google'
        ? sql`AND (LOWER(utm_source) IN ('google', 'gads', 'google_ads', 'adwords'))`
        : sql``;

      const campaignFilter = campaign
        ? sql`AND utm_campaign ILIKE ${'%' + campaign + '%'}`
        : sql``;

      const crmResult = await db.execute(sql`
        SELECT
          COUNT(*) as leads,
          SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN stage_name IN ('Reunião Marcada', 'RM', 'Agendado', 'Reunião Agendada',
                                        'Reunião Realizada', 'RR', 'Realizado', 'Negócio Ganho')
                   AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rm,
          SUM(CASE WHEN stage_name IN ('Reunião Realizada', 'RR', 'Realizado', 'Negócio Ganho')
                   AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as vendas,
          SUM(CASE WHEN stage_name = 'Negócio Ganho'
                   THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) ELSE 0 END) as valor_vendas
        FROM "Bitrix".crm_deal
        WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
          ${utmFilter}
          ${campaignFilter}
      `);

      const cr = crmResult.rows[0] as any;
      const leads = parseInt(cr.leads) || 0;
      const mqls = parseInt(cr.mqls) || 0;
      const rm = parseInt(cr.rm) || 0;
      const rr = parseInt(cr.rr) || 0;
      const vendas = parseInt(cr.vendas) || 0;
      const valorVendas = parseFloat(cr.valor_vendas) || 0;

      // 3. Build funnel stages
      const stages = [
        { key: 'impressions', label: 'Impressões', value: totalImpressions, color: '#6366f1' },
        { key: 'clicks', label: 'Cliques', value: totalClicks, color: '#8b5cf6' },
        { key: 'leads', label: 'Leads', value: leads, color: '#a855f7' },
        { key: 'mqls', label: 'MQL', value: mqls, color: '#d946ef' },
        { key: 'rm', label: 'Reunião Marcada', value: rm, color: '#ec4899' },
        { key: 'rr', label: 'Reunião Realizada', value: rr, color: '#f43f5e' },
        { key: 'vendas', label: 'Venda', value: vendas, color: '#10b981' },
      ];

      // Conversion rates between stages
      const rates = stages.slice(1).map((stage, i) => ({
        from: stages[i].key,
        to: stage.key,
        rate: stages[i].value > 0 ? (stage.value / stages[i].value * 100) : 0,
      }));

      // 4. Monthly trend
      const trendResult = await db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as leads,
          SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN stage_name IN ('Reunião Marcada', 'RM', 'Agendado', 'Reunião Agendada',
                                        'Reunião Realizada', 'RR', 'Realizado', 'Negócio Ganho')
                   AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rm,
          SUM(CASE WHEN stage_name IN ('Reunião Realizada', 'RR', 'Realizado', 'Negócio Ganho')
                   AND (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as vendas
        FROM "Bitrix".crm_deal
        WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
          ${utmFilter}
          ${campaignFilter}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY 1
      `);

      const trend = (trendResult.rows as any[]).map(row => ({
        month: row.month,
        leads: parseInt(row.leads) || 0,
        mqls: parseInt(row.mqls) || 0,
        rm: parseInt(row.rm) || 0,
        rr: parseInt(row.rr) || 0,
        vendas: parseInt(row.vendas) || 0,
      }));

      res.json({
        stages,
        rates,
        trend,
        summary: {
          totalSpend: totalSpend,
          cpl: leads > 0 ? totalSpend / leads : 0,
          cpmql: mqls > 0 ? totalSpend / mqls : 0,
          cac: vendas > 0 ? totalSpend / vendas : 0,
          roas: totalSpend > 0 ? valorVendas / totalSpend : 0,
          valorVendas,
        },
        platforms: {
          meta: { impressions: metaImpressions, clicks: metaClicks, spend: metaSpend },
          google: { impressions: googleImpressions, clicks: googleClicks, spend: googleSpend },
        },
      });
    } catch (error) {
      console.error("[api] Error fetching funil-conversao:", error);
      res.status(500).json({ error: "Failed to fetch funil de conversão" });
    }
  });

  // Google Ads - Keyword Performance
  app.get("/api/growth/keyword-performance", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || new Date().toISOString().split('T')[0];
      const matchType = req.query.matchType as string || 'Todos';
      const status = req.query.status as string || 'Todos';
      const search = req.query.search as string || '';
      const sortBy = req.query.sortBy as string || 'cost';
      const sortDir = req.query.sortDir as string || 'desc';

      // Validate dates
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const result = await db.execute(sql`
        WITH keyword_metrics AS (
          SELECT
            k.keyword_key,
            k.text as keyword_text,
            k.match_type,
            k.status,
            k.quality_score as current_quality_score,
            k.negative,
            ag.name as ad_group_name,
            c.name as campaign_name,
            c.status as campaign_status,
            COALESCE(SUM(m.impressions), 0)::bigint as impressions,
            COALESCE(SUM(m.clicks), 0)::bigint as clicks,
            COALESCE(SUM(m.cost_micros), 0)::bigint as cost_micros,
            COALESCE(SUM(m.conversions), 0)::numeric as conversions,
            COALESCE(SUM(m.conversion_value), 0)::numeric as conversion_value,
            MAX(m.quality_score) as max_quality_score
          FROM google_ads.keywords k
          JOIN google_ads.ad_groups ag ON k.ad_group_key = ag.ad_group_key
          JOIN google_ads.campaigns c ON ag.campaign_key = c.campaign_key
          LEFT JOIN google_ads.keyword_daily_metrics m
            ON k.keyword_key = m.keyword_key
            AND m.report_date >= ${startDate}::date
            AND m.report_date <= ${endDate}::date
          WHERE k.negative = false
          GROUP BY k.keyword_key, k.text, k.match_type, k.status, k.quality_score, k.negative,
                   ag.name, c.name, c.status
        )
        SELECT
          keyword_key,
          keyword_text,
          match_type,
          status,
          current_quality_score,
          ad_group_name,
          campaign_name,
          campaign_status,
          impressions,
          clicks,
          cost_micros,
          conversions,
          conversion_value,
          max_quality_score,
          CASE WHEN impressions > 0 THEN (clicks::numeric / impressions::numeric * 100) ELSE 0 END as ctr,
          CASE WHEN clicks > 0 THEN (cost_micros::numeric / clicks::numeric / 1000000.0) ELSE 0 END as avg_cpc,
          CASE WHEN cost_micros > 0 THEN (conversion_value::numeric / (cost_micros::numeric / 1000000.0)) ELSE 0 END as roas
        FROM keyword_metrics
        ORDER BY cost_micros DESC
      `);

      let data = (result.rows as any[]).map((row: any) => ({
        keywordKey: row.keyword_key,
        keyword: row.keyword_text,
        matchType: row.match_type,
        status: row.status,
        qualityScore: row.current_quality_score || row.max_quality_score || null,
        adGroup: row.ad_group_name,
        campaign: row.campaign_name,
        campaignStatus: row.campaign_status,
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        cost: (parseInt(row.cost_micros) || 0) / 1000000,
        conversions: parseFloat(row.conversions) || 0,
        conversionValue: parseFloat(row.conversion_value) || 0,
        ctr: parseFloat(row.ctr) || 0,
        avgCpc: parseFloat(row.avg_cpc) || 0,
        roas: parseFloat(row.roas) || 0,
      }));

      // Apply filters
      if (matchType !== 'Todos') {
        data = data.filter(d => d.matchType === matchType);
      }
      if (status !== 'Todos') {
        data = data.filter(d => d.status === status);
      }
      if (search) {
        const s = search.toLowerCase();
        data = data.filter(d => d.keyword.toLowerCase().includes(s) || d.campaign.toLowerCase().includes(s));
      }

      // Sort
      const dir = sortDir === 'asc' ? 1 : -1;
      const sortKey = sortBy as keyof typeof data[0];
      data.sort((a, b) => {
        const va = a[sortKey] ?? 0;
        const vb = b[sortKey] ?? 0;
        return va > vb ? dir : va < vb ? -dir : 0;
      });

      // Summary totals
      const totals = data.reduce((acc, d) => ({
        impressions: acc.impressions + d.impressions,
        clicks: acc.clicks + d.clicks,
        cost: acc.cost + d.cost,
        conversions: acc.conversions + d.conversions,
        conversionValue: acc.conversionValue + d.conversionValue,
      }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0 });

      const summary = {
        totalKeywords: data.length,
        ...totals,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0,
        avgCpc: totals.clicks > 0 ? (totals.cost / totals.clicks) : 0,
        roas: totals.cost > 0 ? (totals.conversionValue / totals.cost) : 0,
      };

      res.json({ keywords: data, summary });
    } catch (error) {
      console.error("[api] Error fetching keyword performance:", error);
      res.status(500).json({ error: "Failed to fetch keyword performance" });
    }
  });
}

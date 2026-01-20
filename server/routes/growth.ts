import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import { format } from "date-fns";

export function registerGrowthRoutes(app: Express, db: any, storage: IStorage) {
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
            FROM meta_insights_daily
            WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
          `);
          
          const metaDailyResult = await db.execute(sql`
            SELECT 
              date_start as date,
              COALESCE(SUM(spend), 0) as investimento,
              COALESCE(SUM(impressions), 0) as impressions,
              COALESCE(SUM(clicks), 0) as clicks
            FROM meta_insights_daily
            WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
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
      
      // Buscar dados do Meta Ads se canal é Todos ou Facebook
      if (canal === 'Todos' || canal === 'Facebook') {
        const metaByAdResult = await db.execute(sql`
          SELECT 
            ad_id,
            SUM(spend::numeric) as investimento,
            SUM(impressions::numeric) as impressions,
            SUM(clicks::numeric) as clicks
          FROM meta_insights_daily
          WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
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
                // Query com dados já validados (dateRegex garante formato seguro)
                const googleResult = await db.execute(sql`
                  SELECT 
                    campaign_id,
                    campaign_name,
                    COALESCE(SUM(cost_micros::numeric) / 1000000.0, 0) as investimento,
                    COALESCE(SUM(impressions::numeric), 0) as impressions,
                    COALESCE(SUM(clicks::numeric), 0) as clicks
                  FROM google_ads.campaign_daily_metrics
                  WHERE report_date >= ${startDate}::date AND report_date <= ${endDate}::date
                  GROUP BY campaign_id, campaign_name
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
      
      // Buscar totais de MQL/Leads por canal para o funil (coluna mql é text) com RM/RR stages
      // Vendas são filtradas por data_fechamento (quando o negócio foi ganho)
      const mqlTotaisPorCanalResult = await db.execute(sql`
        WITH leads_mqls AS (
          SELECT 
            COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros') as canal,
            COUNT(*) as leads,
            SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
            SUM(CASE WHEN stage_name IN ('Reunião Marcada', 'RM', 'Agendado') THEN 1 ELSE 0 END) as rm,
            SUM(CASE WHEN stage_name IN ('Reunião Realizada', 'RR', 'Realizado') THEN 1 ELSE 0 END) as rr
          FROM "Bitrix".crm_deal
          WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
            ${canalFilterSQL}
          GROUP BY COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros')
        ),
        vendas AS (
          SELECT 
            COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros') as canal,
            COUNT(DISTINCT id) as vendas,
            SUM(COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)) as valor_vendas
          FROM "Bitrix".crm_deal
          WHERE stage_name = 'Negócio Ganho'
            AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
            ${canalFilterSQL}
          GROUP BY COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros')
        )
        SELECT 
          COALESCE(lm.canal, v.canal) as canal,
          COALESCE(lm.leads, 0) as leads,
          COALESCE(lm.mqls, 0) as mqls,
          COALESCE(lm.rm, 0) as rm,
          COALESCE(lm.rr, 0) as rr,
          COALESCE(v.vendas, 0) as vendas,
          COALESCE(v.valor_vendas, 0) as valor_vendas
        FROM leads_mqls lm
        FULL OUTER JOIN vendas v ON lm.canal = v.canal
        ORDER BY COALESCE(lm.mqls, 0) DESC
      `);
      
      const mqlPorCanal = (mqlTotaisPorCanalResult.rows as any[]).map(row => {
        const leads = parseInt(row.leads) || 0;
        const mqls = parseInt(row.mqls) || 0;
        const rm = parseInt(row.rm) || 0;
        const rr = parseInt(row.rr) || 0;
        const vendas = parseInt(row.vendas) || 0;
        const valorVendas = parseFloat(row.valor_vendas) || 0;
        
        return {
          canal: String(row.canal || 'Outros'),
          leads,
          mqls,
          rm,
          rr,
          vendas,
          valorVendas,
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
      const result = await db.execute(sql`
        SELECT DISTINCT c.campaign_id, c.campaign_name
        FROM meta_campaigns c
        WHERE c.campaign_name IS NOT NULL AND c.campaign_name != ''
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
      
      // Buscar dados agregados por anúncio do Meta Ads com info do anúncio e campanha
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
          AVG(i.ctr::numeric) as ctr,
          AVG(i.cpm::numeric) as cpm,
          SUM(i.video_play_actions) as video_plays,
          SUM(i.video_p25_watched_actions) as video_p25,
          SUM(i.video_p50_watched_actions) as video_p50,
          SUM(i.video_p75_watched_actions) as video_p75,
          SUM(i.video_p100_watched_actions) as video_p100
        FROM meta_insights_daily i
        LEFT JOIN meta_ads a ON i.ad_id = a.ad_id
        LEFT JOIN meta_campaigns c ON a.campaign_id = c.campaign_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
        GROUP BY i.ad_id, a.ad_name, a.status, a.created_time, a.preview_shareable_link, a.campaign_id, c.campaign_name
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados de conversão do CRM (leads, MQL, RM, RR, Vendas) usando utm_content = ad_id
      const dealsDataResult = await db.execute(sql`
        SELECT 
          utm_content as ad_id,
          COUNT(*) as leads,
          SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN stage_name IN ('Reunião Marcada', 'RM', 'Agendado', 'Reunião Agendada') THEN 1 ELSE 0 END) as rm,
          SUM(CASE WHEN stage_name IN ('Reunião Realizada', 'RR', 'Realizado') THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as vendas,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) ELSE 0 END) as valor_pontual,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_recorrente, 0) ELSE 0 END) as valor_recorrente,
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
          valorPontual: parseFloat(row.valor_pontual) || 0,
          valorRecorrente: parseFloat(row.valor_recorrente) || 0,
          valorTotal: parseFloat(row.valor_total) || 0
        });
      }
      
      // Combinar dados de ads com deals
      const criativos = (adsDataResult.rows as any[])
        .map(row => {
          const adId = row.ad_id;
          const investimento = parseFloat(row.investimento) || 0;
          const impressions = parseInt(row.impressions) || 0;
          const clicks = parseInt(row.clicks) || 0;
          const reach = parseInt(row.reach) || 0;
          const videoPlays = parseInt(row.video_plays) || 0;
          const videoP25 = parseInt(row.video_p25) || 0;
          const videoP75 = parseInt(row.video_p75) || 0;
          
          const ctr = parseFloat(row.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : null);
          const cpm = parseFloat(row.cpm) || (impressions > 0 ? (investimento / impressions) * 1000 : null);
          
          // Frequência = impressões / alcance
          const frequency = reach > 0 ? impressions / reach : null;
          
          // Vídeo Hook = % de visualizações que passaram 3s (p25 / impressions ou videoPlays)
          const videoHook = impressions > 0 && videoP25 > 0 ? (videoP25 / impressions) * 100 : null;
          
          // Vídeo HOLD = % de quem passou 3s que viu 75% (p75 / p25)
          const videoHold = videoP25 > 0 && videoP75 > 0 ? (videoP75 / videoP25) * 100 : null;
          
          const deal = dealsMap.get(adId) || { leads: 0, mqls: 0, rm: 0, rr: 0, vendas: 0, valorPontual: 0, valorRecorrente: 0, valorTotal: 0 };
          
          const leads = deal.leads;
          const mqls = deal.mqls;
          const rm = deal.rm;
          const rr = deal.rr;
          const vendas = deal.vendas;
          
          // Calcular métricas derivadas
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
            impressions,
            frequency: frequency ? parseFloat(frequency.toFixed(2)) : null,
            videoHook: videoHook ? parseFloat(videoHook.toFixed(2)) : null,
            videoHold: videoHold ? parseFloat(videoHold.toFixed(2)) : null,
            ctr: ctr ? parseFloat(ctr.toFixed(2)) : null,
            cpm: cpm ? Math.round(cpm) : null,
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
            ganhosAceleracao: deal.valorRecorrente > 0 ? vendas : null,
            ganhosPontuais: deal.valorPontual > 0 ? vendas : null,
            cacAceleracao: deal.valorRecorrente > 0 && vendas > 0 ? investimento / vendas : null,
            leadTimeClienteUnico: null,
            clientesUnicos: vendas,
            percRrCliente,
            cacUnico: cacUnico ? Math.round(cacUnico) : null
          };
        })
        .filter(c => {
          // Filtro por status
          if (status !== 'Todos') {
            if (status === 'Ativo' && c.status !== 'Ativo') return false;
            if (status === 'Pausado' && c.status !== 'Pausado') return false;
          }
          // Filtro por campanha
          if (campanhaId && c.campaignId !== campanhaId) return false;
          return true;
        });
      
      console.log("[api] Growth Criativos - Total:", criativos.length, "Status:", status);
      
      res.json(criativos);
    } catch (error) {
      console.error("[api] Error fetching growth criativos:", error);
      res.status(500).json({ error: "Failed to fetch growth criativos" });
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
      
      // Buscar dados agregados por campanha do Meta Ads
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
        FROM meta_campaigns c
        LEFT JOIN meta_insights_daily i ON c.campaign_id = i.campaign_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
        GROUP BY c.campaign_id, c.campaign_name, c.status
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados agregados por adset do Meta Ads
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
        FROM meta_adsets aset
        LEFT JOIN meta_insights_daily i ON aset.adset_id = i.adset_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
        GROUP BY aset.adset_id, aset.adset_name, aset.campaign_id, aset.status
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados agregados por anúncio do Meta Ads
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
        FROM meta_ads a
        LEFT JOIN meta_insights_daily i ON a.ad_id = i.ad_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
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
          cacUnico: cacUnico ? Math.round(cacUnico) : null
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
        let aggInvest = 0, aggImpr = 0, aggLeads = 0, aggMqls = 0, aggRm = 0, aggRr = 0, aggVendas = 0;
        for (const ad of ads) {
          aggInvest += ad.investimento || 0;
          aggImpr += ad.impressions || 0;
          aggLeads += ad.leads || 0;
          aggMqls += ad.mql || 0;
          aggRm += ad.ra || 0;
          aggRr += ad.rr || 0;
          aggVendas += ad.clientesUnicos || 0;
        }
        
        const deal = { leads: aggLeads, mqls: aggMqls, rm: aggRm, rr: aggRr, vendas: aggVendas, valorTotal: 0 };
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
        let aggInvest = 0, aggImpr = 0, aggLeads = 0, aggMqls = 0, aggRm = 0, aggRr = 0, aggVendas = 0;
        for (const adset of adsets) {
          aggInvest += adset.investimento || 0;
          aggImpr += adset.impressions || 0;
          aggLeads += adset.leads || 0;
          aggMqls += adset.mql || 0;
          aggRm += adset.ra || 0;
          aggRr += adset.rr || 0;
          aggVendas += adset.clientesUnicos || 0;
        }
        
        const deal = { leads: aggLeads, mqls: aggMqls, rm: aggRm, rr: aggRr, vendas: aggVendas, valorTotal: 0 };
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
        let aggInvest = 0, aggImpr = 0, aggLeads = 0, aggMqls = 0, aggRm = 0, aggRr = 0, aggVendas = 0;
        for (const camp of metaCampaigns) {
          aggInvest += camp.investimento || 0;
          aggImpr += camp.impressions || 0;
          aggLeads += camp.leads || 0;
          aggMqls += camp.mql || 0;
          aggRm += camp.ra || 0;
          aggRr += camp.rr || 0;
          aggVendas += camp.clientesUnicos || 0;
        }
        
        const deal = { leads: aggLeads, mqls: aggMqls, rm: aggRm, rr: aggRr, vendas: aggVendas, valorTotal: 0 };
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
        clientesUnicos: 0, percRrCliente: null, cacUnico: null
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
        clientesUnicos: 0, percRrCliente: null, cacUnico: null
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
        clientesUnicos: 0, percRrCliente: null, cacUnico: null
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
}

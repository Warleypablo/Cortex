import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import { format } from "date-fns";
import { getLinktreeMetrics } from "../services/linktreeGa4";
import { getSessionsByPlatform, getGa4SourceMediumDiagnostic } from "../services/ga4Sessions";
import { UTM_SOURCES_BY_MEDIUM, UTM_SOURCE_LABELS, type UtmMedium } from "@shared/utm-vocabulary";

// Account ID interno da Turbo Partners - usado para filtrar apenas dados internos
const TURBO_PARTNERS_ACCOUNT_ID = 'act_1331413260627780';

/**
 * Expressão SQL que classifica um deal do Bitrix em plataforma de marketing.
 *
 * Instagram inclui:
 *  - utm_source contendo 'instagram' ou igual a 'ig' (UTM marcação correta)
 *  - utm_term='linktree' (Constituição UTM v1, vigência 21/05/2026 — Esther configura)
 *  - utm_campaign='linktree' AND utm_content='linktree' (LEGADO — links da bio do IG pré-21/05)
 *  - source='WEB' (fonte do Bitrix "Contato - Instagram")
 *  - source='UC_4VCKGM' (fonte do Bitrix "Social Selling - Instagram")
 *
 * Mapping confirmado via crm.status.list?filter[ENTITY_ID]=SOURCE.
 * NB: WEB e UC_4VCKGM são checados ANTES dos UTMs porque alguns leads de
 * "Contato - Instagram" chegaram com utm_source=facebook por bug de marcação.
 */
const PLATFORM_CASE_SQL = `CASE
  WHEN source = 'UC_4VCKGM' THEN 'instagram'
  WHEN source = 'WEB' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_term, ''))) = 'linktree' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_campaign, ''))) = 'linktree' AND LOWER(TRIM(COALESCE(utm_content, ''))) = 'linktree' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%instagram%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'ig' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%linkedin_ads%' THEN 'linkedin_ads'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%linkedin%' THEN 'linkedin_social'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%youtube%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'yt' THEN 'youtube'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok_ads%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok%ads%' THEN 'tiktok_ads'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'tt' THEN 'tiktok_social'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%facebook%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%fb%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%meta%' THEN 'meta_ads'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%google%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%gads%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%adwords%' THEN 'google_ads'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%email%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%e-mail%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%mailchimp%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%rdstation%' THEN 'email'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%whatsapp%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%wpp%' THEN 'whatsapp'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%evento%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%event%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%webinar%' THEN 'eventos'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) IN ('organic', 'organico', 'direct', '(direct)', '(none)', '') THEN 'organico'
  ELSE COALESCE((SELECT normalized FROM public.utm_source_map WHERE raw_source = LOWER(TRIM(COALESCE(utm_source, '')))), 'outros')
END`;

/**
 * Versão simplificada usada em /funnel-by-platform (sem split linkedin_ads/social,
 * sem tiktok/email/whatsapp/eventos/organico — agrupa tudo isso em 'outros').
 */
const PLATFORM_CASE_SQL_BASIC = `CASE
  WHEN source = 'UC_4VCKGM' THEN 'instagram'
  WHEN source = 'WEB' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_term, ''))) = 'linktree' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_campaign, ''))) = 'linktree' AND LOWER(TRIM(COALESCE(utm_content, ''))) = 'linktree' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%instagram%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'ig' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%linkedin_ads%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%linkedin%ads%' THEN 'linkedin_ads'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%linkedin%' THEN 'linkedin'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%youtube%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'yt' THEN 'youtube'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok_ads%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok%ads%' THEN 'tiktok_ads'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'tt' THEN 'tiktok'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%facebook%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%fb%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%meta%' THEN 'meta_ads'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%google%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%gads%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%adwords%' THEN 'google_ads'
  ELSE COALESCE((SELECT normalized FROM public.utm_source_map WHERE raw_source = LOWER(TRIM(COALESCE(utm_source, '')))), 'outros')
END`;

/**
 * Medium da Constituição UTM (paid | organic | crm | eventos | referral | outbound).
 * Nível superior da aba "Por Plataforma".
 *
 * Regra: se o deal já tem utm_medium válido (tráfego pós-cutover de 21/05/2026),
 * usa ele. Caso contrário (histórico), DERIVA o medium do utm_source — mesma
 * heurística do PLATFORM_CASE_SQL. Assim a aba mostra histórico completo sem
 * esperar utm_medium acumular.
 */
const MEDIUM_CASE_SQL = `CASE
  WHEN LOWER(TRIM(COALESCE(utm_medium, ''))) IN ('paid','organic','crm','eventos','referral','outbound') THEN LOWER(TRIM(utm_medium))
  WHEN source = 'UC_4VCKGM' OR source = 'WEB' THEN 'organic'
  WHEN LOWER(TRIM(COALESCE(utm_term, ''))) = 'linktree' THEN 'organic'
  WHEN LOWER(TRIM(COALESCE(utm_campaign, ''))) = 'linktree' AND LOWER(TRIM(COALESCE(utm_content, ''))) = 'linktree' THEN 'organic'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%instagram%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'ig' THEN 'organic'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%linkedin_ads%' THEN 'paid'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%linkedin%' THEN 'organic'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%youtube%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'yt' THEN 'organic'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok_ads%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok%ads%' THEN 'paid'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'tt' THEN 'organic'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%facebook%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%fb%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%meta%' THEN 'paid'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%google%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%gads%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%adwords%' THEN 'paid'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%email%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%e-mail%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%mailchimp%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%rdstation%' THEN 'crm'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%whatsapp%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%wpp%' THEN 'crm'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%evento%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%event%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%webinar%' THEN 'eventos'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) IN ('organic','organico','direct','(direct)','(none)','') THEN 'organic'
  ELSE 'outros'
END`;

/**
 * Source canônico da Constituição UTM (facebook, google, instagram, email, whatsapp, ...).
 *
 * Para deals com utm_medium válido, usa o utm_source cru (cobre sources de
 * referral/outbound: cliente, colaborador, influencer, etc). Para o histórico,
 * normaliza via heurística — ads e orgânico do mesmo canal colapsam no mesmo
 * source (ex: linkedin_ads e linkedin → 'linkedin'); o medium é quem distingue.
 */
const SOURCE_CANON_SQL = `CASE
  WHEN LOWER(TRIM(COALESCE(utm_medium, ''))) IN ('paid','organic','crm','eventos','referral','outbound')
       AND NULLIF(LOWER(TRIM(COALESCE(utm_source, ''))), '') IS NOT NULL THEN LOWER(TRIM(utm_source))
  WHEN source = 'UC_4VCKGM' OR source = 'WEB' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_term, ''))) = 'linktree' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_campaign, ''))) = 'linktree' AND LOWER(TRIM(COALESCE(utm_content, ''))) = 'linktree' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%instagram%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'ig' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%linkedin%' THEN 'linkedin'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%youtube%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'yt' THEN 'youtube'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%tiktok%' OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'tt' THEN 'tiktok'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%facebook%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%fb%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%meta%' THEN 'facebook'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%google%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%gads%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%adwords%' THEN 'google'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%email%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%e-mail%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%mailchimp%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%rdstation%' THEN 'email'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%whatsapp%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%wpp%' THEN 'whatsapp'
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%evento%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%event%' OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%webinar%' THEN COALESCE(NULLIF(LOWER(TRIM(utm_source)), ''), 'eventos')
  WHEN LOWER(TRIM(COALESCE(utm_source, ''))) IN ('organic','organico','direct','(direct)','(none)','') THEN 'direto'
  ELSE COALESCE(NULLIF(LOWER(TRIM(utm_source)), ''), 'outros')
END`;

// Funnel name aliases: normalized name → all DB variations
const FUNNEL_ALIASES: Record<string, string[]> = {
  'ecommerce': ['Ecommerce', 'E-commerce', 'ecommerce'],
};

/**
 * Constrói um filtro SQL pra utm_source/plataforma consistente com PLATFORM_CASE_SQL_BASIC.
 *
 * Diferente do filtro estrito `LOWER(utm_source) LIKE 'instagram%'`, este filtro:
 *   - Para `instagram`: também aceita source='WEB' (Contato IG), source='UC_4VCKGM'
 *     (Social Selling IG), utm_term='linktree', utm_campaign+content='linktree' (legado).
 *   - Para outras plataformas: mantém o LIKE 'platform%' (já cobre 'facebook', 'fb_ads', etc).
 *
 * Usa o alias da tabela `d` (todos os endpoints chamadores já fazem FROM "Bitrix".crm_deal d).
 */
function buildPlatformFilterSql(utmValues: string[]) {
  if (utmValues.length === 0) return sql``;
  const expressions = utmValues.map((v) => {
    if (v === 'instagram') {
      return sql`(
        LOWER(d.utm_source) LIKE 'instagram%'
        OR LOWER(d.utm_source) = 'ig'
        OR d.source IN ('WEB', 'UC_4VCKGM')
        OR LOWER(TRIM(COALESCE(d.utm_term, ''))) = 'linktree'
        OR (
          LOWER(TRIM(COALESCE(d.utm_campaign, ''))) = 'linktree'
          AND LOWER(TRIM(COALESCE(d.utm_content, ''))) = 'linktree'
        )
      )`;
    }
    return sql`LOWER(d.utm_source) LIKE ${v + '%'}`;
  });
  return sql`AND (${sql.join(expressions, sql` OR `)})`;
}

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

  // Ensure Instagram snapshot columns exist
  db.execute(sql`ALTER TABLE cortex_core.instagram_metrics_snapshots ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0`)
    .catch(() => { /* column may already exist */ });
  db.execute(sql`ALTER TABLE cortex_core.instagram_metrics_snapshots ADD COLUMN IF NOT EXISTS website_clicks INTEGER DEFAULT 0`)
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
            SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'google'
          `);
          
          if (schemaCheck.rows.length > 0) {
            const columnsResult = await db.execute(sql`
              SELECT column_name FROM information_schema.columns 
              WHERE table_schema = 'google' AND table_name = 'campaign_daily_metrics'
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
                FROM google.campaign_daily_metrics
                WHERE ${dateColumn} >= '${startDate}'::date AND ${dateColumn} <= '${endDate}'::date
              `));
              
              const googleDailyResult = await db.execute(sql.raw(`
                SELECT 
                  ${dateColumn} as date,
                  COALESCE(SUM(cost_micros) / 1000000.0, 0) as investimento,
                  COALESCE(SUM(impressions), 0) as impressions,
                  COALESCE(SUM(clicks), 0) as clicks
                FROM google.campaign_daily_metrics
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
            SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'google'
          `);
          
          if (schemaCheck.rows.length > 0) {
            const tableCheck = await db.execute(sql`
              SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'google' AND table_name = 'campaign_daily_metrics'
            `);
            
            if (tableCheck.rows.length > 0) {
              const columnsResult = await db.execute(sql`
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = 'google' AND table_name = 'campaign_daily_metrics'
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
                  FROM google.campaign_daily_metrics m
                  JOIN google.campaigns c ON m.campaign_id = c.campaign_id
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
      const plataformaParam = req.query.plataforma as string || 'Todos'; // supports comma-separated
      const campanhaId = req.query.campanhaId as string || ''; // campaign_id filter
      const campanhaIds = req.query.campanhaIds as string || ''; // comma-separated campaign_ids (produto filter)
      const campanhaIdSet = campanhaIds ? new Set(campanhaIds.split(',')) : null;

      // Validar formato de data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }

      // Parse plataforma filter (supports comma-separated for multi-select)
      const plataformas = plataformaParam === 'Todos' ? [] : plataformaParam.split(',').map(p => p.trim());

      // Por enquanto só temos dados do Meta Ads
      // Se nenhuma plataforma selecionada incluir Meta Ads (ou "Todos"), retornar vazio
      if (plataformas.length > 0 && !plataformas.includes('Meta Ads') && !plataformas.includes('Todos')) {
        console.log("[api] Growth Criativos - Plataformas:", plataformas, "- sem dados disponíveis");
        return res.json([]);
      }
      
      // Buscar dados agregados por anúncio do Meta Ads com info do anúncio e campanha (apenas conta interna Turbo Partners)
      const adsDataResult = await db.execute(sql`
        SELECT
          i.ad_id,
          a.ad_name,
          a.effective_status as ad_status,
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
          COALESCE(SUM(i.video_3_sec_watched_actions), 0) as video_3sec,
          COALESCE(SUM(i.video_thruplay_watched_actions), 0) as video_thruplay,
          COALESCE(SUM(i.landing_page_views), 0) as landing_page_views
        FROM meta_ads.meta_insights_daily i
        LEFT JOIN meta_ads.meta_ads a ON i.ad_id = a.ad_id
        LEFT JOIN meta_ads.meta_campaigns c ON a.campaign_id = c.campaign_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
          AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        GROUP BY i.ad_id, a.ad_name, a.effective_status, a.created_time, a.preview_shareable_link, a.campaign_id, c.campaign_name
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados de conversão do CRM (leads, MQL, NMQL, RM, RR, Vendas com splits) usando utm_content = ad_id
      // descartados = leads com motivo_perda culpa do marketing (Dropshipping, Nicho Black,
      // Agencia de Marketing, Infoproduto, Afiliado, Fake) — vindos de cortex_core.deal_motivo_perda
      const dealsDataResult = await db.execute(sql`
        SELECT
          d.utm_content as ad_id,
          COUNT(*) as leads,
          SUM(CASE WHEN d.mql::text = '1' OR LOWER(d.mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN NOT (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 ELSE 0 END) as nmqls,
          SUM(CASE WHEN d.data_reuniao_agendada IS NOT NULL THEN 1 ELSE 0 END) as rm,
          SUM(CASE WHEN d.data_reuniao_agendada IS NOT NULL AND (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 ELSE 0 END) as rm_mql,
          SUM(CASE WHEN d.data_reuniao_agendada IS NOT NULL AND NOT (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 ELSE 0 END) as rm_nmql,
          SUM(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN d.data_reuniao_realizada IS NOT NULL AND (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 ELSE 0 END) as rr_mql,
          SUM(CASE WHEN d.data_reuniao_realizada IS NOT NULL AND NOT (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 ELSE 0 END) as rr_nmql,
          SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as vendas,
          SUM(CASE WHEN d.stage_name = 'Negócio Ganho'
              AND (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 ELSE 0 END) as vendas_mql,
          SUM(CASE WHEN d.stage_name = 'Negócio Ganho'
              AND NOT (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 ELSE 0 END) as vendas_nmql,
          COUNT(DISTINCT CASE WHEN d.stage_name = 'Negócio Ganho'
              THEN COALESCE(d.company_name, d.contact_name, d.title) END) as clientes_unicos,
          NULL::numeric as min_lead_time,
          SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN COALESCE(d.valor_pontual, 0) ELSE 0 END) as valor_pontual,
          SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN COALESCE(d.valor_recorrente, 0) ELSE 0 END) as valor_recorrente,
          SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN
            CASE WHEN d.produtos IS NULL OR d.produtos = '' OR d.produtos = '[]' THEN 1
            ELSE COALESCE(array_length(string_to_array(REPLACE(REPLACE(d.produtos, '[', ''), ']', ''), ','), 1), 1) END
          ELSE 0 END) as contratos,
          SUM(CASE WHEN dmp.motivo_perda IN ('Dropshipping', 'Nicho Black', 'Agencia de Marketing', 'Infoproduto', 'Afiliado', 'Fake') THEN 1 ELSE 0 END) as descartados,
          SUM(CASE WHEN dmp.motivo_perda IN ('Dropshipping', 'Nicho Black', 'Agencia de Marketing', 'Infoproduto', 'Afiliado', 'Fake')
              AND (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 ELSE 0 END) as descartados_mql,
          SUM(CASE WHEN dmp.motivo_perda IN ('Dropshipping', 'Nicho Black', 'Agencia de Marketing', 'Infoproduto', 'Afiliado', 'Fake')
              AND NOT (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 ELSE 0 END) as descartados_nmql
        FROM "Bitrix".crm_deal d
        LEFT JOIN cortex_core.deal_motivo_perda dmp ON dmp.deal_id = d.id
        WHERE d.utm_content IS NOT NULL
          AND d.utm_content != ''
          AND d.created_at >= ${startDate}::date AND d.created_at <= ${endDate}::date + INTERVAL '1 day'
          AND d.source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
        GROUP BY d.utm_content
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
          descartados: parseInt(row.descartados) || 0,
          descartadosMql: parseInt(row.descartados_mql) || 0,
          descartadosNmql: parseInt(row.descartados_nmql) || 0,
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
            AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
          GROUP BY utm_content, COALESCE(company_name, contact_name, title)
        ) sub
        GROUP BY utm_content
      `);
      const leadTimeMap = new Map<string, number>();
      for (const row of leadTimeResult.rows as any[]) {
        if (row.avg_lead_time) leadTimeMap.set(row.ad_id, parseFloat(row.avg_lead_time));
      }

      // Buscar ads ativos que não têm insights no período (para não ficarem invisíveis)
      const adsWithInsights = new Set((adsDataResult.rows as any[]).map((r: any) => r.ad_id));
      const activeAdsNoInsights = await db.execute(sql`
        SELECT
          a.ad_id,
          a.ad_name,
          a.effective_status as ad_status,
          a.created_time,
          a.preview_shareable_link as link,
          a.campaign_id,
          c.campaign_name,
          0 as investimento, 0 as impressions, 0 as clicks, 0 as reach,
          0 as outbound_clicks, 0 as cpm, 0 as video_plays,
          0 as video_p25, 0 as video_p50, 0 as video_p75, 0 as video_p100,
          0 as video_3sec, 0 as video_thruplay,
          0 as landing_page_views
        FROM meta_ads.meta_ads a
        LEFT JOIN meta_ads.meta_campaigns c ON a.campaign_id = c.campaign_id
        WHERE a.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
          AND a.effective_status IN ('ACTIVE', 'WITH_ISSUES')
          AND a.ad_id NOT IN (
            SELECT DISTINCT i.ad_id FROM meta_ads.meta_insights_daily i
            WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
              AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
          )
      `);
      // Mesclar ads ativos sem insights com os que têm insights
      const allAdsRows = [
        ...(adsDataResult.rows as any[]),
        ...(activeAdsNoInsights.rows as any[]),
      ];

      // Combinar dados de ads com deals
      const criativos = allAdsRows
        .map(row => {
          const adId = row.ad_id;
          const investimento = parseFloat(row.investimento) || 0;
          const impressions = parseInt(row.impressions) || 0;
          const clicks = parseInt(row.clicks) || 0;
          const reach = parseInt(row.reach) || 0;
          const landingPageViews = parseInt(row.landing_page_views) || 0;

          const outboundClicks = parseInt(row.outbound_clicks) || 0;
          // CTR de saída = outbound_clicks / impressions
          const ctr = impressions > 0 && outboundClicks > 0 ? (outboundClicks / impressions) * 100 : null;
          const cpm = parseFloat(row.cpm) || (impressions > 0 ? (investimento / impressions) * 1000 : null);

          // Vídeo Hook = video_3_sec_watched_actions (actions[].video_view) / impressões
          // Vídeo Hold = video_thruplay_watched_actions / impressões
          const video3Sec = parseInt(row.video_3sec) || 0;
          const videoThruplay = parseInt(row.video_thruplay) || 0;
          const videoHook = impressions > 0 && video3Sec > 0 ? (video3Sec / impressions) * 100 : null;
          const videoHold = impressions > 0 && videoThruplay > 0 ? (videoThruplay / impressions) * 100 : null;
          // Connect rate = landing_page_views / outbound_clicks
          const connectRate = outboundClicks > 0 && landingPageViews > 0 ? (landingPageViews / outboundClicks) * 100 : null;

          const deal = dealsMap.get(adId) || { leads: 0, mqls: 0, nmqls: 0, rm: 0, rmMql: 0, rmNmql: 0, rr: 0, rrMql: 0, rrNmql: 0, vendas: 0, vendasMql: 0, vendasNmql: 0, clientesUnicos: 0, minLeadTime: null, valorPontual: 0, valorRecorrente: 0, contratos: 0, descartados: 0, descartadosMql: 0, descartadosNmql: 0 };

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
          const percRr = leads > 0 ? parseFloat(((rr / leads) * 100).toFixed(1)) : null;
          const percRrMql = mqls > 0 ? parseFloat(((rrMql / mqls) * 100).toFixed(1)) : null;
          const percRrNmql = nmqls > 0 ? parseFloat(((rrNmql / nmqls) * 100).toFixed(1)) : null;
          const percRrVendas = rr > 0 ? parseFloat(((vendas / rr) * 100).toFixed(1)) : null;
          const percRrMqlVendas = rrMql > 0 ? parseFloat(((vendasMql / rrMql) * 100).toFixed(1)) : null;
          const percRrNmqlVendas = rrNmql > 0 ? parseFloat(((vendasNmql / rrNmql) * 100).toFixed(1)) : null;
          const descartadoPerc = leads > 0 ? parseFloat(((deal.descartados / leads) * 100).toFixed(1)) : null;
          const descartadoMqlPerc = mqls > 0 ? parseFloat(((deal.descartadosMql / mqls) * 100).toFixed(1)) : null;
          const descartadoNmqlPerc = nmqls > 0 ? parseFloat(((deal.descartadosNmql / nmqls) * 100).toFixed(1)) : null;
          const cacUnico = clientesUnicos > 0 ? investimento / clientesUnicos : null;
          const contratos = deal.contratos;
          const cacContrato = contratos > 0 ? investimento / contratos : null;
          // CPRA = invest / RA (rm), CPRR = invest / RR. Splits MQL/nMQL idem.
          const cpra = investimento > 0 && rm > 0 ? investimento / rm : null;
          const cpraMql = investimento > 0 && rmMql > 0 ? investimento / rmMql : null;
          const cpraNmql = investimento > 0 && rmNmql > 0 ? investimento / rmNmql : null;
          const cprr = investimento > 0 && rr > 0 ? investimento / rr : null;
          const cprrMql = investimento > 0 && rrMql > 0 ? investimento / rrMql : null;
          const cprrNmql = investimento > 0 && rrNmql > 0 ? investimento / rrNmql : null;

          // Determinar status baseado no effective_status (reflete estado real atual)
          let adStatus = row.ad_status || 'Desconhecido';
          const upperStatus = adStatus.toUpperCase();
          if (['ACTIVE', 'WITH_ISSUES'].includes(upperStatus)) adStatus = 'Ativo';
          else if (['PAUSED', 'ADSET_PAUSED', 'CAMPAIGN_PAUSED'].includes(upperStatus)) adStatus = 'Pausado';
          else if (['ARCHIVED', 'DELETED', 'DISAPPROVED'].includes(upperStatus)) adStatus = 'Inativo';

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
            cpra: cpra !== null ? Math.round(cpra) : null,
            cpraMql: cpraMql !== null ? Math.round(cpraMql) : null,
            cpraNmql: cpraNmql !== null ? Math.round(cpraNmql) : null,
            cprr: cprr !== null ? Math.round(cprr) : null,
            cprrMql: cprrMql !== null ? Math.round(cprrMql) : null,
            cprrNmql: cprrNmql !== null ? Math.round(cprrNmql) : null,
            percMql,
            descartadoPerc,
            descartadoMqlPerc,
            descartadoNmqlPerc,
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
            receita: deal.valorPontual + deal.valorRecorrente || null,
            receitaPontual: deal.valorPontual,
            receitaRecorrente: deal.valorRecorrente,
            cacGeral: vendas > 0 ? Math.round(investimento / vendas) : null,
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
      const plataformaParam = req.query.plataforma as string || 'Todos';
      const campanhaId = req.query.campanhaId as string || '';
      const campanhaIds = req.query.campanhaIds as string || '';
      const campanhaIdSet = campanhaIds ? new Set(campanhaIds.split(',')) : null;

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      // Se plataformas selecionadas não incluem Meta Ads, retornar zeros
      const plataformas = plataformaParam === 'Todos' ? [] : plataformaParam.split(',').map(p => p.trim());
      if (plataformas.length > 0 && !plataformas.includes('Meta Ads') && !plataformas.includes('Todos')) {
        const emptyKpis = { investimento: 0, percMql: 0, cpmql: 0, vendas: 0, cac: 0, aov: 0 };
        return res.json({ current: emptyKpis, compare: null });
      }

      const fetchKpis = async (sd: string, ed: string) => {
        // Query Meta Ads agregada por ad_id com campanha e status
        const adsResult = await db.execute(sql`
          SELECT
            i.ad_id,
            a.campaign_id,
            a.effective_status as ad_status,
            SUM(i.spend::numeric) as investimento
          FROM meta_ads.meta_insights_daily i
          LEFT JOIN meta_ads.meta_ads a ON i.ad_id = a.ad_id
          WHERE i.date_start >= ${sd}::date AND i.date_start <= ${ed}::date
            AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
          GROUP BY i.ad_id, a.campaign_id, a.effective_status
        `);

        // Filtrar por status e campanha em JS
        let adRows = (adsResult.rows as any[]);
        if (status === 'Ativo') adRows = adRows.filter((r: any) => r.ad_status?.toUpperCase() === 'ACTIVE');
        if (status === 'Pausado') adRows = adRows.filter((r: any) => ['PAUSED', 'ADSET_PAUSED', 'CAMPAIGN_PAUSED'].includes(r.ad_status?.toUpperCase()));
        if (campanhaId) adRows = adRows.filter((r: any) => String(r.campaign_id) === String(campanhaId));
        if (campanhaIdSet) adRows = adRows.filter((r: any) => campanhaIdSet.has(String(r.campaign_id)));

        const totalInvestimento = adRows.reduce((s: number, r: any) => s + (parseFloat(r.investimento) || 0), 0);
        const adIdSet = new Set(adRows.map((r: any) => String(r.ad_id)));

        // Query CRM para leads, MQLs, vendas — sempre filtrando por ad_ids do Meta Ads
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
            AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
          GROUP BY utm_content
        `);
        const filteredDeals = (allDealsResult.rows as any[]).filter((r: any) => adIdSet.has(String(r.ad_id)));
        const totalLeads = filteredDeals.reduce((s: number, r: any) => s + (parseInt(r.leads) || 0), 0);
        const totalMqls = filteredDeals.reduce((s: number, r: any) => s + (parseInt(r.mqls) || 0), 0);
        const totalVendas = filteredDeals.reduce((s: number, r: any) => s + (parseInt(r.clientes_unicos) || 0), 0);
        const totalReceita = filteredDeals.reduce((s: number, r: any) => s + (parseFloat(r.receita_total) || 0), 0);

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

      // Validar formato de data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }

      // Condições MQL e filtro de source (mantidos do funil)
      const MQL_COND = `(mql::text = '1' OR LOWER(mql::text) = 'true')`;
      const NMQL_COND = `NOT (mql::text = '1' OR LOWER(mql::text) = 'true')`;
      const SRC_FILTER = `source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')`;

      // Hierarquia: medium → source → campaign → term → content.
      // medium e source são classificados (Constituição UTM, ver constantes no topo);
      // campaign/term/content são os valores crus normalizados (vazio → "(sem ...)").
      const DIM_SELECT = `
        ${MEDIUM_CASE_SQL} as medium,
        ${SOURCE_CANON_SQL} as source,
        COALESCE(NULLIF(TRIM(utm_campaign), ''), '(sem campaign)') as campaign,
        COALESCE(NULLIF(TRIM(utm_term), ''), '(sem term)') as term,
        COALESCE(NULLIF(TRIM(utm_content), ''), '(sem content)') as content`;

      // Query A: leads/MQL/RA/RR por dimensão (janela created_at)
      const dealsResult = await db.execute(sql.raw(`
        SELECT ${DIM_SELECT},
          COUNT(*) as leads,
          SUM(CASE WHEN ${MQL_COND} THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN data_reuniao_agendada IS NOT NULL THEN 1 ELSE 0 END) as ra,
          SUM(CASE WHEN data_reuniao_agendada IS NOT NULL AND ${MQL_COND} THEN 1 ELSE 0 END) as ra_mql,
          SUM(CASE WHEN data_reuniao_agendada IS NOT NULL AND ${NMQL_COND} THEN 1 ELSE 0 END) as ra_nmql,
          SUM(CASE WHEN data_reuniao_realizada IS NOT NULL THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN data_reuniao_realizada IS NOT NULL AND ${MQL_COND} THEN 1 ELSE 0 END) as rr_mql,
          SUM(CASE WHEN data_reuniao_realizada IS NOT NULL AND ${NMQL_COND} THEN 1 ELSE 0 END) as rr_nmql
        FROM "Bitrix".crm_deal
        WHERE created_at >= '${startDate}'::date AND created_at <= '${endDate}'::date + INTERVAL '1 day'
          AND ${SRC_FILTER}
        GROUP BY 1, 2, 3, 4, 5
      `));

      // Query B: vendas/receita/contratos por dimensão (janela data_fechamento)
      const winsResult = await db.execute(sql.raw(`
        SELECT ${DIM_SELECT},
          COUNT(*) as vendas,
          SUM(CASE WHEN ${MQL_COND} THEN 1 ELSE 0 END) as vendas_mql,
          SUM(CASE WHEN ${NMQL_COND} THEN 1 ELSE 0 END) as vendas_nmql,
          COUNT(DISTINCT COALESCE(company_name, contact_name, title)) as clientes_unicos,
          SUM(COALESCE(valor_pontual, 0)) as receita_pontual,
          SUM(COALESCE(valor_recorrente, 0)) as receita_recorrente,
          SUM(CASE WHEN produtos IS NULL OR produtos = '' OR produtos = '[]' THEN 1
            ELSE COALESCE(array_length(string_to_array(REPLACE(REPLACE(produtos, '[', ''), ']', ''), ','), 1), 1) END) as contratos
        FROM "Bitrix".crm_deal
        WHERE data_fechamento >= '${startDate}'::date AND data_fechamento <= '${endDate}'::date
          AND stage_name = 'Negócio Ganho'
          AND ${SRC_FILTER}
        GROUP BY 1, 2, 3, 4, 5
      `));

      // Query C: lead time por dimensão (soma + contagem de clientes p/ agregar bem)
      const leadTimeResult = await db.execute(sql.raw(`
        SELECT medium, source, campaign, term, content,
          SUM(lt) as lt_sum, COUNT(*) as lt_count
        FROM (
          SELECT ${DIM_SELECT},
            COALESCE(company_name, contact_name, title) as cliente,
            MIN(EXTRACT(EPOCH FROM (data_fechamento::timestamp - date_create)) / 86400) as lt
          FROM "Bitrix".crm_deal
          WHERE stage_name = 'Negócio Ganho'
            AND data_fechamento IS NOT NULL
            AND data_fechamento >= '${startDate}'::date AND data_fechamento <= '${endDate}'::date
            AND ${SRC_FILTER}
          GROUP BY 1, 2, 3, 4, 5, cliente
        ) sub
        GROUP BY 1, 2, 3, 4, 5
      `));

      // ---- Acumuladores brutos por folha (medium|source|campaign|term|content) ----
      type Raw = {
        leads: number; mqls: number; ra: number; raMql: number; raNmql: number;
        rr: number; rrMql: number; rrNmql: number;
        vendas: number; vendasMql: number; vendasNmql: number; clientesUnicos: number;
        receitaPontual: number; receitaRecorrente: number; contratos: number;
        investimento: number | null; sessoes: number | null;
        leadTimeSum: number; leadTimeCount: number;
      };
      const emptyRaw = (): Raw => ({
        leads: 0, mqls: 0, ra: 0, raMql: 0, raNmql: 0, rr: 0, rrMql: 0, rrNmql: 0,
        vendas: 0, vendasMql: 0, vendasNmql: 0, clientesUnicos: 0,
        receitaPontual: 0, receitaRecorrente: 0, contratos: 0,
        investimento: null, sessoes: null, leadTimeSum: 0, leadTimeCount: 0,
      });
      const sumN = (a: number | null, b: number | null): number | null =>
        (a === null && b === null) ? null : (a ?? 0) + (b ?? 0);
      const addRaw = (acc: Raw, x: Raw) => {
        acc.leads += x.leads; acc.mqls += x.mqls; acc.ra += x.ra; acc.raMql += x.raMql; acc.raNmql += x.raNmql;
        acc.rr += x.rr; acc.rrMql += x.rrMql; acc.rrNmql += x.rrNmql;
        acc.vendas += x.vendas; acc.vendasMql += x.vendasMql; acc.vendasNmql += x.vendasNmql;
        acc.clientesUnicos += x.clientesUnicos;
        acc.receitaPontual += x.receitaPontual; acc.receitaRecorrente += x.receitaRecorrente; acc.contratos += x.contratos;
        acc.investimento = sumN(acc.investimento, x.investimento); acc.sessoes = sumN(acc.sessoes, x.sessoes);
        acc.leadTimeSum += x.leadTimeSum; acc.leadTimeCount += x.leadTimeCount;
      };

      // Deriva as métricas exibidas a partir dos contadores brutos agregados.
      const deriveMetrics = (r: Raw) => {
        const inv = r.investimento;
        const receita = r.receitaPontual + r.receitaRecorrente;
        return {
          investimento: inv !== null ? Math.round(inv) : null,
          sessoes: r.sessoes !== null ? Math.round(r.sessoes) : null,
          taxaConversao: r.sessoes && r.sessoes > 0 && r.leads > 0 ? parseFloat(((r.leads / r.sessoes) * 100).toFixed(2)) : null,
          leads: r.leads,
          mqls: r.mqls,
          cpl: inv !== null && inv > 0 && r.leads > 0 ? Math.round(inv / r.leads) : null,
          cpmql: inv !== null && inv > 0 && r.mqls > 0 ? Math.round(inv / r.mqls) : null,
          cpra: inv !== null && inv > 0 && r.ra > 0 ? Math.round(inv / r.ra) : null,
          cprr: inv !== null && inv > 0 && r.rr > 0 ? Math.round(inv / r.rr) : null,
          percMql: r.leads > 0 ? parseFloat(((r.mqls / r.leads) * 100).toFixed(1)) : null,
          percRa: r.leads > 0 ? parseFloat(((r.ra / r.leads) * 100).toFixed(1)) : null,
          percRaMql: r.mqls > 0 ? parseFloat(((r.raMql / r.mqls) * 100).toFixed(1)) : null,
          percRaNmql: (r.leads - r.mqls) > 0 ? parseFloat(((r.raNmql / (r.leads - r.mqls)) * 100).toFixed(1)) : null,
          percRr: r.ra > 0 ? parseFloat(((r.rr / r.ra) * 100).toFixed(1)) : null,
          percRrMql: r.raMql > 0 ? parseFloat(((r.rrMql / r.raMql) * 100).toFixed(1)) : null,
          percRrNmql: r.raNmql > 0 ? parseFloat(((r.rrNmql / r.raNmql) * 100).toFixed(1)) : null,
          percRrVendas: r.rr > 0 ? parseFloat(((r.vendas / r.rr) * 100).toFixed(1)) : null,
          percRrMqlVendas: r.rrMql > 0 ? parseFloat(((r.vendasMql / r.rrMql) * 100).toFixed(1)) : null,
          percRrNmqlVendas: r.rrNmql > 0 ? parseFloat(((r.vendasNmql / r.rrNmql) * 100).toFixed(1)) : null,
          negocioGanho: r.vendas,
          leadTime: r.leadTimeCount > 0 ? parseFloat((r.leadTimeSum / r.leadTimeCount).toFixed(1)) : null,
          aov: r.clientesUnicos > 0 ? Math.round(receita / r.clientesUnicos) : null,
          receita: receita > 0 ? Math.round(receita) : null,
          receitaPontual: r.receitaPontual > 0 ? Math.round(r.receitaPontual) : null,
          receitaRecorrente: r.receitaRecorrente > 0 ? Math.round(r.receitaRecorrente) : null,
          cac: inv !== null && inv > 0 && r.clientesUnicos > 0 ? Math.round(inv / r.clientesUnicos) : null,
          cacUnico: inv !== null && inv > 0 && r.clientesUnicos > 0 ? Math.round(inv / r.clientesUnicos) : null,
          cacContrato: inv !== null && inv > 0 && r.contratos > 0 ? Math.round(inv / r.contratos) : null,
        };
      };

      const leafMap = new Map<string, { parts: string[]; raw: Raw }>();
      const leafRaw = (row: any): Raw => {
        const parts = [String(row.medium), String(row.source), String(row.campaign), String(row.term), String(row.content)];
        const k = parts.join('');
        let e = leafMap.get(k);
        if (!e) { e = { parts, raw: emptyRaw() }; leafMap.set(k, e); }
        return e.raw;
      };
      for (const row of dealsResult.rows as any[]) {
        const r = leafRaw(row);
        r.leads += parseInt(row.leads) || 0; r.mqls += parseInt(row.mqls) || 0;
        r.ra += parseInt(row.ra) || 0; r.raMql += parseInt(row.ra_mql) || 0; r.raNmql += parseInt(row.ra_nmql) || 0;
        r.rr += parseInt(row.rr) || 0; r.rrMql += parseInt(row.rr_mql) || 0; r.rrNmql += parseInt(row.rr_nmql) || 0;
      }
      for (const row of winsResult.rows as any[]) {
        const r = leafRaw(row);
        r.vendas += parseInt(row.vendas) || 0; r.vendasMql += parseInt(row.vendas_mql) || 0; r.vendasNmql += parseInt(row.vendas_nmql) || 0;
        r.clientesUnicos += parseInt(row.clientes_unicos) || 0;
        r.receitaPontual += parseFloat(row.receita_pontual) || 0; r.receitaRecorrente += parseFloat(row.receita_recorrente) || 0;
        r.contratos += parseInt(row.contratos) || 0;
      }
      for (const row of leadTimeResult.rows as any[]) {
        const r = leafRaw(row);
        r.leadTimeSum += parseFloat(row.lt_sum) || 0; r.leadTimeCount += parseInt(row.lt_count) || 0;
      }

      // Query 3: Investimento + sessões do Meta Ads
      let metaInvestimento = 0;
      let metaSessoes = 0;
      try {
        const metaResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(spend::numeric), 0) as investimento,
            COALESCE(SUM(landing_page_views), 0) as sessoes
          FROM meta_ads.meta_insights_daily
          WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
            AND account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        `);
        const mr = metaResult.rows[0] as any;
        metaInvestimento = parseFloat(mr?.investimento) || 0;
        metaSessoes = parseInt(mr?.sessoes) || 0;
      } catch (e) {
        console.log("[api] Meta Ads data not available for performance-plataformas");
      }

      // Query 4: Investimento + sessões do Google Ads
      let googleInvestimento = 0;
      let googleSessoes = 0;
      try {
        const columnsResult = await db.execute(sql`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'google' AND table_name = 'campaign_daily_metrics'
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
              COALESCE(SUM(clicks), 0) as sessoes
            FROM google.campaign_daily_metrics
            WHERE ${dateColumn} >= '${startDate}'::date AND ${dateColumn} <= '${endDate}'::date
          `));
          const gr = googleResult.rows[0] as any;
          googleInvestimento = parseFloat(gr?.investimento) || 0;
          googleSessoes = parseInt(gr?.sessoes) || 0;
        }
      } catch (e) {
        console.log("[api] Google Ads data not available for performance-plataformas");
      }

      // ---- Montar árvore: medium → source → campaign → term → content ----
      const MEDIUM_LABELS: Record<string, string> = {
        paid: 'Mídia Paga', organic: 'Orgânico', crm: 'CRM',
        eventos: 'Eventos', referral: 'Referral', outbound: 'Outbound', outros: 'Outros',
      };
      const MEDIUM_ORDER = ['paid', 'organic', 'crm', 'eventos', 'referral', 'outbound', 'outros'];
      const mediumOrderOf = (m: string) => { const i = MEDIUM_ORDER.indexOf(m); return i >= 0 ? i : 998; };
      const sourceLabel = (s: string): string =>
        UTM_SOURCE_LABELS[s]
        || (s === 'direto' ? 'Direto / Sem UTM' : s === 'outros' ? 'Outros' : s.charAt(0).toUpperCase() + s.slice(1));

      type TNode = {
        key: string; name: string; level: 'medium' | 'source' | 'campaign' | 'term' | 'content';
        own: Raw; order: number; children: Map<string, TNode>;
      };
      const SEP = '';
      const makeNode = (key: string, name: string, level: TNode['level'], order: number): TNode =>
        ({ key, name, level, own: emptyRaw(), order, children: new Map() });

      const rootChildren = new Map<string, TNode>();

      // Esqueleto: todos os mediums (exceto "outros") + sources canônicos, mesmo zerados.
      MEDIUM_ORDER.forEach((m, mi) => {
        if (m === 'outros') return;
        const medNode = makeNode(`m${SEP}${m}`, MEDIUM_LABELS[m] || m, 'medium', mi);
        rootChildren.set(m, medNode);
        const canon = (UTM_SOURCES_BY_MEDIUM[m as UtmMedium] || []) as readonly string[];
        canon.forEach((s, si) => {
          medNode.children.set(s, makeNode(`s${SEP}${m}${SEP}${s}`, sourceLabel(s), 'source', si));
        });
      });

      // Inserir folhas reais (cria nós faltantes: sources não-canônicos + campaign/term/content)
      for (const { parts, raw } of Array.from(leafMap.values())) {
        const [m, s, c, t, ct] = parts;
        let medNode = rootChildren.get(m);
        if (!medNode) { medNode = makeNode(`m${SEP}${m}`, MEDIUM_LABELS[m] || m, 'medium', mediumOrderOf(m)); rootChildren.set(m, medNode); }
        let srcNode = medNode.children.get(s);
        if (!srcNode) { srcNode = makeNode(`s${SEP}${m}${SEP}${s}`, sourceLabel(s), 'source', 997); medNode.children.set(s, srcNode); }
        let campNode = srcNode.children.get(c);
        if (!campNode) { campNode = makeNode(`c${SEP}${m}${SEP}${s}${SEP}${c}`, c, 'campaign', 0); srcNode.children.set(c, campNode); }
        let termNode = campNode.children.get(t);
        if (!termNode) { termNode = makeNode(`t${SEP}${m}${SEP}${s}${SEP}${c}${SEP}${t}`, t, 'term', 0); campNode.children.set(t, termNode); }
        let contentNode = termNode.children.get(ct);
        if (!contentNode) { contentNode = makeNode(`x${SEP}${m}${SEP}${s}${SEP}${c}${SEP}${t}${SEP}${ct}`, ct, 'content', 0); termNode.children.set(ct, contentNode); }
        addRaw(contentNode.own, raw);
      }

      // Investimento/sessões de mídia paga entram no nível de source (Meta→facebook, Google→google).
      const injectSpend = (sourceKey: string, investimento: number, sessoes: number) => {
        if (investimento <= 0 && sessoes <= 0) return;
        let medNode = rootChildren.get('paid');
        if (!medNode) { medNode = makeNode(`m${SEP}paid`, MEDIUM_LABELS.paid, 'medium', mediumOrderOf('paid')); rootChildren.set('paid', medNode); }
        let srcNode = medNode.children.get(sourceKey);
        if (!srcNode) { srcNode = makeNode(`s${SEP}paid${SEP}${sourceKey}`, sourceLabel(sourceKey), 'source', 997); medNode.children.set(sourceKey, srcNode); }
        srcNode.own.investimento = (srcNode.own.investimento ?? 0) + investimento;
        srcNode.own.sessoes = (srcNode.own.sessoes ?? 0) + sessoes;
      };
      injectSpend('facebook', metaInvestimento, metaSessoes);
      injectSpend('google', googleInvestimento, googleSessoes);

      // Agregar bottom-up (soma os contadores brutos) e derivar métricas em cada nível.
      const buildNode = (node: TNode): { out: any; agg: Raw } => {
        const agg = emptyRaw();
        addRaw(agg, node.own);
        const built = Array.from(node.children.values()).map((child) => {
          const r = buildNode(child);
          addRaw(agg, r.agg);
          return { child, out: r.out, leads: r.agg.leads };
        });
        built.sort((a, b) => (a.child.order - b.child.order) || (b.leads - a.leads) || a.child.name.localeCompare(b.child.name));
        const out = {
          id: node.key, name: node.name, level: node.level,
          ...deriveMetrics(agg),
          children: built.length ? built.map((b) => b.out) : undefined,
        };
        return { out, agg };
      };

      const mediums = Array.from(rootChildren.values()).map((n) => ({ n, built: buildNode(n) }));
      mediums.sort((a, b) => (a.n.order - b.n.order) || (b.built.agg.leads - a.built.agg.leads));
      const totalRaw = emptyRaw();
      for (const m of mediums) addRaw(totalRaw, m.built.agg);

      const rows = mediums.map((m) => m.built.out);
      const total = { id: 'total', name: 'TOTAL GERAL', level: 'total', ...deriveMetrics(totalRaw) };

      console.log(`[api] Performance Plataformas: ${rows.length} mediums, ${leafMap.size} folhas`);
      res.json({ rows, total });
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

  // Growth - Planejamento de Metas - Copy budgets between Produto×Canal combinations
  app.post("/api/growth/orcado-realizado/budgets/copy-combination", async (req, res) => {
    try {
      const { year, sourceSegmento, sourceFunil, targetSegmento, targetFunil, mode } = req.body;
      if (!year || !sourceSegmento || !sourceFunil || !targetSegmento || !targetFunil) {
        return res.status(400).json({ error: "year, sourceSegmento, sourceFunil, targetSegmento, targetFunil are required" });
      }

      // Percent metric keys (stored as decimals) — used for rates_only mode
      const RATE_KEYS = new Set([
        'ctr', 'percMqls', 'taxaConversaoPagina', 'connectRate',
        'videoHook', 'videoHold', 'videoP75', 'videoP100',
        'percRa', 'percRaMql', 'percRaNmql',
        'percRr', 'percRrMql', 'percRrNmql',
        'percRrVendas', 'percRrMqlVendas', 'percRrNmqlVendas',
        'percReuniaoAgendada', 'percNoShow', 'taxaVendas',
        'txContratosRecorrentes', 'txContratosImplantacao',
        'percPerdaSeguidores', 'percCrescimentoSeguidores',
        'percVisualizacoesOrganicas', 'percVisualizacoesPagas',
        'ctrAlcanceVisitas', 'percEngajamento', 'ctrAlcanceCliques', 'ctrVisitasCliques',
        'ctrImpressoes', 'retencaoMedia', 'taxaEngajamento',
      ]);

      const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

      // Fetch all 12 months from source
      const source = await db.execute(sql`
        SELECT mes, metricas FROM meta_ads.growth_budgets
        WHERE mes = ANY(${months}) AND segmento = ${sourceSegmento} AND funil = ${sourceFunil}
        ORDER BY mes
      `);

      if ((source.rows as any[]).length === 0) {
        return res.status(404).json({ error: `No budgets found for ${sourceSegmento}/${sourceFunil} in ${year}` });
      }

      let copiedCount = 0;
      for (const row of source.rows as any[]) {
        let metricas = row.metricas;

        // Filter to only rate keys if mode is rates_only
        if (mode === 'rates_only') {
          const filtered: Record<string, any> = {};
          for (const [key, value] of Object.entries(metricas)) {
            if (RATE_KEYS.has(key)) {
              filtered[key] = value;
            }
          }
          metricas = filtered;
        }

        if (Object.keys(metricas).length === 0) continue;

        // For rates_only, merge with existing target metrics (don't overwrite volumes)
        if (mode === 'rates_only') {
          const existing = await db.execute(sql`
            SELECT metricas FROM meta_ads.growth_budgets
            WHERE mes = ${row.mes} AND segmento = ${targetSegmento} AND funil = ${targetFunil}
          `);
          const existingMetricas = (existing.rows as any[])[0]?.metricas || {};
          metricas = { ...existingMetricas, ...metricas };
        }

        await db.execute(sql`
          INSERT INTO meta_ads.growth_budgets (mes, segmento, funil, metricas)
          VALUES (${row.mes}, ${targetSegmento}, ${targetFunil}, ${JSON.stringify(metricas)}::jsonb)
          ON CONFLICT (mes, segmento, funil) DO UPDATE SET
            metricas = ${JSON.stringify(metricas)}::jsonb,
            updated_at = NOW()
        `);
        copiedCount++;
      }

      res.json({
        copied: copiedCount,
        mode: mode || 'all',
        from: `${sourceSegmento}/${sourceFunil}`,
        to: `${targetSegmento}/${targetFunil}`,
      });
    } catch (error) {
      console.error("[api] Error copying combination budgets:", error);
      res.status(500).json({ error: "Failed to copy combination budgets" });
    }
  });

  // Growth - Planejamento de Metas - Fetch all 12 months of budgets for a year
  app.get("/api/growth/orcado-realizado/budgets/year", async (req, res) => {
    try {
      const year = (req.query.year as string) || new Date().getFullYear().toString();
      const funil = (req.query.funil as string) || 'todos';

      const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

      const result = await db.execute(sql`
        SELECT mes, segmento, metricas FROM meta_ads.growth_budgets
        WHERE mes = ANY(${sql.raw(`ARRAY[${months.map(m => `'${m}'`).join(',')}]`)}) AND funil = ${funil}
        ORDER BY mes, segmento
      `);

      const byMonth: Record<string, Record<string, any>> = {};
      for (const month of months) {
        byMonth[month] = {};
      }
      for (const row of result.rows as any[]) {
        if (!byMonth[row.mes]) byMonth[row.mes] = {};
        byMonth[row.mes][row.segmento] = row.metricas;
      }

      res.json(byMonth);
    } catch (error) {
      console.error("[api] Error fetching year budgets:", error);
      res.status(500).json({ error: "Failed to fetch year budgets" });
    }
  });

  // Growth - Planejamento de Metas - Bulk set a metric value across multiple months
  app.post("/api/growth/orcado-realizado/budgets/bulk-set", async (req, res) => {
    try {
      const { year, segment, key, value, months, funil } = req.body;
      const funilValue = funil || 'todos';

      if (!year || !segment || !key || value === undefined || !months || !Array.isArray(months)) {
        return res.status(400).json({ error: "year, segment, key, value, and months[] are required" });
      }

      let updated = 0;
      for (const month of months) {
        const mes = `${year}-${String(month).padStart(2, '0')}`;

        // Fetch existing metricas for this month/segment or start empty
        const existing = await db.execute(sql`
          SELECT metricas FROM meta_ads.growth_budgets
          WHERE mes = ${mes} AND segmento = ${segment} AND funil = ${funilValue}
        `);

        const currentMetricas = (existing.rows as any[])[0]?.metricas || {};
        currentMetricas[key] = value;

        await db.execute(sql`
          INSERT INTO meta_ads.growth_budgets (mes, segmento, funil, metricas)
          VALUES (${mes}, ${segment}, ${funilValue}, ${JSON.stringify(currentMetricas)}::jsonb)
          ON CONFLICT (mes, segmento, funil) DO UPDATE SET
            metricas = ${JSON.stringify(currentMetricas)}::jsonb,
            updated_at = NOW()
        `);
        updated++;
      }

      res.json({ updated, segment, key, value });
    } catch (error) {
      console.error("[api] Error bulk-setting budgets:", error);
      res.status(500).json({ error: "Failed to bulk-set budgets" });
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
          AND LOWER(fnl_ngc) NOT IN (
            'cross sell', 'commerce', 'indicação', 'lead',
            'ifv', 'odonto', 'bootcamp vendas', 'bootcamp performance'
          )
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

      // UTM Source filter — usa buildPlatformFilterSql pra incluir Contato IG / Social Selling
      // quando 'instagram' for selecionado (consistente com PLATFORM_CASE_SQL_BASIC).
      const utmSourceParam = req.query.utmSource as string | undefined;
      let utmSourceFilter = sql``;
      if (utmSourceParam && utmSourceParam !== 'todos') {
        const utmValues = utmSourceParam.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
        utmSourceFilter = buildPlatformFilterSql(utmValues);
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

      // 1. Total MQLs = leads criados no período (sempre COUNT, não depende de contagem)
      const totalResult = await db.execute(sql`
        SELECT COUNT(*) as total_mqls
        FROM "Bitrix".crm_deal d
        WHERE d.created_at >= ${startDate}::date
          AND d.created_at < (${endDate}::date + INTERVAL '1 day')
          AND ${mqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 2. Reuniões Agendadas = data_reuniao_agendada no período (sempre COUNT, não depende de contagem)
      const raResult = await db.execute(sql`
        SELECT COUNT(*) as reunioes_agendadas_mql
        FROM "Bitrix".crm_deal d
        WHERE d.data_reuniao_agendada IS NOT NULL
          AND d.data_reuniao_agendada::date >= ${startDate}::date
          AND d.data_reuniao_agendada::date <= ${endDate}::date
          AND ${mqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 3. Reuniões Realizadas = data_reuniao_realizada no período (sempre COUNT, não depende de contagem)
      const rrResult = await db.execute(sql`
        SELECT COUNT(*) as reunioes_realizadas_mql
        FROM "Bitrix".crm_deal d
        WHERE d.data_reuniao_realizada IS NOT NULL
          AND d.data_reuniao_realizada::date >= ${startDate}::date
          AND d.data_reuniao_realizada::date <= ${endDate}::date
          AND ${mqlCondition}
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
          ) THEN valor_pontual ELSE 0 END), 0) as faturamento_implantacao_trafego,
          COUNT(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 END) as deals_ganhos,
          ${sql.raw(`SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN ${prodCountExpr} ELSE 0 END)`)} as contratos_ganhos
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
      const dealsGanhos = parseInt(vRow.deals_ganhos) || 0;
      const contratosGanhos = parseInt(vRow.contratos_ganhos) || 0;

      // Calcular taxas
      const percReuniaoAgendada = totalMqls > 0 ? reunioesAgendadas / totalMqls : 0;
      const percNoShow = reunioesAgendadas > 0 ? (reunioesAgendadas - reunioesRealizadas) / reunioesAgendadas : 0;
      const taxaVendas = reunioesRealizadas > 0 ? dealsGanhos / reunioesRealizadas : 0;
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
        ticketMedioImplantacao,

        // Contagens fixas (sempre retorna ambos, independente do toggle contagem)
        dealsGanhos,
        contratosGanhos,
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

      // UTM Source filter — usa buildPlatformFilterSql pra incluir Contato IG / Social Selling
      // quando 'instagram' for selecionado (consistente com PLATFORM_CASE_SQL_BASIC).
      const utmSourceParam = req.query.utmSource as string | undefined;
      let utmSourceFilter = sql``;
      if (utmSourceParam && utmSourceParam !== 'todos') {
        const utmValues = utmSourceParam.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
        utmSourceFilter = buildPlatformFilterSql(utmValues);
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

      // 1. Total Não-MQLs = leads criados no período (sempre COUNT, não depende de contagem)
      const totalResult = await db.execute(sql`
        SELECT COUNT(*) as total_nao_mqls
        FROM "Bitrix".crm_deal d
        WHERE d.created_at >= ${startDate}::date
          AND d.created_at < (${endDate}::date + INTERVAL '1 day')
          AND ${naoMqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 2. Reuniões Agendadas = data_reuniao_agendada no período (sempre COUNT, não depende de contagem)
      const raResult = await db.execute(sql`
        SELECT COUNT(*) as reunioes_agendadas
        FROM "Bitrix".crm_deal d
        WHERE d.data_reuniao_agendada IS NOT NULL
          AND d.data_reuniao_agendada::date >= ${startDate}::date
          AND d.data_reuniao_agendada::date <= ${endDate}::date
          AND ${naoMqlCondition}
          ${inboundFilter}
          ${funilFilter}
          ${utmSourceFilter}
      `);

      // 3. Reuniões Realizadas = data_reuniao_realizada no período (sempre COUNT, não depende de contagem)
      const rrResult = await db.execute(sql`
        SELECT COUNT(*) as reunioes_realizadas
        FROM "Bitrix".crm_deal d
        WHERE d.data_reuniao_realizada IS NOT NULL
          AND d.data_reuniao_realizada::date >= ${startDate}::date
          AND d.data_reuniao_realizada::date <= ${endDate}::date
          AND ${naoMqlCondition}
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
          ) THEN valor_pontual ELSE 0 END), 0) as faturamento_implantacao_trafego,
          COUNT(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 END) as deals_ganhos,
          ${sql.raw(`SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN ${prodCountExpr} ELSE 0 END)`)} as contratos_ganhos
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
      const dealsGanhos = parseInt(vRow.deals_ganhos) || 0;
      const contratosGanhos = parseInt(vRow.contratos_ganhos) || 0;

      // Calcular taxas
      const percReuniaoAgendada = totalNaoMqls > 0 ? reunioesAgendadas / totalNaoMqls : 0;
      const percNoShow = reunioesAgendadas > 0 ? (reunioesAgendadas - reunioesRealizadas) / reunioesAgendadas : 0;
      const taxaVendas = reunioesRealizadas > 0 ? dealsGanhos / reunioesRealizadas : 0;
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
        ticketMedioImplantacao,

        // Contagens fixas (sempre retorna ambos, independente do toggle contagem)
        dealsGanhos,
        contratosGanhos,
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
          EXTRACT(ISOYEAR FROM d.data_reuniao_realizada::date)::int as ano,
          EXTRACT(WEEK FROM d.data_reuniao_realizada::date)::int as semana_num,
          TO_CHAR(MIN(d.data_reuniao_realizada::date), 'Mon') as mes_label,
          COUNT(CASE WHEN (d.mql::text = '1' OR LOWER(d.mql::text) = 'true')
            THEN 1 END) as rr_mql,
          COUNT(CASE WHEN (d.mql::text IS NULL OR d.mql::text = '' OR d.mql::text = '0' OR LOWER(d.mql::text) = 'false')
            THEN 1 END) as rr_nao_mql,
          COUNT(*) as rr_total
        FROM "Bitrix".crm_deal d
        WHERE d.data_reuniao_realizada IS NOT NULL
          AND d.data_reuniao_realizada::date >= ${startDate}::date
          AND d.data_reuniao_realizada::date <= ${endDate}::date
          AND d.source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
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

      // Parse utmSource filter (comma-separated). Empty/'todos' means "all platforms".
      const utmSourceParam = req.query.utmSource as string | undefined;
      const utmValues = utmSourceParam && utmSourceParam !== 'todos'
        ? utmSourceParam.split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
        : [];
      const includeMeta = utmValues.length === 0
        || utmValues.some(v => v.includes('facebook') || v === 'meta' || v.includes('instagram') || v === 'ig' || v === 'fb');
      const includeGoogle = utmValues.length === 0
        || utmValues.some(v => v.includes('google') || v.includes('adwords') || v === 'gads');

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

      // Query Meta Ads (skip when platform filter excludes Meta)
      let metaInvestimento = 0;
      let metaImpressoes = 0;
      let metaCliques = 0;
      let cliquesSaida = 0;
      let visualizacoesPagina = 0;
      if (includeMeta) {
        const metaResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(mid.spend), 0) as investimento,
            COALESCE(SUM(mid.impressions), 0) as impressoes,
            COALESCE(SUM(mid.clicks), 0) as cliques,
            COALESCE(SUM(mid.outbound_clicks), 0) as cliques_saida,
            COALESCE(SUM(mid.landing_page_views), 0) as visualizacoes_pagina
          FROM meta_ads.meta_insights_daily mid
          WHERE mid.date_start >= ${startDate}::date
            AND mid.date_start <= ${endDate}::date
            AND mid.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
            ${campaignFilter}
        `);
        const metaRow = metaResult.rows[0] as any;
        metaInvestimento = parseFloat(metaRow.investimento) || 0;
        metaImpressoes = parseInt(metaRow.impressoes) || 0;
        metaCliques = parseInt(metaRow.cliques) || 0;
        cliquesSaida = parseInt(metaRow.cliques_saida) || 0;
        visualizacoesPagina = parseInt(metaRow.visualizacoes_pagina) || 0;
      }

      // Query Google Ads (skip when platform filter excludes Google).
      // Funnel filter aplicado via JOIN com google.campaigns parsing do c.name
      // (mesmo padrão `[NomeFunil]` usado em Meta).
      let googleInvestimento = 0;
      let googleImpressoes = 0;
      let googleCliques = 0;
      if (!includeGoogle) {
        // Skip Google Ads when platform filter excludes Google
      } else try {
        const columnsResult = await db.execute(sql`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'google' AND table_name = 'campaign_daily_metrics'
          ORDER BY ordinal_position
        `);
        const columns = columnsResult.rows.map((r: any) => r.column_name);
        const dateColumn = columns.includes('report_date') ? 'report_date' :
                           columns.includes('metric_date') ? 'metric_date' :
                           columns.includes('date') ? 'date' :
                           columns.includes('segments_date') ? 'segments_date' : null;

        if (dateColumn && columns.includes('cost_micros')) {
          // Build funnel filter for Google (parse c.name by [NomeFunil])
          let googleFunnelFilter = '';
          const escape = (v: string) => v.replace(/'/g, "''");
          if (realFunilValues.length > 0) {
            const conds = realFunilValues
              .map(v => `c.name ILIKE '%[${escape(v)}]%' OR c.name ILIKE '%${escape(v)}%'`)
              .join(' OR ');
            let inner = `(${conds})`;
            if (hasVazio) {
              inner = `(${inner} OR c.name NOT LIKE '%[%]%')`;
            }
            googleFunnelFilter = `AND m.campaign_id IN (SELECT campaign_id FROM google.campaigns c WHERE ${inner})`;
          } else if (hasVazio) {
            googleFunnelFilter = `AND m.campaign_id IN (SELECT campaign_id FROM google.campaigns c WHERE c.name NOT LIKE '%[%]%')`;
          }

          const googleResult = await db.execute(sql.raw(`
            SELECT
              COALESCE(SUM(cost_micros) / 1000000.0, 0) as investimento,
              COALESCE(SUM(impressions), 0) as impressoes,
              COALESCE(SUM(clicks), 0) as cliques
            FROM google.campaign_daily_metrics m
            WHERE ${dateColumn} >= '${startDate}'::date AND ${dateColumn} <= '${endDate}'::date
              ${googleFunnelFilter}
          `));
          const gRow = googleResult.rows[0] as any;
          googleInvestimento = parseFloat(gRow.investimento) || 0;
          googleImpressoes = parseInt(gRow.impressoes) || 0;
          googleCliques = parseInt(gRow.cliques) || 0;
        }
      } catch (googleError) {
        console.log("[api] Google Ads query error in orcado-realizado/ads (may not have data):", googleError);
      }

      // Cliques de saída consolidados: Meta outbound_clicks + Google clicks
      // (Google clicks são cliques no anúncio que levam à LP — equivalente a outbound).
      if (includeGoogle) {
        cliquesSaida += googleCliques;
      }

      // Combine Meta + Google
      const investimento = metaInvestimento + googleInvestimento;
      const impressoes = metaImpressoes + googleImpressoes;
      const cliques = metaCliques + googleCliques;
      const cpm = impressoes > 0 ? (investimento / impressoes * 1000) : 0;
      // CTR de saída = cliques_saida / impressões (Meta outbound_clicks + Google clicks).
      // Padrão da casa — alinhado com Criativos e Aprofundado por plataforma.
      const ctr = impressoes > 0 ? (cliquesSaida / impressoes) : 0;

      // CPS = Custo por Sessão (Investimento / Visualizações de Página)
      const cps = visualizacoesPagina > 0 ? investimento / visualizacoesPagina : 0;
      // Connect Rate = Visualizações de Página / Cliques de Saída (Meta Pixel only — semântica preservada)
      const connectRate = cliquesSaida > 0 ? visualizacoesPagina / cliquesSaida : 0;

      // Sessões (GA4) — métrica universal de chegada na LP cobrindo Meta + Google + orgânico.
      // Filtro de funil aplicado via sessionCampaignName contains [NomeFunil].
      const ga4 = await getSessionsByPlatform(
        new Date(startDate),
        new Date(endDate),
        realFunilValues.length > 0 ? { utmCampaignContains: realFunilValues } : undefined,
      );
      let sessoes = 0;
      if (includeMeta && includeGoogle) {
        sessoes = ga4.total;
      } else if (includeMeta) {
        sessoes = ga4.byPlatform.meta_ads;
      } else if (includeGoogle) {
        sessoes = ga4.byPlatform.google_ads;
      }

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

      // Leads e MQLs em Ads são sempre COUNT (não dependem de contagem contrato/cliente)

      // Filtros ortogonais: o universo base é "todo lead inbound" (source IN ...).
      // Cada filtro selecionado na UI estreita uma dimensão independente:
      //   - funilFilter (produto)  → estreita por fnl_ngc do Bitrix
      //   - utmSourceFilter (plataforma) → estreita por utm_source LIKE
      // Sem filtro = universo completo. Sem switch de semântica.
      let utmSourceFilter = sql``;
      if (utmValues.length === 1) {
        utmSourceFilter = sql`AND LOWER(d.utm_source) LIKE ${utmValues[0] + '%'}`;
      } else if (utmValues.length > 1) {
        utmSourceFilter = sql`AND (${sql.join(utmValues.map(v => sql`LOWER(d.utm_source) LIKE ${v + '%'}`), sql` OR `)})`;
      }

      const leadsResult = await db.execute(sql`
        SELECT
          COUNT(*) as total_leads,
          COUNT(CASE WHEN d.mql::text = '1' OR LOWER(d.mql::text) = 'true' THEN 1 END) as total_mqls
        FROM "Bitrix".crm_deal d
        WHERE d.created_at >= ${startDate}::date
          AND d.created_at <= ${endDate}::date + INTERVAL '1 day'
          AND d.source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
          ${funilFilter}
          ${utmSourceFilter}
      `);

      const leadsRow = leadsResult.rows[0] as any;
      const leads = parseInt(leadsRow.total_leads) || 0;
      const mqls = parseInt(leadsRow.total_mqls) || 0;

      // RA por data_reuniao_agendada e RR por data_reuniao_realizada (event-time).
      // Necessário pra calcular CPRA = investimento/RA e CPRR = investimento/RR.
      const raResult = await db.execute(sql`
        SELECT
          COUNT(*) as total_ra,
          COUNT(CASE WHEN d.mql::text = '1' OR LOWER(d.mql::text) = 'true' THEN 1 END) as ra_mql,
          COUNT(CASE WHEN NOT (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 END) as ra_nmql
        FROM "Bitrix".crm_deal d
        WHERE d.data_reuniao_agendada IS NOT NULL
          AND d.data_reuniao_agendada::date >= ${startDate}::date
          AND d.data_reuniao_agendada::date <= ${endDate}::date
          AND d.source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
          ${funilFilter}
          ${utmSourceFilter}
      `);
      const rrResult = await db.execute(sql`
        SELECT
          COUNT(*) as total_rr,
          COUNT(CASE WHEN d.mql::text = '1' OR LOWER(d.mql::text) = 'true' THEN 1 END) as rr_mql,
          COUNT(CASE WHEN NOT (d.mql::text = '1' OR LOWER(d.mql::text) = 'true') THEN 1 END) as rr_nmql
        FROM "Bitrix".crm_deal d
        WHERE d.data_reuniao_realizada IS NOT NULL
          AND d.data_reuniao_realizada::date >= ${startDate}::date
          AND d.data_reuniao_realizada::date <= ${endDate}::date
          AND d.source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
          ${funilFilter}
          ${utmSourceFilter}
      `);
      const raRow = raResult.rows[0] as any;
      const rrRow = rrResult.rows[0] as any;
      const ra = parseInt(raRow.total_ra) || 0;
      const raMql = parseInt(raRow.ra_mql) || 0;
      const raNmql = parseInt(raRow.ra_nmql) || 0;
      const rr = parseInt(rrRow.total_rr) || 0;
      const rrMql = parseInt(rrRow.rr_mql) || 0;
      const rrNmql = parseInt(rrRow.rr_nmql) || 0;

      // Quando o filtro é EXATAMENTE Instagram (sozinho), não atribuímos investimento
      // pago à plataforma — gasto agregado fica na seção "Meta Ads". Visualizações/Alcance
      // pagos do IG continuam aparecendo nos cards específicos do Instagram.
      const utmValuesNorm = (utmSourceParam || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
      const onlyInstagram = utmValuesNorm.length === 1 && utmValuesNorm[0] === 'instagram';
      const investimentoExposto = onlyInstagram ? 0 : investimento;
      const impressoesExposto = onlyInstagram ? 0 : impressoes;
      const cliquesExposto = onlyInstagram ? 0 : cliques;
      const cliquesSaidaExposto = onlyInstagram ? 0 : cliquesSaida;
      const cpmExposto = onlyInstagram ? 0 : cpm;
      const ctrExposto = onlyInstagram ? 0 : ctr;
      const cpsExposto = onlyInstagram ? 0 : cps;
      const connectRateExposto = onlyInstagram ? 0 : connectRate;
      const visualizacoesPaginaExposto = onlyInstagram ? 0 : visualizacoesPagina;
      const sessoesExposto = onlyInstagram ? 0 : sessoes;
      const cpl = onlyInstagram ? 0 : (leads > 0 ? investimento / leads : 0);
      const cpmql = onlyInstagram ? 0 : (mqls > 0 ? investimento / mqls : 0);
      const percMqls = leads > 0 ? (mqls / leads) : 0;
      // CPRA = invest / RA; CPRR = invest / RR. Null quando RA/RR=0 ou invest=0.
      const cpra = onlyInstagram || ra === 0 || investimento === 0 ? null : investimento / ra;
      const cpraMql = onlyInstagram || raMql === 0 || investimento === 0 ? null : investimento / raMql;
      const cpraNmql = onlyInstagram || raNmql === 0 || investimento === 0 ? null : investimento / raNmql;
      const cprr = onlyInstagram || rr === 0 || investimento === 0 ? null : investimento / rr;
      const cprrMql = onlyInstagram || rrMql === 0 || investimento === 0 ? null : investimento / rrMql;
      const cprrNmql = onlyInstagram || rrNmql === 0 || investimento === 0 ? null : investimento / rrNmql;

      res.json({
        investimento: investimentoExposto,
        impressoes: impressoesExposto,
        cliques: cliquesExposto,
        cliquesSaida: cliquesSaidaExposto,
        cpm: cpmExposto,
        ctr: ctrExposto,
        cps: cpsExposto,
        connectRate: connectRateExposto,
        visualizacoesPagina: visualizacoesPaginaExposto,
        sessoes: sessoesExposto,
        sessoesAvailable: ga4.available,
        leads,
        mqls,
        cpl,
        cpmql,
        percMqls,
        ra, raMql, raNmql,
        rr, rrMql, rrNmql,
        cpra, cpraMql, cpraNmql,
        cprr, cprrMql, cprrNmql,
      });
    } catch (error) {
      console.error("[api] Error fetching Ads metrics:", error);
      res.status(500).json({ error: "Failed to fetch Ads metrics" });
    }
  });

  // ===== Endpoints por Plataforma para Gestão de Metas Aprofundado =====

  // Meta Ads - métricas de topo de funil específicas
  app.get("/api/growth/orcado-realizado/meta-ads", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      // Platform filter: if utmSource is set and excludes Meta-compatible platforms, return zeros
      const utmSourceParam = req.query.utmSource as string | undefined;
      const utmValues = utmSourceParam && utmSourceParam !== 'todos'
        ? utmSourceParam.split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
        : [];
      const includeMeta = utmValues.length === 0
        || utmValues.some(v => v.includes('facebook') || v === 'meta' || v.includes('instagram') || v === 'ig' || v === 'fb');
      if (!includeMeta) {
        return res.json({
          investimento: 0, impressoes: 0, alcance: 0, frequencia: 0,
          cpm: 0, ctr: 0, videoHook: null, videoHold: null,
          visualizacoesPagina: 0, connectRate: 0,
          sessoes: 0, sessoesAvailable: false,
        });
      }

      const funilNgcRaw = req.query.funilNgc as string | undefined;
      const funilValues = funilNgcRaw
        ? funilNgcRaw.split(',').map(v => decodeURIComponent(v).trim()).filter(Boolean)
        : [];
      const hasVazio = funilValues.includes('(Vazio)');
      const realFunilValues = expandFunilValues(funilValues.filter(v => v !== '(Vazio)'));

      let campaignFilter = sql``;
      if (realFunilValues.length > 0) {
        const nameConditions = realFunilValues.map(v => sql`(c.campaign_name ILIKE ${'%[' + v + ']%'} OR c.campaign_name ILIKE ${'%' + v + '%'})`);
        let nameFilter = sql.join(nameConditions, sql` OR `);
        if (hasVazio) {
          nameFilter = sql`(${nameFilter} OR c.campaign_name NOT LIKE '%[%]%')`;
        }
        campaignFilter = sql`AND mid.campaign_id IN (
          SELECT DISTINCT c.campaign_id::text FROM meta_ads.meta_campaigns c WHERE (${nameFilter})
        )`;
      } else if (hasVazio) {
        campaignFilter = sql`AND mid.campaign_id IN (
          SELECT DISTINCT c.campaign_id::text FROM meta_ads.meta_campaigns c WHERE c.campaign_name NOT LIKE '%[%]%'
        )`;
      }

      const metaResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(mid.spend), 0) as investimento,
          COALESCE(SUM(mid.impressions), 0) as impressoes,
          COALESCE(SUM(mid.clicks), 0) as cliques,
          COALESCE(SUM(mid.outbound_clicks), 0) as cliques_saida,
          COALESCE(SUM(mid.landing_page_views), 0) as visualizacoes_pagina,
          COALESCE(SUM(mid.reach), 0) as alcance,
          COALESCE(AVG(mid.frequency), 0) as frequencia,
          COALESCE(SUM(mid.video_p25_watched_actions), 0) as video_p25,
          COALESCE(SUM(mid.video_p50_watched_actions), 0) as video_p50,
          COALESCE(SUM(mid.video_p75_watched_actions), 0) as video_p75,
          COALESCE(SUM(mid.video_play_actions), 0) as video_plays,
          COALESCE(SUM(mid.video_3_sec_watched_actions), 0) as video_3sec,
          COALESCE(SUM(mid.video_thruplay_watched_actions), 0) as video_thruplay
        FROM meta_ads.meta_insights_daily mid
        WHERE mid.date_start >= ${startDate}::date
          AND mid.date_start <= ${endDate}::date
          AND mid.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
          ${campaignFilter}
      `);

      const row = metaResult.rows[0] as any;
      const investimento = parseFloat(row.investimento) || 0;
      const impressoes = parseInt(row.impressoes) || 0;
      const cliquesSaida = parseInt(row.cliques_saida) || 0;
      const landingPageViewsPixel = parseInt(row.visualizacoes_pagina) || 0;
      const alcance = parseInt(row.alcance) || 0;
      const frequencia = parseFloat(row.frequencia) || 0;
      const video3Sec = parseInt(row.video_3sec) || 0;
      const videoThruplay = parseInt(row.video_thruplay) || 0;

      const cpm = impressoes > 0 ? (investimento / impressoes * 1000) : 0;
      // CTR de saída = outbound_clicks / impressions
      const ctr = impressoes > 0 ? (cliquesSaida / impressoes) : 0;
      // Connect Rate pelo pixel (legado, mantido só p/ comparação)
      const connectRatePixel = cliquesSaida > 0 ? landingPageViewsPixel / cliquesSaida : 0;
      // Vídeo Hook = video_3_sec_watched_actions / impressões (actions[].video_view, 3+ seg)
      // Vídeo Hold = video_thruplay_watched_actions / impressões
      // Escala 0–100 — alinhada com o endpoint de Criativos.
      const videoHook = impressoes > 0 && video3Sec > 0 ? (video3Sec / impressoes) * 100 : null;
      const videoHold = impressoes > 0 && videoThruplay > 0 ? (videoThruplay / impressoes) * 100 : null;

      const ga4 = await getSessionsByPlatform(
        new Date(startDate),
        new Date(endDate),
        realFunilValues.length > 0 ? { utmCampaignContains: realFunilValues } : undefined,
      );
      const sessoes = ga4.byPlatform.meta_ads;
      // Padrão GA4 (igual aos outros canais): Viz Página = page views GA4,
      // Connect Rate = Sessões ÷ cliques de saída.
      const visualizacoesPagina = ga4.byPlatformPageViews.meta_ads;
      const connectRate = cliquesSaida > 0 ? sessoes / cliquesSaida : 0;

      res.json({
        investimento,
        impressoes,
        alcance,
        frequencia,
        cpm,
        ctr,
        videoHook,
        videoHold,
        visualizacoesPagina,
        connectRate,
        sessoes,
        sessoesAvailable: ga4.available,
        // Comparação: valores antigos pelo pixel Meta (p/ avaliar o impacto da migração)
        visualizacoesPaginaPixel: landingPageViewsPixel,
        connectRatePixel,
      });
    } catch (error) {
      console.error("[api] Error fetching Meta Ads metrics:", error);
      res.status(500).json({ error: "Failed to fetch Meta Ads metrics" });
    }
  });

  // Google Ads - métricas de topo de funil específicas
  app.get("/api/growth/orcado-realizado/google-ads", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      // Platform filter: if utmSource is set and excludes Google, return zeros
      const utmSourceParam = req.query.utmSource as string | undefined;
      const utmValues = utmSourceParam && utmSourceParam !== 'todos'
        ? utmSourceParam.split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
        : [];
      const includeGoogle = utmValues.length === 0
        || utmValues.some(v => v.includes('google') || v.includes('adwords') || v === 'gads');

      // Funnel filter — Google Ads usa o mesmo padrão `[NomeFunil]` no `c.name`
      // que o Meta. Parseamos via JOIN com google.campaigns.
      const funilNgcRaw = req.query.funilNgc as string | undefined;
      const funilValues = funilNgcRaw
        ? funilNgcRaw.split(',').map(v => decodeURIComponent(v).trim()).filter(Boolean)
        : [];
      const hasVazio = funilValues.includes('(Vazio)');
      const realFunilValues = expandFunilValues(funilValues.filter(v => v !== '(Vazio)'));

      const zeroResponse = {
        investimento: 0, impressoes: 0, cliques: 0,
        cpm: 0, cpc: 0, ctr: 0,
        visualizacoesPagina: 0, connectRate: 0,
        conversoes: 0, valorConversoes: 0, custoConversao: 0,
        sessoes: 0, sessoesAvailable: false,
      };
      if (!includeGoogle) {
        return res.json(zeroResponse);
      }

      let investimento = 0;
      let impressoes = 0;
      let cliques = 0;
      let conversoes = 0;
      let valorConversoes = 0;

      try {
        const columnsResult = await db.execute(sql`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'google' AND table_name = 'campaign_daily_metrics'
          ORDER BY ordinal_position
        `);
        const columns = columnsResult.rows.map((r: any) => r.column_name);
        const dateColumn = columns.includes('report_date') ? 'report_date' :
                           columns.includes('metric_date') ? 'metric_date' :
                           columns.includes('date') ? 'date' :
                           columns.includes('segments_date') ? 'segments_date' : null;

        if (dateColumn && columns.includes('cost_micros')) {
          const hasConversions = columns.includes('conversions');
          const hasConversionsValue = columns.includes('conversions_value');

          // Build funnel filter for Google (parse c.name by [NomeFunil])
          let googleFunnelFilter = '';
          const escape = (v: string) => v.replace(/'/g, "''");
          if (realFunilValues.length > 0) {
            const conds = realFunilValues
              .map(v => `c.name ILIKE '%[${escape(v)}]%' OR c.name ILIKE '%${escape(v)}%'`)
              .join(' OR ');
            let inner = `(${conds})`;
            if (hasVazio) {
              inner = `(${inner} OR c.name NOT LIKE '%[%]%')`;
            }
            googleFunnelFilter = `AND m.campaign_id IN (SELECT campaign_id FROM google.campaigns c WHERE ${inner})`;
          } else if (hasVazio) {
            googleFunnelFilter = `AND m.campaign_id IN (SELECT campaign_id FROM google.campaigns c WHERE c.name NOT LIKE '%[%]%')`;
          }

          const googleResult = await db.execute(sql.raw(`
            SELECT
              COALESCE(SUM(cost_micros) / 1000000.0, 0) as investimento,
              COALESCE(SUM(impressions), 0) as impressoes,
              COALESCE(SUM(clicks), 0) as cliques
              ${hasConversions ? ', COALESCE(SUM(conversions), 0) as conversoes' : ''}
              ${hasConversionsValue ? ', COALESCE(SUM(conversions_value), 0) as valor_conversoes' : ''}
            FROM google.campaign_daily_metrics m
            WHERE ${dateColumn} >= '${startDate}'::date AND ${dateColumn} <= '${endDate}'::date
              ${googleFunnelFilter}
          `));
          const gRow = googleResult.rows[0] as any;
          investimento = parseFloat(gRow.investimento) || 0;
          impressoes = parseInt(gRow.impressoes) || 0;
          cliques = parseInt(gRow.cliques) || 0;
          conversoes = hasConversions ? (parseFloat(gRow.conversoes) || 0) : 0;
          valorConversoes = hasConversionsValue ? (parseFloat(gRow.valor_conversoes) || 0) : 0;
        }
      } catch (googleError) {
        console.log("[api] Google Ads query error:", googleError);
      }

      const cpm = impressoes > 0 ? (investimento / impressoes * 1000) : 0;
      const cpc = cliques > 0 ? (investimento / cliques) : 0;
      const ctr = impressoes > 0 ? (cliques / impressoes) : 0;
      const custoConversao = conversoes > 0 ? (investimento / conversoes) : 0;

      // Sessões + page views GA4 do tráfego Google (sessionSource=google + medium cpc)
      const ga4 = await getSessionsByPlatform(new Date(startDate), new Date(endDate));
      const sessoes = ga4.byPlatform.google_ads;
      // Padrão GA4 (igual aos outros canais)
      const visualizacoesPagina = ga4.byPlatformPageViews.google_ads;
      const connectRate = cliques > 0 ? sessoes / cliques : 0;

      res.json({
        investimento,
        impressoes,
        cliques,
        cpm,
        cpc,
        ctr,
        visualizacoesPagina,
        connectRate,
        conversoes,
        valorConversoes,
        custoConversao,
        sessoes,
        sessoesAvailable: ga4.available,
      });
    } catch (error) {
      console.error("[api] Error fetching Google Ads metrics:", error);
      res.status(500).json({ error: "Failed to fetch Google Ads metrics" });
    }
  });

  // Instagram - métricas de topo de funil específicas
  app.get("/api/growth/orcado-realizado/instagram", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      // Find all active Instagram connections (may be >1: e.g. test + production)
      const connections = await db.execute(sql`
        SELECT id FROM cortex_core.instagram_connections WHERE is_active = true
      `);
      const emptyPayload = {
        postsPublicados: 0,
        comecaramSeguir: 0, deixaramSeguir: 0, percPerdaSeguidores: 0,
        deltaSeguidores: 0, totalSeguidores: 0, percCrescimentoSeguidores: 0,
        visualizacoesTotais: 0, percVisualizacoesOrganicas: 0, visualizacoesOrganicas: 0,
        percVisualizacoesPagas: 0, visualizacoesPagas: 0,
        alcanceTotal: 0, alcanceOrganico: 0, alcancePago: 0,
        frequenciaAlcance: 0, ctrAlcanceVisitas: 0, visitasPerfil: 0,
        percEngajamento: 0, interacoes: 0, ctrAlcanceCliques: 0,
        ctrVisitasCliques: 0, cliquesLinkBio: 0,
        leadsPorOrigem: [] as Array<{ origem: string; label: string; leads: number; mqls: number; negocioGanho: number; receita: number }>,
        investimentoPago: 0,
      };
      if (connections.rows.length === 0) {
        return res.json({ ...emptyPayload, hasConnection: false, snapshotCount: 0 });
      }
      const connectionIds = connections.rows.map((r: any) => r.id);

      // Snapshots for the period across all active connections
      const snapshotsResult = await db.execute(sql`
        SELECT metric_date, followers, reach_day, impressions_day,
               COALESCE(follows_day, 0) as follows_day,
               COALESCE(unfollows_day, 0) as unfollows_day,
               COALESCE(total_interactions, 0) as total_interactions,
               COALESCE(profile_links_taps, 0) as profile_links_taps,
               COALESCE(profile_views, 0) as profile_views,
               COALESCE(website_clicks, 0) as website_clicks,
               COALESCE(accounts_engaged, 0) as accounts_engaged
        FROM cortex_core.instagram_metrics_snapshots
        WHERE connection_id IN (${sql.join(connectionIds.map((id: any) => sql`${id}`), sql`, `)})
          AND metric_date >= ${startDate}::date
          AND metric_date <= ${endDate}::date
        ORDER BY metric_date ASC
      `);

      const snapshots = snapshotsResult.rows as any[];

      // Follower deltas from follows_day (net value from Instagram API follows_and_unfollows)
      // Positive = more follows than unfollows, negative = more unfollows
      let comecaramSeguir = 0;
      let deixaramSeguir = 0;
      for (const snap of snapshots) {
        const fd = parseInt(snap.follows_day) || 0;
        if (fd > 0) comecaramSeguir += fd;
        if (fd < 0) deixaramSeguir += Math.abs(fd);
      }
      // Fallback: if follows_day is all zeros, infer from follower count diffs
      if (comecaramSeguir === 0 && deixaramSeguir === 0 && snapshots.length > 1) {
        for (let i = 1; i < snapshots.length; i++) {
          const delta = (parseInt(snapshots[i].followers) || 0) - (parseInt(snapshots[i - 1].followers) || 0);
          if (delta > 0) comecaramSeguir += delta;
          if (delta < 0) deixaramSeguir += Math.abs(delta);
        }
      }

      const firstFollowers = snapshots.length > 0 ? (parseInt(snapshots[0].followers) || 0) : 0;
      const lastFollowers = snapshots.length > 0 ? (parseInt(snapshots[snapshots.length - 1].followers) || 0) : 0;
      const deltaSeguidores = lastFollowers - firstFollowers;
      const percCrescimentoSeguidores = firstFollowers > 0 ? deltaSeguidores / firstFollowers : 0;
      const percPerdaSeguidores = (comecaramSeguir + deixaramSeguir) > 0
        ? deixaramSeguir / (comecaramSeguir + deixaramSeguir) : 0;

      // Aggregate metrics from snapshots
      const visualizacoesTotais = snapshots.reduce((s, r) => s + (parseInt(r.impressions_day) || 0), 0);
      const alcanceTotal = snapshots.reduce((s, r) => s + (parseInt(r.reach_day) || 0), 0);
      // profile_views is deprecated in IG API v22+, use accounts_engaged as proxy
      const visitasPerfil = snapshots.reduce((s, r) => s + (parseInt(r.profile_views) || parseInt(r.accounts_engaged) || 0), 0);
      // Cliques no link da bio: prioridade GA4 do Linktree (host=linktr.ee, event=click)
      // — porque o Linktree não tem API pública e profile_links_taps do Instagram tem
      // limitações no histórico. Fallback: profile_links_taps / website_clicks.
      const igLinkTapsFallback = snapshots.reduce(
        (s, r) => s + (parseInt(r.profile_links_taps) || parseInt(r.website_clicks) || 0),
        0,
      );
      const linktreePropertyId = process.env.LINKTREE_GA4_PROPERTY_ID || "";
      let cliquesLinkBio = igLinkTapsFallback;
      let cliquesLinkBioFonte: "linktree_ga4" | "instagram_profile_taps" = "instagram_profile_taps";
      let cliquesPorLink: Array<{ linkUrl: string; linkDomain: string; clicks: number }> = [];
      let cliquesPorDominio: Array<{ domain: string; clicks: number }> = [];
      if (linktreePropertyId) {
        const linktreeMetrics = await getLinktreeMetrics(
          linktreePropertyId,
          new Date(`${startDate}T00:00:00Z`),
          new Date(`${endDate}T23:59:59Z`),
        );
        if (linktreeMetrics.available) {
          cliquesLinkBio = linktreeMetrics.totalClicks;
          cliquesLinkBioFonte = "linktree_ga4";
          cliquesPorLink = linktreeMetrics.byLink;
          cliquesPorDominio = linktreeMetrics.byDomain;
        }
      }
      // Use account-level total_interactions from snapshots (more accurate than post-level)
      const interacoes = snapshots.reduce((s, r) => s + (parseInt(r.total_interactions) || 0), 0);

      // Visualizações/Alcance pagos: tudo que veio do pago Meta no IG (qualquer objetivo).
      // Investimento pago NÃO é atribuído ao Instagram aqui — gasto agregado fica na seção
      // "Meta Ads" do dashboard, FB+IG juntos.
      let visualizacoesPagas = 0;
      let alcancePago = 0;
      const investimentoPago = 0;
      try {
        const metaIgResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(impressions), 0) as impressoes_pagas,
            COALESCE(SUM(reach), 0) as alcance_pago
          FROM meta_ads.meta_insights_by_platform_daily
          WHERE date_start >= ${startDate}::date
            AND date_start <= ${endDate}::date
            AND account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
            AND publisher_platform = 'instagram'
        `);
        const mRow = metaIgResult.rows[0] as any;
        visualizacoesPagas = parseInt(mRow.impressoes_pagas) || 0;
        alcancePago = parseInt(mRow.alcance_pago) || 0;
      } catch (err: any) {
        console.warn("[orcado-realizado/instagram] meta_insights_by_platform_daily query failed:", err?.message || err);
      }

      // Guard: o "views" da Graph API IG inclui ad impressions, então o Total deveria ser
      // >= Pago. Se vier menor, é sinal de snapshot incompleto (sync histórico ainda não
      // populou todos os dias) — clampar Total = Pago pra evitar % > 100% e Orgânico negativo.
      // Após rodar o backfill (~90 dias), os números convergem naturalmente.
      const visualizacoesTotaisAjustado = Math.max(visualizacoesTotais, visualizacoesPagas);
      const alcanceTotalAjustado = Math.max(alcanceTotal, alcancePago);
      const visualizacoesOrganicas = Math.max(0, visualizacoesTotaisAjustado - visualizacoesPagas);
      const alcanceOrganico = Math.max(0, alcanceTotalAjustado - alcancePago);
      const percVisualizacoesOrganicas = visualizacoesTotaisAjustado > 0 ? visualizacoesOrganicas / visualizacoesTotaisAjustado : 0;
      const percVisualizacoesPagas = visualizacoesTotaisAjustado > 0 ? visualizacoesPagas / visualizacoesTotaisAjustado : 0;
      const frequenciaAlcance = alcanceTotalAjustado > 0 ? visualizacoesTotaisAjustado / alcanceTotalAjustado : 0;

      const ctrAlcanceVisitas = alcanceTotalAjustado > 0 ? visitasPerfil / alcanceTotalAjustado : 0;
      const percEngajamento = alcanceTotalAjustado > 0 ? interacoes / alcanceTotalAjustado : 0;
      const ctrAlcanceCliques = alcanceTotalAjustado > 0 ? cliquesLinkBio / alcanceTotalAjustado : 0;
      const ctrVisitasCliques = visitasPerfil > 0 ? cliquesLinkBio / visitasPerfil : 0;

      // Breakdown de leads/MQLs/vendas por sub-origem dentro do canal Instagram.
      // Buckets:
      //   - linktree: utm_term='linktree' OU utm_campaign+content='linktree' (legado).
      //     Captura também leads com utm_source=facebook que vieram pelo Linktree
      //     (bug de marcação conhecido em LPs pages.turbopartners.com.br).
      //   - contato_instagram: source='WEB' (formulário "Contato - Instagram" no Bitrix).
      //   - social_selling: source='UC_4VCKGM' (trabalho ativo do SDR no DM do IG).
      //   - outros: catch-all (utm_source LIKE %instagram% sem se encaixar acima).
      //
      // Janela temporal por métrica (consistente com o top card do dashboard):
      //   - Leads e MQLs → created_at no período (lead entrou no funil)
      //   - Negócio Ganho e Receita → data_fechamento no período (venda fechou)
      // Por isso são duas queries separadas, mergidas em JS por origem.
      const igOrigemExpr = `CASE
        WHEN source = 'UC_4VCKGM' THEN 'social_selling'
        WHEN source = 'WEB' THEN 'contato_instagram'
        WHEN LOWER(TRIM(COALESCE(utm_term, ''))) = 'linktree' THEN 'linktree'
        WHEN LOWER(TRIM(COALESCE(utm_campaign, ''))) = 'linktree'
             AND LOWER(TRIM(COALESCE(utm_content, ''))) = 'linktree' THEN 'linktree'
        ELSE 'outros'
      END`;
      const igOrigemMatchFilter = `(
        source IN ('UC_4VCKGM','WEB')
        OR LOWER(TRIM(COALESCE(utm_term, ''))) = 'linktree'
        OR (
          LOWER(TRIM(COALESCE(utm_campaign, ''))) = 'linktree'
          AND LOWER(TRIM(COALESCE(utm_content, ''))) = 'linktree'
        )
        OR LOWER(TRIM(COALESCE(utm_source, ''))) LIKE '%instagram%'
        OR LOWER(TRIM(COALESCE(utm_source, ''))) = 'ig'
      )`;
      let leadsPorOrigem: Array<{
        origem: string;
        label: string;
        leads: number;
        mqls: number;
        negocioGanho: number;
        receita: number;
      }> = [];
      try {
        // Query 1: leads + MQLs por created_at
        const leadsResult = await db.execute(sql.raw(`
          SELECT
            ${igOrigemExpr} AS origem,
            COUNT(*) AS leads,
            SUM(CASE WHEN (mql::text = '1' OR LOWER(mql::text) = 'true') THEN 1 ELSE 0 END) AS mqls
          FROM "Bitrix".crm_deal
          WHERE created_at >= '${startDate}'::date
            AND created_at <= '${endDate}'::date + INTERVAL '1 day'
            AND source IN ('CALL','EMAIL','WEB','ADVERTISING','TRADE_SHOW','WEBFORM','OTHER','UC_4VCKGM')
            AND ${igOrigemMatchFilter}
          GROUP BY origem
        `));
        // Query 2: negócios ganhos + receita por data_fechamento
        const wonResult = await db.execute(sql.raw(`
          SELECT
            ${igOrigemExpr} AS origem,
            SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) AS negocio_ganho,
            SUM(CASE WHEN stage_name = 'Negócio Ganho'
                     THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)
                     ELSE 0 END) AS receita
          FROM "Bitrix".crm_deal
          WHERE data_fechamento >= '${startDate}'::date
            AND data_fechamento <= '${endDate}'::date
            AND stage_name = 'Negócio Ganho'
            AND source IN ('CALL','EMAIL','WEB','ADVERTISING','TRADE_SHOW','WEBFORM','OTHER','UC_4VCKGM')
            AND ${igOrigemMatchFilter}
          GROUP BY origem
        `));
        const labelMap: Record<string, string> = {
          linktree: 'Linktree (bio)',
          contato_instagram: 'Contato Instagram',
          social_selling: 'Social Selling',
          outros: 'Outros Instagram',
        };
        const order = ['linktree', 'contato_instagram', 'social_selling', 'outros'];
        const leadsMap = new Map<string, any>();
        for (const r of leadsResult.rows as any[]) leadsMap.set(r.origem, r);
        const wonMap = new Map<string, any>();
        for (const r of wonResult.rows as any[]) wonMap.set(r.origem, r);
        leadsPorOrigem = order
          .map((origem) => {
            const l = leadsMap.get(origem);
            const w = wonMap.get(origem);
            return {
              origem,
              label: labelMap[origem],
              leads: l ? parseInt(l.leads) || 0 : 0,
              mqls: l ? parseInt(l.mqls) || 0 : 0,
              negocioGanho: w ? parseInt(w.negocio_ganho) || 0 : 0,
              receita: w ? parseFloat(w.receita) || 0 : 0,
            };
          })
          .filter((r) => r.leads > 0 || r.mqls > 0 || r.negocioGanho > 0);
      } catch (err: any) {
        console.warn('[orcado-realizado/instagram] sub-source breakdown query failed:', err?.message || err);
      }

      // Posts publicados no período (conta a partir das métricas por post)
      let postsPublicados = 0;
      try {
        const postsRes = await db.execute(sql`
          SELECT COUNT(*)::int AS n
          FROM cortex_core.instagram_post_metrics
          WHERE connection_id IN (${sql.join(connectionIds.map((id: any) => sql`${id}`), sql`, `)})
            AND posted_at >= ${startDate}::date
            AND posted_at <= ${endDate}::date + INTERVAL '1 day'
        `);
        postsPublicados = parseInt((postsRes.rows[0] as any).n) || 0;
      } catch (err: any) {
        console.warn('[orcado-realizado/instagram] posts count failed:', err?.message || err);
      }

      res.json({
        postsPublicados,
        comecaramSeguir, deixaramSeguir, percPerdaSeguidores,
        deltaSeguidores, totalSeguidores: lastFollowers, percCrescimentoSeguidores,
        visualizacoesTotais: visualizacoesTotaisAjustado, percVisualizacoesOrganicas, visualizacoesOrganicas,
        percVisualizacoesPagas, visualizacoesPagas,
        alcanceTotal: alcanceTotalAjustado, alcanceOrganico, alcancePago,
        frequenciaAlcance, ctrAlcanceVisitas, visitasPerfil,
        percEngajamento, interacoes, ctrAlcanceCliques,
        ctrVisitasCliques, cliquesLinkBio,
        cliquesLinkBioFonte,
        cliquesPorLink,
        cliquesPorDominio,
        leadsPorOrigem,
        investimentoPago,
        hasConnection: true,
        snapshotCount: snapshots.length,
      });
    } catch (error) {
      console.error("[api] Error fetching Instagram metrics:", error);
      res.status(500).json({ error: "Failed to fetch Instagram metrics" });
    }
  });

  // ===========================================================================
  // Métricas nativas orgânicas — YouTube / TikTok / LinkedIn
  // ---------------------------------------------------------------------------
  // Espelham o padrão do endpoint /instagram: leem as tabelas próprias de cada
  // plataforma (preenchidas pelos syncs orgânicos #235/#236/#237) e devolvem JSON
  // plano consumido pelos builders do Aprofundado (GrowthOrcadoRealizado.tsx).
  // O funil (leads→MQL→venda) continua vindo do /funnel-by-platform — aqui é só a
  // camada de vaidade/alcance nativa.
  //
  // Granularidade difere por plataforma (ver create-*-tables.ts + *Sync.ts):
  //   - YouTube  → channel_daily_metrics é DIÁRIO real (Analytics API, dim=day) → SUM
  //   - TikTok   → snapshots diários; account_metrics = total/dia (seguidores=último,
  //                crescimento=último-primeiro); video_metrics = contadores CUMULATIVOS
  //                por vídeo → ganho no período = MAX-MIN por vídeo, somado
  //   - LinkedIn → snapshots de totais LIFETIME → tudo delta (último-primeiro / MAX-MIN);
  //                os campos *_follower_gain não são populados (v1 só grava total_followers)
  // ===========================================================================

  // YouTube — inscritos + métricas diárias do canal (orgânico)
  app.get("/api/growth/orcado-realizado/youtube", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      // Inscritos atuais (snapshot) + nº de canais conectados
      const chRes = await db.execute(sql`
        SELECT COALESCE(SUM(subscriber_count), 0)::bigint AS inscritos, COUNT(*)::int AS canais
        FROM youtube.channels
      `);
      const inscritos = parseInt((chRes.rows[0] as any).inscritos) || 0;
      const canais = parseInt((chRes.rows[0] as any).canais) || 0;

      // Métricas diárias do canal — SUM no período (Analytics API entrega valor por dia)
      const dmRes = await db.execute(sql`
        SELECT
          COALESCE(SUM(views), 0)::bigint AS visualizacoes,
          COALESCE(SUM(estimated_minutes_watched), 0)::bigint AS minutos,
          COALESCE(SUM(subscribers_gained), 0)::int AS subs_gained,
          COALESCE(SUM(subscribers_lost), 0)::int AS subs_lost,
          COALESCE(SUM(likes), 0)::bigint AS curtidas,
          COALESCE(SUM(comments), 0)::bigint AS comentarios,
          COALESCE(SUM(shares), 0)::bigint AS compartilhamentos
        FROM youtube.channel_daily_metrics
        WHERE report_date >= ${startDate}::date AND report_date <= ${endDate}::date
      `);
      const d = dmRes.rows[0] as any;
      const subsGained = parseInt(d.subs_gained) || 0;
      const subsLost = parseInt(d.subs_lost) || 0;
      const deltaInscritos = subsGained - subsLost;
      const visualizacoes = parseInt(d.visualizacoes) || 0;
      const minutos = parseInt(d.minutos) || 0;
      // Duração média por view (segundos) — média ponderada via minutos/views (evita SUM de média)
      const avgViewDuration = visualizacoes > 0 ? Math.round((minutos / visualizacoes) * 60) : 0;
      // Mesmas fórmulas do Instagram, trocando seguidor → inscrito
      const percPerdaInscritos = (subsGained + subsLost) > 0 ? subsLost / (subsGained + subsLost) : 0;
      const baseInicial = inscritos - deltaInscritos; // inscritos no início do período
      const percCrescimentoInscritos = baseInicial > 0 ? deltaInscritos / baseInicial : 0;

      // Vídeos publicados no período
      const vRes = await db.execute(sql`
        SELECT COUNT(*)::int AS n
        FROM youtube.videos
        WHERE published_at >= ${startDate}::date AND published_at <= ${endDate}::date + INTERVAL '1 day'
      `);

      // Retenção média do canal: a Analytics API não dá averageViewPercentage no nível
      // de canal de forma agregável, mas já coletamos no nível de vídeo. Agregamos por
      // média ponderada por views. average_view_percentage vem 0–100 → /100 p/ decimal.
      const retRes = await db.execute(sql`
        SELECT
          COALESCE(SUM(average_view_percentage * views), 0)::numeric AS soma_pond,
          COALESCE(SUM(CASE WHEN average_view_percentage IS NOT NULL THEN views ELSE 0 END), 0)::numeric AS soma_views
        FROM youtube.video_daily_metrics
        WHERE report_date >= ${startDate}::date AND report_date <= ${endDate}::date
      `);
      const rr = retRes.rows[0] as any;
      const somaViews = parseFloat(rr.soma_views) || 0;
      const retencaoMedia = somaViews > 0 ? (parseFloat(rr.soma_pond) / somaViews) / 100 : 0;

      res.json({
        // Audiência (espelha o breakdown de seguidores do Instagram, seguidor → inscrito)
        comecaramInscrever: subsGained,
        deixaramInscrever: subsLost,
        percPerdaInscritos,
        deltaInscritos,
        totalInscritos: inscritos,
        percCrescimentoInscritos,
        // compat com consumidores antigos
        inscritos,
        ganhoLiquidoInscritos: deltaInscritos,
        // Conteúdo / distribuição
        visualizacoes,
        horasAssistidas: Math.round(minutos / 60),
        avgViewDuration,
        retencaoMedia,
        curtidas: parseInt(d.curtidas) || 0,
        comentarios: parseInt(d.comentarios) || 0,
        compartilhamentos: parseInt(d.compartilhamentos) || 0,
        videosPublicados: parseInt((vRes.rows[0] as any).n) || 0,
        hasConnection: canais > 0,
      });
    } catch (error) {
      console.error("[api] Error fetching YouTube metrics:", error);
      res.status(500).json({ error: "Failed to fetch YouTube metrics" });
    }
  });

  // TikTok — perfil orgânico (seguidores + engajamento dos vídeos)
  app.get("/api/growth/orcado-realizado/tiktok", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const accRes = await db.execute(sql`SELECT COUNT(*)::int AS n FROM tiktok.accounts`);
      const contas = parseInt((accRes.rows[0] as any).n) || 0;

      // Seguidores: snapshot por dia → último valor no range; crescimento = último - primeiro
      const folRes = await db.execute(sql`
        WITH acc AS (
          SELECT open_id,
            (ARRAY_AGG(follower_count ORDER BY snapshot_date DESC))[1] AS last_f,
            (ARRAY_AGG(follower_count ORDER BY snapshot_date ASC))[1] AS first_f
          FROM tiktok.account_metrics
          WHERE snapshot_date >= ${startDate}::date AND snapshot_date <= ${endDate}::date
          GROUP BY open_id
        )
        SELECT COALESCE(SUM(last_f), 0)::bigint AS seguidores,
               COALESCE(SUM(last_f - first_f), 0)::bigint AS crescimento
        FROM acc
      `);
      const f = folRes.rows[0] as any;

      // Começaram/Deixaram de seguir: inferido do delta dia-a-dia do total de seguidores
      // (mesma aproximação do Instagram/LinkedIn). Positivo = ganho, negativo = perda.
      const folDiffRes = await db.execute(sql`
        WITH daily AS (
          SELECT open_id,
            follower_count - LAG(follower_count) OVER (PARTITION BY open_id ORDER BY snapshot_date) AS diff
          FROM tiktok.account_metrics
          WHERE snapshot_date >= ${startDate}::date AND snapshot_date <= ${endDate}::date
        )
        SELECT
          COALESCE(SUM(CASE WHEN diff > 0 THEN diff ELSE 0 END), 0)::bigint AS gained,
          COALESCE(SUM(CASE WHEN diff < 0 THEN -diff ELSE 0 END), 0)::bigint AS lost
        FROM daily
      `);
      const fd = folDiffRes.rows[0] as any;

      // Vídeos: contadores cumulativos → ganho no período = MAX - MIN por vídeo, somado
      const vmRes = await db.execute(sql`
        WITH vid AS (
          SELECT video_id,
            MAX(view_count) - MIN(view_count) AS d_views,
            MAX(like_count) - MIN(like_count) AS d_likes,
            MAX(comment_count) - MIN(comment_count) AS d_comments,
            MAX(share_count) - MIN(share_count) AS d_shares
          FROM tiktok.video_metrics
          WHERE snapshot_date >= ${startDate}::date AND snapshot_date <= ${endDate}::date
          GROUP BY video_id
        )
        SELECT COALESCE(SUM(d_views), 0)::bigint AS visualizacoes,
               COALESCE(SUM(d_likes), 0)::bigint AS curtidas,
               COALESCE(SUM(d_comments), 0)::bigint AS comentarios,
               COALESCE(SUM(d_shares), 0)::bigint AS compartilhamentos
        FROM vid
      `);
      const v = vmRes.rows[0] as any;

      const vpubRes = await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM tiktok.videos
        WHERE create_time >= ${startDate}::date AND create_time <= ${endDate}::date + INTERVAL '1 day'
      `);

      const totalSeguidores = parseInt(f.seguidores) || 0;
      const deltaSeguidores = parseInt(f.crescimento) || 0;
      const comecaramSeguir = parseInt(fd.gained) || 0;
      const deixaramSeguir = parseInt(fd.lost) || 0;
      const baseInicial = totalSeguidores - deltaSeguidores; // seguidores no início do período
      const percCrescimentoSeguidores = baseInicial > 0 ? deltaSeguidores / baseInicial : 0;
      const percPerdaSeguidores = (comecaramSeguir + deixaramSeguir) > 0
        ? deixaramSeguir / (comecaramSeguir + deixaramSeguir) : 0;

      res.json({
        // Audiência (espelha o breakdown de seguidores do Instagram/YouTube/LinkedIn)
        comecaramSeguir,
        deixaramSeguir,
        percPerdaSeguidores,
        deltaSeguidores,
        totalSeguidores,
        percCrescimentoSeguidores,
        // compat
        seguidores: totalSeguidores,
        crescimentoSeguidores: deltaSeguidores,
        // Distribuição
        visualizacoes: parseInt(v.visualizacoes) || 0,
        compartilhamentos: parseInt(v.compartilhamentos) || 0,
        videosPublicados: parseInt((vpubRes.rows[0] as any).n) || 0,
        // vaidade (não exibidos, mantidos por compat)
        curtidas: parseInt(v.curtidas) || 0,
        comentarios: parseInt(v.comentarios) || 0,
        hasConnection: contas > 0,
      });
    } catch (error) {
      console.error("[api] Error fetching TikTok metrics:", error);
      res.status(500).json({ error: "Failed to fetch TikTok metrics" });
    }
  });

  // TikTok Ads — mídia paga (gasto/impressões/cliques por campanha/dia).
  // ad_metrics_daily é diário REAL (não cumulativo) → agrega por SUM no range.
  app.get("/api/growth/orcado-realizado/tiktok-ads", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const advRes = await db.execute(sql`SELECT COUNT(*)::int AS n FROM tiktok.advertisers`);
      const advertisers = parseInt((advRes.rows[0] as any).n) || 0;

      const mRes = await db.execute(sql`
        SELECT COALESCE(SUM(spend), 0)::numeric AS investimento,
               COALESCE(SUM(impressions), 0)::bigint AS impressoes,
               COALESCE(SUM(clicks), 0)::bigint AS cliques,
               COALESCE(SUM(conversions), 0)::numeric AS conversoes
        FROM tiktok.ad_metrics_daily
        WHERE stat_date >= ${startDate}::date AND stat_date <= ${endDate}::date
      `);
      const m = mRes.rows[0] as any;
      const investimento = parseFloat(m.investimento) || 0;
      const impressoes = parseInt(m.impressoes) || 0;
      const cliques = parseInt(m.cliques) || 0;

      // Meio do funil via GA4: sessões + visualizações de página do tráfego tiktok_ads
      const ga4 = await getSessionsByPlatform(new Date(startDate), new Date(endDate));
      const sessoes = ga4.byPlatform.tiktok_ads;
      const visualizacoesPagina = ga4.byPlatformPageViews.tiktok_ads;
      const connectRate = cliques > 0 ? sessoes / cliques : 0;

      res.json({
        investimento,
        impressoes,
        cliques,
        conversoes: parseFloat(m.conversoes) || 0,
        cpm: impressoes > 0 ? (investimento / impressoes) * 1000 : 0,
        ctr: impressoes > 0 ? cliques / impressoes : 0,
        visualizacoesPagina,
        sessoes,
        connectRate,
        sessoesAvailable: ga4.available,
        hasConnection: advertisers > 0,
      });
    } catch (error) {
      console.error("[api] Error fetching TikTok Ads metrics:", error);
      res.status(500).json({ error: "Failed to fetch TikTok Ads metrics" });
    }
  });

  // GA4 — diagnóstico de tagueamento: lista source/medium reais + bucket atribuído.
  // Use em prod pra confirmar que TikTok/LinkedIn/Google Ads caem nos buckets certos
  // antes de confiar em Connect Rate / Tx Conversão.
  app.get("/api/growth/ga4-diagnostic", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }
      const diag = await getGa4SourceMediumDiagnostic(new Date(startDate), new Date(endDate));
      res.json(diag);
    } catch (error) {
      console.error("[api] Error fetching GA4 diagnostic:", error);
      res.status(500).json({ error: "Failed to fetch GA4 diagnostic" });
    }
  });

  // LinkedIn Ads — mídia paga (gasto/impressões/cliques por campanha/dia).
  // ad_metrics_daily é diário REAL (adAnalytics DAILY) → agrega por SUM no range.
  app.get("/api/growth/orcado-realizado/linkedin-ads", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const accRes = await db.execute(sql`SELECT COUNT(*)::int AS n FROM linkedin.ad_accounts`);
      const contas = parseInt((accRes.rows[0] as any).n) || 0;

      const mRes = await db.execute(sql`
        SELECT COALESCE(SUM(spend), 0)::numeric AS investimento,
               COALESCE(SUM(impressions), 0)::bigint AS impressoes,
               COALESCE(SUM(clicks), 0)::bigint AS cliques,
               COALESCE(SUM(conversions), 0)::numeric AS conversoes
        FROM linkedin.ad_metrics_daily
        WHERE stat_date >= ${startDate}::date AND stat_date <= ${endDate}::date
      `);
      const m = mRes.rows[0] as any;
      const investimento = parseFloat(m.investimento) || 0;
      const impressoes = parseInt(m.impressoes) || 0;
      const cliques = parseInt(m.cliques) || 0;

      // Meio do funil via GA4: sessões + visualizações de página do tráfego linkedin_ads
      const ga4 = await getSessionsByPlatform(new Date(startDate), new Date(endDate));
      const sessoes = ga4.byPlatform.linkedin_ads;
      const visualizacoesPagina = ga4.byPlatformPageViews.linkedin_ads;
      const connectRate = cliques > 0 ? sessoes / cliques : 0;

      res.json({
        investimento,
        impressoes,
        cliques,
        conversoes: parseFloat(m.conversoes) || 0,
        cpm: impressoes > 0 ? (investimento / impressoes) * 1000 : 0,
        ctr: impressoes > 0 ? cliques / impressoes : 0,
        visualizacoesPagina,
        sessoes,
        connectRate,
        sessoesAvailable: ga4.available,
        hasConnection: contas > 0,
      });
    } catch (error) {
      console.error("[api] Error fetching LinkedIn Ads metrics:", error);
      res.status(500).json({ error: "Failed to fetch LinkedIn Ads metrics" });
    }
  });

  // LinkedIn — Company Page orgânica (seguidores + engajamento + page views)
  app.get("/api/growth/orcado-realizado/linkedin", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const orgRes = await db.execute(sql`SELECT COUNT(*)::int AS n FROM linkedin.organizations`);
      const orgs = parseInt((orgRes.rows[0] as any).n) || 0;

      // Seguidores: snapshot de total → último no range; novos = último - primeiro
      const folRes = await db.execute(sql`
        WITH foll AS (
          SELECT org_id,
            (ARRAY_AGG(total_followers ORDER BY stat_date DESC))[1] AS last_f,
            (ARRAY_AGG(total_followers ORDER BY stat_date ASC))[1] AS first_f
          FROM linkedin.follower_stats_daily
          WHERE stat_date >= ${startDate}::date AND stat_date <= ${endDate}::date
          GROUP BY org_id
        )
        SELECT COALESCE(SUM(last_f), 0)::bigint AS seguidores,
               COALESCE(SUM(last_f - first_f), 0)::bigint AS novos
        FROM foll
      `);
      const f = folRes.rows[0] as any;

      // Começaram/Deixaram de seguir: LinkedIn não expõe unfollow → inferimos do
      // delta dia-a-dia do total (mesma aproximação do Instagram). Positivo = ganho,
      // negativo = perda.
      const folDiffRes = await db.execute(sql`
        WITH daily AS (
          SELECT org_id,
            total_followers - LAG(total_followers) OVER (PARTITION BY org_id ORDER BY stat_date) AS diff
          FROM linkedin.follower_stats_daily
          WHERE stat_date >= ${startDate}::date AND stat_date <= ${endDate}::date
        )
        SELECT
          COALESCE(SUM(CASE WHEN diff > 0 THEN diff ELSE 0 END), 0)::bigint AS gained,
          COALESCE(SUM(CASE WHEN diff < 0 THEN -diff ELSE 0 END), 0)::bigint AS lost
        FROM daily
      `);
      const fd = folDiffRes.rows[0] as any;

      // Engajamento: impressions/clicks/likes/comments/shares são contadores lifetime →
      // ganho no período = MAX - MIN por org. Já `engagement` é uma TAXA (decimal) do
      // totalShareStatistics, não um contador → usa o último valor do range (média entre orgs).
      const shRes = await db.execute(sql`
        WITH sh AS (
          SELECT org_id,
            MAX(impressions) - MIN(impressions) AS d_imp,
            MAX(clicks) - MIN(clicks) AS d_clk,
            MAX(likes) - MIN(likes) AS d_likes,
            MAX(comments) - MIN(comments) AS d_comments,
            MAX(shares) - MIN(shares) AS d_shares,
            (ARRAY_AGG(engagement ORDER BY stat_date DESC) FILTER (WHERE engagement IS NOT NULL))[1] AS last_eng
          FROM linkedin.share_stats_daily
          WHERE stat_date >= ${startDate}::date AND stat_date <= ${endDate}::date
          GROUP BY org_id
        )
        SELECT COALESCE(SUM(d_imp), 0)::bigint AS impressoes,
               COALESCE(SUM(d_clk), 0)::bigint AS cliques,
               COALESCE(SUM(d_likes), 0)::bigint AS reacoes,
               COALESCE(SUM(d_comments), 0)::bigint AS comentarios,
               COALESCE(SUM(d_shares), 0)::bigint AS compartilhamentos,
               COALESCE(AVG(last_eng), 0)::numeric AS engajamento
        FROM sh
      `);
      const s = shRes.rows[0] as any;

      // Page views: lifetime → ganho no período = MAX - MIN por org
      const pgRes = await db.execute(sql`
        WITH pg AS (
          SELECT org_id, MAX(all_page_views) - MIN(all_page_views) AS d_pv
          FROM linkedin.page_stats_daily
          WHERE stat_date >= ${startDate}::date AND stat_date <= ${endDate}::date
          GROUP BY org_id
        )
        SELECT COALESCE(SUM(d_pv), 0)::bigint AS page_views FROM pg
      `);

      const totalSeguidores = parseInt(f.seguidores) || 0;
      const deltaSeguidores = parseInt(f.novos) || 0;
      const comecaramSeguir = parseInt(fd.gained) || 0;
      const deixaramSeguir = parseInt(fd.lost) || 0;
      const baseInicial = totalSeguidores - deltaSeguidores; // seguidores no início do período
      const percCrescimentoSeguidores = baseInicial > 0 ? deltaSeguidores / baseInicial : 0;
      const percPerdaSeguidores = (comecaramSeguir + deixaramSeguir) > 0
        ? deixaramSeguir / (comecaramSeguir + deixaramSeguir) : 0;
      const impressoes = parseInt(s.impressoes) || 0;
      const cliques = parseInt(s.cliques) || 0;
      const ctr = impressoes > 0 ? cliques / impressoes : 0;

      res.json({
        // Audiência (espelha o breakdown de seguidores do Instagram/YouTube)
        comecaramSeguir,
        deixaramSeguir,
        percPerdaSeguidores,
        deltaSeguidores,
        totalSeguidores,
        percCrescimentoSeguidores,
        // compat
        seguidores: totalSeguidores,
        novosSeguidores: deltaSeguidores,
        // Distribuição / intenção
        impressoes,
        cliques,
        ctr,
        pageViews: parseInt((pgRes.rows[0] as any).page_views) || 0,
        engajamento: parseFloat(s.engajamento) || 0,
        // vaidade (não exibidos no bloco, mantidos por compat)
        reacoes: parseInt(s.reacoes) || 0,
        comentarios: parseInt(s.comentarios) || 0,
        compartilhamentos: parseInt(s.compartilhamentos) || 0,
        hasConnection: orgs > 0,
      });
    } catch (error) {
      console.error("[api] Error fetching LinkedIn metrics:", error);
      res.status(500).json({ error: "Failed to fetch LinkedIn metrics" });
    }
  });

  // Funnel metrics by platform (shared funnel: Leads → Receita → CAC)
  app.get("/api/growth/orcado-realizado/funnel-by-platform", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      // Classificação de plataforma centralizada (ver constante PLATFORM_CASE_SQL_BASIC no topo do arquivo)
      const platformCaseExpr = PLATFORM_CASE_SQL_BASIC;

      // Filtros de produto (funilNgc) e plataforma (utmSource), espelhando /ads (2613-2799).
      // Necessário para o Aprofundado do Orçado x Realizado reconciliar com Evolução Temporal.
      const funilNgcRaw = req.query.funilNgc as string | undefined;
      const funilValues = funilNgcRaw
        ? funilNgcRaw.split(',').map(v => decodeURIComponent(v).trim()).filter(Boolean)
        : [];
      const hasVazio = funilValues.includes('(Vazio)');
      const realFunilValues = expandFunilValues(funilValues.filter(v => v !== '(Vazio)'));

      const utmSourceParam = req.query.utmSource as string | undefined;
      const utmValues = utmSourceParam && utmSourceParam !== 'todos'
        ? utmSourceParam.split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
        : [];

      const escapeSql = (v: string) => v.replace(/'/g, "''");

      let funilFilterSql = '';
      if (funilValues.length > 0) {
        if (hasVazio && realFunilValues.length > 0) {
          const conds = realFunilValues.map(v => `fnl_ngc ILIKE '${escapeSql(v)}'`).join(' OR ');
          funilFilterSql = `AND (${conds} OR fnl_ngc IS NULL OR fnl_ngc = '')`;
        } else if (hasVazio) {
          funilFilterSql = `AND (fnl_ngc IS NULL OR fnl_ngc = '')`;
        } else {
          const conds = realFunilValues.map(v => `fnl_ngc ILIKE '${escapeSql(v)}'`).join(' OR ');
          funilFilterSql = `AND (${conds})`;
        }
      }

      let utmSourceFilterSql = '';
      if (utmValues.length > 0) {
        const conds = utmValues.map(v => `LOWER(utm_source) LIKE '${escapeSql(v)}%'`).join(' OR ');
        utmSourceFilterSql = `AND (${conds})`;
      }

      const RA_STAGES = `'reunião marcada', 'rm', 'rm - reunião marcada', 'agendado', 'reunião agendada', 'agendamento direto',
            'reunião realizada', 'rr - reunião realizada', 'rr', 'realizado',
            'confecção de proposta', 'em negociação', 'aguardado os dados',
            'aguardando assinatura', 'subir/ajustar cobrança',
            'proposta enviada', 'negócio ganho', 'negócio perdido'`;
      const RR_STAGES = `'reunião realizada', 'rr - reunião realizada', 'rr', 'realizado',
            'confecção de proposta', 'em negociação', 'aguardado os dados',
            'aguardando assinatura', 'subir/ajustar cobrança',
            'proposta enviada', 'negócio ganho', 'negócio perdido'`;
      const MQL_COND = `(mql::text = '1' OR LOWER(mql::text) = 'true')`;
      const NMQL_COND = `NOT (mql::text = '1' OR LOWER(mql::text) = 'true')`;

      // Janela temporal por métrica (alinhada com /mql e /nao-mql do top card):
      //   - Leads, MQLs, RA, RR → created_at no período (lead entrou no funil em X)
      //   - Negócio Ganho, Receita, Contratos → data_fechamento no período (venda fechou em X)
      // Duas queries separadas, mergidas em JS por platform.

      // Query 1: lead journey (leads → RA → RR) por created_at
      const dealsResult = await db.execute(sql.raw(`
        SELECT
          ${platformCaseExpr} as platform,
          COUNT(*) as leads,
          SUM(CASE WHEN ${MQL_COND} THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN data_reuniao_agendada IS NOT NULL THEN 1 ELSE 0 END) as ra,
          SUM(CASE WHEN data_reuniao_agendada IS NOT NULL AND ${MQL_COND} THEN 1 ELSE 0 END) as ra_mql,
          SUM(CASE WHEN data_reuniao_agendada IS NOT NULL AND ${NMQL_COND} THEN 1 ELSE 0 END) as ra_nmql,
          SUM(CASE WHEN data_reuniao_realizada IS NOT NULL THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN data_reuniao_realizada IS NOT NULL AND ${MQL_COND} THEN 1 ELSE 0 END) as rr_mql,
          SUM(CASE WHEN data_reuniao_realizada IS NOT NULL AND ${NMQL_COND} THEN 1 ELSE 0 END) as rr_nmql
        FROM "Bitrix".crm_deal
        WHERE created_at >= '${startDate}'::date AND created_at <= '${endDate}'::date + INTERVAL '1 day'
          AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
          ${funilFilterSql}
          ${utmSourceFilterSql}
        GROUP BY platform
      `));

      // Query 2: wins/receita/contratos por data_fechamento
      const winsResult = await db.execute(sql.raw(`
        SELECT
          ${platformCaseExpr} as platform,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as vendas,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' AND ${MQL_COND} THEN 1 ELSE 0 END) as vendas_mql,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' AND ${NMQL_COND} THEN 1 ELSE 0 END) as vendas_nmql,
          COUNT(DISTINCT CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(company_name, contact_name, title) END) as clientes_unicos,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) ELSE 0 END) as receita_pontual,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_recorrente, 0) ELSE 0 END) as receita_recorrente,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN
            CASE WHEN produtos IS NULL OR produtos = '' OR produtos = '[]' THEN 1
            ELSE COALESCE(array_length(string_to_array(REPLACE(REPLACE(produtos, '[', ''), ']', ''), ','), 1), 1) END
          ELSE 0 END) as contratos
        FROM "Bitrix".crm_deal
        WHERE data_fechamento >= '${startDate}'::date AND data_fechamento <= '${endDate}'::date
          AND stage_name = 'Negócio Ganho'
          AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
          ${funilFilterSql}
          ${utmSourceFilterSql}
        GROUP BY platform
      `));
      const winsMap = new Map<string, any>();
      for (const row of winsResult.rows as any[]) winsMap.set(row.platform, row);

      const leadTimeResult = await db.execute(sql.raw(`
        SELECT platform, AVG(lead_time_days) as avg_lead_time
        FROM (
          SELECT
            ${platformCaseExpr} as platform,
            COALESCE(company_name, contact_name, title) as cliente,
            MIN(EXTRACT(EPOCH FROM (data_fechamento::timestamp - date_create)) / 86400) as lead_time_days
          FROM "Bitrix".crm_deal
          WHERE stage_name = 'Negócio Ganho'
            AND data_fechamento IS NOT NULL
            AND data_fechamento >= '${startDate}'::date AND data_fechamento <= '${endDate}'::date
            AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
            ${funilFilterSql}
            ${utmSourceFilterSql}
          GROUP BY platform, cliente
        ) sub
        GROUP BY platform
      `));

      const leadTimeMap = new Map<string, number>();
      for (const row of leadTimeResult.rows as any[]) {
        if (row.avg_lead_time) leadTimeMap.set(row.platform, parseFloat(row.avg_lead_time));
      }

      // Build result per platform
      const platforms = ['meta_ads', 'google_ads', 'instagram', 'youtube', 'linkedin', 'tiktok_ads', 'tiktok'];
      const result: Record<string, any> = {};

      for (const platKey of platforms) {
        const row = (dealsResult.rows as any[]).find(r => r.platform === platKey);
        const won = winsMap.get(platKey);
        const leads = row ? parseInt(row.leads) || 0 : 0;
        const mqls = row ? parseInt(row.mqls) || 0 : 0;
        const ra = row ? parseInt(row.ra) || 0 : 0;
        const raMql = row ? parseInt(row.ra_mql) || 0 : 0;
        const raNmql = row ? parseInt(row.ra_nmql) || 0 : 0;
        const rr = row ? parseInt(row.rr) || 0 : 0;
        const rrMql = row ? parseInt(row.rr_mql) || 0 : 0;
        const rrNmql = row ? parseInt(row.rr_nmql) || 0 : 0;
        const vendas = won ? parseInt(won.vendas) || 0 : 0;
        const vendasMql = won ? parseInt(won.vendas_mql) || 0 : 0;
        const vendasNmql = won ? parseInt(won.vendas_nmql) || 0 : 0;
        const clientesUnicos = won ? parseInt(won.clientes_unicos) || 0 : 0;
        const receitaPontual = won ? parseFloat(won.receita_pontual) || 0 : 0;
        const receitaRecorrente = won ? parseFloat(won.receita_recorrente) || 0 : 0;
        const contratos = won ? parseInt(won.contratos) || 0 : 0;
        const receita = receitaPontual + receitaRecorrente;
        const lt = leadTimeMap.get(platKey) || null;

        result[platKey] = {
          leads, mqls,
          ra, raMql, raNmql,
          rr, rrMql, rrNmql,
          cpl: null, // Will be calculated on frontend with platform investimento
          cpmql: null,
          percMqls: leads > 0 ? mqls / leads : 0,
          percRa: leads > 0 ? ra / leads : 0,
          percRaMql: mqls > 0 ? raMql / mqls : 0,
          percRaNmql: (leads - mqls) > 0 ? raNmql / (leads - mqls) : 0,
          percRr: leads > 0 ? rr / leads : 0,
          percRrMql: mqls > 0 ? rrMql / mqls : 0,
          percRrNmql: (leads - mqls) > 0 ? rrNmql / (leads - mqls) : 0,
          percRrVendas: rr > 0 ? vendas / rr : 0,
          percRrMqlVendas: rrMql > 0 ? vendasMql / rrMql : 0,
          percRrNmqlVendas: rrNmql > 0 ? vendasNmql / rrNmql : 0,
          negocioGanho: vendas,
          leadTime: lt ? parseFloat(lt.toFixed(1)) : null,
          aov: clientesUnicos > 0 ? receita / clientesUnicos : null,
          receita: receita > 0 ? receita : null,
          receitaPontual: receitaPontual > 0 ? receitaPontual : null,
          receitaRecorrente: receitaRecorrente > 0 ? receitaRecorrente : null,
          cac: null, // Calculated on frontend
          cacUnico: null,
          cacContrato: null,
          clientesUnicos,
          contratos,
        };
      }

      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching funnel by platform:", error);
      res.status(500).json({ error: "Failed to fetch funnel by platform" });
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
          AND d.source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
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

      // Campaign filter aplicado tanto na mídia quanto no Bitrix.
      // Sem isso, leads filtravam por campanha e impressões/cliques somavam tudo — universos diferentes.
      const metaCampaignFilter = campaign
        ? sql`AND campaign_id IN (
            SELECT campaign_id::text FROM meta_ads.meta_campaigns
            WHERE campaign_name ILIKE ${'%' + campaign + '%'}
          )`
        : sql``;

      if (plataforma === 'Todos' || plataforma === 'Meta') {
        const metaResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(impressions), 0)::bigint as impressions,
            COALESCE(SUM(clicks), 0)::bigint as clicks,
            COALESCE(SUM(spend), 0)::numeric as spend
          FROM meta_ads.meta_insights_daily
          WHERE date_start >= ${startDate}::date AND date_stop <= ${endDate}::date
            AND account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
            ${metaCampaignFilter}
        `);
        const mr = metaResult.rows[0] as any;
        metaImpressions = parseInt(mr.impressions) || 0;
        metaClicks = parseInt(mr.clicks) || 0;
        metaSpend = parseFloat(mr.spend) || 0;
      }

      if (plataforma === 'Todos' || plataforma === 'Google') {
        try {
          const googleCampaignFilter = campaign
            ? sql`AND campaign_id IN (
                SELECT campaign_id FROM google.campaigns
                WHERE name ILIKE ${'%' + campaign + '%'}
              )`
            : sql``;
          const googleResult = await db.execute(sql`
            SELECT
              COALESCE(SUM(impressions), 0)::bigint as impressions,
              COALESCE(SUM(clicks), 0)::bigint as clicks,
              COALESCE(SUM(cost_micros), 0)::bigint as cost_micros
            FROM google.campaign_daily_metrics
            WHERE report_date >= ${startDate}::date AND report_date <= ${endDate}::date
              ${googleCampaignFilter}
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
          SUM(CASE WHEN data_reuniao_agendada IS NOT NULL
                   AND data_reuniao_agendada::date >= ${startDate}::date
                   AND data_reuniao_agendada::date <= ${endDate}::date
                   THEN 1 ELSE 0 END) as rm,
          SUM(CASE WHEN data_reuniao_realizada IS NOT NULL
                   AND data_reuniao_realizada::date >= ${startDate}::date
                   AND data_reuniao_realizada::date <= ${endDate}::date
                   THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN stage_name = 'Negócio Ganho'
                   AND data_fechamento >= ${startDate}::date
                   AND data_fechamento <= ${endDate}::date
                   THEN 1 ELSE 0 END) as vendas,
          SUM(CASE WHEN stage_name = 'Negócio Ganho'
                   AND data_fechamento >= ${startDate}::date
                   AND data_fechamento <= ${endDate}::date
                   THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) ELSE 0 END) as valor_vendas
        FROM "Bitrix".crm_deal
        WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
          AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
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

      // 4. Monthly trend — event-time por métrica.
      // Cada métrica é agrupada pelo mês do SEU próprio evento, não pelo mês do lead.
      // Ex.: RA de março feita por lead criado em fevereiro entra em março.
      const trendResult = await db.execute(sql`
        WITH leads_m AS (
          SELECT TO_CHAR(created_at, 'YYYY-MM') as month,
                 COUNT(*) as leads,
                 SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls
          FROM "Bitrix".crm_deal
          WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
            AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
            ${utmFilter}
            ${campaignFilter}
          GROUP BY 1
        ),
        rm_m AS (
          SELECT TO_CHAR(data_reuniao_agendada, 'YYYY-MM') as month, COUNT(*) as rm
          FROM "Bitrix".crm_deal
          WHERE data_reuniao_agendada IS NOT NULL
            AND data_reuniao_agendada::date >= ${startDate}::date
            AND data_reuniao_agendada::date <= ${endDate}::date
            AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
            ${utmFilter}
            ${campaignFilter}
          GROUP BY 1
        ),
        rr_m AS (
          SELECT TO_CHAR(data_reuniao_realizada, 'YYYY-MM') as month, COUNT(*) as rr
          FROM "Bitrix".crm_deal
          WHERE data_reuniao_realizada IS NOT NULL
            AND data_reuniao_realizada::date >= ${startDate}::date
            AND data_reuniao_realizada::date <= ${endDate}::date
            AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
            ${utmFilter}
            ${campaignFilter}
          GROUP BY 1
        ),
        vendas_m AS (
          SELECT TO_CHAR(data_fechamento, 'YYYY-MM') as month, COUNT(*) as vendas
          FROM "Bitrix".crm_deal
          WHERE stage_name = 'Negócio Ganho'
            AND data_fechamento IS NOT NULL
            AND data_fechamento >= ${startDate}::date
            AND data_fechamento <= ${endDate}::date
            AND source IN ('CALL', 'EMAIL', 'WEB', 'ADVERTISING', 'TRADE_SHOW', 'WEBFORM', 'OTHER', 'UC_4VCKGM')
            ${utmFilter}
            ${campaignFilter}
          GROUP BY 1
        ),
        all_months AS (
          SELECT month FROM leads_m
          UNION SELECT month FROM rm_m
          UNION SELECT month FROM rr_m
          UNION SELECT month FROM vendas_m
        )
        SELECT
          a.month,
          COALESCE(l.leads, 0) as leads,
          COALESCE(l.mqls, 0) as mqls,
          COALESCE(rm.rm, 0) as rm,
          COALESCE(rr.rr, 0) as rr,
          COALESCE(v.vendas, 0) as vendas
        FROM all_months a
        LEFT JOIN leads_m l ON a.month = l.month
        LEFT JOIN rm_m rm ON a.month = rm.month
        LEFT JOIN rr_m rr ON a.month = rr.month
        LEFT JOIN vendas_m v ON a.month = v.month
        WHERE a.month IS NOT NULL
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
            (k.ad_group_id || '_' || k.criterion_id) as keyword_key,
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
          FROM google.keywords k
          JOIN google.ad_groups ag ON k.ad_group_id = ag.ad_group_id
          JOIN google.campaigns c ON ag.campaign_id = c.campaign_id
          LEFT JOIN google.keyword_daily_metrics m
            ON m.ad_group_id = k.ad_group_id AND m.criterion_id = k.criterion_id
            AND m.report_date >= ${startDate}::date
            AND m.report_date <= ${endDate}::date
          WHERE k.negative = false
          GROUP BY k.ad_group_id, k.criterion_id, k.text, k.match_type, k.status, k.quality_score, k.negative,
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

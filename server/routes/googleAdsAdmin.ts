/**
 * Endpoints administrativos do Google Ads sync.
 *
 *  POST /api/admin/google-ads/sync
 *      body: { customerId?: string, since?: 'YYYY-MM-DD', until?: 'YYYY-MM-DD' }
 *      → dispara sync de campanhas + métricas diárias (síncrono, retorna o
 *        resumo). Default: conta Agência Turbo Partners (5156174278),
 *        últimos 90 dias.
 *
 *  GET  /api/admin/google-ads/status
 *      → resumo do estado: contas, campanhas, range de datas, última sync.
 */

import type { Express, Request, Response } from 'express';
import { Pool } from 'pg';

const TURBO_CUSTOMER_ID = '5156174278';

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - admin only' });
  }
  next();
}

function makePool(): Pool {
  return new Pool({
    host: process.env.DB_HOST || process.env.DATABASE_HOST || '',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'dados_turbo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
    ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : { rejectUnauthorized: false },
  });
}

export function registerGoogleAdsAdminRoutes(app: Express) {
  app.post('/api/admin/google-ads/sync', isAdmin, async (req: Request, res: Response) => {
    const { customerId = TURBO_CUSTOMER_ID, since, until } = req.body || {};
    const pool = makePool();
    console.log(`[admin] Sync Google Ads campanhas: customer=${customerId}, since=${since}, until=${until}`);
    try {
      const { syncGoogleAdsCampaigns } = await import('../services/googleAdsSync');
      const result = await syncGoogleAdsCampaigns(pool, { customerId, since, until });
      res.json({
        ok: result.errors.length === 0,
        customerId,
        since: since || '(últimos 90 dias)',
        until: until || '(hoje)',
        ...result,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  app.get('/api/admin/google-ads/status', isAdmin, async (_req: Request, res: Response) => {
    const pool = makePool();
    try {
      const [accounts, turboCampaigns, dateRange] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS total FROM google_ads.accounts`),
        pool.query(`
          SELECT COUNT(*) AS total
          FROM google_ads.campaigns
          WHERE account_key = (SELECT account_key FROM google_ads.accounts WHERE customer_id=$1)
        `, [TURBO_CUSTOMER_ID]),
        pool.query(`
          SELECT MIN(report_date) AS data_min,
                 MAX(report_date) AS data_max,
                 COUNT(*) AS linhas,
                 ROUND(SUM(cost_micros)/1000000.0, 2) AS investimento_total_brl
          FROM google_ads.campaign_daily_metrics m
          JOIN google_ads.campaigns c ON c.campaign_key = m.campaign_key
          WHERE c.account_key = (SELECT account_key FROM google_ads.accounts WHERE customer_id=$1)
        `, [TURBO_CUSTOMER_ID]),
      ]);

      res.json({
        totalAccounts: parseInt(accounts.rows[0].total, 10),
        turboCustomerId: TURBO_CUSTOMER_ID,
        turboCampaigns: parseInt(turboCampaigns.rows[0].total, 10),
        turboMetrics: {
          dataMin: dateRange.rows[0].data_min,
          dataMax: dateRange.rows[0].data_max,
          linhas: parseInt(dateRange.rows[0].linhas, 10),
          investimentoTotalBrl: parseFloat(dateRange.rows[0].investimento_total_brl || '0'),
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });
}

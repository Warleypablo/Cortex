/**
 * Endpoints admin do Google Ads (Turbo-only, schema `google`).
 *
 *  POST /api/admin/google/sync
 *      body: { since?: 'YYYY-MM-DD', until?: 'YYYY-MM-DD', customerId? }
 *      → sincroniza campanhas + métricas da conta da Turbo. Default: 90 dias.
 *
 *  GET  /api/admin/google/status
 *      → resumo: conta, nº de campanhas, range de datas, investimento, última sync.
 */

import type { Express, Request, Response } from 'express';
import { Pool } from 'pg';
import { TURBO_CUSTOMER_ID } from '../services/googleSync';

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

export function registerGoogleAdminRoutes(app: Express) {
  app.post('/api/admin/google/sync', isAdmin, async (req: Request, res: Response) => {
    const { since, until, customerId } = req.body || {};
    const pool = makePool();
    console.log(`[admin] Sync Google Turbo: since=${since}, until=${until}`);
    try {
      const { syncGoogleTurbo } = await import('../services/googleSync');
      const result = await syncGoogleTurbo(pool, { customerId, since, until });
      res.json({ ok: result.errors.length === 0, since: since || '(90 dias)', until: until || '(hoje)', ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  app.get('/api/admin/google/status', isAdmin, async (_req: Request, res: Response) => {
    const pool = makePool();
    try {
      const [acct, camps, range, lastRun] = await Promise.all([
        pool.query(`SELECT customer_id, descriptive_name, currency_code FROM google.accounts WHERE customer_id = $1`, [TURBO_CUSTOMER_ID]),
        pool.query(`SELECT COUNT(*) AS total FROM google.campaigns WHERE customer_id = $1`, [TURBO_CUSTOMER_ID]),
        pool.query(`
          SELECT MIN(report_date) AS data_min, MAX(report_date) AS data_max,
                 COUNT(*) AS linhas, ROUND(SUM(cost_micros)/1000000.0, 2) AS investimento_brl
          FROM google.campaign_daily_metrics`),
        pool.query(`SELECT status, campaigns, metrics, since_date, until_date, finished_at FROM google.sync_runs ORDER BY id DESC LIMIT 1`),
      ]);
      res.json({
        account: acct.rows[0] || null,
        campaigns: parseInt(camps.rows[0].total, 10),
        metrics: {
          dataMin: range.rows[0].data_min,
          dataMax: range.rows[0].data_max,
          linhas: parseInt(range.rows[0].linhas, 10),
          investimentoBrl: parseFloat(range.rows[0].investimento_brl || '0'),
        },
        lastRun: lastRun.rows[0] || null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });
}

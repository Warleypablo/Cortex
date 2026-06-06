/**
 * Endpoints admin do LinkedIn (orgânico + Ads).
 *
 *  POST /api/admin/linkedin/sync       → orgânico: seguidores + page views + engajamento
 *  POST /api/admin/linkedin/sync-ads   → Ads: contas + campanhas + métricas diárias
 *  GET  /api/admin/linkedin/status     → resumo orgânico: organizações + último snapshot
 *  GET  /api/admin/linkedin/ads-status → resumo Ads: campanhas + range de métricas
 */

import type { Express, Request, Response } from 'express';
import { Pool } from 'pg';

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

export function registerLinkedinAdminRoutes(app: Express) {
  app.post('/api/admin/linkedin/sync', isAdmin, async (_req: Request, res: Response) => {
    const pool = makePool();
    try {
      const { syncLinkedin } = await import('../services/linkedinSync');
      const result = await syncLinkedin(pool);
      res.json({ ok: result.errors.length === 0, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  app.post('/api/admin/linkedin/sync-ads', isAdmin, async (req: Request, res: Response) => {
    const pool = makePool();
    try {
      const days = parseInt((req.query.days as string) || '30', 10);
      const { syncLinkedinAds } = await import('../services/linkedinAdsSync');
      const result = await syncLinkedinAds(pool, Number.isFinite(days) ? days : 30);
      res.json({ ok: result.errors.length === 0, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  app.get('/api/admin/linkedin/ads-status', isAdmin, async (_req: Request, res: Response) => {
    const pool = makePool();
    try {
      const [accs, camps, range] = await Promise.all([
        pool.query(`SELECT account_id, name, currency, status FROM linkedin.ad_accounts ORDER BY account_id`),
        pool.query(`SELECT account_id, COUNT(*) AS n FROM linkedin.ad_campaigns GROUP BY account_id`),
        pool.query(`SELECT MIN(stat_date) mn, MAX(stat_date) mx, COUNT(*) n, COALESCE(SUM(spend),0) gasto FROM linkedin.ad_metrics_daily`),
      ]);
      res.json({
        accounts: accs.rows,
        campaignsByAccount: camps.rows,
        metrics: { dataMin: range.rows[0].mn, dataMax: range.rows[0].mx, linhas: parseInt(range.rows[0].n, 10), gastoTotal: Number(range.rows[0].gasto) },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  app.get('/api/admin/linkedin/status', isAdmin, async (_req: Request, res: Response) => {
    const pool = makePool();
    try {
      const [orgs, fol, pages] = await Promise.all([
        pool.query(`SELECT org_id, name, follower_count FROM linkedin.organizations ORDER BY name`),
        pool.query(`SELECT MAX(stat_date) ult, COUNT(*) n FROM linkedin.follower_stats_daily`),
        pool.query(`SELECT MAX(stat_date) ult, COUNT(*) n FROM linkedin.page_stats_daily`),
      ]);
      res.json({
        organizations: orgs.rows,
        followerSnapshots: { ultimo: fol.rows[0].ult, linhas: parseInt(fol.rows[0].n, 10) },
        pageSnapshots: { ultimo: pages.rows[0].ult, linhas: parseInt(pages.rows[0].n, 10) },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });
}

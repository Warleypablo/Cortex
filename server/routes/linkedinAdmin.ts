/**
 * Endpoints admin do LinkedIn orgânico.
 *
 *  POST /api/admin/linkedin/sync  → puxa seguidores + page views + engajamento (snapshot do dia)
 *  GET  /api/admin/linkedin/status → resumo: organizações + último snapshot
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

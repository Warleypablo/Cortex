/**
 * Endpoints admin do TikTok orgânico.
 *
 *  POST /api/admin/tiktok/sync-organic  → puxa perfil + vídeos + métricas (snapshot do dia)
 *  GET  /api/admin/tiktok/status        → resumo: perfil, nº de vídeos, último snapshot
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

export function registerTiktokAdminRoutes(app: Express) {
  app.post('/api/admin/tiktok/sync-organic', isAdmin, async (_req: Request, res: Response) => {
    const pool = makePool();
    try {
      const { syncTiktokOrganic } = await import('../services/tiktokOrganicSync');
      const result = await syncTiktokOrganic(pool);
      res.json({ ok: result.errors.length === 0, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  app.get('/api/admin/tiktok/status', isAdmin, async (_req: Request, res: Response) => {
    const pool = makePool();
    try {
      const [acc, vids, range] = await Promise.all([
        pool.query(`SELECT open_id, display_name, follower_count, video_count FROM tiktok.accounts ORDER BY follower_count DESC NULLS LAST`),
        pool.query(`SELECT COUNT(*) AS total FROM tiktok.videos`),
        pool.query(`SELECT MIN(snapshot_date) mn, MAX(snapshot_date) mx, COUNT(*) n FROM tiktok.video_metrics`),
      ]);
      res.json({
        accounts: acc.rows,
        videos: parseInt(vids.rows[0].total, 10),
        snapshots: { dataMin: range.rows[0].mn, dataMax: range.rows[0].mx, linhas: parseInt(range.rows[0].n, 10) },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });
}

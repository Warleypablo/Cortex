/**
 * Endpoints admin do YouTube (orgânico — Data + Analytics API).
 *
 *  POST /api/admin/youtube/sync    → snapshot dos canais + vídeos + métricas diárias
 *                                     (canal e vídeo) de todos os canais autorizados.
 *                                     Query: ?days=30 (janela das métricas diárias)
 *                                            &skipVideos=true (pula listagem de vídeos)
 *  GET  /api/admin/youtube/status  → canais autorizados, último snapshot de métricas
 *                                     diárias e últimas execuções de sync.
 *
 * Usa o `db` (Drizzle) porque `syncAllChannels` faz as queries via db.execute(sql`...`),
 * diferente dos admins de LinkedIn/TikTok que usam um Pool do `pg`.
 */

import type { Express, Request, Response } from 'express';
import { sql } from 'drizzle-orm';

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - admin only' });
  }
  next();
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function registerYoutubeAdminRoutes(app: Express, db: any) {
  // --- SYNC ---
  app.post('/api/admin/youtube/sync', isAdmin, async (req: Request, res: Response) => {
    try {
      const daysRaw = parseInt((req.query.days as string) || '30', 10);
      const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 30;
      const skipVideos = (req.query.skipVideos as string) === 'true';

      const { syncAllChannels } = await import('../services/youtubeSync');
      const result = await syncAllChannels(db, {
        startDate: isoDaysAgo(days),
        endDate: todayIso(),
        skipVideos,
      });
      res.json({ ok: result.errors.length === 0, ...result });
    } catch (e: any) {
      console.error('[youtube-admin] sync error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- STATUS ---
  app.get('/api/admin/youtube/status', isAdmin, async (_req: Request, res: Response) => {
    try {
      const [channels, dailyRange, runs] = await Promise.all([
        db.execute(sql`
          SELECT c.channel_id, c.title, c.subscriber_count, c.video_count, c.synced_at,
                 cred.google_email, cred.active
          FROM youtube.channels c
          LEFT JOIN youtube.credentials cred ON cred.id = c.credential_id
          ORDER BY c.title
        `),
        db.execute(sql`
          SELECT MIN(report_date) AS data_min, MAX(report_date) AS data_max,
                 COUNT(*) AS linhas, COALESCE(SUM(views), 0) AS views_total
          FROM youtube.channel_daily_metrics
        `),
        db.execute(sql`
          SELECT job_type, channel_id, status, started_at, finished_at, items_processed, error_message
          FROM youtube.sync_runs
          ORDER BY started_at DESC
          LIMIT 20
        `),
      ]);

      const rows = (r: any) => (r as any).rows || r;
      const range = rows(dailyRange)[0] || {};
      res.json({
        channels: rows(channels),
        channelDailyMetrics: {
          dataMin: range.data_min ?? null,
          dataMax: range.data_max ?? null,
          linhas: parseInt(range.linhas ?? '0', 10),
          viewsTotal: Number(range.views_total ?? 0),
        },
        recentRuns: rows(runs),
      });
    } catch (e: any) {
      console.error('[youtube-admin] status error:', e);
      res.status(500).json({ error: e.message });
    }
  });
}

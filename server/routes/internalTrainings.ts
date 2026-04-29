import type { Express, Request } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';

function getUserEmail(req: Request): string | null {
  const user = (req as any).user;
  return user?.email || null;
}

function getUserNome(req: Request): string {
  const user = (req as any).user;
  if (user?.name) return user.name;
  if (user?.email) return user.email.split('@')[0];
  return 'Usuário';
}

export function registerInternalTrainingsRoutes(app: Express) {
  // GET /api/treinamentos-internos/trilhas
  app.get('/api/treinamentos-internos/trilhas', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const result = await db.execute(sql`
        SELECT
          t.id,
          t.nome,
          COALESCE(v.total_videos, 0)::int AS "totalVideos",
          COALESCE(c.videos_concluidos, 0)::int AS "videosConcluidos",
          v.ultimo_modificado_em AS "ultimoVideoModificadoEm"
        FROM cortex_core.internal_video_tracks t
        LEFT JOIN (
          SELECT track_id,
                 COUNT(*) AS total_videos,
                 MAX(drive_modified_time) AS ultimo_modificado_em
          FROM cortex_core.internal_videos
          WHERE is_active = TRUE
          GROUP BY track_id
        ) v ON v.track_id = t.id
        LEFT JOIN (
          SELECT iv.track_id, COUNT(*) AS videos_concluidos
          FROM cortex_core.internal_video_completions ic
          JOIN cortex_core.internal_videos iv ON iv.id = ic.video_id
          WHERE ic.user_email = ${userEmail} AND iv.is_active = TRUE
          GROUP BY iv.track_id
        ) c ON c.track_id = t.id
        WHERE t.is_active = TRUE
        ORDER BY t.nome
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error('[treinamentos-internos] GET /trilhas error:', error);
      res.status(500).json({ error: 'Erro ao buscar trilhas' });
    }
  });

  // GET /api/treinamentos-internos/videos?trackId=:id
  app.get('/api/treinamentos-internos/videos', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { trackId } = req.query;
      if (!trackId || typeof trackId !== 'string') {
        return res.status(400).json({ error: 'trackId é obrigatório' });
      }

      const result = await db.execute(sql`
        SELECT
          v.id,
          v.nome,
          v.drive_file_id AS "driveFileId",
          v.thumbnail_url AS "thumbnailUrl",
          v.duracao_ms AS "duracaoMs",
          v.drive_modified_time AS "driveModifiedTime",
          (c.id IS NOT NULL) AS "userConcluiu",
          (l.id IS NOT NULL) AS "userCurtiu",
          (SELECT COUNT(*)::int FROM cortex_core.internal_video_likes WHERE video_id = v.id) AS "totalLikes",
          (SELECT COUNT(*)::int FROM cortex_core.internal_video_comments WHERE video_id = v.id) AS "totalComentarios"
        FROM cortex_core.internal_videos v
        LEFT JOIN cortex_core.internal_video_completions c
          ON c.video_id = v.id AND c.user_email = ${userEmail}
        LEFT JOIN cortex_core.internal_video_likes l
          ON l.video_id = v.id AND l.user_email = ${userEmail}
        WHERE v.track_id = ${trackId} AND v.is_active = TRUE
        ORDER BY v.nome
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error('[treinamentos-internos] GET /videos error:', error);
      res.status(500).json({ error: 'Erro ao buscar vídeos' });
    }
  });

  // GET /api/treinamentos-internos/videos/:id
  app.get('/api/treinamentos-internos/videos/:id', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { id } = req.params;

      const videoResult = await db.execute(sql`
        SELECT
          v.id,
          v.nome,
          v.drive_file_id AS "driveFileId",
          v.thumbnail_url AS "thumbnailUrl",
          v.duracao_ms AS "duracaoMs",
          v.drive_modified_time AS "driveModifiedTime",
          v.track_id AS "trackId",
          t.nome AS "trackNome"
        FROM cortex_core.internal_videos v
        JOIN cortex_core.internal_video_tracks t ON t.id = v.track_id
        WHERE v.id = ${id} AND v.is_active = TRUE
      `);

      if (videoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vídeo não encontrado' });
      }

      const row = videoResult.rows[0] as any;

      const [concluiuResult, curtiuResult, likesResult, comentariosResult] = await Promise.all([
        db.execute(sql`
          SELECT 1 FROM cortex_core.internal_video_completions
          WHERE video_id = ${id} AND user_email = ${userEmail}
        `),
        db.execute(sql`
          SELECT 1 FROM cortex_core.internal_video_likes
          WHERE video_id = ${id} AND user_email = ${userEmail}
        `),
        db.execute(sql`
          SELECT COUNT(*)::int AS total FROM cortex_core.internal_video_likes
          WHERE video_id = ${id}
        `),
        db.execute(sql`
          SELECT id, user_email AS "userEmail", user_nome AS "userNome",
                 conteudo, created_at AS "createdAt"
          FROM cortex_core.internal_video_comments
          WHERE video_id = ${id}
          ORDER BY created_at DESC
          LIMIT 100
        `),
      ]);

      res.json({
        video: {
          id: row.id,
          nome: row.nome,
          driveFileId: row.driveFileId,
          thumbnailUrl: row.thumbnailUrl,
          duracaoMs: row.duracaoMs,
          driveModifiedTime: row.driveModifiedTime,
        },
        trilha: { id: row.trackId, nome: row.trackNome },
        userConcluiu: concluiuResult.rows.length > 0,
        userCurtiu: curtiuResult.rows.length > 0,
        totalLikes: (likesResult.rows[0] as any).total,
        comentarios: (comentariosResult.rows as any[]).map((c) => ({
          ...c,
          isOwner: c.userEmail === userEmail,
        })),
      });
    } catch (error: any) {
      console.error('[treinamentos-internos] GET /videos/:id error:', error);
      res.status(500).json({ error: 'Erro ao buscar vídeo' });
    }
  });

  // POST /api/treinamentos-internos/videos/:id/concluir (toggle)
  app.post('/api/treinamentos-internos/videos/:id/concluir', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { id } = req.params;

      const existsResult = await db.execute(sql`
        SELECT id FROM cortex_core.internal_video_completions
        WHERE video_id = ${id} AND user_email = ${userEmail}
      `);

      if (existsResult.rows.length > 0) {
        await db.execute(sql`
          DELETE FROM cortex_core.internal_video_completions
          WHERE video_id = ${id} AND user_email = ${userEmail}
        `);
        return res.json({ concluido: false });
      }

      await db.execute(sql`
        INSERT INTO cortex_core.internal_video_completions (video_id, user_email)
        VALUES (${id}, ${userEmail})
        ON CONFLICT (video_id, user_email) DO NOTHING
      `);
      res.json({ concluido: true });
    } catch (error: any) {
      console.error('[treinamentos-internos] POST /concluir error:', error);
      res.status(500).json({ error: 'Erro ao marcar conclusão' });
    }
  });

  // POST /api/treinamentos-internos/videos/:id/like (toggle)
  app.post('/api/treinamentos-internos/videos/:id/like', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { id } = req.params;

      const existsResult = await db.execute(sql`
        SELECT id FROM cortex_core.internal_video_likes
        WHERE video_id = ${id} AND user_email = ${userEmail}
      `);

      let curtiu: boolean;
      if (existsResult.rows.length > 0) {
        await db.execute(sql`
          DELETE FROM cortex_core.internal_video_likes
          WHERE video_id = ${id} AND user_email = ${userEmail}
        `);
        curtiu = false;
      } else {
        await db.execute(sql`
          INSERT INTO cortex_core.internal_video_likes (video_id, user_email)
          VALUES (${id}, ${userEmail})
          ON CONFLICT (video_id, user_email) DO NOTHING
        `);
        curtiu = true;
      }

      const totalResult = await db.execute(sql`
        SELECT COUNT(*)::int AS total FROM cortex_core.internal_video_likes
        WHERE video_id = ${id}
      `);

      res.json({ curtiu, totalLikes: (totalResult.rows[0] as any).total });
    } catch (error: any) {
      console.error('[treinamentos-internos] POST /like error:', error);
      res.status(500).json({ error: 'Erro ao curtir vídeo' });
    }
  });

  // POST /api/treinamentos-internos/videos/:id/comentarios
  app.post('/api/treinamentos-internos/videos/:id/comentarios', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const userNome = getUserNome(req);
      const { id } = req.params;
      const { conteudo } = req.body || {};

      if (!conteudo || typeof conteudo !== 'string' || conteudo.trim().length === 0) {
        return res.status(400).json({ error: 'Conteúdo obrigatório' });
      }
      if (conteudo.length > 5000) {
        return res.status(400).json({ error: 'Conteúdo excede 5000 caracteres' });
      }

      const result = await db.execute(sql`
        INSERT INTO cortex_core.internal_video_comments (video_id, user_email, user_nome, conteudo)
        VALUES (${id}, ${userEmail}, ${userNome}, ${conteudo})
        RETURNING id, user_email AS "userEmail", user_nome AS "userNome",
                  conteudo, created_at AS "createdAt"
      `);

      const row = result.rows[0] as any;
      res.status(201).json({ ...row, isOwner: true });
    } catch (error: any) {
      console.error('[treinamentos-internos] POST /comentarios error:', error);
      res.status(500).json({ error: 'Erro ao criar comentário' });
    }
  });

  // DELETE /api/treinamentos-internos/comentarios/:id
  app.delete('/api/treinamentos-internos/comentarios/:id', async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) return res.status(401).json({ error: 'Não autenticado' });

      const { id } = req.params;

      const existsResult = await db.execute(sql`
        SELECT user_email FROM cortex_core.internal_video_comments WHERE id = ${id}
      `);

      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Comentário não encontrado' });
      }

      const ownerEmail = (existsResult.rows[0] as any).user_email;
      if (ownerEmail !== userEmail) {
        return res.status(403).json({ error: 'Sem permissão para apagar comentário de outro usuário' });
      }

      await db.execute(sql`
        DELETE FROM cortex_core.internal_video_comments WHERE id = ${id}
      `);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('[treinamentos-internos] DELETE /comentarios error:', error);
      res.status(500).json({ error: 'Erro ao excluir comentário' });
    }
  });
}

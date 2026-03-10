import type { Express } from "express";
import { pool } from "../db";

async function initFavoritesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cortex_core.user_favorites (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      page_url VARCHAR(500) NOT NULL,
      page_title VARCHAR(255) NOT NULL,
      page_icon VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, page_url)
    );
  `);
}

export function registerFavoritesRoutes(app: Express) {
  initFavoritesTable().catch((err) =>
    console.error("[favorites] Init table error:", err)
  );

  const getUserId = (req: any): string => {
    const user = req.user as any;
    return user?.googleId || user?.id || "";
  };

  // GET /api/favorites
  app.get("/api/favorites", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const result = await pool.query(
        `SELECT page_url as url, page_title as title, page_icon as icon
         FROM cortex_core.user_favorites
         WHERE user_id = $1
         ORDER BY created_at`,
        [userId]
      );
      res.json(result.rows);
    } catch (error: any) {
      console.error("[favorites] GET error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/favorites
  app.post("/api/favorites", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const { url, title, icon } = req.body;
      if (!url || !title) {
        return res.status(400).json({ error: "url e title são obrigatórios" });
      }

      await pool.query(
        `INSERT INTO cortex_core.user_favorites (user_id, page_url, page_title, page_icon)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, page_url) DO NOTHING`,
        [userId, url, title, icon || null]
      );
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[favorites] POST error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/favorites
  app.delete("/api/favorites", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "url é obrigatório" });
      }

      await pool.query(
        `DELETE FROM cortex_core.user_favorites
         WHERE user_id = $1 AND page_url = $2`,
        [userId, url]
      );
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[favorites] DELETE error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}

import type { Express } from "express";
import { desc } from "drizzle-orm";
import type { IStorage } from "../storage";
import {
  contentPosts,
  contentPublishRuns,
  contentPublishSettings,
} from "../../shared/schema";

/**
 * Painel "Orgânico" (Growth) — Fase 1, SOMENTE LEITURA.
 *
 * Lê o estado que o worker de publicação (automacoes/instagram-turbo) escreve nas
 * tabelas content_* (platform-agnósticas). Nenhuma escrita aqui ainda — os botões
 * (publicar agora / retry / aprovar legenda / pausar) entram na Fase 3 via a fila
 * content_publish_commands. Rotas /api/* já são protegidas pelo isAuthenticated global.
 */
export function registerOrganicoRoutes(app: Express, db: any, _storage: IStorage) {
  // GET /api/growth/organico/overview
  // Snapshot único pro painel: settings + saúde (último ciclo por plataforma) + fila + histórico.
  app.get("/api/growth/organico/overview", async (_req, res) => {
    try {
      const settings = await db.select().from(contentPublishSettings);

      // runs recentes → saúde = o último ciclo de cada plataforma (já vem desc por started_at)
      const recentRuns = await db
        .select()
        .from(contentPublishRuns)
        .orderBy(desc(contentPublishRuns.startedAt))
        .limit(50);
      const health: any[] = [];
      const seen = new Set<string>();
      for (const r of recentRuns) {
        if (!seen.has(r.platform)) {
          seen.add(r.platform);
          health.push(r);
        }
      }

      const posts = await db
        .select()
        .from(contentPosts)
        .orderBy(desc(contentPosts.postingDate))
        .limit(300);

      const today = new Date().toISOString().slice(0, 10);
      // Fila: hoje em diante e ainda não publicado (inclui falhou/aguardando p/ ação futura).
      const queue = posts
        .filter(
          (p: any) =>
            p.postingDate &&
            String(p.postingDate).slice(0, 10) >= today &&
            p.state !== "publicado",
        )
        .sort((a: any, b: any) =>
          String(a.postingDate).localeCompare(String(b.postingDate)),
        );
      // Histórico: o que já foi publicado (mais recente primeiro).
      const history = posts.filter((p: any) => p.state === "publicado").slice(0, 50);

      const platforms = settings.map((s: any) => s.platform);

      res.json({ today, platforms, settings, health, queue, history });
    } catch (err: any) {
      console.error("[organico] overview error:", err);
      res.status(500).json({ error: "Falha ao carregar o painel Orgânico" });
    }
  });
}

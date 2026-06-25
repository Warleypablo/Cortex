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

/**
 * Endpoint de MÁQUINA (o worker instagram-turbo reporta o estado de cada ciclo).
 * Autenticado por token compartilhado (ORGANICO_INGEST_TOKEN), NÃO por sessão —
 * por isso é registrado ANTES do `app.use("/api", isAuthenticated)` global.
 * Body: { platform, run: {...}, posts: [...] }. Insere 1 run + faz upsert dos posts.
 */
export function registerOrganicoIngestRoutes(app: Express, db: any) {
  app.post("/api/growth/organico/ingest", async (req, res) => {
    const token = process.env.ORGANICO_INGEST_TOKEN;
    if (!token) {
      return res.status(503).json({ error: "ingest não configurado (defina ORGANICO_INGEST_TOKEN)" });
    }
    if ((req.headers.authorization || "") !== `Bearer ${token}`) {
      return res.status(401).json({ error: "token inválido" });
    }

    try {
      const { platform, run, posts } = req.body || {};
      if (!platform) return res.status(400).json({ error: "platform obrigatório" });

      // 1) registra o ciclo (heartbeat / saúde do agente)
      if (run) {
        await db.insert(contentPublishRuns).values({
          runId: String(run.run_id || "—").slice(0, 16),
          platform,
          dryRun: run.dry_run !== false,
          status: run.status || "ok",
          counts: run.counts || {},
          startedAt: run.started_at ? new Date(run.started_at) : new Date(),
          finishedAt: new Date(),
        });
      }

      // 2) upsert dos posts (chave: platform + task + data). Sem data → ignora.
      let upserted = 0;
      for (const p of Array.isArray(posts) ? posts : []) {
        if (!p?.clickup_task_id || !p?.posting_date) continue;
        const row = {
          platform,
          clickupTaskId: String(p.clickup_task_id),
          taskName: p.task_name ?? null,
          parentName: p.parent_name ?? null,
          mes: p.mes ?? null,
          turboSlug: p.turbo_slug ?? null,
          postingDate: p.posting_date,
          slot: p.slot ?? null,
          tipoPost: p.tipo_post ?? null,
          assetCount: p.asset_count ?? 0,
          legendaSource: p.legenda_source ?? null,
          legendaLen: p.legenda_len ?? 0,
          legendaEmpty: p.legenda_empty ?? false,
          state: p.state || "agendado",
          skipReason: p.skip_reason ?? null,
          errorText: p.error_text ?? null,
          publishedMediaId: p.published_media_id ?? null,
          permalink: p.permalink ?? null,
          updatedAt: new Date(),
        };
        await db
          .insert(contentPosts)
          .values(row)
          .onConflictDoUpdate({
            target: [contentPosts.platform, contentPosts.clickupTaskId, contentPosts.postingDate],
            set: {
              taskName: row.taskName,
              parentName: row.parentName,
              mes: row.mes,
              turboSlug: row.turboSlug,
              slot: row.slot,
              tipoPost: row.tipoPost,
              assetCount: row.assetCount,
              legendaSource: row.legendaSource,
              legendaLen: row.legendaLen,
              legendaEmpty: row.legendaEmpty,
              state: row.state,
              skipReason: row.skipReason,
              errorText: row.errorText,
              publishedMediaId: row.publishedMediaId,
              permalink: row.permalink,
              updatedAt: row.updatedAt,
            },
          });
        upserted++;
      }

      res.json({ ok: true, run: !!run, posts: upserted });
    } catch (err: any) {
      console.error("[organico] ingest error:", err);
      res.status(500).json({ error: "falha no ingest" });
    }
  });
}

import type { Express } from "express";
import { desc, asc, eq, ne, and, or, lt, notInArray, sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import {
  contentPosts,
  contentPublishRuns,
  contentPublishSettings,
  contentPublishCommands,
} from "../../shared/schema";

// Ações aceitas na fila content_publish_commands (espelha o vocabulário do schema).
const ALLOWED_ACTIONS = new Set([
  "publish_now",      // Soltar post agora
  "schedule",         // Agendar post (payload.scheduled_at)
  "cancel_schedule",  // Cancelar agendamento
  "retry",
  "skip",
  "approve_caption",
  "edit_caption",
  "pause_agent",
  "resume_agent",
]);
// Ações globais (sem task): pausar/retomar o agente da plataforma inteira.
const GLOBAL_ACTIONS = new Set(["pause_agent", "resume_agent"]);

/**
 * Painel "Orgânico" (Growth) — leitura + ações do operador.
 *
 * Lê o estado que o worker de publicação (automacoes/instagram-turbo) escreve nas tabelas
 * content_* (platform-agnósticas) e ENFILEIRA comandos do operador em content_publish_commands.
 * O backend NUNCA chama o Python: as ações viram linhas `pending` que o worker-poller consome
 * e reflete de volta via /ingest. Rotas /api/* já são protegidas pelo isAuthenticated global.
 */
export function registerOrganicoRoutes(app: Express, db: any, _storage: IStorage, isAdmin: any) {
  // GET /api/growth/organico/overview
  // Snapshot pro painel: settings + saúde + as 3 visões do dia (aprovados / agendados / publicados).
  app.get("/api/growth/organico/overview", async (_req, res) => {
    try {
      // NOTA (Fase 3): hoje qualquer usuário autenticado lê TODOS os cards aqui.
      // O "acesso mínimo" de leitura (cardista vê só os dela) precisa de coluna `owner`
      // em content_posts + redação de campos no front — feito junto na Fase 3. Mascarar
      // só a prévia da legenda seria ilusório (o clickupUrl leva à legenda completa).
      const settings = await db.select().from(contentPublishSettings);

      // saúde = o último ciclo de cada plataforma (runs já vêm desc por started_at)
      const recentRuns = await db
        .select()
        .from(contentPublishRuns)
        .orderBy(desc(contentPublishRuns.startedAt))
        .limit(50);
      const health: any[] = [];
      const seenPlat = new Set<string>();
      for (const r of recentRuns) {
        if (!seenPlat.has(r.platform)) {
          seenPlat.add(r.platform);
          health.push(r);
        }
      }

      const posts = await db
        .select()
        .from(contentPosts)
        .orderBy(desc(contentPosts.postingDate))
        .limit(500);

      // Datas em America/Sao_Paulo. CUIDADO: colunas `date` (postingDate) voltam como
      // string "YYYY-MM-DD" e NÃO podem passar por fuso (deslocaria o dia); colunas
      // timestamptz (updatedAt/scheduledAt) voltam como Date e PRECISAM de fuso —
      // por isso String(Date).slice(0,10) dava "Mon Jun 29" e a comparação nunca casava.
      const SP = "America/Sao_Paulo";
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: SP }).format(new Date());
      const dayStr = (d: any) => (d ? String(d).slice(0, 10) : ""); // colunas date (postingDate)
      const dayTZ = (d: any) => {
        // colunas timestamptz (updatedAt): normaliza pro dia em SP
        if (!d) return "";
        const dt = new Date(d);
        return isNaN(dt.getTime())
          ? String(d).slice(0, 10)
          : new Intl.DateTimeFormat("en-CA", { timeZone: SP }).format(dt);
      };
      const schedMs = (p: any) => {
        const v = p.scheduledAt ?? p.cardScheduledAt ?? p.postingDate;
        const t = v ? new Date(v).getTime() : NaN;
        return isNaN(t) ? Infinity : t;
      };
      const byDateAsc = (a: any, b: any) =>
        dayStr(a.postingDate).localeCompare(dayStr(b.postingDate));
      const bySchedAsc = (a: any, b: any) => schedMs(a) - schedMs(b);

      // (A) APROVADOS — prontos/esperando legenda, SEM horário (operador nem card) nem publicação.
      // Com horário-por-card, um card com data+hora já tem card_scheduled_at → cai em AGENDADOS.
      // Aqui sobram os que precisam de atenção: sem data/hora definidos.
      const aprovados = posts
        .filter(
          (p: any) =>
            (p.state === "aprovado" || p.state === "aguardando_ia") &&
            !p.scheduledAt && !p.cardScheduledAt,
        )
        .sort(byDateAsc);

      // (B) AGENDADOS — têm horário-alvo: operador (scheduled_at) OU card (card_scheduled_at).
      const agendados = posts
        .filter(
          (p: any) =>
            p.state !== "publicado" &&
            (p.scheduledAt || p.cardScheduledAt || p.state === "agendado"),
        )
        .sort(bySchedAsc);

      // (C) PUBLICADOS DO DIA — publicados hoje (updatedAt = carimbo da publicação).
      const publicados = posts
        .filter((p: any) => p.state === "publicado" && dayTZ(p.updatedAt) === today)
        .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const platforms = settings.map((s: any) => s.platform);

      res.json({
        today,
        platforms,
        settings,
        health,
        aprovados,
        agendados,
        publicados,
        posts,   // conjunto completo (até 500) — alimenta a visão de Calendário
        // compat: visões antigas (fila/histórico) — até o frontend novo assumir.
        queue: [...aprovados, ...agendados],
        history: posts.filter((p: any) => p.state === "publicado").slice(0, 50),
      });
    } catch (err: any) {
      console.error("[organico] overview error:", err);
      res.status(500).json({ error: "Falha ao carregar o painel Orgânico" });
    }
  });

  // POST /api/growth/organico/commands — enfileira uma ação do operador (Soltar agora / Agendar / ...).
  app.post("/api/growth/organico/commands", isAdmin, async (req, res) => {
    try {
      const { platform, clickupTaskId, action } = req.body || {};
      let payload = req.body?.payload;
      if (!platform) return res.status(400).json({ error: "platform obrigatório" });
      if (!action || !ALLOWED_ACTIONS.has(action))
        return res.status(400).json({ error: "ação inválida" });
      if (!GLOBAL_ACTIONS.has(action) && !clickupTaskId)
        return res.status(400).json({ error: "clickupTaskId obrigatório para esta ação" });

      payload = payload && typeof payload === "object" ? payload : {};

      // "Agendar" exige um horário futuro válido.
      if (action === "schedule") {
        const when = new Date(payload.scheduled_at);
        if (!payload.scheduled_at || isNaN(when.getTime()))
          return res.status(400).json({ error: "scheduled_at inválido" });
        if (when.getTime() < Date.now() - 60_000)
          return res.status(400).json({ error: "scheduled_at precisa ser no futuro" });
        payload = { ...payload, scheduled_at: when.toISOString() };
      }

      // Idempotência leve: não duplica comando pending igual (mesma task + ação).
      if (clickupTaskId && (action === "publish_now" || action === "schedule")) {
        const existing = await db
          .select()
          .from(contentPublishCommands)
          .where(
            and(
              eq(contentPublishCommands.platform, platform),
              eq(contentPublishCommands.clickupTaskId, String(clickupTaskId)),
              eq(contentPublishCommands.action, action),
              eq(contentPublishCommands.status, "pending"),
            ),
          )
          .limit(1);
        if (existing.length) {
          return res.json({ ok: true, command: existing[0], deduped: true });
        }
      }

      const requestedBy =
        (req.user as any)?.email || (req.user as any)?.name || null;
      const [cmd] = await db
        .insert(contentPublishCommands)
        .values({
          platform,
          clickupTaskId: clickupTaskId ? String(clickupTaskId) : null,
          action,
          payload,
          status: "pending",
          requestedBy,
        })
        .returning();

      res.json({ ok: true, command: cmd });
    } catch (err: any) {
      console.error("[organico] command error:", err);
      res.status(500).json({ error: "falha ao enfileirar comando" });
    }
  });

  // POST /api/growth/organico/settings — pausa/retoma o agente e alterna dry-run por plataforma.
  app.post("/api/growth/organico/settings", isAdmin, async (req, res) => {
    try {
      const { platform, agentEnabled, dryRun } = req.body || {};
      if (!platform) return res.status(400).json({ error: "platform obrigatório" });

      const set: any = {
        updatedAt: new Date(),
        updatedBy: (req.user as any)?.email || null,
      };
      if (typeof agentEnabled === "boolean") set.agentEnabled = agentEnabled;
      if (typeof dryRun === "boolean") set.dryRun = dryRun;

      const [row] = await db
        .update(contentPublishSettings)
        .set(set)
        .where(eq(contentPublishSettings.platform, platform))
        .returning();
      if (!row) return res.status(404).json({ error: "plataforma não encontrada" });

      res.json({ ok: true, settings: row });
    } catch (err: any) {
      console.error("[organico] settings error:", err);
      res.status(500).json({ error: "falha ao salvar settings" });
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
  // Guard de token compartilhado (worker↔Cortex). Retorna true se ok; senão responde e retorna false.
  const requireToken = (req: any, res: any): boolean => {
    const token = process.env.ORGANICO_INGEST_TOKEN;
    if (!token) {
      res.status(503).json({ error: "ingest não configurado (defina ORGANICO_INGEST_TOKEN)" });
      return false;
    }
    if ((req.headers.authorization || "") !== `Bearer ${token}`) {
      res.status(401).json({ error: "token inválido" });
      return false;
    }
    return true;
  };

  // Claim travado (publish que crashou) expira após este tempo e o post volta à fila.
  // Maior que o pior caso de upload (reel ~10 min) p/ não roubar um publish em andamento.
  const STALE_CLAIM_MS = 15 * 60_000;

  // POST /api/growth/organico/posts/claim  body: { platform, clickupTaskId }
  // Claim ATÔMICO p/ evitar post DUPLICADO em crons de publish sobrepostos (um reel pode
  // levar até 10 min > 5 min do cron). O UPDATE condicional é atômico no Postgres: das N
  // chamadas concorrentes, só UMA casa o WHERE e flipa state→'publicando'; as outras pegam
  // 0 linhas (claimed:false) e NÃO publicam. Claims travados (>STALE_CLAIM_MS) são reclamáveis.
  app.post("/api/growth/organico/posts/claim", async (req, res) => {
    if (!requireToken(req, res)) return;
    try {
      const { platform, clickupTaskId } = req.body || {};
      if (!platform || !clickupTaskId)
        return res.status(400).json({ error: "platform e clickupTaskId obrigatórios" });
      const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
      const rows = await db
        .update(contentPosts)
        .set({ state: "publicando", updatedAt: new Date() })
        .where(
          and(
            eq(contentPosts.platform, platform),
            eq(contentPosts.clickupTaskId, String(clickupTaskId)),
            or(
              and(ne(contentPosts.state, "publicado"), ne(contentPosts.state, "publicando")),
              and(eq(contentPosts.state, "publicando"), lt(contentPosts.updatedAt, staleBefore)),
            ),
          ),
        )
        .returning();
      res.json({ ok: true, claimed: rows.length > 0 });
    } catch (err: any) {
      console.error("[organico] claim error:", err);
      res.status(500).json({ error: "falha no claim" });
    }
  });

  // GET /api/growth/organico/commands/pending?platform=instagram
  // O worker-poller puxa os comandos pending da sua plataforma (mais antigos primeiro).
  app.get("/api/growth/organico/commands/pending", async (req, res) => {
    if (!requireToken(req, res)) return;
    try {
      const platform = String(req.query.platform || "");
      if (!platform) return res.status(400).json({ error: "platform obrigatório" });
      const cmds = await db
        .select()
        .from(contentPublishCommands)
        .where(
          and(
            eq(contentPublishCommands.platform, platform),
            eq(contentPublishCommands.status, "pending"),
          ),
        )
        .orderBy(asc(contentPublishCommands.createdAt))
        .limit(50);
      res.json({ commands: cmds });
    } catch (err: any) {
      console.error("[organico] pending error:", err);
      res.status(500).json({ error: "falha ao listar comandos" });
    }
  });

  // POST /api/growth/organico/commands/:id/ack  body: { status, result?, error? }
  // O worker marca running → done|failed conforme executa.
  app.post("/api/growth/organico/commands/:id/ack", async (req, res) => {
    if (!requireToken(req, res)) return;
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
      const { status, result, error } = req.body || {};
      if (!["running", "done", "failed", "canceled"].includes(status))
        return res.status(400).json({ error: "status inválido" });

      const set: any = { status };
      if (status === "running") set.consumedAt = new Date();
      if (status === "done" || status === "failed" || status === "canceled") set.finishedAt = new Date();
      if (result !== undefined) set.result = result;
      if (error !== undefined) set.errorText = String(error).slice(0, 2000);

      const [row] = await db
        .update(contentPublishCommands)
        .set(set)
        .where(eq(contentPublishCommands.id, id))
        .returning();
      if (!row) return res.status(404).json({ error: "comando não encontrado" });
      res.json({ ok: true, command: row });
    } catch (err: any) {
      console.error("[organico] ack error:", err);
      res.status(500).json({ error: "falha no ack" });
    }
  });

  // GET /api/growth/organico/posts/due?platform=instagram
  // Posts cujo horário EFETIVO já venceu DENTRO DE HOJE e ainda não publicaram.
  // Efetivo = COALESCE(scheduled_at do operador, card_scheduled_at do card). A janela
  // é [início do dia em SP, agora]: um horário que caiu num dia ANTERIOR não entra aqui
  // (= "perdeu o horário" — não dispara sozinho, fica pro operador resolver no painel).
  // O worker-poller publica cada um e reporta de volta via /ingest.
  app.get("/api/growth/organico/posts/due", async (req, res) => {
    if (!requireToken(req, res)) return;
    try {
      const platform = String(req.query.platform || "");
      if (!platform) return res.status(400).json({ error: "platform obrigatório" });
      const now = new Date();
      // início do dia em São Paulo (UTC-3, sem horário de verão desde 2019).
      const ymdSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
      const startOfDaySP = new Date(`${ymdSP}T00:00:00-03:00`);
      const eff = (p: any): Date | null => {
        const v = p.scheduledAt ?? p.cardScheduledAt;
        return v ? new Date(v) : null;
      };
      // Exclui terminais (publicado/falhou/pulado) e os 'publicando' ainda FRESCOS
      // (claim em andamento). Um 'publicando' travado > STALE_CLAIM_MS volta à fila.
      const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
      const candidates = await db
        .select()
        .from(contentPosts)
        .where(
          and(
            eq(contentPosts.platform, platform),
            notInArray(contentPosts.state, ["publicado", "falhou", "pulado"]),
            or(
              ne(contentPosts.state, "publicando"),
              lt(contentPosts.updatedAt, staleBefore),
            ),
          ),
        )
        .limit(500);
      const due = candidates
        .filter((p: any) => {
          const t = eff(p);
          return t !== null && t >= startOfDaySP && t <= now;
        })
        .sort((a: any, b: any) => (eff(a)!.getTime() - eff(b)!.getTime()))
        .slice(0, 20);
      res.json({ posts: due });
    } catch (err: any) {
      console.error("[organico] due error:", err);
      res.status(500).json({ error: "falha ao listar vencidos" });
    }
  });

  app.post("/api/growth/organico/ingest", async (req, res) => {
    if (!requireToken(req, res)) return;

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

      // 2) upsert dos posts. Chave estável = (platform, task) — tolera posts SEM data
      //    (aprovados ainda sem agendamento). scheduled_at só é tocado se o worker mandar.
      let upserted = 0;
      for (const p of Array.isArray(posts) ? posts : []) {
        if (!p?.clickup_task_id) continue;
        // scheduled_at: chave ausente = mantém; null = limpa (cancelar); valor = grava (agendar)
        const schedKey = Object.prototype.hasOwnProperty.call(p, "scheduled_at");
        const schedVal = schedKey ? (p.scheduled_at ? new Date(p.scheduled_at) : null) : undefined;
        // card_scheduled_at: horário-alvo derivado do card (domínio do worker). Mesma
        // semântica de chave: ausente = mantém; null = limpa; valor = grava.
        const cardSchedKey = Object.prototype.hasOwnProperty.call(p, "card_scheduled_at");
        const cardSchedVal = cardSchedKey ? (p.card_scheduled_at ? new Date(p.card_scheduled_at) : null) : undefined;
        const insert: any = {
          platform,
          clickupTaskId: String(p.clickup_task_id),
          taskName: p.task_name ?? null,
          parentName: p.parent_name ?? null,
          mes: p.mes ?? null,
          turboSlug: p.turbo_slug ?? null,
          postingDate: p.posting_date ?? null,
          postingTime: p.posting_time ?? null,
          slot: p.slot ?? null,
          tipoPost: p.tipo_post ?? null,
          assetCount: p.asset_count ?? 0,
          legendaSource: p.legenda_source ?? null,
          legendaLen: p.legenda_len ?? 0,
          legendaEmpty: p.legenda_empty ?? false,
          legendaPreview: p.legenda_preview ?? null,
          state: p.state || "agendado",
          readiness: p.readiness ?? null,
          blockReasons: p.block_reasons ?? null,
          skipReason: p.skip_reason ?? null,
          errorText: p.error_text ?? null,
          publishedMediaId: p.published_media_id ?? null,
          permalink: p.permalink ?? null,
          publishedAt: (p.state || "agendado") === "publicado" ? new Date() : null,
          clickupUrl: p.clickup_url ?? null,
          lastRunId: run?.run_id ? String(run.run_id).slice(0, 16) : null,
          updatedAt: new Date(),
        };
        if (schedKey) insert.scheduledAt = schedVal;
        if (cardSchedKey) insert.cardScheduledAt = cardSchedVal;

        const set: any = {
          taskName: insert.taskName,
          parentName: insert.parentName,
          mes: insert.mes,
          turboSlug: insert.turboSlug,
          postingDate: insert.postingDate,
          postingTime: insert.postingTime,
          slot: insert.slot,
          tipoPost: insert.tipoPost,
          assetCount: insert.assetCount,
          legendaSource: insert.legendaSource,
          legendaLen: insert.legendaLen,
          legendaEmpty: insert.legendaEmpty,
          legendaPreview: insert.legendaPreview,
          // NUNCA rebaixa um post já publicado: o worker re-reporta cards já-postados
          // no formato pré-publicação (state 'agendado', permalink null) e isso apagava
          // o histórico — foi exatamente o que sumiu com o 1º post automático (06/jul).
          state: sql`CASE WHEN content_posts.state = 'publicado' AND excluded.state <> 'publicado'
                          THEN content_posts.state ELSE excluded.state END`,
          readiness: insert.readiness,
          blockReasons: insert.blockReasons,
          skipReason: insert.skipReason,
          errorText: insert.errorText,
          // permalink/media_id só avançam (null do worker não apaga o que já foi salvo)
          publishedMediaId: sql`COALESCE(excluded.published_media_id, content_posts.published_media_id)`,
          permalink: sql`COALESCE(excluded.permalink, content_posts.permalink)`,
          // carimbo REAL da publicação: marca na 1ª transição pra 'publicado' e nunca mais move
          // (updated_at deriva a cada report e não serve pra medir pontualidade)
          publishedAt: sql`CASE WHEN excluded.state = 'publicado' AND content_posts.published_at IS NULL
                                THEN now() ELSE content_posts.published_at END`,
          clickupUrl: insert.clickupUrl,
          lastRunId: insert.lastRunId,
          updatedAt: insert.updatedAt,
        };
        // só toca scheduled_at quando o worker manda a chave (evita zerar agendamento do operador)
        if (schedKey) set.scheduledAt = schedVal;
        if (cardSchedKey) set.cardScheduledAt = cardSchedVal;

        await db
          .insert(contentPosts)
          .values(insert)
          .onConflictDoUpdate({
            target: [contentPosts.platform, contentPosts.clickupTaskId],
            set,
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

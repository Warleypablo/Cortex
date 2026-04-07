import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configurePassport, logOAuthSetupInstructions } from "./auth/config";
import { pool as dbPool } from "./db";
import { initializePgTrgmExtension, initializeNotificationsTable, initializeSystemFieldOptionsTable, initializeNotificationRulesTable, initializeOnboardingTables, initializeCatalogTables, initializeSystemFieldsTable, initializeSysSchema, initializeDashboardTables, seedDefaultDashboardViews, initializeTurboEventosTable, initializeRhPagamentosTable, initializeRhPesquisasTables, initializeRhComentariosTables, initializeDfcSnapshotsTable, initializeSalesGoalsTable, initializeCupDataHistTable, createPerformanceIndexes, initializeBpSnapshotsTable, seedBpSnapshotJaneiro2026, initializeRhNpsTable, initializeRhNpsConfigTable, initializeClientCredentialsTable, initializeChamadosTables, seedChamadoCategories, initializeNotasFiscaisTable, initializeCapacityTable, initializeContratoTemplatesTable, initializeMetricRulesetsTables, migrateMetricRulesetsContext } from "./db";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { initTurbodashTable } from "./services/turbodash";
import rateLimit from "express-rate-limit";
import path from "path";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} is required`);
  return val;
}

const app = express();

app.set("trust proxy", 1);

// Servir assets públicos (og-image, favicon) ANTES de auth para crawlers (WhatsApp, etc.)
app.use(express.static(path.resolve(import.meta.dirname, "..", "client", "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limiting - proteção contra abuso
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // 200 requests por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 tentativas de login por 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
});
app.use("/api/auth/login", authLimiter);
app.use("/auth/google", authLimiter);

function createSessionStore() {
  // Reuse the main database pool for sessions to avoid exhausting connection slots
  if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD) {
    const PgSession = connectPgSimple(session);
    return new PgSession({
      pool: dbPool,
      tableName: 'session',
      createTableIfMissing: true,
    });
  }
  console.log("DB credentials not set, using memory session store");
  return undefined;
}

app.use(
  session({
    store: createSessionStore(),
    secret: requireEnv("SESSION_SECRET"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
    },
  })
);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Enable extensions first
  await initializePgTrgmExtension();

  // Parallel Phase 1: Independent table initializations
  await Promise.all([
    initializeNotificationsTable(),
    initializeSystemFieldOptionsTable(),
    initializeNotificationRulesTable(),
    initializeOnboardingTables(),
    initializeCatalogTables(),
    initializeSystemFieldsTable(),
    initializeDashboardTables(),
    initTurbodashTable(),
    initializeTurboEventosTable(),
    initializeRhPagamentosTable(),
    initializeRhPesquisasTables(),
    initializeRhNpsTable(),
    initializeRhNpsConfigTable(),
    initializeRhComentariosTables(),
    initializeDfcSnapshotsTable(),
    initializeSalesGoalsTable(),
    initializeCupDataHistTable(),
    initializeBpSnapshotsTable(),
    initializeClientCredentialsTable(),
    initializeChamadosTables(),
    initializeNotasFiscaisTable(),
    initializeCapacityTable(),
    initializeContratoTemplatesTable(),
    initializeMetricRulesetsTables(),
  ]);

  // Phase 1.5: Migrations that depend on tables existing
  await migrateMetricRulesetsContext();

  // Phase 2: Depends on catalogs being ready
  await initializeSysSchema();
  
  // Phase 3: Seeding (depends on tables existing)
  await Promise.all([
    seedDefaultDashboardViews(),
    seedChamadoCategories(),
  ]);
  
  // Phase 4: Create performance indexes on external database tables
  await createPerformanceIndexes();
  
  // Phase 5: Seed BP snapshot for January 2026
  await seedBpSnapshotJaneiro2026();
  
  // Register Object Storage routes
  registerObjectStorageRoutes(app);
  
  const server = await registerRoutes(app);

  // Job automático para criar snapshot diário de contratos
  async function createDailySnapshot() {
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Verificar se já existe snapshot para hoje
      const existingSnapshot = await db.execute(sql`
        SELECT COUNT(*) as count FROM "Clickup".cup_data_hist 
        WHERE DATE(data_snapshot) = ${today}::date
      `);
      
      if (parseInt((existingSnapshot.rows[0] as any)?.count || '0') > 0) {
        console.log(`[snapshot-job] Snapshot já existe para ${today}, pulando...`);
        return;
      }
      
      // Inserir snapshot dos contratos atuais usando colunas existentes na tabela
      await db.execute(sql`
        INSERT INTO "Clickup".cup_data_hist (data_snapshot, servico, status, valorr, valorp, id_task, id_subtask, 
                                   data_inicio, data_encerramento, data_pausa, squad, produto, responsavel, cs_responsavel, vendedor)
        SELECT 
          CURRENT_TIMESTAMP,
          servico, status, valorr, valorp, id_task, id_subtask,
          data_inicio, data_encerramento, data_pausa, squad, produto, responsavel, cs_responsavel, vendedor
        FROM "Clickup".cup_contratos
      `);
      
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM "Clickup".cup_data_hist 
        WHERE DATE(data_snapshot) = CURRENT_DATE
      `);
      
      const recordCount = parseInt((countResult.rows[0] as any)?.count || '0');
      console.log(`[snapshot-job] Snapshot criado para ${today} com ${recordCount} contratos`);
    } catch (error) {
      console.error('[snapshot-job] Erro ao criar snapshot diário:', error);
    }
  }
  
  // Executar snapshot na inicialização
  setTimeout(() => createDailySnapshot(), 5000);

  // Meta Ads auto-sync a cada 6 horas
  const META_SYNC_INTERVAL = 6 * 60 * 60 * 1000; // 6h
  const runMetaSync = async () => {
    try {
      console.log("[meta-sync-job] Starting scheduled Meta Ads sync...");
      const { syncMetaAds } = await import("./services/metaAdsSync");
      const { Pool } = await import("pg");
      const pool = new Pool({
        host: process.env.DB_HOST || process.env.DATABASE_HOST || '',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'dados_turbo',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
        ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === "false" ? false : { rejectUnauthorized: false },
      });
      const result = await syncMetaAds(pool, { since: undefined, until: undefined });
      await pool.end();
      // Store last sync result globally
      (globalThis as any).__metaSyncStatus = {
        lastSync: new Date().toISOString(),
        result,
        status: result.errors.length === 0 ? "success" : "partial",
      };
      console.log(`[meta-sync-job] Sync complete: ${result.campaigns} campaigns, ${result.ads} ads, ${result.insights} insights`);
    } catch (err: any) {
      console.error("[meta-sync-job] Sync failed:", err.message);
      (globalThis as any).__metaSyncStatus = {
        lastSync: new Date().toISOString(),
        result: null,
        status: "error",
        error: err.message,
      };
    }
  };
  // First sync 30s after startup, then every 6 hours
  setTimeout(() => runMetaSync(), 30000);
  setInterval(() => runMetaSync(), META_SYNC_INTERVAL);
  console.log(`[meta-sync-job] Scheduled every ${META_SYNC_INTERVAL / 3600000}h`);

  // Google Ads keywords sync a cada 12 horas
  const GOOGLE_ADS_SYNC_INTERVAL = 12 * 60 * 60 * 1000; // 12h
  const runGoogleAdsSync = async () => {
    try {
      console.log("[google-ads-sync-job] Starting scheduled Google Ads keywords sync...");
      const { syncGoogleAdsKeywords } = await import("./services/googleAdsSync");
      const { Pool } = await import("pg");
      const pool = new Pool({
        host: process.env.DB_HOST || process.env.DATABASE_HOST || '',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'dados_turbo',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
        ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === "false" ? false : { rejectUnauthorized: false },
      });
      const result = await syncGoogleAdsKeywords(pool);
      await pool.end();
      (globalThis as any).__googleAdsSyncStatus = {
        lastSync: new Date().toISOString(),
        result,
        status: result.errors.length === 0 ? "success" : "partial",
      };
      console.log(`[google-ads-sync-job] Sync complete: ${result.keywords} keywords, ${result.keywordMetrics} metric rows`);
    } catch (err: any) {
      console.error("[google-ads-sync-job] Sync failed:", err.message);
      (globalThis as any).__googleAdsSyncStatus = {
        lastSync: new Date().toISOString(),
        result: null,
        status: "error",
        error: err.message,
      };
    }
  };
  // First sync 60s after startup, then every 12 hours
  setTimeout(() => runGoogleAdsSync(), 60000);
  setInterval(() => runGoogleAdsSync(), GOOGLE_ADS_SYNC_INTERVAL);
  console.log(`[google-ads-sync-job] Scheduled every ${GOOGLE_ADS_SYNC_INTERVAL / 3600000}h`);

  // Agendar snapshot diário às 00:05
  const scheduleNextSnapshot = () => {
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 5, 0, 0);
    const msUntilNext = next.getTime() - now.getTime();
    
    setTimeout(() => {
      createDailySnapshot();
      scheduleNextSnapshot();
    }, msUntilNext);
    
    console.log(`[snapshot-job] Próximo snapshot agendado para ${next.toISOString()}`);
  };
  scheduleNextSnapshot();

  // Assinafy signature polling — verifica status de contratos pendentes a cada 5 min
  const ASSINAFY_POLL_INTERVAL = 5 * 60 * 1000; // 5 min
  const pollAssinafyStatus = async () => {
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');

      // Buscar configs separadas: clientes (staging) e creators (cortex_core)
      const clientConfigResult = await db.execute(sql`
        SELECT api_key, api_url FROM staging.assinafy_config WHERE ativo = true LIMIT 1
      `);
      const creatorConfigResult = await db.execute(sql`
        SELECT api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'creators' LIMIT 1
      `);
      // Fallback: se não houver config específica de creators, tenta qualquer uma de cortex_core
      const creatorConfigFallback = creatorConfigResult.rows[0] ? null : await db.execute(sql`
        SELECT api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true LIMIT 1
      `);

      const clientConfig = clientConfigResult.rows[0] as any;
      const creatorConfig = (creatorConfigResult.rows[0] || creatorConfigFallback?.rows[0]) as any;

      if (!clientConfig?.api_key && !creatorConfig?.api_key) return;

      // Contratos de clientes pendentes
      const clientContratos = clientConfig?.api_key ? await db.execute(sql`
        SELECT id, assinafy_document_id, status, assinafy_status
        FROM staging.contratos
        WHERE assinafy_document_id IS NOT NULL
          AND status IN ('enviado para assinatura', 'enviado')
          AND signature_completed_at IS NULL
      `) : { rows: [] };

      // Contratos de creators pendentes
      const creatorContratos = creatorConfig?.api_key ? await db.execute(sql`
        SELECT id, assinafy_document_id, status, assinafy_status
        FROM cortex_core.contratos_creators
        WHERE assinafy_document_id IS NOT NULL
          AND status = 'enviado'
          AND assinado_em IS NULL
      `) : { rows: [] };

      const pending = [
        ...((clientContratos.rows as any[]).map(r => ({ ...r, tipo: 'cliente' }))),
        ...((creatorContratos.rows as any[]).map(r => ({ ...r, tipo: 'creator' }))),
      ];

      if (pending.length === 0) return;

      console.log(`[assinafy-poll] Verificando ${pending.length} contrato(s) pendente(s) (${(clientContratos.rows as any[]).length} clientes, ${(creatorContratos.rows as any[]).length} creators)`);

      let updated = 0;
      for (const c of pending) {
        try {
          // Usar a config correta conforme o tipo de contrato
          const cfg = c.tipo === 'creator' ? creatorConfig : clientConfig;
          if (!cfg?.api_key) continue;

          const statusUrl = `${cfg.api_url}/documents/${c.assinafy_document_id}`;
          const resp = await fetch(statusUrl, { method: 'GET', headers: { 'X-Api-Key': cfg.api_key } });

          if (!resp.ok) {
            // Se 403, tentar com a outra config (documento pode ter sido criado com outra conta)
            const altCfg = c.tipo === 'creator' ? clientConfig : creatorConfig;
            if (resp.status === 403 && altCfg?.api_key) {
              const altResp = await fetch(`${altCfg.api_url}/documents/${c.assinafy_document_id}`, {
                method: 'GET', headers: { 'X-Api-Key': altCfg.api_key }
              });
              if (altResp.ok) {
                const altResult = await altResp.json() as any;
                const altStatus = altResult.data?.status || (typeof altResult.status === 'string' ? altResult.status : null);
                console.log(`[assinafy-poll] Doc ${c.assinafy_document_id} (${c.tipo} #${c.id}): encontrado via config alternativa, status=${altStatus}`);
                if (altStatus) {
                  const isAssinado = altStatus === 'signed' || altStatus === 'completed' || altStatus === 'certificated';
                  const isRecusado = altStatus === 'declined';
                  if (c.tipo === 'creator') {
                    if (isAssinado) {
                      await db.execute(sql`
                        UPDATE cortex_core.contratos_creators SET status = 'assinado', assinafy_status = 'signed', assinado_em = NOW(), etapa_pagamento = 'producao', atualizado_em = NOW()
                        WHERE id = ${c.id}
                      `);
                      updated++;
                    } else if (isRecusado) {
                      await db.execute(sql`
                        UPDATE cortex_core.contratos_creators SET status = 'recusado', assinafy_status = 'declined', atualizado_em = NOW()
                        WHERE id = ${c.id}
                      `);
                      updated++;
                    } else {
                      await db.execute(sql`
                        UPDATE cortex_core.contratos_creators SET assinafy_status = ${altStatus}, atualizado_em = NOW()
                        WHERE id = ${c.id}
                      `);
                    }
                  }
                }
                continue;
              }
            }
            // Ambas configs falharam com 403 — documento órfão, resetar para rascunho
            if (resp.status === 403 && c.tipo === 'creator') {
              await db.execute(sql`
                UPDATE cortex_core.contratos_creators
                SET status = 'rascunho', assinafy_status = NULL, assinafy_document_id = NULL, enviado_em = NULL, atualizado_em = NOW()
                WHERE id = ${c.id}
              `);
              console.log(`[assinafy-poll] Doc órfão ${c.assinafy_document_id} (creator #${c.id}) resetado para rascunho — reenvio necessário`);
              updated++;
            } else {
              console.error(`[assinafy-poll] HTTP ${resp.status} ao consultar doc ${c.assinafy_document_id} (${c.tipo} #${c.id})`);
            }
            continue;
          }

          const result = await resp.json() as any;
          const docStatus = result.data?.status || (typeof result.status === 'string' ? result.status : null);

          if (!docStatus) {
            console.warn(`[assinafy-poll] Status vazio para doc ${c.assinafy_document_id} (${c.tipo}), response:`, JSON.stringify(result).slice(0, 200));
            continue;
          }

          if (docStatus === c.assinafy_status) continue;

          const isAssinado = docStatus === 'signed' || docStatus === 'completed' || docStatus === 'certificated';
          const isRecusado = docStatus === 'declined';

          console.log(`[assinafy-poll] Doc ${c.assinafy_document_id} (${c.tipo} #${c.id}): ${c.assinafy_status} → ${docStatus}${isAssinado ? ' ✓ ASSINADO' : isRecusado ? ' ✗ RECUSADO' : ''}`);

          if (c.tipo === 'cliente') {
            if (isAssinado) {
              await db.execute(sql`
                UPDATE staging.contratos SET status = 'assinado', assinafy_status = 'signed', signature_completed_at = NOW(), data_atualizacao = NOW()
                WHERE id = ${c.id}
              `);
              // Mover deal no Bitrix para "Negócio Ganho" (2 etapas: pipeline transfer + WON)
              try {
                const idCrmResult = await db.execute(sql`SELECT id_crm FROM staging.contratos WHERE id = ${c.id}`);
                const idCrm = (idCrmResult.rows[0] as any)?.id_crm;
                const bitrixWebhook = process.env.BITRIX_WEBHOOK_URL;
                if (idCrm && bitrixWebhook) {
                  const parsedDealId = parseInt(idCrm);
                  // Buscar pipeline atual
                  const getRes = await fetch(`${bitrixWebhook}/crm.deal.get?id=${parsedDealId}`);
                  if (getRes.ok) {
                    const getData = await getRes.json();
                    const catId = getData.result?.CATEGORY_ID;
                    // Se não está no default, mover via WON do pipeline atual
                    if (catId !== '0' && catId !== 0) {
                      await fetch(`${bitrixWebhook}/crm.deal.update`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: parsedDealId, fields: { STAGE_ID: `C${catId}:WON` } }),
                      });
                      await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    // Agora mover para WON no pipeline default
                    const bRes = await fetch(`${bitrixWebhook}/crm.deal.update`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: parsedDealId, fields: { STAGE_ID: 'WON' } }),
                    });
                    if (bRes.ok) {
                      await db.execute(sql`UPDATE "Bitrix".crm_deal SET stage_name = 'Negócio Ganho', date_modify = NOW() WHERE id = ${parsedDealId}`);
                      console.log(`[assinafy-poll] Bitrix deal ${idCrm} movido para Negócio Ganho (2 etapas)`);
                    }
                  }
                }
              } catch (bitrixErr) {
                console.error(`[assinafy-poll] Erro ao mover deal no Bitrix:`, bitrixErr);
              }
              updated++;
            } else if (isRecusado) {
              await db.execute(sql`
                UPDATE staging.contratos SET status = 'recusado', assinafy_status = 'declined', data_atualizacao = NOW()
                WHERE id = ${c.id}
              `);
              updated++;
            } else {
              await db.execute(sql`
                UPDATE staging.contratos SET assinafy_status = ${docStatus}, data_atualizacao = NOW()
                WHERE id = ${c.id}
              `);
            }
          } else {
            if (isAssinado) {
              await db.execute(sql`
                UPDATE cortex_core.contratos_creators SET status = 'assinado', assinafy_status = 'signed', assinado_em = NOW(), etapa_pagamento = 'producao', atualizado_em = NOW()
                WHERE id = ${c.id}
              `);
              updated++;
            } else if (isRecusado) {
              await db.execute(sql`
                UPDATE cortex_core.contratos_creators SET status = 'recusado', assinafy_status = 'declined', atualizado_em = NOW()
                WHERE id = ${c.id}
              `);
              updated++;
            } else {
              await db.execute(sql`
                UPDATE cortex_core.contratos_creators SET assinafy_status = ${docStatus}, atualizado_em = NOW()
                WHERE id = ${c.id}
              `);
            }
          }
        } catch (docErr: any) {
          console.error(`[assinafy-poll] Erro ao consultar doc ${c.assinafy_document_id} (${c.tipo} #${c.id}):`, docErr.message);
        }
      }

      if (updated > 0) {
        console.log(`[assinafy-poll] ${updated} contrato(s) atualizado(s) de ${pending.length} pendente(s)`);
      }
    } catch (err: any) {
      console.error("[assinafy-poll] Erro:", err.message);
    }
  };
  setTimeout(() => pollAssinafyStatus(), 15000); // 15s após startup
  setInterval(() => pollAssinafyStatus(), ASSINAFY_POLL_INTERVAL);
  console.log(`[assinafy-poll] Scheduled every ${ASSINAFY_POLL_INTERVAL / 60000}min`);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[error-handler] ${status} - ${message}`, err.stack || err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    // reusePort disabled for Windows compatibility
    // reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    logOAuthSetupInstructions();
  });
})();

process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

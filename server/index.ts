import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configurePassport, logOAuthSetupInstructions } from "./auth/config";
import { pool as dbPool } from "./db";
import { initializePgTrgmExtension, initializeNotificationsTable, initializeSystemFieldOptionsTable, initializeNotificationRulesTable, initializeOnboardingTables, initializeCatalogTables, initializeSystemFieldsTable, initializeSysSchema, initializeDashboardTables, seedDefaultDashboardViews, initializeTurboEventosTable, initializeRhPagamentosTable, initializeRhPesquisasTables, initializeRhComentariosTables, initializeDfcSnapshotsTable, initializeSalesGoalsTable, initializeCupDataHistTable, createPerformanceIndexes, initializeBpSnapshotsTable, seedBpSnapshotJaneiro2026, initializeRhNpsTable, initializeRhNpsConfigTable, initializeClientCredentialsTable, initializeChamadosTables, seedChamadoCategories, initializeNotasFiscaisTable } from "./db";
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
  ]);
  
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
        host: requireEnv("DATABASE_HOST"),
        port: 5432,
        database: "dados_turbo",
        user: "postgres",
        password: requireEnv("DATABASE_PASSWORD"),
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
        host: requireEnv("DATABASE_HOST"),
        port: 5432,
        database: "dados_turbo",
        user: "postgres",
        password: requireEnv("DATABASE_PASSWORD"),
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

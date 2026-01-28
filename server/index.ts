import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configurePassport, logOAuthSetupInstructions } from "./auth/config";
import { Pool } from "pg";
import { initializeNotificationsTable, initializeSystemFieldOptionsTable, initializeNotificationRulesTable, initializeOnboardingTables, initializeCatalogTables, initializeSystemFieldsTable, initializeSysSchema, initializeDashboardTables, seedDefaultDashboardViews, initializeTurboEventosTable, initializeRhPagamentosTable, initializeRhPesquisasTables, initializeRhComentariosTables, initializeDfcSnapshotsTable, initializeSalesGoalsTable, initializeCupDataHistTable } from "./db";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { initTurbodashTable } from "./services/turbodash";
const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function createSessionStore() {
  // Use Google Cloud SQL for sessions if available
  if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD) {
    const PgSession = connectPgSimple(session);
    const sessionPool = new Pool({
      host: process.env.DB_HOST,
      port: 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    });
    return new PgSession({
      pool: sessionPool,
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
    secret: process.env.SESSION_SECRET || "development-secret-change-in-production",
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
    initializeRhComentariosTables(),
    initializeDfcSnapshotsTable(),
    initializeSalesGoalsTable(),
    initializeCupDataHistTable(),
  ]);
  
  // Phase 2: Depends on catalogs being ready
  await initializeSysSchema();
  
  // Phase 3: Seeding (depends on tables existing)
  await seedDefaultDashboardViews();
  
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

    res.status(status).json({ message });
    throw err;
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
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    logOAuthSetupInstructions();
  });
})();

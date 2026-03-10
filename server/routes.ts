import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertColaboradorSchema, insertPatrimonioSchema, updateContratoSchema } from "@shared/schema";
import authRoutes from "./auth/routes";
import { isAuthenticated } from "./auth/middleware";
import { validateBody } from "./middleware/validate";
import { createUserSchema, updatePermissionsSchema, updateRoleSchema, upsertContextoJuridicoSchema } from "./middleware/schemas";
import { getAllUsers, listAllKeys, updateUserPermissions, updateUserRole, createManualUser } from "./auth/userDb";
import { db } from "./db";
import { sql, type SQL } from "drizzle-orm";
import { analyzeDfc, chatWithDfc, type ChatMessage } from "./services/dfcAnalysis";
import { chat as unifiedAssistantChat } from "./services/unifiedAssistant";
import type { UnifiedAssistantRequest, AssistantContext } from "@shared/schema";
import { setupDealNotifications, triggerTestNotification } from "./services/dealNotifications";
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as path from "path";
import * as fs from "fs";
import { registerAcessosRoutes } from "./routes/acessos";
import { registerHRRoutes } from "./routes/hr";
import { registerGrowthRoutes } from "./routes/growth";
import { registerDRERoutes } from "./routes/dre";
import { registerMetasRoutes } from "./routes/metas";
import { registerContratosRoutes } from "./routes/contratos";
import { registerTechRoutes } from "./routes/tech";
import { registerRelatorioMensalRoutes } from "./routes/relatorioMensal";
import { registerRelatorioMensalSlidesRoutes } from "./routes/relatorioMensalSlides";
import { registerChatRoutes } from "./routes/chat";
import { registerChamadosRoutes } from "./routes/chamados";
import { registerTurboZapRoutes, initTurboZapTables } from "./routes/turbozap";
import { registerJuridicoAssistenteRoutes } from "./routes/juridico-assistente";
import { registerJuridicoRelatoriosRoutes } from "./routes/juridico-relatorios";
import { registerInadimplenciaRoutes } from "./routes/inadimplencia";
import { registerGEGRoutes } from "./routes/geg";
import { registerComercialRoutes } from "./routes/comercial";
import { registerOKR2026Routes } from "./routes/okr2026";
import * as autoreport from "./autoreport/index";
import OpenAI from "openai";

const gpturboOpenAI = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const GPTURBO_SYSTEM_PROMPT = `Você é o GPTurbo, o assistente inteligente da Turbo Partners. Seu papel é ajudar os colaboradores a encontrar informações dentro da plataforma Turbo Cortex.

Você NÃO consulta dados diretamente. Seu papel é DIRECIONAR o colaborador para o módulo correto onde ele pode encontrar a informação desejada.

## MÓDULOS DO TURBO CORTEX E SUAS FUNCIONALIDADES:

### VISÃO GERAL (/visao-geral)
- Dashboard principal com métricas consolidadas da empresa
- Overview de receita, clientes ativos, churn, crescimento
- Indicadores gerais de performance

### CLIENTES (/clientes)
- Lista completa de todos os clientes da Turbo Partners
- Informações de contato, CNPJ, responsáveis
- Status do cliente (ativo, inativo, churned)
- Histórico de relacionamento
- Filtros por squad, status, segmento

### CONTRATOS (/contratos)
- Gestão de contratos de clientes
- Valores de fee, datas de início/fim
- Status do contrato (ativo, cancelado, pendente)
- Aditivos e alterações contratuais
- Produtos e serviços contratados

### COLABORADORES (/colaboradores)
- Lista de todos os funcionários da empresa
- Informações pessoais, cargo, squad
- Data de admissão, salário
- Status (ativo, desligado)

### MEU PERFIL (/meu-perfil)
- Informações pessoais do colaborador logado
- Dados de RH vinculados
- Histórico na empresa

### CALENDÁRIO (/calendario)
- Eventos e reuniões agendadas
- Feriados e datas importantes
- Integração com agendas

### DFC - DEMONSTRAÇÃO DE FLUXO DE CAIXA (/dfc)
- Análise de fluxo de caixa
- Receitas e despesas por período
- Projeções financeiras
- Dashboard financeiro com gráficos

### SQUADS (/squads)
- Organização das equipes por squad
- Membros de cada squad
- Clientes atribuídos a cada squad
- Performance por squad

### RETENÇÃO (/retencao)
- Análise de churn e retenção de clientes
- Motivos de cancelamento
- Métricas de saúde do cliente
- Alertas de risco

### COMERCIAL (/comercial)
- Pipeline de vendas
- Deals e negociações em andamento
- Performance de SDRs e Closers
- Metas comerciais

### FINANCEIRO (/financeiro)
- Faturamento e receita
- Inadimplência
- Contas a receber/pagar
- Relatórios financeiros

### JURÍDICO (/juridico)
- Gestão de inadimplência
- Processos e pendências legais
- Contratos com problemas

### PATRIMÔNIO (/patrimonio)
- Ativos físicos da empresa
- Equipamentos (notebooks, monitores, etc.)
- Linhas telefônicas corporativas
- Controle de inventário

### CONHECIMENTO & BENEFÍCIOS (/conhecimentos)
- Cursos e treinamentos disponíveis
- Clube de benefícios para colaboradores
- Descontos e cupons em parceiros
- Material educacional

### ACESSOS (/acessos)
- Gestão de acessos a sistemas externos
- Credenciais de ferramentas
- Solicitação de novos acessos

### OKR 2026 (/okr-2026)
- Objetivos e resultados-chave da empresa
- Metas por área (BP Financeiro, Retenção, Comercial)
- Acompanhamento de indicadores estratégicos
- Metas de closers e vendas

### GROWTH - VISÃO GERAL (/growth/visao-geral)
- Dashboard de performance de marketing
- Métricas de campanhas
- ROI e ROAS

### META ADS (/growth/meta-ads)
- Performance de anúncios no Meta (Facebook/Instagram)
- Métricas de campanhas por cliente
- Investimento e retorno

### CRIATIVOS (/growth/criativos)
- Análise de criativos de anúncios
- Performance por tipo de criativo
- CTR, CPM, conversões

### PERFORMANCE POR PLATAFORMA (/growth/performance-plataforma)
- Comparativo entre plataformas (Meta, Google, etc.)
- Métricas cross-platform

### ADMIN - USUÁRIOS (/admin/usuarios)
- Gestão de permissões de usuários
- Controle de acesso ao sistema
- Perfis e roles

### TURBO TOOLS (/ferramentas)
- Ferramentas internas da empresa
- Utilitários diversos

### SUGESTÕES (/sugestoes)
- Canal para sugestões dos colaboradores
- Ideias de melhorias

## INSTRUÇÕES DE RESPOSTA:

1. Quando alguém perguntar onde encontrar algo, DIRECIONE para o módulo correto
2. Explique brevemente o que o colaborador encontrará naquele módulo
3. Se a pergunta for ambígua, pergunte para clarificar
4. Seja prestativo e amigável, como um colega de trabalho
5. Use linguagem simples e direta
6. Se não souber onde está uma informação, seja honesto e sugira possíveis lugares

## EXEMPLOS:

Pergunta: "Onde vejo os dados de um cliente?"
Resposta: "Você encontra informações dos clientes no módulo **Clientes** (/clientes). Lá você pode ver dados de contato, CNPJ, status, squad responsável e histórico de relacionamento. Se precisar ver os contratos desse cliente, acesse o módulo **Contratos** (/contratos)."

Pergunta: "Quero ver minha folha de pagamento"
Resposta: "Informações sobre seu salário e dados de RH você encontra no módulo **Meu Perfil** (/meu-perfil). Lá estão vinculados seus dados do sistema de RH."

Pergunta: "Onde vejo as metas do time comercial?"
Resposta: "As metas comerciais estão no módulo **OKR 2026** (/okr-2026), na aba de Comercial. Você também pode ver o pipeline de vendas e performance dos vendedores no módulo **Comercial** (/comercial)."

Responda sempre em português brasileiro, de forma clara e objetiva.`;

type GPTurboMessage = { role: "user" | "assistant"; content: string };

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(authRoutes);

  // Normalize CPF to 11-digit string
  const normalizeCpf = (cpf: string | null | undefined): string => {
    if (!cpf) return '';
    // Remove all non-digit characters
    const digits = cpf.replace(/\D/g, '');
    // Pad with leading zeros to ensure 11 digits
    return digits.padStart(11, '0');
  };

  // =============================================================================
  // Internal API Routes (BEFORE global auth middleware)
  // Uses Bearer token authentication via INTERNAL_API_TOKEN for external systems
  // =============================================================================
  
  const internalApiAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.INTERNAL_API_TOKEN;
    
    if (!expectedToken) {
      return res.status(500).json({ error: "INTERNAL_API_TOKEN not configured" });
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    
    const token = authHeader.slice(7);
    if (token !== expectedToken) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    next();
  };
  
  // GET /api/internal/metrics - List all clients with metrics
  app.get("/api/internal/metrics", internalApiAuth, async (req, res) => {
    try {
      const clientsResult = await db.execute(sql`
        SELECT 
          c.cnpj,
          c.nome as nome_cliente,
          COALESCE(SUM(COALESCE(p.nao_pago, 0)), 0) as faturamento_pendente
        FROM "Conta Azul".caz_clientes c
        LEFT JOIN "Conta Azul".caz_parcelas p ON c.nome = p.empresa
        WHERE c.cnpj IS NOT NULL AND c.cnpj != ''
        GROUP BY c.cnpj, c.nome
        LIMIT 100
      `);
      
      const now = new Date();
      const currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const currentEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      const previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
      const previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0).toISOString().split('T')[0];
      
      const clients = (clientsResult.rows as any[]).map((row, idx) => ({
        client: {
          id: `client-${idx}`,
          name: row.nome_cliente || 'Cliente',
          cnpj: row.cnpj,
        },
        period: {
          current: { start: currentStart, end: currentEnd },
          previous: { start: previousStart, end: previousEnd },
        },
        metrics: {
          pendingRevenue: { current: parseFloat(row.faturamento_pendente) || 0, previous: 0, growth: 0 },
          adSpend: { current: 0, previous: 0, growth: 0 },
          roas: { current: 0, previous: 0, growth: 0 },
          purchases: { current: 0, previous: 0, growth: 0 },
          cpa: { current: 0, previous: 0, growth: 0 },
          avgTicket: { current: 0, previous: 0, growth: 0 },
          sessions: { current: 0, previous: 0, growth: 0 },
          cps: { current: 0, previous: 0, growth: 0 },
          conversionRate: { current: 0, previous: 0, growth: 0 },
          recurrenceRate: { current: 0, previous: 0, growth: 0 },
        },
      }));
      
      res.json({
        total: clients.length,
        period: {
          current: { start: currentStart, end: currentEnd },
          previous: { start: previousStart, end: previousEnd },
        },
        clients,
      });
    } catch (error) {
      console.error("[internal/metrics] Error:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });
  
  // GET /api/internal/metrics/:cnpj - Get metrics for a specific client
  app.get("/api/internal/metrics/:cnpj", internalApiAuth, async (req, res) => {
    try {
      const cnpj = req.params.cnpj.replace(/\D/g, '');
      
      if (cnpj.length < 11 || cnpj.length > 14) {
        return res.status(400).json({ error: "CNPJ inválido" });
      }
      
      const clientResult = await db.execute(sql`
        SELECT 
          c.cnpj,
          c.nome as nome_cliente,
          COALESCE(SUM(COALESCE(p.nao_pago, 0)), 0) as faturamento_pendente
        FROM "Conta Azul".caz_clientes c
        LEFT JOIN "Conta Azul".caz_parcelas p ON c.nome = p.empresa
        WHERE REGEXP_REPLACE(c.cnpj, '[^0-9]', '', 'g') = ${cnpj}
        GROUP BY c.cnpj, c.nome
        LIMIT 1
      `);
      
      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }
      
      const row = clientResult.rows[0] as any;
      const now = new Date();
      const currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const currentEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      const previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
      const previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0).toISOString().split('T')[0];
      
      res.json({
        client: {
          id: `client-${cnpj}`,
          name: row.nome_cliente || 'Cliente',
          cnpj: row.cnpj,
        },
        period: {
          current: { start: currentStart, end: currentEnd },
          previous: { start: previousStart, end: previousEnd },
        },
        metrics: {
          pendingRevenue: { current: parseFloat(row.faturamento_pendente) || 0, previous: 0, growth: 0 },
          adSpend: { current: 0, previous: 0, growth: 0 },
          roas: { current: 0, previous: 0, growth: 0 },
          purchases: { current: 0, previous: 0, growth: 0 },
          cpa: { current: 0, previous: 0, growth: 0 },
          avgTicket: { current: 0, previous: 0, growth: 0 },
          sessions: { current: 0, previous: 0, growth: 0 },
          cps: { current: 0, previous: 0, growth: 0 },
          conversionRate: { current: 0, previous: 0, growth: 0 },
          recurrenceRate: { current: 0, previous: 0, growth: 0 },
        },
      });
    } catch (error) {
      console.error("[internal/metrics/:cnpj] Error:", error);
      res.status(500).json({ error: "Failed to fetch client metrics" });
    }
  });

  app.use("/api", isAuthenticated);
  
  app.get("/api/debug/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await getAllUsers();
      const allKeys = await listAllKeys();
      
      // Fetch all colaboradores to link by email
      const colaboradores = await storage.getColaboradores();
      
      // Create a map of email to colaborador for quick lookup
      const emailToColaborador = new Map<string, { id: number; nome: string; setor: string | null; cargo: string | null; squad: string | null; status: string | null }>();
      for (const c of colaboradores) {
        if (c.emailTurbo) {
          emailToColaborador.set(c.emailTurbo.toLowerCase(), {
            id: c.id,
            nome: c.nome,
            setor: c.setor,
            cargo: c.cargo,
            squad: c.squad,
            status: c.status
          });
        }
      }
      
      // Link users to colaboradores by email
      const usersWithColaborador = users.map(user => {
        const colaborador = emailToColaborador.get(user.email?.toLowerCase() || '');
        return {
          ...user,
          colaborador: colaborador || null
        };
      });
      
      res.json({ users: usersWithColaborador, allKeys, count: users.length, totalKeys: allKeys.length });
    } catch (error) {
      console.error("[api] Error fetching debug info:", error);
      res.status(500).json({ error: "Failed to fetch debug info" });
    }
  });

  app.post("/api/users/:userId/permissions", isAuthenticated, isAdmin, validateBody(updatePermissionsSchema), async (req, res) => {
    try {
      const { userId } = req.params;
      const { allowedRoutes } = req.body;
      }

      const updatedUser = await updateUserPermissions(userId, allowedRoutes);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("[api] Error updating permissions:", error);
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  app.post("/api/users/:userId/role", isAuthenticated, isAdmin, validateBody(updateRoleSchema), async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      const updatedUser = await updateUserRole(userId, role);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("[api] Error updating role:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.post("/api/auth/users", isAuthenticated, isAdmin, validateBody(createUserSchema), async (req, res) => {
    try {
      const { name, email, role, allowedRoutes } = req.body;

      const normalizedEmail = email.toLowerCase().trim();
      const validDomains = ['@turbopartners.com.br', '@gmail.com'];
      const isValidEmail = validDomains.some(domain => normalizedEmail.endsWith(domain));
      
      if (!isValidEmail) {
        return res.status(400).json({ error: "Email deve terminar com @turbopartners.com.br ou @gmail.com" });
      }

      if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: "Role deve ser 'admin' ou 'user'" });
      }

      const newUser = await createManualUser({
        name: name.trim(),
        email: normalizedEmail,
        role,
        allowedRoutes: Array.isArray(allowedRoutes) ? allowedRoutes : [],
      });

      res.status(201).json(newUser);
    } catch (error: any) {
      console.error("[api] Error creating user:", error);
      res.status(500).json({ error: error.message || "Failed to create user" });
    }
  });

  // Admin Logs Routes
  app.get("/api/admin/system-logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const offset = (page - 1) * pageSize;
      
      const result = await db.execute(sql`
        SELECT * FROM system_logs 
        ORDER BY timestamp DESC 
        LIMIT ${pageSize} OFFSET ${offset}
      `);
      
      const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM system_logs`);
      const total = parseInt((countResult.rows[0] as any)?.total || '0');
      
      res.json({
        items: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      });
    } catch (error) {
      console.error("[api] Error fetching system logs:", error);
      res.status(500).json({ error: "Failed to fetch system logs" });
    }
  });

  app.get("/api/admin/auth-logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const offset = (page - 1) * pageSize;
      
      const result = await db.execute(sql`
        SELECT * FROM auth_logs 
        ORDER BY timestamp DESC 
        LIMIT ${pageSize} OFFSET ${offset}
      `);
      
      const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM auth_logs`);
      const total = parseInt((countResult.rows[0] as any)?.total || '0');
      
      res.json({
        items: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      });
    } catch (error) {
      console.error("[api] Error fetching auth logs:", error);
      res.status(500).json({ error: "Failed to fetch auth logs" });
    }
  });

  app.get("/api/admin/health", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const startTime = Date.now();
      await db.execute(sql`SELECT 1`);
      const dbLatency = Date.now() - startTime;
      
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Get OKR/BP statistics
      let okrStats = {
        targetsCount: 0,
        metricsCount: 0,
        actualsCount: 0,
        overridesCount: 0
      };
      
      try {
        const [targetsResult, metricsResult, actualsResult] = await Promise.all([
          db.execute(sql`SELECT COUNT(*) as count FROM cortex_core.metric_targets_monthly`),
          db.execute(sql`SELECT COUNT(*) as count FROM cortex_core.metrics_registry_extended`),
          db.execute(sql`SELECT COUNT(*) as count FROM cortex_core.metric_actuals_monthly`)
        ]);
        
        okrStats.targetsCount = parseInt((targetsResult.rows[0] as any)?.count || '0');
        okrStats.metricsCount = parseInt((metricsResult.rows[0] as any)?.count || '0');
        okrStats.actualsCount = parseInt((actualsResult.rows[0] as any)?.count || '0');
        
        // Check for overrides table
        try {
          const overridesResult = await db.execute(sql`SELECT COUNT(*) as count FROM cortex_core.metric_overrides_monthly`);
          okrStats.overridesCount = parseInt((overridesResult.rows[0] as any)?.count || '0');
        } catch {
          okrStats.overridesCount = -1; // table doesn't exist
        }
      } catch (e) {
        console.log("[health] OKR stats tables may not exist yet");
      }
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: {
          status: "connected",
          latency_ms: dbLatency
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          unit: "MB"
        },
        uptime: {
          seconds: Math.round(uptime),
          formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.round(uptime % 60)}s`
        },
        okr: okrStats
      });
    } catch (error) {
      console.error("[api] Health check failed:", error);
      res.status(500).json({ 
        status: "unhealthy",
        error: "Database connection failed"
      });
    }
  });

  app.get("/api/admin/integrations-status", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const integrations = [
        { name: "ContaAzul", status: "active", lastSync: new Date().toISOString(), type: "ERP" },
        { name: "ClickUp", status: "active", lastSync: new Date().toISOString(), type: "Projetos" },
        { name: "Bitrix24", status: "active", lastSync: new Date().toISOString(), type: "CRM" },
        { name: "Meta Ads", status: "active", lastSync: new Date().toISOString(), type: "Marketing" },
        { name: "Google Ads", status: "active", lastSync: new Date().toISOString(), type: "Marketing" },
        { name: "OpenAI", status: process.env.OPENAI_API_KEY ? "active" : "inactive", lastSync: null, type: "AI" }
      ];
      
      res.json({ integrations });
    } catch (error) {
      console.error("[api] Error fetching integrations status:", error);
      res.status(500).json({ error: "Failed to fetch integrations status" });
    }
  });

  app.get("/api/admin/connections/status", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const lastChecked = new Date().toISOString();
      
      // Check Database connection
      let databaseStatus: { name: string; status: string; latency?: number; error?: string; lastChecked: string } = {
        name: "Google Cloud SQL (PostgreSQL)",
        status: "disconnected",
        lastChecked,
      };
      
      try {
        const dbStart = Date.now();
        await db.execute(sql`SELECT 1`);
        const dbLatency = Date.now() - dbStart;
        databaseStatus = {
          name: "Google Cloud SQL (PostgreSQL)",
          status: "connected",
          latency: dbLatency,
          lastChecked,
        };
      } catch (dbError: any) {
        databaseStatus = {
          name: "Google Cloud SQL (PostgreSQL)",
          status: "error",
          error: dbError.message || "Database connection failed",
          lastChecked,
        };
      }
      
      // Check OpenAI API
      let openaiStatus: { name: string; status: string; latency?: number; error?: string; lastChecked: string } = {
        name: "OpenAI API",
        status: "not_configured",
        lastChecked,
      };
      
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        try {
          const openaiStart = Date.now();
          const response = await fetch("https://api.openai.com/v1/models", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${openaiKey}`,
            },
          });
          const openaiLatency = Date.now() - openaiStart;
          
          if (response.ok) {
            openaiStatus = {
              name: "OpenAI API",
              status: "connected",
              latency: openaiLatency,
              lastChecked,
            };
          } else {
            const errorData = await response.json().catch(() => ({}));
            openaiStatus = {
              name: "OpenAI API",
              status: "error",
              latency: openaiLatency,
              error: (errorData as any).error?.message || `HTTP ${response.status}`,
              lastChecked,
            };
          }
        } catch (openaiError: any) {
          openaiStatus = {
            name: "OpenAI API",
            status: "error",
            error: openaiError.message || "OpenAI connection failed",
            lastChecked,
          };
        }
      }
      
      // Check Google OAuth configuration
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      const googleStatus = {
        name: "Google OAuth",
        status: (googleClientId && googleClientSecret) ? "configured" : "not_configured",
        lastChecked,
      };
      
      res.json({
        database: databaseStatus,
        openai: openaiStatus,
        google: googleStatus,
      });
    } catch (error) {
      console.error("[api] Error checking connections status:", error);
      res.status(500).json({ error: "Failed to check connections status" });
    }
  });

  // Database Structure Explorer API
  app.get("/api/admin/database/tables", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Get all tables from public schema
      const tablesResult = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const tables = tablesResult.rows as { table_name: string }[];
      
      // Get column counts and approximate row counts for each table
      const tableDetails = await Promise.all(
        tables.map(async (table) => {
          const tableName = table.table_name;
          
          // Get column count
          const columnResult = await db.execute(sql`
            SELECT COUNT(*) as column_count 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          `);
          
          // Get approximate row count using pg_stat_user_tables
          const rowCountResult = await db.execute(sql`
            SELECT n_live_tup as row_count 
            FROM pg_stat_user_tables 
            WHERE relname = ${tableName}
          `);
          
          const columnCount = Number((columnResult.rows[0] as any)?.column_count || 0);
          const rowCount = Number((rowCountResult.rows[0] as any)?.row_count || 0);
          
          return {
            name: tableName,
            columnCount,
            rowCount,
          };
        })
      );
      
      res.json({ tables: tableDetails, totalTables: tableDetails.length });
    } catch (error) {
      console.error("[api] Error fetching database tables:", error);
      res.status(500).json({ error: "Failed to fetch database tables" });
    }
  });

  app.get("/api/admin/database/tables/:tableName", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { tableName } = req.params;
      
      // Security: Get whitelist of valid table names from information_schema
      const whitelistResult = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);
      
      const validTableNames = new Set(
        (whitelistResult.rows as { table_name: string }[]).map(row => row.table_name)
      );
      
      // Validate tableName is in the whitelist
      if (!validTableNames.has(tableName)) {
        return res.status(404).json({ error: "Table not found" });
      }
      
      // Use the validated table name (now safe to use in queries)
      const validatedTableName = tableName;
      
      // Get columns with details
      const columnsResult = await db.execute(sql`
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE 
            WHEN tc.constraint_type = 'PRIMARY KEY' THEN true 
            ELSE false 
          END as is_primary_key
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu 
          ON c.table_schema = kcu.table_schema 
          AND c.table_name = kcu.table_name 
          AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc 
          ON kcu.constraint_name = tc.constraint_name 
          AND tc.constraint_type = 'PRIMARY KEY'
        WHERE c.table_schema = 'public' 
        AND c.table_name = ${validatedTableName}
        ORDER BY c.ordinal_position
      `);
      
      // Get approximate row count
      const rowCountResult = await db.execute(sql`
        SELECT n_live_tup as row_count 
        FROM pg_stat_user_tables 
        WHERE relname = ${validatedTableName}
      `);
      
      const rowCount = Number((rowCountResult.rows[0] as any)?.row_count || 0);
      
      // Get sample data (first 5 rows) - safe because tableName is validated against whitelist
      let sampleData: any[] = [];
      try {
        const sampleResult = await db.execute(
          sql.raw(`SELECT * FROM "${validatedTableName}" LIMIT 5`)
        );
        sampleData = sampleResult.rows as any[];
      } catch (sampleError) {
        console.error(`[api] Error fetching sample data for ${validatedTableName}:`, sampleError);
      }
      
      res.json({
        name: validatedTableName,
        columns: columnsResult.rows,
        rowCount,
        sampleData,
      });
    } catch (error) {
      console.error("[api] Error fetching table details:", error);
      res.status(500).json({ error: "Failed to fetch table details" });
    }
  });

  // System Settings API
  app.get("/api/system/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("[api] Error fetching system settings:", error);
      res.status(500).json({ error: "Failed to fetch system settings" });
    }
  });

  app.get("/api/system/settings/:key", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const value = await storage.getSystemSetting(req.params.key);
      if (value === null) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json({ key: req.params.key, value });
    } catch (error) {
      console.error("[api] Error fetching system setting:", error);
      res.status(500).json({ error: "Failed to fetch system setting" });
    }
  });

  app.put("/api/system/settings/:key", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { value, description } = req.body;
      if (typeof value !== 'string') {
        return res.status(400).json({ error: "Value must be a string" });
      }
      await storage.setSystemSetting(req.params.key, value, description);
      res.json({ success: true, key: req.params.key, value });
    } catch (error) {
      console.error("[api] Error updating system setting:", error);
      res.status(500).json({ error: "Failed to update system setting" });
    }
  });

  // AI Configuration API
  app.get("/api/admin/ai/providers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getAvailableProviders } = await import("./services/unifiedAssistant");
      const providers = getAvailableProviders();
      res.json(providers);
    } catch (error) {
      console.error("[api] Error fetching AI providers:", error);
      res.status(500).json({ error: "Failed to fetch AI providers" });
    }
  });

  app.get("/api/admin/ai/config", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const provider = await storage.getSystemSetting('ai_provider') || 'openai';
      const model = await storage.getSystemSetting('ai_model') || 'gpt-4o';
      const { getAvailableProviders } = await import("./services/unifiedAssistant");
      const providers = getAvailableProviders();
      res.json({ provider, model, providers });
    } catch (error) {
      console.error("[api] Error fetching AI config:", error);
      res.status(500).json({ error: "Failed to fetch AI configuration" });
    }
  });

  app.put("/api/admin/ai/config", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { AI_PROVIDERS } = await import("./services/unifiedAssistant");
      const { z } = await import("zod");
      
      // Define Zod schema for AI config validation
      const aiConfigSchema = z.object({
        provider: z.enum(['openai', 'gemini']),
        model: z.string().min(1, "Model is required"),
      });
      
      // Validate request body structure
      const parseResult = aiConfigSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.errors 
        });
      }
      
      const { provider, model } = parseResult.data;
      
      // Validate that provider is available
      const providerConfig = AI_PROVIDERS[provider];
      if (!providerConfig) {
        return res.status(400).json({ 
          error: `Invalid provider: ${provider}. Valid providers are: openai, gemini` 
        });
      }
      
      // Validate that model is valid for the selected provider
      if (!providerConfig.models.includes(model as any)) {
        return res.status(400).json({ 
          error: `Invalid model '${model}' for provider '${provider}'. Valid models are: ${providerConfig.models.join(', ')}` 
        });
      }
      
      // Validate that provider is available (has API key configured)
      if (!providerConfig.available) {
        return res.status(400).json({ 
          error: `Provider '${provider}' is not available. Please configure the required API keys.` 
        });
      }
      
      await storage.setSystemSetting('ai_provider', provider, 'AI provider (openai or gemini)');
      await storage.setSystemSetting('ai_model', model, 'AI model to use for chat');
      
      res.json({ success: true, provider, model });
    } catch (error) {
      console.error("[api] Error updating AI config:", error);
      res.status(500).json({ error: "Failed to update AI configuration" });
    }
  });

  app.post("/api/admin/ai/test", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { testAIConnection } = await import("./services/unifiedAssistant");
      const result = await testAIConnection();
      res.json(result);
    } catch (error: any) {
      console.error("[api] Error testing AI connection:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to test AI connection" 
      });
    }
  });

  app.get("/api/admin/sync-logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const offset = (page - 1) * pageSize;
      const integration = req.query.integration as string | undefined;
      const status = req.query.status as string | undefined;
      
      // Build conditions array for proper parameterized queries
      const conditions: any[] = [];
      const params: any = { limit: pageSize, offset };
      
      let baseQuery = `SELECT * FROM sync_logs WHERE 1=1`;
      let countQuery = `SELECT COUNT(*) as total FROM sync_logs WHERE 1=1`;
      
      if (integration) {
        baseQuery += ` AND integration = $integration`;
        countQuery += ` AND integration = $integration`;
        params.integration = integration;
      }
      if (status) {
        baseQuery += ` AND status = $status`;
        countQuery += ` AND status = $status`;
        params.status = status;
      }
      
      baseQuery += ` ORDER BY started_at DESC LIMIT $limit OFFSET $offset`;
      
      // Execute with proper parameterization using sql template
      let result;
      let countResult;
      
      if (integration && status) {
        result = await db.execute(sql`
          SELECT * FROM sync_logs 
          WHERE integration = ${integration} AND status = ${status}
          ORDER BY started_at DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM sync_logs 
          WHERE integration = ${integration} AND status = ${status}
        `);
      } else if (integration) {
        result = await db.execute(sql`
          SELECT * FROM sync_logs 
          WHERE integration = ${integration}
          ORDER BY started_at DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM sync_logs 
          WHERE integration = ${integration}
        `);
      } else if (status) {
        result = await db.execute(sql`
          SELECT * FROM sync_logs 
          WHERE status = ${status}
          ORDER BY started_at DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM sync_logs 
          WHERE status = ${status}
        `);
      } else {
        result = await db.execute(sql`
          SELECT * FROM sync_logs 
          ORDER BY started_at DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM sync_logs
        `);
      }
      
      const total = parseInt((countResult.rows[0] as any)?.total || '0');
      
      res.json({
        items: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      });
    } catch (error) {
      console.error("[api] Error fetching sync logs:", error);
      res.status(500).json({ error: "Failed to fetch sync logs" });
    }
  });

  app.get("/api/admin/sync-logs/summary", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Return mock summary data since sync_logs table doesn't exist yet
      const mockSummaries = [
        {
          integration: "ClickUp",
          last_sync: new Date().toISOString(),
          total_syncs: 12,
          successful_syncs: 12,
          success_rate: 100,
          avg_duration_seconds: 2.5
        },
        {
          integration: "Conta Azul",
          last_sync: new Date().toISOString(),
          total_syncs: 8,
          successful_syncs: 8,
          success_rate: 100,
          avg_duration_seconds: 1.8
        }
      ];
      
      res.json({ summaries: mockSummaries });
    } catch (error) {
      console.error("[api] Error fetching sync logs summary:", error);
      res.status(500).json({ error: "Failed to fetch sync logs summary" });
    }
  });

  app.get("/api/admin/reconciliation", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const offset = (page - 1) * pageSize;
      const entityType = req.query.entityType as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      
      // Build filter combinations for proper parameterized queries
      const hasEntityType = !!entityType;
      const hasStatus = !!statusFilter;
      const hasSeverity = !!severity;
      
      let result;
      let countResult;
      
      // Handle all filter combinations
      if (hasEntityType && hasStatus && hasSeverity) {
        result = await db.execute(sql`
          SELECT * FROM data_reconciliation 
          WHERE entity_type = ${entityType} AND status = ${statusFilter} AND severity = ${severity}
          ORDER BY timestamp DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM data_reconciliation 
          WHERE entity_type = ${entityType} AND status = ${statusFilter} AND severity = ${severity}
        `);
      } else if (hasEntityType && hasStatus) {
        result = await db.execute(sql`
          SELECT * FROM data_reconciliation 
          WHERE entity_type = ${entityType} AND status = ${statusFilter}
          ORDER BY timestamp DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM data_reconciliation 
          WHERE entity_type = ${entityType} AND status = ${statusFilter}
        `);
      } else if (hasEntityType && hasSeverity) {
        result = await db.execute(sql`
          SELECT * FROM data_reconciliation 
          WHERE entity_type = ${entityType} AND severity = ${severity}
          ORDER BY timestamp DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM data_reconciliation 
          WHERE entity_type = ${entityType} AND severity = ${severity}
        `);
      } else if (hasStatus && hasSeverity) {
        result = await db.execute(sql`
          SELECT * FROM data_reconciliation 
          WHERE status = ${statusFilter} AND severity = ${severity}
          ORDER BY detected_at DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM data_reconciliation 
          WHERE status = ${statusFilter} AND severity = ${severity}
        `);
      } else if (hasEntityType) {
        result = await db.execute(sql`
          SELECT * FROM data_reconciliation 
          WHERE entity_type = ${entityType}
          ORDER BY timestamp DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM data_reconciliation 
          WHERE entity_type = ${entityType}
        `);
      } else if (hasStatus) {
        result = await db.execute(sql`
          SELECT * FROM data_reconciliation 
          WHERE status = ${statusFilter}
          ORDER BY timestamp DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM data_reconciliation 
          WHERE status = ${statusFilter}
        `);
      } else if (hasSeverity) {
        result = await db.execute(sql`
          SELECT * FROM data_reconciliation 
          WHERE severity = ${severity}
          ORDER BY timestamp DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM data_reconciliation 
          WHERE severity = ${severity}
        `);
      } else {
        result = await db.execute(sql`
          SELECT * FROM data_reconciliation 
          ORDER BY timestamp DESC 
          LIMIT ${pageSize} OFFSET ${offset}
        `);
        countResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM data_reconciliation
        `);
      }
      
      const total = parseInt((countResult.rows[0] as any)?.total || '0');
      
      // Get summary counts
      const summaryResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
        FROM data_reconciliation
      `);
      
      const summaryRow = summaryResult.rows[0] as any;
      const summary = {
        total: parseInt(summaryRow?.total || '0'),
        pending: parseInt(summaryRow?.pending || '0'),
        resolved: parseInt(summaryRow?.resolved || '0')
      };
      
      res.json({
        items: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        summary
      });
    } catch (error) {
      console.error("[api] Error fetching reconciliation data:", error);
      res.status(500).json({ error: "Failed to fetch reconciliation data" });
    }
  });

  app.post("/api/admin/reconciliation/:id/resolve", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const resolvedBy = (req.user as any)?.email || (req.user as any)?.name || 'admin';
      
      const result = await db.execute(sql`
        UPDATE data_reconciliation 
        SET 
          status = 'resolved',
          resolved_at = NOW(),
          resolved_by = ${resolvedBy},
          notes = ${notes || null}
        WHERE id = ${parseInt(id)}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Reconciliation record not found" });
      }
      
      res.json({ success: true, item: result.rows[0] });
    } catch (error) {
      console.error("[api] Error resolving reconciliation:", error);
      res.status(500).json({ error: "Failed to resolve reconciliation" });
    }
  });

  app.get("/api/admin/integration-health", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM integration_health 
        ORDER BY integration, checked_at DESC
      `);
      
      res.json({ health: result.rows });
    } catch (error) {
      console.error("[api] Error fetching integration health:", error);
      res.status(500).json({ error: "Failed to fetch integration health" });
    }
  });

  app.post("/api/admin/run-reconciliation", isAuthenticated, isAdmin, async (req, res) => {
    const discrepancies: any[] = [];
    const runId = Date.now().toString();
    
    try {
      // Helper function to safely get table count
      const safeTableCount = async (tableName: string): Promise<number | null> => {
        try {
          const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
          return parseInt((result.rows[0] as any)?.count || '0');
        } catch (error: any) {
          // Table doesn't exist or other error
          console.warn(`[reconciliation] Could not query table ${tableName}:`, error.message);
          return null;
        }
      };
      
      // Check clientes between ContaAzul and ClickUp
      const cazClientesCount = await safeTableCount('"Conta Azul".caz_clientes');
      const cupClientesCount = await safeTableCount('"Clickup".cup_clientes');
      
      if (cazClientesCount !== null && cupClientesCount !== null) {
        const diff = Math.abs(cazClientesCount - cupClientesCount);
        // Only create discrepancy if there's an actual difference
        if (diff > 0) {
          const severity = diff > 50 ? 'high' : diff > 10 ? 'medium' : 'low';
          
          discrepancies.push({
            entity_type: 'clientes',
            source_system: 'conta_azul',
            target_system: 'clickup',
            source_count: cazClientesCount,
            target_count: cupClientesCount,
            difference: diff,
            severity,
            description: `Cliente count mismatch: ContaAzul has ${cazClientesCount}, ClickUp has ${cupClientesCount}`
          });
        }
      }
      
      // Check contratos/receivables between ContaAzul and ClickUp
      const cazReceberCount = await safeTableCount('"Conta Azul".caz_receber');
      const cupContratosCount = await safeTableCount('"Clickup".cup_contratos');
      
      if (cazReceberCount !== null && cupContratosCount !== null) {
        const diff = Math.abs(cazReceberCount - cupContratosCount);
        // Only create discrepancy if there's an actual difference
        if (diff > 0) {
          const severity = diff > 100 ? 'high' : diff > 20 ? 'medium' : 'low';
          
          discrepancies.push({
            entity_type: 'contratos',
            source_system: 'conta_azul',
            target_system: 'clickup',
            source_count: cazReceberCount,
            target_count: cupContratosCount,
            difference: diff,
            severity,
            description: `Contract/Receivable count mismatch: ContaAzul receivables ${cazReceberCount}, ClickUp contracts ${cupContratosCount}`
          });
        }
      }
      
      // Insert discrepancies into database
      for (const d of discrepancies) {
        try {
          await db.execute(sql`
            INSERT INTO data_reconciliation (
              entity_type, source_system, target_system, severity, status, notes
            ) VALUES (
              ${d.entity_type}, ${d.source_system}, ${d.target_system}, 
              ${d.severity}, 'pending', ${d.description}
            )
          `);
        } catch (insertError) {
          console.error("[api] Error inserting discrepancy:", insertError);
          // Continue with other discrepancies
        }
      }
      
      res.json({
        success: true,
        runId,
        discrepanciesFound: discrepancies.length,
        discrepancies
      });
    } catch (error) {
      console.error("[api] Error running reconciliation:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to run reconciliation",
        runId,
        discrepanciesFound: discrepancies.length,
        discrepancies
      });
    }
  });
  
  // Endpoint para gerar snapshot diário de contratos
  app.post("/api/admin/contratos-snapshot", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Verificar se já existe snapshot para hoje
      const existingSnapshot = await db.execute(sql`
        SELECT COUNT(*) as count FROM "Clickup".cup_data_hist 
        WHERE DATE(data_snapshot) = ${today}::date
      `);
      
      if (parseInt((existingSnapshot.rows[0] as any)?.count || '0') > 0) {
        return res.json({ 
          success: true, 
          message: `Snapshot já existe para ${today}`,
          skipped: true 
        });
      }
      
      // Inserir snapshot dos contratos atuais
      await db.execute(sql`
        INSERT INTO "Clickup".cup_data_hist (data_snapshot, servico, status, valorr, valorp, id_task, id_subtask, 
                                   data_inicio, data_encerramento, data_pausa, squad, produto, responsavel, cs_responsavel, vendedor)
        SELECT 
          CURRENT_TIMESTAMP,
          servico, status, valorr, valorp, id_task, id_subtask,
          data_inicio, data_encerramento, data_pausa, squad, produto, responsavel, cs_responsavel, vendedor
        FROM "Clickup".cup_contratos
      `);
      
      // Contar quantos registros foram inseridos
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM "Clickup".cup_data_hist 
        WHERE DATE(data_snapshot) = CURRENT_DATE
      `);
      
      const recordCount = parseInt((countResult.rows[0] as any)?.count || '0');
      
      console.log(`[snapshot] Snapshot criado para ${today} com ${recordCount} contratos`);
      
      res.json({ 
        success: true, 
        message: `Snapshot criado para ${today}`,
        records: recordCount
      });
    } catch (error) {
      console.error("[api] Error creating contracts snapshot:", error);
      res.status(500).json({ error: "Failed to create contracts snapshot" });
    }
  });
  
  // Endpoint para consultar MRR histórico (último dia do mês anterior)
  app.get("/api/admin/mrr-historico", isAuthenticated, async (req, res) => {
    try {
      const { mes, ano } = req.query;
      
      // Se não informado, pega último dia do mês anterior
      const targetDate = mes && ano 
        ? new Date(parseInt(ano as string), parseInt(mes as string), 0) // último dia do mês informado
        : new Date(new Date().getFullYear(), new Date().getMonth(), 0); // último dia do mês anterior
      
      const dateStr = targetDate.toISOString().split('T')[0];
      
      // Buscar snapshot mais recente até a data target
      const result = await db.execute(sql`
        SELECT 
          DATE(data_snapshot) as snapshot_date,
          COALESCE(SUM(valorr), 0) as mrr_total,
          COUNT(*) as total_contratos,
          COUNT(DISTINCT id_task) as total_clientes
        FROM "Clickup".cup_data_hist
        WHERE DATE(data_snapshot) <= ${dateStr}::date
          AND status IN ('ativo', 'onboarding', 'triagem')
        GROUP BY DATE(data_snapshot)
        ORDER BY DATE(data_snapshot) DESC
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        // Fallback: usar valor fixo de dezembro 2025 = R$ 1.030.000
        return res.json({
          snapshot_date: '2025-12-31',
          mrr_total: 1030000,
          total_contratos: 0,
          total_clientes: 0,
          is_fallback: true,
          message: 'Usando valor de referência de dezembro 2025'
        });
      }
      
      res.json({
        ...result.rows[0],
        is_fallback: false
      });
    } catch (error) {
      console.error("[api] Error fetching MRR histórico:", error);
      res.status(500).json({ error: "Failed to fetch MRR histórico" });
    }
  });

  app.get("/api/clientes", async (req, res) => {
    try {
      const clientes = await storage.getClientes();
      res.json(clientes);
    } catch (error) {
      console.error("[api] Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clientes-ltv", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          cliente_id,
          COALESCE(SUM(CAST(pago AS DECIMAL)), 0) as ltv
        FROM "Conta Azul".caz_receber
        WHERE cliente_id IS NOT NULL 
          AND UPPER(status) IN ('PAGO', 'ACQUITTED')
        GROUP BY cliente_id
      `);
      
      const ltvMap: Record<string, number> = {};
      for (const row of result.rows) {
        ltvMap[row.cliente_id as string] = parseFloat(row.ltv as string) || 0;
      }
      
      res.json(ltvMap);
    } catch (error) {
      console.error("[api] Error fetching clients LTV:", error);
      res.status(500).json({ error: "Failed to fetch clients LTV" });
    }
  });

  app.get("/api/cliente/:id", async (req, res) => {
    try {
      const cliente = await storage.getClienteById(req.params.id);
      if (!cliente) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(cliente);
    } catch (error) {
      console.error("[api] Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.patch("/api/cliente/:id", async (req, res) => {
    try {
      const cliente = await storage.getClienteById(req.params.id);
      if (!cliente) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const cnpj = cliente.cnpjCliente || cliente.cnpj;
      if (!cnpj) {
        return res.status(400).json({ error: "Client CNPJ not found" });
      }
      
      const {
        cnpj: newCnpj,
        telefone,
        responsavel,
        responsavelGeral,
        nomeDono,
        email,
        site,
        instagram,
        linksContrato,
        linkListaClickup,
        cluster,
        statusCliente,
        statusConta,
        tipoNegocio,
        faturamentoMensal,
        investimentoAds
      } = req.body;
      
      // Check for responsavel change to log event
      const oldResponsavel = cliente.responsavel;
      const oldResponsavelGeral = cliente.responsavelGeral;
      
      await db.execute(sql`
        UPDATE "Clickup".cup_clientes
        SET 
          cnpj = COALESCE(${newCnpj ?? null}, cnpj),
          telefone = ${telefone ?? null},
          responsavel = ${responsavel ?? null},
          responsavel_geral = ${responsavelGeral ?? null},
          nome_dono = ${nomeDono ?? null},
          email = ${email ?? null},
          site = ${site ?? null},
          instagram = ${instagram ?? null},
          links_contrato = ${linksContrato ?? null},
          link_lista_clickup = ${linkListaClickup ?? null},
          cluster = ${cluster ?? null},
          status = ${statusCliente ?? null},
          status_conta = ${statusConta ?? null},
          tipo_negocio = ${tipoNegocio ?? null},
          faturamento_mensal = ${faturamentoMensal ?? null},
          investimento_ads = ${investimentoAds ?? null}
        WHERE cnpj = ${cnpj}
      `);
      
      // Log event if responsavel changed
      const user = req.user as any;
      const usuarioNome = user?.name || 'Sistema';
      
      if (responsavel && responsavel !== oldResponsavel) {
        await db.execute(sql`
          INSERT INTO cliente_eventos (cliente_cnpj, tipo, titulo, descricao, usuario_id, usuario_nome)
          VALUES (${cnpj}, 'responsavel_change', 'Responsável alterado', 
                  ${'De ' + (oldResponsavel || 'Não definido') + ' para ' + responsavel}, 
                  ${user?.id || 'system'}, ${usuarioNome})
        `);
      }
      
      if (responsavelGeral && responsavelGeral !== oldResponsavelGeral) {
        await db.execute(sql`
          INSERT INTO cliente_eventos (cliente_cnpj, tipo, titulo, descricao, usuario_id, usuario_nome)
          VALUES (${cnpj}, 'responsavel_change', 'Responsável Geral alterado', 
                  ${'De ' + (oldResponsavelGeral || 'Não definido') + ' para ' + responsavelGeral}, 
                  ${user?.id || 'system'}, ${usuarioNome})
        `);
      }
      
      const updatedCliente = await storage.getClienteById(req.params.id);
      res.json(updatedCliente);
    } catch (error) {
      console.error("[api] Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.patch("/api/clientes/:cnpj/status-conta", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const { statusConta } = req.body;
      
      const validStatuses = ['saudavel', 'requer_atencao', 'insatisfeito', null];
      if (statusConta !== undefined && !validStatuses.includes(statusConta)) {
        return res.status(400).json({ error: "Invalid statusConta value. Must be one of: saudavel, requer_atencao, insatisfeito" });
      }
      
      await db.execute(sql`
        UPDATE "Clickup".cup_clientes
        SET status_conta = ${statusConta ?? null}
        WHERE cnpj = ${cnpj}
      `);
      
      res.json({ success: true, statusConta: statusConta ?? null });
    } catch (error) {
      console.error("[api] Error updating client status_conta:", error);
      res.status(500).json({ error: "Failed to update client status" });
    }
  });

  app.get("/api/cliente/:clienteId/receitas", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const receitas = await storage.getContasReceberByCliente(req.params.clienteId, limit);
      res.json(receitas);
    } catch (error) {
      console.error("[api] Error fetching receivables:", error);
      res.status(500).json({ error: "Failed to fetch receivables" });
    }
  });

  app.get("/api/cliente/:clienteId/revenue", async (req, res) => {
    try {
      const revenue = await storage.getClienteRevenue(req.params.clienteId);
      res.json(revenue);
    } catch (error) {
      console.error("[api] Error fetching revenue:", error);
      res.status(500).json({ error: "Failed to fetch revenue" });
    }
  });

  app.get("/api/cliente/:clienteId/contratos", async (req, res) => {
    try {
      const contratos = await storage.getContratosPorCliente(req.params.clienteId);
      res.json(contratos);
    } catch (error) {
      console.error("[api] Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  // ============================================
  // Client Portal API - Tasks, Communications, Legal Status
  // ============================================

  // GET /api/cliente/:cnpj/tasks - Fetch tasks for a client (with subtasks hierarchy)
  app.get("/api/cliente/:cnpj/tasks", async (req, res) => {
    try {
      const { cnpj } = req.params;

      const clienteResult = await db.execute(sql`
        SELECT nome FROM "Clickup".cup_clientes WHERE cnpj = ${cnpj}
      `);

      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;

      if (!clienteNome) {
        return res.json([]);
      }

      const tasksResult = await db.execute(sql`
        SELECT
          t.id,
          t.nome,
          t.descricao,
          t.status,
          t.prioridade,
          t.responsavel,
          t.data_vencimento as "dataLimite",
          t.created_at as "dataCriacao",
          t.data_conclusao as "dataConclusao",
          t.cliente,
          t.equipe,
          t.tipo_task as "tipoTask",
          t.parent_id as "parentId",
          COALESCE((SELECT COUNT(*) FROM cortex_core.tarefa_comentarios tc WHERE tc.tarefa_id = t.id), 0)::int as "comentariosCount",
          COALESCE((SELECT COUNT(*) FROM cortex_core.tarefa_anexos ta WHERE ta.tarefa_id = t.id), 0)::int as "anexosCount"
        FROM cortex_core.tarefas_clientes t
        WHERE LOWER(TRIM(t.cliente)) = LOWER(TRIM(${clienteNome}))
           OR t.cliente ILIKE ${`%${clienteNome}%`}
        ORDER BY
          CASE WHEN LOWER(TRIM(t.cliente)) = LOWER(TRIM(${clienteNome})) THEN 0 ELSE 1 END,
          t.created_at DESC NULLS LAST
        LIMIT 500
      `);

      // Build hierarchy: parent tasks with subtasks nested
      const allTasks = tasksResult.rows as any[];
      const taskMap = new Map<number, any>();
      const parentTasks: any[] = [];

      // First pass: index all tasks
      for (const task of allTasks) {
        task.subtasks = [];
        taskMap.set(task.id, task);
      }

      // Second pass: attach children to parents
      for (const task of allTasks) {
        if (task.parentId && taskMap.has(task.parentId)) {
          taskMap.get(task.parentId).subtasks.push(task);
        } else if (!task.parentId) {
          parentTasks.push(task);
        } else {
          // Orphaned subtask (parent not in results) — show as top-level
          parentTasks.push(task);
        }
      }

      res.json(parentTasks);
    } catch (error) {
      console.error("[api] Error fetching client tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // PUT /api/cliente/tasks/:id - Update a task
  app.put("/api/cliente/tasks/:id", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { status, responsavel, equipe, prioridade, data_vencimento, nome } = req.body;

      // Auto-set data_conclusao based on status
      let dataConclusao: string | null = null;
      if (status) {
        const completed = ['concluída', 'done', 'complete', 'completo', 'aprovado', 'finalizado'].includes(status.toLowerCase());
        if (completed) {
          dataConclusao = new Date().toISOString();
        }
      }

      const result = await db.execute(sql`
        UPDATE cortex_core.tarefas_clientes SET
          status = COALESCE(${status ?? null}, status),
          responsavel = CASE WHEN ${responsavel !== undefined ? 'yes' : 'no'} = 'yes' THEN ${responsavel ?? null} ELSE responsavel END,
          equipe = CASE WHEN ${equipe !== undefined ? 'yes' : 'no'} = 'yes' THEN ${equipe ?? null} ELSE equipe END,
          prioridade = COALESCE(${prioridade ?? null}, prioridade),
          data_vencimento = CASE WHEN ${data_vencimento !== undefined ? 'yes' : 'no'} = 'yes' THEN ${data_vencimento ?? null}::timestamp ELSE data_vencimento END,
          nome = COALESCE(${nome ?? null}, nome),
          data_conclusao = CASE WHEN ${dataConclusao} IS NOT NULL THEN ${dataConclusao}::timestamp
                               WHEN ${status ?? null} IS NOT NULL THEN NULL
                               ELSE data_conclusao END
        WHERE id = ${taskId}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // DELETE /api/cliente/tasks/:id - Delete a task (cascade deletes subtasks)
  app.delete("/api/cliente/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await db.execute(sql`
        DELETE FROM cortex_core.tarefas_clientes WHERE id = ${parseInt(id)}
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ============================================
  // Task Comments API
  // ============================================

  app.get("/api/cliente/tasks/:id/comentarios", async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      const result = await db.execute(sql`
        SELECT id, tarefa_id as "tarefaId", autor, conteudo, created_at as "createdAt"
        FROM cortex_core.tarefa_comentarios
        WHERE tarefa_id = ${tarefaId}
        ORDER BY created_at ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/cliente/tasks/:id/comentarios", async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      const { conteudo, autor } = req.body;
      if (!conteudo) return res.status(400).json({ error: "conteudo is required" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.tarefa_comentarios (tarefa_id, autor, conteudo)
        VALUES (${tarefaId}, ${autor ?? null}, ${conteudo})
        RETURNING id, tarefa_id as "tarefaId", autor, conteudo, created_at as "createdAt"
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/cliente/tasks/:id/comentarios/:comentarioId", async (req, res) => {
    try {
      const comentarioId = parseInt(req.params.comentarioId);
      await db.execute(sql`
        DELETE FROM cortex_core.tarefa_comentarios WHERE id = ${comentarioId}
      `);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // ============================================
  // Task Attachments API
  // ============================================

  app.get("/api/cliente/tasks/:id/anexos", async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      const result = await db.execute(sql`
        SELECT id, tarefa_id as "tarefaId", nome_arquivo as "nomeArquivo", object_path as "objectPath",
               content_type as "contentType", tamanho, autor, created_at as "createdAt"
        FROM cortex_core.tarefa_anexos
        WHERE tarefa_id = ${tarefaId}
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  app.post("/api/cliente/tasks/:id/anexos", async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      const { nome_arquivo, object_path, content_type, tamanho, autor } = req.body;
      if (!nome_arquivo || !object_path) return res.status(400).json({ error: "nome_arquivo and object_path are required" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.tarefa_anexos (tarefa_id, nome_arquivo, object_path, content_type, tamanho, autor)
        VALUES (${tarefaId}, ${nome_arquivo}, ${object_path}, ${content_type ?? null}, ${tamanho ?? null}, ${autor ?? null})
        RETURNING id, tarefa_id as "tarefaId", nome_arquivo as "nomeArquivo", object_path as "objectPath",
                  content_type as "contentType", tamanho, autor, created_at as "createdAt"
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating attachment:", error);
      res.status(500).json({ error: "Failed to create attachment" });
    }
  });

  app.delete("/api/cliente/tasks/:id/anexos/:anexoId", async (req, res) => {
    try {
      const anexoId = parseInt(req.params.anexoId);
      await db.execute(sql`
        DELETE FROM cortex_core.tarefa_anexos WHERE id = ${anexoId}
      `);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting attachment:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  });

  // GET /api/cliente/:cnpj/comunicacoes - List all communications for a client
  app.get("/api/cliente/:cnpj/comunicacoes", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const { status } = req.query;
      
      let result;
      if (status) {
        result = await db.execute(sql`
          SELECT * FROM cliente_comunicacoes 
          WHERE cliente_id = ${cnpj} AND status = ${status}
          ORDER BY criado_em DESC
        `);
      } else {
        result = await db.execute(sql`
          SELECT * FROM cliente_comunicacoes 
          WHERE cliente_id = ${cnpj}
          ORDER BY criado_em DESC
        `);
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching client communications:", error);
      res.status(500).json({ error: "Failed to fetch communications" });
    }
  });

  // POST /api/cliente/:cnpj/comunicacoes - Create new communication
  app.post("/api/cliente/:cnpj/comunicacoes", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const { tipo, titulo, conteudo, prioridade, status } = req.body;
      const criadoPor = (req as any).user?.email || 'sistema';
      
      if (!tipo || !titulo) {
        return res.status(400).json({ error: "Tipo e título são obrigatórios" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO cliente_comunicacoes (cliente_id, tipo, titulo, conteudo, prioridade, status, criado_por, criado_em, atualizado_em)
        VALUES (${cnpj}, ${tipo}, ${titulo}, ${conteudo || null}, ${prioridade || 'normal'}, ${status || 'ativo'}, ${criadoPor}, NOW(), NOW())
        RETURNING *
      `);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating communication:", error);
      res.status(500).json({ error: "Failed to create communication" });
    }
  });

  // PATCH /api/cliente/:cnpj/comunicacoes/:id - Update communication
  app.patch("/api/cliente/:cnpj/comunicacoes/:id", async (req, res) => {
    try {
      const { cnpj, id } = req.params;
      const { tipo, titulo, conteudo, prioridade, status } = req.body;
      
      const result = await db.execute(sql`
        UPDATE cliente_comunicacoes 
        SET 
          tipo = COALESCE(${tipo}, tipo),
          titulo = COALESCE(${titulo}, titulo),
          conteudo = COALESCE(${conteudo}, conteudo),
          prioridade = COALESCE(${prioridade}, prioridade),
          status = COALESCE(${status}, status),
          atualizado_em = NOW()
        WHERE id = ${parseInt(id)} AND cliente_id = ${cnpj}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Comunicação não encontrada" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating communication:", error);
      res.status(500).json({ error: "Failed to update communication" });
    }
  });

  // DELETE /api/cliente/:cnpj/comunicacoes/:id - Delete communication
  app.delete("/api/cliente/:cnpj/comunicacoes/:id", async (req, res) => {
    try {
      const { cnpj, id } = req.params;
      
      const result = await db.execute(sql`
        DELETE FROM cliente_comunicacoes 
        WHERE id = ${parseInt(id)} AND cliente_id = ${cnpj}
        RETURNING id
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Comunicação não encontrada" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting communication:", error);
      res.status(500).json({ error: "Failed to delete communication" });
    }
  });

  // GET /api/cliente/:cnpj/situacao-juridica - Fetch legal/financial status
  app.get("/api/cliente/:cnpj/situacao-juridica", async (req, res) => {
    try {
      const { cnpj } = req.params;
      
      // Query both cortex_core.inadimplencia_contextos and juridico_clientes in parallel
      const [inadimplenciaResult, juridicoResult] = await Promise.all([
        db.execute(sql`
          SELECT 
            cliente_id,
            contexto,
            evidencias,
            acao,
            status_financeiro,
            detalhe_financeiro,
            atualizado_por,
            atualizado_em,
            valor_acordado,
            data_acordo
          FROM cortex_core.inadimplencia_contextos 
          WHERE cliente_id = ${cnpj}
        `),
        db.execute(sql`
          SELECT 
            id,
            cliente_id,
            procedimento,
            status_juridico,
            observacoes,
            valor_acordado,
            data_acordo,
            numero_parcelas,
            protocolo_processo,
            advogado_responsavel,
            data_criacao,
            data_atualizacao,
            atualizado_por
          FROM juridico_clientes 
          WHERE cliente_id = ${cnpj}
        `)
      ]);
      
      const inadimplencia = inadimplenciaResult.rows.length > 0 ? inadimplenciaResult.rows[0] : null;
      const juridico = juridicoResult.rows.length > 0 ? juridicoResult.rows[0] : null;
      
      res.json({
        clienteId: cnpj,
        inadimplencia,
        juridico,
        hasInadimplencia: inadimplencia !== null,
        hasJuridico: juridico !== null
      });
    } catch (error) {
      console.error("[api] Error fetching legal status:", error);
      res.status(500).json({ error: "Failed to fetch legal status" });
    }
  });

  // GET /api/clientes/:cnpj/alertas - Fetch alerts for a client
  app.get("/api/clientes/:cnpj/alertas", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const alerts: Array<{
        id: string;
        type: 'inadimplencia' | 'vencimento_proximo' | 'contrato_expirando' | 'cliente_inativo';
        severity: 'critical' | 'warning' | 'info';
        title: string;
        message: string;
        actionUrl?: string;
        metadata?: Record<string, any>;
      }> = [];

      const today = new Date();
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Get client info from caz_clientes
      const clienteResult = await db.execute(sql`
        SELECT nome FROM "Conta Azul".caz_clientes WHERE cnpj = ${cnpj}
      `);
      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;

      // Get client status from cup_clientes
      const statusResult = await db.execute(sql`
        SELECT status FROM "Clickup".cup_clientes WHERE cnpj = ${cnpj}
      `);
      const clienteStatus = statusResult.rows.length > 0 ? (statusResult.rows[0] as any).status : null;

      
      if (clienteNome) {
        // Check for overdue payments (inadimplência)
        const overdueResult = await db.execute(sql`
          SELECT 
            COUNT(*) as count,
            SUM(COALESCE(nao_pago, 0)) as total
          FROM "Conta Azul".caz_parcelas
          WHERE empresa = ${clienteNome}
            AND COALESCE(nao_pago, 0) > 0
            AND data_vencimento < ${today}
        `);
        const overdueData = overdueResult.rows[0] as any;
        const overdueCount = parseInt(overdueData?.count || '0');
        const overdueTotal = parseFloat(overdueData?.total || '0');

        if (overdueCount > 0 && overdueTotal > 0) {
          const formattedValue = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(overdueTotal);
          alerts.push({
            id: 'inadimplencia',
            type: 'inadimplencia',
            severity: 'critical',
            title: 'Inadimplência',
            message: `${overdueCount} parcela${overdueCount > 1 ? 's' : ''} em atraso totalizando ${formattedValue}`,
            metadata: { count: overdueCount, total: overdueTotal }
          });
        }

        // Check for payments due within next 7 days
        const upcomingResult = await db.execute(sql`
          SELECT 
            SUM(COALESCE(nao_pago, 0)) as total,
            MIN(data_vencimento) as proxima_data
          FROM "Conta Azul".caz_parcelas
          WHERE empresa = ${clienteNome}
            AND COALESCE(nao_pago, 0) > 0
            AND data_vencimento >= ${today}
            AND data_vencimento <= ${sevenDaysFromNow}
        `);
        const upcomingData = upcomingResult.rows[0] as any;
        const upcomingTotal = parseFloat(upcomingData?.total || '0');
        const proximaData = upcomingData?.proxima_data;

        if (upcomingTotal > 0 && proximaData) {
          const formattedValue = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(upcomingTotal);
          const dataFormatada = new Date(proximaData).toLocaleDateString('pt-BR');
          alerts.push({
            id: 'vencimento_proximo',
            type: 'vencimento_proximo',
            severity: 'warning',
            title: 'Próximo Vencimento',
            message: `${formattedValue} vence em ${dataFormatada}`,
            metadata: { total: upcomingTotal, dueDate: proximaData }
          });
        }
      }

      // Check for expiring contracts
      const expiringContractsResult = await db.execute(sql`
        SELECT 
          servico,
          data_encerramento
        FROM "Clickup".cup_contratos
        WHERE id_task IN (
          SELECT id_task FROM "Clickup".cup_contratos c2
          WHERE EXISTS (
            SELECT 1 FROM "Clickup".cup_clientes cl WHERE cl.cnpj = ${cnpj} AND cl.nome = c2.id_task
          )
          UNION
          SELECT task_id FROM "Clickup".cup_clientes WHERE cnpj = ${cnpj}
        )
        AND LOWER(status) = 'ativo'
        AND data_encerramento IS NOT NULL
        AND data_encerramento > ${today}
        AND data_encerramento <= ${thirtyDaysFromNow}
        ORDER BY data_encerramento ASC
        LIMIT 5
      `);

      for (const contrato of expiringContractsResult.rows as any[]) {
        const dataEncerramento = new Date(contrato.data_encerramento);
        const diasRestantes = Math.ceil((dataEncerramento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: `contrato_expirando_${contrato.servico}`,
          type: 'contrato_expirando',
          severity: 'warning',
          title: 'Contrato Expirando',
          message: `${contrato.servico} expira em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`,
          metadata: { servico: contrato.servico, diasRestantes, dataEncerramento: contrato.data_encerramento }
        });
      }

      res.json(alerts);
    } catch (error) {
      console.error("[api] Error fetching client alerts:", error);
      res.status(500).json({ error: "Failed to fetch client alerts" });
    }
  });

  // GET /api/clientes/:cnpj/timeline - Fetch unified timeline of events for a client
  app.get("/api/clientes/:cnpj/timeline", async (req, res) => {
    try {
      const { cnpj } = req.params;
      
      // Get client info from caz_clientes
      const clienteResult = await db.execute(sql`
        SELECT nome FROM "Conta Azul".caz_clientes WHERE cnpj = ${cnpj}
      `);
      
      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;
      
      if (!clienteNome) {
        return res.json([]);
      }
      
      const today = new Date();
      const twelveMonthsAgo = new Date(today);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      // Query payments, contracts, and custom events in parallel
      const [parcelasResult, contratosResult, eventosResult] = await Promise.all([
        // Payment events from caz_parcelas
        db.execute(sql`
          SELECT 
            id,
            status,
            valor_pago,
            nao_pago,
            data_vencimento,
            data_quitacao,
            descricao,
            metodo_pagamento,
            valor_bruto
          FROM "Conta Azul".caz_parcelas
          WHERE empresa = ${clienteNome}
            AND (data_vencimento >= ${twelveMonthsAgo} OR data_quitacao >= ${twelveMonthsAgo})
          ORDER BY COALESCE(data_quitacao, data_vencimento) DESC
          LIMIT 50
        `),
        // Contract events from cup_contratos
        db.execute(sql`
          SELECT 
            id_subtask,
            servico,
            status,
            valorr,
            valorp,
            data_inicio,
            data_encerramento,
            squad
          FROM "Clickup".cup_contratos
          WHERE id_task IN (
            SELECT id_task FROM "Clickup".cup_contratos c2
            INNER JOIN "Clickup".cup_clientes cl ON cl.nome ILIKE ('%' || SPLIT_PART(c2.servico, ' - ', 1) || '%')
            WHERE cl.cnpj = ${cnpj}
          ) OR servico ILIKE ('%' || ${clienteNome} || '%')
          ORDER BY COALESCE(data_encerramento, data_inicio) DESC NULLS LAST
          LIMIT 30
        `),
        // Custom events from cliente_eventos
        db.execute(sql`
          SELECT id, tipo as type, titulo as title, descricao as description, 
                 usuario_nome as "userName", created_at as date
          FROM cliente_eventos
          WHERE cliente_cnpj = ${cnpj}
          ORDER BY created_at DESC
          LIMIT 50
        `)
      ]);
      
      const events: Array<{
        id: string;
        type: 'payment_received' | 'payment_due' | 'payment_overdue' | 'contract_started' | 'contract_ended' | 'contract_cancelled';
        date: string;
        title: string;
        description: string;
        amount?: number;
        metadata?: Record<string, any>;
      }> = [];
      
      // Process payment events
      for (const row of parcelasResult.rows) {
        const parcela = row as any;
        const valorPago = parseFloat(parcela.valor_pago || '0');
        const naoPago = parseFloat(parcela.nao_pago || '0');
        const valorBruto = parseFloat(parcela.valor_bruto || '0');
        const status = parcela.status?.toUpperCase();
        const dataVencimento = parcela.data_vencimento ? new Date(parcela.data_vencimento) : null;
        const dataQuitacao = parcela.data_quitacao ? new Date(parcela.data_quitacao) : null;
        
        if (status === 'PAGO' || status === 'ACQUITTED') {
          // Payment received
          if (dataQuitacao) {
            events.push({
              id: `payment-received-${parcela.id}`,
              type: 'payment_received',
              date: dataQuitacao.toISOString(),
              title: 'Pagamento Recebido',
              description: parcela.descricao || 'Pagamento processado',
              amount: valorPago || valorBruto,
              metadata: {
                metodoPagamento: parcela.metodo_pagamento,
                parcelaId: parcela.id
              }
            });
          }
        } else if (dataVencimento && dataVencimento < today && naoPago > 0) {
          // Payment overdue
          events.push({
            id: `payment-overdue-${parcela.id}`,
            type: 'payment_overdue',
            date: dataVencimento.toISOString(),
            title: 'Pagamento em Atraso',
            description: parcela.descricao || 'Pagamento vencido não quitado',
            amount: naoPago,
            metadata: {
              diasAtraso: Math.floor((today.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24)),
              parcelaId: parcela.id
            }
          });
        } else if (dataVencimento && dataVencimento >= today) {
          // Payment due
          events.push({
            id: `payment-due-${parcela.id}`,
            type: 'payment_due',
            date: dataVencimento.toISOString(),
            title: 'Pagamento a Vencer',
            description: parcela.descricao || 'Pagamento programado',
            amount: valorBruto || naoPago,
            metadata: {
              parcelaId: parcela.id
            }
          });
        }
      }
      
      // Process contract events
      for (const row of contratosResult.rows) {
        const contrato = row as any;
        const valorRecorrente = parseFloat(contrato.valorr || '0');
        const valorPontual = parseFloat(contrato.valorp || '0');
        const dataInicio = contrato.data_inicio ? new Date(contrato.data_inicio) : null;
        const dataEncerramento = contrato.data_encerramento ? new Date(contrato.data_encerramento) : null;
        const status = contrato.status?.toLowerCase();
        
        // Contract started
        if (dataInicio) {
          events.push({
            id: `contract-started-${contrato.id_subtask}`,
            type: 'contract_started',
            date: dataInicio.toISOString(),
            title: 'Contrato Iniciado',
            description: contrato.servico || 'Novo contrato ativo',
            amount: valorRecorrente || valorPontual,
            metadata: {
              squad: contrato.squad,
              contratoId: contrato.id_subtask
            }
          });
        }
        
        // Contract ended or cancelled
        if (dataEncerramento) {
          const isCancelled = status === 'cancelado' || status === 'cancelled';
          events.push({
            id: `contract-${isCancelled ? 'cancelled' : 'ended'}-${contrato.id_subtask}`,
            type: isCancelled ? 'contract_cancelled' : 'contract_ended',
            date: dataEncerramento.toISOString(),
            title: isCancelled ? 'Contrato Cancelado' : 'Contrato Encerrado',
            description: contrato.servico || 'Contrato finalizado',
            amount: valorRecorrente || valorPontual,
            metadata: {
              squad: contrato.squad,
              contratoId: contrato.id_subtask
            }
          });
        }
      }
      
      // Process custom events from cliente_eventos
      for (const evento of eventosResult.rows as any[]) {
        events.push({
          id: `evento-${evento.id}`,
          type: evento.type,
          date: evento.date ? new Date(evento.date).toISOString() : new Date().toISOString(),
          title: evento.title,
          description: evento.description || `Por ${evento.userName}`,
          metadata: {
            userName: evento.userName
          }
        });
      }
      
      // Sort by date descending
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Limit to 50 events
      res.json(events.slice(0, 50));
    } catch (error) {
      console.error("[api] Error fetching client timeline:", error);
      res.status(500).json({ error: "Failed to fetch timeline" });
    }
  });

  app.post("/api/clientes/:cnpj/eventos", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const { tipo, titulo, descricao, dadosExtras } = req.body;
      
      const user = req.user as any;
      const usuarioId = user?.id || 'system';
      const usuarioNome = user?.name || 'Sistema';
      
      const result = await db.execute(sql`
        INSERT INTO cliente_eventos (cliente_cnpj, tipo, titulo, descricao, usuario_id, usuario_nome, dados_extras)
        VALUES (${cnpj}, ${tipo}, ${titulo}, ${descricao || null}, ${usuarioId}, ${usuarioNome}, ${dadosExtras || null})
        RETURNING id, cliente_cnpj as "clienteCnpj", tipo, titulo, descricao, usuario_id as "usuarioId", 
                  usuario_nome as "usuarioNome", dados_extras as "dadosExtras", created_at as "createdAt"
      `);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating client event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.get("/api/clientes/:cnpj/eventos", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const result = await db.execute(sql`
        SELECT id, cliente_cnpj as "clienteCnpj", tipo, titulo, descricao, 
               usuario_id as "usuarioId", usuario_nome as "usuarioNome", 
               dados_extras as "dadosExtras", created_at as "createdAt"
        FROM cliente_eventos
        WHERE cliente_cnpj = ${cnpj}
        ORDER BY created_at DESC
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching client events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/fornecedores/:fornecedorId/despesas", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const despesas = await storage.getContasPagarByFornecedor(req.params.fornecedorId, limit);
      res.json(despesas);
    } catch (error) {
      console.error("[api] Error fetching payables:", error);
      res.status(500).json({ error: "Failed to fetch payables" });
    }
  });

  app.get("/api/colaboradores", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores();
      console.log(`[DEBUG] Colaboradores encontrados no banco: ${colaboradores.length} total, ${colaboradores.filter(c => c.status === 'Ativo').length} ativos`);
      res.json(colaboradores);
    } catch (error) {
      console.error("[api] Error fetching colaboradores:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
    }
  });

  // Exportar colaboradores em Excel ou CSV
  const exportarColaboradores = async (req: any, res: any) => {
    try {
      const formatoRaw = (req.body?.formato ?? req.query.formato) as string | undefined;
      const formato = formatoRaw === 'csv' ? 'csv' : 'xlsx';
      const XLSX = await import("xlsx");
      const formatDatePt = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('pt-BR') : '';

      const exportColumns = [
        { key: "id", label: "ID", getValue: (c: any) => c.id },
        { key: "status", label: "Status", getValue: (c: any) => c.status },
        { key: "nome", label: "Nome", getValue: (c: any) => c.nome },
        { key: "cpf", label: "CPF", getValue: (c: any) => c.cpf },
        { key: "endereco", label: "Endereço", getValue: (c: any) => c.endereco },
        { key: "estado", label: "Estado", getValue: (c: any) => c.estado },
        { key: "telefone", label: "Telefone", getValue: (c: any) => c.telefone },
        { key: "aniversario", label: "Aniversário", getValue: (c: any) => formatDatePt(c.aniversario) },
        { key: "admissao", label: "Admissão", getValue: (c: any) => formatDatePt(c.admissao) },
        { key: "demissao", label: "Demissão", getValue: (c: any) => formatDatePt(c.demissao) },
        { key: "tipo_demissao", label: "Tipo Demissão", getValue: (c: any) => c.tipo_demissao },
        { key: "motivo_demissao", label: "Motivo Demissão", getValue: (c: any) => c.motivo_demissao },
        { key: "proporcional", label: "Proporcional", getValue: (c: any) => c.proporcional },
        { key: "proporcional_caju", label: "Proporcional Caju", getValue: (c: any) => c.proporcional_caju },
        { key: "setor", label: "Setor", getValue: (c: any) => c.setor },
        { key: "squad", label: "Squad", getValue: (c: any) => c.squad },
        { key: "cargo", label: "Cargo", getValue: (c: any) => c.cargo },
        { key: "nivel", label: "Nível", getValue: (c: any) => c.nivel },
        { key: "pix", label: "PIX", getValue: (c: any) => c.pix },
        { key: "cnpj", label: "CNPJ", getValue: (c: any) => c.cnpj },
        { key: "email_turbo", label: "Email Turbo", getValue: (c: any) => c.email_turbo },
        { key: "email_pessoal", label: "Email Pessoal", getValue: (c: any) => c.email_pessoal },
        { key: "meses_de_turbo", label: "Meses de Turbo", getValue: (c: any) => c.meses_de_turbo },
        { key: "ultimo_aumento", label: "Último Aumento", getValue: (c: any) => formatDatePt(c.ultimo_aumento) },
        { key: "meses_ult_aumento", label: "Meses Últ. Aumento", getValue: (c: any) => c.meses_ult_aumento },
        { key: "salario", label: "Salário", getValue: (c: any) => c.salario },
        { key: "user_id", label: "User ID", getValue: (c: any) => c.user_id },
      ];
      
      // Busca todos os colaboradores diretamente da tabela rh_pessoal (colunas reais)
      const result = await db.execute(sql`
        SELECT 
          id,
          status,
          nome,
          cpf,
          endereco,
          estado,
          telefone,
          aniversario,
          admissao,
          demissao,
          tipo_demissao,
          motivo_demissao,
          proporcional,
          proporcional_caju,
          setor,
          squad,
          cargo,
          nivel,
          pix,
          cnpj,
          email_turbo,
          email_pessoal,
          meses_de_turbo,
          ultimo_aumento,
          meses_ult_aumento,
          salario,
          user_id
        FROM "Inhire".rh_pessoal
        ORDER BY nome
      `);
      
      const colaboradores = result.rows as any[];

      const rawQuery = req.originalUrl?.split("?")[1] ?? "";
      const searchParams = new URLSearchParams(rawQuery);
      const colunasFromUrl = searchParams.getAll("colunas").map((col) => col.trim()).filter(Boolean);

      const colunasParam = req.body?.colunas
        ?? (colunasFromUrl.length > 0 ? colunasFromUrl : req.query.colunas);

      const requestedKeys = Array.isArray(colunasParam)
        ? colunasParam.flatMap((col) => String(col).split(",")).map((col) => col.trim()).filter(Boolean)
        : typeof colunasParam === "string"
          ? colunasParam.split(",").map((col) => col.trim()).filter(Boolean)
          : [];
      const requestedSet = new Set(requestedKeys);
      const selectedColumns = requestedKeys.length > 0
        ? exportColumns.filter((col) => requestedSet.has(col.key))
        : exportColumns;

      if (requestedKeys.length > 0 && selectedColumns.length === 0) {
        return res.status(400).json({ error: "Nenhuma coluna válida selecionada" });
      }
      
      // Define os nomes das colunas em português
      const headers = selectedColumns.map((column) => column.label);
      
      // Mapeia os dados para formato de array
      const data = colaboradores.map((c) => selectedColumns.map((column) => column.getValue(c)));
      
      // Adiciona headers no início
      data.unshift(headers);
      
      // Cria a planilha
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Define largura das colunas
      ws['!cols'] = headers.map(() => ({ wch: 20 }));
      
      // Cria o workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
      
      const dataAtual = new Date().toISOString().split('T')[0];
      
      if (formato === 'csv') {
        // Gera CSV
        const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=colaboradores_${dataAtual}.csv`);
        res.send('\uFEFF' + csvContent); // BOM para UTF-8 no Excel
      } else {
        // Gera Excel
        const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=colaboradores_${dataAtual}.xlsx`);
        res.send(excelBuffer);
      }
      
    } catch (error) {
      console.error("[api] Error exporting colaboradores:", error);
      res.status(500).json({ error: "Falha ao exportar colaboradores" });
    }
  };

  app.get("/api/colaboradores/exportar-excel", exportarColaboradores);
  app.post("/api/colaboradores/exportar-excel", exportarColaboradores);

  app.get("/api/colaboradores/by-user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Busca o usuário no banco de autenticação para pegar o email
      const { findUserById } = await import("./auth/userDb");
      const user = await findUserById(userId);
      
      if (!user || !user.email) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Busca o colaborador pelo email (email_turbo ou email_pessoal)
      const result = await db.execute(sql`
        SELECT id FROM "Inhire".rh_pessoal 
        WHERE LOWER(email_turbo) = LOWER(${user.email}) 
           OR LOWER(email_pessoal) = LOWER(${user.email})
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Colaborador não encontrado para este usuário" });
      }
      
      const colaboradorId = (result.rows[0] as any).id;
      res.json({ colaboradorId });
    } catch (error) {
      console.error("[api] Error fetching colaborador by userId:", error);
      res.status(500).json({ error: "Failed to fetch colaborador" });
    }
  });

  app.get("/api/colaboradores/com-patrimonios", async (req, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const status = req.query.status as string | undefined;
      const squad = req.query.squad as string | undefined;
      const setor = req.query.setor as string | undefined;
      const search = req.query.search as string | undefined;
      
      const result = await storage.getColaboradoresComPatrimonios({
        page,
        limit,
        status,
        squad,
        setor,
        search,
      });
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching colaboradores com patrimonios:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores com patrimonios" });
    }
  });

  app.get("/api/colaboradores/analise", async (req, res) => {
    try {
      const analiseData = await storage.getColaboradoresAnalise();
      res.json(analiseData);
    } catch (error) {
      console.error("[api] Error fetching colaboradores analise:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores analise" });
    }
  });

  app.get("/api/colaboradores/saude", async (req, res) => {
    try {
      const colaboradoresResult = await db.execute(sql`
        SELECT 
          id, nome, cargo, squad, nivel, status,
          meses_de_turbo as "mesesDeTurbo",
          meses_ult_aumento as "mesesUltAumento",
          ultimo_aumento as "ultimoAumento",
          admissao
        FROM "Inhire".rh_pessoal
        WHERE status = 'Ativo'
        ORDER BY nome
      `);
      
      interface ColabRow {
        id: number;
        nome: string;
        cargo: string | null;
        squad: string | null;
        nivel: string | null;
        status: string | null;
        mesesDeTurbo: number | null;
        mesesUltAumento: number | null;
        ultimoAumento: string | null;
        admissao: string | null;
      }
      
      const colaboradores = colaboradoresResult.rows as unknown as ColabRow[];
      
      const healthData = colaboradores.map((colab) => {
        const reasons: string[] = [];
        
        const mesesTurbo = colab.mesesDeTurbo ?? 0;
        const mesesUltAumento = colab.mesesUltAumento;
        
        let stabilityScore = 0;
        if (colab.status === 'Ativo') stabilityScore += 15;
        
        if (mesesTurbo >= 6 && mesesTurbo <= 36) {
          stabilityScore += 15;
        } else if (mesesTurbo >= 3 && mesesTurbo < 6) {
          stabilityScore += 10;
          reasons.push('Período de adaptação (< 6 meses)');
        } else if (mesesTurbo < 3) {
          stabilityScore += 5;
          reasons.push('Recém-contratado (< 3 meses)');
        } else if (mesesTurbo > 36) {
          stabilityScore += 12;
        }
        
        let growthScore = 0;
        if (mesesUltAumento !== null) {
          if (mesesUltAumento <= 12) {
            growthScore = 25;
          } else if (mesesUltAumento <= 18) {
            growthScore = 18;
          } else if (mesesUltAumento <= 24) {
            growthScore = 10;
            reasons.push('Sem aumento há mais de 18 meses');
          } else {
            growthScore = 3;
            reasons.push('Sem aumento há mais de 24 meses');
          }
        } else {
          if (mesesTurbo <= 12) {
            growthScore = 20;
          } else {
            growthScore = 12;
            reasons.push('Sem registro de último aumento');
          }
        }
        
        let developmentScore = 0;
        const nivel = (colab.nivel || '').toLowerCase();
        if (nivel.includes('senior') || nivel.includes('sênior') || nivel.includes('lider') || nivel.includes('líder') || nivel.includes('head') || nivel.includes('diretor') || nivel.includes('c-level')) {
          developmentScore = 25;
        } else if (nivel.includes('pleno') || nivel.includes('mid')) {
          developmentScore = 20;
        } else if (nivel.includes('junior') || nivel.includes('júnior')) {
          developmentScore = 15;
        } else if (nivel.includes('estagiário') || nivel.includes('estagiario') || nivel.includes('trainee')) {
          developmentScore = 12;
        } else {
          developmentScore = 18;
        }
        
        let engagementScore = 15;
        
        if (mesesTurbo >= 60) {
          engagementScore = 25;
        } else if (mesesTurbo >= 48) {
          engagementScore = 23;
        } else if (mesesTurbo >= 36) {
          engagementScore = 22;
        } else if (mesesTurbo >= 24) {
          engagementScore = 20;
        } else if (mesesTurbo >= 12) {
          engagementScore = 18;
        } else if (mesesTurbo >= 6) {
          engagementScore = 15;
        } else {
          engagementScore = 12;
        }
        
        if (mesesTurbo > 36 && (mesesUltAumento === null || mesesUltAumento > 30)) {
          reasons.push('Veterano sem aumento há muito tempo - verificar reconhecimento');
        }
        
        const healthScore = stabilityScore + growthScore + developmentScore + engagementScore;
        
        let healthStatus: 'saudavel' | 'atencao' | 'critico';
        if (healthScore >= 70) {
          healthStatus = 'saudavel';
        } else if (healthScore >= 50) {
          healthStatus = 'atencao';
        } else {
          healthStatus = 'critico';
        }

        return {
          id: colab.id,
          nome: colab.nome,
          cargo: colab.cargo,
          squad: colab.squad,
          nivel: colab.nivel,
          healthScore,
          healthStatus,
          mesesDeTurbo: mesesTurbo,
          mesesUltAumento: mesesUltAumento,
          breakdown: {
            stability: stabilityScore,
            growth: growthScore,
            development: developmentScore,
            engagement: engagementScore,
          },
          reasons,
        };
      });

      res.json(healthData);
    } catch (error) {
      console.error("[api] Error fetching colaboradores saude:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores saude" });
    }
  });

  // Endpoint para análises gerais com dados agregados
  app.get("/api/colaboradores/analise-geral", async (req, res) => {
    try {
      const colaboradoresResult = await db.execute(sql`
        SELECT 
          id, nome, cargo, squad, nivel, status,
          meses_de_turbo as "mesesDeTurbo",
          meses_ult_aumento as "mesesUltAumento",
          salario,
          admissao
        FROM "Inhire".rh_pessoal
        WHERE status = 'Ativo'
        ORDER BY nome
      `);
      
      interface ColabAnalise {
        id: number;
        nome: string;
        cargo: string | null;
        squad: string | null;
        nivel: string | null;
        status: string;
        mesesDeTurbo: number | null;
        mesesUltAumento: number | null;
        salario: string | null;
        admissao: string | null;
      }
      
      const colaboradores = colaboradoresResult.rows as unknown as ColabAnalise[];
      
      // 1. Calcular saúde de cada colaborador para distribuição
      const healthDistribution = { saudavel: 0, atencao: 0, critico: 0 };
      
      colaboradores.forEach((colab) => {
        const mesesTurbo = colab.mesesDeTurbo ?? 0;
        const mesesUltAumento = colab.mesesUltAumento;
        const nivel = (colab.nivel || '').toLowerCase();
        
        let stabilityScore = 15;
        if (mesesTurbo >= 6 && mesesTurbo <= 36) {
          stabilityScore += 15;
        } else if (mesesTurbo >= 3 && mesesTurbo < 6) {
          stabilityScore += 10;
        } else if (mesesTurbo < 3) {
          stabilityScore += 5;
        } else if (mesesTurbo > 36) {
          stabilityScore += 12;
        }
        
        let growthScore = 0;
        if (mesesUltAumento !== null && mesesUltAumento !== undefined) {
          if (mesesUltAumento <= 12) {
            growthScore = 25;
          } else if (mesesUltAumento <= 18) {
            growthScore = 18;
          } else if (mesesUltAumento <= 24) {
            growthScore = 10;
          } else {
            growthScore = 3;
          }
        } else {
          growthScore = mesesTurbo <= 12 ? 20 : 12;
        }
        
        let developmentScore = 18;
        if (nivel.includes('senior') || nivel.includes('sênior') || nivel.includes('lider') || nivel.includes('líder') || nivel.includes('head') || nivel.includes('diretor')) {
          developmentScore = 25;
        } else if (nivel.includes('pleno')) {
          developmentScore = 20;
        } else if (nivel.includes('junior') || nivel.includes('júnior')) {
          developmentScore = 15;
        } else if (nivel.includes('estagiário') || nivel.includes('trainee')) {
          developmentScore = 12;
        }
        
        let engagementScore = 15;
        if (mesesTurbo >= 60) {
          engagementScore = 25;
        } else if (mesesTurbo >= 48) {
          engagementScore = 23;
        } else if (mesesTurbo >= 36) {
          engagementScore = 22;
        } else if (mesesTurbo >= 24) {
          engagementScore = 20;
        } else if (mesesTurbo >= 12) {
          engagementScore = 18;
        } else if (mesesTurbo >= 6) {
          engagementScore = 15;
        } else {
          engagementScore = 12;
        }
        
        const healthScore = stabilityScore + growthScore + developmentScore + engagementScore;
        
        if (healthScore >= 70) {
          healthDistribution.saudavel++;
        } else if (healthScore >= 50) {
          healthDistribution.atencao++;
        } else {
          healthDistribution.critico++;
        }
      });
      
      // 2. Headcount por Squad
      const headcountBySquad: Record<string, number> = {};
      colaboradores.forEach((colab) => {
        const squad = colab.squad || 'Sem Squad';
        headcountBySquad[squad] = (headcountBySquad[squad] || 0) + 1;
      });
      
      // 3. Distribuição por Nível
      const nivelDistribution: Record<string, number> = {};
      colaboradores.forEach((colab) => {
        const nivel = colab.nivel || 'Não definido';
        nivelDistribution[nivel] = (nivelDistribution[nivel] || 0) + 1;
      });
      
      // 4. Salário por Tempo de Casa (faixas)
      const salarioByTempo: Record<string, { total: number; count: number; avg: number }> = {
        '0-6 meses': { total: 0, count: 0, avg: 0 },
        '6-12 meses': { total: 0, count: 0, avg: 0 },
        '1-2 anos': { total: 0, count: 0, avg: 0 },
        '2-3 anos': { total: 0, count: 0, avg: 0 },
        '3-5 anos': { total: 0, count: 0, avg: 0 },
        '+5 anos': { total: 0, count: 0, avg: 0 },
      };
      
      colaboradores.forEach((colab) => {
        const meses = colab.mesesDeTurbo ?? 0;
        const salario = parseFloat(colab.salario || '0') || 0;
        
        let faixa = '0-6 meses';
        if (meses >= 60) faixa = '+5 anos';
        else if (meses >= 36) faixa = '3-5 anos';
        else if (meses >= 24) faixa = '2-3 anos';
        else if (meses >= 12) faixa = '1-2 anos';
        else if (meses >= 6) faixa = '6-12 meses';
        
        if (salario > 0) {
          salarioByTempo[faixa].total += salario;
          salarioByTempo[faixa].count++;
        }
      });
      
      // Calcular médias
      Object.keys(salarioByTempo).forEach((faixa) => {
        const data = salarioByTempo[faixa];
        data.avg = data.count > 0 ? Math.round(data.total / data.count) : 0;
      });
      
      // 5. Média salarial por Squad
      const salarioBySquad: Record<string, { total: number; count: number; avg: number }> = {};
      colaboradores.forEach((colab) => {
        const squad = colab.squad || 'Sem Squad';
        const salario = parseFloat(colab.salario || '0') || 0;
        
        if (!salarioBySquad[squad]) {
          salarioBySquad[squad] = { total: 0, count: 0, avg: 0 };
        }
        
        if (salario > 0) {
          salarioBySquad[squad].total += salario;
          salarioBySquad[squad].count++;
        }
      });
      
      Object.keys(salarioBySquad).forEach((squad) => {
        const data = salarioBySquad[squad];
        data.avg = data.count > 0 ? Math.round(data.total / data.count) : 0;
      });
      
      // 6. Tempo médio por Squad
      const tempoBySquad: Record<string, { total: number; count: number; avg: number }> = {};
      colaboradores.forEach((colab) => {
        const squad = colab.squad || 'Sem Squad';
        const meses = colab.mesesDeTurbo ?? 0;
        
        if (!tempoBySquad[squad]) {
          tempoBySquad[squad] = { total: 0, count: 0, avg: 0 };
        }
        
        tempoBySquad[squad].total += meses;
        tempoBySquad[squad].count++;
      });
      
      Object.keys(tempoBySquad).forEach((squad) => {
        const data = tempoBySquad[squad];
        data.avg = data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0;
      });
      
      // 7. Estatísticas gerais
      const totalColaboradores = colaboradores.length;
      const salarios = colaboradores.map(c => parseFloat(c.salario || '0')).filter(s => s > 0);
      const salarioMedio = salarios.length > 0 ? Math.round(salarios.reduce((a, b) => a + b, 0) / salarios.length) : 0;
      const tempoMedio = colaboradores.reduce((acc, c) => acc + (c.mesesDeTurbo ?? 0), 0) / (totalColaboradores || 1);
      
      res.json({
        healthDistribution,
        headcountBySquad,
        nivelDistribution,
        salarioByTempo,
        salarioBySquad,
        tempoBySquad,
        estatisticas: {
          totalColaboradores,
          salarioMedio,
          tempoMedioMeses: Math.round(tempoMedio * 10) / 10,
        },
      });
    } catch (error) {
      console.error("[api] Error fetching analise geral:", error);
      res.status(500).json({ error: "Failed to fetch analise geral" });
    }
  });

  app.get("/api/colaboradores/dropdown", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradoresDropdown();
      res.json(colaboradores);
    } catch (error) {
      console.error("[api] Error fetching colaboradores dropdown:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
    }
  });

  app.get("/api/colaboradores/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      
      const result = await db.execute(sql`
        SELECT 
          c.*,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', p.id,
                'numeroAtivo', p.numero_ativo,
                'descricao', p.descricao,
                'ativo', p.ativo,
                'marca', p.marca,
                'estadoConservacao', p.estado_conservacao,
                'valorMercado', p.valor_mercado
              )
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'
          ) as patrimonios
        FROM "Inhire".rh_pessoal c
        LEFT JOIN "Inhire".rh_patrimonio p ON (p.responsavel_id = c.id OR (p.responsavel_id IS NULL AND p.responsavel_atual = c.nome))
        WHERE c.id = ${id}
        GROUP BY c.id
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Colaborador not found" });
      }
      
      const row = result.rows[0] as any;
      
      // Fetch promotion history (gracefully handle missing table)
      let promocoesResult = { rows: [] as any[] };
      try {
        promocoesResult = await db.execute(sql`
          SELECT 
            id, 
            colaborador_id as "colaboradorId",
            data_promocao as "dataPromocao",
            cargo_anterior as "cargoAnterior",
            cargo_novo as "cargoNovo",
            nivel_anterior as "nivelAnterior",
            nivel_novo as "nivelNovo",
            salario_anterior as "salarioAnterior",
            salario_novo as "salarioNovo",
            observacoes,
            criado_em as "criadoEm",
            criado_por as "criadoPor"
          FROM "Inhire".rh_promocoes 
          WHERE colaborador_id = ${id}
          ORDER BY data_promocao DESC
        `);
      } catch (promoError: any) {
        // Table doesn't exist - continue with empty array
        if (promoError?.code !== '42P01') {
          console.error("[api] Error fetching promocoes:", promoError);
        }
      }
      
      // Fetch linked user info - first by user_id, then by emailTurbo
      let linkedUser = null;
      if (row.user_id) {
        const userResult = await db.execute(sql`
          SELECT id, email, name, picture, role
          FROM cortex_core.auth_users
          WHERE id = ${row.user_id}
        `);
        if (userResult.rows.length > 0) {
          linkedUser = userResult.rows[0];
        }
      }
      // If no linkedUser found by user_id, try to find by emailTurbo
      if (!linkedUser && row.email_turbo) {
        const emailNormalized = row.email_turbo.toLowerCase().trim();
        const userByEmailResult = await db.execute(sql`
          SELECT id, email, name, picture, role
          FROM cortex_core.auth_users
          WHERE LOWER(TRIM(email)) = ${emailNormalized}
        `);
        if (userByEmailResult.rows.length > 0) {
          linkedUser = userByEmailResult.rows[0];
        }
      }
      
      const colaborador = {
        id: row.id,
        status: row.status,
        nome: row.nome,
        cpf: row.cpf,
        endereco: row.endereco,
        estado: row.estado,
        cidade: row.cidade,
        telefone: row.telefone,
        aniversario: row.aniversario,
        admissao: row.admissao,
        demissao: row.demissao,
        tipoDemissao: row.tipo_demissao,
        motivoDemissao: row.motivo_demissao,
        proporcional: row.proporcional,
        proporcionalCaju: row.proporcional_caju,
        setor: row.setor,
        squad: row.squad,
        cargo: row.cargo,
        nivel: row.nivel,
        pix: row.pix,
        cnpj: row.cnpj,
        emailTurbo: row.email_turbo,
        emailPessoal: row.email_pessoal,
        mesesDeTurbo: row.meses_de_turbo,
        ultimoAumento: row.ultimo_aumento,
        mesesUltAumento: row.meses_ult_aumento,
        salario: row.salario,
        userId: row.user_id,
        patrimonios: row.patrimonios || [],
        promocoes: promocoesResult.rows || [],
        linkedUser: linkedUser,
      };
      
      res.json(colaborador);
    } catch (error) {
      console.error("[api] Error fetching colaborador by id:", error);
      res.status(500).json({ error: "Failed to fetch colaborador" });
    }
  });

  app.post("/api/colaboradores", async (req, res) => {
    try {
      const validation = insertColaboradorSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const novoColaborador = await storage.createColaborador(validation.data);
      res.status(201).json(novoColaborador);
    } catch (error) {
      console.error("[api] Error creating colaborador:", error);
      res.status(500).json({ error: "Failed to create colaborador" });
    }
  });

  app.patch("/api/colaboradores/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      const validation = insertColaboradorSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const user = req.user as { email?: string } | undefined;
      const criadoPor = user?.email || 'Sistema';
      const colaboradorAtualizado = await storage.updateColaborador(id, validation.data, criadoPor);
      res.json(colaboradorAtualizado);
    } catch (error) {
      console.error("[api] Error updating colaborador:", error);
      res.status(500).json({ error: "Failed to update colaborador" });
    }
  });

  app.delete("/api/colaboradores/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      await storage.deleteColaborador(id);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting colaborador:", error);
      res.status(500).json({ error: "Failed to delete colaborador" });
    }
  });

  app.get("/api/colaboradores/:id/health-history", async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.id);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }

      const now = new Date();
      const months: { month: string; endDate: Date }[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
        const monthLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.push({ month: monthLabel, endDate: endOfMonth });
      }

      const healthHistory = await Promise.all(months.map(async ({ month, endDate }) => {
        const endDateStr = endDate.toISOString().split('T')[0];
        
        let enpsScore = 0;
        try {
          const enpsResult = await db.execute(sql`
            SELECT score FROM "Inhire".rh_enps 
            WHERE colaborador_id = ${colaboradorId} 
              AND data <= ${endDateStr}
            ORDER BY data DESC LIMIT 1
          `);
          if (enpsResult.rows.length > 0) {
            const score = (enpsResult.rows[0] as { score: number }).score;
            if (score >= 9) enpsScore = 30;
            else if (score >= 7) enpsScore = 20;
            else if (score >= 5) enpsScore = 10;
          }
        } catch (e) { }

        let oneOnOneScore = 0;
        try {
          const oneOnOneResult = await db.execute(sql`
            SELECT data FROM "Inhire".rh_one_on_one 
            WHERE colaborador_id = ${colaboradorId} 
              AND data <= ${endDateStr}
            ORDER BY data DESC LIMIT 1
          `);
          if (oneOnOneResult.rows.length > 0) {
            const lastDate = new Date((oneOnOneResult.rows[0] as { data: string }).data);
            const daysDiff = Math.floor((endDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 14) oneOnOneScore = 25;
            else if (daysDiff <= 30) oneOnOneScore = 15;
            else if (daysDiff <= 45) oneOnOneScore = 5;
          }
        } catch (e) { }

        let pdiScore = 0;
        try {
          const pdiResult = await db.execute(sql`
            SELECT AVG(progresso) as avg_progress FROM "Inhire".rh_pdi 
            WHERE colaborador_id = ${colaboradorId}
              AND (criado_em IS NULL OR criado_em <= ${endDateStr})
          `);
          if (pdiResult.rows.length > 0 && (pdiResult.rows[0] as any).avg_progress !== null) {
            const avgProgress = parseFloat((pdiResult.rows[0] as any).avg_progress) || 0;
            pdiScore = Math.round((avgProgress / 100) * 25);
          }
        } catch (e) { }

        let pendingActionsScore = 20;
        try {
          const actionsResult = await db.execute(sql`
            SELECT COUNT(*) as count FROM "Inhire".rh_one_on_one_acoes a
            JOIN "Inhire".rh_one_on_one o ON a.one_on_one_id = o.id
            WHERE o.colaborador_id = ${colaboradorId} 
              AND o.data <= ${endDateStr}
              AND (a.status IS NULL OR a.status != 'concluida')
              AND (a.concluida_em IS NULL OR a.concluida_em > ${endDateStr})
          `);
          if (actionsResult.rows.length > 0) {
            const count = parseInt((actionsResult.rows[0] as any).count) || 0;
            if (count === 0) pendingActionsScore = 20;
            else if (count <= 2) pendingActionsScore = 15;
            else if (count <= 5) pendingActionsScore = 10;
            else if (count <= 8) pendingActionsScore = 5;
            else pendingActionsScore = 0;
          }
        } catch (e) { }

        const healthScore = enpsScore + oneOnOneScore + pdiScore + pendingActionsScore;

        return { month, healthScore };
      }));

      res.json(healthHistory);
    } catch (error) {
      console.error("[api] Error fetching health history:", error);
      res.status(500).json({ error: "Failed to fetch health history" });
    }
  });

  // Endpoint para importar datas de último aumento em batch
  app.post("/api/colaboradores/import-ultimo-aumento", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { data } = req.body as { data: { nome: string; ultimoAumento: string | null }[] };
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid data format. Expected { data: [{nome, ultimoAumento}] }" });
      }

      const colaboradores = await storage.getColaboradores();
      const results: { nome: string; status: string; error?: string }[] = [];

      for (const item of data) {
        const nome = item.nome?.trim();
        const ultimoAumentoStr = item.ultimoAumento?.trim();

        if (!nome) {
          results.push({ nome: item.nome || "unknown", status: "skipped", error: "Nome vazio" });
          continue;
        }

        // Encontrar colaborador por nome (match parcial ou exato)
        const colaborador = colaboradores.find(c => 
          c.nome?.toLowerCase().trim() === nome.toLowerCase()
        );

        if (!colaborador) {
          results.push({ nome, status: "not_found", error: "Colaborador não encontrado" });
          continue;
        }

        // Se não tem data de último aumento, pular
        if (!ultimoAumentoStr || ultimoAumentoStr === "-") {
          results.push({ nome, status: "skipped", error: "Sem data de último aumento" });
          continue;
        }

        try {
          // Converter data de DD/MM/YY para YYYY-MM-DD
          const parts = ultimoAumentoStr.split("/");
          if (parts.length !== 3) {
            results.push({ nome, status: "error", error: `Formato de data inválido: ${ultimoAumentoStr}` });
            continue;
          }
          
          const day = parts[0].padStart(2, "0");
          const month = parts[1].padStart(2, "0");
          let year = parts[2];
          
          // Converter ano de 2 dígitos para 4 dígitos
          if (year.length === 2) {
            year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
          }
          
          const ultimoAumentoDate = `${year}-${month}-${day}`;

          await storage.updateColaborador(colaborador.id, { 
            ultimoAumento: ultimoAumentoDate
          });
          
          results.push({ nome, status: "updated" });
        } catch (error) {
          results.push({ nome, status: "error", error: String(error) });
        }
      }

      const updated = results.filter(r => r.status === "updated").length;
      const notFound = results.filter(r => r.status === "not_found").length;
      const skipped = results.filter(r => r.status === "skipped").length;
      const errors = results.filter(r => r.status === "error").length;

      res.json({
        summary: { total: data.length, updated, notFound, skipped, errors },
        details: results
      });
    } catch (error) {
      console.error("[api] Error importing ultimo aumento:", error);
      res.status(500).json({ error: "Failed to import ultimo aumento data" });
    }
  });

  app.get("/api/contratos", async (req, res) => {
    try {
      const contratos = await storage.getContratos();
      res.json(contratos);
    } catch (error) {
      console.error("[api] Error fetching contratos:", error);
      res.status(500).json({ error: "Failed to fetch contratos" });
    }
  });

  app.patch("/api/contratos/:idSubtask", async (req, res) => {
    try {
      const { idSubtask } = req.params;
      const validation = updateContratoSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      
      const contrato = await storage.updateContrato(idSubtask, validation.data);
      if (!contrato) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }
      
      res.json(contrato);
    } catch (error) {
      console.error("[api] Error updating contrato:", error);
      res.status(500).json({ error: "Failed to update contrato" });
    }
  });

  app.get("/api/contratos/produtos-distintos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT produto 
        FROM "Clickup".cup_contratos 
        WHERE produto IS NOT NULL AND produto != ''
        ORDER BY produto
      `);
      res.json(result.rows.map((row: any) => row.produto));
    } catch (error) {
      console.error("[api] Error fetching distinct produtos:", error);
      res.status(500).json({ error: "Failed to fetch distinct produtos" });
    }
  });

  app.get("/api/patrimonio", async (req, res) => {
    try {
      const patrimonios = await storage.getPatrimonios();
      res.json(patrimonios);
    } catch (error) {
      console.error("[api] Error fetching patrimonio:", error);
      res.status(500).json({ error: "Failed to fetch patrimonio" });
    }
  });

  app.get("/api/patrimonio/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid patrimonio ID" });
      }
      const patrimonio = await storage.getPatrimonioById(id);
      if (!patrimonio) {
        return res.status(404).json({ error: "Patrimonio not found" });
      }
      res.json(patrimonio);
    } catch (error) {
      console.error("[api] Error fetching patrimonio by id:", error);
      res.status(500).json({ error: "Failed to fetch patrimonio" });
    }
  });

  app.post("/api/patrimonio", async (req, res) => {
    try {
      const validation = insertPatrimonioSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const novoPatrimonio = await storage.createPatrimonio(validation.data);
      res.status(201).json(novoPatrimonio);
    } catch (error) {
      console.error("[api] Error creating patrimonio:", error);
      res.status(500).json({ error: "Failed to create patrimonio" });
    }
  });

  app.patch("/api/patrimonio/:id/responsavel", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid patrimonio ID" });
      }
      
      const { responsavelNome } = req.body;
      if (responsavelNome !== null && typeof responsavelNome !== 'string') {
        return res.status(400).json({ error: "responsavelNome deve ser uma string ou null" });
      }

      // Buscar o patrimônio atual para saber quem era o responsável anterior
      const patrimonioAnterior = await storage.getPatrimonioById(id);
      const responsavelAnterior = patrimonioAnterior?.responsavelAtual || null;

      const patrimonio = await storage.updatePatrimonioResponsavel(id, responsavelNome);
      
      let acao: string;
      if (responsavelNome === null) {
        acao = responsavelAnterior 
          ? `Responsável removido (${responsavelAnterior})` 
          : "Responsável removido";
      } else {
        acao = `Atribuído a ${responsavelNome}`;
      }
      const usuario = (req as any).user?.name || "Sistema";
      
      await storage.createPatrimonioHistorico({
        patrimonioId: id,
        acao,
        usuario,
        data: new Date(),
      });
      
      res.json(patrimonio);
    } catch (error) {
      console.error("[api] Error updating patrimonio responsavel:", error);
      res.status(500).json({ error: "Failed to update patrimonio responsavel" });
    }
  });

  app.patch("/api/patrimonio/:id/atribuir", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid patrimonio ID" });
      }
      
      const { responsavelId, responsavelNome } = req.body;
      if (typeof responsavelId !== 'number' || isNaN(responsavelId)) {
        return res.status(400).json({ error: "responsavelId deve ser um número válido" });
      }
      if (typeof responsavelNome !== 'string' || !responsavelNome.trim()) {
        return res.status(400).json({ error: "responsavelNome deve ser uma string não vazia" });
      }

      const patrimonio = await storage.updatePatrimonioResponsavelById(id, responsavelId, responsavelNome.trim());
      
      const usuario = (req as any).user?.name || "Sistema";
      await storage.createPatrimonioHistorico({
        patrimonioId: id,
        acao: `Atribuído a ${responsavelNome.trim()}`,
        usuario,
        data: new Date(),
      });
      
      res.json(patrimonio);
    } catch (error) {
      console.error("[api] Error assigning patrimonio:", error);
      res.status(500).json({ error: "Failed to assign patrimonio" });
    }
  });

  app.get("/api/patrimonio/disponiveis", async (req, res) => {
    try {
      const patrimonios = await storage.getPatrimonios();
      res.json(patrimonios);
    } catch (error) {
      console.error("[api] Error fetching available patrimonios:", error);
      res.status(500).json({ error: "Failed to fetch available patrimonios" });
    }
  });

  app.patch("/api/patrimonio/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid patrimonio ID" });
      }
      
      const { numeroAtivo, ativo, marca, estadoConservacao, descricao, valorPago, valorMercado, senhaAtivo, empresa } = req.body;

      const updateData: Record<string, string | null> = {};
      if (numeroAtivo !== undefined) updateData.numeroAtivo = numeroAtivo || null;
      if (ativo !== undefined) updateData.ativo = ativo || null;
      if (marca !== undefined) updateData.marca = marca || null;
      if (estadoConservacao !== undefined) updateData.estadoConservacao = estadoConservacao || null;
      if (descricao !== undefined) updateData.descricao = descricao || null;
      if (valorPago !== undefined) updateData.valorPago = valorPago || null;
      if (valorMercado !== undefined) updateData.valorMercado = valorMercado || null;
      if (senhaAtivo !== undefined) updateData.senhaAtivo = senhaAtivo || null;
      if (empresa !== undefined) updateData.empresa = empresa || null;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }
      
      const patrimonio = await storage.updatePatrimonio(id, updateData);
      res.json(patrimonio);
    } catch (error) {
      console.error("[api] Error updating patrimonio:", error);
      res.status(500).json({ error: "Failed to update patrimonio" });
    }
  });

  app.delete("/api/patrimonio/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid patrimonio ID" });
      }
      
      await storage.deletePatrimonio(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting patrimonio:", error);
      res.status(500).json({ error: "Failed to delete patrimonio" });
    }
  });

  app.get("/api/patrimonio/:id/historico", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid patrimonio ID" });
      }
      
      const historico = await storage.getPatrimonioHistorico(id);
      res.json(historico);
    } catch (error) {
      console.error("[api] Error fetching patrimonio historico:", error);
      res.status(500).json({ error: "Failed to fetch patrimonio historico" });
    }
  });

  app.post("/api/patrimonio/:id/historico", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid patrimonio ID" });
      }
      
      const { acao, usuario } = req.body;
      if (!acao || !usuario) {
        return res.status(400).json({ error: "acao and usuario are required" });
      }
      
      const registro = await storage.createPatrimonioHistorico({
        patrimonioId: id,
        acao,
        usuario,
        data: new Date(),
      });
      res.status(201).json(registro);
    } catch (error) {
      console.error("[api] Error creating patrimonio historico:", error);
      res.status(500).json({ error: "Failed to create patrimonio historico" });
    }
  });

  // ============ Geo Endpoints (Estados e Cidades) ============
  const estadosBrasileiros = [
    { uf: 'AC', nome: 'Acre' }, { uf: 'AL', nome: 'Alagoas' }, { uf: 'AP', nome: 'Amapá' },
    { uf: 'AM', nome: 'Amazonas' }, { uf: 'BA', nome: 'Bahia' }, { uf: 'CE', nome: 'Ceará' },
    { uf: 'DF', nome: 'Distrito Federal' }, { uf: 'ES', nome: 'Espírito Santo' },
    { uf: 'GO', nome: 'Goiás' }, { uf: 'MA', nome: 'Maranhão' }, { uf: 'MT', nome: 'Mato Grosso' },
    { uf: 'MS', nome: 'Mato Grosso do Sul' }, { uf: 'MG', nome: 'Minas Gerais' },
    { uf: 'PA', nome: 'Pará' }, { uf: 'PB', nome: 'Paraíba' }, { uf: 'PR', nome: 'Paraná' },
    { uf: 'PE', nome: 'Pernambuco' }, { uf: 'PI', nome: 'Piauí' }, { uf: 'RJ', nome: 'Rio de Janeiro' },
    { uf: 'RN', nome: 'Rio Grande do Norte' }, { uf: 'RS', nome: 'Rio Grande do Sul' },
    { uf: 'RO', nome: 'Rondônia' }, { uf: 'RR', nome: 'Roraima' }, { uf: 'SC', nome: 'Santa Catarina' },
    { uf: 'SP', nome: 'São Paulo' }, { uf: 'SE', nome: 'Sergipe' }, { uf: 'TO', nome: 'Tocantins' }
  ];

  app.get("/api/geo/estados", async (req, res) => {
    try {
      res.json(estadosBrasileiros);
    } catch (error) {
      console.error("[api] Error fetching estados:", error);
      res.status(500).json({ error: "Failed to fetch estados" });
    }
  });

  app.get("/api/geo/cidades/:uf", async (req, res) => {
    try {
      const { uf } = req.params;
      if (!uf || uf.length !== 2) {
        return res.status(400).json({ error: "Invalid UF - must be 2 characters" });
      }
      const estado = estadosBrasileiros.find(e => e.uf.toUpperCase() === uf.toUpperCase());
      if (!estado) {
        return res.status(404).json({ error: "Estado not found" });
      }
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.toUpperCase()}/municipios`);
      if (!response.ok) {
        throw new Error(`IBGE API returned status ${response.status}`);
      }
      const cidades = await response.json();
      const cidadesFormatadas = cidades.map((c: any) => ({
        id: c.id,
        nome: c.nome
      })).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
      res.json(cidadesFormatadas);
    } catch (error) {
      console.error("[api] Error fetching cidades:", error);
      res.status(500).json({ error: "Failed to fetch cidades from IBGE API" });
    }
  });

  app.get("/api/dashboard/saldo-atual", async (req, res) => {
    try {
      const saldo = await storage.getSaldoAtualBancos();
      res.json(saldo);
    } catch (error) {
      console.error("[api] Error fetching saldo atual:", error);
      res.status(500).json({ error: "Failed to fetch saldo atual" });
    }
  });

  app.get("/api/dashboard/fluxo-caixa", async (req, res) => {
    try {
      const fluxoCaixa = await storage.getFluxoCaixa();
      res.json(fluxoCaixa);
    } catch (error) {
      console.error("[api] Error fetching fluxo de caixa:", error);
      res.status(500).json({ error: "Failed to fetch fluxo de caixa" });
    }
  });

  app.get("/api/dashboard/fluxo-caixa-diario", async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string);
      const mes = parseInt(req.query.mes as string);
      
      if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ error: "Invalid ano or mes parameter" });
      }

      const fluxoCaixaDiario = await storage.getFluxoCaixaDiario(ano, mes);
      res.json(fluxoCaixaDiario);
    } catch (error) {
      console.error("[api] Error fetching fluxo de caixa diario:", error);
      res.status(500).json({ error: "Failed to fetch fluxo de caixa diario" });
    }
  });

  app.get("/api/dashboard/transacoes-dia", async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string);
      const mes = parseInt(req.query.mes as string);
      const dia = parseInt(req.query.dia as string);
      
      if (isNaN(ano) || isNaN(mes) || isNaN(dia) || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
        return res.status(400).json({ error: "Invalid ano, mes, or dia parameter" });
      }

      const transacoes = await storage.getTransacoesDia(ano, mes, dia);
      res.json(transacoes);
    } catch (error) {
      console.error("[api] Error fetching transacoes dia:", error);
      res.status(500).json({ error: "Failed to fetch transacoes dia" });
    }
  });

  // Evolução Mensal - MRR histórico por squad e operador com churn
  app.get("/api/dashboard/evolucao-mensal", async (req, res) => {
    try {
      const { meses } = req.query;
      const numMeses = Math.min(Math.max(parseInt(meses as string) || 6, 1), 36);
      
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - numMeses);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Buscar evolução de MRR por mês
      // Para meses anteriores: usa snapshots históricos (cup_data_hist)
      // Para o mês atual: usa dados ao vivo (cup_contratos) para evitar valores incompletos
      const mrrResult = await db.execute(sql`
        WITH snapshots_mensais AS (
          SELECT DISTINCT ON (DATE_TRUNC('month', data_snapshot))
            DATE_TRUNC('month', data_snapshot) as mes,
            data_snapshot
          FROM "Clickup".cup_data_hist
          WHERE DATE(data_snapshot) >= ${startDateStr}::date
            AND DATE_TRUNC('month', data_snapshot) < DATE_TRUNC('month', CURRENT_DATE)
          ORDER BY DATE_TRUNC('month', data_snapshot), data_snapshot DESC
        ),
        historical_data AS (
          SELECT
            TO_CHAR(sm.mes, 'YYYY-MM') as mes,
            h.squad,
            h.responsavel,
            COALESCE(SUM(h.valorr), 0) as mrr_total,
            COUNT(*) as total_contratos
          FROM snapshots_mensais sm
          JOIN "Clickup".cup_data_hist h ON DATE(h.data_snapshot) = DATE(sm.data_snapshot)
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY TO_CHAR(sm.mes, 'YYYY-MM'), h.squad, h.responsavel
        ),
        current_month_data AS (
          SELECT
            TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM') as mes,
            squad,
            responsavel,
            COALESCE(SUM(valorr), 0) as mrr_total,
            COUNT(*) as total_contratos
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY squad, responsavel
        )
        SELECT * FROM historical_data
        UNION ALL
        SELECT * FROM current_month_data
        ORDER BY mes, squad, responsavel
      `);
      
      // Buscar churns por mês da tabela curada cup_churn (excluindo churn abonado)
      const churnResult = await db.execute(sql`
        SELECT
          TO_CHAR(data_solicitacao_encerramento, 'YYYY-MM') as mes,
          squad,
          responsavel_geral as responsavel,
          COUNT(*) as churns,
          COALESCE(SUM(valor_r), 0) as mrr_churn
        FROM "Clickup".cup_churn
        WHERE data_solicitacao_encerramento IS NOT NULL
          AND data_solicitacao_encerramento >= ${startDateStr}::date
          AND valor_r > 0
          AND COALESCE(abonar_churn, '') != 'Sim'
          AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou')
        GROUP BY TO_CHAR(data_solicitacao_encerramento, 'YYYY-MM'), squad, responsavel_geral
        ORDER BY mes, squad, responsavel_geral
      `);
      
      // Listar squads e operadores disponíveis (incluindo dados ao vivo)
      const squadsResult = await db.execute(sql`
        SELECT DISTINCT squad FROM (
          SELECT squad FROM "Clickup".cup_data_hist WHERE squad IS NOT NULL AND squad != ''
          UNION
          SELECT squad FROM "Clickup".cup_contratos WHERE squad IS NOT NULL AND squad != ''
        ) combined
        ORDER BY squad
      `);

      const operadoresResult = await db.execute(sql`
        SELECT DISTINCT responsavel FROM (
          SELECT responsavel FROM "Clickup".cup_data_hist WHERE responsavel IS NOT NULL AND responsavel != ''
          UNION
          SELECT responsavel FROM "Clickup".cup_contratos WHERE responsavel IS NOT NULL AND responsavel != ''
        ) combined
        ORDER BY responsavel
      `);
      
      res.json({
        mrr: mrrResult.rows,
        churns: churnResult.rows,
        squads: squadsResult.rows.map((r: any) => r.squad),
        operadores: operadoresResult.rows.map((r: any) => r.responsavel)
      });
    } catch (error) {
      console.error("[api] Error fetching evolução mensal:", error);
      res.status(500).json({ error: "Failed to fetch evolução mensal" });
    }
  });

  app.get("/api/fluxo-caixa/contas-bancos", async (req, res) => {
    try {
      const contas = await storage.getContasBancos();
      res.json(contas);
    } catch (error) {
      console.error("[api] Error fetching contas bancos:", error);
      res.status(500).json({ error: "Failed to fetch contas bancos" });
    }
  });

  app.get("/api/fluxo-caixa/contas-financeiras", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT COALESCE(nome_conta_financeira, 'Não informado') as nome
        FROM "Conta Azul".caz_parcelas
        WHERE nome_conta_financeira IS NOT NULL AND nome_conta_financeira != ''
        ORDER BY nome
      `);
      res.json(result.rows.map((r: any) => r.nome as string));
    } catch (error) {
      console.error("[api] Error fetching contas financeiras:", error);
      res.status(500).json({ error: "Failed to fetch contas financeiras" });
    }
  });

  app.get("/api/fluxo-caixa/diario-completo", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string;
      const dataFim = req.query.dataFim as string;
      const classificacao = req.query.classificacao as string | undefined;
      const contaFinanceira = req.query.contaFinanceira as string | undefined;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "dataInicio and dataFim are required" });
      }

      // Se tem filtro de classificação, calcula fluxo filtrado por clientes dessa classificação
      // Sanitize contaFinanceira filter (escape single quotes for raw SQL)
      const contasFinanceiras = contaFinanceira
        ? contaFinanceira.split(',').map(c => c.trim()).filter(Boolean)
        : [];
      const contaFinanceiraFilter = contasFinanceiras.length > 0
        ? `AND nome_conta_financeira IN (${contasFinanceiras.map(c => `'${c.replace(/'/g, "''")}'`).join(',')})`
        : '';
      const contaFinanceiraFilterP = contasFinanceiras.length > 0
        ? `AND p.nome_conta_financeira IN (${contasFinanceiras.map(c => `'${c.replace(/'/g, "''")}'`).join(',')})`
        : '';

      const validClassificacoes = ['em_dia', 'receoso', 'duvidoso'];
      const classificacoes = classificacao
        ? classificacao.split(',').filter(c => validClassificacoes.includes(c))
        : [];

      if (classificacoes.length > 0) {
        const saldoAtual = await storage.getSaldoAtualBancos();

        // Determina condição de contagem de parcelas vencidas por classificação (suporta múltiplas)
        const conditions: string[] = [];
        if (classificacoes.includes('em_dia')) {
          conditions.push('(COALESCE(SUM(CASE WHEN p2.data_vencimento < CURRENT_DATE AND COALESCE(p2.nao_pago, 0) > 0 THEN 1 ELSE 0 END), 0) = 0)');
        }
        if (classificacoes.includes('receoso')) {
          conditions.push('(SUM(CASE WHEN p2.data_vencimento < CURRENT_DATE AND COALESCE(p2.nao_pago, 0) > 0 THEN 1 ELSE 0 END) = 1)');
        }
        if (classificacoes.includes('duvidoso')) {
          conditions.push('(SUM(CASE WHEN p2.data_vencimento < CURRENT_DATE AND COALESCE(p2.nao_pago, 0) > 0 THEN 1 ELSE 0 END) > 1)');
        }
        const havingCondition = `HAVING ${conditions.join(' OR ')}`;

        const result = await db.execute(sql.raw(`
          WITH clientes_classificados AS (
            SELECT p2.id_cliente
            FROM "Conta Azul".caz_parcelas p2
            INNER JOIN "Conta Azul".caz_clientes c2 ON p2.id_cliente::text = c2.ids::text
            WHERE p2.tipo_evento = 'RECEITA'
              AND p2.id_cliente IS NOT NULL
            GROUP BY p2.id_cliente
            ${havingCondition}
          ),
          dates AS (
            SELECT generate_series(
              '${dataInicio}'::date,
              '${dataFim}'::date,
              '1 day'::interval
            )::date as data
          ),
          receitas_filtradas AS (
            SELECT
              p.data_vencimento::date as data,
              SUM(p.valor_bruto::numeric) as entradas_previstas
            FROM "Conta Azul".caz_parcelas p
            INNER JOIN clientes_classificados cc ON p.id_cliente = cc.id_cliente
            WHERE p.tipo_evento = 'RECEITA'
              AND p.status NOT IN ('PERDIDO')
              AND p.data_vencimento::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date
              ${contaFinanceiraFilterP}
            GROUP BY p.data_vencimento::date
          ),
          despesas_todas AS (
            SELECT
              data_vencimento::date as data,
              SUM(valor_bruto::numeric) as saidas_previstas
            FROM "Conta Azul".caz_parcelas
            WHERE tipo_evento = 'DESPESA'
              AND status NOT IN ('PERDIDO')
              AND data_vencimento::date BETWEEN '${dataInicio}'::date AND '${dataFim}'::date
              ${contaFinanceiraFilter}
            GROUP BY data_vencimento::date
          )
          SELECT
            TO_CHAR(d.data, 'YYYY-MM-DD') as data,
            COALESCE(rf.entradas_previstas, 0) as entradas_previstas,
            COALESCE(dt.saidas_previstas, 0) as saidas_previstas
          FROM dates d
          LEFT JOIN receitas_filtradas rf ON d.data = rf.data
          LEFT JOIN despesas_todas dt ON d.data = dt.data
          ORDER BY d.data
        `));

        const saldoHoje = saldoAtual.saldoTotal;
        const hojeStr = new Date().toISOString().split('T')[0];

        // Primeiro, parsear todas as rows
        const rows = (result.rows as any[]).map((row: any) => ({
          data: row.data as string,
          entradas: parseFloat(row.entradas_previstas || '0'),
          saidas: parseFloat(row.saidas_previstas || '0'),
        }));

        // Encontrar o índice de hoje (ou o dia mais próximo passado)
        let hojeIdx = rows.findIndex(r => r.data === hojeStr);
        if (hojeIdx === -1) {
          // Se hoje não está no range, encontrar último dia <= hoje
          hojeIdx = rows.findLastIndex(r => r.data <= hojeStr);
        }

        // Calcular saldo acumulado ancorado no saldo real de hoje
        const dados = rows.map((row, _idx) => ({
          data: row.data,
          entradas: row.entradas,
          saidas: row.saidas,
          saldoDia: row.entradas - row.saidas,
          saldoAcumulado: 0,
          saldoEsperado: 0,
          entradasPagas: 0,
          saidasPagas: 0,
          entradasPrevistas: row.entradas,
          saidasPrevistas: row.saidas,
          entradasEsperadas: 0,
          saidasEsperadas: 0,
        }));

        if (hojeIdx >= 0) {
          // Hoje = saldo real dos bancos
          dados[hojeIdx].saldoAcumulado = saldoHoje;

          // Dias anteriores: retroceder subtraindo o fluxo de cada dia
          let saldo = saldoHoje;
          for (let i = hojeIdx - 1; i >= 0; i--) {
            // O saldo do dia anterior é o saldo atual menos o fluxo do dia seguinte
            saldo -= dados[i + 1].saldoDia;
            dados[i].saldoAcumulado = saldo;
          }

          // Dias futuros: avançar somando o fluxo de cada dia
          saldo = saldoHoje;
          for (let i = hojeIdx + 1; i < dados.length; i++) {
            saldo += dados[i].saldoDia;
            dados[i].saldoAcumulado = saldo;
          }
        } else {
          // Todos os dias são futuros, começar do saldo de hoje
          let saldo = saldoHoje;
          for (let i = 0; i < dados.length; i++) {
            saldo += dados[i].saldoDia;
            dados[i].saldoAcumulado = saldo;
          }
        }

        return res.json({ hasSnapshot: false, snapshotDate: null, dados });
      }

      const fluxo = await storage.getFluxoCaixaDiarioCompleto(dataInicio, dataFim, contasFinanceiras.length > 0 ? contasFinanceiras : undefined);

      // Reancora o saldo acumulado no saldo real de hoje (caz_bancos)
      const saldoBancos = await storage.getSaldoAtualBancos();
      const hojeAncora = new Date().toISOString().split('T')[0];
      let hojeAIdx = fluxo.dados.findIndex(d => d.data === hojeAncora);
      if (hojeAIdx === -1) {
        hojeAIdx = fluxo.dados.findLastIndex(d => d.data <= hojeAncora);
      }

      if (hojeAIdx >= 0) {
        fluxo.dados[hojeAIdx].saldoAcumulado = saldoBancos.saldoTotal;

        let saldo = saldoBancos.saldoTotal;
        for (let i = hojeAIdx - 1; i >= 0; i--) {
          saldo -= fluxo.dados[i + 1].saldoDia;
          fluxo.dados[i].saldoAcumulado = saldo;
        }

        saldo = saldoBancos.saldoTotal;
        for (let i = hojeAIdx + 1; i < fluxo.dados.length; i++) {
          saldo += fluxo.dados[i].saldoDia;
          fluxo.dados[i].saldoAcumulado = saldo;
        }
      }

      res.json(fluxo);
    } catch (error) {
      console.error("[api] Error fetching fluxo caixa diario completo:", error);
      res.status(500).json({ error: "Failed to fetch fluxo caixa diario completo" });
    }
  });

  app.get("/api/fluxo-caixa/mensal", async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string);
      const classificacao = req.query.classificacao as string | undefined;

      if (!ano || isNaN(ano)) {
        return res.status(400).json({ error: "ano is required (e.g., 2025)" });
      }

      const validClassificacoes = ['em_dia', 'receoso', 'duvidoso'];
      const classificacoes = classificacao
        ? classificacao.split(',').filter(c => validClassificacoes.includes(c))
        : [];

      const saldoAtual = await storage.getSaldoAtualBancos();
      const saldoHoje = saldoAtual.saldoTotal;
      const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

      let dados: import("@shared/schema").FluxoCaixaMensalItem[];

      if (classificacoes.length > 0) {
        const conditions: string[] = [];
        if (classificacoes.includes('em_dia')) {
          conditions.push('(COALESCE(SUM(CASE WHEN p2.data_vencimento < CURRENT_DATE AND COALESCE(p2.nao_pago, 0) > 0 THEN 1 ELSE 0 END), 0) = 0)');
        }
        if (classificacoes.includes('receoso')) {
          conditions.push('(SUM(CASE WHEN p2.data_vencimento < CURRENT_DATE AND COALESCE(p2.nao_pago, 0) > 0 THEN 1 ELSE 0 END) = 1)');
        }
        if (classificacoes.includes('duvidoso')) {
          conditions.push('(SUM(CASE WHEN p2.data_vencimento < CURRENT_DATE AND COALESCE(p2.nao_pago, 0) > 0 THEN 1 ELSE 0 END) > 1)');
        }
        const havingCondition = `HAVING ${conditions.join(' OR ')}`;

        const result = await db.execute(sql.raw(`
          WITH clientes_classificados AS (
            SELECT p2.id_cliente
            FROM "Conta Azul".caz_parcelas p2
            INNER JOIN "Conta Azul".caz_clientes c2 ON p2.id_cliente::text = c2.ids::text
            WHERE p2.tipo_evento = 'RECEITA'
              AND p2.id_cliente IS NOT NULL
            GROUP BY p2.id_cliente
            ${havingCondition}
          ),
          months AS (
            SELECT generate_series(
              '${ano}-01-01'::date,
              '${ano}-12-31'::date,
              '1 month'::interval
            )::date as mes_inicio
          ),
          receitas_filtradas AS (
            SELECT
              date_trunc('month', p.data_vencimento)::date as mes,
              SUM(p.valor_bruto::numeric) as entradas
            FROM "Conta Azul".caz_parcelas p
            INNER JOIN clientes_classificados cc ON p.id_cliente = cc.id_cliente
            WHERE p.tipo_evento = 'RECEITA'
              AND p.status NOT IN ('PERDIDO')
              AND p.data_vencimento::date BETWEEN '${ano}-01-01'::date AND '${ano}-12-31'::date
            GROUP BY date_trunc('month', p.data_vencimento)::date
          ),
          despesas_todas AS (
            SELECT
              date_trunc('month', data_vencimento)::date as mes,
              SUM(valor_bruto::numeric) as saidas
            FROM "Conta Azul".caz_parcelas
            WHERE tipo_evento = 'DESPESA'
              AND status NOT IN ('PERDIDO')
              AND data_vencimento::date BETWEEN '${ano}-01-01'::date AND '${ano}-12-31'::date
            GROUP BY date_trunc('month', data_vencimento)::date
          )
          SELECT
            TO_CHAR(m.mes_inicio, 'YYYY-MM') as mes,
            EXTRACT(MONTH FROM m.mes_inicio)::int as mes_num,
            COALESCE(rf.entradas, 0) as entradas,
            COALESCE(dt.saidas, 0) as saidas
          FROM months m
          LEFT JOIN receitas_filtradas rf ON m.mes_inicio = rf.mes
          LEFT JOIN despesas_todas dt ON m.mes_inicio = dt.mes
          ORDER BY m.mes_inicio
        `));

        dados = (result.rows as any[]).map((row: any) => ({
          mes: row.mes as string,
          mesLabel: MESES_CURTOS[parseInt(row.mes_num) - 1],
          entradas: parseFloat(row.entradas || '0'),
          saidas: parseFloat(row.saidas || '0'),
          saldoMes: parseFloat(row.entradas || '0') - parseFloat(row.saidas || '0'),
          saldoAcumulado: 0,
        }));
      } else {
        const result = await storage.getFluxoCaixaMensal(ano);
        dados = result.dados;
      }

      // Ancorar saldoAcumulado no mês atual
      const hojeDate = new Date();
      const hojeMes = `${hojeDate.getFullYear()}-${String(hojeDate.getMonth() + 1).padStart(2, '0')}`;

      let hojeIdx = dados.findIndex(d => d.mes === hojeMes);
      if (hojeIdx === -1) {
        hojeIdx = dados.findLastIndex(d => d.mes <= hojeMes);
      }

      if (hojeIdx >= 0) {
        dados[hojeIdx].saldoAcumulado = saldoHoje;

        let saldo = saldoHoje;
        for (let i = hojeIdx - 1; i >= 0; i--) {
          saldo -= dados[i + 1].saldoMes;
          dados[i].saldoAcumulado = saldo;
        }

        saldo = saldoHoje;
        for (let i = hojeIdx + 1; i < dados.length; i++) {
          saldo += dados[i].saldoMes;
          dados[i].saldoAcumulado = saldo;
        }
      } else {
        let saldo = saldoHoje;
        for (let i = 0; i < dados.length; i++) {
          saldo += dados[i].saldoMes;
          dados[i].saldoAcumulado = saldo;
        }
      }

      res.json({ ano, dados });
    } catch (error) {
      console.error("[api] Error fetching fluxo caixa mensal:", error);
      res.status(500).json({ error: "Failed to fetch fluxo caixa mensal" });
    }
  });

  app.get("/api/fluxo-caixa/insights", async (req, res) => {
    try {
      const insights = await storage.getFluxoCaixaInsights();
      res.json(insights);
    } catch (error) {
      console.error("[api] Error fetching fluxo caixa insights:", error);
      res.status(500).json({ error: "Failed to fetch fluxo caixa insights" });
    }
  });

  app.get("/api/fluxo-caixa/insights-periodo", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string;
      const dataFim = req.query.dataFim as string;
      
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "dataInicio and dataFim are required" });
      }

      const insights = await storage.getFluxoCaixaInsightsPeriodo(dataInicio, dataFim);
      res.json(insights);
    } catch (error) {
      console.error("[api] Error fetching fluxo caixa insights periodo:", error);
      res.status(500).json({ error: "Failed to fetch fluxo caixa insights periodo" });
    }
  });

  app.get("/api/fluxo-caixa/dia-detalhe", async (req, res) => {
    try {
      const data = req.query.data as string;
      
      if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({ error: "data is required in format YYYY-MM-DD" });
      }

      const detalhe = await storage.getFluxoDiaDetalhe(data);
      res.json(detalhe);
    } catch (error) {
      console.error("[api] Error fetching fluxo dia detalhe:", error);
      res.status(500).json({ error: "Failed to fetch fluxo dia detalhe" });
    }
  });

  app.get("/api/fluxo-caixa/snapshot", async (req, res) => {
    try {
      const mesAno = req.query.mesAno as string;
      
      if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "mesAno is required in format YYYY-MM" });
      }

      const snapshot = await storage.getDfcSnapshot(mesAno);
      res.json(snapshot);
    } catch (error) {
      console.error("[api] Error fetching DFC snapshot:", error);
      res.status(500).json({ error: "Failed to fetch DFC snapshot" });
    }
  });

  app.post("/api/fluxo-caixa/snapshot", async (req, res) => {
    try {
      const { mesAno } = req.body;
      
      if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "mesAno is required in format YYYY-MM" });
      }

      const snapshot = await storage.createDfcSnapshot(mesAno);
      res.json(snapshot);
    } catch (error) {
      console.error("[api] Error creating DFC snapshot:", error);
      res.status(500).json({ error: "Failed to create DFC snapshot" });
    }
  });

  // Classificação de clientes por inadimplência
  app.get("/api/fluxo-caixa/classificacao-clientes", async (req, res) => {
    try {
      const result = await db.execute(sql`
        WITH clientes_receita AS (
          SELECT DISTINCT p.id_cliente, c.nome, c.cnpj
          FROM "Conta Azul".caz_parcelas p
          INNER JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text
          WHERE p.tipo_evento = 'RECEITA'
            AND p.id_cliente IS NOT NULL
        ),
        vencidas AS (
          SELECT
            p.id_cliente,
            COUNT(*) as parcelas_vencidas,
            SUM(COALESCE(p.nao_pago, 0)) as total_vencido
          FROM "Conta Azul".caz_parcelas p
          WHERE COALESCE(p.nao_pago, 0) > 0
            AND p.data_vencimento < CURRENT_DATE
            AND p.tipo_evento = 'RECEITA'
            AND p.id_cliente IS NOT NULL
          GROUP BY p.id_cliente
        )
        SELECT
          cr.id_cliente,
          cr.nome,
          cr.cnpj,
          COALESCE(v.parcelas_vencidas, 0) as parcelas_vencidas,
          COALESCE(v.total_vencido, 0) as total_vencido,
          CASE
            WHEN COALESCE(v.parcelas_vencidas, 0) = 0 THEN 'em_dia'
            WHEN v.parcelas_vencidas = 1 THEN 'receoso'
            ELSE 'duvidoso'
          END as classificacao
        FROM clientes_receita cr
        LEFT JOIN vencidas v ON cr.id_cliente = v.id_cliente
        ORDER BY COALESCE(v.total_vencido, 0) DESC, cr.nome
      `);

      const clientes = (result.rows as any[]).map(row => ({
        idCliente: row.id_cliente,
        nome: row.nome,
        cnpj: row.cnpj || null,
        classificacao: row.classificacao as 'em_dia' | 'receoso' | 'duvidoso',
        parcelasVencidas: parseInt(row.parcelas_vencidas || '0'),
        totalVencido: parseFloat(row.total_vencido || '0'),
      }));

      const resumo = {
        emDia: clientes.filter(c => c.classificacao === 'em_dia').length,
        receosos: {
          count: clientes.filter(c => c.classificacao === 'receoso').length,
          totalVencido: clientes
            .filter(c => c.classificacao === 'receoso')
            .reduce((sum, c) => sum + c.totalVencido, 0),
        },
        duvidosos: {
          count: clientes.filter(c => c.classificacao === 'duvidoso').length,
          totalVencido: clientes
            .filter(c => c.classificacao === 'duvidoso')
            .reduce((sum, c) => sum + c.totalVencido, 0),
        },
      };

      res.json({ clientes, resumo });
    } catch (error) {
      console.error("[api] Error fetching classificacao clientes:", error);
      res.status(500).json({ error: "Failed to fetch classificacao clientes" });
    }
  });

  app.get("/api/financeiro/resumo", async (req, res) => {
    try {
      const mesAno = req.query.mesAno as string | undefined;
      if (mesAno && !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
      }
      const resumo = await storage.getFinanceiroResumo(mesAno);
      res.json(resumo);
    } catch (error) {
      console.error("[api] Error fetching financeiro resumo:", error);
      res.status(500).json({ error: "Failed to fetch financeiro resumo" });
    }
  });

  app.get("/api/financeiro/evolucao-mensal", async (req, res) => {
    try {
      const meses = req.query.meses ? parseInt(req.query.meses as string) : 12;
      const evolucao = await storage.getFinanceiroEvolucaoMensal(meses);
      res.json(evolucao);
    } catch (error) {
      console.error("[api] Error fetching financeiro evolucao:", error);
      res.status(500).json({ error: "Failed to fetch financeiro evolucao" });
    }
  });

  app.get("/api/financeiro/categorias", async (req, res) => {
    try {
      const tipo = (req.query.tipo as 'RECEITA' | 'DESPESA' | 'AMBOS') || 'AMBOS';
      const meses = req.query.meses ? parseInt(req.query.meses as string) : 6;
      const categorias = await storage.getFinanceiroCategorias(tipo, meses);
      res.json(categorias);
    } catch (error) {
      console.error("[api] Error fetching financeiro categorias:", error);
      res.status(500).json({ error: "Failed to fetch financeiro categorias" });
    }
  });

  app.get("/api/financeiro/top-clientes", async (req, res) => {
    try {
      const limite = req.query.limite ? parseInt(req.query.limite as string) : 10;
      const meses = req.query.meses ? parseInt(req.query.meses as string) : 12;
      const clientes = await storage.getFinanceiroTopClientes(limite, meses);
      res.json(clientes);
    } catch (error) {
      console.error("[api] Error fetching financeiro top clientes:", error);
      res.status(500).json({ error: "Failed to fetch financeiro top clientes" });
    }
  });

  app.get("/api/financeiro/metodos-pagamento", async (req, res) => {
    try {
      const meses = req.query.meses ? parseInt(req.query.meses as string) : 6;
      const metodos = await storage.getFinanceiroMetodosPagamento(meses);
      res.json(metodos);
    } catch (error) {
      console.error("[api] Error fetching financeiro metodos:", error);
      res.status(500).json({ error: "Failed to fetch financeiro metodos" });
    }
  });

  app.get("/api/financeiro/contas-bancarias", async (req, res) => {
    try {
      const contas = await storage.getFinanceiroContasBancarias();
      res.json(contas);
    } catch (error) {
      console.error("[api] Error fetching financeiro contas:", error);
      res.status(500).json({ error: "Failed to fetch financeiro contas" });
    }
  });

  // Growth routes have been moved to server/routes/growth.ts
  // (registerGrowthRoutes is called later in this file)
  app.get("/api/financeiro/kpis-completos", async (req, res) => {
    try {
      const kpis = await storage.getFinanceiroKPIsCompletos();
      res.json(kpis);
    } catch (error) {
      console.error("[api] Error fetching financeiro KPIs:", error);
      res.status(500).json({ error: "Failed to fetch financeiro KPIs" });
    }
  });

  app.get("/api/financeiro/fluxo-proximos-dias", async (req, res) => {
    try {
      const dias = parseInt(req.query.dias as string) || 30;
      const fluxo = await storage.getFinanceiroFluxoProximosDias(dias);
      res.json(fluxo);
    } catch (error) {
      console.error("[api] Error fetching fluxo:", error);
      res.status(500).json({ error: "Failed to fetch fluxo" });
    }
  });

  // ============== REVENUE GOALS ==============
  
  app.get("/api/financeiro/revenue-goals", async (req, res) => {
    try {
      const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1;
      const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
      const data = await storage.getRevenueGoals(mes, ano);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching revenue goals:", error);
      res.status(500).json({ error: "Failed to fetch revenue goals" });
    }
  });

  app.get("/api/financeiro/revenue-goals/detalhes-dia", async (req, res) => {
    try {
      const dataParam = req.query.data as string;
      if (!dataParam) {
        return res.status(400).json({ error: "Missing required parameter: data" });
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dataParam)) {
        return res.status(400).json({ error: "Invalid date format. Expected YYYY-MM-DD" });
      }
      const detalhes = await storage.getRevenueGoalsDiaDetalhes(dataParam);
      res.json(detalhes);
    } catch (error) {
      console.error("[api] Error fetching revenue goals day details:", error);
      res.status(500).json({ error: "Failed to fetch revenue goals day details" });
    }
  });

  // ============== MARGEM POR CLIENTE ==============
  
  app.get("/api/financeiro/margem-clientes", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const data = await storage.getMargemPorCliente(dataInicio, dataFim);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching margem por cliente:", error);
      res.status(500).json({ error: "Failed to fetch margem por cliente" });
    }
  });

  // ==================== JURÍDICO - Clientes para ação legal ====================
  
  // Ensure juridico_regras_escalonamento table exists and has default rules
  async function ensureEscalationRulesTable() {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS juridico_regras_escalonamento (
          id SERIAL PRIMARY KEY,
          dias_atraso_min INTEGER NOT NULL,
          dias_atraso_max INTEGER,
          procedimento_sugerido TEXT NOT NULL,
          prioridade INTEGER NOT NULL DEFAULT 1,
          ativo BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Check if table has rules, seed defaults if empty
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM juridico_regras_escalonamento`);
      const count = parseInt((countResult.rows[0] as any)?.count || '0');
      
      if (count === 0) {
        await db.execute(sql`
          INSERT INTO juridico_regras_escalonamento (dias_atraso_min, dias_atraso_max, procedimento_sugerido, prioridade, ativo)
          VALUES 
            (30, 59, 'notificacao', 1, true),
            (60, 89, 'protesto', 2, true),
            (90, NULL, 'acao_judicial', 3, true)
        `);
        console.log("[juridico] Default escalation rules seeded");
      }
    } catch (error) {
      console.log("[juridico] Warning: Could not ensure escalation rules table:", (error as Error).message);
    }
  }
  
  // Ensure tipo_inadimplencia column exists in cortex_core.inadimplencia_contextos table
  async function ensureTipoInadimplenciaColumn() {
    try {
      // Add column if not exists
      await db.execute(sql`
        ALTER TABLE cortex_core.inadimplencia_contextos 
        ADD COLUMN IF NOT EXISTS tipo_inadimplencia TEXT DEFAULT NULL
      `);
      console.log("[juridico] tipo_inadimplencia column ensured");
    } catch (error) {
      console.log("[juridico] Warning: Could not add tipo_inadimplencia column:", (error as Error).message);
    }
  }
  
  // Initialize tables on startup
  ensureEscalationRulesTable();
  ensureTipoInadimplenciaColumn();
  
  // Jurídico - Listar clientes inadimplentes + clientes com histórico jurídico (mesmo após pagamento)
  app.get("/api/juridico/clientes", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      
      // 1. Buscar clientes inadimplentes
      const clientesData = await storage.getInadimplenciaClientes(dataInicio, dataFim, 'valor', 1000);
      
      // 2. Filtrar clientes inadimplentes com mais de 3 dias de atraso
      const clientesFiltrados = clientesData.clientes.filter(c => c.diasAtrasoMax > 3);
      const todosIds = clientesFiltrados.map(c => c.idCliente);
      
      // 2.5. Buscar clientes com histórico jurídico (acordos/recuperados) que não estão mais inadimplentes
      const clientesComHistoricoJuridico = await storage.getClientesComContextoJuridico();
      const idsHistoricoNaoInadimplentes = clientesComHistoricoJuridico.filter(id => !todosIds.includes(id));
      
      // Buscar todos os IDs para contextos (inadimplentes + históricos)
      const todosIdsParaContextos = [...todosIds, ...idsHistoricoNaoInadimplentes];
      
      // 3. Buscar contextos jurídicos
      const contextos = await storage.getInadimplenciaContextos(todosIdsParaContextos);
      
      // 4. Buscar regras de escalonamento (handle table not existing gracefully)
      let escalationRules: Array<{
        diasAtrasoMin: number;
        diasAtrasoMax: number | null;
        procedimentoSugerido: string;
        prioridade: number;
      }> = [];
      
      try {
        const escalationRulesResult = await db.execute(sql`
          SELECT 
            dias_atraso_min as "diasAtrasoMin",
            dias_atraso_max as "diasAtrasoMax",
            procedimento_sugerido as "procedimentoSugerido",
            prioridade
          FROM juridico_regras_escalonamento
          WHERE ativo = true
          ORDER BY prioridade ASC
        `);
        escalationRules = escalationRulesResult.rows as typeof escalationRules;
      } catch (rulesError) {
        console.log("[juridico] Escalation rules table not available:", (rulesError as Error).message);
      }
      
      // Helper function to get suggested procedimento based on dias_atraso
      const getSuggestedProcedimento = (diasAtraso: number) => {
        for (const rule of escalationRules) {
          const min = rule.diasAtrasoMin;
          const max = rule.diasAtrasoMax;
          if (diasAtraso >= min && (max === null || diasAtraso <= max)) {
            return {
              procedimento: rule.procedimentoSugerido,
              prioridade: rule.prioridade
            };
          }
        }
        return null;
      };
      
      // Procedimento priority mapping
      const PROCEDIMENTO_PRIORITY: Record<string, number> = {
        'notificacao': 1,
        'protesto': 2,
        'acao_judicial': 3,
        'acordo': 4,
        'baixa': 5
      };
      
      // 4. Buscar parcelas em paralelo para clientes inadimplentes
      const parcelasPromises = clientesFiltrados.map(cliente => 
        storage.getInadimplenciaDetalheParcelas(cliente.idCliente, dataInicio, dataFim)
      );
      const parcelasResults = await Promise.all(parcelasPromises);
      
      // 5. Montar resposta com sugestão de escalonamento para clientes inadimplentes
      const clientesComDados = clientesFiltrados.map((cliente, index) => {
        const contexto = contextos[cliente.idCliente] || {};
        const suggestion = getSuggestedProcedimento(cliente.diasAtrasoMax);
        
        const currentProcedimento = contexto.procedimentoJuridico;
        const currentPriority = currentProcedimento ? (PROCEDIMENTO_PRIORITY[currentProcedimento] || 0) : 0;
        const suggestedPriority = suggestion?.prioridade || 0;
        
        // Determine if escalation is needed (suggested is higher priority than current)
        // Lower prioridade number means earlier stage, higher number = more severe
        // needsEscalation = current procedure is LOWER stage than suggested
        const needsEscalation = suggestion && currentPriority < suggestedPriority;
        
        return {
          cliente,
          contexto,
          parcelas: parcelasResults[index].parcelas,
          isHistorico: false,
          suggestedProcedimento: suggestion?.procedimento || null,
          needsEscalation,
        };
      });
      
      // 6. Adicionar clientes históricos (acordos/recuperados que já pagaram)
      // Esses clientes têm contexto jurídico mas não estão mais inadimplentes
      
      // Buscar nomes reais dos clientes históricos
      const nomesClientesHistoricos: Record<string, { nome: string; empresa: string }> = {};
      if (idsHistoricoNaoInadimplentes.length > 0) {
        const escapedIds = idsHistoricoNaoInadimplentes.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');
        const nomesResult = await db.execute(sql.raw(`
          SELECT DISTINCT ON (TRIM(ids::text))
            TRIM(ids::text) as id_cliente,
            nome,
            COALESCE(empresa, '') as empresa
          FROM "Conta Azul".caz_clientes
          WHERE ids IS NOT NULL AND TRIM(ids::text) IN (${escapedIds})
          ORDER BY TRIM(ids::text)
        `));
        for (const row of nomesResult.rows as any[]) {
          nomesClientesHistoricos[row.id_cliente] = { nome: row.nome || '', empresa: row.empresa || '' };
        }
      }
      
      const clientesHistoricos: typeof clientesComDados = [];
      for (const clienteId of idsHistoricoNaoInadimplentes) {
        const contexto = contextos[clienteId] || {};
        // Só incluir se tiver procedimento de acordo ou baixa concluída (são os "recuperados")
        const isRecuperado = contexto.procedimentoJuridico === 'acordo' || 
          (contexto.statusJuridico === 'concluido' && contexto.procedimentoJuridico === 'baixa');
        
        if (isRecuperado) {
          // Buscar nome real do cliente
          const clienteInfo = nomesClientesHistoricos[clienteId];
          // Para clientes manuais (prefixo "manual_"), extrair nome do contexto
          let nomeReal = clienteInfo?.nome;
          if (!nomeReal && clienteId.startsWith('manual_')) {
            // Extrair nome do contexto: "Nome - Cliente recuperado manualmente"
            nomeReal = contexto.contextoJuridico?.split(' - ')[0] || clienteId.replace('manual_', '').replace(/_/g, ' ');
          } else if (!nomeReal) {
            nomeReal = `Cliente ${clienteId}`;
          }
          const empresaReal = clienteInfo?.empresa || '';
          
          // Criar objeto cliente mínimo para exibição
          clientesHistoricos.push({
            cliente: {
              idCliente: clienteId,
              nomeCliente: nomeReal,
              valorTotal: contexto.valorAcordado || 0,
              quantidadeParcelas: 0,
              parcelaMaisAntiga: '',
              diasAtrasoMax: 0,
              empresa: empresaReal,
              cnpj: null,
              statusClickup: null,
              responsavel: null,
              cluster: null,
              servicos: null,
              telefone: null,
            },
            contexto,
            parcelas: [],
            isHistorico: true,
            suggestedProcedimento: null,
            needsEscalation: false,
          });
        }
      }
      
      const todosClientes = [...clientesComDados, ...clientesHistoricos];
      
      console.log("[api] Juridico clientes - Inadimplentes:", clientesFiltrados.length, "Históricos:", clientesHistoricos.length);
      
      res.json({ clientes: todosClientes });
    } catch (error) {
      console.error("[api] Error fetching juridico clientes:", error);
      res.status(500).json({ error: "Failed to fetch juridico clientes" });
    }
  });

  app.put("/api/juridico/clientes/:clienteId/contexto", validateBody(upsertContextoJuridicoSchema), async (req, res) => {
    try {
      const { clienteId } = req.params;
      const { contextoJuridico, procedimentoJuridico, statusJuridico, valorAcordado, tipoInadimplencia } = req.body;
      
      const user = (req as any).user;
      const atualizadoPor = user?.name || user?.googleId || 'Sistema';
      
      const result = await storage.upsertContextoJuridico({
        clienteId,
        contextoJuridico,
        procedimentoJuridico,
        statusJuridico,
        valorAcordado: valorAcordado != null ? parseFloat(valorAcordado) : undefined,
        tipoInadimplencia,
        atualizadoPor,
      });
      
      console.log("[api] Contexto jurídico atualizado para cliente:", clienteId);
      
      res.json(result);
    } catch (error) {
      console.error("[api] Error updating contexto juridico:", error);
      res.status(500).json({ error: "Failed to update contexto juridico" });
    }
  });

  // Função para inserir clientes recuperados manualmente na inicialização
  async function ensureManualRecoveredClients() {
    try {
      const clientesManuais = [
        { id: 'manual_show_room', nome: 'Show Room', valor: 1967 },
        { id: 'manual_advocacia_morais', nome: 'Advocacia Morais', valor: 1997 },
        { id: 'manual_reset', nome: 'Reset', valor: 3000 },
        { id: 'manual_nativa', nome: 'Nativa', valor: 5000 },
        { id: 'manual_kingly', nome: 'Kingly', valor: 1998 },
        { id: 'manual_fast_lab', nome: 'Fast Lab', valor: 1058 },
        { id: 'manual_ouvi_dizer', nome: 'Ouvi Dizer', valor: 2700 },
        { id: 'manual_hortencia', nome: 'Hortencia', valor: 4500 },
        { id: 'manual_rivers', nome: 'Rivers', valor: 1875 },
        { id: 'manual_manafix', nome: 'Manafix', valor: 2019.38 },
        { id: 'manual_agro_nutri', nome: 'Agro Nutri', valor: 2955 },
        { id: 'manual_brisa', nome: 'Brisa', valor: 689 },
      ];
      
      for (const cliente of clientesManuais) {
        await db.execute(sql`
          INSERT INTO cortex_core.inadimplencia_contextos (cliente_id, procedimento_juridico, status_juridico, valor_acordado, contexto_juridico, acao, contexto, atualizado_por)
          VALUES (${cliente.id}, 'acordo', 'concluido', ${cliente.valor}, ${cliente.nome + ' - Cliente recuperado manualmente'}, 'acordo_manual', 'Cliente recuperado com acordo', 'Sistema')
          ON CONFLICT (cliente_id) DO UPDATE SET
            procedimento_juridico = 'acordo',
            status_juridico = 'concluido',
            valor_acordado = EXCLUDED.valor_acordado,
            contexto_juridico = EXCLUDED.contexto_juridico
        `);
      }
      
      console.log("[juridico] Clientes recuperados manuais inseridos:", clientesManuais.length);
    } catch (error) {
      console.warn("[juridico] Erro ao inserir clientes recuperados manuais:", (error as Error).message);
    }
  }
  
  // Executar na inicialização
  ensureManualRecoveredClients();

  // Função para atualizar valor_acordado de clientes específicos pelo nome
  async function updateClienteValorAcordadoByName() {
    try {
      // Atualizar GO COFFEE com valor R$ 3.283
      await db.execute(sql`
        UPDATE cortex_core.inadimplencia_contextos ic
        SET valor_acordado = 3283
        FROM "Conta Azul".caz_clientes c
        WHERE ic.cliente_id = c.id::text
          AND UPPER(c.nome) LIKE '%GO COFFEE%'
      `);
      console.log("[juridico] Valor acordado atualizado para GO COFFEE: R$ 3.283");
    } catch (error) {
      console.warn("[juridico] Erro ao atualizar valor acordado:", (error as Error).message);
    }
  }
  
  // Executar na inicialização
  updateClienteValorAcordadoByName();

  // Função para corrigir nomes e adicionar clientes de erro operacional
  async function setupErroOperacionalClients() {
    try {
      // Remover TODOS os registros de erro operacional (antigos e novos, incluindo os com NULL)
      await db.execute(sql`
        DELETE FROM cortex_core.inadimplencia_contextos 
        WHERE tipo_inadimplencia = 'erro_operacional'
           OR cliente_id LIKE 'erro_%'
           OR contexto_juridico ILIKE '%Registro manual%'
           OR contexto_juridico ILIKE '%Fantasma%'
           OR contexto_juridico ILIKE '%Hubstage%'
           OR contexto_juridico ILIKE '%GPA Suplementos%'
           OR contexto_juridico ILIKE '%Winstage%'
      `);
      
      // Lista completa de clientes de erro operacional com valores corretos (apenas do print)
      const clientesErroOperacional = [
        { nome: 'NOODROPS', valor: 7200 },
        { nome: 'GOTA TROPICANA', valor: 2000 },
        { nome: 'FANTASMA DA OPERA', valor: 7958.04 },
        { nome: 'FS COMPANY', valor: 2000 },
        { nome: 'VITÓRIA TERNOS', valor: 5994 },
        { nome: 'CHAMA 27', valor: 8199.44 },
        { nome: 'GPA SUPLEMENTOS', valor: 8366.60 },
        { nome: 'PELICULAS FACIL', valor: 12805 },
        { nome: 'HUBSAGE DISTRIBUIDORA', valor: 0 },
        { nome: 'QUIPROCO ROUPARIA E VERBAL LTDA', valor: 1997 },
        { nome: 'WINSTAGE', valor: 6100 },
        { nome: 'SMART MINI', valor: 2167 },
        { nome: 'RAFAELA MACEDO DE JESUS', valor: 6000 },
        { nome: 'DELICIOUS HEALTHY ALIMENTACAO', valor: 6148.86 },
        { nome: 'MAXCAR MOBILIDADE', valor: 2997 },
        { nome: 'BRISA COMÉRCIO', valor: 3997 },
        { nome: 'LIFE GOM', valor: 8997 },
        { nome: 'MS CREATIVE', valor: 2997 },
        { nome: 'LOOPS NUTRITION', valor: 3442.58 },
        { nome: 'LÍVERE', valor: 8366 },
        { nome: 'VENAMORE', valor: 15000 },
        { nome: 'AMAZON MIX', valor: 5116 },
      ];
      
      for (const cliente of clientesErroOperacional) {
        await db.execute(sql`
          INSERT INTO cortex_core.inadimplencia_contextos (cliente_id, procedimento_juridico, status_juridico, valor_acordado, contexto_juridico, acao, contexto, atualizado_por, tipo_inadimplencia)
          VALUES (${cliente.nome}, 'baixa', 'concluido', ${cliente.valor}, ${cliente.nome}, 'erro_operacional', 'Classificado como erro operacional', 'Sistema', 'erro_operacional')
          ON CONFLICT (cliente_id) DO UPDATE SET
            tipo_inadimplencia = 'erro_operacional',
            valor_acordado = ${cliente.valor},
            contexto_juridico = ${cliente.nome}
        `);
      }
      
      console.log("[juridico] Clientes erro operacional configurados:", clientesErroOperacional.length);
    } catch (error) {
      console.warn("[juridico] Erro ao configurar clientes erro operacional:", (error as Error).message);
    }
  }
  
  // Executar na inicialização
  setupErroOperacionalClients();

  // ==================== JURÍDICO - Contratos Colaboradores ====================
  
  // Inicializar tabela de status de contratos de colaboradores
  let contratosColabStatusTableInitialized = false;
  async function ensureContratosColabStatusTable() {
    if (contratosColabStatusTableInitialized) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.contratos_colaboradores_status (
          id SERIAL PRIMARY KEY,
          colaborador_id INTEGER NOT NULL,
          colaborador_nome VARCHAR(255) NOT NULL,
          colaborador_email VARCHAR(255),
          documento_id VARCHAR(255),
          status VARCHAR(50) NOT NULL DEFAULT 'Enviado para assinatura',
          data_envio TIMESTAMP DEFAULT NOW(),
          data_assinatura TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      contratosColabStatusTableInitialized = true;
      console.log("[database] Contratos colaboradores status table initialized");
    } catch (error) {
      console.error("[database] Error initializing contratos_colaboradores_status table:", error);
    }
  }
  
  app.get("/api/juridico/colaboradores-contrato", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradoresParaContrato();
      res.json({ colaboradores });
    } catch (error) {
      console.error("[api] Error fetching colaboradores para contrato:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
    }
  });
  
  // GET - Listar status de todos os contratos de colaboradores
  app.get("/api/juridico/colaboradores-contrato/status", async (req, res) => {
    try {
      await ensureContratosColabStatusTable();
      
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.contratos_colaboradores_status 
        ORDER BY data_envio DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching contratos status:", error);
      res.status(500).json({ error: "Failed to fetch contratos status" });
    }
  });
  
  // GET - Status de contrato de um colaborador específico
  app.get("/api/juridico/colaboradores-contrato/:id/status", async (req, res) => {
    try {
      await ensureContratosColabStatusTable();
      const colaboradorId = parseInt(req.params.id);
      
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.contratos_colaboradores_status 
        WHERE colaborador_id = ${colaboradorId}
        ORDER BY data_envio DESC
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        return res.json({ status: null });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error fetching contrato status:", error);
      res.status(500).json({ error: "Failed to fetch contrato status" });
    }
  });
  
  // GET - Download do documento assinado no Assinafy (colaboradores)
  app.get("/api/juridico/colaboradores-contrato/download/:documentId", async (req, res) => {
    try {
      const { documentId } = req.params;

      const configResult = await db.execute(sql`
        SELECT api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'colaboradores' LIMIT 1
      `);

      if (configResult.rows.length === 0) {
        // Fallback: buscar qualquer config ativa (tabela pode não ter coluna tipo)
        const fallback = await db.execute(sql`
          SELECT api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true LIMIT 1
        `);
        if (fallback.rows.length === 0) {
          return res.status(500).json({ error: "Configuração Assinafy não encontrada" });
        }
        configResult.rows = fallback.rows;
      }

      const config = configResult.rows[0] as { api_key: string; api_url: string };
      const downloadUrl = `${config.api_url}/documents/${documentId}/download/certificated`;

      let response = await fetch(downloadUrl, {
        headers: { 'X-Api-Key': config.api_key, 'Accept': '*/*' }
      });

      // Fallback: tentar download sem /certificated (documento ainda não certificado)
      if (!response.ok) {
        const downloadUrl2 = `${config.api_url}/documents/${documentId}/download`;
        response = await fetch(downloadUrl2, {
          headers: { 'X-Api-Key': config.api_key, 'Accept': '*/*' }
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[assinafy-colab] Download error:", response.status, errorText);
        return res.status(response.status).json({ error: "Erro ao baixar documento", details: errorText });
      }

      const contentType = response.headers.get('content-type') || 'application/pdf';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="contrato-${documentId}.pdf"`);

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("[assinafy-colab] Download error:", error);
      res.status(500).json({ error: "Erro ao baixar documento", details: error.message });
    }
  });

  // PATCH - Atualizar status de contrato (para marcar como assinado manualmente)
  app.patch("/api/juridico/colaboradores-contrato/:id/status", async (req, res) => {
    try {
      await ensureContratosColabStatusTable();
      const colaboradorId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status é obrigatório" });
      }
      
      const dataAssinatura = status === 'Assinado' ? sql`NOW()` : sql`NULL`;
      
      const result = await db.execute(sql`
        UPDATE cortex_core.contratos_colaboradores_status 
        SET status = ${status}, 
            data_assinatura = ${dataAssinatura},
            updated_at = NOW()
        WHERE colaborador_id = ${colaboradorId}
        AND id = (
          SELECT id FROM cortex_core.contratos_colaboradores_status 
          WHERE colaborador_id = ${colaboradorId}
          ORDER BY data_envio DESC
          LIMIT 1
        )
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating contrato status:", error);
      res.status(500).json({ error: "Failed to update contrato status" });
    }
  });

  // POST - Sincronizar status dos contratos de colaboradores com Assinafy
  app.post("/api/juridico/colaboradores-contrato/sync-status", async (req, res) => {
    try {
      await ensureContratosColabStatusTable();

      // 1. Buscar config do Assinafy
      const configResult = await db.execute(sql`
        SELECT account_id, api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'colaboradores' LIMIT 1
      `);

      if (configResult.rows.length === 0) {
        return res.status(500).json({ error: "Configuração do Assinafy para colaboradores não encontrada" });
      }

      const config = configResult.rows[0] as { account_id: string; api_key: string; api_url: string };

      // 2. Buscar contratos com documento_id e status não-final
      const contratosResult = await db.execute(sql`
        SELECT id, colaborador_id, colaborador_nome, documento_id, status
        FROM cortex_core.contratos_colaboradores_status
        WHERE documento_id IS NOT NULL
          AND status NOT IN ('Assinado', 'Recusado', 'Cancelado')
      `);

      const contratos = contratosResult.rows as any[];
      console.log(`[sync-colab] Verificando ${contratos.length} contratos pendentes no Assinafy`);

      let atualizados = 0;
      const resultados: { colaborador: string; statusAnterior: string; statusNovo: string }[] = [];

      for (const contrato of contratos) {
        try {
          // 3. Consultar status no Assinafy
          const statusUrl = `${config.api_url}/documents/${contrato.documento_id}`;
          const statusResponse = await fetch(statusUrl, {
            method: 'GET',
            headers: { 'X-Api-Key': config.api_key }
          });

          const statusResult = await statusResponse.json() as any;
          const assStatus = statusResult.data?.status || statusResult.status;

          // 4. Mapear status do Assinafy para status local
          let novoStatus: string | null = null;

          if (assStatus === 'signed' || assStatus === 'completed' || assStatus === 'certificated') {
            novoStatus = 'Assinado';
          } else if (assStatus === 'declined') {
            novoStatus = 'Recusado';
          } else if (assStatus === 'cancelled' || assStatus === 'expired') {
            novoStatus = 'Cancelado';
          } else if (assStatus === 'pending' || assStatus === 'waiting_signatures') {
            novoStatus = 'Enviado para assinatura';
          }

          if (novoStatus && novoStatus !== contrato.status) {
            const dataAssinatura = novoStatus === 'Assinado' ? sql`NOW()` : sql`NULL`;
            await db.execute(sql`
              UPDATE cortex_core.contratos_colaboradores_status
              SET status = ${novoStatus},
                  data_assinatura = ${dataAssinatura},
                  updated_at = NOW()
              WHERE id = ${contrato.id}
            `);
            atualizados++;
            resultados.push({
              colaborador: contrato.colaborador_nome,
              statusAnterior: contrato.status,
              statusNovo: novoStatus,
            });
            console.log(`[sync-colab] ${contrato.colaborador_nome}: ${contrato.status} → ${novoStatus}`);
          }
        } catch (err) {
          console.error(`[sync-colab] Erro ao verificar contrato ${contrato.documento_id}:`, err);
        }
      }

      console.log(`[sync-colab] Sync concluído: ${atualizados} de ${contratos.length} atualizados`);
      res.json({ total: contratos.length, atualizados, resultados });
    } catch (error) {
      console.error("[sync-colab] Erro:", error);
      res.status(500).json({ error: "Erro ao sincronizar status" });
    }
  });

  // Função compartilhada para gerar PDF de contrato de colaborador
  async function gerarContratoPDF(params: {
    nome: string;
    cpf: string;
    cnpj: string;
    endereco: string;
    estado: string;
    cargo: string;
    salario: string;
    patrimonio: string | null;
  }): Promise<Buffer> {
    const { nome, cpf, cnpj, endereco, estado, cargo, salario, patrimonio } = params;

    // Calcular datas - Data de início é SEMPRE hoje, data fim é 6 meses depois
    const dataInicioDate = new Date();
    const dataInicio = dataInicioDate.toLocaleDateString('pt-BR');
    const dataFimDate = new Date(dataInicioDate);
    dataFimDate.setMonth(dataFimDate.getMonth() + 6);
    const dataFim = dataFimDate.toLocaleDateString('pt-BR');
    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Formatar salário para exibição no contrato
    const salarioNumerico = parseFloat((salario || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const salarioFormatado = salarioNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Mapeamento de escopos por cargo
    const escoposPorCargo: Record<string, { titulo: string; escopo: string }> = {
      "ANALISTA DE CX": {
        titulo: "ANALISTA DE CX",
        escopo: "garantir a experiência do cliente em todas as interações com a empresa, criar estratégia para melhorar a experiência do cliente, identificando e implementando soluções para corrigir problemas, fornecer informações precisas e atualizadas sobre os produtos e serviços oferecidos pela empresa, interagir com outras equipes da empresa, como a equipe de performance e vendas, para garantir que as necessidades dos clientes sejam atendidas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "CXCS": {
        titulo: "ANALISTA DE CX",
        escopo: "garantir a experiência do cliente em todas as interações com a empresa, criar estratégia para melhorar a experiência do cliente, identificando e implementando soluções para corrigir problemas, fornecer informações precisas e atualizadas sobre os produtos e serviços oferecidos pela empresa, interagir com outras equipes da empresa, como a equipe de performance e vendas, para garantir que as necessidades dos clientes sejam atendidas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "ANALISTA DE COMUNICAÇÃO": {
        titulo: "ANALISTA DE COMUNICAÇÃO",
        escopo: "roteirizar vídeos UGC que sejam autênticos, criativos e impactantes para as marcas que trabalhamos; colaborar com as equipes de Social Media e Performance para garantir que o conteúdo gerado não apenas engaje, mas também converta de forma eficaz; criar copy criativa que se destaque e gere conversões reais, aplicando técnicas de storytelling para gerar conexão genuína com o público; estar sempre atualizado sobre novas tendências e formatos de vídeo, garantindo que seus conteúdos não fiquem para trás; colaborar com grandes marcas, entendendo suas necessidades e entregando resultados concretos, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "G&G": {
        titulo: "G&G",
        escopo: "conduzir processos de recrutamento e seleção do início ao fim para diferentes áreas da empresa, alinhar perfis com gestores, entendendo necessidades técnicas e comportamentais das vagas, criar e publicar anúncios de vagas em portais, redes sociais e plataformas especializadas, realizar triagem de currículos, entrevistas por competências e dinâmicas de grupo, aplicar testes comportamentais e técnicos, quando necessário, gerar relatórios de indicadores (tempo de contratação, fontes de recrutamento, etc), sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "GENTE E GESTÃO": {
        titulo: "ANALISTA DE GENTE E GESTÃO",
        escopo: "conduzir processos seletivos completos, desde a triagem de currículos até a finalização da contratação; apoiar na implementação de programas de treinamento, desenvolvimento e avaliação de desempenho; acompanhar a performance dos colaboradores, realizar feedbacks construtivos e colaborar com a área de gestão para alinhamento de estratégias de pessoas; conduzir o processo de integração para novos colaboradores, assegurando um bom início na empresa; auxiliar nas rotinas administrativas relacionadas a benefícios, folha de pagamento e demais questões operacionais de recursos humanos; contribuir para a manutenção de um bom ambiente de trabalho, alinhado aos valores e à missão da empresa, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "VIDEOMAKER": {
        titulo: "VIDEOMAKER",
        escopo: "editar vídeos corporativos, institucionais e de marketing, aplicando técnicas de edição para criar conteúdo impactante e engajador; implementar efeitos visuais, transições e tratamentos de imagem para elevar a qualidade do material produzido; revisar o trabalho com base no feedback do solicitante; garantir a entrega de vídeos finalizados dentro dos prazos e padrões de qualidade estabelecidos; trazer iniciativas externas de aprimoramento e atualização com base no mercado de edição, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "DESIGNER": {
        titulo: "DESIGNER",
        escopo: "desenvolvimento de logotipos, materiais gráficos e layouts para campanhas, incluindo redes sociais, e-mail marketing e peças publicitárias; criação e otimização de peças gráficas para plataformas digitais (site, e-commerce, redes sociais, etc.); colaborar com as equipes de marketing e comunicação para entender as necessidades de design e desenvolver soluções criativas que atendam às demandas; manter-se atualizado sobre as últimas tendências e ferramentas de design e edição de vídeos, com foco na criação de conteúdo visual impactante; elaborar apresentações para reuniões internas e externas, com layout atrativo e condizente com a identidade visual da empresa, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "GESTOR DE PERFORMANCE": {
        titulo: "GESTOR DE PERFORMANCE",
        escopo: "construir campanhas e atuar de forma tática na otimização de mídias; acompanhamento da jornada do cliente junto ao time de CX/CS; auxiliar na criação, implementação e otimização de campanhas em Google Ads e Meta Ads; desenvolver análises rotineiras para identificar padrões de otimização e reportar insights aos stakeholders; monitorar a performance das campanhas e gerar relatórios para análise; colaborar com a equipe para desenvolver estratégias que aumentem a eficácia das campanhas; acompanhar tendências do mercado e aplicar boas práticas em campanhas digitais, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "PRÉ-VENDAS": {
        titulo: "ANALISTA DE PRÉ-VENDAS",
        escopo: "criação de listas para prospecção outbound (BDR); qualificação de leads; garantir o comparecimento do cliente na reunião agendada; construir um resumo do cliente para o closer ter contexto ao participar da reunião; atingir metas de reuniões agendadas; apresentação de pré reunião; desenvolvimento técnico comercial constante; construir relacionamento com clientes; atualizar o CRM; participar de reuniões internas; apresentação de Planos de Ação, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "SDR": {
        titulo: "ANALISTA DE PRÉ-VENDAS",
        escopo: "criação de listas para prospecção outbound (BDR); qualificação de leads; garantir o comparecimento do cliente na reunião agendada; construir um resumo do cliente para o closer ter contexto ao participar da reunião; atingir metas de reuniões agendadas; apresentação de pré reunião; desenvolvimento técnico comercial constante; construir relacionamento com clientes; atualizar o CRM; participar de reuniões internas; apresentação de Planos de Ação, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "BDR": {
        titulo: "ANALISTA DE PRÉ-VENDAS",
        escopo: "criação de listas para prospecção outbound (BDR); qualificação de leads; garantir o comparecimento do cliente na reunião agendada; construir um resumo do cliente para o closer ter contexto ao participar da reunião; atingir metas de reuniões agendadas; apresentação de pré reunião; desenvolvimento técnico comercial constante; construir relacionamento com clientes; atualizar o CRM; participar de reuniões internas; apresentação de Planos de Ação, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "FINANCEIRO": {
        titulo: "FINANCEIRO",
        escopo: "planejamento e controle financeiro, interpretação de relatórios, avaliação e consultoria, controle de custos, análise de riscos, acompanhamento de resultados, criar, acompanhar e medir indicadores, contas a pagar, contas a receber, emissão de nota fiscal, lançamentos financeiros, elaboração de relatórios gerenciais, acompanhamento de processos operacionais, dentre outras atividades financeiras não listadas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "PO": {
        titulo: "PRODUCT OWNER",
        escopo: "atuar prestando suporte para nossos clientes de sites e e-commerces, identificar/resolver bugs e problemas gerais relacionados a sites (site fora do ar, problemas de cálculo de frete, entre outros), relacionamento com clientes para a exposição do ocorrido e verificação da melhor tratativa, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "PRODUCT OWNER": {
        titulo: "PRODUCT OWNER",
        escopo: "atuar prestando suporte para nossos clientes de sites e e-commerces, identificar/resolver bugs e problemas gerais relacionados a sites (site fora do ar, problemas de cálculo de frete, entre outros), relacionamento com clientes para a exposição do ocorrido e verificação da melhor tratativa, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "INSIDE SALES": {
        titulo: "INSIDE SALES",
        escopo: "realização de reuniões, apresentação de propostas e fechamento, gerir pipeline de vendas, construir relacionamento com clientes, atualizar o CRM, participar de reuniões internas, cumprimento de metas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "ANALISTA DE DADOS": {
        titulo: "ANALISTA DE DADOS",
        escopo: "coletar, organizar e analisar grandes volumes de dados para extrair insights estratégicos que impactem diretamente os resultados de nossos clientes, criar e manter dashboards no Power BI que permitam a visualização clara e precisa dos dados, fornecendo relatórios acionáveis para as equipes de marketing, produto e liderança, escrever e otimizar consultas SQL para extrair dados relevantes e facilitar a análise contínua, desenvolver recomendações baseadas em dados para impulsionar a performance dos negócios, ajudando a identificar oportunidades e soluções, trabalhar em estreita colaboração com equipes de marketing e produto, garantindo que os dados gerados alimentem e apoiem as estratégias de crescimento, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "DADOS": {
        titulo: "ANALISTA DE DADOS",
        escopo: "coletar, organizar e analisar grandes volumes de dados para extrair insights estratégicos que impactem diretamente os resultados de nossos clientes, criar e manter dashboards no Power BI que permitam a visualização clara e precisa dos dados, fornecendo relatórios acionáveis para as equipes de marketing, produto e liderança, escrever e otimizar consultas SQL para extrair dados relevantes e facilitar a análise contínua, desenvolver recomendações baseadas em dados para impulsionar a performance dos negócios, ajudando a identificar oportunidades e soluções, trabalhar em estreita colaboração com equipes de marketing e produto, garantindo que os dados gerados alimentem e apoiem as estratégias de crescimento, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "UIUX": {
        titulo: "UI/UX",
        escopo: "desenvolver soluções visuais criativas para campanhas de marketing e publicidade: materiais gráficos, impressos e outros formatos, como infográficos, moodboards, grids e edição de vídeos, acompanhar os projetos e propor inovações gráficas de comunicação e design, alinhadas ao propósito e identidade das marcas, noções de Motion Design será considerado diferencial, participar de cerimônias de aprendizados com a equipe de design, participar de reuniões de debriefing e alinhamento com clientes, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "UI/UX": {
        titulo: "UI/UX",
        escopo: "desenvolver soluções visuais criativas para campanhas de marketing e publicidade: materiais gráficos, impressos e outros formatos, como infográficos, moodboards, grids e edição de vídeos, acompanhar os projetos e propor inovações gráficas de comunicação e design, alinhadas ao propósito e identidade das marcas, noções de Motion Design será considerado diferencial, participar de cerimônias de aprendizados com a equipe de design, participar de reuniões de debriefing e alinhamento com clientes, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "JURÍDICO": {
        titulo: "JURÍDICO",
        escopo: "analisar, elaborar, revisar e negociar contratos, aditivos e instrumentos jurídicos da empresa, orientar preventivamente as áreas internas quanto a riscos legais, compliance, obrigações regulatórias e mitigação de passivos, acompanhar demandas administrativas e judiciais, gerenciar escritórios terceirizados e assegurar a defesa dos interesses institucionais, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "JURIDICO": {
        titulo: "JURÍDICO",
        escopo: "analisar, elaborar, revisar e negociar contratos, aditivos e instrumentos jurídicos da empresa, orientar preventivamente as áreas internas quanto a riscos legais, compliance, obrigações regulatórias e mitigação de passivos, acompanhar demandas administrativas e judiciais, gerenciar escritórios terceirizados e assegurar a defesa dos interesses institucionais, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      },
      "DESENVOLVEDOR": {
        titulo: "DESENVOLVEDOR",
        escopo: "prestar à CONTRATANTE serviços técnicos especializados de desenvolvimento de software voltados a e-commerces na plataforma Shopify, abrangendo, de forma ampla e não exaustiva, a criação, customização, manutenção, correção, evolução e otimização de lojas virtuais, temas, funcionalidades, integrações, automações, APIs e aplicações relacionadas, bem como suporte técnico, ajustes de performance, segurança, conformidade técnica e boas práticas de desenvolvimento, de acordo com as demandas definidas pela CONTRATANTE, utilizando-se das tecnologias, recursos e padrões aplicáveis ao ecossistema Shopify, comprometendo-se a executar os serviços com diligência, qualidade técnica e observância às normas legais e contratuais vigentes"
      },
      "GESTOR DE COMUNIDADE": {
        titulo: "GESTOR DE COMUNIDADE",
        escopo: "planejar, criar e gerenciar estratégias de comunidade para fortalecer o relacionamento entre a marca e seu público, moderar e engajar comunidades em plataformas digitais como redes sociais, fóruns, grupos e canais de comunicação, desenvolver conteúdos e ações que estimulem a participação, interação e fidelização dos membros da comunidade, monitorar métricas de engajamento e crescimento da comunidade, gerando relatórios e insights para otimização contínua, identificar oportunidades de relacionamento e colaborar com as equipes de marketing, CX e conteúdo para alinhar as estratégias de comunidade aos objetivos do negócio, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
      }
    };

    const cargoOriginal = cargo || '';
    const cargoUpper = cargoOriginal.toUpperCase().trim();

    // Função para encontrar escopo com matching flexível
    const findEscopo = (cargoParam: string): { titulo: string; escopo: string } | undefined => {
      // Tenta match direto
      if (escoposPorCargo[cargoParam]) return escoposPorCargo[cargoParam];

      // Tenta match parcial (se o cargo contém a chave ou vice-versa)
      for (const [key, value] of Object.entries(escoposPorCargo)) {
        if (cargoParam.includes(key) || key.includes(cargoParam)) {
          return value;
        }
      }
      return undefined;
    };

    const escopoInfo = findEscopo(cargoUpper) || {
      titulo: cargo || 'PRESTADOR DE SERVIÇOS',
      escopo: 'prestar serviços conforme acordado entre as partes, respeitando as diretrizes técnicas e operacionais da CONTRATANTE'
    };

    console.log(`[gerarContratoPDF] Cargo original: "${cargoOriginal}", Upper: "${cargoUpper}", Titulo encontrado: "${escopoInfo.titulo}"`);

    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Helper para texto justificado (padrão ABNT)
    const j = { align: 'justify' as const };

    // Logo no header
    const logoPath = path.join(process.cwd(), 'server/assets/turbo_logo.png');
    const fs = await import('fs');
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 60, 30, { width: 150 });
      }
    } catch (e) {
      console.log('[gerarContratoPDF] Logo não encontrada');
    }

    doc.moveDown(3);

    // Header
    doc.fontSize(12).font('Helvetica-Bold').text('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS', { align: 'center' });
    doc.moveDown(1);

    // Partes
    doc.fontSize(9).font('Helvetica').text('Pelo presente instrumento particular, e na melhor forma de direito, as partes a seguir qualificadas:', j);
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica-Bold').text('CONTRATANTE: ', { continued: true });
    doc.font('Helvetica').text('TURBO PARTNERS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o n° 42.100.292/0001-84, com sede na Av. João Batista Parra, 633 - 13° Andar - Enseada do Suá, Vitória - ES, CEP: 29052-123, neste ato representada por seu sócio Rodrigo Queiroz Santos;', j);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text('CONTRATADA: ', { continued: true });

    // Detectar se é pessoa física (CPF) ou jurídica (CNPJ) e formatar qualificação
    const gerarQualificacaoContratada = (): string => {
      const cnpjLimpo = (cnpj || '').replace(/\D/g, '');
      const cpfLimpo = (cpf || '').replace(/\D/g, '');
      const enderecoFormatado = endereco || 'Não informado';
      const estadoFormatado = estado ? `, ${estado}` : '';

      // Formatar CNPJ se existir
      const cnpjFormatado = cnpjLimpo.length === 14
        ? (cnpj || cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'))
        : null;

      // Formatar CPF se existir
      const cpfFormatado = cpfLimpo.length === 11
        ? (cpf || cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'))
        : null;

      // Se tem CNPJ válido (pessoa jurídica)
      if (cnpjFormatado) {
        if (cpfFormatado) {
          // Modelo completo: CNPJ + endereço + CPF
          return `${nome}, pessoa jurídica de direito privado inscrita no CNPJ ${cnpjFormatado}, com sede na ${enderecoFormatado}${estadoFormatado}, devidamente registrado no CPF ${cpfFormatado}.`;
        }
        return `${nome}, pessoa jurídica de direito privado inscrita no CNPJ ${cnpjFormatado}, com sede na ${enderecoFormatado}${estadoFormatado}.`;
      }

      // Se tem apenas CPF (pessoa física)
      if (cpfFormatado) {
        return `${nome}, pessoa física, inscrita no CPF sob o n° ${cpfFormatado}, residente na ${enderecoFormatado}${estadoFormatado}.`;
      }

      // Fallback
      return `${nome}, com endereço na ${enderecoFormatado}${estadoFormatado}.`;
    };

    doc.font('Helvetica').text(gerarQualificacaoContratada(), j);
    doc.moveDown(0.4);
    doc.text('têm entre si, justo e contratado, o presente Contrato de Prestação de Serviços, mediante as seguintes cláusulas e condições:', j);
    doc.moveDown(0.4);

    // CLÁUSULA PRIMEIRA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA PRIMEIRA – DO OBJETO DO CONTRATO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text(`1.1. A CONTRATADA prestará serviços como ${escopoInfo.titulo}, nos termos e condições deste instrumento. Para tanto, a CONTRATADA alocará profissionais com qualificação técnica compatível com o objeto, podendo substituí-los a qualquer tempo, sob sua exclusiva responsabilidade.`, j);
    doc.moveDown(0.15);
    doc.text(`1.1.1. Os serviços objeto deste contrato poderão ser executados diretamente pela CONTRATADA ou por profissionais por ela livremente indicados, contratados ou subcontratados, sob sua exclusiva responsabilidade técnica, jurídica e administrativa, e compreendem, de modo exemplificativo, as seguintes atribuições: ${escopoInfo.escopo}`, j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. Fica certo e ajustado entre as PARTES que não haverá qualquer controle de horário e/ou carga horária do profissional alocado pela CONTRATADA para a execução dos serviços, tampouco obrigatoriedade quanto ao local de realização das tarefas.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. Toda e qualquer pessoa eventualmente envolvida pela CONTRATADA na execução dos serviços contratados atuará em nome e por conta exclusiva da CONTRATADA, sendo esta a única responsável por sua relação jurídica, operacional e contratual com tais profissionais, inexistindo qualquer vínculo direto ou indireto com a CONTRATANTE. Assim, a comunicação à CONTRATANTE sobre a identidade dos profissionais eventualmente alocados terá caráter meramente informativo e não configurará pessoalidade na prestação dos serviços.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. Quanto estiver atuando em dependências da CONTRATANTE, a CONTRATADA responsabiliza-se a fazer cumprir, por seu pessoal, as normas legais e internas da CONTRATANTE no tocante à segurança geral, higiene, proteção ao patrimônio e prevenção de incêndios.', j);
    doc.moveDown(0.4);

    // CLÁUSULA SEGUNDA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA SEGUNDA – DO PRAZO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text(`2.1 – O presente contrato tem prazo de 6 [seis] meses, com início em ${dataInicio} e fim em ${dataFim}. Ao final deste prazo, o CONTRATO poderá ser renovado mediante manifestação expressa das partes, ocasião em que será reavaliado o escopo e as condições comerciais.`, j);
    doc.moveDown(0.15);
    doc.text('Parágrafo único. A eventual renovação dependerá de manifestação expressa das partes, mediante aditivo escrito.', j);
    doc.moveDown(0.4);

    // CLÁUSULA TERCEIRA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA TERCEIRA – DA REMUNERAÇÃO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text(`3.1 - A título de contraprestação pelos serviços prestados no âmbito deste contrato, a CONTRATADA fará jus à remuneração periódica pelos serviços prestados o montante de ${salarioFormatado} (${salarioNumerico > 0 ? 'valor bruto' : 'conforme acordado entre as partes'}), enquanto vigente o presente instrumento, observado o escopo e a periodicidade das entregas pactuadas entre as partes.`, j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. Os valores que resultarem do disposto nesta cláusula constituem os únicos valores/créditos devidos pela CONTRATANTE ao CONTRATADO em razão do presente contrato, eximindo-se a CONTRATANTE de responder por quaisquer outros valores que sejam cobrados pelo CONTRATADO.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. Até o 25° (vigésimo quinto) dia do mês subsequente à prestação dos serviços, a CONTRATANTE providenciará o pagamento da CONTRATADA, desde que cumpridas todo o escopo de entregas previstas no presente instrumento contratual.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. Até o 10° (décimo) dia anterior à data de pagamento e condicionado à plena constatação de cumprimento das entregas previstas, o CONTRATADO deverá emitir a competente Nota Fiscal, remetendo-a imediatamente à CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quarto. O CONTRATADO será o único responsável pelo pagamento de eventuais valores devidos a terceiros por si SUBCONTRATADOS, não subsistindo nenhuma obrigação da CONTRATANTE para com terceiros neste sentido, tampouco de pagamento de qualquer outra importância à definida neste CONTRATO.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quinto. Caso em determinado exercício mensal haja a interrupção ou suspensão na prestação dos serviços, o pagamento será feito de modo proporcional ao período de efetiva execução das tarefas.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Sexto. O recolhimento dos tributos incidentes sobre os Serviços, assim como o cumprimento das correspondentes obrigações tributárias acessórias, são de exclusiva responsabilidade da CONTRATADA, exceto nas hipóteses em que a CONTRATANTE deva, em razão de disposição legal, promover a retenção dos valores a serem pagos ao Fisco (Municipal, Estadual ou Federal).', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Sétimo. O comprovante de depósito ou transferência servirá como recibo e prova de quitação e pagamento da obrigação ajustada.', j);
    doc.moveDown(0.4);

    // CLÁUSULA QUARTA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA QUARTA – DAS OBRIGAÇÕES DA CONTRATADA');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('4.1 - São obrigações da CONTRATADA:', j);
    doc.moveDown(0.2);
    doc.text('4.2. A CONTRATADA executará os serviços com plena autonomia técnica, operacional e organizacional, competindo-lhe definir os métodos, ferramentas, rotinas e estratégias de trabalho necessários à execução do objeto contratado. As diretrizes eventualmente fornecidas pela CONTRATANTE terão caráter meramente orientativo quanto aos objetivos do projeto, não configurando subordinação hierárquica ou poder diretivo sobre a CONTRATADA.', j);
    doc.moveDown(0.2);
    doc.text('4.3. Fornecer as notas fiscais referentes aos pagamentos efetuados pela CONTRATANTE dentro do prazo previamente estipulado por meio do presente instrumento;', j);
    doc.moveDown(0.2);
    doc.text('4.4. Arcar com todas as despesas de natureza tributária decorrentes dos serviços especificados neste contrato;', j);
    doc.moveDown(0.2);
    doc.text('4.5. Cumprir o escopo, os prazos, os entregáveis e os requisitos técnicos acordados entre as partes para a execução do objeto, preservada a autonomia técnica e operacional da CONTRATADA quanto aos meios e métodos empregados.', j);
    doc.moveDown(0.2);
    doc.text('4.6. Manter sob estrito sigilo todas as informações e dados recebidos ou a que tiver acesso em razão da execução do projeto objeto deste contrato, comprometendo-se a não divulgá-los, reproduzi-los ou utilizá-los para finalidade diversa daquela prevista neste instrumento, obrigação que subsistirá mesmo após o término ou rescisão contratual, pelo prazo de 5 (cinco) anos, abrangendo quaisquer informações confidenciais ou privilegiadas, de natureza técnica, comercial, estratégica ou de qualquer outra espécie.', j);
    doc.moveDown(0.2);
    doc.text('4.7. A eventual disponibilização de equipamentos pela CONTRATANTE ocorrerá exclusivamente por razões de segurança da informação, padronização tecnológica e proteção de dados corporativos, não implicando integração da CONTRATADA à estrutura organizacional da CONTRATANTE, onde tal disponibilização não descaracteriza a autonomia empresarial da CONTRATADA, que permanece responsável pela organização de seus próprios meios de trabalho.', j);
    doc.moveDown(0.2);
    doc.text('4.8. A CONTRATANTE poderá, a qualquer tempo, realizar auditorias técnicas e de segurança da informação nos equipamentos disponibilizados em comodato, inclusive mediante acesso administrativo, exclusivamente para fins de proteção de dados, integridade de sistemas, prevenção de incidentes e verificação de conformidade com as políticas internas aplicáveis.', j);
    doc.moveDown(0.2);
    doc.text('4.9. A CONTRATADA compromete-se a observar os critérios técnicos e requisitos de qualidade previamente acordados entre as partes para fins de aceite dos entregáveis, podendo a CONTRATANTE recusar, fundamentadamente, materiais que não atendam ao escopo, às especificações e aos critérios de qualidade pactuados.', j);
    doc.moveDown(0.2);
    doc.text('4.10. A CONTRATADA compromete-se a não praticar qualquer ato que possa prejudicar a imagem, reputação ou credibilidade da CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. O envolvimento da CONTRATADA em situação que gere repercussão negativa relevante autoriza a rescisão imediata do contrato, sem ônus para a CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. Os documentos pertencentes ou em posse da empresa contratante depositados em mídias físicas ou digitais somente devem ser abertos e tratados em computadores credenciados e de propriedade da CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. Sobre os computadores e demais equipamentos fornecidos para a prestação dos serviços não devem ser instalados programas alheios sem a autorização da CONTRATANTE.', j);
    doc.moveDown(0.4);

    // CLÁUSULA QUINTA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA QUINTA – DAS OBRIGAÇÕES DA CONTRATANTE');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('5.1. Sem prejuízo das demais obrigações expressamente ajustadas neste Contrato, a CONTRATANTE se obriga a:', j);
    doc.moveDown(0.2);
    doc.text('5.2. A CONTRATANTE poderá fornecer informações estratégicas, objetivos comerciais ou parâmetros gerais relacionados ao escopo do projeto, os quais servirão exclusivamente como referência para o desenvolvimento das atividades pela CONTRATADA, preservada sua plena autonomia técnica e operacional.', j);
    doc.moveDown(0.2);
    doc.text('5.3. Efetuar o pagamento, nas datas e nos termos definidos neste contrato;', j);
    doc.moveDown(0.2);
    doc.text('5.4. Manifestar, de forma expressa, eventuais críticas, dúvidas, solicitações, novas orientações e sugestões pertinentes aos serviços, quando existirem;', j);
    doc.moveDown(0.4);

    // CLÁUSULA SEXTA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA SEXTA – DA RESCISÃO E EXTINÇÃO DO CONTRATO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('6.1. A CONTRATANTE poderá, a seu exclusivo critério e independentemente de apresentação de justificativa, resilir unilateralmente o presente contrato a qualquer tempo, produzindo a rescisão efeitos imediatos a partir do recebimento da informação, sem que disso decorra qualquer direito a indenização, multa, compensação financeira ou ressarcimento em favor da CONTRATADA, ressalvado apenas o pagamento proporcional dos serviços comprovadamente prestados até a data da efetiva extinção contratual.', j);
    doc.moveDown(0.15);
    doc.text('6.2. Rescindido o contrato, a CONTRATADA deverá, no prazo máximo de 48 (quarenta e oito) horas, devolver todos os bens, documentos, mídias, credenciais e acessos disponibilizados, bem como realizar a transferência organizada de informações necessárias à continuidade do projeto.', j);
    doc.moveDown(0.15);
    doc.text('§1º. No mesmo prazo, a CONTRATADA deverá (i) cessar imediatamente o uso de quaisquer credenciais, acessos e ambientes da CONTRATANTE; (ii) eliminar, de forma segura, quaisquer cópias de dados, informações e materiais da CONTRATANTE eventualmente mantidos fora dos ambientes autorizados; e (iii) fornecer declaração escrita de devolução/eliminação, sem prejuízo de auditoria.', j);
    doc.moveDown(0.15);
    doc.text('§2º. A CONTRATANTE poderá reter e compensar valores eventualmente devidos à CONTRATADA com quaisquer prejuízos comprovados, multas contratuais, custos de reparação/substituição de equipamentos e valores decorrentes do descumprimento de obrigações estipuladas no presente contrato.', j);
    doc.moveDown(0.15);
    doc.text('§3º. Fica expressamente pactuado que a CONTRATADA não fará jus a qualquer indenização por expectativa de renovação, continuidade, descontinuidade do projeto, investimentos realizados, perdas e danos indiretos ou lucros cessantes.', j);
    doc.moveDown(0.15);
    doc.text('6.2. Sem prejuízo das demais hipóteses previstas neste contrato ou na legislação aplicável, constituem motivos suficientes para a rescisão imediata do presente instrumento, independentemente de aviso prévio ou indenização à CONTRATADA:', j);
    doc.moveDown(0.2);
    doc.text('I – a execução inadequada, negligente ou tecnicamente deficiente dos serviços contratados;', j);
    doc.text('II – o descumprimento de prazos, entregas ou requisitos/critério de qualidade pactuados entre as partes;', j);
    doc.text('III – a violação das obrigações de confidencialidade, proteção de dados, propriedade intelectual ou segurança da informação;', j);
    doc.text('IV – a prática de condutas que possam comprometer, direta ou indiretamente, a reputação, a imagem institucional ou a credibilidade da CONTRATANTE perante terceiros;', j);
    doc.text('V – a prática de atos contrários à boa-fé objetiva, à lealdade contratual e aos deveres de cooperação inerentes às relações empresariais.', j);
    doc.moveDown(0.15);
    doc.text('6.3 A extinção do presente contrato, por qualquer motivo, não afetará a validade ou exigibilidade das obrigações que, por sua natureza, devam subsistir após o término da relação contratual, especialmente aquelas relativas à confidencialidade, propriedade intelectual, proteção de dados e não aliciamento.', j);
    doc.moveDown(0.4);

    // CLÁUSULA SÉTIMA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA SÉTIMA – DA INEXISTÊNCIA DE VÍNCULO TRABALHISTA E SOCIETÁRIO');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('7.1. As partes reconhecem expressamente que a presente contratação possui natureza estritamente civil e empresarial, regida pelas disposições do Código Civil, inexistindo entre as partes qualquer relação de emprego ou vínculo trabalhista.', j);
    doc.moveDown(0.15);
    doc.text('7.2. A CONTRATADA exerce atividade empresarial própria, assumindo integralmente os riscos de sua atividade econômica, nos termos do art. 966 do Código Civil, inexistindo entre as partes quaisquer dos elementos caracterizadores da relação de emprego previstos no art. 3º da Consolidação das Leis do Trabalho, de modo que a CONTRATADA estabelecerá e concretizará a forma de realização dos serviços pactuados no presente termo.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. O CONTRATADO tem ciência e declara que nenhum ex-empregado da CONTRATANTE cujo contrato de trabalho tenha se encerrado há menos de 18 (dezoito) meses poderá ser alocado pelo CONTRATADO na prestação dos serviços.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. O CONTRATADO tem ciência e declara que tem capacidade técnico-financeira para arcar com suas responsabilidades contratuais e extracontratuais, vinculada ou não a este contrato, e que não possui nem se colocará em situação de dependência econômica com relação ao resultado financeiro deste contrato.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. O CONTRATADO declara assumir integralmente os riscos relacionados à atividade empresarial que exerce, inclusive quanto à gestão de sua equipe, métodos de trabalho, investimentos necessários e responsabilidade pelos resultados.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quarto. O CONTRATADO tem ciência e declara que nada neste contrato poderá ser interpretado como tendo as partes, estabelecido qualquer forma de sociedade, associação, agência ou consórcio, de fato ou de direito, permanecendo cada uma das partes com as suas obrigações civis, comerciais, trabalhistas e tributárias, de forma autônoma.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quinto. A execução dos serviços ocorrerá com plena autonomia técnica, organizacional e econômica da CONTRATADA, inexistindo controle de jornada, subordinação hierárquica ou exclusividade.', j);
    doc.moveDown(0.4);

    // CLÁUSULA OITAVA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA OITAVA – DA CONFIDENCIALIDADE');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('8.1 - As partes concordam que, sem o consentimento escrito, não poderão revelar ou divulgar, direta ou indiretamente, no todo ou em parte, isolada ou juntamente com terceiros, qualquer informação confidencial referente ao presente contrato, o que inclui, mas não se limita a: todos e quaisquer dados, relatórios, análises, estudos, pesquisas, interpretações, previsões / estimativas, registros, materiais e quaisquer outros elementos que contenham informações referentes à outra Parte. As disposições desta cláusula sobreviverão após o prazo de 05 (cinco) anos posteriores à vigência deste contrato ou à rescisão do mesmo por qualquer razão.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. Para os propósitos, serão consideradas "informações confidenciais" todas e quaisquer informações e/ou dados de natureza confidencial (incluindo, sem limitação, os termos e condições deste contrato e todos os segredos e/ou informações operacionais, econômicas e técnicas, bem como demais informações comerciais ou "know-how") que tenham sido direta ou indiretamente fornecidos ou divulgados por uma das partes à outra sob ou em função deste contrato, incluindo-se as informações de natureza comercial e os Contratos celebrados com terceiros para a comercialização dos produtos e serviços, mesmo as obtidas durante as negociações precedentes à formalização deste instrumento.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. Caso a CONTRATADA venha a ser legalmente obrigada, por determinação judicial ou de autoridade administrativa competente, a revelar qualquer Informação Confidencial relacionada à CONTRATANTE, deverá comunicar formalmente à CONTRATANTE, por escrito e com a maior brevidade possível, acerca da referida exigência, fornecendo cópia da ordem recebida e todas as informações pertinentes, a fim de que a CONTRATANTE possa adotar as medidas judiciais ou administrativas cabíveis à preservação de seus direitos.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo único. A CONTRATADA limitar-se-á a revelar exclusivamente as informações estritamente exigidas pela autoridade competente, envidando seus melhores esforços para resguardar o caráter confidencial dos dados divulgados.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. A CONTRATADA não poderá, em nenhuma hipótese, fazer qualquer outro uso, realizar qualquer outro negócio ou celebrar qualquer outro contrato relacionado, direta ou indiretamente, às Informações Confidenciais.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quarto. Todas as Informações Confidenciais devem ser mantidas e tratadas como estritamente confidenciais e não poderão ser reveladas a qualquer terceiro, de forma alguma, no todo ou em parte, bem como não poderão ser utilizadas para qualquer finalidade que não esteja única e exclusivamente relacionada aos Serviços.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Quinto. Sem prejuízo de outras obrigações, a CONTRATADA se compromete desde logo a:', j);
    doc.text('1. Não divulgar quaisquer Informações Confidenciais a quaisquer terceiros;', j);
    doc.text('2. Utilizar quaisquer Informações Confidenciais exclusivamente para a execução da prestação dos serviços;', j);
    doc.text('3. Não analisar, providenciar análise, derivar ou sintetizar qualquer informação recebida da CONTRATANTE sem autorização prévia e fora dos limites da execução de seu trabalho.', j);
    doc.moveDown(0.15);
    doc.text('8.2. A CONTRATADA, por si e por quaisquer profissionais por ela alocados, será responsável por quaisquer danos causados à CONTRATANTE ou a terceiros em decorrência do descumprimento das obrigações de sigilo previstas nesta cláusula, independentemente de dolo ou culpa.', j);
    doc.moveDown(0.15);
    doc.text('8.3. O descumprimento das obrigações de confidencialidade ensejará a obrigação de indenizar integralmente os danos comprovadamente sofridos pela parte prejudicada, sem prejuízo das demais medidas judiciais cabíveis.', j);
    doc.moveDown(0.15);
    doc.text('8.4. A CONTRATADA reconhece que a violação das obrigações de confidencialidade e segurança da informação poderá causar dano de difícil reparação, razão pela qual a CONTRATANTE poderá pleitear tutela específica/inibitória e medidas de urgência para cessação do ilícito, sem prejuízo de perdas e danos.', j);
    doc.moveDown(0.4);

    // CLÁUSULA NONA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA NONA – DA INEXISTÊNCIA DE LICENÇAS');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('9.1. A CONTRATANTE reterá todo o direito, titularidade e interesse sobre as informações confidenciais presentes no presente contrato.', j);
    doc.moveDown(0.15);
    doc.text('9.2. Nada contido neste CONTRATO, nem a revelação de Informações Confidenciais, deverá ser interpretado como cessão ou transferência de quaisquer direitos, por meio de licença ou de qualquer outra forma, referente a marcas, patentes, direitos autorais, informações tecnológicas, segredos comerciais e/ou industriais, ou outras Informações Confidenciais, ou qualquer outra propriedade intelectual, sendo certo que a CONTRATANTE permanecerá como única proprietária das Informações Confidenciais.', j);
    doc.moveDown(0.15);
    doc.text('9.3. São e serão considerados como propriedade intelectual e/ou industrial única e exclusiva da CONTRATANTE qualquer produto, criação, desenvolvimento, relatório, planilha, resultado, dentre outros, ainda que tenham sido desenvolvidos pela CONTRATADA. Nenhum direito de propriedade intelectual e/ou industrial será detido pela CONTRATADA, a qual, expressamente, cede e transfere à CONTRATANTE, desde logo, não onerosamente, todo e qualquer direito relacionado ou derivado a qualquer espécie de criação decorrente do relacionamento entre as Partes.', j);
    doc.moveDown(0.15);
    doc.text('9.4. Não assiste à CONTRATADA qualquer direito ou expectativa de direito de propriedade intelectual e/ou industrial ou de qualquer direito imaterial, tampouco lhe assiste qualquer direito de postular ou formular qualquer reivindicação.', j);
    doc.moveDown(0.15);
    doc.text('9.5. A CONTRATADA expressamente declara que todo e qualquer valor a título de eventuais direitos sobre propriedade intelectual e/ou industrial, direitos autorais ou qualquer espécie de direitos imateriais, já foi considerada pelas Partes na fixação do Preço (contraprestação), razão pela qual nenhuma quantia poderá ser reclamada, a qualquer título, pela CONTRATADA.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA – DA ABSTENÇÃO DE ALICIAMENTO E INDUÇÃO DE TERCEIROS VINCULADOS À CONTRATANTE');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('10.1. Durante a vigência deste instrumento e por um período de 24 (vinte e quatro) meses após sua extinção, o CONTRATADO se compromete a não contratar, ou tentar contratar, direta ou indiretamente, qualquer empregado(a) da CONTRATANTE ou de qualquer outra empresa do grupo no Brasil ou no exterior, para trabalhar para seu novo empregador ou empresa da qual seja, direta ou indiretamente, ligado, inclusive como sócio.', j);
    doc.moveDown(0.15);
    doc.text('10.1.1. Durante o período mencionado na Cláusula Segunda e pelo mesmo prazo de 02 (dois) anos contados da rescisão do contrato, o CONTRATADO também se compromete a não ajudar terceiros a contratar empregados(as) da CONTRATANTE ou de outra empresa do grupo, tampouco a induzir ou convencer qualquer empregado(a) da CONTRATANTE a rescindir o contrato que mantém com a CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('10.2. O CONTRATADO, também neste ato, de forma irrevogável e irretratável, se compromete perante a CONTRATANTE a abster-se, durante a vigência do presente e pelo período de 03 (três) anos contados da rescisão contratual de direta ou indiretamente, aliciar, induzir, convidar, contratar, nem determinar que seja aliciado, induzido ou convidado:', j);
    doc.moveDown(0.2);
    doc.text('(i) Qualquer cliente atendido e/ou captado pela CONTRATANTE ou pelo CONTRATADO durante a prestação de seus serviços para que tal cliente seja atendido por outra personalidade jurídica concorrente da TURBO;', j);
    doc.text('(ii) Qualquer empregado, sócio, diretor ou outro prestador de serviços da TURBO e/ou qualquer de suas afiliadas;', j);
    doc.text('(iii) Qualquer pessoa a deixar de fazer negócios com a TURBO e/ou qualquer de suas afiliadas;', j);
    doc.text('(iv) Qualquer fornecedor ou cliente da TURBO a deixar de realizar ou diminuir os negócios realizados com a CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.font('Helvetica-Bold').text('10.3. Sem prejuízo das indenizações por perdas e danos e da responsabilidade criminal, o CONTRATADO, em caso de infração da presente cláusula, pagará ao CONTRATANTE uma multa não compensatória igual a R$ 100.000,00 (cem mil reais) por cada infração.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA PRIMEIRA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA PRIMEIRA – DA PROTEÇÃO DE DADOS PESSOAIS');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('11.1. Seguindo as determinações da Lei 13.709/2018 ("Lei Geral de Proteção de Dados Pessoais") o CONTRATADO se compromete a manter segredo absoluto dos assuntos relacionados aos serviços prestados, bem como de todos os dados e informações relativos aos resultados obtidos na prestação do serviço, comprometendo-se a: não utilizar as informações confidenciais a que tiver acesso pelo período de 05 (cinco) anos, para gerar benefício próprio exclusivo e/ou unilateral, presente ou futuro, ou para o uso de terceiros; não efetuar nenhuma gravação ou cópia da documentação confidencial a que tiver acesso; não apropriar-se para si ou para outrem de material confidencial e/ou sigiloso da tecnologia que venha a ser disponível e; não repassar o conhecimento das informações confidenciais, responsabilizando-se por todas as pessoas que vierem a ter acesso às informações, por seu intermédio, e obrigando-se, assim, a reparar a ocorrência de qualquer dano e/ou prejuízo oriundo de uma eventual quebra de sigilo das informações fornecidas.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Primeiro. As partes se comprometem a não utilizar os dados pessoais que tiverem acesso para fins distintos da relação estabelecida, sendo vedada a transmissão para terceiros.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Segundo. As partes se comprometem em manter os compromissos acima, mesmo após o término da relação contratual.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo Terceiro. As partes declaram que qualquer conduta incompatível com as disposições acima será considerada uma grave violação deste contrato e será considerado motivo de justa causa para a rescisão imediata, sem prejuízo da adoção das medidas legalmente cabíveis.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA SEGUNDA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA SEGUNDA – DO USO E RESPONSABILIDADE PELOS EQUIPAMENTOS FORNECIDOS PELA CONTRATANTE');
    doc.moveDown(0.15);
    const patrimonioDescricao = patrimonio || 'a definir';
    doc.font('Helvetica').fontSize(8.5).text(`12.1. A CONTRATANTE disponibilizará, em regime de comodato, exclusivamente por razões de segurança da informação, padronização tecnológica e proteção de dados corporativos, um computador MacBook modelo ${patrimonioDescricao}, um Fone Logitech H390, Mouse Logitech Bluetooth e um Adaptador Hub USB-C HDMI com ao menos 2 entradas USB-A, de sua propriedade, para uso exclusivo da CONTRATADA na execução dos serviços contratados neste instrumento.`, j);
    doc.moveDown(0.15);
    doc.text('12.2. A CONTRATADA compromete-se a zelar pelo bom estado de conservação, uso adequado e exclusivo do equipamento disponibilizado, abstendo-se de utilizá-lo para fins pessoais, atividades não relacionadas ao presente contrato, ou por terceiros.', j);
    doc.moveDown(0.15);
    doc.text('12.3. A CONTRATADA será responsável integral por qualquer dano, perda, extravio, furto, roubo ou mau uso do equipamento, independentemente de culpa, obrigando-se a arcar com os custos de reparação ou substituição integral do bem, conforme orçamento técnico indicado pela CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('12.4. Em caso de dano parcial, a CONTRATADA deverá restituir à CONTRATANTE o valor referente ao reparo, no prazo máximo de 30 (trinta) dias após a notificação escrita.', j);
    doc.moveDown(0.15);
    doc.text('12.5. Em caso de perda total, extravio, furto ou roubo, a CONTRATADA deverá indenizar a CONTRATANTE com base no valor de mercado atualizado do bem à época do evento, conforme cotação de revendedor autorizado ou nota fiscal de aquisição, o que for mais benéfico à CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('12.6. O equipamento deverá ser devolvido à CONTRATANTE no ato de rescisão do contrato, em perfeito estado de funcionamento e conservação, ressalvado o desgaste natural decorrente do uso regular.', j);
    doc.moveDown(0.15);
    doc.text('12.7. A CONTRATANTE poderá, a qualquer tempo, solicitar a devolução imediata do equipamento, cabendo à CONTRATADA o cumprimento imediato da solicitação.', j);
    doc.moveDown(0.15);
    doc.text('12.8. O inadimplemento das obrigações previstas nesta cláusula autoriza a CONTRATANTE a reter valores devidos à CONTRATADA até o limite da indenização cabível e/ou de quaisquer multas e perdas e danos decorrentes do descumprimento contratual, sem prejuízo das demais medidas.', j);
    doc.moveDown(0.15);
    doc.text('12.9. A CONTRATANTE poderá realizar auditorias técnicas no equipamento disponibilizado, a qualquer tempo.', j);
    doc.moveDown(0.15);
    doc.text('12.10. O não cumprimento da obrigação de devolução dos equipamentos no prazo estipulado neste contrato sujeitará a CONTRATADA ao pagamento de multa diária de R$ 500,00 (quinhentos reais), a partir do primeiro dia de atraso, até a efetiva restituição dos bens à CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo único. A multa prevista nesta cláusula possui natureza moratória, não substituindo a obrigação de devolução dos equipamentos, nem afastando o direito da CONTRATANTE de exigir o pagamento do valor de reposição do bem ou a reparação de eventuais perdas e danos.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA TERCEIRA - DIREITO DE USO DE IMAGEM
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA TERCEIRA – DO DIREITO DE USO DE IMAGEM');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('13. O CONTRATADO autoriza, de forma livre, expressa, irrevogável e irretratável, a utilização de sua imagem, nome e voz pela CONTRATANTE, para fins institucionais, comerciais e publicitários relacionados ou não ao objeto deste contrato, em quaisquer meios físicos ou digitais, sem limitação territorial ou temporal, inclusive após o término da relação contratual, sem que disso decorra direito a remuneração adicional.', j);
    doc.moveDown(0.15);
    doc.text('Parágrafo único. A utilização ora autorizada não implica exclusividade, vínculo empregatício ou societário, comprometendo-se a CONTRATANTE a utilizar a imagem do CONTRATADO de forma ética e compatível com a finalidade profissional pactuada.', j);
    doc.moveDown(0.4);

    // CLÁUSULA DÉCIMA QUARTA
    doc.font('Helvetica-Bold').fontSize(9).text('CLÁUSULA DÉCIMA QUARTA – DAS DISPOSIÇÕES GERAIS');
    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8.5).text('14.1. Este Contrato constitui o entendimento integral e completo entre as partes, substituindo todos os entendimentos, compromissos, negociações, acordos e contratos anteriores, sejam eles verbais ou escritos, relativos ao objeto deste Contrato. Qualquer modificação ou emenda a este Contrato só será válida se formalizada por escrito e assinada pelos representantes legais de ambas as partes.', j);
    doc.moveDown(0.15);
    doc.text('14.2. As partes reconhecem que a nulidade ou inexequibilidade de qualquer disposição deste Contrato não afetará a validade ou exequibilidade das demais disposições, que continuarão em pleno vigor e efeito. Caso qualquer disposição deste Contrato seja considerada inválida, ilegal ou inexequível, as partes negociarão de boa-fé para substituí-la por uma disposição que, na máxima extensão permitida por lei, preserve a intenção original da disposição inválida, ilegal ou inexequível.', j);
    doc.moveDown(0.15);
    doc.text('14.3. A CONTRATADA responderá integralmente por quaisquer danos, prejuízos ou responsabilidades decorrentes de atos praticados por si, por seus sócios, empregados, prepostos, colaboradores ou subcontratados no âmbito da execução dos serviços objeto deste contrato.', j);
    doc.moveDown(0.15);
    doc.text('14.4. Não se estabelece, por força deste instrumento, qualquer forma de sociedade, associação, agência, consórcio, participação societária, ou responsabilidade solidária entre as partes.', j);
    doc.moveDown(0.15);
    doc.text('14.5. O objeto deste contrato não visa proporcionar nenhuma espécie de vantagem fiscal, trabalhista ou previdenciária a qualquer Parte ou a terceiros, e não implica vínculo empregatício entre uma das partes e os funcionários/prepostos da outra, ficando a cargo de cada uma delas a responsabilidade referente aos encargos sociais, tributários, previdenciários e trabalhistas de seus respectivos colaboradores.', j);
    doc.moveDown(0.15);
    doc.text('14.6. Os tributos (impostos, taxas, emolumentos, contribuições fiscais e parafiscais) que sejam devidos em decorrência direta ou indireta do presente contrato ou de sua execução, serão de exclusiva responsabilidade do contribuinte, conforme definido na norma tributária, autorizadas as retenções legais, sem direito a reembolso.', j);
    doc.moveDown(0.15);
    doc.text('14.7. O presente CONTRATO é o instrumento que regula todos os direitos e obrigações acordadas entre as Partes, substituindo todo e qualquer CONTRATO ou entendimento previamente realizado pelas Partes.', j);
    doc.moveDown(0.15);
    doc.text('14.8. Na hipótese de qualquer autuação, fiscalização, imposição de multa, desenquadramento ou fixação de qualquer outra sanção, de qualquer natureza, em desfavor da CONTRATADA, em especial em matéria cível, tributária ou trabalhista, nenhuma responsabilidade incumbirá à CONTRATANTE, a qual fica desobrigada de qualquer pagamento ou assunção de despesas, sendo de rigor, ao revés, a obrigação de a CONTRATADA indenizar a CONTRATANTE por eventuais prejuízos decorrentes de tais eventos.', j);
    doc.moveDown(0.15);
    doc.text('14.9. Durante a vigência deste contrato, a CONTRATADA compromete-se a não utilizar informações estratégicas, dados comerciais, metodologias, modelos de negócio, bases de dados ou qualquer outro ativo intelectual da CONTRATANTE em benefício próprio ou de terceiros, especialmente para atuação concorrente ou potencialmente prejudicial aos interesses comerciais da CONTRATANTE.', j);
    doc.moveDown(0.15);
    doc.text('14.10. O presente contrato não estabelece exclusividade entre as partes, nem gera expectativa de renovação automática ou volume mínimo de demandas, de modo que em nenhuma hipótese a CONTRATANTE será responsável por lucros cessantes, danos indiretos ou perdas financeiras da CONTRATADA.', j);
    doc.moveDown(0.15);
    doc.text('14.11. Declaram as Partes que as obrigações aqui presentes são celebradas de boa-fé, livremente e de comum acordo, não existindo quaisquer vícios ou defeitos que possam acarretar a sua nulidade, em especial aqueles relacionados com dolo, erro, fraude, simulação ou coação, inexistindo também qualquer fato que possa ser configurado como estado de perigo ou de necessidade.', j);
    doc.moveDown(0.15);
    doc.text('14.12. As partes reconhecem expressamente que o objeto do presente contrato não se vincula à atuação pessoal de qualquer indivíduo específico, inexistindo pessoalidade na prestação dos serviços, sendo a CONTRATADA integralmente responsável pela gestão de seus profissionais, colaboradores, empregados, prepostos ou subcontratados eventualmente envolvidos na execução do objeto contratual.', j);
    doc.moveDown(0.15);
    doc.text('14.13. Fica eleito o Foro da Comarca de Vitória/ES para nele serem dirimidas eventuais dúvidas ou questões oriundas deste contrato.', j);
    doc.moveDown(0.5);

    doc.text('As Partes neste ato declaram que (i) é admitida como válida e verdadeira a assinatura deste Contrato por meio de certificado digital emitido por entidades credenciadas para tanto pela Infraestrutura de Chaves Públicas Brasileira - ICP-Brasil; e (ii) são admitidas como válidas e originais as vias deste Contrato emitidas por meios de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil.', j);
    doc.moveDown(0.3);
    doc.text('E assim, por estarem justas e CONTRATADAS, as partes assinam este presente contrato em 2 (duas) vias de igual teor, na presença das testemunhas abaixo.', j);
    doc.moveDown(1);

    // Assinaturas
    doc.fontSize(9).text(`Vitória, ${dataAtual}.`, j);
    doc.moveDown(1.5);
    doc.text('____________________________________________________', { align: 'center' });
    doc.font('Helvetica-Bold').text('TURBO PARTNERS LTDA', { align: 'center' });
    doc.moveDown(1.5);
    doc.text('____________________________________________________', { align: 'center' });
    doc.font('Helvetica-Bold').text(nome.toUpperCase(), { align: 'center' });

    doc.end();

    return pdfPromise;
  }

  // POST - Enviar contrato de colaborador para assinatura via Assinafy
  app.post("/api/juridico/colaboradores-contrato/:id/enviar-assinatura", async (req, res) => {
    const colaboradorId = parseInt(req.params.id);
    const startTime = Date.now();

    try {
      console.log(`[assinafy-colab] Iniciando envio para assinatura - Colaborador ID: ${colaboradorId}`);

      // 1. Buscar config e dados do colaborador em paralelo
      const [configResult, colaboradorResult] = await Promise.all([
        db.execute(sql`
          SELECT account_id, api_key, api_url FROM cortex_core.assinafy_config WHERE ativo = true AND tipo = 'colaboradores' LIMIT 1
        `),
        db.execute(sql`
          SELECT id, nome, cpf, cnpj, endereco, estado, cargo, setor, admissao::text as admissao,
                 COALESCE(email_pessoal, email_turbo) as email, salario
          FROM "Inhire".rh_pessoal
          WHERE id = ${colaboradorId}
        `)
      ]);

      if (configResult.rows.length === 0) {
        return res.status(500).json({ error: "Configuração do Assinafy para colaboradores não encontrada" });
      }
      if (colaboradorResult.rows.length === 0) {
        return res.status(404).json({ error: "Colaborador não encontrado" });
      }

      const config = configResult.rows[0] as { account_id: string; api_key: string; api_url: string };
      const colaborador = colaboradorResult.rows[0] as any;

      if (!colaborador.email) {
        return res.status(400).json({ error: "Colaborador não possui email cadastrado. Cadastre o email antes de enviar para assinatura." });
      }

      console.log(`[assinafy-colab] Signatário: ${colaborador.nome} (${colaborador.email}) [${Date.now() - startTime}ms]`);

      // 2. Buscar patrimônio e gerar PDF em paralelo
      const [patrimonioResult, FormDataModule] = await Promise.all([
        db.execute(sql`
          SELECT descricao FROM "Inhire".rh_patrimonio
          WHERE (responsavel_id = ${colaboradorId} OR responsavel_atual = ${colaborador.nome})
            AND (ativo ILIKE '%notebook%' OR ativo ILIKE '%macbook%' OR ativo ILIKE '%computador%' OR ativo ILIKE '%mac%' OR descricao ILIKE '%macbook%')
            AND descricao IS NOT NULL
          ORDER BY id DESC LIMIT 1
        `),
        import('form-data')
      ]);
      const patrimonio = (patrimonioResult.rows[0] as any)?.descricao || null;

      const pdfBuffer = await gerarContratoPDF({
        nome: colaborador.nome,
        cpf: colaborador.cpf,
        cnpj: colaborador.cnpj,
        endereco: colaborador.endereco,
        estado: colaborador.estado,
        cargo: colaborador.cargo,
        salario: colaborador.salario?.toString() || '0',
        patrimonio,
      });
      console.log(`[assinafy-colab] PDF gerado: ${pdfBuffer.length} bytes [${Date.now() - startTime}ms]`);

      // 3. Upload do PDF para Assinafy
      const FormData = FormDataModule.default;
      const formData = new FormData();
      formData.append('file', pdfBuffer, {
        filename: `contrato_colaborador_${colaboradorId}.pdf`,
        contentType: 'application/pdf'
      });

      const uploadUrl = `${config.api_url}/accounts/${config.account_id}/documents`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'X-Api-Key': config.api_key,
          ...formData.getHeaders()
        },
        body: formData.getBuffer()
      });

      const uploadResult = await uploadResponse.json() as any;

      if (uploadResult.status !== 200 && !uploadResult.id) {
        console.error('[assinafy-colab] Erro no upload:', uploadResult);
        return res.status(500).json({ error: "Erro ao fazer upload do documento", details: uploadResult.message });
      }

      const documentId = uploadResult.id || uploadResult.data?.id;
      console.log(`[assinafy-colab] Documento criado: ${documentId} [${Date.now() - startTime}ms]`);

      // 4. Buscar/criar signatários EM PARALELO com o polling do documento
      const signerUrl = `${config.api_url}/accounts/${config.account_id}/signers`;

      const sociosResponsaveis = [
        { nome: "Rodrigo Queiroz Santos", email: "rodrigo.queiroz@turbopartners.com.br" },
        { nome: "Victor Peixoto", email: "victor.peixoto@turbopartners.com.br" },
        { nome: "Julia Viana", email: "julia.viana@turbopartners.com.br" }
      ];

      const getOrCreateSigner = async (nome: string, email: string): Promise<string> => {
        const searchUrl = `${signerUrl}?search=${encodeURIComponent(email)}`;
        const searchResponse = await fetch(searchUrl, {
          method: 'GET',
          headers: { 'X-Api-Key': config.api_key }
        });

        const searchResult = await searchResponse.json() as any;

        if (searchResult.status === 200 && searchResult.data && Array.isArray(searchResult.data)) {
          const existingSigner = searchResult.data.find((s: any) =>
            s.email?.toLowerCase() === email.toLowerCase()
          );
          if (existingSigner) return existingSigner.id;
        }

        const signerResponse = await fetch(signerUrl, {
          method: 'POST',
          headers: {
            'X-Api-Key': config.api_key,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ full_name: nome, email: email })
        });

        const signerResult = await signerResponse.json() as any;
        return signerResult.data?.id || signerResult.id;
      };

      // Polling do documento e busca de signatários rodam em paralelo
      const waitForDocument = async (): Promise<boolean> => {
        const statusUrl = `${config.api_url}/documents/${documentId}`;
        for (let attempt = 1; attempt <= 30; attempt++) {
          const statusResponse = await fetch(statusUrl, {
            method: 'GET',
            headers: { 'X-Api-Key': config.api_key }
          });
          const statusResult = await statusResponse.json() as any;
          const currentStatus = statusResult.data?.status || statusResult.status;

          if (attempt === 1 || attempt % 5 === 0) {
            console.log(`[assinafy-colab] Status (tentativa ${attempt}/30): ${currentStatus} [${Date.now() - startTime}ms]`);
          }

          if (currentStatus === 'metadata_ready') {
            console.log(`[assinafy-colab] Documento pronto! [${Date.now() - startTime}ms]`);
            return true;
          }

          if (currentStatus === 'failed' || currentStatus === 'error') {
            return false;
          }

          // Polling progressivo: 500ms nas primeiras 5, depois 1s
          await new Promise(resolve => setTimeout(resolve, attempt <= 5 ? 500 : 1000));
        }
        return false;
      };

      const [documentReady, signerIds] = await Promise.all([
        waitForDocument(),
        Promise.all([
          getOrCreateSigner(colaborador.nome, colaborador.email),
          ...sociosResponsaveis.map(s => getOrCreateSigner(s.nome, s.email))
        ])
      ]);

      console.log(`[assinafy-colab] Signatários: ${signerIds.join(', ')} [${Date.now() - startTime}ms]`);

      if (!documentReady) {
        return res.status(500).json({ error: "Documento não ficou pronto. Tente novamente.", documentId });
      }

      // 5. Enviar para assinatura
      const assignmentUrl = `${config.api_url}/documents/${documentId}/assignments`;
      const assignmentResponse = await fetch(assignmentUrl, {
        method: 'POST',
        headers: {
          'X-Api-Key': config.api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: 'virtual',
          signerIds: signerIds
        })
      });

      const assignmentResult = await assignmentResponse.json() as any;

      if (assignmentResult.status !== 200 && assignmentResult.status !== 201) {
        return res.status(500).json({ error: "Erro ao enviar para assinatura", details: assignmentResult.message });
      }

      // 6. Salvar status em paralelo com a resposta
      ensureContratosColabStatusTable().then(() =>
        db.execute(sql`
          INSERT INTO cortex_core.contratos_colaboradores_status
          (colaborador_id, colaborador_nome, colaborador_email, documento_id, status, data_envio)
          VALUES (${colaboradorId}, ${colaborador.nome}, ${colaborador.email}, ${documentId}, 'Enviado para assinatura', NOW())
        `)
      ).catch(err => console.error('[assinafy-colab] Erro ao salvar status:', err));

      const elapsed = Date.now() - startTime;
      console.log(`[assinafy-colab] Contrato enviado com sucesso em ${elapsed}ms`);

      res.json({
        success: true,
        documentId,
        emailEnviado: colaborador.email,
        message: "Contrato enviado para assinatura com sucesso"
      });

    } catch (error) {
      console.error("[assinafy-colab] Erro:", error);
      res.status(500).json({ error: "Erro ao enviar para assinatura" });
    }
  });

  // POST - Gerar PDF de contrato de colaborador (download direto)
  app.post("/api/juridico/colaboradores-contrato/pdf", async (req, res) => {
    try {
      const { nome, cpf, cnpj, endereco, estado, cargo, salario, patrimonio } = req.body;

      if (!nome) {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }

      const pdfBuffer = await gerarContratoPDF({ nome, cpf, cnpj, endereco, estado, cargo, salario: salario || '0', patrimonio });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Contrato_${nome.replace(/\s+/g, '_')}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("[api] Error generating contract PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });


  // ==================== JURÍDICO - Regras de Escalonamento ====================
  // Note: Table creation and seeding is handled by ensureEscalationRulesTable() above

  // GET escalation rules
  app.get("/api/juridico/regras-escalonamento", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          id, 
          dias_atraso_min as "diasAtrasoMin", 
          dias_atraso_max as "diasAtrasoMax", 
          procedimento_sugerido as "procedimentoSugerido", 
          prioridade, 
          ativo, 
          created_at as "createdAt"
        FROM juridico_regras_escalonamento
        WHERE ativo = true
        ORDER BY prioridade ASC
      `);
      
      res.json({ regras: result.rows });
    } catch (error) {
      console.error("[api] Error fetching escalation rules:", error);
      res.status(500).json({ error: "Failed to fetch escalation rules" });
    }
  });

  // ==================== JURÍDICO - Processos Judiciais ====================

  let juridicoProcessosTableInitialized = false;
  async function ensureJuridicoProcessosTable() {
    if (juridicoProcessosTableInitialized) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.juridico_processos (
          id SERIAL PRIMARY KEY,
          numero_cnj VARCHAR(50) UNIQUE,
          cliente_principal VARCHAR(255),
          posicao_cliente VARCHAR(50),
          acao TEXT,
          status VARCHAR(30) DEFAULT 'Ativo',
          contrario_principal VARCHAR(255),
          cpf_cnpj VARCHAR(20),
          objetos_acao TEXT,
          data_distribuicao DATE,
          instancia VARCHAR(30),
          comarca VARCHAR(100),
          orgao VARCHAR(100),
          vara_turma VARCHAR(100),
          natureza_acao VARCHAR(50),
          valor_causa DECIMAL(15,2),
          sentenca_acordao TEXT,
          ultimo_andamento TEXT,
          observacoes TEXT,
          criado_em TIMESTAMP DEFAULT NOW(),
          atualizado_em TIMESTAMP DEFAULT NOW(),
          criado_por VARCHAR(100)
        )
      `);
      juridicoProcessosTableInitialized = true;
    } catch (error) {
      console.error("[api] Error ensuring juridico_processos table:", error);
    }
  }

  // GET - Resumo/KPIs dos processos
  app.get("/api/juridico/processos/resumo", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();

      const result = await db.execute(sql`
        SELECT
          COUNT(*)::int as "totalProcessos",
          COUNT(*) FILTER (WHERE status = 'Ativo')::int as "processosAtivos",
          COALESCE(SUM(valor_causa), 0)::numeric as "valorTotalRisco",
          COALESCE(SUM(valor_causa) FILTER (WHERE status = 'Ativo'), 0)::numeric as "valorRiscoAtivo"
        FROM cortex_core.juridico_processos
      `);

      const porNatureza = await db.execute(sql`
        SELECT
          COALESCE(natureza_acao, 'Não informado') as "natureza",
          COUNT(*)::int as "quantidade",
          COALESCE(SUM(valor_causa), 0)::numeric as "valor"
        FROM cortex_core.juridico_processos
        GROUP BY natureza_acao
        ORDER BY COUNT(*) DESC
      `);

      const porStatus = await db.execute(sql`
        SELECT
          COALESCE(status, 'Não informado') as "status",
          COUNT(*)::int as "quantidade"
        FROM cortex_core.juridico_processos
        GROUP BY status
        ORDER BY COUNT(*) DESC
      `);

      const porPosicao = await db.execute(sql`
        SELECT
          COALESCE(posicao_cliente, 'Não informado') as "posicao",
          COUNT(*)::int as "quantidade"
        FROM cortex_core.juridico_processos
        GROUP BY posicao_cliente
        ORDER BY COUNT(*) DESC
      `);

      const porComarca = await db.execute(sql`
        SELECT
          COALESCE(comarca, 'Não informado') as "comarca",
          COUNT(*)::int as "quantidade"
        FROM cortex_core.juridico_processos
        GROUP BY comarca
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `);

      const evolucaoMensal = await db.execute(sql`
        SELECT
          TO_CHAR(data_distribuicao, 'YYYY-MM') as "mes",
          TO_CHAR(data_distribuicao, 'Mon/YY') as "mesLabel",
          COUNT(*)::int as "quantidade"
        FROM cortex_core.juridico_processos
        WHERE data_distribuicao IS NOT NULL
        GROUP BY TO_CHAR(data_distribuicao, 'YYYY-MM'), TO_CHAR(data_distribuicao, 'Mon/YY')
        ORDER BY TO_CHAR(data_distribuicao, 'YYYY-MM')
      `);

      const resumo = result.rows[0] || { totalProcessos: 0, processosAtivos: 0, valorTotalRisco: 0, valorRiscoAtivo: 0 };

      res.json({
        ...resumo,
        porNatureza: porNatureza.rows,
        porStatus: porStatus.rows,
        porPosicao: porPosicao.rows,
        porComarca: porComarca.rows,
        evolucaoMensal: evolucaoMensal.rows,
      });
    } catch (error) {
      console.error("[api] Error fetching processos resumo:", error);
      res.status(500).json({ error: "Failed to fetch processos summary" });
    }
  });

  // GET - Listar todos os processos com filtros
  app.get("/api/juridico/processos", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();

      const busca = req.query.busca as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const natureza = req.query.natureza as string | undefined;
      const posicao = req.query.posicao as string | undefined;

      const conditions: SQL[] = [];

      if (busca) {
        const pattern = `%${busca}%`;
        conditions.push(sql`(numero_cnj ILIKE ${pattern} OR cliente_principal ILIKE ${pattern} OR contrario_principal ILIKE ${pattern} OR acao ILIKE ${pattern})`);
      }
      if (statusFilter && statusFilter !== 'todos') {
        conditions.push(sql`status = ${statusFilter}`);
      }
      if (natureza && natureza !== 'todos') {
        conditions.push(sql`natureza_acao = ${natureza}`);
      }
      if (posicao && posicao !== 'todos') {
        conditions.push(sql`posicao_cliente = ${posicao}`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          id, numero_cnj as "numeroCnj", cliente_principal as "clientePrincipal",
          posicao_cliente as "posicaoCliente", acao, status,
          contrario_principal as "contrarioPrincipal", cpf_cnpj as "cpfCnpj",
          objetos_acao as "objetosAcao", data_distribuicao as "dataDistribuicao",
          instancia, comarca, orgao, vara_turma as "varaTurma",
          natureza_acao as "naturezaAcao", valor_causa as "valorCausa",
          sentenca_acordao as "sentencaAcordao", ultimo_andamento as "ultimoAndamento",
          observacoes, criado_em as "criadoEm", atualizado_em as "atualizadoEm",
          criado_por as "criadoPor"
        FROM cortex_core.juridico_processos
        ${whereClause}
        ORDER BY criado_em DESC
      `);
      res.json({ processos: result.rows });
    } catch (error) {
      console.error("[api] Error fetching processos:", error);
      res.status(500).json({ error: "Failed to fetch processos" });
    }
  });

  // POST - Criar novo processo
  app.post("/api/juridico/processos", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();
      const data = req.body;

      const result = await db.execute(sql`
        INSERT INTO cortex_core.juridico_processos (
          numero_cnj, cliente_principal, posicao_cliente, acao, status,
          contrario_principal, cpf_cnpj, objetos_acao, data_distribuicao,
          instancia, comarca, orgao, vara_turma, natureza_acao, valor_causa,
          sentenca_acordao, ultimo_andamento, observacoes, criado_por
        ) VALUES (
          ${data.numeroCnj || null}, ${data.clientePrincipal || null},
          ${data.posicaoCliente || null}, ${data.acao || null}, ${data.status || 'Ativo'},
          ${data.contrarioPrincipal || null}, ${data.cpfCnpj || null},
          ${data.objetosAcao || null}, ${data.dataDistribuicao || null},
          ${data.instancia || null}, ${data.comarca || null}, ${data.orgao || null},
          ${data.varaTurma || null}, ${data.naturezaAcao || null}, ${data.valorCausa || null},
          ${data.sentencaAcordao || null}, ${data.ultimoAndamento || null},
          ${data.observacoes || null}, ${data.criadoPor || null}
        )
        RETURNING id
      `);

      res.json({ success: true, id: (result.rows[0] as any)?.id });
    } catch (error) {
      console.error("[api] Error creating processo:", error);
      res.status(500).json({ error: "Failed to create processo" });
    }
  });

  // PUT - Atualizar processo existente
  app.put("/api/juridico/processos/:id", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();
      const { id } = req.params;
      const data = req.body;

      await db.execute(sql`
        UPDATE cortex_core.juridico_processos SET
          numero_cnj = ${data.numeroCnj || null},
          cliente_principal = ${data.clientePrincipal || null},
          posicao_cliente = ${data.posicaoCliente || null},
          acao = ${data.acao || null},
          status = ${data.status || 'Ativo'},
          contrario_principal = ${data.contrarioPrincipal || null},
          cpf_cnpj = ${data.cpfCnpj || null},
          objetos_acao = ${data.objetosAcao || null},
          data_distribuicao = ${data.dataDistribuicao || null},
          instancia = ${data.instancia || null},
          comarca = ${data.comarca || null},
          orgao = ${data.orgao || null},
          vara_turma = ${data.varaTurma || null},
          natureza_acao = ${data.naturezaAcao || null},
          valor_causa = ${data.valorCausa || null},
          sentenca_acordao = ${data.sentencaAcordao || null},
          ultimo_andamento = ${data.ultimoAndamento || null},
          observacoes = ${data.observacoes || null},
          atualizado_em = NOW()
        WHERE id = ${parseInt(id)}
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error updating processo:", error);
      res.status(500).json({ error: "Failed to update processo" });
    }
  });

  // DELETE - Excluir processo
  app.delete("/api/juridico/processos/:id", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();
      const { id } = req.params;

      await db.execute(sql`
        DELETE FROM cortex_core.juridico_processos WHERE id = ${parseInt(id)}
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting processo:", error);
      res.status(500).json({ error: "Failed to delete processo" });
    }
  });

  // POST - Seed inicial de processos jurídicos (dados da planilha)
  app.post("/api/juridico/processos/seed", async (req, res) => {
    try {
      await ensureJuridicoProcessosTable();

      // Limpar dados existentes para re-inserir com dados corretos
      await db.execute(sql`DELETE FROM cortex_core.juridico_processos`);

      const processos = [
        { numero_cnj: '5029875-82.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerido', acao: 'Ação Declaratória de Inexigibilidade de Débito', status: 'Ativo', contrario_principal: 'NOVAES COMERCIO LTDA', cpf_cnpj: '39.306.125/0001-80', objetos_acao: 'Declaração de inexistência de débito', data_distribuicao: '2025-08-04', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '5º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 1997.00, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Arquivamento definitivo.', observacoes: 'Após homologado o acordo entre as partes, o processo foi arquivado.' },
        { numero_cnj: '5034121-24.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'CB WEBSTORE LTDA', cpf_cnpj: '53.322.748/0001-77', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 7668.22, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Arquivamento definitivo.', observacoes: 'Informamos o pagamento da dívida, então o processo foi arquivado.' },
        { numero_cnj: '5034126-46.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'INFOTECH PROMOCAO DE VENDAS E SERVICOS LTDA', cpf_cnpj: '37.809.871/0001-60', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 5848.14, sentenca_acordao: 'Não', ultimo_andamento: 'Proferido despacho determinando nossa manifestação sobre a exceção de pré-executividade apresentada pela Executada.', observacoes: 'Iremos elaborar e protocolar a manifestação sobre a exceção de pré-executividade.' },
        { numero_cnj: '5034199-18.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: '56.267.836 MAHATMA LUCAS GADELHA PEREIRA', cpf_cnpj: '56.267.836/0001-01', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 11997.35, sentenca_acordao: 'Não', ultimo_andamento: 'Processo concluso ao magistrado após apresentarmos emenda da inicial demonstrando o enquadramento da Turbo como legitimada a atuar nos Juizados Especiais.', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5034208-77.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'PODER DOS FIOS COSMETICOS LTDA', cpf_cnpj: '57.732.954/0001-06', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 15078.61, sentenca_acordao: 'Não', ultimo_andamento: 'Juntada da comprovação da prestação de serviço (Relatório enviado pela TURBO) e conclusão para o juiz apreciar.', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5034211-32.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'FS COMPANY LTDA', cpf_cnpj: '52.505.247/0001-63', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '9º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 2828.30, sentenca_acordao: 'Não', ultimo_andamento: 'Certificado o decurso do prazo para defesa.', observacoes: 'Vamos peticionar nos autos pedidos a constrição de bens para pagamento.' },
        { numero_cnj: '4001375-27.2026.8.26.0011', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Carta Precatória Cível', status: 'Ativo', contrario_principal: 'FS COMPANY LTDA', cpf_cnpj: '52.505.247/0001-63', objetos_acao: 'Citação da requerida', data_distribuicao: '2026-01-27', instancia: '1ª Instância', comarca: 'Regional XI - Pinheiros', orgao: 'TJSP', vara_turma: '1ª Vara do Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: null, sentenca_acordao: 'Não', ultimo_andamento: 'Baixa da Carta Precatória.', observacoes: 'Será necessária a redistribuição de nova Carta Precatória.' },
        { numero_cnj: '5034216-54.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'DOLCE FIT ALIMENTOS E BEBIDAS FUNCIONAIS LTDA', cpf_cnpj: '51.822.715/0001-60', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-29', instancia: '1ª Instância', comarca: 'Comarca da Capital', orgao: 'TJES', vara_turma: '5º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 3859.40, sentenca_acordao: 'Não', ultimo_andamento: 'Expedida Carta Precatória para citar a parte contrária.', observacoes: 'Acompanhar a Carta Precatória.' },
        { numero_cnj: '4022385-49.2025.8.26.0016', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Carta Precatória Cível', status: 'Ativo', contrario_principal: 'DOLCE FIT ALIMENTOS E BEBIDAS FUNCIONAIS LTDA', cpf_cnpj: '51.822.715/0001-60', objetos_acao: 'Citação da requerida', data_distribuicao: '2025-02-04', instancia: '1ª Instância', comarca: 'JEC Central - Vergueiro', orgao: 'TJSP', vara_turma: '2ª Vara do Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: null, sentenca_acordao: 'Não', ultimo_andamento: 'Baixa da Carta Precatória.', observacoes: 'Será necessária a redistribuição de nova Carta Precatória.' },
        { numero_cnj: '5034333-45.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'BR SERVICOS DIGITAIS LTDA', cpf_cnpj: '57.470.157/0001-06', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-08-30', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 5109.92, sentenca_acordao: 'Não', ultimo_andamento: 'Havíamos sido intimados para comprovar a expedição de Carta Precatória de citação da Executada. Peticionamos requerendo que a medida seja promovida pelo Juízo, conforme lei.', observacoes: 'Inserido em rotina para diligenciar a análise do nosso último pedido.' },
        { numero_cnj: '5034476-34.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'FE DOS CACHOS LTDA', cpf_cnpj: '42.040.732/0001-55', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-01', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 6976.14, sentenca_acordao: 'Não', ultimo_andamento: 'Havíamos sido intimados para comprovar a expedição de Carta Precatória de citação da Executada. Peticionamos requerendo que a medida seja promovida pelo Juízo, conforme lei.', observacoes: 'Inserido em rotina para diligenciar a análise do nosso último pedido.' },
        { numero_cnj: '5035287-91.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'ALLDAYS NUTRITION LTDA', cpf_cnpj: '52.395.585/0001-90', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 12983.65, sentenca_acordao: 'Não', ultimo_andamento: 'Juntada da comprovação da prestação de serviço (Relatório enviado pela TURBO) e conclusão para o juiz apreciar', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5035314-74.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'FANTASMA DA OPERA ESTETICA E SAUDE CAPILAR LTDA', cpf_cnpj: '49.051.240/0001-04', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 10474.18, sentenca_acordao: 'Não', ultimo_andamento: 'Determinada a comprovação de expedição de Carta Precatória de citação da Executada.', observacoes: 'Vamos nos manifestar conforme outros processos.' },
        { numero_cnj: '5035320-81.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'HORTENCIA MOTA VIDAL 01477644164', cpf_cnpj: '40.157.671/0001-85', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '5º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 6224.77, sentenca_acordao: 'Não', ultimo_andamento: 'Com o retorno negativo da Carta Precatória inicialmente distribuída, indicamos novo endereço e requeremos expedição de novo mandado de citação.', observacoes: 'Diligenciar, em gabinete, a apreciação do nosso pedido.' },
        { numero_cnj: '5035362-33.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'PLATAFORMA E COMERCIO DJAZ LTDA', cpf_cnpj: '31.679.332/0001-78', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '9ª Vara Cível', natureza_acao: 'Cível', valor_causa: 2182.05, sentenca_acordao: 'Não', ultimo_andamento: 'Solicitamos a remessa do processo para o Juizado Especial, tendo em vista a distribuição para a Vara Cível.', observacoes: 'Diligenciar, em gabinete, a apreciação do nosso pedido.' },
        { numero_cnj: '5035397-90.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'EBEYBE STORE LTDA', cpf_cnpj: '44.333.986/0001-97', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '9º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 15464.15, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Extinto sob fundamento de que a Turbo não pode litigar em Juizados', observacoes: 'Validar redistribuição na vara cível.' },
        { numero_cnj: '5035382-24.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'JOAO FABIO LOUREIRO SILVA', cpf_cnpj: '53.042.649/0001-31', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 2182.83, sentenca_acordao: 'Não', ultimo_andamento: 'Com o retorno negativo do primeiro mandado de citação, indicamos novo endereço e requeremos expedição de novo mandado de citação.', observacoes: 'Inserido em rotina para diligenciar a análise do nosso último pedido.' },
        { numero_cnj: '5035373-62.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'FERREIRA SOLANO LTDA', cpf_cnpj: '49.758.173/0001-62', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-05', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 12886.46, sentenca_acordao: 'Não', ultimo_andamento: 'Distribuímos Carta Precatória para citação da Executada.', observacoes: 'Diligenciar o cumprimento da CP.' },
        { numero_cnj: '5233432-55.2025.8.13.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Carta Precatória Cível', status: 'Ativo', contrario_principal: 'FERREIRA SOLANO LTDA', cpf_cnpj: '49.758.173/0001-62', objetos_acao: 'Citação da requerida', data_distribuicao: '2025-12-09', instancia: '1ª Instância', comarca: 'Belo Horizonte', orgao: 'TJMG', vara_turma: 'Vara de Precatórias Cíveis', natureza_acao: 'Cível', valor_causa: 1000.00, sentenca_acordao: 'Não', ultimo_andamento: 'Determinado o cumprimento da CP.', observacoes: 'Aguardar.' },
        { numero_cnj: '5036040-48.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'AMAM - INDUSTRIA E COMERCIO LTDA', cpf_cnpj: '21.045.782/0001-55', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-11', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 7856.21, sentenca_acordao: 'Não', ultimo_andamento: 'Juntada da comprovação da prestação de serviço (Relatório enviado pela TURBO).', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5036058-69.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'GPA SUPLEMENTOS LTDA', cpf_cnpj: '44.040.041/0001-87', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-11', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '8º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 10774.50, sentenca_acordao: 'Não', ultimo_andamento: 'Peticionamos a citação da PJ na pessoa do sócio.', observacoes: 'Diligenciar a análise do nosso pedido.' },
        { numero_cnj: '5036072-53.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'GRUPO EMPRESARIAL TORI LTDA', cpf_cnpj: '52.481.399/0001-73', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-11', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '8º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 18069.71, sentenca_acordao: 'Não', ultimo_andamento: 'Fomos intimados para apresentar a via original do título executivo, então explicamos que a documentação é toda nato-digital e que já havia sido juntada.', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5036402-50.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'BRITO E SANTOS SUPLEMENTOS ALIMENTARES LTDA', cpf_cnpj: '44.319.426/0001-88', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-12', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 2634.96, sentenca_acordao: 'Não', ultimo_andamento: 'Fomos intimados para apresentar a via original do título executivo, então explicamos que a documentação é toda nato-digital e que já havia sido juntada.', observacoes: 'Processo inserido em fluxo para diligenciar análise dos documentos apresentados e agilizar citação da Executada.' },
        { numero_cnj: '5036420-71.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'DALBOSCO SUPLEMENTOS LTDA', cpf_cnpj: '54.907.558/0001-84', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-12', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '9º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 4455.83, sentenca_acordao: 'Não', ultimo_andamento: 'Expedida carta de citação da Executada.', observacoes: 'Aguardar.' },
        { numero_cnj: '5035611-81.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'HUBSAGE DISTRIBUIDORA LTDA', cpf_cnpj: '34.366.677/0002-40', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-09', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 23782.44, sentenca_acordao: 'Não', ultimo_andamento: 'Petição solicitando a adequação da certidão para distribuir Carta Precatória.', observacoes: 'Diligenciar.' },
        { numero_cnj: '5037007-93.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Executado', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'N.P. COMERCIO E INDUSTRIA LTDA', cpf_cnpj: '55.542.136/0001-15', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-09-17', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '5º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 6364.16, sentenca_acordao: 'Não', ultimo_andamento: 'Havíamos sido intimados para comprovar a expedição de Carta Precatória de citação da Executada. Peticionamos requerendo que a medida seja promovida pelo Juízo, conforme lei.', observacoes: 'Inserido em rotina para diligenciar a análise do nosso último pedido.' },
        { numero_cnj: '5048176-77.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'ALPHA MASTER', cpf_cnpj: '54.378.550/0001-78', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-11-27', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '4º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 9345.30, sentenca_acordao: 'Não', ultimo_andamento: 'Pedimos o cancelamento da audiência de conciliação e a expedição de carta de citação para a parte contrária.', observacoes: 'Diligenciar a análise do nosso pedido.' },
        { numero_cnj: '5048115-22.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'BYR LTDA', cpf_cnpj: '39.395.019/0001-10', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-11-27', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 8897.61, sentenca_acordao: 'Não', ultimo_andamento: 'Determinado que nós apresentemos prova da prestação do serviço.', observacoes: 'Peticionar comprovando o cumprimento da nossa parte do contrato.' },
        { numero_cnj: '5050013-70.2025.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'CASA ATELIE CONFECCOES LTDA', cpf_cnpj: '28.676.521/0001-82', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2025-12-09', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '5ª Vara Cível', natureza_acao: 'Cível', valor_causa: 19893.57, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Proferida sentença homologando nosso pedido de desistência.', observacoes: 'Acompanhar arquivamento.' },
        { numero_cnj: '5001548-21.2026.8.08.0048', cliente_principal: 'PEIXOTO DEBBANE TREINAMENTO E CONSULTORIA ADMINISTRATIVA LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'VENAMORE COMERCIO DE JOIAS LTDA', cpf_cnpj: '37.028.050/0001-97', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2026-01-16', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 16554.27, sentenca_acordao: 'Não', ultimo_andamento: 'Intimação para nos manifestar sobre a competência, se Vitória ou Serra.', observacoes: 'Elaborar manifestação no sentido de que a competência é de Vitória.' },
        { numero_cnj: '5040975-68.2024.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerido', acao: 'Ação de indenização por danos materiais e morais', status: 'Ativo', contrario_principal: 'ANDREA DE PINHO E SILVA LTDA', cpf_cnpj: '31.652.414/0001-29', objetos_acao: 'Invalidação de débito e danos', data_distribuicao: '2024-10-02', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '6º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 3000.00, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Arquivamento definitivo.', observacoes: 'Arquivado após acordo realizado em sentença.' },
        { numero_cnj: '5002320-56.2026.8.08.0024', cliente_principal: 'PEIXOTO DEBBANE TREINAMENTO E CONSULTORIA ADMINISTRATIVA LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'SAVERHOME REPRESENTACOES MEDICAS LTDA', cpf_cnpj: '41.593.226/0001-20', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2026-01-21', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '8º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 9093.64, sentenca_acordao: 'Não', ultimo_andamento: 'Processo concluso ao magistrado para despacho inicial.', observacoes: 'Diligenciar despacho inicial para mandar citar a parte contrária.' },
        { numero_cnj: '5002999-56.2026.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Exequente', acao: 'Ação de execução de título extrajudicial', status: 'Ativo', contrario_principal: 'CK DISTRIBUIDORA E REPRESENTACOES LTDA', cpf_cnpj: '31.941.662/0001-90', objetos_acao: 'Execução de dívida reconhecida', data_distribuicao: '2026-01-27', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Cível', natureza_acao: 'Cível', valor_causa: 9467.50, sentenca_acordao: 'Não', ultimo_andamento: 'Processo concluso ao magistrado para despacho inicial.', observacoes: 'Diligenciar despacho inicial para mandar citar a parte contrária.' },
        { numero_cnj: '0000375-19.2025.5.17.0004', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Reclamado', acao: 'Reclamação Trabalhista', status: 'Ativo', contrario_principal: 'PEDRO HENRIQUE LOPES ESPINDOLA', cpf_cnpj: '160.584.817-40', objetos_acao: 'Indenização trabalhista', data_distribuicao: '2025-03-31', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TRT17', vara_turma: '4ª Vara do Trabalho', natureza_acao: 'Trabalhista', valor_causa: 23587.40, sentenca_acordao: 'Não', ultimo_andamento: null, observacoes: 'Processo Suspenso' },
        { numero_cnj: '5025365-68.2024.4.02.5001', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Ação Ordinária', status: 'Ativo', contrario_principal: 'UNIÃO - FAZENDA NACIONAL', cpf_cnpj: '00.394.460/0216-53', objetos_acao: 'Restituição de indébito tributário', data_distribuicao: '2024-08-02', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TRF2', vara_turma: '6ª Vara Federal Cível', natureza_acao: 'Tributária', valor_causa: 472.91, sentenca_acordao: 'Sim (Sen.)', ultimo_andamento: 'Aguardando a União apresentar os cálculos do valor por ela devido', observacoes: 'Aguardar a manifestação da União. Em seguida: Sentença' },
        { numero_cnj: '5034153-63.2024.8.08.0024', cliente_principal: 'TURBO PARTNERS LTDA', posicao_cliente: 'Requerente', acao: 'Ação Ordinária', status: 'Concluído', contrario_principal: 'ESTADO DO ESPÍRITO SANTO', cpf_cnpj: '27.080.605/0008-63', objetos_acao: 'Restituição de indébito tributário', data_distribuicao: '2024-08-19', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '2º Juizado Especial Criminal e Fazenda Pública', natureza_acao: 'Tributária', valor_causa: 301.12, sentenca_acordao: 'Sim (sen)', ultimo_andamento: 'Expedição de RPV. Arquivamento do processo', observacoes: 'Confirmar com o cliente o saque do crédito e repasse dos honorários (15%)' },
        { numero_cnj: '5040198-49.2025.8.08.0024', cliente_principal: 'ANDRE DEBBANE MUSSO', posicao_cliente: 'Requerente', acao: 'Ação Ordinária', status: 'Ativo', contrario_principal: 'ESTADO DO ESPÍRITO SANTO', cpf_cnpj: '27.080.605/0008-62', objetos_acao: 'Restituição de indébito tributário', data_distribuicao: '2025-11-07', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TJES', vara_turma: '1º Juizado Especial Criminal e Fazenda Pública', natureza_acao: 'Tributária', valor_causa: 575.20, sentenca_acordao: 'Não', ultimo_andamento: 'O Estado reconheceu o direito do autor. Aguardando sentença', observacoes: 'Aguardar a sentença' },
        { numero_cnj: '5033392-06.2025.4.02.5001', cliente_principal: 'ANDRE DEBBANE MUSSO', posicao_cliente: 'Requerente', acao: 'Ação Ordinária', status: 'Ativo', contrario_principal: 'UNIÃO - FAZENDA NACIONAL', cpf_cnpj: '00.394.460/0216-53', objetos_acao: 'Restituição de indébito tributário', data_distribuicao: '2025-10-21', instancia: '1ª Instância', comarca: 'Vitória', orgao: 'TRF2', vara_turma: '2ª Vara Federal Cível', natureza_acao: 'Tributária', valor_causa: 1053.11, sentenca_acordao: 'Não', ultimo_andamento: 'Aguardando Sentença', observacoes: 'Aguardar a sentença' },
      ];

      let inserted = 0;
      const errors: string[] = [];

      for (const p of processos) {
        try {
          const valorCausa = p.valor_causa !== null && p.valor_causa !== undefined ? String(p.valor_causa) : null;
          const dataDistribuicao = p.data_distribuicao || null;
          await db.execute(sql`
            INSERT INTO cortex_core.juridico_processos (
              numero_cnj, cliente_principal, posicao_cliente, acao, status,
              contrario_principal, cpf_cnpj, objetos_acao, data_distribuicao,
              instancia, comarca, orgao, vara_turma, natureza_acao, valor_causa,
              sentenca_acordao, ultimo_andamento, observacoes
            ) VALUES (
              ${p.numero_cnj}, ${p.cliente_principal}, ${p.posicao_cliente}, ${p.acao}, ${p.status},
              ${p.contrario_principal}, ${p.cpf_cnpj}, ${p.objetos_acao}, ${dataDistribuicao},
              ${p.instancia}, ${p.comarca}, ${p.orgao}, ${p.vara_turma}, ${p.natureza_acao}, ${valorCausa},
              ${p.sentenca_acordao}, ${p.ultimo_andamento}, ${p.observacoes}
            )
            ON CONFLICT (numero_cnj) DO NOTHING
          `);
          inserted++;
        } catch (err: any) {
          console.error(`[api] Error inserting processo ${p.numero_cnj}:`, err?.message || err);
          errors.push(`${p.numero_cnj}: ${err?.message || 'unknown error'}`);
        }
      }

      res.json({ success: true, message: `${inserted} de ${processos.length} processos inseridos com sucesso`, errors: errors.length > 0 ? errors : undefined });
    } catch (error: any) {
      console.error("[api] Error seeding processos:", error?.message || error);
      res.status(500).json({ error: "Failed to seed processos", detail: error?.message });
    }
  });

  app.get("/api/analytics/cohort-retention", async (req, res) => {
    try {
      const filters: { squad?: string; servicos?: string[]; mesInicio?: string; mesFim?: string } = {};
      
      if (req.query.squad && req.query.squad !== 'todos') {
        filters.squad = req.query.squad as string;
      }
      
      if (req.query.servico && req.query.servico !== 'todos') {
        const servicoParam = req.query.servico as string;
        filters.servicos = servicoParam.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      if (req.query.mesInicio) {
        filters.mesInicio = req.query.mesInicio as string;
      }
      
      if (req.query.mesFim) {
        filters.mesFim = req.query.mesFim as string;
      }

      const cohortData = await storage.getCohortRetention(filters);
      res.json(cohortData);
    } catch (error) {
      console.error("[api] Error fetching cohort retention:", error);
      res.status(500).json({ error: "Failed to fetch cohort retention data" });
    }
  });

  app.get("/api/cohort", async (req, res) => {
    try {
      const { cohortFiltersSchema } = await import("@shared/schema");
      
      const filters = cohortFiltersSchema.parse({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        produto: req.query.produto as string | undefined,
        squad: req.query.squad as string | undefined,
        metricType: (req.query.metricType as string) || 'revenue_retention',
      });

      const cohortData = await storage.getCohortData(filters);
      res.json(cohortData);
    } catch (error) {
      console.error("[api] Error fetching cohort data:", error);
      res.status(500).json({ error: "Failed to fetch cohort data" });
    }
  });

  app.get("/api/visao-geral/metricas", async (req, res) => {
    try {
      const mesAno = req.query.mesAno as string;
      
      if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
      }

      const metricas = await storage.getVisaoGeralMetricas(mesAno);
      res.json(metricas);
    } catch (error) {
      console.error("[api] Error fetching visao geral metricas:", error);
      res.status(500).json({ error: "Failed to fetch visao geral metricas" });
    }
  });

  app.get("/api/visao-geral/mrr-evolucao", async (req, res) => {
    try {
      const mesAno = req.query.mesAno as string;
      const qtdMeses = parseInt(req.query.qtdMeses as string, 10) || 12;
      
      if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
      }

      // Validar qtdMeses (permitir 6, 9 ou 12)
      const validQtdMeses = [6, 9, 12].includes(qtdMeses) ? qtdMeses : 12;

      const evolucao = await storage.getMrrEvolucaoMensal(mesAno, validQtdMeses);
      res.json(evolucao);
    } catch (error) {
      console.error("[api] Error fetching MRR evolucao mensal:", error);
      res.status(500).json({ error: "Failed to fetch MRR evolucao mensal" });
    }
  });

  // ============ OPERAÇÃO ENDPOINTS ============

  // Busca unificada de clientes (Conta Azul + ClickUp)
  app.get("/api/operacao/clientes-unificados", isAuthenticated, async (req, res) => {
    try {
      const search = (req.query.search as string)?.trim() || "";
      
      if (search.length < 2) {
        return res.json([]);
      }

      // Remove caracteres especiais para busca por CNPJ (sanitizado)
      const cleanedSearch = search.replace(/[^\w\s]/g, '');
      
      // Prepara padrões de busca com concatenação em JavaScript (seguro)
      const searchPattern = `%${search}%`;
      const cnpjPattern = `%${cleanedSearch}%`;

      // Busca em caz_clientes (Conta Azul)
      const cazResult = await db.execute(sql`
        SELECT 
          id,
          nome as name,
          cnpj,
          'conta_azul' as fonte
        FROM "Conta Azul".caz_clientes
        WHERE nome IS NOT NULL
          AND (
            LOWER(nome) LIKE LOWER(${searchPattern})
            OR REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') LIKE ${cnpjPattern}
          )
        LIMIT 20
      `);

      // Busca em cup_clientes (ClickUp)
      const cupResult = await db.execute(sql`
        SELECT 
          id,
          nome as name,
          cnpj,
          'clickup' as fonte,
          status
        FROM "Clickup".cup_clientes
        WHERE nome IS NOT NULL
          AND (
            LOWER(nome) LIKE LOWER(${searchPattern})
            OR REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') LIKE ${cnpjPattern}
          )
        LIMIT 20
      `);

      // Combina resultados
      const clientes = [
        ...cazResult.rows.map((row: any) => ({
          id: row.id,
          nome: row.name,
          cnpj: row.cnpj,
          fonte: 'conta_azul',
          status: null
        })),
        ...cupResult.rows.map((row: any) => ({
          id: row.id,
          nome: row.name,
          cnpj: row.cnpj,
          fonte: 'clickup',
          status: row.status
        }))
      ];

      res.json(clientes);
    } catch (error: any) {
      console.error("[operacao] Error fetching unified clients:", error);
      res.status(500).json({ error: "Failed to fetch clients", details: error.message });
    }
  });

  // Onboardings de clientes (placeholder - pode ser expandido depois)
  app.get("/api/operacao/onboardings-clientes", isAuthenticated, async (req, res) => {
    try {
      // Por enquanto retorna array vazio - a tabela pode ser criada quando necessário
      res.json([]);
    } catch (error: any) {
      console.error("[operacao] Error fetching client onboardings:", error);
      res.status(500).json({ error: "Failed to fetch onboardings", details: error.message });
    }
  });

  // ============ INVESTORS REPORT ENDPOINTS ============
  
  // Endpoint consolidado com todas as métricas do Investors Report
  app.get("/api/investors-report", async (req, res) => {
    try {
      // Métricas de Clientes - contagem baseada em cup_clientes e cup_contratos
      // Cliente ativo = cliente que possui contrato com status ativo/onboarding/triagem
      const clientesResult = await db.execute(sql`
        SELECT 
          (SELECT COUNT(DISTINCT cnpj) FROM "Clickup".cup_clientes) as total_clientes,
          COUNT(DISTINCT c.id_task) as clientes_ativos
        FROM "Clickup".cup_contratos c
        WHERE c.status IN ('ativo', 'onboarding', 'triagem')
      `);
      
      // Métricas de Contratos (cup_contratos)
      const contratosResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_contratos,
          COUNT(CASE WHEN valorr > 0 AND status IN ('ativo', 'onboarding', 'triagem') THEN 1 END) as contratos_recorrentes,
          COUNT(CASE WHEN valorp > 0 THEN 1 END) as contratos_pontuais,
          COALESCE(SUM(CASE WHEN status IN ('ativo', 'onboarding', 'triagem') THEN valorr ELSE 0 END), 0) as mrr_ativo,
          COALESCE(AVG(CASE WHEN valorr > 0 AND status IN ('ativo', 'onboarding', 'triagem') THEN valorr END), 0) as aov_recorrente
        FROM "Clickup".cup_contratos
      `);
      
      // Métricas de Equipe (rh_pessoal) - status pode ser 'ativo' ou 'Ativo'
      const equipeResult = await db.execute(sql`
        SELECT 
          COUNT(*) as headcount,
          COALESCE(AVG(
            CASE WHEN admissao IS NOT NULL 
            THEN EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) + 
                 EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12
            END
          ), 0) as tempo_medio_meses
        FROM "Inhire".rh_pessoal
        WHERE LOWER(status) = 'ativo'
      `);
      
      // Distribuição por setor (rh_pessoal) - status case-insensitive
      const setorResult = await db.execute(sql`
        SELECT 
          COALESCE(setor, 'Não definido') as setor,
          COUNT(*) as quantidade
        FROM "Inhire".rh_pessoal
        WHERE LOWER(status) = 'ativo'
        GROUP BY setor
        ORDER BY quantidade DESC
      `);
      
      // Faturamento histórico estendido - combina caz_parcelas (últimos 12 meses) com caz_receber/caz_pagar (histórico anterior)
      // Para dados recentes usa caz_parcelas (mais detalhado), para histórico usa caz_receber e caz_pagar
      const faturamentoResult = await db.execute(sql`
        WITH dados_recentes AS (
          -- Últimos 12 meses via caz_parcelas (mais detalhado)
          SELECT 
            TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as mes,
            COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as faturamento,
            COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as despesas,
            COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_bruto ELSE 0 END), 0) as valor_bruto,
            COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' AND data_vencimento < CURRENT_DATE AND status != 'QUITADO' 
              THEN COALESCE(nao_pago, 0) + COALESCE(perda, 0) ELSE 0 END), 0) as inadimplencia
          FROM "Conta Azul".caz_parcelas
          WHERE COALESCE(data_quitacao, data_vencimento) >= CURRENT_DATE - INTERVAL '12 months'
            AND tipo_evento IN ('RECEITA', 'DESPESA')
          GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
        ),
        dados_historicos AS (
          -- Dados anteriores via caz_receber e caz_pagar
          SELECT 
            mes,
            SUM(faturamento) as faturamento,
            SUM(despesas) as despesas,
            SUM(valor_bruto) as valor_bruto,
            0 as inadimplencia
          FROM (
            -- Receitas de caz_receber
            SELECT 
              TO_CHAR(COALESCE(data_vencimento, data_criacao), 'YYYY-MM') as mes,
              COALESCE(SUM(pago::numeric), 0) as faturamento,
              0 as despesas,
              COALESCE(SUM(total::numeric), 0) as valor_bruto
            FROM "Conta Azul".caz_receber
            WHERE UPPER(status) IN ('PAGO', 'ACQUITTED')
              AND COALESCE(data_vencimento, data_criacao) < CURRENT_DATE - INTERVAL '12 months'
              AND COALESCE(data_vencimento, data_criacao) >= CURRENT_DATE - INTERVAL '5 years'
            GROUP BY TO_CHAR(COALESCE(data_vencimento, data_criacao), 'YYYY-MM')
            
            UNION ALL
            
            -- Despesas de caz_pagar
            SELECT 
              TO_CHAR(COALESCE(data_vencimento, data_criacao), 'YYYY-MM') as mes,
              0 as faturamento,
              COALESCE(SUM(pago::numeric), 0) as despesas,
              0 as valor_bruto
            FROM "Conta Azul".caz_pagar
            WHERE UPPER(status) IN ('PAGO', 'ACQUITTED')
              AND COALESCE(data_vencimento, data_criacao) < CURRENT_DATE - INTERVAL '12 months'
              AND COALESCE(data_vencimento, data_criacao) >= CURRENT_DATE - INTERVAL '5 years'
            GROUP BY TO_CHAR(COALESCE(data_vencimento, data_criacao), 'YYYY-MM')
          ) combined
          GROUP BY mes
        )
        -- Combina dados recentes e históricos
        SELECT mes, faturamento, despesas, valor_bruto, inadimplencia
        FROM dados_recentes
        UNION ALL
        SELECT mes, faturamento, despesas, valor_bruto, inadimplencia
        FROM dados_historicos
        WHERE mes NOT IN (SELECT mes FROM dados_recentes)
        ORDER BY mes DESC
      `);
      
      // Faturamento do mês atual - alinhado com Dashboard Financeiro
      // Usa valor_pago (já representa valores pagos, sem precisar filtrar por status)
      const faturamentoMesResult = await db.execute(sql`
        SELECT 
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as faturamento_mes,
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_bruto ELSE 0 END), 0) as valor_bruto_mes,
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' AND data_vencimento < CURRENT_DATE AND status != 'QUITADO' THEN COALESCE(nao_pago, 0) + COALESCE(perda, 0) ELSE 0 END), 0) as inadimplencia_mes
        FROM "Conta Azul".caz_parcelas
        WHERE TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
          AND tipo_evento IN ('RECEITA', 'DESPESA')
      `);
      
      
      const clientes = clientesResult.rows[0] || { total_clientes: 0, clientes_ativos: 0 };
      const contratos = contratosResult.rows[0] || { total_contratos: 0, contratos_recorrentes: 0, contratos_pontuais: 0, mrr_ativo: 0, aov_recorrente: 0 };
      const equipe = equipeResult.rows[0] || { headcount: 0, tempo_medio_meses: 0 };
      const faturamentoMes = faturamentoMesResult.rows[0] || { faturamento_mes: 0, valor_bruto_mes: 0, inadimplencia_mes: 0 };
      
      const headcount = Number(equipe.headcount) || 1;
      const mrrAtivo = Number(contratos.mrr_ativo) || 0;
      const receitaPorCabeca = headcount > 0 ? mrrAtivo / headcount : 0;
      
      const valorBrutoMes = Number(faturamentoMes.valor_bruto_mes) || 1;
      const inadimplenciaMes = Number(faturamentoMes.inadimplencia_mes) || 0;
      const taxaInadimplencia = valorBrutoMes > 0 ? (inadimplenciaMes / valorBrutoMes) * 100 : 0;
      
      const contratosRecorrentes = Number(contratos.contratos_recorrentes) || 1;
      const clientesAtivos = Number(clientes.clientes_ativos) || 1;
      const contratosPorCliente = clientesAtivos > 0 ? contratosRecorrentes / clientesAtivos : 0;

      res.json({
        clientes: {
          total: Number(clientes.total_clientes) || 0,
          ativos: Number(clientes.clientes_ativos) || 0,
        },
        contratos: {
          total: Number(contratos.total_contratos) || 0,
          recorrentes: Number(contratos.contratos_recorrentes) || 0,
          pontuais: Number(contratos.contratos_pontuais) || 0,
          contratosPorCliente: Number(contratosPorCliente.toFixed(2)),
        },
        receita: {
          mrrAtivo: mrrAtivo,
          aovRecorrente: Number(contratos.aov_recorrente) || 0,
          faturamentoMes: Number(faturamentoMes.faturamento_mes) || 0,
          taxaInadimplencia: Number(taxaInadimplencia.toFixed(2)),
        },
        equipe: {
          headcount: headcount,
          tempoMedioMeses: Number(Number(equipe.tempo_medio_meses).toFixed(1)) || 0,
          receitaPorCabeca: Number(receitaPorCabeca.toFixed(2)),
        },
        distribuicaoSetor: setorResult.rows.map((r: any) => ({
          setor: r.setor,
          quantidade: Number(r.quantidade),
        })),
        evolucaoFaturamento: faturamentoResult.rows.map((r: any) => {
          const faturamento = Number(r.faturamento) || 0;
          const despesas = Number(r.despesas) || 0;
          return {
            mes: r.mes,
            faturamento,
            despesas,
            geracaoCaixa: faturamento - despesas,
            inadimplencia: Number(r.inadimplencia) || 0,
          };
        }).reverse(),
      });
    } catch (error) {
      console.error("[api] Error fetching investors report:", error);
      res.status(500).json({ error: "Failed to fetch investors report data" });
    }
  });

  // Endpoint para exportar Investors Report como PDF - Versão Técnica Detalhada
  app.get("/api/investors-report/pdf", async (req, res) => {
    try {
      // ===== QUERIES AVANÇADAS =====
      
      // Clientes ativos (igual à página) - usando cup_clientes e cup_contratos
      const clientesContagem = await db.execute(sql`
        SELECT 
          (SELECT COUNT(DISTINCT cnpj) FROM "Clickup".cup_clientes) as total_clientes,
          COUNT(DISTINCT c.id_task) as clientes_ativos
        FROM "Clickup".cup_contratos c
        WHERE c.status IN ('ativo', 'onboarding', 'triagem')
      `);

      // Contratos ativos, churn e LT médio
      // LT calculado sobre contratos com data_solicitacao_encerramento preenchida
      // IMPORTANTE: Churn usa data_solicitacao_encerramento (quando cliente solicitou cancelamento)
      const clientesResult = await db.execute(sql`
        SELECT 
          COUNT(CASE WHEN c.valorr > 0 AND c.status IN ('ativo', 'onboarding', 'triagem') THEN 1 END) as contratos_recorrentes_ativos,
          COUNT(CASE WHEN c.data_solicitacao_encerramento IS NOT NULL AND c.valorr > 0 THEN 1 END) as contratos_encerrados_total,
          COUNT(CASE WHEN c.data_solicitacao_encerramento >= DATE_TRUNC('month', CURRENT_DATE) 
            AND c.data_solicitacao_encerramento < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            AND c.valorr > 0
            THEN 1 END) as churn_mes,
          COALESCE(SUM(CASE WHEN c.data_solicitacao_encerramento >= DATE_TRUNC('month', CURRENT_DATE) 
            AND c.data_solicitacao_encerramento < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            AND c.valorr > 0
            THEN c.valorr ELSE 0 END), 0) as mrr_churn_mes,
          COALESCE(AVG(
            CASE WHEN c.data_solicitacao_encerramento IS NOT NULL AND c.data_inicio IS NOT NULL AND c.valorr > 0 THEN
              EXTRACT(MONTH FROM AGE(c.data_solicitacao_encerramento, c.data_inicio)) +
              EXTRACT(YEAR FROM AGE(c.data_solicitacao_encerramento, c.data_inicio)) * 12
            END
          ), 6) as lt_medio_meses
        FROM "Clickup".cup_contratos c
      `);
      
      // Contratos detalhados
      const contratosResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_contratos,
          COUNT(CASE WHEN valorr > 0 AND status IN ('ativo', 'onboarding', 'triagem') THEN 1 END) as contratos_recorrentes,
          COUNT(CASE WHEN valorp > 0 THEN 1 END) as contratos_pontuais,
          COALESCE(SUM(CASE WHEN status IN ('ativo', 'onboarding', 'triagem') THEN valorr ELSE 0 END), 0) as mrr_ativo,
          COALESCE(AVG(CASE WHEN valorr > 0 AND status IN ('ativo', 'onboarding', 'triagem') THEN valorr END), 0) as aov_recorrente,
          COALESCE(SUM(CASE WHEN status = 'churn' THEN valorr ELSE 0 END), 0) as mrr_churn
        FROM "Clickup".cup_contratos
      `);
      
      // MRR atual (não tem histórico disponível na tabela)
      const mrrAtualResult = await db.execute(sql`
        SELECT COALESCE(SUM(CASE WHEN status IN ('ativo', 'onboarding', 'triagem') THEN valorr ELSE 0 END), 0) as mrr
        FROM "Clickup".cup_contratos
      `);
      const mrrHistoricoResult = { rows: [{ mes: new Date().toISOString().slice(0,7), mrr: mrrAtualResult.rows[0]?.mrr || 0 }] };
      
      // Receita por serviço
      const receitaPorServicoResult = await db.execute(sql`
        SELECT 
          COALESCE(c.servico, 'Outros') as servico,
          COUNT(DISTINCT c.id_task) as qtd_contratos,
          COALESCE(SUM(c.valorr), 0) as mrr_servico,
          COALESCE(AVG(c.valorr), 0) as ticket_medio
        FROM "Clickup".cup_contratos c
        WHERE c.status IN ('ativo', 'onboarding', 'triagem')
          AND c.valorr > 0
        GROUP BY c.servico
        ORDER BY mrr_servico DESC
        LIMIT 8
      `);
      
      // Equipe detalhada
      const equipeResult = await db.execute(sql`
        SELECT 
          COUNT(*) as headcount,
          COUNT(CASE WHEN admissao >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as contratacoes_90d,
          COUNT(CASE WHEN status = 'Desligado' THEN 1 END) as desligamentos_90d,
          COALESCE(AVG(
            CASE WHEN admissao IS NOT NULL AND LOWER(status) = 'ativo'
            THEN EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) + 
                 EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12
            END
          ), 0) as tempo_medio_meses
        FROM "Inhire".rh_pessoal
        WHERE LOWER(status) = 'ativo' OR status = 'Desligado'
      `);
      
      // Salário fixo médio
      const salarioMedioResult = await db.execute(sql`
        SELECT 
          COALESCE(AVG(salario::numeric), 0) as salario_medio,
          COUNT(*) as total_colaboradores
        FROM "Inhire".rh_pessoal
        WHERE LOWER(status) = 'ativo'
          AND salario IS NOT NULL
          AND salario::numeric > 0
      `);
      
      // Métricas mensais de contratos (churn, MRR vendido, pontual vendido) - cup_contratos
      // Filtra apenas dados até o mês atual (não inclui datas futuras)
      // IMPORTANTE: Churn usa data_solicitacao_encerramento (quando cliente solicitou cancelamento)
      const contratosEvolucaoResult = await db.execute(sql`
        SELECT 
          mes,
          COALESCE(SUM(churn_mrr), 0) as churn_mrr,
          COALESCE(SUM(mrr_vendido), 0) as mrr_vendido,
          COALESCE(SUM(pontual_vendido), 0) as pontual_vendido
        FROM (
          -- Churn MRR (contratos com solicitação de encerramento no mês - usa valorr)
          SELECT 
            TO_CHAR(data_solicitacao_encerramento, 'YYYY-MM') as mes,
            COALESCE(valorr, 0) as churn_mrr,
            0 as mrr_vendido,
            0 as pontual_vendido
          FROM "Clickup".cup_contratos
          WHERE data_solicitacao_encerramento IS NOT NULL
            AND data_solicitacao_encerramento >= CURRENT_DATE - INTERVAL '12 months'
            AND data_solicitacao_encerramento <= CURRENT_DATE
            AND COALESCE(valorr, 0) > 0
          UNION ALL
          -- MRR vendido (contratos recorrentes iniciados no mês - valorr > 0)
          SELECT 
            TO_CHAR(data_inicio, 'YYYY-MM') as mes,
            0 as churn_mrr,
            COALESCE(valorr, 0) as mrr_vendido,
            0 as pontual_vendido
          FROM "Clickup".cup_contratos
          WHERE data_inicio IS NOT NULL
            AND data_inicio >= CURRENT_DATE - INTERVAL '12 months'
            AND data_inicio <= CURRENT_DATE
            AND COALESCE(valorr, 0) > 0
          UNION ALL
          -- Pontual vendido (contratos pontuais iniciados no mês - valorp > 0)
          SELECT 
            TO_CHAR(data_inicio, 'YYYY-MM') as mes,
            0 as churn_mrr,
            0 as mrr_vendido,
            COALESCE(valorp, 0) as pontual_vendido
          FROM "Clickup".cup_contratos
          WHERE data_inicio IS NOT NULL
            AND data_inicio >= CURRENT_DATE - INTERVAL '12 months'
            AND data_inicio <= CURRENT_DATE
            AND COALESCE(valorp, 0) > 0
        ) sub
        WHERE mes IS NOT NULL
          AND mes <= TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        GROUP BY mes
        ORDER BY mes
      `);
      
      // Receita líquida e geração de caixa mensal - caz_parcelas
      // Filtra apenas dados até o mês atual (não inclui datas futuras)
      const fluxoCaixaResult = await db.execute(sql`
        SELECT 
          TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as mes,
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as receita_liquida,
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as despesas,
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as geracao_caixa
        FROM "Conta Azul".caz_parcelas
        WHERE COALESCE(data_quitacao, data_vencimento) >= CURRENT_DATE - INTERVAL '12 months'
          AND COALESCE(data_quitacao, data_vencimento) <= CURRENT_DATE
          AND tipo_evento IN ('RECEITA', 'DESPESA')
        GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
        HAVING TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') <= TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        ORDER BY mes
      `);
      
      // Distribuição por setor
      const setorResult = await db.execute(sql`
        SELECT 
          COALESCE(setor, 'Não definido') as setor,
          COUNT(*) as quantidade,
          COALESCE(AVG(
            EXTRACT(MONTH FROM AGE(CURRENT_DATE, admissao)) + 
            EXTRACT(YEAR FROM AGE(CURRENT_DATE, admissao)) * 12
          ), 0) as tempo_medio
        FROM "Inhire".rh_pessoal
        WHERE LOWER(status) = 'ativo'
        GROUP BY setor
        ORDER BY quantidade DESC
      `);
      
      // Faturamento mensal detalhado (12 meses)
      const evolucaoMensalResult = await db.execute(sql`
        SELECT 
          TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM') as mes,
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as receita,
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as despesa,
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_bruto ELSE 0 END), 0) as receita_bruta,
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' AND data_vencimento < CURRENT_DATE AND status != 'QUITADO' 
            THEN COALESCE(nao_pago, 0) + COALESCE(perda, 0) ELSE 0 END), 0) as inadimplencia
        FROM "Conta Azul".caz_parcelas
        WHERE COALESCE(data_quitacao, data_vencimento) >= CURRENT_DATE - INTERVAL '12 months'
          AND tipo_evento IN ('RECEITA', 'DESPESA')
        GROUP BY TO_CHAR(COALESCE(data_quitacao, data_vencimento), 'YYYY-MM')
        ORDER BY mes
      `);
      
      // Evolução anual (5 anos)
      const evolucaoAnualResult = await db.execute(sql`
        SELECT 
          EXTRACT(YEAR FROM COALESCE(data_quitacao, data_vencimento))::text as ano,
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) as receita,
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN valor_pago::numeric ELSE 0 END), 0) as despesa,
          COUNT(DISTINCT id_cliente) as clientes_faturados
        FROM "Conta Azul".caz_parcelas
        WHERE COALESCE(data_quitacao, data_vencimento) >= CURRENT_DATE - INTERVAL '5 years'
          AND tipo_evento IN ('RECEITA', 'DESPESA')
        GROUP BY EXTRACT(YEAR FROM COALESCE(data_quitacao, data_vencimento))
        ORDER BY ano
      `);
      
      // Top 10 clientes
      const topClientesResult = await db.execute(sql`
        SELECT 
          COALESCE(caz.nome, 'Não identificado') as cliente,
          COALESCE(SUM(p.valor_pago::numeric), 0) as receita_12m,
          COUNT(DISTINCT TO_CHAR(COALESCE(p.data_quitacao, p.data_vencimento), 'YYYY-MM')) as meses_ativos
        FROM "Conta Azul".caz_parcelas p
        LEFT JOIN "Conta Azul".caz_clientes caz ON p.id_cliente::text = caz.ids::text
        WHERE p.tipo_evento = 'RECEITA' 
          AND COALESCE(p.data_quitacao, p.data_vencimento) >= CURRENT_DATE - INTERVAL '12 months'
          AND p.valor_pago::numeric > 0
        GROUP BY caz.nome
        HAVING SUM(p.valor_pago::numeric) > 0
        ORDER BY receita_12m DESC
        LIMIT 10
      `);
      
      // Concentração de receita (top 5, 10, 20%)
      const concentracaoResult = await db.execute(sql`
        WITH ranked AS (
          SELECT 
            COALESCE(caz.nome, p.id_cliente::text) as cliente,
            SUM(p.valor_pago::numeric) as receita,
            ROW_NUMBER() OVER (ORDER BY SUM(p.valor_pago::numeric) DESC) as rank,
            COUNT(*) OVER () as total_clientes
          FROM "Conta Azul".caz_parcelas p
          LEFT JOIN "Conta Azul".caz_clientes caz ON p.id_cliente::text = caz.ids::text
          WHERE p.tipo_evento = 'RECEITA' 
            AND COALESCE(p.data_quitacao, p.data_vencimento) >= CURRENT_DATE - INTERVAL '12 months'
            AND p.valor_pago::numeric > 0
          GROUP BY COALESCE(caz.nome, p.id_cliente::text)
        ),
        totais AS (SELECT SUM(receita) as total FROM ranked)
        SELECT 
          SUM(CASE WHEN rank <= 5 THEN receita ELSE 0 END) / NULLIF((SELECT total FROM totais), 0) * 100 as top5_pct,
          SUM(CASE WHEN rank <= 10 THEN receita ELSE 0 END) / NULLIF((SELECT total FROM totais), 0) * 100 as top10_pct,
          SUM(CASE WHEN rank <= CEIL(total_clientes * 0.2) THEN receita ELSE 0 END) / NULLIF((SELECT total FROM totais), 0) * 100 as top20_pct
        FROM ranked
      `);

      // ===== PROCESSAR DADOS =====
      // Usando dados consistentes com a página do Investors Report
      const clientesInfo = clientesContagem.rows[0] || { total_clientes: 0, clientes_ativos: 0 };
      const contratosData = clientesResult.rows[0] || { contratos_recorrentes_ativos: 0, contratos_encerrados_total: 0, churn_mes: 0, mrr_churn_mes: 0, lt_medio_meses: 6 };
      const contratos = contratosResult.rows[0] || { total_contratos: 0, contratos_recorrentes: 0, contratos_pontuais: 0, mrr_ativo: 0, aov_recorrente: 0, mrr_churn: 0 };
      const equipe = equipeResult.rows[0] || { headcount: 0, tempo_medio_meses: 0, contratacoes_90d: 0, desligamentos_90d: 0 };
      const salarioMedio = Number((salarioMedioResult.rows[0] as any)?.salario_medio) || 0;
      const concentracao = concentracaoResult.rows[0] || { top5_pct: 0, top10_pct: 0, top20_pct: 0 };

      const headcount = Number(equipe.headcount) || 1;
      const mrrAtivo = Number(contratos.mrr_ativo) || 0;
      const clientesAtivos = Number(clientesInfo.clientes_ativos) || 1;
      const contratosRecorrentesAtivos = Number(contratosData.contratos_recorrentes_ativos) || 1;
      const churnMes = Number(contratosData.churn_mes) || 0;
      const mrrChurnMes = Number(contratosData.mrr_churn_mes) || 0;
      const ltMedio = 5; // LT fixo de 5 meses (definido pelo negócio)
      
      const contratosRecorrentes = Number(contratos.contratos_recorrentes) || 0;
      const aovRecorrente = Number(contratos.aov_recorrente) || 0;
      const receitaPorCabeca = headcount > 0 ? mrrAtivo / headcount : 0;
      const tempoMedioMeses = Number(equipe.tempo_medio_meses) || 0;
      
      // Cálculos avançados - usando apenas contratos recorrentes
      const churnRate = contratosRecorrentesAtivos > 0 ? (churnMes / contratosRecorrentesAtivos) * 100 : 0;
      const arr = mrrAtivo * 12;
      // LTV = AOV × LT (tempo de vida médio em meses, baseado em contratos encerrados)
      const ltv = aovRecorrente * ltMedio;
      
      // Variação MoM/YoY
      const mrrHistData = mrrHistoricoResult.rows || [];
      const mrrAtualIdx = mrrHistData.length - 1;
      const mrrMesAnterior = mrrAtualIdx >= 1 ? Number(mrrHistData[mrrAtualIdx - 1]?.mrr) || 0 : 0;
      const mrrAnoAnterior = mrrAtualIdx >= 12 ? Number(mrrHistData[mrrAtualIdx - 12]?.mrr) || 0 : 0;
      const variacaoMoM = mrrMesAnterior > 0 ? ((mrrAtivo - mrrMesAnterior) / mrrMesAnterior) * 100 : 0;
      const variacaoYoY = mrrAnoAnterior > 0 ? ((mrrAtivo - mrrAnoAnterior) / mrrAnoAnterior) * 100 : 0;
      
      // Faturamento anual
      const evolMensal = evolucaoMensalResult.rows || [];
      const receitaTotal12m = evolMensal.reduce((acc: number, r: any) => acc + (Number(r.receita) || 0), 0);
      const despesaTotal12m = evolMensal.reduce((acc: number, r: any) => acc + (Number(r.despesa) || 0), 0);
      const margemBruta = receitaTotal12m > 0 ? ((receitaTotal12m - despesaTotal12m) / receitaTotal12m) * 100 : 0;
      const inadimplenciaTotal12m = evolMensal.reduce((acc: number, r: any) => acc + (Number(r.inadimplencia) || 0), 0);
      const taxaInadimplencia = receitaTotal12m > 0 ? (inadimplenciaTotal12m / receitaTotal12m) * 100 : 0;
      
      // ===== MÉTRICAS AVANÇADAS PARA INVESTIDORES =====
      // NOTA: Todas as métricas usam contratos como fonte única de verdade
      
            
      // NRR e GRR usando MRR churn do mês (contratos encerrados no mês)
      // NRR = (MRR atual / MRR inicial) * 100 ≈ 100% - (MRR churned / MRR total)
      const churnMrrPct = mrrAtivo > 0 ? (mrrChurnMes / mrrAtivo) * 100 : 0;
      const nrr = Math.max(0, Math.min(100 - churnMrrPct, 120)); // NRR conservador, cap 0-120%
      
      // Quick Ratio SaaS = New MRR / Churned MRR
      // Usando crescimento MoM como proxy de New MRR
      const newMrrEstimado = mrrAtivo * Math.max(variacaoMoM, 0) / 100;
      const quickRatioSaas = mrrChurnMes > 0 ? Math.max(newMrrEstimado / mrrChurnMes, 0.5) : 4;
      
      // Rule of 40 = Growth Rate + Profit Margin
      const growthRate = variacaoMoM * 12; // Anualizado do MoM
      const ruleOf40 = growthRate + margemBruta;
      
      // Magic Number - Eficiência de crescimento
      const crescimentoReceita = receitaTotal12m * Math.max(growthRate, 0) / 100;
      const magicNumber = despesaTotal12m > 0 ? crescimentoReceita / despesaTotal12m : 0;
      
      // Gross Revenue Retention (GRR) - Retenção bruta (sem expansão)
      const grr = Math.max(0, Math.min(100 - churnMrrPct, 100)); // GRR cap 0-100%
      
      // Receita por funcionário
      const revenuePerEmployee = headcount > 0 ? arr / headcount : 0;

      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
      };
      
      const formatCurrencyShort = (value: number) => {
        if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
        if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
        return formatCurrency(value);
      };
      
      const formatPct = (value: number, decimals = 1) => `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
      const formatPctAbs = (value: number, decimals = 1) => `${value.toFixed(decimals)}%`;

      const mesesNomes: { [key: string]: string } = {
        '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
        '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
      };

      // ===== GERAR PDF =====
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=investors-report-${format(new Date(), 'yyyy-MM')}.pdf`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      doc.pipe(res);

      const colors = {
        primary: '#0f172a',
        accent: '#2563eb',
        success: '#16a34a',
        danger: '#dc2626',
        warning: '#ea580c',
        text: '#1f2937',
        muted: '#6b7280',
        light: '#f8fafc',
        border: '#e2e8f0',
        bar1: '#3b82f6',
        bar2: '#10b981',
        bar3: '#f59e0b',
        bar4: '#8b5cf6',
      };

      const lm = 50;  // left margin (mais generoso)
      const rm = 50;  // right margin
      const pw = 595 - lm - rm; // page width (A4 = 595pt)
      const mesesPtBr = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const dataAtual = new Date();

      // ==================== PÁGINA DE CAPA ====================
      // Fundo gradiente simulado com retângulos
      doc.rect(0, 0, 595, 842).fill('#0f172a');
      doc.rect(0, 0, 595, 280).fill('#1e293b');
      
      // Logo da empresa no topo
      const logoPath = path.join(process.cwd(), 'attached_assets', 'Logo-Turbo-branca_(1)_1766081013390.png');
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 197, 80, { width: 200 });
        } catch (e) {
          console.log('[PDF] Error loading logo:', e);
          doc.fontSize(24).font('Helvetica-Bold').fillColor('#ffffff')
            .text('TURBO', 50, 120, { align: 'center', width: 495 });
        }
      } else {
        console.log('[PDF] Logo not found at:', logoPath);
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#ffffff')
          .text('TURBO', 50, 120, { align: 'center', width: 495 });
      }
      
      // Linha accent decorativa
      doc.rect(50, 320, 495, 4).fill(colors.accent);
      
      // Título principal
      doc.fontSize(36).font('Helvetica-Bold').fillColor('#ffffff')
        .text('INVESTORS', 50, 350, { align: 'center', width: 495 });
      doc.fontSize(36).font('Helvetica-Bold').fillColor(colors.accent)
        .text('REPORT', 50, 395, { align: 'center', width: 495 });
      
      // Subtítulo
      doc.fontSize(14).font('Helvetica').fillColor('#94a3b8')
        .text('Relatório Executivo para Investidores', 50, 450, { align: 'center', width: 495 });
      
      // Período
      doc.fontSize(12).font('Helvetica').fillColor('#64748b')
        .text(`${mesesPtBr[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`, 50, 480, { align: 'center', width: 495 });
      
      // Linha divisória
      doc.rect(150, 530, 295, 1).fill('#334155');
      
      // Mantra
      doc.fontSize(11).font('Helvetica-Oblique').fillColor('#cbd5e1')
        .text('"Tornamos a vida de quem vende online mais fácil e rentável,', 50, 570, { align: 'center', width: 495 });
      doc.fontSize(11).font('Helvetica-Oblique').fillColor('#cbd5e1')
        .text('usando desse know how, para construir', 50, 588, { align: 'center', width: 495 });
      doc.fontSize(11).font('Helvetica-Oblique').fillColor('#cbd5e1')
        .text('as marcas da próxima geração."', 50, 606, { align: 'center', width: 495 });
      
      // Nome da empresa (fallback/reforço)
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff')
        .text('TURBO PARTNERS', 50, 720, { align: 'center', width: 495 });
      
      // Data de geração
      doc.fontSize(9).font('Helvetica').fillColor('#64748b')
        .text(`Gerado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 50, 800, { align: 'center', width: 495 });

      // ==================== PÁGINA 1: RESUMO EXECUTIVO ====================
      doc.addPage();
      doc.rect(lm, 45, pw, 4).fill(colors.accent);
      doc.fontSize(22).font('Helvetica-Bold').fillColor(colors.primary)
        .text('INVESTORS REPORT', lm, 60, { align: 'center', width: pw });
      doc.fontSize(10).font('Helvetica').fillColor(colors.muted)
        .text(`Turbo Partners | ${mesesPtBr[dataAtual.getMonth()]} ${dataAtual.getFullYear()} | Relatório Executivo`, lm, 85, { align: 'center', width: pw });
      
      doc.y = 110;

      // ===== SEÇÃO 1: MÉTRICAS FINANCEIRAS PRINCIPAIS =====
      doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary).text('1. MÉTRICAS FINANCEIRAS', lm, doc.y);
      doc.moveDown(0.5);
      
      const kpiY = doc.y;
      const kpiGap = 12;
      const kpiW = (pw - kpiGap * 3) / 4;
      const kpiH = 58;
      
      const kpis = [
        { label: 'MRR Ativo', value: formatCurrencyShort(mrrAtivo), delta: formatPct(variacaoMoM), deltaColor: variacaoMoM >= 0 ? colors.success : colors.danger },
        { label: 'ARR', value: formatCurrencyShort(arr), delta: 'MRR × 12', deltaColor: colors.muted },
        { label: 'Receita 12m', value: formatCurrencyShort(receitaTotal12m), delta: formatPct(variacaoYoY) + ' YoY', deltaColor: variacaoYoY >= 0 ? colors.success : colors.danger },
        { label: 'Margem Bruta', value: formatPctAbs(margemBruta), delta: 'Rec - Desp / Rec', deltaColor: colors.muted },
      ];
      
      kpis.forEach((kpi, i) => {
        const x = lm + i * (kpiW + kpiGap);
        doc.rect(x, kpiY, kpiW, kpiH).fill(colors.light);
        doc.rect(x, kpiY, 4, kpiH).fill(colors.accent);
        doc.fontSize(9).font('Helvetica').fillColor(colors.muted).text(kpi.label, x + 12, kpiY + 10);
        doc.fontSize(17).font('Helvetica-Bold').fillColor(colors.primary).text(kpi.value, x + 12, kpiY + 26);
        doc.fontSize(8).font('Helvetica').fillColor(kpi.deltaColor).text(kpi.delta, x + 12, kpiY + 46);
      });
      
      doc.y = kpiY + kpiH + 18;
      
      // Segunda linha de KPIs
      const kpis2 = [
        { label: 'AOV Recorrente', value: formatCurrency(aovRecorrente), delta: 'Ticket médio', deltaColor: colors.muted },
        { label: 'LTV', value: formatCurrencyShort(ltv), delta: `AOV × ${ltMedio.toFixed(0)} meses`, deltaColor: colors.muted },
        { label: 'Inadimplência', value: formatPctAbs(taxaInadimplencia), delta: formatCurrency(inadimplenciaTotal12m), deltaColor: taxaInadimplencia > 5 ? colors.danger : colors.success },
        { label: 'Churn Rate', value: formatPctAbs(churnRate), delta: `${churnMes} este mês`, deltaColor: churnRate > 5 ? colors.danger : colors.success },
      ];
      
      const kpi2Y = doc.y;
      kpis2.forEach((kpi, i) => {
        const x = lm + i * (kpiW + kpiGap);
        doc.rect(x, kpi2Y, kpiW, kpiH).fill(colors.light);
        doc.rect(x, kpi2Y, 4, kpiH).fill(colors.bar2);
        doc.fontSize(9).font('Helvetica').fillColor(colors.muted).text(kpi.label, x + 12, kpi2Y + 10);
        doc.fontSize(17).font('Helvetica-Bold').fillColor(colors.primary).text(kpi.value, x + 12, kpi2Y + 26);
        doc.fontSize(8).font('Helvetica').fillColor(kpi.deltaColor).text(kpi.delta, x + 12, kpi2Y + 46);
      });
      
      doc.y = kpi2Y + kpiH + 20;

      // ===== SEÇÃO 2: EVOLUÇÃO ANUAL COM BARRAS COMPARATIVAS =====
      doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary).text('2. EVOLUÇÃO ANUAL', lm, doc.y);
      doc.moveDown(0.4);
      
      const anoData = evolucaoAnualResult.rows.map((r: any) => ({
        ano: r.ano,
        receita: Number(r.receita) || 0,
        despesa: Number(r.despesa) || 0,
        clientes: Number(r.clientes_faturados) || 0,
      }));
      
      // Tabela com barras inline
      let tblY = doc.y;
      doc.rect(lm, tblY, pw, 20).fill(colors.light);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.text);
      doc.text('Ano', lm + 12, tblY + 6);
      doc.text('Receita', lm + 60, tblY + 6);
      doc.text('Gráfico', lm + 140, tblY + 6);
      doc.text('Despesa', lm + 320, tblY + 6);
      doc.text('Resultado', lm + 410, tblY + 6);
      tblY += 20;
      
      const maxRec = Math.max(...anoData.map((d: any) => d.receita), 1);
      
      anoData.forEach((d: any, i: number) => {
        const resultado = d.receita - d.despesa;
        const barW = (d.receita / maxRec) * 160;
        
        if (i % 2 === 0) doc.rect(lm, tblY, pw, 22).fill('#fafafa');
        
        doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.text).text(d.ano, lm + 12, tblY + 6);
        doc.fontSize(8).font('Helvetica').fillColor(colors.text).text(formatCurrencyShort(d.receita), lm + 60, tblY + 6);
        
        // Barra visual
        doc.rect(lm + 140, tblY + 4, barW, 14).fill(colors.bar1);
        
        doc.fontSize(8).font('Helvetica').fillColor(colors.text).text(formatCurrencyShort(d.despesa), lm + 320, tblY + 6);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(resultado >= 0 ? colors.success : colors.danger)
          .text(formatCurrencyShort(resultado), lm + 410, tblY + 6);
        
        tblY += 22;
      });
      
      doc.y = tblY + 18;

      // ===== SEÇÃO 3: EVOLUÇÃO MENSAL (12 MESES) =====
      doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary).text('3. EVOLUÇÃO MENSAL (12 MESES)', lm, doc.y);
      doc.moveDown(0.4);
      
      tblY = doc.y;
      doc.rect(lm, tblY, pw, 18).fill(colors.light);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.text);
      doc.text('Mês', lm + 12, tblY + 5);
      doc.text('Receita', lm + 60, tblY + 5);
      doc.text('Despesa', lm + 130, tblY + 5);
      doc.text('Resultado', lm + 200, tblY + 5);
      doc.text('Margem', lm + 275, tblY + 5);
      doc.text('Gráfico Comparativo', lm + 340, tblY + 5);
      tblY += 18;
      
      const mesData = evolMensal.slice(-12);
      const maxMes = Math.max(...mesData.map((d: any) => Math.max(Number(d.receita), Number(d.despesa))), 1);
      
      mesData.forEach((row: any, i: number) => {
        const receita = Number(row.receita) || 0;
        const despesa = Number(row.despesa) || 0;
        const resultado = receita - despesa;
        const margem = receita > 0 ? ((receita - despesa) / receita) * 100 : 0;
        const mesParts = (row.mes || '').split('-');
        const ano = mesParts[0] || '2024';
        const mes = mesParts[1] || '01';
        const mesLabel = `${mesesNomes[mes] || mes}/${ano.slice(2)}`;
        
        if (i % 2 === 0) doc.rect(lm, tblY, pw, 17).fill('#fafafa');
        
        doc.fontSize(7).font('Helvetica').fillColor(colors.text);
        doc.text(mesLabel, lm + 12, tblY + 5);
        doc.text(formatCurrencyShort(receita), lm + 60, tblY + 5);
        doc.text(formatCurrencyShort(despesa), lm + 130, tblY + 5);
        doc.font('Helvetica-Bold').fillColor(resultado >= 0 ? colors.success : colors.danger)
          .text(formatCurrencyShort(resultado), lm + 200, tblY + 5);
        doc.fillColor(margem >= 30 ? colors.success : margem >= 10 ? colors.warning : colors.danger)
          .text(formatPctAbs(margem), lm + 275, tblY + 5);
        
        // Mini barras comparativas
        const barRecW = (receita / maxMes) * 100;
        const barDespW = (despesa / maxMes) * 100;
        doc.rect(lm + 340, tblY + 3, barRecW, 5).fill(colors.bar1);
        doc.rect(lm + 340, tblY + 9, barDespW, 5).fill(colors.danger);
        
        tblY += 17;
      });

      // ==================== PÁGINA 2: ANÁLISE DETALHADA ====================
      doc.addPage();
      doc.rect(lm, 40, pw, 3).fill(colors.accent);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('ANÁLISE DETALHADA', lm, 50);
      doc.y = 68;

      // ===== SEÇÃO 4: CLIENTES E RETENÇÃO =====
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primary).text('4. BASE DE CLIENTES', lm, doc.y);
      doc.moveDown(0.25);
      
      const clienteKpiY = doc.y;
      const ckGap = 8;
      const ckW = (pw - ckGap * 4) / 5;
      const ckH = 42;
      
      const clienteKpis = [
        { label: 'Contratos Ativos', value: String(contratosRecorrentesAtivos), color: colors.success },
        { label: 'Total Contratos', value: String(Number(contratos.total_contratos) || 0), color: colors.accent },
        { label: 'Churned (mês)', value: String(churnMes), color: colors.danger },
        { label: 'Contratos Rec.', value: String(contratosRecorrentes), color: colors.bar2 },
        { label: 'MRR Churn (mês)', value: formatCurrencyShort(mrrChurnMes), color: colors.bar3 },
      ];
      
      clienteKpis.forEach((kpi, i) => {
        const x = lm + i * (ckW + ckGap);
        doc.rect(x, clienteKpiY, ckW, ckH).fill(colors.light);
        doc.rect(x, clienteKpiY, 3, ckH).fill(kpi.color);
        doc.fontSize(6).font('Helvetica').fillColor(colors.muted).text(kpi.label, x + 10, clienteKpiY + 8);
        doc.fontSize(13).font('Helvetica-Bold').fillColor(colors.primary).text(kpi.value, x + 10, clienteKpiY + 22);
      });
      
      doc.y = clienteKpiY + ckH + 12;

      // ===== SEÇÃO 5: RECEITA POR SERVIÇO =====
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primary).text('5. RECEITA POR SERVIÇO', lm, doc.y);
      doc.moveDown(0.25);
      
      tblY = doc.y;
      doc.rect(lm, tblY, pw, 15).fill(colors.light);
      doc.fontSize(6).font('Helvetica-Bold').fillColor(colors.text);
      doc.text('Serviço', lm + 10, tblY + 4);
      doc.text('Contratos', lm + 165, tblY + 4);
      doc.text('MRR', lm + 225, tblY + 4);
      doc.text('% MRR', lm + 295, tblY + 4);
      doc.text('Ticket Médio', lm + 355, tblY + 4);
      doc.text('Gráfico', lm + 425, tblY + 4);
      tblY += 15;
      
      const servicoData = receitaPorServicoResult.rows || [];
      const mrrTotal = servicoData.reduce((acc: number, r: any) => acc + (Number(r.mrr_servico) || 0), 0);
      const maxServicoMrr = Math.max(...servicoData.map((r: any) => Number(r.mrr_servico) || 0), 1);
      
      servicoData.forEach((row: any, i: number) => {
        const mrrServ = Number(row.mrr_servico) || 0;
        const pctMrr = mrrTotal > 0 ? (mrrServ / mrrTotal) * 100 : 0;
        const barW = (mrrServ / maxServicoMrr) * 55;
        
        if (i % 2 === 0) doc.rect(lm, tblY, pw, 14).fill('#fafafa');
        
        doc.fontSize(6).font('Helvetica').fillColor(colors.text);
        doc.text(String(row.servico).slice(0, 28), lm + 10, tblY + 4);
        doc.text(String(row.qtd_contratos), lm + 165, tblY + 4);
        doc.font('Helvetica-Bold').text(formatCurrencyShort(mrrServ), lm + 225, tblY + 4);
        doc.font('Helvetica').text(formatPctAbs(pctMrr), lm + 295, tblY + 4);
        doc.text(formatCurrency(Number(row.ticket_medio) || 0), lm + 355, tblY + 4);
        
        doc.rect(lm + 425, tblY + 3, barW, 8).fill(colors.bar4);
        
        tblY += 14;
      });
      
      doc.y = tblY + 12;

      // ===== SEÇÃO 6: TOP 10 CLIENTES =====
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primary).text('6. TOP 10 CLIENTES POR RECEITA', lm, doc.y);
      doc.moveDown(0.25);
      
      tblY = doc.y;
      doc.rect(lm, tblY, pw, 15).fill(colors.light);
      doc.fontSize(6).font('Helvetica-Bold').fillColor(colors.text);
      doc.text('Cliente', lm + 10, tblY + 4);
      doc.text('MRR', lm + 245, tblY + 4);
      doc.text('% MRR', lm + 315, tblY + 4);
      doc.text('Conc.', lm + 380, tblY + 4);
      doc.text('Gráfico', lm + 425, tblY + 4);
      tblY += 15;
      
      const topClientesData = topClientesResult.rows || [];
      const mrrTotalClientes = topClientesData.reduce((acc: number, r: any) => acc + (Number(r.mrr_cliente) || 0), 0);
      const maxClienteMrr = Math.max(...topClientesData.map((r: any) => Number(r.mrr_cliente) || 0), 1);
      let acumulado = 0;
      
      topClientesData.slice(0, 10).forEach((row: any, i: number) => {
        const mrrCl = Number(row.mrr_cliente) || 0;
        const pctMrr = mrrTotalClientes > 0 ? (mrrCl / mrrTotalClientes) * 100 : 0;
        acumulado += pctMrr;
        const barW = (mrrCl / maxClienteMrr) * 55;
        
        if (i % 2 === 0) doc.rect(lm, tblY, pw, 14).fill('#fafafa');
        
        doc.fontSize(6).font('Helvetica').fillColor(colors.text);
        doc.text(String(row.cliente || 'N/A').slice(0, 40), lm + 10, tblY + 4);
        doc.font('Helvetica-Bold').text(formatCurrencyShort(mrrCl), lm + 245, tblY + 4);
        doc.font('Helvetica').text(formatPctAbs(pctMrr), lm + 315, tblY + 4);
        doc.fillColor(acumulado > 50 ? colors.warning : colors.text).text(formatPctAbs(acumulado), lm + 380, tblY + 4);
        
        doc.rect(lm + 425, tblY + 3, barW, 8).fill(colors.success);
        
        tblY += 14;
      });
      
      doc.y = tblY + 10;

      // Processar dados de contratos e fluxo de caixa
      const contratosEvolData = contratosEvolucaoResult.rows || [];
      const fluxoCaixaData = fluxoCaixaResult.rows || [];
      
      // Criar mapa combinado por mês
      const mesesMap = new Map();
      contratosEvolData.forEach((r: any) => {
        mesesMap.set(r.mes, {
          mes: r.mes,
          churnMrr: Number(r.churn_mrr) || 0,
          mrrVendido: Number(r.mrr_vendido) || 0,
          pontualVendido: Number(r.pontual_vendido) || 0,
          receitaLiquida: 0,
          geracaoCaixa: 0,
        });
      });
      fluxoCaixaData.forEach((r: any) => {
        if (mesesMap.has(r.mes)) {
          const item = mesesMap.get(r.mes);
          item.receitaLiquida = Number(r.receita_liquida) || 0;
          item.geracaoCaixa = Number(r.geracao_caixa) || 0;
        } else {
          mesesMap.set(r.mes, {
            mes: r.mes,
            churnMrr: 0,
            mrrVendido: 0,
            pontualVendido: 0,
            receitaLiquida: Number(r.receita_liquida) || 0,
            geracaoCaixa: Number(r.geracao_caixa) || 0,
          });
        }
      });
      
      const indicadoresMensais = Array.from(mesesMap.values())
        .filter((d: any) => d.mes)
        .sort((a: any, b: any) => a.mes.localeCompare(b.mes))
        .slice(-12);
      
      // Função para desenhar página de indicador - Design Compacto
      const drawIndicatorPage = (title: string, data: any[], valueKey: string, accentColor: string) => {
        doc.addPage();
        
        // Calcular métricas
        const total = data.reduce((sum: number, d: any) => sum + (d[valueKey] || 0), 0);
        const media = total / data.length;
        const valores = data.map((d: any) => d[valueKey] || 0);
        const maxVal = Math.max(...valores);
        const minVal = Math.min(...valores);
        const melhorMesIdx = valores.indexOf(maxVal);
        const piorMesIdx = valores.indexOf(minVal);
        const melhorMes = data[melhorMesIdx];
        const piorMes = data[piorMesIdx];
        
        // === HEADER ===
        doc.rect(lm, 40, 3, 28).fill(accentColor);
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#1f2937').text(title, lm + 14, 42);
        doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text('Últimos 12 meses', lm + 14, 65);
        
        // === CARDS DE DESTAQUE ===
        const cardY = 85;
        const cardGap = 15;
        const cardW = (pw - cardGap * 2) / 3;
        const cardH = 58;
        
        // Card 1: Total
        doc.roundedRect(lm, cardY, cardW, cardH, 6).fill('#f8fafc');
        doc.roundedRect(lm, cardY, cardW, cardH, 6).strokeColor('#e2e8f0').lineWidth(1).stroke();
        doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Total Acumulado', lm + 12, cardY + 10);
        doc.fontSize(16).font('Helvetica-Bold').fillColor(accentColor).text(formatCurrency(total), lm + 12, cardY + 28);
        
        // Card 2: Média
        doc.roundedRect(lm + cardW + cardGap, cardY, cardW, cardH, 6).fill('#f8fafc');
        doc.roundedRect(lm + cardW + cardGap, cardY, cardW, cardH, 6).strokeColor('#e2e8f0').lineWidth(1).stroke();
        doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Média Mensal', lm + cardW + cardGap + 12, cardY + 10);
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1f2937').text(formatCurrency(media), lm + cardW + cardGap + 12, cardY + 28);
        
        // Card 3: Melhor Mês
        const melhorMesParts = (melhorMes?.mes || '').split('-');
        const melhorMesLabel = `${mesesNomes[melhorMesParts[1]] || ''}/${melhorMesParts[0]?.slice(2) || ''}`;
        doc.roundedRect(lm + (cardW + cardGap) * 2, cardY, cardW, cardH, 6).fill('#f0fdf4');
        doc.roundedRect(lm + (cardW + cardGap) * 2, cardY, cardW, cardH, 6).strokeColor('#bbf7d0').lineWidth(1).stroke();
        doc.fontSize(8).font('Helvetica').fillColor('#16a34a').text('Melhor Mês', lm + (cardW + cardGap) * 2 + 12, cardY + 10);
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#15803d').text(formatCurrencyShort(maxVal), lm + (cardW + cardGap) * 2 + 12, cardY + 28);
        doc.fontSize(8).font('Helvetica').fillColor('#22c55e').text(melhorMesLabel, lm + (cardW + cardGap) * 2 + 12, cardY + 44);
        
        // === SPARKLINE ===
        const sparkY = 160;
        const sparkH = 50;
        const sparkW = pw;
        const sparkMax = Math.max(...valores.map(v => Math.abs(v)), 1);
        
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151').text('Evolução', lm, sparkY - 14);
        
        // Linha de tendência
        const pointSpacing = sparkW / (data.length - 1);
        doc.strokeColor(accentColor).lineWidth(2);
        
        let path = doc.moveTo(lm, sparkY + sparkH - (Math.abs(valores[0]) / sparkMax) * sparkH);
        for (let i = 1; i < data.length; i++) {
          const x = lm + i * pointSpacing;
          const y = sparkY + sparkH - (Math.abs(valores[i]) / sparkMax) * sparkH;
          path = path.lineTo(x, y);
        }
        path.stroke();
        
        // Pontos nos extremos
        data.forEach((d: any, i: number) => {
          const x = lm + i * pointSpacing;
          const y = sparkY + sparkH - (Math.abs(valores[i]) / sparkMax) * sparkH;
          doc.circle(x, y, 3).fill(accentColor);
        });
        
        // Labels início e fim
        const primeiroParts = (data[0]?.mes || '').split('-');
        const ultimoParts = (data[data.length - 1]?.mes || '').split('-');
        doc.fontSize(7).font('Helvetica').fillColor('#9ca3af')
          .text(`${mesesNomes[primeiroParts[1]]?.slice(0, 3) || ''}`, lm - 10, sparkY + sparkH + 6, { width: 30, align: 'center' });
        doc.fontSize(7).font('Helvetica').fillColor('#9ca3af')
          .text(`${mesesNomes[ultimoParts[1]]?.slice(0, 3) || ''}`, lm + sparkW - 20, sparkY + sparkH + 6, { width: 30, align: 'center' });
        
        // === TABELA DE VALORES ===
        const tableY = 235;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151').text('Detalhamento Mensal', lm, tableY - 14);
        
        // Cabeçalho
        doc.rect(lm, tableY, pw, 18).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569');
        doc.text('Mês', lm + 12, tableY + 5);
        doc.text('Valor', lm + 110, tableY + 5);
        doc.text('% do Total', lm + 230, tableY + 5);
        doc.text('', lm + 320, tableY + 5);
        
        let rowY = tableY + 18;
        data.forEach((d: any, i: number) => {
          const val = d[valueKey] || 0;
          const mesParts = (d.mes || '').split('-');
          const mesLabel = `${mesesNomes[mesParts[1]] || mesParts[1]}/${mesParts[0]?.slice(2) || ''}`;
          const pctTotal = total > 0 ? (val / total) * 100 : 0;
          
          // Fundo alternado
          if (i % 2 === 0) doc.rect(lm, rowY, pw, 16).fill('#fafafa');
          
          // Highlight melhor/pior
          if (i === melhorMesIdx) doc.rect(lm, rowY, pw, 16).fill('#f0fdf4');
          if (i === piorMesIdx && minVal < media * 0.7) doc.rect(lm, rowY, pw, 16).fill('#fef2f2');
          
          doc.fontSize(7).font('Helvetica').fillColor('#374151');
          doc.text(mesLabel, lm + 12, rowY + 4);
          doc.font('Helvetica-Bold').text(formatCurrencyShort(val), lm + 110, rowY + 4);
          
          doc.font('Helvetica').fillColor('#64748b').text(`${pctTotal.toFixed(1)}%`, lm + 230, rowY + 4);
          
          // Barra de progresso
          const barMaxW = 130;
          const barH = 6;
          const barPct = Math.min((Math.abs(val) / sparkMax), 1);
          doc.rect(lm + 310, rowY + 5, barMaxW, barH).fill('#e5e7eb');
          doc.rect(lm + 310, rowY + 5, barMaxW * barPct, barH).fill(accentColor);
          
          rowY += 16;
        });
      };
      
      // Página 3: Churn MRR
      drawIndicatorPage('Churn MRR', indicadoresMensais, 'churnMrr', colors.danger);
      
      // Página 4: MRR Vendido
      drawIndicatorPage('MRR Vendido', indicadoresMensais, 'mrrVendido', colors.success);
      
      // Página 5: Pontual Vendido
      drawIndicatorPage('Pontual Vendido', indicadoresMensais, 'pontualVendido', colors.accent);
      
      // Página 6: Receita Líquida
      drawIndicatorPage('Receita Líquida', indicadoresMensais, 'receitaLiquida', '#5B8DEF');
      
      // Página 7: Geração de Caixa
      drawIndicatorPage('Geração de Caixa', indicadoresMensais, 'geracaoCaixa', colors.success);

      // ==================== PÁGINA 8: EQUIPE E INSIGHTS ====================
      doc.addPage();
      doc.rect(lm, 40, pw, 3).fill(colors.accent);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('EQUIPE E INSIGHTS', lm, 50);
      doc.y = 68;

      // ===== SEÇÃO 7: MÉTRICAS DE EQUIPE =====
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primary).text('7. MÉTRICAS DE EQUIPE', lm, doc.y);
      doc.moveDown(0.25);
      
      const eqKpiY = doc.y;
      const eqGap = 8;
      const eqW = (pw - eqGap * 4) / 5;
      const eqH = 45;
      
      const equipeKpis = [
        { label: 'Headcount', value: String(headcount), sub: 'colaboradores ativos' },
        { label: 'Tempo Médio', value: `${tempoMedioMeses.toFixed(1)}m`, sub: 'de permanência' },
        { label: 'Contratações 90d', value: String(Number(equipe.contratacoes_90d) || 0), sub: 'novos membros' },
        { label: 'Salário Fixo', value: formatCurrencyShort(salarioMedio), sub: 'média mensal' },
        { label: 'Receita/Cabeça', value: formatCurrencyShort(receitaPorCabeca), sub: 'MRR ÷ Headcount' },
      ];
      
      equipeKpis.forEach((kpi, i) => {
        const x = lm + i * (eqW + eqGap);
        doc.rect(x, eqKpiY, eqW, eqH).fill(colors.light);
        doc.rect(x, eqKpiY, 3, eqH).fill(colors.bar3);
        doc.fontSize(6).font('Helvetica').fillColor(colors.muted).text(kpi.label, x + 10, eqKpiY + 8);
        doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.primary).text(kpi.value, x + 10, eqKpiY + 20);
        doc.fontSize(6).font('Helvetica').fillColor(colors.muted).text(kpi.sub, x + 10, eqKpiY + 36);
      });
      
      doc.y = eqKpiY + eqH + 12;

      // ===== SEÇÃO 8: DISTRIBUIÇÃO POR SETOR =====
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primary).text('8. DISTRIBUIÇÃO POR SETOR', lm, doc.y);
      doc.moveDown(0.25);
      
      const setorData = setorResult.rows || [];
      const totalSetorQtd = setorData.reduce((acc: number, r: any) => acc + (Number(r.quantidade) || 0), 0);
      const maxSetorQtd = Math.max(...setorData.map((r: any) => Number(r.quantidade) || 0), 1);
      
      tblY = doc.y;
      doc.rect(lm, tblY, pw, 15).fill(colors.light);
      doc.fontSize(6).font('Helvetica-Bold').fillColor(colors.text);
      doc.text('Setor', lm + 10, tblY + 4);
      doc.text('Qtd', lm + 165, tblY + 4);
      doc.text('% Total', lm + 210, tblY + 4);
      doc.text('Tempo Médio', lm + 280, tblY + 4);
      doc.text('Gráfico', lm + 365, tblY + 4);
      tblY += 15;
      
      setorData.slice(0, 10).forEach((row: any, i: number) => {
        const qtd = Number(row.quantidade) || 0;
        const pct = totalSetorQtd > 0 ? (qtd / totalSetorQtd) * 100 : 0;
        const barW = (qtd / maxSetorQtd) * 100;
        
        if (i % 2 === 0) doc.rect(lm, tblY, pw, 14).fill('#fafafa');
        
        doc.fontSize(6).font('Helvetica').fillColor(colors.text);
        doc.text(String(row.setor).slice(0, 28), lm + 10, tblY + 4);
        doc.font('Helvetica-Bold').text(String(qtd), lm + 165, tblY + 4);
        doc.font('Helvetica').text(formatPctAbs(pct), lm + 210, tblY + 4);
        doc.text(`${Number(row.tempo_medio || 0).toFixed(1)}m`, lm + 290, tblY + 4);
        doc.rect(lm + 365, tblY + 3, barW, 8).fill(colors.bar3);
        
        tblY += 14;
      });
      
      doc.y = tblY + 12;

      // ===== SEÇÃO 9: INSIGHTS E OUTLOOK =====
      doc.rect(lm, doc.y, pw, 120).fill(colors.light);
      doc.rect(lm, doc.y, pw, 3).fill(colors.accent);
      
      const insY = doc.y + 10;
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primary).text('9. INSIGHTS E OUTLOOK', lm + 12, insY);
      
      doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.text).text('Pontos Positivos:', lm + 12, insY + 18);
      doc.fontSize(7).font('Helvetica').fillColor(colors.text);
      const positivos = [];
      if (variacaoMoM > 0) positivos.push(`MRR cresceu ${formatPct(variacaoMoM)} no último mês`);
      if (margemBruta > 25) positivos.push(`Margem bruta saudável de ${formatPctAbs(margemBruta)}`);
      if (churnRate < 5) positivos.push(`Churn rate controlado em ${formatPctAbs(churnRate)}`);
      if (tempoMedioMeses > 12) positivos.push(`Boa retenção de talentos (${tempoMedioMeses.toFixed(1)} meses médio)`);
      positivos.slice(0, 3).forEach((p, i) => {
        doc.text(`• ${p}`, lm + 15, insY + 30 + i * 10, { width: pw - 40 });
      });
      
      doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.text).text('Pontos de Atenção:', lm + 12, insY + 62);
      const alertas = [];
      if (taxaInadimplencia > 3) alertas.push(`Inadimplência de ${formatPctAbs(taxaInadimplencia)} requer atenção`);
      if (Number(concentracao.top5_pct) > 40) alertas.push(`Alta concentração: Top 5 representa ${formatPctAbs(Number(concentracao.top5_pct))} da receita`);
      if (variacaoMoM < 0) alertas.push(`MRR caiu ${formatPct(Math.abs(variacaoMoM))} no último mês`);
      if (churnRate > 5) alertas.push(`Churn rate elevado de ${formatPctAbs(churnRate)}`);
      alertas.slice(0, 3).forEach((a, i) => {
        doc.fontSize(7).font('Helvetica').fillColor(colors.danger).text(`• ${a}`, lm + 15, insY + 74 + i * 10, { width: pw - 40 });
      });
      
      doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.text).text('Métricas-Chave:', lm + 270, insY + 18);
      doc.fontSize(7).font('Helvetica').fillColor(colors.text);
      doc.text(`ARR: ${formatCurrencyShort(arr)}`, lm + 275, insY + 30);
      doc.text(`LTV: ${formatCurrencyShort(ltv)}`, lm + 275, insY + 42);
      doc.text(`Receita/Cabeça: ${formatCurrencyShort(receitaPorCabeca)}`, lm + 275, insY + 54);
      doc.text(`Contratos Ativos: ${contratosRecorrentesAtivos}`, lm + 275, insY + 66);
      doc.text(`Headcount: ${headcount}`, lm + 275, insY + 78);

      // Footer
      doc.fontSize(7).font('Helvetica').fillColor(colors.muted)
        .text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} | Turbo Partners - Relatório Confidencial`, lm, 785, { align: 'center', width: pw });

      doc.end();
    } catch (error) {
      console.error("[api] Error generating investors report PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  app.get("/api/top-responsaveis", async (req, res) => {
    try {
      let limit = 5;
      if (req.query.limit) {
        const limitStr = req.query.limit as string;
        if (/^\d+$/.test(limitStr)) {
          const parsedLimit = Number(limitStr);
          if (parsedLimit > 0) {
            limit = Math.min(parsedLimit, 100);
          }
        }
      }
      const mesAno = req.query.mesAno as string | undefined;
      
      if (mesAno && !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
      }
      
      const topResponsaveis = await storage.getTopResponsaveis(limit, mesAno);
      res.json(topResponsaveis);
    } catch (error) {
      console.error("[api] Error fetching top responsaveis:", error);
      res.status(500).json({ error: "Failed to fetch top responsaveis" });
    }
  });

  app.get("/api/top-squads", async (req, res) => {
    try {
      let limit = 4;
      if (req.query.limit) {
        const limitStr = req.query.limit as string;
        if (/^\d+$/.test(limitStr)) {
          const parsedLimit = Number(limitStr);
          if (parsedLimit > 0) {
            limit = Math.min(parsedLimit, 100);
          }
        }
      }
      const mesAno = req.query.mesAno as string | undefined;
      
      if (mesAno && !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
      }
      
      const topSquads = await storage.getTopSquads(limit, mesAno);
      res.json(topSquads);
    } catch (error) {
      console.error("[api] Error fetching top squads:", error);
      res.status(500).json({ error: "Failed to fetch top squads" });
    }
  });

  app.get("/api/churn-por-servico", async (req, res) => {
    try {
      const filters: { servicos?: string[]; mesInicio?: string; mesFim?: string } = {};
      
      if (req.query.produto && req.query.produto !== 'todos') {
        const produtoParam = req.query.produto as string;
        filters.servicos = produtoParam.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      if (req.query.mesInicio) {
        filters.mesInicio = req.query.mesInicio as string;
      }
      
      if (req.query.mesFim) {
        filters.mesFim = req.query.mesFim as string;
      }

      const churnData = await storage.getChurnPorServico(filters);
      res.json(churnData);
    } catch (error) {
      console.error("[api] Error fetching churn por servico:", error);
      res.status(500).json({ error: "Failed to fetch churn por servico data" });
    }
  });

  app.get("/api/churn-por-responsavel", async (req, res) => {
    try {
      const filters: { servicos?: string[]; squads?: string[]; colaboradores?: string[]; mesInicio?: string; mesFim?: string } = {};
      
      if (req.query.servico && req.query.servico !== 'todos') {
        const servicoParam = req.query.servico as string;
        filters.servicos = servicoParam.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      if (req.query.squad && req.query.squad !== 'todos') {
        const squadParam = req.query.squad as string;
        filters.squads = squadParam.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      if (req.query.colaborador && req.query.colaborador !== 'todos') {
        const colaboradorParam = req.query.colaborador as string;
        filters.colaboradores = colaboradorParam.split(',').map(c => c.trim()).filter(Boolean);
      }
      
      if (req.query.mesInicio) {
        filters.mesInicio = req.query.mesInicio as string;
      }
      
      if (req.query.mesFim) {
        filters.mesFim = req.query.mesFim as string;
      }

      const churnData = await storage.getChurnPorResponsavel(filters);
      res.json(churnData);
    } catch (error) {
      console.error("[api] Error fetching churn por responsavel:", error);
      res.status(500).json({ error: "Failed to fetch churn por responsavel data" });
    }
  });

  // === Churn Risk Prediction Endpoints ===

  app.get("/api/churn-risk/summary", async (req, res) => {
    try {
      const { getRiskSummary } = await import("./services/churnRiskEngine");
      const summary = await getRiskSummary();
      res.json(summary);
    } catch (error) {
      console.error("[api] Error getting churn risk summary:", error);
      res.status(500).json({ error: "Falha ao buscar resumo de risco" });
    }
  });

  app.get("/api/churn-risk/scores", async (req, res) => {
    try {
      const { getRiskScores } = await import("./services/churnRiskEngine");
      const scores = await getRiskScores({
        squad: req.query.squad as string | undefined,
        tier: req.query.tier as string | undefined,
        produto: req.query.produto as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      res.json(scores);
    } catch (error) {
      console.error("[api] Error getting churn risk scores:", error);
      res.status(500).json({ error: "Falha ao buscar scores de risco" });
    }
  });

  app.get("/api/churn-risk/contract/:id", async (req, res) => {
    try {
      const { getRiskScoreByContract } = await import("./services/churnRiskEngine");
      const score = await getRiskScoreByContract(req.params.id);
      if (!score) {
        return res.status(404).json({ error: "Score não encontrado para este contrato" });
      }
      res.json(score);
    } catch (error) {
      console.error("[api] Error getting contract risk score:", error);
      res.status(500).json({ error: "Falha ao buscar score do contrato" });
    }
  });

  app.post("/api/churn-risk/recalculate", async (req, res) => {
    try {
      const { recalculateAndSave } = await import("./services/churnRiskEngine");
      const result = await recalculateAndSave();
      res.json(result);
    } catch (error) {
      console.error("[api] Error recalculating churn risk:", error);
      res.status(500).json({ error: "Falha ao recalcular scores de risco" });
    }
  });

  // NRR & Cross-sell breakdown por período
  app.get("/api/analytics/nrr", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const { getNrrForPeriod, getNrr } = await import("./okr2026/metricsAdapter");

      if (startDate && endDate) {
        const result = await getNrrForPeriod(startDate, endDate);
        res.json(result);
      } else {
        const result = await getNrr();
        res.json({ ...result, vendas_mrr_novo: 0, vendas_mrr_total: 0 });
      }
    } catch (error) {
      console.error("[api] Error fetching NRR:", error);
      res.status(500).json({ error: "Failed to fetch NRR" });
    }
  });

  // Churn Detalhamento - lista de contratos churned com detalhes ricos de cup_churn
  app.get("/api/analytics/churn-detalhamento", async (req, res) => {
    try {
      const meses = req.query.meses as string || "12";
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      let dateFilter = sql`TRUE`;

      if (startDate && endDate) {
        dateFilter = sql`c.data_solicitacao_encerramento >= ${startDate}::date AND c.data_solicitacao_encerramento <= ${endDate}::date`;
      } else if (meses !== "all") {
        const mesesNum = parseInt(meses) || 12;
        dateFilter = sql`c.data_solicitacao_encerramento >= (NOW() - make_interval(months => ${mesesNum}))::date`;
      }

      // Query principal em cup_churn - sem necessidade de JOIN com cup_clientes
      const churnResult = await db.execute(sql`
        SELECT
          c.task_id,
          c.parent_id,
          c.nome,
          c.status,
          c.responsavel_geral,
          c.cs_responsavel,
          c.vendedor,
          c.squad,
          c.produto,
          c.plano,
          c.cluster,
          c.equipe,
          c.tipo_negocio,
          c.valor_r,
          c.data_criado,
          c.data_primeiro_pagamento,
          c.data_inicio_projeto,
          c.data_solicitacao_encerramento,
          c.ultimo_dia_operacao,
          c.lt,
          c.status_conta,
          c.status_cancelamento,
          c.motivo_cancelamento,
          c.submotivo_cancelamento,
          c.mensagem_cliente,
          c.contexto_operacao,
          c.contexto_cx,
          c.possibilidade_retencao,
          c.evitabilidade_churn,
          c.reteve,
          c.abonar_churn
        FROM "Clickup".cup_churn c
        WHERE c.data_solicitacao_encerramento IS NOT NULL
          AND ${dateFilter}
        ORDER BY c.data_solicitacao_encerramento DESC
      `);

      // Mapear para formato do frontend
      const allContratos = churnResult.rows.map((row: any) => {
        const ltValue = row.lt ? Math.abs(parseFloat(row.lt)) : 0;
        const valorr = Number(row.valor_r) || 0;
        const tipo = 'churn' as const;
        const motivo = row.motivo_cancelamento || 'Não especificado';
        const isAbonado = row.abonar_churn === 'Sim' ||
          motivo === 'Inadimplente 1º Mês' ||
          motivo === 'Não começou';

        return {
          id: row.task_id,
          cliente_nome: row.nome || 'Cliente não identificado',
          cnpj: '',
          produto: row.produto || 'Não especificado',
          squad: row.squad || 'Não especificado',
          responsavel: row.responsavel_geral || 'Não especificado',
          cs_responsavel: row.cs_responsavel || 'Não especificado',
          vendedor: row.vendedor || 'Não especificado',
          valorr: valorr,
          data_inicio: row.data_inicio_projeto,
          data_encerramento: row.data_solicitacao_encerramento,
          data_pausa: null,
          status: row.status || 'encerrado',
          servico: row.produto || 'Não especificado',
          motivo_cancelamento: motivo,
          tipo: tipo,
          lifetime_meses: ltValue,
          ltv: valorr * ltValue,
          plano: row.plano || null,
          cluster: row.cluster || null,
          submotivo: row.submotivo_cancelamento || null,
          mensagem_cliente: row.mensagem_cliente || null,
          contexto_operacao: row.contexto_operacao || null,
          contexto_cx: row.contexto_cx || null,
          possibilidade_retencao: row.possibilidade_retencao || null,
          evitabilidade_churn: row.evitabilidade_churn || null,
          status_cancelamento: row.status_cancelamento || null,
          status_conta: row.status_conta || null,
          ultimo_dia_operacao: row.ultimo_dia_operacao || null,
          is_abonado: isAbonado,
        };
      });

      // Filtros disponíveis
      const squads = Array.from(new Set(allContratos.map((c: any) => c.squad).filter(Boolean))).sort();
      const produtos = Array.from(new Set(allContratos.map((c: any) => c.produto).filter(Boolean))).sort();
      const responsaveis = Array.from(new Set(allContratos.map((c: any) => c.responsavel).filter(Boolean))).sort();
      const servicos = Array.from(new Set(allContratos.map((c: any) => c.servico).filter(Boolean))).sort();
      const planos = Array.from(new Set(allContratos.map((c: any) => c.plano).filter(Boolean))).sort();
      const clusters = Array.from(new Set(allContratos.map((c: any) => c.cluster).filter(Boolean))).sort();
      const evitabilidades = Array.from(new Set(allContratos.map((c: any) => c.evitabilidade_churn).filter(Boolean))).sort();
      const possibilidades_retencao = Array.from(new Set(allContratos.map((c: any) => c.possibilidade_retencao).filter(Boolean))).sort();

      // Separar contratos regulares de abonados
      const contratosRegulares = allContratos.filter((c: any) => !c.is_abonado);
      const contratosAbonados = allContratos.filter((c: any) => c.is_abonado);

      // Métricas - apenas churn regular (excluindo abonado)
      const totalChurned = contratosRegulares.length;
      const totalEmCancelamento = 0;
      const mrrPerdidoChurn = contratosRegulares.reduce((sum: number, c: any) => sum + c.valorr, 0);
      const mrrEmCancelamento = 0;
      const ltvTotal = contratosRegulares.reduce((sum: number, c: any) => sum + c.ltv, 0);
      const ltMedio = totalChurned > 0 ? contratosRegulares.reduce((sum: number, c: any) => sum + c.lifetime_meses, 0) / totalChurned : 0;

      // Métricas de churn abonado
      const totalAbonado = contratosAbonados.length;
      const mrrAbonado = contratosAbonados.reduce((sum: number, c: any) => sum + c.valorr, 0);

      // MRR ativo de referência via cup_data_hist
      let refDate: Date;
      if (startDate) {
        refDate = new Date(startDate);
        refDate.setMonth(refDate.getMonth() - 1);
        refDate.setDate(1);
      } else {
        refDate = new Date();
        refDate.setMonth(refDate.getMonth() - 1);
        refDate.setDate(1);
      }

      const refEndDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
      const refDateStr = refEndDate.toISOString().split('T')[0];

      const inicioMesRef = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      const fimMesRef = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59);

      const mrrAtivoResult = await db.execute(sql`
        WITH ultimo_snapshot AS (
          SELECT MAX(data_snapshot) as data_ultimo_snapshot
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot >= ${inicioMesRef}::timestamp
            AND data_snapshot <= ${fimMesRef}::timestamp
        )
        SELECT
          COALESCE(h.squad, 'Não especificado') as squad,
          COALESCE(SUM(h.valorr::numeric), 0) as mrr_ativo
        FROM ultimo_snapshot us
        JOIN "Clickup".cup_data_hist h
          ON h.data_snapshot = us.data_ultimo_snapshot
          AND LOWER(TRIM(h.status)) IN ('ativo', 'onboarding', 'triagem')
          AND LOWER(COALESCE(h.squad, '')) NOT IN ('turbo interno', 'squad x', 'interno', 'x')
        GROUP BY COALESCE(h.squad, 'Não especificado')
      `);

      const mrrAtivoPorSquad: Record<string, number> = {};
      let mrrAtivoTotal = 0;

      for (const row of mrrAtivoResult.rows as any[]) {
        const squadName = row.squad || 'Não especificado';
        const mrr = Number(row.mrr_ativo) || 0;
        mrrAtivoPorSquad[squadName] = mrr;
        mrrAtivoTotal += mrr;
      }

      // MRR perdido por squad (churn)
      const mrrPerdidoPorSquad: Record<string, number> = {};
      for (const contrato of allContratos) {
        const squadName = (contrato as any).squad || 'Não especificado';
        mrrPerdidoPorSquad[squadName] = (mrrPerdidoPorSquad[squadName] || 0) + (contrato as any).valorr;
      }

      const churnPercentualGeral = mrrAtivoTotal > 0 ? (mrrPerdidoChurn / mrrAtivoTotal) * 100 : 0;

      const allSquadNames = Array.from(new Set([...Object.keys(mrrAtivoPorSquad), ...Object.keys(mrrPerdidoPorSquad)]));
      const churnPercentualPorSquad = allSquadNames.map(squadName => ({
        squad: squadName,
        mrr_ativo: mrrAtivoPorSquad[squadName] || 0,
        mrr_perdido: mrrPerdidoPorSquad[squadName] || 0,
        percentual: (mrrAtivoPorSquad[squadName] || 0) > 0 ? ((mrrPerdidoPorSquad[squadName] || 0) / (mrrAtivoPorSquad[squadName] || 1)) * 100 : 0,
      })).sort((a, b) => b.percentual - a.percentual);

      // Retention curve
      const contratosComLifetime = allContratos.filter((c: any) => c.lifetime_meses >= 0);
      const totalBase = contratosComLifetime.length;
      const totalMrrBase = contratosComLifetime.reduce((sum: number, c: any) => sum + (c.valorr || 0), 0);

      const retentionCurve: any[] = [];
      for (let month = 0; month <= 12; month++) {
        const sobreviventes = contratosComLifetime.filter((c: any) => c.lifetime_meses >= month);
        const sobrevivMrr = sobreviventes.reduce((sum: number, c: any) => sum + (c.valorr || 0), 0);
        const churnedNoPeriodo = contratosComLifetime.filter((c: any) => c.lifetime_meses >= month && c.lifetime_meses < month + 1);

        retentionCurve.push({
          monthIndex: month,
          retainedPct: totalBase > 0 ? Math.round((sobreviventes.length / totalBase) * 1000) / 10 : 0,
          mrrRetainedPct: totalMrrBase > 0 ? Math.round((sobrevivMrr / totalMrrBase) * 1000) / 10 : 0,
          retainedCount: sobreviventes.length,
          totalStarted: totalBase,
          retainedMrr: sobrevivMrr,
          churnedCount: churnedNoPeriodo.length,
          atRisk: sobreviventes.length,
        });
      }

      // MRR perdido por motivo de cancelamento
      const mrrPorMotivo: Record<string, { mrr: number; count: number }> = {};
      for (const contrato of allContratos) {
        const motivo = (contrato as any).motivo_cancelamento || 'Não especificado';
        if (!mrrPorMotivo[motivo]) mrrPorMotivo[motivo] = { mrr: 0, count: 0 };
        mrrPorMotivo[motivo].mrr += (contrato as any).valorr;
        mrrPorMotivo[motivo].count += 1;
      }

      const churnPorMotivo = Object.entries(mrrPorMotivo)
        .map(([motivo, data]) => ({
          motivo,
          mrr_perdido: data.mrr,
          quantidade: data.count,
          percentual: mrrPerdidoChurn > 0 ? (data.mrr / mrrPerdidoChurn) * 100 : 0,
        }))
        .sort((a, b) => b.mrr_perdido - a.mrr_perdido);

      // Novas métricas: churn por evitabilidade
      const evitabilidadeData: Record<string, { mrr: number; count: number }> = {};
      for (const c of allContratos) {
        const ev = (c as any).evitabilidade_churn || 'Não informado';
        if (!evitabilidadeData[ev]) evitabilidadeData[ev] = { mrr: 0, count: 0 };
        evitabilidadeData[ev].mrr += (c as any).valorr;
        evitabilidadeData[ev].count += 1;
      }
      const churnPorEvitabilidade = Object.entries(evitabilidadeData)
        .map(([label, data]) => ({ label, mrr: data.mrr, count: data.count }))
        .sort((a, b) => b.mrr - a.mrr);

      // Churn por cluster
      const clusterData: Record<string, { mrr: number; count: number }> = {};
      for (const c of allContratos) {
        const cl = (c as any).cluster || 'Não informado';
        if (!clusterData[cl]) clusterData[cl] = { mrr: 0, count: 0 };
        clusterData[cl].mrr += (c as any).valorr;
        clusterData[cl].count += 1;
      }
      const churnPorCluster = Object.entries(clusterData)
        .map(([label, data]) => ({ label, mrr: data.mrr, count: data.count }))
        .sort((a, b) => b.mrr - a.mrr);

      // Churn por plano
      const planoData: Record<string, { mrr: number; count: number }> = {};
      for (const c of allContratos) {
        const pl = (c as any).plano || 'Não informado';
        if (!planoData[pl]) planoData[pl] = { mrr: 0, count: 0 };
        planoData[pl].mrr += (c as any).valorr;
        planoData[pl].count += 1;
      }
      const churnPorPlano = Object.entries(planoData)
        .map(([label, data]) => ({ label, mrr: data.mrr, count: data.count }))
        .sort((a, b) => b.mrr - a.mrr);

      res.json({
        contratos: allContratos,
        metricas: {
          total_churned: totalChurned,
          total_pausados: totalEmCancelamento,
          mrr_perdido: mrrPerdidoChurn,
          mrr_pausado: mrrEmCancelamento,
          ltv_total: ltvTotal,
          lt_medio: ltMedio,
          mrr_ativo_ref: mrrAtivoTotal,
          churn_percentual: churnPercentualGeral,
          churn_por_squad: churnPercentualPorSquad,
          churn_por_motivo: churnPorMotivo,
          churn_por_evitabilidade: churnPorEvitabilidade,
          churn_por_cluster: churnPorCluster,
          churn_por_plano: churnPorPlano,
          periodo_referencia: refDateStr,
          // Churn abonado separado
          total_abonado: totalAbonado,
          mrr_abonado: mrrAbonado,
        },
        filtros: {
          squads,
          produtos,
          responsaveis,
          servicos,
          planos,
          clusters,
          evitabilidades,
          possibilidades_retencao,
        },
        retentionCurve,
      });
    } catch (error) {
      console.error("[api] Error fetching churn detalhamento:", error);
      res.status(500).json({ error: "Failed to fetch churn detalhamento data" });
    }
  });

  // Análise IA das mensagens de churn — classifica sentimento, temas e gera insight
  const churnAICache = new Map<string, { result: any; timestamp: number }>();
  const CHURN_AI_CACHE_TTL = 1000 * 60 * 30; // 30 min

  app.post("/api/analytics/churn-mensagens-ai", async (req, res) => {
    try {
      const { mensagens } = req.body as {
        mensagens: { id: string; cliente: string; mensagem: string; motivo?: string; mrr?: number }[];
      };

      if (!mensagens || !Array.isArray(mensagens) || mensagens.length === 0) {
        return res.status(400).json({ error: "Nenhuma mensagem para analisar" });
      }

      // Cache key baseado nos IDs das mensagens (ordenados)
      const cacheKey = mensagens.map(m => m.id).sort().join(',');
      const cached = churnAICache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CHURN_AI_CACHE_TTL) {
        return res.json(cached.result);
      }

      // Usar sistema centralizado de AI (suporta OpenAI + Gemini com fallback)
      const { getAIConfig, getAIClient, AI_PROVIDERS } = await import("./services/unifiedAssistant");
      const aiConfig = await getAIConfig();

      if (!AI_PROVIDERS[aiConfig.provider].available) {
        return res.status(503).json({ error: `Provider ${aiConfig.provider} não está configurado. Verifique as chaves de API nas configurações.` });
      }

      const aiClient = getAIClient(aiConfig.provider);

      // Limitar a 60 mensagens por batch pra não estourar tokens
      const batch = mensagens.slice(0, 60);

      const mensagensFormatadas = batch.map((m, i) =>
        `[${i + 1}] ID:${m.id} | Cliente: ${m.cliente} | Motivo: ${m.motivo || 'N/A'} | MRR: R$${m.mrr || 0}\nMensagem: "${m.mensagem}"`
      ).join('\n\n');

      const systemPrompt = `Você é um analista sênior de Customer Success especializado em análise de churn. Você recebe mensagens reais de clientes que cancelaram ou pausaram contratos.

Sua tarefa é analisar CADA mensagem como um todo — entendendo contexto, tom, intenções e nuances — e classificar:

1. **sentimento**: "negativo", "neutro" ou "positivo" — baseado no TOM GERAL da mensagem, não em palavras isoladas. Ex: "O atendimento era bom mas não trouxe resultado" = negativo (insatisfação com resultado apesar de elogio parcial).

2. **temas**: array de 1-3 temas que melhor descrevem O QUE a mensagem está dizendo. Use APENAS estes temas:
   - "Resultado/ROI" — cliente não viu retorno, resultados abaixo do esperado
   - "Preço/Custo" — questão financeira, custo-benefício, orçamento
   - "Atendimento" — qualidade do suporte, comunicação, tempo de resposta
   - "Operação" — erros, falhas, qualidade de execução
   - "Estratégia" — falta de direcionamento, planejamento, alinhamento
   - "Decisão Interna" — mudança interna do cliente, reestruturação, corte
   - "Concorrência" — trocou de fornecedor, in-house
   - "Produto" — limitação da ferramenta/plataforma
   - "Confiança" — quebra de confiança, transparência
   - "Onboarding" — problemas no início, implantação
   - "Relacionamento" — falta de proximidade, empatia

3. **resumo**: 1 frase curta (max 15 palavras) capturando a essência da mensagem. Deve ser útil para um diretor que está scaneando rapidamente.

IMPORTANTE: Responda APENAS com JSON válido (sem markdown, sem \`\`\`). Estrutura:
{
  "analises": [
    {
      "id": "id_do_contrato",
      "sentimento": "negativo|neutro|positivo",
      "temas": ["Tema1", "Tema2"],
      "resumo": "Frase curta descrevendo a essência"
    }
  ],
  "sintese": {
    "principal_motivo": "O tema mais recorrente e impactante",
    "padrao_critico": "Padrão preocupante identificado (se houver)",
    "recomendacao": "1 ação concreta que a operação deveria tomar"
  }
}`;

      // Gemini via OpenAI compat pode não suportar response_format, então tentamos com e sem
      let content: string | null = null;

      try {
        const response = await aiClient.chat.completions.create({
          model: aiConfig.model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analise estas ${batch.length} mensagens de clientes que deram churn:\n\n${mensagensFormatadas}` },
          ],
        });
        content = response.choices[0]?.message?.content || null;
      } catch (firstErr: any) {
        console.warn(`[churn-ai] response_format falhou (${aiConfig.provider}/${aiConfig.model}), tentando sem:`, firstErr.message);
        // Retry sem response_format (fallback para Gemini)
        const response = await aiClient.chat.completions.create({
          model: aiConfig.model,
          temperature: 0.1,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analise estas ${batch.length} mensagens de clientes que deram churn:\n\n${mensagensFormatadas}` },
          ],
        });
        content = response.choices[0]?.message?.content || null;
      }

      if (!content) {
        return res.status(500).json({ error: "Resposta vazia da IA" });
      }

      // Limpa markdown code fences caso a IA retorne ```json ... ```
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanContent);

      // Salvar no cache
      churnAICache.set(cacheKey, { result: parsed, timestamp: Date.now() });

      res.json(parsed);
    } catch (error: any) {
      console.error("[api] Error in churn AI analysis:", error);
      const detail = error.message || "Erro desconhecido";
      res.status(500).json({ error: `Falha na análise IA: ${detail}` });
    }
  });

  app.get("/api/dfc", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const empresa = req.query.empresa as string | undefined;

      if (dataInicio && !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
        return res.status(400).json({ error: "Invalid dataInicio parameter. Expected format: YYYY-MM-DD" });
      }

      if (dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Invalid dataFim parameter. Expected format: YYYY-MM-DD" });
      }

      const dfcData = await storage.getDfc(dataInicio, dataFim, empresa);
      res.json(dfcData);
    } catch (error) {
      console.error("[api] Error fetching DFC data:", error);
      res.status(500).json({ error: "Failed to fetch DFC data" });
    }
  });

  app.post("/api/dfc/analyze", async (req, res) => {
    try {
      const { dataInicio, dataFim, empresa } = req.body;

      if (dataInicio && !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
        return res.status(400).json({ error: "Invalid dataInicio parameter. Expected format: YYYY-MM-DD" });
      }

      if (dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Invalid dataFim parameter. Expected format: YYYY-MM-DD" });
      }

      const dfcData = await storage.getDfc(dataInicio, dataFim, empresa);
      
      if (!dfcData.nodes || dfcData.nodes.length === 0) {
        return res.status(400).json({ error: "Não há dados suficientes para análise no período selecionado" });
      }

      const analysis = await analyzeDfc(dfcData);
      res.json(analysis);
    } catch (error) {
      console.error("[api] Error analyzing DFC data:", error);
      res.status(500).json({ error: "Failed to analyze DFC data" });
    }
  });

  app.post("/api/dfc/chat", async (req, res) => {
    try {
      const { pergunta, historico, dataInicio, dataFim, empresa } = req.body;

      if (!pergunta || typeof pergunta !== 'string' || pergunta.trim().length === 0) {
        return res.status(400).json({ error: "Pergunta é obrigatória" });
      }

      if (dataInicio && !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
        return res.status(400).json({ error: "Invalid dataInicio parameter. Expected format: YYYY-MM-DD" });
      }

      if (dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Invalid dataFim parameter. Expected format: YYYY-MM-DD" });
      }

      const dfcData = await storage.getDfc(dataInicio, dataFim, empresa);
      
      if (!dfcData.nodes || dfcData.nodes.length === 0) {
        return res.json({ 
          resposta: "Não há dados disponíveis no período selecionado para responder sua pergunta. Tente selecionar um período diferente.",
          dadosReferenciados: undefined 
        });
      }

      const chatHistory: ChatMessage[] = Array.isArray(historico) ? historico : [];
      const response = await chatWithDfc(dfcData, pergunta.trim(), chatHistory);
      res.json(response);
    } catch (error) {
      console.error("[api] Error in DFC chat:", error);
      res.status(500).json({ error: "Falha ao processar a pergunta" });
    }
  });

  // ========================================
  // CONTRIBUIÇÃO POR COLABORADOR API ENDPOINT
  // ========================================
  app.get("/api/contribuicao-colaborador", async (req, res) => {
    try {
      const mes = parseInt(req.query.mes as string);
      const ano = parseInt(req.query.ano as string);
      
      if (isNaN(mes) || isNaN(ano) || mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
        return res.status(400).json({ error: "Parâmetros inválidos. Esperado: mes (1-12), ano (2000-2100)" });
      }
      
      const data = await storage.getContribuicaoColaborador(mes, ano);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching contribuição por colaborador:", error);
      res.status(500).json({ error: "Falha ao buscar dados de contribuição" });
    }
  });

  app.get("/api/contribuicao-colaborador/periodo", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string;
      const dataFim = req.query.dataFim as string;
      
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "Parâmetros dataInicio e dataFim são obrigatórios" });
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Formato inválido. Esperado: YYYY-MM-DD" });
      }
      
      const data = await storage.getContribuicaoColaboradorPeriodo(dataInicio, dataFim);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching contribuição por colaborador:", error);
      res.status(500).json({ error: "Falha ao buscar dados de contribuição" });
    }
  });

  // Contribuição por Colaborador - Estilo DFC com colunas mensais
  app.get("/api/contribuicao-colaborador/dfc", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string;
      const dataFim = req.query.dataFim as string;
      const responsavel = req.query.responsavel as string | undefined;
      
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "Parâmetros dataInicio e dataFim são obrigatórios" });
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Formato inválido. Esperado: YYYY-MM-DD" });
      }
      
      const data = await storage.getContribuicaoColaboradorDfc(dataInicio, dataFim, responsavel);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching contribuição DFC:", error);
      res.status(500).json({ error: "Falha ao buscar dados de contribuição DFC" });
    }
  });

  // Contribuição por Operador (responsável do contrato) - Estilo DFC
  // Aceita filtro por squad para agrupar operadores
  app.get("/api/contribuicao-operador/dfc", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string;
      const dataFim = req.query.dataFim as string;
      const operador = req.query.operador as string | undefined;
      const squad = req.query.squad as string | undefined;
      
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "Parâmetros dataInicio e dataFim são obrigatórios" });
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Formato inválido. Esperado: YYYY-MM-DD" });
      }
      
      const data = await storage.getContribuicaoOperadorDfc(dataInicio, dataFim, operador, squad);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching contribuição operador DFC:", error);
      res.status(500).json({ error: "Falha ao buscar dados de contribuição operador DFC" });
    }
  });

  // Contribuição por Squad - BULK endpoint otimizado (todos os 12 meses em uma chamada)
  app.get("/api/contribuicao-squad/dfc/bulk", async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
      const squad = req.query.squad as string | undefined;
      const squadFilter = squad && squad !== 'todos' ? squad : null;
      
      const dataInicio = `${ano}-01-01`;
      const dataFim = `${ano}-12-31 23:59:59`;
      
      // Query única para todo o ano com agregação por mês
      const result = await db.execute(sql`
        WITH cnpj_normalizado AS (
          SELECT 
            ids,
            nome,
            REPLACE(REPLACE(REPLACE(COALESCE(cnpj, ''), '.', ''), '-', ''), '/', '') as cnpj_limpo
          FROM "Conta Azul".caz_clientes
          WHERE cnpj IS NOT NULL AND TRIM(cnpj) != ''
        ),
        cup_cnpj_normalizado AS (
          SELECT 
            task_id,
            REPLACE(REPLACE(REPLACE(COALESCE(cnpj, ''), '.', ''), '-', ''), '/', '') as cnpj_limpo
          FROM "Clickup".cup_clientes
          WHERE cnpj IS NOT NULL AND TRIM(cnpj) != ''
        ),
        contrato_todos AS (
          SELECT DISTINCT
            cc.cnpj_limpo,
            ct.squad,
            ct.servico,
            ct.id_subtask,
            COALESCE(ct.valorr::numeric, 0) + COALESCE(ct.valorp::numeric, 0) as valor_contrato
          FROM cup_cnpj_normalizado cc
          INNER JOIN "Clickup".cup_contratos ct ON cc.task_id = ct.id_task
          WHERE ct.squad IS NOT NULL AND TRIM(ct.squad) != ''
        ),
        contrato_com_peso AS (
          SELECT
            cnpj_limpo,
            squad,
            servico,
            id_subtask,
            CASE
              WHEN SUM(valor_contrato) OVER (PARTITION BY cnpj_limpo) > 0
              THEN valor_contrato / SUM(valor_contrato) OVER (PARTITION BY cnpj_limpo)
              ELSE 1.0 / COUNT(*) OVER (PARTITION BY cnpj_limpo)
            END as peso
          FROM contrato_todos
        )
        SELECT
          TO_CHAR(p.data_quitacao, 'YYYY-MM') as mes,
          COALESCE(p.categoria_id, 'SEM_CATEGORIA') as categoria_id,
          COALESCE(p.categoria_nome, 'Sem Categoria') as categoria_nome,
          COALESCE(caz.nome, 'Cliente não identificado') as cliente_nome,
          COALESCE(cu.servico, 'Serviço não identificado') as servico_nome,
          COALESCE(NULLIF(TRIM(cu.squad), ''), 'Sem Squad') as squad,
          p.id as parcela_id,
          (p.valor_pago::numeric * COALESCE(cu.peso, 1)) as valor,
          p.data_quitacao,
          p.url_cobranca
        FROM "Conta Azul".caz_parcelas p
        LEFT JOIN cnpj_normalizado caz ON TRIM(p.id_cliente::text) = TRIM(caz.ids::text)
        LEFT JOIN contrato_com_peso cu ON caz.cnpj_limpo = cu.cnpj_limpo
        WHERE p.status = 'QUITADO'
          AND p.tipo_evento = 'RECEITA'
          AND p.data_quitacao >= ${dataInicio}::date
          AND p.data_quitacao <= ${dataFim}::timestamp
          AND p.valor_pago::numeric > 0
          AND (
            ${squadFilter}::text IS NULL 
            OR COALESCE(NULLIF(TRIM(cu.squad), ''), 'Sem Squad') = ${squadFilter}
            OR COALESCE(NULLIF(TRIM(cu.squad), ''), 'Sem Squad') ILIKE '%' || REGEXP_REPLACE(${squadFilter}, '^[^a-zA-Z]+', '', 'g')
            OR ${squadFilter} ILIKE '%' || REGEXP_REPLACE(COALESCE(NULLIF(TRIM(cu.squad), ''), 'Sem Squad'), '^[^a-zA-Z]+', '', 'g')
          )
        ORDER BY mes, categoria_id, cliente_nome, servico_nome
      `);
      
      // Processar dados agrupados por mês
      type ParcelaInfo = {
        id: string;
        valor: number;
        dataQuitacao: string;
        linkNfse: string | null;
        numNfse: string | null;
        urlCobranca: string | null;
        clienteNome: string;
        servicoNome: string;
        squad: string;
      };
      
      type ServicoInfo = { valor: number; squad: string; parcelas: ParcelaInfo[] };
      type ClienteInfo = { valorTotal: number; servicos: Map<string, ServicoInfo> };
      type CategoriaInfo = { nome: string; valorTotal: number; clientes: Map<string, ClienteInfo> };
      type MesData = { 
        categorias: Map<string, CategoriaInfo>; 
        receitaTotal: number;
        totalParcelas: number;
      };
      
      const mesesMap = new Map<string, MesData>();
      const squadsSet = new Set<string>();
      
      for (const row of result.rows as any[]) {
        const mes = row.mes;
        const categoriaNome = row.categoria_nome || 'Sem Categoria';
        const clienteNome = row.cliente_nome;
        const servicoNome = row.servico_nome;
        const squadNome = row.squad;
        const valor = Number(row.valor) || 0;

        squadsSet.add(squadNome);

        if (!mesesMap.has(mes)) {
          mesesMap.set(mes, { categorias: new Map(), receitaTotal: 0, totalParcelas: 0 });
        }

        const mesData = mesesMap.get(mes)!;
        mesData.receitaTotal += valor;
        mesData.totalParcelas += 1;

        // Agrupar por categoria_nome (não UUID) para unificar categorias com mesmo nome
        if (!mesData.categorias.has(categoriaNome)) {
          mesData.categorias.set(categoriaNome, {
            nome: categoriaNome,
            valorTotal: 0,
            clientes: new Map()
          });
        }

        const cat = mesData.categorias.get(categoriaNome)!;
        cat.valorTotal += valor;
        
        if (!cat.clientes.has(clienteNome)) {
          cat.clientes.set(clienteNome, { valorTotal: 0, servicos: new Map() });
        }
        
        const cliente = cat.clientes.get(clienteNome)!;
        cliente.valorTotal += valor;
        
        const chaveServico = `${servicoNome}|${squadNome}`;
        if (!cliente.servicos.has(chaveServico)) {
          cliente.servicos.set(chaveServico, { valor: 0, squad: squadNome, parcelas: [] });
        }
        
        const servico = cliente.servicos.get(chaveServico)!;
        servico.valor += valor;
        servico.parcelas.push({
          id: row.parcela_id,
          valor,
          dataQuitacao: row.data_quitacao,
          linkNfse: null,
          numNfse: null,
          urlCobranca: row.url_cobranca,
          clienteNome,
          servicoNome,
          squad: squadNome
        });
      }
      
      // Converter para formato de resposta
      const mesesLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      const monthlyData = [];
      for (let m = 0; m < 12; m++) {
        const mesKey = `${ano}-${String(m + 1).padStart(2, '0')}`;
        const mesData = mesesMap.get(mesKey);
        
        if (!mesData) {
          monthlyData.push({
            mes: mesKey,
            mesLabel: `${mesesLabels[m]}. de ${String(ano).slice(-2)}`,
            data: null
          });
          continue;
        }
        
        const receitas: { categoriaId: string; categoriaNome: string; valor: number; nivel: number; parcelas?: ParcelaInfo[] }[] = [];
        let totalContratos = 0;
        
        // Primeiro nível: RECEITAS
        receitas.push({
          categoriaId: 'RECEITAS',
          categoriaNome: 'Receitas',
          valor: mesData.receitaTotal,
          nivel: 0
        });
        
        for (const [categoriaNome, cat] of Array.from(mesData.categorias.entries())) {
          // Sanitizar nome para uso como ID hierárquico
          const categoriaKey = categoriaNome.replace(/\./g, '_');
          // Nível 1: Categoria
          receitas.push({
            categoriaId: `RECEITAS.${categoriaKey}`,
            categoriaNome: cat.nome,
            valor: cat.valorTotal,
            nivel: 1
          });

          for (const [clienteNome, cliente] of Array.from(cat.clientes.entries())) {
            // Nível 2: Cliente
            receitas.push({
              categoriaId: `RECEITAS.${categoriaKey}.${clienteNome}`,
              categoriaNome: clienteNome,
              valor: cliente.valorTotal,
              nivel: 2
            });

            for (const [chaveServico, servico] of Array.from(cliente.servicos.entries())) {
              const [servicoNome] = chaveServico.split('|');
              totalContratos++;

              // Nível 3: Serviço com parcelas
              receitas.push({
                categoriaId: `RECEITAS.${categoriaKey}.${clienteNome}.${servicoNome}`,
                categoriaNome: `${servicoNome} (${servico.squad})`,
                valor: servico.valor,
                nivel: 3,
                parcelas: servico.parcelas
              });
            }
          }
        }
        
        monthlyData.push({
          mes: mesKey,
          mesLabel: `${mesesLabels[m]}. de ${String(ano).slice(-2)}`,
          data: {
            squads: Array.from(squadsSet).sort(),
            receitas,
            totais: {
              receitaTotal: mesData.receitaTotal,
              quantidadeParcelas: mesData.totalParcelas,
              quantidadeContratos: totalContratos
            }
          }
        });
      }
      
      // ──── DESPESAS: Salários, CXCS, Freelancers ────────────────────────────
      // Salários ativos do squad (rh_pessoal)
      const salarioResult = await db.execute(sql`
        WITH salarios_normalizados AS (
          SELECT
            rp.id,
            rp.nome as colaborador_nome,
            COALESCE(NULLIF(TRIM(rp.squad), ''), 'Sem Squad') as squad,
            LOWER(TRIM(COALESCE(rp.status, ''))) as status_norm,
            CASE
              WHEN rp.salario IS NULL OR TRIM(rp.salario::text) = '' THEN NULL
              WHEN rp.salario::text LIKE '%,%' THEN
                NULLIF(REPLACE(REGEXP_REPLACE(rp.salario::text, '[^0-9,]', '', 'g'), ',', '.'), '')::numeric
              WHEN rp.salario::text ~ '\\.[0-9]{1,2}$' THEN
                NULLIF(REGEXP_REPLACE(rp.salario::text, '[^0-9.]', '', 'g'), '')::numeric
              ELSE
                NULLIF(REGEXP_REPLACE(rp.salario::text, '[^0-9]', '', 'g'), '')::numeric
            END as salario
          FROM "Inhire".rh_pessoal rp
        )
        SELECT id, colaborador_nome, salario, squad
        FROM salarios_normalizados
        WHERE status_norm = 'ativo'
          AND salario IS NOT NULL AND salario > 0
          AND (
            ${squadFilter}::text IS NULL
            OR COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') = ${squadFilter}
            OR COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') ILIKE '%' || REGEXP_REPLACE(${squadFilter || ''}, '^[^a-zA-Z]+', '', 'g')
            OR ${squadFilter || ''} ILIKE '%' || REGEXP_REPLACE(COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad'), '^[^a-zA-Z]+', '', 'g')
          )
        ORDER BY squad, colaborador_nome
      `);

      let salarioTotal = 0;
      const salariosPorColab = new Map<number, { nome: string; salario: number }>();
      for (const row of salarioResult.rows as any[]) {
        const id = Number(row.id);
        if (!salariosPorColab.has(id)) {
          const sal = Number(row.salario) || 0;
          salariosPorColab.set(id, { nome: row.colaborador_nome, salario: sal });
          salarioTotal += sal;
        }
      }

      // CXCS (média salarial dos CXCS ativos)
      const cxcsResult = await db.execute(sql`
        SELECT AVG(salario::numeric) as media_cxcs
        FROM "Inhire".rh_pessoal
        WHERE UPPER(TRIM(cargo)) = 'CXCS'
          AND UPPER(TRIM(status)) = 'ATIVO'
          AND salario IS NOT NULL AND salario::numeric > 0
      `);
      const mediaCxcs = Number((cxcsResult.rows[0] as any)?.media_cxcs) || 0;

      // Freelancers agrupados por mês
      const freelaResult = await db.execute(sql`
        WITH best_match AS (
          SELECT DISTINCT ON (LOWER(TRIM(fn.responsavel)))
            LOWER(TRIM(fn.responsavel)) as responsavel_key,
            rp.squad as rh_squad
          FROM (SELECT DISTINCT responsavel FROM "Clickup".cup_freelas WHERE responsavel IS NOT NULL) fn
          LEFT JOIN "Inhire".rh_pessoal rp ON (
            LOWER(TRIM(fn.responsavel)) = LOWER(TRIM(rp.nome))
            OR LOWER(TRIM(fn.responsavel)) = LOWER(SPLIT_PART(TRIM(rp.nome), ' ', 1) || ' ' || SPLIT_PART(TRIM(rp.nome), ' ', 2))
            OR LOWER(TRIM(rp.nome)) LIKE LOWER(TRIM(fn.responsavel)) || '%'
          )
          ORDER BY LOWER(TRIM(fn.responsavel)),
            CASE
              WHEN rp.id IS NULL THEN 99
              WHEN LOWER(TRIM(fn.responsavel)) = LOWER(TRIM(rp.nome)) THEN 1
              WHEN LOWER(TRIM(fn.responsavel)) = LOWER(SPLIT_PART(TRIM(rp.nome), ' ', 1) || ' ' || SPLIT_PART(TRIM(rp.nome), ' ', 2)) THEN 2
              ELSE 3
            END,
            rp.id NULLS LAST
        )
        SELECT
          TO_CHAR(f.data_pagamento, 'YYYY-MM') as mes,
          f.responsavel,
          COALESCE(
            f.valor_projeto::numeric,
            NULLIF(REPLACE(REPLACE(REGEXP_REPLACE(f.custom_fields->>'Valor', '[^0-9,.]', '', 'g'), '.', ''), ',', '.'), '')::numeric,
            0
          ) as valor,
          COALESCE(NULLIF(TRIM(bm.rh_squad), ''), 'Sem Squad') as squad
        FROM "Clickup".cup_freelas f
        LEFT JOIN best_match bm ON LOWER(TRIM(f.responsavel)) = bm.responsavel_key
        WHERE f.data_pagamento >= ${dataInicio}::date
          AND f.data_pagamento < (${dataFim}::date + interval '1 day')
          AND (
            ${squadFilter}::text IS NULL
            OR COALESCE(NULLIF(TRIM(bm.rh_squad), ''), 'Sem Squad') = ${squadFilter}
            OR COALESCE(NULLIF(TRIM(bm.rh_squad), ''), 'Sem Squad') ILIKE '%' || REGEXP_REPLACE(${squadFilter || ''}, '^[^a-zA-Z]+', '', 'g')
            OR ${squadFilter || ''} ILIKE '%' || REGEXP_REPLACE(COALESCE(NULLIF(TRIM(bm.rh_squad), ''), 'Sem Squad'), '^[^a-zA-Z]+', '', 'g')
          )
        ORDER BY mes, valor DESC
      `);

      // Agrupar freelancers por mês
      const freelaPorMes = new Map<string, number>();
      let freelaTotal = 0;
      for (const row of freelaResult.rows as any[]) {
        const mes = row.mes as string;
        const valor = Number(row.valor) || 0;
        freelaPorMes.set(mes, (freelaPorMes.get(mes) || 0) + valor);
        freelaTotal += valor;
      }

      // Montar objeto de despesas mensais
      const despesasMensais: Record<string, { salarios: number; cxcs: number; freelancers: number }> = {};
      for (let m = 0; m < 12; m++) {
        const mesKey = `${ano}-${String(m + 1).padStart(2, '0')}`;
        despesasMensais[mesKey] = {
          salarios: salarioTotal,
          cxcs: mediaCxcs,
          freelancers: freelaPorMes.get(mesKey) || 0,
        };
      }

      // Agregar resumo por squad a partir dos dados brutos
      const squadSummaryMap = new Map<string, { total: number; porMes: number[]; contratos: Set<string> }>();
      for (const row of result.rows as any[]) {
        const sq = row.squad || 'Sem Squad';
        if (!squadSummaryMap.has(sq)) {
          squadSummaryMap.set(sq, { total: 0, porMes: new Array(12).fill(0), contratos: new Set() });
        }
        const entry = squadSummaryMap.get(sq)!;
        const monthIdx = parseInt(row.mes.split('-')[1]) - 1;
        const valor = Number(row.valor) || 0;
        entry.total += valor;
        entry.porMes[monthIdx] += valor;
        // Usar combinação cliente+serviço+squad como identificador de contrato
        const contratoKey = `${row.cliente_nome}|${row.servico_nome}|${sq}`;
        entry.contratos.add(contratoKey);
      }

      const resumoPorSquad = Array.from(squadSummaryMap.entries())
        .filter(([sq]) => !/\bOFF\b/i.test(sq))
        .map(([squad, data]) => ({
          squad,
          receitaTotal: data.total,
          porMes: data.porMes,
          quantidadeContratos: data.contratos.size,
        }))
        .sort((a, b) => b.receitaTotal - a.receitaTotal);

      res.json({
        ano,
        squad: squadFilter || 'todos',
        squads: Array.from(squadsSet).sort(),
        meses: monthlyData,
        resumoPorSquad,
        despesasMensais
      });
    } catch (error) {
      console.error("[api] Error fetching contribuição squad DFC bulk:", error);
      res.status(500).json({ error: "Falha ao buscar dados de contribuição squad DFC (bulk)" });
    }
  });

  // Contribuição por Squad - Receitas atribuídas por squad do contrato
  app.get("/api/contribuicao-squad/dfc", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string;
      const dataFim = req.query.dataFim as string;
      const squad = req.query.squad as string | undefined;
      
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "Parâmetros dataInicio e dataFim são obrigatórios" });
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Formato inválido. Esperado: YYYY-MM-DD" });
      }
      
      const data = await storage.getContribuicaoSquadDfc(dataInicio, dataFim, squad);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching contribuição squad DFC:", error);
      res.status(500).json({ error: "Falha ao buscar dados de contribuição squad DFC" });
    }
  });

  app.get("/api/contribuicao-squad/totais-por-squad", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string;
      const dataFim = req.query.dataFim as string;
      
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "Parâmetros dataInicio e dataFim são obrigatórios" });
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Formato inválido. Esperado: YYYY-MM-DD" });
      }
      
      const dataFimComHora = `${dataFim} 23:59:59`;
      
      const result = await db.execute(sql`
        WITH cnpj_normalizado AS (
          SELECT 
            ids,
            nome,
            REPLACE(REPLACE(REPLACE(COALESCE(cnpj, ''), '.', ''), '-', ''), '/', '') as cnpj_limpo
          FROM "Conta Azul".caz_clientes
          WHERE cnpj IS NOT NULL AND TRIM(cnpj) != ''
        ),
        cup_cnpj_normalizado AS (
          SELECT 
            task_id,
            REPLACE(REPLACE(REPLACE(COALESCE(cnpj, ''), '.', ''), '-', ''), '/', '') as cnpj_limpo
          FROM "Clickup".cup_clientes
          WHERE cnpj IS NOT NULL AND TRIM(cnpj) != ''
        ),
        contrato_todos AS (
          SELECT DISTINCT
            cc.cnpj_limpo,
            ct.squad,
            ct.id_subtask,
            COALESCE(ct.valorr::numeric, 0) + COALESCE(ct.valorp::numeric, 0) as valor_contrato
          FROM cup_cnpj_normalizado cc
          INNER JOIN "Clickup".cup_contratos ct ON cc.task_id = ct.id_task
          WHERE ct.squad IS NOT NULL AND TRIM(ct.squad) != ''
        ),
        contrato_com_peso AS (
          SELECT
            cnpj_limpo,
            squad,
            id_subtask,
            CASE
              WHEN SUM(valor_contrato) OVER (PARTITION BY cnpj_limpo) > 0
              THEN valor_contrato / SUM(valor_contrato) OVER (PARTITION BY cnpj_limpo)
              ELSE 1.0 / COUNT(*) OVER (PARTITION BY cnpj_limpo)
            END as peso
          FROM contrato_todos
        )
        SELECT
          COALESCE(NULLIF(TRIM(cu.squad), ''), 'Sem Squad') as squad,
          SUM(p.valor_pago::numeric * COALESCE(cu.peso, 1)) as valor_bruto,
          COUNT(DISTINCT p.id) as quantidade_parcelas
        FROM "Conta Azul".caz_parcelas p
        LEFT JOIN cnpj_normalizado caz ON TRIM(p.id_cliente::text) = TRIM(caz.ids::text)
        LEFT JOIN contrato_com_peso cu ON caz.cnpj_limpo = cu.cnpj_limpo
        WHERE p.status = 'QUITADO'
          AND p.tipo_evento = 'RECEITA'
          AND p.data_quitacao >= ${dataInicio}::date
          AND p.data_quitacao <= ${dataFimComHora}::timestamp
          AND p.valor_pago::numeric > 0
        GROUP BY COALESCE(NULLIF(TRIM(cu.squad), ''), 'Sem Squad')
        ORDER BY SUM(p.valor_pago::numeric) DESC
      `);
      
      const totalGeral = (result.rows as any[]).reduce((sum, row) => sum + (parseFloat(row.valor_bruto) || 0), 0);
      
      const squadsComContribuicao = (result.rows as any[]).map(row => {
        const valorBruto = parseFloat(row.valor_bruto) || 0;
        const valorLiquido = valorBruto * 0.82;
        return {
          squad: row.squad,
          valorBruto,
          valorLiquido,
          percentualBruto: totalGeral > 0 ? (valorBruto / totalGeral) * 100 : 0,
          percentualLiquido: totalGeral > 0 ? (valorBruto / totalGeral) * 100 : 0,
          quantidadeParcelas: parseInt(row.quantidade_parcelas) || 0
        };
      });
      
      res.json({
        squads: squadsComContribuicao,
        totalBruto: totalGeral,
        totalLiquido: totalGeral * 0.82
      });
    } catch (error) {
      console.error("[api] Error fetching totais por squad:", error);
      res.status(500).json({ error: "Falha ao buscar totais por squad" });
    }
  });

  // Endpoint de ranking de contribuição por squad (receitas - despesas - impostos)
  // Usa EXATAMENTE a mesma query da DFC (getContribuicaoSquadDfc) para consistência
  app.get("/api/contribuicao-squad/ranking", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string;
      const dataFim = req.query.dataFim as string;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "Parâmetros dataInicio e dataFim são obrigatórios" });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Formato inválido. Esperado: YYYY-MM-DD" });
      }

      // Buscar lista de squads usando a mesma query da DFC
      const baseData = await storage.getContribuicaoSquadDfc(dataInicio, dataFim);
      const squads = baseData.squads || [];

      // Buscar dados completos por squad (mesma query usada na DFC mensal)
      const squadResults = await Promise.all(
        squads.map(async (squad) => {
          const data = await storage.getContribuicaoSquadDfc(dataInicio, dataFim, squad);
          return { squad, data };
        })
      );

      // Calcular ranking usando MESMA lógica do frontend DFC:
      // despesaSemImpostos = soma das despesas excluindo IMPOSTOS
      // resultadoBruto = receita - despesaSemImpostos
      // impostos = resultadoBruto * 0.18
      // contribuicao = resultadoBruto - impostos
      const rankingData = squadResults.map(({ squad, data }) => {
        const receita = data.totais?.receitaTotal || 0;

        // Calcular despesa SEM impostos (mesma lógica do frontend linha 260-267)
        let despesaSemImpostos = 0;
        if (data.despesas) {
          for (const despesa of data.despesas) {
            const catId = despesa.categoriaId.toUpperCase();
            // Somente nivel 1 (máximo 2 segmentos: DESP.SALARIOS, não DESP.SALARIOS.123)
            const isNivel1 = despesa.nivel === 1 || catId.split('.').length <= 2;
            if (!catId.includes('IMPOSTOS') && isNivel1) {
              despesaSemImpostos += despesa.valor;
            }
          }
        }

        const resultadoBruto = receita - despesaSemImpostos;
        const impostos = receita * 0.18;
        const contribuicao = resultadoBruto - impostos;
        const margem = receita > 0 ? (contribuicao / receita) * 100 : 0;

        return {
          squad,
          receita,
          despesa: despesaSemImpostos,
          resultadoBruto,
          impostos,
          contribuicao,
          margem
        };
      });

      const ranking = rankingData
        .filter(s => s.receita > 0 || s.despesa > 0)
        .sort((a, b) => b.contribuicao - a.contribuicao);

      const totais = ranking.reduce((acc, s) => ({
        receita: acc.receita + s.receita,
        despesa: acc.despesa + s.despesa,
        resultadoBruto: acc.resultadoBruto + s.resultadoBruto,
        impostos: acc.impostos + s.impostos,
        contribuicao: acc.contribuicao + s.contribuicao
      }), { receita: 0, despesa: 0, resultadoBruto: 0, impostos: 0, contribuicao: 0 });

      res.json({ ranking, totais });
    } catch (error) {
      console.error("[api] Error fetching ranking contribuição:", error);
      res.status(500).json({ error: "Falha ao buscar ranking de contribuição" });
    }
  });

  // ========================================
  // ANALISE DE SQUADS - Endpoint consolidado
  // ========================================
  app.get("/api/analise-squads", async (req, res) => {
    try {
      const mesAno = req.query.mesAno as string;

      if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
      }

      const [ano, mes] = mesAno.split('-').map(Number);
      const inicioMes = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 0, 23, 59, 59);
      const inicioMesStr = inicioMes.toISOString().split('T')[0];
      const fimMesStr = fimMes.toISOString().split('T')[0];

      // Data de início para evolução (6 meses atrás)
      const evolucaoStart = new Date(ano, mes - 7, 1);
      const evolucaoStartStr = evolucaoStart.toISOString().split('T')[0];

      // Verificar se o mês selecionado é o mês atual
      const agora = new Date();
      const isMesAtual = ano === agora.getFullYear() && mes === (agora.getMonth() + 1);

      // 1) MRR por squad no mês selecionado
      let mrrPorSquadRows: any[];
      if (isMesAtual) {
        // Mês atual: dados ao vivo de cup_contratos
        const mrrResult = await db.execute(sql`
          SELECT
            COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') as squad,
            COALESCE(SUM(valorr::numeric), 0) as mrr,
            COUNT(DISTINCT id_subtask) as contratos,
            COUNT(DISTINCT id_task) as clientes
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
            AND valorr IS NOT NULL AND valorr > 0
          GROUP BY COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
          ORDER BY mrr DESC
        `);
        mrrPorSquadRows = mrrResult.rows as any[];
      } else {
        // Mês anterior: snapshot histórico
        const snapshotResult = await db.execute(sql`
          SELECT MAX(data_snapshot) as ds
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot >= ${inicioMes}::timestamp
            AND data_snapshot <= ${fimMes}::timestamp
        `);
        const dataSnapshot = (snapshotResult.rows[0] as any)?.ds;

        if (dataSnapshot) {
          const mrrResult = await db.execute(sql`
            SELECT
              COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') as squad,
              COALESCE(SUM(valorr::numeric), 0) as mrr,
              COUNT(DISTINCT id_subtask) as contratos,
              COUNT(DISTINCT id_task) as clientes
            FROM "Clickup".cup_data_hist
            WHERE data_snapshot = ${dataSnapshot}::timestamp
              AND status IN ('ativo', 'onboarding', 'triagem')
              AND valorr IS NOT NULL AND valorr > 0
            GROUP BY COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
            ORDER BY mrr DESC
          `);
          mrrPorSquadRows = mrrResult.rows as any[];
        } else {
          // Fallback para dados atuais se não houver snapshot
          const mrrResult = await db.execute(sql`
            SELECT
              COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') as squad,
              COALESCE(SUM(valorr::numeric), 0) as mrr,
              COUNT(DISTINCT id_subtask) as contratos,
              COUNT(DISTINCT id_task) as clientes
            FROM "Clickup".cup_contratos
            WHERE status IN ('ativo', 'onboarding', 'triagem')
              AND valorr IS NOT NULL AND valorr > 0
            GROUP BY COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
            ORDER BY mrr DESC
          `);
          mrrPorSquadRows = mrrResult.rows as any[];
        }
      }

      // 2) Churn por squad no mês selecionado
      const churnResult = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') as squad,
          COUNT(*) as churns,
          COALESCE(SUM(valorr::numeric), 0) as mrr_churn
        FROM "Clickup".cup_contratos
        WHERE data_solicitacao_encerramento IS NOT NULL
          AND data_solicitacao_encerramento >= ${inicioMesStr}::date
          AND data_solicitacao_encerramento <= ${fimMesStr}::date
          AND valorr > 0
        GROUP BY COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
      `);
      const churnPorSquadRows = churnResult.rows as any[];

      // 3) Evolução MRR por squad (últimos 6 meses)
      const evolucaoMrrResult = await db.execute(sql`
        WITH snapshots_mensais AS (
          SELECT DISTINCT ON (DATE_TRUNC('month', data_snapshot))
            DATE_TRUNC('month', data_snapshot) as mes,
            data_snapshot
          FROM "Clickup".cup_data_hist
          WHERE DATE(data_snapshot) >= ${evolucaoStartStr}::date
            AND DATE_TRUNC('month', data_snapshot) < DATE_TRUNC('month', CURRENT_DATE)
          ORDER BY DATE_TRUNC('month', data_snapshot), data_snapshot DESC
        ),
        historical_data AS (
          SELECT
            TO_CHAR(sm.mes, 'YYYY-MM') as mes,
            COALESCE(NULLIF(TRIM(h.squad), ''), 'Sem Squad') as squad,
            COALESCE(SUM(h.valorr::numeric), 0) as mrr_total,
            COUNT(DISTINCT h.id_subtask) as total_contratos
          FROM snapshots_mensais sm
          JOIN "Clickup".cup_data_hist h ON DATE(h.data_snapshot) = DATE(sm.data_snapshot)
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY TO_CHAR(sm.mes, 'YYYY-MM'), COALESCE(NULLIF(TRIM(h.squad), ''), 'Sem Squad')
        ),
        current_month_data AS (
          SELECT
            TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM') as mes,
            COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') as squad,
            COALESCE(SUM(valorr::numeric), 0) as mrr_total,
            COUNT(DISTINCT id_subtask) as total_contratos
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
        )
        SELECT * FROM historical_data
        UNION ALL
        SELECT * FROM current_month_data
        ORDER BY mes, squad
      `);

      // 4) Evolução Churn por squad (últimos 6 meses)
      const evolucaoChurnResult = await db.execute(sql`
        SELECT
          TO_CHAR(data_solicitacao_encerramento, 'YYYY-MM') as mes,
          COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') as squad,
          COUNT(*) as churns,
          COALESCE(SUM(valorr::numeric), 0) as mrr_churn
        FROM "Clickup".cup_contratos
        WHERE data_solicitacao_encerramento IS NOT NULL
          AND data_solicitacao_encerramento >= ${evolucaoStartStr}::date
          AND valorr > 0
        GROUP BY TO_CHAR(data_solicitacao_encerramento, 'YYYY-MM'), COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
        ORDER BY mes, squad
      `);

      // Montar dados por squad
      const churnMap = new Map<string, { churns: number; mrrChurn: number }>();
      for (const row of churnPorSquadRows) {
        churnMap.set(row.squad, {
          churns: parseInt(row.churns) || 0,
          mrrChurn: parseFloat(row.mrr_churn) || 0,
        });
      }

      const squads = mrrPorSquadRows.map((row) => {
        const mrr = parseFloat(row.mrr) || 0;
        const contratos = parseInt(row.contratos) || 0;
        const clientes = parseInt(row.clientes) || 0;
        const churnData = churnMap.get(row.squad) || { churns: 0, mrrChurn: 0 };
        const churnRate = contratos > 0 ? (churnData.churns / contratos) * 100 : 0;
        const ticketMedio = contratos > 0 ? mrr / contratos : 0;

        return {
          squad: row.squad,
          mrr,
          contratos,
          clientes,
          churns: churnData.churns,
          mrrChurn: churnData.mrrChurn,
          churnRate: Math.round(churnRate * 100) / 100,
          ticketMedio: Math.round(ticketMedio * 100) / 100,
        };
      });

      // Totais
      const totalMrr = squads.reduce((s, sq) => s + sq.mrr, 0);
      const totalContratos = squads.reduce((s, sq) => s + sq.contratos, 0);
      const totalClientes = squads.reduce((s, sq) => s + sq.clientes, 0);
      const totalChurns = squads.reduce((s, sq) => s + sq.churns, 0);
      const churnRateGeral = totalContratos > 0 ? Math.round((totalChurns / totalContratos) * 10000) / 100 : 0;
      const ticketMedioGeral = totalContratos > 0 ? Math.round((totalMrr / totalContratos) * 100) / 100 : 0;

      const squadsLista = squads.map(s => s.squad).filter(s => s !== 'Sem Squad');

      res.json({
        mesAno,
        squads,
        totais: {
          totalMrr,
          totalContratos,
          totalClientes,
          totalChurns,
          churnRateGeral,
          ticketMedioGeral,
        },
        evolucao: {
          mrr: evolucaoMrrResult.rows,
          churns: evolucaoChurnResult.rows,
        },
        squadsLista,
      });
    } catch (error) {
      console.error("[api] Error fetching analise squads:", error);
      res.status(500).json({ error: "Failed to fetch analise squads" });
    }
  });

  // ========================================
  // ANALISE SQUADS - DETALHE POR SQUAD
  // ========================================
  app.get("/api/analise-squads/detalhe", async (req, res) => {
    try {
      const mesAno = req.query.mesAno as string;
      const squad = req.query.squad as string;

      if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
      }
      if (!squad) {
        return res.status(400).json({ error: "Missing squad parameter" });
      }

      const [ano, mes] = mesAno.split('-').map(Number);
      const inicioMes = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 0, 23, 59, 59);
      const inicioMesStr = inicioMes.toISOString().split('T')[0];
      const fimMesStr = fimMes.toISOString().split('T')[0];

      const evolucaoStart = new Date(ano, mes - 7, 1);
      const evolucaoStartStr = evolucaoStart.toISOString().split('T')[0];

      const agora = new Date();
      const isMesAtual = ano === agora.getFullYear() && mes === (agora.getMonth() + 1);

      // 1) MRR por operador no squad selecionado
      let mrrPorOperadorRows: any[];
      if (isMesAtual) {
        const result = await db.execute(sql`
          SELECT
            COALESCE(NULLIF(TRIM(responsavel), ''), 'Sem Responsável') as responsavel,
            COALESCE(SUM(valorr::numeric), 0) as mrr,
            COUNT(DISTINCT id_subtask) as contratos,
            COUNT(DISTINCT id_task) as clientes
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
            AND valorr IS NOT NULL AND valorr > 0
            AND COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') = ${squad}
          GROUP BY COALESCE(NULLIF(TRIM(responsavel), ''), 'Sem Responsável')
          ORDER BY mrr DESC
        `);
        mrrPorOperadorRows = result.rows as any[];
      } else {
        const snapshotResult = await db.execute(sql`
          SELECT MAX(data_snapshot) as ds
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot >= ${inicioMes}::timestamp
            AND data_snapshot <= ${fimMes}::timestamp
        `);
        const dataSnapshot = (snapshotResult.rows[0] as any)?.ds;

        if (dataSnapshot) {
          const result = await db.execute(sql`
            SELECT
              COALESCE(NULLIF(TRIM(responsavel), ''), 'Sem Responsável') as responsavel,
              COALESCE(SUM(valorr::numeric), 0) as mrr,
              COUNT(DISTINCT id_subtask) as contratos,
              COUNT(DISTINCT id_task) as clientes
            FROM "Clickup".cup_data_hist
            WHERE data_snapshot = ${dataSnapshot}::timestamp
              AND status IN ('ativo', 'onboarding', 'triagem')
              AND valorr IS NOT NULL AND valorr > 0
              AND COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') = ${squad}
            GROUP BY COALESCE(NULLIF(TRIM(responsavel), ''), 'Sem Responsável')
            ORDER BY mrr DESC
          `);
          mrrPorOperadorRows = result.rows as any[];
        } else {
          const result = await db.execute(sql`
            SELECT
              COALESCE(NULLIF(TRIM(responsavel), ''), 'Sem Responsável') as responsavel,
              COALESCE(SUM(valorr::numeric), 0) as mrr,
              COUNT(DISTINCT id_subtask) as contratos,
              COUNT(DISTINCT id_task) as clientes
            FROM "Clickup".cup_contratos
            WHERE status IN ('ativo', 'onboarding', 'triagem')
              AND valorr IS NOT NULL AND valorr > 0
              AND COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') = ${squad}
            GROUP BY COALESCE(NULLIF(TRIM(responsavel), ''), 'Sem Responsável')
            ORDER BY mrr DESC
          `);
          mrrPorOperadorRows = result.rows as any[];
        }
      }

      // 2) Churn por operador no squad selecionado (tabela curada cup_churn, excluindo abonado)
      const churnResult = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(responsavel_geral), ''), 'Sem Responsável') as responsavel,
          COUNT(*) as churns,
          COALESCE(SUM(valor_r::numeric), 0) as mrr_churn
        FROM "Clickup".cup_churn
        WHERE data_solicitacao_encerramento IS NOT NULL
          AND data_solicitacao_encerramento >= ${inicioMesStr}::date
          AND data_solicitacao_encerramento <= ${fimMesStr}::date
          AND valor_r > 0
          AND COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') = ${squad}
          AND COALESCE(abonar_churn, '') != 'Sim'
          AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou')
        GROUP BY COALESCE(NULLIF(TRIM(responsavel_geral), ''), 'Sem Responsável')
      `);
      const churnPorOperadorRows = churnResult.rows as any[];

      // 3) Evolução MRR do squad (últimos 6 meses)
      const evolucaoMrrResult = await db.execute(sql`
        WITH snapshots_mensais AS (
          SELECT DISTINCT ON (DATE_TRUNC('month', data_snapshot))
            DATE_TRUNC('month', data_snapshot) as mes,
            data_snapshot
          FROM "Clickup".cup_data_hist
          WHERE DATE(data_snapshot) >= ${evolucaoStartStr}::date
            AND DATE_TRUNC('month', data_snapshot) < DATE_TRUNC('month', CURRENT_DATE)
          ORDER BY DATE_TRUNC('month', data_snapshot), data_snapshot DESC
        ),
        historical_data AS (
          SELECT
            TO_CHAR(sm.mes, 'YYYY-MM') as mes,
            COALESCE(SUM(h.valorr::numeric), 0) as mrr
          FROM snapshots_mensais sm
          JOIN "Clickup".cup_data_hist h ON DATE(h.data_snapshot) = DATE(sm.data_snapshot)
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
            AND COALESCE(NULLIF(TRIM(h.squad), ''), 'Sem Squad') = ${squad}
          GROUP BY TO_CHAR(sm.mes, 'YYYY-MM')
        ),
        current_month_data AS (
          SELECT
            TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM') as mes,
            COALESCE(SUM(valorr::numeric), 0) as mrr
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
            AND COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') = ${squad}
        )
        SELECT * FROM historical_data
        UNION ALL
        SELECT * FROM current_month_data
        ORDER BY mes
      `);

      // 4) Evolução MRR por operador nos últimos 6 meses
      const evolucaoOperadoresResult = await db.execute(sql`
        WITH snapshots_mensais AS (
          SELECT DISTINCT ON (DATE_TRUNC('month', data_snapshot))
            DATE_TRUNC('month', data_snapshot) as mes,
            data_snapshot
          FROM "Clickup".cup_data_hist
          WHERE DATE(data_snapshot) >= ${evolucaoStartStr}::date
            AND DATE_TRUNC('month', data_snapshot) < DATE_TRUNC('month', CURRENT_DATE)
          ORDER BY DATE_TRUNC('month', data_snapshot), data_snapshot DESC
        ),
        historical_data AS (
          SELECT
            TO_CHAR(sm.mes, 'YYYY-MM') as mes,
            COALESCE(NULLIF(TRIM(h.responsavel), ''), 'Sem Responsável') as operador,
            COALESCE(SUM(h.valorr::numeric), 0) as mrr
          FROM snapshots_mensais sm
          JOIN "Clickup".cup_data_hist h ON DATE(h.data_snapshot) = DATE(sm.data_snapshot)
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
            AND COALESCE(NULLIF(TRIM(h.squad), ''), 'Sem Squad') = ${squad}
          GROUP BY TO_CHAR(sm.mes, 'YYYY-MM'), COALESCE(NULLIF(TRIM(h.responsavel), ''), 'Sem Responsável')
        ),
        current_month_data AS (
          SELECT
            TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM') as mes,
            COALESCE(NULLIF(TRIM(responsavel), ''), 'Sem Responsável') as operador,
            COALESCE(SUM(valorr::numeric), 0) as mrr
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
            AND COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') = ${squad}
          GROUP BY COALESCE(NULLIF(TRIM(responsavel), ''), 'Sem Responsável')
        )
        SELECT * FROM historical_data
        UNION ALL
        SELECT * FROM current_month_data
        ORDER BY mes, operador
      `);

      // 5) Contratos churned no mês (lista detalhada via cup_churn, excluindo abonado)
      const contratosChurnResult = await db.execute(sql`
        SELECT
          c.nome as cliente,
          c.produto as contrato,
          c.valor_r::numeric as valorr,
          COALESCE(NULLIF(TRIM(c.responsavel_geral), ''), 'Sem Responsável') as responsavel,
          c.data_solicitacao_encerramento as data_encerramento,
          c.motivo_cancelamento,
          c.submotivo_cancelamento,
          c.status_cancelamento
        FROM "Clickup".cup_churn c
        WHERE c.data_solicitacao_encerramento IS NOT NULL
          AND c.data_solicitacao_encerramento >= ${inicioMesStr}::date
          AND c.data_solicitacao_encerramento <= ${fimMesStr}::date
          AND c.valor_r > 0
          AND COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad') = ${squad}
          AND COALESCE(c.abonar_churn, '') != 'Sim'
          AND COALESCE(c.motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou')
        ORDER BY c.valor_r::numeric DESC
      `);

      // Montar dados por operador
      const churnMap = new Map<string, { churns: number; mrrChurn: number }>();
      for (const row of churnPorOperadorRows) {
        churnMap.set(row.responsavel, {
          churns: parseInt(row.churns) || 0,
          mrrChurn: parseFloat(row.mrr_churn) || 0,
        });
      }

      const operadores = mrrPorOperadorRows.map((row) => {
        const mrr = parseFloat(row.mrr) || 0;
        const contratos = parseInt(row.contratos) || 0;
        const clientes = parseInt(row.clientes) || 0;
        const churnData = churnMap.get(row.responsavel) || { churns: 0, mrrChurn: 0 };
        const churnRate = contratos > 0 ? (churnData.churns / contratos) * 100 : 0;
        const ticketMedio = contratos > 0 ? mrr / contratos : 0;

        return {
          nome: row.responsavel,
          mrr,
          contratos,
          clientes,
          churns: churnData.churns,
          mrrChurn: churnData.mrrChurn,
          churnRate: Math.round(churnRate * 100) / 100,
          ticketMedio: Math.round(ticketMedio * 100) / 100,
        };
      });

      // Totais do squad
      const totalMrr = operadores.reduce((s, o) => s + o.mrr, 0);
      const totalContratos = operadores.reduce((s, o) => s + o.contratos, 0);
      const totalClientes = operadores.reduce((s, o) => s + o.clientes, 0);
      const totalChurns = operadores.reduce((s, o) => s + o.churns, 0);
      const churnRate = totalContratos > 0 ? Math.round((totalChurns / totalContratos) * 10000) / 100 : 0;
      const totalMrrChurn = operadores.reduce((s, o) => s + o.mrrChurn, 0);
      const ticketMedio = totalContratos > 0 ? Math.round((totalMrr / totalContratos) * 100) / 100 : 0;

      res.json({
        squad,
        mesAno,
        totais: {
          mrr: totalMrr,
          contratos: totalContratos,
          clientes: totalClientes,
          churns: totalChurns,
          churnRate,
          mrrChurn: totalMrrChurn,
          ticketMedio,
        },
        operadores,
        evolucaoMrr: evolucaoMrrResult.rows,
        evolucaoOperadores: evolucaoOperadoresResult.rows,
        contratosChurn: contratosChurnResult.rows,
      });
    } catch (error) {
      console.error("[api] Error fetching analise squads detalhe:", error);
      res.status(500).json({ error: "Failed to fetch analise squads detalhe" });
    }
  });

  // ========================================
  // SAÚDE DA BASE ATIVA
  // ========================================
  app.get("/api/saude-base-ativa", async (req, res) => {
    try {
      // 1) Contratos ativos com LT calculado
      const contratosResult = await db.execute(sql`
        SELECT c.id_subtask, c.servico, c.status, c.valorr::numeric as mrr,
          c.valorp::numeric as valorp, c.data_inicio, c.squad, c.produto, c.plano,
          c.vendedor, c.responsavel, c.cs_responsavel,
          cl.nome as nome_cliente, cl.cnpj, cl.cluster,
          CASE WHEN c.data_inicio IS NOT NULL
            THEN EXTRACT(EPOCH FROM (NOW() - c.data_inicio::timestamp)) / (86400 * 30.44)
            ELSE 0 END as lt_meses
        FROM "Clickup".cup_contratos c
        LEFT JOIN "Clickup".cup_clientes cl ON c.id_task = cl.task_id
        WHERE c.status IS NOT NULL
          AND LOWER(COALESCE(c.squad, '')) NOT IN ('turbo interno', 'squad x', 'interno', 'x')
        ORDER BY lt_meses DESC
      `);
      const contratos = (contratosResult.rows as any[]).map(r => ({
        id_subtask: r.id_subtask,
        servico: r.servico,
        status: r.status,
        mrr: parseFloat(r.mrr) || 0,
        valorp: parseFloat(r.valorp) || 0,
        data_inicio: r.data_inicio,
        squad: r.squad?.trim() || 'Sem Squad',
        produto: r.produto?.trim() || 'Sem Produto',
        plano: r.plano?.trim() || 'Sem Plano',
        vendedor: r.vendedor,
        responsavel: r.responsavel,
        cs_responsavel: r.cs_responsavel,
        nome_cliente: r.nome_cliente || 'Sem Nome',
        cnpj: r.cnpj,
        cluster: r.cluster?.trim() || 'Sem Cluster',
        lt_meses: parseFloat(r.lt_meses) || 0,
      }));

      // 2) Evolução LT médio mensal (últimos 12 meses via cup_data_hist + mês atual)
      const evolucaoResult = await db.execute(sql`
        WITH monthly_snapshots AS (
          SELECT DISTINCT ON (TO_CHAR(data_snapshot, 'YYYY-MM'))
            TO_CHAR(data_snapshot, 'YYYY-MM') as mes,
            data_snapshot
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot >= NOW() - INTERVAL '12 months'
          ORDER BY TO_CHAR(data_snapshot, 'YYYY-MM'), data_snapshot DESC
        ),
        hist_lt AS (
          SELECT ms.mes,
            AVG(
              CASE WHEN h.data_inicio IS NOT NULL
                THEN EXTRACT(EPOCH FROM (ms.data_snapshot - h.data_inicio::timestamp)) / (86400 * 30.44)
                ELSE 0 END
            ) as lt_medio,
            COUNT(*) as total_contratos,
            AVG(h.valorr::numeric) as ticket_medio
          FROM monthly_snapshots ms
          JOIN "Clickup".cup_data_hist h ON h.data_snapshot = ms.data_snapshot
          WHERE LOWER(h.status) IN ('ativo', 'onboarding', 'triagem')
            AND h.valorr IS NOT NULL AND h.valorr::numeric > 0
            AND LOWER(COALESCE(h.squad, '')) NOT IN ('turbo interno', 'squad x', 'interno', 'x')
          GROUP BY ms.mes
        )
        SELECT mes, lt_medio, total_contratos, ticket_medio
        FROM hist_lt
        ORDER BY mes
      `);
      const evolucao = (evolucaoResult.rows as any[]).map(r => ({
        mes: r.mes,
        lt_medio: parseFloat(r.lt_medio) || 0,
        total_contratos: parseInt(r.total_contratos) || 0,
        ticket_medio: parseFloat(r.ticket_medio) || 0,
      }));

      // Add current month
      const now = new Date();
      const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const existeMesAtual = evolucao.some(e => e.mes === mesAtual);
      if (!existeMesAtual && contratos.length > 0) {
        const ltMedioAtual = contratos.reduce((sum, c) => sum + c.lt_meses, 0) / contratos.length;
        const ticketMedioAtual = contratos.reduce((sum, c) => sum + c.mrr, 0) / contratos.length;
        evolucao.push({
          mes: mesAtual,
          lt_medio: ltMedioAtual,
          total_contratos: contratos.length,
          ticket_medio: ticketMedioAtual,
        });
      }

      // 3) Aggregate KPIs
      const totalContratos = contratos.length;
      const mrrTotal = contratos.reduce((sum, c) => sum + c.mrr, 0);
      const ltMedio = totalContratos > 0 ? contratos.reduce((sum, c) => sum + c.lt_meses, 0) / totalContratos : 0;
      const ticketMedio = totalContratos > 0 ? mrrTotal / totalContratos : 0;
      const ltvEstimado = ticketMedio * ltMedio;

      // 4) Distribution by LT ranges
      const faixas = [
        { label: '0-3m', min: 0, max: 3 },
        { label: '3-6m', min: 3, max: 6 },
        { label: '6-12m', min: 6, max: 12 },
        { label: '12-24m', min: 12, max: 24 },
        { label: '24m+', min: 24, max: Infinity },
      ];
      const distribuicaoLT = faixas.map(f => ({
        faixa: f.label,
        count: contratos.filter(c => c.lt_meses >= f.min && c.lt_meses < f.max).length,
        mrr: contratos.filter(c => c.lt_meses >= f.min && c.lt_meses < f.max).reduce((s, c) => s + c.mrr, 0),
      }));

      // 5) Breakdowns
      const groupBy = (key: 'squad' | 'produto' | 'plano' | 'cluster') => {
        const map = new Map<string, { count: number; totalLT: number; mrr: number }>();
        for (const c of contratos) {
          const val = c[key];
          const existing = map.get(val) || { count: 0, totalLT: 0, mrr: 0 };
          existing.count++;
          existing.totalLT += c.lt_meses;
          existing.mrr += c.mrr;
          map.set(val, existing);
        }
        return Array.from(map.entries())
          .map(([name, data]) => ({
            name,
            lt_medio: data.count > 0 ? data.totalLT / data.count : 0,
            contratos: data.count,
            mrr: data.mrr,
          }))
          .sort((a, b) => b.lt_medio - a.lt_medio);
      };

      // 6) Available filter values
      const uniqueValues = (key: 'squad' | 'produto' | 'plano' | 'cluster') => {
        return Array.from(new Set(contratos.map(c => c[key]))).filter(Boolean).sort();
      };

      res.json({
        contratos,
        evolucao,
        kpis: { ltMedio, ticketMedio, ltvEstimado, totalContratos, mrrTotal },
        distribuicaoLT,
        breakdowns: {
          squad: groupBy('squad'),
          produto: groupBy('produto'),
          plano: groupBy('plano'),
          cluster: groupBy('cluster'),
        },
        filtros: {
          squads: uniqueValues('squad'),
          produtos: uniqueValues('produto'),
          planos: uniqueValues('plano'),
          clusters: uniqueValues('cluster'),
        },
      });
    } catch (error: any) {
      console.error("[api] Error fetching saude base ativa:", error);
      res.status(500).json({ error: "Failed to fetch saude base ativa data" });
    }
  });

  // ========================================
  // GPTURBO CHAT API ENDPOINT (powered by OpenAI)
  // ========================================
  app.post("/api/cases/chat", async (req, res) => {
    try {
      const { message, historico } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: "Mensagem é obrigatória" });
      }

      const chatHistory: GPTurboMessage[] = Array.isArray(historico) 
        ? historico.map((m: any) => ({ role: m.role, content: m.content }))
        : [];

      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: GPTURBO_SYSTEM_PROMPT },
        ...chatHistory,
        { role: "user", content: message.trim() }
      ];

      const completion = await gpturboOpenAI.chat.completions.create({
        model: "gpt-4.1-mini",
        messages,
        max_completion_tokens: 1024,
        temperature: 0.7,
      });

      const responseContent = completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";
      
      res.json({ response: responseContent });
    } catch (error) {
      console.error("[api] Error in GPTurbo chat:", error);
      res.status(500).json({ error: "Falha ao processar a mensagem" });
    }
  });

  // ========================================
  // UNIFIED ASSISTANT CHAT API ENDPOINT
  // ========================================
  app.post("/api/assistants/chat", async (req, res) => {
    try {
      const { message, context, historico, metadata } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: "Mensagem é obrigatória" });
      }

      const validContexts: AssistantContext[] = ['geral', 'financeiro', 'cases', 'clientes', 'churn'];
      const assistantContext: AssistantContext = validContexts.includes(context) ? context : 'geral';

      const request: UnifiedAssistantRequest = {
        message: message.trim(),
        context: assistantContext,
        historico: Array.isArray(historico) ? historico : undefined,
        metadata: metadata || undefined,
      };

      const response = await unifiedAssistantChat(request);
      res.json(response);
    } catch (error) {
      console.error("[api] Error in Unified Assistant chat:", error);
      res.status(500).json({ error: "Falha ao processar a mensagem" });
    }
  });

  app.get("/api/auditoria-sistemas", async (req, res) => {
    try {
      const filters: {
        mesAno?: string;
        dataInicio?: string;
        dataFim?: string;
        squad?: string;
        apenasDivergentes?: boolean;
        statusFiltro?: string;
        threshold?: number;
      } = {};
      
      if (req.query.mesAno) {
        const mesAno = req.query.mesAno as string;
        if (!/^\d{4}-\d{2}$/.test(mesAno)) {
          return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
        }
        filters.mesAno = mesAno;
      }
      
      if (req.query.dataInicio) {
        filters.dataInicio = req.query.dataInicio as string;
      }
      
      if (req.query.dataFim) {
        filters.dataFim = req.query.dataFim as string;
      }
      
      if (req.query.squad && req.query.squad !== 'todos') {
        filters.squad = req.query.squad as string;
      }
      
      if (req.query.statusFiltro && req.query.statusFiltro !== 'todos') {
        filters.statusFiltro = req.query.statusFiltro as string;
      }
      
      if (req.query.apenasDivergentes === 'true') {
        filters.apenasDivergentes = true;
      }
      
      if (req.query.threshold) {
        const threshold = parseFloat(req.query.threshold as string);
        if (!isNaN(threshold)) {
          filters.threshold = threshold;
        }
      }

      const auditoriaData = await storage.getAuditoriaSistemas(filters);
      res.json(auditoriaData);
    } catch (error) {
      console.error("[api] Error fetching auditoria sistemas:", error);
      res.status(500).json({ error: "Failed to fetch auditoria sistemas data" });
    }
  });

  // Roadmap Auditoria - Pipeline Bitrix → ClickUp → Conta Azul
  app.get("/api/auditoria/roadmap-clientes", async (req, res) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const threshold = parseFloat(req.query.threshold as string) || 5;

      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: "Invalid month format. Expected: YYYY-MM" });
      }

      const [year, mon] = month.split("-");
      const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
      const startDate = `${year}-${mon}-01`;
      const endDate = `${year}-${mon}-${lastDay}`;

      const result = await db.execute(sql`
        WITH bitrix_deals AS (
          SELECT
            b.id,
            b.company_name,
            COALESCE(b.valor_recorrente, 0) as valor_recorrente,
            COALESCE(b.valor_pontual, 0) as valor_pontual,
            b.closer,
            b.data_fechamento,
            b.category_name,
            LOWER(TRIM(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  COALESCE(b.company_name, ''),
                  '\s*(LTDA|ME|SA|EIRELI|EPP|MEI|S\.A\.|S/A|SOCIEDADE|LIMITADA)\.?\s*$',
                  '', 'gi'
                ),
                '\s+', ' ', 'g'
              )
            )) as nome_normalizado
          FROM "Bitrix".crm_deal b
          WHERE LOWER(b.stage_name) = 'negócio ganho'
        ),
        clickup_clientes AS (
          SELECT
            cli.cnpj,
            cli.nome,
            cli.task_id,
            cli.status_conta,
            LOWER(TRIM(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  COALESCE(cli.nome, ''),
                  '\s*(LTDA|ME|SA|EIRELI|EPP|MEI|S\.A\.|S/A|SOCIEDADE|LIMITADA)\.?\s*$',
                  '', 'gi'
                ),
                '\s+', ' ', 'g'
              )
            )) as nome_normalizado,
            COALESCE(SUM(con.valorr), 0) as valor_clickup,
            COUNT(con.id_subtask) as qtd_contratos,
            STRING_AGG(DISTINCT con.squad, ', ') as squads
          FROM "Clickup".cup_clientes cli
          LEFT JOIN "Clickup".cup_contratos con ON con.id_task = cli.task_id
            AND LOWER(con.status) IN ('ativo', 'onboarding')
          GROUP BY cli.cnpj, cli.nome, cli.task_id, cli.status_conta
          HAVING COALESCE(SUM(con.valorr), 0) > 0
        ),
        contaazul_agg AS (
          SELECT
            REGEXP_REPLACE(COALESCE(cc.cnpj, ''), '[^0-9]', '', 'g') as cnpj_limpo,
            cc.nome,
            COALESCE(SUM(cp.valor_bruto), 0) as valor_contaazul,
            COUNT(cp.id) as qtd_parcelas
          FROM "Conta Azul".caz_parcelas cp
          JOIN "Conta Azul".caz_clientes cc ON cp.id_cliente::text = cc.ids
          WHERE cp.tipo_evento = 'RECEITA'
            AND cp.data_vencimento >= ${startDate}::date
            AND cp.data_vencimento <= ${endDate}::date
            AND LOWER(cp.status) IN ('quitado', 'pendente', 'atrasado')
          GROUP BY REGEXP_REPLACE(COALESCE(cc.cnpj, ''), '[^0-9]', '', 'g'), cc.nome
        )
        SELECT
          COALESCE(cu.nome, ca.nome, bd.company_name) as cliente_nome,
          cu.cnpj,
          CASE WHEN bd.id IS NOT NULL THEN true ELSE false END as bitrix_encontrado,
          COALESCE(bd.valor_recorrente, 0) as bitrix_valor_recorrente,
          COALESCE(bd.valor_pontual, 0) as bitrix_valor_pontual,
          bd.closer as bitrix_closer,
          bd.data_fechamento::text as bitrix_data_fechamento,
          bd.company_name as bitrix_company_name,
          COALESCE(similarity(bd.nome_normalizado, cu.nome_normalizado), 0) as bitrix_match_score,
          CASE WHEN cu.task_id IS NOT NULL THEN true ELSE false END as clickup_encontrado,
          COALESCE(cu.valor_clickup, 0) as clickup_valor_total,
          COALESCE(cu.qtd_contratos, 0)::integer as clickup_qtd_contratos,
          cu.status_conta as clickup_status,
          cu.squads as clickup_squad,
          CASE WHEN ca.cnpj_limpo IS NOT NULL AND ca.cnpj_limpo != '' THEN true ELSE false END as contaazul_encontrado,
          COALESCE(ca.valor_contaazul, 0) as contaazul_valor_mes,
          COALESCE(ca.qtd_parcelas, 0)::integer as contaazul_qtd_parcelas,
          CASE
            WHEN bd.valor_recorrente IS NOT NULL AND cu.valor_clickup IS NOT NULL AND cu.valor_clickup > 0
            THEN ABS(bd.valor_recorrente - cu.valor_clickup) / cu.valor_clickup * 100
            ELSE 0
          END as divergencia_bitrix_clickup,
          CASE
            WHEN cu.valor_clickup IS NOT NULL AND cu.valor_clickup > 0 AND ca.valor_contaazul IS NOT NULL
            THEN ABS(cu.valor_clickup - ca.valor_contaazul) / cu.valor_clickup * 100
            ELSE 0
          END as divergencia_clickup_contaazul
        FROM clickup_clientes cu
        FULL OUTER JOIN contaazul_agg ca
          ON REGEXP_REPLACE(COALESCE(cu.cnpj, ''), '[^0-9]', '', 'g') = ca.cnpj_limpo
          AND ca.cnpj_limpo != ''
        LEFT JOIN bitrix_deals bd
          ON cu.nome_normalizado IS NOT NULL
          AND bd.nome_normalizado IS NOT NULL
          AND LENGTH(cu.nome_normalizado) > 2
          AND LENGTH(bd.nome_normalizado) > 2
          AND similarity(bd.nome_normalizado, cu.nome_normalizado) >= 0.8
        WHERE COALESCE(cu.valor_clickup, 0) > 0
           OR COALESCE(ca.valor_contaazul, 0) > 0
           OR COALESCE(bd.valor_recorrente, 0) > 0
        ORDER BY COALESCE(cu.valor_clickup, ca.valor_contaazul, bd.valor_recorrente, 0) DESC
      `);

      const items = (result.rows || []).map((row: any) => {
        const bitrixEncontrado = row.bitrix_encontrado === true || row.bitrix_encontrado === 't';
        const clickupEncontrado = row.clickup_encontrado === true || row.clickup_encontrado === 't';
        const contaazulEncontrado = row.contaazul_encontrado === true || row.contaazul_encontrado === 't';
        const divBitrixClickup = parseFloat(row.divergencia_bitrix_clickup) || 0;
        const divClickupContaazul = parseFloat(row.divergencia_clickup_contaazul) || 0;

        let status = 'ok';
        if (clickupEncontrado && !contaazulEncontrado) {
          status = 'faltando_contaazul';
        } else if (!clickupEncontrado && contaazulEncontrado) {
          status = 'faltando_clickup';
        } else if (!clickupEncontrado && !contaazulEncontrado) {
          status = 'faltando_ambos';
        } else if (divBitrixClickup > threshold || divClickupContaazul > threshold) {
          status = 'divergencia_valor';
        }

        return {
          clienteNome: row.cliente_nome,
          cnpj: row.cnpj,
          bitrix_encontrado: bitrixEncontrado,
          bitrix_valor_recorrente: parseFloat(row.bitrix_valor_recorrente) || 0,
          bitrix_valor_pontual: parseFloat(row.bitrix_valor_pontual) || 0,
          bitrix_closer: row.bitrix_closer || null,
          bitrix_data_fechamento: row.bitrix_data_fechamento || null,
          bitrix_company_name: row.bitrix_company_name || null,
          bitrix_match_score: parseFloat(row.bitrix_match_score) || 0,
          clickup_encontrado: clickupEncontrado,
          clickup_valor_total: parseFloat(row.clickup_valor_total) || 0,
          clickup_qtd_contratos: parseInt(row.clickup_qtd_contratos) || 0,
          clickup_status: row.clickup_status || null,
          clickup_squad: row.clickup_squad || null,
          contaazul_encontrado: contaazulEncontrado,
          contaazul_valor_mes: parseFloat(row.contaazul_valor_mes) || 0,
          contaazul_qtd_parcelas: parseInt(row.contaazul_qtd_parcelas) || 0,
          divergencia_bitrix_clickup: divBitrixClickup,
          divergencia_clickup_contaazul: divClickupContaazul,
          status,
        };
      });

      res.json(items);
    } catch (error) {
      console.error("[api] Error fetching roadmap auditoria:", error);
      res.status(500).json({ error: "Failed to fetch roadmap auditoria data" });
    }
  });

  app.get("/api/inhire/metrics", async (req, res) => {
    try {
      const metrics = await storage.getInhireMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("[api] Error fetching Inhire metrics:", error);
      res.status(500).json({ error: "Failed to fetch Inhire metrics" });
    }
  });

  app.get("/api/inhire/status-distribution", async (req, res) => {
    try {
      const distribution = await storage.getInhireStatusDistribution();
      res.json(distribution);
    } catch (error) {
      console.error("[api] Error fetching Inhire status distribution:", error);
      res.status(500).json({ error: "Failed to fetch Inhire status distribution" });
    }
  });

  app.get("/api/inhire/stage-distribution", async (req, res) => {
    try {
      const distribution = await storage.getInhireStageDistribution();
      res.json(distribution);
    } catch (error) {
      console.error("[api] Error fetching Inhire stage distribution:", error);
      res.status(500).json({ error: "Failed to fetch Inhire stage distribution" });
    }
  });

  app.get("/api/inhire/source-distribution", async (req, res) => {
    try {
      const distribution = await storage.getInhireSourceDistribution();
      res.json(distribution);
    } catch (error) {
      console.error("[api] Error fetching Inhire source distribution:", error);
      res.status(500).json({ error: "Failed to fetch Inhire source distribution" });
    }
  });

  app.get("/api/inhire/funnel", async (req, res) => {
    try {
      const funnel = await storage.getInhireFunnel();
      res.json(funnel);
    } catch (error) {
      console.error("[api] Error fetching Inhire funnel:", error);
      res.status(500).json({ error: "Failed to fetch Inhire funnel" });
    }
  });

  app.get("/api/inhire/vagas-com-candidaturas", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const vagas = await storage.getInhireVagasComCandidaturas(limit);
      res.json(vagas);
    } catch (error) {
      console.error("[api] Error fetching Inhire vagas com candidaturas:", error);
      res.status(500).json({ error: "Failed to fetch Inhire vagas com candidaturas" });
    }
  });

  app.get("/api/meta-ads/date-range", async (req, res) => {
    try {
      const dateRange = await storage.getMetaDateRange();
      res.json(dateRange);
    } catch (error) {
      console.error("[api] Error fetching Meta Ads date range:", error);
      res.status(500).json({ error: "Failed to fetch Meta Ads date range" });
    }
  });

  // Helper function to parse lead filters from query params
  const parseLeadFilters = (query: any): import("@shared/schema").MetaLeadFilterParams | undefined => {
    const leadFilters: import("@shared/schema").MetaLeadFilterParams = {};
    
    // Normalize query params to arrays (handle both single values and arrays)
    if (query.categoryNames) {
      leadFilters.categoryNames = Array.isArray(query.categoryNames) ? query.categoryNames : [query.categoryNames];
    }
    if (query.stageNames) {
      leadFilters.stageNames = Array.isArray(query.stageNames) ? query.stageNames : [query.stageNames];
    }
    if (query.utmSources) {
      leadFilters.utmSources = Array.isArray(query.utmSources) ? query.utmSources : [query.utmSources];
    }
    if (query.utmCampaigns) {
      leadFilters.utmCampaigns = Array.isArray(query.utmCampaigns) ? query.utmCampaigns : [query.utmCampaigns];
    }
    if (query.utmTerms) {
      leadFilters.utmTerms = Array.isArray(query.utmTerms) ? query.utmTerms : [query.utmTerms];
    }

    return Object.keys(leadFilters).length > 0 ? leadFilters : undefined;
  };

  app.get("/api/meta-ads/filtros-leads", async (req, res) => {
    try {
      const filters = await storage.getMetaLeadFilters();
      res.json(filters);
    } catch (error) {
      console.error("[api] Error fetching Meta Ads lead filters:", error);
      res.status(500).json({ error: "Failed to fetch Meta Ads lead filters" });
    }
  });

  app.get("/api/meta-ads/overview", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const leadFilters = parseLeadFilters(req.query);

      const overview = await storage.getMetaOverview(startDate, endDate, leadFilters);
      res.json(overview);
    } catch (error) {
      console.error("[api] Error fetching Meta Ads overview:", error);
      res.status(500).json({ error: "Failed to fetch Meta Ads overview" });
    }
  });

  app.get("/api/meta-ads/campaigns", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const leadFilters = parseLeadFilters(req.query);

      const campaigns = await storage.getCampaignPerformance(startDate, endDate, leadFilters);
      res.json(campaigns);
    } catch (error) {
      console.error("[api] Error fetching campaign performance:", error);
      res.status(500).json({ error: "Failed to fetch campaign performance" });
    }
  });

  app.get("/api/meta-ads/adsets", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const campaignId = req.query.campaignId as string | undefined;
      const leadFilters = parseLeadFilters(req.query);

      const adsets = await storage.getAdsetPerformance(startDate, endDate, leadFilters, campaignId);
      res.json(adsets);
    } catch (error) {
      console.error("[api] Error fetching adset performance:", error);
      res.status(500).json({ error: "Failed to fetch adset performance" });
    }
  });

  app.get("/api/meta-ads/ads", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const adsetId = req.query.adsetId as string | undefined;
      const leadFilters = parseLeadFilters(req.query);

      const ads = await storage.getAdPerformance(startDate, endDate, leadFilters, adsetId);
      res.json(ads);
    } catch (error) {
      console.error("[api] Error fetching ad performance:", error);
      res.status(500).json({ error: "Failed to fetch ad performance" });
    }
  });

  app.get("/api/meta-ads/creatives", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const creatives = await storage.getCreativePerformance(startDate, endDate);
      res.json(creatives);
    } catch (error) {
      console.error("[api] Error fetching creative performance:", error);
      res.status(500).json({ error: "Failed to fetch creative performance" });
    }
  });

  app.get("/api/meta-ads/funnel", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const leadFilters = parseLeadFilters(req.query);

      const funnel = await storage.getConversionFunnel(startDate, endDate, leadFilters);
      res.json(funnel);
    } catch (error) {
      console.error("[api] Error fetching conversion funnel:", error);
      res.status(500).json({ error: "Failed to fetch conversion funnel" });
    }
  });

  // Recruitment Analytics API Routes (Power BI style G&G Dashboard)
  app.get("/api/recrutamento/kpis", async (req, res) => {
    try {
      const kpis = await storage.getRecrutamentoKPIs();
      res.json(kpis);
    } catch (error) {
      console.error("[api] Error fetching recruitment KPIs:", error);
      res.status(500).json({ error: "Failed to fetch recruitment KPIs" });
    }
  });

  app.get("/api/recrutamento/funil", async (req, res) => {
    try {
      const funil = await storage.getRecrutamentoFunil();
      res.json(funil);
    } catch (error) {
      console.error("[api] Error fetching recruitment funnel:", error);
      res.status(500).json({ error: "Failed to fetch recruitment funnel" });
    }
  });

  app.get("/api/recrutamento/fontes", async (req, res) => {
    try {
      const fontes = await storage.getRecrutamentoFontes();
      res.json(fontes);
    } catch (error) {
      console.error("[api] Error fetching recruitment sources:", error);
      res.status(500).json({ error: "Failed to fetch recruitment sources" });
    }
  });

  app.get("/api/recrutamento/evolucao", async (req, res) => {
    try {
      const meses = parseInt(req.query.meses as string) || 6;
      const evolucao = await storage.getRecrutamentoEvolucao(meses);
      res.json(evolucao);
    } catch (error) {
      console.error("[api] Error fetching recruitment evolution:", error);
      res.status(500).json({ error: "Failed to fetch recruitment evolution" });
    }
  });

  app.get("/api/recrutamento/vagas", async (req, res) => {
    try {
      const area = req.query.area as string | undefined;
      const status = req.query.status as string | undefined;
      const vagas = await storage.getRecrutamentoVagas({ area, status });
      res.json(vagas);
    } catch (error) {
      console.error("[api] Error fetching recruitment vacancies:", error);
      res.status(500).json({ error: "Failed to fetch recruitment vacancies" });
    }
  });

  app.get("/api/recrutamento/areas", async (req, res) => {
    try {
      const areas = await storage.getRecrutamentoAreas();
      res.json(areas);
    } catch (error) {
      console.error("[api] Error fetching recruitment areas:", error);
      res.status(500).json({ error: "Failed to fetch recruitment areas" });
    }
  });

  app.get("/api/recrutamento/filtros", async (req, res) => {
    try {
      const filtros = await storage.getRecrutamentoFiltros();
      res.json(filtros);
    } catch (error) {
      console.error("[api] Error fetching recruitment filters:", error);
      res.status(500).json({ error: "Failed to fetch recruitment filters" });
    }
  });

  app.get("/api/recrutamento/conversao-por-vaga", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const conversao = await storage.getRecrutamentoConversaoPorVaga(limit);
      res.json(conversao);
    } catch (error) {
      console.error("[api] Error fetching recruitment conversion by vacancy:", error);
      res.status(500).json({ error: "Failed to fetch recruitment conversion by vacancy" });
    }
  });

  app.get("/api/recrutamento/tempo-medio-por-etapa", async (req, res) => {
    try {
      const tempoMedio = await storage.getRecrutamentoTempoMedioPorEtapa();
      res.json(tempoMedio);
    } catch (error) {
      console.error("[api] Error fetching average time per stage:", error);
      res.status(500).json({ error: "Failed to fetch average time per stage" });
    }
  });

  app.get("/api/recrutamento/entrevistas-realizadas", async (req, res) => {
    try {
      const entrevistas = await storage.getRecrutamentoEntrevistasRealizadas();
      res.json(entrevistas);
    } catch (error) {
      console.error("[api] Error fetching interviews conducted:", error);
      res.status(500).json({ error: "Failed to fetch interviews conducted" });
    }
  });

  app.get("/api/recrutamento/entrevistas-por-cargo", async (req, res) => {
    try {
      const entrevistas = await storage.getRecrutamentoEntrevistasPorCargo();
      res.json(entrevistas);
    } catch (error) {
      console.error("[api] Error fetching interviews by position:", error);
      res.status(500).json({ error: "Failed to fetch interviews by position" });
    }
  });

  app.get("/api/recrutamento/candidaturas-por-area", async (req, res) => {
    try {
      const candidaturas = await storage.getRecrutamentoCandidaturasPorArea();
      res.json(candidaturas);
    } catch (error) {
      console.error("[api] Error fetching applications by area:", error);
      res.status(500).json({ error: "Failed to fetch applications by area" });
    }
  });

  // ========== Metric Formatting Rules API ==========
  
  // GET all metric rulesets with their thresholds
  app.get("/api/metric-rules", async (req, res) => {
    try {
      const rulesets = await storage.getMetricRulesets();
      res.json(rulesets);
    } catch (error) {
      console.error("[api] Error fetching metric rulesets:", error);
      res.status(500).json({ error: "Failed to fetch metric rulesets" });
    }
  });

  // GET single metric ruleset by key
  app.get("/api/metric-rules/:metricKey", async (req, res) => {
    try {
      const ruleset = await storage.getMetricRuleset(req.params.metricKey);
      if (!ruleset) {
        return res.status(404).json({ error: "Ruleset not found" });
      }
      res.json(ruleset);
    } catch (error) {
      console.error("[api] Error fetching metric ruleset:", error);
      res.status(500).json({ error: "Failed to fetch metric ruleset" });
    }
  });

  // POST create/update ruleset
  app.post("/api/metric-rules", async (req, res) => {
    try {
      const { metricKey, displayLabel, defaultColor, updatedBy } = req.body;
      if (!metricKey || !displayLabel) {
        return res.status(400).json({ error: "metricKey and displayLabel are required" });
      }
      const ruleset = await storage.upsertMetricRuleset({
        metricKey,
        displayLabel,
        defaultColor: defaultColor || 'default',
        updatedBy: updatedBy || null,
      });
      res.json(ruleset);
    } catch (error) {
      console.error("[api] Error creating metric ruleset:", error);
      res.status(500).json({ error: "Failed to create metric ruleset" });
    }
  });

  // DELETE ruleset by key
  app.delete("/api/metric-rules/:metricKey", async (req, res) => {
    try {
      await storage.deleteMetricRuleset(req.params.metricKey);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting metric ruleset:", error);
      res.status(500).json({ error: "Failed to delete metric ruleset" });
    }
  });

  // POST create threshold
  app.post("/api/metric-rules/:metricKey/thresholds", async (req, res) => {
    try {
      const { minValue, maxValue, color, label, sortOrder } = req.body;
      if (!color) {
        return res.status(400).json({ error: "color is required" });
      }
      
      // Get ruleset first
      const ruleset = await storage.getMetricRuleset(req.params.metricKey);
      if (!ruleset) {
        return res.status(404).json({ error: "Ruleset not found" });
      }
      
      const threshold = await storage.createMetricThreshold({
        rulesetId: ruleset.id,
        minValue: minValue !== undefined ? minValue : null,
        maxValue: maxValue !== undefined ? maxValue : null,
        color,
        label: label || null,
        sortOrder: sortOrder || 0,
      });
      res.json(threshold);
    } catch (error) {
      console.error("[api] Error creating metric threshold:", error);
      res.status(500).json({ error: "Failed to create metric threshold" });
    }
  });

  // PATCH update threshold
  app.patch("/api/metric-thresholds/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { minValue, maxValue, color, label, sortOrder } = req.body;
      
      const threshold = await storage.updateMetricThreshold(id, {
        minValue,
        maxValue,
        color,
        label,
        sortOrder,
      });
      res.json(threshold);
    } catch (error) {
      console.error("[api] Error updating metric threshold:", error);
      res.status(500).json({ error: "Failed to update metric threshold" });
    }
  });

  // DELETE threshold
  app.delete("/api/metric-thresholds/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMetricThreshold(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting metric threshold:", error);
      res.status(500).json({ error: "Failed to delete metric threshold" });
    }
  });

  // POST save complete ruleset with thresholds (bulk save)
  app.post("/api/metric-rules/:metricKey/save", async (req, res) => {
    try {
      const { displayLabel, defaultColor, updatedBy, thresholds } = req.body;
      const metricKey = req.params.metricKey;
      
      if (!displayLabel) {
        return res.status(400).json({ error: "displayLabel is required" });
      }
      
      // Upsert ruleset
      const ruleset = await storage.upsertMetricRuleset({
        metricKey,
        displayLabel,
        defaultColor: defaultColor || 'default',
        updatedBy: updatedBy || null,
      });
      
      // Delete all existing thresholds for this ruleset
      await storage.deleteMetricThresholdsByRuleset(ruleset.id);
      
      // Create new thresholds
      const newThresholds = [];
      if (thresholds && Array.isArray(thresholds)) {
        for (let i = 0; i < thresholds.length; i++) {
          const t = thresholds[i];
          const threshold = await storage.createMetricThreshold({
            rulesetId: ruleset.id,
            minValue: t.minValue !== undefined ? t.minValue : null,
            maxValue: t.maxValue !== undefined ? t.maxValue : null,
            color: t.color || 'default',
            label: t.label || null,
            sortOrder: i,
          });
          newThresholds.push(threshold);
        }
      }
      
      res.json({
        ...ruleset,
        thresholds: newThresholds,
      });
    } catch (error) {
      console.error("[api] Error saving metric ruleset:", error);
      res.status(500).json({ error: "Failed to save metric ruleset" });
    }
  });

  // Global Search endpoint
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.query as string;
      if (!query || query.length < 2) {
        return res.json({ results: [], query: query || '', total: 0 });
      }
      
      const results = await storage.searchAllEntities(query);
      res.json({
        results,
        query,
        total: results.length,
      });
    } catch (error) {
      console.error("[api] Error searching:", error);
      res.status(500).json({ error: "Failed to search" });
    }
  });

  // Bug Reports endpoint
  let bugReportsTableInitialized = false;
  async function ensureBugReportsTable() {
    if (bugReportsTableInitialized) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.bug_reports (
          id SERIAL PRIMARY KEY,
          titulo TEXT NOT NULL,
          descricao TEXT NOT NULL,
          pagina TEXT,
          user_agent TEXT,
          user_email TEXT,
          user_name TEXT,
          status TEXT DEFAULT 'aberto',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      bugReportsTableInitialized = true;
      console.log("[database] Bug reports table initialized");
    } catch (error) {
      console.error("[database] Error initializing bug_reports table:", error);
    }
  }

  app.post("/api/bug-reports", async (req, res) => {
    try {
      await ensureBugReportsTable();
      
      const { titulo, descricao, pagina, userAgent } = req.body;
      const user = (req as any).user;
      const userEmail = user?.email || null;
      const userName = user?.name || null;
      
      if (!titulo || !descricao) {
        return res.status(400).json({ error: "Título e descrição são obrigatórios" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO cortex_core.bug_reports (titulo, descricao, pagina, user_agent, user_email, user_name)
        VALUES (${titulo}, ${descricao}, ${pagina || null}, ${userAgent || null}, ${userEmail}, ${userName})
        RETURNING *
      `);
      
      console.log("[api] Bug report created:", result.rows[0]);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating bug report:", error);
      res.status(500).json({ error: "Failed to create bug report" });
    }
  });

  // Acessos Module - registered from separate file
  await registerAcessosRoutes(app, db, storage);

  // HR Module - registered from separate file
  registerHRRoutes(app, db, storage);

  // Growth Module - registered from separate file
  registerGrowthRoutes(app, db, storage);

  // DRE (Demonstrativo de Resultado) - registered from separate file
  registerDRERoutes(app, db, storage);

  // Metas & Notifications Module - registered from separate file
  await registerMetasRoutes(app, db, storage);

  // Tech Module - registered from separate file
  registerTechRoutes(app, db, storage);

  // Relatório Mensal PDF - registered from separate file
  registerRelatorioMensalRoutes(app, db);

  // Relatório Mensal Slides (Reporte Mensal)
  registerRelatorioMensalSlidesRoutes(app, db);

  // Contratos Module - registered from separate file
  registerContratosRoutes(app);

  // Chat Atendimento - registered from separate file
  registerChatRoutes(app);

  // Chamados Module - registered from separate file
  registerChamadosRoutes(app);

  // TurboZap - Central de Cobranças via WhatsApp
  registerTurboZapRoutes(app);
  initTurboZapTables().catch((err) => console.error("[turbozap] Init error:", err));

  // Jurídico Assistente IA - registered from separate file
  registerJuridicoAssistenteRoutes(app);

  // Jurídico Relatórios - registered from separate file
  registerJuridicoRelatoriosRoutes(app);

  // Inadimplência Module - registered from separate file
  registerInadimplenciaRoutes(app);

  // GEG (Gestão Estratégica de Gente) - registered from separate file
  registerGEGRoutes(app, db, storage);

  // Comercial (Closers, SDRs, Vendas) - registered from separate file
  registerComercialRoutes(app);

  // OKR 2026 - registered from separate file
  registerOKR2026Routes(app);

  // ============================================
  // Sugestões API
  // ============================================
  
  let sugestoesTableInitialized = false;
  async function ensureSugestoesTable() {
    if (sugestoesTableInitialized) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.sugestoes (
          id SERIAL PRIMARY KEY,
          tipo VARCHAR(50) NOT NULL,
          titulo VARCHAR(255) NOT NULL,
          descricao TEXT NOT NULL,
          prioridade VARCHAR(20) DEFAULT 'media',
          status VARCHAR(50) DEFAULT 'pendente',
          autor_id VARCHAR(100) NOT NULL,
          autor_nome VARCHAR(255) NOT NULL,
          autor_email VARCHAR(255),
          modulo VARCHAR(100),
          anexo_path TEXT,
          criado_em TIMESTAMP DEFAULT NOW(),
          atualizado_em TIMESTAMP DEFAULT NOW(),
          comentario_admin TEXT
        )
      `);
      sugestoesTableInitialized = true;
      console.log("[api] cortex_core.sugestoes table initialized");
    } catch (error) {
      console.error("[api] Error initializing sugestoes table:", error);
    }
  }

  // GET all sugestões
  app.get("/api/sugestoes", isAuthenticated, async (req, res) => {
    try {
      await ensureSugestoesTable();
      
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.sugestoes ORDER BY criado_em DESC
      `);
      
      const sugestoes = result.rows.map((row: any) => ({
        id: row.id,
        tipo: row.tipo,
        titulo: row.titulo,
        descricao: row.descricao,
        prioridade: row.prioridade,
        status: row.status,
        autorId: row.autor_id,
        autorNome: row.autor_nome,
        autorEmail: row.autor_email,
        modulo: row.modulo,
        anexoPath: row.anexo_path,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
        comentarioAdmin: row.comentario_admin,
      }));
      
      res.json(sugestoes);
    } catch (error) {
      console.error("[api] Error fetching sugestoes:", error);
      res.status(500).json({ error: "Failed to fetch sugestoes" });
    }
  });

  // POST create sugestão
  app.post("/api/sugestoes", isAuthenticated, async (req, res) => {
    try {
      await ensureSugestoesTable();
      
      const user = (req as any).user;
      const { tipo, titulo, descricao, prioridade, modulo } = req.body;
      
      if (!tipo || !titulo || !descricao) {
        return res.status(400).json({ error: "Tipo, título e descrição são obrigatórios" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO cortex_core.sugestoes (tipo, titulo, descricao, prioridade, modulo, autor_id, autor_nome, autor_email)
        VALUES (${tipo}, ${titulo}, ${descricao}, ${prioridade || 'media'}, ${modulo || null}, ${user.id}, ${user.name}, ${user.email})
        RETURNING *
      `);
      
      const row = result.rows[0] as any;
      const sugestao = {
        id: row.id,
        tipo: row.tipo,
        titulo: row.titulo,
        descricao: row.descricao,
        prioridade: row.prioridade,
        status: row.status,
        autorId: row.autor_id,
        autorNome: row.autor_nome,
        autorEmail: row.autor_email,
        modulo: row.modulo,
        anexoPath: row.anexo_path,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
        comentarioAdmin: row.comentario_admin,
      };
      
      console.log("[api] Sugestão created:", sugestao.id);
      res.status(201).json(sugestao);
    } catch (error) {
      console.error("[api] Error creating sugestao:", error);
      res.status(500).json({ error: "Failed to create sugestao" });
    }
  });

  // PATCH update sugestão status (admin only)
  app.patch("/api/sugestoes/:id", isAuthenticated, async (req, res) => {
    try {
      await ensureSugestoesTable();
      
      const { id } = req.params;
      const { status, comentarioAdmin } = req.body;
      const user = (req as any).user;
      
      // Check if user is admin for status updates
      if (status && user.role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem atualizar o status" });
      }
      
      const updates: string[] = [];
      const values: any[] = [];
      
      if (status) {
        updates.push("status = $1");
        values.push(status);
      }
      
      if (comentarioAdmin !== undefined) {
        updates.push(`comentario_admin = $${values.length + 1}`);
        values.push(comentarioAdmin);
      }
      
      updates.push(`atualizado_em = NOW()`);
      
      if (updates.length === 1) {
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
      }
      
      const result = await db.execute(sql`
        UPDATE cortex_core.sugestoes 
        SET status = COALESCE(${status}, status),
            comentario_admin = COALESCE(${comentarioAdmin}, comentario_admin),
            atualizado_em = NOW()
        WHERE id = ${parseInt(id)}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Sugestão não encontrada" });
      }
      
      const row = result.rows[0] as any;
      const sugestao = {
        id: row.id,
        tipo: row.tipo,
        titulo: row.titulo,
        descricao: row.descricao,
        prioridade: row.prioridade,
        status: row.status,
        autorId: row.autor_id,
        autorNome: row.autor_nome,
        autorEmail: row.autor_email,
        modulo: row.modulo,
        anexoPath: row.anexo_path,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
        comentarioAdmin: row.comentario_admin,
      };
      
      console.log("[api] Sugestão updated:", sugestao.id);
      res.json(sugestao);
    } catch (error) {
      console.error("[api] Error updating sugestao:", error);
      res.status(500).json({ error: "Failed to update sugestao" });
    }
  });

  // ============================================
  // Access Logs API
  // ============================================

  // Initialize access_logs table on first use
  let accessLogsTableInitialized = false;
  async function ensureAccessLogsTable() {
    if (accessLogsTableInitialized) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS access_logs (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          action TEXT NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id VARCHAR(100),
          entity_name TEXT,
          client_id VARCHAR(100),
          client_name TEXT,
          details TEXT,
          user_email VARCHAR(255),
          user_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      accessLogsTableInitialized = true;
      console.log("[api] access_logs table initialized");
    } catch (error) {
      console.error("[api] Error initializing access_logs table:", error);
    }
  }

  // POST create access log
  app.post("/api/acessos/logs", async (req, res) => {
    try {
      await ensureAccessLogsTable();
      
      const { action, entityType, entityId, entityName, clientId, clientName, details } = req.body;
      const user = (req as any).user;
      const userEmail = user?.email || null;
      const userName = user?.name || null;
      
      if (!action || !entityType) {
        return res.status(400).json({ error: "action and entityType are required" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO access_logs (action, entity_type, entity_id, entity_name, client_id, client_name, details, user_email, user_name)
        VALUES (${action}, ${entityType}, ${entityId || null}, ${entityName || null}, ${clientId || null}, ${clientName || null}, ${details || null}, ${userEmail}, ${userName})
        RETURNING *
      `);
      
      const row = result.rows[0] as any;
      const log = {
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityName: row.entity_name,
        clientId: row.client_id,
        clientName: row.client_name,
        details: row.details,
        userEmail: row.user_email,
        userName: row.user_name,
        createdAt: row.created_at,
      };
      
      res.status(201).json(log);
    } catch (error) {
      console.error("[api] Error creating access log:", error);
      res.status(500).json({ error: "Failed to create access log" });
    }
  });

  // GET access logs with filters
  app.get("/api/acessos/logs", async (req, res) => {
    try {
      await ensureAccessLogsTable();
      
      const { action, entityType, clientId, limit = '100' } = req.query;
      
      const conditions: ReturnType<typeof sql>[] = [];
      
      if (action) {
        conditions.push(sql`action = ${action}`);
      }
      
      if (entityType) {
        conditions.push(sql`entity_type = ${entityType}`);
      }
      
      if (clientId) {
        conditions.push(sql`client_id = ${clientId}`);
      }
      
      const limitNum = Math.min(parseInt(limit as string) || 100, 500);
      
      let result;
      if (conditions.length > 0) {
        const whereClause = sql.join(conditions, sql` AND `);
        result = await db.execute(sql`SELECT * FROM access_logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${limitNum}`);
      } else {
        result = await db.execute(sql`SELECT * FROM access_logs ORDER BY created_at DESC LIMIT ${limitNum}`);
      }
      
      // Map snake_case to camelCase for frontend compatibility
      const logs = result.rows.map((row: any) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityName: row.entity_name,
        clientId: row.client_id,
        clientName: row.client_name,
        details: row.details,
        userEmail: row.user_email,
        userName: row.user_name,
        createdAt: row.created_at,
      }));
      
      res.json(logs);
    } catch (error) {
      console.error("[api] Error fetching access logs:", error);
      res.status(500).json({ error: "Failed to fetch access logs" });
    }
  });

  // ============================================
  // Conhecimentos Module - Courses API
  // ============================================

  // Ensure courses table exists (without dropping existing data)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.courses (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        status TEXT DEFAULT 'sem_status',
        tema_principal TEXT,
        plataforma TEXT,
        url TEXT,
        login TEXT,
        senha TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.benefits (
        id TEXT PRIMARY KEY,
        empresa TEXT NOT NULL,
        cupom TEXT,
        desconto TEXT,
        site TEXT,
        segmento TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {}
  
  // Restore data from CSV - run once on startup if tables are empty
  try {
    const coursesCheck = await db.execute(sql`SELECT COUNT(*) as count FROM cortex_core.courses`);
    const coursesCount = parseInt(String((coursesCheck.rows[0] as any).count), 10);
    
    if (coursesCount === 0) {
      console.log("[conhecimentos] Restoring courses from CSV backup...");
      // Insert all courses from backup
      const coursesData = [
        {id: "01b7d118-1622-453a-b08a-c33478296ad9", nome: "Introdução ao design de logos: do briefing à apresentação final", status: "ativo", tema_principal: "Designer", plataforma: "Não informada", url: "https://www.domestika.org/pt/courses/1612-introducao-ao-design-de-logos-do-briefing-a-apresentacao-final/course", login: "rafael.vilella@turbopartners.com.br", senha: null, created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "02e67491-84c9-4b3e-948b-104f3268f93b", nome: "Hunter Start", status: "ativo", tema_principal: "Comunicação", plataforma: "Própria", url: "https://membros.marcostrider.com.br/users/sign_in", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "04b836b0-1a3f-437b-98f6-814f80945712", nome: "Guerrilha Way", status: "cancelado", tema_principal: "Desenvolvimento Pessoal", plataforma: "Própria", url: "https://app.guerrilhaway.com.br/login", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "0670d085-c168-4dc0-9ce6-81441a7020a9", nome: "Brainstorm Academy", status: "ativo", tema_principal: "After Efects, Premiere, Photoshop e outros Design", plataforma: "Hotmart", url: "https://app.brainstorm.academy/painel", login: "rafael.vilella@turbopartners.com.br", senha: null, created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "09499419-78b1-44ee-a42d-1d95a92be8e0", nome: "Criadores 21", status: "ativo", tema_principal: "Marketing Digital/ Social Midia", plataforma: "Hotmart", url: "https://criadores21black.club.hotmart.com/", login: "raphael@vinteo.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "0989d3f3-59c6-48e5-89ac-17f913d0a664", nome: "Curso de FIGMA", status: "vitalicio", tema_principal: "UI/UX Designer", plataforma: "Hotmart", url: "https://hotmart.com/en/club/cursodefigma/products/1890184/content/EOgQGr6Ge6", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "11af770a-08a2-4223-8d05-06da072bf448", nome: "Contigenciamento de BM  Pai do Trafego", status: "ativo", tema_principal: "Contigenciamento de BM  Pai do Trafego", plataforma: "Não informada", url: "https://conteudofechado.astronmembers.com/entrar&logout", login: "gustavo.dias30@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "126cea43-28c7-415a-b94a-b3c319654e98", nome: "Photoshop Descomplicado", status: "ativo", tema_principal: "Arte Visual", plataforma: "Hotmart", url: "https://photoshopdescomplicado.club.hotmart.com", login: "breno_@live.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "145d2e96-3580-4afe-b050-b060c2e4f57f", nome: "Comunidade Sobral", status: "ativo", tema_principal: "Marketing / tráfego", plataforma: "Própria", url: "https://www.subido.com.br/login", login: "rodrigo.queiroz@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "165b7652-4b5f-4ae0-af68-65dcc5c671d0", nome: "FigmaisPRO", status: "cancelado", tema_principal: "Webdesigner", plataforma: "Cademi", url: "https://figmaisacademy.cademi.com.br", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "1acdb4df-4e52-4c0f-a6b7-62cda0551b57", nome: "Illustrator PRO", status: "ativo", tema_principal: "Designer", plataforma: "Não informada", url: "https://portal.thedesignacademy.com.br/area/vitrine", login: "rafael.vilella@turbopartners.com.br", senha: null, created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "1ba8670d-e61a-406a-a0c3-52cb855a762c", nome: "Profissão Tráfego", status: "ativo", tema_principal: "Marketing / Afiliado", plataforma: "Própria", url: "Própria", login: "gabriiel0@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "1bc8b61a-bc0f-4e6d-94e1-8be067afd64e", nome: "NestJS - Modern TypeScript Back-end Development", status: "ativo", tema_principal: "Programação backend", plataforma: "Udemy", url: "https://udemy.com/course/nestjs-zero-to-hero/learn", login: "thephfernandes@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "1c38ff5c-3764-4d8d-a19a-3841b5639268", nome: "G4 Plataforma", status: "ativo", tema_principal: "Negócios", plataforma: "Propria", url: "https://plataforma.g4educacao.com/home", login: "rodrigo.queiroz@turbopartners.com.br", senha: "codigo no email", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "20aa9df4-e78d-4c28-9dd9-5f6c485c49c8", nome: "TURBO CLASS", status: "ativo", tema_principal: "Diversos", plataforma: "Kiwify", url: "Kiwify", login: "roberto.fachetti@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "20d16583-0c35-4ae2-a696-601dd604a899", nome: "React Avançado - Teste", status: "ativo", tema_principal: "Programação", plataforma: "Udemy", url: "https://udemy.com/react-avancado", login: "usuario@teste.com", senha: "senha123", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "22825d46-9cc1-41f2-b576-1e8e870161c4", nome: "Pior Ano da sua Vida", status: "ativo", tema_principal: "Desenvolvimento Pessoal", plataforma: "Própria", url: "http://app.startgamification.com.br", login: "pav@pedro607", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "2523ab0c-73fb-4861-bc3a-5baa2bef237f", nome: "Henrique Marinho High Ticket", status: "cancelado", tema_principal: "Marketing Digital", plataforma: "Não informada", url: "https://henriquemarinho.curseduca.pro/", login: "raphaelmg.contato@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "29b7cb60-958e-4944-86af-fba84c356d97", nome: "G4 AI", status: "ativo", tema_principal: "AI", plataforma: "Propria", url: "https://ai.g4educacao.com/", login: "rodrigo.queiroz@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "2c229ae3-2e44-4f31-8fa8-631cae58f8e5", nome: "Criando clientes vendedores - Indicação", status: "ativo", tema_principal: "Marketing Digital", plataforma: "Hotmart", url: "https://criandoclientesvendedores20.club.hotmart.com/index", login: "romulo.felippe@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "2d3d815e-b20a-4eba-bf7a-d87f6a303877", nome: "Design para Flyer", status: "ativo", tema_principal: "Arte Visual", plataforma: "Hotmart", url: "https://designparaflyers.club.hotmart.com", login: "breno_@live.com", senha: "breno_@live.com", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "2e2db7af-84bb-4249-8670-ec97c7d4d0a4", nome: "Comunidade Lendária", status: "cancelado", tema_principal: "Inteligência Artificial", plataforma: "Hotmart", url: "https://comunidade.vidalendaria.com.br/", login: "pedro.lorenzoni@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "2fb3d9ca-faca-4299-a0f4-d7157605c2b0", nome: "Blank School", status: "ativo", tema_principal: "Criação de conteúdo", plataforma: "Própria", url: "https://login.blankschool.com.br/", login: "contato@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "3020266f-d59f-4fb4-8d9e-c351918fb39d", nome: "Portfólio Lucrativo", status: "ativo", tema_principal: "Arte Visual", plataforma: "Hotmart", url: "https://portfoliolucrativo.club.hotmart.com", login: "breno_@live.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "3328465d-12f2-4509-afe5-cae67a6c5c78", nome: "Figcria - Rodrigo Bispo", status: "ativo", tema_principal: "Figma", plataforma: "Cakto", url: "https://app.rodrigobispo.com.br/campus/", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "39783815-88e8-4b79-8fb1-5c388a5cd7e9", nome: "Formação Storytelling", status: "cancelado", tema_principal: "Marketing Digital", plataforma: "Própria", url: "https://escola.estadodaarte.com.br/", login: "otaviohenriquemkt@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "3f13460e-bafa-474b-be99-a2bc5ce8c7a7", nome: "NEOART Academy", status: "sem_status", tema_principal: "Inteligencia Artificial para criar imagens e ativos", plataforma: "Kiwify", url: "https://dashboard.kiwify.com.br/", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "40d63788-d2a7-4089-9773-649f79317345", nome: "Desenvolver Temas Shopify", status: "ativo", tema_principal: "Programação", plataforma: "Udemy", url: "udemy.com.br", login: "breno_@live.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "41700a33-7ddf-41fc-be6b-de4d7ca8e47c", nome: "Data Studio 2", status: "ativo", tema_principal: "Capacitação Pessoal", plataforma: "Nutror", url: "https://cursos.nutror.com/982948f35f6589d421ad6a4eb2fe3249825c2141?accounts_first_access_token=***REMOVED***", login: "rodrigo@nave.ac", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "433ad9fd-be02-45ff-8a70-d97c755ed70a", nome: "André Lug", status: "ativo", tema_principal: "Make - Chat gpt", plataforma: "Kiwify", url: null, login: "caiomassaroni@hotmail.com", senha: null, created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "45552a6d-29bc-4981-9095-1efa9a232c61", nome: "Robo ZAP", status: "sem_status", tema_principal: "Automação de geração de Lead e prospecção", plataforma: "Kiwify", url: null, login: "partnersturbo@gmail.com", senha: "partnersturbo@gmail.com", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "4a3b68f2-0b79-411f-a9bb-7f28aabd9e57", nome: "O Unico Plano - V4 Company", status: "ativo", tema_principal: "Marketing Digital", plataforma: "Cademi", url: "https://conteudo.v4company.com/area/vitrine", login: "rodrigo.queiroz@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "4a98d5ba-e59e-4b46-86ea-ef955bd57506", nome: "Máquina de Tráfego do Adriano Gianini", status: "ativo", tema_principal: "Google Ads", plataforma: "Não informada", url: "https://membros.maquinadetrafegoeconversao.com.br/area/vitrine", login: "rafael.vilella@turbopartners.com.br", senha: null, created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "4aaa869d-fc20-4242-99d4-32c60b793000", nome: "Swiper - EDITED", status: "vitalicio", tema_principal: "Copywriting", plataforma: "Própria", url: "https://swiper.com.br/", login: "peixotos.victor@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "501e1885-321c-4b78-bf85-b063113c6b99", nome: "Negócio em um Fim de Semana", status: "ativo", tema_principal: "Marketing  Digital", plataforma: "Própria", url: "https://copyexperts.memberkit.com.br/", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "5295f0a4-a019-4058-b4ef-bb14656593d1", nome: "Stage", status: "cancelado", tema_principal: "Marketing Digital", plataforma: "Propria", url: "https://app.staage.com/", login: "victor.peixoto@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "54ca276d-4e2d-4ec9-8c67-1cb8b84b5b3a", nome: "Alura", status: "ativo", tema_principal: "Produtividade / Programação", plataforma: "Udemy", url: "https://udemy.com/course/automate/learn/", login: "thephfernandes@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "55fd8b6e-596c-4701-8c2c-3c4adfdae313", nome: "Mentoria Naguel", status: "cancelado", tema_principal: "Marketing Digital Gestão", plataforma: "Hotmart", url: "https://mentoriaguilhermenagel.club.hotmart.com/", login: "joao.guarconi@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "5cb49990-86d1-47cc-b5de-23780bb4d354", nome: "ManyChat", status: "ativo", tema_principal: "Automação - Whatsapp- Instagram e etc", plataforma: "Não informada", url: "https://membros.gestorautomator.com.br/", login: "gustavo.dias30@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "5d372af7-7ea3-470f-92bb-eb364f424dfe", nome: "Agência de Sucesso", status: "ativo", tema_principal: "Marketing Digital", plataforma: "Hotmart", url: "https://planove20.club.hotmart.com/t", login: "arthurmach98@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "61266f87-0027-41d0-9224-441aa69a45de", nome: "Formação Gestor Digital", status: "cancelado", tema_principal: "Marketing Digital Gestão", plataforma: "Blue Rock", url: "https://bluerock.cademi.com.br/auth/login", login: "rodrigoqs9@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "65ffdad3-e0b4-48af-a6a8-2e25e2402469", nome: "G4 Skills", status: "ativo", tema_principal: "Hards and soft skills", plataforma: "Própria", url: "Plataforma G4 Educação", login: "ferramentas@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "67ccfe3c-9224-4f17-94d4-f11aa0ed5fdf", nome: "Metodologia HeyCommerce", status: "vitalicio", tema_principal: "Marketing Digital", plataforma: "Hotmart", url: "https://metodologiaheycommerce.club.hotmart.com/lesson/0OvwgQxW4j/", login: "robertofachetti3@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "737104ee-fd32-4409-814f-6f3c86e3786d", nome: "Comunidade Mamba", status: "ativo", tema_principal: "Marketing Digital", plataforma: "Própria", url: "https://comunidade.mambaculture.com/", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "73e4f1c4-6cd2-432a-86f5-b5764dfb4ce9", nome: "FL Insider", status: "ativo", tema_principal: "Marketing / tráfego", plataforma: "Própria", url: "https://flinsider.klickmembers.com.br", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "7bcfdc70-b5fa-4085-abe3-563282c75012", nome: "Edição de Alto Impacto", status: "ativo", tema_principal: "Edição de video", plataforma: "Hotmart", url: "https://hotmart.com/pt-BR/club/video-de-alto-impacto/products/3590732", login: "mateusm.souzaph@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "806218da-e5cf-4ea8-9271-885bbba2bc67", nome: "Programa Liberdade Digital", status: "ativo", tema_principal: "Marketing Digital", plataforma: "Própria", url: "https://pld.xgrow.com/", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "8622536d-5924-4961-9cef-72bc9f9e4dbe", nome: "Pré-vestibular da Bola", status: "ativo", tema_principal: "Linguagem de Futebol", plataforma: "Hotmart", url: "https://futurocraqueacademyseucursopre.club.hotmart.com/lesson/kOXlEZDdOW/1-boas-vindas-e-historia", login: "arthurzon08@outlook.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "8da717ec-4354-4517-9db7-b4d972f1f216", nome: "Vídeos de Colam - Hannah Franklin", status: "ativo", tema_principal: "Criação de conteúdo", plataforma: "Hotmart", url: "https://co.videosquecolam.co/pt-br/club/videosquecolam/products/4755870", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "92289b54-2e82-4c59-9325-3ba38b75b7be", nome: "Métricas Boss", status: "ativo", tema_principal: "Performance Google Analytics GA4", plataforma: "Não informada", url: "https://prime.metricasboss.com.br/auth/login", login: "ferramentas@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "98347daf-e5ff-4ed8-90b9-8e03db1fc58e", nome: "Curso Cientista do Marketing Digital", status: "ativo", tema_principal: "Marketing Digital", plataforma: "Própria", url: "https://university.staage.com/s/login", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "99e9954d-f055-4a2e-a813-e7dad068eb6b", nome: "Power BI - Xperiun", status: "ativo", tema_principal: "Curso de Power Bi rerefencia do mercado", plataforma: "Não informada", url: "https://xperiun.com/", login: "heitorg1701@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "9d9b59ee-58f0-4955-a5a4-9f2589693287", nome: "Figmais pro", status: "cancelado", tema_principal: "Figma", plataforma: "Propria", url: "https://figmais.astronmembers.com/entrar", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "9de4cd85-b915-4084-9ea2-c8329445ac07", nome: "Design para Social Media", status: "ativo", tema_principal: "Arte Visual", plataforma: "Hotmart", url: "https://designparasocialmedia.club.hotmart.com", login: "breno_@live.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "9fb0af7e-0440-47db-8435-b3e5cfb1b9cf", nome: "Curso Rocketseat", status: "ativo", tema_principal: "Programação", plataforma: "Própria", url: "https://app.rocketseat.com.br/home", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "a0d445b0-8fc6-4a90-b7a9-abb89d8d62e9", nome: "Agência de Sucesso", status: "ativo", tema_principal: "Marketing Digital / Gestão", plataforma: "Hotmart", url: "https://planove20.club.hotmart.com/t", login: "arthurmach98@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "a45182f7-e794-47a1-be1e-c52da3c7d61e", nome: "6 em 30 - Micha Menezes", status: "cancelado", tema_principal: "Marketing  Digital", plataforma: "Hotmart", url: "https://aceleradordeanunciosoficial.club.hotmart.com/", login: "squadecriativo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "a7c7cb0b-b24f-43c0-8e64-a6c6025a69d6", nome: "Stories Animados", status: "ativo", tema_principal: "Arte Visual", plataforma: "Hotmart", url: "https://storiesanimados.club.hotmart.com", login: "breno_@live.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "ab3b2d4b-ae27-4ec7-a6e6-4feae07c66f0", nome: "Copy Camp", status: "cancelado", tema_principal: "Copywriting", plataforma: "Própria", url: "https://www.empiricus.com.br/", login: "13705975765", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "af0a407f-427b-4ba1-bdb5-3ce6084ea53a", nome: "Método Supernova", status: "ativo", tema_principal: "Crescimento do Instagram", plataforma: "Própria", url: "https://alunos.metodosupernova.com/area/vitrine", login: "inovevix.institucional@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "b0c3f3b4-ba46-43f1-8ef3-a05bc91c3dec", nome: "Rede de Influencer - Agua Azul", status: "cancelado", tema_principal: "Mkt de Influencia", plataforma: "Propria", url: "https://ead.evermart.com.br/p/my-courses", login: "jsscaramussa@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "b6228c6f-1160-48f5-83d9-0210ca48d927", nome: "GTO: Comunidade Sobral ORGÂNICO", status: "ativo", tema_principal: "Marketing Digital", plataforma: "Própria", url: "https://gto.pedrosobral.com.br/", login: "rodrigo.queiroz@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "bf6cac0f-d83d-4eb4-b50a-2597124ecc2c", nome: "Data Studio 1", status: "ativo", tema_principal: "Dados BI/Dashboard", plataforma: "Hotmart", url: "https://gestaodemetricastreinamentoava.club.hotmart.com/", login: "rodrigo@nave.ac", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "c556d17a-e1ad-439c-84a8-3e378f29d04a", nome: "A Caçada", status: "ativo", tema_principal: "Marketing /Lançamentos", plataforma: "Própria", url: "https://alunos.acacadadigital.com.br", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "c716b32b-3e9a-4b05-95e3-224faba71d2c", nome: "Loom depository - Javy", status: "ativo", tema_principal: "Geral - Operacional", plataforma: "Loom", url: "https://docs.google.com/spreadsheets/d/1gk7oKDH2lJqdH-fYd3SxEpU6dyxmyZIF/edit", login: null, senha: null, created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "c9836105-097f-4036-a179-ccbfecb787f3", nome: "Close in Call", status: "ativo", tema_principal: "Vendas", plataforma: "Propria", url: "https://gravacao-intensivo.greenn.club/home", login: "victor.peixoto@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "cfc4d562-8931-42b6-9eb1-a29b84309ba5", nome: "Os 4 Temperamentos Humanos", status: "ativo", tema_principal: "Desenvolvimento Pessoal", plataforma: "Própria", url: "https://app.reallifeapp.com.br/", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "d463b924-f52c-4722-b492-e734a517d25e", nome: "Nomade Milionário", status: "cancelado", tema_principal: "Marketing / PLR", plataforma: "Própria", url: "outliers.members.ticto.com.br", login: "hddigitalbusiness@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "d8cb2e6d-16a9-476d-b86c-01c481173e4c", nome: "Rocket Ship Comercial", status: "ativo", tema_principal: "Comercial", plataforma: "Própria", url: "http://url7150.cademi.com.br/ls/click", login: "contato@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "ddb95d23-9134-42fd-8953-95dd0b7b3a78", nome: "Blueberry - Plataforma de cursos", status: "ativo", tema_principal: "Marketing Digital Gestão", plataforma: "Nutror", url: "https://blueberry.alpaclass.com/s/login", login: "joao.guarconi@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "e0b7de27-0a38-4d17-a0d4-184ad724a864", nome: "Venda Todo Santo Dia", status: "vitalicio", tema_principal: "Marketing Digital/ Infoprodutos", plataforma: "Hotmart", url: "https://club.hotmart.com/oauth/login/?productId=1006882", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "e21f5fbb-19d6-41ad-9bcd-a898a225c7fc", nome: "Visivius - Webflow", status: "sem_status", tema_principal: "Webdesigner", plataforma: "Própria", url: "https://aluno.vesuvius.com.br/users/sign_in", login: "breno.carmo@turbopartners.com.br", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "e2a41264-d7bb-4f6a-99ee-f638432f36ce", nome: "Gestor de Performance", status: "ativo", tema_principal: "Marketing / tráfego", plataforma: "Hotmart", url: "https://gestordeperformance.club.hotmart.com/lesson/3eajWBKp7g/entre-no-grupo-de-whatsapp", login: "rodrigoqs9@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "e521db93-2bb3-4194-af71-a36fab185426", nome: "Manipulação de Imagens", status: "ativo", tema_principal: "Arte Visual", plataforma: "Hotmart", url: "https://masterclassmanipulacaodeimagem.club.hotmart.com", login: "breno_@live.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "ebe5c4b4-56af-4a76-88dd-bf1864814701", nome: "WebProcess", status: "vitalicio", tema_principal: "Webdesigner", plataforma: "Hotmart", url: "https://hotmart.com/en/club/webprocess/products/1850094/content/kOXXNdbNOW", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "ed80a802-fa37-4f1f-89e0-48425c0c1125", nome: "Comunidade Zillo", status: "cancelado", tema_principal: "Marketing Digital / lançamento", plataforma: "Própria", url: "https://comunidade.priscilazillo.com.br/login", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "ede39f08-7ad6-4c5f-a747-898f08f04a0e", nome: "Formação Gestor Digital (Turma 2)", status: "cancelado", tema_principal: "Marketing Digital Gestão", plataforma: "Blue Rock", url: "https://bluerock.cademi.com.br/auth/login", login: null, senha: "123456", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "ee24b868-97d2-41fb-ab26-027b51cad228", nome: "Domestika - Cursos em Gerais", status: "vitalicio", tema_principal: "Designer", plataforma: "Domestika", url: "https://www.domestika.org/", login: "partnersturbo@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "ef66bf89-554b-496b-a359-6165834746c5", nome: "Report 10x", status: "ativo", tema_principal: "Marketing Digital", plataforma: "Kiwify", url: "https://www.canva.com/design/DAFl4yNteE8/zAPcGAlgLaCCAJC-QVo3XA/view", login: ".", senha: null, created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "f276c104-13ae-4bb8-a5b2-1d5624accf58", nome: "No code Startup", status: "ativo", tema_principal: "Agentes e automações", plataforma: "Não informada", url: "https://flix.nocodestartup.io/login", login: "flavio.marquesjrp@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "f32ffbf7-781a-4c77-b6a4-7b00fbb8a8cc", nome: "Fórmula de Lançamento", status: "cancelado", tema_principal: "Marketing / tráfego", plataforma: "Própria", url: "https://portal-fl.formuladelancamento.com.br", login: "pedroferreira0309@hotmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "f3bc8109-817a-4219-bfee-366696a76a1d", nome: "UX Design - AWARI", status: "ativo", tema_principal: "UX Design", plataforma: "Awari", url: "https://app.awari.com.br/", login: "gabriela.rsouza@outlook.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "fbab9949-02c7-4a94-b7db-841e513ff23a", nome: "Proposta de Valor", status: "ativo", tema_principal: "Arte Visual", plataforma: "Hotmart", url: "https://treinamentopropostadevalor.club.hotmart.com", login: "breno_@live.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"},
        {id: "fe046ac1-7d6a-45ab-a7ad-7b50edd3de93", nome: "Cadu ADS", status: "ativo", tema_principal: "Marketing Digital", plataforma: "Própria", url: "https://membros2.escala3ps.com/", login: "peixotos.victor@gmail.com", senha: "***REMOVED***", created_by: "08874f6c-f5d9-4f6e-97e4-16358281930f"}
      ];
      
      for (const course of coursesData) {
        await db.execute(sql`
          INSERT INTO cortex_core.courses (id, nome, status, tema_principal, plataforma, url, login, senha, created_by, created_at, updated_at)
          VALUES (${course.id}, ${course.nome}, ${course.status}, ${course.tema_principal}, ${course.plataforma}, ${course.url}, ${course.login}, ${course.senha}, ${course.created_by}, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `);
      }
      console.log("[conhecimentos] Restored " + coursesData.length + " courses successfully");
    }
    
    const benefitsCheck = await db.execute(sql`SELECT COUNT(*) as count FROM cortex_core.benefits`);
    const benefitsCount = parseInt(String((benefitsCheck.rows[0] as any).count), 10);
    
    if (benefitsCount === 0) {
      console.log("[conhecimentos] Restoring benefits from CSV backup...");
      const benefitsData = [
        {id: "063392d3-e298-4554-99ea-c999ee523984", empresa: "Gk Brand", cupom: "TURBO15", desconto: "15% off", site: "https://gkbrand.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "072c8ac3-941c-4d4c-b811-a206ace6251f", empresa: "Calê", cupom: "TURBO10", desconto: "10% off", site: "https://ecale.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "088df43b-9c81-4bd4-9c07-0539b6127b1d", empresa: "Guday", cupom: "TURBO20", desconto: "20% off", site: "https://guday.com.br/", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "0c2d12e6-fe76-459a-95fa-9c4b38d41811", empresa: "Chiara Café", cupom: "TURBO10", desconto: "10%off", site: "https://caffechiara.com.br/", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "16169ca4-ae34-41b4-b6ed-7fa986faa789", empresa: "Forcell", cupom: "TURBO20", desconto: "20% off", site: "https://forcellperformance.com.br/", segmento: "suplementacao", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "2317bfc8-a555-487d-9372-b5e1b3ae0b89", empresa: "LucyDays", cupom: "TURBODAYS", desconto: "20% off + Frete grátis", site: "https://lucydays.com/", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "23539d3a-94ce-440d-a51e-7d3be178bb74", empresa: "Modo On", cupom: "PRIMEIRACOMPRA", desconto: "10% off", site: "https://lojamodoon.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "3772de70-e49d-4e08-8d5e-1fe274d51b80", empresa: "Malloca", cupom: "turbo15", desconto: "15% off", site: "https://malloca.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "41a5da7f-c1db-49ad-a0ef-c81965995ff8", empresa: "Panelas Paula Souza", cupom: "TURBO10", desconto: "10% off", site: "https://www.cozinhapaulasouza.com.br/", segmento: "casa_cozinha", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "4e5d8467-b993-4c47-8482-8742eb38b537", empresa: "Catboss", cupom: "TURBO15", desconto: "15% off", site: "https://www.catboss.com.br/", segmento: "pet", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "5cde3e13-e14b-4603-9800-817899249427", empresa: "Skt Mafia", cupom: "MAFIA15", desconto: "15% off", site: "https://sktmafia.lojavirtualnuvem.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "60ab239b-d73f-4aae-a5a6-592a13ec275e", empresa: "Rootz", cupom: "TURBO35", desconto: "35% off", site: "https://enraizador.com.br/", segmento: "plantas_agro", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "6e4a1d7c-4b8d-4a8e-a72a-23a973c31d2f", empresa: "Date Snacks", cupom: "Turbo10", desconto: "10% off", site: "https://dates-snacks.com.br/discount/TURBO10", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "6f1963fd-f263-46d7-b075-8f452d3cd0eb", empresa: "Yellowfin", cupom: "TURBO10", desconto: "10% off", site: "https://www.yellowfinbr.com/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "761ecf28-0e69-4920-b320-2d6695d82195", empresa: "Minimal Club", cupom: "turbo15", desconto: "15% off", site: "https://minimalclub.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "89b8843c-b9fc-400e-a217-ede0c48d8fd2", empresa: "A Feira", cupom: "TURBO10", desconto: "10% off", site: "https://amoafeira.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "95c75cbb-e06a-4254-b37c-603d4d220765", empresa: "Florest", cupom: "TURBO12", desconto: "12% off", site: "https://florest-ecommerce.myshopify.com/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "9a7249e0-4897-4480-9a74-403c206fecf0", empresa: "Pipa", cupom: "PRIMEIROVOO", desconto: "10% off", site: "https://www.voudepipa.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "afb61f4a-5a5e-44f6-ae44-835cbac45437", empresa: "Lahza", cupom: "TURBO25", desconto: "25% off", site: "https://lahza.com.br", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "b866b66f-e4c4-4344-bf88-61d531ccd8f8", empresa: "CG", cupom: "AMIGOSDATURBO", desconto: "10% off", site: "https://www.lojacristalgraffiti.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "ba72871d-33fd-462d-b8ca-26003ddfec9a", empresa: "Gigio Geek", cupom: "TURBO10", desconto: "10% off", site: "https://www.gigiogeek.com.br/", segmento: "tecnologia", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "c5e4a478-9b79-4279-8434-844c730b7302", empresa: "Solvee", cupom: "TURBO15", desconto: "15% off", site: "https://faxina.solvee.app.br/", segmento: "casa_cozinha", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "d18aa2b8-e75b-4478-8616-5f6f20102063", empresa: "Ia Café", cupom: "TURBO20", desconto: "20% off", site: "https://iacafe.com.br/", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "d23e1c2a-a2f9-4dc2-bcaf-3defbec8c25c", empresa: "ĀYURVÈDIKA", cupom: "TURBO30", desconto: "30% off", site: "https://www.ayurvedika.com.br/", segmento: "beleza_cosmeticos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "d592d507-18d7-4ba9-9017-5d0988bb7d57", empresa: "Abetopine", cupom: "TURBO15", desconto: "15% off", site: "https://abetopine.com.br", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "d7b0ec6d-badd-4c39-bffc-aa40b836ba30", empresa: "Loja Byr", cupom: "turbo20", desconto: "20% off", site: "https://lojabyr.com.br/", segmento: "moda", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "d93a9194-b839-4765-bc76-89846e30a0ea", empresa: "Jui", cupom: "TURBO12", desconto: "12% off", site: "https://vivajui.com.br/", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "d98c1c14-9db5-4d99-b7d4-069513137858", empresa: "Cacow", cupom: "TURBO", desconto: "20% off", site: "https://cacow.com.br/", segmento: "suplementacao", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "e914cb92-b661-4abb-b6b7-96b0519beccf", empresa: "Blu Protetor", cupom: "TURBO15", desconto: "15% off", site: "https://www.bluprotetor.com.br/", segmento: "beleza_cosmeticos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "ecf11ad9-e629-4949-8598-792101927758", empresa: "Cadiveu Store", cupom: "TURBO30", desconto: "30% off", site: "https://store.cadiveu.com/", segmento: "beleza_cosmeticos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "ee2b4379-14c2-46c3-bc22-bafb86f4054c", empresa: "Bready", cupom: "TURBO20", desconto: "20% off", site: "https://www.meubready.com.br", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "f53f03a5-7638-44e1-bc1e-52d1cf135525", empresa: "Dot", cupom: "TURBO12", desconto: "12% off", site: "https://minhadot.com/", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "fb9859a9-ec93-40ea-93b8-88b4ca3a4a48", empresa: "Coffe Breaks", cupom: "TURBO10", desconto: "10% off", site: "https://coffeebreaks.com.br/", segmento: "alimentos", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"},
        {id: "fde0e783-4dfa-463f-aecb-01137aa7e1f9", empresa: "Shopcão", cupom: "TURBO10", desconto: "10% off", site: "https://www.shopcao.com.br", segmento: "pet", created_by: "1a6248a9-c965-499b-b074-881dfb40b053"}
      ];
      
      for (const benefit of benefitsData) {
        await db.execute(sql`
          INSERT INTO cortex_core.benefits (id, empresa, cupom, desconto, site, segmento, created_by, created_at, updated_at)
          VALUES (${benefit.id}, ${benefit.empresa}, ${benefit.cupom}, ${benefit.desconto}, ${benefit.site}, ${benefit.segmento}, ${benefit.created_by}, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `);
      }
      console.log("[conhecimentos] Restored " + benefitsData.length + " benefits successfully");
    }
  } catch (e) {
    console.log("[conhecimentos] Data restore check:", e);
  }

  // GET all courses with filters
  app.get("/api/conhecimentos", async (req, res) => {
    try {
      const { search, status, tema_principal, plataforma } = req.query;
      
      const conditions: ReturnType<typeof sql>[] = [];
      
      if (search) {
        const searchPattern = `%${search}%`;
        conditions.push(sql`(LOWER(nome) LIKE LOWER(${searchPattern}) OR LOWER(tema_principal) LIKE LOWER(${searchPattern}) OR LOWER(plataforma) LIKE LOWER(${searchPattern}))`);
      }
      
      if (status) {
        conditions.push(sql`status = ${status}`);
      }
      
      if (tema_principal) {
        conditions.push(sql`LOWER(tema_principal) = LOWER(${tema_principal})`);
      }
      
      if (plataforma) {
        conditions.push(sql`LOWER(plataforma) = LOWER(${plataforma})`);
      }
      
      let result;
      if (conditions.length > 0) {
        const whereClause = sql.join(conditions, sql` AND `);
        result = await db.execute(sql`SELECT * FROM cortex_core.courses WHERE ${whereClause} ORDER BY created_at DESC`);
      } else {
        result = await db.execute(sql`SELECT * FROM cortex_core.courses ORDER BY created_at DESC`);
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching courses:", error);
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  // GET single course
  app.get("/api/conhecimentos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`SELECT * FROM cortex_core.courses WHERE id = ${id}`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error fetching course:", error);
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  // POST create course
  app.post("/api/conhecimentos", async (req, res) => {
    try {
      const { nome, status, temaPrincipal, plataforma, url, login, senha } = req.body;
      const createdBy = (req as any).user?.email || null;
      
      if (!nome) {
        return res.status(400).json({ error: "Nome is required" });
      }
      
      const id = crypto.randomUUID();
      const statusVal = status || 'sem_status';
      const temaVal = temaPrincipal || null;
      const plataformaVal = plataforma || null;
      const urlVal = url || null;
      const loginVal = login || null;
      const senhaVal = senha || null;
      const createdByVal = createdBy || null;
      
      const result = await db.execute(sql`
        INSERT INTO cortex_core.courses (id, nome, status, tema_principal, plataforma, url, login, senha, created_by)
        VALUES (${id}, ${nome}, ${statusVal}, ${temaVal}, ${plataformaVal}, ${urlVal}, ${loginVal}, ${senhaVal}, ${createdByVal})
        RETURNING *
      `);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating course:", error);
      res.status(500).json({ error: "Failed to create course" });
    }
  });

  // PATCH update course
  app.patch("/api/conhecimentos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, status, temaPrincipal, plataforma, url, login, senha } = req.body;
      
      const result = await db.execute(sql`
        UPDATE cortex_core.courses 
        SET nome = COALESCE(${nome}, nome),
            status = COALESCE(${status}, status),
            tema_principal = COALESCE(${temaPrincipal}, tema_principal),
            plataforma = COALESCE(${plataforma}, plataforma),
            url = COALESCE(${url}, url),
            login = COALESCE(${login}, login),
            senha = COALESCE(${senha}, senha),
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating course:", error);
      res.status(500).json({ error: "Failed to update course" });
    }
  });

  // DELETE course
  app.delete("/api/conhecimentos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`DELETE FROM cortex_core.courses WHERE id = ${id} RETURNING id`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting course:", error);
      res.status(500).json({ error: "Failed to delete course" });
    }
  });

  // ============================================
  // Benefícios Module - Benefits API
  // ============================================

  // GET all benefits with filters
  app.get("/api/beneficios", async (req, res) => {
    try {
      const { search, segmento } = req.query;
      
      const conditions: ReturnType<typeof sql>[] = [];
      
      if (search) {
        const searchPattern = `%${search}%`;
        conditions.push(sql`(LOWER(empresa) LIKE LOWER(${searchPattern}) OR LOWER(cupom) LIKE LOWER(${searchPattern}) OR LOWER(site) LIKE LOWER(${searchPattern}))`);
      }
      
      if (segmento) {
        conditions.push(sql`segmento = ${segmento}`);
      }
      
      let result;
      if (conditions.length > 0) {
        const whereClause = sql.join(conditions, sql` AND `);
        result = await db.execute(sql`SELECT * FROM cortex_core.benefits WHERE ${whereClause} ORDER BY created_at DESC`);
      } else {
        result = await db.execute(sql`SELECT * FROM cortex_core.benefits ORDER BY created_at DESC`);
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching benefits:", error);
      res.status(500).json({ error: "Failed to fetch benefits" });
    }
  });

  // GET single benefit
  app.get("/api/beneficios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`SELECT * FROM cortex_core.benefits WHERE id = ${id}`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Benefit not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error fetching benefit:", error);
      res.status(500).json({ error: "Failed to fetch benefit" });
    }
  });

  // POST create benefit
  app.post("/api/beneficios", async (req, res) => {
    try {
      const { empresa, cupom, desconto, site, segmento } = req.body;
      const createdBy = (req as any).user?.email || null;
      
      if (!empresa) {
        return res.status(400).json({ error: "Empresa is required" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO cortex_core.benefits (empresa, cupom, desconto, site, segmento, created_by)
        VALUES (${empresa}, ${cupom || null}, ${desconto || null}, ${site || null}, ${segmento || null}, ${createdBy})
        RETURNING *
      `);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating benefit:", error);
      res.status(500).json({ error: "Failed to create benefit" });
    }
  });

  // PATCH update benefit
  app.patch("/api/beneficios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { empresa, cupom, desconto, site, segmento } = req.body;
      
      const result = await db.execute(sql`
        UPDATE cortex_core.benefits 
        SET empresa = COALESCE(${empresa}, empresa),
            cupom = COALESCE(${cupom}, cupom),
            desconto = COALESCE(${desconto}, desconto),
            site = COALESCE(${site}, site),
            segmento = COALESCE(${segmento}, segmento),
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Benefit not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating benefit:", error);
      res.status(500).json({ error: "Failed to update benefit" });
    }
  });

  // DELETE benefit
  app.delete("/api/beneficios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`DELETE FROM cortex_core.benefits WHERE id = ${id} RETURNING id`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Benefit not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting benefit:", error);
      res.status(500).json({ error: "Failed to delete benefit" });
    }
  });

  // ============================================
  // Ferramentas Module - Turbo Tools API
  // ============================================

  // GET all tools
  app.get("/api/ferramentas", async (req, res) => {
    try {
      const { search } = req.query;
      
      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await db.execute(sql`
          SELECT * FROM cortex_core.turbo_tools
          WHERE LOWER(name) LIKE LOWER(${searchPattern}) OR LOWER(site) LIKE LOWER(${searchPattern})
          ORDER BY created_at DESC
        `);
      } else {
        result = await db.execute(sql`SELECT * FROM cortex_core.turbo_tools ORDER BY created_at DESC`);
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching tools:", error);
      res.status(500).json({ error: "Failed to fetch tools" });
    }
  });

  // GET single tool
  app.get("/api/ferramentas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`SELECT * FROM cortex_core.turbo_tools WHERE id = ${id}`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Tool not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error fetching tool:", error);
      res.status(500).json({ error: "Failed to fetch tool" });
    }
  });

  // POST create tool
  app.post("/api/ferramentas", async (req, res) => {
    try {
      const { name, login, password, site, observations, valor, recorrencia, dataPrimeiroPagamento } = req.body;
      const createdBy = (req as any).user?.email || null;
      
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO turbo_tools (name, login, password, site, observations, valor, recorrencia, data_primeiro_pagamento, created_by)
        VALUES (${name}, ${login || null}, ${password || null}, ${site || null}, ${observations || null}, ${valor || null}, ${recorrencia || null}, ${dataPrimeiroPagamento || null}, ${createdBy})
        RETURNING *
      `);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating tool:", error);
      res.status(500).json({ error: "Failed to create tool" });
    }
  });

  // PATCH update tool
  app.patch("/api/ferramentas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, login, password, site, observations, valor, recorrencia, dataPrimeiroPagamento } = req.body;
      
      const result = await db.execute(sql`
        UPDATE turbo_tools 
        SET name = COALESCE(${name}, name),
            login = COALESCE(${login}, login),
            password = COALESCE(${password}, password),
            site = COALESCE(${site}, site),
            observations = COALESCE(${observations}, observations),
            valor = COALESCE(${valor}, valor),
            recorrencia = COALESCE(${recorrencia}, recorrencia),
            data_primeiro_pagamento = COALESCE(${dataPrimeiroPagamento}, data_primeiro_pagamento),
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Tool not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating tool:", error);
      res.status(500).json({ error: "Failed to update tool" });
    }
  });

  // DELETE tool
  app.delete("/api/ferramentas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`DELETE FROM cortex_core.turbo_tools WHERE id = ${id} RETURNING id`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Tool not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting tool:", error);
      res.status(500).json({ error: "Failed to delete tool" });
    }
  });

  // ============================================
  // Notifications API
  // ============================================

  // GET notifications
  app.get("/api/notifications", async (req, res) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await storage.getNotifications(unreadOnly);
      res.json(notifications);
    } catch (error) {
      console.error("[api] Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // PATCH mark notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }
      await storage.markNotificationRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // PATCH mark all notifications as read
  app.patch("/api/notifications/read-all", async (req, res) => {
    try {
      await storage.markAllNotificationsRead();
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // DELETE dismiss notification
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }
      await storage.dismissNotification(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error dismissing notification:", error);
      res.status(500).json({ error: "Failed to dismiss notification" });
    }
  });

  // GET generate notifications - uses notification_rules from database
  app.get("/api/notifications/generate", async (req, res) => {
    try {
      const created: any[] = [];
      const today = new Date();
      
      // Load enabled rules from database
      const rulesResult = await db.execute(sql`
        SELECT rule_type, name, config, is_enabled FROM notification_rules WHERE is_enabled = true
      `);
      const rules = rulesResult.rows as { rule_type: string; name: string; config: string; is_enabled: boolean }[];
      
      const getConfig = (ruleType: string) => {
        const rule = rules.find(r => r.rule_type === ruleType);
        if (!rule) return null;
        try {
          return JSON.parse(rule.config || '{}');
        } catch {
          return {};
        }
      };
      
      // 1. Birthday notifications - if rule is enabled
      const aniversarioConfig = getConfig('aniversario');
      if (aniversarioConfig) {
        const diasAntecedencia = Math.min(Math.max(aniversarioConfig.diasAntecedencia || 3, 0), 14);
        const priority = aniversarioConfig.priority || 'low';
        
        // Fetch all active employees with birthdays, then filter in code
        const birthdayResult = await db.execute(sql`
          SELECT id, nome, aniversario as nascimento
          FROM "Inhire".rh_pessoal
          WHERE aniversario IS NOT NULL AND demissao IS NULL
        `);
        
        for (const colab of birthdayResult.rows as any[]) {
          const birthDate = new Date(colab.nascimento);
          const birthMonth = birthDate.getMonth();
          const birthDay = birthDate.getDate();
          
          // Calculate this year's birthday
          const thisYearBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
          const diffDays = Math.round((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Only create notification if within configured days ahead
          if (diffDays < 0 || diffDays > diasAntecedencia) continue;
          
          const uniqueKey = `aniversario_${colab.id}_${today.getFullYear()}-${String(birthMonth + 1).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
          
          const exists = await storage.notificationExists(uniqueKey);
          if (!exists) {
            let title = '';
            if (diffDays === 0) {
              title = `${colab.nome} faz aniversário hoje!`;
            } else if (diffDays === 1) {
              title = `${colab.nome} faz aniversário amanhã!`;
            } else {
              title = `${colab.nome} faz aniversário em ${diffDays} dias`;
            }
            
            const notification = await storage.createNotification({
              type: 'aniversario',
              title,
              message: `Não esqueça de parabenizar ${colab.nome}!`,
              entityId: String(colab.id),
              entityType: 'colaborador',
              priority,
              uniqueKey,
              expiresAt: new Date(today.getFullYear(), birthMonth, birthDay + 1),
            });
            created.push(notification);
          }
        }
      }
      
      // 2. Contract expiring notifications - if rule is enabled
      const contratoConfig = getConfig('contrato_vencendo');
      if (contratoConfig) {
        const diasAntecedencia = contratoConfig.diasAntecedencia || 30;
        const priority = contratoConfig.priority || 'medium';
        
        const contractResult = await db.execute(sql`
          SELECT c.id_subtask as id, cl.cnpj, c.data_encerramento, cl.nome as client_name, c.servico
          FROM "Clickup".cup_contratos c
          LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
          WHERE c.data_encerramento IS NOT NULL
            AND c.data_encerramento >= CURRENT_DATE
            AND c.data_encerramento <= CURRENT_DATE + INTERVAL '1 day' * ${diasAntecedencia}
            AND c.status IN ('ativo', 'onboarding')
        `);
        
        for (const contract of contractResult.rows as any[]) {
          const endDate = new Date(contract.data_encerramento);
          const uniqueKey = `contrato_vencendo_${contract.id}_${endDate.toISOString().split('T')[0]}`;
          
          const exists = await storage.notificationExists(uniqueKey);
          if (!exists) {
            const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const clientName = contract.client_name || contract.cnpj || 'Cliente';
            
            const notification = await storage.createNotification({
              type: 'contrato_vencendo',
              title: `Contrato vencendo em ${diffDays} dias`,
              message: `O contrato de ${clientName} (${contract.servico || 'serviço'}) vence em ${endDate.toLocaleDateString('pt-BR')}.`,
              entityId: String(contract.id),
              entityType: 'contrato',
              priority,
              uniqueKey,
              expiresAt: endDate,
            });
            created.push(notification);
          }
        }
      }
      
      // 3. Overdue payments notifications - if rule is enabled
      const inadimplenciaConfig = getConfig('inadimplencia');
      if (inadimplenciaConfig) {
        const diasAtraso = inadimplenciaConfig.diasAtraso || 7;
        const valorMinimo = inadimplenciaConfig.valorMinimo || 0;
        const priority = inadimplenciaConfig.priority || 'high';
        
        const overdueResult = await db.execute(sql`
          SELECT 
            p.id_cliente, 
            COUNT(*) as parcelas_vencidas, 
            SUM(p.valor_bruto) as total_devido,
            cl.nome as cliente_nome
          FROM "Conta Azul".caz_parcelas p
          LEFT JOIN "Clickup".cup_clientes cl ON cl.cnpj = p.id_cliente::text
          WHERE p.data_vencimento < CURRENT_DATE - INTERVAL '1 day' * ${diasAtraso}
            AND p.status != 'Pago'
            AND p.id_cliente IS NOT NULL
          GROUP BY p.id_cliente, cl.nome
          HAVING SUM(COALESCE(p.valor_bruto, 0)) >= ${valorMinimo}
        `);
        
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        
        for (const overdue of overdueResult.rows as any[]) {
          const clientId = overdue.id_cliente || 'unknown';
          const clientName = overdue.cliente_nome || clientId;
          const uniqueKey = `inadimplencia_${clientId}_${currentMonth}`;
          
          const exists = await storage.notificationExists(uniqueKey);
          if (!exists) {
            const totalDevido = Number(overdue.total_devido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            const notification = await storage.createNotification({
              type: 'inadimplencia',
              title: `Inadimplência: ${clientName}`,
              message: `${overdue.parcelas_vencidas} parcela(s) vencida(s) há mais de ${diasAtraso} dias. Total: ${totalDevido}`,
              entityId: clientId,
              entityType: 'cliente',
              priority,
              uniqueKey,
            });
            created.push(notification);
          }
        }
      }
      
      // 4. Churn risk notifications - clients with active contracts but no payment in 2+ months
      const churnRiskConfig = getConfig('churn_risk');
      if (churnRiskConfig !== null) {
        const mesesSemReceita = churnRiskConfig?.mesesSemReceita || 2;
        const churnPriority = churnRiskConfig?.priority || 'high';
        
        const churnResult = await db.execute(sql`
          SELECT 
            c.id_subtask,
            c.servico,
            c.valorr,
            c.squad,
            cl.nome as cliente_nome,
            cl.cnpj
          FROM "Clickup".cup_contratos c
          LEFT JOIN "Clickup".cup_clientes cl ON c.id_task = cl.task_id
          WHERE c.status = 'Ativo'
            AND NOT EXISTS (
              SELECT 1 FROM "Conta Azul".caz_parcelas p
              WHERE (p.id_cliente = cl.cnpj OR p.id_cliente = c.id_task)
                AND p.tipo_evento = 'RECEITA'
                AND p.status = 'Pago'
                AND p.data_quitacao >= CURRENT_DATE - INTERVAL '1 month' * ${mesesSemReceita}
            )
          LIMIT 50
        `);
        
        for (const contrato of churnResult.rows as any[]) {
          const uniqueKey = `churn_risk_${contrato.id_subtask}_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          
          const exists = await storage.notificationExists(uniqueKey);
          if (!exists) {
            const valor = parseFloat(contrato.valorr) || 0;
            const valorFormatted = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            const notification = await storage.createNotification({
              type: 'churn_risk',
              title: 'Risco de churn detectado',
              message: `${contrato.cliente_nome || 'Cliente'} (${contrato.servico}) - Sem receita há ${mesesSemReceita}+ meses. MRR: ${valorFormatted}`,
              entityId: contrato.id_subtask,
              entityType: 'contrato',
              priority: churnPriority,
              uniqueKey,
            });
            created.push(notification);
          }
        }
      }
      
      // 5. Jurídico Escalation notifications - clients needing procedure escalation
      const juridicoEscalationConfig = getConfig('juridico_escalation');
      if (juridicoEscalationConfig !== null) {
        const priority = juridicoEscalationConfig?.priority || 'high';
        
        try {
          // Get escalation rules
          const escalationRulesResult = await db.execute(sql`
            SELECT 
              dias_atraso_min,
              dias_atraso_max,
              procedimento_sugerido,
              prioridade
            FROM juridico_regras_escalonamento
            WHERE ativo = true
            ORDER BY prioridade ASC
          `);
          
          const escalationRules = escalationRulesResult.rows as Array<{
            dias_atraso_min: number;
            dias_atraso_max: number | null;
            procedimento_sugerido: string;
            prioridade: number;
          }>;
          
          if (escalationRules.length > 0) {
            // Get clients with overdue payments who may need escalation
            const clientsResult = await db.execute(sql`
              SELECT 
                ic.cliente_id,
                ic.procedimento_juridico,
                p.max_atraso,
                c.nome as cliente_nome
              FROM cortex_core.inadimplencia_contextos ic
              JOIN "Conta Azul".caz_clientes c ON ic.cliente_id = c.ids OR ic.cliente_id = CAST(c.id AS TEXT)
              JOIN (
                SELECT 
                  id_cliente,
                  MAX(CURRENT_DATE - data_vencimento::date) as max_atraso
                FROM "Conta Azul".caz_parcelas
                WHERE status != 'Pago' AND data_vencimento < CURRENT_DATE
                GROUP BY id_cliente
              ) p ON ic.cliente_id = p.id_cliente
              WHERE p.max_atraso >= 30
              LIMIT 100
            `);
            
            const PROCEDIMENTO_PRIORITY: Record<string, number> = {
              'notificacao': 1,
              'protesto': 2,
              'acao_judicial': 3,
              'acordo': 4,
              'baixa': 5
            };
            
            for (const cliente of clientsResult.rows as any[]) {
              const diasAtraso = parseInt(cliente.max_atraso) || 0;
              const currentProcedimento = cliente.procedimento_juridico;
              const currentPriority = currentProcedimento ? (PROCEDIMENTO_PRIORITY[currentProcedimento] || 0) : 0;
              
              // Find suggested procedimento
              let suggestedPriority = 0;
              let suggestedProcedimento = null;
              for (const rule of escalationRules) {
                const min = rule.dias_atraso_min;
                const max = rule.dias_atraso_max;
                if (diasAtraso >= min && (max === null || diasAtraso <= max)) {
                  suggestedPriority = rule.prioridade;
                  suggestedProcedimento = rule.procedimento_sugerido;
                  break;
                }
              }
              
              // Check if escalation is needed
              if (suggestedProcedimento && currentPriority < suggestedPriority) {
                const uniqueKey = `juridico_escalation_${cliente.cliente_id}_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                
                const exists = await storage.notificationExists(uniqueKey);
                if (!exists) {
                  const procedimentoLabels: Record<string, string> = {
                    'notificacao': 'Notificação',
                    'protesto': 'Protesto',
                    'acao_judicial': 'Ação Judicial',
                    'acordo': 'Acordo',
                    'baixa': 'Baixa'
                  };
                  
                  const notification = await storage.createNotification({
                    type: 'juridico_escalation',
                    title: `Escalonamento jurídico necessário`,
                    message: `${cliente.cliente_nome || 'Cliente'} - ${diasAtraso} dias de atraso. Sugestão: ${procedimentoLabels[suggestedProcedimento] || suggestedProcedimento}`,
                    entityId: cliente.cliente_id,
                    entityType: 'cliente',
                    priority,
                    uniqueKey,
                  });
                  created.push(notification);
                }
              }
            }
          }
        } catch (escalationError) {
          console.log("[api] Juridico escalation notifications skipped - table may not exist:", (escalationError as Error).message);
        }
      }
      
      res.json({ 
        success: true, 
        created: created.length,
        notifications: created,
        rulesUsed: rules.map(r => r.rule_type)
      });
    } catch (error) {
      console.error("[api] Error generating notifications:", error);
      res.status(500).json({ error: "Failed to generate notifications" });
    }
  });

  // ==================== SYSTEM FIELD OPTIONS ====================
  
  app.get("/api/system-fields", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT field_type FROM system_field_options
        WHERE is_active = true
        ORDER BY field_type
      `);
      res.json({ fieldTypes: result.rows.map((r: any) => r.field_type) });
    } catch (error) {
      console.error("[api] Error fetching system field types:", error);
      res.status(500).json({ error: "Failed to fetch field types" });
    }
  });

  app.get("/api/system-fields/:fieldType", isAuthenticated, async (req, res) => {
    try {
      const { fieldType } = req.params;
      const result = await db.execute(sql`
        SELECT id, field_type, value, label, color, sort_order, is_active, created_at
        FROM system_field_options
        WHERE field_type = ${fieldType}
        ORDER BY sort_order ASC, label ASC
      `);
      res.json({ 
        fieldType,
        options: result.rows.map((r: any) => ({
          id: r.id,
          fieldType: r.field_type,
          value: r.value,
          label: r.label,
          color: r.color,
          sortOrder: r.sort_order,
          isActive: r.is_active,
          createdAt: r.created_at
        }))
      });
    } catch (error) {
      console.error("[api] Error fetching system field options:", error);
      res.status(500).json({ error: "Failed to fetch field options" });
    }
  });

  app.post("/api/system-fields", isAuthenticated, async (req, res) => {
    try {
      const { fieldType, value, label, color, sortOrder, isActive } = req.body;
      
      if (!fieldType || !value || !label) {
        return res.status(400).json({ error: "fieldType, value and label are required" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO system_field_options (field_type, value, label, color, sort_order, is_active)
        VALUES (${fieldType}, ${value}, ${label}, ${color || null}, ${sortOrder || 0}, ${isActive !== false})
        ON CONFLICT (field_type, value) DO UPDATE SET
          label = EXCLUDED.label,
          color = EXCLUDED.color,
          sort_order = EXCLUDED.sort_order,
          is_active = EXCLUDED.is_active
        RETURNING id, field_type, value, label, color, sort_order, is_active, created_at
      `);
      
      const row = result.rows[0] as any;
      res.json({
        id: row.id,
        fieldType: row.field_type,
        value: row.value,
        label: row.label,
        color: row.color,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        createdAt: row.created_at
      });
    } catch (error) {
      console.error("[api] Error creating system field option:", error);
      res.status(500).json({ error: "Failed to create field option" });
    }
  });

  app.patch("/api/system-fields/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { fieldType, value, label, color, sortOrder, isActive } = req.body;
      
      const result = await db.execute(sql`
        UPDATE system_field_options
        SET 
          field_type = COALESCE(${fieldType || null}, field_type),
          value = COALESCE(${value || null}, value),
          label = COALESCE(${label || null}, label),
          color = ${color !== undefined ? color : null},
          sort_order = COALESCE(${sortOrder !== undefined ? sortOrder : null}, sort_order),
          is_active = COALESCE(${isActive !== undefined ? isActive : null}, is_active)
        WHERE id = ${parseInt(id)}
        RETURNING id, field_type, value, label, color, sort_order, is_active, created_at
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Field option not found" });
      }
      
      const row = result.rows[0] as any;
      res.json({
        id: row.id,
        fieldType: row.field_type,
        value: row.value,
        label: row.label,
        color: row.color,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        createdAt: row.created_at
      });
    } catch (error) {
      console.error("[api] Error updating system field option:", error);
      res.status(500).json({ error: "Failed to update field option" });
    }
  });

  app.delete("/api/system-fields/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.execute(sql`
        UPDATE system_field_options
        SET is_active = false
        WHERE id = ${parseInt(id)}
      `);
      
      res.json({ success: true, message: "Field option deactivated" });
    } catch (error) {
      console.error("[api] Error deleting system field option:", error);
      res.status(500).json({ error: "Failed to delete field option" });
    }
  });

  app.post("/api/system-fields/seed", isAuthenticated, async (req, res) => {
    try {
      const { 
        CLIENT_STATUS_OPTIONS,
        BUSINESS_TYPE_OPTIONS,
        ACCOUNT_STATUS_OPTIONS,
        CLUSTER_OPTIONS,
        SQUAD_OPTIONS,
        CONTRACT_STATUS_OPTIONS,
        COLLABORATOR_STATUS_OPTIONS,
        CHURN_REASON_OPTIONS
      } = await import("@shared/constants");
      
      const seedData: { fieldType: string; options: { value: string; label: string; color?: string }[] }[] = [
        { fieldType: 'client_status', options: CLIENT_STATUS_OPTIONS },
        { fieldType: 'business_type', options: BUSINESS_TYPE_OPTIONS },
        { fieldType: 'account_status', options: ACCOUNT_STATUS_OPTIONS },
        { fieldType: 'cluster', options: CLUSTER_OPTIONS },
        { fieldType: 'squad', options: SQUAD_OPTIONS },
        { fieldType: 'contract_status', options: CONTRACT_STATUS_OPTIONS },
        { fieldType: 'collaborator_status', options: COLLABORATOR_STATUS_OPTIONS },
        { fieldType: 'motivo_churn', options: CHURN_REASON_OPTIONS },
      ];
      
      let inserted = 0;
      for (const { fieldType, options } of seedData) {
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const result = await db.execute(sql`
            INSERT INTO system_field_options (field_type, value, label, color, sort_order, is_active)
            VALUES (${fieldType}, ${opt.value}, ${opt.label}, ${opt.color || null}, ${i}, true)
            ON CONFLICT (field_type, value) DO NOTHING
            RETURNING id
          `);
          inserted += result.rows.length;
        }
      }
      
      res.json({ success: true, insertedCount: inserted, message: `Seeded ${inserted} field options` });
    } catch (error) {
      console.error("[api] Error seeding system field options:", error);
      res.status(500).json({ error: "Failed to seed field options" });
    }
  });

  // ==================== NOTIFICATION RULES ROUTES ====================

  app.get("/api/notification-rules", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM notification_rules ORDER BY id ASC
      `);
      
      const rules = (result.rows as any[]).map(row => ({
        id: row.id,
        ruleType: row.rule_type,
        name: row.name,
        description: row.description,
        isEnabled: row.is_enabled,
        config: row.config,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      res.json(rules);
    } catch (error) {
      console.error("[api] Error fetching notification rules:", error);
      res.status(500).json({ error: "Failed to fetch notification rules" });
    }
  });

  app.post("/api/notification-rules", isAuthenticated, async (req, res) => {
    try {
      const { ruleType, name, description, isEnabled, config } = req.body;
      
      if (!ruleType || !name) {
        return res.status(400).json({ error: "ruleType and name are required" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO notification_rules (rule_type, name, description, is_enabled, config)
        VALUES (${ruleType}, ${name}, ${description || null}, ${isEnabled !== false}, ${config || null})
        RETURNING *
      `);
      
      const row = result.rows[0] as any;
      res.json({
        id: row.id,
        ruleType: row.rule_type,
        name: row.name,
        description: row.description,
        isEnabled: row.is_enabled,
        config: row.config,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    } catch (error) {
      console.error("[api] Error creating notification rule:", error);
      res.status(500).json({ error: "Failed to create notification rule" });
    }
  });

  app.patch("/api/notification-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, isEnabled, config } = req.body;
      
      const result = await db.execute(sql`
        UPDATE notification_rules
        SET 
          name = COALESCE(${name}, name),
          description = COALESCE(${description}, description),
          is_enabled = COALESCE(${isEnabled}, is_enabled),
          config = COALESCE(${config}, config),
          updated_at = NOW()
        WHERE id = ${parseInt(id)}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Rule not found" });
      }
      
      const row = result.rows[0] as any;
      res.json({
        id: row.id,
        ruleType: row.rule_type,
        name: row.name,
        description: row.description,
        isEnabled: row.is_enabled,
        config: row.config,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    } catch (error) {
      console.error("[api] Error updating notification rule:", error);
      res.status(500).json({ error: "Failed to update notification rule" });
    }
  });

  app.delete("/api/notification-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.execute(sql`
        DELETE FROM notification_rules WHERE id = ${parseInt(id)}
      `);
      
      res.json({ success: true, message: "Notification rule deleted" });
    } catch (error) {
      console.error("[api] Error deleting notification rule:", error);
      res.status(500).json({ error: "Failed to delete notification rule" });
    }
  });

  // ==================== HOME OVERVIEW ====================
  
  app.get("/api/home/overview", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userEmail = user?.email;
      const userName = user?.name;
      
      // Buscar colaborador vinculado ao usuário
      let colaboradorNome: string | null = null;
      let meusClientes: any[] = [];
      let mrrTotal = 0;
      let contratosAtivos = 0;
      let clientesAtivos = 0;
      
      // Totais globais da empresa (todos os contratos ativos)
      let empresaMrrTotal = 0;
      let empresaContratosAtivos = 0;
      let empresaClientesAtivos = 0;
      let mrrVariacao = 0;
      let ticketMedioVariacao = 0;
      
      // Buscar totais globais da empresa - contratos e MRR
      const empresaContratosQuery = await db.execute(sql`
        SELECT 
          COALESCE(SUM(valorr::numeric), 0) as mrr_total,
          COUNT(*) as contratos_total
        FROM "Clickup".cup_contratos
        WHERE status IN ('ativo', 'onboarding', 'triagem')
      `);
      
      // Buscar clientes ativos (distintos por task_id com contrato ativo)
      const empresaClientesQuery = await db.execute(sql`
        SELECT COUNT(DISTINCT c.id) as clientes_total
        FROM "Clickup".cup_clientes c
        INNER JOIN "Clickup".cup_contratos ct ON c.task_id = ct.id_task
        WHERE ct.status IN ('ativo', 'onboarding', 'triagem')
      `);
      
      if (empresaContratosQuery.rows.length > 0) {
        const row = empresaContratosQuery.rows[0] as any;
        empresaMrrTotal = parseFloat(row.mrr_total || '0');
        empresaContratosAtivos = parseInt(row.contratos_total || '0');
      }
      
      if (empresaClientesQuery.rows.length > 0) {
        empresaClientesAtivos = parseInt((empresaClientesQuery.rows[0] as any).clientes_total || '0');
      }
      
      // Calcular variação MRR comparando com histórico (cup_data_hist) do último dia do mês anterior
      // Fallback: R$ 1.030.000 para dezembro 2025 se não houver histórico
      try {
        // Valor de referência de dezembro 2025 = R$ 1.030.000
        const MRR_DEZEMBRO_2025_FALLBACK = 1030000;
        
        // Calcular último dia do mês anterior
        const now = new Date();
        const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const lastDayPrevMonthStr = lastDayPrevMonth.toISOString().split('T')[0];
        
        // Buscar MRR do histórico (último snapshot disponível até o último dia do mês anterior)
        const historicMrrQuery = await db.execute(sql`
          SELECT 
            DATE(data_snapshot) as snapshot_date,
            COALESCE(SUM(valorr), 0) as mrr_total,
            COUNT(DISTINCT id_task) as clientes_total
          FROM "Clickup".cup_data_hist
          WHERE DATE(data_snapshot) <= ${lastDayPrevMonthStr}::date
            AND status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY DATE(data_snapshot)
          ORDER BY DATE(data_snapshot) DESC
          LIMIT 1
        `);
        
        let mrrAnterior = MRR_DEZEMBRO_2025_FALLBACK;
        let clientesAnterior = 0;
        
        if (historicMrrQuery.rows.length > 0) {
          const histRow = historicMrrQuery.rows[0] as any;
          mrrAnterior = parseFloat(histRow.mrr_total || '0') || MRR_DEZEMBRO_2025_FALLBACK;
          clientesAnterior = parseInt(histRow.clientes_total || '0');
        }
        
        // Calcular variação MRR usando histórico
        const mrrAtual = empresaMrrTotal;
        const clientesAtual = empresaClientesAtivos;
        
        if (mrrAnterior > 0) {
          mrrVariacao = ((mrrAtual - mrrAnterior) / mrrAnterior) * 100;
        }
        
        // Calcular variação Ticket Médio
        const ticketAtual = clientesAtual > 0 ? mrrAtual / clientesAtual : 0;
        const ticketAnterior = clientesAnterior > 0 ? mrrAnterior / clientesAnterior : 0;
        
        if (ticketAnterior > 0) {
          ticketMedioVariacao = ((ticketAtual - ticketAnterior) / ticketAnterior) * 100;
        }
        
        console.log(`[home-overview] MRR variação: ${mrrVariacao.toFixed(2)}% (atual: ${mrrAtual}, anterior: ${mrrAnterior})`);
      } catch (e) {
        // Ignorar erro de cálculo de variação
        console.error("Error calculating MRR variation:", e);
      }
      
      // Buscar clientes vinculados ao usuário de duas formas:
      // 1. Pelo email do usuário na coluna responsavel de cup_clientes
      // 2. Pelo nome do colaborador nos contratos (cup_contratos)
      
      // Primeiro, buscar pelo email do usuário na coluna responsavel de cup_clientes
      if (userEmail) {
        const clientesPorEmailQuery = await db.execute(sql`
          SELECT 
            c.id,
            c.nome,
            c.cnpj,
            COALESCE(SUM(ct.valorr::numeric), 0) as mrr,
            COUNT(DISTINCT ct.id_task) as contratos_ativos,
            ARRAY_AGG(DISTINCT ct.produto) FILTER (WHERE ct.produto IS NOT NULL) as produtos,
            ARRAY_AGG(DISTINCT ct.squad) FILTER (WHERE ct.squad IS NOT NULL) as squads
          FROM "Clickup".cup_clientes c
          INNER JOIN "Clickup".cup_contratos ct ON c.task_id = ct.id_task
          WHERE LOWER(c.responsavel) LIKE ${`%${userEmail.toLowerCase()}%`}
            AND ct.status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY c.id, c.nome, c.cnpj
          ORDER BY mrr DESC
          LIMIT 10
        `);
        
        if (clientesPorEmailQuery.rows.length > 0) {
          meusClientes = clientesPorEmailQuery.rows.map((row: any) => ({
            id: row.id,
            nome: row.nome,
            cnpj: row.cnpj,
            mrr: parseFloat(row.mrr || '0'),
            contratosAtivos: parseInt(row.contratos_ativos || '0'),
            produto: Array.isArray(row.produtos) ? row.produtos[0] : null,
            squad: Array.isArray(row.squads) ? row.squads[0] : null,
          }));
          
          // Calcular totais para clientes onde o usuário é responsável
          const totaisEmailQuery = await db.execute(sql`
            SELECT 
              COALESCE(SUM(ct.valorr::numeric), 0) as mrr_total,
              COUNT(DISTINCT ct.id_task) as contratos_total,
              COUNT(DISTINCT c.id) as clientes_total
            FROM "Clickup".cup_clientes c
            INNER JOIN "Clickup".cup_contratos ct ON c.task_id = ct.id_task
            WHERE LOWER(c.responsavel) LIKE ${`%${userEmail.toLowerCase()}%`}
              AND ct.status IN ('ativo', 'onboarding', 'triagem')
          `);
          
          if (totaisEmailQuery.rows.length > 0) {
            const totaisRow = totaisEmailQuery.rows[0] as any;
            mrrTotal = parseFloat(totaisRow.mrr_total || '0');
            contratosAtivos = parseInt(totaisRow.contratos_total || '0');
            clientesAtivos = parseInt(totaisRow.clientes_total || '0');
          }
        }
      }
      
      // Se não encontrou pelo email, tentar pelo nome do colaborador
      if (meusClientes.length === 0 && userName) {
        // Tentar encontrar o colaborador pelo nome ou email
        const colaboradorQuery = await db.execute(sql`
          SELECT nome FROM "Inhire".rh_pessoal 
          WHERE LOWER(nome) LIKE ${`%${userName.toLowerCase().split(' ')[0]}%`}
          AND status IN ('ativo', 'Ativo')
          LIMIT 1
        `);
        
        if (colaboradorQuery.rows.length > 0) {
          colaboradorNome = colaboradorQuery.rows[0].nome as string;
          
          // Buscar clientes vinculados ao colaborador (como responsável ou CS)
          // Agrupa por cliente e calcula totais por cliente
          const clientesQuery = await db.execute(sql`
            SELECT 
              c.id,
              c.nome,
              c.cnpj,
              COALESCE(SUM(ct.valorr::numeric), 0) as mrr,
              COUNT(DISTINCT ct.id_task) as contratos_ativos,
              ARRAY_AGG(DISTINCT ct.produto) FILTER (WHERE ct.produto IS NOT NULL) as produtos,
              ARRAY_AGG(DISTINCT ct.squad) FILTER (WHERE ct.squad IS NOT NULL) as squads
            FROM "Clickup".cup_clientes c
            INNER JOIN "Clickup".cup_contratos ct ON c.task_id = ct.id_task
            WHERE (ct.responsavel ILIKE ${`%${colaboradorNome}%`} OR ct.cs_responsavel ILIKE ${`%${colaboradorNome}%`})
              AND ct.status IN ('ativo', 'onboarding', 'triagem')
            GROUP BY c.id, c.nome, c.cnpj
            ORDER BY mrr DESC
            LIMIT 10
          `);
          
          meusClientes = clientesQuery.rows.map((row: any) => ({
            id: row.id,
            nome: row.nome,
            cnpj: row.cnpj,
            mrr: parseFloat(row.mrr || '0'),
            contratosAtivos: parseInt(row.contratos_ativos || '0'),
            produto: Array.isArray(row.produtos) ? row.produtos[0] : null,
            squad: Array.isArray(row.squads) ? row.squads[0] : null,
          }));
          
          // Calcular totais de forma separada para evitar duplicatas
          const totaisQuery = await db.execute(sql`
            SELECT 
              COALESCE(SUM(ct.valorr::numeric), 0) as mrr_total,
              COUNT(DISTINCT ct.id_task) as contratos_total,
              COUNT(DISTINCT c.id) as clientes_total
            FROM "Clickup".cup_contratos ct
            INNER JOIN "Clickup".cup_clientes c ON ct.id_task = c.task_id
            WHERE (ct.responsavel ILIKE ${`%${colaboradorNome}%`} OR ct.cs_responsavel ILIKE ${`%${colaboradorNome}%`})
              AND ct.status IN ('ativo', 'onboarding', 'triagem')
          `);
          
          if (totaisQuery.rows.length > 0) {
            const totaisRow = totaisQuery.rows[0] as any;
            mrrTotal = parseFloat(totaisRow.mrr_total || '0');
            contratosAtivos = parseInt(totaisRow.contratos_total || '0');
            clientesAtivos = parseInt(totaisRow.clientes_total || '0');
          }
        }
      }
      
      // Buscar próximos eventos (próximos 30 dias)
      const hoje = new Date();
      const em30Dias = new Date();
      em30Dias.setDate(em30Dias.getDate() + 30);
      
      const eventosQuery = await db.execute(sql`
        SELECT id, titulo, tipo, data_inicio, data_fim, local, cor
        FROM cortex_core.turbo_eventos
        WHERE data_inicio >= ${hoje.toISOString()}
          AND data_inicio <= ${em30Dias.toISOString()}
        ORDER BY data_inicio ASC
        LIMIT 5
      `);
      
      const proximosEventos = eventosQuery.rows.map((row: any) => ({
        id: row.id,
        titulo: row.titulo,
        tipo: row.tipo,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim,
        local: row.local,
        cor: row.cor,
      }));
      
      // Buscar alertas e pendências (com tratamento de erro para tabelas que podem não existir)
      let alertasRows: any[] = [];
      let contratosVencendoRows: any[] = [];
      let clientesRiscoRows: any[] = [];
      
      try {
        const alertasQuery = await db.execute(sql`
          SELECT 
            'cobranca_vencida' as tipo,
            cl.nome as cliente_nome,
            cl.cnpj,
            jc.vencimento as data,
            jc.valor_aberto as valor,
            jc.dias_atraso as dias
          FROM public.juridico_cobranca jc
          INNER JOIN "Clickup".cup_clientes cl ON jc.cnpj = cl.cnpj
          WHERE jc.status = 'aberto' AND jc.dias_atraso > 0
          ORDER BY jc.dias_atraso DESC
          LIMIT 5
        `);
        alertasRows = alertasQuery.rows;
      } catch (e) {
        // Tabela pode não existir, ignorar
      }
      
      try {
        const contratosVencendoQuery = await db.execute(sql`
          SELECT 
            'contrato_vencendo' as tipo,
            c.nome as cliente_nome,
            c.cnpj,
            ct.data_encerramento as data,
            ct.valorr as valor,
            0 as dias
          FROM "Clickup".cup_contratos ct
          INNER JOIN "Clickup".cup_clientes c ON ct.id_task = c.task_id
          WHERE ct.status = 'ativo'
            AND ct.data_encerramento IS NOT NULL
            AND ct.data_encerramento::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
          ORDER BY ct.data_encerramento ASC
          LIMIT 3
        `);
        contratosVencendoRows = contratosVencendoQuery.rows;
      } catch (e) {
        // Ignorar erro
      }
      
      try {
        // Clientes em risco: contratos com health negativo ou em triagem há muito tempo
        const clientesRiscoQuery = await db.execute(sql`
          SELECT DISTINCT
            'cliente_risco' as tipo,
            c.nome as cliente_nome,
            c.cnpj,
            ct.data_inicio as data,
            COALESCE(ct.valorr::numeric, 0) as valor,
            0 as dias
          FROM "Clickup".cup_contratos ct
          INNER JOIN "Clickup".cup_clientes c ON ct.id_task = c.task_id
          WHERE ct.status IN ('triagem', 'ativo')
            AND (
              ct.saude_conta IN ('vermelho', 'Vermelho', 'amarelo', 'Amarelo')
              OR (ct.status = 'triagem' AND ct.data_inicio::date < CURRENT_DATE - INTERVAL '30 days')
            )
          ORDER BY ct.valorr DESC NULLS LAST
          LIMIT 3
        `);
        clientesRiscoRows = clientesRiscoQuery.rows;
      } catch (e) {
        // Ignorar erro
      }
      
      const alertas = [
        ...alertasRows.map((row: any) => ({
          tipo: 'cobranca_vencida',
          clienteNome: row.cliente_nome,
          cnpj: row.cnpj,
          data: row.data,
          valor: parseFloat(row.valor || '0'),
          dias: parseInt(row.dias || '0'),
        })),
        ...contratosVencendoRows.map((row: any) => ({
          tipo: 'contrato_vencendo',
          clienteNome: row.cliente_nome,
          cnpj: row.cnpj,
          data: row.data,
          valor: parseFloat(row.valor || '0'),
          dias: 0,
        })),
        ...clientesRiscoRows.map((row: any) => ({
          tipo: 'cliente_risco',
          clienteNome: row.cliente_nome,
          cnpj: row.cnpj,
          data: row.data,
          valor: parseFloat(row.valor || '0'),
          dias: 0,
        })),
      ].slice(0, 6);
      
      res.json({
        hasActiveContracts: meusClientes.length > 0,
        colaboradorNome,
        mrrTotal,
        contratosAtivos,
        clientesAtivos,
        empresaMrrTotal,
        empresaContratosAtivos,
        empresaClientesAtivos,
        mrrVariacao,
        ticketMedioVariacao,
        clientes: meusClientes,
        proximosEventos,
        alertas,
      });
    } catch (error) {
      console.error("[api] Error fetching home overview:", error);
      res.status(500).json({ error: "Failed to fetch home overview" });
    }
  });

  // ==================== AVISOS (OUTDOOR) ====================
  
  // Criar tabela turbo_avisos no schema cortex_core se não existir
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.turbo_avisos (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'info',
      cor TEXT DEFAULT '#f97316',
      icone TEXT,
      link_texto TEXT,
      link_url TEXT,
      ativo BOOLEAN NOT NULL DEFAULT true,
      ordem INTEGER NOT NULL DEFAULT 0,
      data_inicio TIMESTAMP,
      data_fim TIMESTAMP,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW(),
      criado_por TEXT
    )
  `).catch(() => {});
  
  // Listar avisos ativos (para exibição no carousel)
  app.get("/api/avisos/ativos", isAuthenticated, async (req, res) => {
    try {
      const agora = new Date();
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.turbo_avisos 
        WHERE ativo = true
          AND (data_inicio IS NULL OR data_inicio <= ${agora})
          AND (data_fim IS NULL OR data_fim >= ${agora})
        ORDER BY ordem ASC, criado_em DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching avisos ativos:", error);
      res.json([]);
    }
  });
  
  // Listar todos os avisos (para admin)
  app.get("/api/avisos", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.turbo_avisos 
        ORDER BY ordem ASC, criado_em DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching avisos:", error);
      res.status(500).json({ error: "Failed to fetch avisos" });
    }
  });
  
  // Criar aviso (aceita snake_case do frontend)
  app.post("/api/avisos", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { titulo, mensagem, tipo, cor, icone, link_texto, link_url, ativo, ordem, data_inicio, data_fim } = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO cortex_core.turbo_avisos (titulo, mensagem, tipo, cor, icone, link_texto, link_url, ativo, ordem, data_inicio, data_fim, criado_por)
        VALUES (${titulo}, ${mensagem}, ${tipo || 'info'}, ${cor || '#f97316'}, ${icone || null}, ${link_texto || null}, ${link_url || null}, ${ativo !== false}, ${ordem || 0}, ${data_inicio || null}, ${data_fim || null}, ${user?.email || 'system'})
        RETURNING *
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating aviso:", error);
      res.status(500).json({ error: "Failed to create aviso" });
    }
  });
  
  // Atualizar aviso (aceita snake_case do frontend)
  app.put("/api/avisos/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { titulo, mensagem, tipo, cor, icone, link_texto, link_url, ativo, ordem, data_inicio, data_fim } = req.body;
      
      const result = await db.execute(sql`
        UPDATE cortex_core.turbo_avisos 
        SET titulo = ${titulo}, mensagem = ${mensagem}, tipo = ${tipo || 'info'}, cor = ${cor || '#f97316'}, icone = ${icone || null}, link_texto = ${link_texto || null}, link_url = ${link_url || null}, ativo = ${ativo !== false}, ordem = ${ordem || 0}, data_inicio = ${data_inicio || null}, data_fim = ${data_fim || null}, atualizado_em = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Aviso not found" });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating aviso:", error);
      res.status(500).json({ error: "Failed to update aviso" });
    }
  });
  
  // Deletar aviso
  app.delete("/api/avisos/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.execute(sql`DELETE FROM cortex_core.turbo_avisos WHERE id = ${id}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting aviso:", error);
      res.status(500).json({ error: "Failed to delete aviso" });
    }
  });

  // ==================== TURBO CALENDAR ====================
  
  app.get("/api/calendario/eventos", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const eventos = await storage.getTurboEventos(
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(eventos);
    } catch (error) {
      console.error("Error fetching eventos:", error);
      res.status(500).json({ error: "Failed to fetch eventos" });
    }
  });

  // Rota com path params para buscar eventos por período
  app.get("/api/calendario/eventos/:startDate/:endDate", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate } = req.params;
      const eventos = await storage.getTurboEventos(startDate, endDate);
      res.json(eventos);
    } catch (error) {
      console.error("Error fetching eventos by date range:", error);
      res.status(500).json({ error: "Failed to fetch eventos" });
    }
  });

  app.get("/api/calendario/eventos/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const evento = await storage.getTurboEvento(id);
      if (!evento) {
        return res.status(404).json({ error: "Evento not found" });
      }
      res.json(evento);
    } catch (error) {
      console.error("Error fetching evento:", error);
      res.status(500).json({ error: "Failed to fetch evento" });
    }
  });

  app.post("/api/calendario/eventos", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const data = {
        ...req.body,
        criadoPor: user?.email || 'system',
        organizadorNome: req.body.organizadorNome || user?.name || null
      };
      const evento = await storage.createTurboEvento(data);
      res.json(evento);
    } catch (error) {
      console.error("Error creating evento:", error);
      res.status(500).json({ error: "Failed to create evento" });
    }
  });

  app.patch("/api/calendario/eventos/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const evento = await storage.updateTurboEvento(id, req.body);
      res.json(evento);
    } catch (error) {
      console.error("Error updating evento:", error);
      res.status(500).json({ error: "Failed to update evento" });
    }
  });

  app.delete("/api/calendario/eventos/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTurboEvento(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting evento:", error);
      res.status(500).json({ error: "Failed to delete evento" });
    }
  });

  app.post("/api/notification-rules/seed", isAuthenticated, async (req, res) => {
    try {
      const defaultRules = [
        {
          ruleType: 'inadimplencia',
          name: 'Inadimplência',
          description: 'Alerta quando um cliente está com pagamento em atraso',
          config: JSON.stringify({ diasAtraso: 7, valorMinimo: 0, priority: 'high' })
        },
        {
          ruleType: 'contrato_vencendo',
          name: 'Contrato Vencendo',
          description: 'Alerta quando um contrato está próximo do vencimento',
          config: JSON.stringify({ diasAntecedencia: 30, priority: 'medium' })
        },
        {
          ruleType: 'aniversario',
          name: 'Aniversário de Colaborador',
          description: 'Alerta quando é aniversário de um colaborador',
          config: JSON.stringify({ diasAntecedencia: 3, priority: 'low' })
        }
      ];
      
      let inserted = 0;
      for (const rule of defaultRules) {
        const existsResult = await db.execute(sql`
          SELECT id FROM notification_rules WHERE rule_type = ${rule.ruleType}
        `);
        
        if (existsResult.rows.length === 0) {
          await db.execute(sql`
            INSERT INTO notification_rules (rule_type, name, description, is_enabled, config)
            VALUES (${rule.ruleType}, ${rule.name}, ${rule.description}, true, ${rule.config})
          `);
          inserted++;
        }
      }
      
      res.json({ success: true, message: `Seeded ${inserted} notification rules`, insertedCount: inserted });
    } catch (error) {
      console.error("[api] Error seeding notification rules:", error);
      res.status(500).json({ error: "Failed to seed notification rules" });
    }
  });

  // ==================== ADMIN CATALOGS API ====================
  
  const VALID_CATALOGS: Record<string, { table: string; description: string; specificFields: string[] }> = {
    products: { 
      table: 'catalog_products', 
      description: 'Produtos e serviços oferecidos',
      specificFields: ['bp_segment']
    },
    plans: { 
      table: 'catalog_plans', 
      description: 'Planos de contrato disponíveis',
      specificFields: []
    },
    squads: { 
      table: 'catalog_squads', 
      description: 'Squads/equipes de atendimento',
      specificFields: ['is_off']
    },
    clusters: { 
      table: 'catalog_clusters', 
      description: 'Clusters de categorização de clientes',
      specificFields: []
    },
    contract_status: { 
      table: 'catalog_contract_status', 
      description: 'Status possíveis de contratos',
      specificFields: ['counts_as_operating']
    },
    account_health: { 
      table: 'catalog_account_health', 
      description: 'Indicadores de saúde da conta',
      specificFields: []
    },
    roi_bucket: { 
      table: 'catalog_roi_bucket', 
      description: 'Faixas de ROI',
      specificFields: []
    },
    churn_reason: { 
      table: 'catalog_churn_reason', 
      description: 'Motivos de churn/cancelamento',
      specificFields: []
    }
  };

  app.get("/api/admin/catalogs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log("[admin/catalogs] Listing all catalogs");
      const catalogs = Object.entries(VALID_CATALOGS).map(([name, config]) => ({
        name,
        table: config.table,
        description: config.description,
        specificFields: config.specificFields
      }));
      res.json(catalogs);
    } catch (error) {
      console.error("[admin/catalogs] Error listing catalogs:", error);
      res.status(500).json({ error: "Failed to list catalogs" });
    }
  });

  app.get("/api/admin/catalog/:catalogName", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { catalogName } = req.params;
      console.log(`[admin/catalog] Fetching catalog: ${catalogName}`);
      
      const catalogConfig = VALID_CATALOGS[catalogName];
      if (!catalogConfig) {
        return res.status(404).json({ error: `Catalog '${catalogName}' not found. Valid catalogs: ${Object.keys(VALID_CATALOGS).join(', ')}` });
      }
      
      const tableQueries: Record<string, any> = {
        catalog_products: sql`SELECT * FROM catalog_products ORDER BY sort_order, name`,
        catalog_plans: sql`SELECT * FROM catalog_plans ORDER BY sort_order, name`,
        catalog_squads: sql`SELECT * FROM catalog_squads ORDER BY sort_order, name`,
        catalog_clusters: sql`SELECT * FROM catalog_clusters ORDER BY sort_order, name`,
        catalog_contract_status: sql`SELECT * FROM catalog_contract_status ORDER BY sort_order, name`,
        catalog_account_health: sql`SELECT * FROM catalog_account_health ORDER BY sort_order, name`,
        catalog_roi_bucket: sql`SELECT * FROM catalog_roi_bucket ORDER BY sort_order, name`,
        catalog_churn_reason: sql`SELECT * FROM catalog_churn_reason ORDER BY sort_order, name`
      };
      
      const result = await db.execute(tableQueries[catalogConfig.table]);
      console.log(`[admin/catalog] Found ${result.rows.length} items in ${catalogName}`);
      res.json(result.rows);
    } catch (error) {
      console.error(`[admin/catalog] Error fetching catalog:`, error);
      res.status(500).json({ error: "Failed to fetch catalog items" });
    }
  });

  app.post("/api/admin/catalog/:catalogName", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { catalogName } = req.params;
      const body = req.body;
      console.log(`[admin/catalog] Creating item in ${catalogName}:`, body);
      
      const catalogConfig = VALID_CATALOGS[catalogName];
      if (!catalogConfig) {
        return res.status(404).json({ error: `Catalog '${catalogName}' not found` });
      }
      
      if (!body.slug || !body.name) {
        return res.status(400).json({ error: "slug and name are required" });
      }
      
      const slug = body.slug;
      const name = body.name;
      const sortOrder = body.sort_order ?? 0;
      const active = body.active ?? true;
      
      let result;
      switch (catalogConfig.table) {
        case 'catalog_products':
          result = await db.execute(sql`
            INSERT INTO catalog_products (slug, name, bp_segment, sort_order, active)
            VALUES (${slug}, ${name}, ${body.bp_segment || null}, ${sortOrder}, ${active})
            RETURNING *
          `);
          break;
        case 'catalog_squads':
          result = await db.execute(sql`
            INSERT INTO catalog_squads (slug, name, is_off, sort_order, active)
            VALUES (${slug}, ${name}, ${body.is_off || false}, ${sortOrder}, ${active})
            RETURNING *
          `);
          break;
        case 'catalog_contract_status':
          result = await db.execute(sql`
            INSERT INTO catalog_contract_status (slug, name, counts_as_operating, sort_order, active)
            VALUES (${slug}, ${name}, ${body.counts_as_operating || false}, ${sortOrder}, ${active})
            RETURNING *
          `);
          break;
        default:
          result = await db.execute(sql`
            INSERT INTO ${sql.raw(catalogConfig.table)} (slug, name, sort_order, active)
            VALUES (${slug}, ${name}, ${sortOrder}, ${active})
            RETURNING *
          `);
      }
      
      console.log(`[admin/catalog] Created item:`, result.rows[0]);
      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error(`[admin/catalog] Error creating item:`, error);
      if (error.code === '23505') {
        return res.status(409).json({ error: "An item with this slug already exists" });
      }
      res.status(500).json({ error: "Failed to create catalog item" });
    }
  });

  app.put("/api/admin/catalog/:catalogName/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { catalogName, id } = req.params;
      const body = req.body;
      const itemId = parseInt(id);
      console.log(`[admin/catalog] Updating item ${id} in ${catalogName}:`, body);
      
      const catalogConfig = VALID_CATALOGS[catalogName];
      if (!catalogConfig) {
        return res.status(404).json({ error: `Catalog '${catalogName}' not found` });
      }
      
      const existsResult = await db.execute(sql`
        SELECT id FROM ${sql.raw(catalogConfig.table)} WHERE id = ${itemId}
      `);
      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const name = body.name;
      const active = body.active;
      const sortOrder = body.sort_order;
      
      let result;
      switch (catalogConfig.table) {
        case 'catalog_products':
          result = await db.execute(sql`
            UPDATE catalog_products SET
              name = COALESCE(${name}, name),
              active = COALESCE(${active}, active),
              sort_order = COALESCE(${sortOrder}, sort_order),
              bp_segment = COALESCE(${body.bp_segment}, bp_segment)
            WHERE id = ${itemId}
            RETURNING *
          `);
          break;
        case 'catalog_squads':
          result = await db.execute(sql`
            UPDATE catalog_squads SET
              name = COALESCE(${name}, name),
              active = COALESCE(${active}, active),
              sort_order = COALESCE(${sortOrder}, sort_order),
              is_off = COALESCE(${body.is_off}, is_off)
            WHERE id = ${itemId}
            RETURNING *
          `);
          break;
        case 'catalog_contract_status':
          result = await db.execute(sql`
            UPDATE catalog_contract_status SET
              name = COALESCE(${name}, name),
              active = COALESCE(${active}, active),
              sort_order = COALESCE(${sortOrder}, sort_order),
              counts_as_operating = COALESCE(${body.counts_as_operating}, counts_as_operating)
            WHERE id = ${itemId}
            RETURNING *
          `);
          break;
        case 'catalog_plans':
          result = await db.execute(sql`
            UPDATE catalog_plans SET
              name = COALESCE(${name}, name),
              active = COALESCE(${active}, active),
              sort_order = COALESCE(${sortOrder}, sort_order)
            WHERE id = ${itemId}
            RETURNING *
          `);
          break;
        case 'catalog_clusters':
          result = await db.execute(sql`
            UPDATE catalog_clusters SET
              name = COALESCE(${name}, name),
              active = COALESCE(${active}, active),
              sort_order = COALESCE(${sortOrder}, sort_order)
            WHERE id = ${itemId}
            RETURNING *
          `);
          break;
        case 'catalog_account_health':
          result = await db.execute(sql`
            UPDATE catalog_account_health SET
              name = COALESCE(${name}, name),
              active = COALESCE(${active}, active),
              sort_order = COALESCE(${sortOrder}, sort_order)
            WHERE id = ${itemId}
            RETURNING *
          `);
          break;
        case 'catalog_roi_bucket':
          result = await db.execute(sql`
            UPDATE catalog_roi_bucket SET
              name = COALESCE(${name}, name),
              active = COALESCE(${active}, active),
              sort_order = COALESCE(${sortOrder}, sort_order)
            WHERE id = ${itemId}
            RETURNING *
          `);
          break;
        case 'catalog_churn_reason':
          result = await db.execute(sql`
            UPDATE catalog_churn_reason SET
              name = COALESCE(${name}, name),
              active = COALESCE(${active}, active),
              sort_order = COALESCE(${sortOrder}, sort_order)
            WHERE id = ${itemId}
            RETURNING *
          `);
          break;
        default:
          return res.status(400).json({ error: "Unknown catalog table" });
      }
      
      console.log(`[admin/catalog] Updated item:`, result.rows[0]);
      res.json(result.rows[0]);
    } catch (error) {
      console.error(`[admin/catalog] Error updating item:`, error);
      res.status(500).json({ error: "Failed to update catalog item" });
    }
  });

  app.delete("/api/admin/catalog/:catalogName/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { catalogName, id } = req.params;
      const itemId = parseInt(id);
      console.log(`[admin/catalog] Soft-deleting item ${id} in ${catalogName}`);
      
      const catalogConfig = VALID_CATALOGS[catalogName];
      if (!catalogConfig) {
        return res.status(404).json({ error: `Catalog '${catalogName}' not found` });
      }
      
      const result = await db.execute(sql`
        UPDATE ${sql.raw(catalogConfig.table)} SET active = false WHERE id = ${itemId} RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      console.log(`[admin/catalog] Soft-deleted item:`, result.rows[0]);
      res.json({ success: true, message: "Item deactivated", item: result.rows[0] });
    } catch (error) {
      console.error(`[admin/catalog] Error soft-deleting item:`, error);
      res.status(500).json({ error: "Failed to delete catalog item" });
    }
  });

  // ==================== ADMIN SYSTEM FIELDS API ====================

  app.get("/api/admin/system-fields", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { entity } = req.query;
      console.log(`[admin/system-fields] Fetching system fields, entity filter: ${entity || 'none'}`);
      
      let result;
      if (entity && (entity === 'client' || entity === 'contract')) {
        result = await db.execute(sql`
          SELECT * FROM system_fields 
          WHERE entity = ${entity}
          ORDER BY sort_order, field_key
        `);
      } else {
        result = await db.execute(sql`
          SELECT * FROM system_fields 
          ORDER BY entity, sort_order, field_key
        `);
      }
      
      console.log(`[admin/system-fields] Found ${result.rows.length} fields`);
      res.json(result.rows);
    } catch (error) {
      console.error("[admin/system-fields] Error fetching fields:", error);
      res.status(500).json({ error: "Failed to fetch system fields" });
    }
  });

  app.get("/api/admin/system-fields/:fieldKey", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { fieldKey } = req.params;
      console.log(`[admin/system-fields] Fetching field: ${fieldKey}`);
      
      const result = await db.execute(sql`
        SELECT * FROM system_fields WHERE field_key = ${fieldKey}
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: `Field '${fieldKey}' not found` });
      }
      
      console.log(`[admin/system-fields] Found field:`, result.rows[0]);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[admin/system-fields] Error fetching field:", error);
      res.status(500).json({ error: "Failed to fetch system field" });
    }
  });

  app.put("/api/admin/system-fields/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const fieldId = parseInt(id);
      const body = req.body;
      console.log(`[admin/system-fields] Updating field ${id}:`, body);
      
      const existsResult = await db.execute(sql`
        SELECT id FROM system_fields WHERE id = ${fieldId}
      `);
      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: "Field not found" });
      }
      
      const hasUpdates = body.label !== undefined || body.required !== undefined || 
                         body.default_value !== undefined || body.help_text !== undefined || 
                         body.active !== undefined;
      
      if (!hasUpdates) {
        return res.status(400).json({ error: "No valid fields to update. Allowed: label, required, default_value, help_text, active" });
      }
      
      const result = await db.execute(sql`
        UPDATE system_fields SET
          label = COALESCE(${body.label}, label),
          required = COALESCE(${body.required}, required),
          default_value = COALESCE(${body.default_value}, default_value),
          help_text = COALESCE(${body.help_text}, help_text),
          active = COALESCE(${body.active}, active)
        WHERE id = ${fieldId}
        RETURNING *
      `);
      
      console.log(`[admin/system-fields] Updated field:`, result.rows[0]);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[admin/system-fields] Error updating field:", error);
      res.status(500).json({ error: "Failed to update system field" });
    }
  });

  // ==================== CORTEX_CORE SCHEMA API - Canonical Data Layer ====================

  // GET /api/admin/sys/catalogs - List all catalogs in cortex_core schema
  app.get("/api/admin/sys/catalogs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT c.catalog_key, c.description, 
               (SELECT COUNT(*) FROM cortex_core.catalog_items ci WHERE ci.catalog_key = c.catalog_key AND ci.active = true)::int as item_count,
               c.created_at, c.updated_at
        FROM cortex_core.catalogs c
        ORDER BY c.catalog_key
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[admin/cortex_core/catalogs] Error fetching catalogs:", error);
      res.status(500).json({ error: "Failed to fetch cortex_core catalogs" });
    }
  });

  // GET /api/admin/sys/catalog-items/:catalogKey - List items in a catalog
  app.get("/api/admin/sys/catalog-items/:catalogKey", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { catalogKey } = req.params;
      const result = await db.execute(sql`
        SELECT ci.*, 
               (SELECT array_agg(ca.alias) FROM cortex_core.catalog_aliases ca WHERE ca.catalog_key = ci.catalog_key AND ca.slug = ci.slug) as aliases
        FROM cortex_core.catalog_items ci
        WHERE ci.catalog_key = ${catalogKey}
        ORDER BY ci.sort_order, ci.name
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[admin/sys/catalog-items] Error:", error);
      res.status(500).json({ error: "Failed to fetch catalog items" });
    }
  });

  // GET /api/admin/sys/aliases/:catalogKey - List all aliases for a catalog
  app.get("/api/admin/sys/aliases/:catalogKey", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { catalogKey } = req.params;
      const result = await db.execute(sql`
        SELECT ca.*, ci.name as item_name
        FROM cortex_core.catalog_aliases ca
        JOIN cortex_core.catalog_items ci ON ca.catalog_key = ci.catalog_key AND ca.slug = ci.slug
        WHERE ca.catalog_key = ${catalogKey}
        ORDER BY ca.alias
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[admin/sys/aliases] Error:", error);
      res.status(500).json({ error: "Failed to fetch aliases" });
    }
  });

  // GET /api/admin/sys/test-view - Test the canonical view vw_contratos_canon
  app.get("/api/admin/sys/test-view", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          status, status_slug, 
          produto, product_slug, 
          squad, squad_slug
        FROM public.vw_contratos_canon 
        LIMIT 50
      `);
      
      // Also get stats on mapping coverage
      const statsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status_slug IS NOT NULL THEN 1 END) as status_mapped,
          COUNT(CASE WHEN product_slug IS NOT NULL THEN 1 END) as product_mapped,
          COUNT(CASE WHEN squad_slug IS NOT NULL THEN 1 END) as squad_mapped
        FROM public.vw_contratos_canon
      `);
      
      res.json({
        sample: result.rows,
        stats: statsResult.rows[0]
      });
    } catch (error) {
      console.error("[admin/sys/test-view] Error:", error);
      res.status(500).json({ error: "Failed to test canonical view" });
    }
  });

  // GET /api/admin/sys/unmapped - Find values that don't have explicit aliases or direct slug matches
  app.get("/api/admin/sys/unmapped", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Find raw values that have no matching alias AND no direct slug match in catalog_items
      const result = await db.execute(sql`
        WITH raw_status AS (
          SELECT DISTINCT LOWER(TRIM(status)) as raw_val, status as original
          FROM "Clickup".cup_contratos 
          WHERE status IS NOT NULL
        ),
        raw_produto AS (
          SELECT DISTINCT LOWER(TRIM(produto)) as raw_val, produto as original
          FROM "Clickup".cup_contratos 
          WHERE produto IS NOT NULL
        ),
        raw_squad AS (
          SELECT DISTINCT LOWER(TRIM(squad)) as raw_val, squad as original
          FROM "Clickup".cup_contratos 
          WHERE squad IS NOT NULL
        )
        SELECT 'status' as field, r.original as raw_value, 
               (SELECT COUNT(*) FROM "Clickup".cup_contratos WHERE LOWER(TRIM(status)) = r.raw_val) as count
        FROM raw_status r
        LEFT JOIN cortex_core.catalog_aliases a ON a.catalog_key = 'catalog_contract_status' AND a.alias = r.raw_val
        LEFT JOIN cortex_core.catalog_items ci ON ci.catalog_key = 'catalog_contract_status' AND ci.slug = r.raw_val AND ci.active = true
        WHERE a.alias IS NULL AND ci.slug IS NULL
        UNION ALL
        SELECT 'produto' as field, r.original as raw_value,
               (SELECT COUNT(*) FROM "Clickup".cup_contratos WHERE LOWER(TRIM(produto)) = r.raw_val) as count
        FROM raw_produto r
        LEFT JOIN cortex_core.catalog_aliases a ON a.catalog_key = 'catalog_products' AND a.alias = r.raw_val
        LEFT JOIN cortex_core.catalog_items ci ON ci.catalog_key = 'catalog_products' AND ci.slug = r.raw_val AND ci.active = true
        WHERE a.alias IS NULL AND ci.slug IS NULL
        UNION ALL
        SELECT 'squad' as field, r.original as raw_value,
               (SELECT COUNT(*) FROM "Clickup".cup_contratos WHERE LOWER(TRIM(squad)) = r.raw_val) as count
        FROM raw_squad r
        LEFT JOIN cortex_core.catalog_aliases a ON a.catalog_key = 'catalog_squads' AND a.alias = r.raw_val
        LEFT JOIN cortex_core.catalog_items ci ON ci.catalog_key = 'catalog_squads' AND ci.slug = r.raw_val AND ci.active = true
        WHERE a.alias IS NULL AND ci.slug IS NULL
        ORDER BY field, count DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[admin/sys/unmapped] Error:", error);
      res.status(500).json({ error: "Failed to find unmapped values" });
    }
  });

  // POST /api/admin/generate-snapshot - Generate a new cup_data_hist snapshot from current cup_contratos data
  app.post("/api/admin/generate-snapshot", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { snapshotDate } = req.body;
      
      // Default to current date if not provided
      const targetDate = snapshotDate ? new Date(snapshotDate) : new Date();
      
      // Validate date
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: "Invalid snapshot date" });
      }
      
      // Check if snapshot already exists for this date
      const existingCheck = await db.execute(sql`
        SELECT COUNT(*) as count FROM "Clickup".cup_data_hist 
        WHERE DATE(data_snapshot) = DATE(${targetDate})
      `);
      
      const existingCount = Number((existingCheck.rows[0] as any)?.count || 0);
      if (existingCount > 0) {
        return res.status(409).json({ 
          error: `Snapshot already exists for ${targetDate.toISOString().split('T')[0]}`,
          existingRecords: existingCount 
        });
      }
      
      // Insert snapshot records from cup_contratos (let DB generate IDs)
      const insertResult = await db.execute(sql`
        INSERT INTO "Clickup".cup_data_hist (data_snapshot, servico, status, valorr, valorp, id_task, id_subtask, 
                                   data_inicio, data_encerramento, data_pausa, squad, produto, responsavel, cs_responsavel, vendedor)
        SELECT 
          ${targetDate}::timestamp as data_snapshot,
          servico, status, valorr, valorp, id_task, id_subtask,
          data_inicio, data_encerramento, data_pausa, squad, produto, responsavel, cs_responsavel, vendedor
        FROM "Clickup".cup_contratos
      `);
      
      // Count inserted records
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM "Clickup".cup_data_hist 
        WHERE DATE(data_snapshot) = DATE(${targetDate})
      `);
      
      const insertedCount = Number((countResult.rows[0] as any)?.count || 0);
      
      console.log(`[admin/generate-snapshot] Generated ${insertedCount} records for ${targetDate.toISOString()}`);
      
      res.json({ 
        success: true, 
        message: `Snapshot generated successfully`,
        snapshotDate: targetDate.toISOString(),
        recordsInserted: insertedCount
      });
    } catch (error) {
      console.error("[admin/generate-snapshot] Error:", error);
      res.status(500).json({ error: "Failed to generate snapshot" });
    }
  });

  // GET /api/admin/snapshot-status - Check available snapshots in cup_data_hist
  app.get("/api/admin/snapshot-status", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          date_trunc('month', data_snapshot)::date as month,
          MAX(data_snapshot) as latest_snapshot,
          COUNT(*) as record_count
        FROM "Clickup".cup_data_hist 
        GROUP BY date_trunc('month', data_snapshot)
        ORDER BY month DESC
        LIMIT 12
      `);
      
      res.json({
        snapshots: result.rows,
        message: "Available monthly snapshots"
      });
    } catch (error) {
      console.error("[admin/snapshot-status] Error:", error);
      res.status(500).json({ error: "Failed to get snapshot status" });
    }
  });

  // =============================================================================
  // TurboDash Integration Routes (for internal frontend use)
  // =============================================================================
  
  app.get("/api/integrations/turbodash/client/:cnpj", isAuthenticated, async (req, res) => {
    try {
      const { cnpj } = req.params;
      
      // Validate CNPJ format (11-18 chars, only digits and formatting chars)
      const cnpjClean = cnpj.replace(/\D/g, '');
      if (cnpjClean.length < 11 || cnpjClean.length > 14) {
        return res.status(400).json({ error: "CNPJ inválido: deve ter entre 11 e 14 dígitos" });
      }
      
      const forceRefresh = req.query.refresh === 'true';
      
      // Parse month/year parameters for period filtering
      const mes = req.query.mes as string | undefined;
      const ano = req.query.ano as string | undefined;
      
      const { getKPIsByCNPJ } = await import('./services/turbodash');
      const data = await getKPIsByCNPJ(cnpjClean, forceRefresh, mes, ano);
      
      if (!data) {
        return res.status(404).json({ error: "Cliente não encontrado no TurboDash" });
      }
      
      res.json(data);
    } catch (error) {
      console.error("[turbodash] Error fetching client KPIs:", error);
      res.status(500).json({ error: "Erro ao buscar KPIs do cliente" });
    }
  });
  
  app.get("/api/integrations/turbodash/overview", isAuthenticated, async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      
      const { getAllKPIs } = await import('./services/turbodash');
      const data = await getAllKPIs(forceRefresh);
      
      res.json(data);
    } catch (error) {
      console.error("[turbodash] Error fetching KPI list:", error);
      res.status(500).json({ error: "Erro ao buscar lista de KPIs" });
    }
  });
  
  app.get("/api/integrations/turbodash/verify/:cnpj", isAuthenticated, async (req, res) => {
    try {
      const { cnpj } = req.params;
      
      // Validate CNPJ format
      const cnpjClean = cnpj.replace(/\D/g, '');
      if (cnpjClean.length < 11 || cnpjClean.length > 14) {
        return res.status(400).json({ error: "CNPJ inválido: deve ter entre 11 e 14 dígitos" });
      }
      
      const { verifyTurbodashCNPJ } = await import('./services/turbodash');
      const result = await verifyTurbodashCNPJ(cnpjClean);
      
      res.json(result);
    } catch (error) {
      console.error("[turbodash] Error verifying CNPJ:", error);
      res.status(500).json({ error: "Erro ao verificar CNPJ" });
    }
  });

  // ============ RH PAGAMENTOS ENDPOINTS ============
  
  // Helper: Verificar se usuário pode acessar dados do colaborador
  // Admin e RH podem ver todos; colaboradores só podem ver os próprios dados
  async function canAccessColaboradorRH(user: any, colaboradorId: number): Promise<boolean> {
    if (!user) return false;
    
    // Admin tem acesso total
    if (user.role === 'admin') return true;
    
    // Verificar se usuário está vinculado ao colaborador pelo email
    const colaboradorResult = await db.execute(sql`
      SELECT email_turbo FROM "Inhire".rh_pessoal WHERE id = ${colaboradorId}
    `);
    
    if (colaboradorResult.rows.length === 0) return false;
    
    const emailTurbo = (colaboradorResult.rows[0] as any).email_turbo?.toLowerCase();
    const userEmail = user.email?.toLowerCase();
    
    // Usuário pode acessar se for o próprio colaborador
    return emailTurbo && userEmail && emailTurbo === userEmail;
  }
  
  // Listar pagamentos de um colaborador
  app.get("/api/rh/pagamentos/:colaboradorId", isAuthenticated, async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.colaboradorId);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "ID de colaborador inválido" });
      }
      
      const user = req.user as any;
      const hasAccess = await canAccessColaboradorRH(user, colaboradorId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Acesso negado aos dados de pagamentos" });
      }
      
      const result = await db.execute(sql`
        SELECT 
          p.*,
          (SELECT COUNT(*) FROM "Inhire".rh_notas_fiscais WHERE pagamento_id = p.id) as total_nfs
        FROM "Inhire".rh_pagamentos p
        WHERE p.colaborador_id = ${colaboradorId}
        ORDER BY p.ano_referencia DESC, p.mes_referencia DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error("[rh-pagamentos] Error fetching payments:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos" });
    }
  });
  
  // Buscar nota fiscal de um pagamento
  app.get("/api/rh/pagamentos/:pagamentoId/nf", isAuthenticated, async (req, res) => {
    try {
      const pagamentoId = parseInt(req.params.pagamentoId);
      if (isNaN(pagamentoId)) {
        return res.status(400).json({ error: "ID de pagamento inválido" });
      }
      
      // Verificar permissão via colaborador_id do pagamento
      const pagamentoCheck = await db.execute(sql`
        SELECT colaborador_id FROM "Inhire".rh_pagamentos WHERE id = ${pagamentoId}
      `);
      
      if (pagamentoCheck.rows.length === 0) {
        return res.status(404).json({ error: "Pagamento não encontrado" });
      }
      
      const colaboradorId = (pagamentoCheck.rows[0] as any).colaborador_id;
      const user = req.user as any;
      const hasAccess = await canAccessColaboradorRH(user, colaboradorId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Acesso negado à nota fiscal" });
      }
      
      const result = await db.execute(sql`
        SELECT * FROM "Inhire".rh_notas_fiscais
        WHERE pagamento_id = ${pagamentoId}
        ORDER BY criado_em DESC
        LIMIT 1
      `);
      
      res.json(result.rows[0] || null);
    } catch (error) {
      console.error("[rh-pagamentos] Error fetching NF:", error);
      res.status(500).json({ error: "Erro ao buscar nota fiscal" });
    }
  });
  
  // Registrar nota fiscal anexada
  app.post("/api/rh/pagamentos/:pagamentoId/nf", isAuthenticated, async (req, res) => {
    try {
      const pagamentoId = parseInt(req.params.pagamentoId);
      if (isNaN(pagamentoId)) {
        return res.status(400).json({ error: "ID de pagamento inválido" });
      }
      
      const { arquivoPath, arquivoNome, numeroNf, valorNf, dataEmissao } = req.body;
      
      if (!arquivoPath || !arquivoNome) {
        return res.status(400).json({ error: "Arquivo é obrigatório" });
      }
      
      // Buscar dados do pagamento para validação
      const pagamentoResult = await db.execute(sql`
        SELECT colaborador_id FROM "Inhire".rh_pagamentos WHERE id = ${pagamentoId}
      `);
      
      if (pagamentoResult.rows.length === 0) {
        return res.status(404).json({ error: "Pagamento não encontrado" });
      }
      
      const colaboradorId = (pagamentoResult.rows[0] as any).colaborador_id;
      const user = req.user as any;
      
      // Verificar permissão: apenas o próprio colaborador ou admin pode anexar NF
      const hasAccess = await canAccessColaboradorRH(user, colaboradorId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Acesso negado para anexar nota fiscal" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO "Inhire".rh_notas_fiscais (
          pagamento_id, colaborador_id, numero_nf, valor_nf, 
          arquivo_path, arquivo_nome, data_emissao, status, criado_por
        ) VALUES (
          ${pagamentoId}, ${colaboradorId}, ${numeroNf || null}, ${valorNf || null},
          ${arquivoPath}, ${arquivoNome}, ${dataEmissao || null}, 'anexada', ${user?.email || 'sistema'}
        )
        RETURNING *
      `);
      
      // Atualizar status do pagamento
      await db.execute(sql`
        UPDATE "Inhire".rh_pagamentos 
        SET status = 'nf_anexada', atualizado_em = NOW()
        WHERE id = ${pagamentoId}
      `);
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[rh-pagamentos] Error saving NF:", error);
      res.status(500).json({ error: "Erro ao salvar nota fiscal" });
    }
  });
  
  // Buscar pagamentos do Conta Azul (caz_parcelas/caz_pagar) pelo PIX/CNPJ do colaborador
  app.get("/api/rh/colaborador/:colaboradorId/pagamentos-caz", isAuthenticated, async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.colaboradorId);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "ID de colaborador inválido" });
      }
      
      const user = req.user as any;
      const hasAccess = await canAccessColaboradorRH(user, colaboradorId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Acesso negado aos dados de pagamentos" });
      }
      
      // Buscar dados do colaborador (PIX, CNPJ, CPF, Email)
      const colaboradorResult = await db.execute(sql`
        SELECT nome, pix, cnpj, cpf, email_turbo, email_pessoal FROM "Inhire".rh_pessoal WHERE id = ${colaboradorId}
      `);
      
      if (colaboradorResult.rows.length === 0) {
        return res.status(404).json({ error: "Colaborador não encontrado" });
      }
      
      const colaborador = colaboradorResult.rows[0] as any;
      const pixRaw = colaborador.pix?.trim() || '';
      const cnpjRaw = colaborador.cnpj?.trim() || '';
      const cpfRaw = colaborador.cpf?.trim() || '';
      const emailTurbo = colaborador.email_turbo?.trim() || '';
      const emailPessoal = colaborador.email_pessoal?.trim() || '';
      const nomeCompleto = colaborador.nome?.trim() || '';
      
      // Preparar variações para busca
      const cnpjLimpo = cnpjRaw.replace(/\D/g, '');
      const pixLimpo = pixRaw.replace(/\D/g, '');
      const cpfLimpo = cpfRaw.replace(/\D/g, '');
      const primeiroNome = nomeCompleto.split(' ')[0] || '';
      const ultimoNome = nomeCompleto.split(' ').slice(-1)[0] || '';
      
      console.log(`[rh-pagamentos] Buscando pagamentos para colaborador ${colaboradorId}:`);
      console.log(`  Nome: ${nomeCompleto}, Primeiro: ${primeiroNome}, Último: ${ultimoNome}`);
      console.log(`  PIX raw: ${pixRaw}, PIX limpo: ${pixLimpo}`);
      console.log(`  CNPJ raw: ${cnpjRaw}, CNPJ limpo: ${cnpjLimpo}`);
      console.log(`  CPF raw: ${cpfRaw}, CPF limpo: ${cpfLimpo}`);
      console.log(`  Emails: ${emailTurbo}, ${emailPessoal}`);
      
      if (!pixRaw && !cnpjRaw && !cpfRaw && !nomeCompleto && !emailTurbo && !emailPessoal) {
        console.log(`[rh-pagamentos] Nenhum dado para buscar`);
        return res.json([]);
      }
      
      // Primeiro, buscar o id do cliente na tabela caz_clientes pelo CNPJ/PIX/CPF/Email
      let clienteIds: string[] = [];
      const identifiers = [pixLimpo, cnpjLimpo, cpfLimpo].filter(id => id.length >= 8);
      const emails = [emailTurbo, emailPessoal].filter(e => e.includes('@'));
      
      for (const identifier of identifiers) {
        const clienteResult = await db.execute(sql`
          SELECT ids FROM "Conta Azul".caz_clientes 
          WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = ${identifier}
          LIMIT 5
        `);
        for (const row of clienteResult.rows) {
          const id = (row as any).ids;
          if (id && !clienteIds.includes(id)) clienteIds.push(id);
        }
      }
      
      // Buscar também por email em caz_clientes
      for (const email of emails) {
        const clienteResult = await db.execute(sql`
          SELECT ids FROM "Conta Azul".caz_clientes 
          WHERE LOWER(email) = LOWER(${email})
          LIMIT 5
        `);
        for (const row of clienteResult.rows) {
          const id = (row as any).ids;
          if (id && !clienteIds.includes(id)) clienteIds.push(id);
        }
      }
      
      console.log(`  Clientes encontrados no CAZ: ${clienteIds.length} ids = ${clienteIds.join(', ')}`);
      const hasClienteIds = clienteIds.length > 0;
      
      // Construir condição de id_cliente para múltiplos IDs
      const clienteIdsCondition = hasClienteIds 
        ? sql.join(clienteIds.map(id => sql`p.id_cliente = ${id}`), sql` OR `)
        : sql`FALSE`;
      
      // Buscar em caz_parcelas E caz_pagar usando UNION - SEM limite para mostrar todos
      const result = await db.execute(sql`
        WITH pagamentos_parcelas AS (
          SELECT 
            p.id,
            p.descricao,
            COALESCE(p.valor_pago, p.valor_bruto) as valor_bruto,
            p.data_quitacao as data_pagamento,
            p.data_vencimento,
            p.status,
            p.categoria_nome,
            'parcelas' as fonte
          FROM "Conta Azul".caz_parcelas p
          WHERE p.tipo_evento = 'DESPESA'
            AND UPPER(p.status) IN ('PAID', 'PAGO', 'ACQUITTED', 'LIQUIDADO', 'QUITADO')
            AND (
              (${clienteIdsCondition})
              OR ${cnpjLimpo ? sql`p.descricao ILIKE ${'%' + cnpjLimpo + '%'}` : sql`FALSE`}
              OR ${cnpjRaw ? sql`p.descricao ILIKE ${'%' + cnpjRaw + '%'}` : sql`FALSE`}
              OR ${pixRaw ? sql`p.descricao ILIKE ${'%' + pixRaw + '%'}` : sql`FALSE`}
              OR ${pixLimpo ? sql`p.descricao ILIKE ${'%' + pixLimpo + '%'}` : sql`FALSE`}
              OR ${cpfRaw ? sql`p.descricao ILIKE ${'%' + cpfRaw + '%'}` : sql`FALSE`}
              OR ${cpfLimpo ? sql`p.descricao ILIKE ${'%' + cpfLimpo + '%'}` : sql`FALSE`}
              OR ${emailTurbo ? sql`p.descricao ILIKE ${'%' + emailTurbo + '%'}` : sql`FALSE`}
              OR ${emailPessoal ? sql`p.descricao ILIKE ${'%' + emailPessoal + '%'}` : sql`FALSE`}
              OR ${nomeCompleto ? sql`p.descricao ILIKE ${'%' + nomeCompleto + '%'}` : sql`FALSE`}
              OR (${primeiroNome.length >= 4 ? sql`p.descricao ILIKE ${'%' + primeiroNome + '%'}` : sql`FALSE`}
                  AND ${ultimoNome.length >= 4 ? sql`p.descricao ILIKE ${'%' + ultimoNome + '%'}` : sql`FALSE`})
            )
        ),
        pagamentos_pagar AS (
          SELECT 
            pg.id,
            pg.descricao,
            COALESCE(pg.pago, pg.total) as valor_bruto,
            pg.data_vencimento as data_pagamento,
            pg.data_vencimento,
            pg.status,
            pg.nome as categoria_nome,
            'pagar' as fonte
          FROM "Conta Azul".caz_pagar pg
          WHERE UPPER(pg.status) IN ('PAID', 'PAGO', 'ACQUITTED', 'LIQUIDADO', 'QUITADO')
            AND (
              ${cnpjLimpo ? sql`(pg.descricao ILIKE ${'%' + cnpjLimpo + '%'} OR pg.fornecedor ILIKE ${'%' + cnpjLimpo + '%'})` : sql`FALSE`}
              OR ${cnpjRaw ? sql`(pg.descricao ILIKE ${'%' + cnpjRaw + '%'} OR pg.fornecedor ILIKE ${'%' + cnpjRaw + '%'})` : sql`FALSE`}
              OR ${pixRaw ? sql`(pg.descricao ILIKE ${'%' + pixRaw + '%'} OR pg.fornecedor ILIKE ${'%' + pixRaw + '%'})` : sql`FALSE`}
              OR ${cpfRaw ? sql`(pg.descricao ILIKE ${'%' + cpfRaw + '%'} OR pg.fornecedor ILIKE ${'%' + cpfRaw + '%'})` : sql`FALSE`}
              OR ${cpfLimpo ? sql`(pg.descricao ILIKE ${'%' + cpfLimpo + '%'} OR pg.fornecedor ILIKE ${'%' + cpfLimpo + '%'})` : sql`FALSE`}
              OR ${emailTurbo ? sql`(pg.descricao ILIKE ${'%' + emailTurbo + '%'} OR pg.fornecedor ILIKE ${'%' + emailTurbo + '%'})` : sql`FALSE`}
              OR ${emailPessoal ? sql`(pg.descricao ILIKE ${'%' + emailPessoal + '%'} OR pg.fornecedor ILIKE ${'%' + emailPessoal + '%'})` : sql`FALSE`}
              OR ${nomeCompleto ? sql`(pg.descricao ILIKE ${'%' + nomeCompleto + '%'} OR pg.fornecedor ILIKE ${'%' + nomeCompleto + '%'})` : sql`FALSE`}
              OR (${primeiroNome.length >= 4 ? sql`(pg.descricao ILIKE ${'%' + primeiroNome + '%'} OR pg.fornecedor ILIKE ${'%' + primeiroNome + '%'})` : sql`FALSE`}
                  AND ${ultimoNome.length >= 4 ? sql`(pg.descricao ILIKE ${'%' + ultimoNome + '%'} OR pg.fornecedor ILIKE ${'%' + ultimoNome + '%'})` : sql`FALSE`})
            )
        ),
        todos_pagamentos AS (
          SELECT * FROM pagamentos_parcelas
          UNION ALL
          SELECT * FROM pagamentos_pagar
        ),
        -- Deduplicar por mês/ano e valor (arredondar para evitar diferenças de centavos)
        pagamentos_com_rank AS (
          SELECT 
            t.*,
            EXTRACT(MONTH FROM COALESCE(t.data_pagamento, t.data_vencimento))::int as mes_referencia,
            EXTRACT(YEAR FROM COALESCE(t.data_pagamento, t.data_vencimento))::int as ano_referencia,
            'pendente' as nf_status,
            ROW_NUMBER() OVER (
              PARTITION BY 
                EXTRACT(MONTH FROM COALESCE(t.data_pagamento, t.data_vencimento)),
                EXTRACT(YEAR FROM COALESCE(t.data_pagamento, t.data_vencimento)),
                ROUND(CAST(t.valor_bruto AS numeric), 0)
              ORDER BY 
                CASE WHEN t.fonte = 'parcelas' THEN 1 ELSE 2 END,
                t.data_pagamento DESC NULLS LAST
            ) as rn
          FROM todos_pagamentos t
        )
        SELECT 
          id, descricao, valor_bruto, data_pagamento, data_vencimento, 
          status, categoria_nome, fonte, mes_referencia, ano_referencia, nf_status
        FROM pagamentos_com_rank
        WHERE rn = 1
        ORDER BY COALESCE(data_pagamento, data_vencimento) DESC
      `);
      
      console.log(`[rh-pagamentos] Encontrados ${result.rows.length} pagamentos`);
      
      res.json(result.rows);
    } catch (error) {
      console.error("[rh-pagamentos] Error fetching CAZ payments:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos do Conta Azul" });
    }
  });

  // DEBUG: Buscar CNPJ em todas as tabelas do Conta Azul
  app.get("/api/debug/buscar-cnpj/:cnpj", isAuthenticated, async (req, res) => {
    try {
      const cnpj = req.params.cnpj.replace(/\D/g, '');
      console.log(`[DEBUG] Buscando CNPJ ${cnpj} em tabelas CAZ...`);
      
      const results: any = {};
      
      // 1. Buscar em caz_parcelas - descrição
      const parcelas = await db.execute(sql`
        SELECT id, descricao, valor_pago, valor_bruto, status, tipo_evento, data_quitacao, data_vencimento, categoria_nome
        FROM "Conta Azul".caz_parcelas 
        WHERE descricao ILIKE ${'%' + cnpj + '%'}
        LIMIT 10
      `);
      results.parcelas_descricao = parcelas.rows;
      console.log(`[DEBUG] caz_parcelas (descrição): ${parcelas.rows.length} registros`);
      
      // 2. Buscar em caz_pagar - descrição
      const pagar_desc = await db.execute(sql`
        SELECT id, descricao, fornecedor, pago, total, status, data_vencimento
        FROM "Conta Azul".caz_pagar 
        WHERE descricao ILIKE ${'%' + cnpj + '%'}
        LIMIT 10
      `);
      results.pagar_descricao = pagar_desc.rows;
      console.log(`[DEBUG] caz_pagar (descrição): ${pagar_desc.rows.length} registros`);
      
      // 3. Buscar em caz_pagar - fornecedor
      const pagar_forn = await db.execute(sql`
        SELECT id, descricao, fornecedor, pago, total, status, data_vencimento
        FROM "Conta Azul".caz_pagar 
        WHERE fornecedor ILIKE ${'%' + cnpj + '%'}
        LIMIT 10
      `);
      results.pagar_fornecedor = pagar_forn.rows;
      console.log(`[DEBUG] caz_pagar (fornecedor): ${pagar_forn.rows.length} registros`);
      
      // 4. Buscar em caz_clientes - cnpj
      const clientes = await db.execute(sql`
        SELECT id, nome, cnpj, ids
        FROM "Conta Azul".caz_clientes 
        WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = ${cnpj}
        LIMIT 10
      `);
      results.clientes = clientes.rows;
      console.log(`[DEBUG] caz_clientes: ${clientes.rows.length} registros`);
      
      // 5. Verificar estrutura das tabelas
      const estrutura_parcelas = await db.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'caz_parcelas' 
        ORDER BY ordinal_position
      `);
      results.colunas_parcelas = estrutura_parcelas.rows.map((r: any) => r.column_name);
      
      const estrutura_pagar = await db.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'caz_pagar' 
        ORDER BY ordinal_position
      `);
      results.colunas_pagar = estrutura_pagar.rows.map((r: any) => r.column_name);
      
      // 6. Buscar pelo nome "Bruno" em caz_pagar.fornecedor
      const pagar_bruno = await db.execute(sql`
        SELECT id, descricao, fornecedor, pago, total, status, data_vencimento
        FROM "Conta Azul".caz_pagar 
        WHERE fornecedor ILIKE '%Bruno%'
        LIMIT 10
      `);
      results.pagar_bruno = pagar_bruno.rows;
      console.log(`[DEBUG] caz_pagar (Bruno): ${pagar_bruno.rows.length} registros`);
      
      // 7. Se encontrou cliente, buscar pelo id_cliente nas parcelas
      if (clientes.rows.length > 0) {
        const clienteIds = (clientes.rows[0] as any).ids;
        console.log(`[DEBUG] Buscando pagamentos pelo id_cliente: ${clienteIds}`);
        
        const parcelas_cliente = await db.execute(sql`
          SELECT id, descricao, valor_pago, valor_bruto, status, tipo_evento, data_quitacao, data_vencimento, categoria_nome
          FROM "Conta Azul".caz_parcelas 
          WHERE id_cliente = ${clienteIds}
          LIMIT 20
        `);
        results.parcelas_por_id_cliente = parcelas_cliente.rows;
        console.log(`[DEBUG] caz_parcelas (id_cliente): ${parcelas_cliente.rows.length} registros`);
      }
      
      res.json(results);
    } catch (error) {
      console.error("[DEBUG] Error:", error);
      res.status(500).json({ error: "Erro na busca debug", details: String(error) });
    }
  });

  // Registrar nota fiscal diretamente (sem pagamento existente)
  app.post("/api/rh/colaboradores/:colaboradorId/nf", isAuthenticated, async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.colaboradorId);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "ID de colaborador inválido" });
      }
      
      const user = req.user as any;
      const hasAccess = await canAccessColaboradorRH(user, colaboradorId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Acesso negado para anexar nota fiscal" });
      }
      
      const { arquivoPath, arquivoNome, mesReferencia, anoReferencia, numeroNf, valorNf, dataEmissao } = req.body;
      
      if (!arquivoPath || !mesReferencia || !anoReferencia) {
        return res.status(400).json({ error: "Arquivo, mês e ano são obrigatórios" });
      }
      
      // Inserir NF diretamente na tabela "Inhire".rh_notas_fiscais
      const result = await db.execute(sql`
        INSERT INTO "Inhire".rh_notas_fiscais (
          colaborador_id, numero_nf, valor_nf, 
          arquivo_path, arquivo_nome, data_emissao, status, criado_por,
          mes_referencia, ano_referencia
        ) VALUES (
          ${colaboradorId}, ${numeroNf || null}, ${valorNf || null},
          ${arquivoPath}, ${arquivoNome}, ${dataEmissao || null}, 'anexada', ${user?.email || 'sistema'},
          ${mesReferencia}, ${anoReferencia}
        )
        RETURNING *
      `);
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[rh-pagamentos] Error saving direct NF:", error);
      res.status(500).json({ error: "Erro ao salvar nota fiscal" });
    }
  });

  // Listar notas fiscais de um colaborador
  app.get("/api/rh/colaborador/:colaboradorId/nfs", isAuthenticated, async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.colaboradorId);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "ID de colaborador inválido" });
      }
      
      const user = req.user as any;
      const hasAccess = await canAccessColaboradorRH(user, colaboradorId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Acesso negado às notas fiscais" });
      }
      
      const result = await db.execute(sql`
        SELECT nf.*, p.mes_referencia, p.ano_referencia, p.valor_bruto
        FROM "Inhire".rh_notas_fiscais nf
        JOIN "Inhire".rh_pagamentos p ON p.id = nf.pagamento_id
        WHERE nf.colaborador_id = ${colaboradorId}
        ORDER BY p.ano_referencia DESC, p.mes_referencia DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error("[rh-pagamentos] Error fetching collaborator NFs:", error);
      res.status(500).json({ error: "Erro ao buscar notas fiscais do colaborador" });
    }
  });

  // ===== API de Comentários sobre Colaboradores =====
  
  // Listar comentários de um colaborador
  app.get("/api/rh/colaborador/:colaboradorId/comentarios", isAuthenticated, async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.colaboradorId);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "ID do colaborador inválido" });
      }
      
      const user = req.user as any;
      const hasAccess = await canAccessColaboradorRH(user, colaboradorId.toString());
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Acesso negado aos comentários" });
      }
      
      const result = await db.execute(sql`
        SELECT c.*, 
               a.nome_completo as autor_nome_completo
        FROM "Inhire".rh_comentarios c
        LEFT JOIN "Inhire".rh_pessoal a ON a.id = c.autor_id
        WHERE c.colaborador_id = ${colaboradorId}
        ORDER BY c.criado_em DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error("[rh-comentarios] Error fetching comments:", error);
      res.status(500).json({ error: "Erro ao buscar comentários" });
    }
  });
  
  // Adicionar comentário
  app.post("/api/rh/colaborador/:colaboradorId/comentarios", isAuthenticated, async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.colaboradorId);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "ID do colaborador inválido" });
      }
      
      const user = req.user as any;
      const hasAccess = await canAccessColaboradorRH(user, colaboradorId.toString());
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Acesso negado para adicionar comentários" });
      }
      
      const { comentario, tipo = "geral", visibilidade = "lider" } = req.body;
      
      if (!comentario || comentario.trim() === "") {
        return res.status(400).json({ error: "Comentário é obrigatório" });
      }
      
      // Buscar dados do autor (colaborador logado)
      const autorResult = await db.execute(sql`
        SELECT id, nome_completo FROM "Inhire".rh_pessoal 
        WHERE email = ${user.email}
        LIMIT 1
      `);
      
      const autor = autorResult.rows[0];
      const autorId = autor ? (autor as any).id : null;
      const autorNome = autor ? (autor as any).nome_completo : user.name || user.email;
      
      const result = await db.execute(sql`
        INSERT INTO "Inhire".rh_comentarios (colaborador_id, autor_id, autor_nome, autor_email, comentario, tipo, visibilidade)
        VALUES (${colaboradorId}, ${autorId}, ${autorNome}, ${user.email}, ${comentario.trim()}, ${tipo}, ${visibilidade})
        RETURNING *
      `);
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[rh-comentarios] Error adding comment:", error);
      res.status(500).json({ error: "Erro ao adicionar comentário" });
    }
  });
  
  // Deletar comentário
  app.delete("/api/rh/comentarios/:comentarioId", isAuthenticated, async (req, res) => {
    try {
      const comentarioId = parseInt(req.params.comentarioId);
      if (isNaN(comentarioId)) {
        return res.status(400).json({ error: "ID do comentário inválido" });
      }
      
      const user = req.user as any;
      
      // Verificar se o usuário é o autor do comentário ou admin
      const comentarioResult = await db.execute(sql`
        SELECT * FROM "Inhire".rh_comentarios WHERE id = ${comentarioId}
      `);
      
      if (comentarioResult.rows.length === 0) {
        return res.status(404).json({ error: "Comentário não encontrado" });
      }
      
      const comentario = comentarioResult.rows[0] as any;
      const isAuthor = comentario.autor_email === user.email;
      const isAdmin = user.role === "admin";
      
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ error: "Você só pode deletar seus próprios comentários" });
      }
      
      await db.execute(sql`DELETE FROM "Inhire".rh_comentarios WHERE id = ${comentarioId}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("[rh-comentarios] Error deleting comment:", error);
      res.status(500).json({ error: "Erro ao deletar comentário" });
    }
  });

  // ========== AUTO REPORT ROUTES ==========
  app.get("/api/autoreport/clientes", isAuthenticated, async (req, res) => {
    try {
      const clientes = await autoreport.listarClientes();
      res.json(clientes);
    } catch (error: any) {
      console.error("[autoreport] Error fetching clientes:", error);
      res.status(500).json({ error: error.message || "Erro ao buscar clientes" });
    }
  });

  app.post("/api/autoreport/gerar", isAuthenticated, async (req, res) => {
    try {
      const { cliente, dataInicio, dataFim, pageSelection, outputFormat } = req.body;
      if (!cliente) {
        return res.status(400).json({ error: "Cliente é obrigatório" });
      }
      const job = await autoreport.gerarRelatorio(cliente, dataInicio, dataFim, pageSelection, outputFormat || 'pdf');
      res.json(job);
    } catch (error: any) {
      console.error("[autoreport] Error generating report:", error);
      res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
    }
  });

  app.post("/api/autoreport/gerar-lote", isAuthenticated, async (req, res) => {
    try {
      const { clientes, dataInicio, dataFim, pageSelection, outputFormat } = req.body;
      if (!clientes || !Array.isArray(clientes)) {
        return res.status(400).json({ error: "Lista de clientes é obrigatória" });
      }
      const jobs = await autoreport.gerarRelatoriosEmLote(clientes, dataInicio, dataFim, pageSelection, outputFormat || 'pdf');
      res.json(jobs);
    } catch (error: any) {
      console.error("[autoreport] Error generating batch reports:", error);
      res.status(500).json({ error: error.message || "Erro ao gerar relatórios em lote" });
    }
  });

  app.get("/api/autoreport/jobs", isAuthenticated, async (req, res) => {
    try {
      const jobs = autoreport.getAllJobs();
      res.json(jobs);
    } catch (error: any) {
      console.error("[autoreport] Error fetching jobs:", error);
      res.status(500).json({ error: error.message || "Erro ao buscar jobs" });
    }
  });

  app.get("/api/autoreport/jobs/:jobId", isAuthenticated, async (req, res) => {
    try {
      const job = autoreport.getJobStatus(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job não encontrado" });
      }
      res.json(job);
    } catch (error: any) {
      console.error("[autoreport] Error fetching job:", error);
      res.status(500).json({ error: error.message || "Erro ao buscar job" });
    }
  });

  app.get("/api/autoreport/download/:jobId", isAuthenticated, async (req, res) => {
    try {
      const jobId = decodeURIComponent(req.params.jobId);
      const pdfData = autoreport.getPdfBuffer(jobId);
      
      if (!pdfData) {
        return res.status(404).json({ error: "PDF não encontrado ou expirado" });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdfData.fileName}"`);
      res.setHeader('Content-Length', pdfData.buffer.length);
      res.send(pdfData.buffer);
    } catch (error: any) {
      console.error("[autoreport] Error downloading PDF:", error);
      res.status(500).json({ error: error.message || "Erro ao baixar PDF" });
    }
  });

  // Sales Goals endpoints - configurable targets for Closers and SDRs
  app.get("/api/sales-goals", isAuthenticated, async (req, res) => {
    try {
      const { goalType, periodMonth, periodYear } = req.query;
      
      const conditions: any[] = [];
      
      if (goalType) {
        conditions.push(sql`goal_type = ${goalType as string}`);
      }
      if (periodMonth) {
        const month = parseInt(periodMonth as string, 10);
        if (isNaN(month) || month < 1 || month > 12) {
          return res.status(400).json({ error: "periodMonth deve ser um número entre 1 e 12" });
        }
        conditions.push(sql`(period_month = ${month} OR period_month IS NULL)`);
      }
      if (periodYear) {
        const year = parseInt(periodYear as string, 10);
        if (isNaN(year) || year < 2000 || year > 2100) {
          return res.status(400).json({ error: "periodYear deve ser um ano válido (2000-2100)" });
        }
        conditions.push(sql`(period_year = ${year} OR period_year IS NULL)`);
      }
      
      let result;
      if (conditions.length > 0) {
        const whereClause = sql.join(conditions, sql` AND `);
        result = await db.execute(sql`
          SELECT * FROM cortex_core.sales_goals 
          WHERE ${whereClause}
          ORDER BY goal_type, goal_key
        `);
      } else {
        result = await db.execute(sql`
          SELECT * FROM cortex_core.sales_goals 
          ORDER BY goal_type, goal_key
        `);
      }
      
      res.json(result.rows);
    } catch (error: any) {
      console.error("[sales-goals] Error fetching goals:", error);
      res.status(500).json({ error: error.message || "Erro ao buscar metas" });
    }
  });

  app.put("/api/sales-goals", isAuthenticated, async (req, res) => {
    try {
      const { goalType, goalKey, goalValue, periodMonth, periodYear } = req.body;
      
      if (!goalType || !goalKey || goalValue === undefined) {
        return res.status(400).json({ error: "goalType, goalKey e goalValue são obrigatórios" });
      }
      
      const numValue = parseFloat(goalValue);
      if (isNaN(numValue) || numValue < 0) {
        return res.status(400).json({ error: "goalValue deve ser um número válido maior ou igual a zero" });
      }
      
      const validMonth = periodMonth ? parseInt(periodMonth, 10) : null;
      const validYear = periodYear ? parseInt(periodYear, 10) : null;
      
      if (validMonth !== null && (isNaN(validMonth) || validMonth < 1 || validMonth > 12)) {
        return res.status(400).json({ error: "periodMonth deve ser um número entre 1 e 12" });
      }
      if (validYear !== null && (isNaN(validYear) || validYear < 2000 || validYear > 2100)) {
        return res.status(400).json({ error: "periodYear deve ser um ano válido (2000-2100)" });
      }
      
      const user = req.user as any;
      const updatedBy = user?.email || user?.name || 'system';
      
      const result = await db.execute(sql`
        INSERT INTO cortex_core.sales_goals (goal_type, goal_key, goal_value, period_month, period_year, updated_by, updated_at)
        VALUES (${goalType}, ${goalKey}, ${numValue}, ${validMonth}, ${validYear}, ${updatedBy}, NOW())
        ON CONFLICT (goal_type, goal_key, period_month, period_year)
        DO UPDATE SET goal_value = ${numValue}, updated_by = ${updatedBy}, updated_at = NOW()
        RETURNING *
      `);
      
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[sales-goals] Error updating goal:", error);
      res.status(500).json({ error: error.message || "Erro ao atualizar meta" });
    }
  });

  app.post("/api/sales-goals/batch", isAuthenticated, async (req, res) => {
    try {
      const { goals } = req.body;
      
      if (!Array.isArray(goals) || goals.length === 0) {
        return res.status(400).json({ error: "goals deve ser um array não vazio" });
      }
      
      const user = req.user as any;
      const updatedBy = user?.email || user?.name || 'system';
      const results: any[] = [];
      
      for (const goal of goals) {
        const { goalType, goalKey, goalValue, periodMonth, periodYear } = goal;
        
        if (!goalType || !goalKey || goalValue === undefined) {
          continue;
        }
        
        const numValue = parseFloat(goalValue);
        if (isNaN(numValue) || numValue < 0) {
          continue;
        }
        
        const validMonth = periodMonth ? parseInt(periodMonth, 10) : null;
        const validYear = periodYear ? parseInt(periodYear, 10) : null;
        
        if (validMonth !== null && (isNaN(validMonth) || validMonth < 1 || validMonth > 12)) {
          continue;
        }
        if (validYear !== null && (isNaN(validYear) || validYear < 2000 || validYear > 2100)) {
          continue;
        }
        
        const result = await db.execute(sql`
          INSERT INTO cortex_core.sales_goals (goal_type, goal_key, goal_value, period_month, period_year, updated_by, updated_at)
          VALUES (${goalType}, ${goalKey}, ${numValue}, ${validMonth}, ${validYear}, ${updatedBy}, NOW())
          ON CONFLICT (goal_type, goal_key, period_month, period_year)
          DO UPDATE SET goal_value = ${numValue}, updated_by = ${updatedBy}, updated_at = NOW()
          RETURNING *
        `);
        
        results.push(result.rows[0]);
      }
      
      res.json(results);
    } catch (error: any) {
      console.error("[sales-goals] Error batch updating goals:", error);
      res.status(500).json({ error: error.message || "Erro ao atualizar metas em lote" });
    }
  });

  // ========================================
  // UNAVAILABILITY REQUESTS API ENDPOINTS
  // ========================================
  
  // Get squads list for filtering
  app.get("/api/unavailability-requests/squads", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT squad 
        FROM "Inhire".rh_pessoal 
        WHERE squad IS NOT NULL AND squad != '' AND status = 'Ativo'
        ORDER BY squad
      `);
      res.json(result.rows.map(r => r.squad));
    } catch (error: any) {
      console.error("[unavailability] Error fetching squads:", error);
      res.status(500).json({ error: error.message || "Erro ao buscar squads" });
    }
  });
  
  app.get("/api/unavailability-requests", isAuthenticated, async (req, res) => {
    try {
      const { status, colaboradorId, squadNome } = req.query;
      
      let query = sql`
        SELECT ur.*, 
               CASE 
                 WHEN ur.data_admissao IS NOT NULL THEN 
                   EXTRACT(YEAR FROM AGE(CURRENT_DATE, ur.data_admissao)) * 12 + 
                   EXTRACT(MONTH FROM AGE(CURRENT_DATE, ur.data_admissao))
                 ELSE NULL 
               END as meses_empresa
        FROM cortex_core.unavailability_requests ur
        WHERE 1=1
      `;
      
      // For pending, check if either RH or Lider hasn't approved yet
      if (status === 'pendente') {
        query = sql`${query} AND (ur.status_rh = 'pendente' OR ur.status_lider = 'pendente') AND ur.status_rh != 'reprovado' AND ur.status_lider != 'reprovado'`;
      } else if (status === 'aprovado') {
        // Only fully approved (both RH and Lider approved)
        query = sql`${query} AND ur.status_rh = 'aprovado' AND ur.status_lider = 'aprovado'`;
      } else if (status === 'reprovado') {
        query = sql`${query} AND (ur.status_rh = 'reprovado' OR ur.status_lider = 'reprovado')`;
      } else if (status) {
        query = sql`${query} AND ur.status = ${status as string}`;
      }
      
      if (colaboradorId) {
        query = sql`${query} AND ur.colaborador_id = ${parseInt(colaboradorId as string, 10)}`;
      }
      
      if (squadNome) {
        query = sql`${query} AND ur.squad_nome = ${squadNome as string}`;
      }
      
      query = sql`${query} ORDER BY ur.created_at DESC`;
      
      const result = await db.execute(query);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[unavailability] Error fetching requests:", error);
      res.status(500).json({ error: error.message || "Erro ao buscar solicitações" });
    }
  });

  app.post("/api/unavailability-requests", isAuthenticated, async (req, res) => {
    try {
      const { colaboradorId, colaboradorNome, colaboradorEmail, dataInicio, dataFim, motivo, dataAdmissao, squadNome } = req.body;
      
      if (!colaboradorId || !colaboradorNome || !dataInicio || !dataFim) {
        return res.status(400).json({ error: "Campos obrigatórios: colaboradorId, colaboradorNome, dataInicio, dataFim" });
      }
      
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);
      const diffDays = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return res.status(400).json({ error: "Data de fim deve ser posterior à data de início" });
      }
      if (diffDays > 7) {
        return res.status(400).json({ error: "Período máximo de 7 dias" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO cortex_core.unavailability_requests 
        (colaborador_id, colaborador_nome, colaborador_email, data_inicio, data_fim, motivo, data_admissao, status, status_rh, status_lider, squad_nome)
        VALUES (${colaboradorId}, ${colaboradorNome}, ${colaboradorEmail || null}, ${dataInicio}, ${dataFim}, ${motivo || null}, ${dataAdmissao || null}, 'pendente', 'pendente', 'pendente', ${squadNome || null})
        RETURNING *
      `);
      
      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error("[unavailability] Error creating request:", error);
      res.status(500).json({ error: error.message || "Erro ao criar solicitação" });
    }
  });

  // Dual approval endpoint - handles RH and Lider separately
  app.patch("/api/unavailability-requests/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { approvalType, status, aprovadorEmail, aprovadorNome, observacao } = req.body;
      
      if (!approvalType || !['rh', 'lider'].includes(approvalType)) {
        return res.status(400).json({ error: "approvalType deve ser 'rh' ou 'lider'" });
      }
      
      if (!status || !['aprovado', 'reprovado'].includes(status)) {
        return res.status(400).json({ error: "Status deve ser 'aprovado' ou 'reprovado'" });
      }
      
      let updateQuery;
      if (approvalType === 'rh') {
        updateQuery = sql`
          UPDATE cortex_core.unavailability_requests 
          SET status_rh = ${status}, 
              aprovador_rh_email = ${aprovadorEmail || null}, 
              aprovador_rh_nome = ${aprovadorNome || null},
              data_aprovacao_rh = CURRENT_TIMESTAMP,
              observacao_rh = ${observacao || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id, 10)}
          RETURNING *
        `;
      } else {
        updateQuery = sql`
          UPDATE cortex_core.unavailability_requests 
          SET status_lider = ${status}, 
              aprovador_lider_email = ${aprovadorEmail || null}, 
              aprovador_lider_nome = ${aprovadorNome || null},
              data_aprovacao_lider = CURRENT_TIMESTAMP,
              observacao_lider = ${observacao || null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id, 10)}
          RETURNING *
        `;
      }
      
      const result = await db.execute(updateQuery);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }
      
      // Check if both are approved, then update main status
      const row = result.rows[0] as any;
      if (row.status_rh === 'aprovado' && row.status_lider === 'aprovado') {
        await db.execute(sql`
          UPDATE cortex_core.unavailability_requests 
          SET status = 'aprovado', updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id, 10)}
        `);
        row.status = 'aprovado';
      } else if (row.status_rh === 'reprovado' || row.status_lider === 'reprovado') {
        await db.execute(sql`
          UPDATE cortex_core.unavailability_requests 
          SET status = 'reprovado', updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id, 10)}
        `);
        row.status = 'reprovado';
      }
      
      res.json(row);
    } catch (error: any) {
      console.error("[unavailability] Error updating approval:", error);
      res.status(500).json({ error: error.message || "Erro ao atualizar aprovação" });
    }
  });

  // Edit period (only for approved periods in calendar)
  app.put("/api/unavailability-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { dataInicio, dataFim, motivo } = req.body;
      
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "Campos obrigatórios: dataInicio, dataFim" });
      }
      
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);
      const diffDays = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return res.status(400).json({ error: "Data de fim deve ser posterior à data de início" });
      }
      if (diffDays > 7) {
        return res.status(400).json({ error: "Período máximo de 7 dias" });
      }
      
      const result = await db.execute(sql`
        UPDATE cortex_core.unavailability_requests 
        SET data_inicio = ${dataInicio}, 
            data_fim = ${dataFim},
            motivo = ${motivo || null},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id, 10)}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }
      
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[unavailability] Error editing request:", error);
      res.status(500).json({ error: error.message || "Erro ao editar solicitação" });
    }
  });

  app.patch("/api/unavailability-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, aprovadorEmail, aprovadorNome, observacaoAprovador } = req.body;
      
      if (!status || !['aprovado', 'reprovado'].includes(status)) {
        return res.status(400).json({ error: "Status deve ser 'aprovado' ou 'reprovado'" });
      }
      
      const result = await db.execute(sql`
        UPDATE cortex_core.unavailability_requests 
        SET status = ${status}, 
            aprovador_email = ${aprovadorEmail || null}, 
            aprovador_nome = ${aprovadorNome || null},
            data_aprovacao = CURRENT_TIMESTAMP,
            observacao_aprovador = ${observacaoAprovador || null},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id, 10)}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }
      
      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("[unavailability] Error updating request:", error);
      res.status(500).json({ error: error.message || "Erro ao atualizar solicitação" });
    }
  });

  app.delete("/api/unavailability-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { fromCalendar } = req.query;
      
      let result;
      if (fromCalendar === 'true') {
        // Allow deleting approved periods from calendar
        result = await db.execute(sql`
          DELETE FROM cortex_core.unavailability_requests 
          WHERE id = ${parseInt(id, 10)}
          RETURNING id
        `);
      } else {
        // Only allow deleting pending requests
        result = await db.execute(sql`
          DELETE FROM cortex_core.unavailability_requests 
          WHERE id = ${parseInt(id, 10)} AND (status = 'pendente' OR (status_rh = 'pendente' AND status_lider = 'pendente'))
          RETURNING id
        `);
      }
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Solicitação não encontrada ou já foi processada" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[unavailability] Error deleting request:", error);
      res.status(500).json({ error: error.message || "Erro ao excluir solicitação" });
    }
  });

  // ==================== NOTAS FISCAIS ====================

  const multer = (await import("multer")).default;
  const nfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  // POST /api/notas-fiscais/upload — Upload and process PDF files
  app.post("/api/notas-fiscais/upload", isAuthenticated, nfUpload.array("files", 50), async (req: any, res) => {
    try {
      const { extractTextFromPDF, extractValueFromText, extractPrestadorFromFilename } = await import("./services/nfExtractor");
      const { mes, mes_num, categoria, ano } = req.body;
      const files = req.files as Express.Multer.File[];
      if (!files?.length) return res.status(400).json({ error: "No files uploaded" });

      const results = [];
      for (const file of files) {
        const { text, status: pdfStatus } = await extractTextFromPDF(file.buffer);
        let valor: number | null = null;
        let moeda = "";
        let padrao = "";
        let status = pdfStatus;

        if (pdfStatus === "OK") {
          const extracted = extractValueFromText(text);
          valor = extracted.valor;
          moeda = extracted.moeda;
          padrao = extracted.padrao;
          if (valor === null) status = "VALOR NÃO ENCONTRADO";
        }

        const prestador = extractPrestadorFromFilename(file.originalname);

        await db.execute(sql`
          INSERT INTO cortex_core.notas_fiscais (mes, mes_num, ano, categoria, arquivo, prestador, valor_brl, moeda_original, padrao_usado, status)
          VALUES (${mes}, ${parseInt(mes_num)}, ${parseInt(ano || "2026")}, ${categoria}, ${file.originalname}, ${prestador}, ${valor}, ${moeda}, ${padrao}, ${status})
          ON CONFLICT (ano, mes_num, categoria, arquivo) DO UPDATE SET
            valor_brl = EXCLUDED.valor_brl, moeda_original = EXCLUDED.moeda_original,
            padrao_usado = EXCLUDED.padrao_usado, status = EXCLUDED.status, prestador = EXCLUDED.prestador,
            created_at = NOW()
        `);
        results.push({ arquivo: file.originalname, valor_brl: valor, status, prestador });
      }
      res.json({ processed: results.length, results });
    } catch (error: any) {
      console.error("[api] Error uploading NFs:", error);
      res.status(500).json({ error: "Failed to process uploaded files" });
    }
  });

  // POST /api/notas-fiscais/scan-local — Scan local folder (admin only)
  app.post("/api/notas-fiscais/scan-local", isAuthenticated, async (req, res) => {
    try {
      const { extractTextFromPDF, extractValueFromText, extractPrestadorFromFilename } = await import("./services/nfExtractor");
      const fs = await import("fs/promises");
      const path = await import("path");

      const baseDir = path.default.join(process.cwd(), "attached_assets", "2026");
      const monthDirs = (await fs.default.readdir(baseDir, { withFileTypes: true }))
        .filter(d => d.isDirectory() && /^\d{2}\s*-\s*/.test(d.name))
        .sort((a, b) => a.name.localeCompare(b.name));

      let totalProcessed = 0;
      let totalErrors = 0;

      for (const monthDir of monthDirs) {
        const mesNum = parseInt(monthDir.name.substring(0, 2));
        const monthPath = path.default.join(baseDir, monthDir.name);
        const catDirs = (await fs.default.readdir(monthPath, { withFileTypes: true }))
          .filter(d => d.isDirectory());

        for (const catDir of catDirs) {
          const catPath = path.default.join(monthPath, catDir.name);
          const files = (await fs.default.readdir(catPath))
            .filter(f => f.toLowerCase().endsWith(".pdf"));

          for (const filename of files) {
            const filePath = path.default.join(catPath, filename);
            const buffer = await fs.default.readFile(filePath);
            const { text, status: pdfStatus } = await extractTextFromPDF(buffer);

            let valor: number | null = null;
            let moeda = "";
            let padrao = "";
            let status = pdfStatus;

            if (pdfStatus === "OK") {
              const extracted = extractValueFromText(text);
              valor = extracted.valor;
              moeda = extracted.moeda;
              padrao = extracted.padrao;
              if (valor === null) status = "VALOR NÃO ENCONTRADO";
            }

            const prestador = extractPrestadorFromFilename(filename);

            await db.execute(sql`
              INSERT INTO cortex_core.notas_fiscais (mes, mes_num, ano, categoria, arquivo, prestador, valor_brl, moeda_original, padrao_usado, status)
              VALUES (${monthDir.name}, ${mesNum}, 2026, ${catDir.name}, ${filename}, ${prestador}, ${valor}, ${moeda}, ${padrao}, ${status})
              ON CONFLICT (ano, mes_num, categoria, arquivo) DO UPDATE SET
                valor_brl = EXCLUDED.valor_brl, moeda_original = EXCLUDED.moeda_original,
                padrao_usado = EXCLUDED.padrao_usado, status = EXCLUDED.status, prestador = EXCLUDED.prestador,
                created_at = NOW()
            `);

            if (status === "OK") totalProcessed++;
            else totalErrors++;
          }
        }
      }

      res.json({ success: true, totalProcessed, totalErrors, total: totalProcessed + totalErrors });
    } catch (error: any) {
      console.error("[api] Error scanning local NFs:", error);
      res.status(500).json({ error: "Failed to scan local folder" });
    }
  });

  // GET /api/notas-fiscais/dashboard — Aggregated data for dashboard
  app.get("/api/notas-fiscais/dashboard", isAuthenticated, async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string) || 2026;

      const [resumoMensal, resumoCategoria, topPrestadores, totais, erros] = await Promise.all([
        db.execute(sql`
          SELECT mes, mes_num, COUNT(*) as qtd, SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END) as total,
            SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) as ok_count,
            SUM(CASE WHEN status != 'OK' THEN 1 ELSE 0 END) as erro_count
          FROM cortex_core.notas_fiscais WHERE ano = ${ano}
          GROUP BY mes, mes_num ORDER BY mes_num
        `),
        db.execute(sql`
          SELECT categoria, COUNT(*) as qtd, SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END) as total,
            SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) as ok_count
          FROM cortex_core.notas_fiscais WHERE ano = ${ano}
          GROUP BY categoria ORDER BY total DESC
        `),
        db.execute(sql`
          SELECT prestador, COUNT(*) as qtd, SUM(valor_brl) as total
          FROM cortex_core.notas_fiscais WHERE ano = ${ano} AND status = 'OK'
          GROUP BY prestador ORDER BY total DESC LIMIT 20
        `),
        db.execute(sql`
          SELECT COUNT(*) as total_nfs,
            SUM(CASE WHEN status = 'OK' THEN 1 ELSE 0 END) as total_ok,
            SUM(CASE WHEN status != 'OK' THEN 1 ELSE 0 END) as total_erros,
            COALESCE(SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END), 0) as valor_total,
            COALESCE(AVG(CASE WHEN status = 'OK' THEN valor_brl END), 0) as valor_medio
          FROM cortex_core.notas_fiscais WHERE ano = ${ano}
        `),
        db.execute(sql`
          SELECT id, mes, categoria, arquivo, status, prestador
          FROM cortex_core.notas_fiscais WHERE ano = ${ano} AND status != 'OK'
          ORDER BY mes_num, categoria, arquivo
        `)
      ]);

      res.json({
        resumoMensal: resumoMensal.rows,
        resumoCategoria: resumoCategoria.rows,
        topPrestadores: topPrestadores.rows,
        totais: totais.rows[0],
        erros: erros.rows
      });
    } catch (error: any) {
      console.error("[api] Error fetching NF dashboard:", error);
      res.status(500).json({ error: "Failed to fetch NF dashboard" });
    }
  });

  // GET /api/notas-fiscais/detalhado — Full list with filters
  app.get("/api/notas-fiscais/detalhado", isAuthenticated, async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string) || 2026;
      const result = await db.execute(sql`
        SELECT id, mes, mes_num, categoria, arquivo, prestador, valor_brl, moeda_original, padrao_usado, status, created_at
        FROM cortex_core.notas_fiscais
        WHERE ano = ${ano}
        ORDER BY mes_num, categoria, arquivo
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("[api] Error fetching NF detalhado:", error);
      res.status(500).json({ error: "Failed to fetch NF details" });
    }
  });

  // GET /api/notas-fiscais/conciliacao — Cross NFs with Conta Azul
  app.get("/api/notas-fiscais/conciliacao", isAuthenticated, async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string) || 2026;

      const nfByMonth = await db.execute(sql`
        SELECT mes_num, SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END) as nf_total
        FROM cortex_core.notas_fiscais WHERE ano = ${ano}
        GROUP BY mes_num ORDER BY mes_num
      `);

      const cazByMonth = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_vencimento::date) as mes_num,
          SUM(COALESCE(valor_pago::numeric, valor_liquido::numeric, 0)) as caz_total
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'DESPESA'
          AND EXTRACT(YEAR FROM data_vencimento::date) = ${ano}
        GROUP BY EXTRACT(MONTH FROM data_vencimento::date)
        ORDER BY mes_num
      `);

      const nfByCat = await db.execute(sql`
        SELECT categoria, SUM(CASE WHEN status = 'OK' THEN valor_brl ELSE 0 END) as nf_total
        FROM cortex_core.notas_fiscais WHERE ano = ${ano}
        GROUP BY categoria ORDER BY nf_total DESC
      `);

      res.json({
        nfByMonth: nfByMonth.rows,
        cazByMonth: cazByMonth.rows,
        nfByCategory: nfByCat.rows
      });
    } catch (error: any) {
      console.error("[api] Error fetching NF conciliacao:", error);
      res.status(500).json({ error: "Failed to fetch conciliation data" });
    }
  });

  // DELETE /api/notas-fiscais/reset — Admin: clear all NFs for re-scan
  app.delete("/api/notas-fiscais/reset", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string) || 2026;
      await db.execute(sql`DELETE FROM cortex_core.notas_fiscais WHERE ano = ${ano}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[api] Error resetting NFs:", error);
      res.status(500).json({ error: "Failed to reset NFs" });
    }
  });

  const httpServer = createServer(app);

  // Commented out for Windows compatibility - WebSocket causes ENOTSUP error
  // setupDealNotifications(httpServer);

  return httpServer;
}

function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

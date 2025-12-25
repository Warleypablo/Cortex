import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertColaboradorSchema, insertPatrimonioSchema, insertRhCargoSchema, insertRhNivelSchema, insertRhSquadSchema, insertRhPromocaoSchema, updateContratoSchema } from "@shared/schema";
import authRoutes from "./auth/routes";
import { isAuthenticated } from "./auth/middleware";
import { getAllUsers, listAllKeys, updateUserPermissions, updateUserRole, createManualUser } from "./auth/userDb";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { analyzeDfc, chatWithDfc, type ChatMessage } from "./services/dfcAnalysis";
import { chat as unifiedAssistantChat } from "./services/unifiedAssistant";
import type { UnifiedAssistantRequest, AssistantContext } from "@shared/schema";
import { setupDealNotifications, triggerTestNotification } from "./services/dealNotifications";
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as path from "path";
import * as fs from "fs";

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(authRoutes);
  
  app.get("/debug-cliente-faturas/:cnpj", async (req, res) => {
    try {
      const cnpj = req.params.cnpj;
      
      const clienteResult = await db.execute(sql`
        SELECT id, nome, cnpj, ids FROM caz_clientes 
        WHERE REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = REGEXP_REPLACE(${cnpj}, '[^0-9]', '', 'g')
        LIMIT 1
      `);
      
      const cliente = clienteResult.rows[0] as any;
      if (!cliente) {
        return res.json({ error: "Cliente não encontrado", cnpj });
      }
      
      const idsRef = cliente.ids || String(cliente.id);
      
      const parcelasResult = await db.execute(sql`
        SELECT * FROM caz_parcelas 
        WHERE id_cliente = ${idsRef}
        ORDER BY data_vencimento DESC
        LIMIT 50
      `);
      
      const receberResult = await db.execute(sql`
        SELECT * FROM caz_receber 
        WHERE cliente_id = ${idsRef}
        ORDER BY data_vencimento DESC
        LIMIT 50
      `);
      
      const jan2025Result = await db.execute(sql`
        SELECT * FROM caz_parcelas 
        WHERE id_cliente = ${idsRef}
          AND data_vencimento >= '2025-01-01'
          AND data_vencimento <= '2025-01-31'
        ORDER BY data_vencimento
      `);
      
      const maxDatesResult = await db.execute(sql`
        SELECT 
          'caz_receber' as tabela,
          MAX(data_vencimento) as max_vencimento,
          MAX(data_criacao) as max_criacao,
          COUNT(*) as total
        FROM caz_receber
        UNION ALL
        SELECT 
          'caz_parcelas' as tabela,
          MAX(data_vencimento) as max_vencimento,
          MAX(data_quitacao) as max_criacao,
          COUNT(*) as total
        FROM caz_parcelas
      `);
      
      const clientesSimilares = await db.execute(sql`
        SELECT id, nome, cnpj, ids 
        FROM caz_clientes 
        WHERE LOWER(nome) LIKE '%feira%'
        ORDER BY nome
      `);
      
      const faturasRecentes = await db.execute(sql`
        SELECT id, cliente_id, cliente_nome, data_vencimento, total, status, descricao 
        FROM caz_receber 
        WHERE (LOWER(cliente_nome) LIKE '%feira%' OR LOWER(descricao) LIKE '%feira%')
          AND data_vencimento >= '2024-11-01'
        ORDER BY data_vencimento DESC
        LIMIT 20
      `);
      
      res.json({
        cliente: {
          id: cliente.id,
          nome: cliente.nome,
          cnpj: cliente.cnpj,
          ids: cliente.ids
        },
        parcelasCount: parcelasResult.rows.length,
        receberCount: receberResult.rows.length,
        parcelasJan2025: jan2025Result.rows,
        ultimasParcelas: parcelasResult.rows.slice(0, 10),
        ultimasReceber: receberResult.rows.slice(0, 10),
        statusTabelas: maxDatesResult.rows,
        clientesSimilares: clientesSimilares.rows,
        faturasRecentesFeira: faturasRecentes.rows
      });
    } catch (error) {
      console.error("[debug] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/debug-colaboradores-count", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores();
      res.json({ 
        total: colaboradores.length, 
        ativos: colaboradores.filter(c => c.status === 'Ativo').length,
        primeiros5: colaboradores.slice(0, 5).map(c => ({ id: c.id, nome: c.nome, status: c.status }))
      });
    } catch (error) {
      console.error("[debug] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/debug-patrimonio-mapping", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.numero_ativo,
          p.responsavel_atual,
          p.responsavel_id,
          p.descricao,
          c.id as colaborador_id,
          c.nome as colaborador_nome
        FROM rh_patrimonio p
        LEFT JOIN rh_pessoal c ON TRIM(c.nome) = TRIM(p.responsavel_atual)
        WHERE p.responsavel_atual IS NOT NULL AND p.responsavel_atual != ''
        ORDER BY p.numero_ativo::integer NULLS LAST
      `);
      
      const patrimonios = result.rows;
      const semMatch = patrimonios.filter((p: any) => !p.colaborador_id && !p.responsavel_id);
      const comMatch = patrimonios.filter((p: any) => p.colaborador_id || p.responsavel_id);
      
      res.json({
        total: patrimonios.length,
        comMatch: comMatch.length,
        semMatch: semMatch.length,
        patrimoniosSemMatch: semMatch,
        patrimoniosComMatch: comMatch
      });
    } catch (error) {
      console.error("[debug] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/debug-add-responsavel-id-column", async (req, res) => {
    try {
      await db.execute(sql`
        ALTER TABLE rh_patrimonio 
        ADD COLUMN IF NOT EXISTS responsavel_id INTEGER
      `);
      res.json({ success: true, message: "Coluna responsavel_id adicionada com sucesso" });
    } catch (error) {
      console.error("[debug] Error adding column:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/debug-backfill-responsavel-id", async (req, res) => {
    try {
      const result = await db.execute(sql`
        UPDATE rh_patrimonio p
        SET responsavel_id = c.id
        FROM rh_pessoal c
        WHERE TRIM(p.responsavel_atual) = TRIM(c.nome)
        AND p.responsavel_id IS NULL
        RETURNING p.id, p.numero_ativo, p.responsavel_atual, c.id as colaborador_id, c.nome
      `);
      res.json({ 
        success: true, 
        updated: result.rowCount,
        rows: result.rows
      });
    } catch (error) {
      console.error("[debug] Error backfilling:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/debug-set-responsavel-id", async (req, res) => {
    try {
      const { patrimonioId, colaboradorId } = req.body;
      if (!patrimonioId || !colaboradorId) {
        return res.status(400).json({ error: "patrimonioId e colaboradorId são obrigatórios" });
      }
      await db.execute(sql`
        UPDATE rh_patrimonio 
        SET responsavel_id = ${colaboradorId}
        WHERE id = ${patrimonioId}
      `);
      res.json({ success: true });
    } catch (error) {
      console.error("[debug] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/debug-patrimonios-sem-match", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.numero_ativo,
          p.responsavel_atual,
          p.responsavel_id
        FROM rh_patrimonio p
        WHERE p.responsavel_atual IS NOT NULL 
          AND p.responsavel_atual != ''
          AND p.responsavel_id IS NULL
        ORDER BY p.numero_ativo::integer NULLS LAST
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[debug] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/debug-colaboradores-busca", async (req, res) => {
    try {
      const { nome } = req.query;
      if (!nome) {
        return res.status(400).json({ error: "nome é obrigatório" });
      }
      const result = await db.execute(sql`
        SELECT id, nome
        FROM rh_pessoal
        WHERE LOWER(nome) LIKE LOWER(${'%' + nome + '%'})
        ORDER BY nome
        LIMIT 10
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[debug] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Debug route to explore tech tables structure
  app.get("/debug-tech-tables", async (req, res) => {
    try {
      // Get structure of cup_projetos_tech
      const projetosAtivos = await db.execute(sql`
        SELECT * FROM cup_projetos_tech LIMIT 5
      `);
      
      // Get structure of cup_projetos_tech_fechados
      const projetosFechados = await db.execute(sql`
        SELECT * FROM cup_projetos_tech_fechados LIMIT 5
      `);
      
      // Get structure of cup_tech_tasks
      const tasks = await db.execute(sql`
        SELECT * FROM cup_tech_tasks LIMIT 5
      `);
      
      // Get column info
      const columnsAtivos = projetosAtivos.rows.length > 0 ? Object.keys(projetosAtivos.rows[0] as object) : [];
      const columnsFechados = projetosFechados.rows.length > 0 ? Object.keys(projetosFechados.rows[0] as object) : [];
      const columnsTasks = tasks.rows.length > 0 ? Object.keys(tasks.rows[0] as object) : [];
      
      // Get counts
      const countAtivos = await db.execute(sql`SELECT COUNT(*) as count FROM cup_projetos_tech`);
      const countFechados = await db.execute(sql`SELECT COUNT(*) as count FROM cup_projetos_tech_fechados`);
      const countTasks = await db.execute(sql`SELECT COUNT(*) as count FROM cup_tech_tasks`);
      
      res.json({
        cup_projetos_tech: {
          columns: columnsAtivos,
          count: countAtivos.rows[0],
          sample: projetosAtivos.rows
        },
        cup_projetos_tech_fechados: {
          columns: columnsFechados,
          count: countFechados.rows[0],
          sample: projetosFechados.rows
        },
        cup_tech_tasks: {
          columns: columnsTasks,
          count: countTasks.rows[0],
          sample: tasks.rows
        }
      });
    } catch (error) {
      console.error("[debug] Error exploring tech tables:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/debug-smart-backfill", async (req, res) => {
    try {
      const patrimoniosResult = await db.execute(sql`
        SELECT id, numero_ativo, responsavel_atual
        FROM rh_patrimonio
        WHERE responsavel_atual IS NOT NULL 
          AND responsavel_atual != ''
          AND responsavel_id IS NULL
      `);
      
      const colaboradoresResult = await db.execute(sql`
        SELECT id, nome FROM rh_pessoal
      `);
      
      const colaboradores = colaboradoresResult.rows as { id: number; nome: string }[];
      const patrimonios = patrimoniosResult.rows as { id: number; numero_ativo: string; responsavel_atual: string }[];
      
      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      
      const updates: { patrimonioId: number; numeroAtivo: string; responsavelAtual: string; colaboradorId: number; colaboradorNome: string }[] = [];
      
      for (const p of patrimonios) {
        const respNorm = normalize(p.responsavel_atual);
        const palavras = respNorm.split(/\s+/).filter(w => w.length > 2);
        
        if (palavras.length < 2) continue;
        
        const primeiroNome = palavras[0];
        const ultimoNome = palavras[palavras.length - 1];
        
        let melhorMatch: { id: number; nome: string } | null = null;
        let melhorScore = 0;
        
        for (const c of colaboradores) {
          const colNorm = normalize(c.nome);
          const palavrasCol = colNorm.split(/\s+/).filter(w => w.length > 2);
          
          if (palavrasCol.length < 2) continue;
          
          const primNomeCol = palavrasCol[0];
          const ultNomeCol = palavrasCol[palavrasCol.length - 1];
          
          if (primeiroNome === primNomeCol && ultimoNome === ultNomeCol) {
            melhorMatch = c;
            melhorScore = 2;
            break;
          }
          
          if (primeiroNome === primNomeCol && melhorScore < 1) {
            melhorMatch = c;
            melhorScore = 1;
          }
        }
        
        if (melhorMatch && melhorScore >= 2) {
          await db.execute(sql`
            UPDATE rh_patrimonio SET responsavel_id = ${melhorMatch.id} WHERE id = ${p.id}
          `);
          updates.push({
            patrimonioId: p.id,
            numeroAtivo: p.numero_ativo,
            responsavelAtual: p.responsavel_atual,
            colaboradorId: melhorMatch.id,
            colaboradorNome: melhorMatch.nome
          });
        }
      }
      
      res.json({ 
        success: true, 
        updated: updates.length,
        matches: updates
      });
    } catch (error) {
      console.error("[debug] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Normalize CPF to 11-digit string
  const normalizeCpf = (cpf: string | null | undefined): string => {
    if (!cpf) return '';
    // Remove all non-digit characters
    const digits = cpf.replace(/\D/g, '');
    // Pad with leading zeros to ensure 11 digits
    return digits.padStart(11, '0');
  };

  app.use("/api", isAuthenticated);
  
  app.get("/api/debug/users", isAdmin, async (req, res) => {
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

  app.post("/api/users/:userId/permissions", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { allowedRoutes } = req.body;

      if (!Array.isArray(allowedRoutes)) {
        return res.status(400).json({ error: "allowedRoutes must be an array" });
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

  app.post("/api/users/:userId/role", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: "Role must be 'admin' or 'user'" });
      }

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

  app.post("/api/auth/users", isAdmin, async (req, res) => {
    try {
      const { name, email, role, allowedRoutes } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Email é obrigatório" });
      }

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
        }
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
      const cazClientesCount = await safeTableCount('caz_clientes');
      const cupClientesCount = await safeTableCount('cup_clientes');
      
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
      const cazReceberCount = await safeTableCount('caz_receber');
      const cupContratosCount = await safeTableCount('cup_contratos');
      
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
        FROM caz_receber
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
      
      await db.execute(sql`
        UPDATE cup_clientes
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
        UPDATE cup_clientes
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

  // GET /api/cliente/:cnpj/tasks - Fetch tasks for a client
  app.get("/api/cliente/:cnpj/tasks", async (req, res) => {
    try {
      const { cnpj } = req.params;
      
      // First get the client name from caz_clientes
      const clienteResult = await db.execute(sql`
        SELECT nome FROM caz_clientes WHERE cnpj = ${cnpj}
      `);
      
      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;
      
      // Query tasks from cup_tech_tasks, joining with cup_projetos_tech for project info
      // Tasks can be linked by cliente name or CNPJ in the project
      const tasksResult = await db.execute(sql`
        SELECT 
          t.id,
          t.name,
          t.status,
          t.priority,
          t.assignee,
          t.due_date,
          t.project_name,
          t.project_id,
          t.date_created,
          t.date_updated
        FROM cup_tech_tasks t
        LEFT JOIN cup_projetos_tech p ON t.project_id = p.id OR t.project_name = p.cliente
        WHERE 
          t.project_name ILIKE ${clienteNome ? `%${clienteNome}%` : '%NOMATCH%'}
          OR p.cliente ILIKE ${clienteNome ? `%${clienteNome}%` : '%NOMATCH%'}
          OR p.cnpj = ${cnpj}
        ORDER BY t.date_created DESC
        LIMIT 100
      `);
      
      res.json(tasksResult.rows);
    } catch (error) {
      console.error("[api] Error fetching client tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
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
      
      // Query both inadimplencia_contextos and juridico_clientes in parallel
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
          FROM inadimplencia_contextos 
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
        SELECT nome FROM caz_clientes WHERE cnpj = ${cnpj}
      `);
      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;

      // Get client status from cup_clientes
      const statusResult = await db.execute(sql`
        SELECT status FROM cup_clientes WHERE cnpj = ${cnpj}
      `);
      const clienteStatus = statusResult.rows.length > 0 ? (statusResult.rows[0] as any).status : null;

      
      if (clienteNome) {
        // Check for overdue payments (inadimplência)
        const overdueResult = await db.execute(sql`
          SELECT 
            COUNT(*) as count,
            SUM(COALESCE(nao_pago, 0)) as total
          FROM caz_parcelas
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
          FROM caz_parcelas
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
        FROM cup_contratos
        WHERE id_task IN (
          SELECT id_task FROM cup_contratos c2
          WHERE EXISTS (
            SELECT 1 FROM cup_clientes cl WHERE cl.cnpj = ${cnpj} AND cl.nome = c2.id_task
          )
          UNION
          SELECT task_id FROM cup_clientes WHERE cnpj = ${cnpj}
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
        SELECT nome FROM caz_clientes WHERE cnpj = ${cnpj}
      `);
      
      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;
      
      if (!clienteNome) {
        return res.json([]);
      }
      
      const today = new Date();
      const twelveMonthsAgo = new Date(today);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      // Query payments and contracts in parallel
      const [parcelasResult, contratosResult] = await Promise.all([
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
          FROM caz_parcelas
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
          FROM cup_contratos
          WHERE id_task IN (
            SELECT id_task FROM cup_contratos c2
            INNER JOIN cup_clientes cl ON cl.nome ILIKE ('%' || SPLIT_PART(c2.servico, ' - ', 1) || '%')
            WHERE cl.cnpj = ${cnpj}
          ) OR servico ILIKE ('%' || ${clienteNome} || '%')
          ORDER BY COALESCE(data_encerramento, data_inicio) DESC NULLS LAST
          LIMIT 30
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
      
      // Sort by date descending
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Limit to 50 events
      res.json(events.slice(0, 50));
    } catch (error) {
      console.error("[api] Error fetching client timeline:", error);
      res.status(500).json({ error: "Failed to fetch timeline" });
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

  app.get("/api/colaboradores/by-user/:userId", async (req, res) => {
    try {
      // Coluna user_id não existe na tabela - retornar 404
      return res.status(404).json({ error: "Colaborador não encontrado para este usuário" });
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
        FROM rh_pessoal c
        LEFT JOIN rh_patrimonio p ON (p.responsavel_id = c.id OR (p.responsavel_id IS NULL AND p.responsavel_atual = c.nome))
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
          FROM rh_promocoes 
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
          FROM auth_users
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
          FROM auth_users
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
        FROM cup_contratos 
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
      
      const { numeroAtivo, ativo, marca, estadoConservacao, descricao, valorPago, valorMercado, senhaAtivo } = req.body;
      
      const updateData: Record<string, string | null> = {};
      if (numeroAtivo !== undefined) updateData.numeroAtivo = numeroAtivo || null;
      if (ativo !== undefined) updateData.ativo = ativo || null;
      if (marca !== undefined) updateData.marca = marca || null;
      if (estadoConservacao !== undefined) updateData.estadoConservacao = estadoConservacao || null;
      if (descricao !== undefined) updateData.descricao = descricao || null;
      if (valorPago !== undefined) updateData.valorPago = valorPago || null;
      if (valorMercado !== undefined) updateData.valorMercado = valorMercado || null;
      if (senhaAtivo !== undefined) updateData.senhaAtivo = senhaAtivo || null;
      
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

  // ============ Telefones (Linhas Telefônicas) Endpoints ============
  app.get("/api/telefones", async (req, res) => {
    try {
      const telefones = await storage.getTelefones();
      res.json(telefones);
    } catch (error) {
      console.error("[api] Error fetching telefones:", error);
      res.status(500).json({ error: "Failed to fetch telefones" });
    }
  });

  app.get("/api/telefones/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid telefone ID" });
      }
      const telefone = await storage.getTelefoneById(id);
      if (!telefone) {
        return res.status(404).json({ error: "Telefone not found" });
      }
      res.json(telefone);
    } catch (error) {
      console.error("[api] Error fetching telefone by id:", error);
      res.status(500).json({ error: "Failed to fetch telefone" });
    }
  });

  app.patch("/api/telefones/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid telefone ID" });
      }
      
      const { responsavelNome, responsavelId, ultimaRecarga, status } = req.body;
      
      const updateData: Record<string, string | number | null> = {};
      if (responsavelNome !== undefined) updateData.responsavelNome = responsavelNome || null;
      if (responsavelId !== undefined) updateData.responsavelId = responsavelId || null;
      if (ultimaRecarga !== undefined) updateData.ultimaRecarga = ultimaRecarga || null;
      if (status !== undefined) updateData.status = status || null;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }
      
      const telefone = await storage.updateTelefone(id, updateData);
      res.json(telefone);
    } catch (error) {
      console.error("[api] Error updating telefone:", error);
      res.status(500).json({ error: "Failed to update telefone" });
    }
  });

  // ============ RH Cargos Endpoints ============
  // Default options when table is empty or doesn't exist
  const defaultCargos = [
    { id: 1, nome: "Gestor de Performance", descricao: null, ativo: "true" },
    { id: 2, nome: "Designer", descricao: null, ativo: "true" },
    { id: 3, nome: "Analista de Comunicação", descricao: null, ativo: "true" },
    { id: 4, nome: "CXCS", descricao: null, ativo: "true" },
    { id: 5, nome: "Desenvolvedor", descricao: null, ativo: "true" },
    { id: 6, nome: "PO", descricao: null, ativo: "true" },
    { id: 7, nome: "Copy", descricao: null, ativo: "true" },
    { id: 8, nome: "UIUX", descricao: null, ativo: "true" },
    { id: 9, nome: "Inside Sales", descricao: null, ativo: "true" },
    { id: 10, nome: "Pré-Vendas", descricao: null, ativo: "true" },
    { id: 11, nome: "Analista de Dados", descricao: null, ativo: "true" },
    { id: 12, nome: "Financeiro", descricao: null, ativo: "true" },
    { id: 13, nome: "G&G", descricao: null, ativo: "true" },
    { id: 14, nome: "C-Level", descricao: null, ativo: "true" },
    { id: 15, nome: "Videomaker", descricao: null, ativo: "true" },
    { id: 16, nome: "Líder de Squad", descricao: null, ativo: "true" },
    { id: 17, nome: "Jurídico", descricao: null, ativo: "true" },
  ];
  
  const defaultNiveis = [
    { id: 1, nome: "Estágio", ordem: 1, ativo: "true" },
    { id: 2, nome: "I", ordem: 2, ativo: "true" },
    { id: 3, nome: "II", ordem: 3, ativo: "true" },
    { id: 4, nome: "III", ordem: 4, ativo: "true" },
    { id: 5, nome: "IV", ordem: 5, ativo: "true" },
    { id: 6, nome: "V", ordem: 6, ativo: "true" },
    { id: 7, nome: "VI", ordem: 7, ativo: "true" },
    { id: 8, nome: "Gerente/Supervisor", ordem: 8, ativo: "true" },
    { id: 9, nome: "Diretor", ordem: 9, ativo: "true" },
  ];
  
  const defaultSquads = [
    { id: 1, nome: "💰 Vendas", descricao: null, ativo: "true" },
    { id: 2, nome: "🪖 Selva", descricao: null, ativo: "true" },
    { id: 3, nome: "⚓️ Squadra", descricao: null, ativo: "true" },
    { id: 4, nome: "💠 Pulse", descricao: null, ativo: "true" },
    { id: 5, nome: "👾 Squad X", descricao: null, ativo: "true" },
    { id: 6, nome: "🖥️ Tech", descricao: null, ativo: "true" },
    { id: 7, nome: "📊 CX&CS", descricao: null, ativo: "true" },
    { id: 8, nome: "🚀 Turbo Interno", descricao: null, ativo: "true" },
    { id: 9, nome: "⭐️ Ventures", descricao: null, ativo: "true" },
    { id: 10, nome: "🔥 Chama (OFF)", descricao: null, ativo: "true" },
    { id: 11, nome: "🏹 Hunters (OFF)", descricao: null, ativo: "true" },
    { id: 12, nome: "🧩 Fragmentados (OFF)", descricao: null, ativo: "true" },
    { id: 13, nome: "✨ Makers", descricao: null, ativo: "true" },
  ];

  app.get("/api/rh/cargos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, descricao, ativo, criado_em as "criadoEm"
        FROM rh_cargos 
        WHERE ativo = 'true' 
        ORDER BY nome
      `);
      // Return defaults if table is empty
      if (result.rows.length === 0) {
        return res.json(defaultCargos);
      }
      res.json(result.rows);
    } catch (error: any) {
      // Return default options if table doesn't exist
      if (error?.code === '42P01') {
        return res.json(defaultCargos);
      }
      console.error("[api] Error fetching cargos:", error);
      res.status(500).json({ error: "Failed to fetch cargos" });
    }
  });

  app.post("/api/rh/cargos", isAdmin, async (req, res) => {
    try {
      const validation = insertRhCargoSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { nome, descricao, ativo } = validation.data;
      const result = await db.execute(sql`
        INSERT INTO rh_cargos (nome, descricao, ativo)
        VALUES (${nome}, ${descricao || null}, ${ativo || 'true'})
        RETURNING id, nome, descricao, ativo, criado_em as "criadoEm"
      `);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating cargo:", error);
      res.status(500).json({ error: "Failed to create cargo" });
    }
  });

  app.delete("/api/rh/cargos/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid cargo ID" });
      }
      await db.execute(sql`
        UPDATE rh_cargos SET ativo = 'false' WHERE id = ${id}
      `);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting cargo:", error);
      res.status(500).json({ error: "Failed to delete cargo" });
    }
  });

  // ============ RH Níveis Endpoints ============
  app.get("/api/rh/niveis", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, ordem, ativo, criado_em as "criadoEm"
        FROM rh_niveis 
        WHERE ativo = 'true' 
        ORDER BY ordem, nome
      `);
      // Return defaults if table is empty
      if (result.rows.length === 0) {
        return res.json(defaultNiveis);
      }
      res.json(result.rows);
    } catch (error: any) {
      // Return default options if table doesn't exist
      if (error?.code === '42P01') {
        return res.json(defaultNiveis);
      }
      console.error("[api] Error fetching niveis:", error);
      res.status(500).json({ error: "Failed to fetch niveis" });
    }
  });

  app.post("/api/rh/niveis", isAdmin, async (req, res) => {
    try {
      const validation = insertRhNivelSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { nome, ordem, ativo } = validation.data;
      const result = await db.execute(sql`
        INSERT INTO rh_niveis (nome, ordem, ativo)
        VALUES (${nome}, ${ordem || 0}, ${ativo || 'true'})
        RETURNING id, nome, ordem, ativo, criado_em as "criadoEm"
      `);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating nivel:", error);
      res.status(500).json({ error: "Failed to create nivel" });
    }
  });

  app.delete("/api/rh/niveis/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid nivel ID" });
      }
      await db.execute(sql`
        UPDATE rh_niveis SET ativo = 'false' WHERE id = ${id}
      `);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting nivel:", error);
      res.status(500).json({ error: "Failed to delete nivel" });
    }
  });

  // ============ RH Squads Endpoints ============
  app.get("/api/rh/squads", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, descricao, ativo, criado_em as "criadoEm"
        FROM rh_squads 
        WHERE ativo = 'true' 
        ORDER BY nome
      `);
      // Return defaults if table is empty
      if (result.rows.length === 0) {
        return res.json(defaultSquads);
      }
      res.json(result.rows);
    } catch (error: any) {
      // Return default options if table doesn't exist
      if (error?.code === '42P01') {
        return res.json(defaultSquads);
      }
      console.error("[api] Error fetching squads:", error);
      res.status(500).json({ error: "Failed to fetch squads" });
    }
  });

  app.post("/api/rh/squads", isAdmin, async (req, res) => {
    try {
      const validation = insertRhSquadSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { nome, descricao, ativo } = validation.data;
      const result = await db.execute(sql`
        INSERT INTO rh_squads (nome, descricao, ativo)
        VALUES (${nome}, ${descricao || null}, ${ativo || 'true'})
        RETURNING id, nome, descricao, ativo, criado_em as "criadoEm"
      `);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating squad:", error);
      res.status(500).json({ error: "Failed to create squad" });
    }
  });

  app.delete("/api/rh/squads/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid squad ID" });
      }
      await db.execute(sql`
        UPDATE rh_squads SET ativo = 'false' WHERE id = ${id}
      `);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting squad:", error);
      res.status(500).json({ error: "Failed to delete squad" });
    }
  });

  // ============ Promoções Endpoints ============
  app.get("/api/colaboradores/:id/promocoes", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const result = await db.execute(sql`
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
        FROM rh_promocoes 
        WHERE colaborador_id = ${id}
        ORDER BY data_promocao DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching promocoes:", error);
      res.status(500).json({ error: "Failed to fetch promocoes" });
    }
  });

  app.post("/api/colaboradores/:id/promocoes", async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.id);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }
      const validation = insertRhPromocaoSchema.safeParse({ ...req.body, colaboradorId });
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { dataPromocao, cargoAnterior, cargoNovo, nivelAnterior, nivelNovo, salarioAnterior, salarioNovo, observacoes, criadoPor } = validation.data;
      
      // Insert the promotion record
      const result = await db.execute(sql`
        INSERT INTO rh_promocoes (colaborador_id, data_promocao, cargo_anterior, cargo_novo, nivel_anterior, nivel_novo, salario_anterior, salario_novo, observacoes, criado_por)
        VALUES (${colaboradorId}, ${dataPromocao}, ${cargoAnterior || null}, ${cargoNovo || null}, ${nivelAnterior || null}, ${nivelNovo || null}, ${salarioAnterior || null}, ${salarioNovo || null}, ${observacoes || null}, ${criadoPor || null})
        RETURNING 
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
      `);
      
      // Also update the colaborador with new values
      try {
        await db.execute(sql`
          UPDATE rh_pessoal 
          SET 
            cargo = COALESCE(${cargoNovo || null}, cargo),
            nivel = COALESCE(${nivelNovo || null}, nivel),
            salario = COALESCE(${salarioNovo || null}, salario),
            ultimo_aumento = ${dataPromocao}
          WHERE id = ${colaboradorId}
        `);
      } catch (updateError) {
        console.error("[api] Error updating colaborador after promotion:", updateError);
        // Don't fail the request if update fails
      }
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating promocao:", error);
      res.status(500).json({ error: "Failed to create promocao" });
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

  app.get("/api/fluxo-caixa/contas-bancos", async (req, res) => {
    try {
      const contas = await storage.getContasBancos();
      res.json(contas);
    } catch (error) {
      console.error("[api] Error fetching contas bancos:", error);
      res.status(500).json({ error: "Failed to fetch contas bancos" });
    }
  });

  app.get("/api/fluxo-caixa/diario-completo", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string;
      const dataFim = req.query.dataFim as string;
      
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: "dataInicio and dataFim are required" });
      }

      const fluxo = await storage.getFluxoCaixaDiarioCompleto(dataInicio, dataFim);
      res.json(fluxo);
    } catch (error) {
      console.error("[api] Error fetching fluxo caixa diario completo:", error);
      res.status(500).json({ error: "Failed to fetch fluxo caixa diario completo" });
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

  // Growth - Investment Data (Google Ads + Meta Ads)
  app.get("/api/growth/investimento", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-10-01';
      const endDate = req.query.endDate as string || '2025-11-30';
      const source = req.query.source as string || 'todos'; // todos, google, meta
      
      let googleTotal = { investimento: 0, impressions: 0, clicks: 0 };
      let metaTotal = { investimento: 0, impressions: 0, clicks: 0 };
      let googleDaily: any[] = [];
      let metaDaily: any[] = [];
      
      // Fetch Google Ads data if source is 'todos' or 'google'
      if (source === 'todos' || source === 'google') {
        try {
          // Check if google_ads schema exists
          const schemaCheck = await db.execute(sql`
            SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'google_ads'
          `);
          
          if (schemaCheck.rows.length > 0) {
            const columnsResult = await db.execute(sql`
              SELECT column_name FROM information_schema.columns 
              WHERE table_schema = 'google_ads' AND table_name = 'campaign_daily_metrics'
              ORDER BY ordinal_position
            `);
            
            const columns = columnsResult.rows.map((r: any) => r.column_name);
            console.log("[api] Google Ads columns:", columns);
            
            const dateColumn = columns.includes('report_date') ? 'report_date' :
                               columns.includes('metric_date') ? 'metric_date' : 
                               columns.includes('date') ? 'date' : 
                               columns.includes('segments_date') ? 'segments_date' : null;
            
            if (dateColumn && columns.includes('cost_micros')) {
              const googleResult = await db.execute(sql.raw(`
                SELECT 
                  COALESCE(SUM(cost_micros) / 1000000.0, 0) as total_investimento,
                  COALESCE(SUM(impressions), 0) as total_impressions,
                  COALESCE(SUM(clicks), 0) as total_clicks
                FROM google_ads.campaign_daily_metrics
                WHERE ${dateColumn} >= '${startDate}'::date AND ${dateColumn} <= '${endDate}'::date
              `));
              
              const googleDailyResult = await db.execute(sql.raw(`
                SELECT 
                  ${dateColumn} as date,
                  COALESCE(SUM(cost_micros) / 1000000.0, 0) as investimento,
                  COALESCE(SUM(impressions), 0) as impressions,
                  COALESCE(SUM(clicks), 0) as clicks
                FROM google_ads.campaign_daily_metrics
                WHERE ${dateColumn} >= '${startDate}'::date AND ${dateColumn} <= '${endDate}'::date
                GROUP BY ${dateColumn}
                ORDER BY ${dateColumn}
              `));
              
              const gTotals = googleResult.rows[0] || {};
              googleTotal = {
                investimento: parseFloat(gTotals.total_investimento as string) || 0,
                impressions: parseInt(gTotals.total_impressions as string) || 0,
                clicks: parseInt(gTotals.total_clicks as string) || 0
              };
              
              googleDaily = googleDailyResult.rows.map((row: any) => ({
                date: row.date,
                investimento: parseFloat(row.investimento) || 0,
                impressions: parseInt(row.impressions) || 0,
                clicks: parseInt(row.clicks) || 0,
                source: 'google'
              }));
            }
          }
        } catch (googleError) {
          console.log("[api] Google Ads query error (may not have data):", googleError);
        }
      }
      
      // Fetch Meta Ads data if source is 'todos' or 'meta'
      if (source === 'todos' || source === 'meta') {
        try {
          const metaResult = await db.execute(sql`
            SELECT 
              COALESCE(SUM(spend), 0) as total_investimento,
              COALESCE(SUM(impressions), 0) as total_impressions,
              COALESCE(SUM(clicks), 0) as total_clicks
            FROM meta_insights_daily
            WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
          `);
          
          const metaDailyResult = await db.execute(sql`
            SELECT 
              date_start as date,
              COALESCE(SUM(spend), 0) as investimento,
              COALESCE(SUM(impressions), 0) as impressions,
              COALESCE(SUM(clicks), 0) as clicks
            FROM meta_insights_daily
            WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
            GROUP BY date_start
            ORDER BY date_start
          `);
          
          const mTotals = metaResult.rows[0] || {};
          metaTotal = {
            investimento: parseFloat(mTotals.total_investimento as string) || 0,
            impressions: parseInt(mTotals.total_impressions as string) || 0,
            clicks: parseInt(mTotals.total_clicks as string) || 0
          };
          
          metaDaily = metaDailyResult.rows.map((row: any) => ({
            date: row.date,
            investimento: parseFloat(row.investimento) || 0,
            impressions: parseInt(row.impressions) || 0,
            clicks: parseInt(row.clicks) || 0,
            source: 'meta'
          }));
        } catch (metaError) {
          console.log("[api] Meta Ads query error:", metaError);
        }
      }
      
      // Combine totals
      const combinedTotal = {
        investimento: googleTotal.investimento + metaTotal.investimento,
        impressions: googleTotal.impressions + metaTotal.impressions,
        clicks: googleTotal.clicks + metaTotal.clicks
      };
      
      // Combine daily data by date
      const dailyMap = new Map<string, any>();
      
      [...googleDaily, ...metaDaily].forEach(item => {
        const dateKey = typeof item.date === 'string' ? item.date : format(new Date(item.date), 'yyyy-MM-dd');
        if (dailyMap.has(dateKey)) {
          const existing = dailyMap.get(dateKey);
          dailyMap.set(dateKey, {
            date: dateKey,
            investimento: existing.investimento + item.investimento,
            impressions: existing.impressions + item.impressions,
            clicks: existing.clicks + item.clicks,
            google: item.source === 'google' ? item.investimento : existing.google || 0,
            meta: item.source === 'meta' ? item.investimento : existing.meta || 0
          });
        } else {
          dailyMap.set(dateKey, {
            date: dateKey,
            investimento: item.investimento,
            impressions: item.impressions,
            clicks: item.clicks,
            google: item.source === 'google' ? item.investimento : 0,
            meta: item.source === 'meta' ? item.investimento : 0
          });
        }
      });
      
      const combinedDaily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      
      console.log("[api] Investment data - Google:", googleTotal.investimento, "Meta:", metaTotal.investimento, "Total:", combinedTotal.investimento);
      
      res.json({
        total: combinedTotal,
        bySource: {
          google: googleTotal,
          meta: metaTotal
        },
        daily: combinedDaily
      });
    } catch (error) {
      console.error("[api] Error fetching growth investimento:", error);
      res.status(500).json({ error: "Failed to fetch growth investimento" });
    }
  });

  // Growth Visão Geral - Cruza Meta/Google Ads com Bitrix (negócios ganhos via utm_content)
  app.get("/api/growth/visao-geral", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const canal = req.query.canal as string || 'Todos'; // Todos, Facebook, Google
      const tipoContrato = req.query.tipoContrato as string || 'Todos'; // Todos, Recorrente, Pontual
      
      // Validar formato de data para evitar SQL injection
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      let metaData: any[] = [];
      let googleData: any[] = [];
      
      // Buscar dados do Meta Ads se canal é Todos ou Facebook
      if (canal === 'Todos' || canal === 'Facebook') {
        const metaByAdResult = await db.execute(sql`
          SELECT 
            ad_id,
            SUM(spend::numeric) as investimento,
            SUM(impressions::numeric) as impressions,
            SUM(clicks::numeric) as clicks
          FROM meta_insights_daily
          WHERE date_start >= ${startDate}::date AND date_start <= ${endDate}::date
          GROUP BY ad_id
        `);
        metaData = metaByAdResult.rows as any[];
      }
      
      // Buscar dados do Google Ads se canal é Todos ou Google
      // Google Ads usa utm_campaign para relacionar com Bitrix (não utm_content)
      if (canal === 'Todos' || canal === 'Google') {
        try {
          const schemaCheck = await db.execute(sql`
            SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'google_ads'
          `);
          
          if (schemaCheck.rows.length > 0) {
            const tableCheck = await db.execute(sql`
              SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'google_ads' AND table_name = 'campaign_daily_metrics'
            `);
            
            if (tableCheck.rows.length > 0) {
              const columnsResult = await db.execute(sql`
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = 'google_ads' AND table_name = 'campaign_daily_metrics'
                ORDER BY ordinal_position
              `);
              
              const columns = columnsResult.rows.map((r: any) => r.column_name);
              const dateColumn = columns.includes('report_date') ? 'report_date' :
                                 columns.includes('metric_date') ? 'metric_date' : 
                                 columns.includes('date') ? 'date' : 
                                 columns.includes('segments_date') ? 'segments_date' : null;
              
              if (dateColumn && columns.includes('cost_micros')) {
                // Query com dados já validados (dateRegex garante formato seguro)
                const googleResult = await db.execute(sql`
                  SELECT 
                    campaign_id,
                    campaign_name,
                    COALESCE(SUM(cost_micros::numeric) / 1000000.0, 0) as investimento,
                    COALESCE(SUM(impressions::numeric), 0) as impressions,
                    COALESCE(SUM(clicks::numeric), 0) as clicks
                  FROM google_ads.campaign_daily_metrics
                  WHERE report_date >= ${startDate}::date AND report_date <= ${endDate}::date
                  GROUP BY campaign_id, campaign_name
                `);
                googleData = googleResult.rows as any[];
              }
            }
          }
        } catch (googleError) {
          console.log("[api] Google Ads query error (may not have data):", googleError);
        }
      }
      
      // Buscar negócios ganhos do Bitrix com utm_content e utm_campaign
      // utm_content é usado para Meta Ads, utm_campaign pode ser usado para Google Ads
      // Filtro por tipo de contrato: Recorrente (valor_recorrente > 0), Pontual (valor_pontual > 0)
      const tipoContratoFilter = tipoContrato === 'Recorrente' 
        ? sql`AND COALESCE(valor_recorrente, 0) > 0`
        : tipoContrato === 'Pontual'
        ? sql`AND COALESCE(valor_pontual, 0) > 0`
        : sql``;
      
      const dealsResult = await db.execute(sql`
        SELECT 
          utm_content,
          utm_campaign,
          utm_source,
          COUNT(DISTINCT id) as negocios_ganhos,
          SUM(COALESCE(valor_pontual, 0)) as valor_pontual_total,
          SUM(COALESCE(valor_recorrente, 0)) as valor_recorrente_total,
          SUM(COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)) as valor_total
        FROM crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
          AND (utm_content IS NOT NULL AND utm_content != '' OR utm_campaign IS NOT NULL AND utm_campaign != '')
          ${tipoContratoFilter}
        GROUP BY utm_content, utm_campaign, utm_source
      `);
      
      // Criar mapas de deals: um por utm_content (Meta) e outro por utm_campaign (Google)
      const dealsMapByContent = new Map<string, any>();
      const dealsMapByCampaign = new Map<string, any>();
      
      for (const row of dealsResult.rows as any[]) {
        const dealData = {
          negociosGanhos: parseInt(row.negocios_ganhos) || 0,
          valorPontual: parseFloat(row.valor_pontual_total) || 0,
          valorRecorrente: parseFloat(row.valor_recorrente_total) || 0,
          valorTotal: parseFloat(row.valor_total) || 0,
          source: row.utm_source
        };
        
        // Map por utm_content (para Meta Ads)
        if (row.utm_content) {
          const key = row.utm_content;
          if (dealsMapByContent.has(key)) {
            const existing = dealsMapByContent.get(key);
            existing.negociosGanhos += dealData.negociosGanhos;
            existing.valorPontual += dealData.valorPontual;
            existing.valorRecorrente += dealData.valorRecorrente;
            existing.valorTotal += dealData.valorTotal;
          } else {
            dealsMapByContent.set(key, { ...dealData });
          }
        }
        
        // Map por utm_campaign (para Google Ads)
        if (row.utm_campaign) {
          const key = row.utm_campaign;
          if (dealsMapByCampaign.has(key)) {
            const existing = dealsMapByCampaign.get(key);
            existing.negociosGanhos += dealData.negociosGanhos;
            existing.valorPontual += dealData.valorPontual;
            existing.valorRecorrente += dealData.valorRecorrente;
            existing.valorTotal += dealData.valorTotal;
          } else {
            dealsMapByCampaign.set(key, { ...dealData });
          }
        }
      }
      
      // Agregar dados combinando Ads com Deals
      let totalInvestimento = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalNegociosGanhos = 0;
      let totalValorPontual = 0;
      let totalValorRecorrente = 0;
      let totalValorVendas = 0;
      
      const adPerformance: any[] = [];
      
      // Processar Meta Ads (usa dealsMapByContent com utm_content = ad_id)
      for (const row of metaData) {
        const adId = row.ad_id;
        const investimento = parseFloat(row.investimento) || 0;
        const impressions = parseInt(row.impressions) || 0;
        const clicks = parseInt(row.clicks) || 0;
        
        const deal = dealsMapByContent.get(adId) || { negociosGanhos: 0, valorPontual: 0, valorRecorrente: 0, valorTotal: 0 };
        
        totalInvestimento += investimento;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalNegociosGanhos += deal.negociosGanhos;
        totalValorPontual += deal.valorPontual;
        totalValorRecorrente += deal.valorRecorrente;
        totalValorVendas += deal.valorTotal;
        
        adPerformance.push({
          adId,
          source: 'Meta',
          investimento,
          impressions,
          clicks,
          negociosGanhos: deal.negociosGanhos,
          valorVendas: deal.valorTotal,
          cac: deal.negociosGanhos > 0 ? investimento / deal.negociosGanhos : null,
          roi: investimento > 0 ? ((deal.valorTotal - investimento) / investimento) * 100 : null
        });
      }
      
      // Processar Google Ads (usa dealsMapByCampaign com utm_campaign = campaign_name)
      for (const row of googleData) {
        const campaignId = row.campaign_id;
        const campaignName = row.campaign_name;
        const investimento = parseFloat(row.investimento) || 0;
        const impressions = parseInt(row.impressions) || 0;
        const clicks = parseInt(row.clicks) || 0;
        
        // Tentar fazer match via campaign_name ou campaign_id com utm_campaign
        const deal = dealsMapByCampaign.get(campaignName) || 
                     dealsMapByCampaign.get(campaignId) || 
                     { negociosGanhos: 0, valorPontual: 0, valorRecorrente: 0, valorTotal: 0 };
        
        totalInvestimento += investimento;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalNegociosGanhos += deal.negociosGanhos;
        totalValorPontual += deal.valorPontual;
        totalValorRecorrente += deal.valorRecorrente;
        totalValorVendas += deal.valorTotal;
        
        adPerformance.push({
          adId: `google_${campaignId}`,
          name: campaignName,
          source: 'Google',
          investimento,
          impressions,
          clicks,
          negociosGanhos: deal.negociosGanhos,
          valorVendas: deal.valorTotal,
          cac: deal.negociosGanhos > 0 ? investimento / deal.negociosGanhos : null,
          roi: investimento > 0 ? ((deal.valorTotal - investimento) / investimento) * 100 : null
        });
      }
      
      // Construir filtro de canal para utm_source (para queries de totais)
      const canalFilterForDeals = canal === 'Facebook' 
        ? sql`AND (LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%' OR LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%')`
        : canal === 'Google'
        ? sql`AND (LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads' OR LOWER(utm_source) LIKE '%ads%')`
        : sql``;
      
      // Buscar totais gerais de deals (filtrado por canal se necessário)
      const totalDealsResult = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT id) as total_negocios,
          SUM(COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)) as valor_total
        FROM crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
          ${canalFilterForDeals}
      `);
      
      const totalDeals = totalDealsResult.rows[0] as any || {};
      const negociosTotaisReal = parseInt(totalDeals.total_negocios) || 0;
      const valorTotalReal = parseFloat(totalDeals.valor_total) || 0;
      
      // Calcular métricas gerais usando vendas atribuídas a ads (não todas as vendas)
      // ROI deve usar apenas vendas atribuídas via utm_content/utm_campaign aos anúncios
      const cac = totalNegociosGanhos > 0 ? totalInvestimento / totalNegociosGanhos : null;
      const roi = totalInvestimento > 0 ? ((totalValorVendas - totalInvestimento) / totalInvestimento) * 100 : null;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? totalInvestimento / totalClicks : null;
      
      // Buscar evolução diária de negócios ganhos (filtrado por canal se necessário)
      const dailyDealsResult = await db.execute(sql`
        SELECT 
          DATE(data_fechamento) as data,
          COUNT(DISTINCT id) as negocios,
          SUM(COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)) as valor
        FROM crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
          ${canalFilterForDeals}
        GROUP BY DATE(data_fechamento)
        ORDER BY DATE(data_fechamento)
      `);
      
      const dailyDeals = (dailyDealsResult.rows as any[]).map(row => ({
        data: row.data,
        negocios: parseInt(row.negocios) || 0,
        valor: parseFloat(row.valor) || 0
      }));
      
      console.log("[api] Growth Visão Geral - Canal:", canal, "Investimento:", totalInvestimento, "Negócios:", totalNegociosGanhos, "Valor:", totalValorVendas);
      
      // Buscar MQLs por canal por dia usando utm_source e coluna mql (coluna é text, comparar com '1')
      const mqlPorCanalDiaResult = await db.execute(sql`
        SELECT 
          DATE(created_at) as data,
          COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros') as canal,
          COUNT(*) as leads,
          SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls
        FROM crm_deal
        WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
        GROUP BY DATE(created_at), COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros')
        ORDER BY DATE(created_at), canal
      `);
      
      // Organizar dados por dia com breakdown por canal
      const mqlPorDia: Record<string, { data: string; canais: Record<string, { leads: number; mqls: number }> }> = {};
      
      for (const row of mqlPorCanalDiaResult.rows as any[]) {
        const dataStr = row.data?.toISOString?.().split('T')[0] || String(row.data);
        if (!mqlPorDia[dataStr]) {
          mqlPorDia[dataStr] = { data: dataStr, canais: {} };
        }
        const canalNome = String(row.canal || 'Outros');
        mqlPorDia[dataStr].canais[canalNome] = {
          leads: parseInt(row.leads) || 0,
          mqls: parseInt(row.mqls) || 0
        };
      }
      
      const mqlDiario = Object.values(mqlPorDia).sort((a, b) => a.data.localeCompare(b.data));
      
      // Construir filtro de canal para utm_source
      // Facebook: inclui variações como 'facebook', 'fb', 'meta', 'Facebook Ads', etc.
      // Google: inclui variações como 'google', 'Google', 'adwords', etc.
      const canalFilterSQL = canal === 'Facebook' 
        ? sql`AND (LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%' OR LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%')`
        : canal === 'Google'
        ? sql`AND (LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads' OR LOWER(utm_source) LIKE '%ads%')`
        : sql``;
      
      // Buscar totais de MQL/Leads por canal para o funil (coluna mql é text) com RM/RR stages
      // Vendas são filtradas por data_fechamento (quando o negócio foi ganho)
      const mqlTotaisPorCanalResult = await db.execute(sql`
        WITH leads_mqls AS (
          SELECT 
            COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros') as canal,
            COUNT(*) as leads,
            SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
            SUM(CASE WHEN stage_name IN ('Reunião Marcada', 'RM', 'Agendado') THEN 1 ELSE 0 END) as rm,
            SUM(CASE WHEN stage_name IN ('Reunião Realizada', 'RR', 'Realizado') THEN 1 ELSE 0 END) as rr
          FROM crm_deal
          WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
            ${canalFilterSQL}
          GROUP BY COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros')
        ),
        vendas AS (
          SELECT 
            COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros') as canal,
            COUNT(DISTINCT id) as vendas,
            SUM(COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0)) as valor_vendas
          FROM crm_deal
          WHERE stage_name = 'Negócio Ganho'
            AND data_fechamento >= ${startDate}::date AND data_fechamento <= ${endDate}::date
            ${canalFilterSQL}
          GROUP BY COALESCE(NULLIF(TRIM(utm_source), ''), 'Outros')
        )
        SELECT 
          COALESCE(lm.canal, v.canal) as canal,
          COALESCE(lm.leads, 0) as leads,
          COALESCE(lm.mqls, 0) as mqls,
          COALESCE(lm.rm, 0) as rm,
          COALESCE(lm.rr, 0) as rr,
          COALESCE(v.vendas, 0) as vendas,
          COALESCE(v.valor_vendas, 0) as valor_vendas
        FROM leads_mqls lm
        FULL OUTER JOIN vendas v ON lm.canal = v.canal
        ORDER BY COALESCE(lm.mqls, 0) DESC
      `);
      
      const mqlPorCanal = (mqlTotaisPorCanalResult.rows as any[]).map(row => {
        const leads = parseInt(row.leads) || 0;
        const mqls = parseInt(row.mqls) || 0;
        const rm = parseInt(row.rm) || 0;
        const rr = parseInt(row.rr) || 0;
        const vendas = parseInt(row.vendas) || 0;
        const valorVendas = parseFloat(row.valor_vendas) || 0;
        
        return {
          canal: String(row.canal || 'Outros'),
          leads,
          mqls,
          rm,
          rr,
          vendas,
          valorVendas,
          leadMql: leads > 0 ? Math.round((mqls / leads) * 100) : 0,
          mqlRm: mqls > 0 ? Math.round((rm / mqls) * 100) : 0,
          mqlRr: mqls > 0 ? Math.round((rr / mqls) * 100) : 0,
          txRrVenda: rr > 0 ? Math.round((vendas / rr) * 100) : 0,
          mqlVenda: mqls > 0 ? Math.round((vendas / mqls) * 100) : 0,
          tm: vendas > 0 ? Math.round(valorVendas / vendas) : 0
        };
      });
      
      // Calcular totais gerais de MQL
      const totalLeads = mqlPorCanal.reduce((sum, c) => sum + c.leads, 0);
      const totalMQLs = mqlPorCanal.reduce((sum, c) => sum + c.mqls, 0);
      const totalVendasMQL = mqlPorCanal.reduce((sum, c) => sum + c.vendas, 0);
      
      res.json({
        resumo: {
          investimento: totalInvestimento,
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr,
          cpc,
          negociosGanhos: totalNegociosGanhos,
          negociosTotais: parseInt(totalDeals.total_negocios) || 0,
          valorPontual: totalValorPontual,
          valorRecorrente: totalValorRecorrente,
          valorVendas: totalValorVendas,
          valorTotalGeral: parseFloat(totalDeals.valor_total) || 0,
          cac,
          roi,
          totalLeads,
          totalMQLs,
          totalVendasMQL,
          taxaConversaoMQL: totalLeads > 0 ? (totalMQLs / totalLeads) * 100 : 0,
          taxaVendaMQL: totalMQLs > 0 ? (totalVendasMQL / totalMQLs) * 100 : 0
        },
        porAd: adPerformance.sort((a, b) => b.investimento - a.investimento).slice(0, 20),
        evolucaoDiaria: dailyDeals,
        mqlDiario,
        mqlPorCanal
      });
    } catch (error) {
      console.error("[api] Error fetching growth visao geral:", error);
      res.status(500).json({ error: "Failed to fetch growth visao geral" });
    }
  });

  // Endpoint para buscar leads por canal (para o toggle de expansão)
  app.get("/api/growth/leads-por-canal", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const canal = req.query.canal as string;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Validar formato de data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      if (!canal) {
        return res.status(400).json({ error: "Canal parameter is required" });
      }
      
      // Construir filtro de canal para utm_source
      const canalFilterSQL = canal.toLowerCase() === 'facebook' 
        ? sql`AND (LOWER(utm_source) LIKE '%facebook%' OR LOWER(utm_source) LIKE '%fb%' OR LOWER(utm_source) LIKE '%meta%')`
        : canal.toLowerCase() === 'instagram'
        ? sql`AND (LOWER(utm_source) = 'ig' OR LOWER(utm_source) LIKE '%instagram%')`
        : canal.toLowerCase() === 'google'
        ? sql`AND (LOWER(utm_source) LIKE '%google%' OR LOWER(utm_source) LIKE '%adwords%' OR LOWER(utm_source) = 'gads')`
        : canal.toLowerCase() === 'outros'
        ? sql`AND (utm_source IS NULL OR TRIM(utm_source) = '' OR (
            LOWER(utm_source) NOT LIKE '%facebook%' AND 
            LOWER(utm_source) NOT LIKE '%fb%' AND 
            LOWER(utm_source) NOT LIKE '%meta%' AND
            LOWER(utm_source) NOT LIKE '%instagram%' AND
            LOWER(utm_source) != 'ig' AND
            LOWER(utm_source) NOT LIKE '%google%' AND 
            LOWER(utm_source) NOT LIKE '%adwords%' AND
            LOWER(utm_source) NOT LIKE '%linkedin%' AND
            LOWER(utm_source) NOT LIKE '%organico%' AND
            LOWER(utm_source) NOT LIKE '%orgânico%'
          ))`
        : sql`AND LOWER(utm_source) LIKE ${`%${canal.toLowerCase()}%`}`;
      
      const result = await db.execute(sql`
        SELECT 
          id,
          title,
          company_name,
          utm_source,
          utm_campaign,
          utm_content,
          stage_name,
          mql::text as mql,
          created_at,
          data_fechamento,
          COALESCE(valor_pontual, 0) as valor_pontual,
          COALESCE(valor_recorrente, 0) as valor_recorrente,
          COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) as valor_total
        FROM crm_deal
        WHERE created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
          ${canalFilterSQL}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      
      const leads = (result.rows as any[]).map(row => ({
        id: row.id,
        title: row.title,
        company: row.company_name,
        utmSource: row.utm_source,
        utmMedium: null,
        utmCampaign: row.utm_campaign,
        utmContent: row.utm_content,
        stage: row.stage_name,
        isMql: row.mql === '1' || row.mql?.toLowerCase() === 'true',
        createdAt: row.created_at,
        closedAt: row.data_fechamento,
        valorPontual: parseFloat(row.valor_pontual) || 0,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        valorTotal: parseFloat(row.valor_total) || 0
      }));
      
      res.json(leads);
    } catch (error) {
      console.error("[api] Error fetching leads por canal:", error);
      res.status(500).json({ error: "Failed to fetch leads por canal" });
    }
  });

  // Growth - Criativos - Listar campanhas disponíveis
  app.get("/api/growth/criativos/campanhas", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT c.campaign_id, c.campaign_name
        FROM meta_campaigns c
        WHERE c.campaign_name IS NOT NULL AND c.campaign_name != ''
        ORDER BY c.campaign_name
      `);
      
      const campanhas = (result.rows as any[]).map(row => ({
        id: row.campaign_id,
        name: row.campaign_name
      }));
      
      res.json(campanhas);
    } catch (error) {
      console.error("[api] Error fetching campanhas:", error);
      res.status(500).json({ error: "Failed to fetch campanhas" });
    }
  });
  
  // Growth - Criativos (dados agregados por anúncio do Meta Ads)
  app.get("/api/growth/criativos", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const status = req.query.status as string || 'Todos'; // Todos, Ativo, Pausado
      const plataforma = req.query.plataforma as string || 'Todos'; // Todos, Meta Ads, Google Ads, LinkedIn Ads
      const campanhaId = req.query.campanhaId as string || ''; // campaign_id filter
      
      // Validar formato de data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Por enquanto só temos dados do Meta Ads
      // Se plataforma for Google Ads ou LinkedIn Ads, retornar array vazio
      if (plataforma === 'Google Ads' || plataforma === 'LinkedIn Ads') {
        console.log("[api] Growth Criativos - Plataforma:", plataforma, "- sem dados disponíveis");
        return res.json([]);
      }
      
      // Buscar dados agregados por anúncio do Meta Ads com info do anúncio e campanha
      const adsDataResult = await db.execute(sql`
        SELECT 
          i.ad_id,
          a.ad_name,
          a.status as ad_status,
          a.created_time,
          a.preview_shareable_link as link,
          a.campaign_id,
          c.campaign_name,
          SUM(i.spend::numeric) as investimento,
          SUM(i.impressions) as impressions,
          SUM(i.clicks) as clicks,
          SUM(i.reach) as reach,
          AVG(i.ctr::numeric) as ctr,
          AVG(i.cpm::numeric) as cpm,
          SUM(i.video_play_actions) as video_plays,
          SUM(i.video_p25_watched_actions) as video_p25,
          SUM(i.video_p50_watched_actions) as video_p50,
          SUM(i.video_p75_watched_actions) as video_p75,
          SUM(i.video_p100_watched_actions) as video_p100
        FROM meta_insights_daily i
        LEFT JOIN meta_ads a ON i.ad_id = a.ad_id
        LEFT JOIN meta_campaigns c ON a.campaign_id = c.campaign_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
        GROUP BY i.ad_id, a.ad_name, a.status, a.created_time, a.preview_shareable_link, a.campaign_id, c.campaign_name
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados de conversão do CRM (leads, MQL, RM, RR, Vendas) usando utm_content = ad_id
      const dealsDataResult = await db.execute(sql`
        SELECT 
          utm_content as ad_id,
          COUNT(*) as leads,
          SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN stage_name IN ('Reunião Marcada', 'RM', 'Agendado', 'Reunião Agendada') THEN 1 ELSE 0 END) as rm,
          SUM(CASE WHEN stage_name IN ('Reunião Realizada', 'RR', 'Realizado') THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as vendas,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) ELSE 0 END) as valor_pontual,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_recorrente, 0) ELSE 0 END) as valor_recorrente,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) ELSE 0 END) as valor_total
        FROM crm_deal
        WHERE utm_content IS NOT NULL 
          AND utm_content != ''
          AND created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
        GROUP BY utm_content
      `);
      
      // Criar mapa de deals por ad_id
      const dealsMap = new Map<string, any>();
      for (const row of dealsDataResult.rows as any[]) {
        dealsMap.set(row.ad_id, {
          leads: parseInt(row.leads) || 0,
          mqls: parseInt(row.mqls) || 0,
          rm: parseInt(row.rm) || 0,
          rr: parseInt(row.rr) || 0,
          vendas: parseInt(row.vendas) || 0,
          valorPontual: parseFloat(row.valor_pontual) || 0,
          valorRecorrente: parseFloat(row.valor_recorrente) || 0,
          valorTotal: parseFloat(row.valor_total) || 0
        });
      }
      
      // Combinar dados de ads com deals
      const criativos = (adsDataResult.rows as any[])
        .map(row => {
          const adId = row.ad_id;
          const investimento = parseFloat(row.investimento) || 0;
          const impressions = parseInt(row.impressions) || 0;
          const clicks = parseInt(row.clicks) || 0;
          const reach = parseInt(row.reach) || 0;
          const videoPlays = parseInt(row.video_plays) || 0;
          const videoP25 = parseInt(row.video_p25) || 0;
          const videoP75 = parseInt(row.video_p75) || 0;
          
          const ctr = parseFloat(row.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : null);
          const cpm = parseFloat(row.cpm) || (impressions > 0 ? (investimento / impressions) * 1000 : null);
          
          // Frequência = impressões / alcance
          const frequency = reach > 0 ? impressions / reach : null;
          
          // Vídeo Hook = % de visualizações que passaram 3s (p25 / impressions ou videoPlays)
          const videoHook = impressions > 0 && videoP25 > 0 ? (videoP25 / impressions) * 100 : null;
          
          // Vídeo HOLD = % de quem passou 3s que viu 75% (p75 / p25)
          const videoHold = videoP25 > 0 && videoP75 > 0 ? (videoP75 / videoP25) * 100 : null;
          
          const deal = dealsMap.get(adId) || { leads: 0, mqls: 0, rm: 0, rr: 0, vendas: 0, valorPontual: 0, valorRecorrente: 0, valorTotal: 0 };
          
          const leads = deal.leads;
          const mqls = deal.mqls;
          const rm = deal.rm;
          const rr = deal.rr;
          const vendas = deal.vendas;
          
          // Calcular métricas derivadas
          const cpl = leads > 0 ? investimento / leads : null;
          const percMql = leads > 0 ? Math.round((mqls / leads) * 100) : null;
          const cpmql = mqls > 0 ? investimento / mqls : null;
          const percRa = leads > 0 ? Math.round((rm / leads) * 100) : null;
          const cpra = rm > 0 ? investimento / rm : null;
          const percRaMql = mqls > 0 ? Math.round((rm / mqls) * 100) : null;
          const percRrMql = mqls > 0 ? Math.round((rr / mqls) * 100) : null;
          const percRr = rm > 0 ? Math.round((rr / rm) * 100) : null;
          const cprr = rr > 0 ? investimento / rr : null;
          const percRrCliente = rr > 0 ? Math.round((vendas / rr) * 100) : null;
          const cacUnico = vendas > 0 ? investimento / vendas : null;
          
          // Determinar status
          let adStatus = row.ad_status || 'Desconhecido';
          if (adStatus.toUpperCase() === 'ACTIVE') adStatus = 'Ativo';
          else if (adStatus.toUpperCase() === 'PAUSED') adStatus = 'Pausado';
          
          return {
            id: adId,
            adName: row.ad_name || `Ad ${adId}`,
            link: row.link || `https://facebook.com/ads/library/?id=${adId}`,
            dataCriacao: row.created_time ? new Date(row.created_time).toLocaleDateString('pt-BR') : null,
            status: adStatus,
            plataforma: 'Meta Ads',
            campaignId: row.campaign_id || null,
            campaignName: row.campaign_name || null,
            investimento: Math.round(investimento),
            impressions,
            frequency: frequency ? parseFloat(frequency.toFixed(2)) : null,
            videoHook: videoHook ? parseFloat(videoHook.toFixed(2)) : null,
            videoHold: videoHold ? parseFloat(videoHold.toFixed(2)) : null,
            ctr: ctr ? parseFloat(ctr.toFixed(2)) : null,
            cpm: cpm ? Math.round(cpm) : null,
            leads,
            cpl: cpl ? Math.round(cpl) : null,
            mql: mqls,
            percMql,
            cpmql: cpmql ? parseFloat(cpmql.toFixed(2)) : null,
            ra: rm,
            percRa,
            cpra: cpra ? Math.round(cpra) : null,
            percRaMql,
            percRrMql,
            rr,
            percRr,
            cprr: cprr ? parseFloat(cprr.toFixed(2)) : null,
            ganhosAceleracao: deal.valorRecorrente > 0 ? vendas : null,
            ganhosPontuais: deal.valorPontual > 0 ? vendas : null,
            cacAceleracao: deal.valorRecorrente > 0 && vendas > 0 ? investimento / vendas : null,
            leadTimeClienteUnico: null,
            clientesUnicos: vendas,
            percRrCliente,
            cacUnico: cacUnico ? Math.round(cacUnico) : null
          };
        })
        .filter(c => {
          // Filtro por status
          if (status !== 'Todos') {
            if (status === 'Ativo' && c.status !== 'Ativo') return false;
            if (status === 'Pausado' && c.status !== 'Pausado') return false;
          }
          // Filtro por campanha
          if (campanhaId && c.campaignId !== campanhaId) return false;
          return true;
        });
      
      console.log("[api] Growth Criativos - Total:", criativos.length, "Status:", status);
      
      res.json(criativos);
    } catch (error) {
      console.error("[api] Error fetching growth criativos:", error);
      res.status(500).json({ error: "Failed to fetch growth criativos" });
    }
  });

  // Growth - Performance por Plataformas (dados hierárquicos: Plataforma > Campanha > Conjunto > Anúncio)
  app.get("/api/growth/performance-plataformas", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const status = req.query.status as string || 'Todos';
      
      // Validar formato de data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Buscar dados agregados por campanha do Meta Ads
      const campaignsDataResult = await db.execute(sql`
        SELECT 
          c.campaign_id,
          c.campaign_name,
          c.status as campaign_status,
          SUM(i.spend::numeric) as investimento,
          SUM(i.impressions) as impressions,
          SUM(i.clicks) as clicks,
          SUM(i.reach) as reach,
          AVG(i.ctr::numeric) as ctr,
          AVG(i.cpm::numeric) as cpm
        FROM meta_campaigns c
        LEFT JOIN meta_insights_daily i ON c.campaign_id = i.campaign_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
        GROUP BY c.campaign_id, c.campaign_name, c.status
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados agregados por adset do Meta Ads
      const adsetsDataResult = await db.execute(sql`
        SELECT 
          aset.adset_id,
          aset.adset_name,
          aset.campaign_id,
          aset.status as adset_status,
          SUM(i.spend::numeric) as investimento,
          SUM(i.impressions) as impressions,
          SUM(i.clicks) as clicks,
          SUM(i.reach) as reach,
          AVG(i.ctr::numeric) as ctr,
          AVG(i.cpm::numeric) as cpm
        FROM meta_adsets aset
        LEFT JOIN meta_insights_daily i ON aset.adset_id = i.adset_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
        GROUP BY aset.adset_id, aset.adset_name, aset.campaign_id, aset.status
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados agregados por anúncio do Meta Ads
      const adsDataResult = await db.execute(sql`
        SELECT 
          a.ad_id,
          a.ad_name,
          a.adset_id,
          a.campaign_id,
          a.status as ad_status,
          a.created_time,
          a.preview_shareable_link as link,
          SUM(i.spend::numeric) as investimento,
          SUM(i.impressions) as impressions,
          SUM(i.clicks) as clicks,
          SUM(i.reach) as reach,
          AVG(i.ctr::numeric) as ctr,
          AVG(i.cpm::numeric) as cpm
        FROM meta_ads a
        LEFT JOIN meta_insights_daily i ON a.ad_id = i.ad_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
        GROUP BY a.ad_id, a.ad_name, a.adset_id, a.campaign_id, a.status, a.created_time, a.preview_shareable_link
        ORDER BY SUM(i.spend::numeric) DESC
      `);
      
      // Buscar dados de conversão do CRM por ad_id
      const dealsDataResult = await db.execute(sql`
        SELECT 
          utm_content as ad_id,
          COUNT(*) as leads,
          SUM(CASE WHEN mql::text = '1' OR LOWER(mql::text) = 'true' THEN 1 ELSE 0 END) as mqls,
          SUM(CASE WHEN stage_name IN ('Reunião Marcada', 'RM', 'Agendado', 'Reunião Agendada') THEN 1 ELSE 0 END) as rm,
          SUM(CASE WHEN stage_name IN ('Reunião Realizada', 'RR', 'Realizado') THEN 1 ELSE 0 END) as rr,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as vendas,
          SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN COALESCE(valor_pontual, 0) + COALESCE(valor_recorrente, 0) ELSE 0 END) as valor_total
        FROM crm_deal
        WHERE utm_content IS NOT NULL 
          AND utm_content != ''
          AND created_at >= ${startDate}::date AND created_at <= ${endDate}::date + INTERVAL '1 day'
        GROUP BY utm_content
      `);
      
      // Criar mapa de deals por ad_id
      const dealsMap = new Map<string, any>();
      for (const row of dealsDataResult.rows as any[]) {
        dealsMap.set(row.ad_id, {
          leads: parseInt(row.leads) || 0,
          mqls: parseInt(row.mqls) || 0,
          rm: parseInt(row.rm) || 0,
          rr: parseInt(row.rr) || 0,
          vendas: parseInt(row.vendas) || 0,
          valorTotal: parseFloat(row.valor_total) || 0
        });
      }
      
      // Helper para calcular métricas derivadas
      const calcMetrics = (investimento: number, impressions: number, clicks: number, reach: number, ctr: number | null, cpm: number | null, deal: any) => {
        const leads = deal.leads;
        const mqls = deal.mqls;
        const rm = deal.rm;
        const rr = deal.rr;
        const vendas = deal.vendas;
        
        const frequency = reach > 0 ? impressions / reach : null;
        const cpl = leads > 0 ? investimento / leads : null;
        const percMql = leads > 0 ? Math.round((mqls / leads) * 100) : null;
        const cpmql = mqls > 0 ? investimento / mqls : null;
        const percRa = leads > 0 ? Math.round((rm / leads) * 100) : null;
        const cpra = rm > 0 ? investimento / rm : null;
        const percRaMql = mqls > 0 ? Math.round((rm / mqls) * 100) : null;
        const percRrMql = mqls > 0 ? Math.round((rr / mqls) * 100) : null;
        const percRr = rm > 0 ? Math.round((rr / rm) * 100) : null;
        const cprr = rr > 0 ? investimento / rr : null;
        const percRrCliente = rr > 0 ? Math.round((vendas / rr) * 100) : null;
        const cacUnico = vendas > 0 ? investimento / vendas : null;
        
        return {
          investimento: Math.round(investimento),
          impressions,
          frequency: frequency ? parseFloat(frequency.toFixed(2)) : null,
          ctr: ctr ? parseFloat((typeof ctr === 'number' ? ctr : 0).toFixed(2)) : null,
          cpm: cpm ? Math.round(typeof cpm === 'number' ? cpm : 0) : null,
          leads,
          cpl: cpl ? Math.round(cpl) : null,
          mql: mqls,
          percMql,
          cpmql: cpmql ? parseFloat(cpmql.toFixed(2)) : null,
          ra: rm,
          percRa,
          cpra: cpra ? Math.round(cpra) : null,
          percRaMql,
          percRrMql,
          rr,
          percRr,
          cprr: cprr ? parseFloat(cprr.toFixed(2)) : null,
          clientesUnicos: vendas,
          percRrCliente,
          cacUnico: cacUnico ? Math.round(cacUnico) : null
        };
      };
      
      // Processar anúncios
      const adsMap = new Map<string, any>();
      const adsByAdset = new Map<string, any[]>();
      
      for (const row of adsDataResult.rows as any[]) {
        const adId = row.ad_id;
        const adsetId = row.adset_id;
        const investimento = parseFloat(row.investimento) || 0;
        const impressions = parseInt(row.impressions) || 0;
        const clicks = parseInt(row.clicks) || 0;
        const reach = parseInt(row.reach) || 0;
        const ctr = parseFloat(row.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : null);
        const cpm = parseFloat(row.cpm) || (impressions > 0 ? (investimento / impressions) * 1000 : null);
        
        let adStatus = row.ad_status || 'Desconhecido';
        if (adStatus.toUpperCase() === 'ACTIVE') adStatus = 'Ativo';
        else if (adStatus.toUpperCase() === 'PAUSED') adStatus = 'Pausado';
        
        if (status !== 'Todos' && ((status === 'Ativo' && adStatus !== 'Ativo') || (status === 'Pausado' && adStatus !== 'Pausado'))) {
          continue;
        }
        
        const deal = dealsMap.get(adId) || { leads: 0, mqls: 0, rm: 0, rr: 0, vendas: 0, valorTotal: 0 };
        const metrics = calcMetrics(investimento, impressions, clicks, reach, ctr, cpm, deal);
        
        const adNode = {
          id: `ad_${adId}`,
          type: 'ad' as const,
          name: row.ad_name || `Ad ${adId}`,
          parentId: `adset_${adsetId}`,
          status: adStatus,
          link: row.link || `https://facebook.com/ads/library/?id=${adId}`,
          ...metrics
        };
        
        adsMap.set(adId, adNode);
        
        if (!adsByAdset.has(adsetId)) {
          adsByAdset.set(adsetId, []);
        }
        adsByAdset.get(adsetId)!.push(adNode);
      }
      
      // Processar adsets e agregar métricas dos anúncios
      const adsetsMap = new Map<string, any>();
      const adsetsByCampaign = new Map<string, any[]>();
      
      for (const row of adsetsDataResult.rows as any[]) {
        const adsetId = row.adset_id;
        const campaignId = row.campaign_id;
        const ads = adsByAdset.get(adsetId) || [];
        
        if (ads.length === 0 && status !== 'Todos') continue;
        
        // Agregar métricas dos anúncios
        let aggInvest = 0, aggImpr = 0, aggLeads = 0, aggMqls = 0, aggRm = 0, aggRr = 0, aggVendas = 0;
        for (const ad of ads) {
          aggInvest += ad.investimento || 0;
          aggImpr += ad.impressions || 0;
          aggLeads += ad.leads || 0;
          aggMqls += ad.mql || 0;
          aggRm += ad.ra || 0;
          aggRr += ad.rr || 0;
          aggVendas += ad.clientesUnicos || 0;
        }
        
        const deal = { leads: aggLeads, mqls: aggMqls, rm: aggRm, rr: aggRr, vendas: aggVendas, valorTotal: 0 };
        const metrics = calcMetrics(aggInvest, aggImpr, 0, 0, aggImpr > 0 ? null : null, null, deal);
        
        // Recalcular CTR e CPM com valores agregados
        metrics.ctr = aggImpr > 0 && ads.length > 0 ? parseFloat((ads.reduce((sum, a) => sum + (a.ctr || 0), 0) / ads.length).toFixed(2)) : null;
        metrics.cpm = aggInvest > 0 && aggImpr > 0 ? Math.round((aggInvest / aggImpr) * 1000) : null;
        
        let adsetStatus = row.adset_status || 'Desconhecido';
        if (adsetStatus.toUpperCase() === 'ACTIVE') adsetStatus = 'Ativo';
        else if (adsetStatus.toUpperCase() === 'PAUSED') adsetStatus = 'Pausado';
        
        const adsetNode = {
          id: `adset_${adsetId}`,
          type: 'adset' as const,
          name: row.adset_name || `Conjunto ${adsetId}`,
          parentId: `campaign_${campaignId}`,
          status: adsetStatus,
          childrenCount: ads.length,
          ...metrics
        };
        
        adsetsMap.set(adsetId, adsetNode);
        
        if (!adsetsByCampaign.has(campaignId)) {
          adsetsByCampaign.set(campaignId, []);
        }
        adsetsByCampaign.get(campaignId)!.push(adsetNode);
      }
      
      // Processar campanhas e agregar métricas dos adsets
      const campaignsMap = new Map<string, any>();
      const campaignsByPlatform = new Map<string, any[]>();
      
      for (const row of campaignsDataResult.rows as any[]) {
        const campaignId = row.campaign_id;
        const adsets = adsetsByCampaign.get(campaignId) || [];
        
        if (adsets.length === 0 && status !== 'Todos') continue;
        
        // Agregar métricas dos adsets
        let aggInvest = 0, aggImpr = 0, aggLeads = 0, aggMqls = 0, aggRm = 0, aggRr = 0, aggVendas = 0;
        for (const adset of adsets) {
          aggInvest += adset.investimento || 0;
          aggImpr += adset.impressions || 0;
          aggLeads += adset.leads || 0;
          aggMqls += adset.mql || 0;
          aggRm += adset.ra || 0;
          aggRr += adset.rr || 0;
          aggVendas += adset.clientesUnicos || 0;
        }
        
        const deal = { leads: aggLeads, mqls: aggMqls, rm: aggRm, rr: aggRr, vendas: aggVendas, valorTotal: 0 };
        const metrics = calcMetrics(aggInvest, aggImpr, 0, 0, null, null, deal);
        
        // Recalcular CTR e CPM com valores agregados
        metrics.ctr = aggImpr > 0 && adsets.length > 0 ? parseFloat((adsets.reduce((sum, a) => sum + (a.ctr || 0), 0) / adsets.length).toFixed(2)) : null;
        metrics.cpm = aggInvest > 0 && aggImpr > 0 ? Math.round((aggInvest / aggImpr) * 1000) : null;
        
        let campaignStatus = row.campaign_status || 'Desconhecido';
        if (campaignStatus.toUpperCase() === 'ACTIVE') campaignStatus = 'Ativo';
        else if (campaignStatus.toUpperCase() === 'PAUSED') campaignStatus = 'Pausado';
        
        const campaignNode = {
          id: `campaign_${campaignId}`,
          type: 'campaign' as const,
          name: row.campaign_name || `Campanha ${campaignId}`,
          parentId: 'platform_meta',
          status: campaignStatus,
          childrenCount: adsets.length,
          ...metrics
        };
        
        campaignsMap.set(campaignId, campaignNode);
        
        const platform = 'meta';
        if (!campaignsByPlatform.has(platform)) {
          campaignsByPlatform.set(platform, []);
        }
        campaignsByPlatform.get(platform)!.push(campaignNode);
      }
      
      // Criar nodes de plataformas
      const platforms = [];
      
      // Meta Ads
      const metaCampaigns = campaignsByPlatform.get('meta') || [];
      if (metaCampaigns.length > 0) {
        let aggInvest = 0, aggImpr = 0, aggLeads = 0, aggMqls = 0, aggRm = 0, aggRr = 0, aggVendas = 0;
        for (const camp of metaCampaigns) {
          aggInvest += camp.investimento || 0;
          aggImpr += camp.impressions || 0;
          aggLeads += camp.leads || 0;
          aggMqls += camp.mql || 0;
          aggRm += camp.ra || 0;
          aggRr += camp.rr || 0;
          aggVendas += camp.clientesUnicos || 0;
        }
        
        const deal = { leads: aggLeads, mqls: aggMqls, rm: aggRm, rr: aggRr, vendas: aggVendas, valorTotal: 0 };
        const metrics = calcMetrics(aggInvest, aggImpr, 0, 0, null, null, deal);
        metrics.ctr = aggImpr > 0 && metaCampaigns.length > 0 ? parseFloat((metaCampaigns.reduce((sum, c) => sum + (c.ctr || 0), 0) / metaCampaigns.length).toFixed(2)) : null;
        metrics.cpm = aggInvest > 0 && aggImpr > 0 ? Math.round((aggInvest / aggImpr) * 1000) : null;
        
        platforms.push({
          id: 'platform_meta',
          type: 'platform' as const,
          name: 'Meta Ads',
          parentId: null,
          status: 'Ativo',
          childrenCount: metaCampaigns.length,
          ...metrics
        });
      }
      
      // Google Ads - placeholder (sem dados reais por enquanto)
      platforms.push({
        id: 'platform_google',
        type: 'platform' as const,
        name: 'Google Ads',
        parentId: null,
        status: 'Ativo',
        childrenCount: 0,
        investimento: 0, impressions: 0, frequency: null, ctr: null, cpm: null,
        leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null,
        ra: 0, percRa: null, cpra: null, percRaMql: null, percRrMql: null,
        rr: 0, percRr: null, cprr: null,
        clientesUnicos: 0, percRrCliente: null, cacUnico: null
      });
      
      // LinkedIn Ads - placeholder
      platforms.push({
        id: 'platform_linkedin',
        type: 'platform' as const,
        name: 'LinkedIn Ads',
        parentId: null,
        status: 'Ativo',
        childrenCount: 0,
        investimento: 0, impressions: 0, frequency: null, ctr: null, cpm: null,
        leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null,
        ra: 0, percRa: null, cpra: null, percRaMql: null, percRrMql: null,
        rr: 0, percRr: null, cprr: null,
        clientesUnicos: 0, percRrCliente: null, cacUnico: null
      });
      
      // TikTok Ads - placeholder
      platforms.push({
        id: 'platform_tiktok',
        type: 'platform' as const,
        name: 'TikTok Ads',
        parentId: null,
        status: 'Ativo',
        childrenCount: 0,
        investimento: 0, impressions: 0, frequency: null, ctr: null, cpm: null,
        leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null,
        ra: 0, percRa: null, cpra: null, percRaMql: null, percRrMql: null,
        rr: 0, percRr: null, cprr: null,
        clientesUnicos: 0, percRrCliente: null, cacUnico: null
      });
      
      // Montar lista flat de todos os nodes
      const nodes = [
        ...platforms,
        ...Array.from(campaignsMap.values()),
        ...Array.from(adsetsMap.values()),
        ...Array.from(adsMap.values())
      ];
      
      console.log("[api] Growth Performance Plataformas - Platforms:", platforms.length, "Campaigns:", campaignsMap.size, "Adsets:", adsetsMap.size, "Ads:", adsMap.size);
      
      res.json(nodes);
    } catch (error) {
      console.error("[api] Error fetching growth performance plataformas:", error);
      res.status(500).json({ error: "Failed to fetch growth performance plataformas" });
    }
  });

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

  // ============== INADIMPLÊNCIA ==============
  
  app.get("/api/inadimplencia/resumo", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const resumo = await storage.getInadimplenciaResumo(dataInicio, dataFim);
      res.json(resumo);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia resumo:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia resumo" });
    }
  });

  app.get("/api/inadimplencia/clientes", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const ordenarPor = (req.query.ordenarPor as 'valor' | 'diasAtraso' | 'nome') || 'valor';
      const limite = parseInt(req.query.limite as string) || 100;
      const clientes = await storage.getInadimplenciaClientes(dataInicio, dataFim, ordenarPor, limite);
      res.json(clientes);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia clientes:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia clientes" });
    }
  });

  app.get("/api/inadimplencia/cliente/:idCliente/parcelas", async (req, res) => {
    try {
      const idCliente = req.params.idCliente;
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const parcelas = await storage.getInadimplenciaDetalheParcelas(idCliente, dataInicio, dataFim);
      res.json(parcelas);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia parcelas:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia parcelas" });
    }
  });

  app.get("/api/inadimplencia/por-empresa", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const empresas = await storage.getInadimplenciaPorEmpresa(dataInicio, dataFim);
      res.json(empresas);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia por empresa:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia por empresa" });
    }
  });

  app.get("/api/inadimplencia/por-metodo-pagamento", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const metodos = await storage.getInadimplenciaPorMetodoPagamento(dataInicio, dataFim);
      res.json(metodos);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia por metodo pagamento:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia por metodo pagamento" });
    }
  });

  app.get("/api/inadimplencia/relatorio-pdf", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const apenasAtivos = req.query.apenasAtivos === 'true';
      
      const clientesData = await storage.getInadimplenciaClientes(dataInicio, dataFim, 'valor', 500);
      
      let clientes = clientesData.clientes;
      if (apenasAtivos) {
        clientes = clientes.filter(c => {
          if (!c.statusClickup) return false;
          const statusLower = c.statusClickup.toLowerCase();
          return statusLower.includes('ativo') && 
                 !statusLower.includes('inativo') && 
                 !statusLower.includes('cancelado') &&
                 !statusLower.includes('cancelamento') &&
                 !statusLower.includes('churn') &&
                 !statusLower.includes('encerrado');
        });
      }
      
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4',
        layout: 'landscape'
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-inadimplencia-${new Date().toISOString().split('T')[0]}.pdf`);
      
      doc.pipe(res);
      
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      
      doc.fontSize(18).fillColor('#1e293b').text('Relatório de Inadimplência', { align: 'center' });
      doc.moveDown(0.3);
      
      const dataHoje = new Date().toLocaleDateString('pt-BR');
      doc.fontSize(10).fillColor('#64748b').text(`Gerado em: ${dataHoje}`, { align: 'center' });
      if (apenasAtivos) {
        doc.text('Filtro: Apenas clientes ATIVOS no ClickUp', { align: 'center' });
      }
      doc.moveDown();
      
      const totalValor = clientes.reduce((acc, c) => acc + c.valorTotal, 0);
      const totalParcelas = clientes.reduce((acc, c) => acc + c.quantidadeParcelas, 0);
      
      doc.fontSize(11).fillColor('#1e293b');
      doc.text(`Total de Clientes: ${clientes.length}`, 40);
      doc.text(`Total de Parcelas em Atraso: ${totalParcelas}`, 40);
      doc.text(`Valor Total Inadimplente: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValor)}`, 40);
      doc.moveDown();
      
      doc.moveTo(40, doc.y).lineTo(pageWidth + 40, doc.y).stroke('#e2e8f0');
      doc.moveDown(0.5);
      
      const colWidths = {
        cliente: 180,
        valor: 90,
        parcelas: 60,
        diasAtraso: 70,
        status: 100,
        responsavel: 120,
        empresa: 100
      };
      
      const headerY = doc.y;
      doc.fontSize(9).fillColor('#475569').font('Helvetica-Bold');
      let xPos = 40;
      doc.text('Cliente', xPos, headerY, { width: colWidths.cliente });
      xPos += colWidths.cliente;
      doc.text('Valor', xPos, headerY, { width: colWidths.valor, align: 'right' });
      xPos += colWidths.valor;
      doc.text('Parcelas', xPos, headerY, { width: colWidths.parcelas, align: 'center' });
      xPos += colWidths.parcelas;
      doc.text('Dias Atraso', xPos, headerY, { width: colWidths.diasAtraso, align: 'center' });
      xPos += colWidths.diasAtraso;
      doc.text('Status', xPos, headerY, { width: colWidths.status });
      xPos += colWidths.status;
      doc.text('Responsável', xPos, headerY, { width: colWidths.responsavel });
      xPos += colWidths.responsavel;
      doc.text('Empresa', xPos, headerY, { width: colWidths.empresa });
      
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(pageWidth + 40, doc.y).stroke('#e2e8f0');
      doc.moveDown(0.3);
      
      doc.font('Helvetica').fontSize(8).fillColor('#334155');
      
      for (const cliente of clientes) {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
          doc.fontSize(8).fillColor('#334155');
        }
        
        const rowY = doc.y;
        xPos = 40;
        
        const nomeCliente = cliente.nomeCliente.length > 35 
          ? cliente.nomeCliente.substring(0, 35) + '...' 
          : cliente.nomeCliente;
        doc.text(nomeCliente, xPos, rowY, { width: colWidths.cliente });
        xPos += colWidths.cliente;
        
        const valorFormatado = new Intl.NumberFormat('pt-BR', { 
          style: 'currency', 
          currency: 'BRL',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(cliente.valorTotal);
        doc.fillColor('#dc2626').text(valorFormatado, xPos, rowY, { width: colWidths.valor, align: 'right' });
        xPos += colWidths.valor;
        
        doc.fillColor('#334155').text(String(cliente.quantidadeParcelas), xPos, rowY, { width: colWidths.parcelas, align: 'center' });
        xPos += colWidths.parcelas;
        
        doc.text(`${cliente.diasAtrasoMax}d`, xPos, rowY, { width: colWidths.diasAtraso, align: 'center' });
        xPos += colWidths.diasAtraso;
        
        const status = cliente.statusClickup || '-';
        const statusTruncado = status.length > 18 ? status.substring(0, 18) + '...' : status;
        doc.text(statusTruncado, xPos, rowY, { width: colWidths.status });
        xPos += colWidths.status;
        
        const responsavel = cliente.responsavel || '-';
        const responsavelTruncado = responsavel.length > 20 ? responsavel.substring(0, 20) + '...' : responsavel;
        doc.text(responsavelTruncado, xPos, rowY, { width: colWidths.responsavel });
        xPos += colWidths.responsavel;
        
        const empresa = cliente.empresa || '-';
        const empresaTruncada = empresa.length > 15 ? empresa.substring(0, 15) + '...' : empresa;
        doc.text(empresaTruncada, xPos, rowY, { width: colWidths.empresa });
        
        doc.moveDown(0.6);
      }
      
      doc.end();
      
    } catch (error) {
      console.error("[api] Error generating inadimplencia PDF report:", error);
      res.status(500).json({ error: "Failed to generate PDF report" });
    }
  });

  // Relatório PDF de clientes com Contexto CS = "Cobrar"
  app.get("/api/inadimplencia/relatorio-cobranca-pdf", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      
      // 1. Buscar todos os clientes
      const clientesData = await storage.getInadimplenciaClientes(dataInicio, dataFim, 'valor', 500);
      
      // 2. Buscar todos os contextos
      const ids = clientesData.clientes.map(c => c.idCliente);
      const contextos = await storage.getInadimplenciaContextos(ids);
      
      // 3. Filtrar clientes onde acao = 'cobrar'
      const clientesCobrar = clientesData.clientes.filter(c => 
        contextos[c.idCliente]?.acao === 'cobrar'
      );
      
      if (clientesCobrar.length === 0) {
        return res.status(404).json({ error: "Nenhum cliente com ação 'Cobrar' encontrado" });
      }
      
      // 4. Para cada cliente, buscar as parcelas
      const clientesComParcelas: Array<{
        cliente: typeof clientesCobrar[0];
        contexto: typeof contextos[string];
        parcelas: Array<{
          id: number;
          descricao: string;
          valorBruto: number;
          naoPago: number;
          dataVencimento: string;
          diasAtraso: number;
          empresa: string;
          status: string;
          urlCobranca: string | null;
        }>;
      }> = [];
      
      for (const cliente of clientesCobrar) {
        const parcelasData = await storage.getInadimplenciaDetalheParcelas(cliente.idCliente, dataInicio, dataFim);
        clientesComParcelas.push({
          cliente,
          contexto: contextos[cliente.idCliente],
          parcelas: parcelasData.parcelas.map(p => ({
            ...p,
            dataVencimento: p.dataVencimento instanceof Date ? p.dataVencimento.toISOString() : String(p.dataVencimento)
          }))
        });
      }
      
      // 5. Gerar PDF
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4',
        layout: 'portrait'
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-cobranca-${new Date().toISOString().split('T')[0]}.pdf`);
      
      doc.pipe(res);
      
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const marginLeft = 40;
      const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
      
      // ==================== CAPA / HEADER ====================
      doc.rect(0, 0, doc.page.width, 120).fill('#1e293b');
      doc.fontSize(24).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('RELATÓRIO DE COBRANÇA', marginLeft, 35, { align: 'center' });
      doc.fontSize(14).fillColor('#fbbf24').font('Helvetica');
      doc.text('Clientes com Ação: COBRAR', marginLeft, 70, { align: 'center' });
      
      const dataHoje = new Date().toLocaleDateString('pt-BR');
      doc.fontSize(10).fillColor('#94a3b8');
      doc.text(`Gerado em: ${dataHoje}`, marginLeft, 95, { align: 'center' });
      
      doc.y = 140;
      
      // ==================== RESUMO GERAL ====================
      const totalValor = clientesCobrar.reduce((acc, c) => acc + c.valorTotal, 0);
      const totalParcelas = clientesCobrar.reduce((acc, c) => acc + c.quantidadeParcelas, 0);
      
      // Box de resumo
      const resumoY = doc.y;
      doc.rect(marginLeft, resumoY, pageWidth, 60).fill('#f8fafc').stroke('#e2e8f0');
      
      const boxWidth = pageWidth / 3;
      
      // Clientes
      doc.fontSize(10).fillColor('#64748b').font('Helvetica');
      doc.text('CLIENTES A COBRAR', marginLeft + 10, resumoY + 10);
      doc.fontSize(20).fillColor('#1e293b').font('Helvetica-Bold');
      doc.text(`${clientesCobrar.length}`, marginLeft + 10, resumoY + 28);
      
      // Parcelas
      doc.fontSize(10).fillColor('#64748b').font('Helvetica');
      doc.text('PARCELAS EM ATRASO', marginLeft + boxWidth + 10, resumoY + 10);
      doc.fontSize(20).fillColor('#1e293b').font('Helvetica-Bold');
      doc.text(`${totalParcelas}`, marginLeft + boxWidth + 10, resumoY + 28);
      
      // Valor Total
      doc.fontSize(10).fillColor('#64748b').font('Helvetica');
      doc.text('VALOR TOTAL', marginLeft + (boxWidth * 2) + 10, resumoY + 10);
      doc.fontSize(18).fillColor('#dc2626').font('Helvetica-Bold');
      doc.text(formatCurrency(totalValor), marginLeft + (boxWidth * 2) + 10, resumoY + 28);
      
      doc.y = resumoY + 80;
      
      // ==================== LISTA DE CLIENTES ====================
      for (let i = 0; i < clientesComParcelas.length; i++) {
        const { cliente, contexto, parcelas } = clientesComParcelas[i];
        
        // Verificar se precisa de nova página
        if (doc.y > doc.page.height - 220) {
          doc.addPage();
        }
        
        const cardY = doc.y;
        
        // ---- HEADER DO CLIENTE (barra colorida) ----
        doc.rect(marginLeft, cardY, pageWidth, 28).fill('#1e293b');
        doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text(`${i + 1}. ${cliente.nomeCliente}`, marginLeft + 10, cardY + 8);
        
        // Valor em destaque no header
        doc.fontSize(11).fillColor('#fbbf24');
        doc.text(formatCurrency(cliente.valorTotal), marginLeft + pageWidth - 120, cardY + 8, { width: 110, align: 'right' });
        
        doc.y = cardY + 32;
        
        // ---- INFORMAÇÕES EM DUAS COLUNAS ----
        const infoStartY = doc.y;
        const colWidth = (pageWidth - 20) / 2;
        
        // Coluna 1: Dados de Contato e Empresa
        doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold');
        doc.text('CONTATO E EMPRESA', marginLeft + 5, infoStartY);
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.y = infoStartY + 14;
        
        doc.text(`Telefone: `, marginLeft + 5, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#1e293b').text(cliente.telefone || 'Não informado');
        doc.font('Helvetica').fillColor('#475569');
        
        doc.text(`Empresa: ${cliente.empresa || '-'}`, marginLeft + 5);
        if (cliente.cnpj) {
          doc.text(`CNPJ: ${cliente.cnpj}`, marginLeft + 5);
        }
        doc.text(`Responsável: ${cliente.responsavel || '-'}`, marginLeft + 5);
        
        const col1EndY = doc.y;
        
        // Coluna 2: Status e Serviços
        doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold');
        doc.text('STATUS E SERVIÇOS', marginLeft + colWidth + 15, infoStartY);
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.y = infoStartY + 14;
        
        doc.text(`Status ClickUp: ${cliente.statusClickup || '-'}`, marginLeft + colWidth + 15, doc.y);
        doc.text(`Cluster: ${cliente.cluster || '-'}`, marginLeft + colWidth + 15);
        doc.text(`Serviços: ${cliente.servicos || '-'}`, marginLeft + colWidth + 15);
        
        const col2EndY = doc.y;
        doc.y = Math.max(col1EndY, col2EndY) + 8;
        
        // ---- MÉTRICAS DE ATRASO ----
        const metricsY = doc.y;
        doc.rect(marginLeft, metricsY, pageWidth, 22).fill('#fef2f2');
        
        doc.fontSize(8).fillColor('#991b1b').font('Helvetica-Bold');
        doc.text(`${cliente.quantidadeParcelas} parcelas em atraso`, marginLeft + 10, metricsY + 6);
        doc.text(`Atraso máximo: ${cliente.diasAtrasoMax} dias`, marginLeft + 150, metricsY + 6);
        doc.text(`Parcela mais antiga: ${cliente.parcelaMaisAntiga ? new Date(cliente.parcelaMaisAntiga).toLocaleDateString('pt-BR') : '-'}`, marginLeft + 300, metricsY + 6);
        
        doc.y = metricsY + 28;
        
        // ---- CONTEXTO CS (se houver) ----
        if (contexto && (contexto.contexto || contexto.evidencias || contexto.statusFinanceiro || contexto.detalheFinanceiro)) {
          const ctxY = doc.y;
          doc.rect(marginLeft, ctxY, pageWidth, 2).fill('#3b82f6');
          doc.y = ctxY + 6;
          
          doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold');
          doc.text('CONTEXTO CS', marginLeft + 5, doc.y);
          doc.moveDown(0.3);
          
          doc.font('Helvetica').fontSize(8).fillColor('#475569');
          
          if (contexto.contexto) {
            doc.text(`${contexto.contexto}`, marginLeft + 5, doc.y, { width: pageWidth - 10 });
          }
          if (contexto.evidencias) {
            doc.text(`Evidências: ${contexto.evidencias}`, marginLeft + 5, doc.y, { width: pageWidth - 10 });
          }
          if (contexto.statusFinanceiro) {
            const statusLabel = contexto.statusFinanceiro === 'cobrado' ? 'Cobrado' : 
                               contexto.statusFinanceiro === 'acordo_realizado' ? 'Acordo Realizado' : 
                               contexto.statusFinanceiro === 'juridico' ? 'Jurídico' : '-';
            doc.font('Helvetica-Bold').fillColor('#1e293b');
            doc.text(`Status Financeiro: ${statusLabel}`, marginLeft + 5);
            doc.font('Helvetica').fillColor('#475569');
          }
          if (contexto.detalheFinanceiro) {
            doc.text(`Detalhe: ${contexto.detalheFinanceiro}`, marginLeft + 5, doc.y, { width: pageWidth - 10 });
          }
          if (contexto.atualizadoPor) {
            doc.fontSize(7).fillColor('#94a3b8');
            doc.text(`Atualizado por: ${contexto.atualizadoPor} em ${contexto.atualizadoEm ? new Date(contexto.atualizadoEm).toLocaleDateString('pt-BR') : '-'}`, marginLeft + 5);
          }
          doc.moveDown(0.3);
        }
        
        // ---- TABELA DE PARCELAS ----
        if (parcelas.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold');
          doc.text('PARCELAS EM ATRASO', marginLeft + 5, doc.y);
          doc.moveDown(0.3);
          
          // Header da tabela
          const colWidths = { desc: 200, valor: 80, venc: 75, dias: 45, link: 110 };
          const tableX = marginLeft;
          let tableY = doc.y;
          
          // Background do header
          doc.rect(tableX, tableY - 2, pageWidth, 14).fill('#f1f5f9');
          
          doc.fontSize(7).fillColor('#475569').font('Helvetica-Bold');
          doc.text('Descrição', tableX + 5, tableY + 2);
          doc.text('Valor', tableX + colWidths.desc, tableY + 2, { width: colWidths.valor, align: 'right' });
          doc.text('Vencimento', tableX + colWidths.desc + colWidths.valor + 5, tableY + 2);
          doc.text('Atraso', tableX + colWidths.desc + colWidths.valor + colWidths.venc + 5, tableY + 2);
          doc.text('Link', tableX + colWidths.desc + colWidths.valor + colWidths.venc + colWidths.dias + 5, tableY + 2);
          
          doc.y = tableY + 16;
          
          doc.font('Helvetica').fontSize(7).fillColor('#334155');
          
          for (let j = 0; j < parcelas.length; j++) {
            const parcela = parcelas[j];
            
            if (doc.y > doc.page.height - 50) {
              doc.addPage();
              doc.fontSize(7).fillColor('#334155');
            }
            
            tableY = doc.y;
            
            // Zebra striping
            if (j % 2 === 1) {
              doc.rect(tableX, tableY - 1, pageWidth, 12).fill('#fafafa');
              doc.fillColor('#334155');
            }
            
            const descTruncada = parcela.descricao.length > 40 ? parcela.descricao.substring(0, 40) + '...' : parcela.descricao;
            doc.text(descTruncada, tableX + 5, tableY + 1, { width: colWidths.desc - 10 });
            doc.fillColor('#dc2626').font('Helvetica-Bold');
            doc.text(formatCurrency(parcela.naoPago), tableX + colWidths.desc, tableY + 1, { width: colWidths.valor, align: 'right' });
            doc.fillColor('#334155').font('Helvetica');
            const dataVenc = parcela.dataVencimento ? new Date(parcela.dataVencimento).toLocaleDateString('pt-BR') : '-';
            doc.text(dataVenc, tableX + colWidths.desc + colWidths.valor + 5, tableY + 1);
            doc.fillColor('#991b1b');
            doc.text(`${parcela.diasAtraso} dias`, tableX + colWidths.desc + colWidths.valor + colWidths.venc + 5, tableY + 1);
            doc.fillColor('#334155');
            
            if (parcela.urlCobranca) {
              doc.fillColor('#2563eb');
              doc.text('Acessar', tableX + colWidths.desc + colWidths.valor + colWidths.venc + colWidths.dias + 5, tableY + 1, { 
                link: parcela.urlCobranca,
                underline: true
              });
              doc.fillColor('#334155');
            } else {
              doc.text('-', tableX + colWidths.desc + colWidths.valor + colWidths.venc + colWidths.dias + 5, tableY + 1);
            }
            
            doc.y = tableY + 13;
          }
        }
        
        doc.moveDown(0.5);
        doc.moveTo(marginLeft, doc.y).lineTo(marginLeft + pageWidth, doc.y).stroke('#e2e8f0');
        doc.moveDown(0.8);
      }
      
      // ==================== RODAPÉ NA ÚLTIMA PÁGINA ====================
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
      doc.text(`Relatório gerado automaticamente pelo sistema CRM - ${dataHoje}`, marginLeft, doc.page.height - 40, { align: 'center' });
      
      doc.end();
      
    } catch (error) {
      console.error("[api] Error generating cobranca PDF report:", error);
      res.status(500).json({ error: "Failed to generate cobranca PDF report" });
    }
  });

  // Contextos de inadimplência - GET batch
  app.get("/api/inadimplencia/contextos", async (req, res) => {
    try {
      const idsParam = req.query.ids as string;
      if (!idsParam) {
        return res.json({ contextos: {} });
      }
      const ids = idsParam.split(',').filter(Boolean);
      const contextos = await storage.getInadimplenciaContextos(ids);
      res.json({ contextos });
    } catch (error) {
      console.error("[api] Error fetching inadimplencia contextos:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia contextos" });
    }
  });

  // Contextos de inadimplência - GET single
  app.get("/api/inadimplencia/contexto/:clienteId", async (req, res) => {
    try {
      const { clienteId } = req.params;
      const contexto = await storage.getInadimplenciaContexto(clienteId);
      res.json({ contexto });
    } catch (error) {
      console.error("[api] Error fetching inadimplencia contexto:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia contexto" });
    }
  });

  // Contextos de inadimplência - PUT upsert
  app.put("/api/inadimplencia/contexto/:clienteId", async (req, res) => {
    try {
      const { clienteId } = req.params;
      const { contexto, evidencias, acao, statusFinanceiro, detalheFinanceiro } = req.body;
      
      // Validar ação CS (opcional agora)
      if (acao && !['cobrar', 'aguardar', 'abonar'].includes(acao)) {
        return res.status(400).json({ error: "Invalid acao. Must be 'cobrar', 'aguardar' or 'abonar'" });
      }
      
      // Validar status financeiro (opcional)
      if (statusFinanceiro && !['cobrado', 'acordo_realizado', 'juridico'].includes(statusFinanceiro)) {
        return res.status(400).json({ error: "Invalid statusFinanceiro. Must be 'cobrado', 'acordo_realizado' or 'juridico'" });
      }

      const userId = (req.user as any)?.id || 'anonymous';
      const result = await storage.upsertInadimplenciaContexto({
        clienteId,
        contexto,
        evidencias,
        acao,
        statusFinanceiro,
        detalheFinanceiro,
        atualizadoPor: userId,
      });
      res.json({ contexto: result });
    } catch (error) {
      console.error("[api] Error upserting inadimplencia contexto:", error);
      res.status(500).json({ error: "Failed to save inadimplencia contexto" });
    }
  });

  // ==================== JURÍDICO - Clientes para ação legal ====================
  
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
      
      // 3. Buscar contextos jurídicos
      const contextos = await storage.getInadimplenciaContextos(todosIds);
      
      // 4. Buscar parcelas em paralelo
      const parcelasPromises = clientesFiltrados.map(cliente => 
        storage.getInadimplenciaDetalheParcelas(cliente.idCliente, dataInicio, dataFim)
      );
      const parcelasResults = await Promise.all(parcelasPromises);
      
      // 5. Montar resposta
      const clientesComDados = clientesFiltrados.map((cliente, index) => ({
        cliente,
        contexto: contextos[cliente.idCliente] || {},
        parcelas: parcelasResults[index].parcelas,
        isHistorico: false,
      }));
      
      console.log("[api] Juridico clientes - Total:", clientesFiltrados.length);
      
      res.json({ clientes: clientesComDados });
    } catch (error) {
      console.error("[api] Error fetching juridico clientes:", error);
      res.status(500).json({ error: "Failed to fetch juridico clientes" });
    }
  });

  app.put("/api/juridico/clientes/:clienteId/contexto", async (req, res) => {
    try {
      const { clienteId } = req.params;
      const { contextoJuridico, procedimentoJuridico, statusJuridico, valorAcordado } = req.body;
      
      const user = (req as any).user;
      const atualizadoPor = user?.name || user?.googleId || 'Sistema';
      
      const result = await storage.upsertContextoJuridico({
        clienteId,
        contextoJuridico,
        procedimentoJuridico,
        statusJuridico,
        valorAcordado: valorAcordado != null ? parseFloat(valorAcordado) : undefined,
        atualizadoPor,
      });
      
      console.log("[api] Contexto jurídico atualizado para cliente:", clienteId);
      
      res.json(result);
    } catch (error) {
      console.error("[api] Error updating contexto juridico:", error);
      res.status(500).json({ error: "Failed to update contexto juridico" });
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
      
      if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Invalid mesAno parameter. Expected format: YYYY-MM" });
      }

      const evolucao = await storage.getMrrEvolucaoMensal(mesAno);
      res.json(evolucao);
    } catch (error) {
      console.error("[api] Error fetching MRR evolucao mensal:", error);
      res.status(500).json({ error: "Failed to fetch MRR evolucao mensal" });
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
          (SELECT COUNT(DISTINCT cnpj) FROM cup_clientes) as total_clientes,
          COUNT(DISTINCT c.id_task) as clientes_ativos
        FROM cup_contratos c
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
        FROM cup_contratos
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
        FROM rh_pessoal
        WHERE LOWER(status) = 'ativo'
      `);
      
      // Distribuição por setor (rh_pessoal) - status case-insensitive
      const setorResult = await db.execute(sql`
        SELECT 
          COALESCE(setor, 'Não definido') as setor,
          COUNT(*) as quantidade
        FROM rh_pessoal
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
          FROM caz_parcelas
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
            FROM caz_receber
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
            FROM caz_pagar
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
        FROM caz_parcelas
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
          (SELECT COUNT(DISTINCT cnpj) FROM cup_clientes) as total_clientes,
          COUNT(DISTINCT c.id_task) as clientes_ativos
        FROM cup_contratos c
        WHERE c.status IN ('ativo', 'onboarding', 'triagem')
      `);

      // Contratos ativos, churn e LT médio
      // LT calculado APENAS sobre contratos já encerrados (com data_encerramento preenchida)
      const clientesResult = await db.execute(sql`
        SELECT 
          COUNT(CASE WHEN c.valorr > 0 AND c.status IN ('ativo', 'onboarding', 'triagem') THEN 1 END) as contratos_recorrentes_ativos,
          COUNT(CASE WHEN c.data_encerramento IS NOT NULL AND c.valorr > 0 THEN 1 END) as contratos_encerrados_total,
          COUNT(CASE WHEN c.data_encerramento >= DATE_TRUNC('month', CURRENT_DATE) 
            AND c.data_encerramento < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            AND c.valorr > 0
            THEN 1 END) as churn_mes,
          COALESCE(SUM(CASE WHEN c.data_encerramento >= DATE_TRUNC('month', CURRENT_DATE) 
            AND c.data_encerramento < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            AND c.valorr > 0
            THEN c.valorr ELSE 0 END), 0) as mrr_churn_mes,
          COALESCE(AVG(
            CASE WHEN c.data_encerramento IS NOT NULL AND c.data_inicio IS NOT NULL AND c.valorr > 0 THEN
              EXTRACT(MONTH FROM AGE(c.data_encerramento, c.data_inicio)) +
              EXTRACT(YEAR FROM AGE(c.data_encerramento, c.data_inicio)) * 12
            END
          ), 6) as lt_medio_meses
        FROM cup_contratos c
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
        FROM cup_contratos
      `);
      
      // MRR atual (não tem histórico disponível na tabela)
      const mrrAtualResult = await db.execute(sql`
        SELECT COALESCE(SUM(CASE WHEN status IN ('ativo', 'onboarding', 'triagem') THEN valorr ELSE 0 END), 0) as mrr
        FROM cup_contratos
      `);
      const mrrHistoricoResult = { rows: [{ mes: new Date().toISOString().slice(0,7), mrr: mrrAtualResult.rows[0]?.mrr || 0 }] };
      
      // Receita por serviço
      const receitaPorServicoResult = await db.execute(sql`
        SELECT 
          COALESCE(c.servico, 'Outros') as servico,
          COUNT(DISTINCT c.id_task) as qtd_contratos,
          COALESCE(SUM(c.valorr), 0) as mrr_servico,
          COALESCE(AVG(c.valorr), 0) as ticket_medio
        FROM cup_contratos c
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
        FROM rh_pessoal
        WHERE LOWER(status) = 'ativo' OR status = 'Desligado'
      `);
      
      // Salário fixo médio
      const salarioMedioResult = await db.execute(sql`
        SELECT 
          COALESCE(AVG(salario::numeric), 0) as salario_medio,
          COUNT(*) as total_colaboradores
        FROM rh_pessoal
        WHERE LOWER(status) = 'ativo'
          AND salario IS NOT NULL
          AND salario::numeric > 0
      `);
      
      // Métricas mensais de contratos (churn, MRR vendido, pontual vendido) - cup_contratos
      // Filtra apenas dados até o mês atual (não inclui datas futuras)
      const contratosEvolucaoResult = await db.execute(sql`
        SELECT 
          mes,
          COALESCE(SUM(churn_mrr), 0) as churn_mrr,
          COALESCE(SUM(mrr_vendido), 0) as mrr_vendido,
          COALESCE(SUM(pontual_vendido), 0) as pontual_vendido
        FROM (
          -- Churn MRR (contratos encerrados no mês - usa valorr)
          SELECT 
            TO_CHAR(data_encerramento, 'YYYY-MM') as mes,
            COALESCE(valorr, 0) as churn_mrr,
            0 as mrr_vendido,
            0 as pontual_vendido
          FROM cup_contratos
          WHERE data_encerramento IS NOT NULL
            AND data_encerramento >= CURRENT_DATE - INTERVAL '12 months'
            AND data_encerramento <= CURRENT_DATE
            AND COALESCE(valorr, 0) > 0
          UNION ALL
          -- MRR vendido (contratos recorrentes iniciados no mês - valorr > 0)
          SELECT 
            TO_CHAR(data_inicio, 'YYYY-MM') as mes,
            0 as churn_mrr,
            COALESCE(valorr, 0) as mrr_vendido,
            0 as pontual_vendido
          FROM cup_contratos
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
          FROM cup_contratos
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
        FROM caz_parcelas
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
        FROM rh_pessoal
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
        FROM caz_parcelas
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
        FROM caz_parcelas
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
        FROM caz_parcelas p
        LEFT JOIN caz_clientes caz ON p.id_cliente::text = caz.ids::text
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
          FROM caz_parcelas p
          LEFT JOIN caz_clientes caz ON p.id_cliente::text = caz.ids::text
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

  app.get("/api/dfc", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      
      if (dataInicio && !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
        return res.status(400).json({ error: "Invalid dataInicio parameter. Expected format: YYYY-MM-DD" });
      }
      
      if (dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Invalid dataFim parameter. Expected format: YYYY-MM-DD" });
      }

      const dfcData = await storage.getDfc(dataInicio, dataFim);
      res.json(dfcData);
    } catch (error) {
      console.error("[api] Error fetching DFC data:", error);
      res.status(500).json({ error: "Failed to fetch DFC data" });
    }
  });

  app.post("/api/dfc/analyze", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.body;
      
      if (dataInicio && !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
        return res.status(400).json({ error: "Invalid dataInicio parameter. Expected format: YYYY-MM-DD" });
      }
      
      if (dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Invalid dataFim parameter. Expected format: YYYY-MM-DD" });
      }

      const dfcData = await storage.getDfc(dataInicio, dataFim);
      
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
      const { pergunta, historico, dataInicio, dataFim } = req.body;
      
      if (!pergunta || typeof pergunta !== 'string' || pergunta.trim().length === 0) {
        return res.status(400).json({ error: "Pergunta é obrigatória" });
      }
      
      if (dataInicio && !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
        return res.status(400).json({ error: "Invalid dataInicio parameter. Expected format: YYYY-MM-DD" });
      }
      
      if (dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return res.status(400).json({ error: "Invalid dataFim parameter. Expected format: YYYY-MM-DD" });
      }

      const dfcData = await storage.getDfc(dataInicio, dataFim);
      
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
  // CASES DE SUCESSO CHAT API ENDPOINT
  // ========================================
  app.post("/api/cases/chat", async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: "Mensagem é obrigatória" });
      }

      const webhookUrl = "https://n8n.turbopartners.com.br/webhook/cases";
      
      const webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message: message.trim(),
          timestamp: new Date().toISOString()
        }),
      });

      if (!webhookResponse.ok) {
        console.error("[api] Webhook response not ok:", webhookResponse.status, webhookResponse.statusText);
        return res.status(502).json({ error: "Falha ao comunicar com o servidor de cases" });
      }

      const responseText = await webhookResponse.text();
      
      if (!responseText || responseText.trim().length === 0) {
        return res.json({ response: "Mensagem recebida pelo servidor." });
      }

      try {
        const responseData = JSON.parse(responseText);
        res.json(responseData);
      } catch {
        res.json({ response: responseText });
      }
    } catch (error) {
      console.error("[api] Error in Cases chat:", error);
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

      const validContexts: AssistantContext[] = ['geral', 'financeiro', 'cases', 'clientes'];
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

  app.get("/api/geg/metricas", async (req, res) => {
    try {
      const periodo = req.query.periodo as string || 'trimestre';
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const metricas = await storage.getGegMetricas(periodo, squad, setor, nivel, cargo);
      res.json(metricas);
    } catch (error) {
      console.error("[api] Error fetching GEG metricas:", error);
      res.status(500).json({ error: "Failed to fetch GEG metricas" });
    }
  });

  app.get("/api/geg/evolucao-headcount", async (req, res) => {
    try {
      const periodo = req.query.periodo as string || 'trimestre';
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const evolucao = await storage.getGegEvolucaoHeadcount(periodo, squad, setor, nivel, cargo);
      res.json(evolucao);
    } catch (error) {
      console.error("[api] Error fetching GEG evolucao headcount:", error);
      res.status(500).json({ error: "Failed to fetch GEG evolucao headcount" });
    }
  });

  app.get("/api/geg/admissoes-demissoes", async (req, res) => {
    try {
      const periodo = req.query.periodo as string || 'trimestre';
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const dados = await storage.getGegAdmissoesDemissoes(periodo, squad, setor, nivel, cargo);
      res.json(dados);
    } catch (error) {
      console.error("[api] Error fetching GEG admissoes demissoes:", error);
      res.status(500).json({ error: "Failed to fetch GEG admissoes demissoes" });
    }
  });

  app.get("/api/geg/tempo-promocao", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const tempoPromocao = await storage.getGegTempoPromocao(squad, setor, nivel, cargo);
      res.json(tempoPromocao);
    } catch (error) {
      console.error("[api] Error fetching GEG tempo promocao:", error);
      res.status(500).json({ error: "Failed to fetch GEG tempo promocao" });
    }
  });

  app.get("/api/geg/aniversariantes-mes", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const aniversariantes = await storage.getGegAniversariantesMes(squad, setor, nivel, cargo);
      res.json(aniversariantes);
    } catch (error) {
      console.error("[api] Error fetching GEG aniversariantes mes:", error);
      res.status(500).json({ error: "Failed to fetch GEG aniversariantes mes" });
    }
  });

  app.get("/api/geg/aniversarios-empresa", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const aniversarios = await storage.getGegAniversariosEmpresa(squad, setor, nivel, cargo);
      res.json(aniversarios);
    } catch (error) {
      console.error("[api] Error fetching GEG aniversarios empresa:", error);
      res.status(500).json({ error: "Failed to fetch GEG aniversarios empresa" });
    }
  });

  app.get("/api/geg/filtros", async (req, res) => {
    try {
      const filtros = await storage.getGegFiltros();
      res.json(filtros);
    } catch (error) {
      console.error("[api] Error fetching GEG filtros:", error);
      res.status(500).json({ error: "Failed to fetch GEG filtros" });
    }
  });

  app.get("/api/geg/valor-medio-salario", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegValorMedioSalario(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG valor medio salario:", error);
      res.status(500).json({ error: "Failed to fetch GEG valor medio salario" });
    }
  });

  app.get("/api/geg/custo-folha", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegCustoFolha(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG custo folha:", error);
      res.status(500).json({ error: "Failed to fetch GEG custo folha" });
    }
  });

  app.get("/api/geg/valor-beneficio", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegValorBeneficio(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG valor beneficio:", error);
      res.status(500).json({ error: "Failed to fetch GEG valor beneficio" });
    }
  });

  app.get("/api/geg/valor-premiacao", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegValorPremiacao(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG valor premiacao:", error);
      res.status(500).json({ error: "Failed to fetch GEG valor premiacao" });
    }
  });

  app.get("/api/geg/patrimonio-resumo", async (req, res) => {
    try {
      const resultado = await storage.getGegPatrimonioResumo();
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG patrimonio resumo:", error);
      res.status(500).json({ error: "Failed to fetch GEG patrimonio resumo" });
    }
  });

  app.get("/api/geg/ultimas-promocoes", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';
      const limit = parseInt(req.query.limit as string) || 10;

      const resultado = await storage.getGegUltimasPromocoes(squad, setor, nivel, cargo, limit);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG ultimas promocoes:", error);
      res.status(500).json({ error: "Failed to fetch GEG ultimas promocoes" });
    }
  });

  app.get("/api/geg/tempo-permanencia", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegTempoPermanencia(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG tempo permanencia:", error);
      res.status(500).json({ error: "Failed to fetch GEG tempo permanencia" });
    }
  });

  app.get("/api/geg/mas-contratacoes", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegMasContratacoes(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG mas contratacoes:", error);
      res.status(500).json({ error: "Failed to fetch GEG mas contratacoes" });
    }
  });

  app.get("/api/geg/pessoas-por-setor", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegPessoasPorSetor(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG pessoas por setor:", error);
      res.status(500).json({ error: "Failed to fetch GEG pessoas por setor" });
    }
  });

  app.get("/api/geg/custo-por-setor", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegCustoPorSetor(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG custo por setor:", error);
      res.status(500).json({ error: "Failed to fetch GEG custo por setor" });
    }
  });

  app.get("/api/geg/demissoes-por-tipo", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegDemissoesPorTipo(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG demissoes por tipo:", error);
      res.status(500).json({ error: "Failed to fetch GEG demissoes por tipo" });
    }
  });

  app.get("/api/geg/headcount-por-tenure", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegHeadcountPorTenure(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG headcount por tenure:", error);
      res.status(500).json({ error: "Failed to fetch GEG headcount por tenure" });
    }
  });

  app.get("/api/geg/colaboradores-por-squad", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegColaboradoresPorSquad(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG colaboradores por squad:", error);
      res.status(500).json({ error: "Failed to fetch GEG colaboradores por squad" });
    }
  });

  app.get("/api/geg/colaboradores-por-cargo", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegColaboradoresPorCargo(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG colaboradores por cargo:", error);
      res.status(500).json({ error: "Failed to fetch GEG colaboradores por cargo" });
    }
  });

  app.get("/api/geg/colaboradores-por-nivel", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegColaboradoresPorNivel(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG colaboradores por nivel:", error);
      res.status(500).json({ error: "Failed to fetch GEG colaboradores por nivel" });
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

  // Tech Dashboard API routes
  app.get("/api/tech/metricas", async (req, res) => {
    try {
      const metricas = await storage.getTechMetricas();
      res.json(metricas);
    } catch (error) {
      console.error("[api] Error fetching tech metrics:", error);
      res.status(500).json({ error: "Failed to fetch tech metrics" });
    }
  });

  app.get("/api/tech/projetos-por-status", async (req, res) => {
    try {
      const projetos = await storage.getTechProjetosPorStatus();
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching tech projects by status:", error);
      res.status(500).json({ error: "Failed to fetch tech projects by status" });
    }
  });

  app.get("/api/tech/projetos-por-responsavel", async (req, res) => {
    try {
      const projetos = await storage.getTechProjetosPorResponsavel();
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching tech projects by responsible:", error);
      res.status(500).json({ error: "Failed to fetch tech projects by responsible" });
    }
  });

  app.get("/api/tech/projetos-por-tipo", async (req, res) => {
    try {
      const projetos = await storage.getTechProjetosPorTipo();
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching tech projects by type:", error);
      res.status(500).json({ error: "Failed to fetch tech projects by type" });
    }
  });

  app.get("/api/tech/projetos-em-andamento", async (req, res) => {
    try {
      const projetos = await storage.getTechProjetosEmAndamento();
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching active tech projects:", error);
      res.status(500).json({ error: "Failed to fetch active tech projects" });
    }
  });

  app.get("/api/tech/projetos-fechados", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const projetos = await storage.getTechProjetosFechados(limit);
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching closed tech projects:", error);
      res.status(500).json({ error: "Failed to fetch closed tech projects" });
    }
  });

  app.get("/api/tech/tasks-por-status", async (req, res) => {
    try {
      const tasks = await storage.getTechTasksPorStatus();
      res.json(tasks);
    } catch (error) {
      console.error("[api] Error fetching tech tasks by status:", error);
      res.status(500).json({ error: "Failed to fetch tech tasks by status" });
    }
  });

  app.get("/api/tech/velocidade", async (req, res) => {
    try {
      const velocidade = await storage.getTechVelocidade();
      res.json(velocidade);
    } catch (error) {
      console.error("[api] Error fetching tech velocity:", error);
      res.status(500).json({ error: "Failed to fetch tech velocity" });
    }
  });

  app.get("/api/tech/tempo-responsavel", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const responsavel = req.query.responsavel as string | undefined;
      const data = await storage.getTechTempoResponsavel(startDate, endDate, responsavel);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching tech tempo por responsavel:", error);
      res.status(500).json({ error: "Failed to fetch tech tempo por responsavel" });
    }
  });

  app.get("/api/tech/projetos", async (req, res) => {
    try {
      const tipo = (req.query.tipo as 'abertos' | 'fechados') || 'abertos';
      const responsavel = req.query.responsavel as string | undefined;
      const tipoP = req.query.tipoP as string | undefined;
      const projetos = await storage.getTechAllProjetos(tipo, responsavel, tipoP);
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching tech projetos:", error);
      res.status(500).json({ error: "Failed to fetch tech projetos" });
    }
  });

  // ==================== COMERCIAL - CLOSERS ====================
  
  app.get("/api/closers/list", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome as name, email, active FROM crm_closers ORDER BY nome
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching closers list:", error);
      res.status(500).json({ error: "Failed to fetch closers list" });
    }
  });

  app.get("/api/closers/sources", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT source FROM crm_deal WHERE source IS NOT NULL AND source != '' ORDER BY source
      `);
      res.json(result.rows.map((r: any) => r.source).filter((s: string) => s && s.trim() !== ''));
    } catch (error) {
      console.error("[api] Error fetching sources:", error);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/closers/pipelines", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT category_name FROM crm_deal WHERE category_name IS NOT NULL AND category_name != '' ORDER BY category_name
      `);
      res.json(result.rows.map((r: any) => r.category_name).filter((c: string) => c && c.trim() !== ''));
    } catch (error) {
      console.error("[api] Error fetching pipelines:", error);
      res.status(500).json({ error: "Failed to fetch pipelines" });
    }
  });

  app.get("/api/closers/metrics", async (req, res) => {
    try {
      const { 
        dataReuniaoInicio, 
        dataReuniaoFim, 
        dataFechamentoInicio, 
        dataFechamentoFim,
        dataLeadInicio,
        dataLeadFim,
        source,
        pipeline,
        closerId
      } = req.query;

      // Shared conditions (source, pipeline, closerId) - applied to all queries
      const sharedConditions: ReturnType<typeof sql>[] = [];
      if (source) {
        sharedConditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        sharedConditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (closerId) {
        sharedConditions.push(sql`d.closer = ${closerId}`);
      }

      console.log("[closers/metrics] Query params:", {
        dataReuniaoInicio,
        dataReuniaoFim,
        dataFechamentoInicio,
        dataFechamentoFim,
        dataLeadInicio,
        dataLeadFim,
        source,
        pipeline,
        closerId
      });
      console.log("[closers/metrics] Executing independent metrics queries...");
      
      // Query 1: Reuniões realizadas - filtered ONLY by reunion dates
      const reunioesConditions = [...sharedConditions];
      reunioesConditions.push(sql`d.data_reuniao_realizada IS NOT NULL`);
      if (dataReuniaoInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }
      const whereClauseReunioes = sql`WHERE ${sql.join(reunioesConditions, sql` AND `)}`;
      
      const resultReunioes = await db.execute(sql`
        SELECT COUNT(*) as reunioes_realizadas
        FROM crm_deal d
        LEFT JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseReunioes}
      `);

      // Query 2: Negócios ganhos, MRR e Pontual - filtered ONLY by closing dates
      const negociosConditions = [...sharedConditions];
      negociosConditions.push(sql`d.stage_name = 'Negócio Ganho'`);
      if (dataFechamentoInicio) {
        negociosConditions.push(sql`d.data_fechamento >= ${dataFechamentoInicio}`);
      }
      if (dataFechamentoFim) {
        negociosConditions.push(sql`d.data_fechamento <= ${dataFechamentoFim}`);
      }
      const whereClauseNegocios = sql`WHERE ${sql.join(negociosConditions, sql` AND `)}`;

      const resultNegocios = await db.execute(sql`
        SELECT 
          COALESCE(SUM(d.valor_recorrente), 0) as mrr_obtido,
          COALESCE(SUM(d.valor_pontual), 0) as pontual_obtido,
          COUNT(*) as negocios_ganhos
        FROM crm_deal d
        LEFT JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseNegocios}
      `);

      // Query 3: Leads criados - filtered ONLY by lead creation dates
      const leadsConditions = [...sharedConditions];
      if (dataLeadInicio) {
        leadsConditions.push(sql`d.date_create >= ${dataLeadInicio}`);
      }
      if (dataLeadFim) {
        leadsConditions.push(sql`d.date_create <= ${dataLeadFim}`);
      }
      const whereClauseLeads = leadsConditions.length > 0 
        ? sql`WHERE ${sql.join(leadsConditions, sql` AND `)}` 
        : sql``;

      const resultLeads = await db.execute(sql`
        SELECT COUNT(DISTINCT d.id) as leads_criados
        FROM crm_deal d
        LEFT JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseLeads}
      `);
      
      const rowReunioes = resultReunioes.rows[0] as any;
      const rowNegocios = resultNegocios.rows[0] as any;
      const rowLeads = resultLeads.rows[0] as any;

      const reunioes = parseInt(rowReunioes.reunioes_realizadas) || 0;
      const negocios = parseInt(rowNegocios.negocios_ganhos) || 0;
      const leads = parseInt(rowLeads.leads_criados) || 0;
      const conversao = reunioes > 0 ? (negocios / reunioes) * 100 : 0;

      console.log("[closers/metrics] Independent results - Reuniões:", reunioes, "Negócios:", negocios, "Leads:", leads);

      res.json({
        mrrObtido: parseFloat(rowNegocios.mrr_obtido) || 0,
        pontualObtido: parseFloat(rowNegocios.pontual_obtido) || 0,
        reunioesRealizadas: reunioes,
        negociosGanhos: negocios,
        leadsCriados: leads,
        taxaConversao: conversao
      });
    } catch (error) {
      console.error("[api] Error fetching closers metrics:", error);
      res.status(500).json({ error: "Failed to fetch closers metrics" });
    }
  });

  app.get("/api/closers/chart-reunioes-negocios", async (req, res) => {
    try {
      const { 
        dataReuniaoInicio, 
        dataReuniaoFim, 
        dataFechamentoInicio, 
        dataFechamentoFim,
        source,
        pipeline
      } = req.query;

      // Shared conditions (source, pipeline)
      const sharedConditions: ReturnType<typeof sql>[] = [];
      if (source) {
        sharedConditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        sharedConditions.push(sql`d.category_name = ${pipeline}`);
      }

      // Query 1: Reuniões por closer - filtered ONLY by reunion dates
      const reunioesConditions = [...sharedConditions];
      reunioesConditions.push(sql`d.data_reuniao_realizada IS NOT NULL`);
      if (dataReuniaoInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }
      const whereClauseReunioes = sql`WHERE ${sql.join(reunioesConditions, sql` AND `)}`;

      const resultReunioes = await db.execute(sql`
        SELECT 
          c.id as closer_id,
          c.nome as closer_name,
          COUNT(*) as reunioes
        FROM crm_deal d
        INNER JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseReunioes}
        GROUP BY c.id, c.nome
        ORDER BY c.nome
      `);

      // Query 2: Negócios ganhos por closer - filtered ONLY by closing dates
      const negociosConditions = [...sharedConditions];
      negociosConditions.push(sql`d.stage_name = 'Negócio Ganho'`);
      if (dataFechamentoInicio) {
        negociosConditions.push(sql`d.data_fechamento >= ${dataFechamentoInicio}`);
      }
      if (dataFechamentoFim) {
        negociosConditions.push(sql`d.data_fechamento <= ${dataFechamentoFim}`);
      }
      const whereClauseNegocios = sql`WHERE ${sql.join(negociosConditions, sql` AND `)}`;

      const resultNegocios = await db.execute(sql`
        SELECT 
          c.id as closer_id,
          c.nome as closer_name,
          COUNT(*) as negocios_ganhos
        FROM crm_deal d
        INNER JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseNegocios}
        GROUP BY c.id, c.nome
        ORDER BY c.nome
      `);

      // Merge results by closer
      const reunioesMap = new Map(resultReunioes.rows.map((r: any) => [r.closer_id, { name: r.closer_name, reunioes: parseInt(r.reunioes) || 0 }]));
      const negociosMap = new Map(resultNegocios.rows.map((r: any) => [r.closer_id, parseInt(r.negocios_ganhos) || 0]));

      const allCloserIds = new Set([...Array.from(reunioesMap.keys()), ...Array.from(negociosMap.keys())]);
      
      const data = Array.from(allCloserIds).map(closerId => {
        const reunioesData = reunioesMap.get(closerId) || { name: '', reunioes: 0 };
        const negociosData = negociosMap.get(closerId) || 0;
        
        // Get closer name from either map
        const closerName = reunioesData.name || (resultNegocios.rows.find((r: any) => r.closer_id === closerId) as any)?.closer_name || '';
        
        const reunioes = reunioesData.reunioes;
        const negocios = negociosData;
        const conversao = reunioes > 0 ? (negocios / reunioes) * 100 : 0;
        
        return {
          closer: closerName,
          reunioes,
          negociosGanhos: negocios,
          taxaConversao: parseFloat(conversao.toFixed(1))
        };
      }).filter(d => d.closer).sort((a, b) => a.closer.localeCompare(b.closer));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching chart data:", error);
      res.status(500).json({ error: "Failed to fetch chart data" });
    }
  });

  app.get("/api/closers/chart-receita", async (req, res) => {
    try {
      const { 
        dataFechamentoInicio, 
        dataFechamentoFim,
        source,
        pipeline
      } = req.query;

      // Receita (MRR/Pontual) is filtered ONLY by closing dates
      const conditions: ReturnType<typeof sql>[] = [sql`d.stage_name = 'Negócio Ganho'`];

      if (dataFechamentoInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataFechamentoInicio}`);
      }
      if (dataFechamentoFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFechamentoFim}`);
      }
      if (source) {
        conditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        conditions.push(sql`d.category_name = ${pipeline}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          c.nome as closer_name,
          COALESCE(SUM(d.valor_recorrente), 0) as mrr,
          COALESCE(SUM(d.valor_pontual), 0) as pontual
        FROM crm_deal d
        INNER JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
        GROUP BY c.id, c.nome
        ORDER BY c.nome
      `);
      
      const data = result.rows.map((row: any) => ({
        closer: row.closer_name,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0
      }));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching revenue chart data:", error);
      res.status(500).json({ error: "Failed to fetch revenue chart data" });
    }
  });

  // ========================================
  // CLOSER DETAIL API ENDPOINTS
  // ========================================

  app.get("/api/closers/detail", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      const closerResult = await db.execute(sql`
        SELECT id, nome FROM crm_closers WHERE id = ${closerId}
      `);
      
      if (closerResult.rows.length === 0) {
        return res.status(404).json({ error: "Closer not found" });
      }

      const closerInfo = closerResult.rows[0] as any;

      // Usa data_fechamento como referência principal para filtros de data
      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const metricsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_negocios,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 END) as negocios_ganhos,
          COUNT(CASE WHEN d.stage_name IN ('Negócio perdido', 'Negócio Perdido', 'Perdido', 'Descartado', 'Descartado/sem fit') THEN 1 END) as negocios_perdidos,
          COUNT(CASE WHEN d.stage_name NOT IN ('Negócio Ganho', 'Negócio perdido', 'Negócio Perdido', 'Perdido', 'Descartado', 'Descartado/sem fit') THEN 1 END) as negocios_em_andamento,
          COUNT(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 END) as reunioes_realizadas,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_recorrente END), 0) as valor_recorrente,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_pontual END), 0) as valor_pontual,
          MIN(d.data_fechamento) as primeiro_negocio,
          MAX(d.data_fechamento) as ultimo_negocio
        FROM crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.data_fechamento IS NOT NULL
        ${dateWhereClause}
      `);

      const row = metricsResult.rows[0] as any;
      
      const totalNegocios = parseInt(row.total_negocios) || 0;
      const negociosGanhos = parseInt(row.negocios_ganhos) || 0;
      const negociosPerdidos = parseInt(row.negocios_perdidos) || 0;
      const negociosEmAndamento = parseInt(row.negocios_em_andamento) || 0;
      const reunioesRealizadas = parseInt(row.reunioes_realizadas) || 0;
      const valorRecorrente = parseFloat(row.valor_recorrente) || 0;
      const valorPontual = parseFloat(row.valor_pontual) || 0;
      const valorTotal = valorRecorrente + valorPontual;
      const taxaConversao = reunioesRealizadas > 0 ? (negociosGanhos / reunioesRealizadas) * 100 : 0;
      const ticketMedio = negociosGanhos > 0 ? valorTotal / negociosGanhos : 0;
      const ticketMedioRecorrente = negociosGanhos > 0 ? valorRecorrente / negociosGanhos : 0;
      const ticketMedioPontual = negociosGanhos > 0 ? valorPontual / negociosGanhos : 0;

      const primeiroNegocio = row.primeiro_negocio;
      const ultimoNegocio = row.ultimo_negocio;

      let lt = 0;
      let diasAtivo = 0;
      if (primeiroNegocio) {
        const inicio = new Date(primeiroNegocio);
        const fim = ultimoNegocio ? new Date(ultimoNegocio) : new Date();
        diasAtivo = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        lt = Math.max(1, Math.ceil(diasAtivo / 30));
      }

      const mediaContratosPorMes = lt > 0 ? negociosGanhos / lt : 0;

      res.json({
        closerId: parseInt(closerId as string),
        closerName: closerInfo.nome,
        negociosGanhos,
        negociosPerdidos,
        negociosEmAndamento,
        totalNegocios,
        reunioesRealizadas,
        taxaConversao,
        valorRecorrente,
        valorPontual,
        valorTotal,
        ticketMedio,
        ticketMedioRecorrente,
        ticketMedioPontual,
        lt,
        primeiroNegocio: primeiroNegocio ? new Date(primeiroNegocio).toISOString() : null,
        ultimoNegocio: ultimoNegocio ? new Date(ultimoNegocio).toISOString() : null,
        diasAtivo,
        mediaContratosPorMes
      });
    } catch (error) {
      console.error("[api] Error fetching closer detail:", error);
      res.status(500).json({ error: "Failed to fetch closer detail" });
    }
  });

  app.get("/api/closers/detail/monthly", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT 
          TO_CHAR(d.data_fechamento, 'YYYY-MM') as mes,
          TO_CHAR(d.data_fechamento, 'Mon/YY') as mes_label,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_recorrente END), 0) as valor_recorrente,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_pontual END), 0) as valor_pontual,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 END) as negocios,
          COUNT(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 END) as reunioes
        FROM crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.data_fechamento IS NOT NULL
          ${dateWhereClause}
        GROUP BY TO_CHAR(d.data_fechamento, 'YYYY-MM'), TO_CHAR(d.data_fechamento, 'Mon/YY')
        ORDER BY mes ASC
      `);

      const data = result.rows.map((row: any) => ({
        mes: row.mes,
        mesLabel: row.mes_label,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        valorPontual: parseFloat(row.valor_pontual) || 0,
        negocios: parseInt(row.negocios) || 0,
        reunioes: parseInt(row.reunioes) || 0
      }));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching monthly data:", error);
      res.status(500).json({ error: "Failed to fetch monthly data" });
    }
  });

  app.get("/api/closers/detail/stages", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      // Usa data_fechamento como referência principal
      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT 
          d.stage_name as stage,
          COUNT(*) as count
        FROM crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.data_fechamento IS NOT NULL
          ${dateWhereClause}
        GROUP BY d.stage_name
        ORDER BY count DESC
      `);

      const totalCount = result.rows.reduce((acc: number, row: any) => acc + parseInt(row.count), 0);
      
      const data = result.rows.map((row: any) => ({
        stage: row.stage || 'Não informado',
        count: parseInt(row.count) || 0,
        percentage: totalCount > 0 ? (parseInt(row.count) / totalCount) * 100 : 0
      }));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching stage data:", error);
      res.status(500).json({ error: "Failed to fetch stage data" });
    }
  });

  app.get("/api/closers/detail/sources", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      // Usa data_fechamento como referência principal
      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(d.source, 'Não informado') as source,
          COUNT(*) as count
        FROM crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.data_fechamento IS NOT NULL
          ${dateWhereClause}
        GROUP BY d.source
        ORDER BY count DESC
        LIMIT 15
      `);

      const totalCount = result.rows.reduce((acc: number, row: any) => acc + parseInt(row.count), 0);
      
      const data = result.rows.map((row: any) => ({
        source: row.source || 'Não informado',
        count: parseInt(row.count) || 0,
        percentage: totalCount > 0 ? (parseInt(row.count) / totalCount) * 100 : 0
      }));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching source data:", error);
      res.status(500).json({ error: "Failed to fetch source data" });
    }
  });

  app.get("/api/closers/detail/lead-time", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (d.data_fechamento::timestamp - d.date_create)) / 86400) as lead_time_medio,
          MIN(EXTRACT(EPOCH FROM (d.data_fechamento::timestamp - d.date_create)) / 86400) as lead_time_min,
          MAX(EXTRACT(EPOCH FROM (d.data_fechamento::timestamp - d.date_create)) / 86400) as lead_time_max,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (d.data_fechamento::timestamp - d.date_create)) / 86400) as lead_time_mediana,
          COUNT(*) as total_negocios
        FROM crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.stage_name = 'Negócio Ganho'
          AND d.data_fechamento IS NOT NULL
          AND d.date_create IS NOT NULL
          ${dateWhereClause}
      `);

      const row = result.rows[0] as any;

      res.json({
        leadTimeMedio: parseFloat(row.lead_time_medio) || 0,
        leadTimeMin: parseFloat(row.lead_time_min) || 0,
        leadTimeMax: parseFloat(row.lead_time_max) || 0,
        leadTimeMediana: parseFloat(row.lead_time_mediana) || 0,
        totalNegocios: parseInt(row.total_negocios) || 0
      });
    } catch (error) {
      console.error("[api] Error fetching lead time data:", error);
      res.status(500).json({ error: "Failed to fetch lead time data" });
    }
  });

  // ========================================
  // SDRs DASHBOARD API ENDPOINTS
  // ========================================

  app.get("/api/sdrs/list", async (req, res) => {
    try {
      // Get distinct SDRs from crm_deal and join with crm_users to get names
      const result = await db.execute(sql`
        SELECT DISTINCT u.id, u.nome as name, u.email, u.active
        FROM crm_users u
        INNER JOIN crm_deal d ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
        ORDER BY u.nome
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching SDRs list:", error);
      res.status(500).json({ error: "Failed to fetch SDRs list" });
    }
  });

  app.get("/api/sdrs/sources", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT source
        FROM crm_deal
        WHERE source IS NOT NULL AND source != ''
        ORDER BY source
      `);
      res.json(result.rows.map((r: any) => r.source));
    } catch (error) {
      console.error("[api] Error fetching SDR sources:", error);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/sdrs/pipelines", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT category_name
        FROM crm_deal
        WHERE category_name IS NOT NULL AND category_name != ''
        ORDER BY category_name
      `);
      res.json(result.rows.map((r: any) => r.category_name));
    } catch (error) {
      console.error("[api] Error fetching SDR pipelines:", error);
      res.status(500).json({ error: "Failed to fetch pipelines" });
    }
  });

  app.get("/api/sdrs/metrics", async (req, res) => {
    try {
      const { 
        dataReuniaoInicio, 
        dataReuniaoFim,
        dataLeadInicio,
        dataLeadFim,
        source,
        pipeline,
        sdrId
      } = req.query;

      console.log("[sdrs/metrics] Query params:", { dataReuniaoInicio, dataReuniaoFim, dataLeadInicio, dataLeadFim, source, pipeline, sdrId });

      // Shared conditions (source, pipeline, sdrId) - applied to all queries
      const sharedConditions: ReturnType<typeof sql>[] = [];
      if (source) {
        sharedConditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        sharedConditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (sdrId) {
        sharedConditions.push(sql`d.sdr = ${sdrId}`);
      }

      // Query 1: Leads - filtered ONLY by lead creation dates
      const leadsConditions = [...sharedConditions];
      if (dataLeadInicio) {
        leadsConditions.push(sql`d.date_create >= ${dataLeadInicio}`);
      }
      if (dataLeadFim) {
        leadsConditions.push(sql`d.date_create <= ${dataLeadFim}`);
      }

      const whereClauseLeads = leadsConditions.length > 0 
        ? sql`WHERE ${sql.join(leadsConditions, sql` AND `)}` 
        : sql``;

      const resultLeads = await db.execute(sql`
        SELECT COUNT(DISTINCT d.id) as leads_totais
        FROM crm_deal d
        ${whereClauseLeads}
      `);

      // Query 2: Reuniões - filtered ONLY by reunion dates
      const reunioesConditions = [...sharedConditions];
      reunioesConditions.push(sql`d.data_reuniao_realizada IS NOT NULL`);
      if (dataReuniaoInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }

      const whereClauseReunioes = sql`WHERE ${sql.join(reunioesConditions, sql` AND `)}`;

      const resultReunioes = await db.execute(sql`
        SELECT COUNT(*) as reunioes_realizadas
        FROM crm_deal d
        ${whereClauseReunioes}
      `);

      const rowLeads = resultLeads.rows[0] as any;
      const rowReunioes = resultReunioes.rows[0] as any;
      
      const leadsTotais = parseInt(rowLeads.leads_totais) || 0;
      const reunioesRealizadas = parseInt(rowReunioes.reunioes_realizadas) || 0;
      const taxaConversao = leadsTotais > 0 ? (reunioesRealizadas / leadsTotais) * 100 : 0;

      console.log("[sdrs/metrics] Independent results - Leads:", leadsTotais, "Reuniões:", reunioesRealizadas);

      res.json({
        leadsTotais,
        reunioesRealizadas,
        taxaConversao
      });
    } catch (error) {
      console.error("[api] Error fetching SDR metrics:", error);
      res.status(500).json({ error: "Failed to fetch SDR metrics" });
    }
  });

  app.get("/api/sdrs/chart-reunioes", async (req, res) => {
    try {
      const { 
        dataReuniaoInicio, 
        dataReuniaoFim,
        dataLeadInicio,
        dataLeadFim,
        source,
        pipeline,
        sdrId
      } = req.query;

      // Shared conditions (source, pipeline, sdrId) - applied to all queries
      const sharedConditions: ReturnType<typeof sql>[] = [];
      if (source) {
        sharedConditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        sharedConditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (sdrId) {
        sharedConditions.push(sql`d.sdr = ${sdrId}`);
      }

      // Query 1: Leads por SDR - filtered ONLY by lead creation dates
      const leadsConditions = [...sharedConditions];
      if (dataLeadInicio) {
        leadsConditions.push(sql`d.date_create >= ${dataLeadInicio}`);
      }
      if (dataLeadFim) {
        leadsConditions.push(sql`d.date_create <= ${dataLeadFim}`);
      }

      const whereClauseLeads = leadsConditions.length > 0 
        ? sql`WHERE ${sql.join(leadsConditions, sql` AND `)}` 
        : sql``;

      const resultLeads = await db.execute(sql`
        SELECT 
          u.nome as sdr_name,
          u.id as sdr_id,
          COUNT(DISTINCT d.id) as leads
        FROM crm_deal d
        INNER JOIN crm_users u ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
        ${whereClauseLeads}
        GROUP BY u.id, u.nome
      `);

      // Query 2: Reuniões por SDR - filtered ONLY by reunion dates
      const reunioesConditions = [...sharedConditions];
      reunioesConditions.push(sql`d.data_reuniao_realizada IS NOT NULL`);
      if (dataReuniaoInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }

      const whereClauseReunioes = sql`WHERE ${sql.join(reunioesConditions, sql` AND `)}`;

      const resultReunioes = await db.execute(sql`
        SELECT 
          u.nome as sdr_name,
          u.id as sdr_id,
          COUNT(*) as reunioes
        FROM crm_deal d
        INNER JOIN crm_users u ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
        ${whereClauseReunioes}
        GROUP BY u.id, u.nome
      `);

      const leadsMap = new Map<number, { name: string; leads: number }>();
      resultLeads.rows.forEach((row: any) => {
        leadsMap.set(row.sdr_id, { 
          name: row.sdr_name, 
          leads: parseInt(row.leads) || 0 
        });
      });

      const reunioesMap = new Map<number, number>();
      resultReunioes.rows.forEach((row: any) => {
        reunioesMap.set(row.sdr_id, parseInt(row.reunioes) || 0);
      });

      const allSdrIds = new Set([...Array.from(leadsMap.keys()), ...Array.from(reunioesMap.keys())]);
      
      const data = Array.from(allSdrIds).map((sdrId) => {
        const leadsInfo = leadsMap.get(sdrId);
        const leads = leadsInfo?.leads || 0;
        const reunioes = reunioesMap.get(sdrId) || 0;
        const conversao = leads > 0 ? (reunioes / leads) * 100 : 0;
        
        let sdrName = leadsInfo?.name || '';
        if (!sdrName) {
          const reuniaoRow = resultReunioes.rows.find((r: any) => r.sdr_id === sdrId) as any;
          sdrName = reuniaoRow?.sdr_name || 'Desconhecido';
        }
        
        return {
          sdr: sdrName,
          sdrId,
          leads,
          reunioesRealizadas: reunioes,
          conversao: parseFloat(conversao.toFixed(1))
        };
      }).sort((a, b) => b.reunioesRealizadas - a.reunioesRealizadas);

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching SDR chart data:", error);
      res.status(500).json({ error: "Failed to fetch SDR chart data" });
    }
  });

  // ========================================
  // SDR DETAIL PAGE ENDPOINTS
  // ========================================

  app.get("/api/sdrs/detail", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const reunioesDateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        reunioesDateConditions.push(sql`d.data_reuniao_realizada >= ${dataInicio}`);
      }
      if (dataFim) {
        reunioesDateConditions.push(sql`d.data_reuniao_realizada <= ${dataFim}`);
      }

      const reunioesDateWhereClause = reunioesDateConditions.length > 0 
        ? sql` AND ${sql.join(reunioesDateConditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        WITH sdr_info AS (
          SELECT id, nome, email FROM crm_users WHERE id = ${sdrIdNum}
        ),
        leads_data AS (
          SELECT 
            COUNT(DISTINCT d.id) as leads_totais,
            MIN(d.date_create) as primeiro_lead,
            MAX(d.date_create) as ultimo_lead
          FROM crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
          ${dateWhereClause}
        ),
        reunioes_data AS (
          SELECT COUNT(*) as reunioes_realizadas
          FROM crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.data_reuniao_realizada IS NOT NULL
          ${reunioesDateWhereClause}
        ),
        vendas_data AS (
          SELECT 
            COUNT(*) as negocios_ganhos,
            COALESCE(SUM(d.valor_recorrente), 0) as valor_recorrente,
            COALESCE(SUM(d.valor_pontual), 0) as valor_pontual
          FROM crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.stage_name = 'Negócio Ganho'
          ${dateWhereClause}
        ),
        perdidos_data AS (
          SELECT COUNT(*) as negocios_perdidos
          FROM crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.stage_name = 'Negócio Perdido'
          ${dateWhereClause}
        ),
        em_andamento_data AS (
          SELECT COUNT(*) as em_andamento
          FROM crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.stage_name NOT IN ('Negócio Ganho', 'Negócio Perdido')
          ${dateWhereClause}
        )
        SELECT 
          s.id, s.nome, s.email,
          l.leads_totais, l.primeiro_lead, l.ultimo_lead,
          r.reunioes_realizadas,
          v.negocios_ganhos, v.valor_recorrente, v.valor_pontual,
          p.negocios_perdidos,
          e.em_andamento
        FROM sdr_info s
        CROSS JOIN leads_data l
        CROSS JOIN reunioes_data r
        CROSS JOIN vendas_data v
        CROSS JOIN perdidos_data p
        CROSS JOIN em_andamento_data e
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "SDR not found" });
      }

      const row = result.rows[0] as any;

      const leadsTotais = parseInt(row.leads_totais) || 0;
      const reunioesRealizadas = parseInt(row.reunioes_realizadas) || 0;
      const negociosGanhos = parseInt(row.negocios_ganhos) || 0;
      const negociosPerdidos = parseInt(row.negocios_perdidos) || 0;
      const emAndamento = parseInt(row.em_andamento) || 0;
      const valorRecorrente = parseFloat(row.valor_recorrente) || 0;
      const valorPontual = parseFloat(row.valor_pontual) || 0;

      const taxaLeadReuniao = leadsTotais > 0 ? (reunioesRealizadas / leadsTotais) * 100 : 0;
      const taxaReuniaoVenda = reunioesRealizadas > 0 ? (negociosGanhos / reunioesRealizadas) * 100 : 0;
      const taxaLeadVenda = leadsTotais > 0 ? (negociosGanhos / leadsTotais) * 100 : 0;

      res.json({
        sdrId: row.id,
        sdrName: row.nome,
        sdrEmail: row.email,
        leadsTotais,
        reunioesRealizadas,
        negociosGanhos,
        negociosPerdidos,
        negociosEmAndamento: emAndamento,
        valorRecorrente,
        valorPontual,
        valorTotal: valorRecorrente + valorPontual,
        taxaLeadReuniao,
        taxaReuniaoVenda,
        taxaLeadVenda,
        primeiroLead: row.primeiro_lead,
        ultimoLead: row.ultimo_lead,
        ticketMedio: negociosGanhos > 0 ? (valorRecorrente + valorPontual) / negociosGanhos : 0
      });
    } catch (error) {
      console.error("[api] Error fetching SDR detail:", error);
      res.status(500).json({ error: "Failed to fetch SDR detail" });
    }
  });

  app.get("/api/sdrs/detail/monthly", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        WITH monthly_leads AS (
          SELECT 
            TO_CHAR(d.date_create, 'YYYY-MM') as mes,
            TO_CHAR(d.date_create, 'Mon/YY') as mes_label,
            COUNT(DISTINCT d.id) as leads
          FROM crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
          ${dateWhereClause}
          GROUP BY TO_CHAR(d.date_create, 'YYYY-MM'), TO_CHAR(d.date_create, 'Mon/YY')
        ),
        monthly_reunioes AS (
          SELECT 
            TO_CHAR(d.data_reuniao_realizada, 'YYYY-MM') as mes,
            COUNT(*) as reunioes
          FROM crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.data_reuniao_realizada IS NOT NULL
          ${dateConditions.length > 0 ? sql` AND ${sql.join(dateConditions.map(c => {
            return sql`d.data_reuniao_realizada >= ${dataInicio} AND d.data_reuniao_realizada <= ${dataFim}`;
          }), sql` AND `)}` : sql``}
          GROUP BY TO_CHAR(d.data_reuniao_realizada, 'YYYY-MM')
        ),
        monthly_vendas AS (
          SELECT 
            TO_CHAR(d.data_fechamento, 'YYYY-MM') as mes,
            COUNT(*) as vendas,
            COALESCE(SUM(d.valor_recorrente), 0) as valor_recorrente,
            COALESCE(SUM(d.valor_pontual), 0) as valor_pontual
          FROM crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.stage_name = 'Negócio Ganho'
          ${dateConditions.length > 0 ? sql` AND d.data_fechamento >= ${dataInicio} AND d.data_fechamento <= ${dataFim}` : sql``}
          GROUP BY TO_CHAR(d.data_fechamento, 'YYYY-MM')
        )
        SELECT 
          l.mes,
          l.mes_label as "mesLabel",
          l.leads,
          COALESCE(r.reunioes, 0) as reunioes,
          COALESCE(v.vendas, 0) as vendas,
          COALESCE(v.valor_recorrente, 0) as "valorRecorrente",
          COALESCE(v.valor_pontual, 0) as "valorPontual"
        FROM monthly_leads l
        LEFT JOIN monthly_reunioes r ON l.mes = r.mes
        LEFT JOIN monthly_vendas v ON l.mes = v.mes
        ORDER BY l.mes
      `);

      res.json(result.rows.map((row: any) => ({
        mes: row.mes,
        mesLabel: row.mesLabel,
        leads: parseInt(row.leads) || 0,
        reunioes: parseInt(row.reunioes) || 0,
        vendas: parseInt(row.vendas) || 0,
        valorRecorrente: parseFloat(row.valorRecorrente) || 0,
        valorPontual: parseFloat(row.valorPontual) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching SDR monthly data:", error);
      res.status(500).json({ error: "Failed to fetch monthly data" });
    }
  });

  app.get("/api/sdrs/detail/sources", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(d.source, 'Não informado') as source,
          COUNT(DISTINCT d.id) as leads,
          COUNT(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 END) as reunioes,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 END) as vendas
        FROM crm_deal d
        WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
        ${dateWhereClause}
        GROUP BY COALESCE(d.source, 'Não informado')
        ORDER BY COUNT(DISTINCT d.id) DESC
      `);

      const totalLeads = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.leads), 0);

      res.json(result.rows.map((row: any) => ({
        source: row.source,
        leads: parseInt(row.leads) || 0,
        reunioes: parseInt(row.reunioes) || 0,
        vendas: parseInt(row.vendas) || 0,
        percentage: totalLeads > 0 ? ((parseInt(row.leads) || 0) / totalLeads) * 100 : 0
      })));
    } catch (error) {
      console.error("[api] Error fetching SDR sources:", error);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/sdrs/detail/pipelines", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(d.category_name, 'Não informado') as pipeline,
          COUNT(DISTINCT d.id) as leads,
          COUNT(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 END) as reunioes,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 END) as vendas,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_recorrente ELSE 0 END), 0) as valor_recorrente
        FROM crm_deal d
        WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
        ${dateWhereClause}
        GROUP BY COALESCE(d.category_name, 'Não informado')
        ORDER BY COUNT(DISTINCT d.id) DESC
      `);

      const totalLeads = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.leads), 0);

      res.json(result.rows.map((row: any) => ({
        pipeline: row.pipeline,
        leads: parseInt(row.leads) || 0,
        reunioes: parseInt(row.reunioes) || 0,
        vendas: parseInt(row.vendas) || 0,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        percentage: totalLeads > 0 ? ((parseInt(row.leads) || 0) / totalLeads) * 100 : 0
      })));
    } catch (error) {
      console.error("[api] Error fetching SDR pipelines:", error);
      res.status(500).json({ error: "Failed to fetch pipelines" });
    }
  });

  app.get("/api/sdrs/detail/stages", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0 
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(d.stage_name, 'Não informado') as stage,
          COUNT(DISTINCT d.id) as count
        FROM crm_deal d
        WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
        ${dateWhereClause}
        GROUP BY COALESCE(d.stage_name, 'Não informado')
        ORDER BY COUNT(DISTINCT d.id) DESC
      `);

      const totalCount = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0);

      res.json(result.rows.map((row: any) => ({
        stage: row.stage,
        count: parseInt(row.count) || 0,
        percentage: totalCount > 0 ? ((parseInt(row.count) || 0) / totalCount) * 100 : 0
      })));
    } catch (error) {
      console.error("[api] Error fetching SDR stages:", error);
      res.status(500).json({ error: "Failed to fetch stages" });
    }
  });

  app.post("/api/deals/test-notification", async (req, res) => {
    try {
      const deal = triggerTestNotification();
      res.json({ success: true, deal });
    } catch (error) {
      console.error("[api] Error triggering test notification:", error);
      res.status(500).json({ error: "Failed to trigger test notification" });
    }
  });

  // ==================== ANÁLISE DE VENDAS ====================

  // Filtros disponíveis
  app.get("/api/vendas/filtros", async (req, res) => {
    try {
      const [pipelines, sources, utmContents] = await Promise.all([
        db.execute(sql`SELECT DISTINCT category_name FROM crm_deal WHERE category_name IS NOT NULL AND category_name != '' ORDER BY category_name`),
        db.execute(sql`SELECT DISTINCT source FROM crm_deal WHERE source IS NOT NULL AND source != '' ORDER BY source`),
        db.execute(sql`SELECT DISTINCT utm_content FROM crm_deal WHERE utm_content IS NOT NULL AND utm_content != '' ORDER BY utm_content`)
      ]);
      
      res.json({
        pipelines: pipelines.rows.map((r: any) => r.category_name),
        sources: sources.rows.map((r: any) => r.source),
        utmContents: utmContents.rows.map((r: any) => r.utm_content)
      });
    } catch (error) {
      console.error("[api] Error fetching vendas filters:", error);
      res.status(500).json({ error: "Failed to fetch filters" });
    }
  });

  // KPIs principais
  app.get("/api/vendas/kpis", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(SUM(valor_recorrente), 0) as receita_recorrente,
          COALESCE(SUM(valor_pontual), 0) as receita_pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as receita_total,
          COUNT(*) as total_contratos,
          COUNT(CASE WHEN valor_recorrente > 0 THEN 1 END) as contratos_recorrentes,
          COUNT(CASE WHEN valor_pontual > 0 AND (valor_recorrente = 0 OR valor_recorrente IS NULL) THEN 1 END) as contratos_pontuais,
          COALESCE(AVG(EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400), 0) as tempo_fechamento_dias,
          COALESCE(AVG(CASE WHEN valor_recorrente > 0 THEN valor_recorrente END), 0) as ticket_medio_recorrente,
          COALESCE(AVG(CASE WHEN valor_pontual > 0 THEN valor_pontual END), 0) as ticket_medio_pontual
        FROM crm_deal
        ${whereClause}
      `);

      const row = result.rows[0] as any;

      res.json({
        receitaRecorrente: parseFloat(row.receita_recorrente) || 0,
        receitaPontual: parseFloat(row.receita_pontual) || 0,
        receitaTotal: parseFloat(row.receita_total) || 0,
        totalContratos: parseInt(row.total_contratos) || 0,
        contratosRecorrentes: parseInt(row.contratos_recorrentes) || 0,
        contratosPontuais: parseInt(row.contratos_pontuais) || 0,
        tempoFechamentoDias: parseFloat(row.tempo_fechamento_dias) || 0,
        ticketMedioRecorrente: parseFloat(row.ticket_medio_recorrente) || 0,
        ticketMedioPontual: parseFloat(row.ticket_medio_pontual) || 0
      });
    } catch (error) {
      console.error("[api] Error fetching vendas KPIs:", error);
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  });

  // Contratos por dia
  app.get("/api/vendas/contratos-por-dia", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          DATE(data_fechamento) as dia,
          COUNT(*) as contratos,
          COALESCE(SUM(valor_recorrente), 0) as valor_recorrente,
          COALESCE(SUM(valor_pontual), 0) as valor_pontual
        FROM crm_deal
        ${whereClause}
        GROUP BY DATE(data_fechamento)
        ORDER BY dia
      `);

      res.json(result.rows.map((row: any) => ({
        dia: row.dia,
        contratos: parseInt(row.contratos) || 0,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        valorPontual: parseFloat(row.valor_pontual) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching contratos por dia:", error);
      res.status(500).json({ error: "Failed to fetch contratos por dia" });
    }
  });

  // MRR por Closer
  app.get("/api/vendas/mrr-por-closer", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`d.stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`d.source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`d.utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(c.nome, 'Não Atribuído') as closer_name,
          COALESCE(SUM(d.valor_recorrente), 0) as mrr,
          COALESCE(SUM(d.valor_pontual), 0) as pontual,
          COUNT(*) as contratos
        FROM crm_deal d
        LEFT JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
        GROUP BY c.id, c.nome
        ORDER BY mrr DESC
      `);

      res.json(result.rows.map((row: any) => ({
        closer: row.closer_name,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        contratos: parseInt(row.contratos) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching MRR por closer:", error);
      res.status(500).json({ error: "Failed to fetch MRR por closer" });
    }
  });

  // MRR por SDR (sdr column joined with crm_closers)
  app.get("/api/vendas/mrr-por-sdr", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`d.stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`d.source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`d.utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(u.nome, 'Não Atribuído') as sdr_name,
          COALESCE(SUM(d.valor_recorrente), 0) as mrr,
          COALESCE(SUM(d.valor_pontual), 0) as pontual,
          COUNT(*) as contratos
        FROM crm_deal d
        LEFT JOIN crm_users u ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
        ${whereClause}
        GROUP BY u.id, u.nome
        ORDER BY mrr DESC
      `);

      res.json(result.rows.map((row: any) => ({
        sdr: row.sdr_name,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        contratos: parseInt(row.contratos) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching MRR por SDR:", error);
      res.status(500).json({ error: "Failed to fetch MRR por SDR" });
    }
  });

  // Receita por Fonte
  app.get("/api/vendas/receita-por-fonte", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(source, 'Não Identificado') as fonte,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COUNT(*) as contratos
        FROM crm_deal
        ${whereClause}
        GROUP BY source
        ORDER BY (COALESCE(SUM(valor_recorrente), 0) + COALESCE(SUM(valor_pontual), 0)) DESC
      `);

      res.json(result.rows.map((row: any) => ({
        fonte: row.fonte,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        contratos: parseInt(row.contratos) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching receita por fonte:", error);
      res.status(500).json({ error: "Failed to fetch receita por fonte" });
    }
  });

  // MRR Perdido (deals perdidos no período)
  app.get("/api/vendas/mrr-perdido", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`(stage_name ILIKE '%perdido%' OR stage_name ILIKE '%lost%' OR stage_name ILIKE '%cancelado%')`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`source = ${source}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(SUM(valor_recorrente), 0) as mrr_perdido,
          COUNT(*) as contratos_perdidos
        FROM crm_deal
        ${whereClause}
      `);

      const row = result.rows[0] as any;

      res.json({
        mrrPerdido: parseFloat(row.mrr_perdido) || 0,
        contratosPerdidos: parseInt(row.contratos_perdidos) || 0
      });
    } catch (error) {
      console.error("[api] Error fetching MRR perdido:", error);
      res.status(500).json({ error: "Failed to fetch MRR perdido" });
    }
  });

  // ============================================
  // DETALHAMENTO DE VENDAS (Sales Detail Dashboard)
  // ============================================

  // Métricas gerais de vendas
  app.get("/api/vendas/detalhamento/metricas", async (req, res) => {
    try {
      const { dataInicio, dataFim, source, category, closer } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`d.stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (source && source !== 'all') {
        conditions.push(sql`d.source = ${source}`);
      }
      if (category && category !== 'all') {
        conditions.push(sql`d.category_name = ${category}`);
      }
      if (closer && closer !== 'all') {
        conditions.push(sql`c.nome = ${closer}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_negocios,
          COALESCE(SUM(d.valor_recorrente), 0) as total_mrr,
          COALESCE(SUM(d.valor_pontual), 0) as total_pontual,
          COALESCE(SUM(d.valor_recorrente) + SUM(d.valor_pontual), 0) as receita_total,
          COALESCE(AVG(COALESCE(d.valor_recorrente, 0) + COALESCE(d.valor_pontual, 0)), 0) as ticket_medio,
          COALESCE(AVG(EXTRACT(EPOCH FROM (d.data_fechamento - d.date_create)) / 86400), 0) as ciclo_medio_dias,
          COUNT(DISTINCT d.company_name) as empresas_unicas,
          COUNT(DISTINCT c.nome) as closers_ativos,
          COUNT(CASE WHEN d.valor_recorrente > 0 THEN 1 END) as negocios_recorrentes,
          COUNT(CASE WHEN d.valor_pontual > 0 AND (d.valor_recorrente IS NULL OR d.valor_recorrente = 0) THEN 1 END) as negocios_pontuais,
          COUNT(CASE WHEN d.valor_recorrente > 0 AND d.valor_pontual > 0 THEN 1 END) as negocios_mistos,
          COALESCE(AVG(d.valor_recorrente), 0) as mrr_medio,
          COALESCE(AVG(d.valor_pontual), 0) as pontual_medio,
          MIN(d.data_fechamento) as primeira_venda,
          MAX(d.data_fechamento) as ultima_venda
        FROM crm_deal d
        LEFT JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
      `);

      const row = result.rows[0] as any;

      res.json({
        totalNegocios: parseInt(row.total_negocios) || 0,
        totalMrr: parseFloat(row.total_mrr) || 0,
        totalPontual: parseFloat(row.total_pontual) || 0,
        receitaTotal: parseFloat(row.receita_total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0,
        cicloMedioDias: parseFloat(row.ciclo_medio_dias) || 0,
        empresasUnicas: parseInt(row.empresas_unicas) || 0,
        closersAtivos: parseInt(row.closers_ativos) || 0,
        negociosRecorrentes: parseInt(row.negocios_recorrentes) || 0,
        negociosPontuais: parseInt(row.negocios_pontuais) || 0,
        negociosMistos: parseInt(row.negocios_mistos) || 0,
        mrrMedio: parseFloat(row.mrr_medio) || 0,
        pontualMedio: parseFloat(row.pontual_medio) || 0,
        primeiraVenda: row.primeira_venda,
        ultimaVenda: row.ultima_venda
      });
    } catch (error) {
      console.error("[api] Error fetching métricas detalhamento:", error);
      res.status(500).json({ error: "Failed to fetch métricas" });
    }
  });

  // Lista de todos os negócios ganhos
  app.get("/api/vendas/detalhamento/negocios", async (req, res) => {
    try {
      const { dataInicio, dataFim, source, category, closer, orderBy, orderDir } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`d.stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (source && source !== 'all') {
        conditions.push(sql`d.source = ${source}`);
      }
      if (category && category !== 'all') {
        conditions.push(sql`d.category_name = ${category}`);
      }
      if (closer && closer !== 'all') {
        conditions.push(sql`c.nome = ${closer}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const orderColumn = orderBy === 'valor' ? 'valor_total' : 
                          orderBy === 'mrr' ? 'd.valor_recorrente' :
                          orderBy === 'pontual' ? 'd.valor_pontual' :
                          orderBy === 'ciclo' ? 'ciclo_dias' :
                          'd.data_fechamento';
      const orderDirection = orderDir === 'asc' ? 'ASC' : 'DESC';

      const result = await db.execute(sql`
        SELECT 
          d.id,
          d.title,
          d.company_name,
          COALESCE(d.valor_recorrente, 0) as valor_recorrente,
          COALESCE(d.valor_pontual, 0) as valor_pontual,
          (COALESCE(d.valor_recorrente, 0) + COALESCE(d.valor_pontual, 0)) as valor_total,
          d.category_name,
          d.source,
          c.nome as closer_name,
          d.date_create,
          d.data_fechamento,
          EXTRACT(EPOCH FROM (d.data_fechamento - d.date_create)) / 86400 as ciclo_dias,
          d.utm_source,
          d.utm_medium,
          d.utm_campaign,
          d.utm_term,
          d.utm_content
        FROM crm_deal d
        LEFT JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
        ORDER BY ${sql.raw(orderColumn)} ${sql.raw(orderDirection)}
        LIMIT 500
      `);

      res.json(result.rows.map((row: any) => ({
        dealId: row.id,
        dealName: row.title,
        companyName: row.company_name,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        valorPontual: parseFloat(row.valor_pontual) || 0,
        valorTotal: parseFloat(row.valor_total) || 0,
        categoryName: row.category_name,
        source: row.source,
        pipelineName: row.category_name,
        ownerName: row.closer_name,
        createdDate: row.date_create,
        closeDate: row.data_fechamento,
        cicloDias: parseFloat(row.ciclo_dias) || 0,
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        utmCampaign: row.utm_campaign,
        utmTerm: row.utm_term,
        utmContent: row.utm_content
      })));
    } catch (error) {
      console.error("[api] Error fetching negócios detalhamento:", error);
      res.status(500).json({ error: "Failed to fetch negócios" });
    }
  });

  // Distribuição por fonte
  app.get("/api/vendas/detalhamento/por-fonte", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`,
        sql`source IS NOT NULL`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          source as fonte,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as total,
          COALESCE(AVG(COALESCE(valor_recorrente, 0) + COALESCE(valor_pontual, 0)), 0) as ticket_medio
        FROM crm_deal
        ${whereClause}
        GROUP BY source
        ORDER BY total DESC
      `);

      res.json(result.rows.map((row: any) => ({
        fonte: row.fonte,
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching por fonte:", error);
      res.status(500).json({ error: "Failed to fetch por fonte" });
    }
  });

  // Distribuição por closer/owner
  app.get("/api/vendas/detalhamento/por-closer", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`d.stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          c.nome as closer,
          COUNT(*) as quantidade,
          COALESCE(SUM(d.valor_recorrente), 0) as mrr,
          COALESCE(SUM(d.valor_pontual), 0) as pontual,
          COALESCE(SUM(d.valor_recorrente) + SUM(d.valor_pontual), 0) as total,
          COALESCE(AVG(COALESCE(d.valor_recorrente, 0) + COALESCE(d.valor_pontual, 0)), 0) as ticket_medio,
          COALESCE(AVG(EXTRACT(EPOCH FROM (d.data_fechamento - d.date_create)) / 86400), 0) as ciclo_medio
        FROM crm_deal d
        LEFT JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
        GROUP BY c.nome
        ORDER BY total DESC
      `);

      res.json(result.rows.map((row: any) => ({
        closer: row.closer || 'Sem closer',
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0,
        cicloMedio: parseFloat(row.ciclo_medio) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching por closer:", error);
      res.status(500).json({ error: "Failed to fetch por closer" });
    }
  });

  // Evolução mensal
  app.get("/api/vendas/detalhamento/evolucao-mensal", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`,
        sql`data_fechamento IS NOT NULL`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          TO_CHAR(data_fechamento, 'YYYY-MM') as mes,
          TO_CHAR(data_fechamento, 'Mon/YY') as mes_label,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as total,
          COALESCE(AVG(COALESCE(valor_recorrente, 0) + COALESCE(valor_pontual, 0)), 0) as ticket_medio
        FROM crm_deal
        ${whereClause}
        GROUP BY TO_CHAR(data_fechamento, 'YYYY-MM'), TO_CHAR(data_fechamento, 'Mon/YY')
        ORDER BY mes ASC
      `);

      res.json(result.rows.map((row: any) => ({
        mes: row.mes,
        mesLabel: row.mes_label,
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching evolução mensal:", error);
      res.status(500).json({ error: "Failed to fetch evolução mensal" });
    }
  });

  // Distribuição por UTM
  app.get("/api/vendas/detalhamento/por-utm", async (req, res) => {
    try {
      const { dataInicio, dataFim, utmType } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const utmColumn = utmType === 'medium' ? 'utm_medium' :
                        utmType === 'campaign' ? 'utm_campaign' :
                        utmType === 'term' ? 'utm_term' :
                        utmType === 'content' ? 'utm_content' :
                        'utm_source';

      conditions.push(sql`${sql.raw(utmColumn)} IS NOT NULL AND ${sql.raw(utmColumn)} != ''`);

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          ${sql.raw(utmColumn)} as utm_value,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as total
        FROM crm_deal
        ${whereClause}
        GROUP BY ${sql.raw(utmColumn)}
        ORDER BY total DESC
      `);

      res.json(result.rows.map((row: any) => ({
        utmValue: row.utm_value,
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching por UTM:", error);
      res.status(500).json({ error: "Failed to fetch por UTM" });
    }
  });

  // Filtros disponíveis
  app.get("/api/vendas/detalhamento/filtros", async (req, res) => {
    try {
      const [sources, categories, closersResult] = await Promise.all([
        db.execute(sql`SELECT DISTINCT source FROM crm_deal WHERE stage_name = 'Negócio Ganho' AND source IS NOT NULL ORDER BY source`),
        db.execute(sql`SELECT DISTINCT category_name FROM crm_deal WHERE stage_name = 'Negócio Ganho' AND category_name IS NOT NULL ORDER BY category_name`),
        db.execute(sql`
          SELECT DISTINCT c.nome as closer_name 
          FROM crm_deal d 
          INNER JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id 
          WHERE d.stage_name = 'Negócio Ganho' 
          ORDER BY c.nome
        `)
      ]);

      res.json({
        sources: sources.rows.map((r: any) => r.source),
        categories: categories.rows.map((r: any) => r.category_name),
        closers: closersResult.rows.map((r: any) => r.closer_name)
      });
    } catch (error) {
      console.error("[api] Error fetching filtros:", error);
      res.status(500).json({ error: "Failed to fetch filtros" });
    }
  });

  // Análise de ciclo de vendas
  app.get("/api/vendas/detalhamento/ciclo-vendas", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`,
        sql`data_fechamento IS NOT NULL`,
        sql`date_create IS NOT NULL`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          CASE 
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
            ELSE '60+ dias'
          END as faixa,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as valor_total,
          COALESCE(AVG(COALESCE(valor_recorrente, 0) + COALESCE(valor_pontual, 0)), 0) as ticket_medio
        FROM crm_deal
        ${whereClause}
        GROUP BY 
          CASE 
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
            ELSE '60+ dias'
          END
        ORDER BY 
          CASE 
            WHEN CASE 
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
              ELSE '60+ dias'
            END = '0-7 dias' THEN 1
            WHEN CASE 
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
              ELSE '60+ dias'
            END = '8-14 dias' THEN 2
            WHEN CASE 
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
              ELSE '60+ dias'
            END = '15-30 dias' THEN 3
            WHEN CASE 
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
              ELSE '60+ dias'
            END = '31-60 dias' THEN 4
            ELSE 5
          END
      `);

      res.json(result.rows.map((row: any) => ({
        faixa: row.faixa,
        quantidade: parseInt(row.quantidade) || 0,
        valorTotal: parseFloat(row.valor_total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching ciclo vendas:", error);
      res.status(500).json({ error: "Failed to fetch ciclo vendas" });
    }
  });

  // Tipo de contrato (recorrente vs pontual)
  app.get("/api/vendas/detalhamento/tipo-contrato", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT 
          CASE 
            WHEN valor_recorrente > 0 AND (valor_pontual IS NULL OR valor_pontual = 0) THEN 'Recorrente'
            WHEN (valor_recorrente IS NULL OR valor_recorrente = 0) AND valor_pontual > 0 THEN 'Pontual'
            WHEN valor_recorrente > 0 AND valor_pontual > 0 THEN 'Misto'
            ELSE 'Sem valor'
          END as tipo,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as total
        FROM crm_deal
        ${whereClause}
        GROUP BY 
          CASE 
            WHEN valor_recorrente > 0 AND (valor_pontual IS NULL OR valor_pontual = 0) THEN 'Recorrente'
            WHEN (valor_recorrente IS NULL OR valor_recorrente = 0) AND valor_pontual > 0 THEN 'Pontual'
            WHEN valor_recorrente > 0 AND valor_pontual > 0 THEN 'Misto'
            ELSE 'Sem valor'
          END
        ORDER BY total DESC
      `);

      res.json(result.rows.map((row: any) => ({
        tipo: row.tipo,
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching tipo contrato:", error);
      res.status(500).json({ error: "Failed to fetch tipo contrato" });
    }
  });

  // Endpoint para buscar fotos de usuários via email (auth_users do app)
  app.get("/api/user-photos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          LOWER(TRIM(email)) as email,
          name,
          picture
        FROM auth_users
        WHERE email IS NOT NULL AND picture IS NOT NULL
      `);

      const photoMap: Record<string, string> = {};
      result.rows.forEach((row: any) => {
        if (row.picture && row.email) {
          photoMap[row.email] = row.picture;
        }
      });

      res.json(photoMap);
    } catch (error) {
      console.error("[api] Error fetching user photos:", error);
      res.status(500).json({ error: "Failed to fetch user photos" });
    }
  });

  // Endpoint para buscar fotos de closers via email (JOIN com auth_users)
  app.get("/api/closers/photos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          c.id,
          c.name,
          LOWER(TRIM(c.email)) as closer_email,
          a.picture
        FROM crm_closers c
        LEFT JOIN auth_users a ON LOWER(TRIM(c.email)) = LOWER(TRIM(a.email))
        WHERE c.email IS NOT NULL
      `);

      const photoMap: Record<string, string> = {};
      result.rows.forEach((row: any) => {
        if (row.picture && row.name) {
          photoMap[row.name] = row.picture;
        }
      });

      res.json(photoMap);
    } catch (error) {
      console.error("[api] Error fetching closer photos:", error);
      res.status(500).json({ error: "Failed to fetch closer photos" });
    }
  });

  // Endpoint para buscar fotos de SDRs via email (JOIN com auth_users)
  app.get("/api/sdrs/photos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          u.id,
          u.nome,
          LOWER(TRIM(u.email)) as sdr_email,
          a.picture
        FROM crm_users u
        LEFT JOIN auth_users a ON LOWER(TRIM(u.email)) = LOWER(TRIM(a.email))
        WHERE u.email IS NOT NULL
      `);

      const photoMap: Record<string, string> = {};
      result.rows.forEach((row: any) => {
        if (row.picture && row.nome) {
          photoMap[row.nome] = row.picture;
        }
      });

      res.json(photoMap);
    } catch (error) {
      console.error("[api] Error fetching SDR photos:", error);
      res.status(500).json({ error: "Failed to fetch SDR photos" });
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

  // ============================================
  // Acessos Module - Clients API
  // ============================================

  // Ensure clients table has status column
  try {
    await db.execute(sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'`);
  } catch (e) {
    // Column may already exist
  }

  // Helper function to map client snake_case to camelCase
  const mapClient = (row: any) => ({
    id: row.id,
    name: row.name,
    cnpj: row.cnpj,
    status: row.status || 'ativo',
    additionalInfo: row.additional_info,
    linkedClientCnpj: row.linked_client_cnpj,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    credential_count: parseInt(row.credential_count) || 0,
  });

  // Helper function to map credential snake_case to camelCase
  const mapCredential = (row: any) => ({
    id: row.id,
    clientId: row.client_id,
    platform: row.platform,
    username: row.username,
    password: row.password,
    accessUrl: row.access_url,
    observations: row.observations,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  // GET all clients with credential count and status from caz_clientes
  app.get("/api/acessos/clients", async (req, res) => {
    try {
      const search = req.query.search as string;
      
      // First get the turbo_tools count for Turbo Partners specifically
      const turboToolsCount = await db.execute(sql`SELECT COUNT(*) as count FROM turbo_tools`);
      const turboCount = parseInt((turboToolsCount.rows[0] as any)?.count) || 0;
      
      // Get caz_clientes status map for lookup
      const cazStatusResult = await db.execute(sql`SELECT cnpj, ativo, id FROM caz_clientes WHERE cnpj IS NOT NULL`);
      const cazStatusMap = new Map<string, { ativo: string; id: number }>();
      for (const row of cazStatusResult.rows as any[]) {
        if (row.cnpj) {
          cazStatusMap.set(row.cnpj.toLowerCase().replace(/[^\d]/g, ''), { ativo: row.ativo, id: row.id });
        }
      }
      
      // Get all credentials platforms for each client
      const credentialsPlatformsResult = await db.execute(sql`
        SELECT client_id, array_agg(DISTINCT platform) as platforms 
        FROM credentials 
        GROUP BY client_id
      `);
      const clientPlatformsMap = new Map<string, string[]>();
      for (const row of credentialsPlatformsResult.rows as any[]) {
        clientPlatformsMap.set(row.client_id, row.platforms || []);
      }
      
      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await db.execute(sql`
          SELECT c.*, 
            CASE 
              WHEN LOWER(TRIM(c.name)) = 'turbo partners' THEN ${turboCount}
              ELSE (SELECT COUNT(*) FROM credentials cr WHERE cr.client_id = c.id)
            END as credential_count
          FROM clients c 
          WHERE LOWER(c.name) LIKE LOWER(${searchPattern}) OR LOWER(c.cnpj) LIKE LOWER(${searchPattern})
          ORDER BY c.created_at DESC
        `);
      } else {
        result = await db.execute(sql`
          SELECT c.*, 
            CASE 
              WHEN LOWER(TRIM(c.name)) = 'turbo partners' THEN ${turboCount}
              ELSE (SELECT COUNT(*) FROM credentials cr WHERE cr.client_id = c.id)
            END as credential_count
          FROM clients c 
          ORDER BY c.created_at DESC
        `);
      }
      
      // Map with status from caz_clientes
      const mapped = result.rows.map((row: any) => {
        let status = row.status || 'ativo';
        let cazClienteId: number | null = null;
        
        // Look up status by linked_client_cnpj
        if (row.linked_client_cnpj) {
          const normalizedCnpj = row.linked_client_cnpj.toLowerCase().replace(/[^\d]/g, '');
          const cazData = cazStatusMap.get(normalizedCnpj);
          if (cazData) {
            // Check if ativo field indicates active status (case-insensitive)
            const ativoValue = String(cazData.ativo || '').toLowerCase().trim();
            status = (ativoValue === 'ativo' || ativoValue === 'sim' || ativoValue === 'true' || ativoValue === '1') ? 'ativo' : 'cancelado';
            cazClienteId = cazData.id;
          }
        }
        
        // Get platforms for this client
        const platforms = clientPlatformsMap.get(row.id) || [];
        
        return {
          ...mapClient(row),
          status,
          cazClienteId,
          platforms,
        };
      });
      
      res.json(mapped);
    } catch (error) {
      console.error("[api] Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // GET caz_clientes (main database clients) for selection
  app.get("/api/acessos/caz-clientes", async (req, res) => {
    try {
      const search = req.query.search as string;
      
      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await db.execute(sql`
          SELECT 
            caz.id, 
            caz.nome, 
            caz.cnpj, 
            caz.ativo,
            CASE WHEN cl.id IS NOT NULL THEN true ELSE false END as has_credentials
          FROM caz_clientes caz
          LEFT JOIN clients cl ON LOWER(caz.nome) = LOWER(cl.name)
          WHERE LOWER(caz.nome) LIKE LOWER(${searchPattern}) OR LOWER(caz.cnpj) LIKE LOWER(${searchPattern})
          ORDER BY caz.nome ASC
          LIMIT 50
        `);
      } else {
        result = await db.execute(sql`
          SELECT 
            caz.id, 
            caz.nome, 
            caz.cnpj, 
            caz.ativo,
            CASE WHEN cl.id IS NOT NULL THEN true ELSE false END as has_credentials
          FROM caz_clientes caz
          LEFT JOIN clients cl ON LOWER(caz.nome) = LOWER(cl.name)
          ORDER BY caz.nome ASC
          LIMIT 50
        `);
      }
      
      // Map to standard format
      const mapped = result.rows.map((row: any) => ({
        id: row.id,
        name: row.nome,
        cnpj: row.cnpj,
        status: row.ativo === 'Ativo' ? 'ativo' : 'cancelado',
        hasCredentials: row.has_credentials === true || row.has_credentials === 't' || row.has_credentials === 'true',
      }));
      
      res.json(mapped);
    } catch (error) {
      console.error("[api] Error fetching caz_clientes:", error);
      res.status(500).json({ error: "Failed to fetch caz_clientes" });
    }
  });

  // GET batch clients with credentials (must be before :id route)
  app.get("/api/acessos/clients/batch", async (req, res) => {
    try {
      const idsParam = req.query.ids as string;
      if (!idsParam) {
        return res.status(400).json({ error: "ids parameter is required" });
      }
      
      const ids = idsParam.split(',').filter(id => id.trim());
      if (ids.length === 0) {
        return res.json([]);
      }
      
      // Build the array format for PostgreSQL
      const idsArray = `{${ids.join(',')}}`;
      
      const clientsResult = await db.execute(sql`
        SELECT * FROM clients WHERE id::text = ANY(${idsArray}::text[])
      `);
      
      if (clientsResult.rows.length === 0) {
        return res.json([]);
      }
      
      const credentialsResult = await db.execute(sql`
        SELECT * FROM credentials WHERE client_id::text = ANY(${idsArray}::text[]) ORDER BY platform
      `);
      
      const credentialsByClientId = new Map<string, any[]>();
      for (const cred of credentialsResult.rows) {
        const clientId = String((cred as any).client_id);
        if (!credentialsByClientId.has(clientId)) {
          credentialsByClientId.set(clientId, []);
        }
        credentialsByClientId.get(clientId)!.push(mapCredential(cred));
      }
      
      const result = clientsResult.rows.map((client: any) => ({
        ...mapClient(client),
        credentials: credentialsByClientId.get(String(client.id)) || []
      }));
      
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching batch clients:", error);
      res.status(500).json({ error: "Failed to fetch batch clients" });
    }
  });

  // POST bulk update client CNPJs by name matching
  app.post("/api/acessos/clients/bulk-update-cnpj", async (req, res) => {
    try {
      const { mappings } = req.body;
      
      if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ error: "mappings array is required" });
      }
      
      if (mappings.length === 0) {
        return res.json({ updated: 0, notFound: [], message: "No mappings provided" });
      }
      
      // Validate each mapping has name and cnpj
      for (const mapping of mappings) {
        if (!mapping.name || typeof mapping.name !== 'string') {
          return res.status(400).json({ error: "Each mapping must have a 'name' string" });
        }
        if (!mapping.cnpj || typeof mapping.cnpj !== 'string') {
          return res.status(400).json({ error: "Each mapping must have a 'cnpj' string" });
        }
      }
      
      const result = await storage.bulkUpdateClientCnpj(mappings);
      
      res.json({
        ...result,
        total: mappings.length,
        message: `Updated ${result.updated} client(s), ${result.notFound.length} not found`
      });
    } catch (error) {
      console.error("[api] Error bulk updating client CNPJs:", error);
      res.status(500).json({ error: "Failed to bulk update client CNPJs" });
    }
  });

  // GET single client with credentials
  app.get("/api/acessos/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const clientResult = await db.execute(sql`SELECT * FROM clients WHERE id = ${id}`);
      
      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const credentialsResult = await db.execute(sql`
        SELECT * FROM credentials WHERE client_id = ${id} ORDER BY platform
      `);
      
      const client = clientResult.rows[0] as any;
      res.json({
        ...mapClient(client),
        credentials: credentialsResult.rows.map(mapCredential)
      });
    } catch (error) {
      console.error("[api] Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  // POST create client
  app.post("/api/acessos/clients", async (req, res) => {
    try {
      const { name, cnpj, status, additionalInfo } = req.body;
      const createdBy = (req as any).user?.email || null;
      
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO clients (name, cnpj, status, additional_info, created_by)
        VALUES (${name}, ${cnpj || null}, ${status || 'ativo'}, ${additionalInfo || null}, ${createdBy})
        RETURNING *
      `);
      
      res.status(201).json(mapClient(result.rows[0]));
    } catch (error) {
      console.error("[api] Error creating client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  // GET turbo_tools data for display in Acessos
  app.get("/api/acessos/turbo-tools", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, name, login, password, site, observations
        FROM turbo_tools
        ORDER BY name ASC
      `);
      
      // Map to credential-like format for display
      const tools = result.rows.map((row: any) => ({
        id: row.id,
        platform: row.name,
        username: row.login,
        password: row.password,
        accessUrl: row.site,
        observations: row.observations,
      }));
      
      res.json(tools);
    } catch (error) {
      console.error("[api] Error fetching turbo_tools:", error);
      res.status(500).json({ error: "Failed to fetch turbo_tools" });
    }
  });

  // PATCH update client
  app.patch("/api/acessos/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, cnpj, status, additionalInfo, linkedClientCnpj } = req.body;
      
      const result = await db.execute(sql`
        UPDATE clients 
        SET name = COALESCE(${name}, name),
            cnpj = COALESCE(${cnpj}, cnpj),
            status = COALESCE(${status}, status),
            additional_info = COALESCE(${additionalInfo}, additional_info),
            linked_client_cnpj = ${linkedClientCnpj ?? null},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      res.json(mapClient(result.rows[0]));
    } catch (error) {
      console.error("[api] Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // GET cupClientes list for linking
  app.get("/api/acessos/cup-clientes", async (req, res) => {
    try {
      const search = req.query.search as string;
      
      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await db.execute(sql`
          SELECT nome, cnpj, status 
          FROM cup_clientes 
          WHERE (nome ILIKE ${searchPattern} OR cnpj ILIKE ${searchPattern})
          AND LOWER(status) = 'ativo'
          ORDER BY nome
          LIMIT 50
        `);
      } else {
        result = await db.execute(sql`
          SELECT nome, cnpj, status 
          FROM cup_clientes 
          WHERE LOWER(status) = 'ativo'
          ORDER BY nome
          LIMIT 100
        `);
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching cup_clientes:", error);
      res.status(500).json({ error: "Failed to fetch cup_clientes" });
    }
  });

  // POST update ClickUp links for clientes based on CNPJ
  app.post("/api/clientes/update-clickup-links", async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Data must be an array of {link, cnpj} objects" });
      }
      
      let updated = 0;
      let notFound = 0;
      const errors: string[] = [];
      
      for (const item of data) {
        const { link, cnpj } = item;
        
        if (!link || !cnpj) {
          errors.push(`Invalid item: missing link or cnpj`);
          continue;
        }
        
        // Clean CNPJ - remove any non-numeric characters
        const cleanCnpj = cnpj.replace(/\D/g, '');
        
        try {
          const result = await db.execute(sql`
            UPDATE cup_clientes 
            SET link_lista_clickup = ${link}
            WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = ${cleanCnpj}
            RETURNING cnpj
          `);
          
          if (result.rows.length > 0) {
            updated++;
          } else {
            notFound++;
          }
        } catch (err) {
          errors.push(`Error updating CNPJ ${cnpj}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      res.json({ 
        success: true, 
        updated, 
        notFound, 
        total: data.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined
      });
    } catch (error) {
      console.error("[api] Error updating ClickUp links:", error);
      res.status(500).json({ error: "Failed to update ClickUp links" });
    }
  });

  // POST AI matching for client linking - improved algorithm
  app.post("/api/acessos/ai-match-clients", async (req, res) => {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Get unlinked acessos clients (from clients table - module Acessos)
      const acessosClients = await db.execute(sql`
        SELECT id, name FROM clients WHERE linked_client_cnpj IS NULL
      `);
      
      // Get all caz_clientes (Conta Azul - mesma tabela da aba Clientes & Contratos)
      const cazClientes = await db.execute(sql`
        SELECT id, nome, cnpj FROM caz_clientes WHERE nome IS NOT NULL
      `);
      
      if (acessosClients.rows.length === 0 || cazClientes.rows.length === 0) {
        return res.json({ matches: [], message: "Não há clientes para vincular ou não há clientes no Conta Azul" });
      }
      
      // Common company suffixes to remove for better matching
      const companySuffixes = [
        'ltda', 'me', 'mei', 'eireli', 'epp', 'sa', 's a', 's/a',
        'comercio', 'comercial', 'servicos', 'solucoes', 'industria',
        'brasil', 'br', 'do brasil', 'group', 'grupo', 'holding',
        'assessoria', 'consultoria', 'tecnologia', 'digital',
        'marketing', 'agencia', 'studio', 'estudio', 'lab', 'labs'
      ];
      
      // Normalize function for name comparison
      const normalizeName = (name: string): string => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // remove accents
          .replace(/[^a-z0-9\s]/g, '') // remove special chars
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      // Remove common suffixes for deeper comparison
      const removeCompanySuffixes = (normalized: string): string => {
        let result = normalized;
        for (const suffix of companySuffixes) {
          const regex = new RegExp(`\\b${suffix}\\b`, 'g');
          result = result.replace(regex, '');
        }
        return result.replace(/\s+/g, ' ').trim();
      };
      
      // Simple Levenshtein distance for similarity calculation
      const levenshteinDistance = (a: string, b: string): number => {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            const cost = a[j - 1] === b[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + cost
            );
          }
        }
        return matrix[b.length][a.length];
      };
      
      const similarity = (a: string, b: string): number => {
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        return 1 - levenshteinDistance(a, b) / maxLen;
      };
      
      const acessosList = acessosClients.rows.map((r: any) => {
        const normalized = normalizeName(r.name || '');
        return { 
          id: r.id, 
          name: r.name,
          normalized,
          core: removeCompanySuffixes(normalized)
        };
      });
      
      const cazList = cazClientes.rows.map((r: any) => {
        const normalized = normalizeName(r.nome || '');
        return { 
          id: r.id,
          nome: r.nome, 
          cnpj: r.cnpj,
          normalized,
          core: removeCompanySuffixes(normalized)
        };
      });
      
      // Create lookup maps
      const cazByNormalized = new Map<string, any>();
      const cazByCore = new Map<string, any>();
      cazList.forEach(c => {
        if (c.normalized) cazByNormalized.set(c.normalized, c);
        if (c.core && c.core.length >= 3) cazByCore.set(c.core, c);
      });
      
      const matches: any[] = [];
      const unmatchedAcessos: any[] = [];
      
      // First pass: exact normalized name match (HIGH confidence)
      for (const acessos of acessosList) {
        const exactMatch = cazByNormalized.get(acessos.normalized);
        if (exactMatch) {
          matches.push({
            acessosId: acessos.id,
            acessosName: acessos.name,
            cazId: exactMatch.id,
            cazCnpj: exactMatch.cnpj,
            cazNome: exactMatch.nome,
            confidence: "high",
            reason: "Nome idêntico (match exato)"
          });
          continue;
        }
        
        // Second pass: core name match after removing suffixes (HIGH confidence)
        const coreMatch = cazByCore.get(acessos.core);
        if (coreMatch && acessos.core.length >= 3) {
          matches.push({
            acessosId: acessos.id,
            acessosName: acessos.name,
            cazId: coreMatch.id,
            cazCnpj: coreMatch.cnpj,
            cazNome: coreMatch.nome,
            confidence: "high",
            reason: "Nome principal idêntico (sem sufixos empresariais)"
          });
          continue;
        }
        
        // Third pass: high similarity match (MEDIUM confidence) 
        let bestMatch = null;
        let bestSimilarity = 0;
        for (const caz of cazList) {
          const sim = similarity(acessos.core, caz.core);
          if (sim > bestSimilarity && sim >= 0.8) {
            bestSimilarity = sim;
            bestMatch = caz;
          }
        }
        
        if (bestMatch && bestSimilarity >= 0.8) {
          matches.push({
            acessosId: acessos.id,
            acessosName: acessos.name,
            cazId: bestMatch.id,
            cazCnpj: bestMatch.cnpj,
            cazNome: bestMatch.nome,
            confidence: "medium",
            reason: `Similaridade alta (${Math.round(bestSimilarity * 100)}%)`
          });
          continue;
        }
        
        unmatchedAcessos.push(acessos);
      }
      
      // Fourth pass: Add LOW confidence matches for remaining unmatched (50-79% similarity)
      for (const acessos of unmatchedAcessos) {
        let bestMatch = null;
        let bestSimilarity = 0;
        for (const caz of cazList) {
          const sim = similarity(acessos.core, caz.core);
          if (sim > bestSimilarity && sim >= 0.5 && sim < 0.8) {
            bestSimilarity = sim;
            bestMatch = caz;
          }
        }
        
        if (bestMatch && bestSimilarity >= 0.5) {
          matches.push({
            acessosId: acessos.id,
            acessosName: acessos.name,
            cazId: bestMatch.id,
            cazCnpj: bestMatch.cnpj,
            cazNome: bestMatch.nome,
            confidence: "low",
            reason: `Similaridade parcial (${Math.round(bestSimilarity * 100)}%)`
          });
        }
      }
      
      // Sort by confidence: high first, then medium, then low
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      matches.sort((a, b) => 
        (confidenceOrder[a.confidence as keyof typeof confidenceOrder] || 2) - 
        (confidenceOrder[b.confidence as keyof typeof confidenceOrder] || 2)
      );
      
      res.json({ matches });
    } catch (error) {
      console.error("[api] Error in AI matching:", error);
      res.status(500).json({ error: "Failed to run AI matching" });
    }
  });

  // POST apply AI match - link a single client
  app.post("/api/acessos/apply-match", async (req, res) => {
    try {
      const { acessosId, cazCnpj, cupCnpj } = req.body;
      const cnpjToLink = cazCnpj || cupCnpj; // Support both old and new field names
      
      if (!acessosId || !cnpjToLink) {
        return res.status(400).json({ error: "acessosId and cazCnpj are required" });
      }
      
      const result = await db.execute(sql`
        UPDATE clients 
        SET linked_client_cnpj = ${cnpjToLink},
            updated_at = NOW()
        WHERE id = ${acessosId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      res.json({ success: true, client: mapClient(result.rows[0]) });
    } catch (error) {
      console.error("[api] Error applying match:", error);
      res.status(500).json({ error: "Failed to apply match" });
    }
  });

  // GET credentials by linked client CNPJ (for client detail page)
  app.get("/api/acessos/credentials-by-cnpj/:cnpj", async (req, res) => {
    try {
      const { cnpj } = req.params;
      // Normalize CNPJ for comparison (remove all non-digits)
      const normalizedCnpj = cnpj.replace(/[^\d]/g, '');
      
      const result = await db.execute(sql`
        SELECT 
          c.id as client_id,
          c.name as client_name,
          cr.id as credential_id,
          cr.platform,
          cr.username,
          cr.password,
          cr.access_url,
          cr.observations
        FROM clients c
        INNER JOIN credentials cr ON c.id = cr.client_id
        WHERE REGEXP_REPLACE(c.linked_client_cnpj, '[^0-9]', '', 'g') = ${normalizedCnpj}
           OR LOWER(TRIM(c.name)) = (
             SELECT LOWER(TRIM(nome)) FROM caz_clientes 
             WHERE REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = ${normalizedCnpj}
             LIMIT 1
           )
        ORDER BY cr.platform
      `);
      
      const grouped: { [key: string]: any } = {};
      
      for (const row of result.rows as any[]) {
        const clientId = row.client_id;
        if (!grouped[clientId]) {
          grouped[clientId] = {
            id: clientId,
            name: row.client_name,
            credentials: []
          };
        }
        if (row.credential_id) {
          grouped[clientId].credentials.push({
            id: row.credential_id,
            platform: row.platform,
            username: row.username,
            password: row.password,
            accessUrl: row.access_url,
            observations: row.observations
          });
        }
      }
      
      res.json(Object.values(grouped));
    } catch (error) {
      console.error("[api] Error fetching credentials by CNPJ:", error);
      res.status(500).json({ error: "Failed to fetch credentials" });
    }
  });

  // DELETE client (cascades to credentials)
  app.delete("/api/acessos/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Delete credentials first
      await db.execute(sql`DELETE FROM credentials WHERE client_id = ${id}`);
      
      // Delete client
      const result = await db.execute(sql`DELETE FROM clients WHERE id = ${id} RETURNING id`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // ============================================
  // Acessos Module - Credentials API
  // ============================================

  // GET credentials for a client
  app.get("/api/acessos/credentials/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const result = await db.execute(sql`
        SELECT * FROM credentials WHERE client_id = ${clientId} ORDER BY platform
      `);
      res.json(result.rows.map(mapCredential));
    } catch (error) {
      console.error("[api] Error fetching credentials:", error);
      res.status(500).json({ error: "Failed to fetch credentials" });
    }
  });

  // POST create credential
  app.post("/api/acessos/credentials", async (req, res) => {
    try {
      const { clientId, platform, username, password, accessUrl, observations } = req.body;
      const createdBy = (req as any).user?.email || null;
      
      if (!clientId || !platform) {
        return res.status(400).json({ error: "clientId and platform are required" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO credentials (client_id, platform, username, password, access_url, observations, created_by)
        VALUES (${clientId}, ${platform}, ${username || null}, ${password || null}, ${accessUrl || null}, ${observations || null}, ${createdBy})
        RETURNING *
      `);
      
      res.status(201).json(mapCredential(result.rows[0]));
    } catch (error) {
      console.error("[api] Error creating credential:", error);
      res.status(500).json({ error: "Failed to create credential" });
    }
  });

  // PATCH update credential
  app.patch("/api/acessos/credentials/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { platform, username, password, accessUrl, observations } = req.body;
      
      const result = await db.execute(sql`
        UPDATE credentials 
        SET platform = COALESCE(${platform}, platform),
            username = COALESCE(${username}, username),
            password = COALESCE(${password}, password),
            access_url = COALESCE(${accessUrl}, access_url),
            observations = COALESCE(${observations}, observations),
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Credential not found" });
      }
      
      res.json(mapCredential(result.rows[0]));
    } catch (error) {
      console.error("[api] Error updating credential:", error);
      res.status(500).json({ error: "Failed to update credential" });
    }
  });

  // DELETE credential
  app.delete("/api/acessos/credentials/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`DELETE FROM credentials WHERE id = ${id} RETURNING id`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Credential not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting credential:", error);
      res.status(500).json({ error: "Failed to delete credential" });
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
        result = await db.execute(sql`SELECT * FROM courses WHERE ${whereClause} ORDER BY created_at DESC`);
      } else {
        result = await db.execute(sql`SELECT * FROM courses ORDER BY created_at DESC`);
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
      const result = await db.execute(sql`SELECT * FROM courses WHERE id = ${id}`);
      
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
      
      const result = await db.execute(sql`
        INSERT INTO courses (nome, status, tema_principal, plataforma, url, login, senha, created_by)
        VALUES (${nome}, ${status || 'sem_status'}, ${temaPrincipal || null}, ${plataforma || null}, ${url || null}, ${login || null}, ${senha || null}, ${createdBy})
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
        UPDATE courses 
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
      const result = await db.execute(sql`DELETE FROM courses WHERE id = ${id} RETURNING id`);
      
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
        result = await db.execute(sql`SELECT * FROM benefits WHERE ${whereClause} ORDER BY created_at DESC`);
      } else {
        result = await db.execute(sql`SELECT * FROM benefits ORDER BY created_at DESC`);
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
      const result = await db.execute(sql`SELECT * FROM benefits WHERE id = ${id}`);
      
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
        INSERT INTO benefits (empresa, cupom, desconto, site, segmento, created_by)
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
        UPDATE benefits 
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
      const result = await db.execute(sql`DELETE FROM benefits WHERE id = ${id} RETURNING id`);
      
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
          SELECT * FROM turbo_tools
          WHERE LOWER(name) LIKE LOWER(${searchPattern}) OR LOWER(site) LIKE LOWER(${searchPattern})
          ORDER BY created_at DESC
        `);
      } else {
        result = await db.execute(sql`SELECT * FROM turbo_tools ORDER BY created_at DESC`);
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
      const result = await db.execute(sql`SELECT * FROM turbo_tools WHERE id = ${id}`);
      
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
      const result = await db.execute(sql`DELETE FROM turbo_tools WHERE id = ${id} RETURNING id`);
      
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

  // GET generate notifications
  app.get("/api/notifications/generate", async (req, res) => {
    try {
      const created: any[] = [];
      const today = new Date();
      
      // 1. Birthday notifications (today + next 3 days)
      const birthdayResult = await db.execute(sql`
        SELECT id, nome, aniversario as nascimento
        FROM rh_pessoal
        WHERE aniversario IS NOT NULL
          AND demissao IS NULL
          AND (
            (EXTRACT(MONTH FROM aniversario) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM aniversario) = EXTRACT(DAY FROM CURRENT_DATE))
            OR (EXTRACT(MONTH FROM aniversario) = EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 day') AND EXTRACT(DAY FROM aniversario) = EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '1 day'))
            OR (EXTRACT(MONTH FROM aniversario) = EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '2 days') AND EXTRACT(DAY FROM aniversario) = EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '2 days'))
            OR (EXTRACT(MONTH FROM aniversario) = EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '3 days') AND EXTRACT(DAY FROM aniversario) = EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '3 days'))
          )
      `);
      
      for (const colab of birthdayResult.rows as any[]) {
        const birthDate = new Date(colab.nascimento);
        const birthMonth = birthDate.getMonth();
        const birthDay = birthDate.getDate();
        const uniqueKey = `aniversario_${colab.id}_${today.getFullYear()}-${String(birthMonth + 1).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
        
        const exists = await storage.notificationExists(uniqueKey);
        if (!exists) {
          const thisYearBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
          const diffDays = Math.round((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          let title = '';
          if (diffDays <= 0) {
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
            uniqueKey,
            expiresAt: new Date(today.getFullYear(), birthMonth, birthDay + 1),
          });
          created.push(notification);
        }
      }
      
      // 2. Contract expiring notifications (next 30 days)
      // Using cup_contratos table with JOIN to cup_clientes
      const contractResult = await db.execute(sql`
        SELECT c.id_subtask as id, cl.cnpj, c.data_encerramento, cl.nome as client_name, c.servico
        FROM cup_contratos c
        LEFT JOIN cup_clientes cl ON cl.task_id = c.id_task
        WHERE c.data_encerramento IS NOT NULL
          AND c.data_encerramento >= CURRENT_DATE
          AND c.data_encerramento <= CURRENT_DATE + INTERVAL '30 days'
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
            message: `O contrato de ${clientName} vence em ${endDate.toLocaleDateString('pt-BR')}.`,
            entityId: String(contract.id),
            entityType: 'contrato',
            uniqueKey,
            expiresAt: endDate,
          });
          created.push(notification);
        }
      }
      
      // 3. Overdue payments notifications (>7 days overdue)
      // Using caz_parcelas table with id_cliente for grouping, with client name from caz_clientes
      const overdueResult = await db.execute(sql`
        SELECT 
          p.id_cliente, 
          c.nome as cliente_nome,
          COUNT(*) as parcelas_vencidas, 
          SUM(p.valor_bruto) as total_devido
        FROM caz_parcelas p
        LEFT JOIN caz_clientes c ON p.id_cliente::integer = c.id
        WHERE p.data_vencimento < CURRENT_DATE - INTERVAL '7 days'
          AND p.status != 'Pago'
          AND p.id_cliente IS NOT NULL
        GROUP BY p.id_cliente, c.nome
        HAVING COUNT(*) >= 1
      `);
      
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
      for (const overdue of overdueResult.rows as any[]) {
        const clientId = overdue.id_cliente || 'unknown';
        const clientName = overdue.cliente_nome || 'Cliente não identificado';
        const uniqueKey = `inadimplencia_${clientId}_${currentMonth}`;
        
        const exists = await storage.notificationExists(uniqueKey);
        if (!exists) {
          const totalDevido = Number(overdue.total_devido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          
          const notification = await storage.createNotification({
            type: 'inadimplencia',
            title: `Inadimplência - ${clientName}`,
            message: `${overdue.parcelas_vencidas} parcela(s) vencida(s) há mais de 7 dias. Total: ${totalDevido}`,
            entityId: clientId,
            entityType: 'cliente',
            uniqueKey,
          });
          created.push(notification);
        }
      }
      
      res.json({ 
        success: true, 
        created: created.length,
        notifications: created 
      });
    } catch (error) {
      console.error("[api] Error generating notifications:", error);
      res.status(500).json({ error: "Failed to generate notifications" });
    }
  });

  // OKR 2026 Routes
  app.get("/api/okr2026/dashboard", isAuthenticated, async (req, res) => {
    try {
      const { getDashboardMetrics, getTargets } = await import("./okr2026/metricsAdapter");
      const metrics = await getDashboardMetrics();
      const targets = getTargets();
      res.json({ metrics, targets });
    } catch (error) {
      console.error("[api] Error fetching OKR dashboard:", error);
      res.status(500).json({ error: "Failed to fetch OKR dashboard" });
    }
  });

  app.get("/api/okr2026/krs", isAuthenticated, async (req, res) => {
    try {
      const { getKRs } = await import("./okr2026/metricsAdapter");
      const krs = getKRs();
      res.json({ krs });
    } catch (error) {
      console.error("[api] Error fetching OKR KRs:", error);
      res.status(500).json({ error: "Failed to fetch OKR KRs" });
    }
  });

  app.get("/api/okr2026/initiatives", isAuthenticated, async (req, res) => {
    try {
      const { getInitiatives } = await import("./okr2026/metricsAdapter");
      const data = getInitiatives();
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching OKR initiatives:", error);
      res.status(500).json({ error: "Failed to fetch OKR initiatives" });
    }
  });

  app.get("/api/okr2026/targets", isAuthenticated, async (req, res) => {
    try {
      const { getTargets } = await import("./okr2026/metricsAdapter");
      res.json(getTargets());
    } catch (error) {
      console.error("[api] Error fetching OKR targets:", error);
      res.status(500).json({ error: "Failed to fetch OKR targets" });
    }
  });

  app.get("/api/okr2026/manual-metrics", isAuthenticated, async (req, res) => {
    try {
      const { getManualMetrics } = await import("./okr2026/metricsAdapter");
      res.json(getManualMetrics());
    } catch (error) {
      console.error("[api] Error fetching OKR manual metrics:", error);
      res.status(500).json({ error: "Failed to fetch OKR manual metrics" });
    }
  });

  app.get("/api/okr2026/coverage", isAuthenticated, async (req, res) => {
    try {
      const { getCoverage } = await import("./okr2026/metricsAdapter");
      const coverage = getCoverage();
      res.json(coverage);
    } catch (error) {
      console.error("[api] Error fetching OKR coverage:", error);
      res.status(500).json({ error: "Failed to fetch OKR coverage" });
    }
  });

  app.get("/api/okr2026/config", isAuthenticated, async (req, res) => {
    try {
      const { getOKRConfig, getObjectives } = await import("./okr2026/metricsAdapter");
      res.json({
        config: getOKRConfig(),
        objectives: getObjectives()
      });
    } catch (error) {
      console.error("[api] Error fetching OKR config:", error);
      res.status(500).json({ error: "Failed to fetch OKR config" });
    }
  });

  app.get("/api/okr2026/summary", isAuthenticated, async (req, res) => {
    try {
      const { getCached, setCache } = await import("./okr2026/cache");
      const { 
        getDashboardMetrics, 
        getObjectives, 
        getKRs, 
        getTargets, 
        calculateProgress, 
        getStatus,
        getMrrSerie
      } = await import("./okr2026/metricsAdapter");
      const { objectiveRegistry, krRegistry } = await import("./okr2026/okrRegistry");
      
      const period = (req.query.period as string) || "YTD";
      const bu = (req.query.bu as string) || "all";
      
      const validPeriods = ["YTD", "Q1", "Q2", "Q3", "Q4", "Last12m"];
      const validBUs = ["all", "turbooh", "tech", "commerce"];
      
      const normalizedPeriod = validPeriods.includes(period) ? period : "YTD";
      const normalizedBU = validBUs.includes(bu) ? bu : "all";
      
      const cacheKey = `okr_summary_${normalizedPeriod}_${normalizedBU}`;
      
      const cached = getCached<any>(cacheKey);
      if (cached) {
        return res.json({
          ...cached,
          meta: { ...cached.meta, cacheHit: true }
        });
      }
      
      const initiativesData = await import("./okr2026/initiatives.json");
      const initiatives = initiativesData.initiatives || [];
      
      const metrics = await getDashboardMetrics();
      const targets = getTargets();
      const objectives = objectiveRegistry;
      const krsRaw = krRegistry;
      
      const quarter = getCurrentQuarter();
      
      const krs = krsRaw.map(kr => {
        let atual: number | null = null;
        let target: number | null = null;
        
        const metricMap: Record<string, number | null> = {
          mrr_active: metrics.mrr_ativo,
          revenue_net: metrics.receita_liquida_ytd,
          clients_active: metrics.clientes_ativos,
          revenue_per_head: metrics.receita_por_head,
          ebitda: metrics.ebitda_ytd,
          cash_generation: metrics.geracao_caixa_ytd,
          cash_balance: metrics.caixa_atual,
          inadimplencia_pct: metrics.inadimplencia_percentual,
          gross_churn_pct: metrics.gross_mrr_churn_percentual,
          net_churn_pct: metrics.net_churn_mrr_percentual,
          logo_churn_pct: metrics.logo_churn_percentual,
          turbooh_receita: metrics.turbooh_receita,
          turbooh_resultado: metrics.turbooh_resultado,
          turbooh_margem_pct: metrics.turbooh_margem_pct,
          tech_projetos_entregues: metrics.tech_projetos_entregues,
          tech_freelancers_pct: metrics.tech_freelancers_percentual,
          mrr_por_head: metrics.mrr_por_head
        };
        
        atual = metricMap[kr.metricKey] ?? null;
        
        target = kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
        
        const progress = atual !== null && target !== null 
          ? calculateProgress(atual, target, kr.direction) 
          : null;
        const status = progress !== null ? getStatus(progress, kr.direction) : "gray";
        
        return {
          ...kr,
          currentValue: atual,
          target,
          progress,
          status
        };
      });
      
      const getMrrTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "mrr_active");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };
      
      const getRevenueTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "revenue_net");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };
      
      const getEbitdaTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "ebitda");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };
      
      const getInadimplenciaTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "delinquency_pct");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };
      
      const getNetChurnTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "net_mrr_churn_pct");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };
      
      const mrrTarget = getMrrTarget();
      const revenueTarget = getRevenueTarget();
      const ebitdaTarget = getEbitdaTarget();
      const inadTarget = getInadimplenciaTarget();
      const netChurnTarget = getNetChurnTarget();
      
      const highlights = {
        mrr: {
          value: metrics.mrr_ativo,
          target: mrrTarget,
          progress: mrrTarget ? calculateProgress(metrics.mrr_ativo, mrrTarget, "higher") : null
        },
        revenue: {
          value: metrics.receita_liquida_ytd,
          target: revenueTarget,
          progress: revenueTarget ? calculateProgress(metrics.receita_liquida_ytd, revenueTarget, "higher") : null
        },
        ebitda: {
          value: metrics.ebitda_ytd,
          target: ebitdaTarget,
          progress: ebitdaTarget ? calculateProgress(metrics.ebitda_ytd, ebitdaTarget, "higher") : null
        },
        inadimplencia: {
          value: metrics.inadimplencia_percentual,
          target: inadTarget,
          status: inadTarget && metrics.inadimplencia_percentual <= inadTarget ? "green" : "red"
        },
        net_churn: {
          value: metrics.net_churn_mrr_percentual,
          target: netChurnTarget,
          status: netChurnTarget && metrics.net_churn_mrr_percentual !== null && metrics.net_churn_mrr_percentual <= netChurnTarget ? "green" : "red"
        }
      };
      
      const series = {
        mrr: metrics.mrr_serie || [],
        ebitda: [],
        churn: []
      };
      
      const { getQuarterSummary } = await import("./okr2026/metricsAdapter");
      const quarterSummary = await getQuarterSummary(new Date().getFullYear());
      
      const summaryData = {
        objectives,
        krs,
        metrics,
        initiatives,
        highlights,
        series,
        quarterSummary,
        meta: {
          generatedAt: new Date().toISOString(),
          period: normalizedPeriod,
          bu: normalizedBU,
          cacheHit: false
        }
      };
      
      setCache(cacheKey, summaryData);
      
      res.json(summaryData);
    } catch (error) {
      console.error("[api] Error fetching OKR summary:", error);
      res.status(500).json({ error: "Failed to fetch OKR summary" });
    }
  });

  app.post("/api/okr2026/cache/invalidate", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { clearAllCache, invalidateCacheByPattern, getCacheStats } = await import("./okr2026/cache");
      const { pattern } = req.body;
      
      if (pattern) {
        const count = invalidateCacheByPattern(pattern);
        res.json({ success: true, invalidated: count });
      } else {
        clearAllCache();
        res.json({ success: true, message: "All cache cleared" });
      }
    } catch (error) {
      console.error("[api] Error invalidating cache:", error);
      res.status(500).json({ error: "Failed to invalidate cache" });
    }
  });

  app.get("/api/okr2026/cache/stats", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getCacheStats } = await import("./okr2026/cache");
      res.json(getCacheStats());
    } catch (error) {
      console.error("[api] Error fetching cache stats:", error);
      res.status(500).json({ error: "Failed to fetch cache stats" });
    }
  });

  app.get("/api/okr2026/quarter-summary", isAuthenticated, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || 2026;
      const { getQuarterSummary } = await import("./okr2026/metricsAdapter");
      const metrics = await getQuarterSummary(year);
      res.json({
        year,
        metrics
      });
    } catch (error) {
      console.error("[api] Error fetching quarter summary:", error);
      res.status(500).json({ error: "Failed to fetch quarter summary" });
    }
  });

  app.get("/api/okr2026/collaborators", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, email_turbo as email, setor 
        FROM rh_pessoal 
        WHERE LOWER(status) = 'ativo' 
        ORDER BY nome
      `);
      res.json({
        collaborators: result.rows.map((row: any) => ({
          id: row.id,
          nome: row.nome,
          email: row.email,
          setor: row.setor
        }))
      });
    } catch (error) {
      console.error("[api] Error fetching collaborators:", error);
      res.status(500).json({ error: "Failed to fetch collaborators" });
    }
  });

  app.get("/api/okr2026/metric-series", isAuthenticated, async (req, res) => {
    try {
      const metricKey = req.query.metricKey as string;
      const start = req.query.start as string;
      const end = req.query.end as string;
      
      if (!metricKey) {
        return res.status(400).json({ error: "metricKey is required" });
      }
      if (!start || !end) {
        return res.status(400).json({ error: "start and end date params are required (YYYY-MM format)" });
      }
      
      const startDate = `${start}-01`;
      const endDate = `${end}-28`;
      
      const { getMetricSeries } = await import("./okr2026/metricsAdapter");
      const series = await getMetricSeries(metricKey, startDate, endDate);
      
      res.json({
        metricKey,
        series
      });
    } catch (error) {
      console.error("[api] Error fetching metric series:", error);
      res.status(500).json({ error: "Failed to fetch metric series" });
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
        COLLABORATOR_STATUS_OPTIONS
      } = await import("@shared/constants");
      
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM system_field_options`);
      const count = parseInt((countResult.rows[0] as any).count || '0');
      
      if (count > 0) {
        return res.json({ message: "Table already has data, skipping seed", count });
      }
      
      const seedData: { fieldType: string; options: { value: string; label: string; color?: string }[] }[] = [
        { fieldType: 'client_status', options: CLIENT_STATUS_OPTIONS },
        { fieldType: 'business_type', options: BUSINESS_TYPE_OPTIONS },
        { fieldType: 'account_status', options: ACCOUNT_STATUS_OPTIONS },
        { fieldType: 'cluster', options: CLUSTER_OPTIONS },
        { fieldType: 'squad', options: SQUAD_OPTIONS },
        { fieldType: 'contract_status', options: CONTRACT_STATUS_OPTIONS },
        { fieldType: 'collaborator_status', options: COLLABORATOR_STATUS_OPTIONS },
      ];
      
      let inserted = 0;
      for (const { fieldType, options } of seedData) {
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          await db.execute(sql`
            INSERT INTO system_field_options (field_type, value, label, color, sort_order, is_active)
            VALUES (${fieldType}, ${opt.value}, ${opt.label}, ${opt.color || null}, ${i}, true)
            ON CONFLICT (field_type, value) DO NOTHING
          `);
          inserted++;
        }
      }
      
      res.json({ success: true, message: `Seeded ${inserted} field options` });
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

  app.post("/api/notification-rules/seed", isAuthenticated, async (req, res) => {
    try {
      const defaultRules = [
        {
          ruleType: 'inadimplencia',
          name: 'Inadimplência (+7 dias)',
          description: 'Alerta quando um cliente está com pagamento em atraso por mais de 7 dias',
          config: JSON.stringify({ minDaysOverdue: 7, minValue: 0 })
        },
        {
          ruleType: 'contrato_vencendo',
          name: 'Contrato Vencendo (30 dias)',
          description: 'Alerta quando um contrato está próximo do vencimento (30 dias)',
          config: JSON.stringify({ daysBeforeExpiry: 30 })
        },
        {
          ruleType: 'aniversario',
          name: 'Aniversário de Colaborador',
          description: 'Alerta quando é aniversário de um colaborador',
          config: JSON.stringify({ enabled: true })
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

  const httpServer = createServer(app);
  
  setupDealNotifications(httpServer);

  return httpServer;
}

function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

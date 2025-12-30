import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertColaboradorSchema, insertPatrimonioSchema, updateContratoSchema } from "@shared/schema";
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
import { registerAcessosRoutes } from "./routes/acessos";
import { registerHRRoutes } from "./routes/hr";
import { registerGrowthRoutes } from "./routes/growth";
import { registerMetasRoutes } from "./routes/metas";

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
        FROM caz_clientes c
        LEFT JOIN caz_parcelas p ON c.nome = p.empresa
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
        FROM caz_clientes c
        LEFT JOIN caz_parcelas p ON c.nome = p.empresa
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
      
      // Get OKR/BP statistics
      let okrStats = {
        targetsCount: 0,
        metricsCount: 0,
        actualsCount: 0,
        overridesCount: 0
      };
      
      try {
        const [targetsResult, metricsResult, actualsResult] = await Promise.all([
          db.execute(sql`SELECT COUNT(*) as count FROM plan.metric_targets_monthly`),
          db.execute(sql`SELECT COUNT(*) as count FROM kpi.metrics_registry_extended`),
          db.execute(sql`SELECT COUNT(*) as count FROM kpi.metric_actuals_monthly`)
        ]);
        
        okrStats.targetsCount = parseInt((targetsResult.rows[0] as any)?.count || '0');
        okrStats.metricsCount = parseInt((metricsResult.rows[0] as any)?.count || '0');
        okrStats.actualsCount = parseInt((actualsResult.rows[0] as any)?.count || '0');
        
        // Check for overrides table
        try {
          const overridesResult = await db.execute(sql`SELECT COUNT(*) as count FROM kpi.metric_overrides_monthly`);
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
      
      // Check for responsavel change to log event
      const oldResponsavel = cliente.responsavel;
      const oldResponsavelGeral = cliente.responsavelGeral;
      
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
  // Uses staging.tarefas_clientes table, related by cliente column matching cup_clientes.nome
  app.get("/api/cliente/:cnpj/tasks", async (req, res) => {
    try {
      const { cnpj } = req.params;
      
      // First get the client name from cup_clientes
      const clienteResult = await db.execute(sql`
        SELECT nome FROM cup_clientes WHERE cnpj = ${cnpj}
      `);
      
      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;
      
      if (!clienteNome) {
        return res.json([]);
      }
      
      // Query tasks from staging.tarefas_clientes
      // Related by "cliente" column matching cup_clientes.nome (case-insensitive, trimmed)
      const tasksResult = await db.execute(sql`
        SELECT 
          t.id,
          t.nome,
          t.status,
          t.responsavel,
          t.data_vencimento as "dataLimite",
          t.created_at as "dataCriacao",
          t.data_conclusao as "dataConclusao",
          t.cliente,
          t.equipe,
          t.tipo_task as "tipoTask"
        FROM staging.tarefas_clientes t
        WHERE LOWER(TRIM(t.cliente)) = LOWER(TRIM(${clienteNome}))
           OR t.cliente ILIKE ${`%${clienteNome}%`}
        ORDER BY 
          CASE WHEN LOWER(TRIM(t.cliente)) = LOWER(TRIM(${clienteNome})) THEN 0 ELSE 1 END,
          t.created_at DESC NULLS LAST
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
        SELECT id FROM rh_pessoal 
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
        FROM rh_pessoal
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
        FROM rh_pessoal
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
            SELECT score FROM rh_enps 
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
            SELECT data FROM rh_one_on_one 
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
            SELECT AVG(progresso) as avg_progress FROM rh_pdi 
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
            SELECT COUNT(*) as count FROM rh_one_on_one_acoes a
            JOIN rh_one_on_one o ON a.one_on_one_id = o.id
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
  
  // Initialize table on startup
  ensureEscalationRulesTable();
  
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
      
      // 4. Buscar parcelas em paralelo
      const parcelasPromises = clientesFiltrados.map(cliente => 
        storage.getInadimplenciaDetalheParcelas(cliente.idCliente, dataInicio, dataFim)
      );
      const parcelasResults = await Promise.all(parcelasPromises);
      
      // 5. Montar resposta com sugestão de escalonamento
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

  app.get("/api/geg/ultimas-demissoes", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';
      const limit = parseInt(req.query.limit as string) || 10;

      const resultado = await storage.getGegUltimasDemissoes(squad, setor, nivel, cargo, limit);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG ultimas demissoes:", error);
      res.status(500).json({ error: "Failed to fetch GEG ultimas demissoes" });
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

  // Geographic Analysis - Distribution by State and City (ES focus: Vitória, Vila Velha, Serra, Cariacica)
  app.get("/api/geg/distribuicao-geografica", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });
      
      // Filter by filters
      let filtered = colaboradores;
      if (squad !== 'todos') filtered = filtered.filter(c => c.squad === squad);
      if (setor !== 'todos') filtered = filtered.filter(c => c.setor === setor);
      if (nivel !== 'todos') filtered = filtered.filter(c => c.nivel === nivel);
      if (cargo !== 'todos') filtered = filtered.filter(c => c.cargo === cargo);

      // ES Cities mapping for presencial/remoto analysis
      const esCities = ['vitória', 'vitoria', 'vila velha', 'serra', 'cariacica', 'viana', 'guarapari', 'fundão', 'fundao'];
      
      // Extract city from address (common patterns: "Cidade - ES" or "Cidade, ES" or just city name)
      const extractCity = (endereco: string | null): string => {
        if (!endereco) return 'Não informado';
        const lower = endereco.toLowerCase();
        
        // Check for known ES cities
        if (lower.includes('vitória') || lower.includes('vitoria')) return 'Vitória';
        if (lower.includes('vila velha')) return 'Vila Velha';
        if (lower.includes('serra')) return 'Serra';
        if (lower.includes('cariacica')) return 'Cariacica';
        if (lower.includes('viana')) return 'Viana';
        if (lower.includes('guarapari')) return 'Guarapari';
        if (lower.includes('fundão') || lower.includes('fundao')) return 'Fundão';
        
        // Try to extract city from patterns like "City - STATE" or "City, STATE"
        const match = endereco.match(/^([^,-]+)/);
        if (match) {
          const city = match[1].trim();
          if (city.length > 2 && city.length < 50) return city;
        }
        
        return 'Outros';
      };

      // Determine if employee is presencial (ES region) or remoto
      const isPresencial = (endereco: string | null, estado: string | null): boolean => {
        if (estado?.toUpperCase() === 'ES') return true;
        if (!endereco) return false;
        const lower = endereco.toLowerCase();
        return esCities.some(city => lower.includes(city));
      };

      // Distribution by state
      const byEstado: Record<string, number> = {};
      // Distribution by city (focus on ES)
      const byCidade: Record<string, number> = {};
      // Presencial vs Remoto
      let presencialCount = 0;
      let remotoCount = 0;
      // Grande Vitória breakdown
      const grandeVitoria: Record<string, number> = {
        'Vitória': 0,
        'Vila Velha': 0,
        'Serra': 0,
        'Cariacica': 0,
        'Viana': 0,
        'Guarapari': 0,
        'Fundão': 0,
        'Outras ES': 0
      };

      filtered.forEach(c => {
        // By state
        const estado = c.estado?.toUpperCase() || 'Não informado';
        byEstado[estado] = (byEstado[estado] || 0) + 1;

        // By city
        const cidade = extractCity(c.endereco);
        byCidade[cidade] = (byCidade[cidade] || 0) + 1;

        // Presencial vs Remoto
        if (isPresencial(c.endereco, c.estado)) {
          presencialCount++;
          // Grande Vitória breakdown
          if (cidade === 'Vitória') grandeVitoria['Vitória']++;
          else if (cidade === 'Vila Velha') grandeVitoria['Vila Velha']++;
          else if (cidade === 'Serra') grandeVitoria['Serra']++;
          else if (cidade === 'Cariacica') grandeVitoria['Cariacica']++;
          else if (cidade === 'Viana') grandeVitoria['Viana']++;
          else if (cidade === 'Guarapari') grandeVitoria['Guarapari']++;
          else if (cidade === 'Fundão') grandeVitoria['Fundão']++;
          else grandeVitoria['Outras ES']++;
        } else {
          remotoCount++;
        }
      });

      // Sort by count
      const estadosSorted = Object.entries(byEstado)
        .sort((a, b) => b[1] - a[1])
        .map(([estado, total]) => ({ estado, total }));

      const cidadesSorted = Object.entries(byCidade)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([cidade, total]) => ({ cidade, total }));

      const grandeVitoriaSorted = Object.entries(grandeVitoria)
        .filter(([_, total]) => total > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([cidade, total]) => ({ cidade, total }));

      res.json({
        byEstado: estadosSorted,
        byCidade: cidadesSorted,
        grandeVitoria: grandeVitoriaSorted,
        modalidade: {
          presencial: presencialCount,
          remoto: remotoCount,
          total: presencialCount + remotoCount
        }
      });
    } catch (error) {
      console.error("[api] Error fetching geographic distribution:", error);
      res.status(500).json({ error: "Failed to fetch geographic distribution" });
    }
  });

  // Alerts and Attention - Veterans without raises, high turnover, etc.
  app.get("/api/geg/alertas", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });
      
      // Veterans without raise (12+ months tenure, 12+ months without raise)
      const veteranosSemAumento = colaboradores
        .filter(c => {
          const mesesTurbo = c.mesesDeTurbo ?? 0;
          const mesesUltAumento = c.mesesUltAumento;
          return mesesTurbo >= 12 && (mesesUltAumento === null || mesesUltAumento >= 12);
        })
        .map(c => ({
          id: c.id,
          nome: c.nome,
          cargo: c.cargo,
          squad: c.squad,
          mesesDeTurbo: c.mesesDeTurbo ?? 0,
          mesesUltAumento: c.mesesUltAumento,
          salario: parseFloat(c.salario || '0') || 0,
          setor: c.setor,
          nivel: c.nivel,
          admissao: c.admissao
        }))
        .sort((a, b) => (b.mesesUltAumento ?? 999) - (a.mesesUltAumento ?? 999))
        .slice(0, 10);

      // Employees ending probation (within 90 days of hire)
      const hoje = new Date();
      const diasFiltro = parseInt(req.query.diasExperiencia as string) || 90;
      const fimExperiencia = colaboradores
        .filter(c => {
          if (!c.admissao) return false;
          const admissao = new Date(c.admissao);
          const diasTrabalhados = Math.floor((hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24));
          const diasRestantes = 90 - diasTrabalhados;
          return diasRestantes > 0 && diasRestantes <= diasFiltro;
        })
        .map(c => {
          const admissao = new Date(c.admissao!);
          const diasTrabalhados = Math.floor((hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24));
          const diasRestantes = Math.max(0, 90 - diasTrabalhados);
          return {
            id: c.id,
            nome: c.nome,
            cargo: c.cargo,
            squad: c.squad,
            admissao: c.admissao,
            diasRestantes,
            salario: parseFloat(c.salario || '0') || 0,
            setor: c.setor,
            nivel: c.nivel
          };
        })
        .sort((a, b) => a.diasRestantes - b.diasRestantes)
        .slice(0, 15);

      // Salary below average by role
      const salarioPorCargo: Record<string, { total: number; count: number }> = {};
      colaboradores.forEach(c => {
        const cargo = c.cargo || 'N/A';
        const salario = parseFloat(c.salario || '0') || 0;
        if (salario > 0) {
          if (!salarioPorCargo[cargo]) salarioPorCargo[cargo] = { total: 0, count: 0 };
          salarioPorCargo[cargo].total += salario;
          salarioPorCargo[cargo].count++;
        }
      });

      const salarioAbaixoMedia = colaboradores
        .filter(c => {
          const cargo = c.cargo || 'N/A';
          const salario = parseFloat(c.salario || '0') || 0;
          const avg = salarioPorCargo[cargo]?.count > 2 ? salarioPorCargo[cargo].total / salarioPorCargo[cargo].count : 0;
          return salario > 0 && avg > 0 && salario < avg * 0.8 && salarioPorCargo[cargo]?.count >= 3;
        })
        .map(c => {
          const cargo = c.cargo || 'N/A';
          const salario = parseFloat(c.salario || '0') || 0;
          const avg = salarioPorCargo[cargo].total / salarioPorCargo[cargo].count;
          return {
            id: c.id,
            nome: c.nome,
            cargo: c.cargo,
            squad: c.squad,
            salario,
            mediaCargo: avg,
            diferenca: ((salario - avg) / avg * 100).toFixed(1),
            setor: c.setor,
            nivel: c.nivel,
            admissao: c.admissao,
            mesesDeTurbo: c.mesesDeTurbo ?? 0
          };
        })
        .slice(0, 10);

      res.json({
        veteranosSemAumento,
        fimExperiencia,
        salarioAbaixoMedia,
        totalAlertas: veteranosSemAumento.length + fimExperiencia.length + salarioAbaixoMedia.length
      });
    } catch (error) {
      console.error("[api] Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // Retention Rate and Health Distribution
  app.get("/api/geg/retencao-saude", async (req, res) => {
    try {
      const periodo = req.query.periodo as string || 'ano';
      const colaboradores = await storage.getColaboradores({});
      
      const hoje = new Date();
      let inicioMeses = 12;
      if (periodo === 'trimestre') inicioMeses = 3;
      else if (periodo === 'semestre') inicioMeses = 6;
      else if (periodo === 'mes') inicioMeses = 1;

      const dataInicio = new Date(hoje);
      dataInicio.setMonth(dataInicio.getMonth() - inicioMeses);

      // Count active at start of period
      const ativosInicio = colaboradores.filter(c => {
        const admissao = c.admissao ? new Date(c.admissao) : null;
        const demissao = c.demissao ? new Date(c.demissao) : null;
        return admissao && admissao < dataInicio && (!demissao || demissao >= dataInicio);
      }).length;

      // Count active now
      const ativosAtual = colaboradores.filter(c => c.status === 'Ativo').length;

      // Count dismissed in period
      const demitidosPeriodo = colaboradores.filter(c => {
        const demissao = c.demissao ? new Date(c.demissao) : null;
        return demissao && demissao >= dataInicio && demissao <= hoje;
      }).length;

      // Retention rate
      const taxaRetencao = ativosInicio > 0 ? ((ativosInicio - demitidosPeriodo) / ativosInicio * 100) : 100;

      // Health distribution (simplified calculation)
      const ativos = colaboradores.filter(c => c.status === 'Ativo');
      const healthDistribution = { saudavel: 0, atencao: 0, critico: 0 };

      ativos.forEach(c => {
        const mesesTurbo = c.mesesDeTurbo ?? 0;
        const mesesUltAumento = c.mesesUltAumento;
        const nivel = (c.nivel || '').toLowerCase();

        // Stability score (max 30)
        let stabilityScore = 15;
        if (c.status === 'Ativo') stabilityScore += 5;
        if (mesesTurbo >= 6 && mesesTurbo <= 36) stabilityScore += 10;
        else if (mesesTurbo > 36) stabilityScore += 8;

        // Growth score (max 25)
        let growthScore = 12;
        if (mesesUltAumento !== null) {
          if (mesesUltAumento <= 12) growthScore = 25;
          else if (mesesUltAumento <= 18) growthScore = 18;
          else if (mesesUltAumento <= 24) growthScore = 12;
          else growthScore = 5;
        }

        // Development score (max 25)
        let developmentScore = 15;
        if (nivel.includes('senior') || nivel.includes('sênior') || nivel.includes('head')) developmentScore = 25;
        else if (nivel.includes('pleno')) developmentScore = 20;
        else if (nivel.includes('junior') || nivel.includes('júnior')) developmentScore = 15;

        // Engagement score (max 25) - progressive based on tenure
        let engagementScore = 15;
        if (mesesTurbo >= 60) engagementScore = 25;
        else if (mesesTurbo >= 48) engagementScore = 23;
        else if (mesesTurbo >= 36) engagementScore = 22;
        else if (mesesTurbo >= 24) engagementScore = 20;
        else if (mesesTurbo >= 12) engagementScore = 18;

        const healthScore = stabilityScore + growthScore + developmentScore + engagementScore;
        
        if (healthScore >= 70) healthDistribution.saudavel++;
        else if (healthScore >= 50) healthDistribution.atencao++;
        else healthDistribution.critico++;
      });

      res.json({
        taxaRetencao: parseFloat(taxaRetencao.toFixed(1)),
        ativosInicio,
        ativosAtual,
        demitidosPeriodo,
        healthDistribution,
        periodo
      });
    } catch (error) {
      console.error("[api] Error fetching retention and health:", error);
      res.status(500).json({ error: "Failed to fetch retention and health data" });
    }
  });

  // Collaborators grouped by health status with reasons
  app.get("/api/geg/colaboradores-por-saude", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });
      
      // Calculate salary averages by cargo
      const salarioPorCargo: Record<string, { total: number; count: number; avg: number }> = {};
      colaboradores.forEach(c => {
        const cargo = c.cargo || 'N/A';
        const salario = parseFloat(c.salario || '0') || 0;
        if (salario > 0) {
          if (!salarioPorCargo[cargo]) salarioPorCargo[cargo] = { total: 0, count: 0, avg: 0 };
          salarioPorCargo[cargo].total += salario;
          salarioPorCargo[cargo].count++;
        }
      });
      
      // Calculate averages
      Object.keys(salarioPorCargo).forEach(cargo => {
        salarioPorCargo[cargo].avg = salarioPorCargo[cargo].total / salarioPorCargo[cargo].count;
      });

      type HealthCategory = 'saudavel' | 'atencao' | 'critico';
      const result: Record<HealthCategory, { id: number; nome: string; cargo: string | null; squad: string | null; reasons: string[] }[]> = {
        saudavel: [],
        atencao: [],
        critico: []
      };

      colaboradores.forEach(c => {
        const mesesUltAumento = c.mesesUltAumento;
        const cargo = c.cargo || 'N/A';
        const salario = parseFloat(c.salario || '0') || 0;
        const avgCargo = salarioPorCargo[cargo]?.avg || 0;
        const reasons: string[] = [];
        let category: HealthCategory = 'saudavel';

        // Check critical conditions
        if (mesesUltAumento !== null && mesesUltAumento >= 24) {
          reasons.push(`${mesesUltAumento} meses sem aumento`);
          category = 'critico';
        }
        if (avgCargo > 0 && salario > 0 && salario < avgCargo * 0.70 && salarioPorCargo[cargo]?.count >= 3) {
          const pct = ((salario / avgCargo) * 100).toFixed(0);
          reasons.push(`Salário ${pct}% da média do cargo`);
          category = 'critico';
        }

        // Check attention conditions (only if not already critical)
        if (category !== 'critico') {
          if (mesesUltAumento !== null && mesesUltAumento >= 12) {
            reasons.push(`${mesesUltAumento} meses sem aumento`);
            category = 'atencao';
          }
          if (avgCargo > 0 && salario > 0 && salario < avgCargo * 0.85 && salarioPorCargo[cargo]?.count >= 3) {
            const pct = ((salario / avgCargo) * 100).toFixed(0);
            reasons.push(`Salário ${pct}% da média do cargo`);
            category = 'atencao';
          }
        }

        // Default reason for healthy
        if (category === 'saudavel' && reasons.length === 0) {
          reasons.push('Colaborador em boas condições');
        }

        result[category].push({
          id: c.id,
          nome: c.nome,
          cargo: c.cargo,
          squad: c.squad,
          reasons
        });
      });

      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching collaborators by health:", error);
      res.status(500).json({ error: "Failed to fetch collaborators by health" });
    }
  });

  app.get("/api/geg/colaboradores-por-filtro", async (req, res) => {
    try {
      const tipo = req.query.tipo as string;
      const valor = req.query.valor as string;
      
      if (!tipo || !valor) {
        return res.status(400).json({ error: "tipo and valor are required" });
      }
      
      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });
      
      const esCities = ['vitória', 'vitoria', 'vila velha', 'serra', 'cariacica', 'viana', 'guarapari', 'fundão', 'fundao'];
      
      const extractCity = (endereco: string | null): string => {
        if (!endereco) return 'Não informado';
        const lower = endereco.toLowerCase();
        if (lower.includes('vitória') || lower.includes('vitoria')) return 'Vitória';
        if (lower.includes('vila velha')) return 'Vila Velha';
        if (lower.includes('serra')) return 'Serra';
        if (lower.includes('cariacica')) return 'Cariacica';
        if (lower.includes('viana')) return 'Viana';
        if (lower.includes('guarapari')) return 'Guarapari';
        if (lower.includes('fundão') || lower.includes('fundao')) return 'Fundão';
        const match = endereco.match(/^([^,-]+)/);
        if (match) {
          const city = match[1].trim();
          if (city.length > 2 && city.length < 50) return city;
        }
        return 'Outros';
      };
      
      const isPresencial = (endereco: string | null, estado: string | null): boolean => {
        if (estado?.toUpperCase() === 'ES') return true;
        if (!endereco) return false;
        const lower = endereco.toLowerCase();
        return esCities.some(city => lower.includes(city));
      };
      
      const removeEmoji = (str: string) => {
        return str.split('').filter(char => {
          const code = char.codePointAt(0) || 0;
          return !(
            (code >= 0x1F300 && code <= 0x1F9FF) ||
            (code >= 0x2600 && code <= 0x26FF) ||
            (code >= 0x2700 && code <= 0x27BF) ||
            (code >= 0x1F600 && code <= 0x1F64F) ||
            (code >= 0x1F680 && code <= 0x1F6FF) ||
            code === 0x2693
          );
        }).join('').trim();
      };
      
      let filtered: typeof colaboradores = [];
      
      switch (tipo) {
        case 'modalidade':
          if (valor === 'Presencial') {
            filtered = colaboradores.filter(c => isPresencial(c.endereco, c.estado));
          } else if (valor === 'Remoto') {
            filtered = colaboradores.filter(c => !isPresencial(c.endereco, c.estado));
          }
          break;
        case 'cidade':
          filtered = colaboradores.filter(c => {
            const cidade = extractCity(c.endereco);
            return cidade === valor;
          });
          break;
        case 'estado':
          filtered = colaboradores.filter(c => {
            const estado = c.estado?.toUpperCase() || 'Não informado';
            return estado === valor;
          });
          break;
        case 'squad':
          filtered = colaboradores.filter(c => {
            const squadName = removeEmoji(c.squad || '').toLowerCase().trim();
            const valorClean = removeEmoji(valor).toLowerCase().trim();
            return squadName.includes(valorClean) || 
                   valorClean.includes(squadName) ||
                   c.squad === valor;
          });
          break;
        case 'cargo':
          filtered = colaboradores.filter(c => c.cargo === valor);
          break;
        case 'nivel':
          filtered = colaboradores.filter(c => {
            const nivelClean = c.nivel?.replace(/^X\s+/, '');
            const valorClean = valor.replace(/^X\s+/, '');
            return c.nivel === valor || nivelClean === valorClean;
          });
          break;
        default:
          return res.status(400).json({ error: "Invalid tipo" });
      }
      
      const result = filtered.map(c => ({
        id: c.id,
        nome: c.nome,
        cargo: c.cargo,
        squad: c.squad
      }));
      
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching collaborators by filter:", error);
      res.status(500).json({ error: "Failed to fetch collaborators by filter" });
    }
  });

  // Salário médio por cargo
  app.get("/api/geg/salario-por-cargo", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });
      
      let filtered = colaboradores;
      if (squad !== 'todos') filtered = filtered.filter(c => c.squad === squad);
      if (setor !== 'todos') filtered = filtered.filter(c => c.setor === setor);
      if (nivel !== 'todos') filtered = filtered.filter(c => c.nivel === nivel);
      if (cargo !== 'todos') filtered = filtered.filter(c => c.cargo === cargo);

      const salarioPorCargo: Record<string, { total: number; sum: number }> = {};
      
      filtered.forEach(c => {
        const cargoNome = c.cargo || 'Não informado';
        const salario = parseFloat(String(c.salario || '0')) || 0;
        if (salario > 0) {
          if (!salarioPorCargo[cargoNome]) {
            salarioPorCargo[cargoNome] = { total: 0, sum: 0 };
          }
          salarioPorCargo[cargoNome].total += 1;
          salarioPorCargo[cargoNome].sum += salario;
        }
      });

      const result = Object.entries(salarioPorCargo)
        .map(([cargoNome, data]) => ({
          cargo: cargoNome,
          salarioMedio: data.total > 0 ? data.sum / data.total : 0,
          total: data.total
        }))
        .sort((a, b) => b.salarioMedio - a.salarioMedio);

      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching salario por cargo:", error);
      res.status(500).json({ error: "Failed to fetch salario por cargo" });
    }
  });

  // Salário médio por squad
  app.get("/api/geg/salario-por-squad", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });
      
      let filtered = colaboradores;
      if (squad !== 'todos') filtered = filtered.filter(c => c.squad === squad);
      if (setor !== 'todos') filtered = filtered.filter(c => c.setor === setor);
      if (nivel !== 'todos') filtered = filtered.filter(c => c.nivel === nivel);
      if (cargo !== 'todos') filtered = filtered.filter(c => c.cargo === cargo);

      const salarioPorSquad: Record<string, { total: number; sum: number }> = {};
      
      filtered.forEach(c => {
        const squadNome = c.squad || 'Não informado';
        const salario = parseFloat(String(c.salario || '0')) || 0;
        if (salario > 0) {
          if (!salarioPorSquad[squadNome]) {
            salarioPorSquad[squadNome] = { total: 0, sum: 0 };
          }
          salarioPorSquad[squadNome].total += 1;
          salarioPorSquad[squadNome].sum += salario;
        }
      });

      const result = Object.entries(salarioPorSquad)
        .map(([squadNome, data]) => ({
          squad: squadNome,
          salarioMedio: data.total > 0 ? data.sum / data.total : 0,
          total: data.total
        }))
        .sort((a, b) => b.salarioMedio - a.salarioMedio);

      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching salario por squad:", error);
      res.status(500).json({ error: "Failed to fetch salario por squad" });
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

  // Bug Reports endpoint
  let bugReportsTableInitialized = false;
  async function ensureBugReportsTable() {
    if (bugReportsTableInitialized) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS staging.bug_reports (
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
        INSERT INTO staging.bug_reports (titulo, descricao, pagina, user_agent, user_email, user_name)
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

  // Metas & Notifications Module - registered from separate file
  await registerMetasRoutes(app, db, storage);

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
          FROM rh_pessoal
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
          FROM cup_contratos c
          LEFT JOIN cup_clientes cl ON cl.task_id = c.id_task
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
          FROM caz_parcelas p
          LEFT JOIN cup_clientes cl ON cl.cnpj = p.id_cliente::text
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
          FROM cup_contratos c
          LEFT JOIN cup_clientes cl ON c.id_task = cl.task_id
          WHERE c.status = 'Ativo'
            AND NOT EXISTS (
              SELECT 1 FROM caz_parcelas p
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
              FROM inadimplencia_contextos ic
              JOIN caz_clientes c ON ic.cliente_id = c.ids OR ic.cliente_id = CAST(c.id AS TEXT)
              JOIN (
                SELECT 
                  id_cliente,
                  MAX(CURRENT_DATE - data_vencimento::date) as max_atraso
                FROM caz_parcelas
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

  app.post("/api/okr2026/seed-bp", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { initializeBPTables } = await import("./db");
      await initializeBPTables();
      
      const { BP_2026_TARGETS } = await import("./okr2026/bp2026Targets");
      
      // Delete existing data first for clean seed
      await db.execute(sql`DELETE FROM plan.metric_targets_monthly WHERE year = 2026`);
      await db.execute(sql`DELETE FROM kpi.metrics_registry_extended WHERE metric_key LIKE '%'`);
      
      // Batch insert all metrics registry
      for (let i = 0; i < BP_2026_TARGETS.length; i++) {
        const metric = BP_2026_TARGETS[i];
        await db.execute(sql`
          INSERT INTO kpi.metrics_registry_extended 
            (metric_key, title, unit, period_type, direction, is_derived, formula_expr, dimension_key, dimension_value, sort_order)
          VALUES 
            (${metric.metric_key}, ${metric.title}, ${metric.unit}, ${metric.period_type}, ${metric.direction}, 
             ${metric.is_derived}, ${metric.formula || null}, ${metric.dimension_key || null}, ${metric.dimension_value || null}, ${i * 10})
        `);
      }
      
      // Build values for batch insert of targets
      const targetRows: Array<{year: number; month: number; metricKey: string; dimKey: string | null; dimVal: string | null; value: number}> = [];
      for (const metric of BP_2026_TARGETS) {
        for (const monthKey of Object.keys(metric.months)) {
          const [yearStr, monthStr] = monthKey.split("-");
          targetRows.push({
            year: parseInt(yearStr),
            month: parseInt(monthStr),
            metricKey: metric.metric_key,
            dimKey: metric.dimension_key || null,
            dimVal: metric.dimension_value || null,
            value: metric.months[monthKey]
          });
        }
      }
      
      // Insert targets in batches of 50
      const batchSize = 50;
      for (let i = 0; i < targetRows.length; i += batchSize) {
        const batch = targetRows.slice(i, i + batchSize);
        const values = batch.map(r => 
          sql`(${r.year}, ${r.month}, ${r.metricKey}, ${r.dimKey}, ${r.dimVal}, ${r.value})`
        );
        await db.execute(sql`
          INSERT INTO plan.metric_targets_monthly 
            (year, month, metric_key, dimension_key, dimension_value, target_value)
          VALUES ${sql.join(values, sql`, `)}
        `);
      }
      
      res.json({
        success: true,
        message: `BP 2026 seeded successfully`,
        metricsRegistered: BP_2026_TARGETS.length,
        targetsUpserted: targetRows.length
      });
    } catch (error) {
      console.error("[api] Error seeding BP:", error);
      res.status(500).json({ error: "Failed to seed BP data" });
    }
  });

  app.get("/api/okr2026/bp-financeiro", isAuthenticated, async (req, res) => {
    try {
      const { BP_2026_TARGETS, BP_MONTHS, BP_METRIC_ORDER, getMetricByKey } = await import("./okr2026/bp2026Targets");
      const { computePeriodValue, computeSignalStatus, computeVariance } = await import("./okr2026/rollupEngine");
      
      const targetsByMetric: Record<string, Record<string, number>> = {};
      const actualsByMetric: Record<string, Record<string, number>> = {};
      
      try {
        const targetsResult = await db.execute(sql`
          SELECT year, month, metric_key, dimension_key, dimension_value, target_value
          FROM plan.metric_targets_monthly
          WHERE year = 2026
          ORDER BY metric_key, month
        `);
        
        for (const row of targetsResult.rows as any[]) {
          const key = row.metric_key;
          const monthKey = `2026-${String(row.month).padStart(2, "0")}`;
          if (!targetsByMetric[key]) targetsByMetric[key] = {};
          targetsByMetric[key][monthKey] = parseFloat(row.target_value);
        }
      } catch (dbError) {
        console.log("[api] BP financeiro: Using hardcoded targets (DB unavailable)");
      }
      
      try {
        const actualsResult = await db.execute(sql`
          SELECT year, month, metric_key, dimension_key, dimension_value, actual_value
          FROM kpi.metric_actuals_monthly
          WHERE year = 2026
          ORDER BY metric_key, month
        `);
        
        for (const row of actualsResult.rows as any[]) {
          const key = row.metric_key;
          const monthKey = `2026-${String(row.month).padStart(2, "0")}`;
          if (!actualsByMetric[key]) actualsByMetric[key] = {};
          actualsByMetric[key][monthKey] = parseFloat(row.actual_value);
        }
      } catch (dbError) {
        console.log("[api] BP financeiro: No actuals available (DB unavailable)");
      }
      
      const currentDate = new Date();
      const currentMonth = currentDate.getFullYear() === 2026 
        ? `2026-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
        : null;
      
      const getStatus = (actual: number | null, target: number, direction: string): "green" | "yellow" | "red" | "gray" => {
        if (actual === null) return "gray";
        
        if (direction === "down") {
          if (actual <= target) return "green";
          const overshoot = ((actual - target) / target) * 100;
          if (overshoot <= 10) return "yellow";
          return "red";
        } else {
          const pct = (actual / target) * 100;
          if (pct >= 100) return "green";
          if (pct >= 90) return "yellow";
          return "red";
        }
      };
      
      const metricsData = BP_METRIC_ORDER.map((metricKey, idx) => {
        const def = getMetricByKey(metricKey);
        if (!def) return null;
        
        const targets = targetsByMetric[metricKey] || def.months;
        const actuals = actualsByMetric[metricKey] || {};
        
        const monthsData = BP_MONTHS.map(m => {
          const plan = targets[m] ?? null;
          const actual = actuals[m] ?? null;
          const status = plan !== null ? getStatus(actual, plan, def.direction) : "gray";
          const variance = (plan !== null && actual !== null) 
            ? ((actual - plan) / Math.abs(plan)) * 100 
            : null;
          
          return {
            month: m,
            plan,
            actual,
            variance,
            status
          };
        });
        
        const hasActuals = Object.keys(actuals).length > 0;
        
        const planTotal = computePeriodValue(metricKey, 2026, "YTD", targets, def.period_type);
        const actualTotal = hasActuals ? computePeriodValue(metricKey, 2026, "YTD", actuals, def.period_type) : null;
        
        const quarters = ["Q1", "Q2", "Q3", "Q4"].map(q => {
          const qPlan = computePeriodValue(metricKey, 2026, q, targets, def.period_type);
          const qActual = hasActuals ? computePeriodValue(metricKey, 2026, q, actuals, def.period_type) : null;
          const { variance, variancePct } = computeVariance(qActual, qPlan);
          const status = computeSignalStatus(qActual, qPlan, def.direction, def.unit);
          return { quarter: q, plan: qPlan, actual: qActual, variance, variancePct, status };
        });
        
        const ytdVariance = computeVariance(actualTotal, planTotal);
        const ytdStatus = computeSignalStatus(actualTotal, planTotal, def.direction, def.unit);
        
        return {
          metric_key: metricKey,
          title: def.title,
          unit: def.unit,
          direction: def.direction,
          is_derived: def.is_derived,
          period_type: def.period_type,
          order: idx,
          months: monthsData,
          quarters,
          totals: {
            plan: planTotal,
            actual: actualTotal,
            variance: ytdVariance.variance,
            variancePct: ytdVariance.variancePct,
            status: ytdStatus
          }
        };
      }).filter(Boolean);
      
      res.json({
        year: 2026,
        currentMonth,
        months: BP_MONTHS,
        metrics: metricsData,
        meta: {
          generatedAt: new Date().toISOString(),
          totalMetrics: metricsData.length
        }
      });
    } catch (error) {
      console.error("[api] Error fetching BP financeiro:", error);
      res.status(500).json({ error: "Failed to fetch BP financeiro data" });
    }
  });

  // ==================== KR CHECK-INS ====================
  
  app.get("/api/okr2026/kr-checkins/:krId", isAuthenticated, async (req, res) => {
    try {
      const { krId } = req.params;
      const year = parseInt(req.query.year as string) || 2026;
      
      const result = await db.execute(sql`
        SELECT 
          id, kr_id, year, period_type, period_value, 
          confidence, commentary, blockers, next_actions,
          created_by, created_at
        FROM kr_checkins
        WHERE kr_id = ${krId} AND year = ${year}
        ORDER BY created_at DESC
      `);
      
      res.json({
        krId,
        year,
        checkins: result.rows.map((r: any) => ({
          id: r.id,
          krId: r.kr_id,
          year: r.year,
          periodType: r.period_type,
          periodValue: r.period_value,
          confidence: r.confidence,
          commentary: r.commentary,
          blockers: r.blockers,
          nextActions: r.next_actions,
          createdBy: r.created_by,
          createdAt: r.created_at
        }))
      });
    } catch (error) {
      console.error("[api] Error fetching KR check-ins:", error);
      res.status(500).json({ error: "Failed to fetch KR check-ins" });
    }
  });
  
  app.get("/api/okr2026/kr-checkins-latest", isAuthenticated, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || 2026;
      
      const result = await db.execute(sql`
        SELECT DISTINCT ON (kr_id)
          id, kr_id, year, period_type, period_value, 
          confidence, commentary, blockers, next_actions,
          created_by, created_at
        FROM kr_checkins
        WHERE year = ${year}
        ORDER BY kr_id, created_at DESC
      `);
      
      const latestByKr: Record<string, any> = {};
      for (const r of result.rows as any[]) {
        latestByKr[r.kr_id] = {
          id: r.id,
          krId: r.kr_id,
          year: r.year,
          periodType: r.period_type,
          periodValue: r.period_value,
          confidence: r.confidence,
          commentary: r.commentary,
          blockers: r.blockers,
          nextActions: r.next_actions,
          createdBy: r.created_by,
          createdAt: r.created_at
        };
      }
      
      res.json({ year, latestByKr });
    } catch (error) {
      console.error("[api] Error fetching latest KR check-ins:", error);
      res.status(500).json({ error: "Failed to fetch latest KR check-ins" });
    }
  });
  
  app.post("/api/okr2026/kr-checkins", isAuthenticated, async (req, res) => {
    try {
      const { krId, year, periodType, periodValue, confidence, commentary, blockers, nextActions } = req.body;
      
      if (!krId || !year || !periodType || !periodValue) {
        return res.status(400).json({ error: "krId, year, periodType and periodValue are required" });
      }
      
      if (confidence === undefined || confidence < 0 || confidence > 100) {
        return res.status(400).json({ error: "confidence must be between 0 and 100" });
      }
      
      const createdBy = (req as any).user?.email || "unknown";
      
      const result = await db.execute(sql`
        INSERT INTO kr_checkins (kr_id, year, period_type, period_value, confidence, commentary, blockers, next_actions, created_by)
        VALUES (${krId}, ${year}, ${periodType}, ${periodValue}, ${confidence}, ${commentary || null}, ${blockers || null}, ${nextActions || null}, ${createdBy})
        RETURNING id, kr_id, year, period_type, period_value, confidence, commentary, blockers, next_actions, created_by, created_at
      `);
      
      const r = result.rows[0] as any;
      res.json({
        id: r.id,
        krId: r.kr_id,
        year: r.year,
        periodType: r.period_type,
        periodValue: r.period_value,
        confidence: r.confidence,
        commentary: r.commentary,
        blockers: r.blockers,
        nextActions: r.next_actions,
        createdBy: r.created_by,
        createdAt: r.created_at
      });
    } catch (error) {
      console.error("[api] Error creating KR check-in:", error);
      res.status(500).json({ error: "Failed to create KR check-in" });
    }
  });

  // ==================== OKR 2026: SEED INITIATIVES ====================
  
  app.post("/api/okr2026/seed-initiatives", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const initiativesData = await import("./okr2026/initiatives.json");
      const initiatives = initiativesData.initiatives || [];
      
      let upsertCount = 0;
      
      for (const ini of initiatives) {
        const stableKey = ini.stable_key || ini.id;
        const tagsArray = ini.tags || [];
        const krsArray = ini.krs || [];
        
        await db.execute(sql`
          INSERT INTO okr_initiatives 
            (stable_key, objective_id, title, quarter, status, owner_email, owner_name, tags, krs, origin)
          VALUES 
            (${stableKey}, ${ini.objectiveId}, ${ini.title}, ${ini.quarter || null}, ${ini.status}, 
             ${ini.owner_email || null}, ${ini.owner_name || null}, ${tagsArray}, ${krsArray}, ${ini.origin || 'seed_turbo_2026'})
          ON CONFLICT (stable_key) DO UPDATE SET
            objective_id = EXCLUDED.objective_id,
            title = EXCLUDED.title,
            quarter = EXCLUDED.quarter,
            status = EXCLUDED.status,
            owner_email = EXCLUDED.owner_email,
            owner_name = EXCLUDED.owner_name,
            tags = EXCLUDED.tags,
            krs = EXCLUDED.krs,
            origin = EXCLUDED.origin,
            updated_at = NOW()
        `);
        upsertCount++;
      }
      
      res.json({
        success: true,
        message: `Initiatives seeded successfully`,
        count: upsertCount
      });
    } catch (error) {
      console.error("[api] Error seeding initiatives:", error);
      res.status(500).json({ error: "Failed to seed initiatives" });
    }
  });

  // ==================== OKR 2026: SQUAD GOALS ====================
  
  app.get("/api/okr2026/squad-goals", isAuthenticated, async (req, res) => {
    try {
      const { squad, perspective, year } = req.query;
      
      let query = sql`
        SELECT id, squad, perspective, metric_name, unit, periodicity, data_source, owner_team,
               actual_value, target_value, score, weight, notes, year, quarter, month, updated_at
        FROM squad_goals
        WHERE 1=1
      `;
      
      if (squad) query = sql`${query} AND squad = ${squad}`;
      if (perspective) query = sql`${query} AND perspective = ${perspective}`;
      if (year) query = sql`${query} AND year = ${parseInt(year as string)}`;
      
      query = sql`${query} ORDER BY perspective, squad, metric_name`;
      
      const result = await db.execute(query);
      
      res.json({
        goals: result.rows.map((r: any) => ({
          id: r.id,
          squad: r.squad,
          perspective: r.perspective,
          metricName: r.metric_name,
          unit: r.unit,
          periodicity: r.periodicity,
          dataSource: r.data_source,
          ownerTeam: r.owner_team,
          actualValue: r.actual_value ? parseFloat(r.actual_value) : null,
          targetValue: r.target_value ? parseFloat(r.target_value) : null,
          score: r.score ? parseFloat(r.score) : null,
          weight: r.weight ? parseFloat(r.weight) : 1,
          notes: r.notes,
          year: r.year,
          quarter: r.quarter,
          month: r.month,
          updatedAt: r.updated_at
        }))
      });
    } catch (error) {
      console.error("[api] Error fetching squad goals:", error);
      res.status(500).json({ error: "Failed to fetch squad goals" });
    }
  });
  
  app.post("/api/okr2026/squad-goals", isAuthenticated, async (req, res) => {
    try {
      const { squad, perspective, metricName, unit, periodicity, dataSource, ownerTeam, actualValue, targetValue, score, weight, notes, year, quarter, month } = req.body;
      
      if (!squad || !perspective || !metricName || !unit) {
        return res.status(400).json({ error: "squad, perspective, metricName and unit are required" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO squad_goals (squad, perspective, metric_name, unit, periodicity, data_source, owner_team, actual_value, target_value, score, weight, notes, year, quarter, month)
        VALUES (${squad}, ${perspective}, ${metricName}, ${unit}, ${periodicity || 'monthly'}, ${dataSource || null}, ${ownerTeam || null}, ${actualValue || null}, ${targetValue || null}, ${score || null}, ${weight || 1}, ${notes || null}, ${year || 2026}, ${quarter || null}, ${month || null})
        RETURNING *
      `);
      
      res.json({ goal: result.rows[0] });
    } catch (error) {
      console.error("[api] Error creating squad goal:", error);
      res.status(500).json({ error: "Failed to create squad goal" });
    }
  });
  
  app.patch("/api/okr2026/squad-goals/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { actualValue, targetValue, score, notes } = req.body;
      
      const result = await db.execute(sql`
        UPDATE squad_goals 
        SET actual_value = COALESCE(${actualValue}, actual_value),
            target_value = COALESCE(${targetValue}, target_value),
            score = COALESCE(${score}, score),
            notes = COALESCE(${notes}, notes),
            updated_at = NOW()
        WHERE id = ${parseInt(id)}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      res.json({ goal: result.rows[0] });
    } catch (error) {
      console.error("[api] Error updating squad goal:", error);
      res.status(500).json({ error: "Failed to update squad goal" });
    }
  });
  
  app.delete("/api/okr2026/squad-goals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.execute(sql`DELETE FROM squad_goals WHERE id = ${parseInt(id)}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting squad goal:", error);
      res.status(500).json({ error: "Failed to delete squad goal" });
    }
  });

  // ==================== OKR 2026: SEED SQUAD GOALS ====================
  
  app.post("/api/okr2026/seed-squad-goals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Clear existing data first
      await db.execute(sql`DELETE FROM squad_goals WHERE year = 2026`);
      
      const squadGoalsSeed = [
        // Financeiro
        { squad: "Commerce", perspective: "Financeiro", metricName: "Meta de Vendas", unit: "BRL", periodicity: "monthly", targetValue: 2500000, actualValue: 1875000, ownerTeam: "Vendas", year: 2026, quarter: 1 },
        { squad: "Commerce", perspective: "Financeiro", metricName: "Receita Recorrente (MRR)", unit: "BRL", periodicity: "monthly", targetValue: 1340000, actualValue: 936800, ownerTeam: "Comercial", year: 2026, quarter: 1 },
        { squad: "TurboOH", perspective: "Financeiro", metricName: "Receita TurboOH", unit: "BRL", periodicity: "monthly", targetValue: 800000, actualValue: 624000, ownerTeam: "TurboOH", year: 2026, quarter: 1 },
        { squad: "Tech", perspective: "Financeiro", metricName: "Economia Operacional", unit: "BRL", periodicity: "monthly", targetValue: 150000, actualValue: 98500, ownerTeam: "Tech", year: 2026, quarter: 1 },
        
        // Cliente
        { squad: "Commerce", perspective: "Cliente", metricName: "NPS", unit: "COUNT", periodicity: "quarterly", targetValue: 70, actualValue: 62, ownerTeam: "CS", year: 2026, quarter: 1 },
        { squad: "Commerce", perspective: "Cliente", metricName: "Churn Rate", unit: "PCT", periodicity: "monthly", targetValue: 0.05, actualValue: 0.068, ownerTeam: "CS", year: 2026, quarter: 1 },
        { squad: "TurboOH", perspective: "Cliente", metricName: "Satisfação Cliente", unit: "PCT", periodicity: "monthly", targetValue: 0.85, actualValue: 0.79, ownerTeam: "TurboOH", year: 2026, quarter: 1 },
        { squad: "G&G", perspective: "Cliente", metricName: "eNPS (Colaboradores)", unit: "COUNT", periodicity: "quarterly", targetValue: 65, actualValue: 58, ownerTeam: "G&G", year: 2026, quarter: 1 },
        
        // Processo
        { squad: "Tech", perspective: "Processo", metricName: "Tempo Médio Deploy", unit: "COUNT", periodicity: "weekly", targetValue: 30, actualValue: 25, ownerTeam: "DevOps", year: 2026, quarter: 1, notes: "Em minutos" },
        { squad: "Tech", perspective: "Processo", metricName: "Uptime", unit: "PCT", periodicity: "monthly", targetValue: 0.999, actualValue: 0.9985, ownerTeam: "Infraestrutura", year: 2026, quarter: 1 },
        { squad: "Commerce", perspective: "Processo", metricName: "Ciclo de Vendas", unit: "COUNT", periodicity: "monthly", targetValue: 45, actualValue: 52, ownerTeam: "Vendas", year: 2026, quarter: 1, notes: "Em dias" },
        { squad: "G&G", perspective: "Processo", metricName: "Tempo Onboarding", unit: "COUNT", periodicity: "monthly", targetValue: 14, actualValue: 18, ownerTeam: "RH", year: 2026, quarter: 1, notes: "Em dias" },
        
        // Pessoas
        { squad: "G&G", perspective: "Pessoas", metricName: "Turnover", unit: "PCT", periodicity: "monthly", targetValue: 0.03, actualValue: 0.042, ownerTeam: "RH", year: 2026, quarter: 1 },
        { squad: "G&G", perspective: "Pessoas", metricName: "Treinamentos Concluídos", unit: "COUNT", periodicity: "quarterly", targetValue: 50, actualValue: 38, ownerTeam: "T&D", year: 2026, quarter: 1 },
        { squad: "Tech", perspective: "Pessoas", metricName: "Certificações", unit: "COUNT", periodicity: "quarterly", targetValue: 10, actualValue: 7, ownerTeam: "Tech", year: 2026, quarter: 1 },
        { squad: "Commerce", perspective: "Pessoas", metricName: "Produtividade Vendedor", unit: "BRL", periodicity: "monthly", targetValue: 250000, actualValue: 187500, ownerTeam: "Comercial", year: 2026, quarter: 1 },
      ];
      
      // Batch insert
      const values = squadGoalsSeed.map(g => 
        sql`(${g.squad}, ${g.perspective}, ${g.metricName}, ${g.unit}, ${g.periodicity}, 'seed', ${g.ownerTeam}, ${g.actualValue}, ${g.targetValue}, 1, ${g.notes || null}, ${g.year}, ${g.quarter})`
      );
      
      await db.execute(sql`
        INSERT INTO squad_goals (squad, perspective, metric_name, unit, periodicity, data_source, owner_team, actual_value, target_value, weight, notes, year, quarter)
        VALUES ${sql.join(values, sql`, `)}
      `);
      
      res.json({ success: true, count: squadGoalsSeed.length });
    } catch (error) {
      console.error("[api] Error seeding squad goals:", error);
      res.status(500).json({ error: "Failed to seed squad goals" });
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
      
      if (userName) {
        // Tentar encontrar o colaborador pelo nome ou email
        const colaboradorQuery = await db.execute(sql`
          SELECT nome FROM rh_pessoal 
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
            FROM cup_clientes c
            INNER JOIN cup_contratos ct ON c.id_task = ct.id_task
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
              COUNT(DISTINCT ct.id_task) as contratos_total
            FROM cup_contratos ct
            WHERE (ct.responsavel ILIKE ${`%${colaboradorNome}%`} OR ct.cs_responsavel ILIKE ${`%${colaboradorNome}%`})
              AND ct.status IN ('ativo', 'onboarding', 'triagem')
          `);
          
          if (totaisQuery.rows.length > 0) {
            const totaisRow = totaisQuery.rows[0] as any;
            mrrTotal = parseFloat(totaisRow.mrr_total || '0');
            contratosAtivos = parseInt(totaisRow.contratos_total || '0');
          }
        }
      }
      
      // Buscar próximos eventos (próximos 14 dias)
      const hoje = new Date();
      const em14Dias = new Date();
      em14Dias.setDate(em14Dias.getDate() + 14);
      
      const eventosQuery = await db.execute(sql`
        SELECT id, titulo, tipo, data_inicio, data_fim, local, cor
        FROM turbo_eventos
        WHERE data_inicio >= ${hoje.toISOString()}
          AND data_inicio <= ${em14Dias.toISOString()}
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
      
      // Buscar alertas e pendências
      const alertasQuery = await db.execute(sql`
        SELECT 
          'cobranca_vencida' as tipo,
          cl.nome as cliente_nome,
          cl.cnpj,
          jc.vencimento as data,
          jc.valor_aberto as valor,
          jc.dias_atraso as dias
        FROM juridicocobranca jc
        INNER JOIN cup_clientes cl ON jc.cnpj = cl.cnpj
        WHERE jc.status = 'aberto' AND jc.dias_atraso > 0
        ORDER BY jc.dias_atraso DESC
        LIMIT 5
      `);
      
      const contratosVencendoQuery = await db.execute(sql`
        SELECT 
          'contrato_vencendo' as tipo,
          c.nome as cliente_nome,
          c.cnpj,
          ct.data_encerramento as data,
          ct.valorr as valor,
          0 as dias
        FROM cup_contratos ct
        INNER JOIN cup_clientes c ON ct.id_task = c.id_task
        WHERE ct.status = 'ativo'
          AND ct.data_encerramento IS NOT NULL
          AND ct.data_encerramento::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        ORDER BY ct.data_encerramento ASC
        LIMIT 3
      `);
      
      // Clientes em risco: contratos com health negativo ou em triagem há muito tempo
      const clientesRiscoQuery = await db.execute(sql`
        SELECT DISTINCT
          'cliente_risco' as tipo,
          c.nome as cliente_nome,
          c.cnpj,
          ct.data_inicio as data,
          COALESCE(ct.valorr::numeric, 0) as valor,
          0 as dias
        FROM cup_contratos ct
        INNER JOIN cup_clientes c ON ct.id_task = c.id_task
        WHERE ct.status IN ('triagem', 'ativo')
          AND (
            ct.saude_conta IN ('vermelho', 'Vermelho', 'amarelo', 'Amarelo')
            OR (ct.status = 'triagem' AND ct.data_inicio::date < CURRENT_DATE - INTERVAL '30 days')
          )
        ORDER BY ct.valorr DESC NULLS LAST
        LIMIT 3
      `);
      
      const alertas = [
        ...alertasQuery.rows.map((row: any) => ({
          tipo: 'cobranca_vencida',
          clienteNome: row.cliente_nome,
          cnpj: row.cnpj,
          data: row.data,
          valor: parseFloat(row.valor || '0'),
          dias: parseInt(row.dias || '0'),
        })),
        ...contratosVencendoQuery.rows.map((row: any) => ({
          tipo: 'contrato_vencendo',
          clienteNome: row.cliente_nome,
          cnpj: row.cnpj,
          data: row.data,
          valor: parseFloat(row.valor || '0'),
          dias: 0,
        })),
        ...clientesRiscoQuery.rows.map((row: any) => ({
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
        clientes: meusClientes,
        proximosEventos,
        alertas,
      });
    } catch (error) {
      console.error("[api] Error fetching home overview:", error);
      res.status(500).json({ error: "Failed to fetch home overview" });
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

  // ==================== SYS SCHEMA API - Canonical Data Layer ====================

  // GET /api/admin/sys/catalogs - List all catalogs in sys schema
  app.get("/api/admin/sys/catalogs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT c.catalog_key, c.description, 
               (SELECT COUNT(*) FROM sys.catalog_items ci WHERE ci.catalog_key = c.catalog_key AND ci.active = true)::int as item_count,
               c.created_at, c.updated_at
        FROM sys.catalogs c
        ORDER BY c.catalog_key
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[admin/sys/catalogs] Error fetching catalogs:", error);
      res.status(500).json({ error: "Failed to fetch sys catalogs" });
    }
  });

  // GET /api/admin/sys/catalog-items/:catalogKey - List items in a catalog
  app.get("/api/admin/sys/catalog-items/:catalogKey", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { catalogKey } = req.params;
      const result = await db.execute(sql`
        SELECT ci.*, 
               (SELECT array_agg(ca.alias) FROM sys.catalog_aliases ca WHERE ca.catalog_key = ci.catalog_key AND ca.slug = ci.slug) as aliases
        FROM sys.catalog_items ci
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
        FROM sys.catalog_aliases ca
        JOIN sys.catalog_items ci ON ca.catalog_key = ci.catalog_key AND ca.slug = ci.slug
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
          FROM public.cup_contratos 
          WHERE status IS NOT NULL
        ),
        raw_produto AS (
          SELECT DISTINCT LOWER(TRIM(produto)) as raw_val, produto as original
          FROM public.cup_contratos 
          WHERE produto IS NOT NULL
        ),
        raw_squad AS (
          SELECT DISTINCT LOWER(TRIM(squad)) as raw_val, squad as original
          FROM public.cup_contratos 
          WHERE squad IS NOT NULL
        )
        SELECT 'status' as field, r.original as raw_value, 
               (SELECT COUNT(*) FROM cup_contratos WHERE LOWER(TRIM(status)) = r.raw_val) as count
        FROM raw_status r
        LEFT JOIN sys.catalog_aliases a ON a.catalog_key = 'catalog_contract_status' AND a.alias = r.raw_val
        LEFT JOIN sys.catalog_items ci ON ci.catalog_key = 'catalog_contract_status' AND ci.slug = r.raw_val AND ci.active = true
        WHERE a.alias IS NULL AND ci.slug IS NULL
        UNION ALL
        SELECT 'produto' as field, r.original as raw_value,
               (SELECT COUNT(*) FROM cup_contratos WHERE LOWER(TRIM(produto)) = r.raw_val) as count
        FROM raw_produto r
        LEFT JOIN sys.catalog_aliases a ON a.catalog_key = 'catalog_products' AND a.alias = r.raw_val
        LEFT JOIN sys.catalog_items ci ON ci.catalog_key = 'catalog_products' AND ci.slug = r.raw_val AND ci.active = true
        WHERE a.alias IS NULL AND ci.slug IS NULL
        UNION ALL
        SELECT 'squad' as field, r.original as raw_value,
               (SELECT COUNT(*) FROM cup_contratos WHERE LOWER(TRIM(squad)) = r.raw_val) as count
        FROM raw_squad r
        LEFT JOIN sys.catalog_aliases a ON a.catalog_key = 'catalog_squads' AND a.alias = r.raw_val
        LEFT JOIN sys.catalog_items ci ON ci.catalog_key = 'catalog_squads' AND ci.slug = r.raw_val AND ci.active = true
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
        SELECT COUNT(*) as count FROM cup_data_hist 
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
        INSERT INTO cup_data_hist (data_snapshot, servico, status, valorr, valorp, id_task, id_subtask, 
                                   data_inicio, data_encerramento, data_pausa, squad, produto, responsavel, cs_responsavel, vendedor)
        SELECT 
          ${targetDate}::timestamp as data_snapshot,
          servico, status, valorr, valorp, id_task, id_subtask,
          data_inicio, data_encerramento, data_pausa, squad, produto, responsavel, cs_responsavel, vendedor
        FROM cup_contratos
      `);
      
      // Count inserted records
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM cup_data_hist 
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
        FROM cup_data_hist 
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
      SELECT email_turbo FROM rh_pessoal WHERE id = ${colaboradorId}
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
          (SELECT COUNT(*) FROM staging.rh_notas_fiscais WHERE pagamento_id = p.id) as total_nfs
        FROM staging.rh_pagamentos p
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
        SELECT colaborador_id FROM staging.rh_pagamentos WHERE id = ${pagamentoId}
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
        SELECT * FROM staging.rh_notas_fiscais
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
        SELECT colaborador_id FROM staging.rh_pagamentos WHERE id = ${pagamentoId}
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
        INSERT INTO staging.rh_notas_fiscais (
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
        UPDATE staging.rh_pagamentos 
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
        SELECT nome, pix, cnpj, cpf, email_turbo, email_pessoal FROM rh_pessoal WHERE id = ${colaboradorId}
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
          SELECT ids FROM caz_clientes 
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
          SELECT ids FROM caz_clientes 
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
          FROM caz_parcelas p
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
          FROM caz_pagar pg
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
        )
        SELECT 
          t.*,
          EXTRACT(MONTH FROM COALESCE(t.data_pagamento, t.data_vencimento))::int as mes_referencia,
          EXTRACT(YEAR FROM COALESCE(t.data_pagamento, t.data_vencimento))::int as ano_referencia,
          'pendente' as nf_status
        FROM todos_pagamentos t
        ORDER BY COALESCE(t.data_pagamento, t.data_vencimento) DESC
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
        FROM caz_parcelas 
        WHERE descricao ILIKE ${'%' + cnpj + '%'}
        LIMIT 10
      `);
      results.parcelas_descricao = parcelas.rows;
      console.log(`[DEBUG] caz_parcelas (descrição): ${parcelas.rows.length} registros`);
      
      // 2. Buscar em caz_pagar - descrição
      const pagar_desc = await db.execute(sql`
        SELECT id, descricao, fornecedor, pago, total, status, data_vencimento
        FROM caz_pagar 
        WHERE descricao ILIKE ${'%' + cnpj + '%'}
        LIMIT 10
      `);
      results.pagar_descricao = pagar_desc.rows;
      console.log(`[DEBUG] caz_pagar (descrição): ${pagar_desc.rows.length} registros`);
      
      // 3. Buscar em caz_pagar - fornecedor
      const pagar_forn = await db.execute(sql`
        SELECT id, descricao, fornecedor, pago, total, status, data_vencimento
        FROM caz_pagar 
        WHERE fornecedor ILIKE ${'%' + cnpj + '%'}
        LIMIT 10
      `);
      results.pagar_fornecedor = pagar_forn.rows;
      console.log(`[DEBUG] caz_pagar (fornecedor): ${pagar_forn.rows.length} registros`);
      
      // 4. Buscar em caz_clientes - cnpj
      const clientes = await db.execute(sql`
        SELECT id, nome, cnpj, ids
        FROM caz_clientes 
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
        FROM caz_pagar 
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
          FROM caz_parcelas 
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
      
      // Inserir NF diretamente na tabela staging.rh_notas_fiscais
      const result = await db.execute(sql`
        INSERT INTO staging.rh_notas_fiscais (
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
        FROM staging.rh_notas_fiscais nf
        JOIN staging.rh_pagamentos p ON p.id = nf.pagamento_id
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
        FROM rh_comentarios c
        LEFT JOIN rh_pessoal a ON a.id = c.autor_id
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
        SELECT id, nome_completo FROM rh_pessoal 
        WHERE email = ${user.email}
        LIMIT 1
      `);
      
      const autor = autorResult.rows[0];
      const autorId = autor ? (autor as any).id : null;
      const autorNome = autor ? (autor as any).nome_completo : user.name || user.email;
      
      const result = await db.execute(sql`
        INSERT INTO rh_comentarios (colaborador_id, autor_id, autor_nome, autor_email, comentario, tipo, visibilidade)
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
        SELECT * FROM rh_comentarios WHERE id = ${comentarioId}
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
      
      await db.execute(sql`DELETE FROM rh_comentarios WHERE id = ${comentarioId}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("[rh-comentarios] Error deleting comment:", error);
      res.status(500).json({ error: "Erro ao deletar comentário" });
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

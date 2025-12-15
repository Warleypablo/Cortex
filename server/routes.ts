import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertColaboradorSchema, insertPatrimonioSchema } from "@shared/schema";
import authRoutes from "./auth/routes";
import { isAuthenticated } from "./auth/middleware";
import { getAllUsers, listAllKeys, updateUserPermissions, updateUserRole } from "./auth/userDb";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { analyzeDfc, chatWithDfc, type ChatMessage } from "./services/dfcAnalysis";
import { setupDealNotifications, triggerTestNotification } from "./services/dealNotifications";
import PDFDocument from "pdfkit";
import { format } from "date-fns";

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(authRoutes);
  
  app.get("/debug-colaboradores-count", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores();
      res.json({ 
        total: colaboradores.length, 
        ativos: colaboradores.filter(c => c.status === 'ativo').length,
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
        SELECT * FROM staging.cup_projetos_tech LIMIT 5
      `);
      
      // Get structure of cup_projetos_tech_fechados
      const projetosFechados = await db.execute(sql`
        SELECT * FROM staging.cup_projetos_tech_fechados LIMIT 5
      `);
      
      // Get structure of cup_tech_tasks
      const tasks = await db.execute(sql`
        SELECT * FROM staging.cup_tech_tasks LIMIT 5
      `);
      
      // Get column info
      const columnsAtivos = projetosAtivos.rows.length > 0 ? Object.keys(projetosAtivos.rows[0] as object) : [];
      const columnsFechados = projetosFechados.rows.length > 0 ? Object.keys(projetosFechados.rows[0] as object) : [];
      const columnsTasks = tasks.rows.length > 0 ? Object.keys(tasks.rows[0] as object) : [];
      
      // Get counts
      const countAtivos = await db.execute(sql`SELECT COUNT(*) as count FROM staging.cup_projetos_tech`);
      const countFechados = await db.execute(sql`SELECT COUNT(*) as count FROM staging.cup_projetos_tech_fechados`);
      const countTasks = await db.execute(sql`SELECT COUNT(*) as count FROM staging.cup_tech_tasks`);
      
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

  app.use("/api", isAuthenticated);
  
  app.get("/api/debug/users", isAdmin, async (req, res) => {
    try {
      const users = await getAllUsers();
      const allKeys = await listAllKeys();
      res.json({ users, allKeys, count: users.length, totalKeys: allKeys.length });
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
      console.log(`[DEBUG] Colaboradores encontrados no banco: ${colaboradores.length} total, ${colaboradores.filter(c => c.status === 'ativo').length} ativos`);
      res.json(colaboradores);
    } catch (error) {
      console.error("[api] Error fetching colaboradores:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
    }
  });

  app.get("/api/colaboradores/com-patrimonios", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradoresComPatrimonios();
      res.json(colaboradores);
    } catch (error) {
      console.error("[api] Error fetching colaboradores com patrimonios:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores com patrimonios" });
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
      const colaboradorAtualizado = await storage.updateColaborador(id, validation.data);
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

  app.get("/api/colaboradores/analise", async (req, res) => {
    try {
      const analiseData = await storage.getColaboradoresAnalise();
      res.json(analiseData);
    } catch (error) {
      console.error("[api] Error fetching colaboradores analise:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores analise" });
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

  app.get("/api/colaboradores/dropdown", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradoresDropdown();
      res.json(colaboradores);
    } catch (error) {
      console.error("[api] Error fetching colaboradores dropdown:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
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

      const patrimonio = await storage.updatePatrimonioResponsavel(id, responsavelNome);
      res.json(patrimonio);
    } catch (error) {
      console.error("[api] Error updating patrimonio responsavel:", error);
      res.status(500).json({ error: "Failed to update patrimonio responsavel" });
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
      
      // Calcular métricas gerais usando totais reais (não apenas atribuídos a ads)
      const cac = negociosTotaisReal > 0 ? totalInvestimento / negociosTotaisReal : null;
      const roi = totalInvestimento > 0 ? ((valorTotalReal - totalInvestimento) / totalInvestimento) * 100 : null;
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

  // Growth - Criativos (dados agregados por anúncio do Meta Ads)
  app.get("/api/growth/criativos", async (req, res) => {
    try {
      const startDate = req.query.startDate as string || '2025-01-01';
      const endDate = req.query.endDate as string || '2025-12-31';
      const status = req.query.status as string || 'Todos'; // Todos, Ativo, Pausado
      
      // Validar formato de data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      // Buscar dados agregados por anúncio do Meta Ads com info do anúncio
      const adsDataResult = await db.execute(sql`
        SELECT 
          i.ad_id,
          a.ad_name,
          a.status as ad_status,
          a.created_time,
          a.preview_shareable_link as link,
          SUM(i.spend::numeric) as investimento,
          SUM(i.impressions) as impressions,
          SUM(i.clicks) as clicks,
          AVG(i.ctr::numeric) as ctr,
          AVG(i.cpm::numeric) as cpm
        FROM meta_insights_daily i
        LEFT JOIN meta_ads a ON i.ad_id = a.ad_id
        WHERE i.date_start >= ${startDate}::date AND i.date_start <= ${endDate}::date
        GROUP BY i.ad_id, a.ad_name, a.status, a.created_time, a.preview_shareable_link
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
          const ctr = parseFloat(row.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : null);
          const cpm = parseFloat(row.cpm) || (impressions > 0 ? (investimento / impressions) * 1000 : null);
          
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
            investimento: Math.round(investimento),
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
            rr,
            percRr,
            cprr: cprr ? parseFloat(cprr.toFixed(2)) : null,
            ganhosAceleracao: deal.valorRecorrente > 0 ? vendas : null,
            ganhosPontuais: deal.valorPontual > 0 ? vendas : null,
            cacAceleracao: deal.valorRecorrente > 0 && vendas > 0 ? investimento / vendas : null,
            leadTimeClienteUnico: null, // Não temos essa informação diretamente
            clientesUnicos: vendas,
            percRrCliente,
            cacUnico: cacUnico ? Math.round(cacUnico) : null
          };
        })
        .filter(c => {
          if (status === 'Todos') return true;
          if (status === 'Ativo') return c.status === 'Ativo';
          if (status === 'Pausado') return c.status === 'Pausado';
          return true;
        });
      
      console.log("[api] Growth Criativos - Total:", criativos.length, "Status:", status);
      
      res.json(criativos);
    } catch (error) {
      console.error("[api] Error fetching growth criativos:", error);
      res.status(500).json({ error: "Failed to fetch growth criativos" });
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
        const parcelasData = await storage.getInadimplenciaParcelasCliente(cliente.idCliente, dataInicio, dataFim);
        clientesComParcelas.push({
          cliente,
          contexto: contextos[cliente.idCliente],
          parcelas: parcelasData.parcelas
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
      const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
      
      // Header
      doc.fontSize(18).fillColor('#1e293b').text('Relatório de Cobrança', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor('#dc2626').text('Clientes com Ação: COBRAR', { align: 'center' });
      doc.moveDown(0.3);
      
      const dataHoje = new Date().toLocaleDateString('pt-BR');
      doc.fontSize(10).fillColor('#64748b').text(`Gerado em: ${dataHoje}`, { align: 'center' });
      doc.moveDown();
      
      // Resumo geral
      const totalValor = clientesCobrar.reduce((acc, c) => acc + c.valorTotal, 0);
      const totalParcelas = clientesCobrar.reduce((acc, c) => acc + c.quantidadeParcelas, 0);
      
      doc.fontSize(11).fillColor('#1e293b').font('Helvetica-Bold');
      doc.text(`Total de Clientes a Cobrar: ${clientesCobrar.length}`, 40);
      doc.font('Helvetica');
      doc.text(`Total de Parcelas em Atraso: ${totalParcelas}`, 40);
      doc.text(`Valor Total a Cobrar: ${formatCurrency(totalValor)}`, 40);
      doc.moveDown();
      
      doc.moveTo(40, doc.y).lineTo(pageWidth + 40, doc.y).stroke('#e2e8f0');
      doc.moveDown();
      
      // Cada cliente
      for (let i = 0; i < clientesComParcelas.length; i++) {
        const { cliente, contexto, parcelas } = clientesComParcelas[i];
        
        // Verificar se precisa de nova página
        if (doc.y > doc.page.height - 200) {
          doc.addPage();
        }
        
        // Cabeçalho do cliente
        doc.fontSize(12).fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(`${i + 1}. ${cliente.nomeCliente}`, 40);
        doc.font('Helvetica').fontSize(9).fillColor('#64748b');
        
        // Informações do cliente
        const infoY = doc.y;
        doc.text(`Empresa: ${cliente.empresa || '-'}`, 40);
        if (cliente.cnpj) {
          doc.text(`CNPJ: ${cliente.cnpj}`, 40);
        }
        doc.text(`Status ClickUp: ${cliente.statusClickup || '-'}`, 40);
        doc.text(`Responsável: ${cliente.responsavel || '-'}`, 40);
        doc.text(`Cluster: ${cliente.cluster || '-'}`, 40);
        doc.text(`Serviços: ${cliente.servicos || '-'}`, 40);
        doc.moveDown(0.3);
        
        // Valores
        doc.fontSize(10).fillColor('#dc2626').font('Helvetica-Bold');
        doc.text(`Valor Total em Atraso: ${formatCurrency(cliente.valorTotal)}`, 40);
        doc.font('Helvetica').fillColor('#334155');
        doc.text(`Parcelas em Atraso: ${cliente.quantidadeParcelas} | Dias Atraso Máximo: ${cliente.diasAtrasoMax}`, 40);
        doc.moveDown(0.5);
        
        // Contexto CS
        doc.fontSize(10).fillColor('#1e293b').font('Helvetica-Bold');
        doc.text('Contexto CS:', 40);
        doc.font('Helvetica').fontSize(9).fillColor('#334155');
        
        if (contexto) {
          if (contexto.contexto) {
            doc.text(`Contexto: ${contexto.contexto}`, 50);
          }
          if (contexto.evidencias) {
            doc.text(`Evidências: ${contexto.evidencias}`, 50);
          }
          const acaoLabel = contexto.acao === 'cobrar' ? 'Cobrar' : contexto.acao === 'aguardar' ? 'Aguardar' : contexto.acao === 'abonar' ? 'Abonar' : '-';
          doc.text(`Ação: ${acaoLabel}`, 50);
          if (contexto.statusFinanceiro) {
            const statusLabel = contexto.statusFinanceiro === 'cobrado' ? 'Cobrado' : 
                               contexto.statusFinanceiro === 'acordo_realizado' ? 'Acordo Realizado' : 
                               contexto.statusFinanceiro === 'juridico' ? 'Jurídico' : '-';
            doc.text(`Status Financeiro: ${statusLabel}`, 50);
          }
          if (contexto.detalheFinanceiro) {
            doc.text(`Detalhe Financeiro: ${contexto.detalheFinanceiro}`, 50);
          }
          if (contexto.atualizadoPor) {
            doc.fontSize(8).fillColor('#94a3b8');
            doc.text(`Atualizado por: ${contexto.atualizadoPor} em ${contexto.atualizadoEm ? new Date(contexto.atualizadoEm).toLocaleDateString('pt-BR') : '-'}`, 50);
          }
        }
        doc.moveDown(0.5);
        
        // Tabela de parcelas
        if (parcelas.length > 0) {
          doc.fontSize(10).fillColor('#1e293b').font('Helvetica-Bold');
          doc.text('Parcelas em Atraso:', 40);
          doc.moveDown(0.3);
          
          // Header da tabela
          const colWidths = { desc: 180, valor: 80, venc: 70, dias: 50, link: 130 };
          const tableX = 40;
          let tableY = doc.y;
          
          doc.fontSize(8).fillColor('#475569').font('Helvetica-Bold');
          doc.text('Descrição', tableX, tableY, { width: colWidths.desc });
          doc.text('Valor', tableX + colWidths.desc, tableY, { width: colWidths.valor, align: 'right' });
          doc.text('Vencimento', tableX + colWidths.desc + colWidths.valor, tableY, { width: colWidths.venc, align: 'center' });
          doc.text('Dias', tableX + colWidths.desc + colWidths.valor + colWidths.venc, tableY, { width: colWidths.dias, align: 'center' });
          doc.text('Link Cobrança', tableX + colWidths.desc + colWidths.valor + colWidths.venc + colWidths.dias, tableY, { width: colWidths.link });
          
          doc.moveDown(0.3);
          doc.moveTo(tableX, doc.y).lineTo(pageWidth + 40, doc.y).stroke('#e2e8f0');
          doc.moveDown(0.2);
          
          doc.font('Helvetica').fontSize(7).fillColor('#334155');
          
          for (const parcela of parcelas) {
            if (doc.y > doc.page.height - 60) {
              doc.addPage();
              doc.fontSize(7).fillColor('#334155');
            }
            
            tableY = doc.y;
            const descTruncada = parcela.descricao.length > 35 ? parcela.descricao.substring(0, 35) + '...' : parcela.descricao;
            doc.text(descTruncada, tableX, tableY, { width: colWidths.desc });
            doc.fillColor('#dc2626').text(formatCurrency(parcela.naoPago), tableX + colWidths.desc, tableY, { width: colWidths.valor, align: 'right' });
            doc.fillColor('#334155');
            const dataVenc = parcela.dataVencimento ? new Date(parcela.dataVencimento).toLocaleDateString('pt-BR') : '-';
            doc.text(dataVenc, tableX + colWidths.desc + colWidths.valor, tableY, { width: colWidths.venc, align: 'center' });
            doc.text(`${parcela.diasAtraso}d`, tableX + colWidths.desc + colWidths.valor + colWidths.venc, tableY, { width: colWidths.dias, align: 'center' });
            
            if (parcela.urlCobranca) {
              const urlTruncada = parcela.urlCobranca.length > 25 ? parcela.urlCobranca.substring(0, 25) + '...' : parcela.urlCobranca;
              doc.fillColor('#2563eb').text(urlTruncada, tableX + colWidths.desc + colWidths.valor + colWidths.venc + colWidths.dias, tableY, { 
                width: colWidths.link,
                link: parcela.urlCobranca
              });
              doc.fillColor('#334155');
            } else {
              doc.text('-', tableX + colWidths.desc + colWidths.valor + colWidths.venc + colWidths.dias, tableY, { width: colWidths.link });
            }
            
            doc.moveDown(0.4);
          }
        }
        
        doc.moveDown();
        doc.moveTo(40, doc.y).lineTo(pageWidth + 40, doc.y).stroke('#cbd5e1');
        doc.moveDown();
      }
      
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

      const metricas = await storage.getGegMetricas(periodo, squad, setor);
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

      const evolucao = await storage.getGegEvolucaoHeadcount(periodo, squad, setor);
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

      const dados = await storage.getGegAdmissoesDemissoes(periodo, squad, setor);
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

      const tempoPromocao = await storage.getGegTempoPromocao(squad, setor);
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

      const aniversariantes = await storage.getGegAniversariantesMes(squad, setor);
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

      const aniversarios = await storage.getGegAniversariosEmpresa(squad, setor);
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

      const resultado = await storage.getGegValorMedioSalario(squad, setor);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG valor medio salario:", error);
      res.status(500).json({ error: "Failed to fetch GEG valor medio salario" });
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
      const limit = parseInt(req.query.limit as string) || 10;

      const resultado = await storage.getGegUltimasPromocoes(squad, setor, limit);
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

      const resultado = await storage.getGegTempoPermanencia(squad, setor);
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

      const resultado = await storage.getGegMasContratacoes(squad, setor);
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

      const resultado = await storage.getGegPessoasPorSetor(squad, setor);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG pessoas por setor:", error);
      res.status(500).json({ error: "Failed to fetch GEG pessoas por setor" });
    }
  });

  app.get("/api/geg/demissoes-por-tipo", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';

      const resultado = await storage.getGegDemissoesPorTipo(squad, setor);
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

      const resultado = await storage.getGegHeadcountPorTenure(squad, setor);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG headcount por tenure:", error);
      res.status(500).json({ error: "Failed to fetch GEG headcount por tenure" });
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

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
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
          MIN(d.date_create) as primeiro_negocio,
          MAX(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.data_fechamento END) as ultimo_negocio
        FROM crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
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

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
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

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
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

  const httpServer = createServer(app);
  
  setupDealNotifications(httpServer);

  return httpServer;
}

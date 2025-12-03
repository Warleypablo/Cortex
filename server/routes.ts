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
        source,
        pipeline,
        closerId
      } = req.query;

      const conditions: ReturnType<typeof sql>[] = [];

      if (dataReuniaoInicio) {
        conditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        conditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }
      if (dataFechamentoInicio) {
        conditions.push(sql`d.close_date >= ${dataFechamentoInicio}`);
      }
      if (dataFechamentoFim) {
        conditions.push(sql`d.close_date <= ${dataFechamentoFim}`);
      }
      if (source) {
        conditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        conditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (closerId) {
        conditions.push(sql`d.closer = ${parseInt(closerId as string)}`);
      }

      const whereClause = conditions.length > 0 
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT 
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho (WON)' THEN d.valor_recorrente ELSE 0 END), 0) as mrr_obtido,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho (WON)' THEN d.valor_pontual ELSE 0 END), 0) as pontual_obtido,
          COUNT(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 END) as reunioes_realizadas,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho (WON)' THEN 1 END) as negocios_ganhos
        FROM crm_deal d
        LEFT JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
      `);
      const row = result.rows[0] as any;

      const reunioes = parseInt(row.reunioes_realizadas) || 0;
      const negocios = parseInt(row.negocios_ganhos) || 0;
      const conversao = reunioes > 0 ? (negocios / reunioes) * 100 : 0;

      res.json({
        mrrObtido: parseFloat(row.mrr_obtido) || 0,
        pontualObtido: parseFloat(row.pontual_obtido) || 0,
        reunioesRealizadas: reunioes,
        negociosGanhos: negocios,
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

      const conditions: ReturnType<typeof sql>[] = [];

      if (dataReuniaoInicio) {
        conditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        conditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }
      if (dataFechamentoInicio) {
        conditions.push(sql`d.close_date >= ${dataFechamentoInicio}`);
      }
      if (dataFechamentoFim) {
        conditions.push(sql`d.close_date <= ${dataFechamentoFim}`);
      }
      if (source) {
        conditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        conditions.push(sql`d.category_name = ${pipeline}`);
      }

      const whereClause = conditions.length > 0 
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT 
          c.nome as closer_name,
          COUNT(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 END) as reunioes,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho (WON)' THEN 1 END) as negocios_ganhos
        FROM crm_deal d
        INNER JOIN crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
        GROUP BY c.id, c.nome
        ORDER BY c.nome
      `);
      
      const data = result.rows.map((row: any) => {
        const reunioes = parseInt(row.reunioes) || 0;
        const negocios = parseInt(row.negocios_ganhos) || 0;
        const conversao = reunioes > 0 ? (negocios / reunioes) * 100 : 0;
        
        return {
          closer: row.closer_name,
          reunioes,
          negociosGanhos: negocios,
          taxaConversao: parseFloat(conversao.toFixed(1))
        };
      });

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching chart data:", error);
      res.status(500).json({ error: "Failed to fetch chart data" });
    }
  });

  app.get("/api/closers/chart-receita", async (req, res) => {
    try {
      const { 
        dataReuniaoInicio, 
        dataReuniaoFim, 
        dataFechamentoInicio, 
        dataFechamentoFim,
        source,
        pipeline
      } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`d.stage_name = 'Negócio Ganho (WON)'`];

      if (dataReuniaoInicio) {
        conditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        conditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }
      if (dataFechamentoInicio) {
        conditions.push(sql`d.close_date >= ${dataFechamentoInicio}`);
      }
      if (dataFechamentoFim) {
        conditions.push(sql`d.close_date <= ${dataFechamentoFim}`);
      }
      if (source) {
        conditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        conditions.push(sql`d.category_name = ${pipeline}`);
      }

      const whereClause = conditions.length > 0 
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
        : sql``;

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

  const httpServer = createServer(app);

  return httpServer;
}

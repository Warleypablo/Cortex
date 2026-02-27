import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerChamadosRoutes(app: Express) {
  // ============================================
  // Chamados CRUD
  // ============================================

  // GET /api/chamados - List chamados with visibility filters
  app.get("/api/chamados", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const view = (req.query.view as string) || "meus";
      const area = req.query.area as string;
      const status = req.query.status as string;
      const prioridade = req.query.prioridade as string;

      const conditions: string[] = [];

      // Visibility logic
      if (view === "meus") {
        conditions.push(`(c.solicitante_email = '${user.email.replace(/'/g, "''")}' OR c.responsavel_email = '${user.email.replace(/'/g, "''")}')`);
      } else if (view === "recebidos") {
        // Lookup user's department from rh_pessoal
        const deptResult = await db.execute(sql`
          SELECT setor FROM "Inhire".rh_pessoal
          WHERE LOWER(email_profissional) = LOWER(${user.email})
          AND status = 'Ativo'
          LIMIT 1
        `);
        const dept = (deptResult.rows[0] as any)?.setor || '';
        // Map department to area
        const deptAreaMap: Record<string, string> = {
          'Financeiro': 'financeiro',
          'TI': 'ti',
          'Tecnologia': 'ti',
          'RH': 'rh',
          'G&G': 'rh',
          'Operação': 'operacao',
          'Operações': 'operacao',
          'Comercial': 'comercial',
        };
        const mappedArea = deptAreaMap[dept] || dept.toLowerCase();
        conditions.push(`c.area = '${mappedArea.replace(/'/g, "''")}'`);
      } else if (view === "squad") {
        const squadResult = await db.execute(sql`
          SELECT squad FROM "Inhire".rh_pessoal
          WHERE LOWER(email_profissional) = LOWER(${user.email})
          AND status = 'Ativo'
          LIMIT 1
        `);
        const squad = (squadResult.rows[0] as any)?.squad || '';
        if (squad) {
          conditions.push(`c.solicitante_squad = '${squad.replace(/'/g, "''")}'`);
        } else {
          conditions.push(`1=0`);
        }
      } else if (view === "todos") {
        if (user.role !== 'admin') {
          return res.status(403).json({ message: "Acesso negado" });
        }
        // No filter
      }

      if (area) conditions.push(`c.area = '${area.replace(/'/g, "''")}'`);
      if (status) conditions.push(`c.status = '${status.replace(/'/g, "''")}'`);
      if (prioridade) conditions.push(`c.prioridade = '${prioridade.replace(/'/g, "''")}'`);

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const result = await db.execute(sql.raw(`
        SELECT c.*,
          (SELECT COUNT(*) FROM cortex_core.chamado_comentarios cc WHERE cc.chamado_id = c.id) as total_comentarios
        FROM cortex_core.chamados c
        ${whereClause}
        ORDER BY c.criado_em DESC
        LIMIT 500
      `));

      res.json(result.rows);
    } catch (error) {
      console.error("[chamados] Error listing:", error);
      res.status(500).json({ message: "Erro ao listar chamados" });
    }
  });

  // GET /api/chamados/clientes - Lightweight client list for chamados form
  app.get("/api/chamados/clientes", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });

      const result = await db.execute(sql`
        SELECT DISTINCT nome, COALESCE(cnpj, '') as cnpj
        FROM "Clickup".cup_clientes
        WHERE nome IS NOT NULL AND TRIM(nome) != ''
        ORDER BY nome ASC
      `);

      console.log(`[chamados] Clientes endpoint: returning ${result.rows.length} clients`);
      res.json(result.rows);
    } catch (error) {
      console.error("[chamados] Error listing clientes:", error);
      res.status(500).json({ message: "Erro ao listar clientes" });
    }
  });

  // GET /api/chamados/stats - KPIs
  app.get("/api/chamados/stats", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });

      const result = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('aberto', 'triagem')) as abertos,
          COUNT(*) FILTER (WHERE status = 'em_andamento') as em_andamento,
          COUNT(*) FILTER (WHERE status = 'resolvido' AND resolvido_em >= DATE_TRUNC('month', CURRENT_DATE)) as resolvidos_mes,
          ROUND(AVG(EXTRACT(EPOCH FROM (resolvido_em - criado_em)) / 3600) FILTER (WHERE resolvido_em IS NOT NULL), 1) as tempo_medio_horas
        FROM cortex_core.chamados
      `);

      const row = result.rows[0] as any;
      res.json({
        abertos: Number(row?.abertos || 0),
        em_andamento: Number(row?.em_andamento || 0),
        resolvidos_mes: Number(row?.resolvidos_mes || 0),
        tempo_medio_horas: Number(row?.tempo_medio_horas || 0),
      });
    } catch (error) {
      console.error("[chamados] Error stats:", error);
      res.status(500).json({ message: "Erro ao buscar stats" });
    }
  });

  // GET /api/chamados/:id - Detail
  app.get("/api/chamados/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      const result = await db.execute(sql`
        SELECT * FROM cortex_core.chamados WHERE id = ${id}
      `);

      if (result.rows.length === 0) return res.status(404).json({ message: "Chamado não encontrado" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[chamados] Error detail:", error);
      res.status(500).json({ message: "Erro ao buscar chamado" });
    }
  });

  // POST /api/chamados - Create
  app.post("/api/chamados", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const { titulo, descricao, area, categoria, prioridade, cliente_cnpj, cliente_nome } = req.body;

      if (!titulo || !descricao || !area) {
        return res.status(400).json({ message: "Título, descrição e área são obrigatórios" });
      }

      // Lookup squad from rh_pessoal
      let squad: string | null = null;
      try {
        const squadResult = await db.execute(sql`
          SELECT squad FROM "Inhire".rh_pessoal
          WHERE LOWER(email_profissional) = LOWER(${user.email})
          AND status = 'Ativo'
          LIMIT 1
        `);
        squad = (squadResult.rows[0] as any)?.squad || null;
      } catch { /* ignore */ }

      const result = await db.execute(sql`
        INSERT INTO cortex_core.chamados (titulo, descricao, area, categoria, prioridade, solicitante_id, solicitante_nome, solicitante_email, solicitante_squad, cliente_cnpj, cliente_nome)
        VALUES (${titulo}, ${descricao}, ${area}, ${categoria || null}, ${prioridade || 'media'}, ${user.googleId || user.id}, ${user.name}, ${user.email}, ${squad}, ${cliente_cnpj || null}, ${cliente_nome || null})
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[chamados] Error creating:", error);
      res.status(500).json({ message: "Erro ao criar chamado" });
    }
  });

  // PATCH /api/chamados/:id - Update status, responsavel, prioridade
  app.patch("/api/chamados/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      const { status, responsavel_id, responsavel_nome, responsavel_email, prioridade } = req.body;

      const updates: string[] = [];
      if (status) {
        updates.push(`status = '${status.replace(/'/g, "''")}'`);
        if (status === 'resolvido') updates.push(`resolvido_em = NOW()`);
        if (status === 'fechado') updates.push(`fechado_em = NOW()`);
        if (status === 'em_andamento') {
          updates.push(`resolvido_em = NULL`);
          updates.push(`fechado_em = NULL`);
        }
      }
      if (responsavel_id !== undefined) updates.push(`responsavel_id = '${String(responsavel_id).replace(/'/g, "''")}'`);
      if (responsavel_nome !== undefined) updates.push(`responsavel_nome = '${String(responsavel_nome).replace(/'/g, "''")}'`);
      if (responsavel_email !== undefined) updates.push(`responsavel_email = '${String(responsavel_email).replace(/'/g, "''")}'`);
      if (prioridade) updates.push(`prioridade = '${prioridade.replace(/'/g, "''")}'`);
      updates.push(`atualizado_em = NOW()`);

      const result = await db.execute(sql.raw(`
        UPDATE cortex_core.chamados SET ${updates.join(", ")} WHERE id = ${id} RETURNING *
      `));

      if (result.rows.length === 0) return res.status(404).json({ message: "Chamado não encontrado" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[chamados] Error updating:", error);
      res.status(500).json({ message: "Erro ao atualizar chamado" });
    }
  });

  // ============================================
  // Comentários
  // ============================================

  // GET /api/chamados/:id/comentarios
  app.get("/api/chamados/:id/comentarios", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
      const chamadoId = parseInt(req.params.id);
      if (isNaN(chamadoId)) return res.status(400).json({ message: "ID inválido" });

      const result = await db.execute(sql`
        SELECT * FROM cortex_core.chamado_comentarios
        WHERE chamado_id = ${chamadoId}
        ORDER BY criado_em ASC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("[chamados] Error listing comments:", error);
      res.status(500).json({ message: "Erro ao listar comentários" });
    }
  });

  // POST /api/chamados/:id/comentarios
  app.post("/api/chamados/:id/comentarios", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const chamadoId = parseInt(req.params.id);
      if (isNaN(chamadoId)) return res.status(400).json({ message: "ID inválido" });

      const { comentario, interno } = req.body;
      if (!comentario) return res.status(400).json({ message: "Comentário é obrigatório" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.chamado_comentarios (chamado_id, autor_id, autor_nome, autor_email, comentario, interno)
        VALUES (${chamadoId}, ${user.googleId || user.id}, ${user.name}, ${user.email}, ${comentario}, ${interno || false})
        RETURNING *
      `);

      // Update chamado timestamp
      await db.execute(sql`UPDATE cortex_core.chamados SET atualizado_em = NOW() WHERE id = ${chamadoId}`);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[chamados] Error creating comment:", error);
      res.status(500).json({ message: "Erro ao criar comentário" });
    }
  });

  // DELETE /api/chamados/comentarios/:id
  app.delete("/api/chamados/comentarios/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      // Only allow deleting own comments (or admin)
      const check = await db.execute(sql`
        SELECT * FROM cortex_core.chamado_comentarios WHERE id = ${id}
      `);
      if (check.rows.length === 0) return res.status(404).json({ message: "Comentário não encontrado" });
      const comment = check.rows[0] as any;
      if (comment.autor_email !== user.email && user.role !== 'admin') {
        return res.status(403).json({ message: "Sem permissão para deletar" });
      }

      await db.execute(sql`DELETE FROM cortex_core.chamado_comentarios WHERE id = ${id}`);
      res.json({ success: true });
    } catch (error) {
      console.error("[chamados] Error deleting comment:", error);
      res.status(500).json({ message: "Erro ao deletar comentário" });
    }
  });
}

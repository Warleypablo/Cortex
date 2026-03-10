import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { validateBody } from "../middleware/validate";
import { createChamadoSchema, updateChamadoSchema } from "../middleware/schemas";
import { storage } from "../storage";
import * as fs from "fs";
import * as path from "path";

// ============================================
// Obsidian Task Writer
// ============================================
const OBSIDIAN_TASKS_DIR = "/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/Tasks";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function renderDetalhes(categoria: string | null, detalhes: Record<string, any> | null): string {
  if (!detalhes || Object.keys(detalhes).length === 0) return "_Nenhum detalhe adicional._";

  const lines: string[] = [];
  for (const [key, value] of Object.entries(detalhes)) {
    if (value !== null && value !== undefined && value !== "") {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      if (typeof value === "string" && value.includes("\n")) {
        lines.push(`### ${label}\n${value}`);
      } else {
        lines.push(`- **${label}:** ${value}`);
      }
    }
  }
  return lines.join("\n\n");
}

function writeObsidianTask(chamado: Record<string, any>) {
  try {
    fs.mkdirSync(OBSIDIAN_TASKS_DIR, { recursive: true });

    const id = chamado.id;
    const slug = slugify(chamado.titulo || "sem-titulo");
    const filename = `TASK-${id}-${slug}.md`;
    const filepath = path.join(OBSIDIAN_TASKS_DIR, filename);

    const hoje = new Date().toISOString().split("T")[0];
    const detalhes = typeof chamado.detalhes === "string"
      ? JSON.parse(chamado.detalhes)
      : chamado.detalhes || {};

    const content = `---
tipo: task
origem: chamados
chamado_id: ${id}
categoria: "${chamado.categoria || "geral"}"
prioridade: "${chamado.prioridade || "media"}"
status: "${chamado.status || "aberto"}"
solicitante: "${chamado.solicitante_nome || ""}"
criado: ${hoje}
atualizado: ${hoje}
---
# [${chamado.categoria || "Geral"}] ${chamado.titulo}

## Informacoes
- **Solicitante:** ${chamado.solicitante_nome || "N/A"} (${chamado.solicitante_email || "N/A"})
- **Squad:** ${chamado.solicitante_squad || "N/A"}
- **Prioridade:** ${chamado.prioridade || "media"}
- **Categoria:** ${chamado.categoria || "N/A"}

## Detalhes
${renderDetalhes(chamado.categoria, detalhes)}

## Descricao Original
${chamado.descricao || "_Sem descricao._"}

## Tasks
- [ ] Triagem e analise
- [ ] Implementacao
- [ ] Testes
- [ ] Deploy
`;

    fs.writeFileSync(filepath, content, "utf-8");
    console.log(`[obsidian] Task file written: ${filename}`);
    return filepath;
  } catch (err) {
    console.error("[obsidian] Error writing task file:", err);
    return null;
  }
}

function updateObsidianTaskStatus(chamadoId: number, newStatus: string) {
  try {
    if (!fs.existsSync(OBSIDIAN_TASKS_DIR)) return;

    const files = fs.readdirSync(OBSIDIAN_TASKS_DIR);
    const taskFile = files.find((f) => f.startsWith(`TASK-${chamadoId}-`));
    if (!taskFile) return;

    const filepath = path.join(OBSIDIAN_TASKS_DIR, taskFile);
    let content = fs.readFileSync(filepath, "utf-8");

    content = content.replace(/^status: ".*"$/m, `status: "${newStatus}"`);
    const hoje = new Date().toISOString().split("T")[0];
    content = content.replace(/^atualizado: .*$/m, `atualizado: ${hoje}`);

    fs.writeFileSync(filepath, content, "utf-8");
    console.log(`[obsidian] Task status updated: ${taskFile} -> ${newStatus}`);
  } catch (err) {
    console.error("[obsidian] Error updating task status:", err);
  }
}

export function registerChamadosRoutes(app: Express) {
  // Run migration for detalhes column
  db.execute(sql`ALTER TABLE cortex_core.chamados ADD COLUMN IF NOT EXISTS detalhes JSONB`)
    .then(() => console.log("[chamados] detalhes column ensured"))
    .catch((err: any) => console.error("[chamados] migration error:", err));

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

      const conditions: ReturnType<typeof sql>[] = [];

      // Visibility logic
      if (view === "meus") {
        conditions.push(sql`(c.solicitante_email = ${user.email} OR c.responsavel_email = ${user.email})`);
      } else if (view === "recebidos") {
        const deptResult = await db.execute(sql`
          SELECT setor FROM "Inhire".rh_pessoal
          WHERE LOWER(email_profissional) = LOWER(${user.email})
          AND status = 'Ativo'
          LIMIT 1
        `);
        const dept = (deptResult.rows[0] as any)?.setor || '';
        const deptAreaMap: Record<string, string> = {
          'Financeiro': 'financeiro',
          'TI': 'ti',
          'Tecnologia': 'ti',
          'RH': 'rh',
          'G&G': 'rh',
          'Operação': 'operacao',
          'Operações': 'operacao',
          'Comercial': 'comercial',
          'Cortex': 'cortex',
        };
        const mappedArea = deptAreaMap[dept] || dept.toLowerCase();
        conditions.push(sql`c.area = ${mappedArea}`);
      } else if (view === "squad") {
        const squadResult = await db.execute(sql`
          SELECT squad FROM "Inhire".rh_pessoal
          WHERE LOWER(email_profissional) = LOWER(${user.email})
          AND status = 'Ativo'
          LIMIT 1
        `);
        const squad = (squadResult.rows[0] as any)?.squad || '';
        if (squad) {
          conditions.push(sql`c.solicitante_squad = ${squad}`);
        } else {
          conditions.push(sql`1=0`);
        }
      } else if (view === "todos") {
        if (user.role !== 'admin') {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }

      if (area) conditions.push(sql`c.area = ${area}`);
      if (status) conditions.push(sql`c.status = ${status}`);
      if (prioridade) conditions.push(sql`c.prioridade = ${prioridade}`);

      const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

      const result = await db.execute(sql`
        SELECT c.*,
          (SELECT COUNT(*) FROM cortex_core.chamado_comentarios cc WHERE cc.chamado_id = c.id) as total_comentarios
        FROM cortex_core.chamados c
        ${whereClause}
        ORDER BY c.criado_em DESC
        LIMIT 500
      `);

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
  app.post("/api/chamados", validateBody(createChamadoSchema), async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const { titulo, descricao, area, categoria, prioridade, cliente_cnpj, cliente_nome, detalhes } = req.body;

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

      // Auto-assign Cortex chamados to Dev Admin (Warley Silva)
      const isCortex = area === 'cortex';
      const respId = isCortex ? 'dev-admin-001' : null;
      const respNome = isCortex ? 'Dev Admin' : null;
      const respEmail = isCortex ? 'warleyreserva4@gmail.com' : null;
      const autoStatus = isCortex ? 'triagem' : 'aberto';

      const detalhesJson = detalhes ? JSON.stringify(detalhes) : null;

      const result = detalhesJson
        ? await db.execute(sql`
            INSERT INTO cortex_core.chamados (titulo, descricao, area, categoria, prioridade, solicitante_id, solicitante_nome, solicitante_email, solicitante_squad, cliente_cnpj, cliente_nome, responsavel_id, responsavel_nome, responsavel_email, status, detalhes)
            VALUES (${titulo}, ${descricao}, ${area}, ${categoria || null}, ${prioridade || 'media'}, ${user.googleId || user.id}, ${user.name}, ${user.email}, ${squad}, ${cliente_cnpj || null}, ${cliente_nome || null}, ${respId}, ${respNome}, ${respEmail}, ${autoStatus}, ${detalhesJson}::jsonb)
            RETURNING *
          `)
        : await db.execute(sql`
            INSERT INTO cortex_core.chamados (titulo, descricao, area, categoria, prioridade, solicitante_id, solicitante_nome, solicitante_email, solicitante_squad, cliente_cnpj, cliente_nome, responsavel_id, responsavel_nome, responsavel_email, status)
            VALUES (${titulo}, ${descricao}, ${area}, ${categoria || null}, ${prioridade || 'media'}, ${user.googleId || user.id}, ${user.name}, ${user.email}, ${squad}, ${cliente_cnpj || null}, ${cliente_nome || null}, ${respId}, ${respNome}, ${respEmail}, ${autoStatus})
            RETURNING *
          `);

      const chamado = result.rows[0] as any;

      // Write Obsidian task file for Cortex chamados
      if (isCortex) {
        writeObsidianTask(chamado);
      }

      res.status(201).json(chamado);
    } catch (error) {
      console.error("[chamados] Error creating:", error);
      res.status(500).json({ message: "Erro ao criar chamado" });
    }
  });

  // PATCH /api/chamados/:id - Update status, responsavel, prioridade
  app.patch("/api/chamados/:id", validateBody(updateChamadoSchema), async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
      const user = req.user as any;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      const { status, responsavel_id, responsavel_nome, responsavel_email, prioridade } = req.body;

      const setClauses: ReturnType<typeof sql>[] = [];
      if (status) {
        setClauses.push(sql`status = ${status}`);
        if (status === 'resolvido') setClauses.push(sql`resolvido_em = NOW()`);
        if (status === 'fechado') setClauses.push(sql`fechado_em = NOW()`);
        if (status === 'em_andamento') {
          setClauses.push(sql`resolvido_em = NULL`);
          setClauses.push(sql`fechado_em = NULL`);
        }
      }
      if (responsavel_id !== undefined) setClauses.push(sql`responsavel_id = ${String(responsavel_id)}`);
      if (responsavel_nome !== undefined) setClauses.push(sql`responsavel_nome = ${String(responsavel_nome)}`);
      if (responsavel_email !== undefined) setClauses.push(sql`responsavel_email = ${String(responsavel_email)}`);
      if (prioridade) setClauses.push(sql`prioridade = ${prioridade}`);
      setClauses.push(sql`atualizado_em = NOW()`);

      const result = await db.execute(sql`
        UPDATE cortex_core.chamados SET ${sql.join(setClauses, sql`, `)} WHERE id = ${id} RETURNING *
      `);

      if (result.rows.length === 0) return res.status(404).json({ message: "Chamado não encontrado" });

      const chamado = result.rows[0] as any;

      // Sync Obsidian task status for Cortex chamados
      if (status && chamado.area === 'cortex') {
        updateObsidianTaskStatus(id, status);
      }

      // Notify solicitante when chamado is resolved
      if (status === 'resolvido' && chamado.solicitante_email) {
        try {
          await storage.createNotification({
            type: 'chamado_resolvido',
            title: `Chamado resolvido: ${chamado.titulo}`,
            message: `Seu chamado #${chamado.id} "${chamado.titulo}" foi marcado como resolvido por ${user.name}.`,
            entityId: String(chamado.id),
            entityType: 'chamado',
            priority: 'medium',
            read: false,
            dismissed: false,
            uniqueKey: `chamado-resolvido-${chamado.id}`,
          });
        } catch (err) {
          console.error("[chamados] Error creating notification:", err);
        }
      }

      res.json(chamado);
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

import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { storage } from "../storage";
import { z } from "zod";
import { enviarMensagemWhatsApp, normalizarNumero } from "../services/turbozap";

// Approvers hardcoded
const APPROVER_EMAILS = [
  "victor.peixoto@turbopartners.com.br",
  "rodrigo.queiroz@turbopartners.com.br",
];

// Extra WhatsApp notification number
const EXTRA_NOTIFICATION_NUMBER = "5527997823958";

const RECORRENCIA_LABELS: Record<string, string> = {
  unico: "Pagamento Único",
  mensal: "Mensal",
  anual: "Anual",
};

const CATEGORIA_LABELS: Record<string, string> = {
  ferramenta_ia: "Ferramenta de IA",
  curso: "Curso / Treinamento",
  software: "Software / SaaS",
  hardware: "Hardware / Equipamento",
  livro: "Livro / Material",
  certificacao: "Certificação",
  outros: "Outros",
};

async function notificarAprovadoresWhatsApp(solicitacao: any, solicitanteNome: string) {
  const moeda = solicitacao.moeda || "BRL";
  const valorFormatado = parseFloat(solicitacao.valor_total).toLocaleString("pt-BR", { style: "currency", currency: moeda });
  const valorUnit = parseFloat(solicitacao.valor_unitario).toLocaleString("pt-BR", { style: "currency", currency: moeda });
  const categoriaLabel = CATEGORIA_LABELS[solicitacao.categoria] || solicitacao.categoria || "—";
  const recorrenciaLabel = RECORRENCIA_LABELS[solicitacao.recorrencia] || solicitacao.recorrencia || "Único";
  const appUrl = process.env.APP_URL || "https://cortex.turbopartners.com.br";

  const mensagem = [
    `*Nova Solicitação de Ferramenta/Curso*`,
    ``,
    `*Item:* ${solicitacao.nome_item}`,
    `*Categoria:* ${categoriaLabel}`,
    `*Descrição:* ${solicitacao.descricao_produto || "—"}`,
    `*Valor:* ${solicitacao.quantidade}x ${valorUnit} = *${valorFormatado}*`,
    `*Recorrência:* ${recorrenciaLabel}`,
    `*Motivo:* ${solicitacao.motivo}`,
    ``,
    `*Solicitante:* ${solicitanteNome}`,
    `*Link:* ${solicitacao.link_compra}`,
    ``,
    `Acesse para aprovar: ${appUrl}/solicitacao-ferramentas`,
  ].join("\n");

  // Get phone numbers from colaboradores table
  const numeros: string[] = [];

  for (const email of APPROVER_EMAILS) {
    try {
      const result = await db.execute(sql`
        SELECT telefone FROM "Inhire".rh_pessoal
        WHERE LOWER(email_turbo) = LOWER(${email})
          AND status = 'Ativo'
          AND telefone IS NOT NULL
        LIMIT 1
      `);
      if (result.rows.length > 0) {
        const tel = normalizarNumero((result.rows[0] as any).telefone);
        if (tel.length >= 10) {
          numeros.push(tel.startsWith("55") ? tel : `55${tel}`);
        }
      }
    } catch (err) {
      console.error(`[solicitacao-ferramentas] Error fetching phone for ${email}:`, err);
    }
  }

  // Add extra notification number
  numeros.push(EXTRA_NOTIFICATION_NUMBER);

  // Send to all numbers
  for (const numero of numeros) {
    try {
      const result = await enviarMensagemWhatsApp(numero, mensagem, "financeiro");
      if (result.success) {
        console.log(`[solicitacao-ferramentas] WhatsApp sent to ${numero}`);
      } else {
        console.error(`[solicitacao-ferramentas] WhatsApp failed for ${numero}: ${result.error}`);
      }
    } catch (err) {
      console.error(`[solicitacao-ferramentas] WhatsApp error for ${numero}:`, err);
    }
  }
}

function isApprover(user: any): boolean {
  return (
    APPROVER_EMAILS.includes(user.email) || user.role === "admin"
  );
}

// Zod schemas
const createSolicitacaoSchema = z.object({
  nome_item: z.string().min(3).max(255),
  descricao_produto: z.string().min(5, "Descreva o que o produto faz"),
  categoria: z.string().min(1),
  valor_unitario: z.number().min(0.01),
  quantidade: z.number().int().min(1),
  recorrencia: z.enum(["mensal", "anual", "unico"]),
  link_compra: z.string().url(),
  motivo: z.string().min(10),
  login_email: z.string().optional().default(""),
  login_senha: z.string().optional().default(""),
  moeda: z.enum(["BRL", "USD"]).default("BRL"),
});

const updateSolicitacaoSchema = z.object({
  status: z.enum(["aprovado", "rejeitado", "comprado"]),
  motivo_rejeicao: z.string().optional(),
});

let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.solicitacao_ferramentas (
        id SERIAL PRIMARY KEY,
        nome_item VARCHAR(255) NOT NULL,
        valor_unitario NUMERIC(10,2) NOT NULL,
        quantidade INTEGER NOT NULL DEFAULT 1,
        valor_total NUMERIC(10,2) NOT NULL,
        link_compra TEXT NOT NULL,
        motivo TEXT NOT NULL,
        status VARCHAR(30) DEFAULT 'pendente_aprovacao',
        motivo_rejeicao TEXT,
        solicitante_id VARCHAR(100) NOT NULL,
        solicitante_nome VARCHAR(255) NOT NULL,
        solicitante_email VARCHAR(255) NOT NULL,
        aprovador_nome VARCHAR(255),
        aprovador_email VARCHAR(255),
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW(),
        aprovado_em TIMESTAMP,
        comprado_em TIMESTAMP
      )
    `);
    // Migrations: add new columns if missing
    await db.execute(sql`
      ALTER TABLE cortex_core.solicitacao_ferramentas
      ADD COLUMN IF NOT EXISTS recorrencia VARCHAR(20) DEFAULT 'unico'
    `);
    await db.execute(sql`
      ALTER TABLE cortex_core.solicitacao_ferramentas
      ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)
    `);
    await db.execute(sql`
      ALTER TABLE cortex_core.solicitacao_ferramentas
      ADD COLUMN IF NOT EXISTS descricao_produto TEXT
    `);
    await db.execute(sql`
      ALTER TABLE cortex_core.solicitacao_ferramentas
      ADD COLUMN IF NOT EXISTS login_email VARCHAR(255)
    `);
    await db.execute(sql`
      ALTER TABLE cortex_core.solicitacao_ferramentas
      ADD COLUMN IF NOT EXISTS login_senha VARCHAR(255)
    `);
    await db.execute(sql`
      ALTER TABLE cortex_core.solicitacao_ferramentas
      ADD COLUMN IF NOT EXISTS moeda VARCHAR(3) DEFAULT 'BRL'
    `);
    tableInitialized = true;
    console.log("[solicitacao-ferramentas] table initialized");
  } catch (error) {
    console.error("[solicitacao-ferramentas] migration error:", error);
  }
}

export function registerSolicitacaoFerramentasRoutes(app: Express) {
  // Initialize table on startup
  ensureTable();

  // GET /api/solicitacao-ferramentas - List with view filter
  app.get("/api/solicitacao-ferramentas", async (req, res) => {
    try {
      await ensureTable();
      const user = (req as any).user;
      const view = (req.query.view as string) || "minhas";

      let whereClause;

      if (view === "minhas") {
        whereClause = sql`WHERE solicitante_email = ${user.email}`;
      } else if (view === "aprovacoes") {
        if (!isApprover(user)) return res.status(403).json({ message: "Acesso negado" });
        whereClause = sql`WHERE status = 'pendente_aprovacao'`;
      } else if (view === "compras") {
        if (!isApprover(user)) return res.status(403).json({ message: "Acesso negado" });
        whereClause = sql`WHERE status IN ('aprovado', 'comprado')`;
      } else if (view === "todas") {
        if (!isApprover(user)) return res.status(403).json({ message: "Acesso negado" });
        whereClause = sql``;
      } else {
        whereClause = sql`WHERE solicitante_email = ${user.email}`;
      }

      const result = await db.execute(sql`
        SELECT * FROM cortex_core.solicitacao_ferramentas
        ${whereClause}
        ORDER BY criado_em DESC
        LIMIT 500
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("[solicitacao-ferramentas] Error listing:", error);
      res.status(500).json({ message: "Erro ao listar solicitações" });
    }
  });

  // GET /api/solicitacao-ferramentas/stats - Stats by status
  app.get("/api/solicitacao-ferramentas/stats", async (req, res) => {
    try {
      await ensureTable();
      const user = (req as any).user;
      const approver = isApprover(user);

      let result;
      if (approver) {
        result = await db.execute(sql`
          SELECT
            COUNT(*) FILTER (WHERE status = 'pendente_aprovacao') AS pendentes,
            COUNT(*) FILTER (WHERE status = 'aprovado') AS aprovadas,
            COUNT(*) FILTER (WHERE status = 'comprado') AS compradas,
            COUNT(*) FILTER (WHERE status = 'rejeitado') AS rejeitadas,
            COUNT(*) AS total,
            COALESCE(SUM(valor_total) FILTER (WHERE status IN ('aprovado', 'comprado')), 0) AS valor_aprovado
          FROM cortex_core.solicitacao_ferramentas
        `);
      } else {
        result = await db.execute(sql`
          SELECT
            COUNT(*) FILTER (WHERE status = 'pendente_aprovacao') AS pendentes,
            COUNT(*) FILTER (WHERE status = 'aprovado') AS aprovadas,
            COUNT(*) FILTER (WHERE status = 'comprado') AS compradas,
            COUNT(*) FILTER (WHERE status = 'rejeitado') AS rejeitadas,
            COUNT(*) AS total,
            COALESCE(SUM(valor_total) FILTER (WHERE status IN ('aprovado', 'comprado')), 0) AS valor_aprovado
          FROM cortex_core.solicitacao_ferramentas
          WHERE solicitante_email = ${user.email}
        `);
      }

      res.json(result.rows[0] || {});
    } catch (error) {
      console.error("[solicitacao-ferramentas] Error getting stats:", error);
      res.status(500).json({ message: "Erro ao obter estatísticas" });
    }
  });

  // POST /api/solicitacao-ferramentas - Create
  app.post("/api/solicitacao-ferramentas", async (req, res) => {
    try {
      await ensureTable();
      const user = (req as any).user;

      const parsed = createSolicitacaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      }

      const { nome_item, descricao_produto, categoria, valor_unitario, quantidade, recorrencia, link_compra, motivo, login_email, login_senha, moeda } = parsed.data;
      const valor_total = valor_unitario * quantidade;

      const result = await db.execute(sql`
        INSERT INTO cortex_core.solicitacao_ferramentas
          (nome_item, descricao_produto, categoria, valor_unitario, quantidade, valor_total, recorrencia, link_compra, motivo,
           login_email, login_senha, moeda, solicitante_id, solicitante_nome, solicitante_email)
        VALUES (${nome_item}, ${descricao_produto}, ${categoria}, ${valor_unitario}, ${quantidade}, ${valor_total}, ${recorrencia},
                ${link_compra}, ${motivo}, ${login_email || null}, ${login_senha || null}, ${moeda},
                ${user.googleId || user.id}, ${user.name}, ${user.email})
        RETURNING *
      `);

      const solicitacao = result.rows[0] as any;

      // Notify approvers (in-app)
      try {
        await storage.createNotification({
          type: "solicitacao_ferramentas",
          title: `Nova solicitação: ${nome_item}`,
          message: `${user.name} solicitou: ${nome_item} (${quantidade}x R$ ${valor_unitario.toFixed(2)})`,
          entityId: String(solicitacao.id),
          entityType: "solicitacao_ferramentas",
          priority: "medium",
          read: false,
          dismissed: false,
          uniqueKey: `sol-ferr-nova-${solicitacao.id}`,
        });
      } catch (err) {
        console.error("[solicitacao-ferramentas] Error creating notification:", err);
      }

      // Notify approvers (WhatsApp) — fire and forget
      notificarAprovadoresWhatsApp(solicitacao, user.name).catch((err) =>
        console.error("[solicitacao-ferramentas] WhatsApp notification error:", err)
      );

      res.status(201).json(solicitacao);
    } catch (error) {
      console.error("[solicitacao-ferramentas] Error creating:", error);
      res.status(500).json({ message: "Erro ao criar solicitação" });
    }
  });

  // PATCH /api/solicitacao-ferramentas/:id - Approve/Reject/Mark as purchased
  app.patch("/api/solicitacao-ferramentas/:id", async (req, res) => {
    try {
      await ensureTable();
      const user = (req as any).user;
      const id = parseInt(req.params.id);

      if (!isApprover(user)) {
        return res.status(403).json({ message: "Apenas aprovadores podem alterar o status" });
      }

      const parsed = updateSolicitacaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      }

      const { status, motivo_rejeicao } = parsed.data;

      // Validate status transition
      const current = await db.execute(sql`
        SELECT status FROM cortex_core.solicitacao_ferramentas WHERE id = ${id}
      `);
      if (current.rows.length === 0) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }

      const currentStatus = (current.rows[0] as any).status;
      const validTransitions: Record<string, string[]> = {
        pendente_aprovacao: ["aprovado", "rejeitado"],
        aprovado: ["comprado"],
      };

      if (!validTransitions[currentStatus]?.includes(status)) {
        return res.status(400).json({ message: `Transição inválida: ${currentStatus} → ${status}` });
      }

      if (status === "rejeitado" && !motivo_rejeicao) {
        return res.status(400).json({ message: "Motivo da rejeição é obrigatório" });
      }

      let result;
      if (status === "aprovado") {
        result = await db.execute(sql`
          UPDATE cortex_core.solicitacao_ferramentas
          SET status = ${status}, aprovador_nome = ${user.name}, aprovador_email = ${user.email},
              aprovado_em = NOW(), atualizado_em = NOW()
          WHERE id = ${id}
          RETURNING *
        `);
      } else if (status === "rejeitado") {
        result = await db.execute(sql`
          UPDATE cortex_core.solicitacao_ferramentas
          SET status = ${status}, motivo_rejeicao = ${motivo_rejeicao || null},
              aprovador_nome = ${user.name}, aprovador_email = ${user.email}, atualizado_em = NOW()
          WHERE id = ${id}
          RETURNING *
        `);
      } else if (status === "comprado") {
        result = await db.execute(sql`
          UPDATE cortex_core.solicitacao_ferramentas
          SET status = ${status}, comprado_em = NOW(), atualizado_em = NOW(),
              aprovador_nome = COALESCE(aprovador_nome, ${user.name}),
              aprovador_email = COALESCE(aprovador_email, ${user.email})
          WHERE id = ${id}
          RETURNING *
        `);
      } else {
        return res.status(400).json({ message: "Status inválido" });
      }

      const solicitacao = result!.rows[0] as any;

      // Notify solicitante
      try {
        const statusLabels: Record<string, string> = {
          aprovado: "aprovada",
          rejeitado: "rejeitada",
          comprado: "comprada",
        };

        const message =
          status === "rejeitado"
            ? `Sua solicitação "${solicitacao.nome_item}" foi rejeitada. Motivo: ${motivo_rejeicao}`
            : `Sua solicitação "${solicitacao.nome_item}" foi ${statusLabels[status]}.`;

        await storage.createNotification({
          type: "solicitacao_ferramentas",
          title: `Solicitação ${statusLabels[status]}: ${solicitacao.nome_item}`,
          message,
          entityId: String(solicitacao.id),
          entityType: "solicitacao_ferramentas",
          priority: status === "rejeitado" ? "high" : "medium",
          read: false,
          dismissed: false,
          uniqueKey: `sol-ferr-${status}-${solicitacao.id}`,
        });
      } catch (err) {
        console.error("[solicitacao-ferramentas] Error creating notification:", err);
      }

      res.json(solicitacao);
    } catch (error) {
      console.error("[solicitacao-ferramentas] Error updating:", error);
      res.status(500).json({ message: "Erro ao atualizar solicitação" });
    }
  });

  // DELETE /api/solicitacao-ferramentas/:id - Delete a request
  app.delete("/api/solicitacao-ferramentas/:id", async (req, res) => {
    try {
      await ensureTable();
      const user = (req as any).user;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      // Check ownership or approver
      const current = await db.execute(sql`
        SELECT solicitante_email FROM cortex_core.solicitacao_ferramentas WHERE id = ${id}
      `);
      if (current.rows.length === 0) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }

      const owner = (current.rows[0] as any).solicitante_email === user.email;
      if (!owner && !isApprover(user)) {
        return res.status(403).json({ message: "Sem permissão para excluir" });
      }

      await db.execute(sql`
        DELETE FROM cortex_core.solicitacao_ferramentas WHERE id = ${id}
      `);

      res.json({ message: "Solicitação excluída" });
    } catch (error) {
      console.error("[solicitacao-ferramentas] Error deleting:", error);
      res.status(500).json({ message: "Erro ao excluir solicitação" });
    }
  });
}

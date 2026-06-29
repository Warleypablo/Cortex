// server/routes/bp-copilot.ts
// BP Copilot — chat especialista de tomada de decisão sobre o Business Plan.
// Anthropic claude-opus-4-8 + tools read-only do BP (bp-copilot.tools) + code execution
// (sandbox Anthropic) para projeções/cenários. Persona em agents/bp-copilot-SKILL.md.
// Padrão de conversas/mensagens herdado do Growth AI.
import type { Express, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthenticated } from "../auth/middleware";
import { BP_TOOLS, executeBpTool, montarResumoBp } from "./bp-copilot.tools";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 10 * 60 * 1000, // code execution + thinking podem ser lentos
});

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 8000;
const MAX_ITERATIONS = 8;

// Code execution server-side (sandbox Anthropic) — projeções e cenários what-if auditáveis.
const CODE_EXECUTION_TOOL = { type: "code_execution_20260120", name: "code_execution" };

// Persona/skill carregada uma vez (cacheável como prefixo estável do system).
function loadSkill(): string {
  try {
    return fs.readFileSync(path.resolve(process.cwd(), "agents/bp-copilot-SKILL.md"), "utf-8");
  } catch (err) {
    console.warn("[bp-copilot] não foi possível carregar a skill:", (err as Error).message);
    return "Você é o BP Copilot, copiloto de decisão do Business Plan da Turbo Partners.";
  }
}
const SKILL = loadSkill();

// Acesso restrito: dado financeiro sensível. Ajustar o conjunto se os sócios tiverem
// outro `department` no sistema (hoje libera role/department admin).
const ALLOWED_DEPARTMENTS = new Set(["admin"]);
function bpCopilotGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Não autenticado" });
  if (user.role === "admin" || ALLOWED_DEPARTMENTS.has(user.department)) return next();
  return res.status(403).json({ message: "Acesso ao BP Copilot restrito a sócios/admin." });
}

export function registerBpCopilotRoutes(app: Express, db: any) {
  // ── Tabelas (idempotente) ──
  // Criadas EM ORDEM: bp_copilot_mensagens tem FK p/ bp_copilot_conversas, então a
  // conversas precisa existir antes. Encadear com await evita a race (criações
  // paralelas faziam mensagens perder a corrida e falhar na FK).
  (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.bp_copilot_conversas (
          id SERIAL PRIMARY KEY,
          usuario_id VARCHAR(255) NOT NULL,
          titulo VARCHAR(500) DEFAULT 'Nova conversa',
          criado_em TIMESTAMP DEFAULT NOW(),
          atualizado_em TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.bp_copilot_mensagens (
          id SERIAL PRIMARY KEY,
          conversa_id INTEGER NOT NULL REFERENCES cortex_core.bp_copilot_conversas(id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL,
          conteudo TEXT NOT NULL,
          tool_calls JSONB,
          criado_em TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.bp_copilot_usage (
          id SERIAL PRIMARY KEY,
          usuario_id VARCHAR(255),
          conversa_id INTEGER,
          tokens_in INTEGER DEFAULT 0,
          tokens_out INTEGER DEFAULT 0,
          tokens_cache INTEGER DEFAULT 0,
          tool_calls INTEGER DEFAULT 0,
          duration_ms INTEGER DEFAULT 0,
          criado_em TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (e: any) {
      console.log("[bp-copilot] erro ao criar tabelas:", e.message);
    }
  })();

  // ── Listar conversas ──
  app.get("/api/bp-copilot/conversas", isAuthenticated, bpCopilotGuard, async (req, res) => {
    try {
      const userId = String((req as any).user?.id);
      const result = await db.execute(sql`
        SELECT id, usuario_id, titulo, criado_em, atualizado_em
        FROM cortex_core.bp_copilot_conversas
        WHERE usuario_id = ${userId}
        ORDER BY atualizado_em DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[bp-copilot] erro ao listar conversas:", error);
      res.status(500).json({ message: "Erro ao listar conversas" });
    }
  });

  // ── Criar conversa ──
  app.post("/api/bp-copilot/conversas", isAuthenticated, bpCopilotGuard, async (req, res) => {
    try {
      const userId = String((req as any).user?.id);
      const result = await db.execute(sql`
        INSERT INTO cortex_core.bp_copilot_conversas (usuario_id, titulo)
        VALUES (${userId}, 'Nova conversa') RETURNING *
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[bp-copilot] erro ao criar conversa:", error);
      res.status(500).json({ message: "Erro ao criar conversa" });
    }
  });

  // ── Mensagens de uma conversa ──
  app.get("/api/bp-copilot/conversas/:id/mensagens", isAuthenticated, bpCopilotGuard, async (req, res) => {
    try {
      const userId = String((req as any).user?.id);
      const conversaId = parseInt(req.params.id, 10);
      if (isNaN(conversaId)) return res.status(400).json({ message: "ID inválido" });
      const check = await db.execute(sql`
        SELECT id FROM cortex_core.bp_copilot_conversas
        WHERE id = ${conversaId} AND usuario_id = ${userId}
      `);
      if (check.rows.length === 0) return res.status(404).json({ message: "Conversa não encontrada" });
      const result = await db.execute(sql`
        SELECT id, conversa_id, role, conteudo, tool_calls, criado_em
        FROM cortex_core.bp_copilot_mensagens
        WHERE conversa_id = ${conversaId}
        ORDER BY criado_em ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[bp-copilot] erro ao buscar mensagens:", error);
      res.status(500).json({ message: "Erro ao buscar mensagens" });
    }
  });

  // ── Excluir conversa ──
  app.delete("/api/bp-copilot/conversas/:id", isAuthenticated, bpCopilotGuard, async (req, res) => {
    try {
      const userId = String((req as any).user?.id);
      const conversaId = parseInt(req.params.id, 10);
      if (isNaN(conversaId)) return res.status(400).json({ message: "ID inválido" });
      const check = await db.execute(sql`
        SELECT id FROM cortex_core.bp_copilot_conversas
        WHERE id = ${conversaId} AND usuario_id = ${userId}
      `);
      if (check.rows.length === 0) return res.status(404).json({ message: "Conversa não encontrada" });
      await db.execute(sql`DELETE FROM cortex_core.bp_copilot_conversas WHERE id = ${conversaId}`);
      res.json({ message: "Conversa excluída" });
    } catch (error) {
      console.error("[bp-copilot] erro ao excluir conversa:", error);
      res.status(500).json({ message: "Erro ao excluir conversa" });
    }
  });

  // ── Chat (agentic loop com tools + code execution) ──
  app.post("/api/bp-copilot/chat", isAuthenticated, bpCopilotGuard, async (req, res) => {
    const t0 = Date.now();
    try {
      const userId = String((req as any).user?.id);
      const { conversaId, message } = req.body ?? {};
      if (!conversaId || !message) {
        return res.status(400).json({ message: "conversaId e message são obrigatórios" });
      }
      const conversa = await db.execute(sql`
        SELECT id, titulo FROM cortex_core.bp_copilot_conversas
        WHERE id = ${conversaId} AND usuario_id = ${userId}
      `);
      if (conversa.rows.length === 0) return res.status(404).json({ message: "Conversa não encontrada" });

      // 1. Persiste a mensagem do usuário
      await db.execute(sql`
        INSERT INTO cortex_core.bp_copilot_mensagens (conversa_id, role, conteudo)
        VALUES (${conversaId}, 'user', ${message})
      `);

      // 2. Carrega histórico (texto) e monta as mensagens da API
      const history = await db.execute(sql`
        SELECT role, conteudo FROM cortex_core.bp_copilot_mensagens
        WHERE conversa_id = ${conversaId} ORDER BY criado_em ASC
      `);
      const messages: Anthropic.Messages.MessageParam[] = (history.rows as any[]).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.conteudo,
      }));

      // 3. Snapshot do BP no contexto (o agente "já conhece o cenário")
      const resumoBp = await montarResumoBp(db);
      const system: Anthropic.Messages.TextBlockParam[] = [
        { type: "text", text: SKILL, cache_control: { type: "ephemeral" } },
        { type: "text", text: `## Estado atual do BP (snapshot)\n${resumoBp}` },
      ];

      const tools = [...BP_TOOLS, CODE_EXECUTION_TOOL] as any;

      // 4. Agentic loop
      let response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        system,
        tools,
        messages,
      });

      let iterations = 0;
      let tokensIn = 0, tokensOut = 0, tokensCache = 0, toolCallCount = 0;
      const allToolCalls: any[] = [];
      const acc = (u: any) => {
        if (!u) return;
        tokensIn += u.input_tokens ?? 0;
        tokensOut += u.output_tokens ?? 0;
        tokensCache += u.cache_read_input_tokens ?? 0;
      };
      acc(response.usage);

      while (iterations < MAX_ITERATIONS) {
        iterations++;

        if (response.stop_reason === "tool_use") {
          messages.push({ role: "assistant", content: response.content });
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type === "tool_use") {
              toolCallCount++;
              const result = await executeBpTool(db, block.name, block.input);
              allToolCalls.push({ tool: block.name, input: block.input });
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
            }
          }
          // Se não houver tool_use custom (só server tools já resolvidas), evita loop vazio.
          if (toolResults.length === 0) break;
          messages.push({ role: "user", content: toolResults });
          response = await anthropic.messages.create({
            model: MODEL, max_tokens: MAX_TOKENS, thinking: { type: "adaptive" }, system, tools, messages,
          });
          acc(response.usage);
          continue;
        }

        if (response.stop_reason === "pause_turn") {
          // Code execution server-side atingiu o limite de iterações; continua de onde parou.
          messages.push({ role: "assistant", content: response.content });
          response = await anthropic.messages.create({
            model: MODEL, max_tokens: MAX_TOKENS, thinking: { type: "adaptive" }, system, tools, messages,
          });
          acc(response.usage);
          continue;
        }

        break; // end_turn / max_tokens / refusal
      }

      // 5. Extrai o texto final
      const assistantText = response.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim() || (response.stop_reason === "refusal"
          ? "Não posso ajudar com isso."
          : "Não consegui gerar uma resposta — tente reformular.");

      // 6. Persiste a resposta + auditoria das tool calls
      await db.execute(sql`
        INSERT INTO cortex_core.bp_copilot_mensagens (conversa_id, role, conteudo, tool_calls)
        VALUES (${conversaId}, 'assistant', ${assistantText}, ${JSON.stringify(allToolCalls)}::jsonb)
      `);

      // 7. Auto-título na primeira mensagem
      if ((conversa.rows[0] as any).titulo === "Nova conversa") {
        const titulo = message.length > 60 ? message.slice(0, 57) + "..." : message;
        await db.execute(sql`
          UPDATE cortex_core.bp_copilot_conversas SET titulo = ${titulo}, atualizado_em = NOW()
          WHERE id = ${conversaId}
        `);
      } else {
        await db.execute(sql`
          UPDATE cortex_core.bp_copilot_conversas SET atualizado_em = NOW() WHERE id = ${conversaId}
        `);
      }

      // 8. Log de uso
      await db.execute(sql`
        INSERT INTO cortex_core.bp_copilot_usage
          (usuario_id, conversa_id, tokens_in, tokens_out, tokens_cache, tool_calls, duration_ms)
        VALUES (${userId}, ${conversaId}, ${tokensIn}, ${tokensOut}, ${tokensCache}, ${toolCallCount}, ${Date.now() - t0})
      `).catch(() => {});

      res.json({ role: "assistant", conteudo: assistantText, conversaId });
    } catch (error: any) {
      console.error("[bp-copilot] erro no chat:", error);
      res.status(500).json({ message: "Erro ao processar mensagem", error: error?.message });
    }
  });
}

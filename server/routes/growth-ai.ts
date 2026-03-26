import type { Express } from "express";
import { sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { GROWTH_AI_TOOLS, executeGrowthTool } from "../services/growthAiTools";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const MODEL_ID = "claude-sonnet-4-5-20250514";
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_PROMPT = `Você é a Growth AI, analista sênior de Growth Marketing da Turbo Partners.

## Seu papel
Você analisa dados reais de Meta Ads, Bitrix CRM e metas orçamentárias para fornecer insights acionáveis. Responda sempre em português brasileiro.

## Dados disponíveis
- Meta Ads: investimento, impressões, cliques, CPM, CTR, CPC por campanha/dia
- Bitrix CRM: leads, reuniões agendadas/realizadas, negócios ganhos/perdidos, faturamento recorrente e pontual
- Budgets: metas orçadas por mês, segmento (mql, nao_mql, ads) e funil

## Funis de vendas
Os funis NGC do Bitrix representam linhas de negócio: Comercial, Creators, Ecommerce, Odonto, Bootcamp, etc.
MQL = lead de marketing (inbound qualificado). Não-MQL = leads de outras fontes.

## Métricas chave
- CPL = Investimento / Leads
- CPA = Investimento / Negócios Ganhos
- Taxa de Conversão = Negócios Ganhos / Total Leads
- ROI = (Faturamento - Investimento) / Investimento
- No-Show = 1 - (Reuniões Realizadas / Reuniões Agendadas)

## Como responder
- SEMPRE use as tools para consultar dados reais antes de responder
- Formate números como moeda brasileira (R$) e percentuais
- Use tabelas markdown para comparações
- Seja direto e acionável
- Quando fizer health check, estruture: Resumo, Alertas, Oportunidades, Comparativo
- Se o período não for especificado, use o mês atual`;

// ── Route Registration ───────────────────────────────────────────────────────

export function registerGrowthAiRoutes(app: Express, db: any) {
  // Initialize tables
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.growth_ai_conversas (
      id SERIAL PRIMARY KEY,
      usuario_id VARCHAR(255) NOT NULL,
      titulo VARCHAR(500) NOT NULL DEFAULT 'Nova conversa',
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `).catch((err: any) => {
    console.log("[growth-ai] growth_ai_conversas table note:", err?.message);
  });

  db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.growth_ai_mensagens (
      id SERIAL PRIMARY KEY,
      conversa_id INTEGER NOT NULL REFERENCES cortex_core.growth_ai_conversas(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      conteudo TEXT NOT NULL,
      tool_calls JSONB,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `).catch((err: any) => {
    console.log("[growth-ai] growth_ai_mensagens table note:", err?.message);
  });

  // ── GET /api/growth-ai/conversas ────────────────────────────────────────

  app.get("/api/growth-ai/conversas", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const result = await db.execute(sql`
        SELECT id, usuario_id, titulo, criado_em, atualizado_em
        FROM cortex_core.growth_ai_conversas
        WHERE usuario_id = ${String(userId)}
        ORDER BY atualizado_em DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("[growth-ai] Erro ao listar conversas:", error);
      res.status(500).json({ message: "Erro ao listar conversas" });
    }
  });

  // ── POST /api/growth-ai/conversas ───────────────────────────────────────

  app.post("/api/growth-ai/conversas", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.growth_ai_conversas (usuario_id, titulo)
        VALUES (${String(userId)}, 'Nova conversa')
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (error) {
      console.error("[growth-ai] Erro ao criar conversa:", error);
      res.status(500).json({ message: "Erro ao criar conversa" });
    }
  });

  // ── DELETE /api/growth-ai/conversas/:id ─────────────────────────────────

  app.delete("/api/growth-ai/conversas/:id", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const conversaId = parseInt(req.params.id);
      if (isNaN(conversaId))
        return res.status(400).json({ message: "ID inválido" });

      // Verify ownership
      const check = await db.execute(sql`
        SELECT id FROM cortex_core.growth_ai_conversas
        WHERE id = ${conversaId} AND usuario_id = ${String(userId)}
      `);
      if (check.rows.length === 0)
        return res.status(404).json({ message: "Conversa não encontrada" });

      // Delete messages first (cascade should handle, but explicit is safer)
      await db.execute(sql`
        DELETE FROM cortex_core.growth_ai_mensagens WHERE conversa_id = ${conversaId}
      `);
      await db.execute(sql`
        DELETE FROM cortex_core.growth_ai_conversas WHERE id = ${conversaId}
      `);

      res.json({ message: "Conversa excluída com sucesso" });
    } catch (error) {
      console.error("[growth-ai] Erro ao excluir conversa:", error);
      res.status(500).json({ message: "Erro ao excluir conversa" });
    }
  });

  // ── GET /api/growth-ai/conversas/:id/mensagens ─────────────────────────

  app.get("/api/growth-ai/conversas/:id/mensagens", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const conversaId = parseInt(req.params.id);
      if (isNaN(conversaId))
        return res.status(400).json({ message: "ID inválido" });

      // Verify ownership
      const check = await db.execute(sql`
        SELECT id FROM cortex_core.growth_ai_conversas
        WHERE id = ${conversaId} AND usuario_id = ${String(userId)}
      `);
      if (check.rows.length === 0)
        return res.status(404).json({ message: "Conversa não encontrada" });

      const result = await db.execute(sql`
        SELECT id, conversa_id, role, conteudo, tool_calls, criado_em
        FROM cortex_core.growth_ai_mensagens
        WHERE conversa_id = ${conversaId}
        ORDER BY criado_em ASC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("[growth-ai] Erro ao buscar mensagens:", error);
      res.status(500).json({ message: "Erro ao buscar mensagens" });
    }
  });

  // ── POST /api/growth-ai/chat ────────────────────────────────────────────

  app.post("/api/growth-ai/chat", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const { conversaId, message } = req.body;
      if (!conversaId || !message) {
        return res
          .status(400)
          .json({ message: "conversaId e message são obrigatórios" });
      }

      // Verify ownership
      const conversaCheck = await db.execute(sql`
        SELECT id, titulo FROM cortex_core.growth_ai_conversas
        WHERE id = ${conversaId} AND usuario_id = ${String(userId)}
      `);
      if (conversaCheck.rows.length === 0)
        return res.status(404).json({ message: "Conversa não encontrada" });

      const conversa = conversaCheck.rows[0] as any;

      // Save user message
      await db.execute(sql`
        INSERT INTO cortex_core.growth_ai_mensagens (conversa_id, role, conteudo)
        VALUES (${conversaId}, 'user', ${message})
      `);

      // Load conversation history
      const historyResult = await db.execute(sql`
        SELECT role, conteudo FROM cortex_core.growth_ai_mensagens
        WHERE conversa_id = ${conversaId}
        ORDER BY criado_em ASC
      `);

      // Build messages for Anthropic API (only user/assistant, no tool messages stored)
      const apiMessages: Anthropic.MessageParam[] = (
        historyResult.rows as any[]
      ).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.conteudo,
      }));

      // Tool-use loop
      let currentMessages = [...apiMessages];
      let finalText = "";
      let allToolCalls: any[] = [];

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const response = await anthropic.messages.create({
          model: MODEL_ID,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools: GROWTH_AI_TOOLS,
          messages: currentMessages,
        });

        // Check if there are tool_use blocks
        const toolUseBlocks = response.content.filter(
          (b) => b.type === "tool_use"
        );
        const textBlocks = response.content.filter((b) => b.type === "text");

        if (toolUseBlocks.length === 0) {
          // No more tool calls — extract final text
          finalText = textBlocks.map((b: any) => b.text).join("\n");
          break;
        }

        // Execute tool calls
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          if (block.type !== "tool_use") continue;

          console.log(
            `[growth-ai] Executing tool: ${block.name}`,
            JSON.stringify(block.input).substring(0, 200)
          );

          const result = await executeGrowthTool(
            db,
            block.name,
            block.input
          );

          allToolCalls.push({
            tool: block.name,
            input: block.input,
            output: JSON.parse(result),
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }

        // Add assistant response + tool results to messages for next iteration
        currentMessages.push({
          role: "assistant",
          content: response.content as any,
        });
        currentMessages.push({
          role: "user",
          content: toolResults,
        });

        // If response also had text alongside tools, capture it
        if (
          response.stop_reason === "end_turn" &&
          textBlocks.length > 0
        ) {
          finalText = textBlocks.map((b: any) => b.text).join("\n");
          break;
        }
      }

      // If we exhausted iterations without text, try one more time
      if (!finalText) {
        finalText =
          "Desculpe, não consegui concluir a análise dentro do limite de iterações. Tente reformular sua pergunta.";
      }

      // Save assistant response
      await db.execute(sql`
        INSERT INTO cortex_core.growth_ai_mensagens (conversa_id, role, conteudo, tool_calls)
        VALUES (${conversaId}, 'assistant', ${finalText}, ${JSON.stringify(allToolCalls)}::jsonb)
      `);

      // Auto-title on first message
      if (conversa.titulo === "Nova conversa") {
        const shortTitle =
          message.length > 60 ? message.substring(0, 57) + "..." : message;
        await db.execute(sql`
          UPDATE cortex_core.growth_ai_conversas
          SET titulo = ${shortTitle}, atualizado_em = NOW()
          WHERE id = ${conversaId}
        `);
      } else {
        await db.execute(sql`
          UPDATE cortex_core.growth_ai_conversas
          SET atualizado_em = NOW()
          WHERE id = ${conversaId}
        `);
      }

      res.json({
        role: "assistant",
        conteudo: finalText,
        toolCalls: allToolCalls,
        conversaId,
      });
    } catch (error: any) {
      console.error("[growth-ai] Erro no chat:", error);
      res.status(500).json({
        message: "Erro ao processar mensagem",
        error: error.message,
      });
    }
  });
}

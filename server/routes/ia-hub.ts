import type { Express } from "express";
import { db } from "../db";
import { iaHubConversas, iaHubMensagens } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── SDK Setup ────────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

// ── Model Definitions ────────────────────────────────────────────────────────

interface ModelConfig {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google";
}

const MODELS: ModelConfig[] = [
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "claude-sonnet-4-5-20250514", name: "Claude Sonnet", provider: "anthropic" },
  { id: "gemini-2.0-flash", name: "Gemini Flash", provider: "google" },
];

const SYSTEM_PROMPT = `Voce e um assistente de IA da Turbo Partners. Responda sempre em portugues brasileiro. Formate respostas em Markdown quando apropriado.`;

// ── AI Call Functions ────────────────────────────────────────────────────────

async function callOpenAI(
  messages: { role: string; content: string }[],
  modelId: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });
  return response.choices[0]?.message?.content || "Sem resposta.";
}

async function callAnthropic(
  messages: { role: string; content: string }[],
  modelId: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "Sem resposta.";
}

async function callGemini(
  messages: { role: string; content: string }[],
  modelId: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: modelId });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history,
    systemInstruction: SYSTEM_PROMPT,
  });

  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text() || "Sem resposta.";
}

async function callModel(
  messages: { role: string; content: string }[],
  modelId: string
): Promise<string> {
  const config = MODELS.find((m) => m.id === modelId);
  if (!config) throw new Error(`Modelo desconhecido: ${modelId}`);

  switch (config.provider) {
    case "openai":
      return callOpenAI(messages, modelId);
    case "anthropic":
      return callAnthropic(messages, modelId);
    case "google":
      return callGemini(messages, modelId);
  }
}

// ── Route Registration ───────────────────────────────────────────────────────

export function registerIaHubRoutes(app: Express) {

  // GET /api/ia-hub/models
  app.get("/api/ia-hub/models", (_req, res) => {
    res.json(MODELS.map((m) => ({ id: m.id, name: m.name, provider: m.provider })));
  });

  // GET /api/ia-hub/conversas
  app.get("/api/ia-hub/conversas", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Nao autenticado" });

      const conversas = await db
        .select()
        .from(iaHubConversas)
        .where(eq(iaHubConversas.usuarioId, String(userId)))
        .orderBy(desc(iaHubConversas.atualizadoEm));

      res.json(conversas);
    } catch (error) {
      console.error("[ia-hub] Erro ao listar conversas:", error);
      res.status(500).json({ message: "Erro ao listar conversas" });
    }
  });

  // POST /api/ia-hub/conversas
  app.post("/api/ia-hub/conversas", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Nao autenticado" });

      const [conversa] = await db
        .insert(iaHubConversas)
        .values({
          usuarioId: String(userId),
          titulo: "Nova conversa",
        })
        .returning();

      res.json(conversa);
    } catch (error) {
      console.error("[ia-hub] Erro ao criar conversa:", error);
      res.status(500).json({ message: "Erro ao criar conversa" });
    }
  });

  // GET /api/ia-hub/conversas/:id/mensagens
  app.get("/api/ia-hub/conversas/:id/mensagens", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Nao autenticado" });

      const conversaId = parseInt(req.params.id);
      if (isNaN(conversaId)) return res.status(400).json({ message: "ID invalido" });

      const [conversa] = await db
        .select()
        .from(iaHubConversas)
        .where(
          and(
            eq(iaHubConversas.id, conversaId),
            eq(iaHubConversas.usuarioId, String(userId))
          )
        );

      if (!conversa) return res.status(404).json({ message: "Conversa nao encontrada" });

      const mensagens = await db
        .select()
        .from(iaHubMensagens)
        .where(eq(iaHubMensagens.conversaId, conversaId))
        .orderBy(iaHubMensagens.criadoEm);

      res.json(mensagens);
    } catch (error) {
      console.error("[ia-hub] Erro ao buscar mensagens:", error);
      res.status(500).json({ message: "Erro ao buscar mensagens" });
    }
  });

  // POST /api/ia-hub/chat
  app.post("/api/ia-hub/chat", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Nao autenticado" });

      const { conversaId, message, modelo } = req.body;
      if (!conversaId || !message || !modelo) {
        return res.status(400).json({ message: "conversaId, message e modelo sao obrigatorios" });
      }

      if (!MODELS.find((m) => m.id === modelo)) {
        return res.status(400).json({ message: `Modelo invalido: ${modelo}` });
      }

      const [conversa] = await db
        .select()
        .from(iaHubConversas)
        .where(
          and(
            eq(iaHubConversas.id, conversaId),
            eq(iaHubConversas.usuarioId, String(userId))
          )
        );

      if (!conversa) return res.status(404).json({ message: "Conversa nao encontrada" });

      // Save user message
      await db.insert(iaHubMensagens).values({
        conversaId,
        role: "user",
        conteudo: message,
        modelo: null,
      });

      // Load history
      const history = await db
        .select()
        .from(iaHubMensagens)
        .where(eq(iaHubMensagens.conversaId, conversaId))
        .orderBy(iaHubMensagens.criadoEm);

      const aiMessages = history.map((m) => ({
        role: m.role,
        content: m.conteudo,
      }));

      // Call model
      const assistantContent = await callModel(aiMessages, modelo);

      // Save assistant response
      await db.insert(iaHubMensagens).values({
        conversaId,
        role: "assistant",
        conteudo: assistantContent,
        modelo,
      });

      // Auto-title
      if (conversa.titulo === "Nova conversa") {
        const shortTitle = message.length > 60 ? message.substring(0, 57) + "..." : message;
        await db
          .update(iaHubConversas)
          .set({ titulo: shortTitle, atualizadoEm: new Date() })
          .where(eq(iaHubConversas.id, conversaId));
      } else {
        await db
          .update(iaHubConversas)
          .set({ atualizadoEm: new Date() })
          .where(eq(iaHubConversas.id, conversaId));
      }

      res.json({
        role: "assistant",
        conteudo: assistantContent,
        modelo,
        conversaId,
      });
    } catch (error: any) {
      console.error("[ia-hub] Erro no chat:", error);
      res.status(500).json({
        message: "Erro ao processar mensagem",
        error: error.message,
      });
    }
  });

  // DELETE /api/ia-hub/conversas/:id
  app.delete("/api/ia-hub/conversas/:id", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Nao autenticado" });

      const conversaId = parseInt(req.params.id);
      if (isNaN(conversaId)) return res.status(400).json({ message: "ID invalido" });

      const [conversa] = await db
        .select()
        .from(iaHubConversas)
        .where(
          and(
            eq(iaHubConversas.id, conversaId),
            eq(iaHubConversas.usuarioId, String(userId))
          )
        );

      if (!conversa) return res.status(404).json({ message: "Conversa nao encontrada" });

      await db.delete(iaHubMensagens).where(eq(iaHubMensagens.conversaId, conversaId));
      await db.delete(iaHubConversas).where(eq(iaHubConversas.id, conversaId));

      res.json({ message: "Conversa excluida com sucesso" });
    } catch (error) {
      console.error("[ia-hub] Erro ao excluir conversa:", error);
      res.status(500).json({ message: "Erro ao excluir conversa" });
    }
  });
}

import type { Express } from "express";
import { db } from "../db";
import {
  juridicoClientes,
  juridicoProcessos,
  juridicoRegrasEscalonamento,
  juridicoChatConversas,
  juridicoChatMensagens,
} from "../../shared/schema";
import { eq, desc, sql, and, ilike, lte, gte } from "drizzle-orm";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

// ── OpenAI Setup ────────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MODEL = "gpt-4.1-mini";

// ── Knowledge Loading ───────────────────────────────────────────────────────────

function loadLegalKnowledge(): string {
  const files = [
    "agents/legal-cobranca.md",
    "agents/legal-contratos.md",
    "agents/legal-trabalhista.md",
  ];
  const sections: string[] = [];

  for (const file of files) {
    try {
      const fullPath = path.resolve(process.cwd(), file);
      const content = fs.readFileSync(fullPath, "utf-8");
      sections.push(content);
    } catch (err) {
      console.warn(`[juridico-assistente] Não foi possível carregar ${file}:`, err);
    }
  }

  return sections.join("\n\n---\n\n");
}

function buildSystemPrompt(): string {
  const knowledge = loadLegalKnowledge();
  return `Você é o Assistente Jurídico do Turbo Cortex — um especialista em direito empresarial brasileiro que auxilia o setor jurídico da Turbo Partners.

## REGRAS IMPORTANTES:
- Responda SEMPRE em português brasileiro
- Formate respostas em Markdown para melhor legibilidade
- Use tabelas quando apresentar dados comparativos
- NUNCA substitua aconselhamento de advogado
- Quando consultar dados do banco, apresente-os de forma organizada
- Se não tiver certeza sobre algo, diga explicitamente

## BASE DE CONHECIMENTO JURÍDICO:
${knowledge}`;
}

// ── OpenAI Tool Definitions ─────────────────────────────────────────────────────

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_clientes_inadimplentes",
      description:
        "Busca clientes inadimplentes no módulo jurídico, com filtros por status jurídico e procedimento atual.",
      parameters: {
        type: "object",
        properties: {
          status_juridico: {
            type: "string",
            enum: [
              "aguardando_documentos",
              "em_andamento",
              "finalizado",
              "suspenso",
            ],
            description: "Filtrar por status jurídico",
          },
          procedimento: {
            type: "string",
            enum: [
              "notificacao",
              "protesto",
              "acao_judicial",
              "acordo",
              "baixa",
            ],
            description: "Filtrar por procedimento atual",
          },
          limite: {
            type: "number",
            description: "Número máximo de resultados (padrão: 20)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_processos",
      description:
        "Busca processos judiciais cadastrados, com filtros por status, cliente e natureza da ação.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["Ativo", "Encerrado", "Arquivado", "Suspenso"],
            description: "Filtrar por status do processo",
          },
          cliente: {
            type: "string",
            description:
              "Nome parcial do cliente principal para busca (case-insensitive)",
          },
          natureza: {
            type: "string",
            enum: ["Cível", "Trabalhista"],
            description: "Filtrar por natureza da ação",
          },
          limite: {
            type: "number",
            description: "Número máximo de resultados (padrão: 20)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_regras_escalonamento",
      description:
        "Busca as regras de escalonamento de cobrança com base nos dias de atraso. Retorna o procedimento sugerido.",
      parameters: {
        type: "object",
        properties: {
          dias_atraso: {
            type: "number",
            description:
              "Número de dias de atraso para buscar a regra aplicável",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_parcelas_cliente",
      description:
        "Busca parcelas/faturas de um cliente no sistema financeiro Conta Azul, com filtros por nome e status.",
      parameters: {
        type: "object",
        properties: {
          nome_cliente: {
            type: "string",
            description: "Nome (parcial) do cliente para busca",
          },
          status: {
            type: "string",
            enum: ["PAGO", "PENDENTE", "VENCIDO"],
            description: "Filtrar por status da parcela",
          },
          limite: {
            type: "number",
            description: "Número máximo de resultados (padrão: 20)",
          },
        },
        required: ["nome_cliente"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumo_juridico",
      description:
        "Gera um resumo geral do módulo jurídico: total de processos ativos, clientes inadimplentes, agrupados por procedimento.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

// ── Tool Execution ──────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, any>
): Promise<string> {
  try {
    switch (name) {
      case "buscar_clientes_inadimplentes": {
        const conditions: any[] = [];
        if (args.status_juridico) {
          conditions.push(
            eq(juridicoClientes.statusJuridico, args.status_juridico)
          );
        }
        if (args.procedimento) {
          conditions.push(
            eq(juridicoClientes.procedimento, args.procedimento)
          );
        }
        const limite = args.limite || 20;

        const query = db
          .select()
          .from(juridicoClientes)
          .limit(limite)
          .orderBy(desc(juridicoClientes.dataCriacao));

        const results =
          conditions.length > 0
            ? await query.where(and(...conditions))
            : await query;

        return JSON.stringify({
          total: results.length,
          clientes: results,
        });
      }

      case "buscar_processos": {
        const conditions: any[] = [];
        if (args.status) {
          conditions.push(eq(juridicoProcessos.status, args.status));
        }
        if (args.cliente) {
          conditions.push(
            ilike(juridicoProcessos.clientePrincipal, `%${args.cliente}%`)
          );
        }
        if (args.natureza) {
          conditions.push(
            eq(juridicoProcessos.naturezaAcao, args.natureza)
          );
        }
        const limite = args.limite || 20;

        const query = db
          .select()
          .from(juridicoProcessos)
          .limit(limite)
          .orderBy(desc(juridicoProcessos.criadoEm));

        const results =
          conditions.length > 0
            ? await query.where(and(...conditions))
            : await query;

        return JSON.stringify({
          total: results.length,
          processos: results,
        });
      }

      case "buscar_regras_escalonamento": {
        const diasAtraso = args.dias_atraso;

        if (diasAtraso !== undefined && diasAtraso !== null) {
          const results = await db
            .select()
            .from(juridicoRegrasEscalonamento)
            .where(
              and(
                lte(juridicoRegrasEscalonamento.diasAtrasoMin, diasAtraso),
                eq(juridicoRegrasEscalonamento.ativo, true)
              )
            )
            .orderBy(desc(juridicoRegrasEscalonamento.prioridade));

          // Filter by diasAtrasoMax in application layer (may be null = no upper limit)
          const filtered = results.filter(
            (r) => r.diasAtrasoMax === null || r.diasAtrasoMax >= diasAtraso
          );

          return JSON.stringify({
            diasAtraso,
            regras: filtered,
          });
        }

        // No dias_atraso provided: return all active rules
        const results = await db
          .select()
          .from(juridicoRegrasEscalonamento)
          .where(eq(juridicoRegrasEscalonamento.ativo, true))
          .orderBy(juridicoRegrasEscalonamento.diasAtrasoMin);

        return JSON.stringify({ regras: results });
      }

      case "buscar_parcelas_cliente": {
        const nomeCliente = args.nome_cliente;
        const status = args.status;
        const limite = args.limite || 20;

        let whereClause = sql`nome_cliente ILIKE ${"%" + nomeCliente + "%"}`;
        if (status) {
          whereClause = sql`${whereClause} AND status = ${status}`;
        }

        const results = await db.execute(sql`
          SELECT
            id_parcela,
            cnpj_cliente,
            nome_cliente,
            data_emissao,
            data_vencimento,
            data_pagamento,
            valor,
            status,
            tipo,
            categoria,
            descricao
          FROM "Conta Azul".caz_parcelas
          WHERE ${whereClause}
          ORDER BY data_vencimento DESC
          LIMIT ${limite}
        `);

        return JSON.stringify({
          total: results.rows.length,
          parcelas: results.rows,
        });
      }

      case "resumo_juridico": {
        // Count active processos
        const processosAtivos = await db.execute(sql`
          SELECT COUNT(*)::int AS total
          FROM cortex_core.juridico_processos
          WHERE status = 'Ativo'
        `);

        // Count inadimplent clients
        const clientesInadimplentes = await db.execute(sql`
          SELECT COUNT(*)::int AS total
          FROM juridico_clientes
        `);

        // Group by procedimento
        const porProcedimento = await db.execute(sql`
          SELECT
            COALESCE(procedimento, 'sem_procedimento') AS procedimento,
            COUNT(*)::int AS total
          FROM juridico_clientes
          GROUP BY procedimento
          ORDER BY total DESC
        `);

        // Group by status
        const porStatus = await db.execute(sql`
          SELECT
            COALESCE(status_juridico, 'sem_status') AS status_juridico,
            COUNT(*)::int AS total
          FROM juridico_clientes
          GROUP BY status_juridico
          ORDER BY total DESC
        `);

        return JSON.stringify({
          processos_ativos: processosAtivos.rows[0]?.total ?? 0,
          clientes_inadimplentes: clientesInadimplentes.rows[0]?.total ?? 0,
          por_procedimento: porProcedimento.rows,
          por_status: porStatus.rows,
        });
      }

      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` });
    }
  } catch (err: any) {
    console.error(`[juridico-assistente] Erro ao executar tool ${name}:`, err);
    return JSON.stringify({
      error: `Erro ao executar ${name}: ${err.message}`,
    });
  }
}

// ── Route Registration ──────────────────────────────────────────────────────────

export function registerJuridicoAssistenteRoutes(app: Express) {
  const SYSTEM_PROMPT = buildSystemPrompt();

  // ── GET /api/juridico/assistente/conversas ──────────────────────────────────
  // List user's conversations
  app.get("/api/juridico/assistente/conversas", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const conversas = await db
        .select()
        .from(juridicoChatConversas)
        .where(eq(juridicoChatConversas.usuarioId, String(userId)))
        .orderBy(desc(juridicoChatConversas.atualizadoEm));

      res.json(conversas);
    } catch (error) {
      console.error("[juridico-assistente] Erro ao listar conversas:", error);
      res.status(500).json({ message: "Erro ao listar conversas" });
    }
  });

  // ── POST /api/juridico/assistente/conversas ─────────────────────────────────
  // Create new conversation
  app.post("/api/juridico/assistente/conversas", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const [conversa] = await db
        .insert(juridicoChatConversas)
        .values({
          usuarioId: String(userId),
          titulo: "Nova conversa",
        })
        .returning();

      res.json(conversa);
    } catch (error) {
      console.error("[juridico-assistente] Erro ao criar conversa:", error);
      res.status(500).json({ message: "Erro ao criar conversa" });
    }
  });

  // ── GET /api/juridico/assistente/conversas/:id/mensagens ────────────────────
  // Get messages for a conversation
  app.get(
    "/api/juridico/assistente/conversas/:id/mensagens",
    async (req, res) => {
      try {
        const userId = (req as any).user?.id;
        if (!userId)
          return res.status(401).json({ message: "Não autenticado" });

        const conversaId = parseInt(req.params.id);
        if (isNaN(conversaId))
          return res.status(400).json({ message: "ID inválido" });

        // Verify ownership
        const [conversa] = await db
          .select()
          .from(juridicoChatConversas)
          .where(
            and(
              eq(juridicoChatConversas.id, conversaId),
              eq(juridicoChatConversas.usuarioId, String(userId))
            )
          );

        if (!conversa)
          return res.status(404).json({ message: "Conversa não encontrada" });

        const mensagens = await db
          .select()
          .from(juridicoChatMensagens)
          .where(eq(juridicoChatMensagens.conversaId, conversaId))
          .orderBy(juridicoChatMensagens.criadoEm);

        res.json(mensagens);
      } catch (error) {
        console.error(
          "[juridico-assistente] Erro ao buscar mensagens:",
          error
        );
        res.status(500).json({ message: "Erro ao buscar mensagens" });
      }
    }
  );

  // ── POST /api/juridico/assistente/chat ──────────────────────────────────────
  // Send message and get AI response (agentic loop)
  app.post("/api/juridico/assistente/chat", async (req, res) => {
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
      const [conversa] = await db
        .select()
        .from(juridicoChatConversas)
        .where(
          and(
            eq(juridicoChatConversas.id, conversaId),
            eq(juridicoChatConversas.usuarioId, String(userId))
          )
        );

      if (!conversa)
        return res.status(404).json({ message: "Conversa não encontrada" });

      // 1. Save user message to DB
      await db.insert(juridicoChatMensagens).values({
        conversaId,
        role: "user",
        conteudo: message,
      });

      // 2. Load conversation history from DB
      const history = await db
        .select()
        .from(juridicoChatMensagens)
        .where(eq(juridicoChatMensagens.conversaId, conversaId))
        .orderBy(juridicoChatMensagens.criadoEm);

      // 3. Build messages array
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.conteudo,
        })),
      ];

      // 4. Call OpenAI with tools
      let response = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: "auto",
      });

      // 5. Agentic loop: while response has tool_calls (max 5 iterations)
      let iterations = 0;
      const MAX_ITERATIONS = 5;

      while (
        response.choices[0]?.finish_reason === "tool_calls" &&
        response.choices[0]?.message?.tool_calls &&
        response.choices[0].message.tool_calls.length > 0 &&
        iterations < MAX_ITERATIONS
      ) {
        iterations++;
        const assistantMessage = response.choices[0].message;

        // Add assistant message with tool_calls to messages
        messages.push(assistantMessage);

        // Execute each tool and add results
        for (const toolCall of assistantMessage.tool_calls!) {
          const args = JSON.parse(toolCall.function.arguments);
          console.log(
            `[juridico-assistente] Executando tool: ${toolCall.function.name}`,
            args
          );

          const result = await executeTool(toolCall.function.name, args);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Call OpenAI again
        response = await openai.chat.completions.create({
          model: MODEL,
          messages,
          tools,
          tool_choice: "auto",
        });
      }

      // 6. Extract final assistant response
      const assistantContent =
        response.choices[0]?.message?.content ||
        "Desculpe, não consegui gerar uma resposta.";

      // 7. Save assistant response to DB
      await db.insert(juridicoChatMensagens).values({
        conversaId,
        role: "assistant",
        conteudo: assistantContent,
      });

      // 8. Auto-generate title from first user message if still default
      if (conversa.titulo === "Nova conversa") {
        // Use the first user message to generate a short title
        const shortTitle = message.length > 60
          ? message.substring(0, 57) + "..."
          : message;

        await db
          .update(juridicoChatConversas)
          .set({
            titulo: shortTitle,
            atualizadoEm: new Date(),
          })
          .where(eq(juridicoChatConversas.id, conversaId));
      } else {
        // Update timestamp
        await db
          .update(juridicoChatConversas)
          .set({ atualizadoEm: new Date() })
          .where(eq(juridicoChatConversas.id, conversaId));
      }

      // 9. Return response
      res.json({
        role: "assistant",
        conteudo: assistantContent,
        conversaId,
      });
    } catch (error: any) {
      console.error("[juridico-assistente] Erro no chat:", error);
      res.status(500).json({
        message: "Erro ao processar mensagem",
        error: error.message,
      });
    }
  });

  // ── DELETE /api/juridico/assistente/conversas/:id ───────────────────────────
  // Delete conversation + messages
  app.delete("/api/juridico/assistente/conversas/:id", async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ message: "Não autenticado" });

      const conversaId = parseInt(req.params.id);
      if (isNaN(conversaId))
        return res.status(400).json({ message: "ID inválido" });

      // Verify ownership
      const [conversa] = await db
        .select()
        .from(juridicoChatConversas)
        .where(
          and(
            eq(juridicoChatConversas.id, conversaId),
            eq(juridicoChatConversas.usuarioId, String(userId))
          )
        );

      if (!conversa)
        return res.status(404).json({ message: "Conversa não encontrada" });

      // Delete messages first (FK dependency)
      await db
        .delete(juridicoChatMensagens)
        .where(eq(juridicoChatMensagens.conversaId, conversaId));

      // Delete conversation
      await db
        .delete(juridicoChatConversas)
        .where(eq(juridicoChatConversas.id, conversaId));

      res.json({ message: "Conversa excluída com sucesso" });
    } catch (error) {
      console.error("[juridico-assistente] Erro ao excluir conversa:", error);
      res.status(500).json({ message: "Erro ao excluir conversa" });
    }
  });
}

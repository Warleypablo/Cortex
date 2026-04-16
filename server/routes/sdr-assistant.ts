import type { Express, Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthenticated } from "../auth/middleware";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOOL_ITERATIONS = 5;
const MAX_TOKENS = 1024;

export type DealStatus = "ativo" | "ganho" | "perdido";

export function classifyDealStatus(stageName: string): DealStatus {
  const s = (stageName || "").toLowerCase();
  if (
    s.includes("perdido") ||
    s.includes("lose") ||
    s.includes("descartado") ||
    s.includes("descarte")
  ) {
    return "perdido";
  }
  if (
    s.includes("ganho") ||
    s.includes("won") ||
    s.includes("contrato assinado")
  ) {
    return "ganho";
  }
  return "ativo";
}

export interface CompanyMatch {
  company_name: string;
  deal_count: number;
  last_deal_id: number;
  last_stage: string;
}

export async function searchCompanies(
  db: any,
  query: string
): Promise<CompanyMatch[]> {
  const trimmed = (query || "").trim();
  if (trimmed.length < 3) {
    throw new Error("query precisa ter pelo menos 3 caracteres");
  }
  const pattern = `%${trimmed}%`;
  const result = await db.execute(sql`
    SELECT
      d.company_name,
      COUNT(*)::int AS deal_count,
      MAX(d.id)::int AS last_deal_id,
      (ARRAY_AGG(d.stage_name ORDER BY d.date_create DESC NULLS LAST))[1] AS last_stage
    FROM "Bitrix".crm_deal d
    WHERE d.company_name IS NOT NULL
      AND (d.company_name ILIKE ${pattern} OR d.title ILIKE ${pattern})
    GROUP BY d.company_name
    ORDER BY deal_count DESC, last_deal_id DESC
    LIMIT 10
  `);
  return (result.rows || []) as CompanyMatch[];
}

export interface DealDetails {
  id: number;
  title: string;
  stage: string;
  categoria: string | null;
  sdr: string | null;
  closer: string | null;
  criado_em: string | null;
  fechado_em: string | null;
  valor_mrr: number | null;
  valor_pontual: number | null;
  status: DealStatus;
  motivo_perda: string | null;
  origem: string | null;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  if (str.length >= 10) return str.slice(0, 10);
  return null;
}

export async function getCompanyTimeline(
  db: any,
  companyName: string
): Promise<DealDetails[]> {
  const result = await db.execute(sql`
    SELECT
      d.id, d.title, d.stage_name,
      d.category_name AS categoria,
      d.source,
      d.valor_recorrente, d.valor_pontual,
      d.date_create, d.data_fechamento,
      d.comments,
      NULL::text AS motivo_perda,
      d.assigned_by_name AS responsavel,
      d.closer
    FROM "Bitrix".crm_deal d
    WHERE d.company_name = ${companyName}
    ORDER BY d.date_create DESC NULLS LAST
  `);

  return (result.rows || []).map((row: any): DealDetails => ({
    id: Number(row.id),
    title: row.title,
    stage: row.stage_name,
    categoria: row.categoria,
    sdr: row.responsavel ?? null,
    closer: row.closer ?? null,
    criado_em: toIsoDate(row.date_create),
    fechado_em: toIsoDate(row.data_fechamento),
    valor_mrr: row.valor_recorrente != null ? Number(row.valor_recorrente) : null,
    valor_pontual: row.valor_pontual != null ? Number(row.valor_pontual) : null,
    status: classifyDealStatus(row.stage_name),
    motivo_perda: row.motivo_perda,
    origem: row.source,
  }));
}

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_companies",
    description:
      "Busca empresas no CRM Bitrix por nome (fuzzy match). Use quando o SDR informa o nome de uma empresa para verificar histórico. Retorna até 10 matches com deal_count e last_stage.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Nome ou parte do nome da empresa (mínimo 3 caracteres)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_company_timeline",
    description:
      "Retorna todos os deals de uma empresa específica em ordem cronológica decrescente. Use após identificar a empresa correta via search_companies.",
    input_schema: {
      type: "object" as const,
      properties: {
        company_name: {
          type: "string",
          description: "Nome exato da empresa conforme retornado por search_companies",
        },
      },
      required: ["company_name"],
    },
  },
];

const SYSTEM_PROMPT = `Você é o SDR Assistant da Turbo Partners. Ajuda o time comercial a checar histórico de empresas no CRM Bitrix antes de abordar.

REGRAS:
1. SDR envia nome da empresa. Você busca no Bitrix usando search_companies.
2. Se múltiplos matches (>1), peça disambiguação. Liste até 5 opções com: número, nome completo, stage atual, quantidade de deals. Peça "digite o número ou o nome completo".
3. Se 1 match, chame get_company_timeline automaticamente e apresente o resultado.
4. Se 0 matches, responda "Empresa nova — sem histórico no Bitrix." e sugira prosseguir.
5. Para descartes, informe o motivo se motivo_perda estiver preenchido; caso contrário, diga "motivo não registrado".
6. Tom: direto, sem floreio. SDR tem pressa. Use bullets e emojis 🟢 📜.
7. NUNCA invente dados. Se a tool não retornou, diga que não tem.

FORMATO PADRÃO quando há histórico:

🟢 ATIVO — <responsável> | <stage> | criado em <data>
   <valor MRR se houver> | Origem: <origem>

📜 HISTÓRICO (N deals anteriores):
   • <data> — <responsável> | <stage_final> | <motivo se descarte>
   • ...

Destaque sempre o deal ATIVO no topo (se existir). Se só tem deals fechados (perdidos/ganhos), liste todos em ordem decrescente.`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function runSdrAssistant(
  db: any,
  conversation: ChatMessage[]
): Promise<{
  response: string;
  toolCalls: string[];
  tokensTotal: number;
  matchedCompany: string | null;
}> {
  const messages: Anthropic.Messages.MessageParam[] = conversation.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolCalls: string[] = [];
  let matchedCompany: string | null = null;
  let totalTokens = 0;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: TOOLS,
      messages,
    });

    totalTokens +=
      (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0);

    if (resp.stop_reason === "end_turn" || resp.stop_reason === "max_tokens") {
      const textBlock = resp.content.find((b) => b.type === "text") as
        | Anthropic.Messages.TextBlock
        | undefined;
      return {
        response: textBlock?.text || "(sem resposta)",
        toolCalls,
        tokensTotal: totalTokens,
        matchedCompany,
      };
    }

    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content });

      const toolUseBlocks = resp.content.filter(
        (b) => b.type === "tool_use"
      ) as Anthropic.Messages.ToolUseBlock[];

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        toolCalls.push(block.name);
        try {
          let result: unknown;
          if (block.name === "search_companies") {
            const { query } = block.input as { query: string };
            result = await searchCompanies(db, query);
          } else if (block.name === "get_company_timeline") {
            const { company_name } = block.input as { company_name: string };
            matchedCompany = company_name;
            result = await getCompanyTimeline(db, company_name);
          } else {
            result = { error: `unknown tool: ${block.name}` };
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err: any) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: err.message || "erro desconhecido" }),
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return {
      response: "(erro: stop_reason inesperado)",
      toolCalls,
      tokensTotal: totalTokens,
      matchedCompany,
    };
  }

  return {
    response: "(limite de iterações de tools excedido)",
    toolCalls,
    tokensTotal: totalTokens,
    matchedCompany,
  };
}

const ALLOWED_DEPARTMENTS = new Set(["admin", "comercial"]);

function requireInternalCollaborator(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "not authenticated" });
  }
  if (!ALLOWED_DEPARTMENTS.has(user.department)) {
    return res
      .status(403)
      .json({ error: "forbidden — internal collaborators only (admin/comercial)" });
  }
  next();
}

export function registerSdrAssistantRoutes(app: Express, db: any) {
  app.post(
    "/api/sdr-assistant/chat",
    isAuthenticated,
    requireInternalCollaborator,
    async (req: Request, res: Response) => {
      const user = (req as any).user;
      const { messages } = req.body as { messages?: ChatMessage[] };

      if (!Array.isArray(messages) || messages.length === 0) {
        return res
          .status(400)
          .json({ error: "messages deve ser array não vazio" });
      }

      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const query = lastUserMsg?.content || "";
      const startedAt = Date.now();

      try {
        const result = await runSdrAssistant(db, messages);
        const durationMs = Date.now() - startedAt;

        await db
          .execute(sql`
            INSERT INTO cortex_core.sdr_assistant_usage
              (user_id, query, matched_company, tool_calls, tokens_total, duration_ms)
            VALUES
              (${user.id}, ${query}, ${result.matchedCompany},
               ${result.toolCalls.length}, ${result.tokensTotal}, ${durationMs})
          `)
          .catch((err: any) => {
            console.error("[sdr-assistant] erro ao gravar log:", err.message);
          });

        return res.json({
          response: result.response,
          tool_calls: result.toolCalls,
          usage: { tokens: result.tokensTotal, duration_ms: durationMs },
        });
      } catch (err: any) {
        console.error("[sdr-assistant] erro:", err);
        const durationMs = Date.now() - startedAt;
        await db
          .execute(sql`
            INSERT INTO cortex_core.sdr_assistant_usage
              (user_id, query, matched_company, tool_calls, tokens_total, duration_ms)
            VALUES
              (${user.id}, ${query}, NULL, 0, 0, ${durationMs})
          `)
          .catch(() => {
            /* não propagar falha de log */
          });
        return res
          .status(500)
          .json({ error: "Erro interno ao processar a consulta." });
      }
    }
  );
}

import { db } from "../db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

interface EntregavelNode {
  titulo: string;
  descricao: string;
  prioridade: string;
  subtasks: EntregavelNode[];
}

interface GenerateContext {
  contratoId: number;
}

export async function generateEntregaveisFromContrato(ctx: GenerateContext): Promise<void> {
  try {
    const openai = getOpenAI();
    if (!openai) {
      console.warn("[entregaveis] OpenAI not configured, skipping generation");
      return;
    }

    // 1. Fetch contract items with their plan scope
    const itensResult = await db.execute(sql`
      SELECT ci.id as item_id, ci.contrato_id,
             ps.nome as servico_nome, ps.escopo, ps.diretrizes
      FROM staging.contratos_itens ci
      JOIN staging.planos_servicos ps ON ps.id = ci.plano_servico_id
      WHERE ci.contrato_id = ${ctx.contratoId}
        AND ci.plano_servico_id IS NOT NULL
        AND ps.escopo IS NOT NULL
        AND ps.escopo != ''
    `);

    if (itensResult.rows.length === 0) {
      console.log("[entregaveis] No items with scope found for contrato:", ctx.contratoId);
      return;
    }

    // 2. For each item, generate entregaveis via AI
    for (const row of itensResult.rows) {
      const item = row as any;
      try {
        await generateForItem(openai, ctx.contratoId, item.item_id, item.servico_nome, item.escopo, item.diretrizes);
      } catch (err) {
        console.error(`[entregaveis] Error generating for item ${item.item_id}:`, err);
      }
    }

    console.log(`[entregaveis] Generation complete for contrato ${ctx.contratoId}`);
  } catch (error) {
    console.error("[entregaveis] Generation failed:", error);
  }
}

async function generateForItem(
  openai: OpenAI,
  contratoId: number,
  itemId: number,
  servicoNome: string,
  escopo: string,
  diretrizes: string | null
): Promise<void> {
  const prompt = `Dado o escopo e diretrizes abaixo de um servico de marketing digital contratado, gere uma lista JSON hierarquica de entregaveis necessarios para cumprir o escopo.

Cada item pode ter sub-items recursivamente. Seja concreto e pratico.

Formato JSON obrigatorio:
{
  "entregaveis": [
    {
      "titulo": "Nome da fase/entrega",
      "descricao": "O que fazer concretamente",
      "prioridade": "alta|media|baixa",
      "subtasks": [
        { "titulo": "...", "descricao": "...", "prioridade": "...", "subtasks": [] }
      ]
    }
  ]
}

Servico: ${servicoNome}
Escopo: ${escopo}
${diretrizes ? `Diretrizes: ${diretrizes}` : ''}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Voce e um especialista em gestao de projetos de marketing digital. Retorne APENAS JSON valido." },
      { role: "user", content: prompt }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return;

  let parsed: { entregaveis: EntregavelNode[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("[entregaveis] Failed to parse AI response as JSON");
    return;
  }

  if (!parsed.entregaveis || !Array.isArray(parsed.entregaveis)) return;

  // 3. Insert recursively
  await insertTree(contratoId, itemId, null, parsed.entregaveis, 0);
}

async function insertTree(
  contratoId: number,
  itemId: number,
  parentId: number | null,
  nodes: EntregavelNode[],
  nivel: number
): Promise<void> {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const result = await db.execute(sql`
      INSERT INTO staging.entregaveis (contrato_id, contrato_item_id, parent_id, titulo, descricao, prioridade, ordem, nivel)
      VALUES (${contratoId}, ${itemId}, ${parentId}, ${node.titulo}, ${node.descricao || null}, ${node.prioridade || 'media'}, ${i}, ${nivel})
      RETURNING id
    `);

    const newId = (result.rows[0] as any).id;

    if (node.subtasks && node.subtasks.length > 0) {
      await insertTree(contratoId, itemId, newId, node.subtasks, nivel + 1);
    }
  }
}

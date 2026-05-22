/**
 * IA de copy para broadcasts GHL.
 *
 * Adapta os prompts do dashboard-broadcast (estagiário, mai/2026, api/claude.js)
 * para o backend do Cortex, usando o Anthropic SDK já instalado.
 *
 * Funções:
 *  - analisarCopy(texto, canal): avalia uma copy e retorna scoring estruturado.
 *  - gerarCopies({ ... }): gera 3 variações de copy com base em exemplos reais.
 */

import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { db } from "../db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

// Haiku é rápido e barato pra tarefas curtas de classificação/scoring.
// Pra geração, mantém também (~2-3s e dobra menos custo que Sonnet pra esse uso).
const MODEL = "claude-haiku-4-5-20251001";

function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

// ─── ANALISAR COPY ────────────────────────────────────────────────────────

export interface AnaliseCopy {
  score_geral: number;
  veredicto: "Aprovado" | "Pode melhorar" | "Reescrever";
  criterios: {
    hook: { pontos: number; max: number; feedback: string };
    cta: { pontos: number; max: number; feedback: string };
    comprimento: { pontos: number; max: number; feedback: string };
    urgencia: { pontos: number; max: number; feedback: string };
    especificidade: { pontos: number; max: number; feedback: string };
    personalizacao: { pontos: number; max: number; feedback: string };
  };
  pontos_fortes: string[];
  pontos_atencao: string[];
  sugestao_melhoria: string;
}

function buildAnalisarPrompt(texto: string, canal: "WhatsApp" | "Email"): string {
  return `Você é um especialista em copywriting de resposta direta para broadcasts de WhatsApp e Email no mercado brasileiro.

Analise a mensagem abaixo e retorne APENAS um objeto JSON válido, sem texto antes ou depois, com exatamente esta estrutura:

{
  "score_geral": <número de 0 a 100>,
  "veredicto": <"Aprovado" | "Pode melhorar" | "Reescrever">,
  "criterios": {
    "hook":           { "pontos": <0-20>, "max": 20, "feedback": "<feedback sobre a abertura/primeira linha>" },
    "cta":            { "pontos": <0-20>, "max": 20, "feedback": "<feedback sobre o CTA>" },
    "comprimento":    { "pontos": <0-15>, "max": 15, "feedback": "<feedback sobre tamanho para ${canal}>" },
    "urgencia":       { "pontos": <0-15>, "max": 15, "feedback": "<feedback sobre gatilhos de urgência>" },
    "especificidade": { "pontos": <0-15>, "max": 15, "feedback": "<feedback sobre números, marcas, provas>" },
    "personalizacao": { "pontos": <0-15>, "max": 15, "feedback": "<feedback sobre tom e conexão>" }
  },
  "pontos_fortes":  ["<ponto 1>", "<ponto 2>"],
  "pontos_atencao": ["<atenção 1>", "<atenção 2>"],
  "sugestao_melhoria": "<versão reescrita da mensagem, mantendo intent original>"
}

Canal: ${canal}
Mensagem:
${texto}`;
}

export async function analisarCopy(texto: string, canal: "WhatsApp" | "Email" = "WhatsApp"): Promise<AnaliseCopy> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada no servidor");
  }
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: buildAnalisarPrompt(texto, canal) }],
  });
  const block = response.content[0];
  const text = block.type === "text" ? block.text : "{}";
  return parseJsonResponse<AnaliseCopy>(text);
}

// ─── GERAR COPIES ──────────────────────────────────────────────────────────

export interface GerarOptions {
  objetivo: string;
  base: string;
  tom: string;
  tamanho: string;
  contexto?: string;
  padraoAlvo?: string;
  topPerformers?: TopPerformer[];
}

export interface TopPerformer {
  ideia: string;
  texto: string;
  base?: string;
  padrao?: string;
  /** "70%" ou "0.7" — string livre. Aparece no exemplo do prompt. */
  aberturaPct?: string;
  reunioes?: number;
}

export interface VariacaoCopy {
  titulo: string;
  padrao: string;
  copy: string;
  raciocinio: string;
}

function buildGerarPrompt(opts: GerarOptions): string {
  const examples = (opts.topPerformers ?? []).map((m, i) => `
Exemplo ${i + 1}${m.aberturaPct ? ` — ${m.aberturaPct} de engajamento` : ""}${m.reunioes ? ` / ${m.reunioes} reuniões` : ""}:
${m.ideia ? `Ideia: ${m.ideia}\n` : ""}${m.padrao ? `Padrão: ${m.padrao}\n` : ""}${m.base ? `Base: ${m.base}\n` : ""}Copy:
${m.texto}
`).join("\n---\n");

  return `Você é um especialista em copywriting de resposta direta para broadcasts de WhatsApp da Turbo Partners (agência de marketing para empresários que faturam 30-500k/mês).

Sua tarefa: gerar 3 VARIAÇÕES de copy com base nas melhores mensagens da Turbo, seguindo rigorosamente os padrões que já funcionaram.

## PADRÕES VENCEDORES (use 1 ou mais em cada variação)
1. HOOK PROVOCATIVO — pergunta contraintuitiva ou afirmação que quebra senso comum
2. CASE STUDY — nome de marca real + número específico
3. CONTRASTE ✗/✓ — 2-3 linhas de "jeito errado" vs "jeito certo"
4. LOSS AVERSION — custo da inação, não só do ganho
5. URGÊNCIA SAZONAL — gancho em data/evento de mercado
6. CTA CONVERSACIONAL — pede resposta direta, nunca link
7. PERSONALIZAÇÃO DE NICHO — menciona faixa de faturamento específica

## ANTI-PADRÕES (evitar)
- Pergunta genérica sem contexto
- Mensagem muito longa sem escaneabilidade
- Reenvio frio sem novo hook
- Evento sem pain point inicial

${examples ? `## EXEMPLOS REAIS DA TURBO\n${examples}\n` : ""}
## BRIEFING DA NOVA MENSAGEM
- Objetivo: ${opts.objetivo}
- Base-alvo: ${opts.base}
- Tom: ${opts.tom}
- Tamanho esperado: ${opts.tamanho}
${opts.padraoAlvo ? `- Padrão preferido: ${opts.padraoAlvo}` : ""}
${opts.contexto ? `- Contexto adicional: ${opts.contexto}` : ""}

Retorne APENAS um JSON válido, sem texto antes/depois, neste formato exato:
{
  "variacoes": [
    {
      "titulo": "<título curto descritivo da copy>",
      "padrao": "<padrão principal usado>",
      "copy": "<mensagem completa, com quebras de linha \\n>",
      "raciocinio": "<1 frase explicando por que essa abordagem vai funcionar para a base ${opts.base}>"
    },
    { ... },
    { ... }
  ]
}

As 3 variações devem ser DIFERENTES entre si em abordagem (ex: uma com case study, outra com loss aversion, outra com contraste). Todas em português brasileiro, tom de WhatsApp.`;
}

export async function gerarCopies(opts: GerarOptions): Promise<{ variacoes: VariacaoCopy[] }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada no servidor");
  }
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2500,
    messages: [{ role: "user", content: buildGerarPrompt(opts) }],
  });
  const block = response.content[0];
  const text = block.type === "text" ? block.text : "{}";
  return parseJsonResponse<{ variacoes: VariacaoCopy[] }>(text);
}

// ─── TOP PERFORMERS DO BANCO ──────────────────────────────────────────────

/**
 * Busca mensagens recentes que tiveram alta taxa de resposta (proxy de
 * engajamento na ausência de open rate). Usadas como exemplos pro prompt
 * de gerarCopies.
 */
export async function buscarTopPerformers(limit = 5): Promise<TopPerformer[]> {
  const r = await db.execute(sql`
    WITH outbound_recente AS (
      SELECT m.contact_id, m.body, m.date_added, m.source, m.message_type
      FROM cortex_core.ghl_messages m
      WHERE m.direction = 'outbound'
        AND m.message_type = 'TYPE_WHATSAPP'
        AND m.source IN ('workflow', 'bulk', 'campaign')
        AND LENGTH(m.body) BETWEEN 100 AND 800
        AND m.date_added >= NOW() - INTERVAL '90 days'
    ),
    com_resposta AS (
      SELECT
        o.body,
        o.source,
        o.message_type,
        (
          SELECT COUNT(*) FROM cortex_core.ghl_messages m2
          WHERE m2.contact_id = o.contact_id
            AND m2.direction = 'inbound'
            AND m2.date_added > o.date_added
            AND m2.date_added < o.date_added + INTERVAL '48 hours'
        )::int AS replies_48h
      FROM outbound_recente o
    )
    SELECT body, source, replies_48h
    FROM com_resposta
    WHERE replies_48h > 0
    ORDER BY replies_48h DESC, LENGTH(body) DESC
    LIMIT ${limit}
  `);
  const rows = (r as any).rows ?? [];
  return rows.map((row: any) => ({
    ideia: row.source ? `Broadcast via ${row.source}` : "Broadcast",
    texto: row.body,
    aberturaPct: `${row.replies_48h} resposta(s) em 48h`,
  }));
}

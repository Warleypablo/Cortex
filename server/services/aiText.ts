/**
 * Geração de texto por IA com fallback de provedor.
 *
 * Tenta Claude (primário) e, se a chave estiver inválida/indisponível ou o
 * provedor falhar, cai pro OpenAI. Evita que features de IA (narrativa do
 * relatório, classificação de sentimento/padrão) quebrem quando um provedor
 * está fora — ex.: ANTHROPIC_API_KEY expirada.
 *
 * Retorna o texto cru (o chamador faz o parse). Lança só se NENHUM provedor
 * responde. Para saída JSON confiável no OpenAI, passe { json: true } (exige a
 * palavra "json" no prompt, o que já ocorre nos prompts que pedem JSON).
 */

import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const OPENAI_MODEL = "gpt-4o-mini";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return _anthropic;
}

export interface GerarTextoOpts {
  maxTokens?: number;
  /** OpenAI: força response_format json_object (prompt precisa citar "json"). */
  json?: boolean;
}

export async function gerarTextoIA(prompt: string, opts: GerarTextoOpts = {}): Promise<string> {
  const maxTokens = opts.maxTokens ?? 500;
  const erros: string[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await getAnthropic().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const block = response.content[0];
      const text = block?.type === "text" ? block.text : "";
      if (text.trim()) return text;
      erros.push("Claude: resposta vazia");
    } catch (err: any) {
      erros.push(`Claude: ${err.message}`);
      console.error("[aiText] Claude falhou, tentando OpenAI:", err.message);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${resp.status} ${body.slice(0, 200)} | anterior: ${erros.join("; ")}`);
    }
    const j: any = await resp.json();
    const text = j.choices?.[0]?.message?.content;
    if (text?.trim()) return text;
    erros.push("OpenAI: resposta vazia");
  }

  throw new Error(`Nenhum provedor de IA respondeu (${erros.join("; ") || "sem chaves configuradas"})`);
}

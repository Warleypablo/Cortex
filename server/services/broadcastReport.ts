/**
 * Narrativa estratégica do relatório mensal de broadcast (Claude).
 *
 * Recebe os números já agregados (mês atual vs anterior + bases + padrões) e devolve
 * um resumo executivo + recomendações acionáveis pro próximo mês. Toda a parte de DADOS
 * é calculada no endpoint (determinística); aqui só a leitura estratégica.
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";
const OPENAI_MODEL = "gpt-4o-mini";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return _anthropic;
}

/**
 * Gera texto via IA com fallback de provedor: tenta Claude (primário) e, se a
 * chave estiver inválida/indisponível, cai pro OpenAI. Assim a narrativa não
 * quebra quando um provedor está fora (ex.: ANTHROPIC_API_KEY expirada).
 * Retorna o texto cru (o chamador faz o parse). Lança se nenhum provedor responde.
 */
async function gerarTextoIA(prompt: string, maxTokens: number): Promise<string> {
  const erros: string[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await getAnthropic().messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const block = response.content[0];
      const text = block?.type === "text" ? block.text : "";
      if (text.trim()) return text;
      erros.push("Claude: resposta vazia");
    } catch (err: any) {
      erros.push(`Claude: ${err.message}`);
      console.error("[broadcastReport] Claude falhou, tentando OpenAI:", err.message);
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
        response_format: { type: "json_object" },
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

export interface DadosRelatorio {
  periodo: { from: string; to: string };
  atual: Record<string, number | null>;
  anterior: Record<string, number | null>;
  topBases: Array<{ base: string; abertura_pct: number | null; reunioes: number; vendas: number }>;
  topPadroes: Array<{ padrao: string; abertura_pct: number | null; reunioes: number }>;
  datasComerciaisProximas: string[];
}

export interface Narrativa {
  resumo: string;
  recomendacoes: string[];
}

export async function gerarNarrativaRelatorio(d: DadosRelatorio): Promise<Narrativa> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { resumo: "Narrativa por IA indisponível (sem chave Claude).", recomendacoes: [] };
  }
  const prompt = `Você é um analista de growth da Turbo Partners (agência de marketing B2B no Brasil).
Analise os números de WhatsApp marketing (broadcasts) abaixo e escreva um relatório estratégico curto.

Responda APENAS um JSON válido, sem texto antes/depois:
{ "resumo": "<2-4 frases: o que aconteceu no período vs o anterior, o que se destacou>",
  "recomendacoes": ["<recomendação acionável 1>", "<2>", "<3>", "<4>"] }

As recomendações devem ser concretas pro PRÓXIMO mês: quais bases priorizar, quais padrões de copy usar,
cuidados de cadência/fadiga, e oportunidades nas datas comerciais à frente. Use os números.

DADOS (JSON):
${JSON.stringify(d)}`;

  try {
    const raw = await gerarTextoIA(prompt, 700);
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<Narrativa>;
    return {
      resumo: parsed.resumo || "Sem resumo.",
      recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes : [],
    };
  } catch (err: any) {
    console.error("[broadcastReport] narrativa falhou:", err.message);
    const authError = /401|invalid x-api-key|authentication/i.test(err.message);
    return {
      resumo: authError
        ? "Narrativa por IA indisponível: a chave da API está inválida/expirada. Atualizar ANTHROPIC_API_KEY (ou OPENAI_API_KEY)."
        : "Falha ao gerar a narrativa por IA. Tente novamente em instantes.",
      recomendacoes: [],
    };
  }
}

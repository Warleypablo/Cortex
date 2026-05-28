/**
 * Classifica a resposta de um lead a um broadcast de WhatsApp como
 * positiva | negativa | neutra | opt_out.
 *
 * Estratégia em 2 camadas (barato → caro):
 *  1. Regra determinística sobre o texto do botão / palavras-chave. Cobre a maioria
 *     dos cliques de quick-reply ("QUERO ENTENDER MAIS", "Stop Promotions"), sem custo.
 *  2. Fallback no Claude haiku (mesmo SDK/modelo de ghlCopyAi.ts) só pra texto livre
 *     ambíguo, devolvendo rótulo + 1 frase de motivo.
 *
 * Mantém o resultado pra ser persistido por broadcastAttribution (não reprocessa).
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
const MODEL = "claude-haiku-4-5-20251001";

export type Sentiment = "positiva" | "negativa" | "neutra" | "opt_out";

export interface Classificacao {
  sentiment: Sentiment;
  motivo: string;
  /** "regra" quando resolvido por palavra-chave; "ia" quando precisou do Claude. */
  fonte: "regra" | "ia";
}

// Opt-out exigido pela Meta em templates de marketing + variações manuais.
const OPT_OUT = [
  "stop promotions",
  "parar promo",
  "sair da lista",
  "descadastrar",
  "descadastre",
  "não quero receber",
  "nao quero receber",
  "remover",
  "unsubscribe",
];

// Botões/expressões de interesse claro.
const POSITIVAS = [
  "quero",
  "diagnóstico",
  "diagnostico",
  "entender mais",
  "saber mais",
  "tenho interesse",
  "interessado",
  "interessada",
  "vamos conversar",
  "podemos falar",
  "me chama",
  "bora",
  "sim",
];

// Recusas/negativas claras.
const NEGATIVAS = [
  "não tenho interesse",
  "nao tenho interesse",
  "não obrigado",
  "nao obrigado",
  "sem interesse",
  "não quero",
  "nao quero",
  "para de mandar",
  "não, obrigado",
];

function matchAny(texto: string, termos: string[]): boolean {
  return termos.some((t) => texto.includes(t));
}

/** Camada 1: regra. Retorna null quando o texto é ambíguo e precisa da IA. */
export function classificarPorRegra(body: string): Classificacao | null {
  const t = (body || "").trim().toLowerCase();
  if (!t) return { sentiment: "neutra", motivo: "Resposta vazia.", fonte: "regra" };

  if (matchAny(t, OPT_OUT)) {
    return { sentiment: "opt_out", motivo: "Pediu opt-out / sair da lista.", fonte: "regra" };
  }
  if (matchAny(t, NEGATIVAS)) {
    return { sentiment: "negativa", motivo: "Recusa explícita.", fonte: "regra" };
  }
  // Curto e bate uma positiva → quick-reply de interesse (ex.: clique no botão).
  if (matchAny(t, POSITIVAS)) {
    return { sentiment: "positiva", motivo: "Demonstrou interesse / clique em botão de CTA.", fonte: "regra" };
  }
  return null;
}

function buildPrompt(body: string): string {
  return `Você classifica a resposta de um lead a uma mensagem de marketing no WhatsApp (mercado B2B brasileiro).

Responda APENAS um JSON válido, sem texto antes ou depois:
{ "sentiment": "positiva" | "negativa" | "neutra" | "opt_out", "motivo": "<frase curta explicando>" }

Critérios:
- "positiva": demonstra interesse, faz pergunta sobre a oferta, quer conversar/agendar.
- "negativa": recusa, desinteresse, reclamação.
- "opt_out": pede pra parar de receber / sair da lista.
- "neutra": resposta automática, ausência, dúvida não relacionada, ou ambíguo.

Mensagem do lead:
${body}`;
}

/** Classificação completa: regra primeiro; só chama o Claude no ambíguo. */
export async function classificarResposta(body: string): Promise<Classificacao> {
  const porRegra = classificarPorRegra(body);
  if (porRegra) return porRegra;

  // Sem API key: degrada pra neutra em vez de quebrar a atribuição.
  if (!process.env.ANTHROPIC_API_KEY) {
    return { sentiment: "neutra", motivo: "Texto livre (classificação IA indisponível).", fonte: "regra" };
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: buildPrompt(body) }],
    });
    const block = response.content[0];
    const raw = block.type === "text" ? block.text : "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { sentiment?: string; motivo?: string };
    const valid: Sentiment[] = ["positiva", "negativa", "neutra", "opt_out"];
    const sentiment = valid.includes(parsed.sentiment as Sentiment)
      ? (parsed.sentiment as Sentiment)
      : "neutra";
    return { sentiment, motivo: parsed.motivo || "Classificado por IA.", fonte: "ia" };
  } catch (err: any) {
    console.error("[replyClassifier] IA falhou, caindo pra neutra:", err.message);
    return { sentiment: "neutra", motivo: "Falha na classificação IA.", fonte: "regra" };
  }
}

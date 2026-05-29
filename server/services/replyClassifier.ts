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
  "me exclua",
  "me exclui",
  "exclua meu",
  "me remova",
  "me remove",
  "me tire",
  "tira meu",
  "tire meu",
  "para de mandar",
  "parem de mandar",
  "não me mande",
  "nao me mande",
  "pare de enviar",
];

// Auto-respostas / chatbots do negócio do lead (NÃO são resposta genuína) → neutra.
// Detectadas por frases típicas de saudação/atendimento automático.
const AUTO_REPLY = [
  "como posso ajudar",
  "como posso te ajudar",
  "como podemos ajudar",
  "agradeço seu contato",
  "agradeço o contato",
  "obrigado pelo contato",
  "obrigada pelo contato",
  "recebemos sua mensagem",
  "recebi sua msg",
  "recebi sua mensagem",
  "respondo em breve",
  "retornaremos",
  "retorno em breve",
  "já te respondo",
  "ja te respondo",
  "um momento",
  "seja bem vindo",
  "seja bem-vindo",
  "bem vindo",
  "horário de atendimento",
  "horario de atendimento",
  "fora do horário",
  "fora do horario",
  "mensagem automática",
  "mensagem automatica",
  "responder em breve",
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

// Recusas/negativas claras (inclui reclamações/insultos).
const NEGATIVAS = [
  "não tenho interesse",
  "nao tenho interesse",
  "não obrigado",
  "nao obrigado",
  "sem interesse",
  "não quero",
  "nao quero",
  "não, obrigado",
  "péssima",
  "pessima",
  "horrível",
  "horrivel",
  "não gostei",
  "nao gostei",
  "que saco",
  "golpe",
  "spam",
  "chato",
  "para com isso",
  "parem com isso",
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
    return { sentiment: "negativa", motivo: "Recusa / reclamação explícita.", fonte: "regra" };
  }
  // Auto-resposta do negócio do lead (saudação/chatbot) → neutra, ANTES de positiva.
  if (matchAny(t, AUTO_REPLY)) {
    return { sentiment: "neutra", motivo: "Resposta automática (saudação/chatbot do lead).", fonte: "regra" };
  }
  // Curto e bate uma positiva → quick-reply de interesse (ex.: clique no botão).
  if (matchAny(t, POSITIVAS)) {
    return { sentiment: "positiva", motivo: "Demonstrou interesse / clique em botão de CTA.", fonte: "regra" };
  }
  return null;
}

function buildPrompt(body: string): string {
  return `Você classifica a resposta de um EMPRESÁRIO a um broadcast de marketing da Turbo no WhatsApp (B2B brasileiro). A Turbo MANDOU a mensagem; isto é a resposta que voltou.

Responda APENAS um JSON válido, sem texto antes ou depois:
{ "sentiment": "positiva" | "negativa" | "neutra" | "opt_out", "motivo": "<frase curta>" }

Critérios (leia com atenção):
- "positiva": demonstra interesse REAL na oferta, faz pergunta sobre o serviço, quer conversar/agendar, pede mais info. Ex.: "quero saber mais", "podemos marcar?", "como funciona o serviço de vocês?".
- "negativa": recusa, desinteresse, irritação ou RECLAMAÇÃO. Ex.: "não tenho interesse", "péssima empresa", "que saco", "isso é spam".
- "opt_out": pede pra parar de receber / ser excluído. Ex.: "me exclua", "para de mandar", "sair da lista".
- "neutra": NÃO é uma resposta genuína de interesse. Inclui:
  • AUTO-RESPOSTA / CHATBOT do negócio do lead — saudação ou aviso automático. Ex.: "Olá, como posso ajudar?", "Agradeço seu contato, respondo em breve", "Recebi sua msg, já te respondo", "Seja bem-vindo ao atendimento". ISSO É SEMPRE NEUTRA, nunca positiva.
  • resposta vaga/ambígua, número solto, dúvida não relacionada, ausência.

ATENÇÃO: saudações automáticas tipo "como posso ajudar?" são o ATENDENTE/BOT do lead respondendo — NÃO é interesse. Classifique como neutra.

Mensagem que voltou:
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

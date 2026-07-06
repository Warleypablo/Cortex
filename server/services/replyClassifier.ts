/**
 * Classifica a resposta de um lead a um broadcast de WhatsApp como
 * positiva | negativa | neutra | opt_out.
 *
 * Estratégia em 2 camadas (barato → caro):
 *  1. Regra determinística sobre o texto do botão / palavras-chave. Cobre a maioria
 *     dos cliques de quick-reply ("QUERO ENTENDER MAIS", "Stop Promotions"), sem custo.
 *  2. Fallback de IA (Claude→OpenAI, via aiText) só pra texto livre ambíguo,
 *     devolvendo rótulo + 1 frase de motivo. Recebe também o CONTEXTO do disparo
 *     (o CTA) — uma resposta que ecoa a palavra-chave pedida é interesse, não neutra.
 *
 * Mantém o resultado pra ser persistido por broadcastAttribution (não reprocessa).
 */

import { gerarTextoIA } from "./aiText";

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
  "como posso lhe ajudar",
  "agradeço seu contato",
  "agradeço o contato",
  "agradeço o seu contato",
  "agradecemos",
  "agradecemos o contato",
  "agradecemos por entrar em contato",
  "obrigado pelo contato",
  "obrigada pelo contato",
  "obrigado por entrar em contato",
  "obrigada por entrar em contato",
  "obrigado por nos contatar",
  "recebemos sua mensagem",
  "recebi sua msg",
  "recebi sua mensagem",
  "recebi seu contato",
  "respondo em breve",
  "responder em breve",
  "responderemos",
  "responderei",
  "retornaremos",
  "retorno em breve",
  "retornarei",
  "já te respondo",
  "ja te respondo",
  "assim que possível",
  "assim que possivel",
  "o quanto antes",
  "um momento",
  "seja bem vindo",
  "seja bem-vindo",
  "bem vindo",
  "bem-vindo",
  "bem vinda",
  "bem-vinda",
  "boas vindas",
  "vou te ajudar",
  "vou lhe ajudar",
  "estamos aqui para",
  "sua mensagem é muito important",
  "sua mensagem é important",
  "horário de atendimento",
  "horario de atendimento",
  "horário comercial",
  "horario comercial",
  "fora do horário",
  "fora do horario",
  "mensagem automática",
  "mensagem automatica",
  "resposta automática",
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

// Verbos de CTA que costumam pedir uma palavra-chave de resposta.
const CTA_VERBS = [
  "responda", "responde", "respondam", "comente", "comenta", "comentem",
  "escreva", "escreve", "digite", "digita", "envie", "envia", "manda", "mande",
  "me manda", "me envie", "me responde", "responde aqui",
];

/**
 * Reply curta que ecoa a palavra-chave pedida no CTA do disparo → interesse.
 * Ex.: disparo diz "responda UGC pra receber" e o lead responde "UGC".
 * Só dispara pra token curto (1-2 palavras) precedido de um verbo de CTA no corpo.
 */
function respondeuPalavraChaveDoCTA(replyLower: string, broadcastBody?: string | null): boolean {
  if (!broadcastBody) return false;
  const token = replyLower.trim();
  if (token.length < 2 || token.length > 25 || token.split(/\s+/).length > 2) return false;
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const corpo = broadcastBody.toLowerCase();
  // verbo de CTA seguido (em até ~20 chars) do token exato como palavra
  return CTA_VERBS.some((v) => new RegExp(`${v}\\b[^.!?\\n]{0,20}\\b${esc}\\b`, "i").test(corpo));
}

/** Camada 1: regra. Retorna null quando o texto é ambíguo e precisa da IA. */
export function classificarPorRegra(body: string, broadcastBody?: string | null): Classificacao | null {
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
  // Respondeu exatamente a palavra-chave que o CTA do disparo pediu → interesse.
  if (respondeuPalavraChaveDoCTA(t, broadcastBody)) {
    return { sentiment: "positiva", motivo: "Respondeu a palavra-chave pedida no CTA do disparo.", fonte: "regra" };
  }
  return null;
}

function buildPrompt(body: string, broadcastBody?: string | null): string {
  const contexto = broadcastBody?.trim()
    ? broadcastBody.trim().slice(0, 1000)
    : "(mensagem original indisponível)";
  return `Você classifica a resposta de um EMPRESÁRIO a um broadcast de marketing da Turbo no WhatsApp (B2B brasileiro). A Turbo MANDOU a mensagem; isto é a resposta que voltou.

Responda APENAS um JSON válido, sem texto antes ou depois:
{ "sentiment": "positiva" | "negativa" | "neutra" | "opt_out", "motivo": "<frase curta>" }

Critérios (leia com atenção):
- "positiva": demonstra interesse REAL na oferta, faz pergunta sobre o serviço, quer conversar/agendar, pede mais info. Ex.: "quero saber mais", "podemos marcar?", "como funciona o serviço de vocês?". TAMBÉM é positiva quando o CTA da mensagem original pede pra responder uma palavra/expressão específica e a resposta é exatamente essa palavra (ex.: CTA "responda UGC" e a resposta é "UGC").
- "negativa": recusa, desinteresse, irritação ou RECLAMAÇÃO. Ex.: "não tenho interesse", "péssima empresa", "que saco", "isso é spam".
- "opt_out": pede pra parar de receber / ser excluído. Ex.: "me exclua", "para de mandar", "sair da lista".
- "neutra": NÃO é uma resposta genuína de interesse. Inclui:
  • AUTO-RESPOSTA / CHATBOT do negócio do lead — saudação ou aviso automático. Ex.: "Olá, como posso ajudar?", "Agradeço seu contato, respondo em breve", "Recebi sua msg, já te respondo", "Seja bem-vindo ao atendimento". ISSO É SEMPRE NEUTRA, nunca positiva.
  • resposta vaga/ambígua, número solto, dúvida não relacionada, ausência.

ATENÇÃO: saudações automáticas tipo "como posso ajudar?" são o ATENDENTE/BOT do lead respondendo — NÃO é interesse. Classifique como neutra. Mas leve em conta o CTA: uma resposta curta que ecoa a palavra-chave pedida NÃO é neutra, é positiva.

MENSAGEM ORIGINAL ENVIADA PELA TURBO (contexto do CTA):
${contexto}

RESPOSTA QUE VOLTOU (classifique esta):
${body}`;
}

/** Classificação completa: regra primeiro; só chama a IA no ambíguo. */
export async function classificarResposta(body: string, broadcastBody?: string | null): Promise<Classificacao> {
  const porRegra = classificarPorRegra(body, broadcastBody);
  if (porRegra) return porRegra;

  try {
    const raw = await gerarTextoIA(buildPrompt(body, broadcastBody), { maxTokens: 200, json: true });
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

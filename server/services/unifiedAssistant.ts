import OpenAI from "openai";
import type { UnifiedAssistantRequest, UnifiedAssistantResponse, AssistantContext, DfcHierarchicalResponse } from "@shared/schema";
import { chatWithDfc } from "./dfcAnalysis";
import { storage } from "../storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const N8N_CASES_WEBHOOK_URL = process.env.N8N_CASES_WEBHOOK_URL || "https://n8n.turbopartners.com.br/webhook/assistente-cases";

const CONTEXT_DETECTION_PROMPT = `Você é um classificador de contexto para o GPTurbo, assistente virtual da Turbo Partners.

Analise a mensagem do usuário e determine qual contexto é mais apropriado para respondê-la.

Contextos disponíveis:
- "financeiro": Perguntas sobre DFC, fluxo de caixa, receitas, despesas, lucros, margens, resultados financeiros, faturamento, inadimplência
- "cases": Perguntas sobre cases de sucesso, projetos realizados, estratégias de marketing implementadas, resultados de campanhas
- "clientes": Perguntas sobre clientes específicos, contratos, retenção, churm, LTV, quantidade de clientes
- "geral": Perguntas gerais sobre a Turbo Partners, serviços oferecidos, equipe, processos internos, ou qualquer outra coisa

Também considere o contexto da página atual do usuário (se fornecido).

Responda APENAS com o nome do contexto em minúsculas: "financeiro", "cases", "clientes" ou "geral".
Não adicione explicações, apenas a palavra do contexto.`;

const TURBO_PARTNERS_SYSTEM_PROMPT = `Você é o assistente virtual da Turbo Partners, uma agência de marketing digital especializada em performance e growth hacking.

Sobre a Turbo Partners:
- Somos uma agência focada em resultados mensuráveis
- Oferecemos serviços de Tráfego Pago, Growth Marketing, Branding, Social Media, SEO e desenvolvimento de estratégias digitais
- Nossa missão é acelerar o crescimento dos nossos clientes através de marketing digital data-driven
- Trabalhamos com empresas de diversos segmentos, desde startups até grandes corporações

Você está integrado ao Turbo Cortex, nossa plataforma interna de gestão e análise de dados.

Diretrizes:
- Sempre responda em português brasileiro
- Seja objetivo e útil nas respostas
- Quando não souber algo específico, sugira onde o usuário pode encontrar a informação
- Mantenha um tom profissional mas acessível
- Formate valores monetários como R$ X.XXX,XX
- Use markdown para estruturar respostas longas`;

const CLIENTES_SYSTEM_PROMPT = `${TURBO_PARTNERS_SYSTEM_PROMPT}

Contexto adicional: Você está ajudando com informações sobre clientes da agência.
- Pode auxiliar com dúvidas sobre contratos, status de clientes, histórico de faturamento
- Sugira consultas na plataforma quando apropriado
- Se precisar de dados específicos que não possui, oriente o usuário a verificar na página de clientes`;

async function chatGeral(request: UnifiedAssistantRequest): Promise<UnifiedAssistantResponse> {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: TURBO_PARTNERS_SYSTEM_PROMPT }
  ];

  if (request.historico) {
    for (const msg of request.historico) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: request.message });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 1024,
    });

    const resposta = response.choices[0].message.content || "Não consegui processar sua mensagem.";

    return {
      resposta,
      context: request.context,
    };
  } catch (error) {
    console.error("[UnifiedAssistant] Error in chatGeral:", error);
    return {
      resposta: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
      context: request.context,
    };
  }
}

async function chatClientes(request: UnifiedAssistantRequest): Promise<UnifiedAssistantResponse> {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: CLIENTES_SYSTEM_PROMPT }
  ];

  if (request.historico) {
    for (const msg of request.historico) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: request.message });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 1024,
    });

    const resposta = response.choices[0].message.content || "Não consegui processar sua mensagem.";

    return {
      resposta,
      context: request.context,
    };
  } catch (error) {
    console.error("[UnifiedAssistant] Error in chatClientes:", error);
    return {
      resposta: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
      context: request.context,
    };
  }
}

async function chatFinanceiro(request: UnifiedAssistantRequest): Promise<UnifiedAssistantResponse> {
  try {
    const dfcData = await storage.getDfc(
      request.metadata?.dataInicio,
      request.metadata?.dataFim
    );

    const historico = request.historico?.map(h => ({
      role: h.role as "user" | "assistant",
      content: h.content
    })) || [];

    const result = await chatWithDfc(dfcData, request.message, historico);

    return {
      resposta: result.resposta,
      context: request.context,
      dadosReferenciados: result.dadosReferenciados,
    };
  } catch (error) {
    console.error("[UnifiedAssistant] Error in chatFinanceiro:", error);
    return {
      resposta: "Desculpe, ocorreu um erro ao consultar os dados financeiros. Tente novamente.",
      context: request.context,
    };
  }
}

async function chatCases(request: UnifiedAssistantRequest): Promise<UnifiedAssistantResponse> {
  try {
    const response = await fetch(N8N_CASES_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: request.message }),
    });

    if (!response.ok) {
      throw new Error(`N8N webhook returned ${response.status}`);
    }

    const data = await response.json();
    
    let resposta = "Sem resposta do servidor.";
    if (Array.isArray(data) && data.length > 0) {
      resposta = data[0].output || data[0].response || data[0].message || data[0].text || resposta;
    } else if (data.output) {
      resposta = data.output;
    } else if (data.response) {
      resposta = data.response;
    } else if (data.message) {
      resposta = data.message;
    }

    return {
      resposta,
      context: request.context,
    };
  } catch (error) {
    console.error("[UnifiedAssistant] Error in chatCases:", error);
    return {
      resposta: "Desculpe, ocorreu um erro ao consultar os cases. Tente novamente.",
      context: request.context,
    };
  }
}

async function detectContext(message: string, pageContext?: string): Promise<AssistantContext> {
  try {
    const userMessage = pageContext 
      ? `Página atual: ${pageContext}\n\nMensagem do usuário: ${message}`
      : message;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: CONTEXT_DETECTION_PROMPT },
        { role: "user", content: userMessage }
      ],
      max_tokens: 20,
      temperature: 0,
    });

    const detected = response.choices[0].message.content?.toLowerCase().trim() || "geral";
    
    if (["financeiro", "cases", "clientes", "geral"].includes(detected)) {
      console.log(`[UnifiedAssistant] Auto-detected context: ${detected}`);
      return detected as AssistantContext;
    }
    
    return "geral";
  } catch (error) {
    console.error("[UnifiedAssistant] Error detecting context:", error);
    return "geral";
  }
}

export async function chat(request: UnifiedAssistantRequest): Promise<UnifiedAssistantResponse> {
  let effectiveContext = request.context;
  
  if (!request.context || request.context === "auto") {
    effectiveContext = await detectContext(request.message, request.metadata?.pageContext);
  }
  
  console.log(`[UnifiedAssistant] Processing request with context: ${effectiveContext}`);

  let response: UnifiedAssistantResponse;
  
  switch (effectiveContext) {
    case "financeiro":
      response = await chatFinanceiro({ ...request, context: effectiveContext });
      break;
    case "cases":
      response = await chatCases({ ...request, context: effectiveContext });
      break;
    case "clientes":
      response = await chatClientes({ ...request, context: effectiveContext });
      break;
    case "geral":
    default:
      response = await chatGeral({ ...request, context: effectiveContext });
      break;
  }
  
  return {
    ...response,
    context: effectiveContext,
  };
}

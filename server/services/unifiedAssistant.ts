import OpenAI from "openai";
import type { UnifiedAssistantRequest, UnifiedAssistantResponse, DfcHierarchicalResponse } from "@shared/schema";
import { chatWithDfc } from "./dfcAnalysis";
import { storage } from "../storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const N8N_CASES_WEBHOOK_URL = process.env.N8N_CASES_WEBHOOK_URL || "https://n8n.turbopartners.com.br/webhook/assistente-cases";

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

export async function chat(request: UnifiedAssistantRequest): Promise<UnifiedAssistantResponse> {
  console.log(`[UnifiedAssistant] Processing request with context: ${request.context}`);

  switch (request.context) {
    case "financeiro":
      return chatFinanceiro(request);
    case "cases":
      return chatCases(request);
    case "clientes":
      return chatClientes(request);
    case "geral":
    default:
      return chatGeral(request);
  }
}

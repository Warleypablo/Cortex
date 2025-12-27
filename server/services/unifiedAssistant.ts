import OpenAI from "openai";
import type { UnifiedAssistantRequest, UnifiedAssistantResponse, AssistantContext, DfcHierarchicalResponse } from "@shared/schema";
import { chatWithDfc } from "./dfcAnalysis";
import { storage } from "../storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const gemini = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL && process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  ? new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    })
  : null;

const N8N_CASES_WEBHOOK_URL = process.env.N8N_CASES_WEBHOOK_URL || "https://n8n.turbopartners.com.br/webhook/assistente-cases";

export const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o'],
    available: !!process.env.OPENAI_API_KEY,
  },
  gemini: {
    name: 'Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    available: !!(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL && process.env.AI_INTEGRATIONS_GEMINI_API_KEY),
  },
} as const;

export type AIProvider = keyof typeof AI_PROVIDERS;
export type AIModel = 'gpt-4o' | 'gemini-2.5-flash' | 'gemini-2.5-pro';

async function getAIConfig(): Promise<{ provider: AIProvider; model: AIModel }> {
  const providerSetting = await storage.getSystemSetting('ai_provider');
  const modelSetting = await storage.getSystemSetting('ai_model');
  
  const provider = (providerSetting === 'gemini' && AI_PROVIDERS.gemini.available) ? 'gemini' : 'openai';
  let model: AIModel = 'gpt-4o';
  
  if (modelSetting) {
    if (provider === 'openai' && modelSetting === 'gpt-4o') {
      model = 'gpt-4o';
    } else if (provider === 'gemini' && (modelSetting === 'gemini-2.5-flash' || modelSetting === 'gemini-2.5-pro')) {
      model = modelSetting;
    }
  } else if (provider === 'gemini') {
    model = 'gemini-2.5-flash';
  }
  
  return { provider, model };
}

function getAIClient(provider: AIProvider): OpenAI {
  if (provider === 'gemini' && gemini) {
    return gemini;
  }
  return openai;
}

export interface AIConnectionTestResult {
  success: boolean;
  provider: string;
  model: string;
  error?: string;
  errorType?: 'timeout' | 'authentication' | 'rate_limit' | 'network' | 'invalid_model' | 'unknown';
}

export async function testAIConnection(): Promise<AIConnectionTestResult> {
  const AI_TEST_TIMEOUT_MS = 10000; // 10 second timeout
  
  let config: { provider: AIProvider; model: AIModel };
  try {
    config = await getAIConfig();
  } catch (configError: any) {
    return {
      success: false,
      provider: 'unknown',
      model: 'unknown',
      error: 'Failed to load AI configuration. Please check system settings.',
      errorType: 'unknown',
    };
  }
  
  try {
    const client = getAIClient(config.provider);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TEST_TIMEOUT_MS);
    
    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: "user", content: "Say 'Hello! AI is working.' and nothing else." }],
        max_tokens: 50,
      }, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const text = response.choices[0]?.message?.content || '';
      return {
        success: text.toLowerCase().includes('hello') || text.toLowerCase().includes('ai'),
        provider: AI_PROVIDERS[config.provider].name,
        model: config.model,
      };
    } catch (apiError: any) {
      clearTimeout(timeoutId);
      throw apiError;
    }
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    const statusCode = error.status || error.statusCode;
    
    // Categorize error types for actionable messages
    let errorType: AIConnectionTestResult['errorType'] = 'unknown';
    let actionableMessage = errorMessage;
    
    if (error.name === 'AbortError' || errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
      errorType = 'timeout';
      actionableMessage = `Connection timed out after ${AI_TEST_TIMEOUT_MS / 1000} seconds. The AI provider may be experiencing delays or the network is slow.`;
    } else if (statusCode === 401 || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('invalid api key') || errorMessage.toLowerCase().includes('authentication')) {
      errorType = 'authentication';
      actionableMessage = 'Authentication failed. Please verify your API key is correct and has the necessary permissions.';
    } else if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('quota')) {
      errorType = 'rate_limit';
      actionableMessage = 'Rate limit exceeded. Please wait a few minutes before trying again, or check your API usage quota.';
    } else if (statusCode === 404 || errorMessage.toLowerCase().includes('model') || errorMessage.toLowerCase().includes('not found')) {
      errorType = 'invalid_model';
      actionableMessage = `The model '${config.model}' was not found or is not available. Please select a different model.`;
    } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('econnrefused') || errorMessage.toLowerCase().includes('fetch')) {
      errorType = 'network';
      actionableMessage = 'Network error connecting to AI provider. Please check your internet connection and try again.';
    }
    
    return {
      success: false,
      provider: AI_PROVIDERS[config.provider].name,
      model: config.model,
      error: actionableMessage,
      errorType,
    };
  }
}

export function getAvailableProviders() {
  return Object.entries(AI_PROVIDERS).map(([key, value]) => ({
    id: key,
    name: value.name,
    models: value.models,
    available: value.available,
  }));
}

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

const TURBO_PARTNERS_SYSTEM_PROMPT = `Você é o GPTurbo, assistente virtual interno da Turbo Partners integrado ao Turbo Cortex.

🚨 REGRA DE OURO - OBRIGATÓRIA:
- Você opera EXCLUSIVAMENTE com base nos dados fornecidos pela nossa integração
- NÃO utilize conhecimentos externos ou da internet
- NÃO invente dados, valores, nomes ou informações que não estejam nos dados fornecidos
- Se a resposta não estiver contida nos dados fornecidos, responda educadamente: "Não tenho essa informação nos dados disponíveis. Você pode verificar diretamente na página correspondente do Turbo Cortex."

Sobre a Turbo Partners:
- Agência de marketing digital especializada em performance e growth hacking
- Serviços: Tráfego Pago, Growth Marketing, Branding, Social Media, SEO, Inbound Marketing
- Foco em resultados mensuráveis e data-driven

Diretrizes de Resposta:
- Sempre responda em português brasileiro
- Seja objetivo e direto
- Use APENAS os dados fornecidos no contexto
- Formate valores monetários como R$ X.XXX,XX
- Use markdown para estruturar respostas
- Se não tiver dados suficientes, oriente o usuário a verificar na página específica do Cortex`;

const CLIENTES_SYSTEM_PROMPT = `${TURBO_PARTNERS_SYSTEM_PROMPT}

Contexto adicional: Você está ajudando com informações sobre CLIENTES da agência.
- Use APENAS os dados de clientes fornecidos abaixo
- NÃO invente nomes de clientes, valores ou informações
- Se um cliente específico não estiver na lista, informe que não possui essa informação`;

async function chatGeral(request: UnifiedAssistantRequest): Promise<UnifiedAssistantResponse> {
  try {
    // Buscar dados básicos para o contexto geral
    const topClientes = await storage.getTopClientesByLTV(10);
    const clientesCount = topClientes.length;
    
    // Formatar resumo de dados disponíveis
    const dadosDisponiveisContext = `

📊 DADOS DISPONÍVEIS NO TURBO CORTEX (Use APENAS estes dados):

RESUMO DE CLIENTES:
- Total de clientes no top ranking: ${clientesCount}
- Top 5 clientes por LTV:
${topClientes.slice(0, 5).map((c, i) => `  ${i + 1}. ${c.nome} - LTV: R$ ${c.ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n')}

MÓDULOS DISPONÍVEIS NO CORTEX:
- Clientes e Contratos: Gestão de clientes ativos e contratos
- Financeiro: DFC, Inadimplência, Faturamento
- Comercial: Pipeline SDR/Closer, Bitrix CRM
- Growth: Meta Ads, Google Ads, Criativos
- G&G (Pessoas): Colaboradores, Patrimônio, Telefones
- OKR 2026: Objetivos e resultados chave

⚠️ LEMBRETE: Se o usuário perguntar algo fora desses dados, responda que não possui essa informação e oriente a verificar na página correspondente.`;

    const systemPromptComDados = TURBO_PARTNERS_SYSTEM_PROMPT + dadosDisponiveisContext;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPromptComDados }
    ];

    if (request.historico) {
      for (const msg of request.historico) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: request.message });

    const config = await getAIConfig();
    const client = getAIClient(config.provider);
    
    const response = await client.chat.completions.create({
      model: config.model,
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
  try {
    // Buscar dados reais de clientes para incluir no contexto
    const topClientes = await storage.getTopClientesByLTV(20);
    
    // Formatar dados de clientes para o contexto
    const clientesFormatados = topClientes.map((c, i) => 
      `${i + 1}. ${c.nome} - LTV: R$ ${c.ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | LT: ${c.ltMeses} meses | Serviços: ${c.servicos || 'N/A'}`
    ).join('\n');

    const dadosClientesContext = `

DADOS REAIS DE CLIENTES (Top 20 por LTV):
${clientesFormatados}

IMPORTANTE: Use APENAS os dados acima para responder perguntas sobre clientes. NÃO invente dados.
Se o usuário perguntar sobre um cliente específico que não está na lista, informe que você tem acesso limitado aos top 20 clientes por LTV.
Para informações mais detalhadas, oriente o usuário a verificar na página de clientes.`;

    const systemPromptComDados = CLIENTES_SYSTEM_PROMPT + dadosClientesContext;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPromptComDados }
    ];

    if (request.historico) {
      for (const msg of request.historico) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: request.message });

    const config = await getAIConfig();
    const client = getAIClient(config.provider);
    
    const response = await client.chat.completions.create({
      model: config.model,
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

    const config = await getAIConfig();
    const client = getAIClient(config.provider);
    
    const response = await client.chat.completions.create({
      model: config.model,
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

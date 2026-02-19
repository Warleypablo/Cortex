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

export async function getAIConfig(): Promise<{ provider: AIProvider; model: AIModel }> {
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

export function getAIClient(provider: AIProvider): OpenAI {
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
- "churn": Perguntas sobre risco de churn, predição de cancelamento, clientes em risco, prevenção de churn, score de risco, retenção proativa
- "geral": Perguntas gerais sobre a Turbo Partners, serviços oferecidos, equipe, processos internos, ou qualquer outra coisa

Também considere o contexto da página atual do usuário (se fornecido).

Responda APENAS com o nome do contexto em minúsculas: "financeiro", "cases", "clientes", "churn" ou "geral".
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
    // Contexto geral funciona como GUIA DO SISTEMA - não busca dados de clientes
    const guiaDoSistemaContext = `

🎯 VOCÊ É O GUIA DO TURBO CORTEX

Sua função neste contexto é ajudar os usuários a entender e navegar pelo sistema Turbo Cortex.
Responda perguntas sobre funcionalidades, onde encontrar informações e como usar cada módulo.

📚 GUIA COMPLETO DOS MÓDULOS DO TURBO CORTEX:

🏠 HOMEPAGE / DASHBOARD
- Caminho: Página inicial após login
- Visão geral personalizada baseada no perfil do usuário (Base, Time, Líder, Control Tower)
- Widgets de métricas resumidas e acesso rápido aos módulos mais utilizados
- Dica: A homepage mostra informações relevantes para seu cargo automaticamente

👥 CLIENTES E CONTRATOS
- Caminho: Menu lateral > Clientes
- Funcionalidades: Visualizar todos os clientes, contratos ativos, histórico de relacionamento
- Métricas: LTV (Lifetime Value), LT (Lifetime em meses), churn, retenção
- Filtros: Status do contrato, squad, cluster, saúde da conta
- Dica: Use a barra de busca para encontrar clientes específicos por nome ou CNPJ

💰 FINANCEIRO
- DFC (Demonstração de Fluxo de Caixa): Menu > Financeiro > DFC
  - Visualize receitas, despesas e resultado por período
  - Filtre por mês/ano usando os controles no topo da página
  - Análise hierárquica de categorias de receita/despesa
- Inadimplência: Menu > Financeiro > Inadimplência / Jurídico
  - Acompanhe clientes com pagamentos pendentes
  - Status de cobrança e negociação
- Faturamento: Dados consolidados de receita mensal por cliente

📈 COMERCIAL
- SDR Performance: Menu > Comercial > SDR
  - Métricas de prospecção e qualificação de leads
  - Quantidade de ligações, reuniões agendadas
- Closer Performance: Menu > Comercial > Closer
  - Taxas de conversão e fechamento de vendas
  - Valor de contratos fechados
- Integração Bitrix CRM: Pipeline de vendas em tempo real

🚀 GROWTH (Marketing)
- Visão Geral: Menu > Growth > Visão Geral
  - Dashboard consolidado de performance de marketing
- Meta Ads: Menu > Growth > Meta Ads
  - Análise de campanhas Facebook/Instagram
  - Métricas: ROAS, CPA, CTR, impressões, alcance
- Google Ads: Análise de campanhas de busca paga
- Criativos: Menu > Growth > Criativos
  - Biblioteca de anúncios e performance por criativo
  - Formatação condicional configurável
- Performance por Plataforma: Menu > Growth > Performance
  - Comparativo entre canais (Meta, Google, TikTok, etc.)
  - Métricas lado a lado

📊 INHIRE / RECRUTAMENTO
- Analytics de Recrutamento: Menu > Inhire
- Métricas de processo seletivo
- Status de vagas e candidatos

📅 CALENDÁRIO
- Caminho: Menu lateral > Calendário
- Visualização de eventos da equipe
- Reuniões, deadlines e datas importantes
- Sincronização com calendários externos

📚 BASE DE CONHECIMENTO
- Caminho: Menu lateral > Conhecimento
- Documentação interna e processos
- Artigos organizados por prioridade
- Busca por palavras-chave

👨‍💼 G&G (GENTE & GESTÃO)
- Colaboradores: Menu > G&G > Colaboradores
  - Lista completa da equipe com cargos e squads
- Patrimônio: Menu > G&G > Patrimônio
  - Gestão de ativos físicos (notebooks, monitores, etc.)
- Linhas Telefônicas: Menu > G&G > Telefones
  - Controle de chips e linhas corporativas
- Meu Perfil: Clique no avatar > Meu Perfil
  - Seus dados pessoais e configurações

🎯 OKR 2026
- Caminho: Menu > OKR 2026
- Objetivos estratégicos da empresa
- Key Results e acompanhamento de metas
- Check-ins periódicos de progresso

📈 RELATÓRIO INVESTIDORES
- Caminho: Menu > Relatório Investidores
- Métricas consolidadas para apresentação
- Exportação de dados para relatórios

⚙️ ADMINISTRAÇÃO (apenas admins)
- Gestão de Usuários: Menu > Admin > Usuários
  - Criar, editar e gerenciar permissões de usuários
  - Quatro perfis padrão: Base, Time, Líder, Control Tower
- Conexões: Menu > Admin > Conexões
  - Status das integrações (Banco de Dados, OpenAI, Google OAuth)
- Catálogos: Menu > Admin > Catálogos
  - Padronização de dados (status, produtos, squads)
- Design System: Menu > Admin > Design System
  - Referência visual de componentes e cores

🔐 PERFIS DE ACESSO
- Base: Acesso básico, visualização limitada
- Time: Acesso a módulos do squad
- Líder: Acesso expandido com métricas de equipe
- Control Tower: Acesso completo a todos os módulos

💬 DICAS DE USO:
1. Use a barra lateral para navegar entre módulos
2. Os filtros de data geralmente ficam no topo das páginas
3. Clique no seu avatar (canto superior) para acessar "Meu Perfil" ou fazer logout
4. Use Ctrl+K ou Cmd+K para busca rápida (se disponível)
5. O GPTurbo pode ajudar com contextos específicos:
   - Diga "financeiro" para perguntas sobre DFC e fluxo de caixa
   - Diga "clientes" para informações sobre clientes específicos
   - Diga "cases" para cases de sucesso da agência

❓ PERGUNTAS FREQUENTES:
- "Onde vejo o faturamento?" → Menu > Financeiro > DFC
- "Como encontrar um cliente?" → Menu > Clientes, use a busca
- "Onde vejo meus dados?" → Clique no avatar > Meu Perfil
- "Como filtrar por período?" → Use os seletores de mês/ano no topo da página
- "Onde vejo os OKRs?" → Menu > OKR 2026
- "Como agendar reunião?" → Menu > Calendário
- "Onde vejo a documentação?" → Menu > Conhecimento

Se o usuário perguntar sobre DADOS ESPECÍFICOS de clientes, financeiro ou cases, oriente-o a fazer a pergunta novamente mencionando o contexto desejado, ou acesse as páginas correspondentes diretamente.`;

    const systemPromptComDados = TURBO_PARTNERS_SYSTEM_PROMPT + guiaDoSistemaContext;

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

const CHURN_SYSTEM_PROMPT = `${TURBO_PARTNERS_SYSTEM_PROMPT}

Contexto adicional: Você está analisando RISCO DE CHURN de contratos da Turbo Partners.
- Use APENAS os dados de risco fornecidos abaixo
- NÃO invente scores, nomes de clientes ou valores
- Forneça recomendações práticas de retenção baseadas nos fatores de risco identificados
- Priorize ações por impacto no MRR`;

async function chatChurn(request: UnifiedAssistantRequest): Promise<UnifiedAssistantResponse> {
  try {
    const { getRiskScores, getRiskSummary } = await import("./churnRiskEngine");

    const [topRiscos, summary] = await Promise.all([
      getRiskScores({ limit: 30 }),
      getRiskSummary(),
    ]);

    const riscosFormatados = topRiscos.map((r, i) => {
      const fatoresStr = r.fatores
        .filter((f: any) => f.valor > 0)
        .map((f: any) => `  - ${f.sinal}: ${f.descricao} (${f.valor}/${f.peso} pts)`)
        .join('\n');
      return `${i + 1}. ${r.clienteNome || 'N/A'} (${r.contratoId}) - Score: ${r.score}/100 [${r.tier.toUpperCase()}] | MRR: R$ ${r.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Squad: ${r.squad || 'N/A'} | Produto: ${r.produto || 'N/A'}\n${fatoresStr}`;
    }).join('\n\n');

    const resumoContext = `
RESUMO DE RISCO DE CHURN:
- Total de contratos analisados: ${summary.totalContratos}
- Críticos (76-100): ${summary.critico} contratos | MRR: R$ ${summary.mrrCritico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Alto risco (51-75): ${summary.alto} contratos | MRR: R$ ${summary.mrrAlto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Moderado (31-50): ${summary.moderado} contratos
- Baixo (0-30): ${summary.baixo} contratos
- MRR total em risco (crítico + alto): R$ ${summary.mrrEmRisco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

TOP 30 CONTRATOS EM RISCO (ordenados por score):
${riscosFormatados}

IMPORTANTE: Use APENAS estes dados para responder. Se o usuário perguntar sobre um contrato que não está na lista, informe que tem acesso aos top 30 por score de risco.
Para ações de retenção, considere os fatores de risco específicos de cada contrato.`;

    const systemPromptComDados = CHURN_SYSTEM_PROMPT + resumoContext;

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
      max_tokens: 1500,
    });

    const resposta = response.choices[0].message.content || "Não consegui processar sua mensagem.";

    return {
      resposta,
      context: request.context,
    };
  } catch (error) {
    console.error("[UnifiedAssistant] Error in chatChurn:", error);
    return {
      resposta: "Desculpe, ocorreu um erro ao analisar os riscos de churn. Verifique se os scores foram calculados recentemente.",
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
    
    if (["financeiro", "cases", "clientes", "churn", "geral"].includes(detected)) {
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
    case "churn":
      response = await chatChurn({ ...request, context: effectiveContext });
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

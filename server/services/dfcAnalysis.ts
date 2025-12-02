import OpenAI from "openai";
import type { DfcHierarchicalResponse, DfcNode } from "@shared/schema";
import { db } from "../db";
import { sql } from "drizzle-orm";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Função para executar queries SQL de forma segura (somente SELECT)
async function executeSecureQuery(query: string): Promise<{ success: boolean; data?: any[]; error?: string; rowCount?: number }> {
  // Validação de segurança: apenas queries SELECT são permitidas
  const normalizedQuery = query.trim().toUpperCase();
  
  if (!normalizedQuery.startsWith('SELECT')) {
    return { success: false, error: "Apenas queries SELECT são permitidas" };
  }
  
  // Bloquear comandos perigosos
  const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE'];
  for (const keyword of dangerousKeywords) {
    if (normalizedQuery.includes(keyword)) {
      return { success: false, error: `Comando ${keyword} não é permitido` };
    }
  }
  
  try {
    console.log("[DFC Chat] Executing query:", query);
    const result = await db.execute(sql.raw(query));
    return { 
      success: true, 
      data: result.rows as any[],
      rowCount: result.rowCount || 0
    };
  } catch (error: any) {
    console.error("[DFC Chat] Query error:", error);
    return { success: false, error: error.message || "Erro ao executar query" };
  }
}

export interface DfcInsight {
  tipo: "anomalia" | "tendencia" | "oportunidade" | "alerta";
  titulo: string;
  descricao: string;
  metricas: string[];
  severidade: "baixa" | "media" | "alta";
  categoria?: string;
  mes?: string;
}

export interface DfcAnalysisResult {
  resumoExecutivo: string;
  insights: DfcInsight[];
  recomendacoes: string[];
  metricas: {
    margemMedia: number;
    tendenciaReceitas: string;
    tendenciaDespesas: string;
    mesComMelhorResultado: string;
    mesComPiorResultado: string;
  };
}

interface MonthlyData {
  mes: string;
  receitas: number;
  despesas: number;
  resultado: number;
  margem: number;
}

interface CategoryMetrics {
  categoriaId: string;
  categoriaNome: string;
  total: number;
  mediaByMonth: number;
  variancia: number;
  tendencia: "crescente" | "decrescente" | "estavel";
  anomalias: { mes: string; valor: number; desvio: number }[];
}

function calculateMonthlyData(dfcData: DfcHierarchicalResponse): MonthlyData[] {
  const receitasNode = dfcData.nodes.find(n => n.categoriaId === 'RECEITAS');
  const despesasNode = dfcData.nodes.find(n => n.categoriaId === 'DESPESAS');
  
  return dfcData.meses.map(mes => {
    const receitas = receitasNode?.valuesByMonth[mes] || 0;
    const despesas = Math.abs(despesasNode?.valuesByMonth[mes] || 0);
    const resultado = receitas - despesas;
    const margem = receitas > 0 ? ((resultado / receitas) * 100) : 0;
    
    return { mes, receitas, despesas, resultado, margem };
  });
}

function calculateCategoryMetrics(nodes: DfcNode[], meses: string[]): CategoryMetrics[] {
  const leafNodes = nodes.filter(n => n.isLeaf && n.nivel >= 2);
  
  return leafNodes.map(node => {
    const values = meses.map(mes => Math.abs(node.valuesByMonth[mes] || 0));
    const nonZeroValues = values.filter(v => v > 0);
    
    if (nonZeroValues.length === 0) {
      return {
        categoriaId: node.categoriaId,
        categoriaNome: node.categoriaNome,
        total: 0,
        mediaByMonth: 0,
        variancia: 0,
        tendencia: "estavel" as const,
        anomalias: []
      };
    }
    
    const total = nonZeroValues.reduce((a, b) => a + b, 0);
    const media = total / nonZeroValues.length;
    const variancia = nonZeroValues.reduce((acc, v) => acc + Math.pow(v - media, 2), 0) / nonZeroValues.length;
    const desvio = Math.sqrt(variancia);
    
    // Detect trend
    let tendencia: "crescente" | "decrescente" | "estavel" = "estavel";
    if (nonZeroValues.length >= 3) {
      const firstHalf = nonZeroValues.slice(0, Math.floor(nonZeroValues.length / 2));
      const secondHalf = nonZeroValues.slice(Math.floor(nonZeroValues.length / 2));
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const changePercent = ((avgSecond - avgFirst) / avgFirst) * 100;
      if (changePercent > 15) tendencia = "crescente";
      else if (changePercent < -15) tendencia = "decrescente";
    }
    
    // Detect anomalies (values beyond 1.5 standard deviations)
    const anomalias: { mes: string; valor: number; desvio: number }[] = [];
    meses.forEach((mes, idx) => {
      const valor = values[idx];
      if (valor > 0 && desvio > 0) {
        const zScore = (valor - media) / desvio;
        if (Math.abs(zScore) > 1.5) {
          anomalias.push({ mes, valor, desvio: zScore });
        }
      }
    });
    
    return {
      categoriaId: node.categoriaId,
      categoriaNome: node.categoriaNome,
      total,
      mediaByMonth: media,
      variancia,
      tendencia,
      anomalias
    };
  }).filter(m => m.total > 0);
}

function findTopCategories(metrics: CategoryMetrics[], limit: number = 10): CategoryMetrics[] {
  return [...metrics].sort((a, b) => b.total - a.total).slice(0, limit);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DfcChatResponse {
  resposta: string;
  dadosReferenciados?: {
    categorias?: string[];
    meses?: string[];
    valores?: string[];
  };
  queryExecutada?: string;
}

// Constante com a estrutura do banco de dados
const DATABASE_SCHEMA = `
=== ESTRUTURA DO BANCO DE DADOS (schema: staging) ===

TABELAS CONTA AZUL (staging.caz_*):

1. staging.caz_clientes (Clientes do Conta Azul)
- ids: Chave primária para relacionamento interno (TEXT)
- nome: Nome cadastrado do cliente (TEXT)
- cnpj: Identificador único, chave de integração com ClickUp (TEXT)
- endereco: Endereço cadastrado (TEXT)
- empresa: Empresa onde foi cadastrado (TEXT)
- created_at: Data de criação (TEXT)

2. staging.caz_pagar (Contas a Pagar)
- id: Identificador da parcela a pagar (TEXT)
- status: Status da cobrança - 'ACQUITTED' (pago), 'PENDING' (pendente) (TEXT)
- total: Valor total da parcela (NUMERIC)
- descricao: Descrição da despesa (TEXT)
- data_vencimento: Data de vencimento formato 'YYYY-MM-DD' (TEXT)
- nao_pago: Valor pendente (NUMERIC)
- pago: Valor pago (NUMERIC)
- fornecedor: Identificador do fornecedor (TEXT)
- nome: Nome do fornecedor (TEXT)
- empresa: Empresa (TEXT)

3. staging.caz_receber (Contas a Receber)
- id: Identificador da parcela a receber (TEXT)
- status: Status da cobrança (TEXT)
- total: Valor total da parcela (NUMERIC)
- descricao: Descrição da receita (TEXT)
- data_vencimento: Data de vencimento formato 'YYYY-MM-DD' (TEXT)
- nao_pago: Valor pendente (NUMERIC)
- pago: Valor recebido (NUMERIC)
- cliente_id: Relaciona com caz_clientes.ids (TEXT)
- cliente_nome: Nome do cliente (TEXT)
- empresa: Empresa (TEXT)

4. staging.caz_parcelas (Detalhamento de Parcelas) - PRINCIPAL PARA DFC
- id: Identificador da parcela (TEXT)
- status: Status da parcela - 'ACQUITTED' (pago), 'PENDING' (pendente) (TEXT)
- valor_pago: Valor efetivamente pago (NUMERIC)
- perda: Valor perdido - inadimplência (NUMERIC)
- nao_pago: Valor pendente (NUMERIC)
- data_vencimento: Data da parcela formato 'YYYY-MM-DD' (TEXT)
- descricao: Descrição do evento financeiro (TEXT)
- metodo_pagamento: Forma de pagamento (TEXT)
- valor_bruto: Valor total inicial (NUMERIC)
- valor_liquido: Valor após descontos (NUMERIC)
- id_evento: Identificador do evento financeiro (TEXT)
- tipo_evento: Tipo financeiro - 'INCOME' (receita), 'EXPENSE' (despesa) (TEXT)
- id_conta_financeira: Origem/destino da transação (TEXT)
- nome_conta_financeira: Nome da conta financeira (TEXT)
- id_cliente: Relaciona com caz_clientes.ids (TEXT)
- url_cobranca: Link do boleto (TEXT)

TABELAS CLICKUP (staging.cup_*):

5. staging.cup_clientes (Clientes do ClickUp)
- nome: Nome do cliente (TEXT)
- cnpj: Chave de integração com Conta Azul (TEXT)
- status: Status operacional do cliente (TEXT)
- telefone: Telefone/WhatsApp (TEXT)
- responsavel: CS responsável pelo atendimento (TEXT)
- cluster: Segmentação/tipo de cliente (TEXT)
- task_id: ID do cliente no ClickUp (TEXT)
- responsavel_geral: Responsável geral (TEXT)

6. staging.cup_contratos (Contratos no ClickUp)
- servico: Tipo de serviço contratado (TEXT)
- status: Status do contrato (ativo, pausado, cancelado) (TEXT)
- valorr: Valor recorrente mensal (NUMERIC)
- valorp: Valor pontual - cobrança única (NUMERIC)
- id_task: Relaciona com cup_clientes.task_id (TEXT)
- id_subtask: Identificador único do contrato (TEXT)
- data_inicio: Data de início do contrato (TEXT)
- data_encerramento: Data de encerramento (TEXT)
- squad: Squad responsável (TEXT)

=== RELACIONAMENTOS ===

- caz_receber.id = caz_parcelas.id (caz_parcelas é o detalhamento de cada registro de caz_receber)
- caz_receber.cliente_id = caz_clientes.ids
- caz_parcelas.id_cliente = caz_clientes.ids
- caz_clientes.cnpj = cup_clientes.cnpj (integração entre sistemas)
- cup_contratos.id_task = cup_clientes.task_id

=== NOTAS IMPORTANTES PARA QUERIES ===

1. Use sempre o schema 'staging.' antes do nome das tabelas: staging.caz_parcelas, staging.caz_pagar, etc.
2. Para filtrar por mês, use: TO_CHAR(data_vencimento::date, 'YYYY-MM') = '2025-11'
3. Para DESPESAS: tipo_evento = 'EXPENSE' (em caz_parcelas)
4. Para RECEITAS: tipo_evento = 'INCOME' (em caz_parcelas)
5. Use COALESCE para valores nulos: COALESCE(valor_pago, 0)
6. Limite resultados com LIMIT para evitar retornos muito grandes
7. Ordene por valor decrescente para encontrar maiores: ORDER BY valor_pago DESC
`;

export async function chatWithDfc(
  dfcData: DfcHierarchicalResponse,
  pergunta: string,
  historico: ChatMessage[] = []
): Promise<DfcChatResponse> {
  const monthlyData = calculateMonthlyData(dfcData);
  const categoryMetrics = calculateCategoryMetrics(dfcData.nodes, dfcData.meses);
  const topCategories = findTopCategories(categoryMetrics, 20);
  
  const totalReceitas = monthlyData.reduce((a, m) => a + m.receitas, 0);
  const totalDespesas = monthlyData.reduce((a, m) => a + m.despesas, 0);
  const margemMedia = monthlyData.length > 0 
    ? monthlyData.reduce((a, m) => a + m.margem, 0) / monthlyData.length 
    : 0;
  
  const bestMonth = monthlyData.reduce((best, m) => m.resultado > best.resultado ? m : best, monthlyData[0]);
  const worstMonth = monthlyData.reduce((worst, m) => m.resultado < worst.resultado ? m : worst, monthlyData[0]);

  const contextData = {
    periodo: {
      inicio: dfcData.meses[0],
      fim: dfcData.meses[dfcData.meses.length - 1],
      meses: dfcData.meses
    },
    resumoFinanceiro: {
      totalReceitas: formatCurrency(totalReceitas),
      totalDespesas: formatCurrency(totalDespesas),
      resultadoLiquido: formatCurrency(totalReceitas - totalDespesas),
      margemMedia: `${margemMedia.toFixed(1)}%`
    },
    evolucaoMensal: monthlyData.map(m => ({
      mes: m.mes,
      receitas: formatCurrency(m.receitas),
      despesas: formatCurrency(m.despesas),
      resultado: formatCurrency(m.resultado),
      margem: `${m.margem.toFixed(1)}%`
    })),
    categorias: topCategories.map(c => ({
      nome: c.categoriaNome,
      total: formatCurrency(c.total),
      media: formatCurrency(c.mediaByMonth),
      tendencia: c.tendencia
    })),
    destaques: {
      melhorMes: { mes: bestMonth?.mes, resultado: formatCurrency(bestMonth?.resultado || 0) },
      piorMes: { mes: worstMonth?.mes, resultado: formatCurrency(worstMonth?.resultado || 0) }
    }
  };

  // ETAPA 1: Analisar se precisa de query SQL
  const analysisPrompt = `Você é um assistente financeiro especializado em DFC para uma agência de marketing digital brasileira.

${DATABASE_SCHEMA}

=== DADOS AGREGADOS DO PERÍODO (já calculados) ===
${JSON.stringify(contextData, null, 2)}

=== SUA TAREFA ===
Analise a pergunta do usuário e decida:
1. Se pode responder usando apenas os DADOS AGREGADOS acima, responda diretamente
2. Se precisa de dados mais específicos do banco (ex: qual foi a maior despesa individual, detalhes de um cliente específico, etc), gere uma query SQL

Responda APENAS com JSON válido:
{
  "precisaQuery": true ou false,
  "query": "SELECT ... (apenas se precisaQuery=true, senão null)",
  "motivoQuery": "explicação de por que precisa da query (apenas se precisaQuery=true)",
  "respostaFinal": "sua resposta completa (apenas se precisaQuery=false)"
}

REGRAS PARA QUERIES:
- Use sempre o schema staging. (ex: staging.caz_parcelas)
- Para filtrar mês: TO_CHAR(data_vencimento::date, 'YYYY-MM') = 'YYYY-MM'
- Para despesas: tipo_evento = 'EXPENSE'
- Para receitas: tipo_evento = 'INCOME'
- Limite resultados: LIMIT 10 ou LIMIT 20
- Ordene adequadamente: ORDER BY valor_pago DESC para maiores valores
- Use aliases para clareza: AS valor, AS descricao, etc.`;

  const analysisMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: analysisPrompt }
  ];

  historico.forEach(msg => {
    analysisMessages.push({ role: msg.role, content: msg.content });
  });

  analysisMessages.push({ role: "user", content: pergunta });

  try {
    console.log("[DFC Chat] Analyzing question:", pergunta);
    
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-5",
      messages: analysisMessages,
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const analysisContent = analysisResponse.choices[0].message.content;
    if (!analysisContent) {
      throw new Error("Resposta vazia da análise");
    }

    const analysis = JSON.parse(analysisContent) as {
      precisaQuery: boolean;
      query?: string;
      motivoQuery?: string;
      respostaFinal?: string;
    };

    console.log("[DFC Chat] Analysis result:", { precisaQuery: analysis.precisaQuery, hasQuery: !!analysis.query });

    // Se não precisa de query, retorna a resposta direta
    if (!analysis.precisaQuery && analysis.respostaFinal) {
      return {
        resposta: analysis.respostaFinal,
        dadosReferenciados: undefined
      };
    }

    // ETAPA 2: Executar query se necessário
    if (analysis.precisaQuery && analysis.query) {
      console.log("[DFC Chat] Executing query:", analysis.query);
      
      const queryResult = await executeSecureQuery(analysis.query);
      
      if (!queryResult.success) {
        console.error("[DFC Chat] Query failed:", queryResult.error);
        // Tentar responder mesmo sem a query
        return {
          resposta: `Não consegui executar a consulta no banco de dados: ${queryResult.error}. Com base nos dados agregados disponíveis, posso informar que ${analysis.motivoQuery || 'os dados detalhados não estão acessíveis no momento'}.`,
          dadosReferenciados: undefined
        };
      }

      // ETAPA 3: Gerar resposta final com os dados da query
      const finalPrompt = `Você é um assistente financeiro especializado em DFC para uma agência de marketing digital brasileira.

O usuário perguntou: "${pergunta}"

Executei a seguinte query no banco de dados:
${analysis.query}

Resultado da query (${queryResult.rowCount} registros):
${JSON.stringify(queryResult.data?.slice(0, 20), null, 2)}

${queryResult.rowCount && queryResult.rowCount > 20 ? `(Mostrando apenas os 20 primeiros de ${queryResult.rowCount} registros)` : ''}

=== DADOS AGREGADOS DE CONTEXTO ===
${JSON.stringify(contextData, null, 2)}

=== INSTRUÇÕES ===
- Responda de forma clara e objetiva em português brasileiro
- Formate valores em reais: R$ 1.234,56
- Cite os dados específicos encontrados
- Se os resultados forem vazios, explique isso ao usuário

Responda APENAS com JSON válido:
{
  "resposta": "Sua resposta detalhada aqui baseada nos resultados da query",
  "dadosReferenciados": {
    "categorias": ["categoria1"],
    "meses": ["2025-11"],
    "valores": ["R$ 10.000,00"]
  }
}`;

      const finalResponse = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "system", content: finalPrompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      const finalContent = finalResponse.choices[0].message.content;
      if (!finalContent) {
        throw new Error("Resposta vazia da API final");
      }

      const result = JSON.parse(finalContent) as DfcChatResponse;
      result.queryExecutada = analysis.query;
      return result;
    }

    // Fallback
    return {
      resposta: analysis.respostaFinal || "Não consegui processar sua pergunta. Por favor, tente reformulá-la.",
      dadosReferenciados: undefined
    };

  } catch (error) {
    console.error("[DFC Chat] Error:", error);
    return {
      resposta: "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.",
      dadosReferenciados: undefined
    };
  }
}

export async function analyzeDfc(dfcData: DfcHierarchicalResponse): Promise<DfcAnalysisResult> {
  const monthlyData = calculateMonthlyData(dfcData);
  const categoryMetrics = calculateCategoryMetrics(dfcData.nodes, dfcData.meses);
  const topCategories = findTopCategories(categoryMetrics, 15);
  
  // Find anomalies across all categories
  const allAnomalies = categoryMetrics
    .flatMap(m => m.anomalias.map(a => ({ ...a, categoria: m.categoriaNome, categoriaId: m.categoriaId })))
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
    .slice(0, 10);
  
  // Calculate aggregate metrics
  const totalReceitas = monthlyData.reduce((a, m) => a + m.receitas, 0);
  const totalDespesas = monthlyData.reduce((a, m) => a + m.despesas, 0);
  const margemMedia = monthlyData.length > 0 
    ? monthlyData.reduce((a, m) => a + m.margem, 0) / monthlyData.length 
    : 0;
  
  const bestMonth = monthlyData.reduce((best, m) => m.resultado > best.resultado ? m : best, monthlyData[0]);
  const worstMonth = monthlyData.reduce((worst, m) => m.resultado < worst.resultado ? m : worst, monthlyData[0]);
  
  // Determine trends
  const receitasTrend = monthlyData.length >= 2 
    ? (monthlyData[monthlyData.length - 1].receitas > monthlyData[0].receitas ? "crescente" : "decrescente")
    : "estável";
  const despesasTrend = monthlyData.length >= 2
    ? (monthlyData[monthlyData.length - 1].despesas > monthlyData[0].despesas ? "crescente" : "decrescente")
    : "estável";

  // Prepare prompt payload for OpenAI
  const analysisPayload = {
    periodo: {
      inicio: dfcData.meses[0],
      fim: dfcData.meses[dfcData.meses.length - 1],
      totalMeses: dfcData.meses.length
    },
    resumoFinanceiro: {
      totalReceitas: formatCurrency(totalReceitas),
      totalDespesas: formatCurrency(totalDespesas),
      resultadoLiquido: formatCurrency(totalReceitas - totalDespesas),
      margemMedia: `${margemMedia.toFixed(1)}%`,
      tendenciaReceitas: receitasTrend,
      tendenciaDespesas: despesasTrend
    },
    evolucaoMensal: monthlyData.map(m => ({
      mes: m.mes,
      receitas: formatCurrency(m.receitas),
      despesas: formatCurrency(m.despesas),
      resultado: formatCurrency(m.resultado),
      margem: `${m.margem.toFixed(1)}%`
    })),
    principaisCategorias: topCategories.map(c => ({
      nome: c.categoriaNome,
      id: c.categoriaId,
      total: formatCurrency(c.total),
      media: formatCurrency(c.mediaByMonth),
      tendencia: c.tendencia,
      anomalias: c.anomalias.length
    })),
    anomaliasDetectadas: allAnomalies.map(a => ({
      categoria: a.categoria,
      mes: a.mes,
      valor: formatCurrency(a.valor),
      desvio: a.desvio > 0 ? `+${a.desvio.toFixed(1)} desvios acima da média` : `${a.desvio.toFixed(1)} desvios abaixo da média`
    })),
    melhorMes: { mes: bestMonth?.mes, resultado: formatCurrency(bestMonth?.resultado || 0) },
    piorMes: { mes: worstMonth?.mes, resultado: formatCurrency(worstMonth?.resultado || 0) }
  };

  const systemPrompt = `Você é um analista financeiro especializado em fluxo de caixa para agências de marketing digital brasileiras. Analise os dados do DFC (Demonstrativo de Fluxo de Caixa) fornecidos e gere insights acionáveis.

Forneça uma análise em português brasileiro, focando em:
1. Padrões de receita e despesa
2. Anomalias significativas (gastos ou receitas fora do padrão)
3. Tendências que impactam a margem
4. Oportunidades de otimização
5. Alertas sobre riscos financeiros

Responda APENAS com JSON válido no seguinte formato:
{
  "resumoExecutivo": "Resumo de 2-3 frases sobre a situação financeira geral",
  "insights": [
    {
      "tipo": "anomalia|tendencia|oportunidade|alerta",
      "titulo": "Título curto do insight",
      "descricao": "Explicação detalhada do insight com contexto",
      "metricas": ["Métrica relevante 1", "Métrica relevante 2"],
      "severidade": "baixa|media|alta",
      "categoria": "Nome da categoria afetada (se aplicável)",
      "mes": "Mês específico (se aplicável, formato YYYY-MM)"
    }
  ],
  "recomendacoes": [
    "Recomendação acionável 1",
    "Recomendação acionável 2",
    "Recomendação acionável 3"
  ]
}

Gere entre 4 e 8 insights relevantes, priorizando os mais impactantes para o negócio.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analise os seguintes dados do DFC:\n\n${JSON.stringify(analysisPayload, null, 2)}` }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Resposta vazia da API");
    }

    const aiResult = JSON.parse(content);

    return {
      resumoExecutivo: aiResult.resumoExecutivo || "Análise não disponível",
      insights: aiResult.insights || [],
      recomendacoes: aiResult.recomendacoes || [],
      metricas: {
        margemMedia,
        tendenciaReceitas: receitasTrend,
        tendenciaDespesas: despesasTrend,
        mesComMelhorResultado: bestMonth?.mes || "",
        mesComPiorResultado: worstMonth?.mes || ""
      }
    };
  } catch (error) {
    console.error("[DFC Analysis] Error calling OpenAI:", error);
    
    // Fallback: return basic analysis without AI
    const basicInsights: DfcInsight[] = [];
    
    // Add anomaly insights
    allAnomalies.slice(0, 3).forEach(a => {
      basicInsights.push({
        tipo: "anomalia",
        titulo: `Variação em ${a.categoria}`,
        descricao: `No mês ${a.mes}, a categoria "${a.categoria}" apresentou valor de ${formatCurrency(a.valor)}, que está ${Math.abs(a.desvio).toFixed(1)} desvios ${a.desvio > 0 ? 'acima' : 'abaixo'} da média.`,
        metricas: [formatCurrency(a.valor)],
        severidade: Math.abs(a.desvio) > 2 ? "alta" : "media",
        categoria: a.categoria,
        mes: a.mes
      });
    });
    
    // Add trend insights
    topCategories.filter(c => c.tendencia !== "estavel").slice(0, 2).forEach(c => {
      basicInsights.push({
        tipo: "tendencia",
        titulo: `${c.categoriaNome} em ${c.tendencia === "crescente" ? "alta" : "queda"}`,
        descricao: `A categoria "${c.categoriaNome}" apresenta tendência ${c.tendencia} ao longo do período analisado, com total de ${formatCurrency(c.total)}.`,
        metricas: [formatCurrency(c.total), `Média: ${formatCurrency(c.mediaByMonth)}`],
        severidade: "media",
        categoria: c.categoriaNome
      });
    });

    return {
      resumoExecutivo: `Período analisado: ${dfcData.meses[0]} a ${dfcData.meses[dfcData.meses.length - 1]}. Total de receitas: ${formatCurrency(totalReceitas)}, despesas: ${formatCurrency(totalDespesas)}. Margem média: ${margemMedia.toFixed(1)}%.`,
      insights: basicInsights,
      recomendacoes: [
        "Monitore as categorias com anomalias identificadas",
        "Analise as tendências de crescimento de despesas",
        "Revise os meses com margens abaixo da média"
      ],
      metricas: {
        margemMedia,
        tendenciaReceitas: receitasTrend,
        tendenciaDespesas: despesasTrend,
        mesComMelhorResultado: bestMonth?.mes || "",
        mesComPiorResultado: worstMonth?.mes || ""
      }
    };
  }
}

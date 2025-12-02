import OpenAI from "openai";
import type { DfcHierarchicalResponse, DfcNode } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
}

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

  const systemPrompt = `Você é um assistente financeiro especializado em análise de DFC (Demonstrativo de Fluxo de Caixa) para uma agência de marketing digital brasileira.

CONTEXTO DOS DADOS FINANCEIROS:
${JSON.stringify(contextData, null, 2)}

INSTRUÇÕES:
- Responda perguntas sobre o fluxo de caixa de forma clara e objetiva em português brasileiro
- Use os dados fornecidos para embasar suas respostas
- Formate valores em reais brasileiros (R$)
- Seja conciso mas informativo
- Se a pergunta não puder ser respondida com os dados disponíveis, explique o que está faltando
- Quando mencionar categorias ou meses específicos, cite os valores exatos dos dados

Responda APENAS com JSON válido:
{
  "resposta": "Sua resposta detalhada aqui",
  "dadosReferenciados": {
    "categorias": ["categoria1", "categoria2"],
    "meses": ["2024-01", "2024-02"],
    "valores": ["R$ 10.000,00", "R$ 20.000,00"]
  }
}`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt }
  ];

  historico.forEach(msg => {
    messages.push({ role: msg.role, content: msg.content });
  });

  messages.push({ role: "user", content: pergunta });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Resposta vazia da API");
    }

    return JSON.parse(content) as DfcChatResponse;
  } catch (error) {
    console.error("[DFC Chat] Error:", error);
    return {
      resposta: "Desculpe, não consegui processar sua pergunta. Por favor, tente novamente ou reformule sua pergunta.",
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

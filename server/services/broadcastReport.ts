/**
 * Narrativa estratégica do relatório mensal de broadcast (Claude).
 *
 * Recebe os números já agregados (mês atual vs anterior + bases + padrões) e devolve
 * um resumo executivo + recomendações acionáveis pro próximo mês. Toda a parte de DADOS
 * é calculada no endpoint (determinística); aqui só a leitura estratégica.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
const MODEL = "claude-haiku-4-5-20251001";

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
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    const raw = block.type === "text" ? block.text : "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<Narrativa>;
    return {
      resumo: parsed.resumo || "Sem resumo.",
      recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes : [],
    };
  } catch (err: any) {
    console.error("[broadcastReport] narrativa falhou:", err.message);
    return { resumo: "Falha ao gerar a narrativa por IA.", recomendacoes: [] };
  }
}

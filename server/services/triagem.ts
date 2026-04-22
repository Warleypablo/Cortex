import Anthropic from "@anthropic-ai/sdk";
import { getDriveClient } from "../autoreport/credentials";
import { db } from "../db";
import { sql } from "drizzle-orm";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// ── Google Drive: buscar transcrição por nome do cliente ──

export async function buscarTranscricao(clienteNome: string): Promise<{
  texto: string;
  url: string;
} | null> {
  try {
    const drive = getDriveClient();

    const res = await drive.files.list({
      q: `fullText contains '${clienteNome.replace(/'/g, "\\'")}' and (mimeType='text/plain' or mimeType='application/vnd.google-apps.document' or name contains 'transcript')`,
      fields: "files(id, name, mimeType, webViewLink)",
      orderBy: "modifiedTime desc",
      pageSize: 5,
    });

    const files = res.data.files;
    if (!files || files.length === 0) return null;

    const file = files[0];
    let texto = "";

    if (file.mimeType === "application/vnd.google-apps.document") {
      const exported = await drive.files.export({
        fileId: file.id!,
        mimeType: "text/plain",
      });
      texto = typeof exported.data === "string" ? exported.data : String(exported.data);
    } else {
      const downloaded = await drive.files.get({
        fileId: file.id!,
        alt: "media",
      });
      texto = typeof downloaded.data === "string" ? downloaded.data : String(downloaded.data);
    }

    return {
      texto,
      url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    };
  } catch (error) {
    console.error("[triagem] Error fetching transcription from Drive:", error);
    return null;
  }
}

// ── Claude: analisar transcrição ──

const TRIAGEM_SYSTEM_PROMPT = `Você é um analista de qualidade de vendas da Turbo Partners, uma agência de marketing digital.

Sua tarefa é analisar a transcrição de uma reunião de venda e identificar sinais de desalinhamento que indicam risco de churn precoce.

## SISTEMA DE PONTUAÇÃO

Analise a transcrição usando EXATAMENTE 3 critérios principais de risco, cada um com um peso máximo de pontos:

### Critério 1: Expectativa Irreal de Resultado (0 a 40 pontos) — MAIOR PESO
Avalie se o cliente espera resultados em prazos incompatíveis com a realidade, se o vendedor fez promessas exageradas, ou se o cliente demonstra impaciência/urgência irreal.
- 0 pontos: Expectativas realistas de prazo e resultado
- 10-15 pontos: Expectativas levemente otimistas mas corrigíveis
- 20-30 pontos: Expectativas claramente desalinhadas, vendedor não corrigiu adequadamente
- 35-40 pontos: Expectativas completamente irreais, promessas exageradas pelo vendedor

### Critério 2: Falta de Estrutura / Orçamento (0 a 35 pontos)
Avalie se o cliente tem verba para mídia/anúncios, equipe interna, produto/estoque pronto, e condições operacionais mínimas.
- 0 pontos: Verba, equipe e operação prontas
- 8-15 pontos: Pequenas lacunas (site precisa ajustes, verba de mídia apertada)
- 18-25 pontos: Lacunas significativas (sem verba definida OU sem produto/operação prontos)
- 28-35 pontos: Múltiplas lacunas graves (sem verba E sem estrutura operacional)

### Critério 3: Serviço Vendido Inadequado (0 a 25 pontos)
Avalie se a necessidade real do cliente combina com o serviço vendido e se o perfil do negócio é compatível com o produto contratado.
- 0 pontos: Serviço atende bem a necessidade real
- 5-10 pontos: Leve desalinhamento, ajustável no onboarding
- 12-18 pontos: Desalinhamento claro entre necessidade e serviço
- 20-25 pontos: Serviço completamente errado para o perfil

## SINAIS SECUNDÁRIOS — AGRAVANTES (até +10 pontos no total, máximo +3 cada)

Identifique se algum destes sinais está presente na transcrição:
- **Tomador de decisão ausente**: Reunião foi com intermediário, decisor nunca participou
- **Histórico negativo com agências**: Cliente já trocou várias agências, insatisfação recorrente
- **Falta de clareza no objetivo**: "Quero crescer" sem métricas, sem meta definida
- **Dependência excessiva da agência**: Cliente espera que a agência resolva tudo (conteúdo, fotos, estratégia, atendimento)
- **Desalinhamento de perfil/porte**: Segmento ou porte do cliente fora do perfil atendido pela agência

## SINAIS ATENUANTES (até -15 pontos no total, máximo -3 cada)

Identifique se algum destes sinais positivos está presente e pode REDUZIR a severidade dos riscos detectados:
- **Orçamento robusto e definido**: Cliente já tem verba separada, sabe quanto quer investir
- **Experiência prévia com marketing digital**: Já trabalhou com agência ou roda campanhas próprias
- **Tomador de decisão presente e engajado**: Decisor na reunião, faz perguntas relevantes, demonstra compromisso
- **Expectativas realinhadas na reunião**: Vendedor corrigiu expectativas e cliente aceitou bem
- **Estrutura operacional pronta**: Site no ar, produto disponível, equipe de atendimento funcionando

## CÁLCULO DO SCORE

score_numerico = (pontos critério 1) + (pontos critério 2) + (pontos critério 3) + (soma agravantes) - (soma atenuantes)

O resultado deve ser CLAMPADO entre 0 e 100.

## CLASSIFICAÇÃO

Com base no score_numerico:
- 0-39: score = "baixo"
- 40-69: score = "medio"
- 70-100: score = "alto"

## RECOMENDAÇÃO

Com base no score_numerico:
- 0-30: "Aprovar"
- 31-50: "Aprovar com atenção"
- 51-70: "Escalar para gestor"
- 71-100: "Rejeitar - alto risco"

Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks, sem texto antes ou depois. Use esta estrutura exata:

{
  "score": "alto" | "medio" | "baixo",
  "score_numerico": <0-100>,
  "composicao_score": {
    "expectativa_irreal": <0-40>,
    "falta_estrutura": <0-35>,
    "servico_inadequado": <0-25>,
    "agravantes_total": <0-10>,
    "atenuantes_total": <0-15>,
    "formula": "<ex: 30 + 15 + 10 + 3 - 6 = 52>"
  },
  "analise": {
    "expectativa_irreal": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "pontos": <0-40>,
      "justificativa": "<explicação em 1-2 frases>",
      "trechos": ["<trecho relevante da transcrição>"]
    },
    "falta_estrutura": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "pontos": <0-35>,
      "justificativa": "<explicação em 1-2 frases>",
      "trechos": ["<trecho relevante>"]
    },
    "servico_inadequado": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "pontos": <0-25>,
      "justificativa": "<explicação em 1-2 frases>",
      "trechos": ["<trecho relevante>"]
    }
  },
  "agravantes": [
    {
      "sinal": "<nome do sinal>",
      "pontos": <1-3>,
      "justificativa": "<explicação breve>"
    }
  ],
  "atenuantes": [
    {
      "sinal": "<nome do sinal>",
      "pontos": <1-3>,
      "justificativa": "<explicação breve>"
    }
  ],
  "resumo": "<resumo executivo em 2-3 frases>",
  "recomendacao": "Aprovar" | "Aprovar com atenção" | "Escalar para gestor" | "Rejeitar - alto risco"
}`;

export async function analisarTranscricao(transcricao: string): Promise<any> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: TRIAGEM_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analise esta transcrição de reunião de venda:\n\n${transcricao}`,
      },
    ],
  });

  const block = response.content[0];
  let text = block.type === "text" ? block.text : "{}";

  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    return JSON.parse(text);
  } catch {
    console.error("[triagem] Failed to parse Claude response:", text);
    return {
      score: "medio",
      score_numerico: 50,
      composicao_score: {
        expectativa_irreal: 0,
        falta_estrutura: 0,
        servico_inadequado: 0,
        agravantes_total: 0,
        atenuantes_total: 0,
        formula: "Análise inconclusiva",
      },
      analise: {
        expectativa_irreal: { detectado: false, severidade: "nenhuma", pontos: 0, justificativa: "Não foi possível analisar", trechos: [] },
        falta_estrutura: { detectado: false, severidade: "nenhuma", pontos: 0, justificativa: "Não foi possível analisar", trechos: [] },
        servico_inadequado: { detectado: false, severidade: "nenhuma", pontos: 0, justificativa: "Não foi possível analisar", trechos: [] },
      },
      agravantes: [],
      atenuantes: [],
      resumo: "Análise inconclusiva - resposta da IA não pôde ser processada.",
      recomendacao: "Escalar para gestor",
    };
  }
}

// ── Inicializar tabela ──

export async function initTriagemTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.triagem_analises (
      id SERIAL PRIMARY KEY,
      cliente_id TEXT,
      cliente_nome TEXT NOT NULL,
      squad TEXT,
      vendedor TEXT,
      produto TEXT,
      valor_contrato DECIMAL(12,2),
      transcricao_url TEXT,
      transcricao_texto TEXT,
      score TEXT,
      score_numerico INTEGER,
      analise_json JSONB,
      status TEXT NOT NULL DEFAULT 'pendente',
      decisao_por TEXT,
      decisao_observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_triagem_status ON cortex_core.triagem_analises(status)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_triagem_score ON cortex_core.triagem_analises(score)
  `);
}

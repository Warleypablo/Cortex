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

Analise a transcrição buscando EXATAMENTE 3 critérios:

1. **Expectativa irreal de resultado**: O cliente espera resultados em prazos incompatíveis com a realidade? O vendedor fez promessas exageradas? O cliente demonstra impaciência ou urgência irreal?

2. **Falta de estrutura/orçamento**: O cliente não tem verba para mídia/anúncios? Não tem equipe interna para complementar? Não tem produto/estoque pronto? Não tem condições operacionais mínimas?

3. **Serviço vendido inadequado**: A necessidade real do cliente não combina com o serviço vendido? O perfil do negócio é incompatível com o produto contratado? O cliente precisa de algo diferente do que está comprando?

Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks, sem texto antes ou depois. Use esta estrutura exata:

{
  "score": "alto" | "medio" | "baixo",
  "score_numerico": <número de 0 a 100, onde 100 = altíssimo risco>,
  "analise": {
    "expectativa_irreal": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "justificativa": "<explicação em 1-2 frases>",
      "trechos": ["<trecho relevante da transcrição>"]
    },
    "falta_estrutura": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "justificativa": "<explicação em 1-2 frases>",
      "trechos": ["<trecho relevante>"]
    },
    "servico_inadequado": {
      "detectado": true | false,
      "severidade": "alta" | "media" | "baixa" | "nenhuma",
      "justificativa": "<explicação em 1-2 frases>",
      "trechos": ["<trecho relevante>"]
    }
  },
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
      analise: {
        expectativa_irreal: { detectado: false, severidade: "nenhuma", justificativa: "Não foi possível analisar", trechos: [] },
        falta_estrutura: { detectado: false, severidade: "nenhuma", justificativa: "Não foi possível analisar", trechos: [] },
        servico_inadequado: { detectado: false, severidade: "nenhuma", justificativa: "Não foi possível analisar", trechos: [] },
      },
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

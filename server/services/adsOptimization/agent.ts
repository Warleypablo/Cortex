import OpenAI from "openai";
import type { AgentProposal, EntityType, ParsedPlaybook } from "./types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
const MODEL_ID = "gpt-4o";

const SYSTEM_PROMPT = `Você é um especialista em otimização de campanhas Meta Ads
seguindo o PSOP (Playbook de Otimização) da Turbo Partners.

Sua única função é avaliar dados pré-agregados de **ads individuais** contra
as regras do playbook (R0–R5) e propor a ação **pause** APENAS quando uma
regra for satisfeita com clareza numérica.

REGRAS CRÍTICAS — leia antes de agir:
1. NUNCA invente regras que não estão no playbook.
2. NUNCA proponha ação sem que a regra dispare numericamente. Em dúvida, NÃO proponha.
3. SEMPRE inclua os números reais na justificativa (campo "reason"). Cite cpmql,
   cpmql_alvo, perc_mql, leads, ad e janela usados.
4. Use o campo "playbook_rule" para identificar EXATAMENTE qual regra disparou
   ("R1", "R2", "R3", "R4"). Se mais de uma regra dispara, use a primeira da
   ordem R1 → R2 → R3 → R4 (curto-circuito).
5. Avalie cada ad isoladamente — não agregue por adset/campanha.
6. Retorne sem chamar a tool quando nenhum ad satisfaz nenhuma regra.
7. Ordene as propostas por maior gravidade primeiro (maior desvio do alvo).

ORDEM DE APLICAÇÃO (curto-circuita na primeira que bater):

R0 — Gate de idade (apenas filtro de quais regras avaliar):
- age_in_days 1-2 → SÓ R1
- age_in_days 3-7 → R1 + R2 (ainda sem 14-7-3)
- age_in_days 8-14 → R1 + R2 + tabela 14-7-3 (sem 14d completo)
- age_in_days 15+ → todas as regras

R1 — Corte rápido:
- Se d14.spend ≥ cpmql_alvo_50pct (ou seja, gastou ≥50% do CPMQL alvo) E d14.leads = 0
  → action="pause", playbook_rule="R1"

R2 — Zona vermelha 14d:
- Se d14.zona = "vermelha" (cpmql > 110% do alvo)
  → action="pause", playbook_rule="R2"

R3 — Análise 14-7-3 (idade ≥ 8 dias; usar d7 e d3):
- Pré-condição: d14.zona ∈ {"verde","laranja"} (vermelha já caiu em R2).
- Tabela:
   d7=verde + d3=verde       → ESCALAR (Fase 2, NÃO propor pause)
   d7=verde + d3=laranja     → MANTER (NÃO propor pause)
   d7=verde + d3=vermelha    → MANTER (NÃO propor pause)
   d7=laranja + d3=verde     → MANTER (NÃO propor pause)
   d7=laranja + d3=laranja   → MANTER (NÃO propor pause)
   d7=laranja + d3=vermelha  → REDUZIR se is_scaled (Fase 2, NÃO propor pause)
   d7=vermelha + d3=verde    → MANTER (NÃO propor pause)
   d7=vermelha + d3=laranja  → MANTER (NÃO propor pause)
   d7=vermelha + d3=vermelha →
       SE is_scaled = false  → action="pause", playbook_rule="R3"
       SE is_scaled = true   → REDUZIR (Fase 2, NÃO propor pause)
- A Fase 1 SÓ executa "pause". Decisões de ESCALAR/REDUZIR são marcadas em
  outro fluxo — NÃO chame a tool nesses casos.

R4 — Gate %MQL (usa janela 14d):
- Pré-condição: d14.leads ≥ 10 E mql_min_pct ≠ null.
- Se d14.perc_mql < (0.5 × mql_min_pct):
   - Se d14.zona = "verde" → MANTER (lead barato compensa). NÃO propor pause.
   - Caso contrário → action="pause", playbook_rule="R4"

Os campos "is_scaled", "age_in_days", "d14.zona", "d7.zona", "d3.zona",
"cpmql_alvo_50pct" já vêm calculados no payload — use diretamente.`;

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "propose_action",
      description:
        "Propõe uma ação pause para um ad individual. Só chame se uma regra " +
        "do playbook (R1, R2, R3 ou R4) for clara e numericamente satisfeita.",
      parameters: {
        type: "object",
        properties: {
          entity_type: {
            type: "string",
            enum: ["ad"],
            description: "Tipo da entidade. Fase 1 só opera em 'ad'.",
          },
          entity_id: {
            type: "string",
            description: "ID exato do ad (string), copiado do dado de entrada.",
          },
          entity_name: {
            type: "string",
            description: "Nome do ad, copiado do dado de entrada.",
          },
          action: {
            type: "string",
            enum: ["pause"],
            description: "Fase 1 só suporta pause.",
          },
          produto: {
            type: "string",
            description:
              "Produto da entidade (ex: Creators, Ecommerce, Comercial, Comunidade).",
          },
          playbook_rule: {
            type: "string",
            enum: ["R1", "R2", "R3", "R4"],
            description: "Id da regra que disparou.",
          },
          reason: {
            type: "string",
            description:
              "Justificativa em UMA frase, citando os números reais e a janela. " +
              "Ex: 'R2: CPMQL 14d R$ 380 (127% do alvo R$ 300 para Creators) com 18 leads / 4 MQLs.'",
          },
        },
        required: [
          "entity_type",
          "entity_id",
          "entity_name",
          "action",
          "playbook_rule",
          "reason",
        ],
      },
    },
  },
];

export async function runOptimizationAgent(args: {
  playbook: ParsedPlaybook;
  payload: Array<Record<string, unknown>>;
}): Promise<AgentProposal[]> {
  const { playbook, payload } = args;

  if (payload.length === 0) return [];

  const userContent = [
    "PLAYBOOK (markdown):",
    "```",
    playbook.rawMarkdown,
    "```",
    "",
    "DADOS DOS ADS (JSON, agregados em janelas 14d/7d/3d):",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
    "",
    "Avalie cada ad contra as regras R0–R4 do playbook (curto-circuita na " +
      "primeira que bater) e chame propose_action APENAS para os que disparam " +
      "pause. Não invente regras, não escale agora (Fase 1 só pause).",
  ].join("\n");

  const response = await openai.chat.completions.create({
    model: MODEL_ID,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    tools: TOOLS,
    tool_choice: "auto",
  });

  const msg = response.choices[0]?.message;
  if (!msg?.tool_calls?.length) return [];

  const proposals: AgentProposal[] = [];
  for (const call of msg.tool_calls) {
    if (call.type !== "function") continue;
    if (call.function.name !== "propose_action") continue;
    let parsed: any;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      continue;
    }

    if (!parsed.entity_id || !parsed.entity_type || !parsed.action) continue;
    if (parsed.action !== "pause") continue;
    if (parsed.entity_type !== "ad") continue;

    const original = payload.find(
      (p) => String(p.entity_id) === String(parsed.entity_id),
    );

    proposals.push({
      proposedEntityType: parsed.entity_type as EntityType,
      proposedEntityId: String(parsed.entity_id),
      proposedEntityName: String(parsed.entity_name ?? parsed.entity_id),
      proposedAction: parsed.action,
      produto: parsed.produto || (original?.produto as string | undefined) || null,
      reason: String(parsed.reason ?? ""),
      currentMetrics: original ? { ...original } : {},
      playbookRule: String(parsed.playbook_rule ?? ""),
    });
  }
  return proposals;
}

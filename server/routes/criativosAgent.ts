/**
 * Routes: /api/criativos/agent/*
 *
 * Endpoint que roda o "Gestor de Performance" — um agente Claude com tools
 * que LÊ métricas de Meta Ads + Bitrix e registra propostas de pause/resume/budget
 * em cortex_core.meta_actions_log. Propostas ficam pending até que um admin
 * humano confirme via /api/meta/actions/*.
 *
 * Acesso: isAuthenticated + isAdmin.
 */

import { Router, type Response, type NextFunction } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { db, pool } from '../db';
import { isAuthenticated } from '../auth/middleware';
import {
  GROWTH_AI_TOOLS,
  executeCriativosAgentTool,
  type CriativosAgentContext,
} from '../services/growthAiTools';

// ── Local isAdmin middleware (cópia de routes.ts:217, para não editar routes.ts) ──
function isAdmin(req: any, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }
  next();
}

// ── Anthropic SDK ─────────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const MODEL_ID = 'claude-sonnet-4-5-20250514';
const MAX_AGENT_TURNS = 8;

// ── Tool format conversion: OpenAI → Anthropic ────────────────────────────
// GROWTH_AI_TOOLS usa o schema do OpenAI (`{ type: 'function', function: { ... } }`)
// porque já serve a rota growth-ai que usa GPT-4o. Para Claude precisamos
// converter para `{ name, description, input_schema }`.
const ANTHROPIC_TOOLS = GROWTH_AI_TOOLS.map((t: any) => ({
  name: t.function.name,
  description: t.function.description,
  input_schema: t.function.parameters,
}));

// ── System prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Voce e o "Gestor de Performance" da Turbo Partners, agindo como um gestor de trafego senior com conhecimento profundo de Meta Ads, funis de vendas e ROAS.

Sua missao: analisar os criativos do periodo informado, identificar ineficiencias, e PROPOR acoes (pausar / reativar / ajustar budget) que melhorariam o resultado global da conta.

REGRAS OBRIGATORIAS:
1. SEMPRE comece chamando getAdsMetrics + getDealsMetrics + getBudgets para entender o contexto do periodo. Nunca proponha sem dados.
2. NUNCA proponha pausar um ad com menos de 7 dias de dados consecutivos. Se a janela for curta, use getCriativoTimeSeries para checar a densidade temporal antes de decidir.
3. NUNCA proponha AUMENTAR budget sem evidencia de ROAS >= 1.5x a meta por >= 14 dias.
4. Delta de budget sempre dentro de +/-30% do valor atual. O sistema rejeita valores fora dessa faixa.
5. Sempre cite no rationale (minimo 40 caracteres): spend total, leads (Meta), deals ganhos (Bitrix), CAC calculado, periodo analisado e a meta de referencia (getBudgets).
6. Voce NUNCA executa a acao. As tools "proposeX" apenas registram propostas. Um admin humano ira revisar e confirmar.
7. Se nao houver evidencia suficiente para nenhuma proposta, NAO invente propostas. Retorne um relatorio textual explicando o que voce viu.
8. Priorize qualidade (poucas propostas bem justificadas) sobre quantidade.

FORMATO DE RESPOSTA FINAL:
Apos fazer todas as chamadas de tools necessarias, responda em portugues com:
- Sumario do periodo (spend, leads, deals, CAC, ROAS vs meta)
- Lista das propostas criadas (com logId de cada uma)
- Proximos passos recomendados

Nao use markdown pesado. Seja direto e acionavel.`;

// ── Router ───────────────────────────────────────────────────────────────

const router = Router();
router.use(isAuthenticated);
router.use(isAdmin);

const analyzeSchema = z.object({
  period: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  filters: z
    .object({
      funil: z.string().optional(),
    })
    .optional(),
});

router.post('/analyze', async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', details: parsed.error.issues });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurado' });
  }

  const user = (req as any).user;
  const ctx: CriativosAgentContext = {
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
  };

  const { period, filters } = parsed.data;
  const userPrompt = [
    `Analise os criativos da conta Meta Ads no periodo ${period.startDate} a ${period.endDate}.`,
    filters?.funil ? `Filtro de funil: ${filters.funil}.` : null,
    `Siga as regras do system prompt e, quando houver evidencia solida, proponha acoes via as tools "propose*".`,
  ]
    .filter(Boolean)
    .join(' ');

  const createdProposals: number[] = [];
  const toolCallTrace: Array<{ name: string; ok: boolean }> = [];

  type AnthropicMessage = { role: 'user' | 'assistant'; content: any };
  const messages: AnthropicMessage[] = [{ role: 'user', content: userPrompt }];

  try {
    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
      const response = await anthropic.messages.create({
        model: MODEL_ID,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: ANTHROPIC_TOOLS as any,
        messages: messages as any,
      });

      // Append assistant turn as-is (tool_use blocks included) for the next call.
      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        const textBlocks = (response.content as any[]).filter((b) => b.type === 'text');
        const finalText = textBlocks.map((b) => b.text).join('\n\n');
        return res.json({
          ok: true,
          finalText,
          proposalLogIds: createdProposals,
          toolCalls: toolCallTrace,
          turns: turn + 1,
        });
      }

      if (response.stop_reason !== 'tool_use') {
        // Qualquer outro motivo (max_tokens, stop_sequence, refusal) → devolve o que tem.
        const textBlocks = (response.content as any[]).filter((b) => b.type === 'text');
        const finalText = textBlocks.map((b) => b.text).join('\n\n') || '(sem texto)';
        return res.json({
          ok: true,
          finalText,
          proposalLogIds: createdProposals,
          toolCalls: toolCallTrace,
          stoppedBecause: response.stop_reason,
          turns: turn + 1,
        });
      }

      // Execute each tool_use block and assemble a single user tool_result message.
      const toolUses = (response.content as any[]).filter((b) => b.type === 'tool_use');
      const toolResults: any[] = [];

      for (const tu of toolUses) {
        const toolName = tu.name;
        const toolInput = tu.input;
        const resultText = await executeCriativosAgentTool(db, toolName, toolInput, ctx);

        let ok = true;
        try {
          const parsedResult = JSON.parse(resultText);
          if (parsedResult?.ok === false || parsedResult?.error) ok = false;
          if (parsedResult?.ok === true && typeof parsedResult.logId === 'number') {
            createdProposals.push(parsedResult.logId);
          }
        } catch {
          /* ignore parsing issues */
        }

        toolCallTrace.push({ name: toolName, ok });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: resultText,
          is_error: !ok,
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    return res.status(504).json({
      error: 'Agente excedeu o máximo de turnos sem concluir',
      proposalLogIds: createdProposals,
      toolCalls: toolCallTrace,
    });
  } catch (err: any) {
    console.error('[criativosAgent] analyze error:', err);
    return res.status(500).json({
      error: err?.message || 'Erro ao executar agente',
      proposalLogIds: createdProposals,
    });
  }
});

/**
 * GET /api/criativos/agent/proposals
 * Retorna propostas pending criadas pelo agente (atalho do /pending filtrado por actor_type='agent').
 */
router.get('/proposals', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM cortex_core.meta_actions_log
        WHERE status = 'pending' AND actor_type = 'agent'
        ORDER BY created_at DESC
        LIMIT 200`,
    );
    res.json({ proposals: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

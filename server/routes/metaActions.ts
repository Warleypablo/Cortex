/**
 * Routes: /api/meta/actions/*
 *
 * Executa ações de escrita no Meta Ads (pausar/reativar/ajustar budget),
 * grava tudo no audit trail cortex_core.meta_actions_log, e suporta
 * o fluxo de "confirmar proposta do agente" com optimistic locking.
 *
 * Todas as rotas exigem isAuthenticated + isAdmin (V1 = Caio + Warley).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { isAuthenticated } from '../auth/middleware';
import { canWriteMeta } from '@shared/constants';
import {
  pauseEntity,
  resumeEntity,
  updateDailyBudget,
  increaseDailyBudgetByPct,
  readEntitySnapshot,
  sanitizeError,
  type MetaEntityLevel,
  type MetaWriteResult,
} from '../services/metaAdsWrite';

// ===================== LOCAL MIDDLEWARE =====================
// Definimos isAdmin localmente (cópia fiel de server/routes.ts:217)
// para manter a Fase 1 puramente aditiva — sem editar routes.ts.
function isAdmin(req: any, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }
  next();
}

// Gate de escrita no Meta: SOMENTE os e-mails da allowlist (não basta ser admin).
// Aplicado nas rotas que executam pause/resume/budget/bulk.
function requireMetaWriter(req: any, res: Response, next: NextFunction) {
  if (!canWriteMeta(req.user?.email)) {
    return res.status(403).json({ error: 'Sem permissão para alterar anúncios no Meta Ads' });
  }
  next();
}

// ===================== SCHEMAS =====================

const levelSchema = z.enum(['ad', 'adset', 'campaign']);

const baseActionSchema = z.object({
  level: levelSchema,
  entityId: z.string().min(1).max(64),
  reason: z.string().min(5, 'reason deve ter pelo menos 5 caracteres').max(2000),
  fromLogId: z.number().int().positive().optional(),
});

const pauseResumeSchema = baseActionSchema;

const budgetSchema = baseActionSchema.extend({
  level: z.enum(['adset', 'campaign']),
  newDailyBudgetCents: z.number().int().positive(),
});

const bulkSchema = z.object({
  action: z.enum(['pause', 'resume']),
  reason: z.string().min(5, 'reason deve ter pelo menos 5 caracteres').max(2000),
  items: z
    .array(
      z.object({
        level: levelSchema,
        entityId: z.string().min(1).max(64),
      }),
    )
    .min(1, 'items não pode ser vazio')
    .max(200, 'máximo de 200 itens por lote'),
});

// Ajuste de orçamento em massa por percentual. O backend lê o valor atual de cada
// entidade e aplica o %, herdando os guard-rails (±30% e teto). Só adset/campaign.
const bulkBudgetSchema = z.object({
  pct: z.number().refine((v) => v !== 0 && v >= -90 && v <= 100, 'pct deve ser diferente de 0 e entre -90 e 100'),
  reason: z.string().min(5, 'reason deve ter pelo menos 5 caracteres').max(2000),
  items: z
    .array(
      z.object({
        level: z.enum(['adset', 'campaign']),
        entityId: z.string().min(1).max(64),
      }),
    )
    .min(1, 'items não pode ser vazio')
    .max(200, 'máximo de 200 itens por lote'),
});

// ===================== DB HELPERS =====================

interface LogRow {
  id: number;
  actor_type: 'human' | 'agent';
  actor_user_id: string | null;
  actor_email: string | null;
  level: MetaEntityLevel;
  entity_id: string;
  entity_name: string | null;
  action: string;
  payload_json: any;
  previous_value_json: any;
  reason: string;
  agent_rationale_text: string | null;
  status: 'pending' | 'executing' | 'success' | 'error' | 'ignored';
  meta_error_json: any;
  confirmed_by_user_id: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

async function insertLog(row: {
  actorType: 'human' | 'agent';
  actorUserId?: string | null;
  actorEmail?: string | null;
  level: MetaEntityLevel;
  entityId: string;
  entityName?: string | null;
  action: string;
  payloadJson: any;
  previousValueJson?: any;
  reason: string;
  agentRationaleText?: string | null;
  status: LogRow['status'];
  confirmedByUserId?: string | null;
  confirmedAt?: Date | null;
}): Promise<number> {
  const res = await pool.query<{ id: number }>(
    `INSERT INTO cortex_core.meta_actions_log (
        actor_type, actor_user_id, actor_email, level, entity_id, entity_name,
        action, payload_json, previous_value_json, reason, agent_rationale_text,
        status, confirmed_by_user_id, confirmed_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      row.actorType,
      row.actorUserId ?? null,
      row.actorEmail ?? null,
      row.level,
      row.entityId,
      row.entityName ?? null,
      row.action,
      JSON.stringify(row.payloadJson),
      row.previousValueJson != null ? JSON.stringify(row.previousValueJson) : null,
      row.reason,
      row.agentRationaleText ?? null,
      row.status,
      row.confirmedByUserId ?? null,
      row.confirmedAt ?? null,
    ],
  );
  return res.rows[0].id;
}

async function finalizeLog(
  logId: number,
  result: MetaWriteResult,
  previousValue?: any,
): Promise<void> {
  const status: LogRow['status'] = result.ok ? 'success' : 'error';
  await pool.query(
    `UPDATE cortex_core.meta_actions_log
        SET status = $1,
            meta_error_json = $2,
            previous_value_json = COALESCE($3, previous_value_json),
            updated_at = NOW()
      WHERE id = $4`,
    [
      status,
      result.ok ? null : JSON.stringify(result.error ?? { message: 'unknown' }),
      previousValue != null ? JSON.stringify(previousValue) : null,
      logId,
    ],
  );
}

/**
 * Optimistic lock: transiciona uma proposta pending → executing.
 * Retorna a linha se conseguiu (nós "ganhamos" a corrida), null se outro
 * admin já pegou a proposta.
 */
async function claimPendingLog(
  logId: number,
  confirmerUserId: string,
): Promise<LogRow | null> {
  const res = await pool.query<LogRow>(
    `UPDATE cortex_core.meta_actions_log
        SET status = 'executing',
            confirmed_by_user_id = $1,
            confirmed_at = NOW(),
            updated_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING *`,
    [confirmerUserId, logId],
  );
  return res.rows[0] ?? null;
}

// ===================== ROUTER =====================

const router = Router();

router.use(isAuthenticated);
// Obs.: não aplicamos isAdmin no router inteiro — as rotas de execução
// (pause/resume/budget/bulk) usam `requireMetaWriter` (allowlist por e-mail),
// pois os operadores autorizados (Caio Malini, Vinicius Ichino) são role=user.

// ---------- GET /pending ----------
router.get('/pending', isAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query<LogRow>(
      `SELECT * FROM cortex_core.meta_actions_log
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT 200`,
    );
    res.json({ proposals: rows });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err).message });
  }
});

// ---------- GET /history ----------
router.get('/history', isAdmin, async (req, res) => {
  try {
    const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : null;
    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
    const params: any[] = [];
    let where = '';
    if (entityId) {
      params.push(entityId);
      where = `WHERE entity_id = $1`;
    }
    const { rows } = await pool.query<LogRow>(
      `SELECT * FROM cortex_core.meta_actions_log
         ${where}
         ORDER BY created_at DESC
         LIMIT ${limit}`,
      params,
    );
    res.json({ entries: rows });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err).message });
  }
});

// ---------- POST /:logId/ignore ----------
router.post('/:logId/ignore', isAdmin, async (req, res) => {
  try {
    const logId = parseInt(req.params.logId, 10);
    if (!Number.isFinite(logId)) return res.status(400).json({ error: 'logId inválido' });
    const user = (req as any).user;

    const result = await pool.query<LogRow>(
      `UPDATE cortex_core.meta_actions_log
          SET status = 'ignored',
              confirmed_by_user_id = $1,
              confirmed_at = NOW(),
              updated_at = NOW()
        WHERE id = $2 AND status = 'pending'
        RETURNING *`,
      [user.id, logId],
    );
    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'Proposta já foi processada' });
    }
    res.json({ ok: true, entry: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err).message });
  }
});

// ---------- Helper comum: resolve a ação (pause/resume/budget) =========

type ActionKind = 'pause' | 'resume' | 'budget_update';

async function executeAction(
  kind: ActionKind,
  params: {
    level: MetaEntityLevel;
    entityId: string;
    newDailyBudgetCents?: number;
  },
): Promise<{ result: MetaWriteResult; previousSnapshot: any }> {
  const snapshot = await readEntitySnapshot(params.level, params.entityId).catch((err) => {
    console.error('[metaActions] readEntitySnapshot failed:', sanitizeError(err).message);
    return null;
  });
  const previousSnapshot = snapshot
    ? {
        name: snapshot.name ?? null,
        status: snapshot.status ?? null,
        effective_status: snapshot.effectiveStatus ?? null,
        daily_budget_cents: snapshot.dailyBudgetCents ?? null,
      }
    : null;

  let result: MetaWriteResult;
  if (kind === 'pause') {
    result = await pauseEntity(params.level, params.entityId);
  } else if (kind === 'resume') {
    result = await resumeEntity(params.level, params.entityId);
  } else {
    if (params.level === 'ad') {
      result = {
        ok: false,
        status: 400,
        entityId: params.entityId,
        error: { code: 'INVALID_LEVEL', message: 'budget_update não suportado em nível ad' },
      };
    } else {
      result = await updateDailyBudget(
        params.level as 'adset' | 'campaign',
        params.entityId,
        params.newDailyBudgetCents!,
      );
    }
  }
  return { result, previousSnapshot };
}

// ---------- POST /pause ----------
router.post('/pause', requireMetaWriter, async (req, res) => {
  const parsed = pauseResumeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', details: parsed.error.issues });
  }
  await handleHumanOrConfirmation(req, res, 'pause', parsed.data, { status: 'PAUSED' });
});

// ---------- POST /resume ----------
router.post('/resume', requireMetaWriter, async (req, res) => {
  const parsed = pauseResumeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', details: parsed.error.issues });
  }
  await handleHumanOrConfirmation(req, res, 'resume', parsed.data, { status: 'ACTIVE' });
});

// ---------- POST /budget ----------
router.post('/budget', requireMetaWriter, async (req, res) => {
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', details: parsed.error.issues });
  }
  await handleHumanOrConfirmation(
    req,
    res,
    'budget_update',
    parsed.data,
    { daily_budget_cents: parsed.data.newDailyBudgetCents },
    parsed.data.newDailyBudgetCents,
  );
});

// ---------- POST /bulk ----------
// Ação manual em massa (pausar/ativar vários ad/adset/campaign de uma vez).
// Cada item gera seu próprio registro no audit trail e roda sequencialmente
// (respeita rate limit da Meta API). Retorna resultado por item.
router.post('/bulk', requireMetaWriter, async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', details: parsed.error.issues });
  }
  const { action, reason, items } = parsed.data;
  const user = (req as any).user;
  const kind: ActionKind = action === 'pause' ? 'pause' : 'resume';
  const payload = { status: action === 'pause' ? 'PAUSED' : 'ACTIVE' };

  const results: Array<{
    level: MetaEntityLevel;
    entityId: string;
    ok: boolean;
    logId: number;
    error?: string;
  }> = [];

  for (const item of items) {
    try {
      const logId = await insertLog({
        actorType: 'human',
        actorUserId: user.id,
        actorEmail: user.email,
        level: item.level,
        entityId: item.entityId,
        action: kind,
        payloadJson: payload,
        reason,
        status: 'executing',
        confirmedByUserId: user.id,
        confirmedAt: new Date(),
      });

      const { result, previousSnapshot } = await executeAction(kind, {
        level: item.level,
        entityId: item.entityId,
      });
      await finalizeLog(logId, result, previousSnapshot ?? result.previousValue);

      results.push({
        level: item.level,
        entityId: item.entityId,
        ok: result.ok,
        logId,
        error: result.ok ? undefined : result.error?.message,
      });
    } catch (err) {
      results.push({
        level: item.level,
        entityId: item.entityId,
        ok: false,
        logId: -1,
        error: sanitizeError(err).message,
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  res.json({ ok: okCount === results.length, okCount, total: results.length, results });
});

// ---------- POST /bulk-budget ----------
// Aumenta/diminui o orçamento diário de vários conjuntos/campanhas por um %.
// Cada item lê o valor atual no Meta, aplica o % e respeita os guard-rails (±30%, teto).
router.post('/bulk-budget', requireMetaWriter, async (req, res) => {
  const parsed = bulkBudgetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido', details: parsed.error.issues });
  }
  const { pct, reason, items } = parsed.data;
  const user = (req as any).user;

  const results: Array<{
    level: 'adset' | 'campaign';
    entityId: string;
    ok: boolean;
    logId: number;
    newDailyBudgetCents?: number | null;
    error?: string;
  }> = [];

  for (const item of items) {
    let logId = -1;
    try {
      logId = await insertLog({
        actorType: 'human',
        actorUserId: user.id,
        actorEmail: user.email,
        level: item.level,
        entityId: item.entityId,
        action: 'budget_update',
        payloadJson: { pct },
        reason,
        status: 'executing',
        confirmedByUserId: user.id,
        confirmedAt: new Date(),
      });

      const result = await increaseDailyBudgetByPct(item.level, item.entityId, pct);
      await finalizeLog(logId, result, result.previousValue);

      results.push({
        level: item.level,
        entityId: item.entityId,
        ok: result.ok,
        logId,
        newDailyBudgetCents: result.newValue?.daily_budget_cents ?? null,
        error: result.ok ? undefined : result.error?.message,
      });
    } catch (err) {
      results.push({ level: item.level, entityId: item.entityId, ok: false, logId, error: sanitizeError(err).message });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  res.json({ ok: okCount === results.length, okCount, total: results.length, results });
});

// ===================== CORE FLOW =====================

async function handleHumanOrConfirmation(
  req: Request,
  res: Response,
  kind: ActionKind,
  data: {
    level: MetaEntityLevel;
    entityId: string;
    reason: string;
    fromLogId?: number;
    newDailyBudgetCents?: number;
  },
  payload: Record<string, any>,
  newDailyBudgetCents?: number,
) {
  const user = (req as any).user;

  try {
    // --- Fluxo A: confirmação de proposta do agente (fromLogId presente) ---
    if (data.fromLogId) {
      const claimed = await claimPendingLog(data.fromLogId, user.id);
      if (!claimed) {
        return res.status(409).json({
          error: 'Proposta já foi processada por outro admin ou não está mais pendente',
        });
      }

      // Sanity check: proposta existente precisa bater com os parâmetros do request
      if (
        claimed.level !== data.level ||
        claimed.entity_id !== data.entityId ||
        claimed.action !== kind
      ) {
        await pool.query(
          `UPDATE cortex_core.meta_actions_log
              SET status = 'error',
                  meta_error_json = $1,
                  updated_at = NOW()
            WHERE id = $2`,
          [JSON.stringify({ message: 'Confirmation mismatch: proposal parameters differ from request' }), claimed.id],
        );
        return res.status(400).json({ error: 'Parâmetros da confirmação não batem com a proposta' });
      }

      const { result, previousSnapshot } = await executeAction(kind, {
        level: data.level,
        entityId: data.entityId,
        newDailyBudgetCents,
      });
      await finalizeLog(claimed.id, result, previousSnapshot ?? result.previousValue);

      return res.status(result.ok ? 200 : result.status).json({
        ok: result.ok,
        logId: claimed.id,
        result,
      });
    }

    // --- Fluxo B: ação manual do admin (sem proposta prévia) ---
    const logId = await insertLog({
      actorType: 'human',
      actorUserId: user.id,
      actorEmail: user.email,
      level: data.level,
      entityId: data.entityId,
      action: kind,
      payloadJson: payload,
      reason: data.reason,
      status: 'executing',
      confirmedByUserId: user.id,
      confirmedAt: new Date(),
    });

    const { result, previousSnapshot } = await executeAction(kind, {
      level: data.level,
      entityId: data.entityId,
      newDailyBudgetCents,
    });
    await finalizeLog(logId, result, previousSnapshot ?? result.previousValue);

    return res.status(result.ok ? 200 : result.status).json({
      ok: result.ok,
      logId,
      result,
    });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err).message });
  }
}

export default router;

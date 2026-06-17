/**
 * Meta Ads Write Service
 *
 * Camada isolada para operações de ESCRITA na Meta Marketing API:
 *   - pausar / reativar ad | adset | campaign
 *   - ajustar daily_budget de adset | campaign (com guard-rails)
 *
 * Nasce com as práticas que queremos no projeto inteiro (Bearer header,
 * sanitização de erro, v21.0), mas sem tocar no sync existente
 * (server/services/metaAdsSync.ts continua em v18 + query-string até a Fase 2).
 */

import { pool } from '../db';

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export type MetaEntityLevel = 'ad' | 'adset' | 'campaign';

export interface MetaWriteResult {
  ok: boolean;
  status: number;
  entityId: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  error?: {
    code?: number | string;
    subcode?: number | string;
    message: string;
    type?: string;
  };
}

export interface BudgetValidation {
  ok: boolean;
  reason?: string;
}

// Guard-rails de budget — unicos dois limites ativos na Fase 1.
export const BUDGET_MAX_DELTA_RATIO = 0.30;                // ±30% do valor atual

function getBudgetCeilingCents(): number {
  const raw = process.env.META_ADS_MAX_DAILY_BUDGET_CENTS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 100_000; // default: R$ 1.000,00/dia
}

function getAccessToken(): string {
  const token = process.env.ACCESS_TOKEN_META_SYSTEM;
  if (!token) throw new Error('ACCESS_TOKEN_META_SYSTEM não configurado');
  return token;
}

/**
 * Remove qualquer pedaço do access token de uma string/erro.
 * Aplicado antes de logar ou retornar mensagens ao cliente.
 */
export function sanitizeError(err: unknown): { message: string; raw?: any } {
  const token = process.env.ACCESS_TOKEN_META_SYSTEM || '';
  let message = err instanceof Error ? err.message : String(err);
  if (token && token.length > 8) {
    message = message.split(token).join('[REDACTED]');
  }
  message = message.replace(/access_token=[^&\s"}]+/gi, 'access_token=[REDACTED]');
  return { message };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch com Authorization header (nunca token em query string) + backoff
 * exponencial em erros transitórios (rate limit / user request limit reached).
 */
async function metaFetch(
  path: string,
  init: { method: 'GET' | 'POST'; bodyParams?: Record<string, string> } = { method: 'GET' },
): Promise<any> {
  const token = getAccessToken();
  const url = `${META_API_BASE}/${path}`;

  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let requestInit: RequestInit;
  if (init.method === 'POST') {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(init.bodyParams || {})) {
      body.set(k, v);
    }
    requestInit = {
      method: 'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    };
  } else {
    requestInit = { method: 'GET', headers: baseHeaders };
  }

  const backoffMs = [1000, 3000, 9000];
  let lastError: any;
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    const response = await fetch(url, requestInit);
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return { status: response.status, data };
    }

    const metaError = data?.error;
    const code = metaError?.code;
    const subcode = metaError?.error_subcode;
    const isTransient =
      code === 80004 || subcode === 80004 ||   // Too many calls on this ad object
      code === 613   || subcode === 613   ||   // Rate limit
      code === 4     ||                         // App-level throttling
      code === 17;                              // User request limit reached

    lastError = { status: response.status, data };

    if (isTransient && attempt < backoffMs.length) {
      await delay(backoffMs[attempt]);
      continue;
    }
    return lastError;
  }

  return lastError;
}

function mapErrorToResult(entityId: string, raw: any): MetaWriteResult {
  const err = raw?.data?.error || {};
  return {
    ok: false,
    status: raw?.status ?? 500,
    entityId,
    error: {
      code: err.code,
      subcode: err.error_subcode,
      message: sanitizeError(err.message || 'Unknown Meta API error').message,
      type: err.type,
    },
  };
}

// ===================== READ HELPERS (para snapshot "previous_value") =====================

async function getEntityStatus(level: MetaEntityLevel, id: string): Promise<{
  effectiveStatus?: string;
  status?: string;
  dailyBudgetCents?: number | null;
  name?: string;
}> {
  const fields = level === 'ad'
    ? 'id,name,status,effective_status'
    : 'id,name,status,effective_status,daily_budget';
  const res = await metaFetch(`${id}?fields=${fields}`, { method: 'GET' });
  if (res.status >= 400) {
    throw new Error(sanitizeError(res.data?.error?.message || `Meta GET ${id} failed (${res.status})`).message);
  }
  const d = res.data || {};
  return {
    name: d.name,
    status: d.status,
    effectiveStatus: d.effective_status,
    dailyBudgetCents: d.daily_budget != null ? parseInt(String(d.daily_budget), 10) : null,
  };
}

// ===================== LOCAL DB MIRROR =====================

async function mirrorStatusLocally(level: MetaEntityLevel, id: string, newEffectiveStatus: string): Promise<void> {
  try {
    if (level === 'ad') {
      await pool.query(
        `UPDATE meta_ads.meta_ads SET effective_status = $1, updated_time = NOW() WHERE ad_id = $2`,
        [newEffectiveStatus, id],
      );
    } else if (level === 'adset') {
      await pool.query(
        `UPDATE meta_ads.meta_adsets SET effective_status = $1, updated_time = NOW() WHERE adset_id = $2`,
        [newEffectiveStatus, id],
      );
    } else {
      await pool.query(
        `UPDATE meta_ads.meta_campaigns SET effective_status = $1, updated_time = NOW() WHERE campaign_id = $2`,
        [newEffectiveStatus, id],
      );
    }
  } catch (err) {
    console.error('[metaAdsWrite] failed to mirror status locally:', sanitizeError(err).message);
  }
}

async function mirrorBudgetLocally(level: 'adset' | 'campaign', id: string, newCents: number): Promise<void> {
  const newReais = newCents / 100;
  try {
    if (level === 'adset') {
      await pool.query(
        `UPDATE meta_ads.meta_adsets SET daily_budget = $1, updated_time = NOW() WHERE adset_id = $2`,
        [newReais, id],
      );
    } else {
      await pool.query(
        `UPDATE meta_ads.meta_campaigns SET daily_budget = $1, updated_time = NOW() WHERE campaign_id = $2`,
        [newReais, id],
      );
    }
  } catch (err) {
    console.error('[metaAdsWrite] failed to mirror budget locally:', sanitizeError(err).message);
  }
}

// ===================== PUBLIC WRITE API =====================

export async function pauseEntity(level: MetaEntityLevel, id: string): Promise<MetaWriteResult> {
  try {
    const before = await getEntityStatus(level, id);
    const res = await metaFetch(id, {
      method: 'POST',
      bodyParams: { status: 'PAUSED' },
    });
    if (res.status >= 400 || !res.data?.success) {
      return mapErrorToResult(id, res);
    }
    await mirrorStatusLocally(level, id, 'PAUSED');
    return {
      ok: true,
      status: res.status,
      entityId: id,
      previousValue: { status: before.status, effective_status: before.effectiveStatus, name: before.name },
      newValue: { status: 'PAUSED', effective_status: 'PAUSED' },
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      entityId: id,
      error: { message: sanitizeError(err).message },
    };
  }
}

export async function resumeEntity(level: MetaEntityLevel, id: string): Promise<MetaWriteResult> {
  try {
    const before = await getEntityStatus(level, id);
    const res = await metaFetch(id, {
      method: 'POST',
      bodyParams: { status: 'ACTIVE' },
    });
    if (res.status >= 400 || !res.data?.success) {
      return mapErrorToResult(id, res);
    }
    await mirrorStatusLocally(level, id, 'ACTIVE');
    return {
      ok: true,
      status: res.status,
      entityId: id,
      previousValue: { status: before.status, effective_status: before.effectiveStatus, name: before.name },
      newValue: { status: 'ACTIVE' },
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      entityId: id,
      error: { message: sanitizeError(err).message },
    };
  }
}

/**
 * Valida uma proposta de mudança de daily_budget contra dois guard-rails:
 *   1. |delta| <= 30% do valor atual
 *   2. valor absoluto <= META_ADS_MAX_DAILY_BUDGET_CENTS (default R$ 1.000/dia)
 */
export function validateBudgetChange(currentCents: number, newCents: number): BudgetValidation {
  if (!Number.isFinite(newCents) || newCents <= 0) {
    return { ok: false, reason: 'newDailyBudgetCents deve ser um inteiro positivo' };
  }
  const ceiling = getBudgetCeilingCents();
  if (newCents > ceiling) {
    return {
      ok: false,
      reason: `Valor acima do teto absoluto (R$ ${(ceiling / 100).toFixed(2)}/dia)`,
    };
  }
  if (currentCents > 0) {
    const delta = Math.abs(newCents - currentCents) / currentCents;
    if (delta > BUDGET_MAX_DELTA_RATIO) {
      return {
        ok: false,
        reason: `Delta acima de ±${BUDGET_MAX_DELTA_RATIO * 100}% do valor atual (atual: R$ ${(currentCents / 100).toFixed(2)}, proposto: R$ ${(newCents / 100).toFixed(2)})`,
      };
    }
  }
  return { ok: true };
}

export async function updateDailyBudget(
  level: 'adset' | 'campaign',
  id: string,
  newDailyBudgetCents: number,
): Promise<MetaWriteResult> {
  try {
    const before = await getEntityStatus(level, id);
    const currentCents = before.dailyBudgetCents ?? 0;

    const validation = validateBudgetChange(currentCents, newDailyBudgetCents);
    if (!validation.ok) {
      return {
        ok: false,
        status: 422,
        entityId: id,
        previousValue: { daily_budget_cents: currentCents, name: before.name },
        error: { code: 'BUDGET_GUARDRAIL', message: validation.reason || 'Budget change rejected' },
      };
    }

    const res = await metaFetch(id, {
      method: 'POST',
      bodyParams: { daily_budget: String(newDailyBudgetCents) },
    });
    if (res.status >= 400 || !res.data?.success) {
      return mapErrorToResult(id, res);
    }

    await mirrorBudgetLocally(level, id, newDailyBudgetCents);

    return {
      ok: true,
      status: res.status,
      entityId: id,
      previousValue: { daily_budget_cents: currentCents, name: before.name },
      newValue: { daily_budget_cents: newDailyBudgetCents },
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      entityId: id,
      error: { message: sanitizeError(err).message },
    };
  }
}

export async function readEntitySnapshot(level: MetaEntityLevel, id: string) {
  return getEntityStatus(level, id);
}

/**
 * Ajusta o orçamento diário por um percentual (+/-). Lê o valor atual no Meta,
 * calcula o novo (atual × (1 + pct/100)) e aplica via updateDailyBudget — herdando
 * os mesmos guard-rails (±30% por alteração e teto absoluto).
 */
export async function increaseDailyBudgetByPct(
  level: 'adset' | 'campaign',
  id: string,
  pct: number,
): Promise<MetaWriteResult> {
  try {
    const before = await getEntityStatus(level, id);
    const currentCents = before.dailyBudgetCents ?? 0;
    if (currentCents <= 0) {
      return {
        ok: false,
        status: 422,
        entityId: id,
        previousValue: { daily_budget_cents: currentCents, name: before.name },
        error: { code: 'NO_OWN_BUDGET', message: 'Entidade não tem orçamento diário próprio (CBO/ABO no outro nível)' },
      };
    }
    const newCents = Math.round(currentCents * (1 + pct / 100));
    const validation = validateBudgetChange(currentCents, newCents);
    if (!validation.ok) {
      return {
        ok: false,
        status: 422,
        entityId: id,
        previousValue: { daily_budget_cents: currentCents, name: before.name },
        error: { code: 'BUDGET_GUARDRAIL', message: validation.reason || 'Budget change rejected' },
      };
    }
    const res = await metaFetch(id, { method: 'POST', bodyParams: { daily_budget: String(newCents) } });
    if (res.status >= 400 || !res.data?.success) {
      return mapErrorToResult(id, res);
    }
    await mirrorBudgetLocally(level, id, newCents);
    return {
      ok: true,
      status: res.status,
      entityId: id,
      previousValue: { daily_budget_cents: currentCents, name: before.name },
      newValue: { daily_budget_cents: newCents },
    };
  } catch (err) {
    return { ok: false, status: 500, entityId: id, error: { message: sanitizeError(err).message } };
  }
}

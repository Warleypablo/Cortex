/**
 * Camada de ESCRITA do TikTok Ads — otimização de campanhas em produção.
 *
 * Complementa `tiktokAdsSync.ts` (só leitura). Usa a MESMA credencial do fluxo
 * "advertiser" (Marketing API, header `Access-Token`), lida de tiktok.credentials.
 *
 * Escopo: otimização, não criação. Três operações:
 *   - status  (ENABLE / DISABLE) em campaign / adgroup / ad
 *   - budget  (campanha ou adgroup, conforme onde o orçamento mora)
 *   - bid     (bid_price do adgroup)
 *
 * DELETE não é exposto de propósito: é irreversível no TikTok.
 *
 * ⚠️ Requer o app "Turbo Cortex" em PRODUÇÃO. Em Sandbox/Trial as chamadas de
 * escrita ou falham ou afetam apenas advertisers de teste — a leitura funciona
 * normalmente nos dois modos, então o sync não é sinal de que a escrita passa.
 *
 * Diferença importante pro Google: a Marketing API do TikTok NÃO tem `validateOnly`.
 * O dry-run daqui resolve o estado atual, roda todas as validações locais e devolve
 * o payload que SERIA enviado — sem POST. Cobre erro de id, de estado e de trava de
 * segurança, mas não valida regra de negócio do lado do TikTok (mínimo de orçamento
 * por objetivo, por exemplo). Um preview limpo aqui é bom sinal, não garantia.
 *
 * https://business-api.tiktok.com/portal/docs
 */

import type { Pool } from 'pg';
import { decryptToken } from '../utils/encryption';
import type { AdsLevel, AdsStatus, OptimizationAction, ActionResult } from './googleAdsWrite';

const TT_BIZ_API = 'https://business-api.tiktok.com/open_api/v1.3';

/** Conta de ads da própria Turbo — mesmo id que o sync usa. */
export const TURBO_ADVERTISER_ID = '7065303755092131842';

/** Mesmas travas de sanidade do Google (ver googleAdsWrite.ts). */
const MAX_BUDGET_FACTOR = 5;
const MAX_DAILY_BUDGET = 5000;

/** Nosso vocabulário unificado → vocabulário do TikTok. */
const STATUS_TO_TIKTOK: Record<AdsStatus, string> = {
  ENABLED: 'ENABLE',
  PAUSED: 'DISABLE',
};

/**
 * Volta pro vocabulário unificado. Importante pro `before` gravado na auditoria:
 * o undo lê esse campo e reenvia como ação, então ele PRECISA falar a mesma língua
 * do Google — senão o histórico vira dois dialetos e o desfazer quebra.
 * Status fora do par ENABLE/DISABLE (ex.: DELETE, ou um novo do TikTok) passa cru,
 * e o undo o rejeita adiante em vez de adivinhar.
 */
function statusFromTiktok(status: string): string {
  if (status === 'ENABLE') return 'ENABLED';
  if (status === 'DISABLE') return 'PAUSED';
  return status;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/**
 * O token do advertiser é longo mas NÃO tem refresh — quando expira, só o
 * re-consent em /api/oauth/tiktok/advertiser/start resolve. O erro 40001/40105
 * abaixo vira mensagem explícita pra não parecer bug genérico.
 */
export async function getAdvertiserToken(pool: Pool): Promise<string> {
  const res = await pool.query(
    `SELECT access_token_enc FROM tiktok.credentials
     WHERE kind = 'advertiser' AND active = TRUE ORDER BY id DESC LIMIT 1`,
  );
  if (!res.rows.length) {
    throw new Error(
      'Nenhuma credencial de advertiser TikTok ativa. Rode o consent em /api/oauth/tiktok/advertiser/start.',
    );
  }
  return decryptToken(res.rows[0].access_token_enc);
}

function ttHeaders(token: string) {
  return { 'Access-Token': token, 'Content-Type': 'application/json' };
}

/** O TikTok devolve HTTP 200 mesmo em erro — o que vale é `code !== 0`. */
function checkTiktokEnvelope(json: any, label: string): any {
  if (json?.code === 0) return json.data;
  const code = json?.code;
  const msg = json?.message || 'erro desconhecido';
  if (code === 40001 || code === 40105 || code === 40100) {
    throw new Error(
      `TikTok ${label}: token inválido ou expirado (code ${code}: ${msg}). ` +
        `O token de advertiser não tem refresh — refaça o consent em /api/oauth/tiktok/advertiser/start.`,
    );
  }
  if (code === 40002 && /permission|scope|auth/i.test(msg)) {
    throw new Error(
      `TikTok ${label}: sem permissão (code ${code}: ${msg}). ` +
        `Provável app ainda em Sandbox/Trial ou escopo de gestão de campanha não concedido.`,
    );
  }
  throw new Error(`TikTok ${label} (code ${code}): ${msg}`);
}

async function ttGet(path: string, token: string, params: Record<string, any>): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const res = await fetch(`${TT_BIZ_API}${path}?${qs.toString()}`, { headers: ttHeaders(token) });
  return checkTiktokEnvelope(await res.json().catch(() => ({})), `GET ${path}`);
}

async function ttPost(path: string, token: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(`${TT_BIZ_API}${path}`, {
    method: 'POST',
    headers: ttHeaders(token),
    body: JSON.stringify(body),
  });
  return checkTiktokEnvelope(await res.json().catch(() => ({})), `POST ${path}`);
}

// ---------------------------------------------------------------------------
// Resolução de entidades
// ---------------------------------------------------------------------------

export interface TiktokEntityState {
  id: string;
  name: string;
  /** ENABLE | DISABLE (vocabulário do TikTok). */
  status: string;
  budget: number | null;
  /** BUDGET_MODE_DAY | BUDGET_MODE_TOTAL | BUDGET_MODE_INFINITE */
  budgetMode: string | null;
  bidPrice: number | null;
}

/**
 * Lê o estado atual de uma entidade. Cada nível tem endpoint e nome de campo
 * próprios — o TikTok não uniformiza como o Google.
 */
export async function getTiktokEntityState(
  pool: Pool,
  level: AdsLevel,
  id: string,
  advertiserId: string = TURBO_ADVERTISER_ID,
): Promise<TiktokEntityState> {
  const token = await getAdvertiserToken(pool);

  if (level === 'campaign') {
    const data = await ttGet('/campaign/get/', token, {
      advertiser_id: advertiserId,
      filtering: { campaign_ids: [id] },
      page_size: 1,
    });
    const c = data?.list?.[0];
    if (!c) throw new Error(`Campanha ${id} não encontrada no advertiser ${advertiserId}`);
    return {
      id: String(c.campaign_id),
      name: c.campaign_name ?? `campanha ${id}`,
      status: c.operation_status,
      budget: c.budget != null ? Number(c.budget) : null,
      budgetMode: c.budget_mode ?? null,
      bidPrice: null,
    };
  }

  if (level === 'adgroup') {
    const data = await ttGet('/adgroup/get/', token, {
      advertiser_id: advertiserId,
      filtering: { adgroup_ids: [id] },
      page_size: 1,
    });
    const g = data?.list?.[0];
    if (!g) throw new Error(`Ad group ${id} não encontrado no advertiser ${advertiserId}`);
    return {
      id: String(g.adgroup_id),
      name: g.adgroup_name ?? `adgroup ${id}`,
      status: g.operation_status,
      budget: g.budget != null ? Number(g.budget) : null,
      budgetMode: g.budget_mode ?? null,
      bidPrice: g.bid_price != null ? Number(g.bid_price) : null,
    };
  }

  const data = await ttGet('/ad/get/', token, {
    advertiser_id: advertiserId,
    filtering: { ad_ids: [id] },
    page_size: 1,
  });
  const a = data?.list?.[0];
  if (!a) throw new Error(`Anúncio ${id} não encontrado no advertiser ${advertiserId}`);
  return {
    id: String(a.ad_id),
    name: a.ad_name ?? `ad ${id}`,
    status: a.operation_status,
    budget: null,
    budgetMode: null,
    bidPrice: null,
  };
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

const STATUS_ENDPOINT: Record<AdsLevel, { path: string; idsField: string }> = {
  campaign: { path: '/campaign/status/update/', idsField: 'campaign_ids' },
  adgroup: { path: '/adgroup/status/update/', idsField: 'adgroup_ids' },
  ad: { path: '/ad/status/update/', idsField: 'ad_ids' },
};

function guardBudget(current: number, next: number, entityName: string, force?: boolean): void {
  if (force) return;
  if (next <= 0) throw new Error(`Valor inválido (${next}) para "${entityName}" — precisa ser > 0.`);
  if (next > MAX_DAILY_BUDGET) {
    throw new Error(
      `Valor ${next.toFixed(2)} em "${entityName}" passa do teto de segurança (${MAX_DAILY_BUDGET}). Use force: true se for intencional.`,
    );
  }
  if (current > 0 && next > current * MAX_BUDGET_FACTOR) {
    throw new Error(
      `Aumento de ${current.toFixed(2)} → ${next.toFixed(2)} em "${entityName}" é mais de ${MAX_BUDGET_FACTOR}x. ` +
        `Use force: true se for intencional.`,
    );
  }
}

async function applyOne(
  pool: Pool,
  advertiserId: string,
  action: OptimizationAction,
  dryRun: boolean,
): Promise<ActionResult> {
  const token = await getAdvertiserToken(pool);
  const state = await getTiktokEntityState(pool, action.level as AdsLevel, action.id, advertiserId);

  if (action.type === 'set_status') {
    const target = STATUS_TO_TIKTOK[action.status];
    if (state.status === target) {
      return {
        action,
        ok: true,
        entityName: state.name,
        before: { status: statusFromTiktok(state.status) },
        after: { status: statusFromTiktok(state.status) },
      };
    }
    const ep = STATUS_ENDPOINT[action.level as AdsLevel];
    const body = {
      advertiser_id: advertiserId,
      [ep.idsField]: [action.id],
      operation_status: target,
    };
    if (!dryRun) await ttPost(ep.path, token, body);
    return {
      action,
      ok: true,
      entityName: state.name,
      before: { status: statusFromTiktok(state.status) },
      after: { status: action.status },
    };
  }

  if (action.type === 'set_budget') {
    // Orçamento infinito na campanha significa que quem manda é o adgroup —
    // mandar budget pra campanha nesse caso é erro silencioso de intenção.
    if (state.budgetMode === 'BUDGET_MODE_INFINITE') {
      throw new Error(
        `"${state.name}" está com orçamento ilimitado no nível de campanha — o orçamento real está nos ad groups. ` +
          `Ajuste no nível adgroup.`,
      );
    }
    guardBudget(state.budget ?? 0, action.amount, state.name, action.force);
    const path = action.level === 'campaign' ? '/campaign/update/' : '/adgroup/update/';
    const idField = action.level === 'campaign' ? 'campaign_id' : 'adgroup_id';
    const body = { advertiser_id: advertiserId, [idField]: action.id, budget: action.amount };
    if (!dryRun) await ttPost(path, token, body);
    return {
      action,
      ok: true,
      entityName: state.name,
      before: { budget: state.budget, budgetMode: state.budgetMode },
      after: { budget: action.amount },
    };
  }

  // set_bid — só existe em adgroup
  guardBudget(state.bidPrice ?? 0, action.amount, state.name, action.force);
  const body = { advertiser_id: advertiserId, adgroup_id: action.id, bid_price: action.amount };
  if (!dryRun) await ttPost('/adgroup/update/', token, body);
  return {
    action,
    ok: true,
    entityName: state.name,
    before: { bidPrice: state.bidPrice },
    after: { bidPrice: action.amount },
  };
}

/**
 * Aplica uma lista de ações. Mesma semântica do Google: cada ação é independente,
 * uma falha não impede as outras, execução sequencial.
 */
export async function applyTiktokActions(
  pool: Pool,
  actions: OptimizationAction[],
  opts: { dryRun?: boolean; advertiserId?: string } = {},
): Promise<ActionResult[]> {
  const dryRun = opts.dryRun ?? false;
  const advertiserId = opts.advertiserId ?? TURBO_ADVERTISER_ID;
  const results: ActionResult[] = [];
  for (const action of actions) {
    try {
      results.push(await applyOne(pool, advertiserId, action, dryRun));
    } catch (e: any) {
      results.push({ action, ok: false, error: e.message });
    }
  }
  return results;
}

/** Snapshot das campanhas direto da API — estado real de agora, não do último sync. */
export async function listTiktokCampaigns(
  pool: Pool,
  advertiserId: string = TURBO_ADVERTISER_ID,
): Promise<TiktokEntityState[]> {
  const token = await getAdvertiserToken(pool);
  const data = await ttGet('/campaign/get/', token, { advertiser_id: advertiserId, page_size: 100 });
  return (data?.list ?? []).map((c: any) => ({
    id: String(c.campaign_id),
    name: c.campaign_name ?? `campanha ${c.campaign_id}`,
    status: c.operation_status,
    budget: c.budget != null ? Number(c.budget) : null,
    budgetMode: c.budget_mode ?? null,
    bidPrice: null,
  }));
}

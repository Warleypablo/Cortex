/**
 * Otimização de mídia paga — Google Ads e TikTok Ads, interface única.
 *
 *  GET  /api/growth/ads-optimization/whoami            → o usuário pode operar?
 *  GET  /api/growth/ads-optimization/campaigns         → snapshot ao vivo (?channel=google|tiktok)
 *  POST /api/growth/ads-optimization/preview           → dry-run, não altera nada
 *  POST /api/growth/ads-optimization/execute           → aplica de verdade
 *  GET  /api/growth/ads-optimization/history           → últimas ações
 *  POST /api/growth/ads-optimization/undo/:batchId     → desfaz um lote executado
 *
 * Formato de ação (o MESMO nos dois canais — quem chama não precisa saber de
 * `updateMask` do Google nem de `operation_status` do TikTok):
 *
 *   { "type": "set_status", "level": "campaign", "id": "123", "status": "PAUSED" }
 *   { "type": "set_budget", "level": "campaign", "id": "123", "amount": 250.00 }
 *   { "type": "set_bid",    "level": "adgroup",  "id": "456", "amount": 1.80 }
 *
 * Toda ação — preview, execute ou falha — vai pra ads_ops.action_log.
 *
 * Escopo: otimização. Criação de campanha do zero NÃO passa por aqui (no Meta isso
 * mora em ads-creation.ts; em Google/TikTok ainda não existe).
 */

import type { Express, Request, Response } from 'express';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { requireEmail } from '../middleware/requireEmail';
import type { User } from '../auth/userDb';
import {
  applyGoogleActions,
  listGoogleCampaigns,
  TURBO_CUSTOMER_ID,
  type OptimizationAction,
  type ActionResult,
  type AdsLevel,
} from '../services/googleAdsWrite';
import { applyTiktokActions, listTiktokCampaigns, TURBO_ADVERTISER_ID } from '../services/tiktokWrite';

// Mesma lista das outras features que gastam dinheiro (creatives.ts, ads-creation.ts).
const APPROVER_EMAILS = [
  'vinicius.ichino@turbopartners.com.br',
  'warleyreserva4@gmail.com',
  'ferramentas@turbopartners.com.br',
];

type Channel = 'google' | 'tiktok';
const CHANNELS: Channel[] = ['google', 'tiktok'];
const LEVELS: AdsLevel[] = ['campaign', 'adgroup', 'ad'];
const ACTION_TYPES = ['set_status', 'set_budget', 'set_bid'];

/** Quantas ações um único lote aceita. Trava contra loop de agente. */
const MAX_ACTIONS_PER_BATCH = 50;

function makePool(): Pool {
  return new Pool({
    host: process.env.DB_HOST || process.env.DATABASE_HOST || '',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'dados_turbo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
    ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : { rejectUnauthorized: false },
  });
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

function parseChannel(v: unknown): Channel {
  if (typeof v !== 'string' || !CHANNELS.includes(v as Channel)) {
    throw new Error(`channel inválido — use um de: ${CHANNELS.join(', ')}`);
  }
  return v as Channel;
}

/**
 * Valida o payload ANTES de qualquer chamada de rede. Um `level` errado só
 * apareceria como 404 obscuro da API do canal, e um `amount` string viraria
 * NaN silencioso — os dois custam caro no meio de um lote.
 */
function parseActions(raw: unknown): OptimizationAction[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('actions deve ser um array não-vazio');
  }
  if (raw.length > MAX_ACTIONS_PER_BATCH) {
    throw new Error(`actions tem ${raw.length} itens — máximo por lote é ${MAX_ACTIONS_PER_BATCH}`);
  }

  return raw.map((a: any, i: number) => {
    const where = `actions[${i}]`;
    if (!a || typeof a !== 'object') throw new Error(`${where} deve ser objeto`);
    if (!ACTION_TYPES.includes(a.type)) {
      throw new Error(`${where}.type inválido — use um de: ${ACTION_TYPES.join(', ')}`);
    }
    if (!LEVELS.includes(a.level)) {
      throw new Error(`${where}.level inválido — use um de: ${LEVELS.join(', ')}`);
    }
    if (typeof a.id !== 'string' || !a.id.trim()) {
      throw new Error(`${where}.id deve ser string não-vazia`);
    }

    if (a.type === 'set_status') {
      if (a.status !== 'ENABLED' && a.status !== 'PAUSED') {
        throw new Error(`${where}.status deve ser ENABLED ou PAUSED`);
      }
      return { type: 'set_status', level: a.level, id: a.id.trim(), status: a.status };
    }

    if (typeof a.amount !== 'number' || !Number.isFinite(a.amount) || a.amount <= 0) {
      throw new Error(`${where}.amount deve ser número > 0`);
    }
    if (a.type === 'set_budget' && a.level === 'ad') {
      throw new Error(`${where}: orçamento não existe no nível de anúncio`);
    }
    if (a.type === 'set_bid' && a.level !== 'adgroup') {
      throw new Error(`${where}: lance só existe no nível adgroup`);
    }
    return {
      type: a.type,
      level: a.level,
      id: a.id.trim(),
      amount: a.amount,
      force: a.force === true,
    } as OptimizationAction;
  });
}

// ---------------------------------------------------------------------------
// Execução + auditoria
// ---------------------------------------------------------------------------

async function runActions(
  pool: Pool,
  channel: Channel,
  actions: OptimizationAction[],
  dryRun: boolean,
): Promise<{ results: ActionResult[]; accountId: string }> {
  if (channel === 'google') {
    return {
      results: await applyGoogleActions(TURBO_CUSTOMER_ID, actions, { validateOnly: dryRun }),
      accountId: TURBO_CUSTOMER_ID,
    };
  }
  return {
    results: await applyTiktokActions(pool, actions, { dryRun }),
    accountId: TURBO_ADVERTISER_ID,
  };
}

async function logActions(
  pool: Pool,
  channel: Channel,
  accountId: string,
  results: ActionResult[],
  dryRun: boolean,
  actorEmail: string,
  batchId: string,
): Promise<void> {
  for (const r of results) {
    try {
      await pool.query(
        `INSERT INTO ads_ops.action_log
           (channel, account_id, level, entity_id, entity_name, action_type,
            before_state, after_state, ok, error, dry_run, actor_email, batch_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          channel,
          accountId,
          r.action.level,
          r.action.id,
          r.entityName ?? null,
          r.action.type,
          r.before ? JSON.stringify(r.before) : null,
          r.after ? JSON.stringify(r.after) : null,
          r.ok,
          r.error ?? null,
          dryRun,
          actorEmail,
          batchId,
        ],
      );
    } catch (e: any) {
      // Falha de auditoria não pode derrubar a resposta: a ação no canal JÁ
      // aconteceu, e esconder isso do operador seria pior que perder a linha de log.
      console.error(`[ads-optimization] falha ao gravar auditoria (batch ${batchId}):`, e.message);
    }
  }
}

function actorEmailOf(req: Request): string {
  const user = req.user as User | undefined;
  return user?.email?.toLowerCase().trim() ?? 'desconhecido';
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

export function registerAdsOptimizationRoutes(app: Express) {
  const guard = requireEmail(APPROVER_EMAILS);

  app.get('/api/growth/ads-optimization/whoami', async (req: Request, res: Response) => {
    const email = actorEmailOf(req);
    res.json({ isApprover: APPROVER_EMAILS.some((e) => e.toLowerCase() === email) });
  });

  /** Snapshot ao vivo. Vem da API do canal, não do Postgres: quem vai mutar precisa
   *  do estado de agora, não do último sync (que pode ter horas). */
  app.get('/api/growth/ads-optimization/campaigns', guard, async (req: Request, res: Response) => {
    const pool = makePool();
    try {
      const channel = parseChannel(req.query.channel);
      if (channel === 'google') {
        const campaigns = await listGoogleCampaigns(TURBO_CUSTOMER_ID);
        res.json({ channel, accountId: TURBO_CUSTOMER_ID, campaigns });
      } else {
        const campaigns = await listTiktokCampaigns(pool);
        res.json({ channel, accountId: TURBO_ADVERTISER_ID, campaigns });
      }
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  /**
   * Dry-run. No Google usa validateOnly (o próprio Google valida e não aplica);
   * no TikTok resolve estado + travas locais sem POST. Ver tiktokWrite.ts sobre
   * o que o preview do TikTok NÃO cobre.
   */
  app.post('/api/growth/ads-optimization/preview', guard, async (req: Request, res: Response) => {
    const pool = makePool();
    try {
      const channel = parseChannel(req.body?.channel);
      const actions = parseActions(req.body?.actions);
      const batchId = randomUUID();

      const { results, accountId } = await runActions(pool, channel, actions, true);
      await logActions(pool, channel, accountId, results, true, actorEmailOf(req), batchId);

      res.json({
        dryRun: true,
        batchId,
        channel,
        accountId,
        total: results.length,
        okCount: results.filter((r) => r.ok).length,
        failCount: results.filter((r) => !r.ok).length,
        results,
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  app.post('/api/growth/ads-optimization/execute', guard, async (req: Request, res: Response) => {
    const pool = makePool();
    try {
      const channel = parseChannel(req.body?.channel);
      const actions = parseActions(req.body?.actions);
      const batchId = randomUUID();
      const actor = actorEmailOf(req);

      console.log(
        `[ads-optimization] EXECUTE ${channel} — ${actions.length} ação(ões) por ${actor} (batch ${batchId})`,
      );

      const { results, accountId } = await runActions(pool, channel, actions, false);
      await logActions(pool, channel, accountId, results, false, actor, batchId);

      const failCount = results.filter((r) => !r.ok).length;
      res.json({
        dryRun: false,
        batchId,
        channel,
        accountId,
        total: results.length,
        okCount: results.length - failCount,
        failCount,
        results,
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  app.get('/api/growth/ads-optimization/history', guard, async (req: Request, res: Response) => {
    const pool = makePool();
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 500);
      const channel = req.query.channel ? parseChannel(req.query.channel) : null;
      // Preview polui o histórico; por padrão mostra só o que mudou de verdade.
      const includeDryRun = req.query.includeDryRun === '1' || req.query.includeDryRun === 'true';

      const where: string[] = [];
      const params: any[] = [];
      if (channel) {
        params.push(channel);
        where.push(`channel = $${params.length}`);
      }
      if (!includeDryRun) where.push('dry_run = FALSE');
      params.push(limit);

      const result = await pool.query(
        `SELECT id, channel, account_id, level, entity_id, entity_name, action_type,
                before_state, after_state, ok, error, dry_run, actor_email, batch_id, created_at
         FROM ads_ops.action_log
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      res.json({ total: result.rows.length, actions: result.rows });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });

  /**
   * Desfaz um lote: relê o `before_state` de cada ação aplicada com sucesso e
   * reenvia como ação nova (não é rollback transacional — a API do canal não tem
   * isso). Gera um batch_id NOVO, então o undo também é auditado e reversível.
   *
   * Só considera linhas com ok=TRUE e dry_run=FALSE: preview não mudou nada e
   * ação que falhou não deixou estado pra desfazer.
   */
  app.post('/api/growth/ads-optimization/undo/:batchId', guard, async (req: Request, res: Response) => {
    const pool = makePool();
    try {
      const { batchId } = req.params;
      const rows = (
        await pool.query(
          `SELECT channel, level, entity_id, action_type, before_state
           FROM ads_ops.action_log
           WHERE batch_id = $1 AND ok = TRUE AND dry_run = FALSE
           ORDER BY id`,
          [batchId],
        )
      ).rows;

      if (!rows.length) {
        return res.status(404).json({ error: `Nenhuma ação aplicada encontrada no lote ${batchId}` });
      }

      const channel = rows[0].channel as Channel;
      if (rows.some((r) => r.channel !== channel)) {
        return res.status(400).json({ error: 'Lote mistura canais — desfazer manualmente' });
      }

      const inverse: OptimizationAction[] = [];
      const skipped: string[] = [];
      for (const r of rows) {
        const before = r.before_state ?? {};
        if (r.action_type === 'set_status') {
          if (before.status !== 'ENABLED' && before.status !== 'PAUSED') {
            skipped.push(`${r.level} ${r.entity_id}: status anterior "${before.status}" não é reversível`);
            continue;
          }
          inverse.push({ type: 'set_status', level: r.level, id: r.entity_id, status: before.status });
        } else if (r.action_type === 'set_budget') {
          if (typeof before.budget !== 'number' || before.budget <= 0) {
            skipped.push(`${r.level} ${r.entity_id}: orçamento anterior desconhecido`);
            continue;
          }
          // force: o valor anterior é por definição seguro — não faz sentido a trava
          // de "aumento > 5x" barrar a volta pro estado original.
          inverse.push({ type: 'set_budget', level: 'campaign', id: r.entity_id, amount: before.budget, force: true });
        } else if (r.action_type === 'set_bid') {
          if (typeof before.cpcBid !== 'number' && typeof before.bidPrice !== 'number') {
            skipped.push(`${r.level} ${r.entity_id}: lance anterior desconhecido`);
            continue;
          }
          const prev = (before.cpcBid ?? before.bidPrice) as number;
          inverse.push({ type: 'set_bid', level: 'adgroup', id: r.entity_id, amount: prev, force: true });
        }
      }

      if (!inverse.length) {
        return res.status(400).json({ error: 'Nada reversível neste lote', skipped });
      }

      const newBatchId = randomUUID();
      const actor = actorEmailOf(req);
      console.log(
        `[ads-optimization] UNDO do lote ${batchId} — ${inverse.length} ação(ões) por ${actor} (novo batch ${newBatchId})`,
      );

      const { results, accountId } = await runActions(pool, channel, inverse, false);
      await logActions(pool, channel, accountId, results, false, actor, newBatchId);

      const failCount = results.filter((r) => !r.ok).length;
      res.json({
        undoneBatchId: batchId,
        batchId: newBatchId,
        channel,
        accountId,
        total: results.length,
        okCount: results.length - failCount,
        failCount,
        skipped,
        results,
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    } finally {
      await pool.end();
    }
  });
}

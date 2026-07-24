/**
 * Camada de ESCRITA do Google Ads — otimização de campanhas em produção.
 *
 * Complementa `googleAdsSync.ts` (que só lê via GAQL). Deliberadamente NÃO importa
 * daquele módulo: ele é o caminho crítico da ingestão diária e não vale acoplar
 * leitura de dashboard com mutação que gasta dinheiro.
 *
 * Escopo: otimização, não criação. Três operações:
 *   - status  (ENABLED / PAUSED) em campaign / adGroup / adGroupAd
 *   - budget  (orçamento diário da campanha)
 *   - bid     (lance de CPC do ad group)
 *
 * REMOVED não é exposto de propósito: é irreversível na API do Google.
 *
 * Dry-run: a API tem `validateOnly` nativo — o Google valida a operação inteira
 * (permissão, limites, estado da entidade) e devolve erro sem aplicar nada. É o
 * mesmo caminho de código do execute, então o preview é fiel de verdade.
 *
 * Auth: mesmo par developer-token + refresh token OAuth já usado no sync. O escopo
 * OAuth do Google Ads (`.../auth/adwords`) é único e cobre leitura e escrita — não
 * existe variante read-only, então o token que sincroniza também muta.
 *
 * https://developers.google.com/google-ads/api/docs/mutating/overview
 */

import { google } from 'googleapis';
import { getGoogleAdsCredentials } from '../autoreport/credentials';

/**
 * Versão da API. O Google faz sunset de cada versão em ~1 ano e aí TUDO vira 404
 * silencioso. Confirmado ao vivo em 24/07/2026: v17–v19 mortas, v21+ vivas.
 * Para checar quando quebrar: `npx tsx scripts/probe-google-ads-version.ts`.
 *
 * ⚠️ `googleAdsSync.ts` e `autoreport/googleAds.ts` ainda apontam pra v18 (morta).
 * Não foram migrados aqui porque as queries deles usam campos que sumiram nas
 * versões novas (campaign.start_date, campaign.end_date, metrics.video_views) —
 * é correção à parte, não bump de constante.
 */
const API_VERSION = 'v24';
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

/**
 * Conta OPERACIONAL da Turbo Partners — é onde as campanhas da Turbo vivem.
 *
 * Não confundir com GOOGLE_ADS_LOGIN_CUSTOMER_ID (5156174278), que é a MCC
 * gerenciadora: ela não tem campanhas próprias e pendura centenas de contas de
 * CLIENTES. Escrever nela por engano atingiria campanha de cliente.
 */
export const TURBO_CUSTOMER_ID = '3795436039';

/**
 * Allowlist de contas onde a escrita é permitida. A MCC dá acesso a centenas de
 * contas de clientes com as MESMAS credenciais — um id errado (typo, agente em
 * loop, id vindo de request) pausaria campanha de cliente pagante. Leitura é
 * livre; mutação só aqui dentro.
 */
const WRITE_ALLOWED_CUSTOMER_IDS = new Set([TURBO_CUSTOMER_ID]);

/**
 * Trava de sanidade para orçamento. Um agente (ou um dedo errado) propondo 50x o
 * orçamento atual quase certamente é bug, não estratégia. Passa por cima com
 * `force: true` na ação — explícito, nunca por acidente.
 */
const MAX_BUDGET_FACTOR = 5;
/** Teto absoluto por campanha/dia, na moeda da conta (BRL). Mesma lógica acima. */
const MAX_DAILY_BUDGET = 5000;

export type AdsLevel = 'campaign' | 'adgroup' | 'ad';
export type AdsStatus = 'ENABLED' | 'PAUSED';

export type OptimizationAction =
  | { type: 'set_status'; level: AdsLevel; id: string; status: AdsStatus }
  | { type: 'set_budget'; level: 'campaign'; id: string; amount: number; force?: boolean }
  | { type: 'set_bid'; level: 'adgroup'; id: string; amount: number; force?: boolean };

export interface ActionResult {
  action: OptimizationAction;
  ok: boolean;
  /** Estado antes da mudança — o que permite desfazer depois. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Nome legível da entidade, pra log e pra UI. */
  entityName?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string> {
  const creds = getGoogleAdsCredentials();
  const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
  oauth2Client.setCredentials({ refresh_token: creds.refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('Google Ads: refresh do access token não retornou token');
  return credentials.access_token;
}

function cleanCustomerId(customerId: string): string {
  return customerId.replace(/\D/g, '');
}

/**
 * Erros da Google Ads API vêm num envelope aninhado (`error.details[].errors[]`)
 * cuja mensagem útil fica lá no fundo. Sem isso o usuário só vê "400 Bad Request".
 */
function extractGoogleAdsError(payload: any, fallback: string): string {
  const details = payload?.error?.details;
  if (Array.isArray(details)) {
    const msgs: string[] = [];
    for (const d of details) {
      for (const e of d?.errors ?? []) {
        const field = e?.location?.fieldPathElements
          ?.map((f: any) => f.fieldName)
          .filter(Boolean)
          .join('.');
        msgs.push(field ? `${e.message} (campo: ${field})` : e.message);
      }
    }
    if (msgs.length) {
      const joined = msgs.join(' | ');
      // MUTATE_NOT_ALLOWED sozinho parece falta de permissão, mas na prática é o
      // tipo da campanha que não aceita escrita via API (confirmado em 24/07/2026:
      // VIDEO recusa; SEARCH, PERFORMANCE_MAX, DISPLAY e DEMAND_GEN aceitam).
      if (/MUTATE_NOT_ALLOWED|Mutates are not allowed/i.test(joined)) {
        return `${joined} — este tipo de campanha (tipicamente VIDEO) não aceita alteração via API do Google; ajuste pela interface.`;
      }
      return joined;
    }
  }
  return payload?.error?.message || fallback;
}

async function gaql(customerId: string, query: string): Promise<any[]> {
  const creds = getGoogleAdsCredentials();
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/customers/${cleanCustomerId(customerId)}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': creds.developerToken,
      'login-customer-id': creds.loginCustomerId,
      'Content-Type': 'application/json',
    },
    // Sem pageSize: as versões novas rejeitam o parâmetro (PAGE_SIZE_NOT_SUPPORTED)
    // e fixam a página em 10.000 linhas.
    body: JSON.stringify({ query }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Ads GAQL ${res.status}: ${extractGoogleAdsError(json, res.statusText)}`);
  return json.results ?? [];
}

/**
 * Chamada :mutate genérica. `service` é o recurso no plural em camelCase
 * (campaigns, adGroups, adGroupAds, campaignBudgets).
 */
async function mutate(
  customerId: string,
  service: string,
  operations: any[],
  validateOnly: boolean,
): Promise<any> {
  const clean = cleanCustomerId(customerId);
  if (!WRITE_ALLOWED_CUSTOMER_IDS.has(clean)) {
    throw new Error(
      `Escrita bloqueada na conta ${clean}: fora da allowlist (${Array.from(WRITE_ALLOWED_CUSTOMER_IDS).join(', ')}). ` +
        `As credenciais alcançam contas de clientes via MCC — mutação só é liberada nas contas da própria Turbo.`,
    );
  }
  const creds = getGoogleAdsCredentials();
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/customers/${clean}/${service}:mutate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': creds.developerToken,
      'login-customer-id': creds.loginCustomerId,
      'Content-Type': 'application/json',
    },
    // partialFailure=false: a operação é toda-ou-nada. Numa ação de otimização
    // preferimos falhar inteiro e o operador reenviar do que aplicar metade.
    body: JSON.stringify({ operations, validateOnly, partialFailure: false }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google Ads ${service}:mutate ${res.status}: ${extractGoogleAdsError(json, res.statusText)}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Resolução de entidades (estado atual antes de mutar)
// ---------------------------------------------------------------------------

export interface CampaignState {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  budgetResourceName: string;
  budgetAmount: number;
  /** Orçamento compartilhado atinge VÁRIAS campanhas — mutar é perigoso. */
  budgetShared: boolean;
  /** SEARCH | VIDEO | PERFORMANCE_MAX | DISPLAY | DEMAND_GEN | ... */
  channelType: string;
  /** VIDEO não aceita mutação via API — saber disso antes evita chamada perdida. */
  mutable: boolean;
}

/**
 * Tipos que recusam mutação via API. Lista por exclusão (tudo é mutável menos
 * estes) porque o Google adiciona tipos novos com frequência, e chutar
 * "imutável" num tipo novo seria pior que tentar e receber o erro.
 * Confirmado ao vivo em 24/07/2026 na conta da Turbo.
 */
const NON_MUTABLE_CHANNEL_TYPES = new Set(['VIDEO']);

function isMutableChannelType(channelType: string | undefined): boolean {
  return !NON_MUTABLE_CHANNEL_TYPES.has(channelType ?? '');
}

export async function getCampaignState(customerId: string, campaignId: string): Promise<CampaignState> {
  const rows = await gaql(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.resource_name,
            campaign.advertising_channel_type,
            campaign_budget.resource_name, campaign_budget.amount_micros,
            campaign_budget.explicitly_shared
     FROM campaign
     WHERE campaign.id = ${Number(campaignId)}`,
  );
  if (!rows.length) throw new Error(`Campanha ${campaignId} não encontrada na conta ${customerId}`);
  const r = rows[0];
  return {
    resourceName: r.campaign.resourceName,
    id: String(r.campaign.id),
    name: r.campaign.name,
    status: r.campaign.status,
    budgetResourceName: r.campaignBudget.resourceName,
    budgetAmount: Number(r.campaignBudget.amountMicros) / 1_000_000,
    budgetShared: !!r.campaignBudget.explicitlyShared,
    channelType: r.campaign.advertisingChannelType ?? 'UNKNOWN',
    mutable: isMutableChannelType(r.campaign.advertisingChannelType),
  };
}

export interface AdGroupState {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  campaignName: string;
  cpcBid: number | null;
}

export async function getAdGroupState(customerId: string, adGroupId: string): Promise<AdGroupState> {
  const rows = await gaql(
    customerId,
    `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.resource_name,
            ad_group.cpc_bid_micros, campaign.name
     FROM ad_group
     WHERE ad_group.id = ${Number(adGroupId)}`,
  );
  if (!rows.length) throw new Error(`Ad group ${adGroupId} não encontrado na conta ${customerId}`);
  const r = rows[0];
  return {
    resourceName: r.adGroup.resourceName,
    id: String(r.adGroup.id),
    name: r.adGroup.name,
    status: r.adGroup.status,
    campaignName: r.campaign?.name ?? '',
    cpcBid: r.adGroup.cpcBidMicros ? Number(r.adGroup.cpcBidMicros) / 1_000_000 : null,
  };
}

export interface AdState {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  adGroupName: string;
}

/**
 * O resourceName de um anúncio é `adGroupAds/{adGroupId}~{adId}` — precisa dos DOIS
 * ids. Como o operador só tem o id do anúncio em mãos, resolvemos via GAQL.
 */
export async function getAdState(customerId: string, adId: string): Promise<AdState> {
  const rows = await gaql(
    customerId,
    `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status,
            ad_group_ad.resource_name, ad_group.name
     FROM ad_group_ad
     WHERE ad_group_ad.ad.id = ${Number(adId)}`,
  );
  if (!rows.length) throw new Error(`Anúncio ${adId} não encontrado na conta ${customerId}`);
  const r = rows[0];
  return {
    resourceName: r.adGroupAd.resourceName,
    id: String(r.adGroupAd.ad.id),
    // Anúncio no Google costuma não ter nome; cai pro id pra não logar string vazia.
    name: r.adGroupAd.ad.name || `ad ${r.adGroupAd.ad.id}`,
    status: r.adGroupAd.status,
    adGroupName: r.adGroup?.name ?? '',
  };
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

/** Mapa nível → (serviço :mutate, resolvedor de estado). */
const LEVEL_SERVICE: Record<AdsLevel, string> = {
  campaign: 'campaigns',
  adgroup: 'adGroups',
  ad: 'adGroupAds',
};

async function resolveState(customerId: string, level: AdsLevel, id: string) {
  if (level === 'campaign') {
    const s = await getCampaignState(customerId, id);
    return { resourceName: s.resourceName, name: s.name, status: s.status, extra: s };
  }
  if (level === 'adgroup') {
    const s = await getAdGroupState(customerId, id);
    return { resourceName: s.resourceName, name: s.name, status: s.status, extra: s };
  }
  const s = await getAdState(customerId, id);
  return { resourceName: s.resourceName, name: s.name, status: s.status, extra: s };
}

async function applyOne(
  customerId: string,
  action: OptimizationAction,
  validateOnly: boolean,
): Promise<ActionResult> {
  if (action.type === 'set_status') {
    const state = await resolveState(customerId, action.level, action.id);
    if (state.status === action.status) {
      // Não é erro — só não vale gastar uma operação de quota pra não mudar nada.
      return {
        action,
        ok: true,
        entityName: state.name,
        before: { status: state.status },
        after: { status: state.status },
        error: undefined,
      };
    }
    await mutate(
      customerId,
      LEVEL_SERVICE[action.level],
      [{ update: { resourceName: state.resourceName, status: action.status }, updateMask: 'status' }],
      validateOnly,
    );
    return {
      action,
      ok: true,
      entityName: state.name,
      before: { status: state.status },
      after: { status: action.status },
    };
  }

  if (action.type === 'set_budget') {
    const state = await getCampaignState(customerId, action.id);
    if (state.budgetShared && !action.force) {
      throw new Error(
        `Campanha "${state.name}" usa orçamento COMPARTILHADO — alterar afeta todas as campanhas ligadas a ele. ` +
          `Reenvie com force: true se é isso mesmo que você quer.`,
      );
    }
    guardBudget(state.budgetAmount, action.amount, state.name, action.force);
    await mutate(
      customerId,
      'campaignBudgets',
      [
        {
          update: {
            resourceName: state.budgetResourceName,
            amountMicros: String(Math.round(action.amount * 1_000_000)),
          },
          // updateMask usa snake_case (field path do proto), não camelCase.
          updateMask: 'amount_micros',
        },
      ],
      validateOnly,
    );
    return {
      action,
      ok: true,
      entityName: state.name,
      before: { budget: state.budgetAmount, budgetShared: state.budgetShared },
      after: { budget: action.amount },
    };
  }

  // set_bid
  const state = await getAdGroupState(customerId, action.id);
  guardBudget(state.cpcBid ?? 0, action.amount, state.name, action.force);
  await mutate(
    customerId,
    'adGroups',
    [
      {
        update: {
          resourceName: state.resourceName,
          cpcBidMicros: String(Math.round(action.amount * 1_000_000)),
        },
        updateMask: 'cpc_bid_micros',
      },
    ],
    validateOnly,
  );
  return {
    action,
    ok: true,
    entityName: state.name,
    before: { cpcBid: state.cpcBid },
    after: { cpcBid: action.amount },
  };
}

/**
 * Trava de sanidade compartilhada por budget e bid. Só bloqueia aumento — reduzir
 * ou pausar nunca queima dinheiro, então não precisa de cerimônia.
 */
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

/**
 * Aplica uma lista de ações. Cada uma é independente: uma falha não impede as
 * outras (ao contrário do partialFailure DENTRO de uma operação, que é all-or-nothing).
 * Sempre sequencial — a quota do Google é por operação e paralelizar só antecipa
 * rate limit sem ganho real nesse volume.
 */
export async function applyGoogleActions(
  customerId: string,
  actions: OptimizationAction[],
  opts: { validateOnly?: boolean } = {},
): Promise<ActionResult[]> {
  const validateOnly = opts.validateOnly ?? false;
  const results: ActionResult[] = [];
  for (const action of actions) {
    try {
      results.push(await applyOne(customerId, action, validateOnly));
    } catch (e: any) {
      results.push({ action, ok: false, error: e.message });
    }
  }
  return results;
}

/**
 * Snapshot das campanhas ativas da conta, direto da API (não do Postgres) — quem
 * vai mutar precisa do estado REAL de agora, não do último sync.
 */
export async function listGoogleCampaigns(customerId: string): Promise<CampaignState[]> {
  const rows = await gaql(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.resource_name,
            campaign.advertising_channel_type,
            campaign_budget.resource_name, campaign_budget.amount_micros,
            campaign_budget.explicitly_shared
     FROM campaign
     WHERE campaign.status IN ('ENABLED', 'PAUSED')
     ORDER BY campaign.name`,
  );
  return rows.map((r) => ({
    resourceName: r.campaign.resourceName,
    id: String(r.campaign.id),
    name: r.campaign.name,
    status: r.campaign.status,
    budgetResourceName: r.campaignBudget.resourceName,
    budgetAmount: Number(r.campaignBudget.amountMicros) / 1_000_000,
    budgetShared: !!r.campaignBudget.explicitlyShared,
    channelType: r.campaign.advertisingChannelType ?? 'UNKNOWN',
    mutable: isMutableChannelType(r.campaign.advertisingChannelType),
  }));
}

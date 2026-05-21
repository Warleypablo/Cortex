import type { AdsExecutor, EntityType } from "./types";

const META_API_VERSION = "v18.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const ALLOWED_OPERATIONS = new Set(["pause", "reactivate"]);
const RATE_LIMIT_ERROR_CODES = new Set([4, 17, 80004]);
const MAX_RETRIES = 3;
const BACKOFF_MS = [30_000, 60_000, 120_000];

function getAccessToken(): string {
  const token = process.env.ACCESS_TOKEN_META_SYSTEM;
  if (!token) throw new Error("ACCESS_TOKEN_META_SYSTEM não configurado");
  return token;
}

interface MetaApiError {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  type?: string;
}

async function metaCall(
  entityId: string,
  method: "GET" | "POST",
  params: Record<string, string>,
): Promise<any> {
  const url = new URL(`${META_API_BASE}/${entityId}`);
  url.searchParams.set("access_token", getAccessToken());

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    if (method === "GET") {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      response = await fetch(url.toString());
    } else {
      const body = new URLSearchParams(params);
      response = await fetch(url.toString(), {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    }

    if (response.ok) return response.json();

    const errorData = await response.json().catch(() => ({}));
    const error: MetaApiError = errorData.error || {};

    if (error.code && RATE_LIMIT_ERROR_CODES.has(error.code) && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      continue;
    }

    const msg = error.error_user_msg || error.message || response.statusText;
    throw new Error(`Meta API ${response.status} (code=${error.code ?? "?"}): ${msg}`);
  }
  throw new Error("Meta API: retries exhausted");
}

export class MetaGraphExecutor implements AdsExecutor {
  async getEntityStatus(_entityType: EntityType, entityId: string): Promise<string> {
    const data = await metaCall(entityId, "GET", { fields: "status,effective_status" });
    return data.status || data.effective_status || "UNKNOWN";
  }

  async pauseCampaign(id: string): Promise<void> {
    await this.setStatus(id, "PAUSED");
  }
  async pauseAdSet(id: string): Promise<void> {
    await this.setStatus(id, "PAUSED");
  }
  async pauseAd(id: string): Promise<void> {
    await this.setStatus(id, "PAUSED");
  }
  async reactivateCampaign(id: string): Promise<void> {
    await this.setStatus(id, "ACTIVE");
  }
  async reactivateAdSet(id: string): Promise<void> {
    await this.setStatus(id, "ACTIVE");
  }
  async reactivateAd(id: string): Promise<void> {
    await this.setStatus(id, "ACTIVE");
  }

  private async setStatus(entityId: string, status: "PAUSED" | "ACTIVE"): Promise<void> {
    await metaCall(entityId, "POST", { status });
  }
}

/**
 * Executa uma ação contra o executor com defesa em profundidade:
 *  - Allowlist de operações (R10).
 *  - Verificação de whitelist (R7) — protected entities never executed.
 *  - Verificação de status atual antes de bater na API (R3) — evita no-op.
 */
export async function executeAction(args: {
  executor: AdsExecutor;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  action: "pause" | "reactivate" | "skip";
  isWhitelisted: boolean;
}): Promise<{ status: "executed" | "skipped" | "noop"; note?: string }> {
  const { executor, entityType, entityId, entityName, action, isWhitelisted } = args;

  if (action === "skip") {
    return { status: "skipped", note: "skipped by user" };
  }

  if (!ALLOWED_OPERATIONS.has(action)) {
    throw new Error(`Operação não permitida: ${action}`);
  }

  if (isWhitelisted) {
    throw new Error(`Entidade ${entityName} (${entityId}) está na whitelist de protegidas`);
  }

  const targetStatus = action === "pause" ? "PAUSED" : "ACTIVE";
  const currentStatus = await executor.getEntityStatus(entityType, entityId);
  if (currentStatus === targetStatus) {
    return { status: "noop", note: `already ${targetStatus}` };
  }

  if (action === "pause") {
    if (entityType === "campaign") await executor.pauseCampaign(entityId);
    else if (entityType === "adset") await executor.pauseAdSet(entityId);
    else await executor.pauseAd(entityId);
  } else {
    if (entityType === "campaign") await executor.reactivateCampaign(entityId);
    else if (entityType === "adset") await executor.reactivateAdSet(entityId);
    else await executor.reactivateAd(entityId);
  }
  return { status: "executed" };
}

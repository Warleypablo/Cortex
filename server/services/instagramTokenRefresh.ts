// Classificação e renovação automática de tokens long-lived do Instagram.
//
// Contexto: tokens long-lived do Instagram Graph API duram ~60 dias e PODEM ser
// renovados (estendidos por mais 60 dias) enquanto ainda são válidos, via
// `ig_refresh_token`. Um token JÁ EXPIRADO não pode ser renovado — exige
// reconexão manual via OAuth. Por isso renovamos proativamente dentro de uma
// janela (default 15 dias antes de expirar).

import type { InsertNotification } from "../../shared/schema";

export type IgTokenStatus = "healthy" | "needs_refresh" | "expired" | "unknown";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Classifica o estado de um token a partir da sua data de expiração.
 * - `unknown`      → sem data de expiração registrada
 * - `expired`      → já expirou (não renovável; precisa reconectar)
 * - `needs_refresh`→ expira dentro de `refreshWithinDays` (renovar agora)
 * - `healthy`      → expira bem depois da janela
 */
export function classifyTokenStatus(
  expiresAt: Date | null | undefined,
  now: Date,
  refreshWithinDays = 15,
): IgTokenStatus {
  if (!expiresAt) return "unknown";
  const msLeft = expiresAt.getTime() - now.getTime();
  if (msLeft <= 0) return "expired";
  const daysLeft = msLeft / MS_PER_DAY;
  if (daysLeft <= refreshWithinDays) return "needs_refresh";
  return "healthy";
}

export type TokenAlertReason = "expired" | "refresh_failed";

export interface TokenAlertInput {
  connectionId: number;
  username: string;
  clienteCnpj: string;
  reason: TokenAlertReason;
  /** Data UTC no formato YYYY-MM-DD — compõe a uniqueKey diária (dedup por dia). */
  today: string;
  /** Detalhe opcional do erro (ex.: mensagem da Graph API), só usado em refresh_failed. */
  detail?: string;
}

/**
 * Monta a notificação in-app para um problema de token. Função pura: a data do dia
 * é injetada (`today`) para manter a uniqueKey determinística — uma notificação por
 * conexão, por motivo, por dia, evitando flood a cada execução do job.
 */
export function buildExpiryAlert(input: TokenAlertInput): InsertNotification {
  const { connectionId, username, clienteCnpj, reason, today, detail } = input;
  const common = {
    entityId: String(connectionId),
    entityType: "instagram_connection",
    priority: "high" as const,
  };

  if (reason === "expired") {
    return {
      ...common,
      type: "instagram_token_expired",
      title: `Instagram desconectado: @${username}`,
      message: `O token de @${username} (CNPJ ${clienteCnpj}) expirou e a sincronização parou. Reconecte a conta em Growth › Instagram para retomar a coleta de métricas.`,
      uniqueKey: `ig-token-expired-${connectionId}-${today}`,
    };
  }

  return {
    ...common,
    type: "instagram_token_refresh_failed",
    title: `Falha ao renovar token do Instagram: @${username}`,
    message:
      `Não foi possível renovar automaticamente o token de @${username} (CNPJ ${clienteCnpj})` +
      `${detail ? `: ${detail}` : ""}. Se persistir, reconecte a conta em Growth › Instagram.`,
    uniqueKey: `ig-token-refresh-failed-${connectionId}-${today}`,
  };
}

export interface RefreshConnection {
  id: number;
  username: string;
  clienteCnpj: string;
  accessTokenEnc: string;
  tokenExpiresAt: Date | null;
}

export interface RefreshDeps {
  now: Date;
  connections: RefreshConnection[];
  /** Janela (em dias) para renovação proativa. Default 15. */
  refreshWithinDays?: number;
  decrypt: (enc: string) => string;
  encrypt: (plain: string) => string;
  refresh: (token: string) => Promise<{ accessToken: string; expiresIn: number }>;
  persist: (id: number, newEnc: string, newExpiresAt: Date) => Promise<void>;
}

export interface RefreshReport {
  healthy: number;
  unknown: number;
  refreshed: number[];
  alerts: TokenAlertInput[];
}

/**
 * Percorre as conexões e, para cada uma:
 * - `healthy`/`unknown` → apenas contabiliza;
 * - `needs_refresh`     → renova (decripta → refresh → re-encripta → persiste). Em falha,
 *                          gera um alerta `refresh_failed`;
 * - `expired`           → NÃO tenta renovar (a Graph API não renova token expirado),
 *                          gera um alerta `expired` pedindo reconexão manual.
 *
 * Efeitos (rede/DB/cripto) são injetados via `deps` para manter a função testável.
 */
export async function refreshExpiringTokens(deps: RefreshDeps): Promise<RefreshReport> {
  const { now, connections, refreshWithinDays } = deps;
  const today = now.toISOString().split("T")[0];
  const report: RefreshReport = { healthy: 0, unknown: 0, refreshed: [], alerts: [] };

  for (const conn of connections) {
    const status = classifyTokenStatus(conn.tokenExpiresAt, now, refreshWithinDays);

    if (status === "healthy") {
      report.healthy++;
      continue;
    }
    if (status === "unknown") {
      report.unknown++;
      continue;
    }
    if (status === "expired") {
      report.alerts.push({
        connectionId: conn.id,
        username: conn.username,
        clienteCnpj: conn.clienteCnpj,
        reason: "expired",
        today,
      });
      continue;
    }

    // needs_refresh
    try {
      const token = deps.decrypt(conn.accessTokenEnc);
      const { accessToken, expiresIn } = await deps.refresh(token);
      const newExpiresAt = new Date(now.getTime() + expiresIn * 1000);
      await deps.persist(conn.id, deps.encrypt(accessToken), newExpiresAt);
      report.refreshed.push(conn.id);
    } catch (err) {
      report.alerts.push({
        connectionId: conn.id,
        username: conn.username,
        clienteCnpj: conn.clienteCnpj,
        reason: "refresh_failed",
        today,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return report;
}

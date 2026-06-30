/**
 * Status da API de Marketing do Meta: faz 1 GET barato na conta e lê os headers de uso
 * (x-business-use-case-usage / x-ad-account-usage) — call_count / total_cputime / total_time
 * (cada 0-100%) e estimated_time_to_regain_access (min até liberar se estourou).
 *   npx tsx status-meta-api.ts
 */
import "dotenv/config";
import { getMetaAdsCredentials } from "../../server/autoreport/credentials";

const VER = "v18.0";
const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;

(async () => {
  const token = getMetaAdsCredentials().accessToken;
  const url = new URL(`https://graph.facebook.com/${VER}/${ACC}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", "id,name,account_status,disable_reason,amount_spent,currency,balance");
  const res = await fetch(url.toString());
  const body = await res.json().catch(() => ({}));

  console.log(`HTTP ${res.status} ${res.ok ? "OK" : "ERRO"}  ·  API ${VER}`);
  if (res.ok) {
    console.log(`Conta: ${body.name} (${body.id}) · status=${body.account_status} (1=ativa) · disable_reason=${body.disable_reason ?? 0}`);
    if (body.amount_spent != null) console.log(`Gasto acumulado: ${(Number(body.amount_spent) / 100).toFixed(2)} ${body.currency ?? ""} · saldo: ${body.balance != null ? (Number(body.balance) / 100).toFixed(2) : "—"}`);
  } else {
    console.log(`Erro: code=${body?.error?.code} sub=${body?.error?.error_subcode} — ${body?.error?.message}`);
  }

  const fmtHeader = (name: string) => {
    const h = res.headers.get(name);
    if (!h) return;
    console.log(`\n[${name}]`);
    try {
      const parsed = JSON.parse(h);
      // x-ad-account-usage tem forma { acc_id_util_pct, reset_time_duration, ... }
      if (parsed.acc_id_util_pct != null || parsed.reset_time_duration != null) {
        console.log(`  acc_id_util_pct=${parsed.acc_id_util_pct}%  reset_em=${parsed.reset_time_duration ?? "?"}s  ads_api_access_tier=${parsed.ads_api_access_tier ?? "?"}`);
        return;
      }
      for (const accId of Object.keys(parsed)) {
        const arr = Array.isArray(parsed[accId]) ? parsed[accId] : [parsed[accId]];
        for (const e of arr) {
          const max = Math.max(e.call_count ?? 0, e.total_cputime ?? 0, e.total_time ?? 0);
          const bar = "█".repeat(Math.round(max / 5)).padEnd(20, "░");
          console.log(`  ${accId} ${e.type ? `[${e.type}] ` : ""}${bar} ${max}%  (call=${e.call_count} cpu=${e.total_cputime} time=${e.total_time})  liberar em ${e.estimated_time_to_regain_access ?? 0}min`);
        }
      }
    } catch { console.log(`  (raw) ${h}`); }
  };
  fmtHeader("x-business-use-case-usage");
  fmtHeader("x-ad-account-usage");
  fmtHeader("x-app-usage");
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });

/**
 * Sync incremental de UTMs do Bitrix24 → "Bitrix".crm_deal.
 *
 * Por quê: os campos utm_source/utm_medium/utm_campaign/utm_term/utm_content NÃO são
 * tocados pelo refresh de funil (sync-bitrix-deals.ts) nem por nenhum outro job in-repo.
 * Historicamente vinham só de um pull externo pesado (bitrix/puxardados.py) que puxava
 * ~20k deals de uma vez e, em sessões longas, morria no rate limit do Bitrix (2 req/s),
 * deixando dias de leads sem UTM → funis de canal pago (Creators×Meta etc.) colapsavam
 * artificialmente e o CPMQL inflava.
 *
 * Este job resolve isso rodando DENTRO do scheduler do Node, de forma incremental:
 *  - só uma janela móvel recente (sinceDays), então cada rodada é pequena (poucas
 *    páginas de 50) e NÃO tem como estourar o rate limit;
 *  - throttle de >= 550ms entre requisições + retry com backoff em 503/rate limit;
 *  - preenche SOMENTE onde utm_campaign está vazio (idempotente; nunca sobrescreve).
 *
 * Usa BITRIX_WEBHOOK_URL (escopo crm). Uso manual: npx tsx scripts/run-bitrix-utm-sync.ts
 */
import { pool } from "../db";

const PAGE_SIZE = 50; // default do Bitrix
const MIN_REQUEST_INTERVAL_MS = 550; // ~1.8 req/s, folga sob o teto de 2 req/s

let lastRequestAt = 0;
async function throttle() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

/** POST no webhook com throttle + retry/backoff em rate limit (QUERY_LIMIT_EXCEEDED / 503). */
async function bx<T = any>(base: string, method: string, body: unknown, maxRetries = 6): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await throttle();
    try {
      const r = await fetch(`${base}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: any = await r.json().catch(() => ({}));
      const rateLimited =
        r.status === 503 || r.status === 429 || data?.error === "QUERY_LIMIT_EXCEEDED";
      if (rateLimited && attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, Math.min(1000 * 2 ** attempt, 15000)));
        continue;
      }
      if (!r.ok) throw new Error(`${method} failed: ${r.status}`);
      if (data.error) throw new Error(`${method}: ${data.error_description || data.error}`);
      return data as T;
    } catch (e) {
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, Math.min(1000 * 2 ** attempt, 15000)));
        continue;
      }
      throw e;
    }
  }
}

export async function syncBitrixUtm(
  opts: { verbose?: boolean; sinceDays?: number } = {},
): Promise<{ totalSeen: number; comUtm: number; atualizados: number }> {
  const log = opts.verbose ? (m: string) => console.log(m) : () => {};
  const base = (process.env.BITRIX_WEBHOOK_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("BITRIX_WEBHOOK_URL não configurada");

  const sinceDays = opts.sinceDays ?? 14;
  // Wall-clock do portal (UTC+3), formato que a API do Bitrix filtra.
  const desde = new Date(Date.now() + 3 * 3600_000 - sinceDays * 86_400_000)
    .toISOString()
    .slice(0, 19); // "YYYY-MM-DDTHH:MM:SS"
  log(`→ UTMs de deals criados desde ${desde} (janela ${sinceDays}d)`);

  // 1. Coleta paginada só dos campos de UTM.
  const rows: any[] = [];
  let start = 0;
  while (true) {
    const page = await bx<{ result: any[]; next?: number; total?: number }>(base, "crm.deal.list", {
      filter: { ">=DATE_CREATE": desde },
      select: ["ID", "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN", "UTM_TERM", "UTM_CONTENT"],
      order: { DATE_CREATE: "ASC" },
      start,
    });
    const res = page.result || [];
    rows.push(...res);
    log(`  página start=${start}: ${res.length} (visto: ${rows.length}/${page.total ?? "?"})`);
    if (page.next === undefined || res.length === 0) break;
    start = page.next;
  }

  const comUtm = rows.filter((d) => d.UTM_SOURCE || d.UTM_CAMPAIGN || d.UTM_CONTENT);
  if (comUtm.length === 0) {
    log("  nenhum deal com UTM na janela — nada a atualizar");
    return { totalSeen: rows.length, comUtm: 0, atualizados: 0 };
  }

  // 2. UPDATE preenchendo só onde utm_campaign está vazio (idempotente).
  const client = await pool.connect();
  try {
    await client.query(`SET lock_timeout='8s'`);
    await client.query(`SET statement_timeout='60s'`);
    const r = await client.query(
      `UPDATE "Bitrix".crm_deal t
       SET utm_source=v.s, utm_medium=v.m, utm_campaign=v.cp, utm_term=v.te, utm_content=v.co
       FROM (SELECT unnest($1::bigint[]) id, unnest($2::text[]) s, unnest($3::text[]) m,
                    unnest($4::text[]) cp, unnest($5::text[]) te, unnest($6::text[]) co) v
       WHERE t.id=v.id AND (t.utm_campaign IS NULL OR t.utm_campaign='')`,
      [
        comUtm.map((d) => Number(d.ID)),
        comUtm.map((d) => d.UTM_SOURCE || null),
        comUtm.map((d) => d.UTM_MEDIUM || null),
        comUtm.map((d) => d.UTM_CAMPAIGN || null),
        comUtm.map((d) => d.UTM_TERM || null),
        comUtm.map((d) => d.UTM_CONTENT || null),
      ],
    );
    log(`  atualizados: ${r.rowCount}`);
    return { totalSeen: rows.length, comUtm: comUtm.length, atualizados: r.rowCount ?? 0 };
  } finally {
    client.release();
  }
}

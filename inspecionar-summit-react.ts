/**
 * Read-only VERIFY (match ESTRITO): cruza os 9 hooks da planilha (TP1731-1739) com os vídeos
 * no Gerenciador casando pelo NOME EXATO do arquivo do Drive (`<base>_<fmt>.mp4`), pra não
 * confundir com outras famílias (creators_summit_lucas_h*_b*, Estrategia_peculiar_react, etc.).
 * Reporta duplicatas (mesmo nome subido N vezes) e escolhe 1 id determinístico por formato.
 *   npx tsx inspecionar-summit-react.ts
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, gte, lte, sql } from "drizzle-orm";
import { metaGet, MetaRateLimitError } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120249141209100450"; // CBO Creators teste
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function bk<T>(label: string, fn: () => Promise<T>, max = 8): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit ${label} — 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
}
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };
const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\.[^.]+$/, ""); // sem extensão, lower

(async () => {
  // 1) planilha TP1731-1739 → base (nomeDrive)
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    gte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1731),
    lte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1739),
  ));
  const planilha = rows.map((r) => ({ tpId: r.tpId, nomeFinal: r.nomeFinal, persona: r.personagem ?? "?", base: r.nomeDrive ?? "" }))
    .sort((a, b) => a.tpId.localeCompare(b.tpId, "en", { numeric: true }));

  // 2) índice de vídeos por nome-normalizado-sem-extensão → lista de ids (captura duplicatas)
  const byName = new Map<string, string[]>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  for (let page = 0; url && page < 30; page++) {
    const res: any = await bk("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) {
      const k = norm(v.title ?? "");
      if (!k) continue;
      (byName.get(k) ?? byName.set(k, []).get(k)!).push(v.id);
    }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }

  // 3) cruzamento ESTRITO: <base>_9x16 e <base>_4x5 (escolhe menor id como determinístico)
  console.log(`=== CRUZAMENTO ESTRITO planilha (9 hooks) × Gerenciador ===`);
  const pick = (ids: string[]) => [...ids].sort()[0]; // determinístico
  let ok = 0;
  const chosen: { tpId: string; persona: string; base: string; v9: string; v4: string }[] = [];
  for (const r of planilha) {
    const k9 = norm(`${r.base}_9x16`), k4 = norm(`${r.base}_4x5`);
    const c9 = byName.get(k9) ?? [], c4 = byName.get(k4) ?? [];
    const good = c9.length >= 1 && c4.length >= 1;
    if (good) { ok++; chosen.push({ tpId: r.tpId, persona: r.persona, base: r.base, v9: pick(c9), v4: pick(c4) }); }
    const dup = (c: string[]) => (c.length > 1 ? ` ⚠️x${c.length}` : "");
    console.log(`  ${good ? "✅" : "❌"} ${r.tpId} [${r.persona}] ${r.base}`);
    console.log(`        9x16: ${c9.length ? pick(c9) : "— FALTA"}${dup(c9)}   4x5: ${c4.length ? pick(c4) : "— FALTA"}${dup(c4)}`);
  }
  console.log(`\n${ok}/${planilha.length} hooks com par EXATO no Gerenciador.`);
  if (ok === planilha.length) {
    console.log(`\n--- MAP escolhido (id determinístico p/ o script de subida) ---`);
    for (const c of chosen) console.log(`  ${c.tpId} [${c.persona}] v9=${c.v9} v4=${c.v4}`);
  }

  const sets = await bk("GET adsets", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "400" }));
  const maxNn = Math.max(0, ...(sets.data ?? []).map((s: any) => nnOf(s.name)));
  console.log(`\nMAX NN atual na camp: ${maxNn}  ·  próximos: ${maxNn + 1}/+2`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });

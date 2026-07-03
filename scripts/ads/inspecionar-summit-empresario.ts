/**
 * Read-only VERIFY (match ESTRITO): cruza os 6 hooks da planilha (TP1745-1750, lote
 * "3 - Creators Summit - Empresário") com os vídeos no Gerenciador casando pelo NOME EXATO
 * do arquivo do Drive (`<base>_9x16.mp4` e `<base>_4x5.mp4`). Reporta faltas e duplicatas
 * (mesmo nome subido N vezes) e escolhe 1 id determinístico (menor) por formato.
 *   npx tsx scripts/ads/inspecionar-summit-empresario.ts
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, gte, lte, sql } from "drizzle-orm";
import { metaGet, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function bk<T>(label: string, fn: () => Promise<T>, max = 6): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit ${label} — 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
}
const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\.[^.]+$/, ""); // sem extensão, lower

(async () => {
  // 1) planilha TP1745-1750 → base (nomeDrive)
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    gte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1745),
    lte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1750),
  ));
  const planilha = rows.map((r) => ({ tpId: r.tpId, nomeFinal: r.nomeFinal, persona: r.personagem ?? "?", base: r.nomeDrive ?? "" }))
    .sort((a, b) => a.tpId.localeCompare(b.tpId, "en", { numeric: true }));

  // 2) índice de vídeos por nome-normalizado-sem-extensão → lista de ids (captura duplicatas)
  const byName = new Map<string, string[]>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title,created_time", limit: "200" };
  for (let page = 0; url && page < 40; page++) {
    const res: any = await bk("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) {
      const k = norm(v.title ?? "");
      if (!k) continue;
      (byName.get(k) ?? byName.set(k, []).get(k)!).push(v.id);
    }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title,created_time", limit: "200", after }; else url = null;
  }

  // 3) cruzamento ESTRITO: <base>_9x16 e <base>_4x5 (escolhe menor id como determinístico)
  console.log(`=== CRUZAMENTO ESTRITO planilha (${planilha.length} hooks TP1745-1750) × Gerenciador ===`);
  const pick = (ids: string[]) => [...ids].sort()[0];
  let ok = 0;
  const faltas: string[] = [];
  for (const r of planilha) {
    const k9 = norm(`${r.base}_9x16`), k4 = norm(`${r.base}_4x5`);
    const c9 = byName.get(k9) ?? [], c4 = byName.get(k4) ?? [];
    const good = c9.length >= 1 && c4.length >= 1;
    if (good) ok++;
    if (!c9.length) faltas.push(`${r.tpId} 9x16 (${r.base}_9x16)`);
    if (!c4.length) faltas.push(`${r.tpId} 4x5 (${r.base}_4x5)`);
    const dup = (c: string[]) => (c.length > 1 ? ` ⚠️x${c.length}` : "");
    console.log(`  ${good ? "✅" : "❌"} ${r.tpId} [${r.persona}] ${r.base}`);
    console.log(`        9x16: ${c9.length ? pick(c9) : "— FALTA"}${dup(c9)}   4x5: ${c4.length ? pick(c4) : "— FALTA"}${dup(c4)}`);
  }
  console.log(`\n${ok}/${planilha.length} hooks com par EXATO (9x16 + 4x5) no Gerenciador · ${ok * 2}/${planilha.length * 2} vídeos.`);
  if (faltas.length) { console.log(`\n⚠️ FALTANDO no Gerenciador:`); for (const f of faltas) console.log(`   - ${f}`); }
  else console.log(`\n🎉 Todos os 12 vídeos do lote estão no Gerenciador, batendo pelo nome exato.`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });

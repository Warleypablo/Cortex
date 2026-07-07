/**
 * Read-only CHECK: o lote "4 - Creators Summit - Creator" (Victor h1-3 + Lucas h1-3,
 * arquivos Summit_Creator_<persona>_h<N>b1c1_<fmt>.mp4) já passou pelo nosso fluxo?
 *  1) Biblioteca (creativesLibrary): busca por driveFileId dos 12 arquivos E por nomeDrive/nomeFinal.
 *  2) Gerenciador (advideos): busca vídeos recentes com título summit_creator_* (early-exit por data).
 *   npx tsx scripts/ads/checa-summit-creator.ts
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, or, inArray, ilike } from "drizzle-orm";
import { metaGet, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const DRIVE_IDS = [
  "1id4h9wNLTJMouXpoV8IQ--SmFwTEzuNF", "1-LmPfAjFzNIqhsFSiezjShqARCiMUZ3q", "1JePCwp1LqBIPuwbZDio5SCb0FKkz0WDU", // Victor 9x16 h1-3
  "1tOaf1MMP_JfH5kKuw43i5hpaVfExF7AQ", "1HrRl8lM6N9jXN1t5R7zsy2MFPvBoet-V", "1dCYZc5JTyCZ0Z5QSWY4K9vH9WdQi7Kqs", // Victor 4x5 h1-3
  "1rD5xjg6b770ISZRbnwzCEorIFqDI0auv", "1jCMPyo8WT8YNiSMgiQU94OoFMbO278vl", "1w1MgICMAcZ-gYO5Pzvkf1bAhq1QPo6JP", // Lucas 9x16 h1-3
  "1KRVkvCyqbQya1Z-FNeAFzaku9KqeC9hL", "1-osvrSmen8X9oMsO8P1oC0dgrAjPnQwQ", "1W8ZqbBm2LDniMhejj-kBJSX5QEa-NKD2", // Lucas 4x5 h1-3
];
const EXPECTED = ["victor", "lucas"].flatMap((p) => [1, 2, 3].flatMap((h) => [`summit_creator_${p}_h${h}b1c1_9x16`, `summit_creator_${p}_h${h}b1c1_4x5`]));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function bk<T>(label: string, fn: () => Promise<T>, max = 4): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit ${label} — 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
}
const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\.[^.]+$/, "");

(async () => {
  // 1) Biblioteca
  const rows = await db.select({
    tpId: creativesLibrary.tpId, nomeFinal: creativesLibrary.nomeFinal, nomeDrive: creativesLibrary.nomeDrive,
    personagem: creativesLibrary.personagem, driveFileId: creativesLibrary.driveFileId,
  }).from(creativesLibrary).where(and(isNull(creativesLibrary.deletedAt), or(
    inArray(creativesLibrary.driveFileId, DRIVE_IDS),
    ilike(creativesLibrary.nomeDrive, "%summit_creator%"),
    ilike(creativesLibrary.nomeFinal, "%summit%creator%"),
  )));
  console.log(`=== 1) BIBLIOTECA: ${rows.length} linha(s) casando com o lote Creator ===`);
  for (const r of rows) console.log(`  ${r.tpId} | ${r.personagem} | ${r.nomeDrive} | ${r.nomeFinal}`);
  if (!rows.length) console.log("  (nenhuma — lote NÃO cadastrado na planilha)");

  // 2) Gerenciador: vídeos recentes (arquivos são de 01-03/07 → se subiu, é recente). Early-exit por data.
  const found = new Map<string, string[]>();
  const CUTOFF = "2026-06-20";
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title,created_time", limit: "200" };
  let scanned = 0, oldReached = false;
  for (let page = 0; url && page < 10 && !oldReached; page++) {
    const res: any = await bk("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) {
      scanned++;
      const k = norm(v.title ?? "");
      if (EXPECTED.includes(k)) (found.get(k) ?? found.set(k, []).get(k)!).push(v.id);
      if ((v.created_time ?? "") && v.created_time < CUTOFF) oldReached = true;
    }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title,created_time", limit: "200", after }; else url = null;
  }
  console.log(`\n=== 2) GERENCIADOR: ${found.size}/12 nomes do lote encontrados (varri ${scanned} vídeos até ${oldReached ? `antes de ${CUTOFF}` : "o limite de páginas"}) ===`);
  for (const name of EXPECTED) console.log(`  ${found.has(name) ? "✅" : "❌"} ${name}${found.has(name) ? ` → ${found.get(name)!.join(", ")}` : ""}`);

  console.log(`\nVEREDITO: ${rows.length === 0 && found.size === 0 ? "lote Creator NÃO foi subido (nem planilha, nem Gerenciador)." : "há vestígios — ver acima."}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });

/** Limpa o órfão vazio (165 Esther da 1ª tentativa) e renomeia 166/167/168 → 165/166/167. */
import "dotenv/config";
import { metaGet, metaPostForm, metaBatch, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function bo<T>(label: string, fn: () => Promise<T>, max = 18): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit em ${label} — espera 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
}

const ORPHAN = "120252220562310450"; // 165 Esther vazio (falhou na 1ª run)
const RENAMES: { id: string; from: string; to: string }[] = [
  { id: "120252220650820450", from: "166", to: "165 - [IG] [Aberto] [Stories & Feed & Reels] [Esther] - Estratégia peculiar natural tech" },
  { id: "120252220665880450", from: "167", to: "166 - [IG] [Aberto] [Stories & Feed & Reels] [Ichino] - Estratégia peculiar natural tech" },
  { id: "120252220690870450", from: "168", to: "167 - [IG] [Aberto] [Stories & Feed & Reels] [Musso] - Natural tech" },
];
const go = process.argv.includes("--go");

(async () => {
  // 1) confirma que o órfão está vazio
  const ads = await bo("GET orphan/ads", () => metaGet(`${ORPHAN}/ads`, { fields: "id,name", limit: "5" }));
  const n = (ads.data ?? []).length;
  const orphanInfo = await bo("GET orphan", () => metaGet(ORPHAN, { fields: "name,effective_status" }));
  console.log(`Órfão ${ORPHAN}: "${orphanInfo.name}" (${orphanInfo.effective_status}) — ${n} ad(s)`);
  if (n > 0) { console.log("⚠️  NÃO está vazio — abortando delete por segurança."); process.exit(1); }

  console.log(`\nRenomes:`);
  for (const r of RENAMES) console.log(`  ${r.id}: ${r.from} → "${r.to}"`);
  console.log(`\nmodo: ${go ? "🔴 EXECUTAR" : "DRY"}`);
  if (!go) { console.log("(DRY) Rode com --go."); process.exit(0); }

  // 2) deleta órfão via batch (DELETE)
  const del = await bo("DELETE orphan", () => metaBatch([{ method: "DELETE", relative_url: ORPHAN }]));
  console.log(`\n🗑️  órfão deletado:`, JSON.stringify(del[0]?.body ?? del[0]));

  // 3) renomeia
  for (const r of RENAMES) {
    const res = await bo(`rename ${r.id}`, () => metaPostForm(`${r.id}`, { name: r.to }));
    console.log(`✏️  ${r.id} → ${r.to.split(" - ")[0]}  ${JSON.stringify(res)}`);
  }
  console.log("\n✅ limpeza completa.");
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });

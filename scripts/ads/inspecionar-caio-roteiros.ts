/**
 * Read-only: (1) acha no Gerenciador os 18 vídeos Caio (R1-3 × H1-3 × 9x16/4x5) e mapeia
 * v9/v4 por hook; (2) lista os conjuntos da camp CBO Creators teste (NN + referência de clone).
 * Econômico em chamadas (rate-limit da conta é sensível).
 *   npx tsx inspecionar-caio-roteiros.ts
 */
import "dotenv/config";
import { metaGet, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120249141209100450"; // [TP] [Leads] [CBO] [Creators] - Campanha de teste (default p/ confirmar)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function bk<T>(label: string, fn: () => Promise<T>, max = 8): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit ${label} — 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
}
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };

(async () => {
  // 1) vídeos Caio R#H# no Gerenciador (pagina, filtra)
  const vByKey = new Map<string, { v9?: string; v4?: string }>();
  const caioTitles: { id: string; title: string }[] = [];
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  for (let page = 0; url && page < 20; page++) {
    const res: any = await bk("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) {
      const t: string = v.title ?? "";
      if (!/caio/i.test(t)) continue;
      caioTitles.push({ id: v.id, title: t });
      const m = /r[\s_-]*([1-3])[\s_-]*h[\s_-]*([1-3])/i.exec(t);
      const f = /(9\s*x\s*16|4\s*x\s*5)/i.exec(t);
      if (!m || !f) continue;
      const key = `r${m[1]}h${m[2]}`;
      const cur = vByKey.get(key) ?? {};
      if (/9/.test(f[1])) cur.v9 = v.id; else cur.v4 = v.id;
      vByKey.set(key, cur);
    }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }

  console.log(`=== Vídeos "Caio" no Gerenciador: ${caioTitles.length} título(s) ===`);
  for (const t of caioTitles) console.log(`  ${t.id}  ${t.title}`);
  console.log(`\n=== Pareamento por hook (esperado 9 hooks, cada um 9x16+4x5) ===`);
  for (const r of [1, 2, 3]) for (const h of [1, 2, 3]) {
    const k = `r${r}h${h}`; const v = vByKey.get(k) ?? {};
    const ok = v.v9 && v.v4 ? "✅" : "⚠️ ";
    console.log(`  ${ok} R${r}H${h}: 9x16=${v.v9 ?? "—"}  4x5=${v.v4 ?? "—"}`);
  }

  // 2) conjuntos da camp (NN + nomes)
  console.log(`\n=== Conjuntos da camp ${CAMP} ===`);
  const sets = await bk("GET adsets", () => metaGet(`${CAMP}/adsets`, { fields: "id,name,status", limit: "400" }));
  const list: any[] = (sets.data ?? []).sort((a, b) => nnOf(a.name) - nnOf(b.name));
  for (const s of list) console.log(`  [${nnOf(s.name)}] ${s.id} ${s.status}  ${s.name}`);
  console.log(`\nMAX NN atual: ${Math.max(0, ...list.map((s) => nnOf(s.name)))}  ·  próximos conjuntos: ${Math.max(0, ...list.map((s) => nnOf(s.name))) + 1}/+2/+3`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });

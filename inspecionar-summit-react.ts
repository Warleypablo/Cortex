/**
 * Read-only: acha no Gerenciador os vídeos "Creator Summit React" (Esther h1-4, Lucas h1-5,
 * 9x16+4x5) e pareia por persona/hook; mostra NN atual da camp CBO Creators teste.
 *   npx tsx inspecionar-summit-react.ts
 */
import "dotenv/config";
import { metaGet, MetaRateLimitError } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120249141209100450"; // CBO Creators teste
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function bk<T>(label: string, fn: () => Promise<T>, max = 8): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit ${label} — 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
}
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };

const EXPECT: Record<string, number[]> = { esther: [1, 2, 3, 4], lucas: [1, 2, 3, 4, 5] };

(async () => {
  const vByKey = new Map<string, { v9?: string; v4?: string }>();
  const titles: { id: string; title: string }[] = [];
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  for (let page = 0; url && page < 25; page++) {
    const res: any = await bk("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) {
      const t: string = v.title ?? "";
      if (!/summit[_\s]*react/i.test(t)) continue;
      titles.push({ id: v.id, title: t });
      const mp = /react[_\s]*(esther|lucas)/i.exec(t);
      const mh = /h\s*([1-9])\s*b/i.exec(t);
      const mf = /(9\s*x\s*16|4\s*x\s*5)/i.exec(t);
      if (!mp || !mh || !mf) continue;
      const key = `${mp[1].toLowerCase()}h${mh[1]}`;
      const cur = vByKey.get(key) ?? {};
      if (/9/.test(mf[1])) cur.v9 = v.id; else cur.v4 = v.id;
      vByKey.set(key, cur);
    }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }

  console.log(`=== Vídeos "Summit React" no Gerenciador: ${titles.length} título(s) ===`);
  for (const t of titles.sort((a, b) => a.title.localeCompare(b.title))) console.log(`  ${t.id}  ${t.title}`);
  console.log(`\n=== Pareamento por persona/hook ===`);
  let okCount = 0, total = 0;
  for (const [persona, hooks] of Object.entries(EXPECT)) for (const h of hooks) {
    total++;
    const v = vByKey.get(`${persona}h${h}`) ?? {};
    const ok = v.v9 && v.v4; if (ok) okCount++;
    console.log(`  ${ok ? "✅" : "⚠️ "} ${persona} h${h}: 9x16=${v.v9 ?? "—"}  4x5=${v.v4 ?? "—"}`);
  }
  console.log(`\n${okCount}/${total} hooks completos (9x16+4x5) no Gerenciador.`);

  const sets = await bk("GET adsets", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "400" }));
  const maxNn = Math.max(0, ...(sets.data ?? []).map((s: any) => nnOf(s.name)));
  console.log(`\nMAX NN atual na camp: ${maxNn}  ·  próximos: ${maxNn + 1}/+2`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });

import "dotenv/config";
import { metaGet } from "../../server/services/adsCreation/metaApi";
const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
(async () => {
  const camps = await metaGet(`${ACC}/campaigns`, { fields: "id,name,effective_status,objective", limit: "400" });
  const hit = (camps.data ?? []).filter((c: any) => /summit/i.test(c.name));
  console.log("=== Campanhas com 'Summit' ===");
  for (const c of hit) console.log(`  ${c.id} | ${c.effective_status} | ${c.objective} | ${c.name}`);
  const target = hit.find((c: any) => /creators summit es/i.test(c.name)) ?? hit[0];
  if (!target) { console.log("nenhuma campanha Summit encontrada"); process.exit(0); }
  console.log(`\n=== Conjuntos da campanha ${target.id} (${target.name}) ===`);
  const sets = await metaGet(`${target.id}/adsets`, { fields: "id,name,effective_status,optimization_goal,billing_event,destination_type", limit: "400" });
  for (const s of (sets.data ?? [])) {
    const ads = await metaGet(`${s.id}/ads`, { fields: "id", limit: "1" });
    const n = ads.data?.length ?? 0;
    console.log(`  ${s.id} | ${s.effective_status} | opt=${s.optimization_goal} | dest=${s.destination_type ?? "—"} | ads:${n > 0 ? "sim" : "0"} | ${s.name}`);
  }
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });

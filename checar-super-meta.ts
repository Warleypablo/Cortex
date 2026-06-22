/** Checa se os vídeos da Ana "Super Produção" já estão na biblioteca de mídia do Meta (Gerenciador). */
import "dotenv/config";
import { metaGet } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;

(async () => {
  let after = "";
  let scanned = 0;
  const hits: { id: string; title: string; created_time?: string }[] = [];
  for (let p = 0; p < 3; p++) {
    const params: Record<string, string> = { fields: "id,title,created_time", limit: "100" };
    if (after) params.after = after;
    const r = await metaGet(`${ACC}/advideos`, params);
    const data = r.data || [];
    scanned += data.length;
    for (const v of data) {
      const t = (v.title || "").toLowerCase();
      if (/super/.test(t) && /produ/.test(t) && /ana/.test(t)) hits.push(v);
    }
    after = r.paging?.cursors?.after || "";
    if (!after || !data.length) break;
  }
  console.log(`escaneados ${scanned} vídeos | Super Produção Ana no Gerenciador: ${hits.length}`);
  for (const v of hits) console.log(`  ${v.id} | ${v.title} | ${(v.created_time || "").slice(0, 10)}`);
  if (!hits.length) console.log("⚠️ Nenhum vídeo Super Produção Ana achado — provavelmente ainda não subido no Gerenciador.");
  process.exit(0);
})().catch((e) => {
  console.error("META ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});

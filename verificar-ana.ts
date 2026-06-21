/**
 * Verifica se os vídeos da Ana "Estratégia Peculiar" estão na biblioteca de mídia do Meta
 * DE ACORDO COM A PLANILHA (TP1619–TP1626). A planilha é a referência: pra cada entrada
 * (9x16), confere se o vídeo 9x16 e o par 4x5 existem no Meta. Imprime os video_id achados.
 *
 *   npx tsx verificar-ana.ts
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { metaGet } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const TPS = ["TP1619", "TP1620", "TP1621", "TP1622", "TP1623", "TP1624", "TP1625", "TP1626"];
const norm = (s: string) => s.toLowerCase().replace(/\.mp4$/, "").replace(/[^a-z0-9]/g, "");

(async () => {
  const rows = await db.select().from(creativesLibrary).where(inArray(creativesLibrary.tpId, TPS));
  rows.sort((a, b) => Number(a.tpId.replace("TP", "")) - Number(b.tpId.replace("TP", "")));

  // coleta vídeos Ana "Estratégia Peculiar" do Meta (uploads recentes → topo da lista)
  const vids: Record<string, string> = {};
  let after = "";
  let scanned = 0;
  for (let p = 0; p < 4; p++) {
    const params: Record<string, string> = { fields: "id,title", limit: "100" };
    if (after) params.after = after;
    const r = await metaGet(`${ACC}/advideos`, params);
    const data = r.data || [];
    scanned += data.length;
    for (const v of data) if (/peculiar.*ana|ana.*peculiar/i.test(v.title || "")) vids[norm(v.title)] = v.id;
    after = r.paging?.cursors?.after || "";
    if (!after || !data.length) break;
  }
  console.log(`(escaneados ${scanned} vídeos no Meta)\n`);
  console.log("Planilha (referência) ↔ biblioteca de mídia do Meta:\n");

  let ok9 = 0,
    ok45 = 0;
  const map: { tpId: string; nomeDrive: string; v9?: string; v45?: string }[] = [];
  for (const r of rows) {
    const k9 = norm(r.nomeDrive); // ..._9x16
    const k45 = norm(r.nomeDrive.replace(/9x16/i, "4x5"));
    const v9 = vids[k9];
    const v45 = vids[k45];
    if (v9) ok9++;
    if (v45) ok45++;
    map.push({ tpId: r.tpId, nomeDrive: r.nomeDrive, v9, v45 });
    console.log(`  ${r.tpId} | ${r.nomeDrive}`);
    console.log(`        9x16: ${v9 ? "✅ " + v9 : "❌ FALTA"}    4x5: ${v45 ? "✅ " + v45 : "❌ FALTA"}`);
  }
  console.log(`\nResumo:  9x16 ${ok9}/8   ·   4x5 ${ok45}/8`);
  console.log(ok9 === 8 && ok45 === 8 ? "✅ Bate 100% com a planilha." : "⚠️ Ainda falta subir vídeo(s).");
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});

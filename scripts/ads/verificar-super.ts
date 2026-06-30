/**
 * VERIFICA (só leitura, não cria nada) se os vídeos da Ana "Super Produção" (TP1627–1629)
 * estão na biblioteca de mídia do Meta, de acordo com a planilha. Confere 9x16 + 4x5.
 * Normalização robusta a acento (produção/producao) e extensão.
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { metaGet } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const TPS = ["TP1627", "TP1628", "TP1629"];

// strip extensão → NFD → remove tudo que não é ASCII (tira acento) → lower → só [a-z0-9]
const norm = (s: string) =>
  s
    .replace(/\.(mp4|mov|jpe?g|png)$/i, "")
    .normalize("NFD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

(async () => {
  const rows = await db.select().from(creativesLibrary).where(inArray(creativesLibrary.tpId, TPS));
  rows.sort((a, b) => Number(a.tpId.replace("TP", "")) - Number(b.tpId.replace("TP", "")));

  const vids: Record<string, string> = {};
  let after = "";
  let scanned = 0;
  for (let p = 0; p < 3; p++) {
    const params: Record<string, string> = { fields: "id,title", limit: "100" };
    if (after) params.after = after;
    const r = await metaGet(`${ACC}/advideos`, params);
    const data = r.data || [];
    scanned += data.length;
    for (const v of data) {
      const t = (v.title || "").toLowerCase();
      if (/super/.test(t) && /produ/.test(t) && /ana/.test(t)) vids[norm(v.title)] = v.id;
    }
    after = r.paging?.cursors?.after || "";
    if (!after || !data.length) break;
  }

  console.log(`(escaneados ${scanned} vídeos)\nPlanilha (referência) ↔ Gerenciador:\n`);
  let ok9 = 0;
  let ok45 = 0;
  for (const r of rows) {
    const k9 = norm(r.nomeDrive);
    const k45 = norm(r.nomeDrive.replace(/9x16/i, "4x5"));
    const v9 = vids[k9];
    const v45 = vids[k45];
    if (v9) ok9++;
    if (v45) ok45++;
    console.log(`  ${r.tpId} | ${r.nomeDrive}`);
    console.log(`        9x16: ${v9 ? "✅ " + v9 : "❌ FALTA"}    4x5: ${v45 ? "✅ " + v45 : "❌ FALTA"}`);
  }
  console.log(`\nResumo:  9x16 ${ok9}/3   ·   4x5 ${ok45}/3`);
  if (ok9 === 3 && ok45 === 3) console.log("✅ Tudo nos conformes (9x16 + 4x5 completos).");
  else if (ok9 === 3) console.log("✅ 9x16 completo. 4x5 incompleto (ok se for só 9x16).");
  else console.log("⚠️ Ainda falta subir vídeo(s) 9x16.");
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});

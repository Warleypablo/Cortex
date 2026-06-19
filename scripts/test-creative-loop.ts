/**
 * Teste de fumaça do Loop de Inteligência (lógica direto no banco, sem HTTP/auth).
 * npx tsx scripts/test-creative-loop.ts
 */
import "dotenv/config";
import { pool } from "../server/db";
import { parseFileNameConvention } from "../server/services/adsCreation/creativesRepo";
import {
  upsertBatch,
  getBatchByFolderId,
  resolveModuleFields,
  listVocab,
  extractDriveFolderId,
} from "../server/services/adsCreation/creativeBatchesRepo";
import { extractTpId, linkAdsByName } from "../server/services/adsCreation/creativeAdLinker";

async function main() {
  console.log("\n== 1) Parser com hNN/bNN/cNN ==");
  for (const n of [
    "vv-novosclientes-marina-9x16-h03-b02-c01-v01.mp4",
    "vv-novosclientes-marina-9x16-h03-v01.mp4", // só hook
    "vv-novosclientes-marina-9x16-v01.mp4", // legado sem códigos
    "img-promo-semator-1x1-h01-v02.jpg",
  ]) {
    console.log(n, "→", JSON.stringify(parseFileNameConvention(n)));
  }

  console.log("\n== 2) extractDriveFolderId / extractTpId ==");
  console.log(extractDriveFolderId("https://drive.google.com/drive/folders/ABC123xyz_-?usp=sharing"));
  console.log(extractTpId("TP07 - novos clientes - 18/06/26"), extractTpId("[01] - algo"), extractTpId(null));

  console.log("\n== 3) upsert batch + resolve módulos ==");
  const folderId = "TESTFOLDER_creative_loop_smoke";
  const batch = await upsertBatch({
    driveFolderId: folderId,
    nomeAd: "novosclientes (smoke)",
    produto: "creators",
    roteiroUrl: "https://docs.google.com/document/d/SMOKE/edit",
    clickupTaskId: "tsk_smoke",
    modules: {
      hooks: { h03: { angulo: "prova-social" } },
      bodies: { b02: { tipo: "story" } },
      ctas: { c01: { tipo: "direto" } },
    },
    createdBy: "smoke@test",
  });
  console.log("batch upsert:", batch?.id, batch?.driveFolderId, "produto=", batch?.produto);
  const fetched = await getBatchByFolderId(folderId);
  const parsed = parseFileNameConvention("vv-novosclientes-marina-9x16-h03-b02-c01-v01.mp4");
  console.log("resolveModuleFields:", JSON.stringify(resolveModuleFields(parsed, fetched)));

  console.log("\n== 4) vocab seed ==");
  const vocab = await listVocab();
  const counts: Record<string, number> = {};
  for (const v of vocab) counts[v.kind] = (counts[v.kind] ?? 0) + 1;
  console.log("vocab por kind:", JSON.stringify(counts));

  console.log("\n== 5) linker contra dados reais (ads TP## no Meta) ==");
  const r = await pool.query(`SELECT ad_id, ad_name FROM meta_ads.meta_ads WHERE ad_name ILIKE 'TP%' LIMIT 50`);
  console.log(`ads TP## no Meta: ${r.rows.length}`);
  if (r.rows.length > 0) {
    const link = await linkAdsByName(
      r.rows.map((x: any) => ({ adId: String(x.ad_id), adName: x.ad_name })),
      { source: "name_match" },
    );
    console.log("linkAdsByName:", JSON.stringify(link));
    const total = await pool.query(`SELECT count(*)::int AS n FROM cortex_core.creative_ad_links`);
    console.log("total creative_ad_links agora:", total.rows[0].n);
  } else {
    console.log("(nenhum ad TP## sincronizado ainda — link será exercitado após um sync)");
  }

  // limpeza do batch de smoke
  await pool.query(`DELETE FROM cortex_core.creative_batches WHERE drive_folder_id = $1`, [folderId]);
  console.log("\nOK ✓ (batch de smoke removido)");
  await pool.end();
}

main().catch((e) => {
  console.error("FALHOU:", e);
  process.exit(1);
});

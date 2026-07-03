import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray, asc } from "drizzle-orm";

(async () => {
  const tps = ["TP1745", "TP1746", "TP1747", "TP1748", "TP1749", "TP1750"];
  const rows = await db.select({
    tpId: creativesLibrary.tpId, nomeFinal: creativesLibrary.nomeFinal,
    personagem: creativesLibrary.personagem, produto: creativesLibrary.produto,
    plataforma: creativesLibrary.plataforma, tipoAd: creativesLibrary.tipoAd,
    driveFileId: creativesLibrary.driveFileId, linkDrive: creativesLibrary.linkDrive,
    observacao: creativesLibrary.observacao,
  }).from(creativesLibrary).where(inArray(creativesLibrary.tpId, tps)).orderBy(asc(creativesLibrary.tpId));
  for (const r of rows) {
    console.log(`${r.tpId} | ${r.personagem} | ${r.produto}/${r.plataforma}/${r.tipoAd} | file=${r.driveFileId?.slice(0, 8)}… | ${r.nomeFinal}`);
  }
  console.log(`\n${rows.length}/6 confirmados no banco.`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });

/**
 * Read-only: confirma o próximo TP da Biblioteca e se algum dos 18 arquivos
 * (Caio R1-R3 H1-H3, 9x16+4x5) já está cadastrado (dedup por driveFileId).
 *   npx tsx checar-caio-roteiros.ts
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { generateNextTpId } from "../../server/services/adsCreation/creativesRepo";

const FILE_IDS: Record<string, { v9: string; v4: string }> = {
  R1H1: { v9: "1QwzBQWRkR6nHzMDeAY6MK0A1o4Yuo93F", v4: "1vtCSXC5XzDuobJLgkHa191G44WQfWrYa" },
  R1H2: { v9: "1yBEt-yn7SFmxf1yclhBML-epR_tQbJAF", v4: "1xfXBmHR2ILHS2n-dIRzhNe36RbN88K8z" },
  R1H3: { v9: "1_V2BIsi_RHYGSpx_TSg-ZRJ_rEj3Dmtz", v4: "1RepPnmjd3X_xQUzobvjB4Xmqv3l6vQSW" },
  R2H1: { v9: "1FUlWORqcuT8rJt7Wbhv2UUTlrUHsN5Te", v4: "11K9v5P4R1SYiYmqGQ_HRjE84ayxCVCo8" },
  R2H2: { v9: "1tDmdfCPYI52wvpdZv3UWpHx5FLT84463", v4: "12X_7O40Tq0cpvanxHxxDqT7kX1TMranh" },
  R2H3: { v9: "1d2s5-HMj2OP0oZJQf0rP05_lhiKRUMsi", v4: "1BDboE_lxw8Wj8D8qkXbVVuzYrAPthoo-" },
  R3H1: { v9: "1NwFEJQ488RSDgF6s7HUlnYB9EtWBo1t2", v4: "1LsdEKv6-aue1lIwW7w0eC08W7VOeo3T8" },
  R3H2: { v9: "10gki9eFhSsw66tv8tQMU23ZXaegMuH47", v4: "1xr6zN7ho6OXvs8R0A8fYQ4McKCHzRSm9" },
  R3H3: { v9: "1TWfO-_PHr_YJobWjlicx4jAd1NGLXqxy", v4: "18wWVABZUjkY5ex_qm7Z2Ag9miy7Uqcmg" },
};

(async () => {
  const ids = Object.values(FILE_IDS).flatMap((p) => [p.v9, p.v4]);
  const existing = await db
    .select({ tpId: creativesLibrary.tpId, nomeFinal: creativesLibrary.nomeFinal, d: creativesLibrary.driveFileId })
    .from(creativesLibrary)
    .where(inArray(creativesLibrary.driveFileId, ids));
  const next = await generateNextTpId();
  console.log(`Próximo TP livre: ${next}`);
  console.log(`Arquivos já cadastrados (de ${ids.length}): ${existing.length}`);
  for (const e of existing) console.log(`  ↻ ${e.tpId} | ${e.nomeFinal} | ${e.d}`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});

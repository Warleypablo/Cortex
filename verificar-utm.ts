/**
 * VERIFICA (só leitura, não altera nada) o `url_tags` (UTM) dos ads criados nesta sessão,
 * comparando com a UTM padrão da Turbo. Reporta OK / DIFERENTE por ad.
 */
import "dotenv/config";
import { metaGet } from "./server/services/adsCreation/metaApi";

const EXPECTED =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}";

const CONJ = [
  { id: "120251975787580450", label: "150 - Ana Super Produção" },
  { id: "120251873967700450", label: "149 - Ana Estratégia Peculiar" },
  { id: "120251598318040450", label: "92 - Esther React (só os PAUSED que criei)" },
];

(async () => {
  console.log("UTM esperada:\n  " + EXPECTED + "\n");
  let allOk = true;
  let checked = 0;
  for (const c of CONJ) {
    const ads = await metaGet(`${c.id}/ads`, { fields: "id,name,status,creative{url_tags}", limit: "50" });
    let list = (ads.data || []) as { id: string; name: string; status: string; creative?: { url_tags?: string } }[];
    if (c.id === "120251598318040450") list = list.filter((a) => a.status === "PAUSED" && /TP1228|TP1229|TP1230/.test(a.name));
    console.log(`=== ${c.label} — ${list.length} ad(s) ===`);
    for (const a of list) {
      const tags = a.creative?.url_tags ?? "(vazio)";
      const ok = tags === EXPECTED;
      if (!ok) allOk = false;
      checked++;
      console.log(`  ${ok ? "✅ OK " : "❌ DIF"} | ${a.name}`);
      if (!ok) console.log(`         tem: ${tags}`);
    }
    console.log("");
  }
  console.log(allOk ? `✅ Todos os ${checked} ads estão com a UTM padrão.` : "❌ Há ad(s) com UTM diferente (ver acima).");
  process.exit(0);
})().catch((e) => {
  console.error("META ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});

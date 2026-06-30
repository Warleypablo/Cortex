/**
 * Read-only: estrutura da campanha ABO Creators teste — nomenclatura dos conjuntos,
 * split por hook, e config de um conjunto representativo (pra clonar). 1 call só.
 *   npx tsx inspecionar-abo-creators.ts
 */
import "dotenv/config";
import { metaGet } from "../../server/services/adsCreation/metaApi";

const ABO = "120215204345090450"; // [TP] [Leads] [ABO] [Creators] - Campanha de teste
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getWithBackoff(path: string, params: Record<string, string>, max = 8): Promise<any> {
  for (let i = 0; ; i++) {
    try {
      return await metaGet(path, params);
    } catch (e) {
      if (i >= max) throw e;
      console.log(`   ⏳ rate-limit (${e instanceof Error ? e.message.slice(0, 60) : e}) — esperando 5min (${i + 1}/${max})`);
      await sleep(5 * 60_000);
    }
  }
}

(async () => {
  const sets = await getWithBackoff(`${ABO}/adsets`, {
    fields:
      "id,name,status,daily_budget,optimization_goal,billing_event,bid_strategy,promoted_object,destination_type,targeting",
    limit: "400",
  });
  const list: any[] = sets.data ?? [];
  console.log(`=== ${list.length} conjuntos na ABO Creators teste ===\n`);
  // ordena por NN no início do nome
  const nn = (s: any) => {
    const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(s.name ?? "");
    return m ? parseInt(m[1], 10) : 0;
  };
  list.sort((a, b) => nn(a) - nn(b));
  for (const s of list) {
    console.log(`[${nn(s)}] ${s.name}`);
    console.log(`     id=${s.id} status=${s.status} budget=${s.daily_budget ?? "—"} opt=${s.optimization_goal} dest=${s.destination_type}`);
  }
  // config completa do primeiro conjunto (referência de clone)
  if (list[0]) {
    console.log(`\n=== CONFIG de referência (${list[0].name}) ===`);
    console.log(JSON.stringify({
      optimization_goal: list[0].optimization_goal,
      billing_event: list[0].billing_event,
      bid_strategy: list[0].bid_strategy,
      promoted_object: list[0].promoted_object,
      destination_type: list[0].destination_type,
      targeting: list[0].targeting,
    }, null, 2));
  }
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});

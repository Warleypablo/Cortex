/**
 * Runner manual do sync de UTM do Bitrix. Uso:
 *   npx tsx scripts/run-bitrix-utm-sync.ts [sinceDays]
 */
import "dotenv/config";
import { syncBitrixUtm } from "../server/services/bitrixUtmSync";
import { pool } from "../server/db";

const sinceDays = process.argv[2] ? Number(process.argv[2]) : 14;

syncBitrixUtm({ verbose: true, sinceDays })
  .then((r) => {
    console.log("OK:", r);
    return pool.end();
  })
  .catch((e) => {
    console.error("FALHOU:", e.message);
    process.exit(1);
  });

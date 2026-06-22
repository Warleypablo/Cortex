import { Pool } from "pg";
import "dotenv/config";
import { syncGoogleAdsKeywords } from "../server/services/googleAdsSync";

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  console.log("[sync-keywords] Starting keyword sync...");
  const result = await syncGoogleAdsKeywords(pool, {
    since: "2025-01-01",
    until: new Date().toISOString().split("T")[0],
  });

  console.log("\n[sync-keywords] Result:");
  console.log(`  Keywords synced: ${result.keywords}`);
  console.log(`  Metric rows synced: ${result.keywordMetrics}`);
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`);
    result.errors.forEach(e => console.log(`    - ${e}`));
  }

  // Verify
  const kwCount = await pool.query("SELECT COUNT(*) FROM google_ads.keywords");
  const mCount = await pool.query("SELECT COUNT(*) FROM google_ads.keyword_daily_metrics");
  console.log(`\n[sync-keywords] Verified: ${kwCount.rows[0].count} keywords, ${mCount.rows[0].count} metric rows`);

  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

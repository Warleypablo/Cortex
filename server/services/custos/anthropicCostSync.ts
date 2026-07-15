import { sql } from "drizzle-orm";

const ANTHROPIC_VERSION = "2023-06-01";
const COST_URL = "https://api.anthropic.com/v1/organizations/cost_report";

/**
 * Sincroniza o Cost Report da Anthropic dos últimos `dias`, por dia × workspace,
 * e faz upsert em custo_anthropic_diario. Requer ANTHROPIC_ADMIN_KEY.
 */
export async function syncAnthropicCost(db: any, dias = 45): Promise<{ dias: number; desde: string }> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) throw new Error("ANTHROPIC_ADMIN_KEY não configurada");

  const desdeDate = new Date(Date.now() - dias * 86400000);
  const desde = desdeDate.toISOString().slice(0, 10);

  let page: string | null = null;
  let processados = 0;

  do {
    const url = new URL(COST_URL);
    url.searchParams.set("starting_at", desdeDate.toISOString());
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.append("group_by[]", "workspace_id");
    url.searchParams.set("limit", "31");
    if (page) url.searchParams.set("page", page);

    const res = await fetch(url, {
      headers: { "x-api-key": adminKey, "anthropic-version": ANTHROPIC_VERSION },
    });
    if (!res.ok) throw new Error(`Cost Report status ${res.status}: ${await res.text()}`);
    const json: any = await res.json();

    for (const bucket of json.data || []) {
      const dia = String(bucket.starting_at || "").slice(0, 10);
      if (!dia) continue;
      for (const result of bucket.results || []) {
        const workspace = result.workspace_id || "";
        const custo = parseFloat(result.amount ?? result.cost ?? "0") || 0;
        await db.execute(sql`
          INSERT INTO cortex_core.custo_anthropic_diario (data, workspace, modelo, custo_usd, projeto_interno, synced_at)
          VALUES (${dia}, ${workspace}, '', ${custo}, 'Geral', NOW())
          ON CONFLICT (data, workspace, modelo) DO UPDATE SET
            custo_usd = EXCLUDED.custo_usd,
            synced_at = NOW()
        `);
        processados++;
      }
    }
    page = json.has_more ? json.next_page : null;
  } while (page);

  return { dias, desde };
}

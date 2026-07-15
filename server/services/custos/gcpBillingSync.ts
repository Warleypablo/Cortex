import { readFileSync } from "node:fs";
import { BigQuery } from "@google-cloud/bigquery";
import { sql } from "drizzle-orm";

/** Lê a credencial da service account de GOOGLE_SERVICE_ACCOUNT_JSON (JSON inline ou caminho .json). */
function getCredentials(): any {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurada");
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  return JSON.parse(readFileSync(trimmed, "utf8"));
}

/**
 * Sincroniza os custos do GCP dos últimos `dias` a partir do BigQuery Billing Export,
 * agregando por dia × projeto × serviço, e faz upsert em custo_gcp_diario.
 */
export async function syncGcpBilling(db: any, dias = 45): Promise<{ linhas: number; desde: string }> {
  const table = process.env.GCP_BILLING_BQ_TABLE;
  if (!table) throw new Error("GCP_BILLING_BQ_TABLE não configurada");

  const credentials = getCredentials();
  const bq = new BigQuery({ credentials, projectId: credentials.project_id });

  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  // `table` vem de env (confiável); não pode ser bind param em BigQuery (nome de tabela).
  const query = `
    SELECT
      DATE(usage_start_time) AS data,
      project.id AS gcp_project_id,
      service.description AS servico,
      SUM(cost) AS custo,
      currency
    FROM \`${table}\`
    WHERE DATE(usage_start_time) >= @desde AND project.id IS NOT NULL
    GROUP BY data, gcp_project_id, servico, currency
  `;
  const [rows] = await bq.query({ query, params: { desde } });

  // Mapa projeto GCP → projeto interno (Synapse/Cortex/Geral)
  const mapRes = await db.execute(sql`SELECT gcp_project_id, projeto_interno FROM cortex_core.custo_gcp_projeto_map`);
  const map = new Map<string, string>((mapRes.rows as any[]).map((r) => [r.gcp_project_id, r.projeto_interno]));

  let count = 0;
  for (const r of rows as any[]) {
    const dataStr = typeof r.data === "string" ? r.data : r.data?.value; // BigQuery DATE vem como {value:'YYYY-MM-DD'}
    const projetoInterno = map.get(r.gcp_project_id) || "Geral";
    await db.execute(sql`
      INSERT INTO cortex_core.custo_gcp_diario (data, gcp_project_id, servico, custo, moeda, projeto_interno, synced_at)
      VALUES (${dataStr}, ${r.gcp_project_id}, ${r.servico || "—"}, ${r.custo || 0}, ${r.currency || "USD"}, ${projetoInterno}, NOW())
      ON CONFLICT (data, gcp_project_id, servico) DO UPDATE SET
        custo = EXCLUDED.custo,
        moeda = EXCLUDED.moeda,
        projeto_interno = EXCLUDED.projeto_interno,
        synced_at = NOW()
    `);
    count++;
  }
  return { linhas: count, desde };
}

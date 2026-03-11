import { Pool } from "pg";
import "dotenv/config";

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY!;
const LIST_ID = "217091334";

const CF = {
  TIPO: "8cd467cb-6451-4933-b9e7-a61bf169987a",
  TIPO_PROJETO: "727d5d3e-7f40-4c64-8a76-9a703554efb6",
  FASE_PROJETO: "5d46b251-aa0a-417f-9dd8-8dc11ff7b5eb",
  VALOR_P: "a0797492-cc59-41ab-9df6-f8d9952afec1",
  LANCAMENTO_PREVISTO: "bfc1bf1c-57cf-4cfe-ac0c-c8d167b96f4c",
  DATA_ENTREGUE: "f20ce1d5-3e09-40f5-84a9-34b24139501a",
  FIGMA: "08cc9fd7-afe8-4f84-894b-393ccbcc93d3",
  TEMPO_TOTAL: "2a8272dd-990f-4833-936e-c7be47e3ac8b",
};

function msToDate(ms: string | number | null | undefined): string | null {
  if (!ms) return null;
  const d = new Date(Number(ms));
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function getDropdown(cf: any): string | null {
  if (cf.value == null) return null;
  for (const opt of cf.type_config?.options || []) {
    if (String(opt.orderindex) === String(cf.value)) return opt.name;
  }
  return null;
}

function parseTask(t: any) {
  const cfs: Record<string, any> = {};
  for (const cf of t.custom_fields || []) cfs[cf.id] = cf;
  const assignees = (t.assignees || []).map((a: any) => a.username).join("; ");
  return {
    id: t.id,
    name: t.name,
    status: t.status?.status || null,
    statusType: t.status?.type || null,
    priority: t.priority?.priority || null,
    due: msToDate(t.due_date),
    lancamento: cfs[CF.LANCAMENTO_PREVISTO]?.value ? msToDate(cfs[CF.LANCAMENTO_PREVISTO].value) : null,
    dataEntregue: cfs[CF.DATA_ENTREGUE]?.value ? msToDate(cfs[CF.DATA_ENTREGUE].value) : null,
    tempo: cfs[CF.TEMPO_TOTAL]?.value != null ? parseFloat(cfs[CF.TEMPO_TOTAL].value) || null : null,
    responsavel: assignees || null,
    fase: cfs[CF.FASE_PROJETO] ? getDropdown(cfs[CF.FASE_PROJETO]) : null,
    tipo: cfs[CF.TIPO] ? getDropdown(cfs[CF.TIPO]) : null,
    tipoProjeto: cfs[CF.TIPO_PROJETO] ? getDropdown(cfs[CF.TIPO_PROJETO]) : null,
    figma: cfs[CF.FIGMA]?.value || null,
    valorP: cfs[CF.VALOR_P] ? parseFloat(cfs[CF.VALOR_P].value) || null : null,
    start: msToDate(t.start_date),
    created: msToDate(t.date_created),
  };
}

async function fetchAll(): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const res = await fetch(
      `https://api.clickup.com/api/v2/list/${LIST_ID}/task?page=${page}&include_closed=true&subtasks=false`,
      { headers: { Authorization: CLICKUP_API_KEY } }
    );
    const data = await res.json();
    all.push(...(data.tasks || []));
    console.log(`  Page ${page}: ${data.tasks?.length || 0} tasks`);
    if (data.last_page) break;
    page++;
  }
  return all;
}

async function main() {
  console.log("[sync] Fetching tasks from ClickUp...");
  const tasks = await fetchAll();
  console.log(`[sync] Total: ${tasks.length}`);

  const closedTypes = new Set(["closed", "done"]);
  const open = tasks.filter(t => !closedTypes.has(t.status?.type)).map(parseTask);
  const closed = tasks.filter(t => closedTypes.has(t.status?.type)).map(parseTask);
  console.log(`[sync] Open: ${open.length}, Closed: ${closed.length}`);

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM "Clickup".cup_projetos_tech`);
    await client.query(`DELETE FROM "Clickup".cup_projetos_tech_fechados`);

    const insertSQL = (table: string) => `
      INSERT INTO "Clickup".${table}
      (clickup_task_id, task_name, status_projeto, prioridade, data_vencimento,
       lancamento, tempo_total, responsavel, fase_projeto, tipo, tipo_projeto,
       figma, valor_p, data_inicial, data_criada, data_entregue)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `;

    for (const r of open) {
      await client.query(insertSQL("cup_projetos_tech"), [
        r.id, r.name, r.status, r.priority, r.due, r.lancamento, r.tempo,
        r.responsavel, r.fase, r.tipo, r.tipoProjeto, r.figma, r.valorP, r.start, r.created, r.dataEntregue,
      ]);
    }
    console.log(`[sync] Inserted ${open.length} open projects`);

    for (const r of closed) {
      await client.query(insertSQL("cup_projetos_tech_fechados"), [
        r.id, r.name, r.status, r.priority, r.due, r.lancamento, r.tempo,
        r.responsavel, r.fase, r.tipo, r.tipoProjeto, r.figma, r.valorP, r.start, r.created, r.dataEntregue,
      ]);
    }
    console.log(`[sync] Inserted ${closed.length} closed projects`);

    await client.query("COMMIT");
    console.log("[sync] Transaction committed!");

    // Verify
    const openCount = await client.query(`SELECT COUNT(*) FROM "Clickup".cup_projetos_tech`);
    const closedCount = await client.query(`SELECT COUNT(*) FROM "Clickup".cup_projetos_tech_fechados`);
    console.log(`[sync] Verified: ${openCount.rows[0].count} open, ${closedCount.rows[0].count} closed`);

    // Check lancamento distribution
    const lancDist = await client.query(`
      SELECT TO_CHAR(lancamento, 'YYYY-MM') as mes, COUNT(*) as cnt
      FROM (
        SELECT lancamento FROM "Clickup".cup_projetos_tech_fechados
        UNION ALL SELECT lancamento FROM "Clickup".cup_projetos_tech
      ) c
      WHERE lancamento IS NOT NULL AND lancamento >= '2025-06-01'
      GROUP BY TO_CHAR(lancamento, 'YYYY-MM')
      ORDER BY mes
    `);
    console.log("\n[sync] Lancamentos por mês (desde Jun 2025):");
    lancDist.rows.forEach((r: any) => console.log(`  ${r.mes}: ${r.cnt}`));

  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

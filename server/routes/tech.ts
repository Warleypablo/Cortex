import type { Express } from "express";
import type { IStorage } from "../storage";
import { sql } from "drizzle-orm";

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const CLICKUP_TECH_LIST_ID = "217091334";

// Custom field IDs for Projetos Tech list
const CF = {
  TIPO: "8cd467cb-6451-4933-b9e7-a61bf169987a",
  TIPO_PROJETO: "727d5d3e-7f40-4c64-8a76-9a703554efb6",
  FASE_PROJETO: "5d46b251-aa0a-417f-9dd8-8dc11ff7b5eb",
  VALOR_P: "a0797492-cc59-41ab-9df6-f8d9952afec1",
  LANCAMENTO_PREVISTO: "bfc1bf1c-57cf-4cfe-ac0c-c8d167b96f4c",
  DATA_KICKOFF: "de5c78c9-5d62-4f45-8eba-69b15126a784",
  DATA_ENTREGUE: "f20ce1d5-3e09-40f5-84a9-34b24139501a",
  FIGMA: "08cc9fd7-afe8-4f84-894b-393ccbcc93d3",
  TEMPO_TOTAL: "2a8272dd-990f-4833-936e-c7be47e3ac8b",
};

interface ClickUpTask {
  id: string;
  name: string;
  status: { status: string; type: string };
  priority?: { priority: string } | null;
  due_date?: string | null;
  start_date?: string | null;
  date_created?: string;
  custom_fields?: Array<{
    id: string;
    name: string;
    type: string;
    value: any;
    type_config?: { options?: Array<{ orderindex: number; name: string }> };
  }>;
  assignees?: Array<{ username: string }>;
}

function msToDate(ms: string | number | null | undefined): string | null {
  if (!ms) return null;
  const d = new Date(Number(ms));
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function getDropdownValue(cf: any): string | null {
  if (cf.value == null) return null;
  const opts = cf.type_config?.options || [];
  for (const opt of opts) {
    if (String(opt.orderindex) === String(cf.value)) return opt.name;
  }
  return null;
}

function parseCurrency(val: any): number | null {
  if (val == null) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseTaskRow(t: ClickUpTask) {
  const cfs: Record<string, any> = {};
  for (const cf of t.custom_fields || []) {
    cfs[cf.id] = cf;
  }
  const assigneeNames = (t.assignees || []).map((a: any) => a.username).join("; ");
  return {
    clickup_task_id: t.id,
    task_name: t.name,
    status_projeto: t.status?.status || null,
    prioridade: t.priority?.priority || null,
    data_vencimento: msToDate(t.due_date),
    lancamento: cfs[CF.LANCAMENTO_PREVISTO]?.value ? msToDate(cfs[CF.LANCAMENTO_PREVISTO].value) : null,
    data_entregue: cfs[CF.DATA_ENTREGUE]?.value ? msToDate(cfs[CF.DATA_ENTREGUE].value) : null,
    tempo_total: cfs[CF.TEMPO_TOTAL]?.value != null ? parseFloat(cfs[CF.TEMPO_TOTAL].value) || null : null,
    responsavel: assigneeNames || null,
    fase_projeto: cfs[CF.FASE_PROJETO] ? getDropdownValue(cfs[CF.FASE_PROJETO]) : null,
    tipo: cfs[CF.TIPO] ? getDropdownValue(cfs[CF.TIPO]) : null,
    tipo_projeto: cfs[CF.TIPO_PROJETO] ? getDropdownValue(cfs[CF.TIPO_PROJETO]) : null,
    figma: cfs[CF.FIGMA]?.value || null,
    valor_p: cfs[CF.VALOR_P] ? parseCurrency(cfs[CF.VALOR_P].value) : null,
    data_inicial: msToDate(t.start_date),
    data_criada: msToDate(t.date_created),
  };
}

async function fetchAllClickUpTasks(listId: string): Promise<ClickUpTask[]> {
  const allTasks: ClickUpTask[] = [];
  let page = 0;
  while (true) {
    const res = await fetch(
      `https://api.clickup.com/api/v2/list/${listId}/task?page=${page}&include_closed=true&subtasks=false`,
      { headers: { Authorization: CLICKUP_API_KEY || "" } }
    );
    if (!res.ok) throw new Error(`ClickUp API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    allTasks.push(...(data.tasks || []));
    if (data.last_page) break;
    page++;
  }
  return allTasks;
}

export function registerTechRoutes(app: Express, db: any, storage: IStorage) {
  // Tech Dashboard API routes

  app.get("/api/tech/metricas", async (req, res) => {
    try {
      const metricas = await storage.getTechMetricas();
      res.json(metricas);
    } catch (error) {
      console.error("[api] Error fetching tech metrics:", error);
      res.status(500).json({ error: "Failed to fetch tech metrics" });
    }
  });

  app.get("/api/tech/projetos-por-status", async (req, res) => {
    try {
      const projetos = await storage.getTechProjetosPorStatus();
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching tech projects by status:", error);
      res.status(500).json({ error: "Failed to fetch tech projects by status" });
    }
  });

  app.get("/api/tech/projetos-por-responsavel", async (req, res) => {
    try {
      const projetos = await storage.getTechProjetosPorResponsavel();
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching tech projects by responsible:", error);
      res.status(500).json({ error: "Failed to fetch tech projects by responsible" });
    }
  });

  app.get("/api/tech/projetos-por-tipo", async (req, res) => {
    try {
      const projetos = await storage.getTechProjetosPorTipo();
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching tech projects by type:", error);
      res.status(500).json({ error: "Failed to fetch tech projects by type" });
    }
  });

  app.get("/api/tech/projetos-em-andamento", async (req, res) => {
    try {
      const projetos = await storage.getTechProjetosEmAndamento();
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching active tech projects:", error);
      res.status(500).json({ error: "Failed to fetch active tech projects" });
    }
  });

  app.get("/api/tech/projetos-fechados", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const projetos = await storage.getTechProjetosFechados(limit);
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching closed tech projects:", error);
      res.status(500).json({ error: "Failed to fetch closed tech projects" });
    }
  });

  app.get("/api/tech/tasks-por-status", async (req, res) => {
    try {
      const tasks = await storage.getTechTasksPorStatus();
      res.json(tasks);
    } catch (error) {
      console.error("[api] Error fetching tech tasks by status:", error);
      res.status(500).json({ error: "Failed to fetch tech tasks by status" });
    }
  });

  app.get("/api/tech/velocidade", async (req, res) => {
    try {
      const velocidade = await storage.getTechVelocidade();
      res.json(velocidade);
    } catch (error) {
      console.error("[api] Error fetching tech velocity:", error);
      res.status(500).json({ error: "Failed to fetch tech velocity" });
    }
  });

  app.get("/api/tech/tempo-responsavel", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const responsavel = req.query.responsavel as string | undefined;
      const data = await storage.getTechTempoResponsavel(startDate, endDate, responsavel);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching tech tempo por responsavel:", error);
      res.status(500).json({ error: "Failed to fetch tech tempo por responsavel" });
    }
  });

  app.get("/api/tech/projetos", async (req, res) => {
    try {
      const tipo = (req.query.tipo as 'abertos' | 'fechados') || 'abertos';
      const responsavel = req.query.responsavel as string | undefined;
      const tipoP = req.query.tipoP as string | undefined;
      const projetos = await storage.getTechAllProjetos(tipo, responsavel, tipoP);
      res.json(projetos);
    } catch (error) {
      console.error("[api] Error fetching tech projetos:", error);
      res.status(500).json({ error: "Failed to fetch tech projetos" });
    }
  });

  // Evolução Mensal - entregas, valor e tendências por mês
  app.get("/api/tech/evolucao-mensal", async (req, res) => {
    try {
      const meses = parseInt(req.query.meses as string) || 12;
      const data = await storage.getTechEvolucaoMensal(meses);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching tech evolucao mensal:", error);
      res.status(500).json({ error: "Failed to fetch tech evolucao mensal" });
    }
  });

  // Evolução por Tipo - entregas e valor por mês e tipo de projeto
  app.get("/api/tech/evolucao-por-tipo", async (req, res) => {
    try {
      const meses = parseInt(req.query.meses as string) || 12;
      const data = await storage.getTechEvolucaoPorTipo(meses);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching tech evolucao por tipo:", error);
      res.status(500).json({ error: "Failed to fetch tech evolucao por tipo" });
    }
  });

  // Análise Financeira - realizado vs previsto por tipo
  app.get("/api/tech/financeiro", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const data = await storage.getTechFinanceiro(startDate, endDate);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching tech financeiro:", error);
      res.status(500).json({ error: "Failed to fetch tech financeiro" });
    }
  });

  // Receita Mensal - valor realizado vs previsto mês a mês
  app.get("/api/tech/receita-mensal", async (req, res) => {
    try {
      const meses = parseInt(req.query.meses as string) || 12;
      const data = await storage.getTechReceitaMensal(meses);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching tech receita mensal:", error);
      res.status(500).json({ error: "Failed to fetch tech receita mensal" });
    }
  });

  // Sync ClickUp → cup_projetos_tech / cup_projetos_tech_fechados
  app.post("/api/tech/sync-clickup", async (req, res) => {
    try {
      if (!CLICKUP_API_KEY) {
        return res.status(500).json({ error: "CLICKUP_API_KEY not configured" });
      }

      console.log("[tech-sync] Starting ClickUp sync...");
      const tasks = await fetchAllClickUpTasks(CLICKUP_TECH_LIST_ID);
      console.log(`[tech-sync] Fetched ${tasks.length} tasks from ClickUp`);

      // Closed status types in ClickUp
      const closedTypes = new Set(["closed", "done"]);
      const openTasks = tasks.filter(t => !closedTypes.has(t.status?.type));
      const closedTasks = tasks.filter(t => closedTypes.has(t.status?.type));

      const openRows = openTasks.map(parseTaskRow);
      const closedRows = closedTasks.map(parseTaskRow);

      // Truncate and insert in a transaction
      await db.transaction(async (tx: any) => {
        await tx.execute(sql`DELETE FROM "Clickup".cup_projetos_tech`);
        await tx.execute(sql`DELETE FROM "Clickup".cup_projetos_tech_fechados`);

        for (const row of openRows) {
          await tx.execute(sql`
            INSERT INTO "Clickup".cup_projetos_tech
            (clickup_task_id, task_name, status_projeto, prioridade, data_vencimento,
             lancamento, tempo_total, responsavel, fase_projeto, tipo, tipo_projeto,
             figma, valor_p, data_inicial, data_criada, data_entregue)
            VALUES (
              ${row.clickup_task_id}, ${row.task_name}, ${row.status_projeto}, ${row.prioridade},
              ${row.data_vencimento ? sql.raw(`'${row.data_vencimento}'::date`) : sql`NULL`},
              ${row.lancamento ? sql.raw(`'${row.lancamento}'::date`) : sql`NULL`},
              ${row.tempo_total}, ${row.responsavel}, ${row.fase_projeto}, ${row.tipo},
              ${row.tipo_projeto}, ${row.figma}, ${row.valor_p},
              ${row.data_inicial ? sql.raw(`'${row.data_inicial}'::date`) : sql`NULL`},
              ${row.data_criada ? sql.raw(`'${row.data_criada}'::date`) : sql`NULL`},
              ${row.data_entregue ? sql.raw(`'${row.data_entregue}'::date`) : sql`NULL`}
            )
          `);
        }

        for (const row of closedRows) {
          await tx.execute(sql`
            INSERT INTO "Clickup".cup_projetos_tech_fechados
            (clickup_task_id, task_name, status_projeto, prioridade, data_vencimento,
             lancamento, tempo_total, responsavel, fase_projeto, tipo, tipo_projeto,
             figma, valor_p, data_inicial, data_criada, data_entregue)
            VALUES (
              ${row.clickup_task_id}, ${row.task_name}, ${row.status_projeto}, ${row.prioridade},
              ${row.data_vencimento ? sql.raw(`'${row.data_vencimento}'::date`) : sql`NULL`},
              ${row.lancamento ? sql.raw(`'${row.lancamento}'::date`) : sql`NULL`},
              ${row.tempo_total}, ${row.responsavel}, ${row.fase_projeto}, ${row.tipo},
              ${row.tipo_projeto}, ${row.figma}, ${row.valor_p},
              ${row.data_inicial ? sql.raw(`'${row.data_inicial}'::date`) : sql`NULL`},
              ${row.data_criada ? sql.raw(`'${row.data_criada}'::date`) : sql`NULL`},
              ${row.data_entregue ? sql.raw(`'${row.data_entregue}'::date`) : sql`NULL`}
            )
          `);
        }
      });

      console.log(`[tech-sync] Done: ${openRows.length} open, ${closedRows.length} closed`);
      res.json({
        success: true,
        total: tasks.length,
        open: openRows.length,
        closed: closedRows.length,
      });
    } catch (error: any) {
      console.error("[tech-sync] Error:", error?.message || error);
      res.status(500).json({ error: "Failed to sync ClickUp data", details: error?.message });
    }
  });
}

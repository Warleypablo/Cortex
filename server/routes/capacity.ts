import type { Express } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { toComercialRow, toSelvaRow, toCsRow, finalizeSquad, type CapacityTimesResponse, type SquadGroup } from "./capacityTimes.helpers";
import { META_CONTAS_DESIGNER, BLACK_ACCOUNTS, CAP_CONTAS_ACCOUNT } from "../../shared/capacityGrupos";

// Tabela de referência: nível do Gestor de Performance → metas
const GESTOR_LEVELS: Record<string, { mrr_alvo: number; ticket_alvo: number }> = {
  "Estágio": { mrr_alvo: 0, ticket_alvo: 0 },
  "I":       { mrr_alvo: 8000, ticket_alvo: 2000 },
  "I+":      { mrr_alvo: 13000, ticket_alvo: 2167 },
  "II":      { mrr_alvo: 18000, ticket_alvo: 2250 },
  "II+":     { mrr_alvo: 23000, ticket_alvo: 2300 },
  "III":     { mrr_alvo: 28000, ticket_alvo: 2333 },
  "III+":    { mrr_alvo: 34000, ticket_alvo: 2429 },
  "IV":      { mrr_alvo: 40000, ticket_alvo: 2857 },
  "IV+":     { mrr_alvo: 40000, ticket_alvo: 3333 },
  "V":       { mrr_alvo: 50000, ticket_alvo: 5000 },
  "V+":      { mrr_alvo: 50000, ticket_alvo: 5000 },
  "VI":      { mrr_alvo: 50000, ticket_alvo: 5000 },
  "VI+":     { mrr_alvo: 50000, ticket_alvo: 5000 },
};

// Remove emoji prefixes from squad names (e.g. "🐍 Selva" → "Selva")
function normalizeSquad(squad: string | null): string {
  if (!squad) return "";
  return squad.replace(/^[^\p{L}]+/u, "").trim();
}

// cap_clientes é tolerante a payload legado: o form da aba Configurar já envia essa
// chave, mas clientes antigos da API (scripts, integrações) podem não enviá-la. Chave
// AUSENTE deve virar `null` (sem meta configurada) em vez de 400 — mas `null` explícito
// e inteiros continuam válidos.
// Cuidado: `.optional()` sozinho REJEITA `null` no Zod; por isso `.nullable().optional()`
// + `.transform` para garantir que `undefined` nunca chega ao SQL (INSERT/UPDATE
// interpolam `${m.cap_clientes}` direto — undefined viraria parâmetro inválido).
export const capacityMetaSchema = z.object({
  nome: z.string().trim().min(1, "nome é obrigatório"),
  match_responsavel: z.string().trim().min(1, "match_responsavel é obrigatório"),
  categoria: z.string().trim().min(1, "categoria é obrigatória"),
  cap_recorrente: z.number().int().nonnegative().nullable(),
  cap_mrr: z.number().nonnegative().nullable(),
  cap_pontual: z.number().int().nonnegative().nullable(),
  cap_contas: z.number().int().nonnegative().nullable(),
  cap_clientes: z.number().int().nonnegative().nullable().optional().transform((v) => v ?? null),
  ordem: z.number().int().nonnegative().default(0),
  ativo: z.boolean().default(true),
});

export function registerCapacityRoutes(app: Express, db: any) {

  // GET /api/capacity/gestores — capacity automática por nível de cargo
  app.get("/api/capacity/gestores", async (req, res) => {
    try {
      // 1) Buscar gestores ativos + contratos via fuzzy match
      const result = await db.execute(sql`
        WITH gestores AS (
          SELECT nome, cargo, nivel, squad
          FROM "Inhire".rh_pessoal
          WHERE cargo = 'Gestor de Performance'
            AND status = 'Ativo'
        ),
        contratos_expanded AS (
          SELECT
            c.id_subtask,
            TRIM(r.responsavel_part) as responsavel_part,
            COALESCE(c.valorr, 0) as valorr,
            c.produto
          FROM "Clickup".cup_contratos c
          CROSS JOIN LATERAL regexp_split_to_table(c.responsavel, ';') AS r(responsavel_part)
          WHERE c.status IN ('ativo', 'onboarding', 'triagem')
            AND c.responsavel IS NOT NULL AND c.responsavel != ''
        ),
        best_match AS (
          SELECT DISTINCT ON (ce.id_subtask, ce.responsavel_part)
            g.nome as gestor_nome,
            ce.id_subtask,
            ce.valorr,
            ce.produto
          FROM contratos_expanded ce
          CROSS JOIN gestores g
          WHERE similarity(g.nome, ce.responsavel_part) > 0.4
          ORDER BY ce.id_subtask, ce.responsavel_part, similarity(g.nome, ce.responsavel_part) DESC
        ),
        agg AS (
          SELECT
            gestor_nome,
            SUM(valorr)::numeric as mrr_atual,
            COUNT(DISTINCT id_subtask)::int as contratos_atuais
          FROM best_match
          GROUP BY gestor_nome
        )
        SELECT
          g.nome,
          g.nivel,
          g.squad,
          COALESCE(a.mrr_atual, 0)::numeric as mrr_atual,
          COALESCE(a.contratos_atuais, 0)::int as contratos_atuais,
          CASE WHEN COALESCE(a.contratos_atuais, 0) > 0
            THEN ROUND(COALESCE(a.mrr_atual, 0)::numeric / a.contratos_atuais, 2)
            ELSE 0
          END as ticket_medio_atual
        FROM gestores g
        LEFT JOIN agg a ON g.nome = a.gestor_nome
        ORDER BY g.squad, g.nome
      `);

      // 2) Enriquecer com metas do nível
      const rows = result.rows.map((row: any) => {
        const nivel = (row.nivel || "").replace(/^X\s+/, "").trim();
        const levelData = GESTOR_LEVELS[nivel] || { mrr_alvo: 0, ticket_alvo: 0 };
        const mrr_atual = parseFloat(row.mrr_atual) || 0;
        const contratos_atuais = parseInt(row.contratos_atuais) || 0;
        const ticket_medio = parseFloat(row.ticket_medio_atual) || 0;
        const mrr_alvo = levelData.mrr_alvo;
        const utilizacao_pct = mrr_alvo > 0 ? Math.round((mrr_atual / mrr_alvo) * 1000) / 10 : 0;

        return {
          nome: row.nome,
          nivel,
          squad: normalizeSquad(row.squad),
          mrr_alvo,
          ticket_alvo: levelData.ticket_alvo,
          mrr_atual,
          contratos_atuais,
          ticket_medio_atual: ticket_medio,
          utilizacao_pct,
        };
      });

      res.json(rows);
    } catch (error) {
      console.error("[api] Error fetching capacity gestores:", error);
      res.status(500).json({ error: "Failed to fetch capacity gestores" });
    }
  });

  // GET /api/capacity/levels — referência de níveis
  app.get("/api/capacity/levels", async (_req, res) => {
    res.json(GESTOR_LEVELS);
  });

  // GET /api/capacity-times — capacity por função (Selva / Black / Squadra / CXCS)
  //   Designer              → Selva   (responsavel; faturamento rec+pontual; cap via TM)
  //   Gestor de Performance → Squadra (responsavel; MRR + contas) — exceto os Black accounts
  //   CXCS                  → CXCS    (cs_responsavel; MRR + contas) — exceto os Black accounts
  //   Black = lista explícita BLACK_ACCOUNTS (clientes via responsavel_geral; faturamento)
  app.get("/api/capacity-times", async (_req, res) => {
    // Nomes (RH) dos accounts → removidos dos grupos por cargo (eles foram para a Black).
    const blackNomesValues = sql.join(
      BLACK_ACCOUNTS.map((a) => sql`(${a.rhNome})`),
      sql`, `,
    );
    // VALUES (label, match) para a query da Black.
    const accountsValues = sql.join(
      BLACK_ACCOUNTS.map((a) => sql`(${a.label}, ${a.match})`),
      sql`, `,
    );
    try {
      const result = await db.execute(sql`
        WITH pessoas AS (
          SELECT r.nome,
                 CASE WHEN r.cargo = 'Designer'              THEN 'selva'
                      WHEN r.cargo = 'Gestor de Performance' THEN 'squadra' END AS grupo
          FROM "Inhire".rh_pessoal r
          WHERE r.status = 'Ativo'
            AND (r.cargo = 'Designer' OR r.cargo = 'Gestor de Performance')
            AND NOT EXISTS (
              SELECT 1 FROM (VALUES ${blackNomesValues}) AS bn(n)
              WHERE similarity(r.nome, bn.n) > 0.5
            )
        ),
        contratos_expanded AS (
          SELECT c.id_subtask, c.id_task, TRIM(rp.part) AS responsavel_part,
                 COALESCE(c.valorr, 0) AS valorr, COALESCE(c.valorp, 0) AS valorp, c.status
          FROM "Clickup".cup_contratos c
          CROSS JOIN LATERAL regexp_split_to_table(c.responsavel, ';') AS rp(part)
          WHERE c.status IN ('ativo','onboarding','em cancelamento')
            AND c.responsavel IS NOT NULL AND c.responsavel <> ''
        ),
        best AS (
          SELECT DISTINCT ON (ce.id_subtask, ce.responsavel_part)
            p.nome AS pessoa, p.grupo, ce.id_subtask, ce.id_task, ce.valorr, ce.valorp, ce.status
          FROM contratos_expanded ce
          JOIN pessoas p ON similarity(p.nome, ce.responsavel_part) > 0.4
          ORDER BY ce.id_subtask, ce.responsavel_part, similarity(p.nome, ce.responsavel_part) DESC
        ),
        agg AS (
          SELECT pessoa, grupo,
            COUNT(DISTINCT id_subtask) FILTER (WHERE valorr > 0 OR valorp > 0) AS contas_total,
            COUNT(DISTINCT id_subtask) FILTER (WHERE valorr > 0) AS contas_rec,
            COUNT(DISTINCT id_subtask) FILTER (WHERE valorp > 0) AS contas_pont,
            COUNT(DISTINCT id_task) FILTER (WHERE valorr > 0 OR valorp > 0) AS clientes_total,
            COUNT(DISTINCT id_task) FILTER (WHERE valorr > 0) AS clientes_rec,
            COUNT(DISTINCT id_task) FILTER (WHERE valorp > 0) AS clientes_pont,
            COALESCE(SUM(valorr), 0) AS mrr_operando,
            COALESCE(SUM(valorp), 0) AS pontual_operando,
            COALESCE(SUM(valorr) FILTER (WHERE status = 'ativo'), 0) AS mrr_ativo,
            COALESCE(SUM(valorr) FILTER (WHERE status = 'onboarding'), 0) AS mrr_onboarding,
            COALESCE(SUM(valorr) FILTER (WHERE status = 'em cancelamento'), 0) AS mrr_cancelamento
          FROM best GROUP BY pessoa, grupo
        )
        SELECT p.nome, p.grupo,
          COALESCE(a.contas_total, 0)      AS contas_total,
          COALESCE(a.contas_rec, 0)        AS contas_rec,
          COALESCE(a.contas_pont, 0)       AS contas_pont,
          COALESCE(a.clientes_total, 0)    AS clientes_total,
          COALESCE(a.clientes_rec, 0)      AS clientes_rec,
          COALESCE(a.clientes_pont, 0)     AS clientes_pont,
          COALESCE(a.mrr_operando, 0)      AS mrr_operando,
          COALESCE(a.pontual_operando, 0)  AS pontual_operando,
          COALESCE(a.mrr_ativo, 0)         AS mrr_ativo,
          COALESCE(a.mrr_onboarding, 0)    AS mrr_onboarding,
          COALESCE(a.mrr_cancelamento, 0)  AS mrr_cancelamento,
          cap.cap_mrr, cap.cap_contas, cap.cap_clientes
        FROM pessoas p
        LEFT JOIN agg a ON a.pessoa = p.nome
        LEFT JOIN LATERAL (
          SELECT m.cap_mrr, m.cap_contas, m.cap_clientes
          FROM cortex_core.capacity_metas m
          WHERE m.ativo = TRUE AND similarity(m.match_responsavel, p.nome) > 0.4
          ORDER BY similarity(m.match_responsavel, p.nome) DESC
          LIMIT 1
        ) cap ON TRUE
        ORDER BY p.grupo, (COALESCE(a.mrr_operando, 0) + COALESCE(a.pontual_operando, 0)) DESC
      `);

      // CXCS: carteira via `cs_responsavel` da subtask (não `responsavel`); régua MRR + contas.
      const cxcsResult = await db.execute(sql`
        WITH pessoas AS (
          SELECT r.nome FROM "Inhire".rh_pessoal r
          WHERE r.status = 'Ativo' AND r.cargo = 'CXCS'
            AND NOT EXISTS (
              SELECT 1 FROM (VALUES ${blackNomesValues}) AS bn(n)
              WHERE similarity(r.nome, bn.n) > 0.5
            )
        ),
        contratos_expanded AS (
          SELECT c.id_subtask, c.id_task, TRIM(rp.part) AS cs_part,
                 COALESCE(c.valorr, 0) AS valorr, COALESCE(c.valorp, 0) AS valorp, c.status
          FROM "Clickup".cup_contratos c
          CROSS JOIN LATERAL regexp_split_to_table(c.cs_responsavel, ';') AS rp(part)
          WHERE c.status IN ('ativo','onboarding','em cancelamento')
            AND c.cs_responsavel IS NOT NULL AND c.cs_responsavel <> ''
        ),
        best AS (
          SELECT DISTINCT ON (ce.id_subtask, ce.cs_part)
            p.nome AS pessoa, ce.id_subtask, ce.id_task, ce.valorr, ce.valorp, ce.status
          FROM contratos_expanded ce
          JOIN pessoas p ON similarity(p.nome, ce.cs_part) > 0.4
          ORDER BY ce.id_subtask, ce.cs_part, similarity(p.nome, ce.cs_part) DESC
        ),
        agg AS (
          SELECT pessoa,
            COUNT(DISTINCT id_subtask) FILTER (WHERE valorr > 0 OR valorp > 0) AS contas_total,
            COUNT(DISTINCT id_subtask) FILTER (WHERE valorr > 0) AS contas_rec,
            COUNT(DISTINCT id_subtask) FILTER (WHERE valorp > 0) AS contas_pont,
            COUNT(DISTINCT id_task) FILTER (WHERE valorr > 0 OR valorp > 0) AS clientes_total,
            COUNT(DISTINCT id_task) FILTER (WHERE valorr > 0) AS clientes_rec,
            COUNT(DISTINCT id_task) FILTER (WHERE valorp > 0) AS clientes_pont,
            COALESCE(SUM(valorr), 0) AS mrr_operando,
            COALESCE(SUM(valorp), 0) AS pontual_operando,
            COALESCE(SUM(valorr) FILTER (WHERE status = 'ativo'), 0) AS mrr_ativo,
            COALESCE(SUM(valorr) FILTER (WHERE status = 'onboarding'), 0) AS mrr_onboarding,
            COALESCE(SUM(valorr) FILTER (WHERE status = 'em cancelamento'), 0) AS mrr_cancelamento
          FROM best GROUP BY pessoa
        )
        SELECT p.nome,
          COALESCE(a.contas_total, 0)     AS contas_total,
          COALESCE(a.contas_rec, 0)       AS contas_rec,
          COALESCE(a.contas_pont, 0)      AS contas_pont,
          COALESCE(a.clientes_total, 0)   AS clientes_total,
          COALESCE(a.clientes_rec, 0)     AS clientes_rec,
          COALESCE(a.clientes_pont, 0)    AS clientes_pont,
          COALESCE(a.mrr_operando, 0)     AS mrr_operando,
          COALESCE(a.pontual_operando, 0) AS pontual_operando,
          COALESCE(a.mrr_ativo, 0)        AS mrr_ativo,
          COALESCE(a.mrr_onboarding, 0)   AS mrr_onboarding,
          COALESCE(a.mrr_cancelamento, 0) AS mrr_cancelamento,
          cap.cap_mrr, cap.cap_contas, cap.cap_clientes
        FROM pessoas p
        LEFT JOIN agg a ON a.pessoa = p.nome
        LEFT JOIN LATERAL (
          SELECT m.cap_mrr, m.cap_contas, m.cap_clientes
          FROM cortex_core.capacity_metas m
          WHERE m.ativo = TRUE AND similarity(m.match_responsavel, p.nome) > 0.4
          ORDER BY similarity(m.match_responsavel, p.nome) DESC
          LIMIT 1
        ) cap ON TRUE
        ORDER BY COALESCE(a.mrr_operando, 0) DESC
      `);

      // Black: cada account → clientes (cup_clientes.responsavel_geral) → subtasks desses
      // clientes. Régua igual aos outros squads (MRR + contas). "Contas" (contas_rec) =
      // nº de subtasks/contratos; "Clientes" (clientes_rec) = nº de clientes distintos que
      // cuida (cap_clientes default = CAP_CONTAS_ACCOUNT). Status: só ativo + em cancelamento.
      const blackResult = await db.execute(sql`
        WITH accounts(label, match) AS (VALUES ${accountsValues}),
        clientes_do_account AS (
          SELECT a.label, cl.task_id
          FROM accounts a
          JOIN "Clickup".cup_clientes cl ON EXISTS (
            SELECT 1 FROM regexp_split_to_table(COALESCE(cl.responsavel_geral, ''), ';') rp(part)
            WHERE TRIM(rp.part) = a.match
          )
        ),
        subs AS (
          SELECT cda.label, cda.task_id, c.id_subtask,
                 COALESCE(c.valorr, 0) AS vr, COALESCE(c.valorp, 0) AS vp, c.status
          FROM clientes_do_account cda
          JOIN "Clickup".cup_contratos c
            ON c.id_task = cda.task_id AND c.status IN ('ativo','em cancelamento')
        ),
        agg AS (
          SELECT label,
            COUNT(DISTINCT id_subtask) FILTER (WHERE vr > 0 OR vp > 0) AS contratos,
            COUNT(DISTINCT id_subtask) FILTER (WHERE vr > 0) AS contratos_rec,
            COUNT(DISTINCT id_subtask) FILTER (WHERE vp > 0) AS contratos_pont,
            COALESCE(SUM(vr), 0) AS mrr_operando,
            COALESCE(SUM(vp), 0) AS pontual_operando,
            COALESCE(SUM(vr) FILTER (WHERE status = 'ativo'), 0) AS mrr_ativo,
            COALESCE(SUM(vr) FILTER (WHERE status = 'em cancelamento'), 0) AS mrr_cancelamento
          FROM subs GROUP BY label
        ),
        -- cli conta sobre subs (contrato vivo), não sobre clientes_do_account
        -- (que casa por responsavel_geral sem olhar status do contrato) — senão um
        -- cliente cujos contratos estão todos cancelados ainda contaria como cliente.
        cli AS (
          SELECT label,
            COUNT(DISTINCT task_id) AS clientes,
            COUNT(DISTINCT task_id) FILTER (WHERE vr > 0) AS clientes_rec,
            COUNT(DISTINCT task_id) FILTER (WHERE vp > 0) AS clientes_pont
          FROM subs GROUP BY label
        )
        SELECT a.label AS nome, a.match,
          COALESCE(ag.mrr_operando, 0)     AS mrr_operando,
          COALESCE(ag.mrr_ativo, 0)        AS mrr_ativo,
          0                                AS mrr_onboarding,
          COALESCE(ag.mrr_cancelamento, 0) AS mrr_cancelamento,
          COALESCE(ag.pontual_operando, 0) AS pontual_operando,
          COALESCE(ag.contratos, 0)        AS contas_total,
          COALESCE(ag.contratos_rec, 0)    AS contas_rec,
          COALESCE(ag.contratos_pont, 0)   AS contas_pont,
          COALESCE(cli.clientes, 0)        AS clientes_total,
          COALESCE(cli.clientes_rec, 0)    AS clientes_rec,
          COALESCE(cli.clientes_pont, 0)   AS clientes_pont,
          cap.cap_mrr,
          cap.cap_contas,
          COALESCE(cap.cap_clientes, ${CAP_CONTAS_ACCOUNT}) AS cap_clientes
        FROM accounts a
        LEFT JOIN agg ag ON ag.label = a.label
        LEFT JOIN cli ON cli.label = a.label
        LEFT JOIN LATERAL (
          -- Só caps configuradas na categoria 'Black' (aba Configurar) sobrescrevem o default.
          SELECT m.cap_mrr, m.cap_contas, m.cap_clientes
          FROM cortex_core.capacity_metas m
          WHERE m.ativo = TRUE AND m.categoria = 'Black'
            AND similarity(m.match_responsavel, a.label) > 0.45
          ORDER BY similarity(m.match_responsavel, a.label) DESC
          LIMIT 1
        ) cap ON TRUE
        ORDER BY COALESCE(ag.mrr_operando, 0) DESC
      `);

      // Squads de comunicação (Pulse, Olimpo): operadores de CS em capacity_metas,
      // carteira via `responsavel ILIKE match_responsavel`. Capacity de contratos =
      // cap_contas (editável na Configurar), com fallback p/ o cap_recorrente legado.
      const squadsResult = await db.execute(sql`
        WITH m AS (
          SELECT nome, categoria, match_responsavel,
                 COALESCE(cap_contas, cap_recorrente) AS cap_contratos, cap_clientes, ordem
          FROM cortex_core.capacity_metas
          WHERE ativo = TRUE
            AND categoria NOT IN ('vendedor','account','gestor','Black','CXCS','Squadra','Selva')
        ),
        agg AS (
          SELECT m.nome, m.categoria, m.ordem, m.cap_contratos, m.cap_clientes,
            COUNT(DISTINCT c.id_subtask) FILTER (WHERE (COALESCE(c.valorr,0) > 0 OR COALESCE(c.valorp,0) > 0) AND c.status IN ('ativo','onboarding','em cancelamento')) AS contas_total,
            COUNT(*) FILTER (WHERE COALESCE(c.valorr,0) > 0 AND c.status IN ('ativo','onboarding','em cancelamento')) AS op_recorrente,
            COUNT(DISTINCT c.id_subtask) FILTER (WHERE COALESCE(c.valorr,0) > 0 AND c.status IN ('ativo','onboarding','em cancelamento')) AS contas_rec,
            COUNT(DISTINCT c.id_subtask) FILTER (WHERE COALESCE(c.valorp,0) > 0 AND c.status IN ('ativo','onboarding','em cancelamento')) AS contas_pont,
            COUNT(DISTINCT c.id_task) FILTER (WHERE (COALESCE(c.valorr,0) > 0 OR COALESCE(c.valorp,0) > 0) AND c.status IN ('ativo','onboarding','em cancelamento')) AS clientes_total,
            COUNT(DISTINCT c.id_task) FILTER (WHERE COALESCE(c.valorr,0) > 0 AND c.status IN ('ativo','onboarding','em cancelamento')) AS clientes_rec,
            COUNT(DISTINCT c.id_task) FILTER (WHERE COALESCE(c.valorp,0) > 0 AND c.status IN ('ativo','onboarding','em cancelamento')) AS clientes_pont,
            COALESCE(SUM(c.valorr) FILTER (WHERE COALESCE(c.valorr,0) > 0 AND c.status IN ('ativo','onboarding','em cancelamento')), 0) AS mrr_operando,
            COALESCE(SUM(c.valorr) FILTER (WHERE COALESCE(c.valorr,0) > 0 AND c.status = 'ativo'), 0) AS mrr_ativo,
            COALESCE(SUM(c.valorr) FILTER (WHERE COALESCE(c.valorr,0) > 0 AND c.status = 'onboarding'), 0) AS mrr_onboarding,
            COALESCE(SUM(c.valorr) FILTER (WHERE COALESCE(c.valorr,0) > 0 AND c.status = 'em cancelamento'), 0) AS mrr_cancelamento,
            COUNT(*) FILTER (WHERE COALESCE(c.valorp,0) > 0 AND c.status IN ('ativo','onboarding')) AS op_pontual,
            COALESCE(SUM(c.valorp) FILTER (WHERE COALESCE(c.valorp,0) > 0 AND c.status IN ('ativo','onboarding','em cancelamento')), 0) AS pontual_operando
          FROM m
          LEFT JOIN "Clickup".cup_contratos c ON c.responsavel ILIKE '%' || m.match_responsavel || '%'
          GROUP BY m.nome, m.categoria, m.ordem, m.cap_contratos, m.cap_clientes
        )
        SELECT * FROM agg ORDER BY categoria, ordem, nome
      `);
      // Agrupa por categoria (squad), preservando ordem de primeira aparição.
      const squads: SquadGroup[] = [];
      const squadIndex = new Map<string, SquadGroup>();
      for (const raw of squadsResult.rows as any[]) {
        const cat = String(raw.categoria);
        let group = squadIndex.get(cat);
        if (!group) { group = { squad: cat, rows: [] }; squadIndex.set(cat, group); squads.push(group); }
        group.rows.push(toCsRow(raw));
      }
      // Cap. FAT = ticket médio da equipe × capacity de contratos.
      squads.forEach(finalizeSquad);

      const rows = result.rows as any[];
      const response: CapacityTimesResponse = {
        selva: rows.filter((r) => r.grupo === "selva").map((r) => toSelvaRow(r, META_CONTAS_DESIGNER)),
        black: (blackResult.rows as any[]).map(toComercialRow),
        squadra: rows.filter((r) => r.grupo === "squadra").map(toComercialRow),
        cxcs: (cxcsResult.rows as any[]).map(toComercialRow),
        squads,
        metaContasDesigner: META_CONTAS_DESIGNER,
      };
      res.json(response);
    } catch (error) {
      console.error("[api] Error fetching capacity-times:", error);
      res.status(500).json({ error: "Failed to fetch capacity-times" });
    }
  });

  // GET /api/capacity-times/contratos?nome=<nome>[&campo=cs|geral] — carteira:
  //   campo=cs    → subtasks onde é cs_responsavel
  //   campo=geral → todas as subtasks dos clientes que cuida (responsavel_geral)
  //   default     → subtasks onde é responsavel
  app.get("/api/capacity-times/contratos", async (req, res) => {
    const nome = (req.query.nome as string | undefined)?.trim();
    const campo = (req.query.campo as string | undefined)?.trim();
    const usaCs = campo === "cs";
    if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
    try {
      if (campo === "geral") {
        const rows = (await db.execute(sql`
          SELECT DISTINCT ON (c.id_subtask)
                 cl.nome AS cliente, c.produto, c.status,
                 COALESCE(c.valorr, 0) AS valorr, COALESCE(c.valorp, 0) AS valorp, c.id_subtask
          FROM "Clickup".cup_clientes cl
          JOIN "Clickup".cup_contratos c
            ON c.id_task = cl.task_id AND c.status IN ('ativo','em cancelamento')
          WHERE EXISTS (
            SELECT 1 FROM regexp_split_to_table(COALESCE(cl.responsavel_geral, ''), ';') rp(part)
            WHERE TRIM(rp.part) = ${nome}
          )
          ORDER BY c.id_subtask
        `)).rows as any[];
        const ordemStatus: Record<string, number> = { ativo: 1, onboarding: 2 };
        rows.sort((a, b) =>
          (ordemStatus[a.status] ?? 3) - (ordemStatus[b.status] ?? 3) ||
          (Number(b.valorr) + Number(b.valorp)) - (Number(a.valorr) + Number(a.valorp)));
        return res.json({
          contratos: rows.map((r) => ({
            cliente: r.cliente || "—", produto: r.produto || "—", status: r.status as string,
            valorr: Number(r.valorr) || 0, valorp: Number(r.valorp) || 0, id_subtask: r.id_subtask ?? null,
          })),
        });
      }
      const rows = (await db.execute(usaCs ? sql`
        SELECT DISTINCT ON (c.id_subtask)
               cl.nome AS cliente, c.produto, c.status,
               COALESCE(c.valorr, 0) AS valorr, COALESCE(c.valorp, 0) AS valorp, c.id_subtask
        FROM "Clickup".cup_contratos c
        CROSS JOIN LATERAL regexp_split_to_table(c.cs_responsavel, ';') AS rp(part)
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE c.status IN ('ativo','onboarding','em cancelamento')
          AND c.cs_responsavel IS NOT NULL AND c.cs_responsavel <> ''
          AND similarity(TRIM(rp.part), ${nome}) > 0.4
        ORDER BY c.id_subtask
      ` : sql`
        SELECT DISTINCT ON (c.id_subtask)
               cl.nome AS cliente, c.produto, c.status,
               COALESCE(c.valorr, 0) AS valorr, COALESCE(c.valorp, 0) AS valorp, c.id_subtask
        FROM "Clickup".cup_contratos c
        CROSS JOIN LATERAL regexp_split_to_table(c.responsavel, ';') AS rp(part)
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE c.status IN ('ativo','onboarding','em cancelamento')
          AND c.responsavel IS NOT NULL AND c.responsavel <> ''
          AND similarity(TRIM(rp.part), ${nome}) > 0.4
        ORDER BY c.id_subtask
      `)).rows as any[];
      // ordena para exibição (ativo → onboarding → cancelamento, depois por valor)
      const ordemStatus: Record<string, number> = { ativo: 1, onboarding: 2 };
      rows.sort((a, b) =>
        (ordemStatus[a.status] ?? 3) - (ordemStatus[b.status] ?? 3) ||
        (Number(b.valorr) + Number(b.valorp)) - (Number(a.valorr) + Number(a.valorp)));

      res.json({
        contratos: rows.map((r) => ({
          cliente: r.cliente || "—",
          produto: r.produto || "—",
          status: r.status as string,
          valorr: Number(r.valorr) || 0,
          valorp: Number(r.valorp) || 0,
          id_subtask: r.id_subtask ?? null,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching capacity-times contratos:", error);
      res.status(500).json({ error: "Failed to fetch contratos" });
    }
  });

  // ── CRUD de capacity_metas (edição manual) ──

  function normalizeMetaRow(r: any) {
    const numOrNull = (v: any) => (v === null || v === undefined ? null : Number(v));
    return {
      id: Number(r.id),
      nome: String(r.nome),
      match_responsavel: String(r.match_responsavel),
      categoria: String(r.categoria),
      cap_recorrente: numOrNull(r.cap_recorrente),
      cap_mrr: numOrNull(r.cap_mrr),
      cap_pontual: numOrNull(r.cap_pontual),
      cap_contas: numOrNull(r.cap_contas),
      cap_clientes: numOrNull(r.cap_clientes),
      ordem: Number(r.ordem),
      ativo: Boolean(r.ativo),
    };
  }

  // GET /api/capacity-metas — lista TODAS as metas (inclusive inativas)
  app.get("/api/capacity-metas", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, match_responsavel, categoria,
               cap_recorrente, cap_mrr, cap_pontual, cap_contas, cap_clientes, ordem, ativo
        FROM cortex_core.capacity_metas
        ORDER BY ordem, nome
      `);
      res.json(result.rows.map(normalizeMetaRow));
    } catch (error) {
      console.error("[api] Error fetching capacity-metas:", error);
      res.status(500).json({ error: "Failed to fetch capacity-metas" });
    }
  });

  // GET /api/capacity-metas/responsaveis — responsáveis reais de cup_contratos (dropdown + prévia)
  app.get("/api/capacity-metas/responsaveis", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT TRIM(r.parte) AS responsavel,
               COUNT(DISTINCT c.id_subtask) AS contratos,
               COALESCE(SUM(c.valorr), 0)   AS mrr
        FROM "Clickup".cup_contratos c
        CROSS JOIN LATERAL regexp_split_to_table(c.responsavel, ';') AS r(parte)
        WHERE c.status IN ('ativo','onboarding','em cancelamento')
          AND c.responsavel IS NOT NULL AND c.responsavel <> ''
          AND TRIM(r.parte) <> ''
        GROUP BY TRIM(r.parte)
        ORDER BY mrr DESC
      `);
      res.json(result.rows.map((r: any) => ({
        responsavel: String(r.responsavel),
        contratos: Number(r.contratos),
        mrr: Number(r.mrr),
      })));
    } catch (error) {
      console.error("[api] Error fetching responsaveis:", error);
      res.status(500).json({ error: "Failed to fetch responsaveis" });
    }
  });

  // POST /api/capacity-metas — cria operador
  app.post("/api/capacity-metas", async (req, res) => {
    const parsed = capacityMetaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "dados inválidos" });
    }
    const m = parsed.data;
    try {
      const result = await db.execute(sql`
        INSERT INTO cortex_core.capacity_metas
          (nome, match_responsavel, categoria, cap_recorrente, cap_mrr, cap_pontual, cap_contas, cap_clientes, ordem, ativo)
        VALUES (${m.nome}, ${m.match_responsavel}, ${m.categoria}, ${m.cap_recorrente},
                ${m.cap_mrr}, ${m.cap_pontual}, ${m.cap_contas}, ${m.cap_clientes}, ${m.ordem}, ${m.ativo})
        RETURNING id
      `);
      res.status(201).json({ id: Number((result.rows[0] as any).id) });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Operador já cadastrado nesse time" });
      }
      console.error("[api] Error creating capacity-meta:", error);
      res.status(500).json({ error: "Failed to create capacity-meta" });
    }
  });

  // PUT /api/capacity-metas/:id — atualiza operador
  app.put("/api/capacity-metas/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });
    const parsed = capacityMetaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "dados inválidos" });
    }
    const m = parsed.data;
    try {
      const result = await db.execute(sql`
        UPDATE cortex_core.capacity_metas SET
          nome = ${m.nome}, match_responsavel = ${m.match_responsavel}, categoria = ${m.categoria},
          cap_recorrente = ${m.cap_recorrente}, cap_mrr = ${m.cap_mrr},
          cap_pontual = ${m.cap_pontual}, cap_contas = ${m.cap_contas},
          cap_clientes = ${m.cap_clientes},
          ordem = ${m.ordem}, ativo = ${m.ativo}, atualizado_em = NOW()
        WHERE id = ${id}
        RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "operador não encontrado" });
      res.json({ id });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Operador já cadastrado nesse time" });
      }
      console.error("[api] Error updating capacity-meta:", error);
      res.status(500).json({ error: "Failed to update capacity-meta" });
    }
  });

  // DELETE /api/capacity-metas/:id — hard delete
  app.delete("/api/capacity-metas/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });
    try {
      await db.execute(sql`DELETE FROM cortex_core.capacity_metas WHERE id = ${id}`);
      res.status(204).end();
    } catch (error) {
      console.error("[api] Error deleting capacity-meta:", error);
      res.status(500).json({ error: "Failed to delete capacity-meta" });
    }
  });

  // ── Endpoints legados (mantidos para compatibilidade) ──

  app.get("/api/capacity", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.capacity_operador ORDER BY squad, operador, produto
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching capacity:", error);
      res.status(500).json({ error: "Failed to fetch capacity" });
    }
  });
}

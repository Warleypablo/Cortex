import type { Express } from "express";
import { sql } from "drizzle-orm";

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

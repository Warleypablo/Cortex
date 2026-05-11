import type { Express } from "express";
import { sql } from "drizzle-orm";

interface MixReceitaItem {
  produto: string;
  contratos: number;
  qtd_recorrente: number;
  qtd_pontual: number;
  mrr_recorrente: number;
  total_pontual: number;
  receita_total: number;
  pct_recorrente: number;
}

interface MixReceitaResponse {
  itens: MixReceitaItem[];
  por_squad: Array<{
    squad: string;
    produto: string;
    contratos: number;
    mrr_recorrente: number;
    total_pontual: number;
  }>;
  totais: {
    contratos: number;
    mrr_recorrente: number;
    total_pontual: number;
    receita_total: number;
    pct_recorrente: number;
    produtos_distintos: number;
  };
  status_disponiveis: string[];
  squads_disponiveis: string[];
  status_filtro: string[];
}

const STATUS_PADRAO = ["ativo", "em cancelamento", "pausado", "entregue", "onboarding"];

export function registerMixReceitaRoutes(app: Express, db: any) {
  app.get("/api/financeiro/mix-receita", async (req, res) => {
    try {
      const statusQuery = (req.query.status as string) || "";
      const squadQuery = (req.query.squad as string) || "";

      const statusFiltro = statusQuery
        ? statusQuery.split(",").map((s) => s.trim()).filter(Boolean)
        : STATUS_PADRAO;

      const squadFilter = squadQuery && squadQuery !== "todos"
        ? sql` AND squad = ${squadQuery}`
        : sql``;

      // 1. Mix por produto
      const itensResult = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(produto), ''), '(sem produto)') AS produto,
          COUNT(*)::int AS contratos,
          SUM(CASE WHEN COALESCE(valorr::numeric, 0) > 0 THEN 1 ELSE 0 END)::int AS qtd_recorrente,
          SUM(CASE WHEN COALESCE(valorp::numeric, 0) > 0 THEN 1 ELSE 0 END)::int AS qtd_pontual,
          COALESCE(SUM(valorr::numeric), 0)::float AS mrr_recorrente,
          COALESCE(SUM(valorp::numeric), 0)::float AS total_pontual
        FROM "Clickup".cup_contratos
        WHERE status = ANY(${statusFiltro})
          ${squadFilter}
        GROUP BY 1
        ORDER BY (COALESCE(SUM(valorr::numeric), 0) + COALESCE(SUM(valorp::numeric), 0)) DESC
      `);

      const itens: MixReceitaItem[] = itensResult.rows.map((r: any) => {
        const mrr = Number(r.mrr_recorrente) || 0;
        const pontual = Number(r.total_pontual) || 0;
        const total = mrr + pontual;
        return {
          produto: r.produto,
          contratos: Number(r.contratos) || 0,
          qtd_recorrente: Number(r.qtd_recorrente) || 0,
          qtd_pontual: Number(r.qtd_pontual) || 0,
          mrr_recorrente: mrr,
          total_pontual: pontual,
          receita_total: total,
          pct_recorrente: total > 0 ? (mrr / total) * 100 : 0,
        };
      });

      // 2. Quebra por squad x produto (para drill)
      const porSquadResult = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(squad), ''), '(sem squad)') AS squad,
          COALESCE(NULLIF(TRIM(produto), ''), '(sem produto)') AS produto,
          COUNT(*)::int AS contratos,
          COALESCE(SUM(valorr::numeric), 0)::float AS mrr_recorrente,
          COALESCE(SUM(valorp::numeric), 0)::float AS total_pontual
        FROM "Clickup".cup_contratos
        WHERE status = ANY(${statusFiltro})
          ${squadFilter}
        GROUP BY 1, 2
        ORDER BY (COALESCE(SUM(valorr::numeric), 0) + COALESCE(SUM(valorp::numeric), 0)) DESC
      `);

      const por_squad = porSquadResult.rows.map((r: any) => ({
        squad: r.squad,
        produto: r.produto,
        contratos: Number(r.contratos) || 0,
        mrr_recorrente: Number(r.mrr_recorrente) || 0,
        total_pontual: Number(r.total_pontual) || 0,
      }));

      // 3. Listas de filtros disponíveis
      const statusResult = await db.execute(sql`
        SELECT DISTINCT status FROM "Clickup".cup_contratos
        WHERE status IS NOT NULL AND status != ''
        ORDER BY status
      `);
      const squadsResult = await db.execute(sql`
        SELECT DISTINCT TRIM(squad) AS squad FROM "Clickup".cup_contratos
        WHERE squad IS NOT NULL AND TRIM(squad) != ''
        ORDER BY squad
      `);

      // 4. Totais
      const totalContratos = itens.reduce((s, i) => s + i.contratos, 0);
      const totalMrr = itens.reduce((s, i) => s + i.mrr_recorrente, 0);
      const totalPontual = itens.reduce((s, i) => s + i.total_pontual, 0);
      const receitaTotal = totalMrr + totalPontual;

      const response: MixReceitaResponse = {
        itens,
        por_squad,
        totais: {
          contratos: totalContratos,
          mrr_recorrente: totalMrr,
          total_pontual: totalPontual,
          receita_total: receitaTotal,
          pct_recorrente: receitaTotal > 0 ? (totalMrr / receitaTotal) * 100 : 0,
          produtos_distintos: itens.length,
        },
        status_disponiveis: statusResult.rows.map((r: any) => r.status as string),
        squads_disponiveis: squadsResult.rows.map((r: any) => r.squad as string),
        status_filtro: statusFiltro,
      };

      res.json(response);
    } catch (error) {
      console.error("[api] Error fetching mix-receita:", error);
      res.status(500).json({ error: "Failed to fetch mix de receita" });
    }
  });
}

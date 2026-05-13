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

interface ContratoCliente {
  cliente_nome: string;
  id_task: string;
  id_subtask: string;
  mrr_recorrente: number;
  total_pontual: number;
  total: number;
  squad: string;
  responsavel: string;
  status: string;
}

interface ClientesPorProdutoResponse {
  produto: string;
  contratos: ContratoCliente[];
  totais: {
    contratos: number;
    mrr_recorrente: number;
    total_pontual: number;
    receita_total: number;
  };
}

const STATUS_PADRAO = ["ativo", "em cancelamento", "pausado", "onboarding"];

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

      const statusList = sql.join(
        statusFiltro.map((s) => sql`${s}`),
        sql`, `
      );

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
        WHERE status IN (${statusList})
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
        WHERE status IN (${statusList})
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

  app.get("/api/financeiro/mix-receita/clientes", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || "";
      if (!produto) {
        return res.status(400).json({ error: "produto é obrigatório" });
      }

      const statusQuery = (req.query.status as string) || "";
      const squadQuery = (req.query.squad as string) || "";

      const statusFiltro = statusQuery
        ? statusQuery.split(",").map((s) => s.trim()).filter(Boolean)
        : STATUS_PADRAO;

      const squadFilter = squadQuery && squadQuery !== "todos"
        ? sql` AND co.squad = ${squadQuery}`
        : sql``;

      const statusList = sql.join(
        statusFiltro.map((s) => sql`${s}`),
        sql`, `
      );

      const result = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(cc.nome), ''), '(cliente não identificado)') AS cliente_nome,
          co.id_task,
          co.id_subtask,
          COALESCE(co.valorr::numeric, 0)::float AS mrr_recorrente,
          COALESCE(co.valorp::numeric, 0)::float AS total_pontual,
          (COALESCE(co.valorr::numeric, 0) + COALESCE(co.valorp::numeric, 0))::float AS total,
          COALESCE(NULLIF(TRIM(co.squad), ''), '(sem squad)') AS squad,
          COALESCE(NULLIF(TRIM(co.responsavel), ''), '(sem responsável)') AS responsavel,
          co.status
        FROM "Clickup".cup_contratos co
        LEFT JOIN "Clickup".cup_clientes cc ON co.id_task = cc.task_id
        WHERE COALESCE(NULLIF(TRIM(co.produto), ''), '(sem produto)') = ${produto}
          AND co.status IN (${statusList})
          ${squadFilter}
        ORDER BY total DESC, cliente_nome ASC
      `);

      const contratos: ContratoCliente[] = result.rows.map((r: any) => ({
        cliente_nome: r.cliente_nome,
        id_task: r.id_task,
        id_subtask: r.id_subtask,
        mrr_recorrente: Number(r.mrr_recorrente) || 0,
        total_pontual: Number(r.total_pontual) || 0,
        total: Number(r.total) || 0,
        squad: r.squad,
        responsavel: r.responsavel,
        status: r.status,
      }));

      const totalMrr = contratos.reduce((s, c) => s + c.mrr_recorrente, 0);
      const totalPontual = contratos.reduce((s, c) => s + c.total_pontual, 0);

      const response: ClientesPorProdutoResponse = {
        produto,
        contratos,
        totais: {
          contratos: contratos.length,
          mrr_recorrente: totalMrr,
          total_pontual: totalPontual,
          receita_total: totalMrr + totalPontual,
        },
      };

      res.json(response);
    } catch (error) {
      console.error("[api] Error fetching mix-receita clientes:", error);
      res.status(500).json({ error: "Failed to fetch clientes por produto" });
    }
  });

  // Análise temporal: vendido (data_inicio) ou realizado (caz_parcelas com rateio)
  app.get("/api/financeiro/mix-receita/temporal", async (req, res) => {
    try {
      const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
      const modo = ((req.query.modo as string) || "vendido") as "vendido" | "realizado";
      const squadQuery = (req.query.squad as string) || "";
      const squadFilter = squadQuery && squadQuery !== "todos"
        ? sql` AND co.squad = ${squadQuery}`
        : sql``;

      let rows: any[] = [];

      if (modo === "vendido") {
        // Vendido = contratos com data_inicio no ano, agrupados por mês + produto
        const result = await db.execute(sql`
          SELECT
            EXTRACT(MONTH FROM co.data_inicio::date)::int AS mes,
            COALESCE(NULLIF(TRIM(co.produto), ''), '(sem produto)') AS produto,
            COUNT(*)::int AS contratos,
            COALESCE(SUM(co.valorr::numeric), 0)::float AS mrr_recorrente,
            COALESCE(SUM(co.valorp::numeric), 0)::float AS total_pontual
          FROM "Clickup".cup_contratos co
          WHERE co.data_inicio IS NOT NULL
            AND EXTRACT(YEAR FROM co.data_inicio::date) = ${ano}
            ${squadFilter}
          GROUP BY 1, 2
          ORDER BY 1, 2
        `);
        rows = result.rows;
      } else {
        // Realizado = caz_parcelas rateada por produto (peso = receita_produto/receita_total_cliente)
        const result = await db.execute(sql`
          WITH carteira AS (
            SELECT
              cc.task_id,
              COALESCE(NULLIF(TRIM(co.produto), ''), '(sem produto)') AS produto,
              SUM(COALESCE(co.valorr::numeric, 0)) AS mrr_produto,
              SUM(COALESCE(co.valorp::numeric, 0)) AS pontual_produto
            FROM "Clickup".cup_clientes cc
            JOIN "Clickup".cup_contratos co ON co.id_task = cc.task_id
            WHERE 1=1 ${squadFilter}
            GROUP BY cc.task_id, COALESCE(NULLIF(TRIM(co.produto), ''), '(sem produto)')
          ),
          totais AS (
            SELECT task_id, SUM(mrr_produto + pontual_produto) AS total_carteira
            FROM carteira GROUP BY task_id
          ),
          pesos AS (
            SELECT
              c.task_id,
              c.produto,
              CASE WHEN t.total_carteira > 0
                   THEN (c.mrr_produto + c.pontual_produto) / t.total_carteira
                   ELSE 0 END AS peso_produto,
              CASE WHEN (c.mrr_produto + c.pontual_produto) > 0
                   THEN c.mrr_produto / (c.mrr_produto + c.pontual_produto)
                   ELSE 0 END AS pct_recorrente
            FROM carteira c
            JOIN totais t ON t.task_id = c.task_id
          ),
          parcelas_mes AS (
            SELECT
              cc.task_id,
              EXTRACT(MONTH FROM p.data_quitacao::date)::int AS mes,
              SUM(p.valor_pago::numeric) AS receita
            FROM "Conta Azul".caz_parcelas p
            JOIN "Conta Azul".caz_clientes ca ON p.id_cliente::text = ca.ids
            JOIN "Clickup".cup_clientes cc ON cc.cnpj = ca.cnpj::text
            WHERE p.status = 'QUITADO'
              AND p.tipo_evento = 'RECEITA'
              AND EXTRACT(YEAR FROM p.data_quitacao::date) = ${ano}
            GROUP BY cc.task_id, EXTRACT(MONTH FROM p.data_quitacao::date)
          )
          SELECT
            pm.mes,
            pe.produto,
            COUNT(DISTINCT pm.task_id)::int AS contratos,
            SUM(pm.receita * pe.peso_produto * pe.pct_recorrente)::float AS mrr_recorrente,
            SUM(pm.receita * pe.peso_produto * (1 - pe.pct_recorrente))::float AS total_pontual
          FROM parcelas_mes pm
          JOIN pesos pe ON pe.task_id = pm.task_id
          GROUP BY pm.mes, pe.produto
          ORDER BY pm.mes, pe.produto
        `);
        rows = result.rows;
      }

      // Estrutura: produtos com 12 meses
      const produtosMap = new Map<string, {
        produto: string;
        meses: Record<number, { mrr: number; pontual: number; contratos: number }>;
        total_mrr: number;
        total_pontual: number;
        total_contratos: number;
      }>();
      const totaisMensais: Record<number, { mrr: number; pontual: number; contratos: number }> = {};
      const mesesComDados = new Set<number>();

      for (const r of rows) {
        const mes = Number(r.mes);
        const produto = r.produto as string;
        const mrr = Number(r.mrr_recorrente) || 0;
        const pontual = Number(r.total_pontual) || 0;
        const contratos = Number(r.contratos) || 0;

        if (mrr === 0 && pontual === 0) continue;
        mesesComDados.add(mes);

        if (!produtosMap.has(produto)) {
          produtosMap.set(produto, {
            produto,
            meses: {},
            total_mrr: 0,
            total_pontual: 0,
            total_contratos: 0,
          });
        }
        const p = produtosMap.get(produto)!;
        p.meses[mes] = { mrr, pontual, contratos };
        p.total_mrr += mrr;
        p.total_pontual += pontual;
        p.total_contratos += contratos;

        if (!totaisMensais[mes]) totaisMensais[mes] = { mrr: 0, pontual: 0, contratos: 0 };
        totaisMensais[mes].mrr += mrr;
        totaisMensais[mes].pontual += pontual;
        totaisMensais[mes].contratos += contratos;
      }

      const produtos = Array.from(produtosMap.values()).sort(
        (a, b) => (b.total_mrr + b.total_pontual) - (a.total_mrr + a.total_pontual)
      );

      // Squads disponíveis para filtro
      const squadsResult = await db.execute(sql`
        SELECT DISTINCT TRIM(squad) AS squad FROM "Clickup".cup_contratos
        WHERE squad IS NOT NULL AND TRIM(squad) != ''
        ORDER BY squad
      `);

      // Anos disponíveis (com base no modo)
      const anosResult = modo === "vendido"
        ? await db.execute(sql`
            SELECT DISTINCT EXTRACT(YEAR FROM data_inicio::date)::int AS ano
            FROM "Clickup".cup_contratos
            WHERE data_inicio IS NOT NULL
            ORDER BY ano DESC
          `)
        : await db.execute(sql`
            SELECT DISTINCT EXTRACT(YEAR FROM data_quitacao::date)::int AS ano
            FROM "Conta Azul".caz_parcelas
            WHERE status='QUITADO' AND data_quitacao IS NOT NULL
            ORDER BY ano DESC
          `);

      res.json({
        ano,
        modo,
        meses_com_dados: Array.from(mesesComDados).sort((a, b) => a - b),
        produtos,
        totais_mensais: totaisMensais,
        anos_disponiveis: anosResult.rows.map((r: any) => Number(r.ano)),
        squads_disponiveis: squadsResult.rows.map((r: any) => r.squad as string),
      });
    } catch (error) {
      console.error("[api] Error fetching mix-receita temporal:", error);
      res.status(500).json({ error: "Failed to fetch evolução temporal" });
    }
  });
}

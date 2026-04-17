import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerCrossSellRoutes(app: Express) {
  // ==================== CROSS-SELL MANAGEMENT ====================

  // 1. GET /api/comercial/crosssell — List oportunidades with filters
  app.get("/api/comercial/crosssell", async (req, res) => {
    try {
      const { cluster, cx, etapa, produto } = req.query;

      const conditions: string[] = [];
      const params: any[] = [];

      // Default: exclude 'ganho' (only active pipeline)
      conditions.push(`o.etapa NOT IN ('ganho')`);

      if (cluster && typeof cluster === "string") {
        params.push(cluster);
        conditions.push(`c.cluster = $${params.length}`);
      }
      if (cx && typeof cx === "string") {
        params.push(cx);
        conditions.push(`o.cx_responsavel = $${params.length}`);
      }
      if (etapa && typeof etapa === "string") {
        params.push(etapa);
        conditions.push(`o.etapa = $${params.length}`);
      }
      if (produto && typeof produto === "string") {
        params.push(produto);
        conditions.push(`o.produto_mapeado = $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const query = `
        SELECT
          o.id,
          o.cliente_id,
          o.cnpj,
          c.nome AS cliente_nome,
          c.status AS cliente_status,
          c.cluster,
          c.responsavel AS cx_cliente,
          o.produto_mapeado,
          o.etapa,
          o.valor_r_negociacao,
          o.valor_p_negociacao,
          o.cx_responsavel,
          o.ultimo_contato,
          o.criado_em,
          o.atualizado_em,
          COALESCE(contratos.valor_r_atual, 0) AS valor_r_atual,
          COALESCE(contratos.valor_p_atual, 0) AS valor_p_atual,
          contratos.contrato_inicio,
          COALESCE(comentarios.total, 0) AS total_comentarios
        FROM cortex_core.crosssell_oportunidades o
        LEFT JOIN "Clickup".cup_clientes c ON c.cnpj = o.cnpj
        LEFT JOIN LATERAL (
          SELECT
            SUM(ct.valorr) AS valor_r_atual,
            SUM(ct.valorp) AS valor_p_atual,
            MIN(ct.data_inicio) AS contrato_inicio
          FROM "Clickup".cup_contratos ct
          WHERE ct.cnpj = o.cnpj AND ct.status IN ('ativo', 'Ativo', 'ATIVO')
        ) contratos ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total
          FROM cortex_core.crosssell_comentarios cm
          WHERE cm.oportunidade_id = o.id
        ) comentarios ON true
        ${whereClause}
        ORDER BY o.atualizado_em DESC
      `;

      const result = await db.execute(sql.raw(
        params.length > 0
          ? params.reduce((q, val, i) => q.replace(`$${i + 1}`, `'${String(val).replace(/'/g, "''")}'`), query)
          : query
      ));

      const rows = (result.rows as any[]).map((r) => ({
        id: r.id,
        clienteId: r.cliente_id,
        cnpj: r.cnpj,
        clienteNome: r.cliente_nome,
        clienteStatus: r.cliente_status,
        cluster: r.cluster,
        cxCliente: r.cx_cliente,
        produtoMapeado: r.produto_mapeado,
        etapa: r.etapa,
        valorRNegociacao: r.valor_r_negociacao ? Number(r.valor_r_negociacao) : null,
        valorPNegociacao: r.valor_p_negociacao ? Number(r.valor_p_negociacao) : null,
        cxResponsavel: r.cx_responsavel,
        ultimoContato: r.ultimo_contato,
        criadoEm: r.criado_em,
        atualizadoEm: r.atualizado_em,
        valorRAtual: Number(r.valor_r_atual),
        valorPAtual: Number(r.valor_p_atual),
        contratoInicio: r.contrato_inicio,
        totalComentarios: Number(r.total_comentarios),
      }));

      res.json(rows);
    } catch (error) {
      console.error("[crosssell] Error listing oportunidades:", error);
      res.status(500).json({ error: "Failed to list oportunidades" });
    }
  });

  // 2. POST /api/comercial/crosssell — Create oportunidade
  app.post("/api/comercial/crosssell", async (req, res) => {
    try {
      const { clienteId, cnpj, produtoMapeado, cxResponsavel, valorRNegociacao, valorPNegociacao } = req.body;

      if (!clienteId || !cnpj || !produtoMapeado || !cxResponsavel) {
        return res.status(400).json({ error: "clienteId, cnpj, produtoMapeado, cxResponsavel são obrigatórios" });
      }

      const result = await db.execute(sql`
        INSERT INTO cortex_core.crosssell_oportunidades
          (cliente_id, cnpj, produto_mapeado, cx_responsavel, valor_r_negociacao, valor_p_negociacao, etapa)
        VALUES
          (${clienteId}, ${cnpj}, ${produtoMapeado}, ${cxResponsavel}, ${valorRNegociacao || null}, ${valorPNegociacao || null}, 'fazer_contato')
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[crosssell] Error creating oportunidade:", error);
      res.status(500).json({ error: "Failed to create oportunidade" });
    }
  });

  // 3. PATCH /api/comercial/crosssell/:id — Update oportunidade
  app.patch("/api/comercial/crosssell/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { etapa, valorRNegociacao, valorPNegociacao, ultimoContato, alteradoPor } = req.body;

      // If etapa is changing, log the transition
      if (etapa) {
        const current = await db.execute(sql`
          SELECT etapa FROM cortex_core.crosssell_oportunidades WHERE id = ${Number(id)}
        `);
        if (current.rows.length === 0) {
          return res.status(404).json({ error: "Oportunidade não encontrada" });
        }
        const etapaAnterior = (current.rows[0] as any).etapa;
        if (etapaAnterior !== etapa) {
          await db.execute(sql`
            INSERT INTO cortex_core.crosssell_etapa_log (oportunidade_id, etapa_anterior, etapa_nova, alterado_por)
            VALUES (${Number(id)}, ${etapaAnterior}, ${etapa}, ${alteradoPor || 'sistema'})
          `);
        }
      }

      // Build dynamic SET clause
      const setClauses: string[] = ["atualizado_em = NOW()"];
      const values: any[] = [];

      if (etapa !== undefined) {
        values.push(etapa);
        setClauses.push(`etapa = $${values.length}`);
      }
      if (valorRNegociacao !== undefined) {
        values.push(valorRNegociacao);
        setClauses.push(`valor_r_negociacao = $${values.length}`);
      }
      if (valorPNegociacao !== undefined) {
        values.push(valorPNegociacao);
        setClauses.push(`valor_p_negociacao = $${values.length}`);
      }
      if (ultimoContato !== undefined) {
        values.push(ultimoContato);
        setClauses.push(`ultimo_contato = $${values.length}`);
      }

      const setClause = setClauses.join(", ");
      const updateQuery = `UPDATE cortex_core.crosssell_oportunidades SET ${setClause} WHERE id = ${Number(id)} RETURNING *`;

      const result = await db.execute(sql.raw(
        values.length > 0
          ? values.reduce((q, val, i) => q.replace(`$${i + 1}`, val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`), updateQuery)
          : updateQuery
      ));

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Oportunidade não encontrada" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("[crosssell] Error updating oportunidade:", error);
      res.status(500).json({ error: "Failed to update oportunidade" });
    }
  });

  // 4. GET /api/comercial/crosssell/:id/comentarios — List comments
  app.get("/api/comercial/crosssell/:id/comentarios", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`
        SELECT id, oportunidade_id, autor, texto, criado_em
        FROM cortex_core.crosssell_comentarios
        WHERE oportunidade_id = ${Number(id)}
        ORDER BY criado_em DESC
      `);

      const rows = (result.rows as any[]).map((r) => ({
        id: r.id,
        oportunidadeId: r.oportunidade_id,
        autor: r.autor,
        texto: r.texto,
        criadoEm: r.criado_em,
      }));

      res.json(rows);
    } catch (error) {
      console.error("[crosssell] Error listing comentarios:", error);
      res.status(500).json({ error: "Failed to list comentarios" });
    }
  });

  // 5. POST /api/comercial/crosssell/:id/comentarios — Add comment
  app.post("/api/comercial/crosssell/:id/comentarios", async (req, res) => {
    try {
      const { id } = req.params;
      const { autor, texto } = req.body;

      if (!autor || !texto) {
        return res.status(400).json({ error: "autor e texto são obrigatórios" });
      }

      const result = await db.execute(sql`
        INSERT INTO cortex_core.crosssell_comentarios (oportunidade_id, autor, texto)
        VALUES (${Number(id)}, ${autor}, ${texto})
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[crosssell] Error creating comentario:", error);
      res.status(500).json({ error: "Failed to create comentario" });
    }
  });

  // 6. POST /api/comercial/crosssell/:id/ganho — Convert to won deal
  app.post("/api/comercial/crosssell/:id/ganho", async (req, res) => {
    try {
      const { id } = req.params;
      const { operacao, produto, mesGanho, valorR, valorP } = req.body;

      if (!operacao || !produto || !mesGanho) {
        return res.status(400).json({ error: "operacao, produto e mesGanho são obrigatórios" });
      }

      // Get oportunidade + client name
      const opResult = await db.execute(sql`
        SELECT o.*, c.nome AS cliente_nome
        FROM cortex_core.crosssell_oportunidades o
        LEFT JOIN "Clickup".cup_clientes c ON c.cnpj = o.cnpj
        WHERE o.id = ${Number(id)}
      `);

      if (opResult.rows.length === 0) {
        return res.status(404).json({ error: "Oportunidade não encontrada" });
      }

      const op = opResult.rows[0] as any;
      const finalValorR = valorR ?? op.valor_r_negociacao;
      const finalValorP = valorP ?? op.valor_p_negociacao;

      // Insert into negocios_ganhos
      const ganhoResult = await db.execute(sql`
        INSERT INTO cortex_core.crosssell_negocios_ganhos
          (oportunidade_id, cliente_nome, cnpj, valor_r, valor_p, cx_responsavel, operacao, produto, mes_ganho)
        VALUES
          (${Number(id)}, ${op.cliente_nome || 'N/A'}, ${op.cnpj}, ${finalValorR}, ${finalValorP}, ${op.cx_responsavel}, ${operacao}, ${produto}, ${mesGanho})
        RETURNING *
      `);

      // Update etapa to 'ganho'
      await db.execute(sql`
        UPDATE cortex_core.crosssell_oportunidades
        SET etapa = 'ganho', atualizado_em = NOW()
        WHERE id = ${Number(id)}
      `);

      // Log etapa change
      await db.execute(sql`
        INSERT INTO cortex_core.crosssell_etapa_log (oportunidade_id, etapa_anterior, etapa_nova, alterado_por)
        VALUES (${Number(id)}, ${op.etapa}, 'ganho', ${op.cx_responsavel || 'sistema'})
      `);

      res.status(201).json(ganhoResult.rows[0]);
    } catch (error) {
      console.error("[crosssell] Error converting to ganho:", error);
      res.status(500).json({ error: "Failed to convert to ganho" });
    }
  });

  // 7. GET /api/comercial/crosssell/ganhos — List won deals
  app.get("/api/comercial/crosssell/ganhos", async (req, res) => {
    try {
      const { mes, ano } = req.query;

      let whereClause = "";
      if (mes && ano) {
        whereClause = `WHERE EXTRACT(MONTH FROM mes_ganho) = ${Number(mes)} AND EXTRACT(YEAR FROM mes_ganho) = ${Number(ano)}`;
      } else if (ano) {
        whereClause = `WHERE EXTRACT(YEAR FROM mes_ganho) = ${Number(ano)}`;
      }

      const result = await db.execute(sql.raw(`
        SELECT *
        FROM cortex_core.crosssell_negocios_ganhos
        ${whereClause}
        ORDER BY criado_em DESC
      `));

      const rows = (result.rows as any[]).map((r) => ({
        id: r.id,
        oportunidadeId: r.oportunidade_id,
        clienteNome: r.cliente_nome,
        cnpj: r.cnpj,
        valorR: r.valor_r ? Number(r.valor_r) : null,
        valorP: r.valor_p ? Number(r.valor_p) : null,
        cxResponsavel: r.cx_responsavel,
        operacao: r.operacao,
        produto: r.produto,
        mesGanho: r.mes_ganho,
        criadoEm: r.criado_em,
      }));

      res.json(rows);
    } catch (error) {
      console.error("[crosssell] Error listing ganhos:", error);
      res.status(500).json({ error: "Failed to list ganhos" });
    }
  });

  // 8. GET /api/comercial/crosssell/dashboard — Dashboard analytics
  app.get("/api/comercial/crosssell/dashboard", async (req, res) => {
    try {
      const { mes, ano } = req.query;

      // Build date filter for ganhos
      let ganhoDateFilter = "";
      if (mes && ano) {
        ganhoDateFilter = `AND EXTRACT(MONTH FROM ng.mes_ganho) = ${Number(mes)} AND EXTRACT(YEAR FROM ng.mes_ganho) = ${Number(ano)}`;
      } else if (ano) {
        ganhoDateFilter = `AND EXTRACT(YEAR FROM ng.mes_ganho) = ${Number(ano)}`;
      }

      // Build date filter for oportunidades (by criado_em)
      let opDateFilter = "";
      if (mes && ano) {
        opDateFilter = `AND EXTRACT(MONTH FROM o.criado_em) = ${Number(mes)} AND EXTRACT(YEAR FROM o.criado_em) = ${Number(ano)}`;
      } else if (ano) {
        opDateFilter = `AND EXTRACT(YEAR FROM o.criado_em) = ${Number(ano)}`;
      }

      const [kpisResult, funilResult, reunioesPorCxResult, rankingValorResult, rankingReunioesResult] = await Promise.all([
        // KPIs
        db.execute(sql.raw(`
          SELECT
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'reuniao_agendada' ${opDateFilter}) AS reunioes_agendadas,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'reuniao_realizada' ${opDateFilter}) AS reunioes_realizadas,
            (SELECT COALESCE(SUM(o.valor_r_negociacao), 0) FROM cortex_core.crosssell_oportunidades o WHERE o.etapa NOT IN ('ganho', 'perdido') ${opDateFilter}) AS total_r_negociacao,
            (SELECT COALESCE(SUM(o.valor_p_negociacao), 0) FROM cortex_core.crosssell_oportunidades o WHERE o.etapa NOT IN ('ganho', 'perdido') ${opDateFilter}) AS total_p_negociacao,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_negocios_ganhos ng WHERE 1=1 ${ganhoDateFilter}) AS total_ganhos,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE 1=1 ${opDateFilter}) AS total_oportunidades
        `)),

        // Funil por etapa
        db.execute(sql.raw(`
          SELECT o.etapa, COUNT(*)::int AS total
          FROM cortex_core.crosssell_oportunidades o
          WHERE 1=1 ${opDateFilter}
          GROUP BY o.etapa
          ORDER BY total DESC
        `)),

        // Reuniões por CX
        db.execute(sql.raw(`
          SELECT o.cx_responsavel, COUNT(*)::int AS total
          FROM cortex_core.crosssell_oportunidades o
          WHERE o.etapa IN ('reuniao_agendada', 'reuniao_realizada') ${opDateFilter}
          GROUP BY o.cx_responsavel
          ORDER BY total DESC
        `)),

        // Ranking por valor
        db.execute(sql.raw(`
          SELECT ng.cx_responsavel, SUM(ng.valor_r) AS total_r, SUM(ng.valor_p) AS total_p, COUNT(*)::int AS total_deals
          FROM cortex_core.crosssell_negocios_ganhos ng
          WHERE 1=1 ${ganhoDateFilter}
          GROUP BY ng.cx_responsavel
          ORDER BY total_r DESC NULLS LAST
        `)),

        // Ranking por reuniões
        db.execute(sql.raw(`
          SELECT o.cx_responsavel, COUNT(*)::int AS total_reunioes
          FROM cortex_core.crosssell_etapa_log el
          JOIN cortex_core.crosssell_oportunidades o ON o.id = el.oportunidade_id
          WHERE el.etapa_nova IN ('reuniao_agendada', 'reuniao_realizada')
          ${opDateFilter ? opDateFilter.replace(/o\.criado_em/g, 'el.criado_em') : ''}
          GROUP BY o.cx_responsavel
          ORDER BY total_reunioes DESC
        `)),
      ]);

      const kpis = kpisResult.rows[0] as any;
      const totalOps = Number(kpis.total_oportunidades) || 1;
      const totalGanhos = Number(kpis.total_ganhos);

      res.json({
        kpis: {
          reunioesAgendadas: Number(kpis.reunioes_agendadas),
          reunioesRealizadas: Number(kpis.reunioes_realizadas),
          totalRNegociacao: Number(kpis.total_r_negociacao),
          totalPNegociacao: Number(kpis.total_p_negociacao),
          taxaConversao: Number(((totalGanhos / totalOps) * 100).toFixed(1)),
        },
        funilEtapas: (funilResult.rows as any[]).map((r) => ({
          etapa: r.etapa,
          total: r.total,
        })),
        reunioesPorCx: (reunioesPorCxResult.rows as any[]).map((r) => ({
          cxResponsavel: r.cx_responsavel,
          total: r.total,
        })),
        rankingValor: (rankingValorResult.rows as any[]).map((r) => ({
          cxResponsavel: r.cx_responsavel,
          totalR: Number(r.total_r),
          totalP: Number(r.total_p),
          totalDeals: r.total_deals,
        })),
        rankingReunioes: (rankingReunioesResult.rows as any[]).map((r) => ({
          cxResponsavel: r.cx_responsavel,
          totalReunioes: r.total_reunioes,
        })),
      });
    } catch (error) {
      console.error("[crosssell] Error fetching dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  // 9. GET /api/comercial/crosssell/clientes — Client autocomplete
  app.get("/api/comercial/crosssell/clientes", async (req, res) => {
    try {
      const q = req.query.q as string;

      if (!q || q.length < 2) {
        return res.json([]);
      }

      const searchTerm = `%${q.toLowerCase()}%`;

      const result = await db.execute(sql`
        SELECT cnpj, nome, status, cluster, responsavel, task_id
        FROM "Clickup".cup_clientes
        WHERE LOWER(nome) LIKE ${searchTerm} OR cnpj LIKE ${searchTerm}
        ORDER BY nome
        LIMIT 50
      `);

      const rows = (result.rows as any[]).map((r) => ({
        cnpj: r.cnpj,
        nome: r.nome,
        status: r.status,
        cluster: r.cluster,
        responsavel: r.responsavel,
        taskId: r.task_id,
      }));

      res.json(rows);
    } catch (error) {
      console.error("[crosssell] Error searching clientes:", error);
      res.status(500).json({ error: "Failed to search clientes" });
    }
  });
}

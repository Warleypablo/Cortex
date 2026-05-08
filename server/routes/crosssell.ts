import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { mapearOportunidades } from "../services/crosssell-scoring";

export function registerCrossSellRoutes(app: Express) {
  // ==================== CROSS-SELL MANAGEMENT ====================

  // 1. GET /api/comercial/crosssell — List clientes com oportunidades aninhadas
  app.get("/api/comercial/crosssell", async (req, res) => {
    try {
      const { cluster, cx, etapa, produto } = req.query;

      const conditions: string[] = [];
      const params: any[] = [];

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
        WITH oportunidades_filtradas AS (
          SELECT
            o.id,
            o.cliente_id,
            o.cnpj,
            o.produto_mapeado,
            o.etapa,
            o.valor_r_negociacao,
            o.valor_p_negociacao,
            o.cx_responsavel,
            o.vendedor AS vendedor_op,
            o.ultimo_contato,
            o.atualizado_em,
            o.origem,
            o.prioridade,
            o.score_detalhes,
            o.motivo,
            c.nome AS cliente_nome,
            c.cluster,
            c.status AS cliente_status,
            c.responsavel AS cx_conta,
            c.vendedor AS vendedor,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_comentarios cm
             WHERE cm.oportunidade_id = o.id) AS total_comentarios
          FROM cortex_core.crosssell_oportunidades o
          LEFT JOIN "Clickup".cup_clientes c ON c.cnpj = o.cnpj
          ${whereClause}
        ),
        contratos_cliente AS (
          SELECT
            cl.cnpj,
            COALESCE(SUM(ct.valorr), 0)::float AS valor_r_atual,
            COALESCE(SUM(ct.valorp), 0)::float AS valor_p_atual,
            MIN(ct.data_inicio) AS contrato_inicio,
            COALESCE(
              array_agg(DISTINCT ct.produto) FILTER (WHERE ct.produto IS NOT NULL AND ct.produto != ''),
              ARRAY[]::text[]
            ) AS servicos_ativos
          FROM "Clickup".cup_contratos ct
          JOIN "Clickup".cup_clientes cl ON cl.task_id = ct.id_task
          WHERE ct.status IN ('ativo', 'Ativo', 'ATIVO')
            AND cl.cnpj IN (SELECT DISTINCT cnpj FROM oportunidades_filtradas)
          GROUP BY cl.cnpj
        )
        SELECT
          of_.cnpj,
          MAX(of_.cliente_id) AS cliente_id,
          MAX(of_.cliente_nome) AS cliente_nome,
          MAX(of_.cluster) AS cluster,
          MAX(of_.cliente_status) AS cliente_status,
          MAX(of_.cx_conta) AS cx_conta,
          MAX(of_.vendedor) AS vendedor,
          COALESCE(MAX(cc.valor_r_atual), 0) AS valor_r_atual,
          COALESCE(MAX(cc.valor_p_atual), 0) AS valor_p_atual,
          MAX(cc.contrato_inicio) AS contrato_inicio,
          COALESCE(MAX(cc.servicos_ativos), ARRAY[]::text[]) AS servicos_ativos,
          COALESCE(MAX((of_.score_detalhes->>'total')::float), 0) AS score_maximo,
          json_agg(json_build_object(
            'id', of_.id,
            'produto', of_.produto_mapeado,
            'etapa', of_.etapa,
            'valorRNegociacao', of_.valor_r_negociacao,
            'valorPNegociacao', of_.valor_p_negociacao,
            'cxResponsavel', of_.cx_responsavel,
            'vendedor', of_.vendedor_op,
            'ultimoContato', of_.ultimo_contato,
            'origem', COALESCE(of_.origem, 'manual'),
            'prioridade', of_.prioridade,
            'motivo', of_.motivo,
            'totalComentarios', of_.total_comentarios,
            'atualizadoEm', of_.atualizado_em
          ) ORDER BY of_.atualizado_em DESC) AS oportunidades
        FROM oportunidades_filtradas of_
        LEFT JOIN contratos_cliente cc ON cc.cnpj = of_.cnpj
        GROUP BY of_.cnpj
        ORDER BY score_maximo DESC NULLS LAST
      `;

      const finalQuery = params.length > 0
        ? params.reduce((q, val, i) => q.replace(new RegExp(`\\$${i + 1}\\b`, 'g'), `'${String(val).replace(/'/g, "''")}'`), query)
        : query;

      const result = await db.execute(sql.raw(finalQuery));

      const rows = (result.rows as any[]).map((r) => ({
        cnpj: r.cnpj,
        clienteId: r.cliente_id,
        nome: r.cliente_nome,
        cluster: r.cluster,
        status: r.cliente_status,
        cxConta: r.cx_conta,
        vendedor: r.vendedor,
        valorRAtual: Number(r.valor_r_atual),
        valorPAtual: Number(r.valor_p_atual),
        contratoInicio: r.contrato_inicio,
        servicosAtivos: r.servicos_ativos ?? [],
        scoreMaximo: Number(r.score_maximo),
        oportunidades: (r.oportunidades ?? []).map((op: any) => ({
          id: op.id,
          produto: op.produto,
          etapa: op.etapa,
          valorRNegociacao: op.valorRNegociacao != null ? Number(op.valorRNegociacao) : null,
          valorPNegociacao: op.valorPNegociacao != null ? Number(op.valorPNegociacao) : null,
          cxResponsavel: op.cxResponsavel,
          vendedor: op.vendedor ?? null,
          ultimoContato: op.ultimoContato,
          origem: op.origem ?? "manual",
          prioridade: op.prioridade,
          motivo: op.motivo,
          totalComentarios: Number(op.totalComentarios ?? 0),
          atualizadoEm: op.atualizadoEm,
        })),
      }));

      res.json(rows);
    } catch (error) {
      console.error("[crosssell] Error listing clientes:", error);
      res.status(500).json({ error: "Failed to list clientes" });
    }
  });

  // 1b. GET /api/comercial/crosssell/vendedores — Lista unificada de vendedores
  // (DISTINCT união de cup_clientes.vendedor / responsavel_geral / responsavel)
  // IMPORTANTE: precisa estar registrada ANTES de qualquer rota com :id
  app.get("/api/comercial/crosssell/vendedores", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT pessoa
        FROM (
          SELECT vendedor          AS pessoa FROM "Clickup".cup_clientes WHERE vendedor IS NOT NULL AND vendedor <> ''
          UNION
          SELECT responsavel_geral AS pessoa FROM "Clickup".cup_clientes WHERE responsavel_geral IS NOT NULL AND responsavel_geral <> ''
          UNION
          SELECT responsavel       AS pessoa FROM "Clickup".cup_clientes WHERE responsavel IS NOT NULL AND responsavel <> ''
        ) t
        ORDER BY pessoa ASC
      `);
      const vendedores = (result.rows as any[]).map((r) => r.pessoa as string);
      res.json(vendedores);
    } catch (error) {
      console.error("[crosssell] Error listing vendedores:", error);
      res.status(500).json({ error: "Failed to list vendedores" });
    }
  });

  // 2. POST /api/comercial/crosssell — Create oportunidade
  app.post("/api/comercial/crosssell", async (req, res) => {
    try {
      const { clienteId, cnpj, produtoMapeado, cxResponsavel, valorRNegociacao, valorPNegociacao, etapa } = req.body;

      if (!clienteId || !cnpj || !produtoMapeado || !cxResponsavel) {
        return res.status(400).json({ error: "clienteId, cnpj, produtoMapeado, cxResponsavel são obrigatórios" });
      }

      const etapaInicial = typeof etapa === "string" && etapa.length > 0 ? etapa : "fazer_contato";

      const result = await db.execute(sql`
        INSERT INTO cortex_core.crosssell_oportunidades
          (cliente_id, cnpj, produto_mapeado, cx_responsavel, valor_r_negociacao, valor_p_negociacao, etapa)
        VALUES
          (${clienteId}, ${cnpj}, ${produtoMapeado}, ${cxResponsavel}, ${valorRNegociacao || null}, ${valorPNegociacao || null}, ${etapaInicial})
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[crosssell] Error creating oportunidade:", error);
      res.status(500).json({ error: "Failed to create oportunidade" });
    }
  });

  // POST /api/comercial/crosssell/mapear — Auto-map opportunities
  app.post("/api/comercial/crosssell/mapear", async (req, res) => {
    try {
      const result = await mapearOportunidades();
      res.json(result);
    } catch (error) {
      console.error("[crosssell] Error mapping oportunidades:", error);
      res.status(500).json({ error: "Failed to map oportunidades" });
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

      if (!mesGanho) {
        return res.status(400).json({ error: "mesGanho é obrigatório" });
      }

      // Aceita "YYYY-MM" (input type=month) ou "YYYY-MM-DD"; normaliza para 1o dia do mes
      const mesGanhoNorm: string =
        typeof mesGanho === "string" && /^\d{4}-\d{2}$/.test(mesGanho)
          ? `${mesGanho}-01`
          : mesGanho;

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

      // Defaults: operacao default 'CrossSell' (texto[]); produto da propria oportunidade
      const operacaoArray: string[] = Array.isArray(operacao)
        ? operacao.filter((s) => typeof s === "string" && s.trim().length > 0)
        : typeof operacao === "string" && operacao.trim().length > 0
          ? [operacao]
          : ["CrossSell"];
      const produtoFinal: string = (typeof produto === "string" && produto.trim().length > 0)
        ? produto
        : op.produto_mapeado;

      const finalValorR = valorR ?? op.valor_r_negociacao;
      const finalValorP = valorP ?? op.valor_p_negociacao;

      // Insert into negocios_ganhos (operacao como text[] — usa sql.join para
      // parametrizar cada elemento individualmente; pg-driver nao converte
      // JS array direto para Postgres array via template literal)
      const operacaoSql = sql.join(operacaoArray.map((s) => sql`${s}`), sql`, `);
      const ganhoResult = await db.execute(sql`
        INSERT INTO cortex_core.crosssell_negocios_ganhos
          (oportunidade_id, cliente_nome, cnpj, valor_r, valor_p, cx_responsavel, operacao, produto, mes_ganho)
        VALUES
          (${Number(id)}, ${op.cliente_nome || 'N/A'}, ${op.cnpj}, ${finalValorR}, ${finalValorP}, ${op.cx_responsavel}, ARRAY[${operacaoSql}]::text[], ${produtoFinal}, ${mesGanhoNorm})
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
      const { mes, ano, operacao } = req.query;

      const conditions: string[] = [];
      if (mes && ano) {
        conditions.push(`EXTRACT(MONTH FROM g.mes_ganho) = ${Number(mes)}`);
        conditions.push(`EXTRACT(YEAR FROM g.mes_ganho) = ${Number(ano)}`);
      } else if (ano) {
        conditions.push(`EXTRACT(YEAR FROM g.mes_ganho) = ${Number(ano)}`);
      }
      if (operacao && typeof operacao === "string") {
        const ops = operacao
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => `'${s.replace(/'/g, "''")}'`);
        // Overlap: retorna ganhos cuja operacao (text[]) contem AO MENOS UM dos valores filtrados
        if (ops.length > 0) conditions.push(`g.operacao && ARRAY[${ops.join(",")}]::text[]`);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const result = await db.execute(sql.raw(`
        SELECT
          g.*,
          c.vendedor AS vendedor
        FROM cortex_core.crosssell_negocios_ganhos g
        LEFT JOIN "Clickup".cup_clientes c ON c.cnpj = g.cnpj
        ${whereClause}
        ORDER BY g.criado_em DESC
      `));

      const rows = (result.rows as any[]).map((r) => ({
        id: r.id,
        oportunidadeId: r.oportunidade_id,
        clienteNome: r.cliente_nome,
        cnpj: r.cnpj,
        valorR: r.valor_r ? Number(r.valor_r) : null,
        valorP: r.valor_p ? Number(r.valor_p) : null,
        cxResponsavel: r.cx_responsavel,
        vendedor: r.vendedor,
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

      const [
        kpisResult,
        funilResult,
        reunioesPorCxResult,
        rankingValorResult,
        rankingReunioesResult,
        clientesNegociacaoResult,
        coberturaResult,
      ] = await Promise.all([
        // KPIs
        db.execute(sql.raw(`
          SELECT
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'reuniao_agendada' ${opDateFilter}) AS reunioes_agendadas,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'reuniao_realizada' ${opDateFilter}) AS reunioes_realizadas,
            (SELECT COALESCE(SUM(o.valor_r_negociacao), 0) FROM cortex_core.crosssell_oportunidades o WHERE o.etapa NOT IN ('ganho', 'perdido') ${opDateFilter}) AS total_r_negociacao,
            (SELECT COALESCE(SUM(o.valor_p_negociacao), 0) FROM cortex_core.crosssell_oportunidades o WHERE o.etapa NOT IN ('ganho', 'perdido') ${opDateFilter}) AS total_p_negociacao,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_negocios_ganhos ng WHERE 1=1 ${ganhoDateFilter}) AS total_ganhos,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE 1=1 ${opDateFilter}) AS total_oportunidades
            ,(SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'sugerido_sistema') AS sugestoes_ativas
            ,(SELECT COUNT(*)::int FROM cortex_core.crosssell_etapa_log el WHERE el.etapa_anterior = 'sugerido_sistema' AND el.etapa_nova != 'descartado') AS sugestoes_aceitas
            ,(SELECT COUNT(*)::int FROM cortex_core.crosssell_etapa_log el WHERE el.etapa_anterior = 'sugerido_sistema') AS sugestoes_total_transicoes
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

        // Clientes em negociação ativa (distinct cnpj com oportunidades em etapas ativas)
        db.execute(sql.raw(`
          SELECT COUNT(DISTINCT cnpj)::int AS total
          FROM cortex_core.crosssell_oportunidades
          WHERE etapa NOT IN ('ganho', 'descartado', 'sugerido_sistema')
        `)),

        // Cobertura: clientes com oportunidades / total clientes ativos
        db.execute(sql.raw(`
          SELECT
            (SELECT COUNT(DISTINCT cnpj)::int
             FROM cortex_core.crosssell_oportunidades
             WHERE etapa NOT IN ('ganho', 'descartado')) AS com_oportunidade,
            (SELECT COUNT(*)::int
             FROM "Clickup".cup_clientes
             WHERE status IN ('ativo', 'Ativo', 'ATIVO')
               AND cnpj IS NOT NULL AND cnpj != '') AS total_ativos
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
          sugestoesAtivas: Number(kpis.sugestoes_ativas),
          taxaAceitacao: Number(kpis.sugestoes_total_transicoes) > 0
            ? Number(((Number(kpis.sugestoes_aceitas) / Number(kpis.sugestoes_total_transicoes)) * 100).toFixed(1))
            : 0,
          clientesEmNegociacao: Number((clientesNegociacaoResult.rows[0] as any).total),
          coberturaBase: (() => {
            const r = coberturaResult.rows[0] as any;
            const total = Number(r.total_ativos);
            return total > 0
              ? Number(((Number(r.com_oportunidade) / total) * 100).toFixed(1))
              : 0;
          })(),
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

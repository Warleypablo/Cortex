import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../auth/middleware";
import { triggerTestNotification } from "../services/dealNotifications";

export function registerComercialRoutes(app: Express) {
  // ==================== COMERCIAL - CLOSERS ====================

  app.get("/api/closers/list", async (req, res) => {
    try {
      // Check which columns exist
      const colCheck = await db.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'Bitrix' AND table_name = 'crm_closers'
      `);
      const cols = (colCheck.rows as any[]).map(r => r.column_name);
      const hasEmail = cols.includes('email');
      const hasActive = cols.includes('active');

      // Build SELECT columns dynamically (all values are hardcoded, not user input)
      const selectColumns = [sql`id`, sql`nome as name`];
      if (hasEmail) selectColumns.push(sql`email`);
      if (hasActive) selectColumns.push(sql`active`);

      const result = await db.execute(sql`
        SELECT ${sql.join(selectColumns, sql`, `)} FROM "Bitrix".crm_closers ORDER BY nome
      `);

      // Ensure all rows have email and active fields
      const rows = (result.rows as any[]).map(r => ({
        id: r.id,
        name: r.name,
        email: r.email || null,
        active: r.active !== undefined ? r.active : true,
      }));

      console.log(`[closers/list] Total: ${rows.length}, active(!false): ${rows.filter((r: any) => r.active !== false).length}, cols: ${cols.join(',')}, sample:`, rows.slice(0, 3));
      res.json(rows);
    } catch (error) {
      console.error("[api] Error fetching closers list:", error);
      res.status(500).json({ error: "Failed to fetch closers list" });
    }
  });

  app.get("/api/closers/sources", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT source FROM "Bitrix".crm_deal WHERE source IS NOT NULL AND source != '' ORDER BY source
      `);
      res.json(result.rows.map((r: any) => r.source).filter((s: string) => s && s.trim() !== ''));
    } catch (error) {
      console.error("[api] Error fetching sources:", error);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/closers/pipelines", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT category_name FROM "Bitrix".crm_deal WHERE category_name IS NOT NULL AND category_name != '' ORDER BY category_name
      `);
      res.json(result.rows.map((r: any) => r.category_name).filter((c: string) => c && c.trim() !== ''));
    } catch (error) {
      console.error("[api] Error fetching pipelines:", error);
      res.status(500).json({ error: "Failed to fetch pipelines" });
    }
  });

  app.get("/api/closers/metrics", async (req, res) => {
    try {
      const {
        dataReuniaoInicio,
        dataReuniaoFim,
        dataFechamentoInicio,
        dataFechamentoFim,
        dataLeadInicio,
        dataLeadFim,
        source,
        pipeline,
        closerId
      } = req.query;

      // Shared conditions (source, pipeline, closerId) - applied to all queries
      const sharedConditions: ReturnType<typeof sql>[] = [];
      if (source) {
        sharedConditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        sharedConditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (closerId) {
        sharedConditions.push(sql`d.closer = ${closerId}`);
      }

      console.log("[closers/metrics] Query params:", {
        dataReuniaoInicio,
        dataReuniaoFim,
        dataFechamentoInicio,
        dataFechamentoFim,
        dataLeadInicio,
        dataLeadFim,
        source,
        pipeline,
        closerId
      });
      console.log("[closers/metrics] Executing independent metrics queries...");

      // Query 1: Reuniões realizadas - filtered ONLY by reunion dates
      const reunioesConditions = [...sharedConditions];
      reunioesConditions.push(sql`d.data_reuniao_realizada IS NOT NULL`);
      if (dataReuniaoInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }
      const whereClauseReunioes = sql`WHERE ${sql.join(reunioesConditions, sql` AND `)}`;

      const resultReunioes = await db.execute(sql`
        SELECT COUNT(*) as reunioes_realizadas
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseReunioes}
      `);

      // Query 2: Negócios ganhos, MRR e Pontual - filtered ONLY by closing dates
      const negociosConditions = [...sharedConditions];
      negociosConditions.push(sql`d.stage_name = 'Negócio Ganho'`);
      if (dataFechamentoInicio) {
        negociosConditions.push(sql`d.data_fechamento >= ${dataFechamentoInicio}`);
      }
      if (dataFechamentoFim) {
        negociosConditions.push(sql`d.data_fechamento <= ${dataFechamentoFim}`);
      }
      const whereClauseNegocios = sql`WHERE ${sql.join(negociosConditions, sql` AND `)}`;

      const resultNegocios = await db.execute(sql`
        SELECT
          COALESCE(SUM(d.valor_recorrente), 0) as mrr_obtido,
          COALESCE(SUM(d.valor_pontual), 0) as pontual_obtido,
          COUNT(*) as negocios_ganhos,
          COUNT(CASE WHEN COALESCE(d.valor_recorrente, 0) > 0 THEN 1 END) as negocios_com_recorrente,
          COUNT(CASE WHEN COALESCE(d.valor_pontual, 0) > 0 THEN 1 END) as negocios_com_pontual
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseNegocios}
      `);

      // Query 3: Leads criados - filtered ONLY by lead creation dates
      const leadsConditions = [...sharedConditions];
      if (dataLeadInicio) {
        leadsConditions.push(sql`d.date_create >= ${dataLeadInicio}`);
      }
      if (dataLeadFim) {
        leadsConditions.push(sql`d.date_create <= ${dataLeadFim}`);
      }
      const whereClauseLeads = leadsConditions.length > 0
        ? sql`WHERE ${sql.join(leadsConditions, sql` AND `)}`
        : sql``;

      const resultLeads = await db.execute(sql`
        SELECT COUNT(DISTINCT d.id) as leads_criados
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseLeads}
      `);

      const rowReunioes = resultReunioes.rows[0] as any;
      const rowNegocios = resultNegocios.rows[0] as any;
      const rowLeads = resultLeads.rows[0] as any;

      const reunioes = parseInt(rowReunioes.reunioes_realizadas) || 0;
      const negocios = parseInt(rowNegocios.negocios_ganhos) || 0;
      const leads = parseInt(rowLeads.leads_criados) || 0;
      const negociosComRecorrente = parseInt(rowNegocios.negocios_com_recorrente) || 0;
      const negociosComPontual = parseInt(rowNegocios.negocios_com_pontual) || 0;
      const conversao = reunioes > 0 ? (negocios / reunioes) * 100 : 0;
      const mrrObtido = parseFloat(rowNegocios.mrr_obtido) || 0;
      const pontualObtido = parseFloat(rowNegocios.pontual_obtido) || 0;
      const ticketMedioRecorrente = negociosComRecorrente > 0 ? mrrObtido / negociosComRecorrente : 0;
      const ticketMedioPontual = negociosComPontual > 0 ? pontualObtido / negociosComPontual : 0;

      console.log("[closers/metrics] Independent results - Reuniões:", reunioes, "Negócios:", negocios, "Leads:", leads);

      res.json({
        mrrObtido,
        pontualObtido,
        reunioesRealizadas: reunioes,
        negociosGanhos: negocios,
        leadsCriados: leads,
        taxaConversao: conversao,
        negociosComRecorrente,
        negociosComPontual,
        ticketMedioRecorrente,
        ticketMedioPontual
      });
    } catch (error) {
      console.error("[api] Error fetching closers metrics:", error);
      res.status(500).json({ error: "Failed to fetch closers metrics" });
    }
  });

  app.get("/api/closers/chart-reunioes-negocios", async (req, res) => {
    try {
      const {
        dataReuniaoInicio,
        dataReuniaoFim,
        dataFechamentoInicio,
        dataFechamentoFim,
        source,
        pipeline
      } = req.query;

      // Shared conditions (source, pipeline)
      const sharedConditions: ReturnType<typeof sql>[] = [];
      if (source) {
        sharedConditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        sharedConditions.push(sql`d.category_name = ${pipeline}`);
      }

      // Query 1: Reuniões por closer - filtered ONLY by reunion dates
      const reunioesConditions = [...sharedConditions];
      reunioesConditions.push(sql`d.data_reuniao_realizada IS NOT NULL`);
      if (dataReuniaoInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }
      const whereClauseReunioes = sql`WHERE ${sql.join(reunioesConditions, sql` AND `)}`;

      const resultReunioes = await db.execute(sql`
        SELECT
          c.id as closer_id,
          c.nome as closer_name,
          COUNT(*) as reunioes
        FROM "Bitrix".crm_deal d
        INNER JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseReunioes}
        GROUP BY c.id, c.nome
        ORDER BY c.nome
      `);

      // Query 2: Negócios ganhos por closer - filtered ONLY by closing dates
      const negociosConditions = [...sharedConditions];
      negociosConditions.push(sql`d.stage_name = 'Negócio Ganho'`);
      if (dataFechamentoInicio) {
        negociosConditions.push(sql`d.data_fechamento >= ${dataFechamentoInicio}`);
      }
      if (dataFechamentoFim) {
        negociosConditions.push(sql`d.data_fechamento <= ${dataFechamentoFim}`);
      }
      const whereClauseNegocios = sql`WHERE ${sql.join(negociosConditions, sql` AND `)}`;

      const resultNegocios = await db.execute(sql`
        SELECT
          c.id as closer_id,
          c.nome as closer_name,
          COUNT(*) as negocios_ganhos
        FROM "Bitrix".crm_deal d
        INNER JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseNegocios}
        GROUP BY c.id, c.nome
        ORDER BY c.nome
      `);

      // Merge results by closer
      const reunioesMap = new Map(resultReunioes.rows.map((r: any) => [r.closer_id, { name: r.closer_name, reunioes: parseInt(r.reunioes) || 0 }]));
      const negociosMap = new Map(resultNegocios.rows.map((r: any) => [r.closer_id, parseInt(r.negocios_ganhos) || 0]));

      const allCloserIds = new Set([...Array.from(reunioesMap.keys()), ...Array.from(negociosMap.keys())]);

      const data = Array.from(allCloserIds).map(closerId => {
        const reunioesData = reunioesMap.get(closerId) || { name: '', reunioes: 0 };
        const negociosData = negociosMap.get(closerId) || 0;

        // Get closer name from either map
        const closerName = reunioesData.name || (resultNegocios.rows.find((r: any) => r.closer_id === closerId) as any)?.closer_name || '';

        const reunioes = reunioesData.reunioes;
        const negocios = negociosData;
        const conversao = reunioes > 0 ? (negocios / reunioes) * 100 : 0;

        return {
          closer: closerName,
          reunioes,
          negociosGanhos: negocios,
          taxaConversao: parseFloat(conversao.toFixed(1))
        };
      }).filter(d => d.closer).sort((a, b) => a.closer.localeCompare(b.closer));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching chart data:", error);
      res.status(500).json({ error: "Failed to fetch chart data" });
    }
  });

  app.get("/api/closers/chart-receita", async (req, res) => {
    try {
      const {
        dataFechamentoInicio,
        dataFechamentoFim,
        dataReuniaoInicio,
        dataReuniaoFim,
        source,
        pipeline
      } = req.query;

      // Receita (MRR/Pontual) is filtered ONLY by closing dates
      const conditions: ReturnType<typeof sql>[] = [sql`d.stage_name = 'Negócio Ganho'`];

      if (dataFechamentoInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataFechamentoInicio}`);
      }
      if (dataFechamentoFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFechamentoFim}`);
      }
      if (source) {
        conditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        conditions.push(sql`d.category_name = ${pipeline}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      // Query principal: negócios ganhos, MRR, pontual, contadores
      const result = await db.execute(sql`
        SELECT
          c.id as closer_id,
          c.nome as closer_name,
          COALESCE(SUM(d.valor_recorrente), 0) as mrr,
          COALESCE(SUM(d.valor_pontual), 0) as pontual,
          COUNT(*) as negocios_ganhos,
          COUNT(CASE WHEN COALESCE(d.valor_recorrente, 0) > 0 THEN 1 END) as negocios_com_recorrente,
          COUNT(CASE WHEN COALESCE(d.valor_pontual, 0) > 0 THEN 1 END) as negocios_com_pontual
        FROM "Bitrix".crm_deal d
        INNER JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
        GROUP BY c.id, c.nome
        ORDER BY c.nome
      `);

      // Query separada para reuniões (usa datas de reunião)
      const reunioesConditions: ReturnType<typeof sql>[] = [sql`d.data_reuniao_realizada IS NOT NULL`];
      if (dataReuniaoInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }
      if (source) {
        reunioesConditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        reunioesConditions.push(sql`d.category_name = ${pipeline}`);
      }
      const whereClauseReunioes = sql`WHERE ${sql.join(reunioesConditions, sql` AND `)}`;

      const reunioesResult = await db.execute(sql`
        SELECT
          c.id as closer_id,
          COUNT(*) as reunioes
        FROM "Bitrix".crm_deal d
        INNER JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClauseReunioes}
        GROUP BY c.id
      `);

      // Mapa de reuniões por closer
      const reunioesMap: Record<number, number> = {};
      for (const row of reunioesResult.rows as any[]) {
        reunioesMap[row.closer_id] = parseInt(row.reunioes) || 0;
      }

      const data = result.rows.map((row: any) => {
        const mrr = parseFloat(row.mrr) || 0;
        const pontual = parseFloat(row.pontual) || 0;
        const negociosGanhos = parseInt(row.negocios_ganhos) || 0;
        const negociosComRecorrente = parseInt(row.negocios_com_recorrente) || 0;
        const negociosComPontual = parseInt(row.negocios_com_pontual) || 0;
        const reunioes = reunioesMap[row.closer_id] || 0;
        const taxaConversao = reunioes > 0 ? (negociosGanhos / reunioes) * 100 : 0;
        const tmRecorrente = negociosComRecorrente > 0 ? mrr / negociosComRecorrente : 0;
        const tmPontual = negociosComPontual > 0 ? pontual / negociosComPontual : 0;

        return {
          closer: row.closer_name,
          mrr,
          pontual,
          reunioes,
          negociosGanhos,
          negociosComRecorrente,
          negociosComPontual,
          taxaConversao,
          tmRecorrente,
          tmPontual
        };
      });

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching revenue chart data:", error);
      res.status(500).json({ error: "Failed to fetch revenue chart data" });
    }
  });

  // ========================================
  // CLOSER DETAIL API ENDPOINTS
  // ========================================

  app.get("/api/closers/detail", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      const closerResult = await db.execute(sql`
        SELECT id, nome FROM "Bitrix".crm_closers WHERE id = ${closerId}
      `);

      if (closerResult.rows.length === 0) {
        return res.status(404).json({ error: "Closer not found" });
      }

      const closerInfo = closerResult.rows[0] as any;

      // Usa data_fechamento como referência principal para filtros de data (negócios)
      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      // Query separada para reuniões - filtra por data_reuniao_realizada (consistente com dashboard)
      const reunioesConditions: ReturnType<typeof sql>[] = [];
      reunioesConditions.push(sql`d.data_reuniao_realizada IS NOT NULL`);
      if (dataInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataInicio}`);
      }
      if (dataFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataFim}`);
      }

      const reunioesResult = await db.execute(sql`
        SELECT COUNT(*) as reunioes_realizadas
        FROM "Bitrix".crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND ${sql.join(reunioesConditions, sql` AND `)}
      `);

      const metricsResult = await db.execute(sql`
        SELECT
          COUNT(*) as total_negocios,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 END) as negocios_ganhos,
          COUNT(CASE WHEN d.stage_name IN ('Negócio perdido', 'Negócio Perdido', 'Perdido', 'Descartado', 'Descartado/sem fit') THEN 1 END) as negocios_perdidos,
          COUNT(CASE WHEN d.stage_name NOT IN ('Negócio Ganho', 'Negócio perdido', 'Negócio Perdido', 'Perdido', 'Descartado', 'Descartado/sem fit') THEN 1 END) as negocios_em_andamento,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_recorrente END), 0) as valor_recorrente,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_pontual END), 0) as valor_pontual,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' AND COALESCE(d.valor_recorrente, 0) > 0 THEN 1 END) as negocios_com_recorrente,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' AND COALESCE(d.valor_pontual, 0) > 0 THEN 1 END) as negocios_com_pontual,
          MIN(d.data_fechamento) as primeiro_negocio,
          MAX(d.data_fechamento) as ultimo_negocio
        FROM "Bitrix".crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.data_fechamento IS NOT NULL
        ${dateWhereClause}
      `);

      const row = metricsResult.rows[0] as any;
      const rowReunioes = reunioesResult.rows[0] as any;

      const totalNegocios = parseInt(row.total_negocios) || 0;
      const negociosGanhos = parseInt(row.negocios_ganhos) || 0;
      const negociosPerdidos = parseInt(row.negocios_perdidos) || 0;
      const negociosEmAndamento = parseInt(row.negocios_em_andamento) || 0;
      const reunioesRealizadas = parseInt(rowReunioes.reunioes_realizadas) || 0;
      const valorRecorrente = parseFloat(row.valor_recorrente) || 0;
      const valorPontual = parseFloat(row.valor_pontual) || 0;
      const negociosComRecorrente = parseInt(row.negocios_com_recorrente) || 0;
      const negociosComPontual = parseInt(row.negocios_com_pontual) || 0;
      const valorTotal = valorRecorrente + valorPontual;
      const taxaConversao = reunioesRealizadas > 0 ? (negociosGanhos / reunioesRealizadas) * 100 : 0;
      const ticketMedio = negociosGanhos > 0 ? valorTotal / negociosGanhos : 0;
      const ticketMedioRecorrente = negociosComRecorrente > 0 ? valorRecorrente / negociosComRecorrente : 0;
      const ticketMedioPontual = negociosComPontual > 0 ? valorPontual / negociosComPontual : 0;

      const primeiroNegocio = row.primeiro_negocio;
      const ultimoNegocio = row.ultimo_negocio;

      let lt = 0;
      let diasAtivo = 0;
      if (primeiroNegocio) {
        const inicio = new Date(primeiroNegocio);
        const fim = ultimoNegocio ? new Date(ultimoNegocio) : new Date();
        diasAtivo = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        lt = Math.max(1, Math.ceil(diasAtivo / 30));
      }

      const mediaContratosPorMes = lt > 0 ? negociosGanhos / lt : 0;

      // Query para calcular lifetime médio global dos contratos
      // Usamos o lifetime médio global como base para todos os closers
      // Isso garante consistência e evita problemas de matching por nome
      const globalLifetimeResult = await db.execute(sql`
        SELECT
          AVG(
            CASE
              WHEN c.data_inicio IS NOT NULL AND c.data_solicitacao_encerramento IS NOT NULL
              THEN GREATEST(0.5, (c.data_solicitacao_encerramento::date - c.data_inicio::date)::numeric / 30.44)
              ELSE NULL
            END
          ) as lifetime_medio,
          COUNT(CASE WHEN c.data_solicitacao_encerramento IS NOT NULL THEN 1 END) as total_encerrados,
          COUNT(CASE WHEN LOWER(c.status) IN ('ativo', 'active') THEN 1 END) as total_ativos
        FROM "Clickup".cup_contratos c
        WHERE c.valorr IS NOT NULL
          AND c.valorr > 0
          AND LOWER(COALESCE(c.squad, '')) NOT IN ('turbo interno', 'squad x', 'interno', 'x')
      `);

      const globalLtRow = globalLifetimeResult.rows[0] as any;
      const lifetimeMedioGlobal = parseFloat(globalLtRow?.lifetime_medio) || 12;

      // LTV Estimado = Ticket Médio Recorrente × Lifetime Médio Global
      const ltvEstimado = ticketMedioRecorrente * lifetimeMedioGlobal;

      // LTV Total = MRR Total × Lifetime Médio Global
      const ltvTotal = valorRecorrente * lifetimeMedioGlobal;

      res.json({
        closerId: parseInt(closerId as string),
        closerName: closerInfo.nome,
        negociosGanhos,
        negociosPerdidos,
        negociosEmAndamento,
        totalNegocios,
        reunioesRealizadas,
        taxaConversao,
        valorRecorrente,
        valorPontual,
        valorTotal,
        ticketMedio,
        ticketMedioRecorrente,
        ticketMedioPontual,
        negociosComRecorrente,
        negociosComPontual,
        lt,
        primeiroNegocio: primeiroNegocio ? new Date(primeiroNegocio).toISOString() : null,
        ultimoNegocio: ultimoNegocio ? new Date(ultimoNegocio).toISOString() : null,
        diasAtivo,
        mediaContratosPorMes,
        // LTV metrics (baseado no lifetime médio global dos contratos)
        ltvEstimado,
        ltvTotal,
        lifetimeMedioGlobal
      });
    } catch (error) {
      console.error("[api] Error fetching closer detail:", error);
      res.status(500).json({ error: "Failed to fetch closer detail" });
    }
  });

  app.get("/api/closers/detail/monthly", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          TO_CHAR(d.data_fechamento, 'YYYY-MM') as mes,
          TO_CHAR(d.data_fechamento, 'Mon/YY') as mes_label,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_recorrente END), 0) as valor_recorrente,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_pontual END), 0) as valor_pontual,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 END) as negocios,
          COUNT(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 END) as reunioes
        FROM "Bitrix".crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.data_fechamento IS NOT NULL
          ${dateWhereClause}
        GROUP BY TO_CHAR(d.data_fechamento, 'YYYY-MM'), TO_CHAR(d.data_fechamento, 'Mon/YY')
        ORDER BY mes ASC
      `);

      const data = result.rows.map((row: any) => ({
        mes: row.mes,
        mesLabel: row.mes_label,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        valorPontual: parseFloat(row.valor_pontual) || 0,
        negocios: parseInt(row.negocios) || 0,
        reunioes: parseInt(row.reunioes) || 0
      }));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching monthly data:", error);
      res.status(500).json({ error: "Failed to fetch monthly data" });
    }
  });

  app.get("/api/closers/detail/stages", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      // Usa data_fechamento como referência principal
      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          d.stage_name as stage,
          COUNT(*) as count
        FROM "Bitrix".crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.data_fechamento IS NOT NULL
          ${dateWhereClause}
        GROUP BY d.stage_name
        ORDER BY count DESC
      `);

      const totalCount = result.rows.reduce((acc: number, row: any) => acc + parseInt(row.count), 0);

      const data = result.rows.map((row: any) => ({
        stage: row.stage || 'Não informado',
        count: parseInt(row.count) || 0,
        percentage: totalCount > 0 ? (parseInt(row.count) / totalCount) * 100 : 0
      }));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching stage data:", error);
      res.status(500).json({ error: "Failed to fetch stage data" });
    }
  });

  app.get("/api/closers/detail/sources", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      // Usa data_fechamento como referência principal
      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          COALESCE(d.source, 'Não informado') as source,
          COUNT(*) as count
        FROM "Bitrix".crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.data_fechamento IS NOT NULL
          ${dateWhereClause}
        GROUP BY d.source
        ORDER BY count DESC
        LIMIT 15
      `);

      const totalCount = result.rows.reduce((acc: number, row: any) => acc + parseInt(row.count), 0);

      const data = result.rows.map((row: any) => ({
        source: row.source || 'Não informado',
        count: parseInt(row.count) || 0,
        percentage: totalCount > 0 ? (parseInt(row.count) / totalCount) * 100 : 0
      }));

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching source data:", error);
      res.status(500).json({ error: "Failed to fetch source data" });
    }
  });

  app.get("/api/closers/detail/lead-time", async (req, res) => {
    try {
      const { closerId, dataInicio, dataFim } = req.query;

      if (!closerId) {
        return res.status(400).json({ error: "closerId is required" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.data_fechamento <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql`AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          AVG(EXTRACT(EPOCH FROM (d.data_fechamento::timestamp - d.date_create)) / 86400) as lead_time_medio,
          MIN(EXTRACT(EPOCH FROM (d.data_fechamento::timestamp - d.date_create)) / 86400) as lead_time_min,
          MAX(EXTRACT(EPOCH FROM (d.data_fechamento::timestamp - d.date_create)) / 86400) as lead_time_max,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (d.data_fechamento::timestamp - d.date_create)) / 86400) as lead_time_mediana,
          COUNT(*) as total_negocios
        FROM "Bitrix".crm_deal d
        WHERE CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = ${closerId}
          AND d.stage_name = 'Negócio Ganho'
          AND d.data_fechamento IS NOT NULL
          AND d.date_create IS NOT NULL
          ${dateWhereClause}
      `);

      const row = result.rows[0] as any;

      res.json({
        leadTimeMedio: parseFloat(row.lead_time_medio) || 0,
        leadTimeMin: parseFloat(row.lead_time_min) || 0,
        leadTimeMax: parseFloat(row.lead_time_max) || 0,
        leadTimeMediana: parseFloat(row.lead_time_mediana) || 0,
        totalNegocios: parseInt(row.total_negocios) || 0
      });
    } catch (error) {
      console.error("[api] Error fetching lead time data:", error);
      res.status(500).json({ error: "Failed to fetch lead time data" });
    }
  });

  // ========================================
  // SDRs DASHBOARD API ENDPOINTS
  // ========================================

  app.get("/api/sdrs/list", async (req, res) => {
    try {
      // Get distinct SDRs from crm_deal and join with crm_users to get names
      const result = await db.execute(sql`
        SELECT DISTINCT u.id, u.nome as name, u.email, u.active
        FROM "Bitrix".crm_users u
        INNER JOIN "Bitrix".crm_deal d ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
        ORDER BY u.nome
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching SDRs list:", error);
      res.status(500).json({ error: "Failed to fetch SDRs list" });
    }
  });

  app.get("/api/sdrs/sources", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT source
        FROM "Bitrix".crm_deal
        WHERE source IS NOT NULL AND source != ''
        ORDER BY source
      `);
      res.json(result.rows.map((r: any) => r.source));
    } catch (error) {
      console.error("[api] Error fetching SDR sources:", error);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/sdrs/pipelines", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT category_name
        FROM "Bitrix".crm_deal
        WHERE category_name IS NOT NULL AND category_name != ''
        ORDER BY category_name
      `);
      res.json(result.rows.map((r: any) => r.category_name));
    } catch (error) {
      console.error("[api] Error fetching SDR pipelines:", error);
      res.status(500).json({ error: "Failed to fetch pipelines" });
    }
  });

  app.get("/api/sdrs/metrics", async (req, res) => {
    try {
      const {
        dataReuniaoInicio,
        dataReuniaoFim,
        dataLeadInicio,
        dataLeadFim,
        source,
        pipeline,
        sdrId
      } = req.query;

      console.log("[sdrs/metrics] Query params:", { dataReuniaoInicio, dataReuniaoFim, dataLeadInicio, dataLeadFim, source, pipeline, sdrId });

      // Shared conditions (source, pipeline, sdrId) - applied to all queries
      const sharedConditions: ReturnType<typeof sql>[] = [];
      if (source) {
        sharedConditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        sharedConditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (sdrId) {
        sharedConditions.push(sql`d.sdr = ${sdrId}`);
      }

      // Query 1: Leads - filtered ONLY by lead creation dates
      const leadsConditions = [...sharedConditions];
      if (dataLeadInicio) {
        leadsConditions.push(sql`d.date_create >= ${dataLeadInicio}`);
      }
      if (dataLeadFim) {
        leadsConditions.push(sql`d.date_create <= ${dataLeadFim}`);
      }

      const whereClauseLeads = leadsConditions.length > 0
        ? sql`WHERE ${sql.join(leadsConditions, sql` AND `)}`
        : sql``;

      const resultLeads = await db.execute(sql`
        SELECT COUNT(DISTINCT d.id) as leads_totais
        FROM "Bitrix".crm_deal d
        ${whereClauseLeads}
      `);

      // Query 2: Reuniões - filtered ONLY by reunion dates
      const reunioesConditions = [...sharedConditions];
      reunioesConditions.push(sql`d.data_reuniao_realizada IS NOT NULL`);
      if (dataReuniaoInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }

      const whereClauseReunioes = sql`WHERE ${sql.join(reunioesConditions, sql` AND `)}`;

      const resultReunioes = await db.execute(sql`
        SELECT COUNT(*) as reunioes_realizadas
        FROM "Bitrix".crm_deal d
        ${whereClauseReunioes}
      `);

      const rowLeads = resultLeads.rows[0] as any;
      const rowReunioes = resultReunioes.rows[0] as any;

      const leadsTotais = parseInt(rowLeads.leads_totais) || 0;
      const reunioesRealizadas = parseInt(rowReunioes.reunioes_realizadas) || 0;
      const taxaConversao = leadsTotais > 0 ? (reunioesRealizadas / leadsTotais) * 100 : 0;

      console.log("[sdrs/metrics] Independent results - Leads:", leadsTotais, "Reuniões:", reunioesRealizadas);

      res.json({
        leadsTotais,
        reunioesRealizadas,
        taxaConversao
      });
    } catch (error) {
      console.error("[api] Error fetching SDR metrics:", error);
      res.status(500).json({ error: "Failed to fetch SDR metrics" });
    }
  });

  app.get("/api/sdrs/chart-reunioes", async (req, res) => {
    try {
      const {
        dataReuniaoInicio,
        dataReuniaoFim,
        dataLeadInicio,
        dataLeadFim,
        source,
        pipeline,
        sdrId
      } = req.query;

      // Shared conditions (source, pipeline, sdrId) - applied to all queries
      const sharedConditions: ReturnType<typeof sql>[] = [];
      if (source) {
        sharedConditions.push(sql`d.source = ${source}`);
      }
      if (pipeline) {
        sharedConditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (sdrId) {
        sharedConditions.push(sql`d.sdr = ${sdrId}`);
      }

      // Query 1: Leads por SDR - filtered ONLY by lead creation dates
      const leadsConditions = [...sharedConditions];
      if (dataLeadInicio) {
        leadsConditions.push(sql`d.date_create >= ${dataLeadInicio}`);
      }
      if (dataLeadFim) {
        leadsConditions.push(sql`d.date_create <= ${dataLeadFim}`);
      }

      const whereClauseLeads = leadsConditions.length > 0
        ? sql`WHERE ${sql.join(leadsConditions, sql` AND `)}`
        : sql``;

      const resultLeads = await db.execute(sql`
        SELECT
          u.nome as sdr_name,
          u.id as sdr_id,
          COUNT(DISTINCT d.id) as leads
        FROM "Bitrix".crm_deal d
        INNER JOIN "Bitrix".crm_users u ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
        ${whereClauseLeads}
        GROUP BY u.id, u.nome
      `);

      // Query 2: Reuniões por SDR - filtered ONLY by reunion dates
      const reunioesConditions = [...sharedConditions];
      reunioesConditions.push(sql`d.data_reuniao_realizada IS NOT NULL`);
      if (dataReuniaoInicio) {
        reunioesConditions.push(sql`d.data_reuniao_realizada >= ${dataReuniaoInicio}`);
      }
      if (dataReuniaoFim) {
        reunioesConditions.push(sql`d.data_reuniao_realizada <= ${dataReuniaoFim}`);
      }

      const whereClauseReunioes = sql`WHERE ${sql.join(reunioesConditions, sql` AND `)}`;

      const resultReunioes = await db.execute(sql`
        SELECT
          u.nome as sdr_name,
          u.id as sdr_id,
          COUNT(*) as reunioes
        FROM "Bitrix".crm_deal d
        INNER JOIN "Bitrix".crm_users u ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
        ${whereClauseReunioes}
        GROUP BY u.id, u.nome
      `);

      const leadsMap = new Map<number, { name: string; leads: number }>();
      resultLeads.rows.forEach((row: any) => {
        leadsMap.set(row.sdr_id, {
          name: row.sdr_name,
          leads: parseInt(row.leads) || 0
        });
      });

      const reunioesMap = new Map<number, number>();
      resultReunioes.rows.forEach((row: any) => {
        reunioesMap.set(row.sdr_id, parseInt(row.reunioes) || 0);
      });

      const allSdrIds = new Set([...Array.from(leadsMap.keys()), ...Array.from(reunioesMap.keys())]);

      const data = Array.from(allSdrIds).map((sdrId) => {
        const leadsInfo = leadsMap.get(sdrId);
        const leads = leadsInfo?.leads || 0;
        const reunioes = reunioesMap.get(sdrId) || 0;
        const conversao = leads > 0 ? (reunioes / leads) * 100 : 0;

        let sdrName = leadsInfo?.name || '';
        if (!sdrName) {
          const reuniaoRow = resultReunioes.rows.find((r: any) => r.sdr_id === sdrId) as any;
          sdrName = reuniaoRow?.sdr_name || 'Desconhecido';
        }

        return {
          sdr: sdrName,
          sdrId,
          leads,
          reunioesRealizadas: reunioes,
          conversao: parseFloat(conversao.toFixed(1))
        };
      }).sort((a, b) => b.reunioesRealizadas - a.reunioesRealizadas);

      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching SDR chart data:", error);
      res.status(500).json({ error: "Failed to fetch SDR chart data" });
    }
  });

  // ========================================
  // SDR DETAIL PAGE ENDPOINTS
  // ========================================

  app.get("/api/sdrs/detail", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      const reunioesDateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        reunioesDateConditions.push(sql`d.data_reuniao_realizada >= ${dataInicio}`);
      }
      if (dataFim) {
        reunioesDateConditions.push(sql`d.data_reuniao_realizada <= ${dataFim}`);
      }

      const reunioesDateWhereClause = reunioesDateConditions.length > 0
        ? sql` AND ${sql.join(reunioesDateConditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        WITH sdr_info AS (
          SELECT id, nome, email FROM "Bitrix".crm_users WHERE id = ${sdrIdNum}
        ),
        leads_data AS (
          SELECT
            COUNT(DISTINCT d.id) as leads_totais,
            MIN(d.date_create) as primeiro_lead,
            MAX(d.date_create) as ultimo_lead
          FROM "Bitrix".crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
          ${dateWhereClause}
        ),
        reunioes_data AS (
          SELECT COUNT(*) as reunioes_realizadas
          FROM "Bitrix".crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.data_reuniao_realizada IS NOT NULL
          ${reunioesDateWhereClause}
        ),
        vendas_data AS (
          SELECT
            COUNT(*) as negocios_ganhos,
            COALESCE(SUM(d.valor_recorrente), 0) as valor_recorrente,
            COALESCE(SUM(d.valor_pontual), 0) as valor_pontual
          FROM "Bitrix".crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.stage_name = 'Negócio Ganho'
          ${dateWhereClause}
        ),
        perdidos_data AS (
          SELECT COUNT(*) as negocios_perdidos
          FROM "Bitrix".crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.stage_name = 'Negócio Perdido'
          ${dateWhereClause}
        ),
        em_andamento_data AS (
          SELECT COUNT(*) as em_andamento
          FROM "Bitrix".crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.stage_name NOT IN ('Negócio Ganho', 'Negócio Perdido')
          ${dateWhereClause}
        )
        SELECT
          s.id, s.nome, s.email,
          l.leads_totais, l.primeiro_lead, l.ultimo_lead,
          r.reunioes_realizadas,
          v.negocios_ganhos, v.valor_recorrente, v.valor_pontual,
          p.negocios_perdidos,
          e.em_andamento
        FROM sdr_info s
        CROSS JOIN leads_data l
        CROSS JOIN reunioes_data r
        CROSS JOIN vendas_data v
        CROSS JOIN perdidos_data p
        CROSS JOIN em_andamento_data e
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "SDR not found" });
      }

      const row = result.rows[0] as any;

      const leadsTotais = parseInt(row.leads_totais) || 0;
      const reunioesRealizadas = parseInt(row.reunioes_realizadas) || 0;
      const negociosGanhos = parseInt(row.negocios_ganhos) || 0;
      const negociosPerdidos = parseInt(row.negocios_perdidos) || 0;
      const emAndamento = parseInt(row.em_andamento) || 0;
      const valorRecorrente = parseFloat(row.valor_recorrente) || 0;
      const valorPontual = parseFloat(row.valor_pontual) || 0;

      const taxaLeadReuniao = leadsTotais > 0 ? (reunioesRealizadas / leadsTotais) * 100 : 0;
      const taxaReuniaoVenda = reunioesRealizadas > 0 ? (negociosGanhos / reunioesRealizadas) * 100 : 0;
      const taxaLeadVenda = leadsTotais > 0 ? (negociosGanhos / leadsTotais) * 100 : 0;

      res.json({
        sdrId: row.id,
        sdrName: row.nome,
        sdrEmail: row.email,
        leadsTotais,
        reunioesRealizadas,
        negociosGanhos,
        negociosPerdidos,
        negociosEmAndamento: emAndamento,
        valorRecorrente,
        valorPontual,
        valorTotal: valorRecorrente + valorPontual,
        taxaLeadReuniao,
        taxaReuniaoVenda,
        taxaLeadVenda,
        primeiroLead: row.primeiro_lead,
        ultimoLead: row.ultimo_lead,
        ticketMedio: negociosGanhos > 0 ? (valorRecorrente + valorPontual) / negociosGanhos : 0
      });
    } catch (error) {
      console.error("[api] Error fetching SDR detail:", error);
      res.status(500).json({ error: "Failed to fetch SDR detail" });
    }
  });

  app.get("/api/sdrs/detail/monthly", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        WITH monthly_leads AS (
          SELECT
            TO_CHAR(d.date_create, 'YYYY-MM') as mes,
            TO_CHAR(d.date_create, 'Mon/YY') as mes_label,
            COUNT(DISTINCT d.id) as leads
          FROM "Bitrix".crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
          ${dateWhereClause}
          GROUP BY TO_CHAR(d.date_create, 'YYYY-MM'), TO_CHAR(d.date_create, 'Mon/YY')
        ),
        monthly_reunioes AS (
          SELECT
            TO_CHAR(d.data_reuniao_realizada, 'YYYY-MM') as mes,
            COUNT(*) as reunioes
          FROM "Bitrix".crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.data_reuniao_realizada IS NOT NULL
          ${dateConditions.length > 0 ? sql` AND ${sql.join(dateConditions.map(c => {
            return sql`d.data_reuniao_realizada >= ${dataInicio} AND d.data_reuniao_realizada <= ${dataFim}`;
          }), sql` AND `)}` : sql``}
          GROUP BY TO_CHAR(d.data_reuniao_realizada, 'YYYY-MM')
        ),
        monthly_vendas AS (
          SELECT
            TO_CHAR(d.data_fechamento, 'YYYY-MM') as mes,
            COUNT(*) as vendas,
            COALESCE(SUM(d.valor_recorrente), 0) as valor_recorrente,
            COALESCE(SUM(d.valor_pontual), 0) as valor_pontual
          FROM "Bitrix".crm_deal d
          WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
            AND d.stage_name = 'Negócio Ganho'
          ${dateConditions.length > 0 ? sql` AND d.data_fechamento >= ${dataInicio} AND d.data_fechamento <= ${dataFim}` : sql``}
          GROUP BY TO_CHAR(d.data_fechamento, 'YYYY-MM')
        )
        SELECT
          l.mes,
          l.mes_label as "mesLabel",
          l.leads,
          COALESCE(r.reunioes, 0) as reunioes,
          COALESCE(v.vendas, 0) as vendas,
          COALESCE(v.valor_recorrente, 0) as "valorRecorrente",
          COALESCE(v.valor_pontual, 0) as "valorPontual"
        FROM monthly_leads l
        LEFT JOIN monthly_reunioes r ON l.mes = r.mes
        LEFT JOIN monthly_vendas v ON l.mes = v.mes
        ORDER BY l.mes
      `);

      res.json(result.rows.map((row: any) => ({
        mes: row.mes,
        mesLabel: row.mesLabel,
        leads: parseInt(row.leads) || 0,
        reunioes: parseInt(row.reunioes) || 0,
        vendas: parseInt(row.vendas) || 0,
        valorRecorrente: parseFloat(row.valorRecorrente) || 0,
        valorPontual: parseFloat(row.valorPontual) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching SDR monthly data:", error);
      res.status(500).json({ error: "Failed to fetch monthly data" });
    }
  });

  app.get("/api/sdrs/detail/sources", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          COALESCE(d.source, 'Não informado') as source,
          COUNT(DISTINCT d.id) as leads,
          COUNT(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 END) as reunioes,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 END) as vendas
        FROM "Bitrix".crm_deal d
        WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
        ${dateWhereClause}
        GROUP BY COALESCE(d.source, 'Não informado')
        ORDER BY COUNT(DISTINCT d.id) DESC
      `);

      const totalLeads = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.leads), 0);

      res.json(result.rows.map((row: any) => ({
        source: row.source,
        leads: parseInt(row.leads) || 0,
        reunioes: parseInt(row.reunioes) || 0,
        vendas: parseInt(row.vendas) || 0,
        percentage: totalLeads > 0 ? ((parseInt(row.leads) || 0) / totalLeads) * 100 : 0
      })));
    } catch (error) {
      console.error("[api] Error fetching SDR sources:", error);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/sdrs/detail/pipelines", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          COALESCE(d.category_name, 'Não informado') as pipeline,
          COUNT(DISTINCT d.id) as leads,
          COUNT(CASE WHEN d.data_reuniao_realizada IS NOT NULL THEN 1 END) as reunioes,
          COUNT(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 END) as vendas,
          COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_recorrente ELSE 0 END), 0) as valor_recorrente
        FROM "Bitrix".crm_deal d
        WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
        ${dateWhereClause}
        GROUP BY COALESCE(d.category_name, 'Não informado')
        ORDER BY COUNT(DISTINCT d.id) DESC
      `);

      const totalLeads = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.leads), 0);

      res.json(result.rows.map((row: any) => ({
        pipeline: row.pipeline,
        leads: parseInt(row.leads) || 0,
        reunioes: parseInt(row.reunioes) || 0,
        vendas: parseInt(row.vendas) || 0,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        percentage: totalLeads > 0 ? ((parseInt(row.leads) || 0) / totalLeads) * 100 : 0
      })));
    } catch (error) {
      console.error("[api] Error fetching SDR pipelines:", error);
      res.status(500).json({ error: "Failed to fetch pipelines" });
    }
  });

  app.get("/api/sdrs/detail/stages", async (req, res) => {
    try {
      const { sdrId, dataInicio, dataFim } = req.query;

      if (!sdrId) {
        return res.status(400).json({ error: "sdrId is required" });
      }

      const sdrIdNum = parseInt(sdrId as string);
      if (isNaN(sdrIdNum)) {
        return res.status(400).json({ error: "Invalid sdrId" });
      }

      const dateConditions: ReturnType<typeof sql>[] = [];
      if (dataInicio) {
        dateConditions.push(sql`d.date_create >= ${dataInicio}`);
      }
      if (dataFim) {
        dateConditions.push(sql`d.date_create <= ${dataFim}`);
      }

      const dateWhereClause = dateConditions.length > 0
        ? sql` AND ${sql.join(dateConditions, sql` AND `)}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          COALESCE(d.stage_name, 'Não informado') as stage,
          COUNT(DISTINCT d.id) as count
        FROM "Bitrix".crm_deal d
        WHERE CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = ${sdrIdNum}
        ${dateWhereClause}
        GROUP BY COALESCE(d.stage_name, 'Não informado')
        ORDER BY COUNT(DISTINCT d.id) DESC
      `);

      const totalCount = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0);

      res.json(result.rows.map((row: any) => ({
        stage: row.stage,
        count: parseInt(row.count) || 0,
        percentage: totalCount > 0 ? ((parseInt(row.count) || 0) / totalCount) * 100 : 0
      })));
    } catch (error) {
      console.error("[api] Error fetching SDR stages:", error);
      res.status(500).json({ error: "Failed to fetch stages" });
    }
  });

  // ==================== DEALS TEST NOTIFICATION ====================

  app.post("/api/deals/test-notification", async (req, res) => {
    try {
      const deal = triggerTestNotification();
      res.json({ success: true, deal });
    } catch (error) {
      console.error("[api] Error triggering test notification:", error);
      res.status(500).json({ error: "Failed to trigger test notification" });
    }
  });

  // ==================== ANALISE DE VENDAS ====================

  // Filtros disponíveis
  app.get("/api/vendas/filtros", async (req, res) => {
    try {
      const [pipelines, sources, utmContents] = await Promise.all([
        db.execute(sql`SELECT DISTINCT category_name FROM "Bitrix".crm_deal WHERE category_name IS NOT NULL AND category_name != '' ORDER BY category_name`),
        db.execute(sql`SELECT DISTINCT source FROM "Bitrix".crm_deal WHERE source IS NOT NULL AND source != '' ORDER BY source`),
        db.execute(sql`SELECT DISTINCT utm_content FROM "Bitrix".crm_deal WHERE utm_content IS NOT NULL AND utm_content != '' ORDER BY utm_content`)
      ]);

      res.json({
        pipelines: pipelines.rows.map((r: any) => r.category_name),
        sources: sources.rows.map((r: any) => r.source),
        utmContents: utmContents.rows.map((r: any) => r.utm_content)
      });
    } catch (error) {
      console.error("[api] Error fetching vendas filters:", error);
      res.status(500).json({ error: "Failed to fetch filters" });
    }
  });

  // KPIs principais
  app.get("/api/vendas/kpis", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          COALESCE(SUM(valor_recorrente), 0) as receita_recorrente,
          COALESCE(SUM(valor_pontual), 0) as receita_pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as receita_total,
          COUNT(*) as total_contratos,
          COUNT(CASE WHEN valor_recorrente > 0 THEN 1 END) as contratos_recorrentes,
          COUNT(CASE WHEN valor_pontual > 0 AND (valor_recorrente = 0 OR valor_recorrente IS NULL) THEN 1 END) as contratos_pontuais,
          COALESCE(AVG(EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400), 0) as tempo_fechamento_dias,
          COALESCE(AVG(CASE WHEN valor_recorrente > 0 THEN valor_recorrente END), 0) as ticket_medio_recorrente,
          COALESCE(AVG(CASE WHEN valor_pontual > 0 THEN valor_pontual END), 0) as ticket_medio_pontual
        FROM "Bitrix".crm_deal
        ${whereClause}
      `);

      const row = result.rows[0] as any;

      res.json({
        receitaRecorrente: parseFloat(row.receita_recorrente) || 0,
        receitaPontual: parseFloat(row.receita_pontual) || 0,
        receitaTotal: parseFloat(row.receita_total) || 0,
        totalContratos: parseInt(row.total_contratos) || 0,
        contratosRecorrentes: parseInt(row.contratos_recorrentes) || 0,
        contratosPontuais: parseInt(row.contratos_pontuais) || 0,
        tempoFechamentoDias: parseFloat(row.tempo_fechamento_dias) || 0,
        ticketMedioRecorrente: parseFloat(row.ticket_medio_recorrente) || 0,
        ticketMedioPontual: parseFloat(row.ticket_medio_pontual) || 0
      });
    } catch (error) {
      console.error("[api] Error fetching vendas KPIs:", error);
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  });

  // Contratos por dia
  app.get("/api/vendas/contratos-por-dia", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          DATE(data_fechamento) as dia,
          COUNT(*) as contratos,
          COALESCE(SUM(valor_recorrente), 0) as valor_recorrente,
          COALESCE(SUM(valor_pontual), 0) as valor_pontual
        FROM "Bitrix".crm_deal
        ${whereClause}
        GROUP BY DATE(data_fechamento)
        ORDER BY dia
      `);

      res.json(result.rows.map((row: any) => ({
        dia: row.dia,
        contratos: parseInt(row.contratos) || 0,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        valorPontual: parseFloat(row.valor_pontual) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching contratos por dia:", error);
      res.status(500).json({ error: "Failed to fetch contratos por dia" });
    }
  });

  // MRR por Closer
  app.get("/api/vendas/mrr-por-closer", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`d.stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`d.source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`d.utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          COALESCE(c.nome, 'Não Atribuído') as closer_name,
          COALESCE(SUM(d.valor_recorrente), 0) as mrr,
          COALESCE(SUM(d.valor_pontual), 0) as pontual,
          COUNT(*) as contratos
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
        GROUP BY c.id, c.nome
        ORDER BY mrr DESC
      `);

      res.json(result.rows.map((row: any) => ({
        closer: row.closer_name,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        contratos: parseInt(row.contratos) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching MRR por closer:", error);
      res.status(500).json({ error: "Failed to fetch MRR por closer" });
    }
  });

  // MRR por SDR (sdr column joined with crm_closers)
  app.get("/api/vendas/mrr-por-sdr", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`d.stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`d.category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`d.source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`d.utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          COALESCE(u.nome, 'Não Atribuído') as sdr_name,
          COALESCE(SUM(d.valor_recorrente), 0) as mrr,
          COALESCE(SUM(d.valor_pontual), 0) as pontual,
          COUNT(*) as contratos
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_users u ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
        ${whereClause}
        GROUP BY u.id, u.nome
        ORDER BY mrr DESC
      `);

      res.json(result.rows.map((row: any) => ({
        sdr: row.sdr_name,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        contratos: parseInt(row.contratos) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching MRR por SDR:", error);
      res.status(500).json({ error: "Failed to fetch MRR por SDR" });
    }
  });

  // Receita por Fonte
  app.get("/api/vendas/receita-por-fonte", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source, utmContent } = req.query;

      const conditions: ReturnType<typeof sql>[] = [sql`stage_name = 'Negócio Ganho'`];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`source = ${source}`);
      }
      if (utmContent) {
        conditions.push(sql`utm_content = ${utmContent}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          COALESCE(source, 'Não Identificado') as fonte,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COUNT(*) as contratos
        FROM "Bitrix".crm_deal
        ${whereClause}
        GROUP BY source
        ORDER BY (COALESCE(SUM(valor_recorrente), 0) + COALESCE(SUM(valor_pontual), 0)) DESC
      `);

      res.json(result.rows.map((row: any) => ({
        fonte: row.fonte,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        contratos: parseInt(row.contratos) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching receita por fonte:", error);
      res.status(500).json({ error: "Failed to fetch receita por fonte" });
    }
  });

  // MRR Perdido (deals perdidos no período)
  app.get("/api/vendas/mrr-perdido", async (req, res) => {
    try {
      const { dataInicio, dataFim, pipeline, source } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`(stage_name ILIKE '%perdido%' OR stage_name ILIKE '%lost%' OR stage_name ILIKE '%cancelado%')`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (pipeline) {
        conditions.push(sql`category_name = ${pipeline}`);
      }
      if (source) {
        conditions.push(sql`source = ${source}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          COALESCE(SUM(valor_recorrente), 0) as mrr_perdido,
          COUNT(*) as contratos_perdidos
        FROM "Bitrix".crm_deal
        ${whereClause}
      `);

      const row = result.rows[0] as any;

      res.json({
        mrrPerdido: parseFloat(row.mrr_perdido) || 0,
        contratosPerdidos: parseInt(row.contratos_perdidos) || 0
      });
    } catch (error) {
      console.error("[api] Error fetching MRR perdido:", error);
      res.status(500).json({ error: "Failed to fetch MRR perdido" });
    }
  });

  // ============================================
  // DETALHAMENTO DE VENDAS (Sales Detail Dashboard)
  // ============================================

  // Métricas gerais de vendas
  app.get("/api/vendas/detalhamento/metricas", async (req, res) => {
    try {
      const { dataInicio, dataFim, source, category, closer } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`d.stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (source && source !== 'all') {
        conditions.push(sql`d.source = ${source}`);
      }
      if (category && category !== 'all') {
        conditions.push(sql`d.category_name = ${category}`);
      }
      if (closer && closer !== 'all') {
        conditions.push(sql`c.nome = ${closer}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          COUNT(*) as total_negocios,
          COALESCE(SUM(d.valor_recorrente), 0) as total_mrr,
          COALESCE(SUM(d.valor_pontual), 0) as total_pontual,
          COALESCE(SUM(d.valor_recorrente) + SUM(d.valor_pontual), 0) as receita_total,
          COALESCE(AVG(COALESCE(d.valor_recorrente, 0) + COALESCE(d.valor_pontual, 0)), 0) as ticket_medio,
          COALESCE(AVG(EXTRACT(EPOCH FROM (d.data_fechamento - d.date_create)) / 86400), 0) as ciclo_medio_dias,
          COUNT(DISTINCT d.company_name) as empresas_unicas,
          COUNT(DISTINCT c.nome) as closers_ativos,
          COUNT(CASE WHEN d.valor_recorrente > 0 THEN 1 END) as negocios_recorrentes,
          COUNT(CASE WHEN d.valor_pontual > 0 AND (d.valor_recorrente IS NULL OR d.valor_recorrente = 0) THEN 1 END) as negocios_pontuais,
          COUNT(CASE WHEN d.valor_recorrente > 0 AND d.valor_pontual > 0 THEN 1 END) as negocios_mistos,
          COALESCE(AVG(d.valor_recorrente), 0) as mrr_medio,
          COALESCE(AVG(d.valor_pontual), 0) as pontual_medio,
          MIN(d.data_fechamento) as primeira_venda,
          MAX(d.data_fechamento) as ultima_venda
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
      `);

      const row = result.rows[0] as any;

      res.json({
        totalNegocios: parseInt(row.total_negocios) || 0,
        totalMrr: parseFloat(row.total_mrr) || 0,
        totalPontual: parseFloat(row.total_pontual) || 0,
        receitaTotal: parseFloat(row.receita_total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0,
        cicloMedioDias: parseFloat(row.ciclo_medio_dias) || 0,
        empresasUnicas: parseInt(row.empresas_unicas) || 0,
        closersAtivos: parseInt(row.closers_ativos) || 0,
        negociosRecorrentes: parseInt(row.negocios_recorrentes) || 0,
        negociosPontuais: parseInt(row.negocios_pontuais) || 0,
        negociosMistos: parseInt(row.negocios_mistos) || 0,
        mrrMedio: parseFloat(row.mrr_medio) || 0,
        pontualMedio: parseFloat(row.pontual_medio) || 0,
        primeiraVenda: row.primeira_venda,
        ultimaVenda: row.ultima_venda
      });
    } catch (error) {
      console.error("[api] Error fetching metricas detalhamento:", error);
      res.status(500).json({ error: "Failed to fetch metricas" });
    }
  });

  // Lista de todos os negócios ganhos
  app.get("/api/vendas/detalhamento/negocios", async (req, res) => {
    try {
      const { dataInicio, dataFim, source, category, closer, orderBy, orderDir } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`d.stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }
      if (source && source !== 'all') {
        conditions.push(sql`d.source = ${source}`);
      }
      if (category && category !== 'all') {
        conditions.push(sql`d.category_name = ${category}`);
      }
      if (closer && closer !== 'all') {
        conditions.push(sql`c.nome = ${closer}`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const orderColumn = orderBy === 'valor' ? 'valor_total' :
                          orderBy === 'mrr' ? 'd.valor_recorrente' :
                          orderBy === 'pontual' ? 'd.valor_pontual' :
                          orderBy === 'ciclo' ? 'ciclo_dias' :
                          'd.data_fechamento';
      const orderDirection = orderDir === 'asc' ? 'ASC' : 'DESC';

      const result = await db.execute(sql`
        SELECT
          d.id,
          d.title,
          d.company_name,
          COALESCE(d.valor_recorrente, 0) as valor_recorrente,
          COALESCE(d.valor_pontual, 0) as valor_pontual,
          (COALESCE(d.valor_recorrente, 0) + COALESCE(d.valor_pontual, 0)) as valor_total,
          d.category_name,
          d.source,
          c.nome as closer_name,
          d.date_create,
          d.data_fechamento,
          EXTRACT(EPOCH FROM (d.data_fechamento - d.date_create)) / 86400 as ciclo_dias,
          d.utm_source,
          d.utm_medium,
          d.utm_campaign,
          d.utm_term,
          d.utm_content
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
        ORDER BY ${sql.raw(orderColumn)} ${sql.raw(orderDirection)} -- safe: whitelist-derived values (lines 1850-1855)
        LIMIT 500
      `);

      res.json(result.rows.map((row: any) => ({
        dealId: row.id,
        dealName: row.title,
        companyName: row.company_name,
        valorRecorrente: parseFloat(row.valor_recorrente) || 0,
        valorPontual: parseFloat(row.valor_pontual) || 0,
        valorTotal: parseFloat(row.valor_total) || 0,
        categoryName: row.category_name,
        source: row.source,
        pipelineName: row.category_name,
        ownerName: row.closer_name,
        createdDate: row.date_create,
        closeDate: row.data_fechamento,
        cicloDias: parseFloat(row.ciclo_dias) || 0,
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        utmCampaign: row.utm_campaign,
        utmTerm: row.utm_term,
        utmContent: row.utm_content
      })));
    } catch (error) {
      console.error("[api] Error fetching negocios detalhamento:", error);
      res.status(500).json({ error: "Failed to fetch negocios" });
    }
  });

  // Distribuição por fonte
  app.get("/api/vendas/detalhamento/por-fonte", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`,
        sql`source IS NOT NULL`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          source as fonte,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as total,
          COALESCE(AVG(COALESCE(valor_recorrente, 0) + COALESCE(valor_pontual, 0)), 0) as ticket_medio
        FROM "Bitrix".crm_deal
        ${whereClause}
        GROUP BY source
        ORDER BY total DESC
      `);

      res.json(result.rows.map((row: any) => ({
        fonte: row.fonte,
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching por fonte:", error);
      res.status(500).json({ error: "Failed to fetch por fonte" });
    }
  });

  // Distribuição por closer/owner
  app.get("/api/vendas/detalhamento/por-closer", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`d.stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`d.data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`d.data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          c.nome as closer,
          COUNT(*) as quantidade,
          COALESCE(SUM(d.valor_recorrente), 0) as mrr,
          COALESCE(SUM(d.valor_pontual), 0) as pontual,
          COALESCE(SUM(d.valor_recorrente) + SUM(d.valor_pontual), 0) as total,
          COALESCE(AVG(COALESCE(d.valor_recorrente, 0) + COALESCE(d.valor_pontual, 0)), 0) as ticket_medio,
          COALESCE(AVG(EXTRACT(EPOCH FROM (d.data_fechamento - d.date_create)) / 86400), 0) as ciclo_medio
        FROM "Bitrix".crm_deal d
        LEFT JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
        ${whereClause}
        GROUP BY c.nome
        ORDER BY total DESC
      `);

      res.json(result.rows.map((row: any) => ({
        closer: row.closer || 'Sem closer',
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0,
        cicloMedio: parseFloat(row.ciclo_medio) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching por closer:", error);
      res.status(500).json({ error: "Failed to fetch por closer" });
    }
  });

  // Evolução mensal
  app.get("/api/vendas/detalhamento/evolucao-mensal", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`,
        sql`data_fechamento IS NOT NULL`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          TO_CHAR(data_fechamento, 'YYYY-MM') as mes,
          TO_CHAR(data_fechamento, 'Mon/YY') as mes_label,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as total,
          COALESCE(AVG(COALESCE(valor_recorrente, 0) + COALESCE(valor_pontual, 0)), 0) as ticket_medio
        FROM "Bitrix".crm_deal
        ${whereClause}
        GROUP BY TO_CHAR(data_fechamento, 'YYYY-MM'), TO_CHAR(data_fechamento, 'Mon/YY')
        ORDER BY mes ASC
      `);

      res.json(result.rows.map((row: any) => ({
        mes: row.mes,
        mesLabel: row.mes_label,
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching evolucao mensal:", error);
      res.status(500).json({ error: "Failed to fetch evolucao mensal" });
    }
  });

  // Distribuição por UTM
  app.get("/api/vendas/detalhamento/por-utm", async (req, res) => {
    try {
      const { dataInicio, dataFim, utmType } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      // safe: utmColumn is whitelist-derived, not user input
      const utmColumn = utmType === 'medium' ? 'utm_medium' :
                        utmType === 'campaign' ? 'utm_campaign' :
                        utmType === 'term' ? 'utm_term' :
                        utmType === 'content' ? 'utm_content' :
                        'utm_source';

      conditions.push(sql`${sql.raw(utmColumn)} IS NOT NULL AND ${sql.raw(utmColumn)} != ''`);

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          ${sql.raw(utmColumn)} as utm_value,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as total
        FROM "Bitrix".crm_deal
        ${whereClause}
        GROUP BY ${sql.raw(utmColumn)}
        ORDER BY total DESC
      `);

      res.json(result.rows.map((row: any) => ({
        utmValue: row.utm_value,
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching por UTM:", error);
      res.status(500).json({ error: "Failed to fetch por UTM" });
    }
  });

  // Filtros disponíveis
  app.get("/api/vendas/detalhamento/filtros", async (req, res) => {
    try {
      const [sources, categories, closersResult] = await Promise.all([
        db.execute(sql`SELECT DISTINCT source FROM "Bitrix".crm_deal WHERE stage_name = 'Negócio Ganho' AND source IS NOT NULL ORDER BY source`),
        db.execute(sql`SELECT DISTINCT category_name FROM "Bitrix".crm_deal WHERE stage_name = 'Negócio Ganho' AND category_name IS NOT NULL ORDER BY category_name`),
        db.execute(sql`
          SELECT DISTINCT c.nome as closer_name
          FROM "Bitrix".crm_deal d
          INNER JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
          WHERE d.stage_name = 'Negócio Ganho'
          ORDER BY c.nome
        `)
      ]);

      res.json({
        sources: sources.rows.map((r: any) => r.source),
        categories: categories.rows.map((r: any) => r.category_name),
        closers: closersResult.rows.map((r: any) => r.closer_name)
      });
    } catch (error) {
      console.error("[api] Error fetching filtros:", error);
      res.status(500).json({ error: "Failed to fetch filtros" });
    }
  });

  // Análise de ciclo de vendas
  app.get("/api/vendas/detalhamento/ciclo-vendas", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`,
        sql`data_fechamento IS NOT NULL`,
        sql`date_create IS NOT NULL`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          CASE
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
            ELSE '60+ dias'
          END as faixa,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as valor_total,
          COALESCE(AVG(COALESCE(valor_recorrente, 0) + COALESCE(valor_pontual, 0)), 0) as ticket_medio
        FROM "Bitrix".crm_deal
        ${whereClause}
        GROUP BY
          CASE
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
            WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
            ELSE '60+ dias'
          END
        ORDER BY
          CASE
            WHEN CASE
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
              ELSE '60+ dias'
            END = '0-7 dias' THEN 1
            WHEN CASE
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
              ELSE '60+ dias'
            END = '8-14 dias' THEN 2
            WHEN CASE
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
              ELSE '60+ dias'
            END = '15-30 dias' THEN 3
            WHEN CASE
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 7 THEN '0-7 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 14 THEN '8-14 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 30 THEN '15-30 dias'
              WHEN EXTRACT(EPOCH FROM (data_fechamento - date_create)) / 86400 <= 60 THEN '31-60 dias'
              ELSE '60+ dias'
            END = '31-60 dias' THEN 4
            ELSE 5
          END
      `);

      res.json(result.rows.map((row: any) => ({
        faixa: row.faixa,
        quantidade: parseInt(row.quantidade) || 0,
        valorTotal: parseFloat(row.valor_total) || 0,
        ticketMedio: parseFloat(row.ticket_medio) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching ciclo vendas:", error);
      res.status(500).json({ error: "Failed to fetch ciclo vendas" });
    }
  });

  // Tipo de contrato (recorrente vs pontual)
  app.get("/api/vendas/detalhamento/tipo-contrato", async (req, res) => {
    try {
      const { dataInicio, dataFim } = req.query;

      const conditions: ReturnType<typeof sql>[] = [
        sql`stage_name = 'Negócio Ganho'`
      ];

      if (dataInicio) {
        conditions.push(sql`data_fechamento >= ${dataInicio}::date`);
      }
      if (dataFim) {
        conditions.push(sql`data_fechamento <= ${dataFim}::date + interval '1 day'`);
      }

      const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

      const result = await db.execute(sql`
        SELECT
          CASE
            WHEN valor_recorrente > 0 AND (valor_pontual IS NULL OR valor_pontual = 0) THEN 'Recorrente'
            WHEN (valor_recorrente IS NULL OR valor_recorrente = 0) AND valor_pontual > 0 THEN 'Pontual'
            WHEN valor_recorrente > 0 AND valor_pontual > 0 THEN 'Misto'
            ELSE 'Sem valor'
          END as tipo,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_recorrente), 0) as mrr,
          COALESCE(SUM(valor_pontual), 0) as pontual,
          COALESCE(SUM(valor_recorrente) + SUM(valor_pontual), 0) as total
        FROM "Bitrix".crm_deal
        ${whereClause}
        GROUP BY
          CASE
            WHEN valor_recorrente > 0 AND (valor_pontual IS NULL OR valor_pontual = 0) THEN 'Recorrente'
            WHEN (valor_recorrente IS NULL OR valor_recorrente = 0) AND valor_pontual > 0 THEN 'Pontual'
            WHEN valor_recorrente > 0 AND valor_pontual > 0 THEN 'Misto'
            ELSE 'Sem valor'
          END
        ORDER BY total DESC
      `);

      res.json(result.rows.map((row: any) => ({
        tipo: row.tipo,
        quantidade: parseInt(row.quantidade) || 0,
        mrr: parseFloat(row.mrr) || 0,
        pontual: parseFloat(row.pontual) || 0,
        total: parseFloat(row.total) || 0
      })));
    } catch (error) {
      console.error("[api] Error fetching tipo contrato:", error);
      res.status(500).json({ error: "Failed to fetch tipo contrato" });
    }
  });

  // Endpoint para buscar fotos de usuários via email (auth_users do app)
  app.get("/api/user-photos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          LOWER(TRIM(email)) as email,
          name,
          picture
        FROM cortex_core.auth_users
        WHERE email IS NOT NULL AND picture IS NOT NULL AND picture <> ''
      `);

      const photoMap: Record<string, string> = {};
      result.rows.forEach((row: any) => {
        if (row.picture && row.email) {
          photoMap[row.email] = row.picture;
        }
      });

      res.json(photoMap);
    } catch (error) {
      console.error("[api] Error fetching user photos:", error);
      res.status(500).json({ error: "Failed to fetch user photos" });
    }
  });

  // Endpoint para buscar fotos de closers via email (JOIN com auth_users)
  app.get("/api/closers/photos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          c.id,
          c.name,
          LOWER(TRIM(c.email)) as closer_email,
          a.picture
        FROM "Bitrix".crm_closers c
        LEFT JOIN cortex_core.auth_users a ON LOWER(TRIM(c.email)) = LOWER(TRIM(a.email))
        WHERE c.email IS NOT NULL
      `);

      const photoMap: Record<string, string> = {};
      result.rows.forEach((row: any) => {
        if (row.picture && row.name) {
          photoMap[row.name] = row.picture;
        }
      });

      res.json(photoMap);
    } catch (error) {
      console.error("[api] Error fetching closer photos:", error);
      res.status(500).json({ error: "Failed to fetch closer photos" });
    }
  });

  // Endpoint para buscar fotos de SDRs via email (JOIN com auth_users)
  app.get("/api/sdrs/photos", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          u.id,
          u.nome,
          LOWER(TRIM(u.email)) as sdr_email,
          a.picture
        FROM "Bitrix".crm_users u
        LEFT JOIN cortex_core.auth_users a ON LOWER(TRIM(u.email)) = LOWER(TRIM(a.email))
        WHERE u.email IS NOT NULL
      `);

      const photoMap: Record<string, string> = {};
      result.rows.forEach((row: any) => {
        if (row.picture && row.nome) {
          photoMap[row.nome] = row.picture;
        }
      });

      res.json(photoMap);
    } catch (error) {
      console.error("[api] Error fetching SDR photos:", error);
      res.status(500).json({ error: "Failed to fetch SDR photos" });
    }
  });
}

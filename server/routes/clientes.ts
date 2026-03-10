import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerClientesRoutes(app: Express) {
  app.get("/api/clientes", async (req, res) => {
    try {
      const clientes = await storage.getClientes();
      res.json(clientes);
    } catch (error) {
      console.error("[api] Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clientes-ltv", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          cliente_id,
          COALESCE(SUM(CAST(pago AS DECIMAL)), 0) as ltv
        FROM "Conta Azul".caz_receber
        WHERE cliente_id IS NOT NULL
          AND UPPER(status) IN ('PAGO', 'ACQUITTED')
        GROUP BY cliente_id
      `);

      const ltvMap: Record<string, number> = {};
      for (const row of result.rows) {
        ltvMap[row.cliente_id as string] = parseFloat(row.ltv as string) || 0;
      }

      res.json(ltvMap);
    } catch (error) {
      console.error("[api] Error fetching clients LTV:", error);
      res.status(500).json({ error: "Failed to fetch clients LTV" });
    }
  });

  app.get("/api/cliente/:id", async (req, res) => {
    try {
      const cliente = await storage.getClienteById(req.params.id);
      if (!cliente) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(cliente);
    } catch (error) {
      console.error("[api] Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.patch("/api/cliente/:id", async (req, res) => {
    try {
      const cliente = await storage.getClienteById(req.params.id);
      if (!cliente) {
        return res.status(404).json({ error: "Client not found" });
      }

      const cnpj = cliente.cnpjCliente || cliente.cnpj;
      if (!cnpj) {
        return res.status(400).json({ error: "Client CNPJ not found" });
      }

      const {
        cnpj: newCnpj,
        telefone,
        responsavel,
        responsavelGeral,
        nomeDono,
        email,
        site,
        instagram,
        linksContrato,
        linkListaClickup,
        cluster,
        statusCliente,
        statusConta,
        tipoNegocio,
        faturamentoMensal,
        investimentoAds
      } = req.body;

      // Check for responsavel change to log event
      const oldResponsavel = cliente.responsavel;
      const oldResponsavelGeral = cliente.responsavelGeral;

      await db.execute(sql`
        UPDATE "Clickup".cup_clientes
        SET
          cnpj = COALESCE(${newCnpj ?? null}, cnpj),
          telefone = ${telefone ?? null},
          responsavel = ${responsavel ?? null},
          responsavel_geral = ${responsavelGeral ?? null},
          nome_dono = ${nomeDono ?? null},
          email = ${email ?? null},
          site = ${site ?? null},
          instagram = ${instagram ?? null},
          links_contrato = ${linksContrato ?? null},
          link_lista_clickup = ${linkListaClickup ?? null},
          cluster = ${cluster ?? null},
          status = ${statusCliente ?? null},
          status_conta = ${statusConta ?? null},
          tipo_negocio = ${tipoNegocio ?? null},
          faturamento_mensal = ${faturamentoMensal ?? null},
          investimento_ads = ${investimentoAds ?? null}
        WHERE cnpj = ${cnpj}
      `);

      // Log event if responsavel changed
      const user = req.user as any;
      const usuarioNome = user?.name || 'Sistema';

      if (responsavel && responsavel !== oldResponsavel) {
        await db.execute(sql`
          INSERT INTO cliente_eventos (cliente_cnpj, tipo, titulo, descricao, usuario_id, usuario_nome)
          VALUES (${cnpj}, 'responsavel_change', 'Responsável alterado',
                  ${'De ' + (oldResponsavel || 'Não definido') + ' para ' + responsavel},
                  ${user?.id || 'system'}, ${usuarioNome})
        `);
      }

      if (responsavelGeral && responsavelGeral !== oldResponsavelGeral) {
        await db.execute(sql`
          INSERT INTO cliente_eventos (cliente_cnpj, tipo, titulo, descricao, usuario_id, usuario_nome)
          VALUES (${cnpj}, 'responsavel_change', 'Responsável Geral alterado',
                  ${'De ' + (oldResponsavelGeral || 'Não definido') + ' para ' + responsavelGeral},
                  ${user?.id || 'system'}, ${usuarioNome})
        `);
      }

      const updatedCliente = await storage.getClienteById(req.params.id);
      res.json(updatedCliente);
    } catch (error) {
      console.error("[api] Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.patch("/api/clientes/:cnpj/status-conta", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const { statusConta } = req.body;

      const validStatuses = ['saudavel', 'requer_atencao', 'insatisfeito', null];
      if (statusConta !== undefined && !validStatuses.includes(statusConta)) {
        return res.status(400).json({ error: "Invalid statusConta value. Must be one of: saudavel, requer_atencao, insatisfeito" });
      }

      await db.execute(sql`
        UPDATE "Clickup".cup_clientes
        SET status_conta = ${statusConta ?? null}
        WHERE cnpj = ${cnpj}
      `);

      res.json({ success: true, statusConta: statusConta ?? null });
    } catch (error) {
      console.error("[api] Error updating client status_conta:", error);
      res.status(500).json({ error: "Failed to update client status" });
    }
  });

  app.get("/api/cliente/:clienteId/receitas", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const receitas = await storage.getContasReceberByCliente(req.params.clienteId, limit);
      res.json(receitas);
    } catch (error) {
      console.error("[api] Error fetching receivables:", error);
      res.status(500).json({ error: "Failed to fetch receivables" });
    }
  });

  app.get("/api/cliente/:clienteId/revenue", async (req, res) => {
    try {
      const revenue = await storage.getClienteRevenue(req.params.clienteId);
      res.json(revenue);
    } catch (error) {
      console.error("[api] Error fetching revenue:", error);
      res.status(500).json({ error: "Failed to fetch revenue" });
    }
  });

  app.get("/api/cliente/:clienteId/contratos", async (req, res) => {
    try {
      const contratos = await storage.getContratosPorCliente(req.params.clienteId);
      res.json(contratos);
    } catch (error) {
      console.error("[api] Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  // ============================================
  // Client Portal API - Tasks, Communications, Legal Status
  // ============================================

  // GET /api/cliente/:cnpj/tasks - Fetch tasks for a client (with subtasks hierarchy)
  app.get("/api/cliente/:cnpj/tasks", async (req, res) => {
    try {
      const { cnpj } = req.params;

      const clienteResult = await db.execute(sql`
        SELECT nome FROM "Clickup".cup_clientes WHERE cnpj = ${cnpj}
      `);

      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;

      if (!clienteNome) {
        return res.json([]);
      }

      const tasksResult = await db.execute(sql`
        SELECT
          t.id,
          t.nome,
          t.descricao,
          t.status,
          t.prioridade,
          t.responsavel,
          t.data_vencimento as "dataLimite",
          t.created_at as "dataCriacao",
          t.data_conclusao as "dataConclusao",
          t.cliente,
          t.equipe,
          t.tipo_task as "tipoTask",
          t.parent_id as "parentId",
          COALESCE((SELECT COUNT(*) FROM cortex_core.tarefa_comentarios tc WHERE tc.tarefa_id = t.id), 0)::int as "comentariosCount",
          COALESCE((SELECT COUNT(*) FROM cortex_core.tarefa_anexos ta WHERE ta.tarefa_id = t.id), 0)::int as "anexosCount"
        FROM cortex_core.tarefas_clientes t
        WHERE LOWER(TRIM(t.cliente)) = LOWER(TRIM(${clienteNome}))
           OR t.cliente ILIKE ${`%${clienteNome}%`}
        ORDER BY
          CASE WHEN LOWER(TRIM(t.cliente)) = LOWER(TRIM(${clienteNome})) THEN 0 ELSE 1 END,
          t.created_at DESC NULLS LAST
        LIMIT 500
      `);

      // Build hierarchy: parent tasks with subtasks nested
      const allTasks = tasksResult.rows as any[];
      const taskMap = new Map<number, any>();
      const parentTasks: any[] = [];

      // First pass: index all tasks
      for (const task of allTasks) {
        task.subtasks = [];
        taskMap.set(task.id, task);
      }

      // Second pass: attach children to parents
      for (const task of allTasks) {
        if (task.parentId && taskMap.has(task.parentId)) {
          taskMap.get(task.parentId).subtasks.push(task);
        } else if (!task.parentId) {
          parentTasks.push(task);
        } else {
          // Orphaned subtask (parent not in results) — show as top-level
          parentTasks.push(task);
        }
      }

      res.json(parentTasks);
    } catch (error) {
      console.error("[api] Error fetching client tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // PUT /api/cliente/tasks/:id - Update a task
  app.put("/api/cliente/tasks/:id", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { status, responsavel, equipe, prioridade, data_vencimento, nome } = req.body;

      // Auto-set data_conclusao based on status
      let dataConclusao: string | null = null;
      if (status) {
        const completed = ['concluída', 'done', 'complete', 'completo', 'aprovado', 'finalizado'].includes(status.toLowerCase());
        if (completed) {
          dataConclusao = new Date().toISOString();
        }
      }

      const result = await db.execute(sql`
        UPDATE cortex_core.tarefas_clientes SET
          status = COALESCE(${status ?? null}, status),
          responsavel = CASE WHEN ${responsavel !== undefined ? 'yes' : 'no'} = 'yes' THEN ${responsavel ?? null} ELSE responsavel END,
          equipe = CASE WHEN ${equipe !== undefined ? 'yes' : 'no'} = 'yes' THEN ${equipe ?? null} ELSE equipe END,
          prioridade = COALESCE(${prioridade ?? null}, prioridade),
          data_vencimento = CASE WHEN ${data_vencimento !== undefined ? 'yes' : 'no'} = 'yes' THEN ${data_vencimento ?? null}::timestamp ELSE data_vencimento END,
          nome = COALESCE(${nome ?? null}, nome),
          data_conclusao = CASE WHEN ${dataConclusao} IS NOT NULL THEN ${dataConclusao}::timestamp
                               WHEN ${status ?? null} IS NOT NULL THEN NULL
                               ELSE data_conclusao END
        WHERE id = ${taskId}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // DELETE /api/cliente/tasks/:id - Delete a task (cascade deletes subtasks)
  app.delete("/api/cliente/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await db.execute(sql`
        DELETE FROM cortex_core.tarefas_clientes WHERE id = ${parseInt(id)}
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ============================================
  // Task Comments API
  // ============================================

  app.get("/api/cliente/tasks/:id/comentarios", async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      const result = await db.execute(sql`
        SELECT id, tarefa_id as "tarefaId", autor, conteudo, created_at as "createdAt"
        FROM cortex_core.tarefa_comentarios
        WHERE tarefa_id = ${tarefaId}
        ORDER BY created_at ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/cliente/tasks/:id/comentarios", async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      const { conteudo, autor } = req.body;
      if (!conteudo) return res.status(400).json({ error: "conteudo is required" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.tarefa_comentarios (tarefa_id, autor, conteudo)
        VALUES (${tarefaId}, ${autor ?? null}, ${conteudo})
        RETURNING id, tarefa_id as "tarefaId", autor, conteudo, created_at as "createdAt"
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/cliente/tasks/:id/comentarios/:comentarioId", async (req, res) => {
    try {
      const comentarioId = parseInt(req.params.comentarioId);
      await db.execute(sql`
        DELETE FROM cortex_core.tarefa_comentarios WHERE id = ${comentarioId}
      `);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // ============================================
  // Task Attachments API
  // ============================================

  app.get("/api/cliente/tasks/:id/anexos", async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      const result = await db.execute(sql`
        SELECT id, tarefa_id as "tarefaId", nome_arquivo as "nomeArquivo", object_path as "objectPath",
               content_type as "contentType", tamanho, autor, created_at as "createdAt"
        FROM cortex_core.tarefa_anexos
        WHERE tarefa_id = ${tarefaId}
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  app.post("/api/cliente/tasks/:id/anexos", async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      const { nome_arquivo, object_path, content_type, tamanho, autor } = req.body;
      if (!nome_arquivo || !object_path) return res.status(400).json({ error: "nome_arquivo and object_path are required" });

      const result = await db.execute(sql`
        INSERT INTO cortex_core.tarefa_anexos (tarefa_id, nome_arquivo, object_path, content_type, tamanho, autor)
        VALUES (${tarefaId}, ${nome_arquivo}, ${object_path}, ${content_type ?? null}, ${tamanho ?? null}, ${autor ?? null})
        RETURNING id, tarefa_id as "tarefaId", nome_arquivo as "nomeArquivo", object_path as "objectPath",
                  content_type as "contentType", tamanho, autor, created_at as "createdAt"
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating attachment:", error);
      res.status(500).json({ error: "Failed to create attachment" });
    }
  });

  app.delete("/api/cliente/tasks/:id/anexos/:anexoId", async (req, res) => {
    try {
      const anexoId = parseInt(req.params.anexoId);
      await db.execute(sql`
        DELETE FROM cortex_core.tarefa_anexos WHERE id = ${anexoId}
      `);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting attachment:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  });

  // GET /api/cliente/:cnpj/comunicacoes - List all communications for a client
  app.get("/api/cliente/:cnpj/comunicacoes", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const { status } = req.query;

      let result;
      if (status) {
        result = await db.execute(sql`
          SELECT * FROM cliente_comunicacoes
          WHERE cliente_id = ${cnpj} AND status = ${status}
          ORDER BY criado_em DESC
        `);
      } else {
        result = await db.execute(sql`
          SELECT * FROM cliente_comunicacoes
          WHERE cliente_id = ${cnpj}
          ORDER BY criado_em DESC
        `);
      }

      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching client communications:", error);
      res.status(500).json({ error: "Failed to fetch communications" });
    }
  });

  // POST /api/cliente/:cnpj/comunicacoes - Create new communication
  app.post("/api/cliente/:cnpj/comunicacoes", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const { tipo, titulo, conteudo, prioridade, status } = req.body;
      const criadoPor = (req as any).user?.email || 'sistema';

      if (!tipo || !titulo) {
        return res.status(400).json({ error: "Tipo e título são obrigatórios" });
      }

      const result = await db.execute(sql`
        INSERT INTO cliente_comunicacoes (cliente_id, tipo, titulo, conteudo, prioridade, status, criado_por, criado_em, atualizado_em)
        VALUES (${cnpj}, ${tipo}, ${titulo}, ${conteudo || null}, ${prioridade || 'normal'}, ${status || 'ativo'}, ${criadoPor}, NOW(), NOW())
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating communication:", error);
      res.status(500).json({ error: "Failed to create communication" });
    }
  });

  // PATCH /api/cliente/:cnpj/comunicacoes/:id - Update communication
  app.patch("/api/cliente/:cnpj/comunicacoes/:id", async (req, res) => {
    try {
      const { cnpj, id } = req.params;
      const { tipo, titulo, conteudo, prioridade, status } = req.body;

      const result = await db.execute(sql`
        UPDATE cliente_comunicacoes
        SET
          tipo = COALESCE(${tipo}, tipo),
          titulo = COALESCE(${titulo}, titulo),
          conteudo = COALESCE(${conteudo}, conteudo),
          prioridade = COALESCE(${prioridade}, prioridade),
          status = COALESCE(${status}, status),
          atualizado_em = NOW()
        WHERE id = ${parseInt(id)} AND cliente_id = ${cnpj}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Comunicação não encontrada" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating communication:", error);
      res.status(500).json({ error: "Failed to update communication" });
    }
  });

  // DELETE /api/cliente/:cnpj/comunicacoes/:id - Delete communication
  app.delete("/api/cliente/:cnpj/comunicacoes/:id", async (req, res) => {
    try {
      const { cnpj, id } = req.params;

      const result = await db.execute(sql`
        DELETE FROM cliente_comunicacoes
        WHERE id = ${parseInt(id)} AND cliente_id = ${cnpj}
        RETURNING id
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Comunicação não encontrada" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting communication:", error);
      res.status(500).json({ error: "Failed to delete communication" });
    }
  });

  // GET /api/cliente/:cnpj/situacao-juridica - Fetch legal/financial status
  app.get("/api/cliente/:cnpj/situacao-juridica", async (req, res) => {
    try {
      const { cnpj } = req.params;

      // Query both cortex_core.inadimplencia_contextos and juridico_clientes in parallel
      const [inadimplenciaResult, juridicoResult] = await Promise.all([
        db.execute(sql`
          SELECT
            cliente_id,
            contexto,
            evidencias,
            acao,
            status_financeiro,
            detalhe_financeiro,
            atualizado_por,
            atualizado_em,
            valor_acordado,
            data_acordo
          FROM cortex_core.inadimplencia_contextos
          WHERE cliente_id = ${cnpj}
        `),
        db.execute(sql`
          SELECT
            id,
            cliente_id,
            procedimento,
            status_juridico,
            observacoes,
            valor_acordado,
            data_acordo,
            numero_parcelas,
            protocolo_processo,
            advogado_responsavel,
            data_criacao,
            data_atualizacao,
            atualizado_por
          FROM juridico_clientes
          WHERE cliente_id = ${cnpj}
        `)
      ]);

      const inadimplencia = inadimplenciaResult.rows.length > 0 ? inadimplenciaResult.rows[0] : null;
      const juridico = juridicoResult.rows.length > 0 ? juridicoResult.rows[0] : null;

      res.json({
        clienteId: cnpj,
        inadimplencia,
        juridico,
        hasInadimplencia: inadimplencia !== null,
        hasJuridico: juridico !== null
      });
    } catch (error) {
      console.error("[api] Error fetching legal status:", error);
      res.status(500).json({ error: "Failed to fetch legal status" });
    }
  });

  // GET /api/clientes/:cnpj/alertas - Fetch alerts for a client
  app.get("/api/clientes/:cnpj/alertas", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const alerts: Array<{
        id: string;
        type: 'inadimplencia' | 'vencimento_proximo' | 'contrato_expirando' | 'cliente_inativo';
        severity: 'critical' | 'warning' | 'info';
        title: string;
        message: string;
        actionUrl?: string;
        metadata?: Record<string, any>;
      }> = [];

      const today = new Date();
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Get client info from caz_clientes
      const clienteResult = await db.execute(sql`
        SELECT nome FROM "Conta Azul".caz_clientes WHERE cnpj = ${cnpj}
      `);
      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;

      // Get client status from cup_clientes
      const statusResult = await db.execute(sql`
        SELECT status FROM "Clickup".cup_clientes WHERE cnpj = ${cnpj}
      `);
      const clienteStatus = statusResult.rows.length > 0 ? (statusResult.rows[0] as any).status : null;


      if (clienteNome) {
        // Check for overdue payments (inadimplência)
        const overdueResult = await db.execute(sql`
          SELECT
            COUNT(*) as count,
            SUM(COALESCE(nao_pago, 0)) as total
          FROM "Conta Azul".caz_parcelas
          WHERE empresa = ${clienteNome}
            AND COALESCE(nao_pago, 0) > 0
            AND data_vencimento < ${today}
        `);
        const overdueData = overdueResult.rows[0] as any;
        const overdueCount = parseInt(overdueData?.count || '0');
        const overdueTotal = parseFloat(overdueData?.total || '0');

        if (overdueCount > 0 && overdueTotal > 0) {
          const formattedValue = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(overdueTotal);
          alerts.push({
            id: 'inadimplencia',
            type: 'inadimplencia',
            severity: 'critical',
            title: 'Inadimplência',
            message: `${overdueCount} parcela${overdueCount > 1 ? 's' : ''} em atraso totalizando ${formattedValue}`,
            metadata: { count: overdueCount, total: overdueTotal }
          });
        }

        // Check for payments due within next 7 days
        const upcomingResult = await db.execute(sql`
          SELECT
            SUM(COALESCE(nao_pago, 0)) as total,
            MIN(data_vencimento) as proxima_data
          FROM "Conta Azul".caz_parcelas
          WHERE empresa = ${clienteNome}
            AND COALESCE(nao_pago, 0) > 0
            AND data_vencimento >= ${today}
            AND data_vencimento <= ${sevenDaysFromNow}
        `);
        const upcomingData = upcomingResult.rows[0] as any;
        const upcomingTotal = parseFloat(upcomingData?.total || '0');
        const proximaData = upcomingData?.proxima_data;

        if (upcomingTotal > 0 && proximaData) {
          const formattedValue = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(upcomingTotal);
          const dataFormatada = new Date(proximaData).toLocaleDateString('pt-BR');
          alerts.push({
            id: 'vencimento_proximo',
            type: 'vencimento_proximo',
            severity: 'warning',
            title: 'Próximo Vencimento',
            message: `${formattedValue} vence em ${dataFormatada}`,
            metadata: { total: upcomingTotal, dueDate: proximaData }
          });
        }
      }

      // Check for expiring contracts
      const expiringContractsResult = await db.execute(sql`
        SELECT
          servico,
          data_encerramento
        FROM "Clickup".cup_contratos
        WHERE id_task IN (
          SELECT id_task FROM "Clickup".cup_contratos c2
          WHERE EXISTS (
            SELECT 1 FROM "Clickup".cup_clientes cl WHERE cl.cnpj = ${cnpj} AND cl.nome = c2.id_task
          )
          UNION
          SELECT task_id FROM "Clickup".cup_clientes WHERE cnpj = ${cnpj}
        )
        AND LOWER(status) = 'ativo'
        AND data_encerramento IS NOT NULL
        AND data_encerramento > ${today}
        AND data_encerramento <= ${thirtyDaysFromNow}
        ORDER BY data_encerramento ASC
        LIMIT 5
      `);

      for (const contrato of expiringContractsResult.rows as any[]) {
        const dataEncerramento = new Date(contrato.data_encerramento);
        const diasRestantes = Math.ceil((dataEncerramento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: `contrato_expirando_${contrato.servico}`,
          type: 'contrato_expirando',
          severity: 'warning',
          title: 'Contrato Expirando',
          message: `${contrato.servico} expira em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`,
          metadata: { servico: contrato.servico, diasRestantes, dataEncerramento: contrato.data_encerramento }
        });
      }

      res.json(alerts);
    } catch (error) {
      console.error("[api] Error fetching client alerts:", error);
      res.status(500).json({ error: "Failed to fetch client alerts" });
    }
  });

  // GET /api/clientes/:cnpj/timeline - Fetch unified timeline of events for a client
  app.get("/api/clientes/:cnpj/timeline", async (req, res) => {
    try {
      const { cnpj } = req.params;

      // Get client info from caz_clientes
      const clienteResult = await db.execute(sql`
        SELECT nome FROM "Conta Azul".caz_clientes WHERE cnpj = ${cnpj}
      `);

      const clienteNome = clienteResult.rows.length > 0 ? (clienteResult.rows[0] as any).nome : null;

      if (!clienteNome) {
        return res.json([]);
      }

      const today = new Date();
      const twelveMonthsAgo = new Date(today);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Query payments, contracts, and custom events in parallel
      const [parcelasResult, contratosResult, eventosResult] = await Promise.all([
        // Payment events from caz_parcelas
        db.execute(sql`
          SELECT
            id,
            status,
            valor_pago,
            nao_pago,
            data_vencimento,
            data_quitacao,
            descricao,
            metodo_pagamento,
            valor_bruto
          FROM "Conta Azul".caz_parcelas
          WHERE empresa = ${clienteNome}
            AND (data_vencimento >= ${twelveMonthsAgo} OR data_quitacao >= ${twelveMonthsAgo})
          ORDER BY COALESCE(data_quitacao, data_vencimento) DESC
          LIMIT 50
        `),
        // Contract events from cup_contratos
        db.execute(sql`
          SELECT
            id_subtask,
            servico,
            status,
            valorr,
            valorp,
            data_inicio,
            data_encerramento,
            squad
          FROM "Clickup".cup_contratos
          WHERE id_task IN (
            SELECT id_task FROM "Clickup".cup_contratos c2
            INNER JOIN "Clickup".cup_clientes cl ON cl.nome ILIKE ('%' || SPLIT_PART(c2.servico, ' - ', 1) || '%')
            WHERE cl.cnpj = ${cnpj}
          ) OR servico ILIKE ('%' || ${clienteNome} || '%')
          ORDER BY COALESCE(data_encerramento, data_inicio) DESC NULLS LAST
          LIMIT 30
        `),
        // Custom events from cliente_eventos
        db.execute(sql`
          SELECT id, tipo as type, titulo as title, descricao as description,
                 usuario_nome as "userName", created_at as date
          FROM cliente_eventos
          WHERE cliente_cnpj = ${cnpj}
          ORDER BY created_at DESC
          LIMIT 50
        `)
      ]);

      const events: Array<{
        id: string;
        type: 'payment_received' | 'payment_due' | 'payment_overdue' | 'contract_started' | 'contract_ended' | 'contract_cancelled';
        date: string;
        title: string;
        description: string;
        amount?: number;
        metadata?: Record<string, any>;
      }> = [];

      // Process payment events
      for (const row of parcelasResult.rows) {
        const parcela = row as any;
        const valorPago = parseFloat(parcela.valor_pago || '0');
        const naoPago = parseFloat(parcela.nao_pago || '0');
        const valorBruto = parseFloat(parcela.valor_bruto || '0');
        const status = parcela.status?.toUpperCase();
        const dataVencimento = parcela.data_vencimento ? new Date(parcela.data_vencimento) : null;
        const dataQuitacao = parcela.data_quitacao ? new Date(parcela.data_quitacao) : null;

        if (status === 'PAGO' || status === 'ACQUITTED') {
          // Payment received
          if (dataQuitacao) {
            events.push({
              id: `payment-received-${parcela.id}`,
              type: 'payment_received',
              date: dataQuitacao.toISOString(),
              title: 'Pagamento Recebido',
              description: parcela.descricao || 'Pagamento processado',
              amount: valorPago || valorBruto,
              metadata: {
                metodoPagamento: parcela.metodo_pagamento,
                parcelaId: parcela.id
              }
            });
          }
        } else if (dataVencimento && dataVencimento < today && naoPago > 0) {
          // Payment overdue
          events.push({
            id: `payment-overdue-${parcela.id}`,
            type: 'payment_overdue',
            date: dataVencimento.toISOString(),
            title: 'Pagamento em Atraso',
            description: parcela.descricao || 'Pagamento vencido não quitado',
            amount: naoPago,
            metadata: {
              diasAtraso: Math.floor((today.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24)),
              parcelaId: parcela.id
            }
          });
        } else if (dataVencimento && dataVencimento >= today) {
          // Payment due
          events.push({
            id: `payment-due-${parcela.id}`,
            type: 'payment_due',
            date: dataVencimento.toISOString(),
            title: 'Pagamento a Vencer',
            description: parcela.descricao || 'Pagamento programado',
            amount: valorBruto || naoPago,
            metadata: {
              parcelaId: parcela.id
            }
          });
        }
      }

      // Process contract events
      for (const row of contratosResult.rows) {
        const contrato = row as any;
        const valorRecorrente = parseFloat(contrato.valorr || '0');
        const valorPontual = parseFloat(contrato.valorp || '0');
        const dataInicio = contrato.data_inicio ? new Date(contrato.data_inicio) : null;
        const dataEncerramento = contrato.data_encerramento ? new Date(contrato.data_encerramento) : null;
        const status = contrato.status?.toLowerCase();

        // Contract started
        if (dataInicio) {
          events.push({
            id: `contract-started-${contrato.id_subtask}`,
            type: 'contract_started',
            date: dataInicio.toISOString(),
            title: 'Contrato Iniciado',
            description: contrato.servico || 'Novo contrato ativo',
            amount: valorRecorrente || valorPontual,
            metadata: {
              squad: contrato.squad,
              contratoId: contrato.id_subtask
            }
          });
        }

        // Contract ended or cancelled
        if (dataEncerramento) {
          const isCancelled = status === 'cancelado' || status === 'cancelled';
          events.push({
            id: `contract-${isCancelled ? 'cancelled' : 'ended'}-${contrato.id_subtask}`,
            type: isCancelled ? 'contract_cancelled' : 'contract_ended',
            date: dataEncerramento.toISOString(),
            title: isCancelled ? 'Contrato Cancelado' : 'Contrato Encerrado',
            description: contrato.servico || 'Contrato finalizado',
            amount: valorRecorrente || valorPontual,
            metadata: {
              squad: contrato.squad,
              contratoId: contrato.id_subtask
            }
          });
        }
      }

      // Process custom events from cliente_eventos
      for (const evento of eventosResult.rows as any[]) {
        events.push({
          id: `evento-${evento.id}`,
          type: evento.type,
          date: evento.date ? new Date(evento.date).toISOString() : new Date().toISOString(),
          title: evento.title,
          description: evento.description || `Por ${evento.userName}`,
          metadata: {
            userName: evento.userName
          }
        });
      }

      // Sort by date descending
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Limit to 50 events
      res.json(events.slice(0, 50));
    } catch (error) {
      console.error("[api] Error fetching client timeline:", error);
      res.status(500).json({ error: "Failed to fetch timeline" });
    }
  });

  app.post("/api/clientes/:cnpj/eventos", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const { tipo, titulo, descricao, dadosExtras } = req.body;

      const user = req.user as any;
      const usuarioId = user?.id || 'system';
      const usuarioNome = user?.name || 'Sistema';

      const result = await db.execute(sql`
        INSERT INTO cliente_eventos (cliente_cnpj, tipo, titulo, descricao, usuario_id, usuario_nome, dados_extras)
        VALUES (${cnpj}, ${tipo}, ${titulo}, ${descricao || null}, ${usuarioId}, ${usuarioNome}, ${dadosExtras || null})
        RETURNING id, cliente_cnpj as "clienteCnpj", tipo, titulo, descricao, usuario_id as "usuarioId",
                  usuario_nome as "usuarioNome", dados_extras as "dadosExtras", created_at as "createdAt"
      `);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating client event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.get("/api/clientes/:cnpj/eventos", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const result = await db.execute(sql`
        SELECT id, cliente_cnpj as "clienteCnpj", tipo, titulo, descricao,
               usuario_id as "usuarioId", usuario_nome as "usuarioNome",
               dados_extras as "dadosExtras", created_at as "createdAt"
        FROM cliente_eventos
        WHERE cliente_cnpj = ${cnpj}
        ORDER BY created_at DESC
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching client events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });
}

import type { Express } from "express";
import { eq, desc, asc, sql, and } from "drizzle-orm";
import { negativacaoAcoes, notificacoesExtrajudiciaisEnviadas } from "../../shared/schema";
import { z } from "zod";
import { sendNotificacaoExtrajudicial, SendGridError } from "../services/sendgrid-notification";

const enviarNotificacaoSchema = z.object({
  clienteId: z.string().min(1),
  clienteNome: z.string().optional(),
  emailDestino: z.string().email(),
  assunto: z.string().min(10).max(200),
  corpoTexto: z.string().min(100).max(50000),
  corpoHtml: z.string().min(100).max(100000),
});

export function registerNegativacaoRoutes(app: Express, db: any) {
  // ============== NEGATIVAÇÃO ==============

  // GET /api/negativacao/kanban — All actions grouped by etapa
  app.get("/api/negativacao/kanban", async (_req, res) => {
    try {
      // Reset any previously auto-moved records so they get re-evaluated
      await db.execute(sql`
        UPDATE cortex_core.negativacao_acoes
        SET status = 'pendente', etapa = 'notificacao'
        WHERE observacoes IN ('Quitado - removido automaticamente', 'Quitado - movido automaticamente')
          AND status IN ('concluido', 'quitado')
      `);

      // Clients with no overdue unpaid debt: check WHY they have no debt
      // 1) "Recuperados" = paid late (>20 days after due date) — real recovery effort
      await db.execute(sql`
        UPDATE cortex_core.negativacao_acoes
        SET status = 'quitado',
            etapa = 'recuperados',
            observacoes = 'Recuperado - pagamento com atraso > 20 dias',
            atualizado_em = NOW()
        WHERE status IN ('pendente', 'em_andamento')
          AND cliente_id IN (
            SELECT DISTINCT p.id_cliente::text
            FROM "Conta Azul".caz_parcelas p
            WHERE p.tipo_evento != 'DESPESA'
              AND p.id_cliente IS NOT NULL
              AND p.data_quitacao IS NOT NULL
              AND p.data_quitacao::date - p.data_vencimento::date > 20
              AND p.nao_pago = 0
            GROUP BY p.id_cliente
          )
          AND cliente_id NOT IN (
            SELECT DISTINCT p.id_cliente::text
            FROM "Conta Azul".caz_parcelas p
            WHERE p.nao_pago > 0
              AND p.tipo_evento != 'DESPESA'
              AND p.data_vencimento < CURRENT_DATE
              AND p.id_cliente IS NOT NULL
          )
      `);

      // 2) Everyone else with no overdue debt: remove silently (paid on time, no parcelas, future only)
      await db.execute(sql`
        UPDATE cortex_core.negativacao_acoes
        SET status = 'concluido',
            observacoes = 'Removido - sem débito vencido pendente',
            atualizado_em = NOW()
        WHERE status IN ('pendente', 'em_andamento')
          AND cliente_id NOT IN (
            SELECT DISTINCT p.id_cliente::text
            FROM "Conta Azul".caz_parcelas p
            WHERE p.nao_pago > 0
              AND p.tipo_evento != 'DESPESA'
              AND p.data_vencimento < CURRENT_DATE
              AND p.id_cliente IS NOT NULL
          )
      `);

      const allActions = await db
        .select()
        .from(negativacaoAcoes)
        .where(sql`${negativacaoAcoes.status} IN ('pendente', 'em_andamento', 'quitado')`)
        .orderBy(desc(negativacaoAcoes.criadoEm));

      // Group by etapa
      const notificacao = allActions.filter((a: any) => a.etapa === "notificacao");
      const protesto = allActions.filter((a: any) => a.etapa === "protesto");
      const negativacao = allActions.filter((a: any) => a.etapa === "negativacao");
      const acaoJudicial = allActions.filter((a: any) => a.etapa === "acao_judicial");
      const recuperados = allActions.filter((a: any) => a.etapa === "recuperados");

      // Summary metrics
      const clienteIds = new Set(allActions.map((a: any) => a.clienteId));
      const totalValor = allActions.reduce(
        (sum: number, a: any) => sum + parseFloat(a.valorInadimplente || "0"),
        0
      );
      const acordos = allActions.filter(
        (a: any) => parseFloat(a.valorAcordado || "0") > 0
      );
      const totalAcordado = acordos.reduce(
        (sum: number, a: any) => sum + parseFloat(a.valorAcordado || "0"),
        0
      );
      const taxaRecuperacao =
        totalValor > 0 ? (totalAcordado / totalValor) * 100 : 0;

      res.json({
        colunas: { notificacao, protesto, negativacao, acao_judicial: acaoJudicial, recuperados },
        resumo: {
          totalClientes: clienteIds.size,
          totalValor,
          totalAcordos: acordos.length,
          taxaRecuperacao: Math.round(taxaRecuperacao * 100) / 100,
        },
      });
    } catch (error) {
      console.error("[api] Error fetching negativacao kanban:", error);
      res.status(500).json({ error: "Failed to fetch negativacao kanban" });
    }
  });

  // GET /api/negativacao/cliente/:clienteId — Client detail + action history
  app.get("/api/negativacao/cliente/:clienteId", async (req, res) => {
    try {
      const { clienteId } = req.params;
      const actions = await db
        .select()
        .from(negativacaoAcoes)
        .where(eq(negativacaoAcoes.clienteId, clienteId))
        .orderBy(asc(negativacaoAcoes.criadoEm));

      res.json(actions);
    } catch (error) {
      console.error("[api] Error fetching negativacao client:", error);
      res.status(500).json({ error: "Failed to fetch client actions" });
    }
  });

  // GET /api/negativacao/cliente/:clienteId/notificacao-data — Dados para gerar notificação extrajudicial
  app.get("/api/negativacao/cliente/:clienteId/notificacao-data", async (req, res) => {
    try {
      const { clienteId } = req.params;

      const clienteResult = await db.execute(sql`
        WITH cliente_base AS (
          SELECT DISTINCT ON (TRIM(cc.ids::text))
            TRIM(cc.ids::text) as id_cliente,
            cc.nome,
            cc.empresa,
            cc.cnpj,
            cc.email,
            cc.endereco,
            cup.task_id
          FROM "Conta Azul".caz_clientes cc
          LEFT JOIN "Clickup".cup_clientes cup
            ON TRIM(cc.cnpj::text) = TRIM(cup.cnpj::text)
            AND cc.cnpj IS NOT NULL AND cc.cnpj::text != ''
          WHERE TRIM(cc.ids::text) = ${clienteId}
          ORDER BY TRIM(cc.ids::text), cup.status DESC NULLS LAST
          LIMIT 1
        ),
        servicos_agg AS (
          SELECT STRING_AGG(DISTINCT cont.servico, ', ') as servicos
          FROM cliente_base cb
          LEFT JOIN "Clickup".cup_contratos cont
            ON TRIM(cb.task_id::text) = TRIM(cont.id_task::text)
          WHERE cont.servico IS NOT NULL
        )
        SELECT cb.*, sa.servicos
        FROM cliente_base cb
        CROSS JOIN servicos_agg sa
      `);

      const row = (clienteResult.rows as any[])[0];
      if (!row) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const parcelasResult = await db.execute(sql`
        SELECT nao_pago, data_vencimento
        FROM "Conta Azul".caz_parcelas
        WHERE id_cliente = ${clienteId}
          AND tipo_evento = 'RECEITA'
          AND nao_pago::numeric > 0
          AND data_vencimento < CURRENT_DATE
        ORDER BY data_vencimento ASC
      `);

      const parcelas = (parcelasResult.rows as any[]).map((p) => ({
        naoPago: parseFloat(p.nao_pago || "0"),
        dataVencimento: p.data_vencimento instanceof Date
          ? p.data_vencimento.toISOString().split("T")[0]
          : String(p.data_vencimento),
      }));

      res.json({
        cliente: {
          nomeCliente: row.nome || "",
          empresa: row.empresa || "",
          cnpj: row.cnpj || null,
          email: row.email || null,
          endereco: row.endereco || null,
          servicos: row.servicos || null,
        },
        parcelas,
      });
    } catch (error) {
      console.error("[api] Error fetching notificacao-data:", error);
      res.status(500).json({ error: "Failed to fetch notification data" });
    }
  });

  // GET /api/negativacao/cliente/:clienteId/notificacoes-enviadas — histórico de envios
  app.get(
    "/api/negativacao/cliente/:clienteId/notificacoes-enviadas",
    async (req, res) => {
      try {
        const { clienteId } = req.params;
        const rows = await db
          .select({
            id: notificacoesExtrajudiciaisEnviadas.id,
            emailDestino: notificacoesExtrajudiciaisEnviadas.emailDestino,
            enviadoPor: notificacoesExtrajudiciaisEnviadas.enviadoPor,
            enviadoEm: notificacoesExtrajudiciaisEnviadas.enviadoEm,
            status: notificacoesExtrajudiciaisEnviadas.status,
          })
          .from(notificacoesExtrajudiciaisEnviadas)
          .where(eq(notificacoesExtrajudiciaisEnviadas.clienteId, clienteId))
          .orderBy(desc(notificacoesExtrajudiciaisEnviadas.enviadoEm))
          .limit(10);

        res.json(rows);
      } catch (error) {
        console.error("[api] Error fetching notificacoes enviadas:", error);
        res.status(500).json({ error: "Failed to fetch notification history" });
      }
    },
  );

  // POST /api/negativacao/notificacoes/enviar — dispara envio + grava auditoria
  app.post("/api/negativacao/notificacoes/enviar", async (req, res) => {
    try {
      const parsed = enviarNotificacaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          issues: parsed.error.issues,
        });
      }

      const user = (req as any).user;
      const enviadoPor = user?.name || user?.googleId || "Sistema";

      const { clienteId, clienteNome, emailDestino, assunto, corpoTexto, corpoHtml } = parsed.data;

      // 1. Grava registro otimista
      const [inserted] = await db
        .insert(notificacoesExtrajudiciaisEnviadas)
        .values({
          clienteId,
          clienteNome: clienteNome ?? null,
          emailDestino,
          assunto,
          corpoTexto,
          corpoHtml,
          enviadoPor,
          status: "enviado",
        })
        .returning({ id: notificacoesExtrajudiciaisEnviadas.id });

      // 2. Chama SendGrid
      try {
        const result = await sendNotificacaoExtrajudicial({
          to: emailDestino,
          subject: assunto,
          text: corpoTexto,
          html: corpoHtml,
        });

        // 3. Atualiza com message_id
        await db
          .update(notificacoesExtrajudiciaisEnviadas)
          .set({ sendgridMessageId: result.messageId })
          .where(eq(notificacoesExtrajudiciaisEnviadas.id, inserted.id));

        return res.json({
          id: inserted.id,
          status: "enviado",
          sendgridMessageId: result.messageId,
        });
      } catch (sendErr: any) {
        const erroMsg =
          sendErr instanceof SendGridError
            ? `SendGrid ${sendErr.status}: ${JSON.stringify(sendErr.body)}`
            : sendErr?.message ?? "Erro desconhecido";

        await db
          .update(notificacoesExtrajudiciaisEnviadas)
          .set({ status: "erro", erro: erroMsg })
          .where(eq(notificacoesExtrajudiciaisEnviadas.id, inserted.id));

        console.error("[api] SendGrid error:", erroMsg);
        return res
          .status(500)
          .json({ error: "Falha no envio", detail: erroMsg, auditId: inserted.id });
      }
    } catch (error: any) {
      console.error("[api] Error in POST /notificacoes/enviar:", error);
      return res
        .status(500)
        .json({ error: "Unexpected error", message: error?.message });
    }
  });

  // POST /api/negativacao/acoes — Create new action
  app.post("/api/negativacao/acoes", async (req, res) => {
    try {
      const {
        clienteId,
        clienteNome,
        clienteCnpj,
        etapa,
        valorInadimplente,
        diasAtraso,
        responsavel,
        observacoes,
        dataAcao,
        protocolo,
        documentoUrl,
        criadoPor,
      } = req.body;

      const [created] = await db
        .insert(negativacaoAcoes)
        .values({
          clienteId,
          clienteNome,
          clienteCnpj: clienteCnpj || null,
          etapa: etapa || "notificacao",
          status: "pendente",
          valorInadimplente: valorInadimplente ? String(valorInadimplente) : "0",
          diasAtraso: diasAtraso || 0,
          responsavel: responsavel || null,
          observacoes: observacoes || null,
          dataAcao: dataAcao || null,
          protocolo: protocolo || null,
          documentoUrl: documentoUrl || null,
          criadoPor: criadoPor || null,
        })
        .returning();

      res.json(created);
    } catch (error) {
      console.error("[api] Error creating negativacao action:", error);
      res.status(500).json({ error: "Failed to create action" });
    }
  });

  // PUT /api/negativacao/acoes/:id — Update action
  app.put("/api/negativacao/acoes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body, atualizadoEm: new Date() };

      const [updated] = await db
        .update(negativacaoAcoes)
        .set(updates)
        .where(eq(negativacaoAcoes.id, parseInt(id)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Action not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("[api] Error updating negativacao action:", error);
      res.status(500).json({ error: "Failed to update action" });
    }
  });

  // PUT /api/negativacao/mover/:clienteId — Move client to new etapa
  app.put("/api/negativacao/mover/:clienteId", async (req, res) => {
    try {
      const { clienteId } = req.params;
      const { novaEtapa, responsavel, criadoPor } = req.body;

      // Get the latest action for this client
      const [latest] = await db
        .select()
        .from(negativacaoAcoes)
        .where(eq(negativacaoAcoes.clienteId, clienteId))
        .orderBy(desc(negativacaoAcoes.criadoEm))
        .limit(1);

      if (!latest) {
        return res.status(404).json({ error: "No actions found for this client" });
      }

      // Mark latest as concluido
      await db
        .update(negativacaoAcoes)
        .set({ status: "concluido", atualizadoEm: new Date() })
        .where(eq(negativacaoAcoes.id, latest.id));

      // Create new action in the new etapa
      const [newAction] = await db
        .insert(negativacaoAcoes)
        .values({
          clienteId,
          clienteNome: latest.clienteNome,
          clienteCnpj: latest.clienteCnpj,
          etapa: novaEtapa,
          status: "pendente",
          valorInadimplente: latest.valorInadimplente,
          diasAtraso: latest.diasAtraso,
          responsavel: responsavel || latest.responsavel,
          criadoPor: criadoPor || null,
        })
        .returning();

      res.json(newAction);
    } catch (error) {
      console.error("[api] Error moving negativacao client:", error);
      res.status(500).json({ error: "Failed to move client" });
    }
  });

  // GET /api/negativacao/resumo — Summary metrics
  app.get("/api/negativacao/resumo", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          COUNT(DISTINCT cliente_id) as total_clientes,
          COALESCE(SUM(valor_inadimplente::numeric), 0) as total_valor,
          COUNT(*) FILTER (WHERE valor_acordado IS NOT NULL AND valor_acordado::numeric > 0) as total_acordos,
          CASE
            WHEN COALESCE(SUM(valor_inadimplente::numeric), 0) > 0
            THEN ROUND(
              COALESCE(SUM(valor_acordado::numeric) FILTER (WHERE valor_acordado IS NOT NULL AND valor_acordado::numeric > 0), 0)
              / SUM(valor_inadimplente::numeric) * 100, 2
            )
            ELSE 0
          END as taxa_recuperacao
        FROM cortex_core.negativacao_acoes
      `);

      const row = result.rows?.[0] || result[0] || {};
      res.json({
        totalClientes: parseInt(row.total_clientes || "0"),
        totalValor: parseFloat(row.total_valor || "0"),
        totalAcordos: parseInt(row.total_acordos || "0"),
        taxaRecuperacao: parseFloat(row.taxa_recuperacao || "0"),
      });
    } catch (error) {
      console.error("[api] Error fetching negativacao resumo:", error);
      res.status(500).json({ error: "Failed to fetch resumo" });
    }
  });

  // GET /api/negativacao/mensagens/:clienteId — Billing messages from TurboZap
  app.get("/api/negativacao/mensagens/:clienteId", async (req, res) => {
    try {
      const { clienteId } = req.params;
      const result = await db.execute(sql`
        SELECT
          tipo_cobranca,
          criado_em,
          valor,
          telefone,
          status
        FROM cortex_core.turbozap_envios
        WHERE id_cliente = ${clienteId}
        ORDER BY criado_em DESC
      `);
      res.json(result.rows || []);
    } catch (error) {
      console.error("[api] Error fetching mensagens cobranca:", error);
      res.status(500).json({ error: "Failed to fetch billing messages" });
    }
  });
}

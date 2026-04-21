import type { Express } from "express";
import { eq, desc, asc, sql, and } from "drizzle-orm";
import { negativacaoAcoes } from "../../shared/schema";

export function registerNegativacaoRoutes(app: Express, db: any) {
  // ============== NEGATIVAÇÃO ==============

  // GET /api/negativacao/kanban — All actions grouped by etapa
  app.get("/api/negativacao/kanban", async (_req, res) => {
    try {
      // Auto-remove clients with no overdue unpaid debt (paid or not yet due)
      await db.execute(sql`
        UPDATE cortex_core.negativacao_acoes
        SET status = 'concluido',
            observacoes = 'Quitado - removido automaticamente',
            atualizado_em = NOW()
        WHERE status IN ('pendente', 'em_andamento')
          AND cliente_id NOT IN (
            SELECT DISTINCT p.id_cliente::text
            FROM "Conta Azul".caz_parcelas p
            WHERE p.nao_pago > 0
              AND p.tipo_evento != 'DESPESA'
              AND p.data_vencimento < CURRENT_DATE
          )
      `);

      const allActions = await db
        .select()
        .from(negativacaoAcoes)
        .orderBy(desc(negativacaoAcoes.criadoEm));

      // Group by etapa
      const notificacao = allActions.filter((a: any) => a.etapa === "notificacao");
      const protesto = allActions.filter((a: any) => a.etapa === "protesto");
      const negativacao = allActions.filter((a: any) => a.etapa === "negativacao");
      const acaoJudicial = allActions.filter((a: any) => a.etapa === "acao_judicial");

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
        colunas: { notificacao, protesto, negativacao, acao_judicial: acaoJudicial },
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

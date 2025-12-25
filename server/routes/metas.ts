import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

async function initializeSquadMetasTable(db: any): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS squad_metas (
        id SERIAL PRIMARY KEY,
        squad TEXT NOT NULL,
        ano INTEGER NOT NULL,
        mes INTEGER NOT NULL,
        meta_mrr DECIMAL(15, 2) NOT NULL DEFAULT 0,
        meta_contratos INTEGER DEFAULT 0,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by TEXT,
        UNIQUE(squad, ano, mes)
      )
    `);
    console.log('[metas] Squad metas table initialized');
  } catch (error) {
    console.error('[metas] Error initializing squad_metas table:', error);
  }
}

export async function registerMetasRoutes(app: Express, db: any, storage: IStorage) {
  await initializeSquadMetasTable(db);

  // ============ Squad Goals (Metas) Endpoints ============

  app.get("/api/squads/metas", async (req, res) => {
    try {
      const { ano, mes, squad } = req.query;
      
      let query = sql`SELECT * FROM squad_metas WHERE 1=1`;
      
      if (ano) {
        const anoNum = parseInt(ano as string);
        query = sql`${query} AND ano = ${anoNum}`;
      }
      
      if (mes) {
        const mesNum = parseInt(mes as string);
        query = sql`${query} AND mes = ${mesNum}`;
      }
      
      if (squad) {
        query = sql`${query} AND LOWER(squad) = LOWER(${squad as string})`;
      }
      
      query = sql`${query} ORDER BY ano DESC, mes DESC, squad`;
      
      const result = await db.execute(query);
      
      res.json(result.rows.map((row: any) => ({
        id: row.id,
        squad: row.squad,
        ano: row.ano,
        mes: row.mes,
        metaMrr: parseFloat(row.meta_mrr) || 0,
        metaContratos: row.meta_contratos || 0,
        observacoes: row.observacoes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
      })));
    } catch (error) {
      console.error("[api] Error fetching squad metas:", error);
      res.status(500).json({ error: "Failed to fetch squad metas" });
    }
  });

  app.get("/api/squads/metas/progresso", async (req, res) => {
    try {
      const { ano, mes } = req.query;
      
      const currentDate = new Date();
      const targetAno = ano ? parseInt(ano as string) : currentDate.getFullYear();
      const targetMes = mes ? parseInt(mes as string) : currentDate.getMonth() + 1;
      
      const startDate = new Date(targetAno, targetMes - 1, 1);
      const endDate = new Date(targetAno, targetMes, 0, 23, 59, 59);
      
      const metasResult = await db.execute(sql`
        SELECT * FROM squad_metas 
        WHERE ano = ${targetAno} AND mes = ${targetMes}
      `);
      
      const contratosResult = await db.execute(sql`
        SELECT 
          squad,
          COUNT(*) as total_contratos,
          COALESCE(SUM(CAST(valorr AS DECIMAL)), 0) as mrr_realizado
        FROM cup_contratos
        WHERE status = 'Ativo'
          AND data_inicio <= ${endDate.toISOString()}
          AND (data_encerramento IS NULL OR data_encerramento > ${startDate.toISOString()})
        GROUP BY squad
      `);
      
      const contratosMap = new Map<string, { totalContratos: number; mrrRealizado: number }>();
      for (const row of contratosResult.rows as any[]) {
        if (row.squad) {
          contratosMap.set(row.squad.toLowerCase(), {
            totalContratos: parseInt(row.total_contratos) || 0,
            mrrRealizado: parseFloat(row.mrr_realizado) || 0,
          });
        }
      }
      
      const resultado = (metasResult.rows as any[]).map((meta: any) => {
        const squadKey = (meta.squad || '').toLowerCase();
        const realizado = contratosMap.get(squadKey) || { totalContratos: 0, mrrRealizado: 0 };
        const metaMrr = parseFloat(meta.meta_mrr) || 0;
        const metaContratos = meta.meta_contratos || 0;
        
        return {
          id: meta.id,
          squad: meta.squad,
          ano: meta.ano,
          mes: meta.mes,
          metaMrr,
          metaContratos,
          mrrRealizado: realizado.mrrRealizado,
          contratosRealizados: realizado.totalContratos,
          percentualMrr: metaMrr > 0 ? Math.round((realizado.mrrRealizado / metaMrr) * 100) : 0,
          percentualContratos: metaContratos > 0 ? Math.round((realizado.totalContratos / metaContratos) * 100) : 0,
        };
      });
      
      const squadsComContratos = Array.from(contratosMap.entries())
        .filter(([squad]) => !resultado.find(r => r.squad.toLowerCase() === squad))
        .map(([squad, data]) => ({
          id: null,
          squad,
          ano: targetAno,
          mes: targetMes,
          metaMrr: 0,
          metaContratos: 0,
          mrrRealizado: data.mrrRealizado,
          contratosRealizados: data.totalContratos,
          percentualMrr: 0,
          percentualContratos: 0,
        }));
      
      res.json({
        ano: targetAno,
        mes: targetMes,
        squads: [...resultado, ...squadsComContratos],
      });
    } catch (error) {
      console.error("[api] Error calculating squad progress:", error);
      res.status(500).json({ error: "Failed to calculate squad progress" });
    }
  });

  app.post("/api/squads/metas", isAdmin, async (req, res) => {
    try {
      const { squad, ano, mes, metaMrr, metaContratos, observacoes } = req.body;
      
      if (!squad || !ano || !mes) {
        return res.status(400).json({ error: "squad, ano e mes são obrigatórios" });
      }
      
      const userId = (req as any).user?.id || null;
      
      const result = await db.execute(sql`
        INSERT INTO squad_metas (squad, ano, mes, meta_mrr, meta_contratos, observacoes, created_by)
        VALUES (${squad}, ${ano}, ${mes}, ${metaMrr || 0}, ${metaContratos || 0}, ${observacoes || null}, ${userId})
        ON CONFLICT (squad, ano, mes) 
        DO UPDATE SET 
          meta_mrr = EXCLUDED.meta_mrr,
          meta_contratos = EXCLUDED.meta_contratos,
          observacoes = EXCLUDED.observacoes,
          updated_at = NOW()
        RETURNING *
      `);
      
      const row = result.rows[0] as any;
      res.status(201).json({
        id: row.id,
        squad: row.squad,
        ano: row.ano,
        mes: row.mes,
        metaMrr: parseFloat(row.meta_mrr) || 0,
        metaContratos: row.meta_contratos || 0,
        observacoes: row.observacoes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (error) {
      console.error("[api] Error creating squad meta:", error);
      res.status(500).json({ error: "Failed to create squad meta" });
    }
  });

  app.put("/api/squads/metas/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { metaMrr, metaContratos, observacoes } = req.body;
      
      const result = await db.execute(sql`
        UPDATE squad_metas 
        SET 
          meta_mrr = COALESCE(${metaMrr}, meta_mrr),
          meta_contratos = COALESCE(${metaContratos}, meta_contratos),
          observacoes = COALESCE(${observacoes}, observacoes),
          updated_at = NOW()
        WHERE id = ${parseInt(id)}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Meta not found" });
      }
      
      const row = result.rows[0] as any;
      res.json({
        id: row.id,
        squad: row.squad,
        ano: row.ano,
        mes: row.mes,
        metaMrr: parseFloat(row.meta_mrr) || 0,
        metaContratos: row.meta_contratos || 0,
        observacoes: row.observacoes,
        updatedAt: row.updated_at,
      });
    } catch (error) {
      console.error("[api] Error updating squad meta:", error);
      res.status(500).json({ error: "Failed to update squad meta" });
    }
  });

  app.delete("/api/squads/metas/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await db.execute(sql`
        DELETE FROM squad_metas WHERE id = ${parseInt(id)} RETURNING id
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Meta not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting squad meta:", error);
      res.status(500).json({ error: "Failed to delete squad meta" });
    }
  });

  // ============ User Notifications Endpoints ============

  app.get("/api/notifications", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const offset = (page - 1) * pageSize;
      
      const result = await db.execute(sql`
        SELECT * FROM staging.notifications 
        WHERE dismissed = false
        ORDER BY read ASC, priority DESC, created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `);
      
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM staging.notifications WHERE dismissed = false
      `);
      const total = parseInt((countResult.rows[0] as any)?.total || '0');
      
      res.json({
        items: (result.rows as any[]).map((row: any) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          message: row.message,
          entityId: row.entity_id,
          entityType: row.entity_type,
          priority: row.priority || 'medium',
          read: row.read,
          dismissed: row.dismissed,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      console.error("[api] Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM staging.notifications 
        WHERE read = false AND dismissed = false
      `);
      
      res.json({ count: parseInt((result.rows[0] as any)?.count || '0') });
    } catch (error) {
      console.error("[api] Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await db.execute(sql`
        UPDATE staging.notifications 
        SET read = true 
        WHERE id = ${parseInt(id)}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    try {
      await db.execute(sql`
        UPDATE staging.notifications 
        SET read = true 
        WHERE read = false AND dismissed = false
      `);
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await db.execute(sql`
        UPDATE staging.notifications 
        SET dismissed = true 
        WHERE id = ${parseInt(id)}
        RETURNING id
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error dismissing notification:", error);
      res.status(500).json({ error: "Failed to dismiss notification" });
    }
  });

  app.post("/api/notifications/generate-alerts", isAdmin, async (req, res) => {
    try {
      const alerts: Array<{
        type: string;
        title: string;
        message: string;
        entityId: string | null;
        entityType: string | null;
        priority: string;
        uniqueKey: string;
      }> = [];

      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      const parcelasVencidasResult = await db.execute(sql`
        SELECT 
          p.id,
          p.descricao,
          p.valor_bruto,
          p.data_vencimento,
          p.id_cliente,
          c.nome as cliente_nome
        FROM caz_parcelas p
        LEFT JOIN caz_clientes c ON p.id_cliente = c.ids OR p.id_cliente = CAST(c.id AS TEXT)
        WHERE p.status != 'Pago'
          AND p.data_vencimento < ${sevenDaysAgo.toISOString()}
          AND p.tipo_evento = 'RECEITA'
        ORDER BY p.data_vencimento ASC
        LIMIT 100
      `);
      
      for (const parcela of parcelasVencidasResult.rows as any[]) {
        const diasVencidos = Math.floor((today.getTime() - new Date(parcela.data_vencimento).getTime()) / (1000 * 60 * 60 * 24));
        const valor = parseFloat(parcela.valor_bruto) || 0;
        
        alerts.push({
          type: 'inadimplencia',
          title: `Parcela vencida há ${diasVencidos} dias`,
          message: `Cliente: ${parcela.cliente_nome || 'N/A'} - Valor: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          entityId: String(parcela.id),
          entityType: 'parcela',
          priority: diasVencidos > 30 ? 'high' : 'medium',
          uniqueKey: `inadimplencia_${parcela.id}`,
        });
      }

      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      const contratosVencendoResult = await db.execute(sql`
        SELECT 
          c.id_subtask,
          c.servico,
          c.valorr,
          c.data_encerramento,
          c.squad,
          cl.nome as cliente_nome
        FROM cup_contratos c
        LEFT JOIN cup_clientes cl ON c.id_task = cl.task_id
        WHERE c.status = 'Ativo'
          AND c.data_encerramento IS NOT NULL
          AND c.data_encerramento <= ${thirtyDaysFromNow.toISOString()}
          AND c.data_encerramento > ${today.toISOString()}
        ORDER BY c.data_encerramento ASC
        LIMIT 100
      `);
      
      for (const contrato of contratosVencendoResult.rows as any[]) {
        const diasRestantes = Math.ceil((new Date(contrato.data_encerramento).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const valor = parseFloat(contrato.valorr) || 0;
        
        alerts.push({
          type: 'contrato_vencendo',
          title: `Contrato vence em ${diasRestantes} dias`,
          message: `Cliente: ${contrato.cliente_nome || 'N/A'} - ${contrato.servico} - R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`,
          entityId: contrato.id_subtask,
          entityType: 'contrato',
          priority: diasRestantes <= 7 ? 'high' : 'medium',
          uniqueKey: `contrato_vencendo_${contrato.id_subtask}`,
        });
      }

      const twoMonthsAgo = new Date(today);
      twoMonthsAgo.setMonth(today.getMonth() - 2);
      
      const churnRiskResult = await db.execute(sql`
        SELECT 
          c.id_task,
          c.id_subtask,
          c.servico,
          c.valorr,
          c.squad,
          cl.nome as cliente_nome,
          cl.cnpj
        FROM cup_contratos c
        LEFT JOIN cup_clientes cl ON c.id_task = cl.task_id
        WHERE c.status = 'Ativo'
          AND NOT EXISTS (
            SELECT 1 FROM caz_parcelas p
            WHERE (p.id_cliente = cl.cnpj OR p.id_cliente = c.id_task)
              AND p.tipo_evento = 'RECEITA'
              AND p.status = 'Pago'
              AND p.data_quitacao >= ${twoMonthsAgo.toISOString()}
          )
        LIMIT 50
      `);
      
      for (const contrato of churnRiskResult.rows as any[]) {
        const valor = parseFloat(contrato.valorr) || 0;
        
        alerts.push({
          type: 'churn_risk',
          title: 'Risco de churn - Sem receita há 2+ meses',
          message: `Cliente: ${contrato.cliente_nome || 'N/A'} - ${contrato.servico} - R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`,
          entityId: contrato.id_subtask,
          entityType: 'contrato',
          priority: 'high',
          uniqueKey: `churn_risk_${contrato.id_subtask}`,
        });
      }

      let inserted = 0;
      let skipped = 0;
      
      for (const alert of alerts) {
        try {
          await db.execute(sql`
            INSERT INTO staging.notifications (type, title, message, entity_id, entity_type, priority, unique_key)
            VALUES (${alert.type}, ${alert.title}, ${alert.message}, ${alert.entityId}, ${alert.entityType}, ${alert.priority}, ${alert.uniqueKey})
            ON CONFLICT (unique_key) DO NOTHING
          `);
          inserted++;
        } catch (e) {
          skipped++;
        }
      }
      
      res.json({
        success: true,
        alertsGenerated: alerts.length,
        inserted,
        skipped,
        breakdown: {
          inadimplencia: alerts.filter(a => a.type === 'inadimplencia').length,
          contratoVencendo: alerts.filter(a => a.type === 'contrato_vencendo').length,
          churnRisk: alerts.filter(a => a.type === 'churn_risk').length,
        },
      });
    } catch (error) {
      console.error("[api] Error generating alerts:", error);
      res.status(500).json({ error: "Failed to generate alerts" });
    }
  });
}

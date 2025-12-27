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

import { BP_2026_TARGETS } from "../okr2026/bp2026Targets";

export async function registerMetasRoutes(app: Express, db: any, storage: IStorage) {
  await initializeSquadMetasTable(db);

  // ============ BP 2026 Seeding Endpoints ============
  
  app.post("/api/okr2026/seed-bp", isAdmin, async (req, res) => {
    try {
      console.log("[api] Starting BP 2026 seeding...");
      let upsertedCount = 0;
      let registryCount = 0;

      // 1. Seed metrics registry first
      for (const metric of BP_2026_TARGETS) {
        await db.execute(sql`
          INSERT INTO kpi.metrics_registry_extended (
            metric_key, title, unit, period_type, direction, 
            is_derived, formula_expr, dimension_key, dimension_value, updated_at
          )
          VALUES (
            ${metric.metric_key}, ${metric.title}, ${metric.unit}, ${metric.period_type}, ${metric.direction},
            ${metric.is_derived}, ${metric.formula || null}, ${metric.dimension_key || null}, ${metric.dimension_value || null}, NOW()
          )
          ON CONFLICT (metric_key) DO UPDATE SET
            title = EXCLUDED.title,
            unit = EXCLUDED.unit,
            period_type = EXCLUDED.period_type,
            direction = EXCLUDED.direction,
            is_derived = EXCLUDED.is_derived,
            formula_expr = EXCLUDED.formula_expr,
            dimension_key = EXCLUDED.dimension_key,
            dimension_value = EXCLUDED.dimension_value,
            updated_at = NOW()
        `);
        registryCount++;

        // 2. Seed monthly targets
        for (const [monthStr, value] of Object.entries(metric.months)) {
          // Parse monthStr like "2026-01"
          const [year, month] = monthStr.split('-').map(Number);
          
          await db.execute(sql`
            INSERT INTO plan.metric_targets_monthly (
              year, month, metric_key, dimension_key, dimension_value, target_value, updated_at
            )
            VALUES (
              ${year}, ${month}, ${metric.metric_key}, 
              ${metric.dimension_key || null}, ${metric.dimension_value || null}, 
              ${value}, NOW()
            )
            ON CONFLICT (year, month, metric_key, dimension_key, dimension_value)
            DO UPDATE SET
              target_value = EXCLUDED.target_value,
              updated_at = NOW()
          `);
          upsertedCount++;
        }
      }

      console.log(`[api] BP 2026 seeding completed: ${registryCount} metrics, ${upsertedCount} monthly targets.`);
      res.json({ 
        success: true, 
        metricsProcessed: registryCount,
        targetsUpserted: upsertedCount 
      });
    } catch (error) {
      console.error("[api] Error seeding BP 2026 targets:", error);
      res.status(500).json({ error: "Failed to seed BP 2026 targets" });
    }
  });

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

  // Get available squads for dropdown
  app.get("/api/squads/list", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT squad FROM cup_contratos 
        WHERE squad IS NOT NULL AND squad != ''
        ORDER BY squad
      `);
      
      res.json((result.rows as any[]).map(r => r.squad));
    } catch (error) {
      console.error("[api] Error fetching squads list:", error);
      res.status(500).json({ error: "Failed to fetch squads list" });
    }
  });
}

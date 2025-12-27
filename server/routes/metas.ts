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

  // ============ KPI Engine Endpoints ============

  // Initialize KPI tables
  async function initializeKPITables() {
    try {
      // Create kpi schema if not exists
      await db.execute(sql`CREATE SCHEMA IF NOT EXISTS kpi`);
      await db.execute(sql`CREATE SCHEMA IF NOT EXISTS plan`);
      await db.execute(sql`CREATE SCHEMA IF NOT EXISTS admin`);
      
      // Metric overrides table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS kpi.metric_overrides_monthly (
          id SERIAL PRIMARY KEY,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          metric_key VARCHAR(100) NOT NULL,
          dimension_key VARCHAR(100) DEFAULT '',
          dimension_value VARCHAR(255) DEFAULT '',
          override_value NUMERIC(18,6) NOT NULL,
          note TEXT,
          updated_by VARCHAR(255),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE (year, month, metric_key, dimension_key, dimension_value)
        )
      `);
      
      // Contract status mapping table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS admin.contract_status_map (
          id SERIAL PRIMARY KEY,
          status VARCHAR(100) UNIQUE NOT NULL,
          is_active BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Seed default contract statuses
      const defaultStatuses = [
        { status: 'Ativo', isActive: true },
        { status: 'ativo', isActive: true },
        { status: 'Em andamento', isActive: true },
        { status: 'Onboarding', isActive: true },
        { status: 'onboarding', isActive: true },
        { status: 'Triagem', isActive: true },
        { status: 'Em Cancelamento', isActive: false },
        { status: 'Cancelado', isActive: false },
        { status: 'Pausado', isActive: false },
        { status: 'Pausado Temporariamente', isActive: false },
      ];
      
      for (const s of defaultStatuses) {
        await db.execute(sql`
          INSERT INTO admin.contract_status_map (status, is_active)
          VALUES (${s.status}, ${s.isActive})
          ON CONFLICT (status) DO NOTHING
        `);
      }
      
      console.log('[metas] KPI tables initialized');
    } catch (error) {
      console.error('[metas] Error initializing KPI tables:', error);
    }
  }
  
  // Initialize tables on route registration
  initializeKPITables();

  // POST /api/kpi/recompute - Compute actuals for all metrics
  app.post("/api/kpi/recompute", isAdmin, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || 2026;
      console.log(`[kpi] Starting recompute for year ${year}...`);
      
      let computed = 0;
      let overridesUsed = 0;
      let derivedComputed = 0;
      let errors: string[] = [];
      
      // Get all metrics from registry
      const registryResult = await db.execute(sql`
        SELECT * FROM kpi.metrics_registry_extended ORDER BY is_derived ASC, sort_order ASC
      `);
      const metrics = registryResult.rows as any[];
      
      // Get all overrides for the year (including dimension keys)
      const overridesResult = await db.execute(sql`
        SELECT * FROM kpi.metric_overrides_monthly WHERE year = ${year}
      `);
      const overrides = overridesResult.rows as any[];
      const overrideMap = new Map<string, number>();
      for (const o of overrides) {
        // Include dimension_key and dimension_value in the key for proper scoping
        const dimKey = o.dimension_key || '';
        const dimValue = o.dimension_value || '';
        const key = `${o.metric_key}:${o.month}:${dimKey}:${dimValue}`;
        overrideMap.set(key, parseFloat(o.override_value));
      }
      
      // Process non-derived metrics first
      for (const metric of metrics.filter(m => !m.is_derived)) {
        const dimKey = metric.dimension_key || '';
        const dimValue = metric.dimension_value || '';
        
        for (let month = 1; month <= 12; month++) {
          const overrideKey = `${metric.metric_key}:${month}:${dimKey}:${dimValue}`;
          let actualValue: number | null = null;
          let source = 'none';
          
          // Check for override first (scoped by dimension)
          if (overrideMap.has(overrideKey)) {
            actualValue = overrideMap.get(overrideKey)!;
            source = 'manual';
            overridesUsed++;
          } else {
            // Try to compute from target with dimension scoping
            // Use null comparison for dimension keys to match the constraint
            const dbDimKeyForTarget = dimKey || null;
            const dbDimValueForTarget = dimValue || null;
            
            const targetResult = await db.execute(sql`
              SELECT target_value FROM plan.metric_targets_monthly 
              WHERE year = ${year} AND month = ${month} AND metric_key = ${metric.metric_key}
              AND (dimension_key IS NOT DISTINCT FROM ${dbDimKeyForTarget})
              AND (dimension_value IS NOT DISTINCT FROM ${dbDimValueForTarget})
              LIMIT 1
            `);
            if (targetResult.rows.length > 0) {
              actualValue = parseFloat((targetResult.rows[0] as any).target_value) || null;
              source = 'target_fallback';
            }
          }
          
          if (actualValue !== null) {
            // Include dimension_key and dimension_value in INSERT for proper scoping
            const dbDimKey = dimKey || null;
            const dbDimValue = dimValue || null;
            
            await db.execute(sql`
              INSERT INTO kpi.metric_actuals_monthly (year, month, metric_key, dimension_key, dimension_value, actual_value, source, calculated_at)
              VALUES (${year}, ${month}, ${metric.metric_key}, ${dbDimKey}, ${dbDimValue}, ${actualValue}, ${source}, NOW())
              ON CONFLICT (year, month, metric_key, COALESCE(dimension_key, ''), COALESCE(dimension_value, ''))
              DO UPDATE SET actual_value = EXCLUDED.actual_value, source = EXCLUDED.source, calculated_at = NOW()
            `);
            computed++;
          }
        }
      }
      
      // Process derived metrics
      for (const metric of metrics.filter(m => m.is_derived)) {
        const formula = metric.formula_expr;
        if (!formula) continue;
        
        // Extract metric keys referenced in the formula
        const referencedKeys = extractMetricKeysFromFormula(formula, metrics);
        const derivedDimKey = metric.dimension_key || null;
        const derivedDimValue = metric.dimension_value || null;
        
        for (let month = 1; month <= 12; month++) {
          try {
            // Get actuals ONLY for metrics referenced in the formula
            // Match the derived metric's dimension scope for dependency actuals
            const actualsMap = new Map<string, number>();
            
            if (referencedKeys.length > 0) {
              // Get actuals that match the derived metric's dimension scope using IS NOT DISTINCT FROM
              const actualsResult = await db.execute(sql`
                SELECT metric_key, actual_value, dimension_key, dimension_value 
                FROM kpi.metric_actuals_monthly 
                WHERE year = ${year} AND month = ${month}
                AND metric_key = ANY(${referencedKeys})
                AND (dimension_key IS NOT DISTINCT FROM ${derivedDimKey})
                AND (dimension_value IS NOT DISTINCT FROM ${derivedDimValue})
              `);
              
              for (const a of actualsResult.rows as any[]) {
                if (a.actual_value !== null) {
                  // Key by metric_key only since we already filter by dimension
                  if (!actualsMap.has(a.metric_key)) {
                    actualsMap.set(a.metric_key, parseFloat(a.actual_value));
                  }
                }
              }
            }
            
            // Simple formula parser/executor
            let computedValue = evaluateFormula(formula, actualsMap);
            
            if (computedValue !== null && !isNaN(computedValue)) {
              // Include dimension_key and dimension_value in INSERT for derived metrics
              await db.execute(sql`
                INSERT INTO kpi.metric_actuals_monthly (year, month, metric_key, dimension_key, dimension_value, actual_value, source, calculated_at)
                VALUES (${year}, ${month}, ${metric.metric_key}, ${derivedDimKey}, ${derivedDimValue}, ${computedValue}, 'derived', NOW())
                ON CONFLICT (year, month, metric_key, COALESCE(dimension_key, ''), COALESCE(dimension_value, ''))
                DO UPDATE SET actual_value = EXCLUDED.actual_value, source = EXCLUDED.source, calculated_at = NOW()
              `);
              derivedComputed++;
            }
          } catch (e: any) {
            errors.push(`${metric.metric_key}:${month}: ${e.message}`);
          }
        }
      }
      
      console.log(`[kpi] Recompute completed: ${computed} base, ${derivedComputed} derived, ${overridesUsed} overrides`);
      res.json({
        success: true,
        year,
        baseMetricsComputed: computed,
        derivedMetricsComputed: derivedComputed,
        overridesApplied: overridesUsed,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined
      });
    } catch (error: any) {
      console.error("[kpi] Recompute error:", error);
      res.status(500).json({ error: "Recompute failed", details: error.message });
    }
  });

  // Extract metric keys referenced in a formula expression
  function extractMetricKeysFromFormula(formula: string, allMetrics: any[]): string[] {
    const metricKeys = allMetrics.map(m => m.metric_key);
    const referencedKeys: string[] = [];
    
    for (const key of metricKeys) {
      // Check if the metric key appears in the formula as a word boundary
      const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (regex.test(formula)) {
        referencedKeys.push(key);
      }
    }
    
    return referencedKeys;
  }

  // Simple formula evaluator for derived metrics
  function evaluateFormula(formula: string, values: Map<string, number>): number | null {
    try {
      // Replace metric keys with values
      let expr = formula;
      for (const [key, value] of values) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expr = expr.replace(regex, value.toString());
      }
      
      // Only allow numbers, operators, and parentheses for safety
      if (!/^[\d\s+\-*/().]+$/.test(expr)) {
        return null;
      }
      
      // Evaluate
      return Function('"use strict"; return (' + expr + ')')();
    } catch {
      return null;
    }
  }

  // ============ Overrides CRUD ============
  
  app.get("/api/kpi/overrides", isAdmin, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || 2026;
      const result = await db.execute(sql`
        SELECT * FROM kpi.metric_overrides_monthly 
        WHERE year = ${year}
        ORDER BY month, metric_key
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching overrides:", error);
      res.status(500).json({ error: "Failed to fetch overrides" });
    }
  });

  app.post("/api/kpi/overrides", isAdmin, async (req, res) => {
    try {
      const { year, month, metricKey, overrideValue, note, dimensionKey, dimensionValue } = req.body;
      const updatedBy = (req as any).user?.email || 'admin';
      
      // Use null for dimension values if not provided for proper unique constraint matching
      const dbDimKey = dimensionKey || null;
      const dbDimValue = dimensionValue || null;
      
      const result = await db.execute(sql`
        INSERT INTO kpi.metric_overrides_monthly (year, month, metric_key, dimension_key, dimension_value, override_value, note, updated_by, updated_at)
        VALUES (${year}, ${month}, ${metricKey}, ${dbDimKey}, ${dbDimValue}, ${overrideValue}, ${note || null}, ${updatedBy}, NOW())
        ON CONFLICT (year, month, metric_key, COALESCE(dimension_key, ''), COALESCE(dimension_value, ''))
        DO UPDATE SET override_value = EXCLUDED.override_value, note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        RETURNING *
      `);
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating override:", error);
      res.status(500).json({ error: "Failed to create override" });
    }
  });

  app.delete("/api/kpi/overrides/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute(sql`DELETE FROM kpi.metric_overrides_monthly WHERE id = ${parseInt(id)}`);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting override:", error);
      res.status(500).json({ error: "Failed to delete override" });
    }
  });

  // ============ Contract Status Mapping CRUD ============
  
  app.get("/api/admin/contract-status-map", isAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM admin.contract_status_map ORDER BY status
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching contract status map:", error);
      res.status(500).json({ error: "Failed to fetch contract status map" });
    }
  });

  app.post("/api/admin/contract-status-map", isAdmin, async (req, res) => {
    try {
      const { status, isActive } = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO admin.contract_status_map (status, is_active, updated_at)
        VALUES (${status}, ${isActive || false}, NOW())
        ON CONFLICT (status) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = NOW()
        RETURNING *
      `);
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating contract status:", error);
      res.status(500).json({ error: "Failed to create contract status" });
    }
  });

  app.put("/api/admin/contract-status-map/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      const result = await db.execute(sql`
        UPDATE admin.contract_status_map 
        SET is_active = ${isActive}, updated_at = NOW()
        WHERE id = ${parseInt(id)}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Status not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating contract status:", error);
      res.status(500).json({ error: "Failed to update contract status" });
    }
  });

  app.delete("/api/admin/contract-status-map/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute(sql`DELETE FROM admin.contract_status_map WHERE id = ${parseInt(id)}`);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting contract status:", error);
      res.status(500).json({ error: "Failed to delete contract status" });
    }
  });
}

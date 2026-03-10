import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../auth/middleware";

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

export function registerOKR2026Routes(app: Express) {
  // OKR 2026 Routes
  app.get("/api/okr2026/dashboard", isAuthenticated, async (req, res) => {
    try {
      const { getDashboardMetrics, getTargets } = await import("../okr2026/metricsAdapter");
      const metrics = await getDashboardMetrics();
      const targets = getTargets();
      res.json({ metrics, targets });
    } catch (error) {
      console.error("[api] Error fetching OKR dashboard:", error);
      res.status(500).json({ error: "Failed to fetch OKR dashboard" });
    }
  });

  app.get("/api/okr2026/krs", isAuthenticated, async (req, res) => {
    try {
      const { getKRs } = await import("../okr2026/metricsAdapter");
      const krs = getKRs();
      res.json({ krs });
    } catch (error) {
      console.error("[api] Error fetching OKR KRs:", error);
      res.status(500).json({ error: "Failed to fetch OKR KRs" });
    }
  });

  app.get("/api/okr2026/initiatives", isAuthenticated, async (req, res) => {
    try {
      const { getInitiatives } = await import("../okr2026/metricsAdapter");
      const data = getInitiatives();
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching OKR initiatives:", error);
      res.status(500).json({ error: "Failed to fetch OKR initiatives" });
    }
  });

  app.get("/api/okr2026/targets", isAuthenticated, async (req, res) => {
    try {
      const { getTargets } = await import("../okr2026/metricsAdapter");
      res.json(getTargets());
    } catch (error) {
      console.error("[api] Error fetching OKR targets:", error);
      res.status(500).json({ error: "Failed to fetch OKR targets" });
    }
  });

  app.get("/api/okr2026/manual-metrics", isAuthenticated, async (req, res) => {
    try {
      const { getManualMetrics } = await import("../okr2026/metricsAdapter");
      res.json(getManualMetrics());
    } catch (error) {
      console.error("[api] Error fetching OKR manual metrics:", error);
      res.status(500).json({ error: "Failed to fetch OKR manual metrics" });
    }
  });

  app.get("/api/okr2026/coverage", isAuthenticated, async (req, res) => {
    try {
      const { getCoverage } = await import("../okr2026/metricsAdapter");
      const coverage = getCoverage();
      res.json(coverage);
    } catch (error) {
      console.error("[api] Error fetching OKR coverage:", error);
      res.status(500).json({ error: "Failed to fetch OKR coverage" });
    }
  });

  app.get("/api/okr2026/config", isAuthenticated, async (req, res) => {
    try {
      const { getOKRConfig, getObjectives } = await import("../okr2026/metricsAdapter");
      res.json({
        config: getOKRConfig(),
        objectives: getObjectives()
      });
    } catch (error) {
      console.error("[api] Error fetching OKR config:", error);
      res.status(500).json({ error: "Failed to fetch OKR config" });
    }
  });

  app.get("/api/okr2026/hero-drilldown", isAuthenticated, async (req, res) => {
    try {
      const metric = req.query.metric as string;
      if (!metric) {
        return res.status(400).json({ error: "Missing 'metric' query parameter" });
      }

      // Optional month param (e.g. "2026-01") to filter by specific month
      const monthParam = req.query.month as string | undefined;
      let startDate: string | undefined;
      let endDate: string | undefined;
      if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
        const [year, month] = monthParam.split('-').map(Number);
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        endDate = new Date(year, month, 0).toISOString().split('T')[0];
      }

      const {
        getMrrAtivoDetail,
        getChurnDetail,
        getVendasMrrDetail,
        getAquisicaoPontualDetail,
        getValorEntreguePontualDetail,
        getCsvDetail,
        getCacDetail,
        getSgaDetail,
        getCapexDetail,
        getTaxesOnRevenueDetail,
        getTaxIrCsllDetail,
        getRevenueOtherDetail,
      } = await import("../okr2026/metricsAdapter");

      const handlers: Record<string, () => Promise<any>> = {
        mrr_ativo: () => getMrrAtivoDetail(),
        vendas_mrr: () => getVendasMrrDetail(),
        churn: () => getChurnDetail(),
        vendas_pontuais: () => getAquisicaoPontualDetail(),
        entregas_pontuais: () => getValorEntreguePontualDetail(),
        cogs_csv: () => getCsvDetail(startDate, endDate),
        cac_total: () => getCacDetail(startDate, endDate),
        sga_total: () => getSgaDetail(startDate, endDate),
        capex: () => getCapexDetail(startDate, endDate),
        taxes_on_revenue: () => getTaxesOnRevenueDetail(startDate, endDate),
        tax_ir_csll: () => getTaxIrCsllDetail(startDate, endDate),
        revenue_other: () => getRevenueOtherDetail(startDate, endDate),
      };

      const handler = handlers[metric];
      if (!handler) {
        return res.status(400).json({ error: `Unknown metric: ${metric}` });
      }

      const result = await handler();
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching hero drilldown:", error);
      res.status(500).json({ error: "Failed to fetch hero drilldown" });
    }
  });

  app.get("/api/okr2026/summary", isAuthenticated, async (req, res) => {
    try {
      const { getCached, setCache } = await import("../okr2026/cache");
      const {
        getDashboardMetrics,
        getObjectives,
        getKRs,
        getTargets,
        calculateProgress,
        getStatus,
        getMrrSerie
      } = await import("../okr2026/metricsAdapter");
      const { objectiveRegistry, krRegistry } = await import("../okr2026/okrRegistry");

      const period = (req.query.period as string) || "YTD";
      const bu = (req.query.bu as string) || "all";

      const validPeriods = ["YTD", "Q1", "Q2", "Q3", "Q4", "Last12m"];
      const validBUs = ["all", "turbooh", "tech", "commerce"];

      const normalizedPeriod = validPeriods.includes(period) ? period : "YTD";
      const normalizedBU = validBUs.includes(bu) ? bu : "all";

      const cacheKey = `okr_summary_${normalizedPeriod}_${normalizedBU}`;

      const cached = getCached<any>(cacheKey);
      if (cached) {
        return res.json({
          ...cached,
          meta: { ...cached.meta, cacheHit: true }
        });
      }

      const initiativesData = await import("../okr2026/initiatives.json");
      const initiatives = initiativesData.initiatives || [];

      const metrics = await getDashboardMetrics();
      const targets = getTargets();
      const objectives = objectiveRegistry;
      const krsRaw = krRegistry;

      const quarter = getCurrentQuarter();

      const krs = krsRaw.map(kr => {
        let atual: number | null = null;
        let target: number | null = null;

        const metricMap: Record<string, number | null> = {
          mrr_active: metrics.mrr_ativo,
          revenue_net: metrics.receita_liquida_ytd,
          clients_active: metrics.clientes_ativos,
          revenue_per_head: metrics.receita_por_head,
          ebitda: metrics.ebitda_ytd,
          cash_generation: metrics.geracao_caixa_ytd,
          cash_balance: metrics.caixa_atual,
          inadimplencia_pct: metrics.inadimplencia_percentual,
          gross_churn_pct: metrics.gross_mrr_churn_percentual,
          net_churn_pct: metrics.net_churn_mrr_percentual,
          logo_churn_pct: metrics.logo_churn_percentual,
          turbooh_receita: metrics.turbooh_receita,
          turbooh_resultado: metrics.turbooh_resultado,
          turbooh_margem_pct: metrics.turbooh_margem_pct,
          tech_projetos_entregues: metrics.tech_projetos_entregues,
          tech_freelancers_pct: metrics.tech_freelancers_percentual,
          mrr_por_head: metrics.mrr_por_head,
          geracao_caixa_margem: metrics.geracao_caixa_margem,
          // O1 - Bigger KRs
          faturamento_legado: metrics.receita_total_ytd,
          vendas_mrr: metrics.vendas_mrr,
          vendas_mrr_novo: metrics.vendas_mrr_novo,
          crosssell_mrr: metrics.crosssell_mrr,
          nrr_pct: metrics.nrr_pct,
          vendas_pontual: metrics.vendas_pontual,
          faturamento_ventures: metrics.turbooh_receita,
          projetos_tech: metrics.tech_projetos_valor,
          // O2 - Better KRs
          churn_brl: metrics.churn_brl,
          inadimplencia_brl: metrics.inadimplencia_brl,
          nps: null, // Ainda não instrumentado
          faturamento_por_pessoa: metrics.receita_por_head,
          entregas_no_prazo_pct: null // Ainda não instrumentado
        };

        atual = metricMap[kr.metricKey] ?? null;

        target = kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;

        const progress = atual !== null && target !== null
          ? calculateProgress(atual, target, kr.direction)
          : null;
        const status = progress !== null ? getStatus(progress, kr.direction) : "gray";

        return {
          ...kr,
          currentValue: atual,
          target,
          progress,
          status
        };
      });

      const getMrrTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "mrr_active");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };

      const getRevenueTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "revenue_net");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };

      const getEbitdaTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "ebitda");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };

      const getInadimplenciaTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "delinquency_pct");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };

      const getNetChurnTarget = () => {
        const kr = krRegistry.find(k => k.metricKey === "net_mrr_churn_pct");
        if (!kr) return null;
        return kr.targets[quarter as keyof typeof kr.targets] || kr.targets.FY || null;
      };

      const mrrTarget = getMrrTarget();
      const revenueTarget = getRevenueTarget();
      const ebitdaTarget = getEbitdaTarget();
      const inadTarget = getInadimplenciaTarget();
      const netChurnTarget = getNetChurnTarget();

      const highlights = {
        mrr: {
          value: metrics.mrr_ativo,
          target: mrrTarget,
          progress: mrrTarget ? calculateProgress(metrics.mrr_ativo, mrrTarget, "higher") : null
        },
        revenue: {
          value: metrics.receita_liquida_ytd,
          target: revenueTarget,
          progress: revenueTarget ? calculateProgress(metrics.receita_liquida_ytd, revenueTarget, "higher") : null
        },
        ebitda: {
          value: metrics.ebitda_ytd,
          target: ebitdaTarget,
          progress: ebitdaTarget ? calculateProgress(metrics.ebitda_ytd, ebitdaTarget, "higher") : null
        },
        inadimplencia: {
          value: metrics.inadimplencia_percentual,
          target: inadTarget,
          status: inadTarget && metrics.inadimplencia_percentual <= inadTarget ? "green" : "red"
        },
        net_churn: {
          value: metrics.net_churn_mrr_percentual,
          target: netChurnTarget,
          status: netChurnTarget && metrics.net_churn_mrr_percentual !== null && metrics.net_churn_mrr_percentual <= netChurnTarget ? "green" : "red"
        }
      };

      const { getQuarterSummary, getMetricSeries } = await import("../okr2026/metricsAdapter");

      const year = new Date().getFullYear();
      const [churnSeriesRaw, geracaoCaixaSeries] = await Promise.all([
        getMetricSeries("churn", `${year}-01-01`, `${year}-12-31`),
        getMetricSeries("geracao_caixa_margem", `${year}-01-01`, `${year}-12-31`),
      ]);
      // Map { date: "2026-01", value } → { month: "2026-01", value } for frontend compatibility
      const churnSeries = churnSeriesRaw.map(p => ({ month: p.date, value: p.value }));
      const series = {
        mrr: metrics.mrr_serie || [],
        ebitda: [],
        churn: churnSeries,
        inadimplencia: metrics.inadimplencia_serie || [],
        geracao_caixa_margem: geracaoCaixaSeries,
      };

      const quarterSummary = await getQuarterSummary(new Date().getFullYear());

      console.log(`[OKR-API] geracao_caixa_margem returned: ${metrics.geracao_caixa_margem}`);

      const summaryData = {
        objectives,
        krs,
        metrics,
        initiatives,
        highlights,
        series,
        quarterSummary,
        meta: {
          generatedAt: new Date().toISOString(),
          period: normalizedPeriod,
          bu: normalizedBU,
          cacheHit: false
        }
      };

      setCache(cacheKey, summaryData);

      res.json(summaryData);
    } catch (error) {
      console.error("[api] Error fetching OKR summary:", error);
      res.status(500).json({ error: "Failed to fetch OKR summary" });
    }
  });

  app.post("/api/okr2026/cache/invalidate", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { clearAllCache, invalidateCacheByPattern, getCacheStats } = await import("../okr2026/cache");
      const { pattern } = req.body;

      if (pattern) {
        const count = invalidateCacheByPattern(pattern);
        res.json({ success: true, invalidated: count });
      } else {
        clearAllCache();
        res.json({ success: true, message: "All cache cleared" });
      }
    } catch (error) {
      console.error("[api] Error invalidating cache:", error);
      res.status(500).json({ error: "Failed to invalidate cache" });
    }
  });

  app.get("/api/okr2026/cache/stats", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getCacheStats } = await import("../okr2026/cache");
      res.json(getCacheStats());
    } catch (error) {
      console.error("[api] Error fetching cache stats:", error);
      res.status(500).json({ error: "Failed to fetch cache stats" });
    }
  });

  app.get("/api/okr2026/quarter-summary", isAuthenticated, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || 2026;
      const { getQuarterSummary } = await import("../okr2026/metricsAdapter");
      const metrics = await getQuarterSummary(year);
      res.json({
        year,
        metrics
      });
    } catch (error) {
      console.error("[api] Error fetching quarter summary:", error);
      res.status(500).json({ error: "Failed to fetch quarter summary" });
    }
  });

  app.get("/api/okr2026/collaborators", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, email_turbo as email, setor
        FROM "Inhire".rh_pessoal
        WHERE LOWER(status) = 'ativo'
        ORDER BY nome
      `);
      res.json({
        collaborators: result.rows.map((row: any) => ({
          id: row.id,
          nome: row.nome,
          email: row.email,
          setor: row.setor
        }))
      });
    } catch (error) {
      console.error("[api] Error fetching collaborators:", error);
      res.status(500).json({ error: "Failed to fetch collaborators" });
    }
  });

  app.get("/api/okr2026/metric-series", isAuthenticated, async (req, res) => {
    try {
      const metricKey = req.query.metricKey as string;
      const start = req.query.start as string;
      const end = req.query.end as string;

      if (!metricKey) {
        return res.status(400).json({ error: "metricKey is required" });
      }
      if (!start || !end) {
        return res.status(400).json({ error: "start and end date params are required (YYYY-MM format)" });
      }

      const startDate = `${start}-01`;
      const endDate = `${end}-28`;

      const { getMetricSeries } = await import("../okr2026/metricsAdapter");
      const series = await getMetricSeries(metricKey, startDate, endDate);

      res.json({
        metricKey,
        series
      });
    } catch (error) {
      console.error("[api] Error fetching metric series:", error);
      res.status(500).json({ error: "Failed to fetch metric series" });
    }
  });

  app.post("/api/okr2026/seed-bp", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { initializeBPTables } = await import("../db");
      await initializeBPTables();

      const { BP_2026_TARGETS } = await import("../okr2026/bp2026Targets");

      // Delete existing data first for clean seed
      await db.execute(sql`DELETE FROM cortex_core.metric_targets_monthly WHERE year = 2026`);
      await db.execute(sql`DELETE FROM cortex_core.metrics_registry_extended WHERE metric_key LIKE '%'`);

      // Batch insert all metrics registry
      for (let i = 0; i < BP_2026_TARGETS.length; i++) {
        const metric = BP_2026_TARGETS[i];
        await db.execute(sql`
          INSERT INTO cortex_core.metrics_registry_extended
            (metric_key, title, unit, period_type, direction, is_derived, formula_expr, dimension_key, dimension_value, sort_order)
          VALUES
            (${metric.metric_key}, ${metric.title}, ${metric.unit}, ${metric.period_type}, ${metric.direction},
             ${metric.is_derived}, ${metric.formula || null}, ${metric.dimension_key || null}, ${metric.dimension_value || null}, ${i * 10})
        `);
      }

      // Build values for batch insert of targets
      const targetRows: Array<{year: number; month: number; metricKey: string; dimKey: string | null; dimVal: string | null; value: number}> = [];
      for (const metric of BP_2026_TARGETS) {
        for (const monthKey of Object.keys(metric.months)) {
          const [yearStr, monthStr] = monthKey.split("-");
          targetRows.push({
            year: parseInt(yearStr),
            month: parseInt(monthStr),
            metricKey: metric.metric_key,
            dimKey: metric.dimension_key || null,
            dimVal: metric.dimension_value || null,
            value: metric.months[monthKey]
          });
        }
      }

      // Insert targets in batches of 50
      const batchSize = 50;
      for (let i = 0; i < targetRows.length; i += batchSize) {
        const batch = targetRows.slice(i, i + batchSize);
        const values = batch.map(r =>
          sql`(${r.year}, ${r.month}, ${r.metricKey}, ${r.dimKey}, ${r.dimVal}, ${r.value})`
        );
        await db.execute(sql`
          INSERT INTO cortex_core.metric_targets_monthly
            (year, month, metric_key, dimension_key, dimension_value, target_value)
          VALUES ${sql.join(values, sql`, `)}
        `);
      }

      res.json({
        success: true,
        message: `BP 2026 seeded successfully`,
        metricsRegistered: BP_2026_TARGETS.length,
        targetsUpserted: targetRows.length
      });
    } catch (error) {
      console.error("[api] Error seeding BP:", error);
      res.status(500).json({ error: "Failed to seed BP data" });
    }
  });

  app.get("/api/okr2026/bp-financeiro", isAuthenticated, async (req, res) => {
    try {
      const { BP_2026_TARGETS, BP_MONTHS, BP_METRIC_ORDER, getMetricByKey } = await import("../okr2026/bp2026Targets");
      const { computePeriodValue, computeSignalStatus, computeVariance } = await import("../okr2026/rollupEngine");

      const targetsByMetric: Record<string, Record<string, number>> = {};
      const actualsByMetric: Record<string, Record<string, number>> = {};

      try {
        const targetsResult = await db.execute(sql`
          SELECT year, month, metric_key, dimension_key, dimension_value, target_value
          FROM cortex_core.metric_targets_monthly
          WHERE year = 2026
          ORDER BY metric_key, month
        `);

        for (const row of targetsResult.rows as any[]) {
          const key = row.metric_key;
          const monthKey = `2026-${String(row.month).padStart(2, "0")}`;
          if (!targetsByMetric[key]) targetsByMetric[key] = {};
          targetsByMetric[key][monthKey] = parseFloat(row.target_value);
        }
      } catch (dbError) {
        console.log("[api] BP financeiro: Using hardcoded targets (DB unavailable)");
      }

      try {
        const actualsResult = await db.execute(sql`
          SELECT year, month, metric_key, dimension_key, dimension_value, actual_value
          FROM cortex_core.metric_actuals_monthly
          WHERE year = 2026
          ORDER BY metric_key, month
        `);

        for (const row of actualsResult.rows as any[]) {
          const key = row.metric_key;
          const monthKey = `2026-${String(row.month).padStart(2, "0")}`;
          if (!actualsByMetric[key]) actualsByMetric[key] = {};
          actualsByMetric[key][monthKey] = parseFloat(row.actual_value);
        }
      } catch (dbError) {
        console.log("[api] BP financeiro: No actuals available (DB unavailable)");
      }

      // Load historical snapshots for past months
      const snapshotedMonths = new Set<string>();
      try {
        const snapshotsResult = await db.execute(sql`
          SELECT mes_ano, metricas
          FROM cortex_core.bp_snapshots
          ORDER BY mes_ano
        `);

        const metricKeyMap: Record<string, string> = {
          mrr_active: "mrr_active",
          sales_mrr: "sales_mrr",
          revenue_one_time: "revenue_one_time",
          revenue_other: "revenue_other",
          revenue_billable_total: "revenue_billable_total",
          bad_debt: "bad_debt",
          taxes_on_revenue: "taxes_on_revenue",
          net_revenue: "revenue_net",
          csv: "cogs_csv",
          gross_margin: "gross_margin",
          cac: "cac_total",
          sga: "sga_total",
          ebitda: "ebitda",
          capex: "capex",
          tax_ir_csll: "tax_ir_csll",
          cash_generation: "cash_generation",
          cash_generation_margin_pct: "cash_generation_margin_pct",
          cash_balance: "cash_balance",
          headcount_total: "headcount_total",
          clients_active: "clients_active",
          contracts_active: "contracts_active",
          churn_mrr_month: "churn_mrr_month",
        };

        for (const row of snapshotsResult.rows as any[]) {
          const mesAno = row.mes_ano;
          snapshotedMonths.add(mesAno);
          const metricas = typeof row.metricas === 'string' ? JSON.parse(row.metricas) : row.metricas;

          for (const [snapshotKey, bpKey] of Object.entries(metricKeyMap)) {
            if (metricas[snapshotKey] !== undefined) {
              if (!actualsByMetric[bpKey]) actualsByMetric[bpKey] = {};
              actualsByMetric[bpKey][mesAno] = metricas[snapshotKey];
            }
          }
        }
        console.log(`[bp-financeiro] Loaded ${snapshotsResult.rows.length} historical snapshots: ${Array.from(snapshotedMonths).join(", ")}`);
      } catch (snapshotError) {
        console.log("[api] BP financeiro: Could not load historical snapshots", snapshotError);
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthNum = now.getMonth() + 1;
      const currentMonthKey = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`;

      // Auto-create or refresh snapshots for past months missing data
      if (currentYear === 2026 && currentMonthNum > 1) {
        // Fetch current bank balance and future cash flow to calculate historical balances
        let currentBankBalance = 0;
        try {
          const bankResult = await db.execute(sql`SELECT COALESCE(SUM(balance::numeric), 0) as total FROM "Conta Azul".caz_bancos`);
          currentBankBalance = parseFloat((bankResult.rows[0] as any)?.total || "0");
        } catch (e) { /* ignore */ }
        // Cash flow from each month's start to today (to subtract retroactively)
        const cashFlowAfter: Record<string, number> = {};
        try {
          const cfResult = await db.execute(sql`
            SELECT TO_CHAR(data_quitacao, 'YYYY-MM') as mes,
              COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN (COALESCE(valor_pago::numeric,0) - COALESCE(desconto::numeric,0)) ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN (COALESCE(valor_pago::numeric,0) - COALESCE(desconto::numeric,0)) ELSE 0 END), 0) as fluxo
            FROM "Conta Azul".caz_parcelas
            WHERE data_quitacao::date >= '2026-01-01' AND status IN ('QUITADO','RECEBIDO_PARCIAL')
            GROUP BY TO_CHAR(data_quitacao, 'YYYY-MM')
          `);
          for (const row of cfResult.rows as any[]) {
            cashFlowAfter[row.mes] = parseFloat(row.fluxo || "0");
          }
        } catch (e) { /* ignore */ }

        for (let m = 1; m < currentMonthNum; m++) {
          const monthKey = `2026-${String(m).padStart(2, "0")}`;
          // Always refresh past-month snapshots to ensure accuracy after query changes
          try {
            console.log(`[bp-financeiro] Refreshing snapshot for ${monthKey}`);
            const mStart = new Date(2026, m - 1, 1).toISOString().split("T")[0];
            const mEnd = new Date(2026, m, 0).toISOString().split("T")[0];

            const [snapMrr, snapVendas, snapPontual, snapOutras, snapInad, snapImpostos, snapCaixa, snapCsv, snapSga, snapCac, snapCapex, snapIrCsll, snapChurn, snapHeadcount, snapClientes, snapContratos] = await Promise.all([
              db.execute(sql.raw(`SELECT COALESCE(SUM(valorr::numeric), 0) as mrr FROM "Clickup".cup_data_hist WHERE data_snapshot::date = '${mEnd}'::date AND status IN ('ativo', 'onboarding', 'triagem')`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(valor_recorrente::numeric), 0) as vendas_mrr FROM "Bitrix".crm_deal WHERE stage_name = 'Negócio Ganho' AND data_fechamento >= '${mStart}' AND data_fechamento <= '${mEnd}' AND valor_recorrente IS NOT NULL AND valor_recorrente > 0`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(valor_pontual::numeric), 0) as receita_pontual FROM "Bitrix".crm_deal WHERE stage_name = 'Negócio Ganho' AND data_fechamento >= '${mStart}' AND data_fechamento <= '${mEnd}' AND valor_pontual IS NOT NULL AND valor_pontual > 0`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(valor_liquido::numeric), 0) as total FROM "Conta Azul".caz_parcelas WHERE tipo_evento = 'RECEITA' AND (categoria_nome LIKE '03.02%' OR categoria_nome LIKE '03.03%' OR categoria_nome LIKE '04.01%' OR categoria_nome LIKE '04.03%') AND data_quitacao::date >= '${mStart}'::date AND data_quitacao::date <= '${mEnd}'::date`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(nao_pago::numeric), 0) as inadimplencia FROM "Conta Azul".caz_parcelas WHERE tipo_evento = 'RECEITA' AND data_vencimento >= '${mStart}' AND data_vencimento <= '${mEnd}' AND nao_pago::numeric > 0`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(valor_liquido::numeric), 0) as total FROM "Conta Azul".caz_parcelas WHERE tipo_evento = 'DESPESA' AND categoria_nome LIKE '05.05%' AND data_quitacao::date >= '${mStart}'::date AND data_quitacao::date <= '${mEnd}'::date`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN (COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)) ELSE 0 END), 0) as entradas, COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN (COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)) ELSE 0 END), 0) as saidas FROM "Conta Azul".caz_parcelas WHERE data_quitacao::date >= '${mStart}'::date AND data_quitacao::date <= '${mEnd}'::date AND status IN ('QUITADO', 'RECEBIDO_PARCIAL')`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as csv FROM "Conta Azul".caz_parcelas WHERE status = 'QUITADO' AND (categoria_nome LIKE '05.01%' OR categoria_nome LIKE '05.02%' OR categoria_nome LIKE '05.03%' OR categoria_nome LIKE '05.04.01%' OR categoria_nome LIKE '06.01%' OR categoria_nome LIKE '06.05%' OR categoria_nome LIKE '06.07%' OR categoria_nome LIKE '06.10.01%' OR categoria_nome LIKE '06.10.03%' OR categoria_nome LIKE '06.10.04%') AND categoria_nome NOT LIKE '06.07.02%' AND data_quitacao::date >= '${mStart}'::date AND data_quitacao::date <= '${mEnd}'::date`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as sga FROM "Conta Azul".caz_parcelas WHERE status = 'QUITADO' AND (categoria_nome LIKE '06.02%' OR categoria_nome LIKE '06.03%' OR categoria_nome LIKE '06.08%' OR categoria_nome LIKE '06.09%' OR categoria_nome LIKE '06.10.02%' OR categoria_nome LIKE '06.10.05%' OR categoria_nome LIKE '06.10.06%' OR categoria_nome LIKE '06.10.07%' OR categoria_nome LIKE '06.10.08%' OR categoria_nome LIKE '06.11%' OR categoria_nome LIKE '06.12%') AND categoria_nome NOT LIKE '06.11.01%' AND data_quitacao::date >= '${mStart}'::date AND data_quitacao::date <= '${mEnd}'::date`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as cac FROM "Conta Azul".caz_parcelas WHERE status = 'QUITADO' AND (categoria_nome LIKE '05.04.02%' OR categoria_nome LIKE '06.04%' OR categoria_nome LIKE '06.06%' OR categoria_nome LIKE '06.07.02%') AND data_quitacao::date >= '${mStart}'::date AND data_quitacao::date <= '${mEnd}'::date`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as capex FROM "Conta Azul".caz_parcelas WHERE status = 'QUITADO' AND categoria_nome LIKE '06.11.01%' AND data_quitacao::date >= '${mStart}'::date AND data_quitacao::date <= '${mEnd}'::date`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as ir_csll FROM "Conta Azul".caz_parcelas WHERE status IN ('QUITADO','RECEBIDO_PARCIAL') AND (categoria_nome LIKE '06.13%' OR categoria_nome LIKE '08.01%') AND data_quitacao::date >= '${mStart}'::date AND data_quitacao::date <= '${mEnd}'::date`)),
              db.execute(sql.raw(`SELECT COALESCE(SUM(valorr::numeric), 0) as churn FROM "Clickup".cup_contratos WHERE data_solicitacao_encerramento >= '${mStart}' AND data_solicitacao_encerramento <= '${mEnd}'`)),
              db.execute(sql.raw(`SELECT COUNT(*) as total FROM "Inhire".rh_pessoal WHERE admissao IS NOT NULL AND admissao::date <= '${mEnd}'::date AND (demissao IS NULL OR demissao::date > '${mEnd}'::date)`)),
              db.execute(sql.raw(`SELECT COUNT(DISTINCT id_task) as total FROM "Clickup".cup_data_hist WHERE data_snapshot::date = '${mEnd}'::date AND status IN ('ativo', 'triagem', 'onboarding')`)),
              db.execute(sql.raw(`SELECT COUNT(DISTINCT id_subtask) as total FROM "Clickup".cup_data_hist WHERE data_snapshot::date = '${mEnd}'::date AND status IN ('ativo', 'triagem', 'onboarding')`)),
            ]);

            const sMrr = parseFloat((snapMrr.rows[0] as any)?.mrr || "0");
            const sVendas = parseFloat((snapVendas.rows[0] as any)?.vendas_mrr || "0");
            const sPontual = parseFloat((snapPontual.rows[0] as any)?.receita_pontual || "0");
            const sOutras = parseFloat((snapOutras.rows[0] as any)?.total || "0");
            const sInad = parseFloat((snapInad.rows[0] as any)?.inadimplencia || "0");
            const sImpostos = parseFloat((snapImpostos.rows[0] as any)?.total || "0");
            const sEntradas = parseFloat((snapCaixa.rows[0] as any)?.entradas || "0");
            const sSaidas = parseFloat((snapCaixa.rows[0] as any)?.saidas || "0");
            const sCsv = parseFloat((snapCsv.rows[0] as any)?.csv || "0");
            const sSga = parseFloat((snapSga.rows[0] as any)?.sga || "0");
            const sCac = parseFloat((snapCac.rows[0] as any)?.cac || "0");
            const sCapex = parseFloat((snapCapex.rows[0] as any)?.capex || "0");
            const sIrCsll = parseFloat((snapIrCsll.rows[0] as any)?.ir_csll || "0");
            const sChurn = parseFloat((snapChurn.rows[0] as any)?.churn || "0");
            const sReceitaTotal = sMrr + sPontual + sOutras;
            const sReceitaLiquida = sReceitaTotal - sImpostos;
            const sMargemBruta = sReceitaLiquida - sCsv;
            const sEbitda = sMargemBruta - sCac - sSga;
            const sGeracaoCaixa = sEntradas - sSaidas;
            const sMargemCaixa = sEntradas > 0 ? sGeracaoCaixa / sEntradas : 0;

            // Saldo de caixa retroativo: saldo_atual - fluxo de caixa dos meses seguintes até hoje
            let sSaldoCaixa = currentBankBalance;
            for (let futureM = m + 1; futureM <= currentMonthNum; futureM++) {
              const futureKey = `2026-${String(futureM).padStart(2, "0")}`;
              sSaldoCaixa -= (cashFlowAfter[futureKey] || 0);
            }

            const snapMetricas = {
              mrr_active: sMrr, sales_mrr: sVendas, revenue_one_time: sPontual,
              revenue_other: sOutras, revenue_billable_total: sReceitaTotal,
              bad_debt: sInad, taxes_on_revenue: sImpostos, net_revenue: sReceitaLiquida,
              csv: sCsv, gross_margin: sMargemBruta, cac: sCac, sga: sSga, ebitda: sEbitda,
              capex: sCapex, tax_ir_csll: sIrCsll,
              cash_generation: sGeracaoCaixa, cash_generation_margin_pct: sMargemCaixa,
              cash_balance: sSaldoCaixa,
              churn_mrr_month: sChurn, headcount_total: parseInt((snapHeadcount.rows[0] as any)?.total || "0"),
              clients_active: parseInt((snapClientes.rows[0] as any)?.total || "0"),
              contracts_active: parseInt((snapContratos.rows[0] as any)?.total || "0"),
              receitas_dfc: sEntradas, despesas_dfc: sSaidas,
            };

            // Save snapshot for future requests
            await db.execute(sql`
              INSERT INTO cortex_core.bp_snapshots (mes_ano, data_snapshot, metricas)
              VALUES (${monthKey}, NOW(), ${JSON.stringify(snapMetricas)}::jsonb)
              ON CONFLICT (mes_ano) DO UPDATE SET data_snapshot = NOW(), metricas = ${JSON.stringify(snapMetricas)}::jsonb
            `);

            // Populate actuals from the generated snapshot
            const autoMetricMap: Record<string, string> = {
              mrr_active: "mrr_active", sales_mrr: "sales_mrr", revenue_one_time: "revenue_one_time",
              revenue_other: "revenue_other", revenue_billable_total: "revenue_billable_total",
              bad_debt: "bad_debt", taxes_on_revenue: "taxes_on_revenue", net_revenue: "revenue_net",
              csv: "cogs_csv", gross_margin: "gross_margin", cac: "cac_total", sga: "sga_total",
              ebitda: "ebitda", capex: "capex", tax_ir_csll: "tax_ir_csll",
              cash_generation: "cash_generation", cash_generation_margin_pct: "cash_generation_margin_pct",
              cash_balance: "cash_balance", churn_mrr_month: "churn_mrr_month", headcount_total: "headcount_total",
              clients_active: "clients_active", contracts_active: "contracts_active",
            };
            for (const [snapshotKey, bpKey] of Object.entries(autoMetricMap)) {
              if ((snapMetricas as any)[snapshotKey] !== undefined) {
                if (!actualsByMetric[bpKey]) actualsByMetric[bpKey] = {};
                actualsByMetric[bpKey][monthKey] = (snapMetricas as any)[snapshotKey];
              }
            }
            console.log(`[bp-financeiro] Snapshot refreshed for ${monthKey}: caixa=${sGeracaoCaixa.toFixed(0)} (entradas=${sEntradas.toFixed(0)} saidas=${sSaidas.toFixed(0)})`);
          } catch (autoSnapError) {
            console.log(`[bp-financeiro] Could not auto-create snapshot for ${monthKey}`, autoSnapError);
          }
        }
      }

      if (currentYear === 2026) {
        try {
          const startOfMonth = new Date(currentYear, currentMonthNum - 1, 1);
          const today = new Date();

          const mrrResult = await db.execute(sql`
            SELECT COALESCE(SUM(valorr), 0) as mrr
            FROM "Clickup".cup_contratos
            WHERE status IN ('ativo', 'onboarding', 'triagem')
          `);
          const mrrAtivo = parseFloat((mrrResult.rows[0] as any)?.mrr || "0");
          if (!actualsByMetric["mrr_active"]) actualsByMetric["mrr_active"] = {};
          actualsByMetric["mrr_active"][currentMonthKey] = mrrAtivo;

          const vendasResult = await db.execute(sql`
            SELECT COALESCE(SUM(valor_recorrente::numeric), 0) as vendas_mrr
            FROM "Bitrix".crm_deal
            WHERE stage_name = 'Negócio Ganho'
              AND data_fechamento IS NOT NULL
              AND TO_CHAR(data_fechamento, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
              AND valor_recorrente IS NOT NULL
              AND valor_recorrente > 0
          `);
          const vendasMrr = parseFloat((vendasResult.rows[0] as any)?.vendas_mrr || "0");
          if (!actualsByMetric["sales_mrr"]) actualsByMetric["sales_mrr"] = {};
          actualsByMetric["sales_mrr"][currentMonthKey] = vendasMrr;

          const receitaPontualResult = await db.execute(sql`
            SELECT COALESCE(SUM(valor_pontual::numeric), 0) as receita_pontual
            FROM "Bitrix".crm_deal
            WHERE stage_name = 'Negócio Ganho'
              AND data_fechamento IS NOT NULL
              AND TO_CHAR(data_fechamento, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
              AND valor_pontual IS NOT NULL
              AND valor_pontual > 0
          `);
          const receitaPontual = parseFloat((receitaPontualResult.rows[0] as any)?.receita_pontual || "0");
          if (!actualsByMetric["revenue_one_time"]) actualsByMetric["revenue_one_time"] = {};
          actualsByMetric["revenue_one_time"][currentMonthKey] = receitaPontual;

          const inadResult = await db.execute(sql`
            SELECT COALESCE(SUM(nao_pago::numeric), 0) as inadimplencia
            FROM "Conta Azul".caz_parcelas
            WHERE tipo_evento = 'RECEITA'
              AND data_vencimento >= ${startOfMonth.toISOString().split("T")[0]}
              AND data_vencimento < ${today.toISOString().split("T")[0]}
              AND nao_pago::numeric > 0
          `);
          const inadimplencia = parseFloat((inadResult.rows[0] as any)?.inadimplencia || "0");
          if (!actualsByMetric["bad_debt"]) actualsByMetric["bad_debt"] = {};
          actualsByMetric["bad_debt"][currentMonthKey] = inadimplencia;

          const churnResult = await db.execute(sql`
            SELECT COALESCE(SUM(valorr::numeric), 0) as churn
            FROM "Clickup".cup_contratos
            WHERE data_solicitacao_encerramento >= ${startOfMonth.toISOString().split("T")[0]}
              AND data_solicitacao_encerramento < ${today.toISOString().split("T")[0]}
          `);
          const churnMrr = parseFloat((churnResult.rows[0] as any)?.churn || "0");
          if (!actualsByMetric["churn_mrr_month"]) actualsByMetric["churn_mrr_month"] = {};
          actualsByMetric["churn_mrr_month"][currentMonthKey] = churnMrr;

          // Geração de Caixa = Receitas - Despesas (mesma query da DFC RESULTADO)
          const geracaoCaixaResult = await db.execute(sql`
            SELECT
              COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN (COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)) ELSE 0 END), 0) as entradas,
              COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN (COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)) ELSE 0 END), 0) as saidas,
              COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN (COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)) ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN (COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)) ELSE 0 END), 0) as geracao_caixa
            FROM "Conta Azul".caz_parcelas
            WHERE data_quitacao::date >= ${startOfMonth.toISOString().split("T")[0]}::date
              AND data_quitacao::date <= CURRENT_DATE
              AND status IN ('QUITADO', 'RECEBIDO_PARCIAL')
          `);
          const entradas = parseFloat((geracaoCaixaResult.rows[0] as any)?.entradas || "0");
          const geracaoCaixa = parseFloat((geracaoCaixaResult.rows[0] as any)?.geracao_caixa || "0");
          if (!actualsByMetric["cash_generation"]) actualsByMetric["cash_generation"] = {};
          actualsByMetric["cash_generation"][currentMonthKey] = geracaoCaixa;

          // Margem de Geração de Caixa % = (Entradas - Saídas) / Entradas
          const margemGeracaoCaixa = entradas > 0 ? geracaoCaixa / entradas : 0;
          if (!actualsByMetric["cash_generation_margin_pct"]) actualsByMetric["cash_generation_margin_pct"] = {};
          actualsByMetric["cash_generation_margin_pct"][currentMonthKey] = margemGeracaoCaixa;

          const outrasReceitasResult = await db.execute(sql`
            SELECT COALESCE(SUM(valor_liquido::numeric), 0) as total
            FROM "Conta Azul".caz_parcelas
            WHERE tipo_evento = 'RECEITA'
              AND (
                categoria_nome LIKE '03.02%'
                OR categoria_nome LIKE '03.03%'
                OR categoria_nome LIKE '04.01%'
                OR categoria_nome LIKE '04.03%'
              )
              AND data_quitacao::date >= ${startOfMonth.toISOString().split("T")[0]}::date
              AND data_quitacao::date <= CURRENT_DATE
          `);
          const outrasReceitas = parseFloat((outrasReceitasResult.rows[0] as any)?.total || "0");
          if (!actualsByMetric["revenue_other"]) actualsByMetric["revenue_other"] = {};
          actualsByMetric["revenue_other"][currentMonthKey] = outrasReceitas;

          // Receita Total Faturável = MRR Ativo + Receita Pontual + Outras Receitas
          const receitaTotalFaturavel = mrrAtivo + receitaPontual + outrasReceitas;
          if (!actualsByMetric["revenue_billable_total"]) actualsByMetric["revenue_billable_total"] = {};
          actualsByMetric["revenue_billable_total"][currentMonthKey] = receitaTotalFaturavel;

          // Impostos sobre a receita (DESPESA, categoria 05.05%)
          const impostosResult = await db.execute(sql`
            SELECT COALESCE(SUM(valor_liquido::numeric), 0) as total
            FROM "Conta Azul".caz_parcelas
            WHERE tipo_evento = 'DESPESA'
              AND categoria_nome LIKE '05.05%'
              AND data_quitacao::date >= ${startOfMonth.toISOString().split("T")[0]}::date
              AND data_quitacao::date <= CURRENT_DATE
          `);
          const impostosReceita = parseFloat((impostosResult.rows[0] as any)?.total || "0");
          if (!actualsByMetric["taxes_on_revenue"]) actualsByMetric["taxes_on_revenue"] = {};
          actualsByMetric["taxes_on_revenue"][currentMonthKey] = impostosReceita;

          // Receita Líquida = Receita Total Faturável - Impostos sobre Receita
          const receitaLiquida = receitaTotalFaturavel - impostosReceita;
          if (!actualsByMetric["revenue_net"]) actualsByMetric["revenue_net"] = {};
          actualsByMetric["revenue_net"][currentMonthKey] = receitaLiquida;

          // Headcount Total: colaboradores ativos
          const headcountResult = await db.execute(sql`
            SELECT COUNT(*) as total
            FROM "Inhire".rh_pessoal
            WHERE status = 'Ativo'
          `);
          const headcountTotal = parseInt((headcountResult.rows[0] as any)?.total || "0");
          if (!actualsByMetric["headcount_total"]) actualsByMetric["headcount_total"] = {};
          actualsByMetric["headcount_total"][currentMonthKey] = headcountTotal;

          // Clientes Ativos
          const clientesResult = await db.execute(sql`
            SELECT COUNT(*) as total
            FROM "Clickup".cup_clientes
            WHERE status IN ('ativo', 'triagem', 'onboarding')
          `);
          const clientesAtivos = parseInt((clientesResult.rows[0] as any)?.total || "0");
          if (!actualsByMetric["clients_active"]) actualsByMetric["clients_active"] = {};
          actualsByMetric["clients_active"][currentMonthKey] = clientesAtivos;

          // Contratos Ativos
          const contratosResult = await db.execute(sql`
            SELECT COUNT(*) as total
            FROM "Clickup".cup_contratos
            WHERE status IN ('ativo', 'triagem', 'onboarding')
          `);
          const contratosAtivos = parseInt((contratosResult.rows[0] as any)?.total || "0");
          if (!actualsByMetric["contracts_active"]) actualsByMetric["contracts_active"] = {};
          actualsByMetric["contracts_active"][currentMonthKey] = contratosAtivos;

          // Saldo de Caixa
          const saldoResult = await db.execute(sql`
            SELECT COALESCE(SUM(balance::numeric), 0) as total
            FROM "Conta Azul".caz_bancos
          `);
          const saldoCaixa = parseFloat((saldoResult.rows[0] as any)?.total || "0");
          if (!actualsByMetric["cash_balance"]) actualsByMetric["cash_balance"] = {};
          actualsByMetric["cash_balance"][currentMonthKey] = saldoCaixa;

          // CSV (Custo Serviços Vendidos) - categorias 05.01-05.04.01, 06.01, 06.05, 06.07 (exceto 06.07.02), 06.10.01, 06.10.03, 06.10.04
          const csvResult = await db.execute(sql`
            SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as csv
            FROM "Conta Azul".caz_parcelas
            WHERE status = 'QUITADO'
              AND (
                categoria_nome LIKE '05.01%'
                OR categoria_nome LIKE '05.02%'
                OR categoria_nome LIKE '05.03%'
                OR categoria_nome LIKE '05.04.01%'
                OR categoria_nome LIKE '06.01%'
                OR categoria_nome LIKE '06.05%'
                OR categoria_nome LIKE '06.07%'
                OR categoria_nome LIKE '06.10.01%'
                OR categoria_nome LIKE '06.10.03%'
                OR categoria_nome LIKE '06.10.04%'
              )
              AND categoria_nome NOT LIKE '06.07.02%'
              AND data_quitacao::date >= ${startOfMonth.toISOString().split("T")[0]}::date
              AND data_quitacao::date <= CURRENT_DATE
          `);
          const csvTotal = parseFloat((csvResult.rows[0] as any)?.csv || "0");
          if (!actualsByMetric["cogs_csv"]) actualsByMetric["cogs_csv"] = {};
          actualsByMetric["cogs_csv"][currentMonthKey] = csvTotal;

          // CAC (Custo de Aquisição) - categorias 05.04.02, 06.04, 06.06, 06.07.02
          const cacResult = await db.execute(sql`
            SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as cac
            FROM "Conta Azul".caz_parcelas
            WHERE status = 'QUITADO'
              AND (
                categoria_nome LIKE '05.04.02%'
                OR categoria_nome LIKE '06.04%'
                OR categoria_nome LIKE '06.06%'
                OR categoria_nome LIKE '06.07.02%'
              )
              AND data_quitacao::date >= ${startOfMonth.toISOString().split("T")[0]}::date
              AND data_quitacao::date <= CURRENT_DATE
          `);
          const cacTotal = parseFloat((cacResult.rows[0] as any)?.cac || "0");
          if (!actualsByMetric["cac_total"]) actualsByMetric["cac_total"] = {};
          actualsByMetric["cac_total"][currentMonthKey] = cacTotal;

          // SG&A (Despesas Administrativas) - categorias 06.02, 06.03, 06.08, 06.09, 06.10.02, 06.10.05-08, 06.11 (exceto 06.11.01), 06.12
          const sgaResult = await db.execute(sql`
            SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as sga
            FROM "Conta Azul".caz_parcelas
            WHERE status = 'QUITADO'
              AND (
                categoria_nome LIKE '06.02%'
                OR categoria_nome LIKE '06.03%'
                OR categoria_nome LIKE '06.08%'
                OR categoria_nome LIKE '06.09%'
                OR categoria_nome LIKE '06.10.02%'
                OR categoria_nome LIKE '06.10.05%'
                OR categoria_nome LIKE '06.10.06%'
                OR categoria_nome LIKE '06.10.07%'
                OR categoria_nome LIKE '06.10.08%'
                OR categoria_nome LIKE '06.11%'
                OR categoria_nome LIKE '06.12%'
              )
              AND categoria_nome NOT LIKE '06.11.01%'
              AND data_quitacao::date >= ${startOfMonth.toISOString().split("T")[0]}::date
              AND data_quitacao::date <= CURRENT_DATE
          `);
          const sgaTotal = parseFloat((sgaResult.rows[0] as any)?.sga || "0");
          if (!actualsByMetric["sga_total"]) actualsByMetric["sga_total"] = {};
          actualsByMetric["sga_total"][currentMonthKey] = sgaTotal;

          // CAPEX (Compra de Ativos) - categoria 06.11.01%
          const capexResult = await db.execute(sql`
            SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as capex
            FROM "Conta Azul".caz_parcelas
            WHERE status = 'QUITADO'
              AND categoria_nome LIKE '06.11.01%'
              AND data_quitacao::date >= ${startOfMonth.toISOString().split("T")[0]}::date
              AND data_quitacao::date <= CURRENT_DATE
          `);
          const capexTotal = parseFloat((capexResult.rows[0] as any)?.capex || "0");
          if (!actualsByMetric["capex"]) actualsByMetric["capex"] = {};
          actualsByMetric["capex"][currentMonthKey] = capexTotal;

          // IR/CSLL - categorias 06.13% e 08.01.02%
          const irCsllResult = await db.execute(sql`
            SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as ir_csll
            FROM "Conta Azul".caz_parcelas
            WHERE status IN ('QUITADO', 'RECEBIDO_PARCIAL')
              AND (categoria_nome LIKE '06.13%' OR categoria_nome LIKE '08.01%')
              AND data_quitacao::date >= ${startOfMonth.toISOString().split("T")[0]}::date
              AND data_quitacao::date <= CURRENT_DATE
          `);
          const irCsll = parseFloat((irCsllResult.rows[0] as any)?.ir_csll || "0");
          if (!actualsByMetric["tax_ir_csll"]) actualsByMetric["tax_ir_csll"] = {};
          actualsByMetric["tax_ir_csll"][currentMonthKey] = irCsll;

          // Margem Bruta = Receita Líquida - CSV
          const margemBruta = receitaLiquida - csvTotal;
          if (!actualsByMetric["gross_margin"]) actualsByMetric["gross_margin"] = {};
          actualsByMetric["gross_margin"][currentMonthKey] = margemBruta;

          // EBITDA = Margem Bruta - CAC - SG&A
          const ebitda = margemBruta - cacTotal - sgaTotal;
          if (!actualsByMetric["ebitda"]) actualsByMetric["ebitda"] = {};
          actualsByMetric["ebitda"][currentMonthKey] = ebitda;

        } catch (liveError) {
          console.log("[api] BP financeiro: Could not fetch live metrics for current month", liveError);
        }
      }

      const currentDate = new Date();
      const currentMonth = currentDate.getFullYear() === 2026
        ? `2026-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
        : null;

      const getStatus = (actual: number | null, target: number, direction: string): "green" | "yellow" | "red" | "gray" => {
        if (actual === null) return "gray";

        if (direction === "down") {
          if (actual <= target) return "green";
          const overshoot = ((actual - target) / target) * 100;
          if (overshoot <= 10) return "yellow";
          return "red";
        } else {
          const pct = (actual / target) * 100;
          if (pct >= 100) return "green";
          if (pct >= 90) return "yellow";
          return "red";
        }
      };

      const metricsData = BP_METRIC_ORDER.map((metricKey, idx) => {
        const def = getMetricByKey(metricKey);
        if (!def) return null;

        const targets = targetsByMetric[metricKey] || def.months;
        const actuals = actualsByMetric[metricKey] || {};

        const monthsData = BP_MONTHS.map(m => {
          const plan = targets[m] ?? null;
          const actual = actuals[m] ?? null;
          const status = plan !== null ? getStatus(actual, plan, def.direction) : "gray";
          const variance = (plan !== null && actual !== null)
            ? ((actual - plan) / Math.abs(plan)) * 100
            : null;

          return {
            month: m,
            plan,
            actual,
            variance,
            status
          };
        });

        const hasActuals = Object.keys(actuals).length > 0;

        const planTotal = computePeriodValue(metricKey, 2026, "YTD", targets, def.period_type);
        const actualTotal = hasActuals ? computePeriodValue(metricKey, 2026, "YTD", actuals, def.period_type) : null;

        const quarters = ["Q1", "Q2", "Q3", "Q4"].map(q => {
          const qPlan = computePeriodValue(metricKey, 2026, q, targets, def.period_type);
          const qActual = hasActuals ? computePeriodValue(metricKey, 2026, q, actuals, def.period_type) : null;
          const { variance, variancePct } = computeVariance(qActual, qPlan);
          const status = computeSignalStatus(qActual, qPlan, def.direction, def.unit);
          return { quarter: q, plan: qPlan, actual: qActual, variance, variancePct, status };
        });

        const ytdVariance = computeVariance(actualTotal, planTotal);
        const ytdStatus = computeSignalStatus(actualTotal, planTotal, def.direction, def.unit);

        return {
          metric_key: metricKey,
          title: def.title,
          unit: def.unit,
          direction: def.direction,
          is_derived: def.is_derived,
          formula: def.formula || null,
          period_type: def.period_type,
          order: idx,
          months: monthsData,
          quarters,
          totals: {
            plan: planTotal,
            actual: actualTotal,
            variance: ytdVariance.variance,
            variancePct: ytdVariance.variancePct,
            status: ytdStatus
          }
        };
      }).filter(Boolean);

      res.json({
        year: 2026,
        currentMonth,
        months: BP_MONTHS,
        metrics: metricsData,
        meta: {
          generatedAt: new Date().toISOString(),
          totalMetrics: metricsData.length
        }
      });
    } catch (error) {
      console.error("[api] Error fetching BP financeiro:", error);
      res.status(500).json({ error: "Failed to fetch BP financeiro data" });
    }
  });

  // ==================== BP TARGETS CRUD ====================

  app.get("/api/okr2026/bp-targets", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { BP_2026_TARGETS, BP_MONTHS } = await import("../okr2026/bp2026Targets");

      // Load DB overrides
      const dbResult = await db.execute(sql`
        SELECT metric_key, month, target_value
        FROM cortex_core.metric_targets_monthly
        WHERE year = 2026
        ORDER BY metric_key, month
      `);
      const dbTargets: Record<string, Record<string, number>> = {};
      for (const row of dbResult.rows as any[]) {
        const key = row.metric_key;
        const monthKey = `2026-${String(row.month).padStart(2, "0")}`;
        if (!dbTargets[key]) dbTargets[key] = {};
        dbTargets[key][monthKey] = parseFloat(row.target_value);
      }

      // Merge: DB overrides TS fallback
      const metrics = BP_2026_TARGETS.map(m => ({
        metric_key: m.metric_key,
        title: m.title,
        unit: m.unit,
        is_derived: m.is_derived,
        months: BP_MONTHS.reduce((acc, month) => {
          acc[month] = dbTargets[m.metric_key]?.[month] ?? m.months[month] ?? 0;
          return acc;
        }, {} as Record<string, number>)
      }));

      res.json({ year: 2026, months: BP_MONTHS, metrics });
    } catch (error) {
      console.error("[api] Error fetching BP targets:", error);
      res.status(500).json({ error: "Failed to fetch BP targets" });
    }
  });

  app.put("/api/okr2026/bp-targets", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { targets } = req.body as { targets: { metric_key: string; month: string; target_value: number }[] };
      if (!Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ error: "targets array is required" });
      }

      let upserted = 0;
      for (const t of targets) {
        const monthNum = parseInt(t.month.split("-")[1]);
        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) continue;

        // Delete + Insert because UNIQUE constraint includes NULLable dimension columns
        await db.execute(sql`
          DELETE FROM cortex_core.metric_targets_monthly
          WHERE year = 2026 AND month = ${monthNum} AND metric_key = ${t.metric_key}
            AND dimension_key IS NULL AND dimension_value IS NULL
        `);
        await db.execute(sql`
          INSERT INTO cortex_core.metric_targets_monthly (year, month, metric_key, target_value, updated_at)
          VALUES (2026, ${monthNum}, ${t.metric_key}, ${t.target_value}, NOW())
        `);
        upserted++;
      }

      res.json({ success: true, upserted });
    } catch (error) {
      console.error("[api] Error updating BP targets:", error);
      res.status(500).json({ error: "Failed to update BP targets" });
    }
  });

  // ==================== BP SNAPSHOTS ====================

  app.get("/api/okr2026/bp-snapshots", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT mes_ano, data_snapshot, metricas, created_at
        FROM cortex_core.bp_snapshots
        ORDER BY mes_ano DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching BP snapshots:", error);
      res.status(500).json({ error: "Failed to fetch BP snapshots" });
    }
  });

  app.get("/api/okr2026/bp-snapshots/:mesAno", isAuthenticated, async (req, res) => {
    try {
      const { mesAno } = req.params;
      const result = await db.execute(sql`
        SELECT mes_ano, data_snapshot, metricas, created_at
        FROM cortex_core.bp_snapshots
        WHERE mes_ano = ${mesAno}
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Snapshot não encontrado" });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error fetching BP snapshot:", error);
      res.status(500).json({ error: "Failed to fetch BP snapshot" });
    }
  });

  app.post("/api/okr2026/bp-snapshots/:mesAno", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { mesAno } = req.params;

      if (!/^\d{4}-\d{2}$/.test(mesAno)) {
        return res.status(400).json({ error: "Formato inválido. Use YYYY-MM" });
      }

      const [year, month] = mesAno.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      const startStr = startOfMonth.toISOString().split("T")[0];
      const endStr = endOfMonth.toISOString().split("T")[0];

      const mrrResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(valorr::numeric), 0) as mrr
        FROM "Clickup".cup_data_hist
        WHERE data_snapshot::date = '${endStr}'::date
          AND status IN ('ativo', 'onboarding', 'triagem')
      `));
      const mrrAtivo = parseFloat((mrrResult.rows[0] as any)?.mrr || "0");

      const vendasResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(valor_recorrente::numeric), 0) as vendas_mrr
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento IS NOT NULL
          AND data_fechamento >= '${startStr}'
          AND data_fechamento <= '${endStr}'
          AND valor_recorrente IS NOT NULL
          AND valor_recorrente > 0
      `));
      const vendasMrr = parseFloat((vendasResult.rows[0] as any)?.vendas_mrr || "0");

      const receitaPontualResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(valor_pontual::numeric), 0) as receita_pontual
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento IS NOT NULL
          AND data_fechamento >= '${startStr}'
          AND data_fechamento <= '${endStr}'
          AND valor_pontual IS NOT NULL
          AND valor_pontual > 0
      `));
      const receitaPontual = parseFloat((receitaPontualResult.rows[0] as any)?.receita_pontual || "0");

      const outrasReceitasResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(valor_liquido::numeric), 0) as total
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND (
            categoria_nome LIKE '03.02%'
            OR categoria_nome LIKE '03.03%'
            OR categoria_nome LIKE '04.01%'
            OR categoria_nome LIKE '04.03%'
          )
          AND data_quitacao::date >= '${startStr}'::date
          AND data_quitacao::date <= '${endStr}'::date
      `));
      const outrasReceitas = parseFloat((outrasReceitasResult.rows[0] as any)?.total || "0");

      const inadResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(nao_pago::numeric), 0) as inadimplencia
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_vencimento >= '${startStr}'
          AND data_vencimento <= '${endStr}'
          AND nao_pago::numeric > 0
      `));
      const inadimplencia = parseFloat((inadResult.rows[0] as any)?.inadimplencia || "0");

      const impostosResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as impostos
        FROM "Conta Azul".caz_parcelas
        WHERE status IN ('QUITADO', 'RECEBIDO_PARCIAL')
          AND categoria_nome LIKE '05.05%'
          AND data_quitacao::date >= '${startStr}'::date
          AND data_quitacao::date <= '${endStr}'::date
      `));
      const impostos = parseFloat((impostosResult.rows[0] as any)?.impostos || "0");

      const geracaoCaixaResult = await db.execute(sql.raw(`
        SELECT
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN (COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)) ELSE 0 END), 0) as entradas,
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' THEN (COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)) ELSE 0 END), 0) as saidas
        FROM "Conta Azul".caz_parcelas
        WHERE data_quitacao::date >= '${startStr}'::date
          AND data_quitacao::date <= '${endStr}'::date
          AND status IN ('QUITADO', 'RECEBIDO_PARCIAL')
      `));
      const entradas = parseFloat((geracaoCaixaResult.rows[0] as any)?.entradas || "0");
      const saidas = parseFloat((geracaoCaixaResult.rows[0] as any)?.saidas || "0");
      const geracaoCaixa = entradas - saidas;
      const margemGeracaoCaixa = entradas > 0 ? geracaoCaixa / entradas : 0;

      const csvResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as csv
        FROM "Conta Azul".caz_parcelas
        WHERE status = 'QUITADO'
          AND (
            categoria_nome LIKE '05.01%'
            OR categoria_nome LIKE '05.02%'
            OR categoria_nome LIKE '05.03%'
            OR categoria_nome LIKE '05.04.01%'
            OR categoria_nome LIKE '06.01%'
            OR categoria_nome LIKE '06.05%'
            OR categoria_nome LIKE '06.07%'
            OR categoria_nome LIKE '06.10.01%'
            OR categoria_nome LIKE '06.10.03%'
            OR categoria_nome LIKE '06.10.04%'
          )
          AND categoria_nome NOT LIKE '06.07.02%'
          AND data_quitacao::date >= '${startStr}'::date
          AND data_quitacao::date <= '${endStr}'::date
      `));
      const csv = parseFloat((csvResult.rows[0] as any)?.csv || "0");

      const sgaResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as sga
        FROM "Conta Azul".caz_parcelas
        WHERE status = 'QUITADO'
          AND (
            categoria_nome LIKE '06.02%'
            OR categoria_nome LIKE '06.03%'
            OR categoria_nome LIKE '06.08%'
            OR categoria_nome LIKE '06.09%'
            OR categoria_nome LIKE '06.10.02%'
            OR categoria_nome LIKE '06.10.05%'
            OR categoria_nome LIKE '06.10.06%'
            OR categoria_nome LIKE '06.10.07%'
            OR categoria_nome LIKE '06.10.08%'
            OR categoria_nome LIKE '06.11%'
            OR categoria_nome LIKE '06.12%'
          )
          AND categoria_nome NOT LIKE '06.11.01%'
          AND data_quitacao::date >= '${startStr}'::date
          AND data_quitacao::date <= '${endStr}'::date
      `));
      const sga = parseFloat((sgaResult.rows[0] as any)?.sga || "0");

      const cacResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as cac
        FROM "Conta Azul".caz_parcelas
        WHERE status = 'QUITADO'
          AND (
            categoria_nome LIKE '05.04.02%'
            OR categoria_nome LIKE '06.04%'
            OR categoria_nome LIKE '06.06%'
            OR categoria_nome LIKE '06.07.02%'
          )
          AND data_quitacao::date >= '${startStr}'::date
          AND data_quitacao::date <= '${endStr}'::date
      `));
      const cac = parseFloat((cacResult.rows[0] as any)?.cac || "0");

      // CAPEX (06.11.01%)
      const capexResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as capex
        FROM "Conta Azul".caz_parcelas
        WHERE status = 'QUITADO' AND categoria_nome LIKE '06.11.01%'
          AND data_quitacao::date >= '${startStr}'::date AND data_quitacao::date <= '${endStr}'::date
      `));
      const capex = parseFloat((capexResult.rows[0] as any)?.capex || "0");

      // IR/CSLL (06.13% e 08.01.02%)
      const irCsllResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(COALESCE(valor_pago::numeric, 0) - COALESCE(desconto::numeric, 0)), 0) as ir_csll
        FROM "Conta Azul".caz_parcelas
        WHERE status IN ('QUITADO', 'RECEBIDO_PARCIAL') AND (categoria_nome LIKE '06.13%' OR categoria_nome LIKE '08.01%')
          AND data_quitacao::date >= '${startStr}'::date AND data_quitacao::date <= '${endStr}'::date
      `));
      const irCsll = parseFloat((irCsllResult.rows[0] as any)?.ir_csll || "0");

      // Churn MRR
      const churnResult = await db.execute(sql.raw(`
        SELECT COALESCE(SUM(valorr::numeric), 0) as churn FROM "Clickup".cup_contratos
        WHERE data_solicitacao_encerramento >= '${startStr}' AND data_solicitacao_encerramento <= '${endStr}'
      `));
      const churnMrr = parseFloat((churnResult.rows[0] as any)?.churn || "0");

      // Headcount, Clientes, Contratos
      const headcountResult = await db.execute(sql.raw(`SELECT COUNT(*) as total FROM "Inhire".rh_pessoal WHERE admissao IS NOT NULL AND admissao::date <= '${endStr}'::date AND (demissao IS NULL OR demissao::date > '${endStr}'::date)`));
      const clientesResult = await db.execute(sql.raw(`SELECT COUNT(DISTINCT id_task) as total FROM "Clickup".cup_data_hist WHERE data_snapshot::date = '${endStr}'::date AND status IN ('ativo', 'triagem', 'onboarding')`));
      const contratosResult = await db.execute(sql.raw(`SELECT COUNT(DISTINCT id_subtask) as total FROM "Clickup".cup_data_hist WHERE data_snapshot::date = '${endStr}'::date AND status IN ('ativo', 'triagem', 'onboarding')`));

      const receitaTotalFaturavel = mrrAtivo + receitaPontual + outrasReceitas;
      const receitaLiquida = receitaTotalFaturavel - inadimplencia - impostos;
      const margemBruta = receitaLiquida - csv;
      const ebitda = margemBruta - cac - sga;

      const metricas = {
        mrr_active: mrrAtivo,
        sales_mrr: vendasMrr,
        revenue_one_time: receitaPontual,
        revenue_other: outrasReceitas,
        revenue_billable_total: receitaTotalFaturavel,
        bad_debt: inadimplencia,
        taxes_on_revenue: impostos,
        net_revenue: receitaLiquida,
        csv: csv,
        gross_margin: margemBruta,
        cac: cac,
        sga: sga,
        ebitda: ebitda,
        capex: capex,
        tax_ir_csll: irCsll,
        cash_generation: geracaoCaixa,
        cash_generation_margin_pct: margemGeracaoCaixa,
        churn_mrr_month: churnMrr,
        headcount_total: parseInt((headcountResult.rows[0] as any)?.total || "0"),
        clients_active: parseInt((clientesResult.rows[0] as any)?.total || "0"),
        contracts_active: parseInt((contratosResult.rows[0] as any)?.total || "0"),
        receitas_dfc: entradas,
        despesas_dfc: saidas,
      };

      await db.execute(sql`
        INSERT INTO cortex_core.bp_snapshots (mes_ano, data_snapshot, metricas)
        VALUES (${mesAno}, NOW(), ${JSON.stringify(metricas)}::jsonb)
        ON CONFLICT (mes_ano) DO UPDATE SET
          data_snapshot = NOW(),
          metricas = ${JSON.stringify(metricas)}::jsonb
      `);

      console.log(`[bp-snapshot] Snapshot criado/atualizado para ${mesAno}`);

      res.json({
        mes_ano: mesAno,
        metricas,
        message: "Snapshot salvo com sucesso"
      });
    } catch (error) {
      console.error("[api] Error creating BP snapshot:", error);
      res.status(500).json({ error: "Failed to create BP snapshot" });
    }
  });

  // ==================== KR CHECK-INS ====================

  app.get("/api/okr2026/kr-checkins/:krId", isAuthenticated, async (req, res) => {
    try {
      const { krId } = req.params;
      const year = parseInt(req.query.year as string) || 2026;

      const result = await db.execute(sql`
        SELECT
          id, kr_id, year, period_type, period_value,
          confidence, commentary, blockers, next_actions,
          created_by, created_at
        FROM kr_checkins
        WHERE kr_id = ${krId} AND year = ${year}
        ORDER BY created_at DESC
      `);

      res.json({
        krId,
        year,
        checkins: result.rows.map((r: any) => ({
          id: r.id,
          krId: r.kr_id,
          year: r.year,
          periodType: r.period_type,
          periodValue: r.period_value,
          confidence: r.confidence,
          commentary: r.commentary,
          blockers: r.blockers,
          nextActions: r.next_actions,
          createdBy: r.created_by,
          createdAt: r.created_at
        }))
      });
    } catch (error) {
      console.error("[api] Error fetching KR check-ins:", error);
      res.status(500).json({ error: "Failed to fetch KR check-ins" });
    }
  });

  app.get("/api/okr2026/kr-checkins-latest", isAuthenticated, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || 2026;

      const result = await db.execute(sql`
        SELECT DISTINCT ON (kr_id)
          id, kr_id, year, period_type, period_value,
          confidence, commentary, blockers, next_actions,
          created_by, created_at
        FROM kr_checkins
        WHERE year = ${year}
        ORDER BY kr_id, created_at DESC
      `);

      const latestByKr: Record<string, any> = {};
      for (const r of result.rows as any[]) {
        latestByKr[r.kr_id] = {
          id: r.id,
          krId: r.kr_id,
          year: r.year,
          periodType: r.period_type,
          periodValue: r.period_value,
          confidence: r.confidence,
          commentary: r.commentary,
          blockers: r.blockers,
          nextActions: r.next_actions,
          createdBy: r.created_by,
          createdAt: r.created_at
        };
      }

      res.json({ year, latestByKr });
    } catch (error) {
      console.error("[api] Error fetching latest KR check-ins:", error);
      res.status(500).json({ error: "Failed to fetch latest KR check-ins" });
    }
  });

  app.post("/api/okr2026/kr-checkins", isAuthenticated, async (req, res) => {
    try {
      const { krId, year, periodType, periodValue, confidence, commentary, blockers, nextActions } = req.body;

      if (!krId || !year || !periodType || !periodValue) {
        return res.status(400).json({ error: "krId, year, periodType and periodValue are required" });
      }

      if (confidence === undefined || confidence < 0 || confidence > 100) {
        return res.status(400).json({ error: "confidence must be between 0 and 100" });
      }

      const createdBy = (req as any).user?.email || "unknown";

      const result = await db.execute(sql`
        INSERT INTO kr_checkins (kr_id, year, period_type, period_value, confidence, commentary, blockers, next_actions, created_by)
        VALUES (${krId}, ${year}, ${periodType}, ${periodValue}, ${confidence}, ${commentary || null}, ${blockers || null}, ${nextActions || null}, ${createdBy})
        RETURNING id, kr_id, year, period_type, period_value, confidence, commentary, blockers, next_actions, created_by, created_at
      `);

      const r = result.rows[0] as any;
      res.json({
        id: r.id,
        krId: r.kr_id,
        year: r.year,
        periodType: r.period_type,
        periodValue: r.period_value,
        confidence: r.confidence,
        commentary: r.commentary,
        blockers: r.blockers,
        nextActions: r.next_actions,
        createdBy: r.created_by,
        createdAt: r.created_at
      });
    } catch (error) {
      console.error("[api] Error creating KR check-in:", error);
      res.status(500).json({ error: "Failed to create KR check-in" });
    }
  });

  // ==================== OKR 2026: SEED INITIATIVES ====================

  app.post("/api/okr2026/seed-initiatives", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const initiativesData = await import("../okr2026/initiatives.json");
      const initiatives = initiativesData.initiatives || [];

      let upsertCount = 0;

      for (const ini of initiatives) {
        const stableKey = ini.stable_key || ini.id;
        const tagsArray = ini.tags || [];
        const krsArray = ini.krs || [];

        await db.execute(sql`
          INSERT INTO okr_initiatives
            (stable_key, objective_id, title, quarter, status, owner_email, owner_name, tags, krs, origin)
          VALUES
            (${stableKey}, ${ini.objectiveId}, ${ini.title}, ${ini.quarter || null}, ${ini.status},
             ${ini.owner_email || null}, ${ini.owner_name || null}, ${tagsArray}, ${krsArray}, ${ini.origin || 'seed_turbo_2026'})
          ON CONFLICT (stable_key) DO UPDATE SET
            objective_id = EXCLUDED.objective_id,
            title = EXCLUDED.title,
            quarter = EXCLUDED.quarter,
            status = EXCLUDED.status,
            owner_email = EXCLUDED.owner_email,
            owner_name = EXCLUDED.owner_name,
            tags = EXCLUDED.tags,
            krs = EXCLUDED.krs,
            origin = EXCLUDED.origin,
            updated_at = NOW()
        `);
        upsertCount++;
      }

      res.json({
        success: true,
        message: `Initiatives seeded successfully`,
        count: upsertCount
      });
    } catch (error) {
      console.error("[api] Error seeding initiatives:", error);
      res.status(500).json({ error: "Failed to seed initiatives" });
    }
  });

  // ==================== OKR 2026: SQUAD GOALS ====================

  app.get("/api/okr2026/squad-goals", isAuthenticated, async (req, res) => {
    try {
      const { squad, perspective, year } = req.query;

      let query = sql`
        SELECT id, squad, perspective, metric_name, unit, periodicity, data_source, owner_team,
               actual_value, target_value, score, weight, notes, year, quarter, month, updated_at
        FROM squad_goals
        WHERE 1=1
      `;

      if (squad) query = sql`${query} AND squad = ${squad}`;
      if (perspective) query = sql`${query} AND perspective = ${perspective}`;
      if (year) query = sql`${query} AND year = ${parseInt(year as string)}`;

      query = sql`${query} ORDER BY perspective, squad, metric_name`;

      const result = await db.execute(query);

      res.json({
        goals: result.rows.map((r: any) => ({
          id: r.id,
          squad: r.squad,
          perspective: r.perspective,
          metricName: r.metric_name,
          unit: r.unit,
          periodicity: r.periodicity,
          dataSource: r.data_source,
          ownerTeam: r.owner_team,
          actualValue: r.actual_value ? parseFloat(r.actual_value) : null,
          targetValue: r.target_value ? parseFloat(r.target_value) : null,
          score: r.score ? parseFloat(r.score) : null,
          weight: r.weight ? parseFloat(r.weight) : 1,
          notes: r.notes,
          year: r.year,
          quarter: r.quarter,
          month: r.month,
          updatedAt: r.updated_at
        }))
      });
    } catch (error) {
      console.error("[api] Error fetching squad goals:", error);
      res.status(500).json({ error: "Failed to fetch squad goals" });
    }
  });

  app.post("/api/okr2026/squad-goals", isAuthenticated, async (req, res) => {
    try {
      const { squad, perspective, metricName, unit, periodicity, dataSource, ownerTeam, actualValue, targetValue, score, weight, notes, year, quarter, month } = req.body;

      if (!squad || !perspective || !metricName || !unit) {
        return res.status(400).json({ error: "squad, perspective, metricName and unit are required" });
      }

      const result = await db.execute(sql`
        INSERT INTO squad_goals (squad, perspective, metric_name, unit, periodicity, data_source, owner_team, actual_value, target_value, score, weight, notes, year, quarter, month)
        VALUES (${squad}, ${perspective}, ${metricName}, ${unit}, ${periodicity || 'monthly'}, ${dataSource || null}, ${ownerTeam || null}, ${actualValue || null}, ${targetValue || null}, ${score || null}, ${weight || 1}, ${notes || null}, ${year || 2026}, ${quarter || null}, ${month || null})
        RETURNING *
      `);

      res.json({ goal: result.rows[0] });
    } catch (error) {
      console.error("[api] Error creating squad goal:", error);
      res.status(500).json({ error: "Failed to create squad goal" });
    }
  });

  app.patch("/api/okr2026/squad-goals/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { actualValue, targetValue, score, notes } = req.body;

      const result = await db.execute(sql`
        UPDATE squad_goals
        SET actual_value = COALESCE(${actualValue}, actual_value),
            target_value = COALESCE(${targetValue}, target_value),
            score = COALESCE(${score}, score),
            notes = COALESCE(${notes}, notes),
            updated_at = NOW()
        WHERE id = ${parseInt(id)}
        RETURNING *
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Goal not found" });
      }

      res.json({ goal: result.rows[0] });
    } catch (error) {
      console.error("[api] Error updating squad goal:", error);
      res.status(500).json({ error: "Failed to update squad goal" });
    }
  });

  app.delete("/api/okr2026/squad-goals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      await db.execute(sql`DELETE FROM squad_goals WHERE id = ${parseInt(id)}`);

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting squad goal:", error);
      res.status(500).json({ error: "Failed to delete squad goal" });
    }
  });

  // ==================== OKR 2026: SEED SQUAD GOALS ====================

  app.post("/api/okr2026/seed-squad-goals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Clear existing data first
      await db.execute(sql`DELETE FROM squad_goals WHERE year = 2026`);

      const squadGoalsSeed = [
        // Financeiro
        { squad: "Commerce", perspective: "Financeiro", metricName: "Meta de Vendas", unit: "BRL", periodicity: "monthly", targetValue: 2500000, actualValue: 1875000, ownerTeam: "Vendas", year: 2026, quarter: 1 },
        { squad: "Commerce", perspective: "Financeiro", metricName: "Receita Recorrente (MRR)", unit: "BRL", periodicity: "monthly", targetValue: 1340000, actualValue: 936800, ownerTeam: "Comercial", year: 2026, quarter: 1 },
        { squad: "TurboOH", perspective: "Financeiro", metricName: "Receita TurboOH", unit: "BRL", periodicity: "monthly", targetValue: 800000, actualValue: 624000, ownerTeam: "TurboOH", year: 2026, quarter: 1 },
        { squad: "Tech", perspective: "Financeiro", metricName: "Economia Operacional", unit: "BRL", periodicity: "monthly", targetValue: 150000, actualValue: 98500, ownerTeam: "Tech", year: 2026, quarter: 1 },

        // Cliente
        { squad: "Commerce", perspective: "Cliente", metricName: "NPS", unit: "COUNT", periodicity: "quarterly", targetValue: 70, actualValue: 62, ownerTeam: "CS", year: 2026, quarter: 1 },
        { squad: "Commerce", perspective: "Cliente", metricName: "Churn Rate", unit: "PCT", periodicity: "monthly", targetValue: 0.05, actualValue: 0.068, ownerTeam: "CS", year: 2026, quarter: 1 },
        { squad: "TurboOH", perspective: "Cliente", metricName: "Satisfação Cliente", unit: "PCT", periodicity: "monthly", targetValue: 0.85, actualValue: 0.79, ownerTeam: "TurboOH", year: 2026, quarter: 1 },
        { squad: "G&G", perspective: "Cliente", metricName: "eNPS (Colaboradores)", unit: "COUNT", periodicity: "quarterly", targetValue: 65, actualValue: 58, ownerTeam: "G&G", year: 2026, quarter: 1 },

        // Processo
        { squad: "Tech", perspective: "Processo", metricName: "Tempo Médio Deploy", unit: "COUNT", periodicity: "weekly", targetValue: 30, actualValue: 25, ownerTeam: "DevOps", year: 2026, quarter: 1, notes: "Em minutos" },
        { squad: "Tech", perspective: "Processo", metricName: "Uptime", unit: "PCT", periodicity: "monthly", targetValue: 0.999, actualValue: 0.9985, ownerTeam: "Infraestrutura", year: 2026, quarter: 1 },
        { squad: "Commerce", perspective: "Processo", metricName: "Ciclo de Vendas", unit: "COUNT", periodicity: "monthly", targetValue: 45, actualValue: 52, ownerTeam: "Vendas", year: 2026, quarter: 1, notes: "Em dias" },
        { squad: "G&G", perspective: "Processo", metricName: "Tempo Onboarding", unit: "COUNT", periodicity: "monthly", targetValue: 14, actualValue: 18, ownerTeam: "RH", year: 2026, quarter: 1, notes: "Em dias" },

        // Pessoas
        { squad: "G&G", perspective: "Pessoas", metricName: "Turnover", unit: "PCT", periodicity: "monthly", targetValue: 0.03, actualValue: 0.042, ownerTeam: "RH", year: 2026, quarter: 1 },
        { squad: "G&G", perspective: "Pessoas", metricName: "Treinamentos Concluídos", unit: "COUNT", periodicity: "quarterly", targetValue: 50, actualValue: 38, ownerTeam: "T&D", year: 2026, quarter: 1 },
        { squad: "Tech", perspective: "Pessoas", metricName: "Certificações", unit: "COUNT", periodicity: "quarterly", targetValue: 10, actualValue: 7, ownerTeam: "Tech", year: 2026, quarter: 1 },
        { squad: "Commerce", perspective: "Pessoas", metricName: "Produtividade Vendedor", unit: "BRL", periodicity: "monthly", targetValue: 250000, actualValue: 187500, ownerTeam: "Comercial", year: 2026, quarter: 1 },
      ];

      // Batch insert
      const values = squadGoalsSeed.map(g =>
        sql`(${g.squad}, ${g.perspective}, ${g.metricName}, ${g.unit}, ${g.periodicity}, 'seed', ${g.ownerTeam}, ${g.actualValue}, ${g.targetValue}, 1, ${g.notes || null}, ${g.year}, ${g.quarter})`
      );

      await db.execute(sql`
        INSERT INTO squad_goals (squad, perspective, metric_name, unit, periodicity, data_source, owner_team, actual_value, target_value, weight, notes, year, quarter)
        VALUES ${sql.join(values, sql`, `)}
      `);

      res.json({ success: true, count: squadGoalsSeed.length });
    } catch (error) {
      console.error("[api] Error seeding squad goals:", error);
      res.status(500).json({ error: "Failed to seed squad goals" });
    }
  });
}

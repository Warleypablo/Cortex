import type { Express } from "express";
import { sql } from "drizzle-orm";

const TURBO_PARTNERS_ACCOUNT_ID = "act_1331413260627780";

// Usuários autorizados a editar as metas mensais de investimento.
const ALLOWED_EDITOR_EMAILS = new Set([
  "ferramentas@turbopartners.com.br",
  "vinicius.ichino@turbopartners.com.br",
]);

type Platform = "meta" | "google";

interface CampanhaRow {
  platform: Platform;
  campaignId: string;
  name: string;
  status: string | null;
  dailyBudgetAtual: number;
  investidoTotal: number;
  investimentoMensalMeta: number | null;
  orcamentoDiarioMeta: number | null;
  projecaoAsIs: number;
  isDelivering: boolean;
}

function parseMonthParam(param: string | undefined): { firstDay: string; lastDay: string; year: number; month1Based: number } {
  const now = new Date();
  let year = now.getFullYear();
  let monthIdx = now.getMonth(); // 0-based
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map((v) => parseInt(v, 10));
    year = y;
    monthIdx = m - 1;
  }
  const first = new Date(year, monthIdx, 1);
  const last = new Date(year, monthIdx + 1, 0);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { firstDay: fmt(first), lastDay: fmt(last), year, month1Based: monthIdx + 1 };
}

function computeDias(firstDay: string, lastDay: string): { diasTotal: number; diasDecorridos: number; diasRestantes: number } {
  const first = new Date(firstDay + "T00:00:00");
  const last = new Date(lastDay + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diasTotal = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
  let diasDecorridos: number;
  if (today < first) {
    diasDecorridos = 0;
  } else if (today > last) {
    diasDecorridos = diasTotal;
  } else {
    // Contar dias já completos (today - 1 inclusive)
    diasDecorridos = Math.round((today.getTime() - first.getTime()) / 86_400_000);
  }
  const diasRestantes = Math.max(0, diasTotal - diasDecorridos);
  return { diasTotal, diasDecorridos, diasRestantes };
}

export function registerOrcamentoCampanhasRoutes(app: Express, db: any) {
  app.get("/api/growth/orcamento-campanhas", async (req, res) => {
    try {
      const monthParam = typeof req.query.month === "string" ? req.query.month : undefined;
      const { firstDay, lastDay, year, month1Based } = parseMonthParam(monthParam);
      const { diasTotal, diasDecorridos, diasRestantes } = computeDias(firstDay, lastDay);
      const monthStart = firstDay; // DATE, primeiro dia do mês

      // ===== Meta Ads =====
      // Mostra campanhas relevantes: ACTIVE, ou com spend no mês, ou com meta definida.
      // Inclui campanhas arquivadas/deletadas que tiveram gasto no mês — sem filtro
      // por effective_status no CTE, o WHERE final (spend > 0 OR ACTIVE OR meta) decide.
      // Para ABO, soma o daily_budget dos adsets com effective_status ACTIVE.
      const metaRes = await db.execute(sql`
        WITH campaign_budget AS (
          SELECT
            c.campaign_id,
            c.campaign_name,
            c.effective_status,
            COALESCE(
              c.daily_budget,
              (
                SELECT COALESCE(SUM(a.daily_budget), 0)
                FROM meta_ads.meta_adsets a
                WHERE a.campaign_id = c.campaign_id
                  AND a.effective_status = 'ACTIVE'
              )
            ) AS daily_budget_atual
          FROM meta_ads.meta_campaigns c
          WHERE c.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        ),
        spend_agg AS (
          SELECT campaign_id, SUM(spend)::float AS investido_total
          FROM meta_ads.meta_insights_daily
          WHERE date_start BETWEEN ${firstDay}::date AND ${lastDay}::date
          GROUP BY campaign_id
        ),
        recent_spend_agg AS (
          SELECT campaign_id, SUM(spend)::float AS recent_spend
          FROM meta_ads.meta_insights_daily
          WHERE date_start >= (CURRENT_DATE - INTERVAL '3 days')
            AND date_start < CURRENT_DATE
          GROUP BY campaign_id
        ),
        metas_meta AS (
          SELECT campaign_id FROM cortex_core.campaign_monthly_budget
          WHERE platform = 'meta' AND month = ${monthStart}::date
        )
        SELECT
          cb.campaign_id,
          cb.campaign_name AS name,
          cb.effective_status AS status,
          COALESCE(cb.daily_budget_atual, 0)::float AS daily_budget_atual,
          COALESCE(s.investido_total, 0)::float AS investido_total,
          COALESCE(rs.recent_spend, 0)::float AS recent_spend
        FROM campaign_budget cb
        LEFT JOIN spend_agg s ON s.campaign_id = cb.campaign_id
        LEFT JOIN recent_spend_agg rs ON rs.campaign_id = cb.campaign_id
        WHERE cb.effective_status = 'ACTIVE'
           OR COALESCE(s.investido_total, 0) > 0
           OR cb.campaign_id IN (SELECT campaign_id FROM metas_meta)
        ORDER BY cb.campaign_name;
      `);

      // ===== Google Ads =====
      // Detecta coluna de data disponível em campaign_daily_metrics (histórico: report_date/metric_date/date).
      const gaColsRes = await db.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'google_ads' AND table_name = 'campaign_daily_metrics'
      `);
      const gaCols = (gaColsRes.rows || []).map((r: any) => r.column_name);
      const hasGoogleSchema = gaCols.length > 0;
      const gaDateCol = gaCols.includes("report_date") ? "report_date"
        : gaCols.includes("metric_date") ? "metric_date"
        : gaCols.includes("date") ? "date"
        : null;

      let googleRows: any[] = [];
      if (hasGoogleSchema && gaDateCol) {
        // Mostra apenas: ENABLED, com spend no mês, ou com meta definida.
        const googleRes = await db.execute(sql.raw(`
          WITH spend_agg AS (
            SELECT campaign_key, SUM(cost_micros)::numeric AS cost_sum
            FROM google_ads.campaign_daily_metrics
            WHERE ${gaDateCol} BETWEEN '${firstDay}'::date AND '${lastDay}'::date
            GROUP BY campaign_key
          ),
          recent_spend_agg AS (
            SELECT campaign_key, SUM(cost_micros)::numeric AS recent_cost_sum
            FROM google_ads.campaign_daily_metrics
            WHERE ${gaDateCol} >= (CURRENT_DATE - INTERVAL '3 days')
              AND ${gaDateCol} < CURRENT_DATE
            GROUP BY campaign_key
          ),
          metas_google AS (
            SELECT campaign_id FROM cortex_core.campaign_monthly_budget
            WHERE platform = 'google' AND month = '${monthStart}'::date
          )
          SELECT
            c.campaign_id::text AS campaign_id,
            c.name AS name,
            c.status AS status,
            COALESCE(b.amount_micros::numeric / 1000000, 0)::float AS daily_budget_atual,
            COALESCE(s.cost_sum / 1000000, 0)::float AS investido_total,
            COALESCE(rs.recent_cost_sum / 1000000, 0)::float AS recent_spend
          FROM google_ads.campaigns c
          LEFT JOIN google_ads.campaign_budgets b ON b.budget_key = c.budget_key
          LEFT JOIN spend_agg s ON s.campaign_key = c.campaign_key
          LEFT JOIN recent_spend_agg rs ON rs.campaign_key = c.campaign_key
          WHERE COALESCE(s.cost_sum, 0) > 0
             OR c.campaign_id::text IN (SELECT campaign_id FROM metas_google)
          ORDER BY c.name;
        `));
        googleRows = googleRes.rows || [];
      }

      // ===== Metas mensais manuais =====
      const metasRes = await db.execute(sql`
        SELECT platform, campaign_id, monthly_budget_target::float AS monthly_budget_target
        FROM cortex_core.campaign_monthly_budget
        WHERE month = ${monthStart}::date
      `);
      const metasMap = new Map<string, number>();
      for (const r of metasRes.rows || []) {
        metasMap.set(`${r.platform}:${r.campaign_id}`, Number(r.monthly_budget_target));
      }

      const buildRow = (platform: Platform, row: any): CampanhaRow => {
        const campaignId = String(row.campaign_id);
        const dailyBudgetAtual = Number(row.daily_budget_atual) || 0;
        const investidoTotal = Number(row.investido_total) || 0;
        const recentSpend = Number(row.recent_spend) || 0;
        const investimentoMensalMeta = metasMap.get(`${platform}:${campaignId}`) ?? null;
        // Só projeta gasto futuro se a campanha está ativa E houve entrega real
        // nos últimos 3 dias (status ACTIVE/ENABLED por si só não garante delivery —
        // ex: ABO ativa sem nenhum adset rodando, ou ativa mas sem orçamento entregando).
        const isActiveStatus = row.status === "ACTIVE" || row.status === "ENABLED";
        const isDelivering = isActiveStatus && recentSpend > 0;
        const projecaoAsIs = isDelivering
          ? investidoTotal + dailyBudgetAtual * diasRestantes
          : investidoTotal;
        let orcamentoDiarioMeta: number | null = null;
        if (investimentoMensalMeta !== null && diasRestantes > 0) {
          orcamentoDiarioMeta = Math.max(0, (investimentoMensalMeta - investidoTotal) / diasRestantes);
        } else if (investimentoMensalMeta !== null && diasRestantes === 0) {
          orcamentoDiarioMeta = 0;
        }
        return {
          platform,
          campaignId,
          name: row.name,
          status: row.status,
          dailyBudgetAtual,
          investidoTotal,
          investimentoMensalMeta,
          orcamentoDiarioMeta,
          projecaoAsIs,
          isDelivering,
        };
      };

      const campanhas: CampanhaRow[] = [
        ...((metaRes.rows || []) as any[]).map((r) => buildRow("meta", r)),
        ...(googleRows as any[]).map((r) => buildRow("google", r)),
      ];

      res.json({
        month: `${year}-${String(month1Based).padStart(2, "0")}`,
        firstDay,
        lastDay,
        diasTotal,
        diasDecorridos,
        diasRestantes,
        campanhas,
      });
    } catch (error) {
      console.error("[api] Error fetching orcamento-campanhas:", error);
      res.status(500).json({ error: "Failed to fetch orcamento-campanhas" });
    }
  });

  // Upsert da meta mensal manual de uma campanha.
  app.put("/api/growth/orcamento-campanhas/meta", async (req, res) => {
    try {
      const userEmail = (req.user as any)?.email as string | undefined;
      if (!userEmail || !ALLOWED_EDITOR_EMAILS.has(userEmail)) {
        return res.status(403).json({ error: "Apenas editores autorizados podem alterar metas." });
      }
      const { platform, campaignId, month, monthlyBudgetTarget } = req.body || {};
      if (platform !== "meta" && platform !== "google") {
        return res.status(400).json({ error: "platform must be 'meta' or 'google'" });
      }
      if (!campaignId || typeof campaignId !== "string") {
        return res.status(400).json({ error: "campaignId is required" });
      }
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: "month must be 'YYYY-MM'" });
      }
      const target = Number(monthlyBudgetTarget);
      if (!Number.isFinite(target) || target < 0) {
        return res.status(400).json({ error: "monthlyBudgetTarget must be a non-negative number" });
      }

      const monthDate = `${month}-01`;

      if (target === 0) {
        // Deletar a meta quando 0 (limpa input)
        await db.execute(sql`
          DELETE FROM cortex_core.campaign_monthly_budget
          WHERE platform = ${platform} AND campaign_id = ${campaignId} AND month = ${monthDate}::date
        `);
      } else {
        await db.execute(sql`
          INSERT INTO cortex_core.campaign_monthly_budget (platform, campaign_id, month, monthly_budget_target, updated_by)
          VALUES (${platform}, ${campaignId}, ${monthDate}::date, ${target}, ${userEmail})
          ON CONFLICT (platform, campaign_id, month) DO UPDATE SET
            monthly_budget_target = EXCLUDED.monthly_budget_target,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error upserting orcamento-campanhas meta:", error);
      res.status(500).json({ error: "Failed to save meta" });
    }
  });
}

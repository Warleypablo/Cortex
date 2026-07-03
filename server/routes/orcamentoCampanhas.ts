import type { Express } from "express";
import { sql } from "drizzle-orm";

const TURBO_PARTNERS_ACCOUNT_ID = "act_1331413260627780";
// Conta de anúncios da própria Turbo no TikTok ("Turbo Partners LTDA - CA Oficial").
// O schema tiktok.* guarda também contas de clientes (Hevo, Suburb, etc.) que a
// agência opera — aqui só queremos a conta da Turbo, espelhando o filtro do Meta.
const TURBO_PARTNERS_TIKTOK_ADVERTISER_ID = "7065303755092131842";

// Usuários autorizados a editar as metas mensais de investimento.
const ALLOWED_EDITOR_EMAILS = new Set([
  "ferramentas@turbopartners.com.br",
  "vinicius.ichino@turbopartners.com.br",
  "warleyreserva4@gmail.com",
]);

// Plataformas suportadas. Adicionar um canal novo = incluir aqui + um bloco de
// fetch no GET (e os estilos/ícone no front). Os schemas de cada plataforma:
//   meta → meta_ads.*  |  google → google.*  |  tiktok → tiktok.*  |  linkedin → linkedin.*
const PLATFORMS = ["meta", "google", "tiktok", "linkedin"] as const;
type Platform = (typeof PLATFORMS)[number];

// Status considerados "ativos" entre as plataformas (cada uma usa um enum diferente).
const ACTIVE_STATUSES = new Set(["ACTIVE", "ENABLED", "ENABLE"]);

// Tags/grupos (pools) válidos para classificar campanhas. Adicionar uma tag
// nova é só incluir aqui (e no front) — não precisa de migração no banco.
const CAMPAIGN_TAGS = ["inbound", "evento", "creators_summit"] as const;
type CampaignTag = (typeof CAMPAIGN_TAGS)[number];

// Etapas do funil para o planejamento por etapa. Mesma regra: adicionar/renomear
// é só editar aqui e no front.
const CAMPAIGN_STAGES = ["descoberta", "relacionamento", "conversao", "remarketing", "institucional"] as const;
type CampaignStage = (typeof CAMPAIGN_STAGES)[number];

// Produtos pra classificar campanhas (novo nível de planejamento, entre Etapa
// e Canal). Mesma regra de tag/stage: adicionar/renomear é só editar aqui e no front.
const CAMPAIGN_PRODUCTS = ["creators", "turbo", "comunidade", "crm", "summit"] as const;
type CampaignProduct = (typeof CAMPAIGN_PRODUCTS)[number];

// Níveis plantáveis na árvore de metas (budget_plan_node). platform reaproveita
// os valores de PLATFORMS (Canal não precisa de classificação própria — já é
// um fato intrínseco da campanha).
const LEVEL_TYPES = ["stage", "product", "platform"] as const;
type LevelType = (typeof LEVEL_TYPES)[number];

// Remove a linha de campaign_tags se tag/stage/produto ficaram todos vazios.
// Chamada pelos 3 endpoints de classificação (/tag, /stage, /produto) depois
// de limpar um campo — evita repetir (e desatualizar) esse check 3x: já
// aconteceu de um deles ficar pra trás quando `produto` foi adicionado.
async function deleteCampaignTagsRowIfEmpty(db: any, platform: string, campaignId: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM cortex_core.campaign_tags
    WHERE platform = ${platform} AND campaign_id = ${campaignId}
      AND tag IS NULL AND stage IS NULL AND produto IS NULL
  `);
}

// Valida que parentKey é exatamente o path canônico de um ancestral real pro
// levelType dado (stage=raiz, product=sob uma stage válida, platform=sob uma
// stage+product válidos). Além de rejeitar lixo, isso impede estruturalmente
// ciclos: o formato de parentKey é sempre mais raso que o do próprio nó, nunca
// pode apontar pra si mesmo ou pra um descendente.
function isValidParentKey(levelType: LevelType, parentKey: string): boolean {
  if (levelType === "stage") return parentKey === "";
  if (levelType === "product") {
    return (CAMPAIGN_STAGES as readonly string[]).some((s) => parentKey === `stage:${s}`);
  }
  // platform
  for (const s of CAMPAIGN_STAGES) {
    for (const p of CAMPAIGN_PRODUCTS) {
      if (parentKey === `stage:${s}|product:${p}`) return true;
    }
  }
  return false;
}

type PlanUnit = "pct" | "brl";

interface CampanhaRow {
  platform: Platform;
  campaignId: string;
  name: string;
  status: string | null;
  // Normalizado no backend via ACTIVE_STATUSES — cada plataforma usa um enum
  // diferente (Meta=ACTIVE, Google=ENABLED, TikTok=ENABLE). O front consome este
  // booleano em vez de re-checar a string, pra não esquecer nenhum vocabulário.
  isActive: boolean;
  dailyBudgetAtual: number;
  investidoTotal: number;
  investimentoMensalMeta: number | null;
  orcamentoDiarioMeta: number | null;
  projecaoAsIs: number;
  isDelivering: boolean;
  tag: CampaignTag | null;
  stage: CampaignStage | null;
  produto: CampaignProduct | null;
}

// Plano de um pool no mês: só o total (a árvore de metas por nível vem em
// `planNodes`, o client resolve % do pai/soma).
interface PoolPlan {
  total: number | null;
}

// Um nó da árvore de metas (stage/product/platform) dentro de um pool/mês.
// parentKey = "" na raiz (pai é o total do pool); senão "type:key|type:key...".
interface PlanNode {
  pool: CampaignTag;
  levelType: LevelType;
  levelKey: string;
  parentKey: string;
  value: number;
  unit: PlanUnit;
}

// Meta travada por campanha individual (qualquer plataforma).
interface CampaignTargetRow {
  pool: CampaignTag;
  platform: Platform;
  campaignId: string;
  value: number;
  unit: PlanUnit;
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
          -- Inclui HOJE: campanhas criadas/iniciadas hoje já contam como entregando,
          -- pra projeção extrapolar o orçamento delas pra frente.
          SELECT campaign_id, SUM(spend)::float AS recent_spend
          FROM meta_ads.meta_insights_daily
          WHERE date_start >= (CURRENT_DATE - INTERVAL '3 days')
            AND date_start <= CURRENT_DATE
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
        WHERE table_schema = 'google' AND table_name = 'campaign_daily_metrics'
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
            SELECT campaign_id, SUM(cost_micros)::numeric AS cost_sum
            FROM google.campaign_daily_metrics
            WHERE ${gaDateCol} BETWEEN '${firstDay}'::date AND '${lastDay}'::date
            GROUP BY campaign_id
          ),
          recent_spend_agg AS (
            SELECT campaign_id, SUM(cost_micros)::numeric AS recent_cost_sum
            FROM google.campaign_daily_metrics
            WHERE ${gaDateCol} >= (CURRENT_DATE - INTERVAL '3 days')
              AND ${gaDateCol} <= CURRENT_DATE
            GROUP BY campaign_id
          ),
          metas_google AS (
            SELECT campaign_id FROM cortex_core.campaign_monthly_budget
            WHERE platform = 'google' AND month = '${monthStart}'::date
          )
          SELECT
            c.campaign_id::text AS campaign_id,
            c.name AS name,
            c.status AS status,
            COALESCE(c.budget_amount_micros::numeric / 1000000, 0)::float AS daily_budget_atual,
            COALESCE(s.cost_sum / 1000000, 0)::float AS investido_total,
            COALESCE(rs.recent_cost_sum / 1000000, 0)::float AS recent_spend
          FROM google.campaigns c
          LEFT JOIN spend_agg s ON s.campaign_id = c.campaign_id
          LEFT JOIN recent_spend_agg rs ON rs.campaign_id = c.campaign_id
          WHERE c.status = 'ENABLED'
             OR COALESCE(s.cost_sum, 0) > 0
             OR c.campaign_id::text IN (SELECT campaign_id FROM metas_google)
          ORDER BY c.name;
        `));
        googleRows = googleRes.rows || [];
      }

      // ===== TikTok Ads =====
      // Schema tiktok.* pode não existir ou o role não ter permissão (degrada sem
      // quebrar Meta/Google). Orçamento diário (espelha CBO/ABO do Meta):
      // - CBO: budget no nível campanha quando budget_mode é diário.
      // - ABO: soma o budget dos ad groups ATIVOS com budget_mode diário.
      // Modos diários do TikTok: BUDGET_MODE_DAY e BUDGET_MODE_DYNAMIC_DAILY_BUDGET
      // (este último é o usado pela maioria dos conjuntos ativos). BUDGET_MODE_TOTAL
      // (lifetime) e BUDGET_MODE_INFINITE (sem teto) não contam como diário.
      let tiktokRows: any[] = [];
      try {
        const r = await db.execute(sql`
          WITH campaign_budget AS (
            SELECT
              c.campaign_id,
              c.campaign_name,
              c.operation_status,
              CASE
                WHEN c.budget_mode IN ('BUDGET_MODE_DAY', 'BUDGET_MODE_DYNAMIC_DAILY_BUDGET')
                     AND COALESCE(c.budget, 0) > 0
                  THEN c.budget
                ELSE (
                  SELECT COALESCE(SUM(g.budget), 0)
                  FROM tiktok.ad_groups g
                  WHERE g.campaign_id = c.campaign_id
                    AND g.operation_status = 'ENABLE'
                    AND g.budget_mode IN ('BUDGET_MODE_DAY', 'BUDGET_MODE_DYNAMIC_DAILY_BUDGET')
                )
              END::float AS daily_budget_atual
            FROM tiktok.ad_campaigns c
            WHERE c.advertiser_id = ${TURBO_PARTNERS_TIKTOK_ADVERTISER_ID}
          ),
          spend_agg AS (
            SELECT campaign_id, SUM(spend)::float AS investido_total
            FROM tiktok.ad_metrics_daily
            WHERE stat_date BETWEEN ${firstDay}::date AND ${lastDay}::date
            GROUP BY campaign_id
          ),
          recent_spend_agg AS (
            SELECT campaign_id, SUM(spend)::float AS recent_spend
            FROM tiktok.ad_metrics_daily
            WHERE stat_date >= (CURRENT_DATE - INTERVAL '3 days') AND stat_date <= CURRENT_DATE
            GROUP BY campaign_id
          ),
          tags AS (SELECT campaign_id FROM cortex_core.campaign_tags WHERE platform = 'tiktok')
          SELECT
            cb.campaign_id::text AS campaign_id,
            cb.campaign_name AS name,
            cb.operation_status AS status,
            COALESCE(cb.daily_budget_atual, 0)::float AS daily_budget_atual,
            COALESCE(s.investido_total, 0)::float AS investido_total,
            COALESCE(rs.recent_spend, 0)::float AS recent_spend
          FROM campaign_budget cb
          LEFT JOIN spend_agg s ON s.campaign_id = cb.campaign_id
          LEFT JOIN recent_spend_agg rs ON rs.campaign_id = cb.campaign_id
          WHERE cb.operation_status = 'ENABLE'
             OR COALESCE(s.investido_total, 0) > 0
             OR cb.campaign_id::text IN (SELECT campaign_id FROM tags)
          ORDER BY cb.campaign_name
        `);
        tiktokRows = r.rows || [];
      } catch (e: any) {
        console.warn("[orcamento] TikTok indisponível (schema/permissão):", e?.message);
      }

      // ===== LinkedIn Ads =====
      // ad_campaigns não tem orçamento diário no schema → daily_budget_atual = 0
      // (mostra investido/projeção pelo gasto, sem extrapolar orçamento).
      let linkedinRows: any[] = [];
      try {
        const r = await db.execute(sql`
          WITH spend_agg AS (
            SELECT campaign_id, SUM(spend)::float AS investido_total
            FROM linkedin.ad_metrics_daily
            WHERE stat_date BETWEEN ${firstDay}::date AND ${lastDay}::date
            GROUP BY campaign_id
          ),
          recent_spend_agg AS (
            SELECT campaign_id, SUM(spend)::float AS recent_spend
            FROM linkedin.ad_metrics_daily
            WHERE stat_date >= (CURRENT_DATE - INTERVAL '3 days') AND stat_date <= CURRENT_DATE
            GROUP BY campaign_id
          ),
          tags AS (SELECT campaign_id FROM cortex_core.campaign_tags WHERE platform = 'linkedin')
          SELECT
            c.campaign_id::text AS campaign_id,
            c.campaign_name AS name,
            c.status AS status,
            0::float AS daily_budget_atual,
            COALESCE(s.investido_total, 0)::float AS investido_total,
            COALESCE(rs.recent_spend, 0)::float AS recent_spend
          FROM linkedin.ad_campaigns c
          LEFT JOIN spend_agg s ON s.campaign_id = c.campaign_id
          LEFT JOIN recent_spend_agg rs ON rs.campaign_id = c.campaign_id
          WHERE c.status = 'ACTIVE'
             OR COALESCE(s.investido_total, 0) > 0
             OR c.campaign_id::text IN (SELECT campaign_id FROM tags)
          ORDER BY c.campaign_name
        `);
        linkedinRows = r.rows || [];
      } catch (e: any) {
        console.warn("[orcamento] LinkedIn indisponível (schema/permissão):", e?.message);
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

      // ===== Classificação por campanha (tag/pool + etapa + produto), estável entre meses =====
      const tagsRes = await db.execute(sql`
        SELECT platform, campaign_id, tag, stage, produto FROM cortex_core.campaign_tags
      `);
      const tagsMap = new Map<string, CampaignTag>();
      const stagesMap = new Map<string, CampaignStage>();
      const produtosMap = new Map<string, CampaignProduct>();
      for (const r of tagsRes.rows || []) {
        const key = `${r.platform}:${r.campaign_id}`;
        if (r.tag && (CAMPAIGN_TAGS as readonly string[]).includes(r.tag)) {
          tagsMap.set(key, r.tag as CampaignTag);
        }
        if (r.stage && (CAMPAIGN_STAGES as readonly string[]).includes(r.stage)) {
          stagesMap.set(key, r.stage as CampaignStage);
        }
        if (r.produto && (CAMPAIGN_PRODUCTS as readonly string[]).includes(r.produto)) {
          produtosMap.set(key, r.produto as CampaignProduct);
        }
      }

      // ===== Plano de orçamento por pool/mês (total) + árvore de metas por nível =====
      // As 3 leituras abaixo são independentes entre si — em paralelo.
      const [poolTotalsRes, planNodesRes, campaignTargetsRes] = await Promise.all([
        db.execute(sql`
          SELECT pool, total::float AS total FROM cortex_core.budget_pool_plan
          WHERE month = ${monthStart}::date
        `),
        // Linhas cruas da árvore — o client resolve % do pai/soma (resolvePlanTree),
        // igual hoje deriveStageTarget já roda só no front.
        db.execute(sql`
          SELECT pool, level_type, level_key, parent_key, value::float AS value, unit
          FROM cortex_core.budget_plan_node
          WHERE month = ${monthStart}::date
        `),
        // Metas travadas por campanha individual (esparso — só campanhas classificadas).
        db.execute(sql`
          SELECT pool, platform, campaign_id, value::float AS value, unit
          FROM cortex_core.campaign_budget_target
          WHERE month = ${monthStart}::date
        `),
      ]);

      const plans: Record<string, PoolPlan> = {};
      for (const tag of CAMPAIGN_TAGS) plans[tag] = { total: null };
      for (const r of poolTotalsRes.rows || []) {
        if (plans[r.pool]) plans[r.pool].total = Number(r.total);
      }

      const planNodes: PlanNode[] = (planNodesRes.rows || [])
        .filter((r: any) => (CAMPAIGN_TAGS as readonly string[]).includes(r.pool) && (LEVEL_TYPES as readonly string[]).includes(r.level_type))
        .map((r: any) => ({
          pool: r.pool as CampaignTag,
          levelType: r.level_type as LevelType,
          levelKey: r.level_key as string,
          parentKey: r.parent_key ?? "",
          value: Number(r.value),
          unit: r.unit === "brl" ? "brl" : "pct",
        }));

      const campaignTargets: CampaignTargetRow[] = (campaignTargetsRes.rows || [])
        .filter((r: any) => (CAMPAIGN_TAGS as readonly string[]).includes(r.pool))
        .map((r: any) => ({
          pool: r.pool as CampaignTag,
          platform: r.platform as Platform,
          campaignId: String(r.campaign_id),
          value: Number(r.value),
          unit: r.unit === "brl" ? "brl" : "pct",
        }));

      const buildRow = (platform: Platform, row: any): CampanhaRow => {
        const campaignId = String(row.campaign_id);
        const dailyBudgetAtual = Number(row.daily_budget_atual) || 0;
        const investidoTotal = Number(row.investido_total) || 0;
        const recentSpend = Number(row.recent_spend) || 0;
        const investimentoMensalMeta = metasMap.get(`${platform}:${campaignId}`) ?? null;
        // Só projeta gasto futuro se a campanha está ativa E houve entrega real
        // nos últimos 3 dias INCLUINDO hoje (status ACTIVE/ENABLED por si só não
        // garante delivery — ex: ABO ativa sem nenhum adset rodando. Incluir hoje
        // faz campanhas recém-criadas que já gastaram hoje entrarem na projeção).
        const isActiveStatus = ACTIVE_STATUSES.has(String(row.status || "").toUpperCase());
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
          isActive: isActiveStatus,
          dailyBudgetAtual,
          investidoTotal,
          investimentoMensalMeta,
          orcamentoDiarioMeta,
          projecaoAsIs,
          isDelivering,
          tag: tagsMap.get(`${platform}:${campaignId}`) ?? null,
          stage: stagesMap.get(`${platform}:${campaignId}`) ?? null,
          produto: produtosMap.get(`${platform}:${campaignId}`) ?? null,
        };
      };

      const campanhas: CampanhaRow[] = [
        ...((metaRes.rows || []) as any[]).map((r) => buildRow("meta", r)),
        ...(googleRows as any[]).map((r) => buildRow("google", r)),
        ...(tiktokRows as any[]).map((r) => buildRow("tiktok", r)),
        ...(linkedinRows as any[]).map((r) => buildRow("linkedin", r)),
      ];

      res.json({
        month: `${year}-${String(month1Based).padStart(2, "0")}`,
        firstDay,
        lastDay,
        diasTotal,
        diasDecorridos,
        diasRestantes,
        campanhas,
        plans,
        planNodes,
        campaignTargets,
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

  // Upsert/remoção da tag (grupo) de uma campanha. tag = null limpa a classificação.
  app.put("/api/growth/orcamento-campanhas/tag", async (req, res) => {
    try {
      const userEmail = (req.user as any)?.email as string | undefined;
      if (!userEmail || !ALLOWED_EDITOR_EMAILS.has(userEmail)) {
        return res.status(403).json({ error: "Apenas editores autorizados podem alterar tags." });
      }
      const { platform, campaignId, tag } = req.body || {};
      if (!(PLATFORMS as readonly string[]).includes(platform)) {
        return res.status(400).json({ error: `platform must be one of: ${PLATFORMS.join(", ")}` });
      }
      if (!campaignId || typeof campaignId !== "string") {
        return res.status(400).json({ error: "campaignId is required" });
      }
      // tag null/"" => remove; senão precisa ser uma tag válida.
      const isClearing = tag === null || tag === undefined || tag === "";
      if (!isClearing && !(CAMPAIGN_TAGS as readonly string[]).includes(tag)) {
        return res.status(400).json({ error: `tag must be one of: ${CAMPAIGN_TAGS.join(", ")} (or null to clear)` });
      }

      if (isClearing) {
        // Zera só a tag, preservando stage/produto; remove a linha se ficar tudo vazio.
        await db.execute(sql`
          UPDATE cortex_core.campaign_tags SET tag = NULL, updated_by = ${userEmail}, updated_at = NOW()
          WHERE platform = ${platform} AND campaign_id = ${campaignId}
        `);
        await deleteCampaignTagsRowIfEmpty(db, platform, campaignId);
        // Sem pool, meta travada por campanha (campaign_budget_target é
        // keyed por pool) não tem mais dono — remove pra não sobrar órfã.
        await db.execute(sql`
          DELETE FROM cortex_core.campaign_budget_target
          WHERE platform = ${platform} AND campaign_id = ${campaignId}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO cortex_core.campaign_tags (platform, campaign_id, tag, updated_by)
          VALUES (${platform}, ${campaignId}, ${tag}, ${userEmail})
          ON CONFLICT (platform, campaign_id) DO UPDATE SET
            tag = EXCLUDED.tag,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `);
        // Campanha mudou de pool: qualquer meta travada no pool antigo fica
        // órfã (some da tela e pode reaparecer se a campanha voltar pro pool
        // antigo depois) — remove pra não carregar dado desatualizado junto.
        await db.execute(sql`
          DELETE FROM cortex_core.campaign_budget_target
          WHERE platform = ${platform} AND campaign_id = ${campaignId} AND pool != ${tag}
        `);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error upserting orcamento-campanhas tag:", error);
      res.status(500).json({ error: "Failed to save tag" });
    }
  });

  // Upsert/remoção da etapa (stage) de uma campanha. stage = null limpa.
  app.put("/api/growth/orcamento-campanhas/stage", async (req, res) => {
    try {
      const userEmail = (req.user as any)?.email as string | undefined;
      if (!userEmail || !ALLOWED_EDITOR_EMAILS.has(userEmail)) {
        return res.status(403).json({ error: "Apenas editores autorizados podem alterar etapas." });
      }
      const { platform, campaignId, stage } = req.body || {};
      if (!(PLATFORMS as readonly string[]).includes(platform)) {
        return res.status(400).json({ error: `platform must be one of: ${PLATFORMS.join(", ")}` });
      }
      if (!campaignId || typeof campaignId !== "string") {
        return res.status(400).json({ error: "campaignId is required" });
      }
      const isClearing = stage === null || stage === undefined || stage === "";
      if (!isClearing && !(CAMPAIGN_STAGES as readonly string[]).includes(stage)) {
        return res.status(400).json({ error: `stage must be one of: ${CAMPAIGN_STAGES.join(", ")} (or null to clear)` });
      }

      if (isClearing) {
        await db.execute(sql`
          UPDATE cortex_core.campaign_tags SET stage = NULL, updated_by = ${userEmail}, updated_at = NOW()
          WHERE platform = ${platform} AND campaign_id = ${campaignId}
        `);
        await deleteCampaignTagsRowIfEmpty(db, platform, campaignId);
      } else {
        await db.execute(sql`
          INSERT INTO cortex_core.campaign_tags (platform, campaign_id, stage, updated_by)
          VALUES (${platform}, ${campaignId}, ${stage}, ${userEmail})
          ON CONFLICT (platform, campaign_id) DO UPDATE SET
            stage = EXCLUDED.stage,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error upserting orcamento-campanhas stage:", error);
      res.status(500).json({ error: "Failed to save stage" });
    }
  });

  // Upsert/remoção do produto de uma campanha. produto = null limpa.
  app.put("/api/growth/orcamento-campanhas/produto", async (req, res) => {
    try {
      const userEmail = (req.user as any)?.email as string | undefined;
      if (!userEmail || !ALLOWED_EDITOR_EMAILS.has(userEmail)) {
        return res.status(403).json({ error: "Apenas editores autorizados podem alterar produtos." });
      }
      const { platform, campaignId, produto } = req.body || {};
      if (!(PLATFORMS as readonly string[]).includes(platform)) {
        return res.status(400).json({ error: `platform must be one of: ${PLATFORMS.join(", ")}` });
      }
      if (!campaignId || typeof campaignId !== "string") {
        return res.status(400).json({ error: "campaignId is required" });
      }
      const isClearing = produto === null || produto === undefined || produto === "";
      if (!isClearing && !(CAMPAIGN_PRODUCTS as readonly string[]).includes(produto)) {
        return res.status(400).json({ error: `produto must be one of: ${CAMPAIGN_PRODUCTS.join(", ")} (or null to clear)` });
      }

      if (isClearing) {
        await db.execute(sql`
          UPDATE cortex_core.campaign_tags SET produto = NULL, updated_by = ${userEmail}, updated_at = NOW()
          WHERE platform = ${platform} AND campaign_id = ${campaignId}
        `);
        await deleteCampaignTagsRowIfEmpty(db, platform, campaignId);
      } else {
        await db.execute(sql`
          INSERT INTO cortex_core.campaign_tags (platform, campaign_id, produto, updated_by)
          VALUES (${platform}, ${campaignId}, ${produto}, ${userEmail})
          ON CONFLICT (platform, campaign_id) DO UPDATE SET
            produto = EXCLUDED.produto,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error upserting orcamento-campanhas produto:", error);
      res.status(500).json({ error: "Failed to save produto" });
    }
  });

  // Upsert/remoção do total mensal de um pool. total = 0/null remove.
  app.put("/api/growth/orcamento-campanhas/plan/total", async (req, res) => {
    try {
      const userEmail = (req.user as any)?.email as string | undefined;
      if (!userEmail || !ALLOWED_EDITOR_EMAILS.has(userEmail)) {
        return res.status(403).json({ error: "Apenas editores autorizados podem alterar o plano." });
      }
      const { pool, month, total } = req.body || {};
      if (!(CAMPAIGN_TAGS as readonly string[]).includes(pool)) {
        return res.status(400).json({ error: `pool must be one of: ${CAMPAIGN_TAGS.join(", ")}` });
      }
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: "month must be 'YYYY-MM'" });
      }
      const value = Number(total);
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ error: "total must be a non-negative number" });
      }
      const monthDate = `${month}-01`;

      if (value === 0) {
        await db.execute(sql`
          DELETE FROM cortex_core.budget_pool_plan
          WHERE pool = ${pool} AND month = ${monthDate}::date
        `);
      } else {
        await db.execute(sql`
          INSERT INTO cortex_core.budget_pool_plan (pool, month, total, updated_by)
          VALUES (${pool}, ${monthDate}::date, ${value}, ${userEmail})
          ON CONFLICT (pool, month) DO UPDATE SET
            total = EXCLUDED.total, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        `);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error upserting pool total:", error);
      res.status(500).json({ error: "Failed to save pool total" });
    }
  });

  // Upsert/remoção do alvo de um nó da árvore (stage/product/platform).
  // value = 0/null remove. parentKey encadeia a ancestralidade ("" = raiz,
  // pai é o total do pool). levelKey é validado contra o enum do respectivo
  // nível (mesma disciplina de /tag, /stage, /produto).
  app.put("/api/growth/orcamento-campanhas/plan/node", async (req, res) => {
    try {
      const userEmail = (req.user as any)?.email as string | undefined;
      if (!userEmail || !ALLOWED_EDITOR_EMAILS.has(userEmail)) {
        return res.status(403).json({ error: "Apenas editores autorizados podem alterar o plano." });
      }
      const { pool, month, levelType, levelKey, parentKey, value, unit } = req.body || {};
      if (!(CAMPAIGN_TAGS as readonly string[]).includes(pool)) {
        return res.status(400).json({ error: `pool must be one of: ${CAMPAIGN_TAGS.join(", ")}` });
      }
      if (!(LEVEL_TYPES as readonly string[]).includes(levelType)) {
        return res.status(400).json({ error: `levelType must be one of: ${LEVEL_TYPES.join(", ")}` });
      }
      const levelKeyEnum: Record<LevelType, readonly string[]> = {
        stage: CAMPAIGN_STAGES,
        product: CAMPAIGN_PRODUCTS,
        platform: PLATFORMS,
      };
      if (!levelKeyEnum[levelType as LevelType].includes(levelKey)) {
        return res.status(400).json({ error: `levelKey for ${levelType} must be one of: ${levelKeyEnum[levelType as LevelType].join(", ")}` });
      }
      if (typeof parentKey !== "string" || !isValidParentKey(levelType as LevelType, parentKey)) {
        return res.status(400).json({ error: `parentKey is not a valid ancestor path for levelType '${levelType}'` });
      }
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: "month must be 'YYYY-MM'" });
      }
      if (unit !== "pct" && unit !== "brl") {
        return res.status(400).json({ error: "unit must be 'pct' or 'brl'" });
      }
      const v = Number(value);
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ error: "value must be a non-negative number" });
      }
      const monthDate = `${month}-01`;

      if (v === 0) {
        await db.execute(sql`
          DELETE FROM cortex_core.budget_plan_node
          WHERE pool = ${pool} AND month = ${monthDate}::date
            AND level_type = ${levelType} AND level_key = ${levelKey} AND parent_key = ${parentKey}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO cortex_core.budget_plan_node (pool, month, level_type, level_key, parent_key, value, unit, updated_by)
          VALUES (${pool}, ${monthDate}::date, ${levelType}, ${levelKey}, ${parentKey}, ${v}, ${unit}, ${userEmail})
          ON CONFLICT (pool, month, level_type, level_key, parent_key) DO UPDATE SET
            value = EXCLUDED.value, unit = EXCLUDED.unit, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        `);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error upserting plan node:", error);
      res.status(500).json({ error: "Failed to save plan node" });
    }
  });

  // Upsert/remoção da meta travada de uma campanha individual (qualquer
  // plataforma, inclusive TikTok/LinkedIn). value = 0/null remove.
  app.put("/api/growth/orcamento-campanhas/plan/campaign", async (req, res) => {
    try {
      const userEmail = (req.user as any)?.email as string | undefined;
      if (!userEmail || !ALLOWED_EDITOR_EMAILS.has(userEmail)) {
        return res.status(403).json({ error: "Apenas editores autorizados podem alterar o plano." });
      }
      const { pool, month, platform, campaignId, value, unit } = req.body || {};
      if (!(CAMPAIGN_TAGS as readonly string[]).includes(pool)) {
        return res.status(400).json({ error: `pool must be one of: ${CAMPAIGN_TAGS.join(", ")}` });
      }
      if (!(PLATFORMS as readonly string[]).includes(platform)) {
        return res.status(400).json({ error: `platform must be one of: ${PLATFORMS.join(", ")}` });
      }
      if (!campaignId || typeof campaignId !== "string") {
        return res.status(400).json({ error: "campaignId is required" });
      }
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: "month must be 'YYYY-MM'" });
      }
      if (unit !== "pct" && unit !== "brl") {
        return res.status(400).json({ error: "unit must be 'pct' or 'brl'" });
      }
      const v = Number(value);
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ error: "value must be a non-negative number" });
      }
      const monthDate = `${month}-01`;

      if (v === 0) {
        await db.execute(sql`
          DELETE FROM cortex_core.campaign_budget_target
          WHERE pool = ${pool} AND month = ${monthDate}::date AND platform = ${platform} AND campaign_id = ${campaignId}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO cortex_core.campaign_budget_target (pool, month, platform, campaign_id, value, unit, updated_by)
          VALUES (${pool}, ${monthDate}::date, ${platform}, ${campaignId}, ${v}, ${unit}, ${userEmail})
          ON CONFLICT (pool, month, platform, campaign_id) DO UPDATE SET
            value = EXCLUDED.value, unit = EXCLUDED.unit, updated_by = EXCLUDED.updated_by, updated_at = NOW()
        `);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error upserting campaign budget target:", error);
      res.status(500).json({ error: "Failed to save campaign budget target" });
    }
  });
}

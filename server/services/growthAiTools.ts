import { sql } from "drizzle-orm";

// Account ID interno da Turbo Partners
const TURBO_PARTNERS_ACCOUNT_ID = "act_1331413260627780";

// ── Tool Definitions (OpenAI function calling format) ────────────────────────

export const GROWTH_AI_TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "getAdsMetrics",
      description:
        "Retorna métricas de Meta Ads (investimento, impressões, cliques, CPM, CTR, CPC) do período. Pode agrupar por total, campanha ou dia. Pode filtrar por funil (nome da campanha contém o termo).",
      parameters: {
        type: "object" as const,
        properties: {
          startDate: { type: "string", description: "Data início YYYY-MM-DD" },
          endDate: { type: "string", description: "Data fim YYYY-MM-DD" },
          funil: {
            type: "string",
            description:
              "Filtrar campanhas cujo nome contenha este termo (ex: Comercial, Creators, Ecommerce)",
          },
          groupBy: {
            type: "string",
            enum: ["total", "campaign", "day"],
            description: "Agrupar por: total (padrão), campaign ou day",
          },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDealsMetrics",
      description:
        "Retorna métricas do Bitrix CRM: total de leads, reuniões agendadas, reuniões realizadas, negócios ganhos, faturamento recorrente e pontual. Pode filtrar por funil NGC e por MQL.",
      parameters: {
        type: "object" as const,
        properties: {
          startDate: { type: "string", description: "Data início YYYY-MM-DD" },
          endDate: { type: "string", description: "Data fim YYYY-MM-DD" },
          funil: {
            type: "string",
            description: "Filtrar por funil NGC do Bitrix (ex: Comercial, Creators, Ecommerce)",
          },
          mql: {
            type: "boolean",
            description: "Se true, filtra apenas leads MQL (inbound qualificado)",
          },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getBudgets",
      description:
        "Retorna metas orçamentárias (budgets) por mês e segmento (mql, nao_mql, ads). Pode filtrar por funil.",
      parameters: {
        type: "object" as const,
        properties: {
          startDate: { type: "string", description: "Data início YYYY-MM-DD" },
          endDate: { type: "string", description: "Data fim YYYY-MM-DD" },
          funil: {
            type: "string",
            description: "Filtrar por funil (ex: Comercial, Creators)",
          },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getCampaignRanking",
      description:
        "Retorna ranking de campanhas Meta Ads ordenadas por uma métrica específica (spend, cpc, ctr, impressions, clicks, cpm).",
      parameters: {
        type: "object" as const,
        properties: {
          startDate: { type: "string", description: "Data início YYYY-MM-DD" },
          endDate: { type: "string", description: "Data fim YYYY-MM-DD" },
          metric: {
            type: "string",
            enum: ["spend", "cpc", "ctr", "impressions", "clicks", "cpm"],
            description: "Métrica para ordenar o ranking",
          },
          order: {
            type: "string",
            enum: ["asc", "desc"],
            description: "Ordem: desc (padrão) ou asc",
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (padrão 10)",
          },
        },
        required: ["startDate", "endDate", "metric"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getHealthCheck",
      description:
        "Visão geral de saúde do Growth: combina ads, deals, top campanhas e comparativo com período anterior. Use para diagnósticos rápidos.",
      parameters: {
        type: "object" as const,
        properties: {
          startDate: { type: "string", description: "Data início YYYY-MM-DD" },
          endDate: { type: "string", description: "Data fim YYYY-MM-DD" },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  // ── Criativos Agent (propose-only) — gravam propostas em cortex_core.meta_actions_log,
  //    NÃO executam nenhuma ação na Meta API. A execução é feita pelo admin humano
  //    via /api/meta/actions/* depois de aprovar a proposta.
  {
    type: "function",
    function: {
      name: "proposePauseEntity",
      description:
        "Cria uma PROPOSTA de pausar um ad/adset/campaign no Meta Ads. NÃO pausa de fato — só registra a proposta em meta_actions_log para um admin humano revisar e confirmar. Use quando identificar criativo com performance ruim comprovada (≥7 dias de dados). O rationale deve citar spend, leads, deals ganhos, CAC, período analisado e meta de referência.",
      parameters: {
        type: "object" as const,
        properties: {
          level: { type: "string", enum: ["ad", "adset", "campaign"], description: "Nível da entidade" },
          entityId: { type: "string", description: "ID da entidade na Meta (ad_id, adset_id ou campaign_id)" },
          entityName: { type: "string", description: "Nome da entidade para facilitar a revisão humana" },
          rationale: { type: "string", description: "Justificativa detalhada: spend, leads, deals, CAC, período, meta — mínimo 40 chars" },
        },
        required: ["level", "entityId", "rationale"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeResumeEntity",
      description:
        "Cria uma PROPOSTA de reativar um ad/adset/campaign pausado no Meta Ads. NÃO reativa de fato — só registra a proposta em meta_actions_log para um admin revisar. Use quando houver evidência nova de que o criativo merece segunda chance.",
      parameters: {
        type: "object" as const,
        properties: {
          level: { type: "string", enum: ["ad", "adset", "campaign"], description: "Nível da entidade" },
          entityId: { type: "string", description: "ID da entidade na Meta" },
          entityName: { type: "string", description: "Nome da entidade" },
          rationale: { type: "string", description: "Justificativa — mínimo 40 chars" },
        },
        required: ["level", "entityId", "rationale"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeBudgetChange",
      description:
        "Cria uma PROPOSTA de ajustar o daily budget de um adset ou campaign no Meta Ads. NÃO aplica de fato. Guard-rails do sistema: delta máximo ±30% do valor atual, e teto absoluto em cents (META_ADS_MAX_DAILY_BUDGET_CENTS). Para aumentos, só propor quando houver ROAS ≥ 1.5x a meta por ≥ 14 dias.",
      parameters: {
        type: "object" as const,
        properties: {
          level: { type: "string", enum: ["adset", "campaign"], description: "Nível da entidade (ad não tem daily_budget próprio)" },
          entityId: { type: "string", description: "ID da entidade na Meta" },
          entityName: { type: "string", description: "Nome da entidade" },
          newDailyBudgetCents: { type: "number", description: "Novo daily budget em cents (ex: 50000 = R$ 500,00)" },
          rationale: { type: "string", description: "Justificativa — mínimo 40 chars, citando ROAS, período e meta" },
        },
        required: ["level", "entityId", "newDailyBudgetCents", "rationale"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getCriativoTimeSeries",
      description:
        "Retorna série temporal diária de um ad específico (spend, impressões, cliques, CPM, CTR, CPC) nos últimos N dias. Use para analisar tendência de um criativo antes de propor pause/resume. Regra: só propor pause se houver ≥7 dias de dados consecutivos.",
      parameters: {
        type: "object" as const,
        properties: {
          adId: { type: "string", description: "Meta ad_id" },
          days: { type: "number", description: "Janela de dias (padrão 14, máx 60)" },
        },
        required: ["adId"],
      },
    },
  },
];

// ── Tool Execution ──────────────────────────────────────────────────────────

async function getAdsMetrics(
  db: any,
  input: { startDate: string; endDate: string; funil?: string; groupBy?: string }
): Promise<string> {
  const { startDate, endDate, funil, groupBy = "total" } = input;

  const funilFilter = funil
    ? sql`AND LOWER(c.campaign_name) LIKE ${"%" + funil.toLowerCase() + "%"}`
    : sql``;

  if (groupBy === "campaign") {
    const result = await db.execute(sql`
      SELECT
        c.campaign_name,
        COALESCE(SUM(i.spend::numeric), 0) as spend,
        COALESCE(SUM(i.impressions), 0) as impressions,
        COALESCE(SUM(i.clicks), 0) as clicks,
        CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.impressions) * 1000, 2) ELSE 0 END as cpm,
        CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.clicks)::numeric / SUM(i.impressions) * 100, 2) ELSE 0 END as ctr,
        CASE WHEN SUM(i.clicks) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.clicks), 2) ELSE 0 END as cpc
      FROM meta_ads.meta_insights_daily i
      JOIN meta_ads.meta_campaigns c ON i.campaign_id = c.campaign_id
      WHERE i.date_start >= ${startDate}::date
        AND i.date_start <= ${endDate}::date
        AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        ${funilFilter}
      GROUP BY c.campaign_name
      ORDER BY SUM(i.spend::numeric) DESC
    `);
    return JSON.stringify({ groupBy: "campaign", data: result.rows });
  }

  if (groupBy === "day") {
    const result = await db.execute(sql`
      SELECT
        i.date_start as date,
        COALESCE(SUM(i.spend::numeric), 0) as spend,
        COALESCE(SUM(i.impressions), 0) as impressions,
        COALESCE(SUM(i.clicks), 0) as clicks,
        CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.impressions) * 1000, 2) ELSE 0 END as cpm,
        CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.clicks)::numeric / SUM(i.impressions) * 100, 2) ELSE 0 END as ctr,
        CASE WHEN SUM(i.clicks) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.clicks), 2) ELSE 0 END as cpc
      FROM meta_ads.meta_insights_daily i
      JOIN meta_ads.meta_campaigns c ON i.campaign_id = c.campaign_id
      WHERE i.date_start >= ${startDate}::date
        AND i.date_start <= ${endDate}::date
        AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
        ${funilFilter}
      GROUP BY i.date_start
      ORDER BY i.date_start
    `);
    return JSON.stringify({ groupBy: "day", data: result.rows });
  }

  // Default: total
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(i.spend::numeric), 0) as spend,
      COALESCE(SUM(i.impressions), 0) as impressions,
      COALESCE(SUM(i.clicks), 0) as clicks,
      CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.impressions) * 1000, 2) ELSE 0 END as cpm,
      CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.clicks)::numeric / SUM(i.impressions) * 100, 2) ELSE 0 END as ctr,
      CASE WHEN SUM(i.clicks) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.clicks), 2) ELSE 0 END as cpc
    FROM meta_ads.meta_insights_daily i
    JOIN meta_ads.meta_campaigns c ON i.campaign_id = c.campaign_id
    WHERE i.date_start >= ${startDate}::date
      AND i.date_start <= ${endDate}::date
      AND i.account_id = ${TURBO_PARTNERS_ACCOUNT_ID}
      ${funilFilter}
  `);
  return JSON.stringify({ groupBy: "total", data: result.rows[0] || {} });
}

async function getDealsMetrics(
  db: any,
  input: { startDate: string; endDate: string; funil?: string; mql?: boolean }
): Promise<string> {
  const { startDate, endDate, funil, mql } = input;

  const funilFilter = funil ? sql`AND d.fnl_ngc = ${funil}` : sql``;
  const mqlFilter = mql
    ? sql`AND (d.mql::text = '1' OR LOWER(d.mql::text) = 'true')`
    : sql``;

  // Stages that indicate reunião agendada (or later)
  const rmStages = [
    "Reunião agendada",
    "Reunião marcada",
    "RM - Reunião Marcada",
    "Agendamento direto",
    "Reunião Marcada",
    "RM",
    "Agendado",
    "Reunião Realizada",
    "RR",
    "Realizado",
    "Negócio Ganho",
  ];

  // Stages that indicate reunião realizada (or later)
  const rrStages = [
    "Reunião realizada",
    "RR - Reunião Realizada",
    "Reunião Realizada",
    "RR",
    "Realizado",
    "Negócio Ganho",
  ];

  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total_leads,
      SUM(CASE WHEN d.stage_name IN (${sql.join(
        rmStages.map((s) => sql`${s}`),
        sql`, `
      )}) THEN 1 ELSE 0 END) as reunioes_agendadas,
      SUM(CASE WHEN d.stage_name IN (${sql.join(
        rrStages.map((s) => sql`${s}`),
        sql`, `
      )}) THEN 1 ELSE 0 END) as reunioes_realizadas,
      SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as negocios_ganhos,
      SUM(CASE WHEN d.stage_name = 'Negócio Perdido' THEN 1 ELSE 0 END) as negocios_perdidos,
      COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_recorrente ELSE 0 END), 0) as faturamento_recorrente,
      COALESCE(SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN d.valor_pontual ELSE 0 END), 0) as faturamento_pontual
    FROM "Bitrix".crm_deal d
    WHERE d.created_at >= ${startDate}::date
      AND d.created_at <= ${endDate}::date + INTERVAL '1 day'
      ${funilFilter}
      ${mqlFilter}
  `);

  const row = (result.rows[0] as any) || {};

  // Also get breakdown by funil if no specific funil filter
  let funilBreakdown: any[] = [];
  if (!funil) {
    const funilResult = await db.execute(sql`
      SELECT
        COALESCE(NULLIF(TRIM(d.fnl_ngc), ''), 'Sem funil') as funil,
        COUNT(*) as leads,
        SUM(CASE WHEN d.stage_name = 'Negócio Ganho' THEN 1 ELSE 0 END) as ganhos
      FROM "Bitrix".crm_deal d
      WHERE d.created_at >= ${startDate}::date
        AND d.created_at <= ${endDate}::date + INTERVAL '1 day'
        ${mqlFilter}
      GROUP BY COALESCE(NULLIF(TRIM(d.fnl_ngc), ''), 'Sem funil')
      ORDER BY COUNT(*) DESC
    `);
    funilBreakdown = funilResult.rows as any[];
  }

  return JSON.stringify({
    periodo: { startDate, endDate },
    filtros: { funil: funil || "todos", mql: mql || false },
    totais: {
      leads: parseInt(row.total_leads) || 0,
      reunioesAgendadas: parseInt(row.reunioes_agendadas) || 0,
      reunioesRealizadas: parseInt(row.reunioes_realizadas) || 0,
      negociosGanhos: parseInt(row.negocios_ganhos) || 0,
      negociosPerdidos: parseInt(row.negocios_perdidos) || 0,
      faturamentoRecorrente: parseFloat(row.faturamento_recorrente) || 0,
      faturamentoPontual: parseFloat(row.faturamento_pontual) || 0,
    },
    ...(funilBreakdown.length > 0 ? { porFunil: funilBreakdown } : {}),
  });
}

async function getBudgets(
  db: any,
  input: { startDate: string; endDate: string; funil?: string }
): Promise<string> {
  const { startDate, endDate, funil } = input;

  // Extract months between startDate and endDate (YYYY-MM format)
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const m = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    months.push(m);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  if (months.length === 0) {
    return JSON.stringify({ budgets: [], months: [] });
  }

  const funilFilter = funil ? sql`AND funil = ${funil}` : sql``;

  const result = await db.execute(sql`
    SELECT mes, segmento, funil, metricas
    FROM meta_ads.growth_budgets
    WHERE mes IN (${sql.join(
      months.map((m) => sql`${m}`),
      sql`, `
    )})
    ${funilFilter}
    ORDER BY mes, segmento
  `);

  return JSON.stringify({ months, budgets: result.rows });
}

async function getCampaignRanking(
  db: any,
  input: {
    startDate: string;
    endDate: string;
    metric: string;
    order?: string;
    limit?: number;
  }
): Promise<string> {
  const { startDate, endDate, metric, order = "desc", limit = 10 } = input;

  // Whitelist metrics to prevent SQL injection
  const metricMap: Record<string, string> = {
    spend: "SUM(i.spend::numeric)",
    cpc: "CASE WHEN SUM(i.clicks) > 0 THEN SUM(i.spend::numeric) / SUM(i.clicks) ELSE 0 END",
    ctr: "CASE WHEN SUM(i.impressions) > 0 THEN SUM(i.clicks)::numeric / SUM(i.impressions) * 100 ELSE 0 END",
    impressions: "SUM(i.impressions)",
    clicks: "SUM(i.clicks)",
    cpm: "CASE WHEN SUM(i.impressions) > 0 THEN SUM(i.spend::numeric) / SUM(i.impressions) * 1000 ELSE 0 END",
  };

  const metricExpr = metricMap[metric];
  if (!metricExpr) {
    return JSON.stringify({ error: `Métrica inválida: ${metric}. Use: ${Object.keys(metricMap).join(", ")}` });
  }

  const orderDir = order === "asc" ? "ASC" : "DESC";
  const safeLimit = Math.min(Math.max(1, limit), 50);

  const result = await db.execute(
    sql.raw(`
    SELECT
      c.campaign_name,
      COALESCE(SUM(i.spend::numeric), 0) as spend,
      COALESCE(SUM(i.impressions), 0) as impressions,
      COALESCE(SUM(i.clicks), 0) as clicks,
      CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.impressions) * 1000, 2) ELSE 0 END as cpm,
      CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.clicks)::numeric / SUM(i.impressions) * 100, 2) ELSE 0 END as ctr,
      CASE WHEN SUM(i.clicks) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.clicks), 2) ELSE 0 END as cpc
    FROM meta_ads.meta_insights_daily i
    JOIN meta_ads.meta_campaigns c ON i.campaign_id = c.campaign_id
    WHERE i.date_start >= '${startDate}'::date
      AND i.date_start <= '${endDate}'::date
      AND i.account_id = '${TURBO_PARTNERS_ACCOUNT_ID}'
    GROUP BY c.campaign_name
    HAVING SUM(i.spend::numeric) > 0
    ORDER BY ${metricExpr} ${orderDir}
    LIMIT ${safeLimit}
  `)
  );

  return JSON.stringify({
    metric,
    order: orderDir,
    ranking: result.rows,
  });
}

async function getHealthCheck(
  db: any,
  input: { startDate: string; endDate: string }
): Promise<string> {
  const { startDate, endDate } = input;

  // Calculate previous period (same duration, immediately before)
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000); // day before startDate
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  const prevStartStr = prevStart.toISOString().split("T")[0];
  const prevEndStr = prevEnd.toISOString().split("T")[0];

  // Run all in parallel
  const [adsCurrent, adsPrev, dealsCurrent, dealsPrev, topCampaigns] =
    await Promise.all([
      getAdsMetrics(db, { startDate, endDate }),
      getAdsMetrics(db, { startDate: prevStartStr, endDate: prevEndStr }),
      getDealsMetrics(db, { startDate, endDate }),
      getDealsMetrics(db, { startDate: prevStartStr, endDate: prevEndStr }),
      getCampaignRanking(db, { startDate, endDate, metric: "spend", limit: 5 }),
    ]);

  return JSON.stringify({
    periodoAtual: { startDate, endDate },
    periodoAnterior: { startDate: prevStartStr, endDate: prevEndStr },
    ads: {
      atual: JSON.parse(adsCurrent),
      anterior: JSON.parse(adsPrev),
    },
    deals: {
      atual: JSON.parse(dealsCurrent),
      anterior: JSON.parse(dealsPrev),
    },
    topCampaigns: JSON.parse(topCampaigns),
  });
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export async function executeGrowthTool(
  db: any,
  toolName: string,
  input: any
): Promise<string> {
  try {
    switch (toolName) {
      case "getAdsMetrics":
        return await getAdsMetrics(db, input);
      case "getDealsMetrics":
        return await getDealsMetrics(db, input);
      case "getBudgets":
        return await getBudgets(db, input);
      case "getCampaignRanking":
        return await getCampaignRanking(db, input);
      case "getHealthCheck":
        return await getHealthCheck(db, input);
      default:
        return JSON.stringify({ error: `Tool desconhecida: ${toolName}` });
    }
  } catch (error: any) {
    console.error(`[growth-ai] Erro ao executar tool ${toolName}:`, error);
    return JSON.stringify({
      error: `Erro ao executar ${toolName}: ${error.message}`,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Criativos Agent — tools adicionais (propose-only + time series)
// ═══════════════════════════════════════════════════════════════════════════

export interface CriativosAgentContext {
  userId: string | null;
  userEmail: string | null;
}

type AgentLevel = "ad" | "adset" | "campaign";

async function getCriativoTimeSeries(
  db: any,
  input: { adId: string; days?: number }
): Promise<string> {
  const adId = input.adId;
  const days = Math.min(Math.max(input.days ?? 14, 1), 60);

  const result = await db.execute(sql`
    SELECT
      i.date_start::text as date,
      COALESCE(SUM(i.spend::numeric), 0) as spend,
      COALESCE(SUM(i.impressions), 0) as impressions,
      COALESCE(SUM(i.clicks), 0) as clicks,
      CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.impressions) * 1000, 2) ELSE 0 END as cpm,
      CASE WHEN SUM(i.impressions) > 0 THEN ROUND(SUM(i.clicks)::numeric / SUM(i.impressions) * 100, 2) ELSE 0 END as ctr,
      CASE WHEN SUM(i.clicks) > 0 THEN ROUND(SUM(i.spend::numeric) / SUM(i.clicks), 2) ELSE 0 END as cpc
    FROM meta_ads.meta_insights_daily i
    WHERE i.ad_id = ${adId}
      AND i.date_start >= CURRENT_DATE - (${days}::int || ' days')::interval
    GROUP BY i.date_start
    ORDER BY i.date_start
  `);

  const rows = (result.rows as any[]) || [];
  const activeDays = rows.filter((r) => parseFloat(r.spend) > 0).length;

  return JSON.stringify({
    adId,
    windowDays: days,
    totalDaysWithData: rows.length,
    activeDaysWithSpend: activeDays,
    series: rows,
  });
}

async function insertAgentProposal(
  db: any,
  ctx: CriativosAgentContext,
  opts: {
    level: AgentLevel;
    entityId: string;
    entityName?: string;
    action: "pause" | "resume" | "budget_update";
    payload: Record<string, any>;
    rationale: string;
  }
): Promise<{ ok: true; logId: number } | { ok: false; error: string }> {
  if (!opts.rationale || opts.rationale.trim().length < 40) {
    return {
      ok: false,
      error: "rationale muito curto — descreva spend, leads, deals, CAC, período e meta",
    };
  }

  const result = await db.execute(sql`
    INSERT INTO cortex_core.meta_actions_log (
      actor_type, actor_user_id, actor_email, level, entity_id, entity_name,
      action, payload_json, reason, agent_rationale_text, status
    ) VALUES (
      'agent',
      ${ctx.userId},
      ${ctx.userEmail},
      ${opts.level},
      ${opts.entityId},
      ${opts.entityName ?? null},
      ${opts.action},
      ${sql.raw(`'${JSON.stringify(opts.payload).replace(/'/g, "''")}'::jsonb`)},
      ${opts.rationale.slice(0, 2000)},
      ${opts.rationale},
      'pending'
    )
    RETURNING id
  `);
  const row = (result.rows[0] as any) || {};
  return { ok: true, logId: parseInt(row.id, 10) };
}

async function proposePauseEntity(
  db: any,
  ctx: CriativosAgentContext,
  input: { level: AgentLevel; entityId: string; entityName?: string; rationale: string }
): Promise<string> {
  const r = await insertAgentProposal(db, ctx, {
    level: input.level,
    entityId: input.entityId,
    entityName: input.entityName,
    action: "pause",
    payload: { status: "PAUSED" },
    rationale: input.rationale,
  });
  return JSON.stringify(r);
}

async function proposeResumeEntity(
  db: any,
  ctx: CriativosAgentContext,
  input: { level: AgentLevel; entityId: string; entityName?: string; rationale: string }
): Promise<string> {
  const r = await insertAgentProposal(db, ctx, {
    level: input.level,
    entityId: input.entityId,
    entityName: input.entityName,
    action: "resume",
    payload: { status: "ACTIVE" },
    rationale: input.rationale,
  });
  return JSON.stringify(r);
}

async function proposeBudgetChange(
  db: any,
  ctx: CriativosAgentContext,
  input: {
    level: "adset" | "campaign";
    entityId: string;
    entityName?: string;
    newDailyBudgetCents: number;
    rationale: string;
  }
): Promise<string> {
  if (!Number.isFinite(input.newDailyBudgetCents) || input.newDailyBudgetCents <= 0) {
    return JSON.stringify({ ok: false, error: "newDailyBudgetCents inválido" });
  }
  const r = await insertAgentProposal(db, ctx, {
    level: input.level,
    entityId: input.entityId,
    entityName: input.entityName,
    action: "budget_update",
    payload: { daily_budget_cents: Math.round(input.newDailyBudgetCents) },
    rationale: input.rationale,
  });
  return JSON.stringify(r);
}

/**
 * Dispatcher usado pelo agente de criativos. Sabe lidar com as tools
 * propose-only + getCriativoTimeSeries, e delega o resto para o dispatcher
 * `executeGrowthTool` existente (getAdsMetrics, getDealsMetrics, getBudgets, etc.).
 */
export async function executeCriativosAgentTool(
  db: any,
  toolName: string,
  input: any,
  ctx: CriativosAgentContext
): Promise<string> {
  try {
    switch (toolName) {
      case "proposePauseEntity":
        return await proposePauseEntity(db, ctx, input);
      case "proposeResumeEntity":
        return await proposeResumeEntity(db, ctx, input);
      case "proposeBudgetChange":
        return await proposeBudgetChange(db, ctx, input);
      case "getCriativoTimeSeries":
        return await getCriativoTimeSeries(db, input);
      default:
        return await executeGrowthTool(db, toolName, input);
    }
  } catch (error: any) {
    console.error(`[criativos-agent] Erro ao executar tool ${toolName}:`, error);
    return JSON.stringify({
      error: `Erro ao executar ${toolName}: ${error.message}`,
    });
  }
}

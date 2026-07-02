// server/routes/gestaoReceita.cacCanais.ts
// Seção "CAC por canal — variáveis de custo" (aba Macro da Gestão de Receita).
// CAC GERENCIAL: custos informados à mão por mês (gestao_receita_metas, chaves
// cac_canal:<canal>:<item>) + itens automáticos (spend de ads das plataformas) +
// incentivos automáticos por cliente (unitário editável via cac_canal_unit:<canal>,
// default R$ 1.000). Clientes = deals ganhos Bitrix agrupados por source →
// macro-canal. Não confundir com o card "CAC — custo de aquisição" (Conta Azul,
// regime caixa): não batem por design.
import { sql } from "drizzle-orm";

const STAGE_GANHO = "Negócio Ganho";

// contas de ads da própria Turbo (a agência gerencia contas de clientes também);
// mesma régua do growthTimeseries.ts
const TURBO_TIKTOK_ADVERTISER_IDS = ["7065303755092131842"];

export interface CacCanalDef {
  id: string;
  label: string;
  sources: string[]; // códigos crus de crm_deal.source (ver bitrixSources.ts)
  itens: { id: string; label: string; auto?: "ads_spend" }[];
  incentivo?: { label: string; unitDefault: number };
}

// Catálogo fixo (spec 2026-07-02). Parceria ainda não tem source no CRM → clientes 0.
export const CAC_CANAIS: CacCanalDef[] = [
  { id: "inbound_pago", label: "Inbound pago", sources: ["WEBFORM", "ADVERTISING", "OTHER", "STORE"], itens: [{ id: "anuncios", label: "Investimento em anúncios", auto: "ads_spend" }] },
  { id: "inbound_organico", label: "Inbound orgânico", sources: ["WEB", "CALL", "BOOKING", "EMAIL", "TRADE_SHOW", "instagram_organic"], itens: [] },
  { id: "outbound", label: "Outbound", sources: ["UC_YWZVA2"], itens: [{ id: "time", label: "Custo de time" }, { id: "ferramentas", label: "Ferramentas (Lemlist, Intexfy...)" }] },
  { id: "social_selling", label: "Social Selling", sources: ["UC_4VCKGM"], itens: [{ id: "anuncios_dist", label: "Anúncios p/ distribuição" }] },
  { id: "reativacao", label: "Reativação", sources: ["UC_HIBVO6", "UC_8HI30Y"], itens: [{ id: "broadcast", label: "Disparos de broadcast" }, { id: "time", label: "Custo de time" }] },
  { id: "recomendacao", label: "Recomendação", sources: ["UC_PTYW1Y", "CALLBACK"], itens: [] },
  { id: "indique_ganhe", label: "Indique e ganhe", sources: ["RC_GENERATOR"], itens: [], incentivo: { label: "Incentivo", unitDefault: 1000 } },
  { id: "evento", label: "Evento", sources: ["RECOMMENDATION", "UC_KYOYOW"], itens: [{ id: "custo_evento", label: "Custo do evento (manual)" }] },
  { id: "parceria", label: "Parceria", sources: [], itens: [{ id: "time_resp", label: "Custo de time responsável" }], incentivo: { label: "Comissão", unitDefault: 1000 } },
  { id: "expansao", label: "Expansão de conta (Crossell)", sources: ["PARTNER", "UC_7WV0LW", "REPEAT_SALE"], itens: [{ id: "time", label: "Custo de time" }] },
];

export interface DealsSourceMes { source: string; mes: number; clientes: number }
export interface MetaMesRow { chave: string; mes: number; valor: number }
// autos: série mensal por chave de item automático (ex.: ads_spend → { 6: 123456 })
export type AutosPorMes = Partial<Record<"ads_spend", Record<number, number>>>;
export interface CacCanalOut {
  id: string; label: string; clientes: number; custoTotal: number; cacCliente: number | null;
  itens: { id: string; label: string; valor: number; fonte: "auto" | "manual" }[];
  incentivo?: { label: string; unit: number; qtd: number; total: number };
}
export interface CacCanaisOut {
  geral: { cac: number | null; clientes: number; custoTotal: number };
  canais: CacCanalOut[];
}

// Agregação pura (testável sem banco). Incentivo calculado MÊS A MÊS (unit do mês ×
// clientes do mês) para range multi-mês somar certo mesmo se o unitário mudou no meio;
// o campo `unit` retornado é o do primeiro mês do período (exibição).
// Item com `auto` usa a série de `autos` e IGNORA override manual (não é editável).
export function agregarCacCanais(deals: DealsSourceMes[], metas: MetaMesRow[], mesesNums: number[], autos: AutosPorMes = {}): CacCanaisOut {
  const sourceToCanal: Record<string, string> = {};
  for (const c of CAC_CANAIS) for (const s of c.sources) sourceToCanal[s] = c.id;

  const clientesCanalMes: Record<string, Record<number, number>> = {};
  for (const d of deals) {
    const canal = sourceToCanal[d.source];
    if (!canal) continue; // sources fora do catálogo ficam fora da seção (nota na UI)
    (clientesCanalMes[canal] ??= {})[d.mes] = (clientesCanalMes[canal]?.[d.mes] || 0) + (Number(d.clientes) || 0);
  }
  const metaMes: Record<string, Record<number, number>> = {};
  for (const m of metas) (metaMes[m.chave] ??= {})[m.mes] = Number(m.valor) || 0;

  const canais = CAC_CANAIS.map((def) => {
    const porMes = clientesCanalMes[def.id] || {};
    const clientes = mesesNums.reduce((a, m) => a + (porMes[m] || 0), 0);
    const itens = def.itens.map((it) => {
      const auto = it.auto;
      return {
        id: it.id,
        label: it.label,
        valor: auto
          ? mesesNums.reduce((a, m) => a + (autos[auto]?.[m] || 0), 0)
          : mesesNums.reduce((a, m) => a + (metaMes[`cac_canal:${def.id}:${it.id}`]?.[m] || 0), 0),
        fonte: (auto ? "auto" : "manual") as "auto" | "manual",
      };
    });
    let incentivo: CacCanalOut["incentivo"];
    if (def.incentivo) {
      const unitDe = (m: number) => metaMes[`cac_canal_unit:${def.id}`]?.[m] ?? def.incentivo!.unitDefault;
      const total = mesesNums.reduce((a, m) => a + unitDe(m) * (porMes[m] || 0), 0);
      incentivo = { label: def.incentivo.label, unit: unitDe(mesesNums[0]), qtd: clientes, total };
    }
    const custoTotal = itens.reduce((a, i) => a + i.valor, 0) + (incentivo?.total || 0);
    return {
      id: def.id, label: def.label, clientes, custoTotal,
      cacCliente: clientes > 0 ? Math.round(custoTotal / clientes) : null,
      itens, incentivo,
    };
  });

  const totClientes = canais.reduce((a, c) => a + c.clientes, 0);
  const totCusto = canais.reduce((a, c) => a + c.custoTotal, 0);
  return {
    geral: { cac: totClientes > 0 ? Math.round(totCusto / totClientes) : null, clientes: totClientes, custoTotal: totCusto },
    canais,
  };
}

// db tipado frouxo de propósito (method shorthand = bivariante, aceita o db do drizzle)
type DbLike = { execute(q: any): Promise<{ rows: any[] }> };

// Spend de ads das contas da Turbo por mês: Meta + Google + TikTok + LinkedIn
// (competência do consumo, não caixa). Cada plataforma em try/catch resiliente —
// schema ausente ou permission denied (gotcha growth_dev) não derruba o payload.
async function adsSpendPorMes(db: DbLike, dIni: string, dFim: string): Promise<Record<number, number>> {
  const spend: Record<number, number> = {};
  const soma = (rows: any[]) => {
    for (const r of rows) spend[Number(r.mes)] = (spend[Number(r.mes)] || 0) + (parseFloat(r.investimento) || 0);
  };

  try {
    const meta = await db.execute(sql`
      SELECT EXTRACT(MONTH FROM date_start)::int AS mes, COALESCE(SUM(spend), 0) AS investimento
      FROM meta_ads.meta_insights_daily
      WHERE date_start >= ${dIni} AND date_start < ${dFim}
      GROUP BY 1
    `);
    soma(meta.rows as any[]);
  } catch (err) {
    console.log("[cac-canais] Meta Ads spend pulado:", (err as any)?.message || err);
  }

  try {
    // coluna de data do google varia por versão do sync (mesma detecção do growthTimeseries)
    const colsResult = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'google' AND table_name = 'campaign_daily_metrics'
    `);
    const columns = (colsResult.rows as any[]).map((r) => r.column_name);
    const dateCol = columns.includes("report_date") ? "report_date"
      : columns.includes("metric_date") ? "metric_date"
      : columns.includes("date") ? "date"
      : columns.includes("segments_date") ? "segments_date" : null;
    if (dateCol && columns.includes("cost_micros")) {
      // dIni/dFim vêm do parsePeriodo (formato YYYY-MM-01 validado por regex) — seguros no raw
      const g = await db.execute(sql.raw(`
        SELECT EXTRACT(MONTH FROM ${dateCol})::int AS mes, COALESCE(SUM(cost_micros) / 1000000.0, 0) AS investimento
        FROM google.campaign_daily_metrics
        WHERE ${dateCol} >= '${dIni}'::date AND ${dateCol} < '${dFim}'::date
        GROUP BY 1
      `));
      soma(g.rows as any[]);
    }
  } catch (err) {
    console.log("[cac-canais] Google Ads spend pulado:", (err as any)?.message || err);
  }

  try {
    const idsSql = sql.join(TURBO_TIKTOK_ADVERTISER_IDS.map((id) => sql`${id}`), sql`, `);
    const tt = await db.execute(sql`
      SELECT EXTRACT(MONTH FROM stat_date)::int AS mes, COALESCE(SUM(spend), 0) AS investimento
      FROM tiktok.ad_metrics_daily
      WHERE stat_date >= ${dIni} AND stat_date < ${dFim} AND advertiser_id IN (${idsSql})
      GROUP BY 1
    `);
    soma(tt.rows as any[]);
  } catch (err) {
    console.log("[cac-canais] TikTok Ads spend pulado:", (err as any)?.message || err);
  }

  try {
    const li = await db.execute(sql`
      SELECT EXTRACT(MONTH FROM stat_date)::int AS mes, COALESCE(SUM(spend), 0) AS investimento
      FROM linkedin.ad_metrics_daily
      WHERE stat_date >= ${dIni} AND stat_date < ${dFim}
      GROUP BY 1
    `);
    soma(li.rows as any[]);
  } catch (err) {
    console.log("[cac-canais] LinkedIn Ads spend pulado:", (err as any)?.message || err);
  }

  return spend;
}

export async function computeCacCanais(
  db: DbLike,
  { dIni, dFim, ano, mesesNums }: { dIni: string; dFim: string; ano: number; mesesNums: number[] },
): Promise<CacCanaisOut> {
  const mesesInSql = sql.join(mesesNums.map((m) => sql`${m}`), sql`, `);
  const [dealsRows, metasRows, adsSpend] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(NULLIF(source, ''), '(não informado)') AS source,
             EXTRACT(MONTH FROM data_fechamento)::int AS mes,
             COUNT(*)::int AS clientes
      FROM "Bitrix".crm_deal
      WHERE stage_name = ${STAGE_GANHO}
        AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}
      GROUP BY 1, 2
    `),
    db.execute(sql`
      SELECT chave, mes, valor::numeric AS valor
      FROM cortex_core.gestao_receita_metas
      WHERE ano = ${ano} AND mes IN (${mesesInSql})
        AND (chave LIKE 'cac_canal:%' OR chave LIKE 'cac_canal_unit:%')
    `),
    adsSpendPorMes(db, dIni, dFim),
  ]);
  return agregarCacCanais(
    (dealsRows.rows as any[]).map((r) => ({ source: r.source, mes: Number(r.mes), clientes: Number(r.clientes) || 0 })),
    (metasRows.rows as any[]).map((r) => ({ chave: r.chave, mes: Number(r.mes), valor: Number(r.valor) || 0 })),
    mesesNums,
    { ads_spend: adsSpend },
  );
}

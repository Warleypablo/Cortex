// server/routes/gestaoReceita.cacCanais.ts
// Seção "CAC por canal — variáveis de custo" (aba Macro da Gestão de Receita).
// CAC GERENCIAL: custos informados à mão por mês (gestao_receita_metas, chaves
// cac_canal:<canal>:<item>) + itens automáticos (spend de ads das plataformas) +
// incentivos automáticos por cliente (unitário editável via cac_canal_unit:<canal>,
// default R$ 1.000). Clientes = deals ganhos Bitrix agrupados por source →
// macro-canal. CONTRATOS = contratos do ClickUp (cup_contratos, mesma régua/fonte do
// card "137 contratos novos": MRR por linha + pontual dedup por jornada), atribuídos ao
// canal via CNPJ do deal ganho do mês; contrato de cliente sem deal no mês fica de fora.
// Não confundir com o card "CAC — custo de aquisição" (Conta Azul, regime caixa): não
// batem por design.
import { sql } from "drizzle-orm";
import { sourceLabel } from "./bitrixSources";

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
  { id: "inbound", label: "Inbound", sources: ["WEBFORM", "ADVERTISING", "STORE", "WEB", "CALL", "BOOKING", "EMAIL", "TRADE_SHOW", "instagram_organic"], itens: [{ id: "anuncios", label: "Investimento em anúncios", auto: "ads_spend" }] },
  { id: "outbound", label: "Outbound", sources: ["UC_YWZVA2"], itens: [{ id: "time", label: "Custo de time" }, { id: "ferramentas", label: "Ferramentas (Lemlist, Intexfy...)" }] },
  { id: "social_selling", label: "Social Selling", sources: ["UC_4VCKGM"], itens: [{ id: "anuncios_dist", label: "Anúncios p/ distribuição" }] },
  { id: "reativacao", label: "Reativação", sources: ["UC_HIBVO6", "UC_8HI30Y", "OTHER"], itens: [{ id: "broadcast", label: "Disparos de broadcast" }, { id: "time", label: "Custo de time" }] },
  { id: "recomendacao", label: "Recomendação", sources: ["UC_PTYW1Y", "CALLBACK"], itens: [] },
  { id: "indique_ganhe", label: "Indique e ganhe", sources: ["RC_GENERATOR"], itens: [], incentivo: { label: "Incentivo", unitDefault: 1000 } },
  { id: "evento", label: "Evento", sources: ["RECOMMENDATION", "UC_KYOYOW"], itens: [{ id: "custo_evento", label: "Custo do evento (manual)" }] },
  { id: "parceria", label: "Parceria", sources: [], itens: [{ id: "time_resp", label: "Custo de time responsável" }], incentivo: { label: "Comissão", unitDefault: 1000 } },
  { id: "expansao", label: "Expansão de conta (Crossell)", sources: ["PARTNER", "UC_7WV0LW", "REPEAT_SALE"], itens: [{ id: "time", label: "Custo de time" }] },
];

// 1 linha por deal ganho: source (→ canal) + mês (→ contagem de clientes) + valores
// vendidos do deal (vrec/vpont → ROI). Contratos NÃO vêm daqui — cup_contratos.
export interface DealsSourceMes { source: string; mes: number; clientes: number; vrec?: number; vpont?: number }
// contratos do ClickUp já atribuídos a canal (via CNPJ do deal): canalId → mês → nº.
export type ContratosCanalMes = Record<string, Record<number, number>>;
export interface MetaMesRow { chave: string; mes: number; valor: number }
// autos: série mensal por chave de item automático (ex.: ads_spend → { 6: 123456 })
export type AutosPorMes = Partial<Record<"ads_spend", Record<number, number>>>;
export interface CacCanalOut {
  id: string; label: string; clientes: number; contratos: number; custoTotal: number;
  vendidoMrr: number; vendidoPontual: number;
  cacCliente: number | null; cacContrato: number | null;
  sources: string[]; // nomes legíveis dos sources do Bitrix mapeados neste canal (de-para exibido na UI)
  itens: { id: string; label: string; valor: number; fonte: "auto" | "manual" }[];
  incentivo?: { label: string; unit: number; qtd: number; total: number };
}
export interface CacCanaisOut {
  geral: { cac: number | null; cacContrato: number | null; clientes: number; contratos: number; custoTotal: number; vendidoMrr: number; vendidoPontual: number };
  canais: CacCanalOut[];
}

// Agregação pura (testável sem banco). Incentivo calculado MÊS A MÊS (unit do mês ×
// clientes do mês) para range multi-mês somar certo mesmo se o unitário mudou no meio;
// o campo `unit` retornado é o do primeiro mês do período (exibição).
// Item com `auto` usa a série de `autos` e IGNORA override manual (não é editável).
// `contratosCanalMes` (canalId → mês → nº) vem já atribuído a canal por computeCacCanais
// a partir do cup_contratos. Sem piso 1 por deal: um canal pode ter clientes>0 e
// contratos=0 (venda sem contrato operacional criado no mês) → cacContrato = null.
export function agregarCacCanais(
  deals: DealsSourceMes[], metas: MetaMesRow[], mesesNums: number[], autos: AutosPorMes = {},
  contratosCanalMes: ContratosCanalMes = {},
): CacCanaisOut {
  const sourceToCanal: Record<string, string> = {};
  for (const c of CAC_CANAIS) for (const s of c.sources) sourceToCanal[s] = c.id;

  const clientesCanalMes: Record<string, Record<number, number>> = {};
  const vendidoCanalMes: Record<string, Record<number, { mrr: number; pont: number }>> = {};
  for (const d of deals) {
    const canal = sourceToCanal[d.source];
    if (!canal) continue; // sources fora do catálogo ficam fora da seção (nota na UI)
    (clientesCanalMes[canal] ??= {})[d.mes] = (clientesCanalMes[canal]?.[d.mes] || 0) + (Number(d.clientes) || 0);
    const v = ((vendidoCanalMes[canal] ??= {})[d.mes] ??= { mrr: 0, pont: 0 });
    v.mrr += Number(d.vrec) || 0;
    v.pont += Number(d.vpont) || 0;
  }
  const metaMes: Record<string, Record<number, number>> = {};
  for (const m of metas) (metaMes[m.chave] ??= {})[m.mes] = Number(m.valor) || 0;

  const canais = CAC_CANAIS.map((def) => {
    const porMes = clientesCanalMes[def.id] || {};
    const porMesCont = contratosCanalMes[def.id] || {};
    const porMesVend = vendidoCanalMes[def.id] || {};
    const clientes = mesesNums.reduce((a, m) => a + (porMes[m] || 0), 0);
    const contratos = mesesNums.reduce((a, m) => a + (porMesCont[m] || 0), 0);
    const vendidoMrr = mesesNums.reduce((a, m) => a + (porMesVend[m]?.mrr || 0), 0);
    const vendidoPontual = mesesNums.reduce((a, m) => a + (porMesVend[m]?.pont || 0), 0);
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
      id: def.id, label: def.label, clientes, contratos, custoTotal,
      vendidoMrr, vendidoPontual,
      cacCliente: clientes > 0 ? Math.round(custoTotal / clientes) : null,
      cacContrato: contratos > 0 ? Math.round(custoTotal / contratos) : null,
      sources: def.sources.map(sourceLabel),
      itens, incentivo,
    };
  });

  const totClientes = canais.reduce((a, c) => a + c.clientes, 0);
  const totContratos = canais.reduce((a, c) => a + c.contratos, 0);
  const totCusto = canais.reduce((a, c) => a + c.custoTotal, 0);
  const totVendMrr = canais.reduce((a, c) => a + c.vendidoMrr, 0);
  const totVendPont = canais.reduce((a, c) => a + c.vendidoPontual, 0);
  return {
    geral: {
      cac: totClientes > 0 ? Math.round(totCusto / totClientes) : null,
      cacContrato: totContratos > 0 ? Math.round(totCusto / totContratos) : null,
      clientes: totClientes, contratos: totContratos, custoTotal: totCusto,
      vendidoMrr: totVendMrr, vendidoPontual: totVendPont,
    },
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
  const [dealsRows, contratosRows, metasRows, adsSpend] = await Promise.all([
    // uma linha por deal ganho: source (→ canal) + mês (→ clientes) + valores vendidos
    // (vrec/vpont → ROI, mesma fonte do card "Venda nova") + cnpj/data p/ montar
    // o mapa cnpj→canal (desempate: deal ganho mais recente do período).
    db.execute(sql`
      SELECT COALESCE(NULLIF(source, ''), '(não informado)') AS source,
             EXTRACT(MONTH FROM data_fechamento)::int AS mes,
             regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') AS cnpj_norm,
             data_fechamento,
             COALESCE(valor_recorrente::numeric, 0) AS vrec,
             COALESCE(valor_pontual::numeric, 0) AS vpont
      FROM "Bitrix".crm_deal
      WHERE stage_name = ${STAGE_GANHO}
        AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}
    `),
    // contratos do ClickUp criados no período, por CNPJ+mês, mesma régua do card 137:
    // MRR = 1 por linha com valorr>0; Pontual = dedup por jornada (id_task p/ Creators,
    // id_subtask p/ os demais). Casado ao canal em JS via cnpj do deal.
    db.execute(sql`
      WITH base AS (
        SELECT regexp_replace(COALESCE(cl.cnpj, ''), '\\D', '', 'g') AS cnpj_norm,
               EXTRACT(MONTH FROM c.data_criado)::int AS mes,
               c.id_task, c.id_subtask, c.valorr::numeric AS vr, c.valorp::numeric AS vp,
               COALESCE(NULLIF(TRIM(c.produto), ''), '(sem produto)') AS produto
        FROM "Clickup".cup_contratos c
        JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE c.data_criado >= ${dIni} AND c.data_criado < ${dFim}
          AND LOWER(TRIM(c.status)) <> 'não usar'
      ),
      mrr AS (
        SELECT cnpj_norm, mes, COUNT(*) AS c_mrr FROM base WHERE vr > 0 GROUP BY cnpj_norm, mes
      ),
      pont AS (
        SELECT cnpj_norm, mes, COUNT(*) AS c_pont FROM (
          SELECT DISTINCT cnpj_norm, mes, produto,
                 CASE WHEN produto = 'Creators' THEN 'task:' || id_task ELSE 'sub:' || id_subtask END AS jornada
          FROM base WHERE vp > 0
        ) q GROUP BY cnpj_norm, mes
      )
      SELECT COALESCE(m.cnpj_norm, p.cnpj_norm) AS cnpj_norm,
             COALESCE(m.mes, p.mes) AS mes,
             COALESCE(m.c_mrr, 0) + COALESCE(p.c_pont, 0) AS contratos
      FROM mrr m FULL JOIN pont p ON m.cnpj_norm = p.cnpj_norm AND m.mes = p.mes
    `),
    db.execute(sql`
      SELECT chave, mes, valor::numeric AS valor
      FROM cortex_core.gestao_receita_metas
      WHERE ano = ${ano} AND mes IN (${mesesInSql})
        AND (chave LIKE 'cac_canal:%' OR chave LIKE 'cac_canal_unit:%')
    `),
    adsSpendPorMes(db, dIni, dFim),
  ]);

  // mapa cnpj → canal (desempate: canal do deal ganho mais recente do período).
  // data_fechamento é DATE → comparação lexicográfica de 'YYYY-MM-DD' é cronológica.
  const sourceToCanal: Record<string, string> = {};
  for (const c of CAC_CANAIS) for (const s of c.sources) sourceToCanal[s] = c.id;
  const clientesDeals: DealsSourceMes[] = [];
  const canalPorCnpj: Record<string, { canal: string; data: string }> = {};
  for (const r of dealsRows.rows as any[]) {
    clientesDeals.push({
      source: r.source, mes: Number(r.mes), clientes: 1,
      vrec: parseFloat(r.vrec) || 0, vpont: parseFloat(r.vpont) || 0,
    });
    const cnpj = String(r.cnpj_norm || "");
    const canal = sourceToCanal[r.source];
    if (!canal || cnpj.length < 11) continue;
    const data = String(r.data_fechamento || "");
    const cur = canalPorCnpj[cnpj];
    if (!cur || data > cur.data) canalPorCnpj[cnpj] = { canal, data };
  }

  // contratos do cup_contratos → canal (via cnpj do deal) → por mês. Contrato de cliente
  // sem deal ganho no período (cnpj fora do mapa) fica de fora da seção.
  const contratosCanalMes: ContratosCanalMes = {};
  for (const r of contratosRows.rows as any[]) {
    const entry = canalPorCnpj[String(r.cnpj_norm || "")];
    if (!entry) continue;
    const mes = Number(r.mes);
    (contratosCanalMes[entry.canal] ??= {})[mes] = (contratosCanalMes[entry.canal]?.[mes] || 0) + (Number(r.contratos) || 0);
  }

  return agregarCacCanais(
    clientesDeals,
    (metasRows.rows as any[]).map((r) => ({ chave: r.chave, mes: Number(r.mes), valor: Number(r.valor) || 0 })),
    mesesNums,
    { ads_spend: adsSpend },
    contratosCanalMes,
  );
}

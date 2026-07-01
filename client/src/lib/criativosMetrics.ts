// Tipos e agregação de métricas de criativos (Meta Ads).
//
// As métricas ricas vêm do backend no nível de ANÚNCIO e são somáveis.
// Aqui agregamos de baixo pra cima (anúncio → conjunto → campanha → conta)
// recalculando os derivados a partir das somas dos contadores brutos —
// espelhando as fórmulas do backend (server/routes/growth.ts).

export type Level = "conta" | "campanha" | "conjunto" | "anuncio";

export interface CriativoData {
  id: string;
  adName: string;
  link: string;
  status: string;
  plataforma: string;
  campaignId: string | null;
  campaignName: string | null;
  campaignStatus?: string;
  adsetId: string | null;
  adsetName: string | null;
  adsetStatus?: string;
  // orçamento (vindo da API no nível de anúncio; em reais). CBO = budget na campanha; ABO = no conjunto.
  campaignDailyBudget?: number | null;
  campaignLifetimeBudget?: number | null;
  adsetDailyBudget?: number | null;
  adsetLifetimeBudget?: number | null;
  // orçamento diário exibido (derivado por nível, com dedupe de conjuntos/campanhas)
  orcamentoDiario?: number | null;
  // como renderizar o orçamento nesta linha/nível (espelha o Meta Ads):
  // 'own' = orçamento mora neste nível (mostra valor, editável)
  // 'usa_conjunto' = campanha ABO → "Usando o orçamento do conjunto de anúncios"
  // 'usa_campanha' = conjunto sob CBO → "Usando o orçamento da campanha"
  // null = sem orçamento aplicável (ex.: nível de anúncio)
  orcamentoInfo?: "own" | "usa_conjunto" | "usa_campanha" | null;
  // contadores brutos (presentes nas linhas de anúncio vindas da API)
  impressions?: number;
  outboundClicks?: number;
  uniqueOutboundClicks?: number;
  landingPageViews?: number;
  reach?: number;
  video3sec?: number;
  videoThruplay?: number;
  // contadores nativos de Google/TikTok (somáveis). Meta não os preenche.
  conversions?: number;       // conversões reportadas pela plataforma (Google/TikTok)
  conversionValue?: number;   // valor de conversão (Google)
  videoViews?: number;        // views de vídeo (Google/TikTok)
  // contadores nativos do TikTok (somáveis; demais plataformas não os preenchem)
  videoP25?: number;          // views que assistiram 25% do vídeo
  videoP50?: number;
  videoP75?: number;
  videoP100?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  follows?: number;
  profileVisits?: number;
  engagements?: number;
  nmqls?: number;
  rm?: number;
  rmMql?: number;
  rmNmql?: number;
  rr?: number;
  rrMql?: number;
  rrNmql?: number;
  vendas?: number;
  vendasMql?: number;
  vendasNmql?: number;
  contratos?: number;
  descartados?: number;
  descartadosMql?: number;
  descartadosNmql?: number;
  // métricas exibidas (derivadas)
  investimento: number;
  frequency: number | null; // impressões / alcance
  videoHook: number | null;
  videoHold: number | null;
  ctr: number | null;
  ctrUnico: number | null;
  cpm: number | null;
  cpc: number | null;              // custo por clique = investimento / cliques
  connectRate: number | null;
  taxaConversao: number | null;
  // Métricas nativas da plataforma (pixel/tag) — Google/TikTok. Todas somáveis:
  // razão de contadores somados. Meta usa o CRM (não preenche estas).
  convRate: number | null;         // conversões plataforma / cliques
  cpa: number | null;              // custo / conversão plataforma
  roasPlataforma: number | null;   // valor conv. plataforma / investimento
  videoViewRate: number | null;    // video views / impressões
  leads: number;
  cpl: number | null;
  mql: number;
  cpmql: number | null;
  cpra: number | null;
  cpraMql: number | null;
  cpraNmql: number | null;
  cprr: number | null;
  cprrMql: number | null;
  cprrNmql: number | null;
  percMql: number | null;
  descartadoPerc: number | null;
  descartadoMqlPerc: number | null;
  descartadoNmqlPerc: number | null;
  percRa: number | null;
  percRaMql: number | null;
  percRaNmql: number | null;
  percRr: number | null;
  percRrMql: number | null;
  percRrNmql: number | null;
  percRrVendas: number | null;
  percRrMqlVendas: number | null;
  percRrNmqlVendas: number | null;
  clientesUnicos: number;
  leadTime: number | null;
  aov: number | null;
  receita: number | null;
  receitaPontual: number;
  receitaRecorrente: number;
  cacGeral: number | null;
  cacUnico: number | null;
  cacContrato: number | null;
  roas: number | null;
}

export type SortConfig = {
  key: keyof CriativoData;
  direction: "asc" | "desc";
};

interface RawTotals {
  investimento: number;
  impressions: number;
  outboundClicks: number;
  uniqueOutboundClicks: number;
  landingPageViews: number;
  reach: number;
  video3sec: number;
  videoThruplay: number;
  conversions: number;
  conversionValue: number;
  videoViews: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP100: number;
  likes: number;
  comments: number;
  shares: number;
  follows: number;
  profileVisits: number;
  engagements: number;
  leads: number;
  mql: number;
  nmqls: number;
  rm: number;
  rmMql: number;
  rmNmql: number;
  rr: number;
  rrMql: number;
  rrNmql: number;
  vendas: number;
  vendasMql: number;
  vendasNmql: number;
  clientesUnicos: number;
  contratos: number;
  descartados: number;
  descartadosMql: number;
  descartadosNmql: number;
  receitaPontual: number;
  receitaRecorrente: number;
  leadTimeWeightedSum: number;
  leadTimeWeight: number;
}

function zeros(): RawTotals {
  return {
    investimento: 0, impressions: 0, outboundClicks: 0, uniqueOutboundClicks: 0, landingPageViews: 0, reach: 0,
    video3sec: 0, videoThruplay: 0, conversions: 0, conversionValue: 0, videoViews: 0,
    videoP25: 0, videoP50: 0, videoP75: 0, videoP100: 0,
    likes: 0, comments: 0, shares: 0, follows: 0, profileVisits: 0, engagements: 0,
    leads: 0, mql: 0, nmqls: 0,
    rm: 0, rmMql: 0, rmNmql: 0, rr: 0, rrMql: 0, rrNmql: 0,
    vendas: 0, vendasMql: 0, vendasNmql: 0, clientesUnicos: 0, contratos: 0,
    descartados: 0, descartadosMql: 0, descartadosNmql: 0,
    receitaPontual: 0, receitaRecorrente: 0, leadTimeWeightedSum: 0, leadTimeWeight: 0,
  };
}

function sumRaw(rows: CriativoData[]): RawTotals {
  const t = zeros();
  for (const r of rows) {
    t.investimento += r.investimento || 0;
    t.impressions += r.impressions || 0;
    t.outboundClicks += r.outboundClicks || 0;
    t.uniqueOutboundClicks += r.uniqueOutboundClicks || 0;
    t.landingPageViews += r.landingPageViews || 0;
    t.reach += r.reach || 0;
    t.video3sec += r.video3sec || 0;
    t.videoThruplay += r.videoThruplay || 0;
    t.conversions += r.conversions || 0;
    t.conversionValue += r.conversionValue || 0;
    t.videoViews += r.videoViews || 0;
    t.videoP25 += r.videoP25 || 0;
    t.videoP50 += r.videoP50 || 0;
    t.videoP75 += r.videoP75 || 0;
    t.videoP100 += r.videoP100 || 0;
    t.likes += r.likes || 0;
    t.comments += r.comments || 0;
    t.shares += r.shares || 0;
    t.follows += r.follows || 0;
    t.profileVisits += r.profileVisits || 0;
    t.engagements += r.engagements || 0;
    t.leads += r.leads || 0;
    t.mql += r.mql || 0;
    t.nmqls += r.nmqls || 0;
    t.rm += r.rm || 0;
    t.rmMql += r.rmMql || 0;
    t.rmNmql += r.rmNmql || 0;
    t.rr += r.rr || 0;
    t.rrMql += r.rrMql || 0;
    t.rrNmql += r.rrNmql || 0;
    t.vendas += r.vendas || 0;
    t.vendasMql += r.vendasMql || 0;
    t.vendasNmql += r.vendasNmql || 0;
    t.clientesUnicos += r.clientesUnicos || 0;
    t.contratos += r.contratos || 0;
    t.descartados += r.descartados || 0;
    t.descartadosMql += r.descartadosMql || 0;
    t.descartadosNmql += r.descartadosNmql || 0;
    t.receitaPontual += r.receitaPontual || 0;
    t.receitaRecorrente += r.receitaRecorrente || 0;
    // lead time: média ponderada por clientes únicos
    const cu = r.clientesUnicos || 0;
    if (r.leadTime != null && cu > 0) {
      t.leadTimeWeightedSum += r.leadTime * cu;
      t.leadTimeWeight += cu;
    }
  }
  return t;
}

const r1 = (v: number) => parseFloat(v.toFixed(1));
const r2 = (v: number) => parseFloat(v.toFixed(2));

/** Recalcula as métricas derivadas a partir das somas dos contadores brutos. */
function computeDerived(t: RawTotals) {
  const inv = t.investimento;
  const receita = t.receitaPontual + t.receitaRecorrente;
  return {
    investimento: Math.round(inv),
    impressions: t.impressions,
    outboundClicks: t.outboundClicks,
    uniqueOutboundClicks: t.uniqueOutboundClicks,
    landingPageViews: t.landingPageViews,
    reach: t.reach,
    video3sec: t.video3sec,
    videoThruplay: t.videoThruplay,
    conversions: t.conversions,
    conversionValue: t.conversionValue,
    videoViews: t.videoViews,
    videoP25: t.videoP25,
    videoP50: t.videoP50,
    videoP75: t.videoP75,
    videoP100: t.videoP100,
    likes: t.likes,
    comments: t.comments,
    shares: t.shares,
    follows: t.follows,
    profileVisits: t.profileVisits,
    engagements: t.engagements,
    leads: t.leads,
    mql: t.mql,
    nmqls: t.nmqls,
    rm: t.rm, rmMql: t.rmMql, rmNmql: t.rmNmql,
    rr: t.rr, rrMql: t.rrMql, rrNmql: t.rrNmql,
    vendas: t.vendas, vendasMql: t.vendasMql, vendasNmql: t.vendasNmql,
    clientesUnicos: t.clientesUnicos,
    contratos: t.contratos,
    descartados: t.descartados, descartadosMql: t.descartadosMql, descartadosNmql: t.descartadosNmql,
    receitaPontual: t.receitaPontual,
    receitaRecorrente: t.receitaRecorrente,

    cpm: t.impressions > 0 ? Math.round((inv / t.impressions) * 1000) : null,
    cpc: t.outboundClicks > 0 ? r2(inv / t.outboundClicks) : null,
    frequency: t.reach > 0 ? r2(t.impressions / t.reach) : null,
    ctr: t.impressions > 0 && t.outboundClicks > 0 ? r2((t.outboundClicks / t.impressions) * 100) : null,
    // Nativas da plataforma (Google/TikTok) — razão de contadores somados, somáveis em qualquer nível.
    convRate: t.outboundClicks > 0 && t.conversions > 0 ? r2((t.conversions / t.outboundClicks) * 100) : null,
    cpa: t.conversions > 0 ? Math.round(inv / t.conversions) : null,
    roasPlataforma: inv > 0 && t.conversionValue > 0 ? r2(t.conversionValue / inv) : null,
    videoViewRate: t.impressions > 0 && t.videoViews > 0 ? r2((t.videoViews / t.impressions) * 100) : null,
    // CTR de saída único = unique_outbound_clicks / reach (Meta-only; demais → null)
    ctrUnico: t.reach > 0 && t.uniqueOutboundClicks > 0 ? r2((t.uniqueOutboundClicks / t.reach) * 100) : null,
    videoHook: t.impressions > 0 && t.video3sec > 0 ? r2((t.video3sec / t.impressions) * 100) : null,
    videoHold: t.impressions > 0 && t.videoThruplay > 0 ? r2((t.videoThruplay / t.impressions) * 100) : null,
    connectRate: t.outboundClicks > 0 && t.landingPageViews > 0 ? r2((t.landingPageViews / t.outboundClicks) * 100) : null,
    taxaConversao: t.landingPageViews > 0 && t.leads > 0 ? r2((t.leads / t.landingPageViews) * 100) : null,
    cpl: t.leads > 0 ? Math.round(inv / t.leads) : null,
    percMql: t.leads > 0 ? r1((t.mql / t.leads) * 100) : null,
    cpmql: t.mql > 0 ? r2(inv / t.mql) : null,
    percRa: t.leads > 0 ? r1((t.rm / t.leads) * 100) : null,
    percRaMql: t.mql > 0 ? r1((t.rmMql / t.mql) * 100) : null,
    percRaNmql: t.nmqls > 0 ? r1((t.rmNmql / t.nmqls) * 100) : null,
    percRr: t.leads > 0 ? r1((t.rr / t.leads) * 100) : null,
    percRrMql: t.mql > 0 ? r1((t.rrMql / t.mql) * 100) : null,
    percRrNmql: t.nmqls > 0 ? r1((t.rrNmql / t.nmqls) * 100) : null,
    percRrVendas: t.rr > 0 ? r1((t.vendas / t.rr) * 100) : null,
    percRrMqlVendas: t.rrMql > 0 ? r1((t.vendasMql / t.rrMql) * 100) : null,
    percRrNmqlVendas: t.rrNmql > 0 ? r1((t.vendasNmql / t.rrNmql) * 100) : null,
    descartadoPerc: t.leads > 0 ? r1((t.descartados / t.leads) * 100) : null,
    descartadoMqlPerc: t.mql > 0 ? r1((t.descartadosMql / t.mql) * 100) : null,
    descartadoNmqlPerc: t.nmqls > 0 ? r1((t.descartadosNmql / t.nmqls) * 100) : null,
    cpra: inv > 0 && t.rm > 0 ? Math.round(inv / t.rm) : null,
    cpraMql: inv > 0 && t.rmMql > 0 ? Math.round(inv / t.rmMql) : null,
    cpraNmql: inv > 0 && t.rmNmql > 0 ? Math.round(inv / t.rmNmql) : null,
    cprr: inv > 0 && t.rr > 0 ? Math.round(inv / t.rr) : null,
    cprrMql: inv > 0 && t.rrMql > 0 ? Math.round(inv / t.rrMql) : null,
    cprrNmql: inv > 0 && t.rrNmql > 0 ? Math.round(inv / t.rrNmql) : null,
    leadTime: t.leadTimeWeight > 0 ? r1(t.leadTimeWeightedSum / t.leadTimeWeight) : null,
    aov: t.clientesUnicos > 0 ? Math.round(receita / t.clientesUnicos) : null,
    receita: receita || null,
    cacGeral: t.vendas > 0 ? Math.round(inv / t.vendas) : null,
    cacUnico: t.clientesUnicos > 0 ? Math.round(inv / t.clientesUnicos) : null,
    cacContrato: t.contratos > 0 ? Math.round(inv / t.contratos) : null,
    roas: inv > 0 ? r2(receita / inv) : null,
  };
}

interface GroupMeta {
  id: string;
  adName: string;
  status: string;
  campaignId: string | null;
  campaignName: string | null;
  campaignStatus?: string;
  adsetId: string | null;
  adsetName: string | null;
  adsetStatus?: string;
}

/** Indica se a campanha do anúncio usa orçamento de campanha (CBO). */
function isCbo(r: CriativoData): boolean {
  return (r.campaignDailyBudget || 0) > 0 || (r.campaignLifetimeBudget || 0) > 0;
}

type BudgetCell = { value: number | null; info: "own" | "usa_conjunto" | "usa_campanha" | null };

// Soma do daily_budget dos conjuntos distintos de uma campanha (ABO).
// activeOnly = considera apenas conjuntos ativos (pausados não gastam, não entram no total).
function sumDistinctAdsets(campRows: CriativoData[], activeOnly = false): number {
  const seen = new Map<string, number>();
  for (const a of campRows) {
    const id = a.adsetId || "—";
    if (seen.has(id)) continue;
    if (activeOnly && a.adsetStatus !== "Ativo") { seen.set(id, 0); continue; }
    seen.set(id, a.adsetDailyBudget || 0);
  }
  return Array.from(seen.values()).reduce((s, v) => s + v, 0);
}

/**
 * Espelha a coluna "Orçamento" do Meta Ads, que varia conforme a aba (nível):
 * - Campanha: CBO → mostra o valor (editável); ABO → "Usando o orçamento do conjunto".
 * - Conjunto: ABO → mostra o valor (editável); CBO → "Usando o orçamento da campanha".
 * - Conta: visão agregada → soma de todas as campanhas (não editável).
 * - Anúncio: sem orçamento aplicável.
 */
function computeBudget(rows: CriativoData[], level: Level): BudgetCell {
  if (!rows.length) return { value: null, info: null };
  const r = rows[0];

  if (level === "campanha") {
    if (isCbo(r)) return { value: r.campaignDailyBudget ?? null, info: "own" };
    return { value: null, info: "usa_conjunto" }; // ABO → orçamento mora nos conjuntos
  }

  if (level === "conjunto") {
    if ((r.adsetDailyBudget || 0) > 0) return { value: r.adsetDailyBudget!, info: "own" };
    if (isCbo(r)) return { value: null, info: "usa_campanha" }; // CBO → orçamento mora na campanha
    return { value: null, info: null };
  }

  if (level === "conta") {
    // Total = orçamento diário do que REALMENTE roda (somente ativos). Campanhas/conjuntos
    // pausados têm budget configurado mas gastam R$0/dia — incluí-los inflaria o total.
    const byCampaign = new Map<string, CriativoData[]>();
    for (const a of rows) {
      const id = a.campaignId || "—";
      const arr = byCampaign.get(id);
      if (arr) arr.push(a);
      else byCampaign.set(id, [a]);
    }
    let total = 0;
    Array.from(byCampaign.values()).forEach((campRows) => {
      const c = campRows[0];
      if (isCbo(c)) {
        if (c.campaignStatus === "Ativo") total += c.campaignDailyBudget || 0; // CBO ativo
      } else {
        total += sumDistinctAdsets(campRows, true); // ABO: só conjuntos ativos
      }
    });
    return { value: total > 0 ? total : null, info: "own" };
  }

  return { value: null, info: null }; // anúncio
}

/** Agrega um conjunto de linhas (anúncios) em uma única linha CriativoData. */
export function aggregateGroup(rows: CriativoData[], meta: GroupMeta, level: Level): CriativoData {
  const derived = computeDerived(sumRaw(rows));
  const budget = computeBudget(rows, level);
  return {
    link: "",
    plataforma: rows[0]?.plataforma || "Meta Ads",
    orcamentoDiario: budget.value,
    orcamentoInfo: budget.info,
    ...meta,
    ...derived,
  } as CriativoData;
}

/** 'Ativo' se qualquer linha do grupo estiver ativa; senão 'Pausado'. */
function deriveStatus(rows: CriativoData[]): string {
  return rows.some((r) => r.status === "Ativo") ? "Ativo" : "Pausado";
}

/** Agrega as linhas de anúncio para o nível pedido. */
export function aggregateByLevel(rows: CriativoData[], level: Level): CriativoData[] {
  if (level === "anuncio") {
    // Nível de anúncio não tem orçamento próprio (mora no conjunto/campanha).
    return rows.map((r) => ({ ...r, orcamentoDiario: null, orcamentoInfo: null }));
  }

  if (level === "conta") {
    return rows.length
      ? [aggregateGroup(rows, {
          id: "conta",
          adName: "Turbo Partners",
          status: deriveStatus(rows),
          campaignId: null, campaignName: null,
          adsetId: null, adsetName: null,
        }, level)]
      : [];
  }

  const groups = new Map<string, CriativoData[]>();
  for (const r of rows) {
    const key = (level === "campanha" ? r.campaignId : r.adsetId) || "—";
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const out: CriativoData[] = [];
  Array.from(groups.entries()).forEach(([key, grp]) => {
    const first = grp[0];
    if (level === "campanha") {
      out.push(aggregateGroup(grp, {
        id: key,
        adName: first.campaignName || key,
        status: first.campaignStatus || deriveStatus(grp),
        campaignId: key,
        campaignName: first.campaignName,
        campaignStatus: first.campaignStatus,
        adsetId: null, adsetName: null,
      }, level));
    } else {
      out.push(aggregateGroup(grp, {
        id: key,
        adName: first.adsetName || key,
        status: first.adsetStatus || deriveStatus(grp),
        campaignId: first.campaignId,
        campaignName: first.campaignName,
        adsetId: key,
        adsetName: first.adsetName,
        adsetStatus: first.adsetStatus,
      }, level));
    }
  });
  return out;
}

/** Ordena as linhas conforme sortConfig (mesma lógica usada no nível de anúncio). */
export function sortRows(rows: CriativoData[], sortConfig: SortConfig): CriativoData[] {
  const result = [...rows];
  result.sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    if (aValue === null && bValue === null) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
    }
    const aStr = String(aValue);
    const bStr = String(bValue);
    return sortConfig.direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });
  return result;
}

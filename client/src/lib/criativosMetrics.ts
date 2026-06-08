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
  // contadores brutos (presentes nas linhas de anúncio vindas da API)
  impressions?: number;
  outboundClicks?: number;
  landingPageViews?: number;
  reach?: number;
  video3sec?: number;
  videoThruplay?: number;
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
  videoHook: number | null;
  videoHold: number | null;
  ctr: number | null;
  cpm: number | null;
  connectRate: number | null;
  taxaConversao: number | null;
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
  landingPageViews: number;
  reach: number;
  video3sec: number;
  videoThruplay: number;
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
    investimento: 0, impressions: 0, outboundClicks: 0, landingPageViews: 0, reach: 0,
    video3sec: 0, videoThruplay: 0, leads: 0, mql: 0, nmqls: 0,
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
    t.landingPageViews += r.landingPageViews || 0;
    t.reach += r.reach || 0;
    t.video3sec += r.video3sec || 0;
    t.videoThruplay += r.videoThruplay || 0;
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
    landingPageViews: t.landingPageViews,
    reach: t.reach,
    video3sec: t.video3sec,
    videoThruplay: t.videoThruplay,
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
    ctr: t.impressions > 0 && t.outboundClicks > 0 ? r2((t.outboundClicks / t.impressions) * 100) : null,
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

/** Agrega um conjunto de linhas (anúncios) em uma única linha CriativoData. */
export function aggregateGroup(rows: CriativoData[], meta: GroupMeta): CriativoData {
  const derived = computeDerived(sumRaw(rows));
  return {
    link: "",
    plataforma: "Meta Ads",
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
  if (level === "anuncio") return rows;

  if (level === "conta") {
    return rows.length
      ? [aggregateGroup(rows, {
          id: "conta",
          adName: "Turbo Partners",
          status: deriveStatus(rows),
          campaignId: null, campaignName: null,
          adsetId: null, adsetName: null,
        })]
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
      }));
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
      }));
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

// Fonte da área Tech do Reporte Trimestral.
//
// Contexto (2026-07-09): as tabelas "Clickup".cup_projetos_tech* do nosso banco
// estão defasadas em relação ao ClickUp (Junho/2026 zerado, Abr/Mai subcontados).
// O dashboard tech-dash.pages.dev é gerado diariamente direto do ClickUp e é a
// fonte correta ("esses dados são os corretos" — Ichino). Ele publica um JSON
// estático estável em /data/home.json. Aqui buscamos esse JSON (com cache em
// memória + fallback embutido para o deck nunca quebrar) e mapeamos o trimestre
// pedido para o formato consumido pela slide Tech.

const TECH_DASH_URL = "https://tech-dash.pages.dev/data/home.json";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min
const FETCH_TIMEOUT_MS = 4000;

const MESES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ─── Shape do home.json do tech-dash (só os campos que usamos) ───
interface TechDashQuarter {
  quarter: number;
  label: string;
  period: { start: string; end: string };
  target: number;
  totalValorP: number;
  mrrLastMonth: number;
  mrrLastMonthLabel: string;
  totalProjects: number;
  averageTicket: number;
  topAccounts: { assignee: string; totalProjects: number; totalValorP: number }[];
}
interface TechDashProject {
  id: string; // clickup task id
  name: string;
  valorP: number;
}
interface TechDashMonth {
  year: number;
  month: number; // 0-indexado (Janeiro = 0)
  label: string;
  count: number;
  totalValorP: number;
  projects?: TechDashProject[];
}
interface TechDashRecorrenciaMes {
  year: number;
  month: number; // 0-indexado
  label: string;
  count: number;
  totalValorR: number;
}
interface TechDashHome {
  year: number;
  yearlyTarget: number;
  quarters: TechDashQuarter[];
  months: TechDashMonth[];
  recorrencia: {
    mrr: number;
    activeContracts: number;
    q2Deliveries?: number;
    byMonth: TechDashRecorrenciaMes[];
  };
  generatedAt: string;
}

// ─── Shape consumido pela slide (espelhado em client .../types.ts TechTrimestralData) ───
export interface TechAccount { nome: string; projetos: number; valor: number }
export interface TechMesEntrega { month: string; label: string; valor: number; projetos: number }
export interface TechMesMrr { month: string; label: string; mrr: number; contratos: number }
export interface TechTrimestralData {
  fonte: string;
  geradoEm: string | null;
  disponivel: boolean;      // false → tech-dash não cobre esse trimestre/ano (slide mostra aviso)
  meta: number;
  entregue: number;
  atingimento: number;      // entregue / meta (0..1+)
  projetos: number;
  ticketMedio: number;
  mrrUltimoMes: number;
  mrrUltimoMesLabel: string;
  contratosAtivos: number;
  entregasTri: number | null; // tasks concluídas no tri (só quando a fonte fornece)
  entregasPorMes: TechMesEntrega[];
  mrrPorMes: TechMesMrr[];
  topAccounts: TechAccount[];
}

// ─── Fallback embutido (snapshot tech-dash gerado 08/07/2026) ───
// Garante que o deck renderize mesmo se o tech-dash estiver inacessível.
const FALLBACK_HOME: TechDashHome = {
  year: 2026,
  yearlyTarget: 2400000,
  generatedAt: "08/07/2026, 10:59:26 (fallback)",
  quarters: [
    {
      quarter: 1, label: "Q1", period: { start: "2026-01-01", end: "2026-04-01" },
      target: 450000, totalValorP: 458705, mrrLastMonth: 15782, mrrLastMonthLabel: "Fevereiro",
      totalProjects: 39, averageTicket: 11761.666666666666,
      topAccounts: [
        { assignee: "Davi Ferraz", totalProjects: 15, totalValorP: 219480 },
        { assignee: "Bibiana Paz", totalProjects: 10, totalValorP: 112500 },
        { assignee: "Vinicius Paiva", totalProjects: 9, totalValorP: 87725 },
      ],
    },
    {
      quarter: 2, label: "Q2", period: { start: "2026-04-01", end: "2026-07-01" },
      target: 600000, totalValorP: 592309, mrrLastMonth: 25676, mrrLastMonthLabel: "Junho",
      totalProjects: 44, averageTicket: 13461.568181818182,
      topAccounts: [
        { assignee: "Davi Ferraz", totalProjects: 16, totalValorP: 216100 },
        { assignee: "Vinicius Paiva", totalProjects: 14, totalValorP: 185015 },
        { assignee: "Bibiana Paz", totalProjects: 13, totalValorP: 176194 },
      ],
    },
  ],
  months: [
    { year: 2026, month: 0, label: "Janeiro", count: 10, totalValorP: 109500 },
    { year: 2026, month: 1, label: "Fevereiro", count: 11, totalValorP: 126325 },
    { year: 2026, month: 2, label: "Marco", count: 18, totalValorP: 222880 },
    { year: 2026, month: 3, label: "Abril", count: 11, totalValorP: 118812 },
    { year: 2026, month: 4, label: "Maio", count: 16, totalValorP: 225297 },
    { year: 2026, month: 5, label: "Junho", count: 17, totalValorP: 248200 },
  ],
  recorrencia: {
    mrr: 25179, activeContracts: 14, q2Deliveries: 60,
    byMonth: [
      { year: 2026, month: 0, label: "Janeiro", count: 13, totalValorR: 20773 },
      { year: 2026, month: 1, label: "Fevereiro", count: 11, totalValorR: 15782 },
      { year: 2026, month: 2, label: "Marco", count: 2, totalValorR: 5497 },
      { year: 2026, month: 3, label: "Abril", count: 14, totalValorR: 23917 },
      { year: 2026, month: 4, label: "Maio", count: 14, totalValorR: 23279 },
      { year: 2026, month: 5, label: "Junho", count: 14, totalValorR: 25676 },
    ],
  },
};

let cache: { data: TechDashHome; at: number } | null = null;

async function fetchHome(): Promise<TechDashHome> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(TECH_DASH_URL, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as TechDashHome;
    if (!data?.quarters?.length) throw new Error("payload inesperado");
    cache = { data, at: Date.now() };
    return data;
  } catch (err: any) {
    console.warn(`[techDash] fetch falhou (${err?.message || err}); usando fallback embutido`);
    return FALLBACK_HOME;
  } finally {
    clearTimeout(timer);
  }
}

function ym(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

function emptyTechData(fonte: string, geradoEm: string | null): TechTrimestralData {
  return {
    fonte, geradoEm, disponivel: false,
    meta: 0, entregue: 0, atingimento: 0, projetos: 0, ticketMedio: 0,
    mrrUltimoMes: 0, mrrUltimoMesLabel: "", contratosAtivos: 0, entregasTri: null,
    entregasPorMes: [], mrrPorMes: [], topAccounts: [],
  };
}

/**
 * IDs das tasks do ClickUp dos projetos ENTREGUES no trimestre, na ordem em que o
 * tech-dash os lista. Base do painel "Tempo por Status" (ver lib/techPipeline.ts).
 * Lista vazia quando o tech-dash não cobre o ano/trimestre.
 */
export async function getProjetoIdsDoTrimestre(ano: number, quarter: number): Promise<string[]> {
  const home = await fetchHome();
  if (home.year !== ano) return [];
  const inQuarter = (month0: number) => Math.floor(month0 / 3) + 1 === quarter;
  return home.months
    .filter((m) => m.year === ano && inQuarter(m.month))
    .flatMap((m) => (m.projects ?? []).map((p) => p.id))
    .filter(Boolean);
}

/**
 * Mapeia o trimestre pedido para os dados Tech do tech-dash.
 * Se o tech-dash não cobrir o ano/trimestre, retorna `disponivel: false`.
 */
export async function getTechTrimestral(ano: number, quarter: number): Promise<TechTrimestralData> {
  const home = await fetchHome();
  const fonte = "tech-dash.pages.dev";
  const geradoEm = home.generatedAt ?? null;

  if (home.year !== ano) return emptyTechData(fonte, geradoEm);
  const q = home.quarters.find((x) => x.quarter === quarter);
  if (!q) return emptyTechData(fonte, geradoEm);

  const inQuarter = (month0: number) => Math.floor(month0 / 3) + 1 === quarter;

  const entregasPorMes: TechMesEntrega[] = home.months
    .filter((m) => m.year === ano && inQuarter(m.month))
    .sort((a, b) => a.month - b.month)
    .map((m) => ({ month: ym(m.year, m.month), label: MESES_SHORT[m.month] ?? m.label, valor: m.totalValorP, projetos: m.count }));

  const mrrPorMes: TechMesMrr[] = home.recorrencia.byMonth
    .filter((m) => m.year === ano && inQuarter(m.month))
    .sort((a, b) => a.month - b.month)
    .map((m) => ({ month: ym(m.year, m.month), label: MESES_SHORT[m.month] ?? m.label, mrr: m.totalValorR, contratos: m.count }));

  const topAccounts: TechAccount[] = (q.topAccounts ?? []).map((a) => ({
    nome: a.assignee, projetos: a.totalProjects, valor: a.totalValorP,
  }));

  return {
    fonte,
    geradoEm,
    disponivel: true,
    meta: q.target ?? 0,
    entregue: q.totalValorP ?? 0,
    atingimento: q.target ? (q.totalValorP ?? 0) / q.target : 0,
    projetos: q.totalProjects ?? 0,
    ticketMedio: q.averageTicket ?? 0,
    mrrUltimoMes: q.mrrLastMonth ?? 0,
    mrrUltimoMesLabel: q.mrrLastMonthLabel ?? "",
    contratosAtivos: home.recorrencia.activeContracts ?? 0,
    // q2Deliveries é específico do Q2 na fonte; só expõe quando existe.
    entregasTri: quarter === 2 && typeof home.recorrencia.q2Deliveries === "number"
      ? home.recorrencia.q2Deliveries
      : null,
    entregasPorMes,
    mrrPorMes,
    topAccounts,
  };
}

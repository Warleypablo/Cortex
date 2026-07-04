// Tipos e funções puras do CEO Dashboard.
// Toda a lógica de montagem de KPI vive aqui para poder ser testada sem IO.

export type CeoUnidade = "brl" | "pct" | "int" | "score";
export type CeoDirecao = "maior_melhor" | "menor_melhor" | "neutro";

export interface CeoKpi {
  key: string;
  label: string;
  valor: number | null;
  unidade: CeoUnidade;
  meta: number | null;
  atingimentoPct: number | null;
  direcao: CeoDirecao;
  mom: number | null;
  sparkline: number[] | null;
  status: "ok" | "sem_meta" | "em_breve";
  nota?: string;
}

// Uma linha do payload de computarBpReceitas (linhas[] ou metricasGerais[]).
export interface BpLinha {
  metrica: string;
  titulo?: string;
  direcao?: CeoDirecao;
  unidade?: "brl" | "int" | "pct";
  meses: Array<{ mes: number; orcado: number; realizado: number | null; atingimento: number | null }>;
}

export interface CeoDashboardResponse {
  mes: string; // "2026-06"
  kpis: CeoKpi[];
}

// Constrói um KPI a partir de uma linha do BP, para o mês pedido (1..12).
// direcao/unidade são explícitos (a régua vem da tabela de sourcing do spec),
// não dependemos de a linha do BP carregar esses campos.
export function bpLinhaToKpi(
  linha: BpLinha | undefined,
  opts: { key: string; label: string; mesNum: number; direcao: CeoDirecao; unidade: CeoUnidade; nota?: string }
): CeoKpi {
  const meses = linha?.meses ?? [];
  const mesData = meses.find((m) => m.mes === opts.mesNum);
  const serie = meses
    .filter((m) => m.mes <= opts.mesNum && m.realizado !== null)
    .map((m) => m.realizado as number);
  return {
    key: opts.key,
    label: opts.label,
    valor: mesData?.realizado ?? null,
    unidade: opts.unidade,
    meta: mesData?.orcado ?? null,
    atingimentoPct: mesData?.atingimento ?? null,
    direcao: opts.direcao,
    mom: null,
    sparkline: serie.length ? serie : null,
    status: "ok",
    nota: opts.nota,
  };
}

// Variação percentual (1 casa) do último ponto vs o anterior; null se <2 pontos ou base 0.
export function momFromSerie(serie: number[] | null | undefined): number | null {
  if (!serie || serie.length < 2) return null;
  const atual = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}

// KPI de fonte própria (sem meta no BP): valor pontual + série opcional p/ sparkline/MoM.
export function simpleKpi(opts: {
  key: string;
  label: string;
  valor: number | null;
  unidade: CeoUnidade;
  direcao: CeoDirecao;
  serie?: number[] | null;
  nota?: string;
}): CeoKpi {
  const serie = opts.serie && opts.serie.length ? opts.serie : null;
  return {
    key: opts.key,
    label: opts.label,
    valor: opts.valor,
    unidade: opts.unidade,
    meta: null,
    atingimentoPct: null,
    direcao: opts.direcao,
    mom: momFromSerie(serie),
    sparkline: serie,
    status: "sem_meta",
    nota: opts.nota,
  };
}

// KPI placeholder "em breve" (ex.: NPS de clientes, sem fonte de dados).
export function emBreveKpi(opts: { key: string; label: string; unidade: CeoUnidade; nota?: string }): CeoKpi {
  return {
    key: opts.key,
    label: opts.label,
    valor: null,
    unidade: opts.unidade,
    meta: null,
    atingimentoPct: null,
    direcao: "maior_melhor",
    mom: null,
    sparkline: null,
    status: "em_breve",
    nota: opts.nota,
  };
}

export interface CeoSources {
  bpLinhas: BpLinha[];
  bpMetricas: BpLinha[];
  mesNum: number;
  inadimplencia: { total: number | null; serie: number[] | null };
  ltvMedioCliente: number | null;
  enpsScore: number | null;
}

// Monta os 11 KPIs na ordem fixa da grade (4 / 4 / 3).
export function assembleCeoKpis(s: CeoSources): CeoKpi[] {
  const find = (arr: BpLinha[], metrica: string) => arr.find((l) => l.metrica === metrica);
  const bp = (
    arr: BpLinha[], metrica: string, key: string, label: string, direcao: CeoDirecao, unidade: CeoUnidade
  ) => bpLinhaToKpi(find(arr, metrica), { key, label, mesNum: s.mesNum, direcao, unidade });

  return [
    bp(s.bpMetricas, "receita_total",  "receita",        "Receita",           "maior_melhor", "brl"),
    bp(s.bpMetricas, "despesa_total",  "custos",         "Custos & Despesas", "menor_melhor", "brl"),
    bp(s.bpLinhas,   "ebitda",         "lucro",          "Lucro (EBITDA)",    "maior_melhor", "brl"),
    bp(s.bpMetricas, "saldo_caixa",    "caixa",          "Saldo de Caixa",    "maior_melhor", "brl"),
    simpleKpi({ key: "inadimplencia", label: "Inadimplência Total", valor: s.inadimplencia.total, unidade: "brl", direcao: "menor_melhor", serie: s.inadimplencia.serie }),
    emBreveKpi({ key: "nps", label: "NPS Clientes", unidade: "score", nota: "Sem fonte de dados de NPS de clientes ainda" }),
    bp(s.bpLinhas,   "cac",            "cac",            "CAC",               "menor_melhor", "brl"),
    simpleKpi({ key: "ltv", label: "LTV", valor: s.ltvMedioCliente, unidade: "brl", direcao: "maior_melhor" }),
    bp(s.bpMetricas, "colaboradores",  "headcount",      "Headcount",         "menor_melhor", "int"),
    simpleKpi({ key: "enps", label: "E-NPS", valor: s.enpsScore, unidade: "score", direcao: "maior_melhor" }),
    bp(s.bpMetricas, "receita_cabeca", "receita_cabeca", "Receita / Cabeça",  "maior_melhor", "brl"),
  ];
}

// Guard de acesso: admin OU allowedRoutes inclui /ceo-dashboard.
export function canAccessCeo(user: { role?: string; allowedRoutes?: string[] } | undefined | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Array.isArray(user.allowedRoutes) && user.allowedRoutes.includes("/ceo-dashboard");
}

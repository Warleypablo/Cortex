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
    // *100 p/ converter razão→%; Math.round(...*1000)/10 evita ruído de ponto flutuante (ex.: 1.1*100 = 110.00000000000001).
    atingimentoPct: mesData?.atingimento != null ? Math.round(mesData.atingimento * 1000) / 10 : null,
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

// Reconstrói a linha "Receita por Cabeça" com o numerador em regime de CAIXA (receita
// efetivamente recebida / DFC) em vez de faturável (competência). A META (orcado) e a
// estrutura de meses são herdadas da linha original do BP — só o realizado/atingimento
// passam a refletir o recebido. Fica isolado no CEO Dashboard; o BP 2026 não muda.
export function receitaCabecaCaixaLinha(
  original: BpLinha | undefined,
  colaboradores: BpLinha | undefined,
  recebidoPorMes: Record<number, number> | undefined
): BpLinha {
  const rec = recebidoPorMes ?? {};
  const headPorMes = new Map<number, number | null>(
    (colaboradores?.meses ?? []).map((m) => [m.mes, m.realizado])
  );
  const meses = (original?.meses ?? []).map((m) => {
    const head = headPorMes.get(m.mes) ?? null;
    const recebido = rec[m.mes];
    const realizado = recebido != null && head != null && head !== 0 ? recebido / head : null;
    const atingimento = realizado != null && m.orcado ? realizado / m.orcado : null;
    return { mes: m.mes, orcado: m.orcado, realizado, atingimento };
  });
  return { metrica: "receita_cabeca", titulo: original?.titulo, direcao: "maior_melhor", unidade: "brl", meses };
}

// Extrai do payload do BP os ingredientes e monta a linha de Receita/Cabeça em caixa.
// Fonte única para card (assembleCeoKpis) e drawer (buildCeoDetalhe) — garante reconciliação.
export function receitaCabecaCaixaFromBp(bp: {
  metricasGerais?: BpLinha[];
  receitaRecebidaCaixaPorMes?: Record<number, number>;
}): BpLinha {
  const metricas = bp.metricasGerais ?? [];
  return receitaCabecaCaixaLinha(
    metricas.find((l) => l.metrica === "receita_cabeca"),
    metricas.find((l) => l.metrica === "colaboradores"),
    bp.receitaRecebidaCaixaPorMes
  );
}

// Linha "Receita" em regime de CAIXA (receita efetivamente recebida / DFC) no lugar da
// receita por competência. Meta e estrutura de meses herdadas da linha receita_total do BP.
// Garante a identidade Receita ÷ Headcount = Receita/Cabeça (as duas usam o mesmo recebido).
export function receitaRecebidaLinha(
  original: BpLinha | undefined,
  recebidoPorMes: Record<number, number> | undefined
): BpLinha {
  const rec = recebidoPorMes ?? {};
  const meses = (original?.meses ?? []).map((m) => {
    const realizado = rec[m.mes] ?? null;
    const atingimento = realizado != null && m.orcado ? realizado / m.orcado : null;
    return { mes: m.mes, orcado: m.orcado, realizado, atingimento };
  });
  return { metrica: "receita_total", titulo: original?.titulo, direcao: "maior_melhor", unidade: "brl", meses };
}

export function receitaRecebidaFromBp(bp: {
  metricasGerais?: BpLinha[];
  receitaRecebidaCaixaPorMes?: Record<number, number>;
}): BpLinha {
  const metricas = bp.metricasGerais ?? [];
  return receitaRecebidaLinha(
    metricas.find((l) => l.metrica === "receita_total"),
    bp.receitaRecebidaCaixaPorMes
  );
}

// Linha "Geração de Caixa" da matriz: o simples — Receita recebida (caixa) − Despesa
// Total — para fechar com as linhas Receita e Custos da tabela ("um menos o outro",
// Ichino 2026-07-09). META segue PRECISAMENTE o BP: orçado da linha geracao_caixa
// do DRE (EBITDA − impostos diretos − CAPEX), nunca meta derivada.
export function geracaoCaixaLinha(
  receitaTotal: BpLinha | undefined,
  despesaTotal: BpLinha | undefined,
  geracaoBp: BpLinha | undefined,
  recebidoPorMes: Record<number, number> | undefined
): BpLinha {
  const rec = recebidoPorMes ?? {};
  const despPorMes = new Map(
    (despesaTotal?.meses ?? []).map((m) => [m.mes, m.realizado])
  );
  const orcadoPorMes = new Map((geracaoBp?.meses ?? []).map((m) => [m.mes, m.orcado]));
  const meses = (receitaTotal?.meses ?? []).map((m) => {
    const despesa = despPorMes.get(m.mes);
    const recebido = rec[m.mes];
    const realizado = recebido != null && despesa != null ? recebido - despesa : null;
    const orcado = orcadoPorMes.get(m.mes) ?? 0;
    const atingimento = realizado != null && orcado ? realizado / orcado : null;
    return { mes: m.mes, orcado, realizado, atingimento };
  });
  return { metrica: "geracao_caixa", titulo: "Geração de Caixa", direcao: "maior_melhor", unidade: "brl", meses };
}

export function geracaoCaixaFromBp(bp: {
  linhas?: BpLinha[];
  metricasGerais?: BpLinha[];
  receitaRecebidaCaixaPorMes?: Record<number, number>;
}): BpLinha {
  const metricas = bp.metricasGerais ?? [];
  return geracaoCaixaLinha(
    metricas.find((l) => l.metrica === "receita_total"),
    metricas.find((l) => l.metrica === "despesa_total"),
    (bp.linhas ?? []).find((l) => l.metrica === "geracao_caixa"),
    bp.receitaRecebidaCaixaPorMes
  );
}

export interface CeoSources {
  bpLinhas: BpLinha[];
  bpMetricas: BpLinha[];
  mesNum: number;
  inadimplencia: { total: number | null; serie: number[] | null };
  ltvMedioCliente: number | null;
  enpsScore: number | null;
  // Linhas já reconstruídas em regime de caixa (recebido/DFC) — ver *FromBp helpers.
  receitaRecebida: BpLinha;
  receitaCabecaCaixa: BpLinha;
}

// Monta os 11 KPIs na ordem fixa da grade (4 / 4 / 3).
export function assembleCeoKpis(s: CeoSources): CeoKpi[] {
  const find = (arr: BpLinha[], metrica: string) => arr.find((l) => l.metrica === metrica);
  const bp = (
    arr: BpLinha[], metrica: string, key: string, label: string, direcao: CeoDirecao, unidade: CeoUnidade
  ) => bpLinhaToKpi(find(arr, metrica), { key, label, mesNum: s.mesNum, direcao, unidade });

  return [
    // Receita em regime de caixa (recebido/DFC); meta = plano de receita do BP.
    // Mesma base da Receita/Cabeça, então Receita ÷ Headcount = Receita/Cabeça.
    bpLinhaToKpi(s.receitaRecebida, {
      key: "receita", label: "Receita", mesNum: s.mesNum, direcao: "maior_melhor", unidade: "brl",
      nota: "Receita efetivamente recebida no mês (regime de caixa · DFC). Meta = plano de receita do BP.",
    }),
    bp(s.bpMetricas, "despesa_total",  "custos",         "Custos & Despesas", "menor_melhor", "brl"),
    bp(s.bpLinhas,   "ebitda",         "lucro",          "Lucro (EBITDA)",    "maior_melhor", "brl"),
    bp(s.bpMetricas, "saldo_caixa",    "caixa",          "Saldo de Caixa",    "maior_melhor", "brl"),
    simpleKpi({ key: "inadimplencia", label: "Inadimplência Total", valor: s.inadimplencia.total, unidade: "brl", direcao: "menor_melhor", serie: s.inadimplencia.serie }),
    emBreveKpi({ key: "nps", label: "NPS Clientes", unidade: "score", nota: "Sem fonte de dados de NPS de clientes ainda" }),
    bp(s.bpLinhas,   "cac",            "cac",            "CAC",               "menor_melhor", "brl"),
    simpleKpi({ key: "ltv", label: "LTV", valor: s.ltvMedioCliente, unidade: "brl", direcao: "maior_melhor" }),
    bp(s.bpMetricas, "colaboradores",  "headcount",      "Headcount",         "menor_melhor", "int"),
    simpleKpi({ key: "enps", label: "E-NPS", valor: s.enpsScore, unidade: "score", direcao: "maior_melhor" }),
    // Receita/Cabeça em regime de caixa (recebido/DFC); a meta segue o plano de receita do BP.
    bpLinhaToKpi(s.receitaCabecaCaixa, {
      key: "receita_cabeca", label: "Receita / Cabeça", mesNum: s.mesNum, direcao: "maior_melhor", unidade: "brl",
      nota: "Realizado = receita efetivamente recebida no mês (regime de caixa · DFC) ÷ headcount. Meta = plano de receita do BP.",
    }),
  ];
}

// Guard de acesso: admin OU allowedRoutes inclui /ceo-dashboard.
export function canAccessCeo(user: { role?: string; allowedRoutes?: string[] } | undefined | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Array.isArray(user.allowedRoutes) && user.allowedRoutes.includes("/ceo-dashboard");
}

// "2026-06" -> 6. BP é fixo em ANO=2026; fora disso cai no mês corrente informado.
export function parseMesNum(mes: string | undefined, mesCorrente: number): number {
  if (!mes) return mesCorrente;
  const m = /^2026-(\d{2})$/.exec(mes);
  if (!m) return mesCorrente;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 12 ? n : mesCorrente;
}

import { useQueries } from '@tanstack/react-query';
import type {
  TvLeaderboardData,
  SquadKpi,
  SquadCrescimento,
  MetaFaturamento,
  RankingPessoa,
  KpisGlobais,
  BadgePessoa,
} from '@/components/tv-leaderboard/types';
import { getSquadColor } from '@/lib/squadColors';

const META_FATURAMENTO_2026 = 25_000_000;
const STALE_MS = 5 * 60 * 1000;

// ---------- helpers de data ----------
function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getCurrentMesAno(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function getPrevMesAno(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`;
}

function getCurrentMonthRange(): { dataInicio: string; dataFim: string } {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { dataInicio: formatDate(inicio), dataFim: formatDate(fim) };
}

function getPrevMonthRange(): { dataInicio: string; dataFim: string } {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fim = new Date(now.getFullYear(), now.getMonth(), 0);
  return { dataInicio: formatDate(inicio), dataFim: formatDate(fim) };
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function daysLeftInYear(d: Date): number {
  const end = new Date(d.getFullYear(), 11, 31);
  return Math.max(1, Math.ceil((end.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

// ---------- fetch helper ----------
async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Request failed ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

// ---------- builders ----------
function buildMeta(receitaYtd: number): MetaFaturamento {
  const now = new Date();
  const meta = META_FATURAMENTO_2026;
  const pctAtingido = meta > 0 ? (receitaYtd / meta) * 100 : 0;
  const pctEsperado = (dayOfYear(now) / 365) * 100;
  const ritmoNecessarioDia = (meta - receitaYtd) / daysLeftInYear(now);
  let status: MetaFaturamento['status'];
  if (pctAtingido >= pctEsperado) status = 'no-ritmo';
  else if (pctAtingido >= pctEsperado - 10) status = 'atras';
  else status = 'critico';

  return {
    realizadoYtd: receitaYtd,
    meta,
    pctAtingido,
    ritmoNecessarioDia,
    status,
  };
}

type AnaliseSquadRow = {
  squad: string;
  mrr: number;
  contratos: number;
  clientes: number;
  churns: number;
  mrrChurn: number;
  churnRate: number;
  ticketMedio: number;
};

type AnaliseSquadsResp = {
  squads: AnaliseSquadRow[];
  evolucao: {
    mrr: Array<{ mes: string; squad: string; mrr_total: number | string }>;
    churns: Array<{ mes: string; squad: string; mrr_churn: number | string }>;
  };
  squadsLista: string[];
};

function buildSquadsAndCrescimento(
  current: AnaliseSquadsResp | undefined,
  prev: AnaliseSquadsResp | undefined,
  nrrGlobalPct: number,
  nrrGlobalDelta: number,
): { squads: SquadKpi[]; crescimentoSquads: SquadCrescimento[] } {
  if (!current) return { squads: [], crescimentoSquads: [] };

  const prevMrrBySquad = new Map<string, number>();
  for (const s of prev?.squads ?? []) prevMrrBySquad.set(s.squad, s.mrr);

  const sparklineBySquad = new Map<string, number[]>();
  const evoMap = new Map<string, Map<string, number>>();
  for (const row of current.evolucao?.mrr ?? []) {
    const sqMap = evoMap.get(row.squad) ?? new Map<string, number>();
    sqMap.set(row.mes, Number(row.mrr_total) || 0);
    evoMap.set(row.squad, sqMap);
  }
  Array.from(evoMap.entries()).forEach(([squad, mesesMap]) => {
    const sorted = Array.from(mesesMap.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map((entry) => entry[1] as number);
    sparklineBySquad.set(squad, sorted.slice(-6));
  });

  const ordered = [...current.squads].filter(s => s.squad !== 'Sem Squad');
  const crescimento = ordered
    .map((s, i) => ({
      squad: s.squad,
      cor: getSquadColor(s.squad, i),
      delta: s.mrr - (prevMrrBySquad.get(s.squad) ?? s.mrr),
    }))
    .sort((a, b) => b.delta - a.delta);

  const topGrowthSquad = crescimento[0]?.squad;
  const lowestChurnSquad = [...ordered]
    .filter(s => s.mrr > 0)
    .sort((a, b) => a.mrrChurn - b.mrrChurn)[0]?.squad;

  const squads: SquadKpi[] = ordered.map((s, i) => {
    const spark = sparklineBySquad.get(s.squad) ?? [];
    const sparkline = spark.length > 0 ? spark : Array(6).fill(s.mrr);
    const churnPct = s.churnRate ?? (s.mrr > 0 ? (s.mrrChurn / s.mrr) * 100 : 0);
    const badges: SquadKpi['badges'] = [];
    if (s.squad === topGrowthSquad) badges.push('crescimento');
    if (s.squad === lowestChurnSquad) badges.push('menor-churn');

    return {
      squad: s.squad,
      cor: getSquadColor(s.squad, i),
      mrrAtivo: s.mrr,
      nrrPct: nrrGlobalPct,
      nrrDeltaPct: nrrGlobalDelta,
      churnValor: s.mrrChurn,
      churnPct,
      sparkline,
      badges,
    };
  });

  // Devolve TODOS já ordenados; UI corta top 3 após aplicar filtros visuais
  const crescimentoSquads: SquadCrescimento[] = crescimento.map((c, idx) => ({
    squad: c.squad,
    cor: c.cor,
    delta: c.delta,
    posicao: Math.min(idx + 1, 3) as 1 | 2 | 3,
  }));

  return { squads, crescimentoSquads };
}

// ---------- agregação por operador (responsavel_geral) ----------
type EvolucaoMensalResp = {
  mrr: Array<{ mes: string; squad: string | null; responsavel: string | null; mrr_total: number | string }>;
  churns: Array<{ mes: string; squad: string | null; responsavel: string | null; mrr_churn: number | string; churns: number | string }>;
  squads: string[];
  operadores: string[];
};

type PessoaStats = {
  responsavel: string;
  squad: string;
  mrrAtivo: number;
  mrrChurnAcum: number;
  // Serie histórica MRR por mês (chave YYYY-MM)
  serieMrr: Map<string, number>;
};

const MIN_BASE_ATIVA = 1000;

function normalizeNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

type Colaborador = {
  nome?: string | null;
  emailTurbo?: string | null;
  email_turbo?: string | null;
  picture?: string | null;
};

function buildAvatarResolver(
  colaboradores: Colaborador[] | undefined,
  userPhotos: Record<string, string> | undefined,
): (nome: string) => string | null {
  const byNome = new Map<string, string>();
  const lista = Array.isArray(colaboradores) ? colaboradores : [];
  for (const c of lista) {
    const nome = c.nome ?? '';
    if (!nome) continue;
    if (c.picture) {
      byNome.set(normalizeNome(nome), c.picture);
      continue;
    }
    const email = (c.emailTurbo ?? c.email_turbo ?? '').toLowerCase().trim();
    if (email && userPhotos?.[email]) {
      byNome.set(normalizeNome(nome), userPhotos[email]);
    }
  }
  return (nome: string) => byNome.get(normalizeNome(nome)) ?? null;
}

function isInvalidResponsavel(r: string | null | undefined): boolean {
  if (!r) return true;
  const t = r.trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  return lower === 'sem responsável' || lower === 'sem responsavel' || lower === 'não atribuído' || lower === 'nao atribuido';
}

function novoStats(responsavel: string, squad: string | null): PessoaStats {
  return {
    responsavel,
    squad: squad ?? '',
    mrrAtivo: 0,
    mrrChurnAcum: 0,
    serieMrr: new Map(),
  };
}

function aggregateByOperador(
  evo: EvolucaoMensalResp | undefined,
  mesAtual: string,
): Map<string, PessoaStats> {
  const map = new Map<string, PessoaStats>();
  if (!evo) return map;

  // Constrói série mensal completa de MRR por pessoa e marca MRR atual
  for (const row of evo.mrr ?? []) {
    if (isInvalidResponsavel(row.responsavel)) continue;
    const key = row.responsavel!.trim();
    const prev = map.get(key) ?? novoStats(key, row.squad);
    const valor = Number(row.mrr_total) || 0;
    prev.serieMrr.set(row.mes, (prev.serieMrr.get(row.mes) ?? 0) + valor);
    if (row.mes === mesAtual) prev.mrrAtivo += valor;
    if (!prev.squad && row.squad) prev.squad = row.squad;
    map.set(key, prev);
  }

  // Churn: acumulado em toda a janela retornada (até 12 meses) para gerar variância
  for (const row of evo.churns ?? []) {
    if (isInvalidResponsavel(row.responsavel)) continue;
    const key = row.responsavel!.trim();
    const prev = map.get(key) ?? novoStats(key, row.squad);
    prev.mrrChurnAcum += Number(row.mrr_churn) || 0;
    if (!prev.squad && row.squad) prev.squad = row.squad;
    map.set(key, prev);
  }

  return map;
}

function serieParaSparkline(serie: Map<string, number>): number[] {
  return Array.from(serie.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function tendenciaPct(serie: number[]): number {
  if (serie.length < 2) return 0;
  const ultimo = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  if (!anterior) return 0;
  return ((ultimo - anterior) / anterior) * 100;
}

function buildKpisGlobais(stats: PessoaStats[]): KpisGlobais {
  const operadoresAtivos = stats.filter((s) => s.mrrAtivo > 0).length;
  const mrrTotalBase = stats.reduce((acc, s) => acc + s.mrrAtivo, 0);
  const churnAcumulado6m = stats.reduce((acc, s) => acc + s.mrrChurnAcum, 0);
  return { operadoresAtivos, mrrTotalBase, churnAcumulado6m };
}

function badgesPara(
  s: PessoaStats,
  spark: number[],
  tend: number,
  topCrescimento: Set<string>,
): BadgePessoa[] {
  const badges: BadgePessoa[] = [];
  if (s.mrrChurnAcum === 0 && s.mrrAtivo > 0) badges.push('sem-churn');
  // streak: subiu nos últimos 3 meses consecutivos
  if (spark.length >= 3) {
    const ultimos = spark.slice(-3);
    if (ultimos[2] > ultimos[1] && ultimos[1] > ultimos[0]) badges.push('streak');
  }
  if (topCrescimento.has(s.responsavel) && tend > 0) badges.push('top-crescimento');
  return badges;
}

const RANKING_LIMITE = 15;

function topCrescimentoSet(stats: PessoaStats[]): Set<string> {
  const comTendencia = stats
    .filter((s) => s.mrrAtivo >= MIN_BASE_ATIVA)
    .map((s) => ({
      responsavel: s.responsavel,
      tend: tendenciaPct(serieParaSparkline(s.serieMrr)),
    }))
    .filter((x) => x.tend > 0)
    .sort((a, b) => b.tend - a.tend)
    .slice(0, 3);
  return new Set(comTendencia.map((x) => x.responsavel));
}

function montaPessoa(
  s: PessoaStats,
  i: number,
  valor: number,
  prefix: string,
  topGrowth: Set<string>,
): RankingPessoa {
  const sparkline = serieParaSparkline(s.serieMrr);
  const tend = tendenciaPct(sparkline);
  return {
    id: `${prefix}-${s.responsavel}`,
    nome: s.responsavel,
    avatarUrl: null,
    squad: s.squad,
    corSquad: getSquadColor(s.squad, i),
    valor,
    posicaoAtual: i + 1,
    posicaoAnterior: null,
    sparkline,
    tendenciaPct: tend,
    badges: badgesPara(s, sparkline, tend, topGrowth),
  };
}

function buildRankingMrrAtivo(stats: PessoaStats[]): RankingPessoa[] {
  const top = topCrescimentoSet(stats);
  return stats
    .filter((s) => s.mrrAtivo >= MIN_BASE_ATIVA)
    .sort((a, b) => b.mrrAtivo - a.mrrAtivo)
    .slice(0, RANKING_LIMITE)
    .map((s, i) => montaPessoa(s, i, s.mrrAtivo, 'mrr', top));
}

function buildRankingAntiChurn(stats: PessoaStats[]): RankingPessoa[] {
  // MRR Retido = base ativa − churn acumulado 6m. Combina "proteger base grande" com "evitar churn":
  // base 285k com 0 churn ⇒ 285k; base 200k com 2k churn ⇒ 198k; base 5k com 0 churn ⇒ 5k.
  const top = topCrescimentoSet(stats);
  return stats
    .filter((s) => s.mrrAtivo >= MIN_BASE_ATIVA)
    .map((s) => ({ s, retido: s.mrrAtivo - s.mrrChurnAcum }))
    .sort((a, b) => b.retido - a.retido)
    .slice(0, RANKING_LIMITE)
    .map((x, i) => montaPessoa(x.s, i, x.retido, 'mrr-retido', top));
}

function buildRankingNrr(stats: PessoaStats[]): RankingPessoa[] {
  const top = topCrescimentoSet(stats);
  return stats
    .filter((s) => s.mrrAtivo >= MIN_BASE_ATIVA)
    .map((s) => ({ s, nrr: (s.mrrAtivo / (s.mrrAtivo + s.mrrChurnAcum)) * 100 }))
    .sort((a, b) => {
      if (b.nrr !== a.nrr) return b.nrr - a.nrr;
      return b.s.mrrAtivo - a.s.mrrAtivo;
    })
    .slice(0, RANKING_LIMITE)
    .map((x, i) => montaPessoa(x.s, i, x.nrr, 'nrr', top));
}

// ---------- hook ----------
export function useTvLeaderboardData() {
  const mesAtual = getCurrentMesAno();
  const mesAnterior = getPrevMesAno();
  const { dataInicio, dataFim } = getCurrentMonthRange();
  const prevRange = getPrevMonthRange();

  const queries = useQueries({
    queries: [
      {
        queryKey: ['tv', 'okr-summary'],
        queryFn: () => fetchJson<any>('/api/okr2026/summary?period=YTD'),
        staleTime: STALE_MS,
      },
      {
        queryKey: ['tv', 'analise-squads', mesAtual],
        queryFn: () =>
          fetchJson<AnaliseSquadsResp>(`/api/analise-squads?mesAno=${mesAtual}`),
        staleTime: STALE_MS,
      },
      {
        queryKey: ['tv', 'analise-squads', mesAnterior],
        queryFn: () =>
          fetchJson<AnaliseSquadsResp>(`/api/analise-squads?mesAno=${mesAnterior}`),
        staleTime: STALE_MS,
      },
      {
        queryKey: ['tv', 'nrr', dataInicio, dataFim],
        queryFn: () =>
          fetchJson<{ nrr_pct: number }>(
            `/api/analytics/nrr?startDate=${dataInicio}&endDate=${dataFim}`,
          ),
        staleTime: STALE_MS,
      },
      {
        queryKey: ['tv', 'nrr', prevRange.dataInicio, prevRange.dataFim],
        queryFn: () =>
          fetchJson<{ nrr_pct: number }>(
            `/api/analytics/nrr?startDate=${prevRange.dataInicio}&endDate=${prevRange.dataFim}`,
          ),
        staleTime: STALE_MS,
      },
      {
        queryKey: ['tv', 'evolucao-mensal', 6],
        queryFn: () =>
          fetchJson<EvolucaoMensalResp>(`/api/dashboard/evolucao-mensal?meses=6`),
        staleTime: STALE_MS,
      },
      {
        queryKey: ['tv', 'colaboradores'],
        queryFn: () => fetchJson<any[]>('/api/colaboradores'),
        staleTime: STALE_MS,
      },
      {
        queryKey: ['tv', 'user-photos'],
        queryFn: () => fetchJson<Record<string, string>>('/api/user-photos'),
        staleTime: STALE_MS,
      },
    ],
  });

  const [okrQ, squadsCurQ, squadsPrevQ, nrrCurQ, nrrPrevQ, evoQ, colabQ, photosQ] = queries;

  // Bloqueia loading apenas nas queries críticas; secundárias podem demorar/falhar sem travar TV
  const isLoading = okrQ.isLoading || squadsCurQ.isLoading;
  const error = queries.find(q => q.error)?.error as Error | undefined;
  const dataUpdatedAt = Math.max(...queries.map(q => q.dataUpdatedAt || 0));

  let data: TvLeaderboardData | undefined;
  if (okrQ.data && squadsCurQ.data) {
    const receitaYtd = Number(okrQ.data?.metrics?.receita_total_ytd) || 0;
    const nrrCur = Number(nrrCurQ.data?.nrr_pct) || 0;
    const nrrPrev = Number(nrrPrevQ.data?.nrr_pct) || 0;

    const meta = buildMeta(receitaYtd);
    const { squads, crescimentoSquads } = buildSquadsAndCrescimento(
      squadsCurQ.data,
      squadsPrevQ.data,
      nrrCur,
      nrrCur - nrrPrev,
    );

    const statsMap = aggregateByOperador(evoQ.data, mesAtual);
    const stats = Array.from(statsMap.values());

    const resolveAvatar = buildAvatarResolver(colabQ.data, photosQ.data);
    const aplicarAvatar = (lista: RankingPessoa[]) =>
      lista.map((p) => ({ ...p, avatarUrl: resolveAvatar(p.nome) }));

    data = {
      meta,
      squads,
      crescimentoSquads,
      rankingMrr: aplicarAvatar(buildRankingMrrAtivo(stats)),
      rankingNrr: aplicarAvatar(buildRankingNrr(stats)),
      rankingAntiChurn: aplicarAvatar(buildRankingAntiChurn(stats)),
      kpisGlobais: buildKpisGlobais(stats),
    };
  }

  if (evoQ.error) {
    // eslint-disable-next-line no-console
    console.error('[tv-leaderboard] evolucao-mensal falhou:', evoQ.error);
  }

  return {
    data,
    isLoading,
    error,
    dataUpdatedAt: dataUpdatedAt || Date.now(),
    rankingsLoading: evoQ.isLoading,
    rankingsError: evoQ.error as Error | undefined,
  };
}

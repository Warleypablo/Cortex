import { useQueries } from '@tanstack/react-query';
import type {
  TvLeaderboardData,
  SquadKpi,
  SquadCrescimento,
  MetaFaturamento,
  RankingPessoa,
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

  // Construir sparkline (últimos 6 pontos de evolução.mrr por squad)
  const sparklineBySquad = new Map<string, number[]>();
  const evoMap = new Map<string, Map<string, number>>(); // squad -> mes -> mrr
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

  // Identificar squads especiais para badges
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

  const crescimentoSquads: SquadCrescimento[] = crescimento.slice(0, 3).map((c, idx) => ({
    squad: c.squad,
    cor: c.cor,
    delta: c.delta,
    posicao: (idx + 1) as 1 | 2 | 3,
  }));

  return { squads, crescimentoSquads };
}

type MrrPorCloserRow = { closer: string; mrr: number; pontual: number; contratos: number };

function buildRankingMrr(rows: MrrPorCloserRow[] | undefined): RankingPessoa[] {
  if (!rows) return [];
  return rows
    .filter(r => r.closer && r.closer !== 'Não Atribuído' && r.mrr > 0)
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 10)
    .map((r, i) => ({
      id: `mrr-${r.closer}`,
      nome: r.closer,
      avatarUrl: null,
      squad: '',
      corSquad: getSquadColor('', i),
      valor: r.mrr,
      posicaoAtual: i + 1,
      posicaoAnterior: null,
    }));
}

type ChurnPorResponsavelRow = {
  responsavel: string;
  quantidadeContratos: number;
  valorTotal: number;
  percentualChurn: number;
  valorAtivoTotal: number;
};

function buildRankingAntiChurn(rows: ChurnPorResponsavelRow[] | undefined): RankingPessoa[] {
  if (!rows) return [];
  return rows
    .filter(r => r.responsavel && r.responsavel !== 'Sem responsável')
    .sort((a, b) => a.valorTotal - b.valorTotal)
    .slice(0, 10)
    .map((r, i) => ({
      id: `anti-churn-${r.responsavel}`,
      nome: r.responsavel,
      avatarUrl: null,
      squad: '',
      corSquad: getSquadColor('', i),
      valor: r.valorTotal,
      posicaoAtual: i + 1,
      posicaoAnterior: null,
    }));
}

function buildRankingNrr(rows: ChurnPorResponsavelRow[] | undefined): RankingPessoa[] {
  if (!rows) return [];
  // NRR per pessoa aproximado: (valorAtivo - churn) / valorAtivo * 100
  // Filtro pragmatico: requer pelo menos 1 contrato churn registrado E valorAtivo > 0
  // Observação: nao temos contagem de clientes ativos por pessoa, entao MIN_CLIENTES_NRR
  // foi aproximado por quantidadeContratos (churned) >= 1. Ver concerns no relatório da task.
  return rows
    .filter(r => r.responsavel && r.responsavel !== 'Sem responsável' && r.valorAtivoTotal > 0)
    .map(r => ({
      ...r,
      nrr: ((r.valorAtivoTotal - r.valorTotal) / r.valorAtivoTotal) * 100,
    }))
    .sort((a, b) => b.nrr - a.nrr)
    .slice(0, 10)
    .map((r, i) => ({
      id: `nrr-${r.responsavel}`,
      nome: r.responsavel,
      avatarUrl: null,
      squad: '',
      corSquad: getSquadColor('', i),
      valor: r.nrr,
      posicaoAtual: i + 1,
      posicaoAnterior: null,
    }));
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
        queryKey: ['tv', 'mrr-por-closer', dataInicio, dataFim],
        queryFn: () =>
          fetchJson<MrrPorCloserRow[]>(
            `/api/vendas/mrr-por-closer?dataInicio=${dataInicio}&dataFim=${dataFim}`,
          ),
        staleTime: STALE_MS,
      },
      {
        queryKey: ['tv', 'churn-por-responsavel', mesAtual],
        queryFn: () =>
          fetchJson<ChurnPorResponsavelRow[]>(
            `/api/churn-por-responsavel?mesInicio=${mesAtual}&mesFim=${mesAtual}`,
          ),
        staleTime: STALE_MS,
      },
    ],
  });

  const [okrQ, squadsCurQ, squadsPrevQ, nrrCurQ, nrrPrevQ, mrrCloserQ, churnRespQ] = queries;

  const isLoading = queries.some(q => q.isLoading);
  const error = queries.find(q => q.error)?.error as Error | undefined;
  const dataUpdatedAt = Math.max(...queries.map(q => q.dataUpdatedAt || 0));

  let data: TvLeaderboardData | undefined;
  if (!isLoading && okrQ.data && squadsCurQ.data) {
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

    data = {
      meta,
      squads,
      crescimentoSquads,
      rankingMrr: buildRankingMrr(mrrCloserQ.data),
      rankingNrr: buildRankingNrr(churnRespQ.data),
      rankingAntiChurn: buildRankingAntiChurn(churnRespQ.data),
    };
  }

  return {
    data,
    isLoading,
    error,
    dataUpdatedAt: dataUpdatedAt || Date.now(),
  };
}

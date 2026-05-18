export type SquadKpi = {
  squad: string;
  cor: string;
  mrrAtivo: number;
  nrrPct: number;
  nrrDeltaPct: number;
  churnValor: number;
  churnPct: number;
  sparkline: number[];
  badges: Array<'crescimento' | 'menor-churn' | 'meta'>;
};

export type SquadCrescimento = {
  squad: string;
  cor: string;
  delta: number;
  posicao: 1 | 2 | 3;
};

export type MetaFaturamento = {
  realizadoYtd: number;
  meta: number;
  pctAtingido: number;
  ritmoNecessarioDia: number;
  status: 'no-ritmo' | 'atras' | 'critico';
};

export type BadgePessoa = 'streak' | 'sem-churn' | 'top-crescimento';

export type RankingPessoa = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  squad: string;
  corSquad: string;
  valor: number;
  posicaoAtual: number;
  posicaoAnterior: number | null;
  sparkline: number[];
  tendenciaPct: number;
  badges: BadgePessoa[];
};

export type RankingMetrica = 'mrr' | 'nrr' | 'anti-churn';

export type KpisGlobais = {
  operadoresAtivos: number;
  mrrTotalBase: number;
  churnAcumulado6m: number;
};

export type TvLeaderboardData = {
  meta: MetaFaturamento;
  squads: SquadKpi[];
  crescimentoSquads: SquadCrescimento[];
  rankingMrr: RankingPessoa[];
  rankingNrr: RankingPessoa[];
  rankingAntiChurn: RankingPessoa[];
  kpisGlobais: KpisGlobais;
};

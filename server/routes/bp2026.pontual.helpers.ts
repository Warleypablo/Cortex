// server/routes/bp2026.pontual.helpers.ts
// Ponte do estoque pontual via snapshot-diff de cup_data_hist (helpers puros).
// Estoque pontual = valorp>0 e status fora da lista de exclusão. A ponte fecha:
// estoque_ini + venda − entrega − churn − deletados − saída_atípica + reajuste = estoque_fim.

export interface RegPontual {
  idSubtask: string;
  valorp: number;
  status: string;
  criadoYm?: string | null;     // 'YYYY-MM' de data_criado (cup_contratos); ausente => sem origem
  dataCriadoIso?: string | null; // 'YYYY-MM-DD' de data_criado; usado para aging e tempo médio
  squad?: string;               // squad do contrato no snapshot (p/ decomposição do estoque por squad)
  produto?: string;             // produto do contrato no snapshot (p/ expandir linhas por produto)
}

const ESTOQUE_STATUS_EXCLUDE = new Set(["entregue", "cancelado/inativo", "não usar"]);
const CHURN_STATUS = new Set(["cancelado/inativo", "não usar"]);

const ANO = 2026;

export function ehEstoquePontual(r: RegPontual): boolean {
  return r.valorp > 0 && !ESTOQUE_STATUS_EXCLUDE.has(r.status);
}

export interface PonteMes {
  estoqueIni: number;
  venda: number;          // total das 4 sub-categorias abaixo
  vendaMes: number;       // criadoYm == mês-alvo
  entradaDefasada: number;// criadoYm de mês anterior/futuro
  reativacao: number;     // estava na foto anterior fora do estoque
  semOrigem: number;      // sem registro em cup_contratos
  entrega: number;
  churn: number;
  deletados: number;
  saidaAtipica: number;
  reajuste: number;
  estoqueFim: number;
}

// IMPORTANTE: manter a árvore de classificação em sincronia com classificarPonteItens (mesma lógica; uma soma, a outra lista). Desync quebra a reconciliação drill×célula — coberto pelo teste de soma por categoria.
// Classifica a transição de cada contrato (id_subtask) entre o estoque do snapshot
// anterior e o do atual. Venda inclui contratos que (re)entraram no estoque.
export function classificarPonte(ant: RegPontual[], atual: RegPontual[], ymAlvo: string): PonteMes {
  const antMap = new Map(ant.map((r) => [r.idSubtask, r]));
  const p: PonteMes = {
    estoqueIni: 0, venda: 0, vendaMes: 0, entradaDefasada: 0, reativacao: 0, semOrigem: 0,
    entrega: 0, churn: 0, deletados: 0, saidaAtipica: 0, reajuste: 0, estoqueFim: 0,
  };
  const atualMap = new Map(atual.map((r) => [r.idSubtask, r]));
  for (const r of ant) {
    if (!ehEstoquePontual(r)) continue;
    p.estoqueIni += r.valorp;
    const a = atualMap.get(r.idSubtask);
    if (!a) { p.deletados += r.valorp; continue; }
    if (ehEstoquePontual(a)) { p.reajuste += a.valorp - r.valorp; continue; }
    if (a.status === "entregue") p.entrega += r.valorp;
    else if (CHURN_STATUS.has(a.status)) p.churn += r.valorp;
    else p.saidaAtipica += r.valorp;
  }
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    p.estoqueFim += r.valorp;
    const prev = antMap.get(r.idSubtask);
    if (prev && ehEstoquePontual(prev)) continue; // permaneceu (reajuste já tratado)
    // entrada no estoque: subdividir
    if (prev) p.reativacao += r.valorp;                 // estava na foto anterior, fora do estoque
    else if (!r.criadoYm) p.semOrigem += r.valorp;      // sem registro em cup_contratos
    else if (r.criadoYm === ymAlvo) p.vendaMes += r.valorp;
    else p.entradaDefasada += r.valorp;
    p.venda += r.valorp;
  }
  return p;
}

export function decomporStatus(atual: RegPontual[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    out[r.status] = (out[r.status] ?? 0) + r.valorp;
  }
  return out;
}

// Renames/consolidações de squad (regra de negócio): "Aura" (qualquer variante) vira "Pulse".
const SQUAD_RENAME: Array<[RegExp, string]> = [
  [/aura/i, "💠 Pulse"],
];
export function normalizarSquad(squad: string | undefined | null): string {
  const s = squad && squad.trim() ? squad : "(sem squad)";
  for (const [re, alvo] of SQUAD_RENAME) if (re.test(s)) return alvo;
  return s;
}

// Soma valorp por squad (normalizado), só do estoque (ehEstoquePontual). Soma total = estoque final.
export function decomporSquad(atual: RegPontual[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    const sq = normalizarSquad(r.squad);
    out[sq] = (out[sq] ?? 0) + r.valorp;
  }
  return out;
}

const produtoDe = (r: RegPontual) => (r.produto && r.produto.trim() ? r.produto : "(sem produto)");

// Soma valorp por produto, só do estoque (ehEstoquePontual). Soma total = estoque final.
export function decomporProduto(atual: RegPontual[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    const p = produtoDe(r);
    out[p] = (out[p] ?? 0) + r.valorp;
  }
  return out;
}

// Entrada na foto e Entrega por produto (mesma classificação de classificarPonte, agregada por produto).
// entrada = contratos que (re)entraram no estoque; entrega = contratos que viraram "entregue".
export function classificarPontePorProduto(
  ant: RegPontual[], atual: RegPontual[],
): { entrada: Record<string, number>; entrega: Record<string, number> } {
  const antMap = new Map(ant.map((r) => [r.idSubtask, r]));
  const atualMap = new Map(atual.map((r) => [r.idSubtask, r]));
  const entrada: Record<string, number> = {};
  const entrega: Record<string, number> = {};
  for (const r of ant) {
    if (!ehEstoquePontual(r)) continue;
    const a = atualMap.get(r.idSubtask);
    if (!a || ehEstoquePontual(a)) continue; // deletado ou permaneceu
    if (a.status === "entregue") entrega[produtoDe(r)] = (entrega[produtoDe(r)] ?? 0) + r.valorp;
  }
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    const prev = antMap.get(r.idSubtask);
    if (prev && ehEstoquePontual(prev)) continue; // permaneceu
    entrada[produtoDe(r)] = (entrada[produtoDe(r)] ?? 0) + r.valorp; // entrada na foto
  }
  return { entrada, entrega };
}

// Entrada na foto e Entrega por squad (mesma lógica de classificarPontePorProduto, agregada por squad).
export function classificarPontePorSquad(
  ant: RegPontual[], atual: RegPontual[],
): { entrada: Record<string, number>; entrega: Record<string, number> } {
  const antMap = new Map(ant.map((r) => [r.idSubtask, r]));
  const atualMap = new Map(atual.map((r) => [r.idSubtask, r]));
  const entrada: Record<string, number> = {};
  const entrega: Record<string, number> = {};
  for (const r of ant) {
    if (!ehEstoquePontual(r)) continue;
    const a = atualMap.get(r.idSubtask);
    if (!a || ehEstoquePontual(a)) continue;
    if (a.status === "entregue") {
      const sq = normalizarSquad(r.squad);
      entrega[sq] = (entrega[sq] ?? 0) + r.valorp;
    }
  }
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    const prev = antMap.get(r.idSubtask);
    if (prev && ehEstoquePontual(prev)) continue;
    const sq = normalizarSquad(r.squad);
    entrada[sq] = (entrada[sq] ?? 0) + r.valorp;
  }
  return { entrada, entrega };
}

// Limiar para esconder squads pequenos: < R$ 10K no mês corrente vão para "· Outros".
export const SQUAD_MIN_EXIBIR = 10000;

export const STATUS_DECOMP = [
  { chave: "ativo", titulo: "· Em execução (ativo)" },
  { chave: "triagem", titulo: "· Triagem" },
  { chave: "pausado", titulo: "· Pausado" },
  { chave: "onboarding", titulo: "· Onboarding" },
  { chave: "em cancelamento", titulo: "· Em cancelamento" },
] as const;

export interface LinhaPontual {
  metrica: string;
  titulo: string;
  tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade: "brl" | "int" | "pct";
  nota?: string;
  destaque?: boolean;
  semDetalhe?: boolean;
  grupo?: string;
  expansivel?: boolean;   // linha-pai com toggle ▶/▼ (decomposição por produto)
  paiMetrica?: string;    // sub-linha (por produto): só aparece se o pai estiver expandido
  meses: { mes: number; orcado: number; realizado: number | null; atingimento: number | null }[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

// Dois blocos, sem misturar réguas de valor:
// 1) Venda Pontual (comercial, data_criado, valor atual) = Vendas por Produto, decomposta em
//    entrou/fora do estoque (mesma régua → soma exata, auditável).
// 2) Movimento do estoque (foto/snapshot, valor do snapshot) — fecha sozinho.
export const GRUPO_VENDA = "Venda Pontual (comercial)";
export const GRUPO_ESTOQUE = "Movimento do estoque (foto do ClickUp)";
export const GRUPO_SQUAD = "Estoque pontual por squad";
export const GRUPO_ANALISE = "Análise de desempenho";

const NOTA_VENDA_COMERCIAL =
  "Quanto foi vendido no mês (data de criação do contrato em cup_contratos). " +
  "Igual à Receita Pontual de Vendas por Produto — venda bate com venda, independente do estoque.";
const NOTA_VENDA_NO_ESTOQUE =
  "Parte da venda do mês que está na foto do estoque no fim do mês.";
const NOTA_VENDA_FORA_ESTOQUE =
  "Parte da venda do mês que não está na foto do estoque no fim do mês: já entregue/cancelada, " +
  "ou criada perto do fim do mês.";
const NOTA_ENTRADA =
  "Tudo que entrou na foto do estoque no mês (novos do mês + vendas de meses anteriores + " +
  "reativações + órfãos). Clique para ver a composição. Régua do snapshot, fecha no estoque final.";

// last day of month m (1-indexed, year=2026)
const ultimoDiaMes = (m: number) => new Date(2026, m, 0);

export interface AgingBuckets { lt30: number; d30_60: number; d60_90: number; gt90: number }

// Decomposição do estoque por faixa de idade (snapshot_date - data_criado).
// Contratos sem dataCriadoIso são ignorados (não infla o bucket incorreto).
export function agingEstoque(atual: RegPontual[], snapshotDate: Date): AgingBuckets {
  const out: AgingBuckets = { lt30: 0, d30_60: 0, d60_90: 0, gt90: 0 };
  for (const r of atual) {
    if (!ehEstoquePontual(r) || !r.dataCriadoIso) continue;
    const dias = Math.floor((snapshotDate.getTime() - new Date(r.dataCriadoIso).getTime()) / 86400000);
    if (dias < 0) continue;
    if (dias < 30) out.lt30 += r.valorp;
    else if (dias < 60) out.d30_60 += r.valorp;
    else if (dias < 90) out.d60_90 += r.valorp;
    else out.gt90 += r.valorp;
  }
  return out;
}

// Tempo médio (dias) da criação até a entrega para contratos entregues no mês.
// Usa o snapshot anterior (ant = estoque do mês m-1) e o snapshot atual (atual = mês m).
export function tempoMedioEntrega(ant: RegPontual[], atual: RegPontual[], snapshotDate: Date): number | null {
  const atualMap = new Map(atual.map((r) => [r.idSubtask, r]));
  const dias: number[] = [];
  for (const r of ant) {
    if (!ehEstoquePontual(r)) continue;
    const a = atualMap.get(r.idSubtask);
    if (!a || a.status !== "entregue" || !r.dataCriadoIso) continue;
    const d = Math.floor((snapshotDate.getTime() - new Date(r.dataCriadoIso).getTime()) / 86400000);
    if (d >= 0) dias.push(d);
  }
  return dias.length ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : null;
}

// porMes[m] = registros (valorp>0) do último snapshot do mês m; m=0 é dez/2025.
// vendaComercialPorMes[m] = SUM(valorp) de cup_contratos por data_criado no mês m (= Receita Pontual).
// vendaNoEstoquePorMes[m] = parte dessa venda cujo contrato está na foto do estoque no fim do mês.
export function montarLinhasPontual(
  porMes: Record<number, RegPontual[]>,
  mesCorrente: number,
  mesFechado: number,
  vendaComercialPorMes: Record<number, number> = {},
  vendaNoEstoquePorMes: Record<number, number> = {},
  vendaPorProdutoPorMes: Record<number, Record<string, number>> = {},
  sublinhasPor: "produto" | "squad" = "produto",
): LinhaPontual[] {
  const ponte: (PonteMes | null)[] = Array.from({ length: 13 }, () => null);
  const decomp: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  const decompSquad: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  const prodFim: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  const prodEntrada: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  const prodEntrega: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  const squadEntrada: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  const squadEntrega: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  for (let m = 1; m <= 12; m++) {
    if (m > mesCorrente) continue;
    const ym = `${ANO}-${String(m).padStart(2, "0")}`;
    ponte[m] = classificarPonte(porMes[m - 1] ?? [], porMes[m] ?? [], ym);
    decomp[m] = decomporStatus(porMes[m] ?? []);
    decompSquad[m] = decomporSquad(porMes[m] ?? []);
    prodFim[m] = decomporProduto(porMes[m] ?? []);
    const pp = classificarPontePorProduto(porMes[m - 1] ?? [], porMes[m] ?? []);
    prodEntrada[m] = pp.entrada;
    prodEntrega[m] = pp.entrega;
    if (sublinhasPor === "squad") {
      const ps = classificarPontePorSquad(porMes[m - 1] ?? [], porMes[m] ?? []);
      squadEntrada[m] = ps.entrada;
      squadEntrega[m] = ps.entrega;
    }
  }

  const serieFluxo = (pick: (p: PonteMes) => number, signo: 1 | -1) =>
    Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const p = ponte[m];
      return m <= mesCorrente && p ? signo * pick(p) : null;
    });
  const sumYtd = (serie: (number | null)[]): number | null => {
    if (mesFechado === 0) return null;
    let s: number | null = null;
    for (let m = 1; m <= mesFechado; m++) {
      const v = serie[m - 1];
      if (v !== null) s = (s ?? 0) + v;
    }
    return s;
  };

  const mk = (
    metrica: string,
    titulo: string,
    tipoAgregacao: "fluxo" | "estoque",
    serie: (number | null)[],
    ytdReal: number | null,
    extra: Partial<LinhaPontual> = {},
  ): LinhaPontual => ({
    metrica, titulo, tipoAgregacao, direcao: "neutro", unidade: "brl", ...extra,
    meses: serie.map((r, i) => ({ mes: i + 1, orcado: 0, realizado: r, atingimento: null })),
    ytd: { orcado: 0, realizado: mesFechado === 0 ? null : ytdReal, atingimento: null },
  });

  const serieEstoqueIni = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; const p = ponte[m];
    return m <= mesCorrente && p ? p.estoqueIni : null;
  });
  const serieEstoqueFim = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; const p = ponte[m];
    return m <= mesCorrente && p ? p.estoqueFim : null;
  });

  // ---- Bloco 1: Venda Pontual (comercial). Tudo na mesma régua (valor atual) → soma exata. ----
  const vc = (m: number) => vendaComercialPorMes[m] ?? 0;
  const vne = (m: number) => vendaNoEstoquePorMes[m] ?? 0;
  const serieVendaComercial = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; return m <= mesCorrente ? vc(m) : null;
  });
  const serieVendaNoEstoque = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; return m <= mesCorrente ? vne(m) : null;
  });
  const serieVendaForaEstoque = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; return m <= mesCorrente ? vc(m) - vne(m) : null;
  });
  const bloco1: LinhaPontual[] = [
    mk("pontual_venda_comercial", "(+) Venda Pontual", "fluxo", serieVendaComercial, sumYtd(serieVendaComercial), { nota: NOTA_VENDA_COMERCIAL, destaque: true, grupo: GRUPO_VENDA }),
    mk("pontual_venda_no_estoque", "· Entrou no estoque", "fluxo", serieVendaNoEstoque, sumYtd(serieVendaNoEstoque), { nota: NOTA_VENDA_NO_ESTOQUE, grupo: GRUPO_VENDA }),
    mk("pontual_venda_fora_estoque", "· Fora do estoque", "fluxo", serieVendaForaEstoque, sumYtd(serieVendaForaEstoque), { nota: NOTA_VENDA_FORA_ESTOQUE, grupo: GRUPO_VENDA }),
  ];

  // ---- Bloco 2: Movimento do estoque (foto/snapshot). Fecha sozinho. ----
  const serieEntrada = serieFluxo((p) => p.venda, 1); // B = tudo que entrou na foto no mês
  // Taxa de entrega: fração (0-1) para display pct
  const serieTaxaEntrega = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; const p = ponte[m];
    if (!(m <= mesCorrente && p && p.estoqueIni > 0)) return null;
    return p.entrega / p.estoqueIni;
  });
  const ytdTaxaEntrega = (() => {
    if (mesFechado === 0) return null;
    let totalE = 0, totalI = 0;
    for (let m = 1; m <= mesFechado; m++) {
      const p = ponte[m];
      if (!p || p.estoqueIni === 0) continue;
      totalE += p.entrega; totalI += p.estoqueIni;
    }
    return totalI > 0 ? totalE / totalI : null;
  })();

  const linhas: LinhaPontual[] = [
    mk("pontual_estoque_ini", "(=) Estoque inicial", "estoque", serieEstoqueIni, ponte[1]?.estoqueIni ?? null),
    mk("pontual_entrada", "(+) Entrada na foto", "fluxo", serieEntrada, sumYtd(serieEntrada), { nota: NOTA_ENTRADA }),
    // Sub-linha de "Entrada na foto": contratos que estavam FORA do estoque no snapshot
    // anterior (ex.: pausados) e voltaram — já somada dentro de pontual_entrada (p.venda),
    // exposta aqui separadamente só para granularidade (não soma de novo na ponte).
    mk("pontual_reativacao", "· Reativação", "fluxo", serieFluxo((p) => p.reativacao, 1), sumYtd(serieFluxo((p) => p.reativacao, 1))),
    mk("pontual_entrega", "(−) Entrega", "fluxo", serieFluxo((p) => p.entrega, -1), sumYtd(serieFluxo((p) => p.entrega, -1))),
    mk("pontual_taxa_entrega", "· Taxa de entrega", "fluxo", serieTaxaEntrega, ytdTaxaEntrega, { unidade: "pct", semDetalhe: true }),
    mk("pontual_churn", "(−) Churn", "fluxo", serieFluxo((p) => p.churn, -1), sumYtd(serieFluxo((p) => p.churn, -1))),
    mk("pontual_deletados", "(−) Deletados", "fluxo", serieFluxo((p) => p.deletados, -1), sumYtd(serieFluxo((p) => p.deletados, -1))),
    mk("pontual_saida_atipica", "(−) Saída atípica", "fluxo", serieFluxo((p) => p.saidaAtipica, -1), sumYtd(serieFluxo((p) => p.saidaAtipica, -1))),
    mk("pontual_reajuste", "(±) Reajuste de valor", "fluxo", serieFluxo((p) => p.reajuste, 1), sumYtd(serieFluxo((p) => p.reajuste, 1))),
    mk("pontual_estoque_fim", "(=) Estoque final", "estoque", serieEstoqueFim, mesFechado === 0 ? null : ponte[mesFechado]?.estoqueFim ?? null, { destaque: true }),
  ];

  for (const { chave, titulo } of STATUS_DECOMP) {
    const serie = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1; const d = decomp[m];
      return m <= mesCorrente && d ? d[chave] ?? 0 : null;
    });
    const ytdReal = mesFechado === 0 ? null : decomp[mesFechado]?.[chave] ?? 0;
    linhas.push(mk(`pontual_status_${chave.replace(/\s+/g, "_")}`, titulo, "estoque", serie, ytdReal));
  }

  // Linha "Outros" defensiva: garante que a decomposição feche no estoque final
  // mesmo se surgir um status fora dos 5 conhecidos. Só entra se houver valor.
  const serieOutros = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; const p = ponte[m]; const d = decomp[m];
    if (!(m <= mesCorrente && p && d)) return null;
    const conhecido = STATUS_DECOMP.reduce((s, { chave }) => s + (d[chave] ?? 0), 0);
    return p.estoqueFim - conhecido;
  });
  if (serieOutros.some((v) => v !== null && Math.abs(v) > 0.5)) {
    const ytdOutros = mesFechado === 0 ? null : serieOutros[mesFechado - 1] ?? 0;
    linhas.push(mk("pontual_status_outros", "· Outros status", "estoque", serieOutros, ytdOutros));
  }

  for (const l of linhas) l.grupo = GRUPO_ESTOQUE;

  // ---- Bloco 3: Estoque pontual por squad (decomposição do estoque final por squad). ----
  // Saldo por squad ao fim de cada mês; soma das linhas = (=) Estoque final. Squads com
  // < SQUAD_MIN_EXIBIR no mês corrente são agregados em "· Outros" (mantém a soma fechando).
  const squads = Array.from(
    new Set(decompSquad.flatMap((d) => (d ? Object.keys(d) : []))),
  );
  const valorSquadMesCorrente = (sq: string) => decompSquad[mesCorrente]?.[sq] ?? 0;
  const grandes = squads
    .filter((sq) => valorSquadMesCorrente(sq) >= SQUAD_MIN_EXIBIR)
    .sort((a, b) => valorSquadMesCorrente(b) - valorSquadMesCorrente(a));
  const pequenos = squads.filter((sq) => valorSquadMesCorrente(sq) < SQUAD_MIN_EXIBIR);

  const serieSquad = (pick: (d: Record<string, number>) => number) =>
    Array.from({ length: 12 }, (_, i) => {
      const m = i + 1; const d = decompSquad[m];
      return m <= mesCorrente && d ? pick(d) : null;
    });

  const linhasSquad: LinhaPontual[] = grandes.map((sq) => {
    const serie = serieSquad((d) => d[sq] ?? 0);
    const ytdReal = mesFechado === 0 ? null : decompSquad[mesFechado]?.[sq] ?? 0;
    return mk(`pontual_squad:${sq}`, sq, "estoque", serie, ytdReal, { grupo: GRUPO_SQUAD });
  });

  // "· Outros" = soma dos squads pequenos (< R$ 10K no mês corrente). Só entra se houver valor.
  const somaPequenos = (d: Record<string, number>) =>
    pequenos.reduce((s, sq) => s + (d[sq] ?? 0), 0);
  const serieOutrosSquad = serieSquad(somaPequenos);
  if (serieOutrosSquad.some((v) => v !== null && Math.abs(v) > 0.5)) {
    const ytdOutros = mesFechado === 0
      ? null
      : (decompSquad[mesFechado] ? somaPequenos(decompSquad[mesFechado]!) : 0);
    linhasSquad.push(mk("pontual_squad_outros", "· Outros (< R$ 10K)", "estoque", serieOutrosSquad, ytdOutros, { grupo: GRUPO_SQUAD, semDetalhe: true }));
  }

  // ---- Sub-linhas por produto (expandíveis) das 4 linhas principais. ----
  const subLinhasProduto = (
    paiMetrica: string,
    pickMes: (m: number) => Record<string, number>,
    tipoAgregacao: "fluxo" | "estoque",
    signo: 1 | -1,
  ): LinhaPontual[] => {
    const produtos = Array.from(new Set(
      Array.from({ length: mesCorrente }, (_, i) => pickMes(i + 1)).flatMap((d) => Object.keys(d)),
    ));
    const valMesCorrente = (p: string) => pickMes(mesCorrente)[p] ?? 0;
    const grandesP = produtos
      .filter((p) => Math.abs(valMesCorrente(p)) >= SQUAD_MIN_EXIBIR)
      .sort((a, b) => Math.abs(valMesCorrente(b)) - Math.abs(valMesCorrente(a)));
    const pequenosP = produtos.filter((p) => Math.abs(valMesCorrente(p)) < SQUAD_MIN_EXIBIR);
    const serieDe = (pick: (d: Record<string, number>) => number) =>
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        return m <= mesCorrente ? signo * pick(pickMes(m)) : null;
      });
    const ytdDe = (serie: (number | null)[], pickFechado: () => number): number | null =>
      tipoAgregacao === "estoque"
        ? (mesFechado === 0 ? null : signo * pickFechado())
        : sumYtd(serie);
    const subs: LinhaPontual[] = grandesP.map((p) => {
      const serie = serieDe((d) => d[p] ?? 0);
      return mk(`pontual_prod:${paiMetrica}:${p}`, `· ${p}`, tipoAgregacao, serie, ytdDe(serie, () => pickMes(mesFechado)[p] ?? 0), { paiMetrica });
    });
    const somaPeq = (d: Record<string, number>) => pequenosP.reduce((s, p) => s + (d[p] ?? 0), 0);
    const serieOutrosP = serieDe(somaPeq);
    if (serieOutrosP.some((v) => v !== null && Math.abs(v) > 0.5)) {
      subs.push(mk(`pontual_prod:${paiMetrica}:__outros__`, "· Outros (< R$ 10K)", tipoAgregacao, serieOutrosP, ytdDe(serieOutrosP, () => somaPeq(pickMes(mesFechado))), { paiMetrica, semDetalhe: true }));
    }
    return subs;
  };

  // Sub-linhas por squad (usadas na aba Creators, onde produto é redundante).
  const subLinhasSquad = (
    paiMetrica: string,
    pickMes: (m: number) => Record<string, number>,
    tipoAgregacao: "fluxo" | "estoque",
    signo: 1 | -1,
  ): LinhaPontual[] => {
    const sqs = Array.from(new Set(
      Array.from({ length: mesCorrente }, (_, i) => pickMes(i + 1)).flatMap((d) => Object.keys(d)),
    ));
    const valMesCorrente = (sq: string) => pickMes(mesCorrente)[sq] ?? 0;
    const grandesS = sqs
      .filter((sq) => Math.abs(valMesCorrente(sq)) >= SQUAD_MIN_EXIBIR)
      .sort((a, b) => Math.abs(valMesCorrente(b)) - Math.abs(valMesCorrente(a)));
    const pequenosS = sqs.filter((sq) => Math.abs(valMesCorrente(sq)) < SQUAD_MIN_EXIBIR);
    const serieDe = (pick: (d: Record<string, number>) => number) =>
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        return m <= mesCorrente ? signo * pick(pickMes(m)) : null;
      });
    const ytdDe = (serie: (number | null)[], pickFechado: () => number): number | null =>
      tipoAgregacao === "estoque"
        ? (mesFechado === 0 ? null : signo * pickFechado())
        : sumYtd(serie);
    const subs: LinhaPontual[] = grandesS.map((sq) => {
      const serie = serieDe((d) => d[sq] ?? 0);
      return mk(`pontual_sq:${paiMetrica}:${sq}`, `· ${sq}`, tipoAgregacao, serie, ytdDe(serie, () => pickMes(mesFechado)[sq] ?? 0), { paiMetrica });
    });
    const somaPeq = (d: Record<string, number>) => pequenosS.reduce((s, sq) => s + (d[sq] ?? 0), 0);
    const serieOutrosS = serieDe(somaPeq);
    if (serieOutrosS.some((v) => v !== null && Math.abs(v) > 0.5)) {
      subs.push(mk(`pontual_sq:${paiMetrica}:__outros__`, "· Outros (< R$ 10K)", tipoAgregacao, serieOutrosS, ytdDe(serieOutrosS, () => somaPeq(pickMes(mesFechado))), { paiMetrica, semDetalhe: true }));
    }
    return subs;
  };

  const subPorPai: Record<string, LinhaPontual[]> = sublinhasPor === "squad"
    ? {
        // Venda Pontual não tem squad na query — sem sub-linhas expansíveis
        pontual_entrada: subLinhasSquad("pontual_entrada", (m) => squadEntrada[m] ?? {}, "fluxo", 1),
        pontual_entrega: subLinhasSquad("pontual_entrega", (m) => squadEntrega[m] ?? {}, "fluxo", -1),
        pontual_estoque_fim: subLinhasSquad("pontual_estoque_fim", (m) => decompSquad[m] ?? {}, "estoque", 1),
        ...Object.fromEntries(STATUS_DECOMP.map(({ chave }) => {
          const metricaStatus = `pontual_status_${chave.replace(/\s+/g, "_")}`;
          return [metricaStatus, subLinhasSquad(
            metricaStatus,
            (m) => decomporSquad((porMes[m] ?? []).filter((r) => r.status === chave)),
            "estoque", 1,
          )];
        })),
      }
    : {
        pontual_venda_comercial: subLinhasProduto("pontual_venda_comercial", (m) => vendaPorProdutoPorMes[m] ?? {}, "fluxo", 1),
        pontual_entrada: subLinhasProduto("pontual_entrada", (m) => prodEntrada[m] ?? {}, "fluxo", 1),
        pontual_entrega: subLinhasProduto("pontual_entrega", (m) => prodEntrega[m] ?? {}, "fluxo", -1),
        pontual_estoque_fim: subLinhasProduto("pontual_estoque_fim", (m) => prodFim[m] ?? {}, "estoque", 1),
        ...Object.fromEntries(STATUS_DECOMP.map(({ chave }) => {
          const metricaStatus = `pontual_status_${chave.replace(/\s+/g, "_")}`;
          return [metricaStatus, subLinhasProduto(
            metricaStatus,
            (m) => decomporProduto((porMes[m] ?? []).filter((r) => r.status === chave)),
            "estoque", 1,
          )];
        })),
      };

  // ---- Bloco análise: aging + tempo médio ----
  const agingPorMes = Array.from({ length: 13 }, (_, m) =>
    m >= 1 && m <= mesCorrente ? agingEstoque(porMes[m] ?? [], ultimoDiaMes(m)) : null,
  );
  const serieAging = (pick: (a: AgingBuckets) => number) =>
    Array.from({ length: 12 }, (_, i) => { const m = i + 1; const a = agingPorMes[m]; return a ? pick(a) : null; });
  const ytdAgingPick = (pick: (a: AgingBuckets) => number) =>
    mesFechado === 0 ? null : (agingPorMes[mesFechado] ? pick(agingPorMes[mesFechado]!) : null);

  const serieTempoMedio = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return m <= mesCorrente ? tempoMedioEntrega(porMes[m - 1] ?? [], porMes[m] ?? [], ultimoDiaMes(m)) : null;
  });
  const ytdTempoMedio = (() => {
    if (mesFechado === 0) return null;
    const vals = serieTempoMedio.slice(0, mesFechado).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  })();

  const mkA = (metrica: string, titulo: string, serie: (number | null)[], ytd: number | null, extra: Partial<LinhaPontual> = {}) =>
    mk(metrica, titulo, "estoque", serie, ytd, { grupo: GRUPO_ANALISE, ...extra });

  const linhasAnalise: LinhaPontual[] = [
    mkA("pontual_aging", "Aging do estoque", serieEstoqueFim, mesFechado === 0 ? null : ponte[mesFechado]?.estoqueFim ?? null,
      { expansivel: true, semDetalhe: true }),
    mkA("pontual_aging_lt30", "· < 30 dias", serieAging((a) => a.lt30), ytdAgingPick((a) => a.lt30),
      { paiMetrica: "pontual_aging" }),
    mkA("pontual_aging_30_60", "· 30–60 dias", serieAging((a) => a.d30_60), ytdAgingPick((a) => a.d30_60),
      { paiMetrica: "pontual_aging" }),
    mkA("pontual_aging_60_90", "· 60–90 dias", serieAging((a) => a.d60_90), ytdAgingPick((a) => a.d60_90),
      { paiMetrica: "pontual_aging" }),
    mkA("pontual_aging_gt90", "· > 90 dias", serieAging((a) => a.gt90), ytdAgingPick((a) => a.gt90),
      { paiMetrica: "pontual_aging" }),
    mk("pontual_tempo_medio", "Tempo médio p/ entrega", "fluxo", serieTempoMedio, ytdTempoMedio,
      { unidade: "int", semDetalhe: true, grupo: GRUPO_ANALISE }),
  ];

  // Insere as sub-linhas logo após cada linha-pai e marca o pai como expansível.
  const out: LinhaPontual[] = [];
  for (const l of [...bloco1, ...linhas, ...linhasSquad]) {
    const subs = subPorPai[l.metrica];
    if (subs && subs.length) { l.expansivel = true; out.push(l, ...subs); }
    else out.push(l);
  }
  for (const l of linhasAnalise) out.push(l);
  return out;
}

export interface RegPontualItem extends RegPontual {
  cliente: string;
  squad?: string;
}

export type CategoriaPonte =
  | "venda_mes" | "entrada_defasada" | "reativacao" | "sem_origem"
  | "entrega" | "churn" | "deletados" | "saida_atipica" | "reajuste";

export interface ItemPonte {
  idSubtask: string;
  cliente: string;
  status: string;
  valor: number;
  detalhe: string;
}

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

// IMPORTANTE: manter a árvore de classificação em sincronia com classificarPonte (mesma lógica; esta lista os contratos, aquela soma). Ver teste "soma dos itens por categoria casa".
// Mesma classificação de classificarPonte, mas emitindo os contratos de cada categoria de movimento.
export function classificarPonteItens(
  ant: RegPontualItem[],
  atual: RegPontualItem[],
  ymAlvo: string,
): Record<CategoriaPonte, ItemPonte[]> {
  const antMap = new Map(ant.map((r) => [r.idSubtask, r]));
  const atualMap = new Map(atual.map((r) => [r.idSubtask, r]));
  const out: Record<CategoriaPonte, ItemPonte[]> = {
    venda_mes: [], entrada_defasada: [], reativacao: [], sem_origem: [],
    entrega: [], churn: [], deletados: [], saida_atipica: [], reajuste: [],
  };
  for (const r of ant) {
    if (!ehEstoquePontual(r)) continue;
    const a = atualMap.get(r.idSubtask);
    if (!a) { out.deletados.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: r.status, valor: r.valorp, detalhe: "sumiu do snapshot" }); continue; }
    if (ehEstoquePontual(a)) {
      const delta = a.valorp - r.valorp;
      if (delta !== 0) out.reajuste.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: a.status, valor: delta, detalhe: `${brl(r.valorp)} → ${brl(a.valorp)}` });
      continue;
    }
    if (a.status === "entregue") out.entrega.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: a.status, valor: r.valorp, detalhe: "" });
    else if (CHURN_STATUS.has(a.status)) out.churn.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: a.status, valor: r.valorp, detalhe: "" });
    else out.saida_atipica.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: a.status, valor: r.valorp, detalhe: `valorp ${brl(a.valorp)}` });
  }
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    const prev = antMap.get(r.idSubtask);
    if (prev && ehEstoquePontual(prev)) continue;
    const base = { idSubtask: r.idSubtask, cliente: r.cliente, status: r.status, valor: r.valorp };
    if (prev) out.reativacao.push({ ...base, detalhe: `voltou de ${prev.status}` });
    else if (!r.criadoYm) out.sem_origem.push({ ...base, detalhe: "sem registro em cup_contratos" });
    else if (r.criadoYm === ymAlvo) out.venda_mes.push({ ...base, detalhe: "" });
    else out.entrada_defasada.push({ ...base, detalhe: `criado em ${r.criadoYm}` });
  }
  return out;
}

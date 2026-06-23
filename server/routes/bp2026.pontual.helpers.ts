// server/routes/bp2026.pontual.helpers.ts
// Ponte do estoque pontual via snapshot-diff de cup_data_hist (helpers puros).
// Estoque pontual = valorp>0 e status fora da lista de exclusão. A ponte fecha:
// estoque_ini + venda − entrega − churn − deletados − saída_atípica + reajuste = estoque_fim.

export interface RegPontual {
  idSubtask: string;
  valorp: number;
  status: string;
  criadoYm?: string | null; // 'YYYY-MM' de data_criado (cup_contratos); ausente => sem origem
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
  meses: { mes: number; orcado: number; realizado: number | null; atingimento: number | null }[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const NOTA_VENDA =
  "Venda = entrada no estoque (snapshot do ClickUp), medida por diferença de snapshots — " +
  "não é a venda comercial da Visão Geral. Decomposta abaixo pelo motivo da entrada.";
const NOTA_VENDA_MES =
  "Contratos com data de criação (cup_contratos) no próprio mês — a venda real do período.";
const NOTA_DEFASADA =
  "Contratos criados em meses anteriores que só agora apareceram no snapshot (a foto do estoque atrasa ~1 mês).";
const NOTA_REATIVACAO =
  "Contratos que estavam como entregue/cancelado e voltaram ao estoque.";
const NOTA_SEM_ORIGEM =
  "Contratos no snapshot sem data de criação em cup_contratos (órfãos do ClickUp ou data_criado vazia).";

// porMes[m] = registros (valorp>0) do último snapshot do mês m; m=0 é dez/2025.
export function montarLinhasPontual(
  porMes: Record<number, RegPontual[]>,
  mesCorrente: number,
  mesFechado: number,
): LinhaPontual[] {
  const ponte: (PonteMes | null)[] = Array.from({ length: 13 }, () => null);
  const decomp: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  for (let m = 1; m <= 12; m++) {
    if (m > mesCorrente) continue;
    const ym = `${ANO}-${String(m).padStart(2, "0")}`;
    ponte[m] = classificarPonte(porMes[m - 1] ?? [], porMes[m] ?? [], ym);
    decomp[m] = decomporStatus(porMes[m] ?? []);
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

  const serieVenda = serieFluxo((p) => p.venda, 1);
  const serieVendaMes = serieFluxo((p) => p.vendaMes, 1);
  const serieDefasada = serieFluxo((p) => p.entradaDefasada, 1);
  const serieReativacao = serieFluxo((p) => p.reativacao, 1);
  const serieSemOrigem = serieFluxo((p) => p.semOrigem, 1);

  const linhas: LinhaPontual[] = [
    mk("pontual_estoque_ini", "(=) Estoque inicial", "estoque", serieEstoqueIni, ponte[1]?.estoqueIni ?? null),
    mk("pontual_venda", "(+) Venda", "fluxo", serieVenda, sumYtd(serieVenda), { nota: NOTA_VENDA }),
    mk("pontual_venda_mes", "· Venda do mês", "fluxo", serieVendaMes, sumYtd(serieVendaMes), { nota: NOTA_VENDA_MES }),
    mk("pontual_entrada_defasada", "· Entrada defasada", "fluxo", serieDefasada, sumYtd(serieDefasada), { nota: NOTA_DEFASADA }),
    mk("pontual_reativacao", "· Reativação", "fluxo", serieReativacao, sumYtd(serieReativacao), { nota: NOTA_REATIVACAO }),
  ];
  if (serieSemOrigem.some((v) => v !== null && Math.abs(v) > 0.5)) {
    linhas.push(mk("pontual_sem_origem", "· Sem origem", "fluxo", serieSemOrigem, sumYtd(serieSemOrigem), { nota: NOTA_SEM_ORIGEM }));
  }
  linhas.push(
    mk("pontual_entrega", "(−) Entrega", "fluxo", serieFluxo((p) => p.entrega, -1), sumYtd(serieFluxo((p) => p.entrega, -1))),
    mk("pontual_churn", "(−) Churn", "fluxo", serieFluxo((p) => p.churn, -1), sumYtd(serieFluxo((p) => p.churn, -1))),
    mk("pontual_deletados", "(−) Deletados", "fluxo", serieFluxo((p) => p.deletados, -1), sumYtd(serieFluxo((p) => p.deletados, -1))),
    mk("pontual_saida_atipica", "(−) Saída atípica", "fluxo", serieFluxo((p) => p.saidaAtipica, -1), sumYtd(serieFluxo((p) => p.saidaAtipica, -1))),
    mk("pontual_reajuste", "(±) Reajuste de valor", "fluxo", serieFluxo((p) => p.reajuste, 1), sumYtd(serieFluxo((p) => p.reajuste, 1))),
    mk("pontual_estoque_fim", "(=) Estoque final", "estoque", serieEstoqueFim, mesFechado === 0 ? null : ponte[mesFechado]?.estoqueFim ?? null, { destaque: true }),
  );

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

  return linhas;
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

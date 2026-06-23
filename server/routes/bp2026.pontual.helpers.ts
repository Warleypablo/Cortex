// server/routes/bp2026.pontual.helpers.ts
// Ponte do estoque pontual via snapshot-diff de cup_data_hist (helpers puros).
// Estoque pontual = valorp>0 e status fora da lista de exclusão. A ponte fecha:
// estoque_ini + venda − entrega − churn − deletados − saída_atípica + reajuste = estoque_fim.

export interface RegPontual {
  idSubtask: string;
  valorp: number;
  status: string;
  criadoYm?: string | null; // 'YYYY-MM' de data_criado (cup_contratos); ausente => sem origem
  squad?: string;           // squad do contrato no snapshot (p/ decomposição do estoque por squad)
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

// Soma valorp por squad, só do estoque (ehEstoquePontual). Soma total = estoque final.
export function decomporSquad(atual: RegPontual[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    const sq = r.squad && r.squad.trim() ? r.squad : "(sem squad)";
    out[sq] = (out[sq] ?? 0) + r.valorp;
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
  semDetalhe?: boolean;
  grupo?: string;
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

// porMes[m] = registros (valorp>0) do último snapshot do mês m; m=0 é dez/2025.
// vendaComercialPorMes[m] = SUM(valorp) de cup_contratos por data_criado no mês m (= Receita Pontual).
// vendaNoEstoquePorMes[m] = parte dessa venda cujo contrato está na foto do estoque no fim do mês.
export function montarLinhasPontual(
  porMes: Record<number, RegPontual[]>,
  mesCorrente: number,
  mesFechado: number,
  vendaComercialPorMes: Record<number, number> = {},
  vendaNoEstoquePorMes: Record<number, number> = {},
): LinhaPontual[] {
  const ponte: (PonteMes | null)[] = Array.from({ length: 13 }, () => null);
  const decomp: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  const decompSquad: (Record<string, number> | null)[] = Array.from({ length: 13 }, () => null);
  for (let m = 1; m <= 12; m++) {
    if (m > mesCorrente) continue;
    const ym = `${ANO}-${String(m).padStart(2, "0")}`;
    ponte[m] = classificarPonte(porMes[m - 1] ?? [], porMes[m] ?? [], ym);
    decomp[m] = decomporStatus(porMes[m] ?? []);
    decompSquad[m] = decomporSquad(porMes[m] ?? []);
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
  const linhas: LinhaPontual[] = [
    mk("pontual_estoque_ini", "(=) Estoque inicial", "estoque", serieEstoqueIni, ponte[1]?.estoqueIni ?? null),
    mk("pontual_entrada", "(+) Entrada na foto", "fluxo", serieEntrada, sumYtd(serieEntrada), { nota: NOTA_ENTRADA }),
    mk("pontual_entrega", "(−) Entrega", "fluxo", serieFluxo((p) => p.entrega, -1), sumYtd(serieFluxo((p) => p.entrega, -1))),
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
  // Saldo (estoque) por squad ao fim de cada mês; soma das linhas = (=) Estoque final.
  const squads = Array.from(
    new Set(decompSquad.flatMap((d) => (d ? Object.keys(d) : []))),
  );
  const valorSquadMesCorrente = (sq: string) => decompSquad[mesCorrente]?.[sq] ?? 0;
  squads.sort((a, b) => valorSquadMesCorrente(b) - valorSquadMesCorrente(a));
  const linhasSquad: LinhaPontual[] = squads.map((sq) => {
    const serie = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1; const d = decompSquad[m];
      return m <= mesCorrente && d ? d[sq] ?? 0 : null;
    });
    const ytdReal = mesFechado === 0 ? null : decompSquad[mesFechado]?.[sq] ?? 0;
    return mk(`pontual_squad:${sq}`, sq, "estoque", serie, ytdReal, { grupo: GRUPO_SQUAD });
  });

  return [...bloco1, ...linhas, ...linhasSquad];
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

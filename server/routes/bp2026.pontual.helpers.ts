// server/routes/bp2026.pontual.helpers.ts
// Ponte do estoque pontual via snapshot-diff de cup_data_hist (helpers puros).
// Estoque pontual = valorp>0 e status fora da lista de exclusão. A ponte fecha:
// estoque_ini + venda − entrega − churn − deletados − saída_atípica + reajuste = estoque_fim.

export interface RegPontual {
  idSubtask: string;
  valorp: number;
  status: string;
}

const ESTOQUE_STATUS_EXCLUDE = new Set(["entregue", "cancelado/inativo", "não usar"]);
const CHURN_STATUS = new Set(["cancelado/inativo", "não usar"]);

export function ehEstoquePontual(r: RegPontual): boolean {
  return r.valorp > 0 && !ESTOQUE_STATUS_EXCLUDE.has(r.status);
}

export interface PonteMes {
  estoqueIni: number;
  venda: number;
  entrega: number;
  churn: number;
  deletados: number;
  saidaAtipica: number;
  reajuste: number;
  estoqueFim: number;
}

// Classifica a transição de cada contrato (id_subtask) entre o estoque do snapshot
// anterior e o do atual. Venda inclui contratos que (re)entraram no estoque.
export function classificarPonte(ant: RegPontual[], atual: RegPontual[]): PonteMes {
  const antMap = new Map(ant.map((r) => [r.idSubtask, r]));
  const atualMap = new Map(atual.map((r) => [r.idSubtask, r]));
  const p: PonteMes = {
    estoqueIni: 0, venda: 0, entrega: 0, churn: 0,
    deletados: 0, saidaAtipica: 0, reajuste: 0, estoqueFim: 0,
  };
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
    if (!prev || !ehEstoquePontual(prev)) p.venda += r.valorp;
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
  "Venda = entrada no estoque (contratos pontuais que passaram a constar no snapshot do " +
  "ClickUp), medida por diferença de snapshots — não é o 'Vendas Pontual' do Bitrix de outras abas.";

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
    ponte[m] = classificarPonte(porMes[m - 1] ?? [], porMes[m] ?? []);
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

  const linhas: LinhaPontual[] = [
    mk("pontual_estoque_ini", "(=) Estoque inicial", "estoque", serieEstoqueIni, ponte[1]?.estoqueIni ?? null),
    mk("pontual_venda", "(+) Venda", "fluxo", serieFluxo((p) => p.venda, 1), sumYtd(serieFluxo((p) => p.venda, 1)), { nota: NOTA_VENDA }),
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

  return linhas;
}

// Matriz mês a mês do CEO Dashboard — lógica pura (sem IO), testável.
// Transpõe as linhas do BP (que já trazem série mensal) para uma tabela
// indicador × mês. Fonte única com os cards → mesmos números.

import type { BpLinha, CeoUnidade, CeoDirecao } from "./ceoDashboard.helpers";

export interface CeoMatrizCelula {
  mes: number;
  valor: number | null;
  meta: number | null;
  atingimentoPct: number | null; // já *100, 1 casa (mesma régua do card)
}

export interface CeoMatrizLinha {
  key: string;
  label: string;
  unidade: CeoUnidade;
  direcao: CeoDirecao;
  semMeta: boolean; // inadimplência, ltv, enps, nps
  nota?: string;
  celulas: CeoMatrizCelula[]; // uma por mês, alinhada a `meses`
}

export interface CeoMatrizResponse {
  ate: string; // "2026-07"
  mesFechado: number; // último mês fechado; colunas com mes > mesFechado são parciais
  meses: { mes: number; label: string }[];
  linhas: CeoMatrizLinha[];
}

export interface CeoMatrizSources {
  mesNum: number; // última coluna (colunas = 1..mesNum)
  mesFechado: number; // último mês com dados completos (mês corrente é parcial)
  bpLinhas: BpLinha[];
  bpMetricas: BpLinha[];
  // Linhas já reconstruídas em regime de caixa (recebido/DFC) — ver *FromBp helpers.
  receitaRecebida: BpLinha;
  receitaCabecaCaixa: BpLinha;
  // Séries mensais sem meta (valor por mês; mês ausente → célula "—").
  inadimplenciaSeriePorMes: Record<number, number>; // por mês de vencimento
  ltvSeriePorMes: Record<number, number>; // LTV médio dos ativos por mês (snapshots)
  enpsSeriePorMes: Record<number, number>; // NPS interno por mês da pesquisa (gap em meses sem onda)
}

const MESES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Transpõe uma linha do BP (meses[]) em células mês 1..mesNum.
// Mês sem realizado → valor null, mas a meta (orçado) segue visível.
function celulasDoBp(linha: BpLinha | undefined, mesNum: number): CeoMatrizCelula[] {
  const byMes = new Map((linha?.meses ?? []).map((m) => [m.mes, m]));
  const out: CeoMatrizCelula[] = [];
  for (let mes = 1; mes <= mesNum; mes++) {
    const m = byMes.get(mes);
    out.push({
      mes,
      valor: m?.realizado ?? null,
      meta: m?.orcado ?? null,
      // *100 p/ razão→%; round(...*1000)/10 evita ruído de float (ex.: 1.1*100).
      atingimentoPct: m?.atingimento != null ? Math.round(m.atingimento * 1000) / 10 : null,
    });
  }
  return out;
}

// Série própria por mês (inadimplência): valor onde há dado, sem meta.
function celulasDaSerie(seriePorMes: Record<number, number>, mesNum: number): CeoMatrizCelula[] {
  const out: CeoMatrizCelula[] = [];
  for (let mes = 1; mes <= mesNum; mes++) {
    const v = seriePorMes[mes];
    out.push({ mes, valor: v ?? null, meta: null, atingimentoPct: null });
  }
  return out;
}

export function montarMatrizCeo(s: CeoMatrizSources): CeoMatrizResponse {
  const mesNum = s.mesNum;
  const find = (arr: BpLinha[], metrica: string) => arr.find((l) => l.metrica === metrica);

  const bpLinha = (
    arr: BpLinha[], metrica: string, key: string, label: string, direcao: CeoDirecao, unidade: CeoUnidade
  ): CeoMatrizLinha => ({
    key, label, unidade, direcao, semMeta: false, celulas: celulasDoBp(find(arr, metrica), mesNum),
  });

  const linhas: CeoMatrizLinha[] = [
    { key: "receita", label: "Receita", unidade: "brl", direcao: "maior_melhor", semMeta: false,
      celulas: celulasDoBp(s.receitaRecebida, mesNum) },
    bpLinha(s.bpMetricas, "despesa_total", "custos", "Custos & Despesas", "menor_melhor", "brl"),
    bpLinha(s.bpLinhas, "ebitda", "lucro", "Lucro (EBITDA)", "maior_melhor", "brl"),
    bpLinha(s.bpMetricas, "saldo_caixa", "caixa", "Saldo de Caixa", "maior_melhor", "brl"),
    { key: "inadimplencia", label: "Inadimplência Total", unidade: "brl", direcao: "menor_melhor",
      semMeta: true, nota: "Por mês de vencimento das parcelas em aberto.",
      celulas: celulasDaSerie(s.inadimplenciaSeriePorMes, mesNum) },
    { key: "nps", label: "NPS Clientes", unidade: "score", direcao: "maior_melhor", semMeta: true,
      nota: "Sem fonte de dados de NPS de clientes ainda.", celulas: celulasDaSerie({}, mesNum) },
    bpLinha(s.bpLinhas, "cac", "cac", "CAC", "menor_melhor", "brl"),
    { key: "ltv", label: "LTV", unidade: "brl", direcao: "maior_melhor", semMeta: true,
      nota: "LTV mediano dos clientes ativos no mês (reconstruído de snapshots diários; mediana é robusta a outliers de ticket alto).",
      celulas: celulasDaSerie(s.ltvSeriePorMes, mesNum) },
    bpLinha(s.bpMetricas, "colaboradores", "headcount", "Headcount", "menor_melhor", "int"),
    { key: "enps", label: "E-NPS", unidade: "score", direcao: "maior_melhor", semMeta: true,
      nota: "NPS interno por mês da pesquisa; meses sem onda de pesquisa ficam vazios.",
      celulas: celulasDaSerie(s.enpsSeriePorMes, mesNum) },
    { key: "receita_cabeca", label: "Receita / Cabeça", unidade: "brl", direcao: "maior_melhor",
      semMeta: false, celulas: celulasDoBp(s.receitaCabecaCaixa, mesNum) },
  ];

  const meses = Array.from({ length: mesNum }, (_, i) => ({ mes: i + 1, label: MESES_LABEL[i] }));
  return { ate: `2026-${String(mesNum).padStart(2, "0")}`, mesFechado: s.mesFechado, meses, linhas };
}

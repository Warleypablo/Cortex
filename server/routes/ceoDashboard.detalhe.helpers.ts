import { agruparItens, type ItemDetalhe, type GrupoDetalhe } from "./bp2026.helpers";
import type { DetalheBpResult } from "./bp2026.detalhe";

export const LIMITE_ITENS = 50;

export interface CeoGrupo extends GrupoDetalhe {
  sinal?: "+" | "-";
  formato: "brl" | "num";
  aberto?: boolean; // controla o <details> do drawer; ausente = regra padrão do front
}

// Um ponto da série de evolução mensal (realizado vs meta) exibida no gráfico do drawer.
export interface PontoEvolucao { mes: number; realizado: number | null; orcado: number | null }

export interface CeoDetalheResponse {
  kpi: string;
  titulo: string;
  mes: number;
  unidade: "brl" | "int";
  orcado: number | null;
  realizado: number | null;
  atingimentoPct: number | null;
  grupos: CeoGrupo[];
  evolucao?: PontoEvolucao[];
  nota?: string;
  media?: number | null; // média dos mesmos clientes da auditoria (LTV) — comparativo mediana × média
  somaLtv?: number | null; // soma dos LTVs da auditoria — numerador da média (média = somaLtv ÷ nClientes)
  nClientes?: number | null; // população da auditoria (denominador da média; N da mediana)
}

// Extrai a série mensal (jan→mês fechado) de uma linha do BP para o gráfico de evolução.
// Só meses com realizado e ATÉ o mês fechado — o mês corrente é parcial e distorceria a curva
// (ex.: receita do mês em andamento cai a zero). Carrega o orçado p/ traçar a meta em paralelo.
export function serieEvolucao(
  linha: { meses?: Array<{ mes: number; orcado: number; realizado: number | null }> } | undefined,
  mesFechado?: number
): PontoEvolucao[] {
  return (linha?.meses ?? [])
    .filter((m) => m.realizado !== null && (mesFechado == null || m.mes <= mesFechado))
    .map((m) => ({ mes: m.mes, realizado: m.realizado, orcado: m.orcado ?? null }));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export function formatBRL(v: number): string { return brl.format(v || 0); }

export interface ComponenteKpi { slug: string; titulo: string; sinal?: "+" | "-" }
export const KPI_COMPONENTES: Record<string, ComponenteKpi[]> = {
  receita: [
    { slug: "mrr_ativo", titulo: "MRR Ativo", sinal: "+" },
    { slug: "receita_pontual", titulo: "Venda Pontual", sinal: "+" },
    { slug: "outras_receitas", titulo: "Outras Receitas", sinal: "+" },
    { slug: "inadimplencia", titulo: "(−) Inadimplência e Estornos", sinal: "-" },
  ],
  custos: [
    { slug: "impostos_receita", titulo: "Impostos sobre Receita", sinal: "-" },
    { slug: "csv_salarios", titulo: "CSV — Salários", sinal: "-" },
    { slug: "csv_beneficio", titulo: "CSV — Benefício (Caju)", sinal: "-" },
    { slug: "csv_stack", titulo: "CSV — Stack Tecnologia", sinal: "-" },
    { slug: "cac", titulo: "CAC", sinal: "-" },
    { slug: "sga", titulo: "SG&A", sinal: "-" },
    { slug: "bonus", titulo: "Bônus", sinal: "-" },
    { slug: "impostos_diretos", titulo: "IR + CSLL + ICMS + DIFAL", sinal: "-" },
    { slug: "capex", titulo: "CAPEX", sinal: "-" },
  ],
};

// Achata todos os grupos de um DetalheBpResult num único grupo (itens juntos, cap LIMITE).
export function achatarComponente(
  det: DetalheBpResult,
  opts: { titulo?: string; sinal?: "+" | "-"; formato: "brl" | "num" }
): CeoGrupo {
  const titulo = opts.titulo ?? det.titulo;
  const itens: ItemDetalhe[] = [];
  for (const g of det.grupos) for (const it of g.itens) itens.push({ ...it, grupo: titulo });
  const agrupado = agruparItens(itens, LIMITE_ITENS)[0];
  const total = det.realizado ?? det.grupos.reduce((s, g) => s + g.total, 0);
  return {
    titulo, total, sinal: opts.sinal, formato: opts.formato,
    itens: agrupado?.itens ?? [],
    itensOmitidos: agrupado?.itensOmitidos,
  };
}

// Preserva os grupos do BP como grupos do CEO (aplica formato/sinal).
export function mapDetalheBpGrupos(
  det: DetalheBpResult,
  opts: { formato: "brl" | "num"; sinal?: "+" | "-" }
): CeoGrupo[] {
  return det.grupos.map((g) => ({ ...g, formato: opts.formato, sinal: opts.sinal }));
}

export function bancosToGrupo(
  rows: Array<{ nmbanco: string; empresa: string; balance: number }>
): CeoGrupo {
  const itens = rows.map((r) => ({
    nome: [r.nmbanco, r.empresa].filter(Boolean).join(" · "),
    detalhe: "", data: null as string | null, valor: Number(r.balance) || 0,
  }));
  return {
    titulo: "Contas bancárias", formato: "brl",
    total: itens.reduce((s, i) => s + i.valor, 0), itens,
  };
}

export function inadClientesToGrupos(
  clientes: Array<{ idCliente: string; nomeCliente: string; valorTotal: number; quantidadeParcelas: number }>
): CeoGrupo[] {
  const itens: ItemDetalhe[] = clientes.map((c) => ({
    grupo: "Clientes inadimplentes",
    nome: c.nomeCliente, detalhe: `${c.quantidadeParcelas} parcela(s)`,
    data: null, valor: Number(c.valorTotal) || 0,
  }));
  return agruparItens(itens, LIMITE_ITENS).map((g) => ({ ...g, formato: "brl" as const }));
}

export function enpsRespostasToGrupos(
  respostas: Array<{ area: string | null; scoreEmpresa: number | null; comentarioEmpresa: string | null }>
): CeoGrupo[] {
  const bucket = (s: number | null) =>
    s == null ? null : s >= 9 ? "Promotores" : s >= 7 ? "Neutros" : "Detratores";
  const itens: ItemDetalhe[] = [];
  for (const r of respostas) {
    const g = bucket(r.scoreEmpresa);
    if (!g) continue;
    itens.push({
      grupo: g, nome: r.area || "Anônimo",
      detalhe: `nota ${r.scoreEmpresa}${r.comentarioEmpresa ? " · " + r.comentarioEmpresa : ""}`,
      data: null, valor: 0, // score vai no detalhe; formato "num" mostra a contagem
    });
  }
  const ordem = ["Promotores", "Neutros", "Detratores"];
  return agruparItens(itens, LIMITE_ITENS)
    .map((g) => ({ ...g, formato: "num" as const }))
    .sort((a, b) => ordem.indexOf(a.titulo) - ordem.indexOf(b.titulo));
}

// Lucro: Margem Bruta (só-valor, +) e os componentes de custo drilláveis vêm no endpoint.
export function grupoMargemBruta(valor: number): CeoGrupo {
  return { titulo: "Margem Bruta", total: valor, sinal: "+", formato: "brl", itens: [],
    itensOmitidos: undefined };
}

// Grupo de fluxo de caixa por categoria (entradas ou saídas quitadas).
// Remove o código contábil do rótulo ("03.01.01 Receita de Serviços" → "Receita de Serviços").
function categoriasToGrupo(rows: Array<{ categoria: string; valor: number }>, titulo: string): CeoGrupo {
  const limpar = (c: string) => c.replace(/^[\d.\s]+/, "").trim() || c;
  const itens: ItemDetalhe[] = rows.map((r) => ({
    grupo: titulo, nome: limpar(r.categoria), detalhe: "", data: null, valor: Number(r.valor) || 0,
  }));
  return { titulo, formato: "brl", total: itens.reduce((s, i) => s + i.valor, 0), itens };
}

export function recebidoCategoriasToGrupo(rows: Array<{ categoria: string; valor: number }>): CeoGrupo {
  return categoriasToGrupo(rows, "Receita Recebida (regime de caixa · DFC)");
}

export function pagoCategoriasToGrupo(rows: Array<{ categoria: string; valor: number }>): CeoGrupo {
  return categoriasToGrupo(rows, "Saídas de Caixa (despesas quitadas)");
}

export function receitaCabecaGrupos(receita: number, headcount: number): { grupos: CeoGrupo[]; nota: string } {
  const rc = headcount ? receita / headcount : 0;
  return {
    grupos: [
      { titulo: "Receita Recebida (regime de caixa · DFC)", total: receita, formato: "brl", itens: [] },
      { titulo: "Headcount (colaboradores ativos)", total: headcount, formato: "num", itens: [] },
    ],
    nota: `Receita recebida ÷ Headcount = ${formatBRL(receita)} ÷ ${headcount} = ${formatBRL(rc)}`,
  };
}

// ---- Auditoria das células de LTV (FAT/DFC) ----
// Uma linha por cliente ativo no snapshot do mês (query de auditoria mensal).
export interface LtvAuditoriaRow {
  nome: string;
  tem_match: boolean;
  valorr_snap: number;
  n_rec_snap: number;
  inicio_rec: string | null; // "YYYY-MM-DD"
  rec_full: number;
  rec_pre: number;
  pont_full: number;
  pont_pre: number;
  pago: number;
  n_parcelas: number;
  ltv_fat: number;
  ltv_dfc: number;
}

const fmtBrlCompacto = (v: number): string =>
  Math.abs(v) >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
    : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

const fmtPorMes = (v: number): string => `R$ ${Math.round(v).toLocaleString("pt-BR")}/mês`;

const fmtDataCurta = (iso: string | null): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : null;
};

// Último dia do mês ANTERIOR à célula (o pago real conta até a ENTRADA do mês).
export function ultimoDiaAnterior(mesNum: number): string {
  const d = new Date(2026, mesNum - 1, 0); // dia 0 = último dia do mês anterior
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function detalheFat(r: LtvAuditoriaRow): string {
  const desde = fmtDataCurta(r.inicio_rec);
  const ctx = r.n_rec_snap > 1
    ? ` (${r.n_rec_snap} contratos, ${fmtPorMes(r.valorr_snap)})`
    : desde ? ` (${fmtPorMes(r.valorr_snap)} desde ${desde})` : ` (${fmtPorMes(r.valorr_snap)})`;
  const rec = `recorrente ${fmtBrlCompacto(r.rec_full)}${ctx}`;
  return r.pont_full > 0 ? `${rec} + pontual entregue ${fmtBrlCompacto(r.pont_full)}` : rec;
}

function detalheDfc(r: LtvAuditoriaRow, ateDia: string): string {
  if (!r.tem_match) {
    const pont = r.pont_full > 0 ? ` + pontual ${fmtBrlCompacto(r.pont_full)}` : "";
    return `sem match CNPJ → régua faturável: recorrente ${fmtBrlCompacto(r.rec_full)}${pont}`;
  }
  const teorico = r.rec_pre + r.pont_pre;
  const pagoTxt = r.pago > 0
    ? `pago real ${fmtBrlCompacto(r.pago)} (${r.n_parcelas} parcela${r.n_parcelas === 1 ? "" : "s"} até ${ateDia})`
    : `sem pagamento registrado até ${ateDia}`;
  return teorico > 0 ? `teórico pré-out/25 ${fmtBrlCompacto(teorico)} + ${pagoTxt}` : pagoTxt;
}

// Particiona os clientes do mês em acima/mediana/abaixo e compõe a decomposição
// de cada um. A mediana daqui é a MESMA régua da célula (PERCENTILE_CONT 0.5 =
// valor central; N par = média dos 2 centrais) — reconciliação por construção.
export function ltvAuditoriaToGrupos(
  rows: LtvAuditoriaRow[],
  kpi: "ltv_fat" | "ltv_dfc",
  mesNum: number
): { grupos: CeoGrupo[]; mediana: number | null; media: number | null; soma: number | null; nSemMatch: number } {
  const ateDia = ultimoDiaAnterior(mesNum);
  const valorDe = (r: LtvAuditoriaRow) => (kpi === "ltv_fat" ? r.ltv_fat : r.ltv_dfc);
  const ordenado = [...rows].sort((a, b) => valorDe(b) - valorDe(a));
  const n = ordenado.length;
  if (n === 0) return { grupos: [], mediana: null, media: null, soma: null, nSemMatch: 0 };

  // Índices centrais na ordenação desc (mesmos da asc, por simetria do meio).
  const centrais = n % 2 === 1 ? [(n - 1) / 2] : [n / 2 - 1, n / 2];
  const mediana = Math.round(centrais.reduce((s, i) => s + valorDe(ordenado[i]), 0) / centrais.length);
  // Média sobre os MESMOS clientes exibidos — o gap p/ a mediana revela outliers.
  // A soma sai junto p/ o front mostrar a conta (média = soma ÷ n) de forma auditável.
  const soma = Math.round(ordenado.reduce((s, r) => s + valorDe(r), 0));
  const media = Math.round(soma / n);

  const toItem = (r: LtvAuditoriaRow) => ({
    nome: r.nome || "—",
    detalhe: kpi === "ltv_fat" ? detalheFat(r) : detalheDfc(r, ateDia),
    data: null,
    valor: Math.round(valorDe(r)),
  });
  const grupo = (titulo: string, slice: LtvAuditoriaRow[], aberto: boolean): CeoGrupo => ({
    titulo, formato: "brl", aberto,
    total: Math.round(slice.reduce((s, r) => s + valorDe(r), 0)),
    itens: slice.map(toItem),
  });

  const acima = ordenado.slice(0, centrais[0]);
  const meio = centrais.map((i) => ordenado[i]);
  const abaixo = ordenado.slice(centrais[centrais.length - 1] + 1);
  const grupos = [
    grupo(`Acima da mediana (${acima.length})`, acima, false),
    { ...grupo("Mediana", meio, true), total: mediana },
    grupo(`Abaixo da mediana (${abaixo.length})`, abaixo, false),
  ].filter((g) => g.itens.length > 0);
  return { grupos, mediana, media, soma, nSemMatch: rows.filter((r) => !r.tem_match).length };
}

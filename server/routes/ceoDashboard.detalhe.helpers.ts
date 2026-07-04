import { agruparItens, type ItemDetalhe, type GrupoDetalhe } from "./bp2026.helpers";
import type { DetalheBpResult } from "./bp2026.detalhe";

export const LIMITE_ITENS = 50;

export interface CeoGrupo extends GrupoDetalhe {
  sinal?: "+" | "-";
  formato: "brl" | "num";
}

export interface CeoDetalheResponse {
  kpi: string;
  titulo: string;
  mes: number;
  orcado: number | null;
  realizado: number | null;
  atingimentoPct: number | null;
  grupos: CeoGrupo[];
  nota?: string;
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

export function ltvRowsToGrupos(
  rows: Array<{ nome: string; ltv_total: number }>
): CeoGrupo[] {
  const itens: ItemDetalhe[] = rows.map((r) => ({
    grupo: "Clientes (LTV)", nome: r.nome || "—", detalhe: "", data: null, valor: Number(r.ltv_total) || 0,
  }));
  return agruparItens(itens, LIMITE_ITENS).map((g) => ({ ...g, formato: "brl" as const }));
}

// Lucro: Margem Bruta (só-valor, +) e os componentes de custo drilláveis vêm no endpoint.
export function grupoMargemBruta(valor: number): CeoGrupo {
  return { titulo: "Margem Bruta", total: valor, sinal: "+", formato: "brl", itens: [],
    itensOmitidos: undefined };
}

export function receitaCabecaGrupos(receita: number, headcount: number): { grupos: CeoGrupo[]; nota: string } {
  const rc = headcount ? receita / headcount : 0;
  return {
    grupos: [
      { titulo: "Receita (MRR + Pontual + Outras)", total: receita, formato: "brl", itens: [] },
      { titulo: "Headcount (colaboradores ativos)", total: headcount, formato: "num", itens: [] },
    ],
    nota: `Receita ÷ Headcount = ${formatBRL(receita)} ÷ ${headcount} = ${formatBRL(rc)}`,
  };
}

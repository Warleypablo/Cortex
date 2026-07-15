export type Moeda = "USD" | "BRL";
export type Projeto = "Synapse" | "Cortex" | "Geral";
export type Pilar = "assinaturas" | "anthropic" | "gcp" | "ferramentas";

export interface LinhaCusto {
  pilar: Pilar;
  fornecedor: string;
  projeto: Projeto;
  moeda: Moeda;
  valorOriginal: number;
  valorUSD: number;
  valorBRL: number;
}

export interface ItemRecorrente {
  valor: number;
  ciclo: "mensal" | "anual" | "pontual";
  dataInicio: string;   // YYYY-MM-DD
  dataFim: string | null;
  status: string;       // 'ativo' | 'inativo'
}

/** Extrai 'YYYY-MM' de uma data ISO 'YYYY-MM-DD'. */
export function mesDe(dataISO: string): string {
  return dataISO.slice(0, 7);
}

/** Um item está ativo no mês se o mês cai dentro de [inicio, fim]. Inativo sem fim não conta. */
export function ativoNoMes(
  input: { dataInicio: string; dataFim: string | null; status: string },
  mes: string,
): boolean {
  const inicio = mesDe(input.dataInicio);
  if (mes < inicio) return false;
  const fim = input.dataFim ? mesDe(input.dataFim) : null;
  if (fim && mes > fim) return false;
  if (!fim && input.status.toLowerCase() !== "ativo") return false;
  return true;
}

/** Custo mensal de um item recorrente no mês dado, tratando ciclo e janela de atividade. */
export function custoMensalRecorrente(input: ItemRecorrente, mes: string): number {
  if (!ativoNoMes(input, mes)) return 0;
  if (input.ciclo === "pontual") return mesDe(input.dataInicio) === mes ? input.valor : 0;
  if (input.ciclo === "anual") return input.valor / 12;
  return input.valor;
}

/** Converte um valor da moeda de origem para USD e BRL usando a taxa USD→BRL do mês. */
export function converter(valor: number, moeda: Moeda, taxaUsdBrl: number): { valorUSD: number; valorBRL: number } {
  if (moeda === "BRL") {
    return { valorUSD: taxaUsdBrl ? valor / taxaUsdBrl : 0, valorBRL: valor };
  }
  return { valorUSD: valor, valorBRL: valor * taxaUsdBrl };
}

export function totalBRL(linhas: LinhaCusto[]): number {
  return linhas.reduce((s, l) => s + l.valorBRL, 0);
}

export function totalUSD(linhas: LinhaCusto[]): number {
  return linhas.reduce((s, l) => s + l.valorUSD, 0);
}

/** Agrupa somando valorBRL por uma chave da linha (ex: 'pilar', 'projeto', 'fornecedor'). */
export function agruparPor(linhas: LinhaCusto[], chave: keyof LinhaCusto): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas) {
    const k = String(l[chave]);
    out[k] = (out[k] || 0) + l.valorBRL;
  }
  return out;
}

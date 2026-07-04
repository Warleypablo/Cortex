export type CeoUnidade = "brl" | "pct" | "int" | "score";
export type CeoDirecao = "maior_melhor" | "menor_melhor" | "neutro";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatValor(valor: number | null, unidade: CeoUnidade): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  if (unidade === "brl") return brl.format(valor);
  if (unidade === "pct") return `${pct1.format(valor)}%`; // ex.: 4,2%
  return int.format(valor); // int e score
}

// "score" onde maior = melhor. atingimento = realizado/orcado*100.
// menor_melhor inverte: gastar 90% da meta é ótimo.
export function atingimentoTom(
  pct: number | null,
  direcao: CeoDirecao
): "verde" | "ambar" | "vermelho" | "neutro" {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "neutro";
  const efetivo = direcao === "menor_melhor" ? (pct <= 0 ? 200 : 10000 / pct) : pct;
  if (efetivo >= 100) return "verde";
  if (efetivo >= 80) return "ambar";
  return "vermelho";
}

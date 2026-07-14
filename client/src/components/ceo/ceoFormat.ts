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

// Compacto p/ células de tabela (várias colunas): 1,8M · 777K.
// brl ganha prefixo R$; int/score curtos ficam inteiros; pct 1 casa.
function kmb(v: number): string {
  const a = Math.abs(v);
  const sinal = v < 0 ? "-" : "";
  const corta = (n: number, suf: string) =>
    `${sinal}${n.toFixed(1).replace(/[.,]0$/, "").replace(".", ",")}${suf}`;
  if (a >= 1_000_000_000) return corta(a / 1_000_000_000, "B");
  if (a >= 1_000_000) return corta(a / 1_000_000, "M");
  if (a >= 1_000) return `${sinal}${Math.round(a / 1_000)}K`;
  return `${sinal}${Math.round(a)}`;
}

export function formatCompacto(valor: number | null, unidade: CeoUnidade): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  if (unidade === "pct") return `${pct1.format(valor)}%`;
  if (unidade === "brl") return `R$ ${kmb(valor)}`;
  // int e score: inteiros pequenos por extenso; só compacta se ficar grande.
  return Math.abs(valor) >= 10_000 ? kmb(valor) : int.format(valor);
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

// Cor por limiar fixo de valor (ex.: churn %): > vermelho → vermelho; > ambar → âmbar; senão verde.
export function tomPorFaixa(valor: number | null, faixas: { ambar: number; vermelho: number }): "verde" | "ambar" | "vermelho" | "neutro" {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "neutro";
  if (valor > faixas.vermelho) return "vermelho";
  if (valor > faixas.ambar) return "ambar";
  return "verde";
}

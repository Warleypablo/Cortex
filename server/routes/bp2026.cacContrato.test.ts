import { describe, it, expect } from "vitest";
import { distribuirDeal, agregarVendasProduto, type DealVenda } from "./bp2026.vendasProduto.helpers";
import { SEGMENTOS_RECORRENTES, type SegmentoBP } from "../okr2026/servicosBitrix";

// Garante que o drill do "CAC por contrato" (detCacPorContrato em bp2026.detalhe.ts) conta
// EXATAMENTE o mesmo denominador que a célula da matriz — senão a auditoria mentiria.
// A célula usa agregarVendasProduto (contratosRec/contratosPont); o drill conta 1 item por
// parte de distribuirDeal. Este teste replica a contagem do handler e exige paridade.

const noPr = new Map<number, Map<SegmentoBP, number>>();
const noMix = new Map<string, Map<SegmentoBP, number>>();
const aov = {} as Record<string, number>;

// espelha a lógica de contagem de detCacPorContrato: pai = todas as partes;
// filho = só as partes recorrentes do segmento alvo.
function contarDrill(deals: DealVenda[], mes: number, segAlvo: SegmentoBP | null): number {
  let n = 0;
  for (const d of deals) {
    if (d.mes !== mes) continue;
    for (const p of distribuirDeal(d, noPr, noMix, noMix, aov, aov)) {
      if (segAlvo && (p.segmento !== segAlvo || p.natureza !== "recorrente")) continue;
      n++;
    }
  }
  return n;
}

describe("drill do CAC por contrato bate com o denominador da célula", () => {
  const deals: DealVenda[] = [
    { id: 1, cnpjNorm: "A", mes: 3, valorRec: 4000, valorPont: 0, ids: [846, 852] },    // Perf + Creators (rec)
    { id: 2, cnpjNorm: "B", mes: 3, valorRec: 2000, valorPont: 1000, ids: [846, 868] }, // Perf (rec) + E-commerce (pont)
    { id: 3, cnpjNorm: "C", mes: 3, valorRec: 0, valorPont: 1500, ids: [850] },          // Creators (pont)
    { id: 4, cnpjNorm: "D", mes: 4, valorRec: 999, valorPont: 0, ids: [846] },           // Perf (rec) — outro mês
  ];
  const agg = agregarVendasProduto(deals, noPr, noMix, noMix, aov, aov);

  it("PAI: total = Σ (contratosRec + contratosPont) de todos os segmentos", () => {
    const celula = Array.from(agg.get(3)!.values())
      .reduce((t, c) => t + c.contratosRec + c.contratosPont, 0);
    expect(celula).toBe(5);
    expect(contarDrill(deals, 3, null)).toBe(celula);
  });

  it("FILHO: por segmento = contratosRec do segmento (só recorrente)", () => {
    for (const seg of SEGMENTOS_RECORRENTES) {
      const celula = agg.get(3)?.get(seg)?.contratosRec ?? 0;
      expect(contarDrill(deals, 3, seg)).toBe(celula);
    }
  });

  it("filho conta só recorrente: Creators pontual não entra no denominador do filho Creators", () => {
    // mês 3 tem Creators rec (deal 1) e Creators pont (deal 3); o filho conta só o rec
    expect(agg.get(3)?.get("Creators")?.contratosRec).toBe(1);
    expect(contarDrill(deals, 3, "Creators")).toBe(1);
  });

  it("ignora deals de outros meses", () => {
    expect(contarDrill(deals, 4, "Performance")).toBe(1);
    expect(contarDrill(deals, 4, null)).toBe(1);
  });
});

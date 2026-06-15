import { describe, it, expect } from "vitest";
import { distribuirDeal, aovMedioPorSegmento } from "./bp2026.vendasProduto.helpers";

const noMix = new Map<string, Map<any, number>>();
const aovVazio = {} as Record<string, number>;

describe("distribuirDeal", () => {
  it("produto único: valor inteiro vai para o segmento", () => {
    const r = distribuirDeal(
      { id: 1, cnpjNorm: "X", mes: 6, valorRec: 2997, valorPont: 0, ids: [846] },
      noMix, noMix, aovVazio, aovVazio
    );
    expect(r).toEqual([{ segmento: "Performance", natureza: "recorrente", valor: 2997, contrato: 1 }]);
  });

  it("multi-produto com mix do ClickUp cobrindo todos os segmentos: usa proporção, total = deal (Badbeat)", () => {
    const mixRec = new Map([["BAD", new Map<any, number>([["Performance", 2801], ["Social", 2501], ["Creators", 5498]])]]);
    const r = distribuirDeal(
      { id: 2, cnpjNorm: "BAD", mes: 5, valorRec: 10800, valorPont: 0, ids: [846, 848, 852] },
      mixRec, noMix, aovVazio, aovVazio
    );
    const total = r.reduce((s, x) => s + x.valor, 0);
    expect(Math.round(total)).toBe(10800);
    const perf = r.find((x) => x.segmento === "Performance")!;
    expect(Math.round(perf.valor)).toBe(2801);
  });

  it("mix parcial (ClickUp não cobre todos os segmentos) -> fallback AOV no deal todo (Flico)", () => {
    const mixRec = new Map([["FLI", new Map<any, number>([["Social", 2734]])]]);
    const aovRec = { Performance: 4000, Social: 2000, Creators: 6000 };
    const r = distribuirDeal(
      { id: 3, cnpjNorm: "FLI", mes: 5, valorRec: 11500, valorPont: 0, ids: [846, 848, 852] },
      mixRec, noMix, aovRec, {}
    );
    const total = r.reduce((s, x) => s + x.valor, 0);
    expect(Math.round(total)).toBe(11500);
    expect(Math.round(r.find((x) => x.segmento === "Creators")!.valor)).toBe(5750);
  });

  it("rec e pont no mesmo deal: cada natureza usa seu valor (Clube45-like)", () => {
    const r = distribuirDeal(
      { id: 4, cnpjNorm: "Y", mes: 5, valorRec: 6000, valorPont: 7000, ids: [846, 868] },
      noMix, noMix, aovVazio, aovVazio
    );
    expect(r.find((x) => x.segmento === "Performance")!.valor).toBe(6000);
    expect(r.find((x) => x.segmento === "E-commerce")!.valor).toBe(7000);
  });

  it("conta 1 contrato por segmento distinto da natureza", () => {
    const r = distribuirDeal(
      { id: 5, cnpjNorm: "Z", mes: 5, valorRec: 6000, valorPont: 0, ids: [846, 848] },
      new Map([["Z", new Map<any, number>([["Performance", 1], ["Social", 1]])]]), noMix, {}, {}
    );
    expect(r.filter((x) => x.contrato === 1).length).toBe(2);
  });
});

describe("aovMedioPorSegmento", () => {
  it("média do valor recorrente dos deals de segmento recorrente único", () => {
    const deals = [
      { id: 1, cnpjNorm: "", mes: 1, valorRec: 3000, valorPont: 0, ids: [846] },
      { id: 2, cnpjNorm: "", mes: 1, valorRec: 5000, valorPont: 0, ids: [846] },
      { id: 3, cnpjNorm: "", mes: 1, valorRec: 9999, valorPont: 0, ids: [846, 848] },
    ];
    expect(aovMedioPorSegmento(deals, "recorrente").Performance).toBe(4000);
  });
});

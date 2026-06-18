import { describe, it, expect } from "vitest";
import { montarPonteMrr } from "./bp2026.revenue";

describe("montarPonteMrr", () => {
  const mrrTotal = { 0: 1000, 1: 1100, 2: 1180 };
  const churnTotal = { 1: 50, 2: 60 };
  const vendasMrr = { 1: 200, 2: 150 };
  const linhas = montarPonteMrr(mrrTotal, churnTotal, vendasMrr, 2, 2);
  const by = (m: string) => linhas.find((l) => l.metrica === m)!;

  it("monta as 5 linhas com sinais corretos (jan)", () => {
    expect(by("ponte_mrr_ini").meses[0].realizado).toBe(1000);   // dez
    expect(by("ponte_mrr_vendas").meses[0].realizado).toBe(200);
    expect(by("ponte_mrr_churn").meses[0].realizado).toBe(-50);
    expect(by("ponte_mrr_delta").meses[0].realizado).toBe(-50);  // 1100-1000-200+50
    expect(by("ponte_mrr_fim").meses[0].realizado).toBe(1100);
  });

  it("a ponte fecha em cada mês", () => {
    for (let i = 0; i < 2; i++) {
      const ini = by("ponte_mrr_ini").meses[i].realizado!;
      const ven = by("ponte_mrr_vendas").meses[i].realizado!;
      const chu = by("ponte_mrr_churn").meses[i].realizado!;
      const del = by("ponte_mrr_delta").meses[i].realizado!;
      const fim = by("ponte_mrr_fim").meses[i].realizado!;
      expect(ini + ven + chu + del).toBe(fim);
    }
  });

  it("YTD: inicial=jan(dez), fluxos somados, final=posição; tudo só-realizado", () => {
    expect(by("ponte_mrr_ini").ytd.realizado).toBe(1000);
    expect(by("ponte_mrr_vendas").ytd.realizado).toBe(350);
    expect(by("ponte_mrr_fim").ytd.realizado).toBe(1180);
    for (const l of linhas) {
      expect(l.direcao).toBe("neutro");
      expect(l.meses[0].orcado).toBe(0);
      expect(l.meses[0].atingimento).toBeNull();
    }
  });
});

import { describe, it, expect } from "vitest";
import { utilPct, diff, num, numOrNull, toCsRow, toComercialRow, toSelvaRow } from "./capacityTimes.helpers";

describe("utilPct", () => {
  it("calcula % com 1 casa decimal", () => {
    expect(utilPct(43004, 107510)).toBe(40);
    expect(utilPct(58094, 58094)).toBe(100);
    expect(utilPct(1, 3)).toBe(33.3);
  });
  it("retorna null quando cap é null ou zero", () => {
    expect(utilPct(10, null)).toBeNull();
    expect(utilPct(10, 0)).toBeNull();
  });
});

describe("diff", () => {
  it("retorna cap - atual, ou null quando cap é null", () => {
    expect(diff(30, 12)).toBe(18);
    expect(diff(null, 12)).toBeNull();
  });
});

describe("num / numOrNull", () => {
  it("num coage strings do pg em número, default 0", () => {
    expect(num("58094")).toBe(58094);
    expect(num(null)).toBe(0);
  });
  it("numOrNull preserva null", () => {
    expect(numOrNull(null)).toBeNull();
    expect(numOrNull("45000")).toBe(45000);
  });
});

describe("toCsRow", () => {
  const base = {
    nome: "X",
    op_recorrente: 6,
    op_pontual: 11,
    mrr_operando: 36488,
    mrr_ativo: 36488,
    mrr_onboarding: 0,
    mrr_cancelamento: 0,
  };

  it("coage os campos operacionais e de MRR, somando op_total", () => {
    const r = toCsRow({ ...base, cap_contratos: 20 });
    expect(r.op_recorrente).toBe(6);
    expect(r.op_pontual).toBe(11);
    expect(r.op_total).toBe(17);
    expect(r.mrr_operando).toBe(36488);
    expect(r.mrr_ativo).toBe(36488);
  });

  it("util_contas_pct é op_recorrente / cap_contratos", () => {
    const r = toCsRow({ ...base, cap_contratos: 20 });
    expect(r.util_contas_pct).toBe(utilPct(6, 20));
  });

  it("util_contas_pct é null quando cap_contratos é null", () => {
    const r = toCsRow({ ...base, cap_contratos: null });
    expect(r.util_contas_pct).toBeNull();
  });

  it("cap_fat e util_fat_pct nascem null (preenchidos depois por finalizeSquad)", () => {
    const r = toCsRow({ ...base, cap_contratos: 20 });
    expect(r.cap_fat).toBeNull();
    expect(r.util_fat_pct).toBeNull();
  });

  it("util_fat_pct nasce null (preenchido por finalizeSquad) e util_contas_pct é null sem cap", () => {
    const r = toCsRow({ nome: "Brenda", op_recorrente: 10, op_pontual: 2, mrr_operando: 5000, cap_contratos: null });
    expect(r.util_fat_pct).toBeNull();
    expect(r.util_contas_pct).toBeNull();
  });
});

describe("régua de clientes", () => {
  const baseComercial = {
    nome: "Ana", mrr_operando: 30000, cap_mrr: 40000,
    contas_rec: 18, cap_contas: 20, clientes_rec: 12, cap_clientes: 15,
  };

  it("toComercialRow deriva dif e % de clientes", () => {
    const r = toComercialRow(baseComercial);
    expect(r.clientes).toBe(12);
    expect(r.cap_clientes).toBe(15);
    expect(r.dif_clientes).toBe(3);
    expect(r.util_clientes_pct).toBe(80);
  });

  it("toComercialRow devolve null quando não há cap_clientes", () => {
    const r = toComercialRow({ ...baseComercial, cap_clientes: null });
    expect(r.clientes).toBe(12);
    expect(r.dif_clientes).toBeNull();
    expect(r.util_clientes_pct).toBeNull();
  });

  it("toComercialRow marca estouro com dif negativo", () => {
    const r = toComercialRow({ ...baseComercial, clientes_rec: 20 });
    expect(r.dif_clientes).toBe(-5);
    expect(r.util_clientes_pct).toBe(133.3);
  });

  it("toCsRow expõe a régua de clientes", () => {
    const r = toCsRow({
      nome: "Brenda", op_recorrente: 10, op_pontual: 2, mrr_operando: 5000,
      cap_contratos: 12, clientes_rec: 8, cap_clientes: 10,
    });
    expect(r.clientes).toBe(8);
    expect(r.dif_clientes).toBe(2);
    expect(r.util_clientes_pct).toBe(80);
  });

  it("toSelvaRow conta clientes da carteira (rec + pontual)", () => {
    const r = toSelvaRow({
      nome: "Caio", contas_total: 9, mrr_operando: 18000, pontual_operando: 2000,
      clientes_total: 6, cap_clientes: 8,
    }, 12);
    expect(r.clientes).toBe(6);
    expect(r.dif_clientes).toBe(2);
    expect(r.util_clientes_pct).toBe(75);
  });

  it("cap_clientes zero não divide por zero", () => {
    const r = toComercialRow({ ...baseComercial, cap_clientes: 0 });
    expect(r.util_clientes_pct).toBeNull();
  });
});

describe("faturamento R+P e detalhe de clientes", () => {
  const base = {
    nome: "Ana", mrr_operando: "30000", pontual_operando: "5000", cap_mrr: "40000",
    contas_rec: "18", cap_contas: "20",
    clientes_total: "14", clientes_rec: "12", clientes_pont: "5", cap_clientes: "15",
  };

  it("toComercialRow soma pontual ao faturamento e deriva a % sobre o total", () => {
    const r = toComercialRow(base);
    expect(r.mrr_atual).toBe(35000); // 30k recorrente + 5k pontual
    expect(r.util_mrr_pct).toBe(87.5); // 35000 / 40000
  });

  it("toComercialRow trata pontual ausente como zero (não NaN)", () => {
    const { pontual_operando, ...semPontual } = base;
    expect(toComercialRow(semPontual).mrr_atual).toBe(30000);
  });

  it("clientes usa o total (rec OU pont), com o detalhe em colunas próprias", () => {
    const r = toComercialRow(base);
    expect(r.clientes).toBe(14);
    expect(r.clientes_rec).toBe(12);
    expect(r.clientes_pont).toBe(5);
    // Rec + Pont pode passar do total: quem tem os dois entra nas duas contagens.
    expect(r.clientes_rec + r.clientes_pont).toBeGreaterThan(r.clientes);
  });

  it("dif e % de clientes seguem o total, não o recorrente", () => {
    const r = toComercialRow(base);
    expect(r.dif_clientes).toBe(1); // cap 15 - 14 clientes
    expect(r.util_clientes_pct).toBe(93.3);
  });

  it("toCsRow e toSelvaRow expõem o mesmo detalhe", () => {
    const cs = toCsRow({ nome: "Brenda", op_recorrente: "10", op_pontual: "2", mrr_operando: "5000",
      cap_contratos: "12", clientes_total: "9", clientes_rec: "8", clientes_pont: "3", cap_clientes: "10" });
    expect([cs.clientes, cs.clientes_rec, cs.clientes_pont]).toEqual([9, 8, 3]);

    const selva = toSelvaRow({ nome: "Caio", contas_total: "9", mrr_operando: "18000", pontual_operando: "2000",
      clientes_total: "6", clientes_rec: "4", clientes_pont: "3", cap_clientes: "8" }, 12);
    expect([selva.clientes, selva.clientes_rec, selva.clientes_pont]).toEqual([6, 4, 3]);
  });
});

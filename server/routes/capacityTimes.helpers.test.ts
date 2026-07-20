import { describe, it, expect } from "vitest";
import { utilPct, diff, num, numOrNull, toCsRow } from "./capacityTimes.helpers";

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

  it("cap_fat, util_fat_pct e util_pct nascem null (preenchidos depois por finalizeSquad)", () => {
    const r = toCsRow({ ...base, cap_contratos: 20 });
    expect(r.cap_fat).toBeNull();
    expect(r.util_fat_pct).toBeNull();
    expect(r.util_pct).toBeNull();
  });

  it("util_fat_pct nasce null (preenchido por finalizeSquad) e util_contas_pct é null sem cap", () => {
    const r = toCsRow({ nome: "Brenda", op_recorrente: 10, op_pontual: 2, mrr_operando: 5000, cap_contratos: null });
    expect(r.util_fat_pct).toBeNull();
    expect(r.util_contas_pct).toBeNull();
  });
});

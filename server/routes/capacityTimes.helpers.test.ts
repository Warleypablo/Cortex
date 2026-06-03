import { describe, it, expect } from "vitest";
import {
  utilPct, diff, num, numOrNull, parseAggRow, buildResponse,
  type CapacityAggRow,
} from "./capacityTimes.helpers";

describe("utilPct", () => {
  it("calcula % com 1 casa decimal", () => {
    expect(utilPct(43004, 107510)).toBe(40);
    expect(utilPct(58094, 58094)).toBe(100);
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

describe("parseAggRow", () => {
  it("coage uma linha crua do pg", () => {
    const raw = {
      nome: "Brenda", categoria: "cs",
      cap_recorrente: "15", cap_mrr: "45000", cap_pontual: "0", cap_contas: null,
      op_recorrente: "10", mrr_operando: "30238", mrr_ativo: "30238",
      mrr_onboarding: "0", mrr_cancelamento: "0", op_pontual: "0",
    };
    const r = parseAggRow(raw);
    expect(r.cap_recorrente).toBe(15);
    expect(r.cap_contas).toBeNull();
    expect(r.op_recorrente).toBe(10);
    expect(r.mrr_operando).toBe(30238);
  });
});

describe("buildResponse", () => {
  const rows: CapacityAggRow[] = [
    { nome: "Brenda", categoria: "cs", cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0, cap_contas: null,
      op_recorrente: 10, mrr_operando: 30238, mrr_ativo: 30238, mrr_onboarding: 0, mrr_cancelamento: 0, op_pontual: 0 },
    { nome: "Mariana Dalto", categoria: "cs", cap_recorrente: 20, cap_mrr: null, cap_pontual: null, cap_contas: null,
      op_recorrente: 6, mrr_operando: 36488, mrr_ativo: 29488, mrr_onboarding: 0, mrr_cancelamento: 7000, op_pontual: 11 },
    { nome: "Gabriel Taufner", categoria: "vendedor", cap_recorrente: null, cap_mrr: 107510, cap_pontual: null, cap_contas: 30,
      op_recorrente: 12, mrr_operando: 43004, mrr_ativo: 43004, mrr_onboarding: 0, mrr_cancelamento: 0, op_pontual: 0 },
  ];

  it("agrupa por categoria", () => {
    const out = buildResponse(rows);
    expect(out.cs).toHaveLength(2);
    expect(out.vendedor).toHaveLength(1);
    expect(out.account).toHaveLength(0);
    expect(out.gestor).toHaveLength(0);
  });

  it("CS com cap_mrr usa utilização por MRR", () => {
    const brenda = buildResponse(rows).cs.find((r) => r.nome === "Brenda")!;
    expect(brenda.util_pct).toBe(utilPct(30238, 45000));
    expect(brenda.op_total).toBe(10);
  });

  it("CS sem cap_mrr usa utilização por total de contas (rec+pont)", () => {
    const mari = buildResponse(rows).cs.find((r) => r.nome === "Mariana Dalto")!;
    expect(mari.op_total).toBe(17);
    expect(mari.util_pct).toBe(utilPct(17, 20));
  });

  it("comercial calcula diferenças e utilização por MRR", () => {
    const g = buildResponse(rows).vendedor[0];
    expect(g.dif_mrr).toBe(107510 - 43004);
    expect(g.dif_contas).toBe(30 - 12);
    expect(g.util_pct).toBe(utilPct(43004, 107510));
  });
});

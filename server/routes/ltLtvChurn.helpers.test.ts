import { describe, it, expect } from "vitest";
import { revenueChurnPct } from "./ltLtvChurn.helpers";

describe("revenueChurnPct", () => {
  it("calcula percentual com 1 casa decimal", () => {
    expect(revenueChurnPct(92468, 863597)).toBe(10.7);
  });
  it("retorna 0 quando base ativa é 0 (evita divisão por zero)", () => {
    expect(revenueChurnPct(1000, 0)).toBe(0);
  });
  it("retorna 0 quando não há MRR perdido", () => {
    expect(revenueChurnPct(0, 500000)).toBe(0);
  });
});

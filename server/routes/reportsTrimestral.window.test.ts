import { describe, it, expect } from "vitest";
import {
  parseTrimestre,
  buildQuarterWindow,
  getTrimestreOptions,
  getDefaultTrimestre,
} from "./reportsTrimestral.window";

describe("parseTrimestre", () => {
  it("parses valid quarter", () => {
    expect(parseTrimestre("2026-Q3")).toEqual({ ano: 2026, quarter: 3 });
  });
  it("rejects invalid", () => {
    expect(parseTrimestre("2026-13")).toBeNull();
    expect(parseTrimestre("2026-Q5")).toBeNull();
    expect(parseTrimestre("lixo")).toBeNull();
  });
});

describe("buildQuarterWindow", () => {
  it("closed quarter Q2 2026 seen from Jul 8 2026", () => {
    const w = buildQuarterWindow("2026-Q2", new Date(2026, 6, 8)); // month idx 6 = Julho
    expect(w.label).toBe("Q2 2026");
    expect(w.startMonth).toBe(4);
    expect(w.dataStart).toBe("2026-04-01");
    expect(w.dataEnd).toBe("2026-07-01");
    expect(w.meses).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(w.parcial).toBe(false);
    expect(w.mesesComputados).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(w.fotoDate).toBe("2026-07-01"); // fim exclusivo do tri fechado
    expect(w.prev.trimestre).toBe("2026-Q1");
    expect(w.prev.dataStart).toBe("2026-01-01");
    expect(w.prev.dataEnd).toBe("2026-04-01");
  });

  it("partial current quarter Q3 2026 seen from Jul 8 2026", () => {
    const w = buildQuarterWindow("2026-Q3", new Date(2026, 6, 8));
    expect(w.dataStart).toBe("2026-07-01");
    expect(w.dataEnd).toBe("2026-10-01");
    expect(w.parcial).toBe(true);
    expect(w.mesesComputados).toEqual(["2026-07"]); // só o mês corrente decorrido
    expect(w.fotoDate).toBe("2026-07-08"); // parcial → hoje
  });

  it("Q1 rolls prev back to Q4 of previous year", () => {
    const w = buildQuarterWindow("2026-Q1", new Date(2026, 6, 8));
    expect(w.prev.trimestre).toBe("2025-Q4");
    expect(w.prev.dataStart).toBe("2025-10-01");
    expect(w.prev.dataEnd).toBe("2026-01-01");
  });
});

describe("getDefaultTrimestre / getTrimestreOptions", () => {
  it("default is the current quarter", () => {
    expect(getDefaultTrimestre(new Date(2026, 6, 8))).toBe("2026-Q3");
  });
  it("options are most-recent-first and include current", () => {
    const opts = getTrimestreOptions(new Date(2026, 6, 8), 6);
    expect(opts).toHaveLength(6);
    expect(opts[0]).toEqual({ value: "2026-Q3", label: "Q3 2026" });
    expect(opts[1]).toEqual({ value: "2026-Q2", label: "Q2 2026" });
    expect(opts[5]).toEqual({ value: "2025-Q2", label: "Q2 2025" });
  });
});

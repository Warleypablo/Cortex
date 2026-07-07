import { describe, it, expect } from "vitest";
import { calcStatus, deltaM1, formatValor, linhasPorDimensao } from "./logica";

describe("calcStatus", () => {
  it("direction up: atual >= meta → good", () => {
    expect(calcStatus(100, 100, "up")).toBe("good");
  });

  it("direction up: atual < 90% da meta → bad", () => {
    expect(calcStatus(85, 100, "up")).toBe("bad");
  });

  it("direction up: atual entre 90% e 100% da meta → warn", () => {
    expect(calcStatus(95, 100, "up")).toBe("warn");
  });

  it("direction down: atual muito acima da meta (churn) → bad", () => {
    expect(calcStatus(200, 96, "down")).toBe("bad");
  });

  it("direction down: atual <= meta → good", () => {
    expect(calcStatus(80, 96, "down")).toBe("good");
  });

  it("direction down: atual até 110% da meta → warn", () => {
    expect(calcStatus(100, 96, "down")).toBe("warn");
  });

  it("sem meta (null) → null", () => {
    expect(calcStatus(100, null, "up")).toBeNull();
  });

  it("sem meta (undefined) → null", () => {
    expect(calcStatus(100, undefined, "up")).toBeNull();
  });

  it("atual null → null", () => {
    expect(calcStatus(null, 100, "up")).toBeNull();
  });
});

describe("deltaM1", () => {
  it("compara os 2 últimos pontos válidos (alta)", () => {
    expect(deltaM1([{ valor: 100 }, { valor: 110 }])).toEqual({ pct: 10, dir: "up" });
  });

  it("compara os 2 últimos pontos válidos (queda)", () => {
    expect(deltaM1([{ valor: 100 }, { valor: 90 }])).toEqual({ pct: -10, dir: "down" });
  });

  it("variação pequena (<0.05%) → flat", () => {
    const r = deltaM1([{ valor: 1000 }, { valor: 1000.2 }]);
    expect(r?.dir).toBe("flat");
    expect(r?.pct).toBeCloseTo(0.02, 5);
  });

  it("ignora pontos null no fim, usa os 2 últimos válidos", () => {
    expect(deltaM1([{ valor: 100 }, { valor: 120 }, { valor: null }])).toEqual({ pct: 20, dir: "up" });
  });

  it("base 0 → flat (evita divisão por zero)", () => {
    expect(deltaM1([{ valor: 0 }, { valor: 50 }])).toEqual({ pct: 0, dir: "flat" });
  });

  it("menos de 2 pontos válidos → null", () => {
    expect(deltaM1([{ valor: 100 }])).toBeNull();
  });

  it("array vazio → null", () => {
    expect(deltaM1([])).toBeNull();
  });

  it("undefined → null", () => {
    expect(deltaM1(undefined)).toBeNull();
  });
});

describe("formatValor", () => {
  it("brl", () => {
    expect(formatValor(1234, "brl")).toBe("R$ 1.234");
  });

  it("pct", () => {
    expect(formatValor(12.5, "pct")).toBe("12.5%");
  });

  it("int", () => {
    expect(formatValor(1234, "int")).toBe("1.234");
  });

  it("meses", () => {
    expect(formatValor(8.4, "meses")).toBe("8.4 meses");
  });

  it("null → travessão", () => {
    expect(formatValor(null, "brl")).toBe("—");
  });

  it("undefined → travessão", () => {
    expect(formatValor(undefined, "pct")).toBe("—");
  });
});

describe("linhasPorDimensao", () => {
  const labelMes = (mes: string) => `L-${mes.split("-")[1]}`;

  it("series undefined → []", () => {
    expect(linhasPorDimensao(undefined, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes })).toEqual([]);
  });

  it("atual vem do ponto com month === mes; ordena por atual desc", () => {
    const series = {
      Squadra: [{ month: "2026-05", valor: 100 }, { month: "2026-06", valor: 300 }],
      Makers: [{ month: "2026-05", valor: 50 }, { month: "2026-06", valor: 500 }],
    };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => `k_${d}`, formato: "brl", labelMes });
    expect(linhas.map((l) => l.metrica)).toEqual(["Makers", "Squadra"]);
    expect(linhas[0].atual).toBe(500);
    expect(linhas[0].key).toBe("k_Makers");
  });

  it("série preserva month/label/valor na ordem cronológica", () => {
    const series = { Squadra: [{ month: "2026-06", valor: 300 }, { month: "2026-05", valor: 100 }] };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes });
    expect(linhas[0].serie).toEqual([
      { month: "2026-05", valor: 100, label: "L-05" },
      { month: "2026-06", valor: 300, label: "L-06" },
    ]);
  });

  it("mes selecionado ausente na série → usa o último ponto <= mes", () => {
    const series = { Squadra: [{ month: "2026-04", valor: 10 }, { month: "2026-05", valor: 20 }] };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes });
    expect(linhas[0].atual).toBe(20);
  });

  it("top limita a quantidade de linhas após ordenar", () => {
    const series = {
      A: [{ month: "2026-06", valor: 10 }],
      B: [{ month: "2026-06", valor: 30 }],
      C: [{ month: "2026-06", valor: 20 }],
    };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes, top: 2 });
    expect(linhas.map((l) => l.metrica)).toEqual(["B", "C"]);
  });

  it("sub recebe (dim, atual) já resolvidos da própria série", () => {
    const series = { A: [{ month: "2026-06", valor: 10 }] };
    const linhas = linhasPorDimensao(series, "2026-06", {
      keyFn: (d) => d, formato: "brl", labelMes,
      sub: (dim, atual) => `${dim}:${atual}`,
    });
    expect(linhas[0].sub).toBe("A:10");
  });

  it("responsavelAuto marca a própria dimensão como dono", () => {
    const series = { Ana: [{ month: "2026-06", valor: 10 }] };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes, responsavelAuto: true });
    expect(linhas[0].responsavelAuto).toBe("Ana");
  });

  it("todas as linhas ficam com temporalidade 'mes'", () => {
    const series = { A: [{ month: "2026-06", valor: 10 }] };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes });
    expect(linhas[0].temporalidade).toBe("mes");
  });
});

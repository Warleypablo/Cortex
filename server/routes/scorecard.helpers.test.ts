import { describe, it, expect } from "vitest";
import { ultimoDiaMes } from "./scorecard.helpers";

describe("ultimoDiaMes", () => {
  it("calcula o último dia de um mês de 31 dias", () => {
    expect(ultimoDiaMes("2026-01")).toBe("2026-01-31");
  });

  it("calcula o último dia de um mês de 30 dias", () => {
    expect(ultimoDiaMes("2026-06")).toBe("2026-06-30");
  });

  it("calcula fevereiro em ano bissexto", () => {
    expect(ultimoDiaMes("2024-02")).toBe("2024-02-29");
  });

  it("calcula fevereiro em ano NÃO bissexto", () => {
    expect(ultimoDiaMes("2026-02")).toBe("2026-02-28");
  });

  it("cruza a virada de ano (dezembro)", () => {
    expect(ultimoDiaMes("2026-12")).toBe("2026-12-31");
  });
});

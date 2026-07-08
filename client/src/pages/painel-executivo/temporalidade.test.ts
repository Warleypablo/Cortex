import { describe, it, expect } from "vitest";
import { mesDefault, labelMes, paramsParaMes, mesesOptions } from "./temporalidade";

describe("temporalidade", () => {
  it("mesDefault retorna o mês anterior ao atual", () => {
    expect(mesDefault(new Date(2026, 6, 7))).toBe("2026-06"); // julho → junho
    expect(mesDefault(new Date(2026, 0, 15))).toBe("2025-12"); // janeiro → dezembro ano anterior
  });

  it("labelMes formata em pt-BR", () => {
    expect(labelMes("2026-06")).toBe("Junho 2026");
  });

  it("paramsParaMes cobre os 4 dialetos e o range de datas do mês", () => {
    const p = paramsParaMes("2026-06");
    expect(p.mes).toBe("2026-06");
    expect(p.deAte).toEqual({ de: "2026-06", ate: "2026-06" });
    expect(p.dataInicioFim).toEqual({ dataInicio: "2026-06", dataFim: "2026-06" });
    expect(p.mesInicioFim).toEqual({ mesInicio: "2026-06", mesFim: "2026-06" });
    expect(p.startEndDate).toEqual({ startDate: "2026-06-01", endDate: "2026-06-30" });
  });

  it("startEndDate calcula o último dia de fevereiro corretamente", () => {
    expect(paramsParaMes("2026-02").startEndDate.endDate).toBe("2026-02-28");
  });

  it("mesesOptions gera n meses decrescentes começando no mês fechado", () => {
    const opts = mesesOptions(new Date(2026, 6, 7), 3);
    expect(opts.map((o) => o.value)).toEqual(["2026-06", "2026-05", "2026-04"]);
    expect(opts[0].label).toBe("Junho 2026");
  });
});

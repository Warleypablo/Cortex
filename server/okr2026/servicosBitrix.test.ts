import { describe, it, expect } from "vitest";
import { SERVICOS_BITRIX, parseServicosVendidos, segmentosPorNatureza } from "./servicosBitrix";

describe("de-para de serviços Bitrix", () => {
  it("mapeia os IDs nomeados para o segmento certo", () => {
    expect(SERVICOS_BITRIX[846].segmento).toBe("Performance");
    expect(SERVICOS_BITRIX[852].segmento).toBe("Creators");
    expect(SERVICOS_BITRIX[848].segmento).toBe("Social");
    expect(SERVICOS_BITRIX[870].segmento).toBe("Gestão de Comunidade");
    expect(SERVICOS_BITRIX[868].segmento).toBe("E-commerce");
    expect(SERVICOS_BITRIX[880].segmento).toBe("Site Institucional");
    expect(SERVICOS_BITRIX[882].segmento).toBe("Landing Page");
  });

  it("classifica natureza recorrente vs pontual", () => {
    expect(SERVICOS_BITRIX[846].natureza).toBe("recorrente");
    expect(SERVICOS_BITRIX[850].natureza).toBe("pontual");
    expect(SERVICOS_BITRIX[868].natureza).toBe("pontual");
  });

  it("serviços não nomeados caem em Others", () => {
    expect(SERVICOS_BITRIX[858].segmento).toBe("Others");
    expect(SERVICOS_BITRIX[856].segmento).toBe("Others");
  });

  it("parseServicosVendidos extrai IDs e ignora vazios/False", () => {
    expect(parseServicosVendidos("[846, 852]")).toEqual([846, 852]);
    expect(parseServicosVendidos("[850]")).toEqual([850]);
    expect(parseServicosVendidos("False")).toEqual([]);
    expect(parseServicosVendidos("[]")).toEqual([]);
    expect(parseServicosVendidos(null)).toEqual([]);
  });

  it("segmentosPorNatureza devolve segmentos distintos por natureza", () => {
    const r = segmentosPorNatureza([846, 848, 850, 868]);
    expect(r.recorrente.sort()).toEqual(["Performance", "Social"].sort());
    expect(r.pontual.sort()).toEqual(["E-commerce", "Others"].sort());
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyDealStatus } from "./sdr-assistant";

describe("classifyDealStatus", () => {
  it("retorna 'perdido' quando stage contém 'Perdido'", () => {
    expect(classifyDealStatus("Negócio Perdido")).toBe("perdido");
    expect(classifyDealStatus("Perdido - sem interesse")).toBe("perdido");
  });

  it("retorna 'perdido' quando stage contém 'LOSE'", () => {
    expect(classifyDealStatus("LOSE")).toBe("perdido");
    expect(classifyDealStatus("C1:LOSE")).toBe("perdido");
  });

  it("retorna 'ganho' quando stage contém 'Ganho' ou 'WON'", () => {
    expect(classifyDealStatus("Negócio Ganho")).toBe("ganho");
    expect(classifyDealStatus("WON")).toBe("ganho");
    expect(classifyDealStatus("C1:WON")).toBe("ganho");
  });

  it("retorna 'ativo' em qualquer outro caso", () => {
    expect(classifyDealStatus("Proposta enviada")).toBe("ativo");
    expect(classifyDealStatus("Contactado")).toBe("ativo");
    expect(classifyDealStatus("")).toBe("ativo");
  });

  it("é case-insensitive", () => {
    expect(classifyDealStatus("negócio perdido")).toBe("perdido");
    expect(classifyDealStatus("lose")).toBe("perdido");
    expect(classifyDealStatus("negócio ganho")).toBe("ganho");
  });
});

import { describe, it, expect } from "vitest";
import { BP2026_TABS, BP2026_TAB_IDS, abasPermitidas, podeAcessarBp2026 } from "./bp2026-tabs";

describe("BP2026_TABS", () => {
  it("tem as 11 abas na ordem canônica", () => {
    expect(BP2026_TAB_IDS).toEqual([
      "dre", "metricas", "revenue", "funil", "vendasProduto", "capacity",
      "sga", "cac", "outras", "pontual", "pontual-creators",
    ]);
  });
});

describe("abasPermitidas", () => {
  it("admin vê todas, ignorando allowedBpTabs", () => {
    expect(abasPermitidas("admin", [])).toEqual(BP2026_TAB_IDS);
    expect(abasPermitidas("admin", null)).toEqual(BP2026_TAB_IDS);
  });
  it("user sem grant não vê nada", () => {
    expect(abasPermitidas("user", [])).toEqual([]);
    expect(abasPermitidas("user", null)).toEqual([]);
  });
  it("user vê só as abas liberadas, na ordem canônica e sem ids inválidos", () => {
    expect(abasPermitidas("user", ["cac", "dre", "inexistente"])).toEqual(["dre", "cac"]);
  });
});

describe("podeAcessarBp2026", () => {
  it("user com ao menos uma aba liberada pode abrir a página", () => {
    expect(podeAcessarBp2026("user", ["revenue"])).toBe(true);
  });
  it("user sem nenhuma aba liberada não pode abrir a página", () => {
    expect(podeAcessarBp2026("user", [])).toBe(false);
    expect(podeAcessarBp2026("user", null)).toBe(false);
  });
  it("aba inválida não concede acesso", () => {
    expect(podeAcessarBp2026("user", ["inexistente"])).toBe(false);
  });
  it("admin sempre pode abrir a página", () => {
    expect(podeAcessarBp2026("admin", [])).toBe(true);
  });
});

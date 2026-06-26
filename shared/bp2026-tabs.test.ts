import { describe, it, expect } from "vitest";
import { BP2026_TABS, BP2026_TAB_IDS, abasPermitidas } from "./bp2026-tabs";

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

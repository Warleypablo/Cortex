import { describe, it, expect } from "vitest";
import { classificarPorRegra } from "./replyClassifier";

describe("classificarPorRegra", () => {
  it("opt-out exigido pela Meta", () => {
    expect(classificarPorRegra("Stop Promotions")?.sentiment).toBe("opt_out");
    expect(classificarPorRegra("quero sair da lista")?.sentiment).toBe("opt_out");
  });

  it("clique em botão de interesse → positiva", () => {
    expect(classificarPorRegra("QUERO ENTENDER MAIS")?.sentiment).toBe("positiva");
    expect(classificarPorRegra("DIAGNÓSTICO")?.sentiment).toBe("positiva");
    expect(classificarPorRegra("Sim")?.sentiment).toBe("positiva");
  });

  it("recusa explícita → negativa", () => {
    expect(classificarPorRegra("não tenho interesse")?.sentiment).toBe("negativa");
    expect(classificarPorRegra("sem interesse, obrigado")?.sentiment).toBe("negativa");
  });

  it("resposta vazia → neutra", () => {
    expect(classificarPorRegra("")?.sentiment).toBe("neutra");
  });

  it("texto livre ambíguo → null (deixa pra IA)", () => {
    expect(
      classificarPorRegra(
        "Antes de um possível papo gostaríamos de entender um range mínimo de valores para investir.",
      ),
    ).toBeNull();
  });
});

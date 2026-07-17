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

  it("responde a palavra-chave pedida no CTA → positiva (não neutra)", () => {
    const cta = "Quer participar da campanha de UGC? Responda UGC aqui que a gente te envia os detalhes.";
    expect(classificarPorRegra("UGC", cta)?.sentiment).toBe("positiva");
    expect(classificarPorRegra("ugc", cta)?.sentiment).toBe("positiva");
  });

  it("palavra-chave do CTA com verbo variado (comente/digite)", () => {
    expect(classificarPorRegra("EU QUERO", "Comente EU QUERO pra receber o material.")?.sentiment).toBe("positiva");
    expect(classificarPorRegra("bora", "Digite bora que te mando o link.")?.sentiment).toBe("positiva");
  });

  it("keyword do CTA com pontuação/acento diferente ainda é positiva", () => {
    const cta = 'Responde "UGC" que a gente mostra como funciona! 🎬';
    expect(classificarPorRegra("Ugc!", cta)?.sentiment).toBe("positiva");
    expect(classificarPorRegra("ugc.", cta)?.sentiment).toBe("positiva");
    const ctaAcento = 'Quer garantir sua vaga? Responda "REUNIÃO" aqui.';
    expect(classificarPorRegra("reuniao", ctaAcento)?.sentiment).toBe("positiva");
  });

  it("eco PARCIAL da keyword entre aspas (1 caractere faltando) → positiva", () => {
    const cta = 'Responde "UGC" que a gente mostra como funciona!';
    expect(classificarPorRegra("GC", cta)?.sentiment).toBe("positiva");
    // faltando mais que 1 caractere não dispara a regra (vai pra IA)
    const ctaDiag = 'Responde "DIAGNÓSTICO" que a gente faz uma ligação!';
    expect(classificarPorRegra("di", ctaDiag)).toBeNull();
  });

  it("keyword entre aspas sem verbo de CTA no corpo não dispara a regra", () => {
    expect(classificarPorRegra("GC", 'A sigla "UGC" está na moda.')).toBeNull();
  });

  it("sem broadcast de contexto, token ambíguo continua null (vai pra IA)", () => {
    expect(classificarPorRegra("UGC")).toBeNull();
  });

  it("token que NÃO é pedido pelo CTA não vira positiva por regra", () => {
    // "XPTO" não aparece após verbo de CTA no corpo → regra não decide (null → IA)
    expect(classificarPorRegra("XPTO", "Responda UGC pra participar.")).toBeNull();
  });

  it("negativa/opt-out têm precedência sobre a regra de CTA", () => {
    const cta = "Responda SIM pra receber.";
    expect(classificarPorRegra("não tenho interesse", cta)?.sentiment).toBe("negativa");
    expect(classificarPorRegra("me exclua da lista", cta)?.sentiment).toBe("opt_out");
  });
});

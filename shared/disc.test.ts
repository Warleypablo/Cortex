import { describe, it, expect } from "vitest";
import { DISC_PERGUNTAS, DISC_ARQUETIPOS, computeDiscResult, FATORES, type Fator } from "./disc";

describe("DISC_PERGUNTAS (banco)", () => {
  it("tem exatamente 40 perguntas", () => {
    expect(DISC_PERGUNTAS).toHaveLength(40);
  });

  it("cada pergunta tem 4 opções, uma por fator, sem palavra vazia", () => {
    for (const p of DISC_PERGUNTAS) {
      expect(p.opcoes).toHaveLength(4);
      const fatores = p.opcoes.map((o) => o.fator).sort();
      expect(fatores).toEqual(["C", "D", "I", "S"]);
      for (const o of p.opcoes) {
        expect(o.palavra.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("ids são 1..40 únicos", () => {
    const ids = DISC_PERGUNTAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(40);
    expect(Math.min(...ids)).toBe(1);
    expect(Math.max(...ids)).toBe(40);
  });

  it("cada fator aparece exatamente 40 vezes no banco", () => {
    const cont: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };
    for (const p of DISC_PERGUNTAS) for (const o of p.opcoes) cont[o.fator]++;
    expect(cont).toEqual({ D: 40, I: 40, S: 40, C: 40 });
  });

  it("não repete palavra dentro de um mesmo grupo", () => {
    for (const p of DISC_PERGUNTAS) {
      const palavras = p.opcoes.map((o) => o.palavra);
      expect(new Set(palavras).size).toBe(4);
    }
  });
});

describe("DISC_ARQUETIPOS", () => {
  it("tem os 4 fatores com conteúdo preenchido", () => {
    for (const f of FATORES) {
      const a = DISC_ARQUETIPOS[f];
      expect(a.fator).toBe(f);
      expect(a.nome.length).toBeGreaterThan(0);
      expect(a.pontosFortes.length).toBeGreaterThanOrEqual(3);
      expect(a.comunicacao.length).toBeGreaterThanOrEqual(3);
      expect(a.atencao.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("computeDiscResult", () => {
  it("conta as escolhas por fator e soma percentuais = 100", () => {
    const respostas: Fator[] = [
      ...Array(20).fill("D"),
      ...Array(10).fill("I"),
      ...Array(6).fill("S"),
      ...Array(4).fill("C"),
    ];
    const r = computeDiscResult(respostas);
    expect(r.scoreD).toBe(20);
    expect(r.scoreI).toBe(10);
    expect(r.scoreS).toBe(6);
    expect(r.scoreC).toBe(4);
    const soma = r.percentuais.D + r.percentuais.I + r.percentuais.S + r.percentuais.C;
    expect(soma).toBe(100);
    expect(r.dominante).toBe("D");
    expect(r.secundario).toBe("I");
  });

  it("resolve empate pela ordem canônica D > I > S > C", () => {
    const respostas: Fator[] = [...Array(20).fill("S"), ...Array(20).fill("I")];
    const r = computeDiscResult(respostas);
    // empate 20x20: I vem antes de S na ordem canônica
    expect(r.dominante).toBe("I");
    expect(r.secundario).toBe("S");
  });

  it("todas as respostas de um fator só", () => {
    const r = computeDiscResult(Array(40).fill("C"));
    expect(r.scoreC).toBe(40);
    expect(r.percentuais.C).toBe(100);
    expect(r.dominante).toBe("C");
  });
});

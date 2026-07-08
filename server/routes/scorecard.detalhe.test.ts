import { describe, it, expect } from "vitest";
import {
  limitesMes,
  DIM_COLUNA_CHURN_RECORRENTE,
  DIM_COLUNA_CHURN_PONTUAL,
  montarChurnPctDrillDetalhe,
  converterDetalheGestaoReceita,
  montarDetalheScorecard,
} from "./scorecard.detalhe";

describe("limitesMes", () => {
  it("calcula [inicio, fim) do mês", () => {
    expect(limitesMes("2026-06")).toEqual({ inicio: "2026-06-01", fim: "2026-07-01" });
  });

  it("cruza a virada de ano", () => {
    expect(limitesMes("2026-12")).toEqual({ inicio: "2026-12-01", fim: "2027-01-01" });
  });
});

describe("DIM_COLUNA_CHURN_RECORRENTE / DIM_COLUNA_CHURN_PONTUAL", () => {
  it("mapeia as 4 dimensões suportadas do Churn Recorrente (view vw_cup_churn_ajustado)", () => {
    expect(DIM_COLUNA_CHURN_RECORRENTE).toEqual({
      produto: "produto",
      operador: "responsavel_geral",
      squad: "squad",
      motivo: "motivo_cancelamento",
    });
  });

  it("mapeia as 4 dimensões do Churn Pontual (cup_contratos) — operador usa 'responsavel', não 'responsavel_geral'", () => {
    expect(DIM_COLUNA_CHURN_PONTUAL).toEqual({
      produto: "produto",
      operador: "responsavel",
      squad: "squad",
      motivo: "motivo_cancelamento",
    });
  });
});

describe("montarChurnPctDrillDetalhe", () => {
  it("monta os 2 componentes da composição, sem `total` (é uma razão, não uma soma)", () => {
    const d = montarChurnPctDrillDetalhe(96000, 1200000);
    expect(d.total).toBeUndefined();
    expect(d.linhas).toEqual([
      { componente: "Churn R$", valor: 96000 },
      { componente: "MRR base (início do mês)", valor: 1200000 },
    ]);
    expect(d.formula).toMatch(/Churn % = Churn R\$/);
    expect(d.subtitulo).toBe("8.0%");
  });

  it("mrrBase 0 → subtitulo indefinido (evita divisão por zero/Infinity)", () => {
    const d = montarChurnPctDrillDetalhe(1000, 0);
    expect(d.subtitulo).toBeUndefined();
  });
});

describe("converterDetalheGestaoReceita", () => {
  it("converte grupos (titulo/total) em linhas + colunas padrão (Grupo/Valor)", () => {
    const d = converterDetalheGestaoReceita({
      titulo: "Venda de MRR · 2026-06",
      subtitulo: "R$ 100.000",
      total: 100000,
      grupos: [
        { titulo: "Fulano", total: 60000 },
        { titulo: "Beltrano", total: 40000 },
      ],
    });
    expect(d.colunas).toEqual([
      { chave: "titulo", label: "Grupo", tipo: "text" },
      { chave: "total", label: "Valor", tipo: "brl" },
    ]);
    expect(d.linhas).toEqual([
      { titulo: "Fulano", total: 60000 },
      { titulo: "Beltrano", total: 40000 },
    ]);
    expect(d.total).toBe(100000);
    expect(d.titulo).toBe("Venda de MRR · 2026-06");
  });
});

describe("montarDetalheScorecard — dispatcher", () => {
  it("tipo desconhecido devolve null (rota responde 400)", async () => {
    const resultado = await montarDetalheScorecard({ tipo: "tipo_inexistente", mes: "2026-06" });
    expect(resultado).toBeNull();
  });
});

// server/routes/scorecard.detalhe.composicoes.test.ts
// Testes dos builders PUROS (sem banco) das composições do Capacity (Fase 2C-i). Os wrappers
// async que fazem I/O (montarReceitaCabecaDetalhe/montarGeracaoLiquidaDetalhe/
// montarConversaoCaixaDetalhe) foram validados por reconciliação via psql/tsx contra os dados
// reais de 2026-06 (ver task-audit-fase2ci-report.md), mesmo padrão de validação da Fase 2A.
import { describe, it, expect } from "vitest";
import {
  montarReceitaCabecaDrillDetalhe,
  montarGeracaoLiquidaDrillDetalhe,
  montarConversaoCaixaDrillDetalhe,
} from "./scorecard.detalhe.composicoes";

describe("montarReceitaCabecaDrillDetalhe", () => {
  it("monta os 4 componentes (MRR + entregas + pessoas + razão), sem `total`", () => {
    const d = montarReceitaCabecaDrillDetalhe("squad", "Growth", 100000, 20000, 6);
    expect(d.total).toBeUndefined();
    expect(d.linhas).toEqual([
      { componente: "MRR ativo (Growth)", valor: 100000 },
      { componente: "Entregas deploy (Growth)", valor: 20000 },
      { componente: "Nº de pessoas", valor: 6, valorTipo: "int" },
      { componente: "= Receita por cabeça", valor: 20000 },
    ]);
    expect(d.formula).toMatch(/Receita\/Cabeça =/);
    expect(d.titulo).toBe("Receita por Cabeça — Squad: Growth");
    expect(d.subtitulo).toBe("R$ 20.000");
  });

  it("operador usa o label 'Operador' no título", () => {
    const d = montarReceitaCabecaDrillDetalhe("operador", "Fulano", 30000, 0, 1);
    expect(d.titulo).toBe("Receita por Cabeça — Operador: Fulano");
  });

  it("pessoas null (headcount não resolvido) → 'Nº de pessoas' e a razão final ficam null, sem dividir por zero", () => {
    const d = montarReceitaCabecaDrillDetalhe("squad", "Sem Par RH", 50000, 0, null);
    expect(d.linhas[2]).toEqual({ componente: "Nº de pessoas", valor: null, valorTipo: "int" });
    expect(d.linhas[3]).toEqual({ componente: "= Receita por cabeça", valor: null });
    expect(d.subtitulo).toBeUndefined();
  });
});

describe("montarGeracaoLiquidaDrillDetalhe", () => {
  it("monta receita/despesa/geração, sem `total` — despesa aparece POSITIVA (sinal só no rótulo)", () => {
    const d = montarGeracaoLiquidaDrillDetalhe(500000, 300000);
    expect(d.total).toBeUndefined();
    expect(d.linhas).toEqual([
      { componente: "Receita (caixa)", valor: 500000 },
      { componente: "(−) Despesas (DFC)", valor: 300000 },
      { componente: "= Geração de caixa", valor: 200000 },
    ]);
    expect(d.subtitulo).toBe("R$ 200.000");
  });
});

describe("montarConversaoCaixaDrillDetalhe", () => {
  it("monta geração/receita/conversão com tipos por-linha (brl/brl/pct)", () => {
    const d = montarConversaoCaixaDrillDetalhe(500000, 300000);
    expect(d.linhas).toEqual([
      { componente: "Geração de caixa", valor: 200000, valorTipo: "brl" },
      { componente: "Receita (caixa)", valor: 500000, valorTipo: "brl" },
      { componente: "= Conversão", valor: 40, valorTipo: "pct" },
    ]);
    expect(d.subtitulo).toBe("40.0%");
  });

  it("receita <= 0 → conversão null (guarda divisão por zero/Infinity)", () => {
    const d = montarConversaoCaixaDrillDetalhe(0, 100);
    expect(d.linhas[2].valor).toBeNull();
    expect(d.subtitulo).toBeUndefined();
  });
});

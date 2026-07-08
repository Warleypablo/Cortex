// client/src/pages/painel-executivo/DrillSheet.test.tsx
// Cobre o fix de auditabilidade (2026-07): o rodapé do DrillSheet precisa reconciliar com o
// `total` do card headline que abriu o drill, mesmo quando a tabela tem MAIS DE UMA coluna
// monetária (ex: cross_sell, cliente_contratos — MRR + Pontual) — antes repetia o mesmo `total`
// combinado embaixo de cada coluna "brl", o que estava errado. Também cobre `totalTipo` (ex:
// `contratos_ativos`: `total` é uma CONTAGEM, não uma soma monetária).
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrillSheet } from "./DrillSheet";
import type { DrillColuna } from "./tipos";

// Radix Dialog/Sheet mede o viewport (matchMedia) — não polyfillado globalmente (só
// ResizeObserver, usado pelo Recharts). Stub mínimo só para este teste.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const COLUNAS_1_BRL: DrillColuna[] = [
  { chave: "categoria", label: "Categoria", tipo: "text" },
  { chave: "valor", label: "Valor", tipo: "brl" },
];

const COLUNAS_2_BRL: DrillColuna[] = [
  { chave: "cliente", label: "Cliente", tipo: "text" },
  { chave: "valor_recorrente", label: "MRR", tipo: "brl" },
  { chave: "valor_pontual", label: "Pontual", tipo: "brl" },
];

describe("DrillSheet — rodapé de total", () => {
  it("1 única coluna brl: mostra o `total` bruto do card diretamente (comportamento pré-existente)", () => {
    render(
      <DrillSheet
        open
        onClose={() => {}}
        titulo="Contribuição"
        colunas={COLUNAS_1_BRL}
        linhas={[
          { categoria: "Receita: X", valor: 10000 },
          { categoria: "Despesa: Y", valor: -6000 },
        ]}
        total={4000}
      />,
    );
    // Rodapé mostra o `total` (4000), não a soma ingênua das linhas (10000 + -6000 = 4000 aqui
    // coincide — usar um caso onde divergiriam deixaria o teste mais claro, ver teste abaixo).
    expect(screen.getByText("R$ 4.000")).toBeTruthy();
  });

  it("MAIS de 1 coluna brl (ex: cross_sell): soma CADA coluna a partir de `linhas`, não repete o `total` combinado (bug corrigido)", () => {
    render(
      <DrillSheet
        open
        onClose={() => {}}
        titulo="Cross-sell"
        colunas={COLUNAS_2_BRL}
        linhas={[
          { cliente: "A", valor_recorrente: 30000, valor_pontual: 1000 },
          { cliente: "B", valor_recorrente: 6000, valor_pontual: 4000 },
        ]}
        total={41000} // MRR (36000) + Pontual (5000) combinados — como cross_sell/cliente_contratos
      />,
    );
    // ANTES do fix: as duas colunas mostrariam "R$ 41.000" (o `total` combinado repetido embaixo
    // de MRR E de Pontual) — errado, pois nem MRR (Σ=36.000) nem Pontual (Σ=5.000) somam 41.000
    // individualmente. DEPOIS do fix: cada coluna soma só as suas próprias linhas.
    expect(screen.getByText("R$ 36.000")).toBeTruthy(); // Σ valor_recorrente (30000+6000)
    expect(screen.getByText("R$ 5.000")).toBeTruthy(); // Σ valor_pontual (1000+4000)
    expect(screen.queryByText("R$ 41.000")).toBeNull();
  });

  it("`totalTipo` != 'brl' (ex: contratos_ativos, `total` = contagem): rodapé mostra 'Total: N' na 1ª coluna e AINDA soma as colunas brl individualmente", () => {
    const colunas: DrillColuna[] = [
      { chave: "cliente", label: "Cliente", tipo: "text" },
      { chave: "mrr", label: "MRR", tipo: "brl" },
      { chave: "ltv", label: "LTV", tipo: "brl" },
    ];
    render(
      <DrillSheet
        open
        onClose={() => {}}
        titulo="Contratos Ativos"
        colunas={colunas}
        linhas={[
          { cliente: "A", mrr: 1000, ltv: 12000 },
          { cliente: "B", mrr: 2000, ltv: 24000 },
        ]}
        total={2} // contagem de contratos — NÃO uma soma de mrr/ltv
        totalTipo="int"
      />,
    );
    expect(screen.getByText("Total: 2")).toBeTruthy();
    expect(screen.getByText("R$ 3.000")).toBeTruthy(); // Σ mrr
    expect(screen.getByText("R$ 36.000")).toBeTruthy(); // Σ ltv
    // A contagem (2) nunca deve ser formatada como moeda.
    expect(screen.queryByText("R$ 2")).toBeNull();
  });

  it("`total` omitido (ex: composições como churn_pct): não renderiza rodapé", () => {
    render(
      <DrillSheet
        open
        onClose={() => {}}
        titulo="Churn %"
        colunas={COLUNAS_1_BRL}
        linhas={[{ categoria: "Churn R$", valor: 1000 }]}
      />,
    );
    expect(screen.queryByText("Total")).toBeNull();
  });
});

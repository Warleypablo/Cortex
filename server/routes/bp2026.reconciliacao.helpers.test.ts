// server/routes/bp2026.reconciliacao.helpers.test.ts
import { describe, it, expect } from "vitest";
import { computeReconciliacao, type SnapRow } from "./bp2026.reconciliacao.helpers";

const row = (id: string, status: string, linha: string, valorr: number, servico = id): SnapRow =>
  ({ id_subtask: id, cliente: `cliente-${id}`, servico, status, linha, valorr });

describe("computeReconciliacao", () => {
  // prev (jan) pool performance = A100 B50 C30 D20 E10 = 210
  const prev: SnapRow[] = [
    row("A", "ativo", "performance", 100),
    row("B", "ativo", "performance", 50),
    row("C", "ativo", "performance", 30),
    row("D", "ativo", "performance", 20),
    row("E", "ativo", "performance", 10),
    row("F", "pausado", "performance", 70), // fora do pool (pausado) -> reativa em cur
    row("G", "ativo", "creators", 200),     // outro produto, irrelevante
  ];
  // cur (fev) pool performance = A120 B40 F70 H80 = 310
  const cur: SnapRow[] = [
    row("A", "ativo", "performance", 120),            // expansão +20
    row("B", "ativo", "performance", 40),             // downsell -10
    row("C", "cancelado/inativo", "performance", 30), // churn -30
    row("D", "pausado", "performance", 20),           // pausa -20
    // E ausente -> saída sem rastreio -10
    row("F", "ativo", "performance", 70),             // reativação +70
    row("H", "ativo", "performance", 80),             // venda +80
    row("G", "ativo", "creators", 200),
  ];

  const rec = computeReconciliacao("performance", prev, cur);
  const val = (chave: string) => rec.componentes.find((c) => c.chave === chave)?.valor ?? 0;

  it("calcula MRR início e fim do produto", () => {
    expect(rec.mrrInicio).toBe(210);
    expect(rec.mrrFim).toBe(310);
  });

  it("classifica cada componente do movimento", () => {
    expect(val("vendas")).toBe(80);
    expect(val("expansao")).toBe(20);
    expect(val("reativacao")).toBe(70);
    expect(val("churn_cancel")).toBe(-30);
    expect(val("churn_downsell")).toBe(-10);
    expect(val("pausas")).toBe(-20);
    expect(val("saidas_sem_rastreio")).toBe(-10);
  });

  it("a venda H lista o contrato certo", () => {
    const vendas = rec.componentes.find((c) => c.chave === "vendas")!;
    expect(vendas.n).toBe(1);
    expect(vendas.contratos[0].id_subtask).toBe("H");
    expect(vendas.contratos[0].valorrFim).toBe(80);
  });

  it("reconcilia: mrrInicio + Σ componentes == mrrFim", () => {
    const soma = rec.componentes.reduce((s, c) => s + c.valor, 0);
    expect(rec.mrrInicio + soma).toBe(rec.mrrFim);
    expect(rec.reconcilia).toBe(true);
  });

  it("omite componentes vazios", () => {
    expect(rec.componentes.find((c) => c.chave === "entregue")).toBeUndefined();
    expect(rec.componentes.find((c) => c.chave === "mudanca_produto")).toBeUndefined();
  });
});

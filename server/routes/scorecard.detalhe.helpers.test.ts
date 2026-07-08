// server/routes/scorecard.detalhe.helpers.test.ts
// Testes dos helpers PUROS da Fase 2A (sem banco) — os builders que fazem I/O (montar*Detalhe
// que chamam `db.execute`/`storage`/`getCrosssellDealsDetail`) são validados por reconciliação
// via psql (ver task-audit-fase2a-report.md), não aqui.
import { describe, it, expect } from "vitest";
import {
  DIM_COLUNA_MRR_ATIVO,
  DIM_COLUNA_ENTREGUE,
  converterCrossSellDetalhe,
  montarUpsellDownsellFromSnaps,
  converterContribuicaoSquadDetalhe,
} from "./scorecard.detalhe.helpers";
import type { SnapRow } from "./bp2026.reconciliacao.helpers";
import type { CrosssellDealsResult } from "../okr2026/metricsAdapter";

describe("DIM_COLUNA_MRR_ATIVO / DIM_COLUNA_ENTREGUE", () => {
  it("mapeia squad/operador do MRR Ativo — operador usa 'responsavel' (mesmo padrão do Churn Pontual)", () => {
    expect(DIM_COLUNA_MRR_ATIVO).toEqual({ squad: "squad", operador: "responsavel" });
  });

  it("mapeia produto/operador/squad do Entregue", () => {
    expect(DIM_COLUNA_ENTREGUE).toEqual({ produto: "produto", operador: "responsavel", squad: "squad" });
  });
});

describe("converterCrossSellDetalhe", () => {
  const data: CrosssellDealsResult = {
    items: [
      { id: "1", cliente: "Cliente A", closer: "Fulano", recorrente: 5000, pontual: 0, data_fechamento: "2026-06-10" },
      { id: "2", cliente: "Cliente B", closer: "Beltrano", recorrente: 0, pontual: 3000, data_fechamento: "2026-06-15" },
    ],
    total_recorrente: 5000,
    total_pontual: 3000,
    count: 2,
  };

  it("converte items em linhas com cliente/deal/closer/valor_recorrente/valor_pontual", () => {
    const d = converterCrossSellDetalhe(data, "2026-06");
    expect(d.linhas).toEqual([
      { cliente: "Cliente A", deal: "1", closer: "Fulano", valor_recorrente: 5000, valor_pontual: 0 },
      { cliente: "Cliente B", deal: "2", closer: "Beltrano", valor_recorrente: 0, valor_pontual: 3000 },
    ]);
  });

  it("total = recorrente + pontual combinados", () => {
    const d = converterCrossSellDetalhe(data, "2026-06");
    expect(d.total).toBe(8000);
  });

  it("sem deals → linhas vazias, total 0", () => {
    const d = converterCrossSellDetalhe({ items: [], total_recorrente: 0, total_pontual: 0, count: 0 }, "2026-06");
    expect(d.linhas).toEqual([]);
    expect(d.total).toBe(0);
  });
});

describe("montarUpsellDownsellFromSnaps", () => {
  const row = (id: string, status: string, linha: string, valorr: number, servico = id): SnapRow => ({
    id_subtask: id,
    cliente: `cliente-${id}`,
    servico,
    status,
    linha,
    valorr,
  });

  // Mesma fixture (adaptada) de bp2026.reconciliacao.helpers.test.ts: A expande (+20), B reduz
  // (-10) em performance; C expande (+50) em creators — cobre agregação MULTI-produto, que é a
  // única coisa nova aqui (computeReconciliacao em si já é testada naquele arquivo).
  const prev: SnapRow[] = [
    row("A", "ativo", "performance", 100),
    row("B", "ativo", "performance", 50),
    row("C", "ativo", "creators", 200),
  ];
  const cur: SnapRow[] = [
    row("A", "ativo", "performance", 120), // expansão +20
    row("B", "ativo", "performance", 40), // downsell -10
    row("C", "ativo", "creators", 250), // expansão +50
  ];

  it("upsell (expansao) agrega across produtos, maior delta primeiro", () => {
    const d = montarUpsellDownsellFromSnaps(prev, cur, "expansao", "2026-06");
    expect(d.linhas).toEqual([
      { cliente: "cliente-C", contrato: "C", produto: "creators", delta: 50 },
      { cliente: "cliente-A", contrato: "A", produto: "performance", delta: 20 },
    ]);
    expect(d.total).toBe(70);
    expect(d.titulo).toMatch(/Upsell/);
  });

  it("downsell (churn_downsell) só traz B, delta negativo", () => {
    const d = montarUpsellDownsellFromSnaps(prev, cur, "churn_downsell", "2026-06");
    expect(d.linhas).toEqual([{ cliente: "cliente-B", contrato: "B", produto: "performance", delta: -10 }]);
    expect(d.total).toBe(-10);
    expect(d.titulo).toMatch(/Downsell/);
  });

  it("sem snapshots (prev/cur vazios) → linhas vazias, total 0", () => {
    const d = montarUpsellDownsellFromSnaps([], [], "expansao", "2026-06");
    expect(d.linhas).toEqual([]);
    expect(d.total).toBe(0);
  });
});

describe("converterContribuicaoSquadDetalhe", () => {
  const data = {
    squads: ["Selva"],
    receitas: [
      { categoriaId: "REC1", categoriaNome: "Receita Commerce", valor: 10000, nivel: 1 },
      { categoriaId: "REC1.cliente", categoriaNome: "Cliente X", valor: 10000, nivel: 2 }, // ignorado (nível 2)
    ],
    despesas: [
      { categoriaId: "DESP.SALARIOS", categoriaNome: "Salarios", valor: 6000, nivel: 1 },
      { categoriaId: "DESP.SALARIOS.1", categoriaNome: "Fulano", valor: 6000, nivel: 2 }, // ignorado (nível 2)
    ],
    totais: { receitaTotal: 10000, despesaTotal: 6000, resultado: 4000, quantidadeParcelas: 3, quantidadeContratos: 1 },
  };

  it("lista categorias de receita (+) e despesa (-) de nível 1 apenas", () => {
    const d = converterContribuicaoSquadDetalhe(data, "Selva", "2026-06");
    expect(d.linhas).toEqual([
      { categoria: "Receita: Receita Commerce", valor: 10000 },
      { categoria: "Despesa: Salarios", valor: -6000 },
    ]);
  });

  it("total = totais.resultado (reconcilia com a soma das linhas por construção)", () => {
    const d = converterContribuicaoSquadDetalhe(data, "Selva", "2026-06");
    const somaLinhas = d.linhas.reduce((acc, l: any) => acc + l.valor, 0);
    expect(d.total).toBe(4000);
    expect(somaLinhas).toBe(d.total);
  });

  it("titulo inclui o nome do squad", () => {
    const d = converterContribuicaoSquadDetalhe(data, "Selva", "2026-06");
    expect(d.titulo).toBe("Contribuição — Squad: Selva");
  });
});

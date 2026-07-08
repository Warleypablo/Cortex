// server/routes/scorecard.detalhe.ltltv.test.ts
// Testes dos builders PUROS da Fase 2C-ii (sem banco) — os wrappers async que fazem I/O
// (montarLtvMedioDetalhe/montarLtMedioDetalhe/montarMedianaLtvDetalhe/montarMedianaLtDetalhe/
// montarLeadTimeDetalhe/montarClienteContratosDetalhe) foram validados por reconciliação via
// psql contra os dados reais de 2026-06 (ver task-audit-fase2cii-report.md), mesmo padrão de
// validação das Fases 2A/2C-i.
import { describe, it, expect } from "vitest";
import {
  calcularMedianaComIndices,
  montarLtvMedioDrillDetalhe,
  montarLtMedioDrillDetalhe,
  montarMedianaLtvDrillDetalhe,
  montarMedianaLtDrillDetalhe,
  montarLeadTimeDrillDetalhe,
  montarClienteContratosDrillDetalhe,
  type ClienteLtLtvRow,
  type LeadTimeEntregaRow,
  type ContratoClienteRow,
} from "./scorecard.detalhe.ltltv";

describe("calcularMedianaComIndices", () => {
  it("n ímpar: mediana = elemento do meio, 1 índice marcado", () => {
    const r = calcularMedianaComIndices([10, 5, 20]); // ordenado: 5,10,20 → meio = 10 (índice 0 no array original)
    expect(r.mediana).toBe(10);
    expect(r.indices).toEqual([0]);
  });

  it("n par: mediana = média dos 2 do meio, 2 índices marcados", () => {
    const r = calcularMedianaComIndices([10, 20, 30, 40]); // ordenado: 10,20,30,40 → meio (20+30)/2=25
    expect(r.mediana).toBe(25);
    expect(r.indices.sort()).toEqual([1, 2]);
  });

  it("lista vazia → mediana 0, sem índices", () => {
    expect(calcularMedianaComIndices([])).toEqual({ mediana: 0, indices: [] });
  });
});

describe("montarLtvMedioDrillDetalhe", () => {
  const clientes: ClienteLtLtvRow[] = [
    { idTask: "1", nomeCliente: "Cliente A", produtos: "Performance", ltvTotal: 30000, ltMeses: 10 },
    { idTask: "2", nomeCliente: "Cliente B", produtos: "Creators", ltvTotal: 10000, ltMeses: 5 },
  ];

  it("monta a lista + formula com a média, sem `total`", () => {
    const d = montarLtvMedioDrillDetalhe(clientes, "ativo");
    expect(d.total).toBeUndefined();
    expect(d.formula).toBe("Média de 2 clientes = R$ 20.000");
    expect(d.linhas).toEqual([
      { cliente: "Cliente A", produtos: "Performance", ltvTotal: 30000 },
      { cliente: "Cliente B", produtos: "Creators", ltvTotal: 10000 },
    ]);
    expect(d.titulo).toBe("LTV Médio por Cliente — ativos");
  });

  it("status cancelado troca o rótulo do título", () => {
    const d = montarLtvMedioDrillDetalhe(clientes, "cancelado");
    expect(d.titulo).toBe("LTV Médio por Cliente — cancelados");
  });

  it("lista vazia → média 0, sem dividir por zero", () => {
    const d = montarLtvMedioDrillDetalhe([], "ativo");
    expect(d.formula).toBe("Média de 0 clientes = R$ 0");
  });
});

describe("montarLtMedioDrillDetalhe", () => {
  const clientes: ClienteLtLtvRow[] = [
    { idTask: "1", nomeCliente: "Cliente A", produtos: "Performance", ltvTotal: 30000, ltMeses: 10 },
    { idTask: "2", nomeCliente: "Cliente B", produtos: "Creators", ltvTotal: 10000, ltMeses: null },
    { idTask: "3", nomeCliente: "Cliente C", produtos: "Social Media", ltvTotal: 5000, ltMeses: 20 },
  ];

  it("filtra clientes sem LT definido e ordena desc por LT", () => {
    const d = montarLtMedioDrillDetalhe(clientes, "ativo");
    expect(d.linhas).toEqual([
      { cliente: "Cliente C", produtos: "Social Media", ltMeses: 20 },
      { cliente: "Cliente A", produtos: "Performance", ltMeses: 10 },
    ]);
    expect(d.formula).toBe("Média de 2 clientes = 15.0 meses");
    expect(d.subtitulo).toMatch(/com LT definido/);
  });
});

describe("montarMedianaLtvDrillDetalhe", () => {
  const clientes: ClienteLtLtvRow[] = [
    { idTask: "1", nomeCliente: "A", produtos: "P1", ltvTotal: 10000, ltMeses: 1 },
    { idTask: "2", nomeCliente: "B", produtos: "P2", ltvTotal: 30000, ltMeses: 2 },
    { idTask: "3", nomeCliente: "C", produtos: "P3", ltvTotal: 20000, ltMeses: 3 },
  ];

  it("marca a linha da posição mediana (n ímpar) com '◄ mediana'", () => {
    const d = montarMedianaLtvDrillDetalhe(clientes, "ativo");
    // ordenado desc por ltvTotal: B(30000), C(20000), A(10000) → mediana = 20000 = C
    expect(d.linhas).toEqual([
      { cliente: "B", produtos: "P2", ltvTotal: 30000, posicao: "" },
      { cliente: "C", produtos: "P3", ltvTotal: 20000, posicao: "◄ mediana" },
      { cliente: "A", produtos: "P1", ltvTotal: 10000, posicao: "" },
    ]);
    expect(d.formula).toBe("Mediana de 3 clientes = R$ 20.000");
    expect(d.total).toBeUndefined();
  });
});

describe("montarMedianaLtDrillDetalhe", () => {
  const clientes: ClienteLtLtvRow[] = [
    { idTask: "1", nomeCliente: "A", produtos: "P1", ltvTotal: 1000, ltMeses: 4 },
    { idTask: "2", nomeCliente: "B", produtos: "P2", ltvTotal: 2000, ltMeses: 8 },
    { idTask: "3", nomeCliente: "C", produtos: "P3", ltvTotal: 3000, ltMeses: null },
  ];

  it("filtra sem LT e marca a mediana (n par → 2 índices, mediana = média)", () => {
    const d = montarMedianaLtDrillDetalhe(clientes, "ativo");
    expect(d.linhas).toEqual([
      { cliente: "B", produtos: "P2", ltMeses: 8, posicao: "◄ mediana" },
      { cliente: "A", produtos: "P1", ltMeses: 4, posicao: "◄ mediana" },
    ]);
    expect(d.formula).toBe("Mediana de 2 clientes = 6.0 meses");
  });
});

describe("montarLeadTimeDrillDetalhe", () => {
  const entregas: LeadTimeEntregaRow[] = [
    { cliente: "Cliente A", produto: "Creators", dataCriado: "2026-01-01", dataEntrega: "2026-06-01", dias: 151 },
    { cliente: "Cliente B", produto: "Creators", dataCriado: "2026-05-01", dataEntrega: "2026-06-11", dias: 41 },
  ];

  it("monta a lista + formula com mediana de dias, sem `total`", () => {
    const d = montarLeadTimeDrillDetalhe(entregas, "2026-06", "Creators");
    expect(d.total).toBeUndefined();
    expect(d.formula).toBe("Lead time mediano = 96.0 dias (2 entregas)");
    expect(d.titulo).toBe("Lead Time de Entrega — Produto: Creators");
    // n par (2 entregas) → ambas ficam na posição mediana
    expect(d.linhas).toEqual(entregas.map((e) => ({ ...e, posicao: "◄ mediana" })));
  });

  it("sem produtoFiltro usa título genérico", () => {
    const d = montarLeadTimeDrillDetalhe(entregas, "2026-06");
    expect(d.titulo).toBe("Lead Time de Entrega — Todos os produtos");
  });
});

describe("montarClienteContratosDrillDetalhe", () => {
  const contratos: ContratoClienteRow[] = [
    { produto: "Performance", servico: "Gestão de performance", status: "ativo", valorr: 16250, valorp: 0 },
    { produto: "Creators", servico: "Creators Recorrente", status: "ativo", valorr: 8750, valorp: 0 },
    { produto: "Social Media", servico: "Social Media", status: "cancelado/inativo", valorr: 0, valorp: 0 },
  ];

  it("total = Σ MRR + Σ Pontual combinados (lista SOMÁVEL, ao contrário dos demais tipos deste arquivo)", () => {
    const d = montarClienteContratosDrillDetalhe(contratos, "86acg54ad", "Phooto");
    expect(d.total).toBe(25000);
    expect(d.titulo).toBe("Contratos — Phooto");
    expect(d.linhas).toEqual(contratos);
  });

  it("sem nomeCliente resolvido usa o identificador (idTask/nome) no título", () => {
    const d = montarClienteContratosDrillDetalhe([], "86acg54ad", null);
    expect(d.titulo).toBe("Contratos — 86acg54ad");
    expect(d.total).toBe(0);
  });
});

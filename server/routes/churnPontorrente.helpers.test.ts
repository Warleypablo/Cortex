import { describe, it, expect } from "vitest";
import {
  extractNivelEntrega, classifySituacao,
  toJornadas, applyFiltros, type RawRow,
  buildFunil, buildOverview,
  aggregateChurnPorDimensao, buildDetalhamento, buildPayload,
} from "./churnPontorrente.helpers";

describe("extractNivelEntrega", () => {
  it("pega 'Entrega N' (número depois)", () => {
    expect(extractNivelEntrega("Entrega 1 - Performance - Starter")).toBe(1);
    expect(extractNivelEntrega("Entrega 3- Social Media Ponto-rrente Starter")).toBe(3);
  });
  it("pega '(Entrega 0N)' com zero à esquerda", () => {
    expect(extractNivelEntrega("Creators (Entrega 01) - Starter")).toBe(1);
  });
  it("pega 'Nª Entrega' (ordinal antes)", () => {
    expect(extractNivelEntrega("1ª Entrega - Creators")).toBe(1);
    expect(extractNivelEntrega("4ª Entrega - Creators - Scale")).toBe(4);
  });
  it("ignora falso-positivo sem número adjacente a 'entrega'", () => {
    expect(extractNivelEntrega("Entrega de 3 rótulos para a embalagem")).toBeNull();
  });
  it("retorna null para vazio/sem entrega", () => {
    expect(extractNivelEntrega("")).toBeNull();
    expect(extractNivelEntrega(null)).toBeNull();
    expect(extractNivelEntrega("Creators Recorrente")).toBeNull();
  });
});

describe("classifySituacao", () => {
  it("entregue", () => expect(classifySituacao("entregue")).toBe("entregue"));
  it("churn p/ cancelado e não usar", () => {
    expect(classifySituacao("cancelado/inativo")).toBe("churn");
    expect(classifySituacao("não usar")).toBe("churn");
  });
  it("em_andamento p/ os demais", () => {
    for (const s of ["triagem", "ativo", "onboarding", "pausado", "", null]) {
      expect(classifySituacao(s as any)).toBe("em_andamento");
    }
  });
});

function row(p: Partial<RawRow>): RawRow {
  return {
    idTask: "A", produto: "Creators", servico: "Entrega 1 - Creators", status: "entregue",
    valorp: 100, squad: "Olimpo", responsavel: "Mariana", csResponsavel: "CS1",
    vendedor: "V1", motivoCancelamento: null, dataInicio: "2025-06-25",
    dataEncerramento: null, nomeCliente: "Cliente A", ...p,
  };
}

describe("toJornadas (base vendido)", () => {
  const rows: RawRow[] = [
    row({ idTask: "A", servico: "Entrega 1 - Creators", status: "entregue" }),
    row({ idTask: "A", servico: "Entrega 4 - Creators", status: "cancelado/inativo", valorp: 1000, motivoCancelamento: "Inadimplente" }),
    row({ idTask: "B", servico: "Entrega 2 - Creators", status: "ativo", valorp: 500 }),
    row({ idTask: "B", servico: "Entrega 1 - Creators", status: "entregue", valorp: 50 }),
    row({ idTask: "Z", servico: "Entrega de 3 rótulos", status: "entregue" }), // sem nível → fora
  ];
  it("agrupa por (idTask, produto) e pega o estágio de maior nível", () => {
    const js = toJornadas(rows, "vendido");
    const a = js.find((j) => j.idTask === "A")!;
    expect(a.nivelMax).toBe(4);
    expect(a.situacaoFinal).toBe("churn");
    expect(a.valorp).toBe(1000);
    expect(a.motivoCancelamento).toBe("Inadimplente");
    const b = js.find((j) => j.idTask === "B")!;
    expect(b.nivelMax).toBe(2);
    expect(b.situacaoFinal).toBe("em_andamento");
  });
  it("descarta linhas sem nível extraível", () => {
    expect(toJornadas(rows, "vendido").some((j) => j.idTask === "Z")).toBe(false);
  });
  it("capa o nível máximo em 4 (5ª entrega é exceção)", () => {
    const rows5: RawRow[] = [
      row({ idTask: "F", servico: "Entrega 4 - Creators", status: "entregue", valorp: 50 }),
      row({ idTask: "F", servico: "Entrega 5 - Creators", status: "ativo", valorp: 100 }),
    ];
    const j = toJornadas(rows5, "vendido")[0];
    expect(j.nivelMax).toBe(4);
    expect(j.situacaoFinal).toBe("em_andamento"); // status do estágio mais alto (5ª, ativo)
  });
  it("exclui produtos fora de Creators/Performance/Social Media", () => {
    const noisy: RawRow[] = [
      row({ idTask: "EM", produto: "Broadcast", servico: "Email Marketing - 2 Entrega", status: "entregue" }),
      row({ idTask: "GP", produto: "Gameplan", servico: "Entrega 1 - Performance - Starter", status: "cancelado/inativo" }),
      row({ idTask: "OK", produto: "Social Media", servico: "Entrega 1 - Social Media", status: "entregue" }),
    ];
    expect(toJornadas(noisy, "vendido").map((j) => j.produto)).toEqual(["Social Media"]);
  });
});

describe("toJornadas (base entregue)", () => {
  const rows: RawRow[] = [
    row({ idTask: "A", servico: "Entrega 1 - Creators", status: "entregue" }),
    row({ idTask: "A", servico: "Entrega 4 - Creators", status: "cancelado/inativo", valorp: 1000 }),
    row({ idTask: "C", servico: "Entrega 1 - Performance", produto: "Performance", status: "cancelado/inativo" }),
  ];
  it("considera só estágios entregues", () => {
    const js = toJornadas(rows, "entregue");
    const a = js.find((j) => j.idTask === "A")!;
    expect(a.nivelMax).toBe(1);            // entrega 4 cancelada é ignorada
    expect(a.situacaoFinal).toBe("entregue");
    expect(js.some((j) => j.idTask === "C")).toBe(false); // C não tem nada entregue
  });
});

describe("applyFiltros", () => {
  const rows: RawRow[] = [
    row({ idTask: "A", produto: "Creators", squad: "Olimpo", responsavel: "Mariana", dataInicio: "2025-06-25" }),
    row({ idTask: "C", produto: "Performance", squad: "Selva", responsavel: "Larissa", dataInicio: "2026-01-10", servico: "Entrega 1 - Performance" }),
  ];
  const js = toJornadas(rows, "vendido");
  it("filtra por produto", () => {
    expect(applyFiltros(js, { produto: "Performance" }).map((j) => j.idTask)).toEqual(["C"]);
  });
  it("filtra por mês de início (de/ate)", () => {
    expect(applyFiltros(js, { de: "2026-01" }).map((j) => j.idTask)).toEqual(["C"]);
    expect(applyFiltros(js, { ate: "2025-12" }).map((j) => j.idTask)).toEqual(["A"]);
  });
});

const cenario: RawRow[] = [
  row({ idTask: "A", servico: "Entrega 1 - Creators", status: "entregue", valorp: 10 }),
  row({ idTask: "A", servico: "Entrega 2 - Creators", status: "entregue", valorp: 10 }),
  row({ idTask: "A", servico: "Entrega 3 - Creators", status: "entregue", valorp: 10 }),
  row({ idTask: "A", servico: "Entrega 4 - Creators", status: "cancelado/inativo", valorp: 1000, motivoCancelamento: "Inadimplente" }),
  row({ idTask: "B", servico: "Entrega 1 - Creators", status: "entregue", valorp: 50 }),
  row({ idTask: "B", servico: "Entrega 2 - Creators", status: "ativo", valorp: 500 }),
  row({ idTask: "C", produto: "Performance", servico: "Entrega 1 - Performance", status: "cancelado/inativo", valorp: 800, squad: "Selva", responsavel: "Larissa", motivoCancelamento: "Erro na Venda" }),
];

describe("buildFunil", () => {
  const funil = buildFunil(toJornadas(cenario, "vendido"));
  it("calcula sobrevivência por nível", () => {
    expect(funil.map((n) => n.atingiram)).toEqual([3, 2, 1, 1]);
  });
  it("decompõe quem parou em cada degrau", () => {
    expect(funil[0]).toMatchObject({ nivel: 1, pararamAqui: 1, churn: 1, valorpChurn: 800 });
    expect(funil[1]).toMatchObject({ nivel: 2, pararamAqui: 1, emAndamento: 1 });
    expect(funil[3]).toMatchObject({ nivel: 4, pararamAqui: 1, churn: 1, valorpChurn: 1000 });
  });
  it("calcula drop % para o próximo degrau", () => {
    expect(funil[0].dropPct).toBe(33.3); // (3-2)/3
    expect(funil[1].dropPct).toBe(50);   // (2-1)/2
    expect(funil[3].dropPct).toBe(0);    // último
  });
});

describe("buildOverview", () => {
  it("calcula KPIs", () => {
    const ov = buildOverview(toJornadas(cenario, "vendido"));
    expect(ov.jornadas).toBe(3);
    expect(ov.retencaoUltima).toBe(33.3);   // atingiram[4]/atingiram[1] = 1/3
    expect(ov.churnConfirmado).toBe(2);      // A e C
    expect(ov.valorpPerdido).toBe(1800);     // 1000 + 800
  });
  it("base entregue zera o churn (entrega 4 cancelada some)", () => {
    const ov = buildOverview(toJornadas(cenario, "entregue"));
    expect(ov.churnConfirmado).toBe(0);
  });
});

describe("aggregateChurnPorDimensao", () => {
  it("agrega churn por motivo, ordenado por qtd e valor", () => {
    const dim = aggregateChurnPorDimensao(toJornadas(cenario, "vendido"), "motivo");
    expect(dim).toEqual([
      { label: "Inadimplente", qtd: 1, valorp: 1000 },
      { label: "Erro na Venda", qtd: 1, valorp: 800 },
    ]);
  });
  it("rotula vazio como (não informado)", () => {
    const rows: RawRow[] = [row({ idTask: "X", servico: "Entrega 1 - Creators", status: "cancelado/inativo", motivoCancelamento: null })];
    expect(aggregateChurnPorDimensao(toJornadas(rows, "vendido"), "motivo")[0].label).toBe("(não informado)");
  });
});

describe("buildDetalhamento", () => {
  it("lista só jornadas churnadas, ordenadas por valorp desc", () => {
    const det = buildDetalhamento(toJornadas(cenario, "vendido"));
    expect(det.map((d) => d.valorp)).toEqual([1000, 800]);
    expect(det[0]).toMatchObject({ produto: "Creators", nivelCaiu: 4, motivo: "Inadimplente" });
  });
});

describe("buildPayload", () => {
  it("monta payload completo e lista filtros disponíveis", () => {
    const p = buildPayload(cenario, "vendido", {});
    expect(p.overview.jornadas).toBe(3);
    expect(p.funil).toHaveLength(4);
    expect(p.detalhamento).toHaveLength(2);
    expect(p.jornadas).toHaveLength(3);
    expect(p.filtrosDisponiveis.produtos).toEqual(["Creators", "Performance"]);
  });
  it("aplica filtro de produto sem mexer nos filtros disponíveis", () => {
    const p = buildPayload(cenario, "vendido", { produto: "Performance" });
    expect(p.overview.jornadas).toBe(1);
    expect(p.filtrosDisponiveis.produtos).toEqual(["Creators", "Performance"]);
  });
});

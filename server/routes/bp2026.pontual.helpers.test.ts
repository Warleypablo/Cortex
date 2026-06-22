import { describe, it, expect } from "vitest";
import {
  ehEstoquePontual,
  classificarPonte,
  decomporStatus,
  montarLinhasPontual,
} from "./bp2026.pontual.helpers";
import { classificarPonteItens } from "./bp2026.pontual.helpers";

const ant = [
  { idSubtask: "A", valorp: 1000, status: "ativo" },        // permanece (reajuste +100)
  { idSubtask: "B", valorp: 500, status: "triagem" },       // vira entregue
  { idSubtask: "C", valorp: 300, status: "pausado" },       // vira churn
  { idSubtask: "D", valorp: 200, status: "ativo" },         // deletado (some)
  { idSubtask: "E", valorp: 100, status: "entregue" },      // já não era estoque (ignora)
  { idSubtask: "G", valorp: 150, status: "ativo" },         // valorp some (saída atípica)
];
const atual = [
  { idSubtask: "A", valorp: 1100, status: "ativo" },        // reajuste
  { idSubtask: "B", valorp: 500, status: "entregue" },      // entrega
  { idSubtask: "C", valorp: 300, status: "cancelado/inativo" }, // churn
  { idSubtask: "G", valorp: 0, status: "ativo" },           // saída atípica (valorp 0)
  { idSubtask: "F", valorp: 700, status: "triagem" },       // venda nova
];

describe("ehEstoquePontual", () => {
  it("exige valorp>0 e status fora da lista de exclusão", () => {
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 10, status: "ativo" })).toBe(true);
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 10, status: "em cancelamento" })).toBe(true);
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 0, status: "ativo" })).toBe(false);
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 10, status: "entregue" })).toBe(false);
    expect(ehEstoquePontual({ idSubtask: "x", valorp: 10, status: "cancelado/inativo" })).toBe(false);
  });
});

describe("classificarPonte", () => {
  const p = classificarPonte(
    ant.map((r) => ({ ...r, criadoYm: "2026-03" })),
    atual.map((r) => ({ ...r, criadoYm: r.idSubtask === "F" ? "2026-03" : "2026-03" })),
    "2026-03",
  );
  it("classifica cada categoria", () => {
    expect(p.estoqueIni).toBe(2150);
    expect(p.venda).toBe(700);        // F (total)
    expect(p.vendaMes).toBe(700);     // F criado em 2026-03 == ymAlvo
    expect(p.entradaDefasada).toBe(0);
    expect(p.reativacao).toBe(0);
    expect(p.semOrigem).toBe(0);
    expect(p.entrega).toBe(500);
    expect(p.churn).toBe(300);
    expect(p.deletados).toBe(200);
    expect(p.saidaAtipica).toBe(150);
    expect(p.reajuste).toBe(100);
    expect(p.estoqueFim).toBe(1800);
  });
  it("soma das 4 sub-categorias = venda total", () => {
    expect(p.vendaMes + p.entradaDefasada + p.reativacao + p.semOrigem).toBe(p.venda);
  });
  it("a ponte fecha (identidade)", () => {
    expect(
      p.estoqueIni + p.venda - p.entrega - p.churn - p.deletados - p.saidaAtipica + p.reajuste
    ).toBe(p.estoqueFim);
  });
});

describe("classificarPonte — sub-categorias da venda", () => {
  // base anterior: H estava entregue (fora do estoque) -> reativa; demais ausentes
  const anterior = [
    { idSubtask: "H", valorp: 400, status: "entregue", criadoYm: "2025-11" }, // volta -> reativação
  ];
  const agora = [
    { idSubtask: "H", valorp: 400, status: "ativo", criadoYm: "2025-11" },    // reativação (precede data)
    { idSubtask: "M", valorp: 300, status: "ativo", criadoYm: "2026-04" },    // venda do mês
    { idSubtask: "P", valorp: 200, status: "ativo", criadoYm: "2026-02" },    // entrada defasada
    { idSubtask: "S", valorp: 100, status: "ativo", criadoYm: null },         // sem origem
  ];
  const p = classificarPonte(anterior, agora, "2026-04");
  it("separa reativação, venda do mês, defasada e sem origem", () => {
    expect(p.reativacao).toBe(400);
    expect(p.vendaMes).toBe(300);
    expect(p.entradaDefasada).toBe(200);
    expect(p.semOrigem).toBe(100);
    expect(p.venda).toBe(1000);
  });
  it("reativação tem precedência sobre data_criado", () => {
    // H tem criadoYm 2025-11 (defasada) mas estava no snapshot anterior fora do estoque -> reativação
    expect(p.reativacao).toBe(400);
    expect(p.entradaDefasada).toBe(200); // só P, não H
  });
});

describe("decomporStatus", () => {
  it("soma valorp por status, só do estoque, fechando no estoque final", () => {
    const d = decomporStatus(atual);
    expect(d["ativo"]).toBe(1100);
    expect(d["triagem"]).toBe(700);
    expect(d["entregue"]).toBeUndefined();
    expect(d["cancelado/inativo"]).toBeUndefined();
    const soma = Object.values(d).reduce((s, v) => s + v, 0);
    expect(soma).toBe(1800);
  });
});

describe("montarLinhasPontual", () => {
  const porMes = {
    0: ant.map((r) => ({ ...r, criadoYm: "2025-12" })),
    1: atual.map((r) => ({ ...r, criadoYm: r.idSubtask === "F" ? "2026-01" : "2025-12" })),
  };
  const linhas = montarLinhasPontual(porMes, 1, 1);
  const by = (m: string) => linhas.find((l) => l.metrica === m)!;
  it("estoque inicial positivo, fluxos com sinal, estoque final destaque", () => {
    expect(by("pontual_estoque_ini").meses[0].realizado).toBe(2150);
    expect(by("pontual_venda").meses[0].realizado).toBe(700);
    expect(by("pontual_entrega").meses[0].realizado).toBe(-500);
    expect(by("pontual_estoque_fim").meses[0].realizado).toBe(1800);
    expect(by("pontual_estoque_fim").destaque).toBe(true);
  });
  it("emite as sub-linhas da venda logo após (+) Venda", () => {
    expect(by("pontual_venda_mes").meses[0].realizado).toBe(700);    // F criado em 2026-01 == mês 1
    expect(by("pontual_entrada_defasada").meses[0].realizado).toBe(0);
    expect(by("pontual_reativacao").meses[0].realizado).toBe(0);
    expect(by("pontual_venda_mes").titulo).toBe("· Venda do mês");
    const idxVenda = linhas.findIndex((l) => l.metrica === "pontual_venda");
    expect(linhas[idxVenda + 1].metrica).toBe("pontual_venda_mes");
  });
  it("não emite '· Sem origem' quando não há valor", () => {
    expect(linhas.find((l) => l.metrica === "pontual_sem_origem")).toBeUndefined();
  });
  it("decomposição por status soma ao estoque final", () => {
    expect(by("pontual_status_ativo").meses[0].realizado).toBe(1100);
    expect(by("pontual_status_triagem").meses[0].realizado).toBe(700);
  });
  it("todas as linhas são só-realizado (orcado 0, atingimento null, neutro)", () => {
    for (const l of linhas) {
      expect(l.direcao).toBe("neutro");
      expect(l.meses[0].orcado).toBe(0);
      expect(l.meses[0].atingimento).toBeNull();
    }
  });
  it("YTD: inicial=jan(dez), venda somada, final=posição", () => {
    expect(by("pontual_estoque_ini").ytd.realizado).toBe(2150);
    expect(by("pontual_venda").ytd.realizado).toBe(700);
    expect(by("pontual_estoque_fim").ytd.realizado).toBe(1800);
  });
});

describe("classificarPonteItens", () => {
  const antI = [
    { idSubtask: "A", valorp: 1000, status: "ativo", cliente: "Cli A" },
    { idSubtask: "B", valorp: 500, status: "triagem", cliente: "Cli B" },
    { idSubtask: "C", valorp: 300, status: "pausado", cliente: "Cli C" },
    { idSubtask: "D", valorp: 200, status: "ativo", cliente: "Cli D" },
    { idSubtask: "E", valorp: 100, status: "entregue", cliente: "Cli E" },
    { idSubtask: "G", valorp: 150, status: "ativo", cliente: "Cli G" },
  ];
  const atualI = [
    { idSubtask: "A", valorp: 1100, status: "ativo", cliente: "Cli A" },
    { idSubtask: "B", valorp: 500, status: "entregue", cliente: "Cli B" },
    { idSubtask: "C", valorp: 300, status: "cancelado/inativo", cliente: "Cli C" },
    { idSubtask: "G", valorp: 0, status: "ativo", cliente: "Cli G" },
    { idSubtask: "F", valorp: 700, status: "triagem", cliente: "Cli F" },
  ];
  const out = classificarPonteItens(antI, atualI);
  it("lista os contratos de cada categoria", () => {
    expect(out.venda.map((i) => i.idSubtask)).toEqual(["F"]);
    expect(out.entrega.map((i) => i.idSubtask)).toEqual(["B"]);
    expect(out.churn.map((i) => i.idSubtask)).toEqual(["C"]);
    expect(out.deletados.map((i) => i.idSubtask)).toEqual(["D"]);
    expect(out.saida_atipica.map((i) => i.idSubtask)).toEqual(["G"]);
    expect(out.reajuste.map((i) => i.idSubtask)).toEqual(["A"]);
    expect(out.reajuste[0].valor).toBe(100);
    expect(out.venda[0].valor).toBe(700);
    expect(out.entrega[0].valor).toBe(500);
  });
  it("soma dos itens por categoria casa com classificarPonte", () => {
    const sum = (a: { valor: number }[]) => a.reduce((s, i) => s + i.valor, 0);
    expect(sum(out.venda)).toBe(700);
    expect(sum(out.entrega)).toBe(500);
    expect(sum(out.churn)).toBe(300);
    expect(sum(out.deletados)).toBe(200);
    expect(sum(out.saida_atipica)).toBe(150);
    expect(sum(out.reajuste)).toBe(100);
  });
});

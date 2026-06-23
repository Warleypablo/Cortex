import { describe, it, expect } from "vitest";
import {
  ehEstoquePontual,
  classificarPonte,
  decomporStatus,
  decomporSquad,
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
  { idSubtask: "A", valorp: 1100, status: "ativo", squad: "Olimpo" },        // reajuste
  { idSubtask: "B", valorp: 500, status: "entregue", squad: "Olimpo" },      // entrega
  { idSubtask: "C", valorp: 300, status: "cancelado/inativo", squad: "Pulse" }, // churn
  { idSubtask: "G", valorp: 0, status: "ativo", squad: "Pulse" },           // saída atípica (valorp 0)
  { idSubtask: "F", valorp: 700, status: "triagem", squad: "Pulse" },       // venda nova
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
    atual.map((r) => ({ ...r, criadoYm: "2026-03" })),
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

describe("decomporSquad", () => {
  it("soma valorp por squad, só do estoque, fechando no estoque final", () => {
    const d = decomporSquad(atual);
    expect(d["Olimpo"]).toBe(1100); // A
    expect(d["Pulse"]).toBe(700);   // F (C/G não são estoque)
    const soma = Object.values(d).reduce((s, v) => s + v, 0);
    expect(soma).toBe(1800);
  });
  it("squad vazio/ausente vira '(sem squad)'", () => {
    const d = decomporSquad([
      { idSubtask: "X", valorp: 50, status: "ativo" },
      { idSubtask: "Y", valorp: 30, status: "ativo", squad: "  " },
    ]);
    expect(d["(sem squad)"]).toBe(80);
  });
});

describe("montarLinhasPontual", () => {
  const porMes = {
    0: ant.map((r) => ({ ...r, criadoYm: "2025-12" })),
    1: atual.map((r) => ({ ...r, criadoYm: r.idSubtask === "F" ? "2026-01" : "2025-12" })),
  };
  // venda comercial A=900 (valor atual); destes 650 estão no estoque, 250 fora. B (foto) = 700.
  const vendaComercial = { 1: 900 };
  const vendaNoEstoque = { 1: 650 };
  const linhas = montarLinhasPontual(porMes, 1, 1, vendaComercial, vendaNoEstoque);
  const by = (m: string) => linhas.find((l) => l.metrica === m)!;
  const GRUPO_VENDA = "Venda Pontual (comercial)";
  const GRUPO_ESTOQUE = "Movimento do estoque (foto do ClickUp)";
  it("Venda Pontual = A, decomposta em entrou/fora (mesma régua, soma exata)", () => {
    expect(by("pontual_venda_comercial").titulo).toBe("(+) Venda Pontual");
    expect(by("pontual_venda_comercial").meses[0].realizado).toBe(900);
    expect(by("pontual_venda_comercial").grupo).toBe(GRUPO_VENDA);
    expect(by("pontual_venda_no_estoque").meses[0].realizado).toBe(650);
    expect(by("pontual_venda_fora_estoque").meses[0].realizado).toBe(250); // 900 − 650
    // soma das sub = total (auditável, mesma régua de valor)
    expect(by("pontual_venda_no_estoque").meses[0].realizado! + by("pontual_venda_fora_estoque").meses[0].realizado!)
      .toBe(by("pontual_venda_comercial").meses[0].realizado);
  });
  it("não há linha que misture réguas (sem ajuste/venda fora da foto/venda do mês)", () => {
    expect(linhas.find((l) => l.metrica === "pontual_ajuste")).toBeUndefined();
    expect(linhas.find((l) => l.metrica === "pontual_venda_fora_foto")).toBeUndefined();
    expect(linhas.find((l) => l.metrica === "pontual_venda_mes")).toBeUndefined();
    expect(linhas.find((l) => l.metrica === "pontual_entrada_defasada")).toBeUndefined();
  });
  it("movimento de estoque: entrada na foto (B) e ponte fecha (régua snapshot)", () => {
    expect(by("pontual_entrada").titulo).toBe("(+) Entrada na foto");
    expect(by("pontual_entrada").meses[0].realizado).toBe(700); // B (snapshot)
    expect(by("pontual_entrada").grupo).toBe(GRUPO_ESTOQUE);
    const v = (m: string) => by(m).meses[0].realizado ?? 0;
    const total = v("pontual_estoque_ini") + v("pontual_entrada") + v("pontual_entrega")
      + v("pontual_churn") + v("pontual_deletados") + v("pontual_saida_atipica") + v("pontual_reajuste");
    expect(total).toBe(by("pontual_estoque_fim").meses[0].realizado);
  });
  it("estoque inicial/final e sinais", () => {
    expect(by("pontual_estoque_ini").meses[0].realizado).toBe(2150);
    expect(by("pontual_entrega").meses[0].realizado).toBe(-500);
    expect(by("pontual_estoque_fim").meses[0].realizado).toBe(1800);
    expect(by("pontual_estoque_fim").destaque).toBe(true);
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
  it("YTD: inicial=jan(dez), venda=A, final=posição", () => {
    expect(by("pontual_estoque_ini").ytd.realizado).toBe(2150);
    expect(by("pontual_venda_comercial").ytd.realizado).toBe(900);
    expect(by("pontual_estoque_fim").ytd.realizado).toBe(1800);
  });
  it("bloco por squad: linhas no grupo certo, somam o estoque final, ordenadas desc", () => {
    const olimpo = by("pontual_squad:Olimpo");
    const pulse = by("pontual_squad:Pulse");
    expect(olimpo.meses[0].realizado).toBe(1100);
    expect(pulse.meses[0].realizado).toBe(700);
    expect(olimpo.grupo).toBe("Estoque pontual por squad");
    expect(olimpo.tipoAgregacao).toBe("estoque");
    // soma das linhas de squad no mês = estoque final
    const somaSquad = linhas
      .filter((l) => l.metrica.startsWith("pontual_squad:"))
      .reduce((s, l) => s + (l.meses[0].realizado ?? 0), 0);
    expect(somaSquad).toBe(by("pontual_estoque_fim").meses[0].realizado);
    // ordenação desc por valor do mês corrente: Olimpo (1100) antes de Pulse (700)
    const idxOlimpo = linhas.findIndex((l) => l.metrica === "pontual_squad:Olimpo");
    const idxPulse = linhas.findIndex((l) => l.metrica === "pontual_squad:Pulse");
    expect(idxOlimpo).toBeLessThan(idxPulse);
    // YTD = posição (saldo) do mês fechado, não soma
    expect(olimpo.ytd.realizado).toBe(1100);
  });
});

describe("classificarPonteItens", () => {
  const antI = [
    { idSubtask: "A", valorp: 1000, status: "ativo", cliente: "Cli A", criadoYm: "2025-12" },
    { idSubtask: "B", valorp: 500, status: "triagem", cliente: "Cli B", criadoYm: "2025-12" },
    { idSubtask: "C", valorp: 300, status: "pausado", cliente: "Cli C", criadoYm: "2025-12" },
    { idSubtask: "D", valorp: 200, status: "ativo", cliente: "Cli D", criadoYm: "2025-12" },
    { idSubtask: "E", valorp: 100, status: "entregue", cliente: "Cli E", criadoYm: "2025-12" },
    { idSubtask: "G", valorp: 150, status: "ativo", cliente: "Cli G", criadoYm: "2025-12" },
    { idSubtask: "R", valorp: 250, status: "entregue", cliente: "Cli R", criadoYm: "2025-10" }, // reativa
  ];
  const atualI = [
    { idSubtask: "A", valorp: 1100, status: "ativo", cliente: "Cli A", criadoYm: "2025-12" },
    { idSubtask: "B", valorp: 500, status: "entregue", cliente: "Cli B", criadoYm: "2025-12" },
    { idSubtask: "C", valorp: 300, status: "cancelado/inativo", cliente: "Cli C", criadoYm: "2025-12" },
    { idSubtask: "G", valorp: 0, status: "ativo", cliente: "Cli G", criadoYm: "2025-12" },
    { idSubtask: "F", valorp: 700, status: "triagem", cliente: "Cli F", criadoYm: "2026-03" }, // venda do mês
    { idSubtask: "X", valorp: 400, status: "ativo", cliente: "Cli X", criadoYm: "2026-01" },   // defasada
    { idSubtask: "Y", valorp: 120, status: "ativo", cliente: "Cli Y", criadoYm: null },        // sem origem
    { idSubtask: "R", valorp: 250, status: "ativo", cliente: "Cli R", criadoYm: "2025-10" },   // reativação
  ];
  const out = classificarPonteItens(antI, atualI, "2026-03");
  it("lista os contratos de cada sub-categoria da venda", () => {
    expect(out.venda_mes.map((i) => i.idSubtask)).toEqual(["F"]);
    expect(out.entrada_defasada.map((i) => i.idSubtask)).toEqual(["X"]);
    expect(out.sem_origem.map((i) => i.idSubtask)).toEqual(["Y"]);
    expect(out.reativacao.map((i) => i.idSubtask)).toEqual(["R"]);
    expect(out.entrega.map((i) => i.idSubtask)).toEqual(["B"]);
    expect(out.churn.map((i) => i.idSubtask)).toEqual(["C"]);
    expect(out.deletados.map((i) => i.idSubtask)).toEqual(["D"]);
    expect(out.saida_atipica.map((i) => i.idSubtask)).toEqual(["G"]);
    expect(out.reajuste.map((i) => i.idSubtask)).toEqual(["A"]);
  });
  it("soma dos itens por sub-categoria casa com a classificação", () => {
    const sum = (a: { valor: number }[]) => a.reduce((s, i) => s + i.valor, 0);
    expect(sum(out.venda_mes)).toBe(700);
    expect(sum(out.entrada_defasada)).toBe(400);
    expect(sum(out.sem_origem)).toBe(120);
    expect(sum(out.reativacao)).toBe(250);
    expect(sum(out.reajuste)).toBe(100);
  });
});

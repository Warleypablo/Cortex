import { describe, it, expect } from "vitest";
import {
  ehEstoquePontual,
  classificarPonte,
  decomporStatus,
  decomporSquad,
  decomporProduto,
  classificarPontePorProduto,
  normalizarSquad,
  montarLinhasPontual,
} from "./bp2026.pontual.helpers";
import { classificarPonteItens } from "./bp2026.pontual.helpers";

describe("decomporProduto", () => {
  it("soma valorp por produto, só do estoque; vazio → '(sem produto)'", () => {
    const d = decomporProduto([
      { idSubtask: "A", valorp: 1000, status: "ativo", produto: "Creators" },
      { idSubtask: "B", valorp: 500, status: "ativo", produto: "Ecommerce" },
      { idSubtask: "C", valorp: 200, status: "ativo" },              // sem produto
      { idSubtask: "D", valorp: 999, status: "entregue", produto: "Creators" }, // fora do estoque
    ]);
    expect(d["Creators"]).toBe(1000);
    expect(d["Ecommerce"]).toBe(500);
    expect(d["(sem produto)"]).toBe(200);
    expect(Object.values(d).reduce((s, v) => s + v, 0)).toBe(1700);
  });
});

describe("classificarPontePorProduto", () => {
  const ant = [
    { idSubtask: "P", valorp: 400, status: "ativo", produto: "Creators" },   // vira entregue
    { idSubtask: "Q", valorp: 300, status: "ativo", produto: "Ecommerce" },  // permanece
  ];
  const atual = [
    { idSubtask: "P", valorp: 400, status: "entregue", produto: "Creators" }, // entrega
    { idSubtask: "Q", valorp: 300, status: "ativo", produto: "Ecommerce" },   // permanece
    { idSubtask: "R", valorp: 250, status: "ativo", produto: "Creators" },    // entrada
    { idSubtask: "S", valorp: 100, status: "ativo" },                          // entrada (sem produto)
  ];
  it("entrada e entrega por produto batem com classificarPonte (soma)", () => {
    const { entrada, entrega } = classificarPontePorProduto(ant, atual);
    expect(entrada["Creators"]).toBe(250); // R
    expect(entrada["(sem produto)"]).toBe(100); // S
    expect(entrega["Creators"]).toBe(400); // P
    const p = classificarPonte(ant, atual, "2026-04");
    expect(Object.values(entrada).reduce((s, v) => s + v, 0)).toBe(p.venda);
    expect(Object.values(entrega).reduce((s, v) => s + v, 0)).toBe(p.entrega);
  });
});

describe("montarLinhasPontual — expandir por produto", () => {
  const porMes = {
    0: [
      { idSubtask: "e", valorp: 12000, status: "ativo", produto: "Performance", criadoYm: "2025-12" }, // vira entregue
    ] as any[],
    1: [
      { idSubtask: "a", valorp: 50000, status: "ativo", produto: "Creators", criadoYm: "2026-01" },
      { idSubtask: "b", valorp: 30000, status: "ativo", produto: "Ecommerce", criadoYm: "2026-01" },
      { idSubtask: "c", valorp: 4000, status: "ativo", produto: "Site", criadoYm: "2026-01" }, // < 10K → Outros
      { idSubtask: "e", valorp: 12000, status: "entregue", produto: "Performance", criadoYm: "2025-12" }, // entrega
    ],
  };
  const vendaProd = { 1: { Creators: 60000, Ecommerce: 20000, Site: 4000 } };
  const linhas = montarLinhasPontual(porMes, 1, 1, { 1: 84000 }, {}, vendaProd);
  const by = (m: string) => linhas.find((l) => l.metrica === m)!;
  it("marca as 4 linhas-pai como expansíveis", () => {
    for (const pai of ["pontual_venda_comercial", "pontual_entrada", "pontual_entrega", "pontual_estoque_fim"]) {
      expect(by(pai).expansivel).toBe(true);
    }
  });
  it("sub-linhas por produto: paiMetrica, soma = pai, filtro < 10K em '· Outros'", () => {
    // Estoque final por produto: Creators 50K, Ecommerce 30K, Site 4K → Outros
    const subs = linhas.filter((l) => l.paiMetrica === "pontual_estoque_fim");
    expect(subs.find((l) => l.titulo === "· Creators")!.meses[0].realizado).toBe(50000);
    expect(subs.find((l) => l.titulo === "· Ecommerce")!.meses[0].realizado).toBe(30000);
    expect(subs.find((l) => l.titulo === "· Outros (< R$ 10K)")!.meses[0].realizado).toBe(4000);
    const somaSubs = subs.reduce((s, l) => s + (l.meses[0].realizado ?? 0), 0);
    expect(somaSubs).toBe(by("pontual_estoque_fim").meses[0].realizado); // = 84000
    // Venda Pontual por produto vem da query (vendaProd): Creators 60K + Ecommerce 20K + Site 4K = 84K
    const subsVenda = linhas.filter((l) => l.paiMetrica === "pontual_venda_comercial");
    expect(subsVenda.reduce((s, l) => s + (l.meses[0].realizado ?? 0), 0)).toBe(84000);
  });
  it("sub-linha aparece logo após o pai", () => {
    const iPai = linhas.findIndex((l) => l.metrica === "pontual_estoque_fim");
    expect(linhas[iPai + 1].paiMetrica).toBe("pontual_estoque_fim");
  });
  it("linhas de status também são expansíveis por produto e somam o status", () => {
    // todos a/b/c são status 'ativo' (50K Creators + 30K Ecommerce + 4K Site = 84K)
    expect(by("pontual_status_ativo").expansivel).toBe(true);
    const subs = linhas.filter((l) => l.paiMetrica === "pontual_status_ativo");
    const somaSubs = subs.reduce((s, l) => s + (l.meses[0].realizado ?? 0), 0);
    expect(somaSubs).toBe(by("pontual_status_ativo").meses[0].realizado);
    expect(somaSubs).toBe(84000);
    expect(subs.find((l) => l.titulo === "· Creators")!.meses[0].realizado).toBe(50000);
  });
});

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
  it("Aura (qualquer variante) é consolidada em Pulse", () => {
    const d = decomporSquad([
      { idSubtask: "X", valorp: 100, status: "ativo", squad: "💠 Pulse" },
      { idSubtask: "Y", valorp: 40, status: "ativo", squad: "✨ Aura" },
      { idSubtask: "Z", valorp: 20, status: "ativo", squad: "✨ Aura (OFF)" },
    ]);
    expect(d["💠 Pulse"]).toBe(160); // 100 + 40 + 20
    expect(d["✨ Aura"]).toBeUndefined();
  });
});

describe("normalizarSquad", () => {
  it("mapeia Aura -> Pulse e preserva os demais", () => {
    expect(normalizarSquad("✨ Aura")).toBe("💠 Pulse");
    expect(normalizarSquad("✨ Aura (OFF)")).toBe("💠 Pulse");
    expect(normalizarSquad("🏛️ Olimpo")).toBe("🏛️ Olimpo");
    expect(normalizarSquad("")).toBe("(sem squad)");
    expect(normalizarSquad(null)).toBe("(sem squad)");
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
  it("Taxa de churn = churn ÷ estoque inicial (pct positiva), YTD ponderado", () => {
    const tc = by("pontual_taxa_churn");
    expect(tc.titulo).toBe("· Taxa de churn");
    expect(tc.unidade).toBe("pct");
    expect(tc.grupo).toBe(GRUPO_ESTOQUE);
    expect(tc.semDetalhe).toBe(true);
    expect(tc.meses[0].realizado).toBeCloseTo(300 / 2150, 6); // churn/estoqueIni
    expect(tc.ytd.realizado).toBeCloseTo(300 / 2150, 6);       // Σchurn/Σini (1 mês fechado)
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
  it("bloco por squad: squads < 10K no mês corrente agregam em '· Outros', soma = estoque final", () => {
    // Olimpo (1100) e Pulse (700) são < 10K → vão para "· Outros"
    expect(linhas.find((l) => l.metrica === "pontual_squad:Olimpo")).toBeUndefined();
    expect(by("pontual_squad_outros").meses[0].realizado).toBe(1800);
    expect(by("pontual_squad_outros").grupo).toBe("Estoque pontual por squad");
    const somaSquad = linhas
      .filter((l) => l.grupo === "Estoque pontual por squad")
      .reduce((s, l) => s + (l.meses[0].realizado ?? 0), 0);
    expect(somaSquad).toBe(by("pontual_estoque_fim").meses[0].realizado);
  });
});

describe("montarLinhasPontual — filtro < 10K + Aura→Pulse no bloco squad", () => {
  const porMes = {
    0: [] as any[],
    1: [
      { idSubtask: "a", valorp: 50000, status: "ativo", squad: "🏛️ Olimpo", criadoYm: "2026-01" },
      { idSubtask: "b", valorp: 30000, status: "ativo", squad: "💠 Pulse", criadoYm: "2026-01" },
      { idSubtask: "c", valorp: 5000, status: "ativo", squad: "✨ Aura", criadoYm: "2026-01" }, // vira Pulse
      { idSubtask: "d", valorp: 3000, status: "ativo", squad: "🐑 Black", criadoYm: "2026-01" }, // < 10K → Outros
    ],
  };
  const linhas = montarLinhasPontual(porMes, 1, 1);
  const by = (m: string) => linhas.find((l) => l.metrica === m)!;
  it("Aura consolidada em Pulse; squad < 10K em '· Outros'; soma = estoque final; ordenado desc", () => {
    expect(by("pontual_squad:🏛️ Olimpo").meses[0].realizado).toBe(50000);
    expect(by("pontual_squad:💠 Pulse").meses[0].realizado).toBe(35000); // 30K + Aura 5K
    expect(linhas.find((l) => l.metrica === "pontual_squad:✨ Aura")).toBeUndefined();
    expect(by("pontual_squad_outros").meses[0].realizado).toBe(3000); // Black < 10K
    const iOl = linhas.findIndex((l) => l.metrica === "pontual_squad:🏛️ Olimpo");
    const iPu = linhas.findIndex((l) => l.metrica === "pontual_squad:💠 Pulse");
    expect(iOl).toBeLessThan(iPu); // 50K antes de 35K
    const somaSquad = linhas
      .filter((l) => l.grupo === "Estoque pontual por squad")
      .reduce((s, l) => s + (l.meses[0].realizado ?? 0), 0);
    expect(somaSquad).toBe(by("pontual_estoque_fim").meses[0].realizado);
    expect(by("pontual_estoque_fim").meses[0].realizado).toBe(88000);
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

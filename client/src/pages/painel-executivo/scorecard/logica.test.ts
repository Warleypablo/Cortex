import { describe, it, expect } from "vitest";
import {
  calcStatus,
  calcYtd,
  deltaM1,
  formatValor,
  atualDaSerie,
  linhasPorDimensao,
  linhasReceitaCabeca,
  serieOverviewLtLtv,
  serieContribuicaoGeral,
  serieContribuicaoPorSquad,
  pontoContribuicaoNoMes,
  serieGeracaoCaixa,
  pontoGeracaoCaixaNoMes,
  normalizarChaveSquad,
  encontrarSerieSquad,
  ehSquadOff,
  type ContribuicaoSquadBulkFonte,
  type GeracaoCaixaFonte,
} from "./logica";
import type { EvolucaoProdutoTabelaData } from "@/components/lt-ltv-churn/types";

describe("calcStatus", () => {
  it("direction up: atual >= meta → good", () => {
    expect(calcStatus(100, 100, "up")).toBe("good");
  });

  it("direction up: atual < 90% da meta → bad", () => {
    expect(calcStatus(85, 100, "up")).toBe("bad");
  });

  it("direction up: atual entre 90% e 100% da meta → warn", () => {
    expect(calcStatus(95, 100, "up")).toBe("warn");
  });

  it("direction down: atual muito acima da meta (churn) → bad", () => {
    expect(calcStatus(200, 96, "down")).toBe("bad");
  });

  it("direction down: atual <= meta → good", () => {
    expect(calcStatus(80, 96, "down")).toBe("good");
  });

  it("direction down: atual até 110% da meta → warn", () => {
    expect(calcStatus(100, 96, "down")).toBe("warn");
  });

  it("sem meta (null) → null", () => {
    expect(calcStatus(100, null, "up")).toBeNull();
  });

  it("sem meta (undefined) → null", () => {
    expect(calcStatus(100, undefined, "up")).toBeNull();
  });

  it("atual null → null", () => {
    expect(calcStatus(null, 100, "up")).toBeNull();
  });
});

describe("deltaM1", () => {
  it("compara os 2 últimos pontos válidos (alta)", () => {
    expect(deltaM1([{ valor: 100 }, { valor: 110 }])).toEqual({ pct: 10, dir: "up" });
  });

  it("compara os 2 últimos pontos válidos (queda)", () => {
    expect(deltaM1([{ valor: 100 }, { valor: 90 }])).toEqual({ pct: -10, dir: "down" });
  });

  it("variação pequena (<0.05%) → flat", () => {
    const r = deltaM1([{ valor: 1000 }, { valor: 1000.2 }]);
    expect(r?.dir).toBe("flat");
    expect(r?.pct).toBeCloseTo(0.02, 5);
  });

  it("ignora pontos null no fim, usa os 2 últimos válidos", () => {
    expect(deltaM1([{ valor: 100 }, { valor: 120 }, { valor: null }])).toEqual({ pct: 20, dir: "up" });
  });

  it("base 0 → flat (evita divisão por zero)", () => {
    expect(deltaM1([{ valor: 0 }, { valor: 50 }])).toEqual({ pct: 0, dir: "flat" });
  });

  it("menos de 2 pontos válidos → null", () => {
    expect(deltaM1([{ valor: 100 }])).toBeNull();
  });

  it("array vazio → null", () => {
    expect(deltaM1([])).toBeNull();
  });

  it("undefined → null", () => {
    expect(deltaM1(undefined)).toBeNull();
  });
});

describe("formatValor", () => {
  it("brl", () => {
    expect(formatValor(1234, "brl")).toBe("R$ 1.234");
  });

  it("pct", () => {
    expect(formatValor(12.5, "pct")).toBe("12.5%");
  });

  it("int", () => {
    expect(formatValor(1234, "int")).toBe("1.234");
  });

  it("meses", () => {
    expect(formatValor(8.4, "meses")).toBe("8.4 meses");
  });

  it("null → travessão", () => {
    expect(formatValor(null, "brl")).toBe("—");
  });

  it("undefined → travessão", () => {
    expect(formatValor(undefined, "pct")).toBe("—");
  });
});

describe("atualDaSerie", () => {
  it("mês exato presente na série → retorna o ponto exato", () => {
    const serie = [{ month: "2026-05", valor: 100 }, { month: "2026-06", valor: 300 }];
    expect(atualDaSerie(serie, "2026-06")).toBe(300);
  });

  it("mês ausente → usa o último ponto <= mes (defensivo)", () => {
    const serie = [{ month: "2026-04", valor: 10 }, { month: "2026-05", valor: 20 }];
    expect(atualDaSerie(serie, "2026-06")).toBe(20);
  });

  it("mês anterior a todos os pontos → null", () => {
    const serie = [{ month: "2026-05", valor: 20 }];
    expect(atualDaSerie(serie, "2025-12")).toBeNull();
  });

  it("não depende da ordem de entrada (ordena antes de buscar)", () => {
    const serie = [{ month: "2026-06", valor: 300 }, { month: "2026-05", valor: 100 }];
    expect(atualDaSerie(serie, "2026-06")).toBe(300);
  });

  it("ponto com valor null (ex: sem dado no mês) é propagado, não convertido em 0", () => {
    const serie = [{ month: "2026-05", valor: 10 }, { month: "2026-06", valor: null }];
    expect(atualDaSerie(serie, "2026-06")).toBeNull();
  });

  it("série vazia → null", () => {
    expect(atualDaSerie([], "2026-06")).toBeNull();
  });

  it("undefined/null → null", () => {
    expect(atualDaSerie(undefined, "2026-06")).toBeNull();
    expect(atualDaSerie(null, "2026-06")).toBeNull();
  });
});

describe("calcYtd", () => {
  it("fluxo (default 'soma' quando formato != pct): soma todos os pontos da janela", () => {
    const serie = [
      { month: "2026-01", label: "Jan", valor: 100 },
      { month: "2026-02", label: "Fev", valor: 200 },
      { month: "2026-03", label: "Mar", valor: 300 },
    ];
    expect(calcYtd(serie, "2026-03", undefined, "brl")).toBe(600);
  });

  it("estoque (ytdAgg='ultimo'): pega o valor do ponto mais recente da janela, não a soma", () => {
    const serie = [
      { month: "2026-01", label: "Jan", valor: 100 },
      { month: "2026-02", label: "Fev", valor: 200 },
      { month: "2026-03", label: "Mar", valor: 300 },
    ];
    expect(calcYtd(serie, "2026-03", "ultimo", "brl")).toBe(300);
  });

  it("percentual (default 'media' quando formato=pct): média dos pontos, não soma", () => {
    const serie = [
      { month: "2026-01", label: "Jan", valor: 10 },
      { month: "2026-02", label: "Fev", valor: 20 },
      { month: "2026-03", label: "Mar", valor: 30 },
    ];
    expect(calcYtd(serie, "2026-03", undefined, "pct")).toBe(20);
  });

  it("janela corta pontos de 2025 e posteriores ao mês selecionado", () => {
    const serie = [
      { month: "2025-12", label: "Dez/25", valor: 999 },
      { month: "2026-01", label: "Jan", valor: 10 },
      { month: "2026-02", label: "Fev", valor: 20 },
      { month: "2026-03", label: "Mar", valor: 9999 }, // posterior ao mês selecionado
    ];
    expect(calcYtd(serie, "2026-02", undefined, "brl")).toBe(30);
  });

  it("série vazia ou undefined → null", () => {
    expect(calcYtd([], "2026-06", undefined, "brl")).toBeNull();
    expect(calcYtd(undefined, "2026-06", undefined, "brl")).toBeNull();
  });

  it("ytdAgg explícito vence o default por formato (ex: 'soma' num pct)", () => {
    const serie = [
      { month: "2026-01", label: "Jan", valor: 10 },
      { month: "2026-02", label: "Fev", valor: 20 },
    ];
    expect(calcYtd(serie, "2026-02", "soma", "pct")).toBe(30);
  });

  it("ignora pontos sem `month` (não dá pra saber se pertencem ao ano YTD) e pontos com valor null", () => {
    const serie = [
      { month: "2026-01", label: "Jan", valor: 10 },
      { label: "Sem mês", valor: 999 },
      { month: "2026-02", label: "Fev", valor: null },
      { month: "2026-03", label: "Mar", valor: 20 },
    ];
    expect(calcYtd(serie, "2026-03", "soma", "brl")).toBe(30);
  });
});

describe("linhasPorDimensao", () => {
  const labelMes = (mes: string) => `L-${mes.split("-")[1]}`;

  it("series undefined → []", () => {
    expect(linhasPorDimensao(undefined, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes })).toEqual([]);
  });

  it("atual vem do ponto com month === mes; ordena por atual desc", () => {
    const series = {
      Squadra: [{ month: "2026-05", valor: 100 }, { month: "2026-06", valor: 300 }],
      Makers: [{ month: "2026-05", valor: 50 }, { month: "2026-06", valor: 500 }],
    };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => `k_${d}`, formato: "brl", labelMes });
    expect(linhas.map((l) => l.metrica)).toEqual(["Makers", "Squadra"]);
    expect(linhas[0].atual).toBe(500);
    expect(linhas[0].key).toBe("k_Makers");
  });

  it("série preserva month/label/valor na ordem cronológica", () => {
    const series = { Squadra: [{ month: "2026-06", valor: 300 }, { month: "2026-05", valor: 100 }] };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes });
    expect(linhas[0].serie).toEqual([
      { month: "2026-05", valor: 100, label: "L-05" },
      { month: "2026-06", valor: 300, label: "L-06" },
    ]);
  });

  it("mes selecionado ausente na série → usa o último ponto <= mes", () => {
    const series = { Squadra: [{ month: "2026-04", valor: 10 }, { month: "2026-05", valor: 20 }] };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes });
    expect(linhas[0].atual).toBe(20);
  });

  it("top limita a quantidade de linhas após ordenar", () => {
    const series = {
      A: [{ month: "2026-06", valor: 10 }],
      B: [{ month: "2026-06", valor: 30 }],
      C: [{ month: "2026-06", valor: 20 }],
    };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes, top: 2 });
    expect(linhas.map((l) => l.metrica)).toEqual(["B", "C"]);
  });

  it("sub recebe (dim, atual) já resolvidos da própria série", () => {
    const series = { A: [{ month: "2026-06", valor: 10 }] };
    const linhas = linhasPorDimensao(series, "2026-06", {
      keyFn: (d) => d, formato: "brl", labelMes,
      sub: (dim, atual) => `${dim}:${atual}`,
    });
    expect(linhas[0].sub).toBe("A:10");
  });

  it("responsavelAuto marca a própria dimensão como dono", () => {
    const series = { Ana: [{ month: "2026-06", valor: 10 }] };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes, responsavelAuto: true });
    expect(linhas[0].responsavelAuto).toBe("Ana");
  });

  it("todas as linhas ficam com temporalidade 'mes'", () => {
    const series = { A: [{ month: "2026-06", valor: 10 }] };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "brl", labelMes });
    expect(linhas[0].temporalidade).toBe("mes");
  });

  it("ponto do mês selecionado com valor null (ex: lead time sem entrega no mês) → atual null, sem quebrar ordenação/serie", () => {
    const series = {
      Performance: [{ month: "2026-05", valor: 12 }, { month: "2026-06", valor: null }],
      "Social Media": [{ month: "2026-05", valor: 8 }, { month: "2026-06", valor: 20 }],
    };
    const linhas = linhasPorDimensao(series, "2026-06", { keyFn: (d) => d, formato: "int", labelMes });
    const performance = linhas.find((l) => l.metrica === "Performance");
    expect(performance?.atual).toBeNull();
    expect(performance?.serie).toEqual([
      { month: "2026-05", valor: 12, label: "L-05" },
      { month: "2026-06", valor: null, label: "L-06" },
    ]);
    // "Social Media" (atual=20) ordena antes de "Performance" (atual=null → -Infinity).
    expect(linhas.map((l) => l.metrica)).toEqual(["Social Media", "Performance"]);
  });
});

describe("linhasReceitaCabeca", () => {
  const labelMes = (mes: string) => `L-${mes.split("-")[1]}`;

  it("mrrSeries undefined → []", () => {
    expect(
      linhasReceitaCabeca(undefined, undefined, "2026-06", {
        keyFn: (d) => d,
        labelMes,
        pessoasPorDim: () => 1,
      }),
    ).toEqual([]);
  });

  it("combina MRR + entregas da mesma dimensão/mês e divide pelo headcount", () => {
    const mrr = { Squadra: [{ month: "2026-06", valor: 100000 }] };
    const entregas = { Squadra: [{ month: "2026-06", valor: 20000 }] };
    const linhas = linhasReceitaCabeca(mrr, entregas, "2026-06", {
      keyFn: (d) => `k_${d}`,
      labelMes,
      pessoasPorDim: () => 6,
    });
    // (100000 + 20000) / 6 = 20000
    expect(linhas[0].atual).toBe(20000);
    expect(linhas[0].serie).toEqual([{ month: "2026-06", valor: 20000, label: "L-06" }]);
  });

  it("squad sem entrega no mês trata entregasSeries ausente como 0 (não quebra a série de MRR)", () => {
    const mrr = { Squadra: [{ month: "2026-06", valor: 60000 }] };
    const linhas = linhasReceitaCabeca(mrr, undefined, "2026-06", {
      keyFn: (d) => d,
      labelMes,
      pessoasPorDim: () => 3,
    });
    expect(linhas[0].atual).toBe(20000);
  });

  it("headcount 0/null/undefined → dimensão inteira (atual e todos os pontos da série) fica null — guarda divisão por zero", () => {
    const mrr = { "Não Informado": [{ month: "2026-05", valor: 100 }, { month: "2026-06", valor: 200 }] };
    const semHeadcount = linhasReceitaCabeca(mrr, undefined, "2026-06", {
      keyFn: (d) => d,
      labelMes,
      pessoasPorDim: () => undefined,
    });
    expect(semHeadcount[0].atual).toBeNull();
    expect(semHeadcount[0].serie?.every((p) => p.valor === null)).toBe(true);

    const headcountZero = linhasReceitaCabeca(mrr, undefined, "2026-06", {
      keyFn: (d) => d,
      labelMes,
      pessoasPorDim: () => 0,
    });
    expect(headcountZero[0].atual).toBeNull();
  });

  it("ordena por atual desc", () => {
    const mrr = {
      Squadra: [{ month: "2026-06", valor: 100000 }],
      Pulse: [{ month: "2026-06", valor: 300000 }],
    };
    const linhas = linhasReceitaCabeca(mrr, undefined, "2026-06", {
      keyFn: (d) => d,
      labelMes,
      pessoasPorDim: () => 10,
    });
    expect(linhas.map((l) => l.metrica)).toEqual(["Pulse", "Squadra"]);
  });

  it("top limita a quantidade de linhas após ordenar", () => {
    const mrr = {
      A: [{ month: "2026-06", valor: 10 }],
      B: [{ month: "2026-06", valor: 30 }],
      C: [{ month: "2026-06", valor: 20 }],
    };
    const linhas = linhasReceitaCabeca(mrr, undefined, "2026-06", {
      keyFn: (d) => d,
      labelMes,
      pessoasPorDim: () => 1,
      top: 2,
    });
    expect(linhas.map((l) => l.metrica)).toEqual(["B", "C"]);
  });

  it("responsavelAuto marca a própria dimensão como dono (uso: operador, pessoasPorDim=()=>1)", () => {
    const mrr = { Ana: [{ month: "2026-06", valor: 20000 }] };
    const linhas = linhasReceitaCabeca(mrr, undefined, "2026-06", {
      keyFn: (d) => d,
      labelMes,
      pessoasPorDim: () => 1,
      responsavelAuto: true,
    });
    expect(linhas[0].responsavelAuto).toBe("Ana");
    expect(linhas[0].atual).toBe(20000);
  });

  it("metaKey sempre 'receita_cabeca' e formato sempre 'brl'", () => {
    const mrr = { Squadra: [{ month: "2026-06", valor: 100 }] };
    const linhas = linhasReceitaCabeca(mrr, undefined, "2026-06", { keyFn: (d) => d, labelMes, pessoasPorDim: () => 1 });
    expect(linhas[0].metaKey).toBe("receita_cabeca");
    expect(linhas[0].formato).toBe("brl");
  });

  it("mes selecionado ausente na série → usa o último ponto <= mes", () => {
    const mrr = { Squadra: [{ month: "2026-04", valor: 10 }, { month: "2026-05", valor: 20 }] };
    const linhas = linhasReceitaCabeca(mrr, undefined, "2026-06", {
      keyFn: (d) => d,
      labelMes,
      pessoasPorDim: () => 1,
    });
    expect(linhas[0].atual).toBe(20);
  });
});

describe("serieOverviewLtLtv", () => {
  it("undefined → 3 arrays vazios", () => {
    expect(serieOverviewLtLtv(undefined)).toEqual({ lt: [], ltv: [], totalRecorrentes: [] });
  });

  it("agrega por mês, ponderado por n, EXCLUINDO o bucket 'Total' (senão dobraria a contagem)", () => {
    // Performance: mes 06, lt=10 (n=2); Social Media: mes 06, lt=4 (n=1).
    // "Total" replica a soma dos dois buckets (mesmo shape de buildMatrizEvolucaoProduto) —
    // se o helper não excluir "Total", totalN sairia 6 (dobrado) em vez de 3.
    const data: EvolucaoProdutoTabelaData = {
      meses: ["2026-06"],
      produtos: ["Performance", "Social Media", "Total"],
      celulas: {
        Performance: { "2026-06": { lt: 10, ltv: 1000, lt_mediana: 10, ltv_mediana: 1000, n: 2 } },
        "Social Media": { "2026-06": { lt: 4, ltv: 400, lt_mediana: 4, ltv_mediana: 400, n: 1 } },
        Total: { "2026-06": { lt: 8, ltv: 800, lt_mediana: 8, ltv_mediana: 800, n: 3 } },
      },
    };
    const r = serieOverviewLtLtv(data);
    // ltMedio ponderado = (10*2 + 4*1) / 3 = 8; ltvMedio = (1000*2 + 400*1) / 3 = 800.
    expect(r.lt).toEqual([{ month: "2026-06", valor: 8 }]);
    expect(r.ltv).toEqual([{ month: "2026-06", valor: 800 }]);
    expect(r.totalRecorrentes).toEqual([{ month: "2026-06", valor: 3 }]);
  });

  it("mês sem nenhum produto com dado é omitido (não vira ponto 0)", () => {
    const data: EvolucaoProdutoTabelaData = {
      meses: ["2026-05", "2026-06"],
      produtos: ["Performance"],
      celulas: {
        Performance: { "2026-06": { lt: 5, ltv: 500, lt_mediana: 5, ltv_mediana: 500, n: 1 } },
      },
    };
    const r = serieOverviewLtLtv(data);
    expect(r.lt).toEqual([{ month: "2026-06", valor: 5 }]);
    expect(r.totalRecorrentes).toEqual([{ month: "2026-06", valor: 1 }]);
  });

  it("só o bucket 'Total' presente (sem os produtos individuais) → sem dado (evita usar Total como se fosse um produto normal)", () => {
    const data: EvolucaoProdutoTabelaData = {
      meses: ["2026-06"],
      produtos: ["Total"],
      celulas: {
        Total: { "2026-06": { lt: 8, ltv: 800, lt_mediana: 8, ltv_mediana: 800, n: 3 } },
      },
    };
    const r = serieOverviewLtLtv(data);
    expect(r).toEqual({ lt: [], ltv: [], totalRecorrentes: [] });
  });
});

describe("serieContribuicaoGeral / serieContribuicaoPorSquad (Onda E)", () => {
  // Fixture mínima do bulk (/api/contribuicao-squad/dfc/bulk): 2 squads, 2 meses.
  const bulk: ContribuicaoSquadBulkFonte = {
    ano: 2026,
    meses: [
      { mes: "2026-01", data: { totais: { receitaTotal: 100000 } } },
      { mes: "2026-02", data: { totais: { receitaTotal: 200000 } } },
    ],
    resumoPorSquad: [
      { squad: "Squadra", porMes: [60000, 120000] },
      { squad: "Pulse", porMes: [40000, 80000] },
    ],
    despesasMensais: {
      "2026-01": { salarios: 30000, freelancers: 5000, ifood: 1000 },
      "2026-02": { salarios: 30000, freelancers: 5000, ifood: 1000 },
    },
    despesasPorSquadMensais: {
      Squadra: {
        "2026-01": { salarios: 20000, freelancers: 5000, ifood: 1000 },
        "2026-02": { salarios: 20000, freelancers: 5000, ifood: 1000 },
      },
      // Pulse não tem despesa casada em fevereiro (ex: colaborador sem match de squad de receita).
      Pulse: {
        "2026-01": { salarios: 10000, freelancers: 0, ifood: 0 },
      },
    },
  };

  it("serieContribuicaoGeral fecha a fórmula do ranking (resultadoBruto − impostos) mês a mês", () => {
    const serie = serieContribuicaoGeral(bulk);
    expect(serie).toHaveLength(2);
    // Jan: receita=100000, despesa=30000+5000+1000=36000, bruto=64000, impostos=100000*0.18=18000
    // contribuicao=64000-18000=46000, margem=46/100=46%
    expect(serie[0]).toEqual({ month: "2026-01", receita: 100000, despesa: 36000, contribuicao: 46000, margem: 46 });
    // Fev: receita=200000, despesa=36000, bruto=164000, impostos=36000, contribuicao=128000
    expect(serie[1].contribuicao).toBe(128000);
    expect(serie[1].margem).toBeCloseTo(64, 5);
  });

  it("serieContribuicaoGeral: mês sem dado (data null) vira receita=0, despesa ainda soma", () => {
    const bulkComMesVazio: ContribuicaoSquadBulkFonte = {
      ...bulk,
      meses: [{ mes: "2026-03", data: null }],
      despesasMensais: { "2026-03": { salarios: 1000, freelancers: 0, ifood: 0 } },
    };
    const serie = serieContribuicaoGeral(bulkComMesVazio);
    expect(serie[0].receita).toBe(0);
    expect(serie[0].despesa).toBe(1000);
  });

  it("serieContribuicaoGeral: bulk undefined → []", () => {
    expect(serieContribuicaoGeral(undefined)).toEqual([]);
  });

  it("serieContribuicaoPorSquad: cada squad fecha a fórmula com a PRÓPRIA despesa por mês", () => {
    const porSquad = serieContribuicaoPorSquad(bulk);
    expect(Object.keys(porSquad).sort()).toEqual(["Pulse", "Squadra"]);

    // Squadra Jan: receita=60000, despesa=26000, bruto=34000, impostos=10800, contribuicao=23200
    expect(porSquad.Squadra[0]).toEqual({ month: "2026-01", receita: 60000, despesa: 26000, contribuicao: 23200, margem: (23200 / 60000) * 100 });

    // Pulse Fev: sem despesa casada → despesa=0, contribuicao = receita - impostos(18%)
    const pulseFev = porSquad.Pulse[1];
    expect(pulseFev.month).toBe("2026-02");
    expect(pulseFev.despesa).toBe(0);
    expect(pulseFev.contribuicao).toBeCloseTo(80000 - 80000 * 0.18, 5);
  });

  it("serieContribuicaoPorSquad: bulk undefined → {}", () => {
    expect(serieContribuicaoPorSquad(undefined)).toEqual({});
  });

  it("margem null quando receita <= 0 (evita 0% enganoso)", () => {
    const bulkSemReceita: ContribuicaoSquadBulkFonte = {
      ano: 2026,
      meses: [{ mes: "2026-01", data: { totais: { receitaTotal: 0 } } }],
      resumoPorSquad: [],
      despesasMensais: { "2026-01": { salarios: 500, freelancers: 0, ifood: 0 } },
      despesasPorSquadMensais: {},
    };
    const serie = serieContribuicaoGeral(bulkSemReceita);
    expect(serie[0].margem).toBeNull();
  });
});

describe("pontoContribuicaoNoMes", () => {
  const serie = [
    { month: "2026-01", receita: 1, despesa: 1, contribuicao: 10, margem: 1 },
    { month: "2026-03", receita: 1, despesa: 1, contribuicao: 30, margem: 3 },
  ];

  it("mês exato presente na série → retorna o ponto exato", () => {
    expect(pontoContribuicaoNoMes(serie, "2026-03")?.contribuicao).toBe(30);
  });

  it("mês ausente → usa o último ponto <= mes (defensivo)", () => {
    expect(pontoContribuicaoNoMes(serie, "2026-06")?.contribuicao).toBe(30);
  });

  it("mês anterior a todos os pontos → null", () => {
    expect(pontoContribuicaoNoMes(serie, "2025-12")).toBeNull();
  });

  it("série vazia → null", () => {
    expect(pontoContribuicaoNoMes([], "2026-01")).toBeNull();
  });
});

describe("serieGeracaoCaixa / pontoGeracaoCaixaNoMes (Geração de Caixa — DFC)", () => {
  // Fixture mínima do endpoint GET /api/investors-report/geracao-caixa.
  const fonte: GeracaoCaixaFonte = {
    series: [
      { mes: "2026-01", receita: 500000, despesa: 300000, geracaoMes: 200000, caixaAcumulado: 200000 },
      { mes: "2026-02", receita: 400000, despesa: 450000, geracaoMes: -50000, caixaAcumulado: 150000 },
    ],
  };

  it("mapeia mes→month e deriva conversaoPct = geracaoMes/receita", () => {
    const serie = serieGeracaoCaixa(fonte);
    expect(serie).toHaveLength(2);
    expect(serie[0]).toEqual({
      month: "2026-01",
      receita: 500000,
      despesa: 300000,
      geracaoMes: 200000,
      caixaAcumulado: 200000,
      conversaoPct: 40,
    });
    // Fev: geração negativa (despesa > receita) — conversão também negativa, não truncada em 0.
    expect(serie[1].geracaoMes).toBe(-50000);
    expect(serie[1].conversaoPct).toBeCloseTo(-12.5, 5);
  });

  it("conversaoPct null quando receita <= 0 (evita 0%/Infinity enganoso)", () => {
    const semReceita: GeracaoCaixaFonte = {
      series: [{ mes: "2026-01", receita: 0, despesa: 1000, geracaoMes: -1000, caixaAcumulado: -1000 }],
    };
    expect(serieGeracaoCaixa(semReceita)[0].conversaoPct).toBeNull();
  });

  it("fonte undefined → []", () => {
    expect(serieGeracaoCaixa(undefined)).toEqual([]);
  });

  it("pontoGeracaoCaixaNoMes: mês exato presente → retorna o ponto exato", () => {
    const serie = serieGeracaoCaixa(fonte);
    expect(pontoGeracaoCaixaNoMes(serie, "2026-02")?.geracaoMes).toBe(-50000);
  });

  it("pontoGeracaoCaixaNoMes: mês ausente → usa o último ponto <= mes (defensivo)", () => {
    const serie = serieGeracaoCaixa(fonte);
    expect(pontoGeracaoCaixaNoMes(serie, "2026-06")?.geracaoMes).toBe(-50000);
  });

  it("pontoGeracaoCaixaNoMes: mês anterior a todos os pontos → null", () => {
    const serie = serieGeracaoCaixa(fonte);
    expect(pontoGeracaoCaixaNoMes(serie, "2025-12")).toBeNull();
  });

  it("pontoGeracaoCaixaNoMes: série vazia → null (degrada para '—' na UI)", () => {
    expect(pontoGeracaoCaixaNoMes([], "2026-01")).toBeNull();
  });
});

describe("ehSquadOff", () => {
  it("nome com '(OFF)' (caixa alta) → true", () => {
    expect(ehSquadOff("✨ Aura (OFF)")).toBe(true);
  });

  it("nome com emoji antes e '(OFF)' → true", () => {
    expect(ehSquadOff("🐭 Makers (OFF)")).toBe(true);
  });

  it("squad ativo sem marcador → false", () => {
    expect(ehSquadOff("🐍 Selva")).toBe(false);
  });

  it("squad ativo sem emoji nem marcador → false", () => {
    expect(ehSquadOff("Squadra")).toBe(false);
  });
});

describe("normalizarChaveSquad / encontrarSerieSquad", () => {
  it("ignora emoji, acento e caixa", () => {
    expect(normalizarChaveSquad("🚀 Growth")).toBe(normalizarChaveSquad("growth"));
  });

  it("'Sem Squad' (ranking) e '⚠️ Sem Squad' (bulk, SEM_SQUAD_LABEL) normalizam igual", () => {
    expect(normalizarChaveSquad("Sem Squad")).toBe(normalizarChaveSquad("⚠️ Sem Squad"));
  });

  it("encontrarSerieSquad: match exato tem prioridade", () => {
    const porSquad = { Squadra: [{ month: "2026-01", receita: 1, despesa: 0, contribuicao: 1, margem: 100 }] };
    expect(encontrarSerieSquad(porSquad, "Squadra")).toBe(porSquad.Squadra);
  });

  it("encontrarSerieSquad: match tolerante a diferença de rótulo (emoji/whitespace)", () => {
    const porSquad = { "🚀 Growth": [{ month: "2026-01", receita: 1, despesa: 0, contribuicao: 1, margem: 100 }] };
    expect(encontrarSerieSquad(porSquad, "Growth")).toBe(porSquad["🚀 Growth"]);
  });

  it("encontrarSerieSquad: sem match → undefined", () => {
    const porSquad = { Squadra: [{ month: "2026-01", receita: 1, despesa: 0, contribuicao: 1, margem: 100 }] };
    expect(encontrarSerieSquad(porSquad, "Pulse")).toBeUndefined();
  });
});

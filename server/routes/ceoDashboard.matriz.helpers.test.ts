import { describe, it, expect } from "vitest";
import { montarMatrizCeo, type CeoMatrizSources } from "./ceoDashboard.matriz.helpers";
import type { BpLinha } from "./ceoDashboard.helpers";

// Uma linha do BP com meses 1..n; realizado null = mês ainda não realizado.
function linhaBp(metrica: string, meses: Array<[number, number, number | null]>): BpLinha {
  return {
    metrica,
    meses: meses.map(([mes, orcado, realizado]) => ({
      mes,
      orcado,
      realizado,
      atingimento: realizado != null && orcado ? realizado / orcado : null,
    })),
  };
}

// Sources mínimos: mesNum=3, uma linha por métrica usada pela matriz.
function baseSources(overrides: Partial<CeoMatrizSources> = {}): CeoMatrizSources {
  const tresMeses = (base: number): Array<[number, number, number | null]> => [
    [1, base, base * 0.9],
    [2, base, base * 1.1],
    [3, base, null], // mês 3 ainda não realizado
  ];
  return {
    mesNum: 3,
    mesFechado: 2, // março em andamento (parcial); fev é o último mês fechado
    receitaRecebida: linhaBp("receita_total", tresMeses(1000)),
    receitaCabecaCaixa: linhaBp("receita_cabeca", tresMeses(10)),
    bpLinhas: [linhaBp("ebitda", tresMeses(500)), linhaBp("cac", tresMeses(200)), linhaBp("dfc_real", tresMeses(400))],
    bpMetricas: [
      linhaBp("despesa_total", tresMeses(300)),
      linhaBp("saldo_caixa", tresMeses(2000)),
      linhaBp("colaboradores", tresMeses(100)),
    ],
    inadimplenciaSeriePorMes: { 1: 5000, 2: 7000 },
    ltvFatSeriePorMes: { 1: 12000, 2: 13000, 3: 14000 },
    ltvDfcSeriePorMes: { 1: 11000, 2: 13500 }, // mês 3 sem dado → gap (célula null)
    enpsSeriePorMes: { 2: 73 }, // só o mês 2 tem pesquisa (jan/mar sem onda)
    // realizado explícito (inteiros) p/ evitar ruído de float na asserção
    cacPorClienteLinha: linhaBp("cac_por_cliente", [[1, 4000, 3600], [2, 4000, 4400], [3, 4000, null]]), // CAC ÷ deals ganhos
    cacPorContratoLinha: linhaBp("cac_por_contrato", [[1, 3000, 2700], [2, 3000, 3300], [3, 3000, null]]), // CAC ÷ serviços vendidos
    ...overrides,
  };
}

describe("montarMatrizCeo", () => {
  it("monta colunas de janeiro até o mês pedido, com labels", () => {
    const m = montarMatrizCeo(baseSources({ mesNum: 7 }));
    expect(m.ate).toBe("2026-07");
    expect(m.meses).toHaveLength(7);
    expect(m.meses[0]).toEqual({ mes: 1, label: "Jan" });
    expect(m.meses[6]).toEqual({ mes: 7, label: "Jul" });
  });

  it("expõe mesFechado para o front marcar o mês em andamento (parcial)", () => {
    const m = montarMatrizCeo(baseSources({ mesNum: 7, mesFechado: 6 }));
    expect(m.mesFechado).toBe(6); // colunas com mes > 6 (julho) são parciais
  });

  it("expõe as 15 linhas na ordem dos cards (CAC por cliente/contrato logo após o CAC)", () => {
    const m = montarMatrizCeo(baseSources());
    expect(m.linhas.map((l) => l.key)).toEqual([
      "receita", "custos", "lucro", "geracao_caixa", "caixa", "inadimplencia",
      "nps", "cac", "cac_por_cliente", "cac_por_contrato", "ltv_fat", "ltv_dfc",
      "headcount", "enps", "receita_cabeca",
    ]);
  });

  it("CAC por cliente e por contrato transpõem a linha do BP com meta (menor = melhor)", () => {
    const m = montarMatrizCeo(baseSources());
    const cli = m.linhas.find((l) => l.key === "cac_por_cliente")!;
    expect(cli.label).toBe("CAC por cliente");
    expect(cli.semMeta).toBe(false); // herda o orçado do BP → mostra "% meta"
    expect(cli.direcao).toBe("menor_melhor");
    expect(cli.celulas[0]).toEqual({ mes: 1, valor: 3600, meta: 4000, atingimentoPct: 90 });
    expect(cli.celulas[2]).toEqual({ mes: 3, valor: null, meta: 4000, atingimentoPct: null });
    const con = m.linhas.find((l) => l.key === "cac_por_contrato")!;
    expect(con.label).toBe("CAC por contrato");
    expect(con.celulas[1]).toEqual({ mes: 2, valor: 3300, meta: 3000, atingimentoPct: 110 });
  });

  it("CAC por cliente/contrato sem linha do BP degradam para células vazias (—)", () => {
    const m = montarMatrizCeo(baseSources({ cacPorClienteLinha: undefined, cacPorContratoLinha: undefined }));
    const cli = m.linhas.find((l) => l.key === "cac_por_cliente")!;
    expect(cli.celulas.every((c) => c.valor === null && c.meta === null)).toBe(true);
  });

  it("Geração de Caixa usa a linha dfc_real do BP (DFC real; meta = geração orçada)", () => {
    const m = montarMatrizCeo(baseSources());
    const gc = m.linhas.find((l) => l.key === "geracao_caixa")!;
    expect(gc.label).toBe("Geração de Caixa");
    expect(gc.semMeta).toBe(false);
    expect(gc.celulas[0]).toEqual({ mes: 1, valor: 360, meta: 400, atingimentoPct: 90 });
  });

  it("transpõe uma linha do BP: realizado, meta e % por mês", () => {
    const m = montarMatrizCeo(baseSources());
    const custos = m.linhas.find((l) => l.key === "custos")!;
    expect(custos.semMeta).toBe(false);
    expect(custos.direcao).toBe("menor_melhor");
    expect(custos.unidade).toBe("brl");
    expect(custos.celulas).toHaveLength(3);
    expect(custos.celulas[0]).toEqual({ mes: 1, valor: 270, meta: 300, atingimentoPct: 90 });
    expect(custos.celulas[1]).toEqual({ mes: 2, valor: 330, meta: 300, atingimentoPct: 110 });
    // mês 3: sem realizado → valor null, mas a meta (orçado) continua visível
    expect(custos.celulas[2]).toEqual({ mes: 3, valor: null, meta: 300, atingimentoPct: null });
  });

  it("arredonda o atingimento para 1 casa (sem ruído de ponto flutuante)", () => {
    // realizado/orcado = 1.1 → 110.0, não 110.00000000000001
    const m = montarMatrizCeo(baseSources());
    const lucro = m.linhas.find((l) => l.key === "lucro")!;
    expect(lucro.celulas[1].atingimentoPct).toBe(110);
  });

  it("inadimplência usa série própria por mês, sem meta", () => {
    const m = montarMatrizCeo(baseSources());
    const inad = m.linhas.find((l) => l.key === "inadimplencia")!;
    expect(inad.semMeta).toBe(true);
    expect(inad.direcao).toBe("menor_melhor");
    expect(inad.celulas[0]).toEqual({ mes: 1, valor: 5000, meta: null, atingimentoPct: null });
    expect(inad.celulas[1]).toEqual({ mes: 2, valor: 7000, meta: null, atingimentoPct: null });
    expect(inad.celulas[2]).toEqual({ mes: 3, valor: null, meta: null, atingimentoPct: null });
  });

  it("LTV FAT e LTV DFC usam séries mensais próprias, sem meta", () => {
    const m = montarMatrizCeo(baseSources({ mesNum: 3 }));
    const fat = m.linhas.find((l) => l.key === "ltv_fat")!;
    expect(fat.label).toBe("LTV FAT");
    expect(fat.semMeta).toBe(true);
    expect(fat.celulas.map((c) => c.valor)).toEqual([12000, 13000, 14000]);
    const dfc = m.linhas.find((l) => l.key === "ltv_dfc")!;
    expect(dfc.label).toBe("LTV DFC");
    expect(dfc.semMeta).toBe(true);
    // mês 3 sem dado na série → gap (null), não zero
    expect(dfc.celulas.map((c) => c.valor)).toEqual([11000, 13500, null]);
  });

  it("E-NPS usa série mensal, com gap onde não houve pesquisa", () => {
    const m = montarMatrizCeo(baseSources({ mesNum: 3 }));
    const enps = m.linhas.find((l) => l.key === "enps")!;
    expect(enps.unidade).toBe("score");
    // mês 1 e 3 sem onda de pesquisa → gap (null), não zero
    expect(enps.celulas.map((c) => c.valor)).toEqual([null, 73, null]);
  });

  it("NPS fica todo nulo (em breve)", () => {
    const m = montarMatrizCeo(baseSources());
    const nps = m.linhas.find((l) => l.key === "nps")!;
    expect(nps.semMeta).toBe(true);
    expect(nps.celulas.every((c) => c.valor === null)).toBe(true);
  });

  it("receita e receita/cabeça vêm das linhas sintéticas de caixa", () => {
    const m = montarMatrizCeo(baseSources());
    const receita = m.linhas.find((l) => l.key === "receita")!;
    expect(receita.semMeta).toBe(false);
    expect(receita.celulas[0]).toEqual({ mes: 1, valor: 900, meta: 1000, atingimentoPct: 90 });
    const rc = m.linhas.find((l) => l.key === "receita_cabeca")!;
    expect(rc.celulas[1]).toEqual({ mes: 2, valor: 11, meta: 10, atingimentoPct: 110 });
  });

  it("toda linha tem uma célula por mês, alinhada a `meses`", () => {
    const m = montarMatrizCeo(baseSources({ mesNum: 5 }));
    for (const linha of m.linhas) {
      expect(linha.celulas).toHaveLength(5);
      expect(linha.celulas.map((c) => c.mes)).toEqual([1, 2, 3, 4, 5]);
    }
  });
});

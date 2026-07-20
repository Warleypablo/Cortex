import { describe, it, expect } from "vitest";
import { somarValoresDrawer, pctDaBase, formatPct, agregarPorResponsavel, ordenarPorTaxaDeChurn } from "./churnAggregations";
import type { ChurnContract } from "./types";

/** Constrói um ChurnContract mínimo; só os campos do teste importam. */
function contrato(over: Partial<ChurnContract>): ChurnContract {
  return {
    id: "t1", cliente_nome: "Cliente", cnpj: "", produto: "P", squad: "S",
    responsavel: "Não especificado", cs_responsavel: "", vendedor: "",
    valorr: 0, valorp: 0, data_inicio: "2026-01-01", data_encerramento: "2026-07-01",
    data_pausa: null, status: "encerrado", servico: "P", tipo: "churn",
    lifetime_meses: 0, ltv: 0, ...over,
  };
}

describe("somarValoresDrawer", () => {
  it("soma MRR e pontual independentemente", () => {
    const r = somarValoresDrawer([
      contrato({ valorr: 2997, valorp: 0 }),
      contrato({ valorr: 0, valorp: 14997 }),
      contrato({ valorr: 2000, valorp: 500 }),
    ]);
    expect(r.mrr).toBe(4997);
    expect(r.pontual).toBe(15497);
  });

  it("trata nulos e undefined como zero", () => {
    const r = somarValoresDrawer([
      contrato({ valorr: undefined as unknown as number, valorp: null as unknown as number }),
      contrato({ valorr: 1000, valorp: 100 }),
    ]);
    expect(r.mrr).toBe(1000);
    expect(r.pontual).toBe(100);
  });

  it("retorna zeros para lista vazia", () => {
    expect(somarValoresDrawer([])).toEqual({ mrr: 0, pontual: 0 });
  });

  it("preserva ajustes manuais negativos", () => {
    const r = somarValoresDrawer([
      contrato({ valorr: 10000 }),
      contrato({ valorr: -26500 }),
    ]);
    expect(r.mrr).toBe(-16500);
  });
});

describe("pctDaBase", () => {
  it("calcula a fração sobre a base", () => {
    expect(pctDaBase(162431, 1930000)).toBeCloseTo(0.08416, 5);
  });

  it("retorna null quando a base é zero", () => {
    expect(pctDaBase(1000, 0)).toBeNull();
  });

  it("retorna null quando a base é ausente", () => {
    expect(pctDaBase(1000, undefined as unknown as number)).toBeNull();
    expect(pctDaBase(1000, NaN)).toBeNull();
  });

  it("retorna null quando a base é negativa", () => {
    expect(pctDaBase(1000, -500)).toBeNull();
  });

  it("aceita valor zero com base válida", () => {
    expect(pctDaBase(0, 1000)).toBe(0);
  });
});

describe("formatPct", () => {
  it("formata com uma casa e vírgula decimal", () => {
    expect(formatPct(0.084)).toBe("8,4%");
  });

  it("respeita o número de casas pedido", () => {
    expect(formatPct(0.0169, 2)).toBe("1,69%");
  });

  it("formata zero", () => {
    expect(formatPct(0)).toBe("0,0%");
  });
});

describe("agregarPorResponsavel", () => {
  const base = { "Glauber Pereira": 98400, "Debora Mund": 210300 };

  it("agrupa por responsável e ordena por MRR desc", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Debora Mund", valorr: 1000 }),
        contrato({ responsavel: "Glauber Pereira", valorr: 3000 }),
        contrato({ responsavel: "Debora Mund", valorr: 500 }),
      ],
      base,
    );
    expect(r.map((l) => l.responsavel)).toEqual(["Glauber Pereira", "Debora Mund"]);
    expect(r[0].mrr).toBe(3000);
    expect(r[1].mrr).toBe(1500);
    expect(r[1].contratos).toBe(2);
  });

  it("participação soma 100%", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Glauber Pereira", valorr: 3000 }),
        contrato({ responsavel: "Debora Mund", valorr: 1000 }),
      ],
      base,
    );
    const soma = r.reduce((s, l) => s + (l.participacao ?? 0), 0);
    expect(soma).toBeCloseTo(1, 6);
  });

  it("calcula churn% sobre a carteira do responsável", () => {
    const r = agregarPorResponsavel(
      [contrato({ responsavel: "Glauber Pereira", valorr: 12988 })],
      { "Glauber Pereira": 98400 },
    );
    expect(r[0].churnPct).toBeCloseTo(12988 / 98400, 6);
  });

  it("churn% é null quando não há base para o responsável", () => {
    const r = agregarPorResponsavel(
      [contrato({ responsavel: "Fulano Sem Base", valorr: 1000 })],
      base,
    );
    expect(r[0].churnPct).toBeNull();
  });

  it("atribui nomes múltiplos ao primeiro nome", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Glauber Pereira; Debora Mund", valorr: 1000 }),
        contrato({ responsavel: "Glauber Pereira", valorr: 500 }),
      ],
      base,
    );
    expect(r).toHaveLength(1);
    expect(r[0].responsavel).toBe("Glauber Pereira");
    expect(r[0].mrr).toBe(1500);
  });

  it("joga 'Não especificado' para o fim mesmo com MRR maior", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Não especificado", valorr: 90000 }),
        contrato({ responsavel: "Glauber Pereira", valorr: 100 }),
      ],
      base,
    );
    expect(r[r.length - 1].responsavel).toBe("Não especificado");
    expect(r[r.length - 1].isNaoEspecificado).toBe(true);
    expect(r[r.length - 1].churnPct).toBeNull();
  });

  it("trata responsável vazio como Não especificado", () => {
    const r = agregarPorResponsavel([contrato({ responsavel: "" }), contrato({ responsavel: "  " })], base);
    expect(r).toHaveLength(1);
    expect(r[0].responsavel).toBe("Não especificado");
    expect(r[0].contratos).toBe(2);
  });

  it("não quebra com ajuste manual negativo e sem responsável", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Glauber Pereira", valorr: 10000 }),
        contrato({ responsavel: "Não especificado", valorr: -26500 }),
      ],
      base,
    );
    const naoEsp = r.find((l) => l.isNaoEspecificado)!;
    expect(naoEsp.mrr).toBe(-26500);
    expect(naoEsp.participacao).toBeNull();
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(agregarPorResponsavel([], base)).toEqual([]);
  });
});

describe("ordenarPorTaxaDeChurn", () => {
  it("ordena quem tem base (percentual não-nulo) do maior para o menor", () => {
    const r = ordenarPorTaxaDeChurn([
      { label: "A", mrr_perdido: 100, percentual: 5 },
      { label: "B", mrr_perdido: 100, percentual: 20 },
      { label: "C", mrr_perdido: 100, percentual: 10 },
    ]);
    expect(r.map((i) => i.label)).toEqual(["B", "C", "A"]);
    expect(r.every((i) => i.noBase === false)).toBe(true);
  });

  it("coloca quem não tem base (percentual null) depois de quem tem, ordenado por MRR perdido", () => {
    const r = ordenarPorTaxaDeChurn([
      { label: "SemBase1", mrr_perdido: 500, percentual: null },
      { label: "ComBase", mrr_perdido: 100, percentual: 5 },
      { label: "SemBase2", mrr_perdido: 1000, percentual: null },
    ]);
    expect(r.map((i) => i.label)).toEqual(["ComBase", "SemBase2", "SemBase1"]);
    expect(r.map((i) => i.noBase)).toEqual([false, true, true]);
  });

  it("descarta quem não tem base e não perdeu MRR (nada a mostrar)", () => {
    const r = ordenarPorTaxaDeChurn([
      { label: "Nada", mrr_perdido: 0, percentual: null },
      { label: "ComBase", mrr_perdido: 100, percentual: 5 },
    ]);
    expect(r.map((i) => i.label)).toEqual(["ComBase"]);
  });

  it("regressão: item com mrr_ativo do 1º mês zerado mas percentual calculável não é noBase", () => {
    // Caso real medido em prod: operador sem carteira no 1º mês do range mas
    // com carteira (e churn) nos meses seguintes — mrr_ativo=0, percentual
    // calculável sobre a soma do range. noBase deve seguir o percentual, não
    // o mrr_ativo isolado do 1º mês.
    const r = ordenarPorTaxaDeChurn([
      { label: "José Neto", mrr_ativo: 0, mrr_perdido: 12000, percentual: 7.3 },
      { label: "Com carteira desde o início", mrr_ativo: 50000, mrr_perdido: 5000, percentual: 10 },
    ]);
    const joseNeto = r.find((i) => i.label === "José Neto")!;
    expect(joseNeto.noBase).toBe(false);
    expect(joseNeto.percentual).toBe(7.3);
    // Entra no ranking por percentual (comBase), não é jogado ao fim.
    expect(r.map((i) => i.label)).toEqual(["Com carteira desde o início", "José Neto"]);
  });

  it("item recém-admitido: percentual calculável mas mrr_perdido zero entra na lista (antes desaparecia se mrr_ativo fosse 0)", () => {
    // A inclusão no bucket "com base" depende só de `percentual !== null`, nunca
    // de `mrr_ativo`/`mrr_perdido` isolados. Um item sem churn ainda (mrr_perdido
    // === 0) mas com percentual calculável (ex.: 0%) agora aparece — antes do fix,
    // se a filtragem dependesse de `mrr_ativo` isolado do 1º mês, esse item podia
    // não entrar em nenhum dos dois buckets e sumir.
    const r = ordenarPorTaxaDeChurn([
      { label: "Recém-admitido", mrr_ativo: 15000, mrr_perdido: 0, percentual: 0 },
      { label: "ComChurn", mrr_ativo: 40000, mrr_perdido: 3000, percentual: 7.5 },
    ]);
    const recemAdmitido = r.find((i) => i.label === "Recém-admitido");
    expect(recemAdmitido).toBeDefined();
    expect(recemAdmitido!.noBase).toBe(false);
    expect(r.map((i) => i.label)).toEqual(["ComChurn", "Recém-admitido"]);
  });

  it("não-regressão: item com mrr_ativo > 0 e percentual calculável permanece no bucket com base, ordenado por percentual", () => {
    const r = ordenarPorTaxaDeChurn([
      { label: "Baixo", mrr_ativo: 50000, mrr_perdido: 2000, percentual: 4 },
      { label: "Alto", mrr_ativo: 80000, mrr_perdido: 9000, percentual: 11.25 },
      { label: "Medio", mrr_ativo: 60000, mrr_perdido: 4200, percentual: 7 },
    ]);
    expect(r.map((i) => i.label)).toEqual(["Alto", "Medio", "Baixo"]);
    expect(r.every((i) => i.noBase === false)).toBe(true);
  });

  it("caso que some: percentual null e mrr_perdido zero não aparece (sem base e sem churn, nada a mostrar)", () => {
    // Comportamento intencional e inalterado pelo fix — trava contra regressão futura.
    const r = ordenarPorTaxaDeChurn([
      { label: "SemBaseSemChurn", mrr_ativo: 0, mrr_perdido: 0, percentual: null },
    ]);
    expect(r).toEqual([]);
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(ordenarPorTaxaDeChurn([])).toEqual([]);
  });
});

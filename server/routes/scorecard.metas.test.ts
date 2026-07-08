import { describe, it, expect } from "vitest";
import { montarMetasScorecard, aplicarMetaChurnBaseReal } from "./scorecard";
import { getMetricByKey } from "../okr2026/bp2026Targets";
import { krs } from "../okr2026/okrRegistry";

describe("montarMetasScorecard", () => {
  const mes = "2026-06";
  const { metas } = montarMetasScorecard(mes);

  it("mrr_active vem do BP (months[mes]), origem bp, direction up", () => {
    const bpValor = getMetricByKey("mrr_active")?.months[mes];
    expect(metas.mrr_active).toEqual({
      valor: bpValor,
      unit: "BRL",
      direction: "up",
      origem: "bp",
      label: "MRR Ativo",
    });
  });

  it("nps vem do OKR (quarter_avg, Q2), direction up (gte)", () => {
    expect(metas.nps).toEqual({
      valor: 70,
      unit: "COUNT",
      direction: "up",
      origem: "okr",
      label: "NPS > 70",
    });
  });

  it("entregas_no_prazo_pct vem do OKR (quarter_avg, Q2), direction up (gte)", () => {
    expect(metas.entregas_no_prazo_pct).toEqual({
      valor: 90,
      unit: "PCT",
      direction: "up",
      origem: "okr",
      label: "Entregas Pontuais no Prazo > 90%",
    });
  });

  it("churn_brl vem do OKR mensalizado (quarter_sum Q2 ÷ 3), direction down (lte)", () => {
    const kr = krs.find((k) => k.metricKey === "churn_brl")!;
    expect(metas.churn_brl).toEqual({
      valor: kr.targets.Q2 / 3,
      unit: "BRL",
      direction: "down",
      origem: "okr",
      label: "Churn < 8%",
    });
  });

  it("receita_cabeca é override fixo", () => {
    expect(metas.receita_cabeca).toEqual({
      valor: 20000,
      unit: "BRL",
      direction: "up",
      origem: "override",
      label: "Receita por Cabeça",
    });
  });

  it("colisão BP×OKR (ex: ebitda) prefere BP (mensal)", () => {
    const bpValor = getMetricByKey("ebitda")?.months[mes];
    expect(metas.ebitda.valor).toBe(bpValor);
    expect(metas.ebitda.origem).toBe("bp");
  });

  it("mês fora do ano do planejamento (2025-12) não aplica metas de 2026, só o override fixo", () => {
    const { metas: metasOutroAno } = montarMetasScorecard("2025-12");
    expect(Object.keys(metasOutroAno)).toEqual(["receita_cabeca"]);
    expect(metasOutroAno.receita_cabeca).toEqual({
      valor: 20000,
      unit: "BRL",
      direction: "up",
      origem: "override",
      label: "Receita por Cabeça",
    });
  });
});

describe("aplicarMetaChurnBaseReal", () => {
  it("com base real, sobrescreve churn_mrr_month (do BP) com 8% da base e publica churn_pct_month", () => {
    const { metas } = montarMetasScorecard("2026-06");
    expect(metas.churn_mrr_month.origem).toBe("bp"); // pré-condição: a meta deturpada do BP existe

    aplicarMetaChurnBaseReal(metas, 1_030_229.3);

    expect(metas.churn_mrr_month.valor).toBeCloseTo(82_418.34, 2);
    expect(metas.churn_mrr_month.direction).toBe("down");
    expect(metas.churn_mrr_month.origem).toBe("override");
    expect(metas.churn_pct_month).toMatchObject({ valor: 8, unit: "PCT", direction: "down" });
  });

  it("sem base (null), REMOVE churn_mrr_month em vez de cair de volta na meta do BP, mas mantém a régua de 8%", () => {
    const { metas } = montarMetasScorecard("2026-06");

    aplicarMetaChurnBaseReal(metas, null);

    expect(metas.churn_mrr_month).toBeUndefined();
    expect(metas.churn_pct_month).toMatchObject({ valor: 8, unit: "PCT", direction: "down" });
  });
});

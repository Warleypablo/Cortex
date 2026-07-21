import { describe, it, expect } from "vitest";
import { montarDetalhamentos } from "./bp2026.detalhamentos";

// db falso: toda query de despesa devolve o mesmo valor por mês, então o CAC total é
// determinístico sem precisarmos replicar os predicados de categoria aqui. Os testes
// abaixo só olham a RAZÃO (CAC total ÷ denominador), lendo o CAC total da própria saída.
const dbFake = {
  execute: async () => ({
    rows: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, total: "1000" })),
  }),
};

const serie12 = (v: number | null) => Array.from({ length: 12 }, () => v);
const porMes12 = (v: number) =>
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, v])) as Record<number, number>;

async function montar(over: {
  contratosVendidosTotalPorMes?: (number | null)[];
  ganhosPorMes?: Record<number, number>;
} = {}) {
  return montarDetalhamentos({
    db: dbFake as any,
    orcado: {},
    vendasMrrPorMes: porMes12(50_000),
    pontualPorMes: porMes12(30_000),
    ganhosPorMes: over.ganhosPorMes ?? porMes12(70),
    contratosVendidosRec: { performance: serie12(10) },
    contratosVendidosTotalPorMes: over.contratosVendidosTotalPorMes ?? serie12(112),
    faturamentoCaixaPorMes: porMes12(1_000_000),
    mesCorrente: 7,
    mesFechado: 6,
  });
}

const linha = (cac: any[], metrica: string) => cac.find((l) => l.metrica === metrica)!;
const mesUm = (l: any) => l.meses.find((m: any) => m.mes === 1).realizado as number;

describe("CAC por contrato", () => {
  it("divide o CAC total pelos contratos criados no ClickUp, não pelos deals ganhos", async () => {
    const { cac } = await montar({ contratosVendidosTotalPorMes: serie12(112) });
    const cacTotal = mesUm(linha(cac, "cac_total_detalhe"));
    expect(cacTotal).toBeGreaterThan(0);
    expect(mesUm(linha(cac, "cac_por_contrato"))).toBeCloseTo(cacTotal / 112, 6);
  });

  it("é sensível ao denominador de contratos (dobrar contratos corta a razão pela metade)", async () => {
    const a = await montar({ contratosVendidosTotalPorMes: serie12(100) });
    const b = await montar({ contratosVendidosTotalPorMes: serie12(200) });
    expect(mesUm(linha(a.cac, "cac_por_contrato"))).toBeCloseTo(
      mesUm(linha(b.cac, "cac_por_contrato")) * 2, 6);
  });

  it("fica ABAIXO do CAC por cliente quando há mais contratos que deals ganhos", async () => {
    // régua real do BP: um deal costuma gerar mais de um contrato (jan/26: 68 deals, 112 contratos)
    const { cac } = await montar({
      ganhosPorMes: porMes12(68), contratosVendidosTotalPorMes: serie12(112),
    });
    const porCliente = mesUm(linha(cac, "cac_por_cliente"));
    const porContrato = mesUm(linha(cac, "cac_por_contrato"));
    expect(porContrato).toBeLessThan(porCliente);
  });

  it("não divide por zero quando o mês ainda não tem contrato", async () => {
    const { cac } = await montar({ contratosVendidosTotalPorMes: serie12(0) });
    expect(mesUm(linha(cac, "cac_por_contrato"))).toBeNull();
  });

  it("zera o realizado dos meses futuros (além do mês corrente)", async () => {
    const { cac } = await montar();
    const l = linha(cac, "cac_por_contrato");
    expect(l.meses.find((m: any) => m.mes === 8).realizado).toBeNull();
  });
});

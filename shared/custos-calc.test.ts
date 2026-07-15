import { describe, it, expect } from "vitest";
import {
  mesDe, ativoNoMes, custoMensalRecorrente, converter, agruparPor, totalBRL, totalUSD,
  type LinhaCusto,
} from "./custos-calc";

describe("mesDe", () => {
  it("extrai YYYY-MM de uma data ISO", () => {
    expect(mesDe("2026-07-14")).toBe("2026-07");
  });
});

describe("ativoNoMes", () => {
  const base = { dataInicio: "2026-03-10", dataFim: null as string | null, status: "ativo" };
  it("ativo quando o mês está dentro da janela aberta", () => {
    expect(ativoNoMes(base, "2026-07")).toBe(true);
  });
  it("inativo antes do início", () => {
    expect(ativoNoMes(base, "2026-02")).toBe(false);
  });
  it("respeita data de cancelamento (conta até o mês do fim, inclusive)", () => {
    const cancelado = { dataInicio: "2026-03-10", dataFim: "2026-05-20", status: "inativo" };
    expect(ativoNoMes(cancelado, "2026-05")).toBe(true);
    expect(ativoNoMes(cancelado, "2026-06")).toBe(false);
  });
  it("inativo sem data de fim não conta em nenhum mês", () => {
    expect(ativoNoMes({ dataInicio: "2026-03-10", dataFim: null, status: "inativo" }, "2026-07")).toBe(false);
  });
});

describe("custoMensalRecorrente", () => {
  it("mensal retorna o valor cheio", () => {
    expect(custoMensalRecorrente({ valor: 100, ciclo: "mensal", dataInicio: "2026-01-01", dataFim: null, status: "ativo" }, "2026-07")).toBe(100);
  });
  it("anual rateia por 12", () => {
    expect(custoMensalRecorrente({ valor: 1200, ciclo: "anual", dataInicio: "2026-01-01", dataFim: null, status: "ativo" }, "2026-07")).toBe(100);
  });
  it("pontual conta só no mês do início", () => {
    const item = { valor: 500, ciclo: "pontual" as const, dataInicio: "2026-07-05", dataFim: null, status: "ativo" };
    expect(custoMensalRecorrente(item, "2026-07")).toBe(500);
    expect(custoMensalRecorrente(item, "2026-08")).toBe(0);
  });
  it("fora da janela retorna 0", () => {
    expect(custoMensalRecorrente({ valor: 100, ciclo: "mensal", dataInicio: "2026-09-01", dataFim: null, status: "ativo" }, "2026-07")).toBe(0);
  });
});

describe("converter", () => {
  it("USD → BRL multiplica pela taxa; USD fica igual", () => {
    expect(converter(10, "USD", 5.5)).toEqual({ valorUSD: 10, valorBRL: 55 });
  });
  it("BRL → USD divide pela taxa; BRL fica igual", () => {
    expect(converter(55, "BRL", 5.5)).toEqual({ valorUSD: 10, valorBRL: 55 });
  });
  it("taxa 0 não quebra (USD estimado 0)", () => {
    expect(converter(55, "BRL", 0)).toEqual({ valorUSD: 0, valorBRL: 55 });
  });
});

describe("agregações", () => {
  const linhas: LinhaCusto[] = [
    { pilar: "assinaturas", fornecedor: "Anthropic", projeto: "Geral", moeda: "USD", valorOriginal: 20, valorUSD: 20, valorBRL: 110 },
    { pilar: "gcp", fornecedor: "Google", projeto: "Synapse", moeda: "USD", valorOriginal: 30, valorUSD: 30, valorBRL: 165 },
    { pilar: "assinaturas", fornecedor: "Anthropic", projeto: "Synapse", moeda: "USD", valorOriginal: 10, valorUSD: 10, valorBRL: 55 },
  ];
  it("totalBRL soma tudo", () => {
    expect(totalBRL(linhas)).toBe(330);
  });
  it("totalUSD soma tudo", () => {
    expect(totalUSD(linhas)).toBe(60);
  });
  it("agruparPor pilar soma BRL por pilar", () => {
    expect(agruparPor(linhas, "pilar")).toEqual({ assinaturas: 165, gcp: 165 });
  });
  it("agruparPor projeto isola o Synapse", () => {
    expect(agruparPor(linhas, "projeto")).toEqual({ Geral: 110, Synapse: 220 });
  });
});

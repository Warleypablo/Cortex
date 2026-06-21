// server/routes/creatorsModelo.helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  classifyModelo, classifyEstadoRecorrente, classifyEstadoPontual, isSequenciado,
  type RawRow,
} from "./creatorsModelo.helpers";

function row(p: Partial<RawRow>): RawRow {
  return {
    idTask: "T1", idSubtask: "S1", produto: "Creators", servico: "Creators Pontual",
    status: "ativo", tipoReceita: "pontual", valorr: 0, valorp: 5000,
    ltMeses: null, ltvRecorrente: null, isAtivo: true, isChurned: false,
    dataInconsistente: false, dataInicio: "2026-03-01", dataFim: null, ...p,
  };
}

describe("classifyModelo", () => {
  it("recorrente quando tipo_receita=recorrente", () => {
    expect(classifyModelo(row({ tipoReceita: "recorrente" }))).toBe("recorrente");
  });
  it("pontual quando tipo_receita=pontual", () => {
    expect(classifyModelo(row({ tipoReceita: "pontual" }))).toBe("pontual");
  });
  it("null para sem_valor", () => {
    expect(classifyModelo(row({ tipoReceita: "sem_valor" }))).toBeNull();
  });
});

describe("classifyEstadoRecorrente", () => {
  it("cancelado quando is_churned", () => {
    expect(classifyEstadoRecorrente(row({ isChurned: true }))).toBe("cancelado");
  });
  it("ativo quando não churned", () => {
    expect(classifyEstadoRecorrente(row({ isChurned: false }))).toBe("ativo");
  });
});

describe("classifyEstadoPontual", () => {
  it("concluido para entregue", () => {
    expect(classifyEstadoPontual("entregue")).toBe("concluido");
  });
  it("cancelado para cancelado/inativo e não usar", () => {
    expect(classifyEstadoPontual("cancelado/inativo")).toBe("cancelado");
    expect(classifyEstadoPontual("não usar")).toBe("cancelado");
  });
  it("em_producao para triagem/onboarding/ativo/pausado", () => {
    expect(classifyEstadoPontual("triagem")).toBe("em_producao");
    expect(classifyEstadoPontual("ativo")).toBe("em_producao");
  });
});

describe("isSequenciado", () => {
  it("true para serviços com 'entrega' numerada", () => {
    expect(isSequenciado("1ª Entrega - Creators")).toBe(true);
    expect(isSequenciado("Entrega 3 - Creators - Starter")).toBe(true);
  });
  it("false para pacote avulso", () => {
    expect(isSequenciado("Creators Pontual")).toBe(false);
    expect(isSequenciado("Creators Scale")).toBe(false);
  });
  it("false para falso-positivo 'rótulos'", () => {
    expect(isSequenciado("Entrega de 3 rótulos")).toBe(false);
  });
});

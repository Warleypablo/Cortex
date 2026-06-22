// server/routes/creatorsModelo.helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  classifyModelo, classifyEstadoRecorrente, classifyEstadoPontual, isSequenciado,
  buildUnitsRecorrente, buildUnitsPontual, aggregateMetricas, mesesEntre,
  buildCurvaRecorrente, buildRecompra,
  buildCreatorsModeloPayload, aplicarPeriodo,
  type RawRow,
} from "./creatorsModelo.helpers";

const HOJE = "2026-06-21";

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

describe("mesesEntre", () => {
  it("conta meses (30.44 dias) entre duas datas", () => {
    expect(mesesEntre("2026-01-01", "2026-04-01")).toBeCloseTo(2.96, 1);
  });
  it("0 quando ate < de", () => {
    expect(mesesEntre("2026-04-01", "2026-01-01")).toBe(0);
  });
});

describe("buildUnitsRecorrente", () => {
  it("por contrato: usa ltMeses e ltvRecorrente, exclui lt de inconsistentes", () => {
    const rows = [
      row({ tipoReceita: "recorrente", valorr: 1000, ltMeses: 5, ltvRecorrente: 5000, isChurned: true, dataInconsistente: false, dataInicio: "2026-01-01" }),
      row({ tipoReceita: "recorrente", valorr: 2000, ltMeses: 99, ltvRecorrente: 198000, isChurned: true, dataInconsistente: true, dataInicio: "2026-01-01" }),
    ];
    const units = buildUnitsRecorrente(rows, "contrato", HOJE);
    expect(units).toHaveLength(2);
    expect(units[0].lt).toBe(5);
    expect(units[0].ltv).toBe(5000);
    expect(units[1].lt).toBeNull(); // inconsistente → lt não conta
    expect(units[1].ltv).toBe(198000);
  });
  it("por cliente: agrega LTV e usa span de início→fim", () => {
    const rows = [
      row({ idTask: "A", tipoReceita: "recorrente", valorr: 1000, ltMeses: 3, ltvRecorrente: 3000, isChurned: true, dataInicio: "2026-01-01", dataFim: "2026-04-01" }),
      row({ idTask: "A", tipoReceita: "recorrente", valorr: 1000, ltMeses: 2, ltvRecorrente: 2000, isChurned: true, dataInicio: "2026-02-01", dataFim: "2026-04-01" }),
    ];
    const units = buildUnitsRecorrente(rows, "cliente", HOJE);
    expect(units).toHaveLength(1);
    expect(units[0].ltv).toBe(5000); // soma
    expect(units[0].lt).toBeCloseTo(2.96, 1); // jan→abr
  });
  it("por cliente ativo: span vai até hoje", () => {
    const units = buildUnitsRecorrente(
      [row({ idTask: "B", tipoReceita: "recorrente", valorr: 1000, ltMeses: 1, ltvRecorrente: 1000, isChurned: false, dataInicio: "2026-03-01", dataFim: null })],
      "cliente", HOJE,
    );
    expect(units[0].lt).toBeGreaterThan(3); // mar→jun
  });
  it("por cliente cancelado: ignora data_fim de contratos inconsistentes (lt null se nenhum válido)", () => {
    const units = buildUnitsRecorrente(
      [row({ idTask: "C", tipoReceita: "recorrente", isChurned: true, dataInconsistente: true, dataInicio: "2026-03-01", dataFim: "2026-01-01", ltMeses: 5, ltvRecorrente: 5000 })],
      "cliente", HOJE,
    );
    expect(units[0].lt).toBeNull();   // único fim é inconsistente → sem span válido
    expect(units[0].ltv).toBe(5000);  // LTV ainda soma
  });
});

describe("buildUnitsPontual", () => {
  it("por contrato: nEntregas=1, ltv=valorp, lt=0", () => {
    const units = buildUnitsPontual(
      [row({ tipoReceita: "pontual", valorp: 5000, status: "entregue" })],
      "contrato", HOJE,
    );
    expect(units[0].nEntregas).toBe(1);
    expect(units[0].ltv).toBe(5000);
    expect(units[0].estado).toBe("concluido");
  });
  it("por cliente: nEntregas=nº contratos, ltv=soma, lt=span, estado por prioridade", () => {
    const rows = [
      row({ idTask: "A", tipoReceita: "pontual", valorp: 5000, status: "entregue", dataInicio: "2026-01-01" }),
      row({ idTask: "A", tipoReceita: "pontual", valorp: 6000, status: "ativo", dataInicio: "2026-03-01" }),
    ];
    const units = buildUnitsPontual(rows, "cliente", HOJE);
    expect(units).toHaveLength(1);
    expect(units[0].nEntregas).toBe(2);
    expect(units[0].ltv).toBe(11000);
    expect(units[0].lt).toBeCloseTo(1.97, 1); // jan→mar span
    expect(units[0].estado).toBe("em_producao"); // em produção tem prioridade
  });
});

describe("aggregateMetricas", () => {
  it("calcula média/mediana ignorando lt null", () => {
    const m = aggregateMetricas([
      { estado: "ativo", lt: 2, nEntregas: 0, ltv: 1000, idadeMeses: 4 },
      { estado: "ativo", lt: 4, nEntregas: 0, ltv: 3000, idadeMeses: 6 },
      { estado: "ativo", lt: null, nEntregas: 0, ltv: 5000, idadeMeses: 8 },
    ]);
    expect(m.n).toBe(3);
    expect(m.ltMesesMedia).toBe(3);     // (2+4)/2, null ignorado
    expect(m.ltvMedia).toBe(3000);      // (1000+3000+5000)/3
    expect(m.ltvTotal).toBe(9000);
    expect(m.ltMesesMediana).toBe(3);
  });
  it("zera tudo para lista vazia", () => {
    const m = aggregateMetricas([]);
    expect(m.n).toBe(0);
    expect(m.ltvMedia).toBe(0);
  });
});

describe("buildCurvaRecorrente", () => {
  it("no marco de 3m: só conta quem teve chance (idade>=3) e sobreviveu (lt>=3 ou ativo)", () => {
    const rows = [
      // ativo há 5 meses → sobrevive a 1,3 (idade>=) ; não conta em 6,12
      row({ tipoReceita: "recorrente", isChurned: false, dataInicio: "2026-01-21", dataFim: null, ltMeses: 5, dataInconsistente: false }),
      // churned com lt=2 (entrou jan, saiu mar) → teve chance até 3m, NÃO sobreviveu a 3
      row({ tipoReceita: "recorrente", isChurned: true, dataInicio: "2026-01-01", dataFim: "2026-03-01", ltMeses: 2, dataInconsistente: false }),
    ];
    const curva = buildCurvaRecorrente(rows, "2026-06-21");
    const m3 = curva.find((c) => c.meses === 3)!;
    expect(m3.n).toBe(2);                 // ambos tiveram chance (idade>=3)
    expect(m3.pctSobrevivencia).toBe(50); // só o ativo sobreviveu
  });
  it("ignora contratos pontuais e inconsistentes", () => {
    const curva = buildCurvaRecorrente(
      [row({ tipoReceita: "pontual" }), row({ tipoReceita: "recorrente", dataInconsistente: true })],
      "2026-06-21",
    );
    expect(curva.every((c) => c.n === 0)).toBe(true);
  });
});

describe("buildRecompra", () => {
  it("conta clientes avulsos (sem sequência) com >=2 contratos pontuais", () => {
    const rows = [
      // cliente A: 2 contratos avulsos → recomprou
      row({ idTask: "A", tipoReceita: "pontual", servico: "Creators Pontual" }),
      row({ idTask: "A", tipoReceita: "pontual", servico: "Creators Scale" }),
      // cliente B: 1 contrato avulso → não recomprou
      row({ idTask: "B", tipoReceita: "pontual", servico: "Creators Pontual" }),
      // cliente C: sequenciado → não entra no universo avulso
      row({ idTask: "C", tipoReceita: "pontual", servico: "1ª Entrega - Creators" }),
    ];
    const r = buildRecompra(rows);
    expect(r.totalAvulsos).toBe(2);   // A e B
    expect(r.comRecompra).toBe(1);    // A
    expect(r.pctRecompra).toBe(50);
  });
});

describe("aplicarPeriodo", () => {
  it("filtra por mês de data_inicio (de/ate inclusivos)", () => {
    const rows = [
      row({ dataInicio: "2026-01-15" }), row({ dataInicio: "2026-03-10" }), row({ dataInicio: "2026-05-20" }),
    ];
    expect(aplicarPeriodo(rows, "2026-03", undefined)).toHaveLength(2);
    expect(aplicarPeriodo(rows, "2026-03", "2026-03")).toHaveLength(1);
  });
});

describe("buildCreatorsModeloPayload", () => {
  const rows = [
    row({ idTask: "R1", tipoReceita: "recorrente", valorr: 1000, ltMeses: 4, ltvRecorrente: 4000, isChurned: true, dataInicio: "2026-01-01", dataFim: "2026-05-01" }),
    row({ idTask: "P1", tipoReceita: "pontual", valorp: 5000, status: "entregue", servico: "Creators Pontual", dataInicio: "2026-03-01" }),
    row({ idTask: "P2", tipoReceita: "pontual", valorp: 6000, status: "ativo", servico: "1ª Entrega - Creators", dataInicio: "2026-04-01" }),
  ];
  it("monta grupos por modelo/estado nas duas unidades", () => {
    const p = buildCreatorsModeloPayload(rows, { hoje: "2026-06-21" });
    const recCancelado = p.tabela.cliente.find((g) => g.modelo === "recorrente" && g.estado === "cancelado");
    expect(recCancelado?.metricas.n).toBe(1);
    expect(recCancelado?.metricas.ltvMedia).toBe(4000);
    const pontConcluido = p.tabela.cliente.find((g) => g.modelo === "pontual" && g.estado === "concluido");
    expect(pontConcluido?.metricas.n).toBe(1);
  });
  it("inclui linha total por modelo", () => {
    const p = buildCreatorsModeloPayload(rows, { hoje: "2026-06-21" });
    const pontTotal = p.tabela.cliente.find((g) => g.modelo === "pontual" && g.estado === "total");
    expect(pontTotal?.metricas.n).toBe(2); // P1 + P2
  });
  it("monta meta com contagem sequenciado/avulso", () => {
    const p = buildCreatorsModeloPayload(rows, { hoje: "2026-06-21" });
    expect(p.meta.nSequenciados).toBe(1); // P2
    expect(p.meta.nAvulsos).toBe(1);      // P1
  });
  it("expõe funil, curva, recompra e coorte", () => {
    const p = buildCreatorsModeloPayload(rows, { hoje: "2026-06-21" });
    expect(Array.isArray(p.funilVendido)).toBe(true);
    expect(Array.isArray(p.funilEntregue)).toBe(true);
    expect(Array.isArray(p.curvaRecorrente)).toBe(true);
    expect(typeof p.recompra.pctRecompra).toBe("number");
    expect(typeof p.coorte.avisoMaturidade).toBe("boolean");
  });
  it("exclui contrato 'rótulos' do funil (mas conta como avulso)", () => {
    const rows = [
      row({ idTask: "X", tipoReceita: "pontual", valorp: 4000, status: "entregue", servico: "Entrega de 3 rótulos", dataInicio: "2026-03-01" }),
    ];
    const p = buildCreatorsModeloPayload(rows, { hoje: "2026-06-21" });
    expect(p.funilVendido).toHaveLength(0);   // rótulos não vira jornada de entrega
    expect(p.meta.nSequenciados).toBe(0);
    expect(p.meta.nAvulsos).toBe(1);          // entra como avulso
  });
});

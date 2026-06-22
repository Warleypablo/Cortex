// server/routes/creatorsModelo.helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  classifyModelo, classifyEstadoRecorrente, classifyEstadoPontual, isSequenciado,
  buildUnitsRecorrente, buildUnitsPontual, aggregateMetricas, mesesEntre,
  buildCurvaRecorrente, buildRecompra,
  buildCreatorsModeloPayload, aplicarPeriodo,
  buildLtvMaduro, buildPlacar,
  buildMixMensal,
  buildSobrevivenciaSafra, avisoMaturidadePorRazao,
  buildClientesDetalhe, buildEvolucaoClientes,
  type RawRow, type EvoSnapRow,
} from "./creatorsModelo.helpers";

const HOJE = "2026-06-21";

function row(p: Partial<RawRow>): RawRow {
  return {
    idTask: "T1", idSubtask: "S1", nome: "Cliente T1", produto: "Creators", servico: "Creators Pontual",
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
  it("por cliente: descarta cliente que só tem contrato fantasma", () => {
    const units = buildUnitsRecorrente(
      [row({ idTask: "G", tipoReceita: "recorrente", isAtivo: false, isChurned: false, status: "entregue", ltvRecorrente: null, dataInicio: "2026-03-01" })],
      "cliente", HOJE,
    );
    expect(units).toHaveLength(0);
  });
  it("ignora 'fantasma' recorrente (entregue/ltv null) do balde ativo", () => {
    const units = buildUnitsRecorrente(
      [
        // ativo real
        row({ idTask: "A", tipoReceita: "recorrente", valorr: 1000, ltMeses: 3, ltvRecorrente: 3000, isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-03-01" }),
        // fantasma: status entregue, ltv null, não-ativo não-churned → NÃO conta
        row({ idTask: "B", tipoReceita: "recorrente", valorr: 1000, ltMeses: null, ltvRecorrente: null, isAtivo: false, isChurned: false, status: "entregue", dataInicio: "2026-03-01" }),
      ],
      "contrato", "2026-06-21",
    );
    expect(units).toHaveLength(1);       // só o ativo real
    expect(units[0].ltv).toBe(3000);
  });
});

describe("buildUnitsPontual", () => {
  it("por contrato: entrega única → ltv conta, mas LT null (fora do cálculo)", () => {
    const units = buildUnitsPontual(
      [row({ tipoReceita: "pontual", valorp: 5000, status: "entregue" })],
      "contrato", HOJE,
    );
    expect(units[0].nEntregas).toBe(1);
    expect(units[0].ltv).toBe(5000);  // LTV realizado ainda conta a entrega única
    expect(units[0].estado).toBe("concluido");
    expect(units[0].lt).toBeNull();   // entrega única → fora da média de LT
  });
  it("por contrato: LTV e LT contam só entregas entregues (1 = 1 mês)", () => {
    const rows = [
      row({ idTask: "J", tipoReceita: "pontual", valorp: 5000, status: "entregue", servico: "1ª Entrega - Creators", dataInicio: "2026-01-01" }),
      row({ idTask: "J", tipoReceita: "pontual", valorp: 5000, status: "entregue", servico: "2ª Entrega - Creators", dataInicio: "2026-04-01" }),
      row({ idTask: "J", tipoReceita: "pontual", valorp: 5000, status: "cancelado/inativo", servico: "3ª Entrega - Creators", dataInicio: "2026-06-01" }),
    ];
    const units = buildUnitsPontual(rows, "contrato", HOJE);
    expect(units).toHaveLength(1);             // jornada vira 1 contrato (não 3)
    expect(units[0].lt).toBe(2);               // 2 entregues = 2 meses; a 3ª (cancelada) não entra
    expect(units[0].ltv).toBe(10000);          // só as 2 entregues; a cancelada não gera receita
    expect(units[0].nEntregas).toBe(3);        // contagem total de entregas (vendidas) preservada
  });
  it("por contrato: caso Dily — 1 de 4 entregue → ltv = 1 entrega, LT null (única)", () => {
    const rows = [
      row({ idTask: "D", tipoReceita: "pontual", valorp: 14000, status: "entregue", servico: "1ª Entrega - Creators", dataInicio: "2026-03-16" }),
      row({ idTask: "D", tipoReceita: "pontual", valorp: 14000, status: "triagem", servico: "2ª Entrega - Creators", dataInicio: "2026-03-30" }),
      row({ idTask: "D", tipoReceita: "pontual", valorp: 14000, status: "triagem", servico: "3ª Entrega - Creators", dataInicio: "2026-03-30" }),
      row({ idTask: "D", tipoReceita: "pontual", valorp: 14000, status: "triagem", servico: "4ª Entrega - Creators", dataInicio: "2026-03-30" }),
    ];
    const units = buildUnitsPontual(rows, "contrato", HOJE);
    expect(units[0].ltv).toBe(14000); // só a 1ª (entregue); as 3 em triagem não contam
    expect(units[0].lt).toBeNull();   // 1 entregue (única) → fora do LT
    expect(units[0].nEntregas).toBe(4);
  });
  it("por cliente: LTV conta só entregue; 1 entregue (única) → LT null", () => {
    const rows = [
      row({ idTask: "A", tipoReceita: "pontual", valorp: 5000, status: "entregue", dataInicio: "2026-01-01" }),
      row({ idTask: "A", tipoReceita: "pontual", valorp: 6000, status: "ativo", dataInicio: "2026-03-01" }),
    ];
    const units = buildUnitsPontual(rows, "cliente", HOJE);
    expect(units).toHaveLength(1);
    expect(units[0].nEntregas).toBe(2);
    expect(units[0].ltv).toBe(5000);   // só a entregue; a 'ativo' ainda não foi realizada
    expect(units[0].lt).toBeNull();    // 1 entregue (única) → fora do LT
    expect(units[0].estado).toBe("em_producao"); // em produção tem prioridade
  });
  it("por cliente: sem nenhuma entrega entregue → LT null (fora da média)", () => {
    const units = buildUnitsPontual(
      [row({ idTask: "A", tipoReceita: "pontual", valorp: 5000, status: "triagem", dataInicio: "2026-01-01" })],
      "cliente", HOJE,
    );
    expect(units[0].ltv).toBe(0);    // nada entregue → LTV realizado 0
    expect(units[0].lt).toBeNull();  // 0 entregues → sem lifetime → fora da média
  });
  it("por cliente: 3 entregues → LT = 3 meses", () => {
    const rows = [
      row({ idTask: "A", tipoReceita: "pontual", valorp: 5000, status: "entregue", dataInicio: "2026-01-01" }),
      row({ idTask: "A", tipoReceita: "pontual", valorp: 6000, status: "entregue", dataInicio: "2026-04-01" }),
      row({ idTask: "A", tipoReceita: "pontual", valorp: 7000, status: "entregue", dataInicio: "2026-05-01" }),
      row({ idTask: "A", tipoReceita: "pontual", valorp: 8000, status: "triagem", dataInicio: "2026-06-01" }),
    ];
    const units = buildUnitsPontual(rows, "cliente", HOJE);
    expect(units[0].ltv).toBe(18000);  // 3 entregues; a triagem não conta
    expect(units[0].lt).toBe(3);       // 3 entregues = 3 meses
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

describe("buildLtvMaduro", () => {
  it("faixa: blended <= ativo; projeção por churn = MRR x LT cancelado", () => {
    const rows = [
      // ativo: MRR 1000, ltv realizado 6000 (6 meses vivos)
      row({ idTask: "A", tipoReceita: "recorrente", valorr: 1000, ltMeses: 6, ltvRecorrente: 6000, isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-01-01" }),
      // cancelado: MRR 1000, ltv 2000 (2 meses), LT cancelado define a premissa de churn
      row({ idTask: "B", tipoReceita: "recorrente", valorr: 1000, ltMeses: 2, ltvRecorrente: 2000, isAtivo: false, isChurned: true, dataInconsistente: false, status: "cancelado/inativo", dataInicio: "2026-01-01", dataFim: "2026-03-01" }),
    ];
    const m = buildLtvMaduro(rows, "2026-06-21");
    expect(m.realizadoBlended).toBe(4000);  // (6000+2000)/2
    expect(m.realizadoAtivo).toBe(6000);    // só o ativo
    expect(m.premissaChurnMeses).toBe(2);   // LT médio dos cancelados
    expect(m.projetadoChurn).toBe(2000);    // MRR_ativo(1000) x LT_cancelado(2)
  });
});

describe("buildPlacar", () => {
  const rows = [
    row({ idTask: "R1", tipoReceita: "recorrente", valorr: 1000, ltMeses: 6, ltvRecorrente: 6000, isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-01-01" }),
    row({ idTask: "R2", tipoReceita: "recorrente", valorr: 1000, ltMeses: 2, ltvRecorrente: 2000, isAtivo: false, isChurned: true, dataInconsistente: false, status: "cancelado/inativo", dataInicio: "2026-01-01", dataFim: "2026-03-01" }),
    row({ idTask: "P1", tipoReceita: "pontual", valorp: 1000, status: "entregue", servico: "Creators Pontual", dataInicio: "2026-03-01" }),
    row({ idTask: "P2", tipoReceita: "pontual", valorp: 3000, status: "entregue", servico: "Creators Pontual", dataInicio: "2026-03-01" }),
  ];
  it("por cliente é blended×blended e calcula razão", () => {
    const p = buildPlacar(rows, "2026-06-21");
    expect(p.porCliente.recorrente).toBe(4000);  // (6000+2000)/2
    expect(p.porCliente.pontual).toBe(2000);     // (1000+3000)/2
    expect(p.porCliente.recorrenteAtivo).toBe(6000);
    expect(p.porCliente.razao).toBe(2);          // 4000/2000
  });
  it("volume/caixa soma receita por modelo", () => {
    const p = buildPlacar(rows, "2026-06-21");
    expect(p.volume.pontualReceita).toBe(4000);       // 1000+3000
    expect(p.volume.recorrenteRealizado).toBe(8000);  // 6000+2000
    expect(p.volume.recorrenteMrrCorrente).toBe(1000); // só o ativo
    expect(p.volume.pontualClientes).toBe(2);
    expect(p.volume.recorrenteClientes).toBe(2);
  });
  it("recorrenteClientesAtivos conta só ativos (não blended)", () => {
    const p = buildPlacar(rows, "2026-06-21");
    expect(p.volume.recorrenteClientesAtivos).toBe(1); // só R1 (ativo)
    expect(p.volume.recorrenteClientes).toBe(2);       // R1 + R2 (blended)
  });
  it("break-even = LTV recorrente / ticket pontual (faixa)", () => {
    const p = buildPlacar(rows, "2026-06-21");
    expect(p.breakEven.ticketPontual).toBe(2000);     // média valorp entregues (1000+3000)/2
    expect(p.breakEven.minRecompras).toBe(2);         // blended 4000/2000
    expect(p.breakEven.maxRecompras).toBe(3);         // ativo 6000/2000
  });
});

describe("buildMixMensal", () => {
  it("agrupa vendas novas por mês de data_inicio e modelo", () => {
    const rows = [
      row({ tipoReceita: "pontual", valorp: 5000, dataInicio: "2026-03-10" }),
      row({ tipoReceita: "pontual", valorp: 6000, dataInicio: "2026-03-20" }),
      row({ tipoReceita: "recorrente", valorr: 1000, valorp: 0, dataInicio: "2026-03-05" }),
      row({ tipoReceita: "pontual", valorp: 4000, dataInicio: "2026-04-01" }),
    ];
    const mix = buildMixMensal(rows);
    expect(mix).toHaveLength(2);
    const mar = mix.find((m) => m.mes === "2026-03")!;
    expect(mar.pontualN).toBe(2);
    expect(mar.pontualValor).toBe(11000);
    expect(mar.recorrenteN).toBe(1);
    expect(mar.recorrenteMrrNovo).toBe(1000);
    expect(mix.find((m) => m.mes === "2026-04")!.pontualN).toBe(1);
  });
  it("ignora linhas sem data_inicio", () => {
    expect(buildMixMensal([row({ tipoReceita: "pontual", dataInicio: null })])).toHaveLength(0);
  });
});

describe("buildSobrevivenciaSafra", () => {
  it("agrupa recorrente por mês de entrada e calcula % ainda ativo (não mistura coortes)", () => {
    const rows = [
      row({ tipoReceita: "recorrente", isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-01-05" }),
      row({ tipoReceita: "recorrente", isAtivo: false, isChurned: true, status: "cancelado/inativo", dataInicio: "2026-01-20" }),
      row({ tipoReceita: "recorrente", isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-02-10" }),
    ];
    const s = buildSobrevivenciaSafra(rows);
    expect(s).toHaveLength(2);
    expect(s.find((x) => x.safra === "2026-01")).toMatchObject({ n: 2, pctAtivo: 50 });
    expect(s.find((x) => x.safra === "2026-02")).toMatchObject({ n: 1, pctAtivo: 100 });
  });
});

describe("avisoMaturidadePorRazao", () => {
  it("aviso false quando uma coorte está vazia (guard de divisão por zero)", () => {
    const a = avisoMaturidadePorRazao([row({ tipoReceita: "recorrente", isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2025-01-01" })], "2026-06-21");
    expect(a.aviso).toBe(false);  // pontual ausente → menor=0 → guard
  });
  it("acende quando uma coorte é >40% mais velha (corrige limiar absoluto)", () => {
    const rows = [
      row({ tipoReceita: "recorrente", isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2025-01-01" }), // ~17m
      row({ tipoReceita: "pontual", status: "entregue", dataInicio: "2026-04-01" }), // ~2.6m
    ];
    const a = avisoMaturidadePorRazao(rows, "2026-06-21");
    expect(a.aviso).toBe(true);
    expect(a.recorrenteIdade).toBeGreaterThan(a.pontualIdade);
  });
});

describe("buildClientesDetalhe", () => {
  const rows = [
    row({ idTask: "P1", nome: "Cacow", tipoReceita: "pontual", valorp: 5000, status: "entregue", servico: "1ª Entrega - Creators", dataInicio: "2026-01-01" }),
    row({ idTask: "P1", nome: "Cacow", tipoReceita: "pontual", valorp: 6000, status: "entregue", servico: "2ª Entrega - Creators", dataInicio: "2026-04-01" }),
    row({ idTask: "P2", nome: "Life's", tipoReceita: "pontual", valorp: 1000, status: "entregue", servico: "Creators Pontual", dataInicio: "2026-03-01" }),
    // Dily: 1 entregue + 3 em triagem → LTV só a entregue, LT = 1 mês (1 entregue)
    row({ idTask: "P3", nome: "Dily", tipoReceita: "pontual", valorp: 14000, status: "entregue", servico: "1ª Entrega - Creators", dataInicio: "2026-03-16" }),
    row({ idTask: "P3", nome: "Dily", tipoReceita: "pontual", valorp: 14000, status: "triagem", servico: "2ª Entrega - Creators", dataInicio: "2026-03-30" }),
    row({ idTask: "P3", nome: "Dily", tipoReceita: "pontual", valorp: 14000, status: "triagem", servico: "3ª Entrega - Creators", dataInicio: "2026-03-30" }),
    row({ idTask: "P3", nome: "Dily", tipoReceita: "pontual", valorp: 14000, status: "triagem", servico: "4ª Entrega - Creators", dataInicio: "2026-03-30" }),
    row({ idTask: "R1", nome: "Loja Byr", tipoReceita: "recorrente", valorr: 1000, ltMeses: 4, ltvRecorrente: 4000, isChurned: true, status: "cancelado/inativo", dataInicio: "2026-01-01", dataFim: "2026-05-01" }),
  ];
  it("LTV/LT pontual contam só entregas entregues; entregas detalhadas preservadas", () => {
    const cli = buildClientesDetalhe(rows, "pontual", { hoje: "2026-06-21" });
    expect(cli).toHaveLength(3);
    const cacow = cli.find((c) => c.idTask === "P1")!;
    expect(cacow.nome).toBe("Cacow");
    expect(cacow.ltv).toBe(11000);   // 2 entregues
    expect(cacow.ltMeses).toBe(2);   // 2 entregues = 2 meses
    expect(cacow.nEntregas).toBe(2);
    expect(cacow.entregas[0].servico).toBe("1ª Entrega - Creators"); // ordenado por data
  });
  it("caso Dily: 1 de 4 entregue → LTV = R$14.000 (não R$56.000), LT null (única)", () => {
    const cli = buildClientesDetalhe(rows, "pontual", { hoje: "2026-06-21" });
    const dily = cli.find((c) => c.idTask === "P3")!;
    expect(dily.ltv).toBe(14000);    // só a 1ª entrega (entregue); as 3 em triagem não contam
    expect(dily.ltMeses).toBeNull(); // 1 entregue (única) → fora do LT
    expect(dily.nEntregas).toBe(4);  // todas as entregas aparecem na auditoria
    expect(dily.entregas).toHaveLength(4);
  });
  it("ordena por LTV desc e calcula LTV recorrente realizado", () => {
    const cli = buildClientesDetalhe(rows, "recorrente", { hoje: "2026-06-21" });
    expect(cli).toHaveLength(1);
    expect(cli[0].nome).toBe("Loja Byr");
    expect(cli[0].ltv).toBe(4000);          // ltv_recorrente
    expect(cli[0].estado).toBe("cancelado");
  });
});

describe("buildEvolucaoClientes", () => {
  const rows: EvoSnapRow[] = [
    { idTask: "A", nome: "Cli A", status: "ativo", valorr: 1000, valorp: 0, servico: "Gestão", dataInicio: "2026-01-01" },
    { idTask: "B", nome: "Cli B", status: "cancelado/inativo", valorr: 2000, valorp: 0, servico: "Gestão", dataInicio: "2026-01-01" },
    { idTask: "P", nome: "Pont", status: "entregue", valorr: 0, valorp: 5000, servico: "1ª Entrega", dataInicio: "2026-02-01" },
    { idTask: "Q", nome: "Q2", status: "entregue", valorr: 0, valorp: 3000, servico: "1ª Entrega", dataInicio: "2026-01-01" },
    { idTask: "Q", nome: "Q2", status: "entregue", valorr: 0, valorp: 3000, servico: "2ª Entrega", dataInicio: "2026-03-01" },
  ];
  it("recorrente: LT = idade da base; LTV = valorr × idade; filtra por estado", () => {
    const todos = buildEvolucaoClientes(rows, "recorrente", "ambos", "2026-04-01");
    expect(todos).toHaveLength(2);          // A e B (P/Q são pontuais)
    const a = todos.find((c) => c.idTask === "A")!;
    expect(a.estado).toBe("ativo");
    expect(a.ltMeses).toBeCloseTo(2.96, 1); // jan→abr
    expect(a.ltv).toBeGreaterThan(0);       // 1000 × idade
    const ativos = buildEvolucaoClientes(rows, "recorrente", "ativo", "2026-04-01");
    expect(ativos.map((c) => c.idTask)).toEqual(["A"]); // B (cancelado) fora
  });
  it("pontual: entrega única → LT null; 2+ entregas → LT = nº; LTV sempre realizado", () => {
    const cli = buildEvolucaoClientes(rows, "pontual", "ambos", "2026-04-01");
    expect(cli).toHaveLength(2);            // P e Q
    const p = cli.find((c) => c.idTask === "P")!;
    expect(p.ltMeses).toBeNull();          // entrega única → fora do LT
    expect(p.ltv).toBe(5000);              // LTV ainda conta
    const q = cli.find((c) => c.idTask === "Q")!;
    expect(q.ltMeses).toBe(2);             // 2 entregues
    expect(q.ltv).toBe(6000);
  });
});

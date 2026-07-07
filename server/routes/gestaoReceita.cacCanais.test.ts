// server/routes/gestaoReceita.cacCanais.test.ts
import { describe, expect, it } from "vitest";
import { agregarCacCanais, CAC_CANAIS, contratosDoDeal } from "./gestaoReceita.cacCanais";

const JUN = [6];
const MAI_JUN = [5, 6];

describe("agregarCacCanais", () => {
  it("agrupa sources no macro-canal e soma clientes do período", () => {
    const out = agregarCacCanais(
      [
        { source: "WEBFORM", mes: 6, clientes: 4 },
        { source: "ADVERTISING", mes: 6, clientes: 2 },
        { source: "UC_YWZVA2", mes: 6, clientes: 3 },
      ],
      [],
      JUN,
    );
    const inbound = out.canais.find((c) => c.id === "inbound")!;
    const outbound = out.canais.find((c) => c.id === "outbound")!;
    expect(inbound.clientes).toBe(6);
    expect(outbound.clientes).toBe(3);
  });

  it("ignora sources fora do catálogo (ex.: sem origem)", () => {
    const out = agregarCacCanais([{ source: "(não informado)", mes: 6, clientes: 9 }], [], JUN);
    expect(out.geral.clientes).toBe(0);
  });

  it("soma custo manual dos meses do período; sem edição = 0", () => {
    const out = agregarCacCanais(
      [],
      [
        { chave: "cac_canal:outbound:time", mes: 5, valor: 14000 },
        { chave: "cac_canal:outbound:time", mes: 6, valor: 1000 },
        { chave: "cac_canal:outbound:ferramentas", mes: 6, valor: 1800 },
      ],
      MAI_JUN,
    );
    const outbound = out.canais.find((c) => c.id === "outbound")!;
    expect(outbound.itens.find((i) => i.id === "time")!.valor).toBe(15000);
    expect(outbound.itens.find((i) => i.id === "ferramentas")!.valor).toBe(1800);
    expect(outbound.custoTotal).toBe(16800);
    const evento = out.canais.find((c) => c.id === "evento")!;
    expect(evento.custoTotal).toBe(0);
  });

  it("incentivo automático: unit default 1000 × clientes, mês a mês, com override por mês", () => {
    const out = agregarCacCanais(
      [
        { source: "RC_GENERATOR", mes: 5, clientes: 2 },
        { source: "RC_GENERATOR", mes: 6, clientes: 1 },
      ],
      [{ chave: "cac_canal_unit:indique_ganhe", mes: 6, valor: 500 }],
      MAI_JUN,
    );
    const ig = out.canais.find((c) => c.id === "indique_ganhe")!;
    // mai: 1000 × 2 + jun: 500 × 1
    expect(ig.incentivo!.total).toBe(2500);
    expect(ig.incentivo!.qtd).toBe(3);
    expect(ig.custoTotal).toBe(2500);
    expect(ig.cacCliente).toBe(Math.round(2500 / 3));
  });

  it("cacCliente null quando clientes = 0 (Parceria sem source)", () => {
    const out = agregarCacCanais([], [{ chave: "cac_canal:parceria:time_resp", mes: 6, valor: 4000 }], JUN);
    const parceria = out.canais.find((c) => c.id === "parceria")!;
    expect(parceria.clientes).toBe(0);
    expect(parceria.custoTotal).toBe(4000);
    expect(parceria.cacCliente).toBeNull();
  });

  it("geral = Σ custos ÷ Σ clientes dos 10 canais", () => {
    const out = agregarCacCanais(
      [
        { source: "WEBFORM", mes: 6, clientes: 6 },
        { source: "UC_YWZVA2", mes: 6, clientes: 3 },
      ],
      [
        { chave: "cac_canal:outbound:time", mes: 6, valor: 14000 },
        { chave: "cac_canal:outbound:ferramentas", mes: 6, valor: 1800 },
      ],
      JUN,
      { ads_spend: { 6: 29500 } },
    );
    expect(out.geral.clientes).toBe(9);
    expect(out.geral.custoTotal).toBe(45300);
    expect(out.geral.cac).toBe(Math.round(45300 / 9));
  });

  it("item automático (ads_spend): soma a série mensal, ignora override manual e marca fonte", () => {
    const out = agregarCacCanais(
      [{ source: "WEBFORM", mes: 6, clientes: 2 }],
      [{ chave: "cac_canal:inbound:anuncios", mes: 6, valor: 999999 }],
      MAI_JUN,
      { ads_spend: { 5: 10000, 6: 19500 } },
    );
    const inbound = out.canais.find((c) => c.id === "inbound")!;
    const anuncios = inbound.itens.find((i) => i.id === "anuncios")!;
    expect(anuncios.valor).toBe(29500); // 10000 + 19500; override 999999 ignorado
    expect(anuncios.fonte).toBe("auto");
    expect(inbound.custoTotal).toBe(29500);
    const outbound = out.canais.find((c) => c.id === "outbound")!;
    expect(outbound.itens.every((i) => i.fonte === "manual")).toBe(true);
  });

  it("retorna sempre todos os canais do catálogo na ordem", () => {
    const out = agregarCacCanais([], [], JUN);
    expect(out.canais.map((c) => c.id)).toEqual(CAC_CANAIS.map((c) => c.id));
  });

  it("fusão inbound: pago + orgânico agora somam no único canal 'inbound'", () => {
    const out = agregarCacCanais(
      [
        { source: "WEBFORM", mes: 6, clientes: 2 },   // era inbound_pago
        { source: "WEB", mes: 6, clientes: 3 },        // era inbound_organico
        { source: "CALL", mes: 6, clientes: 1 },       // era inbound_organico
      ],
      [],
      JUN,
    );
    expect(out.canais.find((c) => c.id === "inbound_pago")).toBeUndefined();
    expect(out.canais.find((c) => c.id === "inbound_organico")).toBeUndefined();
    expect(out.canais.find((c) => c.id === "inbound")!.clientes).toBe(6);
  });

  it("CAC por contrato: divide o custo pelo nº de contratos (serviços vendidos) do canal", () => {
    const out = agregarCacCanais(
      [
        { source: "UC_YWZVA2", mes: 6, clientes: 1, contratos: 3 }, // outbound: 1 deal, 3 serviços
        { source: "UC_YWZVA2", mes: 6, clientes: 1, contratos: 1 },
      ],
      [{ chave: "cac_canal:outbound:time", mes: 6, valor: 8000 }],
      JUN,
    );
    const outbound = out.canais.find((c) => c.id === "outbound")!;
    expect(outbound.clientes).toBe(2);
    expect(outbound.contratos).toBe(4);
    expect(outbound.cacCliente).toBe(4000);  // 8000 / 2
    expect(outbound.cacContrato).toBe(2000); // 8000 / 4 — sempre ≤ CAC/cliente
    expect(out.geral.contratos).toBe(4);
    expect(out.geral.cacContrato).toBe(2000);
  });

  it("cacContrato null quando o canal não tem contratos", () => {
    const out = agregarCacCanais([{ source: "UC_YWZVA2", mes: 6, clientes: 0, contratos: 0 }], [], JUN);
    expect(out.canais.find((c) => c.id === "outbound")!.cacContrato).toBeNull();
  });
});

describe("contratosDoDeal (régua do BP: 1 serviço vendido = 1 contrato)", () => {
  it("conta 1 por serviço vendido mapeado (deal com N serviços → N)", () => {
    // 846=Performance(rec), 852=Creators(rec), 868=E-commerce(pont)
    expect(contratosDoDeal("[846,852,868]", 5000, 2000)).toBe(3);
  });
  it("conta repetições do mesmo segmento", () => {
    expect(contratosDoDeal("[846,846]", 5000, 0)).toBe(2);
  });
  it("piso 1 para deal ganho sem serviço mapeado (com ou sem valor)", () => {
    expect(contratosDoDeal(null, 5000, 0)).toBe(1);
    expect(contratosDoDeal("[]", 0, 0)).toBe(1);
    expect(contratosDoDeal("False", 0, 3000)).toBe(1);
  });
});

// server/routes/gestaoReceita.cacCanais.test.ts
import { describe, expect, it } from "vitest";
import { agregarCacCanais, CAC_CANAIS } from "./gestaoReceita.cacCanais";

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

  it("CAC por contrato: contratos vêm do cup_contratos (contratosCanalMes), não dos deals", () => {
    const out = agregarCacCanais(
      [
        { source: "UC_YWZVA2", mes: 6, clientes: 1 }, // outbound: 2 clientes (deals)
        { source: "UC_YWZVA2", mes: 6, clientes: 1 },
      ],
      [{ chave: "cac_canal:outbound:time", mes: 6, valor: 8000 }],
      JUN,
      {},
      { outbound: { 6: 4 } }, // 4 contratos ClickUp casados ao canal via cnpj
    );
    const outbound = out.canais.find((c) => c.id === "outbound")!;
    expect(outbound.clientes).toBe(2);
    expect(outbound.contratos).toBe(4);
    expect(outbound.cacCliente).toBe(4000);  // 8000 / 2
    expect(outbound.cacContrato).toBe(2000); // 8000 / 4
    expect(out.geral.contratos).toBe(4);
    expect(out.geral.cacContrato).toBe(2000);
  });

  it("contratosCanalMes soma os meses do período (multi-mês)", () => {
    const out = agregarCacCanais(
      [{ source: "UC_YWZVA2", mes: 5, clientes: 1 }, { source: "UC_YWZVA2", mes: 6, clientes: 1 }],
      [],
      MAI_JUN,
      {},
      { outbound: { 5: 3, 6: 2 } },
    );
    expect(out.canais.find((c) => c.id === "outbound")!.contratos).toBe(5);
    expect(out.geral.contratos).toBe(5);
  });

  it("sem piso 1: canal com clientes>0 e contratos=0 (venda sem contrato no mês) → cacContrato null, cacCliente definido", () => {
    // caso real: Social Selling jun/2026 — 1 deal ganho, 0 contratos criados no ClickUp
    const out = agregarCacCanais(
      [{ source: "UC_4VCKGM", mes: 6, clientes: 1 }],
      [{ chave: "cac_canal:social_selling:anuncios_dist", mes: 6, valor: 3000 }],
      JUN,
      {},
      {}, // nenhum contrato casado a social_selling
    );
    const ss = out.canais.find((c) => c.id === "social_selling")!;
    expect(ss.clientes).toBe(1);
    expect(ss.contratos).toBe(0);
    expect(ss.cacCliente).toBe(3000);
    expect(ss.cacContrato).toBeNull();
  });

  it("cacContrato null quando o canal não tem contratos", () => {
    const out = agregarCacCanais([{ source: "UC_YWZVA2", mes: 6, clientes: 1 }], [], JUN);
    expect(out.canais.find((c) => c.id === "outbound")!.cacContrato).toBeNull();
  });
});

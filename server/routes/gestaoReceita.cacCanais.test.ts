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
    const inbound = out.canais.find((c) => c.id === "inbound_pago")!;
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
      [{ chave: "cac_canal:inbound_pago:anuncios", mes: 6, valor: 999999 }],
      MAI_JUN,
      { ads_spend: { 5: 10000, 6: 19500 } },
    );
    const inbound = out.canais.find((c) => c.id === "inbound_pago")!;
    const anuncios = inbound.itens.find((i) => i.id === "anuncios")!;
    expect(anuncios.valor).toBe(29500); // 10000 + 19500; override 999999 ignorado
    expect(anuncios.fonte).toBe("auto");
    expect(inbound.custoTotal).toBe(29500);
    const outbound = out.canais.find((c) => c.id === "outbound")!;
    expect(outbound.itens.every((i) => i.fonte === "manual")).toBe(true);
  });

  it("retorna sempre os 10 canais na ordem do catálogo", () => {
    const out = agregarCacCanais([], [], JUN);
    expect(out.canais.map((c) => c.id)).toEqual(CAC_CANAIS.map((c) => c.id));
  });
});

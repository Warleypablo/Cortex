import { describe, it, expect } from "vitest";
import {
  buildMetaAdsMetrics, buildGoogleAdsMetrics, buildTiktokAdsMetrics,
  buildFunnelMetrics, buildMqlMetrics, buildNaoMqlMetrics,
  calcPercentual, mergePrevRealizado, fcaKindInv,
  DEFAULT_ORCADO_META_ADS, DEFAULT_ORCADO_MQL, DEFAULT_ORCADO_NAO_MQL,
  type Metric, type MetaAdsDetailMetrics, type PlatformFunnelData,
  type MQLMetrics, type NaoMQLMetrics,
} from "./aprofundado";

// Fixture fixo (aprox. Creators × Meta, jan 1-7): trava o comportamento dos builders.
// Se estes números mudarem sem intenção, o FCA e a tela divergiram — o teste falha.
const META: MetaAdsDetailMetrics = {
  investimento: 24959.21, impressoes: 280000, alcance: 0, frequencia: 0,
  cpm: 88.84, ctr: 0.0078, ctrUnico: 0.0079, videoHook: 0, videoHold: 0,
  videoP75: 0, videoP100: 0, visualizacoesPagina: 5098, sessoes: 2602,
  connectRatePixel: 0.8714, visualizacoesPaginaPixel: 1911,
};
const FUNNEL: PlatformFunnelData = {
  leads: 253, mqls: 118, cpl: null, cpmql: null, percMqls: 0.4664,
  ra: 0, raMql: 0, raNmql: 0, rr: 0, rrMql: 0, rrNmql: 0,
  percRa: 0, percRaMql: 0, percRaNmql: 0, percRr: 0, percRrMql: 0, percRrNmql: 0,
  percRrVendas: 0, percRrMqlVendas: 0, percRrNmqlVendas: 0,
  negocioGanho: 0, leadTime: null, aov: null,
  receita: null, receitaPontual: null, receitaRecorrente: null,
  cac: null, cacUnico: null, cacContrato: null, clientesUnicos: 0, contratos: 0,
};
const ORCADO = { ...DEFAULT_ORCADO_META_ADS, investimento: 126000, cpm: 75, ctr: 0.008,
  visualizacoesPagina: 11424, connectRate: 0.85, taxaConversaoPagina: 0.16,
  leads: 1822, mqls: 820, cpl: 69, cpmql: 154, percMqls: 0.45 };

const row = (ms: Metric[], id: string) => ms.find(m => m.id === id)!;

describe("calcPercentual", () => {
  it("null quando orçado é 0/null", () => {
    expect(calcPercentual(0, 10)).toBeNull();
    expect(calcPercentual(null, 10)).toBeNull();
    expect(calcPercentual(100, null)).toBeNull();
  });
  it("razão × 100", () => {
    expect(calcPercentual(200, 50)).toBe(25);
  });
});

describe("buildMetaAdsMetrics — pixel é a base (regressão do bug do FCA)", () => {
  const ms = buildMetaAdsMetrics(META, FUNNEL, ORCADO);

  it("Visualizações usa o PIXEL, não o landing_page_views cru", () => {
    // Bug que motivou a fonte única: FCA lia visualizacoesPagina (5098) em vez de
    // visualizacoesPaginaPixel (1911). Trava no pixel.
    expect(row(ms, "meta_visualizacoesPagina").realizado).toBe(1911);
    expect(row(ms, "meta_visualizacoesPagina").realizado).not.toBe(5098);
  });

  it("Connect Rate usa connectRatePixel", () => {
    expect(row(ms, "meta_connectRate").realizado).toBe(0.8714);
  });

  it("Tx Conversão da Página (Visualização) = leads ÷ LPV pixel", () => {
    expect(row(ms, "meta_taxaConversaoPagina").realizado).toBeCloseTo(253 / 1911, 10);
  });

  it("Leads/MQLs vêm do funnel-by-platform (não de mql+nmql)", () => {
    expect(row(ms, "meta_leads").realizado).toBe(253);
    expect(row(ms, "meta_mqls").realizado).toBe(118);
  });

  it("CPL/CPMQL derivam do investimento do próprio detail", () => {
    expect(row(ms, "meta_cpl").realizado).toBeCloseTo(24959.21 / 253, 6);
    expect(row(ms, "meta_cpmql").realizado).toBeCloseTo(24959.21 / 118, 6);
  });

  it("% MQLs vem do funnel", () => {
    expect(row(ms, "meta_percMqls").realizado).toBe(0.4664);
  });

  it("orçado é MENSAL (não escalado para 7 dias)", () => {
    expect(row(ms, "meta_investimento").orcado).toBe(126000);
    expect(row(ms, "meta_cpmql").orcado).toBe(154);
  });

  it("emite warning de pixel quando sub-captura (<40% das sessões)", () => {
    const subcap = buildMetaAdsMetrics(
      { ...META, visualizacoesPaginaPixel: 400, sessoes: 2602 }, FUNNEL, ORCADO,
    );
    expect(row(subcap, "meta_visualizacoesPagina").warning).toBeTruthy();
    // Saudável (1911/2602 ≈ 73%) → sem warning
    expect(row(ms, "meta_visualizacoesPagina").warning).toBeUndefined();
  });
});

describe("buildFunnelMetrics — CPL/CPMQL só com investimento", () => {
  it("null quando não há verba (orgânico)", () => {
    const ms = buildFunnelMetrics("x", FUNNEL, ORCADO, null);
    expect(row(ms, "x_cpl").realizado).toBeNull();
    expect(row(ms, "x_cpmql").realizado).toBeNull();
  });
  it("includeInvestimento emite a linha de investimento", () => {
    const ms = buildFunnelMetrics("x", FUNNEL, ORCADO, 1000, true);
    expect(row(ms, "x_investimento").realizado).toBe(1000);
  });
});

describe("Google/TikTok Ads — sem pixel, Tx Conversão por Sessões", () => {
  it("Google usa visualizacoesPagina cru e sessões", () => {
    const ms = buildGoogleAdsMetrics(
      { investimento: 1000, impressoes: 0, cliques: 0, cpm: 10, cpc: 0, ctr: 0.01,
        visualizacoesPagina: 500, connectRate: 0, conversoes: 0, valorConversoes: 0,
        custoConversao: 0, sessoes: 400 } as any, FUNNEL, { ...DEFAULT_ORCADO_META_ADS },
    );
    expect(row(ms, "gads_visualizacoesPagina").realizado).toBe(500);
    expect(row(ms, "gads_taxaConversaoPagina").realizado).toBeCloseTo(253 / 400, 10);
  });
  it("TikTok usa connectRate nativo", () => {
    const ms = buildTiktokAdsMetrics(
      { investimento: 1000, impressoes: 0, cliques: 100, conversoes: 0, cpm: 10,
        ctr: 0.01, visualizacoesPagina: 80, sessoes: 90, connectRate: 0.8,
        hasConnection: true }, FUNNEL, { ...DEFAULT_ORCADO_META_ADS },
    );
    expect(row(ms, "tta_connectRate").realizado).toBe(0.8);
  });
});

describe("buildMqlMetrics / buildNaoMqlMetrics", () => {
  const MQL: MQLMetrics = {
    totalMqls: 118, reunioesAgendadas: 40, reunioesRealizadas: 30, novosClientes: 5,
    contratosAceleracao: 3, contratosImplantacao: 2, faturamentoAceleracao: 12000,
    faturamentoImplantacao: 17000, faturamentoAceleracaoTrafego: 0,
    faturamentoImplantacaoTrafego: 0, percReuniaoAgendada: 0.34, percNoShow: 0.05,
    taxaVendas: 0.3, txContratosRecorrentes: 0.6, txContratosImplantacao: 0.45,
    ticketMedioAceleracao: 4000, ticketMedioImplantacao: 8500, dealsGanhos: 5, contratosGanhos: 5,
  };
  it("CPRA/CPRR MQL derivam do investimento", () => {
    const ms = buildMqlMetrics(MQL, DEFAULT_ORCADO_MQL, 24959.21);
    expect(row(ms, "mql_cpra").realizado).toBeCloseTo(24959.21 / 40, 6);
    expect(row(ms, "mql_cprr").realizado).toBeCloseTo(24959.21 / 30, 6);
  });
  it("Faturamento Total MQL = aceleração + implantação", () => {
    const ms = buildMqlMetrics(MQL, DEFAULT_ORCADO_MQL, null);
    expect(row(ms, "mql_fat_total").realizado).toBe(29000);
  });
  it("Não-MQL espelha o mesmo shape", () => {
    const NMQL: NaoMQLMetrics = { ...MQL, totalNaoMqls: 135 } as any;
    const ms = buildNaoMqlMetrics(NMQL, DEFAULT_ORCADO_NAO_MQL, 1000);
    expect(row(ms, "nmql_cpra").realizado).toBeCloseTo(1000 / 40, 6);
  });
});

describe("fcaKindInv — classificação para as colunas da imagem", () => {
  const ms = buildMetaAdsMetrics(META, FUNNEL, ORCADO);
  const kindOf = (id: string) => fcaKindInv(row(ms, id));
  it("absolutos → abs, sem inv", () => {
    expect(kindOf("meta_investimento")).toEqual({ kind: "abs", inv: false });
    expect(kindOf("meta_visualizacoesPagina")).toEqual({ kind: "abs", inv: false });
    expect(kindOf("meta_leads")).toEqual({ kind: "abs", inv: false });
    expect(kindOf("meta_mqls")).toEqual({ kind: "abs", inv: false });
  });
  it("custos → rate + inv (menor é melhor)", () => {
    expect(kindOf("meta_cpm")).toEqual({ kind: "rate", inv: true });
    expect(kindOf("meta_cpl")).toEqual({ kind: "rate", inv: true });
    expect(kindOf("meta_cpmql")).toEqual({ kind: "rate", inv: true });
  });
  it("taxas → pct", () => {
    expect(kindOf("meta_ctr")).toEqual({ kind: "pct", inv: false });
    expect(kindOf("meta_connectRate")).toEqual({ kind: "pct", inv: false });
    expect(kindOf("meta_percMqls")).toEqual({ kind: "pct", inv: false });
  });
});

describe("mergePrevRealizado", () => {
  it("anexa realizadoAnterior por id", () => {
    const cur = buildMetaAdsMetrics(META, FUNNEL, ORCADO);
    const prev = buildMetaAdsMetrics({ ...META, investimento: 100 }, FUNNEL, ORCADO);
    const merged = mergePrevRealizado(cur, prev);
    expect(row(merged, "meta_investimento").realizadoAnterior).toBe(100);
  });
});

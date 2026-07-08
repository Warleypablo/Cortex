import { describe, it, expect } from "vitest";
import {
  formatarMoedaBR,
  formatarPercentBR,
  formatarMensagemResumo,
  agoraSaoPaulo,
  janelaAtual,
  type MetricasResumo,
} from "./resumoLideres";

// Números da mensagem real de 02/07 19h (base % = MRR junho R$ 1.197.868)
const METRICAS: MetricasResumo = {
  mrrTotal: 1139573,
  mrrAtivo: 983497,
  entregaPontual: 15497,
  estoquePontualInicioMes: 550000, // ilustrativo — base do % de churn pontual
  churnPontual: 5500,
  churnPontualAjustado: 5500,
  churnPontualPct: (5500 / 550000) * 100, // 1,00%
  churnPontualAjustadoPct: (5500 / 550000) * 100, // 1,00%
  mrrMesAnterior: 1197868,
  churnTotal: 19279,
  churnTotalPct: (19279 / 1197868) * 100, // 1,61%
  churnAjustado: 16282,
  churnAjustadoPct: (16282 / 1197868) * 100, // 1,36%
  crossR: 0,
  crossP: 6300,
  crossPAmortizado: 1260,
  crossTotal: 1260,
  netChurn: 15022, // churnAjustado - crossTotal
  netChurnPct: (15022 / 1197868) * 100, // 1,25%
};

const MENSAGEM_ESPERADA = `Boa NOITE líderes!!!
Atualizações sobre nossas métricas principais, dia *02/07, 19h*.


MRR JULHO TOTAL: R$ 1.139.573,00
MRR JULHO ATIVO: R$ 983.497,00
Entrega Pontual JULHO: R$ 15.497,00

Churn Pontual JULHO: R$ 5.500,00 - *1,00%*
Churn Pontual JULHO (sem erro de venda, não começou e inadimplente 1 mês): R$ 5.500,00 - *1,00%*
(% sobre o estoque pontual em aberto no início do mês: R$ 550.000,00)

MRR JUNHO: R$ 1.197.868,00

Churn MRR TOTAL: R$ 19.279,00 - *1,61%*
Churn MRR (sem erro de venda, não começou e inadimplente 1 mês): R$ 16.282,00 - *1,36%*

Cross R: ZERO
Cross P: R$ 6.300,00 / 5 = R$ 1.260,00
Total: R$ 1.260,00

Net Churn: R$ 15.022,00 - *1,25%*


estamos de 👀`;

describe("formatarMoedaBR", () => {
  it("formata inteiro com milhares e 2 casas", () => {
    expect(formatarMoedaBR(1139573)).toBe("R$ 1.139.573,00");
  });
  it("preserva centavos", () => {
    expect(formatarMoedaBR(218584.45)).toBe("R$ 218.584,45");
  });
});

describe("formatarPercentBR", () => {
  it("2 casas exatas, sem arredondar para inteiro", () => {
    expect(formatarPercentBR((19279 / 1197868) * 100)).toBe("1,61%");
    expect(formatarPercentBR((16282 / 1197868) * 100)).toBe("1,36%");
    expect(formatarPercentBR((15022 / 1197868) * 100)).toBe("1,25%");
  });
});

describe("formatarMensagemResumo", () => {
  it("reproduz a mensagem modelo de 02/07 19h exatamente", () => {
    const msg = formatarMensagemResumo(METRICAS, {
      dataFmt: "02/07",
      horaFmt: "19h",
      hora: 19,
      mes: 7,
    });
    expect(msg).toBe(MENSAGEM_ESPERADA);
  });

  it("saudação dinâmica: manhã = Bom DIA, tarde = Boa TARDE", () => {
    const manha = formatarMensagemResumo(METRICAS, { dataFmt: "03/07", horaFmt: "10h", hora: 10, mes: 7 });
    expect(manha.startsWith("Bom DIA líderes!!!")).toBe(true);
    const tarde = formatarMensagemResumo(METRICAS, { dataFmt: "03/07", horaFmt: "15h", hora: 15, mes: 7 });
    expect(tarde.startsWith("Boa TARDE líderes!!!")).toBe(true);
  });

  it("cross zerado dos dois lados vira ZERO sem fórmula", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossR: 0, crossP: 0, crossPAmortizado: 0, crossTotal: 0 },
      { dataFmt: "03/07", horaFmt: "10h", hora: 10, mes: 7 },
    );
    expect(msg).toContain("Cross R: ZERO\nCross P: ZERO\nTotal: R$ 0,00");
  });

  it("virada de ano: mês anterior de janeiro é DEZEMBRO", () => {
    const msg = formatarMensagemResumo(METRICAS, { dataFmt: "05/01", horaFmt: "10h", hora: 10, mes: 1 });
    expect(msg).toContain("MRR JANEIRO TOTAL:");
    expect(msg).toContain("MRR DEZEMBRO: R$ 1.197.868,00");
  });
});

describe("janelaAtual", () => {
  it("10h-12h é janela 10h; 19h-21h é janela 19h; resto é null", () => {
    expect(janelaAtual(9)).toBeNull();
    expect(janelaAtual(10)).toBe("10h");
    expect(janelaAtual(11)).toBe("10h");
    expect(janelaAtual(12)).toBeNull();
    expect(janelaAtual(18)).toBeNull();
    expect(janelaAtual(19)).toBe("19h");
    expect(janelaAtual(20)).toBe("19h");
    expect(janelaAtual(21)).toBeNull();
  });
});

describe("agoraSaoPaulo", () => {
  it("converte UTC para São Paulo (UTC-3)", () => {
    // 2026-06-25 13:00 UTC = 10:00 em São Paulo (quinta-feira)
    const sp = agoraSaoPaulo(new Date("2026-06-25T13:00:00Z"));
    expect(sp).toEqual({
      dataRef: "2026-06-25",
      dataFmt: "25/06",
      hora: 10,
      horaFmt: "10h",
      diaSemana: 4,
      mes: 6,
    });
  });
  it("vira o dia corretamente (02h UTC = 23h SP do dia anterior)", () => {
    expect(agoraSaoPaulo(new Date("2026-07-02T02:00:00Z")).dataRef).toBe("2026-07-01");
    expect(agoraSaoPaulo(new Date("2026-07-02T02:00:00Z")).hora).toBe(23);
  });
});

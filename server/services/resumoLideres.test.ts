import { describe, it, expect } from "vitest";
import {
  formatarMoedaBR,
  formatarPercentBR,
  formatarMensagemResumo,
  agoraSaoPaulo,
  type MetricasResumo,
} from "./resumoLideres";

// Números da mensagem real de 25/06 (base % = MRR início de junho R$ 1.030.229,30)
const METRICAS: MetricasResumo = {
  mrrAtivo: 1150674,
  entregaPontual: 218584.45,
  churn: 148077,
  churnPct: (148077 / 1030229.3) * 100, // 14,37%
  emCancelamento: 111524,
  crossR: 43947,
  crossP: 55455,
  crossPAmortizado: 11091,
  crossTotal: 55038,
  netChurn: 93039,
  netChurnPct: (93039 / 1030229.3) * 100, // 9,03%
  mrrInicioMes: 1030229.3,
};

const MENSAGEM_ESPERADA = `Bom dia líderes!!!
Atualizações sobre nossas métricas principais, dia 25/06, 10h.

MRR: R$ 1.150.674,00
Entrega Pontual: R$ 218.584,45

Churn: R$ 148.077,00 - *14,37%*
Em cancelamento: R$ 111.524,00

Cross R: R$ 43.947,00
Cross P: R$ 55.455,00 / 5 = R$ 11.091,00
Total: R$ 43.947,00 + R$ 11.091,00 = R$ 55.038,00

Net Churn: R$ 93.039,00 - *9,03%*

*OBS 1: Bora buscar mais cross*
*OBS 2: Bora reter*
*OBS 3: Não sai mais ninguém*`;

describe("formatarMoedaBR", () => {
  it("formata inteiro com milhares e 2 casas", () => {
    expect(formatarMoedaBR(1150674)).toBe("R$ 1.150.674,00");
  });
  it("preserva centavos", () => {
    expect(formatarMoedaBR(218584.45)).toBe("R$ 218.584,45");
  });
});

describe("formatarPercentBR", () => {
  it("2 casas exatas, sem arredondar para inteiro", () => {
    expect(formatarPercentBR((93039 / 1030229.3) * 100)).toBe("9,03%");
    expect(formatarPercentBR((148077 / 1030229.3) * 100)).toBe("14,37%");
  });
});

describe("formatarMensagemResumo", () => {
  it("reproduz a mensagem real de 25/06 exatamente", () => {
    const msg = formatarMensagemResumo(METRICAS, { dataFmt: "25/06", horaFmt: "10h" });
    expect(msg).toBe(MENSAGEM_ESPERADA);
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
    });
  });
  it("vira o dia corretamente (02h UTC = 23h SP do dia anterior)", () => {
    expect(agoraSaoPaulo(new Date("2026-07-02T02:00:00Z")).dataRef).toBe("2026-07-01");
    expect(agoraSaoPaulo(new Date("2026-07-02T02:00:00Z")).hora).toBe(23);
  });
});

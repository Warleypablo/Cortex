import { describe, it, expect } from "vitest";
import {
  formatarMoedaBR,
  formatarPercentBR,
  formatarMensagemResumo,
  agoraSaoPaulo,
  janelaAtual,
  type MetricasResumo,
} from "./resumoLideres";

// Números do modelo de referência de 18/07 (base % de MRR = MRR junho R$ 1.137.868;
// base % pontual = estoque pontual em aberto no início do mês R$ 2.090.519,35).
const METRICAS: MetricasResumo = {
  mrrAdicionado: 42310,
  pontualVendido: 118500,
  carteiraTriagemOnboarding: 150789.28,
  carteiraAtivo: 1069598,
  carteiraEmCancelamento: 96805,
  mrrAtivo: 1220387.28,
  mrrOperando: 1317192.28,
  entregaPontual: 169293.45,
  mrrMesAnterior: 1137868,
  estoquePontualInicioMes: 2090519.35,
  churnTotal: 67030,
  churnTotalPct: (67030 / 1137868) * 100, // 5,89%
  churnAjustado: 43314,
  churnAjustadoPct: (43314 / 1137868) * 100, // 3,81%
  churnPontual: 171272,
  churnPontualPct: (171272 / 2090519.35) * 100, // 8,19%
  churnPontualAjustado: 91973,
  churnPontualAjustadoPct: (91973 / 2090519.35) * 100, // 4,40%
  crossR: 5997,
  crossP: 10300,
  crossTotal: 16297, // sem amortização
  netChurn: 37317, // churnAjustado − crossR
  netChurnPct: (37317 / 1137868) * 100, // 3,28%
  netChurnBruto: 61033, // churnTotal − crossR
  netChurnBrutoPct: (61033 / 1137868) * 100, // 5,36%
  // Calculado mas não exibido na v3 (mantido para o payload de /preview)
  churnBrutoSemAbono: 55000,
  churnBrutoSemAbonoPct: (55000 / 1137868) * 100,
};

const MENSAGEM_ESPERADA = `☀️ Boa tarde, líderes!

Atualização das principais métricas
18/07 • 13h

━━━━━━━━━━━━━━━

💰 Receita (Julho)

Novas Vendas
📈 MRR Adicionado: R$ 42.310,00
📦 Pontual Vendido: R$ 118.500,00

📌 Considera apenas vendas novas (sem Cross Sell e Upsell).

Carteira MRR
🟡 Triagem / Onboarding: R$ 150.789,28
🟢 Ativo: R$ 1.069.598,00
🟠 Em Cancelamento: R$ 96.805,00

📌 MRR Ativo: R$ 1.220.387,28
🚀 MRR Operando: R$ 1.317.192,28

📦 Entrega Pontual: R$ 169.293,45

📌 MRR Base Junho: R$ 1.137.868,00

💡 Legenda
• MRR Ativo: Triagem + Onboarding + Ativo.
• MRR Operando: Todos os status, exceto Pausado e Cancelado.

━━━━━━━━━━━━━━━

📉 Churn

💰 MRR
🔴 Total: R$ 67.030,00 (5,89%)
🟢 Ajustado: R$ 43.314,00 (3,81%)

📦 Pontual
🔴 Total: R$ 171.272,00 (8,19%)
🟢 Ajustado: R$ 91.973,00 (4,40%)

━━━━━━━━━━━━━━━

🔄 Cross Sell

💰 MRR: R$ 5.997,00
📦 Pontual: R$ 10.300,00

🏆 Total: R$ 16.297,00

━━━━━━━━━━━━━━━

🎯 Net Churn (MRR)

🟢 Ajustado

Churn Ajustado: R$ 43.314,00
➖ Cross Sell: R$ 5.997,00
🟰 R$ 37.317,00 (3,28%)

🔴 Bruto

Churn Total: R$ 67.030,00
➖ Cross Sell: R$ 5.997,00
🟰 R$ 61.033,00 (5,36%)

━━━━━━━━━━━━━━━

💡 Disclaimers

• MRR Adicionado e Pontual Vendido consideram apenas vendas novas, sem Cross Sell e Upsell.
• Churn Ajustado desconsidera erro de venda, clientes que não iniciaram e inadimplência de até 1 mês.
• O percentual do Churn Pontual é calculado sobre o estoque pontual em aberto no início do mês (R$ 2.090.519,35).
• Net Churn = Churn − Cross Sell.
• MRR Ativo = Triagem + Onboarding + Ativo.
• MRR Operando = Todos os status, exceto Pausado e Cancelado.

👀 Seguimos acompanhando diariamente os indicadores e atuando rapidamente sobre os principais desvios.`;

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
    expect(formatarPercentBR((67030 / 1137868) * 100)).toBe("5,89%");
    expect(formatarPercentBR((37317 / 1137868) * 100)).toBe("3,28%");
    expect(formatarPercentBR((171272 / 2090519.35) * 100)).toBe("8,19%");
  });
});

describe("formatarMensagemResumo", () => {
  it("reproduz o modelo v3 de 18/07 13h exatamente", () => {
    const msg = formatarMensagemResumo(METRICAS, {
      dataFmt: "18/07",
      horaFmt: "13h",
      hora: 13,
      mes: 7,
    });
    expect(msg).toBe(MENSAGEM_ESPERADA);
  });

  it("saudação por faixa horária, com emoji", () => {
    const manha = formatarMensagemResumo(METRICAS, { dataFmt: "18/07", horaFmt: "9h", hora: 9, mes: 7 });
    expect(manha.startsWith("🌞 Bom dia, líderes!")).toBe(true);
    const tarde = formatarMensagemResumo(METRICAS, { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 });
    expect(tarde.startsWith("☀️ Boa tarde, líderes!")).toBe(true);
    const noite = formatarMensagemResumo(METRICAS, { dataFmt: "18/07", horaFmt: "20h", hora: 20, mes: 7 });
    expect(noite.startsWith("🌙 Boa noite, líderes!")).toBe(true);
  });

  it("cross sell zerado sai formatado, não como ZERO", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossR: 0, crossP: 0, crossTotal: 0 },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).toContain("💰 MRR: R$ 0,00\n📦 Pontual: R$ 0,00");
    expect(msg).not.toContain("ZERO");
  });

  it("não exibe a régua de abonos", () => {
    const msg = formatarMensagemResumo(METRICAS, { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 });
    expect(msg).not.toContain("sem abonos");
    expect(msg).not.toContain("abonado no mês");
  });

  it("virada de ano: mês base de janeiro é Dezembro", () => {
    const msg = formatarMensagemResumo(METRICAS, { dataFmt: "05/01", horaFmt: "9h", hora: 9, mes: 1 });
    expect(msg).toContain("💰 Receita (Janeiro)");
    expect(msg).toContain("📌 MRR Base Dezembro: R$ 1.137.868,00");
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

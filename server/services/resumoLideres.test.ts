import { describe, it, expect, vi, beforeEach } from "vitest";

// calcularMetricasResumo faz I/O (db + metricsAdapter + crm/expansao) —
// mockado só para o describe do guard rail (item 5); as demais 28+ suítes
// deste arquivo testam funções puras e não são afetadas por este mock.
// vi.hoisted é necessário porque há três chamadas vi.mock neste arquivo (db +
// metricsAdapter + crm/expansao): sem isso, os `const` que os factories
// referenciam não ficam disponíveis no momento em que o hoisting do vi.mock
// os executa.
const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockGetMrrInicioMes: vi.fn(),
  mockVendasPorChannel: vi.fn(),
}));
const { mockExecute, mockGetMrrInicioMes, mockVendasPorChannel } = mocks;

vi.mock("../db", () => ({ db: { execute: mocks.mockExecute } }));
vi.mock("../okr2026/metricsAdapter", () => ({
  getMrrInicioMes: mocks.mockGetMrrInicioMes,
}));
vi.mock("../crm/expansao", () => ({
  vendasPorChannel: mocks.mockVendasPorChannel,
}));

import {
  formatarMoedaBR,
  formatarPercentBR,
  formatarMensagemResumo,
  agoraSaoPaulo,
  janelaAtual,
  derivarMetricas,
  calcularMetricasResumo,
  STATUS_ATIVO,
  STATUS_TRIAGEM_ONBOARDING,
  STATUS_EM_CANCELAMENTO,
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
  crossIndisponivel: false,
  vendasIndisponivel: false,
  baseSuspeita: false,
};

const MENSAGEM_ESPERADA = `☀️ Boa tarde, líderes!

Atualização das principais métricas
18/07 • 13h

━━━━━━━━━━━━━━━

💰 Receita (Julho)

Novas Vendas
📈 MRR Adicionado: R$ 42.310,00
📦 Pontual Vendido: R$ 118.500,00

📌 Considera os deals ganhos que não foram marcados como Expansão de Conta no CRM.

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
• MRR Operando: Triagem + Onboarding + Ativo + Em Cancelamento.

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

• MRR Adicionado e Pontual Vendido são os deals ganhos não marcados como Expansão de Conta no CRM; Cross Sell são os marcados. As duas linhas não se sobrepõem.
• Churn Ajustado desconsidera erro de venda, clientes que não iniciaram e inadimplência de até 1 mês.
• O percentual do Churn Pontual é calculado sobre o estoque pontual em aberto no início do mês (R$ 2.090.519,35).
• Net Churn = Churn − Cross Sell de MRR.
• MRR Ativo = Triagem + Onboarding + Ativo.
• MRR Operando = Triagem + Onboarding + Ativo + Em Cancelamento.

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

  it("crossIndisponivel true: mensagem traz o aviso, antes da linha 👀", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossIndisponivel: true },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    const aviso = "⚠️ Cross Sell indisponível nesta apuração — o Net Churn está superestimado.";
    expect(msg).toContain(aviso);
    expect(msg.indexOf(aviso)).toBeLessThan(msg.indexOf("👀 Seguimos"));
  });

  it("crossIndisponivel false: mensagem não menciona indisponibilidade", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossIndisponivel: false },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).not.toContain("indisponível");
    expect(msg).not.toContain("⚠️");
  });

  // Aviso de vendas novas indisponíveis: mesmo padrão do aviso de Cross Sell —
  // quando vendasPorChannel falha, mrrAdicionado/pontualVendido saem
  // zerados sem sinalização; vendasIndisponivel dispara a linha de aviso.
  const AVISO_CROSS = "⚠️ Cross Sell indisponível nesta apuração — o Net Churn está superestimado.";
  const AVISO_VENDAS =
    "⚠️ Vendas novas indisponíveis nesta apuração — MRR Adicionado e Pontual Vendido estão zerados por falha de apuração, não por ausência de vendas.";

  it("nenhum aviso: mensagem sai byte a byte como hoje", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossIndisponivel: false, vendasIndisponivel: false },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).toBe(MENSAGEM_ESPERADA);
  });

  it("só cross indisponível: só o aviso de cross, seguido de linha em branco e do 👀", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossIndisponivel: true, vendasIndisponivel: false },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).toContain(`${AVISO_CROSS}\n\n👀 Seguimos`);
    expect(msg).not.toContain(AVISO_VENDAS);
  });

  it("só vendas indisponível: só o aviso de vendas, seguido de linha em branco e do 👀", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossIndisponivel: false, vendasIndisponivel: true },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).toContain(`${AVISO_VENDAS}\n\n👀 Seguimos`);
    expect(msg).not.toContain(AVISO_CROSS);
  });

  it("ambos indisponíveis: cross primeiro, vendas depois, uma linha em branco antes do 👀", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossIndisponivel: true, vendasIndisponivel: true },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).toContain(`${AVISO_CROSS}\n${AVISO_VENDAS}\n\n👀 Seguimos`);
  });

  // Aviso de base de comparação suspeita: terceira classe de falha silenciosa —
  // mrrMesAnterior fora de ±40% de mrrAtivo (ex.: snapshot parcial de pipeline).
  const AVISO_BASE =
    "⚠️ Base de comparação suspeita — o MRR do mês anterior destoa da carteira atual; os percentuais podem estar distorcidos.";

  it("só base suspeita: só o aviso de base, seguido de linha em branco e do 👀", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossIndisponivel: false, vendasIndisponivel: false, baseSuspeita: true },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).toContain(`${AVISO_BASE}\n\n👀 Seguimos`);
    expect(msg).not.toContain(AVISO_CROSS);
    expect(msg).not.toContain(AVISO_VENDAS);
  });

  it("baseSuspeita false: mensagem não menciona base de comparação", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, baseSuspeita: false },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).not.toContain("Base de comparação");
  });

  it("três avisos juntos: cross, depois vendas, depois base suspeita, uma linha em branco antes do 👀", () => {
    const msg = formatarMensagemResumo(
      { ...METRICAS, crossIndisponivel: true, vendasIndisponivel: true, baseSuspeita: true },
      { dataFmt: "18/07", horaFmt: "13h", hora: 13, mes: 7 },
    );
    expect(msg).toContain(`${AVISO_CROSS}\n${AVISO_VENDAS}\n${AVISO_BASE}\n\n👀 Seguimos`);
  });
});

describe("derivarMetricas", () => {
  // Entrada crua equivalente ao que calcularMetricasResumo recebe das 6 queries,
  // antes da derivação. Os valores reproduzem o modelo de referência de 18/07
  // (mesmas bases de METRICAS acima) para que o teste de caracterização abaixo
  // sirva de rede de segurança: qualquer regressão de fórmula quebra os dois.
  const ENTRADA_BASE: Parameters<typeof derivarMetricas>[0] = {
    carteira: {
      ativo: 1069598,
      triagemOnboarding: 150789.28,
      emCancelamento: 96805,
    },
    mrrMesAnterior: 1137868,
    estoquePontualInicioMes: 2090519.35,
    entregaPontual: 169293.45,
    vendas: { novoMrr: 42310, novoPontual: 118500, crossMrr: 5997, crossPontual: 10300 },
    churn: { total: 67030, ajustado: 43314, brutoSemAbono: 55000 },
    churnPontual: { total: 171272, ajustado: 91973 },
  };

  it("reproduz METRICAS a partir da entrada crua equivalente (caracterização)", () => {
    expect(derivarMetricas(ENTRADA_BASE)).toEqual(METRICAS);
  });

  it("crossTotal é a soma cheia, sem a amortização ÷5 removida na v3", () => {
    const r = derivarMetricas({
      ...ENTRADA_BASE,
      vendas: { ...ENTRADA_BASE.vendas, crossMrr: 5997, crossPontual: 10300 },
    });
    expect(r.crossTotal).toBe(16297);
  });

  it("netChurn subtrai só o cross sell de MRR (crossR), não o crossTotal", () => {
    const r = derivarMetricas({
      ...ENTRADA_BASE,
      churn: { ...ENTRADA_BASE.churn, ajustado: 43314 },
      vendas: { ...ENTRADA_BASE.vendas, crossMrr: 5997, crossPontual: 10300 },
    });
    expect(r.netChurn).toBe(37317);
    // 43314 - crossTotal(16297) seria a régua antiga (amortizada) reintroduzida
    expect(r.netChurn).not.toBe(27017);
  });

  it("netChurnBruto subtrai só o cross sell de MRR (crossR), não o crossTotal", () => {
    const r = derivarMetricas({
      ...ENTRADA_BASE,
      churn: { ...ENTRADA_BASE.churn, total: 67030 },
      vendas: { ...ENTRADA_BASE.vendas, crossMrr: 5997, crossPontual: 10300 },
    });
    expect(r.netChurnBruto).toBe(61033);
  });

  it("carteiraAtivo recebe o status ativo isolado; mrrAtivo recebe a soma dos três (não podem trocar)", () => {
    const carteira = {
      ativo: 700000,
      triagemOnboarding: 100000,
      emCancelamento: 50000,
    };
    const r = derivarMetricas({ ...ENTRADA_BASE, carteira });
    expect(r.carteiraAtivo).toBe(700000);
    expect(r.mrrAtivo).toBe(800000);
    expect(r.carteiraAtivo).not.toBe(r.mrrAtivo);
  });

  // getCarteiraMrr faz I/O e não é exportada — mrrAtivo/mrrOperando agora são
  // derivados aqui dentro (função pura), com valores bem distintos para que
  // dropar uma parcela da soma quebre o teste em vez de coincidir por acaso.
  it("mrrAtivo é ativo + triagemOnboarding", () => {
    const carteira = { ativo: 500000, triagemOnboarding: 30000, emCancelamento: 7000 };
    const r = derivarMetricas({ ...ENTRADA_BASE, carteira });
    expect(r.mrrAtivo).toBe(530000);
  });

  it("mrrOperando é mrrAtivo + emCancelamento", () => {
    const carteira = { ativo: 500000, triagemOnboarding: 30000, emCancelamento: 7000 };
    const r = derivarMetricas({ ...ENTRADA_BASE, carteira });
    expect(r.mrrOperando).toBe(537000);
  });

  it("percentuais de MRR usam mrrMesAnterior; percentuais de pontual usam estoquePontualInicioMes", () => {
    const r = derivarMetricas(ENTRADA_BASE);
    expect(r.churnTotalPct).toBeCloseTo((67030 / 1137868) * 100, 10);
    expect(r.churnAjustadoPct).toBeCloseTo((43314 / 1137868) * 100, 10);
    expect(r.netChurnPct).toBeCloseTo((37317 / 1137868) * 100, 10);
    expect(r.netChurnBrutoPct).toBeCloseTo((61033 / 1137868) * 100, 10);
    expect(r.churnBrutoSemAbonoPct).toBeCloseTo((55000 / 1137868) * 100, 10);
    expect(r.churnPontualPct).toBeCloseTo((171272 / 2090519.35) * 100, 10);
    expect(r.churnPontualAjustadoPct).toBeCloseTo((91973 / 2090519.35) * 100, 10);
  });

  it("estoquePontualInicioMes zero não produz NaN nos percentuais de pontual", () => {
    const r = derivarMetricas({ ...ENTRADA_BASE, estoquePontualInicioMes: 0 });
    expect(r.churnPontualPct).toBe(0);
    expect(r.churnPontualAjustadoPct).toBe(0);
    expect(Number.isNaN(r.churnPontualPct)).toBe(false);
    expect(Number.isNaN(r.churnPontualAjustadoPct)).toBe(false);
  });

  // baseSuspeita: mrrMesAnterior fora de ±40% de mrrAtivo — sinal de snapshot
  // parcial/corrompido (já ocorreu em produção). mrrAtivo fixo em 1.000.000
  // (ativo 1.000.000 + triagemOnboarding 0) para testar os limites exatos.
  describe("baseSuspeita", () => {
    const carteira = { ativo: 1000000, triagemOnboarding: 0, emCancelamento: 0 };

    it("limite inferior exato (-40%, mrrMesAnterior = 600.000): dentro da faixa, false", () => {
      const r = derivarMetricas({ ...ENTRADA_BASE, carteira, mrrMesAnterior: 600000 });
      expect(r.baseSuspeita).toBe(false);
    });

    it("logo abaixo do limite inferior (mrrMesAnterior = 599.999): fora da faixa, true", () => {
      const r = derivarMetricas({ ...ENTRADA_BASE, carteira, mrrMesAnterior: 599999 });
      expect(r.baseSuspeita).toBe(true);
    });

    it("limite superior exato (+40%, mrrMesAnterior = 1.400.000): dentro da faixa, false", () => {
      const r = derivarMetricas({ ...ENTRADA_BASE, carteira, mrrMesAnterior: 1400000 });
      expect(r.baseSuspeita).toBe(false);
    });

    it("logo acima do limite superior (mrrMesAnterior = 1.400.001): fora da faixa, true", () => {
      const r = derivarMetricas({ ...ENTRADA_BASE, carteira, mrrMesAnterior: 1400001 });
      expect(r.baseSuspeita).toBe(true);
    });
  });

  it("mrrMesAnterior zero não produz Infinity/NaN nos 5 percentuais de MRR (simetria com o tratamento do pontual)", () => {
    const r = derivarMetricas({ ...ENTRADA_BASE, mrrMesAnterior: 0 });
    expect(r.churnTotalPct).toBe(0);
    expect(r.churnAjustadoPct).toBe(0);
    expect(r.netChurnPct).toBe(0);
    expect(r.netChurnBrutoPct).toBe(0);
    expect(r.churnBrutoSemAbonoPct).toBe(0);
    for (const pct of [r.churnTotalPct, r.churnAjustadoPct, r.netChurnPct, r.netChurnBrutoPct, r.churnBrutoSemAbonoPct]) {
      expect(Number.isFinite(pct)).toBe(true);
    }
  });

  describe("régua channel: venda nova e cross-sell não se sobrepõem", () => {
    it("mrrAdicionado e crossR vêm de campos distintos da mesma apuração", () => {
      const r = derivarMetricas({
        ...ENTRADA_BASE,
        vendas: { novoMrr: 180339, novoPontual: 383267, crossMrr: 9300, crossPontual: 15300 },
      });
      expect(r.mrrAdicionado).toBe(180339);
      expect(r.crossR).toBe(9300);
      expect(r.crossTotal).toBe(24600);
    });

    it("erro na apuração marca crossIndisponivel E vendasIndisponivel", () => {
      const r = derivarMetricas({
        ...ENTRADA_BASE,
        vendas: { novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0, erro: true },
      });
      expect(r.crossIndisponivel).toBe(true);
      expect(r.vendasIndisponivel).toBe(true);
    });
  });
});

// Strings de status do filtro SQL de getCarteiraMrr (item de regra de negócio,
// sem cobertura antes desta suíte). Espelham os valores exatos da coluna
// `status` em "Clickup".cup_contratos: mudar qualquer um deles muda os números
// da mensagem (ex.: renomear STATUS_EM_CANCELAMENTO para "em_cancelamento" faz
// o filtro parar de casar linhas e a mensagem exibir "🟠 Em Cancelamento: R$
// 0,00" em silêncio, com os 28+ testes de formatação continuando verdes porque
// eles não passam pelo SQL real).
describe("Status da carteira MRR (regra de negócio usada no filtro SQL)", () => {
  it("valores exatos usados em getCarteiraMrr", () => {
    expect(STATUS_ATIVO).toBe("ativo");
    expect(STATUS_TRIAGEM_ONBOARDING).toEqual(["triagem", "onboarding"]);
    expect(STATUS_EM_CANCELAMENTO).toBe("em cancelamento");
  });
});

describe("calcularMetricasResumo — guard rail de MRR inválido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: todas as colunas caem no fallback `row?.campo || "0"` de cada
    // query (getChurnMes, getChurnPontualMes, getEntregaPontualMes,
    // getEstoquePontualInicioMes, e getCarteiraMrr quando não sobrescrito
    // com mockResolvedValueOnce) — equivalente a "mês real sem nenhum dado".
    mockExecute.mockResolvedValue({ rows: [{}] });
    mockVendasPorChannel.mockResolvedValue({ novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0 });
    // vi.clearAllMocks() limpa as chamadas, não as implementações: sem este
    // default, um teste novo herdaria em silêncio o valor deixado pelo anterior.
    mockGetMrrInicioMes.mockResolvedValue(0);
  });

  it("aborta com throw quando mrrAtivo <= 0 (carteira zerada), mesmo com mrrMesAnterior válido", async () => {
    mockGetMrrInicioMes.mockResolvedValue(1000000);
    // getCarteiraMrr usa o default {} -> ativo=0, triagemOnboarding=0 -> mrrAtivo=0
    await expect(calcularMetricasResumo()).rejects.toThrow(/Métricas de MRR inválidas/);
  });

  it("aborta com throw quando mrrMesAnterior <= 0, mesmo com mrrAtivo válido", async () => {
    mockGetMrrInicioMes.mockResolvedValue(0);
    // 1ª chamada de db.execute em calcularMetricasResumo é sempre getCarteiraMrr
    mockExecute.mockResolvedValueOnce({ rows: [{ ativo: "500000" }] });
    await expect(calcularMetricasResumo()).rejects.toThrow(/Métricas de MRR inválidas/);
  });

  it("não aborta quando mrrAtivo e mrrMesAnterior são ambos positivos", async () => {
    mockGetMrrInicioMes.mockResolvedValue(1000000);
    mockExecute.mockResolvedValueOnce({ rows: [{ ativo: "500000" }] });
    await expect(calcularMetricasResumo()).resolves.toBeDefined();
  });
});

describe("calcularMetricasResumo — month window with timezone handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock setup for vendasPorChannel to succeed
    mockVendasPorChannel.mockResolvedValue({ novoMrr: 1000, novoPontual: 2000, crossMrr: 100, crossPontual: 200 });
    // Default mock for other queries
    mockExecute.mockResolvedValue({ rows: [{}] });
    mockGetMrrInicioMes.mockResolvedValue(1000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("virada de mês com defasagem de fuso: 2026-08-01T02:30:00Z (= 31/jul 23:30 SP)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T02:30:00Z"));

    // Mock carteira para passar no guard rail (mrrAtivo > 0)
    mockExecute.mockResolvedValueOnce({ rows: [{ ativo: "500000" }] });

    await calcularMetricasResumo();

    // Esperado: agosto não começou em SP, é ainda julho 31º, então a janela é de julho
    expect(mockVendasPorChannel).toHaveBeenCalledWith(
      expect.anything(),
      "2026-07-01",
      "2026-07-31",
    );
  });

  it("dia comum em SP (mid-month, UTC e SP compartilham a data)", async () => {
    vi.useFakeTimers();
    // 2026-07-15 12:00 UTC = 09:00 em São Paulo (mesmo dia)
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));

    // Mock carteira
    mockExecute.mockResolvedValueOnce({ rows: [{ ativo: "500000" }] });

    await calcularMetricasResumo();

    // Janela: de 1º a 15º de julho
    expect(mockVendasPorChannel).toHaveBeenCalledWith(
      expect.anything(),
      "2026-07-01",
      "2026-07-15",
    );
  });

  it("primeiro dia do mês em SP: clock em 1º → inicio === fim (ambos o 1º)", async () => {
    vi.useFakeTimers();
    // 2026-08-01 03:00 UTC = 2026-08-01 00:00 em SP (exatamente meia-noite local)
    vi.setSystemTime(new Date("2026-08-01T03:00:00Z"));

    // Mock carteira
    mockExecute.mockResolvedValueOnce({ rows: [{ ativo: "500000" }] });

    await calcularMetricasResumo();

    // Janela: de 1º a 1º de agosto
    expect(mockVendasPorChannel).toHaveBeenCalledWith(
      expect.anything(),
      "2026-08-01",
      "2026-08-01",
    );
  });

  it("virada de ano: 2027-01-01T02:30:00Z (= 2026-12-31 23:30 SP)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T02:30:00Z"));

    // Mock carteira
    mockExecute.mockResolvedValueOnce({ rows: [{ ativo: "500000" }] });

    await calcularMetricasResumo();

    // Esperado: ainda é dezembro em SP, não janeiro
    expect(mockVendasPorChannel).toHaveBeenCalledWith(
      expect.anything(),
      "2026-12-01",
      "2026-12-31",
    );
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

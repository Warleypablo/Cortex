import type { Express } from "express";
import { buildQuarterWindow } from "./reportsTrimestral.window";

// Defaults zero-preenchidos: os slides reusados renderizam sem quebrar até a
// task da seção substituir por dados reais.
function emptyTurboMetrics() {
  return {
    mrrAtivo: 0, ticketMedioContrato: 0, ticketMedioCliente: 0,
    clientesAtivos: 0, contratosAtivos: 0, clientesTotais: 0, contratosTotais: 0,
    mrrAdicionado: 0, churnMrr: 0, churnCount: 0, pausadosMrr: 0, pausadosCount: 0,
    crosssellMrr: 0, crosssellPontual: 0, crosssellContratos: 0, crosssellHistorico: [],
    cxcsSolicitacoes: 0, faturamentoPontual: 0, pontualCommerceQtr: 0, churnMetaMensal: 0,
    receitaChurnSeries: [], retencoesSolicitacoesCount: 0, retencoesSolicitacoesValor: 0,
    retencoesCount: 0, retencoesValor: 0,
  };
}
function emptyContratosMes() {
  return {
    numContratos: 0, contratosRecorrente: 0, contratosPontual: 0,
    receitaRecorrente: 0, receitaPontual: 0, tmRecorrente: 0, tmPontual: 0,
    pipelineBreakdown: [], vendasSeries: [],
  };
}
function emptyPontualData() {
  return {
    emAberto: { valor: 0, contratos: 0, porServico: [] },
    aquisicao: { valor: 0, contratos: 0 },
    entregasMes: { porSquad: [], total: 0 },
    variacaoEstoque: { entrou: 0, saiu: 0, delta: 0 },
    entregasPorProdutoMes: [], tempoMedioEntrega: [],
  };
}
function emptyTechData(label: string) {
  return {
    kpis: { entregues: 0, valorEntregues: 0, tempoMedio: 0, adicionados: 0, valorAdicionados: 0 },
    mesLabel: label, entregasPorTipo: [], receitaPorTipo: [], emAbertoPorTipo: [], pipeline: [],
  };
}
function emptyFaturamentoYtd() {
  return { faturamentoBrutoYtd: 0, inadimplenciaYtd: 0, impostoYtd: 0, dfcRecebimentoMensal: [] };
}

export function registerReportsTrimestralRoutes(app: Express) {
  app.get("/api/reports/trimestral", async (req, res) => {
    try {
      const trimestre = req.query.trimestre as string;
      if (!trimestre || !/^\d{4}-Q[1-4]$/.test(trimestre)) {
        return res.status(400).json({ error: "Parâmetro 'trimestre' inválido. Use YYYY-Qn." });
      }
      const w = buildQuarterWindow(trimestre, new Date());

      // TODO(Task 3): trend real. TODO(Tasks 6-11): seções reais.
      res.json({
        trimestre: w.trimestre,
        label: w.label,
        parcial: w.parcial,
        mesesComputados: w.mesesComputados,
        trend: {
          series: [],
          qoq: {
            mrr: { atual: 0, anterior: 0, betterDirection: "up" as const },
            vendas: { atual: 0, anterior: 0, betterDirection: "up" as const },
            churn: { atual: 0, anterior: 0, betterDirection: "down" as const },
          },
        },
        turboMetrics: emptyTurboMetrics(),
        contratosMes: emptyContratosMes(),
        rankingClosers: [],
        topPontual: null,
        rankingSquads: [],
        squadDetails: [],
        pontualData: emptyPontualData(),
        techData: emptyTechData(w.label),
        faturamentoYtd: emptyFaturamentoYtd(),
      });
    } catch (error: any) {
      console.error("[reports/trimestral] Error:", error?.message || error);
      res.status(500).json({ error: "Erro ao gerar dados do reporte trimestral", details: error?.message });
    }
  });
}

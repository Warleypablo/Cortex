export interface KpiData {
  atual: number | null;
  anterior: number | null;
  variacaoPct: number | null;
  betterDirection: "up" | "down";
}

export interface KpiComQtd extends KpiData {
  qtdAtual: number | null;
  qtdAnterior: number | null;
}

export interface PeriodoJanela {
  inicio: string;
  fim: string;
}

export interface RelatorioSemanalData {
  periodo: { atual: PeriodoJanela; anterior: PeriodoJanela };
  kpis: {
    mrrAtivo: KpiData;
    churn: KpiData;
    entregasPontuais: KpiComQtd;
    churnPontual: KpiComQtd;
  };
}

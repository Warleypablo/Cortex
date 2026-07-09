import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { buildQuarterWindow, type QuarterWindow } from "./reportsTrimestral.window";

interface VendasMesInput { month: string; vendasMrr: number }
interface MrrChurnMesInput { month: string; mrr: number; churnBrl: number }
export interface TrendPoint { q: string; label: string; mrr: number; vendas: number; churn: number }
export interface Qoq { atual: number; anterior: number; betterDirection: "up" | "down" }

function mesToQuarter(month: string): { q: string; label: string; ano: number; quarter: number } {
  const [anoStr, mStr] = month.split("-");
  const ano = parseInt(anoStr, 10);
  const quarter = Math.floor((parseInt(mStr, 10) - 1) / 3) + 1;
  return { q: `${ano}-Q${quarter}`, label: `Q${quarter} ${ano}`, ano, quarter };
}

export function aggregateTrend(
  vendasPorMes: VendasMesInput[],
  mrrChurnPorMes: MrrChurnMesInput[],
  window: QuarterWindow,
): { series: TrendPoint[]; qoq: { mrr: Qoq; vendas: Qoq; churn: Qoq } } {
  // Acumula por trimestre: vendas e churn somam; mrr guarda a foto do ÚLTIMO mês (maior "YYYY-MM").
  const acc = new Map<string, { label: string; vendas: number; churn: number; mrrMonth: string; mrr: number }>();
  const ensure = (month: string) => {
    const { q, label } = mesToQuarter(month);
    if (!acc.has(q)) acc.set(q, { label, vendas: 0, churn: 0, mrrMonth: "", mrr: 0 });
    return acc.get(q)!;
  };
  for (const v of vendasPorMes) ensure(v.month).vendas += v.vendasMrr || 0;
  for (const m of mrrChurnPorMes) {
    const bucket = ensure(m.month);
    bucket.churn += m.churnBrl || 0;
    if (m.month >= bucket.mrrMonth) { bucket.mrrMonth = m.month; bucket.mrr = m.mrr || 0; }
  }

  const series: TrendPoint[] = Array.from(acc.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([q, b]) => ({ q, label: b.label, mrr: b.mrr, vendas: b.vendas, churn: b.churn }));

  const atual = series.find((s) => s.q === window.trimestre);
  const anterior = series.find((s) => s.q === window.prev.trimestre);
  const mk = (get: (p: TrendPoint) => number, dir: "up" | "down"): Qoq => ({
    atual: atual ? get(atual) : 0,
    anterior: anterior ? get(anterior) : 0,
    betterDirection: dir,
  });

  return {
    series,
    qoq: {
      mrr: mk((p) => p.mrr, "up"),
      vendas: mk((p) => p.vendas, "up"),
      churn: mk((p) => p.churn, "down"),
    },
  };
}

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

      // Bloco trend: série por trimestre + QoQ (Task 3). Reaproveita as duas queries
      // de série mensal já validadas em produção no relatorioMensalSlides.ts
      // (vendasSeriesResult e receitaChurnResult), com o lookback estendido para
      // ~18 meses terminando em w.dataEnd, e agrega os meses em trimestres em JS.
      const [vendasRows, mrrChurnRows] = await Promise.all([
        // Espelha vendasSeriesResult (query 27 do mensal)
        db.execute(sql`
          SELECT
            TO_CHAR(d.data_fechamento, 'YYYY-MM') as month,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as vendas_mrr
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= (${w.dataEnd}::date - INTERVAL '18 months')
            AND d.data_fechamento < ${w.dataEnd}
          GROUP BY TO_CHAR(d.data_fechamento, 'YYYY-MM')
          ORDER BY month
        `),
        // Espelha receitaChurnResult (query 14 do mensal)
        db.execute(sql`
          WITH date_range AS (
            SELECT
              (${w.dataStart}::date - INTERVAL '18 months')::date as range_start,
              ${w.dataEnd}::date as range_end
          ),
          month_series AS (
            SELECT TO_CHAR(generate_series(dr.range_start, dr.range_end - INTERVAL '1 day', '1 month'), 'YYYY-MM') as month,
                   generate_series(dr.range_start, dr.range_end - INTERVAL '1 day', '1 month')::date as month_start,
                   (generate_series(dr.range_start, dr.range_end - INTERVAL '1 day', '1 month') + INTERVAL '1 month')::date as next_month_start
            FROM date_range dr
          ),
          monthly_snapshots AS (
            SELECT
              TO_CHAR(m.month_start, 'YYYY-MM') as month,
              COALESCE(
                (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = (m.month_start + INTERVAL '1 month')::date LIMIT 1),
                (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE TO_CHAR(data_snapshot, 'YYYY-MM') = TO_CHAR(m.month_start, 'YYYY-MM'))
              ) as last_snapshot
            FROM date_range dr,
              generate_series(dr.range_start, dr.range_end - INTERVAL '1 day', INTERVAL '1 month') as m(month_start)
          ),
          mrr_mensal AS (
            SELECT
              ms.month,
              COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as mrr
            FROM monthly_snapshots ms
            JOIN "Clickup".cup_data_hist h ON h.data_snapshot = ms.last_snapshot
            WHERE ms.last_snapshot IS NOT NULL
              AND h.status IN ('ativo', 'onboarding', 'triagem')
              AND h.valorr IS NOT NULL
            GROUP BY ms.month
          ),
          churn_mensal AS (
            -- Série do gráfico Faturamento x Churn: INCLUI abonados (sem filtro
            -- abonar_churn), alinhado ao card Cancelados. Mantém de fora os 3 motivos não-churn.
            SELECT
              TO_CHAR(data_solicitacao_encerramento, 'YYYY-MM') as month,
              COALESCE(SUM(valor_r), 0) as churn_brl
            FROM cortex_core.vw_cup_churn_ajustado, date_range dr
            WHERE data_solicitacao_encerramento IS NOT NULL
              AND data_solicitacao_encerramento >= dr.range_start
              AND data_solicitacao_encerramento < dr.range_end
              AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
            GROUP BY TO_CHAR(data_solicitacao_encerramento, 'YYYY-MM')
          )
          SELECT
            m.month,
            m.mrr,
            COALESCE(c.churn_brl, 0) as churn_brl
          FROM mrr_mensal m
          LEFT JOIN churn_mensal c ON m.month = c.month
          ORDER BY m.month
        `),
      ]);

      const vendasPorMes = (vendasRows.rows as any[]).map((r) => ({
        month: r.month as string,
        vendasMrr: parseFloat(r.vendas_mrr) || 0,
      }));
      const mrrChurnPorMes = (mrrChurnRows.rows as any[]).map((r) => ({
        month: r.month as string,
        mrr: parseFloat(r.mrr) || 0,
        churnBrl: parseFloat(r.churn_brl) || 0,
      }));
      const trend = aggregateTrend(vendasPorMes, mrrChurnPorMes, w);

      // TODO(Tasks 6-11): demais seções reais.
      res.json({
        trimestre: w.trimestre,
        label: w.label,
        parcial: w.parcial,
        mesesComputados: w.mesesComputados,
        trend,
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

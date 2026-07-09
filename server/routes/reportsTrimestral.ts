import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { buildQuarterWindow, type QuarterWindow } from "./reportsTrimestral.window";

interface VendasMesInput { month: string; vendasMrr: number }
interface MrrChurnMesInput { month: string; mrr: number; churnBrl: number }
export interface TrendPoint { q: string; label: string; mrr: number; vendas: number; churn: number }
export interface Qoq { atual: number; anterior: number; betterDirection: "up" | "down" }

// ─── Espelhos das tabelas manuais do mensal (relatorioMensalSlides.ts L15-41) ───
// As originais são privadas (não exportadas) e o mensal não pode ser tocado.
// ⚠️ ATUALIZAR JUNTO ao editar as tabelas no relatorioMensalSlides.ts.
// Auditoria Q2-2026 (2026-07-09): sem estes overrides o NRR de Pulse ficava
// sub-avaliado em 3,6% do churn da squad e o da Selva em 2,7% — material (>2%).

// Vendas de expansão por mês×squad (chaves normalizadas via normalizeSquadName).
// O trimestral SOMA as entradas dos meses do trimestre.
const VENDAS_EXPANSAO_POR_MES_ESPELHO: Record<string, Record<string, { vendas: number; abatimento: number }>> = {
  "2026-05": {
    selva: { vendas: 9000, abatimento: 9000 / 5 },
    squadra: { vendas: 8000, abatimento: 8000 / 5 },
    pulse: { vendas: 4497, abatimento: 4497 },
  },
};

// Reclassificação manual de churn por squad (task_id da subtask → squad destino),
// aplicada quando o mês do override cai dentro do trimestre.
const CHURN_SQUAD_OVERRIDE_ESPELHO: Record<string, { taskId: string; squadDestino: string }[]> = {
  "2026-05": [{ taskId: "86a78223q", squadDestino: "🐑 Black" }],
};

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
    // Exclui trimestres sem snapshot de MRR (foto = 0) para não derrubar a linha
    // do gráfico a zero em trimestres anteriores ao início do cup_data_hist.
    // O qoq acima já foi calculado sobre a série COMPLETA (atual/anterior por
    // window.trimestre / window.prev.trimestre), então o filtro abaixo não afeta o QoQ.
    series: series.filter((s) => s.mrr > 0),
    qoq: {
      mrr: mk((p) => p.mrr, "up"),
      vendas: mk((p) => p.vendas, "up"),
      churn: mk((p) => p.churn, "down"),
    },
  };
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
          ),
          pontual_mensal AS (
            SELECT
              TO_CHAR(data_entrega, 'YYYY-MM') as month,
              COALESCE(SUM(valorp::numeric), 0) as pontual
            FROM "Clickup".cup_contratos, date_range dr
            WHERE data_entrega IS NOT NULL
              AND data_entrega >= dr.range_start
              AND data_entrega < dr.range_end
              AND valorp IS NOT NULL AND valorp::numeric > 0
              AND LOWER(TRIM(status)) = 'entregue'
            GROUP BY TO_CHAR(data_entrega, 'YYYY-MM')
          )
          SELECT
            m.month,
            m.mrr,
            COALESCE(c.churn_brl, 0) as churn_brl,
            COALESCE(p.pontual, 0) as pontual
          FROM mrr_mensal m
          LEFT JOIN churn_mensal c ON m.month = c.month
          LEFT JOIN pontual_mensal p ON m.month = p.month
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

      // Bloco turboMetrics (Task 7): espelha as queries 9-13/18 de turboMetrics do
      // relatorioMensalSlides.ts, re-janeladas para o trimestre. Foto em w.fotoDate
      // p/ MRR ativo/clientes/contratos (ativos e totais); soma no range do tri p/
      // churn/cross-sell/faturamento pontual/retenções (fluxo); ratios recalculados em JS.
      const [
        turboMrrRows,
        turboClientesRows,
        turboChurnRows,
        turboCxcsRows,
        turboFatRows,
        turboRetencoesRows,
        mrrAdicionadoRows,
      ] = await Promise.all([
        // Espelha query 9 (MRR ativo + ticket médio) — FOTO em w.fotoDate, fallback ao
        // snapshot mais recente ≤ fotoDate.
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${w.fotoDate}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${w.fotoDate}::date)
            ) as snap
          )
          SELECT
            COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as mrr_ativo,
            COALESCE(AVG(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as ticket_medio_contrato,
            COUNT(*)::int as contratos_ativos,
            COUNT(DISTINCT h.id_task)::int as clientes_ativos,
            -- Clientes com contrato RECORRENTE ativo (valorr > 0) — denominador do
            -- ticket médio recorrente. clientes_ativos (acima) inclui clientes cujo
            -- snapshot só tem linhas com valorr = 0 e diluiria o ticket.
            COUNT(DISTINCT h.id_task) FILTER (WHERE h.valorr::numeric > 0)::int as clientes_rec_ativos
          FROM "Clickup".cup_data_hist h
          JOIN ultimo_snapshot us ON h.data_snapshot = us.snap
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
            AND h.valorr IS NOT NULL
        `),
        // Espelha query 10 (clientes/contratos totais) — FOTO em w.fotoDate.
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${w.fotoDate}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${w.fotoDate}::date)
            ) as snap
          )
          SELECT
            COUNT(DISTINCT h.id_task)::int as clientes_totais,
            COUNT(*)::int as contratos_totais
          FROM "Clickup".cup_data_hist h
          JOIN ultimo_snapshot us ON h.data_snapshot = us.snap
        `),
        // Espelha query 11: churn (cup_churn ajustado) somado no range do tri (FLUXO);
        // pausados via cup_contratos (tabela de estado atual, sem histórico de snapshot)
        // como estado ATUAL — FOTO — em vez de fluxo por data_pausa no mês.
        db.execute(sql`
          WITH churn_data AS (
            SELECT
              COALESCE(SUM(valor_r), 0)::numeric as churn_mrr,
              COUNT(*)::int as churn_count
            FROM cortex_core.vw_cup_churn_ajustado
            WHERE data_solicitacao_encerramento IS NOT NULL
              AND data_solicitacao_encerramento >= ${w.dataStart}::date
              AND data_solicitacao_encerramento < ${w.dataEnd}::date
              AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
          ),
          pausados_data AS (
            SELECT
              COALESCE(SUM(COALESCE(valorr::numeric, 0)), 0) as pausados_mrr,
              COUNT(*)::int as pausados_count
            FROM "Clickup".cup_contratos
            WHERE LOWER(status) = 'pausado'
          )
          SELECT c.churn_mrr, c.churn_count, p.pausados_mrr, p.pausados_count
          FROM churn_data c, pausados_data p
        `),
        // Espelha query 12 (cross-sell, source PARTNER) — FLUXO somado no tri.
        db.execute(sql`
          SELECT
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as crosssell_mrr,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as crosssell_pontual,
            COUNT(*)::int as solicitacoes
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.source = 'PARTNER'
            AND d.data_fechamento >= ${w.dataStart}::date
            AND d.data_fechamento < ${w.dataEnd}::date
        `),
        // Espelha query 13 (faturamento pontual, cup_contratos.data_entrega) — FLUXO no tri.
        // clientes_pontuais: clientes distintos ATENDIDOS no tri (id_task = task do
        // cliente; ver reference_estoque_pontual) — denominador do ticket médio pontual
        // por cliente, mesma régua do recorrente (receita ÷ clientes).
        db.execute(sql`
          SELECT
            COALESCE(SUM(valorp::numeric), 0) as faturamento_pontual,
            COUNT(DISTINCT id_task)::int as clientes_pontuais
          FROM "Clickup".cup_contratos
          WHERE data_entrega >= ${w.dataStart}::date
            AND data_entrega < ${w.dataEnd}::date
            AND valorp IS NOT NULL
            AND valorp::numeric > 0
        `),
        // Espelha query 13b/turboRetencoesResult (retenções CXCS) — FLUXO no tri.
        db.execute(sql`
          SELECT
            COUNT(*)::int as solicitacoes_count,
            COALESCE(SUM(valor_r), 0)::numeric as solicitacoes_valor,
            COUNT(CASE WHEN reteve = 'Sim' THEN 1 END)::int as retencoes_count,
            COALESCE(SUM(CASE WHEN reteve = 'Sim' THEN valor_r ELSE 0 END), 0)::numeric as retencoes_valor
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE data_solicitacao_encerramento IS NOT NULL
            AND data_solicitacao_encerramento >= ${w.dataStart}::date
            AND data_solicitacao_encerramento < ${w.dataEnd}::date
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
        `),
        // Espelha o componente "receita_recorrente" da query 7 (deals ganhos) — FLUXO no
        // tri. Alimenta turboMetrics.mrrAdicionado (mesma fonte do mensal: `totalRecorrente`).
        db.execute(sql`
          SELECT
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as receita_recorrente
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= ${w.dataStart}::date
            AND d.data_fechamento < ${w.dataEnd}::date
        `),
      ]);

      const turboMrr = (turboMrrRows.rows as any[])[0] || {};
      const turboClientes = (turboClientesRows.rows as any[])[0] || {};
      const turboChurn = (turboChurnRows.rows as any[])[0] || {};
      const turboCxcs = (turboCxcsRows.rows as any[])[0] || {};
      const turboFat = (turboFatRows.rows as any[])[0] || {};
      const turboRetencoes = (turboRetencoesRows.rows as any[])[0] || {};
      const mrrAdicionado = parseFloat((mrrAdicionadoRows.rows as any[])[0]?.receita_recorrente) || 0;

      const turboMetrics = {
        mrrAtivo: parseFloat(turboMrr.mrr_ativo) || 0,
        ticketMedioContrato: parseFloat(turboMrr.ticket_medio_contrato) || 0,
        // Ticket recorrente = MRR ÷ clientes com contrato RECORRENTE ativo (não a
        // base geral, que inclui clientes só-pontual e diluía o número).
        ticketMedioCliente: (parseInt(turboMrr.clientes_rec_ativos) || 0) > 0
          ? (parseFloat(turboMrr.mrr_ativo) || 0) / (parseInt(turboMrr.clientes_rec_ativos) || 1)
          : 0,
        clientesAtivos: parseInt(turboMrr.clientes_ativos) || 0,
        contratosAtivos: parseInt(turboMrr.contratos_ativos) || 0,
        clientesTotais: parseInt(turboClientes.clientes_totais) || 0,
        contratosTotais: parseInt(turboClientes.contratos_totais) || 0,
        mrrAdicionado,
        churnMrr: parseFloat(turboChurn.churn_mrr) || 0,
        churnCount: parseInt(turboChurn.churn_count) || 0,
        pausadosMrr: parseFloat(turboChurn.pausados_mrr) || 0,
        pausadosCount: parseInt(turboChurn.pausados_count) || 0,
        crosssellMrr: parseFloat(turboCxcs.crosssell_mrr) || 0,
        crosssellPontual: parseFloat(turboCxcs.crosssell_pontual) || 0,
        crosssellContratos: parseInt(turboCxcs.solicitacoes) || 0,
        // Histórico mensal de cross-sell não é usado no deck trimestral (evolução usa `trend`).
        crosssellHistorico: [] as { mes: string; mrr: number; pontual: number }[],
        cxcsSolicitacoes: parseInt(turboCxcs.solicitacoes) || 0,
        faturamentoPontual: parseFloat(turboFat.faturamento_pontual) || 0,
        // Não usados no subconjunto de slides do trimestral (ver section-rewindow-guidance.md).
        pontualCommerceQtr: 0,
        churnMetaMensal: 0,
        // Série mês a mês (3 pontos do tri) — alimenta o gráfico "Faturamento x Churn" e a
        // mini-série "MRR Ativo" do SlideTurboMetrics.tsx reaproveitado do mensal. Preenchida
        // abaixo (ADENDO), após mrrChurnRows já trazer `pontual` por mês.
        receitaChurnSeries: [] as { month: string; label: string; mrr: number; pontual: number; churnBrl: number; churnPct: number }[],
        retencoesSolicitacoesCount: parseInt(turboRetencoes.solicitacoes_count) || 0,
        retencoesSolicitacoesValor: parseFloat(turboRetencoes.solicitacoes_valor) || 0,
        retencoesCount: parseInt(turboRetencoes.retencoes_count) || 0,
        retencoesValor: parseFloat(turboRetencoes.retencoes_valor) || 0,
      };

      // Bloco contratosMes + rankingClosers + topPontual (Task 8): espelha as queries
      // 5/6 (ranking closers + fotos) e 7/13d (contratos do período + pipeline breakdown)
      // do relatorioMensalSlides.ts, re-janeladas para o trimestre inteiro (FLUXO).
      // O ranking soma por closer no range do tri inteiro e o ORDER BY re-rankeia sobre
      // essa janela completa — não concatena tops mensais. tmRecorrente/tmPontual são
      // RATIO recalculado em JS a partir dos agregados do tri.
      const [
        rankingRows,
        closerPhotosRows,
        contratosRows,
        pipelineBreakdownRows,
        sdrRankingRows,
        sdrPhotosRows,
        sdrReunioesRows,
      ] = await Promise.all([
        // Espelha query 5 (ranking closers, deals ganhos) — FLUXO somado no tri.
        db.execute(sql`
          SELECT
            c.nome as name,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as mrr_obtido,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as pontual_obtido,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric + COALESCE(SUM(d.valor_pontual), 0)::numeric as total_obtido,
            COUNT(*)::int as negocios_ganhos
          FROM "Bitrix".crm_deal d
          JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
          -- só os 7 closers ativos (ranking com fotos; sem bucket "Outros")
          WHERE d.stage_name = 'Negócio Ganho' AND c.active = true
            AND d.data_fechamento >= ${w.dataStart}::date
            AND d.data_fechamento < ${w.dataEnd}::date
          GROUP BY c.nome
          ORDER BY mrr_obtido DESC
        `),
        // Espelha query 6 (fotos dos closers) — sem filtro de data.
        db.execute(sql`
          SELECT c.nome as name, a.picture
          FROM "Bitrix".crm_closers c
          LEFT JOIN cortex_core.auth_users a ON LOWER(TRIM(c.email)) = LOWER(TRIM(a.email))
          WHERE c.email IS NOT NULL AND a.picture IS NOT NULL
        `),
        // Espelha query 7 (contratos do período: nº e receita recorrente/pontual) —
        // FLUXO somado no tri.
        db.execute(sql`
          SELECT
            COUNT(CASE WHEN COALESCE(d.valor_recorrente, 0) > 0 THEN 1 END)::int as contratos_recorrente,
            COUNT(CASE WHEN COALESCE(d.valor_pontual, 0) > 0 THEN 1 END)::int as contratos_pontual,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as receita_recorrente,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as receita_pontual
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= ${w.dataStart}::date
            AND d.data_fechamento < ${w.dataEnd}::date
        `),
        // Espelha query 13d (pipeline breakdown Inbound/Outbound/Geral) — FLUXO no tri.
        db.execute(sql`
          SELECT
            COALESCE(d.category_name, 'Outros') as pipeline,
            COUNT(*)::int as contratos,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as receita_recorrente,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as receita_pontual
          FROM "Bitrix".crm_deal d
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= ${w.dataStart}::date
            AND d.data_fechamento < ${w.dataEnd}::date
          GROUP BY d.category_name
          ORDER BY receita_recorrente DESC
        `),
        // Espelha query 6b (ranking SDRs, deals ganhos por SDR) — FLUXO somado no tri.
        db.execute(sql`
          SELECT
            u.nome as name,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as mrr_gerado,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as pontual_gerado,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric + COALESCE(SUM(d.valor_pontual), 0)::numeric as total_gerado,
            COUNT(*)::int as negocios_ganhos
          FROM "Bitrix".crm_deal d
          JOIN "Bitrix".crm_users u ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.data_fechamento >= ${w.dataStart}::date
            AND d.data_fechamento < ${w.dataEnd}::date
          GROUP BY u.nome
          ORDER BY mrr_gerado DESC
        `),
        // Espelha query 6c (fotos dos SDRs) — sem filtro de data.
        db.execute(sql`
          SELECT u.nome as name, a.picture
          FROM "Bitrix".crm_users u
          LEFT JOIN cortex_core.auth_users a ON LOWER(TRIM(u.email)) = LOWER(TRIM(a.email))
          WHERE u.email IS NOT NULL AND a.picture IS NOT NULL
        `),
        // Espelha query 6d (top SDR por reuniões realizadas) — FLUXO no tri, LIMIT 1.
        db.execute(sql`
          SELECT
            u.nome as name,
            COUNT(*)::int as reunioes
          FROM "Bitrix".crm_deal d
          JOIN "Bitrix".crm_users u ON CASE WHEN d.sdr ~ '^[0-9]+$' THEN d.sdr::integer ELSE NULL END = u.id
          WHERE d.data_reuniao_realizada IS NOT NULL
            AND d.data_reuniao_realizada >= ${w.dataStart}::date
            AND d.data_reuniao_realizada < ${w.dataEnd}::date
          GROUP BY u.nome
          ORDER BY reunioes DESC
          LIMIT 1
        `),
      ]);

      const closerPhotoMap: Record<string, string> = {};
      (closerPhotosRows.rows as any[]).forEach((row: any) => {
        if (row.picture && row.name) closerPhotoMap[row.name] = row.picture;
      });

      const rankingClosers = (rankingRows.rows as any[]).map((row: any) => ({
        name: row.name,
        fotoUrl: closerPhotoMap[row.name] || null,
        mrrObtido: parseFloat(row.mrr_obtido) || 0,
        pontualObtido: parseFloat(row.pontual_obtido) || 0,
        totalObtido: parseFloat(row.total_obtido) || 0,
        negociosGanhos: parseInt(row.negocios_ganhos) || 0,
      }));

      // Ranking SDRs + top reuniões (espelha mensal ~L1332-1354) — FLUXO no tri.
      const sdrPhotoMap: Record<string, string> = {};
      (sdrPhotosRows.rows as any[]).forEach((row: any) => {
        if (row.picture && row.name) sdrPhotoMap[row.name] = row.picture;
      });
      const rankingSDRs = (sdrRankingRows.rows as any[]).map((row: any) => ({
        name: row.name,
        fotoUrl: sdrPhotoMap[row.name] || null,
        mrrGerado: parseFloat(row.mrr_gerado) || 0,
        pontualGerado: parseFloat(row.pontual_gerado) || 0,
        totalGerado: parseFloat(row.total_gerado) || 0,
        negociosGanhos: parseInt(row.negocios_ganhos) || 0,
      }));
      const topReunioesRow = (sdrReunioesRows.rows as any[])[0];
      const topReunioes = topReunioesRow ? {
        name: topReunioesRow.name,
        fotoUrl: sdrPhotoMap[topReunioesRow.name] || null,
        reunioes: parseInt(topReunioesRow.reunioes) || 0,
      } : null;

      // Top pontual (maior pontualObtido do ranking do tri, igual mensal).
      const topPontual = [...rankingClosers].sort((a, b) => b.pontualObtido - a.pontualObtido)[0] || null;

      const contratosRow = (contratosRows.rows as any[])[0] || {};
      const totalRecorrente = parseFloat(contratosRow.receita_recorrente) || 0;
      const totalPontual = parseFloat(contratosRow.receita_pontual) || 0;
      const totalContratosRec = parseInt(contratosRow.contratos_recorrente) || 0;
      const totalContratosPont = parseInt(contratosRow.contratos_pontual) || 0;
      const numContratos = totalContratosRec + totalContratosPont;

      const pipelineBreakdown = (pipelineBreakdownRows.rows as any[]).map((row: any) => ({
        pipeline: row.pipeline,
        contratos: parseInt(row.contratos) || 0,
        receitaRecorrente: parseFloat(row.receita_recorrente) || 0,
        receitaPontual: parseFloat(row.receita_pontual) || 0,
      }));

      const contratosMes = {
        numContratos,
        contratosRecorrente: totalContratosRec,
        contratosPontual: totalContratosPont,
        receitaRecorrente: totalRecorrente,
        receitaPontual: totalPontual,
        tmRecorrente: totalContratosRec > 0 ? totalRecorrente / totalContratosRec : 0,
        tmPontual: totalContratosPont > 0 ? totalPontual / totalContratosPont : 0,
        pipelineBreakdown,
        // A evolução usa o bloco `trend`; a série mensal de vendas não é exibida no deck trimestral.
        vendasSeries: [] as { month: string; label: string; vendasMrr: number; vendasPontual: number; numContratos: number }[],
      };

      // Bloco squads (Task 9): espelha as queries 15/16/16b/17/17b (ranking squads,
      // churn por squad + lista de clientes, pontual entregue por squad, MRR por
      // squad no início do tri e MRR total no início do tri) do
      // relatorioMensalSlides.ts, re-janeladas para o trimestre. Q15/Q17/Q17b são
      // FOTO (snapshot em w.fotoDate / w.dataStart); Q16/Q16b são FLUXO (soma no
      // range do tri, mantendo a distinção abonado/total); os ratios por squad
      // (churnPct, ticketMedio, nrrBrl, nrrPct, evolucaoMrr) são RATIO recalculados
      // em JS a partir dos agregados do tri, igual à montagem do mensal (~L1526-1566).
      const [
        rankingSquadsRows,
        churnSquadsRows,
        pontualEntregueSquadRows,
        mrrAnteriorSquadsRows,
        mrrAnteriorTotalRows,
        operadoresPorSquadRows,
        accountsRows,
      ] = await Promise.all([
        // Espelha query 15 (ranking squads por MRR + Pontual) — FOTO em w.fotoDate,
        // fallback ao snapshot mais recente ≤ fotoDate.
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${w.fotoDate}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${w.fotoDate}::date)
            ) as snap
          )
          SELECT
            h.squad,
            COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as mrr,
            COALESCE(SUM(CASE WHEN COALESCE(h.valorp, '0')::numeric > 0 THEN h.valorp::numeric END), 0) as pontual,
            COUNT(*)::int as contratos,
            COUNT(DISTINCT h.id_task)::int as clientes
          FROM "Clickup".cup_data_hist h
          JOIN ultimo_snapshot us ON h.data_snapshot = us.snap
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
            AND h.valorr IS NOT NULL
            AND h.squad IS NOT NULL
            AND TRIM(h.squad) != ''
          GROUP BY h.squad
          ORDER BY (
            COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) +
            COALESCE(SUM(CASE WHEN COALESCE(h.valorp, '0')::numeric > 0 THEN h.valorp::numeric END), 0)
          ) DESC
        `),
        // Espelha query 16 (churn por squad + lista de clientes) — FLUXO somado no
        // tri, COM a reclassificação manual dos meses do trimestre
        // (CHURN_SQUAD_OVERRIDE_ESPELHO — mesma técnica do mensal: CASE no SELECT,
        // GROUP BY posicional).
        db.execute(sql`
          SELECT
            ${(() => {
              const overrides = w.meses.flatMap((m) => CHURN_SQUAD_OVERRIDE_ESPELHO[m] ?? []);
              return overrides.length > 0
                ? sql`CASE ${sql.join(
                    overrides.map((o) => sql`WHEN v.task_id = ${o.taskId} THEN ${o.squadDestino}`),
                    sql` `,
                  )} ELSE v.squad END`
                : sql`v.squad`;
            })()} as squad,
            COALESCE(SUM(v.valor_r), 0)::numeric as churn_total_brl,
            COUNT(*)::int as churn_total_count,
            COALESCE(SUM(v.valor_r) FILTER (WHERE COALESCE(v.abonar_churn, '') != 'Sim'), 0)::numeric as churn_brl,
            (COUNT(*) FILTER (WHERE COALESCE(v.abonar_churn, '') != 'Sim'))::int as churn_count,
            COALESCE(
              json_agg(
                json_build_object(
                  'nome', COALESCE(cl.nome, v.nome),
                  'valor', COALESCE(v.valor_r, 0),
                  'abonado', COALESCE(v.abonar_churn, '') = 'Sim'
                )
                ORDER BY v.valor_r DESC NULLS LAST
              ) FILTER (WHERE COALESCE(v.valor_r, 0) > 0),
              '[]'::json
            ) as clientes
          FROM cortex_core.vw_cup_churn_ajustado v
          LEFT JOIN "Clickup".cup_clientes cl ON v.parent_id = cl.task_id
          WHERE v.data_solicitacao_encerramento IS NOT NULL
            AND v.data_solicitacao_encerramento >= ${w.dataStart}::date
            AND v.data_solicitacao_encerramento < ${w.dataEnd}::date
            AND v.squad IS NOT NULL
            AND TRIM(v.squad) != ''
          GROUP BY 1
        `),
        // Espelha query 16b (pontual entregue no tri por squad) — FLUXO somado no tri.
        db.execute(sql`
          SELECT
            squad,
            COALESCE(SUM(valorp::numeric), 0)::numeric as pontual
          FROM "Clickup".cup_contratos
          WHERE LOWER(TRIM(status)) = 'entregue'
            AND data_entrega >= ${w.dataStart}::date
            AND data_entrega < ${w.dataEnd}::date
            AND COALESCE(valorp, 0) > 0
            AND squad IS NOT NULL
            AND TRIM(squad) != ''
          GROUP BY squad
        `),
        // Espelha query 17 (MRR por squad no início do período) — FOTO em
        // w.dataStart (snapshot do 1º dia do tri = fim do tri anterior), fallback
        // ao snapshot mais recente ≤ dataStart.
        db.execute(sql`
          WITH ultimo_snapshot_ant AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${w.dataStart}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${w.dataStart}::date)
            ) as snap
          )
          SELECT
            h.squad,
            COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as mrr
          FROM "Clickup".cup_data_hist h
          JOIN ultimo_snapshot_ant us ON h.data_snapshot = us.snap
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
            AND h.valorr IS NOT NULL
            AND h.squad IS NOT NULL
            AND TRIM(h.squad) != ''
          GROUP BY h.squad
        `),
        // Espelha query 17b (MRR total no início do período, p/ meta de churn = 8%
        // do MRR ativo — ADENDO churnMetaMensal) — FOTO em w.dataStart, mesmo
        // fallback e mesmo filtro de status do Q9/Q15, sem agrupar por squad.
        db.execute(sql`
          WITH ultimo_snapshot_ant AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${w.dataStart}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${w.dataStart}::date)
            ) as snap
          )
          SELECT
            COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) as mrr_total
          FROM "Clickup".cup_data_hist h
          JOIN ultimo_snapshot_ant us ON h.data_snapshot = us.snap
          WHERE h.status IN ('ativo', 'onboarding', 'triagem')
            AND h.valorr IS NOT NULL
        `),
        // Top 3 operadores (responsavel) por squad no snapshot de w.fotoDate, por MRR
        // por FATURAMENTO = MRR ativo (snapshot fim do tri) + pontual entregue no tri.
        // Espelha o padrão de foto do "Top Operadores" do mensal (Q24a/24b, ~L1042-1165)
        // com match flexível ClickUp×rh_pessoal, mas particionado por squad (ROW_NUMBER).
        // O pontual (cup_contratos) é somado por operador no tri e atribuído à squad do
        // operador no snapshot de MRR (join por nome) — evita divergência de rótulo de
        // squad entre as duas tabelas; operador em 2 squads é caso raro.
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${w.fotoDate}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${w.fotoDate}::date)
            ) as snap
          ),
          mrr_por_resp AS (
            SELECT h.squad, h.responsavel AS nome,
              COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) AS mrr
            FROM "Clickup".cup_data_hist h
            JOIN ultimo_snapshot us ON h.data_snapshot = us.snap
            WHERE h.status IN ('ativo', 'onboarding', 'triagem')
              AND h.valorr IS NOT NULL
              AND h.responsavel IS NOT NULL AND TRIM(h.responsavel) != ''
              AND h.squad IS NOT NULL AND TRIM(h.squad) != ''
            GROUP BY h.squad, h.responsavel
          ),
          pontual_por_resp AS (
            SELECT responsavel AS nome,
              COALESCE(SUM(valorp::numeric), 0) AS pontual
            FROM "Clickup".cup_contratos
            WHERE LOWER(TRIM(status)) = 'entregue'
              AND data_entrega >= ${w.dataStart}::date
              AND data_entrega < ${w.dataEnd}::date
              AND valorp IS NOT NULL AND valorp::numeric > 0
              AND responsavel IS NOT NULL AND TRIM(responsavel) != ''
            GROUP BY responsavel
          ),
          por_resp AS (
            SELECT m.squad, m.nome, m.mrr,
              COALESCE(p.pontual, 0) AS pontual,
              m.mrr + COALESCE(p.pontual, 0) AS faturamento
            FROM mrr_por_resp m
            LEFT JOIN pontual_por_resp p ON LOWER(TRIM(m.nome)) = LOWER(TRIM(p.nome))
          ),
          ranked AS (
            SELECT *,
              ROW_NUMBER() OVER (PARTITION BY squad ORDER BY faturamento DESC) AS rn,
              SUM(faturamento) OVER (PARTITION BY squad) AS squad_total,
              COUNT(*) OVER (PARTITION BY squad) AS squad_operadores
            FROM por_resp
            WHERE faturamento > 0
          )
          SELECT r.squad, r.nome, r.mrr, r.pontual, r.faturamento, r.rn::int AS rn,
                 r.squad_total, r.squad_operadores::int AS squad_operadores,
                 p.foto AS "fotoUrl", p.cargo
          FROM ranked r
          LEFT JOIN LATERAL (
            SELECT rp.cargo,
              COALESCE(NULLIF(a_id.picture, ''), NULLIF(a_turbo.picture, ''), NULLIF(a_pessoal.picture, '')) AS foto
            FROM "Inhire".rh_pessoal rp
            LEFT JOIN cortex_core.auth_users a_id ON rp.user_id IS NOT NULL AND rp.user_id = a_id.id
            LEFT JOIN cortex_core.auth_users a_turbo ON rp.email_turbo IS NOT NULL AND LOWER(TRIM(rp.email_turbo)) = LOWER(TRIM(a_turbo.email))
            LEFT JOIN cortex_core.auth_users a_pessoal ON rp.email_pessoal IS NOT NULL AND LOWER(TRIM(rp.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
            WHERE rp.status = 'Ativo'
              AND (
                LOWER(TRIM(rp.nome)) = LOWER(TRIM(r.nome))
                OR (
                  split_part(LOWER(TRIM(rp.nome)), ' ', 1) = split_part(LOWER(TRIM(r.nome)), ' ', 1)
                  AND regexp_replace(LOWER(TRIM(r.nome)), '^.* ', '') = ANY(string_to_array(LOWER(TRIM(rp.nome)), ' '))
                )
              )
            ORDER BY (LOWER(TRIM(rp.nome)) = LOWER(TRIM(r.nome))) DESC,
                     (COALESCE(NULLIF(a_id.picture, ''), NULLIF(a_turbo.picture, ''), NULLIF(a_pessoal.picture, '')) IS NOT NULL) DESC
            LIMIT 1
          ) p ON true
          WHERE r.rn <= 3
          ORDER BY r.squad_total DESC, r.rn
        `),
        // Squad Black = ACCOUNTS (gerentes de conta). O responsavel de entrega não
        // reflete a carteira: o gerente é o `cs_responsavel`, o mesmo em TODOS os
        // contratos abaixo dos clientes dele. Faturamento do account = MRR (snapshot,
        // por cs_responsavel) + pontual entregue no tri (cup_contratos, por
        // cs_responsavel). Top 3 por faturamento; total = carteira toda dos accounts.
        db.execute(sql`
          WITH ultimo_snapshot AS (
            SELECT COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = ${w.fotoDate}::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${w.fotoDate}::date)
            ) as snap
          ),
          mrr_por_cs AS (
            SELECT h.cs_responsavel AS nome,
              COALESCE(SUM(CASE WHEN h.valorr::numeric > 0 THEN h.valorr::numeric END), 0) AS mrr
            FROM "Clickup".cup_data_hist h
            JOIN ultimo_snapshot us ON h.data_snapshot = us.snap
            WHERE h.status IN ('ativo', 'onboarding', 'triagem')
              AND h.valorr IS NOT NULL
              AND h.cs_responsavel IS NOT NULL AND TRIM(h.cs_responsavel) != ''
            GROUP BY h.cs_responsavel
          ),
          pontual_por_cs AS (
            SELECT cs_responsavel AS nome,
              COALESCE(SUM(valorp::numeric), 0) AS pontual
            FROM "Clickup".cup_contratos
            WHERE LOWER(TRIM(status)) = 'entregue'
              AND data_entrega >= ${w.dataStart}::date
              AND data_entrega < ${w.dataEnd}::date
              AND valorp IS NOT NULL AND valorp::numeric > 0
              AND cs_responsavel IS NOT NULL AND TRIM(cs_responsavel) != ''
            GROUP BY cs_responsavel
          ),
          combined AS (
            SELECT COALESCE(m.nome, p.nome) AS nome,
              COALESCE(m.mrr, 0) AS mrr,
              COALESCE(p.pontual, 0) AS pontual,
              COALESCE(m.mrr, 0) + COALESCE(p.pontual, 0) AS faturamento
            FROM mrr_por_cs m
            FULL OUTER JOIN pontual_por_cs p ON LOWER(TRIM(m.nome)) = LOWER(TRIM(p.nome))
          ),
          ranked AS (
            SELECT *,
              ROW_NUMBER() OVER (ORDER BY faturamento DESC) AS rn,
              SUM(faturamento) OVER () AS squad_total,
              COUNT(*) OVER () AS squad_operadores
            FROM combined
            WHERE faturamento > 0
          )
          SELECT r.nome, r.mrr, r.pontual, r.faturamento, r.rn::int AS rn,
                 r.squad_total, r.squad_operadores::int AS squad_operadores,
                 p.foto AS "fotoUrl", p.cargo
          FROM ranked r
          LEFT JOIN LATERAL (
            SELECT rp.cargo,
              COALESCE(NULLIF(a_id.picture, ''), NULLIF(a_turbo.picture, ''), NULLIF(a_pessoal.picture, '')) AS foto
            FROM "Inhire".rh_pessoal rp
            LEFT JOIN cortex_core.auth_users a_id ON rp.user_id IS NOT NULL AND rp.user_id = a_id.id
            LEFT JOIN cortex_core.auth_users a_turbo ON rp.email_turbo IS NOT NULL AND LOWER(TRIM(rp.email_turbo)) = LOWER(TRIM(a_turbo.email))
            LEFT JOIN cortex_core.auth_users a_pessoal ON rp.email_pessoal IS NOT NULL AND LOWER(TRIM(rp.email_pessoal)) = LOWER(TRIM(a_pessoal.email))
            WHERE rp.status = 'Ativo'
              AND (
                LOWER(TRIM(rp.nome)) = LOWER(TRIM(r.nome))
                OR (
                  split_part(LOWER(TRIM(rp.nome)), ' ', 1) = split_part(LOWER(TRIM(r.nome)), ' ', 1)
                  AND regexp_replace(LOWER(TRIM(r.nome)), '^.* ', '') = ANY(string_to_array(LOWER(TRIM(rp.nome)), ' '))
                )
              )
            ORDER BY (LOWER(TRIM(rp.nome)) = LOWER(TRIM(r.nome))) DESC,
                     (COALESCE(NULLIF(a_id.picture, ''), NULLIF(a_turbo.picture, ''), NULLIF(a_pessoal.picture, '')) IS NOT NULL) DESC
            LIMIT 1
          ) p ON true
          WHERE r.rn <= 3
          ORDER BY r.faturamento DESC
        `),
      ]);

      // Normaliza nome de squad p/ casar fontes diferentes (emoji, sufixo "(OFF)",
      // caixa) — igual ao mensal (relatorioMensalSlides.ts ~L1464).
      const normalizeSquadName = (s: string): string =>
        (s || "").replace(/^[^A-Za-z]+/, "").replace(/\s*\(OFF\)\s*$/i, "").trim().toLowerCase();

      // Pontual entregue no tri por squad (substitui o "pontual" do snapshot, que é backlog em aberto)
      const pontualEntregueBySquad: Record<string, number> = {};
      (pontualEntregueSquadRows.rows as any[]).forEach((row: any) => {
        const key = normalizeSquadName(row.squad);
        pontualEntregueBySquad[key] = (pontualEntregueBySquad[key] || 0) + (parseFloat(row.pontual) || 0);
      });

      // Ranking squads — ordena por (mrr + pontual entregue no tri) desc, igual ao mensal.
      const rankingSquads = (rankingSquadsRows.rows as any[])
        .map((row: any) => {
          const mrr = parseFloat(row.mrr) || 0;
          const pontual = pontualEntregueBySquad[normalizeSquadName(row.squad)] || 0;
          return {
            squad: row.squad,
            mrr,
            pontual,
            contratos: parseInt(row.contratos) || 0,
            clientes: parseInt(row.clientes) || 0,
            _total: mrr + pontual,
          };
        })
        .sort((a, b) => b._total - a._total)
        .map(({ _total, ...rest }, i) => ({ ...rest, posicao: i + 1 }));

      // Churn por squad no tri (soma), mantendo a distinção abonado (churn_brl/count)
      // vs total (churn_total_brl/count) — igual ao mensal (~L1493-1513).
      const churnBySquad: Record<string, { brl: number; count: number; totalBrl: number; totalCount: number; clientes: any[] }> = {};
      (churnSquadsRows.rows as any[]).forEach((row: any) => {
        const key = normalizeSquadName(row.squad);
        const prev = churnBySquad[key];
        const cur = {
          brl: parseFloat(row.churn_brl) || 0,
          count: parseInt(row.churn_count) || 0,
          totalBrl: parseFloat(row.churn_total_brl) || 0,
          totalCount: parseInt(row.churn_total_count) || 0,
          clientes: Array.isArray(row.clientes) ? row.clientes : [],
        };
        churnBySquad[key] = prev
          ? {
              brl: prev.brl + cur.brl,
              count: prev.count + cur.count,
              totalBrl: prev.totalBrl + cur.totalBrl,
              totalCount: prev.totalCount + cur.totalCount,
              clientes: [...prev.clientes, ...cur.clientes],
            }
          : cur;
      });

      const mrrAnteriorBySquad: Record<string, number> = {};
      (mrrAnteriorSquadsRows.rows as any[]).forEach((row: any) => {
        const key = normalizeSquadName(row.squad);
        mrrAnteriorBySquad[key] = (mrrAnteriorBySquad[key] || 0) + (parseFloat(row.mrr) || 0);
      });

      // Squads ocultos do slide "Detalhes por Squad" (não impacta ranking nem
      // totais) — mesma lista do mensal (relatorioMensalSlides.ts ~L1522).
      const SQUADS_OCULTOS_DETALHES = new Set(["comercial", "makers", "turbo interno", "squad x"]);

      // Expansão (vendas/abatimento NRR) somada nos meses do trimestre, por squad
      // normalizada — espelho da tabela manual do mensal (ver topo do arquivo).
      const expansaoTri: Record<string, { vendas: number; abatimento: number }> = {};
      for (const mes of w.meses) {
        const porSquad = VENDAS_EXPANSAO_POR_MES_ESPELHO[mes];
        if (!porSquad) continue;
        for (const [sq, v] of Object.entries(porSquad)) {
          const cur = expansaoTri[sq] ?? { vendas: 0, abatimento: 0 };
          expansaoTri[sq] = { vendas: cur.vendas + v.vendas, abatimento: cur.abatimento + v.abatimento };
        }
      }

      const squadDetails = (rankingSquadsRows.rows as any[])
        .filter((row: any) => !SQUADS_OCULTOS_DETALHES.has(normalizeSquadName(row.squad)))
        .map((row: any) => {
          const mrr = parseFloat(row.mrr) || 0;
          const pontual = pontualEntregueBySquad[normalizeSquadName(row.squad)] || 0; // pontual entregue no tri (não em aberto)
          const contratos = parseInt(row.contratos) || 0;
          const clientes = parseInt(row.clientes) || 0;
          const churn = churnBySquad[normalizeSquadName(row.squad)] || { brl: 0, count: 0, totalBrl: 0, totalCount: 0, clientes: [] };
          const mrrAnt = mrrAnteriorBySquad[normalizeSquadName(row.squad)] || 0;
          const ticketMedio = contratos > 0 ? mrr / contratos : 0;
          // Churn % = churn do tri / MRR no início do tri. Squad novo (sem base no
          // início do tri): usa o MRR do próprio tri como base — igual ao mensal.
          const churnBase = mrrAnt > 0 ? mrrAnt : mrr;
          const churnPct = churnBase > 0 ? (churn.brl / churnBase) * 100 : 0;
          const churnTotalPct = churnBase > 0 ? (churn.totalBrl / churnBase) * 100 : 0;
          // Expansão do trimestre (soma dos meses com entrada na tabela-espelho);
          // squads sem entrada ficam 0 — mesmo comportamento do mensal.
          // nrrBrl = churn s/ abonados − abatimento (fórmula idêntica ao mensal).
          const expansao = expansaoTri[normalizeSquadName(row.squad)] ?? { vendas: 0, abatimento: 0 };
          const vendasMes = expansao.vendas;
          const expansaoNrr = expansao.abatimento;
          const nrrBrl = churn.brl - expansaoNrr;
          const nrrPct = churnBase > 0 ? (nrrBrl / churnBase) * 100 : 0;

          return {
            squad: row.squad,
            mrr,
            pontual,
            ticketMedio: Math.round(ticketMedio),
            clientes,
            churnPct: Math.round(churnPct * 10) / 10,
            churnBrl: churn.brl,
            churnTotalPct: Math.round(churnTotalPct * 10) / 10,
            churnTotalBrl: churn.totalBrl,
            churnClientes: [...churn.clientes].sort((a, b) => (b.valor || 0) - (a.valor || 0)),
            vendasMes,
            expansaoNrr,
            nrrBrl,
            nrrPct: Math.round(nrrPct * 10) / 10,
            mrrBase: churnBase,
            evolucaoMrr: mrr - mrrAnt,
          };
        });

      // Top 3 operadores por squad (slide "Operadores por Squad"). Agrupa as rows já
      // vindas ordenadas (squad_total DESC, rn), exclui squads não-operacionais
      // (SQUADS_OCULTOS_DETALHES + "(OFF)") e mantém as squads de maior MRR total.
      const operadoresMap = new Map<string, {
        squad: string;
        totalFaturamento: number;
        numOperadores: number;
        operadores: { nome: string; faturamento: number; mrr: number; pontual: number; fotoUrl: string | null; cargo: string | null }[];
      }>();
      for (const row of operadoresPorSquadRows.rows as any[]) {
        const norm = normalizeSquadName(row.squad);
        if (SQUADS_OCULTOS_DETALHES.has(norm)) continue;
        if (/\(off\)/i.test(row.squad || "")) continue;
        let entry = operadoresMap.get(norm);
        if (!entry) {
          entry = {
            squad: row.squad,
            totalFaturamento: parseFloat(row.squad_total) || 0,
            numOperadores: parseInt(row.squad_operadores) || 0,
            operadores: [],
          };
          operadoresMap.set(norm, entry);
        }
        entry.operadores.push({
          nome: row.nome,
          faturamento: parseFloat(row.faturamento) || 0,
          mrr: parseFloat(row.mrr) || 0,
          pontual: parseFloat(row.pontual) || 0,
          fotoUrl: (row.fotoUrl as string) || null,
          cargo: (row.cargo as string) || null,
        });
      }
      // Black = accounts: sobrescreve o card com os gerentes de conta (cs_responsavel)
      // e a carteira toda, em vez do responsavel de entrega (que não reflete a squad).
      const accountsRowsArr = accountsRows.rows as any[];
      if (accountsRowsArr.length > 0) {
        operadoresMap.set("black", {
          squad: "🐑 Black",
          totalFaturamento: parseFloat(accountsRowsArr[0].squad_total) || 0,
          numOperadores: parseInt(accountsRowsArr[0].squad_operadores) || 0,
          operadores: accountsRowsArr.map((row) => ({
            nome: row.nome,
            faturamento: parseFloat(row.faturamento) || 0,
            mrr: parseFloat(row.mrr) || 0,
            pontual: parseFloat(row.pontual) || 0,
            fotoUrl: (row.fotoUrl as string) || null,
            cargo: (row.cargo as string) || null,
          })),
        });
      }

      const operadoresPorSquad = Array.from(operadoresMap.values())
        .sort((a, b) => b.totalFaturamento - a.totalFaturamento)
        .slice(0, 6);

      // Meta de churn do tri = Σ (8% × MRR do fim do mês ANTERIOR) para cada mês
      // computado do trimestre — mesma régua do mensal, aplicada mês a mês (a base
      // acompanha a evolução do MRR; não é 8% × base fixa do início × nº de meses).
      // As fotos mensais vêm de mrrChurnPorMes (query do trend, lookback 18 meses).
      // Fallback p/ mês-base sem snapshot: MRR total no início do tri (Q17b).
      const mrrTotalInicioTri = parseFloat((mrrAnteriorTotalRows.rows as any[])[0]?.mrr_total) || 0;
      const mrrFimDoMes = new Map(mrrChurnPorMes.map((r) => [r.month, r.mrr]));
      const mesAnterior = (m: string): string => {
        const [a, mm] = m.split("-").map(Number);
        return mm === 1 ? `${a - 1}-12` : `${a}-${String(mm - 1).padStart(2, "0")}`;
      };
      turboMetrics.churnMetaMensal = w.mesesComputados.reduce(
        (acc, m) => acc + (mrrFimDoMes.get(mesAnterior(m)) || mrrTotalInicioTri) * 0.08,
        0,
      );

      // ADENDO (fix): receitaChurnSeries por TRIMESTRE (não mais por mês) — alimenta o
      // gráfico "Faturamento x Churn" e a mini-série "MRR Ativo" do SlideTurboMetrics.tsx
      // reaproveitado do mensal, agora com eixo X mostrando Q1/Q2/... em vez dos 3 meses
      // do trimestre. Agrega as MESMAS linhas mensais já buscadas por mrrChurnRows (que
      // cobrem ~18 meses de lookback terminando em w.dataEnd, gerando ~5-6 trimestres):
      // mrr = foto do ÚLTIMO mês do trimestre (maior "YYYY-MM"); pontual/churnBrl = soma
      // dos meses do trimestre; churnPct recalculado a partir dos agregados do tri.
      const quarterOfMonth = (m: string): number => Math.floor((parseInt(m.split("-")[1], 10) - 1) / 3) + 1;
      const receitaChurnByQuarter = new Map<string, { ano: number; quarter: number; mrrMonth: string; mrr: number; pontual: number; churnBrl: number }>();
      for (const r of mrrChurnRows.rows as any[]) {
        const month = r.month as string;
        const ano = parseInt(month.split("-")[0], 10);
        const quarter = quarterOfMonth(month);
        const key = `${ano}-Q${quarter}`;
        if (!receitaChurnByQuarter.has(key)) {
          receitaChurnByQuarter.set(key, { ano, quarter, mrrMonth: "", mrr: 0, pontual: 0, churnBrl: 0 });
        }
        const bucket = receitaChurnByQuarter.get(key)!;
        bucket.pontual += parseFloat(r.pontual) || 0;
        bucket.churnBrl += parseFloat(r.churn_brl) || 0;
        if (month >= bucket.mrrMonth) { bucket.mrrMonth = month; bucket.mrr = parseFloat(r.mrr) || 0; }
      }
      turboMetrics.receitaChurnSeries = Array.from(receitaChurnByQuarter.values())
        .sort((a, b) => (a.ano - b.ano) || (a.quarter - b.quarter))
        .map((b) => ({
          month: `${b.ano}-Q${b.quarter}`,
          label: `Q${b.quarter} ${String(b.ano).slice(2)}`,
          mrr: b.mrr,
          pontual: b.pontual,
          churnBrl: b.churnBrl,
          churnPct: b.mrr > 0 ? Math.round((b.churnBrl / b.mrr) * 1000) / 10 : 0,
        }))
        // Descarta trimestres sem snapshot de MRR (foto = 0), mesma régua do
        // aggregateTrend acima — mantém o gráfico "Faturamento x Churn" consistente
        // com o gráfico "Evolução por Trimestre".
        .filter((s) => s.mrr > 0);

      // Bloco pontualData (Task 10): espelha as queries 29-33 (em aberto por
      // serviço, aquisição, entregas por squad, entregas por produto × mês e
      // tempo médio de entrega) do relatorioMensalSlides.ts, re-janeladas para
      // o trimestre. Q29 é dateless no mensal (filtro só por status, sem
      // range de data) — reflete o estado ATUAL do estoque (FOTO "estado
      // corrente", igual ao mensal, sem amarrar a nenhuma data da janela); as
      // demais (Q30/Q31/Q32/Q33) são FLUXO somado no range do tri
      // (w.dataStart..w.dataEnd). variacaoEstoque é derivado em JS a partir de
      // aquisição − entregas do tri, igual à montagem do mensal (~L1720-1724),
      // que também já é fluxo (não delta de snapshot).
      const [
        pontualEmAbertoRows,
        pontualAquisicaoRows,
        pontualEntregasSquadRows,
        pontualEntregasProdutoMesRows,
        pontualTempoMedioRows,
      ] = await Promise.all([
        // Espelha query 29 (em aberto por serviço) — estado ATUAL, sem filtro
        // de data (mesma query do mensal, dateless).
        db.execute(sql`
          SELECT
            CASE
              WHEN LOWER(servico) LIKE '%creators%' THEN 'Creators'
              ELSE COALESCE(NULLIF(TRIM(servico), ''), 'Sem serviço')
            END as servico,
            COUNT(*)::int as contratos,
            COALESCE(SUM(valorp::numeric), 0) as valor
          FROM "Clickup".cup_contratos
          WHERE valorp IS NOT NULL AND valorp::numeric > 0
            AND LOWER(TRIM(status)) IN ('ativo','triagem','onboarding','em cancelamento','pausado')
          GROUP BY
            CASE
              WHEN LOWER(servico) LIKE '%creators%' THEN 'Creators'
              ELSE COALESCE(NULLIF(TRIM(servico), ''), 'Sem serviço')
            END
          ORDER BY valor DESC
        `),
        // Espelha query 30 (aquisição pontual: contratos criados com valorp >
        // 0) — FLUXO somado no tri.
        db.execute(sql`
          SELECT
            COUNT(*)::int as contratos,
            COALESCE(SUM(valorp::numeric), 0) as valor
          FROM "Clickup".cup_contratos
          WHERE valorp IS NOT NULL AND valorp::numeric > 0
            AND data_criado >= ${w.dataStart}::date
            AND data_criado < ${w.dataEnd}::date
        `),
        // Espelha query 31 (entregas por squad) — FLUXO somado no tri.
        db.execute(sql`
          SELECT
            COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') as squad,
            COUNT(*)::int as contratos,
            COALESCE(SUM(valorp::numeric), 0) as valor
          FROM "Clickup".cup_contratos
          WHERE valorp IS NOT NULL AND valorp::numeric > 0
            AND LOWER(TRIM(status)) = 'entregue'
            AND data_entrega >= ${w.dataStart}::date
            AND data_entrega < ${w.dataEnd}::date
          GROUP BY COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
          ORDER BY valor DESC
        `),
        // Espelha query 32 (entregas por produto × mês) — troca o
        // EXTRACT(YEAR)=ano do mensal (cobre o ano inteiro) pelo range
        // w.dataStart..w.dataEnd, restringindo aos meses do tri (w.meses).
        db.execute(sql`
          SELECT
            TO_CHAR(data_entrega, 'YYYY-MM') as month,
            COALESCE(NULLIF(TRIM(produto), ''), 'Sem produto') as produto,
            COALESCE(SUM(valorp::numeric), 0) as valor
          FROM "Clickup".cup_contratos
          WHERE valorp IS NOT NULL AND valorp::numeric > 0
            AND LOWER(TRIM(status)) = 'entregue'
            AND data_entrega >= ${w.dataStart}::date
            AND data_entrega < ${w.dataEnd}::date
          GROUP BY TO_CHAR(data_entrega, 'YYYY-MM'), COALESCE(NULLIF(TRIM(produto), ''), 'Sem produto')
          ORDER BY month, valor DESC
        `),
        // Espelha query 33 (tempo médio de entrega por produto) — troca a
        // janela "últimos 6 meses antes do mês do relatório" do mensal por
        // w.dataStart..w.dataEnd, recalculando sobre as entregas do TRIMESTRE.
        db.execute(sql`
          SELECT
            COALESCE(NULLIF(TRIM(produto), ''), 'Sem produto') as produto,
            COUNT(*)::int as contratos,
            AVG(data_entrega - data_criado)::int as dias_medio
          FROM "Clickup".cup_contratos
          WHERE LOWER(TRIM(status)) = 'entregue'
            AND data_entrega IS NOT NULL
            AND data_criado IS NOT NULL
            AND data_entrega >= ${w.dataStart}::date
            AND data_entrega < ${w.dataEnd}::date
          GROUP BY COALESCE(NULLIF(TRIM(produto), ''), 'Sem produto')
          HAVING COUNT(*) >= 2
          ORDER BY dias_medio ASC
        `),
      ]);

      // Override manual: "Creators" em aberto corrigido devido a duplicação
      // nas entregas parceladas — mesmo valor validado do mensal
      // (relatorioMensalSlides.ts ~L1651). Como Q29 é dateless (estado
      // atual), o número não varia por trimestre.
      const CREATORS_OVERRIDE_VALOR = 711406;
      const emAbertoPorServico = (pontualEmAbertoRows.rows as any[])
        .map((row: any) => ({
          servico: row.servico,
          valor: row.servico === 'Creators'
            ? CREATORS_OVERRIDE_VALOR
            : (parseFloat(row.valor) || 0),
          contratos: parseInt(row.contratos) || 0,
        }))
        .sort((a, b) => b.valor - a.valor);
      const emAbertoTotalValor = emAbertoPorServico.reduce((s, r) => s + r.valor, 0);
      const emAbertoTotalContratos = emAbertoPorServico.reduce((s, r) => s + r.contratos, 0);

      const aquisicaoRow = (pontualAquisicaoRows.rows as any[])[0] || {};
      const aquisicaoValor = parseFloat(aquisicaoRow.valor) || 0;
      const aquisicaoContratos = parseInt(aquisicaoRow.contratos) || 0;

      const entregasPorSquad = (pontualEntregasSquadRows.rows as any[]).map((row: any) => ({
        squad: row.squad,
        valor: parseFloat(row.valor) || 0,
        contratos: parseInt(row.contratos) || 0,
      }));
      const entregasSquadTotal = entregasPorSquad.reduce((s, r) => s + r.valor, 0);

      // Agrupar entregas por produto x mês em { month, label, produtos: {...}, total },
      // igual ao mensal (relatorioMensalSlides.ts ~L1678-1698).
      const MESES_SHORT_PONTUAL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const entregasProdutoMesMap = new Map<string, { label: string; produtos: Record<string, number>; total: number }>();
      for (const row of pontualEntregasProdutoMesRows.rows as any[]) {
        const month = row.month as string;
        const produto = row.produto as string;
        const valor = parseFloat(row.valor) || 0;
        if (!entregasProdutoMesMap.has(month)) {
          const mNum = parseInt(month.split("-")[1]) - 1;
          entregasProdutoMesMap.set(month, {
            label: MESES_SHORT_PONTUAL[mNum] || month,
            produtos: {},
            total: 0,
          });
        }
        const entry = entregasProdutoMesMap.get(month)!;
        entry.produtos[produto] = (entry.produtos[produto] || 0) + valor;
        entry.total += valor;
      }
      const entregasPorProdutoMes = Array.from(entregasProdutoMesMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data }));

      const tempoMedioEntrega = (pontualTempoMedioRows.rows as any[]).map((row: any) => ({
        produto: row.produto,
        diasMedio: parseInt(row.dias_medio) || 0,
        contratos: parseInt(row.contratos) || 0,
      }));

      const pontualData = {
        emAberto: {
          valor: emAbertoTotalValor,
          contratos: emAbertoTotalContratos,
          porServico: emAbertoPorServico,
        },
        aquisicao: {
          valor: aquisicaoValor,
          contratos: aquisicaoContratos,
        },
        entregasMes: {
          porSquad: entregasPorSquad,
          total: entregasSquadTotal,
        },
        // Segue a mesma lógica do mensal: fluxo (entrou = aquisição, saiu =
        // entregas) na janela do tri — o mensal não usa delta de snapshot p/
        // este cálculo (relatorioMensalSlides.ts ~L1720-1724).
        variacaoEstoque: {
          entrou: aquisicaoValor,
          saiu: entregasSquadTotal,
          delta: aquisicaoValor - entregasSquadTotal,
        },
        entregasPorProdutoMes,
        tempoMedioEntrega,
      };

      // Bloco techData (Task 11): espelha as queries 18/18b/19/20/20b (tech KPIs
      // entregues/adicionados, projetos por tipo/mês, em aberto por tipo e
      // pipeline por status) do relatorioMensalSlides.ts, re-janeladas para o
      // trimestre. Q18/Q18b são FLUXO somado no range do tri (a AVG de
      // tempoMedio já é recalculada "de graça" pela query, pois é uma AVG única
      // sobre as linhas do range, não soma de médias mensais — RATIO natural);
      // Q19 mantém o grão mês a mês, restrito aos meses do tri; Q20/Q20b são
      // dateless no mensal (estado atual do backlog tech) e permanecem assim
      // (FOTO / estado corrente).
      const [
        techKpisEntreguesRows,
        techKpisAdicionadosRows,
        techEntregasPorTipoRows,
        techEmAbertoRows,
        techPipelineRows,
      ] = await Promise.all([
        // Espelha query 18 (tech entregues no período, ambas tabelas) — FLUXO
        // somado no tri. tempoMedio é recalculado pela própria AVG sobre o range.
        db.execute(sql`
          SELECT
            COUNT(*)::int as entregues,
            COALESCE(SUM(valor_p), 0)::numeric as valor_entregues,
            COALESCE(AVG(COALESCE(data_entregue, lancamento) - data_criada), 0)::numeric as tempo_medio
          FROM (
            SELECT data_entregue, lancamento, valor_p, data_criada FROM "Clickup".cup_projetos_tech_fechados
            UNION ALL
            SELECT data_entregue, lancamento, valor_p, data_criada FROM "Clickup".cup_projetos_tech
          ) combined
          WHERE COALESCE(data_entregue, lancamento) >= ${w.dataStart}::date
            AND COALESCE(data_entregue, lancamento) < ${w.dataEnd}::date
        `),
        // Espelha query 18b (tech adicionados no período, ambas tabelas) —
        // FLUXO somado no tri.
        db.execute(sql`
          SELECT
            COUNT(*)::int as adicionados,
            COALESCE(SUM(valor_p), 0)::numeric as valor_adicionados
          FROM (
            SELECT valor_p, data_criada FROM "Clickup".cup_projetos_tech
            UNION ALL
            SELECT valor_p, data_criada FROM "Clickup".cup_projetos_tech_fechados
          ) combined
          WHERE data_criada >= ${w.dataStart}::date
            AND data_criada < ${w.dataEnd}::date
        `),
        // Espelha query 19 (projetos por tipo/mês, ambas tabelas) — mantém o
        // grão mês a mês, trocando o lookback de 12 meses do mensal pelo range
        // do tri (naturalmente restringe aos meses do tri, w.meses).
        db.execute(sql`
          SELECT
            TO_CHAR(COALESCE(data_entregue, lancamento), 'YYYY-MM') as month,
            COALESCE(TRIM(tipo), 'Outros') as tipo,
            COUNT(*)::int as entregas,
            COALESCE(SUM(valor_p), 0)::numeric as receita
          FROM (
            SELECT data_entregue, lancamento, tipo, valor_p FROM "Clickup".cup_projetos_tech_fechados
            UNION ALL
            SELECT data_entregue, lancamento, tipo, valor_p FROM "Clickup".cup_projetos_tech
          ) combined
          WHERE COALESCE(data_entregue, lancamento) IS NOT NULL
            AND COALESCE(data_entregue, lancamento) >= ${w.dataStart}::date
            AND COALESCE(data_entregue, lancamento) < ${w.dataEnd}::date
          GROUP BY TO_CHAR(COALESCE(data_entregue, lancamento), 'YYYY-MM'), TRIM(tipo)
          ORDER BY month, tipo
        `),
        // Espelha query 20 (projetos em aberto por tipo) — dateless no mensal
        // (estado ATUAL do backlog tech); mantém sem filtro de data (FOTO /
        // estado corrente), igual ao mensal.
        db.execute(sql`
          SELECT
            COALESCE(TRIM(tipo), 'Outros') as tipo,
            COUNT(*)::int as quantidade,
            COALESCE(SUM(valor_p), 0)::numeric as valor
          FROM "Clickup".cup_projetos_tech
          GROUP BY TRIM(tipo)
          ORDER BY valor DESC
        `),
        // Espelha query 20b (pipeline tech por status) — dateless no mensal
        // (estado ATUAL); mantém sem filtro de data.
        db.execute(sql`
          SELECT
            COALESCE(TRIM(status_projeto), 'Sem Status') as status,
            COUNT(*)::int as quantidade
          FROM "Clickup".cup_projetos_tech
          GROUP BY TRIM(status_projeto)
          ORDER BY quantidade DESC
        `),
      ]);

      const techKpisEntregues = (techKpisEntreguesRows.rows as any[])[0] || {};
      const techKpisAdicionados = (techKpisAdicionadosRows.rows as any[])[0] || {};

      const techKpis = {
        entregues: parseInt(techKpisEntregues.entregues) || 0,
        valorEntregues: parseFloat(techKpisEntregues.valor_entregues) || 0,
        tempoMedio: Math.round(parseFloat(techKpisEntregues.tempo_medio) || 0),
        adicionados: parseInt(techKpisAdicionados.adicionados) || 0,
        valorAdicionados: parseFloat(techKpisAdicionados.valor_adicionados) || 0,
      };

      // Pivot entregas por tipo/mês para Recharts, igual ao mensal
      // (relatorioMensalSlides.ts ~L1580-1614), restrito aos meses do tri (w.meses).
      const MESES_SHORT_TECH = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const allTiposTech = new Set<string>();
      const entregasByMonthTech: Record<string, Record<string, number>> = {};
      const receitaByMonthTech: Record<string, Record<string, number>> = {};
      (techEntregasPorTipoRows.rows as any[]).forEach((row: any) => {
        const tipo = row.tipo || "Outros";
        allTiposTech.add(tipo);
        if (!entregasByMonthTech[row.month]) entregasByMonthTech[row.month] = {};
        if (!receitaByMonthTech[row.month]) receitaByMonthTech[row.month] = {};
        entregasByMonthTech[row.month][tipo] = parseInt(row.entregas) || 0;
        receitaByMonthTech[row.month][tipo] = parseFloat(row.receita) || 0;
      });
      const tiposListTech = Array.from(allTiposTech);

      const techEntregasPorTipo = w.meses.map((month) => {
        const mNum = parseInt(month.split("-")[1]) - 1;
        const entry: Record<string, any> = { month, label: MESES_SHORT_TECH[mNum] || month };
        tiposListTech.forEach((t) => { entry[t] = entregasByMonthTech[month]?.[t] || 0; });
        return entry;
      });
      const techReceitaPorTipo = w.meses.map((month) => {
        const mNum = parseInt(month.split("-")[1]) - 1;
        const entry: Record<string, any> = { month, label: MESES_SHORT_TECH[mNum] || month };
        tiposListTech.forEach((t) => { entry[t] = receitaByMonthTech[month]?.[t] || 0; });
        return entry;
      });

      const techEmAbertoPorTipo = (techEmAbertoRows.rows as any[]).map((row: any) => ({
        tipo: row.tipo || "Outros",
        quantidade: parseInt(row.quantidade) || 0,
        valor: parseFloat(row.valor) || 0,
      }));

      // Ordem natural do pipeline tech, igual ao mensal (~L1622-1638).
      const PIPELINE_ORDER = [
        'não iniciado', 'kickoff', 'pronto p/ design', 'design', 'design review',
        'pronto p/ dev', 'dev', 'dev review', 'pronto para lançar', 'bloqueado',
      ];
      const pipelineRaw = (techPipelineRows.rows as any[]).map((row: any) => ({
        status: row.status,
        quantidade: parseInt(row.quantidade) || 0,
      }));
      const techPipeline = pipelineRaw
        .filter((p: any) => p.status !== 'pausado')
        .sort((a: any, b: any) => {
          const ia = PIPELINE_ORDER.indexOf(a.status);
          const ib = PIPELINE_ORDER.indexOf(b.status);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });

      const techData = {
        kpis: techKpis,
        mesLabel: w.label,
        entregasPorTipo: techEntregasPorTipo,
        receitaPorTipo: techReceitaPorTipo,
        emAbertoPorTipo: techEmAbertoPorTipo,
        pipeline: techPipeline,
      };

      // Faturável do trimestre (decisão 2026-07-09: sem Conta Azul, sem
      // inadimplência/impostos): Σ MRR ativo (foto do fim de cada mês computado
      // do tri) + pontual entregue no tri. Fontes operacionais — cup_data_hist
      // (MRR) e cup_contratos (entregas) — reaproveitando as linhas mensais que
      // a query do trend já busca (mrrChurnRows: month/mrr/pontual).
      const faturavelPorMes = (mrrChurnRows.rows as any[])
        .filter((r: any) => w.mesesComputados.includes(r.month))
        .map((r: any) => {
          const m = parseInt(r.month.split("-")[1]) - 1;
          const mrr = parseFloat(r.mrr) || 0;
          const pontual = parseFloat(r.pontual) || 0;
          return { month: r.month as string, label: MESES_SHORT_TECH[m] || r.month, mrr, pontual, total: mrr + pontual };
        });
      const faturavel = {
        mrrSoma: faturavelPorMes.reduce((a, r) => a + r.mrr, 0),
        pontualEntregue: faturavelPorMes.reduce((a, r) => a + r.pontual, 0),
        total: faturavelPorMes.reduce((a, r) => a + r.total, 0),
        porMes: faturavelPorMes,
      };

      // Tickets médios por CLIENTE, mesma régua nos dois lados:
      // recorrente = MRR (foto fim do tri) ÷ clientes recorrentes ativos (foto);
      // pontual   = receita pontual do tri ÷ clientes distintos atendidos no tri.
      const clientesRecAtivos = parseInt(turboMrr.clientes_rec_ativos) || 0;
      const clientesPontuais = parseInt(turboFat.clientes_pontuais) || 0;
      const ticketsCliente = {
        recorrente: {
          ticketMedio: clientesRecAtivos > 0 ? (parseFloat(turboMrr.mrr_ativo) || 0) / clientesRecAtivos : 0,
          clientes: clientesRecAtivos,
        },
        pontual: {
          ticketMedio: clientesPontuais > 0 ? (parseFloat(turboFat.faturamento_pontual) || 0) / clientesPontuais : 0,
          clientes: clientesPontuais,
        },
      };

      res.json({
        trimestre: w.trimestre,
        label: w.label,
        parcial: w.parcial,
        mesesComputados: w.mesesComputados,
        trend,
        ticketsCliente,
        turboMetrics,
        contratosMes,
        rankingClosers,
        topPontual,
        rankingSDRs,
        topReunioes,
        rankingSquads,
        squadDetails,
        operadoresPorSquad,
        pontualData,
        techData,
        faturavel,
      });
    } catch (error: any) {
      console.error("[reports/trimestral] Error:", error?.message || error);
      res.status(500).json({ error: "Erro ao gerar dados do reporte trimestral", details: error?.message });
    }
  });
}

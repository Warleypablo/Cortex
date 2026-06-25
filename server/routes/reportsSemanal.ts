import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { calcularJanelas, montarKpi, type Janela, type Kpi } from "./reportsSemanal.helpers";

// "Hoje" no fuso de São Paulo, em 'YYYY-MM-DD'.
function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

// --- MRR Ativo: snapshot mais recente <= fim, deduplicado por id_subtask ---
async function mrrAtivoNaData(fim: string): Promise<number> {
  const r = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d
      FROM "Clickup".cup_data_hist
      WHERE data_snapshot <= ${fim}::date
    ),
    linhas AS (
      SELECT DISTINCT ON (h.id_subtask) h.id_subtask, h.valorr, h.status
      FROM "Clickup".cup_data_hist h, snap
      WHERE h.data_snapshot = snap.d
      ORDER BY h.id_subtask, h.valorr DESC NULLS LAST
    )
    SELECT COALESCE(SUM(valorr::numeric), 0) AS mrr
    FROM linhas
    WHERE status IN ('ativo','onboarding','triagem') AND valorr IS NOT NULL
  `);
  return num((r.rows[0] as any)?.mrr);
}

// --- Churn recorrente: view ajustada por data_solicitacao_encerramento ---
async function churnNaJanela(j: Janela): Promise<{ valor: number; qtd: number }> {
  const r = await db.execute(sql`
    SELECT
      COALESCE(SUM(valor_r::numeric), 0) AS valor,
      COUNT(*) AS qtd
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE data_solicitacao_encerramento IS NOT NULL
      AND data_solicitacao_encerramento >= ${j.inicio}::date
      AND data_solicitacao_encerramento <= ${j.fim}::date
      AND valor_r > 0
  `);
  const row = r.rows[0] as any;
  return { valor: num(row?.valor), qtd: num(row?.qtd) };
}

// --- Entregas pontuais: itens que flipparam para 'entregue' na janela (delta de snapshots) ---
async function entregasPontuaisNaJanela(j: Janela): Promise<{ valor: number; qtd: number }> {
  const r = await db.execute(sql`
    WITH snap_fim AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${j.fim}::date
    ),
    snap_ini AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot < ${j.inicio}::date
    ),
    entregue_fim AS (
      SELECT DISTINCT ON (h.id_subtask) h.id_subtask, h.valorp
      FROM "Clickup".cup_data_hist h, snap_fim
      WHERE h.data_snapshot = snap_fim.d AND h.status = 'entregue' AND h.valorp > 0
      ORDER BY h.id_subtask
    ),
    estado_ini AS (
      SELECT DISTINCT ON (h.id_subtask) h.id_subtask, h.status
      FROM "Clickup".cup_data_hist h, snap_ini
      WHERE h.data_snapshot = snap_ini.d
      ORDER BY h.id_subtask
    )
    SELECT
      COUNT(*) AS qtd,
      COALESCE(SUM(e.valorp::numeric), 0) AS valor
    FROM entregue_fim e
    LEFT JOIN estado_ini i ON i.id_subtask = e.id_subtask
    WHERE i.status IS DISTINCT FROM 'entregue'
  `);
  const row = r.rows[0] as any;
  return { valor: num(row?.valor), qtd: num(row?.qtd) };
}

// --- Churn pontual: contratos de entrega cancelados na janela (proxy datável) ---
async function churnPontualNaJanela(j: Janela): Promise<{ valor: number; qtd: number }> {
  const r = await db.execute(sql`
    SELECT
      COUNT(*) AS qtd,
      COALESCE(SUM(valorp::numeric), 0) AS valor
    FROM "Clickup".cup_contratos
    WHERE servico ILIKE '%entrega%'
      AND status IN ('cancelado/inativo','não usar')
      AND valorp > 0
      AND data_solicitacao_encerramento >= ${j.inicio}::date
      AND data_solicitacao_encerramento <= ${j.fim}::date
  `);
  const row = r.rows[0] as any;
  return { valor: num(row?.valor), qtd: num(row?.qtd) };
}

// Executa um cálculo das 2 janelas com tolerância a falha → KPI null em erro.
async function calcKpi(
  fn: (j: Janela) => Promise<number>,
  janelas: { atual: Janela; anterior: Janela },
  betterDirection: "up" | "down",
): Promise<Kpi> {
  try {
    const [a, b] = await Promise.all([fn(janelas.atual), fn(janelas.anterior)]);
    return montarKpi(a, b, betterDirection);
  } catch (e) {
    console.error("[reports/semanal] KPI falhou:", e);
    return montarKpi(null, null, betterDirection);
  }
}

export function registerReportsSemanalRoutes(app: Express) {
  app.get("/api/reports/semanal", async (req, res) => {
    try {
      const ate = (typeof req.query.ate === "string" && req.query.ate) || hojeSP();
      const janelas = calcularJanelas(ate);

      // MRR Ativo é snapshot por data (fim de cada janela).
      const mrrAtivo = await calcKpi(
        (j) => mrrAtivoNaData(j.fim),
        janelas,
        "up",
      ).catch(() => montarKpi(null, null, "up"));

      // Os outros 3 retornam {valor, qtd}; preservamos qtd à parte.
      const churn = await calcKpi((j) => churnNaJanela(j).then((x) => x.valor), janelas, "down");

      let entregasPontuais: Kpi & { qtdAtual: number | null; qtdAnterior: number | null };
      try {
        const [a, b] = await Promise.all([
          entregasPontuaisNaJanela(janelas.atual),
          entregasPontuaisNaJanela(janelas.anterior),
        ]);
        entregasPontuais = { ...montarKpi(a.valor, b.valor, "up"), qtdAtual: a.qtd, qtdAnterior: b.qtd };
      } catch (e) {
        console.error("[reports/semanal] entregasPontuais falhou:", e);
        entregasPontuais = { ...montarKpi(null, null, "up"), qtdAtual: null, qtdAnterior: null };
      }

      let churnPontual: Kpi & { qtdAtual: number | null; qtdAnterior: number | null };
      try {
        const [a, b] = await Promise.all([
          churnPontualNaJanela(janelas.atual),
          churnPontualNaJanela(janelas.anterior),
        ]);
        churnPontual = { ...montarKpi(a.valor, b.valor, "down"), qtdAtual: a.qtd, qtdAnterior: b.qtd };
      } catch (e) {
        console.error("[reports/semanal] churnPontual falhou:", e);
        churnPontual = { ...montarKpi(null, null, "down"), qtdAtual: null, qtdAnterior: null };
      }

      res.json({
        periodo: janelas,
        kpis: { mrrAtivo, churn, entregasPontuais, churnPontual },
      });
    } catch (e: any) {
      console.error("[reports/semanal] erro geral:", e);
      res.status(500).json({ error: "Falha ao montar o reporte semanal", details: e?.message });
    }
  });
}
